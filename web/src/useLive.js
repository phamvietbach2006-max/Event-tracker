import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

export function useLive() {
  const [state, setState] = useState(null);
  const [online, setOnline] = useState(false);

  const reload = useCallback(() => { api.state().then(setState).catch(() => {}); }, []);

  useEffect(() => {
    reload();
    const es = new EventSource('/events');
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.onmessage = (e) => setState(JSON.parse(e.data));
    return () => es.close();
  }, [reload]);

  return { state, setState, online, reload };
}
