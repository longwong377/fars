// D-339, D-341 (UD-24, UD-21; T-E13): talk that changes the world, on the real economy (src/people/economy, D-338).
//
// Day by day from day 0, in lockstep with the economy (this module steps it: Simulation.economy() asks it to): after the
// economy's day, a seeded few of the town's and the plain's households in want (Economy.needsOf) look for someone who has
// what they lack: kin first, then neighbours of the quarter, the giver judged by the economy's own stores. The two talk only
// if their day plans put them at the same place at the same time (co-location read from the BASE plans, Population.basePlan,
// so there is no loop). What they agree is a structured Intent: grain traded for silver, silver lent, grain or fuel given to
// a sick or mourning house, a day's work paid in grain, a visit of kin. It is LAID INTO THE DOER'S PLAN on a free stretch of
// one of the next three days (the walk to the other house, the errand, the walk back; the day must stay well formed:
// planCheck), and ENTERED INTO THE ECONOMY for that day: both sides' stores change (the giver's go down), so the economy's
// own choices and chains downstream run on the changed state. Player deeds (TalkWorld events) become news: the one who did
// the deed tells kin and friends they meet, up to three hands on, and each passing is an economy event.
//
// Pure: the talk of day d depends only on the seed, the days before it and the player's events (each carries the day its
// news starts, fixed when the living world first sees it and saved with it), never on which day was asked first or on the
// sim's present. The economy's saved intents from talk are dropped on load and re-derived (payload.src = 'talk').
// Tier C throughout (DECISIONS D-339, D-341).
import { h32, u01, salt } from '../hash';
import { coldWear, dustWear, type Population, type Seg, type Where } from '../population';
import type { ActivityId } from '../activities';
import type { Intent, NeedKind } from '../economy/api';
import type { Economy } from '../economy/world';
import { splice } from '../talk';
import { MINDING, reasonOk } from '../planCheck';
import { dateOf } from '../calendar';
import { nobodyWith } from '../wardrobe/washing';
import { haggleRound } from '../speech/haggle';
import type { Relations } from '../relations/world';

const S = salt('living-talk');
/** households in want who look for help each day (seeded share of the town's and the plain's), and the most talks a day */
const ASK_SHARE = 0.06, MAX_MEETS = 450, CANDIDATES = 3;
/** market news (the economy's own market events) and the households that hear it first each day */
const MARKET_NEWS = new Set(['grain_dear', 'trade_slump', 'grain_brought', 'ration_cut']); const MARKET_CARRIERS = 6;
const GUARD_ON = new Set(['theft', 'robbed']);
const NO_STORES = new Set(['tool', 'childcare', 'labour', 'guard']);
/** economy events that are talked of, and those at which kin and neighbours help (C) */
const NEWSWORTHY = new Set(['death', 'illness', 'theft', 'robbed', 'default', 'suit', 'pledge_seized', 'debt_labour', 'loan', 'hunger', 'tax_arrears', 'cold_hearth', 'harvest_poor', 'repaid', 'acquitted', 'mourning']);
const HELP_ON = new Set(['death', 'illness', 'hunger', 'cold_hearth', 'robbed', 'harvest_poor']);
const TOOLS = ['sickle', 'mattock', 'hoe', 'axe', 'ladder', 'sieve'];
/** days of talk state kept in the save (errands reach 3 days ahead; news goes stale in 3; the rest is for the dev overlay) */
const KEEP = 7;
export interface LivingSave { upTo: number; evSeen: number; nextId: number; talks: LivingTalk[]; laid: [string, { h0: number; h1: number; segs: Seg[] }[] | unknown[]][]; strs?: string[]; news: [number, News[]][]; busy: string[] }
const crewKey = (p: { job: string; sub: string }, q: string) => `${p.job}|${p.sub}|${q}`;
type News = { src: string; hand: number; day: number; about?: number; what?: string };
const FREE = new Set<ActivityId>(['rest', 'talk', 'play', 'gamble', 'tend_body', 'queue', 'exchange', 'spin']);
/** an errand may take this stretch of the day: free, in full daylight in every season, not minding a little one, not a meal (D-344) */
const DAY_START = 8, DAY_END = 17.5;
function slotOk(s: Seg) { return FREE.has(s.act) && s.where !== 'road' && s.where !== 'away' && !s.place.startsWith('@') && s.t0 >= DAY_START && s.t1 <= 20.5 && s.with === undefined && !MINDING.test(s.why); }
const MEET_ACTS = new Set<ActivityId>(['rest', 'eat', 'talk', 'queue', 'exchange', 'draw_water', 'wash', 'gamble', 'spin', 'field_work', 'garden_work', 'reap', 'thresh', 'tend_animals', 'herd', 'craft', 'weave', 'grind', 'bake', 'play']);
const GRAIN_EAT = 0.55; // kg a day per eater: the economy's ration unit (economy/world.ts), for sizing what is given

