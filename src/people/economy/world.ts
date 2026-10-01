// The emergent economy and needs core (s13, UD-26, T-F9; D-338). Per-household stores and needs, harvests driven by the
// year's weather (src/weather), grain and goods prices from supply and demand, debts, and each household's own choice under
// need (buy, sell, ask kin, borrow, work for wages, petition, steal), with the court judging thefts and defaults. Nothing is
// scripted as a sequence: every state change is an event that names the events that caused it, and a "chain" is read off that
// causal graph afterwards (chains.ts). All draws are keyed hashes of (seed, salt, household, day): the same seed and the same
// interventions replay identically, so the save is the seed, the day and the interventions (snapshot()).
// Tiers: rations by the month from the treasury (Persepolis Fortification tablets, A); interest ~20 % a year on silver loans
// (Babylonian practice of the period, B); yields, elasticities, detection and judgement odds are C (reasoned, not attested).
import type { EconWorld, HouseholdNeed, Intent, NeedKind } from './api';
import { h32, u01, salt } from '../hash';
import { dateOf } from '../calendar';
import { generateYear, type DayWeather } from '../../weather/generator';
import { START_JDN } from '../../core/calendar';
import { TrustLedger } from '../speech/trust';

export type HHKind = 'farmer' | 'ration' | 'craft' | 'herder' | 'rich';
export interface HHSeed { id: string; kind: HHKind; eaters: number; workers: number; q: string; kin?: string[] }
export interface EconEvent { id: number; day: number; actor: string; kind: string; causes: number[]; other?: string; amt?: number }
interface HH extends HHSeed {
  kin: string[]; grain: number; fuel: number; cash: number; goods: number; land: number; health: number; honest: number;
  sickUntil: number; mourning: number; lastPet: number; lastTheft: number; debts: Debt[];
  cause: Partial<Record<NeedKind, number>>; lastAct: number; harvestDay: number; dead: number;
  // D-340 (s13 econplans): the crisis end. badUntil/badEv: a default is remembered by the lenders (no new loan without a
  // pledge); noOx: the event of a draught ox (or the flock's ewes) lost and not yet replaced; bound: members working off a
  // debt or a fine in another house; lastRefused/lastFire: rate limits on repeated events
  badUntil: number; badEv: number; noOx: number; bound: { to: string; until: number; ev: number; done: boolean; rec: Bondage }[]; lastRefused: number; lastFire: number;
  /** D-347: the day an illness drawn LIFE_LAG ahead takes hold (-1: none pending) */
  illAt: number;
  advocate?: number; lastKin?: number; helped?: number; hireDay?: number;
}
/** a member bound to work off a debt (D-340): who, for whom, from the event, until the day (Economy.boundOn) */
export interface Bondage { hh: string; to: string; from: number; until: number; ev: number }
/** a debt owed (n: its number, so a saved deferred step finds it again, D-347) */
export interface Debt { to: string; amt: number; due: number; ev: number; n: number }
/** a deferred step (D-347: data, not a closure, so the economy's state is saved and restored as it stands) */
type Task =
  | { t: 'release'; hh: string; b: number }
  | { t: 'judgeDebt'; hh: string; cause: number; debt: Debt }
  | { t: 'relief'; hh: string; d: number; pet: number; eat: number }
  | { t: 'remit'; hh: string; debt: Debt; pet: number; d: number }
  | { t: 'arrest'; hh: string; v: string; g: number; acc: number; d: number }
  | { t: 'judgeTheft'; hh: string; v: string; g: number; ar: number; d: number }
  | { t: 'ill'; hh: string; ev: number }
  | { t: 'die'; hh: string; ev: number };
/** D-347: the Population's side of illness and death (PeopleSim wires it; the bare economy of the tests has none). One
 *  mortality: the Population's own deaths are the economy's deaths (burial, mourning), and the economy's illness is laid on a
 *  member as a sickbed and, when grave, as that member's death. Both are decided LIFE_LAG days ahead, past every day plan the
 *  living world has already read (it looks 3 days ahead), so no plan already made is changed by them. */
export interface EconLife {
  /** the Population's own deaths among the household's members on the day (not those the economy caused) */
  deaths(hh: string, day: number): number;
  /** lay an illness on a member from `from` to `until` (exclusive), and their death on `dieOn` (-1: they recover); false when
   *  no member can take it (the economy then has no illness either); `died` false when the death could not be laid */
  sicken(hh: string, from: number, until: number, dieOn: number): { ok: boolean; died: boolean };
}
export const LIFE_LAG = 4;
/** the household fields a snapshot carries (the rest are fixed by the seed); cause.* and the D-340 extras are optional */
const HH_NUM = ['eaters', 'workers', 'grain', 'fuel', 'cash', 'goods', 'land', 'health', 'sickUntil', 'mourning', 'lastPet', 'lastTheft', 'lastAct', 'dead',
  'badUntil', 'badEv', 'noOx', 'lastRefused', 'lastFire', 'illAt', 'advocate', 'lastKin', 'helped', 'hireDay'] as const;
const CAUSES: NeedKind[] = ['food', 'fuel', 'water', 'cash', 'help', 'health', 'kin'];
/** events a snapshot keeps whole besides the last days' (the plans' words read them: a default remembered 240 days, a thief's
 *  chain back to the theft), and those it keeps as day and kind only (the market's and the treasury's look-backs) */
const KEEP_WHOLE: Record<string, number> = { default: 240, theft: 40, robbed: 40, accusation: 40, arrest: 40 };
const KEEP_STUB: Record<string, number> = { harvest_poor: 21, blight: 21, buy: 21, ration_cut: 21, hoard: 21, harvest_good: 21, grain_brought: 21, hoard_released: 21, tithe_short: 61 };
/** the state is rounded at each day's end (grain 0.1 kg, silver 1e-4 sheqel, fuel 0.1, health 0.001) so a saved day is short (D-347) */
const q = (x: number, k: number) => Math.round(x * k) / k;
/** the fields a snapshot writes as whole numbers of these units when every value is on the grid (D-347) */
const SCALE: Record<string, number> = { grain: 10, fuel: 10, cash: 1e4 };

const S = { yield: salt('econ-yield'), plot: salt('econ-plot'), act: salt('econ-act'), ill: salt('econ-ill'), steal: salt('econ-steal'),
  detect: salt('econ-detect'), judge: salt('econ-judge'), kin: salt('econ-kin'), trait: salt('econ-trait'), shock: salt('econ-shock'), craft: salt('econ-craft'),
  animal: salt('econ-animal'), fire: salt('econ-fire'), levy: salt('econ-levy') };
/** a day's labour of a bound man or woman, in silver (sheqel; C: a hired man's wage in the Fortification texts is paid in
 *  grain, ~1 BAR a month; its silver value is C) */
const BOUND_WAGE = 0.02;
/** the longest bondage for debt: three years (Codex Hammurabi §117, for a wife, son or daughter given for a debt: an older
 *  Babylonian rule, taken as the probable custom by analogy, C) */
const BOUND_MAX = 3 * 354;
const GRAIN_EAT = 0.55;        // kg a day per eater (a ration of ~1 qa of barley, A in kind, C in kg)
const GRAIN_BASE = 0.02;       // sheqel per kg at a normal market (C)
const TITHE = 0.1;             // the treasury's share of a harvest (B)
/** D-347: the daily chance of a petty theft by one of the least honest houses when short (C; tuned to ~1-3 thefts a year per thousand people on seeds 1, 7, 42) */
const PETTY_THEFT = 0.0015;
export const SYSTEMS = ['weather', 'market', 'treasury', 'court', 'caravan'] as const;

