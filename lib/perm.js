import { HttpError } from './http.js';

export function requireUser(user) {
  if (!user) throw new HttpError(401, 'unauthorized', 'Vui lòng đăng nhập cán bộ kiểm tra để thực hiện');
  return user;
}

export function requireAdmin(user) {
  requireUser(user);
  if (!user.is_admin) throw new HttpError(403, 'forbidden', 'Chỉ quản trị viên Ban TC-KT mới được thực hiện thao tác này');
}

export function canEditRoom(db, user, roomId) {
  if (!user) return false;
  if (user.is_admin) return true;
  return !!db.prepare('SELECT 1 FROM room_owners WHERE room_id = ? AND LOWER(email) = ?').get(roomId, user.email.toLowerCase());
}

export function requireRoomEditor(db, user, roomId) {
  requireUser(user);
  if (!canEditRoom(db, user, roomId)) throw new HttpError(403, 'forbidden', 'Bạn chỉ có quyền cập nhật các chi đoàn được phân công phụ trách');
}
