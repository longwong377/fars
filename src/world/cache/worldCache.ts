// s14/load (D-354): the baked world. Pure CPU results of the build (the far people's atlas, the fitted costumes, the hills'
// landform maps, ...) kept on disk under public/world-cache/ and read back on load instead of being computed again.
// Each unit's entry records the hash of the sources and data it was computed from (tools/bake_world/srchash.mjs, the units
// in ./units.json); a page uses an entry only when that hash equals the served tree's (world-cache/src.json), otherwise it
// computes the unit live (the fallback) and, on the dev server, posts the result back so the next load reads it.
// ?worldcache=0 skips the cache (A/B timing, and the live build's own check).
// s15 (D-386): the units the build computes synchronously (the town plan, the mud-brick faces, the fill, the grime map, the
// fords) are fetched up front (preloadWorldCache, awaited at the start of the build) and taken with cacheTake / cachedSync.
// In node the build computes every unit live; with a collector (collectWorldCache: tools/bake_world/bake.ts) each unit's
// result is packed as it is made, and the bake writes them all. Paths go through the site's base (GitHub Pages: /fars/).
import { pack, unpack, hashBytes } from './pack';

type Manifest = { v: number; entries: Record<string, { src: string; file: string; bytes: number; sha1: string }> };
export const cacheStats: { hits: Record<string, number>; misses: Record<string, string>; puts: string[]; preloadMs?: number; preloadMB?: number } = { hits: {}, misses: {}, puts: [] };
// (node reads the cache too when a tool sets globalThis.__worldCacheOn: tools/bake_world/node_build.ts WORLDCACHE=1, the A/B)
const browser = (typeof window !== 'undefined' || (globalThis as any).__worldCacheOn === true) && typeof fetch !== 'undefined' && typeof location !== 'undefined';
const BASE: string = ((import.meta as any).env?.BASE_URL as string | undefined) ?? '/';
const url = (p: string) => `${BASE}world-cache/${p}`;
let srcP: Promise<Record<string, string> | null> | null = null, manP: Promise<Manifest | null> | null = null;
/** an entry's bytes, inflated when stored gzipped (D-386) */
export async function inflate(b: ArrayBuffer): Promise<ArrayBuffer> {
  const u = new Uint8Array(b); if (!(u[0] === 0x1f && u[1] === 0x8b)) return b;
  return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
const getEntry = async (file: string): Promise<ArrayBuffer | null> => { const r = await fetch(url(file)); return r.ok ? inflate(await r.arrayBuffer()) : null; };
const getJson = (u: string) => fetch(u, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
const srcHashes = () => (srcP ??= getJson(url('src.json')));
const manifest = () => (manP ??= getJson(url('manifest.json')));
/** timings inside a unit's result, left out of its identity hash */
const VOLATILE = new Set(['ms', 'parts']);
const strip = (v: any, seen = new Map<any, any>()): any => {
  if (v === null || typeof v !== 'object' || ArrayBuffer.isView(v)) return v;
  if (seen.has(v)) return seen.get(v);
  if (Array.isArray(v)) { const a: any[] = []; seen.set(v, a); for (const x of v) a.push(strip(x, seen)); return a; }
  if (v instanceof Map) { const m = new Map(); seen.set(v, m); for (const [k, x] of v) m.set(k, strip(x, seen)); return m; }
  if (v instanceof Set) return v;
  const o = Object.create(Object.getPrototypeOf(v)); seen.set(v, o);
  for (const [k, x] of Object.entries(v)) if (!VOLATILE.has(k)) o[k] = strip(x, seen); return o;
};
/** the identity of a unit's result: the hash of its packed form without the timings (the node test and ?worldcache=verify) */
export const identity = (v: unknown) => hashBytes(pack(strip(v)));
export const cacheEnabled = () => browser && new URLSearchParams(location.search).get('worldcache') !== '0';
const verifyOn = () => browser && new URLSearchParams(location.search).get('worldcache') === 'verify';

/** start fetching the hashes and the manifest (call early: they cost one round trip each) */
export function prefetchWorldCache() { if (cacheEnabled()) { void srcHashes(); void manifest(); } }

// ---------------------------------------------------------------------------------------------- node: the bake's collector
let COLLECT: Map<string, Uint8Array> | null = null;
/** node (the bake): record every unit's packed result as the build makes it (unit|key -> bytes); null stops */
export function collectWorldCache(into: Map<string, Uint8Array> | null) { COLLECT = into; }
/** store a unit's result: collected (node bake), posted back to the dev server (browser, dev), or nothing (production) */
export function cacheStore(unit: string, key: string, v: unknown): void {
  if (COLLECT) { try { COLLECT.set(`${unit}|${key}`, pack(v)); } catch (err) { console.warn(`[world-cache] ${unit}: not packable (${(err as Error).message})`); } return; }
  if (!cacheEnabled() || !(import.meta as any).env?.DEV) return;
  void (async () => { const s = (await srcHashes())?.[unit]; if (!s) return;
    try { const body = pack(v); const r = await fetch(`/__world-cache/put?unit=${encodeURIComponent(unit)}&key=${encodeURIComponent(key)}&src=${s}`, { method: 'POST', body: body as any }); if (r.ok) cacheStats.puts.push(`${unit}|${key}`); }
    catch (err) { console.warn(`[world-cache] ${unit}: not packable (${(err as Error).message})`); } })();
}

// ---------------------------------------------------------------------------------------------- the preloaded entries
const PRE = new Map<string, unknown>();
let MISSING: Record<string, string> = {};
/** fetch and unpack every fresh entry of these units (all when omitted), for cacheTake. Never throws */
export async function preloadWorldCache(units?: string[]): Promise<void> {
  if (!cacheEnabled()) return;
  const t0 = performance.now(), [src, man] = await Promise.all([srcHashes(), manifest()]); let bytes = 0;
  if (!src || !man) { MISSING = { '*': !src ? 'no source hashes (no world-cache/src.json)' : 'no manifest (not baked)' }; return; }
  const want = Object.entries((man as Manifest).entries).filter(([k]) => !units || units.includes(k.split('|')[0]));
  await Promise.all(want.map(async ([k, e]) => { const unit = k.split('|')[0];
    if (e.src !== src[unit]) { MISSING[k] = src[unit] ? 'stale' : 'no source hash'; return; }
    try { const b = await getEntry(e.file); if (!b) { MISSING[k] = 'not served'; return; } bytes += e.bytes; PRE.set(k, unpack(b)); }
    catch (err) { MISSING[k] = `unreadable (${(err as Error).message})`; } }));
  cacheStats.preloadMs = Math.round(performance.now() - t0); cacheStats.preloadMB = +(bytes / 1048576).toFixed(1);
}
/** the unit's preloaded result (taken: the page keeps no second copy), else null */
export function cacheTake<T>(unit: string, key: string): T | null {
  const k = `${unit}|${key}`;
  if (PRE.has(k)) { const v = PRE.get(k) as T; PRE.delete(k); cacheStats.hits[k] = 0; return v; }
  if (cacheEnabled()) cacheStats.misses[k] = MISSING[k] ?? MISSING['*'] ?? 'not baked';
  return null;
}
/** a unit computed synchronously: its preloaded result when fresh, else compute() (and store it) */
export function cachedSync<T>(unit: string, key: string, compute: () => T): T {
  const hit = cacheTake<T>(unit, key);
  if (hit !== null) { if (verifyOn()) verify(unit, hit, compute()); return hit; }
  const v = compute(); cacheStore(unit, key, v); return v;
}
function verify(unit: string, a: unknown, b: unknown) { const x = identity(a), y = identity(b); (cacheStats as any).verify = { ...(cacheStats as any).verify, [unit]: x === y ? 'identical' : `MISMATCH ${x} != ${y}` }; console.info('[world-cache] verify', unit, x === y ? 'identical' : 'MISMATCH'); }

/** the unit's result: from the cache when its source hash matches, else compute() (and, on the dev server, bake it).
 *  The result must be plain data (objects, arrays, numbers, strings, typed arrays, Maps, Sets, registered classes): pack.ts. */
export async function cached<T>(unit: string, key: string, compute: () => T | Promise<T>): Promise<T> {
  if (!cacheEnabled()) { const v = await compute(); if (COLLECT) cacheStore(unit, key, v); return v; }
  const k = `${unit}|${key}`;
  if (PRE.has(k)) { const v = cacheTake<T>(unit, key)!; if (verifyOn()) verify(unit, v, await compute()); return v; }
  const t0 = performance.now(), [src, man] = await Promise.all([srcHashes(), manifest()]);
  const s = src?.[unit], e = man?.entries?.[k];
  if (s && e && e.src === s) {
    try { const b = await getEntry(e.file); if (b) { const v = unpack<T>(b); cacheStats.hits[k] = Math.round(performance.now() - t0);
      if (verifyOn()) verify(unit, v, await compute());
      return v; } }
    catch (err) { console.warn(`[world-cache] ${k}: unreadable (${(err as Error).message}); building live`); }
  }
  cacheStats.misses[k] = !s ? 'no source hash (unit not in units.json, or no dev server)' : !e ? 'not baked' : 'stale';
  const v = await compute(); if (s) cacheStore(unit, key, v);
  return v;
}

/** the unit's cached result when its source hash matches, else null (no compute: for a unit gathered during a sync build,
 *  then put with cachePut). Node: always null. */
export async function cacheGet<T>(unit: string, key: string): Promise<T | null> {
  const pre = cacheTake<T>(unit, key); if (pre !== null || !cacheEnabled()) return pre;
  const t0 = performance.now(), [src, man] = await Promise.all([srcHashes(), manifest()]);
  const s = src?.[unit], e = man?.entries?.[`${unit}|${key}`];
  if (s && e && e.src === s) try { const b = await getEntry(e.file); if (b) { const v = unpack<T>(b); cacheStats.hits[`${unit}|${key}`] = Math.round(performance.now() - t0); return v; } }
    catch (err) { console.warn(`[world-cache] ${unit}|${key}: unreadable (${(err as Error).message}); building live`); }
  cacheStats.misses[`${unit}|${key}`] = !s ? 'no source hash' : !e ? 'not baked' : 'stale'; return null;
}
/** bake a unit's result gathered live (the dev server checks the source hash again before writing) */
export async function cachePut(unit: string, key: string, v: unknown): Promise<void> { cacheStore(unit, key, v); }
