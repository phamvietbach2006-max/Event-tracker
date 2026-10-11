import { openDb } from '../lib/db.js';
import { createApp } from '../lib/app.js';
import { createSession } from '../lib/session.js';
import { applySeed } from '../lib/seed.js';

// Id cố định: khu 1 = Hội trường C2, 2 = Sảnh C2, 3 = Cổng chính; việc 1,2 (khu 1), 3 (khu 2), 4 (khu 3)
export const SEED = {
  users: [
    { email: 'admin@t.test', name: 'Quản Trị', isAdmin: true },
    { email: 'owner@t.test', name: 'Chủ Khu' },
    { email: 'other@t.test', name: 'Người Khác' },
    { email: 'nobody@t.test', name: 'Không Khu' },
  ],
  groups: [
    { name: 'Khối C2', rooms: [
      { name: 'Hội trường C2', owners: ['owner@t.test'], tasks: [['Sắp xếp ghế', 'todo'], ['Âm thanh', 'done']] },
      { name: 'Sảnh C2', owners: ['owner@t.test'], tasks: [['Bàn đón tiếp', 'todo']] },
    ] },
    { name: 'Khối An ninh', rooms: [
      { name: 'Cổng chính', owners: ['other@t.test'], tasks: [['Rào chắn', 'todo']] },
    ] },
  ],
};

export async function startApp(seed = SEED) {
  const db = openDb();
  applySeed(db, seed);
  const app = createApp({ db, config: { baseUrl: 'http://localhost' }, sseOptions: { debounceMs: 20 } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const cookieFor = (email) => `sid=${createSession(db, email)}`;
  async function call(method, path, { as, cookie, body, raw, headers = {} } = {}) {
    const h = { ...headers };
    if (body !== undefined || raw !== undefined) h['content-type'] = 'application/json';
    const c = cookie ?? (as ? cookieFor(as) : null);
    if (c) h.cookie = c;
    const res = await fetch(base + path, {
      method, headers: h, redirect: 'manual',
      body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
    });
    const t = await res.text();
    return { status: res.status, body: t ? JSON.parse(t) : null, headers: res.headers };
  }
  return { db, app, base, call, cookieFor, close: () => app.close() };
}

export async function openSse(base) {
  const ac = new AbortController();
  const res = await fetch(base + '/events', { signal: ac.signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  async function next(timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const i = buf.indexOf('\n\n');
      if (i >= 0) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (frame.startsWith('data: ')) return JSON.parse(frame.slice(6));
        continue;
      }
      const left = deadline - Date.now();
      if (left <= 0) throw new Error('SSE timeout');
      let timer;
      const r = await Promise.race([
        reader.read(),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('SSE timeout')), left); }),
      ]).finally(() => clearTimeout(timer));
      if (r.done) throw new Error('SSE closed');
      buf += dec.decode(r.value, { stream: true });
    }
  }
  return { res, next, abort: () => ac.abort() };
}
