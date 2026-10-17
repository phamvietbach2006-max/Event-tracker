import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { getState, getVisits, getContacts } from '../lib/db.js';

function sendStatic(res, filename, mimeType) {
  const candidates = [
    path.join(process.cwd(), 'web', 'public', filename),
    path.join(process.cwd(), 'web', 'dist', filename),
    path.join(process.cwd(), 'public', filename),
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      try {
        const data = readFileSync(c);
        res.writeHead(200, {
          'Content-Type': mimeType,
          'Content-Length': data.length,
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
        return;
      } catch {}
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('File not found');
}

export function registerPublic(router) {
  router.add('GET', '/', () => ({ ok: true, name: 'event-tracker-api' }));
  router.add('GET', '/health', () => ({ status: 'healthy', uptime: process.uptime() }));
  router.add('GET', '/api/health', () => ({ status: 'healthy', uptime: process.uptime() }));
  router.add('GET', '/api/state', ({ db, res }) => {
    res.setHeader?.('Cache-Control', 'public, max-age=1, s-maxage=2, stale-while-revalidate=4');
    return getState(db);
  });
  router.add('GET', '/api/stats', ({ db, sse, res }) => {
    res.setHeader?.('Cache-Control', 'public, max-age=2, s-maxage=3, stale-while-revalidate=6');
    return { online: sse.size(), visits: getVisits(db) };
  });
  router.add('GET', '/api/contacts', ({ db, user, res }) => {
    try {
      res.setHeader?.('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
      const list = getContacts(db);
      if (!user) {
        return list.map((c) => ({ ...c, student_id: null }));
      }
      return list;
    } catch (err) {
      console.warn('Cảnh báo khi truy vấn getContacts:', err.message);
      try {
        const rows = db.prepare('SELECT email, name, phone, position, department, team, cohort, role FROM users').all();
        return rows.map((c) => ({ ...c, student_id: null }));
      } catch {
        return [];
      }
    }
  });
  router.add('GET', '/events', ({ req, res, user, sse }) => { sse.add(req, res, user); });

  // Static assets fallbacks for logos and favicon
  router.add('GET', '/logo.png', ({ res }) => sendStatic(res, 'logo.png', 'image/png'));
  router.add('GET', '/logo-emblem.png', ({ res }) => sendStatic(res, 'logo-emblem.png', 'image/png'));
  router.add('GET', '/logo-full.png', ({ res }) => sendStatic(res, 'logo-full.png', 'image/png'));
  router.add('GET', '/logo-dyc.png', ({ res }) => sendStatic(res, 'logo-dyc.png', 'image/png'));
  router.add('GET', '/logo-70-hust.svg', ({ res }) => sendStatic(res, 'logo-70-hust.svg', 'image/svg+xml'));
  router.add('GET', '/favicon.ico', ({ res }) => sendStatic(res, 'favicon.ico', 'image/x-icon'));
}
