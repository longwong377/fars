// Seasonal state of the plain, driven by the date (brief §2, §5.3, §9.5 "fields ripen; the river rises and falls").
// Pure functions of the world day index, shared by the renderer (uniforms, the crop-state texture) and the tests.
//
// Calendar: the monthly tables in plain.json (river flow_by_month; crops sow/harvest/height_m) are keyed to the solar
// (Gregorian) months of the modern climate normals; the world clock's day 0 = 1 Nisannu 467 BCE = 17 April (Julian),
// Gregorian day of year 102 (src/world/season.ts). Monthly values sit at mid-month and are interpolated linearly,
// cyclically. Everything here is reconstruction (tier C) built on B-tier calendars (IR-FOODAG, FARS-WHEAT) and the
// A-tier rain regime (WMO-CLINO); per-plot phenology offsets are C.
import { DOY_AT_DAY0, SEASON_TABLE } from '../season';
import { PLAIN } from './data';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
/** 0-based day of year of each mid-month (non-leap Gregorian) */
export const MID_MONTH = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];
export const YEAR = 365;

export const doyOf = (dayIndex: number) => ((((DOY_AT_DAY0 + dayIndex) % YEAR) + YEAR) % YEAR);

/** linear, cyclic interpolation of 12 mid-month values at day of year `doy` */
export function monthly(values: readonly number[], doy: number): number {
  const d = ((doy % YEAR) + YEAR) % YEAR;
  for (let i = 0; i < 12; i++) {
    const a = MID_MONTH[i], b = i < 11 ? MID_MONTH[i + 1] : MID_MONTH[0] + YEAR;
    const dd = d < MID_MONTH[0] ? d + YEAR : d;
    if (dd >= a && dd < b) { const t = (dd - a) / (b - a); return values[i] + (values[(i + 1) % 12] - values[i]) * t; }
  }
  return values[0];
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** cyclic distance-aware window: 1 between doy a and b (a may be > b across the new year), with soft edges of width e */
function window(doy: number, a: number, b: number, e: number) {
  const inside = (x: number) => { const aa = a, bb = b < a ? b + YEAR : b; const xx = x < aa - e ? x + YEAR : x; return smooth(aa - e, aa, xx) * (1 - smooth(bb, bb + e, xx)); };
  return Math.max(inside(doy), inside(doy + YEAR), inside(doy - YEAR));
}

// ---------------------------------------------------------------- rivers
export interface RiverState { flowRel: number; width: number; depth: number; turbid: number; month: string }
/** river flow, width and depth on a day (plain.json flow_by_month, C); `turbid` 1 in the "high, turbid" months */
export function riverState(riverId: 'river_pulvar' | 'river_kur', dayIndex: number): RiverState {
  const f = PLAIN.features.find((q: any) => q.id === riverId);
  const rows = f.flow_by_month as { month: string; flow_rel: number; width_m: number; depth_m: number; state: string }[];
  const doy = doyOf(dayIndex);
  const v = (k: 'flow_rel' | 'width_m' | 'depth_m') => monthly(rows.map(r => r[k]), doy);
  const turbid = monthly(rows.map(r => (/turbid/.test(r.state) ? 1 : 0)), doy);
  return { flowRel: v('flow_rel'), width: v('width_m'), depth: v('depth_m'), turbid, month: MONTHS[Math.min(11, Math.floor(monthIndex(doy)))] };
}
/** fractional month index (0 = Jan 1) of a day of year */
export function monthIndex(doy: number) { const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365]; for (let m = 0; m < 12; m++) if (doy < cum[m + 1]) return m + (doy - cum[m]) / (cum[m + 1] - cum[m]); return 11.999; }

// ---------------------------------------------------------------- fields
/** crop-state rows (the order is the row index used by the terrain shader and the crop instances) */
export const CROP_ROWS = ['barley', 'wheat', 'emmer_spelt', 'sesame', 'fallow', 'orchard_floor', 'vineyard', 'steppe'] as const;
export type CropRow = typeof CROP_ROWS[number];
export interface CropState {
  /** standing crop height (m) */ height: number;
  /** living green cover (0..1) */ green: number;
  /** straw cover (0..1): the ripening or ripe crop while height > 0, stubble after harvest */ straw: number;
  /** freshly ploughed or sown soil (0..1) */ tilled: number;
}
const heights = (crop: string) => { const h = PLAIN.crops[crop].height_m; return MONTHS.map(m => +h[m]); };
/** heights through the growing season: the table's post-harvest zeros are replaced by the peak, so the stand holds its
 *  height until its own (per-plot) harvest day instead of shrinking toward the next month's zero */
