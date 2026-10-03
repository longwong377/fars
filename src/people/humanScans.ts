// The people's scanned layers (D-304, session 11): MakeHuman's CC0 skins and CC0 textile and leather scans, built by
// tools/build_humans_scans.py into public/generated/humans/scans/ and packed here into two array textures (one sampler
// each: WebGPU's sampled-texture budget per fragment stage, D-295):
//   skin  — 12 layers (1024²): the MakeHuman skin albedo of a sex and age, light- and dark-toned sources, each rescaled to
//           the reference tone (REF_TONE) so the person's own tone (looks.ts) still sets the colour; the texture brings the
//           variation (lips, lids, knuckles, blotches, veins, age). Every body variant takes one light and one dark layer
//           (skinLayersOf) and the material blends them by the person's tone.
//   cloth — 4 layers (1024²): linen, wool, felt, leather; RGB the scan over its own mean × k (so the garment keeps its
//           dye), A its height (mean 0.5). Laid triplanar in the body's bind space (the weave moves with the cloth).
// In node (tests, bakes) nothing is loaded and the material keeps its procedural skin albedo and weave (identity).
// `?noscans` (the A/B of D-295) turns these off too. Tier C: modern skin and textiles for 467's grain; tone, dye and cut
// stay the evidence's.
import * as THREE from 'three/webgpu';
import type { HumanVariantMeta } from './humanFormat';
import { BASE } from '../core/base';
import { sharedKTX2 } from '../render/loaders';

export interface ScanLayerMeta { id: string; layer: number; tile?: number; fabric?: string; k?: number }
/** D-307: skin and cloth are one array texture (the skin's layers first, the cloth's from `clothBase`): one binding and one
 *  sampler in the human material's fragment stage, whose samplers the world's lights and shadows nearly fill (WebGPU: 16) */
export interface HumanScans { skin: THREE.DataArrayTexture | THREE.CompressedArrayTexture; cloth: THREE.DataArrayTexture | THREE.CompressedArrayTexture; clothBase: number; skinIds: string[]; cloth_: ScanLayerMeta[]; clothK: number;
  /** D-322: the garments' fold-height layers (people_cloth: RGB the men's, women's and children's settled folds finer than the
   *  full-detail mesh (layer foldBase) and than the mid one (foldBase + 1), sRGB-encoded heights about 0.5, ± foldScale m);
   *  foldBase −1: none */
  foldBase: number; foldScale: number }
/** D-322: the fold layers to append (the people_cloth PNG: its layers, squares stacked vertically) */
export interface FoldSource { url: string; layers: number; scale: number }
export const SCANS_DIR = 'generated/humans/scans';

async function img(url: string): Promise<ImageBitmap> {
  const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
}
function pixels(ctx: CanvasRenderingContext2D, b: ImageBitmap, n: number): Uint8ClampedArray {
  ctx.clearRect(0, 0, n, n); ctx.drawImage(b, 0, 0, n, n); return ctx.getImageData(0, 0, n, n).data;
}
function arrayTex(data: Uint8Array, n: number, layers: number, srgb: boolean) {
  const t = new THREE.DataArrayTexture(data, n, n, layers);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8; t.flipY = false; t.needsUpdate = true; return t;
}

