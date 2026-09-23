// People simulation for the vertical slice (Phase 3; scales up in Phase 5 inside a worker, so this module has no
// renderer dependencies). Everyone has a name (attested only, or honestly unnamed), origin, languages, household, ties,
// a ration entitlement, a job with a daily schedule, and needs (hunger, fatigue). Decisions are made when a task ends,
// from the hour, sunrise/sunset, weather, stock levels and needs; every decision draws from a random stream keyed by
// (world seed, person, day, decision number), so the outcome does not depend on frame rate or step size.
// Goods are counted: porters move real sacks from the depot at the stair foot to the Treasury store.
import placesData from '../data/people_places.json';
import namesData from '../data/names.json';
import { Rng } from '../core/rng';
import type { NavGrid, P2 } from './navgrid';
import { ACTIVITIES, ActivityId } from './activities';
import type { Dress } from './body';

export type Role = 'guard' | 'mason' | 'foreman' | 'porter' | 'scribe' | 'baker' | 'grinder' | 'child' | 'courier' | 'official';
export interface Place { id: string; kind: string; at: P2; heading?: number; span?: [P2, P2]; tier: string; note: string }
export const PLACES: Record<string, Place> = Object.fromEntries((placesData as any).places.map((p: Place) => [p.id, p]));

export interface Env { rain: number; lightning: boolean; windMs: number; tempC: number }
export interface Task { act: ActivityId; place: string; spot: P2; heading: number | null; until: number /* sim hours */; why: string }
export interface Agent {
  id: number; name: string | null; nameNote: string; nameTier: string; sex: 'm' | 'f'; origin: string; langs: string[];
  role: Role; dress: Dress; household: number; ties: number[]; ration: { qaPerMonth: number; tier: string };
  post?: string; shift?: number; home: string; slot: P2; speed: number; seed: number;
  // dynamic state
  pos: P2; y: number; heading: number; task: Task | null; path: P2[] | null; pathI: number; walking: boolean;
  carry: null | 'sack' | 'jar' | 'jar_head' | 'basket'; hunger: number; fatigue: number; sick: boolean;
  day: number; decisions: number; metPlayer: number; lastMetDay: number; gait: number; offmap: boolean; relieved: boolean;
}
export interface SimEvent { t: number; kind: string; text: string; place: string }

const H_PER_S = 1 / 3600;
const LAT = 29.935 * Math.PI / 180;
/** sunrise/sunset in local solar hours for a day of the regnal year (day 0 = 17 Apr Julian ≈ 12 Apr Gregorian-equiv.; C, ±5 min) */
export function sunTimes(day: number): { rise: number; set: number } {
  const doy = 102 + day; const dec = -23.44 * Math.PI / 180 * Math.cos(2 * Math.PI * (doy + 10) / 365);
  const h = Math.acos(Math.max(-1, Math.min(1, -Math.tan(LAT) * Math.tan(dec)))) * 12 / Math.PI;
  return { rise: 12 - h, set: 12 + h };
}

/** name pools from names.json (attested only; brief §9.1). Origins with no attested names give `null` (honestly unnamed). */
const NAMES = (namesData as any).names.filter((n: any) => !n.notable && !n.reading_uncertain) as { name: string; sex: string; origin_guess: string; tier: string; texts: string[] }[];
function pickName(rng: Rng, sex: 'm' | 'f', origins: string[], used: Set<string>) {
  const pool = NAMES.filter(n => n.sex === sex && origins.includes(n.origin_guess) && !used.has(n.name));
  if (!pool.length) return null;
  const n = rng.pick(pool); used.add(n.name); return { name: n.name, tier: n.tier.startsWith('A') ? 'A' : 'B', note: n.texts?.length ? `attested ${n.texts.slice(0, 2).join(', ')}` : 'attested in the Achaemenid Elamite name lexicon (EWB)' };
}

/** roster for the slice, court absent (PEOPLE.md: Terrace 300–600 by day; this slice holds the part on the route) */
const GUARD_POSTS = ['post_stair_n', 'post_stair_s', 'post_gate_w1', 'post_gate_w2', 'post_gate_s1', 'post_gate_s2', 'post_apa_w', 'post_apa_e', 'post_treas_1', 'post_treas_2'];
const SHIFT_START = [6, 14, 22]; // three watches (C)

