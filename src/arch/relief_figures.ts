// Carved low-relief figure library (D-019): every figure kind used on the Persepolis stair façades and door jambs, built
// from the relief-field masses (relief_field.ts) in the figure's own frame (x = walking direction, y = up, 1 unit = the
// full figure height incl. headgear, feet at y = 0). Motifs come only from research/RELIEFS_AND_COLOUR.md,
// research/MATERIAL_CULTURE.md and the SITE_SPEC relief rows; each kind carries its evidence tier and the reason.
// The drawing itself (proportions, poses, fold and curl patterns) is reconstruction (C): procedural low relief, pending
// licensed scans or photogrammetry of the reliefs (NEEDS #10).
import { Rng } from '../core/rng';
import { SDF, Mass, Incision, FigureDef, C3, Box, ellipse, circle, poly, spoly, strokeR, capsules, catmull, seg, diff, STONE_SRGB, GILT_SRGB } from './relief_field';
import PC from '../data/polychromy.json';
import { labToSrgb } from '../core/colour';

// attested pigments (RELIEFS_AND_COLOUR §3a, B) with their colour as a matte film (CIELAB rows of src/data/polychromy.json, C),
// held here as sRGB so the palette keys stay readable (extractLod converts back to linear light). 'stone' = the unpainted
// carved limestone (src/render/materials.ts SURFACES.limestone_carved): unpainted where no paint evidence exists (faces,
// animals, background); the relief material shows the stone wherever a vertex carries no paint (relief_field PAINT).
const PG = (PC as any).pigment, lab = (k: string): C3 => labToSrgb(PG[k].v[0], PG[k].v[1], PG[k].v[2]);
export const PIGMENT: Record<string, C3> = {
  stone: STONE_SRGB, egyptianBlue: lab('egyptian_blue'), darkBlue: lab('dark_blue'), cinnabar: lab('cinnabar'), redOchre: lab('red_ochre'),
  malachite: lab('malachite'), yellowOchre: lab('yellow_ochre'), white: lab('white'), black: lab('black'), purple: lab('purple'),
  // gilding (D-151): gold leaf, shaded as metal by the relief material (relief_field.GILT_SRGB is the key); crowns, jewellery,
  // sceptres, scabbard fittings, vessels and the winged ring (zones C)
  gold: GILT_SRGB,
};
const P = PIGMENT, STONE = P.stone, HAIR = P.darkBlue;
/** garment colours (D-151). The Persian court robe: 'red and purple for the robe' (RELIEFS_AND_COLOUR §3b, B/C: the search
 *  extract with hair and beard dark blue), so its field is one of the reds or the purple, girt with a blue belt (C; the
 *  patterned field and the blue hem strips are the king's, royalRobe). The riding dress, the delegates' dress and the
 *  accessories: any of the attested pigments (per-figure choice C). D-030 drew every robe from all six, which read as a toy. */
const ROBES: C3[] = [P.cinnabar, P.redOchre, P.purple, P.redOchre];
const GARMENTS: C3[] = [P.cinnabar, P.egyptianBlue, P.malachite, P.yellowOchre, P.purple, P.redOchre];

// ---------------- frames: place a sub-figure (translate, rotate, scale, mirror) ----------------
export class Frame {
  constructor(public ox = 0, public oy = 0, public rot = 0, public s = 1, public flip = false) {}
  p(x: number, y: number): [number, number] { const X = this.flip ? -x : x, c = Math.cos(this.rot), sn = Math.sin(this.rot); return [this.ox + this.s * (X * c - y * sn), this.oy + this.s * (X * sn + y * c)]; }
  inv(x: number, y: number): [number, number] { const dx = (x - this.ox) / this.s, dy = (y - this.oy) / this.s, c = Math.cos(-this.rot), sn = Math.sin(-this.rot); const X = dx * c - dy * sn, Y = dx * sn + dy * c; return [this.flip ? -X : X, Y]; }
  r(v: number) { return v * this.s; }
  ell(cx: number, cy: number, rx: number, ry: number, rot = 0): SDF { const [x, y] = this.p(cx, cy); return ellipse(x, y, this.r(rx), this.r(ry), (this.flip ? -rot : rot) + this.rot); }
  circ(cx: number, cy: number, r: number): SDF { const [x, y] = this.p(cx, cy); return circle(x, y, this.r(r)); }
  seg(ax: number, ay: number, bx: number, by: number, ra: number, rb = ra): SDF { const [a, b] = this.p(ax, ay), [c, d] = this.p(bx, by); return seg(a, b, c, d, this.r(ra), this.r(rb)); }
  poly(pts: number[][]): SDF { return poly(pts.map(([x, y]) => this.p(x, y))); }
  spoly(pts: number[][], sub = 4): SDF { return spoly(pts.map(([x, y]) => this.p(x, y)), sub); }
  stroke(pts: number[][], r0: number, r1 = r0, sub = 4): SDF[] { return strokeR(pts.map(([x, y]) => this.p(x, y)), [this.r(r0), this.r(r1)], sub); }
  strokeR(pts: number[][], radii: number[], sub = 4): SDF[] { return strokeR(pts.map(([x, y]) => this.p(x, y)), radii.map(r => this.r(r)), sub); }
  caps(pts: number[][], r0: number, r1 = r0, sub = 4): SDF[] { return capsules(pts.map(([x, y]) => this.p(x, y)), this.r(r0), this.r(r1), sub); }
  /** a detail function written in local coords (x, y, t in local units) → field coords */
  det(fn: (x: number, y: number, t: number) => number) { return (x: number, y: number, t: number) => { const [u, v] = this.inv(x, y); return fn(u, v, t / this.s); }; }
  col(fn: (x: number, y: number) => C3) { return (x: number, y: number) => { const [u, v] = this.inv(x, y); return fn(u, v); }; }
}

// ---------------- surface details (depth units; local coordinates) ----------------
const fract = (v: number) => v - Math.floor(v);
/** stacked pleats: a sawtooth across u (each pleat a sloping facet ending in a crisp step) */
const pleats = (u: number, period: number, depth: number) => depth * (fract(u / period) - 0.5);
/** rows of snail curls (the beard and hair convention of the reliefs): hemispherical bosses with a spiral groove */
function curls(x: number, y: number, size: number, depth: number, x0 = 0, y0 = 0) {
  const r = (y - y0) / (size * 0.9), row = Math.floor(r), c = (x - x0) / size + (row & 1 ? 0.5 : 0), col = Math.floor(c);
  const u = c - col - 0.5, v = (r - row - 0.5) * 0.9, d = Math.sqrt(u * u + v * v) * 2.1;
  if (d >= 1) return -depth * 0.55;
  const spiral = d > 0.25 ? 0.22 * Math.cos(Math.atan2(v, u) + d * 9) : 0;
  return depth * (Math.sqrt(1 - d * d) - 0.55 + spiral * (1 - d));
}
/** vertical flutes (fluted headgear) */
const flutes = (x: number, period: number, depth: number) => -depth * Math.pow(Math.abs(Math.cos((Math.PI * x) / period)), 0.6);
/** wavy strands (tails, whisks, palm fronds) */
const strands = (u: number, v: number, period: number, depth: number) => -depth * Math.pow(Math.abs(Math.sin((Math.PI * (u + 0.25 * Math.sin(v * 40))) / period)), 0.7);
/** flame-shaped locks (lion mane): rows of pointed tufts */
function tufts(u: number, v: number, w: number, h: number, depth: number) {
  const row = Math.floor(v / h), cu = fract(u / w + (row & 1 ? 0.5 : 0)) - 0.5, cv = fract(v / h);
  return Math.abs(cu) * 2 - (1 - cv) * 0.9 > 0 ? -depth * 0.6 : depth * (0.4 - 0.5 * cv);
}
/** rows of feathers (wings): scalloped rows */
function feathers(u: number, v: number, w: number, h: number, depth: number) {
  const row = Math.floor(v / h), cu = fract(u / w + (row & 1 ? 0.5 : 0)), cv = fract(v / h);
  return depth * (0.5 * cv - 0.35 - 0.3 * Math.pow(Math.abs(cu - 0.5) * 2, 6));
}

// ---------------- mass helpers ----------------
type Col = C3 | ((x: number, y: number) => C3);
// D-226 (rubric s7 pass 2, fix item 1: "clay cut-outs, not carving"): a mass is cut back from the ground in a near-vertical
// step that holds most of its height (edge 0.65, was 0.45) and its arris is rounded over ~1 % of the figure's height (round
// 0.012, was 0.018: 9 mm on a register figure, now 5 mm less); the Persepolis carving is planar, not pillowed (C, after
// photographs of the Apadana reliefs, NOT SEEN this session)
const M = (add: SDF[], o: Partial<Mass> & { colour: Col; amp: number }): Mass => ({ add, round: 0.012, edge: 0.65, ...o });
const inc = (s: SDF, depth = 0.1, width = 0.0022): Incision => ({ s, depth, width });
export interface Built { masses: Mass[]; incisions: Incision[] }

// ---------------- the human head (profile facing +x; the neck meets the body at about (0.005, 0.74)) ----------------
export type Head = 'fluted' | 'cap' | 'band' | 'pointed' | 'hood' | 'bare' | 'crown' | 'fillet' | 'tallcap';
export type Beard = 'long' | 'short' | 'none';
export function humanHead(fr: Frame, head: Head, beard: Beard, hc: C3): Built {
  const ms: Mass[] = [], I: Incision[] = [];
  // cranium + face profile (forehead, straight nose, lips, chin)
  const face = fr.spoly([[-0.03, 0.855], [0.02, 0.856], [0.044, 0.838], [0.053, 0.816], [0.058, 0.805], [0.076, 0.774], [0.072, 0.768], [0.06, 0.766], [0.062, 0.759], [0.057, 0.753], [0.06, 0.744], [0.046, 0.728], [0.01, 0.728], [-0.02, 0.76]], 4);
  // the face rises toward the profile (brow, nose, lips carry the relief's highest line; the cheek recedes to the ear) with
  // a shallow socket under the brow and a crisp cheek plane (D-151; was a dome, highest mid-cheek)
  const facePlanes = fr.det((x, y) => 0.16 * Math.min(1, Math.max(0, (x + 0.012) / 0.07)) - 0.1 * Math.max(0, 1 - Math.hypot((x - 0.03) / 0.024, (y - 0.806) / 0.013)) - 0.05 * Math.max(0, 1 - Math.hypot((x - 0.02) / 0.03, (y - 0.772) / 0.022)));
  ms.push(M([face, fr.ell(-0.006, 0.8, 0.055, 0.058)], { amp: 0.68, lift: 0.1, round: 0.022, edge: 0.5, dome: 0.25, domeW: 0.04, groove: 0.08, colour: STONE, smooth: 0.01, detail: facePlanes }));
  I.push(inc(fr.ell(0.035, 0.806, 0.0125, 0.0045), 0.12, 0.0018)); // almond eye (the frontal eye of the profile convention)
  ms.push(M([fr.ell(0.034, 0.806, 0.0105, 0.0032)], { amp: 0.7, lift: 0.05, colour: STONE, round: 0.004 }));
  I.push(...fr.caps([[0.022, 0.8105], [0.034, 0.8125], [0.047, 0.8075]], 0.0006, 0.0006, 2).map(s => inc(s, 0.12, 0.0024))); // the heavy upper lid
  I.push(...fr.caps([[0.016, 0.818], [0.034, 0.823], [0.051, 0.818]], 0.0004, 0.0004, 2).map(s => inc(s, 0.1, 0.002))); // brow
  I.push(inc(fr.seg(0.049, 0.759, 0.061, 0.7595, 0.0004), 0.1, 0.0016), inc(fr.ell(0.064, 0.774, 0.005, 0.003), 0.06, 0.0014)); // lips, nostril
  // hair bunched at the nape and the beard: dark blue (B), carved in rows of snail curls
  const hairCurl = fr.det((x, y) => curls(x, y, 0.0122, 0.17));
  if (head !== 'hood') ms.push(M([fr.spoly([[-0.028, 0.82], [-0.058, 0.818], [-0.082, 0.79], [-0.084, 0.757], [-0.066, 0.738], [-0.038, 0.744], [-0.024, 0.776]], 4)], { amp: 0.72, lift: 0.12, colour: HAIR, round: 0.016, detail: hairCurl, groove: 0.08 }));
  if (head === 'bare' || head === 'fillet' || head === 'band')
    ms.push(M([fr.spoly([[-0.058, 0.8], [-0.056, 0.842], [-0.028, 0.864], [0.016, 0.866], [0.042, 0.846], [0.03, 0.836], [-0.02, 0.836], [-0.038, 0.8]], 4)], { amp: 0.72, lift: 0.08, colour: HAIR, round: 0.012, detail: hairCurl }));
  if (beard !== 'none') {
    const bot = beard === 'long' ? 0.655 : 0.715;
    const b = fr.spoly([[0.004, 0.792], [0.022, 0.778], [0.043, 0.768], [0.054, 0.755], [0.068, 0.748], [0.074, 0.72], [0.072, bot + 0.012], [0.062, bot], [0.024, bot], [0.008, bot + 0.012], [-0.004, 0.74], [-0.004, 0.772]], 4);
    ms.push(M([b], { amp: 0.8, lift: 0.14, colour: HAIR, round: 0.014, edge: 0.55, groove: 0.1, detail: fr.det((x, y) => (y > 0.746 ? curls(x, y, 0.0105, 0.15, 0.004, 0.002) : curls(x, y, 0.0122, 0.19, 0.0, 0.004))) }));
    ms.push(M([fr.ell(0.054, 0.759, 0.012, 0.005, -0.2)], { amp: 0.84, lift: 0.1, colour: HAIR, round: 0.005, detail: fr.det((x, y) => curls(x, y, 0.008, 0.12)) })); // moustache
  }
  ms.push(M([fr.ell(-0.008, 0.796, 0.011, 0.018)], { amp: 0.76, lift: 0.1, colour: STONE, round: 0.008, groove: 0.08 })); // ear
  I.push(inc(fr.ell(-0.006, 0.796, 0.005, 0.01), 0.12, 0.0016));
  if (head === 'fluted') { // tall fluted hat (Persian dress, B): vertical flutes over a plain band
    ms.push(M([fr.spoly([[-0.058, 0.816], [-0.04, 0.842], [0.05, 0.842], [0.058, 0.836], [0.067, 0.99], [0.03, 0.998], [-0.02, 0.997], [-0.067, 0.99]], 2)],
      { amp: 0.66, lift: 0.08, colour: hc, round: 0.016, dome: 0.3, domeW: 0.05, groove: 0.08, detail: fr.det((x, y) => (y > 0.864 ? flutes(x + 0.002, 0.0135, 0.2) : 0.04)) }));
    I.push(inc(fr.seg(-0.061, 0.864, 0.061, 0.864, 0.0005), 0.1, 0.0022));
  } else if (head === 'cap' || head === 'hood') { // soft rounded felt cap with a flap at the nape (Median dress; NS, C); the hood also covers the chin
    ms.push(M([fr.spoly([[0.047, 0.828], [0.056, 0.866], [0.036, 0.91], [-0.004, 0.926], [-0.05, 0.906], [-0.075, 0.86], [-0.082, 0.79], [-0.072, 0.742], [-0.05, 0.75], [-0.046, 0.81], [-0.02, 0.828]], 4)],
      { amp: 0.7, lift: 0.1, colour: hc, round: 0.02, dome: 0.4, domeW: 0.05, groove: 0.08, detail: fr.det((x, y) => pleats(Math.atan2(y - 0.8, x + 0.01), 0.35, 0.05)) }));
    if (head === 'hood') ms.push(M([fr.spoly([[0.005, 0.79], [0.03, 0.771], [0.068, 0.749], [0.072, 0.713], [0.02, 0.704], [-0.012, 0.75]], 3)], { amp: 0.82, lift: 0.12, colour: hc, round: 0.012, groove: 0.08 }));
    else ms.push(M(fr.stroke([[-0.064, 0.758], [-0.072, 0.72], [-0.068, 0.69]], 0.008, 0.006), { amp: 0.7, lift: 0.08, colour: hc, round: 0.006 }));
  } else if (head === 'pointed' || head === 'tallcap') { // tall cap with ear flaps; pointed for the Saka tigraxauda (named in the list, B; form C)
    const tip = head === 'pointed' ? [[-0.03, 0.965], [-0.07, 0.99]] : [[0.0, 0.95], [-0.03, 0.955]];
    ms.push(M([fr.spoly([[0.048, 0.826], [0.05, 0.87], tip[0], tip[1], [-0.066, 0.88], [-0.08, 0.8], [-0.062, 0.74], [-0.03, 0.745], [-0.02, 0.8], [0.0, 0.83]], 4)], { amp: 0.7, lift: 0.1, colour: hc, round: 0.018, dome: 0.3, domeW: 0.05, groove: 0.08 }));
  } else if (head === 'band' || head === 'fillet') { // headband / fillet, with a ribbon hanging behind (band)
    ms.push(M([fr.poly([[-0.062, 0.826], [0.044, 0.842], [0.046, 0.854], [-0.06, 0.842]])], { amp: 0.8, lift: 0.1, colour: hc, round: 0.006 }));
    if (head === 'band') ms.push(M(fr.stroke([[-0.058, 0.834], [-0.08, 0.79], [-0.086, 0.74]], 0.006, 0.004), { amp: 0.74, lift: 0.06, colour: hc, round: 0.005 }));
  } else if (head === 'crown') { // royal headdress: tall cylinder with a crenellated rim (form C: not in the research)
    ms.push(M([fr.poly([[-0.056, 0.82], [0.052, 0.84], [0.06, 0.975], [0.045, 0.975], [0.045, 0.99], [0.025, 0.99], [0.025, 0.975], [0.005, 0.975], [0.005, 0.99], [-0.015, 0.99], [-0.015, 0.975], [-0.035, 0.975], [-0.035, 0.99], [-0.055, 0.99], [-0.055, 0.975], [-0.064, 0.975]])],
      { amp: 0.68, lift: 0.08, colour: P.gold, round: 0.012, dome: 0.3, domeW: 0.04, groove: 0.08 }));
    I.push(inc(fr.seg(-0.06, 0.87, 0.056, 0.875, 0.0005), 0.1, 0.0024), inc(fr.seg(-0.062, 0.945, 0.058, 0.948, 0.0005), 0.1, 0.0024));
  }
  return { masses: ms, incisions: I };
}

