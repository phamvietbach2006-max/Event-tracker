import { performance } from 'node:perf_hooks';

const BASE_URL = 'https://event-tracker-pied.vercel.app';

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};

async function fetchWithStats(url, options = {}) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, options);
    const ms = performance.now() - t0;
    const body = await res.arrayBuffer();
    return {
      ok: res.ok,
      status: res.status,
      ms,
      bytes: body.byteLength,
      encoding: res.headers.get('content-encoding') || 'none',
      cache: res.headers.get('x-vercel-cache') || 'none',
      ray: res.headers.get('x-vercel-id') || '',
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      ms: performance.now() - t0,
      bytes: 0,
      error: err.message,
    };
  }
}

async function stressEndpoint(name, url, concurrency, total, options = {}) {
  console.log(`\n======================================================`);
  console.log(`STRESS TEST: ${name}`);
  console.log(`URL: ${url}`);
  console.log(`Concurrency: ${concurrency} | Total: ${total}`);
  console.log(`======================================================`);

  let count = total;
  const results = [];
  const tStart = performance.now();

  const worker = async () => {
    while (count > 0) {
      count--;
      const r = await fetchWithStats(url, options);
      results.push(r);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  const totalMs = performance.now() - tStart;
  const durSec = totalMs / 1000;

  const latencies = results.map(r => r.ms);
  const totalBytes = results.reduce((acc, r) => acc + r.bytes, 0);
  const successCount = results.filter(r => r.ok).length;
  const statusCodes = {};
  for (const r of results) {
    statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
  }

  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1);
  const p50 = pct(latencies, 0.5).toFixed(1);
  const p90 = pct(latencies, 0.9).toFixed(1);
  const p95 = pct(latencies, 0.95).toFixed(1);
  const p99 = pct(latencies, 0.99).toFixed(1);
  const minLatency = Math.min(...latencies).toFixed(1);
  const maxLatency = Math.max(...latencies).toFixed(1);

  const rps = (total / durSec).toFixed(1);
  const bandwidthKBps = (totalBytes / 1024 / durSec).toFixed(1);
  const avgPayloadKB = (totalBytes / total / 1024).toFixed(2);

  console.log(`Tổng thời gian: ${durSec.toFixed(2)}s`);
  console.log(`Tỷ lệ thành công: ${successCount}/${total} (${((successCount / total) * 100).toFixed(1)}%)`);
  console.log(`Phân bố HTTP Status:`, JSON.stringify(statusCodes));
  console.log(`RPS (Req/sec): ${rps}`);
  console.log(`Băng thông: ${bandwidthKBps} KB/s (Tổng: ${(totalBytes / 1024).toFixed(1)} KB)`);
  console.log(`Dung lượng trung bình / response: ${avgPayloadKB} KB`);
  console.log(`Độ trễ: Min=${minLatency}ms | Avg=${avgLatency}ms | P50=${p50}ms | P90=${p90}ms | P95=${p95}ms | P99=${p99}ms | Max=${maxLatency}ms`);

  return {
    name,
    concurrency,
    total,
    durSec,
    successRate: (successCount / total) * 100,
    rps: Number(rps),
    bandwidthKBps: Number(bandwidthKBps),
    avgPayloadKB: Number(avgPayloadKB),
    avgLatency: Number(avgLatency),
    p50: Number(p50),
    p90: Number(p90),
    p95: Number(p95),
    p99: Number(p99),
    maxLatency: Number(maxLatency),
    statusCodes,
  };
}

async function run() {
  const reports = [];

  // 1. Static Assets & HTML (Root)
  reports.push(await stressEndpoint('Root HTML', `${BASE_URL}/`, 20, 100));

  // 2. Heavy Endpoint: /api/state at 20 concurrency
  reports.push(await stressEndpoint('/api/state (Tải bình thường - 20 CC)', `${BASE_URL}/api/state`, 20, 60));

  // 3. Heavy Endpoint: /api/state at 50 concurrency
  reports.push(await stressEndpoint('/api/state (Tải cao điểm - 50 CC)', `${BASE_URL}/api/state`, 50, 100));

  // 4. Lightweight Endpoint: /api/stats at 50 concurrency
  reports.push(await stressEndpoint('/api/stats (50 CC)', `${BASE_URL}/api/stats`, 50, 200));

  // 5. Directory/Contacts: /api/contacts at 20 concurrency
  reports.push(await stressEndpoint('/api/contacts (20 CC)', `${BASE_URL}/api/contacts`, 20, 80));

  // 6. Notifications: /api/notifications at 30 concurrency
  reports.push(await stressEndpoint('/api/notifications (30 CC)', `${BASE_URL}/api/notifications`, 30, 90));

  console.log('\n\n======================================================');
  console.log('TỔNG HỢP KẾT QUẢ KIỂM THỬ VẬN HÀNH');
  console.log('======================================================');
  console.table(reports.map(r => ({
    'Kịch bản': r.name,
    'Đồng thời': r.concurrency,
    'Tổng req': r.total,
    'Thành công': `${r.successRate.toFixed(1)}%`,
    'RPS': r.rps,
    'Băng thông (KB/s)': r.bandwidthKBps,
    'P50 (ms)': r.p50,
    'P90 (ms)': r.p90,
    'P95 (ms)': r.p95,
    'Max (ms)': r.maxLatency,
  })));
}

run().catch(console.error);
