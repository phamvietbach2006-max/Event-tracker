import { HttpError } from '../lib/http.js';
import { requireAdmin } from '../lib/perm.js';
import { roomOr404, taskOr404, groupOr404, logActivity, tx, roomView, taskView } from '../lib/repo.js';
import { text, int, email } from '../lib/validate.js';
import { newToken, loginUrl } from '../auth/token.js';

const nextSort = (db, sql, ...args) => db.prepare(sql).get(...args).n;
const rowId = (info) => Number(info.lastInsertRowid);

function userView(db, u) {
  return {
    email: u.email,
    name: u.name,
    isAdmin: !!u.is_admin,
    ownedRoomIds: db.prepare('SELECT room_id FROM room_owners WHERE email = ? ORDER BY room_id').all(u.email).map((r) => r.room_id),
    hasToken: !!u.token,
  };
}

function userOr404(db, rawEmail) {
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(rawEmail).trim().toLowerCase());
  if (!u) throw new HttpError(404, 'not_found', 'Không tìm thấy người dùng');
  return u;
}

export function registerAdmin(router) {
  const add = (method, path, fn) => router.add(method, path, (ctx) => { requireAdmin(ctx.user); return fn(ctx); });

  // ---- khối ----
  add('POST', '/api/groups', ({ db, body, sse }) => {
    const name = text(body.name, 80, 'name');
    const sort = nextSort(db, 'SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM groups');
    const id = rowId(db.prepare('INSERT INTO groups(name, sort) VALUES (?,?)').run(name, sort));
    sse.broadcast();
    return { id, name, sort };
  });

  add('PATCH', '/api/groups/:id', ({ db, params, body, sse }) => {
    const g = groupOr404(db, params.id);
    const name = 'name' in body ? text(body.name, 80, 'name') : g.name;
    const sort = 'sort' in body ? int(body.sort, 'sort') : g.sort;
    db.prepare('UPDATE groups SET name = ?, sort = ? WHERE id = ?').run(name, sort, g.id);
    sse.broadcast();
    return { id: g.id, name, sort };
  });

  add('DELETE', '/api/groups/:id', ({ db, params, sse }) => {
    const g = groupOr404(db, params.id);
    if (db.prepare('SELECT COUNT(*) AS n FROM rooms WHERE group_id = ?').get(g.id).n > 0) {
      throw new HttpError(400, 'group_not_empty', 'Khối còn khu con, hãy xoá hoặc chuyển các khu trước');
    }
    db.prepare('DELETE FROM groups WHERE id = ?').run(g.id);
    sse.broadcast();
    return { ok: true };
  });

  // ---- khu ----
  add('POST', '/api/groups/:id/rooms', ({ db, user, params, body, sse }) => {
    const g = groupOr404(db, params.id);
    const name = text(body.name, 80, 'name');
    const sort = nextSort(db, 'SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM rooms WHERE group_id = ?', g.id);
    const id = rowId(db.prepare('INSERT INTO rooms(group_id, name, sort, updated_at, updated_by) VALUES (?,?,?,?,?)')
      .run(g.id, name, sort, Date.now(), user.name));
    logActivity(db, user, id, 'room.create', name);
    sse.broadcast();
    return roomView(roomOr404(db, id));
  });

  add('PATCH', '/api/rooms/:id', ({ db, user, params, body, sse }) => {
    const r = roomOr404(db, params.id);
    const name = 'name' in body ? text(body.name, 80, 'name') : r.name;
    const sort = 'sort' in body ? int(body.sort, 'sort') : r.sort;
    const groupId = 'groupId' in body ? groupOr404(db, body.groupId).id : r.group_id;
    db.prepare('UPDATE rooms SET name = ?, sort = ?, group_id = ? WHERE id = ?').run(name, sort, groupId, r.id);
    logActivity(db, user, r.id, 'room.edit', name);
    sse.broadcast();
    return roomView(roomOr404(db, r.id));
  });

  add('DELETE', '/api/rooms/:id', ({ db, user, params, sse }) => {
    const r = roomOr404(db, params.id);
    db.prepare('DELETE FROM rooms WHERE id = ?').run(r.id);
    logActivity(db, user, r.id, 'room.delete', r.name);
    sse.broadcast();
    return { ok: true };
  });

  add('PUT', '/api/rooms/:id/owners', ({ db, user, params, body, sse }) => {
    const r = roomOr404(db, params.id);
    let emails;
    if (Array.isArray(body.names)) {
      const names = [...new Set(body.names.map((n) => text(n, 80, 'names')))];
      tx(db, () => {
        const allUsers = db.prepare('SELECT email, name FROM users').all();
        emails = [...new Set(names.map((n) => {
          const lower = n.toLocaleLowerCase('vi');
          const found = allUsers.find((u) => u.name.toLocaleLowerCase('vi') === lower || u.email === lower);
          if (found) return found.email;
          const base = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
            .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'user';
          let candidate = `${base}@hust.local`;
          let suffix = 2;
          while (db.prepare('SELECT 1 FROM users WHERE email = ?').get(candidate)) {
            candidate = `${base}.${suffix++}@hust.local`;
          }
          db.prepare('INSERT INTO users(email, name, is_admin) VALUES (?,?,0)').run(candidate, n);
          allUsers.push({ email: candidate, name: n });
          return candidate;
        }))].sort();
        db.prepare('DELETE FROM room_owners WHERE room_id = ?').run(r.id);
        for (const e of emails) db.prepare('INSERT INTO room_owners(room_id, email) VALUES (?,?)').run(r.id, e);
      });
    } else {
      if (!Array.isArray(body.emails)) throw new HttpError(400, 'bad_request', 'emails: phải là mảng');
      emails = [...new Set(body.emails.map((e) => email(e, 'emails')))].sort();
      for (const e of emails) {
        if (!db.prepare('SELECT 1 FROM users WHERE email = ?').get(e)) {
          throw new HttpError(400, 'unknown_user', `Chưa có người dùng ${e}`);
        }
      }
      tx(db, () => {
        db.prepare('DELETE FROM room_owners WHERE room_id = ?').run(r.id);
        for (const e of emails) db.prepare('INSERT INTO room_owners(room_id, email) VALUES (?,?)').run(r.id, e);
      });
    }
    logActivity(db, user, r.id, 'room.owners', emails.join(','));
    sse.broadcast();
    return { roomId: r.id, emails };
  });

  // ---- người dùng ----
  add('GET', '/api/users', ({ db }) =>
    db.prepare('SELECT * FROM users ORDER BY is_admin DESC, name').all().map((u) => userView(db, u)));

  add('POST', '/api/users', ({ db, body }) => {
    const e = email(body.email);
    const name = text(body.name, 80, 'name');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(e)) throw new HttpError(409, 'exists', 'Email này đã có');
    db.prepare('INSERT INTO users(email, name, is_admin) VALUES (?,?,?)').run(e, name, body.isAdmin === true ? 1 : 0);
    return userView(db, userOr404(db, e));
  });

  add('PATCH', '/api/users/:email', ({ db, user, params, body, sse }) => {
    const u = userOr404(db, params.email);
    const name = 'name' in body ? text(body.name, 80, 'name') : u.name;
    const isAdmin = 'isAdmin' in body ? (body.isAdmin === true ? 1 : 0) : u.is_admin;
    if (u.email === user.email && !isAdmin) throw new HttpError(400, 'cannot_demote_self', 'Không thể tự bỏ quyền admin của mình');
    db.prepare('UPDATE users SET name = ?, is_admin = ? WHERE email = ?').run(name, isAdmin, u.email);
    sse.broadcast();
    return userView(db, userOr404(db, u.email));
  });

  add('DELETE', '/api/users/:email', ({ db, user, params, sse }) => {
    const u = userOr404(db, params.email);
    if (u.email === user.email) throw new HttpError(400, 'cannot_delete_self', 'Không thể tự xoá chính mình');
    db.prepare('DELETE FROM users WHERE email = ?').run(u.email);
    sse.broadcast();
    return { ok: true };
  });

  add('POST', '/api/users/:email/token', ({ db, user, params, config }) => {
    const u = userOr404(db, params.email);
    const token = newToken();
    db.prepare('UPDATE users SET token = ? WHERE email = ?').run(token, u.email);
    logActivity(db, user, null, 'user.token', u.email);
    return { url: loginUrl(config, token) };
  });
}
