import { HttpError } from '../lib/http.js';
import { createSession, destroySession, sidFrom, setSessionCookie, clearSessionCookie } from '../lib/session.js';
import { userByToken } from '../auth/token.js';

const ownedRoomIds = (db, email) =>
  db.prepare('SELECT room_id FROM room_owners WHERE email = ? ORDER BY room_id').all(email).map((r) => r.room_id);

export function registerAuth(router) {
  router.add('GET', '/api/me', ({ db, user }) =>
    user
      ? { email: user.email, name: user.name, isAdmin: !!user.is_admin, ownedRoomIds: ownedRoomIds(db, user.email) }
      : null);

  router.add('GET', '/auth/token', ({ req, res, db, url }) => {
    const u = userByToken(db, url.searchParams.get('t'));
    if (u) {
      setSessionCookie(req, res, createSession(db, u.email));
      res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' }).end();
    } else {
      res.writeHead(302, { Location: '/?login=failed', 'Cache-Control': 'no-store' }).end();
    }
  });

  router.add('POST', '/auth/logout', ({ req, res, db }) => {
    const sid = sidFrom(req);
    if (sid) destroySession(db, sid);
    clearSessionCookie(res);
    res.writeHead(204).end();
  });

  const sso = () => { throw new HttpError(501, 'sso_not_configured', 'SSO chưa được cấu hình'); };
  router.add('GET', '/auth/sso/start', sso);
  router.add('GET', '/auth/callback', sso);
}
