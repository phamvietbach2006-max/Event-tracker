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

test('POST /api/auth/login: đăng nhập mật khẩu chung và tài khoản cá nhân', async () => {
  const t = await startApp();
  try {
    // 1. Đăng nhập bằng mật khẩu chung mặc định Abc@123456767
    const res1 = await t.call('POST', '/api/auth/login', {
      body: { email: 'owner@t.test', password: 'Abc@123456767' },
    });
    assert.equal(res1.status, 200);
    assert.equal(res1.body.ok, true);
    assert.equal(res1.body.user.email, 'owner@t.test');
    assert.equal(res1.body.user.isAdmin, false);
    const setCookie = res1.headers.get('set-cookie');
    assert.match(setCookie, /^sid=[0-9a-f]{64};/);

    // 2. Dùng cookie vừa nhận để gọi /api/me
    const meRes = await t.call('GET', '/api/me', { cookie: setCookie.split(';')[0] });
    assert.equal(meRes.body.email, 'owner@t.test');

    // 3. Đăng nhập bằng prefix username (owner thay vì owner@t.test)
    const res2 = await t.call('POST', '/api/auth/login', {
      body: { email: 'owner', password: 'Abc@123456767' },
    });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.user.email, 'owner@t.test');

    // 4. Sai mật khẩu → 401
    const resBad = await t.call('POST', '/api/auth/login', {
      body: { email: 'owner@t.test', password: 'SaiMatKhau123' },
    });
    assert.equal(resBad.status, 401);
    assert.equal(resBad.body.error, 'invalid_credentials');

    // 5. Thiếu thông tin → 400
    const resEmpty = await t.call('POST', '/api/auth/login', {
      body: { email: '', password: '' },
    });
    assert.equal(resEmpty.status, 400);
  } finally {
    await t.close();
  }
});

test('POST /api/auth/change-password: đổi mật khẩu', async () => {
  const t = await startApp();
  try {
    const cookie = t.cookieFor('owner@t.test');

    // 1. Đổi mật khẩu thành công
    const resChange = await t.call('POST', '/api/auth/change-password', {
      cookie,
      body: { oldPassword: 'Abc@123456767', newPassword: 'NewSecurePass@2026' },
    });
    assert.equal(resChange.status, 200);
    assert.equal(resChange.body.ok, true);

    // 2. Thử đăng nhập lại bằng mật khẩu mới
    const resNew = await t.call('POST', '/api/auth/login', {
      body: { email: 'owner@t.test', password: 'NewSecurePass@2026' },
    });
    assert.equal(resNew.status, 200);
    assert.equal(resNew.body.user.email, 'owner@t.test');

    // 3. Mật khẩu cũ không còn tác dụng
    const resOld = await t.call('POST', '/api/auth/login', {
      body: { email: 'owner@t.test', password: 'Abc@123456767' },
    });
    assert.equal(resOld.status, 401);

    // 4. Mật khẩu quá ngắn → 400
    const resShort = await t.call('POST', '/api/auth/change-password', {
      cookie,
      body: { oldPassword: 'NewSecurePass@2026', newPassword: '123' },
    });
    assert.equal(resShort.status, 400);
    assert.equal(resShort.body.error, 'weak_password');
  } finally {
    await t.close();
  }
});
