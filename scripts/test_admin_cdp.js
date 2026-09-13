const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    this.events = [];
    this.ws.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (msg.id && this.callbacks.has(msg.id)) {
        this.callbacks.get(msg.id)(msg);
        this.callbacks.delete(msg.id);
      } else {
        this.events.push(msg);
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('[Browser Console]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
        }
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
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result && res.result.result ? res.result.result.value : null;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res.result && res.result.data) {
      fs.writeFileSync(filename, Buffer.from(res.result.data, 'base64'));
      console.log(`Saved screenshot to ${filename}`);
    }
  }

  close() {
    this.ws.close();
  }
}

async function testUrl(targetUrl, label) {
  console.log(`\n========================================`);
  console.log(`Testing: ${label} (${targetUrl})`);
  console.log(`========================================`);

  const chrome = spawn('google-chrome', [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    'about:blank'
  ]);

  await sleep(1500);

  try {
    const targets = await httpGet('http://127.0.0.1:9222/json/list');
    const page = targets.find(t => t.type === 'page') || targets[0];
    if (!page || !page.webSocketDebuggerUrl) {
      console.error('Failed to get page debugger URL');
      return;
    }

    const cdp = new CDPClient(page.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    console.log(`Navigating to ${targetUrl}...`);
    await cdp.send('Page.navigate', { url: targetUrl });
    await sleep(2000);

    // 1. Check if login gate is visible
    const gateVisible = await cdp.eval(`
      const gate = document.getElementById('login-gate');
      gate && !gate.hidden && getComputedStyle(gate).display !== 'none';
    `);
    console.log('Login gate visible:', gateVisible);

    if (gateVisible) {
      console.log('Entering access code s2024...');
      await cdp.eval(`
        document.getElementById('login-password').value = 's2024';
        document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true }));
      `);
      await sleep(2000);
    }

    // 2. Check admin interface state
    const appState = await cdp.eval(`
      const app = document.getElementById('admin-app');
      const commList = document.getElementById('community-list');
      const items = Array.from(commList ? commList.querySelectorAll('li') : []).map(li => li.textContent.trim());
      const toasts = Array.from(document.querySelectorAll('.toast')).map(t => ({ text: t.textContent.trim(), class: t.className }));
      const editorHeader = document.querySelector('#editor h2');
      const deleteCommBtn = document.querySelector('.delete-community-btn');

      ({
        appVisible: app && !app.hidden && getComputedStyle(app).display !== 'none',
        communityCount: items.length,
        firstThree: items.slice(0, 3),
        toasts: toasts,
        editorTitle: editorHeader ? editorHeader.textContent.trim() : null,
        hasDeleteBtn: !!deleteCommBtn
      });
    `);

    console.log('Admin App State:', JSON.stringify(appState, null, 2));

    // 3. Test clicking "+ Add" community button
    console.log('Testing "+ Add" community button...');
    const addState = await cdp.eval(`
      const btn = document.getElementById('btn-add-community');
      if (btn) {
        btn.click();
      }
      const commList = document.getElementById('community-list');
      const items = Array.from(commList ? commList.querySelectorAll('li') : []).map(li => li.textContent.trim());
      const activeLi = commList ? commList.querySelector('li.active') : null;
      const deleteCommBtn = document.querySelector('.delete-community-btn');
      ({
        clicked: !!btn,
        newCount: items.length,
        activeItem: activeLi ? activeLi.textContent.trim() : null,
        hasDeleteBtn: !!deleteCommBtn
      });
    `);
    console.log('Add Community Result:', JSON.stringify(addState, null, 2));

    // Capture screenshot
    const shotPath = `/home/jc/.gemini/antigravity-ide/brain/bd6fae7f-582d-4860-9abb-23a1c8e0153a/admin_test_${label}.png`;
    await cdp.screenshot(shotPath);

    cdp.close();
  } catch (err) {
    console.error('CDP test error:', err);
  } finally {
    chrome.kill();
  }
}

async function main() {
  // Test 1: Python Server on port 8000
  await testUrl('http://localhost:8000/admin.html', 'port8000');
  await sleep(1000);

  // Test 2: Live Server on port 5500
  await testUrl('http://localhost:5500/sscs/site/admin.html', 'port5500');
}

main();
