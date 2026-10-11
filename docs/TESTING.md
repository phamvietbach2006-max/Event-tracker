# Hướng dẫn kiểm thử – Theo dõi sự kiện

Tài liệu cho người kiểm thử (không cần biết lập trình). Luồng chi tiết của từng use case xem [USECASES.md](USECASES.md). Chia theo **vai trò** (use case), mỗi use case có các **testcase** gồm: bước làm → kết quả mong đợi.

## 0. Chuẩn bị

| Việc | Cách làm |
|---|---|
| Địa chỉ | `http://sk.dyclub.tech` (dùng `http://` đến khi bật HTTPS) |
| Lấy link đăng nhập | Admin: `⚙ Quản lý` → Người dùng → "Tạo link". Hoặc chạy `deploy/links.sh` |
| Thiết bị | Ít nhất: 1 điện thoại (Chrome/Safari) + 1 máy tính |
| Tài khoản cần có | 1 admin, 2 chủ khu (A phụ trách khu X, B phụ trách khu Y), 1 khách (chưa đăng nhập, dùng cửa sổ ẩn danh) |
| Quy ước | ✅ = đạt, ❌ = lỗi (ghi lại bước, ảnh chụp, thiết bị) |

Ba vai trò: **Khách** (xem, không sửa) · **Chủ khu** (sửa khu mình phụ trách) · **Admin** (sửa tất cả + trang Quản lý).

---

## UC1 – Khách xem dashboard công khai

| ID | Bước | Mong đợi |
|---|---|---|
| UC1-01 | Mở trang bằng cửa sổ ẩn danh | Thấy 3 khối, ô đếm Đỏ/Vàng/Xanh, thanh tiến độ %, dòng "Bạn đang xem công khai · Chưa đăng nhập". Không cần đăng nhập |
| UC1-02 | Tổng số trên ô đếm | Số đỏ + vàng + xanh = tổng số khu |
| UC1-03 | Bấm tiêu đề một khối | Khối thu/mở; mặc định cả 3 khối mở |
| UC1-04 | Bấm một khu | Mở ra danh sách việc, thanh tiến độ, giờ "Cập nhật lúc HH:MM" (giờ Việt Nam) |
| UC1-05 | Trong khu đang mở | Không có nút đổi trạng thái, nút việc bị khóa, hiện "🔒 Đăng nhập để cập nhật" |
| UC1-06 | Bấm ô đếm "Đỏ" | Chỉ còn các khu đỏ. Bấm lần nữa thì bỏ lọc |
| UC1-07 | Khu chưa có người phụ trách / chưa có status | Hiện "Chưa có người phụ trách" / "Chưa có cập nhật" |
| UC1-08 | Xem nguồn trang / API `/api/state` | Chỉ có tên người phụ trách, **không** có email |
| UC1-09 | Nút "Đăng nhập" | Hiện thông báo dùng link riêng (khi chưa có SSO) |

## UC2 – Đăng nhập / đăng xuất bằng link

| ID | Bước | Mong đợi |
|---|---|---|
| UC2-01 | Mở link đúng của chủ khu A | Vào trang chủ, dòng "Xin chào <tên> · Phụ trách N khu vực" |
| UC2-02 | Đóng trình duyệt, mở lại | Vẫn đăng nhập (giữ 30 ngày) |
| UC2-03 | Mở link sai/hỏng (đổi vài ký tự) | Về trang chủ, **không** đăng nhập được (địa chỉ có `?login=failed`) |
| UC2-04 | Admin tạo link mới cho A, rồi mở link **cũ** | Link cũ không còn dùng được; link mới dùng được |
| UC2-05 | Bấm "Đăng xuất" | Về chế độ khách; tải lại trang vẫn là khách |
| UC2-06 | Đăng nhập admin | Dòng "Quản trị viên … · Sửa được tất cả", có chip "⚙ Quản lý" |
| UC2-07 | Admin xoá người dùng A trong lúc A đang đăng nhập | Lần thao tác kế tiếp của A báo hết phiên, về chế độ khách |

## UC3 – Chủ khu cập nhật khu của mình

