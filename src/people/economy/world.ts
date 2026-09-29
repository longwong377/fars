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

export type HHKind = 'farmer' | 'ration' | 'craft' | 'herder' | 'rich';
export interface HHSeed { id: string; kind: HHKind; eaters: number; workers: number; q: string; kin?: string[] }
export interface EconEvent { id: number; day: number; actor: string; kind: string; causes: number[]; other?: string; amt?: number }
interface HH extends HHSeed {
  kin: string[]; grain: number; fuel: number; cash: number; goods: number; land: number; health: number; honest: number;
  sickUntil: number; mourning: number; lastPet: number; lastTheft: number; debts: { to: string; amt: number; due: number; ev: number }[];
  cause: Partial<Record<NeedKind, number>>; lastAct: number; harvestDay: number; dead: number;
}

const S = { yield: salt('econ-yield'), plot: salt('econ-plot'), act: salt('econ-act'), ill: salt('econ-ill'), steal: salt('econ-steal'),
  detect: salt('econ-detect'), judge: salt('econ-judge'), kin: salt('econ-kin'), trait: salt('econ-trait'), shock: salt('econ-shock'), craft: salt('econ-craft') };
const GRAIN_EAT = 0.55;        // kg a day per eater (a ration of ~1 qa of barley, A in kind, C in kg)
const GRAIN_BASE = 0.02;       // sheqel per kg at a normal market (C)
const TITHE = 0.1;             // the treasury's share of a harvest (B)
export const SYSTEMS = ['weather', 'market', 'treasury', 'court', 'caravan'] as const;

export class Economy implements EconWorld {
  readonly hh = new Map<string, HH>();
  readonly events: EconEvent[] = [];
  readonly wx: DayWeather[];
  day = -1;
  market = { grain: 0, goodsDemand: 1, dearEv: -1, slumpEv: -1, hist: [] as number[] };
  treasury = { grain: 0, shortEv: -1 };
  private pending: { day: number; run: () => void }[] = [];
  private intents: Intent[] = [];
  private idx = new Map<string, number>(); private byQ = new Map<string, HH[]>();
  private shocks = new Map<string, number>(); // quarter -> event of this year's local blight
  constructor(readonly seed: number, seeds: HHSeed[], readonly opts: { interventions?: Intent[] } = {}) {
    this.wx = generateYear(seed, START_JDN, 365);
    const ids = seeds.map(s => s.id);
    for (const [i, s] of seeds.entries()) {
      const u = (k: number) => u01(seed, S.trait, i, k);
      const kin = s.kin ?? [0, 1].map(k => ids[h32(seed, S.kin, i, k) % ids.length]).filter(x => x !== s.id);
      const rich = s.kind === 'rich';
      this.hh.set(s.id, { ...s, kin, grain: s.eaters * GRAIN_EAT * (40 + 80 * u(1)) * (rich ? 4 : 1), fuel: 10 + 20 * u(2), cash: (rich ? 80 : 1) + 6 * u(3) * u(3),
        goods: Math.floor(4 * u(4)) + (s.kind === 'craft' ? 3 : 0), land: s.kind === 'farmer' ? 1.2 + 2.8 * u(5) : rich ? 6 : 0, health: 0.8 + 0.2 * u(6),
        honest: u(7), sickUntil: -1, mourning: -1, debts: [], cause: {}, lastAct: -99, lastPet: -99, lastTheft: -99, harvestDay: 34 + Math.floor(40 * u(8)), dead: 0 });
    }
    for (const [i, h] of [...this.hh.values()].entries()) { this.idx.set(h.id, i); if (!this.byQ.has(h.q)) this.byQ.set(h.q, []); this.byQ.get(h.q)!.push(h); }
    this.market.grain = seeds.length * 60; this.treasury.grain = seeds.filter(s => s.kind === 'ration').reduce((a, s) => a + s.eaters, 0) * GRAIN_EAT * 45;
    for (const i of opts.interventions ?? []) this.intents.push(i);
  }

