// The year of events (brief §9.5 "a year of events, driven by the calendar and the tablets"; research/EVENTS.md and
// src/data/events_calendar.json; DECISIONS D-021). Every scheduled instance is drawn from a pure hash of
// (seed, event id, period), so the calendar is the same whenever and however fast it is computed; the stores and the
// cause-and-effect rules (CE-01 … CE-20) are processed day by day in time order. Court state: the default is the
// evidence-strict court ABSENT (D-003); rows with `setting: court_resident` run only when that setting is on.
// All rhythms are tier C unless the row says otherwise (the dated evidence is Darius-era, EVENTS.md "read this first").
import calData from '../data/events_calendar.json';
import popData from '../data/population.json';
import { u01, poisson, salt } from './hash';
import { Construction, BuildEvent, StoneTasks } from './construction';
import type { Population } from './population';
import * as Astro from 'astronomy-engine';
import { LATITUDE_N, LONGITUDE_E } from '../core/calendar';

export const CAL = calData as any;
export const POP = popData as any;
export const REGNAL_DAYS = 354;
/** the event taxonomy (research `kind` values); the soak counts distinct kinds from this set only */
export const EVENT_KINDS: string[] = [...new Set<string>(CAL.events.map((e: any) => e.kind))];
export interface Month { n: number; bab: string; op: string; elam: string; start: number; days: number }
export const MONTHS: Month[] = CAL.months.map((m: any) => ({ n: m.n, bab: m.bab, op: m.op, elam: m.elam, start: m.jdn - CAL.months[0].jdn, days: m.days }));
export function dateOf(day: number) {
  const d = ((Math.floor(day) % REGNAL_DAYS) + REGNAL_DAYS) % REGNAL_DAYS; let m = MONTHS[0];
  for (const x of MONTHS) if (d >= x.start) m = x;
  return { month: m.n, dom: d - m.start + 1, m };
}
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export function seasonOf(month: number): Season { for (const s of ['spring', 'summer', 'autumn', 'winter'] as Season[]) if (POP.seasons[s].months.includes(month)) return s; return 'spring'; }

const LAT = LATITUDE_N * Math.PI / 180;
/** the apparent sun's altitude at rise and set: 34′ of refraction and the 16′ semi-diameter (h0 = −0.833°, the standard
 *  value; Meeus, Astronomical Algorithms ch. 15: B) */
export const SUN_H0_DEG = -0.833;
const sunCache = new Map<number, { rise: number; set: number }>();
/** sunrise/sunset in local apparent solar hours (noon = 12) for a day of the regnal year (day 0 = 1 Nisanu = 17 Apr 467 BCE
 *  Julian, JDN 1550958: events_calendar.json months[0]). The sun's declination of date at local noon comes from the sky's
 *  own ephemeris (astronomy-engine, VSOP87-class, precession and nutation of date: the obliquity of 467 BCE, about 23.75°,
 *  is in it), and the hour angle of the apparent sun at h0 = −0.833° (S10 of shadow review r5: was the sun's centre on the
 *  horizon, with today's obliquity in a cosine declination: sunrise 3-6 min late and sunset 4-7 min early). B */
export function sunTimes(day: number): { rise: number; set: number } {
  const k = Math.round(day * 1000); const c = sunCache.get(k); if (c) return c;
  const jd = CAL.months[0].jdn + day - 0.5 + (12 - LONGITUDE_E / 15) / 24; // local noon, in UT
  const eq = Astro.Equator(Astro.Body.Sun, Astro.MakeTime(jd - 2451545.0), SUN_OBSERVER, true, true);
  const dec = eq.dec * Math.PI / 180, h0 = SUN_H0_DEG * Math.PI / 180;
  const h = Math.acos(Math.max(-1, Math.min(1, (Math.sin(h0) - Math.sin(LAT) * Math.sin(dec)) / (Math.cos(LAT) * Math.cos(dec))))) * 12 / Math.PI;
  const r = { rise: 12 - h, set: 12 + h }; if (sunCache.size < 4096) sunCache.set(k, r); return r;
}
const SUN_OBSERVER = new Astro.Observer(LATITUDE_N, LONGITUDE_E, 0);

// ------------------------------------------------------------------ weather of a day, as the people feel it
export interface EnvLike { rain: number; lightning: boolean; tempC: number; dust?: number; windMs?: number }
export interface DayWx { wet: boolean; rain: [number, number] | null; rainH: number; storm: boolean; stormH: [number, number] | null; dust: boolean; frost: boolean; hot: boolean; tmax: number; tmin: number;
  /** the hours the dust is in the air (dust > 0.25; W-03), or null: a dust day is a day whose dust rises above 0.5 */
  dustH: [number, number] | null;
  /** mean wind (m/s) of the morning (07-11) and of the afternoon (14-18): winnowing needs a wind (E-43) */
  windAM: number; windPM: number;
  /** the day's 96 quarter-hours: 1 where it rains (rain > 0.25, the shelter rule), else 0. `rain` is the span from the first
   *  to the last of them and may hold dry spells; this says when it actually rains (S1 of shadow review r5) */
  rainQ: number[];
  /** the day's 96 quarter-hours' air temperature (°C): the dress of the cold (Planner.weatherWear, outfits.weatherMask) */
  tempQ: number[];
  /** the span of the quarter-hours with lightning, or null. `storm` and `stormH` are the heavy weather that stops the work
   *  (lightning or rain > 0.7: the rule is kept); the words say "storm" only where it thunders, and "heavy rain" where it does
   *  not (A S8 of shadow review r9: 14 of the year's 18 "storm" days had no lightning; D-211) */
  thunderH: [number, number] | null }
/** sampled from the hourly weather: rain > 0.25 = people shelter (the Phase 3 rule); lightning or rain > 0.7 = storm */
/** hours of rain (the shelter rule's quarter-hours) between t0 and t1 of a day */
export function rainHours(wx: DayWx, t0: number, t1: number): number {
  if (!wx.rain || t1 <= t0) return 0; let h = 0; const a = Math.max(0, t0), b = Math.min(24, t1);
  for (let q = Math.max(0, Math.floor(a * 4)); q < 96 && q * 0.25 < b; q++) if (wx.rainQ[q]) h += Math.max(0, Math.min(b, q * 0.25 + 0.25) - Math.max(a, q * 0.25));
  return h;
}
/** the day's spells of rain: runs of rainy quarter-hours, with dry gaps shorter than `gap` hours joined into the spell
 *  (rain on and off is one wet spell), as [start, end] hours */