export class Economy implements EconWorld {
  readonly hh = new Map<string, HH>();
  readonly events: EconEvent[] = [];
  /** D-351 (s13 trust): who is trusted by whom, read off the events (speech/trust.ts); absent in a bare economy */
  trust?: TrustLedger;
  readonly wx: DayWeather[];
  day = -1;
  market = { grain: 0, goodsDemand: 1, dearEv: -1, slumpEv: -1, cheapEv: -1, hist: [] as number[] };
  /** D-340: every bondage for debt or fine, in order (the day plans read it: Economy.boundOn) */
  readonly bondages: Bondage[] = [];
  treasury = { grain: 0, shortEv: -1 };
  private pending: { day: number; task: Task }[] = [];
  /** the intents to apply, by day (D-347: indexed, was a list scanned every day) */
  private intents = new Map<number, Intent[]>();
  private debtN = 0;
  private idx = new Map<string, number>(); private byQ = new Map<string, HH[]>();
  private shocks = new Map<string, number>(); // quarter -> event of this year's local blight
  constructor(readonly seed: number, seeds: HHSeed[], readonly opts: { interventions?: Intent[]; life?: EconLife; trust?: boolean } = {}) {
    this.wx = generateYear(seed, START_JDN, 365);
    if (opts.trust) this.trust = new TrustLedger(this); // (D-351: the lenders, kin and neighbours read it; see creditOk, lender, decide)
    const ids = seeds.map(s => s.id);
    for (const [i, s] of seeds.entries()) {
      const u = (k: number) => u01(seed, S.trait, i, k);
      const kin = s.kin ?? [0, 1].map(k => ids[h32(seed, S.kin, i, k) % ids.length]).filter(x => x !== s.id);
      const rich = s.kind === 'rich';
      this.hh.set(s.id, { ...s, kin, grain: s.eaters * GRAIN_EAT * (40 + 80 * u(1)) * (rich ? 4 : 1), fuel: 10 + 20 * u(2), cash: (rich ? 80 : 1) + 6 * u(3) * u(3),
        goods: Math.floor(4 * u(4)) + (s.kind === 'craft' ? 3 : 0), land: s.kind === 'farmer' ? 1.2 + 2.8 * u(5) : rich ? 6 : 0, health: 0.8 + 0.2 * u(6),
        honest: u(7), sickUntil: -1, mourning: -1, debts: [], cause: {}, lastAct: -99, lastPet: -99, lastTheft: -99, harvestDay: 34 + Math.floor(40 * u(8)), dead: 0,
        badUntil: -1, badEv: -1, noOx: -1, bound: [], lastRefused: -99, lastFire: -999, illAt: -1 });
    }
    for (const [i, h] of [...this.hh.values()].entries()) { this.idx.set(h.id, i); if (!this.byQ.has(h.q)) this.byQ.set(h.q, []); this.byQ.get(h.q)!.push(h); }
    this.market.grain = seeds.length * 60; this.treasury.grain = seeds.filter(s => s.kind === 'ration').reduce((a, s) => a + s.eaters, 0) * GRAIN_EAT * 45;
    for (const i of opts.interventions ?? []) this.addIntent(i);
    const H = [...this.hh.values()]; for (const f of HH_NUM) this.init[f] = H.map(h => (h as any)[f]);
  }
  /** each household's fields as the seed made them (a snapshot keeps only what differs) */
  private init: Record<string, (number | undefined)[]> = {};
  private addIntent(i: Intent) { const l = this.intents.get(i.day); if (l) l.push(i); else this.intents.set(i.day, [i]); }
  private debt(to: string, amt: number, due: number, ev: number): Debt { return { to, amt, due, ev, n: this.debtN++ }; }

  // ---- the event graph ----
  private ev(day: number, actor: string, kind: string, causes: (number | undefined)[], other?: string, amt?: number): number {
    const id = this.events.length; this.events.push({ id, day, actor, kind, causes: [...new Set(causes.filter((c): c is number => c !== undefined && c >= 0))], other, amt }); return id;
  }
  private later(day: number, task: Task) { this.pending.push({ day, task }); }

