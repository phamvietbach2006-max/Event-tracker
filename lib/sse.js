import { getClientIp } from './security.js';

export function createSse(getState, { debounceMs = 100, keepAliveMs = 25000, onConnect, getVisits } = {}) {
  const clients = new Set();
  const connectionsPerIp = new Map();
  let timer = null;

  const frame = () => `data: ${JSON.stringify(getState())}\n\n`;
  const statsFrame = (visits) => `event: stats\ndata: ${JSON.stringify({ online: clients.size, visits })}\n\n`;

  function write(chunk) {
    for (const c of [...clients]) {
      try { c.write(chunk); } catch { clients.delete(c); }
    }
  }

  function broadcastStats(visits) {
    if (!clients.size) return;
    const v = visits ?? (getVisits ? getVisits() : 0);
    write(statsFrame(v));
  }

  function add(req, res) {
    const ip = getClientIp(req);
    const ipCount = connectionsPerIp.get(ip) || 0;
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
    const maxPerIp = process.env.NODE_ENV === 'test' ? 1000 : 100;
    if (!isLocal && ipCount >= maxPerIp) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'too_many_sse_connections', message: 'Quá nhiều kết nối SSE đồng thời' }));
      return;
    }
    connectionsPerIp.set(ip, ipCount + 1);

    let dropped = false;
    const drop = () => {
      if (dropped) return;
      dropped = true;
      clients.delete(res);
      const remaining = (connectionsPerIp.get(ip) || 1) - 1;
      if (remaining <= 0) connectionsPerIp.delete(ip);
      else connectionsPerIp.set(ip, remaining);
      broadcastStats();
    };

    req.on('close', drop);
    res.on('error', drop);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(frame());
    clients.add(res);

    let visits = 0;
    try {
      visits = onConnect ? onConnect() : (getVisits ? getVisits() : clients.size);
    } catch (err) {
      console.warn('Lỗi onConnect SSE:', err.message);
      visits = getVisits ? getVisits() : clients.size;
    }
    broadcastStats(visits);
  }

  function broadcast() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (!clients.size) return;
      try {
        write(frame());
      } catch (e) {
        console.error('SSE broadcast error:', e);
      }
    }, debounceMs);
  }

  function broadcastNotification(notification) {
    if (!clients.size || !notification) return;
    try {
      write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
    } catch (e) {
      console.error('SSE broadcastNotification error:', e);
    }
  }

  const keepAlive = setInterval(() => write(': ka\n\n'), keepAliveMs);
  keepAlive.unref();

  function close() {
    clearInterval(keepAlive);
    clearTimeout(timer);
    for (const c of clients) c.end();
    clients.clear();
    connectionsPerIp.clear();
  }

  return { add, broadcast, broadcastNotification, close, size: () => clients.size };
}
