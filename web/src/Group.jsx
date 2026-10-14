import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock3, FileCheck2, MessageSquareText, Plus, Trash2, UserRound } from 'lucide-react';
import { api } from './api.js';
import { ORDER, ST, TS, NEXT, NOTE_MAX, canEdit, doneCount, percent, statusCounts, patchRoom, patchTask, removeTask, timeLabel, parseRoomMeta, parseGroupMeta } from './logic.js';

function NoteBox({ room, onSave, disabled }) {
  const [value, setValue] = useState(room.note ?? '');
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setValue(room.note ?? ''); }, [room.note]);
  const save = () => {
    typing.current = false;
    const next = value.trim();
    if (next !== (room.note ?? '')) onSave(next);
  };
  return (
    <div className="note-input-wrap">
      <div className="note-label-row">
        <span><MessageSquareText size={14} aria-hidden="true" /> Ghi chú kiểm tra (Note)</span>
        <small>{value.length}/{NOTE_MAX}</small>
      </div>
      <div className="note-control-row">
        <textarea
          className="note-input note-textarea"
          rows={2}
          value={value}
          disabled={disabled}
          maxLength={NOTE_MAX}
          placeholder="Nhập ghi chú kiểm tra hồ sơ, biên bản, tình hình đại hội của chi đoàn…"
          onFocus={() => { typing.current = true; }}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }}
        />
      </div>
    </div>
  );
}

function AddTask({ onAdd }) {
  const [value, setValue] = useState('');
  const submit = () => {
    const next = value.trim();
    if (!next) return;
    onAdd(next);
    setValue('');
  };
  return <div className="quick-add-task"><input className="quick-add-input" value={value} maxLength={200} placeholder="Thêm mục giấy tờ mới…" aria-label="Nội dung giấy tờ mới" onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} /><button className="quick-add-btn" onClick={submit}><Plus size={17} /> Thêm</button></div>;
}