const growingHeights = (crop: string) => { const h = heights(crop), peak = h.indexOf(Math.max(...h));
  return h.map((v, i) => { const after = (i - peak + 12) % 12; return v === 0 && after > 0 && after < 6 ? h[peak] : v; }); };
const herb = (doy: number) => { // the uncultivated herb layer (season.ts curve, C)
  const d = ((doy % YEAR) + YEAR) % YEAR;
  for (let i = 1; i < SEASON_TABLE.length; i++) { const a = SEASON_TABLE[i - 1], b = SEASON_TABLE[i]; if (d <= b.doy) { const t = (d - a.doy) / (b.doy - a.doy); return { green: a.green + (b.green - a.green) * t, dry: a.dry + (b.dry - a.dry) * t }; } }
  return SEASON_TABLE[0];
};
/** Winter cereal: tilled and sown around `sow`, heights from plain.json (to the harvest), ripening over [ripe0, ripe1],
 *  cut on `harvest`; the stubble is grazed down from 0.7 to 0.3 cover until the autumn ploughing (C). */
function winterCereal(crop: string, doy: number, sow: number, ripe0: number, ripe1: number, harvest: number): CropState {
  const d = ((doy % YEAR) + YEAR) % YEAR;
  const tableH = monthly(growingHeights(crop), d);
  const beforeHarvest = d < harvest || d >= sow - 14; // growing season wraps the new year
  const tilled = window(d, sow - 14, sow + 12, 4); // ploughing a fortnight before sowing, furrows visible until emergence
  if (beforeHarvest) {
    // from sowing to harvest: height follows the table, but never below the sown state and not before sowing
    const sinceSow = ((d - sow) % YEAR + YEAR) % YEAR;
    const h = d >= sow - 14 && d < sow ? 0 : sinceSow < 20 ? 0.02 * sinceSow / 20 : Math.max(0.02, tableH);
    const ripe = d < sow - 14 ? smooth(ripe0, ripe1, d) : 0;
    const cover = Math.min(1, h / 0.35) * 0.95;
    return { height: h, green: cover * (1 - ripe), straw: cover * ripe, tilled: tilled * (1 - Math.min(1, h / 0.1)) };
  }
  const days = d - harvest; // stubble, grazed from harvest to ploughing
  return { height: 0, green: 0.12 * herb(d).green, straw: Math.max(0.25, 0.75 - days / 220), tilled };
}

