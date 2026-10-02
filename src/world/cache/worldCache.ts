// s14/load (D-354): the baked world. Pure CPU results of the build (the far people's atlas, the fitted costumes, the hills'
// landform maps, the mud-brick faces, the town's plan, ...) kept on disk under public/world-cache/ and read back on load
// instead of being computed again. Each unit's entry records the hash of the sources and data it was computed from
// (tools/bake_world/srchash.mjs, the units in ./units.json); a page uses an entry only when that hash equals the served
// tree's (/world-cache/src.json), otherwise it computes the unit live (the fallback) and, on the dev server, posts the result
// back so the next load reads it. ?worldcache=0 skips the cache (A/B timing, and the live build's own check).
// s15/load (D-392): node has a backend too (setNodeCacheBackend): the site build bakes every unit by running the world's
// build in node (tools/bake_world/bake.ts, mode 'bake': always computed, then written); mode 'read' reads them back (the
// node-side timing of a cached build). Without a backend node builds live. The sync stages (the architecture, the town)
// read units fetched ahead (prefetchUnits, then cacheGetSync); cachePutSync bakes what they computed.
import { pack, unpack, hashBytes } from './pack';
import { BASE } from '../../core/base';

type Entry = { src: string; file: string; bytes: number; sha1: string; gz?: boolean };
type Manifest = { v: number; entries: Record<string, Entry> };
export type NodeCacheBackend = { mode: 'bake' | 'read'; src: Record<string, string>; manifest: Manifest;
  read(file: string): Uint8Array | null; write(unit: string, key: string, src: string, bytes: Uint8Array): void };