export function rainSpells(wx: DayWx, gap = 0.5): [number, number][] {
  const out: [number, number][] = []; if (!wx.rain) return out;
  for (let q = 0; q < 96; q++) { if (!wx.rainQ[q]) continue; const a = q * 0.25; let e = q; while (e + 1 < 96 && wx.rainQ[e + 1]) e++; const b = e * 0.25 + 0.25;
    const L = out[out.length - 1]; if (L && a - L[1] < gap - 1e-9) L[1] = b; else out.push([a, b]); q = e; }
  return out;
}
export function dayWx(env: (t: number) => EnvLike, day: number): DayWx {
  let r0 = -1, r1 = -1, s0 = -1, s1 = -1, l0 = -1, l1 = -1, d0 = -1, d1 = -1, rainH = 0, tmax = -99, tmin = 99, dust = 0, wa = 0, na = 0, wp = 0, np = 0; const rainQ: number[] = [], tempQ: number[] = [];
  for (let q = 0; q < 96; q++) {
    const h = q * 0.25 + 0.125, e = env(day * 24 + h);
    rainQ.push(e.rain > 0.25 ? 1 : 0); tempQ.push(e.tempC);
    if (e.rain > 0.25) { if (r0 < 0) r0 = h - 0.125; r1 = h + 0.125; rainH += 0.25; }
    if (e.lightning || e.rain > 0.7) { if (s0 < 0) s0 = h - 0.125; s1 = h + 0.125; }
    if (e.lightning) { if (l0 < 0) l0 = h - 0.125; l1 = h + 0.125; }
    if ((e.dust ?? 0) > 0.25) { if (d0 < 0) d0 = h - 0.125; d1 = h + 0.125; }
    tmax = Math.max(tmax, e.tempC); tmin = Math.min(tmin, e.tempC); dust = Math.max(dust, e.dust ?? 0);
    if (h >= 7 && h < 11) { wa += e.windMs ?? 0; na++; } else if (h >= 14 && h < 18) { wp += e.windMs ?? 0; np++; }
  }
  return { wet: rainH >= 0.5, rain: r0 >= 0 ? [r0, r1] : null, rainH, storm: s0 >= 0, stormH: s0 >= 0 ? [s0, s1] : null, dust: dust > 0.5, dustH: dust > 0.5 && d0 >= 0 ? [d0, d1] : null, frost: tmin < 0, hot: tmax > 33, tmax, tmin, windAM: na ? wa / na : 0, windPM: np ? wp / np : 0, rainQ, tempQ, thunderH: l0 >= 0 ? [l0, l1] : null };
}

// ------------------------------------------------------------------ pure schedules (also used to create transients)
const ROW: Record<string, any> = Object.fromEntries(CAL.events.map((e: any) => [e.id, e]));
export const eventRow = (id: string) => ROW[id];
const monthsOk = (row: any, month: number) => row.months === 'all' || (Array.isArray(row.months) && row.months.includes(month));
const clip = (n: number, r?: [number, number]) => (r ? Math.max(r[0], Math.min(r[1], n)) : n);
function rowMean(row: any, month: number, court: boolean) {
  const r = row.rule; if (court && r.court_resident_mean != null) return r.court_resident_mean;
  if (r.mean_by_month) return r.mean_by_month[String(month)] ?? r.mean_by_month.other ?? 0;
  return r.mean ?? 0;
}
/** hours at which instances of a kind happen (C: daylight for work and transport; couriers ride at any hour, HDT 8.98) */
const HOURS: Record<string, [number, number]> = { courier: [0, 24], delivery: [7, 16], treasury_payment: [9, 14], milling: [7, 10], brewing: [7, 10], slaughter: [6, 9],
  travellers: [9, 18], offering: [6, 10], flock_drive: [6, 7], work_group_transfer: [10, 16], record_keeping: [8, 15], pastoral: [7, 17], treasury_draw: [9, 13], special_ration: [8, 11], ration_issue: [7, 10] };