export interface LivingTalk {
  id: number; day: number; h: number; place: string; a: number; b: number;
  /** the intents entered into the economy (the asker's side first) */
  intents: Intent[]; kind: Intent['kind']; doer: number; target: string;
  news?: { src: string; hand: number };
  /** an ask that is not of stores: a day's labour, a tool lent */
  label?: string;
  done?: { day: number; h0: number; h1: number }; why?: string;
}
type PlayerEv = { i: number; pid: number; day: number; ok: boolean; kind: string; newsFrom?: number };

export class LivingWorld {
  readonly talks: LivingTalk[] = [];
  private laid = new Map<string, { h0: number; h1: number; segs: Seg[] }[]>();
  private overlaid = new Map<string, Seg[]>();
  private news = new Map<number, News[]>(); private evSeen = 0; private nextId = 0; private atWork = new Map<string, number[]>(); private workDay = -1; private crews = new Map<string, number[]>(); private srcOf = new Map<number, string>(); private gangs = new Map<number, number[]>();
  private busy = new Set<string>();
  /** D-352: called after each simulated day (the asks and the rumours of src/people/asks ride on it) */
  onDay?: (d: number) => void;
  // ---------------------------------------------------------------- D-359 (B227, B226): the relations stepped with the days
  private rel: Relations | null = null; private relAt = new Map<number, Intent[]>(); private relFloor = -1;
  /** relation intents entered into the economy (bride-gifts, dowries, divorce silver, news) */
  relEntered = 0;
  /** step the relations layer from here, a week ahead of the economy's day (so its weddings move the bride before any plan of
   *  the wedding's week is drawn: Population.addWedding), its intents entered into the economy on their own day, before the
   *  economy's step (the sim sets it with SimOpts.bonds, the world's setting; tests without it are unchanged) */
  attachRelations(rel: Relations) { this.rel = rel; rel.opts.joinPop = true;
    // (each intent kept by the day it enters: its own, or the first day not yet stepped when it came late, from a player's act;
    // one dated before a load's day is in the saved economy already; kept, so a re-derivation from day 0 enters them again)
    rel.opts.econ = i => { if (i.day <= this.relFloor) return; const at = Math.max(i.day, this.upTo + (this.running ? 0 : 1)); (this.relAt.get(at) ?? this.relAt.set(at, []).get(at)!).push(i); }; }
  private relDay(E: Economy, d: number) {
    const R = this.rel; if (!R) return; R.advance(d + 7);
    for (const i of this.relAt.get(d) ?? []) { E.enter({ ...i, day: d, payload: { ...i.payload } }); this.relEntered++; }
  }
  /** D-375: does the giver's house shun the asker's over what it has heard (set by PeopleSim from the rumours; `into`: the help
   *  would go into the asker's house) */
  shuns: ((giver: string, asker: string, into: boolean) => boolean) | null = null;
  private byQ = new Map<string, number[]>();
  private upTo = -1; private running = false;
  /** plans asked for and talk simulated (for the dev overlay and the cost report) */
  stats = { plans: 0, days: 0, asks: 0, offers: 0, meetings: 0, msMeet: 0, msArrange: 0, msEcon: 0, msCheck: 0, msBase: 0, msSim: 0 };
  constructor(readonly pop: Population, readonly seed: number, private econ: () => Economy, private playerEvents: () => PlayerEv[] = () => []) {
    for (const p of pop.persons) { const H = pop.households[p.hh]; if (H && (H.zone === 'town' || H.zone === 'plain') && p.age >= 14 && p.job !== 'child') { const k = crewKey(p, H.q); (this.crews.get(k) ?? this.crews.set(k, []).get(k)!).push(p.id); } }
    for (const p of pop.persons) if (p.gang >= 0) (this.gangs.get(p.gang) ?? this.gangs.set(p.gang, []).get(p.gang)!).push(p.id);
    for (const H of pop.households) if (H.zone === 'town' || H.zone === 'plain') (this.byQ.get(H.q) ?? this.byQ.set(H.q, []).get(H.q)!).push(H.id);
  }
  get day() { return this.upTo; }

