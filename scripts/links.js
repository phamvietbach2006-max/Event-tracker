import { openDb } from '../lib/db.js';
import { ensureTokens } from '../lib/seed.js';
import { loginUrl } from '../auth/token.js';

const db = openDb(process.env.DB_PATH ?? 'app.db');
ensureTokens(db);
const config = { baseUrl: (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '') };
for (const u of db.prepare('SELECT email, name, is_admin, token FROM users ORDER BY is_admin DESC, name').all()) {
  console.log([u.is_admin ? 'ADMIN' : 'user ', u.email, u.name, loginUrl(config, u.token)].join('\t'));
}