  // ---- the event graph ----
  private ev(day: number, actor: string, kind: string, causes: (number | undefined)[], other?: string, amt?: number): number {
    const id = this.events.length; this.events.push({ id, day, actor, kind, causes: [...new Set(causes.filter((c): c is number => c !== undefined && c >= 0))], other, amt }); return id;
  }
  private later(day: number, run: () => void) { this.pending.push({ day, run }); }

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
    if (i.kind === 'help' || i.kind === 'trade') {
      const g = Number(p.grain ?? 0), c = Number(p.cash ?? 0), f = Number(p.fuel ?? 0);
      to.grain += g; to.cash += c; to.fuel += f; if (g) changes.push(`${i.to}.grain+${g}`); if (c) changes.push(`${i.to}.cash+${c}`); if (f) changes.push(`${i.to}.fuel+${f}`);
      this.ev(d, i.to, 'given', [], i.from, g + c);
    } else if (i.kind === 'loan') {
      const c = Number(p.cash ?? 0); to.cash += c; changes.push(`${i.to}.cash+${c}`); // the player's loan: no interest, no court
      this.ev(d, i.to, 'lent_by_stranger', [], i.from, c);
    } else if (i.kind === 'petition') { // speaking for a household before the judge: the next judgement over it is lenient
      (to as any).advocate = d + Number(p.days ?? 30); changes.push(`${i.to}.advocate`); this.ev(d, i.to, 'spoken_for', [], i.from);
    } else if (i.kind === 'work') { const g = Number(p.grain ?? 0); to.grain += g; changes.push(`${i.to}.grain+${g}`); this.ev(d, i.to, 'hired_by_stranger', [], i.from, g);
    } else { this.ev(d, i.to, i.kind, [], i.from); changes.push(`${i.to}.${i.kind}`); }
    return { ok: true, changes };
  }
  snapshot() { return { seed: this.seed, day: this.day, intents: this.intents.map(i => ({ ...i })) }; }
  static restore(s: { seed: number; day: number; intents: Intent[] }, seeds: HHSeed[]): Economy {
    const e = new Economy(s.seed, seeds, { interventions: s.intents }); for (let d = 0; d <= s.day; d++) e.step(d); return e;
  }
  /** record an intent to be applied on its day (live play) */
  enter(i: Intent) { this.intents.push(i); if (i.day <= this.day) this.applyIntent(i); }

  private season(day: number) { const m = dateOf(Math.max(0, day)).month; return m >= 10 || m <= 0 ? 'winter' : m <= 3 ? 'spring' : m <= 6 ? 'summer' : 'autumn'; }

  // ---- the day ----
  step(day: number): void {
    if (day <= this.day) return; this.day = day;
    const wx = this.wx[day % this.wx.length], { month, dom } = dateOf(day) as any;
    for (const i of this.intents) if (i.day === day) this.applyIntent(i);
    for (const p of this.pending.filter(x => x.day === day)) p.run();
    this.pending = this.pending.filter(x => x.day > day);
    if (day === 20) this.blights(day);
    const pGrain = this.price('grain', day);
    // prices: a rise of a fifth within ten days is an event, caused by what emptied the market
    this.market.hist.push(pGrain);
    const old = this.market.hist[Math.max(0, this.market.hist.length - 11)];
    if (pGrain > old * 1.2 && (this.market.dearEv < 0 || this.events[this.market.dearEv].day < day - 20)) {
      const recent = this.events.filter(e => e.day >= day - 20 && /^(harvest_poor|blight|buy|ration_cut|hoard)$/.test(e.kind)).slice(-4).map(e => e.id);
      this.market.dearEv = this.ev(day, 'market', 'grain_dear', recent, undefined, pGrain);
      this.market.goodsDemand = Math.max(0.4, GRAIN_BASE / pGrain);
      if (this.market.goodsDemand < 0.8) this.market.slumpEv = this.ev(day, 'market', 'trade_slump', [this.market.dearEv]);
    } else if (pGrain < old * 0.9) this.market.goodsDemand = Math.min(1.2, this.market.goodsDemand + 0.05);
    // caravans come when grain is dear (C): the market recovers
    if (pGrain > GRAIN_BASE * 2 && h32(this.seed, S.shock, day, 7) % 9 === 0) { this.market.grain += this.hh.size * 12; this.ev(day, 'caravan', 'grain_brought', [this.market.dearEv]); }
    // monthly rations
    if (dom === 1) this.rations(day, month);
    if (dom === 1 && month === 7) this.tax(day);
    let k = 0;
    for (const h of this.hh.values()) { this.household(h, day, wx, k++); }
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
      h.debts.push({ to: 'treasury', amt: owed, due: day + 45 + (h32(this.seed, S.act, day, this.idx.get(h.id)!) % 30), ev: e }); h.cause.cash = e; }
  }

  private household(h: HH, day: number, wx: DayWeather, k: number) {
    if (h.dead) return;
    const eat = h.eaters * GRAIN_EAT, winter = this.season(day) === 'winter';
    // harvest
    if (h.kind === 'farmer' || h.kind === 'rich') if (day === h.harvestDay) {
      const rain = this.wx.slice(0, 60).reduce((a, w) => a + w.precipMm, 0) + this.wx.slice(270).reduce((a, w) => a + w.precipMm, 0);
      const rf = Math.min(1.3, Math.max(0.4, rain / 180)); const noise = 0.5 + 0.8 * u01(this.seed, S.plot, k, 1);
      const shock = this.shocks.get(h.q); const hit = shock !== undefined ? 0.35 + 0.3 * u01(this.seed, S.yield, k, 2) : 1;
      const y = h.land * 900 * rf * noise * hit; const tithe = y * TITHE; this.treasury.grain += tithe; const keep = y - tithe;
      h.grain += keep;
      if (y < h.land * 900 * 0.7) { const e = this.ev(day, h.id, 'harvest_poor', [shock], undefined, y); h.cause.food = e; if (tithe < h.land * 90 * 0.6) this.ev(day, 'treasury', 'tithe_short', [e]); }
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
    // eating and burning
    if (h.fuel < 5 && h.workers > 0 && day >= h.sickUntil) h.fuel += 6; // brush and dung gathered by hand (C): only the sick or the lone go cold
    const ate = Math.min(h.grain, eat); h.grain -= ate; h.fuel = Math.max(0, h.fuel - (winter ? 1.5 : 0.6));
    if (ate < eat * 0.8) { h.health = Math.max(0, h.health - 0.03); if (h.health < 0.55 && (h.cause.health === undefined || this.events[h.cause.health].day < day - 30)) h.cause.health = this.ev(day, h.id, 'hunger', [h.cause.food]); }
    else h.health = Math.min(1, h.health + 0.004);
    if (h.fuel <= 0 && winter && (h.cause.fuel === undefined || this.events[h.cause.fuel].day < day - 30)) h.cause.fuel = this.ev(day, h.id, 'cold_hearth', [h.cause.cash]);
    // illness: more likely when hungry or cold (C)
    const pIll = 0.0012 + (1 - h.health) * 0.01 + (winter && h.fuel <= 0 ? 0.004 : 0);
    if (day >= h.sickUntil && u01(this.seed, S.ill, k, day) < pIll) {
      h.sickUntil = day + 6 + (h32(this.seed, S.ill, k, day + 1) % 20); h.health -= 0.15;
      h.cause.help = this.ev(day, h.id, 'illness', [h.cause.health, h.cause.fuel]);
      if (h.health < 0.3 && u01(this.seed, S.ill, k, day + 2) < 0.35) this.death(h, day);
    }
    // debts fall due
    for (const d of h.debts) if (d.due === day) this.due(h, d, day, k);
    h.debts = h.debts.filter(d => d.amt > 0.01);
    // one choice a day at most, when a need presses
    if (day - h.lastAct >= 3) this.decide(h, day, k);
  }

  private death(h: HH, day: number) {
    const e = this.ev(day, h.id, 'death', [h.cause.help]); h.eaters = Math.max(1, h.eaters - 1); h.workers = Math.max(0, h.workers - (h.workers > 1 ? 1 : 0));
    h.cash -= 1.5; h.mourning = day + 30; h.cause.kin = e; h.cause.cash = e; // the burial and its meal cost silver (C)
    for (const kid of h.kin) { const K = this.hh.get(kid); if (K && !K.dead) { K.mourning = day + 20; K.cause.kin = this.ev(day, kid, 'mourning', [e], h.id); } }
  }

  private due(h: HH, d: HH['debts'][number], day: number, k: number) {
    if (h.cash >= d.amt) { h.cash -= d.amt; const L = this.hh.get(d.to); if (L) L.cash += d.amt; d.amt = 0; this.ev(day, h.id, 'repaid', [d.ev], d.to); return; }
    const def = this.ev(day, h.id, 'default', [d.ev, h.cause.cash], d.to);
    const L = this.hh.get(d.to);
    if (h.goods > 0 || h.land > 0.3) { // the lender takes the pledge
      const take = h.goods > 0 ? 'goods' : 'land'; if (take === 'goods') h.goods = 0; else { h.land -= 0.3; if (L) L.land += 0.3; }
      this.ev(day, d.to, 'pledge_seized', [def], h.id); d.amt = 0; h.cause.cash = def; h.cause.food = h.cause.food ?? def; return;
    }
    // nothing to take: the lender goes to the judge
    const pet = this.ev(day, d.to, 'suit', [def], h.id);
    this.later(day + 8 + (h32(this.seed, S.judge, k, day) % 10), () => this.judge(h, day + 0, pet, 'debt', d));
  }

  private judge(h: HH, _d: number, cause: number, what: 'debt' | 'theft', debt?: HH['debts'][number]) {
    const day = this.day, k = this.idx.get(h.id)!, lenient = ((h as any).advocate ?? -1) >= day;
    const r = u01(this.seed, S.judge, k, day);
    if (what === 'debt') {
      if (lenient || r < 0.3) { if (debt) debt.due = day + 90; this.ev(day, 'court', 'time_granted', [cause], h.id); return; }
      const e = this.ev(day, 'court', 'debt_labour', [cause], h.id); h.workers = Math.max(0, h.workers - 1); if (debt) debt.amt = 0; h.cause.food = e; h.cause.help = e; return;
    }
    if (lenient || r < 0.25) { this.ev(day, 'court', 'acquitted', [cause], h.id); return; }
    const e = this.ev(day, 'court', r < 0.6 ? 'fined' : 'beaten', [cause], h.id);
    if (r < 0.6) { const f = 2; if (h.cash >= f) h.cash -= f; else { const lender = this.lender(h.id); if (lender) this.borrow(h, lender, f, day, e); } h.cause.cash = e; }
    else { h.health = Math.max(0, h.health - 0.2); h.sickUntil = day + 10; h.cause.help = e; h.cause.health = e; }
  }

  private lenders: HH[] = []; private lendersDay = -1;
  private lender(not: string): HH | undefined {
    if (this.lendersDay !== this.day) { this.lendersDay = this.day; this.lenders = [...this.hh.values()].filter(h => !h.dead && h.cash > 10).sort((a, b) => b.cash - a.cash).slice(0, 12); }
    return this.lenders.find(h => h.id !== not && h.cash > 10);
  }
  private borrow(h: HH, L: HH, amt: number, day: number, cause: number | undefined): number {
    L.cash -= amt; h.cash += amt; const e = this.ev(day, h.id, 'loan', [cause], L.id, amt);
    h.debts.push({ to: L.id, amt: amt * 1.1, due: day + 60 + (h32(this.seed, S.act, day, amt | 0) % 60), ev: e }); h.cause.cash = e; return e;
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
      const cause = top.kind === 'food' ? h.cause.food : h.cause.fuel;
      if (h.cash >= cost) { h.cash -= cost; if (top.kind === 'food') { const got = Math.min(want, this.market.grain); this.market.grain -= got; h.grain += got; } else h.fuel += want; act('buy', [cause, this.market.dearEv], 'market', cost); return; }
      if (h.goods > 0) { h.goods--; h.cash += this.price('goods', day); act('sell', [cause, this.market.slumpEv], 'market'); return; }
      const kin = h.kin.map(x => this.hh.get(x)!).find(K => K && !K.dead && K.grain > K.eaters * GRAIN_EAT * 60);
      if (kin && top.kind === 'food') { const g = eat * 15; kin.grain -= g; h.grain += g; const e = act('kin_help', [cause], kin.id, g); kin.cause.food = kin.cause.food ?? e; return; }
      if (h.workers > 0 && day >= h.sickUntil && r < 0.5) { const g = eat * 8; if (this.treasury.grain > g) { this.treasury.grain -= g; h.grain += g; h.sickUntil = day + 2; act('wage_work', [cause], 'treasury', g); return; } }
      const L = this.lender(h.id), owed = h.debts.reduce((a, x) => a + x.amt, 0);
      if (L && owed < 4) { this.borrow(h, L, Math.max(1, cost), day, cause); h.lastAct = day; return; }
      if (top.kind === 'food' && top.urgency > 0.8 && day - h.lastTheft > 25 && r < 0.35 + 0.2 * (1 - h.honest) && h.honest < 0.5) { h.lastTheft = day; this.steal(h, day, k, cause); return; }
      if (day - h.lastPet < 30 || top.kind === 'fuel') return;
      h.lastPet = day; const pet = act('petition', [cause], 'court');
      this.later(day + 5 + (h32(this.seed, S.judge, k, day) % 12), () => { const ok = this.treasury.grain > eat * 30 && u01(this.seed, S.judge, k, day + 3) < 0.6;
        if (ok) { this.treasury.grain -= eat * 30; h.grain += eat * 30; this.ev(this.day, 'treasury', 'relief', [pet], h.id); } else h.cause.food = this.ev(this.day, 'court', 'petition_refused', [pet], h.id); });
      return;
    }
    if (top.kind === 'cash' && h.goods > 0) { h.goods--; h.cash += this.price('goods', day); act('sell', [h.cause.cash], 'market'); return; }
    if (top.kind === 'help' || top.kind === 'health') { const K = h.kin.map(x => this.hh.get(x)!).find(K => K && !K.dead && K.workers > 1);
      if (K && (h as any).helped !== h.sickUntil) { (h as any).helped = h.sickUntil; const e = act('nursed_by_kin', [h.cause.help ?? h.cause.health], K.id); K.cash = Math.max(0, K.cash - 0.3); if (K.cash < 1) K.cause.cash = e; } }
  }

  private steal(h: HH, day: number, k: number, cause: number | undefined) {
    const qs = this.byQ.get(h.q)!; let v: HH | undefined;
    for (let t = 0; t < 8 && !v; t++) { const c = qs[h32(this.seed, S.steal, k, day * 8 + t) % qs.length]; if (c.id !== h.id && c.grain > c.eaters * GRAIN_EAT * 30) v = c; }
    if (!v) return; const g = Math.min(v.grain * 0.3, h.eaters * GRAIN_EAT * 25);
    v.grain -= g; h.grain += g; h.lastAct = day; const e = this.ev(day, h.id, 'theft', [cause], v.id, g); v.cause.food = this.ev(day, v.id, 'robbed', [e], h.id, g);
    if (u01(this.seed, S.detect, k, day) < 0.55) { const acc = this.ev(day + 1, v.id, 'accusation', [e, v.cause.food], h.id);
      this.later(day + 6 + (h32(this.seed, S.judge, k, day) % 10), () => { h.grain = Math.max(0, h.grain - g * 0.5); v.grain += g * 0.5; this.judge(h, day, acc, 'theft'); }); }
  }
}
