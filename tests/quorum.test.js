import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

test('phê duyệt ngoại lệ sĩ số: gửi yêu cầu nhiều lần, phân cấp thẩm quyền (admin tối cao), và mẫu nhận xét', async () => {
  const t = await startApp();

  try {
    // Thiết lập thêm tài khoản Floor lead (phụ trách nhóm 1: Khối C2)
    t.db.prepare("INSERT INTO users(email, name, is_admin, role) VALUES ('floor@t.test', 'Trưởng Tầng C2', 0, 'floor_lead')").run();
    t.db.prepare('INSERT INTO user_groups(email, group_id) VALUES (?, ?)').run('floor@t.test', 1);

    // Lớp 1 (Hội trường C2): đặt sĩ số 10/30 (chưa đủ 2/3)
    await t.call('PATCH', '/api/rooms/1/attendance', {
      as: 'owner@t.test',
      body: { attendees: 10, totalMembers: 30 },
    });

    // Hoàn thành hết task để kiểm tra riêng điều kiện sĩ số
    t.db.prepare("UPDATE tasks SET state = 'done' WHERE room_id = 1").run();

    // 1. Chuyển sang yellow bị chặn vì sĩ số chưa đủ 2/3 (10/30 < 20/30)
    const rBlocked = await t.call('PATCH', '/api/rooms/1/status', {
      as: 'owner@t.test',
      body: { status: 'yellow' },
    });
    assert.equal(rBlocked.status, 400);
    assert.equal(rBlocked.body.error, 'attendance_not_met');

    // 2. Cán bộ gửi yêu cầu phê duyệt ngoại lệ sĩ số
    const rReq1 = await t.call('POST', '/api/rooms/1/quorum-request', {
      as: 'owner@t.test',
      body: { targetType: 'both', attendees: 10, totalMembers: 30 },
    });
    assert.equal(rReq1.status, 200);
    assert.equal(rReq1.body.ok, true);
    assert.equal(rReq1.body.targetType, 'both');
    const reqId1 = rReq1.body.requestId;

    // 3. Có thể gửi yêu cầu nhiều lần cho 1 chi đoàn (ví dụ cập nhật lên 15/30)
    const rReq2 = await t.call('POST', '/api/rooms/1/quorum-request', {
      as: 'owner@t.test',
      body: { targetType: 'both', attendees: 15, totalMembers: 30 },
    });
    assert.equal(rReq2.status, 200);
    const reqId2 = rReq2.body.requestId;
    assert.notEqual(reqId1, reqId2);

    // 4. Kiểm tra danh sách yêu cầu chờ duyệt (GET /api/quorum-requests/pending)
    // - Khách / Cán bộ lớp: rỗng
    const rPendingOfficer = await t.call('GET', '/api/quorum-requests/pending', { as: 'owner@t.test' });
    assert.equal(rPendingOfficer.body.requests.length, 0);

    // - Phụ trách tầng C2: thấy các yêu cầu của tầng mình
    const rPendingFloor = await t.call('GET', '/api/quorum-requests/pending', { as: 'floor@t.test' });
    assert.ok(rPendingFloor.body.requests.some((r) => r.id === reqId2));

    // - Admin: thấy toàn bộ yêu cầu
    const rPendingAdmin = await t.call('GET', '/api/quorum-requests/pending', { as: 'admin@t.test' });
    assert.ok(rPendingAdmin.body.requests.some((r) => r.id === reqId2));

    // 5. Test Phân cấp Thẩm quyền (Hierarchical Decision Rules):
    // Kịch bản A: Phụ trách tầng duyệt trước (Admin chưa duyệt) -> Được thực thi tạm thời
    const rFloorApprove = await t.call('POST', `/api/quorum-requests/${reqId2}/decision`, {
      as: 'floor@t.test',
      body: { decision: 'approved' },
    });
    assert.equal(rFloorApprove.status, 200);
    assert.equal(rFloorApprove.body.roomExempt, true);

    // Lớp đã được gỡ yêu cầu 2/3 -> chuyển status sang yellow thành công!
    const rYellowOk = await t.call('PATCH', '/api/rooms/1/status', {
      as: 'owner@t.test',
      body: { status: 'yellow' },
    });
    assert.equal(rYellowOk.status, 200);
    assert.equal(rYellowOk.body.status, 'yellow');

    // Kịch bản B: "admin không duyệt mà phụ trách tầng duyệt thì không thực thi tại admin có quyền lực lớn nhất, phải nghe theo admin"
    // Admin sau đó từ chối -> Quyết định Admin ghi đè -> Không thực thi (gỡ cờ quorum_exempt = 0)
    const rAdminReject = await t.call('POST', `/api/quorum-requests/${reqId2}/decision`, {
      as: 'admin@t.test',
      body: { decision: 'rejected' },
    });
    assert.equal(rAdminReject.status, 200);
    assert.equal(rAdminReject.body.roomExempt, false);

    // Lớp quay lại yêu cầu 2/3 -> cố chuyển sang green sẽ bị chặn lại vì sĩ số chưa đủ 2/3!
    const rGreenBlocked = await t.call('PATCH', '/api/rooms/1/status', {
      as: 'owner@t.test',
      body: { status: 'green' },
    });
    assert.equal(rGreenBlocked.status, 400);
    assert.equal(rGreenBlocked.body.error, 'attendance_not_met');

    // Kịch bản C: "nếu admin duyệt mà phụ trách tầng không duyệt vẫn thực thi"
    // Gửi yêu cầu thứ 3
    const rReq3 = await t.call('POST', '/api/rooms/1/quorum-request', {
      as: 'owner@t.test',
      body: { targetType: 'both', attendees: 18, totalMembers: 30 },
    });
    const reqId3 = rReq3.body.requestId;

    // Phụ trách tầng từ chối
    await t.call('POST', `/api/quorum-requests/${reqId3}/decision`, {
      as: 'floor@t.test',
      body: { decision: 'rejected' },
    });

    // Nhưng Admin duyệt -> Vẫn thực thi!
    const rAdminApproveOverride = await t.call('POST', `/api/quorum-requests/${reqId3}/decision`, {
      as: 'admin@t.test',
      body: { decision: 'approved' },
    });
    assert.equal(rAdminApproveOverride.status, 200);
    assert.equal(rAdminApproveOverride.body.roomExempt, true);

    // Bây giờ chuyển sang green thành công!
    const rGreenOk = await t.call('PATCH', '/api/rooms/1/status', {
      as: 'owner@t.test',
      body: { status: 'green' },
    });
    assert.equal(rGreenOk.status, 200);
    assert.equal(rGreenOk.body.status, 'green');

    // 6. Test Mẫu nhận xét (Review Template)
    // - Khách xem được mẫu nhận xét
    const rTplGuest = await t.call('GET', '/api/template/review');
    assert.equal(rTplGuest.status, 200);
    assert.ok(rTplGuest.body.content.includes('HƯỚNG DẪN & MẪU NHẬN XÉT'));

    // - Cán bộ thường không được sửa mẫu nhận xét (403)
    const rTplOfficerEdit = await t.call('PUT', '/api/template/review', {
      as: 'owner@t.test',
      body: { content: 'Nội dung tùy chỉnh trái phép' },
    });
    assert.equal(rTplOfficerEdit.status, 403);

    // - Admin sửa mẫu nhận xét thành công
    const newTemplate = 'MẪU NHẬN XÉT KIỂM TRA ĐẠI HỘI CHI ĐOÀN ĐÃ CẬP NHẬT 2026';
    const rTplAdminEdit = await t.call('PUT', '/api/template/review', {
      as: 'admin@t.test',
      body: { content: newTemplate },
    });
    assert.equal(rTplAdminEdit.status, 200);
    assert.equal(rTplAdminEdit.body.content, newTemplate);

    // - Khách xem lại thấy nội dung mới
    const rTplGuestAfter = await t.call('GET', '/api/template/review');
    assert.equal(rTplGuestAfter.body.content, newTemplate);
    assert.equal(rTplGuestAfter.body.updatedBy, 'Quản Trị');
  } finally {
    await t.close();
  }
});