// ---------------- the royal robe's painted pattern (D-151) ----------------
// Iranica 'Clothing ii' citing Tilia (search extract, RELIEFS_AND_COLOUR §3b, B): the royal robe is red or purple, patterned
// with concentric circles and lotus blossoms, with blue hem and sleeve strips 'embroidered' with red marching lions; Nagel
// citing Tilia 1978: 46 (B): walking-lion bands on royal robes, laid out by incised painters' guidelines. Paint only (no
// carving). The motifs' size, spacing and colours and the drawing of the lions are C.
const ROYAL = { pitch: 0.042, ring: [0.0072, 0.0108], dot: 0.0036, strip: 0.036, lion: 1.7 };
/** the robe's field: a staggered lattice alternating concentric circles (a ring round a dot) and lotus blossoms (three petals
 *  fanning up from a calyx); figure units */
function robeField(u: number, v: number, field: C3): C3 {
  const p = ROYAL.pitch, r = v / (p * 0.866), row = Math.floor(r), c = u / p + (row & 1 ? 0.5 : 0), col = Math.floor(c);
  const du = (c - col - 0.5) * p, dv = (r - row - 0.5) * p * 0.866;
  if ((row + col) & 1) { const d = Math.hypot(du, dv); return d < ROYAL.dot || (d > ROYAL.ring[0] && d < ROYAL.ring[1]) ? P.yellowOchre : field; }
  const petal = (cx: number, cy: number, a: number) => { const x = du - cx, y = dv - cy, ca = Math.cos(a), sa = Math.sin(a), X = x * ca + y * sa, Y = -x * sa + y * ca; return (X / 0.0026) ** 2 + (Y / 0.0072) ** 2 < 1; };
  if (petal(0, 0.004, 0) || petal(-0.0045, 0.0022, 0.62) || petal(0.0045, 0.0022, -0.62) || (Math.hypot(du, dv + 0.0035) < 0.0036 && dv < -0.0035)) return P.white;
  return field;
}
/** a lion walking toward +s in a strip: (s, t) in strip heights, t = 0 at the hem; body, maned head, legs, a raised tail */
function lionAt(s: number, t: number) {
  const q = s - Math.floor(s / ROYAL.lion) * ROYAL.lion; // one lion per `lion` strip heights
  if (((q - 0.78) / 0.4) ** 2 + ((t - 0.52) / 0.16) ** 2 < 1) return true; // body
  if (((q - 1.22) / 0.16) ** 2 + ((t - 0.64) / 0.2) ** 2 < 1) return true; // head and mane
  if (t > 0.16 && t < 0.46 && ((q > 0.42 && q < 0.5) || (q > 0.56 && q < 0.64) || (q > 0.96 && q < 1.04) || (q > 1.1 && q < 1.18))) return true; // legs
  return q > 0.2 && q < 0.4 && Math.abs(t - (0.52 + (0.4 - q) * 1.4)) < 0.05; // tail
}
/** the royal robe's paint in frame `fr`: the patterned field, and the blue strip with red lions along the polyline `hem`
 *  (local coordinates; the lions stand on the hem and walk the way the polyline runs) */
function royalRobe(fr: Frame, field: C3, hem: number[][]): (x: number, y: number) => C3 {
  const L: number[] = [0]; for (let i = 1; i < hem.length; i++) L.push(L[i - 1] + Math.hypot(hem[i][0] - hem[i - 1][0], hem[i][1] - hem[i - 1][1]));
  return fr.col((u, v) => {
    let best = Infinity, s = 0;
    for (let i = 0; i + 1 < hem.length; i++) {
      const [ax, ay] = hem[i], [bx, by] = hem[i + 1], ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
      const t = Math.min(1, Math.max(0, ((u - ax) * ex + (v - ay) * ey) / l2)), d = Math.hypot(u - ax - ex * t, v - ay - ey * t);
      if (d < best) { best = d; s = L[i] + t * Math.sqrt(l2); }
    }
    if (best < ROYAL.strip) return lionAt(s / ROYAL.strip, best / ROYAL.strip) ? P.cinnabar : P.egyptianBlue;
    return robeField(u, v, field);
  });
}

// ---------------- the guards' robe pattern (D-214, gap audit item 29) ----------------
// The Persian guards' court robe patterned after the glazed-brick guards of Susa (SUSA-GLAZE, recollection: robes strewn with
// small rosettes or squares in a lattice, with plain borders: C): paint only, a staggered lattice of small ringed dots in the
// row's colour on the robe's own colour, and a plain border along the hem (src/data/polychromy.json paint.robe_pattern, all C).
const RP = (PC as any).paint.robe_pattern.v, RP_PIG: Record<string, string> = { white: 'white', yellow_ochre: 'yellowOchre', egyptian_blue: 'egyptianBlue', cinnabar: 'cinnabar', red_ochre: 'redOchre' };
/** the kinds whose long Persian robe carries the pattern */
export const PATTERNED_KINDS: string[] = RP.kinds;
function dotField(u: number, v: number, field: C3): C3 {
  const p = RP.pitch, r = v / (p * 0.866), row = Math.floor(r), c = u / p + (row & 1 ? 0.5 : 0), col = Math.floor(c);
  const d = Math.hypot((c - col - 0.5) * p, (r - row - 0.5) * p * 0.866);
  return d < RP.dot || (d > RP.ring[0] && d < RP.ring[1]) ? P[RP_PIG[RP.colour]] : field;
}
/** the patterned robe's paint in frame `fr`: the lattice, and the plain border within hem_w of the polyline `hem` */
function patternedRobe(fr: Frame, field: C3, hem: number[][] | null): (x: number, y: number) => C3 {
  return fr.col((u, v) => {
    if (hem) { let best = Infinity; for (let i = 0; i + 1 < hem.length; i++) { const [ax, ay] = hem[i], [bx, by] = hem[i + 1], ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
      const t = Math.min(1, Math.max(0, ((u - ax) * ex + (v - ay) * ey) / l2)); best = Math.min(best, Math.hypot(u - ax - ex * t, v - ay - ey * t)); }
      if (best < RP.hem_w) return P[RP_PIG[RP.hem]]; }
    return dotField(u, v, field);
  });
}

// ---------------- the human figure ----------------
export type Dress = 'persian' | 'median' | 'long' | 'short' | 'wrap' | 'royal';
/** elbow and hand in local figure coords */
export interface Arm { elbow: [number, number]; hand: [number, number] }
export interface Human {
  dress: Dress; head: Head; beard: Beard; garment: C3; garment2: C3; headCol?: C3;
  near: Arm; far: Arm | null; stride?: number; kandys?: boolean; akinakes?: boolean; gorytos?: boolean; quiver?: boolean; bow?: boolean; seated?: boolean;
  /** the royal robe: its field patterned, blue strips with red marching lions at the hem and the sleeves (royalRobe, B) */
  royal?: boolean;
  /** D-214: the guards' robe, patterned after the Susa glazed-brick guards (patternedRobe, C) */
  pattern?: boolean;
}
type Layer = 'back' | 'farArm' | 'body' | 'top' | 'front';

/** Human figure in profile facing +x (the near side is the figure's right), masses in drawing order back → front. */
export function human(fr: Frame, h: Human, extra: Partial<Record<Layer, Mass[]>> = {}): Built {
  const L: Record<Layer, Mass[]> = { back: [], farArm: [], body: [], top: [], front: [] }, I: Incision[] = [];
  const g = h.garment, g2 = h.garment2, st = h.stride ?? 1, seated = !!h.seated, beltY = 0.49;
  let robe: Col = g; // the robe's paint: its colour, or the royal robe's pattern with the lion strip along its hem (below)
  // D-151 domed the body toward its outline (0.5 of its height over 0.1 of the figure's) so the robe read as a body under
  // cloth; with a quarter-round of 0.03 and a step of half the rest, the robe met the ground at a quarter of its height: a
  // pillow ("clay cut-outs", rubric s7 pass 2). D-226: the robe is a low plane cut back in a near-vertical step of 0.75 of
  // its height, its arris rounded over 0.012 (9 mm), a slight doming (0.15 over 0.06) left for the body under the cloth
  const BODY = { amp: 0.6, round: 0.012, edge: 0.75, dome: 0.15, domeW: 0.06, groove: 0.12, grooveW: 0.007 };
  const body: SDF[] = [fr.spoly([[-0.064, 0.712], [-0.072, 0.64], [-0.066, 0.53], [-0.062, 0.49], [0.068, 0.49], [0.079, 0.58], [0.077, 0.655], [0.052, 0.708], [0.0, 0.724]]), fr.seg(0.0, 0.7, 0.012, 0.765, 0.031, 0.027)];
  let fold: ((x: number, y: number, t: number) => number) | undefined;
  if (seated) { // thighs horizontal, shins down to the footstool (the throne is drawn by the caller)
    if (h.royal) robe = royalRobe(fr, g, [[0.13, 0.058], [0.2, 0.048], [0.222, 0.058]]);
    body.push(fr.spoly([[-0.066, 0.5], [-0.066, 0.4], [0.02, 0.37], [0.19, 0.37], [0.215, 0.35], [0.222, 0.06], [0.2, 0.05], [0.13, 0.06], [0.14, 0.3], [0.06, 0.44], [0.068, 0.5]], 3));
    L.front.push(M([fr.poly([[0.13, 0.045], [0.26, 0.045], [0.265, 0.058], [0.24, 0.07], [0.15, 0.075]])], { amp: 0.6, lift: 0.05, colour: STONE, round: 0.01 }));
    fold = fr.det((x, y) => (y < 0.37 && x > 0.12 ? pleats(x - y * 0.1, 0.012, 0.1) : y < beltY ? pleats(y + x * 0.2, 0.03, 0.05) : 0));
  } else if (h.dress === 'persian' || h.dress === 'royal' || h.dress === 'long') {
    // ankle-length robe girt at the waist, falling in tiers of pleats (IR-CAND, B): curved folds fanning from the front of the
    // waist to the back hem, and the front cascade of vertical pleats with a stepped hem
    const hemF = 0.03, hemB = h.dress === 'long' ? 0.035 : 0.05;
    if (h.royal) robe = royalRobe(fr, g, [[-0.128 * st, hemB], [0.0, 0.04], [0.128 * st, hemF]]);
    else if (h.pattern) robe = patternedRobe(fr, g, [[-0.128 * st, hemB], [0.0, 0.04], [0.128 * st, hemF]]);
    body.push(fr.spoly([[-0.062, 0.5], [-0.076, 0.36], [-0.098, 0.2], [-0.12 * st, hemB + 0.01], [-0.128 * st, hemB], [0.0, 0.04], [0.128 * st, hemF], [0.116 * st, 0.12], [0.088, 0.3], [0.07, 0.5]], 3));
    L.back.push(M([fr.poly([[-0.112 * st, 0.0], [-0.005, 0.0], [0.004, 0.012], [-0.015, 0.03], [-0.095 * st, 0.038]])], { amp: 0.4, colour: STONE, round: 0.012 }));
    L.front.push(M([fr.poly([[0.03, 0.0], [0.145 * st + 0.01, 0.0], [0.152 * st + 0.012, 0.012], [0.13 * st + 0.01, 0.027], [0.06, 0.034], [0.03, 0.036]])], { amp: 0.58, lift: 0.05, colour: STONE, round: 0.012 }));
    I.push(inc(fr.seg(0.075, 0.006, 0.09, 0.03, 0.0005), 0.08), inc(fr.seg(0.1, 0.004, 0.11, 0.024, 0.0005), 0.08)); // shoe straps (NS, C)
    // the folds fan from the front of the waist down to the back hem, each a sloping plane ending in a crisp step (D-151: 0.14 of
    // the relief depth, was 0.07); above the belt the upper robe hangs in shallow swags from the shoulder
    fold = fr.det((x, y) => (y < beltY ? pleats(Math.atan2(y - 0.62, x - 0.2) + 0.9 * Math.sqrt((x - 0.2) ** 2 + (y - 0.62) ** 2), 0.065, 0.14) : pleats(Math.hypot(x - 0.02, y - 0.72), 0.03, 0.06)));
    const casc = fr.poly([[0.02, beltY], [0.068, beltY], [0.086, 0.3], [0.116 * st, 0.12], [0.128 * st, hemF + 0.001], [0.098 * st, 0.02], [0.082 * st, 0.042], [0.064 * st, 0.024], [0.046 * st, 0.045], [0.032, 0.2]]);
    L.front.push(M([casc], { amp: 0.62, lift: 0.07, colour: robe, round: 0.012, edge: 0.55, groove: 0.08, detail: fr.det((x, y) => pleats(x - 0.07 * (0.5 - y), 0.0105, 0.2)) }));
  } else {
    // riding dress: knee-length tunic over trousers (median), or a short tunic / wrap with bare legs
    const hemY = h.dress === 'wrap' ? 0.3 : 0.28, trousers = h.dress === 'median', legCol = trousers ? g2 : STONE;
    body.push(fr.spoly([[-0.062, 0.5], [-0.078, 0.4], [-0.094, hemY + 0.005], [-0.086, hemY - 0.01], [0.0, hemY - 0.012], [0.092, hemY - 0.004], [0.096, hemY + 0.02], [0.08, 0.4], [0.07, 0.5]], 3));
    const tf = fr.det((x, y) => pleats(y + 0.25 * x, 0.02, trousers ? 0.13 : 0));
    L.back.push(M(fr.strokeR([[-0.02, 0.4], [-0.044 * st, 0.24], [-0.07 * st, 0.05]], [0.045, 0.036, trousers ? 0.031 : 0.023]), { amp: 0.42, colour: legCol, round: 0.02, detail: tf }));
    L.body.push(M(fr.strokeR([[0.03, 0.4], [0.07 * st, 0.24], [0.104 * st, 0.05]], [0.048, 0.038, trousers ? 0.032 : 0.024]), { amp: 0.6, lift: 0.08, colour: legCol, round: 0.022, detail: tf, groove: 0.06 }));
    const boot = (x: number) => fr.poly([[x - 0.035, 0.0], [x + 0.062, 0.0], [x + 0.068, 0.012], [x + 0.047, 0.028], [x + 0.012, 0.035], [x + 0.008, trousers ? 0.075 : 0.045], [x - 0.03, trousers ? 0.075 : 0.045]]);
    L.back.push(M([boot(-0.074 * st)], { amp: 0.44, lift: 0.02, colour: STONE, round: 0.01 }));
    L.front.push(M([boot(0.104 * st)], { amp: 0.62, lift: 0.06, colour: STONE, round: 0.01, groove: 0.05 }));
    if (trousers) for (let k = 0; k < 3; k++) I.push(inc(fr.seg(0.078 * st, 0.055 - k * 0.013, 0.112 * st, 0.06 - k * 0.013, 0.0004), 0.07, 0.002)); // laces (NS, C)
    L.front.push(M([fr.poly([[-0.096, hemY - 0.012], [0.098, hemY - 0.005], [0.098, hemY + 0.014], [-0.096, hemY + 0.008]])], { amp: 0.001, colour: g2, paintOnly: true })); // hem border
    fold = fr.det((x, y) => (y < beltY && y > hemY ? pleats(x * 0.6 + y * 0.8, 0.028, 0.1) : y >= beltY ? pleats(Math.hypot(x - 0.01, y - 0.7), 0.028, 0.05) : 0));
  }
  L.body.unshift(M(body, { ...BODY, colour: robe, smooth: 0.01, detail: fold }));
  L.body.push(M([fr.poly([[-0.07, beltY - 0.012], [0.074, beltY - 0.012], [0.074, beltY + 0.012], [-0.07, beltY + 0.012]])], { amp: 0.001, colour: g2, paintOnly: true })); // belt (colour C)
  I.push(inc(fr.seg(-0.07, beltY - 0.012, 0.074, beltY - 0.012, 0.0005), 0.08), inc(fr.seg(-0.07, beltY + 0.012, 0.074, beltY + 0.012, 0.0005), 0.08));
  if (h.kandys) { // coat slung over the shoulders, empty sleeves hanging behind (Median dress, B)
    L.back.push(M([fr.spoly([[-0.05, 0.72], [0.02, 0.73], [0.03, 0.69], [-0.02, 0.62], [-0.075, 0.4], [-0.105, 0.22], [-0.14, 0.2], [-0.126, 0.42], [-0.09, 0.62]], 3)], { amp: 0.48, colour: g2, round: 0.02, dome: 0.2, detail: fr.det((x, y) => pleats(x * 1.2 - y * 0.3, 0.02, 0.07)) }));
    L.back.push(M(fr.stroke([[-0.075, 0.66], [-0.115, 0.5], [-0.135, 0.36]], 0.018, 0.022), { amp: 0.44, lift: 0.04, colour: g2, round: 0.014 }));
  }
  if (h.quiver) { // quiver on the back (Persian guards, B)
    L.back.push(M([fr.spoly([[-0.054, 0.76], [-0.034, 0.74], [-0.08, 0.43], [-0.106, 0.44], [-0.09, 0.6]], 3)], { amp: 0.5, colour: P.yellowOchre, round: 0.012, detail: fr.det((x, y) => pleats(y, 0.06, 0.05)) }));
    L.back.push(M([fr.spoly([[-0.062, 0.8], [-0.034, 0.78], [-0.044, 0.745], [-0.07, 0.75]])], { amp: 0.52, lift: 0.04, colour: P.redOchre, round: 0.008 }));
  }
  if (h.bow) L.back.push(M(fr.stroke([[0.0, 0.83], [-0.09, 0.76], [-0.106, 0.62], [-0.08, 0.5]], 0.006, 0.008), { amp: 0.5, colour: P.redOchre, round: 0.006 })); // bow over the shoulder (B)
  // the strap of the quiver or the bow case: a leather band from the near shoulder down across the chest (D-151; C)
  if (h.quiver || h.gorytos) L.body.push(M(fr.stroke([[0.03, 0.705], [0.0, 0.62], [-0.045, 0.53]], 0.0055, 0.005), { amp: 0.68, lift: 0.06, colour: P.redOchre, round: 0.005, groove: 0.05, grooveW: 0.003 }));
  if (h.gorytos) L.back.push(M([fr.spoly([[-0.066, 0.52], [-0.126, 0.5], [-0.146, 0.34], [-0.106, 0.3], [-0.066, 0.34]], 3)], { amp: 0.46, colour: P.yellowOchre, round: 0.015, detail: fr.det((x, y) => pleats(x + y, 0.03, 0.05)) })); // bow case (NS, C)
  // arms: tight sleeve (riding dress) or the wide Persian sleeve hanging from the forearm in concentric folds (B)
  const sh: [number, number] = [0.004, 0.69];
  const arm = (a: Arm, near: boolean) => {
    const out: Mass[] = [], [ex, ey] = a.elbow, [hx, hy] = a.hand, amp = near ? 0.66 : 0.4, lift = near ? 0.12 : 0;
    out.push(M(fr.strokeR([sh, [ex, ey], [hx, hy]], [0.03, 0.025, 0.018], 3), { amp, lift, colour: h.dress === 'wrap' ? STONE : robe, round: 0.016, groove: near ? 0.08 : 0 }));
    if (h.dress === 'persian' || h.dress === 'royal') {
      const low = Math.min(ey, hy) - 0.13, mx = (ex + hx) / 2;
      const sleeve: Col = h.royal ? royalRobe(fr, g, [[ex - 0.044, ey - 0.05], [mx - 0.048, low], [mx - 0.01, low + 0.01], [hx - 0.035, hy - 0.06]]) // the strip along the sleeve's hanging edge
        : h.pattern ? patternedRobe(fr, g, null) : g;
      out.push(M([fr.spoly([[ex - 0.028, ey + 0.02], [hx - 0.01, hy - 0.004], [hx - 0.035, hy - 0.06], [mx - 0.01, low + 0.01], [mx - 0.048, low], [ex - 0.044, ey - 0.05]], 4)],
        { amp: amp * 0.95, lift: lift * 0.9, colour: sleeve, round: 0.018, groove: near ? 0.1 : 0, detail: fr.det((x, y) => pleats(Math.sqrt((x - hx + 0.01) ** 2 + (y - hy - 0.02) ** 2), 0.012, 0.16)) }));
    } else if (h.dress !== 'wrap') out.push(M([fr.seg(hx - (hx - ex) * 0.12, hy - (hy - ey) * 0.12, hx - (hx - ex) * 0.2, hy - (hy - ey) * 0.2, 0.021)], { amp: 0.001, colour: g2, paintOnly: true })); // cuff
    out.push(M([fr.ell(hx + 0.004, hy, 0.018, 0.015, Math.atan2(hy - ey, hx - ex))], { amp: amp + 0.06, lift: lift + 0.05, colour: STONE, round: 0.01 })); // hand
    return out;
  };
  if (h.far) L.farArm.push(...arm(h.far, false));
  const hd = humanHead(fr, h.head, h.beard, h.headCol ?? g2); L.top.push(...hd.masses); I.push(...hd.incisions);
  L.front.push(...arm(h.near, true));
  if (h.akinakes) { // short sword on the right (near) thigh, lobed scabbard mouth, chape (Median dress, B)
    L.front.push(M([fr.seg(0.005, 0.47, 0.055, 0.34, 0.012, 0.007), fr.ell(0.004, 0.472, 0.02, 0.009, -0.9), fr.circ(0.058, 0.335, 0.009)], { amp: 0.72, lift: 0.1, colour: P.gold, round: 0.008, groove: 0.08 }));
    L.front.push(M([fr.seg(-0.012, 0.5, 0.0, 0.48, 0.005), fr.circ(-0.014, 0.505, 0.008)], { amp: 0.74, lift: 0.1, colour: P.gold, round: 0.005 }));
  }
  for (const k of Object.keys(extra) as Layer[]) L[k].push(...(extra[k] ?? []));
  return { masses: [...L.back, ...L.farArm, ...L.body, ...L.top, ...L.front], incisions: I };
}

