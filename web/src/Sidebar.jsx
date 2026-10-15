import { useState } from 'react';
import { LayoutDashboard, ClipboardList, Home, Star, Settings, LogOut, LogIn, X, Map as MapIcon, Building2, FileSpreadsheet, ChevronDown, ChevronRight, BookUser } from 'lucide-react';
import { UNITS, ROLES, parseGroupMeta, isUserAdmin } from './logic.js';

/* Nhóm groups theo tòa (ví dụ D9, C7, …) rồi theo đơn vị */
function groupByBuilding(groups) {
  // Trả về map: buildingKey → { label, unit, floors: [group] }
  const map = new globalThis.Map();
  for (const g of (groups || [])) {
    const { unit, floorName } = parseGroupMeta(g.name);
    // Lấy mã tòa từ tên tầng: "Tầng 1 tòa D9" → "D9"
    const m = /tòa\s+([A-Za-z0-9]+)/i.exec(floorName || '');
    const bldCode = m ? m[1].toUpperCase() : (floorName || 'Khác');
    const shortUnit = (unit || '').replace(/^Trường\s+/, '');
    const key = `${unit}||${bldCode}`;
    if (!map.has(key)) {
      map.set(key, { bldCode, unit, label: `${bldCode} (${shortUnit})`, floors: [] });
    }
    map.get(key).floors.push(g);
  }
  return Array.from(map.values());
}

