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

test('nhật ký hoạt động (GET /api/admin/logs): ghi lại đầy đủ ai làm, lúc mấy giờ, ở vị trí nào', async () => {
  const t = await startApp();
  try {

    // Khách không được xem logs (401), cán bộ thường không được xem (403)
    assert.equal((await t.call('GET', '/api/admin/logs')).status, 401);
    assert.equal((await t.call('GET', '/api/admin/logs', { as: 'owner@t.test' })).status, 403);

    // Cán bộ thực hiện thao tác trên phòng 1
    await t.call('PATCH', '/api/rooms/1/note', { as: 'owner@t.test', body: { note: 'Kiểm tra giấy tờ đợt 1' } });
    await t.call('POST', '/api/rooms/1/lock', { as: 'owner@t.test' });

    // Admin xem nhật ký
    const rLogs = await t.call('GET', '/api/admin/logs', { as: 'admin@t.test' });
    assert.equal(rLogs.status, 200);
    assert.ok(Array.isArray(rLogs.body.logs));
    assert.ok(rLogs.body.logs.length >= 2);

    const lockLog = rLogs.body.logs.find((l) => l.action === 'room.lock');
    assert.ok(lockLog);
    assert.equal(lockLog.email, 'owner@t.test');
    assert.ok(lockLog.ts > 0);
    assert.ok(lockLog.location.includes('Lớp'));

    // Tìm kiếm nhật ký theo q
    const rSearch = await t.call('GET', '/api/admin/logs?q=owner', { as: 'admin@t.test' });
    assert.equal(rSearch.status, 200);
    assert.ok(rSearch.body.logs.every((l) => l.email?.includes('owner') || l.userName?.toLowerCase().includes('owner')));

    // Lọc theo action
    const rAction = await t.call('GET', '/api/admin/logs?action=room.lock', { as: 'admin@t.test' });
    assert.equal(rAction.status, 200);
    assert.ok(rAction.body.logs.every((l) => l.action === 'room.lock'));
  } finally { await t.close(); }
});

test('nhập hàng loạt lớp theo Đơn vị (POST /api/units/import): xử lý dữ liệu lớn (100+ lớp, 1000+ việc) nhanh chóng và thay thế dữ liệu', async () => {
  const t = await startApp();
  try {
    // 1. Tạo payload giả lập Trường CNTT & TT với 10 tầng, mỗi tầng 10 lớp = 100 lớp, mỗi lớp 10 việc = 1000 việc
    const sampleGroups = [];
    for (let f = 1; f <= 10; f++) {
      const roomsList = [];
      for (let c = 1; c <= 10; c++) {
        roomsList.push({
          name: `[Kíp 1 · B1-${f}0${c}] CNTT-TT ${f}0${c}-K71`,
          owners: [`Cán bộ Trực ${f}`, `Kiểm tra Viên ${c}`],
          tasks: Array.from({ length: 10 }, (_, i) => `Nhiệm vụ kiểm tra ${i + 1}`),
        });
      }
      sampleGroups.push({
        floorName: `Tầng ${f} Nhà B1`,
        rooms: roomsList,
      });
    }

    const tStart = Date.now();
    const res = await t.call('POST', '/api/units/import', {
      as: A,
      body: {
        unit: 'Trường CNTT & TT',
        replace: false,
        groups: sampleGroups,
      },
    });
    const duration = Date.now() - tStart;
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.unit, 'Trường CNTT & TT');
    assert.equal(res.body.importedGroups, 10);
    assert.equal(res.body.importedRooms, 100);
    assert.ok(duration < 3000, `Import 100 lớp phải hoàn thành nhanh (< 3s), thực tế: ${duration}ms`);

    // 2. Kiểm tra dữ liệu trong DB
    const cnttGroups = t.db.prepare("SELECT COUNT(*) AS n FROM groups WHERE name LIKE '[Trường CNTT & TT]%'").get().n;
    assert.equal(cnttGroups, 10);
    const cnttRooms = t.db.prepare("SELECT COUNT(*) AS n FROM rooms WHERE name LIKE '%CNTT-TT%'").get().n;
    assert.equal(cnttRooms, 100);
    const cnttTasks = t.db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE text LIKE 'Nhiệm vụ kiểm tra%'").get().n;
    assert.equal(cnttTasks, 1000);

    // 3. Test tính năng 'replace: true' thay thế toàn bộ dữ liệu đơn vị Trường CNTT & TT
    const replaceGroups = [
      {
        floorName: 'Tầng 1 Nhà B1',
        rooms: [
          {
            name: '[Kíp 2 · B1-101] Khoa học Máy tính 01-K70',
            owners: ['Cán bộ Mới'],
            tasks: ['Kiểm tra tư cách đại biểu', 'Kiểm tra hòm phiếu'],
          },
        ],
      },
    ];

    const resReplace = await t.call('POST', '/api/units/import', {
      as: A,
      body: {
        unit: 'Trường CNTT & TT',
        replace: true,
        groups: replaceGroups,
      },
    });
    assert.equal(resReplace.status, 200);
    assert.equal(resReplace.body.importedGroups, 1);
    assert.equal(resReplace.body.importedRooms, 1);

    // Dữ liệu cũ của Trường CNTT & TT phải được xóa sạch và chỉ còn lại 1 lớp mới
    const cnttGroupsAfter = t.db.prepare("SELECT COUNT(*) AS n FROM groups WHERE name LIKE '[Trường CNTT & TT]%'").get().n;
    assert.equal(cnttGroupsAfter, 1);
    const cnttRoomsAfter = t.db.prepare("SELECT COUNT(*) AS n FROM rooms WHERE name LIKE '%Khoa học Máy tính%'").get().n;
    assert.equal(cnttRoomsAfter, 1);
    const oldRoomsAfter = t.db.prepare("SELECT COUNT(*) AS n FROM rooms WHERE name LIKE '%CNTT-TT%'").get().n;
    assert.equal(oldRoomsAfter, 0);
  } finally { await t.close(); }
});

