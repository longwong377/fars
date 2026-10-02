// The fill (session 15, agent fill, D-367; UD-19, UD-07, UD-08): where the things of daily life stand in the town's lanes and
// squares and on the Terrace, by rule, everywhere at once (never one dressed street). Pure data (no three.js): the plan is a
// list of placed models (src/world/fill.ts draws them, instanced per model, part and level).
// Rules (all C: no lane, market or building site of 467 BC is preserved; the analogues are the Babylonian and Elamite
// house-and-lane towns, the PF tablets' goods, the reliefs' standards and the masons' waste in the Terrace's fills):
//  1. Market: every square of every quarter is a market: stalls against its walls facing in, 3 m apart, clear of doorways
//     and of the well; each stall sells one trade's goods (fruit, grain, cloth, pots, fuel, oil and wine), set out by day
//     and taken in at night (the awnings stay).
//  2. Lane frontage: along every wall that fronts a lane or a square, the household's things: fuel (brushwood bundles,
//     firewood, dung cakes), water jars by the doors, sacks, rubble from repairs; a workshop's frontage holds its craft's
//     goods and work, and a cloth awning over its door where the lane is wide enough; a few houses shade their doors too.
//     Nothing narrows a lane below 1.6 m clear, nothing stands in a doorway.
//  3. Washing lines across the narrow lanes between two houses' walls (washing: PF wool and linen; the line C).
//  4. The Terrace: the masons' yard's waste (chips, quarry blocks, rubble), the goods set down at the stair foot, the
//     garrison's water jars and fuel, the Treasury store's sacks and jars, standards at the gates and stairs (C).
import { LANE, SQUARE, OUT, toLocal, type Site, type Plot, type Craft } from './settlement/site';
import placesJson from '../data/people_places.json';

export type RGB = [number, number, number];
/** a placed model: grid (e, n), rotation about up (three's rotY: the model's +z front turned to face (sin r, -cos r) in
 *  grid terms... see fill.ts), scale per axis (model units: metres), the colour of each part (sRGB, multiplied with the
 *  baked occlusion; parts not named take the part's default) */
export interface FillItem { m: string; e: number; n: number; dy: number; rot: number; s: [number, number, number]; col?: Record<string, RGB>;
  /** shown only by day (market goods: set out ~6.5 h, taken in ~19 h) */ day?: boolean;
  /** a solid footprint (half sizes along the item's x and z, m) for the player and the people */ solid?: [number, number];
  /** where: 'market' | 'lane' | 'door' | 'line' | 'terrace' | 'litter' (stats, F3) */ at: string;
  /** s17 C1 (D-550): an absolute height (m) instead of the ground's + dy (a roof's things: houses.ts roofFill) */ y?: number;
  /** s17 C1 (D-550): a turn about the item's own x after its turn about up (radians): a tool leaned on a wall (-pi/2 - lean) */ tilt?: number;
  /** s17 C1: market goods sold out by this local hour (the stall fullest in the morning, thinning through the afternoon) */ until?: number;
  /** s17 C1: an animal tethered here by day (its peg is the item; fauna draws the animal: townTethers) */ tether?: 'donkey' | 'goats' | 'sheep'; /** the plot whose household it is (the tether's) */ plot?: string }

function h32(...v: number[]) { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h >>> 0; }
const u01 = (...v: number[]) => h32(...v) / 4294967296;
const pick = <T>(a: T[], u: number) => a[Math.min(a.length - 1, Math.floor(u * a.length))];
function strHash(s: string) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }

// the cloths' colours (sRGB): undyed wool and linen most, then the period's dyes (madder red, woad/indigo blue, weld and
// pomegranate-rind yellows, walnut browns; the dyes: PF and the Pazyryk textiles, B; the shares C)
export const CLOTHS: RGB[] = [[0.8, 0.74, 0.62], [0.74, 0.68, 0.56], [0.86, 0.82, 0.72], [0.58, 0.22, 0.16], [0.5, 0.18, 0.14], [0.28, 0.32, 0.46], [0.72, 0.58, 0.3], [0.46, 0.36, 0.26], [0.66, 0.4, 0.26]];
const cloth = (u: number): RGB => pick(CLOTHS, u);
const FRUIT: RGB[] = [[0.55, 0.13, 0.1], [0.62, 0.2, 0.12], [0.72, 0.62, 0.22], [0.6, 0.48, 0.16], [0.42, 0.28, 0.16]]; // pomegranates, quinces, apples, dates

/** the market trades and what a stall of each sets out (model, local x, y, z, scale, extra colour) */
type Good = [string, number, number, number, number, Record<string, RGB>?];
const TRADES: Record<string, (u: number) => Good[]> = {
  fruit: u => [['fill_produce', -0.6, 0.47, 0.55, 0.85, { fruit: pick(FRUIT, u) }], ['fill_produce', 0.55, 0.47, 0.55, 0.85, { fruit: pick(FRUIT, (u * 7) % 1) }], ['fill_produce', 0.1, 0, 1.25, 1, { fruit: pick(FRUIT, (u * 13) % 1) }], ['sack', -1.0, 0, 1.15, 0.9]],
  grain: () => [['fill_grain', -0.7, 0, 1.2, 1], ['fill_grain', 0.0, 0, 1.25, 1.05], ['fill_grain', 0.7, 0, 1.15, 0.95], ['sack', -0.9, 0, -0.2, 1], ['sack_lying', 0.8, 0, -0.3, 1]],
  cloth: u => [['fill_bolts', 0, 0, 1.35, 1, { textile_a: cloth(u), textile_b: cloth((u * 5) % 1) }], ['roll', 0.0, 0.47, 0.55, 0.45, { textile: cloth((u * 11) % 1) }], ['hung_cloth', 0.0, 1.1, -0.75, 0.9, { cloth: cloth((u * 3) % 1) }]],
  pots: () => [['fill_pots', 0, 0, 1.3, 1], ['jar_store', -0.95, 0, 1.2, 0.85], ['jar_water', 0.95, 0, 1.2, 0.8], ['bowl', -0.5, 0.47, 0.55, 1], ['bowl', 0.45, 0.47, 0.55, 1]],
  fuel: () => [['fill_bundle', -0.4, 0, 1.2, 1], ['fill_bundle', 0.4, 0, 1.35, 0.95], ['dung_stack', 1.0, 0, 1.2, 1], ['brush_pile', 0.0, 0, -0.2, 0.9]],
  oil: () => [['jar_store', -0.6, 0, 1.15, 0.9], ['jar_neck', 0.0, 0, 1.25, 0.9], ['jar_store', 0.65, 0, 1.15, 0.95], ['jar_neck', -0.3, 0.47, 0.55, 0.55], ['bowl', 0.4, 0.47, 0.55, 1]],
};
const TRADE_SHARE: [string, number][] = [['fruit', 0.24], ['grain', 0.2], ['cloth', 0.14], ['pots', 0.14], ['fuel', 0.14], ['oil', 0.14]];
const tradeOf = (u: number) => { let a = 0; for (const [t, w] of TRADE_SHARE) { a += w; if (u < a) return t; } return 'fruit'; };