export function cropState(row: CropRow, doy: number): CropState {
  const d = ((doy % YEAR) + YEAR) % YEAR;
  switch (row) {
    // barley: sown Nov (IR-FOODAG), harvested May-Jun: here cut on 30 May, ripening from 25 Apr (C)
    case 'barley': return winterCereal('barley', d, 319, 115, 142, 150);
    // wheat: normal sowing 11 Nov-1 Dec in Fars (FARS-WHEAT, B): 22 Nov; harvest Jun-Jul: 27 Jun (C)
    case 'wheat': return winterCereal('wheat', d, 326, 140, 168, 178);
    case 'emmer_spelt': return winterCereal('emmer_spelt', d, 320, 140, 168, 178);
    case 'sesame': { // summer crop, irrigated: sown May, harvested Sep (plain.json crops.sesame, C calendar)
      const h = monthly(heights('sesame'), d), grow = window(d, 128, 262, 3);
      const ripe = smooth(232, 255, d) * grow, cover = Math.min(1, h / 0.6) * 0.9 * grow;
      const stubble = window(d, 262, 330, 10) * 0.35, hb = herb(d);
      return { height: h * grow, green: cover * (1 - ripe) + (1 - grow) * hb.green * 0.35, straw: cover * ripe + stubble, tilled: window(d, 115, 135, 5) };
    }
    case 'fallow': { const hb = herb(d); return { height: 0.12 * hb.green, green: hb.green * 0.45, straw: hb.dry * 0.4, tilled: 0 }; } // grazed weedy fallow: soil shows between the weeds (C)
    case 'orchard_floor': { const hb = herb(d); return { height: 0.15, green: Math.max(0.35, hb.green) * 0.8, straw: hb.dry * 0.2, tilled: 0 }; } // watered ground under trees (C)
    // head-trained vine stocks (about half a metre of old wood) all year; budburst in April (crops.vines leaf_out Apr),
    // shoots and leaves through May and June to ~1.5 m, vintage Sep-Oct, leaves down in November (C). The canopy used to
    // start rising on day 92 (a window edge): on 17 April the rows stood 1.1 m tall and a third green (D-149)
    case 'vineyard': { const leaf = smooth(100, 155, d) * (1 - smooth(300, 330, d)); return { height: 0.5 + leaf, green: 0.6 * leaf, straw: 0.25 * window(d, 300, 335, 8), tilled: window(d, 60, 90, 6) * 0.6 }; }
    case 'steppe': { const hb = herb(d); return { height: 0.2 * hb.green + 0.1 * hb.dry, green: hb.green, straw: hb.dry, tilled: 0 }; }
  }
}
/** the crop-state table: YEAR columns × CROP_ROWS rows, RGBA8 = height/1.5, green, straw, tilled (the shader texture) */
export function cropTable(): Uint8Array {
  const out = new Uint8Array(YEAR * CROP_ROWS.length * 4);
  CROP_ROWS.forEach((row, r) => { for (let d = 0; d < YEAR; d++) { const s = cropState(row, d), i = (r * YEAR + d) * 4;
    out[i] = Math.round(Math.min(1, s.height / 1.5) * 255); out[i + 1] = Math.round(Math.min(1, s.green) * 255); out[i + 2] = Math.round(Math.min(1, s.straw) * 255); out[i + 3] = Math.round(Math.min(1, s.tilled) * 255); } });
  return out;
}
/** per-plot phenology offset (days): sowing and harvest spread over about three weeks between plots (C) */
export const PLOT_OFFSET_DAYS = 12;

// ---------------------------------------------------------------- the river margins (riparian.ts, rivers.ts banks)
/** State of the ground vegetation by the water on a day of year (C: recalled botany, BOTANY-GEN; the species' presence is
 *  in plain.json river_*.riparian `margins`). Common reed (Phragmites): last year's culms stand pale and dry through the
 *  winter and spring and go down as the new growth overtops them in early summer; new shoots from late March, about half a
 *  metre by mid-April, 2-3 m by July, plumes from August, brown from October. Rushes and sedges at the wet edge stay green
 *  but for their tips in the dry summer. Bank grasses on the moist upper bank green from the winter rains, flower in
 *  May, and dry about a month after the steppe (from July). */
export interface MarginState {
  /** new reed shoots (m) and their green share (0..1: brown in autumn) */ reedNew: number; reedGreen: number;
  /** last year's culms still standing (0..1) and their height (m); plume stage (0..1) of the current year's culms */ reedOld: number; reedOldH: number; plume: number;
  /** rushes: height (m), green share */ rushH: number; rushGreen: number;
  /** bank grass: height (m), green share (the rest straw) */ grassH: number; grassGreen: number;
}
export function marginState(doy: number): MarginState {
  const d = ((doy % YEAR) + YEAR) % YEAR;
  const s = (a: number, b: number) => smooth(a, b, d);
  // new reed culms: emerge ~day 80, 0.5 m by ~day 102, 1.3 m by mid-May, 2.4 m by early July, 2.7 m from August
  const reedNew = d < 80 || d > 345 ? 0 : 2.7 * (0.19 * s(80, 104) + 0.3 * s(104, 140) + 0.4 * s(140, 185) + 0.11 * s(185, 215));
  const reedGreen = 1 - s(275, 320); // brown from October, dry by mid-November (they stand as next year's old culms)
  // the dry culms go down as the new ones overtop them; about a third of the beds are cut in winter for mats, roofs and
  // fodder (reed roofs: settlement surfaces; C), so at most 0.7 stand
  const reedOld = 0.7 * (d > 345 || d < 80 ? 1 : 1 - 0.85 * s(120, 200));
  const plume = s(215, 245);
  const rushGreen = 1 - 0.35 * s(180, 215) * (1 - s(275, 310));
  const grassGreen = Math.max(0.12, 1 - 0.85 * s(160, 200) * (1 - s(300, 345)));
  const grassH = 0.12 + 0.33 * s(40, 125) * (1 - 0.4 * s(200, 290));
  return { reedNew, reedGreen, reedOld, reedOldH: 2.5, plume, rushH: 0.55 + 0.35 * s(70, 150), rushGreen, grassH, grassGreen };
}

