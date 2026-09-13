const http = require('http');
const { spawn } = require('child_process');

async function testPage(url) {
  console.log(`\n=== Testing ${url} ===`);
  const chrome = spawn('google-chrome', [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    url
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetchJson('http://127.0.0.1:9222/json/list');
    const page = listRes[0];
    if (!page || !page.webSocketDebuggerUrl) {
      console.log('No page found in CDP');
      chrome.kill();
      return;
    }
    console.log('Connected to page:', page.title, page.url);
  } catch (err) {
    console.log('CDP error:', err.message);
  } finally {
    chrome.kill();
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

testPage('http://localhost:8000/admin.html');
