import { useState, useEffect, useCallback, useTransition } from 'react';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Lock,
  Unlock,
  AlertOctagon,
  CheckSquare,
  Users,
  FileText,
  Activity,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Building2,
  Clock,
  User,
  MapPin,
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

function ActionBadge({ action }) {
  switch (action) {
    case 'room.lock':
      return (
        <span className="log-badge badge-lock">
          <Lock size={12} /> Lưu & Khóa lớp
        </span>
      );
    case 'room.unlock':
      return (
        <span className="log-badge badge-unlock">
          <Unlock size={12} /> Mở khóa sửa
        </span>
      );
    case 'room.cancel':
      return (
        <span className="log-badge badge-cancel">
          <AlertOctagon size={12} /> Hủy đại hội
        </span>
      );
    case 'room.status':
      return (
        <span className="log-badge badge-status">
          <Activity size={12} /> Trạng thái
        </span>
      );
    case 'room.attendance':
      return (
        <span className="log-badge badge-attendance">
          <Users size={12} /> Điểm danh sĩ số
        </span>
      );
    case 'room.note':
      return (
        <span className="log-badge badge-note">
          <FileText size={12} /> Ghi chú
        </span>
      );
    case 'task.update':
    case 'task.add':
    case 'task.delete':
      return (
        <span className="log-badge badge-task">
          <CheckSquare size={12} /> Checklist
        </span>
      );
    case 'auth.login':
      return (
        <span className="log-badge badge-auth">
          <LogIn size={12} /> Đăng nhập
        </span>
      );
    case 'auth.logout':
      return (
        <span className="log-badge badge-auth">
          <LogOut size={12} /> Đăng xuất
        </span>
      );
    default:
      return <span className="log-badge badge-default">{action}</span>;
  }
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

export default function LogsView() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [, startTransition] = useTransition();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit,
        offset,
      };
      if (search.trim()) params.q = search.trim();
      if (actionFilter !== 'all') params.action = actionFilter;

      const res = await api.logs(params);
      startTransition(() => {
        setLogs(res.logs || []);
        setTotal(res.total || 0);
      });
    } catch (err) {
      setError(err.message || 'Không thể tải nhật ký hoạt động');
    } finally {
      setLoading(false);
    }
  }, [limit, offset, search, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setOffset(0);
    fetchLogs();
  };

  const handleActionChange = (act) => {
    setActionFilter(act);
    setOffset(0);
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="logs-view-container">
      {/* ── HEADER ── */}
      <div className="logs-page-head">
        <div className="logs-title-wrap">
          <div className="logs-badge-row">
            <span className="logs-header-badge">
              <History size={14} /> Nhật ký kiểm toán (Audit Logs)
            </span>
            <span className="logs-count-badge">Tổng {total} bản ghi</span>
          </div>
          <h2 className="logs-heading">Nhật ký Hoạt động Toàn Hệ thống</h2>
          <p className="logs-subtext">
            Theo dõi chi tiết theo thời gian thực: Ai thao tác, lúc mấy giờ, ở vị trí lớp / phòng / tầng / đơn vị nào và nội dung thay đổi.
          </p>
        </div>

        <div className="logs-actions-wrap">
          <button
            type="button"
            className="logs-refresh-btn"
            onClick={fetchLogs}
            disabled={loading}
            title="Làm mới nhật ký hoạt động"
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* ── TOOLBAR BỘ LỌC & TÌM KIẾM ── */}
      <div className="logs-toolbar-card">
        <form className="logs-search-form" onSubmit={handleSearchSubmit}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="logs-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên cán bộ, email, tên lớp, vị trí hoặc nội dung thao tác..."
          />
          {search && (
            <button
              type="button"
              className="logs-search-clear"
              onClick={() => {
                setSearch('');
                setOffset(0);
              }}
            >
              ×
            </button>
          )}
          <button type="submit" className="logs-search-submit">
            Tìm kiếm
          </button>
        </form>

        <div className="logs-filter-group">
          <label className="logs-filter-label" htmlFor="logs-action-select">
            <Filter size={14} /> Loại hành động:
          </label>
          <select
            id="logs-action-select"
            className="logs-filter-select"
            value={actionFilter}
            onChange={(e) => handleActionChange(e.target.value)}
          >
            <option value="all">Tất cả hành động</option>
            <option value="room.lock">🔒 Lưu & Khóa kết quả</option>
            <option value="room.unlock">🔓 Mở khóa cho phép sửa</option>
            <option value="room.cancel">❌ Hủy đại hội (kèm lý do)</option>
            <option value="room.status">🔄 Cập nhật trạng thái</option>
            <option value="room.attendance">👥 Điểm danh sĩ số</option>
            <option value="room.note">📝 Ghi chú kiểm tra</option>
            <option value="task.update">☑ Đánh dấu checklist</option>
            <option value="task.add">➕ Thêm mục checklist</option>
            <option value="task.delete">🗑️ Xóa mục checklist</option>
            <option value="auth.login">🔑 Đăng nhập hệ thống</option>
            <option value="auth.logout">🚪 Đăng xuất</option>
          </select>
        </div>
      </div>

      {/* ── BẢNG NHẬT KÝ CHI TIẾT (DESKTOP) ── */}
      <div className="logs-desktop-table">
        <div className="logs-table-wrapper">
          {error && (
            <div className="logs-error-banner">
              <ShieldAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          <table className="logs-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>STT</th>
                <th style={{ width: '190px' }}>Thời gian</th>
                <th style={{ width: '220px' }}>Cán bộ thao tác</th>
                <th style={{ width: '260px' }}>Vị trí kiểm tra</th>
                <th style={{ width: '160px' }}>Hành động</th>
                <th>Chi tiết nội dung thay đổi</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => {
                const rowNum = offset + index + 1;
                return (
                  <tr key={log.id} className="log-row">
                    {/* STT */}
                    <td className="log-cell-stt">{rowNum}</td>

                    {/* Thời gian */}
                    <td className="log-cell-time">
                      <div className="time-primary">
                        <Clock size={13} className="time-icon" />
                        <span>{formatVnTime(log.ts)}</span>
                      </div>
                      <span className="time-ago">{timeAgo(log.ts)}</span>
                    </td>

                    {/* Cán bộ */}
                    <td className="log-cell-user">
                      <div className="user-name-row">
                        <User size={13} />
                        <strong className="user-name">{log.userName}</strong>
                        <RoleBadge role={log.userRole} />
                      </div>
                      <span className="user-email">{log.email || 'Hệ thống'}</span>
                    </td>

                    {/* Vị trí */}
                    <td className="log-cell-loc">
                      {log.roomName ? (
                        <div className="loc-wrap">
                          <strong className="loc-class">{log.roomName}</strong>
                          <span className="loc-floor">
                            {log.unit ? `${log.unit} · ` : ''}
                            {log.floorName || ''}
                          </span>
                        </div>
                      ) : (
                        <div className="loc-system">
                          <Building2 size={13} />
                          <span>{log.location}</span>
                        </div>
                      )}
                    </td>

                    {/* Loại hành động */}
                    <td className="log-cell-action">
                      <ActionBadge action={log.action} />
                    </td>

                    {/* Chi tiết nội dung */}
                    <td className="log-cell-detail">
                      <div className="detail-bubble">
                        {log.detail || '—'}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="logs-empty-cell">
                    <div className="logs-empty-state">
                      <History size={32} />
                      <p>Không có nhật ký nào phù hợp với bộ lọc tìm kiếm.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DANH SÁCH DẠNG THẺ (MOBILE FEED) ── */}
      <div className="logs-mobile-list" role="feed" aria-label="Nhật ký hoạt động trên thiết bị di động">
        {error && (
          <div className="logs-error-banner" style={{ borderRadius: '10px' }}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {logs.map((log, index) => {
          const rowNum = offset + index + 1;
          return (
            <article key={`mob-${log.id}`} className="log-card">
              {/* Header: Action badge & STT & Time */}
              <div className="log-card-header">
                <div className="log-card-head-left">
                  <span className="log-card-stt">#{rowNum}</span>
                  <ActionBadge action={log.action} />
                </div>
                <span className="log-card-time-ago">{timeAgo(log.ts)}</span>
              </div>

              {/* User row */}
              <div className="log-card-user">
                <div className="log-user-icon-box">
                  <User size={13} />
                </div>
                <div className="log-user-details">
                  <div className="log-user-primary">
                    <strong className="user-name">{log.userName}</strong>
                    <RoleBadge role={log.userRole} />
                  </div>
                  <span className="user-email">{log.email || 'Hệ thống'}</span>
                </div>
              </div>

              {/* Location */}
              <div className="log-card-location">
                <MapPin size={14} className="log-loc-icon" />
                <div className="log-loc-info">
                  {log.roomName ? (
                    <>
                      <strong className="log-loc-class">{log.roomName}</strong>
                      <span className="log-loc-floor">
                        {log.unit ? `${log.unit} · ` : ''}
                        {log.floorName || ''}
                      </span>
                    </>
                  ) : (
                    <span className="log-loc-system">{log.location}</span>
                  )}
                </div>
              </div>

              {/* Detail change bubble */}
              <div className="log-card-detail">
                <div className="detail-bubble">
                  {log.detail || '—'}
                </div>
              </div>

              {/* Timestamp at bottom */}
              <div className="log-card-footer">
                <Clock size={11} className="time-icon" />
                <span>{formatVnTime(log.ts)}</span>
              </div>
            </article>
          );
        })}

        {!loading && logs.length === 0 && (
          <div className="logs-mobile-empty">
            <History size={32} />
            <p>Không có nhật ký nào phù hợp với bộ lọc tìm kiếm.</p>
          </div>
        )}
      </div>

      {/* ── PHÂN TRANG ── */}
      <div className="logs-pagination">
        <span className="pagination-info">
          Hiển thị <b>{logs.length > 0 ? offset + 1 : 0}</b> -{' '}
          <b>{Math.min(offset + limit, total)}</b> trên tổng số <b>{total}</b> thao tác
        </span>
        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-btn"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            <ChevronLeft size={16} /> Trang trước
          </button>
          <span className="pagination-pages">
            Trang <b>{currentPage}</b> / <b>{totalPages}</b>
          </span>
          <button
            type="button"
            className="pagination-btn"
            disabled={offset + limit >= total || loading}
            onClick={() => setOffset(offset + limit)}
          >
            Trang sau <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
