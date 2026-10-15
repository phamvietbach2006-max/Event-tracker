import { Menu, Search, Wifi, WifiOff, X, Users, Eye, Building2, LogIn, LogOut, UserRound, BookUser, Bell } from 'lucide-react';
import { ORDER, ST, KIPS, COHORTS, UNITS, ROLES } from './logic.js';

export default function Header({
  me,
  online,
  stats,
  counts,
  tot,
  mode,
  filter,
  selectedUnit,
  onSelectUnit,
  availableUnits,
  unitCounts,
  onOpenImport,
  kipFilter,
  setKipFilter,
  cohortFilter,
  setCohortFilter,
  onNavigate,
  search,
  setSearch,
  onOpenSidebar,
  managing,
  onOpenLogin,
  onLogout,
  onOpenDirectory,
  unreadNotifCount = 0,
  onOpenNotifications,
}) {
  const onlineCount = Math.max(online ? 1 : 0, Number(stats?.online) || 0);
  const visitCount = Math.max(1, Number(stats?.visits) || 0);

  return <header className="topbar">
    <div className="topbar-row-1">
      <div className="space-brand">
        <button className="mobile-menu-btn" onClick={onOpenSidebar} aria-label="Mở menu"><Menu size={22} /></button>
        <img className="header-brand-logo" src="/logo.png" alt="Logo Ban Tổ chức - Kiểm tra Đoàn ĐHBK Hà Nội" />
        <div className="space-title-box">
          <div className="space-title-row">
            <h1 className="space-title">
              <span className="title-text">Đại hội Chi đoàn</span>
              <span className="title-unit-desktop"> — {selectedUnit === 'all' ? 'Toàn ĐHBK Hà Nội (12 Đơn vị)' : selectedUnit}</span>
            </h1>
            <span className={`live-pill ${online ? '' : 'offline'}`}>{online ? <Wifi size={13} /> : <WifiOff size={13} />}{online ? 'Trực tiếp' : 'Đang kết nối'}</span>
          </div>
          <p className="space-subtitle">{tot.rooms} lớp · {tot.done}/{tot.total} mục giấy tờ đã đủ ({tot.pct}%)</p>
        </div>
      </div>

      <div className="header-right-zone">
        <button
          type="button"
          className="header-directory-btn"
          onClick={onOpenDirectory}
          title="Xem danh bạ cán bộ Ban Tổ chức - Kiểm tra và số điện thoại"
          aria-label="Danh bạ cán bộ"
        >
          <BookUser size={15} />
          <span className="btn-text">Danh bạ</span>
        </button>

        <button
          type="button"
          className="header-notif-btn"
          onClick={onOpenNotifications}
          title={unreadNotifCount > 0 ? `Có ${unreadNotifCount} thông báo từ hệ thống` : "Xem thông báo hệ thống"}
          aria-label="Thông báo hệ thống"
        >
          <Bell size={15} />
          <span className="btn-text">Thông báo</span>
          {unreadNotifCount > 0 && (
            <span className="header-notif-badge">{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</span>
          )}
        </button>

        <div className="header-stats-pill" aria-label={`${onlineCount} người đang online, ${visitCount} lượt truy cập`}>
          <span className="header-stat-item online-item" title="Số người đang online trực tuyến">
            <Users size={14} aria-hidden="true" />
            <b>{onlineCount}</b>
            <span className="header-stat-label">online</span>
          </span>
          <i className="header-stats-sep" aria-hidden="true" />
          <span className="header-stat-item visit-item" title="Tổng số lượt truy cập hệ thống">
            <Eye size={14} aria-hidden="true" />
            <b>{visitCount.toLocaleString('vi-VN')}</b>
            <span className="header-stat-label">lượt xem</span>
          </span>
        </div>

        {me ? (
          <div className="header-user-badge">
            <span className={`header-user-avatar role-avatar-${me.role || (me.isAdmin ? 'admin' : 'room_lead')}`}>
              {me.name?.charAt(0).toUpperCase() || 'U'}
            </span>
            <div className="header-user-info" title={me.email}>
              <span className="header-user-name">{me.name}</span>
              <span className={`header-role-tag role-tag-${me.role || (me.isAdmin ? 'admin' : 'room_lead')}`}>
                {ROLES[me.role || (me.isAdmin ? 'admin' : 'room_lead')]?.badge || (me.isAdmin ? 'Admin' : 'Cán bộ')}
              </span>
            </div>
            <button
              type="button"
              className="header-logout-btn"
              onClick={onLogout}
              title="Đăng xuất khỏi hệ thống"
              aria-label="Đăng xuất"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="header-login-btn"
            onClick={onOpenLogin}
            title="Đăng nhập cán bộ kiểm tra để cập nhật tiến độ"
          >
            <LogIn size={15} />
            <span>Đăng nhập Cán bộ</span>
          </button>
        )}
      </div>
    </div>

    {!managing && mode !== 'map' && mode !== 'dashboard' && mode !== 'logs' && (
      <div className="filter-bar-stack">
        <div className="filter-toolbar" role="toolbar" aria-label="Thanh công cụ lọc">
          {/* 1. Chọn Đơn vị */}
          <label className="unit-select-box" title="Chuyển đổi Đơn vị tổ chức Đại hội">
            <Building2 size={15} className="unit-select-icon" />
            <select
              className="unit-select-control"
              value={selectedUnit}
              onChange={(e) => { onSelectUnit(e.target.value); onNavigate('overview'); }}
              aria-label="Chọn đơn vị tổ chức Đại hội"
            >
              <option value="all">
                {(availableUnits || UNITS).length > 1 ? `Tất cả ${(availableUnits || UNITS).length} đơn vị` : 'Đơn vị'} ({unitCounts?.all ?? 0} lớp)
              </option>
              {(availableUnits || UNITS).map((u) => (
                <option key={u} value={u}>{u} ({unitCounts?.[u] ?? 0} lớp)</option>
              ))}
            </select>
          </label>

          <div className="filter-dropdowns-group">
            {/* 2. Lọc Trạng thái */}
            <select
              className={`filter-dropdown ${mode === 'status' ? 'active-filter' : ''}`}
              value={mode === 'status' ? filter : mode === 'mine' ? '__mine__' : 'all'}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__mine__') onNavigate('mine');
                else if (v === 'all') onNavigate('overview');
                else onNavigate('status', v);
              }}
              aria-label="Lọc trạng thái"
            >
              <option value="all">Tất cả trạng thái ({tot.rooms})</option>
              {ORDER.map((s) => (
                <option key={s} value={s}>{ST[s]} ({counts[s]})</option>
              ))}
              {me && <option value="__mine__">Lớp của tôi ({me.ownedRoomIds?.length || 0})</option>}
            </select>

            {/* 3. Lọc Kíp */}
            <select
              className={`filter-dropdown ${kipFilter !== 'all' ? 'active-filter' : ''}`}
              value={kipFilter}
              onChange={(e) => setKipFilter(e.target.value)}
              aria-label="Lọc theo kíp"
            >
              {KIPS.map((k) => (
                <option key={k.id} value={k.id}>{k.label}</option>
              ))}
            </select>

            {/* 4. Lọc Khóa */}
            <select
              className={`filter-dropdown ${cohortFilter !== 'all' ? 'active-filter' : ''}`}
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              aria-label="Lọc theo khóa"
            >
              {COHORTS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* 5. Tìm kiếm */}
          <label className="search-box">
            <Search size={16} className="search-icon" />
            <input
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm phòng (D9-101), tên lớp, K70/K71, ghi chú…"
              aria-label="Tìm kiếm lớp và phòng"
            />
            {search && <button className="search-clear" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm"><X size={14} /></button>}
          </label>
        </div>
      </div>
    )}
  </header>;
}
