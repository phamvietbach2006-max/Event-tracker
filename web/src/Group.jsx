import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock3, FileCheck2, MessageSquareText, Plus, Trash2, UserRound, PhoneCall, Users, CheckCircle2, AlertCircle, Settings2, Check } from 'lucide-react';
import { api } from './api.js';
import { ORDER, ST, TS, NEXT, NOTE_MAX, canEdit, doneCount, percent, statusCounts, patchRoom, patchTask, removeTask, timeLabel, parseRoomMeta, parseGroupMeta, isAttendanceValid, isChecklistComplete, canStartCongress, isUserAdmin } from './logic.js';

function AttendanceBox({ room, onSave, disabled, onBlocked }) {
  const [attendees, setAttendees] = useState(room.attendees || '');
  const [totalMembers, setTotalMembers] = useState(room.totalMembers || '');

  useEffect(() => {
    setAttendees(room.attendees || '');
    setTotalMembers(room.totalMembers || '');
  }, [room.attendees, room.totalMembers]);

  const att = Number(attendees) || 0;
  const tot = Number(totalMembers) || 0;
  const pct = tot > 0 ? Math.min(100, Math.round((att / tot) * 100)) : 0;
  const valid = tot > 0 && (att * 3 >= tot * 2);
  const minRequired = tot > 0 ? Math.ceil((tot * 2) / 3) : 0;
  const deficit = Math.max(0, minRequired - att);

  const handleSave = () => {
    if (disabled) return;
    let a = Math.max(0, parseInt(attendees, 10) || 0);
    const t = Math.max(0, parseInt(totalMembers, 10) || 0);
    if (t > 0 && a > t) {
      a = t;
      setAttendees(t);
    }
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
        <span className="att-box-title">
          <Users size={14} aria-hidden="true" /> Điểm danh & Sĩ số Đoàn viên
        </span>
        {tot > 0 ? (
          <span className={`att-ratio-tag ${valid ? 'valid' : 'invalid'}`}>
            {valid ? `✓ Đủ 2/3 sĩ số (${att}/${tot} - ${pct}%)` : `⚠️ Chưa đủ 2/3 (hiện ${att}/${tot} · thiếu ${deficit})`}
          </span>
        ) : (
          <span className="att-ratio-tag waiting">Chưa nhập sĩ số lớp</span>
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
          <span className="att-pct-sub">{valid ? 'Đạt chuẩn' : 'Chưa đạt'}</span>
        </div>
      </div>

      {tot > 0 && (
        <div className="att-progress-container" title={`Tỷ lệ có mặt: ${pct}% (Yêu cầu tối thiểu: 66.7%)`}>
          <div className="att-progress-bar-track">
            <div
              className={`att-progress-bar-fill ${valid ? 'fill-good' : 'fill-warn'}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
            <div className="att-progress-benchmark" style={{ left: '66.67%' }}>
              <span className="benchmark-pin" />
              <span className="benchmark-label">Mốc 2/3</span>
            </div>
          </div>
        </div>
      )}
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
  const [customizingTasks, setCustomizingTasks] = useState(false);
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
    const prevStatus = room.status;
    if (status !== 'red' && !canStart && !isUserAdmin(me)) {
      if (!isAttOk && !isDocOk) {
        toast?.(`Chưa đủ điều kiện tổ chức Đại hội: Sĩ số chưa đạt 2/3 (${room.attendees || 0}/${room.totalMembers || 0}) và checklist giấy tờ chưa đủ 100% (${done}/${room.tasks.length}).`);
      } else if (!isAttOk) {
        const minRequired = room.totalMembers > 0 ? Math.ceil((room.totalMembers * 2) / 3) : 1;
        toast?.(`Chưa đủ điều kiện tổ chức: Cần tối thiểu 2/3 đoàn viên có mặt (hiện có ${room.attendees || 0}/${room.totalMembers || 0}, cần ≥ ${minRequired}).`);
      } else if (!isDocOk) {
        toast?.(`Chưa đủ điều kiện tổ chức: Checklist giấy tờ chưa hoàn thành 100% (mới đạt ${done}/${room.tasks.length} mục).`);
      }
      return;
    }
    act(
      (state) => patchRoom(state, room.id, { status }),
      () => api.setStatus(room.id, status),
      (state) => patchRoom(state, room.id, { status: prevStatus }),
    );
  };

  const saveAttendance = (attendees, totalMembers) => {
    const prevAtt = room.attendees;
    const prevTot = room.totalMembers;
    act(
      (state) => patchRoom(state, room.id, { attendees, totalMembers }),
      () => api.setAttendance(room.id, attendees, totalMembers),
      (state) => patchRoom(state, room.id, { attendees: prevAtt, totalMembers: prevTot }),
    );
  };

  const changeTask = (task) => {
    const prevState = task.state;
    const nextState = NEXT[task.state];
    act(
      (current) => patchTask(current, task.id, { state: nextState }),
      () => api.setTask(task.id, nextState),
      (current) => patchTask(current, task.id, { state: prevState }),
    );
  };

  const editTask = (task, text) => {
    const prevText = task.text;
    act(
      (state) => patchTask(state, task.id, { text }),
      () => api.patchTaskText(task.id, text),
      (state) => patchTask(state, task.id, { text: prevText }),
    );
  };

  const deleteTask = (task) => {
    if (confirm(`Xóa mục "${task.text}"?`)) {
      act(
        (state) => removeTask(state, task.id),
        () => api.delTask(task.id),
      );
    }
  };

  const addNewTask = (text) => act(
    (state) => patchRoom(state, room.id, { tasks: [...room.tasks, { id: -Date.now(), text, state: 'todo', sort: room.tasks.length + 1 }] }),
    () => api.addTask(room.id, text),
  );

  const saveNote = (note) => {
    const prevNote = room.note;
    act(
      (state) => patchRoom(state, room.id, { note }),
      () => api.setNote(room.id, note),
      (state) => patchRoom(state, room.id, { note: prevNote }),
    );
  };

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
            <span><CheckCircle2 size={15} /> Đã đủ điều kiện tiến hành Đại hội (≥ 2/3 sĩ số & 100% giấy tờ)</span>
          ) : (
            <span>
              <AlertCircle size={15} /> Chưa đủ điều kiện tổ chức:{' '}
              {!isAttOk && `Cần ≥ 2/3 đoàn viên có mặt (${room.attendees || 0}/${room.totalMembers || 0})`}
              {!isAttOk && !isDocOk && ' · '}
              {!isDocOk && `Checklist chưa đạt 100% (${done}/${room.tasks.length} mục)`}
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
            <option value="yellow" disabled={!canStart && !isUserAdmin(me)}>
              {ST.yellow} {!canStart && !isUserAdmin(me) ? '(Chưa đủ điều kiện)' : ''}
            </option>
            <option value="green" disabled={!canStart && !isUserAdmin(me)}>
              {ST.green} {!canStart && !isUserAdmin(me) ? '(Chưa đủ điều kiện)' : ''}
            </option>
          </select>
        </div>

        {/* 3. CHECKLIST GIẤY TỜ TINH GỌN */}
        <div className="room-detail-title checklist-header-row">
          <span>Checklist giấy tờ ({meta.congressType}) · {done}/{room.tasks.length} đã đủ</span>
          {editor && (
            <button
              type="button"
              className={`btn-toggle-task-customize ${customizingTasks ? 'active' : ''}`}
              onClick={() => setCustomizingTasks((v) => !v)}
              title={customizingTasks ? 'Hoàn tất tùy chỉnh' : 'Tùy chỉnh danh mục giấy tờ (sửa tên/thêm/xóa)'}
            >
              {customizingTasks ? (
                <>✓ Hoàn tất</>
              ) : (
                <><Settings2 size={13} /> Tùy chỉnh danh mục</>
              )}
            </button>
          )}
        </div>

        {customizingTasks && (
          <div className="task-customize-notice">
            <span>⚙️ Chế độ tùy chỉnh: Bạn có thể đổi tên, thêm mới hoặc xóa bớt danh mục giấy tờ bên dưới.</span>
          </div>
        )}

        {room.tasks.length === 0 && <p className="room-empty">Lớp này chưa có danh mục giấy tờ nào.</p>}

        <div
          className={`card-checklist ${!editor ? 'checklist-readonly' : ''} ${customizingTasks ? 'mode-customize' : 'mode-inspect'}`}
          onClickCapture={(e) => {
            if (!editor) {
              e.stopPropagation();
              handleBlockedAction(e, 'đánh dấu hồ sơ giấy tờ của');
            }
          }}
        >
          {room.tasks.map((task) => {
            const isDone = task.state === 'done';
            if (customizingTasks) {
              return (
                <div className={`checklist-item customize-item ${task.state}`} key={task.id}>
                  <button
                    className={`task-state-btn ${task.state}`}
                    disabled={!editor}
                    onClick={() => changeTask(task)}
                    aria-label={`${task.text}: ${TS[task.state]}`}
                  >
                    {isDone ? <Check size={12} strokeWidth={3} /> : null}
                  </button>
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
                  <button
                    className="task-del-btn"
                    onClick={() => deleteTask(task)}
                    aria-label={`Xóa mục ${task.text}`}
                    title="Xóa mục giấy tờ này"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            }

            // Clean Inspection Mode (Chế độ Tác nghiệp / Kiểm tra Tinh Gọn)
            return (
              <div
                className={`clean-check-row ${isDone ? 'is-done' : 'is-todo'} ${editor ? 'clickable' : ''}`}
                key={task.id}
                role="button"
                tabIndex={editor ? 0 : undefined}
                onClick={() => {
                  if (editor) changeTask(task);
                }}
                onKeyDown={(e) => {
                  if (editor && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    changeTask(task);
                  }
                }}
                aria-label={`${task.text}: ${TS[task.state]}. Nhấn để đổi trạng thái`}
              >
                <div className={`clean-check-circle ${isDone ? 'checked' : ''}`}>
                  {isDone ? <Check size={13} strokeWidth={3} /> : null}
                </div>
                <span className="clean-check-label">{task.text}</span>
                <span className={`clean-check-pill ${task.state}`}>
                  {TS[task.state]}
                </span>
              </div>
            );
          })}
        </div>
        {editor && customizingTasks && <AddTask onAdd={addNewTask} />}

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

