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

test('sửa nội dung việc: chủ khu khu mình và admin được; khu khác 403; khách 401; rỗng/quá dài 400', async () => {
  const t = await startApp();
  try {
    const ok = await t.call('PATCH', '/api/tasks/1', { as: 'owner@t.test', body: { text: 'Sắp xếp 600 ghế' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.text, 'Sắp xếp 600 ghế');
    assert.equal(room((await t.call('GET', '/api/state')).body, 1).updatedBy, 'Chủ Khu');
    const both = await t.call('PATCH', '/api/tasks/1', { as: 'owner@t.test', body: { text: 'Ghế VIP', state: 'done' } });
    assert.equal(both.body.state, 'done');
    assert.equal(both.body.text, 'Ghế VIP');
    assert.equal((await t.call('PATCH', '/api/tasks/4', { as: 'owner@t.test', body: { text: 'Hack' } })).status, 403);
    assert.equal((await t.call('PATCH', '/api/tasks/1', { as: 'nobody@t.test', body: { text: 'Hack' } })).status, 403);
    assert.equal((await t.call('PATCH', '/api/tasks/1', { body: { text: 'Hack' } })).status, 401);
    assert.equal((await t.call('PATCH', '/api/tasks/1', { as: 'owner@t.test', body: { text: '  ' } })).status, 400);
    assert.equal((await t.call('PATCH', '/api/tasks/1', { as: 'owner@t.test', body: { text: 'x'.repeat(201) } })).status, 400);
    assert.equal((await t.call('PATCH', '/api/tasks/4', { as: 'admin@t.test', body: { text: 'Rào chắn 2' } })).status, 200);
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

test('chủ khu thêm/xoá việc trong khu mình; khu khác 403; khách 401; không có khu 403', async () => {
  const t = await startApp();
  try {
    const r = await t.call('POST', '/api/rooms/1/tasks', { as: 'owner@t.test', body: { text: 'Việc do chủ khu thêm' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.text, 'Việc do chủ khu thêm');
    assert.equal(room((await t.call('GET', '/api/state')).body, 1).tasks.at(-1).text, 'Việc do chủ khu thêm');
    assert.equal((await t.call('POST', '/api/rooms/3/tasks', { as: 'owner@t.test', body: { text: 'x' } })).status, 403);
    assert.equal((await t.call('POST', '/api/rooms/1/tasks', { as: 'nobody@t.test', body: { text: 'x' } })).status, 403);
    assert.equal((await t.call('POST', '/api/rooms/1/tasks', { body: { text: 'x' } })).status, 401);
    assert.equal((await t.call('POST', '/api/rooms/1/tasks', { as: 'owner@t.test', body: { text: ' ' } })).status, 400);
    assert.equal((await t.call('POST', '/api/rooms/1/tasks', { as: 'owner@t.test', body: { text: 'x'.repeat(201) } })).status, 400);
    assert.equal((await t.call('POST', '/api/rooms/999/tasks', { as: 'owner@t.test', body: { text: 'x' } })).status, 404);

    // xoá: việc khu khác 403, việc khu mình xoá được
    assert.equal((await t.call('DELETE', '/api/tasks/4', { as: 'owner@t.test' })).status, 403);
    assert.equal((await t.call('DELETE', '/api/tasks/4')).status, 401);
    assert.equal((await t.call('DELETE', `/api/tasks/${r.body.id}`, { as: 'owner@t.test' })).status, 200);
    assert.equal((await t.call('DELETE', `/api/tasks/${r.body.id}`, { as: 'owner@t.test' })).status, 404);
    assert.equal(room((await t.call('GET', '/api/state')).body, 1).tasks.length, 2);
  } finally { await t.close(); }
});

test('thêm/xoá việc cập nhật "cập nhật lúc/bởi" của khu và phát realtime', async () => {
  const t = await startApp();
  try {
    const sse = await openSse(t.base);
    await sse.next();
    await t.call('POST', '/api/rooms/1/tasks', { as: 'owner@t.test', body: { text: 'Mới' } });
    const st = await sse.next();
    assert.equal(room(st, 1).tasks.length, 3);
    assert.equal(room(st, 1).updatedBy, 'Chủ Khu');
    sse.abort();
  } finally { await t.close(); }
});

test('điểm danh và sĩ số: cập nhật, chặn khi chưa đủ 2/3 hoặc chưa đủ giấy tờ', async () => {
  const t = await startApp();
  try {
    // 1. Cập nhật sĩ số: khách 401, chủ phòng được
    assert.equal((await t.call('PATCH', '/api/rooms/1/attendance', { body: { attendees: 20, totalMembers: 30 } })).status, 401);
    const rAtt = await t.call('PATCH', '/api/rooms/1/attendance', { as: 'owner@t.test', body: { attendees: 15, totalMembers: 30 } });
    assert.equal(rAtt.status, 200);
    assert.equal(rAtt.body.attendees, 15);
    assert.equal(rAtt.body.totalMembers, 30);

    // 2. 15/30 = 50% (< 2/3) -> Đổi sang yellow bị chặn 400
    const rFailAtt = await t.call('PATCH', '/api/rooms/1/status', { as: 'owner@t.test', body: { status: 'yellow' } });
    assert.equal(rFailAtt.status, 400);
    assert.equal(rFailAtt.body.error, 'attendance_not_met');

    // 3. Cập nhật đủ 20/30 (2/3) nhưng task chưa 100% done (room 1 có 1 todo, 1 done)
    await t.call('PATCH', '/api/rooms/1/attendance', { as: 'owner@t.test', body: { attendees: 20, totalMembers: 30 } });
    const rFailTask = await t.call('PATCH', '/api/rooms/1/status', { as: 'owner@t.test', body: { status: 'yellow' } });
    assert.equal(rFailTask.status, 400);
    assert.equal(rFailTask.body.error, 'checklist_incomplete');

    // 4. Hoàn thành task còn lại (task 1: 'Sắp xếp ghế')
    await t.call('PATCH', '/api/tasks/1', { as: 'owner@t.test', body: { state: 'done' } });

    // 5. Bây giờ đủ cả 2 điều kiện -> Đổi sang yellow thành công
    const rOk = await t.call('PATCH', '/api/rooms/1/status', { as: 'owner@t.test', body: { status: 'yellow' } });
    assert.equal(rOk.status, 200);
    assert.equal(rOk.body.status, 'yellow');

    // 6. Admin có thể override dù điều kiện chưa đủ
    await t.call('PATCH', '/api/rooms/2/attendance', { as: 'owner@t.test', body: { attendees: 5, totalMembers: 40 } });
    const rAdmin = await t.call('PATCH', '/api/rooms/2/status', { as: 'admin@t.test', body: { status: 'green' } });
    assert.equal(rAdmin.status, 200);
    assert.equal(rAdmin.body.status, 'green');
  } finally { await t.close(); }
});

