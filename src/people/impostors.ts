// People beyond the skinned crowd (D-143; brief §6 "impostors far away", §9.2 "distant crowds on roads and in fields read
// as people, not dots", §9.5 "beyond full-detail range, people are cheaper to draw but still doing their real activity").
//
// Bake (CPU, at load, pure JS: tests/popview.test.ts runs it in node): every dress's farthest body (the costume LOD the
// crowd draws just inside the switch, humanGPU.ts), posed by the same rig (humanRig.ts) in a few frames of what people
// do (standing, six phases of the walk, a jar on the head, a sack on the shoulder, sitting, kneeling at work, bending,
// lying, a guard's stance), rasterised orthographically from 8 directions round the person. A texel stores no colour:
// it stores which of the person's colours covers it (main, second, trim, skin, hair, leather/felt, a fixed brown for
// wood, clay and the like) as weights, its coverage, and the lighting normal. The shader applies each person's own
// colours (looks.ts), so an impostor is the same person the pool would draw: the same silhouette, size and colours.
// Mip levels average the weights and normals by coverage and scale coverage so the texels that pass the alpha test keep
// the full-size share (the trees' method, trees/atlas.ts mipChain): a crowd keeps its size with distance.
//
// Draw: one instanced mesh, one camera-facing quad per person (turning about the vertical only), the view of the
// nearest of the 8 directions. 2 triangles and 12 floats per person. No shadows (the people it draws are beyond the
// skinned crowd's shadow range, D-093).
import * as THREE from 'three/webgpu';
import { Fn, attribute, positionGeometry, positionPrevious, cameraPosition, cameraViewMatrix, texture, vec2, vec3, vec4, float, floor, mod, atan, cos, sin, max, length, normalize, varying } from 'three/tsl';
import type { HumanAssets } from './humanAssets';
import { BUILT, COSTUMES, COSTUME_OF, pieceBit, unpackNormal, type OutfitBuild, type Dress, type CostumeLOD } from './outfits';
import { RigSolver, PALETTE_STRIDE, PLANTED, type RigInput } from './humanRig';
import { pose, type AnimId } from './anim';
import { MAT, HB, unpackLookBits } from './humanFormat';
import type { PersonLook } from './looks';
import { DRAPE } from './humanMaterial';

/** atlas layout: 8 views round the person; one row per dress and frame; cells of CELL² texels over W × H metres */
export const IMP = { views: 8, cell: 32, width: 1.6, height: 2.0, y0: -0.05 } as const;
/** the dresses drawn (guards: the Persian costume with the bow and quiver bits) */
export const IMP_DRESSES: Dress[] = ['persian', 'guard', 'median', 'worker', 'woman', 'child'];
/** frames: what the person is doing (anim, walk phase) and what they carry (prop drawn in) */
export const FRAMES: { id: string; anim: AnimId; ph: number; prop?: 'jar_head' | 'sack' }[] = [
  { id: 'stand', anim: 'idle', ph: 0 },
  ...[0, 1, 2, 3, 4, 5].map(k => ({ id: `walk${k}`, anim: 'walk' as AnimId, ph: (k / 6) * Math.PI * 2 })),
  { id: 'carry_head', anim: 'carry_head', ph: Math.PI / 2, prop: 'jar_head' }, { id: 'carry_shoulder', anim: 'carry_shoulder', ph: Math.PI / 2, prop: 'sack' },
  { id: 'sit', anim: 'sit', ph: 0 }, { id: 'kneel', anim: 'grind', ph: 0 }, { id: 'bend', anim: 'chisel', ph: 0 }, { id: 'lie', anim: 'sleep', ph: 0 }, { id: 'guard', anim: 'guard', ph: 0 },
];
export const ROWS = IMP_DRESSES.length * FRAMES.length;
const FR = Object.fromEntries(FRAMES.map((f, i) => [f.id, i])) as Record<string, number>;
/** the frame that stands for an animation (and the walk phase for walking ones) */
export function frameOf(anim: AnimId, phase: number): number {
  switch (anim) {
    case 'walk': case 'guard_walk': case 'play': case 'carry_front': case 'chase': case 'pull_toy': case 'limp': case 'feel': { const k = Math.floor((((phase / (Math.PI * 2)) % 1) + 1) % 1 * 6); return FR.walk0 + Math.min(5, k); }
    case 'carry_head': return FR.carry_head; case 'carry_shoulder': return FR.carry_shoulder;
    case 'sit': case 'write': case 'eat': case 'dice': case 'ride': case 'rattle': return FR.sit; // a rider far off: the seated frame on the mount's back (D-210)
    case 'grind': case 'knead': case 'bake': return FR.kneel;
    case 'chisel': case 'draw_water': return FR.bend;
    case 'sleep': return FR.lie; case 'guard': return FR.guard;
    default: return FR.stand;
  }
}
export const rowOf = (dress: Dress, frame: number) => Math.max(0, IMP_DRESSES.indexOf(dress)) * FRAMES.length + frame;
/** the fixed colour (wood, clay, the jar, wicker, metal, eyes: linear albedo, C) */
export const FIXED: [number, number, number] = [0.25, 0.16, 0.1];
/** weights: texture A (main, second, trim, coverage), B (skin, hair, leather + felt, fixed), N (normal, cavity AO) */
export interface ImpostorAtlas { W: number; H: number; A: Level[]; B: Level[]; N: Level[]; refStature: Record<Dress, number>; ms: number; coverage: Float32Array;
  /** per dress, per garment colour (main, second, trim): the far body's area-weighted means of the material's per-fragment
   *  weights (D-189), so an impostor's colour is the mean albedo the skinned person shows at the switch */
  cloth: Record<Dress, ClothStats[]> }