export interface Inst { day: number; hour: number; k: number }
/** all instances of a `rate` row over the year (deterministic per (seed, id, period)) */
export function rateSchedule(seed: number, id: string, court = false, idSalt = salt(id)): Inst[] {
  const row = ROW[id]; const r = row.rule; const out: Inst[] = [];
  if (r.type !== 'rate' || (row.setting === 'court_resident' && !court)) return out;
  const hr = HOURS[row.kind] ?? [8, 16];
  const at = (day: number, k: number) => ({ day, k, hour: hr[0] + (hr[1] - hr[0]) * u01(seed, idSalt, 7, day, k) });
  const per = court && r.court_resident_per_day != null ? 'day' : r.per;
  if (per === 'day') for (let d = 0; d < REGNAL_DAYS; d++) { const { month } = dateOf(d); if (!monthsOk(row, month)) continue;
    const m = court && r.court_resident_per_day != null ? r.court_resident_per_day : rowMean(row, month, court); const n = clip(poisson(u01(seed, idSalt, 1, d), m), r.range);
    for (let k = 0; k < n; k++) out.push(at(d, k)); }
  if (per === 'week') for (let w = 0; w * 7 < REGNAL_DAYS; w++) { const n = clip(poisson(u01(seed, idSalt, 2, w), rowMean(row, dateOf(w * 7).month, court)), r.range);
    for (let k = 0; k < n; k++) { const d = w * 7 + Math.floor(u01(seed, idSalt, 3, w, k) * 7); if (d < REGNAL_DAYS && monthsOk(row, dateOf(d).month)) out.push(at(d, k)); } }
  if (per === 'month') for (const M of MONTHS) { if (!monthsOk(row, M.n)) continue; const n = clip(poisson(u01(seed, idSalt, 4, M.n), rowMean(row, M.n, court)), r.range);
    for (let k = 0; k < n; k++) out.push(at(M.start + Math.floor(u01(seed, idSalt, 5, M.n, k) * M.days), k)); }
  if (per === 'year') { const days: number[] = []; for (let d = 0; d < REGNAL_DAYS; d++) if (monthsOk(row, dateOf(d).month)) days.push(d);
    const n = clip(poisson(u01(seed, idSalt, 6), rowMean(row, 1, court)), r.range);
    for (let k = 0; k < n && days.length; k++) out.push(at(days[Math.floor(u01(seed, idSalt, 8, k) * days.length)], k)); }
  return out.sort((a, b) => a.day - b.day || a.hour - b.hour);
}
/** travelling parties with a halmi (E-21): size 1–20 typical (C, Q-041), staying 1–5 days (C) */
export function travellerParties(seed: number, court: boolean) {
  return rateSchedule(seed, 'E-21', court).map((x, i) => { const u = u01(seed, salt('party'), i);
    const size = Math.max(1, Math.min(20, Math.round(Math.exp(u * Math.log(20))))); return { i, day: x.day, hour: x.hour, size, stay: 1 + Math.floor(u01(seed, salt('stay'), i) * 5),
      route: (ROW['E-21'].routes as string[])[Math.floor(u01(seed, salt('route'), i) * ROW['E-21'].routes.length)] }; });
}
/** large work-group transfers (E-23): 50–1,633 persons (HYLAND2022 B for the 1,633; the size draw is C) */
export function transfers(seed: number) {
  return rateSchedule(seed, 'E-23').map((x, i) => ({ i, day: x.day, hour: x.hour, size: Math.round(50 + (300 - 50) * u01(seed, salt('xfer'), i)), kind: u01(seed, salt('xferk'), i) < 0.5 ? 'pasap_group' : 'construction_gang' }));
}
/** transhumant bands passing (E-49): herding families of 5–40 people (C; D-150), 2–4 days in the plain (C) */
export function transhumantBands(seed: number) {
  // the band reaches the plain in the morning (08:00–11:00): a flock is moved in the cool hours and lies up through the heat
  // (lives.json herders; shadow review r8, 44216: a band came down from 05:17 and reached its first camp at 16:01; C)
  return rateSchedule(seed, 'E-49').map((x, i) => ({ i, day: x.day, hour: 8 + (3 * (x.hour - HOURS.pastoral[0])) / (HOURS.pastoral[1] - HOURS.pastoral[0]), size: 5 + Math.floor(u01(seed, salt('band'), i) * 36), stay: 2 + Math.floor(u01(seed, salt('bstay'), i) * 3) }));
}
/** the heavy weather's word for [a, b]: "storm" where it thunders then (within half an hour), "heavy rain" where it does not
 *  (A S8 of shadow review r9; D-211) */
export function stormWord(wx: DayWx, a = 0, b = 24): 'storm' | 'heavy rain' { const l = wx.thunderH; return l && a < l[1] + 0.5 && b > l[0] - 0.5 ? 'storm' : 'heavy rain'; }
/** the festival days of the year (D-211; E-33, E-38; C): the šip at the offering place, and the day off for the town's work
 *  groups and the Terrace's gangs. The dates are C: a šip at the opening of the year (the Babylonian akītu is held in the
 *  first days of Nisannu: B for Babylon, an analogy here) and one on the festival of the seventh month, Bāgayādiš, "the
 *  worship of baga" (the month's name is A; the festival behind it C) */
export interface Festival { id: 'E-33'; k: number; day: number; name: string; bagayadis: boolean; sheep: [number, number]; grain: [number, number]; wine: [number, number]; beer: [number, number]; hours: [number, number] }
const festCache = new Map<number, Festival[]>();
export function festivals(seed: number): Festival[] {
  const c = festCache.get(seed); if (c) return c; const R = ROW['E-33'].rule;
  const out: Festival[] = (R.instances as any[]).map((x, k) => { const M = MONTHS[x.month - 1], dom = x.dom[0] + Math.floor(u01(seed, salt('E-33d'), k) * (x.dom[1] - x.dom[0] + 1));
    return { id: 'E-33' as const, k, day: M.start + dom - 1, name: x.festival, bagayadis: !!x.bagayadis, sheep: R.sheep, grain: R.grain, wine: R.wine, beer: R.beer, hours: R.hours }; });
  festCache.set(seed, out); return out;
}
/** the festival on a day, or null */
export function festivalOn(seed: number, day: number): Festival | null { return festivals(seed).find(f => f.day === day) ?? null; }
/** the drive of tax animals and 'the sheep of the king' to Susa (E-13); away 50–70 days (552 km at a flock's pace, C) */
export function flockDrives(seed: number) {
  return rateSchedule(seed, 'E-13').map((x, i) => ({ i, day: x.day, hour: x.hour, away: 50 + Math.floor(u01(seed, salt('drive'), i) * 21) }));
}

