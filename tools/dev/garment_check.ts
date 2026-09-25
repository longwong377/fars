// dev: does a garment read as cloth or as painted skin? (D-206) Node measurements and previews, no browser:
//  1. triangles per costume and LOD (the budgets of tests/humans_runtime), and per piece of the Median costume;
//  2. relief copied from the body: for the felt cap over the ears, the boots over the toes and the tunic over the chest,
//     back and upper arms, the mean depth (mm) of the hollows — how far inside its own smoothed position (8 Laplacian
//     passes, boundary pinned) a vertex lies, along its normal — and the share of vertices in a hollow deeper than
//     1.5 mm, against the same on the body under it (a garment that keeps the body's hollows is paint);
//  3. colour: CIE ΔE*ab between each garment colour and the wearer's skin, in the illuminant (not white-balanced: a camera
//     with AgX does not adapt): D65, CIE A (2856 K) and the scribe's room (CIE A reddened by the red floor, C); the
//     scribe's own garments and a population sweep of every dress;
//  4. the camera-rig moment scribe-at-work rebuilt as tests/people_pieces.test.ts does, rasterised at 960 × 540 (pixels
//     per piece and per body part) and drawn as an id sheet and a lit-albedo sheet; the same man standing (front, side,
//     back, 3/4) at LOD 0 and 1.
// Writes shots/garment-ease/<tag>/*.png and bench-reports/garment-ease-<tag>.json. Screenshots find problems; numbers measure.
// Run: npx tsx tools/dev/garment_check.ts --tag before|after [--no-moment]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets, meshoptSimplify } from '../../src/people/humanAssets';
import { buildOutfits, BUILT, COSTUMES, COSTUME_OF, type CostumeLOD, type Dress } from '../../src/people/outfits';
import { lookFor, type PersonLook } from '../../src/people/looks';
import { HB, PART, MAT } from '../../src/people/humanFormat';
import { PERSON_TEXELS } from '../../src/people/humanMaterial';
import { HumanGPU } from '../../src/people/humanGPU';
import { Crowd, type Person } from '../../src/people/crowd';
import { skinPoint, PALETTE_STRIDE } from '../../src/people/humanRig';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { PopGeo } from '../../src/people/popgeo';
import { PopView } from '../../src/people/popview';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';
import { encodePNG, decodePNG } from '../humans/png';
import { hull2 } from '../../src/people/drape';

type V3 = [number, number, number];
const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const TAG = arg('tag', 'now'), DIR = `shots/garment-ease/${TAG}`; mkdirSync(DIR, { recursive: true }); mkdirSync('bench-reports', { recursive: true });
const OUT: Record<string, unknown> = { tag: TAG };
const t0 = Date.now(); const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const save = () => writeFileSync(`bench-reports/garment-ease-${TAG}.json`, JSON.stringify(OUT, null, 1));

const b = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) }); log(`outfits built in ${O.ms.toFixed(0)} ms`);

// ------------------------------------------------------------------------------------------------ 1. budgets
OUT.triangles = Object.fromEntries(BUILT.map(d => [d, O.costumes[d].map(c => c.triangles)]));
OUT.medianPieces = Object.fromEntries(O.costumes.median.slice(0, 3).map(c => [`lod${c.lod}`, c.pieceTris]));
log('triangles', JSON.stringify(OUT.triangles));

