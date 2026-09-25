// What the people burn, and the smoke it makes (brief §1.1 "smoke rising from the town at dusk as lamps are lit", §5.4
// "plumes that drift with the wind, a haze over the town at dusk"; rubric s7 pass 2 fix 5; D-220).
//
// The households' fires follow the people simulation's household day (population.ts hday: breakfast after sunrise, the
// evening meal before sunset, the 'cook' act that lights the fire 0.35 h before it, baking days and their hours). A hearth
// is lit (a smoky start from banked embers, dung cakes and twigs), burns through the meal, and then either is kept low
// through a cool evening and banked at bedtime, or dies to smouldering embers. The smoke a fire makes is its fuel burnt ×
// the particle emission factor of that phase; a column of it has an optical depth k·Q / (u·w). Over the town and the
// villages the smoke of all their fires gathers in a layer under the evening (and dawn) inversion: a leaky box over each
// quarter, ventilated by the wind across it and diluted into the air above, which drifts downwind as a tail. Seen along a
// grazing line of sight from the Terrace or the mountain, that layer is what reads at landscape scale (the single hearth's
// wisp does not). All numbers C (recollection of the biomass-burning literature, e.g. Reid et al. 2005 on smoke optics,
// household-stove emission factors; NOT SEEN); the fuel (dung cakes and brushwood) is C by analogy with the traditional
// villages of Fars and the sim's own 'shaping dung cakes for the fire' (activities.ts); the hours are the sim's (C, Q-064).
import type { HDay } from '../people/population';

/** mass extinction of fresh biomass smoke at 550 nm (m²/g; C) */
export const SMOKE_K = 4;
/** particle emission (g/h) of a household hearth in each phase: lighting (2 kg/h of dung cake and twigs smouldering into
 *  flame, ~30 g/kg), cooking (1.5 kg/h flaming, ~12 g/kg), smouldering embers (0.4 kg/h, ~30 g/kg), a low evening fire kept
 *  for warmth and light (0.6 kg/h, ~12 g/kg) (all C) */
export const HEARTH_GH = { out: 0, lighting: 60, flaming: 18, smoulder: 12, low: 7.2 } as const;
/** a bread oven (tannur-type, C): fired with brushwood ~0.4 h (5 kg/h, ~15 g/kg), then the bread slapped on its hot wall
 *  over the embers (0.5 kg/h, ~20 g/kg) */
export const OVEN_GH = { firing: 75, baking: 10 } as const;
export type Phase = 'out' | 'lighting' | 'flaming' | 'smoulder' | 'low' | 'firing' | 'baking';
export const PHASE_GH: Record<Phase, number> = { ...HEARTH_GH, ...OVEN_GH };
/** does a phase show a flame (the fire system's flame billboard and point light)? Embers and a baking oven do not */
export const FLAMING = new Set<Phase>(['lighting', 'flaming', 'low', 'firing']);
/** the width (m) and buoyant rise (m/s) of a fire's smoke where it leaves the fire or roof hole, and its emission (g/h) while
 *  burning when no household day drives it (C): a kiln's stack twice as wide and fast as a hearth's; a charcoal brazier
 *  hardly smokes; a pitch-soaked torch smokes a narrow sooty thread; the kept fire on the altar is dry wood */
export const SOURCE: Record<string, { w0: number; u0: number; gh: number }> = {
  hearth: { w0: 0.6, u0: 1, gh: HEARTH_GH.flaming }, oven: { w0: 0.6, u0: 1, gh: OVEN_GH.firing },
  kiln: { w0: 1.2, u0: 2, gh: 300 }, brazier: { w0: 0.6, u0: 1, gh: 1 }, torch: { w0: 0.15, u0: 1, gh: 25 },
  altar: { w0: 0.8, u0: 1, gh: 24 }, lamp: { w0: 0.02, u0: 0.3, gh: 0 },
};
/** a forge's charcoal under the bellows (a 'day' hearth in a workshop): ~2 kg/h at ~3 g/kg (C) */
export const FORGE_GH = 6;
/** optical depth across a fire's smoke where it leaves the fire: k · Q / (u0 · w0) */
export function sourceTau(kind: string, gh: number): number { const s = SOURCE[kind] ?? SOURCE.hearth; return (SMOKE_K * gh) / 3600 / (s.u0 * s.w0); }

