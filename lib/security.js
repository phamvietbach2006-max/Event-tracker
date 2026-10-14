import { HttpError } from './http.js';

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * In-memory Sliding Window Rate Limiter
 */
export function createRateLimiter({
  windowMs = 60000,
  max = 10,
  message = 'Quá nhiều yêu cầu từ thiết bị của bạn. Vui lòng thử lại sau.',
} = {}) {
  const hits = new Map();

  // Dọn dẹp định kỳ mỗi 5 phút
  const cleaner = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (now - record.resetTime > windowMs) {
        hits.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
  if (cleaner.unref) cleaner.unref();

  return function checkLimit(req) {
    const ip = getClientIp(req);
    const now = Date.now();
    const record = hits.get(ip) || { count: 0, resetTime: now };

    if (now - record.resetTime > windowMs) {
      record.count = 1;
      record.resetTime = now;
    } else {
      record.count += 1;
    }

    hits.set(ip, record);

    if (record.count > max) {
      throw new HttpError(429, 'too_many_requests', message);
    }
  };
}

export const loginLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 phút
  max: 15,                // Tối đa 15 lần thử / IP
  message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ 5 phút trước khi thử lại.',
});

export const passwordChangeLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: 'Thao tác đổi mật khẩu quá nhanh. Vui lòng chờ 5 phút.',
});