/** a craft's frontage goods (model, weight) */
const CRAFT_GOODS: Partial<Record<Craft, [string, number][]>> = {
  pottery: [['fill_pots', 3], ['jar_store', 2], ['jar_neck', 1], ['fill_bundle', 1]],
  textile: [['fill_bolts', 2], ['wo_drying_rack', 2], ['roll', 1], ['sack', 1]],
  wood: [['timber_stack', 3], ['fill_bundle', 1], ['fill_rubble', 1]],
  metal: [['fill_bundle', 2], ['fill_rubble', 1], ['sack', 1]],
  bakery: [['fill_bundle', 3], ['brush_pile', 2], ['fill_grain', 1], ['sack', 2]],
  brewery: [['jar_store', 3], ['vat', 1], ['sack', 2]],
  pigment: [['jar_neck', 2], ['sack', 1], ['fill_rubble', 1]],
  bone: [['sack', 2], ['fill_bundle', 1]],
  kiln: [['fill_bundle', 3], ['brush_pile', 2], ['fill_rubble', 2]],
  brick: [['fill_rubble', 3], ['fill_bundle', 1]],
};
const HOUSE_GOODS: [string, number][] = [['fill_bundle', 5], ['firewood_lean', 3], ['dung_stack', 2], ['brush_pile', 2], ['jar_water', 2], ['sack', 2], ['fill_rubble', 1.5], ['fill_produce', 0.6], ['sack_lying', 0.8]];
const wpick = (L: [string, number][], u: number) => { const tot = L.reduce((s, [, w]) => s + w, 0); let a = 0; for (const [m, w] of L) { a += w / tot; if (u < a) return m; } return L[L.length - 1][0]; };
/** the depth (m, along the item's z, out from the wall) each model takes in a lane: the clear width it leaves */
const DEPTH: Record<string, number> = { fill_bundle: 0.35, firewood_lean: 0.45, dung_stack: 0.25, brush_pile: 0.9, jar_water: 0.4, jar_store: 0.5, jar_neck: 0.35, sack: 0.45, sack_lying: 0.5, fill_rubble: 0.9, fill_produce: 0.55,
  fill_pots: 0.7, fill_bolts: 0.6, wo_drying_rack: 0.5, roll: 0.3, timber_stack: 0.9, fill_grain: 0.5, vat: 0.8, fill_awning: 0 };
/** models drawn rotated so their length runs along the wall (their x) */
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** three's rotation about up for a model whose +z front should face grid direction (de, dn) */
export const rotFacing = (de: number, dn: number) => Math.atan2(de, -dn);

export interface FillStats { market: number; stalls: number; lane: number; door: number; line: number; terrace: number; squares: number; /** s17 C1: the gap fill along the walls and the lanes' litter */ gap?: number; litter?: number; tethers?: number }

/** the town's fill from its sites (every quarter; compounds have no lanes or squares) */
export function townFill(sites: Site[], seed = 1, villages: Site[] = [], markets: [number, number][] = []): { items: FillItem[]; stats: FillStats } {
  const items: FillItem[] = [], st: FillStats = { market: 0, stalls: 0, lane: 0, door: 0, line: 0, terrace: 0, squares: 0, gap: 0, litter: 0, tethers: 0 };
  // s17 C1 (D-550): the simulation's market grounds (Population.quarters' points: where popgeo stands each selling household's
  // stall, market:<q>:<hid>, D-359), each to the site it lies in
  const mk = new Map<Site, [number, number][]>(); for (const xy of markets) { const s = sites.find(x => { const [u, v] = toLocal(x.frame, xy[0], xy[1]); return x.inb(x.ci(u), x.cj(v)); }); if (s) (mk.get(s) ?? mk.set(s, []).get(s)!).push(toLocal(s.frame, xy[0], xy[1])); else openMarket(xy, sites, seed, items, st); }
  for (const s of sites) siteFill(s, seed, items, st, false, mk.get(s));
  for (const s of villages) siteFill(s, seed, items, st, true);
  detwin(items);
  return { items, stats: st };
}

const open = (c: number) => c === LANE || c === SQUARE || c === OUT;
/** s17 C1 (D-550): a market on the open ground outside the quarters (popgeo openNear: the sellers within ~20 m of the point):
 *  two rows of spreads and stalls facing across a 6 m way, every 2.8 m over 26 m, turned by a hash; spots on a plot's cells
 *  are left out (C: an open-air market by a town's edge, the region's periodic markets, RECOLLECTION) */
function openMarket(xy: [number, number], sites: Site[], seed: number, items: FillItem[], st: FillStats) {
  const k0 = h32(seed, Math.round(xy[0]), Math.round(xy[1]), 77), a = u01(k0, 1) * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
  const free = (e: number, n: number) => { for (const s of sites) { const [u, v] = toLocal(s.frame, e, n), i = s.ci(u), j = s.cj(v); if (s.inb(i, j) && s.cell[s.k(i, j)] >= 0) return false; } return true; };
  for (const side of [-1, 1]) for (let t = -13; t <= 13; t += 2.8) { const k = h32(k0, side + 2, Math.round(t * 10));
    if (u01(k, 9) < 0.12) continue; // (a gap: a seller not come today)
    const e = xy[0] + ca * t - sa * side * 3, n = xy[1] + sa * t + ca * side * 3, fe = sa * side, fn = -ca * side; // (facing the way)
    if (!free(e, n) || !free(e - fe * 1.2, n - fn * 1.2)) continue;
    const stall = u01(k, 1) < 0.3, trade = tradeOf(u01(k, 2)), rot = rotFacing(fe, fn), rx = fn, rv = -fe; // (the spread's local +x: its front turned clockwise)
    if (stall) { const reed = u01(k, 8) < 0.4; items.push({ m: reed ? 'fill_stall_reed' : 'fill_stall', e: e - fe * 0.4, n: n - fn * 0.4, dy: 0, rot, s: [1, 1, 1], ...(reed ? {} : { col: { cloth: cloth(u01(k, 3)) } }), solid: reed ? [1.1, 0.8] : [1.2, 0.85], at: 'market' }); st.stalls++; st.market++; }
    else { items.push({ m: 'mat', e, n, dy: 0, rot: rot + (u01(k, 4) - 0.5) * 0.2, s: [0.62, 1, 0.66], day: true, at: 'market' }); st.market++; }
    const ce = stall ? e - fe * 0.4 : e, cn = stall ? n - fn * 0.4 : n;
    for (const [m, x, y, z, sc, col] of TRADES[trade](u01(k, 5))) { const zz = stall ? z : (z - 0.6) * 0.45, xx = stall ? x : x * 0.62, sj = sc * (0.93 + 0.14 * u01(k, x * 10, z * 10, 5)), gone = u01(k, x * 10, z * 10, 6);
      items.push({ m, e: ce + rx * xx + fe * zz, n: cn + rv * xx + fn * zz, dy: stall ? y : 0.012, rot: rot + (u01(k, x * 10, z * 10) - 0.5) * 0.5, s: [sj, sj, sj], col, day: true, ...(gone < 0.45 ? { until: 12.5 + 6 * gone / 0.45 } : {}), at: 'market' }); st.market++; } }
}
/** s17 C1 (D-550): no two things of the same model within 15 m that look the same (scale within 3 %, the same colours, turned
 *  within 10 degrees, the same lean): each later twin is turned and sized a step further from its earlier twin (a tool's lean
 *  changed instead of its turn, so it stays against its wall) */