export const cacheStats: { hits: Record<string, number>; misses: Record<string, string>; puts: string[] } = { hits: {}, misses: {}, puts: [] };
const browser = typeof window !== 'undefined' && typeof fetch !== 'undefined' && typeof location !== 'undefined';
let nodeB: NodeCacheBackend | null = null;
/** node: the bake's or the reader's file backend (tools/bake_world/node_cache.ts) */
export function setNodeCacheBackend(b: NodeCacheBackend | null) { nodeB = b; pre.clear(); }
let srcP: Promise<Record<string, string> | null> | null = null, manP: Promise<Manifest | null> | null = null;
const getJson = (u: string) => fetch(u, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
const srcHashes = () => (nodeB ? Promise.resolve(nodeB.src) : (srcP ??= getJson(BASE + 'world-cache/src.json')));
const manifest = () => (nodeB ? Promise.resolve(nodeB.manifest) : (manP ??= getJson(BASE + 'world-cache/manifest.json')));
/** timings inside a unit's result, left out of its identity hash */
const VOLATILE = new Set(['ms', 'parts']);
const strip = (v: any): any => (v === null || typeof v !== 'object' || ArrayBuffer.isView(v) ? v : v instanceof Set || v instanceof Map ? v : Array.isArray(v) ? v.map(strip) : Object.fromEntries(Object.entries(v).filter(([k]) => !VOLATILE.has(k)).map(([k, x]) => [k, strip(x)])));
/** the identity of a unit's result: the hash of its packed form without the timings (the node test and ?worldcache=verify) */
export const identity = (v: unknown) => hashBytes(pack(strip(v)));
const param = () => (typeof location !== 'undefined' && location?.search !== undefined ? new URLSearchParams(location.search).get('worldcache') : null); // (node: tools/bake_world/node_env.ts sets a location)
export const cacheEnabled = () => !!nodeB || (browser && param() !== '0');
const dev = () => !nodeB && !!(import.meta as any).env?.DEV;

/** start fetching the hashes and the manifest (call early: they cost one round trip each) */
export function prefetchWorldCache() { if (cacheEnabled()) { void srcHashes(); void manifest(); } }

async function readEntry(e: Entry): Promise<ArrayBuffer | Uint8Array | null> {
  if (nodeB) return nodeB.mode === 'read' ? nodeB.read(e.file) : null;
  const r = await fetch(BASE + 'world-cache/' + e.file); if (!r.ok) return null;
  // D-392: gzipped at bake time (writeEntry), inflated here unless the host already did (by the magic bytes)
  const b = await r.arrayBuffer(), u = new Uint8Array(b, 0, Math.min(2, b.byteLength));
  return u[0] === 0x1f && u[1] === 0x8b ? new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : b;
}
// D-392: this browser's own copies of the units it had to compute (a world of its own seed: the site bakes the default world
// only), in the Cache Storage under the unit, key and source hash: the next visit reads them (one kept per unit; ?worldcache=0
// skips them too). Nothing leaves the browser.
const LOCAL = 'parsa-world-cache-v1';
const localUrl = (unit: string, key: string, s: string) => `${location.origin}${BASE}__wc/${encodeURIComponent(unit)}/${encodeURIComponent(key)}/${s}`;
const hasCaches = () => browser && typeof caches !== 'undefined' && !nodeB && !dev();
async function localGet(unit: string, key: string, s: string | undefined): Promise<ArrayBuffer | null> {
  if (!s || !hasCaches()) return null;
  try { const r = await (await caches.open(LOCAL)).match(localUrl(unit, key, s)); return r ? await r.arrayBuffer() : null; } catch { return null; }
}
function localPut(unit: string, key: string, s: string, body: Uint8Array) {
  if (!hasCaches()) return;
  void (async () => { try { const c = await caches.open(LOCAL), mine = localUrl(unit, key, s), pre = `${location.origin}${BASE}__wc/${encodeURIComponent(unit)}/`;
    for (const q of await c.keys()) if (q.url.startsWith(pre) && q.url !== mine) await c.delete(q);
    await c.put(mine, new Response(body as any, { headers: { 'content-type': 'application/octet-stream' } })); cacheStats.puts.push(`local:${unit}|${key}`); } catch { /* no storage: computed again next time */ } })();
}
function put(unit: string, key: string, s: string | undefined, v: unknown) {
  if (!s) return;
  let body: Uint8Array; try { body = pack(v); } catch (err) { console.warn(`[world-cache] ${unit}: not packable (${(err as Error).message})`); return; }
  if (nodeB) { nodeB.write(unit, key, s, body); cacheStats.puts.push(`${unit}|${key}`); return; }
  if (dev()) void fetch(`/__world-cache/put?unit=${encodeURIComponent(unit)}&key=${encodeURIComponent(key)}&src=${s}`, { method: 'POST', body: body as any })
    .then(r => { if (r.ok) cacheStats.puts.push(`${unit}|${key}`); }).catch(() => {}); // (the dev server checks the hash again before writing)
  else localPut(unit, key, s, body);
}
const why = (s: string | undefined, e: Entry | undefined) => (nodeB?.mode === 'bake' ? 'baking' : !s ? 'no source hash (unit not in units.json, or no dev server)' : !e ? 'not baked' : 'stale');
export async function verify(unit: string, a0: unknown, b0: unknown) {
  const a = identity(a0), b = identity(b0); (cacheStats as any).verify = { ...(cacheStats as any).verify, [unit]: a === b ? 'identical' : `MISMATCH ${a} != ${b}` };
  console.info('[world-cache] verify', unit, a === b ? 'identical' : 'MISMATCH');
}
export const verifying = () => param() === 'verify';

/** the unit's result: from the cache when its source hash matches, else compute() (and bake it: node's backend, the dev server).
 *  The result must be plain data (objects, arrays, numbers, strings, typed arrays, Sets, Maps): see pack.ts. */
export async function cached<T>(unit: string, key: string, compute: () => T | Promise<T>): Promise<T> {
  if (!cacheEnabled()) return compute();
  const t0 = performance.now(), [src, man] = await Promise.all([srcHashes(), manifest()]);
  const s = src?.[unit], e = man?.entries?.[`${unit}|${key}`];
  if (s && e && e.src === s) {
    try { const b = await readEntry(e); if (b) { const v = unpack<T>(b); cacheStats.hits[`${unit}|${key}`] = Math.round(performance.now() - t0);
      if (verifying()) await verify(unit, v, await compute());
      return v; } }
    catch (err) { console.warn(`[world-cache] ${unit}|${key}: unreadable (${(err as Error).message}); building live`); }
  }
  { const b = await localGet(unit, key, s); if (b) try { const v = unpack<T>(b); cacheStats.hits[`local:${unit}|${key}`] = Math.round(performance.now() - t0); return v; } catch { /* rebuilt */ } }
  cacheStats.misses[`${unit}|${key}`] = why(s, e);
  const v = await compute(); put(unit, key, s, v); return v;
}

/** the unit's cached result when its source hash matches, else null (no compute: for a unit gathered during a sync build,
 *  then put with cachePut). */
export async function cacheGet<T>(unit: string, key: string): Promise<T | null> {
  if (!cacheEnabled()) return null;
  const t0 = performance.now(), [src, man] = await Promise.all([srcHashes(), manifest()]);
  const s = src?.[unit], e = man?.entries?.[`${unit}|${key}`];
  if (s && e && e.src === s) try { const b = await readEntry(e); if (b) { const v = unpack<T>(b); cacheStats.hits[`${unit}|${key}`] = Math.round(performance.now() - t0); return v; } }
    catch (err) { console.warn(`[world-cache] ${unit}|${key}: unreadable (${(err as Error).message}); building live`); }
  { const b = await localGet(unit, key, s); if (b) try { const v = unpack<T>(b); cacheStats.hits[`local:${unit}|${key}`] = Math.round(performance.now() - t0); return v; } catch { /* rebuilt */ } }
  cacheStats.misses[`${unit}|${key}`] = why(s, e); return null;
}
/** bake a unit's result gathered live */
export async function cachePut(unit: string, key: string, v: unknown): Promise<void> {
  if (!cacheEnabled()) return; put(unit, key, (await srcHashes())?.[unit], v);
}

// --- the sync stages: units fetched ahead, read without awaiting ---
const pre = new Map<string, ArrayBuffer | Uint8Array>();
let preSrc: Record<string, string> | null = null;
/** fetch the fresh entries of these units ahead of the sync stages that read them (cacheGetSync): 'unit' every key of it,
 *  'unit|key' that key only (a unit keyed by the world's seed: only this world's entry) */
export async function prefetchUnits(units: string[]): Promise<void> {
  if (!cacheEnabled()) return;
  const [src, man] = await Promise.all([srcHashes(), manifest()]); preSrc = src ?? {};
  if (!src || !man) return; const want = new Set(units);
  await Promise.all(Object.entries<Entry>(man.entries ?? {}).map(async ([k, e]) => { const unit = k.slice(0, k.indexOf("|"));
    if (!(want.has(unit) || want.has(k)) || src[unit] !== e.src || pre.has(k)) return;
    try { const b = await readEntry(e); if (b) pre.set(k, b); } catch (err) { console.warn(`[world-cache] ${k}: unreadable (${(err as Error).message})`); } }));
  // this browser's own copies of the keyed ones the site has not baked (D-392: a world of its own seed)
  await Promise.all(units.filter(u => u.includes('|') && !pre.has(u)).map(async k => { const unit = k.slice(0, k.indexOf('|')), b = await localGet(unit, k.slice(unit.length + 1), src[unit]); if (b) pre.set(k, b); }));
}
/** the keys of a unit fetched ahead (prefetchUnits) and not yet read */
export const prefetchedKeys = (unit: string) => [...pre.keys()].filter(k => k.startsWith(unit + '|')).map(k => k.slice(unit.length + 1));
/** a prefetched unit's result, or null (then compute it and cachePutSync it) */
export function cacheGetSync<T>(unit: string, key: string): T | null {
  if (!cacheEnabled()) return null;
  const k = `${unit}|${key}`, b = pre.get(k);
  if (b) { const t0 = performance.now(); try { const v = unpack<T>(b); pre.delete(k); cacheStats.hits[k] = Math.round(performance.now() - t0); return v; }
    catch (err) { console.warn(`[world-cache] ${k}: unreadable (${(err as Error).message}); building live`); } }
  cacheStats.misses[k] = nodeB?.mode === 'bake' ? 'baking' : !preSrc ? 'not prefetched' : !preSrc[unit] ? 'no source hash' : 'not baked or stale'; return null;
}
/** bake a sync unit's result (node's backend now; the dev server in the background) */
export function cachePutSync(unit: string, key: string, v: unknown) { if (cacheEnabled()) put(unit, key, (nodeB?.src ?? preSrc ?? undefined)?.[unit], v); }
/** the sync form of cached(): the prefetched result, else compute() and bake it. ?worldcache=verify compares both */
export function cachedSync<T>(unit: string, key: string, compute: () => T): T {
  const v = cacheGetSync<T>(unit, key);
  if (v !== null) { if (verifying()) void verify(unit, v, compute()); return v; }
  const r = compute(); cachePutSync(unit, key, r); return r;
}
