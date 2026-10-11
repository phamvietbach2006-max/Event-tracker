# Kế hoạch triển khai: Web theo dõi chuẩn bị sự kiện (sk.hust.edu.vn)

Hạn chót: **12:00 sáng mai (12/10/2026)**. Dùng chủ yếu trên điện thoại.

## 1. Phạm vi (đã chốt với anh)

| Vai trò | Quyền |
|---|---|
| Khách (chưa login) | Chỉ xem dashboard tổng |
| Phụ trách chính (1–N người / khu vực) | Cập nhật status + tick checklist của khu vực mình |
| Admin (vài người) | Xem và sửa tất cả (khu vực, checklist, người phụ trách) |

Mục tiêu: nắm được sự kiện nhiều module đang xử lý đến đâu và tình trạng ra sao, realtime.

## 2. Thiết kế tóm tắt

- Giữ app Node hiện tại (`server.js`, `public/index.html`, SSE realtime, lưu `data.json`).
- Thêm vào dữ liệu: `admins` (danh sách email) và `room.owners` (danh sách email).
- Đăng nhập bằng **session cookie**. Hai cách vào, dùng chung một lớp session:
  1. **SSO HUST** (callback `https://sk.hust.edu.vn/auth/callback`), lấy email từ SSO.
  2. **Link đăng nhập dự phòng** `/login?token=...`, mỗi người một token. Dùng nếu SSO chưa kịp.
- Server kiểm tra quyền ở mọi API ghi. Giao diện chỉ ẩn nút cho đẹp, không dựa vào đó để chặn.
- Giao diện mobile-first: một cột, nút lớn, thanh tổng quan dính trên cùng.

## 3. Các mảng việc và người nhận

Chỉ cần điền tên vào cột "Người". Mỗi mảng sửa file riêng để không đụng nhau.

| # | Mảng việc | Người | File/nơi làm | Xong khi |
|---|---|---|---|---|
| A | **App: phân quyền + giao diện mobile** | Duong + Claude | `server.js`, `public/index.html` | Đúng bảng quyền ở mục 1, chạy tốt trên điện thoại |
| B | **SSO HUST** | Anh Tùng (+ Duong gắn vào app) | `auth-sso.js` | Bấm "Đăng nhập" → về lại app với email HUST |
| C | **Domain + DNS + HTTPS** | Anh Tùng (DNS), Duong (certbot) | VM Oracle mới | `sk.hust.edu.vn` trỏ về VM mới, `https://` mở được từ điện thoại |
| D | **Dựng VM và deploy app** | Duong (đã tạo VM) + Claude viết script | VM Oracle mới (Ubuntu 24.04) | App chạy nền, tự khởi động lại khi lỗi |
| E | **Dữ liệu thật** | ___ | `seed.json` | Đủ danh sách khu vực, checklist, email người phụ trách, email admin |
| F | **Test trên điện thoại, nhiều người cùng lúc** | ___ (3–5 người) | — | Mọi mục ở mục 5 đều đạt |

## 4. Mốc thời gian

| Giờ | Mốc | Ai |
|---|---|---|
| Tối nay | Gửi anh Tùng **IP của VM mới** để trỏ DNS. Anh Tùng gửi: giao thức SSO (OIDC/CAS/SAML), client id/secret, link tài liệu | B, C |
| Tối nay | Gửi danh sách khu vực, checklist, người phụ trách, admin (dạng bảng email) | E |
| Tối nay | App có phân quyền + link đăng nhập dự phòng + giao diện mobile, chạy local | A |
| Sáng sớm (khoảng 7:30) | Deploy bản đầu lên sk.hust.edu.vn, kiểm tra HTTPS | C, D |
| 9:00 | Gắn SSO vào app, thử đăng nhập thật | B, A |
| 10:00 | Nhập dữ liệu thật, gửi link cho người phụ trách | E |
| 10:30 | Test chéo trên điện thoại (mục 5) | F |
| 11:30 | **Đóng băng**, chỉ sửa lỗi nghiêm trọng | tất cả |
| 12:00 | Demo | — |

Nếu đến 10:00 SSO chưa chạy: dùng link đăng nhập dự phòng cho demo, SSO làm tiếp sau. Cần quyết định này vào lúc 10:00, không để đến 11:30.

## 5. Danh sách kiểm tra trước khi demo

- [ ] Mở `https://sk.hust.edu.vn` trên điện thoại, không login, thấy dashboard tổng
- [ ] Khách không sửa được gì (thử gọi API ghi trực tiếp cũng bị từ chối)
- [ ] Người phụ trách khu vực X sửa được khu vực X, **không** sửa được khu vực Y
- [ ] Admin sửa được mọi khu vực, gán và đổi người phụ trách
- [ ] Hai điện thoại mở cùng lúc: một người đổi status, máy kia thấy ngay không cần tải lại
- [ ] Khởi động lại server, dữ liệu không mất
- [ ] Mạng yếu / mất mạng rồi có lại: trang tự kết nối lại

## 6. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| SSO HUST chưa xong kịp | Link đăng nhập dự phòng (mục 2) |
| DNS `sk.hust.edu.vn` chậm | Báo anh Tùng IP mới ngay tối nay. Trong lúc chờ, test qua `http://<IP>` |
| Nhiều người sửa cùng lúc | Mỗi thao tác là một thay đổi nhỏ (tick một việc, đổi một status), không ghi đè cả khu vực |
| Mất dữ liệu | Sao lưu `data.json` mỗi giờ lên máy khác |
| Lộ link đăng nhập dự phòng | Mỗi người một token, thu hồi được, bỏ hẳn sau khi SSO chạy |

## 7. Chưa quyết (cần chốt)

1. Giao thức SSO của HUST là gì (hỏi anh Tùng).
2. Ai làm mảng E và F.
3. Người phụ trách có được sửa nội dung checklist, hay chỉ tick? (Mặc định: chỉ tick và đổi status.)
