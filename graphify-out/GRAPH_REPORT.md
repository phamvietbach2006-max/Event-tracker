# Graph Report - Event-tracker  (2026-10-15)

## Corpus Check
- 81 files · ~170,805 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 395 file(s) not represented in the graph (top: .pbf 388, (none) 2, .pptx 1)

## Summary
- 499 nodes · 1206 edges · 25 communities (21 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6dab561a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- React UI Components & Client API
- HTTP Application Server & Middleware
- Token & Session Authentication
- sso.js
- Vite Bundler & Frontend Dependencies
- Core Architecture & Business Rules
- Load Testing & Performance Benchmarks
- build_presentation.py
- Backend Package Configuration
- Vercel Deployment & Service Rewrites
- Rate Limiting & SSE Realtime Stream
- CdpClient
- REST API Design & Conventions
- Project Scope & Execution Timeline
- System Architecture & Codemaps
- LogsView.jsx
- Test Scenarios & Quality Assurance
- Project Overview & Product Highlights
- Technical Specification & Tech Stack
- System Use Cases & Workflow Specs
- Officer Modal & Contact Formatting
- Virtual Machine Setup Scripts
- Database Backup Automation
- Server Deployment Automation
- Quick Login Link Generation Scripts

## God Nodes (most connected - your core abstractions)
1. `HttpError` - 26 edges
2. `App()` - 26 edges
3. `createApp()` - 23 edges
4. `registerAdmin()` - 23 edges
5. `RoomCard()` - 22 edges
6. `registerAuth()` - 19 edges
7. `openDb()` - 17 edges
8. `lucide-react` - 17 edges
9. `registerRooms()` - 16 edges
10. `react` - 16 edges

## Surprising Connections (you probably didn't know these)
- `registerAuth()` --indirect_call--> `ssoStart()`  [INFERRED]
  routes/auth.js → auth/sso.js
- `registerAuth()` --indirect_call--> `ssoCallback()`  [INFERRED]
  routes/auth.js → auth/sso.js
- `ssoCallback()` --calls--> `createSession()`  [EXTRACTED]
  auth/sso.js → lib/session.js
- `ssoCallback()` --calls--> `parseCookies()`  [EXTRACTED]
  auth/sso.js → lib/session.js
- `ssoCallback()` --calls--> `setSessionCookie()`  [EXTRACTED]
  auth/sso.js → lib/session.js

## Import Cycles
- None detected.

## Communities (25 total, 4 thin omitted)

### Community 0 - "React UI Components & Client API"
Cohesion: 0.07
Nodes (80): lucide-react, maplibre-gl, react, react-dom, api, ApiError, req(), App() (+72 more)

### Community 1 - "HTTP Application Server & Middleware"
Cohesion: 0.08
Nodes (31): getContacts(), getDatabaseSync(), getLibsqlDatabase(), getState(), groupBy(), openDb(), require, tx() (+23 more)

### Community 2 - "Token & Session Authentication"
Cohesion: 0.08
Nodes (65): DEFAULT_PASSWORD, hashPassword(), verifyPassword(), hashToken(), loginUrl(), newToken(), userByToken(), createApp() (+57 more)

### Community 3 - "sso.js"
Cohesion: 0.33
Nodes (13): bindCookie(), discovery(), getJson(), keyFor(), metas, pending, purge(), rand() (+5 more)

### Community 4 - "Vite Bundler & Frontend Dependencies"
Cohesion: 0.10
Nodes (19): vite, @vitejs/plugin-react, xlsx, dependencies, lucide-react, maplibre-gl, react, react-dom (+11 more)

### Community 5 - "Core Architecture & Business Rules"
Cohesion: 0.09
Nodes (30): Microsoft Entra ID SSO, 100% Paperwork Checklist Rule, Permanent Admin Protection, React & Vite Frontend, Server-Sent Events (SSE), SQLite & Libsql Database, Cấu hình VM đã chỉnh sau test tải 2026-10-12, Cách hoạt động (+22 more)

### Community 6 - "Load Testing & Performance Benchmarks"
Cohesion: 0.10
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
Cohesion: 0.52
Nodes (6): createSse(), add(), broadcast(), broadcastNotification(), broadcastStats(), write()

### Community 11 - "CdpClient"
Cohesion: 0.22
Nodes (4): CdpClient, main(), sleep(), startChrome()

### Community 12 - "REST API Design & Conventions"
Cohesion: 0.25
Nodes (8): 1 Quy ước chung, 2 Giá trị cố định, 3 Đọc dữ liệu ai cũng gọi được không cần đăng nhập, 4 Ghi dữ liệu, GET apime, GET apistate, GET events SSE realtime, Hợp đồng API giữa backend và frontend

### Community 13 - "Project Scope & Execution Timeline"
Cohesion: 0.25
Nodes (8): 1 Phạm vi đã chốt với anh, 2 Thiết kế tóm tắt, 3 Các mảng việc và người nhận, 4 Mốc thời gian, 5 Danh sách kiểm tra trước khi demo, 6 Rủi ro, 7 Chưa quyết cần chốt, Kế hoạch triển khai Web theo dõi chuẩn bị sự kiện skhusteduvn

### Community 14 - "System Architecture & Codemaps"
Cohesion: 0.25
Nodes (8): 1 Sơ đồ Kiến trúc Tổng thể System Architecture, 21 Bảng phân tích các module Backend, 2 Bản đồ Module Backend, 31 Bảng phân tích các module Frontend websrc, 32 Tài nguyên Bản đồ Ngoại tuyến webpublichustmap, 3 Bản đồ Module Frontend, 4 Sơ đồ Luồng Dữ liệu Data Flow, Bản đồ Kiến trúc Hệ thống Architecture Codemap

### Community 15 - "LogsView.jsx"
Cohesion: 0.60
Nodes (5): ActionBadge(), formatVnTime(), LogsView(), RoleBadge(), timeAgo()

### Community 16 - "Test Scenarios & Quality Assurance"
Cohesion: 0.25
Nodes (8): 0 Chuẩn bị, Hướng dẫn kiểm thử  Theo dõi sự kiện, UC1  Khách xem dashboard công khai, UC2  Đăng nhập  đăng xuất bằng link, UC3  Chủ khu cập nhật khu của mình, UC4  Realtime, UC5  Admin quản lý trang manage, UC6  Bảo mật và phân quyền gọi API

### Community 18 - "Project Overview & Product Highlights"
Cohesion: 0.25
Nodes (8): 1 Giới thiệu tổng quan, 2 Tính năng nổi bật, Bản đồ số HUSTMAP tích hợp Nhánh minh, Dashboard Trực quan  Realtime, Event Tracker  Hệ thống Theo dõi Chuẩn bị Sự kiện Thời gian thực, Phân quyền người dùng chặt chẽ RBAC, Triết lý kiến trúc, Xác thực hai kênh Dual Authentication

### Community 20 - "Technical Specification & Tech Stack"
Cohesion: 0.25
Nodes (8): 1 Stack chốt, 2 Cấu trúc thư mục, 3 Cơ sở dữ liệu, 4 API và quyền, 5 Khe cắm đăng nhập, 61 Bố cục và trải nghiệm người dùng, 6 Giao diện mobile-first và Kiến trúc UI mới, Stack và thiết kế kỹ thuật chi tiết

### Community 21 - "System Use Cases & Workflow Specs"
Cohesion: 0.25
Nodes (8): Sơ đồ tổng quan, UC1  Xem dashboard công khai, UC2  Đăng nhập  đăng xuất bằng link, UC3  Chủ khu cập nhật khu của mình, UC4  Nhận cập nhật realtime, UC5  Admin quản lý khối khu việc người dùng, UC6  Phân quyền và bảo mật, Use case và luồng xử lý  Theo dõi sự kiện

### Community 23 - "Officer Modal & Contact Formatting"
Cohesion: 0.80
Nodes (4): cleanPhone(), formatPhoneDisplay(), getInitials(), OfficerModal()

## Knowledge Gaps
- **24 isolated node(s):** `DEBIAN_FRONTEND`, `4 Ghi dữ liệu`, `7 Chưa quyết cần chốt`, `4 Sơ đồ Luồng Dữ liệu Data Flow`, `Task 4 Đăng nhập apime link riêng đăng xuất khe SSO` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 115 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `openDb()` connect `HTTP Application Server & Middleware` to `Token & Session Authentication`, `CdpClient`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `DEBIAN_FRONTEND`, `4 Ghi dữ liệu`, `7 Chưa quyết cần chốt` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `React UI Components & Client API` be split into smaller, more focused modules?**
  _Cohesion score 0.06658901184236071 - nodes in this community are weakly interconnected._
- **Why does `getLibsqlDatabase()` connect `HTTP Application Server & Middleware` to `Backend Package Configuration`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `HTTP Application Server & Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.07769423558897243 - nodes in this community are weakly interconnected._
- **Why does `libsql` connect `Backend Package Configuration` to `HTTP Application Server & Middleware`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Token & Session Authentication` be split into smaller, more focused modules?**
  _Cohesion score 0.08207934336525308 - nodes in this community are weakly interconnected._