// ---------------- held objects (props) ----------------
export type Prop = 'spear' | 'lotus' | 'bowl' | 'phiale' | 'amphora' | 'lidded' | 'bracelets' | 'textile' | 'tusk' | 'basket' | 'axe' | 'skin' | 'shield' | 'spears2'
  | 'kid' | 'wineskin' | 'dish' | 'cubs' | 'parasol' | 'whisk' | 'towel' | 'flask' | 'staff' | 'sceptre' | 'dagger' | 'leash' | 'wicker' | 'bow';
/** masses for a prop held at hand position (hx, hy) in frame fr; `pc` = its paint */
export function prop(fr: Frame, kind: Prop, hx: number, hy: number, pc: C3): Mass[] {
  const out: Mass[] = [], metal = pc;
  switch (kind) {
    case 'spear': // long spear, vertical, blade up, spherical (pomegranate/apple) butt on the ground (SUSA-ARCH, IR-IMM: B)
      out.push(M([fr.seg(hx, 0.035, hx, 0.94, 0.0062)], { amp: 0.86, lift: 0.14, colour: P.yellowOchre, round: 0.006, edge: 0.6, groove: 0.08 }));
      out.push(M([fr.spoly([[hx, 0.998], [hx + 0.011, 0.965], [hx + 0.006, 0.935], [hx - 0.006, 0.935], [hx - 0.011, 0.965]], 3)], { amp: 0.86, lift: 0.14, colour: P.white, round: 0.006 }));
      out.push(M([fr.circ(hx, 0.028, 0.02), fr.poly([[hx - 0.01, 0.042], [hx - 0.006, 0.056], [hx, 0.046], [hx + 0.006, 0.056], [hx + 0.01, 0.042]])], { amp: 0.9, lift: 0.1, colour: metal, round: 0.012, groove: 0.06 }));
      break;
    case 'bow': // the king's bow held upright in the far hand, its lower end on the ground (Naqsh-e Rustam tomb reliefs, B; form C)
      out.push(M(fr.stroke([[hx + 0.035, 0.03], [hx + 0.06, 0.16], [hx + 0.035, hy - 0.08], [hx, hy], [hx + 0.02, hy + 0.12], [hx + 0.055, hy + 0.22], [hx + 0.03, hy + 0.3]], 0.006, 0.004), { amp: 0.84, lift: 0.12, colour: P.yellowOchre, round: 0.005 }));
      break;
    case 'wicker': // lance of the lance-bearers (Tachara W rooms, B)
      out.push(M([fr.seg(hx, 0.035, hx + 0.02, 0.94, 0.0062)], { amp: 0.86, lift: 0.14, colour: P.yellowOchre, round: 0.006 }));
      out.push(M([fr.spoly([[hx + 0.02, 0.998], [hx + 0.031, 0.965], [hx + 0.026, 0.935], [hx + 0.014, 0.935], [hx + 0.009, 0.965]], 3)], { amp: 0.86, lift: 0.14, colour: P.white, round: 0.006 }));
      break;
    case 'shield': // violin-shaped wicker shield (NS, C)
      out.push(M([fr.spoly([[hx - 0.07, hy + 0.16], [hx + 0.02, hy + 0.17], [hx + 0.035, hy + 0.08], [hx + 0.015, hy + 0.02], [hx + 0.035, hy - 0.06], [hx + 0.02, hy - 0.15], [hx - 0.07, hy - 0.16], [hx - 0.09, hy - 0.06], [hx - 0.075, hy + 0.02], [hx - 0.09, hy + 0.08]], 3)],
        { amp: 0.7, lift: 0.12, colour: P.yellowOchre, round: 0.012, dome: 0.4, domeW: 0.05, groove: 0.1, detail: fr.det((x, y) => pleats(y - hy, 0.012, 0.08) + pleats(x * 0.3, 0.05, 0.02)) }));
      break;
    case 'lotus': // a flower held up before the face (NOT SEEN in the research, C)
      out.push(M(fr.stroke([[hx, hy], [hx + 0.02, hy + 0.08], [hx + 0.03, hy + 0.15]], 0.003), { amp: 0.8, lift: 0.1, colour: P.malachite, round: 0.003 }));
      out.push(M([fr.poly([[hx + 0.03, hy + 0.154], [hx + 0.01, hy + 0.19], [hx + 0.022, hy + 0.178], [hx + 0.03, hy + 0.2], [hx + 0.038, hy + 0.178], [hx + 0.05, hy + 0.19]])], { amp: 0.84, lift: 0.1, colour: P.white, round: 0.005 }));
      break;
    case 'staff': case 'sceptre': {
      const top = kind === 'sceptre' ? hy + 0.2 : 0.8, bot = kind === 'sceptre' ? hy - 0.3 : 0.04;
      out.push(M([fr.seg(hx, bot, hx + (kind === 'sceptre' ? 0.08 : 0), top, 0.006)], { amp: 0.84, lift: 0.12, colour: kind === 'sceptre' ? P.gold : P.yellowOchre, round: 0.006 }));
      if (kind === 'sceptre') out.push(M([fr.circ(hx + 0.08, top, 0.012)], { amp: 0.9, lift: 0.1, colour: P.gold, round: 0.008 }));
      break; }
    case 'bowl': case 'phiale': // bowl carried on the palm (vessels: B/C); the phiale fluted
      out.push(M([fr.spoly([[hx - 0.05, hy + 0.028], [hx + 0.05, hy + 0.028], [hx + 0.036, hy + 0.004], [hx, hy - 0.004], [hx - 0.036, hy + 0.004]], 3)], { amp: 0.86, lift: 0.14, colour: metal, round: 0.01, groove: 0.1, detail: kind === 'phiale' ? fr.det(x => flutes(x - hx, 0.009, 0.14)) : undefined }));
      break;
    case 'amphora': { // amphora with animal (griffin) handles (Armenians, B; form C)
      const cx = hx + 0.035;
      out.push(M([fr.spoly([[cx - 0.015, hy + 0.1], [cx + 0.015, hy + 0.1], [cx + 0.02, hy + 0.075], [cx + 0.045, hy + 0.03], [cx + 0.035, hy - 0.04], [cx + 0.008, hy - 0.07], [cx - 0.008, hy - 0.07], [cx - 0.035, hy - 0.04], [cx - 0.045, hy + 0.03], [cx - 0.02, hy + 0.075]], 3)],
        { amp: 0.84, lift: 0.14, colour: metal, round: 0.014, dome: 0.3, domeW: 0.03, groove: 0.1, detail: fr.det((x, y) => pleats(y, 0.022, 0.06)) }));
      out.push(M([...fr.stroke([[cx + 0.02, hy + 0.08], [cx + 0.055, hy + 0.07], [cx + 0.05, hy + 0.03]], 0.004), ...fr.stroke([[cx - 0.02, hy + 0.08], [cx - 0.055, hy + 0.07], [cx - 0.05, hy + 0.03]], 0.004)], { amp: 0.9, lift: 0.1, colour: metal, round: 0.004 }));
      break; }
    case 'lidded': // lidded bowl (Ethiopians, B)
      out.push(M([fr.spoly([[hx - 0.04, hy + 0.035], [hx + 0.04, hy + 0.035], [hx + 0.038, hy], [hx, hy - 0.01], [hx - 0.038, hy]], 3), fr.ell(hx, hy + 0.05, 0.03, 0.018), fr.circ(hx, hy + 0.072, 0.007)], { amp: 0.86, lift: 0.14, colour: metal, round: 0.012, groove: 0.1 }));
      break;
    case 'bracelets': // a pair of bracelets held up (B)
      out.push(M([diff(fr.circ(hx + 0.01, hy + 0.035, 0.026), fr.circ(hx + 0.01, hy + 0.035, 0.016)), diff(fr.circ(hx + 0.04, hy + 0.05, 0.026), fr.circ(hx + 0.04, hy + 0.05, 0.016))], { amp: 0.88, lift: 0.12, colour: P.gold, round: 0.005 }));
      break;
    case 'textile': // folded garments over the forearms (B)
      out.push(M([fr.spoly([[hx - 0.07, hy + 0.035], [hx + 0.05, hy + 0.04], [hx + 0.055, hy - 0.03], [hx + 0.035, hy - 0.12], [hx - 0.03, hy - 0.12], [hx - 0.06, hy - 0.02]], 3)], { amp: 0.8, lift: 0.14, colour: pc, round: 0.012, groove: 0.1, detail: fr.det((x, y) => pleats(y, 0.018, 0.14)) }));
      break;
    case 'tusk': // elephant tusk over the shoulder (Ethiopians, B)
      out.push(M(fr.stroke([[hx - 0.02, hy - 0.02], [hx - 0.02, hy + 0.12], [hx - 0.08, hy + 0.24], [hx - 0.15, hy + 0.26]], 0.018, 0.006), { amp: 0.86, lift: 0.14, colour: P.white, round: 0.012, groove: 0.1 }));
      break;
    case 'basket': case 'dish': // basket (Indians, C) / covered dish (Tachara servants, B)
      out.push(M([fr.spoly([[hx - 0.045, hy + 0.05], [hx + 0.045, hy + 0.05], [hx + 0.035, hy - 0.01], [hx - 0.035, hy - 0.01]], 2), fr.spoly([[hx - 0.05, hy + 0.05], [hx - 0.03, hy + 0.08], [hx + 0.03, hy + 0.08], [hx + 0.05, hy + 0.05]], 3)],
        { amp: 0.84, lift: 0.14, colour: kind === 'basket' ? P.yellowOchre : metal, round: 0.012, groove: 0.1, detail: fr.det((x, y) => (kind === 'basket' ? curls(x, y, 0.012, 0.08) * 0.5 : y > hy + 0.05 ? pleats(x, 0.015, 0.06) : 0)) }));
      break;
    case 'axe': // axe on the shoulder (an axe held by a delegate on the N façade was sampled for pigment, B)
      out.push(M([fr.seg(hx, hy - 0.02, hx - 0.07, hy + 0.2, 0.006)], { amp: 0.82, lift: 0.12, colour: P.yellowOchre, round: 0.006 }));
      out.push(M([fr.poly([[hx - 0.07, hy + 0.2], [hx - 0.035, hy + 0.23], [hx - 0.028, hy + 0.2], [hx - 0.06, hy + 0.18]])], { amp: 0.86, lift: 0.12, colour: P.white, round: 0.005 }));
      break;
    case 'skin': // skin of a wild cat over the arm (Arachosians, B/C)
      out.push(M([fr.spoly([[hx - 0.03, hy + 0.03], [hx + 0.03, hy + 0.02], [hx + 0.04, hy - 0.1], [hx + 0.02, hy - 0.2], [hx - 0.01, hy - 0.22], [hx - 0.03, hy - 0.1]], 3)], { amp: 0.8, lift: 0.14, colour: P.yellowOchre, round: 0.012, groove: 0.08, detail: fr.det((x, y) => curls(x, y, 0.02, 0.06)) }));
      break;
    case 'spears2': // two spears carried upright (RECOLLECTION, C)
      for (const dx of [0, 0.018]) out.push(M([fr.seg(hx + dx, hy - 0.2, hx + dx + 0.02, 0.95, 0.005)], { amp: 0.84, lift: 0.12, colour: P.yellowOchre, round: 0.005 }));
      for (const dx of [0, 0.018]) out.push(M([fr.poly([[hx + dx + 0.02, 0.995], [hx + dx + 0.03, 0.955], [hx + dx + 0.01, 0.955]])], { amp: 0.86, lift: 0.12, colour: P.white, round: 0.004 }));
      break;
    case 'kid': case 'cubs': { // a young goat (stair servants, B) / lion cubs (Elamites, B/C) carried against the chest
      const [ox, oy] = fr.p(hx - 0.02, hy - 0.04);
      const q = quadruped(new Frame(ox, oy, fr.rot + (fr.flip ? -0.15 : 0.15), fr.r(kind === 'kid' ? 0.36 : 0.3), fr.flip), SPECIES[kind === 'kid' ? 'kid' : 'cub'], { carried: true });
      for (const m of q.masses) m.lift = (m.lift ?? 0) + 0.14;
      out.push(...q.masses);
      break; }
    case 'wineskin': // wineskin on the shoulder (Tachara servants, B)
      out.push(M([fr.spoly([[hx - 0.02, hy + 0.02], [hx + 0.02, hy + 0.1], [hx - 0.02, hy + 0.2], [hx - 0.1, hy + 0.2], [hx - 0.13, hy + 0.12], [hx - 0.09, hy + 0.06]], 4), fr.seg(hx + 0.01, hy + 0.1, hx + 0.03, hy + 0.14, 0.012)], { amp: 0.82, lift: 0.14, colour: P.redOchre, round: 0.025, dome: 0.4, domeW: 0.05, groove: 0.1 }));
      break;
    case 'parasol': // parasol held behind the king (C)
      out.push(M([fr.seg(hx, hy - 0.1, hx + 0.02, 1.02, 0.006)], { amp: 0.82, lift: 0.12, colour: P.yellowOchre, round: 0.006 }));
      out.push(M([fr.spoly([[hx - 0.16, 1.0], [hx + 0.2, 1.0], [hx + 0.02, 1.07]], 3)], { amp: 0.8, lift: 0.12, colour: pc, round: 0.012, detail: fr.det(x => flutes(x - hx, 0.03, 0.12)) }));
      break;
    case 'whisk': // fly-whisk (C)
      out.push(M([fr.seg(hx, hy, hx + 0.02, hy + 0.12, 0.005), ...fr.stroke([[hx + 0.02, hy + 0.12], [hx + 0.06, hy + 0.2], [hx + 0.12, hy + 0.22]], 0.012, 0.02)], { amp: 0.82, lift: 0.12, colour: P.white, round: 0.008, detail: fr.det((x, y) => strands(x - y, y, 0.008, 0.1)) }));
      break;
    case 'towel': // towel over the arm (Tachara chamber attendants, B)
      out.push(M([fr.spoly([[hx - 0.02, hy + 0.02], [hx + 0.03, hy + 0.02], [hx + 0.035, hy - 0.16], [hx - 0.015, hy - 0.17]], 2)], { amp: 0.8, lift: 0.14, colour: P.white, round: 0.01, groove: 0.08, detail: fr.det(x => pleats(x, 0.012, 0.1)) }));
      break;
    case 'flask': // perfume flask (Tachara chamber attendants, B)
      out.push(M([fr.spoly([[hx, hy + 0.1], [hx + 0.008, hy + 0.07], [hx + 0.03, hy + 0.03], [hx + 0.02, hy], [hx - 0.02, hy], [hx - 0.03, hy + 0.03], [hx - 0.008, hy + 0.07]], 3)], { amp: 0.86, lift: 0.14, colour: P.gold, round: 0.01 }));
      break;
    case 'dagger': // the royal hero's dagger (B motif)
      out.push(M([fr.poly([[hx, hy - 0.006], [hx + 0.13, hy + 0.012], [hx, hy + 0.012]])], { amp: 0.88, lift: 0.14, colour: P.white, round: 0.004 }));
      break;
    case 'leash': // lead rope back to the animal behind (C)
      out.push(M(fr.stroke([[hx, hy], [hx - 0.1, hy - 0.04], [hx - 0.2, hy - 0.02]], 0.004), { amp: 0.8, lift: 0.1, colour: P.redOchre, round: 0.004 }));
      break;
  }
  return out;
}

