import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

function AddRow({ placeholder, onAdd }) {
  const [v, setV] = useState('');
  const go = () => { const s = v.trim(); if (s) { onAdd(s); setV(''); } };
  return (
    <div className="addrow">
      <input value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
      <button onClick={go}>+ Thêm</button>
    </div>
  );
}

function AddUser({ onAdd }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const go = () => { if (email.trim() && name.trim()) { onAdd({ email, name, isAdmin }); setEmail(''); setName(''); setIsAdmin(false); } };
  return (
    <div className="mg">
      <div className="mlabel">Thêm người dùng</div>
      <div className="mrow"><input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="mrow"><input placeholder="Họ tên" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <label><input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Admin</label>
      <button onClick={go}>+ Thêm người dùng</button>
    </div>
  );
}

function RoomEditor({ room, users, run, reloadUsers }) {
  const owners = users.filter((u) => u.ownedRoomIds.includes(room.id)).map((u) => u.email);
  const toggleOwner = (e) => {
    const next = owners.includes(e) ? owners.filter((x) => x !== e) : [...owners, e];
    run(() => api.setOwners(room.id, next), reloadUsers);
  };
  const rename = (e) => {
    const v = e.target.value.trim();
    if (v && v !== room.name) run(() => api.patchRoom(room.id, { name: v }));
  };
  return (
    <details className="mroom">
      <summary>{room.name} <small>({room.owners.map((o) => o.name).join(', ') || 'chưa có người phụ trách'})</small></summary>
      <div className="mrow">
        <input key={room.name} defaultValue={room.name} maxLength={80} onBlur={rename} />
        <button onClick={() => confirm(`Xoá khu "${room.name}" và toàn bộ checklist?`) && run(() => api.delRoom(room.id), reloadUsers)}>Xoá khu</button>
      </div>
      <div className="mlabel">Người phụ trách</div>
      <div className="mchecks">
        {users.map((u) => (
          <label key={u.email}><input type="checkbox" checked={owners.includes(u.email)} onChange={() => toggleOwner(u.email)} /> {u.name}</label>
        ))}
      </div>
      <div className="mlabel">Checklist</div>
      {room.tasks.map((t) => (
        <div className="mrow" key={`${t.id}-${t.text}`}>
          <input
            defaultValue={t.text} maxLength={200}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.text) run(() => api.patchTaskText(t.id, v)); }}
          />
          <button onClick={() => run(() => api.delTask(t.id))}>✕</button>
        </div>
      ))}
      <AddRow placeholder="Việc mới" onAdd={(text) => run(() => api.addTask(room.id, text))} />
    </details>
  );
}

export default function Manage({ state, say, toast }) {
  const [users, setUsers] = useState([]);
  const [link, setLink] = useState(null);

  const loadUsers = useCallback(() => api.users().then(setUsers).catch((e) => say(e.message)), [say]);
  useEffect(() => { loadUsers(); }, [loadUsers]);
  // danh sách khu phụ trách thay đổi theo state realtime (xoá khu...) nên nạp lại người dùng khi state đổi
  useEffect(() => { loadUsers(); }, [state, loadUsers]);

  const run = async (fn, after) => {
    try { await fn(); if (after) await after(); } catch (e) { say(e.message); }
  };

  const makeLink = async (u) => {
    if (u.hasToken && !confirm('Tạo link mới sẽ vô hiệu link cũ của người này. Tiếp tục?')) return;
    await run(async () => { const r = await api.userLink(u.email); setLink({ name: u.name, url: r.url }); }, loadUsers);
  };

  return (
    <div className="mpage">
      <a className="back" href="#/">← Về dashboard</a>
      <h2>Khu vực</h2>
      {state.groups.map((g) => (
        <section className="mg" key={`${g.id}-${g.name}`}>
          <div className="mrow">
            <input
              defaultValue={g.name} maxLength={80}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== g.name) run(() => api.patchGroup(g.id, { name: v })); }}
            />
            <button disabled={g.rooms.length > 0} onClick={() => confirm(`Xoá khối "${g.name}"?`) && run(() => api.delGroup(g.id))}>Xoá khối</button>
          </div>
          {g.rooms.map((r) => <RoomEditor key={r.id} room={r} users={users} run={run} reloadUsers={loadUsers} />)}
          <AddRow placeholder="Tên khu mới" onAdd={(name) => run(() => api.addRoom(g.id, name))} />
        </section>
      ))}
      <div className="mg"><AddRow placeholder="Tên khối mới" onAdd={(name) => run(() => api.addGroup(name))} /></div>

      <h2>Người dùng</h2>
      <div className="mg">
        {users.map((u) => (
          <div className="muser" key={u.email}>
            <div><b>{u.name}</b><br /><small>{u.email}</small></div>
            <label>
              <input type="checkbox" checked={u.isAdmin} onChange={(e) => run(() => api.patchUser(u.email, { isAdmin: e.target.checked }), loadUsers)} /> Admin
            </label>
            <button onClick={() => makeLink(u)}>{u.hasToken ? 'Link mới' : 'Tạo link'}</button>
            <button onClick={() => confirm(`Xoá ${u.name}?`) && run(() => api.delUser(u.email), loadUsers)}>Xoá</button>
          </div>
        ))}
        {link && (
          <div className="mlink">
            <small>Link đăng nhập của {link.name} (link cũ đã vô hiệu):</small>
            <div className="mrow">
              <input readOnly value={link.url} onFocus={(e) => e.target.select()} />
              <button onClick={() => navigator.clipboard?.writeText(link.url).then(() => say('Đã copy link'))}>Copy</button>
            </div>
          </div>
        )}
      </div>
      <AddUser onAdd={(u) => run(() => api.addUser(u), loadUsers)} />
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}