/** mean weights over a garment colour's surface: sun-bleaching (up-facing), hem soil, the trade's grime by grime zone
 *  (LOOK_BITS grimeZone 0–3: hems only, + hands, + front, + loads) */
export interface ClothStats { up: number; hem: number; where: [number, number, number, number] }
const sst = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
/** the share of a patterned main garment the rosettes cover (the material's motif: a disc of radius ~0.22 per cell) */
export const ROSE_SHARE = (() => { let s = 0; const n = 64; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const r = Math.hypot((i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5); s += 1 - sst(0.18, 0.26, r); } return s / (n * n); })();
/** the material's weights for one garment vertex (humanMaterial: upF without its noise, hemBand, the grime's `low`) */
export function clothWeights(x: number, y: number, z: number, nY: number, ao: number, skirt: number, t: number): ClothStats {
  const low = 1 - sst(0.1, 0.9, y), arms = sst(0.15, 0.2, Math.abs(x)) * (1 - sst(1.02, 1.12, y));
  const front = sst(0.02, 0.08, z) * sst(0.72, 0.8, y) * (1 - sst(1.2, 1.3, y)) * (1 - sst(0.14, 0.18, Math.abs(x)));
  const load = sst(1.28, 1.36, y) * Math.max(sst(0.06, 0.1, Math.abs(x)), 1 - sst(-0.05, 0, z));
  return { up: sst(-0.25, 0.75, nY) * sst(0.66, 0.8, ao), hem: Math.max(1 - sst(0.03, 0.3, y), skirt * (sst(0.72, 1, t) * 0.7 + sst(DRAPE.hemEdge[0], 1, t) * DRAPE.hemEdge[1])), // (D-225: the hem's edge)
    where: [low, Math.max(low, arms), Math.max(low, arms, front), Math.max(low, load * 0.8)] };
}
/** barycentric sample points: the centroids of a triangle's 16 sub-triangles (4 divisions a side) */
const SUB: [number, number][] = (() => { const n = 4, o: [number, number][] = []; for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) { o.push([(i + 1 / 3) / n, (j + 1 / 3) / n]); if (i + j < n - 1) o.push([(i + 2 / 3) / n, (j + 2 / 3) / n]); } return o; })();
/** area-weighted means of clothWeights per colour slot over the costume's shown triangles (bind pose of one variant) */
export function clothStatsOf(O: OutfitBuild, L: CostumeLOD, variant: number, mask: number): ClothStats[] {
  const acc = [0, 1, 2].map(() => ({ up: 0, hem: 0, where: [0, 0, 0, 0], w: 0 })), I = L.index, base = variant * O.NV * 4;
  const P = (i: number) => { const t = base + L.tid[i] * 4; return [O.source[t], O.source[t + 1], O.source[t + 2]]; };
  for (let k = 0; k < I.length; k += 3) { const a = I[k], b = I[k + 1], c = I[k + 2], cls = L.hmat[a * 4], col = L.hmat[a * 4 + 1];
    if (cls < MAT.cloth_main || cls > MAT.cloth_trim || !((mask >> L.hmat[a * 4 + 2]) & 1)) continue; const sl = col - 2; if (sl < 0 || sl > 2) continue;
    const pa = P(a), pb = P(b), pc = P(c), e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const area = 0.5 * Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]); if (!area) continue;
    // D-225: the weights are sampled inside the triangle (16 sub-triangle centroids), not averaged over its corners: the far
    // body's triangles span from the hem to the knee, and the corner mean overstated the hem band's share 3.4× (0.30 against
    // 0.09 over the surface, the Persian robe's far body), so the impostors took more hem soil than the skinned body showed
    const V = [a, b, c].map(i => { const t = base + L.tid[i] * 4; return [O.source[t], O.source[t + 1], O.source[t + 2], unpackNormal(O.source[t + 3])[1], L.hext[i * 4] / 255, L.hext[i * 4 + 2] / 255, L.uv[i * 2 + 1]]; }), q = acc[sl];
    for (const [u, v] of SUB) { const w0 = 1 - u - v, x = (k: number) => V[0][k] * w0 + V[1][k] * u + V[2][k] * v;
      const w = clothWeights(x(0), x(1), x(2), x(3), x(4), x(5), x(6)), wa = area / SUB.length;
      q.up += w.up * wa; q.hem += w.hem * wa; for (let z = 0; z < 4; z++) q.where[z] += w.where[z] * wa; q.w += wa; } }
  return acc.map(q => q.w ? { up: q.up / q.w, hem: q.hem / q.w, where: q.where.map(x => x / q.w) as ClothStats['where'] } : { up: 0, hem: 0, where: [0, 0, 0, 0] as ClothStats['where'] });
}
/** a look's garment colours as the skinned material shows them on average (D-189): sun-bleaching of up-facing cloth, the
 *  trade's grime toward the hem and hem soil, applied with the far body's mean weights (the material's mixes are linear
 *  in their weights, and its noise factors average to 1) */