// ---------------- quadrupeds ----------------
/** Anatomy in local units (the animal faces +x, ground at y = 0): L = chest front to buttock, H = withers height,
 *  D = barrel depth; neck from its base to the poll (angle above horizontal; arch = bow of the crest); head axis from the
 *  poll to the nose (negative angle = pointing down). */
export interface Species {
  L: number; H: number; D: number;
  neck: { len: number; ang: number; base: number; top: number; arch: number };
  head: { len: number; dep: number; ang: number; muzzle: number };
  leg: number;
  hump?: [number, number, number][];
  horns?: 'bull' | 'ram' | 'ibex' | 'kid' | 'ossicone'; ears?: number;
  tail: 'horse' | 'tuft' | 'fat' | 'short' | 'lion' | 'camel'; mane?: 'horse' | 'lion' | 'ass';
  feet: 'hoof' | 'paw'; waist?: number; dewlap?: boolean; fleece?: boolean; bridle?: boolean; stripes?: boolean;
  tier: string; note: string;
}
export const SPECIES: Record<string, Species> = {
  horse: { L: 0.64, H: 0.6, D: 0.27, neck: { len: 0.25, ang: 58, base: 0.105, top: 0.052, arch: 0.035 }, head: { len: 0.2, dep: 0.085, ang: -58, muzzle: 0.62 }, leg: 1, ears: 1, tail: 'horse', mane: 'horse', feet: 'hoof', bridle: true,
    tier: 'B', note: 'bridled horse (7 delegations bring horses; the Armenians a bridled stallion: B); clipped crenellated mane, tied forelock and knotted tail after the Persepolis convention (C)' },
  bull: { L: 0.66, H: 0.54, D: 0.3, neck: { len: 0.13, ang: 18, base: 0.125, top: 0.085, arch: 0.01 }, head: { len: 0.17, dep: 0.095, ang: -52, muzzle: 0.75 }, leg: 1.15, hump: [[0.2, 0.09, 0.1]], horns: 'bull', ears: 1, tail: 'tuft', feet: 'hoof', dewlap: true,
    tier: 'B', note: 'humped bull (zebu) of the Babylonians / Gandarans (B)' },
  camel_bactrian: { L: 0.58, H: 0.64, D: 0.25, neck: { len: 0.3, ang: 20, base: 0.075, top: 0.04, arch: -0.06 }, head: { len: 0.13, dep: 0.06, ang: -15, muzzle: 0.8 }, leg: 0.85, hump: [[0.12, 0.13, 0.075], [-0.12, 0.13, 0.075]], ears: 0.6, tail: 'camel', feet: 'hoof',
    tier: 'B', note: 'Bactrian (two-humped) camel of the Bactrians / Arachosians (B/C)' },
  dromedary: { L: 0.58, H: 0.64, D: 0.25, neck: { len: 0.3, ang: 20, base: 0.075, top: 0.04, arch: -0.06 }, head: { len: 0.13, dep: 0.06, ang: -15, muzzle: 0.8 }, leg: 0.85, hump: [[0.0, 0.16, 0.13]], ears: 0.6, tail: 'camel', feet: 'hoof',
    tier: 'B', note: 'dromedary of the Arabs (B/C)' },
  ram: { L: 0.4, H: 0.33, D: 0.17, neck: { len: 0.1, ang: 45, base: 0.065, top: 0.042, arch: 0.01 }, head: { len: 0.1, dep: 0.055, ang: -62, muzzle: 0.7 }, leg: 0.75, horns: 'ram', ears: 0.7, tail: 'fat', feet: 'hoof', fleece: true,
    tier: 'B', note: 'fat-tailed ram of the Cilicians (B)' },
  lioness: { L: 0.56, H: 0.33, D: 0.17, neck: { len: 0.1, ang: 25, base: 0.075, top: 0.058, arch: 0.01 }, head: { len: 0.11, dep: 0.085, ang: -12, muzzle: 0.62 }, leg: 1, ears: 0.7, tail: 'lion', feet: 'paw', waist: 0.72,
    tier: 'B', note: 'lioness of the Elamite delegation (B/C)' },
  lion: { L: 0.6, H: 0.37, D: 0.215, neck: { len: 0.1, ang: 30, base: 0.1, top: 0.075, arch: 0.01 }, head: { len: 0.12, dep: 0.1, ang: -8, muzzle: 0.62 }, leg: 1.1, ears: 0.7, tail: 'lion', mane: 'lion', feet: 'paw', waist: 0.6,
    tier: 'B', note: 'lion (lion-and-bull combat, royal hero: B motif)' },
  ibex: { L: 0.42, H: 0.4, D: 0.18, neck: { len: 0.12, ang: 55, base: 0.06, top: 0.038, arch: 0.01 }, head: { len: 0.11, dep: 0.05, ang: -60, muzzle: 0.65 }, leg: 0.75, horns: 'ibex', ears: 0.7, tail: 'short', feet: 'hoof',
    tier: 'C', note: 'ibex (Libyans: ibex or kudu, RECOLLECTION, C)' },
  okapi: { L: 0.52, H: 0.56, D: 0.22, neck: { len: 0.24, ang: 58, base: 0.07, top: 0.04, arch: 0.02 }, head: { len: 0.15, dep: 0.06, ang: -62, muzzle: 0.65 }, leg: 0.85, horns: 'ossicone', ears: 1.3, tail: 'tuft', feet: 'hoof', stripes: true,
    tier: 'B', note: 'okapi (giraffid) of the Ethiopian delegation (B: "okapi and tusk"); form C' },
  wild_ass: { L: 0.52, H: 0.5, D: 0.22, neck: { len: 0.19, ang: 50, base: 0.08, top: 0.045, arch: 0.015 }, head: { len: 0.17, dep: 0.07, ang: -62, muzzle: 0.62 }, leg: 0.85, ears: 1.8, tail: 'tuft', mane: 'ass', feet: 'hoof',
    tier: 'C', note: 'wild ass (Indians, RECOLLECTION, C)' },
  kid: { L: 0.36, H: 0.32, D: 0.15, neck: { len: 0.1, ang: 55, base: 0.055, top: 0.036, arch: 0.01 }, head: { len: 0.1, dep: 0.05, ang: -45, muzzle: 0.7 }, leg: 0.7, horns: 'kid', ears: 1, tail: 'short', feet: 'hoof',
    tier: 'B', note: 'young goat (kid) carried by the stair servants (B)' },
  cub: { L: 0.42, H: 0.26, D: 0.15, neck: { len: 0.07, ang: 25, base: 0.065, top: 0.052, arch: 0 }, head: { len: 0.1, dep: 0.085, ang: -10, muzzle: 0.62 }, leg: 0.9, ears: 0.8, tail: 'lion', feet: 'paw', waist: 0.82,
    tier: 'B', note: 'lion cub (Elamite delegation, B/C)' },
};

/** lean = the body's tilt (rad, front up). Legs that stand are aimed at the ground line (field y = 0) through the frame, so a
 *  tilted body still stands; neck and head angles are then world-relative. fore: 'walk' | 'raised' (rearing, forelegs
 *  folded up) | 'reach' (clawing forward); seated: haunches on the ground, forelegs straight. */
