import { createHash, randomBytes } from 'node:crypto';

export const newToken = () => randomBytes(32).toString('base64url');

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export const loginUrl = (config, token) => `${config.baseUrl}/auth/token?t=${token}`;

export function userByToken(db, t) {
  if (typeof t !== 'string' || t.length < 20) return null;
  const hashed = hashToken(t);
  return db.prepare('SELECT email, name, is_admin FROM users WHERE token = ? OR token = ?').get(t, hashed) ?? null;
}
