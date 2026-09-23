// Everyone who lived there (brief §9.2 "Population: everyone who lived there exists … Everyone is simulated at an
// abstract level (home, job, schedule, location), and only people near the player get full behaviour"; D-021).
// The ~44,000 people of the Terrace, the town and the plain (src/data/population.json working values, court absent)
// are generated once from the seed into households, ration groups and work gangs. What persists is sparse and mostly
// drawn in advance for the year (births, deaths, marriages, arrivals); sickness is a pure hash of (seed, person, day);
// relationships are a list of dated changes. A person's DAY PLAN — where they are and what they do, half-hour by
// half-hour — is then a pure function of (seed, person, day) and the calendar's state for that day, computed on demand.
// The detailed people of the Terrace slice are persons of this population; their full behaviour follows the same plan.
// Tiers: household, group and job composition B where population.json says so, C otherwise; every daily rule is C
// (src/data/lives.json).
import popData from '../data/population.json';
import townData from '../data/town.json';
import livesData from '../data/lives.json';
import namesData from '../data/names.json';
import plotsData from '../data/town_plots.json';
import { u01, salt, HStream } from './hash';
import { dateOf, REGNAL_DAYS, travellerParties, transfers, transhumantBands, flockDrives, DayCtx, EventCalendar } from './calendar';
import { colPlace } from './construction';
import type { ActivityId } from './activities';

const POPD = popData as any, T = townData as any, L = livesData as any;
/** a house plot of the built settlement (town_plots.json, Phase 6: D-041); grid metres */
export interface TownPlot { id: string; site: string; zone: string; pop_zone: string; kind: string; craft?: string; c: [number, number]; door: [number, number]; door_in: [number, number]; capacity: number }
export const TOWN_PLOTS: TownPlot[] = (plotsData as any).plots;
const PLOT_BY_ID = new Map(TOWN_PLOTS.map(x => [x.id, x]));
/** each settlement site's lane exits onto the open ground (town_plots.json _meta.sites) */
export const TOWN_SITES: Record<string, { c: [number, number]; zone: string; exits: [number, number][] }> = Object.fromEntries(((plotsData as any)._meta.sites as any[]).map(x => [x.id, { c: x.c, zone: x.zone, exits: x.exits ?? [] }]));
export type Job = 'guard' | 'builder' | 'porter' | 'camp' | 'scribe' | 'treasury' | 'official' | 'messenger' | 'storekeeper' | 'miller' | 'weaver' | 'brewer' | 'groom'
  | 'shepherd' | 'priest' | 'caretaker' | 'gardener' | 'farmer' | 'craftsman' | 'servant' | 'steward' | 'homemaker' | 'child' | 'elder' | 'traveller' | 'herder';
export type Where = 'terrace' | 'town' | 'plain' | 'road' | 'away';
export interface Seg { t0: number; t1: number; place: string; act: ActivityId; why: string; where: Where;
  /** the person this one is with (a child with its mother or minder, an infant carried): they are at the same place */
  with?: number }
export interface Person {
  id: number; sex: 'm' | 'f'; age: number; job: Job; sub: string; rank: number; hh: number; hh2: number; marry: number; group: number;
  origin: string; persian: boolean; born: number; dies: number; arrive: number; leave: number; qa: number; ties: number[]; bday: number; trait: number;
  file: number; idx: number; gang: number; squad: number; agent: number; mother: number; zone: 'terrace' | 'town' | 'plain' | 'transient'; work: string;
  /** the detailed agent's name when this person is one of the Terrace slice */
  nm?: string | null;
  /** a married woman, or a woman of a work group with her own household: she may bear a child this year */
  wife?: boolean;
  /** an unmarried son or daughter living with the parents (lives.json family) */
  kin?: 'son' | 'daughter';
  /** unmarried (may marry this year: lives.json marriage) */
  single?: boolean;
  /** the move on `marry` is a child going to kin after the last adult of its household died (not a marriage) */
  moved?: 'fostered';
}
export interface Household { id: number; home: string; q: string; zone: 'town' | 'plain' | 'terrace' | 'transient'; xy: [number, number]; persian: boolean; members: number[]; kin: number[]; deaths: number[]; births: number[];
  /** the house plot (town_plots.json id) of a town household, and all its plots when it needs more than one (estates) */
  plot?: string; plots?: string[]; shares?: number[]; need?: number;
  /** people who join it by marriage during the year (from their `marry` day) */
  joins: number[] }
export interface Group { id: number; kind: string; label: string; members: number[]; issuePlace: string; silver: boolean; head: number; from: number; zone: 'terrace' | 'town' }
export interface SliceSeat { agent: number; role: string; sex: 'm' | 'f'; origin: string; mother?: number; name?: string | null }
export interface PopOpts { court?: boolean; slice?: SliceSeat[] }
/** the main field task of a farming household on a day (shared by its members): what, where, the hours, who goes */
export interface PTask { kind: 'reap' | 'thresh' | 'vintage' | 'fruit' | 'plough' | 'canal' | 'turn' | 'field'; act: ActivityId; place: string; why: string; h0: number; h1: number; all: boolean; sheaves: boolean; late: number }
/** a household's day (lives.json meals, household_bread): who eats at home, bread, the shared meal times and lengths */
export interface HDay { eaters: number; women: number[]; bake: boolean; baker: number; breakfast: number; bLen: number; noon: number; nLen: number; supper: number; sLen: number; grindEach: number; birthday: number; task: PTask | null;
  /** the house's own sense of midday and evening (lives.json meals.house_habit_h) */
  habit: number }

/** Terrace places used only by the abstract tier (no full-agent spot yet): their people are counted, not rendered */
export const TERRACE_ABSTRACT = ['hall100_site', 'treasury_inside', 'palaces', 'h100_wall_N', 'h100_wall_S', 'h100_wall_E', 'h100_wall_W', 'camp_extra', 'stair_extra'];
/** the sixteen posts (people_places.json) */
export const GUARD_POSTS = ['post_stair_n', 'post_stair_s', 'post_gate_w1', 'post_gate_w2', 'post_gate_s1', 'post_gate_s2', 'post_apa_w', 'post_apa_e', 'post_treas_1', 'post_treas_2',
  'post_tachara_1', 'post_tachara_2', 'post_hadish_1', 'post_hadish_2', 'post_harem_1', 'post_harem_2'];
export const HEARTHS = ['garrison_hearth_s', 'garrison_hearth_m', 'garrison_hearth_n'];
const TERRACE_XY: [number, number] = [-52, 118.5];
const S = { plan: salt('plan'), sick: salt('sick'), sickd: salt('sickd'), death: salt('death'), birth: salt('birth'), marry: salt('marry'), bday: salt('bday'), disp: salt('disp'),
  dispo: salt('dispo'), assign: salt('assign'), shear: salt('shear'), carer: salt('carer'), gen: salt('gen'), mourn: salt('mourn'), dbl: salt('dbl'), fam: salt('fam'), draft: salt('draft'), name: salt('name'), nurse: salt('nurse'), kid: salt('kid') };
const AGE: [number, number, number][] = L.age_structure.v;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** monthly grain ration by category (population.json ration_scale; the age steps for children are C) */
function rationQa(sex: 'm' | 'f', age: number, skill: number, head: boolean): number {
  if (age < 4) return 0;
  if (age < 16) return age < 8 ? 10 : age < 12 ? 15 : 20;
  if (head) return sex === 'f' ? 50 : 50;
  if (sex === 'm') return skill > 0.5 ? 45 : 30;
  return skill > 0.5 ? 40 : skill > 0.2 ? 30 : 20;
}

