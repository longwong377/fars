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
import type { Population, Seg, Where } from '../population';
import type { ActivityId } from '../activities';
import type { Intent, NeedKind } from '../economy/api';
import type { Economy } from '../economy/world';
import { splice } from '../talk';
import { checkPlan } from '../planCheck';

const S = salt('living-talk');
/** households in want who look for help each day (seeded share of the town's and the plain's), and the most talks a day */
const ASK_SHARE = 0.03, MAX_MEETS = 60, CANDIDATES = 3;
const FREE = new Set<ActivityId>(['rest', 'eat', 'talk', 'play', 'gamble', 'tend_body', 'queue', 'exchange', 'spin']);
const MEET_ACTS = new Set<ActivityId>(['rest', 'eat', 'talk', 'queue', 'exchange', 'draw_water', 'wash', 'gamble', 'spin', 'field_work', 'garden_work', 'reap', 'thresh', 'tend_animals', 'herd', 'craft', 'weave', 'grind', 'bake', 'play']);
const GRAIN_EAT = 0.55; // kg a day per eater: the economy's ration unit (economy/world.ts), for sizing what is given

export interface LivingTalk {
  id: number; day: number; h: number; place: string; a: number; b: number;
  /** the intents entered into the economy (the asker's side first) */
  intents: Intent[]; kind: Intent['kind']; doer: number; target: string;
  news?: { src: string; hand: number };
  done?: { day: number; h0: number; h1: number }; why?: string;
}
type PlayerEv = { i: number; pid: number; day: number; ok: boolean; kind: string; newsFrom?: number };

export class LivingWorld {
  readonly talks: LivingTalk[] = [];
  private laid = new Map<string, { h0: number; h1: number; segs: Seg[] }[]>();
  private overlaid = new Map<string, Seg[]>();
  private news = new Map<number, { src: string; hand: number; day: number }[]>();
  private busy = new Set<string>();
  private byQ = new Map<string, number[]>();
  private upTo = -1; private running = false;
  /** plans asked for and talk simulated (for the dev overlay and the cost report) */
  stats = { plans: 0, days: 0, asks: 0, offers: 0, meetings: 0, noNeed: 0 };
  constructor(readonly pop: Population, readonly seed: number, private econ: () => Economy, private playerEvents: () => PlayerEv[] = () => []) {
    for (const H of pop.households) if (H.zone === 'town' || H.zone === 'plain') (this.byQ.get(H.q) ?? this.byQ.set(H.q, []).get(H.q)!).push(H.id);
  }
  get day() { return this.upTo; }

  // ---------------------------------------------------------------- the plan hook (talk.ts TalkWorld asks)
  touches(pid: number, day: number) { this.advance(day); return this.laid.has(`${pid}:${day}`); }
  overlay(pid: number, day: number, base: Seg[]): Seg[] {
    const k = `${pid}:${day}`; const c = this.overlaid.get(k); if (c) return c;
    let segs = base; for (const L of this.laid.get(k) ?? []) segs = splice(segs, L.h0, L.h1, L.segs);
    this.overlaid.set(k, segs); return segs;
  }
  /** after a load: everything is re-derived from day 0 (the sim gives a fresh economy) */
  reset() { this.talks.length = 0; this.laid.clear(); this.overlaid.clear(); this.news.clear(); this.busy.clear(); this.upTo = -1; }

  // ---------------------------------------------------------------- the days
  /** run the economy and the talk up to `day` (inclusive); arrangements reach 3 days past it and are laid already */
  advance(day: number) {
    if (this.running || day <= this.upTo) return; this.running = true;
    try {
      const E = this.econ();
      // player events first seen now: their news starts on the first day not yet simulated (fixed, and saved with the event)
      for (const e of this.playerEvents()) if (e.newsFrom === undefined) e.newsFrom = Math.max(e.day + 1, this.upTo + 1);
      while (this.upTo < day) { const d = ++this.upTo; E.step(d); this.simulate(E, d); this.stats.days++; }
    } finally { this.running = false; }
  }

