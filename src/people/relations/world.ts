// D-346 (ROADMAP 3e; UD-07, UD-08, UD-24, UD-25): relationships and sexuality as life, node side.
//
// Every adult (18 and over: the user's rule, law.ts 'age') of the town and the plain has a state with each person they spend
// time with: familiarity, affection, trust, and each one's desire for the other. Week by week the state moves with the time
// the two share (the same house, the same crew, kin, neighbours, the well; structural contact, hours by kind in law.ts REL),
// with help given in sickness and mourning, and with slights. Out of the state, and only out of it, come the events:
// courting (mutual desire and liking), a rejection (one wants, the other does not), the families' agreement or refusal
// (bride-gift and dowry entered through the economy's interface), weddings (widows, widowers, the divorced, and the unmarried
// past the population's first-marriage draw: the population's own weddings of the young stay its own and are adopted here
// as arranged), lovers and affairs (mutual desire, familiarity, a cold marriage), intimacy as a state change (a cut-away;
// never an interaction, nobody undresses anyone), discovery and jealousy, scandal carried as news from person to person,
// divorce (a marriage gone cold in affection and trust), conception tied to the couple (the population's births are given a
// father from who shared the mother's bed at conception, with doubtful parentage where a lover did too; the layer's own
// couples and lovers conceive; `fertility()` feeds the population's birth draw through PopOpts.fertility, the one hook).
//
// PURE: a function of the seed, the population and the player's acts (a dated ledger). Replaying gives identical events; a
// player act dated before the simulated present replays from day 0. Tier C throughout (law.ts; DECISIONS D-346).
import type { Population } from '../population';
import type { Intent } from '../economy/api';
import { u01, salt } from '../hash';
import { REGNAL_DAYS, festivalOn } from '../calendar';
import { REL } from './law';

export const PLAYER = -1;
const S = { chem: salt('rel-chem'), compat: salt('rel-compat'), orient: salt('rel-orient'), h: salt('rel-hours'), ev: salt('rel-event'), pick: salt('rel-pick'),
  init: salt('rel-init'), meet: salt('rel-meet'), away: salt('rel-away'), bed: salt('rel-bed'), news: salt('rel-news'), conc: salt('rel-conceive'), pl: salt('rel-player') };
export type Status = 'none' | 'courting' | 'betrothed' | 'married' | 'lovers' | 'divorced';
export type Kind = 'home' | 'crew' | 'tie' | 'kin' | 'neighbour' | 'well' | 'player';
export interface Pair { a: number; b: number; kind: Kind; /** temperament fit, fixed */ c: number; /** hours shared in week hw */ h: number; hw: number; fam: number; aff: number; trust: number; status: Status; since: number; weeks: number; cool: number;
  /** weeks of intimacy (a state; never shown) and the last week of it */
  intimate: number; lastBed: number; wedDay: number; discovered: boolean }
export type EvKind = 'court' | 'reject' | 'refused' | 'betroth' | 'wed' | 'wed_arranged' | 'lovers' | 'affair' | 'end_affair' | 'discovered' | 'jealous' | 'divorce' | 'widowed'
  | 'conceive' | 'father' | 'doubt' | 'scandal' | 'heard' | 'intimate' | 'kind' | 'slight' | 'gift' | 'help';
/** the pair's state when the event arose (the reason for it, and the test's evidence that it arose from the state) */
export interface Snap { fam: number; aff: number; trust: number; wantA: number; wantB: number; spouseAffA?: number; spouseAffB?: number }
export interface RelEvent { id: number; day: number; kind: EvKind; a: number; b: number; c?: number; s: Snap; why: string; tier: 'C'; cause?: number }
export interface News { id: number; day: number; about: number[]; ev: number; what: string; knows: Map<number, number>; front: number[]; hand: number[] }
export interface Pregnancy { mother: number; father: number; doubt: number[]; conceived: number; due: number; pop: boolean }
export type PlayerAct = 'talk' | 'gift' | 'help' | 'slight' | 'court' | 'propose' | 'take_lover' | 'share_bed' | 'share_home' | 'leave';
/** a meeting the relations lay into the day plans (plans.ts): a suitor's visit or walk by the well, the families agreeing a
 *  marriage at the bride's house, lovers' word apart. a visits b's house (or lane); c goes with a (the groom's father) */
export interface Meet { day: number; kind: 'court' | 'negotiate' | 'lovers'; a: number; b: number; c?: number; hostKin?: number }
export interface ActResult { ok: boolean; why: string; cutAway?: boolean; weddingDay?: number }
interface Ledger { day: number; pid: number; act: PlayerAct; res?: ActResult }
export interface RelOpts { econ?: (i: Intent) => void; player?: { sex: 'm' | 'f'; age: number }; ablate?: boolean }

const cl = (x: number, lo = -1, hi = 1) => x < lo ? lo : x > hi ? hi : x;
const key = (a: number, b: number) => a < b ? a * 262144 + b : b * 262144 + a;

export class Relations {
  readonly pairs = new Map<number, Pair>();
  readonly player = new Map<number, Pair>();
  readonly events: RelEvent[] = [];
  readonly news: News[] = [];
  readonly pregnancies: Pregnancy[] = [];
  /** the meetings of each day, laid into the plans by plans.ts */
  readonly meets = new Map<number, Meet[]>();
  private edges: [number, number, Kind][] = [];
  private contacts = new Map<number, number[]>();
  /** marriages: pid → [from, to, spouse][] (to = 1e9 while it lasts) */
  private wed = new Map<number, [number, number, number][]>();
  /** residence changes made by this layer: pid → [day, household][] */
  private homeOv = new Map<number, [number, number][]>();
  private rep = new Map<number, number>();
  private moodEv = new Map<number, number[]>();
  private pregBy = new Map<number, Pregnancy>();
  private bedWeeks = new Map<number, number[]>(); // woman → weeks of intimacy with her husband (for fertility)
  private lovBed = new Map<number, [number, number][]>(); // woman → [week, partner] of intimacy outside the marriage
  private ledger: Ledger[] = [];
  private arranged = new Set<number>();
  private ownWed = new Set<number>();
  private busy = new Set<number>();
  private pendingShow: [number, number, number][] = [];
  private week = -1;
  stats = { pairs: 0, slights: 0, helps: 0, bedWeeks: 0, newsTold: 0, intents: 0 };
  constructor(readonly pop: Population, readonly seed: number, readonly opts: RelOpts = {}) {} // (the layer is built on first use: a Simulation that never asks pays nothing)
  private ready = false;
  private ensure() { if (!this.ready) this.reset(); }

