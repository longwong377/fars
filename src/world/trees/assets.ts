// The Blender-built tree assets (D-327; tools/blender/trees.mjs, public/models/trees/): every species' leaf, blossom and
// twig tiles rendered in Cycles from modelled leaves (leaf_col.png, leaf_tilt.png), every variant's branches as one
// continuous bark-mapped mesh per level of detail with baked occlusion (wood.json + wood.bin), and the species' CC0 bark
// scans (bark/<scan>_diff.jpg, _nor.jpg; src/data/tree_bark.json). Loaded once before the tree kit is built (world.ts,
// treeLab.ts); the kit (render.ts TreeKit) draws them when present and its procedural stand-ins otherwise (the dev overlay
// then says PLACEHOLDER). `?treeassets=0` leaves them out (A/B). Node (tests, tools): loadTreeAssetsNode reads the same
// files from disk (no bark textures: those are for the GPU only).
import * as THREE from 'three/webgpu';
import BARK from '../../data/tree_bark.json';
import { atlasFromImages, type Atlas } from './atlas';
import { SPECIES } from './species';

export interface WoodEntry { row: number; species: string; variant: number; v0: number; nv: number; i0: number; ni: number; tris: number; chains: number; ao_mean: number }
export interface WoodMeta { stride: number; budget: [number, number]; vertex_floats: number; indices: number; lods: [WoodEntry[], WoodEntry[]] }
export interface TreeManifest { inHash: string; shadeB: number; tile: number; files: Record<string, { sha256: string; bytes: number }>; [k: string]: any }
/** one level of the wood as the GPU reads it: per model row, the triangles' corners (position + u, normal + v, tangent +
 *  occlusion: 3 texels each), `tmax` triangles a row (unused ones zero-sized) */
export interface WoodLevel { tmax: number; tris: number[]; data: Float32Array; width: number; height: number }
export interface TreeAssets {
  manifest: TreeManifest; atlas: Atlas; wood: [WoodLevel, WoodLevel];
  /** the bark scans as one array texture (layer per scan: R luminance / (2 x mean), G B the normal's x y, A the warm-cool
   *  axis 0.5 + 1.5 w) and each species' layer and weights; browser only */
  bark: { tex: THREE.DataArrayTexture; layer: Record<string, number>; scans: string[] } | null;
}
let ASSETS: TreeAssets | null = null; let OFF = false;
const STATS = { ms: 0, loaded: false, error: '' as string, bytes: 0 };
export const treeAssets = () => (OFF ? null : ASSETS);
export const treeAssetStats = () => ({ ...STATS, off: OFF });
/** tests: install (or clear) assets */
export function setTreeAssets(a: TreeAssets | null) { ASSETS = a; }
export const BARK_SPECIES = BARK.species as unknown as Record<string, { scan: string; size_m: [number, number]; detail: number; warm: number; relief: number; note: string }>;
/** the distinct scans in a fixed order (the array texture's layers) */
export const BARK_SCANS = [...new Set(SPECIES.map(s => BARK_SPECIES[s.id]?.scan).filter(Boolean))] as string[];

/** the wood levels from wood.json + wood.bin: triangles expanded to corners in the data-texture layout */
export function woodLevels(meta: WoodMeta, bin: ArrayBuffer, rows: number): [WoodLevel, WoodLevel] {
  const VB = new Float32Array(bin, 0, meta.vertex_floats), IB = new Uint16Array(bin, meta.vertex_floats * 4, meta.indices), S = meta.stride;
  return [0, 1].map(lod => {
    const tmax = meta.budget[lod], W = tmax * 3, H = rows * 3, data = new Float32Array(W * H * 4), tris = new Array(rows).fill(0);
    for (const e of meta.lods[lod]) {
      tris[e.row] = e.tris;
      for (let c = 0; c < e.ni; c++) { const v = (e.v0 + IB[e.i0 + c]) * S;
        for (let k = 0; k < 3; k++) { const o = ((e.row * 3 + k) * W + c) * 4;
          data[o] = VB[v + k * 3]; data[o + 1] = VB[v + k * 3 + 1]; data[o + 2] = VB[v + k * 3 + 2]; data[o + 3] = VB[v + 9 + k]; } }
    }
    return { tmax, tris, data, width: W, height: H };
  }) as [WoodLevel, WoodLevel];
}

