// Leaf-cluster atlas (C): one 256 px tile per leaf, blossom or bare-twig spray, drawn procedurally here in pure JS (no
// canvas, no external asset), so the same pixels feed the GPU texture and the impostor baker. Leaf outlines follow each
// species' leaf form (trees.json leaf.tile: palmate 5-lobed plane, lanceolate willow, deltoid poplar, scale-leaf sprays,
// cordate mulberry, lobed fig and vine, ovate apple/pear, narrow pomegranate/olive/almond, toothed oblong oak, pinnate
// pistachio); leaf length on the tile is the species' leaf size relative to its card size, so leaves are true to scale.
//
// Texel: R = shade (0..1), G = petal share, B = bark share (twig), A = coverage. The card's up axis is the tile's +v:
// the spray starts at its twig at the bottom centre and grows outward (up). Mips are built per tile so that the
// share of texels passing the 0.5 alpha test stays that of the full-size tile (no thinning or vanishing with distance).
import { Rng, hashString } from '../../core/rng';

export const TILE = 256, COLS = 8, ROWS = 3;
export const TILE_NAMES = [
  'palmate_plane', 'lanceolate_willow', 'deltoid_poplar', 'spray_tamarisk', 'cordate_mulberry', 'palmate_fig', 'ovate_pome', 'narrow_pomegranate',
  'oblong_oak', 'narrow_almond', 'pinnate_pistachio', 'spray_cypress', 'narrow_olive', 'palmate_vine', 'blossom_small', 'blossom_pomegranate',
  'twig_fine', 'twig_hanging', 'twig_upright', 'twig_tamarisk', 'twig_stout', 'twig_broom',
] as const;
export type TileName = typeof TILE_NAMES[number];
export const tileIndex = (n: string) => { const i = TILE_NAMES.indexOf(n as TileName); if (i < 0) throw new Error(`atlas: no tile ${n}`); return i; };
/** atlas uv origin of tile i (bottom-left) and its extent */
export const tileUV = (i: number) => ({ u: (i % COLS) / COLS, v: Math.floor(i / COLS) / ROWS, su: 1 / COLS, sv: 1 / ROWS });
/** texels kept clear at each tile edge (bilinear filtering and the low mips must not bleed between tiles) */
export const PAD = 6;

export interface Atlas { width: number; height: number; levels: { data: Uint8Array; width: number; height: number }[]; fill: number[] }

