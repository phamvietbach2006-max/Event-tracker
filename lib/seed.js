import { tx } from './repo.js';
import { newToken } from '../auth/token.js';

export function isEmpty(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM groups').get().n === 0;
}

export function applySeed(db, seed) {
  const ts = Date.now();
  tx(db, () => {
    for (const u of seed.users ?? []) {
      db.prepare('INSERT OR IGNORE INTO users(email, name, is_admin) VALUES (?,?,?)')
        .run(u.email.toLowerCase(), u.name, u.isAdmin ? 1 : 0);
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
