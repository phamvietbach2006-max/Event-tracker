# Use case và luồng xử lý – Theo dõi sự kiện

Mỗi use case gồm: tác nhân, điều kiện trước, **luồng chính**, **luồng rẽ nhánh**, **luồng lỗi**, kết quả sau cùng, và các testcase tương ứng trong [TESTING.md](TESTING.md).

Vai trò: **Khách** (không đăng nhập) · **Chủ khu** (phụ trách một hay nhiều khu) · **Admin**.

## Sơ đồ tổng quan

```
Khách ──xem──▶ UC1 Dashboard ◀──realtime── UC4
   │
   └─ có link ─▶ UC2 Đăng nhập ─┬─▶ Chủ khu ─▶ UC3 Cập nhật khu mình
                                └─▶ Admin   ─▶ UC3 (mọi khu) + UC5 Quản lý
UC6 Phân quyền/bảo mật bao trùm mọi thao tác ghi.
```

Thứ tự kiểm tra của server khi có thao tác ghi: **401** chưa đăng nhập → **404** không tồn tại → **403** không đủ quyền → **400** dữ liệu sai.

---

## UC1 – Xem dashboard công khai
- **Tác nhân:** Khách, Chủ khu, Admin
- **Điều kiện trước:** không cần đăng nhập
- **Luồng chính**
  1. Mở trang `sk.dyclub.tech`.
  2. Hệ thống tải trạng thái, hiện 3 ô đếm Đỏ/Vàng/Xanh, thanh tiến độ, 3 khối đang mở.
  3. Người dùng mở một khu để xem việc, người phụ trách, giờ cập nhật.
- **Luồng rẽ nhánh**
  - A1. Bấm ô đếm màu → lọc các khu theo màu; bấm lại → bỏ lọc.
  - A2. Thu gọn/mở khối.
  - A3. Khu chưa có người phụ trách hoặc status → hiện chữ thay thế.
- **Luồng lỗi:** E1. Server không trả dữ liệu → hiện "Đang tải…" / "Đang kết nối lại…", không vỡ trang.
- **Kết quả:** người xem biết khu nào đỏ/vàng/xanh; không lộ email.
- **Testcase:** UC1-01 … UC1-09

## UC2 – Đăng nhập / đăng xuất bằng link
- **Tác nhân:** Chủ khu, Admin
- **Điều kiện trước:** admin đã tạo link riêng cho người đó
- **Luồng chính**
  1. Người dùng mở link `/auth/token?t=…`.
  2. Hệ thống kiểm tra token, tạo phiên (cookie `sid`, 30 ngày), chuyển về `/`.
  3. Header hiện tên và vai trò; chip "Của tôi" (và "⚙ Quản lý" nếu admin) xuất hiện.
- **Luồng rẽ nhánh**
  - A1. Bấm "Đăng xuất" → xoá phiên, về chế độ khách.
  - A2. Admin tạo link mới → link cũ mất hiệu lực.
  - A3. Bấm "Đăng nhập" → SSO Microsoft của HUST (chỉ email đã được admin thêm; email lạ → "Tài khoản chưa được cấp quyền"); link token vẫn dùng song song.
- **Luồng lỗi**
  - E1. Token sai/đã bị thay → về `/?login=failed`, vẫn là khách.
  - E2. Phiên hết hạn hoặc người dùng bị xoá → thao tác kế tiếp báo hết phiên, về chế độ khách.
  - E3. SSO chưa cấu hình → `501 sso_not_configured`. E4. SSO lỗi/hết hạn/sai state → `/?login=failed`.
- **Kết quả:** có phiên hợp lệ hoặc vẫn là khách, không có trạng thái nửa vời.
- **Testcase:** UC2-01 … UC2-07, UC6-09 … UC6-13

## UC3 – Chủ khu cập nhật khu của mình
- **Tác nhân:** Chủ khu (khu mình phụ trách), Admin (mọi khu)
- **Điều kiện trước:** đã đăng nhập; là chủ khu đó hoặc admin
- **Luồng chính**
  1. Bấm "Của tôi" để thấy các khu của mình, mở một khu.
  2. Chọn Đỏ/Vàng/Xanh.
  3. Giao diện đổi ngay (cập nhật lạc quan), gửi lên server.
  4. Server lưu, ghi lại ai sửa và lúc nào, phát cập nhật cho mọi máy (UC4).
- **Luồng rẽ nhánh**
  - A1. Bấm trạng thái của một việc → xoay vòng trạng thái, % tiến độ đổi.
  - A2. Gõ dòng status (≤150 ký tự) rồi Enter/ra ngoài → lưu.
  - A3. Xoá trắng status → lưu thành rỗng.