  // ================================================================ set-up
  private reset() { this.ready = true;
    this.pairs.clear(); this.player.clear(); this.events.length = 0; this.news.length = 0; this.pregnancies.length = 0; this.meets.clear(); this.wed.clear(); this.homeOv.clear(); this.rep.clear();
    this.arranged.clear(); this.ownWed.clear(); this.busy.clear(); this.pendingShow = [];
    this.moodEv.clear(); this.pregBy.clear(); this.bedWeeks.clear(); this.lovBed.clear(); this.week = -1; this.contacts.clear(); this.edges = [];
    this.stats = { pairs: 0, slights: 0, helps: 0, bedWeeks: 0, newsTold: 0, intents: 0 };
    const P = this.pop, seen = new Set<number>();
    const local = (i: number) => { const p = P.persons[i]; const z = P.households[p.hh]?.zone; return (z === 'town' || z === 'plain') && p.age >= REL.adult - 1; };
    const edge = (a: number, b: number, k: Kind) => { if (a === b || !local(b)) return; const K = key(a, b); if (seen.has(K)) return; seen.add(K); this.edges.push([Math.min(a, b), Math.max(a, b), k]); };
    const crews = new Map<string, number[]>(), quarter = new Map<string, number[]>(), wells = new Map<string, number[]>();
    for (const p of P.persons) { if (!local(p.id)) continue; const q = P.households[p.hh].q;
      if (!['homemaker', 'elder', 'child'].includes(p.job)) { const k = `${p.job}|${p.sub}|${q}`; (crews.get(k) ?? crews.set(k, []).get(k)!).push(p.id); }
      (quarter.get(q) ?? quarter.set(q, []).get(q)!).push(p.id); if (p.sex === 'f') (wells.get(q) ?? wells.set(q, []).get(q)!).push(p.id); }
    const pick = (list: number[] | undefined, i: number, n: number, k: Kind, f?: (x: number) => boolean) => { if (!list?.length) return;
      for (let j = 0, got = 0; j < n * 4 && got < n; j++) { const x = list[Math.floor(u01(this.seed, S.pick, i, j, k.length) * list.length)]; if (x !== i && (!f || f(x))) { edge(i, x, k); got++; } } };
    for (const p of P.persons) { if (!local(p.id)) continue; const H = P.households[p.hh];
      for (const m of H.members) edge(p.id, m, 'home');
      for (const t of p.ties) edge(p.id, t, 'tie');
      for (const k of H.kin.slice(0, 4)) for (const m of P.households[k].members) if (P.persons[m].age >= REL.adult - 1) edge(p.id, m, 'kin');
      pick(crews.get(`${p.job}|${p.sub}|${H.q}`), p.id, 5, 'crew');
      if (p.sex === 'f') pick(wells.get(H.q), p.id, 4, 'well');
      pick(quarter.get(H.q), p.id, 3, 'neighbour');
      pick(quarter.get(H.q), p.id, 3, 'neighbour', x => P.persons[x].sex !== p.sex && Math.abs(P.persons[x].age - p.age) < 15);
    }
    for (const [a, b] of this.edges) { (this.contacts.get(a) ?? this.contacts.set(a, []).get(a)!).push(b); (this.contacts.get(b) ?? this.contacts.set(b, []).get(b)!).push(a); }
    // (only pairs where one could desire the other can come to anything here; the rest carry the news and nothing else: the
    // relations' cost is these pairs, not the whole contact graph)
    this.edges = this.edges.filter(([a, b]) => this.canCome(a, b));
    // the marriages standing at day 0: in each house, each married woman with the man of it nearest her age + 6 (the
    // population keeps households, not couples; unmarried sons and the old are not husbands of the young; C)
    for (const H of P.households) { if (H.zone !== 'town' && H.zone !== 'plain') continue;
      const women = H.members.map(m => P.persons[m]).filter(p => p.sex === 'f' && p.age >= REL.adult && !p.single && !p.kin && p.marry >= 1e9).sort((a, b) => b.age - a.age);
      const men = H.members.map(m => P.persons[m]).filter(p => p.sex === 'm' && P.ageAt(p.id, -REL.gestationDays) >= REL.adult && !p.single && !p.kin && p.spouse === undefined); const used = new Set<number>();
      for (const w of women) { let best = -1, bd = 1e9; for (const m of men) { if (used.has(m.id) || m.age < w.age - 5) continue; const dd = Math.abs(m.age - (w.age + 6)); if (dd < bd) { bd = dd; best = m.id; } }
        if (best < 0) continue; used.add(best); this.marry(w.id, best, -1e9);
        const pr = this.pair(w.id, best, 'home'); pr.status = 'married'; pr.since = -1e9; pr.wedDay = -1e9;
        // (marriages start from a spread: most warm, some already cold)
        pr.aff = cl(0.15 + 0.6 * u01(this.seed, S.init, pr.a, pr.b, 1) - 0.2 * u01(this.seed, S.init, pr.a, pr.b, 2)); pr.trust = cl(0.1 + 0.6 * u01(this.seed, S.init, pr.a, pr.b, 3) - 0.15); } }
    // the population's own weddings of the year (the young women's first marriages, arranged by the families): the pair is
    // betrothed from day 0 and so out of courting; they are married on the day (their homes are the population's)
    for (const p of P.persons) if (p.sex === 'f' && p.spouse !== undefined && p.marry < 1e9) { const pr = this.pair(p.id, p.spouse, 'kin'); pr.status = 'betrothed'; pr.wedDay = p.marry; pr.since = 0; this.arranged.add(key(pr.a, pr.b)); }
  }
  private pair(a: number, b: number, kind: Kind): Pair {
    const K = key(a, b); let pr = this.pairs.get(K); if (pr) return pr;
    const lo = Math.min(a, b), hi = Math.max(a, b), u = (k: number) => u01(this.seed, S.init, lo, hi, k);
    const F: Record<Kind, number> = { home: 0.85, crew: 0.4, tie: 0.5, kin: 0.45, neighbour: 0.2, well: 0.3, player: 0 };
    pr = { a: lo, b: hi, kind, c: this.compat(lo, hi), h: 0, hw: -1, fam: F[kind] * (0.6 + 0.4 * u(4)), aff: kind === 'home' ? 0.35 : 0.3 * this.compat(lo, hi), trust: kind === 'home' || kind === 'kin' ? 0.3 : 0.1 * u(5), status: 'none', since: 0, weeks: 0, cool: 0, intimate: 0, lastBed: -99, wedDay: 1e9, discovered: false };
    this.pairs.set(K, pr); this.stats.pairs++; return pr;
  }
  /** one of the two could desire the other (who they can desire, not close kin) */
  /** ... and the desire could reach what courting, an affair or an advance needs this year (its bound: well known, at the
   *  ages of the start or the end of the year); pairs that cannot are never stepped */
  private canCome(a: number, b: number) { if (!this.canDesire(a, b)) return false; const ub = (x: number, y: number) => Math.max(this.want(x, y, 0, 1), this.want(x, y, REGNAL_DAYS - 1, 1)); const u1 = ub(a, b), u2 = ub(b, a);
    return Math.max(u1, u2) >= REL.advanceDesire || Math.min(u1, u2) >= Math.min(REL.courtDesire, REL.affairDesire); }
  private canDesire(a: number, b: number) { const same = this.pop.persons[a].sex === this.pop.persons[b].sex, oa = this.orient(a), ob = this.orient(b);
    return (same ? oa !== 'o' || ob !== 'o' : oa !== 's' || ob !== 's') && !this.closeKin(a, b); }
  getPair(a: number, b: number) { this.ensure(); return a === PLAYER ? this.player.get(b) : b === PLAYER ? this.player.get(a) : this.pairs.get(key(a, b)); }
  /** the player's pair with a person (created on first meeting) */
  private ppair(pid: number, d: number): Pair { let pr = this.player.get(pid); if (!pr) { pr = { a: PLAYER, b: pid, kind: 'player', c: 2 * u01(this.seed, S.pl, pid, 1) - 1, h: 0, hw: -1, fam: 0, aff: 0, trust: 0, status: 'none', since: d, weeks: 0, cool: 0, intimate: 0, lastBed: -99, wedDay: 1e9, discovered: false }; this.player.set(pid, pr); } return pr; }
  /** temperament fit: -1..1, fixed per pair (C) */
  private compat(a: number, b: number) { const P = this.pop; return 0.7 * (2 * u01(this.seed, S.compat, Math.min(a, b), Math.max(a, b)) - 1) + 0.3 * (1 - 2 * Math.abs(P.persons[a].trait - P.persons[b].trait)); }
  /** whom a person can desire: 'o' the other sex, 's' the same, 'b' both (C: a few percent each, the evidence is silent) */
  orient(pid: number): 'o' | 's' | 'b' { const u = u01(this.seed, S.orient, pid); return u < 0.03 ? 's' : u < 0.07 ? 'b' : 'o'; }
  private ageOf(pid: number, d: number) { return pid === PLAYER ? this.opts.player?.age ?? 30 : this.pop.ageOn(pid, d); }
  private sexOf(pid: number) { return pid === PLAYER ? this.opts.player?.sex ?? 'm' : this.pop.persons[pid].sex; }
  /** x's desire for y on day d (0..1): who x can desire, age, the pair's chemistry, how well they know each other */
  want(x: number, y: number, d: number, fam: number): number {
    if (this.opts.ablate) return 0;
    const ax = this.ageOf(x, d), ay = this.ageOf(y, d); if (ax < REL.adult || ay < REL.adult) return 0; // (the user's rule: nobody under 18)
    const o = x === PLAYER ? 'o' : this.orient(x), same = this.sexOf(x) === this.sexOf(y); if ((o === 'o' && same) || (o === 's' && !same)) return 0;
    const target = this.sexOf(x) === 'm' ? cl(ax - 5, 18, 32) : cl(ax + 4, 21, 45), af = Math.exp(-((ay - target) ** 2) / (2 * 9 * 9)) * (ay > 55 ? 0.5 : 1);
    const chem = Math.pow(u01(this.seed, S.chem, x === PLAYER ? 262143 : x, y === PLAYER ? 262143 : y), 1.3);
    return cl(af * chem * (0.45 + 0.55 * fam) * (ax > 60 ? 0.5 : 1), 0, 1);
  }
  private snap(pr: Pair, d: number): Snap { const s: Snap = { fam: +pr.fam.toFixed(3), aff: +pr.aff.toFixed(3), trust: +pr.trust.toFixed(3), wantA: +this.want(pr.a, pr.b, d, pr.fam).toFixed(3), wantB: +this.want(pr.b, pr.a, d, pr.fam).toFixed(3) };
    const sa = this.spouseOn(pr.a, d), sb = this.spouseOn(pr.b, d); if (sa >= 0 && sa !== pr.b) s.spouseAffA = +(this.getPair(pr.a, sa)?.aff ?? 0).toFixed(3); if (sb >= 0 && sb !== pr.a) s.spouseAffB = +(this.getPair(pr.b, sb)?.aff ?? 0).toFixed(3); return s; }
  private ev(day: number, kind: EvKind, pr: Pair | null, a: number, b: number, why: string, c?: number, cause?: number): RelEvent {
    const s = pr ? this.snap(pr, day) : { fam: 0, aff: 0, trust: 0, wantA: 0, wantB: 0 };
    const e: RelEvent = { id: this.events.length, day, kind, a, b, s, why, tier: 'C', ...(c !== undefined ? { c } : {}), ...(cause !== undefined ? { cause } : {}) }; this.events.push(e);
    for (const x of [a, b, c]) if (x !== undefined && x !== PLAYER) (this.moodEv.get(x) ?? this.moodEv.set(x, []).get(x)!).push(e.id);
    return e;
  }

