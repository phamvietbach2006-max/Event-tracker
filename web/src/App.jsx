import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Home, Star, Settings, Map } from 'lucide-react';
import { api } from './api.js';
import { useLive } from './useLive.js';
import { allRooms, canEdit, statusCounts, totals, ST } from './logic.js';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import GroupCard from './Group.jsx';
import Manage from './Manage.jsx';
import Footer from './Footer.jsx';
const MapView = lazy(() => import('./MapView.jsx')); // maplibre-gl nặng, chỉ tải khi mở Sơ đồ

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const update = () => setHash(location.hash);
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  return hash;
}

export default function App() {
  const { state, setState, online, reload, error: stateError, stats } = useLive();
  const [me, setMe] = useState(undefined);
  const [filter, setFilter] = useState('all');
  const [mode, setMode] = useState('overview');
  const [groupId, setGroupId] = useState(null);
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [authError, setAuthError] = useState(false);
  const hash = useHash();

  const refreshMe = useCallback(() => {
    setAuthError(false);
    api.me().then(setMe).catch(() => setAuthError(true));
  }, []);
  useEffect(refreshMe, [refreshMe]);
  useEffect(() => {
    const result = new URLSearchParams(location.search).get('login');
    if (!result) return;
    setToast(result === 'denied' ? 'Tài khoản chưa được cấp quyền. Hãy liên hệ quản trị viên.' : 'Đăng nhập không thành công. Vui lòng thử lại.');
    history.replaceState(null, '', location.pathname + location.hash);
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const act = useCallback(async (optimistic, call) => {
    let previous = null;
    setState((current) => {
      previous = current;
      return current ? optimistic(current) : current;
    });
    try {
      const res = await call();
      if (!online) reload();
      return res;
    } catch (e) {
      if (previous) setState(previous);
      if (e.status === 401) {
        setMe(null);
        setToast('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
      } else {
        setToast(e.status === 403 ? 'Bạn không có quyền sửa khu này.' : e.message);
      }
      reload();
      return undefined;
    }
  }, [online, reload, setState]);

  const navigate = (nextMode, value) => {
    location.hash = '#/';
    setMode(nextMode);
    setFilter(nextMode === 'status' ? value : nextMode === 'mine' ? 'mine' : 'all');
    setGroupId(nextMode === 'group' ? value : null);
    setSearch('');
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const logout = async () => {
    try {
      await api.logout();
      setMe(null);
      setFilter('all');
      setMode('overview');
      setToast('Đã đăng xuất.');
      location.hash = '#/';
    } catch (e) {
      setToast(`Đăng xuất chưa thành công: ${e.message}`);
    }
  };

  if (authError || (!state && stateError)) return (
    <div className="load-error" role="alert">
      <h1>Không tải được dữ liệu</h1>
      <p>Kiểm tra kết nối rồi thử lại.</p>
      <button onClick={() => { refreshMe(); reload(); }}>Thử lại</button>
    </div>
  );
  if (!state || me === undefined) return <div className="sk" role="status" aria-label="Đang tải"><i className="h" /><i className="c" /><i className="c" /></div>;

  const rooms = allRooms(state);
  const query = search.trim().toLocaleLowerCase('vi');
  const matches = (room, group) => {
    if (mode === 'group' && group.id !== groupId) return false;
    if (mode === 'mine' && !canEdit(me, room)) return false;
    if (mode === 'status' && room.status !== filter) return false;
    if (!query) return true;
    return [group.name, room.name, room.note, ...room.owners.map((owner) => owner.name), ...room.tasks.map((task) => task.text)]
      .some((value) => value?.toLocaleLowerCase('vi').includes(query));
  };
  const managing = hash === '#/manage' && me?.isAdmin;
  const visibleGroups = mode === 'group' ? state.groups.filter((group) => group.id === groupId) : state.groups;
  const shownGroups = mode === 'overview' ? visibleGroups : visibleGroups.filter((group) => group.rooms.some((room) => matches(room, group)));
  const shownRooms = shownGroups.flatMap((group) => group.rooms.filter((room) => matches(room, group)));
  const detailTitle = mode === 'group' ? visibleGroups[0]?.name : mode === 'status' ? ST[filter] : mode === 'mine' ? 'Khu của tôi' : 'Các khối sự kiện';

  return (
    <div className="app-shell">
      <a className="skip" href="#main">Bỏ qua, đến nội dung</a>
      <Sidebar me={me} mode={mode} filter={filter} groupId={groupId} onNavigate={navigate} groups={state.groups} counts={statusCounts(rooms)} open={sidebarOpen} setOpen={setSidebarOpen} tot={totals(rooms)} online={online} onLogout={logout} toast={setToast} managing={managing} />
      <div className="app-main">
        <Header me={me} online={online} counts={statusCounts(rooms)} tot={totals(rooms)} mode={mode} filter={filter} onNavigate={navigate} search={search} setSearch={setSearch} onOpenSidebar={() => setSidebarOpen(true)} onGuestLogin={() => setToast('Dùng link đăng nhập do quản trị viên gửi riêng cho bạn.')} managing={managing} />
        {!online && <div className="offline-banner" role="status">Đang kết nối lại để nhận cập nhật mới…</div>}
        {managing ? <main id="main"><Manage state={state} say={setToast} toast={toast} /></main> : mode === 'map' ? <main id="main"><Suspense fallback={<div className="sk" role="status" aria-label="Đang tải bản đồ"><i className="h" /><i className="c" /></div>}><MapView groups={state.groups} me={me} act={act} /></Suspense></main> : <main id="main" className={`event-board ${mode === 'overview' ? '' : 'detail-board'}`}>
          {mode === 'overview' ? <div className="board-heading"><div><h2>Các khối sự kiện</h2><p>Toàn cảnh tình trạng các khu. Chọn một mục ở sidebar để xem chi tiết.</p></div><span>{state.groups.length} khối · {rooms.length} khu</span></div> : <div className="detail-heading"><div><button className="detail-back" onClick={() => navigate('overview')}>← Tổng quan</button><span className="detail-kicker">CHI TIẾT KHU VỰC</span><h2>{detailTitle}</h2><p>{shownRooms.length} khu vực · {totals(shownRooms).done}/{totals(shownRooms).total} việc đã xong</p></div><div className="detail-stats"><strong>{shownRooms.length}</strong><span>khu vực</span><strong>{totals(shownRooms).pct}%</strong><span>hoàn thành checklist</span></div></div>}
          <div className="event-columns">{shownGroups.map((group) => <GroupCard key={`${group.id}-${mode}`} group={group} rooms={group.rooms.filter((room) => matches(room, group))} me={me} act={act} detail={mode !== 'overview'} />)}</div>
          {shownRooms.length === 0 && <div className="empty-state"><b>Không có khu phù hợp</b><span>Thử đổi mục hoặc từ khóa tìm kiếm.</span><button onClick={() => navigate('overview')}>Về tổng quan</button></div>}
        </main>}
        <Footer tot={totals(rooms)} online={online} stats={stats} onNavigate={navigate} />
      </div>
      <nav className="mobile-bottom-nav" aria-label="Điều hướng nhanh">
        <button className={!managing && mode === 'overview' ? 'active' : ''} onClick={() => navigate('overview')}><Home size={20} />Tổng quan</button>
        {me && <button className={!managing && mode === 'mine' ? 'active' : ''} onClick={() => navigate('mine')}><Star size={20} />Của tôi</button>}
        <button className={!managing && mode === 'map' ? 'active' : ''} onClick={() => navigate('map')}><Map size={20} />Sơ đồ</button>
        {me?.isAdmin && <a className={managing ? 'active' : ''} href="#/manage"><Settings size={20} />Quản lý</a>}
      </nav>
      <div className={`toast ${toast ? 'show' : ''}`} role="alert">{toast}</div>
    </div>
  );
}