export const sameLook = (a: FillItem, b: FillItem) => a.m === b.m && Math.abs(a.s[0] - b.s[0]) < 0.03 * Math.max(a.s[0], b.s[0]) && Math.abs(a.s[1] - b.s[1]) < 0.03 * Math.max(a.s[1], b.s[1])
  && Math.abs((a.tilt ?? 0) - (b.tilt ?? 0)) < 0.05 && Math.abs(Math.atan2(Math.sin(a.rot - b.rot), Math.cos(a.rot - b.rot))) < 0.175 && JSON.stringify(a.col ?? {}) === JSON.stringify(b.col ?? {});
export function detwin(items: FillItem[], R = 15) {
  const G = new Map<number, number[]>(), key = (e: number, n: number) => (Math.floor(e / R) + 8192) * 16384 + Math.floor(n / R) + 8192;
  const same = sameLook;
  items.forEach((a, k) => { const i0 = Math.floor(a.e / R), j0 = Math.floor(a.n / R);
    const twin = () => { for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (const q of G.get((i0 + x + 8192) * 16384 + j0 + y + 8192) ?? []) { const b = items[q]; if (Math.hypot(a.e - b.e, a.n - b.n) < R && same(a, b)) return b; } return null; };
    for (let t = 0; t < 16; t++) { const b = twin(); if (!b) break; const f = 1 + 0.045 * (t % 2 ? -1 : 1) * (1 + (t >> 1) * 0.5);
      a.s = [b.s[0] * f, b.s[1] * f, b.s[2] * f]; if (a.tilt !== undefined) a.tilt = b.tilt! + (t % 2 ? -0.06 : 0.06); else if (a.m !== 'fill_stall' && a.m !== 'fill_line' && a.m !== 'fill_awning' && a.m !== 'fill_reed_awning') a.rot += 0.4 + 0.11 * t; }
    const kk = key(a.e, a.n); (G.get(kk) ?? G.set(kk, []).get(kk)!).push(k); });
}
/** one site's fill; `outside`: the open ground round a village's compounds counts as its lanes (villages have no lanes) */
export function siteFill(s: Site, seed: number, items: FillItem[], st: FillStats, outside = false, markets: [number, number][] = []) {
  const W = s.W, H = s.H, sid = strHash(s.id) ^ seed, th = s.frame.theta, C = Math.cos(th), S = Math.sin(th), first = items.length;
  const toG = (u: number, v: number) => s.grid(u, v), dirG = (du: number, dv: number): [number, number] => [du * C - dv * S, du * S + dv * C];
  const doorEdge = (i: number, j: number, di: number, dj: number) => s.doors.has(dj === 1 ? s.eh(i, j) : dj === -1 ? s.eh(i, j - 1) : di === 1 ? s.ev(i, j) : s.ev(i - 1, j));
  // the cells taken by the site's own fittings and fixtures (wells, troughs, firewood, drains ...): kept 1.2 m clear
  const taken: [number, number][] = [...s.fittings.map(f => [f.u, f.v] as [number, number]), ...(s.fixtures ?? []).filter(f => f.u || f.v).map(f => [f.u, f.v] as [number, number])];
  const bucket = (pts: [number, number][]) => { const m = new Map<number, [number, number][]>(); for (const p of pts) { const kk = (Math.floor(p[0] / 4) + 512) * 4096 + Math.floor(p[1] / 4) + 512; (m.get(kk) ?? m.set(kk, []).get(kk)!).push(p); } return m; };
  const near = (m: Map<number, [number, number][]>, u: number, v: number, r: number, round: boolean) => { const i0 = Math.floor(u / 4), j0 = Math.floor(v / 4);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const [x, y] of m.get((i0 + a + 512) * 4096 + j0 + b + 512) ?? []) if (round ? Math.hypot(x - u, y - v) < r : Math.abs(x - u) < r && Math.abs(y - v) < r) return true; return false; };
  const takenB = bucket(taken), nearTaken = (u: number, v: number, r: number) => near(takenB, u, v, r, false);
  // door cells (lane side), to keep frontage goods off them
  const doorOut: [number, number][] = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const c = s.cell[j * W + i]; if (!open(c)) continue;
    for (const [di, dj] of DIRS) if (s.at(i + di, j + dj) >= 0 && doorEdge(i, j, di, dj)) doorOut.push([s.cu(i) + di * 0.5, s.cv(j) + dj * 0.5]); }
  const doorB = bucket(doorOut), nearDoor = (u: number, v: number, r: number) => near(doorB, u, v, r, true);
  /** open cells from (i, j) away from the wall (direction -di, -dj), the cell itself counted */
  const clear = (i: number, j: number, di: number, dj: number) => { let n = 0; while (n < 12 && open(s.at(i - di * n, j - dj * n)) && s.inb(i - di * n, j - dj * n)) n++; return n; };
  const put = (m: string, u: number, v: number, du: number, dv: number, sc: number | [number, number, number], at: string, extra: Partial<FillItem> = {}) => {
    const [e, n] = toG(u, v), [de, dn] = dirG(du, dv); items.push({ m, e, n, dy: 0, rot: rotFacing(de, dn), s: typeof sc === 'number' ? [sc, sc, sc] : sc, at, ...extra }); };

  // s17 C1 (D-550): beside a street door, the household's tools leaned on the wall, a stool where they sit out in the evening,
  // the donkey tethered to a peg by day (only a household that keeps one: houseplan.ts lifeOf), each on the side away from
  // the door's swing, never in the doorway
  const doorThings = (i: number, j: number, di: number, dj: number, w: number, P: Plot, key: number[]) => {
    const wu = s.cu(i) + di * 0.5, wv = s.cv(j) + dj * 0.5, side = u01(...key, 20) < 0.5 ? -1 : 1;
    const at = (along: number, off: number): [number, number] => [wu - di * off + side * dj * along, wv - dj * off - side * di * along];
    const ok = (u: number, v: number, r: number) => open(s.at(s.ci(u), s.cj(v))) && !nearTaken(u, v, r);
    if (u01(...key, 21) < 0.42) { const T = wpick(TOOL_W, u01(...key, 22)), [zmin, zmax] = TOOLS[T], L = 0.18 + 0.1 * u01(...key, 23), [u, v] = at(-(1.0 + 0.3 * u01(...key, 24)), zmax * Math.sin(L) + 0.05);
      if (ok(u, v, 0.6)) { put(T, u, v, -di, -dj, 1, 'gap', { tilt: -Math.PI / 2 - L, dy: -zmin * Math.cos(L), rot: 0 }); fixRot(-di, -dj, (u01(...key, 25) - 0.5) * 0.5); st.door++; } }
    if (u01(...key, 31) < 0.18) { const [u, v] = at(0.95 + 0.2 * u01(...key, 32), 0.02); if (open(s.at(s.ci(u), s.cj(v)))) { put('fill_skin', u, v, -di, -dj, 0.9 + 0.2 * u01(...key, 33), 'gap'); fixRot(-di, -dj, 0); st.door++; } }
    if (u01(...key, 26) < 0.22 && w >= 2.4) { const [u, v] = at(1.1 + 0.3 * u01(...key, 27), 0.4); if (ok(u, v, 0.6)) { put('stool', u, v, -di, -dj, 0.95 + 0.1 * u01(...key, 28), 'gap', { day: true }); fixRot(-di, -dj, u01(...key, 29) * 6.28); st.door++; } }
    const life = s.lives?.[P.idx]; if (life?.animal && w >= 2.8 && u01(...key, 30) < (life.animal === 'donkey' ? 0.6 : 0.3)) { const [u, v] = at(1.6, 0.35);
      if (ok(u, v, 1.2) && !nearDoor(u, v, 1.2)) { put('peg', u, v, -di, -dj, 1, 'gap', { tether: life.animal, plot: P.id }); fixRot(-di, -dj, 0); st.door++; st.tethers = (st.tethers ?? 0) + 1;
        // the armful of straw thrown down for it at the wall's foot by its head, the droppings behind (C)
        const [fu, fv] = at(1.6, 0.15); put('wo_fodder', fu, fv, -di, -dj, 0.55 + 0.2 * u01(...key, 34), 'gap'); fixRot(-di, -dj, u01(...key, 35) * 6.28);
        const [lu, lv] = at(2.9, 0.9); if (open(s.at(s.ci(lu), s.cj(lv)))) { put('fill_litter', lu, lv, -di, -dj, 0.7, 'litter'); fixRot(-di, -dj, u01(...key, 36) * 6.28); } } }
  };
  /** the last item's turn: facing (du, dv) out of the wall turned by `jit` (radians) */
  const fixRot = (du: number, dv: number, jit: number) => { const [de, dn] = dirG(du, dv); items[items.length - 1].rot = rotFacing(de, dn) + jit; };

  // 1. the markets: each square's wall-side cells, stalls 3 m apart facing in
  const sqSeen = new Uint8Array(W * H);
  for (let k0 = 0; k0 < W * H; k0++) { if (s.cell[k0] !== SQUARE || sqSeen[k0]) continue;
    const comp: number[] = [k0]; sqSeen[k0] = 1;
    for (let q = 0; q < comp.length; q++) { const k = comp[q], i = k % W, j = (k / W) | 0; for (const [di, dj] of DIRS) { const i2 = i + di, j2 = j + dj; if (!s.inb(i2, j2)) continue; const k2 = j2 * W + i2; if (!sqSeen[k2] && s.cell[k2] === SQUARE) { sqSeen[k2] = 1; comp.push(k2); } } }
    st.squares++;
    const placed: [number, number][] = [];
    const cand: { u: number; v: number; du: number; dv: number; w: number }[] = [];
    for (const k of comp) { const i = k % W, j = (k / W) | 0;
      for (const [di, dj] of DIRS) { if (s.at(i + di, j + dj) < 0 || doorEdge(i, j, di, dj)) continue;
        const w = clear(i, j, di, dj); if (w < 5) continue; // a stall needs the square's depth behind its buyers
        cand.push({ u: s.cu(i) + di * (0.5 - 1.15), v: s.cv(j) + dj * (0.5 - 1.15), du: -di, dv: -dj, w }); } }
    cand.sort((a, b) => u01(sid, Math.round(a.u * 10), Math.round(a.v * 10)) - u01(sid, Math.round(b.u * 10), Math.round(b.v * 10)));
    for (const c of cand) { if (placed.some(([a, b]) => Math.hypot(a - c.u, b - c.v) < 2.9) || nearDoor(c.u, c.v, 1.9) || nearTaken(c.u, c.v, 2.2)) continue;
      placed.push([c.u, c.v]); st.stalls++;
      const tu = u01(sid, Math.round(c.u * 10), Math.round(c.v * 10), 3), trade = tradeOf(tu);
      const k = h32(sid, Math.round(c.u * 10), Math.round(c.v * 10));
      if (u01(k, 7) < 0.35) put('fill_stall_reed', c.u, c.v, c.du, c.dv, 1, 'market', { solid: [1.1, 0.8] }); // (s17 C1: a third the poorer reed-mat kind)
      else put('fill_stall', c.u, c.v, c.du, c.dv, 1, 'market', { col: { cloth: cloth(u01(k, 1)) }, solid: [1.2, 0.85] }); st.market++;
      // the goods in the stall's frame: x along the wall (to the right of the front), z out of it
      const rx = -c.dv, rv = c.du; // the stall's local +x in (u, v): its front (du, dv) turned clockwise
      for (const [m, x, y, z, sc, col] of TRADES[trade](u01(k, 2))) {
        const gu = c.u + rx * x + c.du * z, gv = c.v + rv * x + c.dv * z, [e, n] = toG(gu, gv), [de, dn] = dirG(c.du, c.dv);
        const jit = (u01(k, x * 10, z * 10) - 0.5) * 0.5; if (!open(s.at(s.ci(gu), s.cj(gv)))) continue;
        // (s17 C1: each heap its own size; by the afternoon some goods are sold and gone: a stall is fullest in the morning)
        const sj = sc * (0.93 + 0.14 * u01(k, x * 10, z * 10, 5)), gone = u01(k, x * 10, z * 10, 6);
        items.push({ m, e, n, dy: y, rot: rotFacing(de, dn) + jit, s: [sj, sj, sj], col, day: true, ...(gone < 0.45 ? { until: 12.5 + 6 * gone / 0.45 } : {}), at: 'market' }); st.market++; }
    }
  }

  // 1b. s17 C1 (D-550): the simulation's market grounds (D-359: the sellers stand within 30 m of the quarter's point, each at
  // their household's spread): along the walls within MARKET_R of the point, every 2.6 m, a seller's spread on a reed mat (a
  // trade's goods, set out by day, sold out through the afternoon), a stall with its awning where the lane is wide; clear of
  // doors and fittings, the lane left passable (C: the analogues as for the squares' markets)
  for (const [mu, mv] of markets) for (const R of [MARKET_R, MARKET_R * 2]) { const spots: [number, number][] = [];
    if (R > MARKET_R && items.some(it => it.at === 'market' && Math.hypot(...toLocal(s.frame, it.e, it.n).map((x, q) => x - [mu, mv][q]) as [number, number]) < MARKET_R)) break; // (the near ring held the market)
    const cand: { u: number; v: number; du: number; dv: number; w: number; d: number }[] = [];
    for (let j = Math.max(0, s.cj(mv) - R); j <= Math.min(H - 1, s.cj(mv) + R); j++) for (let i = Math.max(0, s.ci(mu) - R); i <= Math.min(W - 1, s.ci(mu) + R); i++) {
      const c = s.cell[j * W + i]; if (!open(c)) continue; const d = Math.hypot(s.cu(i) - mu, s.cv(j) - mv); if (d > R) continue; // (a compound's point: the open ground along its wall)
      for (const [di, dj] of DIRS) { if (s.at(i + di, j + dj) < 0 || doorEdge(i, j, di, dj)) continue; const w = c === OUT ? 12 : clear(i, j, di, dj); if (w < 2.4) continue; // (a compound's raster ends 2 m out: beyond it the ground is open)
        cand.push({ u: s.cu(i) + di * 0.5, v: s.cv(j) + dj * 0.5, du: -di, dv: -dj, w, d }); } }
    cand.sort((a, b) => a.d - b.d);
    for (const c of cand) { if (spots.length >= 16) break; if (spots.some(([a, b]) => Math.hypot(a - c.u, b - c.v) < 2.6)) continue;
      const k = h32(sid, Math.round(c.u * 10), Math.round(c.v * 10), 5), stall = c.w >= 5 && u01(k, 1) < 0.35, off = stall ? 1.15 : 0.75;
      const cu = c.u + c.du * off, cv = c.v + c.dv * off; if (nearDoor(cu, cv, 1.6) || nearTaken(cu, cv, 1.6) || !open(s.at(s.ci(cu), s.cj(cv)))) continue;
      spots.push([c.u, c.v]); const trade = tradeOf(u01(k, 2)), rx = -c.dv, rv = c.du, [de, dn] = dirG(c.du, c.dv);
      if (stall) { if (u01(k, 8) < 0.4) put('fill_stall_reed', cu, cv, c.du, c.dv, 1, 'market', { solid: [1.1, 0.8] }); else put('fill_stall', cu, cv, c.du, c.dv, 1, 'market', { col: { cloth: cloth(u01(k, 3)) }, solid: [1.2, 0.85] }); st.stalls++; st.market++; }
      else { put('mat', cu, cv, c.du, c.dv, [0.62, 1, 0.66], 'market', { day: true }); fixRot(-c.dv, c.du, (u01(k, 4) - 0.5) * 0.2); st.market++; }
      for (const [m, x, y, z, sc, col] of TRADES[trade](u01(k, 5))) { // (on a mat the goods sit on the ground, pulled in to the mat's 1.2 x 0.8 m)
        const zz = stall ? z : (z - 0.6) * 0.45, xx = stall ? x : x * 0.62, gu = cu + rx * xx + c.du * zz, gv = cv + rv * xx + c.dv * zz, [e, n] = toG(gu, gv);
        if (!open(s.at(s.ci(gu), s.cj(gv)))) continue; const sj = sc * (0.93 + 0.14 * u01(k, x * 10, z * 10, 5)), gone = u01(k, x * 10, z * 10, 6);
        items.push({ m, e, n, dy: stall ? y : 0.012, rot: rotFacing(de, dn) + (u01(k, x * 10, z * 10) - 0.5) * 0.5, s: [sj, sj, sj], col, day: true, ...(gone < 0.45 ? { until: 12.5 + 6 * gone / 0.45 } : {}), at: 'market' }); st.market++; } } }

  // 2. the lane frontage and 3. the washing lines
  const lines: [number, number][] = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i, c = s.cell[k]; if (c !== LANE && c !== SQUARE && !(outside && c === OUT)) continue;
    for (const [di, dj] of DIRS) { const pc = s.at(i + di, j + dj); if (pc < 0) continue; const P: Plot | undefined = s.plots[pc]; if (!P) continue;
      const w = clear(i, j, di, dj), key = [sid, k, di + 2 * dj + 3];
      const wu = s.cu(i) + di * 0.5, wv = s.cv(j) + dj * 0.5; // the wall's face line at the cell's middle
      if (doorEdge(i, j, di, dj)) { // a street door
        const isWs = P.kind === 'workshop', aw = (isWs ? 0.6 : 0.12 + 0.2 * (P.kind === 'house_large' ? 1 : 0));
        if (w >= 3 && c === LANE && u01(...key, 1) < aw && P.height >= 2.6) { const dep = Math.min(1.7, w - 1.8);
          // (s17 C1: a house's shade is as often a reed mat on poles as a cloth; a workshop's mostly cloth)
          if (u01(...key, 17) < (isWs ? 0.25 : 0.55)) put('fill_reed_awning', wu - di * 0.28, wv - dj * 0.28, -di, -dj, [0.95 + 0.2 * u01(...key, 2), Math.min(1, (P.height - 0.1) / 2.35), dep / 1.6], 'door');
          else put('fill_awning', wu - di * 0.28, wv - dj * 0.28, -di, -dj, [0.9 + 0.2 * u01(...key, 2), Math.min(1, (P.height - 0.1) / 2.4), dep / 1.7], 'door', { col: { cloth: cloth(u01(...key, 3)) } }); st.door++; }
        else if (u01(...key, 4) < 0.3) { const side = u01(...key, 5) < 0.5 ? -1 : 1, ou = wu - di * 0.32 + side * dj * 0.95, ov = wv - dj * 0.32 - side * di * 0.95;
          if (!nearTaken(ou, ov, 0.8) && open(s.at(s.ci(ou), s.cj(ov)))) { put('jar_water', ou, ov, -di, -dj, 0.75 + 0.2 * u01(...key, 6), 'door'); st.door++; } }
        doorThings(i, j, di, dj, w, P, key);
        continue; }
      // a washing line to the facing wall
      if (w >= 2 && w <= 4 && s.at(i - di * w, j - dj * w) >= 0 && u01(...key, 7) < 0.05 && P.height >= 2.6) {
        const mu = wu - di * w / 2, mv = wv - dj * w / 2;
        if (!lines.some(([a, b]) => Math.hypot(a - mu, b - mv) < 7)) { lines.push([mu, mv]);
          const [e, n] = toG(mu, mv), [de, dn] = dirG(-di, -dj);
          items.push({ m: 'fill_line', e, n, dy: Math.min(0, P.height - 2.7), rot: Math.atan2(dn, de), s: [(w + 0.1) / 3, 1, 1], col: { cloth_a: cloth(u01(...key, 8)), cloth_b: cloth(u01(...key, 9)) }, day: true, at: 'line' }); st.line++; } } // (s17 C1: the washing brought in at dusk)
      // frontage goods
      const ws = P.kind === 'workshop' && P.craft ? CRAFT_GOODS[P.craft] : null;
      const p = ws ? 0.3 : c === SQUARE ? 0.06 : 0.12;
      if (u01(...key, 10) >= p) continue;
      const m = wpick(ws ?? HOUSE_GOODS, u01(...key, 11)), dep = DEPTH[m] ?? 0.5;
      if (w - dep - 0.3 < 1.6 && !(w >= 2 && dep <= 0.45)) continue; // keep the lane passable
      const off = 0.3 + dep / 2, along = (u01(...key, 12) - 0.5) * 0.5, gu = wu - di * off + dj * along, gv = wv - dj * off - di * along;
      if (nearDoor(gu, gv, 1.1) || nearTaken(gu, gv, 1.0)) continue;
      const sc = 0.85 + 0.25 * u01(...key, 13), col: Record<string, RGB> | undefined = m === 'fill_bolts' ? { textile_a: cloth(u01(...key, 14)), textile_b: cloth(u01(...key, 15)) } : m === 'wo_drying_rack' ? { linen: cloth(u01(...key, 14)), red: cloth(u01(...key, 15)) } : m === 'roll' ? { textile: cloth(u01(...key, 14)) } : m === 'fill_produce' ? { fruit: pick(FRUIT, u01(...key, 14)) } : undefined;
      put(m, gu, gv, -di, -dj, sc, 'lane', col ? { col } : {}); fixRot(-di, -dj, (u01(...key, 16) - 0.5) * 0.7); st.lane++;
    } }

  // s17 C1 (D-550): 4. no bare wall. Along every wall that fronts a lane, where nothing stands within GAP_R of the wall's foot,
  // one of the household's lesser things (a jar, a pot, a basin, a stool, a rolled mat, a tool leaned on the wall, dung cakes
  // drying, fuel, the mud and bricks of a repair), never the same thing as a neighbour within 6 m; the lane left passable.
  // 5. the lanes' litter: where the middle of a wide lane or a junction still has nothing within 2.8 m, the litter of a lane
  // that animals and people use (spilled straw and chaff, sherds, twigs, a dump of ash and earth, a child's knucklebones),
  // flat, never in the way. All C (the region's vernacular lanes; D-207).
  const B = new Map<number, number[]>(), bk = (e: number, n: number) => (Math.floor(e / 4) + 8192) * 16384 + Math.floor(n / 4) + 8192;
  const addB = (k: number) => { const it = items[k], key = bk(it.e, it.n); (B.get(key) ?? B.set(key, []).get(key)!).push(k); };
  for (let k = first; k < items.length; k++) addB(k);
  const nearB = (e: number, n: number, r: number, m?: string) => { const i0 = Math.floor(e / 4), j0 = Math.floor(n / 4), R = Math.ceil(r / 4);
    for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) for (const k of B.get((i0 + a + 8192) * 16384 + j0 + b + 8192) ?? []) { const it = items[k]; if ((m === undefined || it.m === m) && Math.hypot(it.e - e, it.n - n) < r) return true; } return false; };
  const pickNot = (L: [string, number][], u: number, e: number, n: number, fits: (m: string) => boolean) => { // (a model not used within 6 m)
    const tot = L.reduce((a, [, w]) => a + w, 0); let a = 0, k0 = L.length - 1; for (let k = 0; k < L.length; k++) { a += L[k][1] / tot; if (u < a) { k0 = k; break; } }
    for (let t = 0; t < L.length; t++) { const m = L[(k0 + t) % L.length][0]; if (fits(m) && !nearB(e, n, 6, m)) return m; } return null; };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i, c = s.cell[k]; if (c !== LANE && !(outside && c === OUT)) continue;
    for (const [di, dj] of DIRS) { const pc = s.at(i + di, j + dj); if (pc < 0 || !s.plots[pc] || doorEdge(i, j, di, dj)) continue;
      const wu = s.cu(i) + di * 0.5, wv = s.cv(j) + dj * 0.5, [fe, fn] = toG(wu - di * 0.4, wv - dj * 0.4); if (nearB(fe, fn, GAP_R) || nearB(fe, fn, 2.9, 'peg')) continue; // (nor under a tethered animal)
      const w = clear(i, j, di, dj), key = [sid, k, di + 2 * dj + 3, 77];
      const along = (u01(...key, 1) - 0.5) * 0.6, fits = (m: string) => { const d = LITTLE_D[m] ?? 0.5; return w - d - 0.3 >= 1.6 || (w >= 2 && d <= 0.45); };
      const m = pickNot(LITTLE, u01(...key, 2), fe, fn, fits); if (!m) continue;
      const tool = TOOLS[m], dep = LITTLE_D[m] ?? 0.5, L = 0.18 + 0.1 * u01(...key, 3), off = tool ? tool[1] * Math.sin(L) + 0.05 : AGAINST[m] !== undefined ? AGAINST[m] + 0.02 : 0.3 + dep / 2;
      const gu = wu - di * off + dj * along, gv = wv - dj * off - di * along;
      if (nearDoor(gu, gv, 1.1) || nearTaken(gu, gv, 1.0) || !open(s.at(s.ci(gu), s.cj(gv)))) continue;
      const sc = tool ? 1 : 0.86 + 0.24 * u01(...key, 4), col = LITTLE_COL[m]?.(u01(...key, 5));
      put(m, gu, gv, -di, -dj, sc, 'gap', { ...(col ? { col } : {}), ...(tool ? { tilt: -Math.PI / 2 - L, dy: -tool[0] * Math.cos(L) } : {}), ...(m === 'stool' ? { day: true } : {}) }); // (stools taken in at dusk)
      fixRot(-di, -dj, tool || AGAINST[m] !== undefined ? (u01(...key, 6) - 0.5) * 0.3 : (u01(...key, 6) - 0.5) * 1.2); addB(items.length - 1); st.gap = (st.gap ?? 0) + 1; } }
  if (!outside) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (s.cell[k] !== LANE) continue;
    const key = [sid, k, 91], u = s.cu(i) + (u01(...key, 1) - 0.5) * 0.7, v = s.cv(j) + (u01(...key, 2) - 0.5) * 0.7, [e, n] = toG(u, v);
    if (nearB(e, n, 2.3) || nearB(e, n, 2.6, 'peg') || nearTaken(u, v, 1.0) || nearDoor(u, v, 0.8)) continue;
    const m = pickNot(LITTER, u01(...key, 3), e, n, () => true); if (!m) continue;
    const [a, b] = LITTER_S[m] ?? [0.8, 1.1], sc = a + (b - a) * u01(...key, 4), fl = m === 'wo_spoil' ? 0.35 + 0.2 * u01(...key, 5) : 1;
    items.push({ m, e, n, dy: m === 'tool_stick' ? 0.01 : 0, rot: u01(...key, 6) * 6.283, s: [sc, sc * fl, sc], at: 'litter', ...(m === 'wo_spoil' ? { col: { earth: ASH[Math.floor(u01(...key, 7) * ASH.length)] } } : {}) });
    addB(items.length - 1); st.litter = (st.litter ?? 0) + 1; }
}