export interface QuadPose { lean?: number; fore?: 'walk' | 'raised' | 'reach'; seated?: boolean; turnHead?: boolean; carried?: boolean; jawOpen?: boolean; noHead?: boolean; neckAng?: number; headAng?: number }
export interface QuadBuilt extends Built { poll: [number, number]; shoulder: [number, number]; rump: [number, number] }
/** Profile quadruped facing +x, feet at y = 0. Near legs are carved in front of the body, far legs behind it. */
export function quadruped(fr: Frame, sp: Species, pose: QuadPose = {}): QuadBuilt {
  const out: Mass[] = [], incs: SDF[] = [], col = STONE, { L, H, D } = sp, hl = L / 2, lg = sp.leg, w = sp.waist ?? 1, paw = sp.feet === 'paw', lean = pose.lean ?? 0;
  // D-226: the animal's body is cut back in a near-vertical step too (edge 0.7, was 0.5), its musculature rounded within it
  // (dome 0.3 over 0.08, was 0.45 over 0.1; round 0.02, was 0.035)
  const BODY = { amp: 0.62, round: 0.02, edge: 0.7, dome: 0.3, domeW: 0.08, groove: 0.1, grooveW: 0.008 };
  const Wt = [hl - 0.45 * D, H], C = [hl, H - 0.5 * D], B = [-hl, H - 0.35 * D];
  const shoulder = [hl - 0.42 * D, H - 0.4 * D], hip = [-hl + 0.42 * D, H - 0.3 * D];
  // --- legs: root → upper joint → lower joint → fetlock, a radius per joint; feet aimed in field (world) coordinates
  const fs = fr.flip ? -1 : 1, sc = fr.s, fS = fr.p(shoulder[0], shoulder[1]), fH = fr.p(hip[0], hip[1]);
  const wpt = (base: [number, number], a: number, b: number) => fr.inv(base[0] + fs * a * sc, base[1] + b * sc); // a forward, b up (local units)
  const bent = (root: number[], foot: number[], bends: number[]) => { // joints at 35 / 62 / 93 % bent perpendicular to the leg (+ = toward the front)
    const dx = foot[0] - root[0], dy = foot[1] - root[1], len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len;
    return [root, ...[0.35, 0.62, 1].map((t, k) => [root[0] + dx * t + nx * bends[k] * len, root[1] + dy * t + ny * bends[k] * len])];
  };
  const legs = (near: boolean) => {
    const s = near ? 1 : -1, amp = near ? 0.6 : 0.36, lift = near ? 0.1 : 0, ms: Mass[] = [];
    const dF = (s * 0.045 * L) / 0.6, dH = (-s * 0.04 * L) / 0.6, fetl = 0.05 * Math.min(1, lg);
    let fore: number[][], hind: number[][];
    if (pose.carried) { // legs hanging below the body
      fore = bent(shoulder, [shoulder[0] + 0.02 + s * 0.02, shoulder[1] - (H - D) * 0.75], [-0.05, 0.03, 0]);
      hind = bent(hip, [hip[0] - 0.02 - s * 0.02, hip[1] - (H - D) * 0.75], [0.12, -0.08, 0]);
    } else if (pose.seated) {
      fore = bent(shoulder, wpt(fS, 0.03 + s * 0.02, -fS[1] / sc + 0.035), [-0.04, 0.02, 0]);
      hind = [hip, wpt(fH, 0.13, -fH[1] / sc + 0.07), wpt(fH, -0.01, -fH[1] / sc + 0.045), wpt(fH, 0.14 + s * 0.02, -fH[1] / sc + 0.03)];
    } else {
      hind = bent(hip, wpt(fH, -0.02 + dH, -fH[1] / sc + fetl), [0.12, -0.08, 0]);
      if (pose.fore === 'raised') fore = [shoulder, wpt(fS, 0.06, -0.1), wpt(fS, 0.18, -0.06 + (near ? 0.04 : 0)), wpt(fS, 0.13 + (near ? 0.03 : 0), -0.2 + (near ? 0.04 : 0))];
      else if (pose.fore === 'reach') fore = [shoulder, wpt(fS, 0.09, -0.06), wpt(fS, 0.2, -0.05 + (near ? 0.04 : -0.03)), wpt(fS, 0.3, -0.06 + (near ? 0.06 : -0.02))];
      else fore = bent(shoulder, wpt(fS, dF, -fS[1] / sc + fetl), [-0.03, 0.02, 0]);
    }
    const fr0 = paw ? [0.14 * D, 0.07, 0.05, 0.045] : [0.13 * D, 0.055, 0.03, 0.026], hr0 = paw ? [0.17 * D, 0.08, 0.05, 0.045] : [0.17 * D, 0.065, 0.034, 0.026];
    for (const [pts, rr] of [[fore, fr0], [hind, hr0]] as [number[][], number[]][]) {
      ms.push(M(fr.strokeR(pts, rr.map(r => r * lg), 4), { amp, lift, colour: col, round: 0.02, groove: near ? 0.08 : 0, edge: 0.5 }));
      const f = pts[pts.length - 1], p0 = pts[pts.length - 2], dl = Math.sqrt((f[0] - p0[0]) ** 2 + (f[1] - p0[1]) ** 2) || 1;
      const d0 = [(f[0] - p0[0]) / dl, (f[1] - p0[1]) / dl], fw = [-d0[1], d0[0]]; // along the leg, and toward the front
      const q = (a: number, b: number) => [f[0] + d0[0] * a + fw[0] * b, f[1] + d0[1] * a + fw[1] * b];
      if (paw) { const [px, py] = q(0.012, 0.022); ms.push(M([fr.ell(px, py, 0.038 * lg, 0.02 * lg, Math.atan2(fw[1], fw[0]))], { amp: amp + 0.03, lift: lift * 0.6, colour: col, round: 0.012, detail: fr.det(x => pleats(x, 0.014, 0.12)) })); }
      else if (!pose.carried) ms.push(M([fr.poly([q(0.05, -0.02 * lg), q(0.05, 0.028 * lg), q(0.006, 0.016 * lg), q(0.006, -0.014 * lg)])], { amp: amp + 0.02, lift: lift * 0.6, colour: col, round: 0.008 }));
    }
    return ms;
  };
  out.push(...legs(false));
  // --- tail (behind the body)
  const tr = [-hl + 0.05 * D, H - 0.1 * D], ty = H - D;
  const tails: Record<Species['tail'], number[][]> = { horse: [tr, [tr[0] - 0.05, tr[1] - 0.06], [tr[0] - 0.075, tr[1] - 0.2], [tr[0] - 0.06, ty * 0.35]], tuft: [tr, [tr[0] - 0.035, tr[1] - 0.1], [tr[0] - 0.03, ty * 0.5]], fat: [tr, [tr[0] - 0.02, tr[1] - 0.05]],
    short: [tr, [tr[0] - 0.035, tr[1] + 0.035]], lion: pose.seated ? [tr, [tr[0] + 0.02, 0.02], [tr[0] + 0.2, 0.015], [tr[0] + 0.25, 0.06]] : [tr, [tr[0] - 0.09, tr[1] - 0.05], [tr[0] - 0.12, ty * 0.7], [tr[0] - 0.08, ty * 0.4]], camel: [tr, [tr[0] - 0.025, tr[1] - 0.12], [tr[0] - 0.02, ty * 0.75]] };
  const tp = tails[sp.tail];
  if (sp.tail === 'fat') out.push(M([fr.spoly([[tr[0] + 0.03, tr[1] + 0.01], [tr[0] - 0.06, tr[1] - 0.005], [tr[0] - 0.085, tr[1] - 0.09], [tr[0] - 0.04, tr[1] - 0.15], [tr[0] + 0.03, tr[1] - 0.11]], 3)], { amp: 0.6, colour: col, round: 0.03, dome: 0.4, domeW: 0.05, detail: fr.det((x, y) => curls(x, y, 0.02, 0.12)) }));
  else out.push(M(fr.strokeR(tp, sp.tail === 'horse' ? [0.022, 0.03, 0.034, 0.026] : [0.012, 0.009, 0.007, 0.007].slice(0, tp.length), 4), { amp: 0.5, colour: col, round: 0.012, detail: sp.tail === 'horse' ? fr.det((x, y) => strands(x * 1.5 + y * 0.2, y, 0.011, 0.14)) : undefined }));
  if (sp.tail === 'tuft' || sp.tail === 'lion') { const e = tp[tp.length - 1], e0 = tp[tp.length - 2], a = Math.atan2(e[1] - e0[1], e[0] - e0[0]); out.push(M([fr.ell(e[0] + Math.cos(a) * 0.02, e[1] + Math.sin(a) * 0.02, 0.032, 0.015, a)], { amp: 0.55, lift: 0.04, colour: col, round: 0.01, detail: fr.det((x, y) => strands(x - y, y, 0.006, 0.12)) })); }
  if (sp.tail === 'horse') out.push(M([fr.ell(tr[0] - 0.035, tr[1] - 0.035, 0.024, 0.016, -0.7)], { amp: 0.6, lift: 0.08, colour: col, round: 0.01, detail: fr.det((x, y) => pleats(x + y, 0.01, 0.1)) })); // knotted tail (C)
  // --- body outline (croup → back → withers → chest → brisket → belly → flank → buttock)
  const bodyPts = pose.seated
    ? [[-hl + 0.3 * D, H], [0, H + 0.01], Wt, [hl - 0.15 * D, H - 0.1 * D], C, [hl - 0.08 * D, H - 0.8 * D], [hl - 0.35 * D, H - 0.95 * D], [0, H - D * 0.9 * w], [-hl + 0.2 * D, 0.12], [-hl + 0.05, 0.02], [-hl - 0.05, 0.03], [-hl - 0.08, H * 0.4], [-hl, H - 0.2 * D]]
    : [[-hl + 0.32 * D, H - 0.005], [-0.12 * L, H - 0.025], [0.12 * L, H - 0.022], Wt, [hl - 0.18 * D, H - 0.1 * D], C, [hl - 0.06 * D, H - 0.75 * D], [hl - 0.35 * D, H - 0.98 * D], [0, H - D * (w < 1 ? 0.62 + 0.38 * w : 1)], [-hl + 0.55 * D, H - 0.95 * D], [-hl + 0.18 * D, H - 0.78 * D], B, [-hl + 0.02, H - 0.12 * D]];
  const body: SDF[] = [fr.spoly(bodyPts, 4)];
  for (const [x, hh, hw] of sp.hump ?? []) body.push(fr.ell(x, H + hh * 0.35, hw, hh * 0.8));
  // --- neck: base → arched crest → poll (turned back toward the attacker when turnHead)
  const leanDeg = (lean * 180) / Math.PI, neckW = pose.neckAng ?? (pose.turnHead ? 180 - sp.neck.ang - 20 : sp.neck.ang);
  const turn = pose.turnHead ? -1 : 1, na = ((neckW - leanDeg) * Math.PI) / 180, nb = [hl - 0.4 * D, H - 0.3 * D];
  const Pn = [nb[0] + Math.cos(na) * sp.neck.len, nb[1] + Math.sin(na) * sp.neck.len];
  const perp = [-Math.sin(na) * turn, Math.cos(na) * turn], nm = [(nb[0] + Pn[0]) / 2 + perp[0] * sp.neck.arch, (nb[1] + Pn[1]) / 2 + perp[1] * sp.neck.arch];
  const neckSpine = [nb, nm, Pn];
  body.push(...fr.strokeR(neckSpine, [sp.neck.base, (sp.neck.base + sp.neck.top) * 0.55, sp.neck.top], 4));
  const bodyDetail = sp.fleece ? fr.det((x, y) => curls(x, y, 0.02, 0.13)) : sp.stripes ? fr.det((x, y) => (x < -hl * 0.25 ? pleats(x * 0.3 + y, 0.028, 0.1) : 0)) : undefined;
  out.push(M(body, { ...BODY, colour: col, smooth: 0.04, detail: bodyDetail }));
  if (sp.dewlap) out.push(M([fr.spoly([[Pn[0] - 0.02 * turn, Pn[1] - 0.07], [nb[0] + 0.05 * turn, nb[1] - 0.1], [C[0] - 0.02, H - D * 0.95], [C[0] - 0.08, H - D * 0.95], [nb[0], nb[1] - 0.06]], 3)], { amp: 0.56, lift: 0.04, colour: col, round: 0.014, detail: fr.det((x, y) => pleats(y + x * 0.4, 0.018, 0.08)) }));
  // muscle markings: incised arcs at the shoulder and the haunch (Achaemenid animal convention, C)
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => fr.caps(Array.from({ length: 6 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / 5; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }), 0.0008, 0.0008, 2);
  if (!pose.carried) incs.push(...arc(shoulder[0] + 0.01, shoulder[1] - 0.02, D * 0.42, 1.3, 3.5), ...arc(hip[0] - 0.02, hip[1] - 0.02, D * 0.45, -0.3, 1.8));
  // --- clipped crest mane (horse, wild ass), cut in crenellations
  if (sp.mane === 'horse' || sp.mane === 'ass') {
    const spine = catmull(neckSpine, 4, false), top: number[][] = [], bot: number[][] = [];
    for (let i = 0; i < spine.length; i++) { const r = sp.neck.base + (sp.neck.top - sp.neck.base) * (i / (spine.length - 1)); top.push([spine[i][0] + perp[0] * (r + 0.035), spine[i][1] + perp[1] * (r + 0.035)]); bot.push([spine[i][0] + perp[0] * r * 0.55, spine[i][1] + perp[1] * r * 0.55]); }
    out.push(M([fr.poly([...top, ...bot.reverse()])], { amp: 0.66, lift: 0.08, colour: col, round: 0.012, groove: 0.08, detail: fr.det((x, y) => pleats(x * perp[1] - y * perp[0], 0.018, 0.22)) }));
  }
  // --- head: outline in the head frame (u from the poll toward the nose, v toward the forehead)
  const ha = (((pose.headAng ?? (pose.turnHead ? 180 - sp.head.ang : sp.head.ang)) - leanDeg) * Math.PI) / 180, hL = sp.head.len, hD = sp.head.dep, mz = sp.head.muzzle;
  const ax = [Math.cos(ha), Math.sin(ha)], pv = [-Math.sin(ha) * turn, Math.cos(ha) * turn];
  const H2 = (u: number, v: number) => { const vv = v * (1 + (mz - 1) * Math.max(0, u)); return [Pn[0] + ax[0] * u * hL + pv[0] * vv * hD, Pn[1] + ax[1] * u * hL + pv[1] * vv * hD]; };
  if (!pose.noHead) {
    if (sp.mane === 'lion') out.push(M([fr.spoly([H2(-0.3, 0.75), H2(0.2, 0.66), H2(0.32, 0.2), H2(0.26, -0.72), [C[0] + 0.03, H - D * 0.78], [shoulder[0] - 0.04, H - D * 0.72], [shoulder[0] - 0.13, H - 0.1 * D], [shoulder[0] - 0.08, H + 0.05]], 3)],
      { amp: 0.72, lift: 0.1, colour: col, round: 0.02, groove: 0.1, detail: fr.det((x, y) => tufts(y * 0.7 - x * 0.7, x * 0.7 + y * 0.7, 0.028, 0.034, 0.24)) }));
    const outline = paw
      ? [[-0.15, 0.35], [0.15, 0.52], [0.55, 0.45], [0.88, 0.32], [1.0, 0.1], [0.98, pose.jawOpen ? -0.05 : -0.2], ...(pose.jawOpen ? [[0.7, -0.1], [0.95, -0.35]] : []), [0.8, -0.42], [0.45, -0.55], [0.1, -0.6], [-0.12, -0.35]]
      : [[-0.08, 0.3], [0.2, 0.46], [0.55, 0.38], [0.88, 0.26], [1.0, 0.1], [1.0, -0.2], [0.88, -0.34], [0.6, -0.34], [0.38, -0.5], [0.15, -0.6], [-0.05, -0.4]];
    out.push(M([fr.spoly(outline.map(([u, v]) => H2(u, v)), 4)], { amp: 0.7, lift: 0.1, colour: col, round: 0.022, edge: 0.5, dome: 0.35, domeW: 0.04, groove: 0.1 }));
    const [ex, ey] = H2(0.28, 0.12), [nx0, ny0] = H2(0.92, 0.02);
    out.push(M([fr.ell(ex, ey, hD * 0.14, hD * 0.09, ha)], { amp: 0.001, lift: 0.1, colour: col, round: 0.005, groove: 0.1, grooveW: 0.004 })); // eye boss, incised lids
    out.push(M([fr.ell(nx0, ny0, hD * 0.1, hD * 0.07, ha)], { amp: 0.001, lift: -0.04, colour: col, round: 0.004 })); // nostril
    incs.push(...fr.caps([H2(1.0, -0.18), H2(0.75, -0.22)], 0.0008, 0.0008, 1));
    if (paw) incs.push(...fr.caps([H2(0.55, 0.3), H2(0.75, 0.05), H2(0.62, -0.15)], 0.0008, 0.0008, 2)); // muzzle wrinkle
    const ear = H2(-0.02, 0.35), poll = H2(0.02, 0.3), ed = ax[0] >= 0 ? -1 : 1; // ed: toward the back of the head
    if (sp.ears) out.push(M([fr.ell(ear[0] + ed * 0.012, ear[1] + 0.022 * sp.ears, 0.012 * Math.min(1.2, sp.ears), 0.028 * sp.ears, ed * 0.35)], { amp: 0.66, lift: 0.06, colour: col, round: 0.008 }));
    if (sp.horns === 'bull') out.push(M(fr.strokeR([poll, [poll[0] + ed * 0.01, poll[1] + 0.045], [poll[0] - ed * 0.03, poll[1] + 0.08]], [0.014, 0.01, 0.004], 3), { amp: 0.74, lift: 0.1, colour: col, round: 0.008 }));
    if (sp.horns === 'ram') { const c: number[][] = []; for (let k = 0; k <= 14; k++) { const a = (k / 14) * Math.PI * 1.6 + Math.PI * 0.5, r = 0.04 * (1 - k / 22); c.push([poll[0] + ed * 0.01 + Math.cos(a) * r * ed, poll[1] - 0.03 + Math.sin(a) * r]); }
      out.push(M(fr.caps(c, 0.016, 0.008, 2), { amp: 0.78, lift: 0.14, colour: col, round: 0.01, groove: 0.08, detail: fr.det((x, y) => pleats(Math.atan2(y - poll[1] + 0.03, x - poll[0]), 0.25, 0.1)) })); }
    if (sp.horns === 'ibex') out.push(M(fr.strokeR([poll, [poll[0] + ed * 0.03, poll[1] + 0.12], [poll[0] + ed * 0.12, poll[1] + 0.22], [poll[0] + ed * 0.2, poll[1] + 0.2]], [0.014, 0.011, 0.008, 0.004], 4), { amp: 0.76, lift: 0.1, colour: col, round: 0.008, detail: fr.det((x, y) => pleats(x * 0.7 + y, 0.012, 0.14)) }));
    if (sp.horns === 'kid') out.push(M(fr.strokeR([poll, [poll[0] + ed * 0.02, poll[1] + 0.045]], [0.009, 0.004]), { amp: 0.74, lift: 0.1, colour: col, round: 0.006 }));
    if (sp.horns === 'ossicone') out.push(M(fr.strokeR([poll, [poll[0] + ed * 0.004, poll[1] + 0.04]], [0.007, 0.006]), { amp: 0.74, lift: 0.1, colour: col, round: 0.005 }));
    if (sp.mane === 'horse') out.push(M([fr.ell(poll[0] - ed * 0.004, poll[1] + 0.015, 0.016, 0.012)], { amp: 0.74, lift: 0.08, colour: col, round: 0.006, detail: fr.det((x, y) => pleats(x + y, 0.008, 0.1)) })); // tied forelock
    if (sp.bridle) out.push(M([...fr.caps([H2(0.05, 0.28), H2(0.3, -0.45)], 0.005, 0.005, 1), ...fr.caps([H2(0.72, 0.36), H2(0.72, -0.38)], 0.005, 0.005, 1), ...fr.caps([H2(0.72, -0.3), H2(1.15, -0.7), H2(1.7, -0.5)], 0.004, 0.004, 3)],
      { amp: 0.001, lift: 0.07, colour: P.redOchre, round: 0.004 })); // cheek strap, noseband, rein forward to the handler (painted leather, C)
  }
  out.push(...legs(true));
  return { masses: out, incisions: incs.map(s0 => inc(s0, 0.08, 0.0022)), poll: fr.p(Pn[0], Pn[1]), shoulder: fr.p(shoulder[0], shoulder[1]), rump: fr.p(B[0] + 0.05, H - 0.1 * D) };
}
/** a frame for a (possibly tilted) animal with its hip at field x = xHip and at its natural height above the ground */
function standing(sp: Species, lean: number, s: number, xHip: number, flip = false, hipH = 1): Frame {
  const hip = [-sp.L / 2 + 0.42 * sp.D, sp.H - 0.3 * sp.D], f = new Frame(0, 0, flip ? -lean : lean, s, flip), [hx, hy] = f.p(hip[0], hip[1]);
  return new Frame(xHip - hx, s * hip[1] * hipH - hy, f.rot, s, flip);
}

