# Event Tracker — Hệ thống Theo dõi Chuẩn bị Sự kiện Thời gian thực

> **Hệ thống tác chiến khẩn cấp theo dõi tiến độ chuẩn bị sự kiện theo thời gian thực (Realtime Dashboard)**  
> **Tên miền triển khai:** `https://sk.hust.edu.vn` (dự phòng: `http://sk.dyclub.tech`)  
> **Đơn vị phát triển:** Câu lạc bộ Chuyển đổi số Đại học Bách khoa Hà Nội (DYC)

---

## 1. Giới thiệu tổng quan

**Event Tracker** là ứng dụng web realtime chuyên dụng cho ban tổ chức sự kiện tại Đại học Bách khoa Hà Nội. Hệ thống giúp ban tổ chức, trưởng các tiểu ban và đội ngũ phụ trách hiện trường nắm bắt trực quan tiến độ chuẩn bị, tình trạng sẵn sàng của từng khu vực sự kiện theo thời gian thực trên cả máy tính lẫn điện thoại di động (mobile-first).

### Triết lý kiến trúc
- **Zero-Dependency Backend:** Sử dụng hoàn toàn thư viện chuẩn của **Node.js 22 LTS** (`node:http`, `node:sqlite` tích hợp sẵn, `node:crypto`). Không cài đặt thêm framework cồng kềnh, giảm thiểu tối đa điểm lỗi khi vận hành và triển khai.
- **SQLite Single-File ACID:** Lưu trữ bằng SQLite với chế độ `PRAGMA journal_mode = WAL`, hỗ trợ đồng thời hàng trăm thao tác ghi nguyên tử (atomic updates) mà không bị tranh chấp hay xung đột dữ liệu.
- **Realtime Server-Sent Events (SSE):** Đồng bộ dữ liệu một chiều tức thì từ server tới tất cả thiết bị với độ trễ dưới 100ms (tự động gộp broadcast debounce), tự động kết nối lại khi mạng chập chờn.
- **Bản đồ số khuôn viên tự host (Self-hosted HUSTMAP):** Tích hợp bản đồ vector khuôn viên Bách khoa ngoại tuyến với MapLibre GL, không phụ thuộc vào dịch vụ bên ngoài trong suốt sự kiện.

---

## 2. Tính năng nổi bật

### 📊 Dashboard Trực quan & Realtime
- **3 mức trạng thái trực quan:**
  - 🔴 **Chưa sẵn sàng (`red`)**: Khu vực gặp vấn đề hoặc chưa bắt đầu chuẩn bị.
  - 🟡 **Đang chuẩn bị (`yellow`)**: Đang triển khai các hạng mục checklist.
  - 🟢 **Sẵn sàng (`green`)**: Đã hoàn tất công tác chuẩn bị, sẵn sàng đón tiếp.
  - *Lưu ý quan trọng:* Trạng thái khu vực do người phụ trách chủ động thiết lập, độc lập với % checklist và không bao giờ tự động chuyển màu.
- **Checklist công việc 3 bước:** Chuyển trạng thái linh hoạt `Chưa làm (todo)` ➔ `Đang làm (doing)` ➔ `Xong (done)`.
- **Ghi chú tình trạng hiện trường (`note`):** Cập nhật dòng thông báo nhanh (tối đa 150 ký tự), hiển thị ngay trên thẻ khu vực.
- **Bộ lọc & Tìm kiếm nhanh:** Lọc tức thì theo màu trạng thái, theo khối sự kiện, xem các khu "Của tôi", và tìm kiếm toàn văn theo tên khu, người phụ trách hoặc nội dung công việc.

### 🛡️ Phân quyền người dùng chặt chẽ (RBAC)
- **Khách (Chưa đăng nhập):** Xem dashboard công khai, danh sách khối, khu, việc và tình trạng sẵn sàng. Dữ liệu công khai **không làm lộ email** của người phụ trách.
- **Chủ khu vực (Phụ trách 1–N khu):** Chỉ được sửa trạng thái màu, cập nhật ghi chú và tick/thêm/sửa/xóa checklist ở khu vực mình phụ trách. Khu vực khác bị khóa tự động.
- **Quản trị viên (Admin):** Toàn quyền cấu hình khối sự kiện, khu vực, checklist công việc, quản lý người dùng, phân quyền phụ trách và cấp lại link đăng nhập.

