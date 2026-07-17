#!/usr/bin/env node
/**
 * Mineradio Mobile Server
 * - Serves PWA static files
 * - Proxies /api/* to the original server.js
 * - Adds mobile-friendly login endpoints (phone login, cookie management)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..', 'www');
const COOKIE_FILE = process.env.COOKIE_FILE || path.join(__dirname, '.cookie');
const QQ_COOKIE_FILE = process.env.QQ_COOKIE_FILE || path.join(__dirname, '.qq-cookie');

// Start the original server as a child process
const originalServer = spawn('node', [path.join(__dirname, 'server.js')], {
  env: {
    ...process.env,
    PORT: String(PORT + 1),
    HOST: '127.0.0.1',
    COOKIE_FILE: COOKIE_FILE,
    QQ_COOKIE_FILE: QQ_COOKIE_FILE,
  },
  stdio: 'inherit',
});

console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║        🎵 Mineradio Mobile Server 🎵            ║');
console.log('╠══════════════════════════════════════════════════╣');
console.log('║  API Proxy  : http://127.0.0.1:' + (PORT + 1) + '              ║');
console.log('║  PWA + Login: http://' + HOST + ':' + PORT + '          ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('');

// ============================================================
//  Mobile Login API (Netease phone login)
// ============================================================
let NeteaseAPI = null;
try {
  NeteaseAPI = require('NeteaseCloudMusicApi');
} catch (e) {
  console.log('[Mobile] NeteaseCloudMusicApi not available, phone login disabled');
}

function jsonReply(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { resolve({ raw: body }); }
    });
  });
}

function saveCookie(provider, cookieStr) {
  const file = provider === 'qq' ? QQ_COOKIE_FILE : COOKIE_FILE;
  try {
    fs.writeFileSync(file, cookieStr, 'utf8');
    console.log('[Mobile] Cookie saved for', provider);
    return true;
  } catch (e) {
    console.error('[Mobile] Failed to save cookie:', e.message);
    return false;
  }
}

// ============================================================
//  MIME types
// ============================================================
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

// ============================================================
//  Main server
// ============================================================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // ---- Mobile Login Endpoints ----

  // POST /api/login/cellphone — Netease phone number login
  if (url.pathname === '/api/login/cellphone' && req.method === 'POST') {
    if (!NeteaseAPI) {
      jsonReply(res, 500, { code: 500, message: 'NeteaseCloudMusicApi not loaded' });
      return;
    }
    try {
      const body = await readBody(req);
      const { phone, password, captcha, countrycode } = body || {};
      if (!phone || (!password && !captcha)) {
        jsonReply(res, 400, { code: 400, message: '请提供手机号和密码或验证码' });
        return;
      }
      console.log('[Mobile] Phone login attempt for:', phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'));
      const CryptoJS = require('crypto-js');
      const loginQuery = {
        phone: phone,
        countrycode: countrycode || '86',
        timestamp: Date.now(),
      };
      if (captcha) {
        loginQuery.captcha = captcha;
      } else if (password) {
        loginQuery.md5_password = CryptoJS.MD5(password).toString();
      }
      const result = await NeteaseAPI.login_cellphone(loginQuery);
      if (result.body && result.body.cookie) {
        saveCookie('netease', result.body.cookie);
        jsonReply(res, 200, {
          code: 200,
          message: '登录成功',
          account: result.body.account || {},
          profile: result.body.profile || {},
        });
      } else if (result.body && result.body.code === 501) {
        jsonReply(res, 400, { code: 501, message: '需要短信验证码，请先获取验证码' });
      } else if (result.body && result.body.code === 502) {
        jsonReply(res, 400, { code: 502, message: '验证码错误' });
      } else {
        jsonReply(res, 400, {
          code: result.body && result.body.code || -1,
          message: (result.body && result.body.message) || '登录失败，请检查手机号和密码',
        });
      }
    } catch (e) {
      console.error('[Mobile] Phone login error:', e);
      jsonReply(res, 500, { code: 500, message: '服务器错误: ' + (e.body && e.body.message || e.message || String(e)) });
    }
    return;
  }

  // POST /api/login/cellphone/captcha — send SMS code
  if (url.pathname === '/api/login/cellphone/captcha' && req.method === 'POST') {
    if (!NeteaseAPI) {
      jsonReply(res, 500, { code: 500, message: 'NeteaseCloudMusicApi not loaded' });
      return;
    }
    try {
      const body = await readBody(req);
      const { phone, countrycode } = body || {};
      if (!phone) {
        jsonReply(res, 400, { code: 400, message: '请提供手机号' });
        return;
      }
      // Use captcha_sent to send SMS verification code
      const sent = await NeteaseAPI.captcha_sent({
        phone: phone,
        ctcode: countrycode || '86',
        timestamp: Date.now(),
      });
      console.log('[Mobile] SMS sent to:', phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'), sent.body);
      jsonReply(res, 200, {
        code: sent.body && sent.body.code || 200,
        message: sent.body && sent.body.code === 200 ? '验证码已发送' : (sent.body && sent.body.message || '发送失败'),
        data: sent.body,
      });
    } catch (e) {
      console.error('[Mobile] SMS error:', e);
      jsonReply(res, 500, { code: 500, message: '发送失败: ' + (e.body && e.body.message || e.message || String(e)) });
    }
    return;
  }

  // GET /api/login/status — check login status (handled by original server, but add cookie info)
  if (url.pathname === '/api/login/mobile-status' && req.method === 'GET') {
    let neteaseCookie = '';
    let qqCookie = '';
    try { neteaseCookie = fs.readFileSync(COOKIE_FILE, 'utf8').trim(); } catch (e) {}
    try { qqCookie = fs.readFileSync(QQ_COOKIE_FILE, 'utf8').trim(); } catch (e) {}
    jsonReply(res, 200, {
      netease: { hasCookie: !!neteaseCookie, cookieLen: neteaseCookie.length },
      qq: { hasCookie: !!qqCookie, cookieLen: qqCookie.length },
    });
    return;
  }

  // POST /api/login/cookie — manually set cookie
  if (url.pathname === '/api/login/cookie' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { provider, cookie } = body || {};
      if (!cookie) {
        jsonReply(res, 400, { code: 400, message: '请提供cookie' });
        return;
      }
      const ok = saveCookie(provider || 'netease', cookie);
      jsonReply(res, 200, { code: 200, message: ok ? 'Cookie已保存' : '保存失败' });
    } catch (e) {
      jsonReply(res, 500, { code: 500, message: e.message });
    }
    return;
  }

  // ---- Proxy to original server ----
  if (url.pathname.startsWith('/api/')) {
    const options = {
      hostname: '127.0.0.1',
      port: PORT + 1,
      path: url.pathname + url.search,
      method: req.method,
      headers: { ...req.headers, host: '127.0.0.1:' + (PORT + 1) },
    };

    const proxy = http.request(options, (proxyRes) => {
      // Add CORS headers to proxied responses
      // The upstream server already sets this header.  Header names are
      // case-insensitive on the wire, but object keys are not: adding the
      // title-cased form beside the upstream lower-case key emits two CORS
      // headers, which Android WebView correctly rejects.
      const headers = { ...proxyRes.headers };
      delete headers['access-control-allow-origin'];
      headers['Access-Control-Allow-Origin'] = '*';
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxy.on('error', () => {
      jsonReply(res, 502, { error: 'API server not available', code: 502 });
    });

    req.pipe(proxy);
    return;
  }

  // ---- Serve static files ----
  let filePath = path.join(STATIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(STATIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, HOST, () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  console.log('📱 在手机上打开以下地址:');
  let found = false;
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        console.log('   http://' + addr.address + ':' + PORT);
        found = true;
      }
    }
  }
  if (!found) console.log('   (无法自动检测IP，请手动查看)');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  originalServer.kill();
  server.close();
  process.exit(0);
});