- **Luồng lỗi**
  - E1. Khu không phụ trách → không có nút sửa; nếu gọi API: 403.
  - E2. Server từ chối/lỗi mạng → giao diện hoàn lại dữ liệu thật, hiện thông báo.
  - E3. Phiên hết hạn (401) → báo đăng nhập lại.
  - E4. Thêm/xoá/sửa chữ việc ở khu không phụ trách → 403 (chủ khu làm được ở khu của mình).
- **Kết quả:** dữ liệu mới có ở mọi máy; "Cập nhật lúc … · tên" đúng.
- **Testcase:** UC3-01 … UC3-11

## UC4 – Nhận cập nhật realtime
- **Tác nhân:** mọi người đang mở trang
- **Luồng chính**
  1. Trang mở kết nối `/events` (SSE) và nhận trạng thái mới nhất.
  2. Có ai sửa → server phát bản mới (gộp trong ~100 ms) → giao diện tự vẽ lại.
- **Luồng rẽ nhánh:** A1. Ô đang gõ không bị ghi đè dữ liệu từ server.
- **Luồng lỗi:** E1. Mất kết nối → hiện "Đang kết nối lại…", tự nối lại, nhận lại dữ liệu mới nhất. E2. Mạng chậm/proxy → server gửi keepalive 25 giây để không bị ngắt.
- **Kết quả:** mọi màn hình thống nhất trong vài giây.
- **Testcase:** UC4-01 … UC4-07

## UC5 – Admin quản lý khối, khu, việc, người dùng
- **Tác nhân:** Admin
- **Điều kiện trước:** đăng nhập admin, mở `#/manage`
- **Luồng chính (cấu hình sự kiện)**
  1. Thêm khối → thêm khu vào khối → thêm các việc vào khu.
  2. Thêm người dùng → tick họ làm người phụ trách khu.
  3. Tạo link đăng nhập → gửi riêng cho từng người.
- **Luồng rẽ nhánh:** A1. Đổi tên khối/khu/việc. A2. Đổi quyền admin. A3. Bỏ tick người phụ trách. A4. Xoá việc/khu/khối/người dùng (có hỏi xác nhận).
- **Luồng lỗi**
  - E1. Xoá khối còn khu → nút bị khóa.
  - E2. Email trùng → báo lỗi, không tạo bản sao.
  - E3. Tạo link mới cho người đã có link → hỏi xác nhận vì link cũ sẽ mất.
  - E4. Không phải admin → không vào được trang, API trả 403.
  - E5. Thao tác khiến hệ thống không còn admin → bị chặn.
- **Kết quả:** dashboard phản ánh cấu hình mới ngay (realtime).
- **Testcase:** UC5-01 … UC5-16

## UC6 – Phân quyền và bảo mật
- **Luồng chính:** mọi yêu cầu ghi đi qua kiểm tra: đăng nhập → tồn tại → đủ quyền → dữ liệu hợp lệ, và kiểm tra Origin.
- **Luồng lỗi:** 401 / 404 / 403 / 400; body không phải JSON object hoặc >16 KB → 400/413; Origin lạ → từ chối.
- **Kết quả:** khách không ghi được; chủ khu chỉ ghi khu mình; chỉ admin cấu hình.
- **Testcase:** UC6-01 … UC6-09

## UC7 – Dùng trên điện thoại
- **Luồng chính:** người dùng mở trang/link trên điện thoại (Chrome, Safari, Zalo) và dùng đủ UC1–UC3.
- **Luồng lỗi:** màn hình hẹp → không cuộn ngang, chữ dài xuống dòng, nút ≥ 44 px.
- **Testcase:** UC7-01 … UC7-06

## UC8 – Vận hành và ổn định
- **Luồng chính:** nhiều người cùng dùng; có bản mới được deploy; dịch vụ khởi động lại.
- **Luồng lỗi:** server khởi động lại → máy khách tự nối lại, dữ liệu không mất.
- **Testcase:** UC8-01 … UC8-05

---

## Luồng end-to-end (chạy một lượt trước ngày sự kiện)
1. Admin vào `#/manage`: tạo khối → khu → việc, thêm người dùng, gán phụ trách (UC5).
2. Admin tạo link và gửi từng người (UC2).
3. Chủ khu mở link trên điện thoại, cập nhật trạng thái/status (UC3).
4. Khách mở trang công khai ở máy khác, thấy thay đổi tự cập nhật (UC1, UC4).
5. Chủ khu thử sửa khu của người khác → bị chặn (UC6).
6. Admin xoá người dùng/thu hồi link → người đó mất quyền (UC2, UC5).