  private plan(pid: number, day: number) { this.stats.plans++; return this.pop.basePlan(pid, day); }
  private eligible(i: number, day: number) { const P = this.pop, p = P.persons[i]; if (!p || !P.present(i, day) || P.ageOn(i, day) < 14 || p.sub.startsWith('court') || P.sick(i, day)) return false; const z = P.households[P.home(i, day)]?.zone; return z === 'town' || z === 'plain'; }
  private adultOf(h: number, day: number, k: number): number { const ms = this.pop.membersOn(h, day).filter(m => this.eligible(m, day)); return ms.length ? ms[h32(this.seed, S, h, day, k) % ms.length] : -1; }
  /** where two people's base plans put them together that day: the place and the hour (null: they do not meet) */
  private meet(a: number, b: number, day: number): { place: string; h: number } | null {
    const pa = this.plan(a, day), pb = this.plan(b, day);
    for (const s of pa) {
      if (s.where === 'road' || s.where === 'away' || s.place.startsWith('@') || !MEET_ACTS.has(s.act)) continue;
      for (const t of pb) if (t.place === s.place && MEET_ACTS.has(t.act)) { const lo = Math.max(s.t0, t.t0), hi = Math.min(s.t1, t.t1); if (hi - lo >= 0.25) return { place: s.place, h: lo }; }
    }
    return null;
  }

