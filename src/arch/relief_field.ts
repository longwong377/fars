// Carved low-relief heightfields (D-019). A figure is a list of "masses" (body, arm, beard, spear …), each a union of
// 2-D signed-distance primitives in the figure's frame (x = walking direction, y = up, units = figure heights). Each mass
// is carved as a rounded pad: a crisp step at the outline (the cut-back background), a quarter-round falloff to its full
// height, optional broad doming, surface detail (pleats, curls, flutes, feathers) and a contour groove where it lies over
// another mass. Masses are composited back to front, so a front arm rides a little above the torso it crosses and keeps
// its own height where it leaves the body. Incised lines (eye, lids, straps) are cut last.
// The field is sampled on a (2^k+1)² grid and meshed with a right-triangulated irregular network (RTIN, after Evans et
// al. 2001 / mapbox "martini"): error-driven, crack-free, one field → every LOD by changing the error bound. Empty
// background triangles are dropped. Normals come from the field (central differences), so raking light shows the modelling.
import PC from '../data/polychromy.json';
import { srgbToLinear, labToSrgb } from '../core/colour';
export type C3 = [number, number, number];
export type Box = [number, number, number, number];
/** the unpainted carved limestone (sRGB) = src/render/materials.ts SURFACES.limestone_carved.albedo (tests/polychromy.test.ts
 *  checks they agree; this module runs in workers, so it cannot import the renderer's materials) */
export const STONE_SRGB: C3 = [0.6949, 0.6797, 0.6343]; // light grey limestone, N7 (D-188; was 0.44/0.43/0.40)
/** the colour key of gilding (gold leaf, D-151): a mass drawn in this colour is gilded, and its vertices carry `gilt` = 1 so
 *  the relief material shades them as gold metal (src/data/polychromy.json pigment.gilt: its Lab row is the tone the
 *  leaf shows where it is lost or seen by a renderer without the metal path) */
const GL = (PC as any).pigment.gilt.v as number[];
export const GILT_SRGB: C3 = labToSrgb(GL[0], GL[1], GL[2]);
/** paint wear on raised arrises (src/data/polychromy.json paint.wear, C) */
const WEAR = (PC as any).paint.wear.v as { radius: number; conv0: number; conv1: number; max: number };
export interface SDF { f: (x: number, y: number) => number; b: Box; pv?: Float64Array /* polygon vertices x0,y0,x1,y1… (fast band raster) */ }

