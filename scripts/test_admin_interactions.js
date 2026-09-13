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
    }
  }
  close() { this.ws.close(); }
}

async function run() {
  const chrome = spawn('google-chrome', [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    'about:blank'
  ]);
  await sleep(1500);

  try {
    const targets = await httpGet('http://127.0.0.1:9222/json/list');
    const page = targets.find(t => t.type === 'page') || targets[0];
    const cdp = new CDPClient(page.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    await cdp.send('Page.navigate', { url: 'http://localhost:8000/admin.html' });
    await sleep(2000);

    // Login
    await cdp.eval(`
      document.getElementById('login-password').value = 's2024';
      document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true }));
    `);
    await sleep(1500);

    // Click first community
    const clickResult = await cdp.eval(`(() => {
      const firstLi = document.querySelector('#community-list li');
      if (firstLi) firstLi.click();
      const editorH2 = document.querySelector('#editor h2');
      const deleteBtn = document.querySelector('.delete-community-btn');
      const nameInput = document.querySelector('[data-field="name"]');
      return {
        selectedName: firstLi ? firstLi.textContent.trim() : null,
        editorTitle: editorH2 ? editorH2.textContent.trim() : null,
        hasDeleteBtn: !!deleteBtn,
        communityNameValue: nameInput ? nameInput.value : null
      };
    })()`);
    console.log('Select Community Result:', JSON.stringify(clickResult, null, 2));

    await cdp.screenshot('/home/jc/.gemini/antigravity-ide/brain/bd6fae7f-582d-4860-9abb-23a1c8e0153a/admin_selected_community.png');

    // Test tab switch to Memorial
    await cdp.eval(`document.getElementById('tab-btn-memorial').click();`);
    await sleep(1500);
    const memResult = await cdp.eval(`(() => {
      const memList = document.getElementById('memorial-admin-list');
      const items = Array.from(memList ? memList.querySelectorAll('li') : []).map(li => li.textContent.trim());
      return {
        memorialCount: items.length,
        firstTwoSisters: items.slice(0, 2)
      };
    })()`);
    console.log('Memorial Tab Switch Result:', JSON.stringify(memResult, null, 2));

    await cdp.screenshot('/home/jc/.gemini/antigravity-ide/brain/bd6fae7f-582d-4860-9abb-23a1c8e0153a/admin_memorial_tab.png');

    cdp.close();
  } finally {
    chrome.kill();
  }
}

run();
