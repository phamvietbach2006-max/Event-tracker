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

test('màu không hợp lệ → 400; khu không tồn tại → 404', async () => {
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
