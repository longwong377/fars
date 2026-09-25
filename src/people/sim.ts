// People simulation (Phase 3 slice, Phase 5 population; no renderer dependencies, so it can move into a worker).
// Two tiers (DECISIONS D-021):
//  - the POPULATION (population.ts): everyone who lived on the Terrace, in the town and in the plain (~44,000, court
//    absent), with homes, households, ration groups, work gangs and a day plan per person that is a pure function of
//    (seed, person, day) and the calendar (calendar.ts: rations, deliveries, couriers, offerings, weather, the harvest
//    round, construction, births, deaths, sickness, disputes);
//  - the DETAILED AGENTS below: the Terrace slice (the garrison of 100, a squad of stonecutters, porters, scribes, the
//    work-camp women and children, messengers, officials). Each is a person of the population and follows the same day
//    plan; on the Terrace the plan block is filled with fine-grained decisions that walk the real grid. Off the Terrace
//    (at home in the town, on the road, in the plain) they are hidden but still where the plan says, doing what it says.
// Every decision draws from a random stream keyed by (world seed, person, day, decision number), so outcomes do not
// depend on frame rate or step size. Goods are counted: porters move real sacks from the depot at the stair foot to the
// Treasury store; the calendar keeps the town's stores.
import placesData from '../data/people_places.json';
import namesData from '../data/names.json';
import namesRecalled from '../data/names_recalled.json';
import livesData from '../data/lives.json';
import { Rng } from '../core/rng';
import type { NavGrid, P2 } from './navgrid';
import { ACTIVITIES, ActivityId } from './activities';
import type { Dress } from './body';
import { EventCalendar, sunTimes as sunT } from './calendar';
import { Population, Seg, segAt, GUARD_POSTS, SliceSeat, TERRACE_ABSTRACT, TOWN_SITES, HEARTHS } from './population';
import { hall100Layout, colPlace } from './construction';
import { PlayerMemory, Encounter } from './memory';
import { COURT_PLACES, COURT_PRIVATE } from './court'; // D-182 hook (D-199: the king's rooms)

export type Role = 'guard' | 'mason' | 'foreman' | 'porter' | 'scribe' | 'baker' | 'grinder' | 'child' | 'courier' | 'official';
export interface Place { id: string; kind: string; at: P2; heading?: number; span?: [P2, P2]; tier: string; note: string; /** a column's centre (generated work places) */ c?: P2 }
/** work spots on the Hall of a Hundred Columns, generated from the spec (D-022): beside each hall column (fluting after
 *  erection) and just inside each doorway (the doorway reliefs); all C, all checked walkable by tests/people.test.ts */
const H100 = hall100Layout();
const GENERATED: Place[] = [
  ...H100.hall.map((c, i) => ({ id: colPlace(i), kind: 'work', at: [c[0] + 1.6, c[1]] as P2, c, heading: 270, tier: 'C', note: `beside column ${i + 1} of the Hall of a Hundred Columns (fluting after erection, C)` })),
  ...H100.doors.map((d: any) => { const inx = Math.sign(H100.centre[0] - d.at[0]), iny = Math.sign(H100.centre[1] - d.at[1]); const ns = d.wall === 'N' || d.wall === 'S';
    const at: P2 = ns ? [d.at[0] - 2.2, d.at[1] + iny * 2.2] : [d.at[0] + inx * 2.2, d.at[1] - 2.2];
    return { id: `h100_door_${d.id}`, kind: 'work', at, heading: ns ? (iny < 0 ? 180 : 0) : (inx > 0 ? 90 : 270), tier: 'C', note: `inside doorway ${d.id} of the Hall of a Hundred Columns, where its reliefs are carved (door reliefs BRIT-H100 B; progress C)` }; }),
];
export const PLACES: Record<string, Place> = Object.fromEntries([...(placesData as any).places as Place[], ...GENERATED, ...COURT_PLACES /* D-182 hook: the court's places (court.ts) */, ...COURT_PRIVATE].map((p: Place) => [p.id, p]));

export interface Env { rain: number; lightning: boolean; windMs: number; tempC: number; dust?: number }
/** `off`: the task is off the rendered Terrace (in the town, on the road, in the plain): the person is hidden */
export interface Task { act: ActivityId; place: string; spot: P2; heading: number | null; until: number /* sim hours */; why: string; off?: boolean;
  /** what the plan says the person carries in this block (population.ts Seg.carry: tools, arms, a letter); the physical
   *  load the renderer shows is Agent.carry */
  holds?: string;
  /** how the plan says the person is dressed against the weather (population.ts Seg.wear: W-03's wrapped face); not drawn yet */
  wears?: string;
  /** off the Terrace: where the hidden person goes on from the town edge (the lane exit of the house's quarter, then its
   *  street door: town_plots.json), travelled abstractly at walking pace (D-081) */
  legs?: P2[] }
export interface Agent {
  id: number; name: string | null; nameNote: string; nameTier: string; sex: 'm' | 'f'; origin: string; langs: string[];
  role: Role; dress: Dress; household: number; ties: number[]; ration: { qaPerMonth: number; tier: string };
  post?: string; shift?: number; home: string; slot: P2; speed: number; seed: number;
  /** this person in the population (population.ts) */
  pid: number;
  // dynamic state
  pos: P2; y: number; heading: number; task: Task | null; path: P2[] | null; pathI: number; walking: boolean;
  carry: null | 'sack' | 'jar' | 'jar_head' | 'basket'; hunger: number; fatigue: number; sick: boolean;
  /** a porter's day of his last load (the first of the day is not "the next"); a baker's kneading block that has drawn its
   *  flour (S6, S7 r5) */
  loadDay?: number; kneadKey?: string;
  /** a camp woman found no sack to carry on her last carrying block (S6 r5) */
  emptyCarry?: boolean;
  /** where a camp woman's sack in hand is going (its stock) */
  sackTo?: 'querns' | 'oven';
  day: number; decisions: number; metPlayer: number; lastMetDay: number; gait: number; offmap: boolean; relieved: boolean;
  /** end of the current watch (a guard stays at the post until relieved) */
  watchEnd?: number;
  /** waiting for a route search (over the step's search budget): stays where it is and asks again next step */
  waitRoute?: boolean;
  /** simulation LOD (brief §9.2 continuity, §9.5): 'full' walks nav-grid paths; 'abstract' (far from the player, and the
   *  headless soak) makes the same decisions but travels as a timed straight-line move (distance × detour / speed) */
  lod?: 'full' | 'abstract'; travel?: { from: P2; to: P2; t0: number; t1: number } | null;
  /** the hidden legs still to go in the town (see Task.legs) */
  legs?: P2[];
  /** the posts still to visit on the current round, and the plan block it belongs to (S3) */
  round?: string[]; roundKey?: string;
}
/** straight-line → walked-route factor for abstract travel (C: the Terrace's stairs and doorways add detours) */
export const ABSTRACT_DETOUR = 1.3;
export interface SimEvent { t: number; kind: string; text: string; place: string; id?: string; tier?: string }
export interface SimOpts { /** the out-of-world setting 'Court calendar = seasonal pattern' (D-003); default false (court ABSENT) */ court?: boolean }

const H_PER_S = 1 / 3600;
/** the slice's goods at the start (C): the Treasury's sacks at the depot and in its store; the camp's barley at the depot
 *  and at the querns, its ground flour and the ovens' flour (sacks of 3 BAR) */
export const INITIAL_STOCK = { depot: 30, store: 120, grain: 8, querns: 10, flour: 2, oven: 6 };
const CW = (livesData as any).camp_women_needed;
/** sunrise/sunset in local solar hours for a day of the regnal year (see calendar.ts) */
export const sunTimes = sunT;
const FAM = (livesData as any).familiarity;

