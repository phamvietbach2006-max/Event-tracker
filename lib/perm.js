import { HttpError } from './http.js';

export const PERMANENT_ADMINS = new Set([
  'bach.pv2414676@sis.hust.edu.vn',
]);

export function isPermanentAdmin(email) {
  if (!email) return false;
  return PERMANENT_ADMINS.has(String(email).trim().toLowerCase());
}

export function requireUser(user) {
  if (!user) throw new HttpError(401, 'unauthorized', 'Vui lòng đăng nhập cán bộ kiểm tra để thực hiện');
  return user;
}

export function requireAdmin(user) {
  requireUser(user);
  if (!user.is_admin && user.role !== 'admin' && !isPermanentAdmin(user.email)) {
    throw new HttpError(403, 'forbidden', 'Chỉ quản trị viên Ban TC-KT mới được thực hiện thao tác này');
  }
}

export function canEditRoom(db, user, roomId) {
  if (!user) return false;
  if (user.is_admin || user.role === 'admin' || isPermanentAdmin(user.email)) return true;

  const email = String(user.email ?? '').trim().toLowerCase();
  if (!email) return false;

  // 1. Kiểm tra trực tiếp trong room_owners
  if (db.prepare('SELECT 1 FROM room_owners WHERE room_id = ? AND LOWER(email) = ?').get(roomId, email)) {
    return true;
  }

  // 2. Lấy role của user từ DB
  const u = db.prepare('SELECT is_admin, role FROM users WHERE LOWER(email) = ?').get(email);
  if (!u) return false;
  if (u.is_admin || u.role === 'admin') return true;

  const role = u.role || 'room_lead';

  // 3. Phụ trách Đơn vị
  if (role === 'unit_lead') {
    const room = db.prepare('SELECT g.name AS group_name FROM rooms r JOIN groups g ON g.id = r.group_id WHERE r.id = ?').get(roomId);
    if (!room) return false;
    const m = /^\[([^\]]+)\]/.exec(room.group_name);
    const unit = m ? m[1].trim() : '';
    return !!db.prepare('SELECT 1 FROM user_units WHERE LOWER(email) = ? AND unit = ?').get(email, unit);
  }

  // 4. Phụ trách Tầng
  if (role === 'floor_lead') {
    const room = db.prepare('SELECT group_id FROM rooms WHERE id = ?').get(roomId);
    if (!room) return false;
    return !!db.prepare('SELECT 1 FROM user_groups WHERE group_id = ? AND LOWER(email) = ?').get(room.group_id, email);
  }

  return false;
}

export function requireRoomEditor(db, user, roomId) {
  requireUser(user);
  if (!canEditRoom(db, user, roomId)) {
    throw new HttpError(403, 'forbidden', 'Bạn chỉ có quyền cập nhật các chi đoàn được phân công phụ trách');
  }
}
