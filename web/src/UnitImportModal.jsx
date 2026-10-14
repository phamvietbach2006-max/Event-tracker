import { useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, PlusCircle, Upload, X, CheckCircle2 } from 'lucide-react';
import { api } from './api.js';
import { UNITS, TASKS_K71, TASKS_K70, floorFromRoomCode, parseGroupMeta } from './logic.js';

function parseSheetToGroups(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  // Find header row containing 'STT' and 'Lớp'
  let headerRowIdx = -1;
  let colKip = 2;
  let colRoom = 3;
  let colClass = 4;
  let ownerCols = [8, 10, 12, 14, 16, 18];

  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const row = rows[r] || [];
    const norm = row.map((c) => String(c ?? '').trim().toLowerCase());
    const idxClass = norm.findIndex((c) => c === 'lớp' || c.includes('chi đoàn') || c.includes('tên lớp'));
    const idxRoom = norm.findIndex((c) => c === 'phòng' || c.includes('link phòng') || c.includes('địa điểm'));
    const idxKip = norm.findIndex((c) => c === 'kíp' || c.includes('ca '));
    if (idxClass !== -1) {
      headerRowIdx = r;
      colClass = idxClass;
      if (idxRoom !== -1) colRoom = idxRoom;
      if (idxKip !== -1) colKip = idxKip;
      const foundOwners = [];
      norm.forEach((cellText, ci) => {
        if (cellText.includes('đại diện') || cellText.includes('dự phụ') || cellText.includes('phụ trách') || cellText.includes('kiểm tra')) {
          foundOwners.push(ci);
        }
      });
      if (foundOwners.length > 0) ownerCols = foundOwners;
      break;
    }
  }

  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 6;
  const floorMap = new Map();
  let currentKip = '';
  let totalClasses = 0;
  let k71Count = 0;
  let k70Count = 0;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawKip = row[colKip];
    if (rawKip && /kíp|ca/i.test(String(rawKip))) {
      const lines = String(rawKip).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      currentKip = lines.length > 1 ? `${lines[0]} (${lines[1]})` : lines[0];
    }

    const stt = row[0];
    if (typeof stt === 'string' && /dự\s*phòng|tổng/i.test(stt)) continue;

    const rawClass = row[colClass];
    const rawRoom = row[colRoom];
    if (!rawClass || !String(rawClass).trim()) continue;
    const className = String(rawClass).trim();
    if (/^(lớp|tên lớp|stt)$/i.test(className)) continue;

    const roomCode = rawRoom ? String(rawRoom).trim() : 'Phòng';
    const floorName = floorFromRoomCode(roomCode);
    const isK71 = /\bK71\b/i.test(className);
    if (isK71) k71Count++;
    else k70Count++;

    const owners = [];
    for (const oc of ownerCols) {
      const val = row[oc];
      if (val && String(val).trim() && !/^\d+$/.test(String(val).trim())) {
        const name = String(val).trim();
        if (!owners.includes(name)) owners.push(name);
      }
    }

    const prefix = currentKip ? `[${currentKip} · ${roomCode}]` : `[${roomCode}]`;
    const roomTitle = `${prefix} ${className}`.slice(0, 120);

    if (!floorMap.has(floorName)) floorMap.set(floorName, []);
    floorMap.get(floorName).push({
      name: roomTitle,
      owners,
      tasks: isK71 ? TASKS_K71 : TASKS_K70,
    });
    totalClasses++;
  }

  const groups = Array.from(floorMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'vi'))
    .map(([floorName, rooms]) => ({ floorName, rooms }));

  return { groups, totalClasses, k71Count, k70Count };
}

