// Procedural tree models (C): a branch skeleton and leaf-cluster cards per species variant, built to the species' form
// numbers in src/data/trees.json (height, crown width and base, trunk diameter, stems, crown envelope, branching habit,
// limb angle, droop, leaf layers). Deterministic (seeded by species and variant), pure JS: the renderer pulls these
// records from data textures (render.ts), the impostor baker rasterises the same records (impostor.ts), and the unit
// tests measure them (tests/trees.test.ts).
//
// Every model has exactly M segments and K cards (unused slots are zero-sized), so all species share one template
// geometry per level of detail and draw in one call. LOD1 uses the first M1 segments (the skeleton is generated
// breadth-first: trunk, limbs, then twigs) and the first K1 cards (ordered by farthest-point sampling, so any prefix
// covers the crown evenly) at a larger size.
import { Rng, hashString } from '../../core/rng';
import { SPECIES, refForm, type Species } from './species';

export type V3 = [number, number, number];
export const M0 = 64, M1 = 16; // branch segments: LOD0, LOD1
export const K0 = 320, K1 = 120; // leaf-cluster cards: LOD0, LOD1 (LOD1 was 80: its cards, 1.6x the LOD0 size, read as single big leaves at 50-100 m)
export const SIDES0 = 6, SIDES1 = 4; // sides of a branch tube
export const VARIANTS = 3;
/** nominal opaque share of a leaf-cluster tile (the card size is set so that cards x size^2 x fill = layers x crown surface) */
export const TILE_FILL = 0.5;
/** LOD1 card size factors: the K1 cards stand in for all K0. Leaf and blossom cards overlap, and fewer of them overlap
 *  less, so 0.8 x the area-preserving factor keeps LOD0's silhouette area; bare-twig sprays hardly overlap, so they keep
 *  0.9 x (measured per species and season in tests/trees.test.ts) */
export const LOD1_LEAF = Math.sqrt(K0 / K1) * 0.8, LOD1_TWIG = Math.sqrt(K0 / K1) * 0.9;
/** LOD1 size factor of a card in its state (cardState isT) and the group's leaf amount: while leaves come out, the twig
 *  sprays left between them shrink toward the leaf factor (in LOD0 the leaves hide most of them) */
export const lod1Size = (isT: number, leaf: number) => LOD1_LEAF + (LOD1_TWIG - LOD1_LEAF) * isT * (1 - leaf);
/** LOD1's share of bare-twig cards: up to a quarter more of the hidden ones show, standing in for the fine branches LOD1
 *  does not draw (its first 16 of 64 segments; a stout-twigged bare fig kept only 0.7 of LOD0's silhouette without them),
 *  fewer as the leaves come out and hide those branches in LOD0 too */
export const lod1Twigs = (twigs: number, leaf = 0) => Math.min(1, twigs + (1 - twigs) * 0.25 * (1 - leaf));
/** half extents of a card of edge `size` (the area of a size x size square) along its side and up axes, for the species'
 *  card aspect (trees.json card.aspect: tall sprays, C) */
export const cardHalf = (size: number, aspect: number) => { const k = Math.sqrt(aspect); return { side: size * 0.5 / k, up: size * 0.5 * k }; };

