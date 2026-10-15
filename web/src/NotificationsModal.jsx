import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Bell,
  Send,
  CheckCheck,
  RefreshCw,
  AlertOctagon,
  AlertTriangle,
  Info,
  Clock,
  User,
  Building2,
  Layers,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { api } from './api.js';

function formatVnTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  return `${h}:${m}:${s} · ${day}/${month}/${year}`;
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function RoleBadge({ role }) {
  switch (role) {
    case 'admin':
      return <span className="log-role-badge role-admin">Admin</span>;
    case 'unit_lead':
      return <span className="log-role-badge role-unit">Phụ trách ĐV</span>;
    case 'floor_lead':
      return <span className="log-role-badge role-floor">Phụ trách Tầng</span>;
    default:
      return <span className="log-role-badge role-officer">Cán bộ</span>;
  }
}

function LevelBadge({ level }) {
  switch (level) {
    case 'urgent':
      return (
        <span className="notif-level-badge level-urgent">
          <AlertOctagon size={12} /> Khẩn cấp
        </span>
      );
    case 'warning':
      return (
        <span className="notif-level-badge level-warning">
          <AlertTriangle size={12} /> Lưu ý
        </span>
      );
    default:
      return (
        <span className="notif-level-badge level-info">
          <Info size={12} /> Thông thường
        </span>
      );
  }
}

