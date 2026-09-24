// The court in residence (D-182; brief §1.1 "the court in full assembly on the Terrace", §9.1, §9.2; BLOCKERS B12).
// ONLY with the out-of-world setting 'Court calendar = seasonal pattern' (?court=seasonal; D-003): the evidence-strict
// default is the court ABSENT (Q-005, B9), and then nothing here exists.
//
// Who (src/data/court.json, research/COURT.md; every count C, sized to population.json zones.terrace.court_resident):
// the king's thousand spearmen (HDT 7.41, Heracleides via Athenaeus 12.514: claims, B) on the garrison's five-day watch
// cycle at ceremonial posts; the women of the royal household, secluded in the building Herzfeld called the Harem; their
// attendants; palace servants; the king's table (cooks, bakers, wine and water staff, servers, in Parmenion's
// proportions: a claim, B); the supply line of porters from the royal stores; butchers at the stockyard; officials,
// secretaries and ushers; Persians of rank in attendance; and petitioners and gift-bearing delegations who come on their
// own days and wait at the Gate and in the forecourt (no procession is staged: brief §2). The king himself is not a
// person here (B9; seclusion): his audience happens out of sight.
//
// They are persons of the Population like anyone (population.ts: `Population.court`, generated after everyone else so
// the court-absent population is untouched), with households, names from the attested pools by origin (names.json) and a
// day plan that is a pure function of (seed, person, day) and the calendar's day (weather, sun). The population view
// (popview.ts) draws them like everyone else: no special rendering path. Their places are Terrace places (the guard
// posts are generated here from court.json's lines; sim.ts adds them to PLACES) and the court's camp below the Terrace
// (popgeo.ts `court_camp`; tents NOT BUILT). Every rule of a day is C.
import courtData from '../data/court.json';
import livesData from '../data/lives.json';
import placesData from '../data/people_places.json';
import townData from '../data/town.json';
import type { Population, Person, Household, Seg, Where, Job } from './population';
import type { ActivityId } from './activities';
import { u01, salt, HStream, poisson } from './hash';
import { REGNAL_DAYS } from './calendar';
import { dustWear, coldWear, wetHours, OPEN_PLACE } from './population'; // (functions only, called after both modules have loaded)

export const COURT = courtData as any;
type P2 = [number, number];
/** a Terrace place of the court (the shape of sim.ts Place; `anchor`: the place whose anchor the spot hangs from, so the
 *  posts of one file share their routes: popgeo.ts) */
export interface CourtPlace { id: string; kind: string; at: P2; heading?: number; span?: [P2, P2]; tier: string; note: string; anchor?: string }
/** one stretch of ten ceremonial posts held by a file for a watch */
export interface Slot { line: string; posts: string[]; night: boolean; what: string }

const LINES: any[] = COURT.guard_lines;
/** the posts of the lines (a file of ten per slot), each line's centre (the anchor of its posts) and the slots */
const GEN = (() => {
  const places: CourtPlace[] = [], slots: Slot[] = [];
  for (const L of LINES) {
    const c: P2 = [(L.a[0] + L.b[0]) / 2, (L.a[1] + L.b[1]) / 2];
    places.push({ id: L.id, kind: 'idle', at: c, heading: L.heading, tier: 'C', note: `ceremonial guard line: ${L.what} (guards on the stairways and at the gates: reliefs B; the line C)` });
    for (let s = 0; s * 10 < L.n; s++) { const posts: string[] = [];
      for (let k = s * 10; k < Math.min(L.n, s * 10 + 10); k++) { const f = L.n === 1 ? 0.5 : k / (L.n - 1), id = `${L.id}_${k}`;
        places.push({ id, kind: 'post', at: [+(L.a[0] + (L.b[0] - L.a[0]) * f).toFixed(2), +(L.a[1] + (L.b[1] - L.a[1]) * f).toFixed(2)], heading: L.heading, tier: 'C', anchor: L.id, note: `a post of the king's spearmen: ${L.what} (C)` });
        posts.push(id); }
      slots.push({ line: L.id, posts, night: !!L.night, what: L.what }); }
  }
  return { places, slots };
})();
/** every Terrace place of the court (sim.ts merges them into PLACES; tests/people.test.ts checks each is walkable) */
export const COURT_PLACES: CourtPlace[] = [...(COURT.places as CourtPlace[]), ...GEN.places];
export const COURT_SLOTS: Slot[] = GEN.slots;
export const NIGHT_SLOTS = COURT_SLOTS.map((s, i) => [s, i] as const).filter(([s]) => s.night).map(([, i]) => i);
/** the court's camp below the Terrace (popgeo.ts resolves `court_camp` to open ground about it) */
export const COURT_CAMP: { c: P2; r: number; note: string } = { c: COURT.camp.c, r: COURT.camp.r, note: COURT.camp.note };

// ------------------------------------------------------------------ places: where they are and how far apart
const FAC: Record<string, P2> = Object.fromEntries((townData as any).facilities.map((f: any) => [f.id, f.at as P2]));
const XY = new Map<string, P2>([...((placesData as any).places as CourtPlace[]), ...COURT_PLACES].map(p => [p.id, p.at]));
const ANCHOR = new Map(COURT_PLACES.filter(p => p.anchor).map(p => [p.id, p.anchor!]));
const TOWN_PLACES = new Set(['court_camp', 'royal_store', 'stockyard', 'terrace_edge']);
const whereOf = (pl: string): Where => pl === '-' ? 'away' : TOWN_PLACES.has(pl) ? 'town' : 'terrace';
const xyOf = (pl: string): P2 => pl === 'court_camp' ? COURT_CAMP.c : FAC[pl] ?? XY.get(pl) ?? [0, 0];
const D = COURT.day;
/** walking hours between two places (C: 1.3 × the straight line at 1.25 m/s, +10 min onto or off the Terrace) */
export function walkHours(a: string, b: string) {
  if (a === b) return 0; const A = xyOf(a), B = xyOf(b); let h = Math.hypot(A[0] - B[0], A[1] - B[1]) * D.detour / D.walk_ms / 3600;
  if ((whereOf(a) === 'terrace') !== (whereOf(b) === 'terrace')) h += D.climb_h; return Math.max(D.min_walk_h, h);
}

