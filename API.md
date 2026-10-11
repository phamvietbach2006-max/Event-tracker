# Hợp đồng API giữa backend và frontend

Tài liệu bàn giao cho frontend dev. Chi tiết nội bộ backend xem [TECH.md](TECH.md). Giao diện mẫu: `mockup/index.html`. Dữ liệu mẫu đúng định dạng thật: `mockup/state.sample.json`.

Nếu backend đổi bất kỳ điểm nào dưới đây, **sửa file này trước** rồi báo frontend.

## 1. Quy ước chung

- **Cùng một origin** (`https://sk.hust.edu.vn`): frontend (file tĩnh trong `dist/`) và API cùng một địa chỉ. **Không có CORS.** Khi dev, Vite proxy `/api`, `/events`, `/auth` sang backend.
- Mọi API ghi dùng `Content-Type: application/json`, body JSON. Mọi `fetch` dùng `credentials: 'same-origin'`.
- Đăng nhập bằng cookie `sid` (HttpOnly) do server đặt. Frontend **không** tự lưu token hay mật khẩu.
- Thời gian là số mili giây epoch (`Date.now()`), múi giờ hiển thị: Asia/Ho_Chi_Minh.
- Lỗi: mã HTTP + body `{ "error": "mã_lỗi", "message": "mô tả cho người đọc" }`.

| Mã | Ý nghĩa | Frontend xử lý |
|---|---|---|
| 400 | Dữ liệu gửi lên sai | Báo lỗi, hoàn lại thay đổi vừa làm |
| 401 | Chưa đăng nhập hoặc phiên hết hạn | Chuyển về chế độ khách, hiện nút Đăng nhập |
| 403 | Đã đăng nhập nhưng không có quyền | Hoàn lại thay đổi, báo "Bạn không có quyền sửa khu này" |
| 404 | Không tìm thấy | Tải lại state |
| 429 / 5xx | Quá tải / lỗi server | Hoàn lại, báo thử lại |

## 2. Giá trị cố định

**Trạng thái của khu** (`room.status`) chỉ nhận 3 giá trị, do **người phụ trách tự chọn bằng tay**. Server **không tự đổi** theo phần trăm việc đã xong.

| Giá trị | Nhãn hiển thị (tạm, chờ chốt) | Màu |
|---|---|---|
| `red` | Chưa sẵn sàng | đỏ |
| `yellow` | Đang chuẩn bị | vàng |
| `green` | Sẵn sàng | xanh lá |

Khu mới tạo mặc định là `red`. Không có trạng thái "sự cố" riêng: có vấn đề thì người phụ trách về màu đỏ và ghi dòng text (`note`).

**Trạng thái của từng việc** trong checklist (`task.state`) có 3 giá trị:

| Giá trị | Nhãn hiển thị |
|---|---|
| `todo` | Chưa làm |
| `doing` | Đang làm |
| `done` | Xong |

Phần trăm hoàn thành của khu = số việc `done` / tổng số việc. **Frontend tự tính**, backend không trả. Phần trăm chỉ để tham khảo, không quyết định màu.

Giới hạn: `note` tối đa **150** ký tự (1 dòng status ngắn), `text` của việc tối đa 200 ký tự, tên khu và khối tối đa 80 ký tự.

## 3. Đọc dữ liệu (ai cũng gọi được, không cần đăng nhập)

### `GET /api/state`

Toàn bộ dashboard. Cấu trúc đúng như `mockup/state.sample.json`:

```json
{
  "version": 1,
  "groups": [
    {
      "id": 2, "name": "Khối C2", "sort": 1,
      "rooms": [
        {
          "id": 5, "name": "Sảnh C2", "status": "red",
          "note": "Thiếu 200 thẻ đại biểu, đang in lại",
          "sort": 1, "updatedAt": 1791741000000, "updatedBy": "Nguyễn Văn A",
          "owners": [ { "name": "Nguyễn Văn A" } ],
          "tasks": [ { "id": 501, "text": "In và xếp thẻ đại biểu", "state": "doing", "sort": 1 } ]
        }
      ]
    }
  ]
}
```

- `owners` chỉ có **tên**, không có email (dashboard công khai).
- `updatedBy` là tên hiển thị, có thể `null`.
- Các mảng đã được sắp theo `sort`. Frontend giữ nguyên thứ tự này (không tự sắp lại theo màu), để vị trí khu trên màn hình ổn định.

### `GET /events` (SSE, realtime)

