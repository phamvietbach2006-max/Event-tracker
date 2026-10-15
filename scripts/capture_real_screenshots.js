import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const PORT = 9333;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:5173';
const OUTPUT_DIR = 'C:\\Users\\phamv\\.gemini\\antigravity\\brain\\0e621399-7ded-426a-8568-e2d941443cb6\\real_shots';

mkdirSync(OUTPUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.callbacks = new Map();
    this.eventListeners = new Map();

    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
    });

    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      } else if (data.method) {
        const listeners = this.eventListeners.get(data.method) || [];
        listeners.forEach((fn) => fn(data.params));
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.eventListeners.has(method)) this.eventListeners.set(method, []);
    this.eventListeners.get(method).push(fn);
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async screenshot(filePath, clip = null) {
    const params = { format: 'png' };
    if (clip) params.clip = clip;
    const res = await this.send('Page.captureScreenshot', params);
    const buf = Buffer.from(res.data, 'base64');
    writeFileSync(filePath, buf);
    console.log(`[CAPTURED] Saved ${(buf.length / 1024).toFixed(1)} KB to: ${path.basename(filePath)}`);
  }

  close() {
    try { this.ws.close(); } catch {}
  }
}

async function startChrome() {
  const tmpDir = `C:\\Users\\phamv\\AppData\\Local\\Temp\\chrome_cdp_${Date.now()}`;
  const args = [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    `--user-data-dir=${tmpDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    'about:blank',
  ];

  const proc = spawn(CHROME_PATH, args, { stdio: 'ignore' });
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        const info = await res.json();
        console.log('[CHROME] Started successfully on port', PORT);
        return { proc, info };
      }
    } catch {}
    await sleep(200);
  }
  proc.kill();
  throw new Error('Chrome failed to start');
}

async function main() {
  console.log('=== KHỞI ĐỘNG HỆ THỐNG CHỤP MÀN HÌNH TỰ ĐỘNG CDP ===');
  const { proc, info } = await startChrome();

  try {
    const tabsRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const tabs = await tabsRes.json();
    const targetWs = tabs[0]?.webSocketDebuggerUrl || info.webSocketDebuggerUrl;

    const cdp = new CdpClient(targetWs);
    await cdp.ready;

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Runtime.enable');

    // 1. Navigate to main dashboard
    console.log('[NAV] Loading', TARGET_URL);
    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(3000);

    // Wait until rooms are rendered
    for (let i = 0; i < 20; i++) {
      const count = await cdp.eval('document.querySelectorAll("table tbody tr, .room-card, .group-header").length');
      if (count > 0) {
        console.log(`[DOM] Found ${count} rendered elements`);
        break;
      }
      await sleep(500);
    }
    await sleep(1500);

    // Set viewport: Desktop 1440x900
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });

    // Capture 01: Desktop Overview Dashboard
    await cdp.screenshot(path.join(OUTPUT_DIR, '01_desktop_dashboard_overview.png'));

    // Open Login Modal
    await cdp.eval(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Đăng nhập'));
      if (btn) btn.click();
    `);
    await sleep(800);
    await cdp.screenshot(path.join(OUTPUT_DIR, '02_login_modal.png'));

    // Close Login Modal by clicking backdrop or close button
    await cdp.eval(`
      const closeBtn = document.querySelector('.modal-close, button.close, .btn-close');
      if (closeBtn) closeBtn.click();
      else {
        const backdrop = document.querySelector('.modal-backdrop, .modal-overlay');
        if (backdrop) backdrop.click();
      }
    `);
    await sleep(500);

    // Now let's login programmatically as Admin by setting session cookie or state
    console.log('[AUTH] Authenticating as Admin for rich controls...');
    const loginRes = await cdp.eval(`
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bach.pv2414676@sis.hust.edu.vn', password: 'admin' })
      }).then(r => r.json()).catch(e => ({ error: e.message }))
    `);
    console.log('[AUTH RESULT]', loginRes?.ok ? 'Logged in as Admin!' : loginRes);

    // Reload page to apply session
    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(2500);

    // Capture 03: Admin Dashboard with full controls (Bell, Logs, Settings)
    await cdp.screenshot(path.join(OUTPUT_DIR, '03_admin_dashboard_controls.png'));

    // Open first room row/card to show details, checklist, and attendance
    await cdp.eval(`
      const row = document.querySelector('tbody tr, .room-card, .room-item');
      if (row) row.click();
    `);
    await sleep(1000);
    await cdp.screenshot(path.join(OUTPUT_DIR, '04_room_expanded_checklist.png'));

    // Emulate clicking on attendance and checklist to show green valid state
    await cdp.eval(`
      const attInput = document.querySelector('input[type="number"], input[placeholder*="Có mặt"]');
      if (attInput) {
        attInput.value = '32';
        attInput.dispatchEvent(new Event('input', { bubbles: true }));
        attInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const totalInput = document.querySelectorAll('input[type="number"]')[1];
      if (totalInput) {
        totalInput.value = '36';
        totalInput.dispatchEvent(new Event('input', { bubbles: true }));
        totalInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);
    await sleep(800);
    await cdp.screenshot(path.join(OUTPUT_DIR, '05_room_attendance_and_save_lock.png'));

    // Click Notification bell to open Notification Modal
    await cdp.eval(`
      const bell = document.querySelector('button[title*="thông báo"], .notif-bell, button[aria-label*="thông báo"]');
      if (bell) bell.click();
    `);
    await sleep(1000);
    await cdp.screenshot(path.join(OUTPUT_DIR, '06_notifications_list.png'));

    // Open Compose Notification Modal
    await cdp.eval(`
      const composeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Soạn thông báo') || b.textContent.includes('Gửi thông báo'));
      if (composeBtn) composeBtn.click();
    `);
    await sleep(800);
    await cdp.screenshot(path.join(OUTPUT_DIR, '07_notifications_compose.png'));

    // Close notifications modal
    await cdp.eval(`
      const closeBtns = document.querySelectorAll('.modal-close, button.close, [aria-label="Đóng"]');
      closeBtns.forEach(b => b.click());
    `);
    await sleep(500);

    // Open Logs view by clicking Logs on Sidebar or Header
    await cdp.eval(`
      const logsLink = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.includes('Nhật ký') || el.textContent.includes('Logs'));
      if (logsLink) logsLink.click();
    `);
    await sleep(1500);
    await cdp.screenshot(path.join(OUTPUT_DIR, '08_admin_audit_logs_desktop.png'));

    // ==========================================
    // MOBILE VIEWPORT EMULATION (iPhone 14 / 390x844)
    // ==========================================
    console.log('[MOBILE] Emulating iPhone viewport 390x844...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
      screenOrientation: { type: 'portraitPrimary', angle: 0 },
    });

    // Navigate to Mobile Dashboard
    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(2500);
    await cdp.screenshot(path.join(OUTPUT_DIR, '09_mobile_dashboard_overview.png'));

    // Open Room Card in Mobile
    await cdp.eval(`
      const card = document.querySelector('.room-card, .room-row, tr');
      if (card) card.click();
    `);
    await sleep(1000);
    await cdp.screenshot(path.join(OUTPUT_DIR, '10_mobile_room_card_details.png'));

    // Open Mobile Logs
    await cdp.eval(`
      const logsBtn = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent.includes('Nhật ký') || el.textContent.includes('Logs'));
      if (logsBtn) logsBtn.click();
    `);
    await sleep(1500);
    await cdp.screenshot(path.join(OUTPUT_DIR, '11_mobile_audit_logs_cards.png'));

    // Open Mobile Notifications
    await cdp.eval(`
      const bell = document.querySelector('button[title*="thông báo"], .notif-bell');
      if (bell) bell.click();
    `);
    await sleep(1000);
    await cdp.screenshot(path.join(OUTPUT_DIR, '12_mobile_notifications_modal.png'));

    console.log('=== HOÀN TẤT CHỤP MỌI MÀN HÌNH CHẤT LƯỢNG CAO ===');
    cdp.close();
  } catch (err) {
    console.error('[LỖI CHỤP MÀN HÌNH]', err);
  } finally {
    proc.kill();
  }
}

main().catch(console.error);