// ---------------- primitives (exact or near-exact 2-D SDFs; after I. Quilez) ----------------
export function circle(cx: number, cy: number, r: number): SDF {
  return { f: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r, b: [cx - r, cy - r, cx + r, cy + r] };
}
export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): SDF {
  const c = Math.cos(rot), s = Math.sin(rot), ex = Math.hypot(rx * c, ry * s), ey = Math.hypot(rx * s, ry * c);
  return {
    f: (x, y) => {
      const dx = x - cx, dy = y - cy, u = dx * c + dy * s, v = -dx * s + dy * c;
      const a = u / rx, b = v / ry, a2 = u / (rx * rx), b2 = v / (ry * ry), k0 = Math.sqrt(a * a + b * b), k1 = Math.sqrt(a2 * a2 + b2 * b2);
      return k1 < 1e-12 ? -Math.min(rx, ry) : (k0 * (k0 - 1)) / k1;
    },
    b: [cx - ex, cy - ey, cx + ex, cy + ey],
  };
}
/** tapered capsule from a (radius ra) to b (radius rb) */
export function seg(ax: number, ay: number, bx: number, by: number, ra: number, rb = ra): SDF {
  const px = bx - ax, py = by - ay, h = px * px + py * py, L = Math.sqrt(h), dr = ra - rb;
  if (L < 1e-9 || Math.abs(dr) >= L) return ra >= rb ? circle(ax, ay, ra) : circle(bx, by, rb);
  const cx = Math.sqrt(h - dr * dr), cy = dr;
  return {
    f: (x, y) => {
      const wx = x - ax, wy = y - ay;
      const qx = Math.abs(wx * py - wy * px) / h, qy = (wx * px + wy * py) / h;
      const k = cx * qy - cy * qx, n = qx * qx + qy * qy;
      if (k < 0) return Math.sqrt(h * n) - ra;
      if (k > cx) return Math.sqrt(h * (n + 1 - 2 * qy)) - rb;
      return cx * qx + cy * qy - ra;
    },
    b: [Math.min(ax - ra, bx - rb), Math.min(ay - ra, by - rb), Math.max(ax + ra, bx + rb), Math.max(ay + ra, by + rb)],
  };
}
/** exact polygon SDF (any simple polygon, either winding) */
export function poly(pts: number[][]): SDF {
  const n = pts.length, X = new Float64Array(n), Y = new Float64Array(n);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(([x, y], i) => { X[i] = x; Y[i] = y; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  return {
    f: (px, py) => {
      let d = (px - X[0]) ** 2 + (py - Y[0]) ** 2, s = 1;
      for (let i = 0, j = n - 1; i < n; j = i, i++) {
        const ex = X[j] - X[i], ey = Y[j] - Y[i], wx = px - X[i], wy = py - Y[i];
        const t = Math.min(1, Math.max(0, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
        const bx = wx - ex * t, by = wy - ey * t; d = Math.min(d, bx * bx + by * by);
        const c1 = py >= Y[i], c2 = py < Y[j], c3 = ex * wy > ey * wx;
        if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
      }
      return s * Math.sqrt(d);
    },
    b: [x0, y0, x1, y1],
    pv: Float64Array.from(pts.flatMap(([x, y]) => [x, y])),
  };
}
/** closed Catmull-Rom spline through control points → smooth polygon */
export function spoly(ctrl: number[][], sub = 4): SDF { return poly(catmull(ctrl, sub, true)); }
export function catmull(ctrl: number[][], sub: number, closed: boolean): number[][] {
  const n = ctrl.length, out: number[][] = [], P = (i: number) => ctrl[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  if (!closed) out.push(ctrl[n - 1]);
  return out;
}
/** open polyline through control points (Catmull-Rom), tapering from r0 to r1, as ONE outline polygon with round caps
 *  (rasterised by the fast band path; nonzero winding keeps tight bends filled) */
export function stroke(ctrl: number[][], r0: number, r1 = r0, sub = 4): SDF[] { return strokeR(ctrl, [r0, r1], sub); }
/** stroke with a radius per control point (2 radii = linear taper along the length) */
export function strokeR(ctrl: number[][], radii: number[], sub = 4): SDF[] {
  const pts = ctrl.length > 2 ? catmull(ctrl, sub, false) : ctrl, n = pts.length;
  let total = 0; const acc = [0]; for (let i = 1; i < n; i++) { total += Math.sqrt((pts[i][0] - pts[i - 1][0]) ** 2 + (pts[i][1] - pts[i - 1][1]) ** 2); acc.push(total); }
  const rad: number[] = [];
  if (radii.length === ctrl.length && ctrl.length > 2) { for (let i = 0; i < n; i++) { const seg = Math.min(ctrl.length - 2, Math.floor(i / sub)), t = (i - seg * sub) / sub, e = t * t * (3 - 2 * t); rad.push(radii[seg] + (radii[seg + 1] - radii[seg]) * e); } }
  else { const r0 = radii[0], r1 = radii[radii.length - 1]; for (let i = 0; i < n; i++) rad.push(r0 + (r1 - r0) * (total > 0 ? acc[i] / total : 0)); }
  if (n < 2 || total < 1e-9) return [circle(pts[0][0], pts[0][1], Math.max(...rad))];
  const nrm = (i: number) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1; return [-dy / l, dx / l]; };
  const L: number[][] = [], R: number[][] = [];
  for (let i = 0; i < n; i++) { const [nx, ny] = nrm(i), ri = rad[i]; L.push([pts[i][0] + nx * ri, pts[i][1] + ny * ri]); R.push([pts[i][0] - nx * ri, pts[i][1] - ny * ri]); }
  // round caps: the end cap bulges forward (left → right side), the start cap backward (right → left side)
  const cap = (i: number, back: boolean) => { const [nx, ny] = nrm(i), ri = rad[i], a0 = Math.atan2(ny, nx) + (back ? Math.PI : 0), out: number[][] = [];
    for (let k = 1; k < 6; k++) { const a = a0 - (Math.PI * k) / 6; out.push([pts[i][0] + Math.cos(a) * ri, pts[i][1] + Math.sin(a) * ri]); } return out; };
  return [poly([...L, ...cap(n - 1, false), ...R.reverse(), ...cap(0, true)])];
}
/** the same as a chain of exact tapered capsules (for very tight curves) */
export function capsules(ctrl: number[][], r0: number, r1 = r0, sub = 4): SDF[] {
  const pts = ctrl.length > 2 ? catmull(ctrl, sub, false) : ctrl, n = pts.length, out: SDF[] = [];
  let total = 0; const acc = [0]; for (let i = 1; i < n; i++) { total += Math.sqrt((pts[i][0] - pts[i - 1][0]) ** 2 + (pts[i][1] - pts[i - 1][1]) ** 2); acc.push(total); }
  const r = (i: number) => r0 + (r1 - r0) * (total > 0 ? acc[i] / total : 0);
  for (let i = 1; i < n; i++) out.push(seg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], r(i - 1), r(i)));
  return out;
}
/** SDF modifiers */
export const offset = (s: SDF, r: number): SDF => ({ f: (x, y) => s.f(x, y) - r, b: [s.b[0] - r, s.b[1] - r, s.b[2] + r, s.b[3] + r] });
export const diff = (a: SDF, b: SDF): SDF => ({ f: (x, y) => Math.max(a.f(x, y), -b.f(x, y)), b: a.b });
export const inter = (a: SDF, b: SDF): SDF => ({ f: (x, y) => Math.max(a.f(x, y), b.f(x, y)), b: [Math.max(a.b[0], b.b[0]), Math.max(a.b[1], b.b[1]), Math.min(a.b[2], b.b[2]), Math.min(a.b[3], b.b[3])] });
export const union = (...s: SDF[]): SDF => ({ f: (x, y) => { let d = Infinity; for (const q of s) d = Math.min(d, q.f(x, y)); return d; }, b: s.reduce<Box>((b, q) => [Math.min(b[0], q.b[0]), Math.min(b[1], q.b[1]), Math.max(b[2], q.b[2]), Math.max(b[3], q.b[3])], [Infinity, Infinity, -Infinity, -Infinity]) });
/** an unsigned band along a shape's outline (for incised contours): |d| − w/2 */
export const outline = (s: SDF): SDF => ({ f: (x, y) => Math.abs(s.f(x, y)), b: s.b });

// ---------------- masses ----------------
export interface Mass {
  name?: string;
  add: SDF[];                 // unioned
  smooth?: number;            // smooth-union radius among `add` (0 = hard)
  sub?: SDF[];                // subtracted after the union
  clip?: SDF;                 // intersected
  amp: number;                // own height at full rounding (relief-depth units, 0..1)
  lift?: number;              // rise above whatever is already carved beneath (depth units)
  round?: number;             // rounding width at the outline (figure units)
  edge?: number;              // fraction of the height kept as a crisp step at the outline
  dome?: number;              // broad doming: height lost at the outline over `domeW`
  domeW?: number;
  groove?: number;            // contour cut just outside the mass, into what lies beneath (depth units)
  grooveW?: number;
  colour: C3 | ((x: number, y: number) => C3);
  paintOnly?: boolean;        // colour only (painted band), no carving
  detail?: (x: number, y: number, t: number) => number; // added height inside (depth units); faded near the outline
}
export interface Incision { s: SDF; depth: number; width: number; unsigned?: boolean }
export interface FigureDef { masses: Mass[]; incisions?: Incision[]; bounds?: Box }

export const BG = 0; // colour index 0 = background (no mass)
export interface Field { n: number; x0: number; y0: number; cell: number; h: Float32Array; col: Uint8Array; palette: C3[] }

const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const sstep = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export function figureBounds(def: FigureDef, margin = 0.02): Box {
  if (def.bounds) return def.bounds;
  let b: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const m of def.masses) { if (m.paintOnly) continue; for (const s of m.add) b = [Math.min(b[0], s.b[0]), Math.min(b[1], s.b[1]), Math.max(b[2], s.b[2]), Math.max(b[3], s.b[3])]; }
  return [b[0] - margin, b[1] - margin, b[2] + margin, b[3] + margin];
}

const BIG = 1e3;
/** Signed distance of one shape over the cell range [a0..a1]×[c0..c1] (grid origin x0,y0, step cell): exact within `band`
 *  of the outline, ±BIG (sign-correct) beyond it. Polygons: scanline sign + per-edge distance bands (cost ∝ perimeter × band,
 *  not area × vertices); other primitives: exact evaluation. */
function shapeField(s: SDF, a0: number, a1: number, c0: number, c1: number, x0: number, y0: number, cell: number, band: number): Float32Array {
  const nx = a1 - a0 + 1, ny = c1 - c0 + 1, out = new Float32Array(nx * ny);
  if (!s.pv) { for (let j = 0; j < ny; j++) { const y = y0 + (c0 + j) * cell; for (let i = 0; i < nx; i++) out[j * nx + i] = s.f(x0 + (a0 + i) * cell, y); } return out; }
  const V = s.pv, nv = V.length / 2; out.fill(BIG);
  if (band > 0) for (let e = 0; e < nv; e++) {
    const ax = V[e * 2], ay = V[e * 2 + 1], bx = V[((e + 1) % nv) * 2], by = V[((e + 1) % nv) * 2 + 1], ex = bx - ax, ey = by - ay, ll = ex * ex + ey * ey || 1;
    const i0 = Math.max(a0, Math.floor((Math.min(ax, bx) - band - x0) / cell)), i1 = Math.min(a1, Math.ceil((Math.max(ax, bx) + band - x0) / cell));
    const j0 = Math.max(c0, Math.floor((Math.min(ay, by) - band - y0) / cell)), j1 = Math.min(c1, Math.ceil((Math.max(ay, by) + band - y0) / cell));
    for (let j = j0; j <= j1; j++) { const wy = y0 + j * cell - ay, row = (j - c0) * nx - a0;
      for (let i = i0; i <= i1; i++) { const wx = x0 + i * cell - ax, t = Math.min(1, Math.max(0, (wx * ex + wy * ey) / ll)), dx = wx - ex * t, dy = wy - ey * t, d = Math.sqrt(dx * dx + dy * dy);
        if (d < out[row + i]) out[row + i] = d; } }
  }
  const xs: number[] = []; // crossings as x + direction (nonzero winding)
  for (let j = 0; j < ny; j++) {
    const y = y0 + (c0 + j) * cell; xs.length = 0;
    for (let e = 0; e < nv; e++) { const ay = V[e * 2 + 1], by = V[((e + 1) % nv) * 2 + 1];
      if (ay <= y && y < by) { const ax = V[e * 2], bx = V[((e + 1) % nv) * 2]; xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay), 1); }
      else if (by <= y && y < ay) { const ax = V[e * 2], bx = V[((e + 1) % nv) * 2]; xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay), -1); } }
    if (!xs.length) continue;
    const order = Array.from({ length: xs.length / 2 }, (_, k) => k).sort((p, q) => xs[p * 2] - xs[q * 2]);
    let wind = 0;
    for (let k = 0; k < order.length; k++) {
      const before = wind; wind += xs[order[k] * 2 + 1];
      if (before === 0 && wind !== 0 && k + 1 < order.length) { // entering: fill until winding returns to 0
        let k2 = k + 1, w2 = wind; while (k2 < order.length) { w2 += xs[order[k2] * 2 + 1]; if (w2 === 0) break; k2++; }
        const xa = xs[order[k] * 2], xb = xs[order[Math.min(k2, order.length - 1)] * 2];
        const i0 = Math.max(0, Math.ceil((xa - x0) / cell) - a0), i1 = Math.min(nx - 1, Math.floor((xb - x0) / cell) - a0);
        for (let i = i0; i <= i1; i++) out[j * nx + i] = -out[j * nx + i];
        wind = 0; k = k2;
      }
    }
  }
  return out;
}
/** separable box blur (radius r cells), in place, applied twice (≈ tent) */
function blur2(a: Float32Array, nx: number, ny: number, r: number) {
  if (r < 1) return;
  const tmp = new Float32Array(Math.max(nx, ny));
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < ny; j++) { let acc = 0; const o = j * nx; for (let i = -r; i <= r; i++) acc += a[o + Math.min(nx - 1, Math.max(0, i))];
      for (let i = 0; i < nx; i++) { tmp[i] = acc / (2 * r + 1); acc += a[o + Math.min(nx - 1, i + r + 1)] - a[o + Math.max(0, i - r)]; } for (let i = 0; i < nx; i++) a[o + i] = tmp[i]; }
    for (let i = 0; i < nx; i++) { let acc = 0; for (let j = -r; j <= r; j++) acc += a[Math.min(ny - 1, Math.max(0, j)) * nx + i];
      for (let j = 0; j < ny; j++) { tmp[j] = acc / (2 * r + 1); acc += a[Math.min(ny - 1, j + r + 1) * nx + i] - a[Math.max(0, j - r) * nx + i]; } for (let j = 0; j < ny; j++) a[j * nx + i] = tmp[j]; }
  }
}