/** the household day the fires follow (population.ts HDay) */
export type HDayLike = Pick<HDay, 'breakfast' | 'bLen' | 'supper' | 'sLen' | 'bake' | 'bakeAM' | 'bakeH'>;
export interface Span { t0: number; t1: number; ph: Phase }
/** relit this long before breakfast; the smoky lighting lasts LIGHT_H (C) */
export const RELIGHT_H = 0.3, LIGHT_H = 0.15;
/** the evening fire: lit by the 'cook' act 0.35 h before the evening meal (population.ts: insertAt(supper − 0.35)) */
export const COOK_LEAD_H = 0.35;
/** a cool evening keeps the fire low until bedtime (the night's minimum below this, °C; C) */
export const COLD_EVENING_C = 8;
/** the hearth's fires on a household day (hours of the day; C). `sunSet` (h) and whether the evening is cool enough to keep
 *  the fire (the day's minimum temperature below COLD_EVENING_C) */
export function hearthSpans(hd: HDayLike, sunSet: number, coolEvening: boolean): Span[] {
  const s: Span[] = [];
  const L = hd.breakfast - RELIGHT_H, mEnd = hd.breakfast + hd.bLen;
  s.push({ t0: L, t1: L + LIGHT_H, ph: 'lighting' }, { t0: L + LIGHT_H, t1: mEnd, ph: 'flaming' }, { t0: mEnd, t1: mEnd + 0.5, ph: 'smoulder' });
  const C = hd.supper - COOK_LEAD_H, eEnd = hd.supper + hd.sLen;
  s.push({ t0: C, t1: C + LIGHT_H, ph: 'lighting' }, { t0: C + LIGHT_H, t1: eEnd, ph: 'flaming' });
  // bedtime as the sim's household evening has it (population.ts: max(sunset + 0.6, min(21, supper + sLen + 0.4)))
  const bed = Math.max(sunSet + 0.6, Math.min(21, eEnd + 0.4));
  if (coolEvening && bed > eEnd) s.push({ t0: eEnd, t1: bed, ph: 'low' }, { t0: bed, t1: bed + 0.75, ph: 'smoulder' });
  else s.push({ t0: eEnd, t1: eEnd + 1.0, ph: 'smoulder' });
  return s;
}
/** the bread oven's fires on a baking day: before breakfast (bakeAM), else in the late afternoon (population.ts: knead from
 *  supper − 1.2 h for 0.35 h, then bake ~0.5 h); the oven is fired while the dough is readied */
export function ovenSpans(hd: HDayLike): Span[] {
  if (!hd.bake) return [];
  if (hd.bakeAM) { const b1 = hd.breakfast - 0.05, b0 = b1 - hd.bakeH; return [{ t0: b0 - 0.4, t1: b0, ph: 'firing' }, { t0: b0, t1: b1, ph: 'baking' }]; }
  const k0 = hd.supper - 1.2; return [{ t0: k0, t1: k0 + 0.35, ph: 'firing' }, { t0: k0 + 0.35, t1: k0 + 0.85, ph: 'baking' }];
}
export function phaseAt(spans: Span[], h: number): Phase { for (const s of spans) if (h >= s.t0 && h < s.t1) return s.ph; return 'out'; }

/** emission curves: g/h in BIN_H bins over the day */
export const BIN_H = 1 / 30, BINS = Math.round(24 / BIN_H);
export function addSpans(curve: Float32Array, spans: Span[], scale = 1) {
  for (const s of spans) { const g = PHASE_GH[s.ph] * scale; if (!g) continue;
    for (let b = Math.max(0, Math.floor(s.t0 / BIN_H)); b < Math.min(BINS, Math.ceil(s.t1 / BIN_H)); b++) {
      const a0 = b * BIN_H, a1 = a0 + BIN_H, ov = Math.min(a1, s.t1) - Math.max(a0, s.t0); if (ov > 0) curve[b] += (g * ov) / BIN_H; } }
}

