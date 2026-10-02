// s15/ship (D-368): a static server for the built site, as GitHub Pages serves it (no dev server, no custom headers):
// the dist under a base path, gzip for text types, Cache-Control max-age=600 with ETag/Last-Modified (Pages' own), and an
// optional shared download cap to model the player's line.
//   node tools/deploy/serve.mjs [dist=dist] [port=4180] [base=/fars/]   MBPS=100: cap the total download at 100 Mbit/s
// A request log (path, bytes, ms from the server's start) is kept in memory: GET /__served returns it, POST /__served/reset
// clears it (the load measurement reads what the first minute fetched).
import { createServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { join, extname, resolve, normalize } from 'node:path';
import { createGzip } from 'node:zlib';
import { Transform } from 'node:stream';

const [distArg = 'dist', portArg = '4180', baseArg = '/fars/'] = process.argv.slice(2);
const dist = resolve(distArg), port = +portArg, base = baseArg.endsWith('/') ? baseArg : baseArg + '/';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.txt': 'text/plain' };
const GZ = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.wasm']); // what Pages compresses (text and wasm)
// a shared token bucket: every response draws from it (MBPS megabits a second across all connections)
const rate = process.env.MBPS ? (+process.env.MBPS * 1e6) / 8 : 0; let tokens = 0, last = Date.now();
const take = n => new Promise(res => { const step = () => { const now = Date.now(); tokens = Math.min(rate * 0.05, tokens + ((now - last) / 1000) * rate); last = now;
  if (tokens >= n || tokens >= rate * 0.05) { tokens -= n; res(); } else setTimeout(step, Math.max(1, ((n - tokens) / rate) * 1000)); }; step(); });
const throttle = () => new Transform({ async transform(chunk, _e, cb) { if (!rate) return cb(null, chunk);
  for (let o = 0; o < chunk.length; o += 16384) { const c = chunk.subarray(o, o + 16384); await take(c.length); this.push(c); } cb(); } });
let t0 = Date.now(), log = [];
createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/__served') { if (req.method === 'POST') { log = []; t0 = Date.now(); } res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(log)); return; }
  if (!url.pathname.startsWith(base)) { res.statusCode = 404; res.end('not under ' + base); log.push({ p: url.pathname, s: 404, t: Date.now() - t0 }); return; }
  let rel = decodeURIComponent(url.pathname.slice(base.length)); if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = normalize(join(dist, rel)); if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) { res.statusCode = 404; res.end('404'); log.push({ p: rel, s: 404, t: Date.now() - t0 }); return; }
  const st = statSync(file), etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`, ext = extname(file).toLowerCase();
  res.setHeader('cache-control', 'max-age=600'); res.setHeader('etag', etag); res.setHeader('last-modified', st.mtime.toUTCString());
  res.setHeader('content-type', MIME[ext] ?? 'application/octet-stream'); res.setHeader('access-control-allow-origin', '*');
  if (req.headers['if-none-match'] === etag) { res.statusCode = 304; res.end(); log.push({ p: rel, s: 304, b: 0, t: Date.now() - t0 }); return; }
  const gz = GZ.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
  let bytes = 0; const count = new Transform({ transform(c, _e, cb) { bytes += c.length; cb(null, c); } });
  if (gz) res.setHeader('content-encoding', 'gzip'); else res.setHeader('content-length', st.size);
  const s = createReadStream(file); let p = gz ? s.pipe(createGzip({ level: 6 })) : s; p = p.pipe(count).pipe(throttle());
  p.pipe(res); res.on('close', () => log.push({ p: rel, s: 200, b: bytes, raw: st.size, t: Date.now() - t0 }));
}).listen(port, () => console.log(`[serve] ${dist} at http://127.0.0.2:${port}${base}${rate ? ` capped at ${process.env.MBPS} Mbit/s` : ''}`));