/** finest surface-detail period used by the figures (curls, cascade pleats), figure units: detail is band-limited to grids
 *  with at least 2.5 cells per period, and incisions narrower than a cell are widened (with proportionally less depth) */
export const DETAIL_PERIOD = 0.0125;
/** deepest cut-back of the background at the foot of an outline, relief-depth units (behind the wall face; D-204) */
export const FOOT_CUT = 0.5;
/** RTIN error given to the silhouette's grid points (relief-depth units): above the L2 bound of reliefs.ts RELIEF_LODS
 *  (0.12), so the outline is cell-exact at L0–L2; below L3's (0.3), where a cell is ≲ 1 px (D-204) */
export const SILHOUETTE_ERROR = 0.2;
/** how far (cells) a background vertex of a LOD mesh looks for the carved point whose paint it takes (D-204) */
export const FOOT_REACH = 3;
/** Sample a figure on an n×n grid (n = 2^k + 1) covering its bounds (square, figure units). Heights in depth units, soft-clamped to ≤ 1. */
export function rasterize(def: FigureDef, n: number, prefilter = false): Field {
  const [bx0, by0, bx1, by1] = figureBounds(def);
  const E = Math.max(bx1 - bx0, by1 - by0), cell = E / (n - 1);
  const x0 = (bx0 + bx1) / 2 - E / 2, y0 = by0; // ground line kept at the bottom of the grid
  const h = new Float32Array(n * n), col = new Uint8Array(n * n);
  const palette: C3[] = [[0, 0, 0]], palIdx = new Map<string, number>(), palRef = new Map<C3, number>();
  const pal = (c: C3) => { let i = palRef.get(c); if (i !== undefined) return i; const k = c.join(','); i = palIdx.get(k);
    if (i === undefined) { i = palette.length; palette.push(c); palIdx.set(k, i); if (i > 255) throw new Error('relief palette overflow'); } palRef.set(c, i); return i; };
  const ix = (x: number) => Math.round((x - x0) / cell), iy = (y: number) => Math.round((y - y0) / cell);
  // surface detail (D-204): point-sampled where the grid resolves the finest period (≥ 2.5 cells) and the LOD asks for no
  // prefilter (L0, L1); otherwise prefiltered, averaged over a K×K lattice spanning ±1 cell (a box two cells wide: periods under two cells, which would
  // alias, average away, broad folds survive), instead of being dropped as it was (D-019), which left every figure seen
  // beyond 4 m, and every large one (audience panel, jambs) nearer, a flat pad
  const fine = !prefilter && cell <= DETAIL_PERIOD / 2.5, K = fine ? 1 : 4, SUB = Array.from({ length: K }, (_, k) => (K === 1 ? 0 : ((k + 0.5) / K - 0.5) * 2 * cell));
  const detailAt = (fn: (x: number, y: number, t: number) => number, x: number, y: number, t: number) => {
    if (K === 1) return fn(x, y, t);
    let s = 0; for (const dy of SUB) for (const dx of SUB) s += fn(x + dx, y + dy, t); return s / (K * K);
  };
  for (const m of def.masses) {
    const w = m.round ?? 0.02, e0 = m.edge ?? 0.45, gw = m.grooveW ?? 0.006, k = m.smooth ?? 0;
    const band = m.paintOnly ? 0 : Math.max(w, gw) + k + 2 * cell, Mg = band + cell, half = cell / 2;
    let b: Box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const s of m.add) b = [Math.min(b[0], s.b[0]), Math.min(b[1], s.b[1]), Math.max(b[2], s.b[2]), Math.max(b[3], s.b[3])];
    if (m.clip) b = [Math.max(b[0], m.clip.b[0]), Math.max(b[1], m.clip.b[1]), Math.min(b[2], m.clip.b[2]), Math.min(b[3], m.clip.b[3])];
    const i0 = Math.max(0, ix(b[0] - Mg)), i1 = Math.min(n - 1, ix(b[2] + Mg)), j0 = Math.max(0, iy(b[1] - Mg)), j1 = Math.min(n - 1, iy(b[3] + Mg));
    if (i1 < i0 || j1 < j0) continue;
    const nx = i1 - i0 + 1, ny = j1 - j0 + 1, buf = new Float32Array(nx * ny).fill(BIG);
    const apply = (s: SDF, op: 0 | 1 | 2) => { // 0 union, 1 subtract, 2 clip
      const a0 = op === 2 ? i0 : Math.max(i0, ix(s.b[0] - Mg)), a1 = op === 2 ? i1 : Math.min(i1, ix(s.b[2] + Mg)), c0 = op === 2 ? j0 : Math.max(j0, iy(s.b[1] - Mg)), c1 = op === 2 ? j1 : Math.min(j1, iy(s.b[3] + Mg));
      if (a1 < a0 || c1 < c0) return;
      const f = shapeField(s, a0, a1, c0, c1, x0, y0, cell, band), fx = a1 - a0 + 1;
      for (let j = c0; j <= c1; j++) { const r = (j - j0) * nx - i0, rf = (j - c0) * fx - a0;
        for (let i = a0; i <= a1; i++) { const q = r + i, d = f[rf + i];
          buf[q] = op === 1 ? Math.max(buf[q], -d) : op === 2 ? Math.max(buf[q], d) : k > 0 ? smin(buf[q], d, k) : Math.min(buf[q], d); } }
    };
    for (const s of m.add) apply(s, 0);
    for (const s of m.sub ?? []) apply(s, 1);
    if (m.clip) apply(m.clip, 2);
    const cst = typeof m.colour === 'function' ? null : pal(m.colour), cfn = typeof m.colour === 'function' ? m.colour : null;
    const lift = m.lift ?? 0, dome = m.dome ?? 0, groove = m.groove ?? 0;
    let dm: Float32Array | null = null;
    if (dome > 0 && !m.paintOnly) { dm = new Float32Array(nx * ny); for (let q = 0; q < dm.length; q++) dm[q] = buf[q] < 0 ? 1 : 0; blur2(dm, nx, ny, Math.max(1, Math.round((m.domeW ?? 0.08) / cell / 2))); }
    for (let j = j0; j <= j1; j++) {
      const y = y0 + j * cell, row = (j - j0) * nx - i0;
      for (let i = i0; i <= i1; i++) {
        const d = buf[row + i], g = j * n + i;
        if (m.paintOnly) { if (d < 0 && h[g] > 0) col[g] = cfn ? pal(cfn(x0 + i * cell, y)) : cst!; continue; }
        if (d < half) {
          // the cut-back step is anti-aliased (D-204): the mass covers a grid point by clamp(½ − d/cell), so the step is a
          // one-cell ramp centred on the true outline and its normals follow the outline's direction. Point-sampled
          // (D-019), a coarse grid staircased the outline and the central-difference normals at the stair corners flipped
          // between the axes: dark and bright dots all round every figure seen from a few metres
          const x = x0 + i * cell, cv = Math.min(1, 0.5 - d / cell);
          const t = Math.max(0, -d), s1 = Math.min(1, t / w);
          let p = e0 + (1 - e0) * Math.sqrt(1 - (1 - s1) * (1 - s1));
          if (dm) { const s2 = Math.min(1, Math.max(0, (dm[row + i] - 0.5) * 2)); p *= 1 - dome * (1 - s2) * (1 - s2); }
          let v = Math.max(m.amp * p, h[g] + lift * p);
          if (m.detail && t > 0) v += detailAt(m.detail, x, y, t) * sstep(0, w * 0.9, t);
          v = Math.max(0.02, v);
          h[g] = cv >= 1 ? v : h[g] + (v - h[g]) * cv;
          // a point outside the outline takes the mass's paint only where nothing else lies (the foot of the step is painted
          // like its face; D-204)
          if (d < 0 || col[g] === BG) col[g] = cfn ? pal(cfn(x, y)) : cst!;
        } else if (groove > 0 && d < gw && h[g] > 0) {
          const q = 1 - d / gw; h[g] = Math.max(0.02, h[g] - groove * q * q);
        }
      }
    }
  }
  for (const c0 of def.incisions ?? []) {
    const c = c0.width >= cell ? c0 : { ...c0, width: cell, depth: (c0.depth * c0.width) / cell };
    const Mw = c.width + cell, i0 = Math.max(0, ix(c.s.b[0] - Mw)), i1 = Math.min(n - 1, ix(c.s.b[2] + Mw)), j0 = Math.max(0, iy(c.s.b[1] - Mw)), j1 = Math.min(n - 1, iy(c.s.b[3] + Mw));
    if (i1 < i0 || j1 < j0) continue;
    const f = shapeField(c.s, i0, i1, j0, j1, x0, y0, cell, c.width + cell), fx = i1 - i0 + 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const g = j * n + i; if (h[g] <= 0) continue;
      const d = Math.abs(f[(j - j0) * fx + i - i0]); if (d >= c.width) continue;
      const q = 1 - (d / c.width) ** 2; h[g] = Math.max(0.02, h[g] - c.depth * q);
    }
  }
  // soft clamp to the relief depth: linear to 0.85, then a tanh knee to 1
  for (let i = 0; i < h.length; i++) { const v = h[i]; if (v > 0.85) h[i] = 0.85 + 0.15 * Math.tanh((v - 0.85) / 0.15); }
  // the background at the foot of every outline is cut back below the wall face by as much as the step rises above it
  // (D-204): the step's triangles then cross the wall face at mid-height, where the linear interpolation of a one-cell step
  // is a straight line whichever way the RTIN splits the cell. With the foot on the background plane (just behind the face,
  // r_relief_carving.embed) the visible silhouette was the step's foot contour, which zigzags by up to a cell between
  // the two diagonals: a toothed edge on every straight outline. The cut-back lies behind the wall face (never drawn)
  const FOOT = FOOT_CUT;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const g = j * n + i; if (h[g] !== 0) continue;
    let nb = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < n && jj < n && h[jj * n + ii] > nb) nb = h[jj * n + ii]; }
    if (nb > 0) h[g] = -Math.min(FOOT, nb);
  }
  return { n, x0, y0, cell, h, col, palette };
}