/** s17 C1: the tools leaned on the walls: [model, its length's start and end along the model's z (m)] */
const TOOLS: Record<string, [number, number]> = { tool_hoe: [-0.45, 0.84], tool_fork: [-0.55, 1.48], tool_broom: [-0.1, 0.56], tool_staff: [-0.12, 1.5], tool_goad: [-0.12, 1.2] };
const TOOL_W: [string, number][] = [['tool_hoe', 3], ['tool_broom', 3], ['tool_fork', 1.5], ['tool_staff', 2]];
/** s17 C1: the sim's market ground: spreads within this of the quarter's point (m; popgeo stands sellers within 30 cells) */
const MARKET_R = 14;
/** the gap fill: within this of the wall's foot nothing stands -> one thing (m): ~5 m between things along a wall at most */
const GAP_R = 1.9;
const LITTLE: [string, number][] = [['jar_water', 3], ['tool_broom', 1.6], ['sack', 2], ['wo_dung_cakes', 1.6], ['cookpot', 1.2], ['fill_bundle', 2], ['basin', 1], ['tool_hoe', 1.4], ['firewood_lean', 2],
  ['stool', 1], ['roll', 1], ['dung_stack', 1.4], ['wo_mud_heap', 0.9], ['tool_fork', 0.7], ['sack_lying', 1], ['wo_fodder', 0.8], ['wo_brick_stack', 0.6],
  ['tool_staff', 0.7], ['brush_pile', 0.8], ['quern', 0.5], ['fill_rubble', 0.6], ['jar_neck', 0.6],
  ['fill_matlean', 1.4], ['fill_basket_tall', 1.4], ['fill_winnow', 1.0]];