// ---------------- plants, emblems, ornaments ----------------
function cypress(fr: Frame): Mass[] { // cypress separating the delegations (B); scale-like foliage (C)
  return [M([fr.seg(0, 0, 0, 0.08, 0.012)], { amp: 0.5, colour: P.redOchre, round: 0.01 }),
    M([fr.spoly([[0, 0.02], [0.06, 0.06], [0.075, 0.25], [0.06, 0.55], [0.03, 0.8], [0.0, 0.93], [-0.03, 0.8], [-0.06, 0.55], [-0.075, 0.25], [-0.06, 0.06]], 4)], { amp: 0.74, lift: 0.05, colour: P.malachite, round: 0.03, dome: 0.4, domeW: 0.06, groove: 0.08, detail: fr.det((x, y) => curls(x * 1.3, y, 0.018, 0.12)) })];
}
function palm(fr: Frame): Mass[] { // date palm beside the sphinxes of the Tripylon panel (B); form C
  const out: Mass[] = [M(fr.stroke([[0, 0], [0.005, 0.4], [0.0, 0.7]], 0.03, 0.022), { amp: 0.55, colour: P.redOchre, round: 0.02, detail: fr.det((x, y) => pleats(y + Math.abs(x) * 0.5, 0.025, 0.12)) })];
  for (let k = 0; k < 7; k++) { const a = Math.PI * (0.1 + (k / 6) * 0.8); out.push(M(fr.stroke([[0, 0.7], [Math.cos(a) * 0.12, 0.7 + Math.sin(a) * 0.1], [Math.cos(a) * 0.22, 0.7 + Math.sin(a) * 0.02 - 0.05]], 0.02, 0.006), { amp: 0.6, lift: 0.06, colour: P.malachite, round: 0.012, detail: fr.det((x, y) => strands(x + y, y, 0.01, 0.1)) })); }
  return out;
}
function rosette(fr: Frame): Mass[] { // twelve-petalled rosette of the border bands (motif seen in reconstructions; C); 1 unit = diameter
  const petals: SDF[] = []; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; petals.push(fr.ell(Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.3, 0.19, 0.08, a)); }
  return [M(petals, { amp: 0.7, colour: P.egyptianBlue, round: 0.08, edge: 0.5 }), M([fr.circ(0, 0.5, 0.13)], { amp: 0.95, lift: 0.2, colour: P.yellowOchre, round: 0.06 })];
}
function wingedDisc(fr: Frame): Mass[] { // winged disc (Tripylon panel, B): ring, outspread wings in feather rows, feathered tail (detail C)
  const out: Mass[] = [];
  for (const s of [-1, 1]) out.push(M([fr.spoly([[s * 0.08, 0.5], [s * 0.3, 0.56], [s * 0.55, 0.6], [s * 0.62, 0.56], [s * 0.6, 0.5], [s * 0.45, 0.44], [s * 0.2, 0.42], [s * 0.08, 0.44]], 4)],
    { amp: 0.62, colour: fr.col((u, v) => (v > 0.53 ? P.egyptianBlue : v > 0.47 ? P.malachite : P.cinnabar)), round: 0.03, dome: 0.3, domeW: 0.06, groove: 0.1, detail: fr.det((x, y) => feathers(Math.abs(x), 0.6 - y, 0.035, 0.045, 0.2)) }));
  out.push(M([fr.spoly([[-0.07, 0.44], [0.07, 0.44], [0.12, 0.3], [0.05, 0.33], [0, 0.29], [-0.05, 0.33], [-0.12, 0.3]], 3)], { amp: 0.6, lift: 0.05, colour: P.egyptianBlue, round: 0.02, detail: fr.det(x => pleats(x, 0.025, 0.14)) }));
  for (const s of [-1, 1]) out.push(M(fr.stroke([[s * 0.04, 0.42], [s * 0.12, 0.36], [s * 0.2, 0.35], [s * 0.22, 0.4]], 0.01, 0.006), { amp: 0.6, lift: 0.06, colour: P.gold, round: 0.008 })); // tendrils (C)
  out.push(M([diff(fr.circ(0, 0.5, 0.085), fr.circ(0, 0.5, 0.05))], { amp: 0.8, lift: 0.12, colour: P.gold, round: 0.02, groove: 0.1 }));
  return out;
}
function fireAltar(fr: Frame): Mass[] { // stepped fire altar (Naqsh-e Rustam tombs, B): three-stepped base and top, a shaft, flames (C); unit = height with the flames
  const steps = (y0: number, up: boolean) => [0, 1, 2].map(i => { const w = up ? 0.2 + i * 0.03 : 0.26 - i * 0.03, y = y0 + i * 0.05; return fr.poly([[-w, y], [w, y], [w, y + 0.05], [-w, y + 0.05]]); });
  return [M([...steps(0, false), fr.poly([[-0.14, 0.15], [0.14, 0.15], [0.14, 0.55], [-0.14, 0.55]]), ...steps(0.55, true)], { amp: 0.7, colour: STONE, round: 0.01, groove: 0.08 }),
    M([fr.spoly([[-0.2, 0.7], [0.2, 0.7], [0.14, 0.8], [0.16, 0.88], [0.06, 0.84], [0.04, 1.0], [-0.04, 0.9], [-0.1, 0.96], [-0.12, 0.82], [-0.18, 0.84]], 3)], { amp: 0.6, lift: 0.04, colour: P.cinnabar, round: 0.02 })];
}
function incenseBurner(fr: Frame): Mass[] { // tall incense stand before the king (Treasury audience relief; NS, C)
  return [M([fr.poly([[-0.06, 0], [0.06, 0], [0.02, 0.05], [0.012, 0.4], [0.05, 0.45], [0.05, 0.5], [-0.05, 0.5], [-0.05, 0.45], [-0.012, 0.4], [-0.02, 0.05]]), fr.spoly([[-0.045, 0.5], [0.045, 0.5], [0.02, 0.6], [0, 0.63], [-0.02, 0.6]], 3)],
    { amp: 0.7, colour: P.yellowOchre, round: 0.012, groove: 0.08, detail: fr.det((x, y) => (y > 0.5 ? pleats(y, 0.02, 0.1) : flutes(x, 0.012, 0.1))) })];
}
/** a mass moved up by dy (field units): its shapes, detail and paint functions */
function liftMass(m: Mass, dy: number): Mass {
  const sh = (q: SDF): SDF => ({ f: (x, y) => q.f(x, y - dy), b: [q.b[0], q.b[1] + dy, q.b[2], q.b[3] + dy], pv: q.pv ? q.pv.map((v, i) => (i & 1 ? v + dy : v)) : undefined });
  const col = m.colour, det = m.detail;
  return { ...m, add: m.add.map(sh), sub: m.sub?.map(sh), clip: m.clip ? sh(m.clip) : undefined, colour: typeof col === 'function' ? (x: number, y: number) => col(x, y - dy) : col, detail: det ? (x: number, y: number, t: number) => det(x, y - dy, t) : undefined };
}
/** height of one canopy segment's band (fringe tips to the top moulding) in segment lengths (the canopy kind's unit =
 *  one segment; SITE_SPEC apadana.r_audience_panel.canopy.rel_height, C; tests/reliefs.test.ts checks they agree) */
export const CANOPY_H = 0.3;
/** One segment of the canopy (baldachin) over the audience scene (D-204). The canopy is RECOLLECTION of the Treasury
 *  audience reliefs (Tilia 1972; NOT SEEN, C): its edge drawn as a horizontal band across the top of the panel: from the top
 *  a plain moulding, a strip of rosettes, a frieze of lions walking, and a fringe hanging below in tassels. Rows, sizes and
 *  paint are C. The pattern repeats with the segment (rosettes 1/12, lions 1/3, tassels 1/32 of it), so segments laid end
 *  to end meet seamlessly; the bands run past the segment ends and the grid cuts them (bounds). Kept cheap to mesh (every
 *  outline is refined at L0-L2): the rosettes are carved as bosses with painted petals, the tassels as one scalloped band
 *  painted in alternating colours, so the carved outline is the moulding, the lions and the scallops */
function canopy(fr: Frame): Mass[] {
  const out: Mass[] = [], X0 = -0.52, X1 = 0.52, band = (y0: number, y1: number) => fr.poly([[X0, y0], [X1, y0], [X1, y1], [X0, y1]]);
  out.push(M([band(0.276, 0.3)], { amp: 0.52, colour: P.yellowOchre, round: 0.008, edge: 0.55, detail: fr.det((x, y) => (y > 0.29 ? 0.06 : 0)) }));
  // the rows stand within 0.1 of the relief depth of each other, so only the band's outline, the lions and the bosses are
  // refined beyond L1 (a step between rows along the whole width cost ~1 k triangles per row edge at L2)
  // the rosette strip: a red ground; blue twelve-petalled rosettes painted on carved bosses, a raised yellow centre
  out.push(M([band(0.212, 0.273)], { amp: 0.44, colour: P.redOchre, round: 0.006, edge: 0.8 }));
  const rc = (x: number) => x - Math.floor(x * 12 + 0.5) / 12;
  const petals = fr.col((x, y) => { const u = rc(x), v = y - 0.2425, r = Math.hypot(u, v), a = Math.atan2(v, u); return r <= 0.0105 ? P.yellowOchre : Math.abs(Math.cos(6 * a)) > 0.45 ? P.egyptianBlue : P.redOchre; });
  const bosses: SDF[] = [], eyes: SDF[] = [];
  for (let k = -6; k <= 6; k++) { bosses.push(fr.circ(k / 12, 0.2425, 0.025)); eyes.push(fr.circ(k / 12, 0.2425, 0.009)); }
  out.push(M(bosses, { amp: 0.56, lift: 0.08, colour: petals, round: 0.012, edge: 0.5, dome: 0.4, domeW: 0.02 }));
  out.push(M(eyes, { amp: 0.64, lift: 0.06, colour: P.yellowOchre, round: 0.006 }));
  out.push(M([band(0.2, 0.209)], { amp: 0.5, colour: P.yellowOchre, round: 0.003, edge: 0.8 }));
  // the lion frieze: a blue ground, three lions per segment walking toward the segment's +x (the planner mirrors the right
  // half so they walk toward the king), painted yellow (C: woven or embroidered, not the bare stone of the carved animals)
  out.push(M([band(0.092, 0.197)], { amp: 0.42, colour: P.egyptianBlue, round: 0.006, edge: 0.8 }));
  for (const cx of [-1 / 3, 0, 1 / 3]) { // quadruped() stands its feet on the field's y = 0: built there, lifted onto the ground line
    const sc = 0.2, q = quadruped(new Frame(cx, 0, 0, sc), SPECIES.lion);
    for (const m of q.masses) out.push(liftMass({ ...m, colour: m.colour === STONE ? P.yellowOchre : m.colour, amp: 0.42 + m.amp * 0.4, lift: (m.lift ?? 0) + 0.08, round: (m.round ?? 0.018) * sc, grooveW: (m.grooveW ?? 0.006) * sc, domeW: (m.domeW ?? 0.08) * sc, groove: 0 }, 0.1));
  }
  // the fringe: a hem and a band of tassels with a scalloped lower edge, painted red and blue by turns, strands as fine flutes
  out.push(M([band(0.076, 0.09)], { amp: 0.5, colour: P.yellowOchre, round: 0.004, edge: 0.8 }));
  const lower: number[][] = [];
  for (let k = -17; k <= 16; k++) { const x = (k + 0.5) / 32; lower.push([x - 0.0156, 0.04], [x - 0.009, 0.018], [x, 0.01], [x + 0.009, 0.018]); }
  out.push(M([fr.poly([[X1, 0.078], [X0, 0.078], ...lower])], { amp: 0.46, colour: fr.col(x => (Math.floor(x * 32 + 64) % 2 ? P.egyptianBlue : P.cinnabar)), round: 0.006, edge: 0.55, detail: fr.det(x => flutes(x, 0.0078, 0.1)) }));
  return out;
}
/** the attendants' scale relative to the king in composite royal groups (SITE_SPEC global.r_jamb_relief.attendant_scale, C;
 *  this module runs in workers and cannot read the spec, tests/reliefs.test.ts checks they agree) */
export const ATTENDANT_SCALE = 0.78;
function dais(fr: Frame): Mass[] { // the throne platform carried by the bearers (B): a moulded slab on lion feet (C); unit = length
  const feet: SDF[] = []; for (const x of [-0.46, -0.16, 0.16, 0.46]) feet.push(fr.ell(x, 0.022, 0.028, 0.022));
  return [M(feet, { amp: 0.55, colour: P.yellowOchre, round: 0.01, detail: fr.det(x => pleats(x, 0.01, 0.1)) }),
    M([fr.poly([[-0.5, 0.035], [0.5, 0.035], [0.5, 0.095], [-0.5, 0.095]])], { amp: 0.7, lift: 0.04, colour: P.yellowOchre, round: 0.012, groove: 0.08, detail: fr.det((x, y) => (y > 0.075 ? 0.08 : y < 0.05 ? 0.04 : 0)) })];
}
/** thickness of the ledge between tiers of throne-bearers, as a fraction of its length (C) */
export const RAIL_T = 0.025;
function rail(fr: Frame): Mass[] { // the ledge a tier of throne-bearers holds up and the tier above stands on (C); unit = length
  return [M([fr.poly([[-0.5, 0], [0.5, 0], [0.5, RAIL_T], [-0.5, RAIL_T]])], { amp: 0.7, colour: STONE, round: 0.006, detail: fr.det((x, y) => (y > RAIL_T * 0.7 ? 0.06 : 0)) })];
}
/** suffix of a blocked-out (unfinished) variant of any kind: the outline cut back and the masses roughed out as planes,
 *  no modelling detail, no incised lines, no paint; claw-chisel marks on the surfaces (the Unfinished Gate figures'
 *  stage, RECOLLECTION, NOT SEEN: C) */
export const ROUGH = '~rough';
export const baseKind = (kind: string) => (kind.endsWith(ROUGH) ? kind.slice(0, -ROUGH.length) : kind);
export function roughOut(d: FigureDef): FigureDef {
  const claw = (x: number, y: number) => pleats(x * 0.7 + y * 0.7, 0.02, 0.05);
  return { bounds: d.bounds, incisions: [], masses: d.masses.filter(m => !m.paintOnly).map(m => ({ ...m, colour: STONE, detail: claw, dome: 0, groove: 0, smooth: 0,
    edge: Math.max(m.edge ?? 0.45, 0.8), round: Math.max(m.round ?? 0.02, 0.025), lift: (m.lift ?? 0) * 0.5, amp: m.amp * 0.85 })) };
}
function throne(fr: Frame): Mass[] { // throne and footstool (audience relief, B; lion-paw feet and form C)
  const leg = (x: number) => [fr.seg(x, 0.04, x, 0.36, 0.014), fr.ell(x + 0.01, 0.025, 0.025, 0.022)];
  return [M([...leg(-0.08), ...leg(0.08), fr.seg(-0.09, 0.36, 0.1, 0.36, 0.012), fr.seg(-0.09, 0.2, 0.09, 0.2, 0.006), fr.seg(-0.1, 0.36, -0.12, 0.72, 0.012), fr.seg(0.14, 0.02, 0.28, 0.02, 0.02), fr.seg(0.16, 0.0, 0.16, 0.04, 0.01), fr.seg(0.26, 0.0, 0.26, 0.04, 0.01)],
    { amp: 0.5, colour: P.yellowOchre, round: 0.01 })];
}

