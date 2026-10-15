import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, Unlock, AlertTriangle, AlertOctagon, Trash2, CheckCircle, Info, FileText, Save } from 'lucide-react';

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  subtitle,
  message,
  bulletPoints = [],
  icon = 'info',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  variant = 'primary', // 'primary' | 'danger' | 'warning' | 'success'
  isPrompt = false,
  promptPlaceholder = '',
  promptInitialValue = '',
  promptMaxLength = 150,
  promptRequired = true,
  promptLabel = '',
}) {
  const [inputValue, setInputValue] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setInputValue(promptInitialValue || '');
      setErrorMsg('');
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, promptInitialValue]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!open) return;
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    if (isPrompt) {
      const trimmed = inputValue.trim();
      if (promptRequired && !trimmed) {
        setErrorMsg('Vui lòng không để trống nội dung này.');
        inputRef.current?.focus();
        return;
      }
      onConfirm?.(trimmed);
    } else {
      onConfirm?.();
    }
  };

  const renderIcon = () => {
    switch (icon) {
      case 'lock':
        return <Lock size={22} className="modal-icon-lock" />;
      case 'unlock':
        return <Unlock size={22} className="modal-icon-unlock" />;
      case 'cancel':
      case 'danger':
        return <AlertOctagon size={22} className="modal-icon-danger" />;
      case 'warning':
        return <AlertTriangle size={22} className="modal-icon-warning" />;
      case 'trash':
        return <Trash2 size={22} className="modal-icon-danger" />;
      case 'save':
        return <Save size={22} className="modal-icon-save" />;
      case 'success':
        return <CheckCircle size={22} className="modal-icon-success" />;
      default:
        return <Info size={22} className="modal-icon-info" />;
    }
  };

  return createPortal(
    <div className="custom-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="custom-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-modal-title"
      >
        {/* Header */}
        <div className="custom-modal-header">
          <div className="custom-modal-icon-wrap">{renderIcon()}</div>
          <div className="custom-modal-title-wrap">
            <h3 id="custom-modal-title" className="custom-modal-title">
              {title}
            </h3>
            {subtitle && <span className="custom-modal-subtitle">{subtitle}</span>}
          </div>
          <button
            type="button"
            className="custom-modal-close"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="custom-modal-body">
          {message && <p className="custom-modal-message">{message}</p>}

          {bulletPoints && bulletPoints.length > 0 && (
            <ul className="custom-modal-bullets">
              {bulletPoints.map((pt, idx) => (
                <li key={idx}>{pt}</li>
              ))}
            </ul>
          )}

          {isPrompt && (
            <div className="custom-modal-prompt-box custom-modal-prompt-group">
              {promptLabel && (
                <label className="custom-prompt-label custom-modal-prompt-label">
                  {promptLabel}
                  {promptRequired && <span className="required-star">*</span>}
                </label>
              )}
              <textarea
                ref={inputRef}
                className={`custom-prompt-textarea custom-modal-textarea ${errorMsg ? 'has-error' : ''}`}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                maxLength={promptMaxLength}
                placeholder={promptPlaceholder}
                rows={3}
              />
              <div className="prompt-counter-row custom-modal-prompt-meta">
                {errorMsg ? (
                  <span className="custom-prompt-error prompt-error-text">{errorMsg}</span>
                ) : (
                  <span />
                )}
                <span className="prompt-char-count">
                  {inputValue.length}/{promptMaxLength}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="custom-modal-footer">
          <button
            type="button"
            className="custom-modal-cancel-btn custom-btn custom-btn-secondary"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`custom-modal-confirm-btn variant-${variant} custom-btn custom-btn-${variant}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
