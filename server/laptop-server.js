#!/usr/bin/env node
/**
 * Laptop File Server - Companion to the mobile app.
 *
 * Run on your laptop:
 *   node laptop-server.js [path-to-share] [port]
 *
 * Defaults: shares the current directory on port 7321.
 *
 * The mobile app connects to http://<your-laptop-ip>:7321
 *
 * Endpoints:
 *   GET    /api/health
 *   GET    /api/list?path=...
 *   GET    /api/file?path=...        (download / raw content)
 *   GET    /api/text?path=...       (text file content as JSON)
 *   PUT    /api/text?path=...        (save text file content)
 *   POST   /api/folder               (create folder)
 *   POST   /api/upload              (upload file, multipart)
 *   POST   /api/rename              (rename / move)
 *   DELETE /api/delete?path=...      (delete file or folder)
 *   GET    /api/stream?path=...      (video / large file streaming with Range support)
 */

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

const SHARE_ROOT = path.resolve(process.argv[2] || process.cwd());
const PORT = parseInt(process.argv[2] && !isNaN(process.argv[2]) ? process.argv[2] : process.argv[3] || '7321', 10);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-File-Path, X-File-Name',
};

function normalizeRelativePath(rel) {
  if (!rel || rel === '/') return '';
  return rel.replace(/\\/g, '/').replace(/^\/+/, '');
}

function safeJoin(base, rel) {
  const root = path.resolve(base);
  const normalized = normalizeRelativePath(rel);
  const target = path.resolve(root, normalized || '.');
  const relative = path.relative(root, target);

  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return target;
  }

  return null;
}

function send(res, status, data, headers = {}) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS, ...headers });
  res.end(body);
}

