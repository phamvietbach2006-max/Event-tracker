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
const dbPath = tursoUrl ? tursoUrl : (process.env.VERCEL ? '/tmp/app.db' : (process.env.DB_PATH ?? 'app.db'));
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
    try {
      db.prepare("DELETE FROM room_owners WHERE LOWER(email) NOT LIKE '%@sis.hust.edu.vn'").run();
      db.prepare("DELETE FROM sessions WHERE LOWER(email) NOT LIKE '%@sis.hust.edu.vn'").run();
      db.prepare("DELETE FROM user_units WHERE LOWER(email) NOT LIKE '%@sis.hust.edu.vn'").run();
      db.prepare("DELETE FROM user_groups WHERE LOWER(email) NOT LIKE '%@sis.hust.edu.vn'").run();
      db.prepare("DELETE FROM users WHERE LOWER(email) NOT LIKE '%@sis.hust.edu.vn'").run();
    } catch (err) {
      console.warn('Lỗi dọn dẹp tài khoản không thuộc sis.hust.edu.vn:', err.message);
    }

    if (isEmpty(db)) {
      try {
        applySeed(db, seedData);
        console.log('Đã nạp dữ liệu từ seed.json');
      } catch (err) {
        console.error('Lỗi khi nạp seed.json:', err.message);
      }
    } else {
      try {
        syncUsersSeed(db, seedData.users);
      } catch (err) {
        console.warn('Lỗi khi kiểm tra cán bộ từ seed.json:', err.message);
      }
    }

    try {
      const needsToken = db.prepare('SELECT 1 FROM users WHERE token IS NULL LIMIT 1').get();
      if (needsToken) {
        ensureTokens(db);
      }
    } catch (err) {
      console.warn('Lỗi khi kiểm tra token:', err.message);
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

// Khởi tạo ngay lập tức (eager init)
try {
  init();
} catch (e) {
  console.error('[EAGER INIT ERROR]', e.message);
}

const dispatch = (req, res) => {
  try {
    const activeApp = init();
    return activeApp.handleRequest(req, res);
  } catch (err) {
    res.writeHead(500, {
      'Content-Type': 'application/json; charset=utf-8',
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

server.on('error', (err) => {
  console.warn('Cảnh báo HTTP server:', err.message);
});

const rawPort = process.env.PORT;
const listenPort = rawPort ? (isNaN(rawPort) ? rawPort : Number(rawPort)) : (config.port || 3000);
const listenHost = process.env.HOST ?? '0.0.0.0';

try {
  if (typeof listenPort === 'string') {
    server.listen(listenPort, () => {
      console.log(`Event tracker listening on socket ${listenPort}`);
    });
  } else {
    server.listen(listenPort, listenHost, () => {
      console.log(`Event tracker listening on ${listenHost}:${listenPort} (DB ${config.dbPath})`);
    });
  }
} catch (err) {
  console.warn('Cảnh báo server listen (sẽ tiếp tục qua handler):', err.message);
}

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
