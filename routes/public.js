import { getState } from '../lib/db.js';

export function registerPublic(router) {
  router.add('GET', '/api/state', ({ db }) => getState(db));
  router.add('GET', '/events', ({ req, res, sse }) => { sse.add(req, res); });
}
