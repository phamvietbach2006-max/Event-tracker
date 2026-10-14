import { randomBytes } from 'node:crypto';

const TTL_MS = 30 * 24 * 3600 * 1000;

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* bỏ cookie lỗi */ }
  }
  return out;
}

export const sidFrom = (req) => parseCookies(req.headers.cookie).sid ?? null;

export function createSession(db, email) {
  const sid = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(sid, email, expires_at) VALUES (?,?,?)').run(sid, email, Date.now() + TTL_MS);
  return sid;
}

export function getUser(db, req) {
  const sid = sidFrom(req);
  if (!sid) return null;
  return db.prepare(
    'SELECT u.email AS email, u.name AS name, u.is_admin AS is_admin, u.role AS role FROM sessions s JOIN users u ON u.email = s.email WHERE s.sid = ? AND s.expires_at > ?',
  ).get(sid, Date.now()) ?? null;
}

export function destroySession(db, sid) {
  db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
}

export function purgeExpired(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
}

export function setSessionCookie(req, res, sid) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${TTL_MS / 1000}${secure}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}