export interface Seg { a: V3; b: V3; ra: number; rb: number; level: number; u: V3 }
export interface Card {
  /** centre in full leaf, and where the card sits in winter (near its twig) */ c: V3; w: V3;
  /** card plane axes (unit): up = from the twig outward, side = across */ up: V3; side: V3;
  /** lighting normal (crown-radial blended with the card plane) */ n: V3;
  /** edge length in full leaf (m) */ size: number;
  /** leaf-out threshold, blossom threshold, colour tint, ambient occlusion (inside and low in the crown darker; the
   *  shaders now take it per texel from shade.ts, this per-card value is kept for reference) */ ht: number; hb: number; tint: number; ao: number;
  /** bare-twig threshold: a card without leaf or blossom shows its twig spray when hv < the species' twig_cards */ hv: number;
}
export interface TreeModel {
  species: Species; si: number; variant: number;
  /** reference size (m): height, crown width, crown base */ H: number; W: number; CB: number;
  segs: Seg[]; cards: Card[]; used: { segs: number; cards: number };
  /** impostor tile: square of side T (m), x in [-T/2, T/2], y in [y0, y0 + T] */ T: number; y0: number;
  /** envelope radius at height y and azimuth a (m) */ env(y: number, a: number): number;
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** a unit vector perpendicular to d */
export function perp(d: V3): V3 { const k: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; return norm(cross(d, k)); }
/** rotate v about unit axis k by angle t (Rodrigues) */
function rot(v: V3, k: V3, t: number): V3 { const c = Math.cos(t), s = Math.sin(t), kv = cross(k, v), kd = dot(k, v); return [v[0] * c + kv[0] * s + k[0] * kd * (1 - c), v[1] * c + kv[1] * s + k[1] * kd * (1 - c), v[2] * c + kv[2] * s + k[2] * kd * (1 - c)]; }
/** direction at azimuth az (from +z toward +x) and angle el from the vertical */
const dirAt = (az: number, el: number): V3 => [Math.sin(el) * Math.sin(az), Math.cos(el), Math.sin(el) * Math.cos(az)];

/** crown envelope: horizontal radius (m) at height y, azimuth a; superellipse profile about the widest ring, with
 *  low-order azimuthal lobes (irregular crowns; larger for open, irregular species) */
function envelope(s: Species, H: number, W: number, CB: number, rng: Rng) {
  const e = s.envelope, R = W / 2, tm = e.widest;
  const irr = s.id === 'oak' || s.id === 'olive' || s.id === 'willow' ? 1.6 : s.id === 'cypress' || s.id === 'poplar' ? 0.5 : 1;
  const lobes = [1, 2, 3].map(k => ({ k, amp: (0.1 / k) * irr * rng.range(0.5, 1), ph: rng.range(0, Math.PI * 2) }));
  const hTop = H, hBot = CB;
  return (y: number, a: number) => {
    if (y <= hBot || y >= hTop) return 0;
    const t = (y - hBot) / (hTop - hBot);
    const q = t < tm ? (tm - t) / tm : (t - tm) / (1 - tm), p = t < tm ? e.bottom : e.top;
    let r = R * Math.pow(Math.max(0, 1 - Math.pow(q, p)), 1 / p);
    let m = 1; for (const L of lobes) m += L.amp * Math.cos(L.k * a + L.ph);
    return r * m;
  };
}

/** distance from p along unit d to where the ray leaves the envelope (m); a point below or outside the crown first
 *  marches in (limbs start at the fork, under the crown); 0 if the ray never enters */
function toEnvelope(env: (y: number, a: number) => number, p: V3, d: V3, max: number) {
  const inside = (q: V3) => Math.hypot(q[0], q[2]) < env(q[1], Math.atan2(q[0], q[2]));
  let t0 = 0; const step = max / 60;
  while (t0 < max && !inside(add(p, mul(d, t0)))) t0 += step;
  if (t0 >= max) return 0;
  let lo = t0, hi = max; if (inside(add(p, mul(d, hi)))) return hi;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (inside(add(p, mul(d, m)))) lo = m; else hi = m; }
  return lo;
}

