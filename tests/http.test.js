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

test('readJson: quá giới hạn → 413 và ngắt luồng khi vượt ngưỡng cứng', async () => {
  await assert.rejects(readJson(req('{"a":"' + 'x'.repeat(100) + '"}'), 50), (e) => e.status === 413);
  let destroyed = false;
  const big = Readable.from([Buffer.from('x'.repeat(300))]);
  big.destroy = () => { destroyed = true; };
  await assert.rejects(readJson(big, 50), (e) => e.status === 413);
  assert.equal(destroyed, true);
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

test('checkOrigin: GET bỏ qua, không có Origin/Referer ok, khác host → 403', () => {
  checkOrigin({ method: 'GET', headers: { origin: 'http://evil.test', host: 'a.vn' } });
  checkOrigin({ method: 'POST', headers: { host: 'a.vn' } });
  checkOrigin({ method: 'POST', headers: { origin: 'https://a.vn', host: 'a.vn' } });
  checkOrigin({ method: 'POST', headers: { referer: 'https://a.vn/page', host: 'a.vn' } });
  assert.throws(() => checkOrigin({ method: 'POST', headers: { origin: 'http://evil.test', host: 'a.vn' } }), (e) => e.status === 403);
  assert.throws(() => checkOrigin({ method: 'POST', headers: { referer: 'http://evil.test/x', host: 'a.vn' } }), (e) => e.status === 403);
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
