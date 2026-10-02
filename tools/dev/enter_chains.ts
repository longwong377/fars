// D-384 (T-F9): entering the economy's consequence chains BY SPEECH. The old measure (tests/emergence.test.ts `enterable`)
// gives one engine intent per chain (a gift of grain and silver, or a plea before the judge); this one gives the player's own
// verbs (src/people/speech/stranger.ts: Stranger.do), the things a stranger can say and do in the town, each judged by the
// simulation as in play (a headman may rule against, a house may not hire, a gift may exceed the purse). For each sampled
// chain the routes are chosen by a FIXED RULE from the chain (the kind of its leaf and of the step before it, and the kind of
// the house met there), never from the result; the chain counts as entered when its leaf (same actor, kind and other party)
// no longer happens within 10 days of its day, by any of its routes. Every route is scripted on future days, so it replays.
// The rule (C, reasoned: what a stranger who met the house at the step before the chain's end would most plausibly do):
//   - a theft's mechanical sequel (robbed, accusation, arrest): RELIEF for the thief's house from its quarter's headman,
//     before the theft (the hunger that made the thief is the step a stranger can reach; the sequel itself cannot be spoken to);
//   - a judgement (acquitted, fined, beaten, time_granted, debt_labour) or a suit: a PLEA for the accused or the debtor to the
//     quarter's headman on the day the matter reaches the judge (the headman speaks before the court: a lenient judgement);
//   - goods sold at the market from need (sell): the stranger BUYS a piece of the house's goods first, and RELIEF;
//   - debt (default, pledge_seized, repaid, loan, loan_refused, land_sold, bound_labour, released, tax_arrears, remitted,
//     suit's antecedents): WORK OFF, the stranger works three weeks in a treasury gang and gives the rations and the silver to
//     the house before its due, and RELIEF;
//   - care (nursed_by_kin, illness): a HAND, the stranger asks guest-right of the house and hires on as its hand while one
//     is sick, for board (asked on three days running, as anyone looking for work would);
//   - the harvest (tithe_short, or a chain through harvest_poor met at a farm or a great house): a HAND at the harvest;
//   - everything else that is want (buy, buy_fuel, kin_help, hired_by_neighbour, wage_work, petition, relief,
//     petition_refused, cold_hearth, hunger, death, neighbours_help, ...): RELIEF from the headman, with a GIFT of what the
//     stranger carries as a second try.
// Petitions carry a small gift to the headman (0.4 sheqel of the stranger's 1: C, the customary present to a hearer). The
// stranger arrives on the route's first day with a little of the house's tongue and of Aramaic (PRIOR_HOURS): a stranger with
// no words is not followed in a petition or a bargain at all (Stranger.understood), which would measure only that.
import { Economy } from '../../src/people/economy/world';
import type { Chain } from '../../src/people/economy/chains';
import type { HHSeed } from '../../src/people/economy/world';
import type { SAct } from '../../src/people/speech/stranger';
import { u01, salt } from '../../src/people/hash';

export type Route = 'relief' | 'plea' | 'buy_goods' | 'work_off' | 'hand' | 'gift';
export const WINDOW = 10;
const THEFT_SEQUEL = new Set(['robbed', 'accusation', 'arrest']);
const JUDGEMENT = new Set(['acquitted', 'fined', 'beaten', 'time_granted', 'debt_labour', 'suit']);
const DEBT = new Set(['default', 'pledge_seized', 'repaid', 'loan', 'loan_refused', 'land_sold', 'bound_labour', 'released', 'tax_arrears', 'remitted', 'levy_arrears']);
const CARE = new Set(['nursed_by_kin', 'illness']);
const LEGAL = new Set(['theft', 'accusation', 'arrest', 'suit', 'default']);
const isHH = (x?: string) => !!x && x.startsWith('h:');

export interface Plan { routes: Route[]; who: string; day: number; family: string }

