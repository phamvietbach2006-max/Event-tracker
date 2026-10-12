# Stack và thiết kế kỹ thuật chi tiết

Đi kèm [PLAN.md](PLAN.md). Giao thức SSO chưa biết nên phần SSO chỉ làm một "khe cắm" (mục 5).

## 1. Stack chốt

| Lớp | Chọn | Lý do |
|---|---|---|
| Runtime | **Node.js 22 LTS** | Đã chạy được, không cần build |
| HTTP | `node:http` + router nhỏ tự viết (hoặc Express nếu cả nhóm quen hơn) | Ít thư viện, ít thứ hỏng khi deploy |
| Dữ liệu | **SQLite** (`node:sqlite` có sẵn từ Node 22.5) | Mỗi thao tác là một câu UPDATE nguyên tử, nhiều người sửa cùng lúc không ghi đè nhau. Sao lưu bằng một lệnh. Thay cho `data.json` |
| Realtime | **SSE** (`/events`) | Một chiều server → máy, đủ cho dashboard, tự nối lại khi rớt mạng |
| Giao diện | **React 18 + Vite**, CSS tác chiến, `lucide-react`, `maplibre-gl` 4.7.1 | Nhóm đã chọn React. Vite build ra file tĩnh nên không cần Next.js hay server render. Bản đồ vector HUSTMAP tự host ngoại tuyến. Giữ bundle nhỏ gọn cho 4G |
| Phiên đăng nhập | Cookie `sid` (HttpOnly, Secure, SameSite=Lax), lưu trong bảng `sessions` | Đơn giản, thu hồi được |
| SSO | Module `auth/sso.js` (Microsoft Entra ID OIDC + PKCE) | Dùng chuẩn `node:crypto` và `fetch`, không cần cài thêm thư viện ngoài |
| Reverse proxy | **nginx** + HTTPS | Cần tắt buffering cho SSE, cache tài nguyên bản đồ tĩnh |
| Chạy nền | **systemd** (`Restart=always`) | Tự khởi động lại khi lỗi hoặc khi server reboot |
| Test | `node:test` + chạy thật trên điện thoại | Không thêm thư viện, 63 test suite tự động |

Dependency: **backend không có** (zero external dependencies, kể cả SSO). **Frontend:** `react`, `react-dom`, `vite`, `lucide-react`, `maplibre-gl` (tải lười khi mở bản đồ).

**Build:** `npm run build` trong `web/` ra `web/dist/`, **build trên máy anh/chị rồi rsync `dist/` lên VM** (VM không cần cài toolchain build). Server Node phục vụ `dist/` như file tĩnh. Khi dev, Vite chạy ở cổng riêng và proxy `/api`, `/events`, `/auth` sang Node.

Việc cần xác nhận trên server `168.107.68.32`: phiên bản Node (`node -v`), hệ điều hành, có nginx chưa, có chứng chỉ HTTPS cho `sk.hust.edu.vn` chưa.

## 2. Cấu trúc thư mục

