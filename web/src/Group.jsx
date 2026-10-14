import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock3, FileCheck2, MessageSquareText, Plus, Trash2, UserRound, PhoneCall, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from './api.js';
import { ORDER, ST, TS, NEXT, NOTE_MAX, canEdit, doneCount, percent, statusCounts, patchRoom, patchTask, removeTask, timeLabel, parseRoomMeta, parseGroupMeta, isAttendanceValid, isChecklistComplete, canStartCongress } from './logic.js';

function AttendanceBox({ room, onSave, disabled, onBlocked }) {
  const [attendees, setAttendees] = useState(room.attendees || '');
  const [totalMembers, setTotalMembers] = useState(room.totalMembers || '');

  useEffect(() => {
    setAttendees(room.attendees || '');
    setTotalMembers(room.totalMembers || '');
  }, [room.attendees, room.totalMembers]);

  const att = Number(attendees) || 0;
  const tot = Number(totalMembers) || 0;
  const pct = tot > 0 ? Math.round((att / tot) * 100) : 0;
  const valid = tot > 0 && (att * 3 >= tot * 2);
  const minRequired = tot > 0 ? Math.ceil((tot * 2) / 3) : 0;

  const handleSave = () => {
    if (disabled) return;
    const a = Math.max(0, parseInt(attendees, 10) || 0);
    const t = Math.max(0, parseInt(totalMembers, 10) || 0);
    if (a !== (room.attendees ?? 0) || t !== (room.totalMembers ?? 0)) {
      onSave(a, t);
    }
  };

  return (
    <div
      className={`attendance-box-wrap ${disabled ? 'att-disabled' : ''}`}
      onClickCapture={(e) => {
        if (disabled) {
          e.stopPropagation();
          onBlocked?.();
        }
      }}
    >
      <div className="att-label-row">
        <span><Users size={14} aria-hidden="true" /> Điểm danh & Sĩ số Đoàn viên</span>
        {tot > 0 ? (
          <span className={`att-ratio-tag ${valid ? 'valid' : 'invalid'}`}>
            {valid ? `✓ Đủ điều kiện (≥ 2/3: ${att}/${tot})` : `⚠️ Chưa đủ 2/3 (cần ≥ ${minRequired}/${tot})`}
          </span>
        ) : (
          <span className="att-ratio-tag waiting">Chưa nhập sĩ số</span>
        )}
      </div>

      <div className="att-inputs-grid">
        <div className="att-field">
          <label htmlFor={`att-present-${room.id}`}>Đoàn viên có mặt</label>
          <input
            id={`att-present-${room.id}`}
            type="number"
            min="0"
            max={tot || 999}
            value={attendees}
            disabled={disabled}
            placeholder="Số có mặt"
            onChange={(e) => setAttendees(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
        </div>
        <div className="att-divider">/</div>
        <div className="att-field">
          <label htmlFor={`att-total-${room.id}`}>Sĩ số lớp (Tổng)</label>
          <input
            id={`att-total-${room.id}`}
            type="number"
            min="0"
            max="999"
            value={totalMembers}
            disabled={disabled}
            placeholder="Sĩ số lớp"
            onChange={(e) => setTotalMembers(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          />
        </div>
        <div className="att-pct-display">
          <span className={`att-pct-val ${valid ? 'val-good' : 'val-warn'}`}>{pct}%</span>
          <span className="att-pct-sub">tỷ lệ có mặt</span>
        </div>
      </div>
    </div>
  );
}

function NoteBox({ room, onSave, disabled, onBlocked }) {
  const [value, setValue] = useState(room.note ?? '');
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setValue(room.note ?? ''); }, [room.note]);
  const save = () => {
    typing.current = false;
    const next = value.trim();
    if (next !== (room.note ?? '')) onSave(next);
  };
  return (
    <div
      className={`note-input-wrap ${disabled ? 'note-disabled' : ''}`}
      onClickCapture={(e) => {
        if (disabled) {
          e.stopPropagation();
          onBlocked?.();
        }
      }}
    >
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
          placeholder={disabled ? "Chỉ cán bộ phụ trách hoặc quản trị viên mới có quyền viết ghi chú…" : "Nhập ghi chú kiểm tra hồ sơ, biên bản, tình hình đại hội của chi đoàn…"}
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

export function RoomCard({ room, me, act, initialOpen = false, onRequireLogin, toast, onSelectOfficer }) {
  const [open, setOpen] = useState(initialOpen);
  const editor = canEdit(me, room);
  const done = doneCount(room);
  const progress = percent(room);
  const meta = parseRoomMeta(room.name);

  const isAttOk = isAttendanceValid(room.attendees, room.totalMembers);
  const isDocOk = isChecklistComplete(room);
  const canStart = isAttOk && isDocOk;

  const handleBlockedAction = (e, actionName = 'cập nhật thông tin') => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!me) {
      onRequireLogin?.(`Vui lòng đăng nhập tài khoản cán bộ để ${actionName} chi đoàn ${meta.className}`);
    } else {
      toast?.(`Bạn chỉ có quyền cập nhật các chi đoàn được phân công phụ trách (${meta.className})`);
    }
  };

  const changeStatus = (status) => {
    if (status !== 'red' && !canStart && !me?.isAdmin && me?.role !== 'admin') {
      if (!isAttOk) {
        toast?.(`Chưa đủ điều kiện tổ chức Đại hội: Số đoàn viên có mặt (${room.attendees || 0}/${room.totalMembers || 0}) chưa đạt tối thiểu 2/3 sĩ số lớp.`);
      } else if (!isDocOk) {
        toast?.(`Chưa đủ điều kiện tổ chức Đại hội: Checklist giấy tờ chưa hoàn thành 100% (${done}/${room.tasks.length} mục đã đủ).`);
      }
      return;
    }
    act((state) => patchRoom(state, room.id, { status }), () => api.setStatus(room.id, status));
  };

  const saveAttendance = (attendees, totalMembers) => act(
    (state) => patchRoom(state, room.id, { attendees, totalMembers }),
    () => api.setAttendance(room.id, attendees, totalMembers),
  );

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

  return <article className={`task-card room-card status-${room.status} ${open ? 'expanded' : ''} ${!editor ? 'is-read-only' : ''}`}>
    <div className="room-card-head" role="button" tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }} aria-expanded={open}>
      <div className="room-meta-badges">
        {meta.roomCode && <span className="room-code-badge">{meta.roomCode}</span>}
        {meta.kipLabel && <span className="room-kip-badge">{meta.kipLabel}</span>}
        {meta.cohort && <span className={`room-cohort-badge ${meta.cohort.toLowerCase()}`}>{meta.congressType}</span>}
      </div>
      <ChevronDown size={18} className="room-chevron" aria-hidden="true" />
      <strong className="card-title">{meta.className}</strong>
      
      {/* Thanh hiển thị trạng thái duy nhất ở đầu card: Dạng Badge/Pill tinh gọn, không dùng dropdown trùng lặp */}
      <div className="card-status-pill-row">
        <span className={`room-status-badge ${room.status}`}>
          <span className="status-dot" />
          {ST[room.status]}
        </span>
        {room.totalMembers > 0 && (
          <span className={`room-att-pill ${isAttOk ? 'att-ok' : 'att-warn'}`} title={`Số lượng đoàn viên: ${room.attendees || 0}/${room.totalMembers} (${Math.round(((room.attendees || 0) / room.totalMembers) * 100)}%)`}>
            {room.attendees || 0}/{room.totalMembers} ĐV {isAttOk ? '✓' : '⚠️'}
          </span>
        )}
        {!editor && (
          <span className="read-only-badge" title={!me ? "Nhấn để đăng nhập cán bộ" : "Chỉ xem"}>
            Chỉ xem
          </span>
        )}
      </div>

      <div className="room-owner" onClick={(e) => e.stopPropagation()}>
        <UserRound size={14} aria-hidden="true" />
        {room.owners && room.owners.length > 0 ? (
          <span className="room-owner-chips-row">
            {room.owners.map((owner, idx) => {
              const name = typeof owner === 'string' ? owner : owner.name;
              const hasPhone = typeof owner === 'object' && Boolean(owner.phone);
              return (
                <button
                  key={idx}
                  type="button"
                  className="room-owner-chip-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectOfficer?.(owner);
                  }}
                  title={`Bấm để xem SĐT và gọi điện cho ${name}`}
                >
                  <span>{name}</span>
                  {hasPhone && <PhoneCall size={11} className="inline-phone-icon" />}
                </button>
              );
            })}
          </span>
        ) : (
          <span className="room-owner-default">Ban TC-KT / Trực tầng</span>
        )}
      </div>
      <span className={`card-desc ${room.note ? 'has-note' : 'empty'}`}>{room.note ? `📝 ${room.note}` : 'Chưa có ghi chú kiểm tra'}</span>
      <span className="card-progress-meta"><span><FileCheck2 size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />{done}/{room.tasks.length} giấy tờ đã đủ</span><span>{progress}%</span></span>
      <span className="card-progress-track" role="progressbar" aria-label={`Tiến độ hồ sơ ${meta.className}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span className={`card-progress-bar ${room.status}`} style={{ width: `${progress}%` }} /></span>
    </div>
    <div className="room-details-shell" inert={!open ? '' : undefined} aria-hidden={!open}>
      <div className="room-details">
        {/* 1. MỤC NHẬP SỐ LƯỢNG ĐOÀN VIÊN CÓ MẶT / SĨ SỐ LỚP */}
        <AttendanceBox
          room={room}
          onSave={saveAttendance}
          disabled={!editor}
          onBlocked={() => handleBlockedAction(null, 'cập nhật điểm danh và sĩ số của')}
        />

        {/* 2. THANH DROPDOWN TRẠNG THÁI ĐẠI HỘI DUY NHẤT */}
        <div className="room-detail-title">
          <span>Trạng thái Đại hội</span>
          <span>{editor ? '3 mức trạng thái' : 'Chế độ chỉ xem'}</span>
        </div>

        {/* Thông báo điều kiện tổ chức trực quan */}
        <div className={`congress-condition-banner ${canStart ? 'eligible' : 'locked'}`}>
          {canStart ? (
            <span><CheckCircle2 size={14} /> Đã đủ điều kiện tiến hành Đại hội (≥ 2/3 sĩ số & 100% giấy tờ)</span>
          ) : (
            <span>
              <AlertCircle size={14} /> Chưa đủ điều kiện tổ chức: {!isAttOk ? 'Thiếu ≥ 2/3 đoàn viên có mặt' : ''} {!isAttOk && !isDocOk ? 'và ' : ''} {!isDocOk ? 'Chưa đủ 100% giấy tờ' : ''}
            </span>
          )}
        </div>

        <div
          className="room-status-select-wrap"
          onClickCapture={(e) => {
            if (!editor) {
              e.stopPropagation();
              handleBlockedAction(e, 'thay đổi trạng thái Đại hội của');
            }
          }}
        >
          <select
            className={`room-status-select full-width ${room.status} ${!editor ? 'read-only' : ''}`}
            value={room.status}
            disabled={!editor}
            onChange={(e) => changeStatus(e.target.value)}
            aria-label={`Chọn trạng thái Đại hội cho ${meta.className}`}
          >
            <option value="red">{ST.red}</option>
            <option value="yellow" disabled={!canStart && !me?.isAdmin && me?.role !== 'admin' && room.status === 'red'}>
              {ST.yellow} {!canStart && !me?.isAdmin && me?.role !== 'admin' && room.status === 'red' ? '(Chưa đủ điều kiện)' : ''}
            </option>
            <option value="green" disabled={!canStart && !me?.isAdmin && me?.role !== 'admin' && room.status === 'red'}>
              {ST.green} {!canStart && !me?.isAdmin && me?.role !== 'admin' && room.status === 'red' ? '(Chưa đủ điều kiện)' : ''}
            </option>
          </select>
        </div>

        <div className="room-detail-title">
          <span>Checklist giấy tờ ({meta.congressType})</span>
          <span>{done}/{room.tasks.length} đã đủ</span>
        </div>
        {room.tasks.length === 0 && <p className="room-empty">Lớp này chưa có danh mục giấy tờ nào.</p>}
        <div
          className={`card-checklist ${!editor ? 'checklist-readonly' : ''}`}
          onClickCapture={(e) => {
            if (!editor) {
              e.stopPropagation();
              handleBlockedAction(e, 'đánh dấu hồ sơ giấy tờ của');
            }
          }}
        >
          {room.tasks.map((task) => (
            <div className={`checklist-item ${task.state}`} key={task.id}>
              <button
                className={`task-state-btn ${task.state}`}
                disabled={!editor}
                onClick={() => changeTask(task)}
                aria-label={`${task.text}: ${TS[task.state]}. Nhấn để đổi trạng thái`}
              >
                {TS[task.state]}
              </button>
              {editor ? (
                <input
                  className="task-edit-input"
                  key={task.text}
                  defaultValue={task.text}
                  maxLength={200}
                  aria-label={`Sửa tên giấy tờ ${task.text}`}
                  onBlur={(e) => {
                    const text = e.target.value.trim();
                    if (text && text !== task.text) editTask(task, text);
                    else e.target.value = task.text;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      e.currentTarget.value = task.text;
                      e.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <span className="task-label">{task.text}</span>
              )}
              {editor && (
                <button
                  className="task-del-btn"
                  onClick={() => deleteTask(task)}
                  aria-label={`Xóa mục ${task.text}`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {editor && <AddTask onAdd={addNewTask} />}

        <NoteBox
          room={room}
          onSave={saveNote}
          disabled={!editor}
          onBlocked={() => handleBlockedAction(null, 'viết ghi chú kiểm tra cho')}
        />

        <div className="card-bottom-row"><Clock3 size={14} /><span>Cập nhật {timeLabel(room.updatedAt)}{room.updatedBy ? ` · ${room.updatedBy}` : ''}</span></div>
      </div>
    </div>
  </article>;
}

export default function GroupCard({ group, rooms, me, act, detail = false, showUnit = false, forceOpen, onRequireLogin, toast, onSelectOfficer }) {
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
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            me={me}
            act={act}
            onRequireLogin={onRequireLogin}
            toast={toast}
            onSelectOfficer={onSelectOfficer}
          />
        ))}
        {rooms.length === 0 && <p className="column-empty">Không có lớp phù hợp bộ lọc.</p>}
      </div>
    )}
  </section>;
}

