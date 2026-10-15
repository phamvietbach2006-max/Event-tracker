import { Buffer } from 'node:buffer';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

export function send(res, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body);
  const cacheControl = res.getHeader?.('Cache-Control') || extraHeaders?.['Cache-Control'] || 'no-store';
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheControl,
    'Content-Length': Buffer.byteLength(data),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...extraHeaders,
  });
  res.end(data);
}

export async function readJson(req, limit = 16 * 1024) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    if (Array.isArray(req.body)) {
      throw new HttpError(400, 'bad_json', 'Body phải là một đối tượng JSON');
    }
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      const v = JSON.parse(req.body);
      if (v === null || typeof v !== 'object' || Array.isArray(v)) {
        throw new HttpError(400, 'bad_json', 'Body phải là một đối tượng JSON');
      }
      return v;
    } catch {
      throw new HttpError(400, 'bad_json', 'JSON không hợp lệ');
    }
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size <= limit) chunks.push(c); // quá giới hạn nhỏ: vẫn đọc hết để client nhận được mã 413
    else if (size > limit * 4) {
      req.destroy?.();
      throw new HttpError(413, 'too_large', 'Dữ liệu gửi lên quá lớn');
    }
  }
  if (size > limit) throw new HttpError(413, 'too_large', 'Dữ liệu gửi lên quá lớn');
  if (!size) return {};
  let v;
  try {
    v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'bad_json', 'JSON không hợp lệ');
  }
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new HttpError(400, 'bad_json', 'Body phải là một đối tượng JSON');
  }
  return v;
}

export function createRouter() {
  const routes = [];
  return {
    add(method, pattern, handler) {
      const names = [];
      const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
      routes.push({ method, re, names, handler });
    },
    match(method, path) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(path);
        if (!m) continue;
        try {
          return { handler: r.handler, params: Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}

export function checkOrigin(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const o = req.headers.origin ?? req.headers.referer;
  if (!o) return;
  let host = null;
  try { host = new URL(o).host; } catch {
    throw new HttpError(403, 'bad_origin', 'Nguồn yêu cầu không hợp lệ');
  }

  // Cho phép chạy local dev giữa frontend (localhost:5173) và backend (127.0.0.1:3000 / localhost:3000)
  const isLocalOrigin = /^localhost(:\d+)?$/i.test(host) || /^127\.0\.0\.1(:\d+)?$/i.test(host);
  const isLocalHost = /^localhost(:\d+)?$/i.test(req.headers.host) || /^127\.0\.0\.1(:\d+)?$/i.test(req.headers.host);
  if (isLocalOrigin && isLocalHost) return;

  const targetHost = req.headers['x-forwarded-host'] ?? req.headers.host;
  if (host !== targetHost && host !== req.headers.host) throw new HttpError(403, 'bad_origin', 'Nguồn yêu cầu không hợp lệ');
}
