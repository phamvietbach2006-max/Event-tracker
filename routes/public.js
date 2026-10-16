import { getState, getVisits, getContacts } from '../lib/db.js';

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
}