export function buildModel(si: number, variant: number): TreeModel {
  const s = SPECIES[si], rng = new Rng(hashString(`${s.id}:${variant}`), 'tree-model');
  const f = refForm(s), H = f.H, W = f.W, CB = f.CB;
  const env = envelope(s, H, W, CB, rng);
  const segs: Seg[] = [];
  const addSeg = (a: V3, b: V3, ra: number, rb: number, level: number) => { if (segs.length >= M0) return false; segs.push({ a, b, ra, rb, level, u: perp(norm(sub(b, a))) }); return true; };
  /** a curved branch of n segments; returns its points and end radius */
  const branch = (p0: V3, d0: V3, L: number, r0: number, r1: number, level: number, n: number, bend: number): { pts: V3[]; dirs: V3[]; ok: boolean } => {
    const pts: V3[] = [p0], dirs: V3[] = [d0]; let d = d0, p = p0;
    for (let i = 0; i < n; i++) {
      // gravitropism: droop pulls outer shoots down, bend < 0 curves limbs upward (C)
      d = norm(add(d, [rng.range(-0.08, 0.08), -bend / n, rng.range(-0.08, 0.08)]));
      const q = add(p, mul(d, L / n));
      if (!addSeg(p, q, r0 + (r1 - r0) * (i / n), r0 + (r1 - r0) * ((i + 1) / n), level)) return { pts, dirs, ok: false };
      pts.push(q); dirs.push(d); p = q;
    }
    return { pts, dirs, ok: true };
  };
  const nStems = rng.int(s.stems[0], s.stems[1]);
  const dbh = s.dbh_ratio * H * (nStems > 1 ? 0.6 : 1), r0 = dbh / 2 * 1.15; // flare at the foot (C)
  const limbAngle = (s.limb_angle_deg * Math.PI) / 180;
  const nLimbs = rng.int(s.limbs[0], s.limbs[1]);
  interface Sprout { p: V3; d: V3; r: number; level: number; parentLen: number }
  const queue: Sprout[] = [];
  const stemTops: { p: V3; d: V3; r: number }[] = [];
  const az0 = rng.range(0, Math.PI * 2);
  for (let k = 0; k < nStems; k++) {
    const az = az0 + (k / nStems) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const off = nStems > 1 ? 0.12 * Math.sqrt(nStems) * rng.range(0.6, 1) : 0;
    const base: V3 = [Math.sin(az) * off, -0.05, Math.cos(az) * off];
    const lean = nStems > 1 ? rng.range(0.2, 0.42) * (s.habit === 'excurrent' ? 0.3 : 1) : rng.range(0, 0.06);
    const d = dirAt(az, lean);
    if (s.habit === 'excurrent') {
      // a leader to the top in 5 segments; laterals along it through the crown (whorl-like spiral, 137.5 deg)
      const top = H * 0.985, n = 5, L = top / Math.cos(lean);
      const b = branch(base, d, L, r0, r0 * 0.08, 0, n, -0.02);
      const nl = Math.max(2, Math.round(nLimbs / nStems));
      for (let i = 0; i < nl; i++) {
        const t = (i + 0.5) / nl, y = CB * 0.85 + (top * 0.93 - CB * 0.85) * t;
        const seg = Math.min(n - 1, Math.floor((y / top) * n)), f2 = (y / top) * n - seg;
        const p = lerp(b.pts[seg], b.pts[seg + 1], f2), rr = r0 + (r0 * 0.08 - r0) * (y / top);
        const az2 = az0 + i * 2.39996 + rng.range(-0.25, 0.25), el = limbAngle * rng.range(0.85, 1.2) * (1 + 0.35 * t);
        queue.push({ p, d: dirAt(az2, Math.min(1.45, el)), r: rr * 0.55, level: 1, parentLen: L });
      }
    } else {
      // decurrent: the stem to the fork, then primary limbs (C: fork height 0.8-1.0 x crown base)
      const fy = CB * rng.range(0.8, 1.0), L = fy / Math.cos(lean);
      const b = branch(base, d, L, r0, r0 * 0.82, 0, 2, -0.03);
      stemTops.push({ p: b.pts[b.pts.length - 1], d: b.dirs[b.dirs.length - 1], r: r0 * 0.82 });
    }
  }
  if (s.habit === 'decurrent') {
    const per = Math.max(1, Math.round(nLimbs / stemTops.length));
    stemTops.forEach((st, k) => {
      for (let i = 0; i < per; i++) {
        const az = az0 + ((k * per + i) / (per * stemTops.length)) * Math.PI * 2 + rng.range(-0.35, 0.35);
        const el = limbAngle * rng.range(0.8, 1.2);
        // multi-stem shrubs: limbs continue each stem's lean
        const d = norm(add(dirAt(az, el), mul(st.d, stemTops.length > 1 ? 1.2 : 0.3)));
        queue.push({ p: st.p, d, r: st.r * Math.pow(per, -1 / 2.2) * 0.95, level: 1, parentLen: H });
      }
    });
  }
  // breadth-first growth: each sprout grows toward the envelope and spawns 2-3 children, until the segment budget is used
  const tips: { p: V3; d: V3; level: number }[] = [];
  const droop = s.droop;
  while (queue.length && segs.length < M0) {
    const q = queue.shift()!;
    const reach = toEnvelope(env, q.p, q.d, W + H);
    // twigs end inside the leaf shell (cards sit ~0.3 of their size inside the envelope): no sticks poking out of the crown
    const depthFrac = q.level === 1 ? (s.habit === 'excurrent' ? 0.88 : 0.62) : q.level === 2 ? 0.75 : 0.82;
    let L = Math.max(0.15, reach * depthFrac);
    if (reach < 0.05) continue; // a sprout on the crown surface grows no further (the cards there are its twigs)
    const n = q.level === 1 ? 2 : 1;
    // limbs curve upward; only the outer twigs follow the species' droop (willow: upswept limbs, hanging shoots)
    const rel = L / Math.max(0.5, W / 2);
    const bend = q.level === 1 ? (s.habit === 'excurrent' ? droop * 0.3 - 0.05 : -0.15) : q.level === 2 ? -0.05 + droop * 0.4 * rel : droop * 1.2 * rel - 0.02;
    const rEnd = Math.max(0.006 * H / 10, q.r * (q.level === 1 ? 0.55 : 0.5));
    const b = branch(q.p, q.d, L, q.r, rEnd, q.level, n, bend);
    const end = b.pts[b.pts.length - 1], dEnd = b.dirs[b.dirs.length - 1];
    tips.push({ p: end, d: dEnd, level: q.level });
    if (!b.ok || q.level >= 4) continue;
    // children: at the end (and one from mid-branch on limbs), turned +-25-45 deg about a random axis around the parent
    const nc = q.level === 1 ? rng.int(2, 3) : 2;
    for (let c = 0; c < nc; c++) {
      const from = c === nc - 1 && q.level === 1 && b.pts.length > 2 ? b.pts[1] : end;
      const ax = rot(perp(dEnd), dEnd, rng.range(0, Math.PI * 2) + c * Math.PI);
      const ang = rng.range(0.42, 0.78) * (s.habit === 'excurrent' ? 0.8 : 1);
      let d = rot(dEnd, ax, ang);
      // children lean outward from the trunk axis (a crown fills out, not up)
      const out = norm([from[0], 0, from[2]]); d = norm(add(d, mul(out, 0.25)));
      queue.push({ p: from, d, r: rEnd * Math.pow(nc, -1 / 2.3) * 1.25, level: q.level + 1, parentLen: L });
    }
  }
  const usedSegs = segs.length;
  while (segs.length < M0) segs.push({ a: [0, 0, 0], b: [0, 0.001, 0], ra: 0, rb: 0, level: 9, u: [1, 0, 0] });

  // ---- leaf-cluster cards: targets spread evenly in the crown shell, each attached to its nearest branch point
  const shellInner = 0.42 + 0.25 * Math.min(1, 1 / Math.max(0.5, s.leaf.layers)); // denser crowns hold leaves deeper (C)
  // crown shell area (m^2) -> card size for the species' leaf layers
  let area = 0; const NY = 48;
  for (let i = 0; i < NY; i++) { const y0 = CB + (H - CB) * i / NY, y1 = CB + (H - CB) * (i + 1) / NY; const r0e = env(y0, 0), r1e = env(y1, 0); area += Math.PI * (r0e + r1e) * Math.hypot(r1e - r0e, y1 - y0); }
  const size = Math.sqrt((s.leaf.layers * area) / (K0 * TILE_FILL));
  const yTop = H - size * 0.3; // a card reaches ~0.35 of its size beyond its centre: the crown top stays at H
  const cand: { p: V3; rn: number }[] = [];
  const Rmax = W / 2 * 1.3, ycS = CB + (H - CB) * s.envelope.widest;
  // sub-crowns (C): foliage masses at the ends of the secondary branches, pushed out to 3/4 of the envelope. Cards are
  // kept with a probability that falls off between them (floor SUB_FLOOR), so the crown is several lumpy masses with
  // hollows between, and its outline is lobed, not the smooth ball ("lollipop") of an evenly filled envelope. Narrow
  // excurrent crowns (poplar, cypress, pear) keep weaker masses along their leader.
  const subLevel = s.habit === 'excurrent' ? 1 : 2, subs: V3[] = [];
  for (const t of tips) if (t.level === subLevel) { const a = Math.atan2(t.p[0], t.p[2]), er = env(Math.min(H * 0.97, Math.max(CB * 1.02, t.p[1])), a), r = Math.hypot(t.p[0], t.p[2]);
    const k = er > 0 && r > 1e-3 ? Math.max(r, er * 0.75) / r : 1; subs.push([t.p[0] * k, Math.min(H * 0.92, Math.max(CB + (H - CB) * 0.18, t.p[1])), t.p[2] * k]); }
  const irregular = s.id === 'oak' || s.id === 'olive' || s.id === 'willow' || s.id === 'fig';
  const SUB_FLOOR = s.habit === 'excurrent' ? 0.5 : irregular ? 0.17 : 0.2, sig = Math.max(0.6, (s.habit === 'excurrent' ? 0.45 : 0.36) * Math.min(W / 2, (H - CB) / 2));
  // the nearest mass decides (max of the Gaussians = the Gaussian of the least distance: one exp per candidate)
  const subField = (p: V3) => { if (!subs.length) return 1; let d2m = Infinity; for (const q of subs) { const dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < d2m) d2m = d2; } return SUB_FLOOR + (1 - SUB_FLOOR) * Math.exp(-d2m / (2 * sig * sig)); };
  for (let tries = 0; cand.length < K0 * 3 && tries < K0 * 400; tries++) {
    // volume-uniform: a height, then a point in that ring's disc, kept with probability (disc area / max area)
    const y = rng.range(CB, yTop), a = rng.range(0, Math.PI * 2), er = env(y, a);
    if (er <= 0.05 || rng.next() > (er / Rmax) ** 2) continue;
    // cards reach ~0.3 of their size beyond their centre: centres stay that far inside the envelope, so the crown's
    // outline (not the card centres) has the species' width
    const erIn = Math.max(er * 0.5, er - size * 0.3);
    const rr = erIn * Math.sqrt(rng.next()), p: V3 = [Math.sin(a) * rr, y, Math.cos(a) * rr];
    // radial position within the envelope, measured on the ellipsoid through the crown centre (so top and bottom are shell too)
    const hy = Math.max(y > ycS ? H - ycS : ycS - CB, 0.1);
    const rn = Math.max(rr / erIn, (Math.abs(y - ycS) / hy) * 0.9);
    if (rn < shellInner) continue;
    if (rng.next() > subField(p)) continue;
    cand.push({ p, rn });
  }
  // farthest-point order: every prefix is evenly spread (LOD1 = the first K1)
  const pick: number[] = [], dmin = new Float64Array(cand.length).fill(Infinity);
  let cur = 0; for (let i = 0; i < cand.length; i++) if (cand[i].p[1] > cand[cur].p[1]) cur = i;
  for (let k = 0; k < Math.min(K0, cand.length); k++) {
    pick.push(cur); let best = -1, bd = -1;
    const cp = cand[cur].p; for (let i = 0; i < cand.length; i++) { const q = cand[i].p, dx = q[0] - cp[0], dy = q[1] - cp[1], dz = q[2] - cp[2], d = dx * dx + dy * dy + dz * dz; if (d < dmin[i]) dmin[i] = d; if (dmin[i] > bd) { bd = dmin[i]; best = i; } }
    cur = best;
  }
  const skel = segs.slice(0, usedSegs).filter(q => q.level >= (s.habit === 'excurrent' ? 1 : 2));
  const skelAll = skel.length ? skel : segs.slice(0, usedSegs);
  const yc = CB + (H - CB) * s.envelope.widest;
  const cards: Card[] = [];
  // leaf-out and blossom thresholds, stratified within the LOD1 prefix and within the rest (so LOD1 is as leafy, and
  // in as much blossom, as LOD0 on every day), shuffled within each part
  const strat = () => { const out: number[] = []; for (const [a, b] of [[0, Math.min(K1, pick.length)], [Math.min(K1, pick.length), pick.length]]) {
    const part = Array.from({ length: b - a }, (_, i) => (i + rng.next()) / Math.max(1, b - a));
    for (let i = part.length - 1; i > 0; i--) { const j = rng.int(0, i); [part[i], part[j]] = [part[j], part[i]]; } out.push(...part); } return out; };
  const hts = strat(), hbs = strat(), hvs = strat();
  pick.forEach((ci, k) => {
    const t = cand[ci].p;
    // nearest point on the outer skeleton
    let best: V3 = [0, CB, 0], bd = Infinity;
    for (const q of skelAll) { const ab = sub(q.b, q.a), l2 = dot(ab, ab) || 1e-9; const u = Math.max(0, Math.min(1, dot(sub(t, q.a), ab) / l2)); const p = add(q.a, mul(ab, u)); const d = len(sub(t, p)); if (d < bd) { bd = d; best = p; } }
    let c = t; const reach = Math.max(W / 2, (H - CB) / 2) * 0.35 + size * 0.6;
    if (bd > reach) c = add(best, mul(norm(sub(t, best)), reach));
    const radial = norm([c[0], (c[1] - yc) * (W / 2) / Math.max(0.5, (H - CB) / 2), c[2]]);
    let up = len(sub(c, best)) > 1e-3 ? norm(sub(c, best)) : radial;
    const rn = cand[ci].rn;
    // hanging shoots (willow, tamarisk, vine): the outer sprays turn down (C)
    if (droop > 0.2) up = norm(lerp(up, [0, -1, 0], Math.min(0.9, droop * rn * 1.1)));
    // upright sprays (cypress, poplar): the card's axis turns toward the vertical (trees.json card.up, C)
    if (s.card.up > 0) up = norm(lerp(up, [0, 1, 0], s.card.up));
    let nPlane = sub(radial, mul(up, dot(radial, up))); if (len(nPlane) < 0.1) nPlane = perp(up); nPlane = norm(rot(norm(nPlane), up, rng.range(-1.0, 1.0)));
    const side = norm(cross(up, nPlane));
    const n = norm(add(mul(radial, 0.72), mul(nPlane, 0.28)));
    const hy = (c[1] - CB) / Math.max(0.1, H - CB);
    const ao = (0.5 + 0.5 * Math.min(1, Math.max(0, (rn - shellInner) / (1 - shellInner) * 0.6 + 0.4))) * (0.78 + 0.22 * hy);
    const w = lerp(best, c, 0.45); // winter: the bare-twig spray sits closer to its branch
    // per-card tint +-5 % (was +-12 %: with the crown lit as one volume, a card's own tint only needs to break up repeats)
    cards.push({ c, w, up, side, n, size: size * rng.range(0.85, 1.15), ht: hts[k], hb: hbs[k], tint: 1 + (rng.range(0.88, 1.12) - 1) * 0.42, ao, hv: hvs[k] });
  });
  const usedCards = cards.length;
  while (cards.length < K0) cards.push({ c: [0, 0, 0], w: [0, 0, 0], up: [0, 1, 0], side: [1, 0, 0], n: [0, 1, 0], size: 0, ht: 2, hb: 2, tint: 1, ao: 1, hv: 2 });
  // impostor tile: a square around the actual extent (cards reach beyond the envelope by half a card)
  let xm = 0, ym = H; for (const cd of cards.slice(0, usedCards)) { const e = cd.size * 0.72 * Math.sqrt(s.card.aspect); xm = Math.max(xm, Math.hypot(cd.c[0], cd.c[2]) + e); ym = Math.max(ym, cd.c[1] + e); }
  for (const q of segs.slice(0, usedSegs)) { xm = Math.max(xm, Math.hypot(q.b[0], q.b[2]) + q.rb); ym = Math.max(ym, q.b[1] + q.rb); }
  const y0 = -0.02 * H, T = Math.max(2 * xm, ym - y0) * 1.02;
  return { species: s, si, variant, H, W, CB, segs, cards, used: { segs: usedSegs, cards: usedCards }, T, y0, env };
}

