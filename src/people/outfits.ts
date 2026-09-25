// Garments, hair, beards, headgear and worn equipment fitted to the MakeHuman bodies (D-090). Everything follows the
// skeleton (no cloth simulation): each piece is skinned with the body's own weights or with weights blended along
// its length, so it deforms with the pose.
//
// Three kinds of piece:
//  * shell  — a copy of the body surface over a region, pushed out along the normal ("coverage + inflation"). The offset
//             ramps through zero at the region's edge, so the edge sinks into the skin and the visible hem is the clean
//             intersection line. Loose garments are relaxed (Laplacian smoothing, kept outside the body), which bridges
//             small hollows the way cloth does. Shells take the body's skin weights.
//  * tube   — rings swept along an axis (skirts, wide sleeves, belts, hats, the beard mass, the bun, weapons). A ring's
//             radius comes from the body's support function in its plane (so it encloses the limbs) plus ease, flare and
//             pleats. Tubes are lined (an inner layer with reversed winding), so they are seen from inside too.
//  * body   — the body's own triangles; those deep under an always-worn piece are dropped (no poke-through, fewer
//             triangles).
// Topology, weights and region membership are decided once on the reference body (same topology for all variants);
// positions are generated per variant (23), so each body wears its own fitted copy.
// Every piece carries an evidence tier and source key for the dev overlay (F3). Colours are per person (crowd.ts).
import type { HumanAssets, HumanVariant } from './humanAssets';
import { HB, PART, MAT, EYE_UNIT, SKIN_CURV_MAX, PRM_UPPER, type HBone } from './humanFormat';
import { clothHull, headHull, hull2, rayToHull, BELT_TOP } from './drape';

export type Dress = 'persian' | 'guard' | 'median' | 'worker' | 'woman' | 'child' | 'envoy' | 'envoy_short' | 'envoy_bare' | 'king' | 'court_woman';
export const DRESSES: Dress[] = ['persian', 'guard', 'median', 'worker', 'woman', 'child', 'envoy', 'envoy_short', 'envoy_bare', 'king', 'court_woman'];
/** colour slots of the per-person data (texel index in the person texture); 0 = fixed by material class/param */
export const COL = { fixed: 0, skin: 1, main: 2, second: 3, trim: 4, hair: 5, leather: 6, felt: 8 } as const;
export type ColSlot = typeof COL[keyof typeof COL];
/** fixed-colour parameter (hmat.w) for metal and other fixed classes */
export const METAL = { bronze: 0, silver: 1, gold: 2, iron: 3 } as const;

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sstep = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------------------------------------ piece geometry
export interface Geo {
  key: string; n: number; index: number[];
  si: Uint8Array; sw: Uint8Array; uv: Float32Array;
  /** material class (MAT), colour slot (COL), class parameter, sleeve/drape slack 0..255 (the shader sags it), cavity AO 0..255 */
  mat: Uint8Array; col: Uint8Array; prm: Uint8Array; slack: Uint8Array; ao: Uint8Array;
  /** garments' spare byte (hext.z; the body uses it for the beard region): 255 on a skirt tube, whose hem the material
   *  folds and fits per person (D-189) */
  aux: Uint8Array;
  /** 0 at a shell's cut line … 255 a ramp inside it (hair and beard edges are frayed in the shader) */
  edge: Uint8Array;
  /** bind positions for one variant (n × 3) */
  place(c: Ctx): Float32Array;
}
export interface Ctx { A: HumanAssets; v: HumanVariant; J(b: HBone): V3; /** positions of pieces already placed for this variant */ placed: Map<string, Float32Array>; }

function newGeo(key: string, n: number, index: number[], place: (c: Ctx) => Float32Array): Geo {
  return { key, n, index, si: new Uint8Array(n * 4), sw: new Uint8Array(n * 4), uv: new Float32Array(n * 2), mat: new Uint8Array(n), col: new Uint8Array(n), prm: new Uint8Array(n), slack: new Uint8Array(n), aux: new Uint8Array(n), ao: new Uint8Array(n).fill(255), edge: new Uint8Array(n).fill(255), place };
}
/** pack up to 4 (bone, weight) pairs as bytes summing to 255 */
function setW(g: Geo, i: number, list: [number, number][]) {
  const e = list.filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4); const s = e.reduce((a, [, w]) => a + w, 0) || 1;
  const q = e.map(([, w]) => Math.round((w / s) * 255)); if (q.length) q[0] += 255 - q.reduce((a, b) => a + b, 0);
  for (let k = 0; k < 4; k++) { g.si[i * 4 + k] = e[k]?.[0] ?? 0; g.sw[i * 4 + k] = q[k] ?? 0; }
}
function setMat(g: Geo, mat: number, col: number, prm = 0) { g.mat.fill(mat); g.col.fill(col); g.prm.fill(prm); }

// ------------------------------------------------------------------------------------------------ regions
/** signed distance-like region value per render vertex on the reference body (m; > 0 inside) */
export type Region = Float32Array;
function regionOf(A: HumanAssets, ref: HumanVariant, parts: number[] | null, f: (p: V3, i: number) => number): Region {
  const d = new Float32Array(A.NO).fill(-1); const ps = parts ? new Set(parts) : null;
  for (let i = 0; i < A.NO; i++) { if (A.part[i] >= PART.eye) continue; if (ps && !ps.has(A.part[i])) continue; d[i] = f([ref.pos[i * 3], ref.pos[i * 3 + 1], ref.pos[i * 3 + 2]], i); }
  return d;
}
/** distance along bone a→b (0 at a, 1 at b) of point p and the bone axis */
const along = (J: (b: HBone) => V3, a: HBone, b: HBone, p: V3) => { const u = sub(J(b), J(a)), L = len(u); return dot(sub(p, J(a)), u) / (L * L); };
const boneLen = (J: (b: HBone) => V3, a: HBone, b: HBone) => len(sub(J(b), J(a)));
const P = PART;
const ARMS = [P.uarm_l, P.farm_l, P.uarm_r, P.farm_r], LEGS = [P.thigh_l, P.calf_l, P.thigh_r, P.calf_r], TORSO = [P.chest, P.belly, P.pelvis];

// ------------------------------------------------------------------------------------------------ shells
interface ShellOpts {
  tris: Uint16Array; d: Region; ramp: number; thick: (p: V3, i: number) => number; smooth?: number; minOff?: number;
  mat: number; col: number; prm?: number; slack?: (p: V3, i: number) => number;
  /** offset at the cut line (m, or per reference position): the garment's edge stands this far off the skin */
  edge?: number | ((p: V3, i: number) => number);
  /** also smooth the cut line (along itself) and the ramp: the edge follows the body's coarse triangles and normals, which
   *  can zigzag it where the surface bends (D-155: the headcloth's hanging edges) */
  smoothEdge?: boolean;
  /** D-206: how far (0..1, per reference position) the shell's base moves from the skin to the cloth hull (drape.ts:
   *  hollows bridged, the torso hanging from the chest, no ear or toes under felt and leather), reached `hullRamp` m
   *  inside the cut line (0: at the cut line itself) */
  hull?: (p: V3) => number; hullRamp?: number;
  /** D-206: the cut edges (per reference position of both ends) that get a turned edge: a band from the garment's edge
   *  back to the skin, so an opening that stands off the body shows the cloth's thickness (a hem), not a gap */
  lip?: (p: V3, i: number) => boolean;
}
/** Shell over the region d > 0 of the body triangles: triangles are clipped exactly at the iso-line d = 0 (new vertices on
 *  the crossing edges), so the garment edge is a clean contour; the offset rises from `edge` at the cut to `thick` over
 *  `ramp` metres. Vertices are welded by position vertex, so UV seams do not split the shell. */
function shellGeo(A: HumanAssets, ref: HumanVariant, key: string, o: ShellOpts): Geo {
  const edge = o.edge ?? 0.0015, edgeAt = typeof edge === 'function' ? edge : () => edge;
  // shell vertex = lerp(body render vertex a, b, s); original vertices have b = a, s = 0
  const va: number[] = [], vb: number[] = [], vs: number[] = [], vd: number[] = []; const keyOf = new Map<string, number>();
  const vert = (a: number, b: number, s: number) => {
    if (s <= 0 || a === b) { const k = `${A.orig[a]}`; let i = keyOf.get(k); if (i === undefined) { i = va.length; keyOf.set(k, i); va.push(a); vb.push(a); vs.push(0); vd.push(o.d[a]); } return i; }
    if (s >= 1) return vert(b, b, 0);
    const pa = A.orig[a], pb = A.orig[b]; const k = pa < pb ? `${pa}:${pb}` : `${pb}:${pa}`; let i = keyOf.get(k);
    if (i === undefined) { i = va.length; keyOf.set(k, i); va.push(a); vb.push(b); vs.push(s); vd.push(0); } return i;
  };
  const index: number[] = [];
  for (let t = 0; t < o.tris.length; t += 3) {
    const T = [o.tris[t], o.tris[t + 1], o.tris[t + 2]];
    if (A.part[T[0]] >= PART.eye || A.part[T[1]] >= PART.eye || A.part[T[2]] >= PART.eye) continue;
    const D = T.map(i => o.d[i]); if (D[0] <= 0 && D[1] <= 0 && D[2] <= 0) continue;
    if (D[0] > 0 && D[1] > 0 && D[2] > 0) { index.push(vert(T[0], T[0], 0), vert(T[1], T[1], 0), vert(T[2], T[2], 0)); continue; }
    const poly: number[] = []; // clip against d ≥ 0 (Sutherland–Hodgman on one plane)
    for (let e = 0; e < 3; e++) { const a = T[e], b = T[(e + 1) % 3], da = D[e], db = D[(e + 1) % 3];
      if (da > 0) poly.push(vert(a, a, 0));
      if ((da > 0) !== (db > 0)) poly.push(vert(a, b, da / (da - db))); }
    for (let k = 1; k + 1 < poly.length; k++) index.push(poly[0], poly[k], poly[k + 1]);
  }
  const n0 = va.length;
  const nb: number[][] = Array.from({ length: n0 }, () => []);
  for (let t = 0; t < index.length; t += 3) for (let e = 0; e < 3; e++) { const a = index[t + e], b = index[t + (e + 1) % 3]; if (!nb[a].includes(b)) nb[a].push(b); if (!nb[b].includes(a)) nb[b].push(a); }
  const refP = (k: number): V3 => { const a = va[k], b = vb[k], t = vs[k]; return [lerp(ref.pos[a * 3], ref.pos[b * 3], t), lerp(ref.pos[a * 3 + 1], ref.pos[b * 3 + 1], t), lerp(ref.pos[a * 3 + 2], ref.pos[b * 3 + 2], t)]; };
  const off = Float32Array.from({ length: n0 }, (_, k) => { const p = refP(k), th = o.thick(p, va[k]), e = edgeAt(p, va[k]); return e + (th - e) * sstep(0, o.ramp, vd[k]); });
  const deep = Uint8Array.from(vd, d => (d >= o.ramp ? 1 : 0));
  // D-206: the hull weight per vertex, and the turned edges: each cut edge (an edge of one triangle) whose ends pass `lip`
  // gets a band of two triangles to a copy of its ends lying on the skin (lip vertex n0 + j mirrors boundary vertex lipOf[j])
  const hw = o.hull ? Float32Array.from({ length: n0 }, (_, k) => clamp(o.hull!(refP(k))) * (o.hullRamp ? sstep(0, o.hullRamp, vd[k]) : 1)) : null;
  const lipOf: number[] = [];
  if (o.lip) {
    const cnt = new Map<string, number>(); for (let t = 0; t < index.length; t += 3) for (let e = 0; e < 3; e++) { const a = index[t + e], b = index[t + (e + 1) % 3], k = a < b ? `${a}:${b}` : `${b}:${a}`; cnt.set(k, (cnt.get(k) ?? 0) + 1); }
    const mirror = new Map<number, number>(), mir = (k: number) => { let j = mirror.get(k); if (j === undefined) { j = n0 + lipOf.length; mirror.set(k, j); lipOf.push(k); } return j; };
    const T = index.length;
    for (let t = 0; t < T; t += 3) for (let e = 0; e < 3; e++) { const a = index[t + e], b = index[t + (e + 1) % 3]; if (cnt.get(a < b ? `${a}:${b}` : `${b}:${a}`) !== 1) continue;
      /* cut lines only, not holes in the body mesh */ if (vd[a] > 1e-6 || vd[b] > 1e-6 || !o.lip(refP(a), va[a]) || !o.lip(refP(b), va[b])) continue; const a2 = mir(a), b2 = mir(b); index.push(a, a2, b, b, a2, b2); }
  }
  const n = n0 + lipOf.length;
  const g = newGeo(key, n, index, (c: Ctx) => {
    const out = new Float32Array(n * 3), base = new Float32Array(n0 * 3), hb = new Float32Array(n0 * 3), N = new Float32Array(n0 * 3); const Pv = c.v.pos, Nv = c.v.nrm;
    const CH = hw ? clothHull(c.A, c.v) : null, H = CH ? CH.tgt : null, HD = CH ? CH.dir : null;
    for (let k = 0; k < n0; k++) { const a = va[k], b = vb[k], t = vs[k]; let nx = lerp(Nv[a * 3], Nv[b * 3], t), ny = lerp(Nv[a * 3 + 1], Nv[b * 3 + 1], t), nz = lerp(Nv[a * 3 + 2], Nv[b * 3 + 2], t); let l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      // D-206: over the hull the thickness is laid along the hull's section direction, not the skin's normal
      if (HD) { const w = hw![k]; nx += (lerp(HD[a * 3], HD[b * 3], t) - nx) * w; ny += (lerp(HD[a * 3 + 1], HD[b * 3 + 1], t) - ny) * w; nz += (lerp(HD[a * 3 + 2], HD[b * 3 + 2], t) - nz) * w; l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; }
      N[k * 3] = nx; N[k * 3 + 1] = ny; N[k * 3 + 2] = nz;
      for (let e = 0; e < 3; e++) { base[k * 3 + e] = lerp(Pv[a * 3 + e], Pv[b * 3 + e], t); hb[k * 3 + e] = H ? base[k * 3 + e] + (lerp(H[a * 3 + e], H[b * 3 + e], t) - base[k * 3 + e]) * hw![k] : base[k * 3 + e]; out[k * 3 + e] = hb[k * 3 + e] + N[k * 3 + e] * off[k]; } }
    const it = o.smooth ?? 0, minOff = o.minOff ?? 0.003;
    for (let s = 0; s < it; s++) {
      const prev = out.slice();
      for (let k = 0; k < n0; k++) { if (!deep[k] && !o.smoothEdge) continue; const L = vs[k] > 0 ? nb[k].filter(q => vs[q] > 0) : nb[k]; if (!L.length) continue;
        let x = 0, y = 0, z = 0; for (const q of L) { x += prev[q * 3]; y += prev[q * 3 + 1]; z += prev[q * 3 + 2]; }
        x /= L.length; y /= L.length; z /= L.length;
        if (hw && deep[k]) { // D-206: inside a hull shell only along the offset direction (a free Laplacian slid vertices along the surface: the mid body's coarse toes into teeth); a cut line (smoothEdge) still straightens along itself
          const dn = ((x - out[k * 3]) * N[k * 3] + (y - out[k * 3 + 1]) * N[k * 3 + 1] + (z - out[k * 3 + 2]) * N[k * 3 + 2]) * 0.5; for (let q = 0; q < 3; q++) out[k * 3 + q] += dn * N[k * 3 + q]; }
        else { out[k * 3] += 0.5 * (x - out[k * 3]); out[k * 3 + 1] += 0.5 * (y - out[k * 3 + 1]); out[k * 3 + 2] += 0.5 * (z - out[k * 3 + 2]); }
        // kept outside the hull (D-206; the skin where there is none): smoothing may not pull the drape back onto the body
        const e = (out[k * 3] - hb[k * 3]) * N[k * 3] + (out[k * 3 + 1] - hb[k * 3 + 1]) * N[k * 3 + 1] + (out[k * 3 + 2] - hb[k * 3 + 2]) * N[k * 3 + 2];
        const m = Math.min(minOff, off[k]); if (e < m) for (let q = 0; q < 3; q++) out[k * 3 + q] += (m - e) * N[k * 3 + q]; }
    }
    // the turned edges lie on the skin, 1.5 mm out
    lipOf.forEach((k, j) => { for (let e = 0; e < 3; e++) out[(n0 + j) * 3 + e] = base[k * 3 + e] + N[k * 3 + e] * 0.0015; });
    return out;
  });
  for (let k = 0; k < n0; k++) {
    const a = va[k], b = vb[k], t = vs[k];
    if (t === 0) { for (let q = 0; q < 4; q++) { g.si[k * 4 + q] = A.skinIndex[a * 4 + q]; g.sw[k * 4 + q] = A.skinWeight[a * 4 + q]; } }
    else { const m = new Map<number, number>(); for (const [v, w] of [[a, 1 - t], [b, t]] as [number, number][]) for (let q = 0; q < 4; q++) { const bi = A.skinIndex[v * 4 + q], wt = A.skinWeight[v * 4 + q] / 255; if (wt) m.set(bi, (m.get(bi) ?? 0) + wt * w); }
      setW(g, k, [...m.entries()]); }
    g.uv[k * 2] = lerp(A.uv[a * 2], A.uv[b * 2], t); g.uv[k * 2 + 1] = lerp(A.uv[a * 2 + 1], A.uv[b * 2 + 1], t);
    g.ao[k] = Math.round(255 * (0.55 + 0.45 * lerp(A.ao[a], A.ao[b], t))); g.edge[k] = Math.round(255 * clamp(vd[k] / o.ramp));
    if (o.slack) g.slack[k] = Math.round(255 * clamp(o.slack(refP(k), a)));
  }
  // turned edges: the weights, uv and slack of the edge they turn under; a cavity (the inside of the hem) and the cut line
  lipOf.forEach((k, j) => { const i = n0 + j; g.si.set(g.si.subarray(k * 4, k * 4 + 4), i * 4); g.sw.set(g.sw.subarray(k * 4, k * 4 + 4), i * 4);
    g.uv[i * 2] = g.uv[k * 2]; g.uv[i * 2 + 1] = g.uv[k * 2 + 1]; g.slack[i] = g.slack[k]; g.ao[i] = Math.round(g.ao[k] * 0.6); g.edge[i] = 0; });
  setMat(g, o.mat, o.col, o.prm ?? 0);
  return g;
}

