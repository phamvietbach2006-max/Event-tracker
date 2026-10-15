import { useState } from 'react';
import { PhoneCall, Phone, Mail, Copy, Check, X, Shield, Building, GraduationCap, MessageSquare, ExternalLink, User } from 'lucide-react';

function cleanPhone(raw) {
  if (!raw) return '';
  let clean = String(raw).trim().replace(/[^\d+]/g, '');
  if (clean.startsWith('84') && !clean.startsWith('+84') && clean.length > 9) {
    clean = '0' + clean.slice(2);
  }
  const digits = clean.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 11) return '';
  return clean;
}

function formatPhoneDisplay(raw) {
  const digits = cleanPhone(raw).replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return digits || raw;
}

function getInitials(name) {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'U';
  const last = parts[parts.length - 1];
  return last.charAt(0).toUpperCase() || 'U';
}

export default function OfficerModal({ officer, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!officer) return null;

  const phone = cleanPhone(officer.phone);
  const displayPhone = formatPhoneDisplay(phone);
  const zaloNumber = phone.startsWith('+84') ? '0' + phone.slice(3) : (phone.startsWith('84') ? '0' + phone.slice(2) : phone);

  const handleCopy = async () => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback nếu clipboard API bị chặn
      const el = document.createElement('textarea');
      el.value = phone;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTeamColor = (team = '') => {
    if (team.includes('Điều hành')) return 'executive';
    if (team.includes('Tổ chức')) return 'doanvu';
    if (team.includes('Giám sát')) return 'giamsat';
    if (team.includes('Đảng')) return 'dang-cds';
    if (team.includes('Truyền thông')) return 'truyenthong';
    return 'ctv';
  };

  const teamClass = getTeamColor(officer.team);

  return (
    <div className="modal-backdrop officer-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card officer-card-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng cửa sổ">
          <X size={20} />
        </button>

        <div className={`officer-modal-header ${teamClass}`}>
          <div className="officer-avatar-circle">
            {getInitials(officer.name)}
          </div>
          <div className="officer-header-text">
            <h2 className="officer-name">{officer.name}</h2>
            <div className="officer-badge-row">
              {officer.position && <span className="officer-pos-badge">{officer.position}</span>}
              {officer.team && <span className={`officer-team-badge ${teamClass}`}>{officer.team}</span>}
            </div>
          </div>
        </div>

        <div className="officer-modal-body">
          {phone ? (
            <div className="officer-phone-hero">
              <div className="officer-phone-label">Số điện thoại liên hệ</div>
              <a href={`tel:${phone}`} className="officer-phone-number-link" title="Bấm để gọi điện ngay">
                <PhoneCall size={22} className="phone-pulse-icon" />
                <span>{displayPhone}</span>
              </a>
              <div className="officer-phone-actions">
                <a
                  href={`tel:${phone}`}
                  className="officer-action-btn primary-call-btn"
                  title="Bấm gọi ngay trên thiết bị di động"
                >
                  <PhoneCall size={18} />
                  <span>Gọi điện ngay</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="officer-action-btn secondary-btn"
                  title="Sao chép số điện thoại vào bộ nhớ tạm"
                >
                  {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
                  <span>{copied ? 'Đã sao chép!' : 'Sao chép số'}</span>
                </button>
                <a
                  href={`https://zalo.me/${zaloNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="officer-action-btn zalo-btn"
                  title="Mở nhắn tin Zalo với cán bộ"
                >
                  <MessageSquare size={18} />
                  <span>Zalo</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="officer-no-phone-banner">
              <Phone size={20} />
              <span>Chưa cập nhật số điện thoại cá nhân</span>
            </div>
          )}

          <div className="officer-details-grid">
            {officer.department && (
              <div className="officer-detail-item">
                <Building size={16} className="detail-icon" />
                <div className="detail-content">
                  <span className="detail-label">Đơn vị / Trường - Khoa</span>
                  <span className="detail-val">{officer.department}</span>
                </div>
              </div>
            )}

            {officer.email && (
              <div className="officer-detail-item">
                <Mail size={16} className="detail-icon" />
                <div className="detail-content">
                  <span className="detail-label">Email SIS / HUST</span>
                  <a href={`mailto:${officer.email}`} className="detail-val email-link">
                    {officer.email}
                    <ExternalLink size={12} className="link-ext-icon" />
                  </a>
                </div>
              </div>
            )}

            {(officer.cohort || officer.student_id) && (
              <div className="officer-detail-item">
                <GraduationCap size={16} className="detail-icon" />
                <div className="detail-content">
                  <span className="detail-label">Thông tin sinh viên</span>
                  <span className="detail-val">
                    {officer.cohort ? `Khóa ${officer.cohort}` : ''}
                    {officer.student_id ? ` • MSSV: ${officer.student_id}` : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
