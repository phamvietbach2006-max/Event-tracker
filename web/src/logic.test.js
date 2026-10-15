import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ST, NEXT, percent, doneCount, statusCounts, totals, canEdit, patchRoom, patchTask, allRooms, timeLabel, getScopedGroups, isAttendanceValid, isChecklistComplete, canStartCongress } from './logic.js';

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
  assert.equal(ST.cancelled, 'Hủy đại hội');
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
  assert.deepEqual(statusCounts(rooms), { red: 1, yellow: 1, green: 1, cancelled: 0 });
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

test('canEdit: phòng đã bị khóa (isLocked) chỉ cấp trên mới được sửa', () => {
  const lockedRoom = { id: 4, isLocked: true, groupId: 1 };
  const group = { id: 1, name: '[Trường CNTT & TT] Tầng 4 B1' };
  // Cán bộ thường phụ trách phòng bị khóa -> không được sửa
  assert.equal(canEdit({ isAdmin: false, role: 'room_lead', ownedRoomIds: [4] }, lockedRoom, group), false);
  // Admin -> được sửa phòng khóa
  assert.equal(canEdit({ isAdmin: true, role: 'admin', ownedRoomIds: [] }, lockedRoom, group), true);
  // Phụ trách Đơn vị đúng đơn vị -> được sửa
  assert.equal(canEdit({ isAdmin: false, role: 'unit_lead', assignedUnits: ['Trường CNTT & TT'], ownedRoomIds: [] }, lockedRoom, group), true);
  // Phụ trách Đơn vị khác -> không được sửa
  assert.equal(canEdit({ isAdmin: false, role: 'unit_lead', assignedUnits: ['Trường Cơ khí'], ownedRoomIds: [] }, lockedRoom, group), false);
  // Phụ trách Tầng đúng tầng -> được sửa
  assert.equal(canEdit({ isAdmin: false, role: 'floor_lead', assignedGroupIds: [1], ownedRoomIds: [] }, lockedRoom, group), true);
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

test('isAttendanceValid: đạt >= 2/3 sĩ số lớp', () => {
  // Sĩ số 30, có mặt 20 (20/30 = 2/3) -> true
  assert.equal(isAttendanceValid(20, 30), true);
  // Sĩ số 30, có mặt 25 (> 2/3) -> true
  assert.equal(isAttendanceValid(25, 30), true);
  // Sĩ số 50, có mặt 40 (80%) -> true
  assert.equal(isAttendanceValid(40, 50), true);
  // Sĩ số 30, có mặt 19 (< 2/3) -> false
  assert.equal(isAttendanceValid(19, 30), false);
  // Sĩ số 0, có mặt 0 -> false
  assert.equal(isAttendanceValid(0, 0), false);
  // Chưa nhập hoặc null -> false
  assert.equal(isAttendanceValid(null, 50), false);
  assert.equal(isAttendanceValid(30, null), false);
  // Số âm -> false
  assert.equal(isAttendanceValid(-5, 30), false);
});

test('isChecklistComplete: hoàn thành 100% checklist giấy tờ', () => {
  const completeRoom = { tasks: [{ id: 1, state: 'done' }, { id: 2, state: 'done' }] };
  const incompleteRoom1 = { tasks: [{ id: 1, state: 'done' }, { id: 2, state: 'doing' }] };
  const incompleteRoom2 = { tasks: [{ id: 1, state: 'todo' }] };
  const emptyTasksRoom = { tasks: [] };

  assert.equal(isChecklistComplete(completeRoom), true);
  assert.equal(isChecklistComplete(incompleteRoom1), false);
  assert.equal(isChecklistComplete(incompleteRoom2), false);
  assert.equal(isChecklistComplete(emptyTasksRoom), true);
  assert.equal(isChecklistComplete(null), false);
});

test('canStartCongress: cả 2 điều kiện (>= 2/3 sĩ số và 100% giấy tờ)', () => {
  const okRoom = {
    attendees: 35,
    totalMembers: 45,
    tasks: [{ id: 1, state: 'done' }, { id: 2, state: 'done' }],
  };
  assert.equal(canStartCongress(okRoom), true);

  // Thiếu sĩ số
  const lowAttRoom = {
    attendees: 20,
    totalMembers: 45,
    tasks: [{ id: 1, state: 'done' }],
  };
  assert.equal(canStartCongress(lowAttRoom), false);

  // Thiếu giấy tờ
  const lowDocRoom = {
    attendees: 40,
    totalMembers: 45,
    tasks: [{ id: 1, state: 'done' }, { id: 2, state: 'todo' }],
  };
  assert.equal(canStartCongress(lowDocRoom), false);
});

