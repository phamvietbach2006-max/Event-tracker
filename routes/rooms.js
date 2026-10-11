import { HttpError } from '../lib/http.js';
import { requireUser, requireAdmin, requireRoomEditor } from '../lib/perm.js';
import { roomOr404, taskOr404, logActivity, tx, roomView, taskView } from '../lib/repo.js';
import { oneOf, text, STATUSES, TASK_STATES } from '../lib/validate.js';

function touchRoom(db, user, roomId) {
  db.prepare('UPDATE rooms SET updated_at = ?, updated_by = ? WHERE id = ?').run(Date.now(), user.name, roomId);
}

export function registerRooms(router) {
  router.add('PATCH', '/api/rooms/:id/status', ({ db, user, params, body, sse }) => {
    requireUser(user);
    const room = roomOr404(db, params.id);
    requireRoomEditor(db, user, room.id);
    const status = oneOf(body.status, STATUSES, 'status');
    db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run(status, room.id);
    touchRoom(db, user, room.id);
    logActivity(db, user, room.id, 'room.status', `${room.status} -> ${status}`);
    sse.broadcast();
    return roomView(roomOr404(db, room.id));
  });

  router.add('PATCH', '/api/rooms/:id/note', ({ db, user, params, body, sse }) => {
    requireUser(user);
    const room = roomOr404(db, params.id);
    requireRoomEditor(db, user, room.id);
    const note = text(body.note, 150, 'note', { allowEmpty: true });
    db.prepare('UPDATE rooms SET note = ? WHERE id = ?').run(note, room.id);
    touchRoom(db, user, room.id);
    logActivity(db, user, room.id, 'room.note', note);
    sse.broadcast();
    return roomView(roomOr404(db, room.id));
  });

  router.add('PATCH', '/api/tasks/:id', ({ db, user, params, body, sse }) => {
    requireUser(user);
    const task = taskOr404(db, params.id);
    requireRoomEditor(db, user, task.room_id);
    const hasState = 'state' in body;
    const hasText = 'text' in body;
    if (!hasState && !hasText) throw new HttpError(400, 'bad_request', 'Cần state hoặc text');
    if (hasText) requireAdmin(user);
    const state = hasState ? oneOf(body.state, TASK_STATES, 'state') : task.state;
    const txt = hasText ? text(body.text, 200, 'text') : task.text;
    tx(db, () => {
      db.prepare('UPDATE tasks SET state = ?, text = ?, updated_at = ?, updated_by = ? WHERE id = ?')
        .run(state, txt, Date.now(), user.name, task.id);
      touchRoom(db, user, task.room_id);
    });
    logActivity(db, user, task.room_id, 'task.update', `${task.id}: ${task.state} -> ${state}`);
    sse.broadcast();
    return taskView(taskOr404(db, task.id));
  });

  // Chủ khu (và admin) thêm/bớt việc ngay trong khu của mình
  router.add('POST', '/api/rooms/:id/tasks', ({ db, user, params, body, sse }) => {
    requireUser(user);
    const room = roomOr404(db, params.id);
    requireRoomEditor(db, user, room.id);
    const txt = text(body.text, 200, 'text');
    const id = tx(db, () => {
      const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM tasks WHERE room_id = ?').get(room.id).n;
      const info = db.prepare('INSERT INTO tasks(room_id, text, sort, updated_at, updated_by) VALUES (?,?,?,?,?)')
        .run(room.id, txt, sort, Date.now(), user.name);
      touchRoom(db, user, room.id);
      return Number(info.lastInsertRowid);
    });
    logActivity(db, user, room.id, 'task.add', txt);
    sse.broadcast();
    return taskView(taskOr404(db, id));
  });

  router.add('DELETE', '/api/tasks/:id', ({ db, user, params, sse }) => {
    requireUser(user);
    const task = taskOr404(db, params.id);
    requireRoomEditor(db, user, task.room_id);
    tx(db, () => {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
      touchRoom(db, user, task.room_id);
    });
    logActivity(db, user, task.room_id, 'task.delete', task.text);
    sse.broadcast();
    return { ok: true };
  });
}
