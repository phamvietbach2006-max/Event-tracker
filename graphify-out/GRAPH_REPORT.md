# Graph Report - Event-tracker  (2026-10-16)

## Corpus Check
- 88 files · ~180,325 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 395 file(s) not represented in the graph (top: .pbf 388, (none) 2, .pptx 1)

## Summary
- 522 nodes · 1307 edges · 24 communities (20 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d966b76c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- React UI Components & Client API
- HTTP Application Server & Middleware
- Token & Session Authentication
- auth.js
- Vite Bundler & Frontend Dependencies
- Core Architecture & Business Rules
- Load Testing & Performance Benchmarks
- build_presentation.py
- Backend Package Configuration
- Vercel Deployment & Service Rewrites
- Rate Limiting & SSE Realtime Stream
- CdpClient
- DirectoryModal.jsx
- 1 Phạm vi đã chốt với anh
- Event Tracker backend  frontend Implementation Plan
- LogsView.jsx
- OfficerModal.jsx
- Project Overview & Product Highlights
- Technical Specification & Tech Stack
- System Use Cases & Workflow Specs
- Virtual Machine Setup Scripts
- Database Backup Automation
- Server Deployment Automation
- Quick Login Link Generation Scripts

## God Nodes (most connected - your core abstractions)
1. `HttpError` - 29 edges
2. `App()` - 28 edges
3. `createApp()` - 25 edges
4. `registerAdmin()` - 24 edges
5. `RoomCard()` - 23 edges
6. `lucide-react` - 21 edges
7. `react` - 20 edges
8. `registerAuth()` - 19 edges
9. `isPermanentAdmin()` - 18 edges
10. `openDb()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `registerAdmin()` --calls--> `hashPassword()`  [EXTRACTED]
  routes/admin.js → auth/password.js
- `registerAuth()` --indirect_call--> `ssoStart()`  [INFERRED]
  routes/auth.js → auth/sso.js
- `registerAuth()` --indirect_call--> `ssoCallback()`  [INFERRED]
  routes/auth.js → auth/sso.js
- `registerAdmin()` --calls--> `newToken()`  [EXTRACTED]
  routes/admin.js → auth/token.js
- `registerAdmin()` --calls--> `loginUrl()`  [EXTRACTED]
  routes/admin.js → auth/token.js

## Import Cycles
- None detected.

## Communities (24 total, 4 thin omitted)

### Community 0 - "React UI Components & Client API"
Cohesion: 0.07
Nodes (79): lucide-react, react, react-dom, api, ApiError, req(), App(), MapView (+71 more)

### Community 1 - "HTTP Application Server & Middleware"
Cohesion: 0.07
Nodes (36): hashToken(), loginUrl(), newToken(), DEFAULT_REVIEW_TEMPLATE, getContacts(), getDatabaseSync(), getLibsqlDatabase(), getState() (+28 more)

### Community 2 - "Token & Session Authentication"
Cohesion: 0.11
Nodes (53): createApp(), getReviewTemplate(), setReviewTemplate(), checkOrigin(), createRouter(), HttpError, readJson(), send() (+45 more)

### Community 3 - "auth.js"
Cohesion: 0.16
Nodes (27): DEFAULT_PASSWORD, hashPassword(), verifyPassword(), bindCookie(), discovery(), getJson(), keyFor(), metas (+19 more)

### Community 4 - "Vite Bundler & Frontend Dependencies"
Cohesion: 0.10
Nodes (20): maplibre-gl, vite, @vitejs/plugin-react, xlsx, dependencies, lucide-react, maplibre-gl, react (+12 more)

### Community 5 - "Core Architecture & Business Rules"
Cohesion: 0.06
Nodes (46): 1 Quy ước chung, 2 Giá trị cố định, 3 Đọc dữ liệu ai cũng gọi được không cần đăng nhập, 4 Ghi dữ liệu, GET apime, GET apistate, GET events SSE realtime, Hợp đồng API giữa backend và frontend (+38 more)

### Community 6 - "Load Testing & Performance Benchmarks"
Cohesion: 0.11
Nodes (24): fetchWithStats(), pct(), run(), stressEndpoint(), agent, args, base, fanout (+16 more)

### Community 7 - "build_presentation.py"
Cohesion: 0.14
Nodes (11): add_bullets(), add_callout(), add_caption(), add_fitted_image(), add_footer(), add_header(), build_presentation(), create_card() (+3 more)

### Community 8 - "Backend Package Configuration"
Cohesion: 0.13
Nodes (14): dependencies, libsql, engines, node, name, private, scripts, build (+6 more)

### Community 9 - "Vercel Deployment & Service Rewrites"
Cohesion: 0.15
Nodes (12): entrypoint, root, runtime, regions, rewrites, $schema, services, app (+4 more)

### Community 10 - "Rate Limiting & SSE Realtime Stream"
Cohesion: 0.27
Nodes (8): createRateLimiter(), getClientIp(), createSse(), add(), broadcast(), broadcastNotification(), broadcastStats(), write()

### Community 11 - "CdpClient"
Cohesion: 0.22
Nodes (4): CdpClient, main(), sleep(), startChrome()

### Community 12 - "DirectoryModal.jsx"
Cohesion: 0.60
Nodes (5): cleanPhone(), DirectoryModal(), formatPhoneDisplay(), getInitials(), TEAMS

### Community 13 - "1 Phạm vi đã chốt với anh"
Cohesion: 0.25
Nodes (8): 1 Phạm vi đã chốt với anh, 2 Thiết kế tóm tắt, 3 Các mảng việc và người nhận, 4 Mốc thời gian, 5 Danh sách kiểm tra trước khi demo, 6 Rủi ro, 7 Chưa quyết cần chốt, Kế hoạch triển khai Web theo dõi chuẩn bị sự kiện skhusteduvn

### Community 14 - "Event Tracker backend  frontend Implementation Plan"
Cohesion: 0.25
Nodes (8): Event Tracker backend  frontend Implementation Plan, Global Constraints, Phase 1 Backend nhánh featbackend PR 1, Review Focus, Task 1 Khung dự án  database, Task 2 Lõi HTTP kiểm tra dữ liệu phiên quyền, Task 3 Ứng dụng route công khai SSE seed helper test, Task 4 Đăng nhập apime link riêng đăng xuất khe SSO

### Community 15 - "LogsView.jsx"
Cohesion: 0.60
Nodes (5): ActionBadge(), formatVnTime(), LogsView(), RoleBadge(), timeAgo()

### Community 16 - "OfficerModal.jsx"
Cohesion: 0.80
Nodes (4): cleanPhone(), formatPhoneDisplay(), getInitials(), OfficerModal()

### Community 18 - "Project Overview & Product Highlights"
Cohesion: 0.25
Nodes (8): 1 Giới thiệu tổng quan, 2 Tính năng nổi bật, Bản đồ số HUSTMAP tích hợp Nhánh minh, Dashboard Trực quan  Realtime, Event Tracker  Hệ thống Theo dõi Chuẩn bị Sự kiện Thời gian thực, Phân quyền người dùng chặt chẽ RBAC, Triết lý kiến trúc, Xác thực hai kênh Dual Authentication

### Community 20 - "Technical Specification & Tech Stack"
Cohesion: 0.25
Nodes (8): 1 Stack chốt, 2 Cấu trúc thư mục, 3 Cơ sở dữ liệu, 4 API và quyền, 5 Khe cắm đăng nhập, 61 Bố cục và trải nghiệm người dùng, 6 Giao diện mobile-first và Kiến trúc UI mới, Stack và thiết kế kỹ thuật chi tiết

### Community 21 - "System Use Cases & Workflow Specs"
Cohesion: 0.25
Nodes (8): Sơ đồ tổng quan, UC1  Xem dashboard công khai, UC2  Đăng nhập  đăng xuất bằng link, UC3  Chủ khu cập nhật khu của mình, UC4  Nhận cập nhật realtime, UC5  Admin quản lý khối khu việc người dùng, UC6  Phân quyền và bảo mật, Use case và luồng xử lý  Theo dõi sự kiện

## Knowledge Gaps
- **24 isolated node(s):** `DEBIAN_FRONTEND`, `4 Sơ đồ Luồng Dữ liệu Data Flow`, `7 Chưa quyết cần chốt`, `Task 4 Đăng nhập apime link riêng đăng xuất khe SSO`, `Bản đồ số HUSTMAP tích hợp Nhánh minh` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 120 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `openDb()` connect `HTTP Application Server & Middleware` to `Token & Session Authentication`, `CdpClient`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `DEBIAN_FRONTEND`, `4 Sơ đồ Luồng Dữ liệu Data Flow`, `7 Chưa quyết cần chốt` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `React UI Components & Client API` be split into smaller, more focused modules?**
  _Cohesion score 0.06926811053024645 - nodes in this community are weakly interconnected._
- **Why does `getLibsqlDatabase()` connect `HTTP Application Server & Middleware` to `Backend Package Configuration`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `HTTP Application Server & Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.06875 - nodes in this community are weakly interconnected._
- **Why does `libsql` connect `Backend Package Configuration` to `HTTP Application Server & Middleware`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `Token & Session Authentication` be split into smaller, more focused modules?**
  _Cohesion score 0.11281826163301141 - nodes in this community are weakly interconnected._