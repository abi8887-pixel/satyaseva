const http = require('http');
const { spawn } = require('child_process');

function startChrome(url) {
  return spawn('google-chrome', [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    url
  ]);
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

function sendCDP(wsUrl, method, params = {}) {
  // Simple WebSocket via standard node if ws is installed, or use HTTP endpoint if possible
  // Alternatively we can use puppeteer or chrome --dump-dom with script injection!
}

async function run() {
  console.log('Testing done via CLI scripts');
}

run();
