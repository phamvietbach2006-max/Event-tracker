export function createSse(getState, { debounceMs = 100, keepAliveMs = 25000 } = {}) {
  const clients = new Set();
  let timer = null;

  const frame = () => `data: ${JSON.stringify(getState())}\n\n`;

  function add(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(frame());
    clients.add(res);
    const drop = () => clients.delete(res);
    req.on('close', drop);
    res.on('error', drop);
  }

  function write(chunk) {
    for (const c of [...clients]) {
      try { c.write(chunk); } catch { clients.delete(c); }
    }
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

  const keepAlive = setInterval(() => write(': ka\n\n'), keepAliveMs);
  keepAlive.unref();

  function close() {
    clearInterval(keepAlive);
    clearTimeout(timer);
    for (const c of clients) c.end();
    clients.clear();
  }

  return { add, broadcast, close, size: () => clients.size };
}
