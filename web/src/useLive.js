import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

export function useLive() {
  const [state, setState] = useState(null);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState(false);

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
    return () => es.close();
  }, [reload]);

  return { state, setState, online, reload, error };
}