// ---- the layer over a settlement ------------------------------------------------------------------------------------
/** time for the evening layer to dilute into the air above it (s; C: entrainment through a surface inversion, 30-60 min) */
export const DILUTE_S = 2400;
/** the slowest air that carries the smoke off (m/s): the down-valley drainage breeze of a still evening (C) */
export const U_MIN = 0.5;
/** the longest drawn tail downwind (m) */
export const TAIL_MAX = 1500;
/** the layer's vertical profile: e^(−h/H1) − e^(−h/H2) (zero at the ground, the plumes' smoke spreading where they level
 *  off under the inversion: the peak at ~14 m for H1 30 m). In the stable air of dusk, night and dawn H1 = 30 m; the day's
 *  convection mixes it up to ~600 m by a sun of 30° (C) */
export function layerHeights(sunAltDeg: number): { H1: number; H2: number } {
  const t = Math.min(1, Math.max(0, (sunAltDeg - 3) / 27)), s = t * t * (3 - 2 * t), H1 = 30 + 570 * s;
  return { H1, H2: H1 * 0.27 };
}
/** height of the layer's peak (m) */
export function layerPeak(H1: number, H2: number) { return (Math.log(H1 / H2) * H1 * H2) / (H1 - H2); }
/** the column of smoke (g/m²) over a settlement of area `area` m² and extent `L` m along the wind, at hour `h`, from its
 *  emission curve (g/h per bin): a leaky box, ventilated by the wind across it (L / u) and diluted upward (DILUTE_S) */
export function columnMass(curve: Float32Array, area: number, L: number, windMs: number, h: number): number {
  const u = Math.max(U_MIN, windMs), tr = 1 / (u / L + 1 / DILUTE_S); // residence time (s)
  let M = 0; const bs = BIN_H * 3600, nb = Math.min(BINS, Math.floor(h / BIN_H) + 1);
  for (let b = Math.max(0, nb - Math.ceil((8 * tr) / bs) - 1); b < nb; b++) {
    const g = curve[b]; if (!g) continue;
    const e0 = b * BIN_H, e1 = Math.min(h, e0 + BIN_H); if (e1 <= e0) continue;
    const since = (h - e1) * 3600, dur = (e1 - e0) * 3600; // seconds since the bin's end, and its length up to now
    M += ((g / 3600) / area) * tr * (1 - Math.exp(-dur / tr)) * Math.exp(-since / tr);
  }
  return M;
}
/** one smoke cell (a quarter or a village) as the renderer draws it (world coordinates: x east, z = −north) */
export interface SmokeCell {
  id: string; cx: number; cz: number; /** world angle of the along-wind axis (rad: local +x = (cos, sin) in world x, z) */ angle: number;
  R: number; Rw: number; tail: number; Ld: number; H1: number; H2: number;
  /** extinction scale (1/m): k · M / (H1 − H2), so σ(h) = sigma · (e^(−h/H1) − e^(−h/H2)) over the footprint */
  sigma: number; gy0: number; gx: number; gz: number; y0: number; y1: number; seed: number; E: number;
}
/** the horizontal profile of a cell at local (x along the wind, z across): the footprint (a ramp as the smoke gathers
 *  across it), the downwind tail (e^(−x/Ld)) and soft edges (C) */
export function cellProfile(c: Pick<SmokeCell, 'R' | 'Rw' | 'Ld'>, x: number, z: number): number {
  const E = Math.min(60, c.Rw * 0.5), ss = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const across = 1 - ss(c.Rw - E, c.Rw + E, Math.abs(z)), up = ss(-c.R - E, -c.R + E, x);
  const ramp = 0.35 + 0.65 * Math.min(1, Math.max(0, (x + c.R) / (2 * c.R))), tail = Math.exp(-Math.max(0, x - c.R) / c.Ld);
  return across * up * ramp * tail;
}
/** CPU mirror of the renderer's optical depth along a ray (origin o, unit direction d, world) through a cell, with the
 *  same six segments, exact vertical integrals and midpoint profile (landSmoke.ts; the noise left out: its mean is 1) */