const LITTLE_D: Record<string, number> = { ...DEPTH, cookpot: 0.36, basin: 0.47, stool: 0.45, wo_dung_cakes: 0.46, milkpot: 0.3, wo_mud_heap: 0.8, wo_fodder: 0.75, kneading_trough: 0.5, wo_brick_stack: 0.7, quern: 1.0, wo_fleece: 0.54,
  tool_hoe: 0.4, tool_broom: 0.25, tool_fork: 0.45, tool_staff: 0.4, tool_goad: 0.35, fill_matlean: 0.65, fill_basket_tall: 0.45, fill_winnow: 0.3 };
/** models whose back stands against the wall (their own -z to the wall): set this far out from the wall's face (m) */
const AGAINST: Record<string, number> = { fill_matlean: 0.27, fill_winnow: -0.04 };
const LITTLE_COL: Record<string, (u: number) => Record<string, RGB>> = { roll: u => ({ textile: cloth(u) }), fill_produce: u => ({ fruit: pick(FRUIT, u) }),
  wo_fleece: u => ({ wool: pick(FLEECE, u), wool_d: pick(FLEECE, (u * 7) % 1) }) };
const FLEECE: RGB[] = [[0.82, 0.77, 0.66], [0.76, 0.7, 0.58], [0.34, 0.28, 0.23], [0.55, 0.45, 0.34]];
// (the modelled litter holds the straw, sherds, droppings and twigs: the other kinds only where it is not used within 6 m,
// so a view's draws stay few)
const LITTER: [string, number][] = [['fill_litter', 6], ['wo_spoil', 1.5], ['wo_dung_cakes', 0.6], ['wo_knucklebones', 0.25]];
const LITTER_S: Record<string, [number, number]> = { fill_litter: [0.8, 1.25], wo_fodder: [0.45, 0.8], sherds: [1.6, 2.6], wo_brushwood: [0.55, 0.9], wo_spoil: [0.45, 0.8], wo_dung_cakes: [0.7, 1.0], tool_stick: [0.8, 1.2], wo_knucklebones: [1, 1.2] };
/** a dump of hearth ash and swept earth: grey to the lane's khaki (sRGB) */
const ASH: RGB[] = [[0.5, 0.48, 0.45], [0.58, 0.54, 0.48], [0.62, 0.55, 0.44], [0.42, 0.4, 0.38]];

