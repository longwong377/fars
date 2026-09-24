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
import { dateOf, REGNAL_DAYS, travellerParties, transfers, transhumantBands, flockDrives, DayCtx, EventCalendar, eventRow, rainHours, rainSpells } from './calendar';
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
  with?: number;
  /** the evidence behind the reason (event ids, sources: out-of-world, for the dev overlay), taken out of the reason text */
  ev?: string;
  /** what the person carries in this part of the day (§9.5; C unless the reason says otherwise) */
  carry?: string;
  /** how the person is dressed against the weather in this part of the day (W-03: the face wrapped against the dust; C) */
  wear?: string }
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
  moved?: 'fostered' | 'nursed' | 'kin';
  /** a nursing child whose mother died: the woman who wet-nurses it (from the day it moves to her house, `marry`) */
  nurse?: number;
  /** the other of a pair of twins */
  twin?: number;
}
export interface Household { id: number; home: string; q: string; zone: 'town' | 'plain' | 'terrace' | 'transient'; xy: [number, number]; persian: boolean; members: number[]; kin: number[]; deaths: number[]; births: number[];
  /** the house plot (town_plots.json id) of a town household, and all its plots when it needs more than one (estates) */
  plot?: string; plots?: string[]; shares?: number[]; need?: number;
  /** after the mother's death: who keeps the house (a kinswoman who moved in, or the eldest daughter), from `keeperFrom` */
  keeper?: number; keeperFrom?: number;
  /** people who join it by marriage during the year (from their `marry` day) */
  joins: number[] }
export interface Group { id: number; kind: string; label: string; members: number[]; issuePlace: string; silver: boolean; head: number; from: number; zone: 'terrace' | 'town' }
export interface SliceSeat { agent: number; role: string; sex: 'm' | 'f'; origin: string; mother?: number; name?: string | null }
export interface PopOpts { court?: boolean; slice?: SliceSeat[] }
/** the main field task of a farming household on a day (shared by its members): what, where, the hours, who goes */
export interface PTask { kind: 'reap' | 'thresh' | 'vintage' | 'fruit' | 'plough' | 'canal' | 'turn' | 'field' | 'other'; act: ActivityId; place: string; why: string; h0: number; h1: number; all: boolean; sheaves: boolean; late: number;
  /** the harvest's afternoon session, after the midday meal and a rest as long as the heat demands (C), or null; and its reason */
  pm?: [number, number] | null; pmWhy?: string;
  /** the season's other men's work (kind 'other': lives.json farm_men_other_work): which option, the tool carried, whether a
   *  son may go along, and what is carried home after it (fodder, fuel) */
  opt?: string; tool?: string; helper?: boolean; carryHome?: string }
/** a transhumant band's shared day (Population.bandDay; E-49, lives.json herders; C) */
export interface BandDay { k: number; leave: number; hour: number; moving: boolean; camp0: number; camp1: number; wake: number; departF: number; depart: number; haltA: number; haltB: number;
  arriveBag: number; arriveFlock: number; supper: number; w1: number; w2: number; w1end: number; baggage: number[]; grazers: number[]; milk: boolean; prev: BandDay | null }
/** a household's day (lives.json meals, household_bread): who eats at home, bread, the shared meal times and lengths */
/** a household's child-minding on a day (Population.mindDay): the minder, each little one's pieces with her (with = the
 *  minder) and the minder's own pieces, written from one schedule */