test('reset hệ thống: chỉ tài khoản admin vĩnh viễn Phạm Việt Bách, mật khẩu chính xác, làm mới toàn bộ kết quả/logs/thông báo', async () => {
  const t = await startApp();
  const P = 'bach.pv2414676@sis.hust.edu.vn';

  try {
    // Thêm tài khoản Admin vĩnh viễn Phạm Việt Bách
    t.db.prepare("INSERT INTO users(email, name, is_admin, role) VALUES (?, 'Phạm Việt Bách', 1, 'admin')").run(P);

    // 1. Khách / Người dùng thường gọi API -> 401 / 403
    const rGuest = await t.call('POST', '/api/admin/system-reset', { body: { password: 'Việt Bách đẹp trai nhất vũ trụ' } });
    assert.equal(rGuest.status, 401);

    const rOfficer = await t.call('POST', '/api/admin/system-reset', { as: 'owner@t.test', body: { password: 'Việt Bách đẹp trai nhất vũ trụ' } });
    assert.equal(rOfficer.status, 403);

    // 2. Admin thường (không phải Phạm Việt Bách) gọi API -> 403 bị chặn
    const rOtherAdmin = await t.call('POST', '/api/admin/system-reset', { as: A, body: { password: 'Việt Bách đẹp trai nhất vũ trụ' } });
    assert.equal(rOtherAdmin.status, 403);
    assert.ok(rOtherAdmin.body.error.includes('forbidden') || rOtherAdmin.body.message.includes('Phạm Việt Bách'));

    // 3. Phạm Việt Bách gọi API nhưng sai mật khẩu -> 400
    const rWrongPwd = await t.call('POST', '/api/admin/system-reset', { as: P, body: { password: 'sai mat khau' } });
    assert.equal(rWrongPwd.status, 400);
    assert.equal(rWrongPwd.body.error, 'invalid_password');

    // 4. Giả lập dữ liệu test đang chạy:
    // - Lớp 1 chuyển sang xanh, đã điểm danh 25/30, đã khóa, có ghi chú
    t.db.prepare(`
      UPDATE rooms SET
        status = 'green',
        attendees = 25,
        total_members = 30,
        is_locked = 1,
        note = 'Đại hội diễn ra nghiêm túc'
      WHERE id = 1
    `).run();

    // - Đổi task sang done
    t.db.prepare("UPDATE tasks SET state = 'done' WHERE room_id = 1").run();

    // - Thêm quorum request
    t.db.prepare(`
      INSERT INTO quorum_requests (room_id, sender_email, sender_name, sender_role, target_type, attendees, total_members, status, created_at)
      VALUES (1, 'owner@t.test', 'Chủ Khu', 'room_lead', 'admin', 15, 30, 'pending', 123456)
    `).run();

    // - Thêm thông báo
    t.db.prepare(`
      INSERT INTO notifications (sender_email, sender_name, sender_role, title, content, level, target_type, target_label, created_at)
      VALUES ('admin@t.test', 'Admin', 'admin', 'Thông báo test', 'Nội dung test', 'info', 'all', 'Toàn bộ', 123456)
    `).run();

    // - Thêm activity log
    t.db.prepare("INSERT INTO activity (ts, email, room_id, action, detail) VALUES (123456, 'owner@t.test', 1, 'room.test', 'Test log cũ')").run();

    const initialGroupsCount = t.db.prepare('SELECT COUNT(*) as c FROM groups').get().c;
    const initialRoomsCount = t.db.prepare('SELECT COUNT(*) as c FROM rooms').get().c;
    const initialUsersCount = t.db.prepare('SELECT COUNT(*) as c FROM users').get().c;

    // 5. Phạm Việt Bách gọi API với đúng mật khẩu "Việt Bách đẹp trai nhất vũ trụ" -> 200 thành công!
    const rResetSuccess = await t.call('POST', '/api/admin/system-reset', {
      as: P,
      body: { password: 'Việt Bách đẹp trai nhất vũ trụ' },
    });
    assert.equal(rResetSuccess.status, 200);
    assert.equal(rResetSuccess.body.ok, true);

    // 6. Kiểm tra các dữ liệu đã được làm mới:
    // - Tất cả rooms: status = 'red', attendees = 0, is_locked = 0, quorum_exempt = 0, note = ''
    const room1 = t.db.prepare('SELECT * FROM rooms WHERE id = 1').get();
    assert.equal(room1.status, 'red');
    assert.equal(room1.attendees, 0);
    assert.equal(room1.is_locked, 0);
    assert.equal(room1.quorum_exempt, 0);
    assert.equal(room1.note, '');

    // - Tất cả tasks: state = 'todo'
    const nonTodoTasks = t.db.prepare("SELECT COUNT(*) as c FROM tasks WHERE state != 'todo'").get().c;
    assert.equal(nonTodoTasks, 0);

    // - Quorum requests: xóa sạch
    const quorumCount = t.db.prepare('SELECT COUNT(*) as c FROM quorum_requests').get().c;
    assert.equal(quorumCount, 0);

    // - Notifications: xóa sạch
    const notifCount = t.db.prepare('SELECT COUNT(*) as c FROM notifications').get().c;
    assert.equal(notifCount, 0);

    // - Activity logs cũ bị xóa, chỉ còn 1 log ghi nhận system.reset
    const logs = t.db.prepare('SELECT * FROM activity').all();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, 'system.reset');

    // 7. Kiểm tra dữ liệu được BẢO TỒN NGUYÊN VẸN:
    // - Số lượng groups (khối/tầng), rooms (lớp), users (tài khoản/danh bạ) không đổi
    assert.equal(t.db.prepare('SELECT COUNT(*) as c FROM groups').get().c, initialGroupsCount);
    assert.equal(t.db.prepare('SELECT COUNT(*) as c FROM rooms').get().c, initialRoomsCount);
    assert.equal(t.db.prepare('SELECT COUNT(*) as c FROM users').get().c, initialUsersCount);
  } finally {
    await t.close();
  }
});

test('tự động dọn sạch duplicate tasks và chặn trùng lặp checklist theo (room_id, text)', async () => {
  const t = await startApp();
  try {
    // Thử chèn trùng task vào phòng 1
    const taskInsert = t.db.prepare('INSERT OR IGNORE INTO tasks(room_id, text, state, sort, updated_at) VALUES (1, ?, ?, 99, 100)');
    taskInsert.run('Việc trùng lặp 1', 'todo');
    taskInsert.run('Việc trùng lặp 1', 'todo');

    const duplicates = t.db.prepare('SELECT COUNT(*) as c FROM tasks WHERE room_id = 1 AND text = ?').get('Việc trùng lặp 1').c;
    assert.equal(duplicates, 1, 'Chỉ được có đúng 1 task với cùng nội dung');
  } finally {
    await t.close();
  }
});