export class PeopleSim {
  readonly agents: Agent[] = [];
  readonly events: SimEvent[] = [];
  stock = { depot: 30, store: 120 };
  t = 0; // sim hours since the start of the regnal year (clock.t × 24)
  player: P2 | null = null;
  private pathCache = new Map<string, P2[] | null>();
  private lastCaravanDay = -1;
  constructor(readonly seed: number, readonly nav: NavGrid, readonly env: (tHours: number) => Env) { this.makeRoster(); }

  // ------------------------------------------------------------------ roster
  private makeRoster() {
    const rng = new Rng(this.seed, 'people-roster'); const used = new Set<string>();
    let hh = 0;
    const add = (role: Role, sex: 'm' | 'f', origin: string, nameOrigins: string[], dress: Dress, langs: string[], home: string, qa: number, qaTier: string, extra: Partial<Agent> = {}) => {
      const id = this.agents.length; const nm = nameOrigins.length ? pickName(rng, sex, nameOrigins, used) : null;
      const a: Agent = { id, name: nm?.name ?? null, nameTier: nm?.tier ?? '-', nameNote: nm?.note ?? `unnamed ${origin} ${role} (no attested ${origin} names in the pool; the tablets often list such workers by group)`,
        sex, origin, langs, role, dress, household: extra.household ?? hh++, ties: [], ration: { qaPerMonth: qa, tier: qaTier }, home, slot: [0, 0], seed: rng.int(0, 1e9),
        speed: (role === 'child' ? 1.1 : 1.3) * rng.range(0.9, 1.1), pos: [...PLACES[home].at] as P2, y: 0, heading: 0, task: null, path: null, pathI: 0, walking: false, carry: null,
        hunger: rng.range(0, 0.3), fatigue: rng.range(0, 0.3), sick: false, day: -1, decisions: 0, metPlayer: 0, lastMetDay: -1, gait: rng.range(0, 6.28), offmap: home === 'town', relieved: false, ...extra };
      this.agents.push(a); return a;
    };
    // guards: 10 posts × 3 watches; Persian and Median dress alternate as on the reliefs (B); garrison quarters (C)
    const watches: Agent[][] = [[], [], []];
    GUARD_POSTS.forEach((post, pi) => { for (let s = 0; s < 3; s++) {
      const persian = (pi + s) % 2 === 0;
      const g = add('guard', 'm', persian ? 'Persian' : 'Median', ['Iranian'], persian ? 'guard' : 'median', ['Old Persian', 'Aramaic'], 'garrison_sleep', 30, 'C', { post, shift: s });
      watches[s].push(g);
    } });
    for (const w of watches) for (const g of w) g.ties = w.filter(o => o !== g).map(o => o.id);
    // masons: a gang of 12 under a foreman; stonecutters are attested as Syrians, Ionians, Egyptians (PEOPLE §2, B)
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
    // women's work group (grinding, water) with their children; bakers (women's rations incl. maternity: B)
    const women: Agent[] = [];
    for (let i = 0; i < 6; i++) { const w = add(i < 2 ? 'baker' : 'grinder', 'f', i % 2 ? 'Elamite' : 'Persian', i % 2 ? ['Elamite', 'Iranian', 'unknown'] : ['Iranian'], 'woman', i % 2 ? ['Elamite'] : ['Old Persian', 'Elamite'], 'town', 25, 'C'); women.push(w); }
    for (const w of women) w.ties = women.filter(o => o !== w).map(o => o.id);
    for (let i = 0; i < 3; i++) { const mother = women[2 + i]; const c = add('child', i === 1 ? 'f' : 'm', mother.origin, [mother.origin === 'Persian' ? 'Iranian' : 'Elamite'], 'child', mother.langs, 'town', 10, 'C', { household: mother.household }); c.ties = [mother.id]; mother.ties.push(c.id); }
    // couriers and officials
    const cour = [0, 1].map(() => add('courier', 'm', 'Persian', ['Iranian'], 'median', ['Old Persian', 'Aramaic'], 'town', 45, 'C')); cour[0].ties = [cour[1].id]; cour[1].ties = [cour[0].id];
    const offs: Agent[] = []; for (let i = 0; i < 3; i++) offs.push(add('official', 'm', 'Persian', ['Iranian'], 'persian', ['Old Persian', 'Elamite', 'Aramaic'], 'town', 60, 'C'));
    for (const o of offs) o.ties = offs.filter(x => x !== o).map(x => x.id);
    // personal spots: sleeping places, blocks, querns
    const spot = (pl: string, i: number, n: number): P2 => { const P = PLACES[pl]; if (!P.span) return P.at; const [[x0, y0], [x1, y1]] = P.span;
      const cols = Math.ceil(Math.sqrt(n * (x1 - x0) / Math.max(1, y1 - y0))), rows = Math.ceil(n / cols); const c = i % cols, r = Math.floor(i / cols);
      return this.nav.snap(x0 + (c + 0.5) * (x1 - x0) / cols, y0 + (r + 0.5) * (y1 - y0) / rows, 4) ?? P.at; };
    const guards = this.agents.filter(a => a.role === 'guard'); guards.forEach((g, i) => (g.slot = spot('garrison_sleep', i, guards.length)));
    const masons = this.agents.filter(a => a.role === 'mason'); masons.forEach((m, i) => (m.slot = spot('worksite', i, masons.length)));
    const grinders = this.agents.filter(a => a.role === 'grinder' || a.role === 'baker'); grinders.forEach((g, i) => (g.slot = spot('querns', i, grinders.length)));
    for (const a of this.agents) { if (a.slot[0] === 0 && a.slot[1] === 0) a.slot = PLACES[a.home].at; a.pos = [...a.slot] as P2; }
  }

