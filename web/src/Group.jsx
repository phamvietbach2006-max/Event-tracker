import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { ORDER, ST, TS, NEXT, NOTE_MAX, canEdit, doneCount, percent, statusCounts, patchRoom, patchTask, removeTask, timeLabel } from './logic.js';

function NoteBox({ room, onSave }) {
  const [v, setV] = useState(room.note);
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setV(room.note); }, [room.note]); // không ghi đè khi đang gõ
  const save = () => {
    typing.current = false;
    const s = v.trim();
    if (s !== room.note) onSave(s);
  };
  return (
    <>
      <div className="ctl">
        <input
          maxLength={NOTE_MAX}
          value={v}
          placeholder={`Dòng status ngắn (tối đa ${NOTE_MAX} ký tự)`}
          onFocus={() => { typing.current = true; }}
          onChange={(e) => setV(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
      </div>
      <div className="cnt">{v.length}/{NOTE_MAX}</div>
    </>
  );
}

function AddTask({ onAdd }) {
  const [v, setV] = useState('');
  const go = () => { const s = v.trim(); if (s) { onAdd(s); setV(''); } };
  return (
    <div className="ctl">
      <input
        maxLength={200} value={v} placeholder="Thêm việc mới…"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
      />
      <button onClick={go}>+ Thêm</button>
    </div>
  );
}

function RoomCard({ room, me, open, onToggle, act }) {
  const ed = canEdit(me, room);
  const dn = doneCount(room);
  const pc = percent(room);
  const setStatus = (k) => act((s) => patchRoom(s, room.id, { status: k }), () => api.setStatus(room.id, k));
  const cycle = (t) => {
    const n = NEXT[t.state];
    act((s) => patchTask(s, t.id, { state: n }), () => api.setTask(t.id, n));
  };
  const delTask = (t) => {
    if (!confirm(`Xoá việc "${t.text}"?`)) return;
    act((s) => removeTask(s, t.id), () => api.delTask(t.id));
  };
  const addTask = (text) => act((s) => s, () => api.addTask(room.id, text)); // danh sách mới về qua realtime
  const saveNote = (note) => act((s) => patchRoom(s, room.id, { note }), () => api.setNote(room.id, note));
  return (
    <section className={`kid ${room.status} ${open ? 'open' : ''}`}>
      <button className="head" onClick={onToggle}>
        <div className="t1"><span className="name">{room.name}</span><span className="pill">{ST[room.status]}</span></div>
        <div className={`line ${room.note ? '' : 'empty'}`}>{room.note || 'Chưa có cập nhật'}</div>
        <div className="meta">
          <span>{room.owners.map((o) => o.name).join(', ') || 'Chưa có người phụ trách'} · {dn}/{room.tasks.length} việc · {pc}%</span>
          <span className="chev">▾</span>
        </div>
      </button>
      <div className="body">
        <div className="bar" style={{ margin: '0 0 10px' }}><b style={{ width: `${pc}%`, background: 'var(--c)' }} /></div>
        {ed && (
          <div className="seg">
            {ORDER.map((k) => (
              <button key={k} className={`${k} ${room.status === k ? 'on' : ''}`} onClick={() => setStatus(k)}>{ST[k]}</button>
            ))}
          </div>
        )}
        {room.tasks.map((t) => (
          <div key={t.id} className={`task ${t.state}`}>
            <span className="tx">{t.text}</span>
            <button className={`ts ${t.state}`} disabled={!ed} onClick={() => cycle(t)}>{TS[t.state]}</button>
            {ed && <button className="tdel" aria-label={`Xoá việc ${t.text}`} onClick={() => delTask(t)}>✕</button>}
          </div>
        ))}
        {ed && <AddTask onAdd={addTask} />}
        {ed ? <NoteBox room={room} onSave={saveNote} /> : (
          <div className="lock">🔒 {me ? 'Chỉ người phụ trách mới sửa được' : 'Đăng nhập để cập nhật'}</div>
        )}
        <div className="lock">Cập nhật lúc {timeLabel(room.updatedAt)}{room.updatedBy ? ` · ${room.updatedBy}` : ''}</div>
      </div>
    </section>
  );
}

export default function GroupCard({ group, rooms, me, open, onToggle, openK, onToggleK, act }) {
  const c = statusCounts(group.rooms);
  const sum = [['red', 'đỏ'], ['yellow', 'vàng'], ['green', 'xanh']]
    .filter(([k]) => c[k])
    .map(([k, l]) => <b key={k} style={{ color: `var(--${k})` }}>{c[k]} {l}</b>);
  return (
    <section className={`grp ${open ? 'open' : ''}`}>
      <button className="gh" onClick={onToggle}>
        <div className="gt"><span className="gname">{group.name}</span><span className="gchev">▾</span></div>
        <div className="gsum">{group.rooms.length} khu · {sum.flatMap((x, i) => (i ? [' · ', x] : [x]))}</div>
        <div className="tags">
          {rooms.map((r) => <span key={r.id} className={`tag ${r.status}`}><i />{r.name}</span>)}
        </div>
      </button>
      <div className="kids">
        {rooms.map((r) => (
          <RoomCard key={r.id} room={r} me={me} open={openK.has(r.id)} onToggle={() => onToggleK(r.id)} act={act} />
        ))}
      </div>
    </section>
  );
}
