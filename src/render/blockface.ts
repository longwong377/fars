// D-321: the dressed stone's block faces from a Blender-carved and baked detail set (tools/blender/blockface.{json,py,mjs}).
// Every layer is a tileable 2.048 m square at 1 mm per texel whose surface was carved stroke by stroke with the mason's tools
// (toothed chisel, flat chisel, point) and baked in Cycles (tangent-space normals, AO); strip layers hold 16 arris strips
// (128 mm from the joint each: the margin strokes along the arris, the chips of handling and setting, or the foot's pitched
// arris and spalls). All layers are ONE 2-D array texture (one sampler: WebGPU allows 16 per fragment stage, B122), sampled
// in each block's own frame (materials.ts: the joint pattern's block indices choose the layer, an offset and a mirror; the
// distance to the nearest joint and the position along it address the strips), so every block of every dressed-stone
// surface carries its own tool marks and arrises. In node (tests, bakes) nothing loads and every function here is the
// identity (the CPU mirrors of materials.ts hold). Tier C (Q-484, Q-930).
import * as THREE from 'three/webgpu';
import { texture, vec2, float, int, clamp, sqrt, max, dFdx, dFdy, mix, uniform, step, smoothstep, fract, floor } from 'three/tsl';
import META from '../data/blockface.json';

export const BLOCKFACE = META as unknown as { res: number; size_m: number; strip_rows: number; strip_px: number;
  layers: { id: string; kind: string; hscale: number; ao_mean: number; h_mean: number; h_sd: number; slope_sd: number; note: string }[];
  inHash: string; outHash: string; bytes: number };
/** layer index by id (claw_a, claw_b, claw_c, flat, point, strip_fine, strip_rough) */
export const BF_LAYER: Record<string, number> = Object.fromEntries(BLOCKFACE.layers.map((l, i) => [l.id, i]));
let TEX: THREE.Texture | null = null;
/** A/B at run time (window.__parsaSurf.blockface(on)): 1 the set drawn, 0 the faces without it (the tool marks then absent) */
export const BF_ON = uniform(1);
if (typeof globalThis !== 'undefined') (globalThis as any).__parsaSurf = { ...((globalThis as any).__parsaSurf ?? {}), blockface: (on: boolean | number) => { BF_ON.value = typeof on === 'number' ? on : on ? 1 : 0; } }; // (a number: a gain, for checking the detail's placement)
/** `?noblockface` turns the set off (A/B); set before the first surface material is built */
export let blockFaceOn = true;
export const blockFaceLoaded = () => TEX !== null && blockFaceOn;
export const blockFaceStats = { ms: 0, format: '', error: '' };

/** load the set (browser; awaited with the scans before any surface material builds). Never throws: without it the
 *  procedural tool marks of materials.ts stand (and blockFaceStats.error says why) */
export async function loadBlockFace(base = '/', anisotropy = 8): Promise<void> {
  if (typeof document === 'undefined') return;
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('noblockface')) { blockFaceOn = false; return; }
  const t0 = performance.now();
  try {
    const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
    // the transcoder's target format from the adapter's features (as models.ts: the scans load before the renderer exists)
    const ad = await (globalThis as any).navigator?.gpu?.requestAdapter?.().catch(() => null);
    const k = new KTX2Loader().setTranscoderPath(base + 'models/lib/basis/');
    k.detectSupport({ isWebGPURenderer: true, hasFeature: (f: string) => !!ad?.features?.has(f) } as any);
    const t = await k.loadAsync(base + 'textures/blockface/blockface.ktx2') as THREE.Texture;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; t.colorSpace = THREE.NoColorSpace;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
    blockFaceStats.format = String((t as any).format); TEX = t; k.dispose();
  } catch (e) { blockFaceStats.error = String((e as Error)?.message ?? e); console.warn('[blockface] not loaded:', blockFaceStats.error); }
  blockFaceStats.ms = Math.round(performance.now() - t0);
}
/** tests (D-321): a stand-in array texture, so the material graphs build in node as in the browser (the sampler count) */
export function setBlockFaceTextureForTest(on = true): void {
  if (!on) { TEX = null; return; }
  const a = new THREE.DataArrayTexture(new Uint8Array(4 * 4 * 4 * BLOCKFACE.layers.length), 4, 4, BLOCKFACE.layers.length); a.needsUpdate = true; TEX = a;
}

/** the architecture's 'adist' attribute (meshes.ts bevelledBox) holds the distance (m) to each of a face's four bevelled arrises
 *  minus this, so a geometry without it (read as 0) has none */
