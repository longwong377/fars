// D-385 (UD-21, UD-25: the world reacts to you): people react to the stranger ON SIGHT, before a word is said. A pure decision
// the render side polls (PeopleSim.strangerSeen, a few times a game minute): for each person within SIGHT_M of the stranger,
// one of
//   'greet'  they have met: talked with him (TalkWorld rows) or know him well (PlayerMemory 'recognise'); byName when they
//            have talked (they know what he is called, and he them);
//   'bow'    the house believes the stranger's claimed rank is high (Stranger.regard: belief * rank >= BOW_AT);
//   'avoid'  the house distrusts him (trust < AVOID_TRUST), knows his tale for a lie, or holds a rumour of his ingratitude
//            or of a lie of his (the rumour net: a version with the stranger as its suspect);
//   'stare'  a foreigner in a village: the children (3-11) and the curious stare; in the town, where strangers pass daily,
//            fewer do;
//   'nod'    an ordinary acknowledgement (or one seen before: PlayerMemory 'nod');
//   'ignore' asleep, at supervised work (the foreman counts the gang), in talk with others, or a busy town street's indifference.
// Every draw is seeded by the person and the hour (the same answer all hour, the same after a reload). Nothing is changed
// here; the sim lays the one consequence (a village child tagging along: TalkWorld's own 'follow' deed) in strangerSeen.
// A first sighting is NOT written to PlayerMemory: it has no 'seen' kind (only met/addressed/stopped/watched, lives.json
// familiarity), and the sim already notes a meeting at 3 m (PeopleSim.notice).
// Tier C throughout: the weights are this module's reading of village and town manners (DECISIONS D-385).
import { Rng } from '../../core/rng';
import { segAt } from '../population';
import { SUPERVISED, WORK_FREE } from '../talk';
import type { PeopleSim } from '../sim';

export type SightKind = 'greet' | 'nod' | 'stare' | 'bow' | 'avoid' | 'ignore';
export interface Sight { pid: number; kind: SightKind; /** out-of-world reason (dev overlay) */ why: string; /** metres to the stranger */ d: number;
  /** greet: the person's name as the stranger knows it (they have talked) */ name?: string; byName?: boolean;
  /** stare: a village child who also tags along a little way (the sim lays it as a 'follow' deed) */ follow?: boolean;
  /** D-720: a stare that is a challenge: the stranger where he has no right to be, shouted out of a house or stopped in a hall
   *  (react.ts plays the stare; a shout and a pointing arm are the render side's to add) */ challenge?: boolean }
export interface Near { pid: number; e: number; n: number }

export const SIGHT_M = 12;
export const BOW_AT = 0.5;
export const AVOID_TRUST = 0.35;
/** rumours of the stranger that make a house keep away (his ingratitude, a tale of his found false) */
const BAD_NEWS = new Set(['trespass', 'ingrate', 'claim_denied', 'claim_doubted', /* D-460 (deeds/law.ts): */ 'theft', 'assault', 'damage', 'threats', 'lie_found', 'convicted']);
const CURIOUS = 8, WARY = 0; // talk.ts TEMPER order (wary, dry, warm, proud, anxious, cheerful, pious, blunt, curious)
/** the chance a village child who stares runs after the stranger a while (C) */
export const CHILD_FOLLOW = 0.35;

/** D-720 (the holes audit 4-1): where the stranger stands, when it is somewhere that is someone's: inside a household's house
 *  (its population index), a palace hall, the women's palace, a store or the Treasury (the render side knows the room he is in) */
export interface Inside { kind: 'house' | 'palace' | 'harem' | 'store'; hh?: number }
/** the people whose place a palace, a store or the women's palace is (they stop a stranger there; C) */
const KEEPERS = new Set(['guard', 'servant', 'official', 'caretaker', 'storekeeper', 'treasury', 'scribe', 'steward']);
/** how each person near the stranger reacts at sim time t (reads the sim; D-720: a trespass ('stare' with challenge), first seen, is laid as a deed once
 *  a house and day: deeds/engine.ts trespassed, idempotent) */
