import { DatabaseSync } from 'node:sqlite';

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
`;

export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  return db;
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
  const owners = db.prepare(
    'SELECT ro.room_id AS room_id, u.name AS name FROM room_owners ro JOIN users u ON u.email = ro.email ORDER BY u.name',
  ).all();
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
        owners: (ownersByRoom.get(r.id) ?? []).map((o) => ({ name: o.name })),
        tasks: (tasksByRoom.get(r.id) ?? []).map((t) => ({ id: t.id, text: t.text, state: t.state, sort: t.sort })),
      })),
    })),
  };
}
