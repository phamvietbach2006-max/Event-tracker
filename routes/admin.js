import { HttpError } from '../lib/http.js';
import { requireAdmin } from '../lib/perm.js';
import { roomOr404, taskOr404, groupOr404, logActivity, tx, roomView, taskView } from '../lib/repo.js';
import { text, int, email } from '../lib/validate.js';
import { newToken, loginUrl } from '../auth/token.js';
import { hashPassword } from '../auth/password.js';

const nextSort = (db, sql, ...args) => db.prepare(sql).get(...args).n;
const rowId = (info) => Number(info.lastInsertRowid);

export function userView(db, u) {
  const email = u.email.toLowerCase();
  const role = u.is_admin ? 'admin' : (u.role || 'room_lead');
  const assignedUnits = db.prepare('SELECT unit FROM user_units WHERE LOWER(email) = ? ORDER BY unit')
    .all(email).map((r) => r.unit);
  const assignedGroupIds = db.prepare('SELECT group_id FROM user_groups WHERE LOWER(email) = ? ORDER BY group_id')
    .all(email).map((r) => r.group_id);
  const assignedRoomIds = db.prepare('SELECT room_id FROM room_owners WHERE LOWER(email) = ? ORDER BY room_id')
    .all(email).map((r) => r.room_id);

  let ownedRoomIds = [];
  if (role === 'admin') {
    ownedRoomIds = db.prepare('SELECT id FROM rooms ORDER BY id').all().map((r) => r.id);
  } else if (role === 'unit_lead') {
    if (assignedUnits.length > 0) {
      const allGroups = db.prepare('SELECT id, name FROM groups').all();
      const matchedGroupIds = allGroups
        .filter((g) => {
          const m = /^\[([^\]]+)\]/.exec(g.name);
          const uName = m ? m[1].trim() : '';
          return assignedUnits.includes(uName);
        })
        .map((g) => g.id);
      if (matchedGroupIds.length > 0) {
        const placeholders = matchedGroupIds.map(() => '?').join(',');
        ownedRoomIds = db.prepare(`SELECT id FROM rooms WHERE group_id IN (${placeholders}) ORDER BY id`)
          .all(...matchedGroupIds).map((r) => r.id);
      }
    }
  } else if (role === 'floor_lead') {
    if (assignedGroupIds.length > 0) {
      const placeholders = assignedGroupIds.map(() => '?').join(',');
      ownedRoomIds = db.prepare(`SELECT id FROM rooms WHERE group_id IN (${placeholders}) ORDER BY id`)
        .all(...assignedGroupIds).map((r) => r.id);
    }
  } else {
    // room_lead
    ownedRoomIds = assignedRoomIds;
  }

  const res = {
    email: u.email,
    name: u.name,
    isAdmin: role === 'admin',
    role,
    assignedUnits,
    assignedGroupIds,
    assignedRoomIds,
    ownedRoomIds,
    hasToken: !!u.token,
  };
  if (u.phone != null) res.phone = u.phone;
  if (u.position != null) res.position = u.position;
  if (u.department != null) res.department = u.department;
  if (u.team != null) res.team = u.team;
  if (u.cohort != null) res.cohort = u.cohort;
  if (u.student_id != null) res.student_id = u.student_id;
  return res;
}

