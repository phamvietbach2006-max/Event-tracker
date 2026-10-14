import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

export const DEFAULT_PASSWORD = 'Abc@123456767';

const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha512';

/**
 * Băm mật khẩu bằng PBKDF2 với salt ngẫu nhiên
 * Định dạng lưu trữ: "salt:hash"
 */
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(String(password), salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Kiểm tra mật khẩu
 * - Nếu người dùng đã có password_hash: so khớp mã băm
 * - Nếu người dùng chưa đổi mật khẩu (password_hash là null): so khớp với mật khẩu mặc định Abc@123456767
 * - Đồng thời hỗ trợ đăng nhập bằng mã token riêng của người dùng
 */
export function verifyPassword(password, storedHash, userToken) {
  const p = String(password ?? '');
  if (!p) return false;

  // 1. Kiểm tra mã token riêng nếu có
  if (userToken && p === userToken) {
    return true;
  }

  // 2. Nếu đã có hash trong database
  if (storedHash && storedHash.includes(':')) {
    const [salt, expectedHash] = storedHash.split(':');
    if (!salt || !expectedHash) return false;
    const actualHash = pbkdf2Sync(p, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
    const a = Buffer.from(actualHash, 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  // 3. Nếu chưa có hash riêng, kiểm tra với mật khẩu mặc định chung
  return p === DEFAULT_PASSWORD;
}