  // ================================================================ facts over time
  private marry(a: number, b: number, day: number) { for (const [x, y] of [[a, b], [b, a]]) (this.wed.get(x) ?? this.wed.set(x, []).get(x)!).push([day, 1e9, y]); }
  private unmarry(a: number, b: number, day: number) { for (const [x, y] of [[a, b], [b, a]]) for (const w of this.wed.get(x) ?? []) if (w[2] === y && w[1] >= 1e9) w[1] = day; }
  /** the spouse on day d, or -1 */
  spouseOn(pid: number, d: number): number { this.ensure(); for (const w of this.wed.get(pid) ?? []) if (d >= w[0] && d < w[1]) return w[2]; return -1; }
  /** the household a person lives in on day d, with this layer's weddings and divorces laid over the population's */
  homeOf(pid: number, d: number): number { this.ensure(); let h = pid === PLAYER ? -1 : this.pop.home(pid, d); for (const [x, hh] of this.homeOv.get(pid) ?? []) if (x <= d) h = hh; return h; }
  private move(pid: number, day: number, hh: number) { (this.homeOv.get(pid) ?? this.homeOv.set(pid, []).get(pid)!).push([day, hh]); }
  private adult(pid: number, d: number) { if (pid === PLAYER) return true; const P = this.pop; if (!P.present(pid, d) || P.ageOn(pid, d) < REL.adult) return false; const z = P.households[this.homeOf(pid, d)]?.zone; return z === 'town' || z === 'plain'; }
  private closeKin(a: number, b: number) { const A = this.pop.persons[a], B = this.pop.persons[b]; return A.hh === B.hh || A.mother === b || B.mother === a || (A.mother >= 0 && A.mother === B.mother); }
  private away(pid: number, w: number) { const j = this.pop.persons[pid].job; return (j === 'messenger' || j === 'porter' || j === 'guard') && u01(this.seed, S.away, pid, w) < 0.3; }
  private wealth(hh: number) { const jobs = this.pop.households[hh]?.members.map(m => this.pop.persons[m].job as string) ?? []; return jobs.some(j => j === 'official' || j === 'steward') ? 'rich' : jobs.some(j => j === 'farmer' || j === 'gardener') ? 'farmer' : jobs.some(j => j === 'craftsman' || j === 'weaver') ? 'craft' : jobs.some(j => j === 'shepherd' || j === 'herder') ? 'herder' : 'ration'; }
  private rank(hh: number) { return ({ rich: 3, craft: 2, farmer: 1.5, herder: 1, ration: 1 } as Record<string, number>)[this.wealth(hh)]; }
  private intent(i: Intent) { this.stats.intents++; this.opts.econ?.(i); }