### 🔐 Xác thực hai kênh (Dual Authentication)
1. **SSO Microsoft Entra ID (OIDC + PKCE):** Đăng nhập an toàn bằng tài khoản Office 365 HUST (`@hust.edu.vn`). Xác minh chữ ký số RS256 qua JWKS của Microsoft, khớp email trong danh bạ ban tổ chức.
2. **Link đăng nhập dự phòng (Magic Token Link):** Mỗi thành viên được cấp một liên kết bí mật 32-byte ngẫu nhiên (`/auth/token?t=...`), tạo phiên làm việc 30 ngày (cookie `sid` HttpOnly, SameSite=Lax, Secure trên HTTPS) phòng khi SSO gián đoạn.

### 🗺️ Bản đồ số HUSTMAP tích hợp (Nhánh `minh`)
- **Tích hợp MapLibre GL v4:** Render bản đồ vector mượt mà trên nền đồ họa WebGL.
- **Hoàn toàn tự host (Self-hosted Offline):** Toàn bộ tiles vector (zoom 16–18 bao trọn khuôn viên HUST), phông chữ glyphs Montserrat và sprite biểu tượng được đặt tại `web/public/hustmap/`.
- **Marker trạng thái thông minh:** Đổi màu marker (Đỏ/Vàng/Xanh) tự động theo mức độ ưu tiên của các khu vực tại địa điểm đó (Nhà C2, Thư viện TQB, Cổng chính, Bãi gửi xe C9, Khu ăn nhẹ C1, Y tế D3).
- **Tác chiến trực tiếp trên bản đồ:** Bấm vào điểm trên bản đồ để mở danh sách khu vực và tương tác trực tiếp với checklist công việc mà không cần rời màn hình bản đồ.

### 📱 Giao diện Mobile-first & Tác chiến hiện đại (Nhánh `minh`)
- **Sidebar điều hướng thông minh:** Menu mở rộng trên desktop và ngăn kéo (drawer) mượt mà trên di động, tích hợp thống kê tiến độ checklist và thông tin phiên đăng nhập.
- **Thanh điều hướng dưới đáy (Mobile Bottom Navigation):** Chuyển đổi nhanh 1 chạm giữa: **Tổng quan**, **Của tôi**, **Sơ đồ** và **Quản lý**.
- **Thẻ khu vực thu gọn mặc định (Collapsed-by-default):** Giúp màn hình gọn gàng trên thiết bị di động, chạm để mở rộng (expanded) chi tiết checklist và bộ điều khiển.
- **Cập nhật lạc quan (Optimistic UI):** Giao diện phản hồi ngay lập tức khi người dùng thao tác, tự động hoàn tác và thông báo nếu máy chủ từ chối.

---

## 3. Cấu trúc thư mục dự án

