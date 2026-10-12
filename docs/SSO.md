# Đăng nhập SSO (Microsoft Entra ID)

OIDC authorization-code + PKCE, chỉ dùng thư viện chuẩn Node. Link token vẫn dùng song song.

## Cách hoạt động
1. Bấm "Đăng nhập" → `/auth/sso/start` (đặt cookie `sso` HttpOnly, chuyển sang Microsoft kèm state, nonce, PKCE).
2. Microsoft trả về `/auth/callback?code&state`. Server kiểm tra cookie + state (dùng một lần), đổi code lấy id_token, xác minh chữ ký RS256 qua JWKS, `iss`, `aud`, `exp`, `nonce`, `tid`.
3. Email lấy từ `email` (hoặc `preferred_username`), so khớp không phân biệt hoa thường với bảng người dùng. Có → tạo phiên; không có → `/?login=denied` (vẫn là khách).

Admin cần **thêm email HUST của người đó vào danh sách người dùng** trước khi họ đăng nhập được.

## Cấu hình
Azure (App registration `sk-clb-cds`): thêm Redirect URI loại Web `https://sk.hust.edu.vn/auth/callback`, tạo Client secret (ghi lại ngày hết hạn).

Trên VM, thêm vào `/etc/event-tracker.env` (không gửi secret qua chat):
```
SSO_TENANT_ID=06f1b89f-07e8-464f-b408-ec1b45703f31
SSO_CLIENT_ID=6de8373b-eeee-4582-bf36-c3903127d369
SSO_CLIENT_SECRET=<giá trị Value của secret>
```
rồi `sudo systemctl restart event-tracker`. Thiếu một trong ba biến → SSO tắt (`501`), giao diện vẫn build với nút "Đăng nhập" trỏ tới `/auth/sso/start`.
