// The population view (D-143): who of the simulated population is out of doors (or in an open court, yard or workshop)
// near a point, where exactly, facing where, doing what and carrying what, at the simulation's time. Brief §9.2 "everyone
// who lived there exists … only people near the player get full behaviour", §9.5 "what's simulated is what you see …
// distance never breaks it … when you arrive, everything is exactly where the simulation says it is".
//
// Nothing is simulated here: a person's place and act come from their day plan (population.ts, a pure function of seed,
// person and day); popgeo.ts turns the plan's places into spots in the built world and joins them by walked routes. A
// walk between two places runs over exactly the plan's hours: the route is walked at a natural pace and the person leaves
// late when the plan allows more time than the route needs (the plan's walks take at least 3 min: C), or hurries when it
// allows less (counted: `stats.hurried`). A change of place with no walk in the plan (a room to the court, the house to
// the lane) is walked at a natural pace from the start of the new block (counted: `stats.steps`).
//
// Cost: plans are computed lazily, nearest people first, within a time budget per update (a plan costs 20-110 µs); each
// person's state is cached with the interval it holds for, so a frame touches only people whose block changed and the
// walkers. Detailed agents (sim.ts) on the Terrace are drawn by the crowd from the simulation itself; off the map (in the
// town) the view shows them from the simulation's own position (their hidden legs, walked along the town's lanes) or at
// home.
import { monthsOld, planIndoors, planIndoorsUntil, planIndoorsSince, type Population, type Seg } from './population';
import { babeMode, type BabeMode } from './babes';
import type { PeopleSim, Agent } from './sim';
import { ACTIVITIES, type ActivityId } from './activities';
import { PopGeo, routeAt, headingOf, type Spot, type Route } from './popgeo';
import { buildTerrace } from '../arch/terrace';
import type { Doorway } from '../arch/parts';
import { toLocal, type Site } from '../world/settlement/site';
import { openCode } from '../world/settlement/walk';
import { FACING_ACTS } from './court';
import { sunTimes } from './calendar';
import { h32, salt } from './hash';
import type { P2 } from './navgrid';
import type { LookInput } from './looks';
import { lifeOf } from './bodyShape'; // D-363 hook: the body drawn from the life
import type { Dress } from './body';
import delegationsData from '../data/delegations.json';

export interface ViewPerson {
  pid: number; e: number; n: number; y: number; heading: number;
  act: ActivityId; moving: boolean;
  /** the plan's reason for the block (population.ts `Seg.why`): the crowd resolves the performance's variant from it
   *  (activities.ts performanceFor, D-142) */
  why: string;
  /** the plan's place for the block ('' on a walk): performers of one place share its work objects (the threshing floor,
   *  the bier: crowd.ts placeThings) */
  place: string;
  /** a carried thing the crowd can draw (props.ts kinds), or null; `carryNote` is the plan's own words */
  prop: 'sack' | 'jar' | 'jar_head' | 'basket' | 'tablet' | 'spear' | 'bowl' | 'cloth' | null; carryNote: string | null;
  /** walking pace (m/s) of the current walk (0 standing): the crowd's gait follows it */
  speed: number;
  /** how the person came to be out of doors: 1 = through a door (from a room or house), 2 = on the move from beyond the
   *  view's range, 0 = at a place of the plan (for the pop-in accounting) */
  entry: number;
  /** the spot or route's description (dev overlay) */
  what: string;
  /** a detailed agent off the Terrace (drawn by the view), or -1 */
  agent: number;
  /** standing in a walled court or yard: its plot key and wall top above the ground (Spot.plot, Spot.wall); 0 when open */
  plot: number; wall: number;
  /** the person's household today (population.ts home; -1 for a detailed agent): the bearers of one funeral are the men of
   *  the household in mourning, and share its bier (crowd.ts), not every funeral at the same burial ground */
  hh: number;
  /** D-215 (gap audit item 4): the small children this person carries or has put down beside them now (their own bodies
   *  are not drawn: `young`), at most two, from the children's plans (their `with` and their words: babes.ts babeMode) */
  babes?: { pid: number; months: number; mode: BabeMode }[];
  /** D-215: walking hand in hand with a small child, or leading a blind elder (1: the one who holds out a hand, 2: the one
   *  who reaches up to it; 0 none), the other's pid, the hand used and (2) the arm's raise from hanging (rad) */
  hand?: 0 | 1 | 2; handWith?: number; handSide?: 'l' | 'r'; handUp?: number;
  /** D-215 (gap audit item 37, C): 0 none, 1 lame (walks with a staff), 2 blind (walks feeling the way with a staff) */
  impair?: 0 | 1 | 2;
  /** D-244: drawn inside a room or a tent (the plan says indoors: population.ts planIndoors), not out of doors */
  indoor?: boolean;
  /** D-690: making way for the stranger now (0..1: how far into the step aside; the crowd turns the head to the stranger) */
  glance?: number;
}
interface DayPlan { day: number; n: number; t1: Float32Array; place: Int32Array; act: Uint8Array; why: Int32Array; where: Uint8Array; carry: Int32Array; withP: Int32Array }
interface PS {
  pid: number; home: P2; work: P2 | null; d2: number;
  plan: DayPlan | null; next: DayPlan | null; prev: DayPlan | null;
  /** cached state and the absolute hours it holds for */
  v0: number; v1: number; /** 3: following the stranger or walking back their way (D-315, talk.ts); 4: one of the road folk on the road (D-640, roadFolk.ts) */ mode: 0 | 1 | 2 | 3 | 4; spot: Spot | null; route: Route | null; w0: number; w1: number; wOut: boolean;
  act: ActivityId; carry: number; speed: number; what: string; entry: number;
  /** the plan's reason for the act shown and its place (string indices; -1 none) */
  why: number; pl: number;
  /** D-315: mode 3 is the walk back along the stranger's way (else: following) */
  back?: boolean;
  spots: Map<number, Spot>;
  /** standing: ground height and carried prop, computed once per state */
  y: number; prop: ViewPerson['prop']; yOk: boolean;
  /** where the person stands at their spot (clear of the others standing there), since when, the occupancy cell held, and
   *  the mode of the last update (a walker arriving steps from the spot to it) */
  sepFor: Spot | null; sepE: number; sepN: number; sepT: number; occ: number; lastMode: number;
  /** D-690: the facing where they stand (a group at a social act faces its middle), and the step aside for the stranger:
   *  the offset chosen (grid m) and how far into it the last update was (0..1) */
  sepH: number; yE: number; yN: number; yK: number; yOn: boolean;
  /** D-690: no room at the place (its rings full, or a doorway with no clear place by it): not drawn, never stacked on the spot */
  full: boolean;
  /** the person's own ViewPerson (kept from update to update) and the state version it was filled at: a person standing
   *  at their place is refilled only when their state or place changes (collect's cost: session 6); `ver` counts the
   *  state's changes (evaluate, separate); `viewMoving`: last filled walking or stepping aside (refilled every update) */
  view: ViewPerson | null; ver: number; viewV: number; viewMoving: boolean;
  /** a detailed agent's population person (drawn from the simulation, not here); a child carried now (at `youngV`) */
  isAgent: boolean; isYoung: boolean; youngV: number;
  /** D-215: the person the plan puts this one with now (Seg.with; -1 none), and the update this person's view was last
   *  emitted in */
  wp: number; stamp: number;
}
/** D-244: a spot is drawn when it is out of doors (a court, yard, lane, open ground, a Terrace place) or inside a room or tent
 *  that is built (Spot.inside); a room not built (Spot.noRoom) and the king's rooms (D-199) are not */
const shown = (sp: Spot) => sp.out || !!sp.inside;
const ACTS = Object.keys(ACTIVITIES) as ActivityId[]; const ACT_IX = new Map(ACTS.map((a, i) => [a, i]));
const WHERE = ['terrace', 'town', 'plain', 'road', 'away'] as const; const W_IX = new Map<string, number>(WHERE.map((w, i) => [w, i])); const ROAD = 3, AWAY = 4;
const S = { pace: salt('popview-pace'), sep: salt('popview-sep'), impair: salt('popview-impair'), step: salt('popview-doorstep') };
/** D-215: children under this age (years) walking with someone walk hand in hand with them (C); a child walker is taken
 *  to the carer's side when within HAND_SNAP m of them (their plans walk them together), at handReach's distance; a child
 *  of the house leads a blind elder walking within GUIDE_SNAP m (C) */
export const TODDLER_HAND = 4, HAND_SNAP = 4, GUIDE_SNAP = HAND_SNAP;
/** D-292: the one of a pair of the body's care who is placed by the other (population.ts care): the child whose hair is gone
 *  through for lice sits PAIR_GAP.comb m in front of the woman, facing the same way; the man being shaved sits
 *  PAIR_GAP.shave m in front of the barber, face to face (C) */
export const PAIR_FOLLOW = /^having (his|her) hair gone through|^being shaved by the barber|^at the well: a word and a look/;
export const PAIR_GAP = { comb: 0.42, shave: 0.55, well: 1.3 } as const;
/** where the smaller of two walkers hand in hand walks and how it raises its arm (C, proportions of a body of height h m:
 *  shoulder at 0.8 h, 0.15 h out from the body axis, arm with hand 0.4 h; the grown walker's hand held out about 0.3 m
 *  from the axis at 0.75 m, the smaller one's palm meeting it 0.19 m out: measured on the rig, the palms 5-10 cm apart,
 *  tests/people_children.test.ts): the arm's raise from hanging (rad) and the distance between the two walkers' axes (m) */
export function handReach(h: number) { const L = 0.4 * h, raise = Math.acos(Math.max(-0.6, Math.min(0.95, (0.8 * h - 0.75) / L))); return { raise, gap: 0.19 + L * Math.sin(raise) + 0.15 * h }; }
/** the distance between the axes for a two-year-old (tests) */
export const HAND_GAP = handReach(0.87).gap;
/** D-215 (gap audit item 37; C): shares of the lame (men of working age) and the blind (people of 60 and over). Blindness
 *  in old age from cataract and trachoma was common before modern medicine (C: no figure for Achaemenid Fars) */
export const IMPAIR = { lame: { share: 0.006, ages: [22, 60] as [number, number] }, blind: { share: 0.03, from: 60 } } as const;
/** people standing keep at least this far apart (m, C): out of doors about a metre (s18 C5, D-690: at 0.6 m the packed
 *  courts read as grids and stopped the walk), in a room or tent 0.7 m (shoulder to shoulder); an arriving walker takes
 *  STEP_S to step aside */