let cache: TreeModel[] | null = null;
/** all models: row = species index x VARIANTS + variant */
export function allModels(): TreeModel[] {
  if (!cache) { cache = []; for (let si = 0; si < SPECIES.length; si++) for (let v = 0; v < VARIANTS; v++) cache.push(buildModel(si, v)); }
  return cache;
}
export const rowOf = (si: number, variant: number) => si * VARIANTS + (variant % VARIANTS);

/** triangles per tree at each level of detail */
export const TRIS = { lod0: M0 * SIDES0 * 2 + K0 * 2, lod1: M1 * SIDES1 * 2 + K1 * 2, impostor: 2 };

/** the three variants of a species leaf out (and colour and shed) a little apart, so the trees of one species are not
 *  all at one stage in spring and autumn: variant v's leaf amount is the group's, moved by VARIANT_SPREAD[v] x 0.45 x
 *  L(1 - L) (at most +-0.11, in the middle of the change; C). Shared by the shader (render.ts) and the baker. */
export const VARIANT_SPREAD = [-1, 0, 1] as const;
export const variantLeaf = (L: number, variant: number) => Math.min(1, Math.max(0, L + VARIANT_SPREAD[variant % VARIANTS] * 0.45 * L * (1 - L)));

/** card state in the season (shared by the shader in render.ts and the impostor baker): which tile the card shows
 *  (leaf, blossom or bare twigs), how big it is and where it sits. leaf = the tree's leaf amount (0..1: the group's,
 *  variantLeaf), blossom = its blossom amount, twigs = the species' twig_cards. Blossom takes up to 80 % of the cards at
 *  the peak; leaves come out card by card in `ht` order and grow from 45 % to full size; of the rest, the share `twigs`
 *  (in `hv` order) are bare twig sprays at 80 % size near their branch, the others are not drawn (a stout-twigged fig
 *  shows its branch skeleton, not a thicket of sprays). */
export function cardState(cd: Card, leaf: number, blossom: number, twigs = 1) {
  const isB = cd.hb < blossom * 0.8 ? 1 : 0;
  const isL = (1 - isB) * (cd.ht < leaf * 1.08 ? 1 : 0);
  const isT = (1 - isB) * (1 - isL);
  const showT = cd.hv < twigs ? 1 : 0;
  const grow = isL * (0.45 + 0.55 * leaf) + isB * 0.8 + isT * 0.8 * showT;
  const place = isL * (0.55 + 0.45 * leaf) + isB * 0.8;
  return { isB, isL, isT, size: cd.size * grow, pos: lerp(cd.w, cd.c, place) };
}