Dùng `new EventSource('/events')`.
- Ngay khi kết nối, server gửi một message `data: <JSON state>` có cùng cấu trúc `/api/state`.
- Mỗi lần có thay đổi, server gửi lại **toàn bộ state mới** (vài KB). Frontend thay thế state, không cần ghép từng phần.
- `EventSource` tự nối lại khi rớt mạng. Frontend chỉ cần hiện trạng thái kết nối (chấm xanh/đỏ) dựa vào `onopen` và `onerror`.
- Server gửi dòng comment `: ka` mỗi 25 giây để giữ kết nối, frontend bỏ qua.

### `GET /api/me`

Hiện tại là ai và được sửa gì.

```json
{ "email": "a@hust.edu.vn", "name": "Nguyễn Văn A", "isAdmin": false, "ownedRoomIds": [4, 5] }
```

Chưa đăng nhập hoặc email không có trong danh sách người dùng: trả `200` với body `null`.

Frontend dùng `ownedRoomIds` và `isAdmin` để **hiện hoặc ẩn điều khiển** (nút đổi màu khu, nút đổi trạng thái việc, ô ghi chú). Đây chỉ để giao diện gọn. Server luôn kiểm tra quyền thật và trả 403 nếu sai.

## 4. Ghi dữ liệu

Chỉ người phụ trách khu đó hoặc admin gọi được các API trong mục 4.1. Mỗi API trả `200` với **đối tượng vừa cập nhật**. Sau khi ghi thành công, mọi máy (kể cả máy gửi) nhận state mới qua SSE.

### 4.1 Phụ trách khu đó, admin

| Gọi | Body | Việc |
|---|---|---|
| `PATCH /api/rooms/:id/status` | `{ "status": "yellow" }` | Đổi màu trạng thái khu (`red`, `yellow`, `green`) |
| `PATCH /api/rooms/:id/note` | `{ "note": "Chờ chạy thử máy chiếu" }` | Đổi dòng status ngắn (tối đa 150 ký tự, được để trống) |
| `PATCH /api/tasks/:id` | `{ "state": "done" }` | Đổi trạng thái một việc (`todo`, `doing`, `done`) |

### 4.2 Chỉ admin

| Gọi | Body | Việc |
|---|---|---|
| `POST /api/groups` | `{ "name": "Khối mới" }` | Thêm khối |
| `PATCH /api/groups/:id` | `{ "name"?, "sort"? }` | Đổi tên, thứ tự khối |
| `DELETE /api/groups/:id` | — | Xoá khối (chỉ khi không còn khu con, nếu không trả 400) |
| `POST /api/groups/:id/rooms` | `{ "name": "Khu mới" }` | Thêm khu con vào khối |
| `PATCH /api/rooms/:id` | `{ "name"?, "sort"?, "groupId"? }` | Đổi tên, thứ tự, chuyển khối |
| `DELETE /api/rooms/:id` | — | Xoá khu |
| `PUT /api/rooms/:id/owners` | `{ "emails": ["a@hust.edu.vn"] }` | Gán người phụ trách (1 đến N), thay thế danh sách cũ |
| `POST /api/rooms/:id/tasks` | `{ "text": "Việc mới" }` | Thêm việc |
| `PATCH /api/tasks/:id` | `{ "text": "…" }` | Sửa nội dung việc |
| `DELETE /api/tasks/:id` | — | Xoá việc |
| `GET /api/users` | — | Danh sách người dùng |
| `POST /api/users` | `{ "email", "name", "isAdmin" }` | Thêm người dùng |
| `PATCH /api/users/:email` | `{ "name"?, "isAdmin"? }` | Sửa người dùng |
| `DELETE /api/users/:email` | — | Xoá người dùng |
| `POST /api/users/:email/token` | — | Tạo lại link đăng nhập riêng, trả `{ "url": "https://…/auth/token?t=…" }` |

`GET /api/users` trả: `[ { "email", "name", "isAdmin", "ownedRoomIds": [..], "hasToken": true } ]`. Đây là nơi duy nhất frontend thấy email, và chỉ admin gọi được.

## 5. Đăng nhập

| Đường dẫn | Ai dùng | Việc |
|---|---|---|
| `GET /auth/token?t=<token>` | Link riêng gửi cho từng người | Server đặt cookie `sid` rồi chuyển về `/` |
| `GET /auth/sso/start` | Nút "Đăng nhập" (khi có SSO HUST) | Chuyển sang trang đăng nhập của HUST |
| `GET /auth/callback` | HUST gọi về | Server đặt cookie rồi chuyển về `/` |
| `POST /auth/logout` | Nút Đăng xuất | Xoá cookie, trả `204` |

