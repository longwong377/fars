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
import type { Population, Seg } from './population';
import type { PeopleSim, Agent } from './sim';
import { ACTIVITIES, type ActivityId } from './activities';
import { PopGeo, routeAt, headingOf, type Spot, type Route } from './popgeo';
import { sunTimes } from './calendar';
import { h32, salt } from './hash';
import type { P2 } from './navgrid';
import type { LookInput } from './looks';
import type { Dress } from './body';

export interface ViewPerson {
  pid: number; e: number; n: number; y: number; heading: number;
  act: ActivityId; moving: boolean;
  /** the plan's reason for the block (population.ts `Seg.why`): the crowd resolves the performance's variant from it
   *  (activities.ts performanceFor, D-142) */
  why: string;
  /** a carried thing the crowd can draw (props.ts kinds), or null; `carryNote` is the plan's own words */
  prop: 'sack' | 'jar' | 'jar_head' | 'basket' | 'tablet' | 'spear' | null; carryNote: string | null;
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
}
interface DayPlan { day: number; n: number; t1: Float32Array; place: Int32Array; act: Uint8Array; why: Int32Array; where: Uint8Array; carry: Int32Array; withP: Int32Array }
interface PS {
  pid: number; home: P2; work: P2 | null; d2: number;
  plan: DayPlan | null; next: DayPlan | null; prev: DayPlan | null;
  /** cached state and the absolute hours it holds for */
  v0: number; v1: number; mode: 0 | 1 | 2; spot: Spot | null; route: Route | null; w0: number; w1: number; wOut: boolean;
  act: ActivityId; carry: number; speed: number; what: string; entry: number;
  /** the plan's reason for the act shown (string index; -1 none) */
  why: number;
  spots: Map<number, Spot>;
  /** standing: ground height and carried prop, computed once per state */
  y: number; prop: ViewPerson['prop']; yOk: boolean;
  /** where the person stands at their spot (clear of the others standing there), since when, the occupancy cell held, and
   *  the mode of the last update (a walker arriving steps from the spot to it) */
  sepFor: Spot | null; sepE: number; sepN: number; sepT: number; occ: number; lastMode: number;
}
const ACTS = Object.keys(ACTIVITIES) as ActivityId[]; const ACT_IX = new Map(ACTS.map((a, i) => [a, i]));
const WHERE = ['terrace', 'town', 'plain', 'road', 'away'] as const; const W_IX = new Map<string, number>(WHERE.map((w, i) => [w, i])); const ROAD = 3, AWAY = 4;
const S = { pace: salt('popview-pace'), sep: salt('popview-sep') };
/** people standing keep at least this far apart (m, C: shoulder to shoulder); an arriving walker takes STEP_S to step aside */
export const SEP = 0.6; const STEP_S = 2;
/** slowest walk shown (m/s); below it the person walks at their own pace and leaves late (C) */
export const MIN_PACE = 0.75;
/** walks faster than this are counted as hurried (C: brisk walking) */
export const MAX_PACE = 1.8;
/** carried things the crowd has a prop for, from the plan's words (§9.5 goods are physical) */
export function propOf(act: ActivityId, carry: string | null): ViewPerson['prop'] {
  const P = ACTIVITIES[act].prop; if (P) return P === 'bread' ? 'basket' : P as ViewPerson['prop'];
  if (!carry) return null; const c = carry.toLowerCase();
  if (/jar/.test(c) && /head|water/.test(c)) return 'jar_head'; if (/\bjar\b|jug/.test(c)) return 'jar';
  if (/sack|grain|flour/.test(c)) return 'sack'; if (/basket|bread|loaves|dung cakes|fruit|figs/.test(c)) return 'basket';
  if (/tablet|letter/.test(c)) return 'tablet'; if (/spear/.test(c)) return 'spear';
  return null;
}
/** the dress a person of the population wears (C: by job, sex and age; the detailed agents' roster rules, sim.ts) */
export function dressOf(job: string, sex: 'm' | 'f', age: number, persian: boolean): Dress {
  if (age < 12) return 'child'; if (sex === 'f') return 'woman';
  if (job === 'guard') return persian ? 'guard' : 'median';
  if (job === 'official' || job === 'steward' || job === 'priest') return 'persian';
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
  /** the plan computation budget per update (ms) and the Terrace route searches per update */
  planBudgetMs = 3; navBudget = 1;
  /** route searches per update (ms): beyond it, people farther than `nearR` wait at the place they are leaving (they
   *  then walk faster to arrive on time); nearer people always get their route */
  routeBudgetMs = 3; nearR = 150;
  readonly stats = { candidates: 0, planned: 0, planMs: 0, pending: 0, visible: 0, walking: 0, hurried: 0, lateLeaves: 0, steps: 0, hidden: 0, unresolved: 0, routeWait: 0, agentsOff: 0, evalMs: 0, updates: 0, carried: 0, nanTimes: 0, spread: 0, crowded: 0 };
  private out: ViewPerson[] = []; private nOut = 0;
  private anchorsBuilt = false; private homes: Float64Array | null = null;
  constructor(readonly sim: PeopleSim, readonly geo: PopGeo, readonly seed = 1) { this.pop = sim.pop; }
  private str(s: string) { let i = this.strIx.get(s); if (i === undefined) { i = this.strings.length; this.strings.push(s); this.strIx.set(s, i); } return i; }
  /** each person's home and work anchor (grid), for choosing who can be near */
  private buildAnchors() {
    const P = this.pop, n = P.persons.length, A = new Float64Array(n * 4).fill(NaN); const TER: P2 = [80, -10];
    const homeOf = new Map<number, P2>();
    for (const H of P.households) { let xy: P2 | null = null;
      if (H.zone === 'town') xy = H.xy; else if (H.zone === 'plain') { const m = this.geo.villageOf(H.id); xy = m ? (() => { const v = (this.geo as any).villages[m.vi]; return [v.x, v.y] as P2; })() : null; }
      else if (H.zone === 'terrace') xy = TER; else xy = H.home === 'station' ? [-1450, 395] : [-3000, 0];
      if (xy) homeOf.set(H.id, xy); }
    for (const p of P.persons) { const h = homeOf.get(p.hh) ?? homeOf.get(p.hh2); if (h) { A[p.id * 4] = h[0]; A[p.id * 4 + 1] = h[1]; }
      const terraceWork = p.zone === 'terrace' || ['builder', 'porter', 'camp', 'caretaker', 'guard'].includes(p.job) || p.work === 'treasury_inside' || p.work === 'treasury_store' || p.work === 'treasury_desk';
      if (terraceWork) { A[p.id * 4 + 2] = TER[0]; A[p.id * 4 + 3] = TER[1]; } }
    this.homes = A; this.anchorsBuilt = true;
  }
  /** keep the people who can be within `radius` of the centre (home or work place within radius + margin) */
  private recentre(c: P2) {
    if (!this.anchorsBuilt) this.buildAnchors(); this.centre = [c[0], c[1]];
    const A = this.homes!, R = this.radius + this.margin, keep = new Map<number, PS>();
    for (let pid = 0; pid < this.pop.persons.length; pid++) {
      const hx = A[pid * 4], hy = A[pid * 4 + 1], wx = A[pid * 4 + 2], wy = A[pid * 4 + 3];
      const dh = Number.isFinite(hx) ? Math.hypot(hx - c[0], hy - c[1]) : Infinity, dw = Number.isFinite(wx) ? Math.hypot(wx - c[0], wy - c[1]) : Infinity, d = Math.min(dh, dw);
      if (d > R) continue;
      let s = this.ps.get(pid);
      if (!s) s = { pid, home: [hx, hy], work: Number.isFinite(wx) ? [wx, wy] : null, d2: 0, plan: null, next: null, prev: null, v0: 1, v1: 0, mode: 0, spot: null, route: null, w0: 0, w1: 0, wOut: true, act: 'rest', carry: -1, speed: 0, what: '', entry: 0, why: -1, spots: new Map(), y: 0, prop: null, yOk: false, sepFor: null, sepE: 0, sepN: 0, sepT: -1e9, occ: -1, lastMode: 0 };
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
  /** the person's spot at segment i of a plan (memoised per place and indoor/outdoor) */
  private spotAt(s: PS, P: DayPlan, i: number): Spot {
    const place = this.strings[P.place[i]], act = ACTS[P.act[i]], h = (this.segT0(P, i) + P.t1[i]) / 2, sun = sunTimes(P.day), dark = h < sun.rise - 0.25 || h > sun.set + 0.6;
    const indoor = act === 'sleep' || act === 'lie_ill' || act === 'offmap' || (dark && act === 'rest');
    const key = P.place[i] * 2 + (indoor ? 1 : 0); let sp = s.spots.get(key);
    if (!sp) { sp = this.geo.spot(s.pid, place, act, P.day, h); s.spots.set(key, sp); }
    return sp;
  }
  private pace(pid: number) { return 1.1 + 0.3 * (h32(this.seed, S.pace, pid) / 4294967296); }
  /** the cached state of a person at absolute time t (hours) */
  private evaluate(s: PS, t: number) {
    const d = Math.floor(t / 24), h = t - d * 24; s.entry = 0; s.yOk = false;
    if (!this.pop.present(s.pid, d)) { s.mode = 0; s.v0 = t; s.v1 = d * 24 + 24; s.what = 'not here today'; return; }
    const P = this.planOf(s, d); if (!P) { s.mode = 0; s.v0 = t; s.v1 = t; this.stats.pending++; return; }
    const i = this.segIx(P, h), base = d * 24;
    const hide = (until: number, why: string) => { s.mode = 0; s.v0 = t; s.v1 = until; s.what = why; };
    if (P.where[i] === AWAY) return hide(base + P.t1[i], 'away');
    if (P.where[i] === ROAD) {
      let i0 = i, i1 = i; while (i0 > 0 && P.where[i0 - 1] === ROAD) i0--; while (i1 < P.n - 1 && P.where[i1 + 1] === ROAD) i1++;
      const T0 = base + this.segT0(P, i0), T1 = base + P.t1[i1];
      let from: Spot | null = null, to: Spot | null = null;
      if (i0 > 0) from = this.spotAt(s, P, i0 - 1); else { const Q = this.planOf(s, d - 1, true); if (Q) { let k = Q.n - 1; while (k > 0 && Q.where[k] === ROAD) k--; from = this.spotAt(s, Q, k); } }
      if (i1 < P.n - 1) to = this.spotAt(s, P, i1 + 1); else { const Q = this.planOf(s, d + 1, true); if (Q) { let k = 0; while (k < Q.n - 1 && Q.where[k] === ROAD) k++; to = this.spotAt(s, Q, k); } }
      if (!from?.ok || !to?.ok) { this.stats.unresolved++; return hide(T1, `walking between places not built (${from?.what ?? '?'} → ${to?.what ?? '?'})`); }
      const r = this.routeFor(s, from, to);
      if (r === undefined) { this.stats.routeWait++; if (from.out) { s.mode = 1; s.spot = from; s.route = null; s.act = i0 > 0 ? ACTS[P.act[i0 - 1]] : 'rest'; s.why = i0 > 0 ? P.why[i0 - 1] : -1; s.carry = -1; s.speed = 0; s.what = `${from.what} (waiting for a route)`; } else s.mode = 0; s.v0 = t; s.v1 = t; return; } // over this update's search budget: ask again
      if (r === null) { this.stats.unresolved++; return hide(T1, `no route ${from.what} → ${to.what}`); }
      const D = (T1 - T0) * 3600, v = r.len / Math.max(1, D), nat = this.pace(s.pid);
      let S0 = T0; if (v < MIN_PACE) { S0 = T1 - r.len / nat / 3600; this.stats.lateLeaves++; } else if (v > MAX_PACE) this.stats.hurried++;
      if (t < S0) { // not yet gone: still at the place before, doing what was done there
        s.mode = from.out ? 1 : 0; s.spot = from; s.route = null; s.v0 = T0; s.v1 = S0; s.act = i0 > 0 ? ACTS[P.act[i0 - 1]] : 'rest'; s.why = i0 > 0 ? P.why[i0 - 1] : -1; s.carry = -1; s.speed = 0; s.what = `${from.what} (leaves ${fmtH(S0 - base)})`; return; }
      s.mode = 2; s.route = r; s.w0 = S0; s.w1 = T1; s.wOut = true; s.spot = to; s.v0 = Math.max(T0, base + this.segT0(P, i)); s.v1 = Math.min(T1, base + P.t1[i]);
      s.act = ACTS[P.act[i]]; s.why = P.why[i]; s.carry = P.carry[i]; s.speed = r.len / Math.max(1, (T1 - S0) * 3600); s.what = `walking: ${from.what} → ${to.what} (${r.len.toFixed(0)} m)`;
      if (!from.out) s.entry = 1; return;
    }
    const sp = this.spotAt(s, P, i); if (!sp.ok) { this.stats.unresolved++; return hide(base + P.t1[i], sp.what); }
    const t0 = base + this.segT0(P, i);
    let ip = i - 1; while (ip > 0 && P.where[ip] === ROAD && P.t1[ip] <= this.segT0(P, ip)) ip--; // a zero-length walk (repaired NaN times) is no walk
    if (i > 0 && ip >= 0 && P.where[ip] !== ROAD && P.where[ip] !== AWAY) { // a change of place with no walk in the plan: walked from the start of the block
      const pr = this.spotAt(s, P, ip);
      if (pr.ok && Math.hypot(pr.e - sp.e, pr.n - sp.n) > 0.8 && (pr.out || sp.out)) {
        const r = this.routeFor(s, pr, sp);
        if (r === undefined) { this.stats.routeWait++; s.mode = pr.out ? 1 : 0; s.spot = pr; s.route = null; s.v0 = t; s.v1 = t; return; }
        if (r) { const dur = r.len / this.pace(s.pid) / 3600, t1 = Math.min(base + P.t1[i], t0 + dur);
          if (t < t1) { this.stats.steps++; s.mode = 2; s.route = r; s.w0 = t0; s.w1 = t1; s.wOut = true; s.spot = sp; s.v0 = t0; s.v1 = t1; s.act = 'walk'; s.why = P.why[i]; s.carry = -1; s.speed = r.len / Math.max(1, (t1 - t0) * 3600); s.what = `stepping ${pr.what} → ${sp.what}`; if (!pr.out) s.entry = 1; return; }
          s.v0 = t1; } } }
    s.mode = sp.out ? 1 : 0; s.spot = sp; s.route = null; if (s.v0 < t0 || s.v0 > t) s.v0 = t0; s.v1 = base + P.t1[i];
    s.act = ACTS[P.act[i]]; s.why = P.why[i]; s.carry = P.carry[i]; s.speed = 0; s.what = sp.what;
    if (sp.out && i > 0) { const pr = P.where[i - 1] === ROAD ? null : this.spotAt(s, P, i - 1); if (pr && !pr.out) s.entry = 1; }
    if (!sp.out) this.stats.hidden++;
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
    if (this.lastT >= 0 && (t < this.lastT - 1e-6 || t - this.lastT > 0.25)) this.jumps++; this.lastT = t;
    if (Math.hypot(centre[0] - this.centre[0], centre[1] - this.centre[1]) > 300) this.recentre(centre);
    this.budgetLeft = this.planBudgetMs; this.tPlan = performance.now(); this.navLeft = this.navBudget; this.routeT = 0;
    const d = Math.floor(t / 24), h = t - d * 24; this.stats.pending = 0;
    // plan the nearest first (the list is sorted by distance); tomorrow's plans in the last hour of the day
    for (const s of this.list) {
      if (s.v0 <= t && t < s.v1 && (s.mode !== 0 || s.v1 > t)) continue;
      if (performance.now() - this.tPlan > this.budgetLeft && s.plan?.day !== d && s.next?.day !== d) { this.stats.pending++; continue; }
      this.evaluate(s, t);
    }
    if (h > 23 && performance.now() - this.tPlan < this.budgetLeft) for (const s of this.list) { if (performance.now() - this.tPlan > this.budgetLeft) break; if (s.plan?.day === d && !s.next && this.pop.present(s.pid, d + 1)) this.planOf(s, d + 1); }
    this.collect(t);
    this.stats.evalMs = performance.now() - t0;
  }
  private vp(): ViewPerson { let o = this.out[this.nOut]; if (!o) { o = { pid: -1, e: 0, n: 0, y: 0, heading: 0, act: 'rest', moving: false, why: '', prop: null, carryNote: null, speed: 0, entry: 0, what: '', agent: -1, plot: 0, wall: 0 }; this.out[this.nOut] = o; } this.nOut++; return o; }
  private tmp = { e: 0, n: 0, heading: 0 };
  private collect(t: number) {
    this.nOut = 0; let walking = 0, carried = 0; const day = Math.floor(t / 24);
    this.agentOcc.clear(); for (const a of this.sim.agents) if (!a.offmap) { const k = this.occKey(a.pos[0], a.pos[1]); const L = this.agentOcc.get(k); if (L) L.push(a); else this.agentOcc.set(k, [a]); }
    for (const s of this.list) {
      const last = s.lastMode; s.lastMode = s.mode;
      if (s.occ >= 0 && (s.mode !== 1 || s.sepFor !== s.spot)) this.release(s);
      if (s.mode === 0 || !s.spot) continue; if (this.pop.persons[s.pid].agent >= 0) continue; // detailed agents: below
      // infants are held, nursed or carried on the back (their plan's place is the carer's): no body is drawn for a
      // carried child (C; counted); from one year a child is drawn when it plays or walks by itself
      if (this.pop.persons[s.pid].age < 3 && this.young(s.pid, day, s)) { carried++; continue; }
      const o = this.vp(); o.pid = s.pid; o.agent = -1; o.act = s.act; o.why = s.why >= 0 ? this.strings[s.why] : ''; o.what = s.what; o.entry = s.entry; o.carryNote = s.carry >= 0 ? this.strings[s.carry] : null;
      o.plot = s.mode === 1 ? s.spot.plot ?? 0 : 0; o.wall = s.mode === 1 ? s.spot.wall ?? 0 : 0;
      if (s.mode === 2 && s.route) { const f = Math.max(0, Math.min(1, (t - s.w0) / Math.max(1e-9, s.w1 - s.w0))); routeAt(s.route, f * s.route.len, this.tmp); o.e = this.tmp.e; o.n = this.tmp.n; o.heading = this.tmp.heading; o.moving = true; o.speed = s.speed; walking++;
        if (!ACTIVITIES[o.act].moving) o.act = 'walk'; o.y = this.geo.y(o.e, o.n); o.prop = propOf(o.act, o.carryNote); }
      else {
        if (s.sepFor !== s.spot) { this.separate(s, t, last === 2); s.yOk = false; }
        const sp = s.spot, k = (t - s.sepT) * 3600 / STEP_S;
        if (k >= 0 && k < 1 && (s.sepE !== sp.e || s.sepN !== sp.n)) { // just arrived: stepping aside from the spot
          o.e = sp.e + (s.sepE - sp.e) * k; o.n = sp.n + (s.sepN - sp.n) * k; o.heading = headingOf(s.sepE - sp.e, s.sepN - sp.n); o.moving = true; o.speed = Math.hypot(s.sepE - sp.e, s.sepN - sp.n) / STEP_S;
          o.y = this.geo.y(o.e, o.n, sp.net); o.prop = propOf(o.act, o.carryNote); walking++; continue; }
        o.e = s.sepE; o.n = s.sepN; o.heading = sp.heading; o.moving = false; o.speed = 0;
        if (!s.yOk) { s.y = this.geo.y(o.e, o.n, sp.net); s.prop = propOf(o.act, o.carryNote); s.yOk = true; } o.y = s.y; o.prop = s.prop; }
    }
    this.agentsOff(t);
    this.stats.visible = this.nOut; this.stats.walking = walking; this.stats.carried = carried;
  }
  /** standing places held (1 m cells of grid metres → the people holding them) */
  private occ = new Map<number, number[]>();
  private occKey(e: number, n: number) { return (Math.floor(e) + 60000) * 131072 + (Math.floor(n) + 60000); }
  private release(s: PS) {
    if (s.occ >= 0) { const L = this.occ.get(s.occ); if (L) { const i = L.indexOf(s.pid); if (i >= 0) L.splice(i, 1); if (!L.length) this.occ.delete(s.occ); } }
    s.occ = -1; s.sepFor = null;
  }
  /** nobody else stands within SEP of (e, n): the population's people standing, the detailed agents on the map */
  private freeAt(e: number, n: number, pid: number): boolean {
    const fx = Math.floor(e), fy = Math.floor(n);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const L = this.occ.get((fx + dx + 60000) * 131072 + (fy + dy + 60000)); if (!L) continue;
      for (const q of L) { if (q === pid) continue; const o = this.ps.get(q); if (o && Math.hypot(o.sepE - e, o.sepN - n) < SEP) return false; } }
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const L = this.agentOcc.get((fx + dx + 60000) * 131072 + (fy + dy + 60000)); if (!L) continue;
      for (const a of L) if (Math.hypot(a.pos[0] - e, a.pos[1] - n) < SEP) return false; }
    return true;
  }
  /** the detailed agents on the map by 1 m cell (rebuilt each update) */
  private agentOcc = new Map<number, Agent[]>();
  /** where the person stands at their spot: the spot, or when someone already stands there the nearest clear place on
   *  rings around it (0.63 m apart, to 5 m; C), reached by a short straight step that stays in the same court, yard or
   *  open ground (popgeo.stepClear). Counted: `stats.spread`, and `stats.crowded` when no ring has room */
  private separate(s: PS, t: number, arriving: boolean) {
    this.release(s); const sp = s.spot!; let e = sp.e, n = sp.n;
    if (!this.freeAt(e, n, s.pid)) { let found = false; const ph = h32(this.seed, S.sep, s.pid) / 4294967296 * Math.PI * 2;
      for (let ring = 1; ring <= 8 && !found; ring++) { const m = 6 * ring; for (let k = 0; k < m && !found; k++) { const a = ph + (k / m) * Math.PI * 2, r = SEP * 1.05 * ring, e2 = sp.e + Math.cos(a) * r, n2 = sp.n + Math.sin(a) * r;
        if (this.freeAt(e2, n2, s.pid) && this.geo.stepClear(sp, [e2, n2])) { e = e2; n = n2; found = true; } } }
      if (found) this.stats.spread++; else this.stats.crowded++; }
    s.sepE = e; s.sepN = n; s.sepFor = sp; s.sepT = arriving ? t : -1e9; s.occ = this.occKey(e, n);
    const L = this.occ.get(s.occ); if (L) L.push(s.pid); else this.occ.set(s.occ, [s.pid]);
  }
  /** a child under three who is not drawn now: under one always (in arms, nursing, on the back); at one and two when
   *  resting, eating or asleep with its carer, or carried on the way */
  private young(pid: number, day: number, s: PS): boolean {
    const age = this.pop.ageOn(pid, day); if (age >= 3) return false; if (age < 1) return true;
    return !(s.act === 'play' || (s.mode === 2 && s.act === 'walk'));
  }
  /** detailed agents off the Terrace: on their hidden legs through the town (the simulation's own timing, along the
   *  lanes) or at home (court or room, as the population's rule); elsewhere off the map they are not drawn */
  private legCache = new Map<string, Route | null>();
  private agentsOff(t: number) {
    let n = 0;
    for (const a of this.sim.agents) { if (!a.offmap) continue; const sp = this.agentSpot(a, t); if (!sp) continue; n++;
      const o = this.vp(); o.pid = a.pid; o.agent = a.id; o.e = sp.e; o.n = sp.n; o.heading = sp.heading; o.moving = sp.moving; o.speed = sp.moving ? a.speed : 0; o.act = sp.moving ? 'walk' : (a.task?.act ?? 'rest'); o.why = a.task?.why ?? ''; o.plot = 0; o.wall = 0;
      o.carryNote = a.task?.holds ?? null; o.prop = propOf(o.act, o.carryNote); o.entry = 0; o.what = sp.what; o.y = this.geo.y(o.e, o.n); }
    this.stats.agentsOff = n;
  }
  private agentSpot(a: Agent, t: number): { e: number; n: number; heading: number; moving: boolean; what: string } | null {
    if (a.walking && a.travel) { const tr = a.travel, key = `${tr.from[0].toFixed(1)},${tr.from[1].toFixed(1)}>${tr.to[0].toFixed(1)},${tr.to[1].toFixed(1)}`;
      let r = this.legCache.get(key); if (r === undefined) { const A = this.geo.spotAtPoint(tr.from), B = this.geo.spotAtPoint(tr.to); r = this.geo.route(A, B) ?? null; this.legCache.set(key, r); }
      if (!r) return null; const f = Math.max(0, Math.min(1, (t - tr.t0) / Math.max(1e-9, tr.t1 - tr.t0))); routeAt(r, f * r.len, this.tmp);
      return { e: this.tmp.e, n: this.tmp.n, heading: this.tmp.heading, moving: true, what: 'on the way through the town (the simulation\'s hidden leg, along the lanes)' }; }
    const task = a.task; if (!task || !task.place.startsWith('h:')) return null;
    const d = Math.floor(t / 24), sp = this.geo.spot(a.pid, task.place, task.act, d, t - d * 24); if (!sp.ok || !sp.out) return null;
    return { e: sp.e, n: sp.n, heading: sp.heading, moving: false, what: sp.what };
  }
  /** update with no budgets (a test render, a jump in time): every person near the centre is placed now */
  /** the time of the last update, and the number of jumps in time so far (back, or more than a quarter hour ahead: the
   *  people are where the new time puts them, so the crowd's pop-in probe starts afresh) */
  lastT = -1; jumps = 0;
  settle(t: number, centre: P2) {
    this.jumps++;
    const b = [this.planBudgetMs, this.routeBudgetMs, this.navBudget, this.nearR]; this.planBudgetMs = this.routeBudgetMs = this.navBudget = 1e9;
    try { this.update(t, centre); } finally { [this.planBudgetMs, this.routeBudgetMs, this.navBudget, this.nearR] = b; }
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
    if (p.agent >= 0) { const a = this.sim.agents[p.agent]; return { id: a.id, sex: a.sex, role: a.role, dress: a.dress as Dress, origin: a.origin, seed: a.seed }; }
    const day = Math.floor(this.sim.t / 24), age = this.pop.ageOn(pid, day), dress = dressOf(p.job, p.sex, age, p.persian);
    return { id: 100000 + pid, sex: p.sex, role: roleOf(p.job, p.sub), dress, origin: p.origin, seed: h32(this.seed, salt('look'), pid) % 1000000000, age: age < 12 ? 'child' : age >= 58 ? 'elder' : 'adult' };
  }
  /** a child's standing height by age (m; C: a modern growth-chart median, the body is the child variant scaled) */
  childStature(pid: number): number | null { const age = this.pop.ageOn(pid, Math.floor(this.sim.t / 24)); if (age >= 12) return null; return CHILD_H[Math.max(0, Math.min(11, age))]; }
  /** the plan's description of a person now (dev overlay) */
  describe(pid: number): string { const s = this.ps.get(pid); return s ? `${s.what}${s.mode === 2 ? `, ${s.speed.toFixed(2)} m/s` : ''}` : 'not near'; }
}
/** standing height (m) at ages 0-11 (C: growth-chart medians, both sexes; no skeletal series from Fars was read, Q-066) */
export const CHILD_H = [0.7, 0.76, 0.87, 0.96, 1.03, 1.1, 1.16, 1.22, 1.28, 1.33, 1.38, 1.44];
const fmtH = (h: number) => { const H = Math.floor(h), M = Math.round((h - H) * 60); return `${String(H).padStart(2, '0')}:${String(M % 60).padStart(2, '0')}`; };