  // ------------------------------------------------------------------ helpers
  private here(a: Agent, pl: string, jitter = 0, rng?: Rng): P2 {
    const P = PLACES[pl]; let [e, n] = P.at;
    if (P.span && rng) { const [[x0, y0], [x1, y1]] = P.span; e = rng.range(x0, x1); n = rng.range(y0, y1); }
    else if (jitter && rng) { const ang = rng.range(0, 2 * Math.PI), r = rng.range(0.8, jitter); e += Math.cos(ang) * r; n += Math.sin(ang) * r; }
    return this.nav.snap(e, n, 5) ?? P.at;
  }
  private task(act: ActivityId, place: string, spot: P2, until: number, why: string, heading?: number): Task {
    const P = PLACES[place]; const face = P.kind === 'hearth' || P.kind === 'oven' ? Math.atan2(P.at[0] - spot[0], P.at[1] - spot[1]) * 180 / Math.PI : null;
    return { act, place, spot, heading: heading ?? P.heading ?? face, until, why };
  }
  private log(kind: string, text: string, place: string) { this.events.push({ t: this.t, kind, text, place }); if (this.events.length > 500) this.events.shift(); }

  // ------------------------------------------------------------------ decisions
  /** choose the next task for an agent at sim time t (hours) */
  decide(a: Agent): Task {
    const day = Math.floor(this.t / 24), hour = this.t - day * 24;
    if (a.day !== day) { a.day = day; a.decisions = 0; const r0 = new Rng(this.seed, `sick:${a.id}:${day}`); a.sick = r0.chance(0.015); }
    const rng = new Rng(this.seed, `d:${a.id}:${day}:${a.decisions++}`);
    const env = this.env(this.t), sun = sunTimes(day);
    const T = (h: number) => day * 24 + h; // absolute hours for today at local hour h
    const storm = env.lightning || env.rain > 0.7, wet = env.rain > 0.25;
    const workStart = sun.rise + 0.4 + rng.range(-0.25, 0.25), workEnd = sun.set - 0.6 + rng.range(-0.25, 0.25);
    const goHome = (why: string) => this.task('offmap', 'town', PLACES.town.at, a.home === 'town' ? T(24 + workStart - 1.2) : this.t + 1, why);
    const meal = (pl: string) => this.task('eat', pl, this.here(a, pl, 2.2, rng), this.t + rng.range(0.5, 0.9), 'meal');

    if (a.role === 'guard') {
      const S = SHIFT_START[a.shift!], rel = ((hour - S) % 24 + 24) % 24;
      const post = PLACES[a.post!];
      if (rel < 8) { a.relieved = false; return this.task('stand_guard', a.post!, post.at, T(hour - rel + 8), 'on watch', post.heading); }
      if (rel < 8.6 && !a.relieved) return this.task('stand_guard', a.post!, post.at, this.t + 0.1, 'waiting to be relieved', post.heading);
      const hearth = ['garrison_hearth_s', 'garrison_hearth_m', 'garrison_hearth_n'][a.shift!];
      if (rel < 9.6 && a.hunger > 0.3) { a.hunger = 0; return meal(hearth); }
      if (rel < 12.5) { const r = rng.next();
        if (r < 0.4) return this.task('gamble', hearth, this.here(a, hearth, 2.5, rng), this.t + rng.range(0.4, 1.2), 'off watch');
        if (r < 0.75) return this.task('talk', hearth, this.here(a, hearth, 3, rng), this.t + rng.range(0.3, 0.8), 'off watch');
        if (r < 0.85 && !wet && hour > 7 && hour < 19) return this.task('talk', 'forecourt', this.here(a, 'forecourt', 0, rng), this.t + rng.range(0.3, 0.7), 'errand in the court');
        return this.task('rest', hearth, this.here(a, hearth, 3, rng), this.t + rng.range(0.3, 1), 'off watch'); }
      if (rel < 22.8) { a.fatigue = 0; return this.task('sleep', 'garrison_sleep', a.slot, T(hour - rel + 22.8), 'asleep'); }
      if (rel < 23.4) { if (a.hunger > 0.5) { a.hunger = 0; return this.task('eat', hearth, this.here(a, hearth, 2.2, rng), T(hour - rel + 23.4), 'breakfast before the watch'); }
        return this.task('talk', hearth, this.here(a, hearth, 3, rng), T(hour - rel + 23.4), 'readying for the watch'); }
      a.relieved = false; return this.task('stand_guard', a.post!, post.at, T(hour - rel + 32), 'going on watch', post.heading);
    }

    // day workers who live in the town
    const dayOff = a.sick || (a.role === 'courier' && !new Rng(this.seed, `courier:${a.id}:${day}`).chance(0.6)) || (a.role === 'official' && !new Rng(this.seed, `off:${a.id}:${day}`).chance(0.8));
    const earlyRoles = a.role === 'baker';
    const start = earlyRoles ? sun.rise - 0.6 : a.role === 'courier' ? 8 + new Rng(this.seed, `cour-h:${a.id}:${day}`).range(0, 6) : a.role === 'official' ? 8.5 : a.role === 'scribe' ? sun.rise + 1.3 : workStart;
    const end = a.role === 'courier' ? start + 1.5 : a.role === 'official' ? 15 : a.role === 'scribe' ? 15.5 : earlyRoles || a.role === 'grinder' || a.role === 'child' ? 14.5 : workEnd;
    if (dayOff || hour < start - 0.1 || hour >= end || (storm && a.role !== 'scribe')) {
      if (hour >= end || dayOff || storm) return this.task('offmap', 'town', PLACES.town.at, hour < start - 0.1 && !dayOff ? T(start) : T(24 + 0.5), storm ? 'storm: work stopped' : a.sick ? 'sick at home' : 'at home in the town');
      return this.task('offmap', 'town', PLACES.town.at, T(start), 'at home in the town');
    }
    if (wet && ['mason', 'foreman', 'porter', 'grinder', 'child', 'official'].includes(a.role)) return this.task('shelter', 'gate_hall', this.here(a, 'gate_hall', 0, rng), this.t + 0.25, 'sheltering from rain');
    const lunch = hour >= 12 && hour < 13 && a.hunger > 0.35;
    switch (a.role) {
      case 'mason': {
        if (lunch) { a.hunger = 0; return meal('work_hearth'); }
        if (rng.chance(0.06)) return this.task('talk', 'worksite', this.here(a, 'worksite', 0, rng), this.t + rng.range(0.1, 0.25), 'a word with the gang');
        return this.task('dress_stone', 'worksite', a.slot, Math.min(T(end), this.t + rng.range(0.6, 1.4)), 'dressing a block', 0);
      }
      case 'foreman': {
        if (lunch) { a.hunger = 0; return meal('work_hearth'); }
        const m = this.agents.filter(x => x.role === 'mason'); const tgt = rng.pick(m);
        return this.task(rng.chance(0.5) ? 'inspect' : 'talk', 'worksite', this.nav.snap(tgt.slot[0] + 1.2, tgt.slot[1] - 1.0, 3) ?? tgt.slot, this.t + rng.range(0.1, 0.35), 'overseeing the gang');
      }
      case 'porter': {
        if (lunch) { a.hunger = 0; return meal('work_hearth'); }
        if (a.carry === 'sack') { return this.task('rest', 'treasury_store', this.here(a, 'treasury_store', 3, rng), this.t + 0.03, 'set the sack down'); }
        if (this.stock.depot > 0 && this.near(a, 'stair_foot', 6)) { this.stock.depot--; a.carry = 'sack'; return this.task('carry_sack', 'treasury_store', this.here(a, 'treasury_store', 3, rng), this.t + 0.02, 'carrying a sack to the Treasury store'); }
        if (this.stock.depot > 0) return this.task('rest', 'stair_foot', this.here(a, 'stair_foot', 3, rng), this.t + 0.02, 'going for the next load');
        return this.task(rng.chance(0.5) ? 'rest' : 'talk', 'stair_foot', this.here(a, 'stair_foot', 3.5, rng), this.t + rng.range(0.2, 0.5), 'waiting for a caravan');
      }
      case 'scribe': {
        if (lunch) { a.hunger = 0; return meal('treasury_desk'); }
        return this.task('write_tablet', 'treasury_desk', this.here(a, 'treasury_desk', 1.8, rng), this.t + rng.range(0.5, 1.2), 'recording issues and payments');
      }
      case 'baker': {
        if (hour < start + 1) return this.task('knead', 'oven', this.nav.snap(PLACES.oven.at[0] - 1.5 - a.id % 2, PLACES.oven.at[1] - 1.2, 2) ?? PLACES.oven.at, T(start + 1), 'kneading dough', 45);
        if (hour < start + 3.5) return this.task('bake', 'oven', this.nav.snap(PLACES.oven.at[0] + (a.id % 2 ? 1 : -1), PLACES.oven.at[1] - 1.0, 2) ?? PLACES.oven.at, T(start + 3.5), 'baking bread', 0);
        if (lunch) { a.hunger = 0; return meal('work_hearth'); }
        return this.task('grind', 'querns', a.slot, this.t + rng.range(0.5, 1), 'grinding flour for tomorrow', 90);
      }
      case 'grinder': {
        if (lunch) { a.hunger = 0; return meal('work_hearth'); }
        if (a.carry === 'jar_head') {
          if (!this.near(a, 'work_hearth', 3.5)) return this.task('carry_jar_head', 'work_hearth', this.here(a, 'work_hearth', 2, rng), this.t + 0.01, 'carrying water to the work camp');
          a.carry = null; this.log('water', 'water brought to the work camp', 'work_hearth'); return this.task('rest', 'work_hearth', this.here(a, 'work_hearth', 2, rng), this.t + 0.05, 'set the water jar down'); }
        if (rng.chance(0.18) && !wet) return this.task('draw_water', 'water', this.here(a, 'water', 1.5, rng), this.t + 0.1, 'fetching water');
        return this.task('grind', 'querns', a.slot, this.t + rng.range(0.4, 0.9), 'grinding grain', 90);
      }
      case 'child': {
        const mom = this.agents[a.ties[0]]; const c = mom.task && !mom.offmap ? mom.pos : PLACES.querns.at;
        const s = this.nav.snap(c[0] + rng.range(-6, 6), c[1] + rng.range(-6, 6), 4) ?? c;
        if (lunch) { a.hunger = 0; return meal('work_hearth'); }
        return this.task(rng.chance(0.6) ? 'play' : 'rest', mom.task?.place ?? 'querns', s, this.t + rng.range(0.15, 0.4), 'near mother');
      }
      case 'courier': {
        if (this.near(a, 'treasury_desk', 4)) return goHome('message delivered');
        return this.task('talk', 'treasury_desk', this.here(a, 'treasury_desk', 2.5, rng), this.t + rng.range(0.15, 0.3), 'delivering a sealed document');
      }
      case 'official': {
        const stops = ['forecourt', 'apadana_hall', 'worksite', 'treasury_desk', 'gate_hall'];
        const pl = rng.pick(stops); const ties = a.ties.map(i => this.agents[i]).filter(o => o.task?.place === pl && !o.offmap);
        return this.task(ties.length ? 'talk' : 'inspect', pl, ties.length ? (this.nav.snap(ties[0].pos[0] + 1.3, ties[0].pos[1], 2) ?? PLACES[pl].at) : this.here(a, pl, 0, rng), this.t + rng.range(0.3, 0.8), `visiting the ${pl.replace('_', ' ')}`);
      }
    }
    return this.task('rest', a.home, a.slot, this.t + 0.5, 'idle');
  }
  private near(a: Agent, pl: string, r: number) { const p = PLACES[pl].at; return Math.hypot(a.pos[0] - p[0], a.pos[1] - p[1]) < r; }