/** name pools from names.json (attested only; brief §9.1). Origins with no attested names give `null` (honestly unnamed). */
const NAMES = [...(namesData as any).names, ...(namesRecalled as any).names].filter((n: any) => !n.notable && !n.reading_uncertain) as { name: string; sex: string; origin_guess: string; tier: string; texts?: string[]; attestation?: string }[];
function pickName(rng: Rng, sex: 'm' | 'f', origins: string[], used: Set<string>) {
  const pool = NAMES.filter(n => n.sex === sex && origins.includes(n.origin_guess) && !used.has(n.name));
  if (!pool.length) return null;
  const n = rng.pick(pool); used.add(n.name); return n.texts ? { name: n.name, tier: n.tier.startsWith('A') ? 'A' : 'B', note: `attested ${n.texts.slice(0, 2).join(', ')}` } // (every name cites its texts: D-193)
    : { name: n.name, tier: 'C', note: `${(n as any).source === 'RECONSTRUCTED' ? 'reconstructed name (C, not attested)' : 'recalled attestation (C, not seen)'}: ${n.attestation}` }; // (D-202, D-213)
}
/** posts where a stranger is stopped and questioned (the gates and stair heads; the Treasury door) */
const CHECK_POSTS = new Set(['post_stair_n', 'post_stair_s', 'post_gate_w1', 'post_gate_w2', 'post_gate_s1', 'post_gate_s2', 'post_treas_1', 'post_treas_2']);

export class PeopleSim {
  readonly agents: Agent[] = [];
  readonly events: SimEvent[] = [];
  /** the slice's goods (§9.5 "goods are physical objects"): the Treasury's sacks at the depot and in its store, and the work
   *  camp's (S6 of shadow review r5, S3 of reviewer B): its barley at the depot (`grain`) and at the querns (`querns`), the
   *  flour ground at the querns (`flour`) and the flour at the ovens (`oven`); every carried sack is taken from one and added
   *  to another, grinding turns barley into flour, kneading draws on the ovens' flour (lives.json camp_women_needed; C) */
  stock = { ...INITIAL_STOCK };
  /** what moved between the camp's stocks, counted (the stock test: nothing from nowhere) */
  flows = { grainIn: 0, grainUp: 0, ground: 0, flourToOven: 0, kneaded: 0 };
  private lastGrainDay = -1;
  t = 0; // sim hours since the start of the regnal year (clock.t × 24)
  player: P2 | null = null;
  /** everyone (the abstract tier) and the year's calendar, stores and construction */
  readonly pop: Population;
  readonly cal: EventCalendar;
  /** memory of the player (brief §9.5) */
  readonly memory = new PlayerMemory();
  private pathCache = new Map<string, P2[] | null>();
  /** the most new route searches in one step. A long route on the 0.5 m grid costs 20-200 ms, and a watch change or a
   *  crowd of arrivals asks for many at once; over the budget an agent waits where it is and asks again next step.
   *  Default: no limit (tests, soak); the world sets 1 for its render frames (D-024). */
  routeSearchesPerStep = Infinity; private searches = 0;
  private lastCaravanDay = -1;
  private planCache = new Map<number, { day: number; segs: Seg[] }>();
  private evT = -1;
  private near = new Map<number, number>(); // agent → hours the player has stood near while it works (watching)
  constructor(readonly seed: number, readonly nav: NavGrid, readonly env: (tHours: number) => Env, readonly opts: SimOpts = {}) {
    const seats = this.makeRoster();
    this.pop = new Population(seed, { court: !!opts.court, slice: seats });
    this.cal = new EventCalendar(seed, this.pop, env, !!opts.court); this.pop.attach(this.cal);
    for (const a of this.agents) { const pid = this.pop.bySeat.get(a.id); if (pid === undefined) throw new Error(`agent ${a.id} has no person`); a.pid = pid; }
  }
  /** the Hall of a Hundred Columns as simulation state (columns, walls, reliefs; D-022) */
  get construction() { return this.cal.construction; }

  // ------------------------------------------------------------------ roster (the Terrace slice)
  private makeRoster(): SliceSeat[] {
    const rng = new Rng(this.seed, 'people-roster'); const used = new Set<string>(); const seats: SliceSeat[] = [];
    let hh = 0;
    const add = (role: Role, sex: 'm' | 'f', origin: string, nameOrigins: string[], dress: Dress, langs: string[], home: string, qa: number, qaTier: string, extra: Partial<Agent> = {}) => {
      const id = this.agents.length; const nm = nameOrigins.length ? pickName(rng, sex, nameOrigins, used) : null;
      const a: Agent = { id, name: nm?.name ?? null, nameTier: nm?.tier ?? '-', nameNote: nm?.note ?? `unnamed ${origin} ${role} (no attested ${origin} names in the pool; the tablets often list such workers by group)`,
        sex, origin, langs, role, dress, household: extra.household ?? hh++, ties: [], ration: { qaPerMonth: qa, tier: qaTier }, home, slot: [0, 0], seed: rng.int(0, 1e9), pid: -1,
        speed: (role === 'child' ? 1.1 : 1.3) * rng.range(0.9, 1.1), pos: [...PLACES[home].at] as P2, y: 0, heading: 0, task: null, path: null, pathI: 0, walking: false, carry: null,
        hunger: rng.range(0, 0.3), fatigue: rng.range(0, 0.3), sick: false, day: -1, decisions: 0, metPlayer: 0, lastMetDay: -1, gait: rng.range(0, 6.28), offmap: home === 'town', relieved: false, ...extra };
      this.agents.push(a); seats.push({ agent: id, role, sex, origin, name: a.name }); return a;
    };
    // the garrison: 100 men in ten files of ten (population.json garrison_company, w 100; HDT decimal units B claim; C).
    // Posts are not fixed: a five-day rota rotates watches and posts (lives.json guard_rota; D-023). Persian and Median
    // dress alternate as on the reliefs (B); garrison quarters (C).
    for (let i = 0; i < 100; i++) { const persian = i % 2 === 0;
      add('guard', 'm', persian ? 'Persian' : 'Median', ['Iranian'], persian ? 'guard' : 'median', ['Old Persian', 'Aramaic'], 'garrison_sleep', 30, 'C'); }
    const guards = this.agents.slice(); for (const g of guards) g.ties = guards.filter(o => o !== g && Math.floor(o.id / 10) === Math.floor(g.id / 10)).map(o => o.id);
    // masons: a squad of 12 under a foreman in the stone gang; stonecutters are attested as Syrians, Ionians, Egyptians (PEOPLE §2, B)
    const gang: Agent[] = [];
    const fore = add('foreman', 'm', 'Elamite', ['Elamite', 'Iranian'], 'median', ['Elamite', 'Aramaic'], 'town', 50, 'C'); gang.push(fore);
    const gangOrigins: [string, string[], string[]][] = [['Ionian', [], ['Greek', 'Aramaic']], ['Ionian', [], ['Greek', 'Aramaic']], ['Ionian', [], ['Greek', 'Aramaic']], ['Egyptian', ['Egyptian'], ['Egyptian', 'Aramaic']], ['Egyptian', [], ['Egyptian', 'Aramaic']],
      ['Syrian', ['West Semitic'], ['Aramaic']], ['Syrian', ['West Semitic'], ['Aramaic']], ['Babylonian', ['Babylonian'], ['Aramaic', 'Babylonian']], ['Babylonian', ['Babylonian'], ['Aramaic', 'Babylonian']], ['Lydian', [], ['Lydian', 'Aramaic']],
      ['Elamite', ['Elamite'], ['Elamite']], ['Elamite', ['Elamite'], ['Elamite']]];
    for (const [o, no, l] of gangOrigins) gang.push(add('mason', 'm', o, no, 'worker', l, 'town', 30, 'B'));
    for (const g of gang) g.ties = gang.filter(o => o !== g).map(o => o.id);
    // porters
    const porters: Agent[] = []; for (let i = 0; i < 6; i++) porters.push(add('porter', 'm', i < 3 ? 'Elamite' : 'Persian', i < 3 ? ['Elamite'] : ['Iranian'], 'worker', i < 3 ? ['Elamite'] : ['Old Persian', 'Elamite'], 'town', 30, 'B'));
    for (const p of porters) p.ties = porters.filter(o => o !== p).map(o => o.id);
    // scribes (Elamite chancellery; Aramaic secretaries: LANGUAGES B)
    const scr = [add('scribe', 'm', 'Elamite', ['Elamite', 'Iranian'], 'median', ['Elamite', 'Aramaic'], 'town', 40, 'C'), add('scribe', 'm', 'Babylonian', ['Babylonian', 'West Semitic'], 'median', ['Aramaic', 'Babylonian'], 'town', 40, 'C')];
    scr[0].ties = [scr[1].id]; scr[1].ties = [scr[0].id];
    // the work-camp women's group (grinding, baking, water) with their children (women's rations incl. maternity: B)
    const women: Agent[] = [];
    for (let i = 0; i < 6; i++) { const w = add(i < 2 ? 'baker' : 'grinder', 'f', i % 2 ? 'Elamite' : 'Persian', i % 2 ? ['Elamite', 'Iranian', 'unknown'] : ['Iranian'], 'woman', i % 2 ? ['Elamite'] : ['Old Persian', 'Elamite'], 'town', 25, 'C'); women.push(w); }
    for (const w of women) w.ties = women.filter(o => o !== w).map(o => o.id);
    for (let i = 0; i < 3; i++) { const mother = women[2 + i]; const c = add('child', i === 1 ? 'f' : 'm', mother.origin, [mother.origin === 'Persian' ? 'Iranian' : 'Elamite'], 'child', mother.langs, 'town', 10, 'C', { household: mother.household }); c.ties = [mother.id]; mother.ties.push(c.id); seats[seats.length - 1].mother = mother.id; }
    // messengers of the road station and officials
    const cour = [0, 1].map(() => add('courier', 'm', 'Persian', ['Iranian'], 'median', ['Old Persian', 'Aramaic'], 'town', 45, 'C')); cour[0].ties = [cour[1].id]; cour[1].ties = [cour[0].id];
    const offs: Agent[] = []; for (let i = 0; i < 3; i++) offs.push(add('official', 'm', 'Persian', ['Iranian'], 'persian', ['Old Persian', 'Elamite', 'Aramaic'], 'town', 60, 'C'));
    for (const o of offs) o.ties = offs.filter(x => x !== o).map(x => x.id);
    // personal spots: sleeping places, blocks, querns
    const spot = (pl: string, i: number, n: number): P2 => { const P = PLACES[pl]; if (!P.span) return P.at; const [[x0, y0], [x1, y1]] = P.span;
      const cols = Math.ceil(Math.sqrt(n * (x1 - x0) / Math.max(1, y1 - y0))), rows = Math.ceil(n / cols); const c = i % cols, r = Math.floor(i / cols);
      return this.nav.snap(x0 + (c + 0.5) * (x1 - x0) / cols, y0 + (r + 0.5) * (y1 - y0) / rows, 4) ?? P.at; };
    guards.forEach((g, i) => (g.slot = spot('garrison_sleep', i, guards.length)));
    const masons = this.agents.filter(a => a.role === 'mason'); masons.forEach((m, i) => (m.slot = spot('worksite', i, masons.length)));
    const grinders = this.agents.filter(a => a.role === 'grinder' || a.role === 'baker'); grinders.forEach((g, i) => (g.slot = spot('querns', i, grinders.length)));
    for (const a of this.agents) { if (a.slot[0] === 0 && a.slot[1] === 0) a.slot = PLACES[a.home].at; a.pos = [...a.slot] as P2; }
    return seats;
  }

