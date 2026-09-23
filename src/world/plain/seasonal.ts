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
    case 'fallow': { const hb = herb(d); return { height: 0.12 * hb.green, green: hb.green * 0.7, straw: hb.dry * 0.45, tilled: 0 }; } // grazed weedy fallow (C)
    case 'orchard_floor': { const hb = herb(d); return { height: 0.15, green: Math.max(0.35, hb.green) * 0.8, straw: hb.dry * 0.2, tilled: 0 }; } // watered ground under trees (C)
    case 'vineyard': { const leaf = window(d, 110, 300, 18); return { height: 1.5 * (0.35 + 0.65 * leaf), green: 0.55 * leaf, straw: 0.25 * window(d, 300, 335, 8), tilled: window(d, 60, 90, 6) * 0.6 }; } // leaf-out Apr, vintage Sep-Oct (crops.vines, C)
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

// ---------------------------------------------------------------- trees
export const TREE_GROUPS = ['plane', 'willow_poplar', 'tamarisk', 'fruit', 'vine', 'oak', 'almond_pistachio', 'mulberry'] as const;
export type TreeGroup = typeof TREE_GROUPS[number];
export interface Foliage { leaf: number; colour: [number, number, number]; blossom: number; blossomColour: [number, number, number] }
const lerp3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];
const SUMMER: Record<TreeGroup, number[]> = { // leaf albedo (linear-ish sRGB), C
  plane: [0.20, 0.30, 0.12], willow_poplar: [0.24, 0.32, 0.15], tamarisk: [0.30, 0.34, 0.24], fruit: [0.19, 0.28, 0.11], vine: [0.24, 0.33, 0.12],
  oak: [0.20, 0.26, 0.12], almond_pistachio: [0.25, 0.29, 0.15], mulberry: [0.19, 0.30, 0.11] };
const AUTUMN: Record<TreeGroup, number[]> = {
  plane: [0.48, 0.36, 0.14], willow_poplar: [0.55, 0.48, 0.16], tamarisk: [0.40, 0.36, 0.25], fruit: [0.50, 0.36, 0.14], vine: [0.50, 0.22, 0.10],
  oak: [0.42, 0.30, 0.15], almond_pistachio: [0.50, 0.30, 0.14], mulberry: [0.55, 0.50, 0.15] };
/** Leaf amount, colour and blossom of each group on a day (C phenology; species B from pollen/PF where stated in plain.json). */
export function foliage(g: TreeGroup, doy: number): Foliage {
  const d = ((doy % YEAR) + YEAR) % YEAR;
  // [leaf-out start, full leaf, colour start, leaf fall end] (doy), blossom window
  const P: Record<TreeGroup, [number, number, number, number]> = {
    plane: [100, 125, 300, 340], willow_poplar: [78, 105, 305, 340], tamarisk: [90, 115, 295, 335], fruit: [95, 120, 290, 330],
    vine: [105, 135, 285, 325], oak: [95, 125, 285, 330], almond_pistachio: [70, 100, 280, 320], mulberry: [95, 118, 295, 330] };
  const [a, b, c, e] = P[g];
  const leaf = smooth(a, b, d) * (1 - smooth(c + (e - c) * 0.5, e, d));
  const autumn = smooth(c, c + (e - c) * 0.6, d);
  const spring = 1 - smooth(a, b + 20, d); // young leaves are lighter
  let colour = lerp3(SUMMER[g], AUTUMN[g], autumn);
  colour = lerp3(colour, [colour[0] * 1.25, colour[1] * 1.3, colour[2] * 1.1], spring * leaf);
  const bl = g === 'fruit' ? window(d, 75, 108, 8) : g === 'almond_pistachio' ? window(d, 45, 72, 7) : 0; // fruit blossom Mar-Apr (crops.fruit_trees); almond Feb-Mar (C)
  return { leaf, colour, blossom: bl, blossomColour: g === 'almond_pistachio' ? [0.92, 0.82, 0.84] : [0.93, 0.9, 0.88] };
}
/** tree-group state table: TREE_GROUPS.length × 2 texels RGBA (leaf colour + amount; blossom colour + amount) */
export function foliageTable(doy: number): Float32Array {
  const out = new Float32Array(TREE_GROUPS.length * 2 * 4);
  TREE_GROUPS.forEach((g, i) => { const f = foliage(g, doy); out.set([...f.colour, f.leaf], i * 8); out.set([...f.blossomColour, f.blossom], i * 8 + 4); });
  return out;
}
