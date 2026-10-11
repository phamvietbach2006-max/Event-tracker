import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { useLive } from './useLive.js';
import { allRooms, canEdit, statusCounts, totals } from './logic.js';
import Header from './Header.jsx';
import GroupCard from './Group.jsx';
import Manage from './Manage.jsx';

const SSO = !!import.meta.env.VITE_SSO;

function useHash() {
  const [h, setH] = useState(location.hash);
  useEffect(() => {
    const f = () => setH(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h;
}

const flip = (setter, id) => setter((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

export default function App() {
  const { state, setState, online, reload } = useLive();
  const [me, setMe] = useState(undefined); // undefined = đang tải, null = khách
  const [filter, setFilter] = useState('all');
  const [closedG, setClosedG] = useState(() => new Set()); // mặc định mở cả 3 khối
  const [openK, setOpenK] = useState(() => new Set());
  const [toast, setToast] = useState('');
  const hash = useHash();

  useEffect(() => { api.me().then(setMe).catch(() => setMe(null)); }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const act = useCallback(async (optimistic, call) => {
    setState((s) => (s ? optimistic(s) : s));
    try {
      await call();
    } catch (e) {
      if (e.status === 401) { setMe(null); setToast('Phiên đăng nhập đã hết. Hãy mở lại link đăng nhập của bạn.'); }
      else setToast(e.status === 403 ? 'Bạn không có quyền sửa khu này' : e.message);
      reload(); // hoàn lại bằng state thật của server
    }
  }, [setState, reload]);

  if (!state || me === undefined) return <div className="sk" role="status" aria-label="Đang tải"><i className="h" /><i className="c" /><i className="c" /><i className="c" /></div>;
  if (hash === '#/manage' && me?.isAdmin) return <Manage state={state} say={setToast} toast={toast} />;

  const rooms = allRooms(state);
  const pass = (r) => filter === 'all' || (filter === 'mine' ? canEdit(me, r) : r.status === filter);
  const logout = () => api.logout().finally(() => { setMe(null); setFilter('all'); });

  return (
    <>
      <a className="skip" href="#main">Bỏ qua, đến nội dung</a>
      {!online && <div className="offline">Đang kết nối lại…</div>}
      <Header me={me} online={online} counts={statusCounts(rooms)} tot={totals(rooms)} filter={filter} setFilter={setFilter} />
      <div className="chips">
        {!me && (SSO
          ? <a className="chip" href="/auth/sso/start">Đăng nhập</a>
          : <button className="chip" onClick={() => setToast('Dùng link đăng nhập được gửi riêng cho bạn')}>Đăng nhập</button>)}
        {me && <button className={`chip ${filter === 'mine' ? 'on' : ''}`} onClick={() => setFilter(filter === 'mine' ? 'all' : 'mine')}>Của tôi</button>}
        {me?.isAdmin && <a className="chip" href="#/manage">Quản lý</a>}
        {me && <button className="chip" onClick={logout}>Đăng xuất</button>}
      </div>
      <main id="main">
        {state.groups.map((g) => {
          const rs = g.rooms.filter(pass);
          if (!rs.length) return null;
          return (
            <GroupCard
              key={g.id} group={g} rooms={rs} me={me} act={act}
              open={!closedG.has(g.id)} onToggle={() => flip(setClosedG, g.id)}
              openK={openK} onToggleK={(id) => flip(setOpenK, id)}
            />
          );
        })}
        {!rooms.some(pass) && (
          <div className="empty-state">
            <b>Không có khu nào khớp bộ lọc</b>
            <span>Thử bỏ lọc để xem toàn bộ các khu.</span>
            <button onClick={() => setFilter('all')}>Xem tất cả</button>
          </div>
        )}
      </main>
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