  // ------------------------------------------------------------------ helpers
  private here(a: Agent, pl: string, jitter = 0, rng?: Rng): P2 {
    const P = PLACES[pl]; if (!P) return a.pos; let [e, n] = P.at;
    if (P.span && rng) { const [[x0, y0], [x1, y1]] = P.span; e = rng.range(x0, x1); n = rng.range(y0, y1); }
    else if (jitter && rng) { const ang = rng.range(0, 2 * Math.PI), r = rng.range(0.8, jitter); e += Math.cos(ang) * r; n += Math.sin(ang) * r; }
    return this.nav.snap(e, n, 5) ?? P.at;
  }
  private task(act: ActivityId, place: string, spot: P2, until: number, why: string, heading?: number): Task {
    const P = PLACES[place]; const face = P && (P.kind === 'hearth' || P.kind === 'oven') ? Math.atan2(P.at[0] - spot[0], P.at[1] - spot[1]) * 180 / Math.PI : null;
    return { act, place, spot, heading: heading ?? P?.heading ?? face, until, why };
  }
  private log(kind: string, text: string, place: string, id?: string, t = this.t, tier?: string) { this.events.push({ t, kind, text, place, id, tier }); if (this.events.length > 2000) this.events.shift(); }
  /** a town household's house: its place id in the plans, its street door and the lane exit of its quarter nearest the
   *  Terrace approach (grid metres, the nav frame) */
  private houseOf(a: Agent, day: number): { place: string; door: P2; exit: P2 } | null {
    const hid = this.pop.home(a.pid, day), H = this.pop.households[hid], x = this.pop.plotOf(hid); if (!x) return null;
    const ex = TOWN_SITES[x.site]?.exits ?? []; const edge = PLACES.town.at;
    const exit = ex.length ? ex.reduce((b, e) => Math.hypot(e[0] - edge[0], e[1] - edge[1]) < Math.hypot(b[0] - edge[0], b[1] - edge[1]) ? e : b) : x.door;
    return { place: H.home, door: [x.door[0], x.door[1]], exit: [exit[0], exit[1]] };
  }
  /** start the next hidden leg in the town; false when none is left */
  private nextLeg(a: Agent): boolean {
    const to = a.legs?.shift(); if (!to) return false; const d = Math.hypot(to[0] - a.pos[0], to[1] - a.pos[1]); if (d < 0.4) return this.nextLeg(a);
    a.path = null; a.walking = true; a.travel = { from: [...a.pos] as P2, to: [...to] as P2, t0: this.t, t1: this.t + d / (a.speed * this.dustF()) * H_PER_S }; return true;
  }
  /** the person's plan for a day (cached per agent) */
  planOf(a: Agent, day: number): Seg[] {
    const c = this.planCache.get(a.id); if (c && c.day === day) return c.segs;
    const segs = this.pop.plan(a.pid, day); this.planCache.set(a.id, { day, segs }); return segs;
  }

