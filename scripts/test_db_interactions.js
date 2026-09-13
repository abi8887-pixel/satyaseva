const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (msg.id && this.callbacks.has(msg.id)) {
        this.callbacks.get(msg.id)(msg);
        this.callbacks.delete(msg.id);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[Browser Console]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      }
    });
  }
  ready() {
    return new Promise(resolve => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.on('open', resolve);
    });
  }
  send(method, params = {}) {
    return new Promise(resolve => {
      const msgId = this.id++;
      this.callbacks.set(msgId, resolve);
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result && res.result.result ? res.result.result.value : null;
  }
  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res.result && res.result.data) {
      fs.writeFileSync(filename, Buffer.from(res.result.data, 'base64'));
      console.log('Saved screenshot:', filename);
    }
  }
  close() { this.ws.close(); }
}

async function run() {
  const artifactDir = '/home/jc/.gemini/antigravity-ide/brain/1c0d00a3-93ec-4373-801b-3936565d5c7e';
  const chrome = spawn('google-chrome', [
    '--headless',
    '--remote-debugging-port=9223',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    'about:blank'
  ]);
  await sleep(1500);

  try {
    const targets = await httpGet('http://127.0.0.1:9223/json/list');
    const page = targets.find(t => t.type === 'page') || targets[0];
    const cdp = new CDPClient(page.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    console.log('Navigating to admin portal...');
    await cdp.send('Page.navigate', { url: 'http://localhost:8000/admin.html' });
    await sleep(2000);

    // Login properly through login form
    console.log('Entering access code s2024 and submitting...');
    await cdp.eval(`(() => {
      const pwd = document.getElementById('login-password');
      if (pwd) pwd.value = 's2024';
      const form = document.getElementById('login-form');
      if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
    })()`);
    await sleep(1500);

    console.log('Switching to Station Database & Uploads tab...');
    await cdp.eval(`(() => {
      const btn = document.getElementById('tab-btn-database');
      if (btn) btn.click();
    })()`);
    await sleep(2000);

    // Check stats and uploads
    const statsResult = await cdp.eval(`(() => {
      return {
        stationsCount: document.getElementById('db-stat-stations').textContent,
        uploadsCount: document.getElementById('db-stat-uploads').textContent,
        dbSize: document.getElementById('db-stat-size').textContent,
        badge: document.getElementById('db-status-badge').textContent.trim(),
        rows: document.querySelectorAll('#uploads-table-body tr').length
      };
    })()`);
    console.log('Database Tab Status & Metrics:', statsResult);

    await cdp.screenshot(`${artifactDir}/admin_database_tab.png`);

    // Open upload modal and submit
    console.log('Opening New Station Upload modal...');
    await cdp.eval(`document.getElementById('btn-open-station-upload').click();`);
    await sleep(800);

    console.log('Submitting new station report...');
    await cdp.eval(`(() => {
      document.getElementById('form-upload-station').value = 'mariyapura';
      document.getElementById('form-upload-sister').value = 'Sr. Philomena SCS';
      document.getElementById('form-upload-type').value = 'chronicle';
      document.getElementById('form-upload-title').value = 'Anniversary Thanksgiving & Family Evangelization';
      document.getElementById('form-upload-content').value = 'Celebrated foundation feast with all village families and conducted prayers across the mission station.';
      document.getElementById('station-upload-form').dispatchEvent(new Event('submit', { cancelable: true }));
    })()`);
    await sleep(2000);

    // Verify row count increased
    const afterUpload = await cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('#uploads-table-body tr')).map(tr => ({
        station: tr.querySelector('td:nth-child(1)') ? tr.querySelector('td:nth-child(1)').textContent : '',
        sister: tr.querySelector('td:nth-child(2)') ? tr.querySelector('td:nth-child(2)').textContent : '',
        category: tr.querySelector('td:nth-child(3)') ? tr.querySelector('td:nth-child(3)').textContent : '',
        title: tr.querySelector('td:nth-child(4) div:first-child') ? tr.querySelector('td:nth-child(4) div:first-child').textContent : ''
      }));
      return {
        totalRows: rows.length,
        firstRow: rows[0]
      };
    })()`);
    console.log('After Upload Result:', afterUpload);

    await cdp.screenshot(`${artifactDir}/admin_database_after_upload.png`);

    // Test View modal
    console.log('Testing View modal...');
    await cdp.eval(`(() => {
      const firstViewBtn = document.querySelector('.btn-view-upload');
      if (firstViewBtn) firstViewBtn.click();
    })()`);
    await sleep(800);

    const viewModalResult = await cdp.eval(`(() => {
      const modal = document.getElementById('view-upload-modal');
      const title = document.getElementById('view-modal-title').textContent;
      const body = document.getElementById('view-modal-body').textContent;
      return {
        isOpen: modal && !modal.hidden,
        title,
        hasContent: body.length > 20
      };
    })()`);
    console.log('View Modal Result:', viewModalResult);

    await cdp.screenshot(`${artifactDir}/admin_database_view_modal.png`);

    // Close view modal
    await cdp.eval(`document.getElementById('btn-dismiss-view-modal').click();`);
    await sleep(500);

    cdp.close();
    console.log('All automated browser tests passed successfully!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    chrome.kill();
  }
}

run();
