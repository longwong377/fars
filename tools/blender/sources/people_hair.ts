// Source of the people's hair (D-307): strand cards groomed on the reference body's head from the project's own data, bound
// to the body's topology, and the job for the strand atlas Blender renders (tools/blender/hair_atlas.py). Nothing is placed
// by hand: the regions are the body's own masks (the scalp mask of tools/build_humans.ts, outfits.ts beardMask, the brow
// density of skin.png), the flow is a rule (away from the crown's whorl and down; beards down from the jaw, the moustache
// out to the corners of the mouth; brows out from the nose), the lengths and counts are the registry's arguments (C: after
// the reliefs' hair to the nape gathered in a bunch, the square-cut beard to the upper chest, the bob to the jaw;
// research/MATERIAL_CULTURE.md "Hair and beards").
//
// A card is a strip of quads walked from its root along the flow over the head: each step is kept `lift` off the surface
// (the lift grows from root to tip: hair has volume), turns toward the ground as it goes, and leaves the surface where the
// surface falls away (below the ears, under the jaw), then hangs. The strip lies across the flow, its face outward. Each
// vertex is anchored at the surface point where the card last touched the head (a triangle and two barycentric weights) with
// its offset from there, so the card hangs from the same place on every body variant (src/people/peopleModels.ts).
// Usage: npx tsx tools/blender/sources/people_hair.ts <srcDir> <outDir> <argsJson>
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { decodeHumanAssets, type HumanAssets, type HumanVariant } from '../../../src/people/humanAssets';
import { HB, PART, type HBone } from '../../../src/people/humanFormat';
import { beardMask } from '../../../src/people/outfits';
import { BinWriter, type CardsMeta, type CardSetMeta } from '../../../src/people/peopleModels';
import { decodePNG } from '../../humans/png';

