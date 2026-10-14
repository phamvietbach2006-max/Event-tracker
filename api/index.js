import { openDb } from '../lib/db.js';
import { createApp } from '../lib/app.js';
import { isEmpty, applySeed, syncUsersSeed, ensureTokens } from '../lib/seed.js';
import seedData from '../seed.json' with { type: 'json' };

let appInstance = null;

function getApp() {
  if (appInstance) return appInstance;
  const tursoUrl = process.env.TURSO_DATABASE_URL ?? process.env.LIBSQL_URL;
  const dbPath = tursoUrl ? tursoUrl : (process.env.VERCEL ? '/tmp/app.db' : (process.env.DB_PATH ?? 'app.db'));

    const defaultBaseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    const baseUrl = (process.env.BASE_URL ?? defaultBaseUrl).replace(/\/$/, '');
    const config = {
      port: Number(process.env.PORT ?? 3000),
      host: process.env.HOST ?? '127.0.0.1',
      dbPath,
      baseUrl,
      sso: process.env.SSO_CLIENT_ID && process.env.SSO_CLIENT_SECRET && process.env.SSO_TENANT_ID
        ? {
            tenantId: process.env.SSO_TENANT_ID,
            clientId: process.env.SSO_CLIENT_ID,
            clientSecret: process.env.SSO_CLIENT_SECRET,
            authority: `https://login.microsoftonline.com/${process.env.SSO_TENANT_ID}/v2.0`,
            redirectUri: `${baseUrl}/auth/callback`,
          }
        : null,
      openAccess: process.env.NODE_ENV !== 'production' && process.env.OPEN_ACCESS === '1',
    };

  const db = openDb(dbPath);
  try {
    db.prepare("DELETE FROM room_owners WHERE LOWER(email) NOT LIKE '%@sis.hust.edu.vn'").run();
    db.prepare("DELETE FROM sessions WHERE LOWER(email) NOT LIKE '%@sis.hust.edu.vn'").run();
    db.prepare("DELETE FROM user_units WHERE LOWER(email) NOT LIKE '%@sis.hust.edu.vn'").run();
    db.prepare("DELETE FROM user_groups WHERE LOWER(email) NOT LIKE '%@sis.hust.edu.vn'").run();
    db.prepare("DELETE FROM users WHERE LOWER(email) NOT LIKE '%@sis.hust.edu.vn'").run();
  } catch (err) {
    console.error('Lỗi dọn dẹp tài khoản không thuộc sis.hust.edu.vn:', err);
  }

  if (isEmpty(db)) {
    try {
      applySeed(db, seedData);
    } catch (err) {
      console.error('Lỗi khi nạp dữ liệu mẫu ban đầu:', err);
    }
  } else {
    try {
      syncUsersSeed(db, seedData.users);
    } catch (err) {
      console.error('Lỗi đồng bộ cán bộ từ seed.json:', err);
    }
  }

  try {
    const needsToken = db.prepare('SELECT 1 FROM users WHERE token IS NULL LIMIT 1').get();
    if (needsToken) {
      ensureTokens(db);
    }
  } catch (err) {
    console.error('Lỗi kiểm tra token:', err);
  }

  appInstance = createApp({ db, config });
  return appInstance;
}

export default async function handler(req, res) {
  const app = getApp();
  return app.handleRequest(req, res);
}
