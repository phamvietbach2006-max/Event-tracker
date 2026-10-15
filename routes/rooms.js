import { HttpError } from '../lib/http.js';
import { requireUser, requireRoomEditor, isSupervisor } from '../lib/perm.js';
import { roomOr404, taskOr404, logActivity, tx, roomView, taskView } from '../lib/repo.js';
import { oneOf, text, STATUSES, TASK_STATES } from '../lib/validate.js';

function touchRoom(db, user, roomId) {
  db.prepare('UPDATE rooms SET updated_at = ?, updated_by = ? WHERE id = ?').run(Date.now(), user.name, roomId);
}

function resolveActor(db, user, config, roomId, action = 'edit') {
  if (config?.openAccess) {
    return user ?? { email: null, name: 'Người kiểm tra', is_admin: 1 };
  }
  requireUser(user);
  requireRoomEditor(db, user, roomId, action);
  return user;
}

export function registerRooms(router) {
  router.add('PATCH', '/api/rooms/:id/status', ({ db, user, config, params, body, sse }) => {
    if (!config?.openAccess) requireUser(user);
    const room = roomOr404(db, params.id);
    const actor = resolveActor(db, user, config, room.id, 'status');
    const status = oneOf(body.status, STATUSES, 'status');

    // Nếu trạng thái là HỦY ĐẠI HỘI: Bắt buộc phải có lý do hủy ở ghi chú (Note)
    let cancelNote = null;
    if (status === 'cancelled') {
      const noteToUse = (typeof body.note === 'string' ? body.note : room.note || '').trim();
      if (!noteToUse) {
        throw new HttpError(400, 'cancel_reason_required', 'Bắt buộc phải ghi rõ lý do hủy Đại hội ở phần Ghi chú kiểm tra (Note).');
      }
      cancelNote = noteToUse;
    }

    // Kiểm tra điều kiện tổ chức đại hội: Bắt buộc >= 2/3 đoàn viên có mặt và 100% checklist giấy tờ
    if (status !== 'red' && status !== 'cancelled' && !body.force && !actor.is_admin && (room.total_members > 0 || body.enforceRules)) {
      const attendees = room.attendees ?? 0;
      const totalMembers = room.total_members ?? 0;
      if (totalMembers <= 0 || (attendees * 3 < totalMembers * 2)) {
        throw new HttpError(400, 'attendance_not_met', 'Chưa đủ điều kiện: Số lượng đoàn viên có mặt phải đạt từ 2/3 sĩ số lớp trở lên.');
      }
      const pendingTasks = db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE room_id = ? AND state != 'done'").get(room.id)?.count ?? 0;
      if (pendingTasks > 0) {
        throw new HttpError(400, 'checklist_incomplete', 'Chưa đủ điều kiện: Checklist giấy tờ chưa hoàn thành 100%.');
      }
    }

    tx(db, () => {
      if (cancelNote !== null) {
        db.prepare('UPDATE rooms SET status = ?, note = ? WHERE id = ?').run(status, cancelNote, room.id);
      } else {
        db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run(status, room.id);
      }
      touchRoom(db, actor, room.id);
      if (status === 'cancelled') {
        logActivity(db, actor, room.id, 'room.cancel', `Hủy đại hội. Lý do: ${cancelNote}`);
      } else {
        logActivity(db, actor, room.id, 'room.status', `${room.status} -> ${status}`);
      }
    });
    sse.broadcast();
    return roomView(roomOr404(db, room.id));
  });

  router.add('PATCH', '/api/rooms/:id/attendance', ({ db, user, config, params, body, sse }) => {
    if (!config?.openAccess) requireUser(user);
    const room = roomOr404(db, params.id);
    const actor = resolveActor(db, user, config, room.id, 'attendance');
    const attendees = Math.max(0, parseInt(body.attendees ?? 0, 10) || 0);
    const totalMembers = Math.max(0, parseInt(body.totalMembers ?? body.total_members ?? 0, 10) || 0);
    tx(db, () => {
      db.prepare('UPDATE rooms SET attendees = ?, total_members = ? WHERE id = ?').run(attendees, totalMembers, room.id);
      touchRoom(db, actor, room.id);
      logActivity(db, actor, room.id, 'room.attendance', `Sĩ số: ${attendees}/${totalMembers}`);
    });
    sse.broadcast();
    return roomView(roomOr404(db, room.id));
  });

  router.add('PATCH', '/api/rooms/:id/note', ({ db, user, config, params, body, sse }) => {
    if (!config?.openAccess) requireUser(user);
    const room = roomOr404(db, params.id);
    const actor = resolveActor(db, user, config, room.id, 'note');
    const note = text(body.note, 150, 'note', { allowEmpty: true });
    tx(db, () => {
      db.prepare('UPDATE rooms SET note = ? WHERE id = ?').run(note, room.id);
      touchRoom(db, actor, room.id);
      logActivity(db, actor, room.id, 'room.note', note);
    });
    sse.broadcast();
    return roomView(roomOr404(db, room.id));
  });

  router.add('PATCH', '/api/tasks/:id', ({ db, user, config, params, body, sse }) => {
    if (!config?.openAccess) requireUser(user);
    const task = taskOr404(db, params.id);
    const actor = resolveActor(db, user, config, task.room_id, 'tasks');
    const hasState = 'state' in body;
    const hasText = 'text' in body;
    if (!hasState && !hasText) throw new HttpError(400, 'bad_request', 'Cần state hoặc text');
    const state = hasState ? oneOf(body.state, TASK_STATES, 'state') : task.state;
    const txt = hasText ? text(body.text, 200, 'text') : task.text;
    tx(db, () => {
      db.prepare('UPDATE tasks SET state = ?, text = ?, updated_at = ?, updated_by = ? WHERE id = ?')
        .run(state, txt, Date.now(), actor.name, task.id);
      touchRoom(db, actor, task.room_id);
      logActivity(db, actor, task.room_id, 'task.update', `${task.id}: ${task.state} -> ${state}${txt !== task.text ? `; text: ${txt}` : ''}`);
    });
    sse.broadcast();
    return taskView(taskOr404(db, task.id));
  });

  // Chủ khu (và admin) thêm/bớt việc ngay trong khu của mình
  router.add('POST', '/api/rooms/:id/tasks', ({ db, user, config, params, body, sse }) => {
    if (!config?.openAccess) requireUser(user);
    const room = roomOr404(db, params.id);
    const actor = resolveActor(db, user, config, room.id, 'tasks');
    const txt = text(body.text, 200, 'text');
    const id = tx(db, () => {
      const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM tasks WHERE room_id = ?').get(room.id).n;
      const info = db.prepare('INSERT INTO tasks(room_id, text, sort, updated_at, updated_by) VALUES (?,?,?,?,?)')
        .run(room.id, txt, sort, Date.now(), actor.name);
      touchRoom(db, actor, room.id);
      logActivity(db, actor, room.id, 'task.add', txt);
      return Number(info.lastInsertRowid);
    });
    sse.broadcast();
    return taskView(taskOr404(db, id));
  });

  router.add('DELETE', '/api/tasks/:id', ({ db, user, config, params, sse }) => {
    if (!config?.openAccess) requireUser(user);
    const task = taskOr404(db, params.id);
    const actor = resolveActor(db, user, config, task.room_id, 'tasks');
    tx(db, () => {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
      touchRoom(db, actor, task.room_id);
      logActivity(db, actor, task.room_id, 'task.delete', task.text);
    });
    sse.broadcast();
    return { ok: true };
  });

  router.add('POST', '/api/rooms/:id/lock', ({ db, user, config, params, sse }) => {
    if (!config?.openAccess) requireUser(user);
    const room = roomOr404(db, params.id);
    const actor = resolveActor(db, user, config, room.id, 'lock');

    tx(db, () => {
      db.prepare('UPDATE rooms SET is_locked = 1, locked_at = ?, locked_by = ? WHERE id = ?')
        .run(Date.now(), actor.name || actor.email || 'Cán bộ', room.id);
      touchRoom(db, actor, room.id);
      logActivity(db, actor, room.id, 'room.lock', `Đã hoàn thành và lưu/khóa kết quả lớp ${room.name}`);
    });
    sse.broadcast();
    return roomView(roomOr404(db, room.id));
  });

  router.add('POST', '/api/rooms/:id/unlock', ({ db, user, config, params, sse }) => {
    if (!config?.openAccess) {
      requireUser(user);
      if (!isSupervisor(db, user, params.id)) {
        throw new HttpError(403, 'supervisor_required', 'Chỉ có Cấp trên (Admin, Phụ trách Đơn vị, Phụ trách Tầng) mới có quyền mở khóa lớp này.');
      }
    }
    const room = roomOr404(db, params.id);
    const actor = user ?? { email: null, name: 'Cấp trên', is_admin: 1 };

    tx(db, () => {
      db.prepare('UPDATE rooms SET is_locked = 0, locked_at = NULL, locked_by = NULL WHERE id = ?')
        .run(room.id);
      touchRoom(db, actor, room.id);
      logActivity(db, actor, room.id, 'room.unlock', `Cấp trên (${actor.name || actor.email}) đã mở khóa cho phép sửa lại kết quả lớp ${room.name}`);
    });
    sse.broadcast();
    return roomView(roomOr404(db, room.id));
  });
}