export function getAllUsers(db) {
  const users = db.prepare('SELECT email, name, is_admin, role, token, phone, position, department, team, cohort, student_id FROM users ORDER BY is_admin DESC, name').all();
  const allUserUnits = db.prepare('SELECT email, unit FROM user_units ORDER BY unit').all();
  const allUserGroups = db.prepare('SELECT email, group_id FROM user_groups ORDER BY group_id').all();
  const allRoomOwners = db.prepare('SELECT email, room_id FROM room_owners ORDER BY room_id').all();
  const allRooms = db.prepare('SELECT id, group_id FROM rooms ORDER BY id').all();
  const allGroups = db.prepare('SELECT id, name FROM groups').all();

  const unitsByEmail = new Map();
  for (const row of allUserUnits) {
    const k = row.email.toLowerCase();
    if (!unitsByEmail.has(k)) unitsByEmail.set(k, []);
    unitsByEmail.get(k).push(row.unit);
  }

  const groupsByEmail = new Map();
  for (const row of allUserGroups) {
    const k = row.email.toLowerCase();
    if (!groupsByEmail.has(k)) groupsByEmail.set(k, []);
    groupsByEmail.get(k).push(row.group_id);
  }

  const roomsByEmail = new Map();
  for (const row of allRoomOwners) {
    const k = row.email.toLowerCase();
    if (!roomsByEmail.has(k)) roomsByEmail.set(k, []);
    roomsByEmail.get(k).push(row.room_id);
  }

  const groupIdsByUnit = new Map();
  for (const g of allGroups) {
    const m = /^\[([^\]]+)\]/.exec(g.name);
    const uName = m ? m[1].trim() : '';
    if (uName) {
      if (!groupIdsByUnit.has(uName)) groupIdsByUnit.set(uName, []);
      groupIdsByUnit.get(uName).push(g.id);
    }
  }

  const roomIdsByGroupId = new Map();
  const allRoomIds = allRooms.map((r) => r.id);
  for (const r of allRooms) {
    if (!roomIdsByGroupId.has(r.group_id)) roomIdsByGroupId.set(r.group_id, []);
    roomIdsByGroupId.get(r.group_id).push(r.id);
  }

  return users.map((u) => {
    const email = u.email.toLowerCase();
    const role = u.is_admin ? 'admin' : (u.role || 'room_lead');
    const assignedUnits = unitsByEmail.get(email) ?? [];
    const assignedGroupIds = groupsByEmail.get(email) ?? [];
    const assignedRoomIds = roomsByEmail.get(email) ?? [];

    let ownedRoomIds = [];
    if (role === 'admin') {
      ownedRoomIds = allRoomIds;
    } else if (role === 'unit_lead') {
      const gids = new Set();
      for (const un of assignedUnits) {
        for (const gid of (groupIdsByUnit.get(un) ?? [])) gids.add(gid);
      }
      const rids = [];
      for (const gid of gids) {
        for (const rid of (roomIdsByGroupId.get(gid) ?? [])) rids.push(rid);
      }
      ownedRoomIds = rids.sort((a, b) => a - b);
    } else if (role === 'floor_lead') {
      const rids = [];
      for (const gid of assignedGroupIds) {
        for (const rid of (roomIdsByGroupId.get(gid) ?? [])) rids.push(rid);
      }
      ownedRoomIds = rids.sort((a, b) => a - b);
    } else {
      ownedRoomIds = assignedRoomIds;
    }

    const item = {
      email: u.email,
      name: u.name,
      isAdmin: role === 'admin',
      role,
      assignedUnits,
      assignedGroupIds,
      assignedRoomIds,
      ownedRoomIds,
      hasToken: !!u.token,
    };
    if (u.phone != null) item.phone = u.phone;
    if (u.position != null) item.position = u.position;
    if (u.department != null) item.department = u.department;
    if (u.team != null) item.team = u.team;
    if (u.cohort != null) item.cohort = u.cohort;
    if (u.student_id != null) item.student_id = u.student_id;
    return item;
  });
}

function userOr404(db, rawEmail) {
  const u = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(String(rawEmail).trim().toLowerCase());
  if (!u) throw new HttpError(404, 'not_found', 'Không tìm thấy người dùng');
  return u;
}