export class Population {
  readonly persons: Person[] = [];
  readonly households: Household[] = [];
  readonly groups: Group[] = [];
  readonly builders: number[] = [];
  readonly priests: number[] = [];
  readonly silverGroups: number[] = [];
  readonly gangs: { id: number; kind: 'stone' | 'labour' | 'brick'; chief: number; members: number[] }[] = [];
  readonly garrison: number[] = [];
  readonly parties: ReturnType<typeof travellerParties>;
  readonly transferList: ReturnType<typeof transfers>;
  readonly bands: ReturnType<typeof transhumantBands>;
  readonly drives: ReturnType<typeof flockDrives>;
  readonly quarters: Record<string, { id: string; xy: [number, number]; kind: string; women: number[]; farmers: number[] }> = {};
  readonly bySeat = new Map<number, number>();
  cal!: EventCalendar;
  private lifeByDay: { births: number[]; deaths: number[]; marriages: number[] }[] = [];
  private bdayByDay: number[][] = [];
  private shepherds: number[] = [];
  private facilities: Record<string, [number, number]> = {};
  private rotaCache = new Map<number, Map<number, { watch: 0 | 1 | 2; post: string | null; called: boolean }>>();
  private rel = new Map<number, [number, number][]>();
  private kidsOf = new Map<number, number[]>();
  private hdCache = new Map<number, HDay>();
  private planCache = new Map<number, Map<number, Seg[]>>(); private planCount = 0;
  constructor(readonly seed: number, readonly opts: PopOpts = {}) {
    for (const f of T.facilities) this.facilities[f.id] = f.at;
    this.parties = travellerParties(seed, !!opts.court); this.transferList = transfers(seed); this.bands = transhumantBands(seed); this.drives = flockDrives(seed);
    this.generate();
    for (const s of opts.slice ?? []) { const pid = this.bySeat.get(s.agent); if (pid !== undefined) this.persons[pid].nm = s.name ?? null; }
    this.precomputeLife();
    this.housePlots();
  }
  attach(cal: EventCalendar) { this.cal = cal; }
  /** the plot a household lives in (town households: always; others: none) */
  plotOf(h: number): TownPlot | null { const id = this.households[h]?.plot; return id ? PLOT_BY_ID.get(id) ?? null : null; }
  /** the most people a household holds on any day of the year (births, marriages, fosterage, deaths, arrivals) */
  private maxMembers(H: Household) {
    const diff = new Int16Array(REGNAL_DAYS + 1); const span = (a: number, b: number) => { a = Math.max(0, a); b = Math.min(REGNAL_DAYS - 1, b); if (a <= b) { diff[a]++; diff[b + 1]--; } };
    for (const x of H.members) { const q = this.persons[x]; const a = Math.max(q.arrive, q.born), b = Math.min(q.dies, q.leave); span(a, q.hh2 >= 0 && q.marry < 1e9 ? Math.min(b, q.marry - 1) : b); }
    for (const x of H.joins) { const q = this.persons[x]; span(Math.max(q.arrive, q.born, q.marry), Math.min(q.dies, q.leave)); }
    let m = 0, c = 0; for (let d = 0; d < REGNAL_DAYS; d++) { c += diff[d]; if (c > m) m = c; } return m;
  }
  /** every town household gets a real house plot of the built settlement (town_plots.json; D-081): its own quarter's
   *  sites first (the settlement zone of the quarter, nearest sites first), then the nearest sites elsewhere; a craft
   *  household a workshop of its craft where there is one; empty houses before shared ones (several households in a
   *  large house: C); a household larger than any house (the estates) takes neighbouring plots; no plot is ever over
   *  its capacity on any day. Quarters then follow their houses (lane, well and neighbours) */
  private housePlots() {
    const usable = TOWN_PLOTS.filter(x => x.capacity > 0 && x.kind !== 'station');
    const free = new Map(usable.map(x => [x.id, x.capacity])); const used = new Set<string>();
    const d2 = (a: [number, number], b: [number, number]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    const townQ = (T.quarters as any[]).filter(q => q.kind === 'town' || q.kind === 'garden');
    const siteIds = Object.keys(TOWN_SITES);
    // the population quarter each settlement site belongs to: the nearest quarter of its zone, else the nearest
    const owner = new Map(siteIds.map(sid => { const S = TOWN_SITES[sid]; const same = townQ.filter(q => q.zone === S.zone); const pool = same.length ? same : townQ;
      return [sid, pool.reduce((b, q) => d2(q.at, S.c) < d2(b.at, S.c) ? q : b).id as string]; }));
    const order = new Map(townQ.map(q => [q.id, [...siteIds].sort((a, b) => ((TOWN_SITES[a].zone === q.zone ? 0 : 1) - (TOWN_SITES[b].zone === q.zone ? 0 : 1)) || d2(TOWN_SITES[a].c, q.at) - d2(TOWN_SITES[b].c, q.at) || (a < b ? -1 : 1))]));
    const plotsIn = new Map<string, TownPlot[]>(); for (const x of usable) (plotsIn.get(x.site) ?? plotsIn.set(x.site, []).get(x.site)!).push(x);
    const craftOf = (H: Household) => { for (const x of H.members) { const j = this.persons[x].job; if (j === 'weaver') return ['textile']; if (j === 'brewer') return ['brewery']; if (j === 'craftsman') return ['metal', 'wood', 'pottery', 'pigment']; } return null; };
    const hs = this.households.filter(H => H.zone === 'town'); for (const H of hs) H.need = Math.max(1, this.maxMembers(H));
    hs.sort((a, b) => b.need! - a.need! || a.id - b.id);
    const take = (H: Household, id: string) => { free.set(id, free.get(id)! - H.need!); used.add(id); H.plot = id; };
    const zoneOf = new Map(townQ.map(q => [q.id, q.zone as string]));
    const tryIn = (H: Household, sids: string[], ok: (x: TownPlot) => boolean) => { for (const sid of sids) for (const x of plotsIn.get(sid) ?? []) if (ok(x) && free.get(x.id)! >= H.need!) return x.id; return null; };
    const house = (x: TownPlot) => !used.has(x.id) && x.kind !== 'workshop', empty = (x: TownPlot) => !used.has(x.id), any = () => true;
    for (const H of hs) {
      const ord = order.get(H.q) ?? siteIds, own = ord.filter(sid => TOWN_SITES[sid].zone === zoneOf.get(H.q)), other = ord.filter(sid => TOWN_SITES[sid].zone !== zoneOf.get(H.q));
      const cr = craftOf(H); let id: string | null = null;
      if (cr) id = tryIn(H, own, x => x.kind === 'workshop' && !!x.craft && cr.includes(x.craft) && !used.has(x.id));
      id ??= tryIn(H, own, house) ?? tryIn(H, own, empty) ?? tryIn(H, own, any);
      if (id) { take(H, id); continue; }
      // larger than any free house of its zone (an estate): the empty plots of one site of its zone together, before
      // anything elsewhere
      const multi = (sids: string[]) => { for (const sid of sids) { const cand = (plotsIn.get(sid) ?? []).filter(x => !used.has(x.id)).sort((a, b) => b.capacity - a.capacity || (a.id < b.id ? -1 : 1));
        const ids: string[] = []; let cap = 0; for (const x of cand) { ids.push(x.id); cap += x.capacity; if (cap >= H.need!) break; }
        if (cap >= H.need!) { let left = H.need!; H.shares = []; for (const i of ids) { const t = Math.min(free.get(i)!, left); free.set(i, free.get(i)! - t); left -= t; used.add(i); H.shares.push(t); } H.plot = ids[0]; H.plots = ids; return true; } } return false; };
      if (H.need! > 10 && multi(own)) continue;
      for (const sid of other) { id = tryIn(H, [sid], house) ?? tryIn(H, [sid], empty) ?? tryIn(H, [sid], any); if (id) break; }
      if (id) { take(H, id); continue; }
      for (const sid of order.get(H.q) ?? siteIds) { const cand = (plotsIn.get(sid) ?? []).filter(x => !used.has(x.id)).sort((a, b) => b.capacity - a.capacity || (a.id < b.id ? -1 : 1));
        const ids: string[] = []; let cap = 0; for (const x of cand) { ids.push(x.id); cap += x.capacity; if (cap >= H.need!) break; }
        if (cap >= H.need!) { let left = H.need!; H.shares = []; for (const i of ids) { const t = Math.min(free.get(i)!, left); free.set(i, free.get(i)! - t); left -= t; used.add(i); H.shares.push(t); } H.plot = ids[0]; H.plots = ids; break; } }
      if (!H.plot) throw new Error(`household ${H.id} (${H.need} people) finds no house plot`);
    }
    // quarters follow their houses: a household housed in another quarter's site belongs to that quarter's lanes
    for (const H of hs) { const x = PLOT_BY_ID.get(H.plot!)!; H.q = owner.get(x.site) ?? H.q; H.xy = [x.door[0], x.door[1]]; }
    for (const q of townQ) { const Q = this.quarters[q.id]; if (!Q) continue; const mine = hs.filter(H => H.q === q.id); if (mine.length) Q.xy = [mine.reduce((s0, H) => s0 + H.xy[0], 0) / mine.length, mine.reduce((s0, H) => s0 + H.xy[1], 0) / mine.length];
      Q.women = []; Q.farmers = []; }
    for (const p of this.persons) { const H = this.households[p.hh]; if (H.zone !== 'town' || !this.quarters[H.q]) continue; if (p.sex === 'f' && p.age >= 14) this.quarters[H.q].women.push(p.id); if (p.job === 'gardener' || p.job === 'farmer') this.quarters[H.q].farmers.push(p.id); }
  }

  // ================================================================== generation
  private rng(k: number) { return new HStream(this.seed, S.gen, k); }
  private hh(q: string, zone: Household['zone'], persian: boolean, home?: string): number {
    const id = this.households.length; const Q = this.quarters[q]; const r = this.rng(100000 + id);
    const xy: [number, number] = Q ? [Q.xy[0] + r.range(-250, 250), Q.xy[1] + r.range(-250, 250)] : [0, 0];
    this.households.push({ id, home: home ?? `h:${id}`, q, zone, xy, persian, members: [], kin: [], deaths: [], births: [], joins: [] }); return id;
  }
  private person(x: Partial<Person> & { sex: 'm' | 'f'; age: number; job: Job; hh: number }): number {
    const id = this.persons.length; const r = this.rng(id); const H = this.households[x.hh];
    const p: Person = { id, sub: '', rank: 0, hh2: -1, marry: 1e9, group: -1, origin: 'Persian', persian: H?.persian ?? true, born: -1e9, dies: 1e9, arrive: 0, leave: 1e9, qa: 0, ties: [],
      bday: Math.floor(r.next() * REGNAL_DAYS), trait: r.next(), file: -1, idx: -1, gang: -1, squad: -1, agent: -1, mother: -1, zone: H?.zone ?? 'town', work: '', ...x } as Person;
    // a woman of 15-50 who is not a daughter at home, a servant or an old woman is married, or heads her own household in a
    // work group (women of the pašap groups drew maternity rations: E-04), and may bear a child (C)
    if (p.wife === undefined) p.wife = p.sex === 'f' && p.age >= 15 && p.age <= 50 && !p.kin && !['servant', 'child', 'elder', 'traveller', 'herder'].includes(p.job);
    this.persons.push(p); H?.members.push(id); return id;
  }
  private group(kind: string, label: string, issuePlace: string, silver: boolean, zone: 'terrace' | 'town', from = 0): number {
    const id = this.groups.length; this.groups.push({ id, kind, label, members: [], issuePlace, silver, head: -1, from, zone }); if (silver) this.silverGroups.push(id); return id;
  }
  private join(g: number, pid: number, skill = 0, head = false) {
    const p = this.persons[pid], G = this.groups[g]; p.group = g; G.members.push(pid); p.qa = rationQa(p.sex, p.age, skill, head); if (head) { G.head = pid; p.rank = Math.max(p.rank, 1); }
  }
  private pickQuarter(r: HStream, kinds = ['town']) { const qs = T.quarters.filter((q: any) => kinds.includes(q.kind)); let u = r.next() * qs.reduce((s: number, q: any) => s + q.share, 0);
    for (const q of qs) { u -= q.share; if (u <= 0) return q.id as string; } return qs[0].id as string; }
  private ageIn(r: HStream, lo: number, hi: number) { return Math.floor(lerp(lo, hi + 0.999, r.next())); }
  /** the surviving children at home of the household's mother (lives.json family): her births from 16-21 on, every 2-4
   *  years, twins in ~1.5 % of maternities; children die at the E-71 rates; daughters who have married have left; nobody
   *  over 19 is generated. Every child knows its mother (C) */
  private kids(hh: number, r: HStream, origin: string, group = -1) {
    const H = this.households[hh], F = L.family;
    const mom = [...H.members].reverse().find(x => { const q = this.persons[x]; return q.sex === 'f' && q.wife === true && q.age >= 15 && q.age <= 50; });
    if (mom === undefined) return;
    const M = this.persons[mom]; const step = (tab: [number, number][], age: number) => { let v = tab[0][1]; for (const [a, x] of tab) if (age >= a) v = x; return v; };
    for (let a = lerp(F.first_birth_age[0], F.first_birth_age[1], r.next()); a <= Math.min(F.last_birth_age, M.age); a += lerp(F.birth_interval_y[0], F.birth_interval_y[1], r.next())) {
      const age = Math.floor(M.age - a); const n = r.chance(F.twins) ? 2 : 1;
      for (let t = 0; t < n; t++) { const sex: 'm' | 'f' = r.chance(0.5) ? 'm' : 'f';
        if (age > F.home_until_age[sex === 'm' ? 'son' : 'daughter'] || !r.chance(step(F.survival_to_age, age)) || (sex === 'f' && age >= 14 && r.chance(step(F.daughter_married_by_age, age)))) continue;
        this.child(hh, sex, age, origin, group, mom); }
    }
  }
  /** one child of the household (its job by age and zone: plain children work the fields from 12; sons of 14+ follow the
   *  father's trade or labour at the stores; daughters of 14+ do the women's work of the house) */
  private child(hh: number, sex: 'm' | 'f', age: number, origin: string, group: number, mother: number) {
    const H = this.households[hh], plain = H.zone === 'plain'; let job: Job = 'child', sub = '', work = ''; let kin: 'son' | 'daughter' | undefined;
    if (age >= 14) { kin = sex === 'm' ? 'son' : 'daughter';
      if (sex === 'f') job = 'homemaker';
      else { const fa = H.members.find(x => this.persons[x].sex === 'm' && !this.persons[x].kin && this.persons[x].age >= age + 16); const F = fa !== undefined ? this.persons[fa] : null;
        job = plain ? 'farmer' : F && (F.job === 'gardener' || F.job === 'craftsman') ? F.job : 'porter'; sub = job === 'porter' ? 'town' : ''; work = plain ? `field:${hh}` : F && job === F.job ? F.work : ''; } }
    else if (age >= 12 && plain) job = 'farmer';
    const c = this.person({ sex, age, job, sub, hh, origin, mother, kin, single: kin ? true : undefined, work });
    if (group >= 0 && age >= 4) this.join(group, c);
    return c;
  }
  /** a child for a work group's ration list, placed with one of the group's women whose own history allows its age */
  private childFor(hhs: number[], sex: 'm' | 'f', lo: number, hi: number, r: HStream, group: number) {
    for (let k = 0; k < 16; k++) { const hh = hhs[Math.floor(r.next() * hhs.length)]; const H = this.households[hh];
      const mom = H.members.find(x => this.persons[x].wife); if (mom === undefined) continue; const M = this.persons[mom];
      const age = lo + Math.floor(r.next() * (hi - lo + 1)); if (age > M.age - L.family.first_birth_age[0]) continue;
      if (H.members.some(x => this.persons[x].mother === mom && Math.abs(this.persons[x].age - age) < L.family.birth_interval_y[0]) && !r.chance(L.family.twins)) continue;
      return this.child(hh, sex, age, M.origin, group, mom); }
    return null;
  }
  private generate() {
    const seats = this.opts.slice ?? [];
    for (const q of T.quarters) this.quarters[q.id] = { id: q.id, xy: q.at, kind: q.kind, women: [], farmers: [] };
    const seatOf = (role: string) => seats.filter(s => s.role === role);
    const R = this.rng(-1);
    // ---------------- garrison: 100 men in ten files of ten (population.json garrison_company, HDT decimal units; C)
    const gG = this.group('garrison', 'the Terrace garrison', 'stair_foot', false, 'terrace');
    const guardSeats = seatOf('guard');
    for (let i = 0; i < 100; i++) {
      const seat = guardSeats[i]; const r = this.rng(-100 - i);
      const fam = r.chance(L.guard_family_share.v);
      const hh = fam ? this.hh(this.pickQuarter(r), 'town', true) : this.hh('garrison', 'terrace', true, 'garrison_sleep');
      const pid = this.person({ sex: 'm', age: this.ageIn(r, 20, 45), job: 'guard', hh, origin: seat?.origin ?? (i % 2 ? 'Median' : 'Persian'), file: Math.floor(i / 10), idx: i % 10, rank: i % 10 === 0 ? 1 : 0, agent: seat?.agent ?? -1, zone: 'terrace', work: 'garrison_sleep' });
      this.join(gG, pid); this.garrison.push(pid); if (seat) this.bySeat.set(seat.agent, pid);
      if (fam) { this.person({ sex: 'f', age: this.ageIn(r, 17, 38), job: 'homemaker', hh, origin: 'Persian' }); this.kids(hh, r, 'Persian'); }
    }
    // ---------------- building gangs: three of ~100 under a chief with leaders of ten (PT-WAGE, C); the slice squad is in the stone gang
    const kinds: ('stone' | 'labour' | 'brick')[] = ['stone', 'labour', 'brick'];
    const origins = ['Ionian', 'Egyptian', 'Syrian', 'Babylonian', 'Lydian', 'Carian', 'Cappadocian', 'Elamite', 'Bactrian', 'Sogdian', 'Thracian'];
    const famGroups: number[] = [];
    for (let k = 0; k < 3; k++) famGroups.push(this.group('pasap', `the women's work group of the builders' families (${k + 1})`, 'store_town', false, 'town'));
    const camp = this.group('camp', 'the work-camp women of the Terrace gangs', 'stair_foot', false, 'terrace');
    let lodging = -1, lodged = 0;
    for (let k = 0; k < 3; k++) {
      const g = this.group('gang', '', 'stair_foot', true, 'terrace'); const members: number[] = [];
      for (let i = 0; i < 100; i++) {
        const r = this.rng(-1000 - k * 100 - i);
        let seat: SliceSeat | undefined; if (k === 0 && i === 1) seat = seatOf('foreman')[0]; if (k === 0 && i >= 2 && i < 14) seat = seatOf('mason')[i - 2];
        const origin = seat?.origin ?? (k === 2 ? (r.chance(0.5) ? 'Elamite' : 'Persian') : r.pick(origins));
        const married = r.chance(0.65);
        let hh: number;
        if (married) hh = this.hh(this.pickQuarter(r, ['town']), 'town', origin === 'Persian');
        else { if (lodging < 0 || lodged >= 10) { lodging = this.hh(r.chance(0.5) ? 'q_lt_e' : 'q_lt_w', 'town', false); lodged = 0; } hh = lodging; lodged++; }
        const pid = this.person({ sex: 'm', age: this.ageIn(r, 18, 50), job: 'builder', sub: kinds[k], hh, origin, gang: k, squad: Math.floor(i / 10), rank: i === 0 ? 2 : i % 10 === 1 ? 1 : 0, agent: seat?.agent ?? -1, work: 'hall100_site', single: !married });
        if (k === 0 && i < 14) this.persons[pid].squad = 0; // the slice squad: foreman + 12 stonecutters (+ the chief) share one squad
        this.join(g, pid, k === 0 ? 0.8 : 0, i === 0); members.push(pid); this.builders.push(pid); if (seat) this.bySeat.set(seat.agent, pid);
        if (married) { const w = this.person({ sex: 'f', age: this.ageIn(r, 17, 40), job: 'homemaker', hh, origin }); this.join(famGroups[(i + k) % 3], w, 0.1); this.kids(hh, r, origin, famGroups[(i + k) % 3]); }
      }
      this.gangs.push({ id: k, kind: kinds[k], chief: members[0], members }); this.groups[g].label = `the ${kinds[k]} gang of ${this.nameOf(members[0]) ?? 'an unnamed chief'}`;
    }
    // work-camp women (the slice's bakers and grinders + builders' wives; C) and the slice's children
    const campSeats = [...seatOf('baker'), ...seatOf('grinder')];
    const campWomen: number[] = [];
    for (let i = 0; i < 30; i++) {
      const seat = campSeats[i]; const r = this.rng(-2000 - i);
      const hh = this.hh(this.pickQuarter(r), 'town', seat?.origin === 'Persian');
      const pid = this.person({ sex: 'f', age: seat && seats.some(x => x.role === 'child' && x.mother === seat.agent) ? this.ageIn(r, 26, 38) : this.ageIn(r, 17, 42), job: 'camp', sub: seat?.role ?? (i < 8 ? 'baker' : 'grinder'), hh, origin: seat?.origin ?? r.pick(['Persian', 'Elamite']), agent: seat?.agent ?? -1, work: 'querns' });
      this.join(camp, pid, 0.3, i === 0); campWomen.push(pid); if (seat) this.bySeat.set(seat.agent, pid);
      const kidSeats = seats.filter(s => s.role === 'child' && s.mother === seat?.agent);
      for (const ks of kidSeats) { const c = this.person({ sex: ks.sex, age: 6 + Math.floor(r.next() * 4), job: 'child', hh, origin: ks.origin, agent: ks.agent, mother: pid }); this.join(camp, c); this.bySeat.set(ks.agent, c); }
      if (!seat) this.kids(hh, r, this.persons[pid].origin, camp);
      if (r.chance(0.5)) this.person({ sex: 'm', age: this.ageIn(r, 20, 50), job: 'porter', sub: 'town', hh, origin: this.persons[pid].origin });
    }
    // ---------------- porters of the Terrace (40, C) incl. the slice's six
    const porterSeats = seatOf('porter'); const pG = this.group('porters', 'the porters of the Terrace depot', 'stair_foot', true, 'terrace');
    for (let i = 0; i < 40; i++) { const seat = porterSeats[i]; const r = this.rng(-3000 - i); const origin = seat?.origin ?? r.pick(['Elamite', 'Persian']);
      const hh = this.hh(this.pickQuarter(r), 'town', origin === 'Persian'); const pid = this.person({ sex: 'm', age: this.ageIn(r, 18, 45), job: 'porter', sub: 'terrace', hh, origin, agent: seat?.agent ?? -1, work: 'stair_foot' });
      this.join(pG, pid); if (seat) this.bySeat.set(seat.agent, pid);
      if (r.chance(0.6)) { this.person({ sex: 'f', age: this.ageIn(r, 17, 40), job: 'homemaker', hh, origin }); this.kids(hh, r, origin); } else this.persons[pid].single = true; }
    // ---------------- treasury people: ~1,400 in pašap-type groups (LIVIUS-TREAS 1,348 B; Liduma composition B; mapping C).
    // About 100 of them work inside the Treasury on the Terrace (scribes incl. the slice's two, storekeepers, weighers, shiners)
    const scribeSeats = seatOf('scribe'); let terraceStaff = 0;
    for (let k = 0; k < 15; k++) {
      const g = this.group('treasury', `treasury workers' group ${k + 1}`, 'store_town', true, 'town');
      const ws = `ws:${k % T.treasury_workshops.n}`; const craft = ['shiner', 'wood', 'textile', 'handler'][k % 4];
      const mix = POPD.work_group_templates.find((t: any) => t.id === 'pasap_group').mix; // 16 men, 45 women, 18 boys, 13 girls of 92
      const hhs: number[] = [];
      for (let w = 0; w < mix.women; w++) { const r = this.rng(-4000 - k * 100 - w); const hh = this.hh(this.pickQuarter(r, ['town']), 'town', false); hhs.push(hh);
        const origin = r.pick(['Egyptian', 'Babylonian', 'Ionian', 'Syrian', 'Elamite', 'Lydian']);
        const staff = terraceStaff < 100 && w < 2; if (staff) terraceStaff++;
        const pid = this.person({ sex: 'f', age: this.ageIn(r, 16, 50), job: 'treasury', sub: staff ? 'storekeeper' : craft, hh, origin, work: staff ? 'treasury_store' : ws });
        this.join(g, pid, w === 0 ? 1 : r.next(), w === 0); }
      for (let m = 0; m < mix.men; m++) { const r = this.rng(-4500 - k * 100 - m); const hh = m < 12 ? hhs[m * 3] : this.hh(this.pickQuarter(r), 'town', false);
        let seat: SliceSeat | undefined; if (k < scribeSeats.length && m === 0) seat = scribeSeats[k];
        const staff = !!seat || (terraceStaff < 100 && m < 4); if (staff) terraceStaff++;
        const origin = seat?.origin ?? this.persons[this.households[hh].members[0]]?.origin ?? 'Babylonian';
        const pid = this.person({ sex: 'm', age: this.ageIn(r, 18, 55), job: seat ? 'scribe' : 'treasury', sub: seat ? 'treasury' : staff ? (m % 2 ? 'weigher' : 'shiner') : craft, hh, origin, agent: seat?.agent ?? -1, work: seat ? 'treasury_desk' : staff ? 'treasury_inside' : ws });
        this.join(g, pid, 0.7); if (seat) this.bySeat.set(seat.agent, pid); }
      for (let c = 0; c < mix.boys + mix.girls; c++) { const r = this.rng(-4800 - k * 100 - c);
        const c0 = this.childFor(hhs, c < mix.boys ? 'm' : 'f', 4, 15, r, g); if (c0 !== null && this.persons[c0].age >= 12) { this.persons[c0].job = 'treasury'; this.persons[c0].sub = craft; this.persons[c0].work = ws; } }
    }
    // ---------------- officials, scribes and storekeepers with their households (~500; C)
    const offG = this.group('officials', 'officials, scribes and storekeepers', 'store_town', false, 'town');
    const offSeats = seatOf('official');
    for (let i = 0; i < 60; i++) { const r = this.rng(-5000 - i); const job: Job = i < 15 ? 'official' : i < 40 ? 'scribe' : 'storekeeper'; const seat = job === 'official' ? offSeats[i] : undefined;
      const persian = job === 'official' || r.chance(0.3); const hh = this.hh(job === 'official' ? (r.chance(0.5) ? 'q_north' : this.pickQuarter(r)) : this.pickQuarter(r), 'town', persian);
      const origin = seat?.origin ?? (persian ? 'Persian' : r.pick(['Elamite', 'Babylonian', 'Syrian']));
      const pid = this.person({ sex: 'm', age: this.ageIn(r, 25, 60), job, sub: job === 'scribe' ? r.pick(['store', 'office']) : '', hh, origin, agent: seat?.agent ?? -1, work: job === 'official' ? 'official_bldg' : job === 'scribe' ? 'store_town' : 'store_town' });
      this.join(offG, pid, 1); this.persons[pid].qa = job === 'official' ? 60 : 40; if (seat) this.bySeat.set(seat.agent, pid);
      this.person({ sex: 'f', age: this.ageIn(r, 18, 45), job: 'homemaker', hh, origin }); this.kids(hh, r, origin);
      for (let s = 0, n = job === 'official' ? r.int(1, 3) : r.int(0, 1); s < n; s++) { const age = this.ageIn(r, 14, 50); this.person({ sex: r.chance(0.5) ? 'm' : 'f', age, job: 'servant', hh, origin: r.pick(['Elamite', 'Persian']), single: age < 30 && r.chance(0.7) }); } }
    // ---------------- other state dependants (~1,000): mill, textile, brewery, stables, herdsmen, road station, caretakers, magi
    const stateGroup = (kind: string, label: string, n: number, job: Job, sub: string, sexF: number, work: string, k0: number, silver = false) => {
      const g = this.group(kind, label, 'store_town', silver, 'town');
      for (let i = 0; i < n; i++) { const r = this.rng(k0 - i); const sex = r.chance(sexF) ? 'f' : 'm'; const origin = r.pick(['Persian', 'Elamite', 'Persian']);
        const hh = this.hh(this.pickQuarter(r), 'town', origin === 'Persian'); const pid = this.person({ sex, age: this.ageIn(r, 16, 50), job, sub, hh, origin, work }); this.join(g, pid, r.next() * 0.6, i === 0);
        if (sex === 'm') { this.person({ sex: 'f', age: this.ageIn(r, 17, 40), job: 'homemaker', hh, origin }); } this.kids(hh, r, origin, sex === 'f' ? g : -1); }
      return g;
    };
    stateGroup('pasap', 'the women of the mill', 40, 'miller', '', 0.95, 'mill', -6000);
    stateGroup('pasap', 'the textile workers (1)', 45, 'weaver', '', 0.9, 'ws_textile', -6100);
    stateGroup('pasap', 'the textile workers (2)', 45, 'weaver', '', 0.9, 'ws_textile', -6200);
    stateGroup('men', 'the brewers', 12, 'brewer', '', 0.1, 'brewery', -6300);
    stateGroup('men', 'the grooms of the stables and the road station', 24, 'groom', '', 0, 'station', -6400);
    const sh = stateGroup('men', 'the state herdsmen', 32, 'shepherd', '', 0, 'stockyard', -6500); this.shepherds = this.groups[sh].members.slice();
    this.persons[this.shepherds[1]].sub = 'hides'; this.persons[this.shepherds[2]].sub = 'hides';
    const msgSeats = seatOf('courier'); const stG = this.group('men', 'the messengers of the road station', 'store_town', false, 'town');
    for (let i = 0; i < 8; i++) { const seat = msgSeats[i]; const r = this.rng(-6600 - i); const origin = seat?.origin ?? 'Persian'; const hh = this.hh(r.chance(0.5) ? 'q_pw_n' : 'q_pw_s', 'town', true);
      const pid = this.person({ sex: 'm', age: this.ageIn(r, 18, 40), job: 'messenger', hh, origin, agent: seat?.agent ?? -1, idx: i, work: 'station' }); this.join(stG, pid); if (seat) this.bySeat.set(seat.agent, pid);
      if (r.chance(0.6)) { this.person({ sex: 'f', age: this.ageIn(r, 17, 36), job: 'homemaker', hh, origin }); this.kids(hh, r, origin); } }
    stateGroup('men', 'the palace caretakers and lamp keepers', 30, 'caretaker', '', 0.3, 'palaces', -6700);
    for (let i = 0; i < 3; i++) { const r = this.rng(-6800 - i); const hh = this.hh('q_north', 'town', true); const pid = this.person({ sex: 'm', age: this.ageIn(r, 30, 60), job: 'priest', hh, origin: 'Persian', idx: i, work: 'offering_place' });
      this.priests.push(pid); this.person({ sex: 'f', age: this.ageIn(r, 20, 45), job: 'homemaker', hh, origin: 'Persian' }); this.kids(hh, r, 'Persian'); }
    // ---------------- non-state residents of the town (~3,000): garden farmers, estates, craftsmen (C)
    const townTarget = POPD.zones.find((z: any) => z.id === 'town').court_absent.night.spring.w;
    let e = 0; while (this.townCount() < townTarget - 1300) { const r = this.rng(-7000 - e++); const q = this.pickQuarter(r, ['town']); const hh = this.hh(q, 'town', true);
      const f = this.person({ sex: 'm', age: this.ageIn(r, 20, 55), job: 'gardener', hh, origin: 'Persian', work: `garden:${q}` }); this.quarters[q].farmers.push(f);
      this.person({ sex: 'f', age: this.ageIn(r, 17, 45), job: 'homemaker', hh, origin: 'Persian' }); this.kids(hh, r, 'Persian'); if (r.chance(0.3)) this.person({ sex: r.chance(0.5) ? 'm' : 'f', age: this.ageIn(r, 60, 72), job: 'elder', hh, origin: 'Persian' }); }
    for (let i = 0; i < 14; i++) { const r = this.rng(-7500 - i); const q = i % 2 ? 'q_firuzi' : 'q_gohar'; const hh = this.hh(q, 'town', true);
      this.person({ sex: 'm', age: this.ageIn(r, 30, 60), job: 'steward', hh, origin: 'Persian', work: `estate:${hh}` });
      for (let w = 0, n = r.int(1, 2); w < n; w++) this.person({ sex: 'f', age: this.ageIn(r, 18, 45), job: 'homemaker', hh, origin: 'Persian' });
      this.kids(hh, r, 'Persian');
      for (let s = 0, n = r.int(10, 24); s < n; s++) { const sx = r.chance(0.5) ? 'm' : 'f'; const age = this.ageIn(r, 14, 55); this.person({ sex: sx, age, job: sx === 'm' && r.chance(0.6) ? 'gardener' : 'servant', hh, origin: r.pick(['Persian', 'Elamite']), work: `estate:${hh}`, single: age < 30 && r.chance(0.7) }); } }
    let c = 0; while (this.townCount() < townTarget) { const r = this.rng(-8000 - c++); const hh = this.hh(r.chance(0.6) ? 'q_pw_n' : this.pickQuarter(r), 'town', r.chance(0.5));
      const origin = r.pick(['Persian', 'Elamite', 'Babylonian', 'Egyptian']); this.person({ sex: 'm', age: this.ageIn(r, 16, 55), job: 'craftsman', hh, origin, work: 'craft_zone' });
      this.person({ sex: 'f', age: this.ageIn(r, 17, 45), job: 'homemaker', hh, origin }); this.kids(hh, r, origin); }
    // ---------------- the plain: farming households in the 39 secure sites (Sumner B; sizes C)
    const V = T.villages; const plainW = POPD.zones.find((z: any) => z.id === 'plain').court_absent.night.summer.w;
    const vil: { id: string; xy: [number, number]; w: number }[] = V.located.map((x: any) => ({ id: x.id, xy: x.at, w: 0 }));
    for (let i = 0; i < V.unlocated_n; i++) { const r = this.rng(-9000 - i); const dist = lerp(V.unlocated_dist_km[0], V.unlocated_dist_km[1], r.next()) * 1000, ang = r.range(0, 2 * Math.PI); vil.push({ id: `v_${String(i + 1).padStart(2, '0')}`, xy: [Math.cos(ang) * dist, Math.sin(ang) * dist], w: 0 }); }
    const order = vil.map((_, i) => i).sort((a, b) => u01(this.seed, S.gen, 777, a) - u01(this.seed, S.gen, 777, b));
    order.forEach((vi, rank) => (vil[vi].w = 1 / Math.pow(rank + 1, V.rank_size_exponent)));
    const wsum = vil.reduce((s, x) => s + x.w, 0);
    let hi = 0;
    for (const v of vil) { this.quarters[v.id] = { id: v.id, xy: v.xy, kind: 'village', women: [], farmers: [] };
      const target = plainW * v.w / wsum; let n = 0;
      while (n < target) { const r = this.rng(-10000 - hi++); const hh = this.hh(v.id, 'plain', true);
        const m = this.person({ sex: 'm', age: this.ageIn(r, 18, 55), job: 'farmer', hh, origin: r.chance(0.9) ? 'Persian' : 'Elamite', work: `field:${hh}` }); this.quarters[v.id].farmers.push(m);
        const w = this.person({ sex: 'f', age: this.ageIn(r, 16, 45), job: 'homemaker', hh, origin: this.persons[m].origin }); void w;
        this.kids(hh, r, this.persons[m].origin); if (r.chance(0.35)) this.person({ sex: r.chance(0.5) ? 'm' : 'f', age: this.ageIn(r, 58, 75), job: 'elder', hh, origin: this.persons[m].origin });
        n += this.households[hh].members.length; } }
    // ---------------- transients: travelling parties (E-21), transhumant bands (E-49), work-group transfers (E-23)
    for (const pa of this.parties) { const hh = this.hh('station', 'transient', false, 'station');
      for (let k = 0; k < pa.size; k++) { const r = this.rng(-20000 - pa.i * 30 - k); this.person({ sex: 'm', age: this.ageIn(r, 18, 55), job: 'traveller', rank: k === 0 ? 1 : 0, hh, origin: 'Persian', arrive: pa.day, leave: Math.min(REGNAL_DAYS - 1, pa.day + pa.stay), zone: 'transient', idx: pa.i }); } }
    for (const b of this.bands) { const hh = this.hh(`band${b.i}`, 'transient', true, `camp:band${b.i}`);
      for (let k = 0; k < b.size; k++) { const r = this.rng(-30000 - b.i * 50 - k); this.person({ sex: r.chance(0.8) ? 'm' : 'f', age: this.ageIn(r, 10, 55), job: 'herder', hh, origin: 'Persian', arrive: b.day, leave: Math.min(REGNAL_DAYS - 1, b.day + b.stay), zone: 'transient', idx: b.i }); } }
    for (const x of this.transferList) { const g = this.group(x.kind === 'construction_gang' ? 'gang' : 'pasap', `a newly arrived work group (${x.size})`, 'store_town', false, 'town', x.day);
      for (let k = 0; k < x.size; k++) { const r = this.rng(-40000 - x.i * 2000 - k); const hh = k % 4 === 0 || this.households.length === 0 ? this.hh(r.chance(0.5) ? 'q_lt_w' : 'q_pw_s', 'town', false) : this.households.length - 1;
        const gang = x.kind === 'construction_gang'; const sex: 'm' | 'f' = gang ? 'm' : r.chance(0.6) ? 'f' : 'm';
        const pid = this.person({ sex, age: this.ageIn(r, gang ? 18 : 8, 45), job: gang ? 'builder' : sex === 'f' ? 'weaver' : 'porter', sub: gang ? 'labour' : sex === 'f' ? '' : 'town', hh, origin: 'Lycian', arrive: x.day, gang: gang ? 1 : -1, squad: 20 + (k >> 3), work: gang ? 'hall100_site' : 'ws_textile' });
        this.join(g, pid); if (gang) { this.builders.push(pid); this.gangs[1].members.push(pid); } } }
    // ---------------- ties: kin households in the same quarter/village, a friend at work, a neighbour (C)
    const byQ = new Map<string, number[]>(); for (const h of this.households) if (h.zone === 'town' || h.zone === 'plain') (byQ.get(h.q) ?? byQ.set(h.q, []).get(h.q)!).push(h.id);
    for (const [, list] of byQ) for (let i = 0; i < list.length; i++) { const r = this.rng(-50000 - list[i]); const n = r.int(1, 3);
      for (let k = 0; k < n; k++) { const o = list[Math.floor(r.next() * list.length)]; if (o !== list[i] && !this.households[list[i]].kin.includes(o)) { this.households[list[i]].kin.push(o); this.households[o].kin.push(list[i]); } } }
    for (const p of this.persons) {
      if (p.job === 'child' && p.age < 8) continue;
      const H = this.households[p.hh]; const r = this.rng(-60000 - p.id);
      for (const k of H.kin) { const o = this.households[k].members.find(x => this.persons[x].sex === p.sex && this.persons[x].age >= 14) ?? this.households[k].members[0]; if (o !== undefined && o !== p.id) p.ties.push(o); }
      if (p.group >= 0) { const G = this.groups[p.group].members; const f = G[Math.floor(r.next() * G.length)]; if (f !== p.id && !p.ties.includes(f)) p.ties.push(f); }
      if (H.zone === 'town' || H.zone === 'plain') { const Q = byQ.get(H.q)!; const n = this.households[Q[Math.floor(r.next() * Q.length)]]; const o = n.members[0]; if (o !== undefined && o !== p.id && !p.ties.includes(o)) p.ties.push(o);
        if (p.sex === 'f' && p.age >= 14) this.quarters[H.q]?.women.push(p.id); }
    }
    for (const q of Object.values(this.quarters)) if (!q.farmers.length) q.farmers = [];
  }
  private townCount() { let n = 0; for (const h of this.households) if (h.zone === 'town') n += h.members.length; return n; }

  // ================================================================== life events drawn once for the year
  private precomputeLife() {
    for (let d = 0; d < REGNAL_DAYS; d++) { this.lifeByDay.push({ births: [], deaths: [], marriages: [] }); this.bdayByDay.push([]); }
    const deathP = (age: number) => (L.death_p_year_by_age.v as [number, number, number][]).find(([a, b]) => age >= a && age <= b)?.[2] ?? 0.08;
    const n0 = this.persons.length;
    for (let i = 0; i < n0; i++) { const p = this.persons[i]; if (p.mother >= 0) (this.kidsOf.get(p.mother) ?? this.kidsOf.set(p.mother, []).get(p.mother)!).push(i); }
    // deaths (E-71)
    for (let i = 0; i < n0; i++) {
      const p = this.persons[i]; if (p.zone === 'transient') continue;
      const ud = u01(this.seed, S.death, i); const pd = deathP(p.age) * REGNAL_DAYS / 365;
      if (ud < pd) { p.dies = Math.max(p.arrive, Math.floor(ud / pd * REGNAL_DAYS)); this.lifeByDay[p.dies].deaths.push(i); this.households[p.hh].deaths.push(p.dies); }
    }
    // marriages (E-73, lives.json marriage): an unmarried young woman (a daughter at home, or a servant) marries an unmarried
    // man, of her own quarter or village if there is one, else of a kin household's; she moves to his household
    // (virilocal: ROTH1987, B for Babylonia / C here); if he lodges with other workers or in an estate, the two set up a
    // new house in his quarter. Nobody with a child, expecting one, or married marries; so no child loses its mother (C)
    const M = L.marriage; const brides: number[] = []; const grooms = new Map<string, number[]>(); let resident = 0;
    for (let i = 0; i < n0; i++) {
      const p = this.persons[i]; const H = this.households[p.hh]; if (H.zone !== 'town' && H.zone !== 'plain') continue; resident++;
      if (!p.single || p.dies < REGNAL_DAYS || this.kidsOf.has(i)) continue;
      if (p.sex === 'f' && p.age >= M.bride_age[0] && p.age <= M.bride_age[1]) brides.push(i);
      if (p.sex === 'm' && p.age >= M.groom_age[0] && p.age <= M.groom_age[1] && p.agent < 0) (grooms.get(H.q) ?? grooms.set(H.q, []).get(H.q)!).push(i);
    }
    const pm = Math.min(0.6, M.per_1000_year / 1000 * resident / Math.max(1, brides.length)) * REGNAL_DAYS / 365; const wed = new Set<number>();
    for (const b of brides) {
      const um = u01(this.seed, S.marry, b); if (um >= pm) continue; const B = this.persons[b], H = this.households[B.hh]; const day = Math.floor(um / pm * REGNAL_DAYS);
      const pools = [H.q, ...H.kin.map(k => this.households[k].q)]; let g = -1;
      for (const q of [...pools, ...[...grooms.keys()].filter(q => this.quarters[q]?.kind === this.quarters[H.q]?.kind)]) { const list = grooms.get(q) ?? []; const k0 = Math.floor(u01(this.seed, S.marry, b, 1) * Math.max(1, list.length));
        for (let k = 0; k < list.length && g < 0; k++) { const c = list[(k0 + k) % list.length]; if (!wed.has(c) && this.persons[c].hh !== B.hh && this.persons[c].age >= B.age + 2 && this.walkH(H.home, this.households[this.persons[c].hh].home, day, H.zone === 'plain' ? 'plain' : 'town', this.households[this.persons[c].hh].zone === 'plain' ? 'plain' : 'town') <= 1.5) g = c; } if (g >= 0) break; }
      if (g < 0) continue;
      const G = this.persons[g], GH = this.households[G.hh];
      const lodging = G.job === 'servant' || G.work.startsWith('estate:') || (GH.members.length > 2 && !GH.members.some(x => this.persons[x].sex === 'f' && this.persons[x].age >= 14));
      let to = G.hh;
      if (lodging) { to = this.hh(GH.q, GH.zone, GH.persian || B.persian); G.hh2 = to; G.marry = day; this.households[to].joins.push(g); }
      B.hh2 = to; B.marry = day; B.single = false; G.single = false; this.households[to].joins.push(b); wed.add(g); wed.add(b);
      for (const k of [B.hh, ...(lodging ? [G.hh] : [])]) if (k !== to && !this.households[to].kin.includes(k)) { this.households[to].kin.push(k); this.households[k].kin.push(to); }
      this.lifeByDay[day].marriages.push(b);
    }
    // births (E-70): a married woman of 15-44 whose youngest child is weaned enough: none while her child is under one, a
    // child of one only in the second half of the year (birth spacing: lives.json birth_p_year_women_15_44, family; C)
    for (let i = 0; i < n0; i++) {
      const p = this.persons[i]; if (p.zone === 'transient' || p.sex !== 'f' || !p.wife || p.age < 15 || p.age > 44) continue;
      const youngest = Math.min(99, ...(this.kidsOf.get(i) ?? []).map(c => this.persons[c].age));
      const ub = u01(this.seed, S.birth, i); const pb = L.birth_p_year_women_15_44.v * REGNAL_DAYS / 365; if (ub >= pb) continue;
      const day = Math.floor(ub / pb * REGNAL_DAYS); if (day >= p.dies || day < p.arrive || youngest === 0 || (youngest === 1 && day < 180)) continue;
      const home = this.home(i, day);
      const c = this.person({ sex: u01(this.seed, S.birth, i, 1) < 0.5 ? 'm' : 'f', age: 0, job: 'child', hh: home, origin: p.origin, born: day, mother: i, arrive: day });
      (this.kidsOf.get(i) ?? this.kidsOf.set(i, []).get(i)!).push(c);
      if (u01(this.seed, S.birth, i, 2) < L.infant_death_first_year.v) { const dd = Math.min(REGNAL_DAYS - 1, day + 1 + Math.floor(u01(this.seed, S.birth, i, 3) * 120)); this.persons[c].dies = dd; this.lifeByDay[dd].deaths.push(c); this.households[home].deaths.push(dd); }
      if (p.group >= 0) this.join(p.group, c);
      this.lifeByDay[day].births.push(c); this.households[home].births.push(day);
    }
    for (let i = 0; i < n0; i++) { const p = this.persons[i]; if (p.persian && p.age >= 16 && p.bday >= 0 && (p.zone === 'town' || p.zone === 'plain' || p.job === 'guard')) this.bdayByDay[p.bday].push(i); }
    this.foster();
  }
  /** the household's day: its shared meal times and their lengths follow real causes (the sun, a baking day, how many eat,
   *  the season, a birthday, the field work of the day); the women share the grinding for everyone who eats (C) */
  hday(h: number, d: number): HDay {
    const key = h * 512 + d; const c = this.hdCache.get(key); if (c) return c; if (this.hdCache.size > 60000) this.hdCache.clear();
    const H = this.households[h], C = this.cal.ctx(d), M = L.meals, hb = L.household_bread;
    const mem = this.membersOn(h, d).filter(x => !this.sick(x, d) || this.persons[x].age < 5);
    const eaters = mem.filter(x => this.persons[x].job !== 'guard' && this.persons[x].age >= 1).length;
    const women = mem.filter(x => { const q = this.persons[x]; return q.sex === 'f' && q.age >= 12 && q.job !== 'elder' && !this.sick(x, d) && !(this.gaveBirth(x, d) >= 0 && this.gaveBirth(x, d) <= 7); });
    const winter = C.season === 'winter'; const bake = (d + h) % hb.bake_every_days === 0; const task = H.zone === 'plain' ? this.ptask(h, d, C) : null;
    const birthday = mem.find(x => this.persons[x].persian && this.persons[x].age >= 16 && this.persons[x].bday === d) ?? -1;
    let breakfast = C.sun.rise + M.breakfast_after_sunrise_h + (bake ? M.baking_day_later_h : 0);
    const bLen = M.breakfast_h + M.per_eater_h * eaters + (bake ? M.baking_day_longer_h : 0);
    if (task) breakfast = Math.min(breakfast, task.h0 - bLen - (task.all ? 0.3 : 0.2)); // a field day: the household eats before its people go out
    const habit = (u01(this.seed, S.assign, 9100 + h) * 2 - 1) * M.house_habit_h;
    const noon = task?.all ? task.h1 + 0.15 : 12 + habit; const nLen = M.midday_home_h + M.per_eater_h * eaters;
    const supper = C.sun.set - M.supper_before_sunset_h - (winter ? M.winter_earlier_h : 0) + (task?.sheaves ? M.harvest_later_h : 0) + habit;
    const sLen = M.supper_h + 1.5 * M.per_eater_h * eaters + (winter ? M.winter_longer_h : 0) + (birthday >= 0 ? M.birthday_longer_h : 0);
    const r: HDay = { eaters, women, bake, baker: women[0] ?? -1, breakfast, bLen, noon, nLen, supper, sLen, grindEach: hb.grind_h_per_eater * eaters / Math.max(1, women.length), birthday, task, habit };
    this.hdCache.set(key, r); return r;
  }
  /** the day's field task of a farming household (E-40 ... E-50): harvest and threshing, the vintage and the fruit take the
   *  whole household; ploughing, the canal, the water turn and hoeing are the men's. The hours follow the heat (the hotter
   *  the day, the earlier the reapers stop) and the size of the holding (2-4 plots) (C) */
  ptask(h: number, d: number, C: DayCtx): PTask | null {
    const agri = C.agri, u = (k: number) => u01(this.seed, S.assign, 7700 + h, d, k), q = this.households[h].q;
    const plots = 2 + Math.floor(u01(this.seed, S.assign, 9000 + h) * 3); const field = `field:${h}:${Math.floor((d + h) / 3) % plots}`;
    const harvest = agri.has('E-41') || agri.has('E-42'), thresh = agri.has('E-43');
    const hot = Math.max(0, Math.min(1, (C.wx.tmax - 26) / 12)); // 0 at 26 °C, 1 at 38 °C
    const end = (lo: number, hi: number) => Math.max(lo, Math.min(hi, hi - (hi - lo) * hot + 0.25 * (plots - 3)));
    const rise = C.sun.rise; const late = C.sun.set - 2.2;
    if (harvest && (!thresh || (h + d) % 2 === 1)) { // on some days the household helps kin with their harvest (C)
      const H = this.households[h]; const near = H.kin.filter(k => this.households[k].zone === 'plain' && this.walkH(H.home, this.households[k].home, d, 'plain', 'plain') <= 0.75);
      const kin = near.length && u(6) < L.homemaker.kin_help ? near[Math.floor(u(7) * near.length)] : -1; const K = kin >= 0 ? this.households[kin] : null;
      const place = K && K.zone === 'plain' ? `field:${kin}:${Math.floor((d + kin) / 3) % (2 + Math.floor(u01(this.seed, S.assign, 9000 + kin) * 3))}` : field;
      return { kind: 'reap', act: 'reap', place, why: place !== field ? 'helping kin with their harvest' : `the ${agri.has('E-41') ? 'barley' : 'wheat'} harvest (${agri.has('E-41') ? 'E-41' : 'E-42'})`, h0: rise - 0.1, h1: end(10, 12.3), all: true, sheaves: u(4) < 0.6, late }; }
    if (thresh) return { kind: 'thresh', act: 'thresh', place: `threshing:${q}`, why: 'threshing and winnowing on the village floor (E-43)', h0: rise + 0.4, h1: end(10.5, 12.5), all: true, sheaves: false, late };
    if (agri.has('E-50') && (h + C.dom) % 3 === 0) return { kind: 'canal', act: 'dig_canal', place: `canal:${q}`, why: 'clearing the village canal (E-50)', h0: 8, h1: 15, all: false, sheaves: false, late };
    if (agri.has('E-45') && h % 5 < 2 && u(1) < 0.85) return { kind: 'vintage', act: 'pick_fruit', place: `vineyard:${q}`, why: 'the vintage: picking grapes (E-45)', h0: rise + 0.5, h1: end(11, 13), all: true, sheaves: false, late };
    if ((agri.has('E-40') || agri.has('E-44')) && !C.wx.wet && u(3) < 0.8) return { kind: 'plough', act: 'plough', place: field, why: agri.has('E-44') ? 'sowing the summer crops (E-44)' : 'ploughing and sowing barley and wheat (E-40)', h0: rise + 0.8, h1: Math.min(16, C.sun.set - 1.2), all: false, sheaves: false, late };
    if (agri.has('E-46') && h % 2 === 0 && u(2) < 0.7) return { kind: 'fruit', act: 'pick_fruit', place: `orchard:${q}`, why: 'picking figs and fruit (E-46)', h0: rise + 0.5, h1: end(10.5, 12), all: true, sheaves: false, late };
    if ((h + d) % 6 === 0 && [1, 2, 3, 4, 5, 6, 7].includes(C.month)) return { kind: 'turn', act: 'irrigate', place: `canal:${q}`, why: 'the household’s turn of water from the canal (CE-19)', h0: rise + 0.6, h1: rise + 3.6, all: false, sheaves: false, late };
    const frac = POPD.zones.find((z: any) => z.id === 'plain').field_fraction_adults_by_day[C.season];
    if (u(5) < frac) return { kind: 'field', act: 'field_work', place: field, why: 'hoeing, weeding and minding the crop', h0: rise + 1, h1: end(11.5, 14), all: false, sheaves: false, late };
    return null;
  }
  /** fosterage (C): when the last adult of a household dies, its children move to a kin household the next day */
  private foster() {
    for (const H of this.households) { if (H.zone !== 'town' && H.zone !== 'plain') continue;
      const adults = H.members.filter(x => this.persons[x].age >= 14 && this.persons[x].zone !== 'transient' && this.persons[x].job !== 'guard' && this.persons[x].marry >= 1e9);
      const kids = H.members.filter(x => this.persons[x].age < 14 && this.persons[x].marry >= 1e9 && this.persons[x].agent < 0); if (!kids.length) continue;
      const last = adults.length ? Math.max(...adults.map(x => this.persons[x].dies)) : -1; if (last >= REGNAL_DAYS - 1) continue;
      const to = [...H.kin, ...this.households.filter(o => o.q === H.q && o.zone === H.zone && o.id !== H.id).slice(0, 50).map(o => o.id)].find(k => this.households[k].members.some(x => this.persons[x].age >= 16 && this.persons[x].dies >= REGNAL_DAYS && this.persons[x].zone !== 'transient'));
      if (to === undefined) continue; const day = Math.max(0, last + 1);
      for (const c of kids) { const q = this.persons[c]; if (q.dies <= day) continue; q.hh2 = to; q.marry = day; q.moved = 'fostered'; this.households[to].joins.push(c); }
      if (!this.households[to].kin.includes(H.id)) { this.households[to].kin.push(H.id); H.kin.push(to); }
    }
  }
  /** a mother's children (generated with her, and born this year) */
  childrenOf(pid: number): number[] { return this.kidsOf.get(pid) ?? []; }
  /** the people living in a household on a day (those who married out have left; brides and grooms have joined) */
  membersOn(h: number, d: number): number[] { const H = this.households[h]; const out: number[] = [];
    for (const x of H.members) if (this.home(x, d) === h && this.present(x, d)) out.push(x); for (const x of H.joins) if (this.home(x, d) === h && this.present(x, d)) out.push(x); return out; }
  lifeOn(d: number) { return this.lifeByDay[d] ?? { births: [], deaths: [], marriages: [] }; }
  birthdaysOn(d: number) { return (this.bdayByDay[d] ?? []).filter(i => this.present(i, d)); }
  /** mothers whose N-text ration falls due today (E-04: 0–29 days after a birth in a ration group) */
  maternityDue(d: number) {
    const out: { mother: number; boy: boolean; group: number }[] = [];
    for (let x = Math.max(0, d - 29); x <= d; x++) for (const c of this.lifeByDay[x].births) { const C = this.persons[c]; const M = this.persons[C.mother]; if (M.group < 0) continue;
      if (x + Math.floor(u01(this.seed, S.birth, c, 9) * 30) === d) out.push({ mother: C.mother, boy: C.sex === 'm', group: M.group }); }
    return out;
  }

  groupDemandQa(g: number, d: number) { let s = 0; for (const pid of this.groups[g].members) if (this.present(pid, d)) s += this.persons[pid].qa; return s; }
  groupPresent(g: number, d: number) { return d >= this.groups[g].from; }
  groupSize(g: number, d: number) { let n = 0; for (const pid of this.groups[g].members) if (this.present(pid, d)) n++; return n; }

  // ================================================================== per-person state on a day (pure)
  present(pid: number, d: number) { const p = this.persons[pid]; return d >= p.arrive && d >= p.born && d <= p.dies && d <= p.leave; }
  private sickP: number[] = Array.from({ length: REGNAL_DAYS }, (_, d) => { const { month } = dateOf(d); const w = (L.sick_episodes_per_year.seasonal_weight as any)[month >= 3 && month <= 5 ? 'summer' : month >= 9 && month <= 11 ? 'winter' : month >= 6 && month <= 8 ? 'autumn' : 'spring']; return L.sick_episodes_per_year.v * w / 365; });
  private sickStart(pid: number, d: number) {
    if (d < 0) return 0;
    if (u01(this.seed, S.sick, pid, d) >= this.sickP[d % REGNAL_DAYS]) return 0;
    const [a, b] = L.sick_episodes_per_year.days; return a + Math.floor(u01(this.seed, S.sickd, pid, d) * (b - a + 1));
  }
  /** sick today (an episode of 1–7 days started within the last week) */
  sick(pid: number, d: number) { for (let s = d; s > d - 7; s--) { const n = this.sickStart(pid, s); if (n && s + n > d) return true; } return false; }
  /** which day (k of n) of the current illness this is */
  sickDayOf(pid: number, d: number) { for (let s = d; s > d - 7; s--) { const n = this.sickStart(pid, s); if (n && s + n > d) return { k: d - s, n }; } return { k: 0, n: 1 }; }
  sickOnsets(d: number) { let n = 0; for (let i = 0; i < this.persons.length; i++) if (this.sickStart(i, d) && this.present(i, d)) n++; return n; }
  home(pid: number, d: number) { const p = this.persons[pid]; return d >= p.marry && p.hh2 >= 0 ? p.hh2 : p.hh; }
  /** days since a death in the household (mourning 1–3 days, C) */
  mourning(pid: number, d: number) { const H = this.households[this.home(pid, d)]; for (const x of H.deaths) if (x < d && d - x <= 1 + Math.floor(u01(this.seed, S.mourn, H.id, x) * 3)) return d - x; return 0; }
  gaveBirth(pid: number, d: number) { const p = this.persons[pid]; if (p.sex !== 'f') return -1; const H = this.households[this.home(pid, d)]; for (const x of H.births) if (x <= d && d - x < 45) { for (const c of this.lifeByDay[x].births) if (this.persons[c].mother === pid) return d - x; } return -1; }
  postpartumDays(pid: number) { const [a, b] = L.postpartum_off_days.v; return a + Math.floor(u01(this.seed, S.birth, pid, 11) * (b - a + 1)); }
  /** the woman who stays home with a sick household member on the first day (C) */
  carerToday(pid: number, d: number) {
    const p = this.persons[pid]; if (p.sex !== 'f' || p.age < 14) return false; const H = this.households[this.home(pid, d)];
    if (H.members.some(x => x !== pid && this.persons[x].mother === pid && this.persons[x].age < 5 && this.present(x, d) && this.sickStart(x, d) > 0) && !this.sick(pid, d)) return true; // a mother stays with her sick small child
    const carer = H.members.find(x => this.persons[x].sex === 'f' && this.persons[x].age >= 14 && this.present(x, d) && !this.sick(x, d)); if (carer !== pid) return false;
    return H.members.some(x => x !== pid && this.present(x, d) && this.sickStart(x, d) > 0 && (this.persons[x].age < 10 || this.persons[x].job === 'elder'));
  }
  /** a builder works on the Terrace today (the same rule feeds the construction credit): E-62 winter halving, weather, life */
  builderAvailable(pid: number, d: number, C: DayCtx) {
    const p = this.persons[pid]; if (!this.present(pid, d) || this.sick(pid, d) || this.mourning(pid, d) || C.wx.storm) return false;
    if (C.winter && (p.squad + d) % 2 === 1) return false;
    if (C.wx.rainH > 5) return false; // rained off before work started (C)
    return true;
  }
  /** man-days of stonecutting, hauling and brickwork put in today */
  buildCredit(d: number, C: DayCtx) {
    const cr = { stone: 0, labour: 0, brick: 0 }; const w = this.workWindow(C); let hours = w[1] - w[0] - (C.heatRest ? 0 : 0.55);
    if (C.wx.rain) hours -= Math.max(0, Math.min(C.wx.rain[1], w[1]) - Math.max(C.wx.rain[0], w[0]));
    hours = Math.max(0, hours);
    for (const pid of this.builders) { if (!this.builderAvailable(pid, d, C)) continue; const p = this.persons[pid]; const f = hours / 9 * (this.cal.shortOf(p.group, d) > 0 ? 0.8 : 1); // CE-03: short rations slow the work
      if (p.sub === 'stone') cr.stone += f; else if (p.sub === 'brick') cr.brick += C.brick ? f * 0.5 : f; else cr.labour += f; }
    return cr;
  }
  /** the gangs' working day (E-60: dawn to mid-afternoon; E-64: in the heat, dawn to noon) */
  workWindow(C: DayCtx): [number, number] { return [C.sun.rise + L.work_day.start_after_sunrise_h, C.heatRest ? L.work_day.heat_end_h : L.work_day.end_h]; }
  /** relationships: a base by tie type plus dated changes that fade over ~a month (lives.json affinity) */
  private relKey(a: number, b: number) { return a < b ? a * 262144 + b : b * 262144 + a; }
  relate(a: number, b: number, d: number, dv: number) { const k = this.relKey(a, b); (this.rel.get(k) ?? this.rel.set(k, []).get(k)!).push([d, dv]);
    for (const [day, m] of this.planCache) if (day > d) { this.planCount -= m.size; this.planCache.delete(day); } } // later days' plans may change
  affinity(a: number, b: number, d: number) {
    const A = this.persons[a], B = this.persons[b], base = L.affinity.base;
    let v = A.hh === B.hh ? base.household : this.households[A.hh].kin.includes(B.hh) ? base.kin : A.group >= 0 && A.group === B.group ? base.work : this.households[A.hh].q === this.households[B.hh].q ? base.neighbour : 0;
    const ev = this.rel.get(this.relKey(a, b)); if (ev) for (const [x, dv] of ev) if (x < d) v += dv * Math.exp(-(d - x) / L.affinity.tau_days);
    return Math.max(-1, Math.min(1, v));
  }
  relationsSnapshot() { return [...this.rel.entries()]; }
  relationsRestore(s: [number, [number, number][]][]) { this.rel.clear(); for (const [k, v] of s) this.rel.set(k, v.slice()); this.planCache.clear(); this.planCount = 0; }
  /** E-74: disputes today in their real contexts; both parties' plans include them; the relationship sours */
  drawDisputes(d: number, C: DayCtx) {
    const base = 0.1; const lowRiver = [3, 4, 5, 6, 7].includes(C.month); // E-74: 100 small disputes per 1,000 a year (C)
    for (let i = 0; i < this.persons.length; i++) {
      const u = u01(this.seed, S.disp, i, d); if (u >= base * 4.5 / 365) continue; // test against the largest multiplier first (cheap)
      const p = this.persons[i]; if (p.age < 14 || C.disputes.has(i) || p.zone === 'transient') continue;
      let mult = 1; if (p.group >= 0 && this.cal.shortOf(p.group, d) > 0) mult *= 3; if (lowRiver && (p.job === 'farmer' || p.job === 'gardener')) mult *= 1.5;
      if (u >= base * mult / 365) continue;
      if (!this.present(i, d) || this.sick(i, d)) continue;
      let pool: number[] = [], place = '', t = 10.5, why = '';
      const issue = p.group >= 0 ? C.issue.get(p.group) : undefined;
      if (issue !== undefined) { pool = this.groups[p.group].members; place = this.groups[p.group].issuePlace; t = issue + 0.3; why = 'over a place in the ration queue'; }
      else if (p.job === 'builder' && this.builderAvailable(i, d, C)) { pool = this.gangs[p.gang]?.members ?? []; place = this.builderPlace(i, d, C); why = 'over a borrowed tool on the building site'; }
      else if ((p.job === 'farmer' || p.job === 'gardener') && lowRiver) { const q = this.households[p.hh].q; pool = this.quarters[q]?.farmers ?? []; place = `canal:${q}`; t = 7; why = 'over a turn of water at the canal'; }
      else if (p.sex === 'f' && (this.households[p.hh].zone === 'town' || this.households[p.hh].zone === 'plain')) { const q = this.households[p.hh].q; pool = this.quarters[q]?.women ?? []; place = `well:${q}`; t = 7.5; why = 'at the well'; }
      if (!pool.length) continue;
      const o = pool[Math.floor(u01(this.seed, S.dispo, i, d) * pool.length)];
      if (o === i || C.disputes.has(o) || !this.present(o, d) || this.sick(o, d) || this.persons[o].age < 14) continue;
      if (p.job === 'builder' && !this.builderAvailable(o, d, C)) continue;
      C.disputes.set(i, { t, other: o, place, why }); C.disputes.set(o, { t, other: i, place, why });
      this.relate(i, o, d, L.affinity.dispute);
    }
  }
  shearingToday(d: number) { let n = 0; for (const q of Object.values(this.quarters)) if (q.kind === 'village') { const day = this.shearDay(q.id); if (day === d) n++; } return n; }
  private shearDay(q: string) { const M = [12, 1, 2]; const m = M[Math.floor(u01(this.seed, S.shear, salt(q)) * 3)]; const start = [0, 29, 59, 89, 118, 148, 177, 207, 236, 266, 295, 325][m - 1]; return start + 3 + Math.floor(u01(this.seed, S.shear, salt(q), 1) * 24); }
  nameOf(pid: number): string | null { return nameFor(this.seed, this.persons[pid]); }

  // ================================================================== guard rota (lives.json guard_rota; D-023)
  /** 0 = watch A (6–14), 1 = B (14–22), 2 = C (22–6), 3 = off after the night watch, 4 = off */
  phase(pid: number, d: number) { const p = this.persons[pid]; return ((d + (p.file % 5)) % 5 + 5) % 5; }
  rota(d: number) {
    let r = this.rotaCache.get(d); if (r) return r; r = new Map();
    if (this.rotaCache.size > 8) this.rotaCache.delete(this.rotaCache.keys().next().value!);
    if (d < 0) { this.rotaCache.set(d, r); return r; }
    for (let w = 0 as 0 | 1 | 2; w < 3; w = (w + 1) as 0 | 1 | 2) {
      const files = this.garrison.filter(pid => this.phase(pid, d) === w && this.persons[pid].rank === 0);
      const cycle = Math.floor((d + (this.persons[files[0]]?.file ?? 0) % 5) / 5);
      const men = files.map((pid, i) => ({ pid, k: (i + 3 * cycle) % files.length })).sort((a, b) => a.k - b.k).filter(x => this.present(x.pid, d) && !this.sick(x.pid, d)).map(x => x.pid);
      // a sick man's post is covered by the patrol; beyond that a man is called from an off file: for A and B the fully
      // rested file (phase 4), for the night watch the file that came off it this morning (phase 3), never twice (C)
      const reserve = this.garrison.filter(pid => this.phase(pid, d) === (w === 2 ? 3 : 4) && this.persons[pid].rank === 0 && this.present(pid, d) && !this.sick(pid, d) && !r!.has(pid));
      let ri = Math.floor(u01(this.seed, S.dbl, d, w) * Math.max(1, reserve.length));
      GUARD_POSTS.forEach((post, i) => { let pid = men[i]; let called = false; if (pid === undefined && reserve.length) { for (let k = 0; k < reserve.length && (pid === undefined || r!.has(pid)); k++) pid = reserve[ri++ % reserve.length]; called = true; } if (pid !== undefined && !r!.has(pid)) r!.set(pid, { watch: w, post, called }); });
      for (const pid of men.slice(GUARD_POSTS.length)) r.set(pid, { watch: w, post: null, called: false });
      for (const pid of this.garrison) if (this.persons[pid].rank === 1 && this.phase(pid, d) === w && this.present(pid, d) && !this.sick(pid, d)) r.set(pid, { watch: w, post: null, called: false });
    }
    this.rotaCache.set(d, r); return r;
  }
  /** off-duty guards called to double the Treasury door (E-81) in a window */
  doublers(d: number, k: number, t: number) { const ph = t >= 13 ? 3 : 4; const pool = this.garrison.filter(pid => this.phase(pid, d) === ph && this.persons[pid].rank === 0 && this.present(pid, d) && !this.sick(pid, d));
    const n = 2 + Math.floor(u01(this.seed, S.dbl, d, k, 7) * 3); const out: number[] = []; for (let j = 0; j < n && pool.length; j++) out.push(pool[Math.floor(u01(this.seed, S.dbl, d, k, j) * pool.length)]); return out; }

  // ================================================================== day plans
  /** where a builder works today: stonecutters get a task for the week from what the building needs (D-022) */
  builderPlace(pid: number, d: number, C: DayCtx) {
    const p = this.persons[pid]; if (p.sub === 'labour') return 'hall100_site';
    if (p.sub === 'brick') return C.brick && (p.squad + d) % 2 === 0 ? 'brickyard' : C.winter && (C.wx.frost || C.wx.wet) ? 'hall100_site' : `h100_wall_${'NESW'[p.squad % 4]}`;
    const T0 = C.build; const wk = Math.floor(d / 7);
    const opts: [string, number][] = []; if (T0.flute !== null) opts.push([colPlace(T0.flute), 0.4]); if (T0.dress) opts.push(['worksite', 0.3]); if (T0.capital) opts.push(['worksite_capital', 0.2]); opts.push([`h100_door_${T0.relief}`, 0.15]);
    if (p.rank === 1 && p.squad === 0) return opts[0][0];
    const tot = opts.reduce((s, o) => s + o[1], 0); let u = u01(this.seed, S.assign, pid, wk) * tot; for (const [pl, w] of opts) { u -= w; if (u <= 0) return pl; } return opts[0][0];
  }
  private pos(place: string, d: number): [number, number] {
    if (place.startsWith('h:')) return this.households[+place.slice(2)].xy;
    const k = place.indexOf(':'); if (k > 0) { const tail = place.slice(k + 1); if (place.startsWith('field:') || place.startsWith('estate:')) { const H = this.households[parseInt(tail, 10)]; const plot = +(tail.split(':')[1] ?? 0); return [H.xy[0] + 300 - plot * 150, H.xy[1] + 200 + plot * 120]; }
      if (this.quarters[tail]) return this.quarters[tail].xy; if (place.startsWith('ws:')) return [T.treasury_workshops.around[0] + (+tail - 1.5) * 150, T.treasury_workshops.around[1]]; }
    if (this.facilities[place]) return this.facilities[place]; if (place === 'ws_textile') return [-700, -1000];
    void d; return TERRACE_XY;
  }
  /** walking minutes between two abstract places (C: 1.2 m/s, +10 min to climb to the Terrace) */
  walkH(a: string, b: string, d: number, wa: Where, wb: Where) {
    if (a === b) return 0; const A = this.pos(a, d), B = this.pos(b, d); let m = Math.hypot(A[0] - B[0], A[1] - B[1]) / L.walk_ms.v / 60;
    if ((wa === 'terrace') !== (wb === 'terrace')) m += 10; return Math.min(5, Math.max(0.05, m / 60));
  }
  /** a person's day plan (pure; cached, since a child's plan reads its mother's, a toddler's its minders'). Treat the
   *  returned segments as read-only */
  plan(pid: number, day: number): Seg[] { const c = this.planCache.get(day)?.get(pid); if (c) return c;
    if (this.planCount >= 20000) { this.planCache.clear(); this.planCount = 0; }
    const v = new Planner(this, pid, day).build(); let m = this.planCache.get(day); if (!m) { m = new Map(); this.planCache.set(day, m); } m.set(pid, v); this.planCount++; return v; }
}

// ------------------------------------------------------------------ names (attested only, matched to origin; brief §9.1)
const NAME_POOLS = (() => { const m = new Map<string, string[]>(); for (const n of (namesData as any).names) { if (n.notable || n.reading_uncertain) continue; const k = `${n.sex}:${n.origin_guess}`; (m.get(k) ?? m.set(k, []).get(k)!).push(n.name); } return m; })();
const ORIGIN_POOL: Record<string, string> = { Persian: 'Iranian', Median: 'Iranian', Elamite: 'Elamite', Babylonian: 'Babylonian', Syrian: 'West Semitic', Egyptian: 'Egyptian', Indian: 'Indian' };
/** an attested name for an unnamed person of the population, or null when their origin has no attested names in the pool.
 *  Names recur across the population as they do in the tablets (tier: A name form / C assignment) */
export function nameFor(seed: number, p: Person): string | null {
  if (p.nm !== undefined) return p.nm;
  const pool = NAME_POOLS.get(`${p.sex}:${ORIGIN_POOL[p.origin] ?? '-'}`); if (!pool?.length) return null; return pool[Math.floor(u01(seed, S.name, p.id) * pool.length)];
}

// ------------------------------------------------------------------ the planner: one person, one day
class Planner {
  readonly p: Person; readonly C: DayCtx; readonly r: HStream; readonly segs: Seg[] = []; t = 0;
  readonly home: string; readonly homeW: Where; readonly hh: Household;
  constructor(readonly P: Population, readonly pid: number, readonly d: number) {
    this.p = P.persons[pid]; this.C = P.cal.ctx(d); this.r = new HStream(P.seed, S.plan, pid, d);
    this.hh = P.households[P.home(pid, d)];
    this.home = this.p.job === 'guard' ? 'garrison_sleep' : this.hh.home; this.homeW = this.p.job === 'guard' ? 'terrace' : this.hh.zone === 'plain' ? 'plain' : 'town';
  }
  private add(t1: number, place: string, act: ActivityId, why: string, where: Where, split = false) {
    t1 = Math.min(24, t1); const last = this.segs[this.segs.length - 1];
    if (t1 > 24 - 1e-3) t1 = 24;
    if (t1 <= this.t + 1e-4) { if (t1 === 24 && last && this.t < 24) { last.t1 = 24; this.t = 24; } return; }
    if (!split && last && last.place === place && last.act === act && last.where === where && last.why === why) { last.t1 = t1; } else this.segs.push({ t0: this.t, t1, place, act, why, where });
    this.t = t1; if (where !== 'road') { this.cur = place; this.curW = where; }
  }
  /** where the person is now (a road segment ends at its destination) */
  private cur: string | null = null; private curW: Where | null = null;
  private atHome(t1: number, act: ActivityId, why: string) { this.add(t1, this.home, act, why, this.homeW); }
  /** hours at home between tasks (C). Men: rest, mending tools and baskets, the household's animals (plain), talk with
   *  the household. Women: rest, the quern, spinning, talk. Both: a sleep in the heat of the day */
  private homeHours(until: number, why = 'resting at home') {
    const r = this.r, plain = this.hh.zone === 'plain', f = this.p.sex === 'f', H = L.home_hours, [s0, s1] = H.spell_h;
    if (f && this.adult() && /^(at home|resting at home)$/.test(why) && this.P.membersOn(this.hh.id, this.d).some(x => x !== this.pid && this.P.persons[x].age < 7)) why = `${why}, minding the children`;
    while (this.t < until - 0.3) {
      const hot = this.C.heatRest && this.t >= 11.5 && this.t < 15.5 ? H.sleep_in_heat : 0;
      const out = f && this.adult() && this.homeW !== 'terrace' && !this.C.wx.wet && !this.C.wx.dust && !hot && this.t > 7 && this.t < this.sun.set - 1.5 && until - this.t > 1 && (this.cur ?? this.home) === this.home;
      const k = this.choose(f ? { rest: H.women.rest, grind: H.women.grind, weave: H.women.weave, craft: 0, animals: 0, talk: H.women.talk, sleep: hot, lane: out ? H.women.lane * (this.P.membersOn(this.hh.id, this.d).some(x => this.P.persons[x].age < 5 && this.P.persons[x].mother === this.pid) ? 2 : 1) : 0 } : { rest: H.men.rest, grind: 0, weave: 0, craft: H.men.craft, animals: plain ? H.men.animals_plain : 0, talk: H.men.talk, sleep: hot, lane: 0 });
      const t1 = Math.min(until, this.t + r.range(s0, s1));
      if (k === 'lane') { const l = `lane:${this.hh.q}`, W = this.homeW; this.go(l, W); const sp = r.chance(0.5); this.add(Math.max(this.t + 0.3, t1 - this.P.walkH(l, this.home, this.d, W, W)), l, sp ? 'spin' : 'talk', sp ? 'spinning with the women outside the door' : 'talking with the women outside the door', W); this.go(this.home, W); continue; }
      if (k === 'craft') this.atHome(t1, 'craft', 'mending tools and baskets'); else if (k === 'animals') this.atHome(t1, 'tend_animals', 'seeing to the household’s animals');
      else if (k === 'grind') this.atHome(t1, 'grind', 'grinding the household’s flour'); else if (k === 'weave') this.atHome(t1, 'spin', 'spinning');
      else if (k === 'talk') this.atHome(t1, 'talk', 'with the household'); else if (k === 'sleep') this.atHome(t1, 'sleep', 'sleeping through the heat of the day'); else this.atHome(t1, 'rest', why);
    }
    if (this.t < until) this.atHome(until, 'rest', why);
  }
  /** walk from the current place to `to`; returns the arrival time */
  private go(to: string, whereTo: Where, why = 'walking', act: ActivityId = 'walk') {
    const from = this.cur ?? this.home, wf = this.curW ?? this.homeW;
    if (from === to) return this.t; const h = this.P.walkH(from, to, this.d, wf, whereTo); this.add(this.t + h, `road:${whereTo === 'terrace' || wf === 'terrace' ? 'terrace' : whereTo}`, act, why, 'road');
    this.cur = to; this.curW = whereTo; return this.t;
  }
  private get sun() { return this.C.sun; }
  private rise() { const [a, b] = L.rise_before_sunrise_h.v; return this.sun.rise - lerp(a, b, this.p.trait); }
  private bed() { const [a, b] = L.bed_after_sunset_h.v; return this.sun.set + lerp(a, b, 1 - this.p.trait); }
  private rainIn(t0: number, t1: number) { const w = this.C.wx.rain; return w ? Math.max(0, Math.min(w[1], t1) - Math.max(w[0], t0)) : 0; }
  private adult() { return this.p.age >= 14; }