```
event-tracker/
├── server.js            # khởi động, gắn router, SSE
├── lib/
│   ├── app.js           # app factory, dispatch route, checkOrigin
│   ├── db.js            # mở SQLite, tạo bảng, hàm getState
│   ├── session.js       # tạo/đọc/xoá session, cookie sid
│   ├── perm.js          # canEditRoom(user, roomId), isAdmin(user)
│   ├── repo.js          # truy vấn thực thể, transactions, activity log
│   ├── sse.js           # danh sách client, broadcast debounce 100ms
│   ├── http.js          # router mini, readJson, HttpError
│   └── validate.js      # kiểm tra hợp lệ dữ liệu
├── routes/
│   ├── public.js        # GET /api/state, /events
│   ├── rooms.js         # API khu vực, checklist, thêm/xóa việc
│   ├── admin.js         # API quản trị (khối, khu, người dùng, token)
│   └── auth.js          # /auth/token, /auth/sso/*, /api/me, logout
├── auth/
│   ├── token.js         # đăng nhập bằng link riêng (dự phòng)
│   └── sso.js           # SSO Microsoft Entra ID (OIDC + PKCE)
├── web/                 # React 18 + Vite
│   ├── index.html
│   ├── vite.config.js   # proxy /api, /events, /auth sang :3000 khi dev
│   ├── public/
│   │   └── hustmap/     # Tài nguyên bản đồ offline (style.json, tiles z16-18, fonts, sprite)
│   └── src/
│       ├── main.jsx
│       ├── App.jsx           # Điều phối state, routing mode, optimistic act()
│       ├── Sidebar.jsx       # Thanh điều hướng bên, drawer mobile, lọc nhanh, tiến độ
│       ├── Header.jsx        # Topbar, ô tìm kiếm, chip lọc, trạng thái realtime
│       ├── Group.jsx         # GroupCard, RoomCard (collapsed-by-default), NoteBox, AddTask
│       ├── MapView.jsx       # Bản đồ MapLibre GL tích hợp, marker trạng thái động
│       ├── Manage.jsx        # Màn hình Quản lý cho admin (#/manage)
│       ├── api.js            # fetch API client
│       ├── logic.js          # Tính phần trăm, đếm trạng thái, format ngày giờ, quyền
│       ├── useLive.js        # Hook SSE tự nối lại, nhận broadcast state
│       └── styles.css        # Toàn bộ CSS giao diện tác chiến
├── mockup/              # mẫu giao diện đã duyệt, làm khuôn cho web/
├── seed.json            # danh sách khu vực, checklist, người phụ trách, admin
├── scripts/
│   ├── links.js         # xuất link đăng nhập token
│   └── loadtest.js      # kiểm thử tải nặng SSE + đọc/ghi
├── tests/               # 63 bài test tự động (api, auth, db, sse, sso, e2e)
└── deploy/
    ├── nginx.conf
    ├── event-tracker.service
    ├── setup-vm.sh
    ├── deploy.sh
    └── backup.sh
```

## 3. Cơ sở dữ liệu

```sql
CREATE TABLE users (
  email TEXT PRIMARY KEY,          -- viết thường
  name TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  token TEXT UNIQUE                -- link đăng nhập dự phòng, NULL nếu không dùng
);
CREATE TABLE groups (              -- cấp 1: khối (Thư viện TQB, C2, Sân trường - An ninh)
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE rooms (               -- cấp 2: khu con, là đơn vị có status, checklist, người phụ trách
  id INTEGER PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'red'
    CHECK (status IN ('red','yellow','green')),
  note TEXT NOT NULL DEFAULT '',   -- 1 dòng status ngắn, tối đa 150 ký tự, hiện ngay trên card
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);
CREATE TABLE room_owners (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  PRIMARY KEY (room_id, email)     -- 1..N người phụ trách mỗi khu vực
);
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'todo'
    CHECK (state IN ('todo','doing','done')),
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);
CREATE TABLE sessions (
  sid TEXT PRIMARY KEY,            -- chuỗi ngẫu nhiên 32 byte
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE activity (            -- nhật ký: ai đổi gì lúc nào
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL, email TEXT, room_id INTEGER,
  action TEXT NOT NULL, detail TEXT
);
```

Người đăng nhập mà email không có trong `users` thì coi như khách (chỉ xem).

## 4. API và quyền

Quy tắc: server kiểm tra quyền ở **mọi** API ghi. Sai quyền trả 403, chưa login trả 401.

| Method + đường dẫn | Ai gọi được | Việc |
|---|---|---|
| `GET /api/state` | Mọi người | Toàn bộ khu vực, checklist, tên người phụ trách (không trả email) |
| `GET /events` | Mọi người | SSE, mỗi lần có thay đổi gửi lại state |
| `GET /api/me` | Mọi người | Trả `{email,name,isAdmin,ownedRooms}` hoặc `null` |
| `PATCH /api/rooms/:id/status` | Phụ trách khu vực đó, admin | Đổi màu (`red`, `yellow`, `green`) |
| `PATCH /api/rooms/:id/note` | Phụ trách khu vực đó, admin | Đổi ghi chú |
| `PATCH /api/tasks/:id` `{state}` | Phụ trách khu vực chứa việc đó, admin | Đổi trạng thái việc (`todo`, `doing`, `done`) |
| `POST /api/rooms` | Admin | Thêm khu vực |
| `PATCH /api/rooms/:id` `{name,sort}` | Admin | Đổi tên, thứ tự |
| `DELETE /api/rooms/:id` | Admin | Xoá khu vực |
| `PUT /api/rooms/:id/owners` `{emails[]}` | Admin | Gán người phụ trách (1..N) |
| `POST /api/rooms/:id/tasks`, `PATCH /api/tasks/:id` `{text}`, `DELETE /api/tasks/:id` | Admin | Thêm, sửa, xoá việc |
| `GET/POST/DELETE /api/users` | Admin | Quản lý người dùng, đặt admin |
| `POST /api/users/:email/token` | Admin | Tạo lại link đăng nhập riêng |
| `GET /auth/token?t=...` | Mọi người | Đăng nhập bằng link riêng |
| `GET /auth/sso/start`, `GET /auth/callback` | Mọi người | SSO (làm sau) |
| `POST /auth/logout` | Đã login | Đăng xuất |