type Cls = 0 | 1 | 2; // leaf, petal, bark
class Canvas {
  readonly a: Float32Array; readonly r: Float32Array; readonly g: Float32Array; readonly b: Float32Array; private readonly pad: number;
  constructor(readonly n = TILE) { this.a = new Float32Array(n * n); this.r = new Float32Array(n * n); this.g = new Float32Array(n * n); this.b = new Float32Array(n * n); this.pad = Math.max(2, Math.round(PAD * n / TILE)); }
  /** paint where inside(x, y) (tile units 0..1) holds at texel centres, over a bbox; shade(x, y) 0..1. One sample per
   *  texel: the full-size level is used only close up (alpha-tested edges), the mip chain does the filtering */
  shape(x0: number, y0: number, x1: number, y1: number, inside: (x: number, y: number) => boolean, cls: Cls, shade: (x: number, y: number) => number) {
    const N = this.n, P = this.pad;
    const i0 = Math.max(P, Math.floor(Math.min(x0, x1) * N)), i1 = Math.min(N - 1 - P, Math.ceil(Math.max(x0, x1) * N));
    const j0 = Math.max(P, Math.floor(Math.min(y0, y1) * N)), j1 = Math.min(N - 1 - P, Math.ceil(Math.max(y0, y1) * N));
    const g = cls === 1 ? 1 : 0, b = cls === 2 ? 1 : 0;
    for (let j = j0; j <= j1; j++) { const y = (j + 0.5) / N; for (let i = i0; i <= i1; i++) { const x = (i + 0.5) / N; if (!inside(x, y)) continue;
      const k = j * N + i; this.a[k] = 1; this.r[k] = shade(x, y); this.g[k] = g; this.b[k] = b; } }
  }
  /** a tapered stroke from p to q (tile units), widths in tile units */
  line(px: number, py: number, qx: number, qy: number, w0: number, w1: number, cls: Cls, shade: number) {
    const dx = qx - px, dy = qy - py, l2 = dx * dx + dy * dy || 1e-9, m = Math.max(w0, w1);
    this.shape(Math.min(px, qx) - m, Math.min(py, qy) - m, Math.max(px, qx) + m, Math.max(py, qy) + m, (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - px) * dx + (y - py) * dy) / l2)), cx = px + dx * t - x, cy = py + dy * t - y;
      return cx * cx + cy * cy < ((w0 + (w1 - w0) * t) / 2) ** 2;
    }, cls, () => shade);
  }
  /** a leaf: base at (x, y), direction ang (radians from +v toward +u), length L (tile units), half-width profile hw(s)
   *  (in units of L, s = 0 base .. 1 tip), or a polar outline for palmate leaves */
  leaf(x: number, y: number, ang: number, L: number, hw: (s: number) => number, shade: number, cls: Cls = 0) {
    const c = Math.cos(ang), s = Math.sin(ang); let wm = 0; for (let k = 0; k <= 10; k++) wm = Math.max(wm, hw(k / 10)); wm = (wm * 1.1 + 0.02) * L;
    // bbox of the rotated rectangle [0, L] x [-wm, wm]
    const ex = Math.abs(s) * L, ey = Math.abs(c) * L, bx = Math.abs(c) * wm, by = Math.abs(s) * wm;
    const x0 = Math.min(x, x + s * L) - bx, x1 = Math.max(x, x + s * L) + bx, y0 = Math.min(y, y + c * L) - by, y1 = Math.max(y, y + c * L) + by; void ex; void ey;
    this.shape(x0, y0, x1, y1, (px, py) => {
      const dx = px - x, dy = py - y, a = (dx * s + dy * c) / L, t = (dx * c - dy * s) / L; // a along the midrib, t across
      return a >= 0 && a <= 1 && Math.abs(t) < hw(a);
    }, cls, (px, py) => { const dx = px - x, dy = py - y, a = (dx * s + dy * c) / L, t = (dx * c - dy * s) / L;
      const rib = Math.abs(t) < 0.015 ? 0.86 : 1; return Math.min(1, shade * rib * (0.84 + 0.16 * a) * (0.94 + 0.12 * Math.min(1, Math.abs(t) / Math.max(1e-3, hw(a))))); });
  }
  palmate(x: number, y: number, ang: number, L: number, lobes: number[], width: number, base: number, shade: number) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const Rt = lut(u => { const th = (u - 0.5) * 4.6; let m = 0; for (const lb of lobes) m = Math.max(m, Math.exp(-(((th - lb) / width) ** 2))); return (base + (1 - base) * m) * (0.55 + 0.45 * Math.cos(th * 0.35)); }, 256);
    this.shape(x - L, y - L, x + L, y + L, (px, py) => {
      const dx = px - x, dy = py - y, a = dx * s + dy * c, t = dx * c - dy * s; if (a < -0.18 * L) return false;
      const th = Math.atan2(t, a); if (th > 2.3 || th < -2.3) return false;
      return a * a + t * t < (Rt(th / 4.6 + 0.5) * L) ** 2;
    }, 0, (px, py) => { const dx = px - x, dy = py - y, a = (dx * s + dy * c), t = (dx * c - dy * s), th = Math.atan2(t, a);
      let vein = 1; for (const lb of lobes) if (Math.abs(th - lb) < 0.035) vein = 0.86; return Math.min(1, shade * vein * (0.86 + 0.14 * Math.hypot(a, t) / L)); });
  }
  flower(x: number, y: number, r: number, shade: number, petals = 5) {
    const ph = shade * 13;
    this.shape(x - r, y - r, x + r, y + r, (px, py) => { const dx = px - x, dy = py - y, rho = Math.hypot(dx, dy) / r, th = Math.atan2(dy, dx) + ph; return rho < 0.55 + 0.45 * Math.abs(Math.cos((th * petals) / 2)); }, 1,
      (px, py) => { const rho = Math.hypot(px - x, py - y) / r; return rho < 0.22 ? 0.55 : Math.min(1, shade * (0.88 + 0.12 * rho)); });
  }
}