  // ---- EconWorld ----
  price(good: string, day: number): number {
    if (good === 'grain') { const s = Math.max(1, this.market.grain), s0 = this.hh.size * 60; return GRAIN_BASE * Math.min(6, Math.max(0.5, Math.pow(s0 / s, 0.7))) * (dateOf(Math.max(0, day)).month >= 11 ? 1.1 : 1); }
    if (good === 'goods') return 0.6 * this.market.goodsDemand;
    if (good === 'fuel') return 0.05 * (this.season(day) === 'winter' ? 1.6 : 1);
    return 1;
  }
  needsOf(id: string): HouseholdNeed[] {
    const h = this.hh.get(id); if (!h) return [];
    const eat = h.eaters * GRAIN_EAT, d = Math.max(0, this.day), cl = (x: number) => Math.max(0, Math.min(1, x));
    const wx = this.wx[d % this.wx.length];
    return [
      { hh: id, kind: 'food' as NeedKind, urgency: cl(1 - h.grain / (eat * 20)) },
      { hh: id, kind: 'fuel' as NeedKind, urgency: cl(1 - h.fuel / 10) },
      { hh: id, kind: 'water' as NeedKind, urgency: cl(wx && !wx.wet && wx.tmax > 33 ? (wx.tmax - 33) / 8 : 0) },
      { hh: id, kind: 'cash' as NeedKind, urgency: cl(h.debts.reduce((a, x) => a + x.amt, 0) / (h.cash + 1) / 3 + (h.cash < eat * 10 * this.price('grain', d) ? 0.4 : 0)) },
      { hh: id, kind: 'help' as NeedKind, urgency: cl(d < h.sickUntil ? 0.5 + 0.5 / Math.max(1, h.workers) : 0) },
      { hh: id, kind: 'health' as NeedKind, urgency: cl(1 - h.health) },
      { hh: id, kind: 'kin' as NeedKind, urgency: cl(d < h.mourning ? 0.8 : 0) },
    ];
  }
  /** a player's (or another layer's) act entering the world; recorded so a replay applies it on the same day */
  applyIntent(i: Intent): { ok: boolean; changes: string[] } {
    const to = this.hh.get(i.to); const changes: string[] = []; if (!to) return { ok: false, changes };
    const p = i.payload, d = i.day;
    // (D-340, for the living world: an intent may name the economy events it answers, payload.causes, a list of event ids or
    // a comma-separated string; they become the causes of what it does, and what the receiving house was short of now
    // traces to it, so a neighbour's help or a talk joins the chain it answers)
    const cz = (Array.isArray(p.causes) ? p.causes : typeof p.causes === 'string' ? p.causes.split(',') : typeof p.causes === 'number' ? [p.causes] : []).map(Number).filter(x => Number.isInteger(x) && x >= 0 && x < this.events.length);
    const ev = (kind: string, amt?: number) => this.ev(d, i.to, kind, cz, i.from, amt);
    if (i.kind === 'help' || i.kind === 'trade') {
      const g = Number(p.grain ?? 0), c = Number(p.cash ?? 0), f = Number(p.fuel ?? 0), gd = Number(p.goods ?? 0);
      to.grain += g; to.cash += c; to.fuel += f; to.goods = Math.max(0, to.goods + gd); if (g) changes.push(`${i.to}.grain+${g}`); if (c) changes.push(`${i.to}.cash+${c}`); if (f) changes.push(`${i.to}.fuel+${f}`); if (gd) changes.push(`${i.to}.goods+${gd}`);
      // (D-351: a haggled deal is its own kind of event, `haggle_deal`, so the trust ledger and the chains tell it from a gift)
      const e = ev(p.deal ? 'haggle_deal' : 'given', g + c); if (cz.length) { if (g > 0) to.cause.food = e; if (f > 0) to.cause.fuel = e; if (c > 0) to.cause.cash = e; if (Number(p.labour ?? 0) > 0) to.cause.help = e; }
    } else if (i.kind === 'loan') {
      const c = Number(p.cash ?? 0); to.cash += c; changes.push(`${i.to}.cash+${c}`); // the player's loan: no interest, no court
      const e = ev('lent_by_stranger', c); if (cz.length && c > 0) to.cause.cash = e;
    } else if (i.kind === 'petition') { // speaking for a household before the judge: the next judgement over it is lenient
      (to as any).advocate = d + Number(p.days ?? 30); changes.push(`${i.to}.advocate`); ev('spoken_for');
    } else if (i.kind === 'work') { const g = Number(p.grain ?? 0); to.grain += g; changes.push(`${i.to}.grain+${g}`); const e = ev('hired_by_stranger', g); if (cz.length && g > 0) to.cause.food = e;
    } else { ev(i.kind); changes.push(`${i.to}.${i.kind}`); }
    return { ok: true, changes };
  }
  /** D-347: the economy's state as it stands at the end of its day (was: the seed and every intent, replayed from day 0 on
   *  load: 3.6-10.5 s and 5.5 MB at day 300). Households by field (only those that differ from the seed's start, or all when
   *  most do), debts, bondages, the deferred steps as data, the intents still to come; of the events, the count (ids go on
   *  from it), the days from `keepFrom` whole (the day plans of the sim's present read them) and, before that, only what the
   *  days to come can still read: whole, the defaults and the thieves' chains; as day and kind, the events the state names
   *  as causes and those the market's and the treasury's look-backs filter. Older events are gone from a loaded economy
   *  (chains.ts reads a whole year only in a world that ran it). */
  snapshot(keepFrom = this.day - 2) {
    const H = [...this.hh.values()], n = H.length;
    const col = (f: string, get: (h: HH, i: number) => number | undefined, init?: (i: number) => number | undefined) => {
      const vals = H.map(get), diff: number[] = []; for (let i = 0; i < n; i++) if (vals[i] !== (init ? init(i) : undefined)) diff.push(i);
      if (!diff.length) return undefined;
      const k = SCALE[f] ?? 0, dense = diff.length * 3 > n, sc = k > 0 && (dense ? vals : diff.map(i => vals[i])).every(v => v === undefined || v === q(v, k)), enc = (v: number | undefined) => v === undefined ? null : sc ? Math.round(v * k) : v;
      if (dense) return { ...(sc ? { k } : {}), d: vals.map(enc) };
      return { ...(sc ? { k } : {}), i: diff.map((x, j) => x - (j ? diff[j - 1] : 0)), v: diff.map(i => enc(vals[i])) };
    };
    const hh: Record<string, unknown> = {};
    for (const f of HH_NUM) { const c = col(f, h => (h as any)[f], i => this.init[f][i]); if (c) hh[f] = c; }
    for (const c of CAUSES) { const x = col("c." + c, h => h.cause[c]); if (x) hh['c.' + c] = x; }
    const hi = (id: string) => this.idx.get(id)!;
    const debts: unknown[] = []; for (const h of H) for (const d of h.debts) debts.push([hi(h.id), d.to, d.amt, d.due, d.ev, d.n]);
    const bix = new Map(this.bondages.map((b, i) => [b, i]));
    const bound: unknown[] = []; for (const h of H) for (const b of h.bound) bound.push([hi(h.id), b.to, b.until, b.ev, b.done ? 1 : 0, bix.get(b.rec)]);
    const dref = (hid: string, d: Debt) => this.hh.get(hid)!.debts.includes(d) ? d.n : [d.to, d.amt, d.due, d.ev, d.n];
    const pending = this.pending.map(p => { const t = p.task as any; return [p.day, t.t, hi(t.hh), ...('debt' in t ? [{ ...t, t: undefined, hh: undefined, debt: dref(t.hh, t.debt) }] : [{ ...t, t: undefined, hh: undefined }])]; });
    const intents: Intent[] = []; for (const [d, l] of [...this.intents].sort((a, b) => a[0] - b[0])) if (d > this.day) intents.push(...l);
    // the events kept
    const refs = new Set<number>([this.market.dearEv, this.market.slumpEv, this.market.cheapEv, this.treasury.shortEv, ...this.shocks.values()]);
    for (const h of H) { for (const c of CAUSES) if (h.cause[c] !== undefined) refs.add(h.cause[c]!); refs.add(h.badEv); refs.add(h.noOx); for (const d of h.debts) refs.add(d.ev); for (const b of h.bound) refs.add(b.ev); }
    for (const p of this.pending) { const t = p.task as any; for (const k of ['cause', 'pet', 'acc', 'ar', 'ev']) if (typeof t[k] === 'number') refs.add(t[k]); if (t.debt) refs.add(t.debt.ev); }
    const kinds: string[] = [], ki = (k: string) => { let i = kinds.indexOf(k); if (i < 0) { i = kinds.length; kinds.push(k); } return i; };
    const whole: unknown[] = [], stub: number[][] = [[], [], []]; let lw = 0, lwd = 0, ls = 0, lsd = 0;
    this.events.forEach(e => { // (forEach: a loaded economy's events have gaps)
      if (e.day >= keepFrom || (KEEP_WHOLE[e.kind] !== undefined && e.day > this.day - KEEP_WHOLE[e.kind])) {
        whole.push([e.id - lw, e.day - lwd, ki(e.kind), e.actor, e.causes, e.other ?? null, e.amt ?? null]); lw = e.id; lwd = e.day; return; }
      if (refs.has(e.id) || (KEEP_STUB[e.kind] !== undefined && e.day > this.day - KEEP_STUB[e.kind])) { stub[0].push(e.id - ls); stub[1].push(e.day - lsd); stub[2].push(ki(e.kind)); ls = e.id; lsd = e.day; }
    });
    return { v: 2, seed: this.seed, day: this.day, nEv: this.events.length, debtN: this.debtN, market: { ...this.market, hist: this.market.hist.slice(-11) }, treasury: { ...this.treasury },
      shocks: [...this.shocks], hires: [this.hires.day, this.hires.n], hh, debts, bound, bondages: this.bondages.map(b => [this.idx.get(b.hh), b.to, b.from, b.until, b.ev]), pending, intents, kinds, whole, stub, ...(this.trust ? { trust: this.trust.snapshot() } : {}) };
  }
  /** a snapshot back into an economy (D-347), or an older save's seed and intents replayed from day 0 (D-338) */
  static restore(s: any, seeds: HHSeed[], opts: { life?: EconLife; trust?: boolean } = {}): Economy {
    if (s.v !== 2) { const e = new Economy(s.seed, seeds, { interventions: s.intents, life: opts.life, trust: opts.trust }); for (let d = 0; d <= s.day; d++) e.step(d); return e; }
    const e = new Economy(s.seed, seeds, { life: opts.life }), H = [...e.hh.values()], hid = (i: number) => H[i].id;
    const uncol = (c: any, set: (h: HH, v: number | undefined) => void) => { if (!c) return;
      const dec = (v: number | null) => v === null ? undefined : c.k ? v / c.k : v; // (q(): Math.round(x * k) / k, the same double)
      if (c.d) c.d.forEach((v: number | null, i: number) => set(H[i], dec(v))); else { let i = 0; c.i.forEach((dx: number, j: number) => { i += dx; set(H[i], dec(c.v[j])); }); } };
    for (const f of HH_NUM) uncol(s.hh[f], (h, v) => { (h as any)[f] = v; });
    for (const c of CAUSES) uncol(s.hh['c.' + c], (h, v) => { if (v === undefined) delete h.cause[c]; else h.cause[c] = v; });
    for (const f of ['advocate', 'lastKin', 'helped', 'hireDay'] as const) for (const h of H) if (h[f] === undefined) delete h[f];
    e.day = s.day; e.debtN = s.debtN; Object.assign(e.market, s.market); Object.assign(e.treasury, s.treasury); for (const [k, v] of s.shocks) e.shocks.set(k, v); e.hires = { day: s.hires[0], n: s.hires[1] };
    for (const [i, to, amt, due, ev, n] of s.debts) H[i].debts.push({ to, amt, due, ev, n });
    for (const [i, to, from, until, ev] of s.bondages) e.bondages.push({ hh: hid(i), to, from, until, ev });
    for (const [i, to, until, ev, done, r] of s.bound) H[i].bound.push({ to, until, ev, done: !!done, rec: e.bondages[r] });
    for (const [day, t, i, a] of s.pending) { const h = H[i], task: any = { ...a, t, hh: h.id };
      if (a.debt !== undefined) task.debt = typeof a.debt === 'number' ? h.debts.find(d => d.n === a.debt) : { to: a.debt[0], amt: a.debt[1], due: a.debt[2], ev: a.debt[3], n: a.debt[4] };
      e.pending.push({ day, task }); }
    for (const i of s.intents) e.addIntent(i);
    e.events.length = s.nEv; let id = 0, day = 0;
    for (const [di, dd, k, actor, causes, other, amt] of s.whole) { id += di; day += dd; const v: EconEvent = { id, day, actor, kind: s.kinds[k], causes }; if (other !== null) v.other = other; if (amt !== null) v.amt = amt; e.events[id] = v; }
    id = 0; day = 0; for (let k = 0; k < s.stub[0].length; k++) { id += s.stub[0][k]; day += s.stub[1][k]; e.events[id] = { id, day, actor: '', kind: s.kinds[s.stub[2][k]], causes: [] }; }
    if (s.trust) e.trust = TrustLedger.restore(s.trust, e); // (D-351: the ledger as it stood; an older save, or a bare economy, has none)
    else if (opts.trust) { e.trust = new TrustLedger(e); e.trust.cursor = s.nEv; } // (an older save turned on: a blank ledger from today)
    return e;
  }
  /** record an intent to be applied on its day (live play) */
  enter(i: Intent) { this.addIntent(i); if (i.day <= this.day) this.applyIntent(i); }