Frontend không cần xử lý form đăng nhập. Nút "Đăng nhập" chỉ là một liên kết `<a href="/auth/sso/start">`. Trong giai đoạn dự phòng (chưa có SSO) người dùng vào bằng link riêng, nên nút này tạm ẩn hoặc hiện hướng dẫn "Dùng link được gửi riêng cho bạn".

## 6. Hành vi frontend cần làm

1. Lúc vào trang: gọi `GET /api/me` và mở `EventSource('/events')`. State dashboard lấy từ SSE (không cần gọi `/api/state`, chỉ dùng khi SSE chưa nối được).
2. **Cập nhật lạc quan:** khi đổi trạng thái việc hoặc đổi màu khu, cập nhật giao diện ngay, rồi gửi API. Nếu lỗi thì hoàn lại và hiện thông báo. Khi SSE gửi state mới về thì state đó là sự thật cuối cùng.
3. Ô ghi chú gửi khi rời ô (`onBlur`) hoặc nhấn Enter, không gửi từng phím. Giới hạn 150 ký tự (`maxLength`).
4. Khi SSE đang gửi state mới mà người dùng đang gõ ghi chú: **không** ghi đè nội dung đang gõ.
5. Mất mạng: hiện thanh "Đang kết nối lại…". Có mạng lại thì state tự cập nhật qua SSE.
6. Chỉ hiện điều khiển sửa theo `/api/me`. Khu không thuộc mình: hiện khoá và dòng "Chỉ người phụ trách mới sửa được".
7. **Bố cục dashboard (theo yêu cầu của sếp):** mở sẵn cả 3 khối. Mỗi khu là một block gồm **màu, tên, người phụ trách, 1 dòng text status, phần trăm việc xong**. Bấm block mới xem checklist chi tiết. Khối có thể gập lại, khi gập chỉ còn các ô màu (tên + màu). Bốn thứ này luôn thấy được mà không cần mở khối hay bấm gì thêm: màu, tên khu, người phụ trách, dòng text.
8. **Việc trong checklist:** nút đổi trạng thái 3 bước (Chưa làm → Đang làm → Xong → quay lại), bấm một lần chuyển một bước. Ô bấm cao tối thiểu 44 px.
9. **Không** tự đổi màu khu theo phần trăm việc xong, và không giả lập điều đó trên giao diện.
10. Bắt buộc dùng điện thoại: một cột, ô bấm cao tối thiểu 44 px, hiển thị tốt từ 360 px. Đã thể hiện trong `mockup/index.html`.

## 7. Tài khoản test (backend cung cấp trước khi frontend tích hợp)

Backend tạo sẵn dữ liệu mẫu (`seed`) và 3 link đăng nhập thử, gửi frontend qua kênh riêng (không ghi vào repo):

| Vai trò | Dùng để thử |
|---|---|
| Admin | Mọi điều khiển, màn Quản lý |
| Phụ trách 2 khu (Hội trường C2, Sảnh C2) | Sửa khu của mình, khu khác bị khoá |
| Khách (không đăng nhập) | Chỉ xem |

## 8. Triển khai

- Frontend build ra `web/dist/` (`npm run build`). Backend phục vụ `dist/` ở đường dẫn gốc `/`. Mọi đường dẫn không phải `/api`, `/events`, `/auth` trả `index.html` (SPA).
- Đường dẫn trong bản build dùng tương đối từ gốc (`base: '/'`). Không dùng địa chỉ tuyệt đối tới server.
- Môi trường thử: `https://sk.hust.edu.vn` (sau khi DNS xong). Trước đó dùng `http://168.107.75.89`.

### 4.3 Quy ước kết quả

- Tạo mới (`POST`) và sửa (`PATCH`) trả `200` với đối tượng vừa ghi. Khu/việc trả dạng `{ id, groupId|roomId, name|text, status|state, note, sort, updatedAt, updatedBy }`.
- Xoá (`DELETE`) trả `200` với `{ "ok": true }`.
- `PUT /api/rooms/:id/owners` nhận `emails` có thể rỗng (bỏ hết người phụ trách), trả `{ "roomId": 5, "emails": ["a@hust.edu.vn"] }`. Email phải đã có trong danh sách người dùng, nếu không trả 400 `unknown_user`.
- `PATCH /api/tasks/:id` chỉ gửi `state` thì chủ khu cũng gọi được; gửi `text` thì chỉ admin (kể cả khi gửi cùng `state`).
- Admin không tự xoá (`cannot_delete_self`) hoặc tự bỏ quyền admin (`cannot_demote_self`) của chính mình; xoá khối còn khu trả `group_not_empty`.
