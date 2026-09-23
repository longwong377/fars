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
import { u01, salt, HStream } from './hash';
import { dateOf, REGNAL_DAYS, travellerParties, transfers, transhumantBands, flockDrives, DayCtx, EventCalendar } from './calendar';
import { colPlace } from './construction';
import type { ActivityId } from './activities';

const POPD = popData as any, T = townData as any, L = livesData as any;
export type Job = 'guard' | 'builder' | 'porter' | 'camp' | 'scribe' | 'treasury' | 'official' | 'messenger' | 'storekeeper' | 'miller' | 'weaver' | 'brewer' | 'groom'
  | 'shepherd' | 'priest' | 'caretaker' | 'gardener' | 'farmer' | 'craftsman' | 'servant' | 'steward' | 'homemaker' | 'child' | 'elder' | 'traveller' | 'herder';
export type Where = 'terrace' | 'town' | 'plain' | 'road' | 'away';
export interface Seg { t0: number; t1: number; place: string; act: ActivityId; why: string; where: Where }
export interface Person {
  id: number; sex: 'm' | 'f'; age: number; job: Job; sub: string; rank: number; hh: number; hh2: number; marry: number; group: number;
  origin: string; persian: boolean; born: number; dies: number; arrive: number; leave: number; qa: number; ties: number[]; bday: number; trait: number;
  file: number; idx: number; gang: number; squad: number; agent: number; mother: number; zone: 'terrace' | 'town' | 'plain' | 'transient'; work: string;
  /** the detailed agent's name when this person is one of the Terrace slice */
  nm?: string | null;
}
export interface Household { id: number; home: string; q: string; zone: 'town' | 'plain' | 'terrace' | 'transient'; xy: [number, number]; persian: boolean; members: number[]; kin: number[]; deaths: number[]; births: number[] }
export interface Group { id: number; kind: string; label: string; members: number[]; issuePlace: string; silver: boolean; head: number; from: number; zone: 'terrace' | 'town' }
export interface SliceSeat { agent: number; role: string; sex: 'm' | 'f'; origin: string; mother?: number; name?: string | null }
export interface PopOpts { court?: boolean; slice?: SliceSeat[] }

/** Terrace places used only by the abstract tier (no full-agent spot yet): their people are counted, not rendered */
export const TERRACE_ABSTRACT = ['hall100_site', 'treasury_inside', 'palaces', 'h100_wall_N', 'h100_wall_S', 'h100_wall_E', 'h100_wall_W', 'camp_extra', 'stair_extra'];
/** the sixteen posts (people_places.json) */
export const GUARD_POSTS = ['post_stair_n', 'post_stair_s', 'post_gate_w1', 'post_gate_w2', 'post_gate_s1', 'post_gate_s2', 'post_apa_w', 'post_apa_e', 'post_treas_1', 'post_treas_2',
  'post_tachara_1', 'post_tachara_2', 'post_hadish_1', 'post_hadish_2', 'post_harem_1', 'post_harem_2'];
