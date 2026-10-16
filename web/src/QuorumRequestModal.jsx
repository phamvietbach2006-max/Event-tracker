import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Send, X, ShieldAlert } from 'lucide-react';
import { parseRoomMeta } from './logic.js';
import { api } from './api.js';

export default function QuorumRequestModal({
  open,
  onClose,
  room,
  group,
  me,
  onSubmit,
}) {
  const [targetType, setTargetType] = useState('admin');
  const [selectedAdminEmail, setSelectedAdminEmail] = useState('');
  const [selectedFloorLeadEmail, setSelectedFloorLeadEmail] = useState('');
  const [targets, setTargets] = useState({ admins: [], floorLeads: [] });
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !room?.id) return;
    setLoadingTargets(true);
    api.quorumTargets(room.id)
      .then((data) => {
        const admins = data?.admins || [];
        const floorLeads = data?.floorLeads || [];
        setTargets({ admins, floorLeads });

        // Tự động chọn người đang online đầu tiên
        const onlineAdmin = admins.find((a) => a.isOnline) || admins[0];
        if (onlineAdmin) setSelectedAdminEmail(onlineAdmin.email);

        const onlineLead = floorLeads.find((l) => l.isOnline) || floorLeads[0];
        if (onlineLead) setSelectedFloorLeadEmail(onlineLead.email);

        // Ưu tiên chọn vai trò có người đang online
        if (!onlineAdmin?.isOnline && onlineLead?.isOnline) {
          setTargetType('floor_lead');
        } else {
          setTargetType('admin');
        }
      })
      .catch((err) => {
        console.warn('Không thể tải danh sách người duyệt:', err);
      })
      .finally(() => {
        setLoadingTargets(false);
      });
  }, [open, room?.id]);

  if (!open || !room) return null;

  const meta = parseRoomMeta(room.name);
  const att = Number(room.attendees) || 0;
  const tot = Number(room.totalMembers) || 0;
  const pct = tot > 0 ? Math.min(100, Math.round((att / tot) * 100)) : 0;
  const minRequired = tot > 0 ? Math.ceil((tot * 2) / 3) : 0;
  const deficit = Math.max(0, minRequired - att);

  const currentTargetEmail = targetType === 'admin' ? selectedAdminEmail : selectedFloorLeadEmail;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentTargetEmail && targetType === 'floor_lead' && targets.floorLeads.length === 0) {
      alert('Tầng này hiện chưa có Phụ trách tầng được phân công. Vui lòng chọn gửi cho 1 Admin.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit?.(room.id, targetType, currentTargetEmail, att, tot);
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
              Sĩ số hiện tại chưa đạt ngưỡng 2/3 theo quy định. Bạn hãy gửi yêu cầu xin phê duyệt khẩn cấp cho <b>1 người đang online</b> để tránh bị xung đột quyết định.
            </p>

            <div className="quorum-recipient-selector">
              <label className="field-label">Gửi yêu cầu phê duyệt đích danh cho 1 người:</label>
              <div className="target-options-grid">
                {/* 1. GỬI CHO 1 ADMIN ONLINE */}
                <label className={`target-option-card ${targetType === 'admin' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="quorumTarget"
                    value="admin"
                    checked={targetType === 'admin'}
                    onChange={() => setTargetType('admin')}
                  />
                  <div className="option-content" style={{ width: '100%' }}>
                    <strong>1 Quản trị viên (Admin) đang online</strong>
                    <span>Ban Tổ chức - Kiểm tra Đoàn ĐHBK Hà Nội (Quyền hạn tối cao)</span>
                    {targetType === 'admin' && (
                      <div style={{ marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                        <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                          Chọn 1 Admin nhận phê duyệt:
                        </label>
                        <select
                          className="target-user-select"
                          value={selectedAdminEmail}
                          onChange={(e) => setSelectedAdminEmail(e.target.value)}
                        >
                          {targets.admins.length === 0 && <option value="">Đang tải danh sách Admin...</option>}
                          {targets.admins.map((a) => (
                            <option key={a.email} value={a.email}>
                              {a.name} · {a.isOnline ? '🟢 Đang Online' : '⚪ Ngoại tuyến'} {a.phone ? `(${a.phone})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </label>

                {/* 2. GỬI CHO 1 PHỤ TRÁCH TẦNG ONLINE */}
                <label className={`target-option-card ${targetType === 'floor_lead' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="quorumTarget"
                    value="floor_lead"
                    checked={targetType === 'floor_lead'}
                    onChange={() => setTargetType('floor_lead')}
                  />
                  <div className="option-content" style={{ width: '100%' }}>
                    <strong>1 Cán bộ phụ trách tầng đang online</strong>
                    <span>Phụ trách khu vực {group?.name || ''}</span>
                    {targetType === 'floor_lead' && (
                      <div style={{ marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                        <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                          Chọn 1 Phụ trách tầng nhận phê duyệt:
                        </label>
                        {targets.floorLeads.length > 0 ? (
                          <select
                            className="target-user-select"
                            value={selectedFloorLeadEmail}
                            onChange={(e) => setSelectedFloorLeadEmail(e.target.value)}
                          >
                            {targets.floorLeads.map((fl) => (
                              <option key={fl.email} value={fl.email}>
                                {fl.name} · {fl.isOnline ? '🟢 Đang Online' : '⚪ Ngoại tuyến'} {fl.phone ? `(${fl.phone})` : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#b45309', padding: '4px 0' }}>
                            ⚠️ Chưa có Phụ trách tầng được phân công cho khu vực này. Bạn hãy chọn gửi cho 1 Admin ở trên.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="quorum-notice-box">
              <AlertTriangle size={15} />
              <span>
                Yêu cầu được gửi <b>đích danh cho đúng 1 người</b> để tránh xung đột. Người được chọn sẽ nhận ngay một <b>Pop-up khẩn cấp</b> trên màn hình để phê duyệt hoặc từ chối.
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
              disabled={submitting || tot === 0 || loadingTargets}
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
