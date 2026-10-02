// s15/load (D-392): the baked world's node backend (src/world/cache/worldCache.ts setNodeCacheBackend): entries read from
// and written to <root>/public/world-cache (vite_plugin.mjs writeEntry: the manifest with each entry's source hash), the
// source hashes of the tree itself (srchash.mjs). mode 'bake': every unit computed and written; 'read': fresh entries read.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { setNodeCacheBackend } from '../../src/world/cache/worldCache';
import { sourceHashes } from './srchash.mjs';
import { writeEntry, CACHE_DIR } from './vite_plugin.mjs';

export function useNodeCache(root: string, mode: 'bake' | 'read') {
  const dir = resolve(root, CACHE_DIR), mf = resolve(dir, 'manifest.json');
  const manifest = existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : { v: 1, entries: {} };
  const src = sourceHashes(root) as Record<string, string>;
  setNodeCacheBackend({ mode, src, manifest,
    read: f => { const p = resolve(dir, f); if (!existsSync(p)) return null; let b = readFileSync(p); if (f.endsWith('.gz')) b = gunzipSync(b); return new Uint8Array(b.buffer, b.byteOffset, b.byteLength); },
    write: (unit, key, s, bytes) => { const file = writeEntry(root, unit, key, s, bytes); manifest.entries[`${unit}|${key}`] = { src: s, file, bytes: bytes.length, sha1: '' }; } });
  return src;
}
