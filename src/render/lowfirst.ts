// s15/ship (D-368, UD-31): textures low first. The built site carries a 512-px copy of every scan jpg (textures/<id>/<f>.low.jpg,
// listed in textures/low.json with the full size; tools/deploy/build_site.mjs makes them): a first visit loads those (about a
// fourteenth of the bytes: the scans were ~150 MB of the first minute's fetches), drawn up to the full size so every texture
// keeps its size on the GPU, and after the world is up upgradeLowFirst() swaps in the full scans one by one in the background.
// A visit that already holds the full file (the service worker's cache) loads it at once. The dev server has no low.json:
// nothing changes there. ?fullscans: the full scans from the start (A/B).
import * as THREE from 'three/webgpu';

type LowManifest = Record<string, [number, number]>; // "<id>/<f>" -> the full file's [width, height]
let manP: Promise<LowManifest | null> | null = null;
const UPG: (() => Promise<void>)[] = [];
export const lowFirstStats = { low: 0, full: 0, upgraded: 0, pending: () => UPG.length };

function manifest(base: string): Promise<LowManifest | null> {
  if (typeof location === 'undefined' || new URLSearchParams(location.search).has('fullscans')) return Promise.resolve(null);
  return (manP ??= fetch(`${base}textures/low.json`).then(r => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null)).catch(() => null));
}
const cached = async (url: string) => { try { return typeof caches !== 'undefined' && !!(await caches.match(new URL(url, location.href).href)); } catch { return false; } };
/** the low copy to fetch first for a scan file url (`${base}textures/<id>/<f>.jpg`), or null (no copy, or the full one is cached) */
export async function lowOf(base: string, url: string): Promise<{ url: string; w: number; h: number } | null> {
  const m = await manifest(base); if (!m) return null;
  const k = url.slice(`${base}textures/`.length).replace(/\.jpg$/, ''), wh = m[k];
  if (!wh || await cached(url)) return null;
  return { url: url.replace(/\.jpg$/, '.low.jpg'), w: wh[0], h: wh[1] };
}
const bitmap = async (url: string, size?: { w: number; h: number }) => {
  const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return createImageBitmap(await r.blob(), size ? { resizeWidth: size.w, resizeHeight: size.h, resizeQuality: 'high' } : {});
};
/** a scan texture: the low copy drawn up to the full size now and the full file later, else the full file (TextureLoader) */
export async function loadScanTexture(base: string, url: string, loader: THREE.TextureLoader): Promise<THREE.Texture> {
  const low = await lowOf(base, url);
  if (!low) { lowFirstStats.full++; return loader.loadAsync(url); }
  const t = new THREE.Texture(await bitmap(low.url, low)); t.needsUpdate = true; lowFirstStats.low++;
  UPG.push(async () => { const full = await bitmap(url); (t.image as ImageBitmap)?.close?.(); t.image = full; t.needsUpdate = true; });
  return t;
}
/** a later upgrade of something built from low copies (the ground layers' array) */
export function addUpgrade(f: () => Promise<void>) { UPG.push(f); }
/** swap in the full scans, one at a time, each after an idle moment (call once the world is up) */
export async function upgradeLowFirst(): Promise<number> {
  let n = 0;
  while (UPG.length) { const f = UPG.shift()!; await new Promise(r => setTimeout(r, 50));
    try { await f(); n++; lowFirstStats.upgraded++; } catch (e) { console.warn('[lowfirst]', (e as Error).message); } }
  return n;
}
