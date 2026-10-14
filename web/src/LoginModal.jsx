import { useState } from 'react';
import { Lock, Mail, LogIn, AlertCircle, CheckCircle2, User, KeyRound, ShieldCheck } from 'lucide-react';
import { api, ApiError } from './api.js';

export default function LoginModal({ open, onClose, onSuccess, initialNotice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Abc@123456767');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showQuickList, setShowQuickList] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email/tài khoản và mật khẩu');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email.trim(), password);
      if (res?.ok && res?.user) {
        onSuccess(res.user);
        onClose();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Email hoặc mật khẩu không chính xác');
      } else {
        setError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (userEmail, userPass = 'Abc@123456767') => {
    setEmail(userEmail);
    setPassword(userPass);
    setError(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card login-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="login-modal-header">
          <div className="login-brand-icon">
            <img src="/logo.png" alt="Logo Ban TC-KT" className="login-logo-img" />
          </div>
          <h2>Đăng nhập Cán bộ</h2>
          <p className="login-subtext">
            Hệ thống theo dõi Đại hội Chi đoàn — Ban Tổ chức - Kiểm tra
          </p>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            ✕
          </button>
        </div>

        {initialNotice && (
          <div className="login-notice-banner">
            <AlertCircle size={16} />
            <span>{initialNotice}</span>
          </div>
        )}

        {error && (
          <div className="login-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-input-group">
            <span className="login-label">
              <Mail size={14} /> Email / Tên tài khoản cán bộ:
            </span>
            <input
              type="text"
              autoFocus
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="VD: anh.tdh250154e@sis.hust.edu.vn hoặc anh.tdh250154e..."
              required
            />
          </label>

          <label className="login-input-group">
            <span className="login-label">
              <KeyRound size={14} /> Mật khẩu:
            </span>
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu của bạn…"
              required
            />
          </label>

          <div className="login-default-hint">
            <Lock size={13} />
            <span>
              Mật khẩu mặc định khởi tạo: <b>Abc@123456767</b>
            </span>
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span>Đang xác thực…</span>
            ) : (
              <>
                <LogIn size={17} />
                <span>Đăng nhập vào hệ thống</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Switcher */}
        <div className="quick-login-section">
          <button
            type="button"
            className="quick-toggle-btn"
            onClick={() => setShowQuickList(!showQuickList)}
          >
            <User size={14} />
            <span>{showQuickList ? 'Ẩn danh sách tài khoản mẫu' : 'Đăng nhập nhanh bằng tài khoản mẫu ▼'}</span>
          </button>

          {showQuickList && (
            <div className="quick-users-list">
              <div
                className="quick-user-item is-admin"
                onClick={() => handleQuickSelect('anh.tdh250154e@sis.hust.edu.vn')}
              >
                <div className="quick-user-role">
                  <ShieldCheck size={14} />
                  <strong>Trần Đức Hoàng Anh (Ban Điều hành · Quản trị viên)</strong>
                </div>
                <code>anh.tdh250154e@sis.hust.edu.vn</code>
              </div>

              <div
                className="quick-user-item is-admin"
                onClick={() => handleQuickSelect('anh.km2415833@sis.hust.edu.vn')}
              >
                <div className="quick-user-role">
                  <ShieldCheck size={14} />
                  <strong>Kiều Minh Anh (Ban Điều hành · Quản trị viên)</strong>
                </div>
                <code>anh.km2415833@sis.hust.edu.vn</code>
              </div>

              <div
                className="quick-user-item is-supervisor"
                onClick={() => handleQuickSelect('dung.ltc2410053@sis.hust.edu.vn')}
              >
                <div className="quick-user-role">
                  <User size={14} />
                  <strong>Lê Thị Cẩm Dung (Trưởng mảng Tổ chức & Nhân sự)</strong>
                </div>
                <code>dung.ltc2410053@sis.hust.edu.vn</code>
              </div>

              <div
                className="quick-user-item is-supervisor"
                onClick={() => handleQuickSelect('linh.ntd2411669@sis.hust.edu.vn')}
              >
                <div className="quick-user-role">
                  <User size={14} />
                  <strong>Nguyễn Thị Diệu Linh (Trưởng mảng Giám sát & KT)</strong>
                </div>
                <code>linh.ntd2411669@sis.hust.edu.vn</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