export default function Sidebar({
  me,
  mode,
  filter,
  groupId,
  selectedUnit,
  onSelectUnit,
  availableUnits,
  unitCounts,
  onOpenImport,
  onNavigate,
  groups,
  counts,
  open,
  setOpen,
  tot,
  online,
  onLogout,
  toast,
  managing,
  onOpenLogin,
  onOpenDirectory,
}) {
  const sso = !!import.meta.env.VITE_SSO;
  const choose = (nextMode, value) => { onNavigate(nextMode, value); setOpen(false); };
  const pickUnit = (u) => { onSelectUnit(u); onNavigate('overview'); setOpen(false); };
  const pickFloor = (g) => {
    const { unit } = parseGroupMeta(g.name);
    if (selectedUnit !== 'all' && selectedUnit !== unit) {
      onSelectUnit(unit);
    }
    choose('group', g.id);
  };

  // State accordion
  const [unitOpen, setUnitOpen] = useState(false);
  const [floorOpen, setFloorOpen] = useState(false);
  const [openBuildings, setOpenBuildings] = useState({}); // bldKey → bool

  const toggleBuilding = (key) =>
    setOpenBuildings((prev) => ({ ...prev, [key]: !prev[key] }));

  const buildings = groupByBuilding(groups);

  return <>
    {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Đóng menu" />}
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <a href="#/" className="sidebar-brand" onClick={() => choose('overview')} aria-label="ĐẠI HỘI CHI ĐOÀN - ĐHBK HÀ NỘI">
          <img className="sidebar-logo-img" src="/logo.png" alt="Logo Ban Tổ chức - Kiểm tra Đoàn ĐHBK Hà Nội" />
          <span className="sidebar-brand-text">
            <strong className="sidebar-brand-title">ĐẠI HỘI CHI ĐOÀN</strong>
            <span className="sidebar-brand-subtitle">BAN TC-KT ĐOÀN ĐHBK HÀ NỘI</span>
          </span>
        </a>
        <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Đóng menu"><X size={20} /></button>
      </div>

      <nav className="sidebar-nav" aria-label="Điều hướng">
        {/* ── Điều hướng chính ── */}
        <button className={`nav-item ${!managing && mode === 'dashboard' ? 'active' : ''}`} onClick={() => choose('dashboard')}>
          <LayoutDashboard size={19} />Tổng quan
        </button>
        <button className={`nav-item ${!managing && (mode === 'overview' || mode === 'group' || mode === 'status') ? 'active' : ''}`} onClick={() => choose('overview')}>
          <ClipboardList size={19} />Bảng theo dõi<span className="nav-badge">{tot.rooms}</span>
        </button>
        {isUserAdmin(me) && (
          <button className="nav-item import-nav-btn" onClick={() => { setOpen(false); onOpenImport(); }}>
            <FileSpreadsheet size={19} />Nhập Excel / Thêm Lớp
          </button>
        )}
        {me && (
          <button className={`nav-item ${!managing && mode === 'mine' ? 'active' : ''}`} onClick={() => choose('mine')}>
            <Star size={19} />Lớp của tôi<span className="nav-badge">{me.ownedRoomIds?.length || 0}</span>
          </button>
        )}
        <button className={`nav-item ${!managing && mode === 'map' ? 'active' : ''}`} onClick={() => choose('map')}>
          <MapIcon size={19} />Sơ đồ khu vực
        </button>
        <button className="nav-item nav-item-directory" onClick={() => { setOpen(false); onOpenDirectory?.(); }} title="Danh bạ cán bộ Ban Tổ chức - Kiểm tra">
          <BookUser size={19} />
          <span>Danh bạ Ban TC-KT</span>
        </button>
        {isUserAdmin(me) && (
          <a className={`nav-item ${managing ? 'active' : ''}`} href="#/manage" onClick={() => setOpen(false)}>
            <Settings size={19} />Quản lý hệ thống
          </a>
        )}

        {/* ── ĐƠN VỊ TỔ CHỨC (accordion) ── */}
        <button
          className="sidebar-section-label sidebar-section-toggle"
          onClick={() => setUnitOpen((v) => !v)}
          aria-expanded={unitOpen}
        >
          <span>{(availableUnits || UNITS).length > 1 ? `${(availableUnits || UNITS).length} ĐƠN VỊ TỔ CHỨC` : 'ĐƠN VỊ TỔ CHỨC'}</span>
          {unitOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {unitOpen && (
          <div className="sidebar-accordion-body">
            <button
              className={`sidebar-shortcut unit-shortcut ${!managing && selectedUnit === 'all' ? 'selected' : ''}`}
              onClick={() => pickUnit('all')}
            >
              <Building2 size={14} />
              <span>{(availableUnits || UNITS).length > 1 ? `Tất cả ${(availableUnits || UNITS).length} đơn vị` : 'Tất cả'}</span>
              <b>{unitCounts?.all ?? 0}</b>
            </button>
            {(availableUnits || UNITS).map((u) => (
              <button
                key={u}
                className={`sidebar-shortcut unit-shortcut ${!managing && selectedUnit === u ? 'selected' : ''}`}
                onClick={() => pickUnit(u)}
                title={u}
              >
                <span>{u}</span>
                <b>{unitCounts?.[u] ?? 0}</b>
              </button>
            ))}
          </div>
        )}

        {/* ── CÁC TẦNG (2 cấp: tòa → tầng) ── */}
        {groups.length > 0 && (
          <>
            <button
              className="sidebar-section-label sidebar-section-toggle"
              onClick={() => setFloorOpen((v) => !v)}
              aria-expanded={floorOpen}
            >
              <span>CÁC TẦNG</span>
              {floorOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {floorOpen && (
              <div className="sidebar-accordion-body">
                {buildings.map((bld) => {
                  const bldKey = `${bld.unit}||${bld.bldCode}`;
                  const isOpen = !!openBuildings[bldKey];
                  return (
                    <div key={bldKey}>
                      {/* Cấp 1: Tòa */}
                      <button
                        className="sidebar-shortcut building-shortcut"
                        onClick={() => toggleBuilding(bldKey)}
                        title={bld.label}
                      >
                        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span className="building-label">{bld.label}</span>
                        <b>{bld.floors.reduce((s, f) => s + f.rooms.length, 0)}</b>
                      </button>
                      {/* Cấp 2: Từng tầng */}
                      {isOpen && bld.floors.map((g) => {
                        const { floorName } = parseGroupMeta(g.name);
                        return (
                          <button
                            key={g.id}
                            className={`sidebar-shortcut floor-shortcut ${!managing && mode === 'group' && groupId === g.id ? 'selected' : ''}`}
                            onClick={() => pickFloor(g)}
                            title={`Xem ${g.name}`}
                          >
                            <span>{floorName}</span>
                            <b>{g.rooms.length}</b>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </nav>

      <div className="sidebar-info-card"><strong>Tiến độ hồ sơ giấy tờ</strong><span>{tot.done}/{tot.total} mục đã đủ · {tot.pct}%</span><div className="info-progress-bar"><div className="info-progress-fill" style={{ width: `${tot.pct}%` }} /></div><small>{online ? 'Đang đồng bộ trực tiếp' : 'Đang kết nối lại'}</small></div>
      <div className="sidebar-profile">
        <span className={`user-avatar-circle role-avatar-${me?.role || (me?.isAdmin ? 'admin' : me ? 'room_lead' : 'guest')}`}>
          {me?.name?.charAt(0).toUpperCase() || 'K'}
        </span>
        <div className="profile-info">
          <strong>{me?.name || 'Khách (Chỉ xem)'}</strong>
          <small>
            {me
              ? (ROLES[me.role || (me.isAdmin ? 'admin' : 'room_lead')]?.label || 'Cán bộ kiểm tra')
              : 'Nhấn Đăng nhập để sửa'}
          </small>
        </div>
        {me ? (
          <button className="btn-logout" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất khỏi hệ thống">
            <LogOut size={19} />
          </button>
        ) : (
          <button
            className="btn-login-sidebar"
            onClick={() => {
              setOpen(false);
              onOpenLogin();
            }}
            aria-label="Đăng nhập cán bộ"
            title="Đăng nhập tài khoản cán bộ"
          >
            <LogIn size={19} />
          </button>
        )}
      </div>
    </aside>
  </>;
}