export function farColours(look: PersonLook, st: ClothStats[] | undefined): [number, number, number][] {
  const cols = [look.col.main, look.col.second, look.col.trim]; if (!st) return cols.map(c => [...c] as [number, number, number]);
  const w = look.wear, g = look.grimeLevel, grimeCol = [g, g * 0.97, g * 0.9], bits = unpackLookBits(look.pattern);
  return cols.map((c0, i) => { const S = st[i]; let c = [...c0];
    if (i === 0 && bits.motif % 2) c = c.map((x, k) => x + (look.col.trim[k] - x) * ROSE_SHARE); // the rosettes in the trim colour
    // (0.85: the mean of the material's noise factor on the up-facing weight)
    const fade = Math.min(0.8, (w?.fade ?? 0) * (w?.k[i] ?? 0) * S.up * 0.85 * DRAPE.fade), lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    c = c.map(x => x + (Math.min(0.8, (lum + (x - lum) * 0.4) * 1.25 + 0.012) - x) * fade);
    const gm = Math.min(1, look.grime * S.where[bits.grimeZone & 3]) * 0.35; c = c.map((x, k) => x + (grimeCol[k] - x) * gm);
    const sm = Math.min(0.75, (w?.soil ?? 0) * S.hem * DRAPE.soil); c = c.map((x, k) => x + (DRAPE.dust[k] - x) * sm);
    return c as [number, number, number]; });
}
type Level = { data: Uint8Array; width: number; height: number };

/** a person's colour slot for a costume vertex: 0 main, 1 second, 2 trim, 3 skin, 4 hair, 5 leather/felt, 6 fixed */
export function slotOf(cls: number, col: number): number {
  if (cls === MAT.skin) return 3; if (cls === MAT.hair || cls === MAT.lash) return 4;
  if (cls === MAT.eye || cls === MAT.teeth || cls === MAT.mouth || cls === MAT.metal || cls === MAT.wood || cls === MAT.wicker) return 6;
  switch (col) { case 1: return 3; case 2: return 0; case 3: return 1; case 4: return 2; case 5: return 4; case 6: case 8: return 5; default: return 6; }
}
/** the most common pieces of each dress (looks.ts rates: the look that stands for all at impostor distance, C) */
export function typicalMask(dress: Dress): number {
  const on: Partial<Record<Dress, string[]>> = { persian: ['bun', 'beard_long', 'hat_fluted'], guard: ['bun', 'beard_long', 'hat_fluted'], median: ['bun', 'beard_long', 'cap_soft'], worker: ['beard_short', 'shoes'], woman: ['headcloth', 'shoes'], child: ['hair'] }; // (the court setting's dresses have none: they use their far row's, D-199)
  let m = 1; for (const id of COSTUMES[dress].always) m |= (1 << pieceBit(dress, id)) & ~1; for (const id of on[dress] ?? []) m |= 1 << pieceBit(dress, id); return m;
}
/** a reference body per dress: the variant nearest the mean stature of its sex and age (looks.ts STATURE) */
function refVariant(A: HumanAssets, dress: Dress) {
  const child = dress === 'child', sex = dress === 'woman' ? 'f' : 'm', target = child ? 1.2 : sex === 'f' ? 1.54 : 1.66;
  const cand = A.variants.filter(v => child ? v.meta.group === 'child' : v.meta.sex === sex && v.meta.group === 'adult');
  return cand.reduce((b, v) => Math.abs(v.height - target) < Math.abs(b.height - target) ? v : b);
}
/** the costume LOD the crowd draws farthest (the simplified far body, else the far body) */
export const farLod = (O: OutfitBuild, dress: Dress): CostumeLOD | undefined => { const l = O.costumes[COSTUME_OF[dress]] ?? []; return l.find(c => c.lod === 3) ?? l.find(c => c.lod === 2); };