// ---------------------------------------------------------------- trees
/** foliage groups: one phenology per group (species -> group in src/data/trees.json) */
export const TREE_GROUPS = ['plane', 'willow', 'poplar', 'tamarisk', 'pome', 'fig', 'pomegranate', 'mulberry', 'vine', 'oak', 'almond', 'pistachio', 'evergreen_dark', 'evergreen_grey'] as const;
export type TreeGroup = typeof TREE_GROUPS[number];
export interface Foliage { leaf: number; colour: [number, number, number]; blossom: number; blossomColour: [number, number, number] }
const lerp3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];
const SUMMER: Record<TreeGroup, number[]> = { // leaf albedo (linear-ish sRGB), C
  plane: [0.20, 0.30, 0.12], willow: [0.25, 0.31, 0.18], poplar: [0.21, 0.31, 0.13], tamarisk: [0.30, 0.34, 0.24], pome: [0.19, 0.28, 0.11],
  fig: [0.21, 0.31, 0.12], pomegranate: [0.18, 0.28, 0.09], mulberry: [0.19, 0.30, 0.11], vine: [0.24, 0.33, 0.12], oak: [0.20, 0.26, 0.12],
  almond: [0.25, 0.29, 0.15], pistachio: [0.18, 0.26, 0.11], evergreen_dark: [0.10, 0.16, 0.08], evergreen_grey: [0.27, 0.30, 0.21] };
const AUTUMN: Record<TreeGroup, number[]> = {
  plane: [0.48, 0.36, 0.14], willow: [0.55, 0.50, 0.18], poplar: [0.60, 0.52, 0.14], tamarisk: [0.40, 0.36, 0.25], pome: [0.50, 0.36, 0.14],
  fig: [0.55, 0.50, 0.18], pomegranate: [0.60, 0.50, 0.12], mulberry: [0.55, 0.50, 0.15], vine: [0.50, 0.22, 0.10], oak: [0.42, 0.30, 0.15],
  almond: [0.50, 0.30, 0.14], pistachio: [0.55, 0.22, 0.12], evergreen_dark: [0.10, 0.16, 0.08], evergreen_grey: [0.27, 0.30, 0.21] };
/** [leaf-out start, full leaf, colour start, leaf fall end] (doy, Gregorian: day 0 of the world = doy 102), C; evergreens
 *  hold their leaves. Checked for mid-April at ~1,610 m in Fars (D-149; recalled botany is C and says so):
 *  - pomegranate: in Shiraz (Eram garden, ~1,540 m) red young leaves in mid-March, red-green in late March, green leaves
 *    by the last days of March with the flower buds still closed (PUNICA-SHIRAZ, search extract: B for that garden
 *    today); here ~5 days later for the height: out from doy 78, full by 118. It was 100-125: bare on 17 April, wrong;
 *  - fig: bud break in April in the rain-fed orchards of Estahban, Fars, ~1,750 m (FIG-ESTAHBAN, search extract, B);
 *    here from doy 92, so on day 0 a fig carries only its first small leaves (was 100: all but bare);
 *  - plane: foliation lasts about 1.5 months from mid-April in a Platanus orientalis stand (PLATANUS-LAI, search extract,
 *    B, a Turkish stand); on the warmer Marvdasht plain from doy 86 to 124, so on day 0 the planes are in young leaf,
 *    not full leaf (was 82-108);
 *  - mulberry: leaves by April, silkworm rearing from late April (IR-SERICULTURE, search extract, B): unchanged;
 *  - willow, poplar, tamarisk, apple/pear, vine, oak, almond, pistachio: recalled (BOTANY-GEN, C), unchanged. */