  build(): Seg[] {
    const segs = this.build0(); const P = this.P;
    if (!P.present(this.pid, this.d) || this.p.job === 'traveller' || this.p.job === 'herder') return segs;
    if (this.p.sex === 'f' && this.p.age >= 14) this.nurse(segs);
    if (this.p.age >= 2) this.meals(segs);
    return segs;
  }
  /** replace [t, t+len] of the plan with (act, why) at the place the person is then; a moment on the road moves to the
   *  arrival; returns the start used, or -1 */
  private insertAt(segs: Seg[], t: number, len: number, act: ActivityId, why: string, keep?: (s: Seg) => boolean): number {
    let i = segs.findIndex(s => t < s.t1); if (i < 0) return -1;
    while (i < segs.length && (segs[i].where === 'road' || (segs[i].t1 - t < 0.12 && i + 1 < segs.length && segs[i + 1].act !== 'eat'))) { t = segs[i].t1; i++; } // never into a meal if (i >= segs.length) return -1;
    const s = segs[i]; if (keep && keep(s)) return -1; if (s.t1 - t < len) t = Math.max(s.t0, s.t1 - len); if (t - s.t0 < 0.05) t = s.t0; // no slivers
    let t1 = Math.min(24, t + len); if (s.t1 - t1 < 0.05) t1 = s.t1; if (Math.min(t1, s.t1) - t < 0.05) return -1;
    const parts: Seg[] = [];
    if (t > s.t0 + 1e-6) parts.push({ ...s, t1: t });
    parts.push({ ...s, t0: Math.max(t, s.t0), t1: Math.min(t1, s.t1), act, why });
    if (t1 < s.t1 - 1e-6) parts.push({ ...s, t0: t1 });
    segs.splice(i, 1, ...parts); return t;
  }
  /** a mother nurses her infant on demand, by day and by night, wherever she is (lives.json infant_care; KONNER1980 as an
   *  analogy): a feed every 1.6-2.8 h while she is awake and two or three in the night; a child of one a few times a day */
  private nurse(segs: Seg[]) {
    const P = this.P, d = this.d, IC = L.infant_care;
    const kids = P.childrenOf(this.pid).filter(c => { const q = P.persons[c]; return q.age <= 1 && P.present(c, d) && d >= q.born && P.home(c, d) === P.home(this.pid, d); });
    if (!kids.length) return;
    const birthT = kids.some(c => P.persons[c].born === d) ? (segs.find(s => /food after the birth/.test(s.why))?.t1 ?? 24) : -1;
    const infant = kids.some(c => P.persons[c].age === 0); const r = new HStream(P.seed, S.nurse, this.pid, d);
    const wakeSeg = segs.find(s => s.t0 > 2 && s.act !== 'sleep'); const wake = wakeSeg?.t0 ?? 6; const bedSeg = [...segs].reverse().find(s => s.act !== 'sleep' && s.t1 < 24); const bed = bedSeg?.t1 ?? 21;
    const times: [number, boolean][] = [];
    const nightN = infant ? r.int(IC.night_feeds[0], IC.night_feeds[1]) : r.int(IC.toddler_night_feeds[0], IC.toddler_night_feeds[1]);
    if (birthT >= 0) { for (let t = birthT + 0.2; t < 24; t += lerp(IC.day_feed_every_h[0], IC.day_feed_every_h[1], r.next())) times.push([t, false]); }
    else { for (let k = 0; k < nightN; k++) { const t = k % 2 === 0 ? lerp(0.8, Math.max(1, wake - 1.2), (k + r.next()) / Math.max(1, nightN)) : Math.min(23.6, bed + 1.2 + r.range(0, 1.5)); times.push([t, true]); }
      if (infant) for (let t = wake + r.range(0.1, 0.6); t < bed - 0.3; t += lerp(IC.day_feed_every_h[0], IC.day_feed_every_h[1], r.next())) times.push([t, false]);
      else { const n = r.int(IC.toddler_day_feeds[0], IC.toddler_day_feeds[1]); for (let k = 0; k < n; k++) times.push([lerp(wake + 0.3, bed - 0.5, (k + r.next()) / n), false]); } }
    times.sort((a, b) => a[0] - b[0]);
    const what = kids.length > 1 ? 'nursing the twins' : 'nursing the baby';
    for (let [t, night] of times) { const len = lerp(IC.feed_h[0], IC.feed_h[1], r.next());
      let s = segAt(segs, t); if (s.act === 'eat') { t = s.t1 + 0.02; s = segAt(segs, t); if (s.act === 'eat' || t >= 24) continue; } // after her meal
      if (s.act === 'lie_ill') { this.insertAt(segs, t, len, 'lie_ill', /birth|newborn|labour/.test(s.why) ? `resting after the birth, ${what}` : `lying ill, ${what}`); continue; }
      if (night || (s.act === 'sleep' && (t < wake || t > bed))) { this.insertAt(segs, t, len, 'rest', `${what} in the night`); continue; }
      if (s.act === 'sleep') { this.insertAt(segs, t, len, 'rest', what); continue; } // woken from a daytime sleep
      const work = !['talk', 'rest', 'queue', 'gamble', 'exchange', 'play'].includes(s.act);
      this.insertAt(segs, t, len, 'rest', work ? `stopping to ${what.replace('nursing', 'nurse')}` : what); }
  }
  /** a safety net under the day's meals (lives.json meals): no one awake goes more than ~6.5 h without food; a gap is
   *  filled with bread and water where the person is then (not on watch, not on the road) */
  private meals(segs: Seg[]) {
    let ill = 0; for (const s of segs) if (s.act === 'lie_ill') ill += s.t1 - s.t0; if (ill >= 6) return; // a sick day has its own little food
    const awake = segs.filter(s => s.act !== 'sleep' && s.act !== 'offmap' && s.act !== 'lie_ill' && !/ in the night/.test(s.why)); if (!awake.length) return;
    const wake = awake[0].t0, bed = awake[awake.length - 1].t1; if (bed - wake < 4) return;
    for (let k = 0; k < 4; k++) {
      const eats = segs.filter(s => s.act === 'eat' || /nursed/.test(s.why)).map(s => [s.t0, s.t1] as [number, number]);
      let gap = 0, at = -1;
      // gaps between consecutive meals (and from waking to the first, from the last to bed)
      const pts: [number, number][] = [[wake - 1.5, wake - 1.5], ...eats, [bed + 1, bed + 1]];
      for (let i = 0; i + 1 < pts.length; i++) { const a = Math.max(wake, pts[i][1]), b = Math.min(bed, pts[i + 1][0]); const lim = i === 0 ? 3.5 : i + 2 === pts.length ? 5 : 7; if (b - a > lim && b - a - lim > gap) { gap = b - a - lim; at = i === 0 ? a + 2 : i + 2 === pts.length ? a + 4 : (a + b) / 2; } }
      if (at < 0) return;
      let tt = at; { let i = segs.findIndex(s => tt < s.t1); while (i >= 0 && i < segs.length && segs[i].where === 'road') { tt = segs[i].t1; i++; } if (i >= 0 && i < segs.length && segs[i].act === 'sleep' && segs[i].t0 > wake) tt = segs[i].t0; }
      const t = this.insertAt(segs, tt, 0.35, 'eat', 'bread and water', s => s.act === 'stand_guard' || s.act === 'patrol' || (s.act === 'sleep' && tt > s.t0 + 1e-6));
      if (t < 0) return;
    }
  }
  private build0(): Seg[] {
    const P = this.P, p = this.p, d = this.d;
    if (!P.present(this.pid, d)) return [{ t0: 0, t1: 24, place: '-', act: 'offmap', why: 'not here', where: 'away' }];
    if (p.job === 'traveller') return this.traveller();
    if (p.job === 'herder') return this.herderPassing();
    const sick = P.sick(this.pid, d);
    if (sick) return p.job === 'child' && p.age < 5 ? this.small() : this.sickDay();
    const born = P.gaveBirth(this.pid, d);
    if (born === 0) return this.birthDay();
    if (born > 0 && born <= P.postpartumDays(this.pid)) return this.postpartum();
    if (p.job === 'child' && p.age < 5) return this.small();
    if (p.job === 'guard') return this.guard();
    if (P.mourning(this.pid, d)) return this.mourningDay();
    if (P.carerToday(this.pid, d)) return this.homeDay('tending the sick at home', true);
    if (d === p.marry && p.moved !== 'fostered') return this.marriageDay();
    if (this.drafted()) return this.draftDay();
    switch (p.job) {
      case 'builder': return P.builderAvailable(this.pid, d, this.C) ? this.builder() : this.homeDay(this.C.winter ? 'the gang works in halves in winter' : 'no work on the building site today');
      case 'camp': return this.campWoman();
      case 'porter': return p.sub === 'terrace' ? (p.agent >= 0 ? this.terraceWorker('stair_foot', 'rest', 'waiting at the depot for loads') : this.terracePorter()) : this.townPorter();
      case 'scribe': return this.scribe();
      case 'treasury': return this.treasuryWorker();
      case 'official': return this.official();
      case 'messenger': return this.messenger();
      case 'storekeeper': return this.storekeeper();
      case 'miller': return this.miller();
      case 'weaver': return this.weaver();
      case 'brewer': return this.C.brewing.length || (d + p.id) % 3 === 0 ? this.dayWork('brewery', 'town', 'brew', this.C.brewing.length ? 'brewing beer from tarmu' : 'tending the vats', 7, this.C.brewing.length ? 17 : 12) : this.homeDay('no brewing today');
      case 'groom': return this.groom();
      case 'shepherd': return this.shepherd();
      case 'priest': return this.priest();
      case 'caretaker': return this.caretaker();
      case 'gardener': return this.gardener();
      case 'farmer': return this.farmer();
      case 'craftsman': return this.craftsman();
      case 'servant': return this.servant();
      case 'steward': return this.steward();
      case 'elder': return this.elder();
      case 'child': return this.child();
      default: return this.homemaker();
    }
  }
  // ---------------------------------------------------------------- shared pieces
  private finish(): Seg[] { if (this.t < 24) this.atHome(24, 'sleep', 'asleep'); return this.segs; }
  /** the household's day (shared meal times, bread, grinding, the plain household's field task) */
  private get hd(): HDay { return this._hd ??= this.P.hday(this.hh.id, this.d); }
  private _hd: HDay | null = null;
  /** the household's bread is baked today by this woman already */
  private baked = false;
  /** the afternoon share of the household's grinding is done */
  private groundPM = false;
  /** early morning at home (lives.json meals, household_bread): the women grind their share of the household's flour, one
   *  of them bakes on a baking day, water is fetched; everyone eats: with the household at its breakfast, or, leaving
   *  before it, bread and water before going. Whoever leaves early rises early enough to eat (C) */
  private morning(until: number, stay = false) {
    const p = this.p, H = this.hd, hb = L.household_bread, ML = L.meals;
    const woman = p.sex === 'f' && this.adult() && this.homeW !== 'terrace' && H.women.includes(this.pid);
    if (stay) until = Math.max(until, H.breakfast + H.bLen);
    const withHouse = until >= H.breakfast + H.bLen - 0.02;
    const grind = woman ? H.grindEach * hb.grind_morning_share : 0; const bakes = woman && H.bake && H.baker === this.pid && withHouse; if (bakes) this.baked = true;
    const early = lerp(ML.early_bread_h[0], ML.early_bread_h[1], this.r.next());
    const need = 0.05 + (withHouse ? 0 : early) + (woman ? Math.min(grind, 1.6) + (bakes ? lerp(hb.bake_h[0], hb.bake_h[1], 0.5) + 0.4 : 0) + 0.3 : 0);
    this.atHome(Math.min(this.rise(), Math.max(this.sun.rise - 1.6, (withHouse ? H.breakfast : until) - need)), 'sleep', 'asleep');
    if (woman) {
      const tEnd = withHouse ? H.breakfast : until - early;
      if (tEnd - this.t > 0.25) this.atHome(Math.min(tEnd, this.t + grind), 'grind', 'grinding the household’s flour at the quern');
      if (bakes && tEnd - this.t > 0.7) { this.atHome(this.t + 0.4, 'knead', 'kneading the dough'); this.atHome(Math.min(tEnd, this.t + lerp(hb.bake_h[0], hb.bake_h[1], this.r.next())), 'bake', 'baking the flat bread'); }
      if (tEnd - this.t > 0.6 && this.hh.zone !== 'terrace' && !this.C.wx.wet) this.well(this.t + 0.25, 'fetching water');
    }
    if (withHouse) { if (this.t < H.breakfast) { if (p.sex === 'm' && this.adult() && this.homeW !== 'terrace' && H.breakfast - this.t > 0.6) this.homeHours(H.breakfast, 'at home'); else this.atHome(H.breakfast, p.age < 14 ? 'play' : 'rest', 'at home'); } this.atHome(this.t + H.bLen, 'eat', H.bake ? 'breakfast with the household: the new bread' : 'breakfast with the household'); }
    else { if (this.t < until - early) this.atHome(until - early, p.age < 14 ? 'play' : 'rest', 'at home'); this.atHome(this.t + early, 'eat', 'bread and water before leaving (the household eats later)'); }
    if (until > this.t) { if (this.adult() && this.homeW !== 'terrace' && until - this.t > 0.5) this.homeHours(until, 'at home'); else this.atHome(until, p.age < 14 ? 'play' : 'rest', 'at home'); }
  }
  private well(t1: number, why: string) { const q = this.hh.q; const w = `well:${q}`; this.go(w, this.homeW); this.dispute(w); this.add(Math.max(this.t + 0.2, t1), w, 'draw_water', why, this.homeW); this.add(this.t + this.P.walkH(w, this.home, this.d, this.homeW, this.homeW), `road:${this.homeW}`, 'carry_jar_head', 'carrying water home', 'road'); this.cur = this.home; this.curW = this.homeW; }
  /** a dispute (E-74) drawn for today happens when the person reaches its place (raised voices, then back to it) */
  private quarrelled = false;
  private dispute(place: string, where: Where = this.curW ?? this.homeW) {
    const x = this.C.disputes.get(this.pid); if (!x || this.quarrelled || x.place !== place) return; this.quarrelled = true;
    this.add(this.t + 0.3, place, 'talk', `a dispute ${x.why} with ${nameFor(this.P.seed, this.P.persons[x.other]) ?? 'another'}`, where === 'road' ? this.homeW : where);
  }
  /** the ration queue on the group's issue day; the grain is carried home (E-01; CE-01) */
  private rationRun(): number | null {
    const g = this.p.group; if (g < 0) return null; const h = this.C.issue.get(g) ?? this.C.special.get(g); if (h === undefined || this.p.age < 8) return null;
    const G = this.P.groups[g]; const wq = G.zone === 'terrace' ? 'terrace' : 'town';
    this.go(G.issuePlace, wq, 'going to the issue');
    this.add(Math.max(this.t + 0.1, h), G.issuePlace, 'queue', 'waiting for the ration issue', wq);
    this.dispute(G.issuePlace);
    this.add(this.t + 0.3 + 1.5 * this.r.next(), G.issuePlace, 'queue', `in the queue for ${this.C.issue.has(g) ? 'the monthly ration' : 'a special ration'}`, wq);
    return h;
  }
  /** the midday meal at home with those of the household who are there (lives.json meals) */
  private noonAtHome(why = 'the midday meal with the household') { const H = this.hd; if (this.t < H.noon - 0.05) this.atHome(H.noon, this.p.age < 14 ? 'play' : 'rest', 'at home'); this.atHome(this.t + H.nLen, 'eat', why); }
  /** evening at home and out: the household's supper together (lives.json meals), then the household's real options
   *  (lives.json evening) */
  private evening(from: number) {
    const p = this.p, r = this.r, C = this.C, E = L.evening, H = this.hd; const bed = Math.max(from + 0.5, this.bed());
    if ((this.cur ?? this.home) === this.home && this.t <= H.supper) from = Math.min(from, H.supper); // at home: the household's supper
    const gPM = p.sex === 'f' && this.adult() && this.homeW !== 'terrace' && H.women.includes(this.pid) && !this.groundPM ? H.grindEach * (1 - L.household_bread.grind_morning_share) : 0;
    if (gPM > 0.2 && (this.cur ?? this.home) === this.home && H.supper - this.t > 0.5) { this.groundPM = true; const g0 = Math.max(this.t, Math.min(from, H.supper) - gPM - 0.4); if (g0 > this.t + 0.3) this.homeHours(g0, 'at home'); this.atHome(Math.min(H.supper - 0.1, this.t + gPM), 'grind', 'grinding for tomorrow’s bread'); }
    if (this.t < from) { if ((this.adult() || p.age >= 12) && this.homeW !== 'terrace') this.homeHours(from, 'at home'); else if (p.age >= 5 && !C.wx.wet && from - this.t > 1) { this.go(`lane:${this.hh.q}`, this.homeW); this.add(from - 0.1, `lane:${this.hh.q}`, 'play', 'playing in the lane', this.homeW); this.go(this.home, this.homeW); } else this.atHome(from, p.age < 14 ? 'play' : 'rest', 'at home'); }
    let bakeAfter = false;
    if (H.bake && H.baker === this.pid && !this.baked && this.homeW !== 'terrace') { this.baked = true;
      if (this.t < H.supper - 0.8) { const b0 = Math.max(this.t, H.supper - 1.2); if (b0 > this.t) this.homeHours(b0, 'at home'); this.atHome(this.t + 0.35, 'knead', 'kneading the dough'); this.atHome(Math.max(this.t + 0.3, Math.min(H.supper, this.t + 0.5)), 'bake', 'baking the flat bread for tomorrow'); }
      else bakeAfter = true; }
    // home before the evening meal: the household's late afternoon
    const supper = Math.max(this.t, H.supper);
    if (supper - this.t > 1 && this.homeW !== 'terrace') {
      if (p.age < 14) { if (C.wx.wet || C.wx.dust) this.atHome(supper, 'play', 'playing indoors'); else { this.go(`lane:${this.hh.q}`, this.homeW); this.add(supper - 0.1, `lane:${this.hh.q}`, 'play', 'playing in the lane', this.homeW); this.go(this.home, this.homeW); } }
      else if (p.sex === 'f' && H.women.includes(this.pid)) { const g = this.groundPM ? 0 : H.grindEach * (1 - L.household_bread.grind_morning_share); this.groundPM = true; if (g > 0.2) this.atHome(this.t + Math.min(supper - this.t, g), 'grind', 'grinding for tomorrow’s bread'); if (supper - this.t > 0.8 && r.chance(0.5) && !C.wx.wet) this.well(this.t + 0.3, 'fetching water'); if (this.t < supper) this.homeHours(supper, 'at home'); }
      else if (r.chance(0.4) && !C.wx.wet) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); const g = r.chance(0.5); this.add(Math.max(this.t, supper - 0.2), l, g ? 'gamble' : 'talk', g ? 'knucklebones in the lane' : 'talking in the lane', this.homeW); this.go(this.home, this.homeW); }
      else this.homeHours(supper, 'resting at home after work');
    }
    const bd = H.birthday >= 0 ? (H.birthday === this.pid ? 'his birthday meal: the day every man values most (HDT 1.133)' : `a birthday meal for ${nameFor(this.P.seed, this.P.persons[H.birthday]) ?? 'a man of the house'} (HDT 1.133)`) : null;
    if (this.t <= H.supper + 0.05) { if (this.t < H.supper) this.atHome(H.supper, p.age < 14 ? 'play' : 'rest', 'at home'); this.atHome(this.t + H.sLen, 'eat', bd ?? 'the evening meal with the household'); }
    else this.atHome(this.t + Math.max(0.3, H.sLen * 0.7), 'eat', bd ?? 'the evening meal, kept for the late-comer');
    if (bakeAfter) { this.atHome(this.t + 0.35, 'knead', 'kneading the dough'); this.atHome(this.t + 0.45, 'bake', 'baking the flat bread for tomorrow by the evening fire'); }
    if (this.t >= bed - 0.3) return;
    const rain = this.rainIn(this.t, bed) > 0.3;
    const kinEvent = this.kinVisit();
    if (kinEvent) { this.go(kinEvent.place, kinEvent.where, 'visiting'); this.add(Math.min(bed - 0.3, this.t + kinEvent.h), kinEvent.place, kinEvent.act, kinEvent.why, kinEvent.where); this.go(this.home, this.homeW, 'going home'); }
    else if (!rain) {
      const u = r.next();
      if (p.age < 14) { if (u < E.play_children && p.age >= 5) this.add(Math.min(bed - 0.2, this.t + r.range(0.6, 1.6)), `lane:${this.hh.q}`, 'play', 'playing in the lane', this.homeW); }
      else if (p.sex === 'f' && p.age < 60 && u < E.well_women * 0.5 && this.homeW !== 'terrace') this.well(this.t + 0.3, 'evening water');
      else if (u < E.visit) { const v = this.visitTarget(); if (v) { this.go(v.place, v.where, 'visiting'); this.add(Math.min(bed - 0.3, this.t + r.range(0.8, 2)), v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, this.homeW, 'going home'); } }
      else if (u < E.visit + E.exchange && !C.short.get(p.group)) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(Math.min(bed - 0.3, this.t + r.range(0.4, 1)), l, 'exchange', 'exchanging goods in kind with neighbours', this.homeW); this.go(this.home, this.homeW); }
      else if (p.sex === 'm' && u < E.visit + E.exchange + E.gamble_men) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(Math.min(bed - 0.3, this.t + r.range(0.6, 1.5)), l, 'gamble', 'knucklebones with neighbours', this.homeW); this.go(this.home, this.homeW); }
    }
    if (this.t < bed) this.atHome(bed, p.age >= 60 || p.age < 14 ? 'rest' : r.chance(0.5) ? 'talk' : 'rest', 'with the household');
  }
  /** kin events worth a visit: a birth in a kin household (last 3 days), a death (mourning visit), a kin birthday meal */
  private kinVisit(): { place: string; where: Where; act: ActivityId; why: string; h: number } | null {
    const P = this.P, d = this.d, r = this.r; if (this.p.age < 14) return null;
    for (const k of this.hh.kin) { const H = P.households[k]; const wh: Where = H.zone === 'plain' ? 'plain' : 'town';
      if (P.walkH(this.home, H.home, d, this.homeW, wh) > 1) continue;
      if (H.deaths.some(x => x === d - 1 || x === d)) { if (r.chance(0.8)) { return { place: H.home, where: wh, act: 'talk', why: 'a mourning visit to kin', h: 1.2 }; } }
      if (H.births.some(x => x < d && d - x <= 3)) { if (r.chance(0.5)) return { place: H.home, where: wh, act: 'talk', why: 'visiting kin with a newborn', h: 1 }; }
      const b = P.membersOn(k, d).find(x => P.persons[x].persian && P.persons[x].bday === d && P.persons[x].age >= 16);
      if (b !== undefined && r.chance(0.5)) return { place: H.home, where: wh, act: 'eat', why: `at a kinsman’s birthday meal`, h: 1.5 }; }
    return null;
  }
  /** whom to visit: ties weighted by affinity (relationships change who people see) */
  private visitTarget(): { place: string; where: Where; name: string } | null {
    const P = this.P, d = this.d; let tot = 0; const c: [number, number][] = [];
    for (const o of this.p.ties) { if (!P.present(o, d)) continue; const hh = P.households[P.home(o, d)]; if (hh.zone === 'terrace' || hh.zone === 'transient' || hh.id === this.hh.id) continue;
      if (P.walkH(this.home, hh.home, d, this.homeW, hh.zone === 'plain' ? 'plain' : 'town') > 0.75) continue;
      const a = P.affinity(this.pid, o, d); if (a <= 0.05) continue; c.push([o, a * a]); tot += a * a; }
    if (!c.length) return null; let u = this.r.next() * tot; for (const [o, w] of c) { u -= w; if (u <= 0) { const hh = P.households[P.home(o, d)]; return { place: hh.home, where: hh.zone === 'plain' ? 'plain' : 'town', name: nameFor(P.seed, P.persons[o]) ?? 'a neighbour' }; } }
    return null;
  }
  /** a work block at one place with the midday meal (lives.json meals), the midday heat rest after it (E-64) and rain
   *  shelter (W-01) */
  private workBlock(place: string, where: Where, act: ActivityId, why: string, t0: number, t1: number, outdoor = true, lunchPlace = place, noon = 12) {
    const C = this.C; this.dispute(place, where); if (this.t < t0) this.add(t0, place, act, why, where);
    const slots: [number, number, ActivityId, string, string][] = []; const ML = L.meals;
    const mEnd = noon + lerp(ML.midday_work_h[0], ML.midday_work_h[1], this.r.next()) + (C.heatRest ? 0.1 : 0);
    if (t0 < noon + 0.75 && t1 > Math.max(noon, t0) + 0.3) slots.push([Math.max(noon, t0), Math.min(t1, mEnd + Math.max(0, t0 - noon)), 'eat', where === 'terrace' ? 'the midday meal: the camp’s bread and water' : 'the midday meal', lunchPlace]);
    if (C.heatRest && outdoor && t1 > noon + 0.5 && t0 < 15) slots.push([Math.max(noon, t0 < noon ? mEnd : t0), Math.min(t1, 15), 'rest', 'midday rest in the shade (E-64)', lunchPlace]);
    // rain: outdoor work stops and people shelter (W-01): on the Terrace under the Gate's roof, elsewhere under a roof at the place
    const rain = C.wx.rain; if (outdoor && rain && rain[1] > this.t && rain[0] < t1) slots.push([Math.max(this.t, rain[0]), Math.min(t1, rain[1]), 'shelter', 'sheltering from the rain (W-01)', where === 'terrace' ? 'gate_hall' : place]);
    slots.sort((a, b) => a[0] - b[0]);
    for (const [a, b, sa, sw, sp] of slots) { if (b <= this.t) continue; if (a > this.t) this.add(a, place, act, why, where); this.add(b, sp, sa, sw, where); }
    this.add(t1, place, act, why, where);
  }
  private dayWork(place: string, where: Where, act: ActivityId, why: string, t0: number, t1: number, outdoor = false): Seg[] {
    if (this.C.wx.storm && outdoor) return this.homeDay('storm: no work');
    this.morning(t0 - this.P.walkH(this.home, place, this.d, this.homeW, where) - 0.05);
    const q = this.rationRun(); this.go(place, where, 'going to work'); if (q !== null && this.t > t1 - 1) { this.go(this.home, this.homeW); this.evening(this.t); return this.finish(); }
    this.workBlock(place, where, act, why, Math.max(t0, this.t), t1, outdoor);
    this.go(this.home, this.homeW, q !== null ? 'carrying the ration home' : 'going home', q !== null ? 'carry_sack' : 'walk');
    if (this.t < 12.5) this.noonAtHome(); this.evening(this.t); return this.finish();
  }
  /** a day at home: household tasks, errands, visits (days off, winter halves, rained-off days) */
  private homeDay(why: string, stayIn = false): Seg[] {
    const p = this.p, r = this.r, C = this.C; this.morning(this.rise() + 1.2, true);
    this.rationRun(); this.go(this.home, this.homeW);
    const rain = this.rainIn(this.t, 17) > 0.5 || C.wx.storm || C.wx.wet;
    if (!stayIn && !rain && this.adult()) {
      const u = r.next();
      if (u < 0.3) { const v = this.visitTarget(); if (v) { this.go(v.place, v.where, 'visiting'); this.add(this.t + r.range(1, 2.5), v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, this.homeW); } }
      else if (u < 0.5) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(this.t + r.range(0.5, 1.5), l, 'exchange', 'exchanging ration goods in kind', this.homeW); this.go(this.home, this.homeW); }
      else if (u < 0.65 && p.sex === 'f') this.well(this.t + 0.4, 'fetching water');
      else if (u < 0.8 && p.sex === 'm') { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(this.t + r.range(0.8, 2), l, 'gamble', 'knucklebones in the lane', this.homeW); this.go(this.home, this.homeW); }
    }
    const hw = stayIn || /^at home/.test(why) ? why : `at home: ${why}`;
    if (this.t < this.hd.noon - 0.3) { if (p.sex === 'f' && this.adult()) this.homeHours(this.hd.noon, hw); else if (p.sex === 'm' && this.adult() && !stayIn) this.homeHours(this.hd.noon, hw); else this.atHome(this.hd.noon, 'rest', hw); }
    this.noonAtHome(); if (this.adult() && !stayIn) this.homeHours(15 + r.range(0, 1)); else this.atHome(Math.max(this.t, 15 + r.range(0, 1)), 'rest', stayIn ? why : 'resting at home');
    if (!stayIn && !rain && this.adult() && r.chance(0.35)) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(this.t + r.range(0.5, 1.5), l, 'talk', 'talking with neighbours in the lane', this.homeW); this.go(this.home, this.homeW); }
    this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
  }
  /** a day of illness (E-72): lying ill, a little food brought; the last day of an episode is spent sitting up (C) */
  private sickDay(): Seg[] {
    const home = this.p.job === 'guard' ? 'garrison_sleep' : this.home, w: Where = this.p.job === 'guard' ? 'terrace' : this.homeW; const { k, n } = this.P.sickDayOf(this.pid, this.d);
    const last = k === n - 1 && n > 1;
    const g = this.p.job === 'guard', H = g ? null : this.hd; const bT = H ? H.breakfast + 0.15 : 7.5, nT = H ? H.noon : 13, sT = H ? H.supper : 19;
    const y = k === 0 && this.d > 0 && this.P.present(this.pid, this.d - 1) ? this.P.plan(this.pid, this.d - 1) : null, ly = y ? y[y.length - 1] : null;
    if (ly && ly.place !== home && ly.where !== 'road' && ly.place !== '-') { this.add(0.25, ly.place, 'rest', g ? 'taken ill on the night watch' : 'taken ill in the night', ly.where); this.add(0.4, `road:${ly.where === 'terrace' || w === 'terrace' ? 'terrace' : w}`, 'walk', g ? 'helped back to the garrison quarters' : 'helped home', 'road'); }
    this.add(bT + (k === 0 ? 0 : 0.3), home, k === 0 ? 'lie_ill' : 'sleep', k === 0 ? 'fallen ill in the night' : 'asleep', w); this.add(this.t + 0.4, home, 'eat', 'a little food brought to the sick', w);
    if (last) { this.add(Math.max(this.t + 0.5, nT), home, 'rest', 'sitting up, recovering', w); this.add(this.t + 0.5, home, 'eat', H ? 'the midday meal with the household: recovering' : 'a meal: recovering', w); this.add(Math.max(this.t + 0.5, sT), home, this.homeW === 'terrace' ? 'rest' : 'talk', 'sitting up with the household', w); this.add(this.t + 0.5, home, 'eat', H ? 'the evening meal with the household' : 'evening meal', w); return this.finish(); }
    this.add(Math.max(this.t + 0.5, nT), home, 'lie_ill', 'lying ill', w); this.add(this.t + 0.4, home, 'eat', 'a little food', w);
    if (!g && this.r.chance(0.35) && sT - this.t > 2.5) { this.add(this.t + 1.5, home, 'lie_ill', 'lying ill', w); this.add(this.t + 0.6, home, 'talk', 'visited by kin while ill', w); }
    this.add(Math.max(this.t + 0.5, sT), home, 'lie_ill', 'lying ill', w); this.add(this.t + 0.4, home, 'eat', 'a little food', w); this.add(24, home, 'lie_ill', 'lying ill', w);
    return this.segs;
  }
  private birthDay(): Seg[] { this.atHome(this.rise(), 'sleep', 'asleep'); this.atHome(this.t + 6 + 6 * this.r.next(), 'lie_ill', 'in labour, with the women of the household and group'); this.atHome(this.t + 0.5, 'eat', 'food after the birth'); this.atHome(24, 'lie_ill', 'resting after the birth with the newborn'); return this.segs; }
  /** after a birth (E-70, off work 10–40 days, C): a few days' confinement, then light work at home with the baby */
  private postpartum(): Seg[] {
    const r = this.r, x = this.P.gaveBirth(this.pid, this.d), conf = L.postpartum_off_days.confinement_days[0] + Math.floor(u01(this.P.seed, S.birth, this.pid, 13) * (L.postpartum_off_days.confinement_days[1] - L.postpartum_off_days.confinement_days[0] + 1));
    const H = this.hd;
    if (x <= conf) { this.atHome(Math.max(this.rise() + 0.8, H.breakfast), 'sleep', 'asleep with the newborn'); this.atHome(this.t + H.bLen, 'eat', 'breakfast brought to her'); this.atHome(this.t + r.range(1.5, 3), 'rest', 'resting with the newborn');
      if (r.chance(0.6)) this.atHome(this.t + r.range(0.5, 1.5), 'talk', 'women of the household and group come to see the child'); this.atHome(Math.max(this.t, H.noon), 'sleep', 'sleeping when the baby sleeps'); this.atHome(this.t + H.nLen, 'eat', 'the midday meal, brought to her');
      this.atHome(Math.max(this.t, H.supper), 'rest', 'resting with the newborn'); this.atHome(this.t + H.sLen, 'eat', 'the evening meal with the household'); return this.finish(); }
    this.atHome(Math.min(this.rise() + 0.4, H.breakfast), 'sleep', 'asleep'); this.atHome(Math.max(this.t, H.breakfast), 'rest', 'resting with the baby'); this.atHome(this.t + H.bLen, 'eat', 'breakfast with the household'); const l = `lane:${this.hh.q}`;
    const k = this.choose(L.postpartum_off_days.light_work as Record<'grind' | 'weave' | 'lane' | 'visit' | 'well', number>);
    if (k === 'grind' || k === 'weave') this.atHome(this.t + r.range(1, 2), k === 'grind' ? 'grind' : 'spin', k === 'grind' ? 'grinding, the baby beside her' : 'spinning, the baby beside her');
    else if (k === 'lane' && !this.C.wx.wet) { this.go(l, this.homeW); this.add(this.t + r.range(1, 2), l, 'talk', 'sitting in the lane with the baby', this.homeW); this.go(this.home, this.homeW); }
    else if (k === 'visit') { const v = this.visitTarget(); if (v) { this.go(v.place, v.where); this.add(this.t + r.range(1, 2), v.place, 'talk', `showing the baby to ${v.name}`, v.where); this.go(this.home, this.homeW); } }
    else this.well(this.t + 0.3, 'fetching water with the baby');
    this.atHome(Math.max(this.t, H.noon), 'rest', 'resting with the baby'); this.atHome(this.t + H.nLen, 'eat', 'the midday meal with the household'); this.atHome(this.t + r.range(1, 2), 'sleep', 'sleeping when the baby sleeps');
    if (r.chance(0.5)) { const g = r.chance(0.5); this.atHome(this.t + 1, g ? 'grind' : 'spin', g ? 'a little grinding (off work after the birth)' : 'spinning (off work after the birth)'); }
    this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
  }
  private mourningDay(): Seg[] {
    const x = this.P.mourning(this.pid, this.d); this.morning(this.rise() + 0.3, true);
    if (x === 1 && this.p.sex === 'm' && this.adult() && this.r.chance(0.7)) { const out = this.hh.zone === 'plain' ? `outside:${this.hh.q}` : 'outside'; // out of their own settlement
      this.go(out, this.homeW, 'carrying the dead out of the settlement'); this.add(this.t + 1.5, out, 'carry_bier', 'the dead are carried out of the settlement (E-71)', this.homeW); this.go(this.home, this.homeW, 'returning home'); }
    this.atHome(Math.max(this.t, this.hd.noon), 'talk', 'mourning with the household and visitors'); this.noonAtHome('a meal with the household, in mourning'); this.atHome(Math.max(this.t, this.hd.supper), 'rest', 'mourning at home');
    this.atHome(this.t + this.hd.sLen, 'eat', 'the evening meal with the household, in mourning'); this.atHome(Math.max(this.t, this.bed()), 'rest', 'mourning at home'); return this.finish();
  }
  private marriageDay(): Seg[] {
    // the move (E-73: no rite is attested, so none is shown): the last breakfast in the old house, then her things carried over
    const P = this.P, old = P.households[this.p.hh], H0 = P.hday(old.id, this.d), f = this.p.sex === 'f';
    this.add(Math.min(this.rise(), H0.breakfast - 0.1), old.home, 'sleep', 'asleep (the last night in the old house)', this.homeW); this.add(Math.max(this.t, H0.breakfast), old.home, 'rest', 'at home', this.homeW);
    this.add(this.t + H0.bLen, old.home, 'eat', 'the last breakfast in the old house', this.homeW); this.add(Math.max(this.t + 1, 10.5), old.home, 'talk', f ? 'taking leave of her household (no rite is attested: E-73)' : 'taking leave of the men he lodged with', this.homeW);
    this.cur = old.home; this.go(this.home, this.homeW, f ? 'moving to her husband’s household with her things' : 'moving into a new house with his wife', 'carry_sack');
    this.noonAtHome(f ? 'the midday meal in her new household' : 'the midday meal in the new house'); this.homeHours(this.sun.set - 1.5, f ? 'settling into her new household' : 'setting up the new house'); this.evening(this.t); return this.finish();
  }
  /** children under five (lives.json children_under_five, infant_care; C). An infant is with its mother day and night:
   *  nursed on demand (her plan holds the feeds), carried on her back when she works or walks (a twin at her front), in
   *  her lap when she sits or eats, asleep beside her at night, with naps by day. A toddler is with whoever minds it — the
   *  mother, or, while she works away, a grandparent or a kinswoman — and is wherever that person is; it naps at midday
   *  wherever it is, sleeps after the evening meal, goes along with an older brother or sister or is taken out to play,
   *  and is still nursed at one. A child is never left without an adult: with no woman at home it is with kin */
  private small(): Seg[] {
    const P = this.P, d = this.d, home = this.home, hid = P.home(this.pid, d); const mem = P.membersOn(hid, d); const U = L.children_under_five;
    const ok = (x: number) => x !== this.pid && mem.includes(x) && P.persons[x].age >= 12 && P.persons[x].job !== 'guard';
    let m = this.p.mother >= 0 && ok(this.p.mother) ? this.p.mother : mem.find(x => ok(x) && P.persons[x].sex === 'f' && P.persons[x].age >= 14);
    if (m === undefined) m = mem.find(ok);
    let base = home, baseW = this.homeW, taken = '';
    if (m === undefined) { // no one at home to mind the child: it is with a kinswoman in her house (C)
      for (const k of this.hh.kin) { const kw = P.membersOn(k, d).find(x => P.persons[x].sex === 'f' && P.persons[x].age >= 14 && P.persons[x].job !== 'guard'); if (kw !== undefined) { m = kw; const KH = P.households[k]; base = KH.home; baseW = KH.zone === 'plain' ? 'plain' : 'town'; taken = ' (taken in by kin)'; break; } }
      if (m === undefined) { const q = P.quarters[this.hh.q]; m = q?.women.find(x => P.present(x, d) && !P.sick(x, d)); if (m !== undefined) { const KH = P.households[P.home(m, d)]; base = KH.home; baseW = KH.zone === 'plain' ? 'plain' : 'town'; taken = ' (taken in by a neighbour)'; } }
      if (m === undefined) return this.finish();
    }
    const ms = P.plan(m, d); const Mo = P.persons[m]; const inf = this.p.age === 0; const ill = P.sick(this.pid, d);
    const illness = () => { if (ill) for (const s of this.segs) if ((s.act === 'play' || s.act === 'rest') && s.where !== 'road') { s.act = 'lie_ill'; s.why = s.with === this.p.mother ? 'ill, lying beside the mother' : 'ill, lying beside the woman minding it'; } return this.segs; };
    const wakeM = ms.find(s => s.t0 > 2 && s.act !== 'sleep' && !/ in the night/.test(s.why))?.t0 ?? 6;
    const nursing = (s: Seg) => /nurs/.test(s.why) && (s.act === 'rest' || s.act === 'lie_ill');
    const outdoorWork: ActivityId[] = ['reap', 'thresh', 'field_work', 'pick_fruit', 'draw_water', 'wash', 'carry_sack', 'carry_jar', 'carry_jar_head', 'haul', 'herd', 'plough', 'irrigate', 'dig_canal', 'garden_work', 'queue', 'exchange', 'tend_animals'];
    if (inf) { // ---- an infant
      const twins = P.childrenOf(Mo.id).filter(c => c !== this.pid && P.persons[c].age === 0 && P.present(c, d) && Math.abs(P.persons[c].born - this.p.born) < 1);
      const front = twins.some(c => c < this.pid); const carried = front ? 'at the mother’s front' : 'on the mother’s back';
      const naps: [number, number][] = [[wakeM + 1.4, wakeM + 2.9], [11.9, 14.1], [15.9, 17]];
      const cuts = [...new Set([...ms.map(s => s.t1), ...naps.flat().filter(x => x > 0 && x < 24)])].sort((a, b) => a - b);
      let t0 = 0;
      const bornT = this.p.born === d ? (ms.find(x => /food after the birth/.test(x.why))?.t0 ?? 0) : -1; // before the birth: not yet born
      for (const t1 of cuts) { if (t1 <= t0) continue; const mid = (t0 + t1) / 2; t0 = t1; const M = segAt(ms, mid); const nap = naps.some(([a, b]) => mid >= a && mid < b);
        if (mid < bornT) { this.add(t1, '-', 'offmap', 'not yet born', 'away'); continue; }
        let a: ActivityId, why: string;
        if (nursing(M)) { a = 'eat'; why = twins.length ? 'nursed with the twin' : 'nursed by the mother'; }
        else if (M.act === 'sleep') { a = 'sleep'; why = 'asleep beside the mother'; }
        else if (M.act === 'lie_ill') { const night = mid < wakeM || mid > 20; const birth = /birth|newborn/.test(M.why); a = nap || night || birth ? 'sleep' : 'rest'; why = birth ? 'asleep beside the mother, newborn' : a === 'sleep' ? 'asleep beside the sick mother' : 'lying beside the sick mother'; }
        else if (M.act === 'eat') { a = nap ? 'sleep' : 'rest'; why = nap ? 'asleep in the mother’s lap at the meal' : 'in the mother’s lap at the meal'; }
        else if (M.where === 'road' || M.act === 'walk') { a = nap ? 'sleep' : 'rest'; why = nap ? `asleep, carried ${carried}` : `carried ${carried}`; }
        else if (outdoorWork.includes(M.act)) { a = nap ? 'sleep' : 'rest'; why = `${nap ? 'asleep ' : ''}${carried} while she works`; }
        else if (['talk', 'rest', 'gamble', 'play', 'shelter', 'inspect'].includes(M.act)) { a = nap ? 'sleep' : 'rest'; why = nap ? 'asleep in the mother’s lap' : 'in the mother’s lap'; }
        else { a = nap ? 'sleep' : 'rest'; why = nap ? 'asleep on a mat beside the mother while she works' : 'lying on a mat beside the mother while she works'; }
        const last = this.segs[this.segs.length - 1]; this.add(t1, M.place, a, why + taken, M.where, !!last && last.why !== why + taken); this.segs[this.segs.length - 1].with = m; }
      if (m !== this.p.mother) { // no mother to nurse it: fed by the woman minding it, by day and by night (a wet nurse or animal milk; C)
        const IC = L.infant_care, bed = Math.min(22, this.sun.set + 2.5); const ts: number[] = [lerp(1, 3, this.r.next()), lerp(3.5, Math.max(3.6, wakeM - 0.3), this.r.next())];
        for (let t = wakeM + this.r.range(0.2, 0.6); t < bed; t += lerp(IC.day_feed_every_h[0], IC.day_feed_every_h[1], this.r.next()) + 0.4) ts.push(t);
        for (const t of ts) this.insertAt(this.segs, t, lerp(IC.feed_h[0], IC.feed_h[1], this.r.next()), 'eat', `fed by the woman minding it (a wet nurse or animal milk)${taken}`, s => s.act === 'eat'); }
      return illness();
    }
    // ---- a toddler (1-4)
    const hd = P.hday(hid, d); const bedtime = Math.min(21, hd.supper + hd.sLen + 0.4 + (this.p.age >= 3 ? 0.5 : 0)); const wakeT = Math.max(wakeM, hd.breakfast - 0.15 - 0.3 * this.r.next());
    const nap0 = hd.noon + hd.nLen + 0.05, napW: [number, number] = [nap0, nap0 + [2.2, 2.2, 2, 1.6, 1.2][Math.min(4, this.p.age)] + (this.C.heatRest ? 0.5 : 0)];
    // a child of one often still sleeps in the morning as well, a child of two now and then (C)
    const napAM: [number, number] = this.r.chance([0, 0.6, 0.15, 0, 0][Math.min(4, this.p.age)]) ? (() => { const a = 8.5 + 1.5 * this.r.next(); return [a, a + 0.6 + 0.6 * this.r.next()] as [number, number]; })() : [-1, -1];
    const sib = mem.find(x => x !== this.pid && P.persons[x].job === 'child' && P.persons[x].age >= 6 && P.persons[x].age <= 13);
    const ss = sib !== undefined ? P.plan(sib, d) : null;
    // while the mother works away for hours, a toddler goes along or is left with a grandparent at home or with a kinswoman (C)
    const elder = mem.find(x => ok(x) && P.persons[x].job === 'elder' && !P.sick(x, d) && !P.mourning(x, d));
    const eAll = elder !== undefined ? P.plan(elder, d) : null; const es = eAll && this.r.chance(U.along_with_grandparent) ? eAll : null;
    const kinH = this.hh.kin.length ? P.households[this.hh.kin[Math.floor(u01(P.seed, S.assign, this.pid, d) * this.hh.kin.length)]] : null;
    const kw = kinH && kinH.zone !== 'terrace' && kinH.zone !== 'transient' ? P.membersOn(kinH.id, d).find(x => P.persons[x].sex === 'f' && P.persons[x].age >= 14 && P.persons[x].job !== 'guard' && !P.sick(x, d)) : undefined;
    // the mother's long working absences from home (2 h or more, with work in them)
    const blocks: [number, number][] = []; { let a = -1; for (const s of ms) { if (s.place !== base) { if (a < 0) a = s.t0; } else if (a >= 0) { blocks.push([a, s.t0]); a = -1; } } if (a >= 0) blocks.push([a, 24]); }
    const workBlocks = blocks.filter(([a, b]) => b - a >= 2 && ms.some(s => s.t0 < b && s.t1 > a && !['talk', 'eat', 'rest', 'queue', 'gamble', 'exchange', 'play', 'walk', 'shelter'].includes(s.act) && s.where !== 'road'));
    const homeBound = (x: number | undefined) => { if (x === undefined) return false; const xs = P.plan(x, d), xh = P.households[P.home(x, d)].home; let tot = 0, home = 0;
      for (const [a, b] of workBlocks) for (let h = a + 0.25; h < b; h += 0.5) { tot++; if (segAt(xs, h).place === xh) home++; } return tot > 0 && home / tot >= 0.7; };
    const minderPid = !workBlocks.length || !this.r.chance(U.left_with_minder) ? undefined : homeBound(elder) ? elder : homeBound(kw) ? kw : undefined;
    const mAll = minderPid === undefined ? null : minderPid === elder ? eAll : P.plan(minderPid, d);
    const minderWhy = minderPid === elder ? 'with the grandparent while the mother works' : 'with a kinswoman while the mother works';
    // on some days the small ones are taken outside the door to play with the neighbours' children, or to a neighbour's or
    // a kinswoman's house in the same lane while the mother works at home; not in rain or dust (W-03) (C)
    const outing = (am: boolean) => this.C.wx.wet || this.C.wx.dust || taken || ill ? null : (() => {
      const k = this.choose(U.outing as Record<'none' | 'lane' | 'neighbour' | 'kin', number>); if (k === 'none') return null;
      const h0 = am ? this.r.range(7.5, 10) : this.r.range(napW[1] + 0.2, Math.max(napW[1] + 0.3, this.sun.set - 2)), h1 = Math.min(am ? napW[0] - 0.3 : this.sun.set - 0.3, h0 + this.r.range(U.outing_h[0], U.outing_h[1]));
      if (h1 - h0 < 0.3) return null;
      let place = `lane:${this.hh.q}`, why = 'playing outside the door with the neighbours’ children', host = -1;
      if (k !== 'lane') { const cand = (k === 'kin' ? this.hh.kin : Mo.ties.map(o => P.home(o, d))).map(h => P.households[h]).filter(H => H.id !== this.hh.id && H.q === this.hh.q && H.zone === this.hh.zone);
        const Hh = cand.length ? cand[Math.floor(this.r.next() * cand.length)] : null; const w = Hh ? P.membersOn(Hh.id, d).find(x => P.persons[x].sex === 'f' && P.persons[x].age >= 14 && segAt(P.plan(x, d), (h0 + h1) / 2).place === Hh.home) : undefined;
        if (Hh && w !== undefined) { place = Hh.home; host = w; why = k === 'kin' ? 'at a kinswoman’s house in the lane, playing with her children' : 'playing at a neighbour’s house with their children'; const hs = segAt(P.plan(w, d), (h0 + h1) / 2); return { h0: Math.max(h0, hs.t0), h1: Math.min(h1, hs.t1), place, why, host }; } }
      if (this.p.age < 2) return { h0, h1, place: base, why: 'playing on the doorstep with the neighbours’ children, the mother inside', host: m! };
      if (host < 0) why = 'playing outside the door with the neighbours’ children, the mother within call';
      return { h0, h1, place, why, host }; })();
    const outWs = [outing(true), outing(false)].filter((x): x is NonNullable<typeof x> => !!x);
    const plans = new Map<number, Seg[]>(); const planOf = (x: number) => plans.get(x) ?? plans.set(x, P.plan(x, d)).get(x)!;
    const wet = (h: number) => { const w = this.C.wx.rain; return !!w && h >= w[0] && h < w[1]; };
    // outings with a sibling or the grandparent are taken whole: from the door and back, while the mother is at home
    // (and not feeding the child), outside the midday sleep, before bedtime, not in rain
    const outings = (xs: Seg[] | null, ok: (x: Seg) => boolean) => { const out: [number, number][] = []; if (!xs) return out; let a = -1, good = true;
      for (const x of xs) { if (x.place !== base) { if (a < 0) { a = x.t0; good = true; } if (x.where !== 'road' && !ok(x)) good = false; } else if (a >= 0) { if (good) out.push([a, x.t0]); a = -1; } } return out; };
    const clear = ([x, y]: [number, number]) => { if (y - x < 0.4 || x < wakeT || y > bedtime - 0.2 || (x < napW[1] && y > napW[0]) || (x < napAM[1] && y > napAM[0]) || ill) return false; const w = this.C.wx.rain; if (w && w[0] < y && w[1] > x) return false;
      for (let h = x; h < y; h += 0.1) { const M = segAt(ms, h); if (M.place !== base || (this.p.age === 1 && nursing(M))) return false; } return true; };
    const sibSpans = outings(ss, x => x.act === 'play' && (x.place.startsWith('lane:') || x.place.startsWith('garden:') || x.place.startsWith('canal:'))).filter(clear);
    const eSpans = outings(es, x => ['talk', 'exchange', 'eat'].includes(x.act)).filter(sp => sp[0] > 6 && sp[1] < this.sun.set && clear(sp));
    const cuts = [...new Set([...ms.map(s => s.t1), ...(ss ? ss.map(s => s.t1) : []), ...(es ? es.map(s => s.t1) : []), ...(mAll ? mAll.map(s => s.t1) : []), ...outWs.flatMap(o => [o.h0, o.h1]), ...napW, ...napAM.filter(x => x > 0), bedtime, wakeT, ...workBlocks.flat()])].filter(x => x > 0 && x <= 24).sort((a, b) => a - b);
    let t0 = 0;
    const put = (t1: number, place: string, a: ActivityId, why: string, where: Where, w: number) => { if (t1 <= this.t + 1e-4) return; const prev = this.segs[this.segs.length - 1];
      if (prev && t1 - this.t < 0.03 && prev.place === place && t1 < 24) { prev.t1 = t1; this.t = t1; return; } const last = this.segs[this.segs.length - 1]; this.add(t1, place, a, why + taken, where, !!last && ((last.with ?? -1) !== w || last.why !== why + taken)); const L0 = this.segs[this.segs.length - 1]; if (w >= 0) L0.with = w; else delete L0.with; };
    for (const t1 of cuts) {
      if (t1 <= t0) continue; const mid = (t0 + t1) / 2; const M = segAt(ms, mid); t0 = t1;
      const napping = (mid >= napW[0] && mid < napW[1]) || (mid >= napAM[0] && mid < napAM[1]);
      const moving = M.where === 'road' || M.act === 'walk';
      if (M.act === 'sleep' || / in the night/.test(M.why) || (M.place === base && ((mid >= bedtime && mid > 12) || mid < wakeT))) { put(t1, M.place, 'sleep', 'asleep', M.where, m); continue; }
      if (mid >= bedtime && mid > 12) { // the mother goes out after the child's bedtime: it sleeps at home if another of the household is there, else she carries it
        const other = mem.find(x => ok(x) && x !== m && segAt(planOf(x), mid).place === base);
        if (other !== undefined) put(t1, base, 'sleep', 'asleep at home', baseW, other); else put(t1, M.place, 'sleep', 'asleep, carried by the mother', M.where, m); continue; }
      if (minderPid !== undefined && mAll && workBlocks.some(([a, b]) => mid >= a && mid < b) && mid > 4.5 && mid < bedtime) { const G = segAt(mAll, mid);
        const a: ActivityId = G.act === 'sleep' || (napping && G.where !== 'road') ? 'sleep' : G.where === 'road' ? (this.p.age >= 2 ? 'walk' : 'rest') : G.act === 'eat' ? 'eat' : 'play';
        put(t1, G.place, a, a === 'sleep' ? `a midday sleep, ${minderWhy}` : a === 'rest' ? `carried, ${minderWhy}` : minderWhy, G.where, minderPid); continue; }
      if (this.p.age === 1 && nursing(M)) { put(t1, M.place, 'eat', 'nursed by the mother', M.where, m); continue; }
      if (M.place !== base && M.act !== 'lie_ill') {
        const a: ActivityId = M.act === 'eat' ? 'eat' : moving ? (this.p.age >= 2 ? 'walk' : 'rest') : napping ? 'sleep' : 'play';
        put(t1, M.place, a, a === 'eat' ? 'eating with the mother' : a === 'walk' ? 'walking with the mother' : a === 'rest' ? 'carried by the mother' : a === 'sleep' ? (mid < 11.5 ? 'a morning sleep near the mother' : 'a midday sleep near the mother') : 'playing near the mother', M.where, m); continue; }
      // a whole outing with an older brother or sister, or with the grandparent, from leaving the door to coming back
      const sp = sibSpans.find(([x, y]) => mid >= x && mid < y);
      if (sp) { const S2 = segAt(ss!, mid), road = S2.where === 'road'; put(t1, S2.place, road ? (this.p.age >= 2 ? 'walk' : 'rest') : 'play', road ? (this.p.age >= 2 ? 'walking with an older brother or sister' : 'carried by an older brother or sister') : 'taken along by an older brother or sister', S2.where, sib!); continue; }
      const ep = eSpans.find(([x, y]) => mid >= x && mid < y);
      if (ep) { const E2 = segAt(es!, mid), road = E2.where === 'road'; put(t1, E2.place, road ? (this.p.age >= 2 ? 'walk' : 'rest') : E2.act === 'eat' ? 'eat' : 'play', road ? (this.p.age >= 2 ? 'walking with the grandparent' : 'carried by the grandparent') : E2.act === 'eat' ? 'eating with the grandparent' : 'along with the grandparent', E2.where, elder!); continue; }
      const outW = outWs.find(o => mid >= o.h0 && mid < o.h1);
      if (!napping && outW && mid < this.sun.set - 0.3 && M.act !== 'eat' && !wet(mid)) { put(t1, outW.place, 'play', outW.why, baseW, outW.host); continue; }
      const a: ActivityId = M.act === 'eat' ? 'eat' : napping ? 'sleep' : 'play';
      put(t1, base, a, a === 'sleep' ? (mid < 11.5 ? 'a morning sleep' : 'a midday sleep') : a === 'eat' ? 'a meal with the household' : wet(mid) ? 'playing indoors out of the rain' : 'playing at home near the mother', baseW, m);
    }
    return illness();
  }
  // ---------------------------------------------------------------- jobs
  private guard(): Seg[] {
    const P = this.P, d = this.d, p = this.p, r = this.r, C = this.C; const ph = P.phase(this.pid, d); const me = P.rota(d).get(this.pid);
    const prev = P.rota(d - 1).get(this.pid); const tailC = !!prev && prev.watch === 2; const fam = this.hh.zone === 'town' ? this.hh : null;
    const hearth = HEARTHS[p.file % 3]; const G = P.groups[p.group];
    // a watch (lives.json guard_rota): each man at a post is relieved once for a meal at the hearth by one of the watch's
    // patrol pair, who stands in at the post meanwhile; the pair share the sixteen posts, eight each (C, Q-060)
    const GR = L.guard_rota;
    const watch = (x: { post: string | null; watch: 0 | 1 | 2 }, t1: number, rd: number) => {
      const w0 = [6, 14, 22][x.watch] + (rd - d) * 24; const R = P.rota(rd); const brk = (i: number) => w0 + GR.break_first_h + (i % 8) * GR.break_step_h + (i % 8 >= 4 ? GR.break_mid_gap_h : 0);
      const patrol = [...R.entries()].filter(([q, y]) => y.watch === x.watch && y.post === null && P.persons[q].rank === 0).map(([q]) => q).sort((a, b) => a - b);
      if (x.post) { const i = GUARD_POSTS.indexOf(x.post); const b = brk(i);
        if (b > this.t + 0.1 && b + GR.break_h < t1 - 0.1) { this.add(b, x.post, 'stand_guard', 'on watch', 'terrace');
          if (patrol[i < 8 ? 0 : 1] !== undefined) this.add(b + GR.break_h, hearth, 'eat', 'bread and water at the hearth, relieved at the post', 'terrace');
          else this.add(b + 0.25, x.post, 'eat', 'bread and water at the post (no man of the patrol to relieve him)', 'terrace'); }
        this.add(t1, x.post, 'stand_guard', 'on watch', 'terrace'); return; }
      if (p.rank === 1) { const b = w0 + 3.8; if (b > this.t + 0.1 && b + 0.4 < t1 - 0.1) { this.add(b, 'terrace_round', 'patrol', 'the leader of ten going the rounds of the posts', 'terrace'); this.add(b + 0.4, hearth, 'eat', 'bread and water at the hearth between rounds', 'terrace'); } }
      const k = patrol.indexOf(this.pid);
      let ate = false;
      if (k >= 0 && k < 2) for (let i = k * 8; i < k * 8 + 8; i++) { const post = GUARD_POSTS[i]; const b = brk(i);
        if (!ate && i % 8 === 4 && b - GR.break_mid_gap_h + 0.05 > this.t && b < t1) { ate = true; this.add(Math.max(this.t, b - GR.break_mid_gap_h + 0.05), 'terrace_round', 'patrol', 'on patrol between the posts', 'terrace'); this.add(b - 0.05, hearth, 'eat', 'bread and water at the hearth between rounds', 'terrace'); }
        if (b < this.t + 0.05 || b + GR.break_h > t1 - 0.05 || ![...R.values()].some(y => y.watch === x.watch && y.post === post)) continue;
        this.add(b, 'terrace_round', 'patrol', 'on patrol between the posts', 'terrace'); this.add(b + GR.break_h, post, 'stand_guard', 'standing in at the post while its man eats', 'terrace'); }
      if (k >= 0 && k < 2 && !ate && t1 - this.t > 1) { this.add(this.t + 0.1, 'terrace_round', 'patrol', 'on patrol between the posts', 'terrace'); this.add(this.t + 0.35, hearth, 'eat', 'bread and water at the hearth between rounds', 'terrace'); }
      this.add(t1, 'terrace_round', 'patrol', p.rank ? 'the leader of ten going the rounds of the posts' : 'on patrol between the posts', 'terrace');
    };
    const lastEat = () => { for (let i = this.segs.length - 1; i >= 0; i--) if (this.segs[i].act === 'eat') return this.segs[i].t1; return -9; };
    const meal = (why: string) => { if (this.t - lastEat() < 1.5) return; this.add(this.t + 0.6, hearth, 'eat', why, 'terrace'); };
    const leisure = (t1: number) => { while (this.t < t1 - 0.2) { const u = r.next(); const dt = Math.min(t1 - this.t, r.range(0.5, 1.5));
      if (u < 0.35) this.add(this.t + dt, hearth, 'gamble', 'knucklebones at the hearth', 'terrace'); else if (u < 0.7) this.add(this.t + dt, hearth, 'talk', 'off watch at the hearth', 'terrace');
      else if (u < 0.8 && C.wx.rainH < 1 && this.t > 7 && this.t < 18) this.add(this.t + Math.min(dt, 0.6), 'forecourt', 'talk', 'an errand across the court', 'terrace'); else this.add(this.t + dt, hearth, 'rest', 'resting', 'terrace'); }
      if (this.t < t1) this.add(t1, hearth, 'rest', 'resting', 'terrace'); };
    // duties drawn for today: the Treasury door doubled (E-81) and the garrison's ration carried up from the depot
    const jobs: [number, number, string, ActivityId, string][] = [];
    C.doubled.forEach((w, k) => { if (P.doublers(d, k, w[0]).includes(this.pid)) jobs.push([w[0], w[1], 'post_treas_3', 'stand_guard', 'the Treasury guard doubled while silver is out or a letter comes in (E-81)']); });
    const issueH = C.issue.get(p.group); if (issueH !== undefined && ph >= 3 && p.idx % 3 === 1) jobs.push([issueH, issueH + 2, G.issuePlace, 'carry_sack', 'carrying the garrison’s ration up from the Terrace depot']);
    jobs.sort((a, b) => a[0] - b[0]);
    /** free time between now and t1: duties first; otherwise a visit to the family in the town, or the hearth */
    const free = (t1: number, visitChance: number) => {
      const mine = jobs.filter(j => j[0] >= this.t && j[1] <= t1);
      if (!mine.length && fam && t1 - this.t > 3.5 && !C.wx.storm && this.rainIn(this.t, t1) < 1 && r.chance(visitChance)) {
        const h = P.walkH('garrison_sleep', fam.home, d, 'terrace', 'town'); leisure(this.t + 0.3);
        this.add(this.t + h, 'road:town', 'walk', 'down to the town', 'road'); const back = t1 - h;
        this.add(Math.min(back, this.t + r.range(1, 2)), fam.home, 'talk', 'with his wife and children in the town', 'town');
        if (back - this.t > 1.5 && r.chance(0.5)) this.add(Math.min(back - 0.8, this.t + r.range(0.5, 1)), `lane:${fam.q}`, r.chance(0.5) ? 'exchange' : 'talk', 'in the lane of his family’s quarter', 'town');
        if (back - this.t > 1.2) this.add(back - 0.6, fam.home, r.chance(0.5) ? 'rest' : 'talk', 'with his family', 'town');
        this.add(back, fam.home, back - this.t > 0.35 ? 'eat' : 'talk', back - this.t > 0.35 ? 'a meal with his family before going back up' : 'with his family', 'town'); this.add(t1, 'road:terrace', 'walk', 'back up to the garrison', 'road'); return;
      }
      for (const j of mine) { leisure(j[0]); this.add(j[1], j[2], j[3], j[4], 'terrace'); }
      leisure(t1);
    };
    if (tailC) { watch(prev!, 6, d - 1); meal('breakfast after the night watch'); this.add(13, 'garrison_sleep', 'sleep', 'sleeping after the night watch', 'terrace'); }
    if (me && me.watch === 0) { // watch A, 06–14
      if (!tailC) this.add(5, 'garrison_sleep', 'sleep', 'asleep in the garrison quarters', 'terrace');
      meal('breakfast before the watch'); this.add(6, hearth, 'talk', 'readying for the watch', 'terrace'); watch(me, 14, d); meal('a meal after the watch');
      free(19.8, 0.25); meal('evening meal'); leisure(Math.min(22, this.sun.set + 1.5)); return this.finish();
    }
    if (me && me.watch === 1) { // watch B, 14–22
      if (!tailC) this.add(Math.max(this.t, this.sun.rise + 0.5), 'garrison_sleep', 'sleep', 'asleep in the garrison quarters', 'terrace');
      meal('breakfast'); free(13.2, 0.3); meal('a meal before the watch'); this.add(14, hearth, 'talk', 'readying for the watch', 'terrace'); watch(me, 22, d); meal('a meal after the watch'); return this.finish();
    }
    if (me && me.watch === 2) { // watch C, 22–06 (tomorrow's plan holds the rest of it)
      if (!tailC) this.add(Math.max(this.t, this.sun.rise + 0.3), 'garrison_sleep', 'sleep', 'asleep in the garrison quarters', 'terrace');
      meal(tailC ? 'a meal' : 'breakfast'); free(18.5, 0.35); meal('a meal before the night watch'); this.add(21.6, 'garrison_sleep', 'sleep', 'a short sleep before the night watch', 'terrace');
      this.add(22, hearth, 'talk', 'readying for the night watch', 'terrace'); watch(me, 24, d); return this.segs;
    }
    // off duty (phase 3: after the night watch; phase 4: a whole day off)
    if (!tailC) this.add(this.sun.rise + 0.4, 'garrison_sleep', 'sleep', 'asleep in the garrison quarters', 'terrace');
    meal(tailC ? 'a meal' : 'breakfast');
    free(12.3, ph === 4 ? L.guard_off_day.family_visit : 0); meal('midday meal');
    free(19.5, ph === 3 ? 0.5 : 0.2); meal('evening meal'); leisure(Math.min(22, this.sun.set + 2)); return this.finish();
  }
  /** one of several real alternatives, by weight (lives.json job_tasks) */
  private choose<K extends string>(w: Record<K, number>): K { const e = Object.entries(w) as [K, number][]; let u = this.r.next() * e.reduce((s, x) => s + x[1], 0); for (const [k, x] of e) { u -= x; if (u <= 0) return k; } return e[e.length - 1][0]; }
  /** a work block at a second place during the day (goes there, works, comes back to `back`) */
  private errand(place: string, where: Where, act: ActivityId, why: string, h: number, back: string, backW: Where) { this.go(place, where); this.add(this.t + h, place, act, why, where); this.go(back, backW); }
  /** the summer harvest draft: kurtaš of the town's state groups sent to reap on the state fields (lives.json harvest_draft) */
  private drafted() {
    const p = this.p, H = L.harvest_draft; if (!H.months.includes(this.C.month) || this.C.wx.storm || this.hh.zone !== 'town' || p.age < 14 || p.group < 0) return false;
    if (!['treasury', 'weaver', 'miller', 'porter', 'homemaker', 'builder'].includes(p.job) || (p.job === 'builder' && p.sub === 'stone') || (p.job === 'porter' && p.sub === 'terrace') || p.agent >= 0) return false;
    return u01(this.P.seed, S.draft, this.pid, this.d) < H.p;
  }
  private draftDay(): Seg[] {
    const f = 'crown_fields'; this.morning(5.4 - this.P.walkH(this.home, f, this.d, this.homeW, 'plain')); this.go(f, 'plain', 'to the harvest on the state fields');
    this.workBlock(f, 'plain', 'reap', 'drafted to reap on the state fields (harvest labour from the town: population.json)', Math.max(5.5, this.t), 11.5, true, f);
    this.add(this.t + lerp(L.meals.midday_work_h[0], L.meals.midday_work_h[1], this.r.next()), f, 'eat', 'the midday meal at the field: bread and water', 'plain');
    this.go(this.home, this.homeW); this.atHome(this.t + 1, 'rest', 'resting after the harvest work'); this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
  }
  private builder(): Seg[] {
    const P = this.P, p = this.p, C = this.C; const [w0, w1] = P.workWindow(C); let place = P.builderPlace(this.pid, this.d, C);
    let act: ActivityId = p.sub === 'stone' ? (p.rank === 1 && p.squad === 0 ? 'inspect' : 'dress_stone') : p.sub === 'brick' ? (place === 'brickyard' ? 'mould_brick' : place.startsWith('h100_wall') ? 'lay_brick' : 'haul') : 'haul';
    let why = p.sub === 'stone' ? (p.rank === 1 && p.squad === 0 ? 'overseeing the squad' : place.startsWith('h100_c') ? 'cutting the flutes of a raised shaft' : place === 'worksite_capital' ? 'carving a double-bull capital' : place.startsWith('h100_door') ? 'carving the doorway reliefs' : 'dressing a column drum')
      : act === 'mould_brick' ? 'moulding mud brick by the water (E-63)' : act === 'lay_brick' ? 'laying mud brick on the hall walls' : 'hauling earth for the ramp';
    // the labour gang goes where the building needs it, morning and afternoon (lives.json job_tasks.labour_gang); squads
    // move together
    let pm: [string, ActivityId, string] | null = null;
    if (p.sub === 'labour' || (p.sub === 'brick' && place !== 'brickyard' && !place.startsWith('h100_wall'))) {
      const B = C.build; const arrived = C.events.some(e => e.id === 'E-61' && e.text.includes('arrived'));
      const gangTask = (half: number): [string, ActivityId, string] => { const w = L.job_tasks.labour_gang.v; const u = u01(P.seed, S.assign, 1000 + p.gang * 100 + p.squad, this.d, half);
        // the weights of the tasks the building offers today (no drums arrived: no unloading; none dressed: no raising)
        const opts: [string, number][] = [['unload', arrived ? w.unload : 0], ['raise', B.raise !== null && B.dressed > 0 ? w.raise : 0], ['water', w.water], ['ramp', w.ramp]];
        let x = u * opts.reduce((q, o) => q + o[1], 0), pick = 'ramp'; for (const [k, v] of opts) { if (x < v) { pick = k; break; } x -= v; }
        return pick === 'unload' ? ['worksite', 'haul', 'unloading column drums from the quarry at the yard'] : pick === 'raise' ? [colPlace(B.raise!), 'haul', `hauling a drum up the ramp to column ${B.raise! + 1}`]
          : pick === 'water' ? [`h100_wall_${B.wall}`, 'carry_jar', 'carrying water for the mortar'] : ['hall100_site', 'haul', 'building up the earth ramp']; };
      [place, act, why] = gangTask(0); const aft = gangTask(1); if (aft[0] !== place || aft[1] !== act) pm = aft;
    }
    const where: Where = place === 'brickyard' ? 'town' : 'terrace';
    const commute = P.walkH(this.home, where === 'terrace' ? 'stair_foot' : place, this.d, this.homeW, where);
    this.morning(w0 - commute - 0.05); this.go(where === 'terrace' ? 'stair_foot' : place, where, 'going to the building site');
    const issue = C.issue.get(p.group);
    if (issue !== undefined) { this.add(Math.max(this.t, issue), 'stair_foot', 'queue', 'waiting for the ration issue at the Terrace depot', 'terrace'); this.dispute('stair_foot', 'terrace'); this.add(this.t + 0.3 + this.r.next(), 'stair_foot', 'queue', 'in the queue for the monthly ration', 'terrace'); }
    const pay = C.payments.find(x => x.group === p.group); const lunch = where === 'terrace' ? 'work_hearth' : place;
    if (pay && p.rank === 2 && pay.t > this.t + 0.5) { this.workBlock(place, where, act, why, Math.max(w0, this.t), pay.t - 0.2, true, lunch); this.add(pay.t, 'road:terrace', 'walk', 'to the Treasury', 'road'); this.add(pay.t + 0.8, 'treasury_desk', 'talk', 'receiving the gang’s silver (E-05)', 'terrace'); }
    // at the walls the brick squad shares out the work, morning and afternoon (C): laying, carrying bricks from the stacks,
    // mixing mud mortar and carrying its water
    if (act === 'lay_brick') { const pick = (): [ActivityId, string] => { const k = this.choose(L.job_tasks.brick_squad.v as Record<'lay' | 'bricks' | 'mortar', number>);
        return k === 'lay' ? ['lay_brick', 'laying mud brick on the hall walls'] : k === 'bricks' ? ['haul', 'carrying dried bricks from the stacks to the wall'] : ['carry_jar', 'mixing mud mortar and carrying its water']; };
      const [a1, y1] = pick(); if (this.t < 12 && !C.heatRest) this.workBlock(place, where, a1, y1, Math.max(w0, this.t), 12.6, true, lunch); [act, why] = pick(); }
    if (pm && this.t < 12 && !C.heatRest) { this.workBlock(place, where, act, why, Math.max(w0, this.t), 12.6, true, lunch); [place, act, why] = pm; }
    this.workBlock(place, where, act, why, Math.max(w0, this.t), w1, true, lunch);
    this.endOfWork(lunch, where, issue !== undefined);
    return this.finish();
  }
  /** the end of a Terrace working day: on a heat day (E-64) the gangs stop at noon, eat at the site and go home; then home */
  private endOfWork(lunch: string, where: Where, ration: boolean) {
    if (this.C.heatRest && this.t < 13.5 && this.segs[this.segs.length - 1].act !== 'eat') this.add(this.t + lerp(L.meals.midday_work_h[0], L.meals.midday_work_h[1], this.r.next()), lunch, 'eat', where === 'terrace' ? 'the midday meal at the site: the camp’s bread and water (work stops in the heat, E-64)' : 'the midday meal (work stops in the heat, E-64)', where);
    this.go(this.home, this.homeW, ration ? 'carrying the ration home' : 'going home', ration ? 'carry_sack' : 'walk');
    this.evening(this.t);
  }
  private campWoman(): Seg[] {
    const P = this.P, p = this.p, C = this.C, d = this.d;
    const infant = P.households[this.hh.id].members.some(x => P.persons[x].mother === this.pid && P.present(x, d) && d - P.persons[x].born < 354 && P.persons[x].born > -1e8);
    if (C.wx.storm || infant || (C.winter && (p.id + d) % 2 === 1)) return this.homeDay(infant ? 'at home with her infant' : C.wx.storm ? 'storm: no bread today' : 'bread for half the gang in winter: her day at home');
    const baker = p.sub === 'baker'; const t0 = baker ? this.sun.rise - 0.6 : this.sun.rise + 0.4, t1 = C.heatRest ? 12 : 14.5;
    const commute = P.walkH(this.home, 'stair_foot', d, this.homeW, 'terrace');
    this.morning(t0 - commute - 0.05); this.go('stair_foot', 'terrace', 'going up to the work camp');
    const issue = C.issue.get(p.group); if (issue !== undefined) { this.add(Math.max(this.t, issue), 'stair_foot', 'queue', 'waiting for the ration at the Terrace depot', 'terrace'); this.dispute('stair_foot', 'terrace'); this.add(this.t + 0.3 + this.r.next(), 'stair_foot', 'queue', 'in the ration queue', 'terrace'); }
    // the camp's day is shared out (C, lives.json camp_women_needed): bakers bake; the others grind, fetch water, bring the
    // gang its bread at midday or carry the flour up from the depot (all performed with the slice's poses)
    const kind = baker ? (this.r.chance(L.camp_women_needed.bakers_bake) ? 'bake' : 'grind') : this.choose(L.camp_women_needed.tasks as Record<'grind' | 'bread' | 'flour', number>);
    if (kind === 'bake') { if (this.t < t0 + 1) this.add(t0 + 1, 'oven', 'knead', 'kneading dough for the gang', 'terrace'); if (this.t < t0 + 3.5) this.add(t0 + 3.5, 'oven', 'bake', 'baking bread for the gang', 'terrace'); this.workBlock('querns', 'terrace', 'grind', 'grinding flour for tomorrow', this.t, t1, true, 'work_hearth'); }
    else if (kind === 'bread') { const site = C.build.flute !== null && this.r.chance(0.5) ? colPlace(C.build.flute) : 'worksite';
      this.workBlock('querns', 'terrace', 'grind', 'grinding grain', Math.max(this.t, t0), 11.2, true, 'work_hearth'); this.add(11.3, 'oven', 'carry_bread', 'fetching the baked bread', 'terrace'); this.add(11.9, site, 'carry_bread', 'bringing the gang its bread at midday', 'terrace');
      this.add(12.6, 'work_hearth', 'eat', 'midday meal', 'terrace'); this.workBlock('querns', 'terrace', 'grind', 'grinding grain', this.t, t1, true, 'work_hearth'); }
    else if (kind === 'flour') { this.add(Math.max(this.t, t0) + 0.2, 'querns', 'grind', 'grinding grain', 'terrace'); for (let k = 0; k < 3; k++) { this.add(this.t + 0.3, 'stair_foot', 'walk', 'down to the depot for flour', 'terrace'); this.add(this.t + 0.35, 'querns', 'carry_sack', 'carrying a sack of flour up to the camp', 'terrace'); }
      this.workBlock('querns', 'terrace', 'grind', 'grinding grain', this.t, t1, true, 'work_hearth'); }
    else { const trips = C.heatRest ? 3 : 2; const span = (t1 - Math.max(this.t, t0)) / (trips + 1);
      for (let k = 0; k < trips; k++) { this.workBlock('querns', 'terrace', 'grind', 'grinding grain', Math.max(this.t, t0), Math.max(this.t, t0) + span * 0.8, true, 'work_hearth'); if (this.t < 12 || this.t > 15 || !C.heatRest) { this.add(this.t + 0.25, 'water', 'draw_water', 'fetching water for the camp', 'terrace'); this.add(this.t + 0.2, 'work_hearth', 'carry_jar_head', 'carrying water to the work camp', 'terrace'); } }
      this.workBlock('querns', 'terrace', 'grind', 'grinding grain', this.t, t1, true, 'work_hearth'); }
    this.endOfWork('work_hearth', 'terrace', issue !== undefined); return this.finish();
  }
  /** children of 5-13 (lives.json children; C). The younger ones go with the mother on her outings (the queue, kin, the
   *  harvest) and help or play beside her by age; from about seven children have chores morning and afternoon (water,
   *  minding the little ones, dung and brushwood for the fire, grinding with the women, errands); boys of the plain take
   *  the household's animals out; Persian boys learn to ride and shoot (HDT 1.136, a Greek claim); the rest is play.
   *  Children sleep at night, and what a child does is what its reason says */
  private child(): Seg[] {
    const P = this.P, p = this.p, d = this.d, r = this.r, C = this.C; const mem = P.membersOn(this.hh.id, d); const girl = p.sex === 'f', age = p.age;
    const m = p.mother >= 0 && mem.includes(p.mother) ? p.mother : mem.find(x => x !== this.pid && P.persons[x].sex === 'f' && P.persons[x].age >= 14 && P.persons[x].job !== 'child') ?? -1;
    /** what the child does beside its mother, by her activity and its age */
    const beside = (s: Seg): [ActivityId, string] => {
      const a = s.act;
      if (a === 'sleep') return ['sleep', 'asleep'];
      if (a === 'lie_ill') return ['rest', 'sitting with the sick mother'];
      if (a === 'eat') return ['eat', /nurs/.test(s.why) ? 'eating while the mother nurses the baby' : 'eating with the mother'];
      if (/nurs/.test(s.why)) return ['play', 'playing near the mother while she nurses the baby'];
      if (s.where === 'road' || a === 'walk') return a === 'carry_sack' && age >= 9 ? ['carry_sack', 'helping to carry the load'] : a === 'carry_jar_head' && age >= 7 ? ['carry_jar_head', 'carrying a small jar of water home'] : ['walk', 'walking with the mother'];
      if (a === 'queue') return ['queue', 'in the queue with the mother'];
      if (a === 'reap') return age >= 8 ? ['field_work', 'gleaning and gathering the cut stalks behind the reapers'] : ['play', 'playing at the edge of the field while the household reaps'];
      if (a === 'thresh') return age >= 8 ? ['field_work', 'gathering the straw on the threshing floor'] : ['play', 'playing by the threshing floor'];
      if (a === 'pick_fruit') return age >= 7 ? ['pick_fruit', 'picking with the household'] : ['play', 'playing among the trees while the household picks'];
      if (a === 'carry_sack') { const floor = s.place.startsWith('threshing'); return age >= 9 ? ['carry_sack', floor ? 'carrying sheaves with the mother' : 'helping the mother carry the load'] : ['play', floor ? 'playing by the threshing floor' : 'playing near the mother while she carries the loads']; }
      if (a === 'grind') return girl && age >= 8 ? ['grind', 'grinding beside the mother'] : ['play', 'playing near the mother while she grinds'];
      if (a === 'draw_water') return age >= 7 ? ['draw_water', 'drawing water with the mother'] : ['play', 'playing by the well'];
      if (a === 'spin' || a === 'weave') return girl && age >= 8 ? ['spin', 'spinning beside the mother'] : ['play', 'playing near the mother'];
      if (a === 'wash') return age >= 8 ? ['wash', 'helping with the washing'] : ['play', 'playing by the water'];
      if (a === 'knead' || a === 'bake') return girl && age >= 9 ? [a, a === 'knead' ? 'helping to knead the dough' : 'helping with the baking'] : ['play', 'playing near the oven'];
      return ['play', a === 'talk' || a === 'exchange' ? 'playing nearby while the mother talks' : 'playing near the mother'];
    };
    const firstEat = (ms0: Seg[]) => ms0.find(s => s.act === 'eat')?.t0 ?? 7;
    const follow = (ms: Seg[], camp: boolean, fe0?: number) => { const fe = fe0 ?? firstEat(ms); for (const s of ms) { let [a, why] = beside(s); let place = s.place; let w = m;
        let wh = s.where;
        if (s.t1 <= fe && age < 10 && s.act !== 'eat' && (!camp || s.place === this.home)) { a = 'sleep'; why = 'asleep'; if (s.place !== this.home) { place = this.home; wh = this.homeW; w = -1; } }
        else if (/ in the night/.test(s.why)) { a = 'sleep'; why = 'asleep'; }
        const prev = this.segs[this.segs.length - 1]; if (/nurs/.test(s.why) && prev?.act === 'sleep' && prev.place === place) { a = 'sleep'; why = prev.why; } // sleeps on while she feeds the baby
        // at the work camp the child stays by the querns among the other women while its mother goes down for flour, for
        // the gang's bread or for water (C)
        if (camp && s.where === 'terrace' && ['walk', 'carry_sack', 'carry_bread', 'carry_jar_head', 'draw_water'].includes(s.act)) { a = 'play'; why = 'playing by the querns with the other camp children while the mother fetches and carries'; place = 'querns'; w = -1; }
        else if (camp && s.where === 'terrace' && !['sleep', 'eat', 'walk', 'play', 'queue'].includes(a)) { a = 'play'; why = 'playing near the mother at the work camp'; }
        const last = this.segs[this.segs.length - 1]; this.add(s.t1, place, a, why, wh, !!last && (last.why !== why || (last.with ?? -1) !== w));
        const L0 = this.segs[this.segs.length - 1]; if (w >= 0) L0.with = w; else delete L0.with; } return this.segs; };
    const keptBy = (ms: Seg[], blocks: [number, number][], kw: number, KH: Household, who = 'a kinswoman') => {
      const kwh: Where = KH.zone === 'plain' ? 'plain' : 'town', walk = Math.min(0.2, P.walkH(this.home, KH.home, d, this.homeW, kwh)), fe = firstEat(ms), done = new Set<number>();
      for (const s of ms) { const b = blocks.find(([x, y]) => s.t0 >= x - 1e-6 && s.t1 <= y + 1e-6);
        if (!b) { follow([s], false, fe); continue; }
        if (done.has(b[0])) continue; done.add(b[0]);
        this.add(b[0] + walk, `road:${this.homeW}`, 'walk', `taken to ${who}’s house`, 'road');
        this.add(b[1] - walk, KH.home, 'play', `at ${who}’s house while the mother works, playing with her children`, kwh, true); this.segs[this.segs.length - 1].with = kw;
        this.add(b[1], `road:${this.homeW}`, 'walk', 'fetched home by the mother', 'road'); }
      return this.segs; };
    if (m >= 0 && P.persons[m].job === 'camp' && p.agent >= 0) { // the slice's camp children go up with their mothers (Phase 3)
      const ms = P.plan(m, d); if (ms.some(s => s.where === 'terrace')) return follow(ms, true);
    }
    // younger children go with their mother when she goes out: the ration queue, kin, the harvest (lives.json children)
    if (m >= 0 && age <= 10 && p.agent < 0) { const ms = P.plan(m, d);
      const outing = ms.some(s => s.act === 'queue' || s.act === 'reap' || s.act === 'thresh' || s.act === 'pick_fruit' || (s.act === 'talk' && s.place.startsWith('h:') && s.place !== this.home));
      if (outing && r.chance(L.children.with_mother_on_her_outings)) return follow(ms, false);
      if (age < L.children.minded_until_age && !this.C.wx.storm) { // the mother's working hours away from home (2 h or more)
        const blocks: [number, number][] = []; let a0 = -1; for (const s of ms) { if (s.place !== this.home) { if (a0 < 0) a0 = s.t0; } else if (a0 >= 0) { if (s.t0 - a0 >= 2) blocks.push([a0, s.t0]); a0 = -1; } }
        const away: number[] = []; for (const [x, y] of blocks) for (let h = x + 0.25; h < y; h += 0.5) away.push(h);
        if (away.length && ms.some(s => s.place !== this.home && s.where !== 'road' && !['talk', 'eat', 'rest', 'queue', 'exchange', 'sleep'].includes(s.act))) {
          const minder = mem.some(x => { if (x === this.pid || x === m || P.persons[x].age < 14 || P.persons[x].job === 'guard' || P.sick(x, d)) return false; const xs = P.plan(x, d); return away.filter(h => segAt(xs, h).place === this.home).length >= 0.7 * away.length; });
          if (!minder) {
            const homeThrough = (y: number, yh: string) => P.plan(y, d).every(g => blocks.every(([x, z]) => g.t1 <= x || g.t0 >= z || g.place === yh)); // at home for the whole of every absence
            let kw = -1, KH: Household | null = null;
            for (const k of this.hh.kin) { const H = P.households[k]; if (H.zone !== this.hh.zone || H.q !== this.hh.q || H.id === this.hh.id) continue;
              const x = P.membersOn(H.id, d).find(y => P.persons[y].sex === 'f' && P.persons[y].age >= 14 && P.persons[y].job !== 'guard' && !P.sick(y, d) && homeThrough(y, H.home)); if (x !== undefined) { kw = x; KH = H; break; } }
            const terrace = ms.some(s => s.where === 'terrace') && P.persons[m].job !== 'camp'; let who = 'a kinswoman';
            if (kw < 0 && terrace) { const women = P.quarters[this.hh.q]?.women ?? []; const k0 = Math.floor(u01(P.seed, S.assign, 8800 + this.pid, d) * women.length);
              for (let i = 0; i < Math.min(40, women.length) && kw < 0; i++) { const y = women[(k0 + i) % women.length]; const H = P.households[P.home(y, d)];
                if (H.id === this.hh.id || H.zone !== this.hh.zone || !P.present(y, d) || P.sick(y, d) || P.persons[y].job === 'guard') continue; if (homeThrough(y, H.home)) { kw = y; KH = H; who = 'a neighbour'; } } }
            if (kw >= 0 && KH && (terrace || r.chance(L.children_under_five.left_with_minder))) return keptBy(ms, blocks, kw, KH, who);
            return follow(ms, P.persons[m].job === 'camp'); } } } }
    const q = this.hh.q, l = `lane:${q}`, W = this.homeW, CH = L.children.chores; const inside = C.wx.wet || C.wx.dust;
    const little = mem.find(x => x !== this.pid && P.persons[x].age <= 2);
    this.morning(this.rise() + 0.8 + r.next() * 0.6, true);
    /** a chore (lives.json children.chores) */
    const chore = (until: number) => {
      if (this.t >= until - 0.4) return;
      const k = this.choose({ water: inside ? CH.tasks.water * 0.3 : CH.tasks.water, mind_baby: little !== undefined ? CH.tasks.mind_baby : 0, fuel: inside ? 0 : CH.tasks.fuel, grind: girl && age >= 8 ? CH.tasks.grind : 0, errand: inside ? 0 : CH.tasks.errand });
      if (k === 'water') this.well(this.t + 0.3, 'fetching water for the household');
      else if (k === 'mind_baby') this.atHome(Math.min(until, this.t + r.range(1, 2.2)), 'rest', 'minding the baby at home');
      else if (k === 'fuel') { const o = this.hh.zone === 'plain' ? `outside:${q}` : 'outside'; this.go(o, W, 'out for fuel'); this.add(this.t + r.range(0.8, 1.6), o, 'gather', 'gathering dung and brushwood for the fire', W); this.go(this.home, W, 'carrying the fuel home', 'carry_sack'); }
      else if (k === 'grind') this.atHome(Math.min(until, this.t + r.range(0.6, 1.4)), 'grind', 'grinding with the women');
      else { this.go(l, W); this.add(this.t + r.range(0.3, 0.8), l, 'walk', 'an errand for the household', W); this.go(this.home, W); }
    };
    // boys of the plain take the household's animals out (C); Persian boys learn to ride and shoot (HDT 1.136, B claim)
    if (this.hh.zone === 'plain' && age >= 8 && !girl && !C.wx.wet && r.chance(0.6)) { this.go(`pasture:${q}`, 'plain', 'taking the animals out'); this.add(this.t + r.range(2, 4.5), `pasture:${q}`, 'herd', 'minding the household’s animals', 'plain'); this.go(this.home, W, 'bringing the animals home'); }
    else if (age >= CH.from_age && r.chance(CH.p)) chore(11.5);
    const PB = L.children.persian_boys_training;
    if (!girl && this.hh.persian && age >= PB.ages[0] && age <= PB.ages[1] && !C.wx.wet && r.chance(PB.p)) { const t = `training:${q}`; this.go(t, W, 'to the practice ground'); this.add(this.t + r.range(1.5, 3), t, 'train', 'learning to ride and to shoot with the bow (HDT 1.136)', W); this.go(this.home, W); }
    // the morning's play and the afternoon's, each drawn on its own (lives.json children.choices); rain and dust (W-03) keep
    // children in
    const spell = (until: number) => {
      if (this.t >= until - 0.3) return;
      const k = inside ? 'home' : this.choose(L.children.choices as Record<'lane' | 'friend' | 'water_edge' | 'errand' | 'home', number>);
      const back = (x: string, xw: Where) => Math.max(this.t + 0.2, until - P.walkH(x, this.home, d, xw, W));
      if (k === 'lane') { this.go(l, W); this.add(back(l, W), l, 'play', 'playing in the lane', W); this.go(this.home, W); }
      else if (k === 'friend') { const f = this.visitTarget(); if (f) { this.go(f.place, f.where, 'to a friend’s house'); this.add(back(f.place, f.where), f.place, 'play', `playing at ${f.name}'s house`, f.where); this.go(this.home, W); } else { this.go(l, W); this.add(back(l, W), l, 'play', 'playing in the lane', W); this.go(this.home, W); } }
      else if (k === 'water_edge') { const w = this.hh.zone === 'plain' ? `canal:${q}` : `garden:${q}`; this.go(w, W); this.add(back(w, W), w, 'play', this.hh.zone === 'plain' ? 'playing by the canal' : 'playing by the garden channels', W); this.go(this.home, W); }
      else if (k === 'errand') { this.go(l, W); this.add(this.t + r.range(0.3, 0.8), l, 'walk', 'an errand for the household', W); this.go(this.home, W); this.atHome(until, 'play', 'playing at home'); }
      else this.atHome(until, 'play', inside ? 'playing indoors' : 'playing at home');
    };
    spell(this.hd.noon);
    this.noonAtHome(); this.atHome(Math.max(this.t, C.heatRest ? 15.3 : 13.5 + r.next()), 'rest', C.heatRest ? 'resting through the heat' : 'resting after the meal');
    const eve = Math.min(this.sun.set - 0.8, this.hd.supper - 0.1);
    if (age >= CH.from_age && r.chance(CH.p * 0.6)) chore(eve - 0.3);
    spell(eve);
    this.evening(Math.max(this.t, 15)); return this.finish();
  }
  private terraceWorker(place: string, act: ActivityId, why: string, pm?: [string, ActivityId, string]): Seg[] {
    const P = this.P, C = this.C; if (C.wx.storm) return this.homeDay('storm');
    const [w0, w1] = P.workWindow(C); this.morning(w0 - P.walkH(this.home, 'stair_foot', this.d, this.homeW, 'terrace') - 0.05); this.go('stair_foot', 'terrace', 'going to the Terrace');
    const issue = C.issue.get(this.p.group); if (issue !== undefined) { this.add(Math.max(this.t, issue), 'stair_foot', 'queue', 'waiting for the ration issue', 'terrace'); this.dispute('stair_foot', 'terrace'); this.add(this.t + 0.3 + this.r.next(), 'stair_foot', 'queue', 'in the ration queue', 'terrace'); }
    if (pm && (pm[0] !== place || pm[1] !== act) && this.t < 12 && !C.heatRest) { this.workBlock(place, 'terrace', act, why, Math.max(w0, this.t), 12.6, true, 'work_hearth'); [place, act, why] = pm; } // a different task after the midday meal
    this.workBlock(place, 'terrace', act, why, Math.max(w0, this.t), w1, true, 'work_hearth');
    this.endOfWork('work_hearth', 'terrace', issue !== undefined); return this.finish();
  }
  /** the porters of the Terrace depot who have no detailed agent (lives.json job_tasks.terrace_porter) */
  private terracePorter(): Seg[] {
    // the morning's loads and the afternoon's are whatever comes (lives.json job_tasks.terrace_porter), drawn separately
    const task = (): [string, ActivityId, string] => { const k = this.choose(L.job_tasks.terrace_porter.v as Record<'treasury' | 'camp_flour' | 'site_water' | 'wait', number>);
      return k === 'treasury' ? ['treasury_store', 'carry_sack', 'carrying goods up from the stair foot to the Treasury store'] : k === 'camp_flour' ? ['work_hearth', 'carry_sack', 'carrying flour from the depot to the work camp']
        : k === 'site_water' ? [`h100_wall_${this.C.build.wall}`, 'carry_jar', 'carrying water jars to the building site'] : ['stair_foot', 'rest', 'waiting at the depot for loads']; };
    const [pl, act, why] = task(); return this.terraceWorker(pl, act, why, task());
  }
  private townPorter(): Seg[] {
    const C = this.C; const del = C.deliveries.filter(x => x.place === 'store_town' || x.place === 'royal_store');
    if (!del.length && !C.issue.size) return this.homeDay('no loads at the stores today');
    const t0 = Math.min(...del.map(x => x.t), ...[...C.issue.values()], 16); return this.dayWork(del[0]?.place ?? 'store_town', 'town', 'carry_sack', 'carrying sacks into the storehouse', Math.max(7, t0 - 0.5), Math.min(17, t0 + 4));
  }
  private scribe(): Seg[] {
    const P = this.P, C = this.C, p = this.p; if (p.sub !== 'treasury') return this.scribeTown();
    const t0 = this.sun.rise + 1.3, t1 = 15.5; this.morning(t0 - P.walkH(this.home, 'stair_foot', this.d, this.homeW, 'terrace') - 0.05); this.go('stair_foot', 'terrace', 'going up to the Treasury');
    // the Terrace groups' ration issue is recorded and sealed at the depot (E-01 participants: a scribe seals the tablet)
    const tIssue = [...C.issue.entries()].filter(([g]) => P.groups[g].issuePlace === 'stair_foot').map(([, h]) => h).sort((a, b) => a - b)[0];
    const mine = tIssue !== undefined && (this.d + (p.id & 1)) % 2 === 0;
    if (mine) { this.add(Math.max(this.t, tIssue), 'stair_foot', 'write_tablet', 'recording and sealing the ration issue at the depot', 'terrace'); this.add(this.t + 1.8, 'stair_foot', 'write_tablet', 'sealing the issue tablets', 'terrace'); }
    const filing = C.events.some(e => e.id === 'E-15' && e.place === 'treasury_desk') && (p.id & 1) === 1;
    if (filing) { this.add(Math.max(this.t, 10), 'treasury_desk', 'write_tablet', 'recording issues and payments', 'terrace'); this.add(this.t + 1.2, 'treasury_store', 'write_tablet', 'counting the stock and filing sealed receipts (E-15)', 'terrace'); }
    // the rest of the day (lives.json job_tasks.scribe): the desk; counting in the store; tablets to the official building; letters to the station
    const k = this.choose(L.job_tasks.scribe.v as Record<'desk' | 'store' | 'town' | 'letters', number>);
    if (k === 'store' && this.t < 12) this.workBlock('treasury_store', 'terrace', 'write_tablet', 'counting and recording the goods in the Treasury store', this.t, Math.min(t1, this.t + 2.5), false, 'treasury_desk');
    if ((k === 'town' || k === 'letters') && this.t < 13) { this.workBlock('treasury_desk', 'terrace', 'write_tablet', 'recording issues and payments', this.t, 11, false, 'treasury_desk');
      if (k === 'town') this.errand('official_bldg', 'town', 'write_tablet', 'taking sealed tablets to the official building and copying there', 1.8, 'treasury_desk', 'terrace');
      else this.errand('station', 'town', 'talk', 'handing sealed letters to the road station', 1, 'treasury_desk', 'terrace'); }
    this.workBlock('treasury_desk', 'terrace', 'write_tablet', C.payments.length ? 'recording silver payments at the Treasury' : 'recording issues and payments', Math.max(t0, this.t), t1, false, 'treasury_desk');
    this.go(this.home, this.homeW); this.evening(this.t); return this.finish();
  }
  /** the town's scribes: the desk, and whatever the day brings, in turn among them (C): the ration issue at the storehouse
   *  (E-01), deliveries measured in (E-06), grain to the mill (E-07), a party's halmi at the station (E-21), sealed letters
   *  up to the Treasury (E-20); on a quiet day, counting in the store or copying at the Treasury (lives.json job_tasks.scribe) */
  private scribeTown(): Seg[] {
    const P = this.P, C = this.C, p = this.p, d = this.d, store = p.sub === 'store', desk = store ? 'store_town' : 'official_bldg';
    const turn = (n: number, k = 0) => (p.id + d + k) % n === 0;
    const jobs: [number, string, Where, string, number][] = [];
    const issues = [...C.issue.entries()].filter(([g]) => P.groups[g].issuePlace === 'store_town').map(([, h]) => h);
    if (issues.length && (store || turn(3))) jobs.push([Math.min(...issues), 'store_town', 'town', 'recording the ration issue and sealing its tablets (E-01)', 2]);
    C.deliveries.forEach((x, i) => { if ((x.place === 'store_town' || x.place === 'royal_store') && turn(store ? 2 : 4, i)) jobs.push([x.t, x.place, 'town', 'recording a delivery as it is measured in (E-06)', 1.2]); });
    if (C.milling.length && store && turn(2, 1)) jobs.push([9, 'mill', 'town', 'recording the grain sent to the mill and the flour counted back (E-07)', 1.5]);
    P.parties.forEach((x, i) => { if (x.day === d && !store && turn(3, i)) jobs.push([Math.max(8, Math.min(14, x.hour + 0.5)), 'station', 'town', 'recording a party’s halmi and its travel rations (E-21)', 1]); });
    if (C.couriers.some(x => x.treasury) && !store && turn(3, 2)) jobs.push([Math.max(8, Math.min(13.5, C.couriers.find(x => x.treasury)!.t + 0.5)), 'treasury_desk', 'terrace', 'taking a sealed letter up to the Treasury (E-20)', 1.5]);
    if (!jobs.length) { const k = this.choose(L.job_tasks.scribe.v as Record<'desk' | 'store' | 'town' | 'letters', number>);
      if (k === 'store') jobs.push([9 + this.r.range(0, 3), store ? 'royal_store' : 'store_town', 'town', 'counting the stock with the storekeeper', 2]);
      else if (k === 'town') jobs.push([9 + this.r.range(0, 3), 'treasury_desk', 'terrace', 'copying and checking tablets with the Treasury’s scribes', 2]);
      else if (k === 'letters') jobs.push([8 + this.r.range(0, 5), 'station', 'town', 'sealing letters for the road station', 1]); }
    jobs.sort((a, b) => a[0] - b[0]);
    this.morning(7.5 - P.walkH(this.home, desk, d, this.homeW, 'town') - 0.05); const q = this.rationRun(); this.go(desk, 'town', 'going to work');
    for (const [h, pl, w, why, dur] of jobs) { const walk = P.walkH(desk, pl, d, 'town', w); if (h + dur > 15.5 || h - walk < this.t - 0.5) continue;
      if (pl === desk) { this.workBlock(desk, 'town', 'write_tablet', 'writing and sealing tablets', this.t, h, false); this.add(Math.max(this.t, h) + dur, desk, 'write_tablet', why, 'town'); continue; }
      this.workBlock(desk, 'town', 'write_tablet', 'writing and sealing tablets', this.t, Math.max(this.t, h - walk), false); this.errand(pl, w, 'write_tablet', why, dur, desk, 'town'); }
    this.workBlock(desk, 'town', 'write_tablet', 'writing and sealing tablets', Math.max(7.5, this.t), 15.5, false);
    this.go(this.home, this.homeW, q !== null ? 'carrying the ration home' : 'going home', q !== null ? 'carry_sack' : 'walk'); this.evening(this.t); return this.finish();
  }
  private treasuryWorker(): Seg[] {
    const p = this.p, C = this.C;
    if (p.work === 'treasury_inside' || p.work === 'treasury_store') { // inside the Treasury on the Terrace (abstract: no detailed agent yet)
      const task = (): [string, ActivityId, string] => { const k = this.choose(L.job_tasks.treasury_staff.v as Record<'main' | 'receive' | 'carry', number>);
        if (k === 'receive') return ['treasury_store', 'inspect', C.slaughter.length || this.P.cal.days[this.d - 1]?.slaughter.length ? 'receiving hides at the treasury store (CE-07)' : 'receiving goods at the Treasury store'];
        if (k === 'carry') return ['treasury_inside', 'carry_sack', 'carrying goods between the store and the halls'];
        return [p.sub === 'shiner' ? 'treasury_inside' : 'treasury_store', p.sub === 'shiner' ? 'polish_metal' : 'inspect', p.sub === 'shiner' ? 'shining gold and silver in the Treasury' : p.sub === 'weigher' ? 'weighing silver and goods' : 'keeping the Treasury stores']; };
      if (p.sub === 'weigher' && C.payments.length) return this.terraceWorker('treasury_desk', 'inspect', 'weighing out silver at the Treasury (E-05)', task());
      const [pl, act, why] = task(); return this.terraceWorker(pl, act, why, task());
    }
    const act: ActivityId = p.sub === 'shiner' ? 'polish_metal' : p.sub === 'wood' ? 'work_wood' : p.sub === 'textile' ? 'weave' : 'carry_sack';
    const why = p.sub === 'handler' ? 'handling treasury supplies' : `treasury workshop: ${p.sub === 'shiner' ? 'shining gold and silver' : p.sub === 'wood' ? 'working wood' : 'textiles'}`;
    const k = this.choose(L.job_tasks.treasury_workshop.v as Record<'craft' | 'carry_up' | 'fetch' | 'home' | 'mill', number>);
    if (k === 'home') return this.homeWork(p.sex === 'f' ? 'spin' : act, p.sex === 'f' ? 'spinning at home for the workshop' : `${why} at home`);
    this.morning(7 - this.P.walkH(this.home, p.work, this.d, this.homeW, 'town') - 0.05); const q = this.rationRun(); this.go(p.work, 'town', 'going to the workshop');
    if (k === 'carry_up' && this.t < 11) { this.workBlock(p.work, 'town', act, why, Math.max(7, this.t), 9, false); this.errand('treasury_store', 'terrace', 'carry_sack', 'carrying finished work up to the Treasury store', 1.5, p.work, 'town'); }
    if (k === 'fetch' && this.t < 11) { this.workBlock(p.work, 'town', act, why, Math.max(7, this.t), 8.5, false); this.errand('royal_store', 'town', 'carry_sack', 'fetching materials from the royal stores', 1.3, p.work, 'town'); }
    if (k === 'mill' && this.t < 11) this.errand('mill', 'town', 'grind', 'the group’s turn at the mill', 2.5, p.work, 'town');
    // the afternoon: back at the bench, or an errand drawn on its own (the same alternatives)
    const k2 = this.choose(L.job_tasks.treasury_workshop.v as Record<'craft' | 'carry_up' | 'fetch' | 'home' | 'mill', number>);
    if (k2 !== 'craft' && k2 !== k && this.t < 12.5) { this.workBlock(p.work, 'town', act, why, Math.max(7, this.t), 12.7, false);
      if (k2 === 'carry_up') this.errand('treasury_store', 'terrace', 'carry_sack', 'carrying finished work up to the Treasury store', 1.5, p.work, 'town');
      else if (k2 === 'fetch') this.errand('royal_store', 'town', 'carry_sack', 'fetching materials from the royal stores', 1.3, p.work, 'town');
      else if (k2 === 'mill') this.errand('mill', 'town', 'grind', 'the group’s turn at the mill', 1.5, p.work, 'town');
      else { this.go(this.home, this.homeW, 'taking work home'); this.atHome(15, p.sex === 'f' ? 'spin' : act, p.sex === 'f' ? 'spinning at home for the workshop' : 'finishing the work at home'); } }
    if (this.cur !== this.home) this.workBlock(p.work, 'town', act, why, Math.max(7, this.t), 15, false);
    this.go(this.home, this.homeW, q !== null ? 'carrying the ration home' : 'going home', q !== null ? 'carry_sack' : 'walk'); this.evening(this.t); return this.finish();
  }
  /** a working day at home (outwork) */
  private homeWork(act: ActivityId, why: string): Seg[] {
    this.morning(this.rise() + 1.2, true); this.rationRun(); this.go(this.home, this.homeW); this.atHome(Math.max(this.t, this.hd.noon), act, why); this.noonAtHome();
    this.atHome(Math.max(this.t, 15), act, why); this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
  }
  private storekeeper(): Seg[] {
    const C = this.C; const issues = [...C.issue.entries()].filter(([g]) => this.P.groups[g].issuePlace === 'store_town').map(([, h]) => h);
    const del = C.deliveries.filter(x => x.place === 'store_town' || x.place === 'royal_store'); const count = C.events.some(e => e.id === 'E-15' && e.place === 'store_town');
    this.morning(6.8 - this.P.walkH(this.home, 'store_town', this.d, this.homeW, 'town')); this.go('store_town', 'town', 'to the storehouse');
    if (issues.length) { this.workBlock('store_town', 'town', 'inspect', 'measuring out the monthly rations to the groups (E-01)', this.t, Math.max(...issues) + 2.5, false); }
    for (const x of del) { if (x.t < this.t - 1) continue; if (x.place === 'royal_store') { this.workBlock('store_town', 'town', 'inspect', 'at the storehouse', this.t, Math.max(this.t, x.t - 0.2), false); this.errand('royal_store', 'town', 'inspect', 'receiving a delivery at the royal stores', 1.5, 'store_town', 'town'); }
      else this.workBlock('store_town', 'town', 'inspect', 'receiving and measuring a delivery (E-06)', this.t, Math.max(this.t, x.t) + 1.5, false); }
    if (C.milling.length && this.r.chance(0.5)) this.errand('mill', 'town', 'inspect', 'sending grain to the mill and counting the flour back (E-07)', 1.5, 'store_town', 'town');
    if (count) this.workBlock('store_town', 'town', 'inspect', 'counting the stock with the scribe (E-15)', this.t, this.t + 1.5, false);
    const busy = issues.length || del.length || count; this.workBlock('store_town', 'town', 'inspect', 'keeping the storehouse', this.t, busy ? 16 : 12.5, false);
    this.go(this.home, this.homeW); if (!busy) { this.noonAtHome(); this.homeHours(15.5, 'at home: a quiet day at the stores'); } this.evening(this.t); return this.finish();
  }
  private miller(): Seg[] {
    const k = this.C.milling.length ? 'mill' : this.choose(L.job_tasks.miller.v as Record<'mill' | 'flour_out' | 'grain_in', number>);
    this.morning(7 - this.P.walkH(this.home, 'mill', this.d, this.homeW, 'town') - 0.05); const q = this.rationRun(); this.go('mill', 'town', 'to the mill');
    if (k !== 'mill' && this.t < 11) { this.workBlock('mill', 'town', 'grind', 'grinding at the mill', Math.max(7, this.t), 9, false); this.errand(k === 'flour_out' ? 'store_town' : 'store_town', 'town', 'carry_sack', k === 'flour_out' ? 'carrying flour back to the storehouse' : 'bringing grain from the storehouse to the mill', 1.5, 'mill', 'town'); }
    // the afternoon's own task (C): more grinding, or a load between the mill and the storehouse
    const k2 = this.C.milling.length ? 'mill' : this.choose(L.job_tasks.miller.v as Record<'mill' | 'flour_out' | 'grain_in', number>);
    if (k2 !== 'mill' && k2 !== k && this.t < 12) { this.workBlock('mill', 'town', 'grind', 'grinding at the mill', Math.max(7, this.t), 12.6, false); this.errand('store_town', 'town', 'carry_sack', k2 === 'flour_out' ? 'carrying flour back to the storehouse' : 'bringing grain from the storehouse to the mill', 1.2, 'mill', 'town'); }
    this.workBlock('mill', 'town', 'grind', this.C.milling.length ? 'grinding a consignment of grain for the stores (E-07)' : 'grinding at the mill', Math.max(7, this.t), this.C.milling.length ? 16 : 13.5, false);
    this.go(this.home, this.homeW, q !== null ? 'carrying the ration home' : 'going home', q !== null ? 'carry_sack' : 'walk'); this.evening(this.t); return this.finish();
  }
  private weaver(): Seg[] {
    const k = this.choose(L.job_tasks.weaver.v as Record<'workshop' | 'home' | 'wash' | 'deliver', number>);
    if (k === 'home') return this.homeWork('spin', 'spinning at home for the group');
    if (k === 'wash' && !this.C.wx.wet) { const c = `canal:${this.hh.q}`; this.morning(7 - this.P.walkH(this.home, c, this.d, this.homeW, 'town')); this.rationRun(); this.go(c, 'town', 'to the water'); this.workBlock(c, 'town', 'wash', 'washing and dyeing wool at the water', Math.max(7, this.t), 13, true, c); this.go(this.home, this.homeW); this.evening(this.t); return this.finish(); }
    this.morning(7 - this.P.walkH(this.home, 'ws_textile', this.d, this.homeW, 'town') - 0.05); const q = this.rationRun(); this.go('ws_textile', 'town', 'to the workshop');
    if (k === 'deliver' && this.t < 11) { this.workBlock('ws_textile', 'town', 'weave', 'weaving in the workshop', Math.max(7, this.t), 10, false); this.errand('treasury_store', 'terrace', 'carry_sack', 'carrying finished cloth up to the treasury store', 1.3, 'ws_textile', 'town'); }
    // the afternoon, drawn on its own: the loom, spinning at home, or wool to wash at the water (lives.json job_tasks.weaver)
    const WA = L.job_tasks.weaver.afternoon; const k2 = this.choose({ workshop: WA.workshop, home: WA.home, wash: this.C.wx.wet ? 0 : WA.wash });
    if (k2 !== 'workshop' && this.t < 12.5) { this.workBlock('ws_textile', 'town', 'weave', 'weaving in the workshop', Math.max(7, this.t), 12.7, false);
      if (k2 === 'home') { this.go(this.home, this.homeW, q !== null ? 'carrying the ration home' : 'going home', q !== null ? 'carry_sack' : 'walk'); this.atHome(15, 'spin', 'spinning at home in the afternoon'); this.evening(this.t); return this.finish(); }
      const c = `canal:${this.hh.q}`; this.go(c, 'town', 'to the water'); this.workBlock(c, 'town', 'wash', 'washing and dyeing wool at the water', this.t, 15, true, c); this.go(this.home, this.homeW, q !== null ? 'carrying the ration home' : 'going home', q !== null ? 'carry_sack' : 'walk'); this.evening(this.t); return this.finish(); }
    this.workBlock('ws_textile', 'town', 'weave', 'weaving in the workshop', Math.max(7, this.t), 15, false);
    this.go(this.home, this.homeW, q !== null ? 'carrying the ration home' : 'going home', q !== null ? 'carry_sack' : 'walk'); this.evening(this.t); return this.finish();
  }
  private groom(): Seg[] {
    const C = this.C; const k = this.choose(L.job_tasks.groom.v as Record<'station' | 'water' | 'clean' | 'lead', number>);
    this.morning(this.sun.rise - this.P.walkH(this.home, 'station', this.d, this.homeW, 'town')); this.go('station', 'town', 'to the station stables');
    for (const x of C.couriers) if (x.t > this.t && x.t < 18) { this.workBlock('station', 'town', 'tend_animals', 'tending the relay horses', this.t, x.t, false); this.add(this.t + 0.4, 'station', 'tend_animals', 'a fresh horse for the courier (E-20)', 'town'); }
    // the morning's task and the afternoon's, each drawn on its own (lives.json job_tasks.groom)
    const task = (x: string) => { if (x === 'water' && !C.wx.storm) this.errand('river', 'town', 'tend_animals', 'taking the horses to water at the river', 2, 'station', 'town');
      else if (x === 'lead') this.errand('road:station', 'road', 'walk', 'leading a relay horse along the road', 2, 'station', 'town');
      else if (x === 'clean') this.workBlock('station', 'town', 'clean', 'mucking out the stalls', this.t, this.t + 2, false); };
    task(k); const k2 = this.choose(L.job_tasks.groom.v as Record<'station' | 'water' | 'clean' | 'lead', number>);
    if (k2 !== 'station' && this.t < 13) { this.workBlock('station', 'town', 'tend_animals', 'feeding and tending the horses (grain rations: POTTS2023, B)', this.t, Math.max(this.t, 13.5), false); task(k2); }
    this.workBlock('station', 'town', 'tend_animals', 'feeding and tending the horses (grain rations: POTTS2023, B)', this.t, this.sun.set - 0.5, false);
    this.go(this.home, this.homeW); this.evening(this.t); return this.finish();
  }
  private craftsman(): Seg[] {
    const k = this.choose(L.job_tasks.craftsman.v as Record<'kiln' | 'pigment' | 'clay' | 'deliver' | 'home', number>);
    if (k === 'home') return this.homeWork('craft', 'pigment work at home: grinding colours and mending tools');
    this.morning(7 - this.P.walkH(this.home, 'craft_zone', this.d, this.homeW, 'town') - 0.05); this.go('craft_zone', 'town', 'to the kilns');
    if (k === 'clay' && !this.C.wx.wet) this.errand('clay_pit', 'town', 'craft', 'digging clay by the river', 3, 'craft_zone', 'town');
    if (k === 'deliver' && this.t < 11) this.errand('worksite', 'terrace', 'carry_sack', 'carrying pigment and whitening up to the Terrace works (PW2017: the palette matches the Terrace)', 2, 'craft_zone', 'town');
    const bench = (x: string): [string, string] => x === 'pigment' ? ['craft_zone:pigments', 'making pigments, Egyptian blue among them (PW-PIGMENT2021)'] : ['craft_zone', 'firing the kiln'];
    // the afternoon's task, drawn on its own (C): the kiln and the pigment benches are side by side in Area B (PW2017)
    const CA = L.job_tasks.craftsman.afternoon; const k2 = this.choose({ kiln: CA.kiln, pigment: CA.pigment, deliver: this.C.wx.wet ? 0 : CA.deliver, home: CA.home });
    if (k2 !== k && this.t < 12) { const [pl, why] = bench(k); this.workBlock(pl, 'town', 'craft', why, Math.max(7, this.t), 12.7, false);
      if (k2 === 'deliver') this.errand('worksite', 'terrace', 'carry_sack', 'carrying pigment and whitening up to the Terrace works (PW2017: the palette matches the Terrace)', 2, 'craft_zone', 'town');
      else if (k2 === 'home') { this.go(this.home, this.homeW, 'taking work home'); this.atHome(15.5, 'craft', 'pigment work at home: grinding colours'); this.evening(this.t); return this.finish(); } }
    const [pl, why] = bench(k2 === 'kiln' || k2 === 'pigment' ? k2 : k); this.workBlock(pl, 'town', 'craft', why, Math.max(7, this.t), pl === 'craft_zone' ? 17 : 16, false);
    this.go(this.home, this.homeW); this.evening(this.t); return this.finish();
  }
  private official(): Seg[] {
    const P = this.P, C = this.C, p = this.p, r = this.r;
    const stops: [string, Where, ActivityId, string, number][] = [];
    if (C.payments.length) stops.push(['treasury_desk', 'terrace', 'talk', 'declaring a payment at the Treasury (PT: "X declares")', 1]);
    if (C.deliveries.some(x => x.place === 'store_town')) stops.push(['store_town', 'town', 'inspect', 'inspecting a delivery at the storehouse', 1]);
    if (C.couriers.length) stops.push(['official_bldg', 'town', 'talk', 'letters from the road station', 1]);
    if (P.cal.construction.log.some(e => e.day === this.d - 1 && (e.kind === 'shaft_complete' || e.kind === 'capital_set' || e.kind === 'fluting_done'))) stops.push(['worksite', 'terrace', 'inspect', 'inspecting the building works', 1]);
    if (P.parties.some(x => x.day === this.d)) stops.push(['station', 'town', 'inspect', 'checking a party’s halmi at the road station', 0.8]);
    if (!stops.length || r.chance(0.5)) { const x = r.pick(['forecourt', 'apadana_hall', 'gate_hall']); stops.push([x, 'terrace', 'inspect', `an inspection round of the ${x.replace('_', ' ')}`, 0.8]); }
    if (!r.chance(0.85)) return this.homeDay('a day at home');
    this.morning(8.2); stops.sort((a, b) => (a[1] === 'terrace' ? 0 : 1) - (b[1] === 'terrace' ? 0 : 1));
    for (const [pl, w, act, why, h] of stops.slice(0, 3)) { if (this.t > 15) break; this.go(pl, w, 'on the way'); this.add(this.t + h + r.next() * 0.5, pl, act, why, w); }
    if (this.t < 14) { this.go('official_bldg', 'town'); this.add(Math.max(this.t + 0.5, 15), 'official_bldg', 'talk', 'at the official building', 'town'); }
    this.go(this.home, this.homeW); this.evening(this.t); return this.finish();
  }
  private messenger(): Seg[] {
    const P = this.P, C = this.C, p = this.p; if ((this.d + p.idx) % 2 === 1) return this.homeDay('not his day at the station');
    this.morning(this.sun.rise + 0.8); this.go('station', 'town', 'to the road station');
    const letters = C.couriers.filter(x => x.t > this.t - 2).sort((a, b) => a.t - b.t);
    for (const x of letters) { if (x.t > 19) break; this.add(Math.max(this.t, x.t), 'station', 'rest', 'waiting at the station for the relay', 'town');
      if (x.treasury) { this.go('stair_foot', 'terrace', 'carrying a sealed letter up to the Treasury'); this.add(this.t + 0.1, 'stair_foot', 'walk', 'climbing the stair', 'terrace'); this.add(this.t + 0.4, 'treasury_desk', 'talk', 'delivering a sealed document', 'terrace'); this.go('station', 'town', 'back to the station'); }
      else { this.go('official_bldg', 'town', 'carrying a letter'); this.add(this.t + 0.3, 'official_bldg', 'talk', 'handing a letter to an official', 'town'); this.go('station', 'town', 'back to the station'); } }
    this.workBlock('station', 'town', this.r.chance(0.5) ? 'talk' : 'rest', 'waiting at the station for the relay', this.t, 19, false, 'station');
    this.go(this.home, this.homeW); this.evening(this.t); return this.finish();
  }
  private shepherd(): Seg[] {
    const P = this.P, C = this.C, p = this.p, d = this.d;
    const drive = P.drives.find(x => d >= x.day && d <= x.day + x.away && (p.id % 3 === 0));
    if (drive) { const out = d - drive.day < drive.away / 2; this.add(this.sun.rise, 'camp:road', 'sleep', 'asleep in camp on the road', 'away'); this.add(this.sun.set, out ? 'road:susa' : 'road:home', 'herd', out ? 'driving the king’s sheep to Susa (E-13)' : 'returning from Susa', 'away'); this.add(this.t + 0.6, 'camp:road', 'eat', 'a meal in camp', 'away'); this.add(24, 'camp:road', 'sleep', 'asleep', 'away'); return this.segs; }
    if (C.slaughter.length && p.id % 4 === 0) return this.dayWork('stockyard', 'town', 'slaughter', 'slaughtering small cattle at the stockyard (E-12)', Math.min(...C.slaughter), Math.min(...C.slaughter) + 3);
    if (p.sub === 'hides' && P.cal.days[d - 1]?.slaughter.length) { this.morning(8); this.go('stockyard', 'town'); this.add(this.t + 0.5, 'stockyard', 'carry_sack', 'loading the hides', 'town'); this.go('treasury_store', 'terrace', 'carrying the hides to the treasury (CE-07)'); this.add(this.t + 0.5, 'treasury_store', 'talk', 'delivering hides to the treasury', 'terrace'); this.go(this.home, this.homeW); this.evening(this.t); return this.finish(); }
    if ([12, 1, 2].includes(C.month) && !C.wx.wet && u01(P.seed, S.shear, p.id, d) < 0.08) return this.dayWork('stockyard', 'town', 'shear', 'shearing the state flock (E-47)', 7, 15);
    if (C.wx.storm) return this.homeDay('storm: the flock kept in');
    const lamb = [10, 11, 12].includes(C.month) && this.r.chance(0.3);
    const J = L.job_tasks.shepherd.v; const pa = `pasture:stockyard:${Math.floor((d + p.id) / J.days_per_pasture) % J.pastures}`; // rotating grazing grounds (C)
    this.morning(this.sun.rise); this.go(pa, 'town', 'taking the flock out'); this.workBlock(pa, 'town', 'herd', 'grazing the state flock', this.t, this.sun.set - 0.5, true, pa);
    this.go('stockyard', 'town', 'bringing the flock in'); if (lamb) this.add(this.t + 1, 'stockyard', 'tend_animals', 'with the ewes at lambing (E-48)', 'town'); this.go(this.home, this.homeW); this.evening(this.t); return this.finish();
  }
  private priest(): Seg[] {
    const C = this.C, p = this.p; this.add(this.sun.rise - 0.6, this.home, 'sleep', 'asleep', this.homeW); this.go('offering_place', 'town', 'to the offering place');
    if (p.idx === this.d % 3) this.add(this.sun.rise + 0.8, 'offering_place', 'offer', 'the lan (the regular offering; performance not attested)', 'town'); else this.add(this.sun.rise + 0.5, 'offering_place', 'talk', 'at the offering place', 'town');
    this.go(this.home, this.homeW); this.atHome(this.t + 0.4, 'eat', 'breakfast');
    if (C.dom === 3 && p.idx === 0) { this.go('store_town', 'town'); this.add(this.t + 0.6, 'store_town', 'queue', 'drawing the monthly lan allocation', 'town'); this.go(this.home, this.homeW, 'carrying the allocation', 'carry_sack'); }
    const off = C.offerings.filter(x => x.id !== 'E-30' && Math.floor(x.t) % 3 === p.idx);
    for (const o of off) { this.go(o.place, 'town', 'going to make an offering'); this.add(this.t + 0.8, o.place, 'offer', o.id === 'E-31' ? `an offering to a named ${o.place}` : `an offering for ${o.god}`, 'town'); this.go(this.home, this.homeW); }
    return this.homeRest();
  }
  private homeRest(): Seg[] { if (this.t < this.hd.noon) this.homeHours(this.hd.noon, 'at home'); this.noonAtHome(); this.homeHours(Math.max(this.t, 15.5), 'at home'); this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish(); }
  private caretaker(): Seg[] {
    const p = this.p, d = this.d;
    if (p.sex === 'm' && (p.id + d) % 10 === 0) { // night duty at the closed palaces, about one night in ten (C)
      this.atHome(this.rise() + 1, 'sleep', 'asleep'); this.atHome(this.t + 0.4, 'eat', 'breakfast'); this.atHome(13, 'rest', 'at home before night duty'); this.atHome(this.t + 0.6, 'eat', 'midday meal');
      this.atHome(Math.max(this.t, this.sun.set - 2.5), 'sleep', 'sleeping before night duty'); this.atHome(this.t + 0.4, 'eat', 'a meal');
      this.go('palaces', 'terrace', 'going up for the night'); this.add(24, 'palaces', 'rest', 'night duty at the closed palaces (awake by the door)', 'terrace'); return this.segs; }
    const yd = p.sex === 'm' && (p.id + d - 1) % 10 === 0 && d > 0 && this.P.present(this.pid, d - 1) ? this.P.plan(this.pid, d - 1) : null;
    if (yd && yd[yd.length - 1].place === 'palaces') { this.add(this.sun.rise, 'palaces', 'rest', 'night duty at the palaces', 'terrace'); this.go(this.home, this.homeW); this.atHome(12, 'sleep', 'sleeping after night duty'); return this.homeRest(); }
    if ((p.id + d) % 5 === 0) { // the lamps, in turn: a day at home, then oil and lamps at dusk (C)
      this.morning(this.rise() + 1.2, true); this.rationRun(); this.go(this.home, this.homeW); this.homeHours(Math.max(this.t, this.hd.noon), 'at home'); this.noonAtHome();
      this.atHome(Math.max(this.t, this.sun.set - 1.4), 'rest', 'at home'); this.go('palaces', 'terrace'); this.add(this.t + 0.6, 'palaces', 'carry_jar', 'carrying oil and lighting the lamps at dusk', 'terrace'); this.go(this.home, this.homeW); this.evening(this.t); return this.finish(); }
    // which palace and what (lives.json job_tasks.caretaker): cleaning, carrying water, sitting at the door as watchman
    const J = L.job_tasks.caretaker; const b = J.buildings[Math.floor(this.r.next() * J.buildings.length)]; const k = this.choose(J.v as Record<'clean' | 'water' | 'watch', number>);
    return this.terraceWorker(`palaces:${b}`, k === 'clean' ? 'clean' : k === 'water' ? 'carry_jar' : 'rest', k === 'clean' ? `cleaning the closed ${b === 'gate' ? 'Gate' : b}` : k === 'water' ? `carrying water to the ${b === 'gate' ? 'Gate' : b}` : `keeping the door of the closed ${b === 'gate' ? 'Gate' : b}`);
  }
  private gardener(): Seg[] {
    const C = this.C, p = this.p, d = this.d; const q = this.hh.q; const canal = `canal:${q}`;
    const turn = (this.hh.id + d) % 6 === 0 && [1, 2, 3, 4, 5, 6, 7].includes(C.month); const nightTurn = turn && [3, 4, 5, 6, 7].includes(C.month) && this.hh.id % 2 === 0; // CE-19: water turns by channel, some at night when the river is low
    if (C.wx.storm || (C.wx.rainH > 3 && !turn)) return this.homeDay('rain: no garden work');
    const g = p.work || `garden:${q}`; this.morning(this.sun.rise + 0.2);
    if (turn && !nightTurn) { this.go(canal, 'town', 'to the channel'); this.dispute(canal, 'town'); this.add(this.t + 2.5, canal, 'irrigate', 'his turn of water from the channel (CE-19)', 'town'); }
    // the morning's work and the afternoon's (lives.json job_tasks.gardener, by season): beds, runnels, trees, produce to
    // the store, dung from the stockyard, silt out of the channel
    const fruit = [4, 5, 6].includes(C.month), estate = g.startsWith('estate:'), trees = `${g}:trees`, store = estate ? this.home : 'royal_store';
    const W = L.job_tasks.gardener.v[C.season] as Record<'beds' | 'channels' | 'trees' | 'produce' | 'manure' | 'clear', number>;
    const block = (t1: number) => {
      if (this.t >= t1 - 0.3) return; const k = this.choose(W);
      if (k === 'channels') { this.go(g, 'town', 'to the garden'); this.workBlock(g, 'town', 'irrigate', 'opening and closing the runnels between the beds', this.t, t1, true, g); }
      else if (k === 'trees') { this.go(trees, 'town', 'to the garden trees'); this.workBlock(trees, 'town', fruit ? 'pick_fruit' : 'garden_work', fruit ? 'picking figs and fruit (E-46)' : C.season === 'winter' ? 'pruning the trees' : 'tending the trees', this.t, t1, true, trees); }
      else if (k === 'clear') { this.go(canal, 'town', 'to the garden channel'); this.workBlock(canal, 'town', 'dig_canal', 'clearing silt from the garden channel', this.t, t1, true, canal); }
      else if (k === 'produce' && t1 - this.t > 2) { this.go(g, 'town', 'to the garden'); this.add(this.t + 1, fruit ? trees : g, fruit ? 'pick_fruit' : 'garden_work', 'gathering produce for the store', 'town');
        this.go(store, estate ? this.homeW : 'town', estate ? 'carrying produce to the estate’s stores' : 'carrying produce to the storehouse (E-10)', 'carry_sack'); this.add(this.t + 0.5, store, 'queue', 'the produce counted in at the store', estate ? this.homeW : 'town');
        this.go(g, 'town', 'back to the garden'); this.workBlock(g, 'town', 'garden_work', 'working the garden beds', this.t, t1, true, g); }
      else if (k === 'manure' && t1 - this.t > 2) { this.go('stockyard', 'town', 'to the stockyard'); this.add(this.t + 0.4, 'stockyard', 'carry_sack', 'filling baskets with dung', 'town'); this.go(g, 'town', 'carrying dung to the beds', 'carry_sack');
        this.workBlock(g, 'town', 'garden_work', 'digging dung into the beds', this.t, t1, true, g); }
      else { this.go(g, 'town', 'to the garden'); this.workBlock(g, 'town', 'garden_work', C.season === 'spring' || C.season === 'autumn' ? 'sowing, hoeing and weeding the beds' : 'hoeing and weeding the beds', this.t, t1, true, g); }
    };
    block(12); this.add(this.t + lerp(L.meals.midday_work_h[0], L.meals.midday_work_h[1], this.r.next()), this.segs[this.segs.length - 1].place, 'eat', C.heatRest ? 'the midday meal in the shade of the trees, then home out of the heat (E-64)' : 'the midday meal in the garden', 'town'); if (!C.heatRest) block(15.5);
    this.go(this.home, this.homeW); this.evening(this.t);
    if (nightTurn) { this.atHome(Math.max(this.t, 22), 'sleep', 'asleep'); this.go(canal, 'town', 'to the channel in the night'); this.dispute(canal, 'town'); this.add(this.t + 1.2, canal, 'irrigate', 'a night turn of water (CE-19: the river is low)', 'town'); this.go(this.home, this.homeW); }
    return this.finish();
  }
  /** a household farms two to four scattered plots (C); the work moves from plot to plot every few days */
  private field(hhId: number) { const plots = 2 + Math.floor(u01(this.P.seed, S.assign, 9000 + hhId) * 3); return `field:${hhId}:${Math.floor((this.d + hhId) / 3) % plots}`; }
  /** the midday of a field day that ended before noon (harvest, threshing, fruit): some rest in the shade by the field
   *  with food brought out, the others eat at home with the household and sleep through the heat (C) */
  private fieldNoon(place: string, T: PTask) {
    const r = this.r, w = this.homeW;
    if ((T.kind === 'reap' || T.kind === 'thresh') && this.p.sex === 'm' && u01(this.P.seed, S.assign, 7900 + this.hh.id, this.d) < 0.35) {
      this.add(this.t + this.hd.nLen, place, 'eat', 'the midday meal in the shade by the field: bread and water brought out', 'plain');
      this.add(Math.min(T.late - 0.3, this.t + r.range(1.5, 3)), place, 'rest', 'resting in the shade by the field through the heat', 'plain'); this.go(this.home, w); return; }
    this.go(this.home, w); this.noonAtHome('the midday meal with the household, back from the field');
    if (this.C.wx.tmax > 30) this.atHome(this.t + r.range(1, 2), 'sleep', 'sleeping through the heat of the day');
  }
  private farmer(): Seg[] {
    const C = this.C, p = this.p, d = this.d, r = this.r, q = this.hh.q; const w: Where = this.homeW; const T = this.hd.task;
    if (C.wx.storm) return this.homeDay('storm');
    if (p.age < 14 && p.sex === 'm') return this.child();
    if (p.sex === 'f' && !T?.all) return this.homemaker(); // girls of the plain do the women's work unless the whole household is out
    if (!T) {
      if (C.season === 'winter' && p.sex === 'm' && this.P.walkH(this.home, 'store_town', d, w, 'town') < 1.5 && r.chance(0.12)) { this.morning(this.rise() + 1); this.go('lane:q_lt_e', 'town', 'walking to the town'); this.add(this.t + 1.5, 'lane:q_lt_e', 'exchange', 'exchanging produce in the town', 'town'); this.go(this.home, w, 'walking home'); this.evening(this.t); return this.finish(); }
      return this.homeDay(C.season === 'winter' ? 'little field work in winter' : 'at home');
    }
    // threshing season (E-43): some days the household's men carry grain to the storehouse in the town (the state share
    // that feeds E-06), some nights one sleeps on the threshing floor to guard the heap (both C)
    if (T.kind === 'thresh' && p.sex === 'm' && p.age >= 16) {
      const u = u01(this.P.seed, S.assign, 7000 + this.hh.id, d); const trip = this.P.walkH(this.home, 'store_town', d, w, 'town');
      if (u < 0.1 && trip < 3) { this.morning(this.sun.rise - 0.2); this.go('store_town', 'town', 'carrying grain to the storehouse in the town', 'carry_sack'); this.add(this.t + 1, 'store_town', 'queue', 'waiting for the grain to be measured and sealed for', 'town'); this.go(this.home, w, 'walking home');
        this.homeHours(Math.max(this.t + 0.5, this.sun.set - 1.5), 'resting after the road'); this.evening(this.t); return this.finish(); }
      if (u < 0.2) { this.morning(T.h0 - this.P.walkH(this.home, T.place, d, w, 'plain') - 0.05); this.go(T.place, 'plain'); this.workBlock(T.place, 'plain', T.act, T.why, Math.max(T.h0, this.t), T.h1, true, T.place);
        this.fieldNoon(T.place, T); this.go(this.home, w); this.atHome(Math.max(this.t + 1.5, Math.min(this.sun.set - 2, this.t + 2.5)), 'sleep', 'sleeping in the afternoon: tonight he sits up by the grain heap'); this.evening(Math.max(this.t, this.sun.set - 1)); this.go(T.place, 'plain', 'out to the threshing floor');
        this.add(Math.max(this.t + 1.5, this.bed() + 0.5), T.place, 'rest', 'sitting up by the threshing floor to guard the grain heap', 'plain'); this.go(this.home, w); return this.finish(); }
    }
    const { act, place, why, h0, h1 } = T;
    this.morning(h0 - this.P.walkH(this.home, place, d, w, 'plain') - 0.05); this.go(place, 'plain', 'to the fields'); if (act === 'irrigate' || act === 'dig_canal') this.dispute(place, 'plain');
    this.workBlock(place, 'plain', act, p.sex === 'f' && act === 'reap' ? 'binding sheaves at the harvest' : why, Math.max(h0, this.t), h1, true, place, 12 + this.hd.habit);
    if (T.kind === 'turn' && this.t < 11) { const f = this.field(this.hh.id); this.go(f, 'plain'); this.workBlock(f, 'plain', 'field_work', 'hoeing and minding the crop', this.t, 11.8, true, f); }
    if (this.t < 12.3) this.fieldNoon(this.cur ?? place, T); else { this.go(this.home, w); if (T.all && !this.segs.some(x => x.act === 'eat' && x.t0 > 10.5)) this.noonAtHome('the midday meal with the household, back from the field'); }
    // the late afternoon, when the heat breaks (CE-14): the household carries sheaves to the threshing floor together at the
    // harvest; the oxen are fed in the ploughing season
    if (T.sheaves && T.late > this.t + 0.5) { this.homeHours(T.late, 'resting through the heat'); this.errand(`threshing:${q}`, 'plain', 'carry_sack', 'carrying sheaves to the threshing floor with the household (E-43)', 1.2, this.home, w); }
    else if (act === 'reap' && T.late > this.t + 0.5 && p.sex === 'm' && r.chance(0.4)) { this.homeHours(T.late, 'resting through the heat'); this.errand(place, 'plain', 'reap', 'binding the last sheaves and gleaning the stubble', 1.3, this.home, w); }
    else if (act === 'plough' && T.late > this.t + 0.5 && r.chance(0.5)) { this.homeHours(T.late, 'resting'); this.atHome(this.t + 1, 'tend_animals', 'feeding and watering the oxen'); }
    this.evening(Math.max(this.t, this.sun.set - 1.2)); return this.finish();
  }
  private servant(): Seg[] {
    const r = this.r, p = this.p; this.morning(this.rise() + 0.5);
    const tasks: [ActivityId, string][] = p.sex === 'f' ? [['grind', 'grinding for the estate household'], ['knead', 'kneading dough'], ['bake', 'baking for the estate'], ['draw_water', 'drawing water for the estate']] : [['carry_jar', 'carrying jars in the estate stores'], ['carry_bread', 'carrying food to the estate workers'], ['talk', 'waiting on the household'], ['draw_water', 'watering the garden beds by hand']];
    let ate = false;
    while (this.t < 17) { const [a, why] = r.pick(tasks); if (a === 'draw_water') this.well(this.t + 0.5, why); else this.atHome(Math.min(17, this.t + r.range(0.8, 2)), a, why); if (!ate && this.t > 12) { ate = true; this.atHome(this.t + 0.5, 'eat', 'midday meal'); } }
    this.evening(this.t); return this.finish();
  }
  private steward(): Seg[] {
    const r = this.r; this.morning(this.rise() + 1); this.add(this.t + 1.5, this.home, 'inspect', 'going over the estate’s gardens and stores', this.homeW);
    if (r.chance(0.35)) { const v = this.visitTarget(); if (v) { this.go(v.place, v.where); this.add(this.t + 1.5, v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, this.homeW); } }
    else if (r.chance(0.3)) { this.go('official_bldg', 'town', 'to the official building'); this.add(this.t + 1.5, 'official_bldg', 'talk', 'estate business at the official building', 'town'); this.go(this.home, this.homeW); }
    return this.homeRest();
  }
  private elder(): Seg[] {
    const r = this.r, p = this.p, C = this.C, W = this.homeW; this.morning(this.rise() + 0.8 + r.next() * 1.2, true); const l = `lane:${this.hh.q}`;
    const plain = this.hh.zone === 'plain', harvest = plain && (C.agri.has('E-41') || C.agri.has('E-42') || C.agri.has('E-43'));
    const inside = C.wx.wet || C.wx.dust; // rain and dust keep the old in
    let lastVisit = '';
    // the morning and the afternoon are each a few of the old people's occupations in turn (lives.json elders.choices);
    // in the plain an old man may also sit out by the household's crop or the threshing floor, or see to the animals
    const one = (until: number) => {
      const E = L.elders; const w = { ...(E.choices as Record<'lane' | 'visit' | 'work' | 'children' | 'errand' | 'rest', number>), fields: plain && p.sex === 'm' ? (harvest ? E.plain.fields_men_harvest : E.plain.fields_men) : 0, animals: plain ? E.plain.animals : 0 };
      if (inside) { w.lane = 0; w.visit = 0; w.errand = 0; w.fields = 0; w.animals /= 2; }
      const k = this.choose(w); const t1 = Math.min(until, this.t + r.range(E.spell_h[0], E.spell_h[1]));
      if (k === 'lane') { this.go(l, W); this.add(Math.max(this.t + 0.3, t1), l, 'talk', 'sitting and talking in the lane', W); this.go(this.home, W); }
      else if (k === 'visit') { const v = this.visitTarget(); if (v && v.place !== lastVisit) { lastVisit = v.place; this.go(v.place, v.where, 'visiting'); this.add(Math.max(this.t + 0.3, t1), v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, W); } else this.atHome(t1, 'talk', 'with the household'); }
      else if (k === 'work') { const g = r.chance(0.5); this.atHome(t1, p.sex === 'f' ? (g ? 'grind' : 'spin') : 'craft', p.sex === 'f' ? (g ? 'light work: a little grinding' : 'light work: spinning') : 'mending baskets and tools'); }
      else if (k === 'children') this.atHome(t1, 'talk', 'minding the grandchildren');
      else if (k === 'fields') { const f = harvest && C.agri.has('E-43') ? `threshing:${this.hh.q}` : this.field(this.hh.id);
        this.go(f, 'plain', 'out to the crop'); this.add(Math.max(this.t + 0.3, t1), f, 'rest', f.startsWith('threshing') ? 'sitting by the threshing floor, watching the grain' : 'sitting out by the crop, keeping the birds off', 'plain'); this.go(this.home, W); }
      else if (k === 'animals') this.atHome(t1, 'tend_animals', 'seeing to the household’s animals');
      else if (k === 'errand') { this.go(l, W); this.add(this.t + r.range(0.4, 1), l, 'exchange', 'a small exchange in the lane', W); this.go(this.home, W); }
      else this.atHome(t1, 'rest', 'resting at home');
    };
    const noon = this.hd.noon; while (this.t < noon - 0.6) one(noon - 0.15);
    this.noonAtHome();
    const [n0, n1] = L.elders.nap_h; this.atHome(this.t + r.range(n0, n1), 'sleep', 'an afternoon sleep');
    const eve = Math.min(this.sun.set - 1, this.hd.supper - 0.15); while (this.t < eve - 0.6) one(eve);
    this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
  }
  private homemaker(): Seg[] {
    const r = this.r, p = this.p, C = this.C, T = this.hd.task; if (p.age < 14) return this.child();
    const wetSoon = (h: number) => C.wx.wet || this.rainIn(this.t, this.t + h) > 0.1;
    // in the plain the harvest, threshing, the vintage and the fruit take the whole household (E-41 ... E-46): she goes
    // out with them, eats with them, and carries sheaves with them when the heat breaks
    if (this.hh.zone === 'plain' && T?.all && !C.wx.storm && u01(this.P.seed, S.assign, 7950 + this.pid, this.d) < L.homemaker.harvest_share) {
      const why = T.kind === 'reap' ? (T.why.startsWith('helping') ? T.why : 'binding sheaves at the harvest') : T.kind === 'thresh' ? 'winnowing on the village floor (E-43)' : T.why;
      this.morning(T.h0 - this.P.walkH(this.home, T.place, this.d, this.homeW, 'plain') - 0.05); this.go(T.place, 'plain', 'to the fields'); this.workBlock(T.place, 'plain', T.act, why, Math.max(T.h0, this.t), T.h1, true, T.place, 12 + this.hd.habit);
      if (this.t < 12.3) this.fieldNoon(T.place, T); else { this.go(this.home, this.homeW); if (!this.segs.some(x => x.act === 'eat' && x.t0 > 10.5)) this.noonAtHome('the midday meal with the household, back from the field'); }
      const until = T.sheaves ? T.late : Math.max(this.t + 1, T.late);
      this.homeHours(until, 'resting through the heat');
      if (T.sheaves) this.errand(`threshing:${this.hh.q}`, 'plain', 'carry_sack', 'carrying sheaves to the threshing floor with the household (E-43)', 1.2, this.home, this.homeW);
      else { const HA = L.homemaker.harvest_afternoon; const k = this.choose({ grind: HA.grind, weave: HA.weave, lane: wetSoon(1.3) ? 0 : HA.lane });
        const lim = this.hd.supper - 0.15;
        if (k === 'lane' && lim - this.t > 0.8) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(Math.min(lim - 0.1, this.t + r.range(0.6, 1.3)), l, 'talk', 'with the women in the lane', this.homeW); this.go(this.home, this.homeW); }
        else if (lim - this.t > 0.4) this.atHome(Math.min(lim, this.t + r.range(0.8, 1.6)), k === 'weave' ? 'spin' : 'grind', k === 'weave' ? 'spinning' : 'grinding the household’s flour'); }
      if (r.chance(0.6) && !C.wx.wet && this.hd.supper - this.t > 0.75) this.well(this.t + 0.4, 'fetching water'); this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
    }
    this.morning(this.rise() + 2.3, true); this.rationRun(); this.go(this.home, this.homeW);
    const u = r.next(); const l = `lane:${this.hh.q}`; const kids = this.P.membersOn(this.hh.id, this.d).filter(x => x !== this.pid && this.P.persons[x].age < 10).length;
    if (u < 0.3 && !wetSoon(2)) { const v = this.visitTarget(); if (v) { this.go(v.place, v.where, 'visiting'); this.add(this.t + r.range(0.8, 2), v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, this.homeW); } }
    else if (u < 0.45 && !C.short.get(p.group) && !wetSoon(1.2)) { this.go(l, this.homeW); this.add(this.t + r.range(0.5, 1.2), l, 'exchange', 'exchanging goods in kind', this.homeW); this.go(this.home, this.homeW); }
    else if (u < 0.55 && !wetSoon(2) && this.hh.zone !== 'terrace') { const c = `canal:${this.hh.q}`; this.go(c, this.homeW); this.add(this.t + r.range(1, 2), c, 'wash', 'washing clothes at the water', this.homeW); this.go(this.home, this.homeW); }
    if (this.t < this.hd.noon - 0.3) this.homeHours(this.hd.noon, kids ? (kids > 1 ? 'minding the children' : 'minding the child') : 'at home');
    this.noonAtHome(); const sp = r.chance(0.4); this.atHome(Math.max(this.t, 14.5 + r.next()), sp ? 'spin' : 'rest', sp ? 'spinning' : kids ? (kids > 1 ? 'resting and minding the children' : 'resting and minding the child') : 'resting at home');
    if (r.chance(0.5) && !C.wx.wet) this.well(this.t + 0.4, 'fetching water'); this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
  }
  /** a party with a halmi: arrival, the days of its stay, departure (E-21); each day of the stay has its own business (C) */
  private traveller(): Seg[] {
    const P = this.P, p = this.p, d = this.d, r = this.r; const pa = P.parties[p.idx]; const k = d - p.arrive;
    if (d === p.arrive) { this.add(Math.max(0.5, pa.hour - 2.5), '-', 'offmap', `on the road from ${pa.route}, not yet in the plain`, 'away'); this.add(Math.max(this.t + 0.5, pa.hour - 0.5), 'road:arrival', 'walk', `on the road from ${pa.route}`, 'road'); this.add(pa.hour, 'station', 'walk', 'arriving at the road station', 'town'); this.add(this.t + 0.6, 'station', 'queue', 'showing the halmi and drawing travel rations (E-21)', 'town');
      this.add(this.t + 0.8, 'station', 'tend_animals', 'unloading and watering the animals', 'town'); this.add(Math.max(this.t, this.sun.set), 'station', 'rest', 'resting after the road', 'town'); this.add(this.t + 0.6, 'station', 'eat', 'evening meal', 'town'); this.add(24, 'station', 'sleep', 'asleep at the station lodging', 'town'); return this.segs; }
    this.add(this.sun.rise - 0.3 + 0.5 * r.next(), 'station', 'sleep', 'asleep at the station lodging', 'town'); this.add(this.t + 0.3 + 0.03 * pa.size, 'station', 'eat', 'breakfast with the party', 'town');
    if (d === p.leave) { this.add(this.t + 0.8, 'station', 'tend_animals', 'loading the animals', 'town'); this.add(this.t + 3, 'road:departure', 'walk', 'on the road out of the plain', 'road'); this.add(24, '-', 'offmap', 'gone on toward the next station', 'away'); return this.segs; }
    // the stay (C): each day has its own business. The leader: the official building, then the storehouse, then the
    // Treasury's scribes, in turn; the others: the animals and gear on the first day, then the town's lanes, the stores
    const stops: [string, Where, ActivityId, string][] = p.rank === 1
      ? [['official_bldg', 'town', 'talk', 'business with an official, as the halmi names'], ['store_town', 'town', 'talk', 'settling the party’s rations with the storekeeper'], ['treasury_desk', 'terrace', 'talk', 'with the Treasury’s scribes']]
      : [['station', 'town', 'tend_animals', 'seeing to the animals and the gear'], ['lane:q_pw_n', 'town', 'exchange', 'trading a little in kind in the town'], ['lane:q_lt_e', 'town', 'talk', 'seeing the lower town'], ['store_town', 'town', 'queue', 'drawing the party’s travel rations at the storehouse (E-21: flour and drink by the halmi)']];
    const [pl, wh, a, why] = stops[(k - 1 + p.id) % stops.length];
    this.go(pl, wh, 'on the day’s business'); this.add(this.t + 1.5 + r.next(), pl, a, why, wh); if (a === 'queue') this.go('station', 'town', 'carrying the rations back to the station', 'carry_sack'); else this.go('station', 'town');
    // the rest of the morning and the afternoon, each its own (C): rest (a sleep in the heat), mending the gear, the
    // animals to water at the river, knucklebones, or the town's lanes
    const spell = (until: number) => { if (this.t >= until - 0.3) return; const V = L.travellers_stay.spell; const x = this.choose({ rest: V.rest, gear: V.gear, animals: this.C.wx.wet ? 0 : V.animals, gamble: V.gamble, lane: this.C.wx.wet ? 0 : V.lane });
      if (x === 'gear') this.add(until, 'station', 'craft', 'mending harness, bags and sandals for the road', 'town');
      else if (x === 'animals') { this.go('river', 'town', 'taking the animals to water'); this.add(this.t + 1.2, 'river', 'tend_animals', 'watering the animals at the river', 'town'); this.go('station', 'town'); }
      else if (x === 'gamble') this.add(until, 'station', 'gamble', 'knucklebones at the station', 'town');
      else if (x === 'lane') { this.go('lane:q_lt_e', 'town', 'into the town'); this.add(this.t + 1.2, 'lane:q_lt_e', 'talk', 'talking with townspeople in the lanes', 'town'); this.go('station', 'town'); }
      else this.add(until, 'station', this.C.heatRest && this.t > 11 ? 'sleep' : 'rest', this.C.heatRest && this.t > 11 ? 'sleeping through the heat' : 'resting at the station lodging', 'town');
      if (this.t < until) this.add(until, 'station', 'rest', 'resting at the station lodging', 'town'); };
    spell(12.3); this.add(this.t + 0.5 + 0.02 * pa.size, 'station', 'eat', 'the midday meal with the party', 'town');
    // the party's men share out the stay's errands: a second one in the afternoon (C)
    if (p.rank !== 1) { const [pl2, wh2, a2, why2] = stops[(k + 1 + p.id) % stops.length]; if (pl2 !== pl && pl2 !== 'station') { this.go(pl2, wh2, 'on another errand'); this.add(this.t + 0.8 + r.next(), pl2, a2, why2, wh2); if (a2 === 'queue') this.go('station', 'town', 'carrying the rations back to the station', 'carry_sack'); else this.go('station', 'town'); } }
    if (k >= 2 && r.chance(0.5)) { this.go('store_town', 'town'); this.add(this.t + 0.8, 'store_town', 'queue', 'drawing the next days’ travel rations', 'town'); this.go('station', 'town'); }
    spell(Math.max(this.t + 1, this.sun.set - 1.5));
    this.add(Math.max(this.t, this.sun.set - 0.6), 'station', 'talk', 'with the party', 'town'); this.add(this.t + 0.4 + 0.03 * pa.size, 'station', 'eat', 'the evening meal with the party', 'town');
    const bed = this.bed(), ev = this.choose({ fire: L.travellers_stay.evening.fire, gamble: L.travellers_stay.evening.gamble, lane: this.C.wx.wet ? 0 : L.travellers_stay.evening.lane });
    if (ev === 'lane' && bed - this.t > 1.2) { this.go('lane:q_lt_e', 'town', 'into the town for the evening'); this.add(bed - 0.4, 'lane:q_lt_e', 'talk', 'an evening in the lanes of the lower town', 'town'); this.go('station', 'town', 'back to the station'); }
    else if (bed > this.t + 0.2) this.add(bed, 'station', ev === 'gamble' ? 'gamble' : 'talk', ev === 'gamble' ? 'knucklebones by the fire at the station' : 'talking by the fire with the party', 'town');
    this.add(24, 'station', 'sleep', 'asleep at the station lodging', 'town'); return this.segs;
  }
  /** transhumant herders passing along the plain (E-49): each day a new stretch of the route and a new camp */
  private herderPassing(): Seg[] {
    const p = this.p, k = this.d - p.arrive, b = p.idx; const camp = (i: number) => `camp:band${b}:${i}`, route = `route:band${b}:${k}`;
    const act: ActivityId = p.age < 14 && p.sex === 'f' ? 'walk' : 'herd';
    const noon = (why: string) => { if (this.t < 12) { this.add(12, route, act, why, 'plain'); this.add(12.5, route, 'eat', 'a midday meal of bread and curds by the flock', 'plain'); } };
    if (k === 0) { const band = this.P.bands[b]; this.add(Math.max(0.5, band.hour - 2.5), '-', 'offmap', 'coming down from the hills, not yet in the plain', 'away'); this.add(Math.max(this.t + 0.5, band.hour), 'road:arrival', 'herd', 'coming down into the plain with the flock (E-49)', 'plain'); noon('grazing along the plain edge'); this.add(Math.max(this.t, this.sun.set - 0.5), route, act, 'grazing along the plain edge', 'plain'); this.add(this.t + 0.6, camp(0), 'eat', 'making camp and eating', 'plain'); this.add(24, camp(0), 'sleep', 'asleep in camp', 'plain'); return this.segs; }
    this.add(this.sun.rise - 0.3, camp(k - 1), 'sleep', 'asleep in camp', 'plain'); this.add(this.t + 0.4, camp(k - 1), 'eat', 'breakfast and striking camp', 'plain');
    if (this.d === p.leave) { noon('moving the flock on'); this.add(24, '-', 'offmap', 'gone on out of the plain', 'away'); return this.segs; }
    noon('moving the flock along the plain edge (E-49)'); this.add(this.sun.set - 0.5, route, act, 'moving the flock along the plain edge (E-49)', 'plain'); this.add(this.t + 0.6, camp(k), 'eat', 'making camp and eating', 'plain'); this.add(24, camp(k), 'sleep', 'asleep in camp', 'plain'); return this.segs;
  }
}
/** the plan segment in force at hour h */
export function segAt(segs: Seg[], h: number): Seg { for (const s of segs) if (h < s.t1) return s; return segs[segs.length - 1]; }
