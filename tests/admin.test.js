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
      ['PUT', '/api/rooms/1/owners', { emails: [] }],
      ['GET', '/api/users'], ['POST', '/api/users', { email: 'n@t.test', name: 'N' }],
      ['PATCH', '/api/users/owner@t.test', { name: 'N' }], ['DELETE', '/api/users/owner@t.test'], ['POST', '/api/users/owner@t.test/token'],
    ];
    for (const [m, p, b] of calls) {
      assert.equal((await t.call(m, p, { body: b })).status, 401, `khách ${m} ${p}`);
      assert.equal((await t.call(m, p, { body: b, as: 'owner@t.test' })).status, 403, `thường ${m} ${p}`);
    }
    assert.equal((await state(t)).groups.length, 2);
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
    assert.equal(rooms(await state(t)).find((r) => r.id === 3).owners.length, 2);
    assert.deepEqual((await t.call('PUT', '/api/rooms/3/owners', { as: A, body: { emails: [] } })).body.emails, []);
    assert.equal((await t.call('PUT', '/api/rooms/999/owners', { as: A, body: { emails: [] } })).status, 404);
    await t.call('PUT', '/api/rooms/3/owners', { as: A, body: { emails: ['nobody@t.test'] } });
    assert.equal((await t.call('PATCH', '/api/rooms/3/status', { as: 'nobody@t.test', body: { status: 'green' } })).status, 200);
    const byNames = await t.call('PUT', '/api/rooms/3/owners', { as: A, body: { names: ['Chủ Khu', 'Trần Quốc Tuấn'] } });
    assert.equal(byNames.status, 200);
    assert.deepEqual(rooms(await state(t)).find((r) => r.id === 3).owners.map((o) => o.name), ['Chủ Khu', 'Trần Quốc Tuấn']);
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
    assert.deepEqual(o, {
      email: 'owner@t.test',
      name: 'Chủ Khu',
      isAdmin: false,
      role: 'room_lead',
      assignedUnits: [],
      assignedGroupIds: [],
      assignedRoomIds: [1, 2],
      ownedRoomIds: [1, 2],
      hasToken: false,
    });
    const n = await t.call('POST', '/api/users', { as: A, body: { email: ' Moi@T.test ', name: 'Người Mới', isAdmin: false } });
    assert.deepEqual(n.body, {
      email: 'moi@t.test',
      name: 'Người Mới',
      isAdmin: false,
      role: 'room_lead',
      assignedUnits: [],
      assignedGroupIds: [],
      assignedRoomIds: [],
      ownedRoomIds: [],
      hasToken: false,
    });
    assert.equal((await t.call('POST', '/api/users', { as: A, body: { email: 'moi@t.test', name: 'Lại' } })).status, 409);
    assert.equal((await t.call('POST', '/api/users', { as: A, body: { email: 'sai', name: 'X' } })).status, 400);
    const p = await t.call('PATCH', '/api/users/moi%40t.test', { as: A, body: { name: 'Tên Khác', isAdmin: true } });
    assert.deepEqual({ name: p.body.name, isAdmin: p.body.isAdmin, role: p.body.role }, { name: 'Tên Khác', isAdmin: true, role: 'admin' });
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

test('tài khoản admin vĩnh viễn: không thể xoá, không thể hạ quyền, luôn có quyền admin', async () => {
  const t = await startApp();
  try {
    const P = 'bach.pv2414676@sis.hust.edu.vn';
    t.db.prepare("INSERT OR IGNORE INTO users(email, name, is_admin, role) VALUES (?, 'Phạm Việt Bách', 1, 'admin')").run(P);

    const dem = await t.call('PATCH', `/api/users/${encodeURIComponent(P)}`, { as: A, body: { role: 'room_lead' } });
    assert.deepEqual([dem.status, dem.body.error], [400, 'cannot_demote_permanent_admin']);

    const del = await t.call('DELETE', `/api/users/${encodeURIComponent(P)}`, { as: A });
    assert.deepEqual([del.status, del.body.error], [400, 'cannot_delete_permanent_admin']);

    const cookie = t.cookieFor(P);
    const me = await t.call('GET', '/api/me', { cookie });
    assert.equal(me.status, 200);
    assert.equal(me.body.role, 'admin');
    assert.equal(me.body.isAdmin, true);
  } finally { await t.close(); }
});

test('link đăng nhập riêng: tạo mới vô hiệu link cũ, link mới dùng được, không lộ qua state', async () => {
  const t = await startApp();
  try {
    const r1 = await t.call('POST', '/api/users/owner%40t.test/token', { as: A });
    assert.match(r1.body.url, /^http:\/\/localhost\/auth\/token\?t=[A-Za-z0-9_-]{43}$/);
    const tok1 = new URL(r1.body.url).searchParams.get('t');
    assert.equal((await t.call('GET', `/auth/token?t=${tok1}`)).status, 302);
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

test('phân quyền theo vai trò: unit_lead, floor_lead, reset-password', async () => {
  const t = await startApp();
  try {
    // 1. Tạo unit_lead
    const uLead = await t.call('POST', '/api/users', {
      as: A,
      body: {
        email: 'unitlead@t.test',
        name: 'Trưởng Đơn Vị',
        role: 'unit_lead',
        assignedUnits: ['Trường CNTT & TT'],
      },
    });
    assert.equal(uLead.status, 200);
    assert.equal(uLead.body.role, 'unit_lead');
    assert.deepEqual(uLead.body.assignedUnits, ['Trường CNTT & TT']);

    // 2. Tạo floor_lead
    const fLead = await t.call('POST', '/api/users', {
      as: A,
      body: {
        email: 'floorlead@t.test',
        name: 'Trưởng Tầng',
        role: 'floor_lead',
        assignedGroupIds: [1],
      },
    });
    assert.equal(fLead.status, 200);
    assert.equal(fLead.body.role, 'floor_lead');
    assert.deepEqual(fLead.body.assignedGroupIds, [1]);

    // 3. Reset password
    const resetRes = await t.call('POST', '/api/users/unitlead%40t.test/reset-password', { as: A });
    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.ok, true);

    // Kiểm tra đăng nhập bằng mật khẩu mặc định mới reset
    const loginRes = await t.call('POST', '/api/auth/login', {
      body: { email: 'unitlead@t.test', password: 'Abc@123456767' },
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.user.email, 'unitlead@t.test');

    // 4. Floor lead can edit room in their group (group 1 has room 1 and 2 in seed)
    const patchOk = await t.call('PATCH', '/api/rooms/1/note', {
      as: 'floorlead@t.test',
      body: { note: 'Cập nhật bởi floor lead' },
    });
    assert.equal(patchOk.status, 200);

    // Floor lead cannot edit room in another group (room 3 belongs to group 2)
    const patchFail = await t.call('PATCH', '/api/rooms/3/note', {
      as: 'floorlead@t.test',
      body: { note: 'Không được phép' },
    });
    assert.equal(patchFail.status, 403);
  } finally { await t.close(); }
});
