import { HttpError } from '../lib/http.js';
import { createSession, destroySession, destroyUserSessions, sidFrom, setSessionCookie, clearSessionCookie } from '../lib/session.js';
import { userByToken } from '../auth/token.js';
import { ssoStart, ssoCallback } from '../auth/sso.js';
import { verifyPassword, hashPassword } from '../auth/password.js';
import { loginLimiter, passwordChangeLimiter } from '../lib/security.js';

const ownedRoomIds = (db, email) =>
  db.prepare('SELECT room_id FROM room_owners WHERE email = ? ORDER BY room_id').all(email).map((r) => r.room_id);

import { userView } from './admin.js';

export function registerAuth(router) {
  router.add('GET', '/api/me', ({ db, user }) => (user ? userView(db, user) : null));

  router.add('POST', '/api/auth/login', async ({ req, res, db, body }) => {
    loginLimiter(req);
    const rawEmail = String(body.email ?? '').trim().toLowerCase();
    const rawPassword = String(body.password ?? '');
    if (!rawEmail || !rawPassword) {
      throw new HttpError(400, 'bad_request', 'Vui lòng nhập email/tài khoản và mật khẩu');
    }

    // Tìm kiếm theo email chính xác hoặc username (trước dấu @) - chống LIKE injection
    let u = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(rawEmail);
    if (!u) {
      u = db.prepare("SELECT * FROM users WHERE LOWER(substr(email, 1, instr(email, '@') - 1)) = ?").get(rawEmail);
    }

    if (!u || !verifyPassword(rawPassword, u.password_hash, u.token)) {
      throw new HttpError(401, 'invalid_credentials', 'Email/tài khoản hoặc mật khẩu không chính xác');
    }

    const sid = createSession(db, u.email);
    setSessionCookie(req, res, sid);
    return {
      ok: true,
      user: userView(db, u),
    };
  });

  router.add('POST', '/api/auth/change-password', async ({ req, res, user, db, body }) => {
    passwordChangeLimiter(req);
    if (!user) throw new HttpError(401, 'unauthorized', 'Cần đăng nhập để đổi mật khẩu');
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(user.email);
    if (!u) throw new HttpError(404, 'not_found', 'Không tìm thấy người dùng');

    const oldPassword = String(body.oldPassword ?? '');
    const newPassword = String(body.newPassword ?? '');
    if (!verifyPassword(oldPassword, u.password_hash, u.token)) {
      throw new HttpError(400, 'wrong_old_password', 'Mật khẩu cũ không chính xác');
    }
    if (newPassword.length < 6) {
      throw new HttpError(400, 'weak_password', 'Mật khẩu mới phải có ít nhất 6 ký tự');
    }

    const hashed = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hashed, u.email);
    // Thu hồi các phiên đăng nhập khác của người dùng trên thiết bị khác
    const currentSid = sidFrom(req);
    if (currentSid) {
      db.prepare('DELETE FROM sessions WHERE LOWER(email) = ? AND sid != ?').run(u.email.toLowerCase(), currentSid);
    } else {
      destroyUserSessions(db, u.email);
      const newSid = createSession(db, u.email);
      setSessionCookie(req, res, newSid);
    }
    return { ok: true, message: 'Đổi mật khẩu thành công. Các thiết bị khác đã được đăng xuất an toàn.' };
  });

  router.add('GET', '/auth/token', ({ req, res, db, url }) => {
    const u = userByToken(db, url.searchParams.get('t'));
    if (u) {
      setSessionCookie(req, res, createSession(db, u.email));
      res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' }).end();
    } else {
      res.writeHead(302, { Location: '/?login=failed', 'Cache-Control': 'no-store' }).end();
    }
  });

  const logoutHandler = ({ req, res, db }) => {
    const sid = sidFrom(req);
    if (sid) destroySession(db, sid);
    clearSessionCookie(res);
    res.writeHead(204).end();
  };

  router.add('POST', '/auth/logout', logoutHandler);
  router.add('POST', '/api/auth/logout', logoutHandler);

  const sso = (fn) => (ctx) => {
    if (!ctx.config.sso) throw new HttpError(501, 'sso_not_configured', 'SSO chưa được cấu hình');
    return fn(ctx);
  };
  router.add('GET', '/auth/sso/start', sso(ssoStart));
  router.add('GET', '/auth/callback', sso(ssoCallback));
}
