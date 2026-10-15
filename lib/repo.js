import { HttpError } from './http.js';
import { toInt } from './validate.js';

const notFound = (what) => new HttpError(404, 'not_found', `Không tìm thấy ${what}`);

const ALLOWED_TABLES = new Set(['rooms', 'tasks', 'groups', 'users']);

function byId(db, table, id, what) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid table name: ${table}`);
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
  if (db.inTransaction || db._inTx) {
    return fn();
  }
  db._inTx = true;
  let inTx = false;
  try {
    db.exec('BEGIN IMMEDIATE');
    inTx = true;
  } catch (err) {
    if (err.message && (err.message.includes('cannot start a transaction within a transaction') || err.message.includes('cannot start transaction'))) {
      db._inTx = false;
      return fn();
    }
    try {
      db.exec('BEGIN');
      inTx = true;
    } catch {
      db._inTx = false;
      return fn();
    }
  }

  try {
    const v = fn();
    if (v && typeof v.then === 'function') {
      throw new Error('tx() chỉ hỗ trợ hàm đồng bộ (synchronous). Không dùng async function trong tx().');
    }
    if (inTx) {
      db.exec('COMMIT');
    }
    return v;
  } catch (e) {
    if (inTx) {
      try {
        db.exec('ROLLBACK');
      } catch (rbErr) {
        console.warn('Lỗi khi ROLLBACK:', rbErr.message);
      }
    }
    throw e;
  } finally {
    db._inTx = false;
  }
}

export const roomView = (r) => ({
  id: r.id, groupId: r.group_id, name: r.name, status: r.status, note: r.note,
  attendees: r.attendees ?? 0, totalMembers: r.total_members ?? 0,
  isLocked: Boolean(r.is_locked), lockedAt: r.locked_at, lockedBy: r.locked_by,
  sort: r.sort, updatedAt: r.updated_at, updatedBy: r.updated_by,
});
export const taskView = (t) => ({ id: t.id, roomId: t.room_id, text: t.text, state: t.state, sort: t.sort });