export function cellTau(c: SmokeCell, o: [number, number, number], d: [number, number, number]): number {
  const ca = Math.cos(c.angle), sa = Math.sin(c.angle), E = Math.min(60, c.Rw * 0.5);
  const dx0 = o[0] - c.cx, dz0 = o[2] - c.cz, ox = dx0 * ca + dz0 * sa, oz = -dx0 * sa + dz0 * ca, oy = o[1];
  const dx = d[0] * ca + d[2] * sa, dz = -d[0] * sa + d[2] * ca, dy = d[1];
  const lo = [-c.R - E, c.y0, -(c.Rw + E)], hi = [c.R + c.tail, c.y1, c.Rw + E], oo = [ox, oy, oz], dd = [dx, dy, dz];
  let tn = -Infinity, tf = Infinity;
  for (let k = 0; k < 3; k++) { const inv = 1 / (Math.abs(dd[k]) < 1e-9 ? 1e-9 : dd[k]), a = (lo[k] - oo[k]) * inv, b = (hi[k] - oo[k]) * inv; tn = Math.max(tn, Math.min(a, b)); tf = Math.min(tf, Math.max(a, b)); }
  const h0 = oy - (c.gy0 + c.gx * ox + c.gz * oz), hd = dy - (c.gx * dx + c.gz * dz);
  let t0 = Math.max(tn, 0), t1 = tf; if (hd < 0) t1 = Math.min(t1, -h0 / hd);
  const L = Math.max(0, t1 - t0); if (L <= 0) return 0;
  const I = (ha: number, hb: number, dt: number, H: number) => Math.abs(hd * dt) > 1e-3 * H ? ((Math.exp(-ha / H) - Math.exp(-hb / H)) * H) / hd : Math.exp(-(ha + hb) / 2 / H) * dt;
  let tau = 0;
  for (let i = 0; i < 6; i++) { const ta = t0 + (L * i) / 6, tb = ta + L / 6, ha = Math.max(0, h0 + ta * hd), hb = Math.max(0, h0 + tb * hd), tm = (ta + tb) / 2;
    tau += (I(ha, hb, L / 6, c.H1) - I(ha, hb, L / 6, c.H2)) * cellProfile(c, ox + tm * dx, oz + tm * dz); }
  return c.sigma * tau;
}
/** a cell for a settlement of centre (e, n grid), footprint half-sizes `R` × `R` (m, a square of the same area), emission
 *  curve and ground `H` (grid e, n → world y), in the wind (m/s, blowing FROM `windDirDeg` true) at hour `h` */
export function makeCell(id: string, e: number, n: number, R: number, curve: Float32Array, H: (e: number, n: number) => number, windMs: number, windDirDeg: number, sunAltDeg: number, h: number, seed: number): SmokeCell {
  const area = 4 * R * R, u = Math.max(U_MIN, windMs), M = columnMass(curve, area, 2 * R, windMs, h), { H1, H2 } = layerHeights(sunAltDeg);
  const w = windWorld(windDirDeg, 1), angle = Math.atan2(w[2], w[0]); // local +x downwind
  const Ld = u * DILUTE_S, tail = Math.min(3 * Ld, TAIL_MAX), Rw = R, E = Math.min(60, Rw * 0.5);
  const cx = e, cz = -n, ca = Math.cos(angle), sa = Math.sin(angle);
  // the ground as a plane fitted over the footprint (least squares over a 5 × 5 grid in the local frame). The tail keeps it:
  // where the land beyond rises above the layer (Kuh-e Rahmat), the box lies in the hill and its faces are hidden there (a
  // plane fitted over the whole tail tilted up the mountain and lifted the layer off the town: first node run, D-220)
  const xs = [-R - E, -R / 2, 0, R / 2, R + E], zs = [-(Rw + E), -Rw / 2, 0, Rw / 2, Rw + E]; let sx = 0, sz = 0, sxx = 0, szz = 0, sy = 0, sxy = 0, szy = 0, N = 0, ymin = Infinity;
  for (const x of xs) for (const z of zs) { const wx = cx + x * ca - z * sa, wz = cz + x * sa + z * ca, y = H(wx, -wz); ymin = Math.min(ymin, y); sx += x; sz += z; sy += y; sxx += x * x; szz += z * z; sxy += x * y; szy += z * y; N++; }
  const mx = sx / N, mz = sz / N, my = sy / N, gx = (sxy - N * mx * my) / Math.max(1e-6, sxx - N * mx * mx), gz = (szy - N * mz * my) / Math.max(1e-6, szz - N * mz * mz);
  const gy0 = my - gx * mx - gz * mz; let pmin = ymin, pmax = -Infinity;
  for (const x of [-R - E, R + tail]) for (const z of [-(Rw + E), Rw + E]) { const p = gy0 + gx * x + gz * z; pmin = Math.min(pmin, p); pmax = Math.max(pmax, p); }
  return { id, cx, cz, angle, R, Rw, tail, Ld, H1, H2, sigma: (SMOKE_K * M) / (H1 - H2), gy0, gx, gz, y0: pmin - 3, y1: pmax + Math.min(6 * H1, 400), seed, E: curve[Math.min(BINS - 1, Math.max(0, Math.floor(h / BIN_H)))] };
}
/** the wind as a world vector of speed `ms` (it blows FROM windDirDeg true; grid north is 341° true; world x east, z south):
 *  the same convention as the fire system's smoke (fire.ts) */