  // ---------------------------------------------------------------- the plan hook (talk.ts TalkWorld asks)
  touches(pid: number, day: number) { this.advance(day); return this.laid.has(`${pid}:${day}`); }
  /** the hours of a person's day taken by errands laid for them (D-347: the laundry and the bath keep clear of them) */
  windows(pid: number, day: number): [number, number][] { this.advance(day); return (this.laid.get(`${pid}:${day}`) ?? []).map(L => [L.h0, L.h1]); }
  overlay(pid: number, day: number, base: Seg[]): Seg[] {
    const k = `${pid}:${day}`; const c = this.overlaid.get(k); if (c) return c;
    // laid only where the base day is free over the whole window (the raw day found the slot; relabel and care may differ)
    let segs = base; for (const L of this.laid.get(k) ?? []) {
      const over = base.filter(s => s.t1 > L.h0 + 1e-9 && s.t0 < L.h1 - 1e-9); if (!over.length || !over.every(slotOk) || !nobodyWith(this.pop, pid, day, L.h0, L.h1)) continue; // (D-347: nor while a little one is with the doer)
      // (D-347: the errand dressed against the cold and the dust by its own hours, as the day's stretches are; was: the base
      // stretch's dress copied, so a walk back into the dust went unwrapped)
      const mid = L.segs.map(x => ({ ...x })), wx = this.pop.cal.ctx(day).wx; dustWear(mid, wx); coldWear(mid, wx); segs = splice(segs, L.h0, L.h1, mid);
    }
    this.overlaid.set(k, segs); return segs;
  }
  /** after a load: everything is re-derived from day 0 (the sim gives a fresh economy) */
  /** the talk state for the save (D-344): what the days to come still need — the last KEEP days' talks, errands and news,
   *  the counters — so a load resumes at once instead of re-deriving from day 0; the economy replays its own intents (talk's too) */
  save(from = this.upTo - KEEP): LivingSave {
    // D-347: from the sim's present day (the sim passes it; errands of days before it are never laid again), the errands'
    // stretches with their places and words as indices into one table of strings (they repeat)
    const lo = Math.max(from, this.upTo - KEEP), strs: string[] = [], si = new Map<string, number>(), s = (x: string) => { let i = si.get(x); if (i === undefined) { i = strs.length; strs.push(x); si.set(x, i); } return i; };
    const laid = [...this.laid].filter(([k]) => +k.split(':')[1] >= lo).map(([k, v]) => [k, v.map(L => [L.h0, L.h1, L.segs.map(g => [g.t0, g.t1, s(g.place), s(g.act), s(g.why), s(g.where), ...(g.ev ? [s(g.ev)] : [])])])]) as any;
    return { upTo: this.upTo, evSeen: this.evSeen, nextId: this.nextId, talks: this.talks.filter(x => x.day >= lo - 1 || (x.done?.day ?? -1) >= lo),
      laid, strs, news: [...this.news], busy: [...this.busy].filter(k => +k.split(':')[1] >= lo) } as LivingSave;
  }
  /** resume from a save: the economy (restored, or built from its saved intents and stepped) at the saved day, the talk state restored */
  load(s: LivingSave) {
    this.reset(); const E = this.econ(); this.running = true; try { for (let d = E.day + 1; d <= s.upTo; d++) E.step(d); } finally { this.running = false; }
    this.upTo = s.upTo; this.relFloor = s.upTo; for (const k of [...this.relAt.keys()]) if (k <= s.upTo) this.relAt.delete(k); this.evSeen = s.evSeen; this.nextId = s.nextId; this.talks.push(...s.talks);
    const T = s.strs; for (const [k, v] of s.laid) this.laid.set(k, T ? (v as any[]).map(([h0, h1, g]) => ({ h0, h1, segs: g.map((x: any[]) => ({ t0: x[0], t1: x[1], place: T[x[2]], act: T[x[3]], why: T[x[4]], where: T[x[5]], ...(x.length > 6 ? { ev: T[x[6]] } : {}) })) })) : v as any);
    for (const [k, v] of s.news) this.news.set(k, v); for (const k of s.busy) this.busy.add(k);
  }
  reset() { this.talks.length = 0; this.laid.clear(); this.overlaid.clear(); this.news.clear(); this.busy.clear(); this.nextId = 0; this.upTo = -1; this.evSeen = 0; }

  // ---------------------------------------------------------------- the days
  /** run the economy and the talk up to `day` (inclusive); arrangements reach 3 days past it and are laid already */
  advance(day: number) {
    if (this.running || day <= this.upTo) return; this.running = true;
    try {
      const E = this.econ();
      // player events first seen now: their news starts on the first day not yet simulated (fixed, and saved with the event)
      for (const e of this.playerEvents()) if (e.newsFrom === undefined) e.newsFrom = Math.max(e.day + 1, this.upTo + 1);
      while (this.upTo < day) { const d = ++this.upTo; const t0 = performance.now(); this.relDay(E, d); E.step(d); this.stats.msEcon += performance.now() - t0; const t1 = performance.now(); this.simulate(E, d); this.stats.msSim += performance.now() - t1; this.stats.days++; this.onDay?.(d); }
    } finally { this.running = false; }
  }

  private plan(pid: number, day: number) { this.stats.plans++; return this.pop.basePlan(pid, day); }
  private eligible(i: number, day: number) { const P = this.pop, p = P.persons[i]; if (!p || !P.present(i, day) || P.ageOn(i, day) < 14 || p.sub.startsWith('court') || P.sick(i, day)) return false; const z = P.households[P.home(i, day)]?.zone; return z === 'town' || z === 'plain'; }
  private adultOf(h: number, day: number, k: number): number { const ms = this.pop.membersOn(h, day).filter(m => this.eligible(m, day)); return ms.length ? ms[h32(this.seed, S, h, day, k) % ms.length] : -1; }
  /** where two people's base plans put them together that day: the place and the hour (null: they do not meet) */
  private meet(a: number, b: number, day: number) { const t = performance.now(); try { const r = this.meet0(a, b, day); const s = this.srcOf.get(b) ?? '?'; const st = this.stats as any; st['try_' + s] = (st['try_' + s] ?? 0) + 1; if (r) st['ok_' + s] = (st['ok_' + s] ?? 0) + 1; return r; } finally { this.stats.msMeet += performance.now() - t; } }
  private meet0(a: number, b: number, day: number): { place: string; h: number } | null {
    const pa = this.pop.rawPlan(a, day), pb = this.pop.rawPlan(b, day); this.stats.plans += 2; // the planner's own days (cheaper than the relabelled base; the places are the same)
    for (const s of pa) {
      if (s.where === 'road' || s.where === 'away' || s.place.startsWith('@') || !MEET_ACTS.has(s.act)) continue;
      for (const t of pb) if (t.place === s.place && MEET_ACTS.has(t.act)) { const lo = Math.max(s.t0, t.t0), hi = Math.min(s.t1, t.t1); if (hi - lo >= 0.25) return { place: s.place, h: lo }; }
    }
    return null;
  }