// ---------------------------------------------------------------- leaf outlines (half-width in units of leaf length)
/** a profile as a 129-entry lookup table (the rasteriser calls it per texel) */
const lut = (f: (s: number) => number, n = 128) => { const t = new Float32Array(n + 1); for (let i = 0; i <= n; i++) t[i] = f(i / n); return (s: number) => { const x = Math.min(n, Math.max(0, s * n)), i = Math.min(n - 1, x | 0); return t[i] + (t[i + 1] - t[i]) * (x - i); }; };
const HW0: Record<string, (s: number) => number> = {
  ovate: s => 0.3 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 0.9),
  lanceolate: s => 0.11 * Math.pow(Math.sin(Math.PI * s), 0.9),
  narrow: s => 0.15 * Math.pow(Math.sin(Math.PI * s), 0.75),
  narrowWide: s => 0.2 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.9)), 0.8),
  deltoid: s => 0.46 * (s < 0.22 ? Math.pow(s / 0.22, 0.5) : Math.pow((1 - s) / 0.78, 1.1)),
  cordate: s => 0.42 * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * s)), 0.85) * (s < 0.12 ? 1.1 : 1),
  oak: s => 0.24 * Math.pow(Math.sin(Math.PI * s), 0.55) * (1 + 0.14 * Math.sin(s * Math.PI * 2 * 5.5)),
  leaflet: s => 0.24 * Math.pow(Math.sin(Math.PI * s), 0.8),
};
const HW: Record<string, (s: number) => number> = Object.fromEntries(Object.entries(HW0).map(([k, f]) => [k, lut(f)]));

interface Twig { x0: number; y0: number; x1: number; y1: number; w: number; level: number }
/** the cluster outline: an oval filling most of the tile (the spray's shoots end on it) */
const OVAL = { cx: 0.5, cy: 0.5, rx: 0.44, ry: 0.45 };
const ovalQ = (x: number, y: number) => ((x - OVAL.cx) / OVAL.rx) ** 2 + ((y - OVAL.cy) / OVAL.ry) ** 2;
/** length from (x, y) along angle a (from +v toward +u) to the oval */
function toOval(x: number, y: number, a: number) { let lo = 0, hi = 1.2; const sa = Math.sin(a), ca = Math.cos(a);
  if (ovalQ(x, y) >= 1) return 0; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (ovalQ(x + sa * m, y + ca * m) < 1) lo = m; else hi = m; } return lo; }
/** a spray: a main shoot from the bottom centre outward, alternate side shoots at every node reaching toward the cluster
 *  outline, and their side shoots down to `levels` (so small-leaved sprays get a finer twig network and the same fill) */
function spray(rng: Rng, o: { spread: number; levels: number; w: number; node: number; curve?: number; reach?: number; side?: number }): Twig[] {
  const out: Twig[] = [];
  const grow = (x: number, y: number, ang: number, L: number, w: number, level: number) => {
    const n = Math.max(2, Math.ceil(L / o.node)); let px = x, py = y, a = ang;
    for (let i = 0; i < n; i++) {
      a += rng.range(-0.1, 0.1) + (o.curve ?? 0) / n * (level ? 1.5 : 1);
      const qx = px + Math.sin(a) * L / n, qy = py + Math.cos(a) * L / n;
      out.push({ x0: px, y0: py, x1: qx, y1: qy, w: w * (1 - (i / n) * 0.6), level });
      if (level < o.levels && i < n - 1 && rng.chance(o.side ?? 0.92)) {
        const sgn = (i + level) % 2 ? 1 : -1, sa = a + sgn * o.spread * rng.range(0.75, 1.15);
        const reach = toOval(qx, qy, sa) * rng.range(0.75, 1.0) * (o.reach ?? 1);
        if (reach > o.node * 0.8) grow(qx, qy, sa, reach, w * 0.6, level + 1);
      }
      px = qx; py = qy;
    }
  };
  const a0 = rng.range(-0.12, 0.12);
  grow(0.5 + rng.range(-0.02, 0.02), 0.07, a0, toOval(0.5, 0.07, a0) * 0.95, o.w, 0);
  return out;
}
/** points along twigs, spaced `step` apart (tile units), alternating sides */
function nodes(tw: Twig[], step: number, rng: Rng) {
  const out: { x: number; y: number; ang: number; side: number; level: number }[] = []; let k = 0;
  for (const t of tw) { const L = Math.hypot(t.x1 - t.x0, t.y1 - t.y0), a = Math.atan2(t.x1 - t.x0, t.y1 - t.y0);
    for (let d = rng.range(0, step); d < L; d += step * rng.range(0.7, 1.3)) out.push({ x: t.x0 + (t.x1 - t.x0) * d / L, y: t.y0 + (t.y1 - t.y0) * d / L, ang: a, side: (k++ % 2) * 2 - 1, level: t.level }); }
  return out;
}
/** keep the spray round: leaves outside an ellipse around the tile centre are dropped (ragged edge by chance) */
const inOval = (x: number, y: number, rng: Rng) => { const q = ovalQ(x, y); return q < 0.8 || (q < 1.1 && rng.chance(1 - (q - 0.8) / 0.3)); };

