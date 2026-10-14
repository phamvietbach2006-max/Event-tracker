import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from './lib/db.js';
import { createApp } from './lib/app.js';
import { isEmpty, applySeed, ensureTokens } from './lib/seed.js';

const defaultBaseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
const baseUrl = (process.env.BASE_URL ?? defaultBaseUrl).replace(/\/$/, '');
const tursoUrl = process.env.TURSO_DATABASE_URL ?? process.env.LIBSQL_URL;
const dbPath = tursoUrl ? tursoUrl : (process.env.VERCEL ? '/tmp/app.db' : (process.env.DB_PATH ?? 'app.db'));
const host = process.env.HOST ?? (process.env.VERCEL ? '0.0.0.0' : '127.0.0.1');

const config = {
  port: Number(process.env.PORT ?? 3000),
  host,
  dbPath,
  baseUrl,
  // Bật SSO khi có đủ biến môi trường (xem docs/SSO.md)
  sso: process.env.SSO_CLIENT_ID && process.env.SSO_CLIENT_SECRET && process.env.SSO_TENANT_ID
    ? {
        tenantId: process.env.SSO_TENANT_ID,
        clientId: process.env.SSO_CLIENT_ID,
        clientSecret: process.env.SSO_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${process.env.SSO_TENANT_ID}/v2.0`,
        redirectUri: `${baseUrl}/auth/callback`,
      }
    : null,
  seedFile: process.env.SEED_FILE ?? fileURLToPath(new URL('./seed.json', import.meta.url)),
  openAccess: process.env.OPEN_ACCESS === '1',
};

const db = openDb(config.dbPath);
if (isEmpty(db) && existsSync(config.seedFile)) {
  applySeed(db, JSON.parse(readFileSync(config.seedFile, 'utf8')));
  console.log(`Đã nạp dữ liệu từ ${config.seedFile}`);
}
ensureTokens(db);

const app = createApp({ db, config });
app.server.listen(config.port, config.host, () => {
  console.log(`Event tracker: http://${config.host}:${config.port} (DB ${config.dbPath})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { await app.close(); db.close(); process.exit(0); });
}