// ------------------------------------------------------------------ the people
const S = { gen: salt('court-gen'), plan: salt('court-plan'), vis: salt('court-visitors'), day: salt('court-day'), vig: salt('court-vigil') };
type Group = 'royal_guard' | 'women' | 'attendants' | 'palace' | 'table' | 'porters' | 'butchers' | 'officials' | 'nobles' | 'visitor';
interface Member { g: Group; role: string; sleep: string }
export interface Party { i: number; day: number; leave: number; size: number; petition: boolean; origin: string; gift: string; members: number[]; audience: number }
/** the Population's generation methods (population.ts, private there; used here only to add the court's people) */
interface PopGen { hh(q: string, zone: Household['zone'], persian: boolean, home?: string): number; person(x: Partial<Person> & { sex: 'm' | 'f'; age: number; job: Job; hh: number }): number }
const pickW = <T>(r: HStream, list: [T, number][]): T => { let u = r.next() * list.reduce((s, x) => s + x[1], 0); for (const [v, w] of list) { u -= w; if (u <= 0) return v; } return list[0][0]; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class CourtResidents {
  /** the court's people are pids [first, end) */
  readonly first: number; readonly end: number;
  readonly guards: number[] = [];
  readonly parties: Party[] = [];
  readonly byGroup = new Map<Group, number[]>();
  private mem = new Map<number, Member>();
  readonly firstDay: number = COURT.resident.first_day; readonly lastDay: number = COURT.resident.last_day; readonly leaveDay: number = COURT.resident.leave_day;
  constructor(readonly pop: Population) {
    const P = pop as unknown as PopGen, seed = pop.seed; this.first = pop.persons.length;
    const add = (g: Group, role: string, sleep: string, x: Partial<Person> & { sex: 'm' | 'f'; age: number; job: Job; hh: number }) => {
      const pid = P.person({ zone: 'terrace', arrive: this.firstDay, leave: this.leaveDay, wife: false, single: true, work: sleep, sub: `court:${g}:${role}`, ...x });
      this.mem.set(pid, { g, role, sleep }); (this.byGroup.get(g) ?? this.byGroup.set(g, []).get(g)!).push(pid); return pid; };
    for (const [gi, G] of (COURT.groups as any[]).entries()) {
      const g = G.id as Group; let hh = -1, inHH = 0, lastSleep = '';
      for (let i = 0; i < G.n; i++) {
        const r = new HStream(seed, S.gen, gi * 100000 + i);
        const sleep: string = G.sleep ?? (() => { let u = (i + 0.5) / G.n; for (const [pl, w] of G.sleep_split as [string, number][]) { u -= w; if (u <= 0) return pl; } return G.sleep_split[0][0]; })();
        let origin = pickW<string>(r, G.origins), sex: 'm' | 'f' = G.sex ?? (r.chance(G.sexF ?? 0) ? 'f' : 'm');
        if (g === 'royal_guard') origin = Math.floor(i / 10) % 2 ? 'Median' : 'Persian'; // Persian and Median dress alternate by file (reliefs, B)
        const persian = origin === 'Persian';
        // households: a file of ten (the guard), else ten who sleep at one place (C)
        if (inHH >= 10 || sleep !== lastSleep || hh < 0 || (g === 'royal_guard' && i % 10 === 0)) { hh = P.hh('court', 'terrace', persian, sleep === 'court_camp' ? 'court_camp' : sleep); inHH = 0; lastSleep = sleep; }
        inHH++;
        const job: Job = sex === 'f' && G.jobF ? G.jobF : G.job;
        const role = G.roles ? pickW<string>(r, G.roles) : g;
        const pid = add(g, role, sleep, { sex, age: Math.floor(lerp(G.age[0], G.age[1] + 0.999, r.next())), job, hh, origin,
          ...(g === 'royal_guard' ? { file: Math.floor(i / 10), idx: i % 10, rank: i % 10 === 0 ? 1 : 0 } : {}) });
        if (g === 'royal_guard') this.guards.push(pid);
      }
    }
    // petitioners and delegations (court.json visitors; C): parties arrive on their own days and stay 5-14 days
    const V = COURT.visitors; let pi = 0;
    for (let d = V.first_arrival; d <= V.last_arrival; d++) {
      const n = poisson(u01(seed, S.vis, d), V.parties_per_day);
      for (let k = 0; k < n; k++) { const r = new HStream(seed, S.vis, 1000 + pi, 7);
        const petition = r.chance(V.petitioner_share); const size = petition ? r.int(V.petitioner_size[0], V.petitioner_size[1]) : r.int(V.size[0], V.size[1]);
        const leave = Math.min(this.lastDay, d + r.int(V.stay_days[0], V.stay_days[1])); if (leave - d < 3) continue;
        const origin = r.pick<string>(V.origins), gift = r.pick<string>(V.gifts);
        const pa: Party = { i: pi, day: d, leave, size, petition, origin, gift, members: [], audience: d + 1 + Math.floor(r.next() * (leave - d - 1)) };
        const hh = P.hh('court', 'terrace', origin === 'Persian' || origin === 'Median', 'court_camp');
        for (let m = 0; m < size; m++) { const sex: 'm' | 'f' = petition && r.chance(0.25) ? 'f' : 'm';
          const pid = P.person({ sex, age: Math.floor(lerp(18, 60.999, r.next())), job: 'traveller', hh, origin, zone: 'transient', arrive: d, leave, rank: m === 0 ? 1 : 0, idx: pi, wife: false, single: true, work: 'court_camp', sub: `court:visitor:${petition ? 'petitioner' : 'delegate'}` });
          this.mem.set(pid, { g: 'visitor', role: petition ? 'petitioner' : 'delegate', sleep: 'court_camp' }); pa.members.push(pid); (this.byGroup.get('visitor') ?? this.byGroup.set('visitor', []).get('visitor')!).push(pid); }
        this.parties.push(pa); pi++; }
    }
    this.end = pop.persons.length;
  }
  owns(pid: number) { return pid >= this.first && pid < this.end; }
  member(pid: number) { return this.mem.get(pid) ?? null; }
  /** the court role of a person (dev overlay), or null */
  roleOf(pid: number): string | null {
    const m = this.mem.get(pid); if (!m) return null; const G = (COURT.groups as any[]).find(x => x.id === m.g);
    if (m.g === 'visitor') { const pa = this.parties[this.pop.persons[pid].idx]; return `${m.role === 'petitioner' ? 'a petitioner' : `a delegate of a ${pa.origin} party`} waiting on the king (court setting, C; delegation dress NOT BUILT: placeholder)`; }
    return `${G?.label ?? m.g}${m.role !== m.g ? ` (${m.role})` : ''} (court setting, C: ${G?.src ?? ''})`;
  }
  /** a court person drawn in a placeholder: the delegates' own dress is not built (court.json _meta.placeholders) */
  placeholder(pid: number) { return this.mem.get(pid)?.g === 'visitor'; }

  // ---------------------------------------------------------------- the royal guard's rota (garrison cycle, D-023; C)
  /** 0 = watch A (06-14), 1 = B (14-22), 2 = C (22-06), 3 = off after the night watch, 4 = off */
  phase(pid: number, d: number) { const f = this.pop.persons[pid].file; return ((d + f) % 5 + 5) % 5; }
  /** the slot a file holds on the watch that begins on day `rd` (or -1: the night watch's men without a slot wait within
   *  call at the guards' court). The watch's twenty files take twenty of the slots, moved on by seven each day (C) */
  slotOf(file: number, rd: number): number {
    const w = ((rd + file) % 5 + 5) % 5; if (w > 2) return -1;
    const k = Math.floor(file / 5); // the files of a watch: file ≡ w − rd (mod 5), one in each five
    const n = COURT_SLOTS.length;
    if (w === 2) { const off = ((rd * 3) % NIGHT_SLOTS.length + NIGHT_SLOTS.length) % NIGHT_SLOTS.length; return k < NIGHT_SLOTS.length ? NIGHT_SLOTS[(k + off) % NIGHT_SLOTS.length] : -1; }
    return (k + ((rd * 7 + w * 3) % n + n) % n) % n;
  }
  /** a guard's post on the watch that begins on day `rd` (null: none, or he is sick) */
  postOf(pid: number, rd: number): string | null {
    const p = this.pop.persons[pid]; const s = this.slotOf(p.file, rd); if (s < 0 || this.pop.sick(pid, rd)) return null;
    return COURT_SLOTS[s].posts[p.idx] ?? null;
  }
  /** where a person's plan for day d ends (tomorrow's plan starts there) */
  endPlace(pid: number, d: number): string {
    const m = this.mem.get(pid)!; if (!this.pop.present(pid, d) || d >= this.leaveDay) return '-';
    if (m.g === 'royal_guard' && this.phase(pid, d) === 2 && !this.pop.sick(pid, d)) return this.postOf(pid, d) ?? 'court_guard_mess';
    return m.sleep;
  }
  plan(pid: number, d: number): Seg[] { return new CourtDay(this, pid, d).build(); }
  /** the pairs of Terrace route anchors (popgeo.ts) the court's people walk between on these days: a post hangs from its
   *  line, a place off the Terrace is reached by the stair ('@stair'). The population view searches them up front */
  anchorPairs(days: number[]): [string, string][] {
    const anc = (pl: string) => whereOf(pl) !== 'terrace' ? '@stair' : ANCHOR.get(pl) ?? pl, out = new Map<string, [string, string]>();
    for (const d of days) for (let pid = this.first; pid < this.end; pid++) { if (!this.pop.present(pid, d)) continue; let last: string | null = null;
      for (const s of this.pop.plan(pid, d)) { if (s.where === 'road' || s.where === 'away') continue; const a = anc(s.place);
        if (last !== null && last !== a) { const k = last < a ? `${last}>${a}` : `${a}>${last}`; if (!out.has(k)) out.set(k, last < a ? [last, a] : [a, last]); } last = a; } }
    return [...out.values()];
  }
}

// ------------------------------------------------------------------ one person's day
type Opt = [place: string, act: ActivityId, why: string, w: number, carry?: string];
class CourtDay {
  readonly segs: Seg[] = []; t = 0; cur: string; readonly p: Person; readonly m: Member; readonly r: HStream; readonly C: any; readonly sun: { rise: number; set: number };
  constructor(readonly K: CourtResidents, readonly pid: number, readonly d: number) {
    this.p = K.pop.persons[pid]; this.m = K.member(pid)!; this.r = new HStream(K.pop.seed, S.plan, pid, d);
    this.C = K.pop.cal.ctx(d); this.sun = this.C.sun;
    this.cur = d > this.p.arrive && K.pop.present(pid, d - 1) ? K.endPlace(pid, d - 1) : this.m.g === 'royal_guard' && d === K.firstDay && K.phase(pid, d) === 3 ? (K.postOf(pid, d - 1) ?? 'court_guard_mess') : this.m.sleep;
  }
  add(t1: number, place: string, act: ActivityId, why: string, carry?: string, where = whereOf(place)) {
    t1 = Math.min(24, t1); if (t1 <= this.t + 1e-4) return; const L = this.segs[this.segs.length - 1];
    if (L && L.place === place && L.act === act && L.why === why && L.where === where && L.carry === carry) L.t1 = t1;
    else this.segs.push({ t0: this.t, t1, place, act, why, where, ...(carry ? { carry } : {}) });
    this.t = t1; if (where !== 'road') this.cur = place; if (act === 'eat') this.lastEat = t1;
  }
  /** when the last meal ended (free hours are cut so that the next meal comes within about 7.5 h: C, the plan check's 8) */
  lastEat = -1;
  /** walk (or carry) from where the person is to `to`: a road block of the walking time */
  go(to: string, why = 'walking', act: ActivityId = 'walk', carry?: string) {
    if (to === this.cur) return; const h = walkHours(this.cur, to), a = whereOf(this.cur), b = whereOf(to);
    this.add(this.t + h, `road:${a === 'terrace' || b === 'terrace' ? 'terrace' : 'town'}`, act, why, carry, 'road'); this.cur = to;
  }
  /** at `place` (walking there first) until t1 */
  at(t1: number, place: string, act: ActivityId, why: string, carry?: string) { this.go(place); this.add(Math.max(t1, this.t + 0.02), place, act, why, carry); }
  /** free hours until `until`: spells of 0.5-1.5 h drawn from the options, walking between their places (C) */
  fill(until: number, opts: Opt[]) {
    let last = -1; if (this.lastEat >= 0) until = Math.min(until, this.lastEat + 7.2);
    while (this.t < until - 0.25) {
      const e = this.t + 1.6, dh = this.C.wx.dustH, out = (o: Opt) => OPEN_PLACE.test(o[0]) || o[0] === 'court_camp'; // (D-191, planCheck (a)-(b): out of doors only while dry, at leisure out of the dust, work that needs light in the light)
      const bar = (o: Opt) => /out of the rain/.test(o[2]) ? wetHours(this.C.wx, this.t, e) === 0 : out(o) && (wetHours(this.C.wx, this.t, e) > 0 || (!!dh && dh[0] < e && dh[1] > this.t && /^(talk|gamble|play|rest|spin)$/.test(o[1])) || (/^(wash|train|gamble|craft|spin)$/.test(o[1]) && (this.t < this.sun.rise - 0.4 || e > this.sun.set + 0.4)));
      const ws = opts.map((o, i) => bar(o) ? 0 : (i === last ? o[3] * 0.3 : o[3]) * (this.rainy(this.t) && whereOf(o[0]) !== 'terrace' ? 0.3 : 1)); let u = this.r.next() * ws.reduce((a, b) => a + b, 0), k = 0;
      for (; k < opts.length - 1; k++) { u -= ws[k]; if (u <= 0) break; } last = k; const o = opts[k];
      const t1 = Math.min(until, this.t + walkHours(this.cur, o[0]) + this.r.range(0.5, 1.5)); if (t1 - this.t < 0.3) break;
      this.at(t1, o[0], o[1], o[2], o[4]);
    }
  }
  rainy(t: number) { const w = this.C.wx.rain as [number, number] | null; return !!w && t >= w[0] - 0.5 && t < w[1]; }
  meal(place: string, len: number, why: string) {
    // (not out in the rain: under the stockyard's shed, or the Gate's roof on the Terrace: D-191, planCheck (a); C)
    if (OPEN_PLACE.test(place) && wetHours(this.C.wx, this.t, this.t + len + 0.3) > 0) { if (place === 'stockyard') why += ', under the stockyard’s shed, out of the rain'; else { place = 'gate_hall'; why = why.replace(/ at the stair foot| in the forecourt/, '') + ' under the Gate’s roof, out of the rain'; } }
    this.at(this.t + len, place, 'eat', why); }
  /** sleep at the person's sleeping place from now to 24 (walking there first) */
  night(why = 'asleep') { this.go(this.m.sleep); this.add(24, this.m.sleep, 'sleep', why); }
  /** asleep until `wake` where the day starts */
  morning(wake: number, why = 'asleep') { this.add(wake, this.cur, 'sleep', why); }

  build(): Seg[] {
    const K = this.K, d = this.d, p = this.p;
    if (!K.pop.present(this.pid, d)) { this.add(24, '-', 'offmap', 'not at Persepolis', undefined, 'away'); return this.segs; }
    if (this.m.g === 'visitor') this.visitor();
    else if (d >= K.leaveDay) this.departure();
    else if (K.pop.sick(this.pid, d)) this.sickDay();
    else switch (this.m.g) {
      case 'royal_guard': this.guard(); break;
      case 'women': this.woman(); break;
      case 'attendants': this.attendant(); break;
      case 'palace': this.palace(); break;
      case 'table': this.table(); break;
      case 'porters': this.porter(); break;
      case 'butchers': this.butcher(); break;
      case 'officials': this.official(); break;
      case 'nobles': this.noble(); break;
    }
    if (this.t < 24) this.add(24, this.cur, 'sleep', 'asleep');
    dustWear(this.segs, this.C.wx); coldWear(this.segs, this.C.wx); // (the weather's dress, as the population's: D-191)
    void p; return this.segs;
  }
  // ---------------------------------------------------------------- common days
  /** lying ill at the sleeping place, sitting up now and then, a little food (C); from wherever yesterday ended */
  sickDay() {
    const r = this.r; if (this.cur !== this.m.sleep) this.go(this.m.sleep, 'going back to his sleeping place, unwell');
    let t = this.t; const meals = [r.range(7, 9.5), r.range(12, 14.5), r.range(17.5, 19.5)], sits = [r.range(9.5, 11.5), r.range(15, 17)];
    const ev: [number, ActivityId, string, number][] = [...meals.map(x => [x, 'eat', 'a little food brought to the sick', 0.3] as [number, ActivityId, string, number]), ...sits.map(x => [x, 'rest', 'sitting up for a while in the shade', r.range(0.5, 1.2)] as [number, ActivityId, string, number])].sort((a, b) => a[0] - b[0]);
    for (const [x, a, w, len] of ev) { if (x > t) this.add(x, this.m.sleep, 'lie_ill', 'lying ill'); this.add(Math.max(this.t, x) + len, this.m.sleep, a, w); t = this.t; }
    this.add(24, this.m.sleep, 'lie_ill', 'lying ill');
  }
  /** the court leaves (E-26): up, a meal, ready, and down the road to Susa with it; gone for the rest of the year (C) */
  departure() {
    const r = this.r; if (this.cur.startsWith('cg_')) this.add(6, this.cur, 'stand_guard', 'on watch, the last night of the court’s stay', 'spear with its apple-shaped butt, bow and quiver (reliefs B)');
    else if (this.cur !== this.m.sleep) this.add(6, this.cur, 'rest', 'awake by the fire, within call of the posts');
    else this.morning(this.sun.rise - r.range(0.6, 1.1));
    this.meal(this.m.sleep, 0.3, 'the last breakfast before the road');
    this.at(Math.max(this.t + 0.5, 8.4 + r.range(0, 0.5)), this.m.sleep, 'rest', 'making ready to leave with the court');
    this.go('terrace_edge', 'going down with the court'); this.add(this.t + 1.2, 'road:departure', 'walk', 'leaving with the court on the road to Susa', undefined, 'road');
    this.add(24, '-', 'offmap', 'gone with the court', undefined, 'away');
  }
  // ---------------------------------------------------------------- the king's spearmen (C; the rota D-023's cycle)
  private postBreak(post: string, w0: number, t1: number, why: string) {
    const i = this.p.idx, b = w0 + D.guard_break_first_h + (i % 5) * D.guard_break_step_h + this.r.range(-0.05, 0.05);
    const arms = 'spear with its apple-shaped butt, bow and quiver (reliefs B)';
    if (b > this.t + 0.1 && b + D.guard_meal_break_h < t1 - 0.1) {
      this.add(b, post, 'stand_guard', why, arms); this.go('court_guard_mess', 'relieved for his meal');
      this.add(Math.max(this.t + 0.15, b + D.guard_meal_break_h - walkHours('court_guard_mess', post)), 'court_guard_mess', 'eat', 'bread and water from the king’s table in the guards’ court, relieved at the post');
      this.go(post, 'back to his post'); }
    this.add(t1, post, 'stand_guard', why, arms);
  }
  /** a watch from `w0` (today's hours; may start before 0 for the night watch begun yesterday) to t1 */
  private watch(post: string | null, w0: number, t1: number, night: boolean) {
    if (post) { this.go(post, 'going to his post'); const L = COURT_SLOTS.find(s => s.posts.includes(post))!; this.postBreak(post, w0, t1, `on watch: ${L.what} (the king’s spearmen at full strength, C)`); return; }
    // the night watch's men without a post: within call at the guards' court, awake by the fire; one meal (C)
    this.go('court_guard_mess', 'going to the guards’ court for the night watch');
    const b = w0 + D.guard_break_first_h + (this.p.idx % 5) * D.guard_break_step_h;
    if (b > this.t + 0.1 && b + 0.4 < t1) { this.add(b, 'court_guard_mess', 'rest', 'awake by the fire, within call of the posts'); this.add(b + 0.4, 'court_guard_mess', 'eat', 'bread and water by the fire on the night watch'); }
    this.add(t1, 'court_guard_mess', 'rest', night ? 'awake by the fire, within call of the posts' : 'in reserve at the guards’ court');
  }
  private guardFree(until: number) {
    const off = this.K.phase(this.pid, this.d) === 4;
    this.fill(until, [
      ['court_guard_mess', 'talk', 'talking with the men of his file', 3], ['court_guard_mess', 'gamble', 'knucklebones with the men of his file', 1.5],
      ['court_guard_quarters', 'rest', 'resting in the quarters', 2.5], ['court_guard_quarters', 'craft', 'mending his gear', 1.2], ['water', 'wash', 'washing his clothes at the water of the garrison court', 0.6],
      ['forecourt', 'talk', 'talking with men of another hundred in the forecourt', 0.8],
      ...(off ? [['court_camp', 'train', 'shooting at the mark below the Terrace (drill: C)', 0.8], ['court_camp', 'talk', 'visiting men he knows at the court’s camp', 0.8]] as Opt[] : []),
    ]);
  }
  guard() {
    const K = this.K, d = this.d, r = this.r, ph = K.phase(this.pid, d), Q = 'court_guard_quarters', M = 'court_guard_mess';
    const mealM = (why: string, len = 0.5) => this.meal(M, len, why);
    if (ph === 0) { // watch A 06-14
      this.morning(r.range(4.85, 5.2)); this.meal(Q, 0.3, 'breakfast before the watch');
      this.watch(K.postOf(this.pid, d), 6, 14, false);
      mealM('a meal from the king’s table, carried out to the guards’ court (Heracleides, a claim)', r.range(0.5, 0.8));
      this.guardFree(r.range(18.3, 19)); mealM('the evening meal in the guards’ court'); this.guardFree(r.range(20.8, 21.6)); this.night();
    } else if (ph === 1) { // watch B 14-22
      this.morning(r.range(6, 7.4)); this.meal(Q, 0.35, 'breakfast in the quarters'); this.guardFree(r.range(11.8, 12.5));
      mealM('a meal from the king’s table, carried out to the guards’ court (Heracleides, a claim)', 0.6); this.guardFree(13.8);
      this.watch(K.postOf(this.pid, d), 14, 22, false); this.go(Q, 'back to the quarters after the watch'); this.add(24, Q, 'sleep', 'asleep');
    } else if (ph === 2) { // watch C 22-06, begun tonight
      this.morning(r.range(6.8, 8.2)); this.meal(Q, 0.35, 'breakfast in the quarters'); this.guardFree(r.range(12, 12.8));
      mealM('a meal from the king’s table, carried out to the guards’ court (Heracleides, a claim)', 0.6); this.guardFree(r.range(17, 17.6));
      mealM('the evening meal in the guards’ court', 0.5); this.go(Q); this.add(r.range(21, 21.4), Q, 'sleep', 'a short sleep before the night watch');
      const post = K.postOf(this.pid, d); this.watch(post, 22, 24, true);
    } else if (ph === 3) { // off after the night watch: its second half, then a morning sleep
      const post = this.cur.startsWith('cg_') ? this.cur : null; this.watch(post, -2, 6, true);
      this.go(Q, 'back to the quarters after the night watch'); this.meal(Q, 0.3, 'breakfast after the night watch');
      this.add(r.range(11.4, 12.4), Q, 'sleep', 'a morning sleep after the night watch'); mealM('a meal from the king’s table, carried out to the guards’ court (Heracleides, a claim)', 0.6);
      this.guardFree(r.range(18, 19)); mealM('the evening meal in the guards’ court'); this.guardFree(r.range(20.8, 21.6)); this.night();
    } else { // off
      this.morning(r.range(5.4, 7)); this.meal(Q, 0.35, 'breakfast in the quarters'); this.guardFree(r.range(11.6, 12.6));
      mealM('a meal from the king’s table, carried out to the guards’ court (Heracleides, a claim)', 0.6); this.guardFree(r.range(18, 19));
      mealM('the evening meal in the guards’ court'); this.guardFree(r.range(20.6, 21.6)); this.night();
    }
  }
  // ---------------------------------------------------------------- the royal household (secluded; C)
  woman() {
    const r = this.r, H = 'court_harem', HS = 'court_harem_s';
    // a night of watching with the lamps (Heracleides via Athenaeus 12.514b: a claim; the music is not performed) about one
    // night in five; the woman sleeps late after it (C)
    const vigil = (d: number) => u01(this.K.pop.seed, S.vig, this.pid, d) < 0.2;
    const opts: Opt[] = [[H, 'talk', 'talking with the other women in the court', 3], [H, 'rest', 'resting in the shade of the court', 2], [H, 'spin', 'spinning', 1.5], [HS, 'weave', 'weaving at the loom', 1],
      [HS, 'talk', 'talking with the women in the south wing', 1], [H, 'rest', 'resting while an attendant dresses her hair', 0.6]];
    if (vigil(this.d - 1)) { this.add(r.range(3.6, 4.4), this.cur, 'rest', 'awake with the lamps lit in the women’s court (Heracleides, a claim; no music is shown)'); this.go(this.m.sleep); this.add(r.range(10.5, 11.5), this.m.sleep, 'sleep', 'asleep after the night with the lamps'); }
    else this.morning(r.range(5.6, 7));
    this.meal(H, 0.5, 'breakfast brought from the king’s kitchens'); this.fill(r.range(12, 13), opts);
    this.meal(H, 0.6, 'the midday meal brought from the king’s kitchens'); this.fill(r.range(18.3, 19.3), opts);
    this.meal(H, 0.7, 'the evening meal in the women’s court');
    if (vigil(this.d)) { this.at(24, H, 'rest', 'awake with the lamps lit in the women’s court (Heracleides, a claim; no music is shown)'); return; }
    this.fill(r.range(21, 22), opts); this.night();
  }
  attendant() {
    const r = this.r, f = this.p.sex === 'f', H = 'court_harem';
    this.morning(r.range(4.9, 5.8)); this.meal(this.m.sleep, 0.3, 'breakfast in the south wing');
    const opts: Opt[] = [[H, 'inspect', 'in attendance on the women of the household', 3], [H, 'clean', 'sweeping the women’s court', 1],
      ['court_cistern', 'draw_water', 'drawing water for the women’s court', 0.7], [this.m.sleep, 'rest', 'resting in the south wing', 1],
      ['court_hadish', 'inspect', 'in attendance in the Hadish', f ? 0.3 : 1.2], ...(f ? [[H, 'spin', 'spinning while the women talk', 1]] as Opt[] : [])];
    const serve = (why: string) => { this.at(this.t + r.range(0.2, 0.4), 'court_kitchen', 'rest', 'waiting at the kitchens for the dishes'); this.go(H, why, 'carry_bread', 'dishes from the king’s kitchens'); };
    this.fill(r.range(6.8, 7.4), opts); serve('carrying the women’s breakfast from the kitchens');
    this.fill(r.range(11.5, 12.2), opts); serve('carrying the women’s midday meal from the kitchens');
    this.meal(this.m.sleep, 0.5, 'the midday meal in the south wing'); this.fill(r.range(17.5, 18.2), opts); serve('carrying the women’s evening meal from the kitchens');
    this.fill(r.range(19.2, 19.8), opts); this.meal(this.m.sleep, 0.5, 'the evening meal in the south wing'); this.fill(r.range(20.8, 21.8), opts); this.night();
  }
  palace() {
    const r = this.r, dayOff = (this.d + this.pid) % 7 === 0;
    this.morning(r.range(4.9, 6)); this.meal(this.m.sleep, 0.3, 'breakfast before the day’s work');
    const halls = ['apadana_hall', 'gate_hall', 'court_tachara', 'court_hadish', 'court_portico', 'forecourt', 'court_tripylon'];
    const opts: Opt[] = dayOff ? [[this.m.sleep, 'rest', 'resting on a day free of work', 3], [this.m.sleep, 'talk', 'talking with the other servants', 2], ['court_cistern', 'wash', 'washing clothes at the kitchens’ water', 1]]
      : [...halls.map(h => [h, 'clean', `sweeping ${h === 'forecourt' ? 'the forecourt' : h === 'apadana_hall' ? 'the Apadana' : h === 'gate_hall' ? 'the Gate of All Nations' : h === 'court_portico' ? 'the Apadana portico' : h === 'court_tripylon' ? 'the Tripylon' : h === 'court_hadish' ? 'the Hadish' : 'the Tachara'}`, 1] as Opt),
        ['court_cistern', 'draw_water', 'drawing water for the palaces', 1.2], ['court_table_store', 'rest', 'resting between tasks', 0.8],
        ['apadana_hall', 'inspect', 'standing by in the Apadana in case he is called', 1]];
    this.fill(r.range(11.6, 12.6), opts); this.meal(this.m.sleep === 'court_camp' ? 'court_kitchen' : this.m.sleep, 0.5, 'the midday meal from the kitchens');
    this.fill(r.range(18, 19), opts); this.meal(this.m.sleep, 0.5, 'the evening meal'); this.fill(r.range(20.6, 21.6), [[this.m.sleep, 'rest', 'resting before sleep', 2], [this.m.sleep, 'talk', 'talking with the other servants', 1.5]]); this.night();
  }
  table() {
    const r = this.r, K = 'court_kitchen', B = 'court_bakehouse', ST = 'court_table_store', HD = 'court_hadish', role = this.m.role;
    const dayOff = (this.d + this.pid) % 6 === 0;
    this.morning(r.range(4.3, 5.2)); this.meal(this.m.sleep, 0.3, 'breakfast before the fires are lit');
    if (dayOff) { const o: Opt[] = [[this.m.sleep, 'rest', 'resting on a day free of the kitchens', 3], [this.m.sleep, 'talk', 'talking with the others of the kitchens', 2], ['court_cistern', 'wash', 'washing clothes at the kitchens’ water', 1]];
      this.fill(r.range(12, 13), o); this.meal(this.m.sleep, 0.5, 'the midday meal'); this.fill(r.range(18.5, 19.5), o); this.meal(this.m.sleep, 0.5, 'the evening meal'); this.fill(r.range(20.8, 21.6), o); this.night(); return; }
    const opts: Opt[] = role === 'cook' ? [[K, 'cook', 'at the fires of the king’s kitchens', 4], [ST, 'rest', 'fetching what the cooks need from the table store', 0.6], [K, 'clean', 'sweeping the kitchen court', 0.5]]
      : role === 'baker' ? [[B, 'knead', 'kneading dough for the king’s bread', 2.5], [B, 'bake', 'baking the king’s bread', 2.5], [ST, 'rest', 'fetching flour from the table store', 0.4]]
      : role === 'wine' ? [[ST, 'inspect', 'minding the wine jars in the table store', 1.5], [HD, 'inspect', 'standing by with the wine in the Hadish', 1.5], [K, 'rest', 'resting between tasks', 0.6]]
      : role === 'water' ? [['court_cistern', 'draw_water', 'drawing water for the kitchens', 3], [K, 'rest', 'resting between tasks', 0.6]]
      : [[K, 'carry_jar', 'helping at the kitchens between the meals, carrying in the water', 1.5], /* (not an hour idle at the kitchens: D-191, planCheck (c); C) */ [HD, 'inspect', 'standing in attendance at the table in the Hadish', 2], ['court_guard_mess', 'inspect', 'seeing the guards’ food shared out', 0.6]];
    const trip = () => { // the carrying part of the job, now and then (C)
      if (role === 'wine') { this.go(ST); this.go(HD, 'carrying wine to the king’s table', 'carry_jar', 'a jar of wine'); }
      else if (role === 'water') { this.go('court_cistern'); this.add(this.t + 0.2, 'court_cistern', 'draw_water', 'drawing water for the kitchens'); this.go(K, 'carrying water to the kitchens', 'carry_jar_head', 'a water jar'); }
      else if (role === 'server') { this.go(K); this.go(r.chance(0.6) ? HD : 'court_guard_mess', 'carrying dishes from the kitchens', 'carry_bread', 'bread and dishes from the king’s kitchens'); }
      else if (role === 'baker') { this.go(B); this.go(K, 'carrying bread to the kitchens', 'carry_bread', 'baskets of bread'); } };
    const work = (until: number) => { while (this.t < until - 0.4) { if (role !== 'cook' && r.chance(0.35)) trip(); else this.fill(Math.min(until, this.t + r.range(0.6, 1.6)), opts); } this.fill(until, opts); };
    work(Math.min(r.range(11, 11.8), this.t + 6.4)); this.meal(this.m.sleep === 'court_camp' ? K : this.m.sleep, 0.5, 'the midday meal in the kitchen court');
    work(Math.min(r.range(17.2, 18.2), this.t + 6.6)); this.meal(K, 0.5, 'the evening meal in the kitchen court'); work(r.range(19.8, 20.4)); this.night();
  }
  porter() {
    const r = this.r, RS = 'royal_store', ST = 'court_table_store';
    const dayOff = (this.d + this.pid) % 7 === 0;
    this.morning(r.range(4.8, 5.8)); this.meal(this.m.sleep, 0.3, 'breakfast at the camp');
    if (dayOff) { const o: Opt[] = [[this.m.sleep, 'rest', 'resting at the camp on a day without loads', 3], [this.m.sleep, 'talk', 'talking with the porters at the camp', 2], [this.m.sleep, 'gamble', 'knucklebones with the porters', 1], [this.m.sleep, 'craft', 'mending his carrying pad and ropes', 1]];
      this.fill(r.range(12, 13), o); this.meal(this.m.sleep, 0.5, 'the midday meal at the camp'); this.fill(r.range(18.5, 19.5), o); this.meal(this.m.sleep, 0.5, 'the evening meal at the camp'); this.fill(r.range(20.8, 21.6), o); this.night(); return; }
    const loads: [ActivityId, string, string][] = [['carry_sack', 'carrying flour up from the royal stores to the king’s kitchens', 'a sack of flour'], ['carry_jar', 'carrying wine up from the royal stores to the king’s table store', 'a jar of wine'],
      ['carry_sack', 'carrying barley up from the royal stores to the king’s kitchens', 'a sack of barley'], ['carry_jar', 'carrying oil up from the royal stores', 'a jar of oil']];
    const trips = (until: number) => { while (this.t + 2 * walkHours(RS, ST) + 0.4 < until) { const [a, why, c] = loads[Math.floor(r.next() * loads.length)];
      this.go(RS, 'going down to the royal stores'); this.add(this.t + r.range(0.1, 0.3), RS, 'rest', 'waiting while the storekeeper weighs out the load');
      this.go(ST, why, a, c); this.add(this.t + r.range(0.08, 0.2), ST, 'rest', 'setting the load down in the king’s table store'); if (r.chance(0.25)) this.add(this.t + r.range(0.2, 0.5), ST, 'rest', 'resting before the next load'); } };
    trips(r.range(10.8, 11.6)); this.meal('stair_foot', 0.5, 'the midday meal at the stair foot'); trips(r.range(16, 17)); this.go(this.m.sleep, 'going back to the camp');
    this.fill(r.range(18.5, 19.2), [[this.m.sleep, 'rest', 'resting at the camp after the day’s loads', 3], [this.m.sleep, 'talk', 'talking with the porters at the camp', 2]]);
    this.meal(this.m.sleep, 0.5, 'the evening meal at the camp'); this.fill(r.range(20.6, 21.4), [[this.m.sleep, 'rest', 'resting at the camp', 2], [this.m.sleep, 'gamble', 'knucklebones with the porters', 1]]); this.night();
  }
  butcher() {
    const r = this.r, SY = 'stockyard', dayOff = (this.d + this.pid) % 6 === 0;
    this.morning(r.range(4.6, 5.4)); this.meal(this.m.sleep, 0.3, 'breakfast at the camp');
    if (dayOff) { const o: Opt[] = [[this.m.sleep, 'rest', 'resting at the camp', 3], [this.m.sleep, 'talk', 'talking at the camp', 2], [this.m.sleep, 'craft', 'mending baskets and ropes', 1]];
      this.fill(r.range(12, 13), o); this.meal(this.m.sleep, 0.5, 'the midday meal at the camp'); this.fill(r.range(18.5, 19.5), o); this.meal(this.m.sleep, 0.5, 'the evening meal at the camp'); this.night(); return; }
    this.go(SY, 'going to the stockyard'); const o: Opt[] = [[SY, 'slaughter', 'slaughtering sheep and goats for the king’s table', 3], [SY, 'slaughter', 'slaughtering sheep and goats for the king’s table under the stockyard’s shed, out of the rain', 3], [SY, 'rest', 'resting at the stockyard', 0.6], [SY, 'rest', 'resting under the stockyard’s shed, out of the rain', 0.6]];
    this.fill(r.range(8.5, 9.5), o);
    if (r.chance(0.5)) { this.go('court_kitchen', 'carrying meat up to the king’s kitchens', 'carry_bread', 'baskets of meat'); this.add(this.t + 0.2, 'court_kitchen', 'rest', 'handing the meat over at the kitchens'); this.go(SY, 'going back to the stockyard'); }
    this.fill(r.range(11.8, 12.6), o); this.meal(SY, 0.5, 'the midday meal at the stockyard'); this.fill(r.range(15.5, 16.5), o); this.go(this.m.sleep, 'going back to the camp');
    this.fill(r.range(18.5, 19.2), [[this.m.sleep, 'rest', 'resting at the camp', 2], [this.m.sleep, 'wash', 'washing at the camp', 1]]); this.meal(this.m.sleep, 0.5, 'the evening meal at the camp');
    this.fill(r.range(20.6, 21.4), [[this.m.sleep, 'talk', 'talking at the camp', 1], [this.m.sleep, 'rest', 'resting at the camp', 1]]); this.night();
  }
  official() {
    const r = this.r, role = this.m.role, dayOff = (this.d + this.pid) % 8 === 0;
    this.morning(r.range(5.2, 6.2)); this.meal(this.m.sleep, 0.35, 'breakfast at the camp');
    const camp: Opt[] = [[this.m.sleep, 'rest', 'resting at the camp', 2], [this.m.sleep, 'talk', 'talking with the officials at the camp', 2], [this.m.sleep, 'tend_animals', 'seeing to his horse', 0.6]];
    if (dayOff) { this.fill(r.range(12, 13), camp); this.meal(this.m.sleep, 0.5, 'the midday meal at the camp'); this.fill(r.range(18.5, 19.5), camp); this.meal(this.m.sleep, 0.6, 'the evening meal at the camp'); this.fill(r.range(20.8, 21.8), camp); this.night(); return; }
    const opts: Opt[] = role === 'secretary' ? [['court_tripylon', 'write_tablet', 'writing the court’s letters on clay', 3], ['gate_hall', 'write_tablet', 'recording the parties that come to the Gate', 1.2], ['court_tripylon', 'talk', 'talking over a letter with an official', 0.8]]
      : role === 'usher' ? [['gate_hall', 'inspect', 'an usher looking over the parties waiting at the Gate', 2], ['forecourt', 'inspect', 'an usher seeing the waiting parties in order in the forecourt', 2], ['apadana_hall', 'inspect', 'an usher at the door of the Apadana', 1.5], ['forecourt', 'talk', 'talking with a party’s leader about their audience', 1]]
      : [['court_tripylon', 'talk', 'talking over the court’s business', 2], ['apadana_hall', 'inspect', 'in attendance in the Apadana', 1.5], ['court_apadana_e', 'talk', 'talking with other officials below the Apadana', 1.5], ['gate_hall', 'inspect', 'going over the parties at the Gate', 0.8]];
    this.go('court_apadana_e', 'going up to the Terrace'); this.fill(r.range(12, 12.8), opts); this.meal('court_apadana_e', 0.6, 'a midday meal sent out from the king’s table');
    this.fill(r.range(15.8, 17), opts); this.go(this.m.sleep, 'going down to the camp');
    this.fill(r.range(18.6, 19.4), camp); this.meal(this.m.sleep, 0.6, 'the evening meal at the camp'); this.fill(r.range(20.8, 21.8), camp); this.night();
  }
  noble() {
    const r = this.r, atCourt = u01(this.K.pop.seed, S.day, this.pid, this.d) < 0.72;
    this.morning(r.range(5.4, 6.6)); this.meal(this.m.sleep, 0.4, 'breakfast in his tent at the camp');
    const camp: Opt[] = [[this.m.sleep, 'rest', 'resting at the camp', 2], [this.m.sleep, 'talk', 'talking with other Persians of rank at the camp', 2], [this.m.sleep, 'tend_animals', 'seeing to his horses', 1], [this.m.sleep, 'train', 'shooting at the mark below the Terrace', 0.6]];
    if (!atCourt) { this.fill(r.range(12, 13), camp); this.meal(this.m.sleep, 0.6, 'the midday meal at the camp'); this.fill(r.range(18.5, 19.5), camp); this.meal(this.m.sleep, 0.7, 'the evening meal at the camp'); this.fill(r.range(20.8, 22), camp); this.night(); return; }
    const opts: Opt[] = [['apadana_hall', 'inspect', 'in attendance in the Apadana', 2.5], ['court_portico', 'talk', 'talking with other Persians of rank in the Apadana portico', 2], ['forecourt', 'talk', 'talking with other Persians of rank in the forecourt', 1],
      ['court_apadana_e', 'inspect', 'waiting below the Apadana’s E stair to be called', 1], ['gate_hall', 'talk', 'talking in the Gate of All Nations', 0.6]];
    this.go('forecourt', 'going up to the Terrace'); this.fill(r.range(11.8, 12.6), opts);
    this.meal('court_hadish', r.range(0.8, 1.3), 'a meal at the king’s table, in the hall apart from the king (Heracleides, a claim)');
    this.fill(r.range(15, 16.5), opts); this.go(this.m.sleep, 'going down to the camp');
    this.fill(r.range(18.6, 19.4), camp); this.meal(this.m.sleep, 0.7, 'the evening meal at the camp'); this.fill(r.range(20.8, 22), camp); this.night();
  }
  // ---------------------------------------------------------------- petitioners and delegations (C)
  visitor() {
    const K = this.K, d = this.d, r = this.r, pa = K.parties[this.p.idx], k = d - pa.day, CA = 'court_camp';
    const pr = (x: number) => u01(K.pop.seed, S.vis, 5000 + pa.i, d, x); // the party's shared draws (they go up together)
    const gifts = pa.petition ? undefined : `gifts for the king: ${pa.gift}`;
    const campOpts: Opt[] = [[CA, 'rest', 'resting at the camp', 2], [CA, 'talk', 'talking with the party at the camp', 2], [CA, 'tend_animals', 'seeing to the party’s animals', 1], [CA, 'exchange', 'exchanging goods in kind at the camp', 0.6], [CA, 'wash', 'washing clothes at the camp', 0.4]];
    if (d === pa.day) { // arriving
      // (the night at the last station on the road and a day's stage from it, as the road station's parties: D-196's planCheck
      // (g) found the party "on the road" from midnight, 15 h on foot; the court setting only; C)
      const h = lerp(9.5, 15.5, pr(1)), ST = (livesData as any).travellers_stay.stage_h as [number, number], go = Math.max(this.sun.rise - 0.5, h - 1 - lerp(ST[0], ST[1], pr(8)));
      if (go > 1) { this.add(Math.min(go - 0.4, this.sun.rise + 0.3), '-', 'sleep', `asleep at the last station on the road to the court (${pa.origin} party)`, undefined, 'away');
        if (go - 0.4 - this.t > 0.05) this.add(go - 0.4, '-', 'offmap', `the morning at the last station on the road to the court (${pa.origin} party)`, undefined, 'away'); this.add(go, '-', 'eat', 'a meal at the last station before the road', undefined, 'away'); }
      this.add(h - 1, '-', 'offmap', `on the road to the court (${pa.origin} party)`, undefined, 'away');
      this.add(h, 'road:arrival', 'walk', 'on the road to the court', undefined, 'road'); this.cur = CA;
      this.add(this.t + 0.6, CA, 'tend_animals', 'unloading the party’s animals at the camp');
      if (this.lastEat >= 0 && this.t - this.lastEat > 3) this.meal(CA, 0.5, 'a meal at the camp after the road'); // (the road's food since the station's meal)
      this.fill(Math.max(this.t + 0.5, lerp(18.2, 19, pr(2))), campOpts);
      this.meal(CA, 0.6, 'the evening meal at the camp'); this.fill(lerp(20.8, 21.6, pr(3)), campOpts); this.night(); return; }
    this.morning(lerp(this.sun.rise - 0.5, this.sun.rise + 0.3, pr(4)) + r.range(-0.1, 0.1)); this.meal(CA, 0.4, 'breakfast at the camp');
    if (d === pa.leave) { this.add(this.t + lerp(0.5, 1, pr(5)), CA, 'tend_animals', 'loading the animals to go home'); this.add(this.t + lerp(1, 2, pr(6)), 'road:departure', 'walk', 'on the road home from the court', undefined, 'road'); this.add(24, '-', 'offmap', 'gone home', undefined, 'away'); return; }
    const up = d === pa.audience || pr(7) < 0.6;
    if (!up) { this.fill(lerp(11.5, 12.5, pr(8)), campOpts); this.meal(CA, 0.5, 'the midday meal at the camp'); this.fill(lerp(18.2, 19, pr(9)), campOpts); this.meal(CA, 0.6, 'the evening meal at the camp'); this.fill(lerp(20.8, 21.6, pr(10)), campOpts); this.night(); return; }
    // up to the Terrace: checked at the Gate, waiting in the forecourt (C); shelter under the Apadana portico in rain
    const wait: Opt[] = [['gate_hall', 'queue', 'in the queue at the Gate, waiting to be let through', 0.8], ['forecourt', 'queue', 'waiting in the forecourt to be called', 2.5], ['forecourt', 'rest', 'resting in the forecourt', 1.2], ['forecourt', 'talk', 'talking with other parties in the forecourt', 1], ['court_portico', 'shelter', 'waiting in the shade of the Apadana portico', 0.6]];
    this.fill(lerp(6.6, 8.2, pr(18)), campOpts);
    this.go('gate_hall', 'going up to the Terrace'); this.add(this.t + lerp(0.3, 0.8, pr(11)), 'gate_hall', 'queue', 'in the queue at the Gate, their party shown to the guards', gifts);
    if (d === pa.audience) { // the audience: led up to the Apadana by an usher (reliefs, B), the king out of sight (B9)
      const a0 = lerp(8.5, 10.5, pr(12)); this.fill(a0, wait.map(o => [o[0], o[1], o[2], o[3], gifts] as Opt));
      this.go('apadana_hall', 'led up to the Apadana by an usher', pa.petition ? 'walk' : 'carry_jar', gifts); this.add(this.t + lerp(0.8, 1.6, pr(13)), 'apadana_hall', 'queue', pa.petition ? 'in the queue in the Apadana, waiting to be heard (the king is not shown)' : 'in the queue in the Apadana with the gifts, waiting to be led before the king (the king is not shown)', gifts);
      this.at(this.t + 0.3, 'apadana_hall', 'rest', pa.petition ? 'resting after the audience' : 'resting after the audience, the gifts handed over');
      this.go('forecourt', 'coming out of the Apadana'); this.meal('forecourt', 0.5, 'bread and water in the forecourt'); }
    else { this.fill(lerp(11.3, 12.3, pr(14)), wait); this.meal('forecourt', 0.5, 'bread and water in the forecourt'); this.fill(lerp(14.5, 16, pr(15)), wait); }
    this.go(CA, 'going down to the camp'); this.fill(lerp(18.2, 19, pr(16)), campOpts); this.meal(CA, 0.6, 'the evening meal at the camp'); this.fill(lerp(20.8, 21.6, pr(17)), campOpts); this.night();
  }
}
/** the regnal year length (for tests) */
export const COURT_YEAR = REGNAL_DAYS;
