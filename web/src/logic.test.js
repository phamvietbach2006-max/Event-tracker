import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ST, NEXT, percent, doneCount, statusCounts, totals, canEdit, patchRoom, patchTask, allRooms, timeLabel, getScopedGroups } from './logic.js';

const state = {
  version: 1,
  groups: [
    { id: 1, name: '[Trường CNTT & TT] Tầng 4 B1', rooms: [
      { id: 4, status: 'yellow', tasks: [{ id: 1, state: 'done' }, { id: 2, state: 'doing' }, { id: 3, state: 'todo' }] },
      { id: 5, status: 'red', tasks: [] },
    ] },
    { id: 2, name: '[Trường Điện-Điện tử] Tầng 2 C7', rooms: [{ id: 6, status: 'green', tasks: [{ id: 9, state: 'done' }] }] },
  ],
};

test('nhãn và vòng trạng thái việc', () => {
  assert.equal(ST.red, 'Chưa tổ chức');
  assert.deepEqual([NEXT.todo, NEXT.doing, NEXT.done], ['done', 'done', 'todo']);
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
  assert.equal(allRooms(s2)[0].status, 'yellow');
  assert.equal(allRooms(patchTask(state, 999, { state: 'done' }))[0].tasks[0].state, 'done');
});

test('timeLabel: múi giờ Việt Nam, rỗng khi không có', () => {
  assert.equal(timeLabel(Date.UTC(2026, 9, 11, 17, 30)), '00:30');
  assert.equal(timeLabel(null), '');
});

test('removeTask bỏ đúng việc, giữ nguyên các việc khác và không đổi state gốc', async () => {
  const { removeTask } = await import('./logic.js');
  const out = removeTask(state, 2);
  assert.deepEqual(out.groups[0].rooms[0].tasks.map((t) => t.id), [1, 3]);
  assert.equal(state.groups[0].rooms[0].tasks.length, 3);
  assert.deepEqual(removeTask(state, 999), state);
});

test('getScopedGroups: phân quyền hiển thị theo vai trò', () => {
  // 1. Khách hoặc Admin -> thấy tất cả
  assert.equal(getScopedGroups(state.groups, null).length, 2);
  assert.equal(getScopedGroups(state.groups, { isAdmin: true }).length, 2);
  assert.equal(getScopedGroups(state.groups, { role: 'admin' }).length, 2);

  // 2. Unit lead: chỉ thấy đơn vị được phân công
  const u1 = getScopedGroups(state.groups, { role: 'unit_lead', assignedUnits: ['Trường CNTT & TT'] });
  assert.equal(u1.length, 1);
  assert.equal(u1[0].id, 1);

  const uNone = getScopedGroups(state.groups, { role: 'unit_lead', assignedUnits: ['Khoa Ngoại ngữ'] });
  assert.equal(uNone.length, 0);

  // 3. Floor lead: chỉ thấy tầng/khối được phân công
  const f1 = getScopedGroups(state.groups, { role: 'floor_lead', assignedGroupIds: [2] });
  assert.equal(f1.length, 1);
  assert.equal(f1[0].id, 2);

  // 4. Room lead: chỉ thấy phòng mình phụ trách trong tầng
  const r1 = getScopedGroups(state.groups, { role: 'room_lead', assignedRoomIds: [4] });
  assert.equal(r1.length, 1);
  assert.equal(r1[0].rooms.length, 1);
  assert.equal(r1[0].rooms[0].id, 4);

  const rNone = getScopedGroups(state.groups, { role: 'room_lead', assignedRoomIds: [999] });
  assert.equal(rNone.length, 0);
});