export function registerAdmin(router) {
  const add = (method, path, fn) => router.add(method, path, (ctx) => {
    if (!ctx.config?.openAccess) requireAdmin(ctx.user);
    const user = ctx.user ?? { email: 'admin@example.com', name: 'Quản trị viên', is_admin: 1 };
    return fn({ ...ctx, user });
  });

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

  add('DELETE', '/api/groups/:id', ({ db, params, url, sse }) => {
    const g = groupOr404(db, params.id);
    if (url.searchParams.get('force') === '1') {
      tx(db, () => {
        db.prepare('DELETE FROM rooms WHERE group_id = ?').run(g.id);
        db.prepare('DELETE FROM groups WHERE id = ?').run(g.id);
      });
      sse.broadcast();
      return { ok: true };
    }
    if (db.prepare('SELECT COUNT(*) AS n FROM rooms WHERE group_id = ?').get(g.id).n > 0) {
      throw new HttpError(400, 'group_not_empty', 'Khối còn khu con, hãy xoá hoặc chuyển các khu trước');
    }
    db.prepare('DELETE FROM groups WHERE id = ?').run(g.id);
    sse.broadcast();
    return { ok: true };
  });

  // ---- nhập hàng loạt tầng & lớp cho 1 Đơn vị ----
  add('POST', '/api/units/import', ({ db, user, body, sse }) => {
    const unit = text(body.unit, 60, 'unit');
    const replace = body.replace === true;
    if (!Array.isArray(body.groups)) throw new HttpError(400, 'bad_request', 'groups: phải là mảng');
    const now = Date.now();
    let importedGroups = 0;
    let importedRooms = 0;

    tx(db, () => {
      if (replace) {
        const prefix = `[${unit}] `;
        const oldGroups = db.prepare('SELECT id, name FROM groups').all().filter((g) => g.name.startsWith(prefix) || g.name === unit);
        for (const og of oldGroups) {
          db.prepare('DELETE FROM rooms WHERE group_id = ?').run(og.id);
          db.prepare('DELETE FROM groups WHERE id = ?').run(og.id);
        }
      }

      const allUsers = db.prepare('SELECT email, name FROM users').all();
      const ensureUserByName = (rawName) => {
        const n = text(rawName, 80, 'ownerName');
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
      };

      for (const gItem of body.groups) {
        const rawFloor = text(gItem.floorName ?? gItem.name ?? '', 60, 'floorName');
        const fullGroupName = rawFloor.startsWith(`[${unit}]`) ? rawFloor : `[${unit}] ${rawFloor}`;
        const safeGroupName = fullGroupName.slice(0, 80);
        let existingGroup = db.prepare('SELECT id FROM groups WHERE name = ?').get(safeGroupName);
        let gid;
        if (existingGroup) {
          gid = existingGroup.id;
        } else {
          const gSort = nextSort(db, 'SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM groups');
          gid = rowId(db.prepare('INSERT INTO groups(name, sort) VALUES (?,?)').run(safeGroupName, gSort));
          importedGroups++;
        }

        for (const rItem of gItem.rooms ?? []) {
          const rName = text(rItem.name, 120, 'room.name');
          const rSort = nextSort(db, 'SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM rooms WHERE group_id = ?', gid);
          const rid = rowId(
            db.prepare('INSERT INTO rooms(group_id, name, status, note, sort, updated_at, updated_by) VALUES (?,?,?,?,?,?,?)')
              .run(gid, rName, 'red', text(rItem.note ?? '', 150, 'note', { allowEmpty: true }), rSort, now, user.name),
          );
          importedRooms++;

          const ownerEmails = [...new Set((rItem.owners ?? []).map(ensureUserByName))];
          for (const em of ownerEmails) {
            db.prepare('INSERT OR IGNORE INTO room_owners(room_id, email) VALUES (?,?)').run(rid, em);
          }

          (rItem.tasks ?? []).forEach((t, idx) => {
            const tText = text(Array.isArray(t) ? t[0] : typeof t === 'string' ? t : t.text, 200, 'task.text');
            db.prepare('INSERT INTO tasks(room_id, text, state, sort, updated_at, updated_by) VALUES (?,?,?,?,?,?)')
              .run(rid, tText, 'todo', idx + 1, now, user.name);
          });
        }
      }
    });

    logActivity(db, user, null, 'unit.import', `${unit}: +${importedGroups} tầng, +${importedRooms} lớp`);
    sse.broadcast();
    return { ok: true, unit, importedGroups, importedRooms };
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
  add('GET', '/api/users', ({ db }) => getAllUsers(db));

  add('POST', '/api/users', ({ db, body }) => {
    const e = email(body.email);
    const name = text(body.name, 80, 'name');
    if (db.prepare('SELECT 1 FROM users WHERE LOWER(email) = ?').get(e.toLowerCase())) {
      throw new HttpError(409, 'exists', 'Email này đã tồn tại trong hệ thống');
    }
    const role = ['admin', 'unit_lead', 'floor_lead', 'room_lead'].includes(body.role)
      ? body.role
      : (body.isAdmin === true ? 'admin' : 'room_lead');
    const isAdmin = role === 'admin' ? 1 : 0;
    const initialPassword = body.password ? String(body.password) : 'Abc@123456767';
    const pwdHash = hashPassword(initialPassword);
    const phone = body.phone ? String(body.phone).trim() : null;
    const team = body.team ? String(body.team).trim() : null;
    const position = body.position ? String(body.position).trim() : null;
    const department = body.department ? String(body.department).trim() : null;
    const cohort = body.cohort ? String(body.cohort).trim() : null;
    const studentId = (body.student_id ?? body.studentId) ? String(body.student_id ?? body.studentId).trim() : null;

    tx(db, () => {
      db.prepare(`
        INSERT INTO users(email, name, is_admin, role, password_hash, phone, team, position, department, cohort, student_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).run(e, name, isAdmin, role, pwdHash, phone, team, position, department, cohort, studentId);

      if (role === 'unit_lead' && Array.isArray(body.assignedUnits)) {
        for (const unit of body.assignedUnits) {
          db.prepare('INSERT OR IGNORE INTO user_units(email, unit) VALUES (?,?)').run(e, String(unit).trim());
        }
      } else if (role === 'floor_lead' && Array.isArray(body.assignedGroupIds)) {
        for (const gid of body.assignedGroupIds) {
          db.prepare('INSERT OR IGNORE INTO user_groups(email, group_id) VALUES (?,?)').run(e, Number(gid));
        }
      } else if (role === 'room_lead' && Array.isArray(body.assignedRoomIds)) {
        for (const rid of body.assignedRoomIds) {
          db.prepare('INSERT OR IGNORE INTO room_owners(room_id, email) VALUES (?,?)').run(Number(rid), e);
        }
      }
    });

    return userView(db, userOr404(db, e));
  });

  add('PATCH', '/api/users/:email', ({ db, user, params, body, sse }) => {
    const u = userOr404(db, params.email);
    const name = 'name' in body ? text(body.name, 80, 'name') : u.name;
    const currentRole = u.is_admin ? 'admin' : (u.role || 'room_lead');
    let nextRole = currentRole;
    if ('role' in body && ['admin', 'unit_lead', 'floor_lead', 'room_lead'].includes(body.role)) {
      nextRole = body.role;
    } else if ('isAdmin' in body) {
      nextRole = body.isAdmin === true ? 'admin' : 'room_lead';
    }

    if (u.email.toLowerCase() === user.email.toLowerCase() && nextRole !== 'admin') {
      throw new HttpError(400, 'cannot_demote_self', 'Không thể tự bỏ quyền admin của chính mình');
    }

    const isAdmin = nextRole === 'admin' ? 1 : 0;
    const phone = 'phone' in body ? (body.phone ? String(body.phone).trim() : null) : u.phone;
    const team = 'team' in body ? (body.team ? String(body.team).trim() : null) : u.team;
    const position = 'position' in body ? (body.position ? String(body.position).trim() : null) : u.position;
    const department = 'department' in body ? (body.department ? String(body.department).trim() : null) : u.department;
    const cohort = 'cohort' in body ? (body.cohort ? String(body.cohort).trim() : null) : u.cohort;
    const studentId = 'student_id' in body || 'studentId' in body
      ? (body.student_id ?? body.studentId ? String(body.student_id ?? body.studentId).trim() : null)
      : u.student_id;

    tx(db, () => {
      db.prepare(`
        UPDATE users
        SET name = ?, is_admin = ?, role = ?, phone = ?, team = ?, position = ?, department = ?, cohort = ?, student_id = ?
        WHERE LOWER(email) = ?
      `).run(name, isAdmin, nextRole, phone, team, position, department, cohort, studentId, u.email.toLowerCase());

      if ('password' in body && body.password) {
        const pwdHash = hashPassword(String(body.password));
        db.prepare('UPDATE users SET password_hash = ? WHERE LOWER(email) = ?').run(pwdHash, u.email.toLowerCase());
      }

      if ('assignedUnits' in body && Array.isArray(body.assignedUnits)) {
        db.prepare('DELETE FROM user_units WHERE LOWER(email) = ?').run(u.email.toLowerCase());
        for (const unit of body.assignedUnits) {
          db.prepare('INSERT OR IGNORE INTO user_units(email, unit) VALUES (?,?)').run(u.email, String(unit).trim());
        }
      }

      if ('assignedGroupIds' in body && Array.isArray(body.assignedGroupIds)) {
        db.prepare('DELETE FROM user_groups WHERE LOWER(email) = ?').run(u.email.toLowerCase());
        for (const gid of body.assignedGroupIds) {
          db.prepare('INSERT OR IGNORE INTO user_groups(email, group_id) VALUES (?,?)').run(u.email, Number(gid));
        }
      }

      if ('assignedRoomIds' in body && Array.isArray(body.assignedRoomIds)) {
        db.prepare('DELETE FROM room_owners WHERE LOWER(email) = ?').run(u.email.toLowerCase());
        for (const rid of body.assignedRoomIds) {
          db.prepare('INSERT OR IGNORE INTO room_owners(room_id, email) VALUES (?,?)').run(Number(rid), u.email);
        }
      }
    });

    sse.broadcast();
    return userView(db, userOr404(db, u.email));
  });

  add('POST', '/api/users/:email/reset-password', ({ db, user, params }) => {
    const u = userOr404(db, params.email);
    const newPass = 'Abc@123456767';
    const pwdHash = hashPassword(newPass);
    db.prepare('UPDATE users SET password_hash = ? WHERE LOWER(email) = ?').run(pwdHash, u.email.toLowerCase());
    return { ok: true, message: `Đã đặt lại mật khẩu của ${u.name} về ${newPass}` };
  });

  add('DELETE', '/api/users/:email', ({ db, user, params, sse }) => {
    const u = userOr404(db, params.email);
    if (u.email.toLowerCase() === user.email.toLowerCase()) {
      throw new HttpError(400, 'cannot_delete_self', 'Không thể tự xoá chính mình');
    }
    tx(db, () => {
      db.prepare('DELETE FROM user_units WHERE LOWER(email) = ?').run(u.email.toLowerCase());
      db.prepare('DELETE FROM user_groups WHERE LOWER(email) = ?').run(u.email.toLowerCase());
      db.prepare('DELETE FROM room_owners WHERE LOWER(email) = ?').run(u.email.toLowerCase());
      db.prepare('DELETE FROM sessions WHERE LOWER(email) = ?').run(u.email.toLowerCase());
      db.prepare('DELETE FROM users WHERE LOWER(email) = ?').run(u.email.toLowerCase());
    });
    sse.broadcast();
    return { ok: true };
  });

  add('POST', '/api/users/:email/token', ({ db, user, params, config }) => {
    const u = userOr404(db, params.email);
    const token = newToken();
    db.prepare('UPDATE users SET token = ? WHERE LOWER(email) = ?').run(token, u.email.toLowerCase());
    logActivity(db, user, null, 'user.token', u.email);
    return { url: loginUrl(config, token) };
  });
}