Hàm quyền duy nhất, đặt trong `lib/perm.js`, mọi route gọi vào đó:

```js
canEditRoom(user, roomId) // user?.is_admin || room_owners có (roomId, user.email)
```

Realtime: sau mỗi thay đổi đã ghi xong vào DB, server gom trong 100 ms rồi gửi state mới cho mọi client. State chỉ vài KB nên gửi cả cục cho đơn giản.

## 5. Khe cắm đăng nhập

Mọi cách đăng nhập chỉ cần trả về `{email, name}`, sau đó dùng chung một hàm tạo session:

```js
// auth/token.js   : đọc ?t=, tìm user có token đó
// auth/sso.js     : start(req,res) chuyển sang HUST; callback(req,res) trả {email,name}
// lib/session.js  : createSession(email) → set cookie sid
```

Khi anh Tùng cho biết giao thức, chỉ viết lại `auth/sso.js`. Phần quyền, DB, giao diện không đổi.

## 6. Giao diện (mobile-first) và Kiến trúc UI mới

### 6.1 Bố cục và trải nghiệm người dùng
- Một cột dưới 600 px, nút và ô đổi trạng thái việc cao tối thiểu 44 px, tối ưu ngón tay bấm trên điện thoại.
- Thanh trên cùng dính khi cuộn (`Header.jsx`): số khu vực theo từng status, thanh tiến độ tổng, ô tìm kiếm thời gian thực, chấm báo realtime (`Wifi`/`WifiOff`).
- Bộ lọc nhanh: bấm ô đếm màu (đỏ, vàng, xanh) ở đầu trang, hoặc chip **Của tôi** (chỉ hiện khi đã login).
- Quyền gán ở cấp khu con (`room_owners`). Admin xem và sửa tất cả.
- Khách: card chỉ đọc. Người phụ trách: chỉ card của mình có điều khiển. Admin: mọi card, thêm nút quản lý.
- Cập nhật lạc quan: tick cập nhật ngay trên màn hình (không chờ server), lỗi thì hoàn lại và hiện toast báo lỗi.
- Màn Quản lý (`Manage.jsx` cho admin tại `#/manage`): danh sách khu vực (thêm, đổi tên, thứ tự, gán người phụ trách), danh sách người dùng (thêm, đặt admin, copy link đăng nhập).
- Mất mạng: hiện thanh banner "Đang kết nối lại…", tự lấy lại state khi có mạng.

### 6.2 Cải tiến kiến trúc UI (nhánh `minh` tích hợp)
- **Thanh điều hướng Sidebar & Mobile Bottom Nav (`Sidebar.jsx`):**
  - Mở rộng cố định bên trái trên desktop và chuyển thành ngăn kéo trượt (drawer with backdrop) trên thiết bị di động.
  - Phân vùng chức năng rõ ràng: menu chính (Tổng quan, Khu của tôi, Sơ đồ khu vực, Quản lý), bộ lọc nhanh 3 trạng thái, danh sách phím tắt chuyển đến từng khối sự kiện, thẻ thống kê tiến độ checklist tổng thể, thông tin tài khoản hiện tại và nút đăng nhập/đăng xuất.
  - Hỗ trợ thanh điều hướng dưới đáy màn hình (`mobile-bottom-nav`) cho thiết bị di động, thao tác 1 chạm thuận tiện.
