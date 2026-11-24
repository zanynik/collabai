// Lean 4 checker service. POST /check { source } → { ok, messages, version }.
// Compiles the file with `lean` (core only, no Mathlib) under a timeout.
// Agora only ever sends files it generated itself, but this service still
// refuses anything that could reach outside the kernel (IO, FFI, run_cmd …).
import http from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.PORT) || 8080;
const TOKEN = process.env.LEAN_SERVER_TOKEN;
const LEAN = process.env.LEAN_BIN || 'lean';
const MAX_SOURCE = 200_000;
const FORBIDDEN = /\b(import|IO|unsafe|extern|implemented_by|run_cmd|run_tac|run_elab|#eval|#exit|initialize|builtin_initialize|open\s+System|macro|syntax|elab)\b|@\[/;

const run = (args, opts) => new Promise((resolve) => {
  execFile(LEAN, args, { timeout: 30_000, maxBuffer: 2 << 20, ...opts }, (err, stdout, stderr) =>
    resolve({ code: err ? (err.code ?? 1) : 0, killed: err?.killed, out: `${stdout}${stderr}` }));
});

const version = (await run(['--version'])).out.trim();

http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, version });
  if (req.method !== 'POST' || req.url !== '/check') return send(404, { error: 'not found' });
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'unauthorized' });

  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > MAX_SOURCE + 1000) return send(413, { error: 'too large' }); }
  let source;
  try { ({ source } = JSON.parse(raw)); } catch { return send(400, { error: 'invalid json' }); }
  if (typeof source !== 'string' || !source.length) return send(400, { error: 'source required' });
  const code = source.replace(/\/-[\s\S]*?-\//g, ' ').replace(/--.*$/gm, ' ');
  if (code.includes('/-') || FORBIDDEN.test(code)) return send(400, { error: 'source uses a forbidden command' });

  const dir = await mkdtemp(join(tmpdir(), 'agora-'));
  try {
    const file = join(dir, 'Debate.lean');
    await writeFile(file, source);
    const r = await run([file], { cwd: dir });
    const messages = r.out.split('\n').filter(Boolean).map((l) => l.replace(file, 'Debate.lean'));
    if (r.killed) return send(200, { ok: false, version, messages: ['timeout'] });
    send(200, { ok: r.code === 0, version, messages });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}).listen(PORT, () => console.log(`Lean checker (${version}) on :${PORT}`));