  // ================================================================ the weeks
  /** simulate every week that starts on or before `day` */
  advance(day: number) { this.ensure(); const W = Math.min(Math.floor(day / 7), Math.floor((REGNAL_DAYS - 1) / 7)); if (this.stepping || this.week >= W) return; this.stepping = true; try { while (this.week < W) this.step(++this.week); } finally { this.stepping = false; } }
  private step(w: number) {
    const P = this.pop, d0 = w * 7, d1 = Math.min(REGNAL_DAYS - 1, d0 + 6), d = d0 + 3, e0 = this.events.length;
    const fest = [0, 1, 2, 3, 4, 5, 6].some(k => festivalOn(this.seed, d0 + k) !== null);
    this.busy.clear(); for (const pr of this.pairs.values()) if (pr.status === 'courting' || pr.status === 'betrothed') { this.busy.add(pr.a); this.busy.add(pr.b); }
    for (const pr of this.player.values()) if (pr.status === 'courting' || pr.status === 'betrothed') this.busy.add(pr.b);
    // the population's weddings and deaths of the week
    for (let x = d0; x <= d1; x++) { const life = P.lifeOn(x);
      for (const b of life.marriages) { const B = P.persons[b]; if (B.spouse === undefined || B.moved) continue; const pr = this.pair(b, B.spouse, 'kin'); pr.status = 'married'; pr.since = x; pr.wedDay = x; this.marry(b, B.spouse, x);
        if (P.ageOn(b, x) >= REL.adult) this.ev(x, 'wed_arranged', pr, b, B.spouse, 'married as the families arranged (the population’s draw)'); }
      for (const dead of life.deaths) { const s = this.spouseOn(dead, x); if (s >= 0) { this.unmarry(dead, s, x); const pr = this.getPair(dead, s); if (pr) pr.status = 'none'; if (this.adult(s, x) && P.ageOn(dead, x) >= REL.adult) this.ev(x, 'widowed', pr ?? null, s, dead, 'the spouse died'); }
      } }
    for (const pr of [...this.pairs.values(), ...this.player.values()]) if (pr.status === 'lovers' && ((pr.a !== PLAYER && !P.present(pr.a, d1)) || !P.present(pr.b, d1))) pr.status = 'none';
    // this week's households (who lives with whom now)
    const byHome = new Map<number, number[]>();
    const st = new Map<number, number>(); // this week: 1 adult here, 2 sick, 4 in mourning, 8 away
    for (const [pid] of this.contacts) { if (!this.adult(pid, d)) { st.set(pid, 0); continue; } st.set(pid, 1 | (P.sick(pid, d) ? 2 : 0) | (P.mourning(pid, d) ? 4 : 0) | (this.away(pid, w) ? 8 : 0));
      const h = this.homeOf(pid, d); (byHome.get(h) ?? byHome.set(h, []).get(h)!).push(pid); }
    const F = (x: number) => st.get(x) ?? 0;
    const met: Pair[] = [];
    const add = (a: number, b: number, k: Kind) => { const fa = F(a), fb = F(b); if (!(fa & fb & 1)) return; if (k === 'home' && this.spouseOn(a, d) !== b && !this.canDesire(a, b)) return; const pr = this.pair(a, b, k); let h = REL.hours[k] * (0.4 + 1.2 * u01(this.seed, S.h, pr.a, pr.b, w));
      if (fest && (k === 'neighbour' || k === 'well' || k === 'kin')) h *= 1.6; if ((fa | fb) & 2) h *= 0.3; if ((fa | fb) & 8) h *= 0.2;
      if (pr.hw !== w) { pr.hw = w; pr.h = h; met.push(pr); } else if (pr.h < h) pr.h = h; };
    for (const [a, b, k] of this.edges) add(a, b, k);
    for (const ms of byHome.values()) for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) add(ms[i], ms[j], 'home');
    for (const pr of this.pairs.values()) { if (pr.hw !== w) { if (pr.status === 'lovers' && this.adult(pr.a, d) && this.adult(pr.b, d)) { pr.hw = w; pr.h = 3; met.push(pr); } else pr.fam *= 0.997; } }
    // the state moves
    for (const pr of met) {
      const h = pr.h, K = key(pr.a, pr.b) % 1e9, c = pr.c, lh = Math.log1p(h);
      pr.fam = cl(pr.fam + (1 - pr.fam) * (1 - Math.exp(-h / 150)), 0, 1);
      // (affection and trust move toward what the two are to each other, the faster the more time they share; shocks fade)
      const close = pr.status === 'married' || pr.status === 'courting' || pr.status === 'betrothed' || pr.status === 'lovers' || pr.kind === 'home' || pr.kind === 'kin', rate = 0.04 * lh / 3.3;
      pr.aff = cl(pr.aff + ((close ? 0.3 : 0.05) + 0.5 * c * (0.5 + 0.5 * pr.fam) - pr.aff) * rate);
      pr.trust = cl(pr.trust + ((close ? 0.3 : 0.1) + 0.35 * c - pr.trust) * rate * 0.7);
      if (u01(this.seed, S.ev, K, w, 1) < 0.012 * lh * (0.7 - 0.5 * c)) { pr.aff = cl(pr.aff - 0.14); pr.trust = cl(pr.trust - 0.1); this.stats.slights++; } // a slight: a harsh word, a thing not returned
      if ((pr.kind !== 'home') && ((F(pr.a) | F(pr.b)) & 6) && u01(this.seed, S.ev, K, w, 2) < 0.3) { pr.aff = cl(pr.aff + 0.06); pr.trust = cl(pr.trust + 0.1); this.stats.helps++; }
    }
    // what comes of it
    for (const pr of met) this.decide(pr, key(pr.a, pr.b), w, d0, d1, pr.h);
    for (const pr of [...this.pairs.values(), ...this.player.values()]) if (pr.status === 'betrothed' && pr.wedDay >= d0 && pr.wedDay <= d1 && !this.arranged.has(key(pr.a, pr.b))) this.wedding(pr);
    // the player's married lovers risk being found out as anyone's do
    for (const pr of this.player.values()) if (pr.status === 'lovers' && !pr.discovered) { const s = this.spouseOn(pr.b, d); if (s >= 0 && u01(this.seed, S.pl, pr.b, w, 3) < REL.discoverP) this.discover(pr, pr.b, s, d); }
    this.bed(w, d0, d);
    // the player's acts of this week, in day order, at its end (so a live act and its replay land at the same point)
    for (const L of this.ledger) if (Math.floor(L.day / 7) === w && !L.res) L.res = this.apply(L);
    this.spread(w, d);
    this.meetings(d0, d1, e0);
  }
  private meetings(d0: number, d1: number, e0: number) {
    const P = this.pop, put = (m: Meet) => (this.meets.get(m.day) ?? this.meets.set(m.day, []).get(m.day)!).push(m);
    const head = (pid: number, d: number) => { const ms = P.membersOn(this.homeOf(pid, d), d).filter(x => x !== pid && this.adult(x, d) && P.ageOn(x, d) >= 30 && !P.sick(x, d)); ms.sort((x, y) => P.ageOn(y, d) - P.ageOn(x, d) || x - y); return ms[0]; };
    // the families agree the marriage at the bride's house on the day of the agreement
    for (let i = e0; i < this.events.length; i++) { const e = this.events[i]; if (e.kind !== 'betroth' || e.a === PLAYER || e.b === PLAYER) continue; put({ day: e.day, kind: 'negotiate', a: e.a, b: e.b, c: head(e.a, e.day), hostKin: head(e.b, e.day) }); }
    for (const pr of this.pairs.values()) { if (pr.status !== 'courting' && pr.status !== 'lovers') continue;
      for (let x = Math.max(d0, pr.since + 1); x <= d1; x++) { if (u01(this.seed, S.meet, pr.a, pr.b, x) >= (pr.status === 'courting' ? 0.3 : 0.2)) continue;
        if (pr.status === 'courting') { const man = P.persons[pr.a].sex === 'm' ? pr.a : pr.b; put({ day: x, kind: 'court', a: man, b: man === pr.a ? pr.b : pr.a }); }
        else put({ day: x, kind: 'lovers', a: pr.a, b: pr.b }); } }
  }
  private decide(pr: Pair, K: number, w: number, d0: number, d1: number, h: number) {
    const P = this.pop, d = d0 + 3, A = P.persons[pr.a], B = P.persons[pr.b];
    const sa = this.spouseOn(pr.a, d), sb = this.spouseOn(pr.b, d);
    const opp = A.sex !== B.sex, woman = A.sex === 'f' ? A : B, man = A.sex === 'f' ? B : A;
    // (a pair neither of whom can desire the other has nothing more to come of it this week: the common case, decided cheaply)
    if (pr.status === 'none' && (d < pr.cool || (!opp && this.orient(pr.a) === 'o' && this.orient(pr.b) === 'o'))) return;
    if (pr.status === 'married') { // a marriage goes cold, and ends
      if (pr.aff < REL.divorceAff && pr.trust < REL.divorceTrust) pr.weeks++; else pr.weeks = 0;
      if (pr.weeks >= REL.divorceWeeks && this.r(K, w, 1) < REL.divorceP) this.divorce(pr, d);
      else if (pr.aff < 0.1 && this.r(K, w, 7) < 0.005) this.ev(d, 'jealous', pr, pr.a, pr.b, 'quarrels in the house: the marriage is cold');
      return;
    }
    if (pr.status === 'betrothed') return;
    if (pr.status === 'courting') {
      pr.weeks++;
      if (pr.aff < -0.05 || sa >= 0 || sb >= 0) { pr.status = 'none'; pr.cool = d + 7 * REL.rejectCooldownW; return; }
      if (pr.weeks >= REL.betrothWeeks && pr.aff >= REL.betrothAff && pr.trust >= REL.betrothTrust) this.families(pr, d, this.r(K, w, 2));
      return;
    }
    if (pr.status === 'lovers') { this.affairWeek(pr, K, w, d); return; }
    if (d < pr.cool || this.closeKin(pr.a, pr.b)) return;
    const wa = this.want(pr.a, pr.b, d, pr.fam), wb = this.want(pr.b, pr.a, d, pr.fam);
    // courting: both free, of an age to marry, mutual desire and liking
    if (opp && sa < 0 && sb < 0 && this.free(pr.a, d) && this.free(pr.b, d) && this.fits(woman.id, d) && this.fits(man.id, d)) {
      if (wa >= REL.courtDesire && wb >= REL.courtDesire && pr.aff >= REL.courtAff) { pr.status = 'courting'; pr.weeks = 0; pr.since = d; this.busy.add(pr.a); this.busy.add(pr.b); this.ev(d, 'court', pr, man.id, woman.id, 'they seek each other out: at the well, in the lane, at the feast'); return; }
    }
    // an advance to one who does not want it: a rejection (the advancer hurt, a little colder)
    const hi = wa >= wb ? pr.a : pr.b, lo = hi === pr.a ? pr.b : pr.a, wh = Math.max(wa, wb), wl = Math.min(wa, wb);
    if (wh >= REL.advanceDesire && wl < REL.rejectBelow && this.spouseOn(hi, d) < 0 && this.r(K, w, 3) < 0.004 * Math.log1p(h)) {
      pr.aff = cl(pr.aff - 0.12); pr.cool = d + 7 * REL.rejectCooldownW; this.ev(d, 'reject', pr, hi, lo, this.spouseOn(lo, d) >= 0 ? 'turned away: married, and not wanting it' : 'turned away: not wanting it'); return; }
    // lovers: mutual desire and familiarity; when one is married, a cold marriage (an affair). Different houses only
    if (wa >= REL.affairDesire && wb >= REL.affairDesire && pr.fam >= REL.affairFam && pr.aff >= 0.15 && this.homeOf(pr.a, d) !== this.homeOf(pr.b, d)) {
      const cold = (x: number, s: number) => s < 0 || (this.getPair(x, s)?.aff ?? 0) < REL.affairSpouseAff;
      if (!cold(pr.a, sa) || !cold(pr.b, sb)) return;
      const married = sa >= 0 || sb >= 0; if (!married && opp) return; // (two free people of the two sexes court instead)
      if (this.r(K, w, 4) >= REL.affairP * 0.1) return;
      pr.status = 'lovers'; pr.since = d; pr.discovered = false; this.ev(d, married ? 'affair' : 'lovers', pr, pr.a, pr.b, married ? 'lovers in secret: a cold marriage and a warm look' : 'lovers in secret (never a marriage)');
    }
  }
  private r(K: number, w: number, k: number) { return u01(this.seed, S.ev, K % 1e9, w, 10 + k); }
  private free(x: number, d: number) { const p = this.pop.persons[x]; return this.spouseOn(x, d) < 0 && !this.busy.has(x) && !(p.spouse !== undefined && p.marry > d); }
  private fits(x: number, d: number) { const a = this.pop.ageOn(x, d); return this.pop.persons[x].sex === 'f' ? a >= REL.bride[0] && a <= REL.bride[1] : a >= REL.groom[0] && a <= REL.groom[1]; }
  private families(pr: Pair, d: number, u: number) {
    const woman = this.sexOf(pr.a) === 'f' ? pr.a : pr.b, man = woman === pr.a ? pr.b : pr.a;
    const hw = this.homeOf(woman, d), hm = this.homeOf(man, d);
    const pA = cl(0.8 - 0.2 * Math.abs(this.rank(hw) - this.rank(hm)) + 0.5 * ((this.rep.get(woman) ?? 0) + (this.rep.get(man) ?? 0)) + 0.2 * pr.trust, 0.05, 0.95);
    if (u >= pA) { pr.status = 'none'; pr.cool = d + 7 * REL.rejectCooldownW; this.ev(d, 'refused', pr, man, woman, 'the families would not agree'); return; }
    pr.status = 'betrothed'; pr.since = d;
    const [a, b] = REL.weddingAfter; let wd = d + a + Math.floor(u01(this.seed, S.ev, pr.a, pr.b, d) * (b - a)); while (festivalOn(this.seed, wd)) wd++; pr.wedDay = wd;
    const e = this.ev(d, 'betroth', pr, man, woman, 'the families agree: a bride-gift to her house, a dowry to go with her');
    const gift = REL.bridewealth[this.wealth(hm)]; if (gift && hm !== hw) this.intent({ kind: 'trade', from: `h:${hm}`, to: `h:${hw}`, day: d, payload: { cash: gift, src: 'relations', what: 'bride-gift', ev: e.id } });
  }
  private wedding(pr: Pair) {
    const d = pr.wedDay, woman = this.sexOf(pr.a) === 'f' ? pr.a : pr.b, man = woman === pr.a ? pr.b : pr.a;
    if (!this.adult(woman, d) || !this.adult(man, d) || this.spouseOn(woman, d) >= 0 || this.spouseOn(man, d) >= 0) { pr.status = 'none'; return; }
    pr.status = 'married'; pr.since = d; pr.weeks = 0; this.marry(woman, man, d); this.ownWed.add(woman);
    const hw = woman === PLAYER ? this.homeOf(man, d) : this.homeOf(woman, d), hm = man === PLAYER ? hw : this.homeOf(man, d); // (the stranger has no house: he or she joins the spouse's)
    const e = this.ev(d, 'wed', pr, man, woman, 'married: she goes to his house with her dowry');
    if (man === PLAYER || woman === PLAYER) this.move(PLAYER, d, man === PLAYER ? hw : hm);
    else if (hm !== hw) { this.move(woman, d, hm); const dw = REL.dowry[this.wealth(hw)]; if (dw) this.intent({ kind: 'help', from: `h:${hw}`, to: `h:${hm}`, day: d, payload: { cash: dw, src: 'relations', what: 'dowry', ev: e.id } }); }
  }
  private divorce(pr: Pair, d: number) {
    const P = this.pop, woman = this.sexOf(pr.a) === 'f' ? pr.a : pr.b, man = woman === pr.a ? pr.b : pr.a;
    // whose fault: a discovered affair of hers sends her away without her dowry; his, or a cold house, costs him silver
    const hers = this.events.some(e => e.kind === 'discovered' && e.c === man && (e.a === woman || e.b === woman));
    pr.status = 'divorced'; pr.weeks = 0; this.unmarry(woman, man, d);
    const e = this.ev(d, 'divorce', pr, man, woman, hers ? 'he sends her away, without her dowry (found with another)' : 'the marriage is ended: she goes back to her kin with her dowry and the divorce silver');
    if (woman === PLAYER || man === PLAYER) return;
    const hNow = this.homeOf(woman, d), W = P.persons[woman], back = W.hh !== hNow ? W.hh : (P.households[hNow].kin[0] ?? -1);
    if (back >= 0 && P.households[back]) this.move(woman, d, back);
    if (!hers && back >= 0) this.intent({ kind: 'help', from: `h:${hNow}`, to: `h:${back}`, day: d, payload: { cash: REL.divorceSilver, src: 'relations', what: 'divorce silver', ev: e.id } });
    this.scandal(d, [man, woman], e.id, 'the divorce');
  }
  private affairWeek(pr: Pair, K: number, w: number, d: number) {
    const u = (k: number) => u01(this.seed, S.ev, K % 1e9, w, 30 + k), sa = this.spouseOn(pr.a, d), sb = this.spouseOn(pr.b, d);
    if (this.pop.sick(pr.a, d) || this.pop.sick(pr.b, d)) return;
    if (u(1) < 0.6) { pr.intimate++; pr.lastBed = w; for (const [x, y] of [[pr.a, pr.b], [pr.b, pr.a]]) if (x !== PLAYER && this.pop.persons[x].sex === 'f') (this.lovBed.get(x) ?? this.lovBed.set(x, []).get(x)!).push([w, y]); }
    // found out by a spouse: jealousy, the marriage wounded, the lover hated, and the talk begins
    for (const [x, s] of [[pr.a, sa], [pr.b, sb]]) { if (s < 0 || pr.discovered || s === PLAYER) continue;
      if (u(2 + x % 3) < REL.discoverP * (this.pop.households[this.homeOf(x, d)]?.q === this.pop.households[this.homeOf(x === pr.a ? pr.b : pr.a, d)]?.q ? 1.5 : 1)) this.discover(pr, x, s, d); }
    if (!pr.discovered && u(6) < REL.gossipP) { const e = this.ev(d, 'scandal', pr, pr.a, pr.b, 'seen together: whispered of'); this.scandal(d, [pr.a, pr.b], e.id, 'lovers seen together'); }
    if (pr.aff < 0.05 || u(7) < (pr.discovered ? 0.4 : 0.02)) { pr.status = 'none'; pr.cool = d + 7 * 20; this.ev(d, 'end_affair', pr, pr.a, pr.b, pr.discovered ? 'ended, after it was found out' : 'it cools and ends'); }
  }
  private discover(pr: Pair, x: number, s: number, d: number, how = 'the spouse finds them out') {
    if (!this.adult(s, d) || !this.adult(x, d)) return; // (a spouse under 18 is kept out of it: the user's rule)
    pr.discovered = true; const lover = x === pr.a ? pr.b : pr.a;
    const m = this.getPair(x, s); if (m) { m.aff = cl(m.aff - 0.5); m.trust = cl(m.trust - 0.7); }
    const j = lover === PLAYER ? this.ppair(s, d) : this.pair(s, lover, 'neighbour'); j.aff = cl(j.aff - 0.6); j.trust = cl(j.trust - 0.5);
    const e = this.ev(d, 'discovered', pr, x, lover, how, s); this.ev(d, 'jealous', m ?? null, s, x, 'jealous and shamed: found out a lover', lover, e.id);
    this.scandal(d, [x, lover], e.id, 'an affair found out');
  }
  // ---------------------------------------------------------------- intimacy and conception (a state; the renderer cuts away)
  private bed(w: number, d0: number, d: number) {
    const P = this.pop;
    for (const [pid, list] of this.wed) { const p = pid === PLAYER ? null : P.persons[pid]; if (!p || p.sex !== 'f') continue;
      const s = this.spouseOn(pid, d); if (s < 0 || !this.adult(pid, d) || !this.adult(s, d)) continue; void list;
      if (s !== PLAYER && (this.homeOf(s, d) !== this.homeOf(pid, d) || this.away(s, w))) continue;
      const pr = this.getPair(pid, s); if (!pr) continue; const pB = cl(0.3 + 0.35 * (pr.aff + 0.2) + 0.4 * Math.max(this.want(pid, s, d, pr.fam), this.want(s, pid, d, pr.fam)), 0.08, 0.95);
      if (u01(this.seed, S.bed, pid, w) < pB) { (this.bedWeeks.get(pid) ?? this.bedWeeks.set(pid, []).get(pid)!).push(w); pr.intimate++; pr.lastBed = w; this.stats.bedWeeks++; } }
    // conception: this layer's couples and lovers (the population draws the births of its own wives; those are given fathers)
    for (const src of [this.bedWeeks, this.lovBed]) for (const [pid, ws] of src) {
      const last = ws[ws.length - 1]; const wk = Array.isArray(last) ? last[0] : last; if (wk !== w) continue;
      const p = P.persons[pid]; if ((src === this.bedWeeks && (p.wife || !this.ownWed.has(pid))) || this.pregBy.has(pid) || P.dueOwn(pid) !== undefined || P.ageAt(pid, d) < REL.adult) continue; // (a wife's child by her husband is the population's draw; by a lover, this layer's)
      const a = P.ageOn(pid, d); let f = 0; for (const [ag, v] of REL.fecundAge) if (a >= ag) f = v;
      const nursing = P.childrenOf(pid).some(c => P.present(c, d) && P.ageOn(c, d) < 1) ? REL.nursing : 1;
      if (u01(this.seed, S.conc, pid, w) >= REL.fecund * f * nursing * 7 / 29.5 * 1.6) continue;
      const father = Array.isArray(last) ? (last as [number, number])[1] : this.spouseOn(pid, d);
      const others = this.partnersAround(pid, w).filter(x => x !== father);
      const pg: Pregnancy = { mother: pid, father, doubt: others, conceived: d, due: d + REL.gestationDays, pop: false }; this.pregBy.set(pid, pg); this.pregnancies.push(pg);
      const pr = this.getPair(pid, father) ?? null; const e = this.ev(d, 'conceive', pr, pid, father, others.length ? 'with child; who the father is, is in doubt' : 'with child', others[0]);
      if (others.length) this.ev(d, 'doubt', pr, pid, father, 'the child may be another’s', others[0], e.id);
      // an unmarried woman with child: the talk comes when it shows (four months), and her lover's family is pressed
      if (this.spouseOn(pid, d) < 0 && d + 120 < REGNAL_DAYS) { this.pendingShow.push([d + 120, pid, e.id]); }
    }
    // the population's own pregnancies conceived this week: a lover in her bed then makes the child's father doubtful
    for (const [pid, ws] of this.lovBed) { const due = P.dueOwn(pid); if (due === undefined || this.pregBy.has(pid)) continue; const cd = due - REL.gestationDays; if (cd < d0 || cd > d0 + 6 || !ws.some(([x]) => Math.abs(x - w) <= 2)) continue;
      const hus = this.spouseOn(pid, cd), around = this.partnersAround(pid, w); const lov = around.filter(y => y !== hus); if (!lov.length) continue;
      const e = this.ev(cd, 'doubt', this.getPair(pid, lov[0]) ?? null, pid, lov[0], hus >= 0 && around.includes(hus) ? 'with child: her husband’s, or her lover’s' : 'with child while her husband was away: the lover’s', hus >= 0 ? hus : undefined); void e; }
    for (const [x, pid, cause] of this.pendingShow) if (x >= d0 && x < d0 + 7) this.scandal(x, [pid], cause, 'with child and unmarried');
  }
  private partnersAround(pid: number, w: number) { const out = new Set<number>(); for (const x of this.bedWeeks.get(pid) ?? []) if (Math.abs(x - w) <= 2) out.add(this.spouseOn(pid, x * 7 + 3)); for (const [x, y] of this.lovBed.get(pid) ?? []) if (Math.abs(x - w) <= 2) out.add(y); out.delete(-1); return [...out]; }
  /** the due day of this layer's pregnancy of a woman conceived by day d (the population asks: dueIn); pure: the weeks up to d
   *  are simulated first (not while they are being simulated: then the state so far) */
  dueOf(pid: number, d: number): number | undefined { if (!this.stepping) this.advance(d); const g = this.pregBy.get(pid); return g && g.conceived <= d ? g.due : undefined; }
  private stepping = false;
  /** the population's births of the year, each given its father from who shared the mother's bed around conception (266 days
   *  before), with the doubt where a lover did too; before the year: the husband's (run after advance(353)) */
  fathers(): { child: number; mother: number; father: number; doubt: number[]; conceived: number }[] {
    this.ensure();
    const P = this.pop, out: { child: number; mother: number; father: number; doubt: number[]; conceived: number }[] = [];
    const born: [number, number, number][] = []; // [child (-1: not yet born), mother, day]
    for (let x = 0; x < REGNAL_DAYS; x++) for (const c of P.lifeOn(x).births) { const m = P.persons[c].mother; if (m >= 0) born.push([c, m, x]); }
    for (const p of P.persons) if (p.sex === 'f') { const due = P.dueOwn(p.id); if (due !== undefined && due >= REGNAL_DAYS && !this.pregBy.has(p.id)) born.push([-1, p.id, due]); } // (the next year's, conceived in this one)
    for (const [c, m, x] of born) { const cd = x - REL.gestationDays, w = Math.floor(cd / 7);
      const husband = this.spouseOn(m, Math.max(0, cd)); const around = cd >= 0 ? this.partnersAround(m, w) : []; const lov = around.filter(y => y !== husband);
      const father = lov.length && !around.includes(husband) ? lov[0] : husband; out.push({ child: c, mother: m, father, doubt: lov.filter(y => y !== father).concat(father !== husband && husband >= 0 ? [husband] : []), conceived: cd }); }
    return out;
  }
  /** the population's birth draw weight for a wife (PopOpts.fertility: the one hook): her weeks of intimacy with a husband who
   *  is at home, against the mean over the wives (1 keeps the rate); 0 once widowed or divorced */
  fertility(): (pid: number) => number {
    this.ensure();
    const P = this.pop, wv = new Map<number, number>(); let sum = 0, n = 0;
    for (const p of P.persons) if (p.wife) { const ws = this.wed.get(p.id), last = ws?.[ws.length - 1]; const v = !last ? -1 : last[1] < 1e9 && p.dies !== last[1] ? 0 : (this.bedWeeks.get(p.id)?.length || -1); wv.set(p.id, v); if (v > 0) { sum += v; n++; } }
    const mean = n ? sum / n : 1; return (pid: number) => { const v = wv.get(pid); return v === undefined || v < 0 ? 1 : v / mean; }; // (a wife this layer does not model, a husband not found or a wife under 18: the population's own rate)
  }
  // ---------------------------------------------------------------- scandal as news
  private scandal(d: number, about: number[], ev: number, what: string) {
    const n: News = { id: this.news.length, day: d, about, ev, what, knows: new Map(), front: [], hand: [] };
    for (const x of about) if (x !== PLAYER) { n.knows.set(x, 0); n.front.push(x); n.hand.push(0); } this.news.push(n);
    for (const x of about) if (x !== PLAYER) this.rep.set(x, (this.rep.get(x) ?? 0) - 0.1);
  }
  private spread(w: number, d: number) {
    const lovers = [...this.pairs.values()].filter(pr => pr.status === 'lovers' && !pr.discovered);
    for (const n of this.news) { if (!n.front.length || n.day > d + 3) continue; const front = n.front, hand = n.hand; n.front = []; n.hand = [];
      for (let i = 0; i < front.length; i++) { const x = front[i], hx = hand[i]; if (hx >= REL.tellP.length || !this.adult(x, d)) continue;
        for (const y of this.contacts.get(x) ?? []) { if (n.knows.has(y) || n.knows.size > 600 || !this.adult(y, d)) continue;
          if (u01(this.seed, S.news, n.id, x, y) >= REL.tellP[hx] * (n.about.includes(x) ? 0.15 : 1)) continue; // (the ones it is about tell little)
          n.knows.set(y, hx + 1); n.front.push(y); n.hand.push(hx + 1); this.stats.newsTold++;
          if (n.knows.size <= 4) { const hy = this.homeOf(y, d), hx2 = this.homeOf(x, d); if (hy !== hx2) this.intent({ kind: 'news', from: `h:${hx2}`, to: `h:${hy}`, day: d, payload: { src: 'relations', what: n.what, ev: n.ev } }); }
          // a betrayed spouse who hears it: found out by talk
          for (const pr of lovers) if (pr.status === 'lovers' && !pr.discovered && n.about.includes(pr.a) && n.about.includes(pr.b)) for (const z of [pr.a, pr.b]) if (this.spouseOn(z, d) === y) this.discover(pr, z, y, d, 'the spouse hears the talk');
          const k = this.getPair(x, y); if (k) k.trust = cl(k.trust + 0.01); for (const z of n.about) { const q = this.getPair(y, z); if (q) q.aff = cl(q.aff - 0.04); } } } }
    void w;
  }

  // ================================================================ the player (for the GPU and speech pass)
  /** the player's act on a person, entered in the ledger (replayed identically); intimacy is a state and a cut-away */
  act(pid: number, day: number, act: PlayerAct): ActResult {
    this.ensure();
    const W = Math.floor(day / 7); // (acts of one week apply at its end in the order they were made, live and in replay)
    if (this.week > W) { const led = this.ledger.map(l => ({ day: l.day, pid: l.pid, act: l.act })); this.reset(); this.ledger = led; } // (asked in the past: replay)
    this.advance(day); const L: Ledger = { day, pid, act }; this.ledger.push(L); if (this.week === W) L.res = this.apply(L); else this.advance(day); return L.res!;
  }
  private apply(L: Ledger): ActResult {
    const { pid, day: d, act } = L, P = this.pop;
    if (!P.persons[pid] || !P.present(pid, d)) return { ok: false, why: 'not here' };
    if (P.ageOn(pid, d) < REL.adult && !['talk', 'gift', 'help', 'slight'].includes(act)) return { ok: false, why: 'too young: never' };
    const pr = this.ppair(pid, d);
    const minor = P.ageOn(pid, d) < REL.adult, wantP = minor ? 0 : this.want(pid, PLAYER, d, pr.fam), mine = this.spouseOn(pid, d);
    const bump = (fa: number, af: number, tr: number) => { pr!.fam = cl(pr!.fam + fa, 0, 1); pr!.aff = cl(pr!.aff + af); pr!.trust = cl(pr!.trust + tr); };
    const res = (ok: boolean, why: string, kind?: EvKind, extra: Partial<ActResult> = {}) => { if (kind) this.ev(d, kind, pr!, PLAYER, pid, why); return { ok, why, ...extra }; };
    switch (act) {
      case 'talk': bump(0.04, 0.03 * (2 * u01(this.seed, S.pl, pid, 1) - 0.5), 0.02); return res(true, 'talked a while', 'kind');
      case 'gift': bump(0.02, 0.08, 0.04); return res(true, 'was given a gift', 'gift');
      case 'help': bump(0.03, 0.1, 0.12); return res(true, 'was helped in need', 'help');
      case 'slight': bump(0.01, -0.2, -0.15); return res(true, 'was slighted', 'slight');
      case 'court': {
        if (mine >= 0) return res(false, 'married: turns the courting aside', 'reject');
        if (wantP < REL.courtDesire * 0.7 || pr.aff < 0) { pr.cool = d + 60; return res(false, 'not wanting it: turned away', 'reject'); }
        pr.status = 'courting'; pr.weeks = 0; bump(0.05, 0.05, 0.02); return res(true, 'courted, and willing', 'court'); }
      case 'propose': {
        if (pr.status !== 'courting' || mine >= 0) return res(false, 'there is nothing agreed to build on');
        if (pr.aff < REL.betrothAff || pr.trust < REL.betrothTrust) return res(false, 'not yet: she or he does not know you well enough', 'reject');
        const pA = cl(0.4 + (this.rep.get(PLAYER) ?? 0) + 0.3 * pr.trust, 0.05, 0.9); // (a stranger has no house to answer for him: the families are slow to agree)
        if (u01(this.seed, S.pl, pid, d) >= pA) { pr.status = 'none'; pr.cool = d + 90; return res(false, 'the family would not agree', 'refused'); }
        pr.status = 'betrothed'; pr.wedDay = d + REL.weddingAfter[0]; return res(true, 'the families agree', 'betroth', { weddingDay: pr.wedDay }); }
      case 'take_lover': {
        if (wantP < REL.affairDesire || pr.aff < 0.15 || pr.fam < 0.15) return res(false, 'not wanting it: turned away', 'reject');
        pr.status = 'lovers'; pr.since = d; return res(true, mine >= 0 ? 'lovers in secret (she or he is married: the risk is theirs and yours)' : 'lovers in secret', mine >= 0 ? 'affair' : 'lovers'); }
      case 'share_bed': {
        const s = pr.status; if (s !== 'married' && s !== 'lovers') return res(false, 'no: there is nothing between you for that', 'reject');
        if (P.sick(pid, d) || P.mourning(pid, d) || pr.aff < 0.05 || wantP < 0.12) return res(false, 'not tonight', undefined);
        pr.intimate++; pr.lastBed = Math.floor(d / 7); bump(0.02, 0.04, 0.03);
        if (P.persons[pid].sex === 'f') (this.lovBed.get(pid) ?? this.lovBed.set(pid, []).get(pid)!).push([Math.floor(d / 7), PLAYER]);
        return res(true, 'the night together (cut away)', 'intimate', { cutAway: true }); }
      case 'share_home': { if (pr.status !== 'married') return res(false, 'not married'); this.move(PLAYER, d, this.homeOf(pid, d)); return res(true, 'the stranger lives in the house now', 'kind'); }
      case 'leave': { if (pr.status === 'married') { this.divorce(pr, d); return { ok: true, why: 'the marriage is ended' }; } if (pr.status !== 'none') { pr.status = 'none'; bump(0, -0.3, -0.3); return res(true, 'left', 'slight'); } return { ok: false, why: 'nothing to leave' }; }
    }
    return { ok: false, why: 'unknown' };
  }
  /** the player's wedding follows the betrothal on its day (called from the week's weddings via the pair's status) */
  // ---------------------------------------------------------------- reading for talk and the renderer
  /** a person's own memory of the player (or of anyone): the dated things between them and how each felt */
  memoryOf(pid: number, of = PLAYER): { day: number; what: string; kind: EvKind; aff: number }[] {
    this.ensure();
    return (this.moodEv.get(pid) ?? []).map(i => this.events[i]).filter(e => e.a === of || e.b === of || e.c === of).map(e => ({ day: e.day, what: e.why, kind: e.kind, aff: e.s.aff }));
  }
  /** a person's mood from what has happened to them in the last four weeks, else from the marriage (C) */
  moodOf(pid: number, d: number): { mood: string; cause?: number } {
    this.ensure();
    const M: Partial<Record<EvKind, string>> = { reject: 'hurt', refused: 'bitter', court: 'hopeful', betroth: 'hopeful', wed: 'content', wed_arranged: 'uncertain', affair: 'secretive', lovers: 'secretive',
      discovered: 'ashamed', slight: 'hurt', gift: 'warm', help: 'grateful', intimate: 'tender', kind: 'at ease', jealous: 'jealous', divorce: 'grieving', widowed: 'grieving', conceive: 'expectant', doubt: 'anxious', scandal: 'ashamed', end_affair: 'low' };
    const ids = this.moodEv.get(pid) ?? []; for (let i = ids.length - 1; i >= 0; i--) { const e = this.events[ids[i]]; if (e.day > d) continue; if (d - e.day > 28) break; let m = M[e.kind]; if (!m) continue;
      if (e.kind === 'reject' && e.b === pid) m = 'relieved'; if (e.kind === 'jealous' && e.a !== pid) m = 'guilty'; if (e.kind === 'discovered' && e.c === pid) m = 'betrayed'; return { mood: m, cause: e.id }; }
    const s = this.spouseOn(pid, d), pr = s >= 0 ? this.getPair(pid, s) : undefined; if (!pr) return { mood: 'even' };
    return { mood: pr.aff > 0.4 ? 'content' : pr.aff < -0.1 ? 'unhappy' : 'even' };
  }
  /** the player has acted (only then is there anything to save) */
  get acted() { return this.ledger.length > 0; }
  save() { return { ledger: this.ledger.map(l => ({ day: l.day, pid: l.pid, act: l.act })) }; }
  load(s: { ledger?: { day: number; pid: number; act: PlayerAct }[] } | undefined) { this.reset(); this.ledger = (s?.ledger ?? []).map(l => ({ ...l })); }
  /** counts of the year's events (the test's measure) */
  counts() { this.ensure(); const c: Record<string, number> = {}; for (const e of this.events) c[e.kind] = (c[e.kind] ?? 0) + 1; return c; }
}
