---
render_with_liquid: false
---
# Event Tracker (backend + frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng web theo dõi chuẩn bị sự kiện chạy thật trên `http://168.107.75.89` (sau đó `https://sk.hust.edu.vn`): dashboard công khai realtime, đăng nhập bằng link riêng, người phụ trách sửa khu của mình, admin sửa tất cả. Hạn: 12:00 ngày 12/10/2026.

**Architecture:** Backend Node 22 không dependency (`node:http` + `node:sqlite`), SQLite WAL, router tự viết, SSE đẩy cả state mỗi khi có thay đổi. Frontend React 18 + Vite trong `web/`, build ra `web/dist/` do nginx phục vụ, cùng origin với API. GitHub Actions tự deploy khi merge vào `main` (đã có).

**Tech Stack:** Node ≥ 22.13 (`node:sqlite`, `node:test`), React 18.3, Vite 5, nginx, systemd.

**Spec:** [TECH.md](../../../TECH.md) (thiết kế, schema, quyền), [API.md](../../../API.md) (hợp đồng API, hành vi frontend), `mockup/index.html` (giao diện đã duyệt).

## Global Constraints

- Backend **không có dependency npm**. Module ESM (`"type": "module"`). Chỉ dùng `node:*`.
- `room.status` ∈ `red|yellow|green`, mặc định `red`, **do người dùng chọn tay, server không tự đổi**. `task.state` ∈ `todo|doing|done`, mặc định `todo`.
- Giới hạn: `note` ≤ 150 ký tự (được để trống), `text` việc ≤ 200, tên khu/khối ≤ 80.
- Lỗi luôn là `{ "error": "mã", "message": "tiếng Việt" }` với mã 400/401/403/404/413/5xx. Chưa đăng nhập → 401, đăng nhập nhưng không đủ quyền → 403, không tồn tại → 404 (kiểm tra theo thứ tự này).
- `GET /api/state` công khai chỉ có **tên** người phụ trách, **không bao giờ** có email.
- Cookie `sid`: `HttpOnly; SameSite=Lax; Path=/`, thêm `Secure` khi header `X-Forwarded-Proto: https`. Token đăng nhập 32 byte ngẫu nhiên, không ghi vào log.
- API ghi: body JSON ≤ 16 KB; nếu có header `Origin` thì host phải bằng header `Host`.
- Mỗi API ghi trả `200` + đối tượng vừa cập nhật; xoá trả `{ "ok": true }`.
- Cấu hình từ biến môi trường: `PORT` (3000), `HOST` (127.0.0.1), `DB_PATH` (`app.db`), `BASE_URL` (`http://localhost:3000`), `SEED_FILE` (mặc định `seed.json` trong repo).
- Frontend chỉ phụ thuộc `react`, `react-dom`, `vite`, `@vitejs/plugin-react`. Không thư viện UI/state/router. Giao diện tiếng Việt, ô bấm ≥ 44 px, dùng tốt từ 360 px, mở sẵn cả 3 khối, **không** tự đổi màu theo %.
- Thời gian là epoch ms; hiển thị múi giờ `Asia/Ho_Chi_Minh`.
- Mọi commit kết thúc bằng dòng `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Các đầu vào/tình huống spec ngầm đòi nhưng không nói rõ, dễ làm hỏng nhất (mỗi dòng có test ở task sau):

1. Body không phải JSON, là mảng/`null`, hoặc quá 16 KB → 400/413, server **không** sập (Task 2, Task 5).
2. Cookie `sid` rác hoặc phiên đã hết hạn → coi như khách, không lỗi 500 (Task 4).
3. Người phụ trách gọi API sửa **nội dung** việc (chỉ admin được) hoặc sửa việc của khu khác → 403 (Task 5).
4. Xoá người dùng/khu/khối: dữ liệu liên quan (phiên, người phụ trách, việc) bị xoá theo, xoá khối còn khu bị từ chối, admin không tự xoá/tự hạ quyền mình (Task 6).
5. Client SSE ngắt kết nối giữa chừng không làm broadcast sau đó lỗi; hai client cùng nhận thay đổi (Task 3, Task 5).
6. Tên/ghi chú tiếng Việt có dấu, ký tự `<`, `&`, `"` được lưu nguyên và frontend hiển thị an toàn (Task 5, Task 9).

---

## Phase 1: Backend (nhánh `feat/backend`, PR 1)

### Task 1: Khung dự án + database

**Files:**
- Create: `package.json`, `lib/db.js`, `tests/db.test.js`
- Delete: `server.js` (prototype cũ), `public/` (prototype cũ)

**Interfaces:**
- Produces: `openDb(path = ':memory:') → DatabaseSync` (đã bật WAL, foreign_keys, tạo bảng); `getState(db) → { version: 1, groups: [{ id, name, sort, rooms: [{ id, name, status, note, sort, updatedAt, updatedBy, owners: [{name}], tasks: [{ id, text, state, sort }] }] }] }`.

- [ ] **Step 1: Tạo `package.json`**

```json
{
  "name": "event-tracker",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.13" },
  "scripts": {
    "start": "node server.js",
    "test": "node --test \"tests/*.test.js\" \"web/src/*.test.js\"",
    "links": "node scripts/links.js"
  }
}
```

- [ ] **Step 2: Viết test thất bại `tests/db.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, getState } from '../lib/db.js';

function fixture() {
  const db = openDb();
  db.prepare("INSERT INTO users(email,name) VALUES ('a@x.vn','Nguyễn Văn A')").run();
  db.prepare("INSERT INTO groups(id,name,sort) VALUES (1,'Khối C2',1)").run();
  db.prepare("INSERT INTO rooms(id,group_id,name,sort,updated_at) VALUES (5,1,'Sảnh C2',1,1000)").run();
  db.prepare("INSERT INTO room_owners(room_id,email) VALUES (5,'a@x.vn')").run();
  db.prepare("INSERT INTO tasks(id,room_id,text,sort,updated_at) VALUES (501,5,'In thẻ',1,1000)").run();
  return db;
}

test('state rỗng khi chưa có dữ liệu', () => {
  assert.deepEqual(getState(openDb()), { version: 1, groups: [] });
});

test('getState gom khối > khu > việc, chủ khu chỉ có tên, không lộ email', () => {
  const s = getState(fixture());
  const room = s.groups[0].rooms[0];
  assert.equal(room.name, 'Sảnh C2');
  assert.equal(room.status, 'red');
  assert.equal(room.note, '');
  assert.equal(room.updatedAt, 1000);
  assert.deepEqual(room.owners, [{ name: 'Nguyễn Văn A' }]);
  assert.deepEqual(room.tasks, [{ id: 501, text: 'In thẻ', state: 'todo', sort: 1 }]);
  assert.ok(!JSON.stringify(s).includes('a@x.vn'));
});

test('sắp theo sort rồi id', () => {
  const db = fixture();
  db.prepare("INSERT INTO rooms(id,group_id,name,sort,updated_at) VALUES (6,1,'Hội trường',0,1000)").run();
  assert.deepEqual(getState(db).groups[0].rooms.map((r) => r.id), [6, 5]);
});

test('CHECK chặn status và state lạ', () => {
  const db = fixture();
  assert.throws(() => db.prepare("UPDATE rooms SET status='blue' WHERE id=5").run());
  assert.throws(() => db.prepare("UPDATE tasks SET state='xong' WHERE id=501").run());
});

test('xoá khu kéo theo việc và người phụ trách (foreign key)', () => {
  const db = fixture();
  db.prepare('DELETE FROM rooms WHERE id=5').run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM room_owners').get().n, 0);
});
```

- [ ] **Step 3: Chạy để thấy thất bại**

Run: `node --test tests/db.test.js`
Expected: FAIL, `Cannot find module '../lib/db.js'`

- [ ] **Step 4: Viết `lib/db.js`**

```js
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
```

- [ ] **Step 5: Chạy test, phải qua**

Run: `node --test tests/db.test.js`
Expected: PASS (5 tests)

- [ ] **Step 6: Xoá prototype và commit**

```bash
git rm -q -r server.js public
git add package.json lib/db.js tests/db.test.js
git commit -m "feat(backend): schema SQLite và getState

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(`server.js` sẽ được viết lại ở Task 7. Giữa hai task không merge vào `main`.)

---

### Task 2: Lõi HTTP, kiểm tra dữ liệu, phiên, quyền

**Files:**
- Create: `lib/http.js`, `lib/validate.js`, `lib/repo.js`, `lib/session.js`, `lib/perm.js`, `tests/http.test.js`

**Interfaces:**
- Consumes: `openDb` (Task 1).
- Produces:
  - `lib/http.js`: `class HttpError(status, code, message)`; `send(res, status, body)`; `readJson(req, limit=16384) → Promise<object>` (400 `bad_json`, 413 `too_large`); `createRouter() → { add(method, pattern, handler), match(method, path) → {handler, params}|null }` (pattern kiểu `/api/rooms/:id/status`); `checkOrigin(req)` (ném 403 `bad_origin`).
  - `lib/validate.js`: `STATUSES`, `TASK_STATES`, `oneOf(v, list, field)`, `text(v, max, field, {allowEmpty})`, `toInt(v) → number|null`, `int(v, field)`, `email(v, field)`; mọi lỗi là `HttpError(400, 'bad_request', ...)`.
  - `lib/repo.js`: `roomOr404(db,id)`, `taskOr404(db,id)`, `groupOr404(db,id)` (trả hàng DB hoặc ném 404), `logActivity(db,user,roomId,action,detail)`, `tx(db, fn)`, `roomView(row)`, `taskView(row)`.
  - `lib/session.js`: `createSession(db, email) → sid`, `getUser(db, req) → {email,name,is_admin}|null`, `destroySession(db, sid)`, `sidFrom(req)`, `setSessionCookie(req, res, sid)`, `clearSessionCookie(res)`, `purgeExpired(db)`.
  - `lib/perm.js`: `requireUser(user)`, `requireAdmin(user)`, `canEditRoom(db,user,roomId)`, `requireRoomEditor(db,user,roomId)`.

- [ ] **Step 1: Viết test thất bại `tests/http.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { HttpError, readJson, createRouter, checkOrigin } from '../lib/http.js';
import { oneOf, text, int, email, toInt } from '../lib/validate.js';
import { openDb } from '../lib/db.js';
import { createSession, getUser, destroySession, purgeExpired } from '../lib/session.js';
import { requireUser, requireAdmin, canEditRoom } from '../lib/perm.js';

const req = (s) => Readable.from([Buffer.from(s)]);

test('readJson: rỗng là {}, JSON đúng, JSON sai, mảng, null', async () => {
  assert.deepEqual(await readJson(Readable.from([])), {});
  assert.deepEqual(await readJson(req('{"a":1}')), { a: 1 });
  for (const bad of ['{oops', '[1]', 'null', '"x"']) {
    await assert.rejects(readJson(req(bad)), (e) => e instanceof HttpError && e.status === 400 && e.code === 'bad_json');
  }
});

test('readJson: quá giới hạn → 413 và vẫn đọc hết luồng', async () => {
  await assert.rejects(readJson(req('{"a":"' + 'x'.repeat(100) + '"}'), 50), (e) => e.status === 413);
});

test('router: khớp method, tham số, giải mã %, không khớp → null', () => {
  const r = createRouter();
  const h = () => 1;
  r.add('PATCH', '/api/rooms/:id/status', h);
  r.add('GET', '/api/users/:email', h);
  assert.deepEqual(r.match('PATCH', '/api/rooms/7/status').params, { id: '7' });
  assert.equal(r.match('GET', '/api/rooms/7/status'), null);
  assert.equal(r.match('PATCH', '/api/rooms/7/status/x'), null);
  assert.equal(r.match('GET', '/api/users/a%40b.vn').params.email, 'a@b.vn');
  assert.equal(r.match('GET', '/api/users/%E0%A4%A'), null);
});

test('checkOrigin: GET bỏ qua, không có Origin ok, khác host → 403', () => {
  checkOrigin({ method: 'GET', headers: { origin: 'http://evil.test', host: 'a.vn' } });
  checkOrigin({ method: 'POST', headers: { host: 'a.vn' } });
  checkOrigin({ method: 'POST', headers: { origin: 'https://a.vn', host: 'a.vn' } });
  assert.throws(() => checkOrigin({ method: 'POST', headers: { origin: 'http://evil.test', host: 'a.vn' } }), (e) => e.status === 403);
  assert.throws(() => checkOrigin({ method: 'PATCH', headers: { origin: 'not a url', host: 'a.vn' } }), (e) => e.status === 403);
});

test('validate', () => {
  assert.equal(oneOf('red', ['red', 'green'], 's'), 'red');
  assert.throws(() => oneOf('blue', ['red'], 's'), (e) => e.status === 400);
  assert.equal(text('  Sảnh <C2> & "x"  ', 80, 'n'), 'Sảnh <C2> & "x"');
  assert.throws(() => text('', 80, 'n'), (e) => e.status === 400);
  assert.equal(text('', 150, 'note', { allowEmpty: true }), '');
  assert.throws(() => text('x'.repeat(151), 150, 'note'), (e) => e.status === 400);
  assert.throws(() => text(5, 10, 'n'), (e) => e.status === 400);
  assert.equal(toInt('12'), 12);
  assert.equal(toInt('abc'), null);
  assert.equal(toInt('1.5'), null);
  assert.equal(int('3', 'id'), 3);
  assert.equal(email(' A@Hust.Edu.VN '), 'a@hust.edu.vn');
  assert.throws(() => email('khong-phai-email'), (e) => e.status === 400);
});

function dbWithUsers() {
  const db = openDb();
  db.prepare("INSERT INTO users(email,name,is_admin) VALUES ('ad@t.vn','Ad',1),('o@t.vn','Owner',0),('x@t.vn','X',0)").run();
  db.prepare("INSERT INTO groups(id,name) VALUES (1,'G')").run();
  db.prepare("INSERT INTO rooms(id,group_id,name,updated_at) VALUES (1,1,'R1',1),(2,1,'R2',1)").run();
  db.prepare("INSERT INTO room_owners(room_id,email) VALUES (1,'o@t.vn')").run();
  return db;
}