export const SEP = 1.0, SEP_IN = 0.7; const STEP_S = 2;
/** D-696: two people of a post or a file of the court's order are never on one spot (m: only a shared spot is spread; the files keep their own spacing) */
export const SEP_POST = 0.1;
/** D-690: a door opening and the apron before it (m from the opening's middle, either side) are kept clear of anyone standing */
export const DOOR_CLEAR = 1.5;
/** D-690: how far from its spot a person standing is spread at most (m; in a room or tent, out of doors) */
export const SPREAD_R = { inside: 5, out: 12 } as const;
/** D-690: people standing make way for the stranger within YIELD_R m (YIELD_DOOR_R by a doorway: doorways first), by up to
 *  YIELD_STEP m, turned toward the stranger (C: a step aside, a glance) */
export const YIELD_R = 2.4, YIELD_DOOR_R = 3.2, YIELD_STEP = 0.85;
/** D-692: the plan budget after a jump in time: the first update's ms, then that many updates at the last ms */
export const CATCH_UP = [60, 30, 10] as const;
/** D-692: the share of people at each light work in their own court by day who do it in the lane by their street door (C) */
const DOORSTEP: Partial<Record<ActivityId, number>> = { spin: 0.45, play: 0.6, talk: 0.5, rest: 0.35, craft: 0.3, clean: 0.4, eat: 0.15 };
/** D-690: acts a group stands at facing its own middle (a talk, a rest, a game, a meal), not all one way */
const SOCIAL = new Set<ActivityId>(['talk', 'rest', 'gamble', 'eat', 'shelter', 'mourn', 'play']);
/** slowest walk shown (m/s); below it the person walks at their own pace and leaves late (C) */
export const MIN_PACE = 0.75;
/** walks faster than this are counted as hurried (C: brisk walking) */
export const MAX_PACE = 1.8;
/** carried things the crowd has a prop for, from the plan's words (§9.5 goods are physical) */
export function propOf(act: ActivityId, carry: string | null): ViewPerson['prop'] {
  const P = ACTIVITIES[act].prop; if (P) return P === 'bread' ? 'basket' : P as ViewPerson['prop'];
  if (!carry) return null; const c = carry.toLowerCase();
  if (c.startsWith('gifts for the king: ')) { const g = GIFT_PROP.get(carry.slice(20)); if (g) return g; } // D-199: a delegation's own gifts (delegations.json)
  if (/jar/.test(c) && /head|water/.test(c)) return 'jar_head'; if (/\bjar\b|jug/.test(c)) return 'jar';
  if (/sack|grain|flour/.test(c)) return 'sack'; if (/basket|bread|loaves|dung cakes|fruit|figs/.test(c)) return 'basket';
  if (/tablet|letter/.test(c)) return 'tablet'; if (/spear/.test(c)) return 'spear';
  return null;
}
/** D-199: the prop each delegation's gift is carried as (delegations.json: the carved gifts as the prop system allows) */
const GIFT_PROP = new Map<string, ViewPerson['prop']>(((delegationsData as any).peoples as { gifts: [string, string][] }[]).flatMap(d => d.gifts.map(([t, k]) => [t, k as ViewPerson['prop']] as [string, ViewPerson['prop']])));
/** the dress a person of the population wears (C: by job, sex and age; the detailed agents' roster rules, sim.ts) */
export function dressOf(job: string, sex: 'm' | 'f', age: number, persian: boolean): Dress {
  if (age < 12) return 'child'; if (sex === 'f') return 'woman';
  if (job === 'guard') return persian ? 'guard' : 'median';
  if (job === 'official' || job === 'steward') return 'persian';
  if (job === 'priest') return 'median'; // D-209: the magi in Median dress with the soft cap (the Oxus plaques: B; the Median origin of the magi, Herodotus 1.101, a claim)
  if (job === 'scribe' || job === 'messenger' || job === 'traveller' || (job === 'treasury' && age >= 20)) return 'median';
  return 'worker';
}
const roleOf = (job: string, sub: string) => job === 'builder' ? (sub === 'stone' ? 'mason' : 'porter') : job === 'miller' ? 'grinder' : job === 'camp' ? (sub === 'baker' ? 'baker' : 'grinder') : job === 'child' ? 'child' : job;

