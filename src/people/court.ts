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
// own days and wait at the Gate and in the forecourt (D-780: and on the days of the peoples' gifts go up in the reliefs' order:
// ceremony.ts; UD-09, UD-10, UD-29 overrule the old 'no procession is staged'). D-199: the delegations wear their
// own peoples' dress (delegations.json, the Apadana reliefs: form B, colours C); the king is a person (B9, Q-335: Xerxes on
// the reliefs' ceremonial dress, with his parasol and fly-whisk bearers and an escort, enthroned in the Apadana on about
// two mornings in five, otherwise inside the Hadish and not drawn); the court's camps have tents (camps.ts); and the
// retinue lodged in camps in the town and on the plain is simulated (Q-333; population.json's court-resident values).
//
// They are persons of the Population like anyone (population.ts: `Population.court`, generated after everyone else so
// the court-absent population is untouched), with households, names from the attested pools by origin (names.json) and a
// day plan that is a pure function of (seed, person, day) and the calendar's day (weather, sun). The population view
// (popview.ts) draws them like everyone else: no special rendering path. Their places are Terrace places (the guard
// posts are generated here from court.json's lines; sim.ts adds them to PLACES), the court's camp below the Terrace
// (popgeo.ts `court_camp`) and the retinue's camps (`rcamp:<id>`), each person at the tent of their household (camps.ts).
// Every rule of a day is C.
import courtData from '../data/court.json';
import livesData from '../data/lives.json';
import placesData from '../data/people_places.json';
import townData from '../data/town.json';
import type { Population, Person, Household, Seg, Where, Job } from './population';
import type { ActivityId } from './activities';
import { u01, salt, HStream, poisson } from './hash';
import { REGNAL_DAYS } from './calendar';
import { dustWear, coldWear, wetHours, wetSpells, OPEN_PLACE } from './population'; // (functions only, called after both modules have loaded)
import { CAMPS, CAMP_BY_ID, campPlace, campOfPlace, layoutCamp, TENT_KINDS, type Tent, type TentKind } from './camps';
import delegationsData from '../data/delegations.json';
import { courtYear, heralds, type CourtYear } from './courtYear';
import { courtSetDays, audienceDraw, isGiftDay, isHuntDay, isRideDay, ceremonyHours, couriersOn, courtProgramme, FEAST_SEATS, FEAST_TABLES, type Ceremony, type CourtSetDays } from './ceremony';

export const COURT = courtData as any;
type P2 = [number, number];
/** a Terrace place of the court (the shape of sim.ts Place; `anchor`: the place whose anchor the spot hangs from, so the
 *  posts of one file share their routes: popgeo.ts) */
export interface CourtPlace { id: string; kind: string; at: P2; heading?: number; span?: [P2, P2]; tier: string; note: string; anchor?: string; hidden?: boolean }
/** one stretch of ten ceremonial posts held by a file for a watch */
export interface Slot { line: string; posts: string[]; night: boolean; what: string }

const LINES: any[] = COURT.guard_lines;
/** the posts of the lines (a file of ten per slot), each line's centre (the anchor of its posts) and the slots */
const GEN = (() => {
  const places: CourtPlace[] = [], slots: Slot[] = [];
  const SPACE: number = COURT.day.file_spacing_m;
  for (const L of LINES) {
    const c: P2 = [(L.a[0] + L.b[0]) / 2, (L.a[1] + L.b[1]) / 2], len = Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]);
    places.push({ id: L.id, kind: 'idle', at: c, heading: L.heading, tier: 'C', note: `ceremonial guard line: ${L.what} (guards on the stairways and at the gates: reliefs B; the line C)` });
    // D-221: the posts stand SPACE apart, centred on the line (a close file, not strung out over the line's length)
    const step = L.n === 1 ? 0 : Math.min(SPACE, len / (L.n - 1)) / len;
    for (let s = 0; s * 10 < L.n; s++) { const posts: string[] = [];
      for (let k = s * 10; k < Math.min(L.n, s * 10 + 10); k++) { const f = 0.5 + (k - (L.n - 1) / 2) * step, id = `${L.id}_${k}`;
        places.push({ id, kind: 'post', at: [+(L.a[0] + (L.b[0] - L.a[0]) * f).toFixed(2), +(L.a[1] + (L.b[1] - L.a[1]) * f).toFixed(2)], heading: L.heading, tier: 'C', anchor: L.id, note: `a post of the king's spearmen: ${L.what}, in a close file ${SPACE} m apart (C; D-221)` });
        posts.push(id); }
      slots.push({ line: L.id, posts, night: !!L.night, what: L.what }); }
  }
  return { places, slots };
})();
/** every Terrace place of the court (sim.ts merges them into PLACES; tests/people.test.ts checks each is walkable) */
export const COURT_PLACES: CourtPlace[] = [...(COURT.places as CourtPlace[]), ...GEN.places];
export const COURT_SLOTS: Slot[] = GEN.slots;
/** D-199: Terrace places of the court that are never drawn (the king's rooms inside the Hadish: popgeo.ts gives them a
 *  spot that is not out of doors); sim.ts merges them into PLACES too */
export const COURT_PRIVATE: CourtPlace[] = COURT.private_places as CourtPlace[];
export const NIGHT_SLOTS = COURT_SLOTS.map((s, i) => [s, i] as const).filter(([s]) => s.night).map(([, i]) => i);
/** the court's camp below the Terrace (popgeo.ts resolves `court_camp` to open ground about it) */
export const COURT_CAMP: { c: P2; r: number; note: string } = { c: COURT.camp.c, r: COURT.camp.r, note: COURT.camp.note };

/** D-221: what the people waiting at a court place wait on, and so face (grid; C): the Apadana's N stair from the forecourt
 *  (its central landing: site_spec apadana platform x -61.5..65.35, N edge y 52, stair zone 7 m), its E stair from the court
 *  below it, the hall's N doorway from the N portico, the throne inside the hall */
/** (a stair is a segment: its 81.67 m run along the façade, site_spec apadana.stairs; one faces the stair where one stands) */
export const FOCUS: Record<string, [P2, P2]> = { n_stair: [[-38.9, 56], [42.7, 56]], e_stair: [[69, -45.7], [69, 35.9]], hall_door: [[1.9, 25.4], [1.9, 25.4]], throne: [[1.9, -22.2], [1.9, -22.2]], front: [[1.9, -22.2], [1.9, -22.2]] };
const FOCUS_OF: Record<string, keyof typeof FOCUS> = { forecourt: 'n_stair', forecourt_wait: 'n_stair', court_apadana_e: 'e_stair', court_portico: 'hall_door', court_audience: 'throne', court_audience_front: 'front' };
/** the point a person waiting at `place` at (e, n) looks at, or null (the place has no focus) */
export function focusOf(place: string, e = 0, n = 0): P2 | null {
  const k = FOCUS_OF[place]; if (!k) return null; const [a, b] = FOCUS[k], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const f = L2 > 0 ? Math.max(0, Math.min(1, ((e - a[0]) * dx + (n - a[1]) * dy) / L2)) : 0; return [a[0] + dx * f, a[1] + dy * f];
}
/** D-221: ground in the forecourt that those spread over it keep off: the way between the files of spearmen from the Gate
 *  to the Apadana's N stair, the parties' places (a block of up to five rows behind each place's front row) and the
 *  petitioners' line (C) */
export function courtKeepClear(e: number, n: number): boolean {
  const Wt = COURT.visitors.waiting, L = Wt.line;
  if (Math.abs(e) < 6.8 && n > 60 && n < 100) return true;
  if (e > L.x - 1.6 && e < L.x + (L.lines - 1) * L.gap_m + 0.9 && n > L.y0 - 0.7 && n < L.y0 + L.n * L.step_m + 0.2) return true;
  for (const x of Wt.stations_x) if (Math.abs(e - x) < 2.6) for (const y of Wt.stations_y) if (n > y - 1.6 && n < y + 4.8) return true;
  return false;
}
/** D-221: the acts of waiting that face the focus (talk faces the one talked to, work its work) */
export const FACING_ACTS = /^(queue|rest|inspect|shelter|eat)$/;

// ------------------------------------------------------------------ places: where they are and how far apart
const FAC: Record<string, P2> = Object.fromEntries((townData as any).facilities.map((f: any) => [f.id, f.at as P2]));
const XY = new Map<string, P2>([...((placesData as any).places as CourtPlace[]), ...COURT_PLACES, ...COURT_PRIVATE].map(p => [p.id, p.at]));
const ANCHOR = new Map(COURT_PLACES.filter(p => p.anchor).map(p => [p.id, p.anchor!]));
const TOWN_PLACES = new Set(['court_camp', 'royal_store', 'store_town', 'stockyard', 'terrace_edge', 'station', 'offering_place', 'craft_zone', 'garden_pw']); // (D-252: the road station, where the court is first and last seen; D-780: the magi's fire)
const whereOf = (pl: string): Where => pl === '-' ? 'away' : TOWN_PLACES.has(pl) ? 'town' : pl === 'river' ? 'plain' : pl.startsWith('rcamp:') ? campOfPlace(pl)?.zone ?? 'town' : 'terrace';
const xyOf = (pl: string): P2 => pl === 'court_camp' ? COURT_CAMP.c : pl.startsWith('rcamp:') ? campOfPlace(pl)?.c ?? [0, 0] : FAC[pl] ?? XY.get(pl) ?? [0, 0];
const D = COURT.day;
/** walking hours between two places (C: 1.3 × the straight line at 1.25 m/s, +10 min onto or off the Terrace) */
export function walkHours(a: string, b: string) {
  if (a === b) return 0; const A = xyOf(a), B = xyOf(b); let h = Math.hypot(A[0] - B[0], A[1] - B[1]) * D.detour / D.walk_ms / 3600;
  if ((whereOf(a) === 'terrace') !== (whereOf(b) === 'terrace')) h += D.climb_h; return Math.max(D.min_walk_h, h);
}

// ------------------------------------------------------------------ the people
const S = { arr: salt('court-arrive'), gen: salt('court-gen'), plan: salt('court-plan'), vis: salt('court-visitors'), day: salt('court-day'), vig: salt('court-vigil'), aud: salt('court-audience'), king: salt('court-king'), ret: salt('court-retinue'), face: salt('court-face'), cer: salt('court-ceremony'), cour: salt('court-courier') };
const CE = COURT.ceremony;
type Group = 'royal_guard' | 'women' | 'attendants' | 'palace' | 'table' | 'porters' | 'butchers' | 'officials' | 'nobles' | 'visitor' | 'king' | 'retinue' | 'herald' | 'courier';
interface Member { g: Group; role: string; sleep: string }
/** D-210 (gap audit item 17): the animals a party brings, as its people's delegation on the Apadana reliefs leads them
 *  (delegations.json `animal`, the relief carving's own list: B imagery, several RECOLLECTION); a petitioner's party, and a
 *  delegation whose gift animal has no rig (the lioness, the okapi, the ibex: not drawn), have their pack animals */
const ANIMAL_WORDS: Record<string, string> = { horse: 'the horses', camel_bactrian: 'the Bactrian camel', dromedary: 'the dromedary', bull: 'the humped bull', ram: 'the fat-tailed rams', wild_ass: 'the wild ass' };
export function partyAnimals(pa: Pick<Party, 'petition' | 'origin'>): string {
  const del = pa.petition ? undefined : DELEGATIONS_BY_ORIGIN.get(pa.origin) as (Deleg & { animal?: string }) | undefined;
  return (del?.animal && ANIMAL_WORDS[del.animal]) || 'the pack animals';
}
/** a party's gift (the delegation's own, delegations.json) and the prop it is carried as: `gifts for the king: ` and the gift */
export interface Party { i: number; day: number; leave: number; size: number; petition: boolean; origin: string; gift: string; members: number[]; audience: number; hh?: number }
/** D-199: the delegations of the Apadana reliefs by origin (dress and gifts) */
interface Deleg { id: string; origin: string; relief: string; gifts: [string, string][]; note: string }
export const DELEGATIONS_BY_ORIGIN: Map<string, Deleg> = new Map(((delegationsData as any).peoples as Deleg[]).map(d => [d.origin, d]));
/** D-780: the order of the delegations on the Apadana's E stair (relief I, the Medes, first) */
const RELIEF_ORDER: Map<string, number> = new Map(((delegationsData as any).peoples as Deleg[]).map((d, i) => [d.origin, i]));
/** D-199: the king and his attendants (court.json king) and the retinue's groups (court.json retinue) */
export const KING = COURT.king;
interface RetGroup { id: string; label: string; n: number; zone: 'town' | 'plain'; job: Job; sex?: 'm' | 'f'; sexF?: number; age: [number, number]; origins: [string, number][]; work: string; camp?: string }
export const RETINUE: RetGroup[] = COURT.retinue.groups;
const RET_BY_ID = new Map(RETINUE.map(g => [g.id, g]));
/** the kind of tent each group lodges in (C) */
const TENT_OF_GROUP: Record<string, TentKind> = { nobles: 'pavilion', officials: 'pavilion', porters: 'black', butchers: 'black', palace: 'ridge', table: 'ridge',
  households: 'ridge', grooms: 'black', baggage: 'black', followers: 'ridge', soldiers_town: 'ridge', herds: 'black', convoys: 'black', soldiers_plain: 'ridge' };
/** the king's day (shared by the king, his bearers and his escort so that they go together): audience or not, and when he
 *  sits (from a0 to a1) */
export interface KingDay { aud: boolean; a0: number; a1: number }
/** what a court person looks like beyond the job's dress (popview.lookInput): the delegation's dress, the king's, the
 *  attendants' pieces (D-199) */
