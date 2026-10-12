import { Buffer } from 'node:buffer';

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

export function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

export async function readJson(req, limit = 16 * 1024) {
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
  try { host = new URL(o).host; } catch { /* host = null */ }
  if (host !== req.headers.host) throw new HttpError(403, 'bad_origin', 'Nguồn yêu cầu không hợp lệ');
}
