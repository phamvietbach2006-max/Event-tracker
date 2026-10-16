import { HttpError } from '../lib/http.js';
import { requireUser, isPermanentAdmin } from '../lib/perm.js';
import { roomOr404, logActivity, tx } from '../lib/repo.js';
import { oneOf } from '../lib/validate.js';

function getUserRole(db, email) {
  const norm = String(email || '').trim().toLowerCase();
  if (isPermanentAdmin(norm)) return 'admin';
  const u = db.prepare('SELECT is_admin, role FROM users WHERE LOWER(email) = ?').get(norm);
  if (!u) return 'guest';
  if (u.is_admin || u.role === 'admin') return 'admin';
  return u.role || 'room_lead';
}

export function registerQuorum(router) {
  // ── GET /api/rooms/:id/quorum-targets: Lấy danh sách 1 Admin online hoặc 1 Phụ trách tầng online để xin duyệt ──
  router.add('GET', '/api/rooms/:id/quorum-targets', ({ db, user, config, params, sse }) => {
    if (!config?.openAccess) requireUser(user);
    const room = roomOr404(db, params.id);
    const group = db.prepare('SELECT id, name FROM groups WHERE id = ?').get(room.group_id);

    const allUsers = db.prepare('SELECT email, name, role, is_admin, phone FROM users').all();

    // 1. Danh sách Admin
    const admins = allUsers
      .filter((u) => u.is_admin || u.role === 'admin' || isPermanentAdmin(u.email))
      .map((u) => ({
        email: u.email,
        name: u.name,
        role: 'admin',
        isOnline: sse ? sse.isUserOnline(u.email) : false,
        phone: u.phone || null,
      }))
      .sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0) || a.name.localeCompare(b.name, 'vi'));

    // 2. Danh sách Phụ trách tầng của nhóm/khu vực này
    const floorLeadEmails = db.prepare('SELECT LOWER(email) AS email FROM user_groups WHERE group_id = ?').all(room.group_id).map((r) => r.email);
    const floorLeads = allUsers
      .filter((u) => floorLeadEmails.includes(u.email.toLowerCase()) || (u.role === 'floor_lead' && floorLeadEmails.includes(u.email.toLowerCase())))
      .map((u) => ({
        email: u.email,
        name: u.name,
        role: 'floor_lead',
        isOnline: sse ? sse.isUserOnline(u.email) : false,
        phone: u.phone || null,
        groupName: group?.name || '',
      }))
      .sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0) || a.name.localeCompare(b.name, 'vi'));

    return {
      roomId: room.id,
      roomName: room.name,
      groupName: group?.name || '',
      admins,
      floorLeads,
    };
  });

  // ── POST /api/rooms/:id/quorum-request: Gửi yêu cầu xin phê duyệt cho đúng 1 người (Admin hoặc Phụ trách tầng) ──
  router.add('POST', '/api/rooms/:id/quorum-request', ({ db, user, config, params, body, sse }) => {
    if (!config?.openAccess) requireUser(user);
    const room = roomOr404(db, params.id);
    const actor = user ?? { email: null, name: 'Cán bộ kiểm tra', role: 'room_lead' };

    const targetType = oneOf(body.targetType || 'admin', ['admin', 'floor_lead', 'both'], 'targetType');

    const attendees = Math.max(0, parseInt(body.attendees ?? room.attendees ?? 0, 10) || 0);
    const totalMembers = Math.max(0, parseInt(body.totalMembers ?? room.total_members ?? 0, 10) || 0);

    const group = db.prepare('SELECT name FROM groups WHERE id = ?').get(room.group_id);
    const now = Date.now();

    // Xác định đích danh 1 người nhận (nếu có):
    let targetUser = null;
    const rawTargetEmail = typeof body.targetEmail === 'string' ? body.targetEmail.trim().toLowerCase() : '';
    if (rawTargetEmail) {
      targetUser = db.prepare('SELECT email, name, role, is_admin FROM users WHERE LOWER(email) = ?').get(rawTargetEmail);
    }

    if (!targetUser && targetType !== 'both') {
      if (targetType === 'floor_lead') {
        const floorLeadEmails = db.prepare('SELECT LOWER(email) AS email FROM user_groups WHERE group_id = ?').all(room.group_id).map((r) => r.email);
        if (floorLeadEmails.length > 0) {
          const candidates = db.prepare('SELECT email, name, role, is_admin FROM users WHERE LOWER(email) IN (' + floorLeadEmails.map(() => '?').join(',') + ')').all(...floorLeadEmails);
          targetUser = candidates.find((c) => sse && sse.isUserOnline(c.email)) || candidates[0] || null;
        }
      }
      if (!targetUser) {
        const allAdmins = db.prepare('SELECT email, name, role, is_admin FROM users WHERE is_admin = 1 OR role = ?').all('admin');
        targetUser = allAdmins.find((c) => sse && sse.isUserOnline(c.email)) || allAdmins[0] || { email: 'anh.tdh250154e@sis.hust.edu.vn', name: 'Ban Quản trị' };
      }
    }

    const targetEmail = targetUser?.email || null;
    const targetName = targetUser?.name || (targetType === 'both' ? 'Ban Quản trị & Phụ trách tầng' : (targetType === 'admin' ? 'Quản trị viên' : 'Phụ trách tầng'));

    const info = tx(db, () => {
      // Lưu lại sĩ số thực tế cập nhật
      db.prepare('UPDATE rooms SET attendees = ?, total_members = ? WHERE id = ?').run(attendees, totalMembers, room.id);

      const insert = db.prepare(`
        INSERT INTO quorum_requests (
          room_id, sender_email, sender_name, sender_role, target_type, target_email, target_name,
          attendees, total_members, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        room.id,
        actor.email || 'anonymous',
        actor.name || 'Cán bộ trực lớp',
        actor.role || 'room_lead',
        targetType,
        targetEmail,
        targetName,
        attendees,
        totalMembers,
        now
      );

      const targetLabel = targetEmail ? `${targetName} (${targetType === 'admin' ? 'Ban Quản trị' : 'Phụ trách tầng'})` : (targetType === 'both' ? 'Ban Quản trị & Phụ trách tầng' : targetName);
      logActivity(db, actor, room.id, 'quorum.request', `Xin phê duyệt sĩ số: ${attendees}/${totalMembers} đoàn viên (Gửi đích danh: ${targetLabel})`);
      return Number(insert.lastInsertRowid);
    });

    // Phát thông báo khẩn cấp qua SSE đích danh tới người nhận
    sse.broadcast();
    if (sse.broadcastNotification) {
      sse.broadcastNotification({
        id: info,
        type: 'quorum_request',
        level: 'urgent',
        title: `🚨 Yêu cầu phê duyệt sĩ số: ${room.name}`,
        content: `Cán bộ ${actor.name} gửi yêu cầu phê duyệt đặc cách sĩ số cho ${room.name} (${group?.name || ''}). Sĩ số thực tế: ${attendees}/${totalMembers}.`,
        target_type: targetType,
        target_email: targetEmail,
        target_name: targetName,
        sender_name: actor.name,
      });
    }

    return {
      ok: true,
      requestId: info,
      roomId: room.id,
      attendees,
      totalMembers,
      targetType,
      targetEmail,
      targetName,
      status: 'pending',
      createdAt: now,
    };
  });

  // ── GET /api/quorum-requests/pending: Lấy danh sách yêu cầu cần duyệt cho đúng người được gửi ──
  router.add('GET', '/api/quorum-requests/pending', ({ db, user, config }) => {
    if (!config?.openAccess && !user) return { requests: [] };
    const email = String(user?.email || '').trim().toLowerCase();
    const isAdmin = config?.openAccess ? true : (isPermanentAdmin(email) || user?.is_admin || user?.role === 'admin');
    const role = getUserRole(db, email);

    // Lấy tất cả yêu cầu có status = 'pending'
    const pendingRows = db.prepare(`
      SELECT qr.id, qr.room_id, qr.sender_email, qr.sender_name, qr.sender_role,
             qr.target_type, qr.target_email, qr.target_name, qr.attendees, qr.total_members, qr.status,
             qr.admin_decision, qr.admin_decided_by, qr.admin_decided_at,
             qr.floor_decision, qr.floor_decided_by, qr.floor_decided_at,
             qr.created_at,
             r.name AS room_name, r.group_id, g.name AS group_name, r.quorum_exempt
      FROM quorum_requests qr
      JOIN rooms r ON r.id = qr.room_id
      JOIN groups g ON g.id = r.group_id
      WHERE qr.status = 'pending'
      ORDER BY qr.created_at DESC
    `).all();

    // Lọc theo người nhận đích danh để chỉ duy nhất 1 người được chỉ định mới nhận được pop-up và xử lý (tránh xung đột)
    const list = pendingRows.filter((r) => {
      if (r.target_email) {
        return r.target_email.toLowerCase() === email;
      }
      if (isAdmin) {
        return (r.target_type === 'admin' || r.target_type === 'both') && r.admin_decision === null;
      }
      if (role === 'floor_lead') {
        const assignedGroupIds = db.prepare('SELECT group_id FROM user_groups WHERE LOWER(email) = ?').all(email).map((g) => g.group_id);
        return (r.target_type === 'floor_lead' || r.target_type === 'both') && assignedGroupIds.includes(r.group_id) && r.floor_decision === null;
      }
      return false;
    });

    return { requests: list };
  });

  // ── POST /api/quorum-requests/:id/decision: Quyết định phê duyệt hoặc từ chối ──
  router.add('POST', '/api/quorum-requests/:id/decision', ({ db, user, config, params, body, sse }) => {
    if (!config?.openAccess) requireUser(user);
    const email = String(user?.email || '').trim().toLowerCase();
    const isAdmin = config?.openAccess ? true : (isPermanentAdmin(email) || user?.is_admin || user?.role === 'admin');
    const role = getUserRole(db, email);

    const reqId = Number(params.id);
    const request = db.prepare(`
      SELECT qr.*, r.group_id, r.name AS room_name
      FROM quorum_requests qr
      JOIN rooms r ON r.id = qr.room_id
      WHERE qr.id = ?
    `).get(reqId);

    if (!request) throw new HttpError(404, 'request_not_found', 'Không tìm thấy yêu cầu phê duyệt');

    // Kiểm tra quyền hạn
    if (!isAdmin && role !== 'floor_lead') {
      throw new HttpError(403, 'forbidden', 'Chỉ Ban Quản trị hoặc Phụ trách tầng mới có quyền phê duyệt yêu cầu này');
    }

    if (!isAdmin && role === 'floor_lead') {
      const isMyFloor = !!db.prepare('SELECT 1 FROM user_groups WHERE group_id = ? AND LOWER(email) = ?').get(request.group_id, email);
      if (!isMyFloor) {
        throw new HttpError(403, 'forbidden', 'Bạn không phụ trách tầng của lớp học này');
      }
    }

    const decision = oneOf(body.decision, ['approved', 'rejected'], 'decision');
    const actorName = user?.name || user?.email || (isAdmin ? 'Quản trị viên' : 'Phụ trách tầng');
    const now = Date.now();

    tx(db, () => {
      let adminDecision = request.admin_decision;
      let adminDecidedBy = request.admin_decided_by;
      let adminDecidedAt = request.admin_decided_at;
      let floorDecision = request.floor_decision;
      let floorDecidedBy = request.floor_decided_by;
      let floorDecidedAt = request.floor_decided_at;

      if (isAdmin) {
        adminDecision = decision;
        adminDecidedBy = actorName;
        adminDecidedAt = now;
      } else {
        floorDecision = decision;
        floorDecidedBy = actorName;
        floorDecidedAt = now;
      }

      // ── QUY TẮC PHÂN CẤP THẨM QUYỀN (HIERARCHICAL DECISION RULES) ──
      // 1. Admin là tối cao:
      //    Nếu Admin duyệt -> Có hiệu lực (bất kể Phụ trách tầng)
      //    Nếu Admin từ chối -> Không có hiệu lực (bất kể Phụ trách tầng)
      // 2. Nếu Admin chưa quyết định:
      //    Nếu Phụ trách tầng duyệt -> Có hiệu lực tạm thời cho tới khi Admin can thiệp
      //    Nếu Phụ trách tầng từ chối:
      //      - nếu target là 'floor_lead': Bị từ chối
      //      - nếu target là 'both': vẫn chờ Admin quyết định
      let effectiveExempt = false;
      let overallStatus = 'pending';

      if (adminDecision === 'approved') {
        effectiveExempt = true;
        overallStatus = 'approved';
      } else if (adminDecision === 'rejected') {
        effectiveExempt = false;
        overallStatus = 'rejected';
      } else {
        // adminDecision === null
        if (floorDecision === 'approved') {
          effectiveExempt = true;
          overallStatus = 'approved';
        } else if (floorDecision === 'rejected') {
          if (request.target_type === 'floor_lead') {
            effectiveExempt = false;
            overallStatus = 'rejected';
          } else {
            effectiveExempt = false;
            overallStatus = 'pending';
          }
        }
      }

      db.prepare(`
        UPDATE quorum_requests
        SET admin_decision = ?, admin_decided_by = ?, admin_decided_at = ?,
            floor_decision = ?, floor_decided_by = ?, floor_decided_at = ?,
            status = ?, resolved_at = ?
        WHERE id = ?
      `).run(
        adminDecision, adminDecidedBy, adminDecidedAt,
        floorDecision, floorDecidedBy, floorDecidedAt,
        overallStatus,
        overallStatus !== 'pending' ? now : null,
        reqId
      );

      // Cập nhật cờ quorum_exempt trên bảng rooms
      db.prepare('UPDATE rooms SET quorum_exempt = ? WHERE id = ?').run(effectiveExempt ? 1 : 0, request.room_id);

      const decisionText = decision === 'approved' ? 'CHO PHÉP tiến hành Đại hội (gỡ yêu cầu 2/3)' : 'KHÔNG ĐỒNG Ý (giữ nguyên yêu cầu 2/3)';
      const roleText = isAdmin ? 'Ban Quản trị (Admin)' : 'Phụ trách tầng';
      logActivity(db, user, request.room_id, 'quorum.decision', `${actorName} (${roleText}) đã quyết định: ${decisionText}. Sĩ số: ${request.attendees}/${request.total_members}`);
    });

    sse.broadcast();

    const updated = db.prepare('SELECT * FROM quorum_requests WHERE id = ?').get(reqId);
    const room = roomOr404(db, request.room_id);

    return {
      ok: true,
      request: updated,
      roomExempt: Boolean(room.quorum_exempt),
      message: room.quorum_exempt
        ? 'Đã phê duyệt và gỡ bỏ yêu cầu 2/3 sĩ số thành công!'
        : 'Đã ghi nhận quyết định từ chối. Lớp vẫn giữ nguyên yêu cầu đạt 2/3 sĩ số.',
    };
  });

  // ── GET /api/rooms/:id/quorum-status: Lấy yêu cầu mới nhất của lớp ──
  router.add('GET', '/api/rooms/:id/quorum-status', ({ db, params }) => {
    const roomId = Number(params.id);
    const latest = db.prepare(`
      SELECT * FROM quorum_requests
      WHERE room_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(roomId);

    const room = roomOr404(db, roomId);
    return {
      roomId,
      quorumExempt: Boolean(room.quorum_exempt),
      latestRequest: latest || null,
    };
  });
}