// ---------------- delegations (RELIEFS_AND_COLOUR §1c; dress per delegation NOT SEEN → C) ----------------
export interface Delegation { n: string; people: string; usher: 'persian' | 'mede'; dress: Dress; head: Head; gifts: Prop[]; animal?: string; tier: 'B' | 'C'; note: string }
export const DELEGATIONS: Delegation[] = [
  { n: 'I', people: 'Medes', usher: 'persian', dress: 'median', head: 'cap', gifts: ['amphora', 'textile', 'bracelets'], animal: 'horse', tier: 'B', note: 'vessels and garments (B); bracelets (Oxus extract); horse (MATCULT: 7 delegations bring horses, B)' },
  { n: 'II', people: 'Elamites', usher: 'mede', dress: 'long', head: 'fillet', gifts: ['cubs', 'bowl'], animal: 'lioness', tier: 'B', note: 'lioness with cubs (B/C; number II RECOLLECTION)' },
  { n: 'III', people: 'Armenians', usher: 'persian', dress: 'median', head: 'tallcap', gifts: ['amphora', 'textile'], animal: 'horse', tier: 'B', note: 'bridled stallion; vessel with griffin handles (B)' },
  { n: 'IV', people: 'Arians', usher: 'mede', dress: 'median', head: 'hood', gifts: ['bowl', 'skin'], animal: 'camel_bactrian', tier: 'C', note: 'vessels, Bactrian camel? (RECOLLECTION, C)' },
  { n: 'V', people: 'Babylonians', usher: 'persian', dress: 'long', head: 'tallcap', gifts: ['bowl', 'textile'], animal: 'bull', tier: 'B', note: 'humped bull; vessels, textiles (B/C)' },
  { n: 'VI', people: 'Lydians', usher: 'mede', dress: 'long', head: 'tallcap', gifts: ['amphora', 'bracelets', 'phiale'], tier: 'B', note: 'metal vessels, bracelets (B); chariot RECOLLECTION (C, not drawn)' },
  { n: 'VII', people: 'Arachosians', usher: 'persian', dress: 'median', head: 'hood', gifts: ['bowl', 'skin'], animal: 'camel_bactrian', tier: 'B', note: 'bowls, Bactrian camel, skin of a wild cat (B/C)' },
  { n: 'VIII', people: 'Cilicians', usher: 'mede', dress: 'short', head: 'band', gifts: ['bowl', 'textile'], animal: 'ram', tier: 'B', note: 'two fat-tailed rams (B)' },
  { n: 'IX', people: 'Cappadocians', usher: 'persian', dress: 'median', head: 'cap', gifts: ['textile', 'bowl'], animal: 'horse', tier: 'C', note: 'horse, garments (RECOLLECTION; horse B per MATCULT)' },
  { n: 'X', people: 'Egyptians', usher: 'mede', dress: 'long', head: 'bare', gifts: ['textile', 'bowl'], tier: 'C', note: 'gifts NOT SEEN (RECOLLECTION: the panel is now largely destroyed); generic vessels and cloth (C)' },
  { n: 'XI', people: 'Scythians (Saka tigraxauda)', usher: 'persian', dress: 'median', head: 'pointed', gifts: ['bracelets', 'textile'], animal: 'horse', tier: 'C', note: 'bracelets (extract); horse, garments (RECOLLECTION; horse B per MATCULT)' },
  { n: 'XII', people: 'Ionians', usher: 'mede', dress: 'long', head: 'bare', gifts: ['textile', 'bowl'], tier: 'C', note: 'textiles, bowls (RECOLLECTION, C)' },
  { n: 'XIII', people: 'Bactrians', usher: 'persian', dress: 'median', head: 'bare', gifts: ['bowl', 'phiale'], animal: 'camel_bactrian', tier: 'C', note: 'Bactrian camel (C)' },
  { n: 'XIV', people: 'Gandarans', usher: 'mede', dress: 'wrap', head: 'fillet', gifts: ['spears2', 'shield'], animal: 'bull', tier: 'C', note: 'humped bull (B/C); spears, shield (RECOLLECTION, C)' },
  { n: 'XV', people: 'Parthians', usher: 'persian', dress: 'median', head: 'hood', gifts: ['bowl', 'phiale'], animal: 'camel_bactrian', tier: 'C', note: 'Bactrian camel, vessels (RECOLLECTION, C)' },
  { n: 'XVI', people: 'Sagartians', usher: 'mede', dress: 'median', head: 'hood', gifts: ['textile', 'bowl'], animal: 'horse', tier: 'C', note: 'horse, garments (RECOLLECTION; horse B per MATCULT)' },
  { n: 'XVII', people: 'Sogdians? (Saka)', usher: 'persian', dress: 'median', head: 'hood', gifts: ['bracelets', 'textile'], animal: 'horse', tier: 'C', note: 'identification uncertain; bracelets? (C); horse (two Saka groups bring horses, MATCULT B)' },
  { n: 'XVIII', people: 'Indians', usher: 'mede', dress: 'wrap', head: 'fillet', gifts: ['basket', 'axe'], animal: 'wild_ass', tier: 'C', note: 'baskets, axes, wild ass (RECOLLECTION, C); an axe on the N façade was sampled (B)' },
  { n: 'XIX', people: 'Skudrians / Thracians', usher: 'persian', dress: 'median', head: 'cap', gifts: ['spears2', 'shield'], animal: 'horse', tier: 'C', note: 'horse, spears (RECOLLECTION; horse B per MATCULT)' },
  { n: 'XX', people: 'Arabs', usher: 'mede', dress: 'long', head: 'fillet', gifts: ['textile'], animal: 'dromedary', tier: 'B', note: 'dromedary (B/C)' },
  { n: 'XXI', people: 'Drangians', usher: 'persian', dress: 'short', head: 'bare', gifts: ['spears2', 'shield'], animal: 'bull', tier: 'C', note: 'bull, spear, shield (RECOLLECTION, C)' },
  { n: 'XXII', people: 'Libyans', usher: 'mede', dress: 'long', head: 'bare', gifts: ['spears2'], animal: 'ibex', tier: 'C', note: 'ibex (kudu?), chariot (RECOLLECTION, C; chariot not drawn)' },
  { n: 'XXIII', people: 'Ethiopians', usher: 'persian', dress: 'wrap', head: 'bare', gifts: ['lidded', 'tusk'], animal: 'okapi', tier: 'B', note: 'lidded bowl, elephant tusk, okapi (B)' },
];

// ---------------- the kinds ----------------
export interface KindInfo { tier: 'A' | 'B' | 'C'; src: string; note: string; group: 'person' | 'animal' | 'plant' | 'emblem' | 'group' | 'ornament'; w: number }
const K = (tier: KindInfo['tier'], src: string, group: KindInfo['group'], w: number, note: string): KindInfo => ({ tier, src, group, w, note });
/** every figure kind the relief system can carve; `tier` = evidence for the motif (the carving itself is always C);
 *  `w` = advance width along a register in figure heights */
export const FIGURE_KINDS: Record<string, KindInfo> = {
  guard: K('B', 'MATCULT-R;RELIEF-R;IR-APAD', 'person', 0.62, 'Persian guard: pleated court robe, fluted headgear, spear with a spherical (pomegranate/apple) butt, bow and quiver (IR-CLOTH, SUSA-ARCH, IR-IMM: B); pose C'),
  mede_guard: K('B', 'MATCULT-R;RELIEF-R', 'person', 0.62, 'guard in Median riding dress: soft cap (NS, C), tunic, trousers, akinakes at the right thigh (B), spear (B), bow case (gorytos NS, C)'),
  persian: K('B', 'MATCULT-R;RELIEF-R;IR-APAD', 'person', 0.62, 'Persian noble in the court robe and fluted headgear (B); the flower held before the face is NOT SEEN in the research (C)'),
  mede: K('B', 'MATCULT-R;RELIEF-R;IR-APAD', 'person', 0.62, 'Median noble: soft cap (NS, C), sleeved tunic, trousers, akinakes (B), kandys over the shoulders on some (B); flower C'),
  usher: K('B', 'RELIEF-R;IR-APAD', 'person', 0.62, 'usher leading a delegation by the hand (B: "each led by the hand by a Persian or Median usher"); which dress leads which delegation NOT FOUND (alternating, C); staff C'),
  delegate: K('B', 'RELIEF-R;MATCULT-R;IR-APAD', 'person', 0.62, 'delegation member with gifts (per-delegation gifts and tiers in DELEGATIONS; dress per delegation NOT SEEN, C)'),
  servant: K('B', 'SI-ARCH;ISAC-PA;WP-EXT;FARROKH', 'person', 0.6, 'stair servant climbing with a kid, a wineskin, a covered dish or a bowl; Persian/Median dress alternating (Tachara/Hadish stair rows: B)'),
  king: K('B', 'RELIEF-R;IR-APAD;MATCULT-R;TREAS-AUD', 'person', 1.1, 'king enthroned with footstool (audience relief, Tilia 1972 via Iranica: B); a long staff in the right hand, its foot on the ground before the footstool, and a lotus in the left (TREAS-AUD, B; the staff slanting forward is RECOLLECTION, C); red/purple robe with blue hem (IR-CLOTH: B); crown form C'),
  crown_prince: K('B', 'RELIEF-R;IR-APAD;TREAS-AUD', 'person', 0.62, 'crown prince standing behind the throne, a lotus in his hand (TREAS-AUD, B); dress C'),
  official: K('B', 'RELIEF-R;TREAS-AUD', 'person', 0.62, 'the Median official before the king, bowing, his right hand raised before his mouth (TREAS-AUD, B); the lean, the dress colours and the drawing C'),
  king_walking: K('B', 'WP-EXT;ISAC-PA;SI-ARCH', 'person', 0.62, 'king walking with attendants (door-jamb reliefs of the Tachara, Harem, Tripylon: B); staff C'),
  attendant: K('B', 'WP-EXT;ISAC-PA;SI-ARCH', 'person', 0.62, 'attendant with parasol, fly-whisk, towel or perfume flask (Tachara / Harem jambs: B); forms C'),
  lance_bearer: K('B', 'WP-EXT;ISAC-PA', 'person', 0.62, 'lance-bearer with a wicker shield (Tachara W rooms: B); shield form C'),
  hero: K('B', 'SI-ARCH;ISAC-PA;BRIT-H100;IR-PERS', 'group', 0.95, 'royal hero stabbing a rampant beast (Harem, Hall of 100 Columns, Tachara jambs: B): seed % 3 = lion, bull, or the lion-headed winged monster ("griffin", B) drawn as a horned, winged lion (form C); composition C'),
  king_attendants: K('B', 'ISAC-PA;FARROKH;SI-ARCH;WP-EXT', 'group', 0.85, 'the king walking, an attendant behind him holding a parasol over his head and (seed 0 / 1) a second with a fly-whisk / towel (Harem S, Hadish NW, Tachara, Tripylon doorways: B); crown, staff, scale of the attendants (hierarchic, r_jamb_relief.attendant_scale) and forms C'),
  bearer: K('B', 'SI-ARCH;BRIT-H100;IR-PERS', 'person', 0.62, 'throne-bearer: a representative of a subject people lifting the throne platform above his head (Tripylon E jamb, Hall of 100 Columns S jambs: B); dress per people after DELEGATIONS (seed = delegation, C)'),
  dais: K('B', 'SI-ARCH;BRIT-H100', 'ornament', 1.0, 'the throne platform carried by the bearers (B); mouldings, lion feet and paint C; unit = its length'),
  rail: K('C', 'SI-ARCH;BRIT-H100;RECON', 'ornament', 1.0, 'the ledge each lower tier of throne-bearers holds up and the tier above stands on: the tiers are attested (B), the ledge between them is RECOLLECTION, NOT SEEN (C); plain, unpainted; unit = its length'),
  horse: K('B', 'RELIEF-R;MATCULT-R', 'animal', 0.95, SPECIES.horse.note),
  bull: K('B', 'RELIEF-R', 'animal', 0.95, SPECIES.bull.note),
  camel_bactrian: K('B', 'RELIEF-R;MATCULT-R', 'animal', 0.95, SPECIES.camel_bactrian.note),
  dromedary: K('B', 'RELIEF-R;MATCULT-R', 'animal', 0.95, SPECIES.dromedary.note),
  ram: K('B', 'RELIEF-R', 'animal', 0.55, SPECIES.ram.note),
  lioness: K('B', 'RELIEF-R', 'animal', 0.8, SPECIES.lioness.note),
  ibex: K('C', 'RELIEF-R', 'animal', 0.6, SPECIES.ibex.note),
  okapi: K('B', 'RELIEF-R', 'animal', 0.8, SPECIES.okapi.note),
  wild_ass: K('C', 'RELIEF-R', 'animal', 0.8, SPECIES.wild_ass.note),
  lion_bull: K('B', 'RELIEF-R;IR-APAD', 'group', 1.5, 'lion attacking a bull in the stair spandrels (motif B; the bull rearing with its head turned back and the lion leaping on its hindquarters is C)'),
  cypress: K('B', 'RELIEF-R;SCHMIDT1953', 'plant', 0.2, 'cypress separating the delegations (B); scale-leaf rendering C'),
  palm: K('B', 'IR-PERS;SI-ARCH;COMMONS-TRIP', 'plant', 0.5, 'palm beside the seated sphinxes (Tripylon central panel, B); form C'),
  winged_disc: K('B', 'IR-PERS;SI-ARCH;COMMONS-TRIP;RELIEF-R', 'emblem', 1.3, 'winged disc (Tripylon panel, B); feather colours after the pigments of the Hall of 100 Columns winged figure (Lerner 2024, B), mapping C'),
  sphinx: K('B', 'IR-PERS;SI-ARCH;COMMONS-TRIP', 'emblem', 0.8, 'seated winged sphinx (Tripylon panel, B); human head with crown, wing form C'),
  incense_burner: K('B', 'TREAS-AUD;MATCULT-R', 'plant', 0.2, 'tall incense stand before the king: two stand between the king and the official on the Treasury audience relief (TREAS-AUD, B); form C'),
  weapon_bearer: K('B', 'TREAS-AUD;RELIEF-R', 'person', 0.62, 'the royal weapon-bearer behind the throne on the audience relief: a Mede with a battle-axe and a bow case (TREAS-AUD: "a Mede with battle-axe and quiver", B); the axe held upright, the case at the hip and the dress C'),
  canopy: K('C', 'TREAS-AUD;RECON', 'ornament', 1.0, 'the canopy (baldachin) over the audience scene, its edge a band across the top of the panel: moulding, rosette strip, lion frieze and fringe of tassels. RECOLLECTION of the Treasury audience reliefs (Tilia 1972), NOT SEEN, verify (C); rows, sizes and paint C; unit = one segment'),
  king_worship: K('B', 'NR-ACHAEMENICA;NR-IRANICA;WP-NR', 'person', 0.62, 'the king on the stepped podium of the Naqsh-e Rustam tomb reliefs, right hand raised toward the fire altar, the bow in his left hand resting on the ground (B); crown and robe paint C (as the Persepolis king, IR-CLOTH)'),
  winged_figure: K('B', 'NR-ACHAEMENICA;NR-IRANICA;WP-NR', 'emblem', 1.3, 'the figure rising from the winged ring above the king (Naqsh-e Rustam tombs, B): bust with a raised hand and a ring (C) over the winged disc of the Tripylon panel (form C)'),
  fire_altar: K('B', 'NR-ACHAEMENICA;NR-IRANICA;WP-NR', 'emblem', 0.45, 'stepped fire altar with flames before the king (Naqsh-e Rustam tombs, B); proportions and paint C'),
  moon: K('B', 'NR-ACHAEMENICA;WP-NR', 'emblem', 1.0, 'the moon above the altar, a disc with a crescent (Naqsh-e Rustam tombs, B; form C); unit = diameter'),
  rosette: K('C', 'RECON', 'ornament', 1.0, 'twelve-petalled rosette of the border bands (motif from reconstructions, C); unit = diameter'),
};

const ARM_SPEAR: Pick<Human, 'near' | 'far'> = { near: { elbow: [0.035, 0.56], hand: [0.118, 0.575] }, far: { elbow: [0.025, 0.6], hand: [0.118, 0.64] } };
const ARM_FLOWER: Pick<Human, 'near' | 'far'> = { near: { elbow: [0.035, 0.56], hand: [0.105, 0.61] }, far: { elbow: [-0.02, 0.56], hand: [0.03, 0.5] } };
const ARM_CARRY: Pick<Human, 'near' | 'far'> = { near: { elbow: [0.04, 0.56], hand: [0.115, 0.57] }, far: { elbow: [0.035, 0.58], hand: [0.105, 0.6] } };