// ---------------- RTIN meshing ----------------
const coordCache = new Map<number, Uint16Array>();
function rtinCoords(n: number): Uint16Array {
  let c = coordCache.get(n); if (c) return c;
  const tile = n - 1, numTri = tile * tile * 2 - 2; c = new Uint16Array(numTri * 4);
  for (let i = 0; i < numTri; i++) {
    let id = i + 2, ax = 0, ay = 0, bx = 0, by = 0, cx = 0, cy = 0;
    if (id & 1) { bx = by = cx = tile; } else { ax = ay = cy = tile; }
    while ((id >>= 1) > 1) {
      const mx = (ax + bx) >> 1, my = (ay + by) >> 1;
      if (id & 1) { bx = ax; by = ay; ax = cx; ay = cy; } else { ax = bx; ay = by; bx = cx; by = cy; }
      cx = mx; cy = my;
    }
    const k = i * 4; c[k] = ax; c[k + 1] = ay; c[k + 2] = bx; c[k + 3] = by;
  }
  coordCache.set(n, c); return c;
}
/** per-vertex approximation error of the RTIN hierarchy (vertical error; colour edges count as a small error so that
 *  paint boundaries are refined at the finest LOD only: above the L0 bound of reliefs.ts RELIEF_LODS (0.03), below L1's
 *  (0.06). D-151: it was 0.02, under every in-game bound since D-048, so no paint edge was ever refined and painted bands
 *  and patterns blurred across the coarse triangles of flat stone) */
