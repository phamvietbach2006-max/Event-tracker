import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const CACHE_KEY = 'event_tracker_state_cache_v1';

export function useLive(options = {}) {
  const { onNotification } = options;
  const onNotificationRef = useRef(onNotification);
  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

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
  const inFlightRef = useRef(false);

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
    if (inFlightRef.current) return Promise.resolve();
    inFlightRef.current = true;
    return api.state()
      .then((next) => {
        if (next && Array.isArray(next.groups)) {
          updateState(next);
        }
      })
      .catch((err) => {
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
          console.warn('Đang kết nối lại mạng hoặc tải chậm trong nền:', err.message);
        } else {
          console.warn('Lỗi tải state:', err);
        }
        setStateInternal((curr) => {
          if (!curr) setError(true);
          return curr;
        });
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [updateState]);

  useEffect(() => {
    reload();

    let es = null;
    let pollInterval = null;
    let reconnectTimeout = null;
    let offlineGraceTimer = null;
    let destroyed = false;

    function connectSSE() {
      if (destroyed) return;
      if (es) {
        try { es.close(); } catch {}
        es = null;
      }

      try {
        es = new EventSource('/events');

        es.onopen = () => {
          if (offlineGraceTimer) {
            clearTimeout(offlineGraceTimer);
            offlineGraceTimer = null;
          }
          setOnline(true);
          setError(false);
        };

        es.onerror = () => {
          // Khi kết nối SSE kết thúc (chu kỳ xoay tua 55s hoặc mạng chập chờn):
          // Nếu browser đang tự reconnect (readyState === 0 / CONNECTING), cho grace period 4s trước khi hiển thị mất kết nối
          if (es && es.readyState === 0) {
            if (!offlineGraceTimer) {
              offlineGraceTimer = setTimeout(() => {
                setOnline(false);
              }, 4000);
            }
          } else {
            // Nếu stream bị đóng hoàn toàn (readyState === 2 / CLOSED), đóng và lên lịch tạo EventSource mới sau 2.5s
            setOnline(false);
            if (es) {
              try { es.close(); } catch {}
              es = null;
            }
            if (!reconnectTimeout && !destroyed) {
              reconnectTimeout = setTimeout(() => {
                reconnectTimeout = null;
                connectSSE();
              }, 2500);
            }
          }
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

        es.addEventListener('notification', (e) => {
          try {
            const notif = JSON.parse(e.data);
            onNotificationRef.current?.(notif);
          } catch {
            // Bỏ qua gói thông báo lỗi
          }
        });
      } catch {
        setOnline(false);
      }
    }

    connectSSE();

    // Polling dự phòng định kỳ để giữ dữ liệu luôn mới nhất khi mạng chập chờn
    pollInterval = setInterval(() => {
      reload();
    }, 20000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        reload();
        // Nếu SSE đang mất kết nối khi quay lại tab, thử kết nối lại ngay
        if (!es || es.readyState === 2) {
          connectSSE();
        }
      }
    };
    const onOnline = () => {
      setOnline(true);
      reload();
      connectSSE();
    };
    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    return () => {
      destroyed = true;
      if (es) es.close();
      if (pollInterval) clearInterval(pollInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (offlineGraceTimer) clearTimeout(offlineGraceTimer);
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [reload, updateState]);

  return { state, setState: updateState, online, reload, error, stats };
}