// ------------------------------------------------------------------------------------------------ tubes
export interface Frame { o: V3; u: V3; v: V3; w: V3 }
interface TubeOpts {
  segs: number; rings: number;
  /** ring frame at t ∈ [0, 1] (o centre, u = θ 0 direction, v = θ 90°, w = axis) for a variant */
  frame: (c: Ctx, t: number) => Frame;
  /** radius at (t, θ); `sup(θ)` = support radius of the selected body parts in this ring's plane (0 if none) */
  radius: (c: Ctx, t: number, th: number, sup: (th: number) => number) => number;
  /** body parts whose support function the radius may use, and the slab half-thickness (m) */
  support?: { parts: number[]; slab: number; running?: 'max' };
  weights: (t: number, th: number) => [number, number][];
  mat: number; col: number; prm?: number; slack?: (t: number, th: number) => number;
  /** the spare byte (Geo.aux), 0..1 */
  aux?: (t: number, th: number) => number;
  /** lining thickness (m, or per (t, θ)): adds an inner layer with reversed winding and closes the rim at t = 1 (and t = 0 if closeTop) */
  lining?: number | ((t: number, th: number) => number); closeTop?: boolean;
  /** raise the end pole along the axis (a domed top), m */
  capLift?: number;
  /** cap the ends with a pole vertex (closed volumes: hats' tops, beard, bun, quiver) */
  capStart?: boolean; capEnd?: boolean;
  /** ring parameter spacing (default uniform) */
  tOf?: (k: number, rings: number) => number;
  /** open sheet over θ ∈ [a0, a1] instead of a closed ring (a cape); the side edges are closed when lined */
  arc?: [number, number];
}
function tubeGeo(A: HumanAssets, key: string, o: TubeOpts): Geo {
  const S = o.segs, R = o.rings, lining = o.lining ?? 0, lined = typeof lining === 'function' || lining > 0, arc = o.arc, cols = arc ? S + 1 : S;
  const linAt = typeof lining === 'function' ? lining : () => lining;
  const layers = lined ? 2 : 1, nRing = cols * (R + 1), poles = (o.capStart ? 1 : 0) + (o.capEnd ? 1 : 0);
  const n = nRing * layers + poles;
  const idx: number[] = [];
  const vid = (layer: number, k: number, j: number) => layer * nRing + k * cols + (arc ? j : ((j % S) + S) % S);
  const thOf = (j: number) => (arc ? arc[0] + ((arc[1] - arc[0]) * j) / S : (j / S) * 2 * Math.PI);
  for (let layer = 0; layer < layers; layer++) for (let k = 0; k < R; k++) for (let j = 0; j < S; j++) {
    const a = vid(layer, k, j), b = vid(layer, k, j + 1), c = vid(layer, k + 1, j), d = vid(layer, k + 1, j + 1);
    // outer faces outward: (a, c, b) with θ increasing counter-clockwise about +w, t along +w (checked by the tests' normal-direction test)
    if (layer === 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  if (lined && arc) for (let k = 0; k < R; k++) for (const [j, flip] of [[0, false], [S, true]] as const) { const a = vid(0, k, j), b = vid(0, k + 1, j), c = vid(1, k, j), d = vid(1, k + 1, j); if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
  if (lined) { for (let j = 0; j < S; j++) { const a = vid(0, R, j), b = vid(0, R, j + 1), c = vid(1, R, j), d = vid(1, R, j + 1); idx.push(a, b, c, b, d, c); }
    if (o.closeTop) for (let j = 0; j < S; j++) { const a = vid(0, 0, j), b = vid(0, 0, j + 1), c = vid(1, 0, j), d = vid(1, 0, j + 1); idx.push(a, c, b, b, c, d); } }
  let pole = nRing * layers;
  const pS = o.capStart ? pole++ : -1, pE = o.capEnd ? pole++ : -1;
  if (pS >= 0) for (let j = 0; j < S; j++) idx.push(pS, vid(0, 0, j + 1), vid(0, 0, j));
  if (pE >= 0) for (let j = 0; j < S; j++) idx.push(pE, vid(0, R, j), vid(0, R, j + 1));
  const tOf = o.tOf ?? ((k: number, r: number) => k / r);
  const place = (c: Ctx) => {
    const out = new Float32Array(n * 3);
    const partSet = o.support ? new Set(o.support.parts) : null;
    let run: number[] | null = null;
    for (let k = 0; k <= R; k++) {
      const t = tOf(k, R), F = o.frame(c, t);
      let supArr: number[] | null = null;
      if (partSet) { // support radii in 64 bins of θ from body verts in the slab
        const B = 64; supArr = new Array(B).fill(0); const V = c.v.pos, slab = o.support!.slab;
        const horiz = Math.abs(F.w[1]) > 0.999; let list: ArrayLike<number> = partVerts(c.A, o.support!.parts), lo = 0, hi = list.length;
        if (horiz) { const sy = sortedByY(c.v, c.A, o.support!.parts); list = sy.idx; lo = lowerBound(sy.y, F.o[1] - slab); hi = lowerBound(sy.y, F.o[1] + slab + 1e-9); }
        for (let q = lo; q < hi; q++) { const i = list[q]; const dx = V[i * 3] - F.o[0], dy = V[i * 3 + 1] - F.o[1], dz = V[i * 3 + 2] - F.o[2];
          if (Math.abs(dx * F.w[0] + dy * F.w[1] + dz * F.w[2]) > slab) continue; const x = dx * F.u[0] + dy * F.u[1] + dz * F.u[2], y = dx * F.v[0] + dy * F.v[1] + dz * F.v[2];
          for (let b = 0; b < B; b++) { const h = x * COS64[b] + y * SIN64[b]; if (h > supArr[b]) supArr[b] = h; } }
        // smooth over θ (circular), then the running max down the tube (garments hang; they do not tuck back in)
        const sm = supArr.map((_, b) => (supArr![(b + B - 1) % B] + 2 * supArr![b] + supArr![(b + 1) % B]) / 4); supArr = sm;
        if (o.support!.running === 'max') { if (run) supArr = supArr.map((x, b) => Math.max(x, run![b])); run = supArr; }
      }
      const sup = (th: number) => { if (!supArr) return 0; const B = supArr.length; const f = (((th / (2 * Math.PI)) % 1) + 1) % 1 * B, b0 = Math.floor(f) % B, b1 = (b0 + 1) % B, a = f - Math.floor(f); return supArr[b0] * (1 - a) + supArr[b1] * a; };
      for (let j = 0; j < cols; j++) {
        const th = thOf(j), r = o.radius(c, t, th, sup), dir = add(scl(F.u, Math.cos(th)), scl(F.v, Math.sin(th)));
        const p = add(F.o, scl(dir, r)); out.set(p, vid(0, k, j) * 3);
        if (lined) out.set(add(F.o, scl(dir, Math.max(0.0005, r - linAt(t, th)))), vid(1, k, j) * 3);
      }
    }
    if (pS >= 0) { const F = o.frame(c, tOf(0, R)); out.set(add(F.o, scl(F.w, -0.0)), pS * 3); }
    if (pE >= 0) { const F = o.frame(c, tOf(R, R)); out.set(add(F.o, scl(F.w, o.capLift ?? 0)), pE * 3); }
    return out;
  };
  const g = newGeo(key, n, idx, place);
  for (let layer = 0; layer < layers; layer++) for (let k = 0; k <= R; k++) for (let j = 0; j < cols; j++) {
    const i = vid(layer, k, j), t = tOf(k, R), th = thOf(j); setW(g, i, o.weights(t, th)); g.uv[i * 2] = j / S; g.uv[i * 2 + 1] = t;
    if (o.slack) g.slack[i] = Math.round(255 * clamp(o.slack(t, th))); if (o.aux) g.aux[i] = Math.round(255 * clamp(o.aux(t, th))); if (layer === 1) g.ao[i] = 150; }
  if (pS >= 0) { setW(g, pS, o.weights(tOf(0, R), 0)); g.uv.set([0.5, 0], pS * 2); }
  if (pE >= 0) { setW(g, pE, o.weights(tOf(R, R), 0)); g.uv.set([0.5, 1], pE * 2); }
  setMat(g, o.mat, o.col, o.prm ?? 0);
  return g;
}
/** frame along a straight segment a→b with θ = 0 toward `ref` (made perpendicular) */
function segFrame(a: V3, b: V3, t: number, ref: V3): Frame {
  const w = nrm(sub(b, a)); let u = sub(ref, scl(w, dot(ref, w))); if (len(u) < 1e-6) u = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; u = nrm(u);
  return { o: add(a, scl(sub(b, a), t)), u, v: cross(w, u), w };
}
/** horizontal ring for tubes that run downward: θ 0 = front (+Z), θ 90° = the body's right (−X); u × v = w = −Y */
const vertFrame = (o: V3): Frame => ({ o, u: [0, 0, 1], v: [-1, 0, 0], w: [0, -1, 0] });
const COS64 = Array.from({ length: 64 }, (_, b) => Math.cos((b / 64) * 2 * Math.PI)), SIN64 = Array.from({ length: 64 }, (_, b) => Math.sin((b / 64) * 2 * Math.PI));
/** part vertices of a variant sorted by height (cached), for slab queries of horizontal rings */
const SY = new WeakMap<HumanVariant, Map<string, { idx: Int32Array; y: Float32Array }>>();
function sortedByY(v: HumanVariant, A: HumanAssets, parts: number[]) {
  let m = SY.get(v); if (!m) SY.set(v, m = new Map()); const k = parts.join(','); let r = m.get(k);
  if (!r) { const idx = Array.from(partVerts(A, parts)).sort((a, b) => v.pos[a * 3 + 1] - v.pos[b * 3 + 1]); r = { idx: Int32Array.from(idx), y: Float32Array.from(idx, i => v.pos[i * 3 + 1]) }; m.set(k, r); }
  return r;
}
function lowerBound(a: Float32Array, x: number) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; }
/** render vertices of the given parts (cached per asset set) */
const PV = new WeakMap<HumanAssets, Map<string, Int32Array>>();
function partVerts(A: HumanAssets, parts: number[]): Int32Array {
  let m = PV.get(A); if (!m) PV.set(A, m = new Map()); const k = parts.join(','); let r = m.get(k);
  if (!r) { const set = new Set(parts), out: number[] = []; for (let i = 0; i < A.NO; i++) if (set.has(A.part[i])) out.push(i); r = Int32Array.from(out); m.set(k, r); }
  return r;
}

// ------------------------------------------------------------------------------------------------ piece library
export interface PieceMeta { id: string; label: string; tier: 'A' | 'B' | 'C'; src: string; note: string }
/** evidence per piece (overlay text; sources are keys of src/data/sources.json or MATERIAL_CULTURE rows) */
export const PIECES: Record<string, PieceMeta> = {
  robe_upper: { id: 'robe_upper', label: 'Persian court robe (body and shoulders)', tier: 'B', src: 'IR-CAND', note: 'single wide piece girt at the waist (MATERIAL_CULTURE: Persian court robe)' },
  robe_skirt: { id: 'robe_skirt', label: 'robe skirt with pleats', tier: 'B', src: 'IR-CAND', note: 'falls below the belt in tiers of pleats to the ankle; pleat layout and hem line C' },
  robe_sleeves: { id: 'robe_sleeves', label: 'wide robe sleeves', tier: 'B', src: 'IR-CAND', note: 'wide sleeves in folds; hanging drape follows the skeleton (no cloth simulation), C' },
  tunic_upper: { id: 'tunic_upper', label: 'sleeved tunic (sarapis)', tier: 'B', src: 'IR-CAND', note: 'Median riding costume: sleeved tunic, tight sleeves to the wrist; hangs from the chest and shoulder blades, bloused over the belt, hemmed openings (D-206, C for the drape)' },
  tunic_skirt: { id: 'tunic_skirt', label: 'tunic skirt to the knee', tier: 'B', src: 'IR-CLOTH', note: 'knee-length, belted' },
  trousers: { id: 'trousers', label: 'trousers (anaxyrides)', tier: 'B', src: 'IR-CAND', note: 'close-fitting trousers of the riding costume' },
  work_upper: { id: 'work_upper', label: 'short-sleeved working tunic', tier: 'C', src: 'RECON', note: 'MATERIAL_CULTURE workers’ dress: knee-length belted tunic, no ornaments (NOT SEEN; reconstruction)' },
  work_skirt: { id: 'work_skirt', label: 'working tunic skirt to the knee', tier: 'C', src: 'RECON', note: 'workers’ dress (reconstruction)' },
  work_trousers: { id: 'work_trousers', label: 'working trousers', tier: 'C', src: 'RECON', note: 'workers: trousers or bare legs (reconstruction)' },
  dress_upper: { id: 'dress_upper', label: 'woman’s long-sleeved dress', tier: 'C', src: 'IR-WOMEN', note: 'elite women: many-folded dress belted at the front (B); workers reconstructed as the ordinary long tunic (C)' },
  dress_skirt: { id: 'dress_skirt', label: 'dress skirt to the ankle, gathered', tier: 'C', src: 'IR-WOMEN', note: 'folds and length reconstructed (C)' },
  headcloth: { id: 'headcloth', label: 'headcloth / mantle over head and shoulders', tier: 'C', src: 'IR-WOMEN', note: 'women workers: tunic with a mantle or headcloth (MATERIAL_CULTURE, reconstruction C); not a chador (blocklisted)' },
  child_upper: { id: 'child_upper', label: 'child’s short tunic', tier: 'C', src: 'RECON', note: 'no imagery; smaller tunic (MATERIAL_CULTURE, C)' },
  child_skirt: { id: 'child_skirt', label: 'child’s tunic skirt', tier: 'C', src: 'RECON', note: 'reconstruction' },
  belt: { id: 'belt', label: 'cloth belt', tier: 'B', src: 'IR-CAND', note: 'the robe and the tunic are girt at the waist' },
  shoes: { id: 'shoes', label: 'low leather shoes', tier: 'B', src: 'IR-CLOTH', note: 'simple flat-soled shoes, probably leather; strap detail C; form a leather last over the foot (D-206, C: no toes)' },
  boots: { id: 'boots', label: 'laced ankle boots', tier: 'C', src: 'RECON', note: 'Median riding dress: ankle boots (NOT SEEN, C); a soft leather shaft and vamp over a last, rim turned under (D-206, C); laces not modelled' },
  hair: { id: 'hair', label: 'scalp hair, curled', tier: 'B', src: 'RELIEF-R', note: 'curled hair as carved on the reliefs; colour natural dark (the reliefs paint it dark blue, a convention), C' },
  hair_bob: { id: 'hair_bob', label: 'bobbed hair', tier: 'B', src: 'IR-WOMEN', note: 'elite Persian woman statuette from Egypt: bobbed hair (B); for workers C' },
  bun: { id: 'bun', label: 'hair bunched at the nape', tier: 'B', src: 'RELIEF-R', note: 'Persian and Median men on the reliefs wear the hair gathered in a mass at the back of the neck; size C' },
  beard_long: { id: 'beard_long', label: 'long curled beard, squared', tier: 'B', src: 'RELIEF-R', note: 'long beard with rows of curls on the reliefs; length and curl rendering C' },
  beard_short: { id: 'beard_short', label: 'short beard', tier: 'C', src: 'RECON', note: 'workers and foreigners: short beard (reconstruction)' },
  hat_fluted: { id: 'hat_fluted', label: 'fluted felt hat', tier: 'B', src: 'IR-CLOTH', note: 'tall fluted headgear of Persian-dress nobles and guards; height, flute count, material C' },
  fillet: { id: 'fillet', label: 'twisted cloth fillet', tier: 'C', src: 'SUSA-ARCH', note: 'headband of the Susa glazed-brick archers (Darius I); worn here by some Persian-dress guards (C)' },
  cap_soft: { id: 'cap_soft', label: 'soft felt cap with neck flap and lappets', tier: 'C', src: 'RECON', note: 'Median dress: rounded felt cap covering the ears and nape (MATERIAL_CULTURE, NOT SEEN: verify from a plate); a dome over the head with lappets and a nape flap hanging straight, chin cover not modelled (D-206, C)' },
  headband: { id: 'headband', label: 'headband', tier: 'C', src: 'RECON', note: 'workers (reconstruction)' },
  torque: { id: 'torque', label: 'torque (neck ring)', tier: 'C', src: 'RECON', note: 'neck ring worn by nobles and some guards (MATERIAL_CULTURE, NOT SEEN); gold, plain (terminals not modelled)' },
  bow: { id: 'bow', label: 'composite bow over the left shoulder', tier: 'B', src: 'SUSA-ARCH', note: 'bow carried over the shoulder by the Susa archers; shape C' },
  quiver: { id: 'quiver', label: 'quiver on the back', tier: 'B', src: 'SUSA-ARCH', note: 'large quiver on the back (glazed-brick archers); form and lid C' },
  akinaka: { id: 'akinaka', label: 'short sword (akinakes) at the right thigh', tier: 'B', src: 'ISAC-FINDS', note: 'scabbard hung at the right thigh with a lobed top and a chape (scabbard tips in the Treasury); proportions C' },
  kandys: { id: 'kandys', label: 'kandys: sleeved coat over the shoulders, sleeves empty', tier: 'B', src: 'IR-CAND', note: 'Median dress: full-length sleeved coat slung over the shoulders with empty sleeves hanging; cut, length and colour C; follows the shoulders and hips, not the arms' },
  gorytos: { id: 'gorytos', label: 'bow case (gorytos) at the left hip', tier: 'C', src: 'RECON', note: 'Median guards on the reliefs (MATERIAL_CULTURE: NOT SEEN, C)' },
  // D-199 (court setting only): the delegations' headgear on the Apadana reliefs and the king's crown
  cap_pointed: { id: 'cap_pointed', label: 'tall pointed felt cap', tier: 'B', src: 'APA-RELIEF;DB-SKUNXA', note: 'the “pointed-cap Saka” (Old Persian Sakā tigraxaudā, the royal lists: A for the name) on the Apadana E stair and the Bisitun relief (B for the form); height 0.26 m, lean and felt C; ear flaps not modelled' },
  cap_low: { id: 'cap_low', label: 'low rounded cap / wrapped headcloth', tier: 'C', src: 'APA-RELIEF;WALSER1966', note: 'the rounded or conical caps of the lowland delegations (Babylonians, Assyrians/Syrians, Lydians, Cilicians) on the Apadana reliefs (B for “a cap”; recollection of the plates, NOT SEEN: the tassels and lappets are not modelled; C form)' },
  crown: { id: 'crown', label: 'the king’s tall crown with a dentate rim', tier: 'B', src: 'APA-RELIEF;TREAS-AUD;HADISH-JAMB', note: 'the king’s tall cylindrical headdress on the Treasury audience relief and the palace door jambs (B); the dentate (crenellated) rim, height 0.2 m, the gold band and the cloth under it C' },
  body: { id: 'body', label: 'MakeHuman body (variant)', tier: 'C', src: 'RECON', note: 'MakeHuman CC0 base mesh with macro/face morphs; skin albedo procedural (D-020)' },
  // D-215 (gap audit items 21, 22; D-207): jewellery by rank, the wicker shield, the court women's crown and veil
  earrings: { id: 'earrings', label: 'gold ring earrings', tier: 'C', src: 'MATCULT-R;XEN-CYR-EYES', note: 'a plain gold hoop through each lobe (ring earrings on guards and nobles: MATERIAL_CULTURE, NOT SEEN, C; Xenophon, Cyr. 1.3.2, read: the Median court wears ornaments, a claim, B). Worn by rank (C): nobles, the king, the court women, many of the guards; the ring 18 mm across and its wire C' },
  bracelets: { id: 'bracelets', label: 'gold bracelets', tier: 'C', src: 'MATCULT-R;XEN-CYR-EYES', note: 'a gold ring at each wrist ("the bracelets on their wrists" are Median fashion: Xenophon, Cyr. 1.3.2, read, a claim: B; bracelets with animal-head terminals are known, MATERIAL_CULTURE NOT SEEN: the terminals are not modelled). Worn by rank (C)' },
  earrings_b: { id: 'earrings_b', label: 'bronze ring earrings', tier: 'C', src: 'RECON', note: 'a plain bronze hoop through each lobe: ordinary women\'s ornaments by analogy with the court\'s gold (D-207, C; no Persepolis evidence either way)' },
  bracelets_b: { id: 'bracelets_b', label: 'bronze bracelets', tier: 'C', src: 'RECON', note: 'a bronze ring at each wrist: ordinary women\'s ornaments by analogy (D-207, C)' },
  shield: { id: 'shield', label: 'wicker shield on the left arm', tier: 'C', src: 'HDT-7.41-61;MATCULT-R', note: 'the Persians\' wicker bucklers (Herodotus 7.61, read: "for shields they had wicker bucklers", a claim, B); a violin-shaped wicker shield on the Persepolis stair guards (MATERIAL_CULTURE, NOT SEEN: verify from the Apadana and Tripylon photographs). Held by the grip at its centre in the left hand, 0.8 × 0.44 m, the side notches and the wicker C. Given to a share of the Persian-dress guards, who then carry no bow or quiver (C)' },
  crown_w: { id: 'crown_w', label: 'court woman\'s crenellated crown', tier: 'C', src: 'IR-WOMEN;PAZYRYK', note: 'a crenellated ("turreted") crown: the statuette of a high-ranking Persian woman from Egypt and the Pazyryk women (IR-WOMEN, search extract: B for a crown); a low gold band 7 cm high with ten merlons, C' },
  mouth_cover: { id: 'mouth_cover', label: 'the cap\'s flaps drawn over the mouth and chin', tier: 'B', src: 'OXUS-PLAQUE', note: 'a magus in Median dress at the fire or an offering: the soft cap\'s flaps drawn over the mouth and chin (the Oxus plaques: a man holding the barsom, "his chin is covered", search extract: B; worn only then, drawn over the beard, which is hidden meanwhile; the fit C: D-209)' },
  veil: { id: 'veil', label: 'court woman\'s long veil down the back', tier: 'C', src: 'IR-WOMEN;PAZYRYK', note: 'a long veil falling from under the crown down the back (the Pazyryk women: IR-WOMEN, search extract, B for the veil); to mid-thigh, over the shoulders and the robe, fine wool in the second colour: C' },
};

// costume composition: pieces per dress; `opt` = optional per person (a bit in the person's piece mask)
export interface CostumeDef { dress: Dress; always: string[]; opt: string[] }
export const COSTUMES: Record<Dress, CostumeDef> = {
  persian: { dress: 'persian', always: ['robe_upper', 'robe_skirt', 'robe_sleeves', 'belt', 'shoes'], opt: ['hair', 'bun', 'beard_long', 'beard_short', 'hat_fluted', 'fillet', 'torque', 'quiver', 'bow', 'crown', 'earrings', 'bracelets', 'shield', 'crown_w', 'veil'] },
  // guards wear the Persian costume (the same mesh) with the bow and quiver bits always set: one draw fewer per LOD and cascade
  guard: { dress: 'guard', always: ['robe_upper', 'robe_skirt', 'robe_sleeves', 'belt', 'shoes', 'quiver', 'bow'], opt: ['hair', 'bun', 'beard_long', 'beard_short', 'hat_fluted', 'fillet', 'torque', 'earrings', 'bracelets', 'shield'] },
  // D-199, court setting only: the king wears the Persian costume's mesh with the crown bit set (as the guards, above)
  king: { dress: 'king', always: ['robe_upper', 'robe_skirt', 'robe_sleeves', 'belt', 'shoes', 'crown'], opt: ['hair', 'bun', 'beard_long', 'earrings', 'bracelets'] },
  // D-215 (gap audit item 22, BLOCKERS B20c): the women of the court on the Persian costume's mesh (as the guards and the
  // king): the many-folded robe belted at the front (IR-WOMEN: the elite woman's dress, B), the crenellated crown and the
  // long veil down the back (the Pazyryk women, B), gold at the ears and wrists; no new mesh and no new draw
  court_woman: { dress: 'court_woman', always: ['robe_upper', 'robe_skirt', 'robe_sleeves', 'belt', 'shoes', 'crown_w', 'veil'], opt: ['hair', 'earrings', 'bracelets'] },
  // D-199, court setting only: the delegations' own dress (the Apadana reliefs, research/COURT.md, src/data/delegations.json)
  // in three costumes: the long sleeved garment of the lowland peoples, the knee-length tunic of the others (trousers and
  // boots optional) and the bare-chested wrap to the knee (the Indians), each people with its own headgear and footwear
  // from the optional pieces. Their meshes are drawn only when delegates are in view (a costume with no instances is not
  // drawn). Not one costume with every piece optional: that one kept the whole body under its garments (52,444
  // triangles at full detail against the 42,000 budget; the knee-length one with an optional tunic 43,049)
  envoy: { dress: 'envoy', always: ['tunic_upper', 'dress_skirt', 'belt'], opt: ['shoes', 'hair', 'bun', 'beard_long', 'beard_short', 'cap_low', 'headband', 'fillet', 'torque'] },
  envoy_short: { dress: 'envoy_short', always: ['tunic_upper', 'tunic_skirt', 'belt'], opt: ['trousers', 'shoes', 'boots', 'hair', 'bun', 'beard_long', 'beard_short', 'cap_pointed', 'cap_low', 'headband', 'akinaka'] },
  envoy_bare: { dress: 'envoy_bare', always: ['tunic_skirt', 'belt'], opt: ['shoes', 'hair', 'bun', 'beard_long', 'beard_short', 'headband'] },
  median: { dress: 'median', always: ['tunic_upper', 'tunic_skirt', 'trousers', 'belt', 'boots'], opt: ['hair', 'bun', 'beard_long', 'beard_short', 'cap_soft', 'akinaka', 'gorytos', 'kandys', 'earrings', 'bracelets', 'mouth_cover'] },
  worker: { dress: 'worker', always: ['work_upper', 'work_skirt', 'belt'], opt: ['hair', 'beard_long', 'beard_short', 'work_trousers', 'shoes', 'headband', 'cap_soft'] },
  woman: { dress: 'woman', always: ['dress_upper', 'dress_skirt', 'belt'], opt: ['hair', 'hair_bob', 'headcloth', 'shoes', 'earrings_b', 'bracelets_b'] },
  child: { dress: 'child', always: ['child_upper', 'child_skirt'], opt: ['hair', 'shoes'] },
};
/** the built costume (one instanced mesh per LOD) a dress is drawn with */
export const COSTUME_OF: Record<Dress, Dress> = { persian: 'persian', guard: 'persian', median: 'median', worker: 'worker', woman: 'woman', child: 'child', envoy: 'envoy', envoy_short: 'envoy_short', envoy_bare: 'envoy_bare', king: 'persian', court_woman: 'persian' };
/** the costumes that are built */
export const BUILT: Dress[] = ['persian', 'median', 'worker', 'woman', 'child', 'envoy', 'envoy_short', 'envoy_bare'];
/** bit of a piece in the mask of the costume a dress is drawn with (bit 0 = always present; 0 also for pieces that are
 *  always part of that costume) */
export const pieceBit = (dress: Dress, id: string) => { const i = COSTUMES[COSTUME_OF[dress]].opt.indexOf(id); return i < 0 ? 0 : i + 1; };

/** dress for the cold (brief §9.2 "people cover up in cold"; S5 of shadow review r6, recurring from r3 S10): below
 *  COLD_C the pieces each dress already has for it go on, drawn by the crowd's existing piece mask: the Median dress's
 *  kandys, the sleeved coat (B: IR-CAND; worn against the cold, C), a working man's trousers and cap, a woman's mantle over
 *  head and shoulders (her hair then under it), a child's shoes. The Persian robe and the guards' dress have no such piece
 *  (nothing is added). The threshold is C. Returns the bits to set and the bits to clear */
export const COLD_C = 8;
const coldCache = new Map<Dress, [number, number]>();
export function coldBits(dress: Dress): [number, number] {
  let c = coldCache.get(dress); if (c) return c; const b = (id: string) => { const k = pieceBit(dress, id); return k ? 1 << k : 0; };
  const on = dress === 'median' ? b('kandys') : dress === 'worker' ? b('work_trousers') | b('cap_soft') : dress === 'woman' ? b('headcloth') : dress === 'child' ? b('shoes') : 0;
  const off = dress === 'woman' ? b('hair') | b('hair_bob') : 0; c = [on, off]; coldCache.set(dress, c); return c;
}
/** a person's piece mask for the air's temperature (°C) */
export function weatherMask(dress: Dress, mask: number, tempC: number): number { if (!(tempC < COLD_C)) return mask; const [on, off] = coldBits(dress); return (mask | on) & ~off; }

// ------------------------------------------------------------------------------------------------ piece builders
const W = (b: HBone, w = 1): [number, number] => [HB[b], w];
interface Lib { A: HumanAssets; ref: HumanVariant; J: (b: HBone) => V3 }
/** per-LOD tessellation */
const TESS = [{ tris: 1, seg: 40, ring: 18, hs: 48 }, { tris: 2, seg: 14, ring: 7, hs: 14 }, { tris: 2, seg: 8, ring: 4, hs: 8 }];

/** robe/tunic/dress upper shells: torso from the neckline to the hips, arms to a cut (fraction of the arm) */
function upperShell(L: Lib, key: string, lod: number, o: { armCut: number; hipDrop: number; neckDrop: number; thick: number; armThick: number; smooth: number; mat?: number; col?: number }) {
  const { A, ref, J } = L;
  const neckY = J('neck_01')[1] - 0.012, shoulderL = boneLen(J, 'upperarm_l', 'lowerarm_l'), foreL = boneLen(J, 'lowerarm_l', 'hand_l');
  const hipY = J('thigh_l')[1] - o.hipDrop;
  const d = regionOf(A, ref, [P.neck, ...TORSO, ...ARMS, P.thigh_l, P.thigh_r], (p) => {
    // neckline: a plane lower at the front (round neck)
    const neck = neckY - o.neckDrop * sstep(0.0, 0.1, p[2]) - p[1];
    const hip = p[1] - hipY;
    let arm = 1;
    for (const s of ['l', 'r'] as const) { if (Math.sign(p[0]) !== (s === 'l' ? 1 : -1) || Math.abs(p[0]) < 0.13) continue;
      const tu = along(J, `upperarm_${s}`, `lowerarm_${s}`, p), tf = along(J, `lowerarm_${s}`, `hand_${s}`, p);
      const ta = tu <= 1 ? tu * shoulderL : shoulderL + tf * foreL; // distance down the arm from the shoulder joint
      arm = o.armCut * (shoulderL + foreL) - ta; }
    return Math.min(neck, hip, arm);
  });
  // D-206: over the cloth hull (drape.ts: the torso bridged and hanging from the chest to the belt, the arms' sections
  // convex); the openings — neckline and cuffs — stand off the skin and turn under (a hem with thickness), the hip edge
  // under the skirt sinks in as before
  const waist = J('spine_01')[1], isArm = (i: number) => (ARMS as number[]).includes(A.part[i]);
  const opening = (p: V3, i: number) => isArm(i) || p[1] > waist;
  const g = shellGeo(A, ref, key, { tris: A.lods[TESS[lod].tris], d, ramp: 0.018, smooth: o.smooth, minOff: 0.004,
    hull: () => 1, edge: (p, i) => (opening(p, i) ? Math.min(o.thick, isArm(i) ? o.armThick : o.thick) * 0.75 : 0.0015), lip: opening,
    thick: p => (Math.abs(p[0]) > 0.16 && p[1] < J('upperarm_l')[1] - 0.03 ? o.armThick : o.thick), mat: o.mat ?? MAT.cloth_main, col: o.col ?? COL.main, prm: PRM_UPPER });
  // the material gathers the cloth above the belt (humanMaterial DRAPE): uv.y carries the height above the belt's top on
  // the torso (reference body), 1 on the arms (they hang beside the belt in the bind pose)
  const rp = g.place({ A, v: ref, J, placed: new Map() }), bt = J('spine_01')[1] + BELT_TOP;
  for (let k = 0; k < g.n; k++) g.uv[k * 2 + 1] = Math.abs(rp[k * 3]) < 0.16 ? rp[k * 3 + 1] - bt : 1;
  return g;
}
/** rings of a skirt tube: the pleats and folds run down the skirt, so rings add little; LOD0 takes 10 (it took 16: D-155
 *  spends the difference on the felt cap's full-detail shell) */
const skirtRings = (lod: number) => Math.max(3, Math.round(TESS[lod].ring * (lod === 0 ? 0.56 : 0.9)));
/** skirt from the waist to a hem height (fraction: 0 = ground … at the knee etc.), pleats */
function skirtTube(L: Lib, key: string, lod: number, o: { top: number; hem: (c: Ctx, th: number) => number; ease: number; flare: number; pleats: number; pleatAmp: number; frontPleat?: number; col?: number;
  /** D-206: drape folds all round, falling from the belt and deepening toward the hem (m; full detail only: a skirt read
   *  as a rigid cone, rubric s6) */
  folds?: number }) {
  const T = TESS[lod], rings = skirtRings(lod);
  const kneeT = 0.55;
  return tubeGeo(L.A, key, { segs: T.seg, rings, lining: 0.004,
    frame: (c, t) => { const top = c.J('spine_01')[1] + o.top, hemMid = o.hem(c, Math.PI / 2); const y = lerp(top, hemMid, t); const zc = lerp(c.J('pelvis')[2] + 0.02, c.J('calf_l')[2] - 0.01, t); return vertFrame([0, y, zc]); },
    support: { parts: [P.pelvis, P.belly, ...LEGS], slab: 0.03, running: 'max' },
    radius: (c, t, th, sup) => {
      const base = sup(th) + o.ease + o.flare * sstep(0.1, 1, t);
      // pleats: fine ripples on the sides (fabric drawn up to the belt), a box-pleat cascade at the front (C)
      const side = sstep(0.25, 0.8, Math.abs(Math.sin(th))), front = o.frontPleat ? Math.exp(-((Math.atan2(Math.sin(th), Math.cos(th))) ** 2) / 0.05) : 0;
      const rip = o.pleatAmp * sstep(0.05, 0.35, t) * (side * Math.sin(th * o.pleats) + front * (o.frontPleat ?? 0) * Math.cos(th * o.pleats * 1.5))
        + (lod === 0 ? (o.folds ?? 0) * sstep(0.08, 0.7, t) * (0.6 * Math.sin(th * 7 + 1.3) + 0.4 * Math.sin(th * 11 + 0.4)) : 0);
      // the hem: rings are placed on a straight axis; the hem line (front higher) is applied by dropping the last ring
      return base + rip;
    },
    tOf: (k, r) => k / r,
    weights: (t, th) => { const s = 0.5 - 0.5 * Math.tanh(Math.sin(th) * 4); // left share (θ 90° = the body's right, −X)
      const pel = 1 - sstep(0.0, 0.35, t), leg = 1 - pel, calf = sstep(kneeT - 0.1, kneeT + 0.25, t) * 0.6;
      return [W('pelvis', pel + 0.15 * leg), W('thigh_l', leg * s * (1 - calf)), W('thigh_r', leg * (1 - s) * (1 - calf)), W('calf_l', leg * s * calf), W('calf_r', leg * (1 - s) * calf)]; },
    // slack (D-155): the rings are skinned to both thighs, so when they turn horizontal (seated, kneeling) the cloth between
    // the knees was stretched flat into a disc; the lower and middle (front and back) cloth now drops under gravity
    slack: (t, th) => sstep(0.3, 0.85, t) * (0.35 + 0.65 * Math.abs(Math.cos(th))),
    aux: () => 1, // a skirt: the material folds its hem and fits it per person (D-189)
    mat: MAT.cloth_main, col: o.col ?? COL.main, prm: o.pleats > 20 ? 1 : 0,
  });
}
/** apply a per-θ hem height to a skirt tube's last ring (the frame places rings on a straight axis) */
function withHem(g: Geo, segs: number, rings: number, lined: boolean, hem: (c: Ctx, th: number) => number): Geo {
  const place = g.place; const nRing = segs * (rings + 1);
  g.place = (c: Ctx) => { const out = place(c); for (let layer = 0; layer < (lined ? 2 : 1); layer++) for (let k = 1; k <= rings; k++) { const f = k / rings; for (let j = 0; j < segs; j++) { const i = layer * nRing + k * segs + j; const th = (j / segs) * 2 * Math.PI; const y0 = out[(layer * nRing + j) * 3 + 1];
      const yEnd = hem(c, th), yMidEnd = hem(c, Math.PI / 2); const yLin = lerp(y0, yMidEnd, f); out[i * 3 + 1] = yLin + (yEnd - yMidEnd) * f * f; } } return out; };
  return g;
}
/** wide hanging sleeves (Persian robe): shoulder → wrist, flaring, heavier on the back of the arm (it hangs when raised) */
function robeSleeves(L: Lib, key: string, lod: number) {
  const T = TESS[lod], segs = Math.max(8, Math.round(T.seg * 0.6)), rings = Math.max(3, Math.round(T.ring * 0.6));
  const one = (s: 'l' | 'r') => {
    const up = `upperarm_${s}` as HBone, lo = `lowerarm_${s}` as HBone, ha = `hand_${s}` as HBone; const partU = s === 'l' ? P.uarm_l : P.uarm_r, partF = s === 'l' ? P.farm_l : P.farm_r;
    const split = 0.5; // t of the elbow
    return tubeGeo(L.A, `${key}_${s}`, { segs, rings, lining: 0.003,
      frame: (c, t) => { const a = c.J(up), e = c.J(lo), h = add(c.J(ha), scl(nrm(sub(c.J(ha), c.J(lo))), -0.03));
        return t < split ? segFrame(add(a, [s === 'l' ? -0.01 : 0.01, 0.01, 0]), e, t / split, [0, 0, 1]) : segFrame(e, h, (t - split) / (1 - split), [0, 0, 1]); },
      support: { parts: [partU, partF], slab: 0.02 },
      radius: (c, t, th, sup) => { const back = 0.5 - 0.5 * Math.cos(th); // θ π = back of the arm
        // folds (D-155, C): the wide sleeve hangs in soft vertical folds toward the cuff, deeper on the hanging back
        const folds = (0.004 + 0.008 * back) * sstep(0.35, 1.0, t) * Math.sin(th * 7 + t * 2.5);
        return sup(th) + 0.006 + 0.022 * sstep(0.0, 0.35, t) + (0.02 + 0.075 * back) * sstep(0.3, 1.0, t) + folds; },
      weights: t => { const k = sstep(split - 0.12, split + 0.12, t); return [W(up, 1 - k), W(lo, k)]; },
      slack: (t, th) => sstep(0.35, 1, t) * (0.25 + 0.75 * (0.5 - 0.5 * Math.cos(th))),
      mat: MAT.cloth_main, col: COL.main, prm: 2 });
  };
  return merge(`${key}`, [one('l'), one('r')]);
}
/** merge several geos into one (index offsets) */
function merge(key: string, gs: Geo[]): Geo {
  const n = gs.reduce((a, g) => a + g.n, 0); const idx: number[] = []; let off = 0;
  for (const g of gs) { for (const i of g.index) idx.push(i + off); off += g.n; }
  const out = newGeo(key, n, idx, (c: Ctx) => { const o = new Float32Array(n * 3); let k = 0; for (const g of gs) { o.set(g.place(c), k * 3); k += g.n; } return o; });
  off = 0; for (const g of gs) { out.si.set(g.si, off * 4); out.sw.set(g.sw, off * 4); out.uv.set(g.uv, off * 2); out.mat.set(g.mat, off); out.edge.set(g.edge, off); out.col.set(g.col, off); out.prm.set(g.prm, off); out.slack.set(g.slack, off); out.aux.set(g.aux, off); out.ao.set(g.ao, off); off += g.n; }
  return out;
}
/** band around the body at a height, fitted over whatever is placed there already (belts) */
function beltTube(L: Lib, key: string, lod: number, over: string[], o: { dy: number; h: number; col: number; mat: number }) {
  const T = TESS[lod], segs = Math.max(8, Math.round(T.seg * 0.8));
  const cache = { v: null as HumanVariant | null, r: [] as number[] };
  /** support function (64 θ bins) of the garments already placed under the belt, in the belt's ring plane */
  const overSupport = (c: Ctx) => { if (cache.v === c.v) return cache.r; const F = vertFrame([0, c.J('spine_01')[1] + o.dy, c.J('pelvis')[2] + 0.02]); const r = new Array(64).fill(0);
    for (const k of over) { const pp = c.placed.get(k); if (!pp) continue; for (let i = 0; i < pp.length; i += 3) { const dx = pp[i] - F.o[0], dy = pp[i + 1] - F.o[1], dz = pp[i + 2] - F.o[2]; if (Math.abs(dy) > o.h * 0.8) continue;
      const x = dx * F.u[0] + dz * F.u[2], y = dx * F.v[0] + dz * F.v[2]; for (let b = 0; b < 64; b++) { const h = x * COS64[b] + y * SIN64[b]; if (h > r[b]) r[b] = h; } } }
    cache.v = c.v; cache.r = r; return r; };
  return tubeGeo(L.A, key, { segs, rings: 2, lining: 0.004, closeTop: true,
    frame: (c, t) => vertFrame([0, c.J('spine_01')[1] + o.dy + o.h / 2 - t * o.h, c.J('pelvis')[2] + 0.02]),
    support: { parts: [P.belly, P.pelvis, P.chest], slab: 0.03 },
    radius: (c, t, th, sup) => Math.max(sup(th) + 0.019, rimAt(overSupport(c), th) + 0.005), // over the upper shell (≤ 1.3 cm) and the skirt top
    weights: () => [W('spine_01', 0.6), W('pelvis', 0.4)], mat: o.mat, col: o.col });
}
/** feet: shoes (low) or boots (to above the ankle). D-206: built as leather over a last, not as a shell of the foot: the
 *  foot shell (even moved onto the foot's convex hull) kept the mid body's coarse toes as notches and read as a bare foot
 *  with toes (the scribe-at-work report). Per foot two lofted tubes whose sections are convex by construction (the
 *  convex hull of the body's own section plus the leather): a shaft of horizontal sections from the top down to the
 *  ground over the heel and ankle, closed under the heel, its top standing off the leg and turned under (a rim); and a
 *  vamp of sections across the foot from inside the shaft to past the toes' tips, closed in a rounded toe. Where the two
 *  meet, the instep's crease. Sections are smoothed along each tube (the toes' staircase of tips tapers). C for the cut. */
function footShell(L: Lib, key: string, lod: number, top: number) {
  const S = lod === 0 ? 14 : lod === 1 ? 8 : 6, RS = lod === 0 ? 6 : lod === 1 ? 3 : 2, RF = lod === 0 ? 10 : lod === 1 ? 4 : 3;
  const one = (side: 'l' | 'r') => {
    const footP = side === 'l' ? P.foot_l : P.foot_r, calfP = side === 'l' ? P.calf_l : P.calf_r, fB = `foot_${side}` as HBone, cB = `calf_${side}` as HBone, bB = `ball_${side}` as HBone;
    // layout: shaft rings k = 0 (top) … RS (ground), S each; the rim's turned edge (S); the heel's pole; vamp rings k = 0 (in
    // the shaft) … RF (at the toes), S each; the toe's pole
    const sh = (k: number, j: number) => k * S + (((j % S) + S) % S), lipS = (j: number) => (RS + 1) * S + (((j % S) + S) % S), heel = (RS + 2) * S;
    const vm = (k: number, j: number) => heel + 1 + k * S + (((j % S) + S) % S), toe = heel + 1 + (RF + 1) * S, n = toe + 1;
    const shaftIdx: number[] = [], vampIdx: number[] = [], lipIdx: number[] = [];
    for (let k = 0; k < RS; k++) for (let j = 0; j < S; j++) { const a = sh(k, j), b = sh(k, j + 1), c = sh(k + 1, j), d = sh(k + 1, j + 1); shaftIdx.push(a, b, c, b, d, c); }
    for (let j = 0; j < S; j++) shaftIdx.push(heel, sh(RS, j + 1), sh(RS, j));
    for (let j = 0; j < S; j++) { const a = sh(0, j), b = sh(0, j + 1); lipIdx.push(a, lipS(j), b, b, lipS(j), lipS(j + 1)); }
    for (let k = 0; k < RF; k++) for (let j = 0; j < S; j++) { const a = vm(k, j), b = vm(k, j + 1), c = vm(k + 1, j), d = vm(k + 1, j + 1); vampIdx.push(a, b, c, b, d, c); }
    for (let j = 0; j < S; j++) vampIdx.push(toe, vm(RF, j), vm(RF, j + 1));
    // (a low shoe's leather a little thinner: shoes and boots of one costume must not share vertex positions, or the far
    // LOD's simplifier takes the shared vamp for seams and keeps 3 × the triangles)
    const TH = top < 0.06 ? 0.004 : 0.005, SOLE = top < 0.06 ? 0.006 : 0.0065, EASE = 0.005;
    const place = (c: Ctx) => {
      const V = c.v.pos, f = c.J(fB), cf = c.J(cB), bl = c.J(bB), out = new Float32Array(n * 3);
      const fv = partVerts(c.A, [footP]), cv = partVerts(c.A, [calfP]);
      // the shaft: horizontal sections of the calf and the rear foot (the forefoot is the vamp's)
      const yTop = f[1] + top, zCut = f[2] + 0.045, shaftR: Float32Array[] = [], shaftC: [number, number][] = [], ys: number[] = [];
      for (let k = 0; k <= RS; k++) { const y = lerp(yTop, 0.004, k / RS), xs: number[] = [], zs: number[] = []; ys.push(y);
        for (const list of [fv, cv]) for (const i of list as ArrayLike<number> as Int32Array) { if (Math.abs(V[i * 3 + 1] - y) > 0.012 || V[i * 3 + 2] > zCut) continue; xs.push(V[i * 3]); zs.push(V[i * 3 + 2]); }
        if (xs.length < 3) { shaftR.push(shaftR[k - 1] ?? new Float32Array(64).fill(0.04)); shaftC.push(shaftC[k - 1] ?? [f[0], f[2]]); continue; }
        const poly = hull2(xs, zs), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2, r = new Float32Array(64);
        for (let q = 0; q < 64; q++) { const th = (q / 64) * 2 * Math.PI; r[q] = rayToHull(poly, cx, cz, Math.sin(th), Math.cos(th)); } shaftR.push(r); shaftC.push([cx, cz]); }
      const smoothRings = (R: Float32Array[], C: [number, number][]) => { for (let it = 0; it < 2; it++) { const R2 = R.map((r, k) => r.map((x, q) => Math.max(x, (R[Math.max(0, k - 1)][q] + 2 * x + R[Math.min(R.length - 1, k + 1)][q]) / 4)));
        const C2 = C.map((cc, k) => [0, 1].map(e => (C[Math.max(0, k - 1)][e] + 2 * cc[e] + C[Math.min(C.length - 1, k + 1)][e]) / 4) as [number, number]); R.splice(0, R.length, ...R2); C.splice(0, C.length, ...C2); } };
      smoothRings(shaftR, shaftC);
      const rAt = (r: Float32Array, th: number) => { const fq = ((((th / (2 * Math.PI)) % 1) + 1) % 1) * 64, q0 = Math.floor(fq) % 64, t = fq - Math.floor(fq); return r[q0] * (1 - t) + r[(q0 + 1) % 64] * t; };
      for (let k = 0; k <= RS; k++) for (let j = 0; j < S; j++) { const th = (j / S) * 2 * Math.PI, rr = rAt(shaftR[k], th) + TH + (k === 0 ? EASE : EASE * 0.5);
        out.set([shaftC[k][0] + Math.sin(th) * rr, ys[k], shaftC[k][1] + Math.cos(th) * rr], sh(k, j) * 3); }
      for (let j = 0; j < S; j++) { const th = (j / S) * 2 * Math.PI, rr = rAt(shaftR[0], th) + 0.0015; out.set([shaftC[0][0] + Math.sin(th) * rr, ys[0] - 0.004, shaftC[0][1] + Math.cos(th) * rr], lipS(j) * 3); }
      out.set([shaftC[RS][0], 0.0, shaftC[RS][1]], heel * 3);
      // the vamp: sections across the foot's direction (heel → ball, level), from inside the shaft to the toes' tips
      const w: V3 = nrm([bl[0] - f[0], 0, bl[2] - f[2]]), up: V3 = [0, 1, 0], vv: V3 = cross(w, up), A0: V3 = [f[0], 0, f[2]];
      let Lt = 0; for (const i of fv as Int32Array) Lt = Math.max(Lt, (V[i * 3] - A0[0]) * w[0] + (V[i * 3 + 2] - A0[2]) * w[2]);
      const vampR: Float32Array[] = [], vampC: [number, number][] = [], ds: number[] = [];
      for (let k = 0; k <= RF; k++) { const d = lerp(0.02, Lt - 0.002, 1 - (1 - k / RF) ** 1.7), as: number[] = [], bs: number[] = []; ds.push(d);
        for (const i of fv as Int32Array) { const px = V[i * 3] - A0[0], py = V[i * 3 + 1], pz = V[i * 3 + 2] - A0[2]; if (Math.abs(px * w[0] + pz * w[2] - d) > 0.011) continue; as.push(px * vv[0] + pz * vv[2]); bs.push(py); }
        if (as.length < 3) { vampR.push(vampR[k - 1] ?? new Float32Array(64).fill(0.02)); vampC.push(vampC[k - 1] ?? [0, 0.03]); continue; }
        const poly = hull2(as, bs), ca = (Math.min(...as) + Math.max(...as)) / 2, cb = (Math.min(...bs) + Math.max(...bs)) / 2, r = new Float32Array(64);
        for (let q = 0; q < 64; q++) { const th = (q / 64) * 2 * Math.PI; r[q] = rayToHull(poly, ca, cb, Math.cos(th), Math.sin(th)); } vampR.push(r); vampC.push([ca, cb]); }
      smoothRings(vampR, vampC);
      // the toe box: from the ball forward the sides keep the ball's width (the toes' staircase of tips made a point) and
      // the last 4 cm round off as an ellipse; the centre drifts only half way toward the big toe
      { const dB = (bl[0] - A0[0]) * w[0] + (bl[2] - A0[2]) * w[2], dT = Lt - 0.04; let kB = 0; for (let k = 0; k <= RF; k++) if (ds[k] <= dB) kB = k;
        for (let k = kB + 1; k <= RF; k++) { const ell = ds[k] > dT ? Math.sqrt(Math.max(0.05, 1 - ((ds[k] - dT) / (Lt - dT)) ** 2)) : 1;
          vampC[k] = [vampC[kB][0] + (vampC[k][0] - vampC[kB][0]) * 0.5, vampC[k][1]];
          vampR[k] = vampR[k].map((x, q) => { const cs = Math.cos((q / 64) * 2 * Math.PI) ** 2; return Math.max(x, (vampR[k - 1][q] * cs + x * (1 - cs)) * ell); }); } }
      for (let k = 0; k <= RF; k++) for (let j = 0; j < S; j++) { const th = (j / S) * 2 * Math.PI, rr = rAt(vampR[k], th) + (Math.sin(th) < -0.5 ? SOLE : TH), a = vampC[k][0] + Math.cos(th) * rr, bb = Math.max(-0.002, vampC[k][1] + Math.sin(th) * rr);
        out.set([A0[0] + w[0] * ds[k] + vv[0] * a, bb, A0[2] + w[2] * ds[k] + vv[2] * a], vm(k, j) * 3); }
      out.set([A0[0] + w[0] * (Lt + TH) + vv[0] * vampC[RF][0], Math.max(0.004, vampC[RF][1] - 0.004), A0[2] + w[2] * (Lt + TH) + vv[2] * vampC[RF][0]], toe * 3);
      return out;
    };
    // wind each part outward (checked on the reference body): the shaft and vamp away from their axes, the rim's edge up
    const refOut = place({ A: L.A, v: L.ref, J: L.J, placed: new Map() });
    const facing = (idx: number[], dirOf: (p: V3) => V3) => { let s2 = 0; for (let t = 0; t < idx.length; t += 3) { const [a, b, cc] = [idx[t], idx[t + 1], idx[t + 2]].map(i => [refOut[i * 3], refOut[i * 3 + 1], refOut[i * 3 + 2]] as V3); const nn = cross(sub(b, a), sub(cc, a)), m: V3 = scl(add(add(a, b), cc), 1 / 3); s2 += dot(nn, dirOf(m)); } return s2; };
    const fJ = L.J(fB), flip = (idx: number[]) => { for (let t = 0; t < idx.length; t += 3) { const x = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = x; } };
    if (facing(shaftIdx, m => [m[0] - fJ[0], 0, m[2] - fJ[2]]) < 0) flip(shaftIdx);
    if (facing(vampIdx, m => [m[0] - fJ[0], m[1] - 0.03, m[2] - fJ[2]]) < 0) flip(vampIdx);
    if (facing(lipIdx, () => [0, 1, 0]) < 0) flip(lipIdx);
    const g = newGeo(`${key}_${side}`, n, [...shaftIdx, ...lipIdx, ...vampIdx], place);
    const ballD = (() => { const b = L.J(bB), w: V3 = nrm([b[0] - fJ[0], 0, b[2] - fJ[2]]); return (b[0] - fJ[0]) * w[0] + (b[2] - fJ[2]) * w[2]; })();
    for (let i = 0; i < n; i++) {
      if (i < heel + 1) { const k = i === heel ? RS : i >= (RS + 1) * S ? 0 : Math.floor(i / S), y = lerp(fJ[1] + top, 0.004, k / RS), wc = sstep(fJ[1], fJ[1] + 0.08, y); setW(g, i, [W(cB, wc), W(fB, 1 - wc)]); g.uv[i * 2] = (i % S) / S; g.uv[i * 2 + 1] = k / RS; if (i >= (RS + 1) * S && i < heel) { g.ao[i] = 150; g.edge[i] = 0; } }
      else { const k = i === toe ? RF : Math.floor((i - heel - 1) / S), d = lerp(0.02, 0.2, k / RF), wb = sstep(ballD - 0.03, ballD + 0.01, d); setW(g, i, [W(fB, 1 - wb), W(bB, wb)]); g.uv[i * 2] = ((i - heel - 1) % S) / S; g.uv[i * 2 + 1] = k / RF; }
    }
    setMat(g, MAT.leather, COL.leather, 0);
    return g;
  };
  return merge(key, [one('l'), one('r')]);
}
/** legs: trousers from the hips to above the ankle */
function trouserShell(L: Lib, key: string, lod: number, col: number) {
  const { A, ref, J } = L;
  const d = regionOf(A, ref, [P.pelvis, ...LEGS, P.foot_l, P.foot_r], p => Math.min(J('spine_01')[1] - 0.03 - p[1], p[1] - (J('foot_l')[1] + 0.07)));
  return shellGeo(A, ref, key, { tris: A.lods[TESS[lod].tris], d, ramp: 0.015, thick: () => 0.007, smooth: 2, minOff: 0.004, mat: MAT.cloth_second, col });
}
/** scalp hair: shell over the scalp mask; thicker on the crown and at the back */
function hairShell(L: Lib, key: string, lod: number, bob: boolean) {
  const { A, ref, J } = L; const eyeY = ref.eyeY, jaw = J('jaw'), hz = J('head')[2];
  const d = regionOf(A, ref, [P.head, P.neck], (p, i) => {
    const m = (A.scalp[i] - 0.45) * 0.05;
    // sideburns: the hair comes down in front of the ear to about the ear canal (the baked scalp mask stops at the
    // temple, which left bald-looking temples under hats and bands in the first close-ups)
    const side = Math.max(Math.min(Math.abs(p[0]) - 0.058, hz + 0.068 - p[2], p[2] - (hz + 0.022), p[1] - (eyeY - 0.035)),
      Math.min(Math.abs(p[0]) - 0.045, hz - 0.036 - p[2], p[1] - (eyeY - 0.045))); // and behind the ear (clear of the pinna)
    if (!bob) return Math.max(m, side);
    // bob: the hair falls to the jaw line behind the front edge of the ears
    const bobD = p[2] < hz + 0.035 ? Math.min(p[1] - (jaw[1] - 0.02), 0.02) : -1;
    return Math.max(m, side, bobD); });
  return shellGeo(A, ref, key, { tris: A.lods[lod === 0 ? 0 : TESS[lod].tris], d, ramp: 0.008, smooth: lod === 0 ? 5 : 3, minOff: 0.004,
    thick: p => 0.006 + 0.008 * sstep(eyeY + 0.02, eyeY + 0.1, p[1]) + (bob ? 0.01 : 0.004) * sstep(0.05, -0.04, p[2] - J('head')[2]), mat: MAT.hair, col: COL.hair, prm: 0 });
}
/** hair gathered at the nape: an ellipsoid over the back of the neck (Persian and Median men) */
function bunGeo(L: Lib, key: string, lod: number) {
  const T = TESS[lod], segs = Math.max(8, Math.round(T.seg * 0.6)), rings = Math.max(4, Math.round(T.ring * 0.6));
  const centre = (c: Ctx): V3 => { const h = c.J('head'), n = c.J('neck_01'); // back of the neck below the skull
    const y = lerp(n[1], h[1], 0.35); let zb = 1; for (let i = 0; i < c.A.NO; i++) { const pt = c.A.part[i]; if (pt !== P.head && pt !== P.neck) continue; if (Math.abs(c.v.pos[i * 3 + 1] - y) > 0.012 || Math.abs(c.v.pos[i * 3]) > 0.03) continue; zb = Math.min(zb, c.v.pos[i * 3 + 2]); }
    return [0, y + 0.005, zb + 0.012]; };
  const R: V3 = [0.068, 0.05, 0.036];
  return tubeGeo(L.A, key, { segs, rings, capStart: true, capEnd: true,
    frame: (c, t) => { const o = centre(c); return { o: [o[0], o[1] + R[1] * Math.cos(Math.PI * t), o[2]], u: [0, 0, -1], v: [1, 0, 0], w: [0, -1, 0] }; },
    radius: (c, t, th) => { const s = Math.sin(Math.PI * t); const a = R[2] * s * (Math.cos(th) > 0 ? 1 : 0.35), b = R[0] * s; return (a * b) / Math.hypot(b * Math.cos(th), a * Math.sin(th)) + 1e-4; },
    weights: t => [W('head', 1 - 0.5 * t), W('neck_01', 0.5 * t)], mat: MAT.hair, col: COL.hair, prm: 1 });
}
/** face measurements on the reference body: mouth line (the most recessed midline point between nose and chin), lip plane,
 *  head half-width at eye height; render indices of the chin and nose-tip landmarks */
function faceGeom(L: Lib) {
  const { A, ref } = L; const rvOf = (pid: number) => { for (let i = 0; i < A.NO; i++) if (A.orig[i] === pid) return i; return 0; };
  const chinI = rvOf(A.meta.landmarks.chin), noseI = rvOf(A.meta.landmarks.nose_tip);
  const cy = ref.pos[chinI * 3 + 1], ny = ref.pos[noseI * 3 + 1], nz = ref.pos[noseI * 3 + 2];
  // the lips' parting: where the midline front vertices change from head-weighted (upper lip) to jaw-weighted (lower lip)
  // (the most recessed point finds the mentolabial sulcus on MakeHuman's closed mouth, 1.5–2 cm too low)
  let upLow = Infinity, loHigh = -Infinity, best = 1e9;
  for (let i = 0; i < A.NO; i++) { if (A.part[i] !== P.head) continue; const x = ref.pos[i * 3], y = ref.pos[i * 3 + 1], z = ref.pos[i * 3 + 2];
    if (Math.abs(x) > 0.0025 || y < cy || y > ny - 0.01 || z < nz - 0.03) continue;
    let w = 0; for (let k = 0; k < 4; k++) if (A.skinIndex[i * 4 + k] === HB.jaw) w = A.skinWeight[i * 4 + k] / 255;
    if (w < 0.3) upLow = Math.min(upLow, y); else if (w > 0.5) loHigh = Math.max(loHigh, y); best = Math.min(best, z); }
  const mouthY = Number.isFinite(upLow) && Number.isFinite(loHigh) ? (upLow + loHigh) / 2 : (cy + ny) / 2;
  let halfW = 0; for (let i = 0; i < A.NO; i++) if (A.part[i] === P.head && Math.abs(ref.pos[i * 3 + 1] - ref.eyeY) < 0.015) halfW = Math.max(halfW, Math.abs(ref.pos[i * 3]));
  return { chinI, noseI, mouthY, lipZ: best, halfW };
}
/** full-beard region 0..1 per render vertex (cheeks below the cheekbone line, moustache under the nose, chin, jaw and
 *  under-chin; the lips stay bare). The D-020 baked mask bounded the beard by the jaw JOINT's height (near the ear), which
 *  left the chin bare, so the region is rebuilt here from the face measurements (C: the shape of the carved beards). */
const BEARD_CACHE = new WeakMap<HumanAssets, Float32Array>();
export function beardMask(L: Lib): Float32Array {
  const { A, ref, J } = L; const hit = BEARD_CACHE.get(A); if (hit) return hit;
  const F = faceGeom(L); const out = new Float32Array(A.NO);
  const noseY = ref.pos[F.noseI * 3 + 1], eyeY = ref.eyeY;
  for (let i = 0; i < A.NO; i++) { const pt = A.part[i]; if (pt !== P.head && pt !== P.neck) continue; const x = ref.pos[i * 3], y = ref.pos[i * 3 + 1], z = ref.pos[i * 3 + 2], ax = Math.abs(x);
    // under the nose in the middle (the subnasale: the moustache covers the philtrum and the top of the upper lip, as on
    // the reliefs; the first version stopped 1 cm lower and left a clean-shaven upper lip), the cheekbone line at the sides
    const cheekLine = lerp(noseY - 0.008, eyeY - 0.03, sstep(0.018, 0.05, ax));
    const dy = y - F.mouthY, lips = (Math.hypot(x / 0.026, dy / (dy > 0 ? 0.006 : 0.0125)) - 1) * 0.012; // outside the lips > 0
    const d = Math.min(cheekLine - y, z - (J('jaw')[2] - 0.012), y - (J('neck_01')[1] - 0.005), F.halfW - 0.004 - ax, lips);
    out[i] = sstep(-0.003, 0.005, d); }
  BEARD_CACHE.set(A, out); return out;
}
/** Per-vertex extras of the body's render vertices (humanFormat: the bytes garments use for slack and the cut-line ramp),
 *  measured on the reference body (same topology for every variant; D-155):
 *   skin — hy: scalp-hair mask (the bake's), hw: |mean curvature| over the 1-ring, smoothed, 0..SKIN_CURV_MAX 1/m
 *          (the diffusion wrap widens where the surface bends: nose, lips, ears, eyelids);
 *   eye  — hy, hw: planar coordinates from the eye joint (bind frame; 0.5 = the eye's axis, ±0.5 = ±EYE_UNIT);
 *   lash — hy: root (0) → tip (1) across the lash strip (from the strip's UV rows, per stretch of the lid); hw: 1 on the
 *          lower lid's strip. */
const EXTRA_CACHE = new WeakMap<HumanAssets, { hy: Uint8Array; hw: Uint8Array }>();
export function bodyExtras(L: Lib) {
  const { A, ref, J } = L; const hit = EXTRA_CACHE.get(A); if (hit) return hit;
  const hy = new Uint8Array(A.NO), hw = new Uint8Array(A.NO), q8 = (x: number) => Math.round(255 * clamp(x));
  // curvature per position vertex
  const NP = A.NP, P = new Float64Array(NP * 3), N = new Float64Array(NP * 3), nb: number[][] = Array.from({ length: NP }, () => []);
  for (let i = 0; i < A.NO; i++) { const p = A.orig[i]; for (let k = 0; k < 3; k++) { P[p * 3 + k] = ref.pos[i * 3 + k]; N[p * 3 + k] = ref.nrm[i * 3 + k]; } }
  const tris = A.lods[0];
  for (let t = 0; t < tris.length; t += 3) { if (A.part[tris[t]] >= PART.eye) continue; for (let e = 0; e < 3; e++) { const a = A.orig[tris[t + e]], b = A.orig[tris[t + (e + 1) % 3]]; if (a === b) continue; if (!nb[a].includes(b)) nb[a].push(b); if (!nb[b].includes(a)) nb[b].push(a); } }
  let kap = new Float64Array(NP);
  for (let p = 0; p < NP; p++) { const L1 = nb[p]; if (!L1.length) continue; let s = 0;
    for (const q of L1) { const dx = P[p * 3] - P[q * 3], dy = P[p * 3 + 1] - P[q * 3 + 1], dz = P[p * 3 + 2] - P[q * 3 + 2], d2 = dx * dx + dy * dy + dz * dz || 1e-12; s += (2 * (N[p * 3] * dx + N[p * 3 + 1] * dy + N[p * 3 + 2] * dz)) / d2; }
    kap[p] = Math.abs(s / L1.length); }
  for (let it = 0; it < 2; it++) { const nk = new Float64Array(NP); for (let p = 0; p < NP; p++) { const L1 = nb[p]; if (!L1.length) { nk[p] = kap[p]; continue; } let s = 0; for (const q of L1) s += kap[q]; nk[p] = 0.5 * kap[p] + 0.5 * s / L1.length; } kap = nk; }
  // lash strips: per strip (upper: v < 0.955), per stretch of the lid (u bins), the root row is the smallest (upper) or
  // largest (lower) v and the tip row the other end
  const bins = 14, u0 = 0.704, u1 = 0.762, vr: [number, number][][] = [0, 1].map(() => Array.from({ length: bins }, () => [9, -9] as [number, number]));
  const binOf = (u: number) => Math.max(0, Math.min(bins - 1, Math.floor(((u - u0) / (u1 - u0)) * bins)));
  for (let i = 0; i < A.NO; i++) if (A.part[i] === PART.lash) { const s = A.uv[i * 2 + 1] > 0.955 ? 1 : 0, r = vr[s][binOf(A.uv[i * 2])], v = A.uv[i * 2 + 1]; r[0] = Math.min(r[0], v); r[1] = Math.max(r[1], v); }
  for (let i = 0; i < A.NO; i++) {
    const pt = A.part[i];
    if (pt < PART.eye) { hy[i] = q8(A.scalp[i]); hw[i] = q8(kap[A.orig[i]] / SKIN_CURV_MAX); }
    else if (pt === PART.eye) { const c = J(ref.pos[i * 3] > 0 ? 'eye_l' : 'eye_r'); hy[i] = q8(0.5 + (ref.pos[i * 3] - c[0]) / (2 * EYE_UNIT)); hw[i] = q8(0.5 + (ref.pos[i * 3 + 1] - c[1]) / (2 * EYE_UNIT)); }
    else if (pt === PART.lash) { const s = A.uv[i * 2 + 1] > 0.955 ? 1 : 0, r = vr[s][binOf(A.uv[i * 2])], v = A.uv[i * 2 + 1], span = Math.max(1e-4, r[1] - r[0]);
      hy[i] = q8(s ? (r[1] - v) / span : (v - r[0]) / span); hw[i] = s ? 255 : 0; }
  }
  const out = { hy, hw }; EXTRA_CACHE.set(A, out); return out;
}
/** beard: a shell over the beard region plus (long) a squared mass hanging from the chin to the upper chest */
function beardGeo(L: Lib, key: string, lod: number, long: boolean) {
  const { A, ref } = L; const bm = beardMask(L);
  const d = regionOf(A, ref, [P.head, P.neck], (p, i) => (bm[i] - 0.4) * 0.05);
  const shell = shellGeo(A, ref, `${key}_shell`, { tris: A.lods[lod === 0 ? 0 : TESS[lod].tris], d, ramp: long ? 0.008 : 0.011, smooth: lod === 0 ? 4 : 2, minOff: 0.003, // a wider ramp: the short beard thins over ~1 cm at its edge (D-155)
    thick: p => (long ? 0.01 : 0.0035) + (long ? 0.012 : 0.002) * sstep(ref.eyeY - 0.06, ref.eyeY - 0.12, p[1]), mat: MAT.hair, col: COL.hair, prm: 2 }); // short: 3.5 mm (was 5: its cut edges read as blobs)
  if (!long) return shell;
  const T = TESS[lod], segs = Math.max(8, Math.round(T.seg * 0.6)), rings = Math.max(3, Math.round(T.ring * 0.5));
  const { chinI, noseI } = faceGeom(L);
  const LEN = 0.12; // below the chin (C: the carved beards reach the upper chest)
  const mass = tubeGeo(A, `${key}_mass`, { segs, rings, capEnd: true,
    frame: (c, t) => { const ch: V3 = [c.v.pos[chinI * 3], c.v.pos[chinI * 3 + 1], c.v.pos[chinI * 3 + 2]], no: V3 = [0, c.v.pos[noseI * 3 + 1], c.v.pos[noseI * 3 + 2]];
      const top: V3 = [0, lerp(ch[1], no[1], 0.3), ch[2] - 0.03];
      const by = ch[1] - LEN, chest = frontZ(c, by); // the bottom hangs clear of the chest (robe ~1.5 cm)
      const bot: V3 = [0, by, Math.max(ch[2] - 0.01, chest + 0.015 + 0.03)];
      const w = nrm(sub(bot, top)), u = nrm(cross([-1, 0, 0], w)); // u × v = w with v = −X
      return { o: add(top, scl(sub(bot, top), t)), u, v: [-1, 0, 0], w }; },
    radius: (c, t, th) => { // rounded rectangle: half-width 5 cm → 4.2 cm at the bottom, half-depth 2.8 cm (front) / 3.5 cm (back, over the neck)
      const hw = lerp(0.052, 0.042, t), hd = Math.cos(th) > 0 ? lerp(0.032, 0.026, t) : 0.036, ct = Math.cos(th), st = Math.sin(th), p = 6;
      const r = 1 / Math.pow(Math.pow(Math.abs(ct) / hd, p) + Math.pow(Math.abs(st) / hw, p), 1 / p);
      const lumpy = 1 + 0.07 * Math.sin(th * 5 + t * 7.3) * Math.sin(t * 13.1 + th * 3) + 0.04 * Math.sin(th * 11 + t * 21); // locks, not a block (C)
      return r * lumpy * (t > 0.85 ? 1 - 0.5 * sstep(0.85, 1, t) ** 2 : 1); },
    weights: t => [W('jaw', 0.7 - 0.3 * t), W('head', 0.3 + 0.1 * t), W('neck_01', 0.2 * t)], mat: MAT.hair, col: COL.hair, prm: 3 }); // prm 3: the hanging mass (wavy locks in the court dressing)
  return merge(key, [shell, mass]);
}
/** a hat as a lathe around the head's vertical axis from a rim ring fitted to the head (support function) */
/** rim plane around the head at eye height + dy, lower at the back by `tilt` (rad): u front, v the body's left, w = u × v up */
function headRingFrame(c: Ctx, dy: number, tilt: number): Frame {
  const h = c.J('head'), y = c.v.eyeY + dy;
  const u: V3 = [0, Math.sin(tilt), Math.cos(tilt)], v: V3 = [1, 0, 0];
  return { o: [0, y, h[2] + 0.055], u, v, w: cross(u, v) };
}
/** support radius of the head in a rim plane, per θ bin (cached per variant) */
function headRim(c: Ctx, F: Frame, slab: number, cache: { v: HumanVariant | null; r: number[] }) {
  if (cache.v === c.v) return cache.r; const B = 64, r = new Array(B).fill(0.05);
  for (const i of partVerts(c.A, [P.head])) { const d = sub([c.v.pos[i * 3], c.v.pos[i * 3 + 1], c.v.pos[i * 3 + 2]], F.o); if (Math.abs(dot(d, F.w)) > slab) continue; const x = dot(d, F.u), y = dot(d, F.v);
    for (let b = 0; b < B; b++) { const th = (b / B) * 2 * Math.PI, h = x * Math.cos(th) + y * Math.sin(th); if (h > r[b]) r[b] = h; } }
  cache.v = c.v; cache.r = r; return r;
}
const rimAt = (r: number[], th: number) => { const B = r.length, f = ((((th / (2 * Math.PI)) % 1) + 1) % 1) * B, b0 = Math.floor(f) % B, a = f - Math.floor(f); return r[b0] * (1 - a) + r[(b0 + 1) % B] * a; };
/** fitted fluted hat: rim radius from the head at the rim plane + 5 mm, flaring 8 % to the top, fluted */
function flutedHatFitted(L: Lib, key: string, lod: number) {
  const T = TESS[lod], segs = T.hs, rings = Math.max(2, Math.round(T.ring * 0.35)), flutes = 18, H = 0.14;
  const cache = { v: null as HumanVariant | null, r: [] as number[] };
  return tubeGeo(L.A, key, { segs, rings, lining: 0.004, capEnd: true,
    frame: (c, t) => { const F = headRingFrame(c, 0.045, 0.12); return { ...F, o: add(F.o, scl(F.w, -0.012 + (H + 0.012) * t)) }; },
    radius: (c, t, th) => { const r = headRim(c, headRingFrame(c, 0.045, 0.12), 0.008, cache);
      // flutes (vertical grooves), of uneven depth as felt shaped by hand (D-155: the even flutes read as a paper cup), and
      // the top's edge rounded over
      const fi = Math.floor(((th / (2 * Math.PI)) * flutes + 0.5 + flutes) % flutes), depth = 0.0065 + 0.005 * ((Math.sin(fi * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const fl = Math.min(depth, 0.004 + 0.012 * t) * Math.abs(Math.sin(th * flutes / 2)) * sstep(0.03, 0.14, t) * (1 - 0.6 * sstep(0.9, 1, t)); // never inside the rim
      return rimAt(r, th) + 0.006 + 0.012 * t - fl - 0.012 * sstep(0.88, 1, t) ** 2; },
    // the crown slightly domed
    capLift: 0.012,
    weights: () => [W('head', 1)], mat: MAT.felt, col: COL.felt, prm: 1 });
}
/** torus-like band around the head (fillet, headband) */
function headBand(L: Lib, key: string, lod: number, o: { dy: number; w: number; t: number; twisted: boolean; col: number; gap?: number }) {
  const T = TESS[lod], segs = Math.max(8, T.hs);
  const cache = { v: null as HumanVariant | null, r: [] as number[] };
  return tubeGeo(L.A, key, { segs, rings: 2, lining: 0.003, closeTop: true,
    frame: (c, t) => { const F = headRingFrame(c, o.dy, 0.15); return { ...F, o: add(F.o, scl(F.w, (t - 0.5) * o.w)) }; },
    // a wrapped strip, not a lathe: small irregular lumps and creases along it (a perfect torus read as a plastic ring, D-155)
    radius: (c, t, th) => { const r = headRim(c, headRingFrame(c, o.dy, 0.15), 0.01, cache); return rimAt(r, th) + (o.gap ?? 0.006) + (o.twisted ? 0.003 * Math.sin(th * 30 + t * 3) : 0.0012 * Math.sin(th * 7 + 0.7) * Math.sin(Math.PI * t) + 0.0007 * Math.sin(th * 19 + t * 5)) + o.t * Math.sin(Math.PI * t); },
    weights: () => [W('head', 1)], mat: MAT.cloth_trim, col: o.col, prm: o.twisted ? 3 : 0 });
}
/** D-199: the tall pointed felt cap of the Saka (Sakā tigraxaudā): a cone from a rim fitted to the head (as the fluted
 *  hat's) to a point 0.26 m above it, leaning back a little and drooping at the tip (B form, C sizes) */
function pointedCap(L: Lib, key: string, lod: number) {
  const T = TESS[lod], segs = Math.max(8, Math.round(T.hs * 0.6)), rings = Math.max(3, Math.round(T.ring * 0.5)), H = 0.26;
  const cache = { v: null as HumanVariant | null, r: [] as number[] };
  return tubeGeo(L.A, key, { segs, rings, lining: 0.004, capEnd: true,
    frame: (c, t) => { const F = headRingFrame(c, 0.035, 0.18); return { ...F, o: add(add(F.o, scl(F.w, -0.012 + (H + 0.012) * t)), scl(F.u, -0.045 * t * t)) }; },
    radius: (c, t, th) => { const r = headRim(c, headRingFrame(c, 0.035, 0.18), 0.008, cache); return (rimAt(r, th) + 0.008) * (1 - 0.97 * Math.pow(t, 1.15)) + 0.004 * Math.sin(th * 5 + t * 3) * (1 - t); },
    weights: () => [W('head', 1)], mat: MAT.felt, col: COL.felt, prm: 0 });
}
/** D-199: a low rounded cap or wrapped cloth cap (the lowland delegations' caps on the Apadana reliefs: C form): 0.1 m, the
 *  sides drawn in toward a rounded top, in the second garment colour */
function lowCap(L: Lib, key: string, lod: number) {
  const T = TESS[lod], segs = Math.max(8, Math.round(T.hs * 0.6)), rings = Math.max(2, Math.round(T.ring * 0.35)), H = 0.1;
  const cache = { v: null as HumanVariant | null, r: [] as number[] };
  return tubeGeo(L.A, key, { segs, rings, lining: 0.004, capEnd: true, capLift: 0.01,
    frame: (c, t) => { const F = headRingFrame(c, 0.035, 0.12); return { ...F, o: add(F.o, scl(F.w, -0.012 + (H + 0.012) * t)) }; },
    radius: (c, t, th) => { const r = headRim(c, headRingFrame(c, 0.035, 0.12), 0.008, cache); return (rimAt(r, th) + 0.009) * (1 - 0.35 * sstep(0.35, 1, t)) + 0.002 * Math.sin(th * 9 + t * 5); },
    weights: () => [W('head', 1)], mat: MAT.cloth_second, col: COL.second, prm: 0 });
}
/** D-199: the king's crown: a tall cylinder fitted to the head, flaring a little, its rim cut into steps (the dentate
 *  top: C) with a gold band at the brow (the band C) */
function crownGeo(L: Lib, key: string, lod: number) {
  const segs = lod === 0 ? 36 : lod === 1 ? 12 : 6, rings = lod === 0 ? 5 : 2, H = 0.2, teeth = 12; // (the court setting's king only: lean at the far LODs, which every Persian-dress person carries collapsed)
  const cache = { v: null as HumanVariant | null, r: [] as number[] };
  const F0 = (c: Ctx) => headRingFrame(c, 0.045, 0.1);
  const body = tubeGeo(L.A, `${key}_body`, { segs, rings, lining: 0.004, capEnd: true,
    frame: (c, t) => { const F = F0(c); return { ...F, o: add(F.o, scl(F.w, -0.012 + (H + 0.012) * t)) }; },
    // the dentate rim: in the top eighth the gaps between the teeth are drawn in (a notch seen against the sky; C)
    radius: (c, t, th) => { const r = headRim(c, F0(c), 0.008, cache), tooth = Math.cos(th * teeth) > 0 ? 1 : 0; return rimAt(r, th) + 0.007 + 0.014 * t - (1 - tooth) * 0.018 * sstep(0.86, 0.9, t); },
    weights: () => [W('head', 1)], mat: MAT.felt, col: COL.felt, prm: 1 });
  if (lod > 0) return body; // (the band only close up)
  const band = headBand(L, `${key}_band`, lod, { dy: 0.05, w: 0.03, t: 0.004, twisted: false, col: COL.fixed, gap: 0.009 });
  band.mat.fill(MAT.metal); band.prm.fill(METAL.gold);
  return merge(key, [body, band]);
}
/** soft felt cap over the cranium, the ears (lappets to the jaw) and the nape, domed on top (Median dress, C).
 *  D-206: a dome of its own (the head's rounded hull, drape.ts headHull, plus the felt), not a shell of the head's
 *  surface: the shell copied the pinna (a bald head with an ear, the scribe-at-work report), and moved onto a hull its
 *  folded surface (the pinna's front and back and the skull behind it) folded over itself. Rings of latitude about the
 *  cranium's centre from the crown to a rim that follows the old cut (over the brow, lappets over the ears to 3.5 cm
 *  below the jaw joint, a flap down the nape), found per body on the hull; felt 1.2 cm over the hull at the sides
 *  (hair under it) and 4.2 cm at the crown as before, thinning to 6 mm at the rim, whose edge turns under to the
 *  hull (a blunt felt edge). D-155's centre seam and felt fibre are shading (prm 0). */
function softCap(L: Lib, key: string, lod: number) {
  const S = lod === 0 ? 56 : lod === 1 ? 20 : 12, R = lod === 0 ? 18 : lod === 1 ? 7 : 4, n = 1 + R * S + S;
  const vid = (k: number, j: number) => (k === 0 ? 0 : 1 + (k - 1) * S + (((j % S) + S) % S)), lipId = (j: number) => 1 + R * S + (((j % S) + S) % S);
  const idx: number[] = [];
  for (let j = 0; j < S; j++) idx.push(0, vid(1, j), vid(1, j + 1));
  for (let k = 1; k < R; k++) for (let j = 0; j < S; j++) { const a = vid(k, j), b = vid(k, j + 1), c = vid(k + 1, j), d = vid(k + 1, j + 1); idx.push(a, c, b, b, c, d); }
  for (let j = 0; j < S; j++) { const a = vid(R, j), b = vid(R, j + 1); idx.push(a, lipId(j), b, b, lipId(j), lipId(j + 1)); }
  const lonOf = (j: number) => (j / S) * 2 * Math.PI - Math.PI, dirOf = (lat: number, lon: number): V3 => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  const HALF = Math.PI / 2, DROP = 0.09; // the arc parameter s: 0 at the crown, π/2 at the cranium's centre height, then m of drop / DROP
  const g = newGeo(key, n, idx, (c: Ctx) => {
    const H = headHull(c.A, c.v), eyeY = c.v.eyeY, hz = c.J('head')[2], jawY = c.J('jaw')[1], neckY = c.J('neck_01')[1];
    const inside = (p: V3) => p[1] > eyeY + 0.028 - 0.012 * sstep(0.03, 0.06, Math.abs(p[0])) // over the brow
      || Math.abs(p[0]) > 0.052 && p[2] < hz + 0.075 && p[1] > jawY - 0.035 // lappets over the ears to the jaw
      || p[2] < hz + 0.02 && p[1] > neckY + 0.01; // the flap down the back of the neck
    const thick = (y: number) => 0.012 + 0.03 * sstep(eyeY + 0.02, eyeY + 0.14, y) + 0.004 * sstep(eyeY - 0.01, eyeY - 0.05, y);
    /** the cap's surface under the felt (th = 0) or with it: the dome over the cranium, then hanging straight down */
    const surf = (sp: number, lon: number, th: (y: number) => number, raw = false): V3 => {
      if (sp <= HALF) { const d = dirOf(HALF - sp, lon), r = H.h(d), y = H.c[1] + d[1] * r, rho = Math.hypot(d[0], d[2]) * r, w = sstep(HALF - 0.7, HALF, sp);
        const rh = Math.max(rho, raw ? H.hang(y, lon, true) : H.hang(y, lon)), rr = rho + (rh - rho) * w + th(y) * Math.hypot(d[0], d[2]), yy = y + th(y) * d[1];
        return [H.c[0] + Math.sin(lon) * rr, yy, H.c[2] + Math.cos(lon) * rr]; }
      const y = H.c[1] - (sp - HALF) * DROP, rr = H.hang(y, lon, raw) + th(y); return [H.c[0] + Math.sin(lon) * rr, y, H.c[2] + Math.cos(lon) * rr]; };
    // the rim per column: down from the crown while the surface point is under the cap; smoothed round
    let s0 = Array.from({ length: S }, (_, j) => { let lo = 0.15; for (let sp = 0.15; sp <= HALF + 0.2 / DROP; sp += 0.01) { if (!inside(surf(sp, lonOf(j), () => 0))) break; lo = sp; } return lo; });
    for (let it = 0; it < 2; it++) s0 = s0.map((x, j) => (s0[(j + S - 1) % S] + 2 * x + s0[(j + 1) % S]) / 4);
    const out = new Float32Array(n * 3), put = (i: number, p: V3) => out.set(p, i * 3);
    put(0, surf(0, 0, thick));
    // rows: the upper ones at the same heights all round, down to the brow's rim; the lower ones share out what each
    // column has below it (lappets and nape flap; none in front, where they collapse onto the rim). Rows at a fraction of
    // each column's own length sheared the quads where the lappets begin into a ridge.
    const sB = Math.min(...s0), R1 = Math.round(R * 0.55);
    for (let k = 1; k <= R; k++) for (let j = 0; j < S; j++) { const t = k / R, sp = k <= R1 ? Math.min(s0[j], (sB * k) / R1) : sB + (s0[j] - sB) * ((k - R1) / (R - R1));
      put(vid(k, j), surf(sp, lonOf(j), y => Math.max(0.006, thick(y) * (1 - 0.5 * sstep(s0[j] - 0.25, s0[j], sp))))); void t; }
    for (let j = 0; j < S; j++) put(lipId(j), surf(s0[j], lonOf(j), () => 0.0015, true));
    return out;
  });
  // weights: the head; the nape flap's lower part partly the neck
  for (let i = 0; i < n; i++) { const lip = i > R * S, k = i === 0 ? 0 : lip ? R : Math.floor((i - 1) / S) + 1, j = i === 0 ? 0 : lip ? i - 1 - R * S : (i - 1) % S, t = k / R, lon = lonOf(j);
    const neck = 0.5 * sstep(0.6, 1, t) * sstep(0.2, -0.6, Math.cos(lon)); setW(g, i, [W('head', 1 - neck), W('neck_01', neck)]); g.uv[i * 2] = j / S; g.uv[i * 2 + 1] = t; if (lip) { g.ao[i] = 150; g.edge[i] = 0; } }
  setMat(g, MAT.felt, COL.felt, 0);
  return g;
}
/** headcloth: over the head, down the back of the neck and the shoulders, relaxed so it drapes (women, C) */
function headcloth(L: Lib, key: string, lod: number) {
  const { A, ref, J } = L; const eyeY = ref.eyeY, h = J('head');
  // continuous distances (clean cut lines): the face oval stays open, and the front below the neck is open as a mantle
  // is (the first version cut a level line across the chest, which dipped around the breasts into a blotchy bib)
  const neckY = J('neck_01')[1], s3 = J('spine_03')[1], armY = J('upperarm_l')[1] - 0.04;
  // D-155: below the armpit the arm and the side of the chest are separate surfaces and a shell cannot bridge the gap
  // between them: its rim there read as torn teeth. Over the arms the cloth now ends a little below the shoulder; the
  // ends hang down the front of the chest and a panel down the back (|x| < 12 cm). (The belly is in the region so the
  // cut follows the distance, not the chest part's jagged lower boundary.)
  const d = regionOf(A, ref, [P.head, P.neck, P.chest, P.belly, P.uarm_l, P.uarm_r], p => {
    const face = Math.max(Math.hypot(p[0] / 0.066, (p[1] - (eyeY - 0.035)) / 0.078) - 1, h[2] + 0.02 - p[2]) * 0.05;
    const open = Math.max(Math.abs(p[0]) - 0.085, p[1] - (neckY - 0.01), 0.02 - p[2]);
    const top = p[1] - (s3 + 0.02 - 0.07 * sstep(0.05, -0.1, p[2])); // to mid-chest at the sides, lower at the back
    const side = Math.max(0.12 - Math.abs(p[0]), p[1] - armY);
    return Math.min(face, open, top, side, 0.2 - Math.abs(p[0])); });
  // over the dress (below the neck) it lies 2.4 cm out, and smoothing may not pull it closer than 2.2 cm: the dress is
  // 1 cm out plus its own smoothing, and a closer cloth z-fought with it; over the head 1.4–2 cm (no hair is worn under it)
  // D-155: it hugged the skull like a cap; the cloth now stands off the crown and falls away from the back of the head
  // (a draped cloth, not a fitted one; C), and is relaxed more
  // D-155: the mantle's hanging edge stands off the dress (tucked to 1.5 mm like a sleeve's cuff, its coarse cut line
  // read as drips); the face opening still lies against the cheeks
  return shellGeo(A, ref, key, { tris: A.lods[TESS[lod].tris], d, ramp: 0.012, smooth: lod === 0 ? 14 : 8, minOff: 0.022,
    edge: p => 0.003 + 0.015 * sstep(neckY + 0.01, neckY - 0.03, p[1]), smoothEdge: true, hull: p => sstep(neckY, neckY - 0.04, p[1]), // D-206: over the dress's hull below the neck
    thick: p => (p[1] < neckY ? 0.024 : 0.018 + 0.01 * sstep(eyeY, eyeY + 0.1, p[1]) + 0.014 * sstep(0.02, -0.07, p[2] - h[2])), mat: MAT.cloth_second, col: COL.second, prm: 4 });
}
/** torque: a ring around the base of the neck, fitted to the neck's support radius (per θ) plus 7 mm */
function torqueGeo(L: Lib, key: string, lod: number) {
  const T = TESS[lod], segs = Math.max(8, Math.round(T.hs * 0.75)), tubeSeg = lod === 0 ? 6 : 4; // a 4.5 mm ring: 6 sides at LOD0 (D-155 budget)
  const cache = { v: null as HumanVariant | null, r: [] as number[] };
  const ring = (c: Ctx) => { const n = c.J('neck_01'); return vertFrame([0, n[1] - 0.012, n[2] + 0.01]); };
  const sup = (c: Ctx) => { if (cache.v === c.v) return cache.r; const F = ring(c), r = new Array(64).fill(0.05);
    for (const i of partVerts(c.A, [P.neck, P.chest])) { const d = sub([c.v.pos[i * 3], c.v.pos[i * 3 + 1], c.v.pos[i * 3 + 2]], F.o); if (Math.abs(d[1]) > 0.01) continue; const x = dot(d, F.u), y = dot(d, F.v); for (let b = 0; b < 64; b++) { const h = x * COS64[b] + y * SIN64[b]; if (h > r[b]) r[b] = h; } }
    cache.v = c.v; cache.r = r; return r; };
  const at = (c: Ctx, t: number): V3 => { const F = ring(c), th = t * 2 * Math.PI, r = rimAt(sup(c), th) + 0.007; return add(F.o, add(scl(F.u, r * Math.cos(th)), scl(F.v, r * Math.sin(th)))); };
  return tubeGeo(L.A, key, { segs: tubeSeg, rings: segs,
    frame: (c, t) => { const o = at(c, t), w = nrm(sub(at(c, t + 0.01), at(c, t - 0.01))), u: V3 = [0, 1, 0]; return { o, u: nrm(sub(u, scl(w, dot(u, w)))), v: nrm(cross(w, u)), w }; },
    radius: () => 0.0045, weights: () => [W('neck_01', 0.5), W('spine_03', 0.5)], mat: MAT.metal, col: COL.fixed, prm: METAL.gold });
}
/** support function (64 θ bins) of already placed pieces in a ring plane, within ±slab of it */
function placedSupport(c: Ctx, keys: string[], F: Frame, slab: number) {
  const r = new Array(64).fill(0);
  for (const k of keys) { const pp = c.placed.get(k); if (!pp) continue; for (let i = 0; i < pp.length; i += 3) { const dx = pp[i] - F.o[0], dy = pp[i + 1] - F.o[1], dz = pp[i + 2] - F.o[2];
    if (Math.abs(dx * F.w[0] + dy * F.w[1] + dz * F.w[2]) > slab) continue; const x = dx * F.u[0] + dy * F.u[1] + dz * F.u[2], y = dx * F.v[0] + dy * F.v[1] + dz * F.v[2];
    for (let b = 0; b < 64; b++) { const h = x * COS64[b] + y * SIN64[b]; if (h > r[b]) r[b] = h; } } }
  return r;
}
/** kandys: a long sleeved coat slung over the shoulders, open at the front, the empty sleeves hanging (Median dress, B;
 *  cut, length and border C). D-155: the first version was a half-cylinder behind the body with two slabs for sleeves and
 *  read as a flat cape. Now: a shell over the shoulders and upper back; the coat's body hangs from the shoulders to the
 *  lower calf around the back AND the sides (its fronts fall past the chest, over the arms), in deep folds that grow
 *  toward the hem, with a border in the second colour along the fronts and the hem; the empty sleeves hang from the
 *  backs of the shoulders to below the hips, flattened as an empty sleeve falls, broadening to the cuff. It follows the
 *  shoulders and hips, not the arms (the arms are inside it). */
function kandysGeo(L: Lib, key: string, lod: number) {
  const { A, ref, J } = L; const T = TESS[lod], segs = lod === 0 ? Math.round(T.seg * 0.8) : Math.max(8, Math.round(T.seg * 0.7)), rings = lod === 0 ? Math.round(T.ring * 0.8) : Math.max(3, Math.round(T.ring * 0.8));
  const sh = J('upperarm_l')[1], zBack = J('spine_03')[2] + 0.03;
  const d = regionOf(A, ref, [P.neck, P.chest, P.uarm_l, P.uarm_r, P.belly], p => {
    const upper = p[1] - (sh - 0.17); // the upper back and the shoulders
    const back = zBack - p[2], top = Math.abs(p[0]) > 0.075 ? p[1] - (sh - 0.035) : -1; // behind the spine, or on top of the shoulders
    const outer = lod === 0 && Math.abs(p[0]) > 0.15 ? p[1] - (sh - 0.1) : -1; // over the shoulder point (close up only)
    const neck = J('neck_01')[1] + 0.02 - p[1];
    return Math.min(upper, Math.max(back, top, outer), neck, 0.04); });
  const cape = shellGeo(A, ref, `${key}_cape`, { tris: A.lods[TESS[lod].tris], d, ramp: 0.02, smooth: 6, minOff: 0.018, thick: () => 0.026, mat: MAT.cloth_trim, col: COL.trim, prm: 3, hull: () => 1 }); // D-206: over the tunic's hull
  const skirtKeys = ['tunic_skirt', 'tunic_upper'].map(k => geoKey(k, lod)); // D-206: and over the tunic, which now hangs off the back
  const top = (c: Ctx) => c.J('upperarm_l')[1] - 0.06, hem = (c: Ctx) => c.J('calf_l')[1] - 0.2;
  const frame = (c: Ctx, t: number) => vertFrame([0, lerp(top(c), hem(c), t), lerp(c.J('spine_03')[2] + 0.02, c.J('pelvis')[2], t)]);
  const a0 = 0.3 * Math.PI, a1 = 1.7 * Math.PI;
  const hang = tubeGeo(A, `${key}_hang`, { segs, rings, lining: 0.005, arc: [a0, a1],
    frame,
    support: { parts: [P.chest, P.belly, P.pelvis, ...ARMS, P.hand_l, P.hand_r, P.thigh_l, P.thigh_r, P.calf_l, P.calf_r], slab: 0.035, running: 'max' },
    radius: (c, t, th, sup) => { const skirt = rimAt(placedSupport(c, skirtKeys, frame(c, t), 0.03), th);
      const back = 0.5 - 0.5 * Math.cos(th); // 0 at the fronts, 1 at the back
      const s = Math.sin((th - a0) * 11), fold = Math.sign(s) * Math.pow(Math.abs(s), 0.6); // rounded crests, sharper troughs
      return Math.max(sup(th) + 0.014 + 0.02 * sstep(0, 0.2, t), skirt + 0.016) + 0.03 * sstep(0.1, 1, t) * back + (0.003 + 0.015 * sstep(0.1, 0.8, t)) * fold; },
    weights: t => [W('spine_03', Math.max(0, 1 - 1.6 * t)), W('spine_02', 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.3))), W('pelvis', sstep(0.2, 0.9, t))],
    mat: MAT.cloth_trim, col: COL.trim, prm: 3 });
  // the border (second colour) along the fronts and the hem (C)
  { const cols = segs + 1, nRing = cols * (rings + 1);
    for (let layer = 0; layer < 2; layer++) for (let k = 0; k <= rings; k++) for (let j = 0; j < cols; j++) if (j <= 1 || j >= segs - 1 || k === rings) { const i = layer * nRing + k * cols + j; hang.mat[i] = MAT.cloth_second; hang.col[i] = COL.second; } }
  const sleeve = (s: 1 | -1) => tubeGeo(A, `${key}_sleeve${s}`, { segs: lod === 0 ? 12 : 4, rings: lod === 0 ? 9 : 2, capStart: true, capEnd: true,
    frame: (c, t) => { const u = c.J(s > 0 ? 'upperarm_l' : 'upperarm_r'); const a: V3 = [u[0] + s * 0.085, u[1] - 0.01, u[2] - 0.03], b: V3 = [u[0] + s * 0.11, c.J("pelvis")[1] - 0.14, u[2] - 0.07]; return segFrame(a, b, t, [0, 0, -1]); },
    radius: (c, t, th) => { const wd = lerp(0.04, 0.06, t), dp = lerp(0.014, 0.011, t); return (wd * dp) / Math.hypot(dp * Math.cos(th), wd * Math.sin(th)) * (1 + 0.05 * Math.sin(th * 3 + t * 9)); },
    weights: t => [W('spine_03', 1 - 0.5 * t), W('spine_02', 0.5 * t)], mat: MAT.cloth_trim, col: COL.trim, prm: 3 });
  return merge(key, [cape, hang, sleeve(1), sleeve(-1)]);
}
/** the bob's hanging part (D-155): a curtain of hair from above the ears to the jaw line that hangs straight down from the
 *  widest part of the head (the support function's running maximum; it does not follow the neck in), open over the
 *  face, its ends turned under. The first bob was a shell on the skull and the neck and read as cropped hair (C). */
function bobCurtain(L: Lib, key: string, lod: number) {
  const T = TESS[lod], segs = lod === 0 ? Math.round(T.seg * 0.8) : Math.max(6, Math.round(T.seg * 0.6)), rings = Math.max(2, Math.round(T.ring * 0.5));
  // from the level of the brow (inside the scalp shell there) down to the jaw line; a hanging mass 1.2 cm thick at the
  // crown that thins to its ends (~5 mm at the back, ~2 mm at the front edges: full-thickness ends read as rolls)
  const top = (c: Ctx) => c.v.eyeY + 0.055, bot = (c: Ctx) => c.J('jaw')[1] - 0.012, a0 = 0.36 * Math.PI, a1 = 1.64 * Math.PI;
  const frame = (c: Ctx, t: number) => vertFrame([0, lerp(top(c), bot(c), t), c.J('head')[2] + 0.015]);
  const lining = (t: number, th: number) => lerp(0.004, 0.012, sstep(0, 0.35 * Math.PI, Math.min(th - a0, a1 - th))) * (1 - 0.6 * sstep(0.5, 1, t));
  return tubeGeo(L.A, key, { segs, rings, lining, arc: [a0, a1],
    frame, support: { parts: [P.head, P.neck], slab: 0.012, running: 'max' },
    radius: (c, t, th, sup) => sup(th) + 0.009 + 0.006 * sstep(0, 0.3, t) + 0.004 * sstep(0.3, 1, t) - 0.006 * sstep(0.84, 1, t) + 0.0015 * Math.sin(th * 23 + t * 4),
    weights: t => [W('head', 1 - 0.35 * sstep(0.5, 1, t)), W('neck_01', 0.35 * sstep(0.5, 1, t))], mat: MAT.hair, col: COL.hair, prm: 1 });
}
/** quiver on the back: a long, slightly tapering case, top over the left shoulder (C placement) */
function quiverGeo(L: Lib, key: string, lod: number) {
  const T = TESS[lod], segs = Math.max(6, Math.round(T.seg * 0.4)), rings = Math.max(2, Math.round(T.ring * 0.4));
  const ends = (c: Ctx): [V3, V3] => { const s3 = c.J('spine_03'), p = c.J('pelvis'); const back = backZ(c, s3[1]) - 0.055;
    return [[0.12, s3[1] + 0.26, back], [-0.1, p[1] - 0.06, backZ(c, p[1] + 0.1) - 0.07]]; };
  return tubeGeo(L.A, key, { segs, rings, capStart: true, capEnd: true,
    frame: (c, t) => { const [a, b] = ends(c); return segFrame(a, b, t, [0, 0, -1]); },
    radius: (c, t) => lerp(0.058, 0.048, t) * (t < 0.12 ? 1.12 : 1), weights: t => [W('spine_03', 1 - 0.6 * t), W('spine_02', 0.6 * t)], mat: MAT.leather, col: COL.leather, prm: 1 });
}
/** back surface z of the torso at a height (for items carried on the back) */
/** front surface z of the torso at a height, near the midline */
function frontZ(c: Ctx, y: number) { const sy = sortedByY(c.v, c.A, [P.chest, P.neck, P.belly]); let z = -1; for (let q = lowerBound(sy.y, y - 0.02), e = lowerBound(sy.y, y + 0.02); q < e; q++) { const i = sy.idx[q]; if (Math.abs(c.v.pos[i * 3]) > 0.06) continue; z = Math.max(z, c.v.pos[i * 3 + 2]); } return z > -1 ? z : c.J('spine_03')[2] + 0.12; }
const BZ = new WeakMap<HumanVariant, Map<number, number>>();
function backZ(c: Ctx, y: number) {
  let m = BZ.get(c.v); if (!m) BZ.set(c.v, m = new Map()); const key = Math.round(y * 1000); const hit = m.get(key); if (hit !== undefined) return hit;
  const sy = sortedByY(c.v, c.A, TORSO); let z = 1; for (let q = lowerBound(sy.y, y - 0.03), e = lowerBound(sy.y, y + 0.03); q < e; q++) { const i = sy.idx[q]; if (Math.abs(c.v.pos[i * 3]) > 0.08) continue; z = Math.min(z, c.v.pos[i * 3 + 2]); }
  const r = z < 1 ? z : c.J('spine_03')[2] - 0.1; m.set(key, r); return r;
}
/** composite bow slung over the left shoulder, lying diagonally across the back (C) */
function bowGeo(L: Lib, key: string, lod: number) {
  const T = TESS[lod], rings = Math.max(6, T.ring * 2), segs = lod === 0 ? 6 : 4;
  const path = (c: Ctx, t: number): V3 => { const s3 = c.J('spine_03'); const a: V3 = [0.2, s3[1] + 0.3, backZ(c, s3[1]) - 0.1], b: V3 = [-0.16, s3[1] - 0.45, backZ(c, s3[1] - 0.3) - 0.1];
    const m = add(a, scl(sub(b, a), t)); const recurve = 0.05 * Math.sin(Math.PI * t) - 0.025 * Math.sin(2 * Math.PI * t) * 0; return add(m, [0, 0, -recurve]); };
  return tubeGeo(L.A, key, { segs, rings, capStart: true, capEnd: true,
    frame: (c, t) => { const p = path(c, t), q = path(c, Math.min(1, t + 0.02)), r = path(c, Math.max(0, t - 0.02)); const w = nrm(sub(q, r)); return { o: p, u: nrm(cross(w, [1, 0, 0])), v: nrm(cross(w, cross(w, [1, 0, 0]))), w }; },
    radius: (c, t, th) => { const tip = 1 - 0.55 * Math.abs(2 * t - 1) ** 3; const a = 0.009 * tip, b = 0.015 * tip; return (a * b) / Math.hypot(b * Math.cos(th), a * Math.sin(th)); },
    weights: () => [W('spine_03', 1)], mat: MAT.wood, col: COL.fixed, prm: 1 });
}
/** akinakes in its scabbard at the right thigh: lobed top, straight scabbard, chape (C proportions) */
function akinakaGeo(L: Lib, key: string, lod: number) {
  const T = TESS[lod], segs = lod === 0 ? 10 : 5, rings = Math.max(3, T.ring);
  const ends = (c: Ctx): [V3, V3] => { const t = c.J('thigh_r'), k = c.J('calf_r'); const x = t[0] - 0.13; return [[x, t[1] + 0.06, t[2] + 0.05], [x - 0.01, lerp(t[1], k[1], 0.62), k[2] + 0.07]]; };
  return tubeGeo(L.A, key, { segs, rings, capStart: true, capEnd: true,
    frame: (c, t) => { const [a, b] = ends(c); return segFrame(a, b, t, [0, 0, 1]); },
    radius: (c, t, th) => { const hilt = t < 0.18, lobe = t > 0.2 && t < 0.3; const wdt = hilt ? (t < 0.04 ? 0.03 : 0.013) : lobe ? 0.045 : lerp(0.024, 0.012, (t - 0.3) / 0.7) * (t > 0.94 ? 1.4 : 1);
      const dep = hilt ? 0.013 : 0.009; return (wdt * dep) / Math.hypot(dep * Math.cos(th), wdt * Math.sin(th)); },
    weights: t => [W('thigh_r', 0.35 + 0.5 * t), W('pelvis', 0.65 - 0.5 * t)], mat: MAT.leather, col: COL.leather, prm: 2 });
}
/** gorytos (combined bow case) at the left hip (C) */
function gorytosGeo(L: Lib, key: string, lod: number) {
  const T = TESS[lod], segs = lod === 0 ? 10 : 5, rings = Math.max(3, T.ring);
  const ends = (c: Ctx): [V3, V3] => { const t = c.J('thigh_l'); return [[t[0] + 0.1, t[1] + 0.12, t[2] - 0.11], [t[0] + 0.1, t[1] - 0.4, t[2] - 0.2]]; }; // behind the left hip, clear of the arm
  return tubeGeo(L.A, key, { segs, rings, capStart: true, capEnd: true,
    frame: (c, t) => { const [a, b] = ends(c); return segFrame(a, b, t, [1, 0, 0]); },
    radius: (c, t, th) => { const wdt = lerp(0.1, 0.045, t ** 1.4), dep = 0.03; return (wdt * dep) / Math.hypot(wdt * Math.cos(th), dep * Math.sin(th)); },
    weights: t => [W('pelvis', 1 - 0.4 * t), W('thigh_l', 0.4 * t)], mat: MAT.leather, col: COL.leather, prm: 3 });
}

// ------------------------------------------------------------------------------------------------ D-215: ornaments, shield, veil
const LOBES = new WeakMap<HumanVariant, [V3, V3]>();
/** the ear lobes of a body in the bind pose (left, right): the lowest 2.5 mm band of the head below the eyes where the
 *  pinna stands out more than 5 mm beyond the skull (measured above the ear), 3 mm in from its rim (C; D-215) */
export function earLobes(c: Pick<Ctx, 'A' | 'v' | 'J'>): [V3, V3] {
  const hit = LOBES.get(c.v); if (hit) return hit;
  const V = c.v.pos, eyeY = c.v.eyeY, hz = c.J('head')[2], head = partVerts(c.A, [P.head]);
  const out = [1, -1].map(sd => {
    const band = (y: number) => { let mx = 0, at: V3 = [0, y, hz]; for (const i of head) { const py = V[i * 3 + 1]; if (Math.abs(py - y) > 0.00125) continue; const x = V[i * 3] * sd; if (x > mx) { mx = x; at = [V[i * 3], py, V[i * 3 + 2]]; } } return { mx, at }; };
    const skull = band(eyeY + 0.025).mx; let lobe: V3 | null = null;
    for (let y = eyeY + 0.01; y > eyeY - 0.08; y -= 0.0025) { const b = band(y); if (b.mx > skull + 0.005) lobe = b.at; else if (lobe && y < eyeY - 0.02) break; }
    const L = lobe ?? [sd * (skull + 0.008), eyeY - 0.045, hz] as V3; return [L[0] - sd * 0.003, L[1], L[2]] as V3;
  }) as [V3, V3];
  LOBES.set(c.v, out); return out;
}
/** a closed ring of wire (radius `r`) along a loop given per variant (`at(c, a)`: the loop's point at angle a) */
function loopGeo(A: HumanAssets, key: string, o: { segs: number; rings: number; r: number; at: (c: Ctx, a: number) => V3; up: (c: Ctx) => V3; weights: [number, number][]; mat: number; prm: number }): Geo {
  return tubeGeo(A, key, { segs: o.segs, rings: o.rings,
    frame: (c, t) => { const a = t * 2 * Math.PI, p = o.at(c, a), w = nrm(sub(o.at(c, a + 0.01), o.at(c, a - 0.01))), up = o.up(c), u = nrm(sub(up, scl(w, dot(up, w)))); return { o: p, u, v: nrm(cross(w, u)), w }; },
    radius: () => o.r, weights: () => o.weights, mat: o.mat, col: COL.fixed, prm: o.prm });
}
/** earrings: a hoop 18 mm across through each lobe, hanging in the ear's plane (wire 1.2 mm; C) */
export const EARRING_R = 0.009;
function earringsGeo(L: Lib, key: string, lod: number, metal: number) {
  const R = EARRING_R, segs = lod === 0 ? 5 : 3, rings = lod === 0 ? 12 : lod === 1 ? 6 : 4;
  return merge(key, [0, 1].map(s => loopGeo(L.A, `${key}_${s}`, { segs, rings, r: 0.0012,
    at: (c, a) => { const l = earLobes(c)[s]; return [l[0], l[1] - R + R * Math.cos(a), l[2] + R * Math.sin(a)]; }, up: () => [1, 0, 0], weights: [W('head', 1)], mat: MAT.metal, prm: metal })));
}
const WRIST = new WeakMap<HumanVariant, Map<string, number[]>>();
/** where a bracelet sits: 86 % of the way from the elbow to the wrist (C) */
export const BRACELET_AT = 0.86;
/** bracelets: a solid ring round each forearm just above the wrist, 4 mm clear of the forearm's section there (wire
 *  3.5 mm; the animal-head terminals not modelled: C) */
function braceletsGeo(L: Lib, key: string, lod: number, metal: number) {
  const segs = lod === 0 ? 6 : lod === 1 ? 4 : 3, rings = lod === 0 ? 16 : lod === 1 ? 8 : 5;
  const frameOf = (c: Ctx, s: 'l' | 'r') => { const a = c.J(`lowerarm_${s}`), h = c.J(`hand_${s}`), w = nrm(sub(h, a)), o = add(a, scl(sub(h, a), BRACELET_AT)), u = nrm(sub([0, 0, 1], scl(w, w[2]))); return { o, u, v: nrm(cross(w, u)), w }; };
  const sup = (c: Ctx, s: 'l' | 'r') => { let m = WRIST.get(c.v); if (!m) WRIST.set(c.v, m = new Map()); const hit = m.get(s); if (hit) return hit;
    const F = frameOf(c, s), r = new Array(64).fill(0.025);
    for (const i of partVerts(c.A, s === 'l' ? [P.farm_l, P.hand_l] : [P.farm_r, P.hand_r])) { const d = sub([c.v.pos[i * 3], c.v.pos[i * 3 + 1], c.v.pos[i * 3 + 2]], F.o); if (Math.abs(dot(d, F.w)) > 0.012) continue; const x = dot(d, F.u), y = dot(d, F.v); for (let b = 0; b < 64; b++) { const h = x * COS64[b] + y * SIN64[b]; if (h > r[b]) r[b] = h; } }
    m.set(s, r); return r; };
  return merge(key, (['l', 'r'] as const).map(s => loopGeo(L.A, `${key}_${s}`, { segs, rings, r: 0.0035,
    at: (c, a) => { const F = frameOf(c, s), rr = rimAt(sup(c, s), a) + 0.004 + 0.0035; return add(F.o, add(scl(F.u, rr * Math.cos(a)), scl(F.v, rr * Math.sin(a)))); },
    up: c => frameOf(c, s).w, weights: [W(`lowerarm_${s}`, 1)], mat: MAT.metal, prm: metal })));
}
/** the wicker shield: violin-shaped (an ellipse 0.8 × 0.44 m with a notch in each side), 2 cm thick and a little domed,
 *  held by the grip at its centre in the left hand: its long axis along the forearm, its face outward (C) */
export const SHIELD = { half: 0.4, halfW: 0.22, notch: 0.28, thick: 0.02, off: 0.05, dome: 0.03 } as const;
function shieldGeo(L: Lib, key: string, lod: number) {
  const segs = lod === 0 ? 24 : lod === 1 ? 12 : 8, S = SHIELD;
  const F0 = (c: Ctx) => { const a = c.J('lowerarm_l'), h = c.J('hand_l'), m = c.J('middle_01_l'), u = nrm(sub(h, a)), g = add(h, scl(sub(m, h), 0.85)), w0: V3 = [1, 0, 0], w = nrm(sub(w0, scl(u, dot(w0, u)))); return { g: add(g, scl(w, S.off)), u, w }; };
  return tubeGeo(L.A, key, { segs, rings: 1, capStart: true, capEnd: true, capLift: S.dome,
    frame: (c, t) => { const F = F0(c); return { o: add(F.g, scl(F.w, (t - 0.5) * S.thick)), u: F.u, v: nrm(cross(F.w, F.u)), w: F.w }; },
    radius: (_c, _t, th) => { const a = S.half, b = S.halfW, ct = Math.cos(th), st = Math.sin(th); return (a * b) / Math.hypot(b * ct, a * st) * (1 - S.notch * Math.exp(-((ct / 0.2) ** 2))); },
    weights: () => [W('lowerarm_l', 0.3), W('hand_l', 0.7)], mat: MAT.wicker, col: COL.fixed, prm: 0 });
}
/** the court woman's crown: a low gold band fitted to the head with ten merlons (crenellated), 7 cm (C) */
function crownWGeo(L: Lib, key: string, lod: number) {
  const segs = lod === 0 ? 40 : lod === 1 ? 20 : 10, rings = lod === 0 ? 4 : 2, H = 0.07, merlons = 10;
  const cache = { v: null as HumanVariant | null, r: [] as number[] }, F0 = (c: Ctx) => headRingFrame(c, 0.05, 0.12);
  return tubeGeo(L.A, key, { segs, rings, lining: 0.003, closeTop: true,
    frame: (c, t) => { const F = F0(c); return { ...F, o: add(F.o, scl(F.w, -0.01 + (H + 0.01) * t)) }; },
    radius: (c, t, th) => { const r = headRim(c, F0(c), 0.008, cache), gap = Math.cos(th * merlons) > 0.2 ? 0 : 1; return rimAt(r, th) + 0.008 + 0.004 * t - gap * 0.02 * sstep(0.62, 0.7, t); },
    weights: () => [W('head', 1)], mat: MAT.metal, col: COL.fixed, prm: METAL.gold });
}
const VEIL = new WeakMap<HumanVariant, Map<string, number[][]>>();
/** the court woman's veil: an open sheet over the back and the shoulders' backs (±60° from the back), from under the
 *  crown to mid-thigh; hanging from the widest of the body and the robe above each height (a running maximum: cloth
 *  hangs, it does not tuck in), 12 mm clear of them and flaring to 4 cm at the hem; 3 mm fine wool, lined (C) */
function veilGeo(L: Lib, key: string, lod: number) {
  const S = lod === 0 ? 16 : lod === 1 ? 8 : 5, R = lod === 0 ? 12 : lod === 1 ? 5 : 3, A0 = Math.PI - 1.05, A1 = Math.PI + 1.05;
  const origin = (c: Ctx, t: number): V3 => { const y0 = c.v.eyeY + 0.055, y1 = c.J('pelvis')[1] - 0.26, hz = c.J('head')[2] + 0.03, bz = c.J('spine_02')[2]; return [0, lerp(y0, y1, t), lerp(hz, bz, sstep(0, 0.3, t))]; };
  const robe = ['robe_upper', 'robe_sleeves', 'robe_skirt'].map(k => geoKey(k, lod));
  const table = (c: Ctx) => { let m = VEIL.get(c.v); if (!m) VEIL.set(c.v, m = new Map()); const hit = m.get(key); if (hit) return hit;
    const parts = [P.head, P.neck, P.chest, P.belly, P.pelvis, P.uarm_l, P.uarm_r, P.thigh_l, P.thigh_r], rows: number[][] = []; let run: number[] | null = null;
    for (let k = 0; k <= R; k++) { const F = vertFrame(origin(c, k / R)), r = new Array(64).fill(0), slab = 0.02;
      for (const i of partVerts(c.A, parts)) { const d = sub([c.v.pos[i * 3], c.v.pos[i * 3 + 1], c.v.pos[i * 3 + 2]], F.o); if (Math.abs(d[1]) > slab) continue; const x = dot(d, F.u), y = dot(d, F.v); for (let b = 0; b < 64; b++) { const h = x * COS64[b] + y * SIN64[b]; if (h > r[b]) r[b] = h; } }
      const pr = placedSupport(c, robe, F, slab); for (let b = 0; b < 64; b++) r[b] = Math.max(r[b], pr[b]);
      const sm = r.map((_, b) => (r[(b + 63) % 64] + 2 * r[b] + r[(b + 1) % 64]) / 4); if (run) for (let b = 0; b < 64; b++) sm[b] = Math.max(sm[b], run[b]); run = sm; rows.push(sm); }
    m.set(key, rows); return rows; };
  return tubeGeo(L.A, key, { segs: S, rings: R, lining: 0.003, arc: [A0, A1],
    frame: (c, t) => vertFrame(origin(c, t)),
    radius: (c, t, th) => { const rows = table(c), k = Math.min(R, Math.round(t * R)); return rimAt(rows[k], th) + 0.012 + 0.028 * t * t + 0.003 * Math.sin(th * 9 + t * 5) * t; },
    weights: t => t < 0.1 ? [W('head', 1 - t / 0.1), W('neck_01', t / 0.1)] : t < 0.25 ? [W('neck_01', 1 - (t - 0.1) / 0.15), W('spine_03', (t - 0.1) / 0.15)] : t < 0.6 ? [W('spine_03', 1 - (t - 0.25) / 0.35), W('spine_01', (t - 0.25) / 0.35)] : [W('spine_01', 1 - (t - 0.6) / 0.4), W('pelvis', (t - 0.6) / 0.4)],
    mat: MAT.cloth_second, col: COL.second, prm: 4 });
}

/** D-209: the soft cap's flaps drawn over the mouth and chin, hanging from under the nose to below the chin and round to the
 *  lappets (a man in Median dress with the barsom on the Oxus plaques: "his chin is covered", OXUS-PLAQUE: B; the fit C). A
 *  magus wears it at the fire and the offerings (activities.ts `wear`; the crowd sets the bit only then) */
function mouthCover(L: Lib, key: string, lod: number) {
  const { noseI, chinI } = faceGeom(L), S = lod === 0 ? 18 : lod === 1 ? 8 : 5, R = lod === 0 ? 5 : lod === 1 ? 3 : 2;
  const origin = (c: Ctx, t: number): V3 => [0, lerp(c.v.pos[noseI * 3 + 1] - 0.014, c.v.pos[chinI * 3 + 1] - 0.035, t), c.J('head')[2] + 0.008];
  return tubeGeo(L.A, key, { segs: S, rings: R, lining: 0.003, arc: [-1.95, 1.95], frame: (c, t) => vertFrame(origin(c, t)),
    support: { parts: [P.head, P.neck], slab: 0.008, running: 'max' }, radius: (c, t, th, sup) => sup(th) + 0.009 + 0.004 * t,
    weights: () => [W('head', 1)], mat: MAT.felt, col: COL.felt, prm: 0 });
}

// ------------------------------------------------------------------------------------------------ piece factory
function buildPiece(L: Lib, id: string, lod: number): Geo {
  const J = L.J;
  switch (id) {
    case 'robe_upper': return upperShell(L, `${id}@${lod}`, lod, { armCut: 0.28, hipDrop: 0.1, neckDrop: 0.035, thick: 0.013, armThick: 0.012, smooth: 3 });
    case 'robe_skirt': { const T = TESS[lod], rings = skirtRings(lod);
      const hem = (c: Ctx, th: number) => 0.035 + 0.035 * Math.max(0, Math.cos(th)) ** 2; // front of the hem higher, shoes show (C)
      return withHem(skirtTube(L, `${id}@${lod}`, lod, { top: -0.02, hem, ease: 0.012, flare: 0.05, pleats: 26, pleatAmp: 0.009, frontPleat: 1 }), T.seg, rings, true, hem); }
    case 'robe_sleeves': return robeSleeves(L, `${id}@${lod}`, lod);
    case 'tunic_upper': return upperShell(L, `${id}@${lod}`, lod, { armCut: 0.97, hipDrop: 0.08, neckDrop: 0.03, thick: 0.009, armThick: 0.006, smooth: 2 });
    case 'tunic_skirt': case 'work_skirt': case 'child_skirt': { const T = TESS[lod], rings = skirtRings(lod);
      const hem = (c: Ctx) => c.J('calf_l')[1] + (id === 'tunic_skirt' ? 0.0 : 0.04);
      return withHem(skirtTube(L, `${id}@${lod}`, lod, { top: -0.02, hem, ease: 0.01, flare: 0.035, pleats: 14, pleatAmp: 0.004, folds: 0.007 }), T.seg, rings, true, hem); }
    case 'trousers': return trouserShell(L, `${id}@${lod}`, lod, COL.second);
    case 'work_trousers': return trouserShell(L, `${id}@${lod}`, lod, COL.second);
    case 'work_upper': case 'child_upper': return upperShell(L, `${id}@${lod}`, lod, { armCut: 0.22, hipDrop: 0.08, neckDrop: 0.03, thick: 0.009, armThick: 0.007, smooth: 2 });
    case 'dress_upper': return upperShell(L, `${id}@${lod}`, lod, { armCut: 0.96, hipDrop: 0.1, neckDrop: 0.025, thick: 0.01, armThick: 0.008, smooth: 3 });
    case 'dress_skirt': { const T = TESS[lod], rings = skirtRings(lod); const hem = () => 0.03;
      return withHem(skirtTube(L, `${id}@${lod}`, lod, { top: -0.02, hem, ease: 0.014, flare: 0.06, pleats: 22, pleatAmp: 0.006, folds: 0.005 }), T.seg, rings, true, hem); }
    case 'headcloth': return headcloth(L, `${id}@${lod}`, lod);
    case 'belt': { const over = ['robe_skirt', 'tunic_skirt', 'work_skirt', 'dress_skirt', 'child_skirt'].map(k => geoKey(k, lod)); // skirts only: the upper shells include the sleeves
      return beltTube(L, `${id}@${lod}`, lod, over, { dy: -0.005, h: 0.045, col: COL.trim, mat: MAT.cloth_trim }); }
    case 'shoes': return footShell(L, `${id}@${lod}`, lod, 0.035);
    case 'boots': return footShell(L, `${id}@${lod}`, lod, 0.11);
    case 'hair': return hairShell(L, `${id}@${lod}`, lod, false);
    case 'hair_bob': return merge(`${id}@${lod}`, [hairShell(L, `${id}@${lod}_top`, lod, false), bobCurtain(L, `${id}@${lod}_curtain`, lod)]);
    case 'bun': return bunGeo(L, `${id}@${lod}`, lod);
    case 'beard_long': return beardGeo(L, `${id}@${lod}`, lod, true);
    case 'beard_short': return beardGeo(L, `${id}@${lod}`, lod, false);
    case 'hat_fluted': return flutedHatFitted(L, `${id}@${lod}`, lod);
    case 'fillet': return headBand(L, `${id}@${lod}`, lod, { dy: 0.04, w: 0.022, t: 0.006, twisted: true, col: COL.trim });
    case 'headband': return headBand(L, `${id}@${lod}`, lod, { dy: 0.045, w: 0.02, t: 0.002, twisted: false, col: COL.second, gap: 0.0045 });
    case 'cap_soft': return softCap(L, `${id}@${lod}`, lod);
    case 'cap_pointed': return pointedCap(L, `${id}@${lod}`, lod);
    case 'cap_low': return lowCap(L, `${id}@${lod}`, lod);
    case 'crown': return crownGeo(L, `${id}@${lod}`, lod);
    case 'torque': return torqueGeo(L, `${id}@${lod}`, lod);
    case 'quiver': return quiverGeo(L, `${id}@${lod}`, lod);
    case 'kandys': return kandysGeo(L, `${id}@${lod}`, lod);
    case 'bow': return bowGeo(L, `${id}@${lod}`, lod);
    case 'akinaka': return akinakaGeo(L, `${id}@${lod}`, lod);
    case 'gorytos': return gorytosGeo(L, `${id}@${lod}`, lod);
    case 'earrings': case 'earrings_b': return earringsGeo(L, `${id}@${lod}`, lod, id === 'earrings' ? METAL.gold : METAL.bronze);
    case 'bracelets': case 'bracelets_b': return braceletsGeo(L, `${id}@${lod}`, lod, id === 'bracelets' ? METAL.gold : METAL.bronze);
    case 'shield': return shieldGeo(L, `${id}@${lod}`, lod);
    case 'crown_w': return crownWGeo(L, `${id}@${lod}`, lod);
    case 'veil': return veilGeo(L, `${id}@${lod}`, lod);
    case 'mouth_cover': return mouthCover(L, `${id}@${lod}`, lod);
  }
  void J;
  throw new Error('unknown piece ' + id);
}

// ------------------------------------------------------------------------------------------------ body coverage (drop)
/** body render vertices that stay hidden under an always-worn piece of this costume (deep inside, margin ≥ 3 cm) */
function coverage(L: Lib, dress: Dress): Uint8Array {
  const { A, ref, J } = L; const cov = new Uint8Array(A.NO); const always = new Set(COSTUMES[dress].always);
  const armT = (p: V3, s: 'l' | 'r') => { const tu = along(J, `upperarm_${s}`, `lowerarm_${s}`, p); if (tu <= 1) return tu * 0.5; return 0.5 + 0.5 * along(J, `lowerarm_${s}`, `hand_${s}`, p); };
  for (let i = 0; i < A.NO; i++) {
    const pt = A.part[i]; if (pt >= PART.eye) continue; const p: V3 = [ref.pos[i * 3], ref.pos[i * 3 + 1], ref.pos[i * 3 + 2]];
    const neckY = J('neck_01')[1] - 0.05, waist = J('spine_01')[1], knee = J('calf_l')[1], ankle = J('foot_l')[1];
    const torso = TORSO.includes(pt as any) || (pt === P.neck && p[1] < neckY);
    const arm = ARMS.includes(pt as any), side = p[0] > 0 ? 'l' : 'r';
    const leg = LEGS.includes(pt as any) || pt === P.pelvis, foot = pt === P.foot_l || pt === P.foot_r;
    let c = false;
    if (always.has('robe_upper') && torso && p[1] > J('thigh_l')[1] - 0.05) c = true;
    if (always.has('robe_sleeves') && arm && armT(p, side) < 0.86) c = true;
    if (always.has('robe_skirt') && leg && p[1] < waist - 0.02 && p[1] > ankle + 0.12) c = true;
    if ((always.has('tunic_upper') || always.has('dress_upper')) && (torso && p[1] > J('thigh_l')[1] - 0.04 || arm && armT(p, side) < 0.88)) c = true;
    if (always.has('work_upper') || always.has('child_upper')) { if (torso && p[1] > J('thigh_l')[1] - 0.04) c = true; if (arm && armT(p, side) < 0.08) c = true; }
    if ((always.has('tunic_skirt') || always.has('work_skirt') || always.has('child_skirt')) && (pt === P.pelvis || LEGS.includes(pt as any) && pt !== P.calf_l && pt !== P.calf_r) && p[1] < waist - 0.02 && p[1] > knee + 0.1) c = true;
    if (always.has('dress_skirt') && leg && p[1] < waist - 0.02 && p[1] > ankle + 0.1) c = true;
    if (always.has('trousers') && leg && p[1] < waist - 0.06 && p[1] > ankle + 0.1) c = true;
    if ((always.has('shoes') && foot && p[1] < ankle + 0.005) || (always.has('boots') && (foot || LEGS.includes(pt as any)) && p[1] < ankle + 0.08)) c = true;
    cov[i] = c ? 1 : 0;
  }
  return cov;
}

// ------------------------------------------------------------------------------------------------ assembly
export interface CostumeLOD {
  dress: Dress; lod: number;
  /** vertex attributes (tid = index into the vertex source; hmat = class, colour slot, piece bit, param; hext = ao, slack, skirt flag (D-189), cut-line ramp) */
  tid: Float32Array; skinIndex: Uint8Array; skinWeight: Uint8Array; uv: Float32Array; hmat: Uint8Array; hext: Uint8Array;
  /** reference-variant bind position and normal (the geometry's position/normal attributes; bounds and raycasts) */
  refPos: Float32Array; refNrm: Float32Array;
  index: Uint32Array; triangles: number; bodyTriangles: number;
  /** triangle ranges per piece (for tests and budgets) */
  pieceTris: Record<string, number>;
}
export interface OutfitBuild {
  /** vertex source: body render vertices first, then every distinct piece geometry */
  NV: number; pieceBase: Record<string, number>;
  /** piece geometries with their fitting code (node/tests only: not sent back from the worker) */
  geos?: Record<string, Geo>;
  /** per variant × NV: xyz bind position, w = packed normal (oct 12+12 bits as an exact integer) */
  source: Float32Array;
  costumes: Record<Dress, CostumeLOD[]>;
  ms: number;
}
/** MakeHuman's high-poly eye has a second, transparent cornea layer mapped to the small disc in the corner of the eye
 *  texture (u > 0.85, v < 0.16); drawn opaque it hides the iris behind a pale blue shell, so it is left out */
export const isCornea = (A: HumanAssets, i: number) => A.part[i] === PART.eye && A.uv[i * 2] > 0.85 && A.uv[i * 2 + 1] < 0.16;
/** octahedral normal packing into one float holding an exact 24-bit integer (decoded in the shader with floor/mod) */
export function packNormal(x: number, y: number, z: number) {
  const s = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1; let u = x / s, v = y / s;
  if (z < 0) { const ou = u; u = (1 - Math.abs(v)) * Math.sign(ou || 1); v = (1 - Math.abs(ou)) * Math.sign(v || 1); }
  const qu = Math.round((u * 0.5 + 0.5) * 4095), qv = Math.round((v * 0.5 + 0.5) * 4095); return qu * 4096 + qv;
}
export function unpackNormal(w: number): V3 {
  const qu = Math.floor(w / 4096), qv = w - qu * 4096; let u = (qu / 4095) * 2 - 1, v = (qv / 4095) * 2 - 1; const z = 1 - Math.abs(u) - Math.abs(v);
  if (z < 0) { const ou = u; u = (1 - Math.abs(v)) * Math.sign(ou || 1); v = (1 - Math.abs(ou)) * Math.sign(v || 1); }
  return nrm([u, v, z]);
}
function geoNormals(pos: Float32Array, index: number[], n: number) {
  const acc = new Float64Array(n * 3);
  for (let t = 0; t < index.length; t += 3) { const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const q of [a, b, c]) { acc[q] += nx; acc[q + 1] += ny; acc[q + 2] += nz; } }
  const out = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const l = Math.hypot(acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]) || 1; out[i * 3] = acc[i * 3] / l; out[i * 3 + 1] = acc[i * 3 + 1] / l; out[i * 3 + 2] = acc[i * 3 + 2] / l; }
  return out;
}
/** shells use the body's mid-LOD triangles for both the mid and the far costume: one geometry serves both */
const SHELLS = new Set(['robe_upper', 'tunic_upper', 'work_upper', 'child_upper', 'dress_upper', 'trousers', 'work_trousers', 'hair', 'beard_short', 'headcloth']); // (D-206: footwear and the felt cap are lofted with their own far tessellation) // (the bob is a shell and a curtain: its own far geometry, D-155)
const geoLod = (id: string, lod: number) => (SHELLS.has(id) && lod === 2 ? 1 : lod);
const geoKey = (id: string, lod: number) => `${id}@${geoLod(id, lod)}`;
/** placement order: pieces a belt is fitted over come first */
const ORDER = (id: string) => (id === 'belt' ? 2 : id.includes('upper') || id.includes('skirt') ? 0 : 1);