export interface MindDay { minder: number; little: Map<number, Seg[]>; mine: Seg[]; spans?: [number, number][] }
export interface HDay { eaters: number; women: number[]; bake: boolean; baker: number; breakfast: number; bLen: number; noon: number; nLen: number; supper: number; sLen: number; grindEach: number; birthday: number; task: PTask | null;
  /** the house's child-minder today (the eldest girl of 7-13, else a boy of 8-13, when there are children under five), or -1 */
  minder: number;
  /** a son of 10-13 who goes out to the men's field work today, and the child who carries the midday bread out to them */
  fieldHelper: number; bringer: number;
  /** this morning's kneading and baking, by how many eat and the woman's hand (C) */
  kneadH: number; bakeH: number; slack: number;
  /** the bread is baked this morning before breakfast (the baker is at home then: a homemaker, an elder, the girl who keeps
   *  the house); a baker who goes out to work bakes in the evening for the next day (S7) */
  bakeAM: boolean;
  /** who sees that the house has its water today (the youngest woman at home, else a child, else a man), and how many jars:
   *  about 4 l a head a day, 6 on a hot day, 15 l to a jar (C, D-137) */
  waterer: number; jars: number;
  /** the household's outdoor work was rained off today (dryTask: S1 of shadow review r5) */
  wetOff: boolean;
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
  dispo: salt('dispo'), assign: salt('assign'), shear: salt('shear'), carer: salt('carer'), gen: salt('gen'), mourn: salt('mourn'), dbl: salt('dbl'), fam: salt('fam'), draft: salt('draft'), name: salt('name'), nurse: salt('nurse'), kid: salt('kid'), band: salt('band') };
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
  /** a wife's age from her husband's: Babylonian men married at about 26-32 and women at about 14-20 (ROTH1987, B for
   *  Babylonia), so she is one to twelve years younger (C); without a man in the house, the given range */
  private wifeAge(r: HStream, hh: number, lo: number, hi: number) {
    const m = this.households[hh].members.map(x => this.persons[x]).find(q => q.sex === 'm' && q.age >= 18 && !q.kin && q.job !== 'child');
    return m ? Math.max(lo, Math.min(hi, m.age - Math.round(lerp(1, 12, r.next())))) : this.ageIn(r, lo, hi); }
  /** the surviving children at home of the household's mother (lives.json family): her births from 16-21 on, every 2-4
   *  years, twins in ~1.5 % of maternities; children die at the E-71 rates; daughters who have married have left; nobody
   *  over 19 is generated. Every child knows its mother (C) */
  private kids(hh: number, r: HStream, origin: string, group = -1) {
    const H = this.households[hh], F = L.family;
    const mom = [...H.members].reverse().find(x => { const q = this.persons[x]; return q.sex === 'f' && q.wife === true && q.age >= 15 && q.age <= 50; });
    if (mom === undefined) return;
    const M = this.persons[mom]; const step = (tab: [number, number][], age: number) => { let v = tab[0][1]; for (const [a, x] of tab) if (age >= a) v = x; return v; };
    for (let a = lerp(F.first_birth_age[0], F.first_birth_age[1], r.next()); a <= Math.min(F.last_birth_age, M.age); a += lerp(F.birth_interval_y[0], F.birth_interval_y[1], r.next())) {
      const age = Math.floor(M.age - a); const n = r.chance(F.twins) ? 2 : 1; const pair: number[] = [];
      for (let t = 0; t < n; t++) { const sex: 'm' | 'f' = r.chance(0.5) ? 'm' : 'f';
        if (age > F.home_until_age[sex === 'm' ? 'son' : 'daughter'] || !r.chance(step(F.survival_to_age, age)) || (sex === 'f' && age >= 14 && r.chance(step(F.daughter_married_by_age, age)))) continue;
        pair.push(this.child(hh, sex, age, origin, group, mom)); }
      if (pair.length === 2) { this.persons[pair[0]].twin = pair[1]; this.persons[pair[1]].twin = pair[0]; }
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
      if (fam) { this.person({ sex: 'f', age: this.wifeAge(r, hh, 17, 38), job: 'homemaker', hh, origin: 'Persian' }); this.kids(hh, r, 'Persian'); }
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
        const pid = this.person({ sex: 'm', age: this.ageIn(r, 18, 50), job: 'builder', sub: kinds[k], hh, origin, gang: k, squad: Math.floor(i / 10), rank: i === 0 ? 2 : i % 10 === 1 && !(k === 0 && i === 11) ? 1 : 0, agent: seat?.agent ?? -1, work: 'hall100_site', single: !married });
        if (k === 0 && i < 14) this.persons[pid].squad = 0; // the slice squad: foreman + 12 stonecutters (+ the chief) share one squad
        this.join(g, pid, k === 0 ? 0.8 : 0, i === 0); members.push(pid); this.builders.push(pid); if (seat) this.bySeat.set(seat.agent, pid);
        if (married) { const w = this.person({ sex: 'f', age: this.wifeAge(r, hh, 17, 40), job: 'homemaker', hh, origin }); this.join(famGroups[(i + k) % 3], w, 0.1); this.kids(hh, r, origin, famGroups[(i + k) % 3]); }
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
      if (r.chance(0.6)) { this.person({ sex: 'f', age: this.wifeAge(r, hh, 17, 40), job: 'homemaker', hh, origin }); this.kids(hh, r, origin); } else this.persons[pid].single = true; }
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
      this.person({ sex: 'f', age: this.wifeAge(r, hh, 18, 45), job: 'homemaker', hh, origin }); this.kids(hh, r, origin);
      for (let s = 0, n = job === 'official' ? r.int(1, 3) : r.int(0, 1); s < n; s++) { const age = this.ageIn(r, 14, 50); this.person({ sex: r.chance(0.5) ? 'm' : 'f', age, job: 'servant', hh, origin: r.pick(['Elamite', 'Persian']), single: age < 30 && r.chance(0.7) }); } }
    // ---------------- other state dependants (~1,000): mill, textile, brewery, stables, herdsmen, road station, caretakers, magi
    const stateGroup = (kind: string, label: string, n: number, job: Job, sub: string, sexF: number, work: string, k0: number, silver = false) => {
      const g = this.group(kind, label, 'store_town', silver, 'town');
      for (let i = 0; i < n; i++) { const r = this.rng(k0 - i); const sex = r.chance(sexF) ? 'f' : 'm'; const origin = r.pick(['Persian', 'Elamite', 'Persian']);
        const hh = this.hh(this.pickQuarter(r), 'town', origin === 'Persian'); const pid = this.person({ sex, age: this.ageIn(r, 16, 50), job, sub, hh, origin, work }); this.join(g, pid, r.next() * 0.6, i === 0);
        if (sex === 'm') { this.person({ sex: 'f', age: this.wifeAge(r, hh, 17, 40), job: 'homemaker', hh, origin }); } this.kids(hh, r, origin, sex === 'f' ? g : -1); }
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
      if (r.chance(0.6)) { this.person({ sex: 'f', age: this.wifeAge(r, hh, 17, 36), job: 'homemaker', hh, origin }); this.kids(hh, r, origin); } }
    stateGroup('men', 'the palace caretakers and lamp keepers', 30, 'caretaker', '', 0.3, 'palaces', -6700);
    for (let i = 0; i < 3; i++) { const r = this.rng(-6800 - i); const hh = this.hh('q_north', 'town', true); const pid = this.person({ sex: 'm', age: this.ageIn(r, 30, 60), job: 'priest', hh, origin: 'Persian', idx: i, work: 'offering_place' });
      this.priests.push(pid); this.person({ sex: 'f', age: this.wifeAge(r, hh, 20, 45), job: 'homemaker', hh, origin: 'Persian' }); this.kids(hh, r, 'Persian'); }
    // ---------------- non-state residents of the town (~3,000): garden farmers, estates, craftsmen (C)
    const townTarget = POPD.zones.find((z: any) => z.id === 'town').court_absent.night.spring.w;
    let e = 0; while (this.townCount() < townTarget - 1300) { const r = this.rng(-7000 - e++); const q = this.pickQuarter(r, ['town']); const hh = this.hh(q, 'town', true);
      const f = this.person({ sex: 'm', age: this.ageIn(r, 20, 55), job: 'gardener', hh, origin: 'Persian', work: `garden:${q}` }); this.quarters[q].farmers.push(f);
      this.person({ sex: 'f', age: this.wifeAge(r, hh, 17, 45), job: 'homemaker', hh, origin: 'Persian' }); this.kids(hh, r, 'Persian'); if (r.chance(0.3)) this.person({ sex: r.chance(0.5) ? 'm' : 'f', age: this.ageIn(r, 60, 72), job: 'elder', hh, origin: 'Persian' }); }
    for (let i = 0; i < 14; i++) { const r = this.rng(-7500 - i); const q = i % 2 ? 'q_firuzi' : 'q_gohar'; const hh = this.hh(q, 'town', true);
      this.person({ sex: 'm', age: this.ageIn(r, 30, 60), job: 'steward', hh, origin: 'Persian', work: `estate:${hh}` });
      for (let w = 0, n = r.int(1, 2); w < n; w++) this.person({ sex: 'f', age: this.wifeAge(r, hh, 18, 45), job: 'homemaker', hh, origin: 'Persian' });
      this.kids(hh, r, 'Persian');
      for (let s = 0, n = r.int(10, 24); s < n; s++) { const sx = r.chance(0.5) ? 'm' : 'f'; const age = this.ageIn(r, 14, 55); this.person({ sex: sx, age, job: sx === 'm' && r.chance(0.6) ? 'gardener' : 'servant', hh, origin: r.pick(['Persian', 'Elamite']), work: `estate:${hh}`, single: age < 30 && r.chance(0.7) }); } }
    let c = 0; while (this.townCount() < townTarget) { const r = this.rng(-8000 - c++); const hh = this.hh(r.chance(0.6) ? 'q_pw_n' : this.pickQuarter(r), 'town', r.chance(0.5));
      const origin = r.pick(['Persian', 'Elamite', 'Babylonian', 'Egyptian']); this.person({ sex: 'm', age: this.ageIn(r, 16, 55), job: 'craftsman', hh, origin, work: 'craft_zone' });
      this.person({ sex: 'f', age: this.wifeAge(r, hh, 17, 45), job: 'homemaker', hh, origin }); this.kids(hh, r, origin); }
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
        const w = this.person({ sex: 'f', age: this.wifeAge(r, hh, 16, 45), job: 'homemaker', hh, origin: this.persons[m].origin }); void w;
        this.kids(hh, r, this.persons[m].origin); if (r.chance(0.35)) this.person({ sex: r.chance(0.5) ? 'm' : 'f', age: this.ageIn(r, 58, 75), job: 'elder', hh, origin: this.persons[m].origin });
        n += this.households[hh].members.length; } }
    // ---------------- transients: travelling parties (E-21), transhumant bands (E-49), work-group transfers (E-23)
    for (const pa of this.parties) { const hh = this.hh('station', 'transient', false, 'station');
      for (let k = 0; k < pa.size; k++) { const r = this.rng(-20000 - pa.i * 30 - k); this.person({ sex: 'm', age: this.ageIn(r, 18, 55), job: 'traveller', rank: k === 0 ? 1 : 0, hh, origin: 'Persian', arrive: pa.day, leave: Math.min(REGNAL_DAYS - 1, pa.day + pa.stay), zone: 'transient', idx: pa.i }); } }
    // a transhumant band (E-49) is herding families in their tents (S4 of shadow review r4; lives.json herders, D-150):
    // each tent a man and his wife with their surviving children, now and then an old parent or (in a young man's tent) an
    // unmarried younger brother, until the
    // band has its E-49 number of people (5-40); the eldest tent's man leads it. Was: 80 % men aged 10-55, no small child,
    // no girl, no elder (C)
    for (const b of this.bands) { const hh = this.hh(`band${b.i}`, 'transient', true, `camp:band${b.i}`), HB = L.herders, F = L.family; this.bandHH[b.i] = hh;
      const base = { job: 'herder' as Job, hh, origin: 'Persian', arrive: b.day, leave: Math.min(REGNAL_DAYS - 1, b.day + b.stay), zone: 'transient' as const, idx: b.i };
      let n = 0; const add = (x: Partial<Person> & { sex: 'm' | 'f'; age: number }) => { if (n >= b.size) return -1; n++; return this.person({ ...base, ...x }); };
      for (let tent = 0; n < b.size && tent < 40; tent++) { const r = this.rng(-30000 - b.i * 50 - tent);
        const man = this.ageIn(r, 22, 50), wifeAge = Math.max(16, Math.min(45, man - Math.round(lerp(2, 10, r.next()))));
        add({ sex: 'm', age: man, squad: tent, rank: tent === 0 ? 1 : 0 }); const mom = add({ sex: 'f', age: wifeAge, squad: tent });
        if (r.chance(HB.tent_extra.elder)) add({ sex: r.chance(0.5) ? 'm' : 'f', age: Math.min(72, man + this.ageIn(r, 20, 28)), squad: tent });
        // (an unmarried younger brother: only in a young man's tent, 3-12 years younger and 16 or more)
        if (man <= 34 && r.chance(HB.tent_extra.brother)) add({ sex: 'm', age: Math.max(16, man - this.ageIn(r, 3, 12)), squad: tent });
        if (mom < 0) continue;
        for (let a = lerp(17, 20, r.next()); a <= Math.min(F.last_birth_age, wifeAge); a += lerp(F.birth_interval_y[0], F.birth_interval_y[1], r.next())) { const age = Math.floor(wifeAge - a), sex: 'm' | 'f' = r.chance(0.5) ? 'm' : 'f';
          const survive = (F.survival_to_age as [number, number][]).reduce((v, [x, s]) => age >= x ? s : v, 1);
          if (age > (sex === 'm' ? 17 : 15) || !r.chance(survive)) continue; add({ sex, age, squad: tent, mother: mom }); } } }
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
    this.bereaved();
  }
  /** the fostered nurslings of a wet nurse */
  private nursedBy = new Map<number, number[]>();
  /** the children a woman nurses on a day: her own of two or under at home, and a motherless one she wet-nurses */
  nurslings(pid: number, d: number) {
    const own = this.childrenOf(pid).filter(c => { const q = this.persons[c]; return this.ageOn(c, d) <= 1 && this.present(c, d) && d >= q.born && this.home(c, d) === this.home(pid, d); });
    const fos = (this.nursedBy.get(pid) ?? []).filter(c => d >= this.persons[c].marry && this.present(c, d) && this.home(c, d) === this.home(pid, d)); return [...own, ...fos]; }
  /** a household whose mother dies (C, Q-142). Her nursing child goes to a wet nurse: a woman of the kin or the quarter
   *  who is nursing her own (wet-nursing is an institution of Mesopotamian law, CH-194: A for Old Babylonia, an analogy
   *  here). When no other woman is left in the house, a kinswoman with no child of her own (an unmarried daughter of a kin
   *  household, or a grandmother whose own house keeps a woman) comes to keep it; failing her, the eldest daughter of nine
   *  or more keeps it */
  private bereaved() {
    const avail = (x: number, d: number) => { const q = this.persons[x]; return this.present(x, d) && q.dies >= REGNAL_DAYS && q.marry >= 1e9 && q.agent < 0 && q.zone !== 'transient'; };
    for (let d = 0; d < REGNAL_DAYS - 2; d++) for (const w of this.lifeByDay[d].deaths) {
      const W0 = this.persons[w]; if (W0.sex !== 'f' || W0.age < 15) continue;
      const hid = this.home(w, d), H = this.households[hid]; if (H.zone !== 'town' && H.zone !== 'plain') continue;
      const kids = this.childrenOf(w).filter(c => { const q = this.persons[c]; return q.dies > d + 1 && q.age < 14 && this.present(c, d + 1) && this.home(c, d + 1) === hid; });
      if (!kids.length) continue;
      const near = (h: number) => this.households[h].zone === H.zone && this.walkH(H.home, this.households[h].home, d, H.zone === 'plain' ? 'plain' : 'town', this.households[h].zone === 'plain' ? 'plain' : 'town') <= 1;
      // the nursing child: to a wet nurse of the kin, else of the quarter
      for (const c of kids) { const q = this.persons[c]; if (q.age > 1 || q.moved) continue;
        const pool = [...H.kin.filter(near).flatMap(k => this.households[k].members), ...(this.quarters[H.q]?.women ?? [])];
        const nu = pool.find(x => { const X = this.persons[x]; return X.sex === 'f' && X.age >= 16 && X.age <= 42 && avail(x, d + 1) && !this.nursedBy.has(x) && this.home(x, d + 1) !== hid
          && this.childrenOf(x).some(k => { const K = this.persons[k]; return K.age === 0 && this.present(k, d + 1) && K.dies > d + 60; }); });
        if (nu === undefined) continue; const NH = this.home(nu, d + 1);
        q.hh2 = NH; q.marry = d + 1; q.moved = 'nursed'; q.nurse = nu; this.households[NH].joins.push(c); (this.nursedBy.get(nu) ?? this.nursedBy.set(nu, []).get(nu)!).push(c); }
      const women = this.membersOn(hid, d + 1).filter(x => x !== w && this.persons[x].sex === 'f' && this.persons[x].age >= 14 && this.persons[x].job !== 'elder');
      if (women.length || kids.every(c => this.persons[c].moved)) continue;
      // the grandmother of the house, if she is still strong, keeps it
      const gm = this.membersOn(hid, d + 1).find(x => x !== w && this.persons[x].sex === 'f' && this.persons[x].job === 'elder' && this.persons[x].age <= 70 && this.persons[x].dies > d + 30 && this.persons[x].agent < 0);
      if (gm !== undefined) { H.keeper = gm; H.keeperFrom = d + 1; continue; }
      // a kinswoman comes to keep the house
      let kw = -1;
      for (const k of H.kin.filter(near)) { const K = this.households[k]; const kmem = this.membersOn(k, d + 1);
        const left = (x: number) => kmem.some(y => y !== x && this.persons[y].sex === 'f' && this.persons[y].age >= 14 && this.persons[y].job !== 'elder');
        const cand = kmem.find(x => { const X = this.persons[x]; return X.sex === 'f' && X.age >= 14 && X.age <= 65 && avail(x, d + 2) && !X.wife && !this.childrenOf(x).some(c => this.persons[c].dies > d) && left(x) && !this.nursedBy.has(x) && x !== K.keeper; });
        if (cand !== undefined) { kw = cand; break; } }
      if (kw >= 0) { const q = this.persons[kw]; q.hh2 = hid; q.marry = d + 2 + Math.floor(u01(this.seed, S.fam, kw, d) * 4); q.moved = 'kin'; H.joins.push(kw); H.keeper = kw; H.keeperFrom = q.marry;
        if (!H.kin.includes(q.hh)) { H.kin.push(q.hh); this.households[q.hh].kin.push(hid); } continue; }
      const girl = kids.filter(c => this.persons[c].sex === 'f' && this.persons[c].age >= 9 && !this.persons[c].moved).sort((a, b) => this.persons[b].age - this.persons[a].age)[0];
      if (girl !== undefined) { H.keeper = girl; H.keeperFrom = d + 1; }
    }
  }
  /** a person's age on a day (the year's birthdays: `age` is the age at the start of the regnal year) */
  ageOn(pid: number, d: number) { const p = this.persons[pid]; return p.born >= 0 ? 0 : p.age + (p.bday >= 0 && d >= p.bday ? 1 : 0); }
  /** days since birth (a child born this year from its birth; otherwise from its birthday, a year being the regnal year's
   *  354 days, so that the first birthday falls on `bday` as `ageOn` counts it) */
  ageDays(pid: number, d: number) { const p = this.persons[pid]; return p.born >= 0 ? d - p.born : p.bday >= 0 ? d - p.bday + REGNAL_DAYS * (p.age + 1) : Math.round(REGNAL_DAYS * (p.age + 0.5)); }
  /** the summer harvest draft: kurtaš of the town's state groups sent to reap on the state fields (lives.json harvest_draft) */
  draftedOn(pid: number, d: number, C: DayCtx) {
    const p = this.persons[pid], H = L.harvest_draft; if (!(C.agri.has('E-41') || C.agri.has('E-42')) || C.wx.storm || this.households[this.home(pid, d)].zone !== 'town' || this.ageOn(pid, d) < 14 || p.group < 0) return false;
    if (!['treasury', 'weaver', 'miller', 'porter', 'homemaker', 'builder'].includes(p.job) || (p.job === 'builder' && p.sub === 'stone') || (p.job === 'porter' && p.sub === 'terrace') || p.agent >= 0) return false;
    return u01(this.seed, S.draft, pid, d) < H.p;
  }
  /** a household of standing (Q-146): an official's, a steward's, a scribe's, a priest's or a storekeeper's, an estate's, or a
   *  Persian guard's, which can spare a boy's work for the schooling Xenophon describes (XEN-CYR 1.2.15) */
  standing(h: number, d: number) {
    return this.membersOn(h, d).some(x => { const q = this.persons[x]; return ['official', 'steward', 'scribe', 'priest', 'storekeeper'].includes(q.job) || (q.job === 'guard' && q.persian); }); }
  /** the keeper of a house on a day (see bereaved) */
  keeperOn(h: number, d: number) { const H = this.households[h]; return H.keeper !== undefined && d >= (H.keeperFrom ?? 1e9) && this.present(H.keeper, d) && this.home(H.keeper, d) === h ? H.keeper : -1; }
  /** the household's day: its shared meal times and their lengths follow real causes (the sun, a baking day, how many eat,
   *  the season, a birthday, the field work of the day); the women share the grinding for everyone who eats (C) */
  hday(h: number, d: number): HDay {
    const key = h * 512 + d; const c = this.hdCache.get(key); if (c) return c; if (this.hdCache.size > 60000) this.hdCache.clear();
    const H = this.households[h], C = this.cal.ctx(d), M = L.meals, hb = L.household_bread;
    const mem = this.membersOn(h, d).filter(x => !this.sick(x, d) || this.ageOn(x, d) < 5);
    const eaters = mem.filter(x => this.persons[x].job !== 'guard' && this.ageOn(x, d) >= 1).length;
    const keeper = this.keeperOn(h, d);
    // the women who grind and bake today: not a woman ill, in mourning or in the days after a birth (S7)
    const women = mem.filter(x => { const q = this.persons[x]; const gb = this.gaveBirth(x, d); return (x === keeper || (q.sex === 'f' && this.ageOn(x, d) >= 12 && q.job !== 'elder')) && !this.sick(x, d) && !this.mourning(x, d) && !(gb >= 0 && gb <= this.postpartumDays(x)) && !this.draftedOn(x, d, C); });
    if (keeper >= 0 && women.includes(keeper)) { women.splice(women.indexOf(keeper), 1); women.unshift(keeper); } // she bakes
    const winter = C.season === 'winter'; const bake = (d + h) % hb.bake_every_days === 0; const task0 = H.zone === 'plain' ? this.ptask(h, d, C) : null, task = task0 ? this.dryTask(task0, C) : null;
    const birthday = mem.find(x => this.persons[x].persian && this.persons[x].age >= 16 && this.persons[x].bday === d) ?? -1;
    let breakfast = C.sun.rise + M.breakfast_after_sunrise_h + (bake ? M.baking_day_later_h : 0);
    const bLen = M.breakfast_h + M.per_eater_h * eaters + (bake ? M.baking_day_longer_h : 0);
    if (task) breakfast = Math.min(breakfast, task.h0 - bLen - (task.all ? 0.3 : 0.2) - 0.3 * u01(this.seed, S.fam, 5000 + h, d, 4)); // a field day: the household eats before its people go out
    const habit = (u01(this.seed, S.assign, 9100 + h) * 2 - 1) * M.house_habit_h;
    const noon = task?.all ? task.h1 + 0.15 : 12 + habit; const nLen = M.midday_home_h + M.per_eater_h * eaters;
    const supper = C.sun.set - M.supper_before_sunset_h - (winter ? M.winter_earlier_h : 0) + (task?.sheaves ? M.harvest_later_h : 0) + habit;
    const sLen = M.supper_h + 1.5 * M.per_eater_h * eaters + (winter ? M.winter_longer_h : 0) + (birthday >= 0 ? M.birthday_longer_h : 0);
    // the child-minder, the son who goes out to the field with the men, the child who carries the bread out (C)
    // (not a son or daughter of 12-13 of the plain who goes out to the harvest or the floor with the household today: S2 r5)
    const kidsIn = mem.filter(x => { const q = this.persons[x]; return this.ageOn(x, d) >= 7 && this.ageOn(x, d) <= 13 && (q.job === 'child' || (q.job === 'farmer' && !(task?.all && this.ageOn(x, d) >= 12))) && !this.sick(x, d) && x !== keeper && q.agent < 0; }).sort((a, b) => this.ageOn(b, d) - this.ageOn(a, d) || a - b);
    const littles = mem.some(x => this.ageOn(x, d) <= 4 && this.persons[x].job === 'child');
    const minder = !littles ? -1 : kidsIn.find(x => this.persons[x].sex === 'f') ?? kidsIn.find(x => this.ageOn(x, d) >= 8) ?? -1;
    const fieldT = task && !task.all && (['plough', 'field', 'canal'].includes(task.kind) || (task.kind === 'other' && !!task.helper));
    const fieldHelper = fieldT && u01(this.seed, S.kid, h, d, 1) < L.children.work.field_helper_p ? kidsIn.find(x => this.persons[x].sex === 'm' && this.ageOn(x, d) >= 10 && x !== minder) ?? -1 : -1;
    const bringer = fieldT && task!.h1 > noon + 0.5 ? kidsIn.filter(x => x !== minder && x !== fieldHelper).slice(-1)[0] ?? -1 : -1;
    // the dough and the oven take longer the more there are to feed; a woman's hand and the day's fire vary (C)
    const u = (k: number) => u01(this.seed, S.fam, 5000 + h, d, k);
    const kneadH = hb.knead_h[0] + hb.knead_per_eater_h * eaters + (u(1) - 0.5) * hb.knead_var_h, bakeH = hb.bake_h[0] + hb.bake_per_eater_h * eaters + (u(2) - 0.5) * hb.bake_var_h;
    const r: HDay = { eaters, women, bake, baker: women[0] ?? -1, breakfast, bLen, noon, nLen, supper, sLen, grindEach: hb.grind_h_per_eater * eaters / Math.max(1, women.length), birthday, task, habit,
      minder, fieldHelper, bringer, kneadH, bakeH, slack: hb.slack_h[0] + (hb.slack_h[1] - hb.slack_h[0]) * u(3), bakeAM: false, waterer: -1, jars: 0, wetOff: !!task0 && !task };
    const homeJobs = ['homemaker', 'elder', 'child', 'farmer'];
    r.bakeAM = bake && r.baker >= 0 && H.zone !== 'terrace' && (homeJobs.includes(this.persons[r.baker].job) || r.baker === keeper);
    if (H.zone === 'town' || H.zone === 'plain') {
      const athome = women.filter(x => (homeJobs.includes(this.persons[x].job) || x === keeper) && this.persons[x].agent < 0).sort((a, b) => this.ageOn(a, d) - this.ageOn(b, d));
      const kid = mem.filter(x => this.ageOn(x, d) >= 8 && this.ageOn(x, d) <= 13 && !this.sick(x, d)).sort((a, b) => this.ageOn(b, d) - this.ageOn(a, d))[0];
      const man = mem.filter(x => this.ageOn(x, d) >= 14 && this.persons[x].job !== 'guard' && !this.sick(x, d))[0];
      // a servant of the house sees to its water before its women and children (S6 of reviewer B, r5; C)
      const serv = mem.filter(x => this.persons[x].job === 'servant' && this.persons[x].agent < 0 && !this.sick(x, d) && this.ageOn(x, d) >= 14).sort((a, b) => (this.persons[a].sex === 'f' ? 0 : 1) - (this.persons[b].sex === 'f' ? 0 : 1) || a - b);
      r.waterer = serv[0] ?? athome[0] ?? women.find(x => this.persons[x].agent < 0) ?? kid ?? man ?? -1;
      r.jars = Math.max(1, Math.min(3, Math.round(eaters * (C.wx.tmax >= 32 ? 6 : 4) / 15 + 0.2))); }
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
    // the household's own lag in the morning (the walk to its plots, its habits: C)
    const lag = 0.45 * u(8);
    // the harvest and the threshing go on after the midday meal and a rest that is as long as the heat makes it: an hour on
    // a cool day, till late afternoon at 38 °C (C; CE-14)
    const pmOf = (h1: number): [number, number] | null => { const a = h1 + 0.8 + lerp(1, 4.5, hot); return late - a >= 0.75 ? [a, late] : null; };
    const windy = (w: number) => w >= L.winnowing.wind_ms;
    if (harvest && (!thresh || (h + d) % 2 === 1)) { // on some days the household helps kin with their harvest (C)
      const H = this.households[h]; const near = H.kin.filter(k => this.households[k].zone === 'plain' && this.walkH(H.home, this.households[k].home, d, 'plain', 'plain') <= 0.75);
      const kin = near.length && u(6) < L.homemaker.kin_help ? near[Math.floor(u(7) * near.length)] : -1; const K = kin >= 0 ? this.households[kin] : null;
      const place = K && K.zone === 'plain' ? `field:${kin}:${Math.floor((d + kin) / 3) % (2 + Math.floor(u01(this.seed, S.assign, 9000 + kin) * 3))}` : field;
      const h1 = end(10, 12.3);
      return { kind: 'reap', act: 'reap', place, why: place !== field ? 'helping kin with their harvest' : `reaping the ${agri.has('E-41') ? 'barley' : 'wheat'} (${agri.has('E-41') ? 'E-41' : 'E-42'})`, h0: rise - 0.1 + lag / 2, h1, all: true, sheaves: u(4) < 0.6, late,
        pm: pmOf(h1), pmWhy: place !== field ? 'helping kin with their harvest, on through the afternoon' : 'reaping again in the afternoon' }; }
    if (thresh) { const h1 = end(10.5, 12.5);
      return { kind: 'thresh', act: 'thresh', place: `threshing:${q}`, why: windy(C.wx.windAM) ? 'threshing and winnowing on the village floor (E-43)' : 'threshing: driving the animals round over the sheaves on the village floor (E-43)', h0: rise + 0.4 + lag / 2, h1, all: true, sheaves: false, late,
        pm: pmOf(h1), pmWhy: windy(C.wx.windPM) ? 'winnowing in the afternoon wind (E-43)' : 'turning the threshed straw; the air is too still to winnow (E-43)' }; }
    if (agri.has('E-50') && (h + C.dom) % 3 === 0) return { kind: 'canal', act: 'dig_canal', place: `canal:${q}`, why: 'clearing the village canal (E-50)', h0: 8, h1: 15, all: false, sheaves: false, late };
    if (agri.has('E-45') && h % 5 < 2 && u(1) < 0.85) { const h1 = end(11, 13); return { kind: 'vintage', act: 'pick_fruit', place: `vineyard:${q}`, why: 'the vintage: picking grapes (E-45)', h0: rise + 0.5 + lag / 2, h1, all: true, sheaves: false, late, pm: pmOf(h1), pmWhy: 'treading the picked grapes in the press (E-45)' }; }
    if ((agri.has('E-40') || agri.has('E-44')) && !C.wx.wet && u(3) < 0.8) return { kind: 'plough', act: 'plough', place: field, why: agri.has('E-44') ? 'sowing the summer crops (E-44)' : 'ploughing and sowing barley and wheat (E-40)', h0: rise + 0.6 + lag, h1: Math.min(16, C.sun.set - 1.2 - 0.3 * u(9)), all: false, sheaves: false, late };
    if (agri.has('E-46') && h % 2 === 0 && u(2) < 0.7) { const h1 = end(10.5, 12), pm = pmOf(h1); return { kind: 'fruit', act: 'pick_fruit', place: `orchard:${q}`, why: 'picking figs and fruit (E-46)', h0: rise + 0.5 + lag / 2, h1, all: true, sheaves: false, late,
      pm: pm ? [Math.max(pm[0], late - 1.3), late] : null, pmWhy: 'picking the figs that ripened through the day (E-46)' }; }
    if ((h + d) % 6 === 0 && [1, 2, 3, 4, 5, 6, 7].includes(C.month)) return { kind: 'turn', act: 'irrigate', place: `canal:${q}`, why: 'the household’s turn of water from the canal (CE-19)', h0: rise + 0.4 + lag, h1: rise + 3.4 + lag + 0.4 * u(9), all: false, sheaves: false, late };
    // the men's share of the field days (population.json field_fraction_by_sex, S1 of shadow review r4): P5.6's fraction
    // counts the women, who keep the house's work on these days; used as the men's chance it left them idle at home
    const frac = POPD.zones.find((z: any) => z.id === 'plain').field_fraction_by_sex.men[C.season];
    if (u(5) < frac) return { kind: 'field', act: 'field_work', place: field, why: this.fieldWhy(C, u(10)), h0: rise + 0.8 + lag, h1: end(11.5, 14) - 0.4 * u(9), all: false, sheaves: false, late };
    // no field today: the season's other men's work (lives.json farm_men_other_work, C); in winter often a day at home
    const OW = L.farm_men_other_work, w: Record<string, number> = { ...OW.by_month[String(C.month)] };
    const toHarvest = this.harvestIn(d); if (!(toHarvest >= 1 && toHarvest <= OW.opts.floor.before_harvest_d)) w.floor = 0;
    const tot = Object.values(w).reduce((a, b) => a + b, 0); let x = u(11) * tot, k = 'home';
    for (const [kk, v] of Object.entries(w)) { if (x < v) { k = kk; break; } x -= v; }
    if (k === 'home' || !OW.opts[k]) return null;
    const o = OW.opts[k], why = typeof o.why === 'string' ? o.why : o.why[String(C.month)] ?? o.why.other;
    const place = o.place === 'field' ? field : o.place === 'town' ? 'lane:q_lt_e' : `${o.place}:${q}`;
    const h0 = rise + 0.8 + lag, h1 = Math.max(h0 + o.h[0], Math.min(end(11.5, 14) - 0.4 * u(9), h0 + lerp(o.h[0], o.h[1], u(12))));
    return { kind: 'other', opt: k, act: o.act, place, why, h0, h1, all: false, sheaves: false, late, tool: o.tool, helper: !!o.helper, carryHome: o.carry_home };
  }
  /** the day's field task as the weather allows it (S1 of shadow review r5; W-01 "outdoor work stops"; C): outdoor work is
   *  not begun into rain that covers its window. When it is raining as the work would begin, the household waits at home
   *  for the spell to pass and goes out when it has, if a working stretch of at least 1.5 h (and a third of the window) is
   *  left and mostly dry; otherwise, and whenever rain falls through half the window or more, the work is rained off and
   *  the day is spent at home (hday.wetOff). Rain that comes later, in the work, sends the workers home from the field
   *  (Planner.workBlock). Was: only the ploughing had a wet check, so on a February day of steady rain a farmer walked out
   *  an hour into the rain and "sheltered" in his open field for five hours */
  dryTask(T0: PTask, C: DayCtx): PTask | null {
    // after a frost the ground is worked once it has thawed, about two hours after sunrise (the reviewer's quibble on
    // 14498's ploughing at -4 °C, shadow review r5; C); the whole household's harvest and threshing keep their hours
    const T = C.wx.frost && !T0.all && T0.h0 < C.sun.rise + 2 && T0.h1 - (C.sun.rise + 2) >= 1.5 ? { ...T0, h0: C.sun.rise + 2 } : T0;
    const w = C.wx; if (!w.rain) return T; const len = T.h1 - T.h0; if (len <= 0) return T;
    if (rainHours(w, T.h0, T.h1) >= 0.5 * len) return null;
    const sp = rainSpells(w).find(([a, b]) => a <= T.h0 + 0.25 && b > T.h0);
    if (!sp) return T;
    const h0 = sp[1] + 0.2; // they set out once it has cleared (C)
    if (T.h1 - h0 < Math.max(1.5, len / 3) || rainHours(w, h0, T.h1) > 0.3 * (T.h1 - h0)) return null;
    return { ...T, h0, why: T.why, late: T.late };
  }
  /** whether anyone of the house but `pid` eats at its breakfast at home: someone whose day keeps them at home in the
   *  morning (a homemaker, an elder, a child, a servant, a woman who grinds and bakes there, anyone ill), not a house of men
   *  who all go out to work before it (S8 of shadow review r5: "(the household eats later)" in a lodging of six builders) */
  breakfasters(h: number, d: number, pid: number) {
    const hd = this.hday(h, d); return this.membersOn(h, d).some(x => { if (x === pid) return false; const q = this.persons[x];
      const a = this.ageOn(x, d); // (a small child goes where the one minding it goes and eats when she does)
      return ['homemaker', 'elder', 'servant', 'steward'].includes(q.job) || (q.job === 'child' && a >= 8) || (a >= 5 && this.sick(x, d)) || (a >= 14 && this.sick(x, d)) || (hd.women.includes(x) && hd.bakeAM && hd.baker === x); }); }
  /** a small child's sleep on a day (children_under_five; C): the hour it wakes (not before its mother is up, shortly before
   *  the household's breakfast), a morning sleep at one (often) or two (now and then), the midday sleep after the midday
   *  meal (longer in the heat, shorter after a morning sleep) and its bedtime after the evening meal. A pure function of the
   *  day, so the one minding it knows when it sleeps (mindDay) */
  toddlerSleep(pid: number, d: number, wakeM: number) {
    const hd = this.hday(this.home(pid, d), d), a = Math.min(4, this.ageOn(pid, d)), u = (k: number) => u01(this.seed, S.kid, pid, d, 40 + k), C = this.cal.ctx(d);
    const bedtime = Math.min(21, hd.supper + hd.sLen + 0.4 + (a >= 3 ? 0.5 : 0)), wakeT = Math.max(wakeM, hd.breakfast - 0.15 - 0.3 * u(0));
    const napAM: [number, number] = u(1) < [0, 0.6, 0.15, 0, 0][a] ? [8.5 + 1.5 * u(2), 0] : [-1, -1]; if (napAM[0] > 0) napAM[1] = napAM[0] + 0.6 + 0.6 * u(3);
    const nap0 = hd.noon + hd.nLen + 0.05, napW: [number, number] = [nap0, nap0 + [2.2, 2.2, 2, 1.6, 1.2][a] + (C.heatRest ? 0.5 : 0) - (napAM[0] > 0 ? 0.7 * (napAM[1] - napAM[0]) : 0)];
    return { bedtime, wakeT, napAM, napW };
  }
  /** a woman's working absences from a house in her plan: her spells away from it of 1.5 h or more with work in them (not
   *  only talk, a meal, rest, the queue, the lane or the road) */
  static workAbsences(segs: Seg[], home: string): [number, number][] {
    const out: [number, number][] = []; let a = -1; const push = (b: number) => { if (b - a >= 1.5 && segs.some(s => s.t0 < b && s.t1 > a && s.where !== 'road' && !['talk', 'eat', 'rest', 'queue', 'gamble', 'exchange', 'play', 'walk', 'shelter', 'sleep'].includes(s.act))) out.push([a, b]); };
    for (const s of segs) { if (s.place !== home) { if (a < 0) a = s.t0; } else if (a >= 0) { push(s.t0); a = -1; } } if (a >= 0) push(24); return out;
  }
  /** the house's child-minder and the little ones she has today (S2 of shadow review r5; lives.json children_under_five,
   *  children; C). Minding is planned from the little one's side: a little one of one to four is with the house's minder (the
   *  eldest girl of 7-13, else a boy of 8-13: hday) (1) through its mother's working absences from home (1.5 h or more),
   *  which the minder spends at home with it, and (2) now and then while the mother works at home at the quern, the spindle,
   *  the loom or the oven (a spell of up to 1.5 h, one in two, C), so that she works unhindered; never through the
   *  household's supper. In the longer spells the minder may take the little ones out to the lane among the other children
   *  for a while (not in rain, dust or storm, not in the E-64 heat, not while one of them sleeps and not at a meal). The
   *  result is both sides' pieces: the little ones' (with = the minder: small()) and the minder's own (child()), written from
   *  one schedule, so the minder "minds" only a little one who is with her, and says "on her hip" only of an awake child of
   *  two or under. Was: "minding the little ones, the youngest on her hip" was a free chore of any girl, written without
   *  looking at the little one's plan (22-31 % of it with no little one at the place, the rest mostly with the mother) */
  mindDay(h: number, d: number): MindDay {
    const key = h * 512 + d; const c0 = this.mindCache.get(key); if (c0) return c0; if (this.mindCache.size > 20000) this.mindCache.clear();
    const out: MindDay = { minder: -1, little: new Map(), mine: [] }; this.mindCache.set(key, out);
    const H = this.households[h], hd = this.hday(h, d), mn = hd.minder; if (mn < 0 || (H.zone !== 'town' && H.zone !== 'plain')) return out;
    const C = this.cal.ctx(d), mem = this.membersOn(h, d), home = H.home, W: Where = H.zone === 'plain' ? 'plain' : 'town', M = this.persons[mn];
    const bfEnd = hd.breakfast + hd.bLen, meals: [number, number][] = [[hd.breakfast - 0.02, bfEnd], [hd.noon, hd.noon + hd.nLen]];
    const kids: { pid: number; sp: [number, number][]; sl: ReturnType<Population['toddlerSleep']> }[] = [];
    for (const k of mem) { const q = this.persons[k], a = this.ageOn(k, d); if (q.job !== 'child' || a < 1 || a > 4 || this.sick(k, d) || q.agent >= 0 || k === mn) continue;
      const mo = q.mother; if (mo < 0 || !mem.includes(mo) || mo === mn || this.persons[mo].job === 'guard' || (this.ageOn(mo, d) < 12 && this.keeperOn(h, d) !== mo)) continue;
      const ms = this.plan(mo, d); const wakeM = ms.find(s => s.t0 > 2 && s.act !== 'sleep' && !/ in the night/.test(s.why))?.t0 ?? 6; const sl = this.toddlerSleep(k, d, wakeM);
      const end = Math.min(hd.supper - 0.05, sl.bedtime - 0.1); const sp: [number, number][] = [];
      for (const [a0, b0] of Population.workAbsences(ms, home)) { const b = Math.min(b0, end); if (b - a0 >= 0.5) sp.push([a0, b]); }
      let n2 = 0; for (const s of ms) { if (n2 >= 3) break; if (s.place !== home || s.where === 'road' || !['grind', 'spin', 'weave', 'knead', 'bake'].includes(s.act) || s.t1 - s.t0 < 0.6) continue;
        const a1 = Math.max(s.t0, bfEnd + 0.05), b1 = Math.min(s.t1, a1 + 1.5, end - 0.05); if (b1 - a1 < 0.5 || sp.some(([x, y]) => x < b1 + 0.05 && y > a1 - 0.05)) continue;
        if (meals.some(([x, y]) => x < b1 && y > a1)) continue;
        if (u01(this.seed, S.kid, 9300 + k, d, Math.floor(s.t0 * 20)) >= L.children_under_five.minder_while_mother_works_p) continue; sp.push([a1, b1]); n2++; }
      if (sp.length) kids.push({ pid: k, sp: sp.sort((x, y) => x[0] - y[0]), sl }); }
    if (!kids.length) return out; out.minder = mn;
    // the one timeline: pieces where the same little ones are with her
    const bounds = [...new Set(kids.flatMap(k => k.sp.flat()))].sort((x, y) => x - y);
    type P0 = { t0: number; t1: number; kids: number[]; place: string; where: Where; kind: 'home' | 'lane' | 'out' | 'back' };
    const pcs: P0[] = [];
    for (let i = 0; i + 1 < bounds.length; i++) { const a = bounds[i], b = bounds[i + 1], mid = (a + b) / 2, ks = kids.filter(k => k.sp.some(([x, y]) => mid >= x && mid < y)).map(k => k.pid);
      if (!ks.length || b - a < 1e-6) continue; const L0 = pcs[pcs.length - 1];
      if (L0 && Math.abs(L0.t1 - a) < 1e-6 && L0.kids.join() === ks.join()) L0.t1 = b; else pcs.push({ t0: a, t1: b, kids: ks, place: home, where: W, kind: 'home' }); }
    // now and then out to the lane with them (C): in a stretch free of their sleep, the meals, rain, dust, storm and the heat
    const lane = `lane:${H.q}`, wk = Math.max(0.03, Math.min(0.12, this.walkH(home, lane, d, W, W))), wx = C.wx;
    const busy: [number, number][] = [...meals, ...kids.flatMap(k => [[0, k.sl.wakeT], k.sl.napAM, k.sl.napW, [k.sl.bedtime, 24]] as [number, number][]).filter(([x, y]) => y > x),
      ...(wx.dustH ? [wx.dustH] : []), ...(wx.stormH ? [[wx.stormH[0] - 0.25, wx.stormH[1] + 0.25] as [number, number]] : []), ...(C.heatRest ? [[11.5, 16.3] as [number, number]] : []),
      [0, Math.max(bfEnd, C.sun.rise + 0.5)], [C.sun.set - 0.8, 24]];
    for (let i = 0; i < pcs.length; i++) { const p = pcs[i]; if (p.kind !== 'home' || p.t1 - p.t0 < 1 || wx.wet) continue;
      const u = u01(this.seed, S.kid, 9400 + h, d, i); if (u >= 0.35) continue;
      // the free stretches of the piece
      let free: [number, number][] = [[p.t0 + 0.1, p.t1 - 0.1]];
      for (const [x, y] of busy) free = free.flatMap(([a, b]) => (y <= a || x >= b) ? [[a, b] as [number, number]] : [[a, Math.min(b, x)], [Math.max(a, y), b]].filter(([m, n]) => n - m > 1e-6) as [number, number][]);
      const f = free.find(([a, b]) => b - a >= 0.6 + 2 * wk && rainHours(wx, a, b) === 0); if (!f) continue;
      const len = Math.min(f[1] - f[0], lerp(0.6, 1.2, u01(this.seed, S.kid, 9400 + h, d, 20 + i)) + 2 * wk), s0 = f[0] + (f[1] - f[0] - len) * u01(this.seed, S.kid, 9400 + h, d, 40 + i), s1 = s0 + len;
      const part = (t0: number, t1: number, kind: P0['kind'], place: string, where: Where): P0 => ({ t0, t1, kids: p.kids, place, where, kind });
      const rep = [part(p.t0, s0, 'home', home, W), part(s0, s0 + wk, 'out', `road:${W}`, 'road'), part(s0 + wk, s1 - wk, 'lane', lane, W), part(s1 - wk, s1, 'back', `road:${W}`, 'road'), part(s1, p.t1, 'home', home, W)].filter(x => x.t1 - x.t0 > 1e-6);
      pcs.splice(i, 1, ...rep); i += rep.length - 1; }
    // both sides' words
    const she = M.sex === 'f' ? 'her' : 'his', rel = M.sex === 'f' ? 'the elder sister' : 'the elder brother';
    const pro = (k: number) => this.persons[k].sex === 'm' ? 'him' : 'her', sib = (k: number) => this.persons[k].mother === M.mother && M.mother >= 0 ? `${she} little ${this.persons[k].sex === 'm' ? 'brother' : 'sister'}` : 'the little one';
    const who = (ks: number[]) => ks.length === 1 ? sib(ks[0]) : 'the little ones', them = (ks: number[]) => ks.length === 1 ? pro(ks[0]) : 'them';
    const asleep = (k: number, t: number) => { const s = kids.find(x => x.pid === k)!.sl; return t < s.wakeT || (t >= s.napAM[0] && t < s.napAM[1]) || (t >= s.napW[0] && t < s.napW[1]) || t >= s.bedtime; };
    const inMeal = (t: number) => meals.find(([x, y]) => t >= x && t < y);
    const age = (k: number) => this.ageOn(k, d), ma = this.ageOn(mn, d);
    for (const p of pcs) {
      const cuts = [...new Set([p.t0, p.t1, ...meals.flat(), ...kids.flatMap(k => [k.sl.wakeT, ...k.sl.napAM, ...k.sl.napW, k.sl.bedtime])].filter(x => x >= p.t0 && x <= p.t1))].sort((x, y) => x - y);
      for (let j = 0; j + 1 < cuts.length; j++) { const a = cuts[j], b = cuts[j + 1]; if (b - a < 1e-6) continue; const mid = (a + b) / 2;
        // the little ones' side
        for (const k of p.kids) { const segs = out.little.get(k) ?? out.little.set(k, []).get(k)!; const walker = age(k) >= 2; let s: Seg;
          if (p.kind === 'out' || p.kind === 'back') s = { t0: a, t1: b, place: p.place, where: 'road', act: walker ? 'walk' : 'rest', why: walker ? `walking along the lane with ${rel}` : `carried along the lane by ${rel}` };
          else if (p.kind === 'lane') s = { t0: a, t1: b, place: p.place, where: p.where, act: 'play', why: `playing in the lane among the other children, ${rel} minding ${pro(k)}` };
          else if (asleep(k, mid)) s = { t0: a, t1: b, place: home, where: W, act: 'sleep', why: mid < 11.5 && mid > 6 ? `a morning sleep, ${rel} minding ${pro(k)}` : mid >= 11.5 && mid < 17 ? `a midday sleep, ${rel} minding ${pro(k)}` : `asleep, ${rel} beside ${pro(k)}` };
          else if (inMeal(mid)) s = { t0: a, t1: b, place: home, where: W, act: 'eat', why: mid < 11 ? `breakfast with ${rel}` : `a meal with ${rel}` };
          else s = { t0: a, t1: b, place: home, where: W, act: 'play', why: `playing at home, ${rel} minding ${pro(k)}` };
          s.with = mn; const Lk = segs[segs.length - 1]; if (Lk && Math.abs(Lk.t1 - a) < 1e-6 && Lk.why === s.why && Lk.place === s.place) Lk.t1 = b; else segs.push(s); }
        // the minder's side: from her breakfast on, not at the meals (she eats with the household)
        if (a < bfEnd - 1e-6 || inMeal(mid)) continue;
        const awake = p.kids.filter(k => !asleep(k, mid)), ks = p.kids; let s: Seg;
        if (p.kind === 'out' || p.kind === 'back') s = { t0: a, t1: b, place: p.place, where: 'road', act: 'walk', why: ks.some(k => age(k) < 2) ? `carrying ${who(ks)} ${p.kind === 'out' ? 'out to the lane' : 'home'}` : `${p.kind === 'out' ? 'out to the lane with' : 'home with'} ${who(ks)}` };
        else if (p.kind === 'lane') s = { t0: a, t1: b, place: p.place, where: p.where, act: ma >= 10 ? 'rest' : 'play', why: `minding ${who(ks)} in the lane among the other children` };
        else if (!awake.length) s = { t0: a, t1: b, place: home, where: W, act: 'rest', why: `minding ${who(ks)} while ${ks.length === 1 ? (this.persons[ks[0]].sex === 'm' ? 'he sleeps' : 'she sleeps') : 'they sleep'}` };
        else if (awake.length === 1 && age(awake[0]) <= 2 && ma >= 10) s = { t0: a, t1: b, place: home, where: W, act: 'rest', why: `minding ${who(ks)}, now on ${she} hip, now playing beside ${them(awake)}` };
        else s = { t0: a, t1: b, place: home, where: W, act: 'play', why: `minding ${who(ks)} in the courtyard, playing with ${them(awake)}` };
        const Lm = out.mine[out.mine.length - 1]; if (Lm && Math.abs(Lm.t1 - a) < 1e-6 && Lm.why === s.why && Lm.place === s.place) Lm.t1 = b; else out.mine.push(s); } }
    // no piece of under two minutes (a nap that ends a moment before the mother comes in): it joins the piece before it at the
    // same place, on both sides alike
    const tidy = (xs: Seg[]) => { for (let i = xs.length - 1; i > 0; i--) { const x = xs[i], pv = xs[i - 1]; if (x.t1 - x.t0 < 0.03 && pv.place === x.place && Math.abs(pv.t1 - x.t0) < 1e-6) { pv.t1 = x.t1; xs.splice(i, 1); } } };
    tidy(out.mine); for (const v of out.little.values()) tidy(v);
    out.spans = kids.flatMap(k => k.sp).sort((x, y) => x[0] - y[0]);
    return out;
  }
  private mindCache = new Map<number, MindDay>();
  /** the man of a threshing household who sits up by its grain heap tonight and sleeps beside it on the floor (S2, r4): on
   *  about one threshing day in ten (the household's draw, the same that sends its men with grain to the town, C) one of its
   *  men of sixteen or more, by turns night by night; not on a storm day, not a man who is ill or in mourning, nor one who
   *  marries or moves today or tomorrow. -1 if none */
  vigilMan(h: number, d: number): number {
    const H = this.households[h]; if (!H || H.zone !== 'plain' || d < 0 || d >= REGNAL_DAYS) return -1;
    if (this.cal.ctx(d).wx.storm) return -1; const T = this.hday(h, d).task; if (!T || T.kind !== 'thresh') return -1;
    const u = u01(this.seed, S.assign, 7000 + h, d); if (!(u < 0.2) || (u < 0.1 && this.walkH(H.home, 'store_town', d, 'plain', 'town') < 3)) return -1;
    // not when it would leave children under ten without a grown woman of the house at home, tonight or after midnight (the
    // soak on D-150's first pass: a widower's child of nine alone at night, a toddler taken to the floor)
    const kids = (dd: number) => this.membersOn(h, dd).some(x => this.ageOn(x, dd) < 10);
    const woman = (dd: number) => this.membersOn(h, dd).some(x => { const q = this.persons[x]; return q.sex === 'f' && this.ageOn(x, dd) >= 14 && q.agent < 0 && ['homemaker', 'elder', 'farmer'].includes(q.job); });
    if ((kids(d) || kids(d + 1)) && !(woman(d) && woman(d + 1))) return -1;
    const men = this.membersOn(h, d).filter(x => { const q = this.persons[x]; return q.job === 'farmer' && q.sex === 'm' && this.ageOn(x, d) >= 16 && q.agent < 0 && !this.sick(x, d) && !this.mourning(x, d) && q.marry !== d && q.marry !== d + 1; }).sort((a, b) => a - b);
    return men.length ? men[(d + h) % men.length] : -1;
  }
  /** where a person slept the night before day d when it was not at home: beside the grain heap on the threshing floor after
   *  a vigil (S2); his day begins there (null otherwise) */
  nightAway(pid: number, d: number): { place: string; where: Where } | null {
    if (d < 1) return null; const p = this.persons[pid]; if (p.job !== 'farmer' || p.sex !== 'm' || !this.present(pid, d - 1)) return null;
    if (this.vigilMan(this.home(pid, d - 1), d - 1) !== pid) return null;
    const segs = this.plan(pid, d - 1), last = segs[segs.length - 1];
    return last.act === 'sleep' && last.place.startsWith('threshing:') ? { place: last.place, where: last.where } : null;
  }
  /** a transhumant band's day (E-49; lives.json herders; S4 of shadow review r4; C), shared by its people: last night's camp
   *  and tonight's (a day in four, and in rain or storm, the band stays where it is), the hours of rising, of the flock's and
   *  the loaded donkeys' setting out, of the midday halt (as long as the heat makes it), of the arrivals at the new camp and
   *  of the evening meal; the two men who watch the flock tonight, by turns (the first until `w1end` after midnight), and
   *  the men who walk with the donkeys (one in four, by turns, and last night's watchmen) */
  bandDay(b: number, d: number): BandDay {
    const key = b * 512 + d; const c = this.bandCache.get(key); if (c) return c; if (this.bandCache.size > 4000) this.bandCache.clear();
    const band = this.bands[b], HB = L.herders, C = this.cal.ctx(d), sun = C.sun, k = d - band.day, leave = Math.min(REGNAL_DAYS - 1, band.day + band.stay);
    const u = (j: number) => u01(this.seed, S.band, b, d, j);
    // a day in four the band stays where it is (never two days running, but for rain or storm), and in rain or storm (C)
    const stays = (j: number): boolean => { const dd = band.day + j; if (j < 1 || dd >= leave) return false; const w = this.cal.ctx(dd).wx; return w.wet || w.storm || (u01(this.seed, S.band, b, dd, 0) < HB.rest_day_p && !stays(j - 1)); };
    let camp1 = 0; for (let j = 1; j <= k && j <= band.stay; j++) if (!stays(j)) camp1++;
    const moving = k >= 1 && !stays(k), camp0 = k === 0 ? -1 : moving ? camp1 - 1 : camp1;
    const hot = C.wx.tmax >= 32 ? 'hot' : C.wx.tmax >= 26 ? 'warm' : 'cool', hl = HB.halt_h[hot] as [number, number];
    const wake = sun.rise - lerp(0.6, 1.1, u(1)), haltA = 11.2 + 0.8 * u(4), haltB = haltA + lerp(hl[0], hl[1], u(5));
    const men = this.membersOn(this.bandHH[b], d).filter(x => this.persons[x].sex === 'm' && this.ageOn(x, d) >= 14 && this.ageOn(x, d) <= 55).sort((a, b2) => a - b2);
    const w1 = d < leave && men.length ? men[(2 * d + b) % men.length] : -1, w2 = d < leave && men.length > 1 ? men[(2 * d + b + 1) % men.length] : -1;
    const prev: BandDay | null = k >= 1 ? this.bandDay(b, d - 1) : null;
    const baggage: number[] = men.filter((x, i) => this.ageOn(x, d) >= 16 && ((i + d) % Math.round(1 / HB.baggage_men_share) === 0 || x === prev?.w1 || x === prev?.w2));
    const flockFolk = this.membersOn(this.bandHH[b], d).filter(x => this.persons[x].sex === 'm' && this.ageOn(x, d) >= 10 && this.ageOn(x, d) <= 55 && !baggage.includes(x)).sort((a, b2) => a - b2);
    const grazers = flockFolk.filter((x, i) => (i + d) % 2 === 0 || flockFolk.length === 1);
    const r: BandDay = { k, leave, hour: band.hour, moving, camp0, camp1, wake, departF: wake + lerp(0.8, 1.2, u(2)), depart: wake + lerp(1.3, 1.9, u(3)), haltA, haltB,
      arriveBag: Math.max(haltB + 0.8, Math.min(sun.set - 1.5, haltB + lerp(1.0, 2.0, u(6)))), arriveFlock: sun.set - lerp(0.4, 1.0, u(7)), supper: sun.set + lerp(0.3, 0.7, u(8)),
      w1, w2, w1end: lerp(HB.watch_end_h[0], HB.watch_end_h[1], u(9)), baggage, grazers, milk: (HB.milk_months as number[]).includes(C.month), prev };
    this.bandCache.set(key, r); return r;
  }
  private bandCache = new Map<number, BandDay>();
  /** the household of each transhumant band (E-49) */
  private bandHH: number[] = [];
  /** days until the barley harvest opens (E-41's window), or -1 once it has (C) */
  harvestIn(d: number) { const w = eventRow('E-41')?.day_window as [number, number] | undefined; return w && d < w[0] ? w[0] - d : -1; }
  /** a farming man's job about the house in the season (lives.json home_hours.farm_chores; C), or null */
  farmChore(pid: number, d: number, C: DayCtx): [ActivityId, string] | null {
    const near = this.harvestIn(d), fl = L.home_hours.farm_chores.list as { when?: string; months?: number[]; act: ActivityId; why: string }[];
    const ok = fl.filter(c => c.when === 'harvest_near' ? near >= 1 && near <= L.farm_men_other_work.opts.floor.before_harvest_d : c.when === 'threshing' ? C.agri.has('E-43') : !!c.months?.includes(C.month));
    if (!ok.length) return null; const c = ok[Math.floor(u01(this.seed, S.assign, 7400 + pid, d) * ok.length)]; return [c.act, c.why];
  }
  /** what a day's field work is in each part of the farming year (C, after IR-FOODAG and FARS-CROP's calendar): the
   *  stubble and the manure before the ploughing, the clods and the banks while the ploughing and sowing go on, the banks
   *  and channels in winter, hoeing and weeding the growing crop in spring, the summer crop's furrows after the harvest */
  fieldWhy(C: DayCtx, u: number) {
    const m = C.month;
    if (m === 6 || (m === 7 && !C.agri.has('E-40'))) return u < 0.5 ? 'clearing the stubble before the ploughing' : 'spreading manure on the field';
    if (m >= 7 && m <= 9) return u < 0.5 ? 'breaking the clods and levelling the ploughed land' : 'mending the field banks and the water channels';
    if (m >= 10 && m <= 11) return u < 0.6 ? 'mending the field banks and the water channels' : 'manuring the field';
    if (m === 12 || m === 1 || (m === 2 && !C.agri.has('E-41'))) return u < 0.7 ? 'hoeing and weeding the growing crop' : 'minding the crop and the water in the furrows';
    return u < 0.6 ? 'hoeing the summer crop and opening its furrows to the water' : 'minding the summer crop';
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
    const p = this.persons[pid]; if (p.sex !== 'f' || this.ageOn(pid, d) < 14) return false; const H = this.households[this.home(pid, d)];
    if (H.members.some(x => x !== pid && this.persons[x].mother === pid && this.ageOn(x, d) < 5 && this.present(x, d) && this.sickStart(x, d) > 0) && !this.sick(pid, d)) return true; // a mother stays with her sick small child
    const carer = H.members.find(x => this.persons[x].sex === 'f' && this.ageOn(x, d) >= 14 && this.present(x, d) && !this.sick(x, d)); if (carer !== pid) return false;
    return H.members.some(x => x !== pid && this.present(x, d) && this.sickStart(x, d) > 0 && (this.ageOn(x, d) < 10 || this.persons[x].job === 'elder'));
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
      const p = this.persons[i]; if (this.ageOn(i, d) < 14 || C.disputes.has(i) || p.zone === 'transient') continue;
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
      if (o === i || C.disputes.has(o) || !this.present(o, d) || this.sick(o, d) || this.ageOn(o, d) < 14) continue;
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
    if (d < -1) { this.rotaCache.set(d, r); return r; }
    // the eve of the year (d = -1) keeps its rota too, with the garrison as it is on day 0, so that the night watch that began
    // on it is still at the posts after midnight on day 0 (was: nobody on the posts until 06:00 on the year's first day)
    const dp = Math.max(0, d);
    for (let w = 0 as 0 | 1 | 2; w < 3; w = (w + 1) as 0 | 1 | 2) {
      const files = this.garrison.filter(pid => this.phase(pid, d) === w && this.persons[pid].rank === 0);
      const cycle = Math.floor((d + (this.persons[files[0]]?.file ?? 0) % 5) / 5);
      const men = files.map((pid, i) => ({ pid, k: (((i + 3 * cycle) % files.length) + files.length) % files.length })).sort((a, b) => a.k - b.k).filter(x => this.present(x.pid, dp) && !this.sick(x.pid, d)).map(x => x.pid);
      // a sick man's post is covered by the patrol; beyond that a man is called from an off file: for A and B the fully
      // rested file (phase 4), for the night watch the file that came off it this morning (phase 3), never twice (C)
      const reserve = this.garrison.filter(pid => this.phase(pid, d) === (w === 2 ? 3 : 4) && this.persons[pid].rank === 0 && this.present(pid, dp) && !this.sick(pid, d) && !r!.has(pid));
      let ri = Math.floor(u01(this.seed, S.dbl, d, w) * Math.max(1, reserve.length));
      GUARD_POSTS.forEach((post, i) => { let pid = men[i]; let called = false; if (pid === undefined && reserve.length) { for (let k = 0; k < reserve.length && (pid === undefined || r!.has(pid)); k++) pid = reserve[ri++ % reserve.length]; called = true; } if (pid !== undefined && !r!.has(pid)) r!.set(pid, { watch: w, post, called }); });
      for (const pid of men.slice(GUARD_POSTS.length)) r.set(pid, { watch: w, post: null, called: false });
      for (const pid of this.garrison) if (this.persons[pid].rank === 1 && this.phase(pid, d) === w && this.present(pid, dp) && !this.sick(pid, d)) r.set(pid, { watch: w, post: null, called: false });
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
    // the trees of a garden or an estate stand beside its beds (C). Was: `estate:<h>:trees` read "trees" as a plot number
    // (NaN: every walk to them and the rest of the day had NaN times) and `garden:<q>:trees` fell through to the Terrace
    if (place.endsWith(':trees')) { const b = this.pos(place.slice(0, -6), d); return [b[0] + 90, b[1] + 120]; }
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
const NAME_POOLS = (() => { const m = new Map<string, string[]>(); for (const n of (namesData as any).names) { if (n.notable || n.reading_uncertain) continue; const k = `${n.sex}:${n.origin_guess}`; (m.get(k) ?? m.set(k, []).get(k)!).push(n.name); }
  // attested outside names.json, in the project's research: Herdkama "the Egyptian", chief of a team of 100 labourers in a
  // Treasury text (research/PEOPLE.md, PT-WAGE: SX, C; the name looks Iranian, the label is Egyptian: kept as given)
  (m.get('m:Egyptian') ?? m.set('m:Egyptian', []).get('m:Egyptian')!).push('Herdkama');
  return m; })();
/** every attested name of each sex (not the notable, not the uncertain readings), of whatever origin */
const NAME_ALL: Record<string, string[]> = { m: [], f: [] }; for (const n of (namesData as any).names) if (!n.notable && !n.reading_uncertain && NAME_ALL[n.sex]) NAME_ALL[n.sex].push(n.name);
const ORIGIN_POOL: Record<string, string> = { Persian: 'Iranian', Median: 'Iranian', Elamite: 'Elamite', Babylonian: 'Babylonian', Syrian: 'West Semitic', Egyptian: 'Egyptian', Indian: 'Indian' };
/** a pool smaller than this is thin (S9 of shadow review r5): 241 of 242 Egyptian men were Muzraaya ("the Egyptian") */
export const THIN_NAME_POOL = 8;
/** an attested name for an unnamed person of the population, or null when their origin has no attested names in the pool.
 *  Names recur across the population as they do in the tablets (tier: A name form / C assignment). Where the attested pool
 *  of the person's origin and sex is thin (fewer than THIN_NAME_POOL names: Egyptian men 2, Egyptian women 0, Elamite women
 *  4, West Semitic and Indian men 3), its own names are drawn at their share of THIN_NAME_POOL and the rest across all the
 *  attested names of that sex, with replacement: in the Persepolis texts foreign workers bear names that are not of their
 *  own language, Herdkama "the Egyptian" among them (PEOPLE.md, PT-WAGE; C: S9 of shadow review r5). Origins with no
 *  attested name at all (Greek, Lydian, Carian, ...) stay unnamed */
export function nameFor(seed: number, p: Person): string | null {
  if (p.nm !== undefined) return p.nm;
  const og = ORIGIN_POOL[p.origin]; if (!og) return null; const own = NAME_POOLS.get(`${p.sex}:${og}`) ?? [], u = u01(seed, S.name, p.id);
  if (own.length >= THIN_NAME_POOL) return own[Math.floor(u * own.length)];
  const share = own.length / THIN_NAME_POOL; if (u < share) return own[Math.floor(u / share * own.length)];
  const all = NAME_ALL[p.sex] ?? []; return all.length ? all[Math.floor(u01(seed, S.name, p.id, 1) * all.length)] : null;
}

// ------------------------------------------------------------------ the planner: one person, one day
class Planner {
  readonly p: Person; readonly C: DayCtx; readonly r: HStream; readonly segs: Seg[] = []; t = 0;
  readonly home: string; readonly homeW: Where; readonly hh: Household;
  /** the person's age on the day (the year's birthdays counted; S3 of shadow review r5: every branch by age was on the age
   *  at the start of the year), and for a child under two its age in days */
  readonly age: number; readonly ageD: number;
  private ageOf(x: number) { return this.P.ageOn(x, this.d); }
  constructor(readonly P: Population, readonly pid: number, readonly d: number) {
    this.p = P.persons[pid]; this.C = P.cal.ctx(d); this.r = new HStream(P.seed, S.plan, pid, d);
    this.age = P.ageOn(pid, d); this.ageD = P.ageDays(pid, d);
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
    // (no "minding the children" in her rest any more: the little ones are then as often in the lane, at a neighbour's or
    // with the house's minder; their own plans say where they are: S2 and S8 of shadow review r5)
    let lastK = '';
    // a house of men with no woman in it (the gangs' lodgings): the men fetch its water and wash their own clothes, and sit
    // out in the lane with the other men (C)
    const menHouse = !f && this.homeW === 'town' && !this.P.membersOn(this.hh.id, this.d).some(x => this.P.persons[x].sex === 'f' && this.ageOf(x) >= 12);
    // no woman at home by day (both work): the man fetches water too; in the cold the men of the plain go out for fuel (C)
    const noneHome = !f && (this.homeW === 'town' || this.homeW === 'plain') && !this.P.membersOn(this.hh.id, this.d).some(x => this.P.persons[x].sex === 'f' && this.ageOf(x) >= 12 && ['homemaker', 'elder', 'child', 'farmer'].includes(this.P.persons[x].job));
    const cold = !f && plain && this.C.wx.tmin < 4 && this.adult();
    // a farming man's hours at home carry the season's jobs about the house, and his rest in daylight is capped (S1, r4;
    // home_hours.farm_chores, men_rest_cap_h; C)
    const farmMan = !f && plain && this.p.job === 'farmer' && this.adult(), chore = farmMan ? this.P.farmChore(this.pid, this.d, this.C) : null;
    // a man of standing (an official, a steward, a priest, a scribe, a storekeeper) does not mend the tools and baskets: his
    // hours at home go to the household's affairs, a caller, a scribe's own accounts (home_hours.men_of_standing; S7 of
    // shadow review r5, S5 of reviewer B: an official with two servants mending baskets for an hour; C)
    const ranked = !f && ['official', 'steward', 'priest', 'scribe', 'storekeeper'].includes(this.p.job), servants = ranked && this.P.membersOn(this.hh.id, this.d).some(x => this.P.persons[x].job === 'servant');
    const womanHome = f && this.adult() && (this.homeW === 'town' || this.homeW === 'plain'); // (S7: her rest in daylight capped too)
    const restCap = farmMan ? (this.C.season === 'winter' ? H.men_rest_cap_h.winter : H.men_rest_cap_h.other) : womanHome ? (this.C.season === 'winter' ? H.women_rest_cap_h.winter : H.women_rest_cap_h.other) : Infinity;
    // a woman's hours: the spindle and the loom in winter and on her days off (S7, r4; home_hours.women_winter, women_day_off; C)
    const WF = this.C.season === 'winter' ? H.women_winter : this.dayOff ? H.women_day_off : H.women, spinMin = womanHome ? (WF as { spin_min_h?: number }).spin_min_h ?? 0 : 0;
    while (this.t < until - 0.3) {
      const hot = this.C.heatRest && this.t >= 11.5 && this.t < 15.5 ? H.sleep_in_heat : 0;
      // no work that needs light before first light, about 0.45 h before sunrise (civil dawn at 30° N; S7 r5: a scribe mending
      // baskets from 04:40; C)
      const dark = this.t < this.sun.rise - 0.45 || this.t > this.sun.set + 0.3;
      // no talk "with the household" while the household is out at the harvest's afternoon session
      const T = this.hd.task, othersOut = !!T?.all && !!T.pm && this.t >= T.pm[0] - 0.3 && this.t < T.pm[1];
      const outD = !this.C.wx.wet && !this.C.wx.dust && !this.C.wx.storm && this.t > this.sun.rise && this.t < this.sun.set - 1.2 && until - this.t > 1 && (this.cur ?? this.home) === this.home && (this.homeW === 'town' || this.homeW === 'plain');
      const outM = menHouse && !this.C.wx.wet && !this.C.wx.dust && !hot && this.t > 7 && this.t < this.sun.set - 1 && until - this.t > 0.8 && (this.cur ?? this.home) === this.home;
      const out = f && this.adult() && this.homeW !== 'terrace' && !this.C.wx.wet && !this.C.wx.dust && !hot && this.t > 7 && this.t < this.sun.set - 1.5 && until - this.t > 1 && (this.cur ?? this.home) === this.home;
      const restLeft = farmMan || womanHome ? restCap - this.daylightRest() : Infinity;
      const wts = f ? { rest: restLeft < 0.3 ? 0 : WF.rest, grind: WF.grind, weave: WF.weave, loom: dark ? 0 : WF.loom ?? 0, craft: 0, affairs: 0, animals: 0, talk: othersOut ? 0 : WF.talk, sleep: hot, lane: out ? WF.lane * (this.P.membersOn(this.hh.id, this.d).some(x => this.ageOf(x) < 5 && this.P.persons[x].mother === this.pid) ? 2 : 1) : 0, water: 0, wash: 0, fuel: 0, chore: 0 }
        : { rest: restLeft < 0.3 ? 0 : H.men.rest, grind: 0, weave: 0, loom: 0, craft: ranked || dark ? 0 : H.men.craft, affairs: ranked && !dark ? H.men_of_standing.affairs : 0, animals: plain ? H.men.animals_plain : 0, talk: othersOut ? 0 : H.men.talk, sleep: hot, lane: outM ? 0.25 : outD && !hot ? 0.1 : 0, water: outM || (noneHome && outD) ? 0.15 : 0, wash: outM && until - this.t > 1.3 ? 0.08 : 0, fuel: cold && outD && until - this.t > 1.4 ? 0.3 : 0, chore: chore && !hot && !dark ? H.farm_chore : 0 };
      let k = this.choose(wts); if (k === lastK && k !== 'rest' && k !== 'sleep') k = this.choose(wts);
      // the winter spindle (S7): from noon a woman at home who has not yet spun or woven spin_min_h today takes it up first
      if (spinMin > 0 && this.t >= 12 && !hot && until - this.t > 0.6 && (this.cur ?? this.home) === this.home && this.segs.reduce((a, s) => a + (s.act === 'spin' || s.act === 'weave' ? s.t1 - s.t0 : 0), 0) < spinMin) k = 'weave';
      lastK = k;
      let t1 = Math.min(until, this.t + r.range(s0, s1)); if (k === 'rest' && (farmMan || womanHome)) t1 = Math.min(t1, this.t + Math.max(0.3, restLeft));
      if (k === 'water') { this.well(this.t + r.range(0.2, 0.4), 'fetching water for the house'); continue; }
      if (k === 'fuel') { const o = `outside:${this.hh.q}`, W = this.homeW; this.go(o, W, 'out for fuel'); this.add(Math.max(this.t + 0.4, Math.min(until - this.P.walkH(o, this.home, this.d, W, W) - 0.05, this.t + r.range(0.7, 1.3))), o, 'gather', 'gathering dung and brushwood against the cold', W); this.go(this.home, W, 'carrying the fuel home', 'carry_sack'); continue; }
      if (k === 'wash') { const c = `canal:${this.hh.q}`, W = this.homeW; this.go(c, W); this.add(Math.max(this.t + 0.4, t1 - this.P.walkH(c, this.home, this.d, W, W)), c, 'wash', 'washing his clothes at the water', W); this.go(this.home, W); continue; }
      if (k === 'lane' && !f) { const l = `lane:${this.hh.q}`, W = this.homeW; this.go(l, W); const g = r.chance(0.4); this.add(Math.max(this.t + 0.3, t1 - this.P.walkH(l, this.home, this.d, W, W)), l, g ? 'gamble' : 'talk', g ? 'knucklebones with the men of the lane' : 'talking with the men of the lane', W); this.go(this.home, W); continue; }
      if (k === 'lane') { const l = `lane:${this.hh.q}`, W = this.homeW; this.go(l, W); const sp = r.chance(0.5); this.add(Math.max(this.t + 0.3, t1 - this.P.walkH(l, this.home, this.d, W, W)), l, sp ? 'spin' : 'talk', sp ? 'spinning with the women outside the door' : 'talking with the women outside the door', W); this.go(this.home, W); continue; }
      if (k === 'craft') this.atHome(t1, 'craft', 'mending tools and baskets'); else if (k === 'animals') this.atHome(t1, 'tend_animals', 'seeing to the household’s animals');
      else if (k === 'affairs') { const a = this.p.job === 'scribe' || this.p.job === 'storekeeper' ? r.chance(0.6) : false;
        if (a) this.atHome(t1, 'write_tablet', 'going over the household’s accounts on a tablet'); else this.atHome(t1, 'talk', servants && r.chance(0.5) ? 'seeing to the household’s affairs with the servants' : 'receiving a caller at the house'); }
      else if (k === 'chore') this.atHome(t1, chore![0], chore![1]);
      else if (k === 'grind') this.atHome(t1, 'grind', 'grinding the household’s flour'); else if (k === 'weave') this.atHome(t1, 'spin', 'spinning');
      else if (k === 'loom') this.atHome(t1, 'weave', 'weaving at the loom in the house');
      else if (k === 'talk') this.atHome(t1, 'talk', 'with the household'); else if (k === 'sleep') this.atHome(t1, 'sleep', 'sleeping through the heat of the day'); else this.atHome(t1, 'rest', why);
    }
    // (a remainder of under three minutes goes to the spell before it: no 42-second "resting at home" between two spells of
    // mending, as on 21408's day)
    const L0 = this.segs[this.segs.length - 1];
    if (this.t < until && until - this.t < 0.05 && L0 && L0.place === this.home && L0.where !== 'road' && L0.act !== 'eat' && L0.with === undefined && !/^minding/.test(L0.why)) { L0.t1 = until; this.t = until; }
    if (this.t < until) this.atHome(until, 'rest', why);
  }
  /** hours of rest at a place (not on the road) between sunrise and sunset so far today; on a day of the E-64 heat the rest
   *  from noon to 16:00 is the heat's, not counted (C) */
  private daylightRest() { const { rise, set } = this.sun, heat = this.C.heatRest; let s = 0;
    for (const x of this.segs) if (x.act === 'rest' && x.where !== 'road') { const a = Math.max(x.t0, rise), b = Math.min(x.t1, set); if (b <= a) continue; s += b - a; if (heat) s -= Math.max(0, Math.min(b, 16) - Math.max(a, 12)); } return s; }
  /** an able farming man of the plain (his hours at home carry the season's jobs and a cap on rest: S1) */
  private farmMan() { return this.p.sex === 'm' && this.hh.zone === 'plain' && this.p.job === 'farmer' && this.adult(); }
  /** idle time at home until `until`: a farming man's goes to his hours at home (the season's jobs, capped rest: S1), anyone
   *  else's is idle */
  private idleUntil(until: number) { if (this.farmMan() && until - this.t > 0.4 && (this.cur ?? this.home) === this.home) this.homeHours(until, 'at home'); else this.atHome(until, ...this.idle()); }
  /** a day at home off the person's own work (homeDay): a woman spins more (S7) */
  private dayOff = false;
  /** walk from the current place to `to`; returns the arrival time */
  private go(to: string, whereTo: Where, why = 'walking', act: ActivityId = 'walk') {
    const from = this.cur ?? this.home, wf = this.curW ?? this.homeW;
    if (from === to) return this.t;
    // no walk home and straight back out (S10, r4: two lane outings in a row made one walk that left the lane and came back
    // to it): when the last leg brought the person home just now from `to`, with nothing done at home, the walk home is
    // undone and its time spent at `to`; a load carried home is first set down (the water poured into the house jar)
    // (a moment at home of under two minutes, the end of a spell cut short, counts as nothing done there)
    const n = this.segs.length, sl = this.segs[n - 1], sliver = !!sl && sl.place === this.home && sl.where !== 'road' && sl.t1 - sl.t0 < 0.03 && /^(rest|play|talk)$/.test(sl.act);
    const j = sliver ? n - 2 : n - 1, L1 = this.segs[j], L0 = this.segs[j - 1];
    if (from === this.home && L1 && L0 && L1.where === 'road' && (sliver || L1.t1 >= this.t - 1e-6) && L0.place === to && L0.where !== 'road' && L0.act !== 'sleep') {
      if (L1.act === 'walk') { this.segs.length = j; L0.t1 = this.t; this.cur = to; this.curW = L0.where; return this.t; }
      const water = /water/.test(L1.why); this.add(this.t + 0.05, this.home, water ? 'carry_jar' : 'rest', water ? 'pouring the water into the house jar' : 'setting the load down at home', this.homeW); }
    // a walk that arrives and goes straight on stops there a moment, 3 min (S10, r4: "a walk split in two", 18978 at 16:15):
    // at home the load carried in is set down (the water poured into the house jar) or the jar or the load for the next leg
    // taken up; elsewhere a moment at the place (C). Not from the Terrace or on a guard's way up to it (the rota's and the
    // gangs' timings stand), nor on a road (a horse led along the road and back)
    const La = this.segs[this.segs.length - 1];
    if (La && this.segs.length > 1 && La.where === 'road' && La.t1 >= this.t - 1e-6 && wf !== 'terrace' && !(whereTo === 'terrace' && this.p.job === 'guard') && !from.startsWith('road:')) {
      const atHome = from === this.home, loadIn = La.act !== 'walk' && La.act !== 'rest', water = loadIn && /water/.test(La.why);
      const [a, w]: [ActivityId, string] = atHome && water ? ['carry_jar', 'pouring the water into the house jar'] : atHome && loadIn ? ['rest', 'setting the load down at home']
        : atHome && to.startsWith('well:') ? ['rest', 'taking up the water jar at home'] : atHome && act !== 'walk' ? ['rest', 'taking up the load at home'] : atHome ? this.idle() : ['rest', 'stopping there a moment'];
      this.add(this.t + 0.05, from, a, w, wf); }
    // (in the dust the going is slower, W-03 "travel slows × 0.7": S5 of shadow review r5)
    const dh = this.C.wx.dustH, h = this.P.walkH(from, to, this.d, wf, whereTo) / (dh && this.t >= dh[0] && this.t < dh[1] ? 0.7 : 1); this.add(this.t + h, `road:${whereTo === 'terrace' || wf === 'terrace' ? 'terrace' : whereTo}`, act, why, 'road');
    this.cur = to; this.curW = whereTo; return this.t;
  }
  /** the midday meal at home after the morning out there */
  private backFrom(place: string) { return `the midday meal with the household, back from ${place.startsWith('threshing') ? 'the threshing floor' : place.startsWith('vineyard') ? 'the vineyard' : place.startsWith('orchard') ? 'the orchard' : place.startsWith('canal') ? 'the canal' : place.startsWith('garden') ? 'the garden beds' : place.startsWith('outside') ? 'gathering fuel' : 'the field'}`; }
  /** the words for a walk out to a place of the plain */
  private toward(place: string) { return place.startsWith('threshing') ? 'out to the threshing floor' : place.startsWith('vineyard') ? 'out to the vineyard' : place.startsWith('orchard') ? 'out to the orchard'
    : place.startsWith('canal') ? 'out to the canal' : place.startsWith('pasture') ? 'out to the pasture' : place.startsWith('field') ? 'out to the field' : place.startsWith('garden') ? 'out to the garden beds'
    : place.startsWith('outside') ? 'out beyond the village for fuel' : 'walking'; }
  private get sun() { return this.C.sun; }
  private rise() { const [a, b] = L.rise_before_sunrise_h.v; return this.sun.rise - lerp(a, b, this.p.trait); }
  private bed() { const [a, b] = this.age < 10 ? L.children.bed_after_sunset_h.under_10 : this.age < 14 ? L.children.bed_after_sunset_h.under_14 : L.bed_after_sunset_h.v; return this.sun.set + lerp(a, b, 1 - this.p.trait); }
  private rainIn(t0: number, t1: number) { const w = this.C.wx.rain; return w ? Math.max(0, Math.min(w[1], t1) - Math.max(w[0], t0)) : 0; }
  private adult() { return this.age >= 14; }

  build(): Seg[] {
    const segs = this.build0(); const P = this.P;
    if (!P.present(this.pid, this.d) || this.p.job === 'traveller') return segs;
    // a band's people (S4): their mothers nurse on demand like any; their days need no water, fire or field passes
    if (this.p.job === 'herder') { if (this.p.sex === 'f' && this.age >= 14) this.nurse(segs); if (this.age >= 2) this.meals(segs); this.joinSlivers(segs); this.tidy(segs); this.carries(segs); this.dustVeil(segs); return segs; }
    if (this.p.sex === 'f' && this.age >= 14) this.nurse(segs);
    this.fieldBite(segs); this.water(segs); this.homeStops(segs); this.fire(segs);
    if (this.age >= 2) this.meals(segs);
    this.joinSlivers(segs); this.tidy(segs); this.carries(segs); this.dustVeil(segs);
    return segs;
  }
  /** the post-passes cut spells by arithmetic, and a cut can leave a remainder of a second or less (a float residue: 0.32 s
   *  "at home" between two well trips, 14:59:59.6 at a window's edge). Such a sliver is no part of anyone's day, and the
   *  plans that follow this one (a child with its mother, D-140) drop pieces under 1e-4 h and walk straight through it. A
   *  piece shorter than 3.6 s goes to its neighbour at the same place, else to the walk beside it, else to the one before;
   *  a walk that is the only way between two places stays, and so do the day's first and last pieces (where yesterday
   *  ended and tomorrow begins) */
  private joinSlivers(segs: Seg[]) {
    for (let i = 1; i < segs.length - 1; i++) { const s = segs[i], pv = segs[i - 1], nx = segs[i + 1]; if (!(s.t1 - s.t0 < 0.001)) continue;
      if (s.where === 'road' && pv.where !== 'road' && nx.where !== 'road' && pv.place !== nx.place) continue;
      const same = (x: Seg) => x.place === s.place && x.where === s.where;
      if (same(pv) || (!same(nx) && (pv.where === 'road' || nx.where !== 'road'))) pv.t1 = s.t1; else nx.t0 = s.t0;
      segs.splice(i, 1); i--; }
  }
  /** a harvest morning of four hours or more at the field or the floor has its bite of the bread and water carried out at
   *  dawn, about half-way (S6; C) */
  private fieldBite(segs: Seg[]) {
    const T = this.hd?.task; if (!T || !T.all || this.hh.zone !== 'plain' || this.age < 9) return;
    let best: Seg | null = null; for (const s of segs) if (s.place === T.place && s.t0 < 8.5 && /^(reap|thresh|pick_fruit|field_work)$/.test(s.act) && (!best || s.t1 - s.t0 > best.t1 - best.t0)) best = s;
    if (!best || best.t1 - best.t0 < 3.5 || segs.some(x => x.act === 'eat' && x.place === T.place && x.t0 < 11)) return;
    const u = u01(this.P.seed, S.fam, this.pid, this.d, 11);
    this.insertAt(segs, best.t0 + (best.t1 - best.t0) * lerp(0.4, 0.55, u), lerp(0.2, 0.33, u), 'eat', T.place.startsWith('threshing') ? 'bread and water by the threshing floor, carried out at dawn' : T.place.startsWith('field') ? 'bread and water at the field edge, carried out at dawn' : 'bread and water in the shade, carried out at dawn');
  }
  /** the house's water (D-137): the one who sees to it draws as many jars as the house needs today (hday.jars), at the
   *  quarter's well, in hours she is at home and awake, the morning first; others' trips are over and above */
  private water(segs: Seg[]) {
    const H = this.hd; if (!H || H.waterer !== this.pid || !H.jars || this.C.wx.storm) return;
    const have = segs.filter(s => s.act === 'draw_water' && s.with === undefined).length; if (have >= H.jars) return;
    const w = `well:${this.hh.q}`, W = this.homeW, walk = this.P.walkH(this.home, w, this.d, W, W); const trip = 2 * walk + 0.22;
    const rain = this.C.wx.rain; let need = H.jars - have;
    // not while the little ones are with her (the house's minder: Population.mindDay; S2 r5)
    const spans = H.minder === this.pid ? this.P.mindDay(this.hh.id, this.d).spans ?? [] : [], busy = (a: number, b: number) => spans.some(([x, y]) => x < b + 0.02 && y > a - 0.02);
    const okHome = (s: Seg) => s.place === this.home && s.where === W && !/^minding/.test(s.why) && (/^(rest|talk|play|spin|craft)$/.test(s.act) || (s.act === 'grind' && s.t1 - s.t0 >= trip + 0.5)) && !/ in the night|nurs|sick|ill|asleep/.test(s.why);
    for (const [lo, hi] of [[this.sun.rise - 0.2, 11], [15, this.sun.set - 0.1], [11, 15]] as [number, number][]) {
      // runs of spells at home in a row (a short spin, a little grinding, a rest) that together hold a trip
      for (let i = 0; i < segs.length && need > 0; i++) { if (!okHome(segs[i])) continue; let j = i; while (j + 1 < segs.length && okHome(segs[j + 1])) j++;
        if (j === i) continue; let a = Math.max(segs[i].t0, lo); const b = Math.min(segs[j].t1, hi); if (b - a < trip + 0.05) { i = j; continue; }
        // no slivers (D-140): she does not sit down at home for a moment before she goes, and when what is left of a spell
        // after the trip is a matter of seconds or a minute or two, the trip ends with it (the water poured into the house's
        // jar). Was: a spell exactly one trip long left 0.32 s "at home" between two trips, and her children walked through it
        const ka = segs.findIndex((s, k) => k >= i && k <= j && s.t0 <= a && s.t1 > a); if (ka >= 0 && a - segs[ka].t0 < 0.05) a = segs[ka].t0;
        let e = a + trip; const ke = segs.findIndex((s, k) => k >= i && k < j && s.t0 < e && s.t1 > e); if (ke >= 0 && segs[ke].t1 - e < 0.05) e = segs[ke].t1;
        if ((rain && rain[0] < e && rain[1] > a) || busy(a, e)) { i = j; continue; }
        const keep: Seg[] = [];
        for (let k = i; k <= j; k++) { const s = segs[k]; if (s.t1 <= a + 1e-6) keep.push(s); else if (s.t0 < a) keep.push({ ...s, t1: a }); }
        keep.push({ t0: a, t1: a + walk, place: `road:${W}`, act: 'walk', why: 'to the well with the jar', where: 'road' }, { t0: a + walk, t1: a + walk + 0.22, place: w, act: 'draw_water', why: 'drawing the house’s water', where: W }, { t0: a + walk + 0.22, t1: e, place: `road:${W}`, act: 'carry_jar_head', why: 'carrying water home', where: 'road' });
        for (let k = i; k <= j; k++) { const s = segs[k]; if (s.t0 >= e - 1e-6) keep.push(s); else if (s.t1 > e + 1e-6) keep.push({ ...s, t0: e }); }
        const kept = keep.filter(x => x.t1 - x.t0 > 1e-6); segs.splice(i, j - i + 1, ...kept); need--; i += kept.length - 1; } }
    for (const [lo, hi] of [[this.sun.rise - 0.2, 11], [15, this.sun.set - 0.1], [11, 15]] as [number, number][]) {
      for (let i = 0; i < segs.length && need > 0; i++) { const s = segs[i];
        if (s.place !== this.home || s.where !== W || /^minding/.test(s.why) || !(/^(rest|talk|play|spin|craft)$/.test(s.act) || (s.act === 'grind' && s.t1 - s.t0 >= trip + 0.5)) || / in the night|nurs|sick|ill|asleep/.test(s.why)) continue;
        let a = Math.max(s.t0 + 0.05, lo); const b = Math.min(s.t1 - 0.05, hi); if (b - a < trip) continue; if (rain && rain[0] < a + trip && rain[1] > a) continue; if (busy(a, a + trip) || busy(s.t0, s.t1)) continue;
        if (a - s.t0 < 0.2) a = s.t0; if (s.t1 - (a + trip) < 0.15 && s.t1 - s.t0 >= trip) a = s.t1 - trip; // no slivers
        const parts: Seg[] = []; if (a > s.t0 + 1e-6) parts.push({ ...s, t1: a });
        parts.push({ t0: a, t1: a + walk, place: `road:${W}`, act: 'walk', why: 'to the well with the jar', where: 'road' });
        parts.push({ t0: a + walk, t1: a + walk + 0.22, place: w, act: 'draw_water', why: 'drawing the house’s water', where: W });
        parts.push({ t0: a + walk + 0.22, t1: a + trip, place: `road:${W}`, act: 'carry_jar_head', why: 'carrying water home', where: 'road' });
        if (a + trip < s.t1 - 1e-6) parts.push({ ...s, t0: a + trip }); segs.splice(i, 1, ...parts); i += parts.length - 1; need--; } }
    // still short: on the way home from the lane of her own quarter she goes by the well (the walk home carries the water)
    for (let i = 0; i + 1 < segs.length && need > 0; i++) { const s = segs[i], nx = segs[i + 1];
      if (s.place !== `lane:${this.hh.q}` || /^minding/.test(s.why) || !/^(talk|spin|exchange|play|rest)$/.test(s.act) || nx.where !== 'road' || nx.act !== 'walk' || segs[i + 2]?.place !== this.home) continue;
      const cut = walk + 0.22; if (s.t1 - s.t0 < cut + 0.3 || s.t1 < this.sun.rise || s.t0 > this.sun.set || busy(s.t1 - cut, s.t1 + walk)) continue;
      const a = s.t1 - cut; segs.splice(i, 2, { ...s, t1: a }, { t0: a, t1: a + walk, place: `road:${W}`, act: 'walk', why: 'to the well with the jar', where: 'road' },
        { t0: a + walk, t1: s.t1, place: w, act: 'draw_water', why: 'drawing the house’s water', where: W }, { ...nx, act: 'carry_jar_head', why: 'carrying water home' });
      i += 3; need--; }
  }
  /** no walk that arrives home and goes straight out again (S10, r4: "a walk split in two"; her walk home and back out to the
   *  well made one walk from the well to the well for the child with her): water carried home is poured into the house jar,
   *  and the jar is taken up before a trip to the well, 3 min at home; the minutes come off the drawing (C). The water pass
   *  (D-140: a trip starts and ends with a spell at home when within 3 min of it) and the planner's own walks leave these */
  private homeStops(segs: Seg[]) {
    if ((this.hh.zone !== 'town' && this.hh.zone !== 'plain') || this.p.job === 'guard') return; const W = this.homeW, p = 0.05, pour = (t: number): Seg => ({ t0: t, t1: t + p, place: this.home, act: 'carry_jar', why: 'pouring the water into the house jar', where: W });
    for (let i = 0; i + 1 < segs.length; i++) { const c = segs[i], nx = segs[i + 1], dw = segs[i - 1], d2 = segs[i + 2];
      if (c.where !== 'road' || nx.where !== 'road' || Math.abs(nx.t0 - c.t1) > 1e-6) continue;
      if (c.act === 'carry_jar_head' && /water/.test(c.why)) {
        if (dw && dw.act === 'draw_water' && dw.t1 - dw.t0 >= 0.15 && Math.abs(dw.t1 - c.t0) < 1e-6) { dw.t1 -= p; c.t0 -= p; c.t1 -= p; segs.splice(i + 1, 0, pour(c.t1)); i++; continue; }
        if (nx.act === 'walk' && d2?.act === 'draw_water' && d2.t1 - d2.t0 >= 0.15) { segs.splice(i + 1, 0, pour(c.t1)); nx.t0 += p; nx.t1 += p; d2.t0 += p; i++; continue; } }
      if (nx.act === 'walk' && nx.why === 'to the well with the jar' && d2?.act === 'draw_water' && d2.t1 - d2.t0 >= 0.15) {
        segs.splice(i + 1, 0, { t0: nx.t0, t1: nx.t0 + p, place: this.home, act: 'rest', why: 'taking up the water jar at home', where: W }); nx.t0 += p; nx.t1 += p; d2.t0 += p; i++; } }
  }
  /** the fire at dusk (§9.2; D-138): the woman who bakes (or the waterer) lights the hearth for the evening meal; in the
   *  cold it is banked for the night. A placeholder activity (cook: no performance yet) */
  private fire(segs: Seg[]) {
    const H = this.hd; if (!H || (this.hh.zone !== 'town' && this.hh.zone !== 'plain')) return; const who = H.baker >= 0 ? H.baker : H.waterer; if (who !== this.pid) return;
    const s = segAt(segs, H.supper - 0.3); if (s.place !== this.home || !/^(rest|talk|spin|play|craft|grind)$/.test(s.act)) return;
    this.insertAt(segs, Math.max(s.t0, H.supper - 0.35), 0.3, 'cook', this.C.wx.tmin < 5 ? 'lighting the fire for the evening meal and the cold night' : 'lighting the fire and warming the evening meal');
  }
  /** one stint, one reason: a stint split in two only by its wording is joined ("stopping to nurse" + "nursing"; the morning's
   *  and the afternoon's grinding back to back); evidence codes in a reason move to `ev` */
  private tidy(segs: Seg[]) {
    const EV = /\s*\(([^()]*\b(?:E|CE|W|Q|D)-\d+[^()]*|(?:HDT|PF|PT|POTTS|PW|CH|KONNER)[- ]?[\w.]*[^()]*)\)/;
    for (const s of segs) { const m = EV.exec(s.why); if (m) { s.ev = m[1]; s.why = (s.why.slice(0, m.index) + s.why.slice(m.index + m[0].length)).trim(); } }
    const same = (a: Seg, b: Seg) => a.place === b.place && a.act === b.act && a.where === b.where && (a.with ?? -1) === (b.with ?? -1)
      && ((/nurs/.test(a.why) && /nurs/.test(b.why)) || (a.act === 'grind' && b.act === 'grind'));
    const idle = /^(at home|resting at home|resting|with the household|at home, minding the children?|resting after the meal)$/;
    for (let i = segs.length - 1; i > 0; i--) if (same(segs[i - 1], segs[i]) || (segs[i - 1].act === 'rest' && segs[i].act === 'rest' && segs[i - 1].place === segs[i].place && (segs[i - 1].with ?? -1) === (segs[i].with ?? -1) && idle.test(segs[i - 1].why) && idle.test(segs[i].why))) { segs[i - 1].t1 = segs[i].t1; segs.splice(i, 1); }
  }
  /** what is carried (§9.5): the load of a carrying act, the water jar, the day's tools on the way to work and back, the
   *  guards' arms on watch (the Persepolis reliefs: Persian guards with spear and wicker shield, the others with spear, bow
   *  case and short sword: A for the reliefs, B as daily dress), a sealed letter (C) */
  private carries(segs: Seg[]) {
    const p = this.p, T = this.hd?.task ?? null;
    const arms = p.origin === 'Persian' ? 'a spear and a wicker shield' : 'a spear, a bow case and a short sword';
    const kit = p.job === 'builder' ? (p.sub === 'stone' ? 'his chisels and mallet in a bag' : p.sub === 'brick' ? (segs.some(s => s.act === 'mould_brick') ? 'a mattock and a brick mould' : 'a trowel and a basket for the mortar') : 'a mattock and a carrying basket') : null; // (the layer's trowel: S8 quibble of r5)
    const farm = !T ? null : T.kind === 'reap' ? 'a sickle' : T.kind === 'thresh' ? 'a winnowing fork' : T.kind === 'plough' ? 'the plough and the yoke, driving the oxen' : T.kind === 'canal' ? 'a mattock and a basket'
      : T.kind === 'turn' ? 'a mattock for the water channels' : T.kind === 'field' ? 'a hoe' : T.kind === 'vintage' || T.kind === 'fruit' ? 'an empty basket' : T.kind === 'other' ? T.tool ?? null : null;
    const works = !!T && segs.some(s => s.place === T.place && (s.act === T.act || /^(reap|thresh|plough|field_work|dig_canal|irrigate|pick_fruit)$/.test(s.act)));
    for (let i = 0; i < segs.length; i++) { const s = segs[i], w = s.why; if (s.carry || (s.with !== undefined && this.age < 5)) continue;
      const nx = segs[i + 1], pv = segs[i - 1];
      if (s.act === 'carry_jar_head') s.carry = 'a jar of water on the head';
      else if (s.act === 'carry_bread') s.carry = /water/.test(w) ? 'bread in a basket and a water jar' : 'bread in a basket';
      else if (s.act === 'carry_sack') s.carry = /sheaves/.test(w) ? 'sheaves' : /fuel|dung|brushwood/.test(w) ? 'dung cakes and brushwood' : /grain/.test(w) ? 'a sack of grain' : /ration/.test(w) ? 'the ration in a sack' : /barley/.test(w) ? 'a measure of barley' : 'a load';
      else if (s.act === 'carry_jar') s.carry = /oil/.test(w) ? 'a small jar of oil' : /water/.test(w) ? 'a water jar' : 'a jar';
      else if (s.act === 'draw_water') s.carry = 'a water jar';
      else if (p.job === 'guard' && (s.act === 'stand_guard' || s.act === 'patrol')) s.carry = arms;
      else if (/sealed letter|carrying a letter|a sealed document/.test(w)) s.carry = 'a sealed letter';
      else if (/empty basket/.test(w)) s.carry = 'the empty basket';
      else if (kit && s.where === 'road' && ((nx && nx.where === 'terrace') || (pv && pv.where === 'terrace') || /building site/.test(w))) s.carry = kit;
      else if (farm && T && works && s.where === 'road' && ((nx && nx.place === T.place) || (pv && pv.place === T.place))) {
        const out = !!nx && nx.place === T.place; const job = out ? nx : pv; let eatsOut = false;
        if (out) for (let j = i + 1; j < segs.length && segs[j].place !== this.home; j++) if (segs[j].act === 'eat' && segs[j].place === T.place && !/brought out|by a child/.test(segs[j].why)) { eatsOut = true; break; }
        // a child's own tool at the floor or behind the reapers (S6, r4: was a hoe to drive the oxen "with a stick")
        const kid = this.age < 14 ? (/driving the animals/.test(job.why) ? 'a stick for driving the animals' : /glean/.test(job.why) ? 'a basket for the gleanings' : /turning the (threshed )?straw/.test(job.why) ? 'a wooden fork' : '') : '';
        const tool = kid || (job.act === T.act ? farm : T.kind === 'plough' && job.act === 'field_work' ? 'the seed basket' : /^(field_work|dig_canal)$/.test(job.act) ? 'a hoe' : '');
        if (tool || eatsOut) s.carry = (tool || '') + (out && eatsOut && this.age >= 12 ? `${tool ? ', and ' : ''}bread and water` : ''); }
    }
  }
  /** out of doors while the dust is in the air the face is wrapped (W-03 "faces covered"; S5 of shadow review r5: its effects
   *  were visible nowhere). Out of doors: the roads, the lanes, the well, the fields, the canal, the pasture, the fuel ground,
   *  the threshing floor, the gardens, the stockyard, the Terrace's open courts and works (not its halls, the Treasury or the
   *  garrison's quarters). The renderer does not draw it yet (C) */
  private dustVeil(segs: Seg[]) {
    const dh = this.C.wx.dustH; if (!dh) return;
    const open = (s: Seg) => s.where === 'road' || /^(lane:|well:|field:|canal:|pasture:|outside|threshing:|garden:|orchard:|vineyard:|estate:|stockyard|crown_fields|river|clay_pit|worksite|h100_|hall100_site|stair_foot|querns|oven|work_hearth|water|forecourt|brickyard|terrace_round|post_)/.test(s.place);
    for (const s of segs) if (open(s) && s.act !== 'sleep' && Math.min(s.t1, dh[1]) - Math.max(s.t0, dh[0]) > 0.05) s.wear = 'the face wrapped against the dust';
  }
  /** replace [t, t+len] of the plan with (act, why) at the place the person is then; a moment on the road moves to the
   *  arrival; returns the start used, or -1 */
  private insertAt(segs: Seg[], t: number, len: number, act: ActivityId, why: string, keep?: (s: Seg) => boolean): number {
    let i = segs.findIndex(s => t < s.t1); if (i < 0) return -1;
    // never into a meal, and never in place of drawing water or of the bread (S5): what is due then comes after it
    while (i < segs.length && (segs[i].where === 'road' || /^(draw_water|knead|bake)$/.test(segs[i].act) || (segs[i].t1 - t < 0.12 && i + 1 < segs.length && segs[i + 1].act !== 'eat'))) { t = segs[i].t1; i++; }
    if (i >= segs.length) return -1;
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
    const kids = P.nurslings(this.pid, d);
    if (!kids.length) return;
    const birthT = kids.some(c => P.persons[c].born === d) ? (segs.find(s => /food after the birth/.test(s.why))?.t1 ?? 24) : -1;
    const infant = kids.some(c => this.ageOf(c) === 0); const r = new HStream(P.seed, S.nurse, this.pid, d);
    const wakeSeg = segs.find(s => s.t0 > 2 && s.act !== 'sleep'); const wake = wakeSeg?.t0 ?? 6; const bedSeg = [...segs].reverse().find(s => s.act !== 'sleep' && s.t1 < 24); const bed = bedSeg?.t1 ?? 21;
    const times: [number, boolean][] = [];
    const nightN = infant ? r.int(IC.night_feeds[0], IC.night_feeds[1]) : r.int(IC.toddler_night_feeds[0], IC.toddler_night_feeds[1]);
    if (birthT >= 0) { for (let t = birthT + 0.2; t < 24; t += lerp(IC.day_feed_every_h[0], IC.day_feed_every_h[1], r.next())) times.push([t, false]); }
    else { for (let k = 0; k < nightN; k++) { const t = k % 2 === 0 ? lerp(0.8, Math.max(1, wake - 1.2), (k + r.next()) / Math.max(1, nightN)) : Math.min(23.6, bed + 1.2 + r.range(0, 1.5)); times.push([t, true]); }
      if (infant) for (let t = wake + r.range(0.1, 0.6); t < bed - 0.3; t += lerp(IC.day_feed_every_h[0], IC.day_feed_every_h[1], r.next())) times.push([t, false]);
      else { const n = r.int(IC.toddler_day_feeds[0], IC.toddler_day_feeds[1]); for (let k = 0; k < n; k++) times.push([lerp(wake + 0.3, bed - 0.5, (k + r.next()) / n), false]); } }
    times.sort((a, b) => a[0] - b[0]);
    const babies = kids.filter(c => this.ageOf(c) === 0), olds = kids.filter(c => this.ageOf(c) > 0), fos = kids.some(c => P.persons[c].nurse === this.pid);
    const what0 = babies.length === 2 && P.persons[babies[0]].twin === babies[1] ? 'nursing the twins' : fos ? (kids.length > 1 ? 'nursing her baby and the motherless child she wet-nurses' : 'nursing the motherless child she wet-nurses')
      : babies.length && olds.length ? 'nursing the baby and the little one' : babies.length ? 'nursing the baby' : 'nursing the little one';
    // a little one of one who stays at home with the house's minder through her working absences (Population.mindDay, the
    // same rule: S2 of shadow review r5) is nursed before she goes and when she is back, not at the field or the workshop
    const hd = this.hd, abs = Population.workAbsences(segs, this.home);
    const minded = (c: number) => hd.minder >= 0 && hd.minder !== this.pid && (this.hh.zone === 'town' || this.hh.zone === 'plain') && P.persons[c].mother === this.pid && P.persons[c].job === 'child'
      && this.ageOf(c) >= 1 && this.ageOf(c) <= 4 && !P.sick(c, d) && P.persons[c].agent < 0;
    const away = (c: number, t: number) => minded(c) && abs.some(([a, b0]) => { const b = Math.min(b0, hd.supper - 0.05, P.toddlerSleep(c, d, 6).bedtime - 0.1); return b - a >= 0.5 && t >= a - 0.02 && t < b; });
    // with a baby at the breast a little one of one or two is nursed with it at a few of its day feeds, as many as a little
    // one alone has (infant_care.toddler_day_feeds; S3 test of r5: 6 day feeds for a child of one beside a newborn; C)
    const dayIdx = times.map((x, i) => [x, i] as [[number, boolean], number]).filter(([x]) => !x[1]).map(([, i]) => i);
    const nTod = babies.length && olds.length ? Math.min(dayIdx.length, IC.toddler_day_feeds[0] + Math.floor(u01(P.seed, S.nurse, this.pid, d, 7) * (IC.toddler_day_feeds[1] - IC.toddler_day_feeds[0] + 1))) : dayIdx.length;
    const todAt = new Set(Array.from({ length: nTod }, (_, k) => dayIdx[Math.min(dayIdx.length - 1, Math.floor((k + 0.5) * dayIdx.length / Math.max(1, nTod)))]));
    const babyOnly = babies.length === 2 && P.persons[babies[0]].twin === babies[1] ? 'nursing the twins' : 'nursing the baby';
    for (let fi = 0; fi < times.length; fi++) { let [t, night] = times[fi]; const len = lerp(IC.feed_h[0], IC.feed_h[1], r.next());
      let what = what0; if (babies.length && olds.length && !night && !todAt.has(fi) && !fos) what = babyOnly;
      if (!night && olds.some(c => away(c, t))) { if (!babies.length) continue; what = babyOnly; }
      let s = segAt(segs, t); if (s.act === 'eat') { t = s.t1 + 0.02; s = segAt(segs, t); if (s.act === 'eat' || t >= 24) continue; } // after her meal
      // at the well she draws first and nurses at home (S5): a feed never takes the place of the water (or of the bread); a
      // feed due on the way is given where she arrives
      for (let g = 0; g < 4 && t < 24 && (s.where === 'road' || /^(draw_water|knead|bake)$/.test(s.act)); g++) { t = s.t1 + 0.01; s = segAt(segs, Math.min(23.999, t)); }
      if (t >= 24 || s.act === 'eat' || /^(draw_water|knead|bake)$/.test(s.act)) continue;
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
      let gap = 0, at = -1, ga = 0, gb = 0, gi = 0;
      // gaps between consecutive meals (and from waking to the first, from the last to bed)
      const pts: [number, number][] = [[wake - 1.5, wake - 1.5], ...eats, [bed + 1, bed + 1]];
      for (let i = 0; i + 1 < pts.length; i++) { const a = Math.max(wake, pts[i][1]), b = Math.min(bed, pts[i + 1][0]); const lim = i === 0 ? 3.5 : i + 2 === pts.length ? 5 : 7; if (b - a > lim && b - a - lim > gap) { gap = b - a - lim; ga = a; gb = b; gi = i; at = i === 0 ? a + 2 : i + 2 === pts.length ? a + 4 : (a + b) / 2; } }
      if (at < 0) return;
      // the moment in the gap nearest its middle when food can be had: not on the road, not asleep, not on watch (a stop
      // in the town on the way, the hour before a long sleep, the hour after a nap)
      // never within an hour of another meal (S4 of shadow review r5: a guard's bread and water 26 min after his breakfast)
      const clearOf = (x: number) => eats.every(([a, b]) => x + 0.35 <= a - 1 + 1e-6 || x >= b + 1 - 1e-6);
      const limL = gi === 0 ? 3.5 : 7, limR = gi + 2 === pts.length ? 5 : 7;
      // a guard's bread and water are at his hearth, not wherever he happens to be (S10, r4: eaten in the forecourt in the
      // wind), but only where they close the gap (S4 r5: the only hearth moment was the quarter hour after his breakfast, so
      // a second gap meal followed at his family's house); otherwise where he is, at his family's table
      const cand = (hearth: boolean) => { let best = -1, bd = 1e9;
        for (const s of segs) { if (s.where === 'road' || ['sleep', 'stand_guard', 'patrol', 'eat', 'lie_ill', 'offmap', 'draw_water', 'knead', 'bake'].includes(s.act) || (hearth && !HEARTHS.includes(s.place))) continue;
          const x0 = Math.max(s.t0, ga), x1 = Math.min(s.t1 - 0.3, gb - 0.3); if (x1 < x0) continue;
          const ok = (x: number) => clearOf(x) && !(hearth && (x - ga > limL || gb - x - 0.35 > limR));
          const xs = [Math.min(Math.max(at, x0), x1)]; for (let x = x0; x <= x1 + 1e-9; x += Math.max(0.05, (x1 - x0) / 40)) xs.push(x);
          for (const x of xs) if (ok(x) && Math.abs(x - at) < bd) { bd = Math.abs(x - at); best = x; } }
        return best; };
      let tt = this.p.job === 'guard' ? cand(true) : -1; if (tt < 0) tt = cand(false);
      if (tt < 0) { tt = at; let i = segs.findIndex(s => tt < s.t1); while (i >= 0 && i < segs.length && segs[i].where === 'road') { tt = segs[i].t1; i++; } if (i >= 0 && i < segs.length && segs[i].act === 'sleep' && segs[i].t0 > wake) tt = segs[i].t0; if (!clearOf(tt)) return; }
      const t = this.insertAt(segs, tt, 0.35, 'eat', 'bread and water', s => s.act === 'stand_guard' || s.act === 'patrol' || (s.act === 'sleep' && tt > s.t0 + 1e-6));
      if (t < 0) return;
    }
  }
  private build0(): Seg[] {
    const P = this.P, p = this.p, d = this.d;
    if (!P.present(this.pid, d)) return [{ t0: 0, t1: 24, place: '-', act: 'offmap', why: d >= p.dies ? `died on day ${p.dies + 1}` : d < p.born ? 'not yet born' : d < p.arrive ? 'not yet come to Persepolis' : 'gone from Persepolis', where: 'away' }];
    if (p.job === 'traveller') return this.traveller();
    if (p.job === 'herder') return this.herderPassing();
    const sick = P.sick(this.pid, d);
    if (sick) return p.job === 'child' && this.age < 5 ? this.small() : this.sickDay();
    const born = P.gaveBirth(this.pid, d);
    if (born === 0) return this.birthDay();
    if (born > 0 && born <= P.postpartumDays(this.pid)) return this.postpartum();
    if (p.job === 'child' && this.age < 5) return this.small();
    if (p.job === 'guard') return this.guard();
    if (P.mourning(this.pid, d)) return this.mourningDay();
    if (P.carerToday(this.pid, d)) return this.homeDay('tending the sick at home', true);
    if (d === p.marry && !p.moved) return this.marriageDay();
    if (P.keeperOn(this.hh.id, d) === this.pid && p.job !== 'child' && p.job !== 'homemaker') return this.homemaker(); // she keeps the house of a dead mother (bereaved)
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
    const woman = p.sex === 'f' && this.homeW !== 'terrace' && H.women.includes(this.pid);
    if (stay) until = Math.max(until, H.breakfast + H.bLen);
    const withHouse = until >= H.breakfast + H.bLen - 0.02;
    const grind = woman ? H.grindEach * hb.grind_morning_share * lerp(0.85, 1.15, u01(this.P.seed, S.fam, this.pid, this.d, 7)) : 0; const bakes = woman && H.bakeAM && H.baker === this.pid && withHouse; if (bakes) this.baked = true;
    const early = lerp(ML.early_bread_h[0], ML.early_bread_h[1], this.r.next());
    const fetch = this.pid === H.waterer && (!woman || !withHouse) && this.homeW !== 'terrace' && !this.C.wx.wet && this.hh.zone !== 'terrace';
    const fetchH = fetch ? 2 * this.P.walkH(this.home, `well:${this.hh.q}`, this.d, this.homeW, this.homeW) + 0.25 : 0;
    const need = 0.05 + fetchH + (withHouse ? 0 : early) + (woman ? Math.min(grind, 1.6) + (bakes ? H.kneadH + H.bakeH : 0) + H.slack : 0);
    const wakeT = Math.min(this.rise(), Math.max(this.sun.rise - (bakes ? 2.1 : 1.6), (withHouse ? H.breakfast : until) - need));
    // a night by the grain heap (S2): the day begins asleep on the threshing floor, and he walks home at first light
    const na = this.segs.length ? null : this.P.nightAway(this.pid, this.d);
    if (na) { const wk = this.P.walkH(na.place, this.home, this.d, na.where, this.homeW); this.add(Math.max(0.2, wakeT - wk), na.place, 'sleep', 'asleep by the grain heap on the threshing floor, guarding it', na.where);
      if (!fetch) this.go(this.home, this.homeW, 'home from the threshing floor at first light'); } // (the one who fetches the water goes from the floor to the well)
    else this.atHome(wakeT, 'sleep', 'asleep');
    if (fetch) this.well(this.t + 0.2, withHouse ? 'fetching the day’s water' : 'fetching the day’s water before work');
    if (woman) {
      const tEnd = withHouse ? H.breakfast : until - early;
      // the bake first, from the flour ground yesterday afternoon for today's bread; then the day's grinding (D-137)
      if (bakes) { const k = Math.min(H.kneadH, Math.max(0.15, (tEnd - this.t) * 0.35)); this.atHome(this.t + k, 'knead', 'kneading the dough'); this.atHome(Math.max(this.t + 0.3, Math.min(tEnd, this.t + H.bakeH)), 'bake', 'baking the flat bread'); }
      if (tEnd - this.t > 0.25) this.atHome(Math.min(tEnd, this.t + grind), 'grind', 'grinding the household’s flour at the quern');
      if (tEnd - this.t > 0.6 && this.hh.zone !== 'terrace' && !this.C.wx.wet && this.adult()) this.well(this.t + 0.25, 'fetching water');
    }
    if (withHouse) { if (this.t < H.breakfast) { if (p.sex === 'm' && this.adult() && this.homeW !== 'terrace' && H.breakfast - this.t > 0.6) this.homeHours(H.breakfast, 'at home'); else this.atHome(H.breakfast, ...this.idle()); } this.atHome(this.t + H.bLen, 'eat', H.bakeAM ? 'breakfast with the household: the new bread' : 'breakfast with the household'); }
    else { if (this.t < until - early) this.atHome(until - early, ...this.idle()); this.atHome(this.t + early, 'eat', this.P.breakfasters(this.hh.id, this.d, this.pid) ? 'bread and water before leaving (the household eats later)' : 'bread and water before leaving'); }
    if (until > this.t) { if (this.adult() && this.homeW !== 'terrace' && until - this.t > 0.5) this.homeHours(until, 'at home'); else this.atHome(until, ...this.idle()); }
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
    const g = this.p.group; if (g < 0) return null; const h = this.C.issue.get(g) ?? this.C.special.get(g); if (h === undefined || this.age < 8) return null;
    const G = this.P.groups[g]; const wq = G.zone === 'terrace' ? 'terrace' : 'town';
    this.go(G.issuePlace, wq, 'going to the issue');
    this.add(Math.max(this.t + 0.1, h), G.issuePlace, 'queue', 'waiting for the ration issue', wq);
    this.dispute(G.issuePlace);
    this.add(this.t + 0.3 + 1.5 * this.r.next(), G.issuePlace, 'queue', `in the queue for ${this.C.issue.has(g) ? 'the monthly ration' : 'a special ration'}`, wq);
    return h;
  }
  /** the midday meal at home with those of the household who are there (lives.json meals) */
  /** idle time at home: a small child plays in the courtyard, an older one is simply at home */
  private idle(): [ActivityId, string] { return this.age < 10 ? ['play', 'playing in the courtyard'] : ['rest', 'at home']; }
  private noonAtHome(why = 'the midday meal with the household') { const H = this.hd;
    if (this.segs.some(s => s.act === 'eat' && s.t0 >= H.noon - 1.2 && s.t0 < this.t)) return; // (eaten already: at home out of the rain, S1 r5)
    if (this.t < H.noon - 0.05) this.idleUntil(H.noon); this.atHome(this.t + H.nLen, 'eat', why); }
  /** evening at home and out: the household's supper together (lives.json meals), then the household's real options
   *  (lives.json evening) */
  private evening(from: number) {
    const p = this.p, r = this.r, C = this.C, E = L.evening, H = this.hd; const bed = Math.max(from + 0.5, this.bed());
    if ((this.cur ?? this.home) === this.home && this.t <= H.supper) from = Math.min(from, H.supper); // at home: the household's supper
    const gPM = p.sex === 'f' && this.homeW !== 'terrace' && H.women.includes(this.pid) && !this.groundPM ? H.grindEach * (1 - L.household_bread.grind_morning_share) : 0;
    if (gPM > 0.2 && (this.cur ?? this.home) === this.home && H.supper - this.t > 0.5) { this.groundPM = true; const g0 = Math.max(this.t, Math.min(from, H.supper) - gPM - 0.4); if (g0 > this.t + 0.3) this.homeHours(g0, 'at home'); this.atHome(Math.min(H.supper - 0.1, this.t + gPM), 'grind', 'grinding for tomorrow’s bread'); }
    if (this.t < from) { if ((this.adult() || this.age >= 12) && this.homeW !== 'terrace') this.homeHours(from, 'at home'); else if (this.age >= 5 && !C.wx.wet && from - this.t > 1) { this.go(`lane:${this.hh.q}`, this.homeW); this.add(from - 0.1, `lane:${this.hh.q}`, 'play', 'playing in the lane', this.homeW); this.go(this.home, this.homeW); } else this.atHome(from, ...this.idle()); }
    let bakeAfter = false;
    if (H.bake && !H.bakeAM && H.baker === this.pid && !this.baked && this.homeW !== 'terrace') { this.baked = true;
      if (this.t < H.supper - 0.8) { const b0 = Math.max(this.t, H.supper - 1.2); if (b0 > this.t) this.homeHours(b0, 'at home'); this.atHome(this.t + 0.35, 'knead', 'kneading the dough'); this.atHome(Math.max(this.t + 0.3, Math.min(H.supper, this.t + 0.5)), 'bake', 'baking the flat bread for tomorrow'); }
      else bakeAfter = true; }
    // home before the evening meal: the household's late afternoon
    const supper = Math.max(this.t, H.supper);
    if (supper - this.t > 1 && this.homeW !== 'terrace') {
      if (this.age < 14 && !H.women.includes(this.pid)) { const cool = C.heatRest ? this.sun.set - 2.5 : 0; // (after the heat breaks: S5 r5)
        if (C.wx.wet || C.wx.dust) this.atHome(supper, 'play', 'playing indoors');
        else { if (cool > this.t + 0.2 && supper - cool > 0.7) this.atHome(cool, 'play', 'playing indoors out of the heat'); if (supper - this.t > 0.5) { this.go(`lane:${this.hh.q}`, this.homeW); this.add(supper - 0.1, `lane:${this.hh.q}`, 'play', 'playing in the lane', this.homeW); this.go(this.home, this.homeW); } else this.atHome(supper, 'play', 'playing indoors out of the heat'); } }
      else if (p.sex === 'f' && H.women.includes(this.pid)) { const g = this.groundPM ? 0 : H.grindEach * (1 - L.household_bread.grind_morning_share); this.groundPM = true; if (g > 0.2) this.atHome(this.t + Math.min(supper - this.t, g), 'grind', 'grinding for tomorrow’s bread'); if (supper - this.t > 0.8 && r.chance(0.5) && !C.wx.wet) this.well(this.t + 0.3, 'fetching water'); if (this.t < supper) this.homeHours(supper, 'at home'); }
      else if (r.chance(0.4) && !C.wx.wet) {
        // the lane after work: not in the dust (W-03), not before the heat breaks on an E-64 day (about 2.5 h before sunset,
        // as homeHours' lane), and an hour or two of it, not the whole afternoon (S5 of shadow review r5: 3 h of knucklebones
        // in the lane through a 40 °C afternoon; was one block until supper)
        const l = `lane:${this.hh.q}`, g = r.chance(0.5), len = r.range(0.8, 2); let s0 = Math.max(this.t, C.heatRest ? this.sun.set - 2.5 : 0); const dh = C.wx.dustH;
        if (dh && s0 < dh[1] && supper - 0.2 > dh[0]) s0 = Math.max(s0, dh[1]);
        if (supper - 0.2 - s0 >= 0.6) { if (s0 > this.t + 0.05) this.homeHours(s0, 'resting at home after work'); this.go(l, this.homeW); this.add(Math.max(this.t + 0.3, Math.min(supper - 0.2, this.t + len)), l, g ? 'gamble' : 'talk', g ? 'knucklebones in the lane' : 'talking in the lane', this.homeW); this.go(this.home, this.homeW); }
        if (this.t < supper - 0.3) this.homeHours(supper, 'resting at home after work'); }
      else this.homeHours(supper, 'resting at home after work');
    }
    const bd = H.birthday >= 0 ? (H.birthday === this.pid ? 'his birthday meal: the day every man values most (HDT 1.133)' : `a birthday meal for ${nameFor(this.P.seed, this.P.persons[H.birthday]) ?? 'a man of the house'} (HDT 1.133)`) : null;
    if (this.t <= H.supper + 0.05) { if (this.t < H.supper) this.idleUntil(H.supper); this.atHome(this.t + H.sLen, 'eat', bd ?? 'the evening meal with the household'); }
    else this.atHome(this.t + Math.max(0.3, H.sLen * 0.7), 'eat', bd ?? 'the evening meal, kept for the late-comer');
    if (bakeAfter) { this.atHome(this.t + 0.35, 'knead', 'kneading the dough'); this.atHome(this.t + 0.45, 'bake', 'baking the flat bread for tomorrow by the evening fire'); }
    if (this.t >= bed - 0.3) return;
    const rain = this.rainIn(this.t, bed) > 0.3 || (!!C.wx.dustH && C.wx.dustH[1] > this.t + 0.2); // (and not in the dust, W-03: S5 r5)
    // an evening outing only when there is time to get there, stay a while and be back before bed
    const room = (pl: string, w: Where) => bed - 0.3 - this.t - 2 * this.P.walkH(this.home, pl, this.d, this.homeW, w) > 0.3;
    const kinEvent = this.kinVisit();
    if (kinEvent && room(kinEvent.place, kinEvent.where)) { this.go(kinEvent.place, kinEvent.where, 'visiting'); this.add(Math.min(bed - 0.3, this.t + kinEvent.h), kinEvent.place, kinEvent.act, kinEvent.why, kinEvent.where); this.go(this.home, this.homeW, 'going home'); }
    else if (!rain && p.sex === 'm' && this.age >= 14 && !this.P.membersOn(this.hh.id, this.d).some(x => x !== this.pid && this.ageOf(x) >= 10) && room(`lane:${this.hh.q}`, this.homeW) && r.chance(0.5)) {
      // a man who lodges alone spends many evenings with the other men in the lane (C)
      const l = `lane:${this.hh.q}`, g = r.chance(0.4); this.go(l, this.homeW); this.add(Math.min(bed - 0.3, this.t + r.range(0.6, 1.8)), l, g ? 'gamble' : 'talk', g ? 'knucklebones with the men of the lane' : 'talking with the men of the lane', this.homeW); this.go(this.home, this.homeW); }
    else if (!rain) {
      const u = r.next();
      // children play out after the meal only in the warm half of the year and only until dusk (C)
      if (this.age < 14) { const dusk = this.sun.set + 0.15; if (u < E.play_children && this.age >= 5 && C.season !== 'winter' && C.wx.tmin >= 6 && dusk - this.t > 0.4) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(Math.max(this.t + 0.2, Math.min(bed - 0.2, dusk - 0.05, this.t + r.range(0.4, 1.2))), l, 'play', 'playing in the lane until dusk', this.homeW); this.go(this.home, this.homeW, 'called in at dusk'); } }
      else if (p.sex === 'f' && this.age < 60 && u < E.well_women * 0.5 && this.homeW !== 'terrace') this.well(this.t + 0.3, 'evening water');
      else if (u < E.visit) { const v = this.visitTarget(); if (v && room(v.place, v.where)) { this.go(v.place, v.where, 'visiting'); this.add(Math.min(bed - 0.3, this.t + r.range(0.8, 2)), v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, this.homeW, 'going home'); } }
      else if (u < E.visit + E.exchange && !C.short.get(p.group)) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(Math.min(bed - 0.3, this.t + r.range(0.4, 1)), l, 'exchange', 'exchanging goods in kind with neighbours', this.homeW); this.go(this.home, this.homeW); }
      else if (p.sex === 'm' && u < E.visit + E.exchange + E.gamble_men) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(Math.min(bed - 0.3, this.t + r.range(0.6, 1.5)), l, 'gamble', 'knucklebones with neighbours', this.homeW); this.go(this.home, this.homeW); }
    }
    if (this.t < bed) { const alone = !this.P.membersOn(this.hh.id, this.d).some(x => x !== this.pid && this.ageOf(x) >= 10);
      this.atHome(bed, alone ? 'rest' : this.age >= 60 || this.age < 14 ? 'rest' : r.chance(0.5) ? 'talk' : 'rest', alone ? 'resting at home' : 'with the household'); }
  }
  /** kin events worth a visit: a birth in a kin household (last 3 days), a death (mourning visit), a kin birthday meal */
  private kinVisit(): { place: string; where: Where; act: ActivityId; why: string; h: number } | null {
    const P = this.P, d = this.d, r = this.r; if (this.age < 14) return null;
    for (const k of this.hh.kin) { const H = P.households[k]; const wh: Where = H.zone === 'plain' ? 'plain' : 'town';
      if (P.walkH(this.home, H.home, d, this.homeW, wh) > 1) continue;
      if (H.deaths.some(x => x === d - 1 || x === d)) { if (r.chance(0.8)) { return { place: H.home, where: wh, act: 'talk', why: 'a mourning visit to kin', h: 1.2 }; } }
      if (H.births.some(x => x < d && d - x <= 3)) { if (r.chance(0.5)) return { place: H.home, where: wh, act: 'talk', why: 'visiting kin with a newborn', h: 1 }; }
      const b = P.membersOn(k, d).find(x => P.persons[x].persian && P.persons[x].bday === d && this.ageOf(x) >= 16);
      if (b !== undefined && r.chance(0.5)) return { place: H.home, where: wh, act: 'eat', why: `at a kinsman’s birthday meal, for its many sweets (HDT 1.133)`, h: 1.5 }; }
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
   *  (W-01: outdoor work stops, people shelter). On the Terrace people shelter under the Gate's roof, in its real spells of
   *  rain (was: the rain's whole span, dry spells and all). A place in the open (a field, a canal, a garden, a pasture, the
   *  fuel ground) has no roof: a passing shower is waited out there, the cloak over the head, but a spell of rain of half
   *  an hour or more, or the day's showers once they have come to half an hour, sends the workers home (or to the refuge
   *  given: the flock to its fold) until it stops; they go back if an hour of the block is left and it is not near dusk,
   *  and otherwise spend the rest of it at home, the household's midday meal with it (S1 of shadow review r5; C). Was:
   *  "sheltering from the rain" in the open field for as long as the rain lasted, five hours on 21408's February day.
   *  `snap`: the block ends at its last slot (the midday meal) when under 9 minutes of work would follow it (the next task
   *  begins after the meal: 654's 4-minute spell on the ramp, S7 of reviewer B) */
  private workBlock(place: string, where: Where, act: ActivityId, why: string, t0: number, t1: number, outdoor = true, lunchPlace = place, noon = 12, mealWhy?: string,
    o: { refuge?: string; refugeW?: Where; toRefuge?: string; stay?: [ActivityId, string]; snap?: boolean } = {}) {
    const C = this.C; this.dispute(place, where); if (this.t < t0) this.add(t0, place, act, why, where);
    const slots: [number, number, ActivityId, string, string, boolean][] = []; const ML = L.meals;
    const mEnd = noon + lerp(ML.midday_work_h[0], ML.midday_work_h[1], this.r.next()) + (C.heatRest ? 0.1 : 0);
    const ateNoon = this.segs.some(s => s.act === 'eat' && s.t0 >= noon - 1.2 && s.t0 <= this.t + 1e-6);
    if (!ateNoon && t0 < noon + 0.75 && t1 > Math.max(noon, t0) + 0.3) slots.push([Math.max(noon, t0), Math.min(t1, mEnd + Math.max(0, t0 - noon)), 'eat', mealWhy ?? (where === 'terrace' ? 'the midday meal: the camp’s bread and water' : 'the midday meal'), lunchPlace, false]);
    if (C.heatRest && outdoor && t1 > noon + 0.5 && t0 < 14.75) slots.push([Math.max(noon, t0 < noon ? mEnd : t0), Math.min(t1, 15), 'rest', 'midday rest in the shade (E-64)', lunchPlace, false]);
    if (outdoor && C.wx.rain) for (const [a0, b0] of rainSpells(C.wx)) { const a = Math.max(this.t, a0), b = Math.min(t1, b0); if (b - a < 0.02) continue;
      if (where === 'terrace') { slots.push([a, b, 'shelter', 'sheltering from the rain under the Gate’s roof (W-01)', 'gate_hall', false]); continue; }
      if ((b0 - a0 >= 0.5 && b - a >= 0.2) || this.openShelter + (b - a) > 0.5) slots.push([a, b, 'shelter', '', place, true]);
      else { slots.push([a, b, 'shelter', `waiting out the shower ${this.edgeOf(place)}, the cloak drawn over the head (W-01)`, place, false]); this.openShelter += b - a; } }
    slots.sort((a, b) => a[0] - b[0]);
    for (const [a, b, sa, sw, sp, home] of slots) { if (b <= this.t) continue;
      if (sa === 'eat' && this.segs.some(s => s.act === 'eat' && s.t0 >= noon - 1.2)) continue; // (eaten at home out of the rain)
      if (a > this.t) this.add(a, place, act, why, where);
      if (!home) { this.add(b, sp, sa, sw, where); continue; }
      const refuge = o.refuge ?? this.home, rW = o.refugeW ?? this.homeW, walk = this.P.walkH(place, refuge, this.d, where, rW);
      if (walk > 0.5) { this.add(b, place, 'shelter', 'sheltering from the rain in the watchers’ reed hut at the field edge (W-01)', where); continue; } // no house within half an hour (C)
      this.go(refuge, rW, o.toRefuge ?? (refuge === this.home ? 'home out of the rain' : 'walking'));
      const back = t1 - b >= 1 && b + walk < this.sun.set - 1;
      const until = Math.max(this.t, back ? b : t1);
      if (refuge === this.home) this.rainHome(until); else if (until > this.t) this.add(until, refuge, o.stay?.[0] ?? 'rest', o.stay?.[1] ?? 'out of the rain', rW);
      if (!back) return;
      this.go(place, where, `back ${this.toward(place)} after the rain`);
    }
    if (o.snap && t1 - this.t < 0.15 && this.segs[this.segs.length - 1]?.act === 'eat') return;
    this.add(t1, place, act, why, where);
  }
  /** the day's showers waited out so far in the open (workBlock: past half an hour, a shower sends them home) */
  private openShelter = 0;
  /** at home out of the rain until `until`: the household's hours (a child's play indoors), and the household's midday meal
   *  when it falls in them and it has not been eaten */
  private rainHome(until: number) {
    const H = this.hd, ate = () => this.segs.some(s => s.act === 'eat' && s.t0 >= H.noon - 1.2);
    const idle = (t1: number) => { if (t1 <= this.t) return; if (this.adult()) this.homeHours(t1, 'at home out of the rain'); else this.atHome(t1, this.age < 10 ? 'play' : 'rest', this.age < 10 ? 'playing indoors out of the rain' : 'at home out of the rain'); };
    if (!ate() && H.noon >= this.t - 0.3 && H.noon < until - 0.3) { idle(H.noon); this.atHome(this.t + H.nLen, 'eat', 'the midday meal with the household, home out of the rain'); }
    idle(until);
  }
  /** where in the open a shower is waited out */
  private edgeOf(place: string) { return place.startsWith('field') || place.startsWith('estate') || place === 'crown_fields' ? 'at the field edge' : place.startsWith('canal') ? 'on the canal bank' : place.startsWith('garden') || place.startsWith('orchard') || place.endsWith(':trees') ? 'under the trees'
    : place.startsWith('vineyard') ? 'among the vines' : place.startsWith('pasture') ? 'with the animals' : place.startsWith('threshing') ? 'by the threshing floor' : 'in the lee of a bank'; }
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
    const p = this.p, r = this.r, C = this.C; this.dayOff = p.sex === 'f' && !['homemaker', 'elder', 'child'].includes(p.job); this.morning(this.rise() + 1.2, true);
    this.rationRun(); this.go(this.home, this.homeW);
    const rain = this.rainIn(this.t, 17) > 0.5 || C.wx.storm || C.wx.wet;
    const dustAt = (a: number, b: number) => !!C.wx.dustH && C.wx.dustH[0] < b && C.wx.dustH[1] > a; // W-03 (S5 r5)
    if (!stayIn && !rain && this.adult()) {
      const u = r.next();
      if (u < 0.3) { const v = this.visitTarget(); if (v) { this.go(v.place, v.where, 'visiting'); this.add(this.t + r.range(1, 2.5), v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, this.homeW); } }
      else if (u < 0.5) { if (!dustAt(this.t, this.t + 1.5)) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(this.t + r.range(0.5, 1.5), l, 'exchange', 'exchanging ration goods in kind', this.homeW); this.go(this.home, this.homeW); } }
      else if (u < 0.65 && p.sex === 'f') this.well(this.t + 0.4, 'fetching water');
      else if (u < 0.8 && p.sex === 'm' && !dustAt(this.t, this.t + 2)) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(this.t + r.range(0.8, 2), l, 'gamble', 'knucklebones in the lane', this.homeW); this.go(this.home, this.homeW); }
    }
    const hw = stayIn || /^at home/.test(why) ? why : `at home: ${why}`;
    if (this.t < this.hd.noon - 0.3) { if (p.sex === 'f' && this.adult()) this.homeHours(this.hd.noon, hw); else if (p.sex === 'm' && this.adult() && !stayIn) this.homeHours(this.hd.noon, hw); else this.atHome(this.hd.noon, 'rest', hw); }
    this.noonAtHome(); if (this.adult() && !stayIn) this.homeHours(15 + r.range(0, 1)); else this.atHome(Math.max(this.t, 15 + r.range(0, 1)), 'rest', stayIn ? why : 'resting at home');
    if (!stayIn && !rain && this.adult() && r.chance(0.35) && !dustAt(this.t, this.t + 1.5) && !(C.heatRest && this.t < this.sun.set - 2.5)) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(this.t + r.range(0.5, 1.5), l, 'talk', 'talking with neighbours in the lane', this.homeW); this.go(this.home, this.homeW); }
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
    const hk = P.keeperOn(hid, d);
    const ok = (x: number) => x !== this.pid && mem.includes(x) && (this.ageOf(x) >= 12 || x === hk) && P.persons[x].job !== 'guard';
    const nurseNow = this.p.nurse !== undefined && d >= this.p.marry && ok(this.p.nurse) ? this.p.nurse : undefined;
    let m = this.p.mother >= 0 && ok(this.p.mother) ? this.p.mother : nurseNow ?? (hk >= 0 && ok(hk) ? hk : undefined) ?? mem.find(x => ok(x) && P.persons[x].sex === 'f' && this.ageOf(x) >= 14);
    if (m === undefined) m = mem.find(ok);
    let base = home, baseW = this.homeW, taken = '';
    if (m === undefined) { // no one at home to mind the child: it is with a kinswoman in her house (C)
      for (const k of this.hh.kin) { const kw = P.membersOn(k, d).find(x => P.persons[x].sex === 'f' && this.ageOf(x) >= 14 && P.persons[x].job !== 'guard'); if (kw !== undefined) { m = kw; const KH = P.households[k]; base = KH.home; baseW = KH.zone === 'plain' ? 'plain' : 'town'; taken = ' (taken in by kin)'; break; } }
      if (m === undefined) { const q = P.quarters[this.hh.q]; m = q?.women.find(x => P.present(x, d) && !P.sick(x, d)); if (m !== undefined) { const KH = P.households[P.home(m, d)]; base = KH.home; baseW = KH.zone === 'plain' ? 'plain' : 'town'; taken = ' (taken in by a neighbour)'; } }
      if (m === undefined) return this.finish();
    }
    const ms = P.plan(m, d); const Mo = P.persons[m]; const inf = this.age === 0; const ill = P.sick(this.pid, d);
    // the one minding it is ill today (up, recovering, or lying ill): the child's line says so (S8 of shadow review r5: "in
    // the mother's lap" all day while her own line read "sitting up, recovering")
    const momNote = P.sick(m, d) ? `, ${m === this.p.mother ? 'the mother' : 'she'} recovering from an illness` : '';
    // the words for the one minding the child (the mother, the wet nurse, the father, the elder sister, ...)
    const relOf = (x: number) => { const X = P.persons[x]; return x === this.p.mother ? 'the mother' : x === nurseNow ? 'the wet nurse' : X.sex === 'm' ? (this.ageOf(x) >= 55 ? 'the grandfather' : this.ageOf(x) >= 18 ? 'the father' : 'the elder brother')
      : this.ageOf(x) < 16 ? 'the elder sister' : X.job === 'elder' ? 'the grandmother' : x === hk ? 'the kinswoman keeping the house' : 'the woman minding it'; };
    const rel = relOf(m);
    const relS = `${rel}’s`, she = Mo.sex === 'm' ? 'he' : 'she';
    const lactating = m === this.p.mother || m === nurseNow;
    const illness = () => { if (ill) for (const s of this.segs) if ((s.act === 'play' || s.act === 'rest') && s.where !== 'road') { s.act = 'lie_ill'; s.why = `ill, lying beside ${s.with !== undefined && s.with !== m ? relOf(s.with) : rel}`; } return this.segs; };
    const wakeM = ms.find(s => s.t0 > 2 && s.act !== 'sleep' && !/ in the night/.test(s.why))?.t0 ?? 6;
    const nursing = (s: Seg) => /nurs/.test(s.why) && (s.act === 'rest' || s.act === 'lie_ill');
    const outdoorWork: ActivityId[] = ['reap', 'thresh', 'field_work', 'pick_fruit', 'draw_water', 'wash', 'carry_sack', 'carry_jar', 'carry_jar_head', 'haul', 'herd', 'plough', 'irrigate', 'dig_canal', 'garden_work', 'queue', 'exchange', 'tend_animals'];
    if (inf) { // ---- an infant
      const twins = this.p.twin !== undefined && P.present(this.p.twin, d) && P.home(this.p.twin, d) === hid ? [this.p.twin] : [];
      const front = twins.some(c => c < this.pid); const carried = front ? `at ${relS} front` : `on ${relS} back`;
      // the baby's sleep by its age (S5, r4; lives.json infant_care.sleep, C): under four months it is awake a short while
      // after each feed and asleep until the next, wherever she is (14-17 h in 24); from four months three naps (from six
      // later and shorter) and asleep from soon after sunset.
      // Was: asleep only when she slept or at three fixed naps (a baby of two months awake 5.5 h at a stretch)
      const IS = L.infant_care.sleep, ageD = this.p.born >= 0 ? d - this.p.born : this.p.bday >= 0 ? d + REGNAL_DAYS - this.p.bday : 200;
      const feedsM = lactating ? ms.filter(s => nursing(s) && !/ in the night/.test(s.why)) : [];
      const row = (IS.wake_after_feed_h as [number, number, number][]).find(x => ageD < x[0]);
      const awakeAfter = row ? lerp(row[1], row[2], u01(P.seed, S.nurse, this.pid, d, 3)) : 0, cycle = !!row && feedsM.length >= 3;
      // awake from each feed until `awakeAfter` past it, but when the feeds come close together the time awake runs on from
      // the last waking and it falls asleep at the breast once it has been awake the longest it stays awake at its age
      // (the row's upper bound + awake_max_extra_h, C): so no chain of feeds keeps it awake for hours
      const wMax = row ? row[2] + IS.awake_max_extra_h : 0, awakeIv: [number, number][] = [];
      if (cycle) { let since = -1, end = -1; for (const f of feedsM) { const a = f.t0 - 0.02; if (a >= end) since = a; const e = Math.max(f.t1, Math.min(f.t1 + awakeAfter, since + wMax));
        if (a < end && awakeIv.length) awakeIv[awakeIv.length - 1][1] = Math.max(end, e); else awakeIv.push([a, e]); end = Math.max(end, e); } }
      const nt = (ageD < 180 ? IS.naps_from_4_months : IS.naps_from_6_months) as [number, number][];
      const naps: [number, number][] = cycle ? [] : nt.map(([a, b], i) => (i === 0 ? [wakeM + a, wakeM + b] : [a, b]) as [number, number]);
      const babyBed = cycle ? 99 : this.sun.set + IS.bed_after_sunset_h; // from four months asleep in the evening before her
      const napAt = (t: number) => cycle ? !awakeIv.some(([a, b]) => t >= a && t < b) : t >= babyBed || naps.some(([a, b]) => t >= a && t < b);
      const cuts = [...new Set([...ms.map(s => s.t1), ...[...naps.flat(), babyBed, ...awakeIv.map(x => x[1])].filter(x => x > 0 && x < 24)])].sort((a, b) => a - b);
      let t0 = 0;
      const bornT = this.p.born === d ? (ms.find(x => /food after the birth/.test(x.why))?.t0 ?? 0) : -1; // before the birth: not yet born
      for (const t1 of cuts) { if (t1 <= t0) continue; const mid = (t0 + t1) / 2; t0 = t1; const M = segAt(ms, mid); const nap = napAt(mid);
        if (mid < bornT) { this.add(t1, '-', 'offmap', 'not yet born', 'away'); continue; }
        let a: ActivityId, why: string;
        if (nursing(M) && lactating) { a = 'eat'; why = twins.length ? 'nursed with the twin' : `nursed by ${rel}`; }
        else if (M.act === 'sleep' || / in the night/.test(M.why)) { a = 'sleep'; why = `asleep beside ${rel}`; }
        else if (M.act === 'lie_ill') { const night = mid < wakeM || mid > 20; const birth = /birth|newborn/.test(M.why); a = nap || night || birth ? 'sleep' : 'rest'; why = birth ? `asleep beside ${rel}, newborn` : a === 'sleep' ? `asleep beside ${rel}, who is ill` : `lying beside ${rel}, who is ill`; }
        // (from six months a little softened bread from her hand at the household's meal as well as the breast: B's note on S2,
        // shadow review r5, Q-061; C)
        else if (M.act === 'eat') { a = nap ? 'sleep' : this.ageD >= 180 && lactating ? 'eat' : 'rest'; why = nap ? `asleep in ${relS} lap at the meal${momNote}` : a === 'eat' ? `a little softened bread from ${relS} hand at the meal` : `in ${relS} lap at the meal${momNote}`; }
        else if (M.where === 'road' || M.act === 'walk') { a = nap ? 'sleep' : 'rest'; why = nap ? `asleep, carried ${carried}` : `carried ${carried}`; }
        else if (outdoorWork.includes(M.act)) { a = nap ? 'sleep' : 'rest'; why = `${nap ? 'asleep ' : ''}${carried} while ${she} works`; }
        else if (['talk', 'rest', 'gamble', 'play', 'shelter', 'inspect'].includes(M.act)) { a = nap ? 'sleep' : 'rest'; why = (nap ? `asleep in ${relS} lap` : `in ${relS} lap`) + momNote; }
        else { a = nap ? 'sleep' : 'rest'; why = nap ? `asleep on a mat beside ${rel} while ${she} works` : `lying on a mat beside ${rel} while ${she} works`; }
        const last = this.segs[this.segs.length - 1]; this.add(t1, M.place, a, why + taken, M.where, !!last && last.why !== why + taken); this.segs[this.segs.length - 1].with = m; }
      if (!lactating) { // no one to nurse it: fed by the one minding it, by day and by night (goat's milk and softened bread; C)
        const IC = L.infant_care, bed = Math.min(22, this.sun.set + 2.5); const ts: number[] = [lerp(1, 3, this.r.next()), lerp(3.5, Math.max(3.6, wakeM - 0.3), this.r.next())];
        for (let t = wakeM + this.r.range(0.2, 0.6); t < bed; t += lerp(IC.day_feed_every_h[0], IC.day_feed_every_h[1], this.r.next()) + 0.4) ts.push(t);
        for (const t of ts) this.insertAt(this.segs, t, lerp(IC.feed_h[0], IC.feed_h[1], this.r.next()), 'eat', `fed goat’s milk and softened bread by ${rel}${taken}`, s => s.act === 'eat'); }
      return illness();
    }
    // ---- a toddler (1-4)
    // its sleep (a morning sleep at one, often, or two, now and then; the midday sleep, longer in the heat, shorter after a
    // morning sleep; bedtime after the evening meal: Population.toddlerSleep, C), and its spells with the house's child-minder
    // (Population.mindDay: S2 of shadow review r5), which the minder's own plan holds too
    const hd = P.hday(hid, d); const { bedtime, wakeT, napAM, napW } = P.toddlerSleep(this.pid, d, wakeM);
    const mySp = !taken && !ill ? P.mindDay(hid, d).little.get(this.pid) ?? [] : [];
    const inSp = (x: number, y: number) => mySp.some(s => s.t0 < y && s.t1 > x);
    const sib = mem.find(x => x !== this.pid && P.persons[x].job === 'child' && this.ageOf(x) >= 6 && this.ageOf(x) <= 13);
    const ss = sib !== undefined ? P.plan(sib, d) : null;
    // while the mother works away for hours, a toddler goes along or is left with a grandparent at home or with a kinswoman (C)
    const elder = mem.find(x => ok(x) && P.persons[x].job === 'elder' && !P.sick(x, d) && !P.mourning(x, d));
    const eAll = elder !== undefined ? P.plan(elder, d) : null; const es = eAll && this.r.chance(U.along_with_grandparent) ? eAll : null;
    const kinH = this.hh.kin.length ? P.households[this.hh.kin[Math.floor(u01(P.seed, S.assign, this.pid, d) * this.hh.kin.length)]] : null;
    const kw = kinH && kinH.zone !== 'terrace' && kinH.zone !== 'transient' ? P.membersOn(kinH.id, d).find(x => P.persons[x].sex === 'f' && this.ageOf(x) >= 14 && P.persons[x].job !== 'guard' && !P.sick(x, d)) : undefined;
    // the mother's long working absences from home (2 h or more, with work in them)
    const blocks: [number, number][] = []; { let a = -1; for (const s of ms) { if (s.place !== base) { if (a < 0) a = s.t0; } else if (a >= 0) { blocks.push([a, s.t0]); a = -1; } } if (a >= 0) blocks.push([a, 24]); }
    const workBlocks = blocks.filter(([a, b]) => b - a >= 2 && ms.some(s => s.t0 < b && s.t1 > a && !['talk', 'eat', 'rest', 'queue', 'gamble', 'exchange', 'play', 'walk', 'shelter'].includes(s.act) && s.where !== 'road'));
    const homeBound = (x: number | undefined) => { if (x === undefined) return false; const xs = P.plan(x, d), xh = P.households[P.home(x, d)].home; let tot = 0, home = 0;
      for (const [a, b] of workBlocks) for (let h = a + 0.25; h < b; h += 0.5) { tot++; if (segAt(xs, h).place === xh) home++; } return tot > 0 && home / tot >= 0.7; };
    // (the house's minder has it through the mother's working absences: mySp; a grandparent or a kinswoman otherwise)
    const minderPid = !workBlocks.length || workBlocks.every(([a, b]) => inSp(a + 0.05, b - 0.05)) ? undefined : !this.r.chance(U.left_with_minder) ? undefined : homeBound(elder) ? elder : homeBound(kw) ? kw : undefined;
    const mAll = minderPid === undefined ? null : minderPid === elder ? eAll : P.plan(minderPid, d);
    const minderWhy = minderPid === undefined ? '' : minderPid === elder ? `with the grandparent while ${rel} works` : `with a kinswoman while ${rel} works`;
    // the feeds that are this child's: all of them when it is the youngest she nurses, and a wet-nursed child's always
    const myFeeds = lactating && this.age === 1 && (m === nurseNow || !P.nurslings(m, d).some(c => c !== this.pid && this.ageOf(c) === 0));
    // on some days the small ones are taken outside the door to play with the neighbours' children, or to a neighbour's or
    // a kinswoman's house in the same lane while the mother works at home; not in rain, and not while a storm or the dust is
    // in the air (W-02, W-03): by the weather's own hours, so a morning before the dust rises and an evening after a storm
    // are like any other (D-140; was: kept in the whole day) (C)
    const wxS = this.C.wx; const keepIn = (h: number) => (!!wxS.stormH && h >= wxS.stormH[0] - 0.25 && h < wxS.stormH[1] + 0.25) || (!!wxS.dustH && h >= wxS.dustH[0] && h < wxS.dustH[1]);
    /** the span a woman is awake at her house around the hour t (her spells there one after another), or null */
    const homeRun = (xs: Seg[], at: string, t: number): [number, number] | null => { const i = xs.findIndex(s => t < s.t1); const up = (s: Seg) => s.place === at && s.act !== 'sleep' && s.act !== 'lie_ill' && !/ in the night/.test(s.why);
      if (i < 0 || !up(xs[i])) return null; let a = i, b = i; while (a > 0 && up(xs[a - 1])) a--; while (b + 1 < xs.length && up(xs[b + 1])) b++; return [xs[a].t0, xs[b].t1]; };
    const outing = (am: boolean) => taken || ill ? null : (() => {
      const k = this.choose((this.age >= 3 ? U.outing_from_3 : U.outing) as Record<'none' | 'lane' | 'neighbour' | 'kin', number>); if (k === 'none') return null;
      const cool = this.C.heatRest || this.C.wx.tmax >= 31 ? 16.3 : 0; // after the heat of the day (E-64)
      const h0 = am ? this.r.range(7.5, 10) : this.r.range(Math.max(napW[1] + 0.2, cool), Math.max(napW[1] + 0.3, cool + 0.1, this.sun.set - 2)); let h1 = Math.min(am ? napW[0] - 0.3 : this.sun.set - 0.3, h0 + this.r.range(U.outing_h[0], U.outing_h[1]));
      if (keepIn(h0)) return null;
      // only while the one minding it stays at home and is not at a meal: the child is fetched in for meals, and called in
      // when the dust rises or a storm comes on
      { let e = h0; while (e < h1) { const g = segAt(ms, e + 0.01); if (g.place !== base || g.act === 'eat' || g.act === 'sleep' || / in the night/.test(g.why) || (this.age === 1 && nursing(g)) || keepIn(e + 0.01)) break; e += 0.1; } h1 = Math.min(h1, e - 0.05); }
      if (h1 - h0 < 0.4 || this.rainIn(h0, h1) > 0) return null;
      if (k !== 'lane') { const cand = (k === 'kin' ? this.hh.kin : Mo.ties.map(o => P.home(o, d))).map(h => P.households[h]).filter(H => H.id !== this.hh.id && H.q === this.hh.q && H.zone === this.hh.zone);
        const Hh = cand.length ? cand[Math.floor(this.r.next() * cand.length)] : null; const mid = (h0 + h1) / 2;
        const w = Hh ? P.membersOn(Hh.id, d).find(x => P.persons[x].sex === 'f' && this.ageOf(x) >= 14 && !!homeRun(P.plan(x, d), Hh.home, mid)) : undefined;
        // the child stays while she is at home (her spells there one after another, not only the one she is in at the middle:
        // D-140); when she is not at home long enough, it plays in the lane with the other children instead
        const run = Hh && w !== undefined ? homeRun(P.plan(w, d), Hh.home, mid)! : null;
        if (Hh && run && Math.min(h1, run[1]) - Math.max(h0, run[0]) >= 0.4) return { h0: Math.max(h0, run[0]), h1: Math.min(h1, run[1]), place: Hh.home, host: w!,
          why: k === 'kin' ? 'at a kinswoman’s house in the lane, playing with her children' : 'playing at a neighbour’s house with their children' }; }
      // from two a child plays in the lane with the neighbours' children, the older ones watching the small; a child of one on
      // the doorstep, the one minding them inside (C)
      return this.age >= 2 ? { h0, h1, place: `lane:${this.hh.q}`, why: 'playing in the lane with the neighbours’ children, the older ones watching the small', host: -1 }
        : { h0, h1, place: base, why: this.age < 2 ? `playing on the doorstep with the neighbours’ children, ${rel} inside` : `playing outside the door with the neighbours’ children, ${rel} within call`, host: m! }; })();
    // the walk there and back along the lane is part of the outing (with the other children)
    const outWs = [outing(true), outing(false)].filter((x): x is NonNullable<typeof x> => !!x && x.h1 - x.h0 >= 0.4 && !inSp(x.h0, x.h1))
      .map(o => ({ ...o, wk: o.place === base ? 0 : Math.min(0.2, (o.h1 - o.h0) / 3, P.walkH(base, o.place, d, baseW, baseW)) }));
    const plans = new Map<number, Seg[]>(); const planOf = (x: number) => plans.get(x) ?? plans.set(x, P.plan(x, d)).get(x)!;
    const wet = (h: number) => { const w = this.C.wx.rain; return !!w && h >= w[0] && h < w[1]; };
    // outings with a sibling or the grandparent are taken whole: from the door and back, while the mother is at home
    // (and not feeding the child), outside the midday sleep, before bedtime, not in rain
    const outings = (xs: Seg[] | null, ok: (x: Seg) => boolean) => { const out: [number, number][] = []; if (!xs) return out; let a = -1, good = true;
      for (const x of xs) { if (x.place !== base) { if (a < 0) { a = x.t0; good = true; } if (x.where !== 'road' && !ok(x)) good = false; } else if (a >= 0) { if (good) out.push([a, x.t0]); a = -1; } } return out; };
    const clear = ([x, y]: [number, number]) => { if (y - x < 0.4 || x < wakeT || y > bedtime - 0.2 || (x < napW[1] && y > napW[0]) || (x < napAM[1] && y > napAM[0]) || ill || inSp(x, y)) return false; const w = this.C.wx.rain; if (w && w[0] < y && w[1] > x) return false;
      for (let h = x; h < y; h += 0.1) { const M = segAt(ms, h); if (M.place !== base || (this.age === 1 && nursing(M)) || keepIn(h)) return false; } return true; };
    const sibSpans = outings(ss, x => x.act === 'play' && (x.place.startsWith('lane:') || x.place.startsWith('garden:') || x.place.startsWith('canal:'))).filter(clear);
    const eSpans = outings(es, x => ['talk', 'exchange', 'eat'].includes(x.act)).filter(sp => sp[0] > 6 && sp[1] < this.sun.set && clear(sp));
    // a child kept at a kinswoman's house is taken there along the lane and fetched home (S4); only a kinswoman of another
    // house (S10, r4: a sister or grandparent out at the block's middle gave a walk "to the kinswoman's house" and back home)
    const keptWalk = (x: number) => { if (minderPid === undefined || minderPid !== kw || !mAll) return null; const bl = workBlocks.find(([a, b]) => x >= a && x < b); if (!bl) return null; const gp = segAt(mAll, (bl[0] + bl[1]) / 2).place;
      if (gp === base || gp.startsWith('road:')) return null; const wk = Math.min(0.2, (bl[1] - bl[0]) / 4, P.walkH(base, gp, d, baseW, baseW)); return { a: bl[0], b: bl[1], wk }; };
    const keptCuts = workBlocks.flatMap(([a, b]) => { const k = keptWalk((a + b) / 2); return k ? [a + k.wk, b - k.wk] : []; });
    const cuts = [...new Set([...keptCuts, ...mySp.flatMap(s => [s.t0, s.t1]), ...ms.map(s => s.t1), ...(ss ? ss.map(s => s.t1) : []), ...(es ? es.map(s => s.t1) : []), ...(mAll ? mAll.map(s => s.t1) : []), ...outWs.flatMap(o => [o.h0, o.h1, o.h0 + o.wk, o.h1 - o.wk]), ...napW, ...napAM.filter(x => x > 0), bedtime, wakeT, ...workBlocks.flat()])].filter(x => x > 0 && x <= 24).sort((a, b) => a - b);
    let t0 = 0;
    const put = (t1: number, place: string, a: ActivityId, why: string, where: Where, w: number) => { if (t1 <= this.t + 1e-4) return; const prev = this.segs[this.segs.length - 1];
      if (prev && t1 - this.t < 0.03 && prev.place === place && (prev.with ?? -1) === w && t1 < 24) { prev.t1 = t1; this.t = t1; return; } const last = this.segs[this.segs.length - 1]; this.add(t1, place, a, why + taken, where, !!last && ((last.with ?? -1) !== w || last.why !== why + taken)); const L0 = this.segs[this.segs.length - 1]; if (w >= 0) L0.with = w; else delete L0.with; };
    for (const t1 of cuts) {
      if (t1 <= t0) continue; const mid = (t0 + t1) / 2; const M = segAt(ms, mid); t0 = t1;
      const napping = (mid >= napW[0] && mid < napW[1]) || (mid >= napAM[0] && mid < napAM[1]);
      const moving = M.where === 'road' || M.act === 'walk';
      if (myFeeds && / in the night/.test(M.why) && nursing(M)) { put(t1, M.place, 'eat', 'nursed in the night, half asleep', M.where, m); continue; }
      const sp0 = mySp.find(s => mid >= s.t0 && mid < s.t1); if (sp0) { put(t1, sp0.place, sp0.act, sp0.why, sp0.where, sp0.with!); continue; } // with the house's minder
      if (M.act === 'sleep' || / in the night/.test(M.why) || (M.place === base && ((mid >= bedtime && mid > 12) || mid < wakeT))) { put(t1, M.place, 'sleep', 'asleep', M.where, m); continue; }
      if (mid >= bedtime && mid > 12) { // the mother is out after the child's bedtime: a child already at home sleeps there with
        // another of the house; a child out with her falls asleep where she is and is carried home by her (S4)
        const here = this.segs[this.segs.length - 1]?.place ?? base; const other = here === base ? mem.find(x => ok(x) && x !== m && segAt(planOf(x), mid).place === base) : undefined;
        if (other !== undefined) put(t1, base, 'sleep', 'asleep at home', baseW, other); else put(t1, M.place, 'sleep', moving ? `asleep, carried home by ${rel}` : `asleep in ${relS} lap${M.why.startsWith('at ') ? ', ' + M.why : ''}`, M.where, m); continue; }
      if (minderPid !== undefined && mAll && workBlocks.some(([a, b]) => mid >= a && mid < b) && mid > 4.5 && mid < bedtime) { const G = segAt(mAll, mid);
        const kw0 = keptWalk(mid); if (kw0 && (mid < kw0.a + kw0.wk || mid > kw0.b - kw0.wk)) { const back = mid > kw0.b - kw0.wk; put(t1, `road:${baseW}`, this.age >= 2 ? 'walk' : 'rest', back ? 'fetched home along the lane' : 'taken along the lane to the kinswoman’s house', 'road', -1); continue; }
        const a: ActivityId = G.act === 'sleep' || (napping && G.where !== 'road') ? 'sleep' : G.where === 'road' ? (this.age >= 2 ? 'walk' : 'rest') : G.act === 'eat' ? 'eat' : 'play';
        put(t1, G.place, a, a === 'sleep' ? `a midday sleep, ${minderWhy}` : a === 'rest' ? `carried, ${minderWhy}` : minderWhy, G.where, minderPid); continue; }
      if (this.age === 1 && lactating && nursing(M) && (myFeeds || /little one/.test(M.why))) { put(t1, M.place, 'eat', `nursed by ${rel}`, M.where, m); continue; }
      if (M.place !== base && M.act !== 'lie_ill') {
        const a: ActivityId = M.act === 'eat' ? 'eat' : moving ? (this.age >= 2 ? 'walk' : 'rest') : napping ? 'sleep' : 'play';
        const ctx = /^(at a |visiting |a mourning visit|visiting kin)/.test(M.why) ? `, ${M.why}` : '';
        put(t1, M.place, a, a === 'eat' ? `eating with ${rel}${ctx}` : a === 'walk' ? `walking with ${rel}` : a === 'rest' ? `carried by ${rel}` : a === 'sleep' ? (mid < 11.5 ? `a morning sleep near ${rel}` : `a midday sleep near ${rel}`) : `playing near ${rel}${ctx}`, M.where, m); continue; }
      // a whole outing with an older brother or sister, or with the grandparent, from leaving the door to coming back
      const sp = sibSpans.find(([x, y]) => mid >= x && mid < y);
      if (sp) { const S2 = segAt(ss!, mid), road = S2.where === 'road', sw = P.persons[sib!].sex === 'f' ? 'the elder sister' : 'the elder brother'; // (S10, r4: was "an older brother or sister" for a known sister)
        put(t1, S2.place, road ? (this.age >= 2 ? 'walk' : 'rest') : 'play', road ? (this.age >= 2 ? `walking with ${sw}` : `carried by ${sw}`) : `taken along by ${sw}`, S2.where, sib!); continue; }
      const ep = eSpans.find(([x, y]) => mid >= x && mid < y);
      if (ep) { const E2 = segAt(es!, mid), road = E2.where === 'road'; put(t1, E2.place, road ? (this.age >= 2 ? 'walk' : 'rest') : E2.act === 'eat' ? 'eat' : 'play', road ? (this.age >= 2 ? 'walking with the grandparent' : 'carried by the grandparent') : E2.act === 'eat' ? 'eating with the grandparent' : 'along with the grandparent', E2.where, elder!); continue; }
      const outW = outWs.find(o => mid >= o.h0 && mid < o.h1 && !(napping && o.place === base) && ![...sibSpans, ...eSpans].some(([x, y]) => x < o.h1 && y > o.h0));
      if (outW) { if (outW.wk > 0 && (mid < outW.h0 + outW.wk || mid > outW.h1 - outW.wk)) { const back = mid > outW.h1 - outW.wk;
          put(t1, `road:${baseW}`, 'walk', outW.place.startsWith('lane') ? (back ? 'walking home along the lane with the other children' : 'walking along the lane with the other children') : back ? 'walking home along the lane from the neighbour’s house' : 'walking along the lane to a neighbour’s house', 'road', -1); continue; }
        put(t1, outW.place, 'play', outW.why, baseW, outW.host); continue; }
      // a child of one is on the back of the one minding it while she grinds, kneads, bakes or washes (C)
      if (this.age === 1 && !napping && ['grind', 'knead', 'bake', 'wash'].includes(M.act) && M.with === undefined) { put(t1, base, 'rest', `carried on ${relS} back while ${she} works`, baseW, m); continue; }
      const a: ActivityId = M.act === 'eat' ? 'eat' : napping ? 'sleep' : 'play';
      put(t1, base, a, a === 'sleep' ? (mid < 11.5 ? 'a morning sleep' : 'a midday sleep') : a === 'eat' ? 'a meal with the household' : (wet(mid) ? 'playing indoors out of the rain' : `playing at home near ${rel}`) + momNote, baseW, m);
    }
    // no change of place without a walk: where the one minding the child and the child part company by minutes, the child
    // goes along the lane on foot (or carried) at the start of the new place's spell (S4, D-138)
    for (let i = 1; i < this.segs.length; i++) { const a = this.segs[i - 1], b = this.segs[i];
      if (a.where === 'road' || b.where === 'road' || a.place === b.place || a.place === '-' || b.place === '-' || (a.where === 'terrace' && b.where === 'terrace')) continue;
      if (b.t1 - b.t0 < 0.06) { Object.assign(b, { place: `road:${b.where === 'terrace' || a.where === 'terrace' ? 'terrace' : b.where}`, act: this.age >= 2 ? 'walk' : 'rest', why: this.age >= 2 ? 'walking along the lane' : 'carried along the lane', where: 'road' }); delete b.with; continue; }
      const wk = Math.min(0.2, (b.t1 - b.t0) / 2, Math.max(0.03, P.walkH(a.place, b.place, d, a.where, b.where)));
      const road: Seg = { t0: b.t0, t1: b.t0 + wk, place: `road:${b.where === 'terrace' || a.where === 'terrace' ? 'terrace' : b.where}`, act: this.age >= 2 ? 'walk' : 'rest', why: this.age >= 2 ? 'walking along the lane' : 'carried along the lane', where: 'road' };
      b.t0 += wk; this.segs.splice(i, 0, road); i++; }
    // no walk out and straight back (S10, r4): where a walk leads from a place back to the same place (the one the child is
    // with leaves as the other one it goes to comes back), the child stays at the place with whichever of them is there
    // (a run of walks too: home along the lane with the other children and out again with the mother)
    // (a moment of seconds at a place between two walks, passing through, is part of the run: joinSlivers drops it later)
    const inRun = (k: number) => this.segs[k].where === 'road' || (this.segs[k].t1 - this.segs[k].t0 < 0.02 && this.segs[k + 1]?.where === 'road');
    for (let i = 1; i < this.segs.length; i++) { if (this.segs[i].where !== 'road' || this.segs[i - 1].where === 'road') continue;
      let j = i; while (j < this.segs.length && inRun(j)) j++; if (j >= this.segs.length) break;
      const a = this.segs[i - 1], c = this.segs[j], r0 = this.segs[i].t0, r1 = this.segs[j - 1].t1; if (a.place !== c.place || a.place === '-') continue;
      const probe = [r0 + 0.01, (r0 + r1) / 2, r1 - 0.01]; for (let h = r0 + 0.05; h < r1 - 0.05; h += 0.05) probe.push(h);
      const there = (x: number | undefined) => x !== undefined && x >= 0 && probe.every(h => segAt(planOf(x), h).place === a.place);
      if (there(c.with)) { c.t0 = r0; this.segs.splice(i, j - i); }
      // (an outing with the other children, no one of the house along: it stays with them until the one it goes to comes)
      else if (there(a.with) || (a.place !== base && (a.with === undefined || a.with < 0) && a.act === 'play')) { a.t1 = r1; this.segs.splice(i, j - i); }
      else if (a.place === base) { // the one minding it leaves just as the mother comes in (or comes in just after she leaves):
        // it stays at home those minutes, with whoever of the house is there
        const o = mem.find(x => x !== this.pid && this.ageOf(x) >= 7 && there(x)); const sl = a.act === 'sleep' && c.act === 'sleep';
        const piece: Seg = { t0: r0, t1: r1, place: base, where: baseW, act: sl ? 'sleep' : 'play', why: sl ? 'asleep at home' : 'playing at home' }; if (o !== undefined) piece.with = o;
        this.segs.splice(i, j - i, piece); }
      // one of the house goes as another comes, a few minutes apart, away from home (the mother leaves the lane or the well
      // and the elder sister comes out to it): it waits there with the other children (C)
      else if (r1 - r0 <= 0.3) { const who = c.with !== undefined && c.with >= 0 ? relOf(c.with) : null;
        this.segs.splice(i, j - i, { t0: r0, t1: r1, place: a.place, where: a.where, act: 'play', why: `playing there with the other children${who ? ` until ${who} comes` : ''}` }); } }
    // a moment of seconds at a place between two walks (two outings' spans meeting on the way home) is walked through along
    // the lane with the other children (with no one of the house: the walks either side keep their company, so neither is
    // stretched over a moment when that one stood still: the soak on D-150's first pass)
    for (let i = 1; i + 1 < this.segs.length; i++) { const x = this.segs[i]; if (x.where === 'road' || x.t1 - x.t0 >= 0.02 || this.segs[i - 1].where !== 'road' || this.segs[i + 1].where !== 'road') continue;
      Object.assign(x, { place: this.segs[i - 1].place, where: 'road', act: this.age >= 2 ? 'walk' : 'rest', why: this.age >= 2 ? 'walking along the lane' : 'carried along the lane' }); delete x.with; }
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
    /** a leader of ten's watch (C, Q-147): he goes round the posts his own file holds after the change of watch and again every
     *  0.8-1.8 h (0.6-1.3 h at night, when a man may doze), each round 25-45 min; between rounds he is at the hearth within
     *  call, sometimes with the off men of his file; he eats between rounds after the third hour. Drawn per watch, so the
     *  two halves of a night watch (planned on two days) agree */
    const leaderWatch = (rd: number, w: number) => { const R2 = new HStream(P.seed, S.assign, 7300 + this.pid, rd * 3 + w); const out: [number, number, 'round' | 'eat' | 'wait' | 'file'][] = [];
      let t = 0.05 + 0.15 * R2.next(), ate = false; const night = w === 2; out.push([0, t, 'wait']); // his men go to their posts first
      // a round lasts as long as his file's posts on the watch take to visit (the rota: S3, r4), about 5-6 minutes a post (C)
      const nPosts = [...P.rota(rd).entries()].filter(([q, y]) => y.watch === w && !!y.post && P.persons[q].file === p.file).length || 8;
      for (let g = 0; g < 16 && t < 7.6; g++) { const len = Math.max(0.35, nPosts * lerp(0.075, 0.1, R2.next()) + 0.05); out.push([t, Math.min(8, t + len), 'round']); t += len; if (t >= 7.6) break;
        const nt = Math.min(7.6, t + (night ? lerp(0.6, 1.3, R2.next()) : lerp(0.8, 1.8, R2.next())));
        if (!ate && t > 3) { ate = true; const e = Math.min(nt - 0.05, t + lerp(0.3, 0.5, R2.next())); if (e > t + 0.15) { out.push([t, e, 'eat']); t = e; } }
        if (nt > t + 0.05) { out.push([t, nt, !night && R2.chance(0.35) ? 'file' : 'wait']); t = nt; } }
      if (t < 8) out.push([t, 8, 'wait']); return out; };
    const watch = (x: { post: string | null; watch: 0 | 1 | 2 }, t1: number, rd: number) => {
      // the patrol's pace on the day sets the reliefs (the same for the man relieved and the man relieving: C)
      const pace = u01(P.seed, S.assign, 5100 + x.watch, rd), step = GR.break_step_h * lerp(0.9, 1.12, pace), first = GR.break_first_h + 0.35 * (u01(P.seed, S.assign, 5200 + x.watch, rd) - 0.5);
      const w0 = [6, 14, 22][x.watch] + (rd - d) * 24; const R = P.rota(rd); const brk = (i: number) => w0 + first + (i % 8) * step + (i % 8 >= 4 ? GR.break_mid_gap_h : 0);
      const patrol = [...R.entries()].filter(([q, y]) => y.watch === x.watch && y.post === null && P.persons[q].rank === 0).map(([q]) => q).sort((a, b) => a - b);
      if (x.post) { const i = GUARD_POSTS.indexOf(x.post); const b = brk(i);
        if (b > this.t + 0.1 && b + GR.break_h < t1 - 0.1) { this.add(b, x.post, 'stand_guard', 'on watch', 'terrace');
          if (patrol[i < 8 ? 0 : 1] !== undefined) this.add(b + GR.break_h, hearth, 'eat', 'bread and water at the hearth, relieved at the post', 'terrace');
          else this.add(b + 0.25, x.post, 'eat', 'bread and water at the post (no man of the patrol to relieve him)', 'terrace'); }
        this.add(t1, x.post, 'stand_guard', 'on watch', 'terrace'); return; }
      if (p.rank === 1) { // the leader of ten (S3, Q-147): the watch's schedule is a function of the watch itself (both halves of a night watch agree)
        for (const [a, b, k] of leaderWatch(rd, x.watch)) { const B = Math.min(t1, w0 + b); if (B <= this.t + 1e-6) continue;
          if (k === 'round') this.add(B, 'terrace_round', 'patrol', a < 0.4 ? 'the leader of ten going round his file’s posts after the change of watch' : 'the leader of ten going round his file’s posts', 'terrace');
          else if (k === 'eat') this.add(B, hearth, 'eat', 'bread and water at the hearth between rounds', 'terrace');
          else if (k === 'file') this.add(B, hearth, 'talk', 'with the off men of his file at the hearth, within call of the posts', 'terrace');
          else if (a === 0) this.add(B, hearth, 'talk', 'the change of watch: seeing the men of his file off to their posts', 'terrace');
          else this.add(B, hearth, 'rest', x.watch === 2 ? 'awake by the fire between rounds, within call of the posts' : 'at the hearth between rounds, within call of the posts', 'terrace');
          if (this.t >= t1 - 1e-6) break; }
        if (this.t < t1) this.add(t1, hearth, 'rest', 'at the hearth between rounds, within call of the posts', 'terrace'); return; }
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
    const meal = (why: string, gap = 1.5) => { if (this.t - lastEat() < gap) return; this.add(this.t + lerp(0.4, 0.75, r.next()), hearth, 'eat', why, 'terrace'); };
    // a man's own hour: the early risers are up well before the watch (trait); the file's evening meal follows the sun (C)
    const up = (h: number) => h - lerp(0, 0.45, p.trait) - 0.2 * u01(P.seed, S.assign, 5300 + this.pid, d);
    const eve = this.sun.set - 0.35 + 0.5 * u01(P.seed, S.assign, 5400 + p.file, d);
    const leisure = (t1: number) => { while (this.t < t1 - 0.2) { const u = r.next(); const dt = Math.min(t1 - this.t, r.range(0.5, 1.5));
      if (u < 0.35) this.add(this.t + dt, hearth, 'gamble', 'knucklebones at the hearth', 'terrace'); else if (u < 0.7) this.add(this.t + dt, hearth, 'talk', p.rank === 1 && u > 0.55 ? 'with the men of his file: tomorrow’s posts, a man’s ration' : 'off watch at the hearth', 'terrace');
      else if (u < 0.8 && C.wx.rainH < 1 && this.t > 7 && this.t < 18) this.add(this.t + Math.min(dt, 0.6), 'forecourt', 'talk', 'talking with men of another file in the court', 'terrace'); else this.add(this.t + dt, hearth, 'rest', 'resting', 'terrace'); }
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
        const kinW = P.membersOn(fam.id, d).filter(x => x !== this.pid), wife = kinW.some(x => P.persons[x].sex === 'f' && this.ageOf(x) >= 14), kidsN = kinW.filter(x => this.ageOf(x) < 14).length, baby = kidsN === 1 && kinW.some(x => this.ageOf(x) === 0);
        // the family's midday meal with them when the visit spans it (S4 of shadow review r5: was bread and water there)
        const FH = P.hday(fam.id, d), fnoon = FH.noon, withNoon = fnoon > this.t + 0.2 && fnoon + FH.nLen < back - 0.3 && fnoon - lastEat() >= 2, talk1 = Math.min(back, this.t + r.range(1, 2));
        this.add(withNoon ? Math.min(talk1, fnoon) : talk1, fam.home, 'talk', `with ${wife ? 'his wife' : 'his household'}${kidsN ? (baby ? ' and the baby' : kidsN === 1 ? ' and the child' : ' and the children') : ''} in the town`, 'town');
        if (withNoon && this.t <= fnoon + 0.05) { if (this.t < fnoon) this.add(fnoon, fam.home, 'talk', 'with his family', 'town'); this.add(this.t + FH.nLen, fam.home, 'eat', 'the midday meal with his family', 'town'); }
        if (back - this.t > 1.5 && r.chance(0.5) && !(C.wx.dustH && C.wx.dustH[0] < back && C.wx.dustH[1] > this.t)) this.add(Math.min(back - 0.8, this.t + r.range(0.5, 1)), `lane:${fam.q}`, r.chance(0.5) ? 'exchange' : 'talk', 'in the lane of his family’s quarter', 'town');
        if (back - this.t > 1.2) this.add(back - 0.6, fam.home, r.chance(0.5) ? 'rest' : 'talk', 'with his family', 'town');
        const late = back - this.t > 0.35 && back - lastEat() >= 2.5; this.add(back, fam.home, late ? 'eat' : 'talk', late ? 'a meal with his family before going back up' : 'with his family', 'town'); this.add(t1, 'road:terrace', 'walk', 'back up to the garrison', 'road'); return;
      }
      if (!mine.length && !fam && t1 - this.t > 3 && !C.wx.storm && !C.wx.wet && !C.wx.dust && this.t > 7 && this.t < 16 && r.chance(visitChance + 0.25)) {
        // a man with no family in the town: down to the town's lanes and market, or to the river to wash his clothes (C)
        const river = C.season !== 'winter' && r.chance(0.4); const pl = river ? 'river' : 'lane:q_lt_e'; const h = P.walkH('garrison_sleep', pl, d, 'terrace', 'town'); leisure(this.t + 0.2);
        this.add(this.t + h, 'road:town', 'walk', river ? 'down to the river' : 'down to the town', 'road'); const back = t1 - h;
        this.add(Math.max(this.t + 0.5, Math.min(back, this.t + r.range(1, 2.2))), pl, river ? 'wash' : r.chance(0.5) ? 'exchange' : 'talk', river ? 'washing his clothes at the river' : 'in the town’s lanes: a little trade, the talk of the market', 'town');
        this.add(this.t + h, 'road:terrace', 'walk', 'back up to the garrison', 'road'); leisure(t1); return;
      }
      for (const j of mine) { leisure(j[0]); this.add(j[1], j[2], j[3], j[4], 'terrace'); }
      leisure(t1);
    };
    if (tailC) { watch(prev!, 6, d - 1); meal('breakfast after the night watch', 1); this.add(13, 'garrison_sleep', 'sleep', 'sleeping after the night watch', 'terrace'); }
    if (me && me.watch === 0) { // watch A, 06–14
      if (!tailC) this.add(up(5.2), 'garrison_sleep', 'sleep', 'asleep in the garrison quarters', 'terrace');
      meal('breakfast before the watch'); this.add(6, hearth, 'talk', 'readying for the watch', 'terrace'); watch(me, 14, d); meal('a meal after the watch');
      free(Math.min(20.5, eve), 0.25); meal('evening meal'); leisure(Math.min(22, this.sun.set + lerp(1, 2, 1 - p.trait))); return this.finish();
    }
    if (me && me.watch === 1) { // watch B, 14–22
      if (!tailC) this.add(Math.max(this.t, up(this.sun.rise + 0.7)), 'garrison_sleep', 'sleep', 'asleep in the garrison quarters', 'terrace');
      meal('breakfast'); free(13.2 - 0.3 * u01(P.seed, S.assign, 5500 + this.pid, d), 0.3); meal('a meal before the watch'); this.add(14, hearth, 'talk', 'readying for the watch', 'terrace'); watch(me, 22, d); meal('a meal after the watch'); return this.finish();
    }
    if (me && me.watch === 2) { // watch C, 22–06 (tomorrow's plan holds the rest of it)
      if (!tailC) this.add(Math.max(this.t, up(this.sun.rise + 0.6)), 'garrison_sleep', 'sleep', 'asleep in the garrison quarters', 'terrace');
      meal(tailC ? 'a meal' : 'breakfast'); free(Math.min(19, eve - 0.3), 0.35); meal('a meal before the night watch'); this.add(21.6 - 0.25 * u01(P.seed, S.assign, 5600 + this.pid, d), 'garrison_sleep', 'sleep', 'a short sleep before the night watch', 'terrace');
      this.add(22, hearth, 'talk', 'readying for the night watch', 'terrace'); watch(me, 24, d); return this.segs;
    }
    // off duty (phase 3: after the night watch; phase 4: a whole day off)
    if (!tailC) this.add(up(this.sun.rise + 0.9), 'garrison_sleep', 'sleep', 'asleep in the garrison quarters', 'terrace');
    meal(tailC ? 'a meal' : 'breakfast');
    free(12 + 0.6 * u01(P.seed, S.assign, 5500 + this.pid, d), ph === 4 ? L.guard_off_day.family_visit : 0); meal('midday meal');
    free(Math.min(20.5, eve), ph === 3 ? 0.5 : 0.2); meal('evening meal'); leisure(Math.min(22, this.sun.set + lerp(1.2, 2.3, 1 - p.trait))); return this.finish();
  }
  /** one of several real alternatives, by weight (lives.json job_tasks) */
  private choose<K extends string>(w: Record<K, number>): K { const e = Object.entries(w) as [K, number][]; let u = this.r.next() * e.reduce((s, x) => s + x[1], 0); for (const [k, x] of e) { u -= x; if (u <= 0) return k; } return e[e.length - 1][0]; }
  /** a work block at a second place during the day (goes there, works, comes back to `back`) */
  private errand(place: string, where: Where, act: ActivityId, why: string, h: number, back: string, backW: Where) { this.go(place, where); this.add(this.t + h, place, act, why, where); this.go(back, backW); }
  /** the summer harvest draft: kurtaš of the town's state groups sent to reap on the state fields (lives.json harvest_draft) */
  private drafted() { return this.P.draftedOn(this.pid, this.d, this.C); }
  private draftDay(): Seg[] {
    const f = 'crown_fields'; this.morning(5.4 - this.P.walkH(this.home, f, this.d, this.homeW, 'plain')); this.go(f, 'plain', 'to the harvest on the state fields');
    this.workBlock(f, 'plain', 'reap', 'drafted to reap on the state fields (harvest labour from the town: population.json)', Math.max(5.5, this.t), 11.5, true, f);
    if ((this.cur ?? this.home) === f) this.add(this.t + lerp(L.meals.midday_work_h[0], L.meals.midday_work_h[1], this.r.next()), f, 'eat', 'the midday meal at the field: bread and water', 'plain');
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
    // the leader of a stone squad marks out and checks the work in the morning and dresses the finest part himself later (C)
    if (act === 'inspect') { why = 'marking out the drum and checking the squad’s work with cord and straightedge'; pm = [place, 'dress_stone', 'dressing the finest part of the drum himself']; }
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
      const [a1, y1] = pick(); if (this.t < 12 && !C.heatRest) this.workBlock(place, where, a1, y1, Math.max(w0, this.t), 12.6, true, lunch, 12, undefined, { snap: true }); [act, why] = pick(); }
    if (pm && this.t < 12 && !C.heatRest) { this.workBlock(place, where, act, why, Math.max(w0, this.t), 12.6, true, lunch, 12, undefined, { snap: true }); [place, act, why] = pm; }
    this.workBlock(place, where, act, why, Math.max(w0, this.t), w1, true, lunch);
    this.endOfWork(lunch, where, issue !== undefined);
    return this.finish();
  }
  /** the end of a Terrace working day: on a heat day (E-64) the gangs stop at noon, eat at the site and go home; then home */
  private endOfWork(lunch: string, where: Where, ration: boolean) {
    if (this.C.heatRest && this.t < 13.5 && this.segs[this.segs.length - 1].act !== 'eat' && (this.cur ?? this.home) === lunch) this.add(this.t + lerp(L.meals.midday_work_h[0], L.meals.midday_work_h[1], this.r.next()), lunch, 'eat', where === 'terrace' ? 'the midday meal at the site: the camp’s bread and water (work stops in the heat, E-64)' : 'the midday meal (work stops in the heat, E-64)', where);
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
    else if (kind === 'flour') {
      // the camp's grain and flour are goods (S6 of shadow review r5, S3 of reviewer B): she carries sacks of barley up from
      // the camp's grain at the depot (the stair foot) to the querns, grinds, and later carries the flour ground at the
      // querns to the ovens; in the detailed tier each carry takes a sack from one stock and adds it to another (sim.ts).
      // The blocks fit the Terrace's short walks, with the barley measured out at the depot (was: three sacks of *flour*
      // "from the depot" set down at the querns, from no stock and into none, with 16 min standing at each end; C)
      this.add(Math.max(this.t, t0) + 0.2, 'querns', 'grind', 'grinding grain', 'terrace');
      for (let k = 0; k < 2; k++) { this.add(this.t + 0.06, 'stair_foot', 'walk', 'down to the depot for barley', 'terrace'); this.add(this.t + 0.1, 'stair_foot', 'queue', 'the barley measured out to her at the depot', 'terrace');
        this.add(this.t + 0.1, 'querns', 'carry_sack', 'carrying a sack of barley up to the querns', 'terrace'); this.add(this.t + 0.05, 'querns', 'rest', 'setting the sack of barley down by the querns', 'terrace'); }
      const mid = this.t + Math.max(0.5, (t1 - this.t) * 0.5); this.workBlock('querns', 'terrace', 'grind', 'grinding grain', this.t, mid, true, 'work_hearth');
      if (t1 - this.t > 0.8) for (let k = 0; k < 2; k++) { this.add(this.t + 0.08, 'oven', 'carry_sack', 'carrying a sack of the flour ground at the querns to the ovens', 'terrace'); this.add(this.t + 0.05, 'oven', 'rest', 'setting the flour down by the ovens', 'terrace'); this.add(this.t + 0.06, 'querns', 'walk', 'back to the querns', 'terrace'); }
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
    const P = this.P, p = this.p, d = this.d, r = this.r, C = this.C; const mem = P.membersOn(this.hh.id, d); const girl = p.sex === 'f', age = this.age;
    if (P.keeperOn(this.hh.id, d) === this.pid) return this.homemaker(); // the eldest daughter keeps the house of a dead mother (bereaved)
    const own = this.hd.minder === this.pid || this.hd.fieldHelper === this.pid || this.hd.bringer === this.pid;
    const m = p.mother >= 0 && mem.includes(p.mother) ? p.mother : mem.find(x => x !== this.pid && P.persons[x].sex === 'f' && this.ageOf(x) >= 14 && P.persons[x].job !== 'child') ?? -1;
    /** what the child does beside its mother, by her activity and its age */
    const beside = (s: Seg): [ActivityId, string] => {
      const a = s.act;
      if (a === 'sleep') return ['sleep', 'asleep'];
      if (a === 'lie_ill') return ['rest', 'sitting with the sick mother'];
      if (a === 'eat') return ['eat', /nurs/.test(s.why) ? 'eating while the mother nurses the baby' : 'eating with the mother'];
      if (/nurs/.test(s.why)) return ['play', 'playing near the mother while she nurses the baby'];
      if (s.where === 'road' || a === 'walk') return a === 'carry_sack' && age >= 9 ? ['carry_sack', 'helping to carry the load'] : a === 'carry_jar_head' && age >= 7 ? ['carry_jar_head', 'carrying a small jar of water home'] : ['walk', 'walking with the mother'];
      if (a === 'queue') return ['queue', 'in the queue with the mother'];
      if (a === 'reap') return age >= 8 ? ['field_work', 'gleaning and gathering the cut stalks behind the reapers'] : age >= 6 ? ['carry_jar', 'carrying the water jar along the rows to the reapers'] : ['play', 'playing at the edge of the field while the household reaps'];
      if (a === 'thresh') return age >= 8 ? ['thresh', 'gathering the straw on the threshing floor'] : age >= 6 ? ['thresh', 'driving the animals round the threshing floor with a stick'] : ['play', 'playing by the threshing floor']; // the floor's work is threshing, whoever does it (S6, r4)
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
    /** a long stint of the mother's at the harvest, the threshing or the picking becomes, for the child, spells of work (or of
     *  play for the small ones) with rests in the shade between them (C) */
    const spells = (ms0: Seg[]) => { if (age < 5) return ms0; const out: Seg[] = [];
      for (const s of ms0) { if (!['reap', 'thresh', 'pick_fruit'].includes(s.act) || s.t1 - s.t0 < 1.2) { out.push(s); continue; }
        let t = s.t0; for (let k = 0; t < s.t1 - 1e-6 && k < 40; k++) { const u = u01(P.seed, S.kid, this.pid, d, 20 + k); const t1 = Math.min(s.t1, t + (k % 2 === 0 ? lerp(0.6, 1.1, u) : lerp(0.3, 0.6, u)));
          out.push(k % 2 === 0 ? { ...s, t0: t, t1 } : { ...s, t0: t, t1, act: 'rest', why: '(shade)' }); t = t1; } }
      return out; };
    const follow = (ms: Seg[], camp: boolean, fe0?: number) => { const fe = fe0 ?? firstEat(ms); for (const s of spells(ms)) { const edge = s.place.startsWith('threshing') ? 'by the threshing floor' : s.place.startsWith('field') ? 'at the field edge' : 'under the trees'; let [a, why] = s.why === '(shade)' ? (age < 8 ? ['play', `playing in the shade ${edge}`] as [ActivityId, string] : ['rest', `resting in the shade ${edge}`] as [ActivityId, string]) : beside(s); let place = s.place; let w = m;
        let wh = s.where;
        // (to within float error: the mother's walk home that ends as the meal begins)
        if (s.t1 <= fe + 1e-6 && age < 10 && s.act !== 'eat' && (!camp || s.place === this.home)) { a = 'sleep'; why = 'asleep'; if (s.place !== this.home) { place = this.home; wh = this.homeW; w = -1; } }
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
    // (from nine a child has its own day, at the harvest too: see `reaps` below)
    if (m >= 0 && age <= 8 && p.agent < 0 && !own) { const ms = P.plan(m, d);
      const outing = ms.some(s => s.act === 'queue' || s.act === 'reap' || s.act === 'thresh' || s.act === 'pick_fruit' || (s.act === 'talk' && s.place.startsWith('h:') && s.place !== this.home));
      if (outing && r.chance(L.children.with_mother_on_her_outings)) return follow(ms, false);
      if (age < L.children.minded_until_age && !this.C.wx.storm) { // the mother's working hours away from home (2 h or more)
        const blocks: [number, number][] = []; let a0 = -1; for (const s of ms) { if (s.place !== this.home) { if (a0 < 0) a0 = s.t0; } else if (a0 >= 0) { if (s.t0 - a0 >= 2) blocks.push([a0, s.t0]); a0 = -1; } }
        const away: number[] = []; for (const [x, y] of blocks) for (let h = x + 0.25; h < y; h += 0.5) away.push(h);
        if (away.length && ms.some(s => s.place !== this.home && s.where !== 'road' && !['talk', 'eat', 'rest', 'queue', 'exchange', 'sleep'].includes(s.act))) {
          const sis = this.hd.minder; // the house's child-minder stays in through the mother's absences (child(): mBlocks)
          const minder = (sis >= 0 && sis !== this.pid && this.ageOf(sis) >= 9) || mem.some(x => { if (x === this.pid || x === m || this.ageOf(x) < 14 || P.persons[x].job === 'guard' || P.sick(x, d)) return false; const xs = P.plan(x, d); return away.filter(h => segAt(xs, h).place === this.home).length >= 0.7 * away.length; });
          if (!minder) {
            const homeThrough = (y: number, yh: string) => P.plan(y, d).every(g => blocks.every(([x, z]) => g.t1 <= x || g.t0 >= z || g.place === yh)); // at home for the whole of every absence
            let kw = -1, KH: Household | null = null;
            for (const k of this.hh.kin) { const H = P.households[k]; if (H.zone !== this.hh.zone || H.q !== this.hh.q || H.id === this.hh.id) continue;
              const x = P.membersOn(H.id, d).find(y => P.persons[y].sex === 'f' && this.ageOf(y) >= 14 && P.persons[y].job !== 'guard' && !P.sick(y, d) && homeThrough(y, H.home)); if (x !== undefined) { kw = x; KH = H; break; } }
            const terrace = ms.some(s => s.where === 'terrace') && P.persons[m].job !== 'camp'; let who = 'a kinswoman';
            if (kw < 0 && terrace) { const women = P.quarters[this.hh.q]?.women ?? []; const k0 = Math.floor(u01(P.seed, S.assign, 8800 + this.pid, d) * women.length);
              for (let i = 0; i < Math.min(40, women.length) && kw < 0; i++) { const y = women[(k0 + i) % women.length]; const H = P.households[P.home(y, d)];
                if (H.id === this.hh.id || H.zone !== this.hh.zone || !P.present(y, d) || P.sick(y, d) || P.persons[y].job === 'guard') continue; if (homeThrough(y, H.home)) { kw = y; KH = H; who = 'a neighbour'; } } }
            if (kw >= 0 && KH && (terrace || r.chance(L.children_under_five.left_with_minder))) return keptBy(ms, blocks, kw, KH, who);
            return follow(ms, P.persons[m].job === 'camp'); } } } }
    // ---- the child's own day (lives.json children.work; Q-143; C): the work of its age and sex first, then play; home by
    // dusk. The eldest girl of the house is its child-minder, with the little ones in the spells the house's minding
    // schedule gives her (Population.mindDay: S2 of shadow review r5); a son of ten or more may go out with the men to the
    // ploughing, and one child carries the midday bread out to them
    const q = this.hh.q, l = `lane:${q}`, W = this.homeW; const inside = C.wx.wet || C.wx.dust; const H = this.hd, plain = this.hh.zone === 'plain';
    const CW = L.children.work; const band = age >= 12 ? 3 : age >= 10 ? 2 : age >= 7 ? 1 : 0; const she = girl ? 'her' : 'his';
    const littles = mem.filter(x => x !== this.pid && this.ageOf(x) <= 4 && P.persons[x].job === 'child');
    const minder = H.minder === this.pid && littles.length > 0;
    // her spells with the little ones, at home or out in the lane with them: her chores and play fill the time between
    const mine = minder ? P.mindDay(this.hh.id, d).mine : [];
    // a man servant of the house fetches its fuel from beyond the town (S6 of reviewer B: the scribe's son of 13 made the
    // far fuel run while the house's man servant carried food to "the estate workers")
    const manservant = mem.some(x => P.persons[x].job === 'servant' && P.persons[x].sex === 'm' && this.ageOf(x) >= 14 && !P.sick(x, d));
    const wantH = (girl ? CW.girl_h : CW.boy_h)[band] * lerp(0.8, 1.2, r.next()) * (C.season === 'winter' ? CW.winter_factor : 1);
    let work = 0;
    const ms = m >= 0 ? P.plan(m, d) : null;
    void ms;
    const T = H.task, helper = H.fieldHelper === this.pid && !!T, bringer = H.bringer === this.pid && !!T && !helper;
    const noonF = 12 + H.habit; // the men's meal in the field (farmer(): workBlock at the house's midday)
    // ---- waking: a girl who grinds with the women rises with them; the others shortly before the morning meal (the sun
    // sets the meal, so the hour moves with the season; and each child has its own habit)
    // a son of 12-13 of a craftsman's, a scribe's, a gardener's or a storekeeper's house of the town goes with his father to
    // his work on some days (children.work.trade_p) and learns it beside him, from his father's leaving the house in the
    // morning to his coming home, when it stays in the town; when the father goes before the household's breakfast the boy
    // rises with him and has his bread before they go (S6 of reviewer B, r5; C)
    const eve0 = Math.min(this.sun.set - 0.3, H.supper - 0.1);
    const fa = !girl && age >= 12 && age <= 13 && this.hh.zone === 'town' && !minder && !helper && !bringer ? mem.find(x => x !== this.pid && P.persons[x].sex === 'm' && !P.persons[x].kin && this.ageOf(x) >= age + 16 && ['craftsman', 'scribe', 'gardener', 'storekeeper'].includes(P.persons[x].job) && !P.sick(x, d) && P.persons[x].agent < 0) : undefined;
    const trade = fa !== undefined && u01(P.seed, S.kid, this.pid, d, 7) < CW.trade_p ? (() => { const fs = P.plan(fa, d), i0 = fs.findIndex((s, i) => i > 0 && s.t0 >= Math.max(4.5, this.sun.rise - 1) && s.place !== this.home && s.act !== 'sleep' && fs[i - 1].place === this.home); if (i0 < 0) return null;
      let i1 = i0; while (i1 < fs.length && fs[i1].place !== this.home) i1++; const run = fs.slice(i0, i1); if (i1 >= fs.length || !run.length || run.some(s => s.where === 'terrace' || s.where === 'away' || s.place === '-' || s.act === 'offmap') || run[run.length - 1].t1 - run[0].t0 < 2 || run[run.length - 1].t1 > eve0) return null; return run; })() : null;
    if (trade && trade[0].t0 < H.breakfast + H.bLen + 0.05) { this.atHome(Math.max(0.2, trade[0].t0 - 0.45), 'sleep', 'asleep'); this.atHome(trade[0].t0 - 0.2, 'rest', 'up with his father before the household'); this.atHome(trade[0].t0, 'eat', 'bread and water before leaving with his father'); }
    else if (girl && H.women.includes(this.pid) && W !== 'terrace') this.morning(H.breakfast + H.bLen, true);
    else {
      const wake = Math.max(this.sun.rise - 0.9, H.breakfast - lerp(0.2, 0.8, p.trait) - 0.3 * u01(P.seed, S.kid, this.pid, d));
      this.atHome(Math.min(wake, H.breakfast - 0.05), 'sleep', 'asleep');
      const room = H.breakfast - this.t - 0.05;
      if (room > 0.3 && age >= 7 && !inside) {
        if (plain && !girl) this.atHome(this.t + Math.min(room, r.range(0.25, 0.5)), 'tend_animals', 'letting the household’s animals out and giving them water');
        else if (girl && age >= 9 && H.bakeAM) this.atHome(this.t + Math.min(room, r.range(0.2, 0.4)), 'knead', 'helping to shape the loaves');
        else this.atHome(this.t + Math.min(room, r.range(0.15, 0.3)), 'carry_sack', plain ? 'carrying in dung cakes for the morning fire' : 'carrying in brushwood for the morning fire');
      }
      if (this.t < H.breakfast) this.atHome(H.breakfast, age < 8 ? 'play' : 'rest', age < 8 ? 'playing in the courtyard before the morning bread' : 'waiting for the morning bread');
      const alone = !P.breakfasters(this.hh.id, d, this.pid); // (S8 r5: "with the household" for a boy of 11 eating alone)
      this.atHome(this.t + H.bLen, 'eat', alone ? (H.bakeAM ? 'breakfast: the new bread' : 'breakfast, the others of the house gone out') : H.bakeAM ? 'breakfast with the household: the new bread' : 'breakfast with the household');
    }
    const eve = Math.min(this.sun.set - 0.3, H.supper - 0.1);
    /** one piece of the day's work, chosen from what the child's age, sex, house and weather allow; false when none fits */
    const done: Record<string, number> = {}, cap: Record<string, number> = { water: 2, fuel: plain ? 2 : 1, errand: 1, birds: 1, dung: 1, grind: 1, spin: 3 };
    // (minding the little ones is no chore of its own any more: it is the minder's spells, written from the little ones'
    // side, S2 r5; every piece of work ends by `until`, where her next spell with them begins)
    const doWork = (until: number): boolean => {
      if (until - this.t < 0.3) return false;
      const lim = until, wet = inside || this.rainIn(this.t, this.t + 1) > 0.2, out = !wet, wellTrip = 2 * P.walkH(this.home, `well:${q}`, d, W, W) + 0.35;
      const w: Record<'water' | 'fuel' | 'grind' | 'spin' | 'errand' | 'birds' | 'dung', number> = {
        water: out && age >= 7 && until - this.t > wellTrip ? (girl ? 1.2 : 0.7) : 0, fuel: out && age >= 8 && !manservant && until - this.t > 1.2 + 2 * P.walkH(this.home, plain ? `outside:${q}` : 'outside', d, W, W) ? (plain ? 1 : 0.6) : 0,
        grind: girl && age >= 10 && !H.women.includes(this.pid) ? 1 : 0, spin: girl && age >= 8 ? (age >= 10 ? 1.4 : 0.6) : 0, errand: out && age >= 6 && until - this.t > 0.8 ? 0.6 : 0,
        birds: plain && out && age >= 6 && age <= 11 && d >= CW.bird_days[0] && d < CW.bird_days[1] && until - this.t > 1.5 ? 1 : 0, dung: plain && girl && age >= 9 && out ? 0.5 : 0 };
      for (const k of Object.keys(w) as (keyof typeof w)[]) if ((done[k] ?? 0) >= cap[k]) w[k] = 0;
      if (!Object.values(w).some(x => x > 0)) return false;
      const k = this.choose(w); const t0 = this.t; done[k] = (done[k] ?? 0) + 1;
      if (k === 'water') this.well(this.t + r.range(0.15, 0.3), age < 9 ? 'fetching water with a small jar' : 'fetching water for the household');
      else if (k === 'fuel') { const o = plain ? `outside:${q}` : 'outside'; this.go(o, W, 'out for fuel'); this.add(Math.max(this.t + 0.4, Math.min(until - P.walkH(o, this.home, d, W, W), this.t + r.range(0.7, 1.4))), o, 'gather', 'gathering dung and brushwood for the fire', W); this.go(this.home, W, 'carrying the fuel home', 'carry_sack'); }
      else if (k === 'grind') this.atHome(Math.min(lim, this.t + r.range(0.4, 1)), 'grind', 'grinding beside the mother at the quern');
      else if (k === 'spin') { if (age >= 10 && out && lim - this.t > 0.8 && r.chance(0.4)) { this.go(l, W); this.add(Math.max(this.t + 0.4, Math.min(lim - P.walkH(l, this.home, d, W, W), this.t + r.range(0.6, 1.4))), l, 'spin', 'spinning with the women outside the door', W); this.go(this.home, W); }
        else this.atHome(Math.min(lim, this.t + r.range(0.5, 1.3)), 'spin', age >= 10 ? 'spinning wool with a drop spindle' : 'learning to spin beside the women'); }
      else if (k === 'errand') { const kin = this.hh.kin.map(h => P.households[h]).find(K => K.zone === this.hh.zone && K.id !== this.hh.id && P.walkH(this.home, K.home, d, W, K.zone === 'plain' ? 'plain' : 'town') < Math.min(0.25, (until - this.t - 0.3) / 2));
        if (kin && r.chance(0.5)) { const kw: Where = kin.zone === 'plain' ? 'plain' : 'town'; this.go(kin.home, kw, 'taking bread to a kinswoman', 'carry_bread'); this.add(this.t + r.range(0.1, 0.25), kin.home, 'talk', 'handing over the bread, a word with the kinswoman', kw); this.go(this.home, W, 'going home'); }
        else { this.go(l, W, 'to the lane with a measure of barley', 'carry_sack'); this.add(this.t + r.range(0.15, 0.35), l, 'exchange', 'exchanging a measure of barley for oil with a neighbour', W); this.go(this.home, W, 'carrying the oil home', 'carry_jar'); } }
      else if (k === 'birds') { let f = this.field(this.hh.id); if (T && T.place === f) f = f.replace(/:(\d+)$/, (_m, n) => `:${(+n + 1) % 2}`); /* the ripening crop is not the plot being worked */ this.go(f, 'plain', 'out to the crop'); this.add(Math.max(this.t + 0.5, Math.min(until - P.walkH(f, this.home, d, 'plain', W), this.t + r.range(1, 2.2))), f, 'rest', 'sitting by the ripening crop, scaring the birds off', 'plain'); this.go(this.home, W); }
      else this.atHome(Math.min(lim, this.t + r.range(0.4, 0.8)), 'gather', 'shaping dung cakes and setting them on the wall to dry');
      work += this.t - t0; return this.t > t0 + 0.02;
    };
    /** play, the rest of the time until `until` (lives.json children.choices); not in rain or dust (W-03) */
    let lastPlay = '';
    // one spell of play leads straight on to the next: from the lane to a friend's house is one walk, not a walk home and
    // out again (S10, r4: a walk home and straight back out read as a 12-minute "walking" that left the lane and came back,
    // and a walk was split in two); the child walks home when the play is over
    const home = () => { if ((this.cur ?? this.home) !== this.home) this.go(this.home, W, 'walking home'); };
    const spell = (until: number) => {
      for (let g = 0; g < 10 && this.t < until - 0.3; g++) {
        let e = Math.min(until, this.t + r.range(0.7, 1.8)); if (until - e < 0.4) e = until;
        // (never the same place twice running but home: the spells of play stay spells, D-082, now that a second spell in the
        // same lane would run on from the first)
        let k = inside ? 'home' : this.choose(L.children.choices as Record<'lane' | 'friend' | 'water_edge' | 'home', number>); if (k === lastPlay && k !== 'home') k = this.choose(L.children.choices as Record<'lane' | 'friend' | 'water_edge' | 'home', number>); if (k === lastPlay) k = 'home'; lastPlay = k;
        const last = e >= until - 1e-6; // the play ends here: the walk home fits before `until`
        // (an outing only when there is time to get there, play a while and walk home before `until`: S2 r5)
        const fits = (x: string, xw: Where) => until - this.t >= 2 * P.walkH(this.home, x, d, W, xw) + 0.35;
        const back = (x: string, xw: Where) => Math.max(this.t + 0.2, e - (last ? P.walkH(x, this.home, d, xw, W) : 0));
        const outTo = (x: string, xw: Where, why: string, ww: string) => { if ((this.cur ?? this.home) !== x) this.go(x, xw, ww); this.add(back(x, xw), x, 'play', why, xw); if (last) home(); };
        const wEdge = plain ? `canal:${q}` : `garden:${q}`, fr = k === 'friend' ? this.visitTarget() : null;
        if (k === 'lane' && fits(l, W)) outTo(l, W, 'playing in the lane', 'out to the lane');
        else if (k === 'friend' && fr && fits(fr.place, fr.where)) outTo(fr.place, fr.where, `playing at ${fr.name}'s house`, 'to a friend’s house');
        else if (k === 'friend' && fits(l, W)) outTo(l, W, 'playing in the lane', 'out to the lane');
        else if (k === 'water_edge' && fits(wEdge, W)) outTo(wEdge, W, plain ? 'playing by the canal' : 'playing by the garden channels', plain ? 'out to the canal' : 'out to the garden channels');
        else { home(); this.atHome(Math.max(this.t + 0.1, e), 'play', inside ? 'playing indoors' : 'playing at home'); }
      }
      home();
    };
    /** the time until `until`, around the minder's spells with the little ones: `filler` fills each stretch between them
     *  (ending a few minutes before a spell, at home), and each spell is her own pieces of the house's minding schedule */
    const fill = (until: number, filler: (end: number) => void) => {
      for (let g = 0; g < 40 && this.t < until - 0.01; g++) {
        const pc = mine.find(x => x.t1 > this.t + 0.01), start = pc ? Math.max(this.t, pc.t0) : until, end = Math.min(until, start);
        if (end > this.t + 1e-4) { if (end - this.t > 0.2) filler(pc && pc.t0 < until ? end - 0.15 : end); if (this.t < end - 1e-6) { home(); this.atHome(end, ...this.idle()); } }
        if (!pc || pc.t0 >= until - 0.01) break;
        home(); for (let i = 0; i < mine.length; i++) { const x = mine[i]; if (x.t1 <= this.t + 1e-6) continue; if (x.t0 >= until || x.t0 > this.t + 1e-4) break;
          // (a walk with them is taken whole, to where it leads)
          // (an outing to the lane with them is taken whole, to the walk home: `until` falls only in a piece at home)
          const out = x.where === 'road' || x.place !== this.home; this.add(out ? x.t1 : Math.min(x.t1, until), x.place, x.act, x.why, x.where, true); if (x.where === 'road' && mine[i + 1]) { this.cur = mine[i + 1].place; this.curW = mine[i + 1].where; }
          if (x.t1 > until && !out) break; }
        work += this.t - start; }
    };
    /** work until the share of the day's hours is done or no work fits, then play until `until` */
    const half = (until: number, share: number) => fill(until, end => { for (let g = 0; g < 10 && work < wantH * share && this.t < end - 0.4; g++) if (!doWork(end - 0.05)) break; spell(end); });
    const PB = L.children.persian_boys_training;
    const trains = !trade && !girl && this.hh.persian && P.standing(this.hh.id, d) && age >= PB.ages[0] && age <= PB.ages[1] && !C.wx.wet && !(C.wx.tmin < 0 && age < 10) && !minder && !helper && !bringer && r.chance(PB.p);
    const herds = plain && !inside && !helper && !bringer && !minder && age >= 7 && !(T?.all) && u01(P.seed, S.kid, this.pid, d, 2) < (girl ? (age <= 11 ? CW.herd_p.girl : 0) : CW.herd_p.boy) && P.dryTask({ h0: H.breakfast + H.bLen, h1: 14 } as PTask, C) !== null;
    // at the harvest, the threshing, the vintage and the fruit the whole household goes out (E-41 ... E-46): from nine the
    // children glean and carry the sheaves, from twelve they bind; on the floor they drive the animals and turn the straw (C)
    const reaps = plain && !!T?.all && age >= 9 && !minder && !inside && !C.wx.storm;
    if (reaps) {
      const Tt = T!; const act: ActivityId = Tt.kind === 'vintage' || Tt.kind === 'fruit' ? 'pick_fruit' : Tt.kind === 'thresh' ? 'thresh' : 'field_work'; // (S6, r4: the floor's work was `field_work`)
      const why = Tt.kind === 'reap' ? (age >= 12 ? 'binding sheaves behind the reapers' : 'gleaning behind the reapers and carrying the sheaves to the stooks')
        : Tt.kind === 'thresh' ? (age >= 12 ? 'turning the straw on the threshing floor with a fork' : 'driving the animals round the threshing floor with a stick') : 'picking with the household';
      this.go(Tt.place, 'plain', this.toward(Tt.place));
      for (let k = 0; k < 12 && this.t < Tt.h1 - 0.2; k++) { this.add(Math.min(Tt.h1, Math.max(Tt.h0, this.t) + r.range(0.8, 1.5)), Tt.place, act, why, 'plain');
        if (Tt.h1 - this.t > 0.6) this.add(this.t + r.range(0.2, 0.45), Tt.place, 'rest', Tt.place.startsWith('threshing') ? 'resting in the shade by the threshing floor' : 'resting in the shade at the field edge', 'plain'); }
      work += Tt.h1 - Tt.h0;
      this.go(this.home, W, 'home with the household'); this.noonAtHome(this.backFrom(Tt.place));
      if (C.wx.tmax >= 30) this.atHome(Math.max(this.t + 0.5, Math.min(15.2, (Tt.pm?.[0] ?? 15.2) - 0.2)), 'sleep', 'sleeping through the heat of the day');
      if (Tt.pm && r.chance(0.6)) this.afternoonSession(Tt, act, Tt.kind === 'reap' ? 'gleaning the stubble in the afternoon' : why);
      if (Tt.sheaves && Tt.late > this.t + 0.3) { this.atHome(Tt.late, 'rest', 'resting at home'); this.errand(`threshing:${q}`, 'plain', 'carry_sack', 'carrying sheaves to the threshing floor with the household', 1.1, this.home, W); }
      half(eve, 1);
    } else if (helper) { // ---- out with the men to the field
      const why = T!.kind === 'plough' ? (C.agri.has('E-44') ? 'following the plough, dropping the seed of the summer crop into the furrow' : 'following the plough, breaking the clods and carrying the seed basket') : T!.kind === 'canal' ? 'clearing the canal with the men: filling the silt baskets and carrying them out' : `${T!.why} beside the men`;
      this.go(T!.place, 'plain', `${this.toward(T!.place)} with the men`, 'walk'); this.workBlock(T!.place, 'plain', T!.kind === 'canal' ? 'dig_canal' : T!.kind === 'other' ? T!.act : 'field_work', why, Math.max(T!.h0, this.t), age >= 12 ? Math.min(T!.h1, 15.5) : noonF + 0.6, true, T!.place, noonF, H.bringer >= 0 ? 'the midday meal at the field: the bread brought out from home' : 'the midday meal at the field: the bread carried out in the morning');
      if (T!.carryHome) this.go(this.home, W, T!.carryHome, 'carry_sack'); else this.go(this.home, W, 'home from the field'); half(eve, 1);
    } else if (trade) { // ---- a day at his father's work, learning it beside him (S6 of reviewer B, r5; C)
      const fh = P.households[P.home(fa!, d)].home;
      for (const s of trade) { if (s.t0 > this.t + 1e-4) this.atHome(s.t0, ...this.idle());
        const road = s.where === 'road', learn: Record<string, string> = { write_tablet: 'learning the signs beside his father, copying on a tablet', craft: 'helping his father at his craft, learning it', garden_work: 'working the beds beside his father',
          irrigate: 'opening the runnels beside his father', inspect: 'beside his father at the storehouse, learning the measures', pick_fruit: 'picking beside his father', dig_canal: 'clearing the channel beside his father', carry_sack: 'helping his father carry the load' };
        const [a, why]: [ActivityId, string] = road ? ['walk', s.t0 < 12 && this.segs.every(x => x.with !== fa) ? 'walking to his father’s work with him' : 'walking with his father'] : s.act === 'eat' ? ['eat', 'the midday meal with his father'] : learn[s.act] ? [s.act, learn[s.act]] : ['rest', 'with his father at his work'];
        this.add(s.t1, road ? s.place : s.place, a, why, s.where, true); this.segs[this.segs.length - 1].with = fa!; }
      void fh; work += 3; this.noonAtHome(); half(eve, 1);
    } else if (herds) { // ---- the household's animals: out through the cool of the day with bread (C)
      const pa = `pasture:${q}`, hot = C.wx.tmax >= 30;
      this.go(pa, 'plain', 'taking the animals out'); const t1 = hot ? Math.max(this.t + 1.5, 11) : Math.max(this.t + 2, Math.min(eve - 0.5, 14.5 + 1.5 * r.next()));
      this.workBlock(pa, 'plain', 'herd', 'minding the household’s animals on the stubble and the fallow', this.t, t1, true, pa, H.noon, 'the bread and curds carried out in a cloth, eaten by the animals', { toRefuge: 'bringing the animals home out of the rain' });
      this.go(this.home, W, 'bringing the animals home'); work += 3;
      if (hot) { this.noonAtHome(); this.atHome(Math.max(this.t, 15.2), 'sleep', 'sleeping through the heat of the day'); this.go(pa, 'plain', 'taking the animals out again'); this.add(Math.max(this.t + 0.5, eve - 0.35), pa, 'herd', 'grazing the animals in the cool of the evening', 'plain'); this.go(this.home, W, 'bringing the animals home'); }
      else { if (this.t < H.noon + 1 && !this.segs.some(x => x.act === 'eat' && x.t0 > 11)) this.noonAtHome(); half(eve, 1); }
    } else {
      // ---- at home: the morning's work, then play; the midday meal (or the bread carried out); the afternoon's
      const stopAM = bringer ? noonF - P.walkH(this.home, T!.place, d, W, 'plain') - 0.1 : H.noon - 0.1;
      if (trains) { const t = `training:${q}`; this.go(t, W, 'to the practice ground'); this.add(this.t + r.range(1.5, 2.5), t, 'train', 'learning to ride and to shoot with the bow (HDT 1.136)', W); this.go(this.home, W); }
      half(stopAM, 0.55);
      if (bringer) { this.go(T!.place, 'plain', 'carrying the midday bread and water out to the men in the field', 'carry_bread'); this.add(Math.max(this.t + 0.3, noonF + H.nLen), T!.place, 'eat', 'eating with the men at the field', 'plain'); this.go(this.home, W, 'home from the field with the empty basket'); }
      else this.noonAtHome();
      if (C.heatRest || C.wx.tmax >= 31) fill(Math.max(this.t, Math.min(15.3, eve - 0.5)), end => { if (end > this.t) this.atHome(end, age < 10 ? 'sleep' : 'rest', age < 10 ? 'sleeping through the heat of the day' : 'resting in the shade through the heat'); });
      else if (age < 10) { const e = this.t + r.range(0.3, 0.9); fill(e, end => { if (end > this.t) this.atHome(end, 'rest', 'resting after the meal'); }); }
      half(eve, 1);
    }
    // a spell with the little ones that runs on to the evening meal: she stays in with them
    const lastSp = mine.length ? mine[mine.length - 1].t1 : -1; if (lastSp > this.t) fill(lastSp, end => spell(end));
    this.evening(Math.max(this.t, 15)); return this.finish();
  }
  private terraceWorker(place: string, act: ActivityId, why: string, pm?: [string, ActivityId, string]): Seg[] {
    const P = this.P, C = this.C; if (C.wx.storm) return this.homeDay('storm');
    const [w0, w1] = P.workWindow(C); this.morning(w0 - P.walkH(this.home, 'stair_foot', this.d, this.homeW, 'terrace') - 0.05); this.go('stair_foot', 'terrace', 'going to the Terrace');
    const issue = C.issue.get(this.p.group); if (issue !== undefined) { this.add(Math.max(this.t, issue), 'stair_foot', 'queue', 'waiting for the ration issue', 'terrace'); this.dispute('stair_foot', 'terrace'); this.add(this.t + 0.3 + this.r.next(), 'stair_foot', 'queue', 'in the ration queue', 'terrace'); }
    // (work inside the Treasury and the closed palaces is under a roof: no rain shelter, no heat rest in the shade; S1 r5)
    const open = (x: string) => !/^(treasury_|palaces)/.test(x);
    if (pm && (pm[0] !== place || pm[1] !== act) && this.t < 12 && !C.heatRest) { this.workBlock(place, 'terrace', act, why, Math.max(w0, this.t), 12.6, open(place), 'work_hearth', 12, undefined, { snap: true }); [place, act, why] = pm; } // a different task after the midday meal
    this.workBlock(place, 'terrace', act, why, Math.max(w0, this.t), w1, open(place), 'work_hearth');
    this.endOfWork('work_hearth', 'terrace', issue !== undefined); return this.finish();
  }
  /** the porters of the Terrace depot who have no detailed agent (lives.json job_tasks.terrace_porter) */
  private terracePorter(): Seg[] {
    // the morning's loads and the afternoon's are whatever comes (lives.json job_tasks.terrace_porter), drawn separately
    const task = (): [string, ActivityId, string] => { const k = this.choose(L.job_tasks.terrace_porter.v as Record<'treasury' | 'camp_grain' | 'site_water' | 'wait', number>);
      return k === 'treasury' ? ['treasury_store', 'carry_sack', 'carrying goods up from the stair foot to the Treasury store'] : k === 'camp_grain' ? ['querns', 'carry_sack', 'carrying sacks of barley from the depot up to the work camp’s querns']
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
    this.morning(this.sun.rise + 0.5 + 0.6 * this.p.trait); this.go('station', 'town', 'to the road station');
    const end = this.sun.set - 0.4 + 0.6 * this.r.next(); let ate = false;
    // between relays: the horse and its harness, talk with the grooms, sleep in the shade through the heat (E-64), the
    // midday meal; the letters come when they come (E-20)
    const wait = (until: number) => { for (let g = 0; g < 12 && this.t < until - 0.1; g++) {
      if (!ate && this.t >= 11.8) { ate = true; this.add(Math.min(until, this.t + lerp(0.4, 0.7, this.r.next())), 'station', 'eat', 'the midday meal at the station', 'town'); continue; }
      const hot = C.heatRest && this.t >= 11.8 && this.t < 15.8; const t1 = Math.min(until, hot ? 15.8 : this.t + this.r.range(0.6, 1.6), !ate ? Math.max(this.t + 0.2, 11.8) : 24);
      const k = hot ? 'sleep' : this.choose({ wait: 0.45, horse: 0.3, talk: 0.25 });
      if (k === 'sleep') this.add(t1, 'station', 'sleep', 'sleeping through the heat in the station’s shade', 'town');
      else if (k === 'horse') this.add(t1, 'station', 'tend_animals', 'seeing to his horse and its harness', 'town');
      else if (k === 'talk') this.add(t1, 'station', 'talk', 'talking with the grooms at the station', 'town');
      else this.add(t1, 'station', 'rest', 'waiting at the station for the relay', 'town'); } };
    const letters = C.couriers.filter(x => x.t > this.t - 2).sort((a, b) => a.t - b.t);
    for (const x of letters) { if (x.t > end) break; wait(x.t);
      if (x.treasury) { this.go('stair_foot', 'terrace', 'carrying a sealed letter up to the Treasury'); this.add(this.t + 0.1, 'stair_foot', 'walk', 'climbing the stair', 'terrace'); this.add(this.t + 0.4, 'treasury_desk', 'talk', 'delivering a sealed document', 'terrace'); this.go('station', 'town', 'back to the station'); }
      else { this.go('official_bldg', 'town', 'carrying a letter'); this.add(this.t + 0.3, 'official_bldg', 'talk', 'handing a letter to an official', 'town'); this.go('station', 'town', 'back to the station'); } }
    wait(end);
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
    if (this.P.dryTask({ h0: this.sun.rise + 0.3, h1: this.sun.set - 0.5 } as PTask, C) === null) return this.dayWork('stockyard', 'town', 'tend_animals', 'the flock kept in the fold at the stockyard out of the rain, fed on fodder (W-01)', this.sun.rise + 0.4, this.sun.set - 1); // (S1 r5)
    this.morning(this.sun.rise); this.go(pa, 'town', 'taking the flock out'); this.workBlock(pa, 'town', 'herd', 'grazing the state flock', this.t, this.sun.set - 0.5, true, pa, 12, undefined,
      { refuge: 'stockyard', refugeW: 'town', toRefuge: 'bringing the flock in to the stockyard out of the rain', stay: ['tend_animals', 'with the flock in the fold at the stockyard, out of the rain'] });
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
    // not begun into rain that covers the working hours, and begun when a morning spell of it has passed (S1 r5: was rain of
    // more than 3 h in the day); rain in the work sends him home from the beds (workBlock)
    const dry = this.P.dryTask({ h0: this.sun.rise + 0.5, h1: 15.5 } as PTask, C);
    if (C.wx.storm || dry === null) return this.homeDay('rain: no garden work');
    const g = p.work || `garden:${q}`; this.morning(Math.max(this.sun.rise + 0.2, dry.h0 - 0.3));
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
      else if (k === 'produce' && t1 - this.t > 2) { this.go(fruit ? trees : g, 'town', fruit ? 'to the garden trees' : 'to the garden'); this.add(this.t + 1, fruit ? trees : g, fruit ? 'pick_fruit' : 'garden_work', 'gathering produce for the store', 'town');
        this.go(store, estate ? this.homeW : 'town', estate ? 'carrying produce to the estate’s stores' : 'carrying produce to the storehouse (E-10)', 'carry_sack'); this.add(this.t + 0.5, store, 'queue', 'the produce counted in at the store', estate ? this.homeW : 'town');
        this.go(g, 'town', 'back to the garden'); this.workBlock(g, 'town', 'garden_work', 'working the garden beds', this.t, t1, true, g); }
      else if (k === 'manure' && t1 - this.t > 2) { this.go('stockyard', 'town', 'to the stockyard'); this.add(this.t + 0.4, 'stockyard', 'carry_sack', 'filling baskets with dung', 'town'); this.go(g, 'town', 'carrying dung to the beds', 'carry_sack');
        this.workBlock(g, 'town', 'garden_work', 'digging dung into the beds', this.t, t1, true, g); }
      else { this.go(g, 'town', 'to the garden'); this.workBlock(g, 'town', 'garden_work', C.season === 'spring' || C.season === 'autumn' ? 'sowing, hoeing and weeding the beds' : 'hoeing and weeding the beds', this.t, t1, true, g); }
    };
    block(12); if ((this.cur ?? this.home) === this.home) this.noonAtHome(); else this.add(this.t + lerp(L.meals.midday_work_h[0], L.meals.midday_work_h[1], this.r.next()), this.segs[this.segs.length - 1].place, 'eat', C.heatRest ? 'the midday meal in the shade of the trees, then home out of the heat (E-64)' : 'the midday meal in the garden', 'town'); if (!C.heatRest) block(15.5);
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
    if ((this.cur ?? this.home) === this.home) { this.noonAtHome(); if (this.C.wx.tmax >= 30) this.atHome(this.t + r.range(1, 2), 'sleep', 'sleeping through the heat of the day'); return; } // (rained home: S1 r5)
    const floor = place.startsWith('threshing'), by = floor ? 'by the threshing floor' : 'at the field edge', hot = this.C.wx.tmax >= 30;
    if ((T.kind === 'reap' || T.kind === 'thresh') && this.p.sex === 'm' && u01(this.P.seed, S.assign, 7900 + this.hh.id, this.d) < 0.35) {
      this.add(this.t + this.hd.nLen, place, 'eat', `the midday meal in the shade ${by}: bread and water carried out in the morning`, 'plain');
      if (T.pm) { this.add(Math.max(this.t + 0.3, T.pm[0]), place, hot ? 'sleep' : 'rest', hot ? `sleeping in the shade ${by} through the heat` : `resting in the shade ${by} after the meal`, 'plain'); return; }
      this.add(Math.min(T.late - 0.3, this.t + r.range(1.5, 3)), place, 'rest', `resting in the shade ${by} through the heat`, 'plain'); this.go(this.home, w); return; }
    this.go(this.home, w); this.noonAtHome(this.backFrom(place));
    if (hot) this.atHome(this.t + r.range(1, 2), 'sleep', 'sleeping through the heat of the day');
  }
  /** the harvest's afternoon: back out after the midday rest (T.pm), whoever went home for the meal */
  private afternoonSession(T: PTask, act: ActivityId, why: string) {
    if (!T.pm || T.pm[1] - Math.max(this.t, T.pm[0]) < 0.5) return;
    const w = this.homeW, walk = this.P.walkH(this.home, T.place, this.d, w, 'plain');
    if ((this.cur ?? this.home) !== T.place) { this.homeHours(T.pm[0] - walk, this.C.wx.tmax >= 30 ? 'resting through the heat' : 'resting after the midday meal'); this.go(T.place, 'plain', this.toward(T.place)); }
    const a0 = Math.max(this.t, T.pm[0]), mid = a0 + (T.pm[1] - a0) * lerp(0.4, 0.6, this.r.next());
    if (T.pm[1] - a0 >= 2) { this.workBlock(T.place, 'plain', act, why, a0, mid, true, T.place); this.add(this.t + lerp(0.2, 0.35, this.r.next()), T.place, 'eat', T.place.startsWith('threshing') ? 'bread and water by the threshing floor' : 'bread and water at the field edge', 'plain'); }
    this.workBlock(T.place, 'plain', act, why, Math.max(this.t, a0), T.pm[1], true, T.place); this.go(this.home, w, 'home from the field');
  }
  private farmer(): Seg[] {
    const C = this.C, p = this.p, d = this.d, r = this.r, q = this.hh.q; const w: Where = this.homeW; const T = this.hd.task;
    if (C.wx.storm) return this.homeDay('storm');
    if (this.age < 14 && p.sex === 'm' && !(T?.all && this.age >= 12)) return this.child();
    if (p.sex === 'f' && !T?.all) return this.homemaker(); // girls of the plain do the women's work unless the whole household is out
    if (!T) return this.homeDay(this.hd.wetOff ? 'kept in by the rain' : C.season === 'winter' ? 'little field work in winter' : 'at home'); // (winter: farm_men_other_work 'home'; rain: dryTask, S1 r5)
    // the season's other work (S1, r4): a morning's exchange in kind in the town's lanes (the village lane when the town is
    // far), carrying a measure of barley there and what it fetched home (lives.json farm_men_other_work.opts.market; C)
    if (T.kind === 'other' && T.opt === 'market') {
      const trip = this.P.walkH(this.home, T.place, d, w, 'town'), town = trip < 1.5, pl = town ? T.place : `lane:${q}`, pw: Where = town ? 'town' : w;
      this.morning(T.h0 - (town ? trip : 0) - 0.05); this.go(pl, pw, town ? 'carrying a measure of barley to the town to exchange' : 'carrying a measure of barley to the lane to exchange', 'carry_sack');
      this.add(this.t + lerp(1, 2, r.next()), pl, 'exchange', town ? T.why : 'exchanging produce in kind with neighbours in the lane', pw);
      if (town && this.t + trip > this.hd.noon + 0.6) this.add(this.t + 0.3, pl, 'eat', 'bread and water in the town before the road home', pw);
      this.go(this.home, w, town ? 'carrying home what the barley fetched: oil and a jar' : 'going home', town ? 'carry_jar' : 'walk');
      if (!this.segs.some(x => x.act === 'eat' && x.t0 > 10.5)) this.noonAtHome();
      this.evening(Math.max(this.t, this.sun.set - 1.2)); return this.finish();
    }
    // threshing season (E-43): some days the household's men carry grain to the storehouse in the town (the state share
    // that feeds E-06); on some nights one of its men, by turns, sits up by the grain heap and sleeps beside it on the
    // floor till dawn (S2, r4: was home to bed at 22:00, the heap left for the small hours) (both C)
    if (T.kind === 'thresh' && p.sex === 'm' && this.age >= 16) {
      const u = u01(this.P.seed, S.assign, 7000 + this.hh.id, d); const trip = this.P.walkH(this.home, 'store_town', d, w, 'town');
      if (u < 0.1 && trip < 3) { this.morning(this.sun.rise - 0.2); this.go('store_town', 'town', 'carrying grain to the storehouse in the town', 'carry_sack'); this.add(this.t + 1, 'store_town', 'queue', 'waiting for the grain to be measured and sealed for', 'town'); this.go(this.home, w, 'walking home');
        this.homeHours(Math.max(this.t + 0.5, this.sun.set - 1.5), 'resting after the road'); this.evening(this.t); return this.finish(); }
      if (this.P.vigilMan(this.hh.id, d) === this.pid) { const H = this.hd;
        this.morning(T.h0 - this.P.walkH(this.home, T.place, d, w, 'plain') - 0.05); this.go(T.place, 'plain', this.toward(T.place)); this.workBlock(T.place, 'plain', T.act, T.why, Math.max(T.h0, this.t), T.h1, true, T.place);
        this.fieldNoon(T.place, T); this.go(this.home, w); this.atHome(Math.max(this.t + 1.5, Math.min(this.sun.set - 2, this.t + 2.5)), 'sleep', 'sleeping in the afternoon: tonight he keeps watch by the grain heap');
        // home for the evening meal, then out to the floor for the night: he sits up into the late hours and sleeps beside
        // the heap until dawn (the night's watch passes to another man of the house on another night)
        if (this.t < H.supper - 0.3) this.homeHours(H.supper, 'at home');
        if (this.t <= H.supper + 0.05) { if (this.t < H.supper) this.atHome(H.supper, 'rest', 'at home'); this.atHome(this.t + H.sLen, 'eat', 'the evening meal with the household'); }
        else this.atHome(this.t + Math.max(0.3, H.sLen * 0.7), 'eat', 'the evening meal, kept for the late-comer');
        this.atHome(this.t + lerp(0.2, 0.6, r.next()), 'talk', 'with the household');
        this.go(T.place, 'plain', 'out to the threshing floor for the night');
        this.add(Math.max(this.t + 1.5, Math.min(23.7, this.bed() + lerp(0.6, 1.8, r.next()))), T.place, 'rest', 'sitting up by the grain heap on the threshing floor, keeping watch over it', 'plain');
        this.add(24, T.place, 'sleep', 'asleep by the grain heap on the threshing floor, guarding it', 'plain'); return this.segs; }
    }
    const { act, place, why, h0, h1 } = T;
    this.morning(h0 - this.P.walkH(this.home, place, d, w, 'plain') - 0.05); this.go(place, 'plain', this.toward(place)); if (act === 'irrigate' || act === 'dig_canal') this.dispute(place, 'plain');
    this.workBlock(place, 'plain', act, p.sex === 'f' && act === 'reap' ? 'binding sheaves at the harvest' : why, Math.max(h0, this.t), h1, true, place, 12 + this.hd.habit,
      T.all ? undefined : this.hd.bringer >= 0 ? 'the midday meal: bread and water brought out from home by a child of the house' : 'the midday meal: the bread and water he carried out in the morning');
    if (T.kind === 'turn' && this.t < 11) { const f = this.field(this.hh.id); this.go(f, 'plain'); this.workBlock(f, 'plain', 'field_work', this.P.fieldWhy(C, r.next()), this.t, 11.8, true, f); }
    if (T.carryHome) this.go(this.home, w, T.carryHome, 'carry_sack'); // the fodder or the fuel carried home (S1)
    if (this.t < 12.3) this.fieldNoon(this.cur ?? place, T); else { this.go(this.home, w); if (T.all && !this.segs.some(x => x.act === 'eat' && x.t0 > 10.5)) this.noonAtHome(this.backFrom(place)); }
    this.afternoonSession(T, act, T.pmWhy ?? why);
    // the late afternoon, when the heat breaks (CE-14): the household carries sheaves to the threshing floor together at the
    // harvest; the oxen are fed in the ploughing season
    if (T.sheaves && T.late > this.t + 0.5) { this.homeHours(T.late, 'resting through the heat'); this.errand(`threshing:${q}`, 'plain', 'carry_sack', 'carrying sheaves to the threshing floor with the household (E-43)', 1.2, this.home, w); }
    else if (act === 'reap' && T.late > this.t + 0.5 && p.sex === 'm' && r.chance(0.4)) { this.homeHours(T.late, 'resting through the heat'); this.errand(place, 'plain', 'reap', T.kind === 'other' ? 'cutting the last of the sesame and standing the bundles up to dry' : 'binding the last sheaves and gleaning the stubble', 1.3, this.home, w); }
    else if (act === 'plough' && T.late > this.t + 0.5 && r.chance(0.5)) { this.homeHours(T.late, 'resting'); this.atHome(this.t + 1, 'tend_animals', 'feeding and watering the oxen'); }
    this.evening(Math.max(this.t, this.sun.set - 1.2)); return this.finish();
  }
  private servant(): Seg[] {
    const r = this.r, p = this.p, P = this.P, W = this.homeW; this.morning(this.rise() + 0.5);
    // an estate's servants do the estate's work; a town house's (an official's, a scribe's, a storekeeper's) do the house's:
    // its fuel from beyond the town, its water, its errands in the lane, its bread, spinning and washing, the courtyard,
    // waiting on the master (S6 of reviewer B, r5: a scribe's man servant stood at the house "carrying food to the estate
    // workers" and "watering the garden beds" while the son of 13 walked 1.5 h for fuel; C)
    const estate = p.work.startsWith('estate:') || P.membersOn(this.hh.id, this.d).some(x => P.persons[x].job === 'steward');
    const tasks: [string, ActivityId, string][] = estate ? (p.sex === 'f' ? [['home', 'grind', 'grinding for the estate household'], ['home', 'knead', 'kneading dough'], ['home', 'bake', 'baking for the estate'], ['well', 'draw_water', 'drawing water for the estate']]
        : [['home', 'carry_jar', 'carrying jars in the estate stores'], ['home', 'carry_bread', 'carrying food to the estate workers'], ['home', 'talk', 'waiting on the household'], ['well', 'draw_water', 'watering the garden beds by hand']])
      : p.sex === 'f' ? [['home', 'grind', 'grinding for the household'], ...(this.hd.bake ? [['home', 'knead', 'kneading the household’s dough'] as [string, ActivityId, string]] : []), ['home', 'spin', 'spinning for the household'], ['well', 'draw_water', 'drawing water for the house'], ...(this.C.wx.wet ? [] : [['wash', 'wash', 'washing the household’s clothes at the water'] as [string, ActivityId, string]])]
      : [...(this.C.wx.wet ? [] : [['fuel', 'gather', 'gathering dung and brushwood for the house'] as [string, ActivityId, string], ['errand', 'exchange', 'on an errand for the household in the lane'] as [string, ActivityId, string]]), ['well', 'draw_water', 'drawing water for the house'], ['home', 'talk', 'waiting on the master'], ['home', 'craft', 'mending the house’s tools and baskets'], ['home', 'clean', 'sweeping the courtyard and the roof']];
    let ate = false, fuel = 0;
    let last = ''; while (this.t < 17) { if (!ate && this.t > 11.7) { ate = true; this.atHome(this.t + 0.5, 'eat', 'the midday meal with the household'); continue; }
      let [k, a, why] = r.pick(tasks); if (why === last || (k === 'fuel' && fuel)) [k, a, why] = r.pick(tasks); last = why; // one task, then another
      const lim = Math.min(17, ate ? 99 : Math.max(this.t + 0.3, 12));
      if (k === 'well') this.well(this.t + 0.5, why);
      else if (k === 'wash') { const c = `canal:${this.hh.q}`; this.go(c, W, 'to the water with the washing', 'carry_sack'); this.add(this.t + r.range(0.8, 1.5), c, 'wash', why, W); this.go(this.home, W, 'carrying the washing home', 'carry_sack'); }
      else if (k === 'fuel' && !fuel) { fuel++; const o = W === 'plain' ? `outside:${this.hh.q}` : 'outside'; this.go(o, W, 'out beyond the town for fuel'); this.add(this.t + r.range(0.7, 1.3), o, 'gather', why, W); this.go(this.home, W, 'carrying the fuel home', 'carry_sack'); }
      else if (k === 'errand' && !(this.C.wx.dustH && this.C.wx.dustH[0] < this.t + 1.3 && this.C.wx.dustH[1] > this.t)) { const l = `lane:${this.hh.q}`; this.go(l, W, 'to the lane with a measure of barley', 'carry_sack'); this.add(this.t + r.range(0.3, 0.8), l, 'exchange', why, W); this.go(this.home, W, 'carrying home what it fetched', 'carry_jar'); }
      else this.atHome(Math.min(lim, this.t + r.range(0.8, 2)), a === 'gather' || k === 'errand' ? 'talk' : a, a === 'gather' || k === 'errand' ? 'waiting on the master' : why); }
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
    let lastVisit = ''; const smallOnes = this.P.membersOn(this.hh.id, this.d).some(x => x !== this.pid && this.ageOf(x) < 10);
    // the morning and the afternoon are each a few of the old people's occupations in turn (lives.json elders.choices);
    // in the plain an old man may also sit out by the household's crop or the threshing floor, or see to the animals
    const one = (until: number) => {
      const E = L.elders; const w = { ...(E.choices as Record<'lane' | 'visit' | 'work' | 'children' | 'errand' | 'rest', number>), ...(smallOnes ? {} : { children: 0 }), fields: plain && p.sex === 'm' ? (harvest ? E.plain.fields_men_harvest : E.plain.fields_men) : 0, animals: plain ? E.plain.animals : 0 };
      if (inside) { w.lane = 0; w.visit = 0; w.errand = 0; w.fields = 0; w.animals /= 2; }
      if (C.heatRest && this.t >= 11 && this.t < this.sun.set - 2.5) { w.lane = 0; w.errand = 0; w.fields = 0; } // (not out through the heat: S5 r5)
      const k = this.choose(w); const t1 = Math.min(until, this.t + r.range(E.spell_h[0], E.spell_h[1]));
      if (k === 'lane') { this.go(l, W); this.add(Math.max(this.t + 0.3, t1), l, 'talk', 'sitting and talking in the lane', W); this.go(this.home, W); }
      else if (k === 'visit') { const v = this.visitTarget(); if (v && v.place !== lastVisit) { lastVisit = v.place; this.go(v.place, v.where, 'visiting'); this.add(Math.max(this.t + 0.3, t1), v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, W); } else this.atHome(t1, 'talk', 'with the household'); }
      else if (k === 'work') { const g = r.chance(0.5); this.atHome(p.sex === 'f' && g ? Math.min(t1, this.t + r.range(0.35, 0.7)) : t1, p.sex === 'f' ? (g ? 'grind' : 'spin') : 'craft', p.sex === 'f' ? (g ? 'light work: a little grinding' : 'light work: spinning') : 'mending baskets and tools'); }
      else if (k === 'children') this.atHome(t1, 'talk', 'with the household'); // (not "minding the grandchildren": the little ones' plans say who has them, S2 r5)
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
    const r = this.r, p = this.p, C = this.C, T = this.hd.task; if (this.age < 14 && this.P.keeperOn(this.hh.id, this.d) !== this.pid) return this.child();
    const wetSoon = (h: number) => C.wx.wet || this.rainIn(this.t, this.t + h) > 0.1;
    // in the plain the harvest, threshing, the vintage and the fruit take the whole household (E-41 ... E-46): she goes
    // out with them, eats with them, and carries sheaves with them when the heat breaks
    if (this.hh.zone === 'plain' && T?.all && !C.wx.storm && u01(this.P.seed, S.assign, 7950 + this.pid, this.d) < L.homemaker.harvest_share) {
      const why = T.kind === 'reap' ? (T.why.startsWith('helping') ? T.why : 'binding sheaves at the harvest') : T.kind === 'thresh' ? (C.wx.windAM >= L.winnowing.wind_ms ? 'winnowing on the village floor (E-43)' : 'turning the sheaves under the animals’ hooves on the threshing floor (E-43)') : T.why;
      this.morning(T.h0 - this.P.walkH(this.home, T.place, this.d, this.homeW, 'plain') - 0.05); this.go(T.place, 'plain', this.toward(T.place)); this.workBlock(T.place, 'plain', T.act, why, Math.max(T.h0, this.t), T.h1, true, T.place, 12 + this.hd.habit);
      if (this.t < 12.3) this.fieldNoon(T.place, T); else { this.go(this.home, this.homeW); if (!this.segs.some(x => x.act === 'eat' && x.t0 > 10.5)) this.noonAtHome(this.backFrom(T.place)); }
      // the afternoon: she goes back out with them when the heat allows, or she stays at home and works there
      if (T.pm && u01(this.P.seed, S.assign, 7960 + this.pid, this.d) < 0.6) this.afternoonSession(T, T.act, T.kind === 'reap' ? 'binding sheaves in the afternoon' : T.pmWhy ?? why);
      const until = T.sheaves ? T.late : Math.max(this.t + 1, T.late);
      this.homeHours(until, C.wx.tmax >= 30 ? 'resting through the heat' : 'at home');
      if (T.sheaves) this.errand(`threshing:${this.hh.q}`, 'plain', 'carry_sack', 'carrying sheaves to the threshing floor with the household (E-43)', 1.2, this.home, this.homeW);
      else { const HA = L.homemaker.harvest_afternoon; const k = this.choose({ grind: HA.grind, weave: HA.weave, lane: wetSoon(1.3) ? 0 : HA.lane });
        const lim = this.hd.supper - 0.15;
        if (k === 'lane' && lim - this.t > 0.8) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(Math.min(lim - 0.1, this.t + r.range(0.6, 1.3)), l, 'talk', 'with the women in the lane', this.homeW); this.go(this.home, this.homeW); }
        else if (lim - this.t > 0.4) this.atHome(Math.min(lim, this.t + r.range(0.8, 1.6)), k === 'weave' ? 'spin' : 'grind', k === 'weave' ? 'spinning' : 'grinding the household’s flour'); }
      if (r.chance(0.6) && !C.wx.wet && this.hd.supper - this.t > 0.75) this.well(this.t + 0.4, 'fetching water'); this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
    }
    this.morning(this.rise() + 2.3, true); this.rationRun(); this.go(this.home, this.homeW);
    const u = r.next(); const l = `lane:${this.hh.q}`; const kids = this.P.membersOn(this.hh.id, this.d).filter(x => x !== this.pid && this.ageOf(x) < 10).length;
    if (u < 0.3 && !wetSoon(2)) { const v = this.visitTarget(); if (v) { this.go(v.place, v.where, 'visiting'); this.add(this.t + r.range(0.8, 2), v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, this.homeW); } }
    else if (u < 0.45 && !C.short.get(p.group) && !wetSoon(1.2) && !(C.wx.dustH && C.wx.dustH[0] < this.t + 1.2 && C.wx.dustH[1] > this.t)) { this.go(l, this.homeW); this.add(this.t + r.range(0.5, 1.2), l, 'exchange', 'exchanging goods in kind', this.homeW); this.go(this.home, this.homeW); }
    else if (u < 0.55 && !wetSoon(2) && this.hh.zone !== 'terrace') { const c = `canal:${this.hh.q}`; this.go(c, this.homeW); this.add(this.t + r.range(1, 2), c, 'wash', 'washing clothes at the water', this.homeW); this.go(this.home, this.homeW); }
    if (this.t < this.hd.noon - 0.3) this.homeHours(this.hd.noon, 'at home'); void kids; // (S2, S8 r5: see homeHours)
    // the early afternoon is her hours at home (the spindle, the quern, the lane, the children; in winter mostly the spindle
    // and the loom: S7, r4). Was: one block of rest (six days in ten) or of spinning, 2-3 h long
    this.noonAtHome(); this.homeHours(Math.max(this.t + 0.5, 14.5 + r.next()), 'at home');
    if (r.chance(0.5) && !C.wx.wet) this.well(this.t + 0.4, 'fetching water'); this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
  }
  /** a party with a halmi: arrival, the days of its stay, departure (E-21); each day of the stay has its own business (C) */
  private traveller(): Seg[] {
    const P = this.P, p = this.p, d = this.d, r = this.r; const pa = P.parties[p.idx]; const k = d - p.arrive;
    if (d === p.arrive) { this.add(Math.max(0.5, pa.hour - 2.5), '-', 'offmap', `on the road from ${pa.route}, not yet in the plain`, 'away'); this.add(Math.max(this.t + 0.5, pa.hour - 0.5), 'road:arrival', 'walk', `on the road from ${pa.route}`, 'road'); this.add(pa.hour, 'station', 'walk', 'arriving at the road station', 'town'); this.add(this.t + 0.6, 'station', 'queue', 'showing the halmi and drawing travel rations (E-21)', 'town');
      this.add(this.t + 0.8, 'station', 'tend_animals', 'unloading and watering the animals', 'town'); this.add(Math.max(this.t, this.sun.set), 'station', 'rest', 'resting after the road', 'town'); this.add(this.t + 0.6, 'station', 'eat', 'evening meal', 'town'); this.add(24, 'station', 'sleep', 'asleep at the station lodging', 'town'); return this.segs; }
    const pu = (k: number) => u01(P.seed, S.assign, 9500 + p.idx, d, k); const wakeP = this.sun.rise - 0.4 + 0.7 * pu(1);
    this.add(wakeP - 0.25 * r.next(), 'station', 'sleep', 'asleep at the station lodging', 'town'); this.add(wakeP, 'station', 'rest', 'up at the station lodging', 'town');
    this.add(wakeP + lerp(0.25, 0.5, pu(2)) + 0.02 * pa.size, 'station', 'eat', 'breakfast with the party', 'town');
    if (d === p.leave) { // loading takes longer the bigger the party; the road out to the plain's edge is its own length, at its own pace (C)
      const km = 9 + 5 * u01(P.seed, S.assign, salt(pa.route), 3), kmh = lerp(3.2, 4.4, pu(4));
      this.add(this.t + lerp(0.4, 0.8, pu(3)) + 0.02 * pa.size, 'station', 'tend_animals', 'loading the animals', 'town'); this.add(this.t + km / kmh, 'road:departure', 'walk', 'on the road out of the plain', 'road'); this.add(24, '-', 'offmap', 'gone on toward the next station', 'away'); return this.segs; }
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
  /** a transhumant band's people passing along the plain (E-49; lives.json herders; S4 of shadow review r4; C). The band is
   *  herding families: the men and the older boys move the flock ahead with the dogs, grazing, and it lies up through the
   *  midday heat; the women, the children and the old follow with the loaded donkeys (one man in four with them, by turns)
   *  and reach the new camp first; the women milk before dawn and at dusk in the months after lambing, strike and pitch the
   *  tents, fetch water and fuel and bake; two men watch the flock through the night by turns and walk with the donkeys the
   *  next day, sleeping at the halt and in the afternoon; on about one day in four (and in rain) the band stays where it is.
   *  The band's hours are shared (Population.bandDay); each person's day follows its age, sex and turn. An infant is with its
   *  mother (small()) */
  private herderPassing(): Seg[] {
    const P = this.P, p = this.p, d = this.d, r = this.r, b = p.idx, B = P.bandDay(b, d), set = this.sun.set, age = this.age, male = p.sex === 'm';
    if (age === 0) return this.small();
    const camp = (c: number) => `camp:band${b}:${c}`, fold = (c: number) => `flock:band${b}:${c}`, route = `route:band${b}:${B.k}`, stream = (c: number) => `water:band${b}:${c}`;
    const role = age < 5 ? 'little' : age < 10 ? 'child' : age >= 56 ? 'elder' : male ? (age >= 16 ? 'man' : 'youth') : age >= 14 ? 'woman' : 'girl';
    const mom = p.mother >= 0 && P.present(p.mother, d) && P.home(p.mother, d) === P.home(this.pid, d) ? p.mother : -1;
    const prev = B.prev, watchedFirst = prev?.w1 === this.pid, watchedSecond = prev?.w2 === this.pid, watched = watchedFirst || watchedSecond;
    const withFlock = (role === 'man' && !B.baggage.includes(this.pid)) || (role === 'youth' && !watched);
    const W: Where = 'plain';
    /** at a place until t1 (no piece of under a minute; the day never runs back) */
    const at = (t1: number, place: string, act: ActivityId, why: string, where: Where = W, carry?: string) => { if (t1 <= this.t + 0.015) return; this.add(Math.min(24, t1), place, act, why, where); const s = this.segs[this.segs.length - 1];
      if (carry) s.carry = carry; if ((role === 'little') && mom >= 0) s.with = mom; };
    const road = (t1: number, why: string, carry?: string) => at(t1, 'road:plain', role === 'little' ? 'rest' : 'walk', why, 'road', carry);
    const c0 = B.camp0, c1 = B.camp1, staff = 'a herdsman’s staff', bread = B.milk ? 'bread and milk' : 'bread and curds';
    // ---- the night before: asleep in the tent, or the watch with the flock by turns
    if (B.k === 0) { const down = Math.max(0.8, B.hour - 2.5); this.add(Math.min(down - 0.3, B.wake), '-', 'sleep', 'asleep in the last camp in the hills, not yet in the plain', 'away');
      this.add(this.t + 0.3, '-', 'eat', role === 'little' ? 'a meal with the mother before the road down' : `${bread} before the road down`, 'away'); if (role === 'little' && mom >= 0) this.segs[this.segs.length - 1].with = mom;
      this.add(down, '-', 'offmap', 'coming down from the hills with the band, not yet in the plain', 'away'); }
    else if (watchedFirst) { at(prev!.w1end, fold(c0), 'herd', 'watching the flock with the dogs in the night, by turns', W, staff); at(B.wake, camp(c0), 'sleep', 'asleep in the tent after the first watch'); }
    else if (watchedSecond) { at(prev!.w1end, camp(c0), 'sleep', 'asleep in the tent'); at(B.wake - 0.1, fold(c0), 'herd', 'watching the flock with the dogs in the night, by turns', W, staff); }
    else at(role === 'woman' || role === 'girl' ? B.wake - 0.25 : role === 'man' || role === 'youth' ? B.wake : B.wake + (role === 'elder' ? 0.3 : role === 'child' ? 0.6 : 0.8), camp(c0), 'sleep', 'asleep in the tent');
    // ---- the day
    if (B.k === 0) { // coming down into the plain (E-49): the flock with the men, the families with the loaded donkeys
      const come = Math.max(this.t + 0.5, B.hour);
      if (withFlock) { at(come, 'road:arrival', 'herd', 'coming down into the plain with the flock and the dogs (E-49)', W, staff); if (this.t < 12.2) { at(Math.max(this.t + 0.3, 12), route, 'herd', 'grazing the flock along the plain edge (E-49)', W, staff); at(this.t + 0.35, route, 'eat', 'a midday meal of bread and curds by the flock'); }
        at(Math.max(this.t + 0.3, B.arriveFlock), route, 'herd', 'grazing the flock along the plain edge to the first camp (E-49)', W, staff); at(this.t + 0.5, fold(c1), 'tend_animals', 'watering the flock and folding it beside the tents'); }
      else { at(come, 'road:arrival', role === 'little' ? 'rest' : 'walk', role === 'little' ? 'riding on the donkey’s load beside the mother, coming down into the plain' : 'coming down into the plain with the loaded donkeys (E-49)', 'road');
        if (this.t < 12.2) { road(Math.max(this.t + 0.3, 12), role === 'little' ? 'riding on the donkey’s load beside the mother' : 'walking beside the loaded donkeys along the plain edge'); at(this.t + 0.35, route, 'eat', role === 'little' ? 'bread and curds with the mother at the halt' : 'bread and curds at the halt'); }
        road(Math.max(this.t + 0.3, Math.min(set - 1.3, B.arriveBag)), role === 'little' ? 'riding on the donkey’s load beside the mother' : 'walking on with the donkeys to the first camp'); this.atCamp(role, c1, B, true); }
      return this.herdEvening(role, c1, B);
    }
    const leaving = d === B.leave;
    // the morning at last night's camp
    if (role === 'woman' && !watched) { if (B.milk) { at(this.t + 0.55, fold(c0), 'tend_animals', 'milking the ewes and the goats at first light'); at(this.t + 0.25, camp(c0), 'cook', 'warming the milk and setting it for curds'); } else at(this.t + 0.4, camp(c0), 'bake', 'baking flat bread in the embers for the day'); }
    else if (role === 'girl') at(this.t + 0.4, stream(c0), 'draw_water', 'fetching water from the stream for the tent');
    else if (withFlock && B.moving) at(Math.max(this.t + 0.25, B.wake + 0.3), fold(c0), 'tend_animals', 'letting the flock out of the fold and counting it');
    at(this.t + (role === 'little' || role === 'child' ? 0.25 : 0.3), camp(c0), 'eat', role === 'little' ? 'a meal with the mother' : B.moving ? `${bread} before the move` : `${bread} in the tent`);
    if (!B.moving && !leaving) { this.restDay(role, c0, B, watched, withFlock); return this.herdEvening(role, c1, B); }
    // a moving day (or the day the band leaves the plain)
    const out = leaving ? B.haltA : 24;
    if (withFlock) {
      at(Math.max(this.t + 0.1, B.departF), fold(c0), 'tend_animals', 'watering the flock before the move');
      at(Math.min(out, B.haltA), route, 'herd', leaving ? 'moving the flock on toward the hills with the dogs (E-49)' : 'moving the flock along the plain edge with the dogs, grazing as it goes (E-49)', W, staff);
      at(this.t + 0.35, route, 'eat', 'a midday meal of bread and curds by the flock');
      if (leaving) { at(24, '-', 'offmap', 'gone on out of the plain with the band', 'away'); return this.segs; }
      if (B.haltB - this.t > 0.3) at(B.haltB, route, this.C.wx.tmax >= 30 ? 'sleep' : 'rest', this.C.wx.tmax >= 30 ? 'sleeping in the shade while the flock lies up through the heat' : 'resting while the flock lies up at midday');
      at(Math.max(this.t + 0.5, B.arriveFlock), route, 'herd', 'moving the flock on to the new camp (E-49)', W, staff);
      at(this.t + 0.5, fold(c1), 'tend_animals', 'watering the flock and folding it beside the tents');
      return this.herdEvening(role, c1, B);
    }
    // with the loaded donkeys: the women, the children and the old, and the men whose turn it is
    const who = role === 'man' ? (watched ? 'leading the loaded donkeys after the night watch' : 'leading the loaded donkeys, the families with him') : role === 'little' ? 'riding on the donkey’s load beside the mother' : role === 'elder' ? (age >= 65 ? 'riding a donkey with the families' : 'walking slowly beside the donkeys') : role === 'child' ? 'walking beside the donkeys with the mother' : role === 'girl' ? 'walking beside the donkeys with the little ones' : 'walking beside the loaded donkeys with the children';
    if (role === 'man' || role === 'woman' || role === 'girl' || role === 'youth') at(Math.max(this.t + 0.3, B.depart), camp(c0), 'carry_sack', role === 'man' || role === 'woman' ? 'taking down the tents and loading the donkeys' : 'helping to load the donkeys');
    else at(Math.max(this.t + 0.2, B.depart), camp(c0), role === 'little' ? 'play' : 'rest', role === 'little' ? 'playing by the tent while it comes down' : role === 'child' ? 'waiting while the tents come down' : 'sitting by the tent while it comes down');
    const mid = (this.t + Math.min(out, B.haltA)) / 2;
    // (the stop is at water on the way, not at the halt: S10)
    if (Math.min(out, B.haltA) - this.t > 1.5) { road(mid, who, role === 'man' || role === 'woman' ? 'the donkeys’ lead rope' : undefined); at(this.t + 0.15, `${route}:water`, role === 'little' ? 'play' : 'rest', role === 'little' ? 'down from the donkey for a moment at a short stop' : 'a short stop on the way to let the donkeys drink'); }
    road(Math.min(out, B.haltA), who, role === 'man' || role === 'woman' ? 'the donkeys’ lead rope' : undefined);
    at(this.t + 0.35, route, 'eat', role === 'little' ? (age === 1 && mom >= 0 ? 'nursed by the mother at the halt' : 'bread and curds with the mother at the halt') : 'bread and curds at the halt');
    if (leaving) { at(24, '-', 'offmap', 'gone on out of the plain with the band', 'away'); return this.segs; }
    if (B.haltB - this.t > 0.3) at(B.haltB, route, watched || role === 'little' || (role === 'child' && age < 7) ? 'sleep' : 'rest', watched ? 'sleeping at the halt after the night watch' : role === 'little' ? 'a midday sleep at the halt' : role === 'child' && age < 7 ? 'a sleep in the shade at the halt' : 'resting at the halt in the shade');
    road(Math.max(this.t + 0.4, B.arriveBag), role === 'man' ? 'leading the donkeys on to the new camp' : who, role === 'man' || role === 'woman' ? 'the donkeys’ lead rope' : undefined);
    this.atCamp(role, c1, B, false, watched);
    return this.herdEvening(role, c1, B);
  }
  /** the afternoon at the new camp until the evening meal (herders; C) */
  private atCamp(role: string, c: number, B: BandDay, first: boolean, watched = false) {
    const b = this.p.idx, camp = `camp:band${b}:${c}`, fold = `flock:band${b}:${c}`, stream = `water:band${b}:${c}`, r = this.r, mom = this.p.mother;
    const at = (t1: number, place: string, act: ActivityId, why: string) => { if (t1 <= this.t + 0.015) return; this.add(Math.min(24, t1), place, act, why, 'plain'); if (role === 'little' && mom >= 0) this.segs[this.segs.length - 1].with = mom; };
    const cookAt = B.supper - 0.55;
    if (role === 'man' || role === 'woman') at(this.t + 0.8, camp, 'carry_sack', role === 'man' ? 'unloading the donkeys and pitching the tents' : 'unloading the donkeys and pitching the tent');
    if (watched) at(this.t + lerp(2.8, 3.5, r.next()), camp, 'sleep', 'sleeping in the tent after the night watch');
    if (role === 'man') { at(this.t + 0.5, stream, 'tend_animals', 'watering the donkeys at the stream and hobbling them by the tents');
      at(Math.max(this.t + 0.4, Math.min(B.supper - 0.1, this.t + lerp(0.6, 1.2, r.next()))), camp, 'gather', 'gathering brushwood for the fire'); }
    else if (role === 'woman') { at(this.t + 0.35, stream, 'draw_water', 'fetching water from the stream for the tent'); at(this.t + lerp(0.5, 0.9, r.next()), camp, 'gather', 'gathering brushwood and dung for the fire');
      if (cookAt - this.t > 0.5) at(Math.min(cookAt, Math.max(this.t + 0.4, B.arriveFlock + 0.1)), camp, 'spin', 'spinning wool by the tent, the children about her');
      if (B.milk && B.arriveFlock + 0.2 < B.supper - 0.3) at(Math.min(B.supper - 0.3, Math.max(this.t, B.arriveFlock + 0.2) + 0.5), fold, 'tend_animals', 'milking the ewes and the goats as the flock comes in'); }
    else if (role === 'girl') { at(this.t + 0.35, stream, 'draw_water', 'fetching water from the stream for the tent'); at(this.t + lerp(0.5, 0.9, r.next()), camp, 'gather', 'gathering brushwood for the fire'); if (cookAt - this.t > 0.4) at(cookAt, camp, 'rest', 'minding the little ones by the tent'); }
    else if (role === 'child') { at(this.t + lerp(0.6, 1.2, r.next()), camp, 'play', 'playing by the new tents with the other children'); if (this.age >= 7) at(this.t + 0.5, camp, 'gather', 'gathering dry brush for the fire'); at(Math.max(this.t, B.supper - 0.05), camp, 'play', 'playing by the tents until the evening meal'); }
    else if (role === 'little') { at(Math.max(this.t, B.supper - 0.05), camp, 'play', 'playing by the tent near the mother'); }
    else if (role === 'elder') at(Math.max(this.t, B.supper - 0.05), camp, 'rest', first ? 'sitting by the tent after the road' : 'sitting by the new tent, minding the little ones');
    if (role === 'woman' && this.t < B.supper) at(B.supper, camp, 'cook', 'cooking the evening meal over the fire, the bread on the embers');
  }
  /** a day the band stays at its camp (herders; C): the flock grazes near the tents with some of the men and the boys by
   *  turns; the women milk, make the curds and butter, fetch water and fuel and weave; the others see to the animals and the
   *  gear */
  private restDay(role: string, c: number, B: BandDay, watched: boolean, withFlock: boolean) {
    const b = this.p.idx, camp = `camp:band${b}:${c}`, fold = `flock:band${b}:${c}`, stream = `water:band${b}:${c}`, graze = `route:band${b}:${B.k}`, r = this.r, mom = this.p.mother, hot = this.C.wx.tmax >= 30, wet = this.C.wx.wet;
    const at = (t1: number, place: string, act: ActivityId, why: string, carry?: string) => { if (t1 <= this.t + 0.015) return; this.add(Math.min(24, t1), place, act, why, 'plain'); const s = this.segs[this.segs.length - 1]; if (carry) s.carry = carry; if (role === 'little' && mom >= 0) s.with = mom; };
    const noonMeal = () => at(this.t + 0.4, camp, 'eat', role === 'little' ? 'a midday meal with the mother' : 'a midday meal of bread and curds in the tent');
    const grazer = withFlock && B.grazers.includes(this.pid); // half the flock's men and boys, by turns, take it out today
    if (grazer) { at(Math.max(this.t + 0.2, B.departF), fold, 'tend_animals', 'letting the flock out of the fold and counting it');
      at(Math.max(this.t + 0.5, B.haltA), graze, 'herd', 'grazing the flock on the stubble and fallow near the camp with the dogs (E-49)', 'a herdsman’s staff'); at(this.t + 0.4, graze, 'eat', 'a midday meal of bread and curds by the flock');
      if (hot) at(B.haltB, graze, 'sleep', 'sleeping in the shade while the flock lies up through the heat');
      at(Math.max(this.t + 0.5, B.arriveFlock), graze, 'herd', 'grazing the flock back toward the tents', 'a herdsman’s staff'); at(this.t + 0.4, fold, 'tend_animals', 'watering the flock and folding it beside the tents'); return; }
    let lastO = '';
    const spell = (until: number, opts: [ActivityId, string, string, number][]) => { for (let g = 0; g < 8 && this.t < until - 0.3; g++) { const pickO = () => { const tot = opts.reduce((s, o) => s + o[3], 0); let x = r.next() * tot, o = opts[0]; for (const y of opts) { if (x < y[3]) { o = y; break; } x -= y[3]; } return o; };
      let o = pickO(); if (o[1] === lastO && opts.length > 1) o = pickO(); lastO = o[1]; // not the same again straight away
      at(Math.min(until, this.t + lerp(0.6, 1.5, r.next())), o[2] === 'fold' ? fold : o[2] === 'stream' ? stream : camp, o[0], o[1]); } if (this.t < until) at(until, camp, role === 'little' || role === 'child' ? 'play' : 'rest', role === 'little' ? 'playing by the tent near the mother' : role === 'child' ? 'playing by the tents' : 'resting by the tent'); };
    const am: [ActivityId, string, string, number][] = role === 'man' || role === 'youth' ? [['tend_animals', 'seeing to the donkeys’ sores and the lame sheep', 'fold', 2], ['craft', 'mending the saddlebags, the ropes and the tent pegs', 'camp', 2], ['talk', 'talking with the men of the band by the tents', 'camp', 1]]
      : role === 'woman' ? [[B.milk ? 'cook' : 'bake', B.milk ? 'churning the milk in a skin for butter and setting the curds' : 'baking flat bread on the embers', 'camp', 2], ['weave', 'weaving at the ground loom by the tent', 'camp', 2], ['spin', 'spinning wool by the tent', 'camp', 1.5], ['draw_water', 'fetching water from the stream for the tent', 'stream', 1]]
      : role === 'girl' ? [['draw_water', 'fetching water from the stream for the tent', 'stream', 1], ['spin', 'spinning wool beside the women', 'camp', 1.5], ['gather', 'gathering brushwood for the fire', 'camp', 1], ['rest', 'minding the little ones by the tent', 'camp', 1]]
      : role === 'child' ? [['play', 'playing by the tents with the other children', 'camp', 3], ['gather', 'gathering dry brush for the fire', 'camp', this.age >= 7 ? 1 : 0], ['play', 'playing by the stream with the other children', 'stream', 1], ['draw_water', 'fetching water from the stream with a small jar', 'stream', this.age >= 7 ? 0.7 : 0], ['tend_animals', 'with the lambs and the kids by the fold', 'fold', 0.8]]
      : role === 'little' ? [['play', 'playing by the tent near the mother', 'camp', 1]] : [['rest', 'sitting by the tent in the sun', 'camp', 1], ['talk', 'talking with the old people of the band', 'camp', 1], ['rest', 'minding the little ones by the tent', 'camp', 1]];
    if (watched) at(this.t + lerp(2.5, 3.5, r.next()), camp, 'sleep', 'sleeping in the tent after the night watch');
    spell(B.haltA, am); noonMeal();
    if (hot || role === 'little' || (role === 'child' && this.age < 7)) at(this.t + (hot ? lerp(1.5, 2.5, r.next()) : 1.2), camp, 'sleep', role === 'little' ? 'a midday sleep in the tent' : 'sleeping in the tent through the heat');
    const cookAt = B.supper - (role === 'woman' ? 0.55 : 0.05);
    if (role === 'woman' && B.milk) { spell(Math.max(this.t, B.arriveFlock - 0.1), am); at(Math.min(cookAt, this.t + 0.5), fold, 'tend_animals', 'milking the ewes and the goats as the flock comes in'); }
    spell(cookAt, am);
    if (role === 'woman') at(B.supper, camp, 'cook', 'cooking the evening meal over the fire, the bread on the embers');
  }
  /** the evening at the camp (herders; C): the meal by the fire, the fire, bed; tonight's first watchman goes out to the flock */
  private herdEvening(role: string, c: number, B: BandDay): Seg[] {
    const b = this.p.idx, camp = `camp:band${b}:${c}`, fold = `flock:band${b}:${c}`, mom = this.p.mother, age = this.age;
    const at = (t1: number, place: string, act: ActivityId, why: string, carry?: string) => { if (t1 <= this.t + 0.015) return; this.add(Math.min(24, t1), place, act, why, 'plain'); const s = this.segs[this.segs.length - 1]; if (carry) s.carry = carry; if (role === 'little' && mom >= 0) s.with = mom; };
    if (this.t < B.supper - 0.02) at(B.supper, camp, role === 'little' || role === 'child' ? 'play' : 'talk', role === 'little' ? 'playing by the tent near the mother' : role === 'child' ? 'playing by the tents until the evening meal' : 'by the fire while the evening meal is made');
    at(this.t + (role === 'little' ? 0.35 : 0.5), camp, 'eat', role === 'little' ? 'the evening meal with the mother' : 'the evening meal by the fire');
    if (B.w1 === this.pid) { at(24, fold, 'herd', 'watching the flock with the dogs in the night, by turns', 'a herdsman’s staff'); return this.segs; }
    const bed = Math.min(23.5, Math.max(this.t + 0.2, role === 'little' ? this.t + 0.2 : role === 'child' ? this.sun.set + 0.9 : role === 'girl' ? this.sun.set + 1.3 : this.sun.set + lerp(1.3, 2.2, 1 - this.p.trait)));
    if (bed - this.t > 0.1) at(bed, camp, role === 'child' || role === 'little' ? 'play' : 'talk', role === 'child' || role === 'little' ? 'by the fire with the family' : age >= 56 ? 'by the fire, telling of the road' : 'by the fire with the band');
    at(24, camp, 'sleep', 'asleep in the tent'); return this.segs;
  }
}
/** the plan segment in force at hour h */
export function segAt(segs: Seg[], h: number): Seg { for (const s of segs) if (h < s.t1) return s; return segs[segs.length - 1]; }
