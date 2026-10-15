import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertOctagon, Check, X, ShieldAlert, ArrowRight, User, Building, Clock } from 'lucide-react';
import { timeLabel } from './logic.js';

export default function EmergencyQuorumModal({
  requests = [],
  onClose,
  onDecide,
  me,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  if (!requests || requests.length === 0) return null;

  // Giới hạn index an toàn
  const activeReq = requests[Math.min(currentIndex, requests.length - 1)];
  if (!activeReq) return null;

  const att = Number(activeReq.attendees) || 0;
  const tot = Number(activeReq.total_members) || 0;
  const pct = tot > 0 ? Math.min(100, Math.round((att / tot) * 100)) : 0;
  const minRequired = tot > 0 ? Math.ceil((tot * 2) / 3) : 0;
  const deficit = Math.max(0, minRequired - att);

  const isAdmin = Boolean(me?.isAdmin || me?.role === 'admin');

  const handleAction = async (decision) => {
    setSubmitting(true);
    try {
      await onDecide?.(activeReq.id, decision);
      if (currentIndex < requests.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        onClose?.();
      }
    } catch {
      // lỗi đã hiển thị ở toast
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="custom-modal-backdrop emergency-modal-backdrop" role="presentation">
      <div
        className="custom-modal-card emergency-quorum-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="custom-modal-header emergency-header">
          <div className="custom-modal-icon-wrap emergency-icon">
            <AlertOctagon size={28} className="alert-icon-pulse" />
          </div>
          <div className="custom-modal-title-wrap">
            <div className="emergency-badge-strip">
              <span className="emergency-badge">🚨 YÊU CẦU PHÊ DUYỆT KHẨN CẤP</span>
              {requests.length > 1 && (
                <span className="emergency-counter">
                  Yêu cầu {currentIndex + 1} / {requests.length}
                </span>
              )}
            </div>
            <h3 className="custom-modal-title">Phê duyệt Ngoại lệ Sĩ số Đại hội</h3>
            <span className="custom-modal-subtitle">
              Chi đoàn: <b>{activeReq.room_name}</b> · {activeReq.group_name}
            </span>
          </div>
          <button
            type="button"
            className="custom-modal-close"
            onClick={onClose}
            aria-label="Đóng tạm thời"
          >
            <X size={18} />
          </button>
        </div>

        <div className="custom-modal-body">
          {/* Thông tin người gửi */}
          <div className="emergency-meta-grid">
            <div className="meta-item">
              <User size={16} />
              <div>
                <span className="meta-label">Người gửi yêu cầu:</span>
                <strong className="meta-val">{activeReq.sender_name}</strong>
                <small className="meta-sub">({activeReq.sender_role || 'Cán bộ trực lớp'})</small>
              </div>
            </div>
            <div className="meta-item">
              <Building size={16} />
              <div>
                <span className="meta-label">Địa điểm:</span>
                <strong className="meta-val">{activeReq.group_name}</strong>
              </div>
            </div>
            <div className="meta-item">
              <Clock size={16} />
              <div>
                <span className="meta-label">Thời gian gửi:</span>
                <strong className="meta-val">{timeLabel(activeReq.created_at)}</strong>
              </div>
            </div>
          </div>

          {/* Hộp thông tin Sĩ số thực tế */}
          <div className="emergency-attendance-panel">
            <div className="att-panel-main">
              <span className="att-panel-title">Sĩ số thực tế tại phòng:</span>
              <div className="att-panel-numbers">
                <span className="actual-count">{att}</span>
                <span className="divider">/</span>
                <span className="total-count">{tot}</span>
                <span className="ratio-tag">({pct}%)</span>
              </div>
            </div>
            <div className="att-panel-deficit">
              <span>⚠️ Thiếu <b>{deficit}</b> đoàn viên so với mốc 2/3 (Cần ≥ <b>{minRequired}</b> có mặt)</span>
            </div>
          </div>

          {/* Tình trạng phê duyệt từ cấp khác */}
          {activeReq.floor_decision && (
            <div className={`supervisor-decision-pill ${activeReq.floor_decision}`}>
              <span>
                Phụ trách tầng (<b>{activeReq.floor_decided_by || 'Trưởng tầng'}</b>):{' '}
                {activeReq.floor_decision === 'approved' ? '✓ ĐÃ ĐỒNG Ý cho tiến hành' : '❌ ĐÃ TỪ CHỐI'}
              </span>
            </div>
          )}

          {activeReq.admin_decision && (
            <div className={`supervisor-decision-pill ${activeReq.admin_decision}`}>
              <span>
                Ban Quản trị (<b>{activeReq.admin_decided_by || 'Admin'}</b>):{' '}
                {activeReq.admin_decision === 'approved' ? '✓ ĐÃ ĐỒNG Ý (Có hiệu lực)' : '❌ ĐÃ TỪ CHỐI'}
              </span>
            </div>
          )}

          {/* Câu hỏi quyết định */}
          <div className="emergency-decision-prompt">
            <h4>CÓ CHO PHÉP CHI ĐOÀN TIẾN HÀNH ĐẠI HỘI KHÔNG?</h4>
            <p className="prompt-explanation">
              {isAdmin ? (
                <span>
                  💡 <b>Quyền hạn Quản trị viên (Admin):</b> Quyết định của bạn có hiệu lực tối cao và ghi đè quyết định của Phụ trách tầng.
                </span>
              ) : (
                <span>
                  💡 <b>Quyền hạn Phụ trách tầng:</b> Quyết định của bạn có hiệu lực ngay cho chi đoàn thuộc tầng mình (trừ khi Ban Quản trị từ chối).
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="custom-modal-footer emergency-footer">
          <button
            type="button"
            className="custom-btn custom-btn-danger emergency-reject-btn"
            disabled={submitting}
            onClick={() => handleAction('rejected')}
          >
            <X size={18} />
            <span>KHÔNG ĐỒNG Ý</span>
            <small>(Giữ nguyên yêu cầu 2/3)</small>
          </button>

          <button
            type="button"
            className="custom-btn custom-btn-success emergency-approve-btn"
            disabled={submitting}
            onClick={() => handleAction('approved')}
          >
            <Check size={18} />
            <span>ĐỒNG Ý PHÊ DUYỆT</span>
            <small>(Gỡ bỏ yêu cầu 2/3)</small>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
