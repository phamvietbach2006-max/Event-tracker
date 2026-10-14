import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function getDatabaseSync() {
  try {
    const mod = require('node:sqlite');
    return mod.DatabaseSync || null;
  } catch {
    return null;
  }
}

function getLibsqlDatabase() {
  try {
    const mod = require('libsql');
    return mod.default || mod;
  } catch {
    return null;
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  token TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'red' CHECK (status IN ('red','yellow','green')),
  note TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);
CREATE TABLE IF NOT EXISTS room_owners (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  PRIMARY KEY (room_id, email)
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'todo' CHECK (state IN ('todo','doing','done')),
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  email TEXT,
  room_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  val INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO meta(key, val) VALUES ('visits', 0);
`;

export function openDb(path = ':memory:', opts = {}) {
  const tursoUrl = opts.tursoUrl ?? process.env.TURSO_DATABASE_URL ?? process.env.LIBSQL_URL;
  const tursoToken = opts.tursoToken ?? process.env.TURSO_AUTH_TOKEN ?? process.env.LIBSQL_AUTH_TOKEN;

  let db;
  const Libsql = getLibsqlDatabase();
  const DatabaseSync = getDatabaseSync();

  if (!tursoUrl && path && path !== ':memory:' && !path.startsWith('libsql://') && !path.startsWith('http://') && !path.startsWith('https://')) {
    try {
      const { dirname } = require('node:path');
      const { mkdirSync } = require('node:fs');
      mkdirSync(dirname(path), { recursive: true });
    } catch {}
  }

  if (tursoUrl) {
    if (!Libsql) {
      throw new Error('libsql package is required when using TURSO_DATABASE_URL');
    }
    db = new Libsql(tursoUrl, { authToken: tursoToken });
  } else if (DatabaseSync) {
    try {
      db = new DatabaseSync(path);
      try {
        db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
      } catch {
        db.exec('PRAGMA foreign_keys = ON;');
      }
    } catch (err) {
      console.warn(`Không thể mở DatabaseSync tại ${path}, thử lại với :memory: hoặc Libsql:`, err.message);
      if (Libsql) {
        try {
          db = new Libsql(path);
        } catch {
          db = new Libsql(':memory:');
        }
      } else {
        db = new DatabaseSync(':memory:');
      }
    }
  } else if (Libsql) {
    try {
      db = new Libsql(path);
    } catch {
      db = new Libsql(':memory:');
    }
    try { db.exec('PRAGMA foreign_keys = ON;'); } catch { /* bỏ qua */ }
  } else {
    throw new Error('Không tìm thấy trình điều khiển SQLite (cần node:sqlite hoặc libsql)');
  }

  try {
    db.exec('PRAGMA foreign_keys = ON;');
  } catch {
    /* bỏ qua nếu remote database không hỗ trợ pragma này */
  }
  db.exec(SCHEMA);
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_units (
      email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      unit TEXT NOT NULL,
      PRIMARY KEY (email, unit)
    );
    CREATE TABLE IF NOT EXISTS user_groups (
      email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      PRIMARY KEY (email, group_id)
    );
  `);
  try {
    db.prepare('ALTER TABLE users ADD COLUMN password_hash TEXT').run();
  } catch {
    /* cột đã tồn tại */
  }
  try {
    db.prepare("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'room_lead'").run();
  } catch {
    /* cột đã tồn tại */
  }
  for (const col of [
    'phone TEXT',
    'position TEXT',
    'department TEXT',
    'team TEXT',
    'cohort TEXT',
    'student_id TEXT',
  ]) {
    try {
      db.prepare(`ALTER TABLE users ADD COLUMN ${col}`).run();
    } catch {
      /* cột đã tồn tại */
    }
  }
  try {
    db.prepare("UPDATE users SET role = 'admin' WHERE is_admin = 1").run();
    db.prepare("UPDATE users SET role = 'room_lead' WHERE is_admin = 0 AND (role IS NULL OR role = '')").run();
  } catch {
    /* bỏ qua nếu chưa khởi tạo */
  }
  return db;
}

export function getVisits(db) {
  return db.prepare("SELECT val FROM meta WHERE key = 'visits'").get()?.val ?? 0;
}

export function incrementVisits(db) {
  db.prepare("UPDATE meta SET val = val + 1 WHERE key = 'visits'").run();
  return getVisits(db);
}

function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r[key])) m.set(r[key], []);
    m.get(r[key]).push(r);
  }
  return m;
}

export function getState(db) {
  const groups = db.prepare('SELECT id, name, sort FROM groups ORDER BY sort, id').all();
  const rooms = db.prepare('SELECT id, group_id, name, status, note, sort, updated_at, updated_by FROM rooms ORDER BY sort, id').all();
  const tasks = db.prepare('SELECT id, room_id, text, state, sort FROM tasks ORDER BY sort, id').all();
  const owners = db.prepare(`
    SELECT ro.room_id AS room_id, u.name AS name, u.phone AS phone,
           u.position AS position, u.department AS department, u.team AS team
    FROM room_owners ro
    JOIN users u ON u.email = ro.email
    ORDER BY u.name
  `).all();
  const roomsByGroup = groupBy(rooms, 'group_id');
  const tasksByRoom = groupBy(tasks, 'room_id');
  const ownersByRoom = groupBy(owners, 'room_id');
  return {
    version: 1,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      sort: g.sort,
      rooms: (roomsByGroup.get(g.id) ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        note: r.note,
        sort: r.sort,
        updatedAt: r.updated_at,
        updatedBy: r.updated_by,
        owners: (ownersByRoom.get(r.id) ?? []).map((o) => {
          const res = { name: o.name };
          if (o.phone) res.phone = o.phone;
          if (o.position) res.position = o.position;
          if (o.department) res.department = o.department;
          if (o.team) res.team = o.team;
          return res;
        }),
        tasks: (tasksByRoom.get(r.id) ?? []).map((t) => ({ id: t.id, text: t.text, state: t.state, sort: t.sort })),
      })),
    })),
  };
}

export function getContacts(db) {
  return db.prepare(`
    SELECT email, name, phone, position, department, team, cohort, student_id, role, is_admin AS isAdmin
    FROM users
    WHERE (phone IS NOT NULL AND phone != '') OR (position IS NOT NULL AND position != '') OR (team IS NOT NULL AND team != '')
    ORDER BY
      CASE
        WHEN team = 'Ban Điều hành' THEN 1
        WHEN team LIKE '%Tổ chức%' THEN 2
        WHEN team LIKE '%Giám sát%' THEN 3
        WHEN team LIKE '%Phát triển Đảng%' THEN 4
        WHEN team LIKE '%Truyền thông%' THEN 5
        ELSE 6
      END,
      name
  `).all();
}