/** bake the atlas (level 0 and its mips) */
export function bakeImpostors(A: HumanAssets, O: OutfitBuild, props?: { jar?: { pos: Float32Array; idx: ArrayLike<number> }; sack?: { pos: Float32Array; idx: ArrayLike<number> } }): ImpostorAtlas {
  const t0 = performance.now(), C = IMP.cell, V = IMP.views, W = V * C, H = ROWS * C;
  const wA = new Float32Array(W * H * 4), wB = new Float32Array(W * H * 4), nN = new Float32Array(W * H * 4);
  for (let k = 0; k < W * H; k++) { nN[k * 4] = 0.5; nN[k * 4 + 1] = 0.5; nN[k * 4 + 2] = 1; nN[k * 4 + 3] = 1; } // empty texels: facing the viewer, no cavity (bilinear edges stay clean)
  const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE), refStature = {} as Record<Dress, number>;
  const z = new Float32Array(C * C);
  IMP_DRESSES.forEach((dress, di) => {
    const L = farLod(O, dress); if (!L || !BUILT.includes(COSTUME_OF[dress])) return;
    const v = refVariant(A, dress); refStature[dress] = v.height; const mask = typicalMask(dress), nv = L.tid.length;
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), slot = new Uint8Array(nv), keep = new Uint8Array(nv), ao = new Float32Array(nv);
    for (let i = 0; i < nv; i++) { const cls = L.hmat[i * 4], col = L.hmat[i * 4 + 1], bit = L.hmat[i * 4 + 2]; slot[i] = slotOf(cls, col); keep[i] = (mask >> bit) & 1; ao[i] = L.hext[i * 4] / 255; }
    FRAMES.forEach((F, fi) => {
      const po = pose(F.anim, 0.7, F.ph, 0.4), inp: RigInput = { joints: v.joints, pose: po, face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: F.prop ? [0.4, 0.8] : [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1, plant: PLANTED.has(F.anim), seat: ['sit', 'grind', 'sleep'].includes(F.anim) } as RigInput;
      rig.setPose(inp); rig.solve(inp, pal, 0);
      for (let i = 0; i < nv; i++) { const t = (v.index * O.NV + L.tid[i]) * 4, bx = O.source[t], by = O.source[t + 1], bz = O.source[t + 2], n0 = unpackNormal(O.source[t + 3]);
        let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0;
        for (let k = 0; k < 4; k++) { const w = L.skinWeight[i * 4 + k] / 255; if (!w) continue; const o = L.skinIndex[i * 4 + k] * 12;
          px += w * (pal[o] * bx + pal[o + 1] * by + pal[o + 2] * bz + pal[o + 3]); py += w * (pal[o + 4] * bx + pal[o + 5] * by + pal[o + 6] * bz + pal[o + 7]); pz += w * (pal[o + 8] * bx + pal[o + 9] * by + pal[o + 10] * bz + pal[o + 11]);
          qx += w * (pal[o] * n0[0] + pal[o + 1] * n0[1] + pal[o + 2] * n0[2]); qy += w * (pal[o + 4] * n0[0] + pal[o + 5] * n0[1] + pal[o + 6] * n0[2]); qz += w * (pal[o + 8] * n0[0] + pal[o + 9] * n0[1] + pal[o + 10] * n0[2]); }
        const ql = Math.hypot(qx, qy, qz) || 1; P[i * 3] = px; P[i * 3 + 1] = py; P[i * 3 + 2] = pz; N[i * 3] = qx / ql; N[i * 3 + 1] = qy / ql; N[i * 3 + 2] = qz / ql; }
      // a carried prop drawn into the frame (the crowd's placement for these two: props.ts placeProp, its 'legacy' rule)
      const extra: { pos: Float32Array; idx: ArrayLike<number> } | null = F.prop === 'jar_head' && props?.jar ? xform(props.jar, rig.wt, HB.head, [0, 0.25, 0.02], 0.8) : F.prop === 'sack' && props?.sack ? xform(props.sack, rig.wt, HB.upperarm_r, [0.02, 0.13, -0.02], 1) : null;
      const row = di * FRAMES.length + fi;
      for (let vw = 0; vw < V; vw++) {
        const al = (vw / V) * Math.PI * 2, rx = Math.cos(al), rz = -Math.sin(al), dx = Math.sin(al), dz = Math.cos(al); // screen right, toward the viewer (character space)
        z.fill(-1e9); const ox = vw * C, oy = row * C;
        const sx = (x: number, zz: number) => ((x * rx + zz * rz) / IMP.width + 0.5) * C, sy = (y: number) => ((y - IMP.y0) / IMP.height) * C;
        const tri = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, fill: (i: number, j: number) => void) => {
          const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(C - 1, Math.ceil(Math.max(ax, bx, cx))), y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(C - 1, Math.ceil(Math.max(ay, by, cy)));
          const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay); if (Math.abs(d) < 1e-9) return;
          for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const qx = i + 0.5, qy = j + 0.5;
            const w1 = ((qx - ax) * (cy - ay) - (cx - ax) * (qy - ay)) / d, w2 = ((bx - ax) * (qy - ay) - (qx - ax) * (by - ay)) / d, w0 = 1 - w1 - w2;
            if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue; const depth = w0 * az + w1 * bz + w2 * cz; const q = j * C + i; if (depth <= z[q]) continue; z[q] = depth; fill(q, i); } };
        const put = (q: number, sl: number, n: [number, number, number], a: number) => { const i = q % C, j = (q / C) | 0, o = ((oy + j) * W + ox + i) * 4;
          wA[o] = sl === 0 ? 1 : 0; wA[o + 1] = sl === 1 ? 1 : 0; wA[o + 2] = sl === 2 ? 1 : 0; wA[o + 3] = 1; wB[o] = sl === 3 ? 1 : 0; wB[o + 1] = sl === 4 ? 1 : 0; wB[o + 2] = sl === 5 ? 1 : 0; wB[o + 3] = sl === 6 ? 1 : 0;
          nN[o] = n[0] * 0.5 + 0.5; nN[o + 1] = n[1] * 0.5 + 0.5; nN[o + 2] = n[2] * 0.5 + 0.5; nN[o + 3] = a; };
        const I = L.index;
        for (let t = 0; t < I.length; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2]; if (!keep[a] || !keep[b] || !keep[c]) continue;
          const ax = sx(P[a * 3], P[a * 3 + 2]), ay = sy(P[a * 3 + 1]), az = P[a * 3] * dx + P[a * 3 + 2] * dz, bx = sx(P[b * 3], P[b * 3 + 2]), by = sy(P[b * 3 + 1]), bz = P[b * 3] * dx + P[b * 3 + 2] * dz, cx = sx(P[c * 3], P[c * 3 + 2]), cy = sy(P[c * 3 + 1]), cz = P[c * 3] * dx + P[c * 3 + 2] * dz;
          const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2], nl = Math.hypot(nx, ny, nz) || 1;
          const nv3: [number, number, number] = [(nx * rx + nz * rz) / nl, ny / nl, (nx * dx + nz * dz) / nl], sl = slot[a], am = (ao[a] + ao[b] + ao[c]) / 3;
          tri(ax, ay, az, bx, by, bz, cx, cy, cz, q => put(q, sl, nv3, am)); }
        if (extra) { const E = extra.pos, J = extra.idx; for (let t = 0; t < J.length; t += 3) { const a = J[t], b = J[t + 1], c = J[t + 2];
          const e1 = [E[b * 3] - E[a * 3], E[b * 3 + 1] - E[a * 3 + 1], E[b * 3 + 2] - E[a * 3 + 2]], e2 = [E[c * 3] - E[a * 3], E[c * 3 + 1] - E[a * 3 + 1], E[c * 3 + 2] - E[a * 3 + 2]];
          let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0]; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          const nv3: [number, number, number] = [nx * rx + nz * rz, ny, nx * dx + nz * dz]; if (nv3[2] < 0) { nv3[0] = -nv3[0]; nv3[1] = -nv3[1]; nv3[2] = -nv3[2]; }
          tri(sx(E[a * 3], E[a * 3 + 2]), sy(E[a * 3 + 1]), E[a * 3] * dx + E[a * 3 + 2] * dz, sx(E[b * 3], E[b * 3 + 2]), sy(E[b * 3 + 1]), E[b * 3] * dx + E[b * 3 + 2] * dz, sx(E[c * 3], E[c * 3 + 2]), sy(E[c * 3 + 1]), E[c * 3] * dx + E[c * 3 + 2] * dz, q => put(q, 6, nv3, 1)); } }
      }
    });
  });
  const cloth = {} as Record<Dress, ClothStats[]>;
  for (const dress of IMP_DRESSES) { const L = farLod(O, dress); if (L) cloth[dress] = clothStatsOf(O, L, refVariant(A, dress).index, typicalMask(dress)); }
  const cover = new Float32Array(ROWS * V); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (wA[(j * W + i) * 4 + 3] >= 0.5) cover[Math.floor(j / C) * V + Math.floor(i / C)]++;
  for (let k = 0; k < cover.length; k++) cover[k] /= C * C;
  const { A: LA, B: LB, N: LN } = mips(wA, wB, nN, W, H, cover);
  return { W, H, A: LA, B: LB, N: LN, refStature, ms: performance.now() - t0, coverage: cover, cloth };
}
/** prop geometry placed at a bone head (character space) with an offset and scale (no rotation: jar and sack are near round) */
function xform(g: { pos: Float32Array; idx: ArrayLike<number> }, wt: Float64Array, bone: number, off: number[], s: number) {
  const o = new Float32Array(g.pos.length), bx = wt[bone * 3] + off[0], by = wt[bone * 3 + 1] + off[1], bz = wt[bone * 3 + 2] + off[2];
  for (let i = 0; i < g.pos.length; i += 3) { o[i] = bx + g.pos[i] * s; o[i + 1] = by + g.pos[i + 1] * s; o[i + 2] = bz + g.pos[i + 2] * s; }
  return { pos: o, idx: g.idx };
}
/** mip levels: weights and normals averaged by coverage; coverage scaled per cell so the texels passing 0.5 keep the
 *  cell's full-size share (coverage-preserving, trees/atlas.ts mipChain) */