/** browser: load everything (never throws: a failure leaves the procedural trees, and says so) */
export async function loadTreeAssets(base = '/', rows = SPECIES.length * 3): Promise<ReturnType<typeof treeAssetStats>> {
  const t0 = performance.now();
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('treeassets') === '0') { OFF = true; return treeAssetStats(); }
  try {
    const url = (f: string) => `${base}models/trees/${f}`;
    const r = await fetch(url('manifest.json')); if (!r.ok) throw new Error(`manifest ${r.status}`);
    const manifest = await r.json() as TreeManifest;
    const pixels = async (f: string) => {
      const q = await fetch(url(f)); if (!q.ok || !(q.headers.get('content-type') ?? '').startsWith('image/')) throw new Error(`${f}: ${q.status}`);
      const blob = await q.blob(); STATS.bytes += blob.size;
      const bm = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const cv = new OffscreenCanvas(bm.width, bm.height), g = cv.getContext('2d', { willReadFrequently: true })!; g.drawImage(bm, 0, 0);
      const d = g.getImageData(0, 0, bm.width, bm.height).data, W = bm.width, H = bm.height; bm.close();
      return { d, W, H };
    };
    /** PNG rows are top-down; the atlas's row 0 is v = 0 */
    const flip = (p: { d: Uint8ClampedArray; W: number; H: number }) => { const o = new Uint8Array(p.W * p.H * 4); for (let j = 0; j < p.H; j++) o.set(p.d.subarray((p.H - 1 - j) * p.W * 4, (p.H - j) * p.W * 4), j * p.W * 4); return o; };
    const [col, tilt, wj, wb] = await Promise.all([pixels('leaf_col.png'), pixels('leaf_tilt.png'), fetch(url('wood.json')).then(q => q.json()), fetch(url('wood.bin')).then(q => q.arrayBuffer())]);
    STATS.bytes += wb.byteLength;
    const atlas = atlasFromImages(flip(col), flip(tilt), col.W, col.H, [0, manifest.shadeB]);
    const wood = woodLevels(wj, wb, rows);
    const bark = await loadBark(base, pixels).catch(e => { console.warn(`[trees] bark scans: ${(e as Error).message}`); return null; });
    ASSETS = { manifest, atlas, wood, bark }; STATS.loaded = true;
  } catch (e) { STATS.error = (e as Error).message; console.warn(`[trees] Blender tree assets not loaded (${STATS.error}): the procedural trees are drawn`); }
  STATS.ms = Math.round(performance.now() - t0);
  return treeAssetStats();
}

/** the bark array: per scan, its colour's luminance over twice its mean (R), the normal map's x y (G B) and the warm-cool
 *  axis (A); all at the same size */
async function loadBark(base: string, pixels: (f: string) => Promise<{ d: Uint8ClampedArray; W: number; H: number }>) {
  const scans = BARK_SCANS, N = scans.length; let R = 0; let data: Uint8Array | null = null;
  const lin = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  for (let k = 0; k < N; k++) {
    const [dif, nor] = await Promise.all([pixels(`bark/${scans[k]}_diff.jpg`), pixels(`bark/${scans[k]}_nor.jpg`)]);
    if (!data) { R = dif.W; data = new Uint8Array(R * R * 4 * N); }
    if (dif.W !== R || dif.H !== R || nor.W !== R) throw new Error(`bark ${scans[k]}: ${dif.W}x${dif.H} (want ${R})`);
    let ml = 0, mw = 0; const n = R * R, L = new Float32Array(n), Wm = new Float32Array(n);
    for (let i = 0; i < n; i++) { const r = lin[dif.d[i * 4]], g = lin[dif.d[i * 4 + 1]], b = lin[dif.d[i * 4 + 2]], l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      L[i] = l; Wm[i] = (r - b) / (l + 0.02); ml += l; mw += Wm[i]; }
    ml /= n; mw /= n; const o = k * n * 4;
    for (let i = 0; i < n; i++) { data[o + i * 4] = Math.min(255, Math.round((L[i] / (2 * ml)) * 255)); data[o + i * 4 + 1] = nor.d[i * 4]; data[o + i * 4 + 2] = nor.d[i * 4 + 1];
      data[o + i * 4 + 3] = Math.max(0, Math.min(255, Math.round((0.5 + 1.5 * (Wm[i] - mw) * 0.5) * 255))); }
  }
  const tex = new THREE.DataArrayTexture(data!, R, R, N);
  tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType; tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 8; tex.needsUpdate = true;
  const layer: Record<string, number> = {}; for (const s of SPECIES) layer[s.id] = scans.indexOf(BARK_SPECIES[s.id].scan);
  return { tex, layer, scans };
}
