import http from 'node:http';
import { getState, getVisits, incrementVisits } from './db.js';
import { HttpError, send, readJson, createRouter, checkOrigin } from './http.js';
import { getUser, purgeExpired } from './session.js';
import { createSse } from './sse.js';
import { registerPublic } from '../routes/public.js';
import { registerAuth } from '../routes/auth.js';
import { registerRooms } from '../routes/rooms.js';
import { registerAdmin } from '../routes/admin.js';

export function createApp({ db, config, sseOptions }) {
  purgeExpired(db);
  const sse = createSse(() => getState(db), {
    ...sseOptions,
    onConnect: () => incrementVisits(db),
    getVisits: () => getVisits(db),
  });
  const router = createRouter();
  registerPublic(router);
  registerAuth(router);
  registerRooms(router);
  registerAdmin(router);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://local');
      checkOrigin(req);
      const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await readJson(req) : undefined;
      const m = router.match(req.method, url.pathname);
      if (!m) throw new HttpError(404, 'not_found', 'Không tìm thấy');
      const user = getUser(db, req);
      const out = await m.handler({ req, res, url, params: m.params, body, user, db, config, sse });
      if (out !== undefined) send(res, 200, out);
    } catch (e) {
      if (res.headersSent) { res.end(); return; }
      if (e instanceof HttpError) send(res, e.status, { error: e.code, message: e.message });
      else {
        console.error(e);
        send(res, 500, { error: 'server_error', message: 'Lỗi máy chủ' });
      }
    }
  });

  return {
    server,
    sse,
    close() {
      sse.close();
      return new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    },
  };
}