export default function UnitImportModal({ open, onClose, defaultUnit, groups, say, reload }) {
  const [tab, setTab] = useState('excel');
  const [unit, setUnit] = useState(defaultUnit && defaultUnit !== 'all' ? defaultUnit : UNITS[0]);
  const [replace, setReplace] = useState(false);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);

  // Quick-add class state
  const [kip, setKip] = useState('Kíp 1 (8h00)');
  const [roomCode, setRoomCode] = useState('D9-101');
  const [floorInput, setFloorInput] = useState('');
  const [className, setClassName] = useState('');
  const [docType, setDocType] = useState('auto');
  const [ownerInput, setOwnerInput] = useState('');

  if (!open) return null;

  const unitFloors = (groups ?? [])
    .map((g) => parseGroupMeta(g.name))
    .filter((m) => m.unit === unit)
    .map((m) => m.floorName);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      setWorkbook(wb);
      setFileName(file.name);
      setSheetNames(wb.SheetNames);
      const preferred = wb.SheetNames.find((n) => /off|18/i.test(n)) || wb.SheetNames[0];
      setSelectedSheet(preferred);
      setPreview(parseSheetToGroups(wb.Sheets[preferred]));
    } catch (err) {
      say(`Không đọc được file Excel: ${err.message}`);
    }
  };

  const handleSheetChange = (name) => {
    setSelectedSheet(name);
    if (workbook?.Sheets?.[name]) {
      setPreview(parseSheetToGroups(workbook.Sheets[name]));
    }
  };

  const submitExcel = async () => {
    if (!preview || preview.totalClasses === 0) {
      say('Sheet này không có lớp nào hợp lệ để nhập.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.importUnit({ unit, replace, groups: preview.groups });
      say(`Đã nhập ${res.importedRooms} lớp vào ${unit}!`);
      if (reload) reload();
      onClose(unit);
    } catch (err) {
      say(`Lỗi khi nhập dữ liệu: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const submitQuickAdd = async () => {
    const cls = className.trim();
    const rCode = roomCode.trim();
    if (!cls) {
      say('Vui lòng nhập tên lớp / chi đoàn.');
      return;
    }
    const targetFloor = floorInput.trim() || floorFromRoomCode(rCode);
    const isK71 = docType === 'K71' || (docType === 'auto' && /\bK71\b/i.test(cls));
    const tasks = isK71 ? TASKS_K71 : TASKS_K70;
    const prefix = kip.trim() && rCode ? `[${kip.trim()} · ${rCode}]` : rCode ? `[${rCode}]` : '';
    const fullRoomName = `${prefix} ${cls}`.trim();
    const owners = ownerInput.split(',').map((s) => s.trim()).filter(Boolean);

    setBusy(true);
    try {
      await api.importUnit({
        unit,
        replace: false,
        groups: [{ floorName: targetFloor, rooms: [{ name: fullRoomName, owners, tasks }] }],
      });
      say(`Đã thêm lớp "${cls}" vào ${targetFloor} (${unit})!`);
      setClassName('');
      onClose(unit);
    } catch (err) {
      say(`Lỗi khi thêm lớp: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => onClose()}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Thêm Lớp hoặc Nhập Excel cho Đơn vị">
        <div className="modal-head">
          <div>
            <span className="detail-kicker">QUẢN LÝ DỮ LIỆU ĐẠI HỘI CHI ĐOÀN</span>
            <h3>Cập nhật danh sách lớp theo Đơn vị</h3>
          </div>
          <button className="modal-close" onClick={() => onClose()} aria-label="Đóng"><X size={20} /></button>
        </div>

        <div className="modal-tabs">
          <button className={`modal-tab ${tab === 'excel' ? 'active' : ''}`} onClick={() => setTab('excel')}>
            <FileSpreadsheet size={16} /> Nhập từ file Excel (.xlsx)
          </button>
          <button className={`modal-tab ${tab === 'manual' ? 'active' : ''}`} onClick={() => setTab('manual')}>
            <PlusCircle size={16} /> Thêm nhanh Tầng &amp; Lớp
          </button>
        </div>

        <div className="modal-body">
          <label className="modal-field">
            <span>Chọn Đơn vị tổ chức Đại hội (12 đơn vị)</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="modal-select">
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>

          {tab === 'excel' ? (
            <>
              <div className="excel-upload-box">
                <input id="excel-file-input" type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
                <label htmlFor="excel-file-input" className="excel-upload-btn">
                  <Upload size={18} />
                  <span>{fileName ? `Đã chọn: ${fileName}` : 'Chọn file Excel phân kíp (.xlsx)…'}</span>
                </label>
                <small>Hỗ trợ mẫu file Phân kíp Đại hội Chi đoàn - Chi hội (tự động chia tầng theo số phòng D9-101, B1-202… và tự gán checklist K71/K70).</small>
              </div>

              {sheetNames.length > 0 && (
                <label className="modal-field">
                  <span>Chọn Sheet trong file Excel</span>
                  <select value={selectedSheet} onChange={(e) => handleSheetChange(e.target.value)} className="modal-select">
                    {sheetNames.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              )}

              {preview && (
                <div className="excel-preview-card">
                  <div className="excel-preview-head">
                    <CheckCircle2 size={18} />
                    <strong>Kết quả đọc từ Sheet &ldquo;{selectedSheet}&rdquo;:</strong>
                  </div>
                  <p>
                    Phát hiện <b>{preview.groups.length} tầng/khu vực</b> với tổng cộng <b>{preview.totalClasses} lớp</b>
                    {' '}({preview.k71Count} lớp K71 ĐH Thành lập · {preview.k70Count} lớp ĐH Nhiệm kỳ).
                  </p>
                  <div className="excel-preview-floors">
                    {preview.groups.map((g) => (
                      <span key={g.floorName} className="preview-floor-pill">
                        {g.floorName}: <b>{g.rooms.length} lớp</b>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <label className="modal-checkbox">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                <span>Thay thế toàn bộ dữ liệu cũ của <b>{unit}</b> (nếu không chọn sẽ gộp thêm vào)</span>
              </label>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => onClose()}>Hủy</button>
                <button className="btn-primary" disabled={busy || !preview || preview.totalClasses === 0} onClick={submitExcel}>
                  {busy ? 'Đang nhập dữ liệu…' : `Nhập ${preview?.totalClasses ?? 0} lớp vào ${unit}`}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="modal-grid-2">
                <label className="modal-field">
                  <span>Phòng tổ chức</span>
                  <input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="VD: D9-101, B1-202…" className="modal-input" />
                </label>
                <label className="modal-field">
                  <span>Kíp tổ chức</span>
                  <input value={kip} onChange={(e) => setKip(e.target.value)} list="kip-presets" placeholder="VD: Kíp 1 (8h00)" className="modal-input" />
                  <datalist id="kip-presets">
                    <option value="Kíp 1 (8h00)" />
                    <option value="Kíp 2 (10h00)" />
                    <option value="Kíp 3 (13h30)" />
                    <option value="Kíp 4 (15h30)" />
                  </datalist>
                </label>
              </div>

              <label className="modal-field">
                <span>Thuộc Tầng / Khu vực (để trống sẽ tự tính từ số phòng: {floorFromRoomCode(roomCode)})</span>
                <input value={floorInput} onChange={(e) => setFloorInput(e.target.value)} list="unit-floors-list" placeholder={`Mặc định: ${floorFromRoomCode(roomCode)}`} className="modal-input" />
                <datalist id="unit-floors-list">
                  {unitFloors.map((f) => <option key={f} value={f} />)}
                </datalist>
              </label>

              <label className="modal-field">
                <span>Tên lớp / Chi đoàn</span>
                <input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="VD: KT Điện tử-Viễn thông 01-K71 hoặc KHMT 02-K70" className="modal-input" />
              </label>

              <label className="modal-field">
                <span>Bộ checklist giấy tờ</span>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="modal-select">
                  <option value="auto">Tự động theo tên lớp (K71 = 4 mục ĐH Thành lập · K70 = 8 mục ĐH Nhiệm kỳ)</option>
                  <option value="K71">K71 — Đại hội thành lập (4 mục giấy tờ)</option>
                  <option value="K70">K70 — Đại hội nhiệm kỳ (8 mục giấy tờ)</option>
                </select>
              </label>

              <label className="modal-field">
                <span>Người kiểm tra / Phụ trách (tùy chọn, cách nhau dấu phẩy)</span>
                <input value={ownerInput} onChange={(e) => setOwnerInput(e.target.value)} placeholder="VD: Nguyễn Thu Hằng, Phạm Văn Minh" className="modal-input" />
              </label>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => onClose()}>Hủy</button>
                <button className="btn-primary" disabled={busy || !className.trim()} onClick={submitQuickAdd}>
                  {busy ? 'Đang thêm…' : `+ Thêm Lớp vào ${unit}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