function drawTile(name: TileName, leafFrac: number, c: Canvas) {
  const rng = new Rng(hashString(name), 'leaf-atlas');
  const L = Math.min(0.3, Math.max(0.035, leafFrac)); // leaf length in tile units
  // shoots every ~1.6 leaf lengths, down to the level that fills the cluster (small leaves: a finer twig network)
  const node = Math.min(0.2, Math.max(0.045, L * 1.6)), lv = L < 0.06 ? 3 : L < 0.15 ? 2 : 1;
  const sh = () => rng.range(0.62, 1.0);
  const twigs = (tw: Twig[], shade = 0.7) => { for (const t of tw) c.line(t.x0, t.y0, t.x1, t.y1, t.w, t.w * 0.8, 2, shade * rng.range(0.85, 1.1)); };
  const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const leafy = (tw: Twig[], hw: (s: number) => number, step: number, angle: number, sizeVar = 0.25) => {
    for (const n of shuffle(nodes(tw, step, rng))) { const a = n.ang + n.side * angle * rng.range(0.7, 1.2), l = L * rng.range(1 - sizeVar, 1 + sizeVar);
      if (!inOval(n.x + Math.sin(a) * l * 0.5, n.y + Math.cos(a) * l * 0.5, rng)) continue; c.leaf(n.x, n.y, a, l, hw, sh()); }
  };
  const std = (spread = 0.8, w = 0.011, extra: Partial<{ curve: number; side: number }> = {}) => spray(rng, { spread, levels: lv, w, node, ...extra });
  switch (name) {
    case 'palmate_plane': case 'palmate_fig': case 'palmate_vine': {
      const tw = std(0.85, 0.012); twigs(tw);
      const lobes = name === 'palmate_plane' ? [0, 0.72, -0.72, 1.45, -1.45] : name === 'palmate_fig' ? [0, 0.85, -0.85, 1.55, -1.55] : [0, 0.8, -0.8, 1.5, -1.5];
      const width = name === 'palmate_plane' ? 0.2 : name === 'palmate_fig' ? 0.33 : 0.36, base = name === 'palmate_plane' ? 0.32 : name === 'palmate_fig' ? 0.42 : 0.62;
      for (const n of shuffle(nodes(tw, L * 0.5, rng))) { const a = n.ang + n.side * rng.range(0.5, 1.1), l = L * rng.range(0.8, 1.15), px = n.x + Math.sin(a) * l * 0.25, py = n.y + Math.cos(a) * l * 0.25;
        if (!inOval(px + Math.sin(a) * l * 0.4, py + Math.cos(a) * l * 0.4, rng)) continue;
        c.line(n.x, n.y, px, py, 0.004, 0.004, 2, 0.8); c.palmate(px, py, a + rng.range(-0.3, 0.3), l * 0.62, lobes, width, base, sh()); }
      break; }
    case 'lanceolate_willow': { const tw = std(0.4, 0.008, { curve: 0.15 }); twigs(tw, 0.75); leafy(tw, HW.lanceolate, L * 0.22, 0.45, 0.2); break; }
    case 'deltoid_poplar': { const tw = std(0.6, 0.01); twigs(tw); leafy(tw, HW.deltoid, L * 0.45, 0.9); break; }
    case 'cordate_mulberry': { const tw = std(0.8); twigs(tw); leafy(tw, HW.cordate, L * 0.5, 1.0); break; }
    case 'ovate_pome': { const tw = std(0.75, 0.01); twigs(tw); leafy(tw, HW.ovate, L * 0.36, 0.85); break; }
    case 'narrow_pomegranate': { const tw = std(0.7, 0.008); twigs(tw); leafy(tw, HW.narrowWide, L * 0.25, 0.7); break; }
    case 'narrow_olive': { const tw = std(0.7, 0.009); twigs(tw); leafy(tw, HW.narrow, L * 0.24, 0.55); break; }
    case 'narrow_almond': { const tw = spray(rng, { spread: 0.32, levels: 2, w: 0.01, node: 0.07, side: 0.85 }); twigs(tw, 0.8); leafy(tw, HW.narrow, L * 0.45, 0.5); break; }
    case 'oblong_oak': { const tw = std(0.8); twigs(tw); leafy(tw, HW.oak, L * 0.38, 0.8); break; }
    case 'pinnate_pistachio': {
      const tw = std(0.8, 0.012); twigs(tw);
      for (const n of shuffle(nodes(tw, L * 0.42, rng))) { const a = n.ang + n.side * rng.range(0.6, 1.0), l = L * rng.range(0.85, 1.15), ex = n.x + Math.sin(a) * l, ey = n.y + Math.cos(a) * l;
        if (!inOval((n.x + ex) / 2, (n.y + ey) / 2, rng)) continue;
        c.line(n.x, n.y, ex, ey, 0.004, 0.003, 0, 0.7); const sh0 = sh();
        for (let k = 1; k <= 4; k++) { const px = n.x + (ex - n.x) * k / 4.6, py = n.y + (ey - n.y) * k / 4.6;
          for (const sg of [-1, 1]) c.leaf(px, py, a + sg * 0.95, l * 0.3, HW.leaflet, sh0 * rng.range(0.92, 1.05)); }
        c.leaf(ex, ey, a, l * 0.3, HW.leaflet, sh0); }
      break; }
    case 'spray_cypress': case 'spray_tamarisk': case 'twig_tamarisk': {
      const cyp = name === 'spray_cypress', bare = name === 'twig_tamarisk';
      const tw = spray(rng, { spread: cyp ? 0.75 : 0.55, levels: 3, w: cyp ? 0.012 : 0.006, node: cyp ? 0.05 : 0.06, curve: cyp ? 0 : 0.2 });
      for (const t of tw) { const w = (cyp ? 0.026 : 0.012) * (t.level ? 0.9 : 1.1) * (bare ? 0.5 : 1);
        if (!inOval((t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2, rng)) continue;
        c.line(t.x0, t.y0, t.x1, t.y1, w, w * 0.7, bare ? 2 : 0, sh());
        if (!bare) for (const n of nodes([t], cyp ? 0.016 : 0.024, rng)) { const a = n.ang + n.side * 0.7, l = cyp ? 0.028 : 0.036; c.line(n.x, n.y, n.x + Math.sin(a) * l, n.y + Math.cos(a) * l, w * 0.75, w * 0.45, 0, sh()); } }
      break; }
    case 'blossom_small': case 'blossom_pomegranate': {
      const pom = name === 'blossom_pomegranate';
      const tw = spray(rng, { spread: 0.75, levels: 2, w: 0.011, node: 0.09 }); twigs(tw, 0.65);
      if (pom) {
        leafy(tw, HW.narrowWide, 0.02, 0.7, 0.2);
        for (const n of shuffle(nodes(tw, 0.1, rng))) { if (!inOval(n.x, n.y, rng)) continue; const r = rng.range(0.028, 0.04);
          const ox = n.x + Math.sin(n.ang + n.side * 1.2) * r * 0.7, oy = n.y + Math.cos(n.ang + n.side * 1.2) * r * 0.7;
          c.leaf(ox, oy - r, rng.range(-0.4, 0.4), r * 2.1, s2 => 0.3 * Math.pow(s2, 0.6) * (s2 > 0.72 ? 1.25 : 1), rng.range(0.75, 1), 1); } // tubular calyx and crumpled petals
      } else {
        // apple, pear and almond blossom sits in clusters on short spurs (4-7 flowers, a few young leaves), irregularly
        // spaced along the shoots: evenly spaced single flowers read as a regular dot grid (tree lab, 5 m)
        for (const n of shuffle(nodes(tw, 0.075, rng))) { if (!inOval(n.x, n.y, rng) || rng.chance(0.25)) continue;
          const a = n.ang + n.side * rng.range(0.6, 1.3), cx = n.x + Math.sin(a) * 0.03, cy = n.y + Math.cos(a) * 0.03;
          c.line(n.x, n.y, cx, cy, 0.006, 0.004, 2, 0.6);
          for (let k = rng.int(1, 2); k > 0; k--) c.leaf(cx, cy, a + rng.range(-1.2, 1.2), rng.range(0.045, 0.065), HW.ovate, sh());
          for (let k = rng.int(4, 7); k > 0; k--) { const t = rng.range(0, Math.PI * 2), d = rng.range(0, 0.03); c.flower(cx + Math.cos(t) * d, cy + Math.sin(t) * d, rng.range(0.016, 0.024), rng.range(0.85, 1)); } }
      }
      break; }
    case 'twig_fine': { const tw = spray(rng, { spread: 0.7, levels: 3, w: 0.014, node: 0.07 }); for (const t of tw) c.line(t.x0, t.y0, t.x1, t.y1, t.w * 0.75, t.w * 0.55, 2, sh()); break; }
    case 'twig_hanging': { const tw = spray(rng, { spread: 0.35, levels: 2, w: 0.01, node: 0.07, curve: 0.2 }); for (const t of tw) c.line(t.x0, t.y0, t.x1, t.y1, t.w * 0.8, t.w * 0.6, 2, sh()); break; }
    case 'twig_upright': { const tw = spray(rng, { spread: 0.35, levels: 3, w: 0.013, node: 0.07 }); for (const t of tw) c.line(t.x0, t.y0, t.x1, t.y1, t.w * 0.75, t.w * 0.55, 2, sh()); break; }
    case 'twig_stout': { const tw = spray(rng, { spread: 0.8, levels: 1, w: 0.03, node: 0.14, side: 0.7 }); for (const t of tw) c.line(t.x0, t.y0, t.x1, t.y1, t.w, t.w * 0.75, 2, sh()); break; }
    case 'twig_broom': { for (let k = 0; k < 18; k++) { const a = rng.range(-0.38, 0.38), x = 0.5 + rng.range(-0.05, 0.05); c.line(x, 0.04, x + Math.sin(a) * 0.85, 0.04 + Math.cos(a) * 0.85, 0.01, 0.005, 2, sh()); } break; }
  }
}

/** share of each tile's texels that pass the alpha test, from a quick low-resolution drawing (card-size calibration) */
export function atlasFill(leafFrac: Partial<Record<TileName, number>>, n = 64): number[] {
  return TILE_NAMES.map(name => { const c = new Canvas(n); drawTile(name, leafFrac[name] ?? 0.1, c); let k = 0; for (let i = 0; i < n * n; i++) if (c.a[i] >= 0.5) k++; return k / (n * n); });
}
/** per-tile leaf length (tile units) from the species using each tile: leaf size / card size */
export function buildAtlas(leafFrac: Partial<Record<TileName, number>>): Atlas {
  const W = TILE * COLS, H = TILE * ROWS, base = new Float32Array(W * H * 4);
  const fill: number[] = [];
  TILE_NAMES.forEach((name, ti) => {
    const c = new Canvas(); drawTile(name, leafFrac[name] ?? 0.1, c);
    const { u, v } = tileUV(ti), ox = Math.round(u * W), oy = Math.round(v * H); let n = 0;
    for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) { const k = j * TILE + i, o = ((oy + j) * W + ox + i) * 4;
      base[o] = c.r[k]; base[o + 1] = c.g[k]; base[o + 2] = c.b[k]; base[o + 3] = c.a[k]; if (c.a[k] >= 0.5) n++; }
    fill.push(n / (TILE * TILE));
  });
  return { width: W, height: H, levels: mipChain(base, W, H, TILE, COLS, ROWS, 7), fill };
}