export const ADIST_OFF = 1000;
export interface Detail { slope: any; h: any; ao: any }
/** the texel's shading slope (dh/du, dh/dv), height (mm) and AO from a sample */
function decode(s: any, hscale: any, flip: any): Detail {
  const nx = s.r.mul(2).sub(1).mul(flip), ny = s.g.mul(2).sub(1);
  const nz = sqrt(max(float(1).sub(nx.mul(nx)).sub(ny.mul(ny)), float(0.09)));
  // the tangent normal (−hu, −hv, 1)/|·| → the slope the materials add to the face normal along (T1, T2): (−hu, −hv) = n.xy / n.z
  return { slope: vec2(nx, ny).div(nz), h: s.b.sub(0.5).mul(hscale), ao: s.a };
}
/** a face layer at (u, v) m in the block's face frame: `off` a per-block offset (m), `flip` ±1 mirrors u, `layer` an int
 *  node, `hscale` the layer's height scale (mm). The gradients are the continuous coordinates' (the per-block offset
 *  jumps at the joints and would otherwise pick the smallest mip along them) */
export function faceDetail(u: any, v: any, off: any, flip: any, layer: any, hscale: any): Detail {
  const S = BLOCKFACE.size_m, uu = u.mul(flip);
  const uv = vec2(uu.add(off.x), v.add(off.y)).div(S);
  const gx = vec2(dFdx(uu), dFdx(v)).div(S), gy = vec2(dFdy(uu), dFdy(v)).div(S);
  return decode(texture(TEX!, uv).depth(int(layer)).grad(gx, gy), hscale, flip);
}
/** an arris strip: `along` m along the arris (+ `off`), `d` m from it (into the block's face), `row` 0..strip_rows-1 (float),
 *  `layer` the strip layer. Beyond the strip's depth the caller weights it out */
export function stripDetail(along: any, off: any, d: any, row: any, layer: any): Detail {
  const S = BLOCKFACE.size_m, R = BLOCKFACE.res, P = BLOCKFACE.strip_px, mmPx = (S * 1000) / R;
  const dpx = clamp(d.mul(1000 / mmPx), 0.5, P - 0.5);
  const a = along.add(off);
  const uv = vec2(a.div(S), row.mul(P).add(dpx).div(R));
  const gx = vec2(dFdx(along).div(S), dFdx(d).mul(1000 / mmPx / R)), gy = vec2(dFdy(along).div(S), dFdy(d).mul(1000 / mmPx / R));
  return decode(texture(TEX!, uv).depth(int(layer)).grad(gx, gy), float(STRIP_HSCALE), float(1));
}
/** the strip layers' height scale (mm; both strip layers share it) */
export const STRIP_HSCALE = BLOCKFACE.layers.find(l => l.kind === 'strip')?.hscale ?? 64;
/** the face layers' mean AO, for a mean-preserving albedo term (0 … 1 per layer, as an expression of the chosen layer) */
export function faceAoMean(isPoint: any, isFlat: any): any {
  const L = BLOCKFACE.layers, claw = (L[0].ao_mean + L[1].ao_mean + L[2].ao_mean) / 3;
  return mix(mix(float(claw), float(L[BF_LAYER.flat].ao_mean), isFlat), float(L[BF_LAYER.point].ao_mean), isPoint);
}

/** a block's frame for blockFaceDetail (materials.ts builds it in each masonry branch) */
export interface BlockFrame {
  /** face coordinates (m, continuous over the face) along the world tangents T1, T2 (vec3) */
  u: any; v: any; T1: any; T2: any;
  /** the block's hashes in [0, 1) (materials.ts blockIds) */
  ids: { a: any; b: any; c: any; d: any; e: any; f: any; g: any; h: any };
  /** 0/1: the flat-chisel layer (up-facing faces: treads, landings, tops), the point-dressed layer and rough strips (the foot) */
  isFlat: any; isPoint: any;
  /** the nearest arris of each joint family: d (m from it), along (m along it, continuous), the world directions along it and
   *  away from it into this block, a 0/1 mask (joints drawn here), a 0/1 side (which of the block's two arrises of the family) */
  bed?: { d: any; along: any; Talong: any; Taway: any; mask: any; side: any; /** 0..1: the chips kept (D-321 rev 2: none where the arris is geometry) */ chip?: any };
  head?: { d: any; along: any; Talong: any; Taway: any; mask: any; side: any };
}
const MARGIN: [number, number] = [0.03, 0.04]; // the margin band's hand-over to the face (m from the arris; the strips' margin ends at 37 mm)
const CHIP: [number, number] = [0.15, 0.6]; // strip depth (mm) at which a chip replaces the face
/** the struck grooves' lightening per 1σ of the face's relief (C: fresh tool marks on limestone are whitish, the stun of the teeth) */
const STUN = 0.05;
/** the baked slopes are drawn × this: a normal map carries no self-shadowing, and in low sun a tool groove's own shadow is most of
 *  its read (a groove 0.4 mm deep shades its far wall); measured on the probe (tools/dev/blockface_probe.mjs, raking sun), C */
const RELIEF_GAIN = 1.6;
/** D-321: the block's face from the baked set: a world-space tilt to add to the shading normal, an albedo factor (the
 *  tool's bruised grooves a little lighter, fresh fracture in the chips, a share of the baked AO: the cavities also shade the
 *  sun), the AO for the ambient light, and the texel height (mm, the face or a chip). Mean-preserving over a face (the
 *  measured tint stands). Only called when the set is loaded (blockFaceLoaded) */
