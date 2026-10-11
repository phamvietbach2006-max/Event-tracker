// Event room tracker: zero-dependency Node server, realtime via SSE, JSON-file persistence.
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, 'data.json');
const uid = () => Math.random().toString(36).slice(2, 9);
const mk = (name, tasks) => ({ id: uid(), name, status: 'todo', note: '', updatedAt: Date.now(),
  tasks: tasks.map(t => ({ id: uid(), text: t, done: false })) });
const common = ['Vệ sinh, sắp xếp bàn ghế', 'Kiểm tra âm thanh / micro', 'Kiểm tra máy chiếu / màn hình', 'Kiểm tra ánh sáng', 'Standee, backdrop, bảng chỉ dẫn', 'Nhân sự trực đã có mặt'];
let state = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8'))
  : { rooms: ['Hội trường C2', 'Sảnh C2', 'Phòng họp C2-1', 'Khu đón tiếp'].map(n => mk(n, common)) };
let timer;
const save = () => { clearTimeout(timer); timer = setTimeout(() => fs.writeFile(DB, JSON.stringify(state, null, 1), () => {}), 200); };
const clients = new Set();
const broadcast = () => { save(); const d = `data: ${JSON.stringify(state)}\n\n`; clients.forEach(c => c.write(d)); };
const STATUSES = ['todo', 'doing', 'ready', 'issue'];

function api(req, res, body) {
  const p = req.url.split('?')[0].split('/').filter(Boolean); // api, rooms, :id, ...
  const room = state.rooms.find(r => r.id === p[2]);
  const touch = r => { r.updatedAt = Date.now(); };
  if (req.method === 'POST' && p[1] === 'rooms' && !p[2]) {
    if (!body.name) return false; state.rooms.push(mk(body.name, body.tasks || [])); return true;
  }
  if (!room) return false;
  if (req.method === 'DELETE' && !p[3]) { state.rooms = state.rooms.filter(r => r !== room); return true; }
  if (req.method === 'PATCH' && !p[3]) {
    if (body.status && STATUSES.includes(body.status)) room.status = body.status;
    if (typeof body.note === 'string') room.note = body.note.slice(0, 300);
    if (typeof body.name === 'string' && body.name.trim()) room.name = body.name.trim();
    touch(room); return true;
  }
  if (p[3] === 'tasks') {
    if (req.method === 'POST') { if (!body.text) return false; room.tasks.push({ id: uid(), text: body.text, done: false }); touch(room); return true; }
    const t = room.tasks.find(t => t.id === p[4]); if (!t) return false;
    if (req.method === 'PATCH') { if (typeof body.done === 'boolean') t.done = body.done; touch(room); return true; }
    if (req.method === 'DELETE') { room.tasks = room.tasks.filter(x => x !== t); touch(room); return true; }
  }
  return false;
}

http.createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(state)}\n\n`); clients.add(res);
    const ka = setInterval(() => res.write(': ka\n\n'), 25000);
    return req.on('close', () => { clients.delete(res); clearInterval(ka); });
  }
  if (req.url.startsWith('/api/')) {
    let raw = ''; req.on('data', c => raw += c);
    return req.on('end', () => {
      let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch {}
      const ok = api(req, res, body); if (ok) broadcast();
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' }); res.end('{}');
    });
  }
  fs.readFile(path.join(__dirname, 'public', 'index.html'), (e, d) => {
    res.writeHead(e ? 500 : 200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d);
  });
}).listen(PORT, () => console.log('http://localhost:' + PORT));
