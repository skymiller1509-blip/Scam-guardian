'use strict';
// Scam Guardian server. Node.js built-ins only - no dependencies to install.
// Run: node server.js  ->  http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');
const { analyze } = require('./lib/check');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/check') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 20000) req.destroy(); });
    req.on('end', async () => {
      try {
        const { input } = JSON.parse(body || '{}');
        const result = await analyze(input);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Something went wrong while checking. Please try again.' }));
      }
    });
    return;
  }

  const file = req.url === '/' ? 'index.html' : req.url.replace(/^\//, '').split('?')[0];
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(full)] || 'text/plain' });
  fs.createReadStream(full).pipe(res);
});

server.listen(PORT, () => console.log(`Scam Guardian running at http://localhost:${PORT}`));
