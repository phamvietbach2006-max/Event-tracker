import { Menu, Search, Wifi, WifiOff, X, LogIn } from 'lucide-react';
import { ORDER, ST } from './logic.js';

export default function Header({ me, online, counts, tot, mode, filter, onNavigate, search, setSearch, onOpenSidebar, onGuestLogin, managing }) {
  const sso = !!import.meta.env.VITE_SSO;
  return <header className="topbar">
    <div className="topbar-row-1">
      <div className="space-brand">
        <button className="mobile-menu-btn" onClick={onOpenSidebar} aria-label="Mở menu"><Menu size={22} /></button>
        <div className="space-title-box">
          <h1 className="space-title">Tình trạng khu vực</h1>
          <p className="space-subtitle">{tot.rooms} khu vực · {tot.done}/{tot.total} việc đã xong</p>
        </div>
      </div>
      <div className="topbar-actions">
        {!managing && mode !== 'map' && <label className="search-box">
          <Search size={18} className="search-icon" />
          <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm khu, người phụ trách, công việc…" aria-label="Tìm kiếm khu vực" />
          {search && <button className="search-clear" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm"><X size={16} /></button>}
        </label>}
        <span className={`live-pill ${online ? '' : 'offline'}`}>{online ? <Wifi size={15} /> : <WifiOff size={15} />}{online ? 'Trực tiếp' : 'Đang kết nối'}</span>
        {!me && (sso ? <a className="login-link" href="/auth/sso/start"><LogIn size={16} />Đăng nhập</a> : <button className="login-link" onClick={onGuestLogin}><LogIn size={16} />Đăng nhập</button>)}
      </div>
    </div>
    {!managing && mode !== 'map' && mode !== 'group' && <div className="filter-row" role="group" aria-label="Lọc tình trạng khu vực">
      <button className={`filter-chip ${mode === 'overview' ? 'active' : ''}`} onClick={() => onNavigate('overview')}>Tất cả <span className="chip-count">{tot.rooms}</span></button>
      {ORDER.map((status) => <button key={status} className={`filter-chip ${status} ${mode === 'status' && filter === status ? 'active' : ''}`} onClick={() => onNavigate(mode === 'status' && filter === status ? 'overview' : 'status', status)}>{ST[status]} <span className="chip-count">{counts[status]}</span></button>)}
      {me && <button className={`filter-chip ${mode === 'mine' ? 'active' : ''}`} onClick={() => onNavigate(mode === 'mine' ? 'overview' : 'mine')}>Của tôi <span className="chip-count">{me.ownedRoomIds?.length || 0}</span></button>}
    </div>}
  </header>;
}