// ------------------------------------------------------------------------------------------------ 2. relief
/** mean |p − smooth(p)| (mm) over the vertices of a mesh inside a region; vertices welded by position */
function relief(pos: ArrayLike<number>, index: ArrayLike<number>, n: number, inRegion: (p: V3) => boolean, weld?: (i: number) => number) {
  const W = weld ?? ((i: number) => i); const key = new Map<number, number>(); const P: number[] = []; const id = new Int32Array(n).fill(-1);
  for (let t = 0; t < index.length; t++) { const i = index[t]; if (id[i] >= 0) continue; const k = W(i); let q = key.get(k); if (q === undefined) { q = P.length / 3; key.set(k, q); P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); } id[i] = q; }
  const m = P.length / 3, nb: Set<number>[] = Array.from({ length: m }, () => new Set()), edge = new Map<string, number>();
  for (let t = 0; t < index.length; t += 3) for (let e = 0; e < 3; e++) { const a = id[index[t + e]], c = id[index[t + (e + 1) % 3]]; if (a === c) continue; nb[a].add(c); nb[c].add(a); const k = a < c ? `${a}:${c}` : `${c}:${a}`; edge.set(k, (edge.get(k) ?? 0) + 1); }
  const bnd = new Uint8Array(m); for (const [k, c] of edge) if (c === 1) { const [a, d] = k.split(':').map(Number); bnd[a] = 1; bnd[d] = 1; }
  // vertex normals (triangles wound outward), then 8 Laplacian passes: a vertex whose smoothed position lies outside the
  // surface sits in a hollow (between toes, in the concha, in the spine groove); its depth is what the eye reads as relief
  const Nn = new Float64Array(m * 3);
  for (let t = 0; t < index.length; t += 3) { const a = id[index[t]], c = id[index[t + 1]], d = id[index[t + 2]]; const ux = P[c * 3] - P[a * 3], uy = P[c * 3 + 1] - P[a * 3 + 1], uz = P[c * 3 + 2] - P[a * 3 + 2], vx = P[d * 3] - P[a * 3], vy = P[d * 3 + 1] - P[a * 3 + 1], vz = P[d * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const q of [a, c, d]) { Nn[q * 3] += nx; Nn[q * 3 + 1] += ny; Nn[q * 3 + 2] += nz; } }
  let S = Float64Array.from(P);
  for (let it = 0; it < 8; it++) { const N = S.slice(); for (let i = 0; i < m; i++) { if (bnd[i] || !nb[i].size) continue; let x = 0, y = 0, z = 0; for (const q of nb[i]) { x += S[q * 3]; y += S[q * 3 + 1]; z += S[q * 3 + 2]; } const k = nb[i].size; N[i * 3] += 0.5 * (x / k - S[i * 3]); N[i * 3 + 1] += 0.5 * (y / k - S[i * 3 + 1]); N[i * 3 + 2] += 0.5 * (z / k - S[i * 3 + 2]); } S = N; }
  let s = 0, c = 0, deep = 0; for (let i = 0; i < m; i++) { if (bnd[i] || !inRegion([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]])) continue; const l = Math.hypot(Nn[i * 3], Nn[i * 3 + 1], Nn[i * 3 + 2]) || 1;
    const h = ((S[i * 3] - P[i * 3]) * Nn[i * 3] + (S[i * 3 + 1] - P[i * 3 + 1]) * Nn[i * 3 + 1] + (S[i * 3 + 2] - P[i * 3 + 2]) * Nn[i * 3 + 2]) / l; if (h > 0) s += h; if (h > 0.0015) deep++; c++; }
  return { mm: +(1000 * s / Math.max(1, c)).toFixed(2), deep: +(deep / Math.max(1, c)).toFixed(3), n: c };
}
const reliefRows: Record<string, unknown>[] = [];
for (const vid of ['m02', 'm03', 'f02']) {
  const v = A.byId[vid]; const J = (bn: keyof typeof HB): V3 => [v.joints[HB[bn] * 3], v.joints[HB[bn] * 3 + 1], v.joints[HB[bn] * 3 + 2]];
  const hz = J('head')[2], eyeY = v.eyeY, ball = J('ball_l'), s2 = J('spine_02'), neck = J('neck_01'), s3 = J('spine_03'), ua = J('upperarm_l'), la = J('lowerarm_l');
  const regions: Record<string, { piece: string; parts: number[]; f: (p: V3) => boolean }> = {
    ear: { piece: 'cap_soft', parts: [PART.head], f: p => Math.abs(p[0]) > 0.05 && Math.abs(p[1] - (eyeY - 0.015)) < 0.035 && p[2] > hz - 0.045 && p[2] < hz + 0.025 },
    toes: { piece: 'boots', parts: [PART.foot_l, PART.foot_r], f: p => p[2] > ball[2] - 0.015 && p[1] < 0.06 },
    chest: { piece: 'tunic_upper', parts: [PART.chest, PART.belly], f: p => Math.abs(p[0]) < 0.12 && p[1] > s2[1] && p[1] < neck[1] - 0.08 && p[2] > s3[2] + 0.04 },
    back: { piece: 'tunic_upper', parts: [PART.chest, PART.belly], f: p => Math.abs(p[0]) < 0.12 && p[1] > s2[1] && p[1] < neck[1] - 0.06 && p[2] < s3[2] - 0.02 },
    upperarm: { piece: 'tunic_upper', parts: [PART.uarm_l, PART.uarm_r], f: p => Math.abs(p[0]) > Math.abs(ua[0]) - 0.03 && p[1] < ua[1] - 0.05 && p[1] > la[1] + 0.03 },
    breast: { piece: 'dress_upper', parts: [PART.chest], f: p => Math.abs(p[0]) < 0.13 && p[1] > s3[1] && p[1] < neck[1] - 0.08 && p[2] > s3[2] + 0.04 },
  };
  for (const [rn, R] of Object.entries(regions)) for (const lod of [0, 1]) {
    if (vid === 'f02' ? rn !== 'breast' : rn === 'breast') continue;
    const key = `${R.piece}@${lod}`, g = O.geos![key]; if (!g) continue; const base = v.index * O.NV * 4 + O.pieceBase[key] * 4;
    const gp = new Float32Array(g.n * 3); for (let i = 0; i < g.n; i++) { gp[i * 3] = O.source[base + i * 4]; gp[i * 3 + 1] = O.source[base + i * 4 + 1]; gp[i * 3 + 2] = O.source[base + i * 4 + 2]; }
    // the body under it: the triangles of the body LOD the shell is cut from (cap: full at LOD 0; others: mid)
    const bodyTris = A.lods[lod === 0 && rn === 'ear' ? 0 : lod === 0 ? 1 : 2]; const ps = new Set(R.parts); const bi: number[] = [];
    for (let t = 0; t < bodyTris.length; t += 3) if (ps.has(A.part[bodyTris[t]]) && ps.has(A.part[bodyTris[t + 1]]) && ps.has(A.part[bodyTris[t + 2]])) bi.push(bodyTris[t], bodyTris[t + 1], bodyTris[t + 2]);
    const gr = relief(gp, g.index, g.n, R.f), br = relief(v.pos, bi, A.NO, R.f, i => A.orig[i]);
    reliefRows.push({ variant: vid, region: rn, piece: key, hollowMm: gr.mm, bodyHollowMm: br.mm, ratio: +(gr.mm / Math.max(1e-6, br.mm)).toFixed(2), hollowShare: gr.deep, bodyHollowShare: br.deep, n: gr.n });
  }
}
OUT.relief = reliefRows; save();
console.table(reliefRows);
// shape copied from the body, in the bind pose:
//  hug — the upper garment's silhouette seen from the front and the side between the chest and a hand's breadth above
//        the belt: how far (mm) it recedes behind the widest point above it (the waist and the belly's hollow under the
//        chest), against the body's own silhouette (cloth hanging from the chest recedes 0);
//  toes — the boot's forefoot seen from above: its area over the area of its convex outline (the toes' staircase < 1).
const shapeRows: Record<string, unknown>[] = [];
{
  const vpos = (vid: string, key: string) => { const v = A.byId[vid], g = O.geos![key], base = v.index * O.NV * 4 + O.pieceBase[key] * 4, p = new Float32Array(g.n * 3);
    for (let i = 0; i < g.n; i++) { p[i * 3] = O.source[base + i * 4]; p[i * 3 + 1] = O.source[base + i * 4 + 1]; p[i * 3 + 2] = O.source[base + i * 4 + 2]; } return { p, idx: g.index }; };
  /** silhouette profile: per height bin, the max of coordinate `ax` (sign s) over triangles' points (dense samples) */
  const profileOf = (P: ArrayLike<number>, idx: ArrayLike<number>, ax: 0 | 2, s: 1 | -1, keep: (x: number, y: number, z: number) => boolean, y0: number, y1: number, dy = 0.005) => {
    const nb = Math.ceil((y1 - y0) / dy), prof = new Float64Array(nb).fill(-1e9);
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      for (let u = 0; u <= 6; u++) for (let w = 0; w <= 6 - u; w++) { const l0 = u / 6, l1 = w / 6, l2 = 1 - l0 - l1;
        const x = P[a * 3] * l0 + P[b * 3] * l1 + P[c * 3] * l2, y = P[a * 3 + 1] * l0 + P[b * 3 + 1] * l1 + P[c * 3 + 1] * l2, z = P[a * 3 + 2] * l0 + P[b * 3 + 2] * l1 + P[c * 3 + 2] * l2;
        if (y < y0 || y >= y1 || !keep(x, y, z)) continue; const k = Math.floor((y - y0) / dy), val = s * (ax === 0 ? x : z); if (val > prof[k]) prof[k] = val; } }
    let run = -1e9, depth = 0; for (let k = nb - 1; k >= 0; k--) { if (prof[k] < -1e8) continue; run = Math.max(run, prof[k]); depth = Math.max(depth, run - prof[k]); } return +(depth * 1000).toFixed(1);
  };
  for (const vid of ['m02', 'm03', 'm09', 'f02']) {
    const v = A.byId[vid], J = (bn: keyof typeof HB): V3 => [v.joints[HB[bn] * 3], v.joints[HB[bn] * 3 + 1], v.joints[HB[bn] * 3 + 2]];
    const upKey = vid === 'f02' ? 'dress_upper' : 'tunic_upper', y0 = J('spine_01')[1] + 0.0175 + 0.085, y1 = J('upperarm_l')[1] - 0.06;
    const bodyTri: number[] = []; const tp = new Set<number>([PART.chest, PART.belly, PART.pelvis]); const T1 = A.lods[1]; for (let t = 0; t < T1.length; t += 3) if (tp.has(A.part[T1[t]])) bodyTri.push(T1[t], T1[t + 1], T1[t + 2]);
    for (const lod of [0, 1]) { const g = vpos(vid, `${upKey}@${lod}`), torsoOnly = (x: number) => Math.abs(x) < 0.15;
      const row: Record<string, unknown> = { variant: vid, piece: `${upKey}@${lod}` };
      for (const [nm, ax, s] of [['front', 2, 1], ['back', 2, -1], ['side', 0, 1]] as const) {
        const keep = ax === 0 ? (x: number, _y: number, _z: number) => x > 0 && x < 0.2 : (x: number) => torsoOnly(x);
        // (the side view: the torso's flank inside the arm; the arm itself is left out by |x| < 0.2 and the part filter)
        row[`${nm}Mm`] = profileOf(g.p, g.idx, ax, s, keep, y0, y1); row[`${nm}BodyMm`] = profileOf(v.pos, bodyTri, ax, s, keep, y0, y1); }
      shapeRows.push(row); }
    if (vid === 'f02') continue;
    // toes: rasterise the forefoot (above the ground, ahead of the ball) seen from above, 1 mm cells
    const ball = J('ball_l'), solidity = (P: ArrayLike<number>, idx: ArrayLike<number>) => { const cell = 0.001, ox = ball[0] - 0.08, oz = ball[2] - 0.03, NX = 160, NZ = 160, grid = new Uint8Array(NX * NZ); const xs: number[] = [], zs: number[] = [];
      for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; if (P[a * 3] < 0 || P[a * 3 + 2] < ball[2] - 0.03) continue;
        for (let u = 0; u <= 12; u++) for (let w = 0; w <= 12 - u; w++) { const l0 = u / 12, l1 = w / 12, l2 = 1 - l0 - l1, x = P[a * 3] * l0 + P[b * 3] * l1 + P[c * 3] * l2, z = P[a * 3 + 2] * l0 + P[b * 3 + 2] * l1 + P[c * 3 + 2] * l2;
          if (z < ball[2] - 0.03) continue; const i = Math.floor((x - ox) / cell), k = Math.floor((z - oz) / cell); if (i < 0 || k < 0 || i >= NX || k >= NZ) continue; grid[k * NX + i] = 1; xs.push(x); zs.push(z); } }
      // close the sampling gaps (a 3 × 3 dilation then erosion)
      const dil = grid.map((_, q) => { const i = q % NX, k = Math.floor(q / NX); for (let dk = -2; dk <= 2; dk++) for (let di = -2; di <= 2; di++) { const ii = i + di, kk = k + dk; if (ii >= 0 && kk >= 0 && ii < NX && kk < NZ && grid[kk * NX + ii]) return 1; } return 0; });
      const ero = dil.map((vv, q) => { if (!vv) return 0; const i = q % NX, k = Math.floor(q / NX); for (let dk = -2; dk <= 2; dk++) for (let di = -2; di <= 2; di++) { const ii = i + di, kk = k + dk; if (ii < 0 || kk < 0 || ii >= NX || kk >= NZ || !dil[kk * NX + ii]) return 0; } return 1; });
      const area = ero.reduce((a, b) => a + b, 0) * cell * cell; const H = hull2(xs, zs); let ha = 0; for (let i = 0; i < H.length / 2; i++) { const j = (i + 1) % (H.length / 2); ha += H[i * 2] * H[j * 2 + 1] - H[j * 2] * H[i * 2 + 1]; }
      return +(area / Math.max(1e-9, Math.abs(ha) / 2)).toFixed(3); };
    const bodyFoot: number[] = []; const T0 = A.lods[0]; for (let t = 0; t < T0.length; t += 3) if (A.part[T0[t]] === PART.foot_l) bodyFoot.push(T0[t], T0[t + 1], T0[t + 2]);
    for (const lod of [0, 1]) { const g = vpos(vid, `boots@${lod}`); shapeRows.push({ variant: vid, piece: `boots@${lod}`, toeSolidity: solidity(g.p, g.idx), bodySolidity: solidity(v.pos, bodyFoot) }); }
  }
}
OUT.shape = shapeRows; save(); console.table(shapeRows);