/** the routes for a chain, by the fixed rule (from the base run's events only) */
export function planFor(e: Economy, c: Chain): Plan {
  const evs = c.path.map(i => e.events[i]), leaf = evs[evs.length - 1], prev = evs[evs.length - 2];
  // the house met at the step before the end: that step's household (its actor, or the party it names), else the nearest one
  const near = [prev, ...[...evs].reverse()].map(v => isHH(v.actor) ? v.actor : isHH(v.other) ? v.other! : '').find(Boolean)!;
  const H = e.hh.get(near);
  const at = Math.max(1, prev.day);
  if (THEFT_SEQUEL.has(leaf.kind)) { const th = [...evs].reverse().find(v => v.kind === 'theft');
    return { routes: ['relief'], who: th?.actor ?? near, day: Math.max(1, (th?.day ?? at) - 3), family: 'theft' }; }
  if (JUDGEMENT.has(leaf.kind) || leaf.actor === 'court' && leaf.kind !== 'petition_refused') {
    const accused = isHH(leaf.other) ? leaf.other! : near; const legal = evs.find(v => LEGAL.has(v.kind) && v.day >= prev.day - 20);
    return { routes: ['plea'], who: accused, day: Math.max(1, legal ? Math.max(legal.day, prev.day - 1) : at - 1), family: 'court' }; }
  if (leaf.kind === 'sell') return { routes: ['buy_goods', 'relief'], who: near, day: at, family: 'market' };
  if (DEBT.has(leaf.kind)) {
    const debtor = leaf.kind === 'pledge_seized' && isHH(leaf.other) ? leaf.other! : near;
    return { routes: ['work_off', 'relief'], who: debtor, day: at, family: 'debt' }; }
  if (CARE.has(leaf.kind)) return { routes: ['hand'], who: near, day: at, family: 'care' };
  if (leaf.kind === 'tithe_short' || (evs.some(v => v.kind === 'harvest_poor') && H && (H.kind === 'farmer' || H.kind === 'rich')))
    return { routes: ['hand', 'relief'], who: near, day: at, family: 'harvest' };
  return { routes: ['relief', 'gift'], who: near, day: at, family: 'want' };
}

/** the stranger's scripted steps for one route */
export function actsFor(e: Economy, r: Route, p: Plan, leafDay: number): SAct[] {
  const H = e.hh.get(p.who), q = H?.q, d = p.day;
  switch (r) {
    case 'relief': return [{ a: 'petition', day: Math.max(1, d - 3), to: 'headman', kind: 'relief', for: p.who, q, gift: 0.4 }];
    case 'plea': return [{ a: 'petition', day: d, to: 'headman', kind: 'plea', for: p.who, q, gift: 0.4 }];
    case 'gift': return [{ a: 'give', day: Math.max(1, d - 1), hh: p.who, cash: 1 }];
    case 'buy_goods': return [{ a: 'buy', day: Math.max(1, d - 1), hh: p.who, good: 'goods', qty: 1 }];
    case 'work_off': { const s = Math.max(1, d - 22), acts: SAct[] = [{ a: 'join', day: s, kind: 'gang', q }];
      for (let x = s; x < d - 1; x++) acts.push({ a: 'attend', day: x });
      // (the gang's half rations, settled STR_LAG days behind: ~0.45 a day; what has come in by the eve of the due is given)
      const g = Math.max(0, Math.floor(0.45 * (d - 1 - s - 5)));
      acts.push({ a: 'leave_group', day: Math.max(s, d - 1) }, { a: 'give', day: Math.max(s, d - 1), hh: p.who, grain: g, cash: 1 }); return acts; }
    case 'hand': { // (at the harvest, from six days before the step, inside the harvest's call for hands; at a sickness, from its day;
      // asked again on the next two days if refused, as anyone looking for work would)
      const s = Math.max(1, p.family === 'harvest' ? d - 6 : d), acts: SAct[] = [];
      for (let x = s; x < s + 3; x++) acts.push({ a: 'stay', day: x, hh: p.who }, { a: 'seek_work', day: x, hh: p.who });
      for (let x = s; x <= Math.min(leafDay, s + 24); x++) acts.push({ a: 'attend', day: x }); return acts; }
  }
}

