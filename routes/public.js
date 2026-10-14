import { getState, getVisits, getContacts } from '../lib/db.js';

export function registerPublic(router) {
  router.add('GET', '/api/state', ({ db }) => getState(db));
  router.add('GET', '/api/stats', ({ db, sse }) => ({ online: sse.size(), visits: getVisits(db) }));
  router.add('GET', '/api/contacts', ({ db, user }) => {
    const list = getContacts(db);
    if (!user) {
      return list.map((c) => ({ ...c, student_id: null }));
    }
    return list;
  });
  router.add('GET', '/events', ({ req, res, sse }) => { sse.add(req, res); });
}
