// s14/load (D-354): the baked world. Pure CPU results of the build (the far people's atlas, the fitted costumes, the hills'
// landform maps, ...) kept on disk under public/world-cache/ and read back on load instead of being computed again.
// Each unit's entry records the hash of the sources and data it was computed from (tools/bake_world/srchash.mjs, the units
// in ./units.json); a page uses an entry only when that hash equals the served tree's (/world-cache/src.json), otherwise it
// computes the unit live (the fallback) and, on the dev server, posts the result back so the next load reads it.
// ?worldcache=0 skips the cache (A/B timing, and the live build's own check); node (tests, tools) always builds live.
import { pack, unpack, hashBytes } from './pack';

type Manifest = { v: number; entries: Record<string, { src: string; file: string; bytes: number; sha1: string }> };
export const cacheStats: { hits: Record<string, number>; misses: Record<string, string>; puts: string[] } = { hits: {}, misses: {}, puts: [] };
const browser = typeof window !== 'undefined' && typeof fetch !== 'undefined' && typeof location !== 'undefined';
let srcP: Promise<Record<string, string> | null> | null = null, manP: Promise<Manifest | null> | null = null;
const getJson = (u: string) => fetch(u, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
const srcHashes = () => (srcP ??= getJson('/world-cache/src.json'));
const manifest = () => (manP ??= getJson('/world-cache/manifest.json'));
/** timings inside a unit's result, left out of its identity hash */
const VOLATILE = new Set(['ms', 'parts']);
const strip = (v: any): any => (v === null || typeof v !== 'object' || ArrayBuffer.isView(v) ? v : Array.isArray(v) ? v.map(strip) : Object.fromEntries(Object.entries(v).filter(([k]) => !VOLATILE.has(k)).map(([k, x]) => [k, strip(x)])));
/** the identity of a unit's result: the hash of its packed form without the timings (the node test and ?worldcache=verify) */
export const identity = (v: unknown) => hashBytes(pack(strip(v)));
export const cacheEnabled = () => browser && new URLSearchParams(location.search).get('worldcache') !== '0';

/** start fetching the hashes and the manifest (call early: they cost one round trip each) */
export function prefetchWorldCache() { if (cacheEnabled()) { void srcHashes(); void manifest(); } }

/** the unit's result: from the cache when its source hash matches, else compute() (and, on the dev server, bake it).
 *  The result must be plain data (objects, arrays, numbers, strings, typed arrays): see pack.ts. */
export async function cached<T>(unit: string, key: string, compute: () => T | Promise<T>): Promise<T> {
  if (!cacheEnabled()) return compute();
  const t0 = performance.now(), [src, man] = await Promise.all([srcHashes(), manifest()]);
  const s = src?.[unit], e = man?.entries?.[`${unit}|${key}`];
  if (s && e && e.src === s) {
    try { const r = await fetch('/world-cache/' + e.file); if (r.ok) { const v = unpack<T>(await r.arrayBuffer()); cacheStats.hits[`${unit}|${key}`] = Math.round(performance.now() - t0);
      if (new URLSearchParams(location.search).get('worldcache') === 'verify') { const a = identity(v), b = identity(await compute()); (cacheStats as any).verify = { ...(cacheStats as any).verify, [unit]: a === b ? 'identical' : `MISMATCH ${a} != ${b}` }; console.info('[world-cache] verify', unit, a === b ? 'identical' : 'MISMATCH'); }
      return v; } }
    catch (err) { console.warn(`[world-cache] ${unit}|${key}: unreadable (${(err as Error).message}); building live`); }
  }
  cacheStats.misses[`${unit}|${key}`] = !s ? 'no source hash (unit not in units.json, or no dev server)' : !e ? 'not baked' : 'stale';
  const v = await compute();
  if (s && (import.meta as any).env?.DEV) { // bake it for the next load (the dev server checks the hash again before writing)
    try { const body = pack(v); void fetch(`/__world-cache/put?unit=${encodeURIComponent(unit)}&key=${encodeURIComponent(key)}&src=${s}`, { method: 'POST', body: body as any })
      .then(r => { if (r.ok) cacheStats.puts.push(`${unit}|${key}`); }).catch(() => {}); }
    catch (err) { console.warn(`[world-cache] ${unit}: not packable (${(err as Error).message})`); }
  }
  return v;
}

/** the unit's cached result when its source hash matches, else null (no compute: for a unit gathered during a sync build,
 *  then put with cachePut). Node: always null. */
export async function cacheGet<T>(unit: string, key: string): Promise<T | null> {
  if (!cacheEnabled()) return null;
  const t0 = performance.now(), [src, man] = await Promise.all([srcHashes(), manifest()]);
  const s = src?.[unit], e = man?.entries?.[`${unit}|${key}`];
  if (s && e && e.src === s) try { const r = await fetch('/world-cache/' + e.file); if (r.ok) { const v = unpack<T>(await r.arrayBuffer()); cacheStats.hits[`${unit}|${key}`] = Math.round(performance.now() - t0); return v; } }
    catch (err) { console.warn(`[world-cache] ${unit}|${key}: unreadable (${(err as Error).message}); building live`); }
  cacheStats.misses[`${unit}|${key}`] = !s ? 'no source hash' : !e ? 'not baked' : 'stale'; return null;
}
/** bake a unit's result gathered live (the dev server checks the source hash again before writing) */
export async function cachePut(unit: string, key: string, v: unknown): Promise<void> {
  if (!cacheEnabled() || !(import.meta as any).env?.DEV) return; const s = (await srcHashes())?.[unit]; if (!s) return;
  try { const body = pack(v); const r = await fetch(`/__world-cache/put?unit=${encodeURIComponent(unit)}&key=${encodeURIComponent(key)}&src=${s}`, { method: 'POST', body: body as any }); if (r.ok) cacheStats.puts.push(`${unit}|${key}`); }
  catch (err) { console.warn(`[world-cache] ${unit}: not packable (${(err as Error).message})`); }
}
