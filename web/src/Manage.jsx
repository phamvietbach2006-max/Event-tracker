import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Building2,
  Layers,
  Search,
  KeyRound,
  Link2,
  Trash2,
  Edit3,
  Check,
  Copy,
  X,
  Filter,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
} from 'lucide-react';
import { api } from './api.js';
import { UNITS, ROLES, parseGroupMeta, parseRoomMeta } from './logic.js';

export default function Manage({ state, me, say, toast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeModal, setActiveModal] = useState(null); // null | { type: 'add' | 'edit', user?: object }
  const [generatedLink, setGeneratedLink] = useState(null); // { name, url }
  const [linkCopied, setLinkCopied] = useState(false);

  // Load all users
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.users();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      say(e.message);
    } finally {
      setLoading(false);
    }
  }, [say]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    let admin = 0;
    let unit = 0;
    let floor = 0;
    let room = 0;
    for (const u of users) {
      const r = u.role || (u.isAdmin ? 'admin' : 'room_lead');
      if (r === 'admin') admin++;
      else if (r === 'unit_lead') unit++;
      else if (r === 'floor_lead') floor++;
      else if (r === 'room_lead') room++;
    }
    return { total, admin, unit, floor, room };
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return users.filter((u) => {
      const role = u.role || (u.isAdmin ? 'admin' : 'room_lead');
      if (roleFilter !== 'all' && role !== roleFilter) return false;
      if (!q) return true;
      const haystack = [
        u.name,
        u.email,
        u.team,
        u.position,
        u.department,
        u.student_id,
        ROLES[role]?.label,
        ...(u.assignedUnits || []),
      ].filter(Boolean).join(' ').toLowerCase();

      const matchText = haystack.includes(q);
      const phoneDigits = String(u.phone || '').replace(/\D/g, '');
      const matchPhone = qDigits ? phoneDigits.includes(qDigits) : false;

      return matchText || matchPhone;
    });
  }, [users, search, roleFilter]);

  // Quick action: Reset password
  const handleResetPassword = async (u) => {
    if (!confirm(`Bạn có chắc muốn đặt lại mật khẩu cho cán bộ "${u.name}" (${u.email}) về mặc định "Abc@123456767"?`)) return;
    try {
      const res = await api.resetUserPassword(u.email);
      say(res.message || `Đã đặt lại mật khẩu cho ${u.name} về Abc@123456767`);
    } catch (e) {
      say(`Lỗi đặt lại mật khẩu: ${e.message}`);
    }
  };

  // Quick action: Make quick login link
  const handleMakeLink = async (u) => {
    if (u.hasToken && !confirm(`Tạo link mới sẽ vô hiệu hóa link trước đó của cán bộ "${u.name}". Tiếp tục?`)) return;
    try {
      const res = await api.userLink(u.email);
      setGeneratedLink({ name: u.name, url: res.url });
      setLinkCopied(false);
    } catch (e) {
      say(`Lỗi tạo link: ${e.message}`);
    }
  };

  // Quick action: Delete user
  const handleDeleteUser = async (u) => {
    if (u.email.toLowerCase() === me?.email?.toLowerCase()) {
      say('Không thể tự xóa tài khoản của chính mình.');
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản cán bộ "${u.name}" (${u.email}) khỏi hệ thống? Thao tác này sẽ hủy mọi quyền phụ trách.`)) return;
    try {
      await api.delUser(u.email);
      say(`Đã xóa cán bộ ${u.name}`);
      loadUsers();
    } catch (e) {
      say(`Lỗi xóa cán bộ: ${e.message}`);
    }
  };

  return (
    <div className="manage-console">
      {/* ── TOP HEADER ── */}
      <div className="manage-header">
        <div className="manage-header-titles">
          <div className="manage-header-badge">
            <Shield size={14} /> Khu vực Quản trị viên
          </div>
          <h1 className="manage-title">Quản lý Cán bộ & Phân quyền Hệ thống</h1>
          <p className="manage-desc">
            Quản lý danh sách tài khoản cán bộ Ban TC-KT, phân cấp vai trò và giới hạn phạm vi hiển thị để cán bộ thao tác chính xác, không bị rối.
          </p>
        </div>
        <div className="manage-header-actions">
          <button
            type="button"
            className="btn-add-user"
            onClick={() => setActiveModal({ type: 'add' })}
          >
            <UserPlus size={16} />
            <span>Thêm Cán bộ Mới</span>
          </button>
        </div>
      </div>

      {/* ── ROLE STAT CARDS ── */}
      <div className="manage-stats-grid">
        <button
          type="button"
          className={`manage-stat-card ${roleFilter === 'all' ? 'active' : ''}`}
          onClick={() => setRoleFilter('all')}
        >
          <div className="stat-card-icon icon-all"><Users size={20} /></div>
          <div className="stat-card-body">
            <span className="stat-card-label">Tổng số Cán bộ</span>
            <strong className="stat-card-val">{stats.total}</strong>
          </div>
        </button>

        <button
          type="button"
          className={`manage-stat-card card-admin ${roleFilter === 'admin' ? 'active' : ''}`}
          onClick={() => setRoleFilter(roleFilter === 'admin' ? 'all' : 'admin')}
        >
          <div className="stat-card-icon icon-admin"><Shield size={20} /></div>
          <div className="stat-card-body">
            <span className="stat-card-label">Quản trị viên (Admin)</span>
            <strong className="stat-card-val">{stats.admin}</strong>
          </div>
        </button>

        <button
          type="button"
          className={`manage-stat-card card-unit ${roleFilter === 'unit_lead' ? 'active' : ''}`}
          onClick={() => setRoleFilter(roleFilter === 'unit_lead' ? 'all' : 'unit_lead')}
        >
          <div className="stat-card-icon icon-unit"><Building2 size={20} /></div>
          <div className="stat-card-body">
            <span className="stat-card-label">Phụ trách Đơn vị</span>
            <strong className="stat-card-val">{stats.unit}</strong>
          </div>
        </button>

        <button
          type="button"
          className={`manage-stat-card card-floor ${roleFilter === 'floor_lead' ? 'active' : ''}`}
          onClick={() => setRoleFilter(roleFilter === 'floor_lead' ? 'all' : 'floor_lead')}
        >
          <div className="stat-card-icon icon-floor"><Layers size={20} /></div>
          <div className="stat-card-body">
            <span className="stat-card-label">Phụ trách Tầng</span>
            <strong className="stat-card-val">{stats.floor}</strong>
          </div>
        </button>

        <button
          type="button"
          className={`manage-stat-card card-room ${roleFilter === 'room_lead' ? 'active' : ''}`}
          onClick={() => setRoleFilter(roleFilter === 'room_lead' ? 'all' : 'room_lead')}
        >
          <div className="stat-card-icon icon-room"><CheckCircle2 size={20} /></div>
          <div className="stat-card-body">
            <span className="stat-card-label">Kiểm tra Chi đoàn</span>
            <strong className="stat-card-val">{stats.room}</strong>
          </div>
        </button>
      </div>

      {/* ── TOOLBAR / SEARCH & FILTERS ── */}
      <div className="manage-toolbar">
        <div className="manage-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="search"
            placeholder="Tìm cán bộ theo tên, email, vai trò..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="clear-search-btn" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="manage-filter-group">
          <label className="manage-filter-label">
            <Filter size={14} />
            <span>Vai trò:</span>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">Tất cả vai trò ({users.length})</option>
              <option value="admin">Quản trị viên ({stats.admin})</option>
              <option value="unit_lead">Phụ trách Đơn vị ({stats.unit})</option>
              <option value="floor_lead">Phụ trách Tầng ({stats.floor})</option>
              <option value="room_lead">Kiểm tra Chi đoàn ({stats.room})</option>
            </select>
          </label>

          <button
            type="button"
            className="manage-refresh-btn"
            onClick={loadUsers}
            title="Tải lại danh sách"
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* ── USERS TABLE ── */}
      <div className="manage-table-container">
        <table className="manage-table">
          <thead>
            <tr>
              <th style={{ width: 50, textAlign: 'center' }}>STT</th>
              <th style={{ minWidth: 220 }}>Cán bộ</th>
              <th style={{ minWidth: 170 }}>Vai trò</th>
              <th style={{ minWidth: 320 }}>Phạm vi phụ trách</th>
              <th style={{ width: 220, textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="manage-empty-cell">
                  <div className="manage-empty-state">
                    <Users size={32} />
                    <p>Không tìm thấy tài khoản cán bộ nào phù hợp</p>
                    {search && (
                      <button type="button" onClick={() => setSearch('')} className="btn-text">
                        Xóa bộ lọc tìm kiếm
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredUsers.map((u, idx) => {
                const role = u.role || (u.isAdmin ? 'admin' : 'room_lead');
                const roleMeta = ROLES[role] || ROLES.room_lead;
                const isSelf = u.email.toLowerCase() === me?.email?.toLowerCase();

                return (
                  <tr key={u.email} className={isSelf ? 'is-self-row' : ''}>
                    <td style={{ textAlign: 'center' }} className="col-stt">
                      {idx + 1}
                    </td>
                    <td className="col-user">
                      <div className="user-profile-cell">
                        <span className={`user-avatar-tag role-avatar-${role}`}>
                          {u.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                        <div className="user-text">
                          <div className="user-name-line">
                            <strong className="user-fullname">{u.name}</strong>
                            {isSelf && <span className="self-pill">Bạn</span>}
                          </div>
                          <span className="user-email-line">{u.email}</span>
                          {(u.phone || u.team || u.position) && (
                            <div className="manage-user-chips">
                              {u.phone && (
                                <a
                                  href={`tel:${String(u.phone).replace(/\D/g, '')}`}
                                  className="manage-phone-chip"
                                  title={`Bấm để gọi: ${u.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Phone size={10} />
                                  <span>{u.phone}</span>
                                </a>
                              )}
                              {u.position && <span className="manage-pos-chip">{u.position}</span>}
                              {u.team && <span className="manage-team-chip">{u.team}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="col-role">
                      <span className={`role-badge role-badge-${role}`}>
                        {roleMeta.badge}
                      </span>
                    </td>
                    <td className="col-scope">
                      <ScopeTags user={u} role={role} groups={state.groups} />
                    </td>
                    <td className="col-actions">
                      <div className="action-btns-group">
                        <button
                          type="button"
                          className="btn-action btn-edit"
                          onClick={() => setActiveModal({ type: 'edit', user: u })}
                          title="Cấp quyền / Chỉnh sửa cán bộ này"
                        >
                          <Edit3 size={14} />
                          <span>Sửa quyền</span>
                        </button>

                        <button
                          type="button"
                          className="btn-action btn-key"
                          onClick={() => handleResetPassword(u)}
                          title="Đặt lại mật khẩu về mặc định (Abc@123456767)"
                        >
                          <KeyRound size={14} />
                        </button>

                        <button
                          type="button"
                          className="btn-action btn-link"
                          onClick={() => handleMakeLink(u)}
                          title={u.hasToken ? 'Tạo link đăng nhập nhanh mới' : 'Cấp link đăng nhập nhanh'}
                        >
                          <Link2 size={14} />
                        </button>

                        <button
                          type="button"
                          className="btn-action btn-del"
                          onClick={() => handleDeleteUser(u)}
                          disabled={isSelf}
                          title={isSelf ? 'Không thể tự xóa chính mình' : 'Xóa tài khoản cán bộ này'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── MODAL: GENERATED LINK ── */}
      {generatedLink && (
        <div className="manage-modal-backdrop" onClick={() => setGeneratedLink(null)}>
          <div className="manage-modal-card link-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Link đăng nhập nhanh: {generatedLink.name}</h3>
              <button type="button" className="modal-close" onClick={() => setGeneratedLink(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="link-note">
                Gửi link này cho cán bộ để đăng nhập trực tiếp mà không cần mật khẩu. <i>Lưu ý: Link này chỉ sử dụng được cho tài khoản này và đã vô hiệu hóa các link trước đó.</i>
              </p>
              <div className="link-copy-box">
                <input
                  type="text"
                  readOnly
                  value={generatedLink.url}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className={`copy-btn ${linkCopied ? 'copied' : ''}`}
                  onClick={() => {
                    navigator.clipboard?.writeText(generatedLink.url).then(() => {
                      setLinkCopied(true);
                      say('Đã sao chép link đăng nhập vào clipboard');
                    });
                  }}
                >
                  {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{linkCopied ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setGeneratedLink(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT USER & PERMISSIONS ── */}
      {activeModal && (
        <UserPermissionModal
          type={activeModal.type}
          user={activeModal.user}
          groups={state.groups}
          onClose={() => setActiveModal(null)}
          onSuccess={(msg) => {
            setActiveModal(null);
            say(msg);
            loadUsers();
          }}
        />
      )}

      {/* Toast */}
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}

// ── COMPONENT: SCOPE TAGS DISPLAY ──
function ScopeTags({ user, role, groups }) {
  if (role === 'admin') {
    return (
      <div className="scope-tags-wrap">
        <span className="scope-tag scope-tag-admin">
          <Shield size={12} /> Toàn bộ hệ thống (12 Đơn vị)
        </span>
      </div>
    );
  }

  if (role === 'unit_lead') {
    const units = user.assignedUnits || [];
    if (units.length === 0) {
      return <span className="scope-empty">Chưa phân công đơn vị nào</span>;
    }
    return (
      <div className="scope-tags-wrap">
        {units.map((u) => (
          <span key={u} className="scope-tag scope-tag-unit">
            <Building2 size={12} /> {u}
          </span>
        ))}
      </div>
    );
  }

  if (role === 'floor_lead') {
    const gids = user.assignedGroupIds || [];
    if (gids.length === 0) {
      return <span className="scope-empty">Chưa phân công tầng nào</span>;
    }
    const groupMap = new Map(groups.map((g) => [g.id, g.name]));
    return (
      <div className="scope-tags-wrap">
        {gids.map((gid) => {
          const gname = groupMap.get(gid) || `Tầng #${gid}`;
          return (
            <span key={gid} className="scope-tag scope-tag-floor">
              <Layers size={12} /> {gname}
            </span>
          );
        })}
      </div>
    );
  }

  if (role === 'room_lead') {
    const rids = user.assignedRoomIds || user.ownedRoomIds || [];
    if (rids.length === 0) {
      return <span className="scope-empty">Chưa phân công chi đoàn nào</span>;
    }
    // Lấy thông tin phòng
    const allRooms = groups.flatMap((g) => g.rooms);
    const roomMap = new Map(allRooms.map((r) => [r.id, r]));
    const matchedRooms = rids.map((id) => roomMap.get(id)).filter(Boolean);

    return (
      <div className="scope-room-summary">
        <span className="scope-count-badge">
          <b>{matchedRooms.length}</b> chi đoàn
        </span>
        <div className="scope-room-pills">
          {matchedRooms.slice(0, 3).map((r) => {
            const meta = parseRoomMeta(r.name);
            return (
              <span key={r.id} className="scope-room-pill" title={r.name}>
                {meta.className || r.name}
              </span>
            );
          })}
          {matchedRooms.length > 3 && (
            <span className="scope-more-pill">+{matchedRooms.length - 3} lớp khác</span>
          )}
        </div>
      </div>
    );
  }

  return <span className="scope-empty">Chưa phân công</span>;
}

// ── COMPONENT: USER & PERMISSION MODAL ──
function UserPermissionModal({ type, user, groups, onClose, onSuccess }) {
  const isEdit = type === 'edit';

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState(isEdit ? '' : 'Abc@123456767');
  const [role, setRole] = useState(user?.role || (user?.isAdmin ? 'admin' : 'room_lead'));
  const [phone, setPhone] = useState(user?.phone || '');
  const [team, setTeam] = useState(user?.team || '');
  const [position, setPosition] = useState(user?.position || '');
  const [department, setDepartment] = useState(user?.department || '');

  // Scope states
  const [selectedUnits, setSelectedUnits] = useState(new Set(user?.assignedUnits || []));
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set(user?.assignedGroupIds || []));
  const [selectedRoomIds, setSelectedRoomIds] = useState(new Set(user?.assignedRoomIds || user?.ownedRoomIds || []));

  // Filters for room lead selection in modal
  const [roomFilterUnit, setRoomFilterUnit] = useState('ALL');
  const [roomFilterSearch, setRoomFilterSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Units list
  const toggleUnit = (u) => {
    setSelectedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(u)) next.delete(u);
      else next.add(u);
      return next;
    });
  };

  const selectAllUnits = () => setSelectedUnits(new Set(UNITS));
  const deselectAllUnits = () => setSelectedUnits(new Set());

  // Floors list
  const toggleGroup = (gid) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };

  // Rooms list
  const toggleRoom = (rid) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(rid)) next.delete(rid);
      else next.add(rid);
      return next;
    });
  };

  // Filtered rooms for room_lead selector
  const availableRoomsToSelect = useMemo(() => {
    const q = roomFilterSearch.trim().toLowerCase();
    const result = [];
    for (const g of groups) {
      const { unit, floorName } = parseGroupMeta(g.name);
      if (roomFilterUnit !== 'ALL' && unit !== roomFilterUnit) continue;
      for (const r of g.rooms) {
        const meta = parseRoomMeta(r.name);
        if (q) {
          const textToMatch = `${g.name} ${r.name} ${meta.className} ${meta.roomCode} ${meta.kip}`.toLowerCase();
          if (!textToMatch.includes(q)) continue;
        }
        result.push({ group: g, room: r, unit, floorName, meta });
      }
    }
    return result;
  }, [groups, roomFilterUnit, roomFilterSearch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setFormError('Vui lòng nhập họ và tên cán bộ');
      return;
    }
    if (!cleanEmail) {
      setFormError('Vui lòng nhập địa chỉ email cán bộ');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: cleanName,
        role,
        phone: phone.trim() || null,
        team: team.trim() || null,
        position: position.trim() || null,
        department: department.trim() || null,
        assignedUnits: role === 'unit_lead' ? Array.from(selectedUnits) : [],
        assignedGroupIds: role === 'floor_lead' ? Array.from(selectedGroupIds).map(Number) : [],
        assignedRoomIds: role === 'room_lead' ? Array.from(selectedRoomIds).map(Number) : [],
      };

      if (password) {
        payload.password = password;
      }

      if (isEdit) {
        await api.patchUser(user.email, payload);
        onSuccess(`Đã cập nhật thông tin và phân quyền cho cán bộ "${cleanName}"`);
      } else {
        payload.email = cleanEmail;
        await api.addUser(payload);
        onSuccess(`Đã tạo tài khoản và phân quyền cho cán bộ "${cleanName}"`);
      }
    } catch (err) {
      setFormError(err.message || 'Có lỗi xảy ra khi lưu thông tin cán bộ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="manage-modal-backdrop" onClick={onClose}>
      <div className="manage-modal-card permission-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-text">
            <h3>{isEdit ? `Cấp quyền cán bộ: ${user.name}` : 'Thêm Cán bộ & Phân quyền Mới'}</h3>
            <p className="modal-subtitle">
              {isEdit ? 'Chỉnh sửa vai trò và phạm vi phụ trách' : 'Tạo tài khoản cán bộ và chỉ định nhiệm vụ'}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="permission-form">
          <div className="modal-body-scroll">
            {formError && (
              <div className="form-error-banner">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            {/* Thông tin cơ bản */}
            <div className="form-section">
              <h4 className="section-title">1. Thông tin tài khoản</h4>
              <div className="form-row-2">
                <label className="field-group">
                  <span className="field-label">Họ và tên <b className="req">*</b></span>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn A"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Email cán bộ <b className="req">*</b></span>
                  <input
                    type="email"
                    required
                    disabled={isEdit}
                    placeholder="VD: a.nguyen@hust.edu.vn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>

              <div className="form-row-2">
                <label className="field-group">
                  <span className="field-label">Số điện thoại</span>
                  <input
                    type="tel"
                    placeholder="VD: 0983849463"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Chức vụ / Vị trí</span>
                  <input
                    type="text"
                    placeholder="VD: Phó Ban / UV BTV / CTV..."
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  />
                </label>
              </div>

              <div className="form-row-2">
                <label className="field-group">
                  <span className="field-label">Mảng công tác / Ban bộ phận</span>
                  <input
                    type="text"
                    placeholder="VD: Ban Điều hành / Truyền thông..."
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Đơn vị / Trường - Khoa</span>
                  <input
                    type="text"
                    placeholder="VD: Trường CNTT&TT"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </label>
              </div>

              <label className="field-group">
                <span className="field-label">
                  {isEdit ? 'Đổi mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu khởi tạo'}
                </span>
                <input
                  type="text"
                  placeholder={isEdit ? 'Để trống nếu không muốn đổi mật khẩu' : 'Mặc định: Abc@123456767'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {!isEdit && (
                  <span className="field-hint">Mật khẩu mặc định hệ thống: <b>Abc@123456767</b></span>
                )}
              </label>
            </div>

            {/* Chọn vai trò */}
            <div className="form-section">
              <h4 className="section-title">2. Chọn vai trò & quyền hạn</h4>
              <div className="role-options-grid">
                {Object.values(ROLES).map((r) => {
                  const isChecked = role === r.id;
                  return (
                    <label
                      key={r.id}
                      className={`role-option-card role-card-${r.id} ${isChecked ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="user_role"
                        value={r.id}
                        checked={isChecked}
                        onChange={() => setRole(r.id)}
                      />
                      <div className="role-card-content">
                        <div className="role-card-header">
                          <strong className="role-name">{r.label}</strong>
                          <span className={`role-pill role-pill-${r.id}`}>{r.badge}</span>
                        </div>
                        <p className="role-desc">{r.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Phạm vi phân quyền động */}
            <div className="form-section">
              <h4 className="section-title">3. Phạm vi phân quyền hiển thị</h4>

              {/* 1. ADMIN */}
              {role === 'admin' && (
                <div className="scope-info-box admin-box">
                  <Shield size={20} />
                  <div>
                    <strong>Toàn quyền Quản trị viên</strong>
                    <p>Quản trị viên có quyền kiểm soát toàn bộ 12 Đơn vị, tất cả các tầng phòng và mọi chi đoàn trong hệ thống.</p>
                  </div>
                </div>
              )}

              {/* 2. CÁN BỘ PHỤ TRÁCH ĐƠN VỊ */}
              {role === 'unit_lead' && (
                <div className="scope-selector-wrap">
                  <div className="scope-selector-header">
                    <p className="scope-guide">
                      Chọn các Trường / Khoa / Viện mà cán bộ này phụ trách. <i>Khi đăng nhập, cán bộ chỉ nhìn thấy các đơn vị này để không bị rối:</i>
                    </p>
                    <div className="scope-quick-btns">
                      <button type="button" onClick={selectAllUnits}>Chọn tất cả ({UNITS.length})</button>
                      <button type="button" onClick={deselectAllUnits}>Bỏ chọn</button>
                    </div>
                  </div>

                  <div className="units-checkbox-grid">
                    {UNITS.map((u) => {
                      const checked = selectedUnits.has(u);
                      return (
                        <label key={u} className={`unit-checkbox-card ${checked ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleUnit(u)}
                          />
                          <span>{u}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="selected-summary">
                    Đã chọn <b>{selectedUnits.size}</b> / {UNITS.length} đơn vị
                  </div>
                </div>
              )}

              {/* 3. CÁN BỘ PHỤ TRÁCH TẦNG */}
              {role === 'floor_lead' && (
                <div className="scope-selector-wrap">
                  <p className="scope-guide">
                    Chọn các Tầng / Khu vực mà cán bộ phụ trách. <i>Cán bộ sẽ chỉ nhìn thấy các tầng được tích chọn dưới đây:</i>
                  </p>

                  <div className="floors-checkbox-list">
                    {groups.map((g) => {
                      const checked = selectedGroupIds.has(g.id);
                      const { unit, floorName } = parseGroupMeta(g.name);
                      return (
                        <label key={g.id} className={`floor-checkbox-row ${checked ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGroup(g.id)}
                          />
                          <div className="floor-row-info">
                            <span className="floor-row-unit">[{unit}]</span>
                            <strong className="floor-row-name">{floorName}</strong>
                            <span className="floor-row-count">{g.rooms.length} chi đoàn</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="selected-summary">
                    Đã chọn <b>{selectedGroupIds.size}</b> / {groups.length} tầng
                  </div>
                </div>
              )}

              {/* 4. CÁN BỘ KIỂM TRA CHI ĐOÀN */}
              {role === 'room_lead' && (
                <div className="scope-selector-wrap">
                  <p className="scope-guide">
                    Chọn các Chi đoàn mà cán bộ trực tiếp kiểm tra hồ sơ giấy tờ đại hội. <i>Khi đăng nhập, cán bộ chỉ thấy các chi đoàn này:</i>
                  </p>

                  <div className="room-selector-toolbar">
                    <select
                      value={roomFilterUnit}
                      onChange={(e) => setRoomFilterUnit(e.target.value)}
                      className="room-filter-unit-select"
                    >
                      <option value="ALL">Tất cả 12 Đơn vị</option>
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>

                    <div className="room-filter-search-box">
                      <Search size={14} />
                      <input
                        type="search"
                        placeholder="Tìm theo tên lớp (VD: CNTT 01, K71...)"
                        value={roomFilterSearch}
                        onChange={(e) => setRoomFilterSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="rooms-checkbox-grid">
                    {availableRoomsToSelect.length === 0 ? (
                      <div className="no-rooms-msg">Không có chi đoàn nào phù hợp bộ lọc</div>
                    ) : (
                      availableRoomsToSelect.map(({ group, room, unit, floorName, meta }) => {
                        const checked = selectedRoomIds.has(room.id);
                        return (
                          <label key={room.id} className={`room-checkbox-card ${checked ? 'checked' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRoom(room.id)}
                            />
                            <div className="room-card-body">
                              <div className="room-card-head">
                                <span className="room-kip-tag">{meta.kip || 'Kíp'}</span>
                                {meta.roomCode && <span className="room-code-tag">{meta.roomCode}</span>}
                              </div>
                              <strong className="room-class-name">{meta.className || room.name}</strong>
                              <span className="room-floor-hint">[{unit}] {floorName}</span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <div className="selected-summary">
                    Đã chọn <b>{selectedRoomIds.size}</b> chi đoàn phụ trách
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Đang lưu...' : isEdit ? 'Lưu Phân Quyền' : 'Tạo Tài Khoản & Phân Quyền'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