  /** the people this person may run into on a day: kin, neighbours of the quarter, workmates (same gang or work group) */
  private company(pid: number, day: number): number[] {
    const P = this.pop, p = P.persons[pid], h = P.home(pid, day), H = P.households[h]; const out: number[] = [];
    // workmates: the same work in the same quarter or village (the village's field hands, a quarter's potters, the canal crew
    // of the plain); whether they are together today is the meeting check on both raw days (D-344)
    const mates = this.crews.get(crewKey(p, H.q)) ?? [];
    for (let k = 0; k < 3 && mates.length > 1; k++) { const m = mates[h32(this.seed, S, pid, day, 30 + k) % mates.length]; if (m !== pid && this.eligible(m, day)) { out.push(m); this.srcOf.set(m, 'mate'); } }
    for (const k of H.kin) { const a = this.adultOf(k, day, 1); if (a >= 0) { out.push(a); this.srcOf.set(a, 'kin'); } }
    const hs = this.byQ.get(H.q) ?? []; for (let k = 0; k < 3 && hs.length > 1; k++) { const n = hs[h32(this.seed, S, pid, day, 20 + k) % hs.length]; if (n !== h) { const a = this.adultOf(n, day, k); if (a >= 0) { out.push(a); this.srcOf.set(a, 'nbr'); } } }
    for (const t of p.ties) if (this.eligible(t, day)) { out.push(t); this.srcOf.set(t, 'tie'); }
    return [...new Set(out)].filter(q => q !== pid && P.home(q, day) !== h);
  }

  /** the work place of a person's raw day (the longest stretch of work away from home), indexed for the day's workmates */
  private workPlace(pid: number, day: number): string | null {
    if (this.workDay !== day) { this.atWork.clear(); this.workDay = day; }
    let best: Seg | null = null; for (const s of this.pop.rawPlan(pid, day)) if (!FREE.has(s.act) && s.act !== 'sleep' && s.act !== 'eat' && s.act !== 'walk' && s.where !== 'road' && s.where !== 'away' && !s.place.startsWith('h:') && !s.place.startsWith('@') && (!best || s.t1 - s.t0 > best.t1 - best.t0)) best = s;
    if (!best) return null; const l = this.atWork.get(best.place) ?? this.atWork.set(best.place, []).get(best.place)!; if (!l.includes(pid)) l.push(pid); return best.place;
  }

  private simulate(E: Economy, day: number) {
    const P = this.pop; let meets = 0;
    if (E.trust) haggleRound(E, day); // D-351: the day's haggles between households (speech/haggle.ts), before the talk
    for (const [pid, l] of this.news) { const k = l.filter(x => day - x.day <= 3); if (k.length) this.news.set(pid, k); else this.news.delete(pid); }
    for (const e of this.playerEvents()) if (e.ok && e.kind !== 'hold' && e.newsFrom === day && this.eligible(e.pid, day)) this.carry(e.pid, { src: `player:${e.i}`, hand: 0, day });
    // what happened yesterday in the economy is news in the lanes: a death, an illness, a theft, a debt, a suit, hunger
    for (; this.evSeen < E.events.length; this.evSeen++) {
      const v = E.events[this.evSeen]; if (!v?.actor || v.day < day - 1) continue; // (a loaded economy keeps only the recent days whole, D-347)
      if (MARKET_NEWS.has(v.kind)) { const all = [...this.byQ.values()]; for (let k = 0; k < MARKET_CARRIERS; k++) { const hs = all[h32(this.seed, S, v.id, k) % all.length]; const c = this.adultOf(hs[h32(this.seed, S, v.id, k, 1) % hs.length], day, 3); if (c >= 0) this.carry(c, { src: `econ:${v.id}`, hand: 0, day, what: v.kind }); } continue; }
      if (!NEWSWORTHY.has(v.kind) || !v.actor.startsWith('h:')) continue;
      const h = +v.actor.slice(2); const H = P.households[h]; if (!H || (H.zone !== 'town' && H.zone !== 'plain')) continue;
      const c = this.adultOf(h, day, 2); if (c >= 0) this.carry(c, { src: `econ:${v.id}`, hand: 0, day, about: h, what: v.kind });
    }
    // every carrier of fresh news tells someone they meet today
    const hot = (l: News[]) => l.some(y => y.src.startsWith('player:') && y.hand < 3); // a stranger's doings are told first and harder
    for (const [pid, l] of [...this.news].sort((a, b) => +hot(b[1]) - +hot(a[1]))) {
      if (meets >= MAX_MEETS) break;
      const x = l.find(y => y.hand < (y.src.startsWith('player:') ? 3 : 2)); if (!x || !this.eligible(pid, day)) continue;
      const cands = this.company(pid, day).filter(q => !(this.news.get(q) ?? []).some(y => y.src === x.src));
      for (let k = 0; k < Math.min(x.src.startsWith('player:') ? 6 : 2, cands.length) && meets < MAX_MEETS; k++) {
        const q = cands[k]; meets++; const m = this.meet(pid, q, day); if (!m) continue; this.stats.meetings++;
        this.tell(E, pid, q, x, m, day); this.ask(E, pid, q, m, day); break;
      }
    }
    // wants: a seeded share of the town's and the plain's households look for help from the people they meet
    for (const hs of this.byQ.values()) for (const h of hs) {
      if (meets >= MAX_MEETS) return;
      if (u01(this.seed, S, h, day, 3) >= ASK_SHARE) continue;
      const asker = this.adultOf(h, day, 0); if (asker < 0) continue; this.stats.asks++;
      const cands = this.company(asker, day);
      for (let k = 0; k < Math.min(CANDIDATES, cands.length) && meets < MAX_MEETS; k++) {
        meets++; const m = this.meet(asker, cands[k], day); if (!m) continue; this.stats.meetings++;
        const fresh = (this.news.get(asker) ?? []).find(y => y.hand < 2 && !(this.news.get(cands[k]) ?? []).some(z => z.src === y.src));
        if (fresh) this.tell(E, asker, cands[k], fresh, m, day);
        this.ask(E, asker, cands[k], m, day) || this.ask(E, cands[k], asker, m, day); break;
      }
    }
  }