- **Thẻ khu vực thu gọn mặc định (Collapsed-by-default `RoomCard`):**
  - Mặc định các thẻ khu vực hiển thị ở dạng tóm tắt tinh gọn: pill màu trạng thái, tên khu, người phụ trách, dòng ghi chú hiện trường, % tiến độ checklist.
  - Bấm vào thẻ để mở rộng (expanded): xem danh sách việc, sửa trực tiếp nội dung việc, nút đổi trạng thái việc xoay vòng (`todo` → `doing` → `done`), nút xóa việc, ô thêm việc nhanh (`AddTask`), các nút chuyển màu trạng thái khu và ô ghi chú `NoteBox`.
  - Ô ghi chú `NoteBox`: xử lý chống ghi đè khi người dùng đang tập trung gõ (`typing.current = true`) ngay cả khi có bản tin SSE cập nhật từ server gửi về.
- **Tích hợp bản đồ số khuôn viên HUSTMAP (`MapView.jsx`):**
  - Sử dụng **MapLibre GL v4**, nạp động (`React.lazy`) để tối ưu hóa thời gian tải ban đầu của ứng dụng.
  - **Tự host ngoại tuyến 100%:** Toàn bộ dữ liệu vector tiles (zoom 16–18 bao trọn khuôn viên HUST), phông chữ glyphs Montserrat và sprite biểu tượng được lưu tại `web/public/hustmap/`, không tạo bất kỳ kết nối ra ngoài internet khi tải bản đồ.
  - Marker động thông minh tại 6 cụm trọng điểm (Nhà C2, Thư viện TQB, Cổng chính, Giữ xe C9, Khu ăn nhẹ C1, Phòng y tế D3) với màu sắc tự động cập nhật theo trạng thái ưu tiên cao nhất của các khu con (`red` > `yellow` > `green`).
  - Giao diện tương tác 2 chiều: chọn địa điểm trên bản đồ sẽ mở panel danh sách khu vực và nhúng trực tiếp `RoomCard` để ban tổ chức kiểm tra và cập nhật checklist trực tiếp ngay trên bản đồ.

## 7. Triển khai

### 7.0 VM riêng (Oracle, Singapore)

VM mới dùng riêng cho app này: **Ubuntu 24.04, VM.Standard.A1.Flex (arm64), 1 OCPU / 6 GB RAM, boot volume 50 GB**, mạng `vcn-main`, subnet public. Không dùng chung với ultimate-tckt, nên không cần giới hạn tài nguyên.

- **Không dùng Docker:** Node 22 chạy trực tiếp bằng systemd ở `127.0.0.1:3000`, nginx đứng trước.
- **Cài bằng `deploy/setup-vm.sh`** (chạy một lần, chạy lại không hỏng): cập nhật hệ thống, cài Node 22, nginx, certbot, sqlite3; mở 80/443 bằng iptables (chèn **trước** luật REJECT đầu tiên, rồi `netfilter-persistent save`); tạo user `eventapp`, thư mục `/opt/event-tracker` và `/var/lib/event-tracker`.
- **Hai lớp tường lửa:** Security List của VCN (kiểm tra 80/443 đã mở chưa, vì `vcn-main` có thể đã mở từ VM cũ) và iptables trong VM.
- **IP:** nên đổi sang Reserved public IP để DNS không bị đổi.
- **HTTPS:** `certbot --nginx -d sk.hust.edu.vn` chạy **sau khi** anh Tùng trỏ DNS về IP của VM này. Trong lúc chờ DNS, kiểm tra qua `http://<IP>`.
- **Sao lưu:** cron mỗi giờ, `sqlite3 .backup` sang `/var/backups/event-tracker/`, giữ 24 bản. Thêm một bản tải về máy anh/chị trước giờ demo.
- **Cập nhật code:** `deploy/deploy.sh` (rsync code lên, `systemctl restart event-tracker`). Chạy từ máy anh/chị bằng khóa SSH.

### 7.1 Cấu hình nginx

nginx (điểm cần nhớ là SSE):

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
}
location /events {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_buffering off;
  proxy_read_timeout 1h;
}
```

systemd: `Restart=always`, biến môi trường `PORT`, `DB_PATH=/var/lib/event-tracker/app.db`, `SESSION_SECRET`, `BASE_URL=https://sk.hust.edu.vn`, chạy bằng user thường (không phải root).