// ------------------------------------------------------------------ the calendar with stores and cause-and-effect
export interface CalEvent { t: number; id: string; kind: string; text: string; place: string; tier: string; n?: number }
export interface DayCtx {
  day: number; month: number; dom: number; season: Season; wx: DayWx; sun: { rise: number; set: number }; court: boolean;
  events: CalEvent[];
  issue: Map<number, number>; special: Map<number, number>; wine: Map<number, number>; maternity: Map<number, number>;
  payments: { t: number; group: number }[]; deliveries: { t: number; id: string; qty: number; place: string }[];
  couriers: { t: number; treasury: boolean }[];
  /** the sealed letters taken up to the Treasury today, at the hour the messenger sets out from the station (go; j: which
   *  letter, for the turn of the men on duty): today's that come before sunset − 1.1 h, taken up once the desk is open
   *  (sunrise + 1.3 h), and yesterday's that came later, kept at the station overnight (C; D-211) */
  letters: { go: number; j: number }[]; slaughter: number[]; milling: number[]; brewing: number[];
  offerings: { t: number; id: string; place: string; god?: string }[];
  agri: Set<string>; river: string; winter: boolean; brick: boolean; heatRest: boolean; firstRain: boolean;
  /** a festival day (E-33, E-38; D-211): the šip at the offering place and the day off, or null */
  festival: Festival | null;
  doubled: [number, number][]; disputes: Map<number, { t: number; other: number; place: string; why: string }>;
  short: Map<number, number>; build: StoneTasks; counts: Record<string, number>;
}
export interface Stores { grain: number; flour: number; tarmu: number; beer: number; wine: number; figs: number; sesame: number; sheep: number; hides: number; poultry: number; silver_paid: number; tablets: number }
/** stock bounds for the soak's stability gate (C; D-021): never below the floor, never above the capacity */
export const STORE_BOUNDS: Record<keyof Stores, [number, number] | null> = { grain: [0, 250000], flour: [0, 20000], tarmu: [0, 10000], beer: [0, 5000], wine: [0, 5000], figs: [0, 5000], sesame: [0, 5000], sheep: [100, 5000], hides: [0, 5000], poultry: [0, 5000], silver_paid: null, tablets: null };
const GODS = CAL.events.find((e: any) => e.id === 'E-32').rule.weights as Record<string, number>;

export class EventCalendar {
  readonly stores: Stores;
  readonly construction: Construction;
  readonly days: DayCtx[] = [];
  /** per-day end-of-day stock (for the soak) */
  readonly stockLog: Stores[] = [];
  /** ration shortfalls this year (CE-02/CE-03), for the chronicle and the soak */
  readonly shortfalls: { day: number; group: number; f: number; paidSilver: boolean }[] = [];
  private pending: { id: string; qty: number; place: string; from: number }[] = [];
  private sched = new Map<string, Map<number, Inst[]>>();
  private supply: { day: number; hour: number; qty: number }[] = [];
  private harvest: number;
  private firstRainDay = -1;
  readonly monthlyDemand: number;
  constructor(readonly seed: number, readonly pop: Population, readonly env: (t: number) => EnvLike, readonly court = false) {
    this.construction = new Construction(seed);
    for (const id of Object.keys(ROW)) { const s = rateSchedule(seed, id, court); if (!s.length) continue; const m = new Map<number, Inst[]>(); for (const x of s) (m.get(x.day) ?? m.set(x.day, []).get(x.day)!).push(x); this.sched.set(id, m); }
    // CE-05 / E-06b: the ration stores are refilled from the harvest in the E-06 seasonal shape, sized to the outlays
    // (mass balance; the PF record receipts and outlays of the same suppliers, the balance is not recorded: C, Q-056)
    this.monthlyDemand = pop.groups.reduce((s, g) => s + pop.groupDemandQa(g.id, 0), 0) / 10;
    const bread = pop.builders.length * 0.8 * 300 * 1 / 10; // daily work-camp bread, BAR/yr (C)
    this.harvest = 0.9 + 0.2 * u01(seed, salt('harvest'));
    const e06 = ROW['E-06'].rule.mean_by_month as Record<string, number>; const shape = MONTHS.map(M => e06[String(M.n)] ?? 0); const shapeSum = shape.reduce((a, b) => a + b, 0);
    const xferDemand = transfers(seed).reduce((s, x) => s + x.size * 25 / 10 * Math.max(0, (REGNAL_DAYS - x.day) / 30), 0);
    const annual = (this.monthlyDemand * 12 * (1 + 0.25 / 30) + bread + xferDemand) * this.harvest - 51 * 400 * 0.8;
    const meanQ = 1500;
    MONTHS.forEach((M, mi) => { const tot = annual * shape[mi] / shapeSum; const n = Math.max(0, Math.round(tot / meanQ)); for (let k = 0; k < n; k++) {
      const day = M.start + Math.floor(u01(seed, salt('E-06b'), M.n, k) * M.days); this.supply.push({ day, hour: 7 + 9 * u01(seed, salt('E-06b-h'), M.n, k), qty: tot / n * (0.6 + 0.8 * u01(seed, salt('E-06b-q'), M.n, k)) }); } });
    // initial stocks at 1 Nisannu, before the barley harvest (C: a carry-over of about four and a half months, so an average
    // year does not run dry before the new grain arrives; a poor harvest (CE-04, the harvest factor) still can: Q-056)
    this.stores = { grain: Math.round(this.monthlyDemand * 4.5), flour: 900, tarmu: 300, beer: 300, wine: 400, figs: 5, sesame: 20, sheep: 1500, hides: 120, poultry: court ? 600 : 0, silver_paid: 0, tablets: 0 };
  }
  get harvestFactor() { return this.harvest; }
  /** the day's context; computes all earlier days first (the stores are processed in order) */
  ctx(day: number): DayCtx {
    const d = Math.max(0, Math.min(REGNAL_DAYS - 1, Math.floor(day)));
    while (this.days.length <= d) this.days.push(this.computeDay(this.days.length));
    return this.days[d];
  }
  get lastDay() { return this.days.length - 1; }
  private inst(id: string, d: number) { return this.sched.get(id)?.get(d) ?? []; }

