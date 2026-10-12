import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';
import { hashToken } from '../auth/token.js';

test('/api/me: khách → null; chủ khu; admin', async () => {
  const t = await startApp();
  try {
    assert.deepEqual((await t.call('GET', '/api/me')).body, null);
    const o = await t.call('GET', '/api/me', { as: 'owner@t.test' });
    assert.deepEqual(o.body, { email: 'owner@t.test', name: 'Chủ Khu', isAdmin: false, ownedRoomIds: [1, 2] });
    const a = await t.call('GET', '/api/me', { as: 'admin@t.test' });
    assert.equal(a.body.isAdmin, true);
    assert.deepEqual(a.body.ownedRoomIds, []);
  } finally { await t.close(); }
});

test('/api/me: cookie rác hoặc phiên hết hạn → khách, không lỗi', async () => {
  const t = await startApp();
  try {
    for (const cookie of ['sid=rac', 'sid=%E0%A4%A', 'khong-co-dau-bang', 'sid=']) {
      const r = await t.call('GET', '/api/me', { cookie });
      assert.equal(r.status, 200);
      assert.equal(r.body, null);
    }
    const cookie = t.cookieFor('owner@t.test');
    t.db.prepare('UPDATE sessions SET expires_at = 1').run();
    assert.equal((await t.call('GET', '/api/me', { cookie })).body, null);
  } finally { await t.close(); }
});

test('link riêng: đúng token → 302 / + cookie dùng được; sai token → /?login=failed, không cookie', async () => {
  const t = await startApp();
  try {
    t.db.prepare("UPDATE users SET token='tok-owner-0123456789abcdef' WHERE email='owner@t.test'").run();
    const ok = await t.call('GET', '/auth/token?t=tok-owner-0123456789abcdef');
    assert.equal(ok.status, 302);
    assert.equal(ok.headers.get('location'), '/');
    const setCookie = ok.headers.get('set-cookie');
    assert.match(setCookie, /^sid=[0-9a-f]{64}; HttpOnly; SameSite=Lax; Path=\//);
    assert.ok(!setCookie.includes('Secure'));
    const me = await t.call('GET', '/api/me', { cookie: setCookie.split(';')[0] });
    assert.equal(me.body.email, 'owner@t.test');

    const bad = await t.call('GET', '/auth/token?t=sai-sai-sai-sai-sai-sai-sai');
    assert.equal(bad.status, 302);
    assert.equal(bad.headers.get('location'), '/?login=failed');
    assert.equal(bad.headers.get('set-cookie'), null);
    assert.equal((await t.call('GET', '/auth/token')).headers.get('location'), '/?login=failed');

    const raw = 'tok-hashed-0123456789abcdef';
    t.db.prepare("UPDATE users SET token=? WHERE email='owner@t.test'").run(hashToken(raw));
    const okHashed = await t.call(`GET`, `/auth/token?t=${raw}`);
    assert.equal(okHashed.status, 302);
    assert.equal(okHashed.headers.get('location'), '/');
  } finally { await t.close(); }
});

test('cookie có Secure khi qua HTTPS (nginx gửi X-Forwarded-Proto)', async () => {
  const t = await startApp();
  try {
    t.db.prepare("UPDATE users SET token='tok-owner-0123456789abcdef' WHERE email='owner@t.test'").run();
    const r = await t.call('GET', '/auth/token?t=tok-owner-0123456789abcdef', { headers: { 'x-forwarded-proto': 'https' } });
    assert.match(r.headers.get('set-cookie'), /; Secure/);
  } finally { await t.close(); }
});

test('đăng xuất: 204, phiên bị xoá', async () => {
  const t = await startApp();
  try {
    const cookie = t.cookieFor('owner@t.test');
    const r = await t.call('POST', '/auth/logout', { cookie });
    assert.equal(r.status, 204);
    assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await t.call('GET', '/api/me', { cookie })).body, null);
    assert.equal((await t.call('POST', '/auth/logout')).status, 204);
  } finally { await t.close(); }
});

test('SSO chưa cấu hình → 501', async () => {
  const t = await startApp();
  try {
    for (const p of ['/auth/sso/start', '/auth/callback']) {
      const r = await t.call('GET', p);
      assert.equal(r.status, 501);
      assert.equal(r.body.error, 'sso_not_configured');
    }
  } finally { await t.close(); }
});