  private season(day: number) { const m = dateOf(Math.max(0, day)).month; return m >= 10 || m <= 0 ? 'winter' : m <= 3 ? 'spring' : m <= 6 ? 'summer' : 'autumn'; }

  // ---- the day ----
  step(day: number): void {
    if (day <= this.day) return; this.day = day;
    const wx = this.wx[day % this.wx.length], { month, dom } = dateOf(day) as any;
    for (const i of this.intents.get(day) ?? []) this.applyIntent(i);
    this.intents.delete(day - 1); // (an intent entered for a past day is applied at once by enter(); nothing reads the list after)
    for (let j = 0, n = this.pending.length; j < n; j++) { const p = this.pending[j]; if (p.day === day) this.run(p.task); } // (in the order laid)
    this.pending = this.pending.filter(x => x.day > day);
    if (day === 20) this.blights(day);
    const pGrain = this.price('grain', day);
    // prices: a rise of a fifth within ten days is an event, caused by what emptied the market
    this.market.hist.push(pGrain);
    const old = this.market.hist[Math.max(0, this.market.hist.length - 11)]; if (this.market.hist.length > 11) this.market.hist.shift();
    if (pGrain > old * 1.2 && (this.market.dearEv < 0 || this.events[this.market.dearEv].day < day - 20)) {
      const recent = this.events.filter(e => e.day >= day - 20 && /^(harvest_poor|blight|buy|ration_cut|hoard)$/.test(e.kind)).slice(-4).map(e => e.id);
      this.market.dearEv = this.ev(day, 'market', 'grain_dear', recent, undefined, pGrain);
      this.market.goodsDemand = Math.max(0.4, GRAIN_BASE / pGrain);
      if (this.market.goodsDemand < 0.8) this.market.slumpEv = this.ev(day, 'market', 'trade_slump', [this.market.dearEv]);
    } else if (pGrain < old * 0.85 && (this.market.cheapEv < 0 || this.events[this.market.cheapEv].day < day - 30)) {
      // D-340: a good year's grain floods the market: barley cheap, and the silver goes to the crafts' goods (C)
      const recent = this.events.filter(e => e.day >= day - 20 && /^(harvest_good|grain_brought|hoard_released)$/.test(e.kind)).slice(-4).map(e => e.id);
      this.market.cheapEv = this.ev(day, 'market', 'grain_cheap', recent, undefined, pGrain); this.market.goodsDemand = Math.min(1.3, this.market.goodsDemand + 0.25);
    } else if (pGrain < old * 0.9) this.market.goodsDemand = Math.min(1.2, this.market.goodsDemand + 0.05);
    // caravans come when grain is dear (C): the market recovers
    if (pGrain > GRAIN_BASE * 2 && h32(this.seed, S.shock, day, 7) % 9 === 0) { this.market.grain += this.hh.size * 12; this.ev(day, 'caravan', 'grain_brought', [this.market.dearEv]); }
    // monthly rations
    if (dom === 1) this.rations(day, month);
    if (dom === 1 && month === 7) this.tax(day);
    if (dom === 12 && month === 9) this.levy(day);
    let k = 0;
    for (const h of this.hh.values()) { this.household(h, day, wx, k++); }
    // the day's end: the state rounded to what matters (D-347: a saved day is short, and a loaded one goes on the same)
    for (const h of this.hh.values()) { h.grain = q(h.grain, 10); h.fuel = q(h.fuel, 10); h.cash = q(h.cash, 1e4); h.health = q(h.health, 1e3); }
    this.market.grain = q(this.market.grain, 100); this.treasury.grain = q(this.treasury.grain, 100);
  }

  private blights(day: number) { // this year's local losses: hail or blight over some quarters (C: a few a year)
    const qs = [...new Set([...this.hh.values()].map(h => h.q))];
    const hail = this.wx.slice(0, 90).filter(w => w.thunder).length;
    for (const [i, q] of qs.entries()) if (u01(this.seed, S.shock, i, 1) < 0.15 + 0.04 * hail) this.shocks.set(q, this.ev(day, 'weather', hail && i % 2 ? 'hail' : 'blight', [], q));
  }
  private rations(day: number, month: number) {
    const takers = [...this.hh.values()].filter(h => h.kind === 'ration' && !h.dead);
    const need = takers.reduce((a, h) => a + h.eaters * GRAIN_EAT * 30, 0);
    let share = 1;
    if (this.treasury.grain < need) { share = Math.max(0.3, this.treasury.grain / need); this.treasury.shortEv = this.ev(day, 'treasury', 'ration_cut', [this.treasury.shortEv, ...this.events.filter(e => e.kind === 'tithe_short' && e.day > day - 60).map(e => e.id)], undefined, share); }
    for (const h of takers) { const g = h.eaters * GRAIN_EAT * 30 * share; h.grain += g; this.treasury.grain -= g; if (share < 1) h.cause.food = this.treasury.shortEv; }
    this.treasury.grain += need * 0.93; // the royal stores' own inflow from the wider province (C)
    if (month === 3) this.treasury.grain += need * 0.2;
  }

  /** the silver tax after the harvest (Achaemenid dues in kind and silver, B; the sum is C): who cannot pay owes the treasury */
  private tax(day: number) {
    for (const h of this.hh.values()) { if (h.dead || h.kind === 'ration') continue; const t = h.kind === 'rich' ? 6 : 1.2 + 0.2 * h.eaters;
      if (h.cash >= t) { h.cash -= t; continue; }
      const owed = t - h.cash; h.cash = 0; const e = this.ev(day, h.id, 'tax_arrears', [h.cause.food, h.cause.cash], 'treasury', owed);
      h.debts.push(this.debt('treasury', owed, day + 45 + (h32(this.seed, S.act, day, this.idx.get(h.id)!) % 30), e)); h.cause.cash = e; }
  }