/** RGBA float (0..1) -> mip levels as RGBA8, per tile: colour averaged by coverage (transparent texels take the colour of
 *  their covered neighbours, so bilinear edges do not darken), alpha scaled so the texels passing 0.5 keep the tile's
 *  full-size share (found per tile and level from an alpha histogram) */
export function mipChain(base: Float32Array, W: number, H: number, tile: number, cols: number, rows: number, nLevels: number, srgb = false) {
  const levels: { data: Uint8Array; width: number; height: number }[] = [];
  const nt = cols * rows, cover0 = new Float64Array(nt);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (base[(j * W + i) * 4 + 3] >= 0.5) cover0[Math.floor(j / tile) * cols + Math.floor(i / tile)]++;
  for (let t = 0; t < nt; t++) cover0[t] /= tile * tile;
  // srgb: the colour channels are linear and averaged as such, and written sRGB-encoded (averaging encoded values
  // darkened every mip of a contrasty image: the impostors read 10-19/255 darker than the near trees, tree lab r3)
  const enc = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  const toU8 = (f: Float32Array) => { const u = new Uint8Array(f.length); for (let i = 0; i < f.length; i++) { const x = srgb && (i & 3) !== 3 ? enc(Math.max(0, f[i])) : f[i]; const v = x * 255 + 0.5; u[i] = v <= 0 ? 0 : v >= 255 ? 255 : v; } return u; };
  /** colour of empty texels from covered neighbours (2 passes, 4-neighbourhood) */
  const bleed = (f: Float32Array, fw: number, fh: number) => {
    const has = new Uint8Array(fw * fh); for (let k = 0; k < fw * fh; k++) has[k] = f[k * 4 + 3] > 0.02 ? 1 : 0;
    for (let pass = 0; pass < 2; pass++) { const add: number[] = [];
      for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) { const k = j * fw + i; if (has[k]) continue; let r = 0, g = 0, b = 0, n = 0;
        if (i > 0 && has[k - 1]) { const q = (k - 1) * 4; r += f[q]; g += f[q + 1]; b += f[q + 2]; n++; }
        if (i < fw - 1 && has[k + 1]) { const q = (k + 1) * 4; r += f[q]; g += f[q + 1]; b += f[q + 2]; n++; }
        if (j > 0 && has[k - fw]) { const q = (k - fw) * 4; r += f[q]; g += f[q + 1]; b += f[q + 2]; n++; }
        if (j < fh - 1 && has[k + fw]) { const q = (k + fw) * 4; r += f[q]; g += f[q + 1]; b += f[q + 2]; n++; }
        if (n) { const o = k * 4; f[o] = r / n; f[o + 1] = g / n; f[o + 2] = b / n; add.push(k); } }
      for (const k of add) has[k] = 1; } };
  let cur = base, w = W, h = H, ts = tile;
  bleed(cur, w, h); levels.push({ data: toU8(cur), width: w, height: h });
  for (let L = 1; L < nLevels && ts > 2; L++) {
    const nw = w >> 1, nh = h >> 1, nx = new Float32Array(nw * nh * 4); ts >>= 1;
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) { let r = 0, g = 0, b = 0, a = 0, ws = 0;
      for (let q = 0; q < 4; q++) { const o = ((2 * j + (q >> 1)) * w + 2 * i + (q & 1)) * 4, ww = cur[o + 3] + 1e-4; r += cur[o] * ww; g += cur[o + 1] * ww; b += cur[o + 2] * ww; a += cur[o + 3]; ws += ww; }
      const o = (j * nw + i) * 4; nx[o] = r / ws; nx[o + 1] = g / ws; nx[o + 2] = b / ws; nx[o + 3] = a / 4; }
    // coverage preservation per tile: the smallest scale k with share(alpha * k >= 0.5) >= the full-size share
    for (let t = 0; t < nt; t++) { if (cover0[t] <= 0) continue; const ox = (t % cols) * ts, oy = Math.floor(t / cols) * ts;
      const hist = new Uint32Array(1025); for (let j = 0; j < ts; j++) for (let i = 0; i < ts; i++) hist[Math.min(1024, Math.round(nx[((oy + j) * nw + ox + i) * 4 + 3] * 1024))]++;
      const need = cover0[t] * ts * ts; let acc = 0, amin = 1; for (let v = 1024; v >= 1; v--) { acc += hist[v]; amin = v / 1024; if (acc >= need) break; }
      const k = Math.min(6, Math.max(1, 0.5 / amin));
      if (k > 1) for (let j = 0; j < ts; j++) for (let i = 0; i < ts; i++) { const o = ((oy + j) * nw + ox + i) * 4 + 3; nx[o] = Math.min(1, nx[o] * k); } }
    cur = nx; w = nw; h = nh; bleed(cur, w, h);
    levels.push({ data: toU8(cur), width: w, height: h });
  }
  return levels;
}