const [srcDir, outDir, argJson] = process.argv.slice(2);
if (!srcDir || !outDir || !argJson) { console.error('usage: people_hair.ts <srcDir> <outDir> <argsJson>'); process.exit(2); }
const ARGS = JSON.parse(readFileSync(argJson, 'utf8'));
mkdirSync(srcDir, { recursive: true }); mkdirSync(outDir, { recursive: true });
const t0 = Date.now(); const log = (...a: unknown[]) => console.log(`[people_hair ${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s], dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]), nrm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sstep = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const rnd = (seed: number) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---------------------------------------------------------------- the reference body
const HD = 'public/generated/humans';
const bin = readFileSync(`${HD}/humans.bin`);
const A: HumanAssets = decodeHumanAssets(JSON.parse(readFileSync(`${HD}/humans.json`, 'utf8')), bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);
const ref: HumanVariant = A.byId[ARGS.ref ?? 'm03'];
const J = (b: HBone): V3 => [ref.joints[HB[b] * 3], ref.joints[HB[b] * 3 + 1], ref.joints[HB[b] * 3 + 2]];
const P = (i: number): V3 => [ref.pos[i * 3], ref.pos[i * 3 + 1], ref.pos[i * 3 + 2]];
const rv = (pid: number) => { for (let i = 0; i < A.NO; i++) if (A.orig[i] === pid) return i; throw new Error('landmark ' + pid); };
const headTop = P(rv(A.meta.landmarks.head_top)), chin = P(rv(A.meta.landmarks.chin)), nose = P(rv(A.meta.landmarks.nose_tip));
const headH = headTop[1] - chin[1], eyeY = ref.eyeY, hz = J('head')[2];
log(`reference ${ref.meta.id}: head ${headH.toFixed(3)} m (top ${headTop[1].toFixed(3)}, chin ${chin[1].toFixed(3)}), eye ${eyeY.toFixed(3)}`);

// the colliding surface: the full-detail body's head, neck and chest triangles
const SURF_PARTS = new Set<number>([PART.head, PART.neck, PART.chest]);
const tris: number[] = []; { const T = A.lods[0]; for (let t = 0; t < T.length; t += 3) { const a = T[t], b = T[t + 1], c = T[t + 2]; if ([a, b, c].every(i => SURF_PARTS.has(A.part[i]))) tris.push(a, b, c); } }
const NT = tris.length / 3;
const triN: V3[] = []; for (let t = 0; t < NT; t++) triN.push(nrm(cross(sub(P(tris[t * 3 + 1]), P(tris[t * 3])), sub(P(tris[t * 3 + 2]), P(tris[t * 3])))));
// a grid of triangles (2 cm cells) for the nearest-point queries
const G = 0.02, grid = new Map<string, number[]>(); const gk = (x: number, y: number, z: number) => `${x},${y},${z}`;
for (let t = 0; t < NT; t++) { const ps = [0, 1, 2].map(k => P(tris[t * 3 + k])); const lo = [0, 1, 2].map(e => Math.floor(Math.min(...ps.map(p => p[e])) / G)), hi = [0, 1, 2].map(e => Math.floor(Math.max(...ps.map(p => p[e])) / G));
  for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = gk(x, y, z); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(t); } }
/** closest point on triangle abc to p (Ericson, Real-Time Collision Detection 5.1.5): point and barycentrics */
function closestTri(p: V3, a: V3, b: V3, c: V3): { q: V3; u: number; v: number; w: number } {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a); const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return { q: a, u: 1, v: 0, w: 0 };
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return { q: b, u: 0, v: 1, w: 0 };
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return { q: add(a, scl(ab, v)), u: 1 - v, v, w: 0 }; }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return { q: c, u: 0, v: 0, w: 1 };
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return { q: add(a, scl(ac, w)), u: 1 - w, v: 0, w }; }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return { q: add(b, scl(sub(c, b), w)), u: 0, v: 1 - w, w }; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; return { q: add(a, add(scl(ab, v), scl(ac, w))), u: 1 - v - w, v, w };
}
interface Hit { t: number; q: V3; bary: [number, number, number]; d: number; n: V3 }
/** the nearest surface point within `r` (m; null if none) */
function nearest(p: V3, r = 0.04): Hit | null {
  let best: Hit | null = null; const R = Math.ceil(r / G), c = p.map(x => Math.floor(x / G)); const seen = new Set<number>();
  for (let x = c[0] - R; x <= c[0] + R; x++) for (let y = c[1] - R; y <= c[1] + R; y++) for (let z = c[2] - R; z <= c[2] + R; z++) { const l = grid.get(gk(x, y, z)); if (!l) continue;
    for (const t of l) { if (seen.has(t)) continue; seen.add(t); const h = closestTri(p, P(tris[t * 3]), P(tris[t * 3 + 1]), P(tris[t * 3 + 2])); const d = len(sub(p, h.q));
      if (d <= r && (!best || d < best.d)) best = { t, q: h.q, bary: [h.u, h.v, h.w], d, n: triN[t] }; } }
  return best;
}
// the smooth normal at a hit (the triangle's vertex normals, barycentric): cards lie on the head's curvature, not its facets
const hitN = (h: Hit): V3 => nrm([0, 1, 2].reduce((s, k) => add(s, scl([ref.nrm[tris[h.t * 3 + k] * 3], ref.nrm[tris[h.t * 3 + k] * 3 + 1], ref.nrm[tris[h.t * 3 + k] * 3 + 2]], h.bary[k])), [0, 0, 0] as V3));

// ---------------------------------------------------------------- regions (per render vertex of the reference, 0..1)
const scalpR = new Float32Array(A.NO), beardR = beardMask({ A, ref, J }), browR = new Float32Array(A.NO), napeR = new Float32Array(A.NO);
{ const skin = decodePNG(readFileSync(`${HD}/skin.png`)); const hw = skin.width / 2;
  for (let i = 0; i < A.NO; i++) { const pt = A.part[i]; if (pt !== PART.head && pt !== PART.neck) continue; const p = P(i);
    // the scalp: the body's baked scalp mask and the sideburns in front of the ears (as outfits.ts hairShell)
    const side = Math.max(Math.min(Math.abs(p[0]) - 0.058, hz + 0.068 - p[2], p[2] - (hz + 0.022), p[1] - (eyeY - 0.035)), Math.min(Math.abs(p[0]) - 0.045, hz - 0.036 - p[2], p[1] - (eyeY - 0.045)));
    scalpR[i] = Math.max(sstep(0.45, 0.6, A.scalp[i]), sstep(0, 0.006, side));
    const x = Math.min(hw - 1, Math.floor(A.uv[i * 2] * hw)), y = Math.min(skin.height - 1, Math.floor((1 - A.uv[i * 2 + 1]) * skin.height));
    browR[i] = pt === PART.head && p[2] > hz + 0.05 ? skin.data[(y * skin.width + x) * 4 + 3] / 255 : 0;
    // the nape and the back of the skull below the crown (the bunch of hair at the back of the neck, the reliefs)
    napeR[i] = p[2] < hz - 0.02 && p[1] < J('head')[1] + 0.05 && p[1] > J('neck_01')[1] - 0.005 ? Math.max(sstep(0.35, 0.6, A.scalp[i]), pt === PART.neck && p[2] < J('neck_01')[2] - 0.02 && p[1] > J('neck_01')[1] ? 1 : 0) : 0; }
}

// ---------------------------------------------------------------- root sampling: area-weighted, then thinned to a spacing
function sampleRoots(region: Float32Array, thr: number, spacing: number, seed: number, keep?: (p: V3) => boolean): Hit[] {
  const r = rnd(seed); const areas: number[] = [], ids: number[] = []; let tot = 0;
  const T = A.lods[0];
  for (let t = 0; t < T.length; t += 3) { const a = T[t], b = T[t + 1], c = T[t + 2]; if (![a, b, c].every(i => A.part[i] === PART.head || A.part[i] === PART.neck)) continue;
    const m = (region[a] + region[b] + region[c]) / 3; if (m < thr) continue; const ar = len(cross(sub(P(b), P(a)), sub(P(c), P(a)))) / 2; tot += ar; areas.push(tot); ids.push(t); }
  const want = Math.ceil((tot / (spacing * spacing)) * 3); const cand: V3[] = [];
  for (let k = 0; k < want; k++) { const x = r() * tot; let lo = 0, hi = areas.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (areas[m] < x) lo = m + 1; else hi = m; }
    const t = ids[lo]; let u = r(), v = r(); if (u + v > 1) { u = 1 - u; v = 1 - v; } const a = P(T[t]), b = P(T[t + 1]), c = P(T[t + 2]);
    const p = add(a, add(scl(sub(b, a), u), scl(sub(c, a), v))); if (!keep || keep(p)) cand.push(p); }
  const out: Hit[] = []; const taken: V3[] = [];
  for (const p of cand) { if (taken.some(q => len(sub(p, q)) < spacing)) continue; const h = nearest(p, 0.01); if (!h) continue; taken.push(p); out.push(h); }
  return out;
}

// ---------------------------------------------------------------- the walk
interface Style {
  /** card length range (m), width at root and tip (m), lift off the surface at root and tip (m), segments, gravity turn per
   *  metre, flow at a root (unit, tangent to the surface), where the card is cut (a y below which it ends), class, ao */
  len: [number, number]; width: [number, number]; lift: [number, number]; segs: number; gravity: number;
  flow: (p: V3, n: V3) => V3; cutY?: (p: V3, root: V3) => number; cls: number; ao: [number, number];
  /** the length's factor at a root (a moustache is short, whatever the beard) */
  lenK?: (root: V3) => number;
  /** extra colliders: points pushed out of (bun ellipsoid, chest) */
  push?: (p: V3) => V3;
  /** where a card may still be drawn back onto the surface (default everywhere): a beard hangs free below the jaw */
  stick?: (p: V3) => boolean;
}
interface Card { pts: V3[]; across: V3[]; hits: Hit[]; offs: V3[]; width: number[]; col: number; cls: number; ao: [number, number] }
const tangent = (d: V3, n: V3): V3 => nrm(sub(d, scl(n, dot(d, n))));
function walk(root: Hit, st: Style, r: () => number): Card | null {
  const L = lerp(st.len[0], st.len[1], r()) * (st.lenK ? st.lenK(root.q) : 1), step = L / st.segs;
  const n = hitN(root); let d = tangent(st.flow(root.q, n), n); if (!Number.isFinite(d[0])) return null;
  let p = add(root.q, scl(n, st.lift[0])); let contact = root;
  const pts: V3[] = [p], hits: Hit[] = [root], across: V3[] = [];
  for (let k = 1; k <= st.segs; k++) {
    const t = k / st.segs, lift = lerp(st.lift[0], st.lift[1], t);
    d = nrm(add(d, [0, -st.gravity * step, 0])); // turning toward the ground (hair falls), more as it goes
    let q = add(p, scl(d, step));
    const h = nearest(q, lift + 0.012);
    if (h) { const hn = hitN(h); const e = dot(sub(q, h.q), hn);
      // on the surface: kept at the lift (pushed out, or pulled in where the head curves away under the card while it is
      // still near and not falling away from it: hair lies on the head until it falls free)
      if (e < lift || (e < lift + 0.006 && dot(d, hn) > -0.2 && (!st.stick || st.stick(q)))) { q = add(h.q, scl(hn, lift)); contact = h; }
    }
    if (st.push) q = st.push(q);
    if (st.cutY && q[1] < st.cutY(q, root.q)) { // cut square: end the card on the cut plane
      const y0 = p[1], y1 = q[1], c = st.cutY(q, root.q); const f = (y0 - c) / Math.max(1e-6, y0 - y1); q = add(p, scl(sub(q, p), clamp(f))); pts.push(q); hits.push(contact); break; }
    d = nrm(sub(q, p)); p = q; pts.push(p); hits.push(contact);
  }
  if (pts.length < 2) return null;
  const nn = pts.length;
  for (let k = 0; k < nn; k++) { const dd = nrm(sub(pts[Math.min(nn - 1, k + 1)], pts[Math.max(0, k - 1)]));
    // on the head the card lies on it (the contact's normal); hanging free it faces out from the head's axis
    const free = len(sub(pts[k], hits[k].q)) > st.lift[1] + 0.012, radial = nrm([pts[k][0], 0, pts[k][2] - (hz - 0.01)]);
    const nk = k === 0 ? n : free ? radial : hitN(hits[k]);
    let a = nrm(cross(dd, nk)); if (!Number.isFinite(a[0]) || len(cross(dd, nk)) < 1e-4) a = across[k - 1] ?? [1, 0, 0]; across.push(a); }
  const width = pts.map((_, k) => lerp(st.width[0], st.width[1], k / (nn - 1)));
  const offs = pts.map((q, k) => sub(q, hits[k].q));
  return { pts, across, hits, offs, width, col: Math.floor(r() * 8), cls: st.cls, ao: st.ao };
}

// ---------------------------------------------------------------- the styles (every number C; the registry's arguments)
const down: V3 = [0, -1, 0];
const whorl: V3 = [0, headTop[1] - 0.012, hz - 0.035]; // the crown's whorl, a little behind the top (C)
const scalpFlow = (p: V3): V3 => { const r = sub(p, whorl); r[1] = Math.min(r[1], 0) - 0.02; return nrm(add(nrm(r), scl(down, 0.35))); };
// men's hair combed back from the brow and down behind the ears to the bunch at the nape (the reliefs: C for real hair)
const backFlow = (p: V3): V3 => nrm([p[0] * 1.5, -0.45 - 0.5 * sstep(hz, hz - 0.06, p[2]) - 2.5 * sstep(eyeY + 0.03, eyeY - 0.03, p[1]), -1 + 0.8 * sstep(eyeY + 0.03, eyeY - 0.03, p[1])]); // (the sideburns and the hair below the temples fall down, not back)
// the bob's fringe is cut above the brows, the rest at the jaw
const bobCut = (dy: number) => (q: V3, r0: V3) => (r0[2] > hz + 0.045 && Math.abs(r0[0]) < 0.055 ? eyeY + 0.022 : J('jaw')[1] - dy);
// the bun: the bunch at the nape (outfits.ts bunGeo's ellipsoid on the reference), pushed out of by the nape cards
const bun = (() => { const h = J('head'), nk = J('neck_01'); const y = lerp(nk[1], h[1], 0.35); let zb = 1; for (let i = 0; i < A.NO; i++) { const pt = A.part[i]; if (pt !== PART.head && pt !== PART.neck) continue; if (Math.abs(ref.pos[i * 3 + 1] - y) > 0.012 || Math.abs(ref.pos[i * 3]) > 0.03) continue; zb = Math.min(zb, ref.pos[i * 3 + 2]); } return { c: [0, y + 0.005, zb + 0.012] as V3, r: [0.068, 0.05, 0.036] as V3 }; })();
const outOfBun = (q: V3): V3 => { const R = bun.r.map(x => x + 0.006) as V3; const e: V3 = [(q[0] - bun.c[0]) / R[0], (q[1] - bun.c[1]) / R[1], (q[2] - bun.c[2]) / R[2]]; const l = len(e); if (l >= 1 || q[2] > bun.c[2] + 0.01) return q; return add(bun.c, [e[0] / l * R[0], e[1] / l * R[1], e[2] / l * R[2]]); };
// the chest's front below the chin (the long beard hangs clear of it, and of a robe ~1.5 cm over it)
const chestZs = new Map<number, number>();
const chestAt = (y: number) => { const k = Math.round(y * 200); let z = chestZs.get(k); if (z === undefined) { z = -1; for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.chest && A.part[i] !== PART.neck) continue; if (Math.abs(ref.pos[i * 3 + 1] - k / 200) > 0.01 || Math.abs(ref.pos[i * 3]) > 0.06) continue; z = Math.max(z, ref.pos[i * 3 + 2]); } chestZs.set(k, z); } return z; };
const offChest = (q: V3): V3 => { if (q[1] > chin[1] - 0.01) return q; const z = chestAt(q[1]) + 0.022; return q[2] < z ? [q[0], q[1], z] : q; };
const S = ARGS.styles;
// short hair ends at the nape (the bunch below it is the bun's); a beard is drawn onto the face only above the chin
const napeCut = () => J('neck_01')[1] + 0.012, aboveChin = (q: V3) => q[1] > chin[1] + 0.004;
const mouthY = (() => { let upLow = Infinity, loHigh = -Infinity; for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.head) continue; const p = P(i); if (Math.abs(p[0]) > 0.0025 || p[1] < chin[1] || p[1] > nose[1] - 0.01 || p[2] < nose[2] - 0.03) continue;
  let w = 0; for (let k = 0; k < 4; k++) if (A.skinIndex[i * 4 + k] === HB.jaw) w = A.skinWeight[i * 4 + k] / 255; if (w < 0.3) upLow = Math.min(upLow, p[1]); else if (w > 0.5) loHigh = Math.max(loHigh, p[1]); } return (upLow + loHigh) / 2; })();
const beardFlow = (p: V3): V3 => { // down; the moustache out to the corners of the mouth; the cheeks down and a little forward
  if (isMoustache(p)) return nrm([Math.sign(p[0] || 1) * 0.9, -0.55, 0]);
  return nrm([p[0] * 0.8, -1, 0.15]); };
const isMoustache = (p: V3) => p[1] > mouthY - 0.004 && Math.abs(p[0]) < 0.035 && p[2] > nose[2] - 0.045;
const moustacheK = (len: number) => (p: V3) => (isMoustache(p) ? 0.032 / len : 1);
const browFlow = (p: V3): V3 => nrm([Math.sign(p[0] || 1), 0.35 * (1 - clamp(Math.abs(p[0]) / 0.055)), 0]);
const STYLES: Record<string, { region: Float32Array; thr: number; spacing: number; layers: (Style & { spacingK?: number })[]; note: string }> = {
  hair: { region: scalpR, thr: 0.5, spacing: S.hair.spacing, note: 'scalp hair: two layers of cards away from the crown and down, the outer shorter (volume, a broken outline)',
    layers: [
      { len: S.hair.len, width: S.hair.width, lift: S.hair.lift, segs: 3, gravity: 5, flow: backFlow, cls: 0, ao: [0.55, 0.9], cutY: napeCut },
      { len: S.hair.len2, width: S.hair.width2, lift: S.hair.lift2, segs: 2, gravity: 4, flow: backFlow, cls: 0, ao: [0.8, 1], spacingK: 1.5, cutY: napeCut } ] },
  hair_bob: { region: scalpR, thr: 0.5, spacing: S.bob.spacing, note: 'the bob: cards from the scalp falling to the jaw, cut level',
    layers: [
      { len: S.bob.len, width: S.bob.width, lift: S.bob.lift, segs: 6, gravity: 9, flow: scalpFlow, cls: 0, ao: [0.55, 0.95], cutY: bobCut(0.02) },
      { len: S.bob.len, width: S.bob.width2, lift: S.bob.lift2, segs: 5, gravity: 9, flow: scalpFlow, cls: 0, ao: [0.75, 1], cutY: bobCut(0.025), spacingK: 1.6 } ] },
  bun: { region: napeR, thr: 0.5, spacing: S.bun.spacing, note: 'the bunch at the nape: cards from the back of the skull over the bun',
    layers: [{ len: S.bun.len, width: S.bun.width, lift: S.bun.lift, segs: 4, gravity: 3, flow: () => down, cls: 0, ao: [0.6, 1], push: outOfBun }] },
  beard_long: { region: beardR, thr: 0.5, spacing: S.beard_long.spacing, note: 'the long beard: cards down from the cheeks, chin and upper lip, hanging below the jaw to a square cut',
    layers: [
      { len: S.beard_long.len, width: S.beard_long.width, lift: S.beard_long.lift, segs: 5, gravity: 12, flow: beardFlow, lenK: moustacheK(S.beard_long.len[1]), cls: 1, ao: [0.55, 0.9], cutY: () => chin[1] - S.beard_long.below, stick: aboveChin },
      { len: S.beard_long.len, width: S.beard_long.width2, lift: S.beard_long.lift2, segs: 5, gravity: 12, flow: beardFlow, lenK: moustacheK(S.beard_long.len[1]), cls: 1, ao: [0.75, 1], cutY: () => chin[1] - S.beard_long.below + 0.006, stick: aboveChin, spacingK: 1.4 } ] },
  beard_short: { region: beardR, thr: 0.5, spacing: S.beard_short.spacing, note: 'the short beard: short cards lying close, down and out',
    layers: [{ len: S.beard_short.len, width: S.beard_short.width, lift: S.beard_short.lift, segs: 2, gravity: 4, flow: beardFlow, cls: 1, ao: [0.6, 1] }] },
  brows: { region: browR, thr: 0.35, spacing: S.brows.spacing, note: 'the brows: short cards along the brow, out from the nose and up at the inner end',
    layers: [{ len: S.brows.len, width: S.brows.width, lift: S.brows.lift, segs: 2, gravity: 0, flow: browFlow, cls: 2, ao: [0.8, 1] }] },
};

/** the bunch at the nape: cards laid over the bun's ellipsoid (outfits.ts bunGeo: the game draws it as the core under
 *  them), from its top down over its back, anchored at the nearest point of the nape (the bun is placed from the variant's
 *  own neck, and so are they) */
function bunCards(r: () => number): Card[] {
  const R = bun.r, c = bun.c, out: Card[] = [], B = S.bun; const lift = (t: number) => lerp(B.lift[0], B.lift[1], t);
  const onE = (q: V3, l: number): { p: V3; n: V3 } => { const Rl: V3 = [R[0] + l, R[1] + l, R[2] + l]; const e: V3 = [(q[0] - c[0]) / Rl[0], (q[1] - c[1]) / Rl[1], (q[2] - c[2]) / Rl[2]]; const m = len(e) || 1;
    const p: V3 = [c[0] + e[0] / m * Rl[0], c[1] + e[1] / m * Rl[1], c[2] + e[2] / m * Rl[2]]; return { p, n: nrm([(p[0] - c[0]) / (Rl[0] * Rl[0]), (p[1] - c[1]) / (Rl[1] * Rl[1]), (p[2] - c[2]) / (Rl[2] * Rl[2])]) }; };
  // roots on a jittered grid over the upper back of the ellipsoid (azimuth about +Y from the back, elevation from the top)
  const na = Math.round(Math.PI * R[0] / B.spacing), ne = Math.max(2, Math.round(0.5 * Math.PI * R[1] / B.spacing));
  for (let i = 0; i < na; i++) for (let j = 0; j < ne; j++) {
    const az = (-0.5 + (i + 0.5 + (r() - 0.5) * 0.6) / na) * Math.PI * 0.95, el = (0.12 + (j + (r() - 0.5) * 0.6) / ne * 0.55) * Math.PI;
    let { p, n } = onE([c[0] + Math.sin(az) * Math.sin(el), c[1] + Math.cos(el), c[2] - Math.cos(az) * Math.sin(el)], lift(0));
    const root = nearest(p, 0.14); if (!root) continue;
    const L = lerp(B.len[0], B.len[1], r()), segs = 4, step = L / segs; const pts: V3[] = [p], across: V3[] = [];
    for (let k = 1; k <= segs; k++) { const d = tangent(down, n); const q = onE(add(p, scl(d, step)), lift(k / segs)); p = q.p; n = q.n; pts.push(p); }
    for (let k = 0; k < pts.length; k++) { const dd = nrm(sub(pts[Math.min(pts.length - 1, k + 1)], pts[Math.max(0, k - 1)])); const nk = onE(pts[k], 0).n; across.push(nrm(cross(dd, nk))); }
    const width = pts.map((_, k) => lerp(B.width[0], B.width[1], k / (pts.length - 1)));
    out.push({ pts, across, hits: pts.map(() => root), offs: pts.map(q => sub(q, root.q)), width, col: Math.floor(r() * 8), cls: 0, ao: [0.6, 1] });
  }
  return out;
}

// ---------------------------------------------------------------- groom, bind, write
const W = new BinWriter(); const sets: Record<string, CardSetMeta> = {}; const stats: Record<string, any> = {};
let seed = ARGS.seed ?? 7;
for (const [id, S0] of Object.entries(STYLES)) {
  const cards: Card[] = [];
  if (id === 'bun') cards.push(...bunCards(rnd(++seed * 7919)));
  else for (const [li, st] of S0.layers.entries()) {
    const roots = sampleRoots(S0.region, S0.thr, S0.spacing * (st.spacingK ?? 1), ++seed * 7919 + li);
    const r = rnd(seed * 31 + li);
    for (const h of roots) { const c = walk(h, st, r); if (c) cards.push(c); }
  }
  // the scalp's cards rooted above the line a hat's rim covers (outfits.ts headRingFrame: eye height + 4.5 cm, 0.1 rad lower
  // at the back) are their own set, hair_crown, worn only bareheaded (looks.ts): no card through the felt
  if (id === 'hair') { const crown = (c: Card) => { const q = c.hits[0].q; return q[1] > eyeY + 0.042 - 0.1 * Math.max(0, hz - q[2]); };
    writeSet('hair_crown', cards.filter(crown), 'scalp hair above the hat line: worn bareheaded only');
    writeSet('hair', cards.filter(c => !crown(c)), S0.note + ' (below the hat line; above it: hair_crown)'); }
  else writeSet(id, cards, S0.note);
}
function writeSet(id: string, cards: Card[], note: string) {
  // vertices: two per card point (left, right), anchored at each point's contact
  const nv = cards.reduce((s, c) => s + c.pts.length * 2, 0);
  const anchor = new Uint16Array(nv * 3), bary = new Float32Array(nv * 2), off = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), cell = new Uint8Array(nv), ao = new Uint8Array(nv); const index: number[] = [];
  let v = 0;
  for (const c of cards) { const n = c.pts.length, base = v;
    for (let k = 0; k < n; k++) for (const s of [-1, 1]) {
      const h = c.hits[k]; for (let e = 0; e < 3; e++) anchor[v * 3 + e] = tris[h.t * 3 + e]; bary[v * 2] = h.bary[0]; bary[v * 2 + 1] = h.bary[1];
      const o = add(c.offs[k], scl(c.across[k], s * c.width[k] / 2)); off.set(o, v * 3);
      uv[v * 2] = s < 0 ? 0 : 1; uv[v * 2 + 1] = k / (n - 1); cell[v] = c.cls * 8 + c.col; ao[v] = Math.round(255 * lerp(c.ao[0], c.ao[1], k / (n - 1))); v++; }
    for (let k = 0; k + 1 < n; k++) { const l0 = base + k * 2, r0 = l0 + 1, l1 = l0 + 2, r1 = l0 + 3; index.push(l0, r0, l1, r0, r1, l1); } }
  if (v > 65535) throw new Error(id + ': too many vertices');
  sets[id] = { n: nv, tris: index.length / 3, cards: cards.length, note,
    anchor: W.add(anchor), bary: W.add(bary), off: W.add(off), uv: W.add(uv), cell: W.add(cell), ao: W.add(ao), index: W.add(Uint16Array.from(index)) };
  const lens = cards.map(c => c.pts.reduce((s, p, k) => s + (k ? len(sub(p, c.pts[k - 1])) : 0), 0));
  let maxOff = 0; for (let i = 0; i < nv; i++) maxOff = Math.max(maxOff, Math.hypot(off[i * 3], off[i * 3 + 1], off[i * 3 + 2]));
  stats[id] = { cards: cards.length, tris: index.length / 3, verts: nv, meanLen: +(lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length)).toFixed(4), maxOff: +maxOff.toFixed(4) };
  log(id, JSON.stringify(stats[id]));
}
const meta: CardsMeta = { version: 1, ref: ref.meta.id, headH: +headH.toFixed(5),
  atlas: { file: 'people_hair_atlas.ktx2', w: ARGS.atlas.size[0], h: ARGS.atlas.size[1], cols: ARGS.atlas.cols, rows: ARGS.atlas.rows.map((r: any) => r.kind) },
  classRows: ARGS.classRows, sets };
writeFileSync(`${outDir}/people_hair.bin`, W.bytes());
writeFileSync(`${outDir}/people_hair.json`, JSON.stringify(meta, null, 1) + '\n');
// the atlas job for Blender (tools/blender/hair_atlas.py)
const MH = ARGS.makehuman;
writeFileSync(`${srcDir}/job.json`, JSON.stringify({ out_png: `${outDir}/people_hair_atlas.png`, size: ARGS.atlas.size, cols: ARGS.atlas.cols, samples: ARGS.atlas.samples, seed: ARGS.seed ?? 7,
  rows: ARGS.atlas.rows.map((r: any) => ({ ...r, src: { ...r.src, image: `${MH}/${r.src.image}` } })) }, null, 1));
writeFileSync(`${srcDir}/source_stats.json`, JSON.stringify(stats, null, 1));
log('done');