  /** D-340: an extra levy for the king's works and the army's stores (C: the Fortification texts' dues in kind and the
   *  "king's share", B; an extra call in a lean year is C). Called when the treasury has run short this year, or in about
   *  two years of five otherwise: barley from the farms, a sheep from the flocks, silver from the crafts. A household that
   *  cannot give owes it to the treasury */
  private levy(day: number) {
    const short = this.treasury.shortEv >= 0 && this.events[this.treasury.shortEv].day > day - 150;
    if (!short && u01(this.seed, S.levy, 0) >= 0.4) return;
    const L = this.ev(day, 'treasury', 'levy', [short ? this.treasury.shortEv : undefined]);
    for (const h of this.hh.values()) { if (h.dead || h.kind === 'ration' || h.kind === 'rich') continue;
      const eat = h.eaters * GRAIN_EAT, k = this.idx.get(h.id)!;
      let owed = 0;
      if (h.kind === 'farmer') { const g = 45 * h.land; if (h.grain - g > eat * 45) { h.grain -= g; this.treasury.grain += g; } else owed = g * this.price('grain', day); }
      else if (h.kind === 'herder') { if (h.goods > 0) h.goods--; else owed = 0.8; }
      else { if (h.cash >= 0.6) h.cash -= 0.6; else owed = 0.6 - h.cash; }
      if (owed <= 0) continue;
      const e = this.ev(day, h.id, 'levy_arrears', [L, h.cause.food, h.cause.cash], 'treasury', owed);
      h.debts.push(this.debt('treasury', owed, day + 40 + (h32(this.seed, S.levy, day, k) % 30), e)); h.cause.cash = e;
    }
  }

  /** D-340: a member of the household bound to work off a debt or a fine in the creditor's house (C), until the silver is
   *  worked off at a labourer's wage, at most three years (BOUND_MAX); a good year can redeem them sooner (harvest) */
  private bind(h: HH, to: string, amt: number, day: number, cause: number): number {
    const days = Math.max(20, Math.min(BOUND_MAX, Math.ceil(amt / BOUND_WAGE))); const e = this.ev(day, h.id, 'bound_labour', [cause], to, days);
    const rec: Bondage = { hh: h.id, to, from: day + 1, until: day + days, ev: e }; this.bondages.push(rec);
    const b = { to, until: day + days, ev: e, done: false, rec }; h.bound.push(b); h.workers = Math.max(0, h.workers - 1);
    this.later(day + days, { t: 'release', hh: h.id, b: h.bound.length - 1 });
    return e;
  }
  /** the bondages in force on a day (the day plans: a member of `hh` works in `to`'s house) */
  boundOn(day: number): Bondage[] { return this.bondages.filter(b => b.from <= day && day < b.until); }
  /** may this household borrow (D-340: the lenders remember a default, and want a pledge; C) */
  private creditOk(h: HH, day: number, L?: HH): boolean {
    if (h.badUntil > day) return false; const owed = h.debts.reduce((a, x) => a + x.amt, 0);
    // D-351: the lender's own trust in the borrower (deeds, news, kin, quarter): below 0.35 no loan at all; above 0.7 a loan on
    // the borrower's word, without a pledge (C)
    const t = this.trust && L ? this.trust.credit(L.id, h.id, day) : undefined;
    if (t !== undefined && t < 0.35) return false;
    if (t !== undefined && t > 0.7 && owed < 4) return true;
    return owed < 4 && (h.goods > 0 || h.land > 0.3 || owed < 1);
  }

