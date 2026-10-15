import http from 'node:http';
import { openDb } from './lib/db.js';
import { createApp } from './lib/app.js';
import { isEmpty, applySeed, syncUsersSeed, ensureTokens } from './lib/seed.js';
import { readFileSync } from 'node:fs';

let seedData;
try {
  seedData = JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));
} catch (e) {
  console.warn('Không đọc được ./seed.json:', e.message);
  try {
    seedData = JSON.parse(readFileSync(new URL('../seed.json', import.meta.url), 'utf8'));
  } catch (e2) {
    console.error('Không tìm thấy seed.json:', e2.message);
    seedData = { users: [], groups: [] };
  }
}

const defaultBaseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
const baseUrl = (process.env.BASE_URL ?? defaultBaseUrl).replace(/\/$/, '');
const tursoUrl = process.env.TURSO_DATABASE_URL ?? process.env.LIBSQL_URL;
const isCloud = process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_REGION || process.env.VERCEL_ENV;
const dbPath = tursoUrl ? tursoUrl : (isCloud ? '/tmp/app.db' : (process.env.DB_PATH ?? 'app.db'));
const host = process.env.HOST ?? '0.0.0.0';

const config = {
  port: Number(process.env.PORT ?? 3000),
  host,
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

let app = null;
let initError = null;

function init() {
  if (app) return app;
  if (initError) throw initError;
  try {
    console.log(`[BOOT] Initializing SQLite db at ${config.dbPath} on Node ${process.version}...`);
    const db = openDb(config.dbPath);
    if (isEmpty(db)) {
      try {
        applySeed(db, seedData);
        console.log('Đã nạp dữ liệu từ seed.json');
      } catch (err) {
        console.error('Lỗi khi nạp seed.json:', err.message);
      }
    }

    app = createApp({ db, config });
    console.log('[BOOT] App initialized successfully!');
    return app;
  } catch (err) {
    console.error('[BOOT CRASH] Database initialization failed:', err);
    initError = err;
    throw err;
  }
}

const dispatch = (req, res) => {
  if (req.headers['x-forwarded-uri']) {
    req.url = req.headers['x-forwarded-uri'];
  } else if (req.headers['x-matched-path'] && !req.headers['x-matched-path'].includes('/server.js')) {
    req.url = req.headers['x-matched-path'];
  }
  const url = new URL(req.url, 'http://local');
  if (url.pathname === '/health' || url.pathname === '/api/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
    return;
  }
  try {
    const activeApp = init();
    return activeApp.handleRequest(req, res);
  } catch (err) {
    res.writeHead(500, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({
      error: 'server_init_error',
      message: err.message,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      stack: err.stack,
    }, null, 2));
  }
};

const server = http.createServer(dispatch);

const rawPort = process.env.PORT;
const listenPort = rawPort ? (isNaN(rawPort) ? rawPort : Number(rawPort)) : (config.port || 3000);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${listenPort} is already in use. Exiting...`);
    process.exit(1);
  }
  console.warn('Cảnh báo HTTP server:', err.message);
});

try {
  if (typeof listenPort === 'string') {
    server.listen(listenPort, () => {
      console.log(`[BOOT] Event tracker service listening on socket ${listenPort}`);
    });
  } else {
    server.listen(listenPort, '0.0.0.0', () => {
      console.log(`[BOOT] Event tracker service listening on port ${listenPort} (DB ${config.dbPath})`);
    });
  }
} catch (err) {
  console.warn('Cảnh báo server listen:', err.message);
}

// Khởi tạo database sau khi server đã mở cổng
setImmediate(() => {
  try {
    init();
  } catch (e) {
    console.error('[EAGER INIT ERROR]', e.message);
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    if (app) await app.close();
    server.close();
    process.exit(0);
  });
}

export default async function handler(req, res) {
  return dispatch(req, res);
}
