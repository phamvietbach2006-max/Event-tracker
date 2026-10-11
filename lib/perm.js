import { HttpError } from './http.js';

export function requireUser(user) {
  if (!user) throw new HttpError(401, 'unauthorized', 'Cần đăng nhập');
  return user;
}

export function requireAdmin(user) {
  requireUser(user);
  if (!user.is_admin) throw new HttpError(403, 'forbidden', 'Chỉ quản trị viên mới làm được việc này');
}

export function canEditRoom(db, user, roomId) {
  if (!user) return false;
  if (user.is_admin) return true;
  return !!db.prepare('SELECT 1 FROM room_owners WHERE room_id = ? AND email = ?').get(roomId, user.email);
}

export function requireRoomEditor(db, user, roomId) {
  requireUser(user);
  if (!canEditRoom(db, user, roomId)) throw new HttpError(403, 'forbidden', 'Bạn không có quyền sửa khu này');
}