  private household(h: HH, day: number, wx: DayWeather, k: number) {
    if (h.dead) return;
    const eat = h.eaters * GRAIN_EAT, winter = this.season(day) === 'winter';
    // harvest
    if (h.kind === 'farmer' || h.kind === 'rich') if (day === h.harvestDay) {
      const rain = this.wx.slice(0, 60).reduce((a, w) => a + w.precipMm, 0) + this.wx.slice(270).reduce((a, w) => a + w.precipMm, 0);
      const rf = Math.min(1.3, Math.max(0.4, rain / 180)); const noise = 0.5 + 0.8 * u01(this.seed, S.plot, k, 1);
      const shock = this.shocks.get(h.q); const hit = shock !== undefined ? 0.35 + 0.3 * u01(this.seed, S.yield, k, 2) : 1;
      // (D-340: a farm that lost its ox and could not replace it ploughed late and less: three quarters of the crop, C)
      const ox = h.noOx >= 0 ? 0.75 : 1;
      const y = h.land * 900 * rf * noise * hit * ox; const tithe = y * TITHE; this.treasury.grain += tithe; const keep = y - tithe;
      h.grain += keep;
      if (y < h.land * 900 * 0.7) { const e = this.ev(day, h.id, 'harvest_poor', [shock, h.noOx >= 0 ? h.noOx : undefined], undefined, y); h.cause.food = e; if (tithe < h.land * 90 * 0.6) this.ev(day, 'treasury', 'tithe_short', [e]); }
      else if (y > h.land * 900 * 1.15) { // D-340: a good year: debts paid early, a bound son or daughter redeemed (C)
        const g = this.ev(day, h.id, 'harvest_good', [], undefined, y); const pG = this.price('grain', day);
        const spare = () => Math.max(0, (h.grain - eat * 330) * pG * 0.9);
        for (const d of h.debts) if (d.amt > 0 && spare() > d.amt) { const q = d.amt / (pG * 0.9); h.grain -= q; this.market.grain += q; const L = this.hh.get(d.to); if (L) L.cash += d.amt; d.amt = 0; this.ev(day, h.id, 'repaid', [d.ev, g], d.to); }
        for (const b of h.bound) if (!b.done) { const left = (b.until - day) * BOUND_WAGE; if (spare() > left) { const q = left / (pG * 0.9); h.grain -= q; this.market.grain += q; const L = this.hh.get(b.to); if (L) L.cash += left;
          b.done = true; b.rec.until = day + 1; h.workers++; this.ev(day, h.id, 'redeemed', [b.ev, g], b.to); } }
        h.debts = h.debts.filter(d => d.amt > 0.01);
      }
      // sell the surplus over a year's bread and seed (the rich hoard when the market is thin)
      const surplus = h.grain - eat * 330;
      if (surplus > 0) { const hoard = h.kind === 'rich' && this.price('grain', day) > GRAIN_BASE * 1.3; const sold = hoard ? surplus * 0.3 : surplus * 0.8;
        h.grain -= sold; this.market.grain += sold; h.cash += sold * this.price('grain', day) * 0.9; if (hoard) this.ev(day, h.id, 'hoard', [this.market.dearEv]); }
    }
    // herders: a lamb sold now and then; crafts: the goods they make sell as the market lets them
    if (h.kind === 'craft' && day % 7 === k % 7 && day >= h.sickUntil) {
      h.goods += 1; const sell = u01(this.seed, S.craft, k, day) < this.market.goodsDemand * 0.8;
      if (sell && h.goods > 0) { h.goods--; h.cash += this.price('goods', day); } else if (this.market.goodsDemand < 0.8) h.cause.cash = this.market.slumpEv;
    }
    if (h.kind === 'herder' && day % 30 === k % 30) { h.cash += 0.4 * this.market.goodsDemand + 0.2; h.goods += 1; }
    if (h.kind === 'ration' && day % 30 === k % 30) h.cash += 0.3; // a little silver besides the grain (A in kind, C in amount)
    // D-340: animals lost (a draught ox or cow to sickness or a fall; ewes to wolves or the cold: C, more in winter), and
    // replaced when the household can find the silver (bought, or borrowed for)
    if ((h.kind === 'farmer' || h.kind === 'herder' || h.kind === 'rich') && h.noOx < 0 && u01(this.seed, S.animal, k, day) < (h.kind === 'herder' ? 0.0012 : 0.00005) * (winter ? 2 : 1)) {
      h.noOx = this.ev(day, h.id, 'animal_lost', [h.cause.fuel, h.cause.health]); if (h.kind === 'herder') h.goods = Math.max(0, h.goods - 2); h.cause.cash = h.noOx;
    }
    if (h.noOx >= 0 && day > this.events[h.noOx].day + 2 && day % 5 === k % 5) {
      const cost = h.kind === 'herder' ? 1.5 : 3; // an ox or a few ewes, in weighed silver (C)
      if (h.cash >= cost) { h.cash -= cost; this.ev(day, h.id, 'animal_bought', [h.noOx], 'market', cost); h.noOx = -1; }
      else { const L = this.lender(h.id, h, day); if (L && this.creditOk(h, day, L)) { this.borrow(h, L, cost - h.cash, day, h.noOx); h.cash -= cost; h.cash = Math.max(0, h.cash); this.ev(day, h.id, 'animal_bought', [h.noOx], 'market', cost); h.noOx = -1; } }
    }
    // D-340: a house fire in the cold months (a hearth or a lamp to the roof's reeds and beams: C); the stores and the goods
    // burn; the neighbours of the quarter bring barley
    if (winter && day - h.lastFire > 300 && u01(this.seed, S.fire, k, day) < 0.00003) {
      h.lastFire = day; const f = this.ev(day, h.id, 'house_fire', [h.cause.fuel], undefined); h.grain *= 0.3; h.goods = 0; h.fuel = 0; h.cause.food = f; h.cause.cash = f;
      const qs = this.byQ.get(h.q)!;
      for (let t = 0, n = 0; t < 12 && n < 2; t++) { const N = qs[h32(this.seed, S.fire, k, day * 16 + t) % qs.length]; if (N === h || N.dead || N.grain < N.eaters * GRAIN_EAT * 50) continue;
        const g = eat * 8; N.grain -= g; h.grain += g; this.ev(day + 1, N.id, 'neighbours_help', [f], h.id, g); n++; }
    }
    // eating and burning
    if (h.fuel < 5 && h.workers > 0 && day >= h.sickUntil) h.fuel += 6; // brush and dung gathered by hand (C): only the sick or the lone go cold
    const ate = Math.min(h.grain, eat); h.grain -= ate; h.fuel = Math.max(0, h.fuel - (winter ? 1.5 : 0.6));
    if (ate < eat * 0.8) { h.health = Math.max(0, h.health - 0.03); if (h.health < 0.55 && (h.cause.health === undefined || this.events[h.cause.health].day < day - 30)) h.cause.health = this.ev(day, h.id, 'hunger', [h.cause.food]); }
    else h.health = Math.min(1, h.health + 0.004);
    if (h.fuel <= 0 && winter && (h.cause.fuel === undefined || this.events[h.cause.fuel].day < day - 30)) h.cause.fuel = this.ev(day, h.id, 'cold_hearth', [h.cause.cash]);
    // illness: more likely when hungry or cold (C)
    const pIll = 0.0012 + (1 - h.health) * 0.01 + (winter && h.fuel <= 0 ? 0.004 : 0);
    const L = this.opts.life;
    if (L) { // D-347: the Population's own deaths are this house's deaths; the economy's illness is drawn LIFE_LAG days ahead and
      // laid on a member (sickbed), and when grave, that member's death some days into it (one mortality: no double deaths)
      for (let n = L.deaths(h.id, day); n > 0; n--) this.death(h, day, false);
      if (day >= h.sickUntil && h.illAt < day && u01(this.seed, S.ill, k, day) < pIll) {
        const from = day + LIFE_LAG, len = 6 + (h32(this.seed, S.ill, k, day + 1) % 20);
        const grave = h.health - 0.15 < 0.3 && u01(this.seed, S.ill, k, day + 2) < 0.35, dieOn = grave ? from + 2 + (h32(this.seed, S.ill, k, day + 3) % (len - 3)) : -1;
        const r = L.sicken(h.id, from, from + len, dieOn);
        if (r.ok) { h.illAt = from; this.later(from, { t: 'ill', hh: h.id, ev: len }); if (r.died) this.later(dieOn, { t: 'die', hh: h.id, ev: -1 }); }
      }
    } else if (day >= h.sickUntil && u01(this.seed, S.ill, k, day) < pIll) {
      h.sickUntil = day + 6 + (h32(this.seed, S.ill, k, day + 1) % 20); h.health -= 0.15;
      h.cause.help = this.ev(day, h.id, 'illness', this.illCauses(h, day));
      if (h.health < 0.3 && u01(this.seed, S.ill, k, day + 2) < 0.35) this.death(h, day);
    }
    // debts fall due
    for (const d of h.debts) if (d.due === day) this.due(h, d, day, k);
    h.debts = h.debts.filter(d => d.amt > 0.01);
    // D-347: petty theft, not only from hunger: the least honest houses, short of barley or silver, now and then take from a
    // neighbour's store (C, by analogy: property crime in pre-modern towns ran at one to a few in a thousand people a year,
    // most of it small and not from starvation); with the neighbours' help carrying the hungry (D-344), want alone left ~5 a year
    if (h.honest < 0.1 && day - h.lastTheft > 90 && day - h.lastAct >= 3 && (h.grain < eat * 30 || h.cash < 1) && u01(this.seed, S.steal, k, day, 2) < PETTY_THEFT) {
      h.lastTheft = day; this.steal(h, day, k, this.wantEv(h, h.grain < eat * 30 ? 'food' : 'cash', day), eat * 6); return; }
    // one choice a day at most, when a need presses
    if (day - h.lastAct >= 3) this.decide(h, day, k);
  }

  /** D-347: an illness drawn LIFE_LAG days ago takes hold (the member already lies sick in the Population) */
  private illDue(h: HH, _k: number, len: number) {
    h.sickUntil = this.day + len; h.health -= 0.15; h.illAt = -1;
    h.cause.help = this.ev(this.day, h.id, 'illness', this.illCauses(h, this.day));
  }
  private dieDue(h: HH, _ev: number) { if (!h.dead) this.death(h, this.day); }
  private death(h: HH, day: number, ofIllness = true) {
    const e = this.ev(day, h.id, 'death', ofIllness ? [h.cause.help] : []); h.eaters = Math.max(1, h.eaters - 1); h.workers = Math.max(0, h.workers - (h.workers > 1 ? 1 : 0));
    h.mourning = day + 30; h.cause.kin = e; h.cause.cash = e; // the burial and its meal cost silver (C)
    // (D-340: borrowed for when the house has not got it; was: the silver went below nothing)
    if (h.cash >= 1.5) h.cash -= 1.5; else { const L = this.lender(h.id, h, day); if (L && this.creditOk(h, day, L)) { this.borrow(h, L, 1.5 - h.cash, day, e); } h.cash = Math.max(0, h.cash - 1.5); }
    // a house left with no one to work its land or draw its ration petitions for relief (a widow's petition, C)
    if (h.workers === 0 && day - h.lastPet >= 30) { h.lastPet = day; const k = this.idx.get(h.id)!, eat = h.eaters * GRAIN_EAT; const pet = this.ev(day + 2, h.id, 'petition', [e], 'court'); this.relief(h, day + 2, k, pet, eat); }
    for (const kid of h.kin) { const K = this.hh.get(kid); if (K && !K.dead) { K.mourning = day + 20; K.cause.kin = this.ev(day, kid, 'mourning', [e], h.id); } }
  }

  private due(h: HH, d: HH['debts'][number], day: number, k: number) {
    if (h.cash >= d.amt) { h.cash -= d.amt; const L = this.hh.get(d.to); if (L) L.cash += d.amt; d.amt = 0; this.ev(day, h.id, 'repaid', [d.ev], d.to); return; }
    const def = this.ev(day, h.id, 'default', [d.ev, h.cause.cash], d.to); h.badUntil = day + 240; h.badEv = def;
    const L = this.hh.get(d.to);
    let cause = def;
    if (h.goods > 0 || h.land > 0.3) { // the lender takes the pledge
      const take = h.goods > 0 ? 'goods' : 'land'; const worth = take === 'goods' ? h.goods * this.price('goods', day) : 3; // (a strip of field ~3 sheqels: C)
      if (take === 'goods') h.goods = 0; else { h.land -= 0.3; if (L) L.land += 0.3; }
      cause = this.ev(day, d.to, 'pledge_seized', [def], h.id); h.cause.cash = def; h.cause.food = h.cause.food ?? def;
      // (D-340: the pledge covers what it is worth; the rest of the debt is still owed, and goes to the judge)
      if (worth >= d.amt - 0.05) { d.amt = 0; return; } d.amt -= worth;
    }
    // nothing (more) to take: the lender goes to the judge
    const pet = this.ev(day, d.to, 'suit', [cause], h.id);
    this.later(day + 8 + (h32(this.seed, S.judge, k, day) % 10), { t: 'judgeDebt', hh: h.id, cause: pet, debt: d });
  }

