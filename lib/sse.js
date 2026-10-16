import { getClientIp } from './security.js';

const isTest = process.env.NODE_ENV === 'test';
const isCloud = !!(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_REGION || process.env.VERCEL_ENV);
const defaultMaxDuration = isTest ? 0 : (isCloud ? 55000 : Number(process.env.SSE_MAX_DURATION_MS || 0));

export function createSse(getState, {
  debounceMs = 100,
  keepAliveMs = 25000,
  maxDurationMs = defaultMaxDuration,
  onConnect,
  getVisits
} = {}) {
  const clients = new Set();
  const userClients = new Map();
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

  function add(req, res, user = null) {
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

    if (user?.email) {
      const emailNorm = String(user.email).trim().toLowerCase();
      res.user = { email: emailNorm, name: user.name, role: user.role, is_admin: user.is_admin };
      if (!userClients.has(emailNorm)) userClients.set(emailNorm, new Set());
      userClients.get(emailNorm).add(res);
    }

    let dropped = false;
    let cycleTimer = null;

    const drop = () => {
      if (dropped) return;
      dropped = true;
      if (cycleTimer) {
        clearTimeout(cycleTimer);
        cycleTimer = null;
      }
      clients.delete(res);
      if (res.user?.email) {
        const emailNorm = res.user.email;
        const set = userClients.get(emailNorm);
        if (set) {
          set.delete(res);
          if (set.size === 0) userClients.delete(emailNorm);
        }
      }
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
    // Set 1500ms reconnect interval for client EventSource
    res.write('retry: 1500\n\n');
    res.write(frame());
    clients.add(res);

    if (maxDurationMs > 0) {
      cycleTimer = setTimeout(() => {
        if (dropped) return;
        try {
          res.write(': cycle\n\n');
          res.end();
        } catch {}
        drop();
      }, maxDurationMs);
      if (cycleTimer.unref) cycleTimer.unref();
    }

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
      const targetEmail = String(notification.target_email || notification.targetEmail || '').trim().toLowerCase();
      if (targetEmail) {
        const targetSet = userClients.get(targetEmail);
        if (targetSet && targetSet.size > 0) {
          const chunk = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`;
          for (const c of targetSet) {
            try { c.write(chunk); } catch { clients.delete(c); }
          }
          return;
        }
      }
      write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
    } catch (e) {
      console.error('SSE broadcastNotification error:', e);
    }
  }

  const keepAlive = setInterval(() => write(': ka\n\n'), keepAliveMs);
  keepAlive.unref();

  function isUserOnline(email) {
    if (!email) return false;
    const set = userClients.get(String(email).trim().toLowerCase());
    return Boolean(set && set.size > 0);
  }

  function getOnlineEmails() {
    return Array.from(userClients.keys());
  }

  function close() {
    clearInterval(keepAlive);
    clearTimeout(timer);
    for (const c of clients) c.end();
    clients.clear();
    userClients.clear();
    connectionsPerIp.clear();
  }

  return {
    add,
    broadcast,
    broadcastNotification,
    close,
    size: () => clients.size,
    isUserOnline,
    getOnlineEmails,
  };
}