```
event-tracker/
├── server.js               # Điểm khởi chạy HTTP server, nạp seed, graceful shutdown
├── seed.json               # Dữ liệu khởi tạo chuẩn (khối, khu, checklist, ban tổ chức)
├── package.json            # Scripts kiểm thử, khởi chạy và công cụ
├── auth/                   # Lớp xác thực
│   ├── sso.js              # Xử lý Microsoft Entra ID (OIDC, PKCE, JWKS, RS256)
│   └── token.js            # Sinh token bí mật và URL đăng nhập dự phòng
├── lib/                    # Thư viện lõi backend (Zero external dependencies)
│   ├── app.js              # Factory tạo app, dispatch route, xử lý lỗi, kiểm tra Origin
│   ├── db.js               # Quản lý SQLite (DatabaseSync), schema và getState()
│   ├── http.js             # Bộ định tuyến siêu nhẹ, HttpError, readJson, checkOrigin
│   ├── perm.js             # Logic kiểm tra quyền RBAC (canEditRoom, requireAdmin)
│   ├── repo.js             # Truy vấn dữ liệu, giao dịch (tx), ghi log activity
│   ├── seed.js             # Nạp dữ liệu ban đầu từ seed.json
│   ├── session.js          # Quản lý phiên làm việc, cookie sid HttpOnly
│   ├── sse.js              # Broadcast Server-Sent Events với cơ chế debounce 100ms
│   └── validate.js         # Kiểm tra tính hợp lệ của dữ liệu đầu vào
├── routes/                 # Định nghĩa các endpoint API
│   ├── admin.js            # API quản trị (/api/groups, /api/rooms, /api/users...)
│   ├── auth.js             # API xác thực (/api/me, /auth/token, /auth/sso/*, /auth/logout)
│   ├── public.js           # API công khai (/api/state, /events)
│   └── rooms.js            # API cập nhật hiện trường (/api/rooms/:id/*, /api/tasks/:id)
├── web/                    # Ứng dụng Frontend React 18 + Vite
│   ├── index.html          # Khung trang đơn (SPA)
│   ├── vite.config.js      # Cấu hình Vite & proxy ngược tới backend trong môi trường dev
│   ├── public/             # Tài nguyên tĩnh
│   │   └── hustmap/        # Bộ tài nguyên bản đồ offline (style.json, tiles, fonts, sprite)
│   └── src/                # Mã nguồn React
│       ├── main.jsx        # Điểm gắn kết React root
│       ├── App.jsx         # Component gốc điều phối trạng thái, routing, toast
│       ├── Sidebar.jsx     # Thanh điều hướng bên (drawer trên mobile)
│       ├── Header.jsx      # Topbar điều khiển, tìm kiếm, filter chips, realtime status
│       ├── Group.jsx       # Thẻ khối (GroupCard), thẻ khu vực (RoomCard), NoteBox, AddTask
│       ├── MapView.jsx     # Bản đồ số MapLibre GL v4 khuôn viên HUST
│       ├── Manage.jsx      # Màn hình quản trị sự kiện cho Admin (#/manage)
│       ├── api.js          # REST API client
│       ├── logic.js        # Hàm thuần túy xử lý logic, tính tiến độ, immutable state
│       ├── useLive.js      # Hook kết nối SSE realtime và tự phục hồi
│       └── styles.css      # Toàn bộ định dạng giao diện chuẩn tác chiến
├── tests/                  # Bộ kiểm thử tự động (Unit, Integration, E2E, Load)
│   ├── api.test.js         # Kiểm thử API, phân quyền, validation
│   ├── auth.test.js        # Kiểm thử đăng nhập token link, cookie session
│   ├── db.test.js          # Kiểm thử schema SQLite và ràng buộc dữ liệu
│   ├── e2e.test.js         # Kịch bản kiểm thử toàn diện end-to-end, tải đồng thời
│   ├── sse.test.js         # Kiểm thử broadcast SSE và debounce
│   └── sso.test.js         # Kiểm thử toàn diện luồng OIDC SSO và xác minh token
├── scripts/                # Scripts vận hành
│   ├── links.js            # Xuất danh sách link đăng nhập của tất cả người dùng
│   └── loadtest.js         # Kiểm thử tải nặng (hàng trăm client SSE + đọc/ghi liên tục)
└── deploy/                 # Cấu hình triển khai máy chủ
    ├── nginx.conf          # Cấu hình Nginx reverse proxy (tối ưu SSE và cache)
    ├── event-tracker.service # Cấu hình Systemd daemon
    ├── setup-vm.sh         # Script cài đặt môi trường VM Ubuntu 24.04 ARM64
    ├── deploy.sh           # Script rsync mã nguồn và cập nhật hệ thống
    ├── backup.sh           # Script sao lưu tự động database SQLite mỗi giờ
    └── VM-TUNING.md        # Tài liệu hướng dẫn tinh chỉnh hiệu năng hệ điều hành & kernel
```

---

## 4. Hướng dẫn cài đặt & Chạy cục bộ (Quickstart)