  /** news passed on: a talk event; if it is of want or loss at a house of the hearer's kin or quarter, the hearer's house
   *  helps (an errand laid and entered into the economy); otherwise its consequence is its passing on (report()) */
  private tell(E: Economy, from: number, to: number, x: News, m: { place: string; h: number }, day: number) {
    const P = this.pop; this.carry(to, { ...x, hand: x.hand + 1, day });
    const T: LivingTalk = { id: this.nextId++, day, h: m.h, place: m.place, a: from, b: to, intents: [], kind: 'news', doer: to, target: `h:${P.home(to, day)}`, news: { src: x.src, hand: x.hand + 1 } };
    const hh = P.home(to, day);
    if (E.trust && x.about !== undefined && x.what) E.trust.hear(`h:${hh}`, `h:${x.about}`, x.what, day); // D-351: news heard moves the hearer's own trust
    if (x.about !== undefined && x.about !== hh && HELP_ON.has(x.what ?? '') && (P.households[hh].kin.includes(x.about) || P.households[hh].q === P.households[x.about].q)) {
      const off = this.offer(E, x.what === 'cold_hearth' ? 'fuel' : x.what === 'death' ? 'kin' : 'help', x.about, hh, day);
      // (D-340: the help answers the economy event the news was of: its intents name it, so the help joins that chain)
      if (off && x.src.startsWith('econ:')) for (const i of off.intents) i.payload.causes = [+x.src.slice(5)];
      if (off && off.intents.every(i => i.kind !== 'visit' || x.what === 'death')) { T.intents = off.intents; T.kind = off.kind; T.target = `h:${x.about}`; T.news = { ...T.news!, acted: true } as any; this.talks.push(T); this.arrange(E, T); return; }
    }
    // a price heard: a house with grain beyond its year's bread sells some while grain is dear; a house in want buys when a
    // caravan has brought grain (the economy's stores and silver change; no errand is laid for the market, D-344)
    const H = E.hh.get(`h:${hh}`);
    if (H && (x.what === 'grain_dear' || x.what === 'grain_brought')) {
      const eat = H.eaters * GRAIN_EAT, price = E.price('grain', day);
      if (x.what === 'grain_dear' && H.grain > eat * 120) { const q = +(Math.min(H.grain - eat * 120, eat * 30)).toFixed(1); T.intents = [{ kind: 'trade', from: 'market', to: `h:${hh}`, day: day + 1, payload: { grain: -q, cash: +(q * price).toFixed(3), src: 'talk', of: x.src } }]; T.kind = 'trade'; T.label = 'sold on news'; }
      else if (x.what === 'grain_brought' && H.grain < eat * 20 && H.cash > eat * 10 * price) { const q = +(eat * 10).toFixed(1); T.intents = [{ kind: 'trade', from: 'market', to: `h:${hh}`, day: day + 1, payload: { grain: q, cash: -(q * price).toFixed(3), src: 'talk', of: x.src } }]; T.kind = 'trade'; T.label = 'bought on news'; }
      if (T.intents.length) { for (const i of T.intents) E.enter(i); T.done = { day: day + 1, h0: -1, h1: -1 }; this.talks.push(T); return; }
    }
    // a theft heard in the quarter: the house keeps watch over its store that evening (an errand at home, and an event)
    if (x.about !== undefined && x.about !== hh && GUARD_ON.has(x.what ?? '') && P.households[hh].q === P.households[x.about].q) {
      T.intents = [{ kind: 'visit', from: `h:${hh}`, to: `h:${hh}`, day, payload: { src: 'talk', why: 'guard', of: x.src } }]; T.kind = 'visit'; T.label = 'guard'; T.target = `h:${hh}`;
      this.talks.push(T); this.arrange(E, T); return;
    }
    // plain news enters nothing into the economy (it would only add an event); its consequence is its passing on (report())
    this.talks.push(T);
  }

