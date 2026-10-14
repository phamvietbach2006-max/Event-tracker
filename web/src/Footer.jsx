import { ShieldCheck, Wifi, WifiOff, Users, Eye } from 'lucide-react';

export default function Footer({ tot, online, stats }) {
  const onlineCount = Math.max(1, Number(stats?.online) || 1);
  const visitCount = Math.max(1, Number(stats?.visits) || 1);

  return (
    <footer className="app-footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-col footer-brand-col">
            <div className="footer-orgs-wrap">
              <div className="footer-dyc-header">
                <span className="footer-dyc-logo-box">
                  <img
                    className="footer-dyc-logo"
                    src="/logo.png"
                    alt="Logo Ban Tổ chức - Kiểm tra Đoàn ĐHBK Hà Nội"
                    loading="lazy"
                  />
                </span>
                <div className="footer-dyc-titles">
                  <span className="footer-kicker">CƠ QUAN CHỦ TRÌ</span>
                  <strong className="footer-org-name">Ban Tổ chức - Kiểm tra</strong>
                  <span className="footer-org-sub">Đoàn Đại học Bách khoa Hà Nội</span>
                </div>
              </div>
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
                  <span className="footer-kicker">ĐƠN VỊ PHÁT TRIỂN KỸ THUẬT</span>
                  <strong className="footer-org-name">CLB Thanh niên số (DYC)</strong>
                  <span className="footer-org-sub">Đoàn Thanh niên Đại học Bách khoa Hà Nội</span>
                </div>
              </div>
            </div>
            <p className="footer-desc">
              Hệ thống theo dõi tiến độ tổ chức Đại hội Chi đoàn và kiểm tra hồ sơ giấy tờ trực tuyến theo thời gian thực — Ban Tổ chức - Kiểm tra Đoàn Đại học Bách khoa Hà Nội.
            </p>
          </div>

          <div className="footer-col footer-status-col">
            <h3 className="footer-heading">TRẠNG THÁI HỆ THỐNG</h3>
            <div className="footer-status-box">
              <div className={`footer-live-row ${online ? 'is-online' : 'is-offline'}`}>
                {online ? <Wifi size={15} /> : <WifiOff size={15} />}
                <span>{online ? 'Đồng bộ trực tiếp (SSE Realtime)' : 'Đang tự động kết nối lại…'}</span>
              </div>
              <div className="footer-counters-grid">
                <div className="footer-counter-item">
                  <span className="footer-counter-label">
                    <Users size={13} />
                    <span>Đang online</span>
                  </span>
                  <strong className="footer-counter-val online-val">
                    <i className="footer-online-dot" aria-hidden="true" />
                    {onlineCount.toLocaleString('vi-VN')} người
                  </strong>
                </div>
                <div className="footer-counter-item">
                  <span className="footer-counter-label">
                    <Eye size={13} />
                    <span>Lượt truy cập</span>
                  </span>
                  <strong className="footer-counter-val">
                    {visitCount.toLocaleString('vi-VN')} lượt
                  </strong>
                </div>
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
