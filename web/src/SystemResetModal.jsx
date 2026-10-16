import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, RotateCcw, X, ShieldAlert, CheckCircle2, KeyRound } from 'lucide-react';
import { api } from './api.js';

export default function SystemResetModal({ open, onClose, say }) {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPassword('');
      setErrorMsg('');
      setSubmitting(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!open) return;
      if (e.key === 'Escape' && !submitting) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      setErrorMsg('Vui lòng nhập mật khẩu xác nhận.');
      inputRef.current?.focus();
      return;
    }

    if (trimmed !== 'Việt Bách đẹp trai nhất vũ trụ') {
      setErrorMsg('Mật khẩu xác nhận không chính xác! Vui lòng thử lại.');
      inputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      await api.systemReset(trimmed);
      say('Đã làm mới toàn bộ dữ liệu hệ thống thành công! Toàn bộ tiến độ và logs test đã được đưa về ban đầu.');
      onClose();
      // Tải lại trang sau 800ms để nạp dữ liệu sạch
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi reset hệ thống');
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="custom-modal-backdrop" onClick={submitting ? undefined : onClose} role="presentation">
      <div
        className="custom-modal-card system-reset-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-reset-modal-title"
      >
        {/* Header */}
        <div className="custom-modal-header reset-modal-header">
          <div className="custom-modal-icon-wrap icon-wrap-danger">
            <ShieldAlert size={24} className="modal-icon-danger" />
          </div>
          <div className="custom-modal-title-wrap">
            <h3 id="system-reset-modal-title" className="custom-modal-title text-danger">
              Reset Dữ Liệu Hệ Thống Trước Sự Kiện
            </h3>
            <span className="custom-modal-subtitle">
              Chỉ dành cho Quản trị viên vĩnh viễn Phạm Việt Bách
            </span>
          </div>
          {!submitting && (
            <button
              type="button"
              className="custom-modal-close"
              onClick={onClose}
              aria-label="Đóng hộp thoại"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="custom-modal-body">
          <div className="reset-notice-box danger-box">
            <div className="notice-box-title">
              <AlertTriangle size={17} />
              <strong>Dữ liệu sẽ được làm mới (về ban đầu / xóa sạch):</strong>
            </div>
            <ul className="reset-bullets">
              <li>Trạng thái Đại hội tất cả Chi đoàn chuyển về <b>Chưa bắt đầu (Đỏ)</b>.</li>
              <li>Toàn bộ checklist hồ sơ giấy tờ chuyển về <b>Chưa làm (0%)</b>.</li>
              <li>Điểm danh và sĩ số thực tế đưa về <b>0</b>; hủy bỏ toàn bộ ngoại lệ sĩ số.</li>
              <li>Mở khóa toàn bộ các chi đoàn đã bị khóa.</li>
              <li>Xóa sạch toàn bộ <b>Thông báo hệ thống</b> và danh sách đọc.</li>
              <li>Xóa sạch toàn bộ <b>Nhật ký hoạt động (Logs)</b> trong quá trình test.</li>
            </ul>
          </div>

          <div className="reset-notice-box preserved-box">
            <div className="notice-box-title text-success">
              <CheckCircle2 size={17} />
              <strong>Dữ liệu được BẢO TỒN NGUYÊN VẸN (Không mất):</strong>
            </div>
            <ul className="reset-bullets preserved-bullets">
              <li>Danh sách các Chi đoàn, Kíp và Phòng họp của 12 đơn vị/trường.</li>
              <li>Toàn bộ cấu hình checklist K70 (8 việc) và K71 (4 việc).</li>
              <li>Danh bạ cán bộ Ban TC-KT và tất cả tài khoản/phân quyền người dùng.</li>
              <li>Nội dung Hướng dẫn &amp; Mẫu nhận xét kiểm tra Đại hội.</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="reset-password-form">
            <div className="form-group">
              <label className="reset-password-label">
                <KeyRound size={15} />
                <span>Nhập mật khẩu xác nhận của Admin Phạm Việt Bách:</span>
                <span className="required-star">*</span>
              </label>
              <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                className={`custom-prompt-input ${errorMsg ? 'has-error' : ''}`}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Nhập chính xác mật khẩu xác nhận..."
                disabled={submitting}
              />
              {errorMsg && (
                <div className="reset-error-msg">{errorMsg}</div>
              )}
            </div>

            <div className="custom-modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="btn-danger-confirm"
                disabled={!password.trim() || submitting}
              >
                {submitting ? (
                  <>
                    <RotateCcw size={16} className="spin-icon" />
                    <span>Đang làm mới dữ liệu...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    <span>Xác nhận Reset Hệ thống</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