  private computeDay(d: number): DayCtx {
    const { month, dom, m: M } = dateOf(d); const season = seasonOf(month); const wx = dayWx(this.env, d); const sun = sunTimes(d);
    const pop = this.pop, S = this.stores, seed = this.seed;
    const court = this.court && month >= 1 && month <= 4; // resident Nisannu–Duzu under the setting (D-003)
    if (this.firstRainDay < 0 && month >= 7 && wx.wet) this.firstRainDay = d;
    const ctx: DayCtx = { day: d, month, dom, season, wx, sun, court, events: [], issue: new Map(), special: new Map(), wine: new Map(), maternity: new Map(), payments: [], deliveries: [], couriers: [], letters: [],
      slaughter: [], milling: [], brewing: [], offerings: [], agri: new Set(), river: ROW['E-51'].rule.by_month[String(month)], winter: [9, 10, 11].includes(month), brick: [2, 3, 4, 5].includes(month) && !wx.wet,
      heatRest: wx.hot, /* the midday rest follows the day's heat (E-64: Tmax > 33 °C), in whatever month it comes (D-086) */ festival: festivalOn(seed, d), firstRain: this.firstRainDay >= 0 && this.firstRainDay <= d, doubled: [], disputes: new Map(), short: new Map(), build: this.construction.stoneTasks(), counts: {} };
    const ops: { t: number; f: () => void }[] = [];
    const E = (hour: number, id: string, text: string, place: string, n?: number) => { const row = ROW[id]; ctx.events.push({ t: d * 24 + hour, id, kind: row?.kind ?? id, text, place, tier: row?.tier ?? 'C', n }); };
    const monthDraw = (sa: string, g: number, lo: number, hi: number) => M.start + lo - 1 + Math.floor(u01(seed, salt(sa), g, month) * (hi - lo + 1));
    const stormAt = (h: number) => !!wx.stormH && h >= wx.stormH[0] && h <= wx.stormH[1];
    const rainAt = (h: number) => !!wx.rain && h >= wx.rain[0] && h <= wx.rain[1];

    // --- monthly issues to every ration group (E-01, E-02, E-03; CE-01/02/03) and the Treasury's flour (E-14)
    for (const g of pop.groups) {
      if (!pop.groupPresent(g.id, d)) continue;
      if (monthDraw('E-01', g.id, 1, 5) === d) { const h = 7 + 3 * u01(seed, salt('E-01h'), g.id, month); ctx.issue.set(g.id, h);
        ops.push({ t: h, f: () => this.issueRation(ctx, g.id, h) }); }
      if (u01(seed, salt('E-02p'), g.id, month) < ROW['E-02'].rule.probability && monthDraw('E-02', g.id, 1, 5) === d) { const h = 10 + 2 * u01(seed, salt('E-02h'), g.id, month); ctx.wine.set(g.id, h);
        ops.push({ t: h, f: () => { const q = 10 + 30 * u01(seed, salt('E-02q'), g.id, month); if (S.wine >= q) { S.wine -= q; E(h, 'E-02', `${q.toFixed(0)} marriš of wine issued to ${g.label}`, g.issuePlace); } } }); }
      if (u01(seed, salt('E-03p'), g.id, month) < ROW['E-03'].rule.probability && monthDraw('E-03', g.id, 1, 29) === d) { const h = 8 + 3 * u01(seed, salt('E-03h'), g.id, month); ctx.special.set(g.id, h);
        ops.push({ t: h, f: () => { const q = pop.groupDemandQa(g.id, d) / 30 / 10; if (S.grain >= q) { S.grain -= q; E(h, 'E-03', `special ration (an extra day's) for ${g.label}`, g.issuePlace); } } }); }
    }
    if (monthDraw('E-14', 0, 1, 29) === d) ops.push({ t: 10, f: () => { const q = 20 + 5 * u01(seed, salt('E-14q'), month); if (S.flour >= q) { S.flour -= q; E(10, 'E-14', `${q.toFixed(0)} BAR of flour drawn in the treasury for the kurakaraš`, 'treasury_store'); } } });
    // lan allocation drawn by the magi at the start of the month (E-30)
    if (dom === 3) ops.push({ t: 8, f: () => { const q = pop.priests.length * 7.5 / 10; S.grain -= Math.min(S.grain, q); E(8, 'E-30', 'the magi draw the monthly lan allocation of barley', 'store_town'); } });
    // --- rate events
    for (const x of this.inst('E-05', d)) { const g = pop.silverGroups[Math.floor(u01(seed, salt('E-05g'), d, x.k) * pop.silverGroups.length)];
      ctx.payments.push({ t: x.hour, group: g }); ctx.doubled.push([x.hour, x.hour + 2]);
      ops.push({ t: x.hour, f: () => { const n = pop.groupSize(g, d); const sh = Math.round(n * 1.25 * (0.25 + 0.75 * u01(seed, salt('E-05f'), d, x.k)) * 10) / 10; S.silver_paid += sh;
        E(x.hour, 'E-05', `${sh} shekels of weighed silver paid at the Treasury to ${pop.groups[g].label} in lieu of rations`, 'treasury_desk', sh); E(x.hour, 'E-81', 'the Treasury guard doubled while silver is out', 'post_treas_1'); } }); }
    const deliver = (id: string, h: number, qty: number, place: string) => {
      if (stormAt(h) || rainAt(h)) { this.pending.push({ id, qty, place, from: d }); E(h, 'W-01', `a ${id === 'E-09' ? 'wine' : 'grain'} delivery held up by the weather on the road`, place); return; } // CE-04, W-01
      ctx.deliveries.push({ t: h, id, qty, place });
      ops.push({ t: h, f: () => { const k = ({ 'E-06': 'grain', 'E-06b': 'grain', 'E-09': 'wine', 'E-10': 'figs', 'E-11': 'sesame' } as Record<string, keyof Stores>)[id];
        if (id === 'E-06b') { S.grain += qty * 0.97; S.tarmu += qty * 0.03; } else S[k] += qty; // tarmu (PF 35-39) travels with the grain: a 3 % share that keeps the brewery supplied (C)
        E(h, id === 'E-06b' ? 'E-06' : id, `${qty.toFixed(0)} ${k === 'wine' ? 'marriš of wine' : `BAR of ${id === 'E-06b' ? 'grain and tarmu' : k}`} delivered to the ${place === 'royal_store' ? 'royal stores' : 'storehouse'}`, place, qty); } });
    };
    const pend = this.pending; this.pending = [];
    for (const p of pend) deliver(p.id, 8 + (d - p.from), p.qty, p.place);
    for (const x of this.inst('E-06', d)) deliver('E-06', x.hour, Math.exp(Math.log(6) + (Math.log(3000) - Math.log(6)) * Math.pow(u01(seed, salt('E-06q'), d, x.k), 0.55)), 'royal_store');
    for (const x of this.supply) if (x.day === d) deliver('E-06b', x.hour, x.qty, 'store_town');
    for (const x of this.inst('E-09', d)) deliver('E-09', x.hour, Math.exp(Math.log(5) + (Math.log(925) - Math.log(5)) * u01(seed, salt('E-09q'), d, x.k)), 'royal_store'); // 5–925 marriš (PF 41–52, A), log-uniform (C)
    for (const x of this.inst('E-10', d)) deliver('E-10', x.hour, 1 + 4 * u01(seed, salt('E-10q'), d, x.k), 'royal_store');
    for (const x of this.inst('E-11', d)) deliver('E-11', x.hour, 20 + 40 * u01(seed, salt('E-11q'), d, x.k), 'royal_store');
    for (const x of this.inst('E-07', d)) { ctx.milling.push(x.hour); ops.push({ t: x.hour, f: () => { // reorder rule (C): send grain to the mill only when flour runs below ~6 weeks of use
      const target = 1800; if (S.flour >= target) return; const q = Math.max(300, Math.min(1200, (target - S.flour) / 0.9)); if (S.grain < q) return; S.grain -= q; S.flour += q * 0.9;
      E(x.hour, 'E-07', `${q.toFixed(0)} BAR of grain taken to the mill; flour back to the stores`, 'mill', q); } }); }
    // reorder trigger (C): when the flour is down to about two weeks of the work camp's use and no milling is due today,
    // the storekeeper sends grain to the mill that morning (without it the camp's bread would silently stop)
    if (!ctx.milling.length && S.flour < 500) { ctx.milling.push(8); ops.push({ t: 8, f: () => { const q = Math.max(300, Math.min(1200, (1800 - S.flour) / 0.9)); if (S.grain < q) return; S.grain -= q; S.flour += q * 0.9;
      E(8, 'E-07', `flour running low: ${q.toFixed(0)} BAR of grain sent to the mill; flour back to the stores`, 'mill', q); } }); }
    for (const x of this.inst('E-08', d)) { ctx.brewing.push(x.hour); ops.push({ t: x.hour, f: () => { const q = Math.max(50, Math.min(700, 400 - S.beer)); if (S.beer > 400 || S.tarmu < q) return; S.tarmu -= q; S.beer += q; E(x.hour, 'E-08', `beer brewed from ${q.toFixed(0)} BAR of tarmu`, 'brewery', q); } }); }
    for (const x of this.inst('E-12', d)) { ctx.slaughter.push(x.hour); ops.push({ t: x.hour, f: () => { const n = 6 + Math.floor(u01(seed, salt('E-12n'), d, x.k) * 12); if (S.sheep < n + 100) return; S.sheep -= n; S.hides += n;
      E(x.hour, 'E-12', `${n} head of small cattle slaughtered at the stockyard; the hides go to the treasury`, 'stockyard', n); } }); }
    for (const x of this.inst('E-13', d)) ops.push({ t: x.hour, f: () => { const n = Math.max(0, Math.round(S.sheep - 1200)); if (n < 20) return; S.sheep -= n; E(x.hour, 'E-13', `${n} tax animals and sheep of the king driven out on the road to Susa`, 'station', n); } });
    for (const x of this.inst('E-15', d)) ops.push({ t: x.hour, f: () => { const n = 1 + Math.floor(u01(seed, salt('E-15n'), d, x.k) * 10); S.tablets += n; E(x.hour, 'E-15', `${n} sealed tablets filed; stock counted`, u01(seed, salt('E-15p'), d, x.k) < 0.5 ? 'treasury_desk' : 'store_town', n); } });
    for (const x of this.inst('E-20', d)) { const tr = u01(seed, salt('E-20t'), d, x.k) < 0.5; ctx.couriers.push({ t: x.hour, treasury: tr });
      if (tr && x.hour < sun.set - 1.1) ctx.letters.push({ go: Math.max(x.hour, sun.rise + 1.3), j: x.k });
      E(x.hour, 'E-20', `an express courier ${u01(seed, salt('E-20d'), d, x.k) < 0.5 ? 'arrived at' : 'left'} the road station${tr ? ' with a sealed letter for the Treasury' : ''}`, 'station'); }
    if (d > 0) { const set0 = sunTimes(d - 1).set; for (const x of this.inst('E-20', d - 1)) if (u01(seed, salt('E-20t'), d - 1, x.k) < 0.5 && x.hour >= set0 - 1.1) ctx.letters.push({ go: sun.rise + 1.3, j: 50 + x.k }); }
    // (the Treasury door doubled while a letter is brought up: E-81)
    // (letters waiting for the desk to open go up together, in one man's bag)
    ctx.letters.sort((a, b) => a.go - b.go); ctx.letters = ctx.letters.filter((x, i, l) => i === 0 || x.go > l[i - 1].go + 1e-6); for (const x of ctx.letters) ctx.doubled.push([x.go + 0.8, x.go + 1.8]);
    for (const p of this.pop.parties) if (p.day === d) ops.push({ t: p.hour, f: () => { const fl = p.size * p.stay * 1.25 / 10, be = p.size * p.stay / 10; S.flour -= Math.min(S.flour, fl); S.beer -= Math.min(S.beer, be);
      E(p.hour, 'E-21', `a party of ${p.size} from ${p.route} showed its sealed halmi and drew travel rations`, 'station', p.size); } });
    for (const x of this.pop.transferList) if (x.day === d) ops.push({ t: x.hour, f: () => { S.flour -= Math.min(S.flour, x.size * 1.5 / 10); E(x.hour, 'E-23', `a work group of ${x.size} arrived to new quarters in the town`, 'store_town', x.size); } });
    for (const x of this.pop.bands) if (x.day === d) E(x.hour, 'E-49', `a band of herding families (${x.size} people) came down into the plain with their flocks, donkeys and dogs`, 'river', x.size);
    for (const id of ['E-31', 'E-32']) for (const x of this.inst(id, d)) { let god: string | undefined;
      if (id === 'E-32') { const tot = Object.values(GODS).reduce((a, b) => a + b, 0); let u = u01(seed, salt('god'), d, x.k) * tot; for (const [k, w] of Object.entries(GODS)) { u -= w; if (u <= 0) { god = k; break; } } }
      const place = id === 'E-31' ? (u01(seed, salt('mtn'), d, x.k) < 0.5 ? 'mountain' : 'river') : 'offering_place';
      ctx.offerings.push({ t: x.hour, id, place, god });
      ops.push({ t: x.hour, f: () => { S.grain -= Math.min(S.grain, 1); if (id === 'E-32' && u01(seed, salt('E-32s'), d, x.k) < 0.2 && S.sheep > 150) S.sheep -= 1;
        E(x.hour, id, id === 'E-31' ? `a magus made the offering to a named ${place}` : `an offering for ${god} by a magus`, place); } }); }
    // the šip (E-33) and the festival day (E-38; D-211, C): sheep and goats, grain for the bread, wine and beer issued from the
    // stores at the offering place, the meat shared out to the households' heads and carried home. Wine and beer only as far
    // as the stores allow (they keep a floor for the month's issues); the flock keeps its floor (STORE_BOUNDS)
    if (ctx.festival) { const F = ctx.festival, fu = (k: number) => u01(seed, salt('E-33q'), F.k, k), q = (r: [number, number], k: number) => r[0] + (r[1] - r[0]) * fu(k);
      E(sun.rise + 0.5, 'E-38', F.bagayadis ? 'the Bāgayādiš festival: a day off for the gangs and the town’s work groups (C)' : `a festival day at ${F.name}: a day off for the gangs and the town’s work groups (C)`, 'plain');
      ops.push({ t: F.hours[0], f: () => { const n = Math.round(Math.min(q(F.sheep, 1), Math.max(0, S.sheep - 400))), g = q(F.grain, 2), w = S.wine >= q(F.wine, 3) + 60 ? q(F.wine, 3) : 0, b = S.beer >= q(F.beer, 4) + 60 ? q(F.beer, 4) : 0;
        S.sheep -= n; S.hides += n; S.grain -= Math.min(S.grain, g); S.wine -= w; S.beer -= b;
        E(F.hours[0], 'E-33', `šip at the offering place${F.bagayadis ? ' for Bāgayādiš' : ` at ${F.name}`}: ${n} sheep and goats, ${g.toFixed(0)} BAR of grain${w ? `, ${w.toFixed(0)} marriš of wine` : ''}${b ? `, ${b.toFixed(0)} BAR of beer` : ''} issued; the meat shared out to the households and carried home`, 'offering_place', n); } }); }
    // daily lan (E-30), change of watch (E-80), building work (E-60) and the seasonal round (E-40 … E-51)
    E(sun.rise + 0.2, 'E-30', 'the lan offering', 'offering_place'); ctx.offerings.push({ t: sun.rise + 0.2, id: 'E-30', place: 'offering_place' });
    for (const h of [6, 14, 22]) E(h, 'E-80', `change of watch at ${h}:00 on the Terrace`, 'post_gate_w1');
    for (const id of ['E-40', 'E-41', 'E-42', 'E-43', 'E-44', 'E-45', 'E-46', 'E-50']) {
      const row = ROW[id]; if (!monthsOk(row, month)) continue;
      if (id === 'E-40' && !ctx.firstRain && !(month === 8 && dom > 15) && month !== 9) continue; // CE-20: sowing waits for the first autumn rains (irrigated land is sown by mid-Arahsamnu regardless, C)
      // (a wet day with a dry working morning of four and a half hours keeps its ploughing and sowing until the rain: the
      // rule for field work is the rain's hours, W-01, not the rain day; S5 of reviewer A, S10 of reviewer B, r7: a day with
      // rain from 15:00 lost its seven dry hours. The rain then sends them home: Planner.workBlock; C)
      if ((id === 'E-40' || id === 'E-44') && wx.wet && rainHours(wx, sun.rise + 0.5, sun.rise + 5) > 0) continue;
      if (id === 'E-50' && !(dom >= 5 && dom <= 25)) continue;
      if (row.day_window && (d < row.day_window[0] || d > row.day_window[1])) continue; // the harvest windows (Q-140)
      ctx.agri.add(id); E(row.rule.hours?.[0] ?? 7, id, row.name, 'plain');
    }
    if ([12, 1, 2].includes(month) && !wx.wet) { const n = pop.shearingToday(d); if (n) { ctx.agri.add('E-47'); E(8, 'E-47', `${n} flocks shorn in the folds`, 'plain', n); } }
    if ([10, 11, 12].includes(month)) { const lambs = Math.round(S.sheep * 0.5 * 0.75 / (29 + 30 + 29) * (0.7 + 0.6 * u01(seed, salt('lamb'), d))); S.sheep += lambs; if (lambs) E(7, 'E-48', `${lambs} lambs born in the state flocks`, 'stockyard', lambs); }
    if (d === 0 || ROW['E-51'].rule.by_month[String(dateOf(d - 1).month)] !== ctx.river) E(6, 'E-51', `the rivers are ${ctx.river}`, 'river');
    if (ctx.heatRest) E(12, 'E-64', 'midday rest in the heat on the building sites', 'worksite');
    if (wx.wet) E(wx.rain![0], 'W-01', 'rain: people shelter and outdoor work stops', 'plain');
    if (wx.storm) E(wx.stormH![0], 'W-02', `${stormWord(wx, wx.stormH![0], wx.stormH![1])}: all outdoor work stops; couriers still ride`, 'plain');
    if (wx.dust) E(10, 'W-03', 'dust: faces covered, travel slow', 'plain');
    if (ctx.winter && (wx.frost || wx.wet)) E(7, 'E-62', 'frost or rain: no mud-brick, mortar or plaster work today', 'worksite');
    // court (setting only; E-25/26/27, CE-17/18)
    if (this.court) { if (d === 0) E(9, 'E-25', 'the court arrives from Susa', 'stair_foot'); if (month === 4 && dom === 29) E(9, 'E-26', 'the court leaves', 'stair_foot');
      if (court && [12, 1].includes(month)) E(11, 'E-27', 'officials and taxpayers come to the king for the New Year', 'forecourt'); }

    // --- life (E-04, E-37, E-70 … E-74), from the population's per-person draws
    const life = pop.lifeOn(d);
    ctx.counts.births = life.births.length; ctx.counts.deaths = life.deaths.length; ctx.counts.marriages = life.marriages.length; ctx.counts.sick = pop.sickOnsets(d); ctx.counts.birthdays = pop.birthdaysOn(d).length;
    if (life.births.length) E(12, 'E-70', `${life.births.length} births in the town and the plain`, 'plain', life.births.length);
    if (life.deaths.length) E(12, 'E-71', `${life.deaths.length} deaths; the dead are carried out of the settlements`, 'outside', life.deaths.length);
    if (life.marriages.length) E(12, 'E-73', `${life.marriages.length} marriages (households change; no rite is attested)`, 'plain', life.marriages.length);
    if (ctx.counts.sick) E(12, 'E-72', `${ctx.counts.sick} people fell sick`, 'plain', ctx.counts.sick);
    if (ctx.counts.birthdays) E(19, 'E-37', `${ctx.counts.birthdays} birthday meals in Persian households`, 'plain', ctx.counts.birthdays);
    for (const b of pop.maternityDue(d)) { const h = 9 + 3 * u01(seed, salt('E-04h'), b.mother); ctx.maternity.set(b.mother, h);
      ops.push({ t: h, f: () => { const q = b.boy ? 10 : 5; S.grain -= Math.min(S.grain, q / 10); S.beer -= Math.min(S.beer, q / 10); E(h, 'E-04', `mother's ration issued for the birth of a ${b.boy ? 'boy' : 'girl'}`, pop.groups[b.group]?.issuePlace ?? 'store_town'); } }); }
    // --- construction: the labour actually present today (the same availability rule the day plans use)
    const cr = pop.buildCredit(d, ctx);
    // (a storm keeps the whole day's work off the site only when it leaves the gangs no working day: Population.workSpan; one
    // that comes on after a dry morning stops the work where it begins: A S3, B S2 of shadow review r8)
    const ww = pop.workWindow(ctx), off = pop.rainedOff(ctx), stIn = !!wx.stormH && wx.stormH[0] < ww[1] && wx.stormH[1] > ww[0], stLate = stIn && wx.stormH![0] > ww[0] + 0.25 && wx.stormH![1] >= ww[1] - 0.25;
    const bev: BuildEvent[] = this.construction.step(d, { ...cr, frost: wx.frost, wet: wx.wet && wx.rainH > 3, storm: off && stIn, stormAt: off && stIn ? Math.max(ww[0], wx.stormH![0]) : stLate ? wx.stormH![0] : undefined });
    if (cr.stone + cr.labour + cr.brick > 0) E(sun.rise + 0.5, 'E-60', `the gangs at work on the Hall of a Hundred Columns (${Math.round(cr.stone + cr.labour + cr.brick)} man-days)`, 'worksite');
    for (const b of bev) E(b.hour, 'E-61', b.text, b.place);
    // the work camp's daily bread (IR-PET: daily issues exist, B; its use for the gangs is C)
    ops.push({ t: 6, f: () => { const q = (cr.stone + cr.labour + cr.brick) * 1 / 10; S.flour -= Math.min(S.flour, q); } });
    ops.push({ t: 16, f: () => { if (S.hides > 0) S.hides -= Math.min(S.hides, 1); } }); // hides worked in the treasury workshop (C)
    // --- economy in time order
    ops.sort((a, b) => a.t - b.t); for (const o of ops) o.f();
    // --- disputes (E-74; CE-03 x3 on short rations, CE-19 x1.5 when the river is low)
    pop.drawDisputes(d, ctx);
    for (const [a, x] of ctx.disputes) if (a < x.other) E(x.t, 'E-74', `a dispute ${x.why}`, x.place);
    ctx.events.sort((a, b) => a.t - b.t);
    this.stockLog[d] = { ...S };
    return ctx;
  }
  private issueRation(ctx: DayCtx, g: number, h: number) {
    const S = this.stores, pop = this.pop, G = pop.groups[g]; const q = pop.groupDemandQa(g, ctx.day) / 10;
    const E = (id: string, text: string) => ctx.events.push({ t: ctx.day * 24 + h, id, kind: ROW[id].kind, text, place: G.issuePlace, tier: ROW[id].tier });
    if (S.grain >= q) { S.grain -= q; E('E-01', `monthly grain ration (${q.toFixed(0)} BAR) issued to ${G.label}`); return; }
    const f = S.grain / q; S.grain = 0;
    if (G.silver) { S.silver_paid += (1 - f) * q * 0.5; this.shortfalls.push({ day: ctx.day, group: g, f, paidSilver: true });
      E('E-01', `${G.label}: only ${(f * 100).toFixed(0)} % of the grain ration in the store; the rest paid in silver at the Treasury (CE-02)`); return; }
    if (S.flour > q * (1 - f) + 600) { S.flour -= q * (1 - f); this.shortfalls.push({ day: ctx.day, group: g, f: 1, paidSilver: false }); E('E-01', `${G.label}: grain short; made up in flour (CE-02)`); return; }
    ctx.short.set(g, 1 - f); this.shortfalls.push({ day: ctx.day, group: g, f, paidSilver: false });
    E('E-01', `${G.label}: short ration, ${(f * 100).toFixed(0)} % of the grain issued (CE-03)`);
  }
  /** shortfall fraction of a group's ration for the month containing `day` (CE-03 lasts until the next issue) */
  shortOf(group: number, day: number) {
    const { month } = dateOf(day); for (let x = this.shortfalls.length - 1; x >= 0; x--) { const s = this.shortfalls[x]; if (s.group === group && !s.paidSilver && dateOf(s.day).month === month && s.day <= day) return 1 - s.f; } return 0;
  }
  /** chronicle rows between two times (hours) */
  eventsBetween(t0: number, t1: number): CalEvent[] {
    const out: CalEvent[] = []; for (let d = Math.max(0, Math.floor(t0 / 24)); d <= Math.min(this.lastDay, Math.floor(t1 / 24)); d++) for (const e of this.days[d].events) if (e.t >= t0 && e.t < t1) out.push(e); return out;
  }
  snapshot() { return { days: this.days.length }; }
}