// ------------------------------------------------------------------------------------------------ 3. colour
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function labOf(rgb: V3): V3 { // linear sRGB → CIELAB (D65 white, no adaptation)
  const X = 0.4124 * rgb[0] + 0.3576 * rgb[1] + 0.1805 * rgb[2], Y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2], Z = 0.0193 * rgb[0] + 0.1192 * rgb[1] + 0.9505 * rgb[2];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); const fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const dE = (a: V3, c: V3) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
/** ΔE without lightness (chroma and hue only): what separates two surfaces when the exposure varies */
const dAB = (a: V3, c: V3) => Math.hypot(a[1] - c[1], a[2] - c[2]);
const ILL: Record<string, V3> = { D65: [1, 1, 1], A: [1.845, 0.826, 0.233] };
const lit = (alb: V3, il: V3): V3 => [alb[0] * il[0], alb[1] * il[1], alb[2] * il[2]];

// ------------------------------------------------------------------------------------------------ raster helpers
interface Drawn { C: CostumeLOD; slot: number; root: ArrayLike<number>; gpu: HumanGPU; look: PersonLook; mask: number; scale: number }
const pieceCache = new Map<CostumeLOD, string[]>();
function piecesOf(C: CostumeLOD): string[] {
  let r = pieceCache.get(C); if (r) return r;
  const ranges = Object.entries(O.pieceBase).map(([k, base]) => [k.split('@')[0], base, base + O.geos![k].n] as const);
  r = Array.from(C.tid, t => (t < A.NO ? 'body' : ranges.find(([, a, c]) => t >= a && t < c)![0])); pieceCache.set(C, r); return r;
}
const shownBit = (mask: number, bit: number) => Math.floor(Math.fround(Math.fround(mask) / Math.fround(2 ** bit))) % 2 === 1;
const HUE: Record<string, V3> = { tunic_upper: [0.2, 0.55, 0.95], tunic_skirt: [0.1, 0.8, 0.8], trousers: [0.55, 0.3, 0.85], belt: [0.95, 0.85, 0.1], boots: [0.45, 0.3, 0.12], cap_soft: [0.2, 0.75, 0.25], hair: [0.1, 0.1, 0.1], bun: [0.15, 0.15, 0.15], beard_short: [0.25, 0.2, 0.2], beard_long: [0.25, 0.2, 0.2], kandys: [0.7, 0.2, 0.6] };
const SKIN_ID: V3 = [0.95, 0.55, 0.45];
/** rasterise posed people: an id buffer (piece or body part) and a lit-albedo image (look colours, a key light and an
 *  ambient, per-vertex normals of the posed mesh) */