/** share of the far costume's triangles kept by the farthest LOD (C) */
export const FAR_KEEP = 0.2;
/** the farthest LOD's error bound for a piece, as a share of its own extent (D-205; C) */
export const PIECE_ERR = 0.12;
export function buildOutfits(A: HumanAssets, opts: { dresses?: Dress[]; lods?: number[]; variants?: string[]; profile?: Record<string, number>;
  /** index-only simplifier (meshoptimizer) for the farthest LOD; without it there are three LODs */
  simplify?: (index: Uint32Array, pos: Float32Array, targetTris: number, absError?: number) => Uint32Array } = {}): OutfitBuild {
  const t0 = performance.now();
  const ref = A.byId.m03 ?? A.variants[0];
  const J = (b: HBone): V3 => [ref.joints[HB[b] * 3], ref.joints[HB[b] * 3 + 1], ref.joints[HB[b] * 3 + 2]];
  const L: Lib = { A, ref, J };
  const dresses = (opts.dresses ?? BUILT).map(d => COSTUME_OF[d]).filter((d, i, a) => a.indexOf(d) === i), lods = opts.lods ?? [0, 1, 2];
  // distinct piece geometries (LOD1 and LOD2 shells share a tessellation → same key)
  const geos: Record<string, Geo> = {};
  const need: { id: string; lod: number }[] = [];
  for (const d of dresses) for (const l of lods) for (const id of [...COSTUMES[d].always, ...COSTUMES[d].opt]) need.push({ id, lod: l });
  for (const { id, lod } of need) { const k = geoKey(id, lod); if (!geos[k]) geos[k] = buildPiece(L, id, geoLod(id, lod)); }
  if (opts.profile) opts.profile.$construct = performance.now() - t0;
  // vertex source layout
  const pieceBase: Record<string, number> = {}; let NV = A.NO;
  for (const k of Object.keys(geos).sort((a, b) => ORDER(a.split('@')[0]) - ORDER(b.split('@')[0]))) { pieceBase[k] = NV; NV += geos[k].n; }
  const variants = opts.variants ? A.variants.filter(v => opts.variants!.includes(v.meta.id)) : A.variants;
  const source = new Float32Array(A.variants.length * NV * 4);
  const keys = Object.keys(pieceBase);
  for (const v of variants) {
    const base = v.index * NV * 4;
    for (let i = 0; i < A.NO; i++) { source[base + i * 4] = v.pos[i * 3]; source[base + i * 4 + 1] = v.pos[i * 3 + 1]; source[base + i * 4 + 2] = v.pos[i * 3 + 2]; source[base + i * 4 + 3] = packNormal(v.nrm[i * 3], v.nrm[i * 3 + 1], v.nrm[i * 3 + 2]); }
    const c: Ctx = { A, v, J: (b: HBone) => [v.joints[HB[b] * 3], v.joints[HB[b] * 3 + 1], v.joints[HB[b] * 3 + 2]], placed: new Map() };
    for (const k of keys) { const g = geos[k]; const t1 = opts.profile ? performance.now() : 0; const pos = g.place(c); if (opts.profile) opts.profile[k] = (opts.profile[k] ?? 0) + performance.now() - t1; c.placed.set(k, pos); const nr = geoNormals(pos, g.index, g.n); const o = base + pieceBase[k] * 4;
      for (let i = 0; i < g.n; i++) { source[o + i * 4] = pos[i * 3]; source[o + i * 4 + 1] = pos[i * 3 + 1]; source[o + i * 4 + 2] = pos[i * 3 + 2]; source[o + i * 4 + 3] = packNormal(nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]); } }
  }
  if (opts.profile) opts.profile.$source = performance.now() - t0;
  // costumes: body triangles (minus covered) + pieces
  const costumes = {} as Record<Dress, CostumeLOD[]>;
  const refBase = ref.index * NV * 4; const beardV = beardMask(L), extras = bodyExtras(L);
  for (const d of dresses) {
    const cov = coverage(L, d); costumes[d] = [];
    for (const lod of lods) {
      const tris = A.lods[lod]; const bodyIdx: number[] = [];
      for (let t = 0; t < tris.length; t += 3) { const a = tris[t], b = tris[t + 1], cc = tris[t + 2]; if (cov[a] && cov[b] && cov[cc]) continue;
        if (isCornea(A, a) && isCornea(A, b) && isCornea(A, cc)) continue; // the transparent cornea layer of the high-poly eye (no blending here)
        bodyIdx.push(a, b, cc); }
      const vmap = new Map<number, number>(); const verts: { tid: number; kind: 'body' | 'piece'; g?: Geo; i: number; bit: number }[] = [];
      const index: number[] = []; const pieceTris: Record<string, number> = { body: bodyIdx.length / 3 };
      for (const i of bodyIdx) { let k = vmap.get(i); if (k === undefined) { k = verts.length; vmap.set(i, k); verts.push({ tid: i, kind: 'body', i, bit: 0 }); } index.push(k); }
      const ranges: [string, number, number][] = [['body', 0, index.length]]; // index ranges per piece (the farthest LOD simplifies each)
      for (const id of [...COSTUMES[d].always, ...COSTUMES[d].opt]) { const key = geoKey(id, lod), g = geos[key]; const bit = pieceBit(d, id), off = verts.length; ranges.push([id, index.length, index.length + g.index.length]);
        for (let i = 0; i < g.n; i++) verts.push({ tid: pieceBase[key] + i, kind: 'piece', g, i, bit });
        for (const i of g.index) index.push(off + i); pieceTris[id] = g.index.length / 3; }
      const n = verts.length;
      const out: CostumeLOD = { dress: d, lod, tid: new Float32Array(n), skinIndex: new Uint8Array(n * 4), skinWeight: new Uint8Array(n * 4), uv: new Float32Array(n * 2), hmat: new Uint8Array(n * 4), hext: new Uint8Array(n * 4),
        refPos: new Float32Array(n * 3), refNrm: new Float32Array(n * 3), index: Uint32Array.from(index), triangles: index.length / 3, bodyTriangles: bodyIdx.length / 3, pieceTris };
      for (let k = 0; k < n; k++) { const q = verts[k];
        out.tid[k] = q.tid;
        const s = refBase + q.tid * 4; out.refPos[k * 3] = source[s]; out.refPos[k * 3 + 1] = source[s + 1]; out.refPos[k * 3 + 2] = source[s + 2]; const nn = unpackNormal(source[s + 3]); out.refNrm[k * 3] = nn[0]; out.refNrm[k * 3 + 1] = nn[1]; out.refNrm[k * 3 + 2] = nn[2];
        if (q.kind === 'body') { const i = q.i; for (let j = 0; j < 4; j++) { out.skinIndex[k * 4 + j] = A.skinIndex[i * 4 + j]; out.skinWeight[k * 4 + j] = A.skinWeight[i * 4 + j]; }
          out.uv[k * 2] = A.uv[i * 2]; out.uv[k * 2 + 1] = A.uv[i * 2 + 1];
          const pt = A.part[i]; const mat = pt === PART.eye ? MAT.eye : pt === PART.teeth ? MAT.teeth : pt === PART.tongue ? MAT.mouth : pt === PART.lash ? MAT.lash : MAT.skin;
          out.hmat[k * 4] = mat; out.hmat[k * 4 + 1] = mat === MAT.lash ? COL.hair : mat === MAT.skin ? COL.skin : COL.fixed; out.hext[k * 4] = Math.round(255 * A.ao[i]); out.hext[k * 4 + 1] = extras.hy[i]; out.hext[k * 4 + 2] = Math.round(255 * beardV[i]); out.hext[k * 4 + 3] = extras.hw[i]; }
        else { const g = q.g!, i = q.i; for (let j = 0; j < 4; j++) { out.skinIndex[k * 4 + j] = g.si[i * 4 + j]; out.skinWeight[k * 4 + j] = g.sw[i * 4 + j]; } out.uv[k * 2] = g.uv[i * 2]; out.uv[k * 2 + 1] = g.uv[i * 2 + 1];
          out.hmat[k * 4] = g.mat[i]; out.hmat[k * 4 + 1] = g.col[i]; out.hmat[k * 4 + 2] = q.bit; out.hmat[k * 4 + 3] = g.prm[i]; out.hext[k * 4] = g.ao[i]; out.hext[k * 4 + 1] = g.slack[i]; out.hext[k * 4 + 2] = g.aux[i]; out.hext[k * 4 + 3] = g.edge[i]; }
      }
      costumes[d].push(out);
      // the farthest costume: the far one simplified (index-only, meshoptimizer), the body and each piece on its own (hidden
      // optional pieces stay separable). Same vertices, a fifth or so of the triangles. D-205: simplified as one mesh, the
      // error bound (3 % of the whole figure, ~5 cm) removed every thin piece whole — the belt of every costume, the
      // guards' bow, fillets, torques, headbands and the sword — so the farthest body drew fewer pieces than the look wore;
      // each piece now has its own bound (3 % of its own extent) and keeps at least 4 triangles
      if (lod === 2 && opts.simplify) {
        const parts: Uint32Array[] = [];
        for (const [id, a, b] of ranges) { if (b <= a) continue; const sub = out.index.slice(a, b), tris = sub.length / 3;
          if (id === 'body') { parts.push(opts.simplify(sub, out.refPos, Math.round(tris * FAR_KEEP))); continue; }
          const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
          for (const v of sub) for (let e = 0; e < 3; e++) { const x = out.refPos[v * 3 + e]; if (x < lo[e]) lo[e] = x; if (x > hi[e]) hi[e] = x; }
          const ext = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
          // (D-215: a piece smaller than the error bound — an earring, a bracelet — is removed whole by the simplifier: it
          // keeps its far geometry instead, so the farthest body still draws what the look wears)
          const simp = opts.simplify(sub, out.refPos, Math.min(tris, Math.max(4, Math.round(tris * FAR_KEEP))), PIECE_ERR * ext); parts.push(simp.length >= 12 ? simp : sub); }
        const idx = new Uint32Array(parts.reduce((x, q) => x + q.length, 0)); let o = 0; for (const q of parts) { idx.set(q, o); o += q.length; }
        const far: CostumeLOD = { ...out, lod: 3, index: idx, triangles: idx.length / 3, bodyTriangles: -1, pieceTris: {},
          tid: out.tid.slice(), skinIndex: out.skinIndex.slice(), skinWeight: out.skinWeight.slice(), uv: out.uv.slice(), hmat: out.hmat.slice(), hext: out.hext.slice(), refPos: out.refPos.slice(), refNrm: out.refNrm.slice() };
        costumes[d].push(far);
      }
    }
  }
  if (opts.profile) opts.profile.$assemble = performance.now() - t0;
  return { NV, pieceBase, geos, source, costumes, ms: performance.now() - t0 };
}
