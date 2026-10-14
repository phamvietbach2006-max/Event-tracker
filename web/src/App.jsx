import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Home, Star, Settings, Map, FileSpreadsheet, PlusCircle, LayoutDashboard, ClipboardList, ChevronsDown, ChevronsUp, ArrowUp } from 'lucide-react';
import { api } from './api.js';
import { useLive } from './useLive.js';
import { allRooms, canEdit, statusCounts, totals, ST, UNITS, parseRoomMeta, parseGroupMeta } from './logic.js';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import GroupCard from './Group.jsx';
import Manage from './Manage.jsx';
import Footer from './Footer.jsx';
import UnitImportModal from './UnitImportModal.jsx';
import OverviewTable from './OverviewTable.jsx';
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
  const [selectedUnit, setSelectedUnit] = useState(UNITS[0]);
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [kipFilter, setKipFilter] = useState('all');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [mode, setMode] = useState('overview');
  const [groupId, setGroupId] = useState(null);
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [authError, setAuthError] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const hash = useHash();

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 280);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
        setToast(e.status === 403 ? 'Bạn không có quyền sửa lớp này.' : e.message);
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

  const unitCounts = useMemo(() => {
    const map = { all: 0 };
    for (const u of UNITS) map[u] = 0;
    for (const g of state?.groups ?? []) {
      const { unit } = parseGroupMeta(g.name);
      const count = g.rooms.length;
      map[unit] = (map[unit] ?? 0) + count;
      map.all += count;
    }
    return map;
  }, [state]);

  if (authError || (!state && stateError)) return (
    <div className="load-error" role="alert">
      <h1>Không tải được dữ liệu</h1>
      <p>Kiểm tra kết nối rồi thử lại.</p>
      <button onClick={() => { refreshMe(); reload(); }}>Thử lại</button>
    </div>
  );
  if (!state || me === undefined) return <div className="sk" role="status" aria-label="Đang tải"><i className="h" /><i className="c" /><i className="c" /></div>;

  const unitGroups = selectedUnit === 'all'
    ? state.groups
    : state.groups.filter((g) => parseGroupMeta(g.name).unit === selectedUnit);
  const rooms = unitGroups.flatMap((g) => g.rooms);
  const query = search.trim().toLocaleLowerCase('vi');
  const matches = (room, group) => {
    if (mode === 'group' && group.id !== groupId) return false;
    if (mode === 'mine' && !canEdit(me, room)) return false;
    if (mode === 'status' && room.status !== filter) return false;
    const meta = parseRoomMeta(room.name);
    if (kipFilter !== 'all' && meta.kip !== kipFilter) return false;
    if (cohortFilter !== 'all' && meta.cohort !== cohortFilter) return false;
    if (!query) return true;
    return [group.name, room.name, room.note, ...room.owners.map((owner) => owner.name), ...room.tasks.map((task) => task.text)]
      .some((value) => value?.toLocaleLowerCase('vi').includes(query));
  };
  const managing = hash === '#/manage';
  const visibleGroups = mode === 'group' ? unitGroups.filter((group) => group.id === groupId) : unitGroups;
  const shownGroups = mode === 'overview' ? visibleGroups : visibleGroups.filter((group) => group.rooms.some((room) => matches(room, group)));
  const shownRooms = shownGroups.flatMap((group) => group.rooms.filter((room) => matches(room, group)));
  const detailTitle = mode === 'group' ? parseGroupMeta(visibleGroups[0]?.name).floorName : mode === 'status' ? ST[filter] : mode === 'mine' ? 'Lớp của tôi phụ trách' : 'Các tầng tổ chức';

  return (
    <div className="app-shell">
      <a className="skip" href="#main">Bỏ qua, đến nội dung</a>
      <Sidebar me={me} mode={mode} filter={filter} groupId={groupId} selectedUnit={selectedUnit} onSelectUnit={setSelectedUnit} unitCounts={unitCounts} onOpenImport={() => setImportOpen(true)} onNavigate={navigate} groups={state.groups} counts={statusCounts(rooms)} open={sidebarOpen} setOpen={setSidebarOpen} tot={totals(rooms)} online={online} onLogout={logout} toast={setToast} managing={managing} />
      <div className="app-main">
        <Header me={me} online={online} stats={stats} counts={statusCounts(rooms)} tot={totals(rooms)} mode={mode} filter={filter} selectedUnit={selectedUnit} onSelectUnit={setSelectedUnit} unitCounts={unitCounts} onOpenImport={() => setImportOpen(true)} kipFilter={kipFilter} setKipFilter={setKipFilter} cohortFilter={cohortFilter} setCohortFilter={setCohortFilter} onNavigate={navigate} search={search} setSearch={setSearch} onOpenSidebar={() => setSidebarOpen(true)} managing={managing} />
        {!online && <div className="offline-banner" role="status">Đang kết nối lại để nhận cập nhật mới…</div>}
        {managing ? <main id="main"><Manage state={state} say={setToast} toast={toast} onOpenImport={() => setImportOpen(true)} /></main> : mode === 'map' ? <main id="main"><Suspense fallback={<div className="sk" role="status" aria-label="Đang tải bản đồ"><i className="h" /><i className="c" /></div>}><MapView groups={unitGroups} me={me} act={act} /></Suspense></main> : mode === 'dashboard' ? (
          <main id="main" className="overview-page">
            <OverviewTable
              state={state}
              me={me}
              act={act}
              onNavigate={navigate}
              onSelectUnit={setSelectedUnit}
            />
          </main>
        ) : <main id="main" className={`event-board ${mode === 'overview' ? '' : 'detail-board'}`}>
          {mode !== 'overview' && (
            <div className="detail-heading">
              <div>
                <span className="detail-kicker">{selectedUnit.toUpperCase()}</span>
                <h2>{detailTitle}</h2>
                <p>{shownRooms.length} lớp · {totals(shownRooms).done}/{totals(shownRooms).total} giấy tờ đã đủ</p>
              </div>
              <div className="detail-stats">
                <strong>{shownRooms.length}</strong><span>lớp</span>
                <strong>{totals(shownRooms).pct}%</strong><span>đủ giấy tờ</span>
              </div>
            </div>
          )}

          {unitGroups.length > 0 && (
            <>
              <div className="board-sub-toolbar">
                <div className="board-sub-summary">
                  <span className="summary-chip"><b>{shownGroups.length}</b> tầng</span>
                  <span className="summary-dot">·</span>
                  <span className="summary-chip"><b>{shownRooms.length}</b> lớp</span>
                  <span className="summary-dot">·</span>
                  <span className="summary-chip highlight"><b>{totals(shownRooms).done}/{totals(shownRooms).total}</b> giấy tờ ({totals(shownRooms).pct}%)</span>
                </div>
                <button
                  type="button"
                  className="toggle-all-floors-btn"
                  onClick={() => setExpandAll(!expandAll)}
                  title={expandAll ? 'Thu gọn tất cả các tầng' : 'Mở xem danh sách lớp của tất cả các tầng'}
                >
                  {expandAll ? <ChevronsUp size={15} /> : <ChevronsDown size={15} />}
                  <span>{expandAll ? 'Thu gọn tất cả tầng' : 'Mở tất cả tầng'}</span>
                </button>
              </div>

              <div className="event-columns">
                {shownGroups.map((group) => (
                  <GroupCard
                    key={`${group.id}-${mode}`}
                    group={group}
                    rooms={group.rooms.filter((room) => matches(room, group))}
                    me={me}
                    act={act}
                    detail={mode !== 'overview'}
                    showUnit={selectedUnit === 'all'}
                    forceOpen={query ? true : expandAll}
                  />
                ))}
              </div>
            </>
          )}

          {unitGroups.length === 0 ? (
            <div className="empty-state unit-empty-state">
              <b>{selectedUnit} chưa có danh sách phân kíp Đại hội</b>
              <span>Bạn có thể tải lên file Excel phân kíp (.xlsx) hoặc thêm nhanh từng Tầng &amp; Lớp cho đơn vị này (tự động gắn checklist giấy tờ K71 / K70).</span>
              <div className="empty-state-actions">
                <button className="btn-primary" onClick={() => setImportOpen(true)}>
                  <FileSpreadsheet size={16} /> Nhập từ file Excel / Thêm Lớp cho {selectedUnit}
                </button>
              </div>
            </div>
          ) : shownRooms.length === 0 && (
            <div className="empty-state">
              <b>Không có lớp phù hợp bộ lọc</b>
              <span>Thử đổi bộ lọc Kíp, Khóa hoặc từ khóa tìm kiếm.</span>
              <button onClick={() => { setKipFilter('all'); setCohortFilter('all'); navigate('overview'); }}>Xóa bộ lọc</button>
            </div>
          )}
        </main>}
        <Footer tot={totals(allRooms(state))} online={online} stats={stats} />
      </div>
      <button
        type="button"
        className={`scroll-to-top-btn ${showScrollTop ? 'visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Cuộn lên đầu trang"
        title="Lên đầu trang"
      >
        <ArrowUp size={19} />
      </button>
      <nav className="mobile-bottom-nav" aria-label="Điều hướng nhanh">
        <button className={!managing && mode === 'dashboard' ? 'active' : ''} onClick={() => navigate('dashboard')}><LayoutDashboard size={20} />Tổng quan</button>
        <button className={!managing && (mode === 'overview' || mode === 'group' || mode === 'status' || mode === 'mine') ? 'active' : ''} onClick={() => navigate('overview')}><ClipboardList size={20} />Bảng theo dõi</button>
        <button className={!managing && mode === 'map' ? 'active' : ''} onClick={() => navigate('map')}><Map size={20} />Sơ đồ</button>
        <a className={managing ? 'active' : ''} href="#/manage"><Settings size={20} />Quản lý</a>
      </nav>
      <UnitImportModal
        open={importOpen}
        onClose={(importedUnit) => {
          setImportOpen(false);
          if (importedUnit) {
            setSelectedUnit(importedUnit);
            setMode('overview');
            reload();
          }
        }}
        defaultUnit={selectedUnit}
        groups={state.groups}
        say={setToast}
        reload={reload}
      />
      <div className={`toast ${toast ? 'show' : ''}`} role="alert">{toast}</div>
    </div>
  );
}