  // ------------------------------------------------------------------ decisions
  /** choose the next task for an agent at sim time t (hours): the plan block in force, filled in on the Terrace */
  decide(a: Agent): Task {
    const day = Math.floor(this.t / 24), hour = this.t - day * 24;
    if (a.day !== day) { a.day = day; a.decisions = 0; }
    const rng = new Rng(this.seed, `d:${a.id}:${day}:${a.decisions++}`);
    const seg = segAt(this.planOf(a, day), hour);
    const end = Math.max(day * 24 + seg.t1, this.t + 1 / 120);
    // what the plan says is carried, where the sim does not carry it physically (Agent.carry: the sack, the jar, the basket)
    const T0 = this.decide0(a, seg, end, rng); if (seg.carry && !T0.holds && (T0.off || !/^(carry_|draw_water)/.test(seg.act))) T0.holds = seg.carry; if (seg.wear) T0.wears = seg.wear; return T0;
  }
  private decide0(a: Agent, seg: Seg, end: number, rng: Rng): Task {
    const day = Math.floor(this.t / 24);
    a.sick = seg.act === 'lie_ill';
    // a porter's last sack when his carrying block ends goes into the store (a few steps at most), not home with him: D-211
    if (a.role === 'porter' && a.carry === 'sack' && !(seg.place === 'stair_foot' && seg.act === 'rest')) { a.carry = null; this.stock.store++; }
    // a guard whose watch has ended keeps the post until the relief arrives (at most ~36 minutes)
    if (a.role === 'guard' && a.task?.act === 'stand_guard' && a.post && GUARD_POSTS.includes(a.post) && !a.relieved && a.watchEnd !== undefined && this.t < a.watchEnd + 0.6 && seg.place !== a.post)
      return this.task('stand_guard', a.post, PLACES[a.post].at, Math.min(a.watchEnd + 0.6, this.t + 0.1), /relieved at the post/.test(seg.why) ? 'waiting for the patrol man to stand in while he eats' : 'waiting to be relieved', PLACES[a.post].heading); // (S7 of reviewer B r5)
    if (seg.where !== 'terrace' || !(seg.place in PLACES || seg.place === 'terrace_round')) {
      this.setDown(a, seg.act); // (the jar is put down before the plan leaves the Terrace: shadow review r9, #76 carried the water jar to the town)
      const T: Task = { act: seg.act, place: seg.place, spot: PLACES.town.at, heading: null, until: end, why: seg.why, off: true };
      const h = this.houseOf(a, day);
      if (h) { const plan = this.planOf(a, day), nxt = segAt(plan, Math.min(24 - 1e-6, seg.t1 + 1e-4));
        if (seg.place === h.place || (seg.where === 'road' && nxt.place === h.place)) T.legs = [h.exit, h.door]; // home, or on the way home
        else if (seg.where === 'road' && nxt.where === 'terrace') T.legs = [h.exit, PLACES.town.at]; } // from the door up to the Terrace
      return T;
    }
    return this.onTerrace(a, seg, end, rng);
  }
  /** carried goods are set down when the next task is not carrying them (on the Terrace, and before a block off it) */
  private setDown(a: Agent, act: ActivityId) {
    if (a.role !== 'porter' && a.carry && !((a.carry === 'jar_head' && act === 'carry_jar_head') || (a.carry === 'basket' && act === 'carry_bread') || (a.carry === 'sack' && act === 'carry_sack'))) {
      // a camp woman's sack still in her hands when the carrying block ends is set down where it was going (it is a few steps
      // at most): into that stock, not out of the world (S6 r5)
      if (a.carry === 'sack' && a.sackTo) { this.stock[a.sackTo] += 1; if (a.sackTo === 'oven') this.flows.flourToOven++; else this.flows.grainUp++; }
      a.carry = null; a.sackTo = undefined; }
  }
  /** fine-grained behaviour on the Terrace inside one plan block (the block's place and act are the plan's) */
  private onTerrace(a: Agent, seg: Seg, end: number, rng: Rng): Task {
    const pl = seg.place, act = seg.act, why = seg.why; const chunk = (lo: number, hi: number) => Math.min(end, this.t + rng.range(lo, hi));
    this.setDown(a, act);
    // (no sack to set down when there was none to carry: she comes to the place empty-handed)
    if (act === 'rest' && a.emptyCarry && /^setting the (flour|sack of barley) down/.test(why)) { a.emptyCarry = false; return this.task('rest', pl, this.here(a, pl, 2, rng), end, pl === 'oven' ? 'at the ovens: no flour ground yet to bring' : 'by the querns: no barley at the depot to bring'); }
    // (the next thing at the same place, lying, sitting or eating, is done where the person already is: no walk of a minute to
    // another spot of the room between lying ill and the food brought to him; B S8 of shadow review r8, #51's two 1-minute
    // "walk → garrison_sleep" legs while he was already there)
    const still = (x: ActivityId) => x === 'eat' || x === 'talk' || x === 'gamble' || x === 'rest' || x === 'lie_ill' || x === 'sleep';
    const here0 = a.task && !a.walking && !a.task.off && a.task.place === pl && still(a.task.act) && still(act) ? a.task.spot : null;
    switch (act) {
      case 'sleep': return this.task('sleep', pl, a.role === 'guard' && pl === 'garrison_sleep' ? a.slot : here0 ?? this.here(a, pl, 2, rng), end, why);
      case 'lie_ill': return this.task('lie_ill', pl, a.role === 'guard' && pl === 'garrison_sleep' ? a.slot : here0 ?? this.here(a, pl, 2, rng), end, why);
      case 'stand_guard': {
        const P = PLACES[pl]; if (a.post !== pl || a.task?.act !== 'stand_guard' || a.watchEnd !== end) { a.relieved = false; } a.post = pl; a.watchEnd = end;
        return this.task('stand_guard', pl, P.at, end, why, P.heading);
      }
      case 'patrol': { // a round of the posts (S3): each plan block is a round of its own, its order drawn from where he starts
        const leader = this.pop.persons[a.pid]?.rank === 1; const key = `${Math.floor(this.t / 24)}:${seg.t0.toFixed(4)}`;
        if (a.roundKey !== key || !a.round) { a.roundKey = key; a.round = this.roundFor(a, leader, rng); }
        const backToHearth = () => { const nx = segAt(this.planOf(a, Math.floor(this.t / 24)), Math.min(23.999, seg.t1 + 1e-3)).place; const hp = PLACES[nx]?.kind === 'hearth' ? nx : HEARTHS[(this.pop.persons[a.pid]?.file ?? 1) % 3]; // (his own file's hearth: S7 of reviewer A, r7) a.post = undefined; a.round = [];
          return this.task('rest', hp, this.here(a, hp, 2.6, rng), end, 'back from the round, within call of the posts'); };
        if (!a.round.length) { // the round is done: the leader goes back to the hearth; a patrol man starts another round
          if (leader) return backToHearth();
          a.round = this.roundFor(a, false, rng); }
        const nxt = a.round[0];
        const manned = this.agents.some(o => o !== a && o.post === nxt && o.task?.act === 'stand_guard'); const spot = this.nav.snap(PLACES[nxt].at[0] + 1.5, PLACES[nxt].at[1] - 1.5, 3) ?? PLACES[nxt].at;
        const walk = Math.hypot(spot[0] - a.pos[0], spot[1] - a.pos[1]) * ABSTRACT_DETOUR / (a.speed * this.dustF()) * H_PER_S; // the stop counts from the arrival
        const stop = manned ? (leader ? rng.range(0.03, 0.08) : rng.range(0.02, 0.05)) : rng.range(0.005, 0.02);
        // a leader does not set off for a post he cannot reach before his round's time is up: he goes back to the hearth
        // instead (S10, r4: a leg cut off half-way and turned back)
        if (leader && this.t + walk + Math.min(stop, 0.03) > end) return backToHearth();
        a.round.shift(); a.post = undefined; return this.task('patrol', nxt, spot, Math.min(end, this.t + walk + stop), why);
      }
      case 'carry_sack': {
        if (a.role === 'porter') break;
        if (a.role === 'guard') { // a man of an off-duty file carrying the garrison's ration sacks up from the depot
          if (a.carry === 'sack') return this.task('carry_sack', 'garrison_hearth_m', this.here(a, 'garrison_hearth_m', 3, rng), Math.min(end, this.t + 0.01), why);
          if (this.nearP(a, pl, 6)) { a.carry = 'sack'; return this.task('carry_sack', 'garrison_hearth_m', this.here(a, 'garrison_hearth_m', 3, rng), Math.min(end, this.t + 0.01), why); }
          return this.task('rest', pl, this.here(a, pl, 3, rng), Math.min(end, this.t + 0.01), 'going down for the next sack');
        }
        // a camp woman: a sack of barley from the camp's grain at the depot up to the querns, or a sack of the flour ground at
        // the querns to the ovens (the plan's place is where it goes); a sack is taken from one stock and added to the other
        // when it is set down, and she waits when there is none to take (S6 of shadow review r5; was a sack of flour from no
        // stock set down into none)
        const fl = /flour/.test(why), from = fl ? 'querns' : 'stair_foot', src = fl ? 'flour' : 'grain', dst = fl ? 'oven' : 'querns';
        if (a.carry === 'sack') { if (this.nearP(a, pl, 3)) { a.carry = null; a.sackTo = undefined; this.stock[dst] += 1; if (fl) this.flows.flourToOven++; else this.flows.grainUp++;
          return this.task('rest', pl, this.here(a, pl, 2, rng), end, fl ? 'setting the flour down by the ovens' : 'setting the sack of barley down by the querns'); } return this.task('carry_sack', pl, this.here(a, pl, 2, rng), this.t + 0.01, why); }
        if (this.nearP(a, from, 6)) { if (this.stock[src] >= 1) { this.stock[src] -= 1; a.carry = 'sack'; a.sackTo = dst; a.emptyCarry = false; return this.task('carry_sack', pl, this.here(a, pl, 2, rng), this.t + 0.01, why); }
          a.emptyCarry = true; return this.task('rest', from, this.here(a, from, 3, rng), Math.min(end, this.t + 0.05), fl ? 'waiting at the querns for a sack of flour to be ground' : 'waiting at the depot for the camp’s barley'); }
        return this.task('rest', from, this.here(a, from, 3, rng), this.t + 0.01, fl ? 'going to the querns for the flour' : 'going down to the depot for barley');
      }
      case 'carry_bread': { // fetch the basket at the oven, carry it to the plan's place, set it down there
        if (a.carry === 'basket') { if (this.nearP(a, pl, 3)) { a.carry = null; return this.task('talk', pl, this.here(a, pl, 2, rng), end, 'handing out the bread'); } return this.task('carry_bread', pl, this.here(a, pl, 2, rng), this.t + 0.01, why); }
        if (pl === 'oven' || this.nearP(a, 'oven', 3)) { if (this.nearP(a, 'oven', 3)) a.carry = 'basket'; return this.task(a.carry ? 'carry_bread' : 'rest', 'oven', this.here(a, 'oven', 1.5, rng), a.carry ? end : this.t + 0.01, why); }
        return this.task('rest', 'oven', this.here(a, 'oven', 1.5, rng), this.t + 0.01, 'fetching the bread basket');
      }
      case 'queue': return this.task('queue', pl, this.here(a, pl, 4, rng), end, why);
      case 'walk': return this.task('rest', pl, this.here(a, pl, 2, rng), Math.min(end, this.t + 0.02), why);
      case 'shelter': return this.task('shelter', pl, this.here(a, pl, 0, rng), end, why);
      default: break;
    }
    switch (a.role) {
      case 'mason': {
        if (act !== 'dress_stone') break;
        if (rng.chance(0.06)) return this.task('talk', pl, this.here(a, pl, 2, rng), chunk(0.1, 0.25), 'a word with the gang');
        if (pl === 'worksite') return this.task('dress_stone', 'worksite', a.slot, chunk(0.6, 1.4), why, 0);
        const P = PLACES[pl]; const c = P.c ?? P.at; const ang = (a.id * 2.399) % (2 * Math.PI); const r = P.c ? 1.6 : 1.4;
        const s = this.nav.snap(c[0] + Math.cos(ang) * r, c[1] + Math.sin(ang) * r, 1.5) ?? P.at;
        return this.task('dress_stone', pl, s, chunk(0.6, 1.4), why, P.c ? Math.atan2(c[0] - s[0], c[1] - s[1]) * 180 / Math.PI : P.heading);
      }
      case 'foreman': {
        if (act !== 'inspect' && act !== 'dress_stone') break;
        const m = this.agents.filter(x => x.role === 'mason' && !x.offmap && x.task?.act === 'dress_stone'); const tgt = m.length ? rng.pick(m) : null;
        if (!tgt) return this.task('inspect', pl, this.here(a, pl, 2, rng), chunk(0.1, 0.35), why);
        return this.task(rng.chance(0.5) ? 'inspect' : 'talk', tgt.task!.place, this.nav.snap(tgt.pos[0] + 1.2, tgt.pos[1] - 1.0, 3) ?? tgt.pos, chunk(0.1, 0.35), 'overseeing the squad');
      }
      case 'porter': {
        if (!(pl === 'stair_foot' && act === 'rest')) break;
        // (the sack handed in to the scribe who is counting the caravan into the store, and recorded: E-06, the PF receipts "PN
        // received"; D-211: the receipt had come about only by a porter walking past a writing scribe. With no scribe there
        // the sack is set down)
        if (a.carry === 'sack') { const sc = this.storeScribe(); return sc ? this.task('rest', 'treasury_store', this.nav.snap(sc.pos[0] + 1.1, sc.pos[1] - 0.6, 2) ?? sc.pos, this.t + 0.03, 'handing the sack in to the scribe, who counts it and records the receipt')
          : this.task('rest', 'treasury_store', this.here(a, 'treasury_store', 3, rng), this.t + 0.03, 'set the sack down'); }
        // (the caravan's sacks are counted off the animals by the porters together before the first is taken up, a quarter of
        // an hour: the load taken over by number, as the store's scribe receives it by number; C, D-211)
        { const day = Math.floor(this.t / 24), cv = this.lastCaravanDay === day ? this.pop.caravan(day) : null, until = cv ? day * 24 + cv.h + 0.2 : 0;
          if (cv && this.t < until && this.stock.depot > 0 && this.nearP(a, 'stair_foot', 6)) return this.task('talk', 'stair_foot', this.here(a, 'stair_foot', 3, rng), until, 'counting the caravan’s sacks off the animals with the others'); }
        if (this.stock.depot > 0 && this.nearP(a, 'stair_foot', 6)) { this.stock.depot--; a.carry = 'sack'; a.loadDay = Math.floor(this.t / 24); return this.task('carry_sack', 'treasury_store', this.here(a, 'treasury_store', 3, rng), this.t + 0.02, 'carrying a sack to the Treasury store'); }
        if (this.stock.depot > 0) return this.task('rest', 'stair_foot', this.here(a, 'stair_foot', 3, rng), this.t + 0.02, a.loadDay === Math.floor(this.t / 24) ? 'going for the next load' : 'going down to the depot for a load'); // (S7 of reviewer B r5: "the next load" for the first)
        // (once the day's caravan is carried up the plan sends the porters home: Population.caravanDone; what is left of the
        // block is the last loads' minutes, not a wait for a caravan that has come: A S4 of shadow review r8)
        return this.task(rng.chance(0.5) ? 'rest' : 'talk', 'stair_foot', this.here(a, 'stair_foot', 3.5, rng), chunk(0.2, 0.5), this.lastCaravanDay === Math.floor(this.t / 24) ? 'at the depot, the caravan’s loads carried up' : 'waiting for a caravan');
      }
      case 'baker': case 'grinder': {
        if (act === 'knead') { // the dough for the gang from the ovens' flour, once for each kneading block (S6 r5)
          const key = `${Math.floor(this.t / 24)}:${seg.t0.toFixed(4)}`;
          if (a.kneadKey !== key) { if (this.stock.oven < CW.knead_sacks - 1e-9) return this.task('rest', 'oven', this.here(a, 'oven', 1.5, rng), Math.min(end, this.t + 0.1), 'waiting at the ovens for flour');
            a.kneadKey = key; this.stock.oven -= CW.knead_sacks; this.flows.kneaded += CW.knead_sacks; }
          return this.task('knead', 'oven', this.nav.snap(PLACES.oven.at[0] - 1.5 - a.id % 2, PLACES.oven.at[1] - 1.2, 2) ?? PLACES.oven.at, end, why, 45); }
        if (act === 'bake') return this.task('bake', 'oven', this.nav.snap(PLACES.oven.at[0] + (a.id % 2 ? 1 : -1), PLACES.oven.at[1] - 1.0, 2) ?? PLACES.oven.at, end, why, 0);
        if (act === 'grind') { // the querns' barley ground into flour as she grinds (lives.json grind_h_per_sack; S6 r5)
          const until = chunk(0.4, 0.9), use = (until - this.t) / CW.grind_h_per_sack;
          if (this.stock.querns < use) return this.task('rest', 'querns', a.slot, Math.min(end, this.t + 0.2), 'waiting at her quern for barley');
          this.stock.querns -= use; this.stock.flour += use; this.flows.ground += use; return this.task('grind', 'querns', a.slot, until, why, 90); }
        if (act === 'draw_water') return this.task('draw_water', 'water', this.here(a, 'water', 1.5, rng), end, why);
        if (act === 'carry_jar_head') {
          if (a.carry !== 'jar_head') return this.task('rest', 'work_hearth', this.here(a, 'work_hearth', 2, rng), end, 'at the work camp');
          if (!this.nearP(a, 'work_hearth', 3.5)) return this.task('carry_jar_head', 'work_hearth', this.here(a, 'work_hearth', 2, rng), this.t + 0.01, why);
          a.carry = null; this.log('water', 'water brought to the work camp', 'work_hearth'); return this.task('rest', 'work_hearth', this.here(a, 'work_hearth', 2, rng), end, 'set the water jar down');
        }
        break;
      }
      case 'child': {
        if (pl !== 'querns' && pl !== 'stair_foot') break;
        const mom = this.agents[a.ties[0]]; const near = !!mom && !!mom.task && !mom.offmap && mom.task.place === pl; const c = near ? mom.pos : PLACES[pl].at;
        const s = this.nav.snap(c[0] + rng.range(-6, 6), c[1] + rng.range(-6, 6), 4) ?? c;
        return this.task(act === 'eat' ? 'eat' : act === 'play' ? 'play' : 'rest', pl, s, chunk(0.15, 0.4), why);
      }
      case 'courier': {
        // the sealed letter handed to a scribe (or an official) of the Treasury, who asks for his document and takes it (E-20;
        // the PF letter-orders and their receipts): to the one writing at the desk; when the desk's scribe is counting a
        // caravan into the store, to him there (D-211: the courier had met a scribe only when one happened to be at the desk)
        if (pl !== 'treasury_desk' || act !== 'talk') break;
        const at = (o: Agent, p: string) => !o.offmap && !o.walking && o.task?.place === p && (o.role === 'scribe' || o.role === 'official');
        const desk = this.agents.find(o => at(o, 'treasury_desk')), sc = desk ? null : this.storeScribe(), to = desk ?? sc;
        if (to) return this.task('talk', to.task!.place, this.nav.snap(to.pos[0] + 1.2, to.pos[1] + 0.4, 2) ?? to.pos, end, sc ? 'delivering a sealed document to the scribe in the store' : why);
        break;
      }
      case 'official': {
        if (act !== 'inspect' && act !== 'talk') break;
        const ties = a.ties.map(i => this.agents[i]).filter(o => o.task?.place === pl && !o.offmap);
        return this.task(ties.length ? 'talk' : act, pl, ties.length ? (this.nav.snap(ties[0].pos[0] + 1.3, ties[0].pos[1], 2) ?? PLACES[pl].at) : this.here(a, pl, 2.5, rng), chunk(0.3, 0.8), why);
      }
    }
    // the plan's act at the plan's place (meals, rest, talk and knucklebones at the hearths, writing at the desk, …)
    const jitter = PLACES[pl]?.kind === 'hearth' ? 2.6 : PLACES[pl]?.kind === 'post' ? 0 : 2;
    // the same act at the same place goes on where the person already is (a meal is one sitting, not a walk between bites)
    const stay = a.task && !a.walking && !a.task.off && a.task.place === pl && (a.task.act === act || (still(a.task.act) && still(act))) ? a.task.spot : null;
    return this.task(act, pl, stay ?? this.here(a, pl, jitter, rng), act === 'eat' || act === 'write_tablet' || act === 'talk' ? chunk(0.3, 1.2) : end, why);
  }
  /** the posts of a round, nearest first from where he stands, choosing now and then the second nearest (so no two rounds
   *  run the same way); a leader of ten visits the posts his own file holds on the watch, a patrol man every post of the
   *  watch, both from the rota (S3, r4: the posts were those where a man already stood, so at the change of watch, with the
   *  men still on their way, a leader's round fell back to all sixteen), and not the post he is standing at (C) */
  private roundFor(a: Agent, leader: boolean, rng: Rng): string[] {
    const P = this.pop, file = P.persons[a.pid]?.file ?? -1, day = Math.floor(this.t / 24), hour = this.t - day * 24;
    const me = P.rota(day).get(a.pid), prev = P.rota(day - 1).get(a.pid);
    const [rd, w] = hour < 6 && prev?.watch === 2 ? [day - 1, 2] : me ? [day, me.watch] : [-1, -1]; // after midnight a night watch is yesterday's
    const onWatch = rd >= 0 ? [...P.rota(rd).entries()].filter(([pid, x]) => x.watch === w && !!x.post && (!leader || P.persons[pid]?.file === file)).map(([, x]) => x.post as string) : [];
    let posts = GUARD_POSTS.filter(p => onWatch.includes(p));
    if (!posts.length) posts = GUARD_POSTS.filter(p => this.agents.some(o => o !== a && o.post === p && o.task?.act === 'stand_guard' && (!leader || P.persons[o.pid]?.file === file)));
    if (!posts.length) posts = [...GUARD_POSTS];
    const away = posts.filter(p => Math.hypot(PLACES[p].at[0] - a.pos[0], PLACES[p].at[1] - a.pos[1]) >= 3); if (away.length) posts = away; // (S10: "patrol → post_x" while standing at post_x)
    const out: string[] = []; let at = a.pos; const left = [...posts]; const dd = (p: string) => Math.hypot(PLACES[p].at[0] - at[0], PLACES[p].at[1] - at[1]);
    while (left.length) { left.sort((x, y) => dd(x) - dd(y)); const nx = left.splice(left.length > 1 && rng.chance(0.35) ? 1 : 0, 1)[0]; out.push(nx); at = PLACES[nx].at; }
    return out;
  }
  private nearP(a: Agent, pl: string, r: number) { const p = PLACES[pl]?.at; return !!p && Math.hypot(a.pos[0] - p[0], a.pos[1] - p[1]) < r; }

