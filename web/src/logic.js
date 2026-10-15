export const ST = { red: 'Chưa tổ chức', yellow: 'Đang tiến hành', green: 'Đã tiến hành xong', cancelled: 'Hủy đại hội' };
export const TS = { todo: '☐ Chưa đủ', doing: '◐ Đang kiểm', done: '☑ Đã đủ' };
export const ORDER = ['red', 'yellow', 'green', 'cancelled'];
export const NOTE_MAX = 150;
export const NEXT = { todo: 'done', doing: 'done', done: 'todo' };


export const UNITS = [
  'Trường Điện-Điện tử',
  'Trường CNTT & TT',
  'Trường Vật liệu',
  'Trường Cơ khí',
  'Trung tâm Đào tạo Liên tục',
  'Cao đẳng Nghề',
  'Khoa Ngoại ngữ',
  'Khoa Vật lý kĩ thuật',
  'Khoa Toán - Tin',
  'Trường Kinh Tế',
  'Trường Hoá và KHSS',
  'Khoa Khoa Học và Công nghệ giáo dục',
];

export const TASKS_K71 = [
  '1. Phương hướng',
  '2. Nghị quyết Đại hội',
  '3. Biên bản Đại hội',
  '4. Danh sách Đoàn viên và Cán bộ lớp',
];

export const TASKS_K70 = [
  '1. Biên bản ĐHCĐ',
  '2. Biên bản kiểm phiếu bầu BCH CĐ',
  '3. Biên bản họp phân công BCH CĐ',
  '4. Bản kiểm điểm BCH',
  '5. Nghị quyết Đại hội',
  '6. Báo cáo tổng kết',
  '7. Phương hướng nhiệm kỳ mới',
  '8. Danh sách Đoàn viên và Cán bộ lớp',
];

export const KIPS = [
  { id: 'all', label: 'Tất cả kíp' },
  { id: 'Kíp 1', label: 'Kíp 1 (8h00)' },
  { id: 'Kíp 2', label: 'Kíp 2 (10h00)' },
  { id: 'Kíp 3', label: 'Kíp 3 (13h30)' },
  { id: 'Kíp 4', label: 'Kíp 4 (15h30)' },
];

export const COHORTS = [
  { id: 'all', label: 'Tất cả khóa' },
  { id: 'K71', label: 'K71 · ĐH Thành lập' },
  { id: 'K70', label: 'K70 · ĐH Nhiệm kỳ' },
];

export function parseGroupMeta(name = '') {
  const m = /^\[([^\]]+)\]\s*(.+)$/.exec(name);
  if (m) return { unit: m[1].trim(), floorName: m[2].trim() };
  return { unit: UNITS[0], floorName: name };
}

export function formatGroupName(unit, floorName) {
  return `[${unit}] ${floorName}`;
}

export function floorFromRoomCode(roomCode = '') {
  const clean = String(roomCode).trim();
  const m = /^([A-Za-z]+\d*)\s*-\s*(\d)\d{2}[A-Za-z]?$/i.exec(clean);
  if (m) return `Tầng ${m[2]} tòa ${m[1].toUpperCase()}`;
  if (/onl|teams|zoom/i.test(clean)) return 'Phòng Online';
  return clean ? `Khu vực ${clean}` : 'Tầng 1';
}

export function parseRoomMeta(name = '') {
  const m = /^\[([^·\]]+?)\s*·\s*([^\]]+)\]\s*(.+)$/.exec(name);
  const kipLabel = m ? m[1].trim() : '';
  const kipMatch = kipLabel.match(/^Kíp\s*\d+/i);
  const kip = kipMatch ? kipMatch[0] : '';
  const roomCode = m ? m[2].trim() : '';
  const className = m ? m[3].trim() : name;
  const isK71 = /\bK71\b/i.test(className);
  const isK70 = /\bK70\b/i.test(className);
  const cohort = isK71 ? 'K71' : isK70 ? 'K70' : '';
  const congressType = isK71 ? 'ĐH Thành lập (K71)' : isK70 ? 'ĐH Nhiệm kỳ (K70)' : 'ĐH Chi đoàn';
  return { kip, kipLabel, roomCode, className, cohort, congressType };
}

export const allRooms = (state) => (state?.groups ?? []).flatMap((g) => g.rooms);
export const doneCount = (r) => r.tasks.filter((t) => t.state === 'done').length;
export const percent = (r) => (r.tasks.length ? Math.round((doneCount(r) / r.tasks.length) * 100) : 0);

export function isAttendanceValid(attendees, totalMembers, room = null) {
  if (room?.quorumExempt) return true;
  const att = Number(attendees) || 0;
  const tot = Number(totalMembers) || 0;
  if (tot <= 0) return false;
  return (att * 3) >= (tot * 2);
}

export function isChecklistComplete(room) {
  if (!room) return false;
  if (!Array.isArray(room.tasks) || room.tasks.length === 0) return true;
  return room.tasks.every((t) => t.state === 'done');
}

export function canStartCongress(room) {
  if (!room) return false;
  return isAttendanceValid(room.attendees, room.totalMembers, room) && isChecklistComplete(room);
}

export function statusCounts(rooms) {
  const c = { red: 0, yellow: 0, green: 0, cancelled: 0 };
  for (const r of rooms) {
    if (c[r.status] !== undefined) c[r.status]++;
  }
  return c;
}