test('session: tạo, đọc, huỷ, hết hạn, cookie rác', () => {
  const db = dbWithUsers();
  const sid = createSession(db, 'o@t.vn');
  assert.match(sid, /^[0-9a-f]{64}$/);
  assert.equal(getUser(db, { headers: { cookie: `a=1; sid=${sid}` } }).email, 'o@t.vn');
  assert.equal(getUser(db, { headers: {} }), null);
  assert.equal(getUser(db, { headers: { cookie: 'sid=khong-co' } }), null);
  assert.equal(getUser(db, { headers: { cookie: 'sid=%E0%A4%A' } }), null);
  db.prepare('UPDATE sessions SET expires_at = 1 WHERE sid = ?').run(sid);
  assert.equal(getUser(db, { headers: { cookie: `sid=${sid}` } }), null);
  purgeExpired(db);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
  const s2 = createSession(db, 'o@t.vn');
  destroySession(db, s2);
  assert.equal(getUser(db, { headers: { cookie: `sid=${s2}` } }), null);
});

test('perm: admin sửa mọi khu, chủ khu chỉ khu mình, người lạ không', () => {
  const db = dbWithUsers();
  const ad = { email: 'ad@t.vn', is_admin: 1 };
  const o = { email: 'o@t.vn', is_admin: 0 };
  assert.equal(canEditRoom(db, ad, 2), true);
  assert.equal(canEditRoom(db, o, 1), true);
  assert.equal(canEditRoom(db, o, 2), false);
  assert.equal(canEditRoom(db, null, 1), false);
  assert.throws(() => requireUser(null), (e) => e.status === 401);
  assert.throws(() => requireAdmin(o), (e) => e.status === 403);
  requireAdmin(ad);
});
```

- [ ] **Step 2: Chạy để thấy thất bại**

Run: `node --test tests/http.test.js`
Expected: FAIL, `Cannot find module '../lib/http.js'`

- [ ] **Step 3: Viết `lib/http.js`**

```js
import { Buffer } from 'node:buffer';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

export function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

export async function readJson(req, limit = 16 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size <= limit) chunks.push(c); // quá giới hạn: vẫn đọc hết để client không bị ngắt giữa chừng
  }
  if (size > limit) throw new HttpError(413, 'too_large', 'Dữ liệu gửi lên quá lớn');
  if (!size) return {};
  let v;
  try {
    v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'bad_json', 'JSON không hợp lệ');
  }
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new HttpError(400, 'bad_json', 'Body phải là một đối tượng JSON');
  }
  return v;
}

export function createRouter() {
  const routes = [];
  return {
    add(method, pattern, handler) {
      const names = [];
      const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
      routes.push({ method, re, names, handler });
    },
    match(method, path) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(path);
        if (!m) continue;
        try {
          return { handler: r.handler, params: Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}

export function checkOrigin(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const o = req.headers.origin;
  if (!o) return;
  let host = null;
  try { host = new URL(o).host; } catch { /* host = null */ }
  if (host !== req.headers.host) throw new HttpError(403, 'bad_origin', 'Nguồn yêu cầu không hợp lệ');
}
```

- [ ] **Step 4: Viết `lib/validate.js`**

```js
import { HttpError } from './http.js';

export const STATUSES = ['red', 'yellow', 'green'];
export const TASK_STATES = ['todo', 'doing', 'done'];

const bad = (field, msg) => new HttpError(400, 'bad_request', `${field}: ${msg}`);

export function oneOf(v, list, field) {
  if (!list.includes(v)) throw bad(field, `phải là một trong ${list.join(', ')}`);
  return v;
}

export function text(v, max, field, { allowEmpty = false } = {}) {
  if (typeof v !== 'string') throw bad(field, 'phải là chuỗi');
  const s = v.trim();
  if (!allowEmpty && !s) throw bad(field, 'không được để trống');
  if (s.length > max) throw bad(field, `tối đa ${max} ký tự`);
  return s;
}

export function toInt(v) {
  const n = typeof v === 'number' ? v : /^-?\d+$/.test(String(v)) ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
}

export function int(v, field) {
  const n = toInt(v);
  if (n === null) throw bad(field, 'phải là số nguyên');
  return n;
}

export function email(v, field = 'email') {
  const s = text(v, 120, field).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad(field, 'email không hợp lệ');
  return s;
}
```

- [ ] **Step 5: Viết `lib/repo.js`**

```js
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
```

- [ ] **Step 6: Viết `lib/session.js`**

```js
import { randomBytes } from 'node:crypto';

const TTL_MS = 30 * 24 * 3600 * 1000;

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* bỏ cookie lỗi */ }
  }
  return out;
}

export const sidFrom = (req) => parseCookies(req.headers.cookie).sid ?? null;

export function createSession(db, email) {
  const sid = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(sid, email, expires_at) VALUES (?,?,?)').run(sid, email, Date.now() + TTL_MS);
  return sid;
}

export function getUser(db, req) {
  const sid = sidFrom(req);
  if (!sid) return null;
  return db.prepare(
    'SELECT u.email AS email, u.name AS name, u.is_admin AS is_admin FROM sessions s JOIN users u ON u.email = s.email WHERE s.sid = ? AND s.expires_at > ?',
  ).get(sid, Date.now()) ?? null;
}

export function destroySession(db, sid) {
  db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
}

export function purgeExpired(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
}

export function setSessionCookie(req, res, sid) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${TTL_MS / 1000}${secure}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}
```

- [ ] **Step 7: Viết `lib/perm.js`**

```js
import { HttpError } from './http.js';

export function requireUser(user) {
  if (!user) throw new HttpError(401, 'unauthorized', 'Cần đăng nhập');
  return user;
}

export function requireAdmin(user) {
  requireUser(user);
  if (!user.is_admin) throw new HttpError(403, 'forbidden', 'Chỉ quản trị viên mới làm được việc này');
}

export function canEditRoom(db, user, roomId) {
  if (!user) return false;
  if (user.is_admin) return true;
  return !!db.prepare('SELECT 1 FROM room_owners WHERE room_id = ? AND email = ?').get(roomId, user.email);
}

export function requireRoomEditor(db, user, roomId) {
  requireUser(user);
  if (!canEditRoom(db, user, roomId)) throw new HttpError(403, 'forbidden', 'Bạn không có quyền sửa khu này');
}
```

- [ ] **Step 8: Chạy test, phải qua**

Run: `node --test tests/http.test.js`
Expected: PASS (toàn bộ)

- [ ] **Step 9: Commit**

```bash
git add lib tests/http.test.js
git commit -m "feat(backend): router, validate, session, perm

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Ứng dụng, route công khai, SSE, seed, helper test

**Files:**
- Create: `lib/app.js`, `lib/sse.js`, `lib/seed.js`, `auth/token.js`, `routes/public.js`, `tests/helpers.js`, `tests/public.test.js`

**Interfaces:**
- Consumes: Task 1, Task 2.
- Produces:
  - `createApp({ db, config, sseOptions }) → { server, sse, close() }`. `config = { baseUrl, ... }`. Router đăng ký lần lượt `registerPublic`, `registerAuth`, `registerRooms`, `registerAdmin` (hai module sau chưa có thì bỏ qua cho tới task của chúng; `lib/app.js` import động từng module nếu tồn tại **không** làm: ở task này chỉ import `registerPublic`, các task sau thêm dòng import + gọi).
  - Handler ctx: `{ req, res, url, params, body, user, db, config, sse }`. Handler trả giá trị khác `undefined` → gửi `200 JSON`; trả `undefined` → handler tự lo response.
  - `createSse(getState, { debounceMs=100, keepAliveMs=25000 }) → { add(req,res), broadcast(), close(), size() }`.
  - `lib/seed.js`: `isEmpty(db)`, `applySeed(db, seed)`, `ensureTokens(db)`. Seed: `{ users: [{email,name,isAdmin?}], groups: [{ name, rooms: [{ name, status?, note?, owners?: [email], tasks?: [text | [text,state]] }] }] }`.
  - `auth/token.js`: `newToken()`, `loginUrl(config, token)`, `userByToken(db, t)`.
  - `tests/helpers.js`: `SEED`, `startApp()`, `openSse(base)`.

- [ ] **Step 1: Viết `tests/helpers.js`**

```js
import { openDb } from '../lib/db.js';
import { createApp } from '../lib/app.js';
import { createSession } from '../lib/session.js';
import { applySeed } from '../lib/seed.js';

// Id cố định: khu 1 = Hội trường C2, 2 = Sảnh C2, 3 = Cổng chính; việc 1,2 (khu 1), 3 (khu 2), 4 (khu 3)
export const SEED = {
  users: [
    { email: 'admin@t.test', name: 'Quản Trị', isAdmin: true },
    { email: 'owner@t.test', name: 'Chủ Khu' },
    { email: 'other@t.test', name: 'Người Khác' },
    { email: 'nobody@t.test', name: 'Không Khu' },
  ],
  groups: [
    { name: 'Khối C2', rooms: [
      { name: 'Hội trường C2', owners: ['owner@t.test'], tasks: [['Sắp xếp ghế', 'todo'], ['Âm thanh', 'done']] },
      { name: 'Sảnh C2', owners: ['owner@t.test'], tasks: [['Bàn đón tiếp', 'todo']] },
    ] },
    { name: 'Khối An ninh', rooms: [
      { name: 'Cổng chính', owners: ['other@t.test'], tasks: [['Rào chắn', 'todo']] },
    ] },
  ],
};

export async function startApp(seed = SEED) {
  const db = openDb();
  applySeed(db, seed);
  const app = createApp({ db, config: { baseUrl: 'http://localhost' }, sseOptions: { debounceMs: 20 } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const cookieFor = (email) => `sid=${createSession(db, email)}`;
  async function call(method, path, { as, cookie, body, raw, headers = {} } = {}) {
    const h = { ...headers };
    if (body !== undefined || raw !== undefined) h['content-type'] = 'application/json';
    const c = cookie ?? (as ? cookieFor(as) : null);
    if (c) h.cookie = c;
    const res = await fetch(base + path, {
      method, headers: h, redirect: 'manual',
      body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
    });
    const t = await res.text();
    return { status: res.status, body: t ? JSON.parse(t) : null, headers: res.headers };
  }
  return { db, app, base, call, cookieFor, close: () => app.close() };
}

export async function openSse(base) {
  const ac = new AbortController();
  const res = await fetch(base + '/events', { signal: ac.signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  async function next(timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const i = buf.indexOf('\n\n');
      if (i >= 0) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (frame.startsWith('data: ')) return JSON.parse(frame.slice(6));
        continue;
      }
      const left = deadline - Date.now();
      if (left <= 0) throw new Error('SSE timeout');
      let timer;
      const r = await Promise.race([
        reader.read(),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('SSE timeout')), left); }),
      ]).finally(() => clearTimeout(timer));
      if (r.done) throw new Error('SSE closed');
      buf += dec.decode(r.value, { stream: true });
    }
  }
  return { res, next, abort: () => ac.abort() };
}
```

- [ ] **Step 2: Viết test thất bại `tests/public.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, openSse } from './helpers.js';

test('GET /api/state công khai, đúng cấu trúc, không có email', async () => {
  const t = await startApp();
  try {
    const r = await t.call('GET', '/api/state');
    assert.equal(r.status, 200);
    assert.equal(r.body.version, 1);
    assert.deepEqual(r.body.groups.map((g) => g.name), ['Khối C2', 'Khối An ninh']);
    const hall = r.body.groups[0].rooms[0];
    assert.equal(hall.name, 'Hội trường C2');
    assert.equal(hall.status, 'red');
    assert.deepEqual(hall.owners, [{ name: 'Chủ Khu' }]);
    assert.deepEqual(hall.tasks.map((x) => x.state), ['todo', 'done']);
    assert.ok(!JSON.stringify(r.body).includes('@'));
  } finally { await t.close(); }
});

test('đường dẫn lạ → 404 JSON', async () => {
  const t = await startApp();
  try {
    const r = await t.call('GET', '/api/khong-co');
    assert.equal(r.status, 404);
    assert.equal(r.body.error, 'not_found');
  } finally { await t.close(); }
});

test('SSE: gửi state ngay khi nối, rồi gửi lại khi broadcast, hai client cùng nhận', async () => {
  const t = await startApp();
  const a = await openSse(t.base);
  const b = await openSse(t.base);
  try {
    assert.equal(a.res.headers.get('content-type'), 'text/event-stream');
    assert.equal((await a.next()).groups[0].rooms[0].status, 'red');
    assert.equal((await b.next()).groups[0].rooms[0].status, 'red');
    t.db.prepare("UPDATE rooms SET status='green' WHERE id=1").run();
    t.app.sse.broadcast();
    assert.equal((await a.next()).groups[0].rooms[0].status, 'green');
    assert.equal((await b.next()).groups[0].rooms[0].status, 'green');
  } finally { a.abort(); b.abort(); await t.close(); }
});

test('SSE: client ngắt giữa chừng không làm client còn lại hỏng', async () => {
  const t = await startApp();
  const a = await openSse(t.base);
  const b = await openSse(t.base);
  try {
    await a.next(); await b.next();
    a.abort();
    for (let i = 0; i < 50 && t.app.sse.size() > 1; i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(t.app.sse.size(), 1);
    t.db.prepare("UPDATE rooms SET note='x' WHERE id=1").run();
    t.app.sse.broadcast();
    assert.equal((await b.next()).groups[0].rooms[0].note, 'x');
  } finally { b.abort(); await t.close(); }
});

test('SSE: nhiều broadcast sát nhau được gộp, state cuối là state mới nhất', async () => {
  const t = await startApp();
  const a = await openSse(t.base);
  try {
    await a.next();
    for (const n of ['1', '2', '3']) { t.db.prepare('UPDATE rooms SET note=? WHERE id=1').run(n); t.app.sse.broadcast(); }
    assert.equal((await a.next()).groups[0].rooms[0].note, '3');
  } finally { a.abort(); await t.close(); }
});
```