  // ------------------------------------------------------------------ movement
  /** a route from the agent to `to`, null if there is none, undefined if the step's search budget is spent */
  private routeTo(a: Agent, to: P2): P2[] | null | undefined {
    if (this.nav.lineClear(a.pos, to)) return [a.pos, to];
    // cache by grid cell pairs (5 m buckets) so repeated place-to-place trips reuse the search
    const q = (p: P2) => `${Math.round(p[0] / 5)},${Math.round(p[1] / 5)}`; const key = q(a.pos) + '>' + q(to);
    let mid = this.pathCache.get(key);
    if (mid === undefined) { if (this.searches >= this.routeSearchesPerStep) return undefined; this.searches++; mid = this.nav.findPath(a.pos, to); this.pathCache.set(key, mid); }
    if (!mid) return null;
    const p = mid.slice(); p[0] = a.pos; p[p.length - 1] = to;
    if (p.length > 1 && !this.nav.lineClear(p[0], p[1])) { if (this.searches >= this.routeSearchesPerStep) return undefined; this.searches++; return this.nav.findPath(a.pos, to); }
    return p;
  }
  private begin(a: Agent, task: Task, instant: boolean) {
    a.task = task; a.waitRoute = false;
    const wasOff = a.offmap;
    a.offmap = !!task.off;
    if (a.offmap && !instant && !wasOff && Math.hypot(a.pos[0] - task.spot[0], a.pos[1] - task.spot[1]) > 1) { a.offmap = false; } // walk out to the town edge first
    if (wasOff && !a.offmap) a.pos = [...PLACES.town.at] as P2; // leaving the town: enter at the plain edge
    a.travel = null; a.legs = undefined;
    const dist = Math.hypot(a.pos[0] - task.spot[0], a.pos[1] - task.spot[1]);
    if (instant) { a.pos = [...(task.legs?.length ? task.legs[task.legs.length - 1] : task.spot)] as P2; a.path = null; a.walking = false; if (task.off) a.offmap = true; this.ground(a); }
    else if (task.off && wasOff) { // already in the town: on along the legs (the whole way from the edge, else straight on to the last)
      const L0 = task.legs ?? []; const atEdge = Math.hypot(a.pos[0] - PLACES.town.at[0], a.pos[1] - PLACES.town.at[1]) < 1;
      a.legs = atEdge ? L0.slice() : L0.length ? [L0[L0.length - 1]] : []; a.path = null; a.walking = false; this.nextLeg(a); }
    else if (dist > 0.4 && a.lod === 'abstract') { a.path = null; a.walking = true; a.travel = { from: [...a.pos] as P2, to: [...task.spot] as P2, t0: this.t, t1: this.t + dist * ABSTRACT_DETOUR / (a.speed * (a.carry ? 0.8 : 1) * this.dustF()) * H_PER_S }; }
    else if (dist > 0.4) { const r = this.routeTo(a, task.spot); if (r === undefined) { a.path = null; a.walking = false; a.waitRoute = true; } else { a.path = r; a.pathI = 1; a.walking = !!a.path; if (!a.path) a.pos = [...task.spot] as P2; } }
    else { a.path = null; a.walking = false; }
    if (!task.off && !a.walking && task.act !== 'stand_guard') this.socialise(a);
  }