  // ------------------------------------------------------------------ movement
  private routeTo(a: Agent, to: P2): P2[] | null {
    if (this.nav.lineClear(a.pos, to)) return [a.pos, to];
    // cache by grid cell pairs (5 m buckets) so repeated place-to-place trips reuse the search
    const q = (p: P2) => `${Math.round(p[0] / 5)},${Math.round(p[1] / 5)}`; const key = q(a.pos) + '>' + q(to);
    let mid = this.pathCache.get(key);
    if (mid === undefined) { mid = this.nav.findPath(a.pos, to); this.pathCache.set(key, mid); }
    if (!mid) return null;
    const p = mid.slice(); p[0] = a.pos; p[p.length - 1] = to;
    if (p.length > 1 && !this.nav.lineClear(p[0], p[1])) { const f = this.nav.findPath(a.pos, to); return f; }
    return p;
  }
  private begin(a: Agent, task: Task, instant: boolean) {
    a.task = task;
    const wasOff = a.offmap;
    a.offmap = task.act === 'offmap';
    if (a.offmap && !instant && !wasOff && Math.hypot(a.pos[0] - task.spot[0], a.pos[1] - task.spot[1]) > 1) { a.offmap = false; } // walk out to the town edge first
    if (wasOff && !a.offmap) a.pos = [...PLACES.town.at] as P2; // leaving the town: enter at the plain edge
    if (instant) { a.pos = [...task.spot] as P2; a.path = null; a.walking = false; if (task.act === 'offmap') a.offmap = true; this.ground(a); }
    else if (Math.hypot(a.pos[0] - task.spot[0], a.pos[1] - task.spot[1]) > 0.4) { a.path = this.routeTo(a, task.spot); a.pathI = 1; a.walking = !!a.path; if (!a.path) a.pos = [...task.spot] as P2; }
    else { a.path = null; a.walking = false; }
  }

