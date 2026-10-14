import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Phone, PhoneCall, X, Building, Users, RefreshCw } from 'lucide-react';
import { api } from './api.js';

function cleanPhone(raw) {
  if (!raw) return '';
  let clean = String(raw).trim().replace(/[^\d+]/g, '');
  if (clean.startsWith('84') && !clean.startsWith('+84') && clean.length > 9) {
    clean = '0' + clean.slice(2);
  }
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

const TEAMS = [
  'Tất cả',
  'Ban Điều hành',
  'Tổ chức & Phát triển Đoàn vụ',
  'Giám sát, Kiểm tra & ĐRL',
  'Phát triển Đảng & CĐS',
  'Truyền thông, Sự kiện & PTNB',
  'Cộng tác viên K70/K71',
];

export default function DirectoryModal({ open, contacts = [], onSelectOfficer, onClose, onRefreshContacts }) {
  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('Tất cả');
  const [loading, setLoading] = useState(false);
  const [localContacts, setLocalContacts] = useState(contacts);

  useEffect(() => {
    if (contacts && contacts.length > 0) {
      setLocalContacts(contacts);
    }
  }, [contacts]);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.contacts();
      if (Array.isArray(data)) {
        setLocalContacts(data);
        onRefreshContacts?.(data);
      }
    } catch (e) {
      console.warn('Lỗi tải danh bạ:', e);
    } finally {
      setLoading(false);
    }
  }, [onRefreshContacts]);

  useEffect(() => {
    if (open && (!localContacts || localContacts.length === 0)) {
      loadContacts();
    }
  }, [open, localContacts, loadContacts]);

  const filtered = useMemo(() => {
    const list = Array.isArray(localContacts) ? localContacts : [];
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');

    return list.filter((c) => {
      if (!c) return false;
      if (selectedTeam !== 'Tất cả') {
        const teamStr = String(c.team || '').toLowerCase();
        if (selectedTeam === 'Cộng tác viên K70/K71') {
          if (!teamStr.includes('cộng tác viên') && c.position !== 'CTV') return false;
        } else if (!teamStr.includes(selectedTeam.toLowerCase())) {
          return false;
        }
      }
      if (!q) return true;

      const matchName = String(c.name || '').toLowerCase().includes(q);
      const phoneDigits = String(c.phone || '').replace(/\D/g, '');
      const matchPhone = qDigits ? phoneDigits.includes(qDigits) : false;
      const matchDept = String(c.department || '').toLowerCase().includes(q);
      const matchPos = String(c.position || '').toLowerCase().includes(q);
      const matchEmail = String(c.email || '').toLowerCase().includes(q);
      const matchStudentId = String(c.student_id || '').toLowerCase().includes(q);

      return matchName || matchPhone || matchDept || matchPos || matchEmail || matchStudentId;
    });
  }, [localContacts, search, selectedTeam]);

  if (!open) return null;

  return (
    <div className="modal-backdrop directory-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card directory-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="directory-header">
          <div className="directory-title-row">
            <div className="directory-title-box">
              <Users size={22} className="directory-header-icon" />
              <h2>Danh bạ Cán bộ Ban Tổ chức - Kiểm tra</h2>
            </div>
            <div className="directory-header-actions">
              <button
                type="button"
                className="directory-refresh-btn"
                onClick={loadContacts}
                title="Tải lại danh bạ"
              >
                <RefreshCw size={15} className={loading ? 'spinning' : ''} />
              </button>
              <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng danh bạ">
                <X size={20} />
              </button>
            </div>
          </div>
          <p className="directory-subtitle">
            Danh sách nhân sự, chức vụ và số điện thoại liên lạc trực tiếp các mảng công tác
          </p>

          {/* Search bar */}
          <div className="directory-search-wrap">
            <Search size={16} className="directory-search-icon" />
            <input
              type="text"
              className="directory-search-input"
              placeholder="Tìm theo tên cán bộ, số điện thoại, trường/khoa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button type="button" className="clear-search-btn" onClick={() => setSearch('')}>
                <X size={15} />
              </button>
            )}
          </div>

          {/* Team filter tabs */}
          <div className="directory-teams-tabs" role="tablist">
            {TEAMS.map((t) => (
              <button
                key={t}
                type="button"
                className={`directory-team-tab ${selectedTeam === t ? 'active' : ''}`}
                onClick={() => setSelectedTeam(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="directory-body">
          <div className="directory-count-bar">
            <span>Hiển thị <b>{filtered.length}</b> cán bộ</span>
          </div>

          {loading && (!localContacts || localContacts.length === 0) ? (
            <div className="directory-loading-state">
              <RefreshCw size={32} className="spinning directory-loading-spinner" />
              <p>Đang tải danh bạ cán bộ Ban TC-KT...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="directory-empty-state">
              <Users size={40} className="empty-icon" />
              <p>Không tìm thấy cán bộ nào khớp với nội dung tìm kiếm</p>
              {(search || selectedTeam !== 'Tất cả') && (
                <button
                  type="button"
                  className="btn-clear-filter"
                  onClick={() => { setSearch(''); setSelectedTeam('Tất cả'); }}
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div className="directory-grid">
              {filtered.map((officer, idx) => {
                const phone = cleanPhone(officer.phone);
                const displayPhone = formatPhoneDisplay(phone);
                const isExec = officer.team?.includes('Điều hành');

                return (
                  <div
                    key={officer.email || idx}
                    className={`directory-officer-card ${isExec ? 'is-exec' : ''}`}
                    onClick={() => onSelectOfficer(officer)}
                  >
                    <div className="doc-avatar">
                      {getInitials(officer.name)}
                    </div>
                    <div className="doc-content">
                      <div className="doc-name-row">
                        <strong className="doc-name">{officer.name}</strong>
                        {officer.position && (
                          <span className={`doc-pos-tag ${isExec ? 'exec-pos' : ''}`}>
                            {officer.position}
                          </span>
                        )}
                      </div>
                      <div className="doc-team">{officer.team || 'Cán bộ Ban TC-KT'}</div>
                      {officer.department && (
                        <div className="doc-dept">
                          <Building size={12} />
                          <span>{officer.department}</span>
                        </div>
                      )}
                    </div>

                    <div
                      className="doc-actions"
                      onClick={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                    >
                      {phone ? (
                        <a
                          href={`tel:${phone}`}
                          className="doc-call-action-btn"
                          title={`Gọi ngay cho ${officer.name}: ${displayPhone}`}
                        >
                          <PhoneCall size={16} />
                          <span className="doc-phone-text">{displayPhone}</span>
                        </a>
                      ) : (
                        <span className="doc-no-phone">Chưa có SĐT</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="directory-footer">
          <button type="button" className="officer-close-btn" onClick={onClose}>
            Đóng danh bạ
          </button>
        </div>
      </div>
    </div>
  );
}
