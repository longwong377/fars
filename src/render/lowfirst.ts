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
/** D-740 (s18 C9): KTX2 low first. A KTX2 scan (UASTC, BC7 on the GPU) listed in textures/ktx_low.json has an ETC1S twin
 *  `<map>.low.ktx2` at the same size with the same mips (a quarter to a fifth of the bytes; Basis transcodes both to the same
 *  GPU format, BC7 on the T4): a first visit loads the twin and, after the world is up, the UASTC file's mips replace the twin's
 *  in the same GPU texture (three re-uploads a non-render-target texture in place). Before, the KTX2 scans bypassed low first
 *  (+34 MB before ready, s17 D-580), so the rest stayed jpgs at 4x the GPU memory. A cached full file loads at once; ?fullscans
 *  or a twin that does not match (size, mips, format) keeps the full file. */
let lowKtxP: Promise<Set<string> | null> | null = null;
function lowKtxList(base: string): Promise<Set<string> | null> {
  if (typeof location === 'undefined' || new URLSearchParams(location.search).has('fullscans')) return Promise.resolve(null);
  return (lowKtxP ??= fetch(`${base}textures/ktx_low.json`).then(r => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
    .then(j => (j?.maps ? new Set(Object.keys(j.maps)) : null)).catch(() => null));
}
/** the twin to load first for a KTX2 url (`${base}textures/<key>.ktx2`), or null */
export async function lowKtxOf(base: string, url: string): Promise<string | null> {
  const pre = `${base}textures/`; if (!url.startsWith(pre) || !url.endsWith('.ktx2') || url.endsWith('.low.ktx2')) return null;
  const L = await lowKtxList(base), k = url.slice(pre.length, -5); if (!L?.has(k) || await cached(url)) return null;
  return url.replace(/\.ktx2$/, '.low.ktx2');
}
/** wrap a KTX2Loader's loadAsync with low first (loaders.ts: the page's one transcoder) */
export function lowFirstKTX2(loader: any, base: string) {
  if (loader.__lowFirst) return loader; loader.__lowFirst = true;
  const load = loader.loadAsync.bind(loader);
  // (the twin is ETC1S, the full file UASTC: three's transcoder sends both to BC7 only where BC7 is the GPU's best format for
  // both, a desktop GPU without ETC2 or ASTC (the T4); elsewhere (SwiftShader, Apple: ETC1S -> ETC1, UASTC -> ASTC or BC7)
  // they would differ and the swap could not go into the same texture, so the full file loads at once there)
  // (?twins=1 forces them, the cloud's measure of the T4's bytes: the swap is then refused where the formats differ; ?twins=0 never)
  const tw = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('twins') : null;
  const sameTarget = () => { if (tw) return tw === '1'; const c = loader.workerConfig ?? {}; return !!c.bptcSupported && !c.astcSupported && !c.etc2Supported && !c.etc1Supported; };
  loader.loadAsync = async (url: string, onProgress?: any) => {
    const low = sameTarget() ? await lowKtxOf(base, url).catch(() => null) : null; if (!low) return load(url, onProgress);
    let t: any; try { t = await load(low, onProgress); } catch { return load(url, onProgress); }
    lowFirstStats.low++;
    UPG.push(async () => { const f: any = await load(url);
      const same = f.image?.width === t.image?.width && f.image?.height === t.image?.height && (f.image?.depth ?? 1) === (t.image?.depth ?? 1) && f.format === t.format && f.mipmaps?.length === t.mipmaps?.length;
      if (!same) { f.dispose?.(); throw new Error(`${url}: the low twin does not match (kept)`); }
      t.mipmaps = f.mipmaps; t.image = f.image; if (t.userData) t.userData.released = false; t.needsUpdate = true; lowFirstStats.full++; });
    return t;
  };
  return loader;
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
