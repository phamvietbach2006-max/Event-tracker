import { ORDER, ST } from './logic.js';

export default function Header({ me, online, counts, tot, filter, setFilter }) {
  const who = !me
    ? 'Bạn đang xem công khai · Chưa đăng nhập'
    : me.isAdmin
      ? `Quản trị viên ${me.name} · Sửa được tất cả`
      : `Xin chào ${me.name} · Phụ trách ${me.ownedRoomIds.length} khu vực`;
  return (
    <header>
      <div className="row">
        <h1>Sự kiện – tình trạng các khu vực</h1>
        <div className={`live ${online ? '' : 'off'}`}><i />{online ? 'Realtime' : 'Mất kết nối'}</div>
      </div>
      <div className="who">{who}</div>
      <div className="tiles">
        {ORDER.map((k) => (
          <button key={k} className={`tile ${k} ${filter === k ? 'on' : ''}`} onClick={() => setFilter(filter === k ? 'all' : k)}>
            <b>{counts[k]}</b><span>{ST[k]}</span>
          </button>
        ))}
      </div>
      <div className="total"><span>{tot.rooms} khu · {tot.done}/{tot.total} việc xong</span><span>{tot.pct}%</span></div>
      <div className="bar"><b style={{ width: `${tot.pct}%` }} /></div>
    </header>
  );
}
