import { tx } from './repo.js';
import { newToken } from '../auth/token.js';

export function isEmpty(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM groups').get().n === 0;
}

export function applySeed(db, seed) {
  const ts = Date.now();
  tx(db, () => {
    for (const u of seed.users ?? []) {
      const role = u.role || (u.isAdmin ? 'admin' : 'room_lead');
      const isAdmin = (u.isAdmin || role === 'admin') ? 1 : 0;
      const phone = u.phone ?? null;
      const position = u.position ?? null;
      const department = u.department ?? null;
      const team = u.team ?? null;
      const cohort = u.cohort ?? null;
      const studentId = u.studentId ?? u.student_id ?? null;
      db.prepare(`
        INSERT INTO users(email, name, is_admin, role, phone, position, department, team, cohort, student_id)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(email) DO UPDATE SET
          name = excluded.name,
          is_admin = excluded.is_admin,
          role = excluded.role,
          phone = COALESCE(excluded.phone, users.phone),
          position = COALESCE(excluded.position, users.position),
          department = COALESCE(excluded.department, users.department),
          team = COALESCE(excluded.team, users.team),
          cohort = COALESCE(excluded.cohort, users.cohort),
          student_id = COALESCE(excluded.student_id, users.student_id)
      `).run(u.email.toLowerCase(), u.name, isAdmin, role, phone, position, department, team, cohort, studentId);
    }
    (seed.groups ?? []).forEach((g, gi) => {
      const gid = Number(db.prepare('INSERT INTO groups(name, sort) VALUES (?,?)').run(g.name, gi + 1).lastInsertRowid);
      (g.rooms ?? []).forEach((r, ri) => {
        const rid = Number(db.prepare(
          'INSERT INTO rooms(group_id, name, status, note, sort, updated_at, updated_by) VALUES (?,?,?,?,?,?,NULL)',
        ).run(gid, r.name, r.status ?? 'red', r.note ?? '', ri + 1, ts).lastInsertRowid);
        for (const e of r.owners ?? []) {
          db.prepare('INSERT INTO room_owners(room_id, email) VALUES (?,?)').run(rid, e.toLowerCase());
        }
        (r.tasks ?? []).forEach((t, ti) => {
          const [txt, state] = Array.isArray(t) ? t : typeof t === 'string' ? [t, 'todo'] : [t.text, t.state ?? 'todo'];
          db.prepare('INSERT INTO tasks(room_id, text, state, sort, updated_at) VALUES (?,?,?,?,?)').run(rid, txt, state, ti + 1, ts);
        });
      });
    });
  });
}

export function ensureTokens(db) {
  for (const u of db.prepare('SELECT email FROM users WHERE token IS NULL').all()) {
    db.prepare('UPDATE users SET token = ? WHERE email = ?').run(newToken(), u.email);
  }
}