### Yêu cầu môi trường
- **Node.js**: Phiên bản **>= 22.13 LTS** (bắt buộc để sử dụng `node:sqlite`).
- **Trình duyệt**: Chrome, Firefox, Safari hoặc Edge phiên bản hiện đại.

### Bước 1: Khởi động Backend
```bash
# Cài đặt hoặc kiểm tra phiên bản Node
node -v # Phải >= 22.13.0

# Khởi động máy chủ backend (chạy trên cổng 3000)
npm start
```
*Lần chạy đầu tiên, server sẽ tự động tạo tệp `app.db` và nạp dữ liệu từ `seed.json`.*

### Bước 2: Khởi động Frontend (Development Mode)
Mở một cửa sổ terminal mới:
```bash
cd web
npm install
npm run dev
```
Trang web phát triển sẽ chạy tại `http://localhost:5173`. Vite đã được cấu hình proxy tự động chuyển tiếp các yêu cầu `/api`, `/events`, `/auth` sang backend tại cổng `3000`.

### Bước 3: Lấy link đăng nhập thử nghiệm
Để đăng nhập với tư cách **Admin** hoặc **Chủ khu vực** trong môi trường phát triển:
```bash
npm run links
```
Terminal sẽ in ra danh sách link đăng nhập riêng của từng tài khoản mẫu. Bấm vào link để vào thẳng hệ thống với phiên hợp lệ mà không cần cấu hình SSO.

---

## 5. Kiểm thử tự động (Testing)

Dự án đi kèm bộ test tự động toàn diện sử dụng trực tiếp bộ chạy test tích hợp của Node.js (`node:test`):

```bash
# Chạy toàn bộ 63 bài kiểm thử (Backend + Frontend logic + E2E)
npm test

# Chạy riêng kịch bản End-to-End
node --test tests/e2e.test.js

# Kiểm thử hiệu năng & chịu tải cao
npm run loadtest -- --url http://127.0.0.1:3000 --sse 300 --readers 50 --seconds 20
```

---

## 6. Hướng dẫn Triển khai (Deployment)

Chi tiết cấu hình hạ tầng xem tại [TECH.md](TECH.md) và [deploy/VM-TUNING.md](deploy/VM-TUNING.md).

### 🚀 Cách 1: Triển khai trên Vercel (Hỗ trợ lưu trữ vĩnh viễn với Turso Cloud Database)
Dự án đã được tích hợp sẵn cấu hình `vercel.json`, Serverless Function `api/index.js` và driver `libsql` để kết nối trực tiếp với **Turso Cloud Database (SQLite miễn phí vĩnh viễn)**:

