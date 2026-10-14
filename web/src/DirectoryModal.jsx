import { useState, useMemo } from 'react';
import { Search, Phone, PhoneCall, X, Building, Users, ExternalLink, ShieldCheck } from 'lucide-react';

function cleanPhone(raw) {
  if (!raw) return '';
  return String(raw).replace(/\D/g, '');
}

function formatPhoneDisplay(raw) {
  const clean = cleanPhone(raw);
  if (clean.length === 10) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
  }
  return clean;
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

export default function DirectoryModal({ open, contacts = [], onSelectOfficer, onClose }) {
  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('Tất cả');

  if (!open) return null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (selectedTeam !== 'Tất cả') {
        if (selectedTeam === 'Cộng tác viên K70/K71') {
          if (!c.team?.includes('Cộng tác viên') && c.position !== 'CTV') return false;
        } else if (!c.team?.toLowerCase().includes(selectedTeam.toLowerCase())) {
          return false;
        }
      }
      if (!q) return true;
      const matchName = c.name?.toLowerCase().includes(q);
      const matchPhone = c.phone?.replace(/\D/g, '').includes(q.replace(/\D/g, ''));
      const matchDept = c.department?.toLowerCase().includes(q);
      const matchPos = c.position?.toLowerCase().includes(q);
      const matchEmail = c.email?.toLowerCase().includes(q);
      return matchName || matchPhone || matchDept || matchPos || matchEmail;
    });
  }, [contacts, search, selectedTeam]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card directory-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="directory-header">
          <div className="directory-title-row">
            <div className="directory-title-box">
              <Users size={22} className="directory-header-icon" />
              <h2>Danh bạ Cán bộ Ban Tổ chức - Kiểm tra</h2>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng danh bạ">
              <X size={20} />
            </button>
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

          {filtered.length === 0 ? (
            <div className="directory-empty-state">
              <Users size={40} className="empty-icon" />
              <p>Không tìm thấy cán bộ nào khớp với nội dung tìm kiếm</p>
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
                      {officer.name ? officer.name.charAt(officer.name.lastIndexOf(' ') + 1) || officer.name.charAt(0) : 'U'}
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

                    <div className="doc-actions" onClick={(e) => e.stopPropagation()}>
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
