# Stack và thiết kế kỹ thuật chi tiết

Đi kèm [PLAN.md](PLAN.md). Giao thức SSO chưa biết nên phần SSO chỉ làm một "khe cắm" (mục 5).

## 1. Stack chốt

| Lớp | Chọn | Lý do |
|---|---|---|
| Runtime | **Node.js 22 LTS** | Đã chạy được, không cần build |
| HTTP | `node:http` + router nhỏ tự viết (hoặc Express nếu cả nhóm quen hơn) | Ít thư viện, ít thứ hỏng khi deploy |
| Dữ liệu | **SQLite** (`node:sqlite` có sẵn từ Node 22.5) | Mỗi thao tác là một câu UPDATE nguyên tử, nhiều người sửa cùng lúc không ghi đè nhau. Sao lưu bằng một lệnh. Thay cho `data.json` |
| Realtime | **SSE** (`/events`) | Một chiều server → máy, đủ cho dashboard, tự nối lại khi rớt mạng |
| Giao diện | **React 18 + Vite** (TypeScript nếu cả nhóm quen, không thì JS), CSS thường | Nhóm đã chọn React. Vite build ra file tĩnh nên không cần Next.js hay server render. Giữ bundle nhỏ vì dùng trên 4G |
| Phiên đăng nhập | Cookie `sid` (HttpOnly, Secure, SameSite=Lax), lưu trong bảng `sessions` | Đơn giản, thu hồi được |
| SSO | Module cắm vào (`auth/sso.js`) | Viết khi biết giao thức. Nếu là OIDC dùng thư viện `openid-client` |
| Reverse proxy | **nginx** + HTTPS | Cần tắt buffering cho SSE |
| Chạy nền | **systemd** (`Restart=always`) | Tự khởi động lại khi lỗi hoặc khi server reboot |
| Test | `node:test` + chạy thật trên điện thoại | Không thêm thư viện |

Dependency: **backend không có** (chỉ thêm `openid-client` nếu SSO là OIDC). **Frontend:** `react`, `react-dom`, `vite`. Không thêm thư viện UI hay quản lý state, vì dùng `useReducer` + một hook `useLiveState()` là đủ.

**Build:** `npm run build` trong `web/` ra `web/dist/`, **build trên máy anh/chị rồi rsync `dist/` lên VM** (VM không cần cài toolchain build). Server Node phục vụ `dist/` như file tĩnh. Khi dev, Vite chạy ở cổng riêng và proxy `/api`, `/events`, `/auth` sang Node.

Việc cần xác nhận trên server `168.107.68.32`: phiên bản Node (`node -v`), hệ điều hành, có nginx chưa, có chứng chỉ HTTPS cho `sk.hust.edu.vn` chưa.

## 2. Cấu trúc thư mục

```
event-tracker/
├── server.js            # khởi động, gắn router, SSE
├── lib/
│   ├── db.js            # mở SQLite, tạo bảng, hàm truy vấn
│   ├── session.js       # tạo/đọc/xoá session, cookie
│   ├── perm.js          # canEditRoom(user, roomId), isAdmin(user)
│   └── sse.js           # danh sách client, broadcast
├── routes/
│   ├── public.js        # GET /api/state, /events
│   ├── rooms.js         # API khu vực, checklist
│   ├── users.js         # API quản lý người dùng (admin)
│   └── auth.js          # /login, /auth/*, /api/me, logout
├── auth/
│   ├── token.js         # đăng nhập bằng link riêng (dự phòng)
│   └── sso.js           # SSO HUST (làm sau)
├── web/                 # React + Vite
│   ├── index.html
│   ├── vite.config.js   # proxy /api, /events, /auth sang :3000 khi dev
│   └── src/
│       ├── main.jsx
│       ├── api.js            # fetch + kiểu dữ liệu
│       ├── useLiveState.js   # SSE + tự nối lại, trả về state
│       ├── components/       # GroupCard, RoomCard, StatusTiles, TaskList, RoleBar…
│       ├── pages/            # Dashboard, Manage (admin)
│       └── styles.css        # chuyển từ mockup/index.html
├── mockup/              # mẫu giao diện đã duyệt, làm khuôn cho web/
├── seed.json            # danh sách khu vực, checklist, người phụ trách, admin
├── scripts/seed.js      # nạp seed.json vào DB
├── tests/api.test.js
└── deploy/
    ├── nginx.conf
    ├── event-tracker.service
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

## 6. Giao diện (mobile-first)

- Một cột dưới 600 px, nút và ô đổi trạng thái việc cao tối thiểu 44 px.
- Thanh trên cùng dính khi cuộn: số khu vực theo từng status, thanh tiến độ tổng, chấm xanh/đỏ báo đang kết nối realtime.
- Bộ lọc nhanh: bấm ô đếm màu (đỏ, vàng, xanh) ở đầu trang, và **Của tôi** (chỉ hiện khi đã login).
- **Hai cấp:** 3 khối (dropdown), **mở sẵn khi vào trang**. Mỗi khu là một block luôn hiện đủ: **màu, tên, người phụ trách, 1 dòng text status, % việc xong**. Bấm block mới xem checklist chi tiết. Khối gập lại thì chỉ còn các ô màu (tên + màu).
- Khối có dòng tóm tắt: số khu đang sự cố, đang chuẩn bị, sẵn sàng, chưa bắt đầu.
- Quyền gán ở cấp khu con (`room_owners`). Admin xem và sửa tất cả.
- Khách: card chỉ đọc. Người phụ trách: chỉ card của mình có điều khiển. Admin: mọi card, thêm nút quản lý.
- Tick cập nhật ngay trên màn hình (không chờ server), lỗi thì hoàn lại và báo.
- Màn Quản lý (admin): danh sách khu vực (thêm, đổi tên, thứ tự, gán người phụ trách), danh sách người dùng (thêm, đặt admin, copy link đăng nhập).
- Mất mạng: hiện thanh "Đang kết nối lại…", tự lấy lại state khi có mạng.

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