const PHENO: Record<TreeGroup, [number, number, number, number] | null> = {
  plane: [86, 124, 300, 340], willow: [75, 100, 305, 340], poplar: [80, 105, 290, 330], tamarisk: [90, 115, 295, 335], pome: [95, 120, 290, 330],
  fig: [92, 130, 290, 325], pomegranate: [78, 118, 295, 330], mulberry: [95, 118, 295, 330], vine: [105, 135, 285, 325], oak: [95, 125, 285, 330],
  almond: [70, 100, 250, 300], pistachio: [90, 115, 280, 320], evergreen_dark: null, evergreen_grey: null };
/** young leaves that are not a lighter green (C on B): the pomegranate's unfold red and turn green over about two weeks
 *  (PUNICA-SHIRAZ); others get lighter, yellower young leaves (the `spring` tint in foliage()) */
const YOUNG_RED: Partial<Record<TreeGroup, [number, number, number]>> = { pomegranate: [0.36, 0.13, 0.07] };
/** blossom window [start, end, edge] (doy), colour and peak share (C): apple and pear Mar-Apr (crops.fruit_trees), wild
 *  almond Feb-Mar, pomegranate May-Jun; a pomegranate's scarlet flowers stand scattered among the leaves (peak 0.45:
 *  at 1 the whole shrub read as a red ball, D-149) */
const BLOSSOM: Partial<Record<TreeGroup, { w: [number, number, number]; c: [number, number, number]; p?: number }>> = {
  pome: { w: [75, 108, 8], c: [0.93, 0.9, 0.88] }, almond: { w: [45, 72, 7], c: [0.92, 0.82, 0.84] }, pomegranate: { w: [130, 175, 10], c: [0.72, 0.1, 0.05], p: 0.45 } };
/** Leaf albedo scale (D-149, C): SUMMER, AUTUMN and YOUNG_RED were chosen by eye in session 3, and in the session-4
 *  renders at high the crowns came out brighter than the sunlit bank sward beside them (Pulvar bank, 10:00: foliage
 *  median Y 0.083, top decile 0.19, sward 0.069), where a tree crown in a photograph reads darker than sunlit grass. A
 *  green leaf reflects about 0.1 at 550 nm and 0.05 in the red and blue (generic leaf optics, recalled: C); the tables
 *  were about 2.5x that. x0.6 keeps their hues and brings the sunlit outer leaves to the upper end of that range (the
 *  shaders' occlusion and the shadow map do the rest). Blossom and bark are unchanged. */
export const LEAF_K = 0.6;
/** Leaf amount, colour and blossom of each group on a day (C phenology; species B from pollen/PF where stated in trees.json). */
export function foliage(g: TreeGroup, doy: number): Foliage {
  const d = ((doy % YEAR) + YEAR) % YEAR;
  const P = PHENO[g], B = BLOSSOM[g];
  const bl = B ? window(d, B.w[0], B.w[1], B.w[2]) * (B.p ?? 1) : 0;
  const blossomColour: [number, number, number] = B ? B.c : [0.93, 0.9, 0.88];
  if (!P) return { leaf: 1, colour: SUMMER[g].map(v => v * LEAF_K) as [number, number, number], blossom: bl, blossomColour };
  const [a, b, c, e] = P;
  const leaf = smooth(a, b, d) * (1 - smooth(c + (e - c) * 0.5, e, d));
  const autumn = smooth(c, c + (e - c) * 0.6, d);
  const spring = 1 - smooth(a, b + 20, d); // young leaves are lighter
  let colour = lerp3(SUMMER[g], AUTUMN[g], autumn);
  colour = lerp3(colour, [colour[0] * 1.25, colour[1] * 1.3, colour[2] * 1.1], spring * leaf);
  const red = YOUNG_RED[g]; if (red) colour = lerp3(colour, red, 1 - smooth(a + 6, a + 26, d)); // red when they unfold, green two to three weeks later
  return { leaf, colour: colour.map(v => v * LEAF_K) as [number, number, number], blossom: bl, blossomColour };
}
/** tree-group state table: TREE_GROUPS.length × 2 texels RGBA (leaf colour + amount; blossom colour + amount) */
export function foliageTable(doy: number): Float32Array {
  const out = new Float32Array(TREE_GROUPS.length * 2 * 4);
  TREE_GROUPS.forEach((g, i) => { const f = foliage(g, doy); out.set([...f.colour, f.leaf], i * 8); out.set([...f.blossomColour, f.blossom], i * 8 + 4); });
  return out;
}
