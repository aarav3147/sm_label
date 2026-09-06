/**
 * SM LABELS - Hardened Unified Local Development Server & API Runner
 * 
 * Runs static file serving with Clean URLs + handles /api/submit-enquiry
 * with native Resend API integration.
 * Zero external dependencies (uses built-in Node http, fs, path).
 * 
 * Security Controls Implemented:
 * - Strict Path Traversal Prevention (path.resolve + directory prefix check)
 * - Sensitive File Shield (blocks direct HTTP access to .env*, .git*, package.json, *.md)
 * - Streaming Request Body Limit (max 50 KB to prevent memory exhaustion DoS)
 * - Comprehensive HTTP Security Headers (CSP, X-Frame-Options, nosniff, Referrer-Policy)
 * - Safe Clean URL resolution
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Simple .env parser for .env.local and .env
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
      console.log(`Loaded environment from ${file}`);
    }
  }
}

loadEnv();

let PORT = parseInt(process.env.PORT || '8080', 10);
const apiHandler = require('./api/submit-enquiry.js');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; media-src 'self'; connect-src 'self' http://localhost:* http://127.0.0.1:* https://smlabels.in https://api.resend.com; frame-ancestors 'self'; form-action 'self' https://smlabels.in; base-uri 'self';"
};

// Files that should never be served directly over HTTP
const BLOCKED_PATTERNS = [
  /^\/\.env/i,
  /^\/\.git/i,
  /^\/\.vercel/i,
  /^\/package.*\.json$/i,
  /^\/node_modules/i,
  /\.md$/i,
  /\.log$/i
];

const server = http.createServer(async (req, res) => {
  // Disallow unsafe methods on static server
  if (!['GET', 'HEAD', 'POST', 'OPTIONS'].includes(req.method)) {
    res.writeHead(405, Object.assign({ 'Content-Type': 'text/plain' }, SECURITY_HEADERS));
    res.end('Method Not Allowed');
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. Handle API route
  if (pathname === '/api/submit-enquiry' || pathname === '/api/submit-enquiry.js') {
    let body = '';
    let bodySize = 0;
    const MAX_BODY_SIZE = 50 * 1024; // 50 KB stream limit

    req.on('data', chunk => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        req.destroy();
        res.writeHead(413, Object.assign({ 'Content-Type': 'application/json' }, SECURITY_HEADERS));
        res.end(JSON.stringify({ success: false, error: 'Payload Too Large' }));
        return;
      }
      body += chunk;
    });

    req.on('end', async () => {
      if (bodySize > MAX_BODY_SIZE) return;
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch {
        req.body = {};
      }
      await apiHandler(req, res);
    });
    return;
  }

  // 2. Sensitive File Shield
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(pathname)) {
      console.warn(`[Security Alert] Blocked direct access to sensitive file: ${pathname}`);
      res.writeHead(403, Object.assign({ 'Content-Type': 'text/plain' }, SECURITY_HEADERS));
      res.end('403 Forbidden: Access to this resource is restricted.');
      return;
    }
  }

  // 3. Static File Serving with Path Traversal Defense
  // Normalize and resolve against root directory
  const safePath = path.resolve(__dirname, '.' + path.normalize('/' + pathname));

  // Verify safePath does not escape __dirname
  if (!safePath.startsWith(__dirname)) {
    console.warn(`[Security Alert] Path traversal attempt detected: ${pathname}`);
    res.writeHead(403, Object.assign({ 'Content-Type': 'text/plain' }, SECURITY_HEADERS));
    res.end('403 Forbidden: Invalid file path.');
    return;
  }

  let filePath = safePath;

  if (pathname === '/' || pathname === '') {
    filePath = path.join(__dirname, 'index.html');
  } else if (pathname === '/blog' || pathname === '/blog/') {
    filePath = path.join(__dirname, 'blog.html');
  } else if (pathname === '/who-we-are' || pathname === '/who-we-are/') {
    filePath = path.join(__dirname, 'who-we-are.html');
  } else if (pathname === '/products' || pathname === '/products/') {
    filePath = path.join(__dirname, 'products.html');
  } else if (pathname === '/quote' || pathname === '/quote/') {
    filePath = path.join(__dirname, 'quote.html');
  } else if (!path.extname(pathname)) {
    // Clean URL resolution
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const notFoundPage = path.join(__dirname, '404.html');
      if (fs.existsSync(notFoundPage)) {
        res.writeHead(404, Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, SECURITY_HEADERS));
        return fs.createReadStream(notFoundPage).pipe(res);
      }
      res.writeHead(404, Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, SECURITY_HEADERS));
      res.end('<h1>404 Not Found</h1><p>The requested file was not found.</p>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, Object.assign({ 'Content-Type': contentType }, SECURITY_HEADERS));
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

function startServer(portToTry) {
  server.listen(portToTry, () => {
    PORT = portToTry;
    console.log(`\n======================================================`);
    console.log(`✨ SM LABELS HARDENED DEV SERVER RUNNING`);
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
    console.log(`📬 Owner Destination Email: ${process.env.OWNER_EMAIL || 'enterprisessm.delhi@gmail.com'}`);
    const hasKey = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_your_api_key_here';
    console.log(`🔑 Resend API Key: ${hasKey ? 'Configured ✅' : 'Default Placeholder (Please paste actual key in .env.local) ⚠️'}`);
    console.log(`🛡️ Security Headers & CSP Active`);
    console.log(`======================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${portToTry} is in use, trying port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
