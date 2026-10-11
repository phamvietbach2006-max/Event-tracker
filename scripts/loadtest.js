#!/usr/bin/env node
// Test tải, không phụ thuộc thư viện. Ví dụ:
//   node scripts/loadtest.js --url http://127.0.0.1:3917 --sse 300 --readers 50 --seconds 20
//   node scripts/loadtest.js --url http://sk.dyclub.tech --sse 200 --readers 30 --write --cookie "sid=..."
// Mặc định CHỈ ĐỌC. --write sẽ sửa dòng status của khu đầu tiên (cần --cookie của admin) và đo độ trễ lan tới mọi client SSE.
import http from 'node:http';
import { performance } from 'node:perf_hooks';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => {
  if (x.startsWith('--')) a.push([x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return a;
}, []));
const base = new URL(args.url || 'http://127.0.0.1:3000');
const NSSE = Number(args.sse ?? 100);
const NREAD = Number(args.readers ?? 20);
const SECS = Number(args.seconds ?? 15);
const WRITE = !!args.write;
const cookie = args.cookie || '';
const agent = new http.Agent({ keepAlive: true, maxSockets: 200 });

const pct = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN);
const fmt = (a) => `p50=${pct(a, 0.5).toFixed(0)}ms p95=${pct(a, 0.95).toFixed(0)}ms p99=${pct(a, 0.99).toFixed(0)}ms max=${Math.max(...a, 0).toFixed(0)}ms`;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: base.hostname, port: base.port || 80, path, method, agent,
      headers: { ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}), ...(cookie ? { cookie } : {}), origin: base.origin },
    }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; });
      res.on('end', () => resolve({ status: res.statusCode, ms: performance.now() - t0, body: b }));
    });
    req.on('error', reject);
    req.end(data);
  });
}

const sse = { open: 0, failed: 0, frames: 0, gotNote: new Map() };
let marker = null; // chuỗi note đang chờ lan truyền
const fanout = [];
let sentAt = 0;
function openSse() {
  return new Promise((resolve) => {
    const req = http.get({ host: base.hostname, port: base.port || 80, path: '/events', agent: false }, (res) => {
      if (res.statusCode !== 200) { sse.failed++; res.resume(); return resolve(); }
      sse.open++; resolve();
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        buf += c; sse.frames++;
        if (marker && buf.includes(marker)) { fanout.push(performance.now() - sentAt); marker = null; sse.gotNote.set(req, true); buf = ''; }
        if (buf.length > 1e6) buf = buf.slice(-1000);
      });
      res.on('error', () => { sse.open--; });
    });
    req.on('error', () => { sse.failed++; resolve(); });
  });
}

async function main() {
  console.log(`Mục tiêu ${base.origin} | SSE ${NSSE} | readers ${NREAD} | ${SECS}s | ghi: ${WRITE ? 'CÓ' : 'không'}`);
  const t0 = performance.now();
  for (let i = 0; i < NSSE; i += 50) await Promise.all(Array.from({ length: Math.min(50, NSSE - i) }, openSse));
  console.log(`SSE mở: ${sse.open}/${NSSE} (lỗi ${sse.failed}) trong ${(performance.now() - t0).toFixed(0)}ms`);

  const lat = []; let errs = 0, codes = {}; const end = Date.now() + SECS * 1000;
  const readers = Array.from({ length: NREAD }, async () => {
    while (Date.now() < end) {
      try { const r = await request('GET', '/api/state'); lat.push(r.ms); codes[r.status] = (codes[r.status] || 0) + 1; if (r.status !== 200) errs++; } catch { errs++; }
    }
  });

  // Đo độ lan truyền: mỗi nhịp ghi 1 note rồi đợi frame SSE tới (chỉ đo client đầu tiên nhận để biết độ trễ tối thiểu; kèm số client nhận)
  const writes = []; let writeErr = 0;
  const writer = WRITE ? (async () => {
    const st = JSON.parse((await request('GET', '/api/state')).body);
    const roomId = st.groups.flatMap((g) => g.rooms)[0].id;
    let i = 0;
    while (Date.now() < end) {
      marker = `LT${Date.now()}x${i++}`; sentAt = performance.now();
      const r = await request('PATCH', `/api/rooms/${roomId}/note`, { note: marker });
      if (r.status !== 200) { writeErr++; marker = null; } else writes.push(r.ms);
      await new Promise((r2) => setTimeout(r2, 500));
    }
  })() : Promise.resolve();

  await Promise.all([...readers, writer]);

  console.log('\n=== KẾT QUẢ ===');
  console.log(`GET /api/state: ${lat.length} yêu cầu (${(lat.length / SECS).toFixed(0)}/s), lỗi ${errs}, mã ${JSON.stringify(codes)}`);
  console.log(`  độ trễ: ${fmt(lat)}`);
  if (WRITE) {
    console.log(`PATCH note: ${writes.length} lần, lỗi ${writeErr}; độ trễ ghi: ${fmt(writes)}`);
    console.log(`Lan truyền SSE (từ lúc gửi tới khi client đầu nhận): ${fmt(fanout)}  (${fanout.length}/${writes.length + writeErr} nhịp có nhận)`);
  }
  console.log(`SSE còn mở cuối bài: ${sse.open}/${NSSE}, tổng gói nhận ${sse.frames}`);
  const ok = errs === 0 && sse.failed === 0 && (!WRITE || (writeErr === 0 && fanout.length > 0)) && pct(lat, 0.95) < 500;
  console.log(ok ? 'ĐẠT (p95 < 500ms, không lỗi)' : 'KHÔNG ĐẠT');
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
