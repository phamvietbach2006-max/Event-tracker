import { Home, Star, Settings, LogOut, LogIn, X, Map } from 'lucide-react';
import { ST } from './logic.js';

export default function Sidebar({ me, mode, filter, groupId, onNavigate, groups, counts, open, setOpen, tot, online, onLogout, toast, managing }) {
  const sso = !!import.meta.env.VITE_SSO;
  const choose = (nextMode, value) => { onNavigate(nextMode, value); setOpen(false); };
  return <>
    {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Đóng menu" />}
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <a href="#/" className="sidebar-brand" onClick={() => choose('overview')} aria-label="Trang chủ Theo dõi sự kiện HUST">
          <img className="sidebar-logo-main" src="/logo-hust.svg" alt="Đại học Bách khoa Hà Nội" />
          <span className="sidebar-logo-divider" aria-hidden="true" />
          <img className="sidebar-logo-70" src="/logo-70-hust.svg" alt="Kỷ niệm 70 năm Đại học Bách khoa Hà Nội (1956–2026)" />
        </a>
        <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Đóng menu"><X size={20} /></button>
      </div>
      <nav className="sidebar-nav" aria-label="Điều hướng">
        <button className={`nav-item ${!managing && mode === 'overview' ? 'active' : ''}`} onClick={() => choose('overview')}><Home size={19} />Tổng quan<span className="nav-badge">{tot.rooms}</span></button>
        {me && <button className={`nav-item ${!managing && mode === 'mine' ? 'active' : ''}`} onClick={() => choose('mine')}><Star size={19} />Khu của tôi<span className="nav-badge">{me.ownedRoomIds?.length || 0}</span></button>}
        <button className={`nav-item ${!managing && mode === 'map' ? 'active' : ''}`} onClick={() => choose('map')}><Map size={19} />Sơ đồ khu vực</button>
        {me?.isAdmin && <a className={`nav-item ${managing ? 'active' : ''}`} href="#/manage" onClick={() => setOpen(false)}><Settings size={19} />Quản lý</a>}
        <div className="sidebar-section-label">LỌC NHANH</div>
        {['red', 'yellow', 'green'].map((status) => <button key={status} className={`sidebar-shortcut ${!managing && mode === 'status' && filter === status ? 'selected' : ''}`} onClick={() => choose('status', status)}><i className={`shortcut-dot ${status}`} /><span>{ST[status]}</span><b>{counts[status]}</b></button>)}
        <div className="sidebar-section-label">CÁC KHỐI</div>
        {groups.map((group) => <button key={group.id} className={`sidebar-shortcut group-shortcut ${!managing && mode === 'group' && groupId === group.id ? 'selected' : ''}`} onClick={() => choose('group', group.id)} title={`Xem chi tiết ${group.name}`}><span>{group.name}</span><b>{group.rooms.length}</b></button>)}
      </nav>
      <div className="sidebar-info-card"><strong>Tiến độ checklist</strong><span>{tot.done}/{tot.total} việc đã xong · {tot.pct}%</span><div className="info-progress-bar"><div className="info-progress-fill" style={{ width: `${tot.pct}%` }} /></div><small>{online ? 'Đang cập nhật trực tiếp' : 'Đang kết nối lại'}</small></div>
      <div className="sidebar-profile"><span className="user-avatar-circle">{me?.name?.charAt(0).toUpperCase() || 'K'}</span><span className="profile-info"><strong>{me?.name || 'Khách xem'}</strong><small>{me ? (me.isAdmin ? 'Quản trị viên' : `Phụ trách ${me.ownedRoomIds?.length || 0} khu`) : 'Chưa đăng nhập'}</small></span>
        {me ? <button className="btn-logout" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất"><LogOut size={19} /></button> : sso ? <a className="btn-logout" href="/auth/sso/start" aria-label="Đăng nhập" title="Đăng nhập"><LogIn size={19} /></a> : <button className="btn-logout" onClick={() => toast('Dùng link đăng nhập do quản trị viên gửi riêng cho bạn.')} aria-label="Hướng dẫn đăng nhập"><LogIn size={19} /></button>}
      </div>
    </aside>
  </>;
}