  /** an ask between two who met: spare stores first, else a day's labour or the loan of a tool; true when something is agreed */
  private ask(E: Economy, asker: number, giver: number, m: { place: string; h: number }, day: number): boolean {
    const P = this.pop, h = P.home(asker, day), g = P.home(giver, day);
    const needs = E.needsOf(`h:${h}`).filter(n => n.urgency >= 0.15 && n.kind !== 'water').sort((a, b) => b.urgency - a.urgency);
    let offer = needs.map(n => this.offer(E, n.kind, h, g, day)).find(x => x) ?? null;
    let label = '';
    if (!offer) { // labour: a sick house, or a farming house at the harvest and the ploughing, asks for hands; else a tool (C)
      const sick = needs.some(n => n.kind === 'help'); const A = E.hh.get(`h:${h}`); const month = (dateOf(day) as any).month as number;
      if (sick || (A?.kind === 'farmer' && (month === 1 || month === 2 || month === 7 || month === 8) && u01(this.seed, S, h, day, 40) < 0.5)) { offer = { kind: 'work', intents: [{ kind: 'help', from: `h:${g}`, to: `h:${h}`, day, payload: { labour: 1, src: 'talk' } }] }; label = 'labour'; }
      else if (this.childcare(asker, giver, day)) { offer = { kind: 'help', intents: [{ kind: 'help', from: `h:${g}`, to: `h:${h}`, day, payload: { childcare: 1, src: 'talk' } }] }; label = 'childcare'; }
      else if (u01(this.seed, S, h, day, 41) < 0.35) { offer = { kind: 'loan', intents: [{ kind: 'help', from: `h:${g}`, to: `h:${h}`, day, payload: { tool: TOOLS[h32(this.seed, S, h, day) % TOOLS.length], src: 'talk' } }] }; label = 'tool'; }
    }
    if (!offer) return false;
    // D-375: what the giver's house has heard: it keeps away from a house it shuns over a rumour (a theft, a debt: 'avoid') or fears
    // for its sickness ('flee': no hands or childcare sent into it), so a rumour, true or not, leaves a house without help (C)
    if (this.shuns?.(`h:${g}`, `h:${h}`, offer.kind === 'work' || label === 'childcare')) { (this.stats as any).shunned = ((this.stats as any).shunned ?? 0) + 1; return false; }
    this.stats.offers++;
    const helpsAtHome = offer.kind === 'work' || label === 'tool';
    const T: LivingTalk = { id: this.nextId++, day, h: m.h, place: m.place, a: asker, b: giver, intents: offer.intents, kind: offer.kind, label: label || undefined,
      doer: offer.kind === 'visit' || (offer.kind === 'work' && !label) ? asker : giver, target: offer.kind === 'visit' || (offer.kind === 'work' && !label) ? `h:${g}` : `h:${h}` };
    void helpsAtHome;
    this.talks.push(T); this.arrange(E, T); return true;
  }

  /** a mother of a little one (under 5) with work away from the house tomorrow asks a neighbour woman to keep the child (C) */
  private childcare(mother: number, helper: number, day: number): boolean {
    const P = this.pop, m = P.persons[mother], w = P.persons[helper]; if (m.sex !== 'f' || w.sex !== 'f') return false;
    if (!P.childrenOf(mother).some(c => P.present(c, day) && P.ageOn(c, day) < 5)) return false;
    return u01(this.seed, S, mother, day, 42) < 0.5 && this.workPlace(mother, day + 1) !== null;
  }

