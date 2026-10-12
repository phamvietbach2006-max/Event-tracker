import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock3, Plus, Trash2, UserRound } from 'lucide-react';
import { api } from './api.js';
import { ORDER, ST, TS, NEXT, NOTE_MAX, canEdit, doneCount, percent, statusCounts, patchRoom, patchTask, removeTask, timeLabel } from './logic.js';

function NoteBox({ room, onSave }) {
  const [value, setValue] = useState(room.note);
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setValue(room.note); }, [room.note]);
  const save = () => {
    typing.current = false;
    const next = value.trim();
    if (next !== room.note) onSave(next);
  };
  return <label className="note-input-wrap"><span>Ghi chú tình trạng</span><input className="note-input" value={value} maxLength={NOTE_MAX} placeholder="Nhập ghi chú ngắn…" onFocus={() => { typing.current = true; }} onChange={(e) => setValue(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} /><small>{value.length}/{NOTE_MAX}</small></label>;
}

function AddTask({ onAdd }) {
  const [value, setValue] = useState('');
  const submit = () => {
    const next = value.trim();
    if (!next) return;
    onAdd(next);
    setValue('');
  };
  return <div className="quick-add-task"><input className="quick-add-input" value={value} maxLength={200} placeholder="Thêm việc mới…" aria-label="Nội dung việc mới" onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} /><button className="quick-add-btn" onClick={submit}><Plus size={17} /> Thêm</button></div>;
}

export function RoomCard({ room, me, act, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
  const editor = canEdit(me, room);
  const done = doneCount(room);
  const progress = percent(room);
  const changeStatus = (status) => act((state) => patchRoom(state, room.id, { status }), () => api.setStatus(room.id, status));
  const changeTask = (task) => {
    const state = NEXT[task.state];
    act((current) => patchTask(current, task.id, { state }), () => api.setTask(task.id, state));
  };
  const editTask = (task, text) => act((state) => patchTask(state, task.id, { text }), () => api.patchTaskText(task.id, text));
  const deleteTask = (task) => {
    if (confirm(`Xóa việc "${task.text}"?`)) act((state) => removeTask(state, task.id), () => api.delTask(task.id));
  };
  const saveNote = (note) => act((state) => patchRoom(state, room.id, { note }), () => api.setNote(room.id, note));
  const ownerNames = room.owners.map((owner) => owner.name).join(', ') || 'Chưa có người phụ trách';

  return <article className={`task-card room-card status-${room.status} ${open ? 'expanded' : ''}`}>
    <button className="room-card-head" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${open ? 'Thu gọn' : 'Mở'} khu ${room.name}`}>
      <span className={`room-status-pill ${room.status}`}><i />{ST[room.status]}</span>
      <ChevronDown size={18} className="room-chevron" />
      <strong className="card-title">{room.name}</strong>
      <span className="room-owner"><UserRound size={15} />{ownerNames}</span>
      <span className={`card-desc ${room.note ? '' : 'empty'}`}>{room.note || 'Chưa có cập nhật'}</span>
      <span className="card-progress-meta"><span>{done}/{room.tasks.length} việc xong</span><span>{progress}%</span></span>
      <span className="card-progress-track"><span className={`card-progress-bar ${room.status}`} style={{ width: `${progress}%` }} /></span>
    </button>
    <div className="room-details-shell" inert={!open ? '' : undefined} aria-hidden={!open}>
    <div className="room-details">
      <div className="room-detail-title">Checklist <span>{room.tasks.length} việc</span></div>
      {room.tasks.length === 0 && <p className="room-empty">Khu này chưa có việc nào.</p>}
      <div className="card-checklist">{room.tasks.map((task) => <div className={`checklist-item ${task.state}`} key={task.id}>
        {editor ? <input className="task-edit-input" key={task.text} defaultValue={task.text} maxLength={200} aria-label={`Sửa việc ${task.text}`} onBlur={(e) => { const text = e.target.value.trim(); if (text && text !== task.text) editTask(task, text); else e.target.value = task.text; }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = task.text; e.currentTarget.blur(); } }} /> : <span className="task-label">{task.text}</span>}
        <button className={`task-state-btn ${task.state}`} disabled={!editor} onClick={() => changeTask(task)} aria-label={`${task.text}: ${TS[task.state]}. ${editor ? 'Nhấn để chuyển trạng thái' : 'Chỉ xem'}`}>{TS[task.state]}</button>
        {editor && <button className="task-del-btn" onClick={() => deleteTask(task)} aria-label={`Xóa việc ${task.text}`}><Trash2 size={16} /></button>}
      </div>)}</div>
      {editor && <><AddTask onAdd={(text) => act((state) => state, () => api.addTask(room.id, text))} /><div className="room-detail-title">Tình trạng khu</div><div className="room-status-bar">{ORDER.map((status) => <button key={status} className={`status-choice-btn ${status} ${room.status === status ? 'on' : ''}`} onClick={() => changeStatus(status)} aria-pressed={room.status === status}>{ST[status]}</button>)}</div><NoteBox room={room} onSave={saveNote} /></>}
      {!editor && <p className="room-readonly">{me ? 'Chỉ người phụ trách khu này mới được cập nhật.' : 'Đăng nhập để cập nhật khu vực.'}</p>}
      <div className="card-bottom-row"><Clock3 size={14} /><span>Cập nhật {timeLabel(room.updatedAt)}{room.updatedBy ? ` · ${room.updatedBy}` : ''}</span></div>
    </div></div>
  </article>;
}

export default function GroupCard({ group, rooms, me, act, detail = false }) {
  const counts = statusCounts(rooms);
  return <section id={`group-${group.id}`} className="event-column" aria-label={group.name}>
    <div className="event-column-head"><h3>{group.name}</h3><span>{rooms.length} khu</span></div>
    <div className="group-status-counts"><span className="red">{counts.red} đỏ</span><span className="yellow">{counts.yellow} vàng</span><span className="green">{counts.green} xanh</span></div>
    <div className="event-column-cards">{rooms.map((room) => <RoomCard key={room.id} room={room} me={me} act={act} />)}{rooms.length === 0 && <p className="column-empty">Không có khu phù hợp bộ lọc.</p>}</div>
  </section>;
}
