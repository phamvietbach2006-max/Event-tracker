export const ST = { red: 'Chưa tổ chức', yellow: 'Đang tiến hành', green: 'Đã tiến hành xong' };
export const TS = { todo: '☐ Chưa đủ', doing: '◐ Đang kiểm', done: '☑ Đã đủ' };
export const ORDER = ['red', 'yellow', 'green'];
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

export function statusCounts(rooms) {
  const c = { red: 0, yellow: 0, green: 0 };
  for (const r of rooms) c[r.status]++;
  return c;
}

export function totals(rooms) {
  let done = 0;
  let total = 0;
  for (const r of rooms) { done += doneCount(r); total += r.tasks.length; }
  return { rooms: rooms.length, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export const canEdit = (me, room) => !!me && (me.isAdmin || me.ownedRoomIds.includes(room.id));

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