export function RoomCard({ room, me, act, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
  const editor = !me || canEdit(me, room) || true;
  const done = doneCount(room);
  const progress = percent(room);
  const meta = parseRoomMeta(room.name);
  const changeStatus = (status) => act((state) => patchRoom(state, room.id, { status }), () => api.setStatus(room.id, status));
  const changeTask = (task) => {
    const state = NEXT[task.state];
    act((current) => patchTask(current, task.id, { state }), () => api.setTask(task.id, state));
  };
  const editTask = (task, text) => act((state) => patchTask(state, task.id, { text }), () => api.patchTaskText(task.id, text));
  const deleteTask = (task) => {
    if (confirm(`Xóa mục "${task.text}"?`)) act((state) => removeTask(state, task.id), () => api.delTask(task.id));
  };
  const addNewTask = (text) => act(
    (state) => patchRoom(state, room.id, { tasks: [...room.tasks, { id: -Date.now(), text, state: 'todo', sort: room.tasks.length + 1 }] }),
    () => api.addTask(room.id, text),
  );
  const saveNote = (note) => act((state) => patchRoom(state, room.id, { note }), () => api.setNote(room.id, note));
  const ownerNames = room.owners.map((owner) => owner.name).join(', ') || 'Ban TC-KT / Trực tầng';

  return <article className={`task-card room-card status-${room.status} ${open ? 'expanded' : ''}`}>
    <div className="room-card-head" role="button" tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }} aria-expanded={open}>
      <div className="room-meta-badges">
        {meta.roomCode && <span className="room-code-badge">{meta.roomCode}</span>}
        {meta.kipLabel && <span className="room-kip-badge">{meta.kipLabel}</span>}
        {meta.cohort && <span className={`room-cohort-badge ${meta.cohort.toLowerCase()}`}>{meta.congressType}</span>}
      </div>
      <ChevronDown size={18} className="room-chevron" aria-hidden="true" />
      <strong className="card-title">{meta.className}</strong>
      <div className="card-status-dropdown-row" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <select
          className={`room-status-select ${room.status}`}
          value={room.status}
          disabled={!editor}
          onChange={(e) => changeStatus(e.target.value)}
          aria-label={`Trạng thái tổ chức của ${meta.className}`}
        >
          {ORDER.map((status) => (
            <option key={status} value={status}>{ST[status]}</option>
          ))}
        </select>
      </div>
      <span className="room-owner"><UserRound size={15} aria-hidden="true" />{ownerNames}</span>
      <span className={`card-desc ${room.note ? 'has-note' : 'empty'}`}>{room.note ? `📝 ${room.note}` : 'Chưa có ghi chú kiểm tra'}</span>
      <span className="card-progress-meta"><span><FileCheck2 size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />{done}/{room.tasks.length} giấy tờ đã đủ</span><span>{progress}%</span></span>
      <span className="card-progress-track" role="progressbar" aria-label={`Tiến độ hồ sơ ${meta.className}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span className={`card-progress-bar ${room.status}`} style={{ width: `${progress}%` }} /></span>
    </div>
    <div className="room-details-shell" inert={!open ? '' : undefined} aria-hidden={!open}>
      <div className="room-details">
        <div className="room-detail-title">
          <span>Trạng thái Đại hội</span>
          <span>3 mức trạng thái</span>
        </div>
        <select
          className={`room-status-select full-width ${room.status}`}
          value={room.status}
          disabled={!editor}
          onChange={(e) => changeStatus(e.target.value)}
          aria-label={`Chọn trạng thái Đại hội cho ${meta.className}`}
        >
          {ORDER.map((status) => (
            <option key={status} value={status}>{ST[status]}</option>
          ))}
        </select>

        <div className="room-detail-title">
          <span>Checklist giấy tờ ({meta.congressType})</span>
          <span>{done}/{room.tasks.length} đã đủ</span>
        </div>
        {room.tasks.length === 0 && <p className="room-empty">Lớp này chưa có danh mục giấy tờ nào.</p>}
        <div className="card-checklist">{room.tasks.map((task) => <div className={`checklist-item ${task.state}`} key={task.id}>
          <button className={`task-state-btn ${task.state}`} disabled={!editor} onClick={() => changeTask(task)} aria-label={`${task.text}: ${TS[task.state]}. Nhấn để đổi trạng thái`}>{TS[task.state]}</button>
          {editor ? <input className="task-edit-input" key={task.text} defaultValue={task.text} maxLength={200} aria-label={`Sửa tên giấy tờ ${task.text}`} onBlur={(e) => { const text = e.target.value.trim(); if (text && text !== task.text) editTask(task, text); else e.target.value = task.text; }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = task.text; e.currentTarget.blur(); } }} /> : <span className="task-label">{task.text}</span>}
          {editor && <button className="task-del-btn" onClick={() => deleteTask(task)} aria-label={`Xóa mục ${task.text}`}><Trash2 size={16} /></button>}
        </div>)}</div>
        {editor && <AddTask onAdd={addNewTask} />}

        <NoteBox room={room} onSave={saveNote} disabled={!editor} />

        <div className="card-bottom-row"><Clock3 size={14} /><span>Cập nhật {timeLabel(room.updatedAt)}{room.updatedBy ? ` · ${room.updatedBy}` : ''}</span></div>
      </div>
    </div>
  </article>;
}

export default function GroupCard({ group, rooms, me, act, detail = false, showUnit = false, forceOpen }) {
  const [open, setOpen] = useState(detail || !!forceOpen);
  useEffect(() => {
    if (typeof forceOpen === 'boolean') setOpen(forceOpen);
  }, [forceOpen]);

  const counts = statusCounts(rooms);
  const gMeta = parseGroupMeta(group.name);
  const uniqueRooms = [...new Set(rooms.map((r) => parseRoomMeta(r.name).roomCode).filter(Boolean))].sort();

  return <section id={`group-${group.id}`} className={`event-column ${open ? 'expanded' : 'collapsed'}`} aria-label={group.name}>
    <div
      className="event-column-head floor-accordion-toggle"
      role="button"
      tabIndex={0}
      onClick={() => setOpen(!open)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
      aria-expanded={open}
      title={open ? 'Nhấn để thu gọn tầng' : 'Nhấn để thả xuống xem danh sách lớp'}
    >
      <div className="floor-head-left">
        <div className="floor-chevron-box" aria-hidden="true">
          <ChevronDown size={18} className={`floor-chevron-icon ${open ? 'open' : ''}`} />
        </div>
        <div className="floor-identity">
          <div className="floor-title-row">
            {showUnit && <span className="column-unit-tag">{gMeta.unit}</span>}
            <h3 className="floor-name">{gMeta.floorName}</h3>
            <span className="floor-count-tag">{rooms.length} lớp</span>
          </div>
          {uniqueRooms.length > 0 && (
            <div className="floor-rooms-chips">
              <span className="rooms-lead">Phòng:</span>
              {uniqueRooms.map((rc) => (
                <span key={rc} className="room-chip">{rc}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="floor-head-right">
        <div className="floor-status-badges">
          <span className={`fstat-badge red ${counts.red > 0 ? 'active' : 'zero'}`}>
            <i className="fstat-dot" />
            <b>{counts.red}</b> chưa tổ chức
          </span>
          <span className={`fstat-badge yellow ${counts.yellow > 0 ? 'active' : 'zero'}`}>
            <i className="fstat-dot" />
            <b>{counts.yellow}</b> đang tiến hành
          </span>
          <span className={`fstat-badge green ${counts.green > 0 ? 'active' : 'zero'}`}>
            <i className="fstat-dot" />
            <b>{counts.green}</b> đã xong
          </span>
        </div>

        <div className="floor-expand-hint">
          <span>{open ? 'Thu gọn' : 'Xem các lớp'}</span>
        </div>
      </div>
    </div>

    {open && (
      <div className="event-column-cards">
        {rooms.map((room) => <RoomCard key={room.id} room={room} me={me} act={act} />)}
        {rooms.length === 0 && <p className="column-empty">Không có lớp phù hợp bộ lọc.</p>}
      </div>
    )}
  </section>;
}