function mips(a0: Float32Array, b0: Float32Array, n0: Float32Array, W: number, H: number, cover0: Float32Array) {
  const C = IMP.cell, cols = IMP.views, rows = ROWS; const out = { A: [] as Level[], B: [] as Level[], N: [] as Level[] };
  const u8 = (f: Float32Array) => { const u = new Uint8Array(f.length); for (let i = 0; i < f.length; i++) { const v = f[i] * 255 + 0.5; u[i] = v <= 0 ? 0 : v >= 255 ? 255 : v; } return u; };
  let A = a0, B = b0, N = n0, w = W, h = H, ts = C;
  const push = () => { out.A.push({ data: u8(A), width: w, height: h }); out.B.push({ data: u8(B), width: w, height: h }); out.N.push({ data: u8(N), width: w, height: h }); };
  push();
  while (ts > 1) {
    const nw = w >> 1, nh = h >> 1, nA = new Float32Array(nw * nh * 4), nB = new Float32Array(nw * nh * 4), nN = new Float32Array(nw * nh * 4); ts >>= 1;
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) { let ws = 0; const o = (j * nw + i) * 4; let cov = 0;
      for (let q = 0; q < 4; q++) { const s = ((2 * j + (q >> 1)) * w + 2 * i + (q & 1)) * 4, c = A[s + 3]; cov += c; ws += c;
        for (let k = 0; k < 3; k++) { nA[o + k] += A[s + k] * c; nN[o + k] += N[s + k] * c; } for (let k = 0; k < 4; k++) nB[o + k] += B[s + k] * c; nN[o + 3] += N[s + 3] * c; }
      if (ws > 0) { for (let k = 0; k < 3; k++) { nA[o + k] /= ws; nN[o + k] /= ws; } for (let k = 0; k < 4; k++) nB[o + k] /= ws; nN[o + 3] /= ws; } else { nN[o] = 0.5; nN[o + 1] = 0.5; nN[o + 2] = 1; }
      nA[o + 3] = cov / 4; }
    for (let t = 0; t < cols * rows; t++) { if (cover0[t] <= 0) continue; const ox = (t % cols) * ts, oy = Math.floor(t / cols) * ts;
      const vals: number[] = []; for (let j = 0; j < ts; j++) for (let i = 0; i < ts; i++) vals.push(nA[((oy + j) * nw + ox + i) * 4 + 3]);
      vals.sort((x, y) => y - x); const need = Math.max(1, Math.round(cover0[t] * ts * ts)), amin = vals[Math.min(vals.length, need) - 1];
      const k = amin > 0 ? Math.min(8, Math.max(1, 0.5 / amin)) : 1;
      if (k > 1) for (let j = 0; j < ts; j++) for (let i = 0; i < ts; i++) { const o = ((oy + j) * nw + ox + i) * 4 + 3; nA[o] = Math.min(1, nA[o] * k); } }
    A = nA; B = nB; N = nN; w = nw; h = nh; push();
  }
  return out;
}
const mipTex = (levels: Level[]) => {
  const t = new THREE.DataTexture(levels[0].data, levels[0].width, levels[0].height, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.mipmaps = levels.map(l => ({ data: l.data, width: l.width, height: l.height })) as any; t.generateMipmaps = false;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t;
};
/** a linear RGB albedo packed into one float holding an exact 24-bit integer (sqrt-encoded 8 bits a channel) */
export const packRGB = (c: ArrayLike<number>) => { const q = (x: number) => Math.max(0, Math.min(255, Math.round(Math.sqrt(Math.max(0, x)) * 255))); return q(c[0]) * 65536 + q(c[1]) * 256 + q(c[2]); };
export const unpackRGB = (p: number): [number, number, number] => { const r = Math.floor(p / 65536), g = Math.floor((p % 65536) / 256), b = p % 256; return [(r / 255) ** 2, (g / 255) ** 2, (b / 255) ** 2]; };
/** floats per instance: position + yaw, row + scale + main + second, trim + skin + hair + leather */
export const IMP_STRIDE = 12;

export class CrowdImpostors {
  readonly mesh: THREE.Mesh; private geo: THREE.InstancedBufferGeometry; private buf: THREE.InstancedInterleavedBuffer; count = 0;
  constructor(readonly atlas: ImpostorAtlas, cap = 4096) {
    const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3)); g.setIndex([0, 1, 2, 2, 1, 3]);
    this.geo = g; this.buf = this.alloc(cap); g.instanceCount = 0; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    const texA = mipTex(atlas.A), texB = mipTex(atlas.B), texN = mipTex(atlas.N);
    const ipos = attribute('ipos', 'vec4'), iinfo = attribute('iinfo', 'vec4'), icol = attribute('icol', 'vec4'), P = positionGeometry;
    const toCam = cameraPosition.xz.sub(ipos.xz), dir = toCam.div(max(length(toCam), 1e-3)), right = vec3(dir.y, 0, dir.x.negate()), sc = iinfo.y;
    const m = new THREE.MeshStandardNodeMaterial();
    // the billboard corner; with a velocity pass (TRAA) the previous position is the same point (a person's own motion is a
    // few cm a frame; three's default would be the raw quad at the origin and smear every impostor)
    m.positionNode = Fn((builder: any) => { const p = vec3(ipos.x, ipos.y, ipos.z).add(right.mul(P.x.mul(IMP.width * 0.5).mul(sc))).add(vec3(0, P.y.mul(IMP.height).add(IMP.y0).mul(sc), 0)).toVar();
      if (builder.needsPreviousData()) positionPrevious.assign(p); return p; })();
    // the view: the direction to the camera in the person's own frame (inverse of the crowd's yaw: humanMaterial rotN)
    const c = cos(ipos.w), s = sin(ipos.w), lx = dir.x.mul(c).sub(dir.y.mul(s)), lz = dir.x.mul(s).add(dir.y.mul(c));
    const view = mod(floor(atan(lx, lz).div(Math.PI * 2).mul(IMP.views).add(0.5).add(IMP.views)), IMP.views);
    const half = 0.5 / IMP.cell; // half a texel inset: no bleeding between cells at level 0
    const vUV = varying(vec2(view.add(P.x.mul(0.5 - half).add(0.5)).div(IMP.views), iinfo.x.add(P.y.mul(1 - 2 * half).add(half)).div(ROWS)));
    const unpack = (p: any) => { const r = floor(p.div(65536)), g2 = floor(mod(p, 65536).div(256)), b = mod(p, 256); const v = vec3(r, g2, b).div(255); return v.mul(v); };
    const cMain = varying(unpack(iinfo.z)), cSecond = varying(unpack(iinfo.w)), cTrim = varying(unpack(icol.x)), cSkin = varying(unpack(icol.y)), cHair = varying(unpack(icol.z)), cLeather = varying(unpack(icol.w));
    const vRight = varying(right), vDir = varying(vec3(dir.x, 0, dir.y));
    const a = texture(texA, vUV), b = texture(texB, vUV), n = texture(texN, vUV);
    // weights over their sum: a silhouette edge blended with empty texels keeps its colour (no dark fringe)
    const wsum = max(a.r.add(a.g).add(a.b).add(b.r).add(b.g).add(b.b).add(b.a), 1e-3);
    m.colorNode = vec4(cMain.mul(a.r).add(cSecond.mul(a.g)).add(cTrim.mul(a.b)).add(cSkin.mul(b.r)).add(cHair.mul(b.g)).add(cLeather.mul(b.b)).add(vec3(...FIXED).mul(b.a)).div(wsum), a.a);
    const nb = n.xyz.mul(2).sub(1), nW = vRight.mul(nb.x).add(vec3(0, 1, 0).mul(nb.y)).add(vDir.mul(nb.z));
    m.normalNode = normalize(cameraViewMatrix.mul(vec4(nW, 0)).xyz);
    m.aoNode = float(0.55).add(n.a.mul(0.45)); m.roughnessNode = float(0.85); m.metalnessNode = float(0);
    m.alphaTest = 0.5;
    const mesh = new THREE.Mesh(g, m); mesh.name = 'people:impostors'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.visible = false;
    mesh.userData = { tier: 'C', src: 'RECON', note: 'distant people: impostors baked from the far body of each dress in 14 activity frames (D-143); colours per person (looks.ts)' };
    mesh.raycast = () => {};
    this.mesh = mesh;
  }
  private alloc(n: number, copy?: Float32Array) {
    const a = new Float32Array(n * IMP_STRIDE); if (copy) a.set(copy.subarray(0, Math.min(copy.length, a.length)));
    const ib = new THREE.InstancedInterleavedBuffer(a, IMP_STRIDE, 1); ib.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('ipos', new THREE.InterleavedBufferAttribute(ib, 4, 0)); this.geo.setAttribute('iinfo', new THREE.InterleavedBufferAttribute(ib, 4, 4)); this.geo.setAttribute('icol', new THREE.InterleavedBufferAttribute(ib, 4, 8));
    return ib;
  }
  begin() { this.count = 0; }
  /** add a person: feet at world (x, y, z), world yaw (the crowd's), atlas row, stature scale, their look's colours */
  push(x: number, y: number, z: number, yaw: number, row: number, scale: number, col: PersonLook['col'] | null, packed?: Float32Array) {
    if ((this.count + 1) * IMP_STRIDE > this.buf.array.length) this.buf = this.alloc(this.buf.count * 2, this.buf.array as Float32Array);
    const a = this.buf.array as Float32Array, o = this.count++ * IMP_STRIDE;
    a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = yaw; a[o + 4] = row; a[o + 5] = scale;
    if (packed) { a[o + 6] = packed[0]; a[o + 7] = packed[1]; a[o + 8] = packed[2]; a[o + 9] = packed[3]; a[o + 10] = packed[4]; a[o + 11] = packed[5]; }
    else if (col) { a[o + 6] = packRGB(col.main); a[o + 7] = packRGB(col.second); a[o + 8] = packRGB(col.trim); a[o + 9] = packRGB(col.skin); a[o + 10] = packRGB(col.hair); a[o + 11] = packRGB(col.leather); }
  }
  /** instance i of this frame: feet x, y, z and stature scale */
  at(i: number): [number, number, number, number] { const a = this.buf.array as Float32Array, o = i * IMP_STRIDE; return [a[o], a[o + 1], a[o + 2], a[o + 5]]; }
  end() { const g = this.geo; g.instanceCount = this.count; this.mesh.visible = this.count > 0; if (this.count) { this.buf.needsUpdate = true; this.buf.clearUpdateRanges(); this.buf.addUpdateRange(0, this.count * IMP_STRIDE); } }
  /** the packed colours of a look (cache them per person) */
  static pack(col: PersonLook['col']): Float32Array { return Float32Array.of(packRGB(col.main), packRGB(col.second), packRGB(col.trim), packRGB(col.skin), packRGB(col.hair), packRGB(col.leather)); }
  /** the packed colours of a look as the skinned material shows them on average (farColours, D-189) */
  packLook(look: PersonLook): Float32Array { const [m, s, t] = farColours(look, this.atlas.cloth?.[look.far ?? look.dress]) /* D-199: a dress without a row of its own uses its far row's */; const c = look.col;
    return Float32Array.of(packRGB(m), packRGB(s), packRGB(t), packRGB(c.skin), packRGB(c.hair), packRGB(c.leather)); }
}
