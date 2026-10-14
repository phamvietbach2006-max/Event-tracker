import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

export function useLive() {
  const [state, setState] = useState(null);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState({ online: 1, visits: 1 });

  const reload = useCallback(() => {
    return api.state()
      .then((next) => {
        if (next && next.groups) {
          setState(next);
          setError(false);
        }
      })
      .catch((err) => {
        console.warn('Lỗi tải state:', err);
        setError((prev) => (!state ? true : prev));
      });
  }, [state]);

  useEffect(() => {
    reload();

    let retryTimer = null;
    let hadError = false;
    let es = null;

    try {
      es = new EventSource('/events');
      es.onopen = () => {
        setOnline(true);
        setError(false);
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
          const next = JSON.parse(e.data);
          if (next && next.groups) {
            setState(next);
            setError(false);
          }
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
    } catch {
      setOnline(false);
    }

    // Polling dự phòng mỗi 12s nếu SSE mất kết nối (rất hữu ích trên serverless)
    const pollInterval = setInterval(() => {
      if (!online) {
        reload();
      }
    }, 12000);

    return () => {
      if (es) es.close();
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(pollInterval);
    };
  }, [reload, online]);

  return { state, setState, online, reload, error, stats };
}