function sendRaw(res, status, data, contentType = 'application/octet-stream', headers = {}) {
  res.writeHead(status, { 'Content-Type': contentType, ...CORS, ...headers });
  res.end(data);
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const boundary = (req.headers['content-type'] || '').match(/boundary=(.+)/);
    if (!boundary) return reject(new Error('No boundary'));
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const buf = Buffer.concat(chunks);
        const sep = Buffer.from('--' + boundary[1]);
        const parts = [];
        let start = 0;
        while (true) {
          const idx = buf.indexOf(sep, start);
          if (idx === -1) break;
          if (start > 0) parts.push(buf.slice(start, idx));
          start = idx + sep.length;
          if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break; // --
          start += 2; // skip \r\n
        }
        const fields = {};
        let fileData = null;
        let fileName = null;
        for (const part of parts) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;
          const header = part.slice(0, headerEnd).toString();
          const data = part.slice(headerEnd + 4, part.length - 2);
          const nameMatch = header.match(/name="([^"]+)"/);
          const fnameMatch = header.match(/filename="([^"]+)"/);
          if (fnameMatch) {
            fileName = fnameMatch[1];
            fileData = data;
          } else if (nameMatch) {
            fields[nameMatch[1]] = data.toString();
          }
        }
        resolve({ fields, fileName, fileData });
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  // Health check
  if (url.pathname === '/api/health') {
    return send(res, 200, {
      ok: true,
      root: SHARE_ROOT,
      hostname: os.hostname(),
      platform: process.platform,
    });
  }

  // List directory
  if (url.pathname === '/api/list' && req.method === 'GET') {
    const rel = url.searchParams.get('path') || '';
    const full = safeJoin(SHARE_ROOT, rel);
    if (!full) return send(res, 403, { error: 'Access denied' });
    try {
      const entries = await fsp.readdir(full, { withFileTypes: true });
      const items = await Promise.all(entries.map(async (e) => {
        const itemPath = path.join(rel, e.name).replace(/\\/g, '/');
        let size = 0;
        let modified = null;
        try {
          const stat = await fsp.stat(path.join(full, e.name));
          size = stat.size;
          modified = stat.mtime.toISOString();
        } catch {}
        const ext = path.extname(e.name).toLowerCase().slice(1);
        let type = 'file';
        if (e.isDirectory()) type = 'folder';
        else if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(ext)) type = 'video';
        else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic'].includes(ext)) type = 'photo';
        else if (['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'xml', 'yml', 'yaml', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'sh', 'log', 'csv', 'ini', 'conf', 'env'].includes(ext)) type = 'text';
        return { name: e.name, path: itemPath, type, size, modified, ext };
      }));
      // Sort folders first, then alphabetically
      items.sort((a, b) => (a.type === 'folder' ? -1 : 1) - (b.type === 'folder' ? -1 : 1) || a.name.localeCompare(b.name));
      return send(res, 200, { path: rel || '/', items });
    } catch (e) {
      return send(res, 404, { error: e.message });
    }
  }

  // Get text file content
  if (url.pathname === '/api/text' && req.method === 'GET') {
    const rel = url.searchParams.get('path') || '';
    const full = safeJoin(SHARE_ROOT, rel);
    if (!full) return send(res, 403, { error: 'Access denied' });
    try {
      const content = await fsp.readFile(full, 'utf-8');
      return send(res, 200, { path: rel, content });
    } catch (e) {
      return send(res, 404, { error: e.message });
    }
  }

  // Save text file content
  if (url.pathname === '/api/text' && req.method === 'PUT') {
    const rel = url.searchParams.get('path') || '';
    const full = safeJoin(SHARE_ROOT, rel);
    if (!full) return send(res, 403, { error: 'Access denied' });
    try {
      const body = await new Promise((r, j) => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); req.on('error', j); });
      const { content } = JSON.parse(body);
      await fsp.writeFile(full, content, 'utf-8');
      return send(res, 200, { ok: true });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  // Create folder
  if (url.pathname === '/api/folder' && req.method === 'POST') {
    try {
      const body = await new Promise((r, j) => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); req.on('error', j); });
      const { path: rel, name } = JSON.parse(body);
      const full = safeJoin(SHARE_ROOT, rel ? `${rel}/${name}` : name);
      if (!full) return send(res, 403, { error: 'Access denied' });
      await fsp.mkdir(full, { recursive: true });
      return send(res, 200, { ok: true });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  // Rename / move
  if (url.pathname === '/api/rename' && req.method === 'POST') {
    try {
      const body = await new Promise((r, j) => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); req.on('error', j); });
      const { path: rel, newName } = JSON.parse(body);
      const full = safeJoin(SHARE_ROOT, rel);
      if (!full) return send(res, 403, { error: 'Access denied' });
      const newPath = path.resolve(path.dirname(full), newName);
      const relNew = path.relative(SHARE_ROOT, newPath);
      if (relNew.startsWith('..') || path.isAbsolute(relNew)) return send(res, 403, { error: 'Access denied' });
      await fsp.rename(full, newPath);
      return send(res, 200, { ok: true });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  // Delete file or folder
  if (url.pathname === '/api/delete' && req.method === 'DELETE') {
    const rel = url.searchParams.get('path') || '';
    const full = safeJoin(SHARE_ROOT, rel);
    if (!full) return send(res, 403, { error: 'Access denied' });
    try {
      const stat = await fsp.stat(full);
      if (stat.isDirectory()) {
        await fsp.rm(full, { recursive: true });
      } else {
        await fsp.unlink(full);
      }
      return send(res, 200, { ok: true });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  // Upload file (multipart)
  if (url.pathname === '/api/upload' && req.method === 'POST') {
    try {
      const { fields, fileName, fileData } = await parseMultipart(req);
      const rel = fields.path || '';
      const full = safeJoin(SHARE_ROOT, rel ? `${rel}/${fileName}` : fileName);
      if (!full) return send(res, 403, { error: 'Access denied' });
      await fsp.mkdir(path.dirname(full), { recursive: true });
      await fsp.writeFile(full, fileData);
      return send(res, 200, { ok: true, name: fileName });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  // Download raw file
  if (url.pathname === '/api/file' && req.method === 'GET') {
    const rel = url.searchParams.get('path') || '';
    const full = safeJoin(SHARE_ROOT, rel);
    if (!full) return send(res, 403, { error: 'Access denied' });
    try {
      const stat = await fsp.stat(full);
      const ext = path.extname(full).toLowerCase().slice(1);
      const mime = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
        webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
        mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
        txt: 'text/plain', md: 'text/markdown', json: 'application/json',
        pdf: 'application/pdf', html: 'text/html', css: 'text/css',
      }[ext] || 'application/octet-stream';
      const data = await fsp.readFile(full);
      return sendRaw(res, 200, data, mime, { 'Content-Length': stat.size });
    } catch (e) {
      return send(res, 404, { error: e.message });
    }
  }

  // Stream video / large file with Range support
  if (url.pathname === '/api/stream' && req.method === 'GET') {
    const rel = url.searchParams.get('path') || '';
    const full = safeJoin(SHARE_ROOT, rel);
    if (!full) return send(res, 403, { error: 'Access denied' });
    try {
      const stat = await fsp.stat(full);
      const fileSize = stat.size;
      const ext = path.extname(full).toLowerCase().slice(1);
      const mime = {
        mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
        mkv: 'video/x-matroska', m4v: 'video/mp4', avi: 'video/x-msvideo',
      }[ext] || 'application/octet-stream';

      const range = req.headers.range;
      if (range) {
        const [s, e] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(s, 10);
        const end = e ? parseInt(e, 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(full, { start, end });
        res.writeHead(206, {
          ...CORS,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mime,
        });
        stream.pipe(res);
      } else {
        res.writeHead(200, {
          ...CORS,
          'Content-Length': fileSize,
          'Content-Type': mime,
          'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(full).pipe(res);
      }
    } catch (e) {
      return send(res, 404, { error: e.message });
    }
    return;
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  console.log('\n  ┌─────────────────────────────────────────────┐');
  console.log('  │  Laptop File Server                        │');
  console.log('  │  Sharing: ' + SHARE_ROOT);
  console.log('  │  Port: ' + PORT);
  console.log('  │                                             │');
  console.log('  │  Connect from your phone to one of:        │');
  ips.forEach(ip => console.log('  │    http://' + ip + ':' + PORT));
  console.log('  └─────────────────────────────────────────────┘\n');
});
