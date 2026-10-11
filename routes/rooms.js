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
}
