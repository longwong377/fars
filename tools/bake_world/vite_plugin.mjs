// s14/load (D-354): the baked world cache's dev-server side.
//  GET  /world-cache/src.json            the source hash of every unit of the tree being served (srchash.mjs), fresh each load
//  POST /__world-cache/put?unit=&key=&src= a unit's packed result, computed live by a page whose cache was missing or stale:
//                                         written to public/world-cache/<unit>-<key>.bin and recorded in its manifest, so
//                                         the next load reads it (the cache bakes itself; tools/bake_world/bake.mjs does the
//                                         same in node). Only when the posted src equals the tree's own hash.
// public/world-cache is not watched (a write must never reload a page mid-render).
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { sourceHashes } from './srchash.mjs';

export const CACHE_DIR = 'public/world-cache';
export function writeEntry(root, unit, key, src, bytes) {
  const dir = resolve(root, CACHE_DIR); mkdirSync(dir, { recursive: true });
  // s15 (D-392): gzipped (the geometry's per-part attributes repeat: the architecture 83 MB -> 5 MB; the page inflates it with
  // DecompressionStream, node with zlib; by its magic bytes: a host may also send it with its own Content-Encoding, the dev
  // server does for a .gz name, so the name stays .bin); the manifest marks it gz
  const file = `${unit}-${key}.bin`.replace(/[^\w.-]/g, '_'), tmp = resolve(dir, file + '.tmp');
  const gz = gzipSync(bytes, { level: 6 }); writeFileSync(tmp, gz); renameSync(tmp, resolve(dir, file));
  const mf = resolve(dir, 'manifest.json'), M = existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : { v: 1, entries: {} };
  const old = M.entries[`${unit}|${key}`]; if (old?.file && old.file !== file) rmSync(resolve(dir, old.file), { force: true });
  M.entries[`${unit}|${key}`] = { src, file, gz: true, gzBytes: gz.length, bytes: bytes.length, sha1: createHash('sha1').update(bytes).digest('hex').slice(0, 16), at: new Date().toISOString() };
  writeFileSync(mf + '.tmp', JSON.stringify(M, null, 1)); renameSync(mf + '.tmp', mf);
  return file;
}
export default function worldCache() {
  let root = process.cwd(), memo = null;
  const hashes = () => { const t = Date.now(); if (memo && t - memo.t < 2000) return memo.h; const h = sourceHashes(root); memo = { t, h }; return h; };
  return {
    name: 'parsa-world-cache',
    configResolved(c) { root = c.root; },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://x');
        if (req.method === 'GET' && url.pathname === '/world-cache/src.json') {
          try { const t0 = Date.now(), h = hashes(); res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify({ ...h, $ms: Date.now() - t0 })); }
          catch (e) { res.statusCode = 500; res.end(String(e)); } return;
        }
        if (req.method === 'POST' && url.pathname === '/__world-cache/put') {
          const unit = url.searchParams.get('unit') ?? '', key = url.searchParams.get('key') ?? '', src = url.searchParams.get('src') ?? '', chunks = [];
          req.on('data', c => chunks.push(c)); req.on('end', () => {
            try { const now = hashes()[unit]; if (!now || now !== src) { res.statusCode = 409; res.end('stale'); return; }
              const f = writeEntry(root, unit, key, src, Buffer.concat(chunks)); res.end(f); } catch (e) { res.statusCode = 500; res.end(String(e)); } });
          return;
        }
        next();
      });
    },
    // a production build: the hashes the dist was built from, beside the cache files public/ copies in
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'world-cache/src.json', source: JSON.stringify(sourceHashes(root)) }); },
  };
}