Đăng nhập là A (phụ trách khu X, không phụ trách khu Y).

| ID | Bước | Mong đợi |
|---|---|---|
| UC3-01 | Bấm "Của tôi" | Chỉ còn khu A phụ trách. Bấm lại để bỏ lọc |
| UC3-02 | Mở khu X, bấm Đỏ / Vàng / Xanh | Màu khu đổi ngay, ô đếm trên cùng đổi theo |
| UC3-03 | Bấm nút trạng thái của một việc | Trạng thái việc xoay vòng, % tiến độ cập nhật |
| UC3-04 | Gõ dòng status, bấm Enter hoặc bấm ra ngoài | Lưu lại; tải lại trang vẫn còn |
| UC3-05 | Gõ quá 150 ký tự | Không gõ thêm được; bộ đếm dừng ở 150/150 |
| UC3-06 | Xoá trắng dòng status | Lưu được; hiện "Chưa có cập nhật" |
| UC3-07 | Gõ tiếng Việt có dấu, emoji, ký tự `<script>` | Hiện nguyên văn, không chạy mã, không lỗi |
| UC3-08 | Mở khu Y (không phụ trách) | Không có nút đổi trạng thái; nút việc bị khóa; "🔒 Chỉ người phụ trách mới sửa được" |
| UC3-09 | Sau khi sửa | "Cập nhật lúc …" đổi sang giờ vừa sửa, kèm tên A |
| UC3-10 | Khu có 2 chủ khu: cả hai cùng sửa | Cả hai đều sửa được; không ghi đè lẫn nhau sai lệch |
| UC3-11 | Chủ khu sửa **nội dung** của việc (text) | Không làm được (chỉ admin) |

## UC4 – Realtime

Mở 2 thiết bị/tab: tab 1 là A, tab 2 là khách.

| ID | Bước | Mong đợi |
|---|---|---|
| UC4-01 | A đổi trạng thái khu X | Tab khách tự đổi trong ~1 giây, không cần tải lại |
| UC4-02 | A tick việc, sửa status | Tab khách cập nhật số việc, % và dòng status |
| UC4-03 | Chỉ báo góc trên | Hiện "Realtime" (xanh) khi kết nối tốt |
| UC4-04 | Tắt mạng tab khách vài giây rồi bật lại | Hiện "Đang kết nối lại…", sau đó tự khôi phục và có dữ liệu mới nhất |
| UC4-05 | Tab B đang gõ status, tab A sửa khu khác | Ô đang gõ của B **không** bị xoá chữ |
| UC4-06 | Để trang mở 10 phút không thao tác | Vẫn nhận cập nhật (kết nối không bị cắt) |
| UC4-07 | Sửa khi mất mạng (hoặc server lỗi) | Báo lỗi, giao diện quay về dữ liệu thật của server |

## UC5 – Admin quản lý (trang `#/manage`)

| ID | Bước | Mong đợi |
|---|---|---|
| UC5-01 | Bấm "⚙ Quản lý" | Thấy danh sách khối, khu, người dùng; "← Về dashboard" quay lại |
| UC5-02 | Khách/chủ khu mở thẳng `…/#/manage` | Không vào được, hiện dashboard |
| UC5-03 | Thêm khối mới | Xuất hiện ở dashboard (realtime) |
| UC5-04 | Đổi tên khối rồi bấm ra ngoài | Tên đổi ở dashboard |
| UC5-05 | Khối còn khu | Nút "Xoá khối" bị khóa; khối trống thì xoá được (có hỏi xác nhận) |
| UC5-06 | Thêm khu vào khối | Khu mới có trạng thái mặc định, xuất hiện ở dashboard |
| UC5-07 | Đổi tên khu | Đổi ở dashboard |
| UC5-08 | Xoá khu | Hỏi xác nhận; khu và checklist biến mất |
| UC5-09 | Tick/bỏ tick người phụ trách của khu | Dashboard hiện đúng tên; người đó thấy khu trong "Của tôi" |
| UC5-10 | Thêm / sửa nội dung / xoá một việc | Hiện đúng ở dashboard |
| UC5-11 | Thêm người dùng (email, tên, có/không admin) | Có trong danh sách |
| UC5-12 | Thêm người dùng trùng email | Báo lỗi dễ hiểu, không tạo bản sao |
| UC5-13 | Tạo link đăng nhập cho một người | Hiện link; nút Copy hoạt động; link cũ (nếu có) bị hỏi xác nhận trước |
| UC5-14 | Đổi quyền Admin của một người | Có hiệu lực ở lần đăng nhập/tải trang kế tiếp |
| UC5-15 | Xoá người dùng | Hỏi xác nhận; người đó mất quyền; tên bị gỡ khỏi khu |
| UC5-16 | Thử bỏ quyền admin / xoá chính mình hoặc admin cuối cùng | Phải bị chặn hoặc cảnh báo, không để hệ thống mất admin |

