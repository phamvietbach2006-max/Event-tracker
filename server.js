import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from './lib/db.js';
import { createApp } from './lib/app.js';
import { isEmpty, applySeed, ensureTokens } from './lib/seed.js';

const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '127.0.0.1',
  dbPath: process.env.DB_PATH ?? 'app.db',
  baseUrl: (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  seedFile: process.env.SEED_FILE ?? fileURLToPath(new URL('./seed.json', import.meta.url)),
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