export function totals(rooms) {
  let done = 0;
  let total = 0;
  for (const r of rooms) { done += doneCount(r); total += r.tasks.length; }
  return { rooms: rooms.length, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export const isUserAdmin = (user) =>
  Boolean(user && (user.isAdmin || user.role === 'admin' || user.email?.toLowerCase() === 'bach.pv2414676@sis.hust.edu.vn'));

export function isSupervisor(me, room, group) {
  if (!me) return false;
  if (isUserAdmin(me)) return true;
  const role = me.role || 'room_lead';
  if (role === 'unit_lead') {
    const assignedUnits = new Set(me.assignedUnits || []);
    const unit = group ? parseGroupMeta(group.name).unit : (room?.groupName ? parseGroupMeta(room.groupName).unit : '');
    return assignedUnits.has(unit);
  }
  if (role === 'floor_lead') {
    const assignedGroupIds = new Set((me.assignedGroupIds || []).map(Number));
    const gid = room?.groupId ?? group?.id;
    return gid != null && assignedGroupIds.has(Number(gid));
  }
  return false;
}

export function hasRoomPermission(me, room, group) {
  if (!me || !room) return false;
  return isSupervisor(me, room, group) || Boolean(me.ownedRoomIds?.includes(room?.id));
}

export function canEdit(me, room, group) {
  if (!me || !room) return false;
  const supervisor = isSupervisor(me, room, group);
  if (supervisor) return true;
  if (room.isLocked) return false;
  return Boolean(me.ownedRoomIds?.includes(room.id));
}

// Cán bộ phụ trách lớp vẫn có thể cập nhật trạng thái Đại hội ngay cả khi đã khóa hồ sơ & sĩ số
export function canEditStatus(me, room, group) {
  if (!me || !room) return false;
  return isSupervisor(me, room, group) || Boolean(me.ownedRoomIds?.includes(room.id));
}

// Chỉnh sửa checklist giấy tờ và sĩ số bị khóa khi room.isLocked (cần cấp trên mở khóa)
export function canEditDetails(me, room, group) {
  if (!me || !room) return false;
  if (isSupervisor(me, room, group)) return true;
  if (room.isLocked) return false;
  return Boolean(me.ownedRoomIds?.includes(room.id));
}



export const ROLES = {
  admin: {
    id: 'admin',
    label: 'Quản trị viên Ban TC-KT',
    badge: 'Admin',
    color: 'red',
    desc: 'Kiểm soát toàn bộ hệ thống, phân quyền và quản lý tài khoản cán bộ',
  },
  unit_lead: {
    id: 'unit_lead',
    label: 'Cán bộ phụ trách Đơn vị',
    badge: 'Phụ trách Đơn vị',
    color: 'purple',
    desc: 'Giám sát và kiểm tra toàn bộ chi đoàn thuộc đơn vị được phân công',
  },
  floor_lead: {
    id: 'floor_lead',
    label: 'Cán bộ phụ trách Tầng',
    badge: 'Phụ trách Tầng',
    color: 'blue',
    desc: 'Theo dõi và quản lý các phòng/lớp thuộc tầng/khu vực được phân công',
  },
  room_lead: {
    id: 'room_lead',
    label: 'Cán bộ kiểm tra Chi đoàn',
    badge: 'Kiểm tra Chi đoàn',
    color: 'green',
    desc: 'Trực tiếp kiểm tra và tích nộp hồ sơ đại hội các chi đoàn được giao',
  },
};

export function getScopedGroups(groups = [], me = null) {
  if (!me || me.isAdmin || me.role === 'admin') {
    return groups;
  }

  const role = me.role || 'room_lead';

  if (role === 'unit_lead') {
    const assignedUnits = new Set(me.assignedUnits || []);
    return groups.filter((g) => {
      const meta = parseGroupMeta(g.name);
      return assignedUnits.has(meta.unit);
    });
  }

  if (role === 'floor_lead') {
    const assignedGroupIds = new Set((me.assignedGroupIds || []).map(Number));
    return groups.filter((g) => assignedGroupIds.has(Number(g.id)));
  }

  if (role === 'room_lead') {
    const allowed = new Set((me.assignedRoomIds || me.ownedRoomIds || []).map(Number));
    return groups
      .map((g) => ({
        ...g,
        rooms: (g.rooms || []).filter((r) => allowed.has(Number(r.id))),
      }))
      .filter((g) => g.rooms.length > 0);
  }

  return groups;
}

const mapRooms = (state, fn) => ({ ...state, groups: state.groups.map((g) => ({ ...g, rooms: g.rooms.map(fn) })) });

export const patchRoom = (state, roomId, patch) =>
  mapRooms(state, (r) => (r.id === roomId ? { ...r, ...patch } : r));

export const patchTask = (state, taskId, patch) =>
  mapRooms(state, (r) =>
    r.tasks.some((t) => t.id === taskId)
      ? { ...r, tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }
      : r);

const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' });
export const timeLabel = (ms) => (ms ? fmt.format(new Date(ms)) : '');

export const removeTask = (state, taskId) =>
  mapRooms(state, (r) => (r.tasks.some((t) => t.id === taskId) ? { ...r, tasks: r.tasks.filter((t) => t.id !== taskId) } : r));