## UC6 – Bảo mật và phân quyền (gọi API)

Dùng cửa sổ ẩn danh hoặc công cụ như Postman/curl. Thứ tự kiểm tra của server: chưa đăng nhập → không tìm thấy → không có quyền → dữ liệu sai.

| ID | Bước | Mong đợi |
|---|---|---|
| UC6-01 | Khách gửi sửa trạng thái khu | `401` (Cần đăng nhập) |
| UC6-02 | A sửa khu Y (không phụ trách) | `403` |
| UC6-03 | A gọi API quản trị (thêm khu, thêm người…) | `403` |
| UC6-04 | Sửa khu/việc không tồn tại | `404` |
| UC6-05 | Status quá 150 ký tự, trạng thái không hợp lệ | `400` với thông báo rõ |
| UC6-06 | Gửi dữ liệu không phải JSON object, hoặc > 16 KB | `400` / `413` |
| UC6-07 | Gửi sửa từ trang web khác (Origin lạ) | Bị từ chối |
| UC6-08 | Cookie đăng nhập | Có `HttpOnly`; khi qua HTTPS có thêm `Secure` |
| UC6-09 | `/auth/sso/start` khi chưa cấu hình SSO | `501` `sso_not_configured` |

## UC7 – Điện thoại và giao diện

| ID | Bước | Mong đợi |
|---|---|---|
| UC7-01 | Màn hình 360–430 px | Không cuộn ngang; chữ đọc được; nút đủ lớn để bấm bằng ngón tay |
| UC7-02 | Xoay ngang điện thoại | Bố cục không vỡ |
| UC7-03 | Tablet / máy tính | Các khối xếp cột, không dãn xấu |
| UC7-04 | Chrome, Safari (iOS), Zalo in-app browser | Đăng nhập bằng link và realtime đều chạy |
| UC7-05 | Chế độ tối của máy | Vẫn đọc được màu đỏ/vàng/xanh |
| UC7-06 | Khu có tên rất dài, status dài 150 ký tự | Chữ xuống dòng, không tràn |

## UC8 – Tải và ổn định (trước ngày sự kiện)

| ID | Bước | Mong đợi |
|---|---|---|
| UC8-01 | Mở trang cùng lúc trên ~30–50 thiết bị | Cả trang và realtime vẫn nhanh |
| UC8-02 | 5 người cùng sửa 5 khu khác nhau | Không mất dữ liệu; mọi thay đổi đều thấy ở các máy khác |
| UC8-03 | Khởi động lại dịch vụ trên server | Máy đang mở tự kết nối lại, dữ liệu vẫn còn |
| UC8-04 | Triển khai bản mới (merge lên `main`) | Trang vẫn chạy; đăng nhập cũ vẫn còn hiệu lực |
| UC8-05 | Sao lưu cơ sở dữ liệu SQLite | Có bản sao dùng được |

---

## Mẫu ghi kết quả

| ID | Thiết bị / trình duyệt | ✅/❌ | Ghi chú (bước tái hiện, ảnh) |
|---|---|---|---|
| UC1-01 | iPhone / Safari | | |

Thứ tự ưu tiên khi ít thời gian: **UC2 → UC3 → UC4 → UC5 → UC6 → UC7**.
