import { HttpError } from './http.js';
import { toInt } from './validate.js';

const notFound = (what) => new HttpError(404, 'not_found', `Không tìm thấy ${what}`);

function byId(db, table, id, what) {
  const n = toInt(id);
  const row = n === null ? undefined : db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(n);
  if (!row) throw notFound(what);
  return row;
}
export const roomOr404 = (db, id) => byId(db, 'rooms', id, 'khu');
export const taskOr404 = (db, id) => byId(db, 'tasks', id, 'việc');
export const groupOr404 = (db, id) => byId(db, 'groups', id, 'khối');

export function logActivity(db, user, roomId, action, detail = null) {
  db.prepare('INSERT INTO activity(ts, email, room_id, action, detail) VALUES (?,?,?,?,?)')
    .run(Date.now(), user?.email ?? null, roomId ?? null, action, detail);
}

export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const v = fn();
    db.exec('COMMIT');
    return v;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const roomView = (r) => ({
  id: r.id, groupId: r.group_id, name: r.name, status: r.status, note: r.note,
  sort: r.sort, updatedAt: r.updated_at, updatedBy: r.updated_by,
});
export const taskView = (t) => ({ id: t.id, roomId: t.room_id, text: t.text, state: t.state, sort: t.sort });