export function blockFaceDetail(F: BlockFrame): { tilt: any; alb: any; ao: any; h: any; chip: any } {
  const L = BLOCKFACE.layers, iF = F.isFlat, iP = F.isPoint, avg = (k: 'h_mean' | 'h_sd') => (L[0][k] + L[1][k] + L[2][k]) / 3;
  const layer = mix(mix(floor(F.ids.g.mul(2.999)), float(BF_LAYER.flat), iF), float(BF_LAYER.point), iP);
  const hsc = mix(float(L[BF_LAYER.claw_a].hscale), float(L[BF_LAYER.point].hscale), iP);
  const flip = float(1).sub(step(0.5, F.ids.c).mul(2)); // ±1: half the blocks mirrored
  const off = vec2(F.ids.a, F.ids.e).mul(BLOCKFACE.size_m);
  const Fd = faceDetail(F.u, F.v, off, flip, layer, hsc);
  const gain = mix(float(RELIEF_GAIN), float(1), iP); // (the point-dressed face's pits are deep enough as baked)
  let tilt: any = F.T1.mul(Fd.slope.x).add(F.T2.mul(Fd.slope.y)).mul(gain);
  let ao: any = Fd.ao.div(faceAoMean(iP, iF)), h: any = Fd.h;
  const hMean = mix(mix(float(avg('h_mean')), float(L[BF_LAYER.flat].h_mean), iF), float(L[BF_LAYER.point].h_mean), iP);
  const hSd = mix(mix(float(avg('h_sd')), float(L[BF_LAYER.flat].h_sd), iF), float(L[BF_LAYER.point].h_sd), iP);
  // the tool's struck grooves: limestone crushed by the teeth or the point dries a little lighter than the ridges (C, 1σ STUN)
  let alb: any = float(1).sub(clamp(Fd.h.sub(hMean).div(hSd.max(1e-3)), -2, 2).mul(STUN));
  let chip: any = float(0);
  const stripL = mix(float(BF_LAYER.strip_fine), float(BF_LAYER.strip_rough), iP), rows = BLOCKFACE.strip_rows;
  const fam = (J: NonNullable<BlockFrame['bed']>, seed: any, o: any) => {
    const row = floor(fract(seed.add(J.side.mul(0.5))).mul(rows - 0.001));
    const S = stripDetail(J.along, o.mul(BLOCKFACE.size_m * 3.1), J.d, row, stripL);
    const inStrip = float(1).sub(step(0.125, J.d)).mul(J.mask);
    const wM = float(1).sub(smoothstep(MARGIN[0], MARGIN[1], J.d)).mul(float(1).sub(iP)).mul(inStrip); // the margin band (fine strips)
    const wC = smoothstep(CHIP[0], CHIP[1], S.h.negate()).mul(inStrip).mul(J.chip ?? float(1)); // a chip
    return { S, wM, wC, t: J.Talong.mul(S.slope.x).add(J.Taway.mul(S.slope.y)).mul(RELIEF_GAIN) };
  };
  if (F.bed && F.head) {
    const B = fam(F.bed, F.ids.h, F.ids.f), H = fam(F.head, F.ids.d, F.ids.b);
    // the margins meet in a mitre (each band where its arris is the nearer); the chips of both, the deeper texel over the other
    const bedNearer = step(F.bed.d, F.head.d);
    const wB = max(B.wM.mul(bedNearer), B.wC), wH = max(H.wM.mul(float(1).sub(bedNearer)), H.wC);
    const headLast = step(H.S.h, B.S.h); // 1: the head strip's texel is the deeper (or as deep)
    const both = (x: any, fb: any, fh: any) => mix(mix(mix(x, fh, wH), fb, wB), mix(mix(x, fb, wB), fh, wH), headLast);
    tilt = both(tilt, B.t, H.t); h = both(h, B.S.h, H.S.h); ao = both(ao, B.S.ao, H.S.ao);
    chip = max(B.wC, H.wC);
  } else if (F.bed) {
    const B = fam(F.bed, F.ids.h, F.ids.f), w = max(B.wM, B.wC);
    tilt = mix(tilt, B.t, w); h = mix(h, B.S.h, w); ao = mix(ao, B.S.ao, w); chip = B.wC;
  }
  alb = mix(alb, float(1.07), chip); // fresh fracture: lighter than the dressed skin (C)
  // a share of the AO into the albedo (the cavities shade the sun as well: the maps carry no self-shadowing)
  alb = alb.mul(mix(float(1), ao.min(1.2), 0.35));
  return { tilt: tilt.mul(BF_ON), alb: mix(float(1), alb, BF_ON), ao: mix(float(1), ao.min(1), BF_ON), h: h.mul(BF_ON), chip: chip.mul(BF_ON) };
}
