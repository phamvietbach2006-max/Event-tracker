import { createHash, createPublicKey, createVerify, randomBytes, timingSafeEqual } from 'node:crypto';
import { createSession, parseCookies, setSessionCookie } from '../lib/session.js';

// Đăng nhập Microsoft Entra ID (OIDC, code flow + PKCE). Chỉ nhận email đã có trong bảng users.
const PENDING_TTL_MS = 10 * 60 * 1000;
const SKEW_S = 60;
const pending = new Map(); // id cookie -> { state, nonce, verifier, exp }
const metas = new Map(); // authority -> { doc, keys, at }

const rand = (n = 32) => randomBytes(n).toString('base64url');
const redirect = (res, loc) => res.writeHead(302, { Location: loc, 'Cache-Control': 'no-store' }).end();
const safeEq = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function getJson(url, init) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${new URL(url).pathname}`);
  return r.json();
}

async function discovery(sso) {
  let meta = metas.get(sso.authority);
  if (!meta) metas.set(sso.authority, meta = { doc: null, keys: null, at: 0 });
  if (!meta.doc || Date.now() - meta.at > 3600e3) {
    meta.doc = await getJson(`${sso.authority}/.well-known/openid-configuration`);
    meta.keys = null;
    meta.at = Date.now();
  }
  return meta.doc;
}

async function keyFor(sso, kid) {
  const doc = await discovery(sso);
  const meta = metas.get(sso.authority);
  let jwk = meta.keys?.find((k) => k.kid === kid);
  if (!jwk) {
    meta.keys = (await getJson(doc.jwks_uri)).keys ?? []; // khoá xoay vòng: tải lại khi gặp kid lạ
    jwk = meta.keys.find((k) => k.kid === kid);
  }
  if (!jwk) throw new Error('kid lạ');
  return createPublicKey({ key: jwk, format: 'jwk' });
}

async function verifyIdToken(sso, idToken, nonce) {
  const [h, p, s, extra] = String(idToken).split('.');
  if (!h || !p || !s || extra !== undefined) throw new Error('token sai định dạng');
  const head = JSON.parse(Buffer.from(h, 'base64url'));
  if (head.alg !== 'RS256') throw new Error('alg không hợp lệ');
  const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(await keyFor(sso, head.kid), Buffer.from(s, 'base64url'));
  if (!ok) throw new Error('chữ ký sai');
  const c = JSON.parse(Buffer.from(p, 'base64url'));
  const doc = await discovery(sso);
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (c.iss !== doc.issuer) throw new Error('iss sai');
  if (!aud.includes(sso.clientId)) throw new Error('aud sai');
  if (typeof c.exp !== 'number' || c.exp + SKEW_S < Date.now() / 1000) throw new Error('hết hạn');
  if (typeof c.nonce !== 'string' || !safeEq(c.nonce, nonce)) throw new Error('nonce sai');
  if (sso.tenantId && c.tid !== sso.tenantId) throw new Error('tenant sai');
  return c;
}

function purge() {
  const now = Date.now();
  for (const [k, v] of pending) if (v.exp < now) pending.delete(k);
}

const bindCookie = (req, value, maxAge) => {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `sso=${value}; HttpOnly; SameSite=Lax; Path=/auth; Max-Age=${maxAge}${secure}`;
};

export async function ssoStart({ req, res, config }) {
  const sso = config.sso;
  purge();
  const id = rand(), state = rand(), nonce = rand(), verifier = rand(48);
  pending.set(id, { state, nonce, verifier, exp: Date.now() + PENDING_TTL_MS });
  const doc = await discovery(sso);
  const q = new URLSearchParams({
    client_id: sso.clientId, response_type: 'code', redirect_uri: sso.redirectUri,
    response_mode: 'query', scope: 'openid email profile', state, nonce,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
  });
  res.setHeader('Set-Cookie', bindCookie(req, id, PENDING_TTL_MS / 1000));
  redirect(res, `${doc.authorization_endpoint}?${q}`);
}

export async function ssoCallback({ req, res, db, url, config }) {
  const sso = config.sso;
  const id = parseCookies(req.headers.cookie).sso;
  const p = id && pending.get(id);
  if (id) pending.delete(id); // dùng một lần
  const clear = bindCookie(req, '', 0);
  const fail = (loc = '/?login=failed') => { res.setHeader('Set-Cookie', clear); redirect(res, loc); };
  const q = url.searchParams;
  const state = q.get('state'), code = q.get('code');
  if (!p || p.exp < Date.now() || !state || !safeEq(state, p.state) || q.get('error') || !code) return fail();
  try {
    const doc = await discovery(sso);
    const tok = await getJson(doc.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: sso.redirectUri,
        client_id: sso.clientId, client_secret: sso.clientSecret, code_verifier: p.verifier,
      }),
    });
    const c = await verifyIdToken(sso, tok.id_token, p.nonce);
    const email = c.email ?? c.preferred_username;
    if (typeof email !== 'string' || !email.includes('@')) return fail();
    const u = db.prepare('SELECT email FROM users WHERE lower(email) = ?').get(email.trim().toLowerCase());
    if (!u) return fail('/?login=denied');
    setSessionCookie(req, res, createSession(db, u.email));
    res.setHeader('Set-Cookie', [res.getHeader('Set-Cookie'), clear]);
    redirect(res, '/');
  } catch (e) {
    console.error('SSO lỗi:', e.message);
    fail();
  }
}