export interface Trial { leaf: number; shape: string; leafKind: string; family: string; routes: Route[]; enteredBy: Route[]; refused: Record<string, string[]> }

/** the hours of talk heard (simplified, answered) before a route begins: ~0.3 comprehension of the house's tongue and of Aramaic */
export const PRIOR_HOURS = 50;
/** run the economy with the stranger's scripted steps up to `to`. The stranger arrives on the day of its first step (so its
 *  bread before then costs it nothing and touches no one), knowing a little of the house's tongue and of Aramaic (complex asks,
 *  a petition or a bargain, need some words: Stranger.understood); each step is done on its day (live play: after the
 *  households' day, as a queued step is), a gift clamped to what the stranger has then */
function runWith(seed: number, hs: HHSeed[], acts: SAct[], to: number, who: string) {
  const x = new Economy(seed, hs), why: string[] = [], first = Math.min(...acts.map(a => a.day));
  const byDay = new Map<number, SAct[]>(); for (const a of acts) { const l = byDay.get(a.day); if (l) l.push(a); else byDay.set(a.day, [a]); }
  let S: ReturnType<Economy['stranger']> | undefined;
  for (let d = 0; d <= to; d++) {
    x.step(d);
    if (d === first) { S = x.stranger(); S.hear(S.langOf(who), PRIOR_HOURS, 1, true, d); S.hear('Aramaic', PRIOR_HOURS, 1, true, d); }
    for (const a of byDay.get(d) ?? []) {
      if (a.a === 'give') S!.do({ ...a, grain: Math.min(a.grain ?? 0, S!.purse.grain), cash: Math.min(a.cash ?? 0, S!.purse.cash) });
      else S!.do(a);
    }
  }
  if (S) for (const [k, n] of Object.entries(S.stats)) if (/refused|ruling_|^relief$|^hired_stranger$|^hosted$|not_understood/.test(k)) why.push(`${k}x${n}`);
  return { x, why };
}
const keyOf = (e: Economy, id: number) => { const v = e.events[id]; return `${v.actor}|${v.kind}|${v.other ?? ''}`; };

/** try every sampled chain by its routes; `base` is the economy's year with no player input */
export function enterBySpeech(seed: number, hs: HHSeed[], base: Economy, cs: Chain[], n: number, year: number) {
  const sample = [...cs].sort((a, b) => u01(seed, salt('t-f9-speech'), a.leaf) - u01(seed, salt('t-f9-speech'), b.leaf)).slice(0, n);
  const trials: Trial[] = [];
  for (const c of sample) {
    const p = planFor(base, c), lv = base.events[c.leaf], k = keyOf(base, c.leaf), to = Math.min(year - 1, lv.day + WINDOW);
    const t: Trial = { leaf: c.leaf, shape: c.shape, leafKind: lv.kind, family: p.family, routes: p.routes, enteredBy: [], refused: {} };
    for (const r of p.routes) {
      const { x, why } = runWith(seed, hs, actsFor(base, r, p, lv.day), to, p.who);
      if (why.length) t.refused[r] = why;
      if (!x.events.some(v => v && v.day >= lv.day - WINDOW && v.day <= lv.day + WINDOW && keyOf(x, v.id) === k)) t.enteredBy.push(r);
    }
    trials.push(t);
  }
  const entered = trials.filter(t => t.enteredBy.length).length;
  const byRoute: Record<string, { tried: number; entered: number }> = {}, byLeaf: Record<string, { n: number; entered: number; by: Record<string, number> }> = {};
  for (const t of trials) {
    for (const r of t.routes) { const o = byRoute[r] ??= { tried: 0, entered: 0 }; o.tried++; if (t.enteredBy.includes(r)) o.entered++; }
    const L = byLeaf[t.leafKind] ??= { n: 0, entered: 0, by: {} }; L.n++; if (t.enteredBy.length) L.entered++; for (const r of t.enteredBy) L.by[r] = (L.by[r] ?? 0) + 1;
  }
  return { seed, sampled: trials.length, entered, share: entered / Math.max(1, trials.length), byRoute, byLeaf, trials };
}