function raster(people: Drawn[], cam: THREE.PerspectiveCamera, W: number, H: number, light: { dir: V3; col: V3; amb: V3 }) {
  const zb = new Float32Array(W * H).fill(Infinity), id = new Int32Array(W * H).fill(-1), names: string[] = [], lc = new Float32Array(W * H * 3);
  cam.updateMatrixWorld(); cam.updateProjectionMatrix(); const VP = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse), v4 = new THREE.Vector4(), o = [0, 0, 0];
  const tag = new Map<string, number>(); const tagOf = (nm: string) => { let q = tag.get(nm); if (q === undefined) { q = names.length; names.push(nm); tag.set(nm, q); } return q; };
  for (const { C, slot, root, gpu, look, mask, scale } of people) {
    const variant = look.variant, pc = piecesOf(C), n = C.tid.length, wp = new Float32Array(n * 3), scr = new Float32Array(n * 3), c = Math.cos(root[3]), s = Math.sin(root[3]);
    for (let k = 0; k < n; k++) { const t = (variant * O.NV + C.tid[k]) * 4;
      skinPoint(gpu.palette, slot * PALETTE_STRIDE, C.skinIndex.subarray(k * 4, k * 4 + 4), Array.from(C.skinWeight.subarray(k * 4, k * 4 + 4), x => x / 255), O.source.subarray(t, t + 3), o);
      wp[k * 3] = (c * o[0] + s * o[2]) * scale + root[0]; wp[k * 3 + 1] = o[1] * scale + root[1]; wp[k * 3 + 2] = (-s * o[0] + c * o[2]) * scale + root[2];
      v4.set(wp[k * 3], wp[k * 3 + 1], wp[k * 3 + 2], 1).applyMatrix4(VP); scr[k * 3] = (v4.x / v4.w * 0.5 + 0.5) * W; scr[k * 3 + 1] = (0.5 - v4.y / v4.w * 0.5) * H; scr[k * 3 + 2] = v4.w; }
    // vertex normals of the posed mesh (shown triangles)
    const nr = new Float32Array(n * 3);
    for (let t = 0; t < C.index.length; t += 3) { const a = C.index[t], bb = C.index[t + 1], d = C.index[t + 2]; if (!shownBit(mask, C.hmat[a * 4 + 2])) continue;
      const ux = wp[bb * 3] - wp[a * 3], uy = wp[bb * 3 + 1] - wp[a * 3 + 1], uz = wp[bb * 3 + 2] - wp[a * 3 + 2], vx = wp[d * 3] - wp[a * 3], vy = wp[d * 3 + 1] - wp[a * 3 + 1], vz = wp[d * 3 + 2] - wp[a * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const q of [a, bb, d]) { nr[q * 3] += nx; nr[q * 3 + 1] += ny; nr[q * 3 + 2] += nz; } }
    const colOf = (k: number): V3 => { const cls = C.hmat[k * 4], sl = C.hmat[k * 4 + 1]; const L = look.col;
      const col = [null, L.skin, L.main, L.second, L.trim, L.hair, L.leather, null, L.felt][sl] as V3 | null; if (col) return col;
      return cls === MAT.eye ? [0.6, 0.58, 0.55] : cls === MAT.teeth ? [0.7, 0.66, 0.58] : cls === MAT.mouth ? [0.32, 0.1, 0.09] : cls === MAT.metal ? [0.9, 0.7, 0.32] : cls === MAT.wood ? [0.36, 0.25, 0.15] : [0.1, 0.1, 0.1]; };
    for (let t = 0; t < C.index.length; t += 3) { const a = C.index[t], bb = C.index[t + 1], d = C.index[t + 2];
      if (!shownBit(mask, C.hmat[a * 4 + 2]) || scr[a * 3 + 2] < 0.05 || scr[bb * 3 + 2] < 0.05 || scr[d * 3 + 2] < 0.05) continue;
      const q = tagOf(pc[a] === 'body' ? `body:${A.part[C.tid[a]]}` : pc[a]);
      const x0 = scr[a * 3], y0 = scr[a * 3 + 1], x1 = scr[bb * 3], y1 = scr[bb * 3 + 1], x2 = scr[d * 3], y2 = scr[d * 3 + 1], ar = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(ar) < 1e-12) continue;
      const ca = colOf(a), cb = colOf(bb), cd = colOf(d);
      for (let py = Math.max(0, Math.floor(Math.min(y0, y1, y2))); py <= Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2))); py++)
        for (let px = Math.max(0, Math.floor(Math.min(x0, x1, x2))); px <= Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2))); px++) { const qx = px + 0.5, qy = py + 0.5;
          const w0 = ((x1 - qx) * (y2 - qy) - (x2 - qx) * (y1 - qy)) / ar, w1 = ((x2 - qx) * (y0 - qy) - (x0 - qx) * (y2 - qy)) / ar, w2 = 1 - w0 - w1; if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * scr[a * 3 + 2] + w1 * scr[bb * 3 + 2] + w2 * scr[d * 3 + 2], i = py * W + px; if (z >= zb[i]) continue; zb[i] = z; id[i] = q;
          let nx = w0 * nr[a * 3] + w1 * nr[bb * 3] + w2 * nr[d * 3], ny = w0 * nr[a * 3 + 1] + w1 * nr[bb * 3 + 1] + w2 * nr[d * 3 + 1], nz = w0 * nr[a * 3 + 2] + w1 * nr[bb * 3 + 2] + w2 * nr[d * 3 + 2]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
          const ndl = Math.max(0, nx * light.dir[0] + ny * light.dir[1] + nz * light.dir[2]), hemi = 0.6 + 0.4 * ny;
          for (let ch = 0; ch < 3; ch++) lc[i * 3 + ch] = (w0 * ca[ch] + w1 * cb[ch] + w2 * cd[ch]) * (light.col[ch] * ndl + light.amb[ch] * hemi); } }
  }
  const counts = new Map<string, number>(); for (const q of id) if (q >= 0) counts.set(names[q], (counts.get(names[q]) ?? 0) + 1);
  const idImg = new Uint8Array(W * H * 4), litImg = new Uint8Array(W * H * 4);
  const enc = (x: number) => Math.round(255 * Math.min(1, x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055));
  for (let i = 0; i < W * H; i++) { const q = id[i]; let c: V3 = [0.93, 0.92, 0.9];
    if (q >= 0) { const nm = names[q]; c = nm.startsWith('body:') ? SKIN_ID : HUE[nm] ?? [0.6, 0.6, 0.6]; }
    idImg.set([Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255), 255], i * 4);
    if (q >= 0) { const r = [lc[i * 3], lc[i * 3 + 1], lc[i * 3 + 2]].map(x => x / (1 + x)); litImg.set([enc(r[0]), enc(r[1]), enc(r[2]), 255], i * 4); } else litImg.set([40, 38, 36, 255], i * 4); }
  return { counts, idImg, litImg };
}
function sheet(tiles: Uint8Array[], W: number, H: number, cols: number) {
  const rows = Math.ceil(tiles.length / cols), out = new Uint8Array(cols * W * rows * H * 4).fill(255);
  tiles.forEach((tl, i) => { const ox = (i % cols) * W, oy = Math.floor(i / cols) * H; for (let y = 0; y < H; y++) out.set(tl.subarray(y * W * 4, (y + 1) * W * 4), ((oy + y) * cols * W + ox) * 4); });
  return { data: out, w: cols * W, h: rows * H };
}
const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
const newHumans = () => ({ A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 64, castShadow: false }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } });
const CLOTHED = new Set<number>([PART.chest, PART.belly, PART.pelvis, PART.uarm_l, PART.uarm_r]);

