import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertOctagon, AlertTriangle, Bell, X, Check } from 'lucide-react';

export default function IncomingAlertModal({
  notification,
  onClose,
  onAcknowledge,
}) {
  useEffect(() => {
    if (!notification) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notification, onClose]);

  if (!notification) return null;

  const isUrgent = notification.level === 'urgent';
  const isWarning = notification.level === 'warning';

  return createPortal(
    <div className="custom-modal-backdrop incoming-alert-backdrop" onClick={onClose} role="presentation">
      <div
        className={`incoming-alert-card ${isUrgent ? 'card-urgent' : isWarning ? 'card-warning' : 'card-info'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="incoming-alert-header">
          <div className="alert-icon-wrap">
            {isUrgent ? (
              <AlertOctagon size={24} className="alert-icon-pulse" />
            ) : isWarning ? (
              <AlertTriangle size={24} />
            ) : (
              <Bell size={24} />
            )}
          </div>
          <div className="alert-header-text">
            <span className="alert-kicker">
              {isUrgent ? 'THÔNG BÁO KHẨN CẤP' : isWarning ? 'LƯU Ý QUAN TRỌNG' : 'THÔNG BÁO TỪ BAN TC-KT'}
            </span>
            <h3 className="alert-title">{notification.title}</h3>
          </div>
          <button
            type="button"
            className="custom-modal-close"
            onClick={onClose}
            aria-label="Đóng thông báo"
          >
            <X size={18} />
          </button>
        </div>

        <div className="incoming-alert-body">
          <p className="alert-content-text">{notification.content}</p>
          <div className="alert-sender-strip">
            <span>Từ: <b>{notification.sender_name}</b> ({notification.sender_role})</span>
            {notification.target_label && <span> · Gửi: <b>{notification.target_label}</b></span>}
          </div>
        </div>

        <div className="incoming-alert-footer">
          <button
            type="button"
            className="custom-btn custom-btn-primary alert-ack-btn"
            onClick={() => {
              onAcknowledge?.(notification.id);
              onClose?.();
            }}
          >
            <Check size={16} /> Đã hiểu &amp; Xác nhận
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