export function reactions(sim: PeopleSim, near: readonly Near[], stranger: { e: number; n: number; inside?: Inside | null }, t: number): Sight[] {
  const P = sim.pop, day = Math.floor(t / 24), h = t - day * 24, hour = Math.floor(h);
  const E = sim.ledgerNow(), S = E?.hasStranger ? E.stranger() : null, T = E?.trust ?? null;
  const R = sim.asksWorld.on && E ? sim.asksWorld.rumours : null;
  const out: Sight[] = [];
  for (const x of near) {
    const p = P.persons[x.pid]; if (!p) continue;
    const d = Math.hypot(x.e - stranger.e, x.n - stranger.n); if (d > SIGHT_M) continue;
    if (!P.present(x.pid, day)) continue;
    if (sim.talk.holdAt(x.pid, t)) continue; // (already in talk with him: the conversation drives them)
    const plan = P.plan(x.pid, day), cur = segAt(plan, h); if (cur.where === 'away') continue;
    const r = (kind: SightKind, why: string, more: Partial<Sight> = {}): Sight => ({ pid: x.pid, kind, why, d: +d.toFixed(2), ...more });
    const age = P.ageOn(x.pid, day);
    if (cur.act === 'sleep') { out.push(r('ignore', 'asleep')); continue; }
    if (age < 3) { out.push(r('ignore', 'a small child, carried or minded')); continue; }
    const rng = new Rng(sim.seed, `sight:${x.pid}:${day}:${hour}`), u = rng.next();
    const hh = `h:${P.home(x.pid, day)}`, known = !!E?.hh.has(hh);
    const trust = T && known ? T.trustOf(hh, 'player', day) : 0.5;
    const reg = S && known ? S.regard(hh, day) : null;
    const bad = R && known ? R.knownBy(hh, day).find(k => k.version.suspect === 'player' && BAD_NEWS.has(k.version.kind)) : undefined;
    const atHome = cur.place === `h:${P.home(x.pid, day)}`;
    const working = !WORK_FREE.has(cur.act) && cur.where !== 'road' && !atHome;
    const supervised = SUPERVISED.has(p.job) && (working || /watch|within call of the posts|on duty/.test(cur.why));
    const rows = sim.talk.rows.get(x.pid), talked = !!rows?.length;
    const ai = p.agent ?? -1, mem = ai >= 0 ? sim.memory.greeting(ai, t) : 'none';
    const temper = Math.min(8, Math.floor(p.trait * 9)), child = age <= 11;
    const village = cur.where === 'plain' || (cur.where === 'road' && p.zone === 'plain');
    // (0) D-720: the stranger in a house that is not his to enter (no guest-right, no place in it, never welcomed) or in a hall,
    // a store or the women's palace (the keepers of the place stop him; a believed man of rank is bowed to instead): the house
    // shouts him out and the lane will hear of it; a child stares, the old and the asleep are as before
    const inn = stranger.inside;
    if (inn?.kind === 'house' && inn.hh === P.home(x.pid, day) && atHome && age >= 12) {
      const welcome = S?.stay?.host === hh || (S?.group?.kind === 'household' && (S.group as any).hh === hh) || (talked && trust >= 0.6);
      if (welcome) { out.push(r('greet', 'a guest of the house, or a friend of it')); continue; }
      sim.deeds.trespassed(x.pid, hh, t, 'house'); out.push(r('stare', 'a stranger in the house, uninvited: shouted out', { challenge: true })); continue; }
    if (inn && inn.kind !== 'house' && KEEPERS.has(p.job) && !(reg && !reg.doubted && reg.belief * reg.rank >= BOW_AT)) {
      sim.deeds.trespassed(x.pid, hh, t, inn.kind); out.push(r('stare', `a stranger in the ${inn.kind === 'harem' ? 'women’s palace' : inn.kind}: stopped and turned back`, { challenge: true })); continue; }
    // (1) a man of high rank, believed: bowed to even at the work (C: a worker bows to rank as it passes)
    if (reg && !reg.doubted && reg.belief * reg.rank >= BOW_AT && trust >= AVOID_TRUST) { out.push(r('bow', `the house believes him a man of rank (${(reg.belief * reg.rank).toFixed(2)})`)); continue; }
    if (supervised) { out.push(r('ignore', 'at supervised work: eyes on the work')); continue; }
    // (2) distrust: kept away from
    if (trust < AVOID_TRUST) { out.push(r('avoid', `the house distrusts him (trust ${trust.toFixed(2)})`)); continue; }
    if (reg?.doubted) { out.push(r('avoid', 'the house knows his tale for a lie')); continue; }
    if (bad) { out.push(r('avoid', `the house has heard of his ${({ ingrate: 'ingratitude', theft: 'theft', assault: 'violence', damage: 'damage done', threats: 'threats', convicted: 'conviction' } as Record<string, string>)[bad.version.kind] ?? 'lie'} (rumour ${bad.rumour})`)); continue; }
    // (3) those who know him
    if (talked) { out.push(r('greet', 'has talked with him', { name: sim.talk.name(x.pid), byName: true })); continue; }
    if (mem === 'recognise') { out.push(r('greet', 'knows him by sight')); continue; }
    if (cur.act === 'talk' || cur.act === 'gamble') { out.push(r('ignore', 'in talk with others')); continue; }
    if (mem === 'nod') { out.push(r(u < 0.85 ? 'nod' : 'ignore', 'has seen him before')); continue; }
    // (4) a stranger never seen: the village stares, the town mostly lets him pass
    const pStare = village ? (child ? 0.85 : temper === CURIOUS ? 0.7 : temper === WARY ? 0.45 : 0.3) : (child ? 0.35 : temper === CURIOUS ? 0.25 : 0.04);
    const pNod = village ? 0.6 : working ? 0.25 : (p.sex === 'f' && !child ? 0.2 : 0.45); // (a woman of the town does not greet a strange man: C)
    if (u < pStare) { const follow = village && child && age >= 5 && !working && rng.next() < CHILD_FOLLOW;
      out.push(r('stare', village ? (child ? 'a village child: a foreigner!' : 'a foreigner in the village') : 'a foreign face in the street', follow ? { follow } : {})); continue; }
    out.push((u - pStare) / (1 - pStare) < pNod ? r('nod', village ? 'greets a passer-by, as villagers do' : 'a nod to a passer-by') : r('ignore', working ? 'busy at the work' : 'the town sees strangers every day'));
  }
  return out;
}