export const HEARTHS = ['garrison_hearth_s', 'garrison_hearth_m', 'garrison_hearth_n'];
const TERRACE_XY: [number, number] = [-52, 118.5];
const S = { plan: salt('plan'), sick: salt('sick'), sickd: salt('sickd'), death: salt('death'), birth: salt('birth'), marry: salt('marry'), bday: salt('bday'), disp: salt('disp'),
  dispo: salt('dispo'), assign: salt('assign'), shear: salt('shear'), carer: salt('carer'), gen: salt('gen'), mourn: salt('mourn'), dbl: salt('dbl'), fam: salt('fam'), draft: salt('draft'), name: salt('name') };
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
  constructor(readonly seed: number, readonly opts: PopOpts = {}) {
    for (const f of T.facilities) this.facilities[f.id] = f.at;
    this.parties = travellerParties(seed, !!opts.court); this.transferList = transfers(seed); this.bands = transhumantBands(seed); this.drives = flockDrives(seed);
    this.generate();
    for (const s of opts.slice ?? []) { const pid = this.bySeat.get(s.agent); if (pid !== undefined) this.persons[pid].nm = s.name ?? null; }
    this.precomputeLife();
  }
  attach(cal: EventCalendar) { this.cal = cal; }

  // ================================================================== generation
  private rng(k: number) { return new HStream(this.seed, S.gen, k); }
  private hh(q: string, zone: Household['zone'], persian: boolean, home?: string): number {
    const id = this.households.length; const Q = this.quarters[q]; const r = this.rng(100000 + id);
    const xy: [number, number] = Q ? [Q.xy[0] + r.range(-250, 250), Q.xy[1] + r.range(-250, 250)] : [0, 0];
    this.households.push({ id, home: home ?? `h:${id}`, q, zone, xy, persian, members: [], kin: [], deaths: [], births: [] }); return id;
  }
  private person(x: Partial<Person> & { sex: 'm' | 'f'; age: number; job: Job; hh: number }): number {
    const id = this.persons.length; const r = this.rng(id); const H = this.households[x.hh];
    const p: Person = { id, sub: '', rank: 0, hh2: -1, marry: 1e9, group: -1, origin: 'Persian', persian: H?.persian ?? true, born: -1e9, dies: 1e9, arrive: 0, leave: 1e9, qa: 0, ties: [],
      bday: Math.floor(r.next() * REGNAL_DAYS), trait: r.next(), file: -1, idx: -1, gang: -1, squad: -1, agent: -1, mother: -1, zone: H?.zone ?? 'town', work: '', ...x } as Person;
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
  /** children of a household drawn from the age structure (0-15) */
  private kids(hh: number, n: number, r: HStream, origin: string, group = -1) {
    for (let k = 0; k < n; k++) { const age = Math.floor(r.next() * 14); const c = this.person({ sex: r.chance(0.5) ? 'm' : 'f', age, job: age >= 12 && this.households[hh].zone === 'plain' ? 'farmer' : 'child', hh, origin });
      if (group >= 0 && age >= 4) this.join(group, c); }
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
      if (fam) { this.person({ sex: 'f', age: this.ageIn(r, 17, 38), job: 'homemaker', hh, origin: 'Persian' }); this.kids(hh, r.int(1, 3), r, 'Persian'); }
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
        const pid = this.person({ sex: 'm', age: this.ageIn(r, 18, 50), job: 'builder', sub: kinds[k], hh, origin, gang: k, squad: Math.floor(i / 10), rank: i === 0 ? 2 : i % 10 === 1 ? 1 : 0, agent: seat?.agent ?? -1, work: 'hall100_site' });
        if (k === 0 && i < 14) this.persons[pid].squad = 0; // the slice squad: foreman + 12 stonecutters (+ the chief) share one squad
        this.join(g, pid, k === 0 ? 0.8 : 0, i === 0); members.push(pid); this.builders.push(pid); if (seat) this.bySeat.set(seat.agent, pid);
        if (married) { const w = this.person({ sex: 'f', age: this.ageIn(r, 17, 40), job: 'homemaker', hh, origin }); this.join(famGroups[(i + k) % 3], w, 0.1); this.kids(hh, r.int(0, 3), r, origin, famGroups[(i + k) % 3]); }
      }
      this.gangs.push({ id: k, kind: kinds[k], chief: members[0], members }); this.groups[g].label = `the ${kinds[k]} gang of ${this.nameOf(members[0]) ?? 'an unnamed chief'}`;
    }
    // work-camp women (the slice's bakers and grinders + builders' wives; C) and the slice's children
    const campSeats = [...seatOf('baker'), ...seatOf('grinder')];
    const campWomen: number[] = [];
    for (let i = 0; i < 30; i++) {
      const seat = campSeats[i]; const r = this.rng(-2000 - i);
      const hh = this.hh(this.pickQuarter(r), 'town', seat?.origin === 'Persian');
      const pid = this.person({ sex: 'f', age: this.ageIn(r, 17, 42), job: 'camp', sub: seat?.role ?? (i < 8 ? 'baker' : 'grinder'), hh, origin: seat?.origin ?? r.pick(['Persian', 'Elamite']), agent: seat?.agent ?? -1, work: 'querns' });
      this.join(camp, pid, 0.3, i === 0); campWomen.push(pid); if (seat) this.bySeat.set(seat.agent, pid);
      const kidSeats = seats.filter(s => s.role === 'child' && s.mother === seat?.agent);
      for (const ks of kidSeats) { const c = this.person({ sex: ks.sex, age: 6 + Math.floor(r.next() * 4), job: 'child', hh, origin: ks.origin, agent: ks.agent, mother: pid }); this.join(camp, c); this.bySeat.set(ks.agent, c); }
      if (!seat) this.kids(hh, r.int(0, 2), r, this.persons[pid].origin, camp);
      if (r.chance(0.5)) this.person({ sex: 'm', age: this.ageIn(r, 20, 50), job: 'porter', sub: 'town', hh, origin: this.persons[pid].origin });
    }
    // ---------------- porters of the Terrace (40, C) incl. the slice's six
    const porterSeats = seatOf('porter'); const pG = this.group('porters', 'the porters of the Terrace depot', 'stair_foot', true, 'terrace');
    for (let i = 0; i < 40; i++) { const seat = porterSeats[i]; const r = this.rng(-3000 - i); const origin = seat?.origin ?? r.pick(['Elamite', 'Persian']);
      const hh = this.hh(this.pickQuarter(r), 'town', origin === 'Persian'); const pid = this.person({ sex: 'm', age: this.ageIn(r, 18, 45), job: 'porter', sub: 'terrace', hh, origin, agent: seat?.agent ?? -1, work: 'stair_foot' });
      this.join(pG, pid); if (seat) this.bySeat.set(seat.agent, pid);
      if (r.chance(0.6)) { this.person({ sex: 'f', age: this.ageIn(r, 17, 40), job: 'homemaker', hh, origin }); this.kids(hh, r.int(0, 3), r, origin); } }
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
      for (let c = 0; c < mix.boys + mix.girls; c++) { const r = this.rng(-4800 - k * 100 - c); const hh = hhs[Math.floor(r.next() * hhs.length)];
        const c0 = this.person({ sex: c < mix.boys ? 'm' : 'f', age: 4 + Math.floor(r.next() * 12), job: 'child', hh, origin: this.persons[this.households[hh].members[0]].origin }); this.join(g, c0); if (this.persons[c0].age >= 12) { this.persons[c0].job = 'treasury'; this.persons[c0].sub = craft; this.persons[c0].work = ws; } }
    }
    // ---------------- officials, scribes and storekeepers with their households (~500; C)
    const offG = this.group('officials', 'officials, scribes and storekeepers', 'store_town', false, 'town');
    const offSeats = seatOf('official');
    for (let i = 0; i < 60; i++) { const r = this.rng(-5000 - i); const job: Job = i < 15 ? 'official' : i < 40 ? 'scribe' : 'storekeeper'; const seat = job === 'official' ? offSeats[i] : undefined;
      const persian = job === 'official' || r.chance(0.3); const hh = this.hh(job === 'official' ? (r.chance(0.5) ? 'q_north' : this.pickQuarter(r)) : this.pickQuarter(r), 'town', persian);
      const origin = seat?.origin ?? (persian ? 'Persian' : r.pick(['Elamite', 'Babylonian', 'Syrian']));
      const pid = this.person({ sex: 'm', age: this.ageIn(r, 25, 60), job, sub: job === 'scribe' ? r.pick(['store', 'office']) : '', hh, origin, agent: seat?.agent ?? -1, work: job === 'official' ? 'official_bldg' : job === 'scribe' ? 'store_town' : 'store_town' });
      this.join(offG, pid, 1); this.persons[pid].qa = job === 'official' ? 60 : 40; if (seat) this.bySeat.set(seat.agent, pid);
      this.person({ sex: 'f', age: this.ageIn(r, 18, 45), job: 'homemaker', hh, origin }); this.kids(hh, r.int(1, 4), r, origin);
      for (let s = 0, n = job === 'official' ? r.int(1, 3) : r.int(0, 1); s < n; s++) this.person({ sex: r.chance(0.5) ? 'm' : 'f', age: this.ageIn(r, 14, 50), job: 'servant', hh, origin: r.pick(['Elamite', 'Persian']) }); }
    // ---------------- other state dependants (~1,000): mill, textile, brewery, stables, herdsmen, road station, caretakers, magi
    const stateGroup = (kind: string, label: string, n: number, job: Job, sub: string, sexF: number, work: string, k0: number, silver = false) => {
      const g = this.group(kind, label, 'store_town', silver, 'town');
      for (let i = 0; i < n; i++) { const r = this.rng(k0 - i); const sex = r.chance(sexF) ? 'f' : 'm'; const origin = r.pick(['Persian', 'Elamite', 'Persian']);
        const hh = this.hh(this.pickQuarter(r), 'town', origin === 'Persian'); const pid = this.person({ sex, age: this.ageIn(r, 16, 50), job, sub, hh, origin, work }); this.join(g, pid, r.next() * 0.6, i === 0);
        if (sex === 'm') { this.person({ sex: 'f', age: this.ageIn(r, 17, 40), job: 'homemaker', hh, origin }); } this.kids(hh, r.int(0, 3), r, origin, sex === 'f' ? g : -1); }
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
      if (r.chance(0.6)) { this.person({ sex: 'f', age: this.ageIn(r, 17, 36), job: 'homemaker', hh, origin }); this.kids(hh, r.int(0, 3), r, origin); } }
    stateGroup('men', 'the palace caretakers and lamp keepers', 30, 'caretaker', '', 0.3, 'palaces', -6700);
    for (let i = 0; i < 3; i++) { const r = this.rng(-6800 - i); const hh = this.hh('q_north', 'town', true); const pid = this.person({ sex: 'm', age: this.ageIn(r, 30, 60), job: 'priest', hh, origin: 'Persian', idx: i, work: 'offering_place' });
      this.priests.push(pid); this.person({ sex: 'f', age: this.ageIn(r, 20, 45), job: 'homemaker', hh, origin: 'Persian' }); this.kids(hh, r.int(1, 3), r, 'Persian'); }
    // ---------------- non-state residents of the town (~3,000): garden farmers, estates, craftsmen (C)
    const townTarget = POPD.zones.find((z: any) => z.id === 'town').court_absent.night.spring.w;
    let e = 0; while (this.townCount() < townTarget - 1300) { const r = this.rng(-7000 - e++); const q = this.pickQuarter(r, ['town']); const hh = this.hh(q, 'town', true);
      const f = this.person({ sex: 'm', age: this.ageIn(r, 20, 55), job: 'gardener', hh, origin: 'Persian', work: `garden:${q}` }); this.quarters[q].farmers.push(f);
      this.person({ sex: 'f', age: this.ageIn(r, 17, 45), job: 'homemaker', hh, origin: 'Persian' }); this.kids(hh, r.int(1, 4), r, 'Persian'); if (r.chance(0.3)) this.person({ sex: r.chance(0.5) ? 'm' : 'f', age: this.ageIn(r, 60, 72), job: 'elder', hh, origin: 'Persian' }); }
    for (let i = 0; i < 14; i++) { const r = this.rng(-7500 - i); const q = i % 2 ? 'q_firuzi' : 'q_gohar'; const hh = this.hh(q, 'town', true);
      this.person({ sex: 'm', age: this.ageIn(r, 30, 60), job: 'steward', hh, origin: 'Persian', work: `estate:${hh}` });
      for (let w = 0, n = r.int(1, 2); w < n; w++) this.person({ sex: 'f', age: this.ageIn(r, 18, 45), job: 'homemaker', hh, origin: 'Persian' });
      this.kids(hh, r.int(2, 6), r, 'Persian');
      for (let s = 0, n = r.int(10, 24); s < n; s++) { const sx = r.chance(0.5) ? 'm' : 'f'; this.person({ sex: sx, age: this.ageIn(r, 14, 55), job: sx === 'm' && r.chance(0.6) ? 'gardener' : 'servant', hh, origin: r.pick(['Persian', 'Elamite']), work: `estate:${hh}` }); } }
    let c = 0; while (this.townCount() < townTarget) { const r = this.rng(-8000 - c++); const hh = this.hh(r.chance(0.6) ? 'q_pw_n' : this.pickQuarter(r), 'town', r.chance(0.5));
      const origin = r.pick(['Persian', 'Elamite', 'Babylonian', 'Egyptian']); this.person({ sex: 'm', age: this.ageIn(r, 16, 55), job: 'craftsman', hh, origin, work: 'craft_zone' });
      this.person({ sex: 'f', age: this.ageIn(r, 17, 45), job: 'homemaker', hh, origin }); this.kids(hh, r.int(1, 4), r, origin); }
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
        this.kids(hh, r.int(1, 4), r, this.persons[m].origin); if (r.chance(0.35)) this.person({ sex: r.chance(0.5) ? 'm' : 'f', age: this.ageIn(r, 58, 75), job: 'elder', hh, origin: this.persons[m].origin });
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
    for (let i = 0; i < n0; i++) {
      const p = this.persons[i]; if (p.zone === 'transient') continue;
      const ud = u01(this.seed, S.death, i); const pd = deathP(p.age) * REGNAL_DAYS / 365;
      if (ud < pd) { p.dies = Math.max(p.arrive, Math.floor(ud / pd * REGNAL_DAYS)); this.lifeByDay[p.dies].deaths.push(i); this.households[p.hh].deaths.push(p.dies); }
      if (p.sex === 'f' && p.age >= 15 && p.age <= 44) { const ub = u01(this.seed, S.birth, i); const pb = L.birth_p_year_women_15_44.v * REGNAL_DAYS / 365;
        if (ub < pb) { const day = Math.floor(ub / pb * REGNAL_DAYS); if (day < p.dies && day >= p.arrive) {
          const c = this.person({ sex: u01(this.seed, S.birth, i, 1) < 0.5 ? 'm' : 'f', age: 0, job: 'child', hh: p.hh, origin: p.origin, born: day, mother: i, arrive: day });
          if (u01(this.seed, S.birth, i, 2) < L.infant_death_first_year.v) { const dd = Math.min(REGNAL_DAYS - 1, day + 1 + Math.floor(u01(this.seed, S.birth, i, 3) * 120)); this.persons[c].dies = dd; this.lifeByDay[dd].deaths.push(c); this.households[p.hh].deaths.push(dd); }
          if (p.group >= 0) this.join(p.group, c);
          this.lifeByDay[day].births.push(c); this.households[p.hh].births.push(day); } } }
      if (p.age >= 15 && p.age <= 30 && p.sex === 'f' && (p.zone === 'town' || p.zone === 'plain')) { const um = u01(this.seed, S.marry, i); const pm = L.marriage_p_year_15_30.v * 2 * REGNAL_DAYS / 365;
        if (um < pm) { const H = this.households[p.hh]; const to = H.kin.find(k => this.persons[this.households[k].members[0]]?.sex === 'm') ?? -1;
          const day = Math.floor(um / pm * REGNAL_DAYS); if (to >= 0 && day < p.dies) { p.hh2 = to; p.marry = day; this.lifeByDay[day].marriages.push(i); } } }
      if (p.persian && p.age >= 16 && p.bday >= 0 && (p.zone === 'town' || p.zone === 'plain' || p.job === 'guard')) this.bdayByDay[p.bday].push(i);
    }
  }
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
  gaveBirth(pid: number, d: number) { const p = this.persons[pid]; if (p.sex !== 'f') return -1; const H = this.households[p.hh]; for (const x of H.births) if (x <= d && d - x < 45) { for (const c of this.lifeByDay[x].births) if (this.persons[c].mother === pid) return d - x; } return -1; }
  postpartumDays(pid: number) { const [a, b] = L.postpartum_off_days.v; return a + Math.floor(u01(this.seed, S.birth, pid, 11) * (b - a + 1)); }
  /** the woman who stays home with a sick household member on the first day (C) */
  carerToday(pid: number, d: number) {
    const p = this.persons[pid]; if (p.sex !== 'f' || p.age < 14) return false; const H = this.households[this.home(pid, d)];
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
    const cr = { stone: 0, labour: 0, brick: 0 }; const w = this.workWindow(C); let hours = w[1] - w[0] - 0.7;
    if (C.heatRest) hours -= 3; if (C.wx.rain) hours -= Math.max(0, Math.min(C.wx.rain[1], w[1]) - Math.max(C.wx.rain[0], w[0]));
    hours = Math.max(0, hours);
    for (const pid of this.builders) { if (!this.builderAvailable(pid, d, C)) continue; const p = this.persons[pid]; const f = hours / 9 * (this.cal.shortOf(p.group, d) > 0 ? 0.8 : 1); // CE-03: short rations slow the work
      if (p.sub === 'stone') cr.stone += f; else if (p.sub === 'brick') cr.brick += C.brick ? f * 0.5 : f; else cr.labour += f; }
    return cr;
  }
  workWindow(C: DayCtx): [number, number] { return [C.sun.rise + L.work_day.start_after_sunrise_h, C.sun.set - L.work_day.end_before_sunset_h]; }
  /** relationships: a base by tie type plus dated changes that fade over ~a month (lives.json affinity) */
  private relKey(a: number, b: number) { return a < b ? a * 262144 + b : b * 262144 + a; }
  relate(a: number, b: number, d: number, dv: number) { const k = this.relKey(a, b); (this.rel.get(k) ?? this.rel.set(k, []).get(k)!).push([d, dv]); }
  affinity(a: number, b: number, d: number) {
    const A = this.persons[a], B = this.persons[b], base = L.affinity.base;
    let v = A.hh === B.hh ? base.household : this.households[A.hh].kin.includes(B.hh) ? base.kin : A.group >= 0 && A.group === B.group ? base.work : this.households[A.hh].q === this.households[B.hh].q ? base.neighbour : 0;
    const ev = this.rel.get(this.relKey(a, b)); if (ev) for (const [x, dv] of ev) if (x < d) v += dv * Math.exp(-(d - x) / L.affinity.tau_days);
    return Math.max(-1, Math.min(1, v));
  }
  relationsSnapshot() { return [...this.rel.entries()]; }
  relationsRestore(s: [number, [number, number][]][]) { this.rel.clear(); for (const [k, v] of s) this.rel.set(k, v.slice()); }
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
  plan(pid: number, day: number): Seg[] { return new Planner(this, pid, day).build(); }
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
  private add(t1: number, place: string, act: ActivityId, why: string, where: Where) {
    t1 = Math.min(24, t1); const last = this.segs[this.segs.length - 1];
    if (t1 > 24 - 1e-3) t1 = 24;
    if (t1 <= this.t + 1e-4) { if (t1 === 24 && last && this.t < 24) { last.t1 = 24; this.t = 24; } return; }
    if (last && last.place === place && last.act === act && last.where === where) { last.t1 = t1; } else this.segs.push({ t0: this.t, t1, place, act, why, where });
    this.t = t1; if (where !== 'road') { this.cur = place; this.curW = where; }
  }
  /** where the person is now (a road segment ends at its destination) */
  private cur: string | null = null; private curW: Where | null = null;
  private atHome(t1: number, act: ActivityId, why: string) { this.add(t1, this.home, act, why, this.homeW); }
  /** hours at home between tasks (C). Men: rest, mending tools and baskets, the household's animals (plain), talk with
   *  the household. Women: rest, the quern, spinning, talk. Both: a sleep in the heat of the day */
  private homeHours(until: number, why = 'resting at home') {
    const r = this.r, plain = this.hh.zone === 'plain', f = this.p.sex === 'f', H = L.home_hours, [s0, s1] = H.spell_h;
    while (this.t < until - 0.3) {
      const hot = this.C.heatRest && this.t >= 11.5 && this.t < 15.5 ? H.sleep_in_heat : 0;
      const k = this.choose(f ? { rest: H.women.rest, grind: H.women.grind, weave: H.women.weave, craft: 0, animals: 0, talk: H.women.talk, sleep: hot } : { rest: H.men.rest, grind: 0, weave: 0, craft: H.men.craft, animals: plain ? H.men.animals_plain : 0, talk: H.men.talk, sleep: hot });
      const t1 = Math.min(until, this.t + r.range(s0, s1));
      if (k === 'craft') this.atHome(t1, 'craft', 'mending tools and baskets'); else if (k === 'animals') this.atHome(t1, 'tend_animals', 'seeing to the household’s animals');
      else if (k === 'grind') this.atHome(t1, 'grind', 'grinding the household’s flour'); else if (k === 'weave') this.atHome(t1, 'weave', 'spinning');
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
    const P = this.P, p = this.p, d = this.d;
    if (!P.present(this.pid, d)) return [{ t0: 0, t1: 24, place: '-', act: 'offmap', why: 'not here', where: 'away' }];
    if (p.job === 'traveller') return this.traveller();
    if (p.job === 'herder') return this.herderPassing();
    const sick = P.sick(this.pid, d);
    if (sick) return this.sickDay();
    const born = P.gaveBirth(this.pid, d);
    if (born === 0) return this.birthDay();
    if (born > 0 && born <= P.postpartumDays(this.pid)) return this.postpartum();
    if (p.job === 'child' && p.age < 5) return this.small();
    if (p.job === 'guard') return this.guard();
    if (P.mourning(this.pid, d)) return this.mourningDay();
    if (P.carerToday(this.pid, d)) return this.homeDay('tending the sick at home', true);
    if (d === p.marry) return this.marriageDay();
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
  /** early morning at home: breakfast; women grind the household's flour and bake every other day; water */
  private morning(until: number) {
    const p = this.p, r = this.r, hb = L.household_bread;
    this.atHome(this.rise(), 'sleep', 'asleep');
    if (p.sex === 'f' && this.adult() && until - this.t > 1.2) {
      this.atHome(this.t + lerp(hb.grind_h[0], hb.grind_h[1], r.next()) * Math.min(1, (until - this.t) / 3), 'grind', 'grinding the household’s flour at the quern');
      if ((this.d + this.hh.id) % hb.bake_every_days === 0 && until - this.t > 1.2) { this.atHome(this.t + 0.4, 'knead', 'kneading dough'); this.atHome(this.t + 0.6, 'bake', 'baking flat bread'); }
      if (until - this.t > 0.8 && this.hh.zone !== 'terrace') this.well(this.t + 0.4, 'fetching water');
    }
    if (until - this.t > 0.3) this.atHome(this.t + 0.3, 'eat', 'breakfast');
    if (until > this.t) this.atHome(until, p.age < 14 ? 'play' : 'rest', 'at home');
  }
  private well(t1: number, why: string) { const q = this.hh.q; const w = `well:${q}`; this.go(w, this.homeW); this.dispute(w); this.add(Math.max(this.t + 0.2, t1), w, 'draw_water', why, this.homeW); this.add(this.t + this.P.walkH(w, this.home, this.d, this.homeW, this.homeW), `road:${this.homeW}`, 'carry_jar_head', 'carrying water home', 'road'); }
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
  /** evening at home and out: meal, then the household's real options (lives.json evening) */
  private evening(from: number) {
    const p = this.p, r = this.r, C = this.C, E = L.evening; const bed = Math.max(from + 0.5, this.bed());
    const man = p.sex === 'm' && this.adult() && this.homeW !== 'terrace';
    if (this.t < from) { if (man) this.homeHours(from, 'at home'); else this.atHome(from, 'rest', 'home'); }
    // home before the evening (the work camp stops at mid-afternoon, the scribes at 15:30): the household's afternoon
    const supper = Math.max(this.t, this.sun.set - 0.7);
    if (supper - this.t > 1 && this.homeW !== 'terrace') {
      if (p.age < 14) { this.go(`lane:${this.hh.q}`, this.homeW); this.add(supper - 0.1, `lane:${this.hh.q}`, C.wx.wet ? 'rest' : 'play', 'playing in the lane', this.homeW); this.go(this.home, this.homeW); }
      else if (p.sex === 'f') { this.atHome(this.t + Math.min(supper - this.t, r.range(0.5, 1.2)), 'grind', 'grinding for tomorrow’s bread'); if (supper - this.t > 0.8 && r.chance(0.5)) this.well(this.t + 0.3, 'fetching water'); if (this.t < supper) this.atHome(supper, 'rest', 'minding the children'); }
      else if (r.chance(0.4) && !C.wx.wet) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(Math.max(this.t, supper - 0.2), l, r.chance(0.5) ? 'talk' : 'gamble', r.chance(0.5) ? 'talking in the lane' : 'knucklebones in the lane', this.homeW); this.go(this.home, this.homeW); }
      else if (man) this.homeHours(supper, 'resting at home after work'); else this.atHome(supper, 'rest', 'resting at home after work');
    }
    const birthday = p.persian && this.adult() && p.bday === this.d;
    this.atHome(this.t + (birthday ? 1.8 : 0.5), 'eat', birthday ? 'a birthday meal: the day every man values most (HDT 1.133)' : 'evening meal');
    if (this.t >= bed - 0.3) return;
    const rain = this.rainIn(this.t, bed) > 0.3;
    const kinEvent = this.kinVisit();
    if (kinEvent) { this.go(kinEvent.place, kinEvent.where, 'visiting'); this.add(Math.min(bed - 0.3, this.t + kinEvent.h), kinEvent.place, kinEvent.act, kinEvent.why, kinEvent.where); this.go(this.home, this.homeW, 'going home'); }
    else if (!rain) {
      const u = r.next();
      if (p.age < 14) { if (u < E.play_children) this.add(Math.min(bed - 0.2, this.t + r.range(0.6, 1.6)), `lane:${this.hh.q}`, 'play', 'playing in the lane', this.homeW); }
      else if (p.sex === 'f' && u < E.well_women * 0.5 && this.homeW !== 'terrace') this.well(this.t + 0.3, 'evening water');
      else if (u < E.visit) { const v = this.visitTarget(); if (v) { this.go(v.place, v.where, 'visiting'); this.add(Math.min(bed - 0.3, this.t + r.range(0.8, 2)), v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, this.homeW, 'going home'); } }
      else if (u < E.visit + E.exchange && !C.short.get(p.group)) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(Math.min(bed - 0.3, this.t + r.range(0.4, 1)), l, 'exchange', 'exchanging goods in kind with neighbours', this.homeW); this.go(this.home, this.homeW); }
      else if (p.sex === 'm' && u < E.visit + E.exchange + E.gamble_men) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(Math.min(bed - 0.3, this.t + r.range(0.6, 1.5)), l, 'gamble', 'knucklebones with neighbours', this.homeW); this.go(this.home, this.homeW); }
    }
    if (this.t < bed) this.atHome(bed, p.age >= 60 ? 'rest' : r.chance(0.5) ? 'talk' : 'rest', 'with the household');
  }
  /** kin events worth a visit: a birth in a kin household (last 3 days), a death (mourning visit), a kin birthday meal */
  private kinVisit(): { place: string; where: Where; act: ActivityId; why: string; h: number } | null {
    const P = this.P, d = this.d, r = this.r; if (this.p.age < 14) return null;
    for (const k of this.hh.kin) { const H = P.households[k]; const wh: Where = H.zone === 'plain' ? 'plain' : 'town';
      if (P.walkH(this.home, H.home, d, this.homeW, wh) > 1) continue;
      if (H.deaths.some(x => x === d - 1 || x === d)) { if (r.chance(0.8)) { return { place: H.home, where: wh, act: 'talk', why: 'a mourning visit to kin', h: 1.2 }; } }
      if (H.births.some(x => x < d && d - x <= 3)) { if (r.chance(0.5)) return { place: H.home, where: wh, act: 'talk', why: 'visiting kin with a newborn', h: 1 }; }
      const b = H.members.find(x => P.persons[x].persian && P.persons[x].bday === d && P.persons[x].age >= 16 && P.present(x, d));
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
  /** a work block at one place with a meal, the midday heat rest and rain shelter */
  private workBlock(place: string, where: Where, act: ActivityId, why: string, t0: number, t1: number, outdoor = true, lunchPlace = place) {
    const C = this.C; this.dispute(place, where); if (this.t < t0) this.add(t0, place, act, why, where);
    const slots: [number, number, ActivityId, string, string][] = [];
    if (C.heatRest && outdoor && t1 > 12.5) slots.push([12, 15, 'rest', 'midday rest in the shade (E-64)', lunchPlace]);
    else if (t1 > 12.8 && t0 < 12) slots.push([12, 12.7, 'eat', 'midday meal', lunchPlace]);
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
    this.evening(this.t); return this.finish();
  }
  /** a day at home: household tasks, errands, visits (days off, winter halves, rained-off days) */
  private homeDay(why: string, stayIn = false): Seg[] {
    const p = this.p, r = this.r, C = this.C; this.morning(this.rise() + 1.2);
    this.rationRun(); this.go(this.home, this.homeW);
    const noon = 12.5; const rain = this.rainIn(this.t, 17) > 1 || C.wx.storm;
    if (!stayIn && !rain && this.adult()) {
      const u = r.next();
      if (u < 0.3) { const v = this.visitTarget(); if (v) { this.go(v.place, v.where, 'visiting'); this.add(this.t + r.range(1, 2.5), v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, this.homeW); } }
      else if (u < 0.5) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(this.t + r.range(0.5, 1.5), l, 'exchange', 'exchanging ration goods in kind', this.homeW); this.go(this.home, this.homeW); }
      else if (u < 0.65 && p.sex === 'f') this.well(this.t + 0.4, 'fetching water');
      else if (u < 0.8 && p.sex === 'm') { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(this.t + r.range(0.8, 2), l, 'gamble', 'knucklebones in the lane', this.homeW); this.go(this.home, this.homeW); }
    }
    if (this.t < noon) this.atHome(noon, p.sex === 'f' && this.adult() ? (r.chance(0.5) ? 'grind' : 'rest') : 'rest', stayIn ? why : `at home: ${why}`);
    this.atHome(this.t + 0.6, 'eat', 'midday meal'); if (p.sex === 'm' && this.adult() && !stayIn) this.homeHours(15 + r.range(0, 1)); else this.atHome(Math.max(this.t, 15 + r.range(0, 1)), 'rest', 'resting at home');
    if (!stayIn && !rain && this.adult() && r.chance(0.35)) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(this.t + r.range(0.5, 1.5), l, 'talk', 'talking with neighbours in the lane', this.homeW); this.go(this.home, this.homeW); }
    this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
  }
  /** a day of illness (E-72): lying ill, a little food brought; the last day of an episode is spent sitting up (C) */
  private sickDay(): Seg[] {
    const home = this.p.job === 'guard' ? 'garrison_sleep' : this.home, w: Where = this.p.job === 'guard' ? 'terrace' : this.homeW; const { k, n } = this.P.sickDayOf(this.pid, this.d);
    const last = k === n - 1 && n > 1;
    this.add(7.5 + (k === 0 ? 0 : 0.5), home, k === 0 ? 'lie_ill' : 'sleep', k === 0 ? 'fallen ill in the night' : 'asleep', w); this.add(this.t + 0.4, home, 'eat', 'a little food brought to the sick', w);
    if (last) { this.add(12.5, home, 'rest', 'sitting up, recovering', w); this.add(this.t + 0.5, home, 'eat', 'a meal: recovering', w); this.add(this.sun.set - 0.5, home, this.homeW === 'terrace' ? 'rest' : 'talk', 'sitting up with the household', w); this.add(this.t + 0.5, home, 'eat', 'evening meal', w); return this.finish(); }
    this.add(13, home, 'lie_ill', 'lying ill', w); this.add(this.t + 0.4, home, 'eat', 'a little food', w);
    if (this.p.job !== 'guard' && this.r.chance(0.35)) { this.add(this.t + 1.5, home, 'lie_ill', 'lying ill', w); this.add(this.t + 0.6, home, 'talk', 'visited by kin while ill', w); }
    this.add(19, home, 'lie_ill', 'lying ill', w); this.add(this.t + 0.4, home, 'eat', 'a little food', w); this.add(24, home, 'lie_ill', 'lying ill', w);
    return this.segs;
  }
  private birthDay(): Seg[] { this.atHome(this.rise(), 'sleep', 'asleep'); this.atHome(this.t + 6 + 6 * this.r.next(), 'lie_ill', 'in labour, with the women of the household and group'); this.atHome(this.t + 0.5, 'eat', 'food after the birth'); this.atHome(24, 'lie_ill', 'resting with the newborn'); return this.segs; }
  /** after a birth (E-70, off work 10–40 days, C): a few days' confinement, then light work at home with the baby */
  private postpartum(): Seg[] {
    const r = this.r, x = this.P.gaveBirth(this.pid, this.d), conf = L.postpartum_off_days.confinement_days[0] + Math.floor(u01(this.P.seed, S.birth, this.pid, 13) * (L.postpartum_off_days.confinement_days[1] - L.postpartum_off_days.confinement_days[0] + 1));
    if (x <= conf) { this.atHome(this.rise() + 0.8, 'sleep', 'asleep with the newborn'); this.atHome(this.t + 0.4, 'eat', 'breakfast brought to her'); this.atHome(this.t + r.range(1.5, 3), 'rest', 'nursing the newborn');
      if (r.chance(0.6)) this.atHome(this.t + r.range(0.5, 1.5), 'talk', 'women of the household and group come to see the child'); this.atHome(12.5, 'sleep', 'sleeping when the baby sleeps'); this.atHome(this.t + 0.5, 'eat', 'midday meal');
      this.atHome(this.sun.set - 0.5, 'rest', 'nursing the newborn'); this.atHome(this.t + 0.5, 'eat', 'evening meal'); return this.finish(); }
    this.atHome(this.rise() + 0.4, 'sleep', 'asleep'); this.atHome(this.t + 0.3, 'eat', 'breakfast'); const l = `lane:${this.hh.q}`;
    const k = this.choose(L.postpartum_off_days.light_work as Record<'grind' | 'weave' | 'lane' | 'visit' | 'well', number>);
    if (k === 'grind' || k === 'weave') this.atHome(this.t + r.range(1, 2), k, k === 'grind' ? 'grinding, the baby beside her' : 'spinning, the baby beside her');
    else if (k === 'lane' && !this.C.wx.wet) { this.go(l, this.homeW); this.add(this.t + r.range(1, 2), l, 'talk', 'sitting in the lane with the baby', this.homeW); this.go(this.home, this.homeW); }
    else if (k === 'visit') { const v = this.visitTarget(); if (v) { this.go(v.place, v.where); this.add(this.t + r.range(1, 2), v.place, 'talk', `showing the baby to ${v.name}`, v.where); this.go(this.home, this.homeW); } }
    else this.well(this.t + 0.3, 'fetching water with the baby');
    this.atHome(Math.max(this.t, 12.3), 'rest', 'nursing the baby'); this.atHome(this.t + 0.6, 'eat', 'midday meal'); this.atHome(this.t + r.range(1, 2), 'sleep', 'sleeping when the baby sleeps');
    if (r.chance(0.5)) this.atHome(this.t + 1, r.chance(0.5) ? 'grind' : 'weave', 'light work at home (off work after the birth)');
    this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
  }
  private mourningDay(): Seg[] {
    const x = this.P.mourning(this.pid, this.d); this.atHome(this.rise() + 0.3, 'sleep', 'asleep');
    if (x === 1 && this.p.sex === 'm' && this.adult() && this.r.chance(0.7)) { const out = this.hh.zone === 'plain' ? `outside:${this.hh.q}` : 'outside'; // out of their own settlement
      this.go(out, this.homeW, 'carrying the dead out of the settlement'); this.add(this.t + 1.5, out, 'carry_bier', 'the dead are carried out of the settlement (E-71)', this.homeW); this.go(this.home, this.homeW, 'returning home'); }
    this.atHome(Math.max(this.t, 12), 'talk', 'mourning with the household and visitors'); this.atHome(this.t + 0.6, 'eat', 'a meal'); this.atHome(this.sun.set, 'rest', 'mourning at home'); this.atHome(this.t + 0.5, 'eat', 'evening meal'); return this.finish();
  }
  private marriageDay(): Seg[] {
    const oldHome = this.P.households[this.p.hh]; this.add(this.rise(), oldHome.home, 'sleep', 'asleep (last night in the old household)', this.homeW);
    this.add(this.t + 0.5, oldHome.home, 'eat', 'breakfast', this.homeW); this.add(11, oldHome.home, 'talk', 'leaving her household (no rite is attested: E-73)', this.homeW);
    this.go(this.home, this.homeW, 'moving to her husband’s household', 'carry_sack'); this.atHome(this.sun.set, 'talk', 'with her new household'); this.evening(this.t); return this.finish();
  }
  private small(): Seg[] { // children under five follow their mother; infants rest where she is (C)
    // the mother, or (if she has died or is away) another woman of the household, or any adult of it
    const P = this.P, H = P.households[P.home(this.pid, this.d)].members; const ok = (x: number) => x !== this.pid && P.present(x, this.d) && P.persons[x].age >= 12 && P.persons[x].job !== 'guard';
    let m = this.p.mother >= 0 && ok(this.p.mother) ? this.p.mother : H.find(x => ok(x) && P.persons[x].sex === 'f');
    if (m === undefined) m = H.find(ok);
    if (m === undefined) { this.atHome(this.rise() + 1, 'sleep', 'asleep'); this.atHome(this.t + 0.5, 'eat', 'fed by the neighbours'); this.atHome(12, 'play', 'at home'); this.atHome(this.t + 0.5, 'eat', 'midday meal'); this.atHome(16, 'sleep', 'asleep'); this.atHome(19, 'play', 'at home'); this.atHome(this.t + 0.5, 'eat', 'evening meal'); return this.finish(); }
    // infants are carried by (or lie beside) the mother: nursed when she eats, asleep while she rests, awake on her back
    // while she works; toddlers play near her, nap at midday, and go along with an older brother or sister (C)
    const ms = P.plan(m, this.d); const inf = this.p.age < 2; const home = this.home;
    const sib = inf ? undefined : H.find(x => x !== this.pid && P.present(x, this.d) && P.persons[x].job === 'child' && P.persons[x].age >= 6 && P.persons[x].age <= 13);
    const ss = sib !== undefined ? P.plan(sib, this.d) : null;
    // while the mother works away for hours, a toddler goes along or is left with a grandparent at home or with a kinswoman (C)
    const longAway = ms.some(s => s.place !== home && s.where !== 'road' && s.t1 - s.t0 >= 2.5 && !['sleep', 'eat', 'talk', 'queue'].includes(s.act));
    const elder = H.find(x => ok(x) && P.persons[x].job === 'elder' && !P.sick(x, this.d) && !P.mourning(x, this.d));
    // on some days a toddler goes along with the grandparent to sit in the lane or to visit, while the mother works at home (C)
    const eAll = !inf && elder !== undefined ? P.plan(elder, this.d) : null; const es = eAll && this.r.chance(L.children_under_five.along_with_grandparent) ? eAll : null;
    const kinHome = this.hh.kin.length ? P.households[this.hh.kin[Math.floor(u01(P.seed, S.assign, this.pid, this.d) * this.hh.kin.length)]] : null;
    // left with the grandparent, the toddler goes where the grandparent goes (the lane, a visit, out to the crop)
    const minder: [string, Where, string] | null = inf || !longAway ? null : !this.r.chance(L.children_under_five.left_with_minder) ? null : elder !== undefined ? [home, this.homeW, 'left with the grandparent while the mother works'] : kinHome && kinHome.zone !== 'terrace' && kinHome.zone !== 'transient' ? [kinHome.home, kinHome.zone === 'plain' ? 'plain' : 'town', 'left with a kinswoman while the mother works'] : null;
    const withElder = !!minder && elder !== undefined;
    // left with a kinswoman, the toddler is where she is: at her house, at the well, or with her at the harvest (C)
    const kw = minder && !withElder && kinHome ? kinHome.members.find(x => ok(x) && P.persons[x].sex === 'f' && P.persons[x].job !== 'child') : undefined;
    const kAll = kw !== undefined ? P.plan(kw, this.d) : null; const mAll = withElder ? eAll : kAll;
    // on some days the small ones are taken outside the door to play with the neighbours' children, or to a neighbour's or
    // a kinswoman's house in the same lane while the mother works at home; not in rain or dust (W-03) (C)
    const Mo = P.persons[m]; const outW = inf || this.C.wx.wet || this.C.wx.dust ? null : (() => {
      const k = this.choose(L.children_under_five.outing as Record<'none' | 'lane' | 'neighbour' | 'kin', number>); if (k === 'none') return null;
      const h0 = this.r.chance(0.5) ? this.r.range(7, 10) : this.r.range(15, Math.max(15.1, this.sun.set - 2)), h1 = h0 + this.r.range(L.children_under_five.outing_h[0], L.children_under_five.outing_h[1]);
      let place = `lane:${this.hh.q}`, why = 'playing outside the door with the neighbours’ children';
      if (k !== 'lane') { const cand = (k === 'kin' ? this.hh.kin : Mo.ties.map(o => P.home(o, this.d))).map(h => P.households[h]).filter(H => H.id !== this.hh.id && H.q === this.hh.q && H.zone === this.hh.zone);
        if (cand.length) { place = cand[Math.floor(this.r.next() * cand.length)].home; why = k === 'kin' ? 'at a kinswoman’s house in the lane, playing with her children' : 'playing at a neighbour’s house with their children'; } }
      return { h0, h1, place, why }; })();
    const cuts = [...new Set([...ms.map(s => s.t1), ...(ss ? ss.map(s => s.t1) : []), ...(es ? es.map(s => s.t1) : []), ...(mAll ? mAll.map(s => s.t1) : []), ...(outW ? [outW.h0, outW.h1] : [])])].sort((a, b) => a - b);
    let t0 = 0;
    for (const t1 of cuts) {
      if (t1 <= t0) continue; const mid = (t0 + t1) / 2; const M = segAt(ms, mid); t0 = t1;
      const moving = M.where === 'road' || M.act === 'walk'; // on the road (carrying or not); a carry at a place is work there
      if (inf) { const a: ActivityId = M.act === 'sleep' || M.act === 'lie_ill' || M.act === 'rest' ? 'sleep' : M.act === 'eat' ? 'eat' : moving ? 'walk' : 'rest';
        this.add(t1, M.place, a, a === 'eat' ? 'nursed by the mother' : a === 'sleep' ? 'asleep beside the mother' : a === 'walk' ? 'carried by the mother' : 'on the mother’s back while she works', M.where); continue; }
      const S = ss ? segAt(ss, mid) : null;
      if (M.act === 'sleep') { this.add(t1, M.place, 'sleep', 'asleep', M.where); continue; }
      if (minder && M.place !== home && mid > 4.5 && mid < 20) { const G = mAll ? segAt(mAll, mid) : null;
        if (G && G.place !== minder[0]) { this.add(t1, G.place, G.where === 'road' ? 'walk' : G.act === 'eat' ? 'eat' : 'play', withElder ? 'with the grandparent while the mother works' : 'with a kinswoman while the mother works', G.where); continue; }
        this.add(t1, minder[0], (G && G.act === 'sleep') || (!G && mid >= 12.5 && mid < 14.5) ? 'sleep' : 'play', minder[2], minder[1]); continue; }
      if (M.place !== home && M.act !== 'lie_ill') { this.add(t1, M.place, M.act === 'eat' ? 'eat' : moving ? 'walk' : 'play', 'with the mother', M.where); continue; }
      if (S && S.act === 'play' && S.place !== home && S.place.startsWith('lane:') || (S && S.act === 'play' && (S.place.startsWith('garden:') || S.place.startsWith('canal:')))) { this.add(t1, S!.place, 'play', 'taken along by an older brother or sister', S!.where); continue; }
      const E = es ? segAt(es, mid) : null;
      if (E && E.place !== home && mid > 6 && mid < this.sun.set && (E.where === 'road' || E.act === 'talk' || E.act === 'exchange')) { this.add(t1, E.place, E.where === 'road' ? 'walk' : 'play', E.where === 'road' ? 'walking with the grandparent' : 'along with the grandparent', E.where); continue; }
      if (outW && mid >= outW.h0 && mid < outW.h1 && mid < this.sun.set - 0.3 && M.act !== 'eat') { this.add(t1, outW.place, 'play', outW.why, this.homeW); continue; }
      const a: ActivityId = M.act === 'eat' ? 'eat' : mid >= 12.5 && mid < 14.5 ? 'sleep' : 'play';
      this.add(t1, home, a, a === 'sleep' ? 'a midday sleep' : a === 'eat' ? 'a meal with the household' : 'playing at home near the mother', this.homeW);
    }
    return this.finish();
  }
  // ---------------------------------------------------------------- jobs
  private guard(): Seg[] {
    const P = this.P, d = this.d, p = this.p, r = this.r, C = this.C; const ph = P.phase(this.pid, d); const me = P.rota(d).get(this.pid);
    const prev = P.rota(d - 1).get(this.pid); const tailC = !!prev && prev.watch === 2; const fam = this.hh.zone === 'town' ? this.hh : null;
    const hearth = HEARTHS[p.file % 3]; const G = P.groups[p.group];
    const watch = (x: { post: string | null }, t1: number) => { if (x.post) this.add(t1, x.post, 'stand_guard', 'on watch', 'terrace'); else this.add(t1, 'terrace_round', 'patrol', p.rank ? 'the leader of ten going the rounds of the posts' : 'on patrol between the posts', 'terrace'); };
    const meal = (why: string) => this.add(this.t + 0.6, hearth, 'eat', why, 'terrace');
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
        if (back - this.t > 0.7) this.add(this.t + 0.6, fam.home, 'eat', 'a meal with his family', 'town');
        this.add(back, fam.home, r.chance(0.5) ? 'rest' : 'talk', 'with his family', 'town'); this.add(t1, 'road:terrace', 'walk', 'back up to the garrison', 'road'); return;
      }
      for (const j of mine) { leisure(j[0]); this.add(j[1], j[2], j[3], j[4], 'terrace'); }
      leisure(t1);
    };
    if (tailC) { watch(prev!, 6); meal('breakfast after the night watch'); this.add(13, 'garrison_sleep', 'sleep', 'sleeping after the night watch', 'terrace'); }
    if (me && me.watch === 0) { // watch A, 06–14
      if (!tailC) this.add(5, 'garrison_sleep', 'sleep', 'asleep in the garrison quarters', 'terrace');
      meal('breakfast before the watch'); this.add(6, hearth, 'talk', 'readying for the watch', 'terrace'); watch(me, 14); meal('a meal after the watch');
      free(19.8, 0.25); meal('evening meal'); leisure(Math.min(22, this.sun.set + 1.5)); return this.finish();
    }
    if (me && me.watch === 1) { // watch B, 14–22
      if (!tailC) this.add(Math.max(this.t, this.sun.rise + 0.5), 'garrison_sleep', 'sleep', 'asleep in the garrison quarters', 'terrace');
      meal('breakfast'); free(12.6, 0.3); meal('a meal before the watch'); this.add(14, hearth, 'talk', 'readying for the watch', 'terrace'); watch(me, 22); meal('a meal after the watch'); return this.finish();
    }
    if (me && me.watch === 2) { // watch C, 22–06 (tomorrow's plan holds the rest of it)
      if (!tailC) this.add(Math.max(this.t, this.sun.rise + 0.3), 'garrison_sleep', 'sleep', 'asleep in the garrison quarters', 'terrace');
      meal(tailC ? 'a meal' : 'breakfast'); free(18.5, 0.35); meal('a meal before the night watch'); this.add(21.6, 'garrison_sleep', 'sleep', 'a short sleep before the night watch', 'terrace');
      this.add(22, hearth, 'talk', 'readying for the night watch', 'terrace'); watch(me, 24); return this.segs;
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
      const [a1, y1] = pick(); if (this.t < 12) this.workBlock(place, where, a1, y1, Math.max(w0, this.t), 12.7, true, lunch); [act, why] = pick(); }
    if (pm && this.t < 12) { this.workBlock(place, where, act, why, Math.max(w0, this.t), 12.7, true, lunch); [place, act, why] = pm; }
    this.workBlock(place, where, act, why, Math.max(w0, this.t), w1, true, lunch);
    this.go(this.home, this.homeW, issue !== undefined ? 'carrying the ration home' : 'going home', issue !== undefined ? 'carry_sack' : 'walk');
    this.evening(this.t); return this.finish();
  }
  private campWoman(): Seg[] {
    const P = this.P, p = this.p, C = this.C, d = this.d;
    const infant = P.households[this.hh.id].members.some(x => P.persons[x].mother === this.pid && P.present(x, d) && d - P.persons[x].born < 354 && P.persons[x].born > -1e8);
    if (C.wx.storm || infant || (C.winter && (p.id + d) % 2 === 1)) return this.homeDay(infant ? 'at home with her infant' : C.wx.storm ? 'storm: no bread today' : 'bread for half the gang in winter: her day at home');
    const baker = p.sub === 'baker'; const t0 = baker ? this.sun.rise - 0.6 : this.sun.rise + 0.4, t1 = 14.5;
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
    this.go(this.home, this.homeW, issue !== undefined ? 'carrying the ration home' : 'going home', issue !== undefined ? 'carry_sack' : 'walk');
    this.evening(this.t); return this.finish();
  }
  private child(): Seg[] {
    const P = this.P, p = this.p, d = this.d, r = this.r, C = this.C; const m = p.mother >= 0 ? p.mother : P.households[this.hh.id].members.find(x => P.persons[x].sex === 'f' && P.persons[x].age >= 16 && P.persons[x].job !== 'child') ?? -1;
    const follow = (ms: Seg[], atWork: (s: Seg) => [string, ActivityId]) => { for (const s of ms) { const [pl, act] = s.where === 'terrace' || s.where === 'plain' ? atWork(s) : [s.place, s.act === 'sleep' || s.act === 'lie_ill' ? 'sleep' : s.act === 'walk' || s.act === 'carry_sack' || s.act === 'carry_jar_head' ? 'walk' : s.act === 'eat' ? 'eat' : s.act === 'draw_water' ? 'draw_water' : s.act === 'queue' ? 'queue' : s.act === 'talk' || s.act === 'exchange' || s.act === 'gamble' ? 'rest' : 'play'] as [string, ActivityId];
      this.add(s.t1, pl, act, s.where === 'terrace' ? 'near mother at the work camp' : `with mother: ${s.why}`, s.where); } return this.segs; };
    if (m >= 0 && P.persons[m].job === 'camp' && P.present(m, d) && p.agent >= 0) { // the slice's camp children go up with their mothers (Phase 3)
      const ms = P.plan(m, d); if (ms.some(s => s.where === 'terrace')) return follow(ms, s => [s.place === 'stair_foot' ? 'stair_foot' : 'querns', s.act === 'eat' ? 'eat' : s.act === 'walk' || s.act === 'carry_jar_head' || s.act === 'carry_sack' || s.act === 'carry_bread' ? 'walk' : r.chance(0.6) ? 'play' : 'rest']);
    }
    // younger children go with their mother when she goes out: the ration queue, kin, the harvest (lives.json children)
    if (m >= 0 && P.present(m, d) && p.age <= 10 && p.agent < 0) { const ms = P.plan(m, d);
      const outing = ms.some(s => s.act === 'queue' || s.act === 'reap' || s.act === 'thresh' || s.act === 'pick_fruit' || (s.act === 'talk' && s.place.startsWith('h:') && s.place !== this.home));
      if (outing && r.chance(L.children.with_mother_on_her_outings)) return follow(ms, s => [s.place, s.act === 'reap' || s.act === 'thresh' || s.act === 'pick_fruit' ? 'field_work' : s.act === 'eat' ? 'eat' : s.act === 'walk' ? 'walk' : 'play']); }
    const q = this.hh.q, l = `lane:${q}`, W = this.homeW;
    this.morning(this.rise() + 0.8 + r.next() * 0.6);
    // a morning job: fetching water, grinding with the women, taking the household's animals out (plain boys)
    if (this.hh.zone === 'plain' && p.age >= 8 && p.sex === 'm' && !C.wx.wet && r.chance(0.6)) { this.go(`pasture:${q}`, 'plain', 'taking the animals out'); this.add(this.t + r.range(2, 4.5), `pasture:${q}`, 'herd', 'minding the household’s animals', 'plain'); this.go(this.home, W); }
    else if (p.age >= 7 && r.chance(0.5)) { if (p.sex === 'f' && r.chance(0.5)) this.atHome(this.t + r.range(0.5, 1.2), 'grind', 'grinding with the women'); else this.well(this.t + 0.3, 'fetching water with the women'); }
    // the day's play or errand (lives.json children.choices); Persian boys learn to ride and shoot (HDT 1.136, B claim)
    const PB = L.children.persian_boys_training;
    if (p.sex === 'm' && this.hh.persian && p.age >= PB.ages[0] && p.age <= PB.ages[1] && !C.wx.wet && r.chance(PB.p)) { const g = `training:${q}`; this.go(g, W, 'to the practice ground'); this.add(this.t + r.range(1.5, 3), g, 'train', 'learning to ride and to shoot with the bow (HDT 1.136)', W); this.go(this.home, W); }
    // the morning's play or errand and the afternoon's, each drawn on its own (lives.json children.choices); rain and
    // dust (W-03) keep children in, where the girls grind or spin with the women and the boys help with the animals (C)
    const spell = (until: number) => {
      if (this.t >= until - 0.3) return; const inside = C.wx.wet || C.wx.dust;
      const k = inside ? 'home' : this.choose(L.children.choices as Record<'lane' | 'friend' | 'water_edge' | 'errand' | 'home', number>);
      if (k === 'lane') { this.go(l, W); this.add(until, l, 'play', 'playing in the lane', W); this.go(this.home, W); }
      else if (k === 'friend') { const f = this.visitTarget(); if (f) { this.go(f.place, f.where, 'to a friend’s house'); this.add(until, f.place, 'play', `playing at ${f.name}'s house`, f.where); this.go(this.home, W); } else { this.go(l, W); this.add(until, l, 'play', 'playing in the lane', W); this.go(this.home, W); } }
      else if (k === 'water_edge') { const w = this.hh.zone === 'plain' ? `canal:${q}` : `garden:${q}`; this.go(w, W); this.add(until, w, 'play', this.hh.zone === 'plain' ? 'playing by the canal' : 'playing by the garden channels', W); this.go(this.home, W); }
      else if (k === 'errand') { this.go(l, W); this.add(this.t + r.range(0.3, 0.8), l, 'walk', 'an errand for the household', W); this.go(this.home, W); this.atHome(until, 'play', 'playing at home'); }
      else { const job = p.age >= 7 && r.chance(0.5); const a: ActivityId = !job ? (inside ? 'rest' : 'play') : p.sex === 'f' ? (r.chance(0.5) ? 'grind' : 'weave') : this.hh.zone === 'plain' ? 'tend_animals' : 'rest';
        this.atHome(until, a, a === 'grind' ? 'grinding with the women' : a === 'weave' ? 'spinning with the women' : a === 'tend_animals' ? 'helping with the household’s animals' : inside ? 'indoors' : 'playing at home'); }
    };
    spell(Math.max(this.t + 0.5, 12));
    this.atHome(this.t + 0.5, 'eat', 'midday meal'); this.atHome(Math.max(this.t, C.heatRest ? 15.5 : 14 + r.next()), 'rest', C.heatRest ? 'resting through the heat' : 'resting');
    spell(this.sun.set - 0.8);
    this.evening(Math.max(this.t, 15)); return this.finish();
  }
  private terraceWorker(place: string, act: ActivityId, why: string, pm?: [string, ActivityId, string]): Seg[] {
    const P = this.P, C = this.C; if (C.wx.storm) return this.homeDay('storm');
    const [w0, w1] = P.workWindow(C); this.morning(w0 - P.walkH(this.home, 'stair_foot', this.d, this.homeW, 'terrace') - 0.05); this.go('stair_foot', 'terrace', 'going to the Terrace');
    const issue = C.issue.get(this.p.group); if (issue !== undefined) { this.add(Math.max(this.t, issue), 'stair_foot', 'queue', 'waiting for the ration issue', 'terrace'); this.dispute('stair_foot', 'terrace'); this.add(this.t + 0.3 + this.r.next(), 'stair_foot', 'queue', 'in the ration queue', 'terrace'); }
    if (pm && (pm[0] !== place || pm[1] !== act) && this.t < 12) { this.workBlock(place, 'terrace', act, why, Math.max(w0, this.t), 12.7, true, 'work_hearth'); [place, act, why] = pm; } // a different task after the midday meal
    this.workBlock(place, 'terrace', act, why, Math.max(w0, this.t), w1, true, 'work_hearth');
    this.go(this.home, this.homeW, issue !== undefined ? 'carrying the ration home' : 'going home', issue !== undefined ? 'carry_sack' : 'walk'); this.evening(this.t); return this.finish();
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
    if (k === 'home') return this.homeWork(p.sex === 'f' ? 'weave' : act, p.sex === 'f' ? 'spinning and weaving at home for the workshop' : `${why} at home`);
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
      else { this.go(this.home, this.homeW, 'taking work home'); this.atHome(15, p.sex === 'f' ? 'weave' : act, 'finishing the work at home'); } }
    if (this.cur !== this.home) this.workBlock(p.work, 'town', act, why, Math.max(7, this.t), 15, false);
    this.go(this.home, this.homeW, q !== null ? 'carrying the ration home' : 'going home', q !== null ? 'carry_sack' : 'walk'); this.evening(this.t); return this.finish();
  }
  /** a working day at home (outwork) */
  private homeWork(act: ActivityId, why: string): Seg[] {
    this.morning(this.rise() + 1.2); this.rationRun(); this.go(this.home, this.homeW); this.atHome(Math.max(this.t, 12), act, why); this.atHome(this.t + 0.6, 'eat', 'midday meal');
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
    this.go(this.home, this.homeW); if (!busy) { this.atHome(this.t + 0.6, 'eat', 'midday meal'); this.atHome(15.5, 'rest', 'at home: a quiet day at the stores'); } this.evening(this.t); return this.finish();
  }
  private miller(): Seg[] {
    const k = this.C.milling.length ? 'mill' : this.choose(L.job_tasks.miller.v as Record<'mill' | 'flour_out' | 'grain_in', number>);
    this.morning(7 - this.P.walkH(this.home, 'mill', this.d, this.homeW, 'town') - 0.05); const q = this.rationRun(); this.go('mill', 'town', 'to the mill');
    if (k !== 'mill' && this.t < 11) { this.workBlock('mill', 'town', 'grind', 'grinding at the mill', Math.max(7, this.t), 9, false); this.errand(k === 'flour_out' ? 'store_town' : 'store_town', 'town', 'carry_sack', k === 'flour_out' ? 'carrying flour back to the storehouse' : 'bringing grain from the storehouse to the mill', 1.5, 'mill', 'town'); }
    // the afternoon's own task (C): more grinding, or a load between the mill and the storehouse
    const k2 = this.C.milling.length ? 'mill' : this.choose(L.job_tasks.miller.v as Record<'mill' | 'flour_out' | 'grain_in', number>);
    if (k2 !== 'mill' && k2 !== k && this.t < 12) { this.workBlock('mill', 'town', 'grind', 'grinding at the mill', Math.max(7, this.t), 12.2, false); this.errand('store_town', 'town', 'carry_sack', k2 === 'flour_out' ? 'carrying flour back to the storehouse' : 'bringing grain from the storehouse to the mill', 1.2, 'mill', 'town'); }
    this.workBlock('mill', 'town', 'grind', this.C.milling.length ? 'grinding a consignment of grain for the stores (E-07)' : 'grinding at the mill', Math.max(7, this.t), this.C.milling.length ? 16 : 13.5, false);
    this.go(this.home, this.homeW, q !== null ? 'carrying the ration home' : 'going home', q !== null ? 'carry_sack' : 'walk'); this.evening(this.t); return this.finish();
  }
  private weaver(): Seg[] {
    const k = this.choose(L.job_tasks.weaver.v as Record<'workshop' | 'home' | 'wash' | 'deliver', number>);
    if (k === 'home') return this.homeWork('weave', 'spinning and weaving at home for the group');
    if (k === 'wash' && !this.C.wx.wet) { const c = `canal:${this.hh.q}`; this.morning(7 - this.P.walkH(this.home, c, this.d, this.homeW, 'town')); this.rationRun(); this.go(c, 'town', 'to the water'); this.workBlock(c, 'town', 'wash', 'washing and dyeing wool at the water', Math.max(7, this.t), 13, true, c); this.go(this.home, this.homeW); this.evening(this.t); return this.finish(); }
    this.morning(7 - this.P.walkH(this.home, 'ws_textile', this.d, this.homeW, 'town') - 0.05); const q = this.rationRun(); this.go('ws_textile', 'town', 'to the workshop');
    if (k === 'deliver' && this.t < 11) { this.workBlock('ws_textile', 'town', 'weave', 'weaving in the workshop', Math.max(7, this.t), 10, false); this.errand('treasury_store', 'terrace', 'carry_sack', 'carrying finished cloth up to the treasury store', 1.3, 'ws_textile', 'town'); }
    // the afternoon, drawn on its own: the loom, spinning at home, or wool to wash at the water (lives.json job_tasks.weaver)
    const WA = L.job_tasks.weaver.afternoon; const k2 = this.choose({ workshop: WA.workshop, home: WA.home, wash: this.C.wx.wet ? 0 : WA.wash });
    if (k2 !== 'workshop' && this.t < 12.5) { this.workBlock('ws_textile', 'town', 'weave', 'weaving in the workshop', Math.max(7, this.t), 12.7, false);
      if (k2 === 'home') { this.go(this.home, this.homeW, q !== null ? 'carrying the ration home' : 'going home', q !== null ? 'carry_sack' : 'walk'); this.atHome(15, 'weave', 'spinning at home in the afternoon'); this.evening(this.t); return this.finish(); }
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
    if (k === 'home') return this.homeWork('craft', 'grinding pigments and mending tools at home');
    this.morning(7 - this.P.walkH(this.home, 'craft_zone', this.d, this.homeW, 'town') - 0.05); this.go('craft_zone', 'town', 'to the kilns');
    if (k === 'clay' && !this.C.wx.wet) this.errand('clay_pit', 'town', 'craft', 'digging clay by the river', 3, 'craft_zone', 'town');
    if (k === 'deliver' && this.t < 11) this.errand('worksite', 'terrace', 'carry_sack', 'carrying pigment and whitening up to the Terrace works (PW2017: the palette matches the Terrace)', 2, 'craft_zone', 'town');
    const bench = (x: string): [string, string] => x === 'pigment' ? ['craft_zone:pigments', 'making pigments, Egyptian blue among them (PW-PIGMENT2021)'] : ['craft_zone', 'firing the kiln'];
    // the afternoon's task, drawn on its own (C): the kiln and the pigment benches are side by side in Area B (PW2017)
    const CA = L.job_tasks.craftsman.afternoon; const k2 = this.choose({ kiln: CA.kiln, pigment: CA.pigment, deliver: this.C.wx.wet ? 0 : CA.deliver, home: CA.home });
    if (k2 !== k && this.t < 12) { const [pl, why] = bench(k); this.workBlock(pl, 'town', 'craft', why, Math.max(7, this.t), 12.7, false);
      if (k2 === 'deliver') this.errand('worksite', 'terrace', 'carry_sack', 'carrying pigment and whitening up to the Terrace works (PW2017: the palette matches the Terrace)', 2, 'craft_zone', 'town');
      else if (k2 === 'home') { this.go(this.home, this.homeW, 'taking work home'); this.atHome(15.5, 'craft', 'grinding pigments at home'); this.evening(this.t); return this.finish(); } }
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
  private homeRest(): Seg[] { this.atHome(Math.max(this.t, 12.5), 'rest', 'at home'); this.atHome(this.t + 0.6, 'eat', 'midday meal'); this.atHome(Math.max(this.t, 15.5), 'talk', 'with the household'); this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish(); }
  private caretaker(): Seg[] {
    const p = this.p, d = this.d;
    if (p.sex === 'm' && (p.id + d) % 10 === 0) { // night duty at the closed palaces, about one night in ten (C)
      this.atHome(this.rise() + 1, 'sleep', 'asleep'); this.atHome(this.t + 0.4, 'eat', 'breakfast'); this.atHome(13, 'rest', 'at home before night duty'); this.atHome(this.t + 0.6, 'eat', 'midday meal');
      this.atHome(Math.max(this.t, this.sun.set - 2.5), 'sleep', 'sleeping before night duty'); this.atHome(this.t + 0.4, 'eat', 'a meal');
      this.go('palaces', 'terrace', 'going up for the night'); this.add(24, 'palaces', 'rest', 'night duty at the closed palaces (awake by the door)', 'terrace'); return this.segs; }
    if (p.sex === 'm' && (p.id + d - 1) % 10 === 0) { this.add(this.sun.rise, 'palaces', 'rest', 'night duty at the palaces', 'terrace'); this.go(this.home, this.homeW); this.atHome(12, 'sleep', 'sleeping after night duty'); return this.homeRest(); }
    if ((p.id + d) % 5 === 0) { // the lamps, in turn: a day at home, then oil and lamps at dusk (C)
      this.morning(this.rise() + 1.2); this.rationRun(); this.go(this.home, this.homeW); this.atHome(Math.max(this.t, 12.5), this.p.sex === 'f' ? 'grind' : 'rest', 'at home'); this.atHome(this.t + 0.6, 'eat', 'midday meal');
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
    block(12); if (!C.heatRest) { this.add(this.t + 0.7, this.segs[this.segs.length - 1].place, 'eat', 'midday meal', 'town'); block(15.5); }
    this.go(this.home, this.homeW); this.evening(this.t);
    if (nightTurn) { this.atHome(Math.max(this.t, 22), 'sleep', 'asleep'); this.go(canal, 'town', 'to the channel in the night'); this.dispute(canal, 'town'); this.add(this.t + 1.2, canal, 'irrigate', 'a night turn of water (CE-19: the river is low)', 'town'); this.go(this.home, this.homeW); }
    return this.finish();
  }
  /** a household farms two to four scattered plots (C); the work moves from plot to plot every few days */
  private field(hhId: number) { const plots = 2 + Math.floor(u01(this.P.seed, S.assign, 9000 + hhId) * 3); return `field:${hhId}:${Math.floor((this.d + hhId) / 3) % plots}`; }
  private farmer(): Seg[] {
    const C = this.C, p = this.p, d = this.d, r = this.r, q = this.hh.q; const w: Where = this.homeW;
    const field = this.field(this.hh.id);
    const season = C.season; const frac = POPD.zones.find((z: any) => z.id === 'plain').field_fraction_adults_by_day[season];
    const agri = C.agri; const harvest = agri.has('E-41') || agri.has('E-42'); const thresh = agri.has('E-43'); const plough = agri.has('E-40') || agri.has('E-44');
    const canal = agri.has('E-50') && p.sex === 'm' && (this.hh.id + C.dom) % 3 === 0; const vintage = agri.has('E-45') && this.hh.id % 5 < 2; const fruit = agri.has('E-46') && this.hh.id % 2 === 0;
    const turn = (this.hh.id + d) % 6 === 0 && [1, 2, 3, 4, 5, 6, 7].includes(C.month);
    if (C.wx.storm) return this.homeDay('storm');
    if (p.age < 14 && p.sex === 'm') return this.child();
    // which of the season's tasks falls to this household today (E-40 … E-50); harvest and threshing take everyone
    const task: [ActivityId, string, string, number, number] | null = harvest && !thresh ? ['reap', field, `the ${agri.has('E-41') ? 'barley' : 'wheat'} harvest (${agri.has('E-41') ? 'E-41' : 'E-42'})`, 5, 11]
      : thresh && (!harvest || (this.hh.id + d) % 2 === 0) ? ['thresh', `threshing:${q}`, 'threshing and winnowing on the village floor (E-43)', 6, 17]
      : harvest ? ['reap', field, 'the wheat harvest (E-42)', 5, 11]
      : canal ? ['dig_canal', `canal:${q}`, 'clearing the village canal (E-50)', 8, 15]
      : plough && !C.wx.wet && r.chance(0.8) ? ['plough', field, agri.has('E-44') ? 'sowing the summer crops (E-44)' : 'ploughing and sowing barley and wheat (E-40)', 7, 16]
      : vintage && r.chance(0.8) ? ['pick_fruit', `vineyard:${q}`, 'the vintage (E-45)', 6, 15]
      : fruit && r.chance(0.7) ? ['pick_fruit', `orchard:${q}`, 'picking figs and fruit (E-46)', 6, 11]
      : turn ? ['irrigate', `canal:${q}`, 'the household’s turn of water from the canal (CE-19)', 6, 9]
      : r.chance(frac) ? ['field_work', field, 'hoeing, weeding and minding the crop', 6.5, 13] : null;
    // threshing season (E-43): some days the household's men carry grain to the storehouse in the town (the state share
    // that feeds E-06), some nights one sleeps on the threshing floor to guard the heap (both C)
    if (task && task[0] === 'thresh' && p.sex === 'm' && p.age >= 16) {
      const u = u01(this.P.seed, S.assign, 7000 + this.hh.id, d); const trip = this.P.walkH(this.home, 'store_town', d, w, 'town');
      if (u < 0.1 && trip < 3) { this.morning(this.sun.rise - 0.2); this.go('store_town', 'town', 'carrying grain to the storehouse in the town', 'carry_sack'); this.add(this.t + 1, 'store_town', 'queue', 'waiting for the grain to be measured and sealed for', 'town'); this.go(this.home, w, 'walking home');
        this.atHome(Math.max(this.t + 0.5, this.sun.set - 1.5), 'rest', 'resting after the road'); this.evening(this.t); return this.finish(); }
      if (u < 0.2) { const [act, place, why, h0, h1] = task; this.morning(h0 - this.P.walkH(this.home, place, d, w, 'plain') - 0.05); this.go(place, 'plain'); this.workBlock(place, 'plain', act, why, Math.max(h0, this.t), h1, true, place);
        this.go(this.home, w); this.atHome(Math.max(this.t, this.sun.set - 0.8), 'rest', 'resting'); this.atHome(this.t + 0.5, 'eat', 'evening meal'); this.go(place, 'plain', 'out to the threshing floor');
        this.add(Math.max(this.t + 1.5, this.bed() + 0.5), place, 'rest', 'sitting up by the threshing floor to guard the grain heap', 'plain'); this.go(this.home, w); return this.finish(); }
    }
    if (!task) {
      if (season === 'winter' && p.sex === 'm' && this.P.walkH(this.home, 'store_town', d, w, 'town') < 1.5 && r.chance(0.12)) { this.morning(this.rise() + 1); this.go('lane:q_lt_e', 'town', 'walking to the town'); this.add(this.t + 1.5, 'lane:q_lt_e', 'exchange', 'exchanging produce in the town', 'town'); this.go(this.home, w, 'walking home'); this.evening(this.t); return this.finish(); }
      return this.homeDay(season === 'winter' ? 'little field work in winter' : 'at home');
    }
    let [act, place, why, h0, h1] = task;
    if (act === 'reap' && this.hh.kin.length && r.chance(0.25)) { const k = this.hh.kin[Math.floor(r.next() * this.hh.kin.length)]; place = this.field(k); why = 'helping kin with their harvest'; } // households help their kin at the harvest (C)
    this.morning(h0 - this.P.walkH(this.home, place, d, w, 'plain') - 0.05); this.go(place, 'plain', 'to the fields'); if (act === 'irrigate' || act === 'dig_canal') this.dispute(place, 'plain');
    this.workBlock(place, 'plain', act, why, Math.max(h0, this.t), h1, true, place);
    // through the heat: some rest in the shade by the field, the others go home to sleep and to the household's work (C)
    if ((act === 'reap' || act === 'thresh') && r.chance(0.35)) { this.add(Math.min(this.sun.set - 2.5, this.t + r.range(2, 3.5)), place, 'rest', 'resting in the shade by the field through the heat', 'plain'); this.go(this.home, w); }
    else { this.go(this.home, w); if (act === 'reap' || act === 'thresh') this.atHome(this.t + r.range(1, 2.5), 'sleep', 'sleeping through the heat of the day'); }
    if (act === 'irrigate' && this.t < 11) { this.go(field, 'plain'); this.workBlock(field, 'plain', 'field_work', 'hoeing and minding the crop', this.t, 12.5, true, field); this.go(this.home, w); }
    // the late afternoon, when the heat breaks: sheaves to the threshing floor at harvest; the oxen in the ploughing season
    const late = this.sun.set - 2.2;
    if (act === 'reap' && late > this.t + 0.5 && r.chance(0.5)) { this.homeHours(late, 'resting through the heat'); this.errand(`threshing:${q}`, 'plain', 'carry_sack', 'carrying sheaves to the threshing floor (E-43)', 1.2, this.home, w); }
    else if (act === 'reap' && late > this.t + 0.5 && r.chance(0.3)) { this.homeHours(late, 'resting through the heat'); this.errand(field, 'plain', 'reap', 'binding the last sheaves and gleaning the stubble', 1.3, this.home, w); }
    else if (act === 'plough' && late > this.t + 0.5 && r.chance(0.5)) { this.homeHours(late, 'resting'); this.atHome(this.t + 1, 'tend_animals', 'feeding and watering the oxen'); }
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
    const r = this.r, p = this.p, C = this.C, W = this.homeW; this.morning(this.rise() + 0.8 + r.next() * 1.2); const l = `lane:${this.hh.q}`;
    const plain = this.hh.zone === 'plain', harvest = plain && (C.agri.has('E-41') || C.agri.has('E-42') || C.agri.has('E-43'));
    const inside = C.wx.wet || C.wx.dust; // rain and dust keep the old in
    // the morning and the afternoon are each a few of the old people's occupations in turn (lives.json elders.choices);
    // in the plain an old man may also sit out by the household's crop or the threshing floor, or see to the animals
    const one = (until: number) => {
      const E = L.elders; const w = { ...(E.choices as Record<'lane' | 'visit' | 'work' | 'children' | 'errand' | 'rest', number>), fields: plain && p.sex === 'm' ? (harvest ? E.plain.fields_men_harvest : E.plain.fields_men) : 0, animals: plain ? E.plain.animals : 0 };
      if (inside) { w.lane = 0; w.visit = 0; w.errand = 0; w.fields = 0; w.animals /= 2; }
      const k = this.choose(w); const t1 = Math.min(until, this.t + r.range(E.spell_h[0], E.spell_h[1]));
      if (k === 'lane') { this.go(l, W); this.add(Math.max(this.t + 0.3, t1), l, 'talk', 'sitting and talking in the lane', W); this.go(this.home, W); }
      else if (k === 'visit') { const v = this.visitTarget(); if (v) { this.go(v.place, v.where, 'visiting'); this.add(Math.max(this.t + 0.3, t1), v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, W); } else this.atHome(t1, 'talk', 'with the household'); }
      else if (k === 'work') this.atHome(t1, p.sex === 'f' ? (r.chance(0.5) ? 'grind' : 'weave') : 'craft', p.sex === 'f' ? 'light work: grinding or spinning' : 'mending baskets and tools');
      else if (k === 'children') this.atHome(t1, 'talk', 'minding the grandchildren');
      else if (k === 'fields') { const f = harvest && C.agri.has('E-43') ? `threshing:${this.hh.q}` : this.field(this.hh.id);
        this.go(f, 'plain', 'out to the crop'); this.add(Math.max(this.t + 0.3, t1), f, 'rest', f.startsWith('threshing') ? 'sitting by the threshing floor, watching the grain' : 'sitting out by the crop, keeping the birds off', 'plain'); this.go(this.home, W); }
      else if (k === 'animals') this.atHome(t1, 'tend_animals', 'seeing to the household’s animals');
      else if (k === 'errand') { this.go(l, W); this.add(this.t + r.range(0.4, 1), l, 'exchange', 'a small exchange in the lane', W); this.go(this.home, W); }
      else this.atHome(t1, 'rest', 'resting at home');
    };
    while (this.t < 11.6) one(12.2);
    this.atHome(Math.max(this.t, 12.3), 'rest', 'at home'); this.atHome(this.t + 0.6, 'eat', 'midday meal');
    const [n0, n1] = L.elders.nap_h; this.atHome(this.t + r.range(n0, n1), 'sleep', 'an afternoon sleep');
    while (this.t < this.sun.set - 1.8) one(this.sun.set - 1);
    this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
  }
  private homemaker(): Seg[] {
    const r = this.r, p = this.p, C = this.C; if (p.age < 14) return this.child();
    // in the plain the harvest, threshing and fruit picking take the whole household (E-41 … E-46: "whole households")
    if (this.hh.zone === 'plain' && (C.agri.has('E-41') || C.agri.has('E-42') || C.agri.has('E-43') || (C.agri.has('E-46') && this.hh.id % 2 === 0) || (C.agri.has('E-45') && this.hh.id % 5 < 2)) && !C.wx.storm && r.chance(L.homemaker.harvest_share)) {
      const thresh = C.agri.has('E-43') && (!(C.agri.has('E-41') || C.agri.has('E-42')) || (this.hh.id + this.d) % 2 === 0); const fr = !C.agri.has('E-41') && !C.agri.has('E-42') && !C.agri.has('E-43');
      const kin = this.hh.kin.length && r.chance(L.homemaker.kin_help) ? this.hh.kin[Math.floor(r.next() * this.hh.kin.length)] : this.hh.id; // households help their kin at the harvest (C)
      const [act, place, why, h0, h1]: [ActivityId, string, string, number, number] = thresh ? ['thresh', `threshing:${this.hh.q}`, 'winnowing on the village floor (E-43)', 6.5, 16] : fr ? ['pick_fruit', `orchard:${this.hh.q}`, 'picking fruit with the household', 6.5, 11] : ['reap', this.field(kin), kin === this.hh.id ? 'bindingsheaves at the harvest' : 'helping kin with their harvest', 5.5, 11];
      this.morning(h0 - 0.3); this.go(place, 'plain', 'to the fields'); this.workBlock(place, 'plain', act, why, Math.max(h0, this.t), h1, true, place); this.go(this.home, this.homeW);
      this.atHome(this.t + 0.6, 'eat', 'a meal'); this.homeHours(Math.max(this.t, 14.5), 'resting through the heat');
      // the late afternoon (C): the household's grinding, spinning, water, or sheaves to the threshing floor
      const HA = L.homemaker.harvest_afternoon; const k = this.choose({ grind: HA.grind, weave: HA.weave, sheaves: act === 'reap' ? HA.sheaves : 0, lane: HA.lane });
      if (k === 'sheaves') this.errand(`threshing:${this.hh.q}`, 'plain', 'carry_sack', 'carrying sheaves to the threshing floor', 1.2, this.home, this.homeW);
      else if (k === 'lane' && !C.wx.wet) { const l = `lane:${this.hh.q}`; this.go(l, this.homeW); this.add(this.t + r.range(0.6, 1.3), l, 'talk', 'with the women in the lane', this.homeW); this.go(this.home, this.homeW); }
      else this.atHome(this.t + r.range(0.8, 1.6), k === 'weave' ? 'weave' : 'grind', k === 'weave' ? 'spinning' : 'grinding the household’s flour');
      if (r.chance(0.6)) this.well(this.t + 0.4, 'fetching water'); this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
    }
    this.morning(this.rise() + 2.3); this.rationRun(); this.go(this.home, this.homeW);
    const u = r.next(); const l = `lane:${this.hh.q}`;
    if (u < 0.3) { const v = this.visitTarget(); if (v) { this.go(v.place, v.where, 'visiting'); this.add(this.t + r.range(0.8, 2), v.place, 'talk', `visiting ${v.name}`, v.where); this.go(this.home, this.homeW); } }
    else if (u < 0.45 && !C.short.get(p.group)) { this.go(l, this.homeW); this.add(this.t + r.range(0.5, 1.2), l, 'exchange', 'exchanging goods in kind', this.homeW); this.go(this.home, this.homeW); }
    else if (u < 0.55 && !C.wx.wet && this.hh.zone !== 'terrace') { const c = `canal:${this.hh.q}`; this.go(c, this.homeW); this.add(this.t + r.range(1, 2), c, 'wash', 'washing clothes at the water', this.homeW); this.go(this.home, this.homeW); }
    if (this.t < 12) { const k = this.choose(L.homemaker.morning_at_home as Record<'grind' | 'weave' | 'rest', number>); this.atHome(12, k, k === 'grind' ? 'household work at the quern' : k === 'weave' ? 'spinning and weaving for the household' : 'minding the children'); }
    this.atHome(this.t + 0.6, 'eat', 'midday meal'); this.atHome(Math.max(this.t, 14.5 + r.next()), r.chance(0.4) ? 'weave' : 'rest', 'spinning, and minding the children');
    if (r.chance(0.5)) this.well(this.t + 0.4, 'fetching water'); this.evening(Math.max(this.t, this.sun.set - 1)); return this.finish();
  }
  /** a party with a halmi: arrival, the days of its stay, departure (E-21); each day of the stay has its own business (C) */
  private traveller(): Seg[] {
    const P = this.P, p = this.p, d = this.d, r = this.r; const pa = P.parties[p.idx]; const k = d - p.arrive;
    if (d === p.arrive) { this.add(Math.max(0.5, pa.hour - 0.5), 'road:arrival', 'walk', `on the road from ${pa.route}`, 'road'); this.add(pa.hour, 'station', 'walk', 'arriving at the road station', 'town'); this.add(this.t + 0.6, 'station', 'queue', 'showing the halmi and drawing travel rations (E-21)', 'town');
      this.add(this.t + 0.8, 'station', 'tend_animals', 'unloading and watering the animals', 'town'); this.add(Math.max(this.t, this.sun.set), 'station', 'rest', 'resting after the road', 'town'); this.add(this.t + 0.6, 'station', 'eat', 'evening meal', 'town'); this.add(24, 'station', 'sleep', 'asleep at the station lodging', 'town'); return this.segs; }
    this.add(this.sun.rise + (k === 1 ? 1.2 : 0.4), 'station', 'sleep', 'asleep at the station lodging', 'town'); this.add(this.t + 0.5, 'station', 'eat', 'breakfast', 'town');
    if (d === p.leave) { this.add(this.t + 0.8, 'station', 'tend_animals', 'loading the animals', 'town'); this.add(this.t + 3, 'road:departure', 'walk', 'on the road out of the plain', 'road'); this.add(24, '-', 'offmap', 'gone on toward the next station', 'away'); return this.segs; }
    // the stay (C): each day has its own business. The leader: the official building, then the storehouse, then the
    // Treasury's scribes, in turn; the others: the animals and gear on the first day, then the town's lanes, the stores
    const stops: [string, Where, ActivityId, string][] = p.rank === 1
      ? [['official_bldg', 'town', 'talk', 'business with an official, as the halmi names'], ['store_town', 'town', 'talk', 'settling the party’s rations with the storekeeper'], ['treasury_desk', 'terrace', 'talk', 'with the Treasury’s scribes']]
      : [['station', 'town', 'tend_animals', 'seeing to the animals and the gear'], ['lane:q_pw_n', 'town', 'exchange', 'trading a little in kind in the town'], ['lane:q_lt_e', 'town', 'talk', 'seeing the lower town'], ['royal_store', 'town', 'talk', 'waiting at the stores with the party’s leader']];
    const [pl, wh, a, why] = stops[(k - 1 + p.id) % stops.length];
    this.go(pl, wh, 'on the day’s business'); this.add(this.t + 1.5 + r.next(), pl, a, why, wh); this.go('station', 'town');
    // the rest of the morning and the afternoon, each its own (C): rest (a sleep in the heat), mending the gear, the
    // animals to water at the river, knucklebones, or the town's lanes
    const spell = (until: number) => { if (this.t >= until - 0.3) return; const V = L.travellers_stay.spell; const x = this.choose({ rest: V.rest, gear: V.gear, animals: this.C.wx.wet ? 0 : V.animals, gamble: V.gamble, lane: this.C.wx.wet ? 0 : V.lane });
      if (x === 'gear') this.add(until, 'station', 'craft', 'mending harness, bags and sandals for the road', 'town');
      else if (x === 'animals') { this.go('river', 'town', 'taking the animals to water'); this.add(this.t + 1.2, 'river', 'tend_animals', 'watering the animals at the river', 'town'); this.go('station', 'town'); }
      else if (x === 'gamble') this.add(until, 'station', 'gamble', 'knucklebones at the station', 'town');
      else if (x === 'lane') { this.go('lane:q_lt_e', 'town', 'into the town'); this.add(this.t + 1.2, 'lane:q_lt_e', 'talk', 'talking with townspeople in the lanes', 'town'); this.go('station', 'town'); }
      else this.add(until, 'station', this.C.heatRest && this.t > 11 ? 'sleep' : 'rest', this.C.heatRest && this.t > 11 ? 'sleeping through the heat' : 'resting at the station lodging', 'town');
      if (this.t < until) this.add(until, 'station', 'rest', 'resting at the station lodging', 'town'); };
    spell(13); this.add(this.t + 0.6, 'station', 'eat', 'a meal', 'town');
    if (k >= 2 && r.chance(0.5)) { this.go('store_town', 'town'); this.add(this.t + 0.8, 'store_town', 'queue', 'drawing the next days’ travel rations', 'town'); this.go('station', 'town'); }
    spell(Math.max(this.t + 1, this.sun.set - 1.5));
    this.add(Math.max(this.t, this.sun.set), 'station', 'talk', 'with the party', 'town'); this.add(this.t + 0.5, 'station', 'eat', 'evening meal', 'town'); this.add(24, 'station', 'sleep', 'asleep at the station lodging', 'town'); return this.segs;
  }
  /** transhumant herders passing along the plain (E-49): each day a new stretch of the route and a new camp */
  private herderPassing(): Seg[] {
    const p = this.p, k = this.d - p.arrive, b = p.idx; const camp = (i: number) => `camp:band${b}:${i}`, route = `route:band${b}:${k}`;
    const act: ActivityId = p.age < 14 && p.sex === 'f' ? 'walk' : 'herd';
    if (k === 0) { const band = this.P.bands[b]; this.add(Math.max(0.5, band.hour), 'road:arrival', 'herd', 'coming down into the plain with the flock (E-49)', 'plain'); this.add(Math.max(this.t, this.sun.set - 0.5), route, act, 'grazing along the plain edge', 'plain'); this.add(this.t + 0.6, camp(0), 'eat', 'making camp and eating', 'plain'); this.add(24, camp(0), 'sleep', 'asleep in camp', 'plain'); return this.segs; }
    this.add(this.sun.rise - 0.3, camp(k - 1), 'sleep', 'asleep in camp', 'plain'); this.add(this.t + 0.4, camp(k - 1), 'eat', 'breakfast and striking camp', 'plain');
    if (this.d === p.leave) { this.add(12, route, act, 'moving the flock on', 'plain'); this.add(24, '-', 'offmap', 'gone on out of the plain', 'away'); return this.segs; }
    this.add(this.sun.set - 0.5, route, act, 'moving the flock along the plain edge (E-49)', 'plain'); this.add(this.t + 0.6, camp(k), 'eat', 'making camp and eating', 'plain'); this.add(24, camp(k), 'sleep', 'asleep in camp', 'plain'); return this.segs;
  }
}
/** the plan segment in force at hour h */
export function segAt(segs: Seg[], h: number): Seg { for (const s of segs) if (h < s.t1) return s; return segs[segs.length - 1]; }