export default function NotificationsModal({
  open,
  onClose,
  me,
  say,
  onUnreadCountChange,
}) {
  const [tab, setTab] = useState('list'); // 'list' | 'compose'
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Compose State
  const [targets, setTargets] = useState(null);
  const [targetType, setTargetType] = useState('all');
  const [targetId, setTargetId] = useState('');
  const [level, setLevel] = useState('info');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const canCompose = Boolean(
    me && (me.isAdmin || me.role === 'admin' || me.role === 'unit_lead' || me.role === 'floor_lead')
  );

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.notifications();
      const list = res.notifications || [];
      setNotifications(list);
      const unread = list.filter((n) => !n.is_read).length;
      onUnreadCountChange?.(unread);
    } catch (err) {
      setError(err.message || 'Không thể tải thông báo');
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  const fetchTargets = useCallback(async () => {
    if (!canCompose) return;
    try {
      const t = await api.notificationTargets();
      setTargets(t);
      if (t.canBroadcastAll) {
        setTargetType('all');
      } else if (t.buildings && t.buildings.length > 0) {
        setTargetType('building');
        setTargetId(t.buildings[0]);
      } else if (t.floors && t.floors.length > 0) {
        setTargetType('floor');
        setTargetId(t.floors[0].id);
      } else if (t.users && t.users.length > 0) {
        setTargetType('user');
        setTargetId(t.users[0].email);
      }
    } catch {
      // Bỏ qua lỗi nếu chưa có quyền
    }
  }, [canCompose]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
      fetchTargets();
    }
  }, [open, fetchNotifications, fetchTargets]);

  if (!open) return null;

  const handleMarkRead = async (id) => {
    try {
      await api.readNotification(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      const unread = notifications.filter((n) => n.id !== id && !n.is_read).length;
      onUnreadCountChange?.(unread);
    } catch {
      // Bỏ qua lỗi
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.readAllNotifications();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      onUnreadCountChange?.(0);
      say?.('Đã đánh dấu tất cả thông báo là đã đọc');
    } catch (e) {
      say?.(`Lỗi: ${e.message}`);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      say?.('Vui lòng điền đầy đủ Tiêu đề và Nội dung thông báo.');
      return;
    }

    let targetLabel = '';
    if (targetType === 'all') {
      targetLabel = 'Toàn hệ thống (Tất cả thành viên)';
    } else if (targetType === 'building') {
      targetLabel = `Đơn vị/Tòa: ${targetId}`;
    } else if (targetType === 'floor') {
      const f = targets?.floors?.find((fl) => String(fl.id) === String(targetId));
      targetLabel = f ? f.label : `Tầng ID: ${targetId}`;
    } else if (targetType === 'user') {
      const u = targets?.users?.find((us) => us.email === targetId);
      targetLabel = u ? `${u.name} (${u.email})` : targetId;
    }

    setSending(true);
    try {
      await api.sendNotification({
        title: title.trim(),
        content: content.trim(),
        level,
        targetType,
        targetId: targetType === 'all' ? null : targetId,
        targetLabel,
      });
      say?.('Đã gửi thông báo hệ thống thành công!');
      setTitle('');
      setContent('');
      setTab('list');
      fetchNotifications();
    } catch (err) {
      say?.(`Không thể gửi thông báo: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return createPortal(
    <div className="custom-modal-backdrop notif-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="notif-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-modal-title"
      >
        {/* Header */}
        <div className="notif-modal-header">
          <div className="notif-header-title-box">
            <div className="notif-bell-circle">
              <Bell size={20} />
            </div>
            <div className="notif-title-texts">
              <h3 id="notif-modal-title" className="notif-modal-title">
                Thông Báo Hệ Thống
              </h3>
              <p className="notif-modal-subtitle">
                Tin nhắn điều hành, chỉ đạo trực tiếp từ Ban Tổ chức - Kiểm tra
              </p>
            </div>
          </div>
          <button
            type="button"
            className="custom-modal-close notif-close-btn"
            onClick={onClose}
            aria-label="Đóng thông báo"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="notif-tabs-bar">
          <button
            type="button"
            className={`notif-tab-btn ${tab === 'list' ? 'active' : ''}`}
            onClick={() => setTab('list')}
          >
            <Bell size={15} />
            <span>Thông báo đã nhận</span>
            {unreadCount > 0 && <span className="notif-unread-pill">{unreadCount}</span>}
          </button>
          {canCompose && (
            <button
              type="button"
              className={`notif-tab-btn ${tab === 'compose' ? 'active' : ''}`}
              onClick={() => setTab('compose')}
            >
              <Send size={15} />
              <span>Gửi thông báo mới</span>
              <span className="notif-role-badge-tab">
                {me?.isAdmin || me?.role === 'admin'
                  ? 'Admin'
                  : me?.role === 'unit_lead'
                  ? 'Phụ trách ĐV'
                  : 'Phụ trách Tầng'}
              </span>
            </button>
          )}
        </div>

        {/* Modal Body Container with Smooth Scroll */}
        <div className="notif-modal-body">
          {tab === 'list' ? (
            <div className="notif-list-container">
            <div className="notif-list-toolbar">
              <span className="notif-total-text">
                Tổng cộng <b>{notifications.length}</b> thông báo ({unreadCount} chưa đọc)
              </span>
              <div className="notif-toolbar-actions">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="notif-btn-text"
                    onClick={handleMarkAllRead}
                    title="Đánh dấu tất cả thông báo là đã đọc"
                  >
                    <CheckCheck size={14} /> Đã đọc tất cả
                  </button>
                )}
                <button
                  type="button"
                  className="notif-btn-refresh"
                  onClick={fetchNotifications}
                  disabled={loading}
                  title="Làm mới thông báo"
                >
                  <RefreshCw size={13} className={loading ? 'spinning' : ''} />
                </button>
              </div>
            </div>

            {error && (
              <div className="logs-error-banner" style={{ margin: '8px 16px', borderRadius: '8px' }}>
                <ShieldAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="notif-items-scroll">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={`notif-card-item ${!item.is_read ? 'unread' : 'read'}`}
                  onClick={() => !item.is_read && handleMarkRead(item.id)}
                >
                  <div className="notif-item-top">
                    <div className="notif-item-badges">
                      <LevelBadge level={item.level} />
                      <span className="notif-target-tag">
                        {item.target_type === 'all' ? (
                          <>
                            <Sparkles size={11} /> Toàn hệ thống
                          </>
                        ) : item.target_type === 'building' ? (
                          <>
                            <Building2 size={11} /> {item.target_label}
                          </>
                        ) : item.target_type === 'floor' ? (
                          <>
                            <Layers size={11} /> {item.target_label}
                          </>
                        ) : (
                          <>
                            <User size={11} /> {item.target_label}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="notif-item-time">
                      <Clock size={12} />
                      <span>{timeAgo(item.created_at)}</span>
                    </div>
                  </div>

                  <h4 className="notif-item-title">{item.title}</h4>
                  <p className="notif-item-content">{item.content}</p>

                  <div className="notif-item-bottom">
                    <div className="notif-sender-info">
                      <div className="notif-sender-avatar">
                        <User size={12} />
                      </div>
                      <span className="notif-sender-name">{item.sender_name}</span>
                      <RoleBadge role={item.sender_role} />
                    </div>
                    <span className="notif-exact-time">{formatVnTime(item.created_at)}</span>
                  </div>
                </div>
              ))}

              {!loading && notifications.length === 0 && (
                <div className="notif-empty-state">
                  <Bell size={36} className="empty-bell-icon" />
                  <h4>Chưa có thông báo nào</h4>
                  <p>Các chỉ đạo, nhắc nhở hoặc thông báo khẩn từ cấp trên sẽ hiển thị tại đây.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Tab 2: Tạo và gửi thông báo mới */
          <form className="notif-compose-form" onSubmit={handleSend}>
            <div className="notif-form-row">
              <label className="notif-form-label">
                Phạm vi người nhận <span className="required-star">*</span>
              </label>
              <div className="notif-scope-grid">
                {targets?.canBroadcastAll && (
                  <label
                    className={`notif-scope-option ${targetType === 'all' ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value="all"
                      checked={targetType === 'all'}
                      onChange={() => setTargetType('all')}
                    />
                    <Sparkles size={14} />
                    <span>Toàn hệ thống (Online)</span>
                  </label>
                )}

                {targets?.buildings && targets.buildings.length > 0 && (
                  <label
                    className={`notif-scope-option ${targetType === 'building' ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value="building"
                      checked={targetType === 'building'}
                      onChange={() => {
                        setTargetType('building');
                        if (!targetId && targets.buildings.length > 0) {
                          setTargetId(targets.buildings[0]);
                        }
                      }}
                    />
                    <Building2 size={14} />
                    <span>Một Tòa / Đơn vị</span>
                  </label>
                )}

                {targets?.floors && targets.floors.length > 0 && (
                  <label
                    className={`notif-scope-option ${targetType === 'floor' ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value="floor"
                      checked={targetType === 'floor'}
                      onChange={() => {
                        setTargetType('floor');
                        if (!targetId && targets.floors.length > 0) {
                          setTargetId(targets.floors[0].id);
                        }
                      }}
                    />
                    <Layers size={14} />
                    <span>Một Tầng cụ thể</span>
                  </label>
                )}

                {targets?.users && targets.users.length > 0 && (
                  <label
                    className={`notif-scope-option ${targetType === 'user' ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value="user"
                      checked={targetType === 'user'}
                      onChange={() => {
                        setTargetType('user');
                        if (!targetId && targets.users.length > 0) {
                          setTargetId(targets.users[0].email);
                        }
                      }}
                    />
                    <User size={14} />
                    <span>Người chỉ định (Cán bộ)</span>
                  </label>
                )}
              </div>
            </div>

            {/* Chọn mục tiêu cụ thể */}
            {targetType === 'building' && (
              <div className="notif-form-row">
                <label className="notif-form-label">
                  Chọn Đơn vị / Tòa nhà <span className="required-star">*</span>
                </label>
                <select
                  className="notif-select"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  required
                >
                  {targets?.buildings?.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {targetType === 'floor' && (
              <div className="notif-form-row">
                <label className="notif-form-label">
                  Chọn Tầng phụ trách <span className="required-star">*</span>
                </label>
                <select
                  className="notif-select"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  required
                >
                  {targets?.floors?.map((fl) => (
                    <option key={fl.id} value={fl.id}>
                      {fl.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {targetType === 'user' && (
              <div className="notif-form-row">
                <label className="notif-form-label">
                  Chọn Cán bộ nhận thông báo <span className="required-star">*</span>
                </label>
                <select
                  className="notif-select"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  required
                >
                  {targets?.users?.map((u) => (
                    <option key={u.email} value={u.email}>
                      {u.name} — {u.email} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Mức độ quan trọng */}
            <div className="notif-form-row">
              <label className="notif-form-label">Mức độ ưu tiên</label>
              <div className="notif-level-options">
                <label
                  className={`notif-level-radio ${level === 'info' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="level"
                    value="info"
                    checked={level === 'info'}
                    onChange={() => setLevel('info')}
                  />
                  <Info size={14} className="level-icon-info" />
                  <span>Thông thường</span>
                </label>
                <label
                  className={`notif-level-radio ${level === 'warning' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="level"
                    value="warning"
                    checked={level === 'warning'}
                    onChange={() => setLevel('warning')}
                  />
                  <AlertTriangle size={14} className="level-icon-warning" />
                  <span>Lưu ý quan trọng</span>
                </label>
                <label
                  className={`notif-level-radio ${level === 'urgent' ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="level"
                    value="urgent"
                    checked={level === 'urgent'}
                    onChange={() => setLevel('urgent')}
                  />
                  <AlertOctagon size={14} className="level-icon-urgent" />
                  <span>Khẩn cấp / Báo động</span>
                </label>
              </div>
            </div>

            {/* Tiêu đề */}
            <div className="notif-form-row">
              <label className="notif-form-label">
                Tiêu đề thông báo <span className="required-star">*</span>
              </label>
              <input
                type="text"
                className="notif-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Nhắc nhở nộp biên bản kiểm phiếu kíp 2, ..."
                maxLength={150}
                required
              />
            </div>

            {/* Nội dung */}
            <div className="notif-form-row">
              <label className="notif-form-label">
                Nội dung chi tiết <span className="required-star">*</span>
              </label>
              <textarea
                className="notif-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nhập nội dung thông báo, hướng dẫn cụ thể cho các cán bộ phụ trách..."
                maxLength={1000}
                rows={4}
                required
              />
              <span className="notif-char-counter">{content.length}/1000</span>
            </div>

            <div className="notif-compose-footer">
              <button
                type="button"
                className="custom-btn custom-btn-secondary"
                onClick={() => setTab('list')}
              >
                Quay lại
              </button>
              <button
                type="submit"
                className="custom-btn custom-btn-primary"
                disabled={sending || !title.trim() || !content.trim()}
              >
                <Send size={15} />
                <span>{sending ? 'Đang phát...' : 'Phát thông báo ngay'}</span>
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>,
    document.body
  );
}
