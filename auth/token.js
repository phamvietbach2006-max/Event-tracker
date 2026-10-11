import { randomBytes } from 'node:crypto';

export const newToken = () => randomBytes(32).toString('base64url');

export const loginUrl = (config, token) => `${config.baseUrl}/auth/token?t=${token}`;

export function userByToken(db, t) {
  if (typeof t !== 'string' || t.length < 20) return null;
  return db.prepare('SELECT email, name, is_admin FROM users WHERE token = ?').get(t) ?? null;
}
