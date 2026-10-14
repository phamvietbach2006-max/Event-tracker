import { openDb } from '../lib/db.js';
import { createApp } from '../lib/app.js';
import { isEmpty, applySeed, ensureTokens } from '../lib/seed.js';
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
      openAccess: process.env.OPEN_ACCESS === '1',
    };

  const db = openDb(dbPath);
  if (isEmpty(db)) {
    try {
      applySeed(db, seedData);
    } catch (err) {
      console.error('Lỗi khi nạp dữ liệu mẫu ban đầu:', err);
    }
  }
  ensureTokens(db);

  appInstance = createApp({ db, config });
  return appInstance;
}

export default async function handler(req, res) {
  const app = getApp();
  return app.handleRequest(req, res);
}