export function rtinErrors(f: Field, colourEdgeError = 0.04, silhouetteError = SILHOUETTE_ERROR): Float32Array {
  const { n, h, col } = f, tile = n - 1, numTri = tile * tile * 2 - 2, numParent = numTri - tile * tile, coords = rtinCoords(n);
  const err = new Float32Array(n * n);
  // the silhouette (D-204): every grid point of the cut-back foot (h < 0) is refined, so the outline is drawn in single
  // cells at every LOD it applies to. Error-driven alone, a triangle whose hypotenuse runs along a straight outline has no
  // error at its midpoint, so it was never split and its legs crossed the step at 45°: a toothed edge 2–4 cells deep
  if (colourEdgeError > 0) for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) { const g = j * n + i, c = col[g];
    if (c !== col[g - 1] || c !== col[g + 1] || c !== col[g - n] || c !== col[g + n]) err[g] = colourEdgeError; }
  if (silhouetteError > 0) for (let g = 0; g < n * n; g++) if (h[g] < 0) err[g] = Math.max(err[g], silhouetteError);
  for (let i = numTri - 1; i >= 0; i--) {
    const k = i * 4, ax = coords[k], ay = coords[k + 1], bx = coords[k + 2], by = coords[k + 3];
    const mx = (ax + bx) >> 1, my = (ay + by) >> 1, cx = mx + my - ay, cy = my + ax - mx;
    // heights clamped at the wall face: the foot cut-back (behind the face) adds no error of its own (D-204)
    const mid = my * n + mx, e = Math.abs((Math.max(0, h[ay * n + ax]) + Math.max(0, h[by * n + bx])) / 2 - Math.max(0, h[mid]));
    let v = Math.max(err[mid], e);
    if (i < numParent) v = Math.max(v, err[((ay + cy) >> 1) * n + ((ax + cx) >> 1)], err[((by + cy) >> 1) * n + ((bx + cx) >> 1)]);
    err[mid] = v;
  }
  return err;
}

