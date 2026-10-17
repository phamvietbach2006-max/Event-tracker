import { useState } from 'react';
import logoAsset from './assets/logo.png';

export function EmblemSvg({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
      aria-label="Biểu trưng Ban Tổ chức - Kiểm tra Đoàn ĐHBK Hà Nội"
    >
      {/* Khiên đỏ */}
      <path
        d="M50 8 L80 18 C80 50 50 88 50 88 C50 88 20 50 20 18 Z"
        fill="#b91c1c"
        stroke="#7f1d1d"
        strokeWidth="2.5"
      />
      {/* Vòng nguyệt quế trái */}
      <path
        d="M17 72 C9 52 13 32 17 24"
        stroke="#94a3b8"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Vòng nguyệt quế phải */}
      <path
        d="M83 72 C91 52 87 32 83 24"
        stroke="#94a3b8"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Cuốn sổ mở */}
      <path
        d="M34 38 C42 36 50 40 50 40 C50 40 58 36 66 38 V62 C58 60 50 64 50 64 C50 64 42 60 34 62 Z"
        fill="#ffffff"
      />
      {/* Gáy sổ */}
      <path d="M50 40 V64" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" />
      {/* Con dấu kiểm tra */}
      <ellipse cx="44" cy="30" rx="6" ry="3.5" fill="#ffffff" />
      <path d="M42 30 V24 C42 22 46 22 46 24 V30" fill="#ffffff" stroke="#b91c1c" strokeWidth="1" />
    </svg>
  );
}

export default function Logo({
  className = '',
  alt = 'Logo Ban Tổ chức - Kiểm tra Đoàn ĐHBK Hà Nội',
  ...props
}) {
  const [attempt, setAttempt] = useState(0);
  const candidates = [logoAsset, '/logo.png', '/logo-emblem.png'];

  if (attempt >= candidates.length) {
    return <EmblemSvg className={className} />;
  }

  return (
    <img
      src={candidates[attempt]}
      alt={alt}
      className={className}
      onError={() => setAttempt((a) => a + 1)}
      {...props}
    />
  );
}
