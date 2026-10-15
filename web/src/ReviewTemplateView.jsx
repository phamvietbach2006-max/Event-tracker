import { useState, useEffect } from 'react';
import { FileText, Copy, Save, Check, Clock, User, Shield, AlertCircle } from 'lucide-react';
import { api } from './api.js';
import { isUserAdmin, timeLabel } from './logic.js';

export default function ReviewTemplateView({ me, say }) {
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAdmin = isUserAdmin(me);

  useEffect(() => {
    let alive = true;
    api.getReviewTemplate()
      .then((data) => {
        if (!alive) return;
        setContent(data.content || '');
        setSavedContent(data.content || '');
        setUpdatedAt(data.updatedAt || null);
        setUpdatedBy(data.updatedBy || '');
      })
      .catch((err) => {
        console.error('Lỗi khi tải mẫu nhận xét:', err);
        say?.('Không thể tải mẫu nhận xét: ' + err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [say]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      say?.('✓ Đã sao chép mẫu nhận xét vào bộ nhớ tạm.');
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      say?.('Không thể tự động sao chép. Vui lòng chọn và nhấn Ctrl+C.');
    });
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const res = await api.setReviewTemplate(content);
      setSavedContent(content);
      setUpdatedAt(res.updatedAt);
      setUpdatedBy(res.updatedBy);
      say?.('✓ Đã lưu và cập nhật Mẫu nhận xét kiểm tra thành công!');
    } catch (err) {
      say?.('Lỗi khi lưu mẫu nhận xét: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = content !== savedContent;

  return (
    <div className="template-view-container">
      <div className="template-header-card">
        <div className="template-header-main">
          <div className="template-icon-wrap">
            <FileText size={28} />
          </div>
          <div>
            <div className="template-badge-row">
              <span className="template-pill">BAN TỔ CHỨC - KIỂM TRA ĐOÀN ĐHBK HÀ NỘI</span>
              {isAdmin ? (
                <span className="template-role-pill admin">
                  <Shield size={12} /> Chế độ Quản trị viên (Được phép biên tập)
                </span>
              ) : (
                <span className="template-role-pill readonly">
                  Chế độ chỉ xem
                </span>
              )}
            </div>
            <h2 className="template-title">MẪU NHẬN XÉT KIỂM TRA ĐẠI HỘI</h2>
            <p className="template-desc">
              Biểu mẫu nhận xét chuẩn do Ban Tổ chức - Kiểm tra ban hành. Cán bộ kiểm tra tham khảo và sao chép để dán vào phần Ghi chú kiểm tra (Note) của chi đoàn.
            </p>
          </div>
        </div>

        <div className="template-actions">
          <button
            type="button"
            className="custom-btn custom-btn-secondary copy-btn"
            onClick={handleCopy}
            disabled={loading || !content}
            title="Sao chép toàn bộ nội dung mẫu nhận xét"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép nội dung'}</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              className={`custom-btn custom-btn-primary save-btn ${hasChanges ? 'highlight-save' : ''}`}
              onClick={handleSave}
              disabled={loading || saving || !hasChanges}
              title="Lưu các thay đổi của mẫu nhận xét lên hệ thống"
            >
              <Save size={16} />
              <span>{saving ? 'Đang lưu...' : 'Lưu mẫu nhận xét'}</span>
            </button>
          )}
        </div>
      </div>

      {updatedAt && (
        <div className="template-meta-strip">
          <span><Clock size={14} /> Cập nhật lần cuối: <b>{timeLabel(updatedAt)}</b></span>
          <span><User size={14} /> Người cập nhật: <b>{updatedBy || 'Ban Quản trị'}</b></span>
        </div>
      )}

      <div className="template-body-card">
        {loading ? (
          <div className="template-loading">Đang tải nội dung biểu mẫu...</div>
        ) : isAdmin ? (
          <div className="template-editor-wrap">
            <div className="editor-tips">
              <AlertCircle size={15} />
              <span>
                <b>Gợi ý cho Quản trị viên:</b> Dán (paste) hoặc chỉnh sửa trực tiếp nội dung biểu mẫu tại khung bên dưới. Khi nhấn <b>"Lưu mẫu nhận xét"</b>, toàn bộ Cán bộ trực lớp và Phụ trách tầng sẽ thấy ngay lập tức.
              </span>
            </div>
            <textarea
              className="template-textarea"
              rows={22}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Admin dán nội dung mẫu nhận xét vào đây để mọi người cùng xem..."
            />
          </div>
        ) : (
          <div className="template-display-wrap">
            <div className="template-readonly-box">
              <pre>{content}</pre>
            </div>
            <div className="template-helper-footer">
              💡 <b>Mẹo thao tác:</b> Nhấn nút <b>"Sao chép nội dung"</b> ở góc trên bên phải để copy nhanh toàn bộ nội dung, sau đó dán vào ô <b>Ghi chú kiểm tra (Note)</b> của lớp phụ trách.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
