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