/** A LOD mesh in the figure's normalised frame: x, y in figure units, z = height in depth units (0..1);
 *  gradients (dh/dx, dh/dy in depth units per figure unit) for normals; linear-light colours; paint coverage per vertex
 *  (0 = bare stone: background, faces, animals; on painted masses 1 − wear at raised arrises, D-030). */
export interface LodMesh { pos: Float32Array; grad: Float32Array; col: Float32Array; paint: Float32Array; gilt: Float32Array; /** sky occlusion by the carving (0 open … 1 shut), D-217 */ ao: Float32Array; index: Uint32Array; tris: number; verts: number; maxH: number }

/** paint coverage at grid points: 0 where the colour is bare stone; else 1 − WEAR.max · smoothstep(conv0, conv1, convexity),
 *  convexity = h − (mean h within WEAR.radius figure units, at least one cell) from a summed-area table */
function paintCoverage(f: Field, verts: Int32Array, nv: number): Float32Array {
  const { n, h, col, cell, palette } = f, out = new Float32Array(nv);
  const painted = palette.map((c, i) => i !== BG && !(c[0] === STONE_SRGB[0] && c[1] === STONE_SRGB[1] && c[2] === STONE_SRGB[2]));
  if (!painted.some(Boolean)) return out;
  const sat = new Float64Array((n + 1) * (n + 1)), W = n + 1;
  for (let j = 0; j < n; j++) { let row = 0; for (let i = 0; i < n; i++) { row += Math.max(0, h[j * n + i]); sat[(j + 1) * W + i + 1] = sat[j * W + i + 1] + row; } }
  // a worn outline vertex tints triangles about one cell wide: scale the wear so a coarse LOD does not show more of it
  const r = Math.max(1, Math.round(WEAR.radius / cell)), amount = WEAR.max * Math.min(1, WEAR.radius / cell);
  for (let v = 0; v < nv; v++) {
    const g = verts[v]; if (!painted[col[g]]) continue;
    const i = g % n, j = (g - i) / n, i0 = Math.max(0, i - r), i1 = Math.min(n - 1, i + r), j0 = Math.max(0, j - r), j1 = Math.min(n - 1, j + r);
    const mean = (sat[(j1 + 1) * W + i1 + 1] - sat[j0 * W + i1 + 1] - sat[(j1 + 1) * W + i0] + sat[j0 * W + i0]) / ((i1 - i0 + 1) * (j1 - j0 + 1));
    const t = Math.min(1, Math.max(0, (Math.max(0, h[g]) - mean - WEAR.conv0) / (WEAR.conv1 - WEAR.conv0)));
    out[v] = 1 - amount * t * t * (3 - 2 * t);
  }
  return out;
}