Sao lưu: `backup.sh` chạy mỗi giờ bằng cron, dùng `sqlite3 app.db ".backup ..."` và giữ 24 bản gần nhất. Kiểm tra bản sao lưu mở được.

Bảo mật tối thiểu: cookie HttpOnly + Secure, chặn ghi từ nguồn lạ (kiểm tra header `Origin` ở API ghi), giới hạn kích thước body, escape mọi chuỗi hiển thị, token đăng nhập dài 32 byte ngẫu nhiên, không ghi token vào log.

## 8. Chia nhỏ công việc

Ước lượng cho một người làm tập trung. Việc không phụ thuộc nhau có thể chia cho nhiều người.

| ID | Việc | Phụ thuộc | Ước lượng | Xong khi |
|---|---|---|---|---|
| A1 | `lib/db.js` + schema + `scripts/seed.js` + `seed.json` mẫu | — | 45 phút | Chạy seed là có đủ bảng và dữ liệu mẫu |
| A2 | `lib/session.js`, `auth/token.js`, `routes/auth.js`, `/api/me` | A1 | 45 phút | Bấm link có token là có cookie, `/api/me` trả đúng người |
| A3 | `lib/perm.js` + `routes/rooms.js` + `routes/users.js` + SSE | A1, A2 | 90 phút | Đúng bảng quyền mục 4 |
| A4 | `tests/api.test.js`: khách, phụ trách, admin, phụ trách khu vực khác | A3 | 45 phút | Test xanh. Đây là bằng chứng phân quyền đúng |
| A5 | Giao diện dashboard mobile bằng React (`web/`), chuyển từ `mockup/` | Định dạng `/api/state` (có thể dùng dữ liệu giả trước) | 2 giờ | Mục 6 trừ màn Quản lý |
| A6 | Màn Quản lý cho admin (React) | A3, A5 | 90 phút | Gán người phụ trách, thêm người dùng, copy link |
| D1 | `deploy/setup-vm.sh` + chạy trên VM mới: Node 22, nginx, certbot, iptables, user, thư mục | IP + khóa SSH của VM | 30 phút | `node -v` đúng, nginx chạy, `http://<IP>` mở được từ ngoài |
| D2 | `nginx.conf` + `event-tracker.service` + `backup.sh` + `deploy.sh`; HTTPS khi DNS xong | D1, DNS từ anh Tùng | 45 phút | `https://sk.hust.edu.vn` trả về trang |
| D3 | Đẩy code, chạy seed, kiểm tra trên điện thoại | A4, D2 | 30 phút | Mục 5 của PLAN.md đạt trừ SSO |
| B1 | `auth/sso.js` theo giao thức HUST | Giao thức, client id/secret | 60–120 phút | Đăng nhập bằng tài khoản HUST ra đúng email |
| E1 | Điền `seed.json` thật (khu vực, checklist, email phụ trách, admin) | — | tuỳ lượng dữ liệu | Seed nạp không lỗi |

Đường găng: A1 → A2 → A3 → A4 → D3. Chia hai người thì một người làm A1–A4, người kia làm A5–A6 (dựa vào `GET /api/state`, giữ nguyên định dạng như hiện tại), và D1–D2 làm song song từ giờ.

## 9. Việc cần chốt trước khi code

1. ~~Server~~ Đã rõ: VM Oracle mới, Ubuntu 24.04 (mục 7.0). Còn cần: IP công khai của VM, và anh Tùng trỏ DNS `sk.hust.edu.vn` về IP mới (anh ấy đang giữ IP VM cũ `168.107.68.32`, cần báo lại).
2. Dùng Express hay router tự viết? Mặc định là router tự viết để không phải cài gì.
3. Người phụ trách chỉ đổi màu, dòng text và trạng thái từng việc, không sửa nội dung checklist. Mặc định là đúng.
5. Tên 3 màu (đang để: Chưa sẵn sàng, Đang chuẩn bị, Sẵn sàng) và khu mới mặc định `red` đã đúng ý sếp chưa?
4. Email người phụ trách có dùng email HUST không? SSO sau này sẽ khớp theo email.