/** the Terrace's fill (C): grid positions from people_places.json's places and the stairs and gates */
export function terraceFill(seed = 1): FillItem[] {
  const P = new Map<string, any>(((placesJson as any).places as any[]).map(p => [p.id, p])), out: FillItem[] = [];
  const add = (m: string, e: number, n: number, rot: number, sc = 1, extra: Partial<FillItem> = {}) => out.push({ m, e, n, dy: 0, rot, s: [sc, sc, sc], at: 'terrace', ...extra });
  const scatter = (id: string, list: [string, number][], n: number, salt: number, extra: (k: number) => Partial<FillItem> = () => ({})) => { const p = P.get(id); if (!p?.span) return; const [[e0, n0], [e1, n1]] = p.span;
    for (let k = 0; k < n; k++) { const u = u01(seed, salt, k, 1), v = u01(seed, salt, k, 2); add(wpick(list, u01(seed, salt, k, 3)), e0 + 1 + u * (e1 - e0 - 2), n0 + 1 + v * (n1 - n0 - 2), u01(seed, salt, k, 4) * 6.283, 0.85 + 0.3 * u01(seed, salt, k, 5), extra(k)); } };
  // the masons' yard: the waste of dressing, quarry blocks waiting, rubble, the gang's fuel
  scatter('worksite', [['fill_chips', 5], ['fill_block', 3], ['fill_rubble', 1], ['fill_bundle', 1], ['sack', 0.6], ['jar_water', 0.6]], 26, 11);
  // the goods set down at the stair foot for carrying up (caravans unload here)
  { const sf = P.get('stair_foot')?.at as [number, number] | undefined; if (sf) for (let k = 0; k < 16; k++) { const a = u01(seed, 21, k, 1) * 6.283, r = 3 + 6 * u01(seed, 21, k, 2);
    add(wpick([['sack', 4], ['sack_lying', 2], ['bale', 2], ['jar_store', 2], ['fill_grain', 1], ['fill_bolts', 1]], u01(seed, 21, k, 3)), sf[0] - 4 + r * Math.cos(a) * 0.6, sf[1] + r * Math.sin(a), u01(seed, 21, k, 4) * 6.283, 0.9 + 0.2 * u01(seed, 21, k, 5),
      { col: { textile_a: cloth(u01(seed, 21, k, 6)), textile_b: cloth(u01(seed, 21, k, 7)) } }); } }
  // the work gang's querns: grain and sacks by them
  scatter('querns', [['fill_grain', 2], ['sack', 2], ['fill_produce', 0.5]], 6, 31);
  // the garrison: water jars at the water point, fuel at the hearths, the soldiers' bedding aired along the sleeping walls
  { const w = P.get('water')?.at as [number, number] | undefined; if (w) for (let k = 0; k < 6; k++) add(k % 3 ? 'jar_water' : 'jar_store', w[0] - 1.5 + (k % 3) * 0.7, w[1] - 1.2 + Math.floor(k / 3) * 0.8, k * 1.3, 0.9); }
  for (const id of ['garrison_hearth_s', 'garrison_hearth_m', 'garrison_hearth_n', 'work_hearth']) { const h = P.get(id)?.at as [number, number] | undefined; if (!h) continue;
    add('fill_bundle', h[0] + 1.6, h[1] + 0.8, 0.3, 1); add('fill_bundle', h[0] + 1.7, h[1] + 1.3, 0.1, 0.9); add('dung_stack', h[0] - 1.5, h[1] + 1.2, 0, 1); }
  scatter('garrison_sleep', [['roll', 3], ['mat', 1], ['jar_water', 1], ['sack', 1]], 30, 41, k => ({ col: { textile: cloth(u01(seed, 41, k, 9)) } }));
  // the Treasury store's sacks and jars stacked
  { const t = P.get('treasury_store')?.at as [number, number] | undefined; if (t) for (let k = 0; k < 12; k++) add(k % 3 === 2 ? 'jar_store' : 'sack', t[0] - 3 + (k % 6) * 1.0, t[1] - 1 + Math.floor(k / 6) * 1.1, u01(seed, 51, k) * 6.283, 0.95); }
  // the palace courts on an ordinary day (the court away; C): the servants' water jars, baskets and rolled mats along the
  // edges of the Harem's court and the Hadish's N court (SITE_SPEC harem.court, hadish.north_court: B), a few jars for laying
  // the dust in the forecourt; at every guard post a water jar and the guard's rolled mat
  const rectFill = (r: [number, number, number, number], list: [string, number][], n: number, salt: number) => { const [e0, e1, n0, n1] = r;
    for (let k = 0; k < n; k++) { const side = k % 4, t = u01(seed, salt, k, 1), inset = 0.8 + 1.2 * u01(seed, salt, k, 2);
      const e = side === 0 ? e0 + inset : side === 1 ? e1 - inset : e0 + 1 + t * (e1 - e0 - 2), nn = side === 2 ? n0 + inset : side === 3 ? n1 - inset : n0 + 1 + t * (n1 - n0 - 2);
      const m = wpick(list, u01(seed, salt, k, 3)); add(m, e, nn, u01(seed, salt, k, 4) * 6.283, 0.85 + 0.25 * u01(seed, salt, k, 5), { col: { textile: cloth(u01(seed, salt, k, 6)), fruit: pick(FRUIT, u01(seed, salt, k, 7)) } }); } };
  rectFill([101, 127, -125, -112], [['jar_water', 3], ['jar_store', 2], ['roll', 2], ['fill_produce', 1.5], ['sack', 1], ['bowl', 1], ['rug_folded', 1]], 18, 71);
  rectFill([-3, 40, -134, -109], [['jar_water', 3], ['jar_store', 1], ['roll', 1.5], ['rug_folded', 1], ['fill_produce', 0.5]], 14, 72);
  rectFill([-25, 30, 68, 95], [['jar_water', 3], ['jar_neck', 1], ['fill_bundle', 0.5]], 8, 73);
  for (const p of P.values()) if (p.kind === 'post') { const [e, n] = p.at as [number, number], a = ((p.heading ?? 0) * Math.PI) / 180, fe = Math.sin(a), fn = Math.cos(a);
    add('jar_water', e - fe * 0.6 + fn * 0.9, n - fn * 0.6 - fe * 0.9, u01(seed, 81, e, n) * 6.283, 0.8);
    if (u01(seed, 82, e, n) < 0.6) add('roll', e - fe * 0.7 - fn * 0.9, n - fn * 0.7 + fe * 0.9, Math.atan2(fe, -fn) + Math.PI / 2, 0.85, { col: { textile: cloth(u01(seed, 83, e, n)) } }); }
  // standards (C, after the royal standard of Xenophon: B): outside the Gate's W door and flanking the Apadana N stair
  for (const [id, de, dn] of [['post_gate_w1', -3.2, -1.2], ['post_gate_w2', -3.2, 1.2], ['post_apa_w', -2.0, 1.5], ['post_apa_e', 2.0, 1.5], ['post_hadish_1', -2.5, 1.0], ['post_tachara_1', -2.0, -1.5]] as [string, number, number][]) {
    const p = P.get(id)?.at as [number, number] | undefined; if (p) add('fill_standard', p[0] + de, p[1] + dn, rotFacing(0, -1), 1, { col: { cloth: [[0.55, 0.18, 0.14], [0.62, 0.48, 0.2], [0.3, 0.3, 0.5]][u01(seed, 61, de * 10, dn * 10) * 3 | 0] as RGB } }); }
  return out;
}