/** the carving's own occlusion of the sky (D-217; rubric s7 pass 2, R2: the figures read as flat cut-outs, with no dark
 *  line at their contours): a horizon-based ambient occlusion from the heightfield, 8 directions out to AO_REACH figure
 *  units, heights at a register figure's depth-to-height (AO_DEPTH_RATIO: r_relief_depth / the register figure, 0.045 /
 *  0.78 m). A point at the foot of a step (the wall face beside a figure, the fold under an arm) sees less sky; the foot's
 *  cut-back (h < 0, behind the wall face) is taken at the wall face, so the step's triangles darken toward the contour.
 *  Returned as occlusion 0…1 per vertex; the material scales the sky light by 1 − AO_STRENGTH × it (C) */
export const AO_REACH = 0.06, AO_DEPTH_RATIO = 0.058, AO_STRENGTH = 0.85;
function carvingOcclusion(f: Field, verts: Int32Array, nv: number): Float32Array {
  const { n, h, cell } = f, out = new Float32Array(nv), R = Math.max(2, Math.ceil(AO_REACH / cell)), stride = Math.max(1, Math.floor(R / 16));
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  for (let v = 0; v < nv; v++) {
    const g = verts[v], i = g % n, j = (g - i) / n, hv = Math.max(0, h[g]); let occ = 0;
    for (const [dx, dy] of dirs) { const step = Math.hypot(dx, dy) * cell; let tmax = 0;
      for (let r = 1; r <= R; r += stride) { const ii = i + dx * r, jj = j + dy * r; if (ii < 0 || jj < 0 || ii >= n || jj >= n) break;
        const t = ((Math.max(0, h[jj * n + ii]) - hv) * AO_DEPTH_RATIO) / (r * step); if (t > tmax) tmax = t; }
      occ += tmax / Math.sqrt(1 + tmax * tmax); }
    out[v] = occ / dirs.length;
  }
  return out;
}
/** Extract a LOD: RTIN triangles with error ≤ maxError, background-only triangles dropped, vertices compacted.
 *  `gradStep` = central-difference half-width in cells (larger for coarse LODs → normals of the local average). */
