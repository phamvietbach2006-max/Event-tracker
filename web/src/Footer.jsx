import { ShieldCheck, Wifi, WifiOff, Map, Home } from 'lucide-react';

export default function Footer({ tot, online, onNavigate }) {
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-col footer-brand-col">
            <div className="footer-dyc-header">
              <span className="footer-dyc-logo-box">
                <img
                  className="footer-dyc-logo"
                  src="/logo-dyc.png"
                  alt="Logo CLB Thanh niên số Đoàn Đại học Bách khoa Hà Nội (DYC)"
                  loading="lazy"
                />
              </span>
              <div className="footer-dyc-titles">
                <span className="footer-kicker">ĐƠN VỊ PHÁT TRIỂN &amp; VẬN HÀNH KỸ THUẬT</span>
                <strong className="footer-org-name">CLB Thanh niên số (DYC)</strong>
                <span className="footer-org-sub">Đoàn Thanh niên Đại học Bách khoa Hà Nội</span>
              </div>
            </div>
            <p className="footer-desc">
              Hệ thống theo dõi, điều phối checklist và giám sát trạng thái sẵn sàng các điểm cầu, khu vực phục vụ sự kiện theo thời gian thực.
            </p>
          </div>

          <div className="footer-col">
            <h3 className="footer-heading">ĐIỀU HƯỚNG NHANH</h3>
            <ul className="footer-links">
              <li>
                <button type="button" onClick={() => onNavigate('overview')}>
                  <Home size={14} />
                  <span>Bảng điều hành tổng quan ({tot.rooms} khu vực)</span>
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('map')}>
                  <Map size={14} />
                  <span>Sơ đồ khu vực HUSTMAP</span>
                </button>
              </li>
            </ul>
            <div className="footer-event-tag">
              <span className="footer-event-dot" aria-hidden="true" />
              <span>EVENT TRACKER • LỄ ĐÓN TỔNG BÍ THƯ</span>
            </div>
          </div>

          <div className="footer-col">
            <h3 className="footer-heading">TRẠNG THÁI HỆ THỐNG</h3>
            <div className="footer-status-box">
              <div className={`footer-live-row ${online ? 'is-online' : 'is-offline'}`}>
                {online ? <Wifi size={15} /> : <WifiOff size={15} />}
                <span>{online ? 'Đồng bộ trực tiếp (SSE Realtime)' : 'Đang tự động kết nối lại…'}</span>
              </div>
              <div className="footer-metric-row">
                <span>Tiến độ toàn sự kiện:</span>
                <strong>{tot.done}/{tot.total} việc ({tot.pct}%)</strong>
              </div>
              <div className="footer-security-row">
                <ShieldCheck size={14} />
                <span>Xác thực SSO HUST &amp; phân quyền theo khu phụ trách</span>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Đại học Bách khoa Hà Nội (HUST) • Kỷ niệm 70 năm thành lập (1956–2026)</span>
          <span className="footer-bottom-credit">
            Phát triển bởi <strong>CLB Thanh niên số — Đoàn ĐHBK Hà Nội</strong>
          </span>
        </div>
      </div>
    </footer>
  );
}
