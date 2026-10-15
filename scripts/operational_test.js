import { performance } from 'node:perf_hooks';

const BASE_URL = process.env.TARGET_URL || 'https://event-tracker-pied.vercel.app';

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};

const stats = (latencies) => {
  if (!latencies.length) return 'N/A';
  const min = Math.min(...latencies).toFixed(0);
  const max = Math.max(...latencies).toFixed(0);
  const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(0);
  const p50 = pct(latencies, 0.5).toFixed(0);
  const p90 = pct(latencies, 0.9).toFixed(0);
  const p95 = pct(latencies, 0.95).toFixed(0);
  const p99 = pct(latencies, 0.99).toFixed(0);
  return `avg: ${avg}ms | min: ${min}ms | p50: ${p50}ms | p90: ${p90}ms | p95: ${p95}ms | p99: ${p99}ms | max: ${max}ms`;
};

async function testSingleUrl(url, label) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'BenchmarkAgent/1.0' } });
    const ms = performance.now() - t0;
    const body = await res.arrayBuffer();
    const bytes = body.byteLength;
    return { status: res.statusCode || res.status, ms, bytes, headers: Object.fromEntries(res.headers.entries()) };
  } catch (err) {
    return { status: 0, ms: performance.now() - t0, bytes: 0, error: err.message };
  }
}

async function runLoadBatch(url, concurrency, totalRequests) {
  console.log(`\n--- Test tải đồng thời: Concurrency = ${concurrency}, Tổng = ${totalRequests} tới ${url} ---`);
  const latencies = [];
  const statusCodes = {};
  let totalBytes = 0;
  let errorCount = 0;
  let completed = 0;

  const tStart = performance.now();
  let queue = totalRequests;

  async function worker() {
    while (queue > 0) {
      queue--;
      const r = await testSingleUrl(url);
      latencies.push(r.ms);
      totalBytes += r.bytes;
      statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
      if (r.status !== 200 && r.status !== 304) {
        errorCount++;
      }
      completed++;
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  const totalDuration = (performance.now() - tStart) / 1000;
  const rps = (totalRequests / totalDuration).toFixed(1);
  const throughputKB = (totalBytes / 1024 / totalDuration).toFixed(2);
  const avgPayloadKB = (totalBytes / totalRequests / 1024).toFixed(2);

  console.log(`Thời gian chạy: ${totalDuration.toFixed(2)}s | RPS: ${rps} req/s | Băng thông: ${throughputKB} KB/s`);
  console.log(`Kích thước trung bình payload: ${avgPayloadKB} KB | Tổng dữ liệu tải: ${(totalBytes / 1024).toFixed(1)} KB`);
  console.log(`Mã HTTP: ${JSON.stringify(statusCodes)} | Lỗi: ${errorCount} (${((errorCount / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`Độ trễ: ${stats(latencies)}`);

  return { concurrency, totalRequests, totalDuration, rps, throughputKB, avgPayloadKB, statusCodes, errorCount, latencies };
}

async function testSseStream() {
  console.log('\n--- Kiểm tra kết nối SSE (/events) trên Vercel ---');
  const url = `${BASE_URL}/events`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s test

  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'text/event-stream' }
    });
    console.log(`SSE Status: ${res.status}`);
    console.log('SSE Headers:', {
      'content-type': res.headers.get('content-type'),
      'cache-control': res.headers.get('cache-control'),
      'x-vercel-cache': res.headers.get('x-vercel-cache'),
      'server': res.headers.get('server')
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let frameCount = 0;
    let initialMessageReceived = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('SSE Stream closed by server.');
        break;
      }
      const chunk = decoder.decode(value);
      frameCount++;
      if (!initialMessageReceived) {
        const timeToFirstMsg = (performance.now() - t0).toFixed(1);
        console.log(`First SSE event received in ${timeToFirstMsg}ms:`, chunk.slice(0, 80).replace(/\n/g, ' '));
        initialMessageReceived = true;
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('SSE stream hoạt động bình thường trong 8s kiểm tra (chủ động đóng client).');
    } else {
      console.error('SSE Error:', err.message);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  console.log(`================================================================`);
  console.log(`KIỂM THỬ VẬN HÀNH PRODUCTION: ${BASE_URL}`);
  console.log(`Thời gian: ${new Date().toISOString()}`);
  console.log(`================================================================`);

  // 1. Single-request sanity check
  const endpoints = ['/', '/api/state', '/api/stats', '/api/contacts', '/api/notifications'];
  console.log('\n1. ĐO LƯỜNG ĐƠN LẺ & BĂNG THÔNG ENDPOINTS:');
  for (const ep of endpoints) {
    const r = await testSingleUrl(`${BASE_URL}${ep}`);
    console.log(`- ${ep.padEnd(20)} HTTP ${r.status} | Latency: ${r.ms.toFixed(0).padStart(5)}ms | Size: ${(r.bytes / 1024).toFixed(2).padStart(6)} KB | Cache: ${r.headers?.['x-vercel-cache'] || 'MISS'}`);
  }

  // 2. Load test warm GET /api/state
  console.log('\n2. KIỂM THỬ TẢI ĐỒNG THỜI (CONCURRENCY & DELAY):');
  await runLoadBatch(`${BASE_URL}/api/state`, 10, 30);
  await runLoadBatch(`${BASE_URL}/api/state`, 30, 90);
  await runLoadBatch(`${BASE_URL}/api/state`, 50, 100);

  // 3. Load test GET /api/stats (read-heavy light endpoint)
  await runLoadBatch(`${BASE_URL}/api/stats`, 50, 150);

  // 4. Test SSE connection
  await testSseStream();

  console.log(`\n================================================================`);
  console.log(`HOÀN THÀNH BÀI KIỂM THỬ VẬN HÀNH`);
  console.log(`================================================================`);
}

main().catch(console.error);