async function ktxArray(dir: string, n: number, skins: number, cloth: number, folds: FoldSource | null): Promise<any> {
  if (new URLSearchParams(location.search).has('scanjpg')) return null;
  try {
    const m = await fetch(dir + 'scans_ktx.json').then(r => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null));
    if (!m || m.size !== n || m.skin !== skins || m.cloth !== cloth || (m.folds?.layers ?? 0) !== (folds?.layers ?? 0) || (folds && !folds.url.endsWith(m.folds?.file))) return null;
    const K = await sharedKTX2(BASE), t = await K.loadAsync(dir + 'scans.ktx2');
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.needsUpdate = true;
    return t;
  } catch (e) { console.warn('[humanScans] scans.ktx2 not loaded; the jpgs', e); return null; }
}
/** load and pack the layers; null without a DOM, with `?noscans`, or when the files are missing (the procedural path) */
export async function loadHumanScans(base = BASE, folds: FoldSource | null = null): Promise<HumanScans | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('noscans')) return null;
  try {
    const dir = `${base}${SCANS_DIR}/`;
    const meta = await (await fetch(dir + 'scans.json')).json();
    const n: number = meta.size, skins: ScanLayerMeta[] = meta.skin, cloth: ScanLayerMeta[] = meta.cloth;
    // D-740 (s18 C9, format only): the same layers baked as one KTX2 array (tools/bake_world/ktx_humans.ts): BC7 on the GPU (a
    // quarter of the RGBA8 array's 107 MB), nothing decoded or packed here; used when its layers are the ones packed below
    const kx = await ktxArray(dir, n, skins.length, cloth.length, folds);
    if (kx) return { skin: kx, cloth: kx, clothBase: skins.length, skinIds: skins.map(s => s.id), cloth_: cloth, clothK: cloth[0]?.k ?? 0.4, foldBase: folds ? skins.length + cloth.length : -1, foldScale: folds?.scale ?? 0 };
    const cv = document.createElement('canvas'); cv.width = cv.height = n;
    const ctx = cv.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' } as any) as CanvasRenderingContext2D;
    // D-322: the garments' fold layers follow the cloth's (none if their image fails: the folds in the geometry stay)
    const fb = folds ? await img(folds.url).catch(e => { console.warn('fold layers not loaded', e); return null; }) : null, NF = fb ? folds!.layers : 0;
    const S = new Uint8Array(n * n * 4 * (skins.length + cloth.length + NF)); // (D-307: the cloth's layers follow the skin's)
    const sb = await Promise.all(skins.map(s => img(`${dir}skin_${String(s.layer).padStart(2, '0')}.jpg`)));
    sb.forEach((b, k) => { S.set(pixels(ctx, b, n), k * n * n * 4); b.close(); });
    const C = S.subarray(n * n * 4 * skins.length);
    const cb = await Promise.all(cloth.map(c => Promise.all([img(`${dir}cloth_${c.layer}.jpg`), img(`${dir}cloth_${c.layer}_h.jpg`)])));
    cb.forEach(([d, h], k) => { const D = pixels(ctx, d, n).slice(), H = pixels(ctx, h, n), o = k * n * n * 4;
      for (let i = 0; i < n * n; i++) D[i * 4 + 3] = H[i * 4]; // the height in alpha (data, not colour: sRGB formats leave alpha linear)
      C.set(D, o); d.close(); h.close(); });
    if (fb) { const h = fb.height / NF; for (let k = 0; k < NF; k++) { ctx.clearRect(0, 0, n, n); ctx.drawImage(fb, 0, k * h, fb.width, h, 0, 0, n, n); S.set(ctx.getImageData(0, 0, n, n).data, (skins.length + cloth.length + k) * n * n * 4); } fb.close(); }
    const all = arrayTex(S, n, skins.length + cloth.length + NF, true); // (both were sRGB arrays: the cloth's height in alpha stays linear)
    return { skin: all, cloth: all, clothBase: skins.length, skinIds: skins.map(s => s.id), cloth_: cloth, clothK: cloth[0]?.k ?? 0.4, foldBase: NF ? skins.length + cloth.length : -1, foldScale: folds?.scale ?? 0 };
  } catch (e) { console.warn('human scans not loaded (procedural skin and weave kept)', e); return null; }
}

/** the light- and dark-toned skin layer of a body variant, by sex and age (children take the young women's: no child
 *  skins in MakeHuman; smooth, beardless); within an age band the light source alternates by variant for variety */
export function skinLayersOf(v: Pick<HumanVariantMeta, 'sex' | 'ageYears' | 'group'>, index: number, ids: string[]): [number, number] {
  const L = (id: string) => Math.max(0, ids.indexOf(id));
  const f = v.sex === 'f' || v.group === 'child', a = v.ageYears, p = f ? 'f' : 'm';
  if (v.group === 'child' || a < 30) return [L(`${p}_young_${index % 2 ? 'b' : 'a'}`), L(`${p}_young_d`)];
  if (a < 50) return [L(`${p}_mid`), L(a < 40 ? `${p}_young_d` : `${p}_old_d`)];
  return [L(`${p}_old`), L(`${p}_old_d`)];
}