export function windWorld(windDirDeg: number, ms: number): [number, number, number] {
  const wr = ((windDirDeg + 180 - 341) * Math.PI) / 180; return [Math.sin(wr) * ms, 0, -Math.cos(wr) * ms];
}

// ---- the model: the sim's households → the fires' state and the settlements' smoke cells ----------------------------
/** what the model needs of the population (population.ts Population) */
export interface PopLike {
  households: { zone: string; plot?: string; plots?: string[]; members: number[] }[];
  hday(h: number, d: number): HDayLike;
  cal: { ctx(d: number): { sun: { rise: number; set: number }; wx: { tmin: number } } };
}
/** what the model needs of a fire (fire.ts FireSource) */
export interface FireLike { kind: string; sched?: string; plot?: string; group?: string }
/** a settlement the smoke gathers over: a town quarter (its households: those whose house plot lies in it) or a village of
 *  the plain (its households counted from its population) */
export interface SmokeSite { id: string; e: number; n: number; R: number; kind: 'quarter' | 'village'; pop?: number }
/** every PLAIN_SAMPLE-th household of the plain gives the villages' mean hearth day (their own positions in the sim do not
 *  match the rendered villages: Q-503) */
export const PLAIN_SAMPLE = 8;
export class SmokeModel {
  /** per fire: the household whose day drives it (−1: none; the fire keeps its schedule) */
  readonly fireHh: Int32Array;
  /** per fire, set by update(): 1 flame shown, 0 out or embers, −1 the fire's own schedule; and its emission (g/h, −1: the
   *  default of its kind while its schedule has it lit) */
  readonly lit: Int8Array; readonly gh: Float32Array;
  private day = -1; private hearth = new Map<number, Span[]>(); private oven = new Map<number, Span[]>();
  private curves = new Map<string, Float32Array>(); private plainMean = new Float32Array(BINS);
  private siteHh = new Map<string, number[]>(); private personsPerHh = 5;
  private siteCurve = new Map<string, Float32Array>();
  /** the cells of the last update (quarters and villages with smoke) */
  cells: SmokeCell[] = [];
  constructor(private pop: PopLike, private fires: FireLike[], readonly sites: SmokeSite[], private H: (e: number, n: number) => number) {
    const byPlot = new Map<string, number>();
    pop.households.forEach((hh, i) => { if (hh.zone !== 'town') return; for (const p of hh.plots ?? (hh.plot ? [hh.plot] : [])) if (!byPlot.has(p)) byPlot.set(p, i);
      const site = (hh.plot ?? '').split('-')[0]; if (site) { if (!this.siteHh.has(site)) this.siteHh.set(site, []); this.siteHh.get(site)!.push(i); } });
    this.fireHh = new Int32Array(fires.length).fill(-1);
    fires.forEach((f, i) => { if (f.plot && ((f.kind === 'hearth' && f.sched === 'home') || (f.kind === 'oven' && f.sched === 'bake'))) this.fireHh[i] = byPlot.get(f.plot) ?? -1; });
    this.lit = new Int8Array(fires.length).fill(-1); this.gh = new Float32Array(fires.length).fill(-1);
    let pn = 0, pc = 0; pop.households.forEach(hh => { if (hh.zone === 'plain') { pn++; pc += hh.members.length; } }); if (pn) this.personsPerHh = pc / pn;
  }
  /** households linked to a fire, and town households per quarter (tests, F3) */
  linkStats() { let linked = 0; for (const h of this.fireHh) if (h >= 0) linked++; return { fires: this.fires.length, linked, quarters: Object.fromEntries([...this.siteHh].map(([k, v]) => [k, v.length])), personsPerPlainHh: +this.personsPerHh.toFixed(2) }; }
  private spansFor(h: number, d: number) {
    const C = this.pop.cal.ctx(d), hd = this.pop.hday(h, d);
    return { hearth: hearthSpans(hd, C.sun.set, C.wx.tmin < COLD_EVENING_C), oven: ovenSpans(hd) };
  }
  /** the day's fires of every linked or quarter household, and the emission curves (once a day) */
  private build(d: number) {
    this.day = d; this.hearth.clear(); this.oven.clear(); this.curves.clear(); this.plainMean.fill(0);
    const need = new Set<number>(); for (const h of this.fireHh) if (h >= 0) need.add(h); for (const l of this.siteHh.values()) for (const h of l) need.add(h);
    for (const h of need) { const s = this.spansFor(h, d); this.hearth.set(h, s.hearth); this.oven.set(h, s.oven); }
    for (const [site, l] of this.siteHh) { const c = new Float32Array(BINS); for (const h of l) { addSpans(c, this.hearth.get(h)!); addSpans(c, this.oven.get(h)!); } this.curves.set(site, c); }
    let n = 0; this.pop.households.forEach((hh, i) => { if (hh.zone !== 'plain' || i % PLAIN_SAMPLE) return; const s = this.spansFor(i, d); addSpans(this.plainMean, s.hearth); addSpans(this.plainMean, s.oven); n++; });
    if (n) for (let b = 0; b < BINS; b++) this.plainMean[b] /= n;
  }
  /** emission curve (g/h per bin) of a site on the model's day */
  curve(site: SmokeSite): Float32Array {
    if (site.kind === 'quarter') return this.curves.get(site.id) ?? new Float32Array(BINS);
    const k = (site.pop ?? 0) / this.personsPerHh, c = new Float32Array(BINS); for (let b = 0; b < BINS; b++) c[b] = this.plainMean[b] * k; return c;
  }
  /** the phase of a linked fire now (tests, F3) */
  phaseOf(i: number, hour: number): Phase | null { const h = this.fireHh[i]; if (h < 0) return null; return phaseAt((this.fires[i].kind === 'oven' ? this.oven : this.hearth).get(h) ?? [], hour); }
  /** the fires' state and the cells at (day, hour) in the wind (m/s, FROM windDirDeg true) with the sun at sunAlt */
  update(day: number, hour: number, windMs: number, windDirDeg: number, sunAltDeg: number) {
    if (day !== this.day) { this.build(day); this.siteCurve.clear(); for (const s of this.sites) this.siteCurve.set(s.id, this.curve(s)); }
    for (let i = 0; i < this.fires.length; i++) { const ph = this.phaseOf(i, hour); if (ph === null) { this.lit[i] = -1; this.gh[i] = -1; continue; }
      this.lit[i] = FLAMING.has(ph) ? 1 : 0; this.gh[i] = PHASE_GH[ph]; }
    this.cells = [];
    this.sites.forEach((s, k) => { const c = makeCell(s.id, s.e, s.n, s.R, this.siteCurve.get(s.id)!, this.H, windMs, windDirDeg, sunAltDeg, hour, k * 7.31);
      if (c.sigma > 1e-7) this.cells.push(c); });
    return this.cells;
  }
}