  /** what the giver's house can spare for this want, as economy intents (asker's side, giver's side); null: nothing to spare */
  private offer(E: Economy, kind: NeedKind, h: number, g: number, day: number): { kind: Intent['kind']; intents: Intent[] } | null {
    const A = E.hh.get(`h:${h}`), G = E.hh.get(`h:${g}`); if (!A || !G) return null;
    const a = `h:${h}`, b = `h:${g}`, src = 'talk', price = E.price('grain', day);
    const gEat = G.eaters * GRAIN_EAT, aEat = A.eaters * GRAIN_EAT;
    if (kind === 'food') { // grain: sold if the asker has silver, else lent as a gift among kin and neighbours
      const spare = G.grain - gEat * 40; const q = Math.min(spare, aEat * 10); if (q < aEat * 2) return null;
      const pay = Math.min(A.cash * 0.8, q * price);
      return pay >= q * price * 0.5
        ? { kind: 'trade', intents: [{ kind: 'trade', from: b, to: a, day, payload: { grain: +q.toFixed(1), cash: -pay.toFixed(3), src } }, { kind: 'trade', from: a, to: b, day, payload: { grain: -q.toFixed(1), cash: +pay.toFixed(3), src } }] }
        : { kind: 'help', intents: [{ kind: 'help', from: b, to: a, day, payload: { grain: +q.toFixed(1), src } }, { kind: 'trade', from: a, to: b, day, payload: { grain: -q.toFixed(1), src } }] };
    }
    if (kind === 'fuel') { const q = Math.min(G.fuel - 12, 6); if (q < 2) return null; return { kind: 'help', intents: [{ kind: 'help', from: b, to: a, day, payload: { fuel: q, src } }, { kind: 'trade', from: a, to: b, day, payload: { fuel: -q, src } }] }; }
    if (kind === 'cash') { // silver lent, or a day's work paid in grain
      const c = Math.min(G.cash * 0.2, 2); if (c >= 0.3) return { kind: 'loan', intents: [{ kind: 'loan', from: b, to: a, day, payload: { cash: +c.toFixed(3), src } }, { kind: 'trade', from: a, to: b, day, payload: { cash: -c.toFixed(3), src } }] };
      const w = aEat * 3; if (G.grain - gEat * 40 < w) return null;
      return { kind: 'work', intents: [{ kind: 'work', from: b, to: a, day, payload: { grain: +w.toFixed(1), src } }, { kind: 'trade', from: a, to: b, day, payload: { grain: -w.toFixed(1), src } }] };
    }
    if (kind === 'help' || kind === 'health') { const q = Math.min(G.grain - gEat * 40, aEat * 5); if (q < aEat) return null; return { kind: 'help', intents: [{ kind: 'help', from: b, to: a, day, payload: { grain: +q.toFixed(1), src } }, { kind: 'trade', from: a, to: b, day, payload: { grain: -q.toFixed(1), src } }] }; }
    if (kind === 'kin') { // a house in mourning: grain for the funeral meal if the kin can spare it, else a visit of condolence
      const q = Math.min(G.grain - gEat * 40, aEat * 5); if (q >= aEat) return { kind: 'help', intents: [{ kind: 'help', from: b, to: a, day, payload: { grain: +q.toFixed(1), src } }, { kind: 'trade', from: a, to: b, day, payload: { grain: -q.toFixed(1), src } }] };
      return { kind: 'visit', intents: [{ kind: 'visit', from: a, to: b, day, payload: { src, why: kind } }] }; }
    return null;
  }

  /** lay the errand into the doer's plan on a free stretch of the next three days, and enter the intents for that day */
  private arrange(E: Economy, T: LivingTalk) { const t = performance.now(); try { this.arrange0(E, T); } finally { this.stats.msArrange += performance.now() - t; } }
  private arrange0(E: Economy, T: LivingTalk) {
    const P = this.pop;
    // (D-347: the one who agreed, or when a little one is with them all their free hours, another grown-up of the house takes
    // the errand; not a childcare or a watch, which are the person's own)
    const P0 = T.doer, house = T.label === 'childcare' || T.label === 'guard' ? [] : P.membersOn(P.home(P0, T.day), T.day).filter(x => x !== P0 && P.ageOn(x, T.day) >= 14);
    let held = false; // (another of the house is tried only when a little one with the doer was what stopped it)
    for (let d = T.day + 1; d <= T.day + 3; d++) for (const doer of [P0, ...house]) {
      if ((doer !== P0 && !held) || !this.eligible(doer, d) || P.mourning(doer, d)) continue;
      // the slot is found in the planner's raw day (cheap); overlay() lays it only where the base day agrees (D-344)
      const tb = performance.now(); const raw = P.rawPlan(doer, d); this.stats.msBase += performance.now() - tb; const tgtWhere = this.whereOf(T.target);
      for (const s of raw) {
        if (!slotOk(s) || this.busy.has(`${doer}:${d}:${s.t0}`)) continue;
        const w = s.place === T.target ? 0 : P.walkH(s.place, T.target, d, s.where, tgtWhere); const dur = STAY[T.kind];
        const m = w > 0.01 ? 0.05 : 0; if (s.t1 - s.t0 < 2 * w + dur + 2 * m) continue; // (D-347: a few minutes at the place before and after, so a walk does not arrive and go straight on)
        const h0 = s.t0 + m, h1 = h0 + 2 * w + dur; if (h1 > DAY_END) continue;
        if (!nobodyWith(P, doer, d, h0, h1, false, true, true)) { held = true; continue; } // (D-347: not while a little one of the house is with the doer)
        T.doer = doer;
        const good = String(T.intents[0].payload.grain !== undefined ? 'grain' : T.intents[0].payload.fuel !== undefined ? 'fuel' : T.intents[0].payload.cash !== undefined ? 'cash' : 'none');
        const why = T.label === 'tool' ? `taking the ${T.intents[0].payload.tool} lent to a neighbour` : T.label === 'childcare' ? 'keeping a neighbour’s little ones at their house while she works' : T.label === 'guard' ? 'staying by the house to watch the store, a theft heard of in the quarter' : WHY[T.kind](good); const segs: Seg[] = [];
        if (w > 0.01) segs.push(sg(h0, h0 + w, `road:${tgtWhere}`, 'walk', `${why}: on the way`, 'road'));
        segs.push({ ...sg(h0 + w, h0 + w + dur, T.target, T.label === 'childcare' ? 'rest' : ACT[T.kind], why, tgtWhere), ev: `living:${T.id}` });
        if (w > 0.01) segs.push(sg(h0 + w + dur, h1, `road:${s.where}`, 'walk', 'walking back', 'road'));
        if (!segs.every(x => x.where === 'road' || reasonOk(x.act, x.why))) { T.why = 'no fitting words for the errand'; return; }
        const k = `${T.doer}:${d}`; (this.laid.get(k) ?? this.laid.set(k, []).get(k)!).push({ h0, h1, segs }); this.overlaid.delete(k); this.busy.add(`${T.doer}:${d}:${s.t0}`);
        T.done = { day: d, h0, h1 }; if (T.label && NO_STORES.has(T.label)) T.intents = []; // a day's labour, a tool, a child kept, a watch kept: time, not stores (D-344)
        for (const i of T.intents) { i.day = d; E.enter(i); } return;
      }
    }
    T.why = 'no free stretch in the doer’s next three days';
  }