// ------------------------------------------------------------------------------------------------ 4. the moment
let scribeInput: { id: number; sex: 'm' | 'f'; role: string; dress: Dress; origin: string; seed: number } | null = null;
let scribeLook: PersonLook | null = null;
if (!process.argv.includes('--no-moment')) {
  const Wth = new WeatherSystem(1), env = (t: number): Env => { const d = Math.floor(t / 24), c = Wth.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const sim = new PeopleSim(1, nav, env), plan = buildTownPlan(), terrain = loadTerrain(), rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, 1), villages = placeVillages(terrain, rivers.rivers, canals, 1);
  const geo = new PopGeo({ pop: sim.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, 1), canals: canals.map(c => c.pts), seed: 1 });
  const view = new PopView(sim, geo, 1); sim.jumpTo(25 * 24 + 10);
  const humans = newHumans(), crowd = new Crowd(sim, 1, humans as any); crowd.view = view; crowd.looksPerFrame = 1e9;
  const e = 189.4, nn = -84.2, y = nav.heightAt(e, nn) + 1.0, cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 5000); cam.position.set(e, y, -nn);
  const hh = ((269 - 341) * Math.PI) / 180, pp = (-12 * Math.PI) / 180; cam.lookAt(e + Math.sin(hh) * Math.cos(pp) * 10, y + Math.sin(pp) * 10, -nn - Math.cos(hh) * Math.cos(pp) * 10);
  for (let f = 0; f < 3; f++) { view.update(sim.t, [e, nn]); crowd.update(f * 0.1, cam.position, null, cam); }
  const near = [...crowd.persons.values()].filter(q => q.drawnFrame > 0 && q.dist < 6), s = near.find(q => q.agent?.role === 'scribe')!;
  const a = s.agent!; scribeInput = { id: a.id, sex: a.sex, role: a.role, dress: a.dress as Dress, origin: a.origin, seed: a.seed }; scribeLook = s.look;
  log(`scribe: agent ${a.id} ${a.origin} ${s.look.dress} ${s.look.variantId} LOD ${s.lod} anim ${s.anim} dist ${s.dist.toFixed(2)}`);
  const drawnOf = (q: Person, lod = q.lod): Drawn => { const row = q.slot * PERSON_TEXELS * 4; return { C: O.costumes[COSTUME_OF[q.look.dress]].find(c => c.lod === lod)!, slot: q.slot, root: q.root, gpu: humans.gpu, look: q.look, mask: humans.gpu.person[row + 1], scale: humans.gpu.person[row + 29] }; };
  // the room's light: the door on the left of the frame (C: for looking only), the room illuminant for colour
  const room = { dir: [-0.75, 0.35, 0.55] as V3, col: [1.5, 0.75, 0.38] as V3, amb: [0.28, 0.1, 0.06] as V3 };
  const hit = raster(near.map(q => drawnOf(q)), cam, 960, 540, room);
  const px = Object.fromEntries([...hit.counts].sort((x, z) => z[1] - x[1]));
  const clothedSkin = [...hit.counts].filter(([k]) => k.startsWith('body:') && CLOTHED.has(+k.slice(5))).reduce((x, [, c]) => x + c, 0);
  const garment = [...hit.counts].filter(([k]) => !k.startsWith('body:')).reduce((x, [, c]) => x + c, 0), skinAll = [...hit.counts].filter(([k]) => k.startsWith('body:')).reduce((x, [, c]) => x + c, 0);
  OUT.moment = { who: `agent ${a.id} (${a.role}, ${a.origin})`, variant: s.look.variantId, lod: s.lod, anim: s.anim, pixels960x540: px, garmentPx: garment, skinPx: skinAll, clothedSkinPx: clothedSkin };
  writeFileSync(`${DIR}/moment_id.png`, encodePNG(960, 540, hit.idImg, 4)); writeFileSync(`${DIR}/moment_lit.png`, encodePNG(960, 540, hit.litImg, 4));
  // close views of the crouched scribe: from the moment camera zoomed (fov 18), from his side and from behind, at LOD 0 and 1
  const r = s.root, ctr: V3 = [r[0], r[1] + 0.55, r[2]];
  const views: [string, V3, number][] = [['moment-zoom', [cam.position.x, cam.position.y, cam.position.z], 30], ['side', [r[0] + Math.sin(r[3] + Math.PI / 2) * 2.2, r[1] + 1.0, r[2] + Math.cos(r[3] + Math.PI / 2) * 2.2], 36], ['front', [r[0] + Math.sin(r[3]) * 2.2, r[1] + 1.2, r[2] + Math.cos(r[3]) * 2.2], 36], ['back34', [r[0] + Math.sin(r[3] + 2.4) * 2.2, r[1] + 1.3, r[2] + Math.cos(r[3] + 2.4) * 2.2], 36]];
  const tilesI: Uint8Array[] = [], tilesL: Uint8Array[] = [];
  for (const lod of [0, 1]) for (const [, eye, fov] of views) { const c2 = new THREE.PerspectiveCamera(fov, 1, 0.05, 50); c2.position.set(...eye); c2.lookAt(...ctr);
    const h2 = raster([drawnOf(s, lod)], c2, 300, 300, room); tilesI.push(h2.idImg); tilesL.push(h2.litImg); }
  const shI = sheet(tilesI, 300, 300, 4), shL = sheet(tilesL, 300, 300, 4);
  writeFileSync(`${DIR}/scribe_id.png`, encodePNG(shI.w, shI.h, shI.data, 4)); writeFileSync(`${DIR}/scribe_lit.png`, encodePNG(shL.w, shL.h, shL.data, 4));
  log('moment', JSON.stringify(OUT.moment));
  // the same man standing (the crowd's idle pose), front / side / back / 3/4 at LOD 0 and 1
  const h2 = newHumans(), cr = new Crowd(null, 1, h2 as any), st = cr.addExtra('stand', { ...scribeInput, x: 0, y: 0, z: 0, yaw: 0 });
  const eye0 = new THREE.Vector3(0, 1.6, 3); cr.update(3.7, eye0, null); cr.update(3.8, eye0, null);
  const sun = { dir: [0.45, 0.7, 0.55] as V3, col: [1.6, 1.45, 1.25] as V3, amb: [0.3, 0.33, 0.38] as V3 };
  const tI: Uint8Array[] = [], tL: Uint8Array[] = []; const rowOf = (q: Person, lod: number): Drawn => { const row = q.slot * PERSON_TEXELS * 4; return { C: O.costumes[COSTUME_OF[q.look.dress]].find(c => c.lod === lod)!, slot: q.slot, root: q.root, gpu: h2.gpu, look: q.look, mask: h2.gpu.person[row + 1] | (1 << 0), scale: h2.gpu.person[row + 29] }; };
  const skinStand: Record<string, number> = {};
  for (const lod of [0, 1]) for (const az of [0, 90, 180, 35]) { const c3 = new THREE.PerspectiveCamera(34, 0.6, 0.05, 50), rad = (az * Math.PI) / 180; c3.position.set(Math.sin(rad) * 3.2, 1.25, Math.cos(rad) * 3.2); c3.lookAt(0, 0.88, 0);
    const hs = raster([rowOf(st, lod)], c3, 240, 400, sun); tI.push(hs.idImg); tL.push(hs.litImg);
    skinStand[`lod${lod}_az${az}`] = [...hs.counts].filter(([k]) => k.startsWith('body:') && CLOTHED.has(+k.slice(5))).reduce((x, [, c]) => x + c, 0); }
  OUT.standingClothedSkinPx = skinStand;
  const s1 = sheet(tI, 240, 400, 4), s2 = sheet(tL, 240, 400, 4);
  writeFileSync(`${DIR}/standing_id.png`, encodePNG(s1.w, s1.h, s1.data, 4)); writeFileSync(`${DIR}/standing_lit.png`, encodePNG(s2.w, s2.h, s2.data, 4));
  save(); log('previews written to', DIR);
}