- [ ] **Step 3: Chạy để thấy thất bại**

Run: `node --test tests/public.test.js`
Expected: FAIL, `Cannot find module '../lib/app.js'` (hoặc `lib/seed.js`)

- [ ] **Step 4: Viết `lib/sse.js`**

```js
export function createSse(getState, { debounceMs = 100, keepAliveMs = 25000 } = {}) {
  const clients = new Set();
  let timer = null;

  const frame = () => `data: ${JSON.stringify(getState())}\n\n`;

  function add(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(frame());
    clients.add(res);
    const drop = () => clients.delete(res);
    req.on('close', drop);
    res.on('error', drop);
  }

  function write(chunk) {
    for (const c of [...clients]) {
      try { c.write(chunk); } catch { clients.delete(c); }
    }
  }

  function broadcast() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (clients.size) write(frame());
    }, debounceMs);
  }

  const keepAlive = setInterval(() => write(': ka\n\n'), keepAliveMs);
  keepAlive.unref();

  function close() {
    clearInterval(keepAlive);
    clearTimeout(timer);
    for (const c of clients) c.end();
    clients.clear();
  }

  return { add, broadcast, close, size: () => clients.size };
}
```

- [ ] **Step 5: Viết `auth/token.js`**

```js
import { randomBytes } from 'node:crypto';

export const newToken = () => randomBytes(32).toString('base64url');

export const loginUrl = (config, token) => `${config.baseUrl}/auth/token?t=${token}`;

export function userByToken(db, t) {
  if (typeof t !== 'string' || t.length < 20) return null;
  return db.prepare('SELECT email, name, is_admin FROM users WHERE token = ?').get(t) ?? null;
}
```

- [ ] **Step 6: Viết `lib/seed.js`**

```js
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
```

- [ ] **Step 7: Viết `routes/public.js`**

```js
import { getState } from '../lib/db.js';

export function registerPublic(router) {
  router.add('GET', '/api/state', ({ db }) => getState(db));
  router.add('GET', '/events', ({ req, res, sse }) => { sse.add(req, res); });
}
```

- [ ] **Step 8: Viết `lib/app.js`**

```js
import http from 'node:http';
import { getState } from './db.js';
import { HttpError, send, readJson, createRouter, checkOrigin } from './http.js';
import { getUser, purgeExpired } from './session.js';
import { createSse } from './sse.js';
import { registerPublic } from '../routes/public.js';

export function createApp({ db, config, sseOptions }) {
  purgeExpired(db);
  const sse = createSse(() => getState(db), sseOptions);
  const router = createRouter();
  registerPublic(router);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://local');
      checkOrigin(req);
      const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await readJson(req) : undefined;
      const m = router.match(req.method, url.pathname);
      if (!m) throw new HttpError(404, 'not_found', 'Không tìm thấy');
      const user = getUser(db, req);
      const out = await m.handler({ req, res, url, params: m.params, body, user, db, config, sse });
      if (out !== undefined) send(res, 200, out);
    } catch (e) {
      if (res.headersSent) { res.end(); return; }
      if (e instanceof HttpError) send(res, e.status, { error: e.code, message: e.message });
      else {
        console.error(e);
        send(res, 500, { error: 'server_error', message: 'Lỗi máy chủ' });
      }
    }
  });

  return {
    server,
    sse,
    close() {
      sse.close();
      return new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    },
  };
}
```

- [ ] **Step 9: Chạy test, phải qua**

Run: `node --test tests/public.test.js tests/db.test.js tests/http.test.js`
Expected: PASS (toàn bộ)

- [ ] **Step 10: Commit**

```bash
git add lib auth routes tests
git commit -m "feat(backend): app, /api/state, SSE, seed

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Đăng nhập: `/api/me`, link riêng, đăng xuất, khe SSO

**Files:**
- Create: `routes/auth.js`, `tests/auth.test.js`
- Modify: `lib/app.js` (thêm import + `registerAuth(router)`)

**Interfaces:**
- Consumes: `userByToken`, `createSession`, `setSessionCookie`, `clearSessionCookie`, `destroySession`, `sidFrom`.
- Produces: `GET /api/me → { email, name, isAdmin, ownedRoomIds } | null` (luôn 200); `GET /auth/token?t=` → 302 `/` + cookie, sai token → 302 `/?login=failed`; `POST /auth/logout` → 204; `GET /auth/sso/start`, `GET /auth/callback` → 501 `sso_not_configured`. `registerAuth(router)`.

- [ ] **Step 1: Viết test thất bại `tests/auth.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

test('/api/me: khách → null; chủ khu; admin', async () => {
  const t = await startApp();
  try {
    assert.deepEqual((await t.call('GET', '/api/me')).body, null);
    const o = await t.call('GET', '/api/me', { as: 'owner@t.test' });
    assert.deepEqual(o.body, { email: 'owner@t.test', name: 'Chủ Khu', isAdmin: false, ownedRoomIds: [1, 2] });
    const a = await t.call('GET', '/api/me', { as: 'admin@t.test' });
    assert.equal(a.body.isAdmin, true);
    assert.deepEqual(a.body.ownedRoomIds, []);
  } finally { await t.close(); }
});

test('/api/me: cookie rác hoặc phiên hết hạn → khách, không lỗi', async () => {
  const t = await startApp();
  try {
    for (const cookie of ['sid=rac', 'sid=%E0%A4%A', 'khong-co-dau-bang', 'sid=']) {
      const r = await t.call('GET', '/api/me', { cookie });
      assert.equal(r.status, 200);
      assert.equal(r.body, null);
    }
    const cookie = t.cookieFor('owner@t.test');
    t.db.prepare('UPDATE sessions SET expires_at = 1').run();
    assert.equal((await t.call('GET', '/api/me', { cookie })).body, null);
  } finally { await t.close(); }
});

test('link riêng: đúng token → 302 / + cookie dùng được; sai token → /?login=failed, không cookie', async () => {
  const t = await startApp();
  try {
    t.db.prepare("UPDATE users SET token='tok-owner-0123456789abcdef' WHERE email='owner@t.test'").run();
    const ok = await t.call('GET', '/auth/token?t=tok-owner-0123456789abcdef');
    assert.equal(ok.status, 302);
    assert.equal(ok.headers.get('location'), '/');
    const setCookie = ok.headers.get('set-cookie');
    assert.match(setCookie, /^sid=[0-9a-f]{64}; HttpOnly; SameSite=Lax; Path=\//);
    assert.ok(!setCookie.includes('Secure'));
    const me = await t.call('GET', '/api/me', { cookie: setCookie.split(';')[0] });
    assert.equal(me.body.email, 'owner@t.test');

    const bad = await t.call('GET', '/auth/token?t=sai-sai-sai-sai-sai-sai-sai');
    assert.equal(bad.status, 302);
    assert.equal(bad.headers.get('location'), '/?login=failed');
    assert.equal(bad.headers.get('set-cookie'), null);
    assert.equal((await t.call('GET', '/auth/token')).headers.get('location'), '/?login=failed');
  } finally { await t.close(); }
});

test('cookie có Secure khi qua HTTPS (nginx gửi X-Forwarded-Proto)', async () => {
  const t = await startApp();
  try {
    t.db.prepare("UPDATE users SET token='tok-owner-0123456789abcdef' WHERE email='owner@t.test'").run();
    const r = await t.call('GET', '/auth/token?t=tok-owner-0123456789abcdef', { headers: { 'x-forwarded-proto': 'https' } });
    assert.match(r.headers.get('set-cookie'), /; Secure/);
  } finally { await t.close(); }
});

test('đăng xuất: 204, phiên bị xoá', async () => {
  const t = await startApp();
  try {
    const cookie = t.cookieFor('owner@t.test');
    const r = await t.call('POST', '/auth/logout', { cookie });
    assert.equal(r.status, 204);
    assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await t.call('GET', '/api/me', { cookie })).body, null);
    assert.equal((await t.call('POST', '/auth/logout')).status, 204);
  } finally { await t.close(); }
});

test('SSO chưa cấu hình → 501', async () => {
  const t = await startApp();
  try {
    for (const p of ['/auth/sso/start', '/auth/callback']) {
      const r = await t.call('GET', p);
      assert.equal(r.status, 501);
      assert.equal(r.body.error, 'sso_not_configured');
    }
  } finally { await t.close(); }
});
```

- [ ] **Step 2: Chạy để thấy thất bại**

Run: `node --test tests/auth.test.js`
Expected: FAIL (`/api/me` trả 404)

- [ ] **Step 3: Viết `routes/auth.js`**

```js
import { HttpError } from '../lib/http.js';
import { createSession, destroySession, sidFrom, setSessionCookie, clearSessionCookie } from '../lib/session.js';
import { userByToken } from '../auth/token.js';

const ownedRoomIds = (db, email) =>
  db.prepare('SELECT room_id FROM room_owners WHERE email = ? ORDER BY room_id').all(email).map((r) => r.room_id);

export function registerAuth(router) {
  router.add('GET', '/api/me', ({ db, user }) =>
    user
      ? { email: user.email, name: user.name, isAdmin: !!user.is_admin, ownedRoomIds: ownedRoomIds(db, user.email) }
      : null);

  router.add('GET', '/auth/token', ({ req, res, db, url }) => {
    const u = userByToken(db, url.searchParams.get('t'));
    if (u) {
      setSessionCookie(req, res, createSession(db, u.email));
      res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' }).end();
    } else {
      res.writeHead(302, { Location: '/?login=failed', 'Cache-Control': 'no-store' }).end();
    }
  });

  router.add('POST', '/auth/logout', ({ req, res, db }) => {
    const sid = sidFrom(req);
    if (sid) destroySession(db, sid);
    clearSessionCookie(res);
    res.writeHead(204).end();
  });

  const sso = () => { throw new HttpError(501, 'sso_not_configured', 'SSO chưa được cấu hình'); };
  router.add('GET', '/auth/sso/start', sso);
  router.add('GET', '/auth/callback', sso);
}
```

Lưu ý: `res.writeHead(...).end()` sau `setHeader('Set-Cookie')` giữ nguyên header cookie. `clearSessionCookie` cũng gọi `setHeader` trước `writeHead(204)`.

- [ ] **Step 4: Đăng ký vào `lib/app.js`**

Thêm sau dòng import `registerPublic`:

```js
import { registerAuth } from '../routes/auth.js';
```

và sau `registerPublic(router);`:

```js
  registerAuth(router);