const scratch = new Map<number, { vid: Int32Array; vlist: Int32Array; tris: Uint32Array }>();
export function extractLod(f: Field, err: Float32Array, maxError: number, gradStep = 1, bgColour: C3 = STONE_SRGB): LodMesh {
  const { n, h, col, cell, x0, y0, palette } = f, max = n - 1;
  let sc = scratch.get(n); if (!sc) { sc = { vid: new Int32Array(n * n), vlist: new Int32Array(n * n), tris: new Uint32Array(max * max * 6) }; scratch.set(n, sc); }
  const { vid, vlist, tris } = sc; vid.fill(-1);
  let nv = 0, nt = 0;
  const stack = new Int32Array(6 * 4 * 32); let sp = 0;
  const push6 = (a: number, b: number, c: number, d: number, e: number, g: number) => { stack[sp++] = a; stack[sp++] = b; stack[sp++] = c; stack[sp++] = d; stack[sp++] = e; stack[sp++] = g; };
  push6(0, 0, max, max, max, 0); push6(max, max, 0, 0, 0, max);
  while (sp > 0) {
    sp -= 6; const ax = stack[sp], ay = stack[sp + 1], bx = stack[sp + 2], by = stack[sp + 3], cx = stack[sp + 4], cy = stack[sp + 5];
    const mx = (ax + bx) >> 1, my = (ay + by) >> 1;
    if (Math.abs(ax - cx) + Math.abs(ay - cy) > 1 && err[my * n + mx] > maxError) { push6(cx, cy, ax, ay, mx, my); push6(bx, by, cx, cy, mx, my); continue; }
    const ga = ay * n + ax, gb = by * n + bx, gc = cy * n + cx;
    if (col[ga] === BG && col[gb] === BG && col[gc] === BG) continue;
    for (const g of [ga, gb, gc]) { let v = vid[g]; if (v < 0) { v = vid[g] = nv; vlist[nv++] = g; } tris[nt++] = v; }
  }
  const pos = new Float32Array(nv * 3), grad = new Float32Array(nv * 2), cl = new Float32Array(nv * 3);
  const s = Math.max(1, gradStep); let maxH = 0;
  const lin = palette.map(c => c.map(srgbToLinear)), bgl = bgColour.map(srgbToLinear);
  // paint source per vertex (D-204): a background vertex at the foot of an outline takes the paint (colour, coverage, gilding)
  // of its highest carved neighbour, so the step's face is painted to its foot and the stone begins where the step meets the
  // wall face (the background plane lies r_relief_carving.embed behind it). It took the stone's colour and no paint, so every
  // step triangle faded from the pigment to bare stone across a whole cell, and the material's losses (thresholded on the
  // coverage) broke that fade into a fuzzy, speckled fringe round every figure
  const src = new Int32Array(nv);
  for (let v = 0; v < nv; v++) {
    const g = vlist[v]; src[v] = g; if (col[g] !== BG) continue;
    // the nearest carved point within FOOT_REACH cells, the highest among equals (a coarse LOD's step triangles reach a few
    // cells out from the outline)
    const i = g % n, j = (g - i) / n; let best = -1, bd = Infinity, bh = 0;
    for (let dj = -FOOT_REACH; dj <= FOOT_REACH; dj++) for (let di = -FOOT_REACH; di <= FOOT_REACH; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii > max || jj > max) continue; const q = jj * n + ii; if (col[q] === BG || h[q] <= 0) continue;
      const dd = di * di + dj * dj; if (dd < bd || (dd === bd && h[q] > bh)) { bd = dd; bh = h[q]; best = q; } }
    if (best >= 0) src[v] = best;
  }
  for (let v = 0; v < nv; v++) {
    const g = vlist[v], i = g % n, j = (g - i) / n, gc = src[v];
    pos[v * 3] = x0 + i * cell; pos[v * 3 + 1] = y0 + j * cell; pos[v * 3 + 2] = h[g]; if (h[g] > maxH) maxH = h[g];
    const il = Math.max(0, i - s), ir = Math.min(max, i + s), jd = Math.max(0, j - s), ju = Math.min(max, j + s);
    // Sobel (central differences smoothed 1-2-1 across them; D-204): the normals of the two vertex rows of a one-cell step
    // then agree along the outline, where plain central differences alternated with the RTIN diagonals (a sawtooth of light
    // and shade along every outline on the side away from the sun)
    grad[v * 2] = (h[jd * n + ir] + 2 * h[j * n + ir] + h[ju * n + ir] - h[jd * n + il] - 2 * h[j * n + il] - h[ju * n + il]) / (4 * (ir - il) * cell);
    grad[v * 2 + 1] = (h[ju * n + il] + 2 * h[ju * n + i] + h[ju * n + ir] - h[jd * n + il] - 2 * h[jd * n + i] - h[jd * n + ir]) / (4 * (ju - jd) * cell);
    // colour: the vertex's own paint, or its source's (the foot of an outline); the stone where no mass is near
    const c = col[gc] === BG ? bgl : lin[col[gc]]; cl[v * 3] = c[0]; cl[v * 3 + 1] = c[1]; cl[v * 3 + 2] = c[2];
  }
  const index = tris.slice(0, nt);
  // gilding (D-151): 1 on vertices of a gilded mass (their colour is the gilt key), 0 elsewhere
  const gilt = new Float32Array(nv), gk = palette.findIndex(c => c[0] === GILT_SRGB[0] && c[1] === GILT_SRGB[1] && c[2] === GILT_SRGB[2]);
  if (gk > 0) for (let v = 0; v < nv; v++) if (col[src[v]] === gk) gilt[v] = 1;
  for (let t = 0; t < nt; t += 3) { // counter-clockwise seen from +z (out of the wall)
    const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    if ((pos[b] - pos[a]) * (pos[c + 1] - pos[a + 1]) - (pos[b + 1] - pos[a + 1]) * (pos[c] - pos[a]) < 0) { const q = index[t + 1]; index[t + 1] = index[t + 2]; index[t + 2] = q; }
  }
  return { pos, grad, col: cl, paint: paintCoverage(f, src, nv), gilt, ao: carvingOcclusion(f, vlist, nv), index, tris: nt / 3, verts: nv, maxH };
}