// ------------------------------------------------------------------------------------------------ 3b. colour numbers
{
  // the scribe's room (C): CIE A reddened by the painted red floor's bounce (× 1, 0.8, 0.7), normalised to Y = 1. (Dividing
  // the browser frame's lit skirt by the tunic's albedo gave a magenta light: AgX desaturates bright colours, so a pixel
  // is not albedo × light.)
  ILL.room = (() => { const q = [1.845 * 1, 0.826 * 0.8, 0.233 * 0.7], Y = 0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2]; return q.map(x => x / Y) as V3; })();
  const look = scribeLook ?? lookFor(A, { id: 120, sex: 'm', role: 'scribe', dress: 'median', origin: 'Babylonian', seed: 525735469 }, 1);
  const rows: Record<string, unknown>[] = [];
  for (const [k, il] of Object.entries(ILL)) { const sk = labOf(lit(look.col.skin, il));
    for (const g of ['main', 'second', 'trim', 'felt', 'leather'] as const) { const gl = labOf(lit(look.col[g], il)); rows.push({ illuminant: k, garment: g, dE: +dE(gl, sk).toFixed(1), dAB: +dAB(gl, sk).toFixed(1), garmentLab: gl.map(x => +x.toFixed(1)), skinLab: sk.map(x => +x.toFixed(1)) }); } }
  OUT.scribeColour = { illuminantRoom: ILL.room.map(x => +x.toFixed(3)), note: look.note, rows }; console.table(rows);
  // population: every dress × 300 looks, garments (main/second/trim) against the wearer's skin
  const ORIG = ['Persian', 'Median', 'Babylonian', 'Elamite', 'Egyptian', 'Ionian', 'Lydian', 'Bactrian', 'Syrian', 'Thracian'];
  const roles: Record<string, [string, 'm' | 'f']> = { persian: ['official', 'm'], guard: ['guard', 'm'], median: ['scribe', 'm'], worker: ['mason', 'm'], woman: ['grinder', 'f'], child: ['child', 'm'] };
  const pop: Record<string, unknown> = {}, byTex: Record<string, [number, number]> = {};
  for (const [dress, [role, sex]] of Object.entries(roles)) { const acc: Record<string, number[]> = {};
    for (let i = 0; i < 300; i++) { const L = lookFor(A, { id: i, sex, role, dress: dress as Dress, origin: ORIG[i % ORIG.length], seed: 50_000 + i * 7 }, 1);
      const tex = /colours main (\w+) \(\w\), second (\w+), trim (\w+)/.exec(L.note)!;
      for (const [k, il] of Object.entries(ILL)) { const sk = labOf(lit(L.col.skin, il)); (['main', 'second', 'trim'] as const).forEach((g, gi) => { const gl = labOf(lit(L.col[g], il)), e = dE(gl, sk); (acc[`${k}.dE`] ??= []).push(e); (acc[`${k}.dAB`] ??= []).push(dAB(gl, sk));
        if (k === 'room') { const t = tex[gi + 1]; (byTex[t] ??= [0, 0]); byTex[t][1]++; if (e < 12) byTex[t][0]++; } }); } }
    pop[dress] = Object.fromEntries(Object.entries(acc).map(([k, xs]) => { xs.sort((x, z) => x - z); return [k, { p5: +xs[Math.floor(xs.length * 0.05)].toFixed(1), p50: +xs[Math.floor(xs.length / 2)].toFixed(1), under12: +(xs.filter(x => x < 12).length / xs.length).toFixed(3) }]; })); }
  OUT.population = pop; console.log(JSON.stringify(pop));
  OUT.populationByTextile = Object.fromEntries(Object.entries(byTex).map(([t, [u, n]]) => [t, { garments: n, under12room: +(u / n).toFixed(3) }])); console.log(JSON.stringify(OUT.populationByTextile));
  save();
}
if (scribeInput) OUT.scribeInput = scribeInput; save();
log('done');
void COSTUMES; void decodePNG;
