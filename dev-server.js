// Minimal local server that mimics Vercel: static files from public/ and
// POST /api/<name> → api/<name>.js. Usage: npm run dev
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = new URL('./public/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const API = new Set(['analyze', 'formalize', 'facilitate']);

function wrap(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const api = /^\/api\/([a-z]+)$/.exec(url.pathname);
  if (api && API.has(api[1])) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { return wrap(res).status(400).json({ error: 'Invalid JSON' }); }
    const { default: handler } = await import(`./api/${api[1]}.js`);
    return handler(req, wrap(res));
  }
  const path = normalize(join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!path.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  try {
    const data = await readFile(path);
    res.setHeader('content-type', TYPES[extname(path)] ?? 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404; res.end('Not found');
  }
}).listen(PORT, () => console.log(`Agora running at http://localhost:${PORT}`));