export class PopView {
  readonly pop: Population;
  private ps = new Map<number, PS>();
  private list: PS[] = [];
  private strings: string[] = []; private strIx = new Map<string, number>();
  private centre: P2 = [1e9, 1e9];
  /** people within this distance of the centre are kept (their homes or work places within it plus the margin) */
  radius = 5000; margin = 1500;
  /** D-244: only these people are candidates (the renderless trace's household sample, tools/dev/people_trace.ts); null: all */
  only: ((pid: number) => boolean) | null = null;
  /** the plan computation budget per update (ms) and the Terrace route searches per update */
  planBudgetMs = 3; navBudget = 1;
  /** route searches per update (ms): beyond it, people farther than `nearR` wait at the place they are leaving (they
   *  then walk faster to arrive on time); nearer people always get their route */
  routeBudgetMs = 3; nearR = 150;
  readonly stats = { doorstep: 0, doorKept: 0, yielding: 0, yieldSteps: 0, candidates: 0, planned: 0, planMs: 0, pending: 0, visible: 0, walking: 0, hurried: 0, lateLeaves: 0, steps: 0, hidden: 0, unresolved: 0, routeWait: 0, agentsOff: 0, evalMs: 0, updates: 0, carried: 0, nanTimes: 0, spread: 0, crowded: 0, warmed: 0, warmMs: 0, noRoom: 0, stepsIn: 0, inside: 0 };
  private out: ViewPerson[] = []; private nOut = 0;
  private anchorsBuilt = false; private homes: Float64Array | null = null;
  /** opts.warm false (D-392): the court's routes are in the geo's core cache already (the baked world's, searched for this
   *  very world): no search, and no plans of the court's first days drawn now (they stepped the economy ~150 days ahead at load) */
  constructor(readonly sim: PeopleSim, readonly geo: PopGeo, readonly seed = 1, opts: { warm?: boolean } = {}) { this.pop = sim.pop;
    // D-182: with the court resident its people's routes are searched now (a one-time cost with the court setting only:
    // stats.warmMs), so that the morning's walks do not outrun their routes (pop-in)
    if (this.pop.court && opts.warm !== false) { const t0 = performance.now(); const K = this.pop.court; this.stats.warmed = geo.warmCore(K.anchorPairs([K.firstDay, K.firstDay + 1])); this.stats.warmMs = performance.now() - t0; } }
  private str(s: string) { let i = this.strIx.get(s); if (i === undefined) { i = this.strings.length; this.strings.push(s); this.strIx.set(s, i); } return i; }
  /** each person's home and work anchor (grid), for choosing who can be near */
  private buildAnchors() {
    const P = this.pop, n = P.persons.length, A = new Float64Array(n * 4).fill(NaN); const TER: P2 = [80, -10];
    const homeOf = new Map<number, P2>(), workAt = new Map<string, P2 | null>();
    for (const H of P.households) { let xy: P2 | null = null;
      if (H.zone === 'town') xy = H.xy; else if (H.zone === 'plain') { const m = this.geo.villageOf(H.id); xy = m ? (() => { const v = (this.geo as any).villages[m.vi]; return [v.x, v.y] as P2; })() : null; }
      else if (H.zone === 'terrace') xy = H.home === 'court_camp' || H.home.startsWith('rcamp:') ? H.xy : TER; /* D-199: the court's camps */ else xy = H.home === 'station' ? [-1450, 395] : H.home.startsWith('hinterland:') ? [80, 30] /* D-640: the road folk, on the roads into Pārsa */ : [-3000, 0];
      if (xy) homeOf.set(H.id, xy); }
    for (const p of P.persons) { const h = homeOf.get(p.hh) ?? homeOf.get(p.hh2); if (h) { A[p.id * 4] = h[0]; A[p.id * 4 + 1] = h[1]; }
      const terraceWork = p.zone === 'terrace' || ['builder', 'porter', 'camp', 'caretaker', 'guard'].includes(p.job) || p.work === 'treasury_inside' || p.work === 'treasury_store' || p.work === 'treasury_desk';
      if (terraceWork) { A[p.id * 4 + 2] = TER[0]; A[p.id * 4 + 3] = TER[1]; }
      // (D-692: a work place of its own, a town workshop 'ws:3', 'ws_textile' and the like: where the geo puts it, once per
      // place. Anchored only by their homes, the Treasury's workshop hands of q_s1 living up to 1.6 km off were planned
      // last, after thousands: a second after a jump the view lacked 28 of the 117 people near cov-266)
      else if (typeof p.work === 'string' && p.work) { let w = workAt.get(p.work);
        if (w === undefined) { const sp = this.geo.spot(p.id, p.work, 'craft', 0, 10, false); w = sp.ok ? [sp.e, sp.n] : null; workAt.set(p.work, w); }
        if (w) { A[p.id * 4 + 2] = w[0]; A[p.id * 4 + 3] = w[1]; } } }
    this.homes = A; this.anchorsBuilt = true;
  }
  /** keep the people who can be within `radius` of the centre (home or work place within radius + margin) */
  private recentre(c: P2) {
    if (!this.anchorsBuilt) this.buildAnchors(); this.centre = [c[0], c[1]];
    const A = this.homes!, R = this.radius + this.margin, keep = new Map<number, PS>();
    for (let pid = 0; pid < this.pop.persons.length; pid++) {
      const hx = A[pid * 4], hy = A[pid * 4 + 1], wx = A[pid * 4 + 2], wy = A[pid * 4 + 3];
      const dh = Number.isFinite(hx) ? Math.hypot(hx - c[0], hy - c[1]) : Infinity, dw = Number.isFinite(wx) ? Math.hypot(wx - c[0], wy - c[1]) : Infinity, d = Math.min(dh, dw);
      if (d > R || (this.only && !this.only(pid))) continue;
      let s = this.ps.get(pid);
      if (!s) s = { pid, home: [hx, hy], work: Number.isFinite(wx) ? [wx, wy] : null, d2: 0, plan: null, next: null, prev: null, v0: 1, v1: 0, mode: 0, spot: null, route: null, w0: 0, w1: 0, wOut: true, act: 'rest', carry: -1, speed: 0, what: '', entry: 0, why: -1, pl: -1, spots: new Map(), y: 0, prop: null, yOk: false, sepFor: null, sepE: 0, sepN: 0, sepT: -1e9, occ: -1, lastMode: 0, sepH: 0, yE: 0, yN: 0, yK: 0, yOn: false, full: false,
        view: null, ver: 0, viewV: -1, viewMoving: false, isAgent: this.pop.persons[pid].agent >= 0, isYoung: false, youngV: -1, wp: -1, stamp: -1 };
      s.d2 = d * d; keep.set(pid, s);
    }
    for (const [pid, o] of this.ps) if (!keep.has(pid)) this.release(o);
    this.ps = keep; this.list = [...keep.values()].sort((a, b) => a.d2 - b.d2); this.stats.candidates = this.list.length;
  }
  private compact(day: number, segs: Seg[]): DayPlan {
    const n = segs.length, D: DayPlan = { day, n, t1: new Float32Array(n), place: new Int32Array(n), act: new Uint8Array(n), why: new Int32Array(n), where: new Uint8Array(n), carry: new Int32Array(n), withP: new Int32Array(n) };
    segs.forEach((s, i) => { D.t1[i] = s.t1; D.place[i] = this.str(s.place); D.act[i] = ACT_IX.get(s.act) ?? 0; D.why[i] = s.why ? this.str(s.why) : -1; D.where[i] = W_IX.get(s.where) ?? AWAY; D.carry[i] = s.carry ? this.str(s.carry) : -1; D.withP[i] = s.with ?? -1; });
    // a plan whose times are not numbers (population.ts: the walks to an estate's trees, `estate:<hh>:trees`, have NaN
    // hours; reported, D-143): such a block is taken as ending where the last good one did (zero length), the day at 24
    for (let i = 0; i < n; i++) if (!Number.isFinite(D.t1[i])) { D.t1[i] = i === n - 1 ? 24 : i ? D.t1[i - 1] : 0; this.stats.nanTimes++; }
    return D;
  }
  private budgetLeft = 0; private tPlan = 0;
  /** the person's plan for a day, computed within the update's budget (null: not yet) */
  private planOf(s: PS, day: number, force = false): DayPlan | null {
    if (s.plan?.day === day) return s.plan; if (s.next?.day === day) { s.prev = s.plan; s.plan = s.next; s.next = null; return s.plan; }
    if (s.prev?.day === day) return s.prev;
    if (!force && performance.now() - this.tPlan > this.budgetLeft) return null;
    if (!this.pop.present(s.pid, day)) return null;
    const t0 = performance.now(); const D = this.compact(day, this.pop.plan(s.pid, day)); this.stats.planned++; this.stats.planMs += performance.now() - t0;
    if (!s.plan || day > s.plan.day) { if (s.plan && day === s.plan.day + 1) { s.next = D; return D; } s.prev = null; s.plan = D; } else if (day === s.plan.day - 1) s.prev = D; else s.plan = D;
    return D;
  }
  private segT0(P: DayPlan, i: number) { return i ? P.t1[i - 1] : 0; }
  private segIx(P: DayPlan, h: number) { let lo = 0, hi = P.n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (h < P.t1[m]) hi = m; else lo = m + 1; } return lo; }
  /** D-244: block i of a plan as the plan's own segment (population.ts planIndoors reads its place, act and words) */
  private segOf(P: DayPlan, i: number): Seg { return { t0: this.segT0(P, i), t1: P.t1[i], place: this.strings[P.place[i]], act: ACTS[P.act[i]], why: P.why[i] >= 0 ? this.strings[P.why[i]] : '', where: WHERE[P.where[i]] }; }
  /** D-244: the plan puts the person of block i under a roof at hour h of the plan's day (planIndoors); without the
   *  calendar (no weather), the act decides as before (asleep, ill, off the map, resting after dark) */
  private indoorAt(P: DayPlan, i: number, h: number): boolean {
    const sun = sunTimes(P.day), C = this.pop.cal?.ctx(P.day); if (C) return planIndoors(this.segOf(P, i), C.wx, sun, h);
    const act = ACTS[P.act[i]], dark = h < sun.rise - 0.25 || h > sun.set + 0.6; return act === 'sleep' || act === 'lie_ill' || act === 'offmap' || (dark && act === 'rest');
  }
  /** the person's spot at segment i of a plan (memoised per place and indoor/outdoor). `indoor`: the plan puts them under a
   *  roof then (D-244: indoorAt at the hour it is asked for; the block's midpoint when not given). A spot out of doors
   *  where the plan says indoors, not under a built roof, is a room not built: not drawn (`noRoom`; stats.noRoom) */
  private spotAt(s: PS, P: DayPlan, i: number, indoorArg?: boolean): Spot {
    const place = backPlace(this.strings[P.place[i]]), act = ACTS[P.act[i]], h = (this.segT0(P, i) + P.t1[i]) / 2; // (D-315: the walk back along the stranger's way ends at its place)
    const indoor = indoorArg ?? this.indoorAt(P, i, h);
    // (keyed by the day too: a spot depends on the day, the home and the age with it; a lane's spot memoised on day 150 was
    // used on day 25, 9 m away, when the person had turned twelve in between: D-191)
    // (D-221: and by whether the act faces what is waited on, court setting only: popgeo.terrace)
    const key = (((P.day * 4194304 + P.place[i]) * 2 + (indoor ? 1 : 0)) * 2 + (this.pop.court && FACING_ACTS.test(act) ? 1 : 0)) * 2 + (act === 'smith' ? 1 : 0); let sp = s.spots.get(key); // (D-255: and whether at the forge, popgeo forgeSpot)
    if (!sp) { sp = this.geo.spot(s.pid, place, act, P.day, h, indoor);
      if (indoor && sp.ok && sp.out && !sp.roof) sp = { ...sp, out: false, inside: false, noRoom: true, what: `${sp.what}: indoors by the plan, no room built there (not drawn: D-244)` };
      else if (!indoor && sp.ok && sp.out && sp.net === 'town' && sp.plot) sp = this.doorstep(s.pid, act, P.day, h, P.place[i], sp);
      if (s.spots.size >= 64) s.spots.clear(); s.spots.set(key, sp); }
    return sp;
  }
  private pace(pid: number) { return 1.1 + 0.3 * (h32(this.seed, S.pace, pid) / 4294967296); }
  /** the cached state of a person at absolute time t (hours) */
  private evaluate(s: PS, t: number) {
    const d = Math.floor(t / 24), h = t - d * 24; s.entry = 0; s.yOk = false; s.ver++; s.wp = -1;
    if (!this.pop.present(s.pid, d)) { s.mode = 0; s.v0 = t; s.v1 = d * 24 + 24; s.what = 'not here today'; return; }
    const P = this.planOf(s, d); if (!P) { s.mode = 0; s.v0 = t; s.v1 = t; this.stats.pending++; return; }
    const i = this.segIx(P, h), base = d * 24;
    const hide = (until: number, why: string) => { s.mode = 0; s.spot = null; s.v0 = t; s.v1 = until; s.what = why; };
    if (P.where[i] === AWAY) return hide(base + P.t1[i], 'away');
    // D-315 (UD-21): following the stranger, or walking back the way they went: placed each update on the stranger's own way
    // (talk.ts followPos: walkable, since the stranger walked it), not at a place of the plan
    { const pl = this.strings[P.place[i]]; if (pl.charCodeAt(0) === 64 && (pl === '@stranger' || pl.startsWith('@back:'))) {
      s.mode = 3; s.back = pl !== '@stranger'; s.spot = null; s.route = null; s.w0 = base + this.segT0(P, i); s.w1 = base + P.t1[i]; s.v0 = t; s.v1 = s.w1; s.act = 'walk'; s.why = P.why[i]; s.wp = -1; s.pl = -1; s.carry = -1; s.speed = 0;
      s.what = s.back ? 'walking back the way the stranger led (D-315)' : 'following the stranger (D-315)'; return; } }
    // D-640 (C10): the road folk (population.ts addRoadFolk) on the road, at the stair foot or by their flock: placed each update
    // where the register puts them (roadFolk.ts spotOf), once the traffic has handed them over (Population.shareFolk)
    if (this.pop.folkShared && this.pop.persons[s.pid].folk && (P.where[i] === ROAD || this.strings[P.place[i]].startsWith('graze:'))) {
      s.mode = 4; s.spot = null; s.route = null; s.w0 = base + this.segT0(P, i); s.w1 = base + P.t1[i]; s.v0 = t; s.v1 = s.w1; s.act = ACTS[P.act[i]]; s.why = P.why[i]; s.wp = -1; s.pl = -1; s.carry = -1; s.what = 'on the road (roadFolk.ts: D-640)'; return; }
    if (P.where[i] === ROAD) {
      let i0 = i, i1 = i; while (i0 > 0 && P.where[i0 - 1] === ROAD) i0--; while (i1 < P.n - 1 && P.where[i1 + 1] === ROAD) i1++;
      const T0 = base + this.segT0(P, i0), T1 = base + P.t1[i1];
      let from: Spot | null = null, to: Spot | null = null;
      // (D-244: the place left as the plan has it at the leaving, the place reached as at the arriving)
      if (i0 > 0) from = this.spotAt(s, P, i0 - 1, this.indoorAt(P, i0 - 1, this.segT0(P, i0) - 1e-6)); else { const Q = this.planOf(s, d - 1, true); if (Q) { let k = Q.n - 1; while (k > 0 && Q.where[k] === ROAD) k--; from = this.spotAt(s, Q, k, this.indoorAt(Q, k, Q.t1[k] - 1e-6)); } }
      if (i1 < P.n - 1) to = this.spotAt(s, P, i1 + 1, this.indoorAt(P, i1 + 1, P.t1[i1] + 1e-6)); else { const Q = this.planOf(s, d + 1, true); if (Q) { let k = 0; while (k < Q.n - 1 && Q.where[k] === ROAD) k++; to = this.spotAt(s, Q, k, this.indoorAt(Q, k, this.segT0(Q, k) + 1e-6)); } }
      if (!from?.ok || !to?.ok) { this.stats.unresolved++; return hide(T1, `walking between places not built (${from?.what ?? '?'} → ${to?.what ?? '?'})`); }
      const r = this.routeFor(s, from, to);
      if (r === undefined) { this.stats.routeWait++; if (shown(from)) { s.mode = 1; s.spot = from; s.route = null; s.wp = i0 > 0 ? P.withP[i0 - 1] : -1; s.act = i0 > 0 ? ACTS[P.act[i0 - 1]] : 'rest'; s.why = i0 > 0 ? P.why[i0 - 1] : -1; s.pl = i0 > 0 ? P.place[i0 - 1] : -1; s.carry = -1; s.speed = 0; s.what = `${from.what} (waiting for a route)`; } else s.mode = 0; s.v0 = t; s.v1 = t; return; } // over this update's search budget: ask again
      if (r === null) { this.stats.unresolved++; return hide(T1, `no route ${from.what} → ${to.what}`); }
      const D = (T1 - T0) * 3600, v = r.len / Math.max(1, D), nat = this.pace(s.pid);
      let S0 = T0; if (v < MIN_PACE) { S0 = T1 - r.len / nat / 3600; this.stats.lateLeaves++; } else if (v > MAX_PACE) this.stats.hurried++;
      if (t < S0) { // not yet gone: still at the place before, doing what was done there
        s.mode = shown(from) ? 1 : 0; s.spot = from; s.route = null; s.v0 = T0; s.v1 = S0; s.wp = i0 > 0 ? P.withP[i0 - 1] : -1; s.act = i0 > 0 ? ACTS[P.act[i0 - 1]] : 'rest'; s.why = i0 > 0 ? P.why[i0 - 1] : -1; s.pl = i0 > 0 ? P.place[i0 - 1] : -1; s.carry = -1; s.speed = 0; s.what = `${from.what} (leaves ${fmtH(S0 - base)})`; return; }
      s.mode = 2; s.route = r; s.w0 = S0; s.w1 = T1; s.wOut = true; s.spot = to; s.v0 = Math.max(T0, base + this.segT0(P, i)); s.v1 = Math.min(T1, base + P.t1[i]);
      s.act = ACTS[P.act[i]]; s.why = P.why[i]; s.wp = P.withP[i]; s.pl = -1; s.carry = P.carry[i]; s.speed = r.len / Math.max(1, (T1 - S0) * 3600); s.what = `walking: ${from.what} → ${to.what} (${r.len.toFixed(0)} m)`;
      if (!from.out) s.entry = 1; return;
    }
    // D-244: the plan's roof now (planIndoors), and the spell of the block it holds for: a person the plan puts indoors is
    // drawn only under a built roof (else not drawn: spotAt `noRoom`); going in is walked at the END of the spell before
    // (look-ahead, below), coming out at the start of the new one, so nobody is drawn out of doors while the plan says
    // indoors (T-D3), not even for the few seconds of the step (the lag at plan boundaries: people_trace.ts)
    const t0 = base + this.segT0(P, i), tEnd = base + P.t1[i];
    const C = this.pop.cal?.ctx(d), sun = sunTimes(d), seg = C ? this.segOf(P, i) : null;
    const indoor = this.indoorAt(P, i, h);
    const sT0 = seg ? base + planIndoorsSince(seg, C!.wx, sun, h, this.segT0(P, i)) : t0, sT1 = seg ? base + planIndoorsUntil(seg, C!.wx, sun, h, P.t1[i]) : tEnd;
    const sp = this.spotAt(s, P, i, indoor); if (!sp.ok) { this.stats.unresolved++; return hide(sT1, sp.what); }
    let v0 = sT0;
    // the place before this spell: the same block on the other side of the roof (the rain began or ended), or the block before
    let pr: Spot | null = null;
    if (sT0 > t0 + 1e-9) pr = this.spotAt(s, P, i, !indoor);
    else { let ip = i - 1; while (ip > 0 && P.where[ip] === ROAD && P.t1[ip] <= this.segT0(P, ip)) ip--; // a zero-length walk (repaired NaN times) is no walk
      if (i > 0 && ip >= 0 && P.where[ip] !== ROAD && P.where[ip] !== AWAY) pr = this.spotAt(s, P, ip, this.indoorAt(P, ip, this.segT0(P, i) - 1e-6)); }
    if (pr && pr.ok && sp.out && !indoor && Math.hypot(pr.e - sp.e, pr.n - sp.n) > 0.8) { // coming out (or across the court): walked from the start of the spell
      const r = this.routeFor(s, pr, sp);
      if (r === undefined) { this.stats.routeWait++; s.mode = shown(pr) ? 1 : 0; s.spot = pr; s.route = null; s.v0 = t; s.v1 = t; return; }
      if (r) { const dur = r.len / this.pace(s.pid) / 3600, t1 = Math.min(sT1, sT0 + dur);
        if (t < t1) { this.stats.steps++; s.mode = 2; s.route = r; s.w0 = sT0; s.w1 = t1; s.wOut = true; s.spot = sp; s.v0 = sT0; s.v1 = t1; s.act = 'walk'; s.why = P.why[i]; s.wp = P.withP[i]; s.pl = -1; s.carry = -1; s.speed = r.len / Math.max(1, (t1 - sT0) * 3600); s.what = `stepping ${pr.what} → ${sp.what}`; if (!pr.out) s.entry = 1; return; }
        v0 = t1; } }
    let v1 = sT1;
    // going in at the end of this spell: the next spell's place (the other side of the roof in this block, or the next block
    // when it is not a walk) is indoors: the step in is walked so as to arrive as the spell ends
    if (sp.out && !indoor) { let nx: Spot | null = null, nIn = false;
      if (sT1 < tEnd - 1e-9) { nx = this.spotAt(s, P, i, !indoor); nIn = !indoor; }
      else if (i + 1 < P.n && P.where[i + 1] !== ROAD && P.where[i + 1] !== AWAY) { nIn = this.indoorAt(P, i + 1, P.t1[i] + 1e-6); nx = this.spotAt(s, P, i + 1, nIn); }
      // (into a room or a tent that is built, or in under a Terrace roof: a room not built is left at the boundary)
      if (nx && nx.ok && nIn && (nx.inside || (nx.out && nx.roof)) && Math.hypot(nx.e - sp.e, nx.n - sp.n) > 0.8) {
        const r = this.routeFor(s, sp, nx);
        if (r === undefined) { this.stats.routeWait++; v1 = t; } // (over this update's search budget: ask again)
        else if (r) { const dur = r.len / this.pace(s.pid) / 3600, w0 = Math.max(v0, sT1 - dur);
          if (t >= w0) { this.stats.stepsIn++; s.mode = 2; s.route = r; s.w0 = w0; s.w1 = sT1; s.wOut = true; s.spot = nx; s.v0 = w0; s.v1 = sT1; s.act = 'walk'; s.why = P.why[i]; s.wp = P.withP[i]; s.pl = -1; s.carry = -1; s.speed = r.len / Math.max(1, (sT1 - w0) * 3600); s.what = `going in: ${sp.what} → ${nx.what}`; return; }
          v1 = w0; } } }
    s.mode = shown(sp) ? 1 : 0; s.spot = sp; s.route = null; s.v0 = Math.min(Math.max(v0, t0), t); s.v1 = v1;
    s.act = ACTS[P.act[i]]; s.why = P.why[i]; s.wp = P.withP[i]; s.pl = P.place[i]; s.carry = P.carry[i]; s.speed = 0; s.what = sp.what;
    if (sp.out && pr && !pr.out) s.entry = 1;
    if (sp.inside) this.stats.inside++; else if (!sp.out) { this.stats.hidden++; if (sp.noRoom) this.stats.noRoom++; }
  }
  private navLeft = 0; private routeT = 0;
  /** a route within this update's budgets (undefined: ask again next update) */
  private routeFor(s: PS, a: Spot, b: Spot): Route | null | undefined {
    if (s.d2 > this.nearR * this.nearR && this.routeT > this.routeBudgetMs) return undefined;
    const t0 = performance.now(); this.geo.navBudget = this.navLeft; const r = this.geo.route(a, b); this.navLeft = this.geo.navBudget; this.routeT += performance.now() - t0; return r;
  }
  /** advance to time t (hours since the start of the regnal year) around the centre (grid): plans within the budget,
   *  states whose interval ended, then the list of people out of doors */
  update(t: number, centre: P2) {
    const t0 = performance.now(); this.stats.updates++;
    const jumped = this.lastT >= 0 && (t < this.lastT - 1e-6 || t - this.lastT > 0.25); if (jumped) this.jumps++; this.lastT = t;
    if (jumped || this.settling) this.jumpedNow = true; // (D-244: after a jump in time nobody is "just arriving": no step aside drawn)
    if (Math.hypot(centre[0] - this.centre[0], centre[1] - this.centre[1]) > 300) this.recentre(centre);
    { const de = centre[0] - this.eye[0], dn = centre[1] - this.eye[1], L = Math.hypot(de, dn); // D-690: the stranger's way
      if (L > 5) { this.eyeDir[0] = 0; this.eyeDir[1] = 0; } else if (L > 1e-3) { const k = Math.min(1, L / 0.6); this.eyeDir[0] += (de / L - this.eyeDir[0]) * k; this.eyeDir[1] += (dn / L - this.eyeDir[1]) * k; }
      this.eye[0] = centre[0]; this.eye[1] = centre[1]; }
    // (D-692: after a jump in time the near people are planned at once: the first update spends CATCH_UP[0] ms, the next
    // CATCH_UP[1] updates CATCH_UP[2] ms each, nearest first; a second after a jump the view placed 31 of the 53 a settle
    // places in view at cov-266 on the default 3 ms)
    if (jumped || this.lastT < 0 || this.stats.updates === 1) this.catchUp = CATCH_UP[1] + 1; // (and the first update of a page: nothing is planned yet)
    const boost = this.catchUp > 0 ? (this.catchUp-- > CATCH_UP[1] ? CATCH_UP[0] : CATCH_UP[2]) : 0;
    this.budgetLeft = Math.max(this.planBudgetMs, boost); this.tPlan = performance.now(); this.navLeft = this.navBudget * (boost ? 4 : 1); this.routeT = 0;
    const d = Math.floor(t / 24), h = t - d * 24; this.stats.pending = 0;
    // plan the nearest first (the list is sorted by distance); tomorrow's plans in the last hour of the day
    this.talkChanged();
    for (const s of this.list) { const te = this.tv(s.pid, t);
      if (s.v0 <= te && te < s.v1 && (s.mode !== 0 || s.v1 > te)) continue;
      if (performance.now() - this.tPlan > this.budgetLeft && s.plan?.day !== d && s.next?.day !== d) { this.stats.pending++; continue; }
      this.evaluate(s, te);
    }
    if (h > 23 && performance.now() - this.tPlan < this.budgetLeft) for (const s of this.list) { if (performance.now() - this.tPlan > this.budgetLeft) break; if (s.plan?.day === d && !s.next && this.pop.present(s.pid, d + 1)) this.planOf(s, d + 1); }
    this.collect(t); this.jumpedNow = false;
    this.stats.evalMs = performance.now() - t0;
  }
  private static blank(): ViewPerson { return { pid: -1, e: 0, n: 0, y: 0, heading: 0, act: 'rest', moving: false, why: '', place: '', prop: null, carryNote: null, speed: 0, entry: 0, what: '', agent: -1, plot: 0, wall: 0, hh: -1, babes: [], hand: 0, handWith: -1, handSide: 'l', handUp: 0, impair: 0, indoor: false, glance: 0 }; }
  /** the detailed agents off the map: pooled objects (reused from update to update) */
  private agentVps: ViewPerson[] = []; private nAgentVps = 0;
  private agentVp(): ViewPerson { let o = this.agentVps[this.nAgentVps]; if (!o) this.agentVps[this.nAgentVps] = o = PopView.blank(); this.nAgentVps++; this.out[this.nOut++] = o; return o; }
  private tmp = { e: 0, n: 0, heading: 0 };
  private collect(t: number) {
    this.nOut = 0; this.nAgentVps = 0; let walking = 0, carried = 0, nYield = 0; const day = Math.floor(t / 24);
    this.agentOcc.clear(); for (const a of this.sim.agents) if (!a.offmap) { const k = this.occKey(a.pos[0], a.pos[1]); const L = this.agentOcc.get(k); if (L) L.push(a); else this.agentOcc.set(k, [a]); }
    const upd = this.stats.updates; this.youngBuf.length = 0; this.handBuf.length = 0; this.blindBuf.length = 0; this.pairBuf.length = 0;
    for (const s of this.list) { const te = this.tv(s.pid, t);
      const last = this.jumpedNow ? 0 : s.lastMode; s.lastMode = s.mode === 3 ? 2 : s.mode;
      if (s.mode === 3) { if (!s.isAgent && this.followView(s, te, day, upd)) walking++; continue; } // D-315
      if (s.mode === 4) { if (this.folkView(s, te, day, upd)) walking++; continue; } // D-640
      if (s.occ >= 0 && (s.mode !== 1 || s.sepFor !== s.spot)) this.release(s);
      // D-215: a small child the view keeps indoors (asleep: the plan's "asleep, carried on her back", "asleep in her lap")
      // with someone who is out of doors is drawn with them too (children, below)
      if (s.mode === 0 && s.wp >= 0 && s.spot && !s.isAgent && this.pop.ageOn(s.pid, day) < 3) { this.youngBuf.push(s); continue; }
      if (s.mode === 0 || !s.spot || s.isAgent) continue; // detailed agents: below
      // infants are held, nursed or carried on the back (their plan's place is the carer's): no body is drawn for a
      // carried child (C; counted); from one year a child is drawn when it plays or walks by itself
      if (s.youngV !== s.ver) { s.youngV = s.ver; s.isYoung = this.pop.persons[s.pid].age < 3 && this.young(s.pid, day, s); }
      if (s.isYoung) { carried++; this.youngBuf.push(s); continue; }
      // standing at their place, unchanged since the last update: the same ViewPerson (session 6: refilling ~8,000 people
      // every update cost the view 3-5 ms at 1× under load; only walkers, people stepping aside and changed states refill)
      let o = s.view;
      // (D-690: and not making way for the stranger: those near the eye are refilled every update)
      const nearEye = s.mode === 1 && !!s.spot && Math.abs(s.sepE - this.eye[0]) < YIELD_DOOR_R + 1 && Math.abs(s.sepN - this.eye[1]) < YIELD_DOOR_R + 1;
      if (s.mode === 1 && s.full && s.sepFor === s.spot) continue; // (D-690: no room there: not drawn)
      if (o && s.viewV === s.ver && s.mode === 1 && !s.viewMoving && s.sepFor === s.spot && !nearEye && !s.yOn) { this.out[this.nOut++] = o; s.stamp = upd; o.babes!.length = 0; o.hand = 0; if (s.wp >= 0 && PAIR_FOLLOW.test(o.why)) this.pairBuf.push(s); continue; }
      if (!o) s.view = o = PopView.blank(); this.out[this.nOut++] = o; s.stamp = upd; o.babes!.length = 0; o.hand = 0; o.impair = this.impairOf(s.pid, day);
      if (s.mode === 2 && s.wp >= 0 && this.pop.ageOn(s.pid, day) < TODDLER_HAND) this.handBuf.push(s); // D-215: a small child walking with someone
      if (s.mode === 2 && o.impair === 2) this.blindBuf.push(s);
      o.pid = s.pid; o.agent = -1; o.hh = this.pop.home(s.pid, day); o.act = s.act; o.why = s.why >= 0 ? this.strings[s.why] : ''; o.place = s.mode === 1 && s.pl >= 0 ? this.strings[s.pl] : ''; o.what = s.what; o.entry = s.entry; o.carryNote = s.carry >= 0 ? this.strings[s.carry] : null;
      o.plot = s.mode === 1 ? s.spot.plot ?? 0 : 0; o.wall = s.mode === 1 ? s.spot.wall ?? 0 : 0; o.indoor = s.mode === 1 && !!s.spot.inside;
      if (s.mode === 2 && s.route) { const f = Math.max(0, Math.min(1, (te - s.w0) / Math.max(1e-9, s.w1 - s.w0))); routeAt(s.route, f * s.route.len, this.tmp); o.e = this.tmp.e; o.n = this.tmp.n; o.heading = this.tmp.heading; o.moving = true; o.speed = s.speed; walking++;
        if (!ACTIVITIES[o.act].moving) o.act = 'walk'; o.y = this.geo.y(o.e, o.n); o.prop = propOf(o.act, o.carryNote); }
      else {
        if (s.sepFor !== s.spot) { this.separate(s, te, last === 2); s.yOk = false; }
        if (s.full) { this.nOut--; s.stamp = -1; continue; } // (D-690: no room there: not drawn)
        const sp = s.spot, k = (te - s.sepT) * 3600 / STEP_S;
        if (k >= 0 && k < 1 && (s.sepE !== sp.e || s.sepN !== sp.n)) { // just arrived: stepping aside from the spot
          o.e = sp.e + (s.sepE - sp.e) * k; o.n = sp.n + (s.sepN - sp.n) * k; o.heading = headingOf(s.sepE - sp.e, s.sepN - sp.n); o.moving = true; o.speed = Math.hypot(s.sepE - sp.e, s.sepN - sp.n) / STEP_S;
          o.y = this.geo.y(o.e, o.n, sp.net); o.prop = propOf(o.act, o.carryNote); walking++; s.viewV = s.ver; s.viewMoving = true; continue; }
        o.e = s.sepE; o.n = s.sepN; o.heading = s.sepH; o.moving = false; o.speed = 0;
        if (!s.yOk) { s.y = this.geo.y(o.e, o.n, sp.net); s.prop = propOf(o.act, o.carryNote); s.yOk = true; } o.y = s.y; o.prop = s.prop;
        if (nearEye || s.yOn) { this.makeWay(s, o, sp); if (s.yK > 0) { nYield++; if (o.moving) walking++; s.viewV = s.ver; s.viewMoving = true; continue; } }
        if (s.wp >= 0 && PAIR_FOLLOW.test(o.why)) this.pairBuf.push(s); }
      s.viewV = s.ver; s.viewMoving = o.moving;
    }
    this.agentsOff(t);
    this.faceStranger(t);
    this.children(day, upd);
    this.stats.visible = this.nOut; this.stats.walking = walking; this.stats.carried = carried; this.stats.yielding = nYield;
  }
  /** standing places held (1 m cells of grid metres → the people holding them) */
  private occ = new Map<number, number[]>();
  private occKey(e: number, n: number) { return (Math.floor(e) + 60000) * 131072 + (Math.floor(n) + 60000); }
  private release(s: PS) {
    if (s.occ >= 0) { const L = this.occ.get(s.occ); if (L) { const i = L.indexOf(s.pid); if (i >= 0) L.splice(i, 1); if (!L.length) this.occ.delete(s.occ); } }
    s.occ = -1; s.sepFor = null;
  }
  /** D-692: a share of the people at light work in their own court by day do it in the lane outside their street door (a
   *  woman spinning on the doorstep, men talking by the door, children playing in the lane; C: the vernacular towns of the
   *  plateau keep their life in the lanes as much as in the courts): beside the door along the wall, 0.6-0.9 m out from it,
   *  never in the opening or its apron (DOOR_CLEAR), on a lane or square cell; facing across the lane. Counted: stats.doorstep */
  private doorstep(pid: number, act: ActivityId, day: number, h: number, place: number, sp: Spot): Spot {
    const share = DOORSTEP[act]; if (!share || h < 6.5 || h > 18.5) return sp;
    if (h32(this.seed, S.step, pid * 977 + day * 31 + place) / 4294967296 >= share) return sp;
    const t = this.geo.town; if (!t) return sp; const l = t.locate(sp.e, sp.n); if (!l) return sp;
    const S0 = t.boxes[l.si].s, c = S0.cell[l.k], P = c >= 0 ? S0.plots[c] : null; if (!P?.door || P.kind === 'garden') return sp;
    const d = S0.doorPoints(P); if (!d) return sp;
    { const dm = S0.grid(d.mid[0], d.mid[1]); if (Math.hypot(dm[0] - sp.e, dm[1] - sp.n) > 25) return sp; } // (a house's own door: not across a great compound)
    const nu = d.out[0] - d.inside[0], nv = d.out[1] - d.inside[1], L = Math.hypot(nu, nv) || 1, ux = nu / L, uy = nv / L, tx = -uy, ty = ux;
    const r = h32(this.seed, S.step, pid) / 4294967296, sides = r < 0.5 ? [1, -1] : [-1, 1], along = 1.7 + r * 0.9, off = 0.6 + r * 0.3;
    for (const sd of sides) { const u = d.mid[0] + ux * off + tx * along * sd, v = d.mid[1] + uy * off + ty * along * sd, g = S0.grid(u, v), m = t.locate(g[0], g[1]);
      if (!m || !openCode(t.boxes[m.si].s.cell[m.k])) continue;
      const q: Spot = { ...sp, e: g[0], n: g[1], plot: 0, wall: 0, inside: false, roof: false, fixed: false, what: `${sp.what}: in the lane by the house's street door (D-692, C)` };
      if (this.inDoor(q, g[0], g[1])) continue;
      const fx = S0.grid(u + ux, v + uy); q.heading = headingOf(fx[0] - g[0], fx[1] - g[1]) + (r - 0.5) * 70; this.stats.doorstep++; return q; }
    return sp;
  }
  private catchUp = 0;
  /** the eye (the stranger: the camera's ground point) and the way it has been going (a unit vector, 0 when standing) */
  private eye: P2 = [1e9, 1e9]; private eyeDir: P2 = [0, 0];
  /** D-690: a person standing near the stranger makes way: within YIELD_R (YIELD_DOOR_R by a doorway) they step up to
   *  YIELD_STEP m aside, off the stranger's way (to the side of it they stand on; away when the stranger stands), to a
   *  clear place (nobody there, the same court or open ground, not a doorway), turned toward the stranger; past the
   *  radius they step back. How far is a function of the distance, so the step follows the stranger's own pace and a
   *  person never jumps; the side is chosen as the step begins (again while it is young, when the stranger turns onto it). A post held (Spot.fixed) gives half a step
   *  (D-696) and turns its head (the crowd's glance, ViewPerson.glance) */
  private makeWay(s: PS, o: ViewPerson, sp: Spot) {
    const de = s.sepE - this.eye[0], dn = s.sepN - this.eye[1], d = Math.hypot(de, dn);
    const R = this.inDoor(sp, s.sepE, s.sepN) || this.nearDoor(sp, s.sepE, s.sepN) ? YIELD_DOOR_R : YIELD_R;
    const want = d >= R ? 0 : d <= 1.2 ? 1 : (R - d) / (R - 1.2), kk = want * want * (3 - 2 * want);
    if (kk <= 0 && !s.yOn) { s.yK = 0; o.glance = 0; return; }
    // (chosen again while the step is young when the stranger turns so that the place chosen lies on their way)
    if (s.yOn && kk > 0 && s.yK < 0.5 && Math.hypot(this.eyeDir[0], this.eyeDir[1]) > 0.3) { const tx = s.sepE + s.yE - this.eye[0], ty = s.sepN + s.yN - this.eye[1];
      if (tx * this.eyeDir[0] + ty * this.eyeDir[1] > 0 && Math.abs(tx * this.eyeDir[1] - ty * this.eyeDir[0]) < 0.8) s.yOn = false; }
    if (!s.yOn && kk > 0) { // the side: off the stranger's way, to a clear place
      const [fx, fy] = this.eyeDir, moving = Math.hypot(fx, fy) > 0.3; let best = -1e9, be = 0, bn = 0;
      const lat = moving ? de * -fy + dn * fx : 0, side = lat >= 0 ? 1 : -1;
      // (never across the stranger's way unless standing on it: in a narrow lane the one by the wall stays by the wall,
      // turned, rather than stepping into the gap left; s18: a child in q_s2's 1.4 m lane pinned the walker so)
      const cands: P2[] = moving ? [[-fy * side, fx * side], [(-fy * side + fx) * 0.7071, (fx * side + fy) * 0.7071], [(-fy * side - fx) * 0.7071, (fx * side - fy) * 0.7071], ...(Math.abs(lat) < 0.3 ? [[fy * side, -fx * side] as P2] : [])]
        : [[de / (d || 1), dn / (d || 1)], [-dn / (d || 1), de / (d || 1)], [dn / (d || 1), -de / (d || 1)]];
      for (let c = 0; c < cands.length; c++) { const [ux, uy] = cands[c]; for (const L of sp.fixed ? [0.5, 0.3] : [YIELD_STEP, YIELD_STEP * 0.6, YIELD_STEP * 0.4]) { // (a guard at his post gives half a step, D-696)
        const e2 = s.sepE + ux * L, n2 = s.sepN + uy * L;
        if (!this.freeAt(e2, n2, s.pid, 0.55) || this.inDoor(sp, e2, n2) || !this.geo.stepClear({ ...sp, e: s.sepE, n: s.sepN }, [e2, n2])) continue;
        const score = L - c * 0.3; if (score > best) { best = score; be = ux * L; bn = uy * L; } break; } }
      s.yE = be; s.yN = bn; s.yOn = true; this.stats.yieldSteps++;
    }
    const prev = s.yK; s.yK = kk; if (kk <= 0) s.yOn = false;
    o.e = s.sepE + s.yE * kk; o.n = s.sepN + s.yN * kk; o.y = this.geo.y(o.e, o.n, sp.net);
    const step = Math.abs(kk - prev) * Math.hypot(s.yE, s.yN);
    o.moving = step > 0.01; o.speed = o.moving ? 0.6 : 0;
    // turned toward the stranger, as far as the step goes (a glance at the least)
    const toward = headingOf(-de, -dn), dh = ((toward - s.sepH + 540) % 360) - 180;
    o.heading = s.sepH + dh * Math.min(1, 0.75 * kk); o.glance = kk;
  }
  /** a standing place within a few metres of a doorway's apron (the radius of making way is wider there: doorways first) */
  private nearDoor(sp: Spot, e: number, n: number) { for (const [a, b] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) if (this.inDoor(sp, e + a, n + b)) return true; return false; }
  /** nobody else stands within `sep` of (e, n): the population's people standing, the detailed agents on the map */
  private freeAt(e: number, n: number, pid: number, sep = SEP): boolean {
    const fx = Math.floor(e), fy = Math.floor(n);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const L = this.occ.get((fx + dx + 60000) * 131072 + (fy + dy + 60000)); if (!L) continue;
      for (const q of L) { if (q === pid) continue; const o = this.ps.get(q); if (o && Math.hypot(o.sepE - e, o.sepN - n) < sep) return false; } }
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const L = this.agentOcc.get((fx + dx + 60000) * 131072 + (fy + dy + 60000)); if (!L) continue;
      for (const a of L) if (Math.hypot(a.pos[0] - e, a.pos[1] - n) < sep) return false; }
    return true;
  }
  /** the detailed agents on the map by 1 m cell (rebuilt each update) */
  private agentOcc = new Map<number, Agent[]>();
  // ------------------------------------------------------------------------------------------------ D-690: doorways kept clear
  /** the Terrace's doorways (world.ts hands the built ones over; else built here once, ~0.1 s) by 4 m cell */
  private dwIx: Map<number, Doorway[]> | null = null;
  setDoorways(dws: readonly Doorway[]) { const M = new Map<number, Doorway[]>();
    for (const d of dws) { const r = d.width / 2 + d.depth / 2 + DOOR_CLEAR + 0.5;
      for (let x = Math.floor((d.c[0] - r) / 4); x <= Math.floor((d.c[0] + r) / 4); x++) for (let y = Math.floor((d.c[1] - r) / 4); y <= Math.floor((d.c[1] + r) / 4); y++) { const k = x * 65536 + y; const L = M.get(k); if (L) L.push(d); else M.set(k, [d]); } }
    this.dwIx = M; }
  /** counted: standing places moved off a doorway or its apron (stats.doorKept) */
  /** in a door opening or the apron before it (DOOR_CLEAR m out on either side; the opening's width and 0.35 m to each
   *  side): on the Terrace its doorways; in the town and the villages the doors of the plan (the site's door edges) */
  inDoor(sp: Spot, e: number, n: number): boolean {
    if (sp.net === 'town' || sp.net === 'village') {
      let S: Site | null = null, u = 0, v = 0;
      if (sp.net === 'town') { const t = this.geo.town, l = t?.locate(e, n); if (!l) return false; S = t!.boxes[l.si].s; u = l.u; v = l.v; }
      else if (sp.v !== undefined) { S = (this.geo as any).vsite(sp.v).site as Site; [u, v] = toLocal(S.frame, e, n); }
      if (!S || !S.doors.size) return false;
      const i0 = S.ci(u), j0 = S.cj(v), R = DOOR_CLEAR - 0.3;
      for (let j = j0 - 2; j <= j0 + 2; j++) for (let i = i0 - 2; i <= i0 + 2; i++) { if (i < 0 || j < 0 || i >= S.W || j >= S.H) continue;
        // (the edge between (i, j-1) and (i, j): along u; between (i-1, j) and (i, j): along v)
        if (S.doors.has(S.eh(i, j)) && Math.abs(u - (S.u0 + i + 0.5)) < 0.85 && Math.abs(v - (S.v0 + j)) < R) return true;
        if (S.doors.has(S.ev(i, j)) && Math.abs(v - (S.v0 + j + 0.5)) < 0.85 && Math.abs(u - (S.u0 + i)) < R) return true; }
      return false;
    }
    if (e < -80 || e > 280 || n < -260 || n > 200) return false; // (the Terrace and the foot of its stairs)
    if (!this.dwIx) this.setDoorways(buildTerrace().doorways);
    const L = this.dwIx!.get(Math.floor(e / 4) * 65536 + Math.floor(n / 4)); if (!L) return false;
    for (const d of L) { const de = e - d.c[0], dn = n - d.c[1], along = de * d.u[0] + dn * d.u[1], out = de * d.n[0] + dn * d.n[1];
      if (Math.abs(along) < d.width / 2 + 0.35 && Math.abs(out) < d.depth / 2 + DOOR_CLEAR) return true; }
    return false;
  }
  /** where the person stands at their spot: the spot, or when someone already stands there (or it is in a doorway) the
   *  nearest clear place on rings around it (about SEP apart, a little uneven, to SPREAD_R; C), reached by a short straight
   *  step that stays in the same court, yard or open ground (popgeo.stepClear). A group at a social act faces its middle
   *  (the spot). Counted: `stats.spread`, `stats.crowded` when no ring has room, `stats.doorKept` off a doorway */
  private separate(s: PS, t: number, arriving: boolean) {
    this.release(s); const sp = s.spot!; let e = sp.e, n = sp.n, h = sp.heading;
    const sep = sp.fixed ? SEP_POST : sp.inside ? SEP_IN : SEP, door = this.inDoor(sp, e, n); // (D-696: posts and the court's files keep their own close order)
    // (D-221: a post or a place in the court's order is held where it stands, unless it is in a doorway: D-690)
    // (D-696: a post held is held, but by one: the second guard of a post stands beside the first, not in him)
    if (door || !this.freeAt(e, n, s.pid, sep)) { let found = false; const ph = h32(this.seed, S.sep, s.pid) / 4294967296 * Math.PI * 2;
      // (to SPREAD_R m: a court's gathering spreads over its court rather than packing closer)
      for (const g of [sep]) { const rings = Math.floor((sp.inside ? SPREAD_R.inside : SPREAD_R.out) / (g * 1.17));
        for (let ring = 1; ring <= rings && !found; ring++) { const m = 6 * ring; for (let k = 0; k < m && !found; k++) {
          const a = ph + (k / m) * Math.PI * 2, j = ((h32(this.seed, S.sep, s.pid * 64 + k) & 1023) / 1023 - 0.5) * 0.24, r = g * (1.05 + j) * ring, e2 = sp.e + Math.cos(a) * r, n2 = sp.n + Math.sin(a) * r;
          if (this.freeAt(e2, n2, s.pid, g) && !this.inDoor(sp, e2, n2) && this.geo.stepClear(sp, [e2, n2])) { e = e2; n = n2; found = true; } } }
        if (found) break; }
      if (door) this.stats.doorKept++;
      if (found) { this.stats.spread++; if (SOCIAL.has(s.act) && !door && !(this.pop.court && FACING_ACTS.test(s.act))) h = headingOf(sp.e - e, sp.n - n); /* (not the court's waiting, who face what they wait on: D-221) */ } else this.stats.crowded++;
      s.full = !found; } else s.full = false;
    s.sepE = e; s.sepN = n; s.sepH = h; s.sepFor = sp; s.sepT = arriving ? t : -1e9; s.occ = this.occKey(e, n); s.yK = 0; s.yOn = false;
    const L = this.occ.get(s.occ); if (L) L.push(s.pid); else this.occ.set(s.occ, [s.pid]);
  }
  /** a child under three who is not drawn now: under one always (in arms, nursing, on the back); at one and two when
   *  resting, eating or asleep with its carer, or carried on the way */
  private young(pid: number, day: number, s: PS): boolean {
    const age = this.pop.ageOn(pid, day); if (age >= 3) return false; if (age < 1) return true;
    return !(s.act === 'play' || (s.mode === 2 && s.act === 'walk'));
  }
  // ------------------------------------------------------------------------------------------------ D-215: children, impairment
  private youngBuf: PS[] = []; private handBuf: PS[] = []; private blindBuf: PS[] = []; private pairBuf: PS[] = [];
  /** D-292: the pairs of the body's care placed this update (the follower moved to its partner), and those whose partner was not drawn */
  readonly pairs = { placed: 0, alone: 0, jumpMax: 0 };
  /** D-215 counts this update: children held or put down by a carer drawn now, by way of holding; children whose carer is
   *  not drawn (indoors, a detailed agent, out of range) or who have none; hands held; blind elders led */
  readonly kids = { held: 0, unseen: 0, noCarer: 0, second: 0, byMode: {} as Record<string, number>, hands: 0, handJumpMax: 0, led: 0, lame: 0, blind: 0 };
  /** the carried children onto their carers, the small children walking with someone hand in hand, the blind led */
  private children(day: number, upd: number) {
    const K = this.kids; K.held = 0; K.unseen = 0; K.noCarer = 0; K.second = 0; K.byMode = {}; K.hands = 0; K.handJumpMax = 0; K.led = 0;
    for (const c of this.youngBuf) {
      // (D-244: a small child asleep indoors whose plan names nobody with it sleeps beside its mother, or else beside a grown
      // member of the household drawn in the house: not left undrawn in an empty room)
      if (c.wp < 0 && c.spot?.inside && c.mode === 1) c.wp = this.bedside(c, day, upd);
      const carer = c.wp >= 0 ? this.ps.get(c.wp) : undefined;
      if (c.wp < 0) { K.noCarer++; continue; }
      if (!carer || carer.stamp !== upd || !carer.view || carer.mode === 0) { if (c.mode !== 0) K.unseen++; continue; } // (unseen: a child out of doors whose carer is not drawn)
      const o = carer.view; if (o.babes!.length >= 2) { K.second++; continue; }
      const why = c.why >= 0 ? this.strings[c.why] : '', place = c.pl >= 0 ? this.strings[c.pl] : '';
      const mode = babeMode(why, c.act, o.act, o.moving, place.startsWith('h:') || /at home/.test(why));
      o.babes!.push({ pid: c.pid, months: monthsOld(this.pop, c.pid, day), mode }); K.held++; K.byMode[mode] = (K.byMode[mode] ?? 0) + 1;
    }
    for (const c of this.handBuf) {
      const carer = this.ps.get(c.wp), o = c.view, q = carer?.view;
      if (!carer || !o || !q || carer.stamp !== upd || carer.mode !== 2 || q.hand || carer.isAgent) continue;
      if (Math.hypot(q.e - o.e, q.n - o.n) > HAND_SNAP) continue;
      this.hold(q, o, c.pid, CHILD_H[Math.max(0, Math.min(11, this.pop.ageOn(c.pid, day)))]); K.hands++;
    }
    for (const b of this.blindBuf) { const o = b.view!; if (o.hand) continue;
      for (const m of this.pop.membersOn(this.pop.home(b.pid, day), day)) { const a = this.pop.ageOn(m, day); if (a < 6 || a > 12) continue;
        const g = this.ps.get(m); if (!g?.view || g.stamp !== upd || g.mode !== 2 || g.view.hand || Math.hypot(g.view.e - o.e, g.view.n - o.n) > GUIDE_SNAP) continue;
        this.hold(o, g.view, m, CHILD_H[a]); K.led++; break; } }
    // D-292: the child in front of the woman going through its hair, the man in front of the barber
    const PR = this.pairs; PR.placed = 0; PR.alone = 0; PR.jumpMax = 0;
    for (const f of this.pairBuf) { const L = this.ps.get(f.wp), o = f.view, q = L?.view; if (!o) continue;
      if (!L || !q || L.stamp !== upd || L.mode !== 1) { PR.alone++; continue; }
      const shave = /^being shaved/.test(o.why), well = /^at the well/.test(o.why), face = shave || well, gap = shave ? PAIR_GAP.shave : well ? PAIR_GAP.well : PAIR_GAP.comb;
      // (at the well he stands off to her side and a little ahead, turned to her: she is at the water)
      const hd = (q.heading + (well ? 55 : 0)) * Math.PI / 180, e = q.e + Math.sin(hd) * gap, n = q.n + Math.cos(hd) * gap;
      PR.jumpMax = Math.max(PR.jumpMax, Math.hypot(e - o.e, n - o.n)); o.e = e; o.n = n; o.heading = face ? (q.heading + (well ? 55 : 0) + 180) % 360 : q.heading; o.moving = false; o.speed = 0; o.y = this.geo.y(e, n); PR.placed++; }
  }
  /** D-244: who a small child asleep indoors with nobody named sleeps beside: its mother when she is drawn in the same house,
   *  else the first grown member of the household drawn there (-1: none) */
  private bedside(c: PS, day: number, upd: number): number {
    const here = (q: PS | undefined) => !!q && q.stamp === upd && q.mode === 1 && !!q.spot?.inside && q.spot.plot === c.spot!.plot && !!q.view && q.view.babes!.length < 2;
    const m = this.pop.persons[c.pid].mother; if (m >= 0 && here(this.ps.get(m))) return m;
    for (const x of this.pop.membersOn(this.pop.home(c.pid, day), day)) if (x !== c.pid && this.pop.ageOn(x, day) >= 12 && here(this.ps.get(x))) return x;
    return -1;
  }
  /** a walker (`q`) holds out a hand to a smaller walker (`o`, height h m), who walks beside at HAND_GAP and reaches up */
  private hold(q: ViewPerson, o: ViewPerson, pid: number, h: number) {
    const side: 'l' | 'r' = q.babes!.some(b => b.mode === 'hip' || b.mode === 'arms') ? 'r' : 'l', sg = side === 'l' ? 1 : -1, hd = q.heading * Math.PI / 180;
    const { raise, gap } = handReach(h), e = q.e - Math.cos(hd) * gap * sg, n = q.n + Math.sin(hd) * gap * sg; // the walker's left: (−cos h, sin h) in grid (e, n)
    this.kids.handJumpMax = Math.max(this.kids.handJumpMax, Math.hypot(e - o.e, n - o.n));
    o.e = e; o.n = n; o.heading = q.heading; o.speed = q.speed; o.moving = true; o.y = this.geo.y(e, n);
    q.hand = 1; q.handWith = pid; q.handSide = side; q.handUp = 0; o.hand = 2; o.handWith = q.pid; o.handSide = side === 'l' ? 'r' : 'l'; o.handUp = raise;
  }
  /** D-215 (gap audit item 37; C): a few people with an impairment the evidence lets us expect (injuries of the building
   *  sites and the fields, old age; the ration system fed dependants): a lame man of working age walks with a staff; a
   *  blind elder feels the way with one, led by a child of the house when one walks with them. Deterministic per person;
   *  no begging is shown */
  impairOf(pid: number, day: number): 0 | 1 | 2 {
    const p = this.pop.persons[pid]; if (p.agent >= 0 || p.job === 'guard' || p.job === 'messenger') return 0;
    if (this.pop.injuryOn?.(pid, day)) return 1; // D-292 (GC23): a limp for some days after a hurt at work (C)
    const u = h32(this.seed, S.impair, pid) / 4294967296, age = this.pop.ageOn(pid, day);
    if (p.sex === 'm' && age >= IMPAIR.lame.ages[0] && age <= IMPAIR.lame.ages[1] && u < IMPAIR.lame.share) return 1;
    if (age >= IMPAIR.blind.from && u < IMPAIR.blind.share) return 2;
    return 0;
  }
  // ------------------------------------------------------------------ D-315 (UD-21): the stranger's doings (talk.ts)
  private talkV = 0;
  /** people whose plans the stranger changed: their cached plans and states are dropped (evaluated afresh) */
  private talkChanged() { const T = this.sim.talk; if (!T || T.version === this.talkV) return; const cs = T.changedSince(this.talkV); this.talkV = T.version;
    for (const pid of cs ?? [...this.ps.keys()]) { const s = this.ps.get(pid); if (s) { s.plan = s.next = s.prev = null; s.v0 = 1; s.v1 = 0; } } }
  /** the time a person is shown at: a conversation's pause holds them, then they catch up (talk.ts viewT); t otherwise */
  private tv(pid: number, t: number) { return this.sim.talk ? this.sim.talk.viewT(pid, t) : t; }
  private fpos = { e: 0, n: 0, heading: 0, moving: false };
  /** a person following the stranger or walking back their way (mode 3): true when walking */
  private followView(s: PS, t: number, day: number, upd: number): boolean {
    if (!this.sim.talk?.followPos(s.pid, t, s.w0, s.w1, !!s.back, this.fpos)) return false;
    let o = s.view; if (!o) s.view = o = PopView.blank(); this.out[this.nOut++] = o; s.stamp = upd; o.babes!.length = 0; o.hand = 0; o.impair = this.impairOf(s.pid, day);
    const F = this.fpos; o.pid = s.pid; o.agent = -1; o.hh = this.pop.home(s.pid, day); o.act = F.moving ? 'walk' : 'rest'; o.why = s.why >= 0 ? this.strings[s.why] : ''; o.place = ''; o.what = s.what; o.entry = 0; o.carryNote = null;
    o.plot = 0; o.wall = 0; o.indoor = false; o.e = F.e; o.n = F.n; o.heading = F.heading; o.moving = F.moving; o.speed = F.moving ? this.pace(s.pid) : 0; o.y = this.geo.y(o.e, o.n); o.prop = null; s.viewV = -1; s.viewMoving = o.moving;
    return o.moving;
  }
  /** D-640: one of the road folk where the register puts them now (Population.folkAt: roadFolk.ts spotOf); not drawn when the
   *  register has them off the road (home, Pārsa) */
  private folkView(s: PS, t: number, day: number, upd: number): boolean {
    const F = this.pop.folkAt(s.pid, t); if (!F) return false;
    let o = s.view; if (!o) s.view = o = PopView.blank(); this.out[this.nOut++] = o; s.stamp = upd; o.babes!.length = 0; o.hand = 0; o.impair = this.impairOf(s.pid, day);
    const own = s.act === 'sleep' || s.act === 'eat'; // (the plan's own sleep and meals by the fold: population.ts folkFold)
    o.pid = s.pid; o.agent = -1; o.hh = this.pop.home(s.pid, day); o.act = own ? s.act : F.act; o.why = own && s.why >= 0 ? this.strings[s.why] : F.why; o.place = ''; o.what = s.what; o.entry = 0; o.carryNote = null;
    o.plot = 0; o.wall = 0; o.indoor = false; o.e = F.e; o.n = F.n; o.heading = F.heading; o.moving = F.moving && !own; o.speed = o.moving ? this.pace(s.pid) : 0; o.y = this.geo.y(o.e, o.n); o.prop = propOf(o.act, null); s.viewV = -1; s.viewMoving = o.moving;
    return o.moving;
  }
  /** the people the stranger is speaking with stand and face the stranger (talk.ts: the pause of a conversation) */
  private faceStranger(t: number) {
    const T = this.sim.talk; if (!T) return; const held = T.heldNow(t); if (!held.length) return; const p = T.player ?? this.sim.player; if (!p) return;
    for (let i = 0; i < this.nOut; i++) { const o = this.out[i]; if (!held.includes(o.pid)) continue;
      o.heading = headingOf(p[0] - o.e, p[1] - o.n); o.moving = false; o.speed = 0; o.act = 'talk'; const s = this.ps.get(o.pid); if (s) s.viewV = -1; }
  }
  /** detailed agents off the Terrace: on their hidden legs through the town (the simulation's own timing, along the
   *  lanes) or at home (court or room, as the population's rule); elsewhere off the map they are not drawn */
  private legCache = new Map<string, Route | null>();
  private agentsOff(t: number) {
    let n = 0;
    for (const a of this.sim.agents) { if (!a.offmap) continue; const sp = this.agentSpot(a, t); if (!sp) continue; n++;
      const o = this.agentVp(); o.pid = a.pid; o.agent = a.id; o.hh = -1; o.babes!.length = 0; o.hand = 0; o.impair = 0; o.e = sp.e; o.n = sp.n; o.heading = sp.heading; o.moving = sp.moving; o.speed = sp.moving ? a.speed : 0; o.act = sp.moving ? 'walk' : (a.task?.act ?? 'rest'); o.why = a.task?.why ?? ''; o.place = sp.moving ? '' : a.task?.place ?? ''; o.plot = sp.plot ?? 0; o.wall = sp.wall ?? 0; o.indoor = !!sp.inside;
      o.carryNote = a.task?.holds ?? null; o.prop = propOf(o.act, o.carryNote); o.entry = 0; o.what = sp.what; o.y = this.geo.y(o.e, o.n); }
    this.stats.agentsOff = n;
  }
  private agentSpot(a: Agent, t: number): { e: number; n: number; heading: number; moving: boolean; what: string; inside?: boolean; plot?: number; wall?: number } | null {
    if (a.walking && a.travel) { const tr = a.travel, key = `${tr.from[0].toFixed(1)},${tr.from[1].toFixed(1)}>${tr.to[0].toFixed(1)},${tr.to[1].toFixed(1)}`;
      let r = this.legCache.get(key); if (r === undefined) { const A = this.geo.spotAtPoint(tr.from), B = this.geo.spotAtPoint(tr.to); r = this.geo.route(A, B) ?? null; this.legCache.set(key, r); }
      if (!r) return null; const f = Math.max(0, Math.min(1, (t - tr.t0) / Math.max(1e-9, tr.t1 - tr.t0))); routeAt(r, f * r.len, this.tmp);
      return { e: this.tmp.e, n: this.tmp.n, heading: this.tmp.heading, moving: true, what: 'on the way through the town (the simulation\'s hidden leg, along the lanes)' }; }
    const task = a.task; if (!task || !task.place.startsWith('h:')) return null;
    // (D-244: under the roof the plan puts the agent under: not drawn out of doors then)
    const d = Math.floor(t / 24), hh = t - d * 24, C = this.pop.cal?.ctx(d), seg: Seg = { t0: 0, t1: 24, place: task.place, act: task.act, why: task.why ?? '', where: 'town' };
    const indoor = C ? planIndoors(seg, C.wx, sunTimes(d), hh) : undefined;
    const sp = this.geo.spot(a.pid, task.place, task.act, d, hh, indoor); if (!sp.ok || !shown(sp) || (indoor && sp.out && !sp.roof)) return null;
    return { e: sp.e, n: sp.n, heading: sp.heading, moving: false, what: sp.what, inside: sp.inside, plot: sp.plot, wall: sp.wall };
  }
  /** update with no budgets (a test render, a jump in time): every person near the centre is placed now */
  /** the time of the last update, and the number of jumps in time so far (back, or more than a quarter hour ahead: the
   *  people are where the new time puts them, so the crowd's pop-in probe starts afresh) */
  lastT = -1; jumps = 0;
  private jumpedNow = false; private settling = false;
  settle(t: number, centre: P2) {
    this.jumps++; this.settling = true;
    const b = [this.planBudgetMs, this.routeBudgetMs, this.navBudget, this.nearR]; this.planBudgetMs = this.routeBudgetMs = this.navBudget = 1e9;
    try { this.update(t, centre); } finally { [this.planBudgetMs, this.routeBudgetMs, this.navBudget, this.nearR] = b; this.settling = false; }
  }
  /** the people out of doors within `radius` of `centre` (grid), valid until the next update (the objects are reused) */
  query(centre: P2, radius: number, out: ViewPerson[] = []): ViewPerson[] {
    out.length = 0; const r2 = radius * radius;
    for (let i = 0; i < this.nOut; i++) { const o = this.out[i], de = o.e - centre[0], dn = o.n - centre[1]; if (de * de + dn * dn <= r2) out.push(o); }
    return out;
  }
  /** everyone the last update found out of doors */
  get visible(): readonly ViewPerson[] { return this.out.slice(0, this.nOut); }
  /** the look input of a person of the population (a detailed agent keeps its own: sim.ts roster) */
  lookInput(pid: number): LookInput {
    const p = this.pop.persons[pid];
    if (p.agent >= 0) { const a = this.sim.agents[p.agent]; return { id: a.id, sex: a.sex, role: a.role, dress: a.dress as Dress, origin: a.origin, seed: a.seed, life: lifeOf(this.pop, pid, Math.floor(this.sim.t / 24)) }; }
    const day = Math.floor(this.sim.t / 24), age = this.pop.ageOn(pid, day), cl = this.pop.court?.lookOf(pid) ?? null, dress = (cl?.dress as Dress | undefined) ?? (p.pupilOf !== undefined ? 'median' : dressOf(p.job, p.sex, age, p.persian)); // (D-221: a scribe's pupil dresses as the scribes, Q-515)
    return { id: 100000 + pid, sex: p.sex, role: roleOf(p.job, p.sub), dress, origin: p.origin, seed: h32(this.seed, salt('look'), pid) % 1000000000, age: age < 12 ? 'child' : age >= 58 ? 'elder' : 'adult', life: lifeOf(this.pop, pid, day),
      ...(cl ? { delegation: cl.delegation, pieces: cl.pieces, beardless: cl.beardless, stature: cl.stature } : {}) }; // (D-199: the court setting's delegations, king and attendants)
  }
  /** a child's standing height by age (m; C: a modern growth-chart median, the body is the child variant scaled) */
  childStature(pid: number): number | null { const age = this.pop.ageOn(pid, Math.floor(this.sim.t / 24)); if (age >= 12) return null; return CHILD_H[Math.max(0, Math.min(11, age))] * (1 + 0.06 * (h32(this.seed, salt('child-h'), pid) / 4294967296 - 0.5)); } // (s18 C14 D-790: +-3 % per child: no two of an age alike)
  /** D-244: the view's state of a person (the renderless trace, tools/dev/people_trace.ts): 0 not drawn, 1 at a spot, 2
   *  walking; the spot (on a walk, where it goes) and its description; null when the person is not a candidate */
  stateOf(pid: number): { mode: 0 | 1 | 2 | 3 | 4; spot: Spot | null; what: string } | null { const s = this.ps.get(pid); return s ? { mode: s.mode, spot: s.spot, what: s.what } : null; }
  /** the plan's description of a person now (dev overlay) */
  describe(pid: number): string { const s = this.ps.get(pid); return s ? `${s.what}${s.mode === 2 ? `, ${s.speed.toFixed(2)} m/s` : ''}` : 'not near'; }
}
/** D-315: the place a walk back along the stranger's way leads to (its plan place without the mark) */
function backPlace(p: string) { return p.startsWith('@back:') ? p.slice(6) : p; }
/** standing height (m) at ages 0-11 (C: growth-chart medians, both sexes; no skeletal series from Fars was read, Q-066) */
export const CHILD_H = [0.7, 0.76, 0.87, 0.96, 1.03, 1.1, 1.16, 1.22, 1.28, 1.33, 1.38, 1.44];
const fmtH = (h: number) => { const H = Math.floor(h), M = Math.round((h - H) * 60); return `${String(H).padStart(2, '0')}:${String(M % 60).padStart(2, '0')}`; };