  /** the judge's decision (C throughout: Babylonian and Achaemenid practice by analogy, the odds reasoned): a debt either
   *  gets time or is worked off in the creditor's house (D-340: bind, until the silver is worked off); a theft is acquitted,
   *  fined (restitution to the victim; unpaid, worked off in the victim's house) or punished with a beating */
  private judge(h: HH, _d: number, cause: number, what: 'debt' | 'theft', debt?: HH['debts'][number], victim?: string) {
    const day = this.day, k = this.idx.get(h.id)!, lenient = ((h as any).advocate ?? -1) >= day;
    const r = u01(this.seed, S.judge, k, day);
    if (what === 'debt') {
      if (lenient || r < 0.3) { if (debt) debt.due = day + 90; this.ev(day, 'court', 'time_granted', [cause], h.id); return; }
      const e = this.ev(day, 'court', 'debt_labour', [cause], h.id); const amt = debt?.amt ?? 2; if (debt) debt.amt = 0;
      const b = this.bind(h, debt?.to ?? 'treasury', amt, day, e); h.cause.food = b; h.cause.help = b; return;
    }
    if (lenient || r < 0.25) { this.ev(day, 'court', 'acquitted', [cause], h.id); return; }
    const e = this.ev(day, 'court', r < 0.6 ? 'fined' : 'beaten', [cause], h.id);
    if (r < 0.6) { const f = 2, V = victim ? this.hh.get(victim) : undefined;
      if (h.cash >= f) { h.cash -= f; if (V) V.cash += f; }
      else { const lender = this.lender(h.id, h, day); if (lender && this.creditOk(h, day, lender)) { this.borrow(h, lender, f, day, e); h.cash -= f; if (V) V.cash += f; } else h.cause.food = this.bind(h, victim ?? 'treasury', f, day, e); }
      h.cause.cash = e; }
    else { h.health = Math.max(0, h.health - 0.2); h.sickUntil = day + 10; h.cause.help = e; h.cause.health = e; }
  }
  /** a petition for relief answered after some days: grain from the royal store, or refused (C) */
  private relief(h: HH, day: number, k: number, pet: number, eat: number) {
    this.later(day + 5 + (h32(this.seed, S.judge, k, day) % 12), { t: 'relief', hh: h.id, d: day, pet, eat });
  }
  private reliefDue(h: HH, day: number, k: number, pet: number, eat: number) {
    const ok = this.treasury.grain > eat * 30 && u01(this.seed, S.judge, k, day + 3) < 0.6;
    if (ok) { this.treasury.grain -= eat * 30; h.grain += eat * 30; this.ev(this.day, 'treasury', 'relief', [pet], h.id); } else h.cause.food = this.ev(this.day, 'court', 'petition_refused', [pet], h.id);
  }
  /** a deferred step falls due (D-347: data, not closures, so the economy's state can be saved and restored as it is) */
  private run(p: Task) {
    const h = this.hh.get(p.hh)!, k = this.idx.get(p.hh)!;
    switch (p.t) {
      case 'release': { const b = h.bound[p.b]; if (b.done) return; b.done = true; h.workers++; this.ev(this.day, h.id, 'released', [b.ev], b.to); return; }
      case 'judgeDebt': this.judge(h, this.day, p.cause, 'debt', p.debt); return;
      case 'relief': this.reliefDue(h, p.d, k, p.pet, p.eat); return;
      case 'remit': { const tre = p.debt; if (tre.amt <= 0.01) return;
        if (u01(this.seed, S.judge, k, p.d + 9) < 0.35) { tre.amt = 0; this.ev(this.day, 'treasury', 'remitted', [p.pet], h.id); } else { tre.due = Math.max(tre.due, this.day + 1); h.cause.cash = this.ev(this.day, 'court', 'petition_refused', [p.pet], h.id); }
        return; }
      case 'arrest': { const ar = this.ev(this.day, 'court', 'arrest', [p.acc], h.id); h.sickUntil = Math.max(h.sickUntil, this.day + 1); h.lastAct = this.day;
        this.later(this.day + 4 + (h32(this.seed, S.judge, k, p.d) % 8), { t: 'judgeTheft', hh: p.hh, v: p.v, g: p.g, ar, d: p.d }); return; }
      case 'judgeTheft': { const v = this.hh.get(p.v)!; h.grain = Math.max(0, h.grain - p.g * 0.5); v.grain += p.g * 0.5; this.judge(h, p.d, p.ar, 'theft', undefined, p.v); return; }
      case 'ill': this.illDue(h, k, p.ev); return;
      case 'die': this.dieDue(h, p.ev); return;
    }
  }

  private hires = { day: -1, n: 0 };
  private hired(day: number) { if (this.hires.day !== day) { this.hires.day = day; this.hires.n = 0; } return this.hires.n; }
  private lenders: HH[] = []; private lendersDay = -1;
  private lender(not: string, asker?: HH, day = this.day): HH | undefined {
    if (this.lendersDay !== this.day) { this.lendersDay = this.day; this.lenders = [...this.hh.values()].filter(h => !h.dead && h.cash > 10).sort((a, b) => b.cash - a.cash).slice(0, 12); }
    const ok = this.lenders.filter(h => h.id !== not && h.cash > 10);
    // D-351: the asker goes first to the lender who trusts them most (the richest on a tie)
    if (this.trust && asker && ok.length > 1) { let best = ok[0], bt = this.trust.credit(best.id, asker.id, day); for (const c of ok) { const t = this.trust.credit(c.id, asker.id, day); if (t > bt + 1e-9) { best = c; bt = t; } } return best; }
    return ok[0];
  }
  private borrow(h: HH, L: HH, amt: number, day: number, cause: number | undefined): number {
    L.cash -= amt; h.cash += amt; const e = this.ev(day, h.id, 'loan', [cause], L.id, amt);
    h.debts.push(this.debt(L.id, amt * 1.1, day + 60 + (h32(this.seed, S.act, day, amt | 0) % 60), e)); h.cause.cash = e; return e;
  }

