import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Send, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { parseRoomMeta } from './logic.js';

export default function QuorumRequestModal({
  open,
  onClose,
  room,
  group,
  me,
  onSubmit,
}) {
  const [targetType, setTargetType] = useState('both');
  const [submitting, setSubmitting] = useState(false);

  if (!open || !room) return null;

  const meta = parseRoomMeta(room.name);
  const att = Number(room.attendees) || 0;
  const tot = Number(room.totalMembers) || 0;
  const pct = tot > 0 ? Math.min(100, Math.round((att / tot) * 100)) : 0;
  const minRequired = tot > 0 ? Math.ceil((tot * 2) / 3) : 0;
  const deficit = Math.max(0, minRequired - att);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit?.(room.id, targetType, att, tot);
      onClose();
    } catch {
      // lỗi đã được xử lý ở caller
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="custom-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="custom-modal-card quorum-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="custom-modal-header warning">
          <div className="custom-modal-icon-wrap warning">
            <ShieldAlert size={24} />
          </div>
          <div className="custom-modal-title-wrap">
            <h3 className="custom-modal-title">Xin Phê duyệt Ngoại lệ Sĩ số</h3>
            <span className="custom-modal-subtitle">
              Chi đoàn: <b>{meta.className}</b> · Phòng {meta.roomCode || room.name}
            </span>
          </div>
          <button
            type="button"
            className="custom-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="custom-modal-body">
            <div className="quorum-summary-card">
              <div className="quorum-stat-row">
                <span className="stat-label">Sĩ số thực tế có mặt:</span>
                <span className="stat-value warn">
                  <b>{att}</b> / {tot} đoàn viên ({pct}%)
                </span>
              </div>
              <div className="quorum-stat-row">
                <span className="stat-label">Yêu cầu chuẩn Điều lệ (≥ 2/3):</span>
                <span className="stat-value">
                  Cần tối thiểu <b>{minRequired}</b> có mặt (Còn thiếu <b>{deficit}</b> đoàn viên)
                </span>
              </div>
            </div>

            <p className="quorum-lead-text">
              Sĩ số hiện tại chưa đạt ngưỡng 2/3 theo quy định. Bạn có thể gửi yêu cầu xin phê duyệt khẩn cấp tới Cấp trên để được gỡ bỏ yêu cầu 2/3 và tiến hành Đại hội.
            </p>

            <div className="quorum-recipient-selector">
              <label className="field-label">Gửi yêu cầu phê duyệt tới:</label>
              <div className="target-options-grid">
                <label className={`target-option-card ${targetType === 'both' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="quorumTarget"
                    value="both"
                    checked={targetType === 'both'}
                    onChange={(e) => setTargetType(e.target.value)}
                  />
                  <div className="option-content">
                    <strong>Cả hai (Khuyến nghị)</strong>
                    <span>Ban Quản trị (Admin) &amp; Phụ trách tầng</span>
                  </div>
                </label>

                <label className={`target-option-card ${targetType === 'admin' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="quorumTarget"
                    value="admin"
                    checked={targetType === 'admin'}
                    onChange={(e) => setTargetType(e.target.value)}
                  />
                  <div className="option-content">
                    <strong>Chỉ Ban Quản trị (Admin)</strong>
                    <span>Ban Tổ chức - Kiểm tra Đoàn ĐHBK Hà Nội</span>
                  </div>
                </label>

                <label className={`target-option-card ${targetType === 'floor_lead' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="quorumTarget"
                    value="floor_lead"
                    checked={targetType === 'floor_lead'}
                    onChange={(e) => setTargetType(e.target.value)}
                  />
                  <div className="option-content">
                    <strong>Chỉ Phụ trách tầng</strong>
                    <span>Cán bộ phụ trách tầng {group?.name || ''}</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="quorum-notice-box">
              <AlertTriangle size={15} />
              <span>
                Khi gửi yêu cầu, một <b>Pop-up khẩn cấp</b> sẽ hiển thị trực tiếp trên màn hình của Quản trị viên/Phụ trách tầng. Bạn có thể gửi yêu cầu nhiều lần nếu sĩ số có thay đổi.
              </span>
            </div>
          </div>

          <div className="custom-modal-footer">
            <button
              type="button"
              className="custom-btn custom-btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="custom-btn custom-btn-warning"
              disabled={submitting || tot === 0}
            >
              <Send size={15} />
              {submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu phê duyệt khẩn cấp'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
