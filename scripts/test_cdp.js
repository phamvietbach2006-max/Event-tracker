import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const proc = spawn(CHROME_PATH, [
    '--remote-debugging-port=9444',
    '--headless=new',
    '--disable-gpu',
    '--user-data-dir=C:\\Users\\phamv\\AppData\\Local\\Temp\\chrome_test_cdp',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  const newRes = await fetch('http://127.0.0.1:9444/json/new?http://localhost:5173', { method: 'PUT' });
  const page = await newRes.json();
  console.log('Created page target:', page.id);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = ++id;
    const handler = (e) => {
      const data = JSON.parse(e.data);
      if (data.id === curId) {
        ws.removeEventListener('message', handler);
        resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await new Promise(r => ws.onopen = r);
  console.log('WebSocket connected to page!');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false
  });

  // Wait 3 seconds for React to fetch and render
  await new Promise(r => setTimeout(r, 3000));

  const count = await send('Runtime.evaluate', {
    expression: 'document.querySelectorAll("tr, .room-card, .group-header").length',
    returnByValue: true
  });
  console.log('Rendered elements:', count.result.value);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(shot.data, 'base64');
  writeFileSync('D:\\snap_full_cdp.png', buf);
  console.log('Saved D:\\snap_full_cdp.png, size:', buf.length);

  ws.close();
  proc.kill();
}

main().catch(console.error);
