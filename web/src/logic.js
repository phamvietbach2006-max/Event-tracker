export const ST = { red: 'Chưa sẵn sàng', yellow: 'Đang chuẩn bị', green: 'Sẵn sàng' };
export const TS = { todo: '○ Chưa làm', doing: '◐ Đang làm', done: '● Xong' };
export const ORDER = ['red', 'yellow', 'green'];
export const NOTE_MAX = 150;
export const NEXT = { todo: 'doing', doing: 'done', done: 'todo' };

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
