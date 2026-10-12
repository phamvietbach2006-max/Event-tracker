import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

export function useLive() {
  const [state, setState] = useState(null);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState({ online: 1, visits: 1 });

  const reload = useCallback(() => { api.state().then((next) => { setState(next); setError(false); }).catch(() => setError(true)); }, []);

  useEffect(() => {
    reload();
    let hadError = false;
    const es = new EventSource('/events');
    es.onopen = () => {
      setOnline(true);
      if (hadError) {
        hadError = false;
        reload();
      }
    };
    es.onerror = () => {
      hadError = true;
      setOnline(false);
    };
    es.onmessage = (e) => {
      try {
        setState(JSON.parse(e.data));
        setError(false);
      } catch {
        // Bỏ qua gói dữ liệu SSE không phải JSON hợp lệ
      }
    };
    es.addEventListener('stats', (e) => {
      try {
        const next = JSON.parse(e.data);
        if (next && typeof next.online === 'number') setStats(next);
      } catch {
        // Bỏ qua gói thống kê lỗi
      }
    });
    return () => es.close();
  }, [reload]);

  return { state, setState, online, reload, error, stats };
}
