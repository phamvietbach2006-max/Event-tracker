import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  FileSpreadsheet,
  Building2,
  Users,
  RotateCcw,
  CheckSquare,
  Square,
  ChevronRight,
  Eye,
  UserRound,
  PhoneCall,
} from 'lucide-react';
import {
  UNITS,
  KIPS,
  COHORTS,
  ST,
  ORDER,
  NEXT,
  parseGroupMeta,
  parseRoomMeta,
  doneCount,
  percent,
  timeLabel,
  patchRoom,
  patchTask,
  canEdit,
} from './logic.js';
import { api } from './api.js';

export default function OverviewTable({ state, me, act, onNavigate, onSelectUnit, onRequireLogin, say, onSelectOfficer }) {
  const handleBlockedAction = (room, actionName = 'chỉnh sửa') => {
    const meta = parseRoomMeta(room.name);
    if (!me) {
      onRequireLogin?.(`Vui lòng đăng nhập cán bộ kiểm tra để ${actionName} chi đoàn ${meta.className}`);
    } else {
      say?.(`Bạn chỉ có quyền cập nhật các chi đoàn được phân công phụ trách (${meta.className})`);
    }
  };

  // Filters
  const [unitFilter, setUnitFilter] = useState('all');
  const [kipFilter, setKipFilter] = useState('all');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [docFilter, setDocFilter] = useState('all'); // 'all', 'done', 'doing', 'empty'
  const [search, setSearch] = useState('');

  // Available units in the scoped dataset
  const availableUnits = useMemo(() => {
    const fromGroups = [...new Set((state?.groups ?? []).map((g) => parseGroupMeta(g.name).unit))].filter(Boolean);
    return fromGroups.length > 0 ? fromGroups : UNITS;
  }, [state]);

  // Auto-align unitFilter if unitFilter is not in availableUnits
  useState(() => {
    if (availableUnits.length === 1) {
      setUnitFilter(availableUnits[0]);
    }
  });

  // Sorting
  const [sortCol, setSortCol] = useState('stt'); // 'stt', 'className', 'roomCode', 'kip', 'status', 'progress'
  const [sortDir, setSortDir] = useState('asc'); // 'asc', 'desc'

  // Pagination / Page size
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Selected room for quick checklist modal
  const [inspectRoom, setInspectRoom] = useState(null);

  // Flatten all rooms across all groups with enriched metadata
  const allRows = useMemo(() => {
    let index = 1;
    const rows = [];
    for (const group of state?.groups ?? []) {
      const { unit, floorName } = parseGroupMeta(group.name);
      for (const room of group.rooms ?? []) {
        const meta = parseRoomMeta(room.name);
        const done = doneCount(room);
        const total = room.tasks.length;
        const pct = percent(room);
        rows.push({
          stt: index++,
          group,
          room,
          unit,
          floorName,
          meta,
          done,
          total,
          pct,
        });
      }
    }
    return rows;
  }, [state]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (unitFilter !== 'all' && r.unit !== unitFilter) return false;
      if (kipFilter !== 'all' && r.meta.kip !== kipFilter) return false;
      if (cohortFilter !== 'all' && r.meta.cohort !== cohortFilter) return false;
      if (statusFilter !== 'all' && r.room.status !== statusFilter) return false;

      if (docFilter === 'done' && r.pct < 100) return false;
      if (docFilter === 'doing' && (r.pct === 0 || r.pct === 100)) return false;
      if (docFilter === 'empty' && r.pct > 0) return false;

      if (!q) return true;
      const haystack = [
        r.unit,
        r.floorName,
        r.meta.className,
        r.meta.roomCode,
        r.meta.kipLabel,
        r.room.note,
        ...(r.room.owners ?? []).map((o) => (typeof o === 'string' ? o : o.name)),
        ...(r.room.tasks ?? []).map((t) => t.text),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [allRows, unitFilter, kipFilter, cohortFilter, statusFilter, docFilter, search]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'stt':
          cmp = a.stt - b.stt;
          break;
        case 'className':
          cmp = a.meta.className.localeCompare(b.meta.className, 'vi');
          break;
        case 'unit':
          cmp = a.unit.localeCompare(b.unit, 'vi');
          break;
        case 'roomCode':
          cmp = a.meta.roomCode.localeCompare(b.meta.roomCode, 'vi', { numeric: true });
          break;
        case 'kip':
          cmp = a.meta.kip.localeCompare(b.meta.kip, 'vi');
          break;
        case 'status': {
          const orderMap = { red: 0, yellow: 1, green: 2 };
          cmp = (orderMap[a.room.status] ?? 0) - (orderMap[b.room.status] ?? 0);
          break;
        }
        case 'progress':
          cmp = a.pct - b.pct;
          break;
        default:
          cmp = a.stt - b.stt;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRows, sortCol, sortDir]);

  // KPI Metrics (Calculated on current filtered view)
  const metrics = useMemo(() => {
    const total = filteredRows.length;
    let green = 0;
    let yellow = 0;
    let red = 0;
    let totalDocs = 0;
    let doneDocs = 0;

    for (const r of filteredRows) {
      if (r.room.status === 'green') green++;
      else if (r.room.status === 'yellow') yellow++;
      else red++;

      doneDocs += r.done;
      totalDocs += r.total;
    }

    const docPct = totalDocs ? Math.round((doneDocs / totalDocs) * 100) : 0;
    return { total, green, yellow, red, doneDocs, totalDocs, docPct };
  }, [filteredRows]);

  // Pagination slice
  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return sortedRows;
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(sortedRows.length / pageSize);

  const toggleSort = (col) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const handleStatusChange = (roomId, newStatus) => {
    act(
      (current) => patchRoom(current, roomId, { status: newStatus }),
      () => api.setStatus(roomId, newStatus)
    );
  };

  const handleTaskToggle = (task) => {
    const nextState = NEXT[task.state];
    act(
      (current) => patchTask(current, task.id, { state: nextState }),
      () => api.setTask(task.id, nextState)
    );
  };

  // Export to Excel function
  const handleExportExcel = () => {
    const dataToExport = sortedRows.map((r, idx) => ({
      STT: idx + 1,
      'Đơn vị': r.unit,
      'Kíp & Giờ': r.meta.kipLabel || r.meta.kip,
      'Phòng': r.meta.roomCode,
      'Tầng / Tòa': r.floorName,
      'Tên Chi đoàn': r.meta.className,
      'Khóa': r.meta.cohort || 'Khác',
      'Loại Đại hội': r.meta.congressType,
      'Trạng thái': ST[r.room.status] || r.room.status,
      'Tiến độ hồ sơ': `${r.done}/${r.total} (${r.pct}%)`,
      'Mục đã nộp': r.room.tasks.filter((t) => t.state === 'done').map((t) => t.text).join('; '),
      'Mục chưa nộp': r.room.tasks.filter((t) => t.state !== 'done').map((t) => t.text).join('; '),
      'Người phụ trách': (r.room.owners ?? [])
        .map((o) => (typeof o === 'string' ? o : o.name))
        .join(', '),
      'Ghi chú': r.room.note || '',
      'Cập nhật lúc': timeLabel(r.room.updated_at),
      'Cập nhật bởi': r.room.updated_by || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // STT
      { wch: 22 }, // Đơn vị
      { wch: 16 }, // Kíp
      { wch: 10 }, // Phòng
      { wch: 18 }, // Tầng
      { wch: 32 }, // Tên lớp
      { wch: 8 },  // Khóa
      { wch: 20 }, // Loại ĐH
      { wch: 18 }, // Trạng thái
      { wch: 16 }, // Tiến độ
      { wch: 45 }, // Mục đã nộp
      { wch: 45 }, // Mục chưa nộp
      { wch: 28 }, // Người phụ trách
      { wch: 30 }, // Ghi chú
      { wch: 18 }, // Cập nhật lúc
      { wch: 18 }, // Cập nhật bởi
    ];

    const wb = XLSX.utils.book_new();
    const sheetName = unitFilter === 'all' ? 'Tong_hop_toan_DH' : unitFilter.slice(0, 31).replace(/[\\/?*[\]]/g, '');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const nowStr = new Date().toISOString().slice(0, 10);
    const fileName = `[Ban_TC-KT]_Tong_hop_Dai_hoi_Chi_doan_${nowStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const resetFilters = () => {
    setUnitFilter('all');
    setKipFilter('all');
    setCohortFilter('all');
    setStatusFilter('all');
    setDocFilter('all');
    setSearch('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    unitFilter !== 'all' ||
    kipFilter !== 'all' ||
    cohortFilter !== 'all' ||
    statusFilter !== 'all' ||
    docFilter !== 'all' ||
    Boolean(search.trim());

  return (
    <div className="overview-table-container">
      {/* ── 1. HEADER & KPI METRICS ── */}
      <div className="overview-page-head">
        <div className="overview-title-section">
          <div className="overview-title-row">
            <span className="overview-badge">
              <FileSpreadsheet size={13} /> Dữ liệu trực tuyến
            </span>
            <span className="overview-unit-tag">
              {unitFilter === 'all' ? 'Tất cả 12 Đơn vị' : unitFilter}
            </span>
          </div>
          <h2 className="overview-heading">Bảng Tổng hợp Tiến độ Đại hội Chi đoàn</h2>
          <p className="overview-subtext">
            Theo dõi chi tiết tất cả các Chi đoàn, kíp tổ chức, phòng học, cán bộ kiểm tra và checklist giấy tờ theo thời gian thực.
          </p>
        </div>

        <div className="overview-actions-wrap">
          <button
            type="button"
            className="export-excel-btn"
            onClick={handleExportExcel}
            title="Tải bảng dữ liệu này về máy dạng file Excel (.xlsx)"
          >
            <Download size={16} />
            <span>Xuất file Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* ── KPI METRICS SUMMARY BAR ── */}
      <div className="overview-kpi-grid">
        <div className="kpi-card total-card">
          <div className="kpi-icon"><Building2 size={20} /></div>
          <div className="kpi-info">
            <span className="kpi-label">Tổng số Chi đoàn</span>
            <strong className="kpi-val">{metrics.total} <small>lớp</small></strong>
          </div>
        </div>

        <div className="kpi-card green-card">
          <div className="kpi-icon"><CheckCircle2 size={20} /></div>
          <div className="kpi-info">
            <span className="kpi-label">Đã tiến hành xong</span>
            <strong className="kpi-val">
              {metrics.green}{' '}
              <small>({metrics.total ? Math.round((metrics.green / metrics.total) * 100) : 0}%)</small>
            </strong>
          </div>
        </div>

        <div className="kpi-card yellow-card">
          <div className="kpi-icon"><Clock size={20} /></div>
          <div className="kpi-info">
            <span className="kpi-label">Đang tiến hành</span>
            <strong className="kpi-val">
              {metrics.yellow}{' '}
              <small>({metrics.total ? Math.round((metrics.yellow / metrics.total) * 100) : 0}%)</small>
            </strong>
          </div>
        </div>

        <div className="kpi-card red-card">
          <div className="kpi-icon"><AlertCircle size={20} /></div>
          <div className="kpi-info">
            <span className="kpi-label">Chưa tổ chức</span>
            <strong className="kpi-val">
              {metrics.red}{' '}
              <small>({metrics.total ? Math.round((metrics.red / metrics.total) * 100) : 0}%)</small>
            </strong>
          </div>
        </div>

        <div className="kpi-card doc-card">
          <div className="kpi-icon"><CheckSquare size={20} /></div>
          <div className="kpi-info">
            <span className="kpi-label">Tiến độ hồ sơ giấy tờ</span>
            <strong className="kpi-val">
              {metrics.doneDocs}/{metrics.totalDocs}{' '}
              <small className="kpi-pct-badge">({metrics.docPct}%)</small>
            </strong>
          </div>
        </div>
      </div>

      {/* ── 2. FILTER & SEARCH TOOLBAR ── */}
      <div className="overview-filter-panel">
        <div className="overview-filter-row">
          {/* Đơn vị */}
          <label className="ov-select-wrap" title="Lọc theo đơn vị">
            <span className="ov-label">Đơn vị:</span>
            <select
              value={unitFilter}
              onChange={(e) => {
                setUnitFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="ov-select"
            >
              <option value="all">
                {availableUnits.length > 1 ? `Tất cả ${availableUnits.length} đơn vị` : 'Đơn vị'}
              </option>
              {availableUnits.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>

          {/* Kíp */}
          <label className="ov-select-wrap" title="Lọc theo kíp tổ chức">
            <span className="ov-label">Kíp:</span>
            <select
              value={kipFilter}
              onChange={(e) => {
                setKipFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="ov-select"
            >
              {KIPS.map((k) => (
                <option key={k.id} value={k.id}>{k.label}</option>
              ))}
            </select>
          </label>

          {/* Khóa */}
          <label className="ov-select-wrap" title="Lọc theo khóa (K70 / K71)">
            <span className="ov-label">Khóa:</span>
            <select
              value={cohortFilter}
              onChange={(e) => {
                setCohortFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="ov-select"
            >
              {COHORTS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>

          {/* Trạng thái Đại hội */}
          <label className="ov-select-wrap" title="Lọc theo trạng thái tổ chức">
            <span className="ov-label">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="ov-select"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="red">🔴 Chưa tổ chức</option>
              <option value="yellow">🟡 Đang tiến hành</option>
              <option value="green">🟢 Đã tiến hành xong</option>
            </select>
          </label>

          {/* Hồ sơ */}
          <label className="ov-select-wrap" title="Lọc theo tiến độ giấy tờ">
            <span className="ov-label">Hồ sơ:</span>
            <select
              value={docFilter}
              onChange={(e) => {
                setDocFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="ov-select"
            >
              <option value="all">Tất cả tiến độ</option>
              <option value="done">☑ Đủ 100% hồ sơ</option>
              <option value="doing">◐ Đang kiểm (1-99%)</option>
              <option value="empty">☐ Chưa có mục nào (0%)</option>
            </select>
          </label>

          {/* Reset button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="ov-reset-btn"
              onClick={resetFilters}
              title="Xóa tất cả bộ lọc"
            >
              <RotateCcw size={14} /> Xóa lọc
            </button>
          )}
        </div>

        <div className="overview-search-row">
          <div className="ov-search-box">
            <Search size={16} className="ov-search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm kiếm theo tên Chi đoàn, phòng (D9-101), người phụ trách, ghi chú…"
              className="ov-search-input"
            />
            {search && (
              <button
                type="button"
                className="ov-search-clear"
                onClick={() => setSearch('')}
                aria-label="Xóa từ khóa"
              >
                ✕
              </button>
            )}
          </div>

          <div className="ov-row-count-badge">
            Hiển thị <b>{sortedRows.length}</b> / <b>{allRows.length}</b> lớp
          </div>
        </div>
      </div>

      {/* ── 3. DATA TABLE (EXCEL FORMAT) ── */}
      <div className="overview-table-wrapper">
        <table className="excel-table">
          <thead>
            <tr>
              <th className="th-stt" onClick={() => toggleSort('stt')}>
                <div className="th-cell">
                  <span>STT</span>
                  {sortCol === 'stt' ? (
                    sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} className="th-sort-icon-idle" />
                  )}
                </div>
              </th>

              <th className="th-unit" onClick={() => toggleSort('unit')}>
                <div className="th-cell">
                  <span>Đơn vị tổ chức</span>
                  {sortCol === 'unit' ? (
                    sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} className="th-sort-icon-idle" />
                  )}
                </div>
              </th>

              <th className="th-kip" onClick={() => toggleSort('kip')}>
                <div className="th-cell">
                  <span>Kíp & Giờ</span>
                  {sortCol === 'kip' ? (
                    sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} className="th-sort-icon-idle" />
                  )}
                </div>
              </th>

              <th className="th-room" onClick={() => toggleSort('roomCode')}>
                <div className="th-cell">
                  <span>Phòng</span>
                  {sortCol === 'roomCode' ? (
                    sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} className="th-sort-icon-idle" />
                  )}
                </div>
              </th>

              <th className="th-floor">Tầng / Tòa</th>

              <th className="th-class" onClick={() => toggleSort('className')}>
                <div className="th-cell">
                  <span>Tên Chi đoàn</span>
                  {sortCol === 'className' ? (
                    sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} className="th-sort-icon-idle" />
                  )}
                </div>
              </th>

              <th className="th-cohort">Khóa</th>

              <th className="th-status" onClick={() => toggleSort('status')}>
                <div className="th-cell">
                  <span>Trạng thái Đại hội</span>
                  {sortCol === 'status' ? (
                    sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} className="th-sort-icon-idle" />
                  )}
                </div>
              </th>

              <th className="th-progress" onClick={() => toggleSort('progress')}>
                <div className="th-cell">
                  <span>Tiến độ hồ sơ</span>
                  {sortCol === 'progress' ? (
                    sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={12} className="th-sort-icon-idle" />
                  )}
                </div>
              </th>

              <th className="th-checklist">Chi tiết các mục hồ sơ</th>

              <th className="th-owners">Người phụ trách</th>

              <th className="th-note">Ghi chú</th>

              <th className="th-actions">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={13} className="empty-table-cell">
                  <div className="empty-table-state">
                    <FileSpreadsheet size={40} className="empty-icon" />
                    <p className="empty-title">Không tìm thấy dữ liệu phù hợp</p>
                    <p className="empty-desc">
                      Vui lòng thử điều chỉnh hoặc xóa các bộ lọc để xem danh sách chi đoàn.
                    </p>
                    {hasActiveFilters && (
                      <button type="button" className="btn-secondary" onClick={resetFilters}>
                        <RotateCcw size={14} /> Xóa tất cả bộ lọc
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((r, rowIdx) => {
                const isEven = rowIdx % 2 === 0;
                const statusColor = r.room.status; // 'red', 'yellow', 'green'
                const canModify = canEdit(me, r.room);

                return (
                  <tr
                    key={r.room.id}
                    className={`excel-row ${isEven ? 'even' : 'odd'} status-row-${statusColor} ${!canModify ? 'is-read-only-row' : ''}`}
                  >
                    {/* STT */}
                    <td className="td-stt">{r.stt}</td>

                    {/* Đơn vị */}
                    <td className="td-unit">
                      <span className="unit-badge-pill" title={r.unit}>
                        {r.unit}
                      </span>
                    </td>

                    {/* Kíp */}
                    <td className="td-kip">
                      <span className="kip-badge-text">
                        {r.meta.kipLabel || r.meta.kip || '—'}
                      </span>
                    </td>

                    {/* Phòng */}
                    <td className="td-room">
                      <span className="room-code-badge">
                        {r.meta.roomCode || 'Phòng'}
                      </span>
                    </td>

                    {/* Tầng / Tòa */}
                    <td className="td-floor">{r.floorName}</td>

                    {/* Tên Chi đoàn */}
                    <td className="td-class">
                      <strong className="class-name-text">{r.meta.className}</strong>
                    </td>

                    {/* Khóa */}
                    <td className="td-cohort">
                      <span className={`cohort-tag ${r.meta.cohort === 'K71' ? 'k71' : 'k70'}`}>
                        {r.meta.cohort || '—'}
                      </span>
                    </td>

                    {/* Trạng thái Đại hội */}
                    <td
                      className="td-status"
                      onClickCapture={(e) => {
                        if (!canModify) {
                          e.stopPropagation();
                          handleBlockedAction(r.room, 'thay đổi trạng thái Đại hội của');
                        }
                      }}
                    >
                      {canModify ? (
                        <select
                          className={`status-select status-${statusColor}`}
                          value={statusColor}
                          onChange={(e) => handleStatusChange(r.room.id, e.target.value)}
                          aria-label={`Trạng thái lớp ${r.meta.className}`}
                        >
                          <option value="red">🔴 Chưa tổ chức</option>
                          <option value="yellow">🟡 Đang tiến hành</option>
                          <option value="green">🟢 Đã xong</option>
                        </select>
                      ) : (
                        <span
                          className={`status-pill-static status-${statusColor} read-only-clickable`}
                          title={!me ? "Nhấn để đăng nhập cán bộ và chỉnh sửa" : "Chỉ xem"}
                        >
                          {statusColor === 'green' ? '🟢 Đã xong' : statusColor === 'yellow' ? '🟡 Đang tiến hành' : '🔴 Chưa tổ chức'}
                        </span>
                      )}
                    </td>

                    {/* Tiến độ hồ sơ */}
                    <td className="td-progress">
                      <div className="progress-cell-wrap">
                        <div className="progress-text-row">
                          <span className="progress-fraction">
                            <b>{r.done}</b>/{r.total} mục
                          </span>
                          <span className={`progress-pct-badge ${r.pct === 100 ? 'done' : r.pct > 0 ? 'doing' : 'empty'}`}>
                            {r.pct}%
                          </span>
                        </div>
                        <div className="mini-progress-track">
                          <div
                            className={`mini-progress-fill ${r.pct === 100 ? 'fill-green' : r.pct > 0 ? 'fill-yellow' : 'fill-red'}`}
                            style={{ width: `${r.pct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Chi tiết Checklist từng mục */}
                    <td
                      className="td-checklist"
                      onClickCapture={(e) => {
                        if (!canModify) {
                          e.stopPropagation();
                          handleBlockedAction(r.room, 'đánh dấu hồ sơ giấy tờ của');
                        }
                      }}
                    >
                      <div className="checklist-chips-row">
                        {r.room.tasks.map((task, tIdx) => {
                          const isDone = task.state === 'done';
                          const isDoing = task.state === 'doing';
                          return (
                            <button
                              key={task.id}
                              type="button"
                              className={`task-chip-btn ${isDone ? 'is-done' : isDoing ? 'is-doing' : 'is-todo'} ${!canModify ? 'chip-readonly' : ''}`}
                              onClick={() => {
                                if (canModify) handleTaskToggle(task);
                              }}
                              title={`${task.text}: ${isDone ? 'Đã đủ' : isDoing ? 'Đang kiểm' : 'Chưa đủ'} ${canModify ? '(Click để chuyển)' : '(Chỉ xem)'}`}
                            >
                              <span className="task-chip-idx">{tIdx + 1}</span>
                              <span className="task-chip-icon">
                                {isDone ? '✓' : isDoing ? '◐' : '·'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    {/* Người phụ trách */}
                    <td className="td-owners">
                      {r.room.owners && r.room.owners.length > 0 ? (
                        <div className="owners-chips-wrap">
                          {r.room.owners.map((owner, oIdx) => {
                            const name = typeof owner === 'string' ? owner : owner.name;
                            const hasPhone = typeof owner === 'object' && Boolean(owner.phone);
                            return (
                              <button
                                key={oIdx}
                                type="button"
                                className="owner-chip clickable"
                                onClick={() => onSelectOfficer?.(owner)}
                                title={`Xem thông tin và gọi điện cho ${name}`}
                              >
                                <UserRound size={12} className="owner-chip-icon" />
                                <span>{name}</span>
                                {hasPhone && <PhoneCall size={11} className="chip-phone-icon" />}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Ghi chú */}
                    <td className="td-note">
                      {r.room.note ? (
                        <span className="note-preview-text" title={r.room.note}>
                          {r.room.note}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    {/* Thao tác */}
                    <td className="td-actions">
                      <div className="action-buttons-wrap">
                        <button
                          type="button"
                          className="table-action-btn view-btn"
                          onClick={() => setInspectRoom(r)}
                          title="Xem chi tiết danh mục hồ sơ của lớp này"
                        >
                          <Eye size={14} />
                          <span>Chi tiết</span>
                        </button>
                        <button
                          type="button"
                          className="table-action-btn goto-btn"
                          onClick={() => {
                            onSelectUnit(r.unit);
                            onNavigate('group', r.group.id);
                          }}
                          title="Đi tới tầng và phòng này trên Bảng theo dõi"
                        >
                          <ExternalLink size={14} />
                          <span>Bảng theo dõi</span>
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

      {/* ── 4. PAGINATION FOOTER ── */}
      {sortedRows.length > 0 && (
        <div className="overview-pagination-bar">
          <div className="page-size-selector">
            <span>Hiển thị mỗi trang:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="page-select-control"
            >
              <option value={25}>25 lớp</option>
              <option value={50}>50 lớp</option>
              <option value={100}>100 lớp</option>
              <option value={0}>Tất cả ({sortedRows.length} lớp)</option>
            </select>
          </div>

          <div className="pagination-controls">
            {pageSize > 0 && totalPages > 1 && (
              <>
                <button
                  type="button"
                  className="page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Trang trước
                </button>
                <span className="page-indicator">
                  Trang <b>{currentPage}</b> / {totalPages}
                </span>
                <button
                  type="button"
                  className="page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Trang sau
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 5. QUICK CHECKLIST INSPECT MODAL ── */}
      {inspectRoom && (
        <div className="modal-backdrop" onClick={() => setInspectRoom(null)}>
          <div className="modal-card modal-inspect-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="modal-kicker">{inspectRoom.unit.toUpperCase()} · {inspectRoom.floorName}</span>
                <h2>{inspectRoom.meta.className}</h2>
                <p className="inspect-sub">
                  {inspectRoom.meta.kipLabel || inspectRoom.meta.kip} · Phòng {inspectRoom.meta.roomCode} · {inspectRoom.meta.congressType}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setInspectRoom(null)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="inspect-modal-body">
              {/* Status switch */}
              <div
                className="inspect-status-row"
                onClickCapture={(e) => {
                  if (!canEdit(me, inspectRoom.room)) {
                    e.stopPropagation();
                    handleBlockedAction(inspectRoom.room, 'thay đổi trạng thái Đại hội của');
                  }
                }}
              >
                <span className="inspect-label">
                  Trạng thái Đại hội: {!canEdit(me, inspectRoom.room) && <small className="inspect-ro-tag">(Chỉ xem)</small>}
                </span>
                <div className="inspect-status-buttons">
                  {ORDER.map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={!canEdit(me, inspectRoom.room)}
                      className={`inspect-st-btn status-${st} ${inspectRoom.room.status === st ? 'active' : ''}`}
                      onClick={() => handleStatusChange(inspectRoom.room.id, st)}
                    >
                      {st === 'red' ? '🔴 Chưa tổ chức' : st === 'yellow' ? '🟡 Đang tiến hành' : '🟢 Đã xong'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checklist items */}
              <div
                className="inspect-tasks-section"
                onClickCapture={(e) => {
                  if (!canEdit(me, inspectRoom.room)) {
                    e.stopPropagation();
                    handleBlockedAction(inspectRoom.room, 'đánh dấu hồ sơ giấy tờ của');
                  }
                }}
              >
                <div className="inspect-tasks-head">
                  <strong>Danh mục hồ sơ giấy tờ ({inspectRoom.done}/{inspectRoom.total} mục đã đủ - {inspectRoom.pct}%)</strong>
                  <span className="inspect-note-hint">
                    {canEdit(me, inspectRoom.room) ? 'Nhấp vào từng mục để đổi trạng thái hoàn thành' : 'Chế độ chỉ xem'}
                  </span>
                </div>

                <div className="inspect-tasks-list">
                  {inspectRoom.room.tasks.map((task, tIdx) => {
                    const isDone = task.state === 'done';
                    const canEditThis = canEdit(me, inspectRoom.room);
                    return (
                      <div
                        key={task.id}
                        className={`inspect-task-item ${isDone ? 'done' : 'todo'} ${!canEditThis ? 'item-readonly' : ''}`}
                        onClick={() => {
                          if (canEditThis) handleTaskToggle(task);
                        }}
                      >
                        <div className="inspect-task-checkbox">
                          {isDone ? <CheckSquare size={18} className="icon-checked" /> : <Square size={18} className="icon-unchecked" />}
                        </div>
                        <span className="inspect-task-text">{task.text}</span>
                        <span className={`inspect-task-badge ${isDone ? 'done' : 'todo'}`}>
                          {isDone ? 'Đã đủ' : 'Chưa nộp'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Note preview if any */}
              {inspectRoom.room.note && (
                <div className="inspect-note-box">
                  <strong>Ghi chú kiểm tra:</strong>
                  <p>{inspectRoom.room.note}</p>
                </div>
              )}

              {/* Owners if any */}
              {inspectRoom.room.owners && inspectRoom.room.owners.length > 0 && (
                <div className="inspect-owners-box">
                  <strong>Cán bộ / Đại diện phụ trách (bấm để xem thông tin & gọi điện):</strong>
                  <div className="owners-chips-wrap">
                    {inspectRoom.room.owners.map((o, idx) => {
                      const name = typeof o === 'string' ? o : o.name;
                      const hasPhone = typeof o === 'object' && Boolean(o.phone);
                      return (
                        <button
                          key={idx}
                          type="button"
                          className="owner-chip clickable"
                          onClick={() => onSelectOfficer?.(o)}
                          title={`Xem thông tin và gọi điện cho ${name}`}
                        >
                          <UserRound size={12} className="owner-chip-icon" />
                          <span>{name}</span>
                          {hasPhone && <PhoneCall size={11} className="chip-phone-icon" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn-secondary"
                onClick={() => setInspectRoom(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="modal-btn-primary"
                onClick={() => {
                  onSelectUnit(inspectRoom.unit);
                  onNavigate('group', inspectRoom.group.id);
                  setInspectRoom(null);
                }}
              >
                <ExternalLink size={15} /> Mở trên Bảng theo dõi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