export interface CourtLook { dress?: string; delegation?: string; pieces?: string[]; beardless?: boolean; stature?: number }
/** the Population's generation methods (population.ts, private there; used here only to add the court's people) */
interface PopGen { hh(q: string, zone: Household['zone'], persian: boolean, home?: string): number; person(x: Partial<Person> & { sex: 'm' | 'f'; age: number; job: Job; hh: number }): number }
const pickW = <T>(r: HStream, list: [T, number][]): T => { let u = r.next() * list.reduce((s, x) => s + x[1], 0); for (const [v, w] of list) { u -= w; if (u <= 0) return v; } return list[0][0]; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** D-221: a party's turn before the king on an audience morning: led up from the forecourt at tIn, before the throne from
 *  tTurn to tDone, its usher (pid, or -1: none on duty for it) */
export interface Turn { party: number; k: number; tIn: number; tTurn: number; tDone: number; usher: number }
/** D-221: the forecourt's order on a day (CourtResidents.dayOrder) */
export interface DayOrder { station: Map<number, number>; line: Map<number, number>; gate: Map<number, number>; turns: Turn[]; turnOf: Map<number, Turn>; usherOf: Map<number, Turn> }
/** D-221: the forecourt's places in the order they are given: the row nearest the stair first, nearest the way first (C) */
const STATION_ORDER: number[] = (() => { const Wt = COURT.visitors.waiting, nx = Wt.stations_x.length, ix: number[] = [];
  for (let j = 0; j < nx * Wt.stations_y.length; j++) ix.push(j);
  return ix.sort((a, b) => Math.floor(a / nx) - Math.floor(b / nx) || Math.abs(Wt.stations_x[a % nx] - 1.9) - Math.abs(Wt.stations_x[b % nx] - 1.9)); })();

export class CourtResidents {
  /** the court's people are pids [first, end) */
  readonly first: number; readonly end: number;
  readonly guards: number[] = [];
  readonly parties: Party[] = [];
  readonly byGroup = new Map<Group, number[]>();
  private mem = new Map<number, Member>();
  /** D-252: the court's year for this seed (courtYear.ts): the king's day (firstDay, the residence's first day), the first
   *  day anyone of it comes (the household ahead), the last day of the residence and the leave day (E-26) */
  readonly year: CourtYear; readonly firstDay: number; readonly lastDay: number; readonly leaveDay: number;
  /** D-252: the hour each person of the court reaches the road station on their arrival day (Person.arrive) */
  private arriveH = new Map<number, number>();
  /** D-252: the heralds (T-F5), by their order in courtYear.heralds */
  readonly heralds: number[] = [];
  /** D-199: the king, his two bearers and his escort (pids) */
  readonly king: number; readonly bearers: { parasol: number; whisk: number }; readonly escort: number[] = [];
  /** D-780: the chiliarch (hazārapatiš), before the throne at every audience (TREAS-AUD, IR-CHIL: B; C) */
  readonly chiliarch: number;
  /** D-780: the court's set days (ceremony.ts: the gift days, the hunts, the birthday, the great banquets) */
  readonly set: CourtSetDays;
  /** D-780: the royal-road couriers of the residence (pids), each riding in on its own day */
  readonly couriers: number[] = [];
  /** D-199: the retinue's people by camp (pids) */
  readonly retinue = new Map<string, number[]>();
  /** D-199: every tent of every camp (camps.ts), and the tent of each household that lodges in one */
  readonly tents: Tent[] = []; private tentOfHH = new Map<number, Tent>(); readonly campRadius = new Map<string, number>();
  constructor(readonly pop: Population) {
    const P = pop as unknown as PopGen, seed = pop.seed; this.first = pop.persons.length;
    this.year = courtYear(seed); this.firstDay = this.year.arrive; this.lastDay = this.year.lastDay; this.leaveDay = this.year.leave;
    // D-252: when each household comes (court.json arrival: the day relative to the king's, the hour it reaches the road
    // station drawn per household so a household comes together; C)
    const AR = COURT.arrival, when = (spec: { day: number; hour: [number, number] }, hh: number): [number, number] => [this.firstDay + spec.day, +lerp(spec.hour[0], spec.hour[1], u01(seed, S.arr, hh)).toFixed(3)];
    let arr: [number, number] = [this.firstDay, 12];
    const add = (g: Group, role: string, sleep: string, x: Partial<Person> & { sex: 'm' | 'f'; age: number; job: Job; hh: number }) => {
      const pid = P.person({ zone: 'terrace', arrive: arr[0], leave: this.leaveDay, wife: false, single: true, work: sleep, sub: `court:${g}:${role}`, ...x });
      this.arriveH.set(pid, arr[1]); this.mem.set(pid, { g, role, sleep }); (this.byGroup.get(g) ?? this.byGroup.set(g, []).get(g)!).push(pid); return pid; };
    // (household, tent kind, camp, the hour of the year its tent is pitched) of the households that lodge in tents, in order
    const campHH: [number, TentKind, string, number][] = [];
    const pitchAt = (camp: string) => arr[0] * 24 + arr[1] + walkHours('station', campPlace(camp)) + 0.25; // (on reaching the camp: C)
    for (const [gi, G] of (COURT.groups as any[]).entries()) {
      const g = G.id as Group; let hh = -1, inHH = 0, lastSleep = '';
      for (let i = 0; i < G.n; i++) {
        const r = new HStream(seed, S.gen, gi * 100000 + i);
        const sleep: string = G.sleep ?? (() => { let u = (i + 0.5) / G.n; for (const [pl, w] of G.sleep_split as [string, number][]) { u -= w; if (u <= 0) return pl; } return G.sleep_split[0][0]; })();
        let origin = pickW<string>(r, G.origins), sex: 'm' | 'f' = G.sex ?? (r.chance(G.sexF ?? 0) ? 'f' : 'm');
        if (g === 'royal_guard') origin = Math.floor(i / 10) % 2 ? 'Median' : 'Persian'; // Persian and Median dress alternate by file (reliefs, B)
        const persian = origin === 'Persian';
        // households: a file of ten (the guard), else ten who sleep at one place (C)
        if (inHH >= 10 || sleep !== lastSleep || hh < 0 || (g === 'royal_guard' && i % 10 === 0)) { hh = P.hh('court', 'terrace', persian, sleep === 'court_camp' ? 'court_camp' : sleep); inHH = 0; lastSleep = sleep;
          const GA = AR.groups[g]; arr = g === 'royal_guard' && Math.floor(i / 10) < GA.advance_files ? when({ day: GA.advance_day, hour: GA.advance_hour }, hh) : when(GA, hh);
          if (sleep === 'court_camp') campHH.push([hh, TENT_OF_GROUP[g] ?? 'ridge', 'court', pitchAt('court')]); }
        inHH++;
        const job: Job = sex === 'f' && G.jobF ? G.jobF : G.job;
        const role = G.roles ? pickW<string>(r, G.roles) : g;
        const pid = add(g, role, sleep, { sex, age: Math.floor(lerp(G.age[0], G.age[1] + 0.999, r.next())), job, hh, origin,
          ...(g === 'royal_guard' ? { file: Math.floor(i / 10), idx: i % 10, rank: i % 10 === 0 ? 1 : 0 } : {}) });
        if (g === 'royal_guard') this.guards.push(pid);
      }
    }
    // D-199: the king (Xerxes, born c. 518: HDT 7.2-3, B claim; 51 in 467, C), his parasol bearer and his fly-whisk and towel
    // bearer (beardless attendants, as the reliefs carve them: B), four spearmen of his escort (Persian and Median dress)
    { arr = [this.firstDay, +this.year.kingHour.toFixed(3)]; // (D-252: the king's hour of his day, his bearers and escort with him)
      const KH = P.hh('court', 'terrace', true, KING.private);
      this.king = add('king', 'king', KING.private, { sex: 'm', age: 51, job: 'official', hh: KH, origin: 'Persian', nm: 'Xšayāršā' } as any); // (the name as his inscriptions write it, XPa-XPh: A)
      const AH = P.hh('court', 'terrace', true, 'court_harem_s');
      this.bearers = { parasol: add('king', 'parasol', 'court_harem_s', { sex: 'm', age: 30, job: 'steward', hh: AH, origin: 'Persian' }), whisk: add('king', 'whisk', 'court_harem_s', { sex: 'm', age: 26, job: 'steward', hh: AH, origin: 'Persian' }) };
      // D-780 (C12 pass 4): the crown prince and the king's weapon-bearer behind the throne (the Treasury relief, B; the persons C)
      add('king', 'prince', 'court_harem_s', { sex: 'm', age: 18, job: 'official', hh: AH, origin: 'Persian' }); add('king', 'weapons', 'court_harem_s', { sex: 'm', age: 34, job: 'steward', hh: AH, origin: 'Persian' });
      const EH = P.hh('court', 'terrace', true, 'court_guard_quarters');
      for (let i = 0; i < 4; i++) this.escort.push(add('king', 'escort', 'court_guard_quarters', { sex: 'm', age: 28 + 3 * i, job: 'guard', hh: EH, origin: i % 2 ? 'Median' : 'Persian', idx: i }));
      // D-780: the chiliarch, in the Median dress of the figure before the king on the Treasury relief (TREAS-AUD: B; C)
      const CHH = P.hh('court', 'terrace', false, 'court_camp'); campHH.push([CHH, 'pavilion', 'court', pitchAt('court')]); // (his tent at the court's camp, among the nobles')
      this.chiliarch = add('king', 'chiliarch', 'court_camp', { sex: 'm', age: 46, job: 'official', hh: CHH, origin: 'Median' }); }
    // petitioners and delegations (court.json visitors; C): parties arrive on their own days and stay 5-14 days; D-199: each
    // party is of one of the 23 peoples of the Apadana reliefs, brings its people's gifts, and is led before the king on one of
    // his audience mornings within its stay (none if he gives none then)
    this.set = courtSetDays(seed);
    const V = COURT.visitors; let pi = 0; const visitorTents: { tent: number; kind: TentKind; free: number }[] = [], partyTent: number[] = [];
    for (let d = Math.max(V.first_arrival, this.firstDay + AR.visitors_from); d <= V.last_arrival; d++) { // (D-252: to a king who is there)
      // D-780: more parties come in the days before a day of the peoples' gifts (C)
      const boost = this.set.gift.some(g => g > d && g - d <= CE.gift_days.boost_days) ? CE.gift_days.arrivals_boost : 1;
      const n = poisson(u01(seed, S.vis, d), V.parties_per_day * boost);
      for (let k = 0; k < n; k++) { const r = new HStream(seed, S.vis, 1000 + pi, 7);
        const petition = r.chance(V.petitioner_share); const size = petition ? r.int(V.petitioner_size[0], V.petitioner_size[1]) : r.int(V.size[0], V.size[1]);
        const leave = Math.min(this.lastDay, d + r.int(V.stay_days[0], V.stay_days[1])); if (leave - d < 3) continue;
        const origin = r.pick<string>(V.origins), del = DELEGATIONS_BY_ORIGIN.get(origin), gift = del ? r.pick(del.gifts)[0] : r.pick<string>(['a silver vessel']);
        const days: number[] = []; for (let x = d + 1; x < leave; x++) if (this.audienceDay(x)) days.push(x);
        const u = r.next(); const pa: Party = { i: pi, day: d, leave, size, petition, origin, gift, members: [], audience: days.length ? days[Math.floor(u * days.length)] : -1 };
        // D-780: a delegation at Persepolis on a day of the peoples' gifts goes up on it (the first in its stay; C)
        if (!petition) { const g = this.set.gift.find(x => x > d && x < leave); if (g !== undefined) pa.audience = g; }
        const hh = P.hh('court', 'terrace', origin === 'Persian' || origin === 'Median', 'court_camp');
        for (let m = 0; m < size; m++) { const sex: 'm' | 'f' = petition && r.chance(0.25) ? 'f' : 'm';
          const pid = P.person({ sex, age: Math.floor(lerp(18, 60.999, r.next())), job: 'traveller', hh, origin, zone: 'transient', arrive: d, leave, rank: m === 0 ? 1 : 0, idx: pi, wife: false, single: true, work: 'court_camp', sub: `court:visitor:${petition ? 'petitioner' : 'delegate'}` });
          this.mem.set(pid, { g: 'visitor', role: petition ? 'petitioner' : 'delegate', sleep: 'court_camp' }); pa.members.push(pid); (this.byGroup.get('visitor') ?? this.byGroup.set('visitor', []).get('visitor')!).push(pid); }
        // a tent of the camp's visitors' lines, free since the last party left it (the parties' tents come after the residents')
        const kind: TentKind = size > 10 ? 'black' : 'ridge'; let vt = visitorTents.find(t => t.kind === kind && t.free <= d);
        if (!vt) { vt = { tent: visitorTents.length, kind, free: 0 }; visitorTents.push(vt); } vt.free = leave + 1; partyTent.push(vt.tent); pa.hh = hh;
        this.parties.push(pa); pi++; }
    }
    // D-199: the retinue lodged in camps in the town and on the plain (court.json retinue; Q-333; every count and rule C).
    // Households of ten in a tent; a group without a camp of its own is spread over the town's camps household by household
    const townCamps = CAMPS.filter(c => c.zone === 'town' && c.id !== 'court').map(c => c.id);
    for (const [gi, G] of RETINUE.entries()) { let hh = -1, inHH = 0, nh = 0, camp = '';
      for (let i = 0; i < G.n; i++) { const r = new HStream(seed, S.ret, gi * 100000 + i);
        const origin = pickW<string>(r, G.origins), sex: 'm' | 'f' = G.sex ?? (r.chance(G.sexF ?? 0) ? 'f' : 'm');
        if (inHH >= 10 || hh < 0) { camp = G.camp ?? townCamps[nh % townCamps.length]; nh++; hh = P.hh('court', 'terrace', origin === 'Persian', campPlace(camp)); inHH = 0;
          arr = when(AR.retinue[G.id], hh);
          const H = pop.households[hh]; H.xy = [...CAMP_BY_ID.get(camp)!.c] as [number, number]; campHH.push([hh, TENT_OF_GROUP[G.id] ?? 'ridge', camp, pitchAt(camp)]); }
        inHH++;
        const pid = add('retinue', G.id, campPlace(camp), { sex, age: Math.floor(lerp(G.age[0], G.age[1] + 0.999, r.next())), job: G.job, hh, origin });
        (this.retinue.get(camp) ?? this.retinue.set(camp, []).get(camp)!).push(pid); } }
    // D-252 (T-F5): the heralds, couriers of the road riding ahead with the word of the king's coming; each a day and a night
    { const HD = AR.heralds, HH = P.hh('court', 'terrace', true, 'station');
      for (const x of heralds(seed)) { const r = new HStream(seed, S.gen, 900000 + x.i); arr = [x.day, x.hour];
        const pid = P.person({ sex: 'm', age: Math.floor(lerp(20, 38.999, r.next())), job: 'messenger', hh: HH, origin: pickW<string>(r, HD.origins), zone: 'transient', arrive: x.day, leave: x.day + 1, idx: x.i, wife: false, single: true, work: 'station', sub: 'court:herald' });
        this.arriveH.set(pid, x.hour); this.mem.set(pid, { g: 'herald', role: 'herald', sleep: 'station' }); (this.byGroup.get('herald') ?? this.byGroup.set('herald', []).get('herald')!).push(pid); this.heralds.push(pid); } }
    // D-780: the royal-road couriers of the residence, a few a day riding in with letters for the court (ceremony.ts couriersOn;
    // HDT 8.98: B claim; C): each a day and a night, as the heralds
    { const CH = P.hh('court', 'terrace', true, 'station'); let i = 0;
      for (let d = this.firstDay + 1; d < this.leaveDay; d++) for (const hour of couriersOn(seed, d)) { const r = new HStream(seed, S.cour, i);
        const pid = P.person({ sex: 'm', age: Math.floor(lerp(19, 40.999, r.next())), job: 'messenger', hh: CH, origin: pickW<string>(r, CE.couriers.origins), zone: 'transient', arrive: d, leave: d + 1, idx: i++, wife: false, single: true, work: 'station', sub: 'court:courier' });
        this.arriveH.set(pid, hour); this.mem.set(pid, { g: 'courier', role: 'courier', sleep: 'station' }); (this.byGroup.get('courier') ?? this.byGroup.set('courier', []).get('courier')!).push(pid); this.couriers.push(pid); } }
    this.end = pop.persons.length;
    // D-199: the tents (camps.ts): the residents' households in the order they were made, the court camp's visitors' tents
    // after them; each camp laid out once. The court camp's households are placed at the camp's centre for the view
    for (const def of CAMPS) {
      const hs = campHH.filter(x => x[2] === def.id), kinds: TentKind[] = hs.map(x => x[1]);
      if (def.id === 'court') kinds.push(...visitorTents.map(t => t.kind));
      const { tents, r } = layoutCamp(def, kinds); this.campRadius.set(def.id, r); this.tents.push(...tents);
      // D-252: each tent pitched when its household reaches the camp, the visitors' lines with the king's column, and struck on
      // the morning of the leave day (C)
      const strike = this.leaveDay * 24 + 7.5, visPitch = this.firstDay * 24 + this.year.kingHour + 1;
      tents.forEach((t, k) => { t.pitch = +(k < hs.length ? hs[k][3] : visPitch).toFixed(3); t.strike = strike; });
      hs.forEach(([hh], k) => { this.tentOfHH.set(hh, tents[k]); if (def.id === 'court') pop.households[hh].xy = [...def.c] as [number, number]; });
      if (def.id === 'court') this.parties.forEach((pa, k) => { const t = tents[hs.length + partyTent[k]]; this.tentOfHH.set(pa.hh!, t); pop.households[pa.hh!].xy = [...def.c] as [number, number]; });
    }
  }
  owns(pid: number) { return pid >= this.first && pid < this.end; }
  /** D-252: the hour a person of the court reaches the road station on their arrival day (-1: not of the court) */
  arriveHour(pid: number) { return this.arriveH.get(pid) ?? -1; }
  /** D-252: the court's own column (not the visitors, not the heralds): its people's arrival and leave days are the court's
   *  coming and going (tools/soak.ts T-F8) */
  inColumn(pid: number) { const g = this.mem.get(pid)?.g; return !!g && g !== 'visitor' && g !== 'herald' && g !== 'courier'; }
  member(pid: number) { return this.mem.get(pid) ?? null; }
  /** D-199: is day d one of the king's audience mornings (about two in five while the court is resident; C) */
  audienceDay(d: number) { return audienceDraw(this.pop.seed, d) && (isGiftDay(this.pop.seed, d) || !this.pop.sick(this.king, d)); } // (D-780: ceremony.ts; a gift day is held whatever the king's health: the chiliarch receives)
  /** D-780: the court's programme on day d (ceremony.ts), the king's illness taken into account for the audience */
  programme(d: number): Ceremony[] { const P = courtProgramme(this.pop.seed, d); return this.audienceDay(d) || isGiftDay(this.pop.seed, d) ? P : P.filter(e => e.kind !== 'audience'); }
  /** D-780: is the night of day d a great banquet in the Apadana */
  banquetNight(d: number) { return d > this.firstDay && d < this.leaveDay && this.set.banquet.has(d); }
  /** D-780: the king rides out (or hunts) this morning: 'ride' | 'hunt' | null */
  kingOut(d: number): 'ride' | 'hunt' | null { const s = this.pop.seed; if (this.pop.sick(this.king, d)) return null; return isHuntDay(s, d) ? 'hunt' : isRideDay(s, d) ? 'ride' : null; }
  /** D-780 (holes u1): the royal women go out to the paradise this afternoon (about one day in five, not a banquet night: C) */
  womenOut(d: number) { return d > this.firstDay && d < this.leaveDay && !this.banquetNight(d) && u01(this.pop.seed, S.cer, d, 41) < 0.2; }
  womenOutHours(d: number): [number, number] { const a = 14.6 + 0.6 * u01(this.pop.seed, S.cer, d, 42); return [a, a + 2.4]; }
  /** D-780: is a Persian of rank (or a groom, a beater) of today's ride or hunt: a share of each, drawn per person and day (C) */
  inOut(pid: number, d: number, share: number) { return u01(this.pop.seed, S.cer, pid, d) < share; }
  /** D-199: the king's day, shared by his bearers and escort */
  kingDay(d: number): KingDay { const u = (k: number) => u01(this.pop.seed, S.king, d, k), a0 = lerp(KING.audience_start[0], KING.audience_start[1], u(1));
    // D-780: a day of the peoples' gifts begins earlier and lasts while the delegations are led up, a turn each (C)
    if (isGiftDay(this.pop.seed, d)) { const g0 = ceremonyHours(this.pop.seed, d).gift0, n = this.parties.filter(pa => pa.audience === d).length;
      return { aud: true, a0: g0, a1: g0 + Math.min(CE.gift_days.max_len_h, Math.max(2.2, 0.4 + n * CE.gift_days.turn_h)) }; }
    return { aud: this.audienceDay(d), a0, a1: a0 + lerp(KING.audience_len[0], KING.audience_len[1], u(2)) }; }
  /** a party's shared draws on a day (its members go up together: CourtDay.visitor) */
  partyDraw(pa: Party, d: number, x: number) { return u01(this.pop.seed, S.vis, 5000 + pa.i, d, x); }
  /** D-221: the forecourt's order on day d (cached; a pure function of the seed and the day): which parties go up to wait,
   *  each at a place of its own (a delegation's block, a petitioner party's run of the line), those called this morning
   *  first in the order they go before the king, with their turns and ushers. The parties with no place left wait at the camp */
  private orders = new Map<number, DayOrder>();
  dayOrder(d: number): DayOrder {
    let o = this.orders.get(d); if (o) return o; const V = COURT.visitors, Wt = V.waiting;
    o = { station: new Map(), line: new Map(), gate: new Map(), turns: [], turnOf: new Map(), usherOf: new Map() };
    const here = this.parties.filter(pa => d > pa.day && d < pa.leave);
    // the morning's audience: the parties called, in the order they came (C), each in its turn while the king sits
    // (D-780: on a day of the peoples' gifts the delegations go up in the reliefs' order, the petitioners after them: C)
    const gift = isGiftDay(this.pop.seed, d), rel = (pa: Party) => pa.petition ? 99 : RELIEF_ORDER.get(pa.origin) ?? 50;
    const called = here.filter(pa => pa.audience === d).sort((a, b) => (gift ? rel(a) - rel(b) : 0) || a.day - b.day || a.i - b.i);
    if (called.length) { const Kd = this.kingDay(d), slot = Math.min(Wt.turn_max_h, (Kd.a1 - Kd.a0 - 0.2) / called.length);
      // the ushers on duty (not their day off, not ill), one to each party called (C)
      const ushers = (this.byGroup.get('officials') ?? []).filter(pid => this.mem.get(pid)!.role === 'usher' && (d + pid) % 8 !== 0 && this.pop.present(pid, d) && !this.pop.sick(pid, d));
      called.forEach((pa, k) => { const tTurn = Kd.a0 + 0.1 + k * slot, t: Turn = { party: pa.i, k, tIn: tTurn - Math.min(Wt.before_turn_h, 2.5 * slot), tTurn, tDone: tTurn + slot * 0.8, usher: k < ushers.length ? ushers[k] : -1 };
        o!.turns.push(t); o!.turnOf.set(pa.i, t); if (t.usher >= 0) o!.usherOf.set(t.usher, t); }); }
    // who goes up: the parties called, and the others with the day's chance (C); places in that order while there are any
    const up = here.filter(pa => pa.audience === d || this.partyDraw(pa, d, 7) < V.up_share).sort((a, b) => (a.audience === d ? 0 : 1) - (b.audience === d ? 0 : 1) || (o!.turnOf.get(a.i)?.k ?? 0) - (o!.turnOf.get(b.i)?.k ?? 0) || a.i - b.i);
    const NS = Wt.stations_x.length * Wt.stations_y.length; let js = 0, q = 0;
    const LN = Wt.line.n;
    up.forEach((pa, k) => o!.gate.set(pa.i, k % Wt.gate.length));
    for (const pa of up) { if (pa.petition) { if ((q % LN) + pa.size > LN) q = Math.ceil(q / LN) * LN; // (a party is not split between the lines)
      if (q + pa.size <= LN * Wt.line.lines) { o.line.set(pa.i, q); q += pa.size; } } else if (js < NS) o.station.set(pa.i, js++); }
    this.orders.set(d, o); if (this.orders.size > 8) this.orders.delete(this.orders.keys().next().value!); return o;
  }
  /** D-780: does a person dine at the great banquet of night d: the chiliarch; a share of the Persians of rank and of the
   *  senior officials and secretaries (C), not ill, at Persepolis */
  dines(pid: number, d: number): boolean {
    if (!this.banquetNight(d) || !this.pop.present(pid, d) || this.pop.sick(pid, d) || d === this.pop.persons[pid].arrive) return false; const m = this.mem.get(pid); if (!m) return false;
    if (m.role === 'chiliarch') return true;
    return m.g === 'nobles' ? u01(this.pop.seed, S.cer, pid, d, 7) < CE.banquet.nobles : m.g === 'officials' && m.role !== 'usher' ? u01(this.pop.seed, S.cer, pid, d, 7) < CE.banquet.officials : false;
  }
  /** D-780: the seat of a diner at night d's banquet (ceremony.ts FEAST_SEATS, in the order of the diners), or -1 (none left:
   *  they dine in the portico) */
  private seats = new Map<number, Map<number, number>>();
  seatOf(pid: number, d: number): number {
    let m = this.seats.get(d); if (!m) { m = new Map(); let k = 0; for (const g of ['king', 'nobles', 'officials'] as Group[]) for (const q of this.byGroup.get(g) ?? []) if (this.dines(q, d)) m.set(q, k++);
      this.seats.set(d, m); if (this.seats.size > 4) this.seats.delete(this.seats.keys().next().value!); }
    const k = m.get(pid); return k === undefined || k >= FEAST_SEATS.length ? -1 : k;
  }
  /** D-221: does the party wait in the forecourt on day d (it has a place there) */
  upOn(pa: Party, d: number) { const o = this.dayOrder(d); return o.turnOf.has(pa.i) || o.station.has(pa.i) || o.line.has(pa.i); }
  /** D-221: where a person stands in the order of the forecourt, the hall and before the throne (the reliefs' form: each
   *  delegation behind an usher, B; every place C), and the way they face; null when the place has no order for them */
  formationSpot(pid: number, place: string, d: number): { at: P2; heading: number } | null {
    const f = this.formation(pid, place, d); if (f) f.heading += (u01(this.pop.seed, S.face, pid, d) - 0.5) * 12; return f; } // (no one stands ruler-straight: ±6°, C)
  private formation(pid: number, place: string, d: number): { at: P2; heading: number } | null {
    const m = this.mem.get(pid); if (!m) return null; const Wt = COURT.visitors.waiting;
    // D-780: a diner of the great banquet sits at his place round a low table in the Apadana (and stands there in the morning
    // of the king's gifts); the court_audience place is the hall's (C)
    if (place === 'court_audience' && (m.g === 'nobles' || m.g === 'officials' || m.role === 'chiliarch')) { const k = this.seatOf(pid, d); if (k >= 0) return { at: [...FEAST_SEATS[k].at] as P2, heading: FEAST_SEATS[k].heading }; }
    // D-780 (C6's banquet frame: a standing crowd facing the throne): on a banquet night the servers and wine-bearers stand to
    // serve by a table, outside its ring of diners and facing it, and the lamp tenders by the lamp stands along the walls (C)
    if (place === 'court_audience' && this.banquetNight(d) && (m.g === 'table' || m.g === 'palace')) { const h = u01(this.pop.seed, S.face, pid, d, 9);
      if (m.g === 'table') { const t = FEAST_TABLES[Math.floor(h * FEAST_TABLES.length)], a = u01(this.pop.seed, S.face, pid, d, 10) * 2 * Math.PI, R = 1.95;
        const at: P2 = [t[0] + R * Math.sin(a), t[1] + R * Math.cos(a)]; return { at, heading: (Math.atan2(t[0] - at[0], t[1] - at[1]) * 180 / Math.PI + 360) % 360 }; }
      const F = CE.feast_hall, side = Math.floor(h * 4), u = (h * 4 - side) * 2 - 1, half = F.half - 1.2, [cx, cy] = F.centre as P2;
      const at: P2 = side === 0 ? [cx - half, cy + u * half] : side === 1 ? [cx + half, cy + u * half] : side === 2 ? [cx + u * half, cy + half] : [cx + u * half * 0.6 + (u > 0 ? 6 : -6), cy - half];
      return { at, heading: (Math.atan2(cx - at[0], cy - at[1]) * 180 / Math.PI + 360) % 360 }; }
    const o = this.dayOrder(d);
    let pa: Party | undefined, usher = false;
    if (m.g === 'visitor') pa = this.parties[this.pop.persons[pid].idx]; else if (m.role === 'usher') { const t = o.usherOf.get(pid); if (t) { pa = this.parties[t.party]; usher = true; } }
    if (!pa) return null; const mi = usher ? -1 : pa.members.indexOf(pid);
    // a block of `cols` abreast whose front row's middle is at P, facing the heading hd (deg cw from grid north); the usher
    // stands a step ahead of the leader and to his left (C)
    const block = (P: P2, hd: number, cols: number) => { const r = hd * Math.PI / 180, fx = Math.sin(r), fy = Math.cos(r), rx = fy, ry = -fx;
      if (usher) return { at: [P[0] + fx * 1.0 - rx * 0.7, P[1] + fy * 1.0 - ry * 0.7] as P2, heading: hd };
      const row = Math.floor(mi / cols), inRow = Math.min(cols, pa!.size - row * cols), c = mi - row * cols, lat = (c - (inRow - 1) / 2) * Wt.block_lateral_m, back = row * Wt.block_row_m;
      return { at: [P[0] - fx * back + rx * lat, P[1] - fy * back + ry * lat] as P2, heading: hd }; };
    const face = (P: P2, pl: string) => { const f = focusOf(pl, P[0], P[1])!; return Math.atan2(f[0] - P[0], f[1] - P[1]) * 180 / Math.PI; };
    if (place === 'forecourt_wait') {
      const j = o.station.get(pa.i);
      if (j !== undefined) { const nx = Wt.stations_x.length, P: P2 = [Wt.stations_x[STATION_ORDER[j] % nx], Wt.stations_y[Math.floor(STATION_ORDER[j] / nx)]]; return block(P, face(P, place), Wt.block_cols); }
      const q = o.line.get(pa.i); if (q === undefined) return null; const L = Wt.line;
      const li = Math.floor(q / L.n), x = L.x + li * L.gap_m, q0 = q - li * L.n;
      if (usher) return { at: [x - 0.8, L.y0 + (q0 - 0.5) * L.step_m], heading: 180 };
      return { at: [x, L.y0 + (q0 + mi) * L.step_m], heading: 180 }; // (the line faces the stair: S)
    }
    // shown to the guards in the Gate: the party together, at one of the hall's places clear of the way from the W door to
    // the S door, facing the S door (C); not held (parties that come at the same time stand aside for each other)
    if (place === 'gate_hall') { const g = o.gate.get(pa.i); if (g === undefined || usher) return null; return block(Wt.gate[g] as P2, 180, Wt.block_cols); }
    const t = o.turnOf.get(pa.i); if (!t) return null;
    if (place === 'court_audience') { const P: P2 = [Wt.hall_x[t.k % Wt.hall_x.length], Wt.hall_y]; return block(P, 180, Wt.block_cols); }
    if (place === 'court_audience_front') return block(Wt.front as P2, 180, Wt.block_cols);
    return null;
  }
  /** D-199: the tent a person's household lodges in (camps.ts), or null (not in a camp) */
  tentOf(pid: number): Tent | null { return this.tentOfHH.get(this.pop.persons[pid].hh) ?? null; }
  /** D-199: how a court person looks beyond the dress of the job (popview.lookInput): a man of a delegation wears his
   *  people's dress; the king his; his bearers the Persian robe with a fillet, beardless; everyone else as the job */
  lookOf(pid: number): CourtLook | null {
    const m = this.mem.get(pid); if (!m) return null; const p = this.pop.persons[pid];
    if (m.g === 'visitor' && p.sex === 'm') { const del = DELEGATIONS_BY_ORIGIN.get(p.origin); return del ? { delegation: del.id } : null; }
    if (m.g === 'king' && m.role === 'king') return { dress: 'king', stature: 1.66 };
    if (m.g === 'king' && (m.role === 'parasol' || m.role === 'whisk')) return { dress: 'persian', pieces: ['bun', 'fillet'], beardless: true };
    if (m.role === 'prince') return { dress: 'persian', pieces: ['bun', 'beard_short', 'hat_fluted', 'torque', 'earrings', 'bracelets'] }; // D-780: the Treasury relief's crown prince (B)
    if (m.role === 'weapons') return { dress: 'persian', pieces: ['bun', 'beard_long', 'hat_fluted', 'quiver', 'bow', 'earrings'] }; // D-780: the weapon-bearer (B)
    if (m.g === 'women') return { dress: 'court_woman' }; // D-215: the court women's dress (gap audit item 22, B20c)
    if (m.role === 'chiliarch') return { dress: 'median', pieces: ['cap_soft', 'bun', 'akinaka', 'kandys', 'earrings', 'bracelets'] }; // D-780: the Treasury relief's figure (B)
    return null;
  }
  /** the court role of a person (dev overlay), or null */
  roleOf(pid: number): string | null {
    const m = this.mem.get(pid); if (!m) return null; const G = (COURT.groups as any[]).find(x => x.id === m.g);
    if (m.g === 'visitor') { const pa = this.parties[this.pop.persons[pid].idx], del = DELEGATIONS_BY_ORIGIN.get(pa.origin);
      return `${m.role === 'petitioner' ? `a ${pa.origin} petitioner` : `a delegate of a ${pa.origin} party`} waiting on the king (court setting, C)${del ? `; the dress of the ${del.id} of the Apadana reliefs (relief ${del.relief}: form B, colours C, D-199)` : ''}${m.role === 'delegate' ? `; gifts: ${pa.gift}` : ''}`; }
    if (m.g === 'herald') return 'a herald: a courier of the royal road riding ahead of the court with word of the king’s coming (the relay: HDT 8.98, a claim, B; the heralds C, D-252: T-F5)';
    if (m.g === 'courier') return 'a courier of the royal road with letters for the court (the relay: HDT 8.98, a claim, B; the count C: D-780)';
    if (m.role === 'chiliarch') return 'the chiliarch (hazārapatiš), the king’s first officer, before the throne at every audience (TREAS-AUD, IR-CHIL: B; the person C: D-780)';
    if (m.g === 'king') return m.role === 'king' ? 'the king, Xerxes (court setting only, C: nothing places him at Persepolis in 467, Q-005; his dress, crown, staff and lotus as the reliefs carve them, B: D-199)'
      : m.role === 'escort' ? 'a spearman of the king’s escort (court setting, C)' : m.role === 'prince' ? 'the crown prince (the Treasury relief: the figure behind the king, B; the person C: D-780)' : m.role === 'weapons' ? 'the king’s weapon-bearer (the Treasury relief, B; C: D-780)' : `the king’s ${m.role === 'parasol' ? 'parasol bearer' : 'fly-whisk and towel bearer'} (the door-jamb reliefs, B; court setting, C)`;
    if (m.g === 'retinue') { const R = RET_BY_ID.get(m.role); return `${R?.label ?? m.role}, lodged at ${CAMP_BY_ID.get(campOfPlace(m.sleep)?.id ?? '')?.label ?? m.sleep} (the court’s retinue, court setting, C: Q-333, D-199)`; }
    return `${G?.label ?? m.g}${m.role !== m.g ? ` (${m.role})` : ''} (court setting, C: ${G?.src ?? ''})`;
  }
  /** a court person drawn in a placeholder: none since D-199 (the delegates wear their peoples' dress) */
  placeholder(pid: number) { void pid; return false; }

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
    const m = this.mem.get(pid)!; if (!this.pop.present(pid, d) || d >= this.pop.persons[pid].leave) return '-';
    if (d === this.pop.persons[pid].arrive) return m.sleep; // (D-252: no watch on the day they come)
    if (m.g === 'royal_guard' && this.phase(pid, d) === 2 && !this.pop.sick(pid, d)) return this.postOf(pid, d) ?? 'court_guard_mess';
    return m.sleep;
  }
  plan(pid: number, d: number): Seg[] { return new CourtDay(this, pid, d).build(); }
  /** the pairs of Terrace route anchors (popgeo.ts) the court's people walk between on these days: a post hangs from its
   *  line, a place off the Terrace is reached by the stair ('@stair'). The population view searches them up front */
  anchorPairs(days: number[]): [string, string][] {
    const anc = (pl: string) => whereOf(pl) !== 'terrace' ? '@stair' : ANCHOR.get(pl) ?? pl, out = new Map<string, [string, string]>();
    // (D-199: the king's walks to the throne are searched whether or not these days hold an audience; the retinue never
    // comes up to the Terrace)
    for (const [a, b] of [[KING.private, KING.throne], [KING.private, KING.attend.parasol], [KING.private, KING.attend.whisk], ...(KING.attend.escort as string[]).map((g: string) => [KING.gather, g])] as [string, string][]) { const x = anc(a), y = anc(b); out.set(x < y ? `${x}>${y}` : `${y}>${x}`, x < y ? [x, y] : [y, x]); }
    for (const d of days) for (let pid = this.first; pid < this.end; pid++) { if (!this.pop.present(pid, d) || this.mem.get(pid)?.g === 'retinue') continue; let last: string | null = null;
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
    this.add(this.t + h, `road:${a === 'terrace' || b === 'terrace' ? 'terrace' : a === 'plain' && b === 'plain' ? 'plain' : 'town'}`, act, why, carry, 'road'); this.cur = to;
  }
  /** D-780: on horseback from here to `to` at `ms` m/s along the way (the walk's detour; the stair is walked, the horse led,
   *  and is the walk's climb: C). The words say so for the performance (activities.ts: 'on horseback') */
  ride(to: string, why: string, ms: number, carry?: string) {
    if (to === this.cur) return; const A = xyOf(this.cur), B = xyOf(to), a = whereOf(this.cur), b = whereOf(to);
    const h = Math.max(D.min_walk_h, Math.hypot(A[0] - B[0], A[1] - B[1]) * D.detour / ms / 3600 + (a === 'terrace' || b === 'terrace' ? walkHours(this.cur, to) : 0));
    this.add(this.t + h, `road:${a === 'terrace' || b === 'terrace' ? 'terrace' : a === 'plain' && b === 'plain' ? 'plain' : 'town'}`, 'walk', why, carry, 'road'); this.cur = to;
  }
  /** D-780: the king's ride or hunt this morning, for those who go with it: the hours (null: none today) */
  outing(): { kind: 'ride' | 'hunt'; t0: number; t1: number } | null {
    const k = this.K.kingOut(this.d); if (!k) return null; const h = ceremonyHours(this.K.pop.seed, this.d)[k]; return { kind: k, t0: h[0], t1: h[1] };
  }
  /** D-780: the ride or the hunt, from the stair foot (where the horses are brought) out over the plain and back; `lead`: the
   *  king's own party (its words), `beater`: on foot with the beaters. Returns at the stair foot */
  outingRide(o: { kind: 'ride' | 'hunt'; t0: number; t1: number }, who: 'king' | 'escort' | 'noble' | 'groom' | 'beater', carry?: string) {
    const SF = 'stair_foot', HL = 'rcamp:p_horse', RV = 'river', hunt = o.kind === 'hunt', ms = hunt ? CE.hunt.speed_ms : CE.ride.speed_ms;
    const company = who === 'king' ? 'the king' : who === 'escort' ? 'the king’s escort' : who === 'groom' ? 'a groom with the king’s led horses' : 'a Persian of rank';
    if (who === 'beater') { // on foot out to the river reeds with the beaters, driving the game toward the riders (C)
      this.go(RV, 'going out with the beaters to the river reeds for the king’s hunt'); const end = o.t1 - walkHours(RV, this.cur === RV ? HL : this.cur) - 0.2;
      const mid = (this.t + end) / 2; let fed = false;
      while (this.t < end - 0.3) { if (!fed && this.t > mid) { fed = true; this.add(this.t + 0.35, RV, 'eat', 'bread and water brought out to the beaters (C: D-780)'); }
        this.at(Math.min(end, this.t + this.r.range(0.4, 0.9)), RV, 'patrol', 'beating the reeds along the river with the others, driving the game toward the riders (the hunt: Cyr. 1.4, a claim, B; C)'); if (this.t < end - 0.5) this.at(Math.min(end, this.t + this.r.range(0.15, 0.3)), RV, 'rest', 'resting with the beaters while the riders go by'); }
      this.go(HL, 'walking back from the hunt with the beaters'); return; }
    this.at(o.t0 - 0.02, SF, who === 'groom' ? 'tend_animals' : 'rest', who === 'groom' ? 'holding the king’s horses at the stair foot, saddled for the ride' : `waiting at the stair foot while the horses are brought (${company})`, carry);
    const chariot = who === 'king' && !hunt; // (D-780: the king drives in the royal chariot, a groom at the horses' heads: the reliefs, B; the others ride)
    const out = hunt ? `riding out to the hunt on horseback, the bow and quiver at his side (${company}; Cyr. 1.4, a claim: B; C)` : chariot ? 'driving out over the plain in the royal chariot, the parasol held over him (the chariot on the reliefs, B; Cyr. 8.3, a claim: B; C)' : `riding out on horseback over the plain (${company}; the king’s ride: Cyr. 8.3, a claim, B; C)`;
    this.ride(HL, out, ms, carry);
    if (hunt) { const end = o.t1 - 0.7; let k = 0;
      while (this.t < end - 0.4) { const to = k++ % 2 ? HL : RV; this.ride(to, `on horseback in the hunt, riding after the game along the river reeds (${company}; C)`, ms * 1.4, carry);
        if (this.t < end - 0.3) this.add(this.t + this.r.range(0.15, 0.4), to, who === 'groom' ? 'tend_animals' : 'rest', who === 'groom' ? 'holding the spare horses for the hunters' : `reining in by the reeds, watching for the game (${company})`, carry);
        if (k === 4) this.add(this.t + 0.35, to, 'eat', 'a meal brought out to the hunt, eaten standing by the horses (C: D-780)'); } }
    else this.add(Math.max(this.t + 0.2, o.t0 + (o.t1 - o.t0) * 0.5), HL, who === 'groom' ? 'tend_animals' : 'rest', who === 'king' ? 'the king in the royal chariot at the royal horse lines, looking over the horses (C)' : `halting at the royal horse lines with the king (${company})`, carry);
    this.ride(SF, chariot ? 'driving back in the royal chariot to the stair foot' : `riding back on horseback to the stair foot (${company})`, ms, carry);
  }
  /** D-244 (T-D4): an errand in the open (`len` hours of walking and carrying from now) waits for the rain to pass. From now, the
   *  first start at which those hours are dry (the day's wet spells, as the population's ration issue: rainShiftedIssue); the wait
   *  is kept indoors where the person is (the Gate's roof from the open stair foot or forecourt; a tent at the camps, a room at
   *  the royal stores, the table store's roof: C). False when the rain runs on past `until` (not today; waited out to then) */
  dryStart(len: number, until: number): boolean {
    const wx = this.C.wx; let t = this.t;
    for (let k = 0; k < 24 && wetHours(wx, t, t + len) > 0; k++) { const sp = wetSpells(wx).find(x => x[1] > t && x[0] < t + len); if (!sp) break; t = sp[1]; }
    const end = Math.min(t, until); if (end <= this.t + 0.02) return t + len <= until;
    if (OPEN_PLACE.test(this.cur)) this.go(whereOf(this.cur) === 'terrace' ? 'gate_hall' : this.m.sleep, 'going in out of the rain');
    this.add(Math.max(end, this.t + 0.02), this.cur, 'rest', 'waiting indoors for the rain to pass');
    return t + len <= until;
  }
  /** at `place` (walking there first) until t1 */
  at(t1: number, place: string, act: ActivityId, why: string, carry?: string) { this.go(place); this.add(Math.max(t1, this.t + 0.02), place, act, why, carry); }
  /** stay at the current place doing `act` until exactly t1 (when the fill before stopped short of it) */
  until(t1: number, act: ActivityId, why: string) { if (t1 > this.t + 1e-4) this.add(t1, this.cur, act, why); }
  /** free hours until `until`: spells of 0.5-1.5 h drawn from the options, walking between their places (C) */
  fill(until: number, opts: Opt[]) {
    let last = -1; if (this.lastEat >= 0) until = Math.min(until, this.lastEat + 7.2);
    while (this.t < until - 0.25) {
      const e = this.t + 1.6, dh = this.C.wx.dustH, out = (o: Opt) => OPEN_PLACE.test(o[0]) || o[0] === 'court_camp' || o[0].startsWith('rcamp:'); // (D-191, planCheck (a)-(b): out of doors only while dry, at leisure out of the dust, work that needs light in the light)
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
    else if (this.m.g === 'herald' || this.m.g === 'courier') this.herald();
    else if (d === p.arrive) this.arrivalDay();
    else if (d >= K.leaveDay && this.m.g === 'retinue') this.retinueLeaves();
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
      case 'king': if (this.m.role === 'king') this.kingDay(); else if (this.m.role === 'escort') this.escortDay(); else if (this.m.role === 'chiliarch') this.chiliarchDay(); else this.bearerDay(); break;
      case 'retinue': this.retinueDay(); break;
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
    this.leaveBy(this.columnWalk(false));
  }
  /** D-252: down to the road station and away W on the royal road with the column: the walk to the station is drawn (the court
   *  seen going), the road beyond it is not (Q-683) */
  leaveBy([act, why, carry]: [ActivityId, string, string | undefined]) {
    this.go('station', why, act, carry); this.add(this.t + 0.05, 'station', 'rest', 'halting by the road station while the column closes up');
    this.add(this.t + 1.2, 'road:departure', 'walk', 'leaving with the court on the road to Susa', undefined, 'road'); this.add(24, '-', 'offmap', 'gone with the court', undefined, 'away');
  }
  /** D-252: how a person of the court walks in the column (coming, or going when `coming` is false): the act, the words (the
   *  performance's variant reads them: the pack strings of the baggage and the trains, activities.ts) and what is carried (C) */
  columnWalk(coming = true): [ActivityId, string, string | undefined] {
    const g = this.m.g, role = this.m.role, dir = coming ? 'in along the royal road' : 'out along the royal road to Susa', arms = 'spear with its apple-shaped butt, bow and quiver (reliefs B)';
    if (g === 'king') return role === 'king' ? ['royal_walk', `walking ${coming ? 'up from the road station' : 'down to the road station'} at the head of his household, the parasol held over him (door-jamb reliefs, B; the ${coming ? 'arrival' : 'leaving'} on foot C)`, undefined]
      : role === 'parasol' ? ['bear_parasol', `walking behind the king ${dir}, the parasol held over him`, undefined] : role === 'whisk' ? ['bear_whisk', `walking behind the king ${dir} with the fly-whisk and the towel`, undefined]
      : ['patrol', `walking before the king ${dir}`, arms];
    if (g === 'royal_guard') return ['walk', `marching ${dir} with the king’s spearmen`, arms];
    if (g === 'retinue') { const w = RET_BY_ID.get(role)?.work;
      if (w === 'baggage') return ['walk', `leading a string of pack mules of the court’s baggage ${dir}`, undefined];
      if (w === 'convoy') return ['walk', `leading a pack train of the court’s supply trains ${dir}`, undefined];
      if (w === 'horses' || w === 'herds') return ['walk', `with the court’s horses and mules ${dir}`, undefined];
      if (w === 'soldier') return ['walk', `marching ${dir} with the soldiers of the court`, 'spear, bow and quiver']; }
    if (coming && this.d < this.K.firstDay) return ['walk', `coming ${dir} ahead of the court, to make ready for the king`, undefined];
    return ['walk', `${coming ? 'coming' : 'going'} ${dir} with the court’s column`, undefined];
  }
  /** D-252: the day a person of the court comes: the night at the last camp on the road and the morning's march (away: beyond
   *  the road station nothing is drawn, Q-683), in past the road station at the household's hour (court.json arrival), along the
   *  road and up to where they lodge (the Terrace by the Grand Stair; the camps); at a camp the tents pitched first; then
   *  settling in, a meal and the night (C) */
  arrivalDay() {
    const K = this.K, r = this.r, T = K.arriveHour(this.pid), g = this.m.g, SL = this.m.sleep, king = g === 'king' && this.m.role === 'king';
    const home = king ? KING.private : SL, camp = SL === 'court_camp' || SL.startsWith('rcamp:');
    const wake = Math.min(this.sun.rise - r.range(0.5, 0.9), T - 2.2);
    this.add(wake, '-', 'sleep', 'asleep at the last camp on the road from Susa', undefined, 'away');
    this.add(wake + 0.35, '-', 'eat', 'a meal at the last camp before the road', undefined, 'away');
    // (the last stage is a morning's march: no more than the day's stage on foot with the walk from the station, planCheck (g); C)
    this.add(T - r.range(4.2, 4.8), '-', 'offmap', 'at the last camp on the road from Susa, loading the animals and waiting for the column to move', undefined, 'away');
    this.add(T - 0.05, '-', 'offmap', 'on the road from Susa with the court', undefined, 'away');
    this.add(T, 'station', 'rest', 'halting by the road station while the column closes up'); this.cur = 'station';
    const [act, why, carry] = this.columnWalk(true);
    if (king) this.ride('stair_foot', 'arriving in the royal chariot along the royal road from the road station, a groom at the horses’ heads (the chariot on the reliefs, B; C1’s ask: C: D-780)', 2.2); // (D-780: then up the stair on foot)
    this.go(g === 'king' && this.m.role !== 'escort' ? KING.private : g === 'king' ? KING.gather : home, why, act, carry);
    if (camp) this.at(this.t + r.range(0.6, 1.0), SL, 'carry_sack', 'unloading the animals and pitching the tents of the camp');
    else if (g === 'king' && !king) this.go(SL, this.m.role === 'escort' ? 'going to the quarters' : 'going to the south wing');
    const settle: Opt[] = king ? [[KING.private, 'rest', 'resting in the palace after the road', 2], [KING.private, 'talk', 'in council in the palace with the chiliarch (C)', 1]]
      : [[SL, 'rest', 'resting after the road from Susa', 2], [SL, 'talk', 'talking over the road with the others', 1.5]];
    if (g === 'royal_guard' || (g === 'king' && this.m.role === 'escort')) settle.push(['court_guard_mess', 'talk', 'talking with the men of his file in the guards’ court', 1]);
    if (this.t < 15.5) { this.fill(r.range(14.8, 15.4), settle); this.meal(home, 0.4, 'a meal after the road'); }
    this.fill(Math.max(this.t + 0.3, r.range(18.2, 19)), settle); this.meal(home, 0.6, 'the evening meal, the first at Persepolis');
    this.fill(Math.max(this.t + 0.3, r.range(20.8, 21.6)), settle); this.night(king ? 'asleep in the palace' : camp ? 'asleep in the tent' : 'asleep');
  }
  /** D-252 (T-F5): a herald, a courier of the road riding ahead of the court with the word of its coming: in along the royal road
   *  past the road station, up to the Gate of All Nations with the word, back to the station for the night, and away W again at
   *  first light to meet the column (the relay: HDT 8.98, XEN-CYR 8.6.17-18, claims, B; the heralds C) */
  herald() {
    const r = this.r, p = this.p, ST = 'station';
    if (this.m.g === 'courier') return this.courier();
    if (this.d === p.arrive) { const T = this.K.arriveHour(this.pid);
      this.add(Math.min(this.sun.rise - r.range(0.4, 0.8), T - 2.2), '-', 'sleep', 'asleep at a station of the road', undefined, 'away');
      this.add(this.t + 0.3, '-', 'eat', 'a meal at a station of the road before riding on', undefined, 'away');
      this.add(T - 0.05, '-', 'offmap', 'a courier riding ahead of the court on the royal road', undefined, 'away');
      this.add(T, ST, 'rest', 'reining in at the road station'); this.cur = ST;
      this.go('stair_foot', 'a courier riding along the royal road to the Terrace with word that the king is coming');
      this.go('gate_hall', 'going up to the Gate of All Nations with word of the king’s coming');
      this.at(this.t + r.range(0.3, 0.5), 'gate_hall', 'talk', 'giving word of the king’s coming to the officers at the Gate');
      this.go('stair_foot', 'going down to his horse at the stair foot'); this.go(ST, 'a courier riding back to the road station');
      this.at(this.t + r.range(0.3, 0.5), ST, 'tend_animals', 'seeing to his horse at the road station');
      const idle: Opt[] = [[ST, 'rest', 'resting at the road station', 2], [ST, 'talk', 'talking with the grooms of the road station about the court’s coming', 1.5], [ST, 'tend_animals', 'seeing to his horse at the road station', 0.6]];
      this.meal(ST, 0.5, 'a meal at the road station after the ride'); this.fill(Math.max(this.t + 0.4, r.range(18.3, 19)), idle);
      this.meal(ST, 0.5, 'the evening meal at the road station'); this.fill(Math.max(this.t + 0.3, r.range(20.6, 21.4)), idle); this.night('asleep at the road station'); return; }
    this.morning(this.sun.rise - r.range(0.5, 0.8), 'asleep at the road station'); this.meal(ST, 0.3, 'breakfast at the road station');
    this.at(this.t + r.range(0.3, 0.5), ST, 'tend_animals', 'saddling a fresh horse at the road station');
    this.add(this.t + 1, 'road:departure', 'walk', 'a courier riding back along the royal road to meet the court', undefined, 'road'); this.add(24, '-', 'offmap', 'gone to meet the court on the road', undefined, 'away');
  }
  /** D-780: a royal-road courier with letters for the court: in along the royal road at the gallop past the road station, up
   *  to the Gate with the letters (the secretaries take them), back to his horse and the station for the night, and away again
   *  at first light with the answers (HDT 8.98: B claim; C) */
  courier() {
    const r = this.r, ST = 'station', ms = CE.couriers.speed_ms;
    if (this.d === this.p.arrive) { const T = this.K.arriveHour(this.pid);
      this.add(Math.min(this.sun.rise - r.range(0.4, 0.8), T - 2.2), '-', 'sleep', 'asleep at a station of the royal road', undefined, 'away');
      this.add(this.t + 0.3, '-', 'eat', 'a meal at a station of the road before riding on', undefined, 'away');
      this.add(T - 0.05, '-', 'offmap', 'a courier riding the royal road with letters for the court', undefined, 'away');
      this.add(T, ST, 'rest', 'reining in at the road station to change horses'); this.cur = ST;
      this.ride('stair_foot', 'a courier riding at the gallop along the royal road to the Terrace with letters for the court', ms);
      this.go('gate_hall', 'going up to the Gate of All Nations with the letters for the court');
      this.at(this.t + r.range(0.2, 0.4), 'gate_hall', 'talk', 'handing the sealed letters to the king’s secretaries at the Gate');
      this.go('stair_foot', 'going down to his horse at the stair foot'); this.ride(ST, 'a courier riding back to the road station', ms * 0.5);
      this.at(this.t + r.range(0.3, 0.5), ST, 'tend_animals', 'seeing to his horse at the road station');
      const idle: Opt[] = [[ST, 'rest', 'resting at the road station', 2], [ST, 'talk', 'talking with the grooms of the road station', 1.5], [ST, 'tend_animals', 'seeing to his horse at the road station', 0.6]];
      if (this.t < 17.5) { this.meal(ST, 0.5, 'a meal at the road station after the ride'); this.fill(Math.max(this.t + 0.4, r.range(18.3, 19)), idle); }
      this.meal(ST, 0.5, 'the evening meal at the road station'); this.fill(Math.max(this.t + 0.3, r.range(20.6, 21.4)), idle); this.night('asleep at the road station'); return; }
    this.morning(this.sun.rise - r.range(0.5, 0.8), 'asleep at the road station'); this.meal(ST, 0.3, 'breakfast at the road station');
    this.at(this.t + r.range(0.3, 0.5), ST, 'tend_animals', 'saddling a fresh horse at the road station');
    this.add(this.t + 0.6, 'road:departure', 'walk', 'a courier riding out along the royal road with the court’s letters', undefined, 'road'); this.add(24, '-', 'offmap', 'gone along the royal road with the court’s letters', undefined, 'away');
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
    this.meal(H, 0.6, 'the midday meal brought from the king’s kitchens');
    if (this.K.womenOut(this.d) && this.K.inOut(this.pid, this.d * 3 + 2, 0.12)) this.womenOuting(H); // (D-780, holes u1)
    this.fill(r.range(18.3, 19.3), opts);
    this.meal(H, 0.7, 'the evening meal in the women’s court');
    if (vigil(this.d)) { this.at(24, H, 'rest', 'awake with the lamps lit in the women’s court (Heracleides, a claim; no music is shown)'); return; }
    this.fill(r.range(21, 22), opts); this.night();
  }
  /** D-780 (holes u1): a royal women's outing: on about one afternoon in five a party of the household's women goes down to the
   *  paradise W of the town, veiled, among their attendants and eunuchs, and walks and sits in the garden until the evening
   *  (the curtained carriages of the Persian women: Plutarch Them. 26, HDT 7.83, claims, B; the litter is not drawn yet: C) */
  womenOuting(H: string) {
    const G = 'garden_pw', [h0, h1] = this.K.womenOutHours(this.d), r = this.r;
    this.fill(h0 - walkHours(this.cur, G), [[H, 'rest', 'resting in the women’s court before going out', 1]]);
    this.go(G, this.m.g === 'women' ? 'going down to the paradise, veiled, among her attendants and the eunuchs (curtained litters: claims, B; C: D-780)' : 'walking beside the royal women to the paradise');
    this.fill(h1 - walkHours(G, H), [[G, 'rest', this.m.g === 'women' ? 'sitting in the shade of the paradise with the women of the household' : 'in attendance on the royal women in the paradise', 2], [G, 'talk', this.m.g === 'women' ? 'walking and talking in the paradise with the women of the household' : 'keeping the way clear about the royal women in the paradise', 1.5]]);
    this.go(H, 'going back up to the women’s court from the paradise'); void r;
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
    this.meal(this.m.sleep, 0.5, 'the midday meal in the south wing');
    if (this.K.womenOut(this.d) && this.K.inOut(this.pid, this.d * 3 + 2, 0.2)) this.womenOuting(H); // (D-780)
    this.fill(r.range(17.5, 18.2), opts); serve('carrying the women’s evening meal from the kitchens');
    this.fill(r.range(19.2, 19.8), opts); this.meal(this.m.sleep, 0.5, 'the evening meal in the south wing'); this.fill(r.range(20.8, 21.8), opts); this.night();
  }
  /** D-252: a day of the household that comes ahead, before the king's day: making ready (C) */
  get prep() { return this.d < this.K.firstDay; }
  palace() {
    const r = this.r, prep = this.prep, dayOff = !prep && (this.d + this.pid) % 7 === 0;
    this.morning(r.range(4.9, 6)); this.meal(this.m.sleep, 0.3, 'breakfast before the day’s work');
    const halls = ['apadana_hall', 'gate_hall', 'court_tachara', 'court_hadish', 'court_portico', 'forecourt', 'court_tripylon'];
    const opts: Opt[] = dayOff ? [[this.m.sleep, 'rest', 'resting on a day free of work', 3], [this.m.sleep, 'talk', 'talking with the other servants', 2], ['court_cistern', 'wash', 'washing clothes at the kitchens’ water', 1]]
      : [...halls.map(h => [h, 'clean', `sweeping ${h === 'forecourt' ? 'the forecourt' : h === 'apadana_hall' ? 'the Apadana' : h === 'gate_hall' ? 'the Gate of All Nations' : h === 'court_portico' ? 'the Apadana portico' : h === 'court_tripylon' ? 'the Tripylon' : h === 'court_hadish' ? 'the Hadish' : 'the Tachara'}${prep ? ' for the king’s coming' : ''}`, prep ? 1.4 : 1] as Opt),
        ['court_cistern', 'draw_water', prep ? 'drawing water to fill the palaces’ jars before the court comes' : 'drawing water for the palaces', 1.2], ['court_table_store', 'rest', 'resting between tasks', 0.8],
        prep ? ['court_hadish', 'clean', 'setting the Hadish in order for the king', 1] : ['apadana_hall', 'inspect', 'standing by in the Apadana in case he is called', 1]];
    // D-221: the halls and courts where the court waits (the forecourt, the Gate, the Apadana and its portico) are swept
    // before it assembles and after it has gone down, not among the waiting parties (C)
    const OPEN = /^(forecourt|gate_hall|court_portico|apadana_hall)$/, busy = dayOff || prep ? opts : opts.filter(o => !(o[1] === 'clean' && OPEN.test(o[0])));
    this.fill(r.range(7.5, 8.1), opts); this.fill(r.range(11.6, 12.6), busy); this.meal(this.m.sleep === 'court_camp' ? 'court_kitchen' : this.m.sleep, 0.5, 'the midday meal from the kitchens');
    this.fill(r.range(15.6, 16.2), busy);
    // D-780: on a night of a great banquet some of the palace servants set out and tend the lamps in the Apadana (C)
    if (!dayOff && !prep && this.K.banquetNight(this.d) && this.K.inOut(this.pid, this.d, CE.banquet.lamps / Math.max(1, (this.K.byGroup.get('palace') ?? []).length))) {
      const [b0, b1] = ceremonyHours(this.K.pop.seed, this.d).banquet; this.fill(b0 - 1.4, opts); this.meal(this.m.sleep === 'court_camp' ? 'court_kitchen' : this.m.sleep, 0.4, 'an early evening meal before the banquet');
      this.go('court_table_store', 'going for oil for the lamps'); this.go('court_audience', 'carrying oil to fill the lamps for the banquet in the Apadana', 'carry_jar', 'a jar of lamp oil');
      this.add(b0, 'court_audience', 'clean', 'setting out the low tables and filling the lamps on their stands for the banquet (C: D-780)');
      this.add(b1, 'court_audience', 'inspect', 'standing by the lamp stands in the Apadana during the banquet, trimming the wicks (C: D-780)'); this.night(); return; }
    this.fill(r.range(18, 19), opts); this.meal(this.m.sleep, 0.5, 'the evening meal'); this.fill(r.range(20.6, 21.6), [[this.m.sleep, 'rest', 'resting before sleep', 2], [this.m.sleep, 'talk', 'talking with the other servants', 1.5]]); this.night();
  }
  table() {
    const r = this.r, K = 'court_kitchen', B = 'court_bakehouse', ST = 'court_table_store', HD = 'court_hadish', role = this.m.role, prep = this.prep;
    const dayOff = !prep && (this.d + this.pid) % 6 === 0;
    this.morning(r.range(4.3, 5.2)); this.meal(this.m.sleep, 0.3, 'breakfast before the fires are lit');
    if (dayOff) { const o: Opt[] = [[this.m.sleep, 'rest', 'resting on a day free of the kitchens', 3], [this.m.sleep, 'talk', 'talking with the others of the kitchens', 2], ['court_cistern', 'wash', 'washing clothes at the kitchens’ water', 1]];
      this.fill(r.range(12, 13), o); this.meal(this.m.sleep, 0.5, 'the midday meal'); this.fill(r.range(18.5, 19.5), o); this.meal(this.m.sleep, 0.5, 'the evening meal'); this.fill(r.range(20.8, 21.6), o); this.night(); return; }
    // (D-252: before the king's day the kitchens are made ready and the table store stocked: C)
    const opts: Opt[] = prep ? (role === 'cook' ? [[K, 'clean', 'sweeping out the king’s kitchens before the court comes', 2], [K, 'cook', 'firing the new hearths of the king’s kitchens', 1], [ST, 'inspect', 'taking count of the stores in the king’s table store', 1.5]]
        : role === 'baker' ? [[B, 'knead', 'kneading dough for the first bread of the king’s table', 1.5], [B, 'bake', 'firing the ovens of the king’s bakehouse', 1.5], [ST, 'inspect', 'taking count of the flour in the king’s table store', 1]]
        : role === 'wine' ? [[ST, 'inspect', 'setting the wine jars in rows in the king’s table store', 2], [HD, 'clean', 'setting the Hadish in order for the king’s table', 1]]
        : role === 'water' ? [['court_cistern', 'draw_water', 'drawing water to fill the kitchens’ jars before the court comes', 3], [K, 'rest', 'resting between tasks', 0.6]]
        : [[HD, 'clean', 'setting the Hadish in order for the king’s table', 2], [K, 'carry_jar', 'helping at the kitchens between the tasks, carrying in the water', 1.5]])
      : role === 'cook' ? [[K, 'cook', 'at the fires of the king’s kitchens', 4], [ST, 'rest', 'fetching what the cooks need from the table store', 0.6], [K, 'clean', 'sweeping the kitchen court', 0.5]]
      : role === 'baker' ? [[B, 'knead', 'kneading dough for the king’s bread', 2.5], [B, 'bake', 'baking the king’s bread', 2.5], [ST, 'rest', 'fetching flour from the table store', 0.4]]
      : role === 'wine' ? [[ST, 'inspect', 'minding the wine jars in the table store', 1.5], [HD, 'inspect', 'standing by with the wine in the Hadish', 1.5], [K, 'rest', 'resting between tasks', 0.6]]
      : role === 'water' ? [['court_cistern', 'draw_water', 'drawing water for the kitchens', 3], [K, 'rest', 'resting between tasks', 0.6]]
      : [[K, 'carry_jar', 'helping at the kitchens between the meals, carrying in the water', 1.5], /* (not an hour idle at the kitchens: D-191, planCheck (c); C) */ [HD, 'inspect', 'standing in attendance at the table in the Hadish', 2], ['court_guard_mess', 'inspect', 'seeing the guards’ food shared out', 0.6]];
    const trip = () => { // the carrying part of the job, now and then (C)
      if (role === 'wine') { this.go(ST); this.go(HD, 'carrying wine to the king’s table', 'carry_jar', 'a jar of wine'); }
      else if (role === 'water') { this.go('court_cistern'); this.add(this.t + 0.2, 'court_cistern', 'draw_water', 'drawing water for the kitchens'); this.go(K, 'carrying water to the kitchens', 'carry_jar_head', 'a water jar'); }
      else if (role === 'server' && !prep) { this.go(K); this.go(r.chance(0.6) ? HD : 'court_guard_mess', 'carrying dishes from the kitchens', 'carry_bread', 'bread and dishes from the king’s kitchens'); }
      else if (role === 'baker') { this.go(B); this.go(K, 'carrying bread to the kitchens', 'carry_bread', 'baskets of bread'); } };
    const work = (until: number) => { while (this.t < until - 0.4) { if (role !== 'cook' && r.chance(0.35)) trip(); else this.fill(Math.min(until, this.t + r.range(0.6, 1.6)), opts); } this.fill(until, opts); };
    work(Math.min(r.range(11, 11.8), this.t + 6.4)); this.meal(this.m.sleep === 'court_camp' ? K : this.m.sleep, 0.5, 'the midday meal in the kitchen court');
    work(Math.min(r.range(17.2, 18.2), this.t + 6.6)); this.meal(K, 0.5, 'the evening meal in the kitchen court');
    // D-780: a great banquet: the servers and the wine-bearers carry the dishes and the wine over the Terrace to the Apadana and
    // serve at the tables until it ends; the cooks at the fires until the last dishes go out (Heracleides: a claim, B; C)
    if (!prep && this.K.banquetNight(this.d) && (role === 'server' || role === 'wine' || role === 'cook') && this.K.inOut(this.pid, this.d, CE.banquet.servers)) {
      const [b0, b1] = ceremonyHours(this.K.pop.seed, this.d).banquet, A = 'court_audience';
      if (role === 'cook') { this.at(b1 - 0.8, K, 'cook', 'at the fires of the king’s kitchens, cooking for the great banquet'); this.night(); return; }
      work(b0 - 0.3);
      while (this.t < b1 - 0.4) { this.go(role === 'wine' ? ST : K, role === 'wine' ? 'going back to the table store for wine' : 'going back to the kitchens for more dishes');
        this.go(A, role === 'wine' ? 'carrying wine over the Terrace to the king’s banquet in the Apadana' : 'carrying dishes over the Terrace from the king’s kitchens to the banquet in the Apadana', role === 'wine' ? 'carry_jar' : 'carry_bread', role === 'wine' ? 'a jar of wine for the banquet' : 'dishes for the king’s banquet');
        this.add(Math.min(b1, this.t + r.range(0.25, 0.6)), A, 'inspect', role === 'wine' ? 'pouring wine at the tables of the banquet (C: D-780)' : 'serving at the tables of the banquet (C: D-780)'); }
      this.night(); return; }
    work(r.range(19.8, 20.4)); this.night();
  }
  porter() {
    const r = this.r, RS = 'royal_store', ST = 'court_table_store', prep = this.prep;
    const dayOff = !prep && (this.d + this.pid) % 7 === 0;
    this.morning(r.range(4.8, 5.8)); this.meal(this.m.sleep, 0.3, 'breakfast at the camp');
    if (dayOff) { const o: Opt[] = [[this.m.sleep, 'rest', 'resting at the camp on a day without loads', 3], [this.m.sleep, 'talk', 'talking with the porters at the camp', 2], [this.m.sleep, 'gamble', 'knucklebones with the porters', 1], [this.m.sleep, 'craft', 'mending his carrying pad and ropes', 1]];
      this.fill(r.range(12, 13), o); this.meal(this.m.sleep, 0.5, 'the midday meal at the camp'); this.fill(r.range(18.5, 19.5), o); this.meal(this.m.sleep, 0.5, 'the evening meal at the camp'); this.fill(r.range(20.8, 21.6), o); this.night(); return; }
    const loads: [ActivityId, string, string][] = [['carry_sack', 'carrying flour up from the royal stores to the king’s kitchens', 'a sack of flour'], ['carry_jar', 'carrying wine up from the royal stores to the king’s table store', 'a jar of wine'],
      ['carry_sack', 'carrying barley up from the royal stores to the king’s kitchens', 'a sack of barley'], ['carry_jar', 'carrying oil up from the royal stores', 'a jar of oil']];
    const trips = (until: number) => { while (this.t + 2 * walkHours(RS, ST) + 0.4 < until) { if (!this.dryStart(2 * walkHours(RS, ST) + 0.5, until)) break; // (D-244: no load carried through the rain)
      const [a, w0, c] = loads[Math.floor(r.next() * loads.length)], why = prep ? `${w0}, stocking it before the court comes` : w0;
      this.go(RS, 'going down to the royal stores'); this.add(this.t + r.range(0.1, 0.3), RS, 'rest', 'waiting while the storekeeper weighs out the load');
      this.go(ST, why, a, c); this.add(this.t + r.range(0.08, 0.2), ST, 'rest', 'setting the load down in the king’s table store'); if (r.chance(0.25)) this.add(this.t + r.range(0.2, 0.5), ST, 'rest', 'resting before the next load'); } };
    trips(r.range(10.8, 11.6)); this.meal('stair_foot', 0.5, 'the midday meal at the stair foot'); trips(r.range(16, 17)); this.go(this.m.sleep, 'going back to the camp');
    this.fill(r.range(18.5, 19.2), [[this.m.sleep, 'rest', 'resting at the camp after the day’s loads', 3], [this.m.sleep, 'talk', 'talking with the porters at the camp', 2]]);
    this.meal(this.m.sleep, 0.5, 'the evening meal at the camp'); this.fill(r.range(20.6, 21.4), [[this.m.sleep, 'rest', 'resting at the camp', 2], [this.m.sleep, 'gamble', 'knucklebones with the porters', 1]]); this.night();
  }
  butcher() {
    const r = this.r, SY = 'stockyard', prep = this.prep, dayOff = !prep && (this.d + this.pid) % 6 === 0;
    this.morning(r.range(4.6, 5.4)); this.meal(this.m.sleep, 0.3, 'breakfast at the camp');
    if (dayOff) { const o: Opt[] = [[this.m.sleep, 'rest', 'resting at the camp', 3], [this.m.sleep, 'talk', 'talking at the camp', 2], [this.m.sleep, 'craft', 'mending baskets and ropes', 1]];
      this.fill(r.range(12, 13), o); this.meal(this.m.sleep, 0.5, 'the midday meal at the camp'); this.fill(r.range(18.5, 19.5), o); this.meal(this.m.sleep, 0.5, 'the evening meal at the camp'); this.night(); return; }
    this.go(SY, 'going to the stockyard'); const o: Opt[] = [[SY, 'slaughter', 'slaughtering sheep and goats for the king’s table', prep ? 1 : 3], [SY, 'slaughter', 'slaughtering sheep and goats for the king’s table under the stockyard’s shed, out of the rain', prep ? 1 : 3], [SY, 'rest', 'resting at the stockyard', 0.6], [SY, 'rest', 'resting under the stockyard’s shed, out of the rain', 0.6],
      ...(prep ? [[SY, 'tend_animals', 'penning the sheep and goats driven in for the king’s table before the court comes', 2.5]] as Opt[] : [])]; // (D-252: the flocks for the table penned ahead of the court: C)
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
    this.go('court_apadana_e', 'going up to the Terrace');
    // D-221: on an audience morning an usher on duty leads one party in: at its head in the forecourt, up into the hall with
    // it, and before the king by the leader's hand (the Apadana reliefs: B for the form; the times and places C)
    const T = role === 'usher' ? this.K.dayOrder(this.d).usherOf.get(this.pid) : undefined;
    if (T) { const pa = this.K.parties[T.party], who = pa.petition ? `the ${pa.origin} petitioners` : `the ${pa.origin} party`, Wt = COURT.visitors.waiting, FW = 'forecourt_wait';
      this.fill(T.tIn - Wt.usher_before_h - walkHours(this.cur, FW), opts);
      if (wetHours(this.C.wx, this.t, T.tIn) > 0) this.at(T.tIn, 'court_portico', 'inspect', `an usher with ${who} under the Apadana portico, out of the rain, ready to lead them up`);
      else this.at(T.tIn, FW, 'inspect', `an usher at the head of ${who} in the forecourt, ready to lead them up to the king (the Apadana reliefs, B)`);
      this.go('court_audience', `an usher leading ${who} up to the Apadana`);
      this.add(Math.max(this.t + 0.02, T.tTurn - walkHours('court_audience', 'court_audience_front')), 'court_audience', 'inspect', `an usher standing with ${who} in the Apadana until their turn`);
      this.go('court_audience_front', `an usher leading ${who} before the king by the leader’s hand (the reliefs, B)`);
      this.add(Math.max(this.t + 0.04, T.tDone), 'court_audience_front', 'inspect', `an usher presenting ${who} to the king (the reliefs, B; what is said is not shown)`); }
    this.fill(r.range(12, 12.8), opts); this.meal('court_apadana_e', 0.6, 'a midday meal sent out from the king’s table');
    if (this.K.dines(this.pid, this.d)) return this.banquet(); // (D-780)
    this.fill(r.range(15.8, 17), opts); this.go(this.m.sleep, 'going down to the camp');
    this.fill(r.range(18.6, 19.4), camp); this.meal(this.m.sleep, 0.6, 'the evening meal at the camp'); this.fill(r.range(20.8, 21.8), camp); this.night();
  }
  noble() {
    const r = this.r, K = this.K, d = this.d, sd = K.set, gift = isGiftDay(K.pop.seed, d), gifts = d === sd.kingGifts || d === sd.birthday;
    // D-780: on the days of the peoples' gifts, of the king's gifts and his birthday every Persian of rank at Persepolis attends (C)
    const atCourt = gift || gifts || u01(K.pop.seed, S.day, this.pid, d) < 0.72, nN = (K.byGroup.get('nobles') ?? []).length || 1;
    const o = this.outing(), rides = !!o && K.inOut(this.pid, d, (o.kind === 'hunt' ? CE.hunt.nobles[0] + (CE.hunt.nobles[1] - CE.hunt.nobles[0]) * u01(K.pop.seed, S.cer, d, 1) : CE.ride.nobles[0] + (CE.ride.nobles[1] - CE.ride.nobles[0]) * u01(K.pop.seed, S.cer, d, 2)) / nN);
    this.morning(rides && o!.kind === 'hunt' ? Math.min(r.range(4.3, 4.8), o!.t0 - 1.2) : r.range(5.4, 6.6)); this.meal(this.m.sleep, 0.4, 'breakfast in his tent at the camp');
    const camp: Opt[] = [[this.m.sleep, 'rest', 'resting at the camp', 2], [this.m.sleep, 'talk', 'talking with other Persians of rank at the camp', 2], [this.m.sleep, 'tend_animals', 'seeing to his horses', 1], [this.m.sleep, 'train', 'shooting at the mark below the Terrace', 0.6]];
    const pm = rides && o!.kind === 'ride', drive = (opts: Opt[]) => { if (!pm) return; // (D-780: the king's drive in the afternoon)
      this.fill(o!.t0 - walkHours(this.cur, 'stair_foot') - 0.3, opts); this.go('stair_foot', 'going to the stair foot to ride out with the king'); this.outingRide(o!, 'noble'); this.go(this.m.sleep, 'going back to the camp after the ride'); };
    if (rides && !pm) { this.fill(o!.t0 - walkHours(this.m.sleep, 'stair_foot') - 0.3, camp); this.go('stair_foot', `going to the stair foot to ride with the king${o!.kind === 'hunt' ? ' to the hunt' : ''}`); this.outingRide(o!, 'noble'); }
    const dines = K.dines(this.pid, d);
    if (!atCourt && !(rides && !pm)) { this.fill(r.range(12, 13), camp); this.meal(this.m.sleep, 0.6, 'the midday meal at the camp'); drive(camp);
      if (dines) { this.go('forecourt', 'going up to the Terrace for the king’s banquet'); return this.banquet(); }
      this.fill(r.range(18.5, 19.5), camp); this.meal(this.m.sleep, 0.7, 'the evening meal at the camp'); this.fill(r.range(20.8, 22), camp); this.night(); return; }
    const opts: Opt[] = gift ? [['court_portico', 'inspect', 'standing in the Apadana’s N portico among the Persians of rank while the delegations go up with their gifts (the reliefs, B; C: D-780)', 3], ['apadana_hall', 'inspect', 'in attendance in the Apadana on the day of the peoples’ gifts', 2.5], ['court_apadana_e', 'inspect', 'standing below the Apadana’s E stair while the delegations go up', 1]]
      : gifts ? [['court_portico', 'talk', 'talking with other Persians of rank in the Apadana portico on the day of the king’s gifts', 2], ['apadana_hall', 'inspect', 'in attendance in the Apadana while the king gives gifts', 1.5], ['forecourt', 'talk', 'talking with other Persians of rank in the forecourt', 0.6]]
      : [['apadana_hall', 'inspect', 'in attendance in the Apadana', 2.5], ['court_portico', 'talk', 'talking with other Persians of rank in the Apadana portico', 2], ['forecourt', 'talk', 'talking with other Persians of rank in the forecourt', 1],
      ['court_apadana_e', 'inspect', 'waiting below the Apadana’s E stair to be called', 1], ['gate_hall', 'talk', 'talking in the Gate of All Nations', 0.6]];
    this.go('forecourt', 'going up to the Terrace');
    // D-780: on the morning of the king's gifts (and his birthday) each Persian of rank is called before the king in turn and
    // receives his gift (Cyr. 8.5.21, HDT 9.110: claims, B; the turns C)
    if (gifts) { const turn = 9.1 + 2.2 * u01(K.pop.seed, S.cer, this.pid, d, 3); this.fill(turn - 0.45, opts);
      this.at(turn, 'court_audience', 'queue', d === sd.birthday ? 'in the Apadana on the king’s birthday, waiting to be called before him for his gift (HDT 9.110: B claim; C: D-780)' : 'in the Apadana, waiting to be called before the king for his gift (Cyr. 8.5.21: a claim, B; C: D-780)');
      this.add(this.t + 0.1, 'court_audience', 'inspect', 'bowing low before the king, the right hand raised before his mouth, and receiving the king’s gift (C: D-780)'); }
    this.fill(r.range(11.8, 12.6), opts);
    this.meal('court_hadish', r.range(0.8, 1.3), 'a meal at the king’s table, in the hall apart from the king (Heracleides, a claim)');
    drive(opts);
    if (dines) return this.banquet();
    this.fill(r.range(15, 16.5), opts); this.go(this.m.sleep, 'going down to the camp');
    this.fill(r.range(18.6, 19.4), camp); this.meal(this.m.sleep, 0.7, 'the evening meal at the camp'); this.fill(r.range(20.8, 22), camp); this.night();
  }
  // ---------------------------------------------------------------- the king and those about him (D-199; C unless stated)
  /** the king: his mornings and evenings inside the Hadish, not drawn (seclusion: brief §9.1); on an audience morning he
   *  walks to the Apadana with the staff and the lotus (the door-jamb reliefs, B), sits enthroned for about two hours
   *  (the Treasury relief, B; the hours C) and walks back. D-780 (ceremony.ts): he also rides out or hunts on some mornings,
   *  stands before the magi's fire the morning after he comes and on his birthday, gives gifts to the Persians, and presides
   *  over the great banquets. He still never speaks to or reacts to the visitor (brief §1.1) */
  kingDay() {
    const r = this.r, K = this.K, PRV = KING.private, TH = KING.throne, Kd = K.kingDay(this.d);
    const opts: Opt[] = [[PRV, 'talk', 'in council in the palace with the chiliarch and the officials of the court (C)', 3], [PRV, 'rest', 'resting in the palace', 2], [PRV, 'talk', 'talking with his table-companions in the palace (C)', 1.5]];
    const o = this.outing(), sd = K.set, gifts = this.d === sd.kingGifts || this.d === sd.birthday, SF = 'stair_foot';
    // D-780: the morning the king comes out to the fire with the magi (the morning after he comes, his birthday: C)
    const rise = this.d === sd.kingGifts || this.d === sd.birthday ? r.range(4.4, 4.7) : r.range(5.3, 6.1); this.morning(rise);
    if (this.d === sd.kingGifts || this.d === sd.birthday) { this.go('offering_place', 'walking down to the magi’s fire at first light, his escort about him', 'royal_walk');
      this.add(this.sun.rise + 0.3, 'offering_place', 'offer', 'the king standing before the fire with the magi at first light (the king before the fire altar on the royal tombs, B; the morning C: D-780)');
      this.go(PRV, 'walking back up to the palace', 'royal_walk'); }
    this.meal(PRV, 0.5, 'breakfast in the palace');
    const out = (x: NonNullable<typeof o>) => { const w = walkHours(PRV, SF); this.fill(x.t0 - w - 0.1, opts); this.go(SF, x.kind === 'hunt' ? 'walking down the Great Stair to the horses, the parasol held over him' : 'walking down the Great Stair to the royal chariot, the parasol held over him', 'royal_walk');
      this.outingRide(x, 'king'); this.go(PRV, 'walking back up the Great Stair to the palace', 'royal_walk'); };
    if (o?.kind === 'hunt') out(o);
    else if (Kd.aud || gifts) { const a0 = Kd.aud ? Kd.a0 : 9.0, a1 = Kd.aud ? Kd.a1 : 11.0, w = walkHours(PRV, TH); this.fill(a0 - w, opts); this.until(a0 - w, 'rest', 'resting in the palace');
      this.go(TH, Kd.aud ? 'walking to the Apadana for an audience, the parasol held over him (door-jamb reliefs, B)' : 'walking to the Apadana to give gifts to the Persians, the parasol held over him', 'royal_walk');
      this.add(a1, TH, 'enthroned', isGiftDay(K.pop.seed, this.d) ? 'enthroned in the Apadana on the day of the peoples’ gifts, the delegations led before him one by one (the Apadana and Treasury reliefs, B; the day C: D-780)'
        : Kd.aud ? 'enthroned in the Apadana, giving audience (the Treasury relief, B; the day and the hours C)' : 'enthroned in the Apadana, giving gifts to the Persians of rank (Cyr. 8.5.21, HDT 9.110: claims, B; C: D-780)');
      this.go(PRV, 'walking back to the palace', 'royal_walk'); }
    this.fill(r.range(12, 12.8), opts); this.meal(PRV, r.range(0.8, 1.1), 'the midday meal in the palace, apart (Heracleides, a claim)');
    if (o?.kind === 'ride') out(o); // (D-780, C1's ask: the drive out most afternoons)
    if (K.banquetNight(this.d)) { const [b0, b1] = ceremonyHours(K.pop.seed, this.d).banquet, w = walkHours(PRV, TH);
      this.fill(b0 + 0.4 - w, opts); this.go(TH, 'walking to the Apadana for the banquet, lamps carried before him', 'royal_walk');
      this.add(b1 - 0.4, TH, 'enthroned', 'presiding over the great banquet from the throne under the canopy, apart from the diners (Heracleides: a claim, B; C: D-780)');
      this.go(PRV, 'walking back to the palace after the banquet', 'royal_walk'); this.night('asleep in the palace'); return; }
    this.fill(r.range(18.4, 19.3), opts); this.meal(PRV, r.range(0.9, 1.3), 'the evening meal in the palace, apart (Heracleides, a claim)');
    this.fill(r.range(21.3, 22.2), [[PRV, 'rest', 'resting in the palace', 2], [PRV, 'talk', 'talking in the palace', 1]]); this.night('asleep in the palace');
  }
  /** D-780: the chiliarch: before the throne at every audience with his hand raised before his mouth (the Treasury relief, B),
   *  in council with the officials in the Tripylon, riding with the king, at the great banquets; his tent at the camp (C) */
  chiliarchDay() {
    const r = this.r, K = this.K, Kd = K.kingDay(this.d), o = this.outing(), sd = K.set, CH = 'court_throne_chiliarch', TR = 'court_tripylon';
    const gifts = this.d === sd.kingGifts || this.d === sd.birthday;
    const opts: Opt[] = [[TR, 'talk', 'the chiliarch in council with the officials of the court in the Tripylon (C)', 3], ['gate_hall', 'inspect', 'the chiliarch looking over the parties at the Gate', 1], ['court_apadana_e', 'talk', 'the chiliarch talking with Persians of rank below the Apadana', 1]];
    this.morning(r.range(5.2, 5.8)); this.meal(this.m.sleep, 0.4, 'breakfast in his tent at the camp'); this.go(TR, 'going up to the Terrace');
    const out = () => { this.fill(o!.t0 - walkHours(this.cur, 'stair_foot') - 0.2, opts); this.go('stair_foot', 'going down to the horses for the king’s ' + o!.kind); this.outingRide(o!, 'noble'); this.go(TR, 'going back up to the Tripylon'); };
    if (o?.kind === 'hunt') out();
    else if (Kd.aud || gifts) { const a0 = Kd.aud ? Kd.a0 : 9.0, a1 = Kd.aud ? Kd.a1 : 11.0; this.fill(a0 - walkHours(TR, CH) - 0.15, opts); this.go(CH, 'walking to the Apadana for the audience');
      this.add(a1, CH, 'inspect', 'the chiliarch standing before the throne, his right hand raised before his mouth, presenting those called to the king (the Treasury relief, B; IR-CHIL: B; C: D-780)'); this.go(TR, 'walking back to the Tripylon'); }
    this.fill(r.range(12.2, 12.8), opts); this.meal('court_apadana_e', 0.6, 'a midday meal sent out from the king’s table');
    if (o?.kind === 'ride') out();
    if (K.dines(this.pid, this.d)) return this.banquet();
    this.fill(r.range(16.5, 17.2), opts); this.go(this.m.sleep, 'going down to the camp'); this.fill(r.range(18.6, 19.2), [[this.m.sleep, 'talk', 'talking with Persians of rank at the camp', 2]]);
    this.meal(this.m.sleep, 0.6, 'the evening meal at the camp'); this.fill(r.range(20.8, 21.6), [[this.m.sleep, 'rest', 'resting in his tent', 2]]); this.night();
  }
  /** D-780: a diner's evening: up to the Apadana before the banquet, at his place round a low table until it ends (seated, eating
   *  and drinking: Heracleides, a claim, B; C), and down to the camp in the dark */
  banquet() {
    const [b0, b1] = ceremonyHours(this.K.pop.seed, this.d).banquet, A = 'court_audience', seat = this.K.seatOf(this.pid, this.d), r = this.r;
    const opts: Opt[] = [['court_portico', 'talk', 'talking with other Persians of rank in the Apadana portico before the banquet', 2], ['forecourt', 'talk', 'talking in the forecourt before the banquet', 1]];
    this.fill(b0 - walkHours(this.cur, 'court_portico') - 0.1, opts); this.go(seat >= 0 ? A : 'court_portico', 'going in to the king’s banquet in the Apadana');
    this.add(b1 - r.range(0, 0.25), seat >= 0 ? A : 'court_portico', 'eat', seat >= 0 ? 'at the king’s banquet in the Apadana, seated at a low table between the columns, eating and drinking (Heracleides: a claim, B; C: D-780)' : 'at the king’s banquet, served in the Apadana portico, the hall being full (C: D-780)');
    this.go(this.m.sleep, 'going down to the camp after the banquet, by lamplight'); this.night();
  }
  /** the parasol bearer and the fly-whisk and towel bearer: in attendance on the king in the palace (not drawn), behind him
   *  on his walks and at the throne; they eat and sleep with the household's attendants */
  bearerDay() {
    const r = this.r, K = this.K, PRV = KING.private, role = this.m.role, parasol = role === 'parasol', Kd = K.kingDay(this.d);
    const post = parasol ? KING.attend.parasol : role === 'prince' ? 'court_throne_prince' : role === 'weapons' ? 'court_throne_weapons' : KING.attend.whisk;
    const opts: Opt[] = [[PRV, 'inspect', 'in attendance on the king in the palace', 3], [PRV, 'rest', 'resting in the palace while the king is in council', 1]];
    const other = role === 'prince' || role === 'weapons', walkAct: ActivityId = parasol ? 'bear_parasol' : other ? 'walk' : 'bear_whisk';
    // (D-780, C12 pass 4: under the hall's roof and the canopy the parasol is furled: no parasol over the king indoors)
    const standAct: ActivityId = parasol || other ? 'inspect' : 'attend_whisk';
    const standWhy = parasol ? 'standing by the throne, the parasol furled under the roof (by lamp and torch light at night)' : role === 'prince' ? 'the crown prince standing behind the throne (the Treasury relief, B; C: D-780)' : role === 'weapons' ? 'the king’s weapon-bearer standing behind the throne with the bow case and the axe (the Treasury relief, B; C: D-780)' : 'standing behind the throne with the fly-whisk and the towel (the Treasury relief, B)';
    const wk = (where: string) => parasol ? `walking behind the king ${where}, the parasol held over him` : other ? `walking behind the king ${where}${role === 'weapons' ? ' with his bow case and axe' : ''}` : `walking behind the king ${where} with the fly-whisk and the towel`;
    this.morning(r.range(4.9, 5.4)); this.meal(this.m.sleep, 0.3, 'breakfast in the south wing');
    this.go(PRV, 'going to the palace to attend the king');
    const o = this.outing(), sd = K.set, gifts = !Kd.aud && (this.d === sd.kingGifts || this.d === sd.birthday);
    const out = () => { const w = walkHours(PRV, 'stair_foot'); this.fill(o!.t0 - w - 0.1, opts); this.go('stair_foot', wk('down the Great Stair'), walkAct);
      this.outingRide(o!, 'escort'); this.go(PRV, 'walking behind the king back up to the palace', walkAct); };
    if (o?.kind === 'hunt') out();
    else if (Kd.aud || gifts) { const a0 = Kd.aud ? Kd.a0 : 9.0, a1 = Kd.aud ? Kd.a1 : 11.0, w = walkHours(PRV, post); this.fill(a0 - w, opts); this.until(a0 - w, 'inspect', 'in attendance on the king in the palace');
      this.go(post, wk('to the Apadana'), walkAct);
      this.add(a1, post, standAct, standWhy);
      this.go(PRV, 'walking behind the king back to the palace', walkAct); }
    this.fill(Math.max(this.t + 0.3, r.range(12.9, 13.4)), opts); this.meal(this.m.sleep, 0.5, 'the midday meal in the south wing');
    this.go(PRV, 'going back to the palace'); if (o?.kind === 'ride') out();
    if (K.banquetNight(this.d)) { const [b0, b1] = ceremonyHours(K.pop.seed, this.d).banquet, w = walkHours(PRV, post); this.fill(b0 + 0.4 - w, opts);
      this.go(post, wk('to the banquet'), walkAct);
      this.add(b1 - 0.4, post, standAct, `${standWhy}, at the banquet`);
      this.go(PRV, 'walking behind the king back to the palace', walkAct); this.go(this.m.sleep, 'going back to the south wing'); this.night(); return; }
    this.fill(r.range(19.6, 20.2), opts); this.meal(this.m.sleep, 0.5, 'the evening meal in the south wing');
    this.fill(r.range(21, 21.8), [[this.m.sleep, 'rest', 'resting in the south wing', 2], [this.m.sleep, 'talk', 'talking with the other attendants', 1]]); this.night();
  }
  /** four spearmen of the king's escort: before and beside him on his walks and at the throne (C); otherwise off duty with
   *  the guard */
  escortDay() {
    const r = this.r, K = this.K, Kd = K.kingDay(this.d), post = (KING.attend.escort as string[])[this.p.idx % 4], G = KING.gather, M = 'court_guard_mess', Q = 'court_guard_quarters';
    const arms = 'spear with its apple-shaped butt, bow and quiver (reliefs B)';
    this.morning(r.range(5.2, 6)); this.meal(Q, 0.35, 'breakfast in the quarters');
    const o = this.outing(), sd = K.set, gifts = !Kd.aud && (this.d === sd.kingGifts || this.d === sd.birthday);
    const out = () => { const w = walkHours(G, 'stair_foot'); this.guardFree(o!.t0 - w - 0.6); this.go(G, 'going to the Hadish to escort the king'); this.until(o!.t0 - w - 0.1, 'stand_guard', 'on watch in the Hadish’s N court, waiting for the king');
      this.go('stair_foot', 'walking before the king down the Great Stair', 'patrol', arms); this.outingRide(o!, 'escort', arms); this.go(G, 'walking before the king back up to the Hadish', 'patrol', arms); };
    if (o?.kind === 'hunt') out();
    else if (Kd.aud || gifts) { const a0 = Kd.aud ? Kd.a0 : 9.0, a1 = Kd.aud ? Kd.a1 : 11.0, w = walkHours(G, post); this.guardFree(a0 - w - 0.5); this.go(G, 'going to the Hadish to escort the king'); this.until(a0 - w, 'stand_guard', 'on watch in the Hadish’s N court, waiting for the king');
      this.go(post, 'walking before the king to the Apadana', 'patrol', arms); this.add(a1, post, 'stand_guard', 'on watch beside the throne at the audience (C)', arms);
      this.go(G, 'walking before the king back to the Hadish', 'patrol', arms); this.at(this.t + 0.2, G, 'stand_guard', 'on watch in the Hadish’s N court until the king is inside', arms); }
    this.guardFree(r.range(11.8, 12.6)); this.meal(M, 0.6, 'a meal from the king’s table, carried out to the guards’ court (Heracleides, a claim)');
    if (o?.kind === 'ride') out();
    if (K.banquetNight(this.d)) { const [b0, b1] = ceremonyHours(K.pop.seed, this.d).banquet, w = walkHours(G, post); this.guardFree(b0 - 0.6); this.meal(M, 0.5, 'the evening meal in the guards’ court before the banquet');
      this.go(G, 'going to the Hadish to escort the king to the banquet'); this.until(b0 + 0.4 - w, 'stand_guard', 'on watch in the Hadish’s N court, waiting for the king');
      this.go(post, 'walking before the king to the banquet', 'patrol', arms); this.add(b1 - 0.4, post, 'stand_guard', 'on watch beside the throne at the banquet (C)', arms);
      this.go(G, 'walking before the king back to the Hadish', 'patrol', arms); this.go(Q, 'going back to the quarters'); this.night(); return; }
    this.guardFree(r.range(18, 19)); this.meal(M, 0.5, 'the evening meal in the guards’ court'); this.guardFree(r.range(20.6, 21.4)); this.night();
  }
  // ---------------------------------------------------------------- the retinue in its camps (D-199; Q-333; all C)
  /** a day at the camp: the work of the group (horses, baggage, the nobles' households, crafts, the watch and drill),
   *  errands to the royal stores for some, meals and leisure at the tents; a day off in seven */
  retinueDay() {
    const r = this.r, G = RET_BY_ID.get(this.m.role)!, CA = this.m.sleep, town = campOfPlace(CA)?.zone === 'town', dayOff = (this.d + this.pid) % 7 === 0;
    const leisure: Opt[] = [[CA, 'rest', 'resting at the camp', 2], [CA, 'talk', 'talking at the camp', 2], [CA, 'gamble', 'knucklebones at the camp', 0.6], [CA, 'wash', 'washing clothes at the camp', 0.5]];
    // (D-780: a day off is not a day idle: mending one's own things, washing, a walk to the craft quarter to buy and sell, a visit, a game: C)
    const off: Opt[] = [[CA, 'craft', 'mending his own clothes and gear on a day off', 1.2], [CA, 'wash', 'washing his own clothes on a day off', 0.8], ['craft_zone', 'exchange', 'at the craft quarter on a day off, trading for a few things', 1.2], [CA, 'talk', 'visiting people he knows at the camp', 1.2], [CA, 'gamble', 'knucklebones at the camp', 0.6], [CA, 'rest', 'resting at the camp', 0.8]];
    const work: Opt[] = dayOff ? off : G.work === 'household' ? [[CA, 'clean', 'sweeping out the tents of the household', 1.2], [CA, 'draw_water', 'fetching water for the tents', 1], [CA, 'wash', 'washing the household’s clothes at the camp', 1], [CA, 'craft', 'mending clothes and gear at the camp', 1], [CA, 'knead', 'kneading dough for the household’s bread', 0.6], [CA, 'rest', 'resting between tasks', 0.6], [CA, 'talk', 'talking with the other servants', 0.6]]
      : G.work === 'horses' ? [[CA, 'tend_animals', 'seeing to the horses at the horse lines', 3], [CA, 'carry_sack', 'carrying fodder to the horse lines', 1], [CA, 'craft', 'mending bridles and saddle cloths', 0.8], [CA, 'rest', 'resting by the horse lines', 0.8]]
      : G.work === 'baggage' ? [[CA, 'tend_animals', 'seeing to the mules and camels of the baggage', 2.5], [CA, 'craft', 'mending pack saddles and ropes', 1.2], [CA, 'rest', 'resting by the baggage', 1], [CA, 'talk', 'talking with the drivers', 0.6]]
      : G.work === 'craft' ? [[CA, 'craft', 'at work at the camp’s benches', 3], [CA, 'exchange', 'trading with the camp’s people', 1.2], [CA, 'rest', 'resting at the camp', 0.6], [CA, 'talk', 'talking at the camp', 0.6]]
      : G.work === 'soldier' ? [[CA, 'train', 'shooting at the mark by the camp (drill: C)', 1.5], [CA, 'stand_guard', 'on watch at the edge of the camp', 1.2], [CA, 'craft', 'mending his gear', 0.8], [CA, 'rest', 'resting in the camp', 1.5], [CA, 'talk', 'talking with the men of his tent', 1], [CA, 'gamble', 'knucklebones with the men of his tent', 0.6]]
      : G.work === 'herds' ? [[CA, 'tend_animals', 'watching the royal horses at pasture by the camp', 3], [CA, 'tend_animals', 'seeing to the mules at the horse lines', 1], [CA, 'craft', 'mending halters and hobbles', 0.6], [CA, 'rest', 'resting by the herd', 1]]
      : [[CA, 'tend_animals', 'seeing to the pack animals of the trains', 2], [CA, 'craft', 'mending sacks and pack saddles', 1], [CA, 'rest', 'resting by the trains', 1], [CA, 'talk', 'talking with the drivers', 0.6]];
    const errand = !dayOff && (G.work === 'baggage' || G.work === 'convoy' || (G.work === 'household' && town)) && r.chance(G.work === 'household' ? 0.25 : 0.5);
    this.morning(r.range(4.9, 6.1)); this.meal(CA, 0.35, 'breakfast at the camp');
    // D-780: the king's horses: grooms bring them to the stair foot and ride with the king's ride or hunt; the soldiers of the
    // plain beat for the hunt; the rest of the grooms exercise the horses in strings out to the royal horse lines and back (C)
    const o = dayOff ? null : this.outing(), K = this.K, nG = G.n || 1;
    const groomOut = !!o && G.work === 'horses' && K.inOut(this.pid, this.d, (o.kind === 'hunt' ? CE.hunt.grooms : CE.ride.grooms) / nG);
    if (o?.kind === 'hunt' && groomOut) {
      this.go('stair_foot', 'leading the king’s horses to the stair foot, saddled for the ' + o.kind, 'walk'); this.outingRide(o, 'groom'); this.go(CA, 'leading the horses back to the horse lines'); }
    else if (o && o.kind === 'hunt' && G.work === 'soldier' && G.zone === 'plain' && K.inOut(this.pid, this.d, CE.hunt.beaters / nG)) { this.fill(o.t0 - walkHours(CA, 'river'), work); this.outingRide(o, 'beater'); this.go(CA, 'going back to the camp from the hunt'); }
    else if (!dayOff && G.work === 'horses' && K.inOut(this.pid, this.d * 2 + 1, CE.exercise.share) && this.d > K.firstDay && this.d < K.leaveDay) { const [h0, h1] = (CE.exercise.hours as [number, number][])[0]; // (the morning: C)
      if (h0 > this.t + 0.2) this.fill(h0, work); this.at(this.t + 0.15, CA, 'tend_animals', 'saddling a horse of the court for its exercise');
      this.ride('rcamp:p_horse', 'exercising a horse of the court on horseback, in a string at a trot out to the royal horse lines (C: D-780)', 3.0);
      this.ride(CA, 'exercising a horse of the court on horseback, riding back at a walk (C: D-780)', 1.8); if (this.t < h1) this.at(Math.min(h1, this.t + 0.3), CA, 'tend_animals', 'rubbing down the horse after its exercise'); }
    this.fill(Math.max(this.t + 0.1, r.range(7.2, 8.4)), work);
    if (errand && this.dryStart(2 * walkHours(CA, 'royal_store') + 0.6, 11.4)) { const RS = 'royal_store', load = G.work === 'household' ? 'a sack of flour' : 'a sack of barley'; // (D-244: not through the rain)
      this.go(RS, 'going to the royal stores'); this.add(this.t + r.range(0.2, 0.4), RS, 'rest', 'waiting while the storekeeper weighs out the load');
      this.go(CA, `carrying ${G.work === 'household' ? 'flour' : 'barley'} from the royal stores to the camp`, 'carry_sack', load); }
    this.fill(r.range(11.6, 12.6), work); this.meal(CA, 0.5, 'the midday meal at the camp');
    if (o?.kind === 'ride' && groomOut) { this.fill(o.t0 - walkHours(CA, 'stair_foot') - 0.4, work); // (D-780: the king's drive in the afternoon)
      this.go('stair_foot', 'leading the king’s horses to the stair foot, saddled for the ride', 'walk'); this.outingRide(o, 'groom'); this.go(CA, 'leading the horses back to the horse lines'); }
    this.fill(r.range(17.2, 18.1), work);
    if (G.work === 'household' || r.chance(0.25)) this.at(this.t + r.range(0.5, 0.9), CA, 'cook', 'cooking the evening meal at the camp’s hearth');
    this.meal(CA, 0.6, 'the evening meal at the camp'); this.fill(r.range(20.6, 21.8), leisure); this.night('asleep in the tent');
  }
  /** the court leaves (E-26): the retinue loads its animals and takes the road from its camp; gone for the rest of the year */
  retinueLeaves() {
    const r = this.r, CA = this.m.sleep; this.morning(this.sun.rise - r.range(0.6, 1.1)); this.meal(CA, 0.3, 'the last breakfast before the road');
    this.at(this.t + r.range(0.8, 1.4), CA, 'tend_animals', 'striking the tents and loading the animals to leave with the court');
    this.leaveBy(this.columnWalk(false));
  }
  // ---------------------------------------------------------------- petitioners and delegations (C)
  visitor() {
    const K = this.K, d = this.d, r = this.r, pa = K.parties[this.p.idx], k = d - pa.day, CA = 'court_camp';
    const pr = (x: number) => u01(K.pop.seed, S.vis, 5000 + pa.i, d, x); // the party's shared draws (they go up together)
    const gifts = pa.petition ? undefined : `gifts for the king: ${pa.gift}`;
    const beasts = partyAnimals(pa); // D-210: the gift animal of the delegation's relief, or the party's pack animals
    const campOpts: Opt[] = [[CA, 'rest', 'resting at the camp', 2], [CA, 'talk', 'talking with the party at the camp', 2], [CA, 'tend_animals', `seeing to the party’s animals: ${beasts}`, 1], [CA, 'exchange', 'exchanging goods in kind at the camp', 0.6], [CA, 'wash', 'washing clothes at the camp', 0.4]];
    if (d === pa.day) { // arriving
      // (the night at the last station on the road and a day's stage from it, as the road station's parties: D-196's planCheck
      // (g) found the party "on the road" from midnight, 15 h on foot; the court setting only; C)
      const h = lerp(9.5, 15.5, pr(1)), ST = (livesData as any).travellers_stay.stage_h as [number, number], go = Math.max(this.sun.rise - 0.5, h - 1 - lerp(ST[0], ST[1], pr(8)));
      if (go > 1) { this.add(Math.min(go - 0.4, this.sun.rise + 0.3), '-', 'sleep', `asleep at the last station on the road to the court (${pa.origin} party)`, undefined, 'away');
        if (go - 0.4 - this.t > 0.05) this.add(go - 0.4, '-', 'offmap', `the morning at the last station on the road to the court (${pa.origin} party)`, undefined, 'away'); this.add(go, '-', 'eat', 'a meal at the last station before the road', undefined, 'away'); }
      // (D-252: seen from the road station on, as the court is: the party halts there and walks the road to the camp)
      const w = walkHours('station', CA); this.add(h - w - 0.05, '-', 'offmap', `on the road to the court (${pa.origin} party)`, undefined, 'away');
      this.add(h - w, 'station', 'rest', 'halting by the road station to ask the way to the court’s camp'); this.cur = 'station'; this.go(CA, 'on the road to the court');
      this.add(this.t + 0.6, CA, 'tend_animals', `unloading the party’s animals at the camp: ${beasts}`);
      if (this.lastEat >= 0 && this.t - this.lastEat > 3) this.meal(CA, 0.5, 'a meal at the camp after the road'); // (the road's food since the station's meal)
      this.fill(Math.max(this.t + 0.5, lerp(18.2, 19, pr(2))), campOpts);
      this.meal(CA, 0.6, 'the evening meal at the camp'); this.fill(lerp(20.8, 21.6, pr(3)), campOpts); this.night(); return; }
    this.morning(lerp(this.sun.rise - 0.5, this.sun.rise + 0.3, pr(4)) + r.range(-0.1, 0.1)); this.meal(CA, 0.4, 'breakfast at the camp');
    if (d === pa.leave) { this.add(this.t + lerp(0.5, 1, pr(5)), CA, 'tend_animals', 'loading the animals to go home'); this.go('station', 'on the road home from the court'); // (D-252: seen to the road station)
      this.add(this.t + lerp(0.5, 1.2, pr(6)), 'road:departure', 'walk', 'on the road home from the court', undefined, 'road'); this.add(24, '-', 'offmap', 'gone home', undefined, 'away'); return; }
    // D-221: up to the Terrace only while the forecourt has a place for the party (the day's order: CourtResidents.dayOrder)
    const turn = K.dayOrder(d).turnOf.get(pa.i), up = K.upOn(pa, d);
    if (!up) { this.fill(lerp(11.5, 12.5, pr(8)), campOpts); this.meal(CA, 0.5, 'the midday meal at the camp'); this.fill(lerp(18.2, 19, pr(9)), campOpts); this.meal(CA, 0.6, 'the evening meal at the camp'); this.fill(lerp(20.8, 21.6, pr(10)), campOpts); this.night(); return; }
    // up to the Terrace: checked at the Gate, then waiting with the party at its own place in the forecourt before the
    // Apadana's N stair, standing or sitting together, facing the stair (D-221; C); shelter under the Apadana portico in rain
    const FW = 'forecourt_wait', where = pa.petition ? 'in the petitioners’ line before the Apadana’s N stair' : 'with the party at its place before the Apadana’s N stair';
    const wait: Opt[] = [[FW, 'queue', `in the queue ${where}, waiting to be called`, 3], [FW, 'rest', `resting ${where}, sitting on the ground`, 1.5], ['court_portico', 'shelter', 'waiting in the shade of the Apadana portico, out of the rain', 1]];
    const wet = (a: number, b: number) => wetHours(this.C.wx, a, b) > 0;
    this.fill(turn ? lerp(6.2, 6.8, pr(18)) : lerp(6.6, 8.2, pr(18)), campOpts);
    this.go('gate_hall', 'going up to the Terrace'); this.add(this.t + (turn ? lerp(0.2, 0.35, pr(11)) : lerp(0.2, 0.5, pr(11))), 'gate_hall', 'queue', 'in the queue at the Gate, their party shown to the guards', gifts);
    if (turn) { // the audience: led up to the Apadana by an usher in the party's turn (reliefs, B) and before the king on his throne (D-199)
      this.fill(turn.tIn, wait.map(o => [o[0], o[1], o[2], o[3], gifts] as Opt));
      if (this.t < turn.tIn - 0.02) { if (wet(this.t, turn.tIn)) this.at(turn.tIn, 'court_portico', 'shelter', 'waiting in the shade of the Apadana portico, out of the rain', gifts); else this.at(turn.tIn, FW, 'queue', `in the queue ${where}, waiting to be called`, gifts); }
      // D-780: on a day of the peoples' gifts the delegations go up in file, each behind its usher, one of its men leading its
      // gift animal (the reliefs: B for the form; C)
      const leads = !pa.petition && pa.members.indexOf(this.pid) === 1 && beasts !== 'the pack animals', gift = isGiftDay(K.pop.seed, d);
      this.go('court_audience', leads ? `leading the gift animals, ${beasts}, up the Apadana’s stair behind the usher (the Apadana reliefs, B)` : gift ? `going up the Apadana’s stair in file behind the usher with the ${pa.origin} delegation, carrying the gifts (the Apadana reliefs, B; the day C: D-780)` : 'led up to the Apadana by an usher', 'walk', gifts);
      this.add(Math.max(this.t + 0.02, turn.tTurn - walkHours('court_audience', 'court_audience_front')), 'court_audience', 'queue', pa.petition ? 'in the queue in the Apadana, waiting to be heard by the king' : 'in the queue in the Apadana with the gifts, waiting to be led before the king', gifts);
      this.go('court_audience_front', 'led before the king by the usher, the hand held (the reliefs, B)', 'walk', gifts);
      // D-780: the leader bows low before the king, his right hand raised before his mouth (proskynesis: the Treasury relief's
      // gesture, B; HDT 1.134: a claim, B); the others stand with the gifts (C)
      const leader = this.p.rank === 1;
      this.add(Math.max(this.t + 0.04, turn.tDone), 'court_audience_front', 'inspect', leader ? `bowing low before the king, the right hand raised before the mouth (proskynesis: the Treasury relief, B; HDT 1.134, B claim)${pa.petition ? ', then heard' : ', the gifts presented'} (C: D-780)`
        : pa.petition ? 'standing before the king to be heard (the Treasury relief, B; the petition C)' : 'standing before the king while the gifts are presented (the reliefs, B; C)', gifts);
      this.go(FW, 'coming out of the Apadana');
      if (wet(this.t, this.t + 0.3)) this.at(this.t + 0.3, 'court_portico', 'shelter', 'waiting in the shade of the Apadana portico, out of the rain');
      else this.at(this.t + 0.3, FW, 'rest', pa.petition ? `resting ${where} after the audience` : `resting ${where} after the audience, the gifts handed over`);
      this.meal(FW, 0.5, 'bread and water with the party in the forecourt'); }
    else { this.fill(lerp(11.3, 12.3, pr(14)), wait); this.meal(FW, 0.5, 'bread and water with the party in the forecourt'); this.fill(lerp(14.5, 16, pr(15)), wait); }
    this.go(CA, 'going down to the camp'); if (this.t < 12) { this.fill(lerp(12, 13, pr(19)), campOpts); this.meal(CA, 0.5, 'the midday meal at the camp'); } // (D-780: an early turn on a gift day)
    this.fill(lerp(18.2, 19, pr(16)), campOpts); this.meal(CA, 0.6, 'the evening meal at the camp'); this.fill(lerp(20.8, 21.6, pr(17)), campOpts); this.night();
  }
}
/** the regnal year length (for tests) */
export const COURT_YEAR = REGNAL_DAYS;