  /** the walking pace in the dust (W-03, EVENTS.md: "travel and deliveries slow (× 0.7)"; C): 0.7 while the day's dust is in
   *  the air (DayWx.dustH), else 1 (S5 of shadow review r5: the porter's walks took the same time on a dust day) */
  dustF() { const day = Math.floor(this.t / 24), h = this.t - day * 24, dh = this.cal.ctx(day).wx.dustH; return dh && h >= dh[0] && h < dh[1] ? 0.7 : 1; }
  /** advance by dt game seconds */
  step(dt: number) {
    if (dt <= 0) return;
    this.t += dt * H_PER_S; this.searches = 0;
    this.events$();
    for (const a of this.agents) this.stepAgent(a, dt);
  }
  /** simulation LOD: people within `radius` m of `centre` (the player) walk real routes; the rest travel abstractly.
   *  Promotion mid-journey re-routes from the current position, so nobody jumps; demotion keeps the remaining time. */
  updateLod(centre: P2 | null, radius: number) {
    for (const a of this.agents) {
      const near = !!centre && !a.offmap && Math.hypot(a.pos[0] - centre[0], a.pos[1] - centre[1]) < radius;
      const want = near ? 'full' : 'abstract';
      if ((a.lod ?? 'full') === want) continue;
      if (want === 'full' && a.travel && a.task) {
        // the straight-line position may lie inside a building: step to the nearest walkable cell (a small move) and
        // route from there; with no route, stay abstract until arrival rather than jump
        const s = this.nav.snap(a.pos[0], a.pos[1], 6); if (!s) continue;
        const saved = a.pos; a.pos = s; const path = this.routeTo(a, a.task.spot); // undefined: over the search budget, try again later
        if (!path) { a.pos = saved; continue; }
        a.travel = null; a.path = path; a.pathI = 1; a.walking = true;
      }
      a.lod = want;
      if (want === 'abstract' && a.path && a.task) { const rem = a.path.slice(a.pathI); let d = 0, p = a.pos; for (const q of rem) { d += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
        a.path = null; a.travel = { from: [...a.pos] as P2, to: [...a.task.spot] as P2, t0: this.t, t1: this.t + d / (a.speed * this.dustF()) * H_PER_S }; a.walking = true; }
    }
  }
  /** jump to a new time: everyone is placed where their plan puts them (continuity after time skips, loads) */
  jumpTo(tHours: number) {
    this.t = tHours; this.evT = tHours < this.evT ? tHours - 24 : Math.max(this.evT, tHours - 24); this.events$();
    for (const a of this.agents) { if (a.carry === 'sack' && a.sackTo) this.stock[a.sackTo] += 1; a.carry = null; a.sackTo = undefined; a.relieved = true; this.begin(a, this.decide(a), true); } // (a camp sack in hand is set down at its place: S6 r5)
  }
  private events$() {
    const day = Math.floor(this.t / 24), hour = this.t - day * 24;
    const C = this.cal.ctx(day);
    // the calendar's events (rations, deliveries, couriers, offerings, construction, life …) enter the chronicle as time passes
    if (this.evT < 0) this.evT = this.t - 1e-9;
    if (this.t > this.evT) { for (const e of this.cal.eventsBetween(this.evT, this.t)) this.log(e.kind, e.text, e.place, e.id, e.t, e.tier); this.evT = this.t; }
    // the camp's barley sent up from the storehouse to the depot in the morning when the depot is low (lives.json
    // camp_women_needed.camp_grain_up; C)
    if (day !== this.lastGrainDay && hour >= 6.5) { this.lastGrainDay = day;
      if (this.stock.grain < 12) { const n = new Rng(this.seed, `camp-grain:${day}`).int(CW.camp_grain_up[0], CW.camp_grain_up[1]); this.stock.grain += n; this.flows.grainIn += n; this.log('delivery', `${n} sacks of barley for the work camp brought up to the stair foot`, 'stair_foot'); } }
    // goods for the Treasury carried up from the stair foot (C): 1–2 loads a day around mid-morning; weather holds them up
    // (its hour is the population's, Population.caravan, so the porters' plans know when it comes: A S4 of shadow review r8)
    if (day !== this.lastCaravanDay && hour >= 9) {
      const cv = this.pop.caravan(day); if (cv ? hour < cv.h - 1e-6 : hour < 15) return;
      this.lastCaravanDay = day; if (!cv) { this.log('weather_effect', 'no caravan reached the stair foot today: the road was stopped by the weather', 'stair_foot', 'W-01'); return; }
      const r = new Rng(this.seed, `caravan:${day}`); const n = r.int(1, 2); let sacks = 0;
      for (let i = 0; i < n; i++) sacks += r.int(20, 40);
      this.stock.depot += sacks; this.log('caravan', `${n === 1 ? 'a caravan' : 'two caravans'} unloaded ${sacks} sacks at the stair foot`, 'stair_foot');
      // the Treasury store is drawn down as goods go to inner storerooms and issues (C), keeping stock bounded
      const out = Math.min(this.stock.store, Math.round(this.stock.store * 0.15 + r.int(10, 30))); this.stock.store -= out;
      if (out) this.log('issue', `${out} sacks issued from the Treasury store`, 'treasury_store');
    }
  }
  private stepAgent(a: Agent, dt: number) {
    const hrs = dt * H_PER_S; a.hunger = Math.min(1, a.hunger + hrs / 6); a.fatigue = Math.min(1, a.fatigue + hrs / 16);
    if (!a.task) this.begin(a, this.decide(a), true);
    if (a.waitRoute && a.task) { const r = this.routeTo(a, a.task.spot); if (r === undefined) { this.ground(a); return; }
      a.waitRoute = false; a.path = r; a.pathI = 1; a.walking = !!r; if (!r) a.pos = [...a.task.spot] as P2; }
    let budget = dt;
    for (let guard = 0; guard < 8 && budget > 0; guard++) {
      if (a.walking && a.travel) { // abstract travel: timed straight-line move
        const tr = a.travel;
        if (this.t >= tr.t1) { a.pos = [...tr.to] as P2; a.travel = null; a.walking = false; budget = Math.min(budget, (this.t - tr.t1) * 3600); if (a.task?.off) { a.offmap = true; if (a.legs === undefined) a.legs = a.task.legs?.slice() ?? []; if (this.nextLeg(a)) continue; } this.arrive(a); continue; }
        const f = (this.t - tr.t0) / Math.max(1e-9, tr.t1 - tr.t0); a.pos = [tr.from[0] + (tr.to[0] - tr.from[0]) * f, tr.from[1] + (tr.to[1] - tr.from[1]) * f];
        a.heading = Math.atan2(tr.to[0] - tr.from[0], tr.to[1] - tr.from[1]) * 180 / Math.PI; a.gait += a.speed * dt / 0.72 * Math.PI; budget = 0; break;
      }
      if (a.walking && a.path) {
        const sp = a.speed * (a.carry ? 0.8 : 1) * this.dustF();
        while (budget > 0 && a.pathI < a.path.length) {
          const tgt = a.path[a.pathI], de = tgt[0] - a.pos[0], dn = tgt[1] - a.pos[1], d = Math.hypot(de, dn);
          const step = sp * budget;
          if (d <= step) { a.pos = [tgt[0], tgt[1]]; budget -= d / sp; a.pathI++; }
          else { a.pos = [a.pos[0] + de / d * step, a.pos[1] + dn / d * step]; budget = 0; }
          if (d > 1e-3) a.heading = Math.atan2(de, dn) * 180 / Math.PI;
          a.gait += step / 0.72 * Math.PI; // one stride ≈ 1.44 m
        }
        if (a.pathI >= a.path.length) { a.walking = false; a.path = null; if (a.task?.off) { a.offmap = true; if (a.legs === undefined) a.legs = a.task.legs?.slice() ?? []; if (this.nextLeg(a)) continue; } this.arrive(a); }
        continue;
      }
      // performing: wait until the task ends
      const left = (a.task!.until - this.t) * 3600;
      if (left > 0) { budget = 0; break; }
      this.finish(a);
      this.begin(a, this.decide(a), false);
    }
    this.ground(a);
    if (!a.walking && a.task && a.task.heading !== null && Number.isFinite(a.task.heading)) a.heading = a.task.heading;
    if (this.player && !a.offmap) this.notice(a, dt);
  }
  private ground(a: Agent) { const y = a.offmap ? 0 : this.nav.heightAt(a.pos[0], a.pos[1]); a.y = Number.isFinite(y) ? y : a.y; }
  private arrive(a: Agent) {
    // a relieving guard releases the one on the post
    if (a.role === 'guard' && a.task?.act === 'stand_guard') for (const o of this.agents) if (o !== a && o.post === a.post && o.task?.act === 'stand_guard') { o.relieved = true; }
    if (!a.task?.off) this.socialise(a);
  }
  /** a scribe writing in the Treasury store now (the caravan's receipt: Population scribe's day), or null */
  private storeScribe(): Agent | null { for (const o of this.agents) if (o.role === 'scribe' && !o.offmap && !o.walking && o.task?.act === 'write_tablet' && o.task.place === 'treasury_store') return o; return null; }
  private finish(a: Agent) {
    const act = a.task?.act;
    // (a sack carried up is handed in to the store's scribe first when one is counting there: the next decision, above)
    if (a.role === 'porter' && a.carry === 'sack' && this.nearP(a, 'treasury_store', 6) && !(act === 'carry_sack' && this.storeScribe())) { a.carry = null; this.stock.store++; }
    if (a.role === 'guard' && a.carry === 'sack' && this.nearP(a, 'garrison_hearth_m', 6)) a.carry = null;
    if (act === 'draw_water' && !a.task?.off) a.carry = 'jar_head';
  }
  /** relationships between the detailed people change with what they do together: eating, talking and knucklebones at
   *  the same hearth warm them a little (lives.json affinity; the change counts from the next day) */
  private socialise(a: Agent) {
    const act = a.task?.act; if (act !== 'talk' && act !== 'gamble' && act !== 'eat') return;
    const day = Math.floor(this.t / 24); let n = 0;
    for (const o of this.agents) { if (o === a || o.offmap || o.walking || o.task?.place !== a.task!.place || (o.task.act !== 'talk' && o.task.act !== 'gamble' && o.task.act !== 'eat')) continue;
      if (Math.hypot(o.pos[0] - a.pos[0], o.pos[1] - a.pos[1]) > 6) continue; this.pop.relate(a.pid, o.pid, day, (livesData as any).affinity.shared_meal); if (++n >= 3) break; }
  }
  /** memory of the player: meetings, being stopped at a gate, being watched at work (lives.json familiarity) */
  private notice(a: Agent, dt: number) {
    const p = this.player!; const d = Math.hypot(p[0] - a.pos[0], p[1] - a.pos[1]); const day = Math.floor(this.t / 24);
    if (d < 3 && a.lastMetDay !== day) { a.metPlayer++; a.lastMetDay = day;
      const kind: Encounter = a.task?.act === 'stand_guard' && a.post && CHECK_POSTS.has(a.post) ? 'stopped' : 'met'; this.memory.note(a.id, kind, this.t); }
    const working = !a.walking && a.task && ACTIVITIES[a.task.act] && !['sleep', 'rest', 'walk', 'lie_ill', 'offmap'].includes(a.task.act);
    if (d < 6 && working) { const h = (this.near.get(a.id) ?? 0) + dt * H_PER_S; this.near.set(a.id, h); if (h >= FAM.watch_hours && h - dt * H_PER_S < FAM.watch_hours) this.memory.note(a.id, 'watched', this.t); }
    else if (this.near.has(a.id)) this.near.delete(a.id);
  }
  /** the player addressed this person (world.address): remembered */
  noteAddressed(id: number) { this.memory.note(id, 'addressed', this.t); }
  /** how this person greets the player now: 'none' | 'nod' | 'recognise' (for the renderer's head turn and for speech) */
  greeting(id: number) { return this.memory.greeting(id, this.t); }
  /** familiarity with the player, 0..1 (decays with a half-life of days) */
  familiarity(id: number) { return this.memory.level(id, this.t); }
  /** affinity between two detailed people, -1..1 (base by tie; disputes sour it, shared meals and talk warm it) */
  relationship(a: number, b: number) { return this.pop.affinity(this.agents[a].pid, this.agents[b].pid, Math.floor(this.t / 24)); }

  /** what the renderer should show for an agent right now */
  performance(a: Agent): { act: ActivityId; moving: boolean } {
    if (a.walking) {
      const act: ActivityId = a.carry === 'sack' ? 'carry_sack' : a.carry === 'jar_head' ? 'carry_jar_head' : a.carry === 'basket' ? 'carry_bread' : a.role === 'guard' && (a.task?.act === 'stand_guard' || a.task?.act === 'patrol') ? 'patrol' : 'walk';
      return { act, moving: true };
    }
    return { act: a.task?.act ?? 'rest', moving: false };
  }
  /** every activity a detailed agent can perform in the rendered world (for the activity lint); off the Terrace an agent
   *  is hidden and takes the population's activity, which may be an abstract-only placeholder (activities.ts) */
  static readonly EMITS: ActivityId[] = ['craft', 'walk', 'carry_sack', 'carry_jar_head', 'carry_bread', 'stand_guard', 'patrol', 'dress_stone', 'grind', 'knead', 'bake', 'draw_water', 'write_tablet', 'eat', 'sleep', 'talk', 'rest', 'gamble', 'inspect', 'shelter', 'play', 'queue', 'lie_ill', 'offmap'];
  /** a bounded set of the detailed people for the renderer: on the Terrace (not off-map), within `radius` of `centre`,
   *  nearest first, at most `max` (crowd pooling will draw these; D-024) */
  visibleAgents(centre: P2, radius: number, max = Infinity): Agent[] {
    const out: [number, Agent][] = []; for (const a of this.agents) { if (a.offmap) continue; const d = Math.hypot(a.pos[0] - centre[0], a.pos[1] - centre[1]); if (d <= radius) out.push([d, a]); }
    return out.sort((x, y) => x[0] - y[0]).slice(0, max).map(x => x[1]);
  }
  /** people of the population on the Terrace now who have no detailed agent (not rendered yet; D-024), by place */
  abstractOnTerrace(): { total: number; byPlace: Record<string, number>; byAct: Record<string, number> } {
    const day = Math.floor(this.t / 24), h = this.t - day * 24; const byPlace: Record<string, number> = {}, byAct: Record<string, number> = {}; let total = 0;
    for (const p of this.pop.persons) { if (p.agent >= 0 || !(p.zone === 'terrace' || p.work === 'treasury_inside' || p.work === 'treasury_store' || p.job === 'builder' || p.job === 'camp' || p.job === 'porter' || p.job === 'caretaker' || p.job === 'official' || p.job === 'scribe' || p.job === 'messenger' || p.job === 'shepherd')) continue;
      if (!this.pop.present(p.id, day)) continue; const s = segAt(this.pop.plan(p.id, day), h); if (s.where !== 'terrace') continue;
      total++; byPlace[s.place] = (byPlace[s.place] ?? 0) + 1; byAct[s.act] = (byAct[s.act] ?? 0) + 1; }
    return { total, byPlace, byAct };
  }
  /** the Terrace places only the abstract tier uses (no detailed spot yet) */
  static readonly ABSTRACT_TERRACE_PLACES = TERRACE_ABSTRACT;

  save() {
    return { t: this.t, stock: { ...this.stock }, flows: { ...this.flows }, lastGrainDay: this.lastGrainDay, lastCaravanDay: this.lastCaravanDay, memory: this.memory.snapshot(), relations: this.pop.relationsSnapshot(),
      agents: this.agents.map(a => ({ id: a.id, pos: a.pos, task: a.task, carry: a.carry, hunger: a.hunger, fatigue: a.fatigue, sick: a.sick, day: a.day, decisions: a.decisions, metPlayer: a.metPlayer, lastMetDay: a.lastMetDay, offmap: a.offmap, relieved: a.relieved, heading: a.heading, lod: a.lod, travel: a.travel, post: a.post, watchEnd: a.watchEnd, sackTo: a.sackTo })) };
  }
  load(s: any) {
    if (!s?.agents) return; this.t = s.t; this.stock = { ...INITIAL_STOCK, ...s.stock }; this.lastCaravanDay = s.lastCaravanDay; if (s.flows) this.flows = { ...s.flows }; if (s.lastGrainDay !== undefined) this.lastGrainDay = s.lastGrainDay;
    this.cal.ctx(Math.floor(s.t / 24)); // the calendar is deterministic: recompute to the saved day, then restore what the detailed people changed
    if (s.relations) this.pop.relationsRestore(s.relations); this.memory.restore(s.memory); this.evT = s.t; this.planCache.clear();
    for (const x of s.agents) { const a = this.agents[x.id]; if (!a) continue; Object.assign(a, { pos: x.pos, task: x.task, carry: x.carry, hunger: x.hunger, fatigue: x.fatigue, sick: x.sick, day: x.day, decisions: x.decisions, metPlayer: x.metPlayer, lastMetDay: x.lastMetDay, offmap: x.offmap, relieved: x.relieved, heading: x.heading, post: x.post, watchEnd: x.watchEnd, sackTo: x.sackTo });
      a.lod = x.lod ?? a.lod; a.path = null; a.walking = false; a.travel = null; this.ground(a); if (a.task && !a.task.off && Math.hypot(a.pos[0] - a.task.spot[0], a.pos[1] - a.task.spot[1]) > 0.4) this.begin(a, a.task, false); }
  }
  static activityOk(id: string) { return id in ACTIVITIES; }
}
