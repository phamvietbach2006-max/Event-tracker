import { useState } from 'react';
import { Mail, LogIn, AlertCircle, KeyRound, X } from 'lucide-react';
import { api, ApiError } from './api.js';
import Logo from './Logo.jsx';

export default function LoginModal({ open, onClose, onSuccess, initialNotice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card login-modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="modal-close login-close-btn"
          onClick={onClose}
          aria-label="Đóng cửa sổ"
        >
          <X size={18} />
        </button>

        <div className="login-modal-header">
          <div className="login-brand-icon">
            <Logo alt="Logo Ban TC-KT" className="login-logo-img" />
          </div>
          <h2>Đăng nhập Cán bộ</h2>
          <p className="login-subtext">
            Hệ thống theo dõi Đại hội Chi đoàn — Ban Tổ chức - Kiểm tra
          </p>
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
      </div>
    </div>
  );
}