/** The figure definition for a kind and seed (deterministic); `kind~rough` = its blocked-out variant (roughOut). */
export function figureDef(kind: string, seed: number): FigureDef {
  if (kind.endsWith(ROUGH)) return roughOut(figureDef(baseKind(kind), seed));
  const rng = new Rng(seed + 1, 'relief-fig-' + kind), fr = new Frame();
  const g = rng.pick(GARMENTS), g2 = rng.pick(GARMENTS.filter(c => c !== g)), robe = rng.pick(ROBES);
  const hat = rng.pick([P.yellowOchre, P.egyptianBlue, P.white, P.yellowOchre]);
  const persianDress = (extra: Partial<Human>): Human => ({ dress: 'persian', head: 'fluted', beard: 'long', garment: robe, garment2: P.egyptianBlue, headCol: hat, ...ARM_FLOWER, ...extra });
  const medianDress = (extra: Partial<Human>): Human => ({ dress: 'median', head: 'cap', beard: 'long', garment: g, garment2: g2, akinakes: true, ...ARM_FLOWER, ...extra });
  const withProps = (h: Human, props: [Prop, 'near' | 'far'][], col: C3 = P.gold): FigureDef => {
    const front: Mass[] = [], farArm: Mass[] = [];
    for (const [pk, side] of props) { const a = side === 'near' ? h.near : h.far!; (side === 'near' || pk === 'spear' || pk === 'wicker' ? front : farArm).push(...prop(fr, pk, a.hand[0], a.hand[1], col)); }
    return human(fr, h, { front, farArm });
  };
  switch (kind) {
    case 'guard': return withProps(persianDress({ ...ARM_SPEAR, quiver: true, bow: true, headCol: rng.pick([P.yellowOchre, g2]), pattern: PATTERNED_KINDS.includes('guard') }), [['spear', 'near']], rng.chance(0.5) ? P.gold : P.white);
    case 'mede_guard': return withProps(medianDress({ ...ARM_SPEAR, gorytos: true }), [['spear', 'near']], rng.chance(0.5) ? P.gold : P.white);
    case 'persian': return withProps(persianDress({}), [['lotus', 'near']]);
    case 'mede': return withProps(medianDress({ kandys: rng.chance(0.5) }), [['lotus', 'near']]);
    case 'crown_prince': return withProps(persianDress({ garment: P.purple, garment2: P.egyptianBlue, near: { elbow: [0.035, 0.57], hand: [0.105, 0.62] } }), [['lotus', 'near']]);
    case 'official': { // the Median official bowing before the king, his right hand raised before his mouth (TREAS-AUD, B): the
      // whole figure leans 4° forward from the feet (C); the far hand hangs at the side
      const lf = new Frame(0, 0, -0.07), b = human(lf, medianDress({ kandys: true, near: { elbow: [0.06, 0.62], hand: [0.085, 0.74] }, far: { elbow: [0.0, 0.56], hand: [0.03, 0.47] } }));
      return { masses: b.masses, incisions: b.incisions };
    }
    case 'weapon_bearer': { // a Mede with a battle-axe held upright in the near hand and a bow case at the hip (TREAS-AUD, B; C)
      const h = medianDress({ gorytos: true, near: { elbow: [0.045, 0.57], hand: [0.105, 0.6] }, far: { elbow: [0.0, 0.56], hand: [0.03, 0.47] } });
      const hx = 0.105, hy = 0.6, haft = M([fr.seg(hx, hy - 0.2, hx, hy + 0.26, 0.0055)], { amp: 0.84, lift: 0.12, colour: P.yellowOchre, round: 0.006 });
      const blade = M([fr.poly([[hx, hy + 0.2], [hx + 0.055, hy + 0.17], [hx + 0.065, hy + 0.215], [hx + 0.055, hy + 0.26], [hx, hy + 0.235]])], { amp: 0.86, lift: 0.12, colour: P.white, round: 0.005, groove: 0.06 });
      const butt = M([fr.poly([[hx, hy + 0.205], [hx - 0.03, hy + 0.215], [hx - 0.034, hy + 0.23], [hx, hy + 0.232]])], { amp: 0.84, lift: 0.1, colour: P.white, round: 0.004 });
      return human(fr, h, { front: [haft, blade, butt] });
    }
    case 'usher': { // leads the delegate behind him by the hand: the far (rear) arm reaches back; staff in the near hand (C)
      const d = DELEGATIONS[seed % DELEGATIONS.length], h = (d.usher === 'persian' ? persianDress : medianDress)({ near: { elbow: [0.045, 0.56], hand: [0.105, 0.62] }, far: { elbow: [-0.08, 0.56], hand: [-0.2, 0.55] } });
      return withProps(h, [['staff', 'near']]);
    }
    case 'delegate': { // seed = delegation index × 10 + member (0 = led by the hand, 1 = animal handler, 2+ = gift bearer)
      const d = DELEGATIONS[Math.floor(seed / 10) % DELEGATIONS.length], m = seed % 10;
      const h: Human = { dress: d.dress, head: d.head, beard: d.dress === 'wrap' ? 'none' : 'short', garment: g, garment2: g2, akinakes: d.dress === 'median', ...ARM_CARRY };
      if (m === 0) { h.near = { elbow: [0.07, 0.57], hand: [0.2, 0.555] }; return withProps(h, [[d.gifts[0], 'far']], P.gold); } // hand held forward by the usher
      if (m === 1 && d.animal) { h.near = { elbow: [-0.02, 0.56], hand: [-0.1, 0.5] }; h.far = { elbow: [0.045, 0.58], hand: [0.11, 0.6] }; return withProps(h, [['leash', 'near'], [d.gifts[(m + 1) % d.gifts.length], 'far']]); }
      return withProps(h, [[d.gifts[m % d.gifts.length], 'near']], rng.chance(0.5) ? P.gold : P.white);
    }
    case 'servant': { // seed parity: Persian / Median dress (alternating, B); seed/2 picks the burden
      const load = (['kid', 'wineskin', 'dish', 'bowl'] as Prop[])[Math.floor(seed / 2) % 4];
      const base = seed % 2 ? medianDress({ akinakes: false, head: 'hood', ...ARM_CARRY }) : persianDress({ head: 'band', beard: 'short', ...ARM_CARRY });
      if (load === 'wineskin') base.near = { elbow: [0.05, 0.72], hand: [0.03, 0.82] };
      return withProps({ ...base, stride: 1.1 }, [[load, 'near']], P.gold);
    }
    case 'king': { // enthroned: royal robe red/purple with a blue hem (B); crown, sceptre and flower (C)
      const kf = new Frame(0.02, 0);
      const h: Human = { dress: 'royal', head: 'crown', beard: 'long', garment: P.purple, garment2: P.egyptianBlue, seated: true, royal: true, near: { elbow: [0.065, 0.57], hand: [0.16, 0.6] }, far: { elbow: [0.02, 0.58], hand: [0.1, 0.66] } };
      // the long staff in the right (near) hand, slanting forward to the ground before the footstool, gilded, a knob at the top
      // (TREAS-AUD: staff and lotus, B; the slant RECOLLECTION, C; D-204: was a short sceptre)
      const staff = [M([kf.seg(0.33, 0.005, 0.103, 0.8, 0.0065)], { amp: 0.86, lift: 0.12, colour: P.gold, round: 0.006, groove: 0.06 }), M([kf.circ(0.1, 0.81, 0.012)], { amp: 0.9, lift: 0.1, colour: P.gold, round: 0.008 })];
      const b = human(kf, h, { front: staff, farArm: prop(kf, 'lotus', 0.1, 0.66, P.gold) });
      const robe = b.masses.find(m => m.colour === P.purple && !m.paintOnly); if (robe) robe.colour = kf.col((x, y) => (y < 0.08 || (x > 0.19 && y < 0.37) ? P.egyptianBlue : P.purple));
      return { masses: [...throne(new Frame(0, 0)), ...b.masses], incisions: b.incisions };
    }
    case 'king_walking': return withProps(persianDress({ head: 'crown', garment: P.purple, garment2: P.egyptianBlue, royal: true, near: { elbow: [0.05, 0.56], hand: [0.13, 0.58] } }), [['staff', 'near'], ['lotus', 'far']]);
    case 'attendant': { const pk = (['parasol', 'whisk', 'towel', 'flask'] as Prop[])[seed % 4];
      const h = (seed % 2 ? medianDress : persianDress)({ beard: seed % 3 ? 'none' : 'short', head: seed % 2 ? 'cap' : 'band', near: pk === 'parasol' || pk === 'whisk' ? { elbow: [0.05, 0.62], hand: [0.1, 0.72] } : ARM_CARRY.near });
      return withProps(h, [[pk, 'near']], P.gold); }
    case 'lance_bearer': return withProps(persianDress({ ...ARM_SPEAR, head: 'band' }), [['wicker', 'near'], ['shield', 'far']]);
    case 'king_worship': return withProps(persianDress({ head: 'crown', garment: P.purple, garment2: P.egyptianBlue, royal: true, stride: 0.7, near: { elbow: [0.07, 0.66], hand: [0.135, 0.79] }, far: { elbow: [0.035, 0.53], hand: [0.085, 0.46] } }), [['bow', 'far']]);
    case 'winged_figure': { // bust rising from the winged ring: hips at the ring, the lower robe hidden by the tail (C)
      const S = 0.55, bf = new Frame(0, 0.5 - 0.49 * S, 0, S);
      const b = human(bf, persianDress({ head: 'crown', garment: P.egyptianBlue, garment2: P.yellowOchre, near: { elbow: [0.07, 0.66], hand: [0.13, 0.78] }, far: { elbow: [0.03, 0.58], hand: [0.1, 0.62] } }), { front: [M([diff(bf.circ(0.1, 0.62, 0.035), bf.circ(0.1, 0.62, 0.02))], { amp: 0.8, lift: 0.1, colour: P.gold, round: 0.01 })] });
      // a longer feathered tail than the Tripylon disc's, covering the figure's lower robe (C)
      const tail = M([fr.spoly([[-0.09, 0.4], [0.09, 0.4], [0.13, 0.2], [0.05, 0.23], [0, 0.18], [-0.05, 0.23], [-0.13, 0.2]], 3)], { amp: 0.62, lift: 0.06, colour: P.egyptianBlue, round: 0.02, detail: fr.det(x => pleats(x, 0.025, 0.14)) });
      return { masses: [...b.masses, tail, ...wingedDisc(fr)], incisions: b.incisions };
    }
    case 'fire_altar': return { masses: fireAltar(fr) };
    case 'moon': return { masses: [M([diff(fr.circ(0, 0.5, 0.5), fr.circ(0.16, 0.56, 0.42))], { amp: 0.7, colour: P.yellowOchre, round: 0.03, groove: 0.1 }), M([diff(fr.circ(0, 0.5, 0.5), fr.circ(0, 0.5, 0.44))], { amp: 0.6, colour: STONE, round: 0.02 })] };
    case 'hero': { // the royal hero grasps the rampant beast and stabs it in the belly (composition C); seed % 3: lion, bull,
      // monster (a lion with bull's horns and a wing: the "lion-headed monster / griffin" of the Harem E door, form C)
      const kindOf = (['lion', 'bull', 'monster'] as const)[seed % 3], monster = kindOf === 'monster';
      const beast: Species = monster ? { ...SPECIES.lion, horns: 'bull', mane: undefined, note: 'monster' } : SPECIES[kindOf], lean = 1.15;
      const q = quadruped(standing(beast, lean, 1.0, 0.44, true, 0.95), beast, { lean, fore: 'reach', jawOpen: true, neckAng: 30, headAng: beast.feet === 'paw' ? -5 : -40 });
      const extra: Mass[] = [];
      if (monster) { const wf = new Frame(q.shoulder[0], q.shoulder[1], -0.35, 0.55, true); // wing raised from the shoulder, drawn behind the body
        extra.push(M([wf.spoly([[-0.04, -0.02], [0.05, 0.05], [0.02, 0.2], [-0.1, 0.4], [-0.2, 0.46], [-0.19, 0.33], [-0.12, 0.15]], 4)],
          { amp: 0.6, lift: 0.08, colour: STONE, round: 0.03, groove: 0.1, detail: wf.det((x, y) => feathers(x * 0.8 + y * 0.6, y * 0.8 - x * 0.6, 0.03, 0.04, 0.2)) })); }
      const b = human(fr, persianDress({ head: 'crown', garment: P.purple, garment2: P.egyptianBlue, royal: true, near: { elbow: [0.07, 0.5], hand: [0.18, 0.47] }, far: { elbow: [0.07, 0.68], hand: [0.18, 0.76] } }), { front: prop(fr, 'dagger', 0.18, 0.47, P.white) });
      return { masses: [...extra, ...q.masses, ...b.masses], incisions: [...q.incisions, ...b.incisions] };
    }
    case 'king_attendants': { // the king walking under a parasol held by an attendant behind him; seed 0: a fly-whisk bearer
      // behind that, 1: a towel bearer, 2: none. Attendants at the hierarchic scale (C); back to front: second attendant,
      // parasol bearer, parasol, king
      const AS = ATTENDANT_SCALE, kf = new Frame(0, 0), pf = new Frame(-0.3, 0, 0, AS), sf = new Frame(-0.52, 0, 0, AS);
      const out: Mass[] = [], incs: Incision[] = [];
      const second = (['whisk', 'towel'] as Prop[])[seed % 3];
      if (second) { const a = human(sf, persianDress({ head: 'band', beard: 'none', near: second === 'whisk' ? { elbow: [0.05, 0.62], hand: [0.1, 0.72] } : ARM_CARRY.near }), { front: prop(sf, second, second === 'whisk' ? 0.1 : ARM_CARRY.near.hand[0], second === 'whisk' ? 0.72 : ARM_CARRY.near.hand[1], P.gold) });
        out.push(...a.masses); incs.push(...a.incisions); }
      const pb = human(pf, persianDress({ head: 'band', beard: 'none', near: { elbow: [0.06, 0.62], hand: [0.11, 0.7] }, far: { elbow: [0.05, 0.66], hand: [0.105, 0.79] } }));
      out.push(...pb.masses); incs.push(...pb.incisions);
      // parasol: the pole from the bearer's hands, leaning forward over the king's head; a fluted canopy with a finial (C)
      const [hx, hy] = pf.p(0.11, 0.66), top: [number, number] = [-0.06, 1.1];
      out.push(M([fr.seg(hx, hy, top[0], top[1], 0.0065)], { amp: 0.8, lift: 0.12, colour: P.yellowOchre, round: 0.006 }));
      out.push(M([fr.spoly([[top[0] - 0.24, top[1] - 0.005], [top[0] + 0.22, top[1] - 0.005], [top[0] + 0.14, top[1] + 0.045], [top[0], top[1] + 0.07], [top[0] - 0.16, top[1] + 0.045]], 3), fr.circ(top[0], top[1] + 0.08, 0.012)],
        { amp: 0.72, lift: 0.08, colour: P.egyptianBlue, round: 0.014, groove: 0.08, detail: fr.det(x => flutes(x - top[0], 0.03, 0.12)) }));
      const k = human(kf, persianDress({ head: 'crown', garment: P.purple, garment2: P.egyptianBlue, royal: true, near: { elbow: [0.05, 0.56], hand: [0.13, 0.58] } }), { front: prop(kf, 'staff', 0.13, 0.58, P.gold), farArm: prop(kf, 'lotus', ARM_FLOWER.far!.hand[0], ARM_FLOWER.far!.hand[1], P.gold) });
      out.push(...k.masses); incs.push(...k.incisions);
      return { masses: out, incisions: incs };
    }
    case 'bearer': { // throne-bearer of a subject people, both hands above the head holding up the platform (B); dress C
      const d = DELEGATIONS[seed % DELEGATIONS.length];
      const h: Human = { dress: d.dress, head: d.head, beard: d.dress === 'wrap' ? 'none' : 'short', garment: g, garment2: g2, akinakes: d.dress === 'median', stride: 0.5,
        near: { elbow: [0.085, 0.84], hand: [0.04, 1.0] }, far: { elbow: [-0.07, 0.84], hand: [-0.03, 1.0] } };
      return withProps(h, []);
    }
    case 'dais': return { masses: dais(fr) };
    case 'rail': return { masses: rail(fr) };
    case 'lion_bull': { // the bull rears toward the high end with its head turned back; the lion leaps on its hindquarters
      const bull = SPECIES.bull, lion = SPECIES.lion;
      const qb = quadruped(standing(bull, 0.3, 1.15, 0.12, false, 0.95), bull, { lean: 0.3, fore: 'raised', turnHead: true });
      const ql = quadruped(standing(lion, 0.85, 1.1, -0.5), lion, { lean: 0.85, fore: 'reach', jawOpen: true, neckAng: 10, headAng: -35 });
      return { masses: [...qb.masses, ...ql.masses], incisions: [...qb.incisions, ...ql.incisions] };
    }
    case 'sphinx': { // seated winged lion with a human head (Tripylon panel, B); crown and wing form C
      const lion = { ...SPECIES.lion, mane: undefined }, lean = 0.55;
      const q = quadruped(standing(lion, lean, 1.1, -0.12, false, 0.3), lion, { lean, seated: true, noHead: true, neckAng: 70 });
      const wf = new Frame(q.shoulder[0], q.shoulder[1]);
      const wing = M([wf.spoly([[-0.04, -0.02], [0.05, 0.05], [0.02, 0.2], [-0.1, 0.42], [-0.22, 0.5], [-0.2, 0.36], [-0.12, 0.16]], 4)],
        { amp: 0.66, lift: 0.12, colour: P.egyptianBlue, round: 0.03, groove: 0.1, detail: wf.det((x, y) => feathers(x * 0.8 + y * 0.6, y * 0.8 - x * 0.6, 0.03, 0.04, 0.2)) });
      const hd = humanHead(new Frame(q.poll[0] - 0.005 * 0.9, q.poll[1] - 0.745 * 0.9, 0, 0.9), 'crown', 'long', P.gold);
      return { masses: [...q.masses, wing, ...hd.masses], incisions: [...q.incisions, ...hd.incisions] };
    }
    case 'cypress': return { masses: cypress(fr) };
    case 'palm': return { masses: palm(fr) };
    case 'rosette': return { masses: rosette(fr), bounds: [-0.52, -0.02, 0.52, 1.02] };
    case 'winged_disc': return { masses: wingedDisc(fr) };
    case 'incense_burner': return { masses: incenseBurner(fr) };
    case 'canopy': return { masses: canopy(fr), bounds: [-0.5, 0, 0.5, CANOPY_H] };
    default: {
      const sp = SPECIES[kind]; if (sp) { const q = quadruped(fr, sp); return { masses: q.masses, incisions: q.incisions }; }
      throw new Error(`unknown relief figure kind ${kind}`);
    }
  }
}
/** local bounds of a kind (figure units) */
export function kindBounds(kind: string, seed: number): Box { return defBounds(figureDef(kind, seed)); }
export function defBounds(d: FigureDef): Box {
  if (d.bounds) return d.bounds;
  let b: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const m of d.masses) if (!m.paintOnly) for (const s of m.add) b = [Math.min(b[0], s.b[0]), Math.min(b[1], s.b[1]), Math.max(b[2], s.b[2]), Math.max(b[3], s.b[3])];
  return b;
}
