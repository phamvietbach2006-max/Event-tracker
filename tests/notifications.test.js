import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

test('thông báo hệ thống: phân quyền gửi và nhận thông báo theo cấp bậc', async () => {
  const t = await startApp();

  try {
    // 1. Khách hoặc cán bộ thường không được gửi thông báo
    const rGuest = await t.call('POST', '/api/notifications', {
      body: { title: 'Test', content: 'Test', targetType: 'all' },
    });
    assert.equal(rGuest.status, 401);

    const rOfficer = await t.call('POST', '/api/notifications', {
      as: 'owner@t.test',
      body: { title: 'Test', content: 'Test', targetType: 'all' },
    });
    assert.equal(rOfficer.status, 403);

    // 2. Admin lấy danh sách mục tiêu gửi thông báo
    const rTargets = await t.call('GET', '/api/notifications/targets', { as: 'admin@t.test' });
    assert.equal(rTargets.status, 200);
    assert.equal(rTargets.body.canBroadcastAll, true);
    assert.ok(Array.isArray(rTargets.body.buildings));
    assert.ok(Array.isArray(rTargets.body.users));

    // 3. Admin gửi thông báo toàn hệ thống (targetType: 'all')
    const rSendAll = await t.call('POST', '/api/notifications', {
      as: 'admin@t.test',
      body: {
        title: 'Thông báo khẩn cấp Ban Thường vụ',
        content: 'Yêu cầu các chi đoàn K71 hoàn thành kiểm tra trước 11h30',
        level: 'urgent',
        targetType: 'all',
      },
    });
    assert.equal(rSendAll.status, 200);
    assert.ok(rSendAll.body.notification?.id);
    const notifId = rSendAll.body.notification.id;

    // 4. Cán bộ thường nhận được thông báo trong hộp thư của mình
    const rInbox = await t.call('GET', '/api/notifications', { as: 'owner@t.test' });
    assert.equal(rInbox.status, 200);
    assert.ok(rInbox.body.notifications.length >= 1);
    const found = rInbox.body.notifications.find((n) => n.id === notifId);
    assert.ok(found);
    assert.equal(found.title, 'Thông báo khẩn cấp Ban Thường vụ');
    assert.equal(found.is_read, 0);

    // 5. Cán bộ đánh dấu đã đọc thông báo này
    const rRead = await t.call('POST', `/api/notifications/${notifId}/read`, { as: 'owner@t.test' });
    assert.equal(rRead.status, 200);
    assert.equal(rRead.body.ok, true);

    // Kiểm tra lại trạng thái đã đọc
    const rInboxAfter = await t.call('GET', '/api/notifications', { as: 'owner@t.test' });
    const foundAfter = rInboxAfter.body.notifications.find((n) => n.id === notifId);
    assert.equal(foundAfter.is_read, 1);

    // 6. Đánh dấu tất cả đã đọc
    const rReadAll = await t.call('POST', '/api/notifications/read-all', { as: 'owner@t.test' });
    assert.equal(rReadAll.status, 200);
    assert.equal(rReadAll.body.ok, true);
  } finally {
    await t.close();
  }
});
