import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash, createSign, generateKeyPairSync } from 'node:crypto';
import { openDb } from '../lib/db.js';
import { createApp } from '../lib/app.js';
import { applySeed } from '../lib/seed.js';
import { SEED } from './helpers.js';

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const TENANT = 'tenant-1';
const CLIENT = 'client-1';

// IdP giả: discovery + jwks + token. Test đóng vai trình duyệt: đọc state/nonce từ /auth/sso/start.
async function startIdp() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
  const st = { tokenStatus: 200, claims: {}, signWith: privateKey, header: {}, lastToken: null, jwksHits: 0 };
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const json = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(o)); };
    if (u.pathname.endsWith('/.well-known/openid-configuration')) {
      return json(200, {
        issuer: `${base}/${TENANT}/v2.0`,
        authorization_endpoint: `${base}/authorize`,
        token_endpoint: `${base}/token`,
        jwks_uri: `${base}/jwks`,
      });
    }
    if (u.pathname === '/jwks') { st.jwksHits++; return json(200, { keys: [jwk] }); }
    if (u.pathname === '/token') {
      let body = '';
      for await (const c of req) body += c;
      const f = new URLSearchParams(body);
      st.lastToken = Object.fromEntries(f);
      if (st.tokenStatus !== 200) return json(st.tokenStatus, { error: 'invalid_grant' });
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        iss: `${base}/${TENANT}/v2.0`, aud: CLIENT, iat: now, exp: now + 600,
        nonce: st.nonce, tid: TENANT, email: 'owner@t.test', ...st.claims,
      };
      for (const k of Object.keys(claims)) if (claims[k] === undefined) delete claims[k];
      const head = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT', ...st.header });
      const data = `${head}.${b64(claims)}`;
      const sig = st.header.alg === 'none' ? '' : createSign('RSA-SHA256').update(data).sign(st.signWith ?? privateKey).toString('base64url');
      return json(200, { id_token: `${data}.${sig}`, access_token: 'x', token_type: 'Bearer' });
    }
    json(404, {});
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return { st, base, otherKey: other.privateKey, close: () => new Promise((r) => { srv.close(r); srv.closeAllConnections(); }) };
}

async function startSsoApp() {
  const idp = await startIdp();
  const db = openDb();
  applySeed(db, SEED);
  const config = {
    baseUrl: 'https://sk.test',
    sso: { authority: `${idp.base}/${TENANT}/v2.0`, tenantId: TENANT, clientId: CLIENT, clientSecret: 'sec-123', redirectUri: 'https://sk.test/auth/callback' },
  };
  const app = createApp({ db, config, sseOptions: { debounceMs: 20 } });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const get = (path, cookie) => fetch(base + path, { redirect: 'manual', headers: cookie ? { cookie } : {} });
  // Bấm "Đăng nhập": lấy state/nonce và cookie ràng buộc trình duyệt
  async function begin() {
    const r = await get('/auth/sso/start');
    const loc = new URL(r.headers.get('location'));
    idp.st.nonce = loc.searchParams.get('nonce');
    return { r, loc, state: loc.searchParams.get('state'), cookie: r.headers.get('set-cookie').split(';')[0] };
  }
  return { idp, db, base, get, begin, close: async () => { await app.close(); await idp.close(); } };
}

test('SSO start: chuyển sang Microsoft với PKCE, state, nonce; đặt cookie ràng buộc', async () => {
  const t = await startSsoApp();
  try {
    const { r, loc } = await t.begin();
    assert.equal(r.status, 302);
    assert.equal(`${loc.origin}${loc.pathname}`, `${t.idp.base}/authorize`);
    const q = loc.searchParams;
    assert.equal(q.get('client_id'), CLIENT);
    assert.equal(q.get('response_type'), 'code');
    assert.equal(q.get('redirect_uri'), 'https://sk.test/auth/callback');
    assert.match(q.get('scope'), /openid/);
    assert.match(q.get('scope'), /email/);
    assert.equal(q.get('code_challenge_method'), 'S256');
    assert.ok(q.get('code_challenge').length >= 43);
    assert.ok(q.get('state').length >= 20 && q.get('nonce').length >= 20);
    const sc = r.headers.get('set-cookie');
    assert.match(sc, /^sso=[A-Za-z0-9_-]+; HttpOnly; SameSite=Lax; Path=\/auth; Max-Age=600/);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  } finally { await t.close(); }
});