  /** s15 (D-358 repair): the event behind a want the house acts on (a loan, a sale, a theft, a petition, kin's help). A want
   *  with no event recorded (the stores simply ran down, the silver ran out) is itself recorded, 'stores_low', 'fuel_low' or
   *  'silver_short', caused by what the state knows lies behind it: for barley, the treasury's ration cut (a ration house) and
   *  the market's dear grain of the last sixty days; for silver, the debts that press it (each debt's own event, soonest due
   *  first) and the house's own want of barley (silver goes on bread). Was: the act named the undefined cause, and a loan
   *  taken for a want nobody recorded began a chain from nothing (s15: the stranger's loans to such houses joined no chain). */
  private wantEv(h: HH, kind: 'food' | 'fuel' | 'cash', day: number): number {
    const c = h.cause[kind]; if (c !== undefined && this.events[c]) return c;
    const recent = (e: number) => (e >= 0 && this.events[e] && this.events[e].day > day - 60 ? e : undefined);
    const causes = kind === 'food' ? [h.kind === 'ration' ? recent(this.treasury.shortEv) : undefined, recent(this.market.dearEv)]
      : kind === 'cash' ? [...h.debts.filter(d => d.amt > 0.01).sort((a, b) => a.due - b.due).slice(0, 2).map(d => d.ev), h.cause.food] : [];
    const e = this.ev(day, h.id, kind === 'food' ? 'stores_low' : kind === 'fuel' ? 'fuel_low' : 'silver_short', causes); h.cause[kind] = e; return e;
  }
  /** s15: what made an illness likelier (the draw's own terms): a house poorly fed (its hunger), a cold hearth in winter; a
   *  healthy, warm house falls ill by chance alone, and the illness then names no cause (was: both causes always, even
   *  when the house was fed and warm) */
  private illCauses(h: HH, day: number): (number | undefined)[] {
    return [h.health < 0.75 ? h.cause.health : undefined, this.season(day) === 'winter' && h.fuel <= 0 ? h.cause.fuel : undefined];
  }
  private decide(h: HH, day: number, k: number) {
    const eat0 = h.eaters * GRAIN_EAT;
    if (!h.debts.length && day >= h.sickUntil && h.health > 0.46 && h.grain > eat0 * 9.5 && h.fuel > 4.5) return; // nothing presses (the same test as below, cheaply)
    const needs = this.needsOf(h.id).filter(n => n.kind !== 'water' && n.kind !== 'kin').sort((a, b) => b.urgency - a.urgency); const top = needs[0];
    if (!top || top.urgency < 0.55) return;
    const r = u01(this.seed, S.act, k, day), pG = this.price('grain', day), eat = h.eaters * GRAIN_EAT;
    const act = (kind: string, causes: (number | undefined)[], other?: string, amt?: number) => { h.lastAct = day; return this.ev(day, h.id, kind, causes, other, amt); };
    if (top.kind === 'food' || top.kind === 'fuel') {
      const want = top.kind === 'food' ? eat * 20 : 10, cost = top.kind === 'food' ? want * pG : want * this.price('fuel', day);
      const cause = this.wantEv(h, top.kind, day);
      if (h.cash >= cost) { h.cash -= cost; if (top.kind === 'food') { const got = Math.min(want, this.market.grain); this.market.grain -= got; h.grain += got; } else h.fuel += want; act(top.kind === 'food' ? 'buy' : 'buy_fuel', [cause, top.kind === 'food' ? this.market.dearEv : undefined], 'market', cost); return; }
      if (h.goods > 0) { h.goods--; h.cash += this.price('goods', day); act('sell', [cause, this.market.slumpEv], 'market'); return; }
      const kin = h.kin.map(x => this.hh.get(x)!).find(K => K && !K.dead && K.grain > K.eaters * GRAIN_EAT * 60 && (!this.trust || this.trust.willHelp(K.id, h.id, day, 0.2))); // (D-351: kin help whom they trust)
      if (kin && top.kind === 'food' && day - ((h as any).lastKin ?? -99) >= 40) { (h as any).lastKin = day; // (D-340: kin help once in forty days; C)
        const g = eat * 15; kin.grain -= g; h.grain += g; const e = act('kin_help', [cause], kin.id, g); kin.cause.food = kin.cause.food ?? e; return; }
      // (D-340: the treasury's works take on only so many day labourers a day, C: ~12 across the town and the plain)
      if (h.workers > 0 && day >= h.sickUntil && r < 0.5 && this.hired(day) < 12) { const g = eat * 8; if (this.treasury.grain > g) { this.hires.n++; this.treasury.grain -= g; h.grain += g; h.sickUntil = day + 2; act('wage_work', [cause], 'treasury', g); return; } }
      // (D-340, the seed-7 loop: a quarter's better-off farmers hire the hungry for a day's work on their land, paid in barley,
      // one labourer a day each; C: day labour for neighbours, the commonest outlet of the landless and the short)
      if (h.workers > 0 && day >= h.sickUntil && top.kind === 'food') { const qs = this.byQ.get(h.q)!;
        for (let t = 0; t < 6; t++) { const N = qs[h32(this.seed, S.act, k, day * 8 + t) % qs.length]; if (N === h || N.dead || N.kind === 'ration' || N.workers < 1 || (N as any).hireDay === day || N.grain < N.eaters * GRAIN_EAT * 200 || (this.trust && !this.trust.willHelp(N.id, h.id, day, 0.25))) continue; // (D-351: no hiring of one they do not trust)
          (N as any).hireDay = day; const g = eat * 6; N.grain -= g; h.grain += g; h.sickUntil = day + 1; act('hired_by_neighbour', [cause], N.id, g); return; } }
      const L = this.lender(h.id, h, day);
      let refused: number | undefined;
      if (L && this.creditOk(h, day, L)) { this.borrow(h, L, Math.max(1, cost), day, cause); h.lastAct = day; return; }
      // D-340: the lenders will not lend again after a default, nor without a pledge (C): the refusal is an event
      if (L && day - h.lastRefused > 30) { h.lastRefused = day; refused = act('loan_refused', [cause, h.badUntil > day ? h.badEv : undefined], L.id); }
      // (D-340, the seed-7 loop: a farm refused credit sells a strip of its land to a rich house for silver, C: land sales
      // under need concentrate land in the lenders' hands)
      if (L && h.land > 0.6 && top.urgency > 0.75) { h.land -= 0.3; L.land += 0.3; L.cash -= 3; h.cash += 3; act('land_sold', [refused ?? cause], L.id, 3); return; }
      if (top.kind === 'food' && top.urgency > 0.65 && day - h.lastTheft > 20 && h.honest < 0.6 && u01(this.seed, S.steal, k, day, 1) < 0.35 + 0.6 * (1 - h.honest)) { h.lastTheft = day; this.steal(h, day, k, refused ?? cause); return; }
      if (day - h.lastPet < 30 || top.kind === 'fuel') return;
      h.lastPet = day; const pet = act('petition', [refused ?? cause], 'court'); this.relief(h, day, k, pet, eat);
      return;
    }
    if (top.kind === 'cash' && h.goods > 0) { h.goods--; h.cash += this.price('goods', day); act('sell', [this.wantEv(h, 'cash', day)], 'market'); return; }
    // D-340: a household owing the treasury (tax or levy arrears) petitions for remission (C: the officials could remit
    // or defer dues; the odds are reasoned)
    const tre = h.debts.find(d => d.to === 'treasury');
    if (top.kind === 'cash' && tre && day - h.lastPet >= 30 && r < 0.5) {
      h.lastPet = day; const pet = act('petition', [tre.ev], 'court');
      this.later(day + 4 + (h32(this.seed, S.judge, k, day + 7) % 10), { t: 'remit', hh: h.id, debt: tre, pet, d: day });
      return;
    }
    if (top.kind === 'help' || top.kind === 'health') { const K = h.kin.map(x => this.hh.get(x)!).find(K => K && !K.dead && K.workers > 1);
      if (K && (h as any).helped !== h.sickUntil) { (h as any).helped = h.sickUntil; const e = act('nursed_by_kin', [h.cause.help ?? h.cause.health], K.id); K.cash = Math.max(0, K.cash - 0.3); if (K.cash < 1) K.cause.cash = e; } }
  }

  private steal(h: HH, day: number, k: number, cause: number | undefined, most = h.eaters * GRAIN_EAT * 25) {
    const qs = this.byQ.get(h.q)!; let v: HH | undefined;
    for (let t = 0; t < 8 && !v; t++) { const c = qs[h32(this.seed, S.steal, k, day * 8 + t) % qs.length]; if (c.id !== h.id && c.grain > c.eaters * GRAIN_EAT * 30) v = c; }
    if (!v) return; const g = Math.min(v.grain * 0.3, most);
    v.grain -= g; h.grain += g; h.lastAct = day; const e = this.ev(day, h.id, 'theft', [cause], v.id, g); v.cause.food = this.ev(day, v.id, 'robbed', [e], h.id, g);
    // found out (C): the victim accuses the thief before the judge the next morning; the judge's men take him the day after
    // (arrest) and hold him until he is judged; half the grain found is given back
    if (u01(this.seed, S.detect, k, day) < 0.55) { const acc = this.ev(day + 1, v.id, 'accusation', [e, v.cause.food], h.id);
      this.later(day + 2, { t: 'arrest', hh: h.id, v: v.id, g, acc, d: day }); }
  }
}
