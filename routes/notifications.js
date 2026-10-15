import { HttpError } from '../lib/http.js';
import { requireUser, isPermanentAdmin } from '../lib/perm.js';
import { logActivity, tx } from '../lib/repo.js';
import { text, oneOf } from '../lib/validate.js';

function getUserRole(db, email) {
  const norm = String(email || '').trim().toLowerCase();
  if (isPermanentAdmin(norm)) return 'admin';
  const u = db.prepare('SELECT is_admin, role FROM users WHERE LOWER(email) = ?').get(norm);
  if (!u) return 'guest';
  if (u.is_admin || u.role === 'admin') return 'admin';
  return u.role || 'room_lead';
}

function parseGroupMeta(name) {
  const m = /^\[([^\]]+)\]\s*(.*)$/.exec(name || '');
  if (m) {
    return { unit: m[1].trim(), floorName: m[2].trim() };
  }
  return { unit: 'Toàn trường', floorName: name || '' };
}

export function registerNotifications(router) {
  // ── GET /api/notifications: Lấy danh sách thông báo phù hợp với người dùng hiện tại ──
  router.add('GET', '/api/notifications', ({ db, user }) => {
    if (!user) {
      // Khách vãng lai: chỉ nhận thông báo public 'all'
      const rows = db.prepare(`
        SELECT id, sender_name, sender_role, title, content, level, target_type, target_label, created_at, 0 AS is_read
        FROM notifications
        WHERE target_type = 'all'
        ORDER BY created_at DESC, id DESC
        LIMIT 30
      `).all();
      return { notifications: rows };
    }

    const email = String(user.email || '').trim().toLowerCase();
    const role = getUserRole(db, email);

    let rows = [];
    if (role === 'admin') {
      // Admin thấy toàn bộ thông báo hệ thống
      rows = db.prepare(`
        SELECT n.id, n.sender_name, n.sender_role, n.title, n.content, n.level, n.target_type, n.target_label, n.created_at,
               CASE WHEN nr.read_at IS NOT NULL THEN 1 ELSE 0 END AS is_read
        FROM notifications n
        LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND LOWER(nr.email) = ?
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT 50
      `).all(email);
    } else {
      // Cán bộ: nhận thông báo 'all', 'building' của đơn vị mình, 'floor' của tầng mình, hoặc gửi đích danh cho mình
      const assignedUnits = db.prepare('SELECT unit FROM user_units WHERE LOWER(email) = ?').all(email).map((r) => r.unit);
      const assignedGroupIds = db.prepare('SELECT group_id FROM user_groups WHERE LOWER(email) = ?').all(email).map((r) => String(r.group_id));

      // Lấy thêm unit và group_id từ các phòng mình được gán trong room_owners
      const ownerRooms = db.prepare(`
        SELECT r.group_id, g.name AS group_name
        FROM room_owners ro
        JOIN rooms r ON r.id = ro.room_id
        JOIN groups g ON g.id = r.group_id
        WHERE LOWER(ro.email) = ?
      `).all(email);

      for (const r of ownerRooms) {
        const { unit } = parseGroupMeta(r.group_name);
        if (unit && !assignedUnits.includes(unit)) assignedUnits.push(unit);
        if (r.group_id && !assignedGroupIds.includes(String(r.group_id))) assignedGroupIds.push(String(r.group_id));
      }

      const allNotifs = db.prepare(`
        SELECT n.id, n.sender_name, n.sender_role, n.title, n.content, n.level, n.target_type, n.target_id, n.target_label, n.created_at,
               CASE WHEN nr.read_at IS NOT NULL THEN 1 ELSE 0 END AS is_read
        FROM notifications n
        LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND LOWER(nr.email) = ?
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT 100
      `).all(email);

      rows = allNotifs.filter((n) => {
        if (n.target_type === 'all') return true;
        if (n.target_type === 'user' && String(n.target_id).toLowerCase() === email) return true;
        if (n.target_type === 'building' && assignedUnits.includes(n.target_id)) return true;
        if (n.target_type === 'floor' && assignedGroupIds.includes(String(n.target_id))) return true;
        // Nếu chính mình là người gửi thì luôn thấy thông báo mình đã gửi
        if (n.sender_name === user.name) return true;
        return false;
      }).slice(0, 50);
    }

    return { notifications: rows };
  });

  // ── GET /api/notifications/targets: Lấy danh mục đối tượng có thể gửi thông báo ──
  router.add('GET', '/api/notifications/targets', ({ db, user }) => {
    requireUser(user);
    const email = String(user.email || '').trim().toLowerCase();
    const role = getUserRole(db, email);

    if (role !== 'admin' && role !== 'unit_lead' && role !== 'floor_lead') {
      throw new HttpError(403, 'forbidden', 'Chỉ Quản trị viên, Phụ trách Đơn vị hoặc Phụ trách Tầng mới có quyền gửi thông báo.');
    }

    const allGroups = db.prepare('SELECT id, name FROM groups ORDER BY sort, id').all();
    const allUsers = db.prepare(`
      SELECT email, name, role, is_admin
      FROM users
      ORDER BY name
    `).all();

    if (role === 'admin') {
      const buildings = [...new Set(allGroups.map((g) => parseGroupMeta(g.name).unit))].filter(Boolean);
      const floors = allGroups.map((g) => {
        const { unit, floorName } = parseGroupMeta(g.name);
        return { id: String(g.id), label: `${unit} · ${floorName}`, unit, floorName };
      });
      const officers = allUsers.map((u) => ({
        email: u.email,
        name: u.name,
        role: (u.is_admin || isPermanentAdmin(u.email)) ? 'admin' : (u.role || 'room_lead'),
      }));

      return {
        canBroadcastAll: true,
        canBroadcastBuilding: true,
        canBroadcastFloor: true,
        canBroadcastUser: true,
        buildings,
        floors,
        users: officers,
      };
    }

    if (role === 'unit_lead') {
      const myUnits = db.prepare('SELECT unit FROM user_units WHERE LOWER(email) = ?').all(email).map((r) => r.unit);
      const floors = allGroups
        .filter((g) => myUnits.includes(parseGroupMeta(g.name).unit))
        .map((g) => {
          const { unit, floorName } = parseGroupMeta(g.name);
          return { id: String(g.id), label: `${unit} · ${floorName}`, unit, floorName };
        });

      // Lấy danh sách cán bộ phụ trách các tầng/phòng thuộc đơn vị của mình
      const groupIds = floors.map((f) => Number(f.id));
      let subordinateEmails = new Set();
      if (groupIds.length > 0) {
        const ph = groupIds.map(() => '?').join(',');
        const floorLeads = db.prepare(`SELECT email FROM user_groups WHERE group_id IN (${ph})`).all(...groupIds);
        floorLeads.forEach((r) => subordinateEmails.add(r.email.toLowerCase()));

        const roomLeads = db.prepare(`
          SELECT ro.email
          FROM room_owners ro
          JOIN rooms r ON r.id = ro.room_id
          WHERE r.group_id IN (${ph})
        `).all(...groupIds);
        roomLeads.forEach((r) => subordinateEmails.add(r.email.toLowerCase()));
      }

      const officers = allUsers
        .filter((u) => subordinateEmails.has(u.email.toLowerCase()))
        .map((u) => ({ email: u.email, name: u.name, role: u.role || 'room_lead' }));

      return {
        canBroadcastAll: false,
        canBroadcastBuilding: true,
        canBroadcastFloor: true,
        canBroadcastUser: true,
        buildings: myUnits,
        floors,
        users: officers,
      };
    }

    if (role === 'floor_lead') {
      const myGroupIds = db.prepare('SELECT group_id FROM user_groups WHERE LOWER(email) = ?').all(email).map((r) => r.group_id);
      const floors = allGroups
        .filter((g) => myGroupIds.includes(g.id))
        .map((g) => {
          const { unit, floorName } = parseGroupMeta(g.name);
          return { id: String(g.id), label: `${unit} · ${floorName}`, unit, floorName };
        });

      let subordinateEmails = new Set();
      if (myGroupIds.length > 0) {
        const ph = myGroupIds.map(() => '?').join(',');
        const roomLeads = db.prepare(`
          SELECT ro.email
          FROM room_owners ro
          JOIN rooms r ON r.id = ro.room_id
          WHERE r.group_id IN (${ph})
        `).all(...myGroupIds);
        roomLeads.forEach((r) => subordinateEmails.add(r.email.toLowerCase()));
      }

      const officers = allUsers
        .filter((u) => subordinateEmails.has(u.email.toLowerCase()))
        .map((u) => ({ email: u.email, name: u.name, role: u.role || 'room_lead' }));

      return {
        canBroadcastAll: false,
        canBroadcastBuilding: false,
        canBroadcastFloor: true,
        canBroadcastUser: true,
        buildings: [],
        floors,
        users: officers,
      };
    }
  });

  // ── POST /api/notifications: Tạo và phát thông báo hệ thống ──
  router.add('POST', '/api/notifications', ({ db, user, body, sse }) => {
    requireUser(user);
    const email = String(user.email || '').trim().toLowerCase();
    const role = getUserRole(db, email);

    if (role !== 'admin' && role !== 'unit_lead' && role !== 'floor_lead') {
      throw new HttpError(403, 'forbidden', 'Chỉ Quản trị viên, Phụ trách Đơn vị hoặc Phụ trách Tầng mới có quyền gửi thông báo.');
    }

    const title = text(body.title, 150, 'title');
    const content = text(body.content, 1000, 'content');
    const level = oneOf(body.level || 'info', ['info', 'warning', 'urgent'], 'level');
    const targetType = oneOf(body.targetType || body.target_type, ['all', 'building', 'floor', 'user'], 'targetType');
    const targetId = body.targetId != null ? String(body.targetId).trim() : null;
    let targetLabel = body.targetLabel != null ? String(body.targetLabel).trim() : '';

    // Phân quyền phạm vi gửi:
    if (targetType === 'all') {
      if (role !== 'admin') {
        throw new HttpError(403, 'forbidden', 'Chỉ Quản trị viên mới được gửi thông báo toàn hệ thống.');
      }
      targetLabel = 'Toàn hệ thống (Tất cả thành viên)';
    } else if (targetType === 'building') {
      if (role !== 'admin' && role !== 'unit_lead') {
        throw new HttpError(403, 'forbidden', 'Bạn không có quyền gửi thông báo theo tòa/đơn vị.');
      }
      if (role === 'unit_lead') {
        const myUnits = db.prepare('SELECT unit FROM user_units WHERE LOWER(email) = ?').all(email).map((r) => r.unit);
        if (!myUnits.includes(targetId)) {
          throw new HttpError(403, 'forbidden', `Bạn chỉ có quyền gửi thông báo cho đơn vị mình phụ trách (${myUnits.join(', ')}).`);
        }
      }
      targetLabel = targetLabel || `Đơn vị/Tòa: ${targetId}`;
    } else if (targetType === 'floor') {
      if (role === 'floor_lead') {
        const myGroupIds = db.prepare('SELECT group_id FROM user_groups WHERE LOWER(email) = ?').all(email).map((r) => String(r.group_id));
        if (!myGroupIds.includes(String(targetId))) {
          throw new HttpError(403, 'forbidden', 'Bạn chỉ có quyền gửi thông báo cho tầng mình phụ trách.');
        }
      } else if (role === 'unit_lead') {
        const group = db.prepare('SELECT name FROM groups WHERE id = ?').get(targetId);
        if (!group) throw new HttpError(404, 'floor_not_found', 'Tầng không tồn tại.');
        const myUnits = db.prepare('SELECT unit FROM user_units WHERE LOWER(email) = ?').all(email).map((r) => r.unit);
        const { unit } = parseGroupMeta(group.name);
        if (!myUnits.includes(unit)) {
          throw new HttpError(403, 'forbidden', 'Tầng này không thuộc đơn vị bạn phụ trách.');
        }
      }
      targetLabel = targetLabel || `Tầng: ${targetId}`;
    } else if (targetType === 'user') {
      const recipient = db.prepare('SELECT name, email FROM users WHERE LOWER(email) = ?').get(String(targetId).toLowerCase());
      if (!recipient) throw new HttpError(404, 'user_not_found', 'Không tìm thấy người nhận chỉ định.');
      targetLabel = targetLabel || `${recipient.name} (${recipient.email})`;
    }

    const now = Date.now();
    const notif = tx(db, () => {
      const info = db.prepare(`
        INSERT INTO notifications (sender_email, sender_name, sender_role, title, content, level, target_type, target_id, target_label, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(email, user.name || email, role, title, content, level, targetType, targetId, targetLabel, now);

      const id = Number(info.lastInsertRowid);
      logActivity(db, user, null, 'notification.send', `[${level.toUpperCase()}] ${title} -> ${targetLabel}: ${content.slice(0, 80)}`);

      return {
        id,
        sender_email: email,
        sender_name: user.name || email,
        sender_role: role,
        title,
        content,
        level,
        target_type: targetType,
        target_id: targetId,
        target_label: targetLabel,
        created_at: now,
      };
    });

    // Phát qua SSE theo thời gian thực tới tất cả các client đang online
    if (sse?.broadcastNotification) {
      sse.broadcastNotification(notif);
    }

    return { ok: true, notification: notif };
  });

  // ── POST /api/notifications/:id/read: Đánh dấu đã đọc thông báo ──
  router.add('POST', '/api/notifications/:id/read', ({ db, user, params }) => {
    requireUser(user);
    const email = String(user.email || '').trim().toLowerCase();
    const id = parseInt(params.id, 10);
    if (!id) throw new HttpError(400, 'bad_request', 'ID thông báo không hợp lệ');

    db.prepare(`
      INSERT OR IGNORE INTO notification_reads (notification_id, email, read_at)
      VALUES (?, ?, ?)
    `).run(id, email, Date.now());

    return { ok: true };
  });

  // ── POST /api/notifications/read-all: Đánh dấu tất cả đã đọc ──
  router.add('POST', '/api/notifications/read-all', ({ db, user }) => {
    requireUser(user);
    const email = String(user.email || '').trim().toLowerCase();
    const notifs = db.prepare('SELECT id FROM notifications').all();
    const now = Date.now();
    tx(db, () => {
      const stmt = db.prepare('INSERT OR IGNORE INTO notification_reads (notification_id, email, read_at) VALUES (?, ?, ?)');
      for (const n of notifs) {
        stmt.run(n.id, email, now);
      }
    });
    return { ok: true };
  });
}