  private carry(pid: number, x: News) { const l = this.news.get(pid) ?? this.news.set(pid, []).get(pid)!; if (!l.some(y => y.src === x.src)) l.push(x); }
  private whereOf(place: string): Where { if (place.startsWith('h:')) { const H = this.pop.households[+place.slice(2)]; return H?.zone === 'plain' ? 'plain' : 'town'; } return 'town'; }

  // ---------------------------------------------------------------- the measure (T-E13)
  /** over talks made in days [d0, d1]: the share with a consequence in the sim within 3 days — an errand in the doer's
   *  executed plan (Population.plan) AND the economy's state changed by it that day (its event for the receiving house), or
   *  news passed on within 3 days — and the share of player events whose news reached another person within 3 days */
  report(d0: number, d1: number) {
    this.advance(d1 + 3); const E = this.econ();
    const evKey = new Set<string>(); E.events.forEach(e => evKey.add(`${e.day}|${e.actor}|${e.other ?? ''}`));
    const ts = this.talks.filter(t => t.day >= d0 && t.day <= d1); let withC = 0; const byKind: Record<string, [number, number]> = {}; const why: Record<string, number> = {};
    for (const t of ts) {
      let ok = false, w = t.why ?? '';
      if (t.news && !t.done) { ok = t.news.hand < 3 && this.talks.some(u => u.news?.src === t.news!.src && u.a === t.b && u.day <= t.day + 3 && u.id > t.id); if (!ok) w = t.news.hand >= (t.news.src.startsWith('player:') ? 3 : 2) ? 'news at its last hand' : 'news not passed on'; }
      else if (t.done) {
        const inPlan = t.done.h0 < 0 || this.pop.plan(t.doer, t.done.day).some(s => s.ev === `living:${t.id}`); // h0 < 0: a market sale or purchase, no errand laid
        const inEcon = t.intents.every(i => evKey.has(`${t.done!.day}|${i.to}|${i.from}`));
        ok = inPlan && inEcon; if (!ok) w = !inPlan ? 'laid but not in the executed plan' : 'no economy event';
      }
      if (ok) { withC++; w = 'carried out'; } why[w] = (why[w] ?? 0) + 1;
      const kk = t.news ? (t.done ? 'news→help' : 'news') : t.label ?? t.kind; const k = byKind[kk] ?? (byKind[kk] = [0, 0]); k[1]++; if (ok) k[0]++;
    }
    const pe = this.playerEvents().filter(e => e.ok && e.kind !== 'hold' && e.day >= d0 && e.day <= d1);
    const reached = pe.filter(e => this.talks.some(u => u.news?.src === `player:${e.i}` && u.day <= (e.newsFrom ?? e.day) + 3)).length;
    return { talks: ts.length, withConsequence: withC, share: ts.length ? withC / ts.length : 0, byKind, why, playerEvents: pe.length, playerPropagated: reached, playerShare: pe.length ? reached / pe.length : 0 };
  }
}

const STAY: Record<Intent['kind'], number> = { trade: 0.4, work: 2, help: 0.75, visit: 1, news: 0.25, loan: 0.3, petition: 0.5 };
const ACT: Record<Intent['kind'], ActivityId> = { trade: 'exchange', work: 'craft', help: 'exchange', visit: 'talk', news: 'talk', loan: 'exchange', petition: 'talk' };
const WHY: Record<Intent['kind'], (g: string) => string> = {
  trade: () => 'bringing the barley sold to a neighbour, for silver', work: () => 'a day’s hand at a neighbour’s work, for barley',
  help: g => g === 'fuel' ? 'bringing dung cakes and brushwood to a neighbour’s house in want' : 'bringing barley to a house in want, as promised',
  visit: () => 'visiting kin, as arranged', news: () => 'passing on the news', loan: () => 'bringing silver lent to a neighbour, to be repaid at the harvest', petition: () => 'asking a favour, as arranged',
};
function sg(t0: number, t1: number, place: string, act: ActivityId, why: string, where: Where): Seg { return { t0: Math.min(24, t0), t1: Math.min(24, t1), place, act, why, where }; }