```

- [ ] **Step 5: Chạy test, phải qua**

Run: `node --test tests/*.test.js`
Expected: PASS (toàn bộ)

- [ ] **Step 6: Commit**

```bash
git add routes/auth.js lib/app.js tests/auth.test.js
git commit -m "feat(backend): đăng nhập bằng link riêng, /api/me, logout

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: API ghi cho người phụ trách (màu, ghi chú, trạng thái việc)

**Files:**
- Create: `routes/rooms.js`, `tests/rooms.test.js`
- Modify: `lib/app.js` (import + `registerRooms(router)`)

**Interfaces:**
- Consumes: `requireUser`, `requireAdmin`, `requireRoomEditor`, `roomOr404`, `taskOr404`, `oneOf`, `text`, `STATUSES`, `TASK_STATES`, `logActivity`, `tx`, `roomView`, `taskView`, `sse.broadcast()`.
- Produces: `PATCH /api/rooms/:id/status {status}` → `roomView`; `PATCH /api/rooms/:id/note {note}` → `roomView`; `PATCH /api/tasks/:id {state?, text?}` → `taskView` (`text` chỉ admin). Mọi ghi cập nhật `rooms.updated_at/updated_by` của khu tương ứng.

- [ ] **Step 1: Viết test thất bại `tests/rooms.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, openSse } from './helpers.js';

const room = (state, id) => state.groups.flatMap((g) => g.rooms).find((r) => r.id === id);

test('khách → 401 trên mọi API ghi', async () => {
  const t = await startApp();
  try {
    for (const [m, p, b] of [
      ['PATCH', '/api/rooms/1/status', { status: 'green' }],
      ['PATCH', '/api/rooms/1/note', { note: 'x' }],
      ['PATCH', '/api/tasks/1', { state: 'done' }],
    ]) assert.equal((await t.call(m, p, { body: b })).status, 401, `${m} ${p}`);
  } finally { await t.close(); }
});

test('chủ khu đổi màu khu mình; khu khác → 403; admin được mọi khu; người không có khu → 403', async () => {
  const t = await startApp();
  try {
    const r = await t.call('PATCH', '/api/rooms/1/status', { as: 'owner@t.test', body: { status: 'green' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'green');
    assert.equal(r.body.updatedBy, 'Chủ Khu');
    assert.ok(r.body.updatedAt > 1e12);
    assert.equal(room((await t.call('GET', '/api/state')).body, 1).status, 'green');

    assert.equal((await t.call('PATCH', '/api/rooms/3/status', { as: 'owner@t.test', body: { status: 'green' } })).status, 403);
    assert.equal((await t.call('PATCH', '/api/rooms/1/status', { as: 'nobody@t.test', body: { status: 'green' } })).status, 403);
    assert.equal((await t.call('PATCH', '/api/rooms/3/status', { as: 'admin@t.test', body: { status: 'yellow' } })).status, 200);
    assert.equal(room((await t.call('GET', '/api/state')).body, 3).status, 'yellow');
  } finally { await t.close(); }
});

test('màu không hợp lệ → 400; khu không tồn tại → 404 (sau khi qua kiểm tra đăng nhập)', async () => {
  const t = await startApp();
  try {
    for (const body of [{ status: 'blue' }, {}, { status: 5 }, { status: 'red ' }]) {
      assert.equal((await t.call('PATCH', '/api/rooms/1/status', { as: 'owner@t.test', body })).status, 400);
    }
    assert.equal((await t.call('PATCH', '/api/rooms/999/status', { as: 'owner@t.test', body: { status: 'red' } })).status, 404);
    assert.equal((await t.call('PATCH', '/api/rooms/abc/status', { as: 'owner@t.test', body: { status: 'red' } })).status, 404);
  } finally { await t.close(); }
});

test('server không tự đổi màu khi xong hết việc', async () => {
  const t = await startApp();
  try {
    await t.call('PATCH', '/api/tasks/1', { as: 'owner@t.test', body: { state: 'done' } });
    assert.equal(room((await t.call('GET', '/api/state')).body, 1).status, 'red');
  } finally { await t.close(); }
});

test('ghi chú: tối đa 150, cho phép trống, cắt khoảng trắng, giữ nguyên ký tự đặc biệt', async () => {
  const t = await startApp();
  try {
    const set = (note, who = 'owner@t.test') => t.call('PATCH', '/api/rooms/1/note', { as: who, body: { note } });
    assert.equal((await set('x'.repeat(150))).status, 200);
    assert.equal((await set('x'.repeat(151))).status, 400);
    assert.equal((await set(7)).status, 400);
    assert.equal((await set('')).body.note, '');
    assert.equal((await set('  Thiếu 200 thẻ <b>"A"</b> & co  ')).body.note, 'Thiếu 200 thẻ <b>"A"</b> & co');
    assert.equal((await set('x', 'other@t.test')).status, 403);
  } finally { await t.close(); }
});

test('trạng thái việc: chủ khu đổi việc trong khu mình, cập nhật giờ của khu', async () => {
  const t = await startApp();
  try {
    const before = room((await t.call('GET', '/api/state')).body, 1).updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const r = await t.call('PATCH', '/api/tasks/1', { as: 'owner@t.test', body: { state: 'doing' } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { id: 1, roomId: 1, text: 'Sắp xếp ghế', state: 'doing', sort: 1 });
    const after = room((await t.call('GET', '/api/state')).body, 1);
    assert.equal(after.tasks[0].state, 'doing');
    assert.ok(after.updatedAt > before);
    assert.equal(after.updatedBy, 'Chủ Khu');

    assert.equal((await t.call('PATCH', '/api/tasks/4', { as: 'owner@t.test', body: { state: 'done' } })).status, 403);
    assert.equal((await t.call('PATCH', '/api/tasks/1', { as: 'owner@t.test', body: { state: 'xong' } })).status, 400);
    assert.equal((await t.call('PATCH', '/api/tasks/1', { as: 'owner@t.test', body: {} })).status, 400);
    assert.equal((await t.call('PATCH', '/api/tasks/999', { as: 'owner@t.test', body: { state: 'done' } })).status, 404);
  } finally { await t.close(); }
});

test('sửa nội dung việc chỉ admin; chủ khu gửi text → 403 và không đổi gì', async () => {
  const t = await startApp();
  try {
    assert.equal((await t.call('PATCH', '/api/tasks/1', { as: 'owner@t.test', body: { text: 'Hack' } })).status, 403);
    assert.equal((await t.call('PATCH', '/api/tasks/1', { as: 'owner@t.test', body: { text: 'Hack', state: 'done' } })).status, 403);
    assert.equal(room((await t.call('GET', '/api/state')).body, 1).tasks[0].state, 'todo');
    const ok = await t.call('PATCH', '/api/tasks/1', { as: 'admin@t.test', body: { text: 'Sắp xếp 600 ghế' } });
    assert.equal(ok.body.text, 'Sắp xếp 600 ghế');
    assert.equal((await t.call('PATCH', '/api/tasks/1', { as: 'admin@t.test', body: { text: '  ' } })).status, 400);
  } finally { await t.close(); }
});

test('body sai: không phải JSON, mảng, null, quá 16 KB; Origin lạ', async () => {
  const t = await startApp();
  try {
    const p = (extra) => t.call('PATCH', '/api/rooms/1/status', { as: 'owner@t.test', ...extra });
    assert.equal((await p({ raw: '{oops' })).status, 400);
    assert.equal((await p({ raw: '[1,2]' })).status, 400);
    assert.equal((await p({ raw: 'null' })).status, 400);
    assert.equal((await p({ raw: JSON.stringify({ status: 'red', pad: 'x'.repeat(20000) }) })).status, 413);
    assert.equal((await p({ body: { status: 'red' }, headers: { origin: 'http://evil.test' } })).body.error, 'bad_origin');
    assert.equal((await p({ body: { status: 'red' }, headers: { origin: t.base } })).status, 200);
    assert.equal((await t.call('GET', '/api/state')).status, 200); // server vẫn sống
  } finally { await t.close(); }
});

test('ghi nhật ký hoạt động', async () => {
  const t = await startApp();
  try {
    await t.call('PATCH', '/api/rooms/1/status', { as: 'owner@t.test', body: { status: 'yellow' } });
    const a = t.db.prepare('SELECT email, room_id, action, detail FROM activity').all();
    assert.deepEqual({ ...a[0] }, { email: 'owner@t.test', room_id: 1, action: 'room.status', detail: 'red -> yellow' });
  } finally { await t.close(); }
});

test('realtime: thay đổi của một máy tới cả hai máy đang mở SSE', async () => {
  const t = await startApp();
  const a = await openSse(t.base);
  const b = await openSse(t.base);
  try {
    await a.next(); await b.next();
    await t.call('PATCH', '/api/rooms/2/status', { as: 'owner@t.test', body: { status: 'green' } });
    assert.equal(room(await a.next(), 2).status, 'green');
    assert.equal(room(await b.next(), 2).status, 'green');
  } finally { a.abort(); b.abort(); await t.close(); }
});
```

- [ ] **Step 2: Chạy để thấy thất bại**

Run: `node --test tests/rooms.test.js`
Expected: FAIL (các PATCH trả 404)

- [ ] **Step 3: Viết `routes/rooms.js`**

```js
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
```

- [ ] **Step 4: Đăng ký vào `lib/app.js`**

Thêm `import { registerRooms } from '../routes/rooms.js';` và `registerRooms(router);` sau `registerAuth(router);`.

- [ ] **Step 5: Chạy test, phải qua**

Run: `node --test tests/*.test.js`
Expected: PASS (toàn bộ)

- [ ] **Step 6: Commit**

```bash
git add routes/rooms.js lib/app.js tests/rooms.test.js
git commit -m "feat(backend): API ghi cho người phụ trách (màu, ghi chú, việc)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: API quản trị (khối, khu, việc, người phụ trách, người dùng, link đăng nhập)

**Files:**
- Create: `routes/admin.js`, `tests/admin.test.js`
- Modify: `lib/app.js` (import + `registerAdmin(router)`)

**Interfaces:**
- Consumes: Task 2 helpers, `newToken`, `loginUrl`, `email`.
- Produces (tất cả chỉ admin, trả `200`): `POST /api/groups {name}` → `{id,name,sort}`; `PATCH /api/groups/:id {name?,sort?}` → group; `DELETE /api/groups/:id` → `{ok:true}` (400 `group_not_empty`); `POST /api/groups/:id/rooms {name}` → `roomView`; `PATCH /api/rooms/:id {name?,sort?,groupId?}` → `roomView`; `DELETE /api/rooms/:id`; `PUT /api/rooms/:id/owners {emails[]}` → `{roomId, emails}`; `POST /api/rooms/:id/tasks {text}` → `taskView`; `DELETE /api/tasks/:id`; `GET /api/users` → `[{email,name,isAdmin,ownedRoomIds,hasToken}]`; `POST /api/users {email,name,isAdmin?}` → user (409 `exists`); `PATCH /api/users/:email {name?,isAdmin?}` → user (400 `cannot_demote_self`); `DELETE /api/users/:email` (400 `cannot_delete_self`); `POST /api/users/:email/token` → `{url}` (token cũ mất hiệu lực).

- [ ] **Step 1: Viết test thất bại `tests/admin.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

const A = 'admin@t.test';
const state = async (t) => (await t.call('GET', '/api/state')).body;
const rooms = (s) => s.groups.flatMap((g) => g.rooms);

test('mọi API quản trị: khách 401, người thường 403', async () => {
  const t = await startApp();
  try {
    const calls = [
      ['POST', '/api/groups', { name: 'X' }], ['PATCH', '/api/groups/1', { name: 'X' }], ['DELETE', '/api/groups/1'],
      ['POST', '/api/groups/1/rooms', { name: 'X' }], ['PATCH', '/api/rooms/1', { name: 'X' }], ['DELETE', '/api/rooms/1'],
      ['PUT', '/api/rooms/1/owners', { emails: [] }], ['POST', '/api/rooms/1/tasks', { text: 'X' }], ['DELETE', '/api/tasks/1'],
      ['GET', '/api/users'], ['POST', '/api/users', { email: 'n@t.test', name: 'N' }],
      ['PATCH', '/api/users/owner@t.test', { name: 'N' }], ['DELETE', '/api/users/owner@t.test'], ['POST', '/api/users/owner@t.test/token'],
    ];
    for (const [m, p, b] of calls) {
      assert.equal((await t.call(m, p, { body: b })).status, 401, `khách ${m} ${p}`);
      assert.equal((await t.call(m, p, { body: b, as: 'owner@t.test' })).status, 403, `thường ${m} ${p}`);
    }
    assert.equal((await state(t)).groups.length, 2); // không có gì bị đổi
  } finally { await t.close(); }
});

test('khối: thêm, đổi tên/thứ tự, xoá (chỉ khi rỗng)', async () => {
  const t = await startApp();
  try {
    const g = await t.call('POST', '/api/groups', { as: A, body: { name: '  Khối mới  ' } });
    assert.equal(g.status, 200);
    assert.deepEqual({ name: g.body.name, sort: g.body.sort }, { name: 'Khối mới', sort: 3 });
    assert.equal((await t.call('POST', '/api/groups', { as: A, body: { name: '' } })).status, 400);
    assert.equal((await t.call('POST', '/api/groups', { as: A, body: { name: 'x'.repeat(81) } })).status, 400);
    const p = await t.call('PATCH', `/api/groups/${g.body.id}`, { as: A, body: { name: 'Khối B', sort: 0 } });
    assert.deepEqual({ name: p.body.name, sort: p.body.sort }, { name: 'Khối B', sort: 0 });
    assert.equal((await state(t)).groups[0].name, 'Khối B');
    const nonEmpty = await t.call('DELETE', '/api/groups/1', { as: A });
    assert.equal(nonEmpty.status, 400);
    assert.equal(nonEmpty.body.error, 'group_not_empty');
    assert.deepEqual((await t.call('DELETE', `/api/groups/${g.body.id}`, { as: A })).body, { ok: true });
    assert.equal((await t.call('DELETE', '/api/groups/999', { as: A })).status, 404);
  } finally { await t.close(); }
});

test('khu: thêm mặc định đỏ, đổi tên, chuyển khối, xoá kéo theo việc và người phụ trách', async () => {
  const t = await startApp();
  try {
    const r = await t.call('POST', '/api/groups/2/rooms', { as: A, body: { name: 'Khu giữ xe' } });
    assert.equal(r.status, 200);
    assert.deepEqual({ status: r.body.status, note: r.body.note, groupId: r.body.groupId }, { status: 'red', note: '', groupId: 2 });
    assert.equal((await t.call('POST', '/api/groups/999/rooms', { as: A, body: { name: 'X' } })).status, 404);
    const mv = await t.call('PATCH', `/api/rooms/${r.body.id}`, { as: A, body: { name: 'Giữ xe', groupId: 1, sort: 9 } });
    assert.deepEqual({ name: mv.body.name, groupId: mv.body.groupId, sort: mv.body.sort }, { name: 'Giữ xe', groupId: 1, sort: 9 });
    assert.equal((await t.call('PATCH', `/api/rooms/${r.body.id}`, { as: A, body: { groupId: 999 } })).status, 404);
    assert.equal((await t.call('PATCH', `/api/rooms/${r.body.id}`, { as: A, body: { name: ' ' } })).status, 400);

    await t.call('DELETE', '/api/rooms/1', { as: A });
    assert.ok(!rooms(await state(t)).some((x) => x.id === 1));
    assert.equal(t.db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE room_id = 1').get().n, 0);
    assert.equal(t.db.prepare('SELECT COUNT(*) AS n FROM room_owners WHERE room_id = 1').get().n, 0);
    assert.equal((await t.call('DELETE', '/api/rooms/1', { as: A })).status, 404);
  } finally { await t.close(); }
});

test('gán người phụ trách: thay thế danh sách, chuẩn hoá hoa/thường, email lạ → 400, rỗng được', async () => {
  const t = await startApp();
  try {
    const ok = await t.call('PUT', '/api/rooms/3/owners', { as: A, body: { emails: ['OWNER@t.test', 'other@t.test', 'owner@t.test'] } });
    assert.deepEqual(ok.body, { roomId: 3, emails: ['other@t.test', 'owner@t.test'] });
    assert.deepEqual(rooms(await state(t)).find((r) => r.id === 3).owners.map((o) => o.name), ['Chủ Khu', 'Người Khác']);
    assert.equal((await t.call('PUT', '/api/rooms/3/owners', { as: A, body: { emails: ['la@t.test'] } })).status, 400);
    assert.equal((await t.call('PUT', '/api/rooms/3/owners', { as: A, body: { emails: 'a@b.vn' } })).status, 400);
    assert.equal(rooms(await state(t)).find((r) => r.id === 3).owners.length, 2); // lỗi không làm mất dữ liệu
    assert.deepEqual((await t.call('PUT', '/api/rooms/3/owners', { as: A, body: { emails: [] } })).body.emails, []);
    assert.equal((await t.call('PUT', '/api/rooms/999/owners', { as: A, body: { emails: [] } })).status, 404);
    // quyền có hiệu lực ngay
    await t.call('PUT', '/api/rooms/3/owners', { as: A, body: { emails: ['nobody@t.test'] } });
    assert.equal((await t.call('PATCH', '/api/rooms/3/status', { as: 'nobody@t.test', body: { status: 'green' } })).status, 200);
  } finally { await t.close(); }
});

test('việc: thêm (mặc định chưa làm, xếp cuối), xoá', async () => {
  const t = await startApp();
  try {
    const r = await t.call('POST', '/api/rooms/1/tasks', { as: A, body: { text: 'Chạy thử máy chiếu' } });
    assert.deepEqual({ roomId: r.body.roomId, state: r.body.state, sort: r.body.sort }, { roomId: 1, state: 'todo', sort: 3 });
    assert.equal((await t.call('POST', '/api/rooms/1/tasks', { as: A, body: { text: 'x'.repeat(201) } })).status, 400);
    assert.equal((await t.call('POST', '/api/rooms/999/tasks', { as: A, body: { text: 'X' } })).status, 404);
    assert.deepEqual((await t.call('DELETE', `/api/tasks/${r.body.id}`, { as: A })).body, { ok: true });
    assert.equal((await t.call('DELETE', `/api/tasks/${r.body.id}`, { as: A })).status, 404);
    assert.equal(rooms(await state(t)).find((x) => x.id === 1).tasks.length, 2);
  } finally { await t.close(); }
});

test('người dùng: danh sách có email và khu phụ trách, thêm, trùng 409, sửa, xoá', async () => {
  const t = await startApp();
  try {
    const list = await t.call('GET', '/api/users', { as: A });
    const o = list.body.find((u) => u.email === 'owner@t.test');
    assert.deepEqual(o, { email: 'owner@t.test', name: 'Chủ Khu', isAdmin: false, ownedRoomIds: [1, 2], hasToken: false });
    const n = await t.call('POST', '/api/users', { as: A, body: { email: ' Moi@T.test ', name: 'Người Mới', isAdmin: false } });
    assert.deepEqual(n.body, { email: 'moi@t.test', name: 'Người Mới', isAdmin: false, ownedRoomIds: [], hasToken: false });
    assert.equal((await t.call('POST', '/api/users', { as: A, body: { email: 'moi@t.test', name: 'Lại' } })).status, 409);
    assert.equal((await t.call('POST', '/api/users', { as: A, body: { email: 'sai', name: 'X' } })).status, 400);
    const p = await t.call('PATCH', '/api/users/moi%40t.test', { as: A, body: { name: 'Tên Khác', isAdmin: true } });
    assert.deepEqual({ name: p.body.name, isAdmin: p.body.isAdmin }, { name: 'Tên Khác', isAdmin: true });
    assert.equal((await t.call('PATCH', '/api/users/khong%40co.vn', { as: A, body: { name: 'X' } })).status, 404);
    assert.deepEqual((await t.call('DELETE', '/api/users/moi%40t.test', { as: A })).body, { ok: true });
  } finally { await t.close(); }
});

test('đổi tên người dùng cập nhật tên trên dashboard; xoá người phụ trách xoá phiên và tên khỏi khu', async () => {
  const t = await startApp();
  try {
    await t.call('PATCH', '/api/users/owner%40t.test', { as: A, body: { name: 'Nguyễn Văn Á' } });
    assert.equal(rooms(await state(t))[0].owners[0].name, 'Nguyễn Văn Á');
    const cookie = t.cookieFor('owner@t.test');
    assert.notEqual((await t.call('GET', '/api/me', { cookie })).body, null);
    await t.call('DELETE', '/api/users/owner%40t.test', { as: A });
    assert.equal((await t.call('GET', '/api/me', { cookie })).body, null);
    assert.deepEqual(rooms(await state(t))[0].owners, []);
  } finally { await t.close(); }
});

test('admin không tự xoá hoặc tự hạ quyền mình', async () => {
  const t = await startApp();
  try {
    const del = await t.call('DELETE', '/api/users/admin%40t.test', { as: A });
    assert.deepEqual([del.status, del.body.error], [400, 'cannot_delete_self']);
    const dem = await t.call('PATCH', '/api/users/admin%40t.test', { as: A, body: { isAdmin: false } });
    assert.deepEqual([dem.status, dem.body.error], [400, 'cannot_demote_self']);
    assert.equal((await t.call('PATCH', '/api/users/admin%40t.test', { as: A, body: { name: 'Tên mới' } })).status, 200);
  } finally { await t.close(); }
});

test('link đăng nhập riêng: tạo mới vô hiệu link cũ, link mới dùng được, không lộ qua state', async () => {
  const t = await startApp();
  try {
    const r1 = await t.call('POST', '/api/users/owner%40t.test/token', { as: A });
    assert.match(r1.body.url, /^http:\/\/localhost\/auth\/token\?t=[A-Za-z0-9_-]{43}$/);
    const tok1 = new URL(r1.body.url).searchParams.get('t');
    assert.equal((await t.call('GET', `/auth/token?t=${tok1}`)).status, 302);
    assert.ok(t.db.prepare("SELECT token FROM users WHERE email='owner@t.test'").get().token === tok1);
    const r2 = await t.call('POST', '/api/users/owner%40t.test/token', { as: A });
    const tok2 = new URL(r2.body.url).searchParams.get('t');
    assert.notEqual(tok1, tok2);
    assert.equal((await t.call('GET', `/auth/token?t=${tok1}`)).headers.get('location'), '/?login=failed');
    assert.equal((await t.call('GET', `/auth/token?t=${tok2}`)).headers.get('location'), '/');
    assert.ok(!JSON.stringify(await state(t)).includes(tok2));
    assert.equal((await t.call('POST', '/api/users/khong%40co.vn/token', { as: A })).status, 404);
    const list = await t.call('GET', '/api/users', { as: A });
    assert.equal(list.body.find((u) => u.email === 'owner@t.test').hasToken, true);
  } finally { await t.close(); }
});
```

- [ ] **Step 2: Chạy để thấy thất bại**

Run: `node --test tests/admin.test.js`
Expected: FAIL (các route trả 404)

- [ ] **Step 3: Viết `routes/admin.js`**

```js
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
  const admin = (fn) => (ctx) => { requireAdmin(ctx.user); return fn(ctx); };
  const add = (method, path, fn) => router.add(method, path, admin(fn));

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
    if (!Array.isArray(body.emails)) throw new HttpError(400, 'bad_request', 'emails: phải là mảng');
    const emails = [...new Set(body.emails.map((e) => email(e, 'emails')))].sort();
    for (const e of emails) {
      if (!db.prepare('SELECT 1 FROM users WHERE email = ?').get(e)) {
        throw new HttpError(400, 'unknown_user', `Chưa có người dùng ${e}`);
      }
    }
    tx(db, () => {
      db.prepare('DELETE FROM room_owners WHERE room_id = ?').run(r.id);
      for (const e of emails) db.prepare('INSERT INTO room_owners(room_id, email) VALUES (?,?)').run(r.id, e);
    });
    logActivity(db, user, r.id, 'room.owners', emails.join(','));
    sse.broadcast();
    return { roomId: r.id, emails };
  });

  // ---- việc ----
  add('POST', '/api/rooms/:id/tasks', ({ db, user, params, body, sse }) => {
    const r = roomOr404(db, params.id);
    const txt = text(body.text, 200, 'text');
    const sort = nextSort(db, 'SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM tasks WHERE room_id = ?', r.id);
    const id = rowId(db.prepare('INSERT INTO tasks(room_id, text, sort, updated_at, updated_by) VALUES (?,?,?,?,?)')
      .run(r.id, txt, sort, Date.now(), user.name));
    sse.broadcast();
    return taskView(taskOr404(db, id));
  });

  add('DELETE', '/api/tasks/:id', ({ db, params, sse }) => {
    const t = taskOr404(db, params.id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(t.id);
    sse.broadcast();
    return { ok: true };
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
```

- [ ] **Step 4: Đăng ký vào `lib/app.js`**

Thêm `import { registerAdmin } from '../routes/admin.js';` và `registerAdmin(router);` sau `registerRooms(router);`.

- [ ] **Step 5: Chạy toàn bộ test**

Run: `node --test tests/*.test.js`
Expected: PASS (toàn bộ). Nếu `PATCH /api/rooms/:id` va chạm route `/status`, `/note` thì kiểm tra regex neo `^...$` (không được khớp).

- [ ] **Step 6: Commit**

```bash
git add routes/admin.js lib/app.js tests/admin.test.js
git commit -m "feat(backend): API quản trị khối, khu, việc, người dùng, link đăng nhập

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Khởi động server, seed mẫu, script link, CI/deploy, tài liệu, PR 1

**Files:**
- Create: `server.js`, `scripts/links.js`, `seed.json`, `deploy/links.sh`
- Modify: `.github/workflows/deploy.yml` (bỏ `npm ci` ở bước test backend), `deploy/deploy.sh` (thêm `scripts`, `seed.json` vào danh sách rsync), `API.md` (ghi chú kết quả xoá, owners rỗng), `.gitignore` (thêm `app.db*` nếu chưa có)

**Interfaces:**
- Consumes: `createApp`, `openDb`, `isEmpty`, `applySeed`, `ensureTokens`, `loginUrl`.
- Produces: `node server.js` lắng nghe `HOST:PORT`; DB rỗng thì tự nạp `SEED_FILE`; `node scripts/links.js` in link đăng nhập từng người; `deploy/links.sh` chạy lệnh đó trên VM.

- [ ] **Step 1: Viết `server.js`**

```js
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from './lib/db.js';
import { createApp } from './lib/app.js';
import { isEmpty, applySeed, ensureTokens } from './lib/seed.js';

const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '127.0.0.1',
  dbPath: process.env.DB_PATH ?? 'app.db',
  baseUrl: (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  seedFile: process.env.SEED_FILE ?? fileURLToPath(new URL('./seed.json', import.meta.url)),
};

const db = openDb(config.dbPath);
if (isEmpty(db) && existsSync(config.seedFile)) {
  applySeed(db, JSON.parse(readFileSync(config.seedFile, 'utf8')));
  console.log(`Đã nạp dữ liệu từ ${config.seedFile}`);
}
ensureTokens(db);

const app = createApp({ db, config });
app.server.listen(config.port, config.host, () => {
  console.log(`Event tracker: http://${config.host}:${config.port} (DB ${config.dbPath})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { await app.close(); db.close(); process.exit(0); });
}
```

- [ ] **Step 2: Viết `scripts/links.js`**

```js
import { openDb } from '../lib/db.js';
import { ensureTokens } from '../lib/seed.js';
import { loginUrl } from '../auth/token.js';

const db = openDb(process.env.DB_PATH ?? 'app.db');
ensureTokens(db);
const config = { baseUrl: (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '') };
for (const u of db.prepare('SELECT email, name, is_admin, token FROM users ORDER BY is_admin DESC, name').all()) {
  console.log([u.is_admin ? 'ADMIN' : 'user ', u.email, u.name, loginUrl(config, u.token)].join('\t'));
}
```

- [ ] **Step 3: Viết `seed.json`** (dữ liệu mẫu từ mockup; email giả `@example.com`, thay bằng dữ liệu thật ở bước E1)

```json
{
  "users": [
    { "email": "admin@example.com", "name": "Quản trị viên", "isAdmin": true },
    { "email": "a@example.com", "name": "Nguyễn Văn A" },
    { "email": "b@example.com", "name": "Lê Thị B" },
    { "email": "c@example.com", "name": "Trần Văn C" },
    { "email": "d@example.com", "name": "Phạm Thị D" },
    { "email": "e@example.com", "name": "Hoàng Văn E" },
    { "email": "g@example.com", "name": "Đỗ Văn G" },
    { "email": "h@example.com", "name": "Vũ Thị H" },
    { "email": "k@example.com", "name": "Bùi Văn K" }
  ],
  "groups": [
    { "name": "Khối Thư viện TQB", "rooms": [
      { "name": "Sảnh thư viện", "status": "yellow", "note": "Đang dựng backdrop", "owners": ["d@example.com"],
        "tasks": [["Dựng backdrop", "doing"], ["Bàn đón tiếp", "done"], ["Biển chỉ dẫn", "done"]] },
      { "name": "Phòng đọc tầng 2", "status": "green", "note": "Sẵn sàng", "owners": ["c@example.com"],
        "tasks": [["Bàn ghế, nước", "done"], ["Máy chiếu, Wi-Fi", "done"]] },
      { "name": "Khu triển lãm", "note": "Chưa nhận mặt bằng", "owners": ["e@example.com"],
        "tasks": ["Nhận mặt bằng", "Dựng panel", "Ánh sáng"] }
    ] },
    { "name": "Khối C2", "rooms": [
      { "name": "Hội trường C2", "status": "yellow", "note": "Chờ chạy thử máy chiếu LED", "owners": ["a@example.com", "b@example.com"],
        "tasks": [["Sắp xếp 600 ghế", "done"], ["Âm thanh, micro", "done"], ["Chạy thử máy chiếu LED", "doing"], ["Ánh sáng sân khấu", "todo"], ["Backdrop, standee", "done"], ["Nhân sự trực có mặt", "todo"]] },
      { "name": "Sảnh C2", "note": "Thiếu 200 thẻ đại biểu, đang in lại", "owners": ["a@example.com"],
        "tasks": [["Dựng bàn đón tiếp", "done"], ["In và xếp thẻ đại biểu", "doing"], ["Bảng chỉ dẫn", "done"], ["Quầy gửi đồ", "todo"]] },
      { "name": "Phòng họp C2-1", "status": "green", "note": "Sẵn sàng", "owners": ["c@example.com"],
        "tasks": [["Bàn ghế, nước", "done"], ["Máy chiếu, Wi-Fi", "done"]] },
      { "name": "Phòng VIP", "status": "yellow", "note": "Đang bày hoa", "owners": ["d@example.com"],
        "tasks": [["Bàn trà, hoa", "done"], ["Khu chụp ảnh", "doing"], ["Danh sách VIP bản in", "done"]] },
      { "name": "Phòng điều hành", "note": "Chưa bắt đầu", "owners": ["b@example.com"],
        "tasks": ["Màn hình giám sát", "Bộ đàm"] }
    ] },
    { "name": "Khối Sân trường – An ninh", "rooms": [
      { "name": "Cổng chính", "status": "yellow", "note": "An ninh đã vào vị trí 1/2 ca", "owners": ["g@example.com"],
        "tasks": [["Rào chắn, lối vào", "done"], ["Bảo vệ ca 1", "done"], ["Bảo vệ ca 2", "doing"]] },
      { "name": "Khu giữ xe", "note": "Chưa phân khu", "owners": ["g@example.com"],
        "tasks": ["Phân khu xe máy, ô tô", "Biển chỉ dẫn"] },
      { "name": "Khu ăn nhẹ", "status": "yellow", "note": "Chờ đồ ăn lúc 10h", "owners": ["h@example.com"],
        "tasks": [["Bàn buffet", "done"], ["Nhận đồ ăn lúc 10h", "doing"], ["Ly, đĩa, rác", "todo"]] },
      { "name": "Phòng y tế", "status": "green", "note": "Sẵn sàng", "owners": ["k@example.com"],
        "tasks": [["Thuốc, dụng cụ sơ cứu", "done"], ["Nhân viên y tế", "done"]] }
    ] }
  ]
}
```

- [ ] **Step 4: Viết `deploy/links.sh`** (chạy từ máy anh/chị, in link đăng nhập từ VM)

```bash
#!/usr/bin/env bash
# In link đăng nhập riêng của mọi người dùng (chạy trên VM bằng user eventapp).
set -euo pipefail
HOST=${HOST:-ubuntu@168.107.75.89}
KEY=${KEY:-$HOME/.ssh/oracle-event.key}
ssh -i "$KEY" "$HOST" "sudo -u eventapp bash -c 'set -a; . /etc/event-tracker.env; set +a; cd /opt/event-tracker/app && node scripts/links.js'"
```

Run: `chmod +x deploy/links.sh`

- [ ] **Step 5: Sửa `deploy/deploy.sh`**

Thay dòng `for f in server.js lib routes auth package.json package-lock.json; do` bằng:

```bash
  files=(); for f in server.js lib routes auth scripts seed.json package.json package-lock.json; do [ -e "$f" ] && files+=("$f"); done
```

(giữ nguyên các dòng còn lại; dòng `files=();` cũ nằm cùng dòng đó nên thay nguyên dòng).

- [ ] **Step 6: Sửa `.github/workflows/deploy.yml`**

Thay bước test backend:

```yaml
      - name: Test (backend + logic frontend)
        run: npm test
```

(bỏ hẳn điều kiện `npm ci` và kiểm tra `scripts.test`; repo không có dependency backend.) Thêm `fetch-depth` không cần.

- [ ] **Step 7: Ghi chú vào `API.md`** (đúng thứ tự "sửa hợp đồng trước")

Cuối mục 4 thêm:

```markdown
### 4.3 Quy ước kết quả

- Tạo mới (`POST`) và sửa (`PATCH`) trả `200` với đối tượng vừa ghi. Khu/việc trả dạng `{ id, groupId|roomId, name|text, status|state, note, sort, updatedAt, updatedBy }`.
- Xoá (`DELETE`) trả `200` với `{ "ok": true }`.
- `PUT /api/rooms/:id/owners` nhận `emails` có thể rỗng (bỏ hết người phụ trách), trả `{ "roomId": 5, "emails": ["a@hust.edu.vn"] }`. Email phải đã có trong danh sách người dùng, nếu không trả 400 `unknown_user`.
- `PATCH /api/tasks/:id` chỉ gửi `state` thì chủ khu cũng gọi được; gửi `text` thì chỉ admin (kể cả khi gửi cùng `state`).
- Admin không tự xoá (`cannot_delete_self`) hoặc tự bỏ quyền admin (`cannot_demote_self`) của chính mình; xoá khối còn khu trả `group_not_empty`.
```

- [ ] **Step 8: Chạy thử thật và toàn bộ test**

```bash
npm test
PORT=3917 DB_PATH=/tmp/et-smoke.db BASE_URL=http://localhost:3917 node server.js &
sleep 1
curl -s localhost:3917/api/state | head -c 300; echo
curl -s -o /dev/null -w 'events: %{http_code}\n' -m 2 localhost:3917/events || true
DB_PATH=/tmp/et-smoke.db BASE_URL=http://localhost:3917 node scripts/links.js | head -3
kill %1; rm -f /tmp/et-smoke.db*
```

Expected: `npm test` PASS; state JSON có `"version":1` và 3 khối; `events: 200` (hoặc timeout vì stream mở, chấp nhận); `links.js` in 3 dòng có `/auth/token?t=`.

- [ ] **Step 9: Commit, đẩy nhánh, mở PR 1**

```bash
git add -A
git commit -m "feat(backend): server.js, seed mẫu, script link đăng nhập, CI chạy test

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feat/backend
gh pr create --base main --head feat/backend --title "Backend: API, phân quyền, SSE, seed" --body "Theo docs/superpowers/plans/2026-10-12-event-tracker.md (Phase 1). Test: npm test.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Sau khi bước `build` của PR xanh: `gh pr merge --squash --delete-branch` (người dùng đã cho phép merge không bảo vệ nhánh). Merge kích hoạt deploy; bước "Kiểm tra sau deploy" phải **xanh** (`/api/state` trả 200).

- [ ] **Step 10: Kiểm tra trên VM**

```bash
curl -s http://168.107.75.89/api/state | head -c 200; echo
deploy/links.sh | head -3
```

Expected: JSON state có 3 khối; 3 dòng link `http://localhost:3000/auth/token?t=...` (BASE_URL trong `/etc/event-tracker.env` là `https://sk.hust.edu.vn`, nên link in ra có tên miền đó; để thử qua IP, thay phần gốc bằng `http://168.107.75.89` trên máy anh/chị). Mở một link đã thay gốc trong trình duyệt → về `/` có cookie, `curl -b` tới `/api/me` trả đúng người.

---

## Phase 2: Frontend (nhánh `feat/web`, PR 2)

Bắt đầu: `git checkout main && git pull && git checkout -b feat/web`.

### Task 8: Khung Vite + logic thuần có test

**Files:**
- Create: `web/package.json`, `web/vite.config.js`, `web/index.html`, `web/src/main.jsx`, `web/src/styles.css`, `web/src/logic.js`, `web/src/logic.test.js`, `.claude/launch.json`
- Generated: `web/package-lock.json`

**Interfaces:**
- Produces (`web/src/logic.js`): `ST`, `TS`, `ORDER`, `NOTE_MAX`, `NEXT`, `allRooms(state)`, `doneCount(room)`, `percent(room)`, `statusCounts(rooms)`, `totals(rooms) → {rooms, done, total, pct}`, `canEdit(me, room)`, `patchRoom(state, roomId, patch)`, `patchTask(state, taskId, patch)`, `timeLabel(ms)`.

- [ ] **Step 1: Viết test thất bại `web/src/logic.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ST, NEXT, percent, doneCount, statusCounts, totals, canEdit, patchRoom, patchTask, allRooms, timeLabel } from './logic.js';

const state = {
  version: 1,
  groups: [
    { id: 1, name: 'G', rooms: [
      { id: 4, status: 'yellow', tasks: [{ id: 1, state: 'done' }, { id: 2, state: 'doing' }, { id: 3, state: 'todo' }] },
      { id: 5, status: 'red', tasks: [] },
    ] },
    { id: 2, name: 'H', rooms: [{ id: 6, status: 'green', tasks: [{ id: 9, state: 'done' }] }] },
  ],
};

test('nhãn và vòng trạng thái việc', () => {
  assert.equal(ST.red, 'Chưa sẵn sàng');
  assert.deepEqual([NEXT.todo, NEXT.doing, NEXT.done], ['doing', 'done', 'todo']);
});

test('phần trăm: khu không có việc là 0, không chia cho 0', () => {
  const [a, b] = allRooms(state);
  assert.equal(doneCount(a), 1);
  assert.equal(percent(a), 33);
  assert.equal(percent(b), 0);
});

test('đếm màu và tổng', () => {
  const rooms = allRooms(state);
  assert.deepEqual(statusCounts(rooms), { red: 1, yellow: 1, green: 1 });
  assert.deepEqual(totals(rooms), { rooms: 3, done: 2, total: 4, pct: 50 });
  assert.deepEqual(totals([]), { rooms: 0, done: 0, total: 0, pct: 0 });
});

test('canEdit: khách không, chủ khu đúng khu, admin tất cả', () => {
  assert.equal(canEdit(null, { id: 4 }), false);
  assert.equal(canEdit(undefined, { id: 4 }), false);
  assert.equal(canEdit({ isAdmin: false, ownedRoomIds: [4] }, { id: 4 }), true);
  assert.equal(canEdit({ isAdmin: false, ownedRoomIds: [4] }, { id: 5 }), false);
  assert.equal(canEdit({ isAdmin: true, ownedRoomIds: [] }, { id: 5 }), true);
});

test('patchRoom/patchTask trả state mới, không sửa state cũ', () => {
  const s1 = patchRoom(state, 5, { status: 'green' });
  assert.equal(allRooms(s1)[1].status, 'green');
  assert.equal(allRooms(state)[1].status, 'red');
  const s2 = patchTask(state, 2, { state: 'done' });
  assert.equal(allRooms(s2)[0].tasks[1].state, 'done');
  assert.equal(allRooms(state)[0].tasks[1].state, 'doing');
  assert.equal(allRooms(s2)[0].status, 'yellow'); // không tự đổi màu theo việc
  assert.equal(allRooms(patchTask(state, 999, { state: 'done' }))[0].tasks[0].state, 'done');
});

test('timeLabel: múi giờ Việt Nam, rỗng khi không có', () => {
  assert.equal(timeLabel(Date.UTC(2026, 9, 11, 17, 30)), '00:30');
  assert.equal(timeLabel(null), '');
});
```

- [ ] **Step 2: Chạy để thấy thất bại**

Run: `node --test web/src/logic.test.js`
Expected: FAIL, `Cannot find module './logic.js'`

- [ ] **Step 3: Viết `web/src/logic.js`**

```js
export const ST = { red: 'Chưa sẵn sàng', yellow: 'Đang chuẩn bị', green: 'Sẵn sàng' };
export const TS = { todo: '○ Chưa làm', doing: '◐ Đang làm', done: '● Xong' };
export const ORDER = ['red', 'yellow', 'green'];
export const NOTE_MAX = 150;
export const NEXT = { todo: 'doing', doing: 'done', done: 'todo' };

export const allRooms = (state) => (state?.groups ?? []).flatMap((g) => g.rooms);
export const doneCount = (r) => r.tasks.filter((t) => t.state === 'done').length;
export const percent = (r) => (r.tasks.length ? Math.round((doneCount(r) / r.tasks.length) * 100) : 0);

export function statusCounts(rooms) {
  const c = { red: 0, yellow: 0, green: 0 };
  for (const r of rooms) c[r.status]++;
  return c;
}

export function totals(rooms) {
  let done = 0;
  let total = 0;
  for (const r of rooms) { done += doneCount(r); total += r.tasks.length; }
  return { rooms: rooms.length, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export const canEdit = (me, room) => !!me && (me.isAdmin || me.ownedRoomIds.includes(room.id));

const mapRooms = (state, fn) => ({ ...state, groups: state.groups.map((g) => ({ ...g, rooms: g.rooms.map(fn) })) });

export const patchRoom = (state, roomId, patch) =>
  mapRooms(state, (r) => (r.id === roomId ? { ...r, ...patch } : r));

export const patchTask = (state, taskId, patch) =>
  mapRooms(state, (r) =>
    r.tasks.some((t) => t.id === taskId)
      ? { ...r, tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }
      : r);

export const timeLabel = (ms) =>
  ms ? new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }) : '';
```

- [ ] **Step 4: Chạy test, phải qua**

Run: `node --test web/src/logic.test.js`
Expected: PASS. Nếu `timeLabel` trả `0:30` hoặc `24:30` do ICU, đổi thành định dạng thủ công bằng `Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' })` và giữ test nguyên.

- [ ] **Step 5: Dựng khung Vite**

`web/package.json`:

```json
{
  "name": "event-tracker-web",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
  "dependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" },
  "devDependencies": { "@vitejs/plugin-react": "^4.3.4", "vite": "^5.4.11" }
}
```

`web/vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.API_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: { proxy: { '/api': api, '/events': api, '/auth': api } },
});
```

`web/index.html`:

```html
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>Theo dõi sự kiện</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

`web/src/main.jsx`:

```jsx
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);
```

Chạy:

```bash
cd web && npm install && cd ..
sed -n '/^<style>/,/^<\/style>/p' mockup/index.html | sed '1d;$d' | sed 's/padding-bottom:calc(90px/padding-bottom:calc(24px/' > web/src/styles.css
```

Nối thêm CSS cho màn Quản lý và phần bổ sung vào cuối `web/src/styles.css`:

```css
.loading{padding:40px 16px;text-align:center;color:var(--mute)}
a.chip{text-decoration:none;color:inherit;display:inline-flex;align-items:center}
.live.off i{background:var(--red);animation:none}
.offline{background:var(--yellow-bg);color:var(--yellow);text-align:center;padding:6px 12px;font-size:13px;font-weight:600}
.mpage{padding:12px 16px 40px;display:grid;gap:14px;max-width:760px;margin:0 auto}
.mpage h2{font-size:17px;margin:8px 0 0}
.mg{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;gap:10px}
.mroom{border:1px solid var(--line);border-radius:12px;padding:8px 10px}
.mroom summary{min-height:44px;display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:700}
.mroom small{color:var(--mute);font-weight:400}
.mrow{display:flex;gap:8px;margin:6px 0}
.mrow input,.mlink input,.addrow input{flex:1;min-width:0;min-height:44px;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:10px;padding:0 12px;font:inherit}
.mpage button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--line);background:var(--card);cursor:pointer;font-weight:600}
.mpage button:disabled{opacity:.4;cursor:default}
.mlabel{font-size:13px;color:var(--mute);margin-top:8px}
.mchecks{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:2px 10px}
.mchecks label,.muser label{display:flex;align-items:center;gap:8px;min-height:44px}
.mchecks input,.muser input[type=checkbox]{width:20px;height:20px}
.muser{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid var(--line);padding:6px 0}
.muser>div{flex:1;min-width:140px}
.mlink{display:grid;gap:6px;background:var(--bg-c,var(--gray-bg));padding:10px;border-radius:12px}
.addrow{display:flex;gap:8px}
.back{display:inline-flex;min-height:44px;align-items:center;color:var(--brand);text-decoration:none;font-weight:600}
```

`.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "backend", "runtimeExecutable": "env", "runtimeArgs": ["PORT=3917", "DB_PATH=/tmp/et-dev.db", "BASE_URL=http://localhost:5173", "node", "server.js"], "port": 3917 },
    { "name": "web", "runtimeExecutable": "env", "runtimeArgs": ["API_URL=http://127.0.0.1:3917", "npm", "run", "dev", "--prefix", "web", "--", "--port", "5173", "--host", "127.0.0.1"], "port": 5173 }
  ]
}
```

- [ ] **Step 6: Commit**

```bash
git add web .claude/launch.json
git commit -m "feat(web): khung Vite + logic thuần có test

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(`web/dist` và `node_modules` đã được `.gitignore` chặn; `web/package-lock.json` phải được commit để CI chạy `npm ci`.)

---

### Task 9: Dashboard: api, SSE, header, khối, khu, việc, ghi chú

**Files:**
- Create: `web/src/api.js`, `web/src/useLive.js`, `web/src/Header.jsx`, `web/src/Group.jsx`, `web/src/App.jsx`, `web/src/Manage.jsx` (bản tạm), 

**Interfaces:**
- Consumes: `logic.js` (Task 8), API.md.
- Produces: `api` (đối tượng hàm gọi API, ném `ApiError{status, code, message}`); `useLive() → { state, setState, online, reload }`; `App` mặc định; `Manage({ state, say })` (Task 10 viết đầy đủ, task này chỉ có chỗ giữ chỗ trả "Đang làm" để build được).

- [ ] **Step 1: Viết `web/src/api.js`**

```js
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function req(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await res.text();
  const data = t ? JSON.parse(t) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? `Lỗi ${res.status}`);
  return data;
}

const u = encodeURIComponent;

export const api = {
  state: () => req('GET', '/api/state'),
  me: () => req('GET', '/api/me'),
  logout: () => req('POST', '/auth/logout'),
  setStatus: (id, status) => req('PATCH', `/api/rooms/${id}/status`, { status }),
  setNote: (id, note) => req('PATCH', `/api/rooms/${id}/note`, { note }),
  setTask: (id, state) => req('PATCH', `/api/tasks/${id}`, { state }),
  // quản trị
  addGroup: (name) => req('POST', '/api/groups', { name }),
  patchGroup: (id, p) => req('PATCH', `/api/groups/${id}`, p),
  delGroup: (id) => req('DELETE', `/api/groups/${id}`),
  addRoom: (groupId, name) => req('POST', `/api/groups/${groupId}/rooms`, { name }),
  patchRoom: (id, p) => req('PATCH', `/api/rooms/${id}`, p),
  delRoom: (id) => req('DELETE', `/api/rooms/${id}`),
  setOwners: (id, emails) => req('PUT', `/api/rooms/${id}/owners`, { emails }),
  addTask: (roomId, text) => req('POST', `/api/rooms/${roomId}/tasks`, { text }),
  patchTaskText: (id, text) => req('PATCH', `/api/tasks/${id}`, { text }),
  delTask: (id) => req('DELETE', `/api/tasks/${id}`),
  users: () => req('GET', '/api/users'),
  addUser: (user) => req('POST', '/api/users', user),
  patchUser: (email, p) => req('PATCH', `/api/users/${u(email)}`, p),
  delUser: (email) => req('DELETE', `/api/users/${u(email)}`),
  userLink: (email) => req('POST', `/api/users/${u(email)}/token`),
};
```

- [ ] **Step 2: Viết `web/src/useLive.js`**

```js
import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

export function useLive() {
  const [state, setState] = useState(null);
  const [online, setOnline] = useState(false);

  const reload = useCallback(() => { api.state().then(setState).catch(() => {}); }, []);

  useEffect(() => {
    reload();
    const es = new EventSource('/events');
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.onmessage = (e) => setState(JSON.parse(e.data));
    return () => es.close();
  }, [reload]);

  return { state, setState, online, reload };
}
```

- [ ] **Step 3: Viết `web/src/Header.jsx`**

{% raw %}
```jsx
import { ORDER, ST } from './logic.js';

export default function Header({ me, online, counts, tot, filter, setFilter }) {
  const who = !me
    ? 'Bạn đang xem công khai · Chưa đăng nhập'
    : me.isAdmin
      ? `Quản trị viên ${me.name} · Sửa được tất cả`
      : `Xin chào ${me.name} · Phụ trách ${me.ownedRoomIds.length} khu vực`;
  return (
    <header>
      <div className="row">
        <h1>Sự kiện – tình trạng các khu vực</h1>
        <div className={`live ${online ? '' : 'off'}`}><i />{online ? 'Realtime' : 'Mất kết nối'}</div>
      </div>
      <div className="who">{who}</div>
      <div className="tiles">
        {ORDER.map((k) => (
          <button key={k} className={`tile ${k} ${filter === k ? 'on' : ''}`} onClick={() => setFilter(filter === k ? 'all' : k)}>
            <b>{counts[k]}</b><span>{ST[k]}</span>
          </button>
        ))}
      </div>
      <div className="total"><span>{tot.rooms} khu · {tot.done}/{tot.total} việc xong</span><span>{tot.pct}%</span></div>
      <div className="bar"><b style={{ width: `${tot.pct}%` }} /></div>
    </header>
  );
}
```
{% endraw %}

- [ ] **Step 4: Viết `web/src/Group.jsx`**

{% raw %}
```jsx
import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { ORDER, ST, TS, NEXT, NOTE_MAX, canEdit, doneCount, percent, statusCounts, patchRoom, patchTask, timeLabel } from './logic.js';

function NoteBox({ room, onSave }) {
  const [v, setV] = useState(room.note);
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setV(room.note); }, [room.note]); // không ghi đè khi đang gõ
  const save = () => {
    typing.current = false;
    const s = v.trim();
    if (s !== room.note) onSave(s);
  };
  return (
    <>
      <div className="ctl">
        <input
          maxLength={NOTE_MAX}
          value={v}
          placeholder={`Dòng status ngắn (tối đa ${NOTE_MAX} ký tự)`}
          onFocus={() => { typing.current = true; }}
          onChange={(e) => setV(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
      </div>
      <div className="cnt">{v.length}/{NOTE_MAX}</div>
    </>
  );
}

function RoomCard({ room, me, open, onToggle, act }) {
  const ed = canEdit(me, room);
  const dn = doneCount(room);
  const pc = percent(room);
  const setStatus = (k) => act((s) => patchRoom(s, room.id, { status: k }), () => api.setStatus(room.id, k));
  const cycle = (t) => {
    const n = NEXT[t.state];
    act((s) => patchTask(s, t.id, { state: n }), () => api.setTask(t.id, n));
  };
  const saveNote = (note) => act((s) => patchRoom(s, room.id, { note }), () => api.setNote(room.id, note));
  return (
    <section className={`kid ${room.status} ${open ? 'open' : ''}`}>
      <button className="head" onClick={onToggle}>
        <div className="t1"><span className="name">{room.name}</span><span className="pill">{ST[room.status]}</span></div>
        <div className={`line ${room.note ? '' : 'empty'}`}>{room.note || 'Chưa có cập nhật'}</div>
        <div className="meta">
          <span>{room.owners.map((o) => o.name).join(', ') || 'Chưa có người phụ trách'} · {dn}/{room.tasks.length} việc · {pc}%</span>
          <span className="chev">▾</span>
        </div>
      </button>
      <div className="body">
        <div className="bar" style={{ margin: '0 0 10px' }}><b style={{ width: `${pc}%`, background: 'var(--c)' }} /></div>
        {ed && (
          <div className="seg">
            {ORDER.map((k) => (
              <button key={k} className={`${k} ${room.status === k ? 'on' : ''}`} onClick={() => setStatus(k)}>{ST[k]}</button>
            ))}
          </div>
        )}
        {room.tasks.map((t) => (
          <div key={t.id} className={`task ${t.state}`}>
            <span className="tx">{t.text}</span>
            <button className={`ts ${t.state}`} disabled={!ed} onClick={() => cycle(t)}>{TS[t.state]}</button>
          </div>
        ))}
        {ed ? <NoteBox room={room} onSave={saveNote} /> : (
          <div className="lock">🔒 {me ? 'Chỉ người phụ trách mới sửa được' : 'Đăng nhập để cập nhật'}</div>
        )}
        <div className="lock">Cập nhật lúc {timeLabel(room.updatedAt)}{room.updatedBy ? ` · ${room.updatedBy}` : ''}</div>
      </div>
    </section>
  );
}

export default function GroupCard({ group, rooms, me, open, onToggle, openK, onToggleK, act }) {
  const c = statusCounts(group.rooms);
  const sum = [['red', 'đỏ'], ['yellow', 'vàng'], ['green', 'xanh']]
    .filter(([k]) => c[k])
    .map(([k, l]) => <b key={k} style={{ color: `var(--${k})` }}>{c[k]} {l}</b>);
  return (
    <section className={`grp ${open ? 'open' : ''}`}>
      <button className="gh" onClick={onToggle}>
        <div className="gt"><span className="gname">{group.name}</span><span className="gchev">▾</span></div>
        <div className="gsum">{group.rooms.length} khu · {sum.flatMap((x, i) => (i ? [' · ', x] : [x]))}</div>
        <div className="tags">
          {rooms.map((r) => <span key={r.id} className={`tag ${r.status}`}><i />{r.name}</span>)}
        </div>
      </button>
      <div className="kids">
        {rooms.map((r) => (
          <RoomCard key={r.id} room={r} me={me} open={openK.has(r.id)} onToggle={() => onToggleK(r.id)} act={act} />
        ))}
      </div>
    </section>
  );
}
```
{% endraw %}

- [ ] **Step 5: Viết `web/src/App.jsx`**

```jsx
import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { useLive } from './useLive.js';
import { allRooms, canEdit, statusCounts, totals } from './logic.js';
import Header from './Header.jsx';
import GroupCard from './Group.jsx';
import Manage from './Manage.jsx';

const SSO = !!import.meta.env.VITE_SSO;

function useHash() {
  const [h, setH] = useState(location.hash);
  useEffect(() => {
    const f = () => setH(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h;
}

const flip = (setter, id) => setter((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

export default function App() {
  const { state, setState, online, reload } = useLive();
  const [me, setMe] = useState(undefined); // undefined = đang tải, null = khách
  const [filter, setFilter] = useState('all');
  const [closedG, setClosedG] = useState(() => new Set()); // mặc định mở cả 3 khối
  const [openK, setOpenK] = useState(() => new Set());
  const [toast, setToast] = useState('');
  const hash = useHash();

  useEffect(() => { api.me().then(setMe).catch(() => setMe(null)); }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const act = useCallback(async (optimistic, call) => {
    setState((s) => (s ? optimistic(s) : s));
    try {
      await call();
    } catch (e) {
      if (e.status === 401) { setMe(null); setToast('Phiên đăng nhập đã hết. Hãy mở lại link đăng nhập của bạn.'); }
      else setToast(e.status === 403 ? 'Bạn không có quyền sửa khu này' : e.message);
      reload(); // hoàn lại bằng state thật của server
    }
  }, [setState, reload]);

  if (!state || me === undefined) return <p className="loading">Đang tải…</p>;
  if (hash === '#/manage' && me?.isAdmin) return <Manage state={state} say={setToast} toast={toast} />;

  const rooms = allRooms(state);
  const pass = (r) => filter === 'all' || (filter === 'mine' ? canEdit(me, r) : r.status === filter);
  const logout = () => api.logout().finally(() => { setMe(null); setFilter('all'); });

  return (
    <>
      {!online && <div className="offline">Đang kết nối lại…</div>}
      <Header me={me} online={online} counts={statusCounts(rooms)} tot={totals(rooms)} filter={filter} setFilter={setFilter} />
      <div className="chips">
        {!me && (SSO
          ? <a className="chip" href="/auth/sso/start">Đăng nhập</a>
          : <button className="chip" onClick={() => setToast('Dùng link đăng nhập được gửi riêng cho bạn')}>Đăng nhập</button>)}
        {me && <button className={`chip ${filter === 'mine' ? 'on' : ''}`} onClick={() => setFilter(filter === 'mine' ? 'all' : 'mine')}>Của tôi</button>}
        {me?.isAdmin && <a className="chip" href="#/manage">⚙ Quản lý</a>}
        {me && <button className="chip" onClick={logout}>Đăng xuất</button>}
      </div>
      <main>
        {state.groups.map((g) => {
          const rs = g.rooms.filter(pass);
          if (!rs.length) return null;
          return (
            <GroupCard
              key={g.id} group={g} rooms={rs} me={me} act={act}
              open={!closedG.has(g.id)} onToggle={() => flip(setClosedG, g.id)}
              openK={openK} onToggleK={(id) => flip(setOpenK, id)}
            />
          );
        })}
        {!rooms.some(pass) && <p className="loading">Không có khu nào</p>}
      </main>
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
```

- [ ] **Step 6: Viết `web/src/Manage.jsx` bản tạm để build được**

```jsx
export default function Manage() {
  return <p className="loading">Màn quản lý đang được làm.</p>;
}
```

- [ ] **Step 7: Build và chạy thử trên giao diện thật**

```bash
cd web && npm run build && cd ..
```

Expected: build thành công, có `web/dist/index.html`.

Bật hai server bằng `preview_start` (`backend`, rồi `web`) dựa trên `.claude/launch.json`. Lấy link đăng nhập: `DB_PATH=/tmp/et-dev.db BASE_URL=http://localhost:5173 node scripts/links.js`. Với trình duyệt trong khung Browser, thu nhỏ về `mobile` (375×812) và kiểm tra:

1. `http://localhost:5173/` (khách): 3 khối mở sẵn, ô màu + tên khu + người phụ trách + dòng text + %; không có điều khiển sửa; chấm "Realtime".
2. Mở link của `a@example.com` (đổi gốc thành `http://localhost:5173`): thanh chào "Phụ trách 2 khu vực"; chỉ "Hội trường C2" và "Sảnh C2" có nút đổi màu, nút việc, ô ghi chú; khu khác khoá.
3. Đổi màu "Sảnh C2" sang xanh: ô màu đổi ngay; mở tab thứ hai ở chế độ khách thấy đổi theo sau chưa tới 1 giây không tải lại.
4. Bấm nút việc: Chưa làm → Đang làm → Xong → Chưa làm; % khu thay đổi; **màu khu không tự đổi**.
5. Gõ ghi chú rồi rời ô: lưu; đang gõ mà tab khác đổi cùng khu: nội dung đang gõ không bị ghi đè. Ghi chú `<b>x</b> & "y"` hiển thị nguyên văn, không thành chữ đậm.
6. Tắt backend: hiện "Đang kết nối lại…" và chấm đỏ; bật lại: tự về bình thường.
7. Đăng xuất: về chế độ khách.

Sửa lỗi nào thấy thì sửa rồi lặp lại bước này; ghi kết quả từng mục.

- [ ] **Step 8: Chạy test và commit**

```bash
npm test
git add web
git commit -m "feat(web): dashboard realtime, quyền theo vai trò, cập nhật lạc quan

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Màn Quản lý cho admin

**Files:**
- Modify: `web/src/Manage.jsx` (thay bản tạm)

**Interfaces:**
- Consumes: `api.*` quản trị (Task 9), `state` realtime.
- Produces: `Manage({ state, say, toast })` hiển thị khi `#/manage` và `me.isAdmin`.

- [ ] **Step 1: Viết `web/src/Manage.jsx`**

```jsx
import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

function AddRow({ placeholder, onAdd }) {
  const [v, setV] = useState('');
  const go = () => { const s = v.trim(); if (s) { onAdd(s); setV(''); } };
  return (
    <div className="addrow">
      <input value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
      <button onClick={go}>+ Thêm</button>
    </div>
  );
}

function AddUser({ onAdd }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const go = () => { if (email.trim() && name.trim()) { onAdd({ email, name, isAdmin }); setEmail(''); setName(''); setIsAdmin(false); } };
  return (
    <div className="mg">
      <div className="mlabel">Thêm người dùng</div>
      <div className="mrow"><input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="mrow"><input placeholder="Họ tên" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <label><input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Admin</label>
      <button onClick={go}>+ Thêm người dùng</button>
    </div>
  );
}

function RoomEditor({ room, users, run, reloadUsers }) {
  const owners = users.filter((u) => u.ownedRoomIds.includes(room.id)).map((u) => u.email);
  const toggleOwner = (e) => {
    const next = owners.includes(e) ? owners.filter((x) => x !== e) : [...owners, e];
    run(() => api.setOwners(room.id, next), reloadUsers);
  };
  const rename = (e) => {
    const v = e.target.value.trim();
    if (v && v !== room.name) run(() => api.patchRoom(room.id, { name: v }));
  };
  return (
    <details className="mroom">
      <summary>{room.name} <small>({room.owners.map((o) => o.name).join(', ') || 'chưa có người phụ trách'})</small></summary>
      <div className="mrow">
        <input key={room.name} defaultValue={room.name} maxLength={80} onBlur={rename} />
        <button onClick={() => confirm(`Xoá khu "${room.name}" và toàn bộ checklist?`) && run(() => api.delRoom(room.id), reloadUsers)}>Xoá khu</button>
      </div>
      <div className="mlabel">Người phụ trách</div>
      <div className="mchecks">
        {users.map((u) => (
          <label key={u.email}><input type="checkbox" checked={owners.includes(u.email)} onChange={() => toggleOwner(u.email)} /> {u.name}</label>
        ))}
      </div>
      <div className="mlabel">Checklist</div>
      {room.tasks.map((t) => (
        <div className="mrow" key={`${t.id}-${t.text}`}>
          <input
            defaultValue={t.text} maxLength={200}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.text) run(() => api.patchTaskText(t.id, v)); }}
          />
          <button onClick={() => run(() => api.delTask(t.id))}>✕</button>
        </div>
      ))}
      <AddRow placeholder="Việc mới" onAdd={(text) => run(() => api.addTask(room.id, text))} />
    </details>
  );
}

export default function Manage({ state, say, toast }) {
  const [users, setUsers] = useState([]);
  const [link, setLink] = useState(null);

  const loadUsers = useCallback(() => api.users().then(setUsers).catch((e) => say(e.message)), [say]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const run = async (fn, after) => {
    try { await fn(); if (after) await after(); } catch (e) { say(e.message); }
  };

  const makeLink = async (u) => {
    if (u.hasToken && !confirm('Tạo link mới sẽ vô hiệu link cũ của người này. Tiếp tục?')) return;
    await run(async () => { const r = await api.userLink(u.email); setLink({ name: u.name, url: r.url }); }, loadUsers);
  };

  return (
    <div className="mpage">
      <a className="back" href="#/">← Về dashboard</a>
      <h2>Khu vực</h2>
      {state.groups.map((g) => (
        <section className="mg" key={`${g.id}-${g.name}`}>
          <div className="mrow">
            <input
              defaultValue={g.name} maxLength={80}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== g.name) run(() => api.patchGroup(g.id, { name: v })); }}
            />
            <button disabled={g.rooms.length > 0} onClick={() => confirm(`Xoá khối "${g.name}"?`) && run(() => api.delGroup(g.id))}>Xoá khối</button>
          </div>
          {g.rooms.map((r) => <RoomEditor key={r.id} room={r} users={users} run={run} reloadUsers={loadUsers} />)}
          <AddRow placeholder="Tên khu mới" onAdd={(name) => run(() => api.addRoom(g.id, name))} />
        </section>
      ))}
      <div className="mg"><AddRow placeholder="Tên khối mới" onAdd={(name) => run(() => api.addGroup(name))} /></div>

      <h2>Người dùng</h2>
      <div className="mg">
        {users.map((u) => (
          <div className="muser" key={u.email}>
            <div><b>{u.name}</b><br /><small>{u.email}</small></div>
            <label>
              <input type="checkbox" checked={u.isAdmin} onChange={(e) => run(() => api.patchUser(u.email, { isAdmin: e.target.checked }), loadUsers)} /> Admin
            </label>
            <button onClick={() => makeLink(u)}>{u.hasToken ? 'Link mới' : 'Tạo link'}</button>
            <button onClick={() => confirm(`Xoá ${u.name}?`) && run(() => api.delUser(u.email), loadUsers)}>Xoá</button>
          </div>
        ))}
        {link && (
          <div className="mlink">
            <small>Link đăng nhập của {link.name} (chỉ hiện một lần, link cũ đã vô hiệu):</small>
            <div className="mrow">
              <input readOnly value={link.url} onFocus={(e) => e.target.select()} />
              <button onClick={() => navigator.clipboard?.writeText(link.url).then(() => say('Đã copy link'))}>Copy</button>
            </div>
          </div>
        )}
      </div>
      <AddUser onAdd={(u) => run(() => api.addUser(u), loadUsers)} />
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `cd web && npm run build`
Expected: thành công.

- [ ] **Step 3: Kiểm tra trên giao diện thật** (backend + web đang chạy như Task 9, đăng nhập bằng link của admin, khung 375 px)

1. Chip "⚙ Quản lý" mở `#/manage`; "← Về dashboard" quay lại.
2. Thêm khối mới, thêm khu vào khối đó: dashboard (tab khác) xuất hiện khối/khu mới màu đỏ ngay.
3. Khu mới: tick một người phụ trách → đăng nhập bằng link người đó thấy khu trong "Của tôi" và sửa được.
4. Thêm việc, sửa chữ của việc, xoá việc.
5. Thêm người dùng mới, "Tạo link": hiện URL, Copy; tạo lại thì link cũ báo `/?login=failed`.
6. Khối còn khu: nút "Xoá khối" mờ. Admin tự bỏ tick Admin của mình: hiện thông báo lỗi (400), không đổi.
7. Người phụ trách (không admin) gõ `#/manage` trên URL: vẫn thấy dashboard thường.

- [ ] **Step 4: Commit**

```bash
git add web/src/Manage.jsx
git commit -m "feat(web): màn quản lý cho admin

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Phát hành frontend, kiểm tra thực tế trên VM

**Files:**
- Modify: (không sửa code; chỉ PR + kiểm tra)

- [ ] **Step 1: Chạy toàn bộ test và build lần cuối**

```bash
npm test && (cd web && npm ci && npm run build)
```

Expected: PASS và build xong.

- [ ] **Step 2: Đẩy nhánh, mở PR 2, chờ `build` xanh, merge**

```bash
git push -u origin feat/web
gh pr create --base main --head feat/web --title "Frontend React: dashboard realtime và màn quản lý" --body "Theo docs/superpowers/plans/2026-10-12-event-tracker.md (Phase 2).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch
gh pr merge --squash --delete-branch
```

Merge kích hoạt deploy: tải artifact `web-dist`, rsync `web/dist` lên `/opt/event-tracker/web/`, restart backend, kiểm tra `/api/state` = 200 (phải xanh).

- [ ] **Step 3: Kiểm tra trên VM**

```bash
curl -s -o /dev/null -w '/ -> %{http_code}\n' http://168.107.75.89/
curl -s http://168.107.75.89/ | grep -o '<title>[^<]*'
curl -s -o /dev/null -w '/assets -> %{http_code}\n' "http://168.107.75.89$(curl -s http://168.107.75.89/ | grep -o '/assets/[^"]*\.js' | head -1)"
curl -s -N -m 3 http://168.107.75.89/events | head -c 120; echo
curl -s -X PATCH http://168.107.75.89/api/rooms/1/status -H 'Content-Type: application/json' -d '{"status":"green"}' -w ' (%{http_code})\n'
```

Expected: `/ -> 200`, title "Theo dõi sự kiện", asset 200, SSE trả `data: {"version":1,...`, khách ghi → `{"error":"unauthorized",...} (401)`.

Dùng Browser pane ở 375×812 mở `http://168.107.75.89/`, lặp lại các kiểm tra Task 9 (khách), rồi mở link đăng nhập (đổi gốc thành `http://168.107.75.89`) kiểm tra người phụ trách và admin. Kiểm tra bằng điện thoại thật khi có.

- [ ] **Step 4: Dặn việc còn lại cho người dùng**

Báo: (a) DNS `sk.hust.edu.vn` → `168.107.75.89` rồi em chạy certbot; (b) dữ liệu thật: nhập qua màn Quản lý hoặc cung cấp `seed.json` thật (xoá `/var/lib/event-tracker/app.db*` rồi restart để nạp lại — chỉ làm khi người dùng đồng ý vì mất dữ liệu đã nhập); (c) SSO: cần giao thức, client id/secret từ anh Tùng, viết `auth/sso.js` và đăng ký vào `routes/auth.js` thay hai route trả 501.

---

## Self-Review (đã chạy)

**Phủ spec:** mục 4 TECH.md (bảng API): `state`, `events`, `me`, 3 API chủ khu (Task 5), nhóm API admin + users + token (Task 6), `/auth/*` (Task 4). Schema mục 3 (Task 1). Seed/E1 (Task 7). UI mục 6 TECH.md và hành vi 1–10 API.md: mở sẵn 3 khối, 4 thông tin luôn thấy, lọc theo màu/"Của tôi", cập nhật lạc quan, không ghi đè khi gõ, thanh kết nối lại, 44 px (Task 9); màn Quản lý (Task 10). Deploy/CI (Task 7, 11). Khoảng trống chủ ý: SSO (`B1`) chờ thông tin anh Tùng; HTTPS chờ DNS; backend không phục vụ `dist/` (nginx làm, khác API.md mục 8 — đã đúng với VM thực tế).

**Placeholder:** không còn TBD/TODO; mọi bước code có mã đầy đủ.

**Nhất quán kiểu:** `roomView`/`taskView` (Task 2) dùng ở Task 5/6; `canEdit(me, room)` dùng `me.ownedRoomIds`, `me.isAdmin` khớp `/api/me` (Task 4); `act(optimistic, call)` ở Task 9 dùng `patchRoom/patchTask` của Task 8; `api.*` khớp tên route Task 5/6; `lib/app.js` đăng ký `registerPublic/Auth/Rooms/Admin` đủ 4 lần qua Task 3–6.

**Review Focus:** (1) Task 2 + Task 5; (2) Task 4; (3) Task 5; (4) Task 6; (5) Task 3 + Task 5; (6) Task 5 (ghi chú `<b>"A"</b> &`) + Task 9 bước kiểm tra 5.
