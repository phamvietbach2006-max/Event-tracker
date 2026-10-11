import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, openSse } from './helpers.js';

const tokenOf = (url) => new URL(url).searchParams.get('t');
const cookieOf = (res) => res.headers.get('set-cookie')?.split(';')[0];
const room = (state, id) => state.groups.flatMap((g) => g.rooms).find((r) => r.id === id);

// UC5 → UC2 → UC3 → UC4 → UC6: luồng end-to-end trước ngày sự kiện
test('e2e: admin cấu hình → cấp link → chủ khu cập nhật → khách thấy realtime → bị chặn khu khác → thu hồi', async () => {
  const t = await startApp({ users: [{ email: 'admin@t.test', name: 'Admin', isAdmin: true }], groups: [] });
  try {
    const A = { as: 'admin@t.test' };
    const g = (await t.call('POST', '/api/groups', { ...A, body: { name: 'Khối mới' } })).body;
    const rx = (await t.call('POST', `/api/groups/${g.id}/rooms`, { ...A, body: { name: 'Khu X' } })).body;
    const ry = (await t.call('POST', `/api/groups/${g.id}/rooms`, { ...A, body: { name: 'Khu Y' } })).body;
    const task = (await t.call('POST', `/api/rooms/${rx.id}/tasks`, { ...A, body: { text: 'Việc 1' } })).body;
    assert.equal((await t.call('POST', '/api/users', { ...A, body: { email: 'a@t.test', name: 'Chủ A' } })).status, 200);
    assert.equal((await t.call('PUT', `/api/rooms/${rx.id}/owners`, { ...A, body: { emails: ['a@t.test'] } })).status, 200);

    // UC2: link → đăng nhập
    const link = await t.call('POST', '/api/users/a@t.test/token', A);
    const login = await t.call('GET', `/auth/token?t=${tokenOf(link.body.url)}`);
    assert.equal(login.status, 302);
    assert.equal(login.headers.get('location'), '/');
    const cookie = cookieOf(login);
    assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
    const me = await t.call('GET', '/api/me', { cookie });
    assert.deepEqual(me.body.ownedRoomIds, [rx.id]);

    // UC4: khách nhận realtime khi chủ khu sửa
    const guest = await openSse(t.base);
    await guest.next();
    assert.equal((await t.call('PATCH', `/api/rooms/${rx.id}/status`, { cookie, body: { status: 'green' } })).status, 200);
    assert.equal((await t.call('PATCH', `/api/rooms/${rx.id}/note`, { cookie, body: { note: 'Đã xong' } })).status, 200);
    let st;
    for (let i = 0; i < 3; i++) { st = await guest.next(); if (room(st, rx.id).note === 'Đã xong') break; }
    assert.equal(room(st, rx.id).status, 'green');
    assert.equal(room(st, rx.id).updatedBy, 'Chủ A');
    guest.abort();

    // UC3: tick việc; UC6: khu khác / quản trị / sửa nội dung → 403
    assert.equal((await t.call('PATCH', `/api/tasks/${task.id}`, { cookie, body: { state: 'done' } })).status, 200);
    assert.equal((await t.call('PATCH', `/api/rooms/${ry.id}/status`, { cookie, body: { status: 'red' } })).status, 403);
    assert.equal((await t.call('POST', '/api/groups', { cookie, body: { name: 'x' } })).status, 403);
    assert.equal((await t.call('PATCH', `/api/tasks/${task.id}`, { cookie, body: { text: 'đổi chữ' } })).status, 403);

    // Link mới → link cũ hết hiệu lực
    const link2 = await t.call('POST', '/api/users/a@t.test/token', A);
    assert.equal((await t.call('GET', `/auth/token?t=${tokenOf(link.body.url)}`)).headers.get('location'), '/?login=failed');
    assert.equal((await t.call('GET', `/auth/token?t=${tokenOf(link2.body.url)}`)).status, 302);

    // Đăng xuất → 401
    assert.equal((await t.call('POST', '/auth/logout', { cookie })).status, 204);
    assert.equal((await t.call('PATCH', `/api/rooms/${rx.id}/status`, { cookie, body: { status: 'red' } })).status, 401);

    // Xoá người dùng → phiên đang có mất quyền
    const c2 = cookieOf(await t.call('GET', `/auth/token?t=${tokenOf(link2.body.url)}`));
    assert.equal((await t.call('DELETE', '/api/users/a@t.test', A)).status, 200);
    assert.equal((await t.call('PATCH', `/api/rooms/${rx.id}/status`, { cookie: c2, body: { status: 'red' } })).status, 401);
  } finally { await t.close(); }
});

// UC4: nhiều máy cùng nhận một cập nhật
test('realtime: 50 client SSE đều nhận bản cập nhật sau một lần sửa', async () => {
  const t = await startApp();
  try {
    const clients = await Promise.all(Array.from({ length: 50 }, async () => { const c = await openSse(t.base); await c.next(); return c; }));
    assert.equal((await t.call('PATCH', '/api/rooms/1/status', { as: 'owner@t.test', body: { status: 'red' } })).status, 200);
    const got = await Promise.all(clients.map((c) => c.next(3000)));
    assert.ok(got.every((s) => room(s, 1).status === 'red'));
    clients.forEach((c) => c.abort());
  } finally { await t.close(); }
});

// UC8-02: nhiều người sửa đồng thời không mất dữ liệu
test('đồng thời: 200 yêu cầu ghi song song, kết quả cuối khớp', async () => {
  const t = await startApp();
  try {
    const colors = ['red', 'yellow', 'green'];
    const res = [];
    for (let b = 0; b < 8; b++) { // 8 đợt × 25 yêu cầu song song (client fetch của Node reset kết nối khi mở quá nhiều cùng lúc)
      res.push(...await Promise.all(Array.from({ length: 25 }, (_, i) =>
        t.call('PATCH', i % 2 ? '/api/rooms/1/status' : '/api/rooms/2/status', { as: 'owner@t.test', body: { status: colors[(b + i) % 3] } }))));
    }
    assert.ok(res.every((r) => r.status === 200), 'mọi yêu cầu phải 200');
    const st = (await t.call('GET', '/api/state')).body;
    assert.ok(colors.includes(room(st, 1).status) && colors.includes(room(st, 2).status));
    // ghi chú cuối cùng của cùng một khu: giá trị cuối phải là một trong các giá trị đã gửi
    await Promise.all(Array.from({ length: 50 }, (_, i) => t.call('PATCH', '/api/rooms/1/note', { as: 'owner@t.test', body: { note: `n${i}` } })));
    assert.match(room((await t.call('GET', '/api/state')).body, 1).note, /^n\d+$/);
  } finally { await t.close(); }
});

test('chống tấn công cơ bản: XSS lưu nguyên văn, Origin lạ bị chặn, JSON hỏng → 400', async () => {
  const t = await startApp();
  try {
    const xss = '<img src=x onerror=alert(1)>';
    await t.call('PATCH', '/api/rooms/1/note', { as: 'owner@t.test', body: { note: xss } });
    assert.equal(room((await t.call('GET', '/api/state')).body, 1).note, xss);
    const bad = await t.call('PATCH', '/api/rooms/1/status', { as: 'owner@t.test', headers: { origin: 'http://evil.example' }, body: { status: 'red' } });
    assert.ok([400, 403].includes(bad.status));
    assert.equal((await t.call('PATCH', '/api/rooms/1/status', { as: 'owner@t.test', raw: '{hỏng' })).status, 400);
  } finally { await t.close(); }
});