  /** advance by dt game seconds */
  step(dt: number) {
    if (dt <= 0) return;
    this.t += dt * H_PER_S;
    this.events$();
    for (const a of this.agents) this.stepAgent(a, dt);
  }
  /** jump to a new time: everyone is placed where their schedule puts them (continuity after time skips, loads) */
  jumpTo(tHours: number) {
    this.t = tHours; this.events$();
    for (const a of this.agents) { a.carry = null; a.relieved = true; this.begin(a, this.decide(a), true); }
    // porters and guards resolved: nobody half-way along a path
  }
  private events$() {
    const day = Math.floor(this.t / 24), hour = this.t - day * 24;
    // caravans (C): 1–2 a day unload sacks at the stair foot around mid-morning
    if (day !== this.lastCaravanDay && hour >= 9) {
      this.lastCaravanDay = day; const r = new Rng(this.seed, `caravan:${day}`); const n = r.int(1, 2); let sacks = 0;
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
    let budget = dt;
    for (let guard = 0; guard < 8 && budget > 0; guard++) {
      if (a.walking && a.path) {
        const sp = a.speed * (a.carry ? 0.8 : 1);
        while (budget > 0 && a.pathI < a.path.length) {
          const tgt = a.path[a.pathI], de = tgt[0] - a.pos[0], dn = tgt[1] - a.pos[1], d = Math.hypot(de, dn);
          const step = sp * budget;
          if (d <= step) { a.pos = [tgt[0], tgt[1]]; budget -= d / sp; a.pathI++; }
          else { a.pos = [a.pos[0] + de / d * step, a.pos[1] + dn / d * step]; budget = 0; }
          if (d > 1e-3) a.heading = Math.atan2(de, dn) * 180 / Math.PI;
          a.gait += step / 0.72 * Math.PI; // one stride ≈ 1.44 m
        }
        if (a.pathI >= a.path.length) { a.walking = false; a.path = null; if (a.task?.act === 'offmap') a.offmap = true; this.arrive(a); }
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
    // memory of the player (brief §9.5): a meeting = the player within 3 m; counted once a day
    if (this.player && !a.offmap && Math.hypot(this.player[0] - a.pos[0], this.player[1] - a.pos[1]) < 3 && a.lastMetDay !== Math.floor(this.t / 24)) { a.metPlayer++; a.lastMetDay = Math.floor(this.t / 24); }
  }
  private ground(a: Agent) { const y = a.offmap ? 0 : this.nav.heightAt(a.pos[0], a.pos[1]); a.y = Number.isFinite(y) ? y : a.y; }
  private arrive(a: Agent) {
    // a relieving guard releases the one on the post
    if (a.role === 'guard' && a.task?.act === 'stand_guard') for (const o of this.agents) if (o !== a && o.post === a.post && o.task?.act === 'stand_guard') { o.relieved = true; }
  }
  private finish(a: Agent) {
    const act = a.task?.act;
    if (a.role === 'porter' && a.carry === 'sack' && this.near(a, 'treasury_store', 6)) { a.carry = null; this.stock.store++; }
    if (act === 'draw_water') a.carry = 'jar_head';
  }

  /** what the renderer should show for an agent right now */
  performance(a: Agent): { act: ActivityId; moving: boolean } {
    if (a.walking) {
      const act: ActivityId = a.carry === 'sack' ? 'carry_sack' : a.carry === 'jar_head' ? 'carry_jar_head' : a.role === 'guard' && a.task?.act === 'stand_guard' ? 'patrol' : 'walk';
      return { act, moving: true };
    }
    return { act: a.task?.act ?? 'rest', moving: false };
  }
  /** every activity the decision code can emit (for the activity lint) */
  static readonly EMITS: ActivityId[] = ['walk', 'carry_sack', 'carry_jar_head', 'stand_guard', 'patrol', 'dress_stone', 'grind', 'knead', 'bake', 'draw_water', 'write_tablet', 'eat', 'sleep', 'talk', 'rest', 'gamble', 'inspect', 'shelter', 'play', 'offmap'];

  save() { return { t: this.t, stock: { ...this.stock }, lastCaravanDay: this.lastCaravanDay, agents: this.agents.map(a => ({ id: a.id, pos: a.pos, task: a.task, carry: a.carry, hunger: a.hunger, fatigue: a.fatigue, sick: a.sick, day: a.day, decisions: a.decisions, metPlayer: a.metPlayer, lastMetDay: a.lastMetDay, offmap: a.offmap, relieved: a.relieved, heading: a.heading })) }; }
  load(s: any) {
    if (!s?.agents) return; this.t = s.t; this.stock = { ...s.stock }; this.lastCaravanDay = s.lastCaravanDay;
    for (const x of s.agents) { const a = this.agents[x.id]; if (!a) continue; Object.assign(a, { pos: x.pos, task: x.task, carry: x.carry, hunger: x.hunger, fatigue: x.fatigue, sick: x.sick, day: x.day, decisions: x.decisions, metPlayer: x.metPlayer, lastMetDay: x.lastMetDay, offmap: x.offmap, relieved: x.relieved, heading: x.heading });
      a.path = null; a.walking = false; this.ground(a); if (a.task && Math.hypot(a.pos[0] - a.task.spot[0], a.pos[1] - a.task.spot[1]) > 0.4) this.begin(a, a.task, false); }
  }
  static activityOk(id: string) { return id in ACTIVITIES; }
}