test('SSO callback: đúng → phiên theo email (không phân biệt hoa thường), dùng PKCE + secret', async () => {
  const t = await startSsoApp();
  try {
    t.idp.st.claims = { email: 'Owner@T.Test' };
    const { loc, state, cookie } = await t.begin();
    const r = await t.get(`/auth/callback?code=abc&state=${state}`, cookie);
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/');
    const sc = r.headers.get('set-cookie');
    assert.match(sc, /sid=[0-9a-f]{64}/);
    const sid = sc.split(',').map((x) => x.trim()).find((x) => x.startsWith('sid=')).split(';')[0];
    const me = await (await t.get('/api/me', sid)).json();
    assert.equal(me.email, 'owner@t.test');
    assert.deepEqual(me.ownedRoomIds, [1, 2]);
    const f = t.idp.st.lastToken;
    assert.equal(f.grant_type, 'authorization_code');
    assert.equal(f.code, 'abc');
    assert.equal(f.client_secret, 'sec-123');
    assert.equal(f.redirect_uri, 'https://sk.test/auth/callback');
    assert.equal(createHash('sha256').update(f.code_verifier).digest('base64url'), loc.searchParams.get('code_challenge'));
  } finally { await t.close(); }
});

test('SSO callback: không có email thì dùng preferred_username', async () => {
  const t = await startSsoApp();
  try {
    t.idp.st.claims = { email: undefined, preferred_username: 'other@t.test' };
    const { state, cookie } = await t.begin();
    const r = await t.get(`/auth/callback?code=abc&state=${state}`, cookie);
    assert.equal(r.headers.get('location'), '/');
    assert.match(r.headers.get('set-cookie'), /sid=/);
  } finally { await t.close(); }
});

test('SSO callback: email HUST chưa có trong danh sách → /?login=denied, không có phiên', async () => {
  const t = await startSsoApp();
  try {
    t.idp.st.claims = { email: 'la@hust.edu.vn' };
    const { state, cookie } = await t.begin();
    const r = await t.get(`/auth/callback?code=abc&state=${state}`, cookie);
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/?login=denied');
    assert.ok(!(r.headers.get('set-cookie') ?? '').includes('sid='));
  } finally { await t.close(); }
});

const FAIL = '/?login=failed';
async function expectFail(t, mutate, { stateOverride, noCookie, query } = {}) {
  if (mutate) mutate(t.idp.st);
  const { state, cookie } = await t.begin();
  const r = await t.get(`/auth/callback?${query ?? `code=abc&state=${stateOverride ?? state}`}`, noCookie ? undefined : cookie);
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), FAIL);
  assert.ok(!(r.headers.get('set-cookie') ?? '').includes('sid='), 'không được tạo phiên');
}

test('SSO callback: từ chối khi thiếu cookie, sai state, thiếu state, IdP báo lỗi', async () => {
  const t = await startSsoApp();
  try {
    await expectFail(t, null, { noCookie: true });
    await expectFail(t, null, { stateOverride: 'khac-state-0123456789abcdef' });
    await expectFail(t, null, { query: 'code=abc' });
    await expectFail(t, null, { query: 'error=access_denied&error_description=x' });
    await expectFail(t, null, { query: 'state=abc' });
  } finally { await t.close(); }
});

test('SSO callback: state chỉ dùng được một lần', async () => {
  const t = await startSsoApp();
  try {
    const { state, cookie } = await t.begin();
    const a = await t.get(`/auth/callback?code=abc&state=${state}`, cookie);
    assert.equal(a.headers.get('location'), '/');
    const b = await t.get(`/auth/callback?code=abc&state=${state}`, cookie);
    assert.equal(b.headers.get('location'), FAIL);
  } finally { await t.close(); }
});

test('SSO callback: id_token sai (nonce, aud, iss, hết hạn, tenant, chữ ký, alg) → failed', async () => {
  const t = await startSsoApp();
  try {
    await expectFail(t, (s) => { s.claims = { nonce: 'sai-nonce' }; });
    await expectFail(t, (s) => { s.claims = { aud: 'app-khac' }; });
    await expectFail(t, (s) => { s.claims = { iss: 'https://evil.example/v2.0' }; });
    await expectFail(t, (s) => { s.claims = { exp: Math.floor(Date.now() / 1000) - 3600 }; });
    await expectFail(t, (s) => { s.claims = { tid: 'tenant-khac' }; });
    await expectFail(t, (s) => { s.claims = {}; s.signWith = t.idp.otherKey; });
    await expectFail(t, (s) => { s.signWith = undefined; s.header = { alg: 'none' }; });
    await expectFail(t, (s) => { s.header = { alg: 'HS256' }; });
    await expectFail(t, (s) => { s.header = { kid: 'khong-co' }; s.signWith = undefined; });
  } finally { await t.close(); }
});

test('SSO callback: đổi code thất bại hoặc không có email → failed', async () => {
  const t = await startSsoApp();
  try {
    await expectFail(t, (s) => { s.tokenStatus = 400; });
    await expectFail(t, (s) => { s.tokenStatus = 200; s.claims = { email: undefined, preferred_username: undefined }; });
    await expectFail(t, (s) => { s.claims = { email: 123 }; });
  } finally { await t.close(); }
});
