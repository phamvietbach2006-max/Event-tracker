import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

const CACHE_KEY = 'event_tracker_state_cache_v1';

export function useLive() {
  const [state, setStateInternal] = useState(() => {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.groups)) return parsed;
      }
    } catch {
      // Bỏ qua nếu localStorage bị tắt hoặc lỗi
    }
    return null;
  });
  const [online, setOnline] = useState(false);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState({ online: 1, visits: 1 });

  const updateState = useCallback((next) => {
    setStateInternal((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      if (resolved && Array.isArray(resolved.groups)) {
        setError(false);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(resolved));
        } catch {
          // Bỏ qua lỗi hạn mức lưu trữ
        }
      }
      return resolved;
    });
  }, []);

  const reload = useCallback(() => {
    return api.state()
      .then((next) => {
        updateState(next);
      })
      .catch((err) => {
        console.warn('Lỗi tải state:', err);
        setStateInternal((curr) => {
          if (!curr) setError(true);
          return curr;
        });
      });
  }, [updateState]);

  useEffect(() => {
    reload();

    let es = null;
    let pollInterval = null;

    try {
      es = new EventSource('/events');
      es.onopen = () => {
        setOnline(true);
        setError(false);
      };
      es.onerror = () => {
        setOnline(false);
      };
      es.onmessage = (e) => {
        try {
          const next = JSON.parse(e.data);
          updateState(next);
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

    // Polling dự phòng mỗi 15s để giữ dữ liệu luôn mới nhất
    pollInterval = setInterval(() => {
      reload();
    }, 15000);

    return () => {
      if (es) es.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [reload, updateState]);

  return { state, setState: updateState, online, reload, error, stats };
}