  private simulate(E: Economy, day: number) {
    const P = this.pop;
    for (const [pid, l] of this.news) { const k = l.filter(x => day - x.day <= 3); if (k.length) this.news.set(pid, k); else this.news.delete(pid); }
    for (const e of this.playerEvents()) if (e.ok && e.kind !== 'hold' && e.newsFrom === day && this.eligible(e.pid, day)) this.carry(e.pid, { src: `player:${e.i}`, hand: 0, day });
    // news: each carrier looks for kin or a friend among the day's company
    for (const [pid, l] of [...this.news]) {
      const x = l.find(y => y.hand < 3 && y.day < day + 1); if (!x) continue;
      const p = P.persons[pid], H = P.households[P.home(pid, day)];
      const cands = [...p.ties, ...H.kin.map(h => this.adultOf(h, day, 1))].filter(q => q >= 0 && q !== pid && this.eligible(q, day) && !(this.news.get(q) ?? []).some(y => y.src === x.src));
      for (let k = 0; k < Math.min(CANDIDATES, cands.length); k++) {
        const q = cands[(h32(this.seed, S, pid, day, k) + k) % cands.length]; const m = this.meet(pid, q, day); if (!m) continue;
        const i: Intent = { kind: 'news', from: `h:${P.home(pid, day)}`, to: `h:${P.home(q, day)}`, day, payload: { src: 'talk', of: x.src } };
        E.enter(i); this.carry(q, { src: x.src, hand: x.hand + 1, day });
        this.talks.push({ id: this.talks.length, day, h: m.h, place: m.place, a: pid, b: q, intents: [i], kind: 'news', doer: q, target: `h:${P.home(q, day)}`, news: { src: x.src, hand: x.hand + 1 } });
        break;
      }
    }
    // wants: a seeded few households in want look for a giver they meet
    let asks = 0;
    for (const [q, hs] of this.byQ) for (const h of hs) {
      if (asks >= MAX_MEETS) return;
      if (u01(this.seed, S, h, day, 3) >= ASK_SHARE * 1) continue;
      const needs = E.needsOf(`h:${h}`).filter(n => n.urgency >= 0.15 && n.kind !== 'water').sort((a, b) => b.urgency - a.urgency); if (!needs.length) continue;
      const asker = this.adultOf(h, day, 0); if (asker < 0) continue; for (const n of needs) (this.stats as any)[`need_${n.kind}`] = ((this.stats as any)[`need_${n.kind}`] ?? 0) + 1;
      this.stats.asks++;
      const H = P.households[h]; const kinP = H.kin.filter(k => P.households[k] && (P.households[k].zone === 'town' || P.households[k].zone === 'plain')); const pool = [...kinP, ...hs.filter(x => x !== h)];
      for (let k = 0; k < CANDIDATES && pool.length; k++) {
        const g = pool[k < kinP.length ? k : h32(this.seed, S, h, day, 10 + k) % pool.length];
        const offer = needs.map(n => this.offer(E, n.kind, h, g, day)).find(x => x) ?? null; if (!offer) continue; this.stats.offers++;
        const giver = this.adultOf(g, day, 0); if (giver < 0) continue;
        asks++; const m = this.meet(asker, giver, day); if (!m) continue; this.stats.meetings++;
        const T: LivingTalk = { id: this.talks.length, day, h: m.h, place: m.place, a: asker, b: giver, intents: offer.intents, kind: offer.kind,
          doer: offer.kind === 'visit' || offer.kind === 'work' ? asker : giver, target: offer.kind === 'visit' || offer.kind === 'work' ? `h:${g}` : `h:${h}` };
        this.talks.push(T); this.arrange(E, T); break;
      }
      void q;
    }
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
  private arrange(E: Economy, T: LivingTalk) {
    const P = this.pop;
    for (let d = T.day + 1; d <= T.day + 3; d++) {
      if (!this.eligible(T.doer, d) || P.mourning(T.doer, d)) continue;
      const base = this.plan(T.doer, d); const tgtWhere = this.whereOf(T.target); let before: Set<string> | null = null;
      for (const s of base) {
        if (!FREE.has(s.act) || s.where === 'road' || s.where === 'away' || s.place.startsWith('@') || s.t0 < 7 || s.t1 > 20.5) continue;
        if (this.busy.has(`${T.doer}:${d}:${s.t0}`)) continue;
        const w = s.place === T.target ? 0 : P.walkH(s.place, T.target, d, s.where, tgtWhere); const dur = STAY[T.kind];
        if (s.t1 - s.t0 < 2 * w + dur) continue;
        const h0 = s.t0, h1 = h0 + 2 * w + dur; const good = String(T.intents[0].payload.grain !== undefined ? 'grain' : T.intents[0].payload.fuel !== undefined ? 'fuel' : T.intents[0].payload.cash !== undefined ? 'cash' : 'none');
        const why = WHY[T.kind](good); const segs: Seg[] = [];
        if (w > 0.01) segs.push(sg(h0, h0 + w, `road:${tgtWhere}`, 'walk', `${why}: on the way`, 'road'));
        segs.push({ ...sg(h0 + w, h0 + w + dur, T.target, ACT[T.kind], why, tgtWhere), ev: `living:${T.id}` });
        if (w > 0.01) segs.push(sg(h0 + w + dur, h1, `road:${s.where}`, 'walk', 'walking back', 'road'));
        for (const x of segs) if (s.wear) x.wear = s.wear;
        before ??= new Set(checkPlan(P, T.doer, d, base, null).map(x => x.kind));
        if (checkPlan(P, T.doer, d, splice(base, h0, h1, segs), null).some(x => !before!.has(x.kind))) continue;
        const k = `${T.doer}:${d}`; (this.laid.get(k) ?? this.laid.set(k, []).get(k)!).push({ h0, h1, segs }); this.overlaid.delete(k); this.busy.add(`${T.doer}:${d}:${s.t0}`);
        T.done = { day: d, h0, h1 }; for (const i of T.intents) { i.day = d; E.enter(i); } return;
      }
    }
    T.why = 'no free stretch in the doer’s next three days';
  }
  private carry(pid: number, x: { src: string; hand: number; day: number }) { const l = this.news.get(pid) ?? this.news.set(pid, []).get(pid)!; if (!l.some(y => y.src === x.src)) l.push(x); }
  private whereOf(place: string): Where { if (place.startsWith('h:')) { const H = this.pop.households[+place.slice(2)]; return H?.zone === 'plain' ? 'plain' : 'town'; } return 'town'; }

  // ---------------------------------------------------------------- the measure (T-E13)
  /** over talks made in days [d0, d1]: the share with a consequence in the sim within 3 days — an errand in the doer's
   *  executed plan (Population.plan) AND the economy's state changed by it that day (its event for the receiving house), or
   *  news passed on within 3 days — and the share of player events whose news reached another person within 3 days */
  report(d0: number, d1: number) {
    this.advance(d1 + 3); const E = this.econ();
    const evKey = new Set(E.events.map(e => `${e.day}|${e.actor}|${e.other ?? ''}`));
    const ts = this.talks.filter(t => t.day >= d0 && t.day <= d1); let withC = 0; const byKind: Record<string, [number, number]> = {}; const why: Record<string, number> = {};
    for (const t of ts) {
      let ok = false, w = t.why ?? '';
      if (t.news) { ok = t.news.hand < 3 && this.talks.some(u => u.news?.src === t.news!.src && u.a === t.b && u.day <= t.day + 3 && u.id > t.id); if (!ok) w = t.news.hand >= 3 ? 'news at its last hand' : 'news not passed on'; }
      else if (t.done) {
        const inPlan = this.pop.plan(t.doer, t.done.day).some(s => s.ev === `living:${t.id}`);
        const inEcon = t.intents.every(i => evKey.has(`${t.done!.day}|${i.to}|${i.from}`));
        ok = inPlan && inEcon; if (!ok) w = !inPlan ? 'laid but not in the executed plan' : 'no economy event';
      }
      if (ok) { withC++; w = 'carried out'; } why[w] = (why[w] ?? 0) + 1;
      const k = byKind[t.kind] ?? (byKind[t.kind] = [0, 0]); k[1]++; if (ok) k[0]++;
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