#### 1. Tạo Database miễn phí trên Turso:
1. Đăng ký tài khoản tại [Turso.tech](https://turso.tech/) (chọn Login with GitHub).
2. Tạo database mới: ví dụ tên là `event-tracker`.
3. Lấy thông tin kết nối từ giao diện Turso:
   - **Database URL:** có dạng `libsql://event-tracker-xxx.turso.io`
   - **Auth Token:** tạo token mới (Create token) và copy chuỗi mã dài.

#### 2. Cấu hình triển khai trên Vercel:
1. Đẩy code lên GitHub repository: `https://github.com/phamvietbach2006-max/Event-tracker.git`.
2. Truy cập [Vercel Dashboard](https://vercel.com/new) và nhấn **Import** repo `Event-tracker`.
3. Trong mục **Environment Variables**, thêm 2 biến:
   - `TURSO_DATABASE_URL`: URL database của bạn (ví dụ: `libsql://event-tracker-xxx.turso.io`)
   - `TURSO_AUTH_TOKEN`: Token xác thực bạn đã tạo trên Turso.
4. Cấu hình build:
   - **Framework Preset:** Vite (hoặc Other).
   - **Node.js Version:** `22.x`.
5. Nhấn **Deploy**.

> **🌟 Cơ chế lưu trữ vĩnh viễn:**  
> - Khi deploy lần đầu tiên, hệ thống sẽ tự động khởi tạo bảng và nạp toàn bộ dữ liệu mẫu (237 chi đoàn, 1220 đầu việc, 33 cán bộ) trực tiếp lên Turso Cloud.
> - Toàn bộ thay đổi trạng thái, cập nhật ghi chú, tick checklist, đổi mật khẩu sẽ được **lưu trữ vĩnh viễn trên Turso Cloud** và **không bao giờ bị reset** dù Vercel có tắt bật lại container hay deploy commit mới.
> - Nếu chưa điền biến môi trường Turso, hệ thống sẽ tự động chạy chế độ SQLite bộ nhớ đệm `/tmp/app.db`.

---

### 🖥️ Cách 2: Triển khai máy chủ chuyên dụng (Ubuntu 24.04 LTS / VPS)
Phù hợp cho môi trường sự kiện thực tế cần lưu trữ vĩnh viễn trên đĩa cứng và hỗ trợ kết nối SSE hàng nghìn người:
1. **Build Frontend:**
   ```bash
   cd web
   npm run build
   ```
   Kết quả xuất ra tại `web/dist/`.
2. **Triển khai máy chủ (Ubuntu 24.04 LTS):**
   - Chạy script cài đặt máy chủ: `bash deploy/setup-vm.sh`.
   - Cấu hình file môi trường `/etc/event-tracker.env`:
     ```ini
     PORT=3000
     HOST=127.0.0.1
     DB_PATH=/var/lib/event-tracker/app.db
     BASE_URL=https://sk.hust.edu.vn
     SSO_TENANT_ID=06f1b89f-07e8-464f-b408-ec1b45703f31
     SSO_CLIENT_ID=6de8373b-eeee-4582-bf36-c3903127d369
     SSO_CLIENT_SECRET=<client-secret-value>
     ```
   - Cài đặt dịch vụ systemd: `deploy/event-tracker.service`.
   - Cấu hình Nginx reverse proxy: `deploy/nginx.conf` (đặc biệt lưu ý `proxy_buffering off;` cho endpoint `/events`).
   - Cài đặt chứng chỉ SSL tự động qua `certbot --nginx -d sk.hust.edu.vn`.

---

## 7. Danh mục tài liệu kỹ thuật chi tiết

Mọi thông tin chi tiết về từng khía cạnh của hệ thống được quy định trong các tài liệu sau:

| Tài liệu | Nội dung chính |
|---|---|
| [PLAN.md](PLAN.md) | Kế hoạch tác chiến tổng thể, phân công nhân sự và các mốc thời gian hoàn thành. |
| [API.md](API.md) | Hợp đồng giao tiếp API đầy đủ giữa Backend và Frontend, mã lỗi và quy ước dữ liệu. |
| [TECH.md](TECH.md) | Chi tiết thiết kế kiến trúc, cấu trúc SQLite schema, chiến lược xử lý dữ liệu và UI mobile-first. |
| [docs/CODEMAPS/architecture.md](docs/CODEMAPS/architecture.md) | Bản đồ chi tiết mã nguồn (Codemap) toàn bộ module backend, frontend và sơ đồ luồng dữ liệu. |
| [docs/SSO.md](docs/SSO.md) | Hướng dẫn tích hợp và cấu hình Microsoft Entra ID (OIDC + PKCE). |
| [docs/TESTING.md](docs/TESTING.md) | Sổ tay kiểm thử hiện trường chi tiết cho 8 bộ usecase và hướng dẫn đo tải. |
| [docs/USECASES.md](docs/USECASES.md) | Đặc tả chi tiết từng Use Case tác chiến (UC1 đến UC8), luồng chính, luồng rẽ nhánh và luồng lỗi. |
| [deploy/VM-TUNING.md](deploy/VM-TUNING.md) | Tinh chỉnh kernel Linux, file descriptors, network buffer và cấu hình Nginx chịu tải cao. |

---

*© 2026 CLB Chuyển đổi số Đại học Bách khoa Hà Nội (DYC). Bản quyền nội bộ phục vụ sự kiện.*
#   E v e n t - t r a c k e r 
 
 