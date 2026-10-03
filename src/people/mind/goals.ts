// D-461 (UD-32: "an actual brain in every npc in a sandbox world ... with or without the player"): GOALS. What a person sets
// out to do over days and months, born from their own state and pursued step by step through the deeds (deeds/engine.ts, the
// same judge as the stranger's) and the day plans (the deeds' overlay), changed and ended by what happens:
//   care        a parent, a spouse or a child lies sick: tending at home of an evening, the healer fetched, prayers; ends with
//               the recovery, or with the death (grief; the devout then vow an offering);
//   debt        the house owes silver: days of hired work in a richer house (paid: the economy's cash), kin asked for a loan
//               when the day is near; ends when the economy's own reckoning finds the debt paid, or with the default;
//   bridegift   a young man unmarried: days of hired work put by toward a bride-gift; done, he looks for a wife;
//   dowry       a father or mother with a daughter of age: work and stores put by; done, the daughter's match is sought;
//   spouse      a match sought: a kinsman introduces, visits to the house, gifts, courting; the other's own mind and their
//               house's trust decide; a betrothal sets the wedding in the population (Population.addWedding), a month or two on;
//   work        a better place: visits and unpaid help to a master (a craftsman, a steward, a storekeeper ...); taken on, he
//               works for the master two days a week, paid, for the rest of the year (in his day plan);
//   patron      the favour of a man who counts (the quarter's elder, an official, a steward): gifts, praise, help; won, the
//               patron helps the house (silver toward its debt) or speaks for it (trust);
//   revenge     a grievance held: the wrong told to friends, a complaint to the elder, insults, damage, a blow; ends when the
//               elder fines the other or the wrong is paid back, or when the anger cools;
//   reconcile   a quarrel with kin or a friend: a friend asked to plead, an apology, a gift, peace made;
//   pilgrimage  a devout person in trouble or in thanks: an offering vowed and saved for, then a morning at the offering place;
//   teach       a father with a son (a mother with a daughter) of eleven to fifteen: lessons in the work, at the work;
//   repair      the house mended before the rains (the late summer) or rebuilt after a fire: neighbours and kin asked to help,
//               mornings of brick-making at home;
//   kinvisit    a day's visit to kin in another house (a new child there, or long unseen): an afternoon at their house;
//   leave       a young person with nothing to hold them (a house bound for debt, a match refused twice, a foreigner homesick):
//               farewells to friends, then gone for good (Population.deedLeave), to Šušan, Babylon or home.
// Every step is a deed or a laid stretch of the day with its reason in words ("visiting Arta: to ask for his daughter"), so a
// player who follows someone sees the intention play out. Pure given the seed and the state; saved small (active goals only).
// Tier C throughout: the kinds, the odds and the paces are this module's reading of a Persian royal town's lives (D-461).
import type { Population, Seg } from '../population';
import { segAt } from '../population';
import { personaOf } from '../persona';
import { REGNAL_DAYS, dateOf } from '../calendar';
import { u01, salt } from '../hash';
import type { Deed } from '../deeds/types';
import type { DeedWorld } from '../deeds/engine';
import type { ActivityId } from '../activities';

const S = { form: salt('goal-form'), step: salt('goal-step'), pick: salt('goal-pick') };
export type GoalKind = 'care' | 'debt' | 'bridegift' | 'dowry' | 'spouse' | 'work' | 'patron' | 'revenge' | 'reconcile' | 'pilgrimage' | 'teach' | 'leave' | 'repair' | 'kinvisit';
export const KINDS: GoalKind[] = ['care', 'debt', 'bridegift', 'dowry', 'spouse', 'work', 'patron', 'revenge', 'reconcile', 'pilgrimage', 'teach', 'leave', 'repair', 'kinvisit'];
export interface Goal {
  id: number; pid: number; kind: GoalKind;
  /** the person it is about (the sick, the one courted, the master, the enemy, the son), -1 none */ who: number;
  born: number; until: number; next: number;
  /** progress 0..1 (savings, lessons) and the steps taken, the steps that failed */ prog: number; n: number; fails: number;
  /** what started it, in words, and its source: 'deed:<log id>', 'goal:<id>', 'life', 'econ', 'aim', 'mind' */ why: string; cause: string;
  /** how deep in a chain of causes (1: born of the person's state alone) */ depth: number;
  /** the work it is about, read once (teach: the father's work and its place) */ act?: ActivityId; place?: string;
  /** the house it was born in (the index of the houses' goals) */ hh?: number;
  /** the end: the day, how, why */ end?: number; out?: 'achieved' | 'abandoned'; endWhy?: string;
}
/** what the goals need of the world beyond the deed engine (initiative.ts gives it) */
export interface GoalHost {
  mood(pid: number, day: number, v: number, word: string): void;
  depthOfDeed(id: number): number;
  /** a goal born inside another's step (a chain): counted as formed */
  formed(g: Goal): void;
}
const CRAFT_ACTS = new Set<ActivityId>(['craft', 'weave', 'spin', 'smith', 'work_wood', 'field_work', 'plough', 'reap', 'herd', 'tend_animals', 'garden_work', 'polish_metal', 'goldsmith', 'cut_seal', 'tan', 'press_oil', 'brew', 'mould_brick', 'write_tablet', 'fish', 'pick_fruit', 'irrigate', 'thresh', 'shear', 'milk', 'bake', 'grind', 'knead']);
/** the trades worked at home or in the house's own workshop, when no plan says otherwise (C) */
const HOME_TRADE: Partial<Record<string, ActivityId>> = { craftsman: 'craft', weaver: 'weave', homemaker: 'spin', brewer: 'brew', miller: 'grind' };
const MASTERS = new Set(['craftsman', 'steward', 'official', 'storekeeper', 'brewer', 'miller', 'scribe', 'treasury']);
const LOWJOBS = new Set(['porter', 'servant', 'camp', 'builder']);
const NOTABLE = new Set(['elder', 'official', 'steward']);
/** a day's hired work: a thirtieth of a shekel (D-455: the hired man's shekel a month; B for Babylonia, C for Pārsa) */
const WAGE = 1 / 30;
/** where a leaver goes, by their origin (C) */
const DEST: Record<string, string> = { Babylonian: 'Babylon', Elamite: 'Šušan', Egyptian: 'Egypt', Lydian: 'Sardis', Ionian: 'Sardis', Bactrian: 'Bactra', Arachosian: 'Arachosia', Median: 'Hagmatāna', Persian: 'Šušan', Syrian: 'Babylon', Carian: 'Sardis', Cappadocian: 'Sardis' };
const cl = (x: number, a = 0, b = 1) => x < a ? a : x > b ? b : x;

export class Goals {
  /** the goals being pursued (by id) and each person's */
  readonly active = new Map<number, Goal>();
  private byPid = new Map<number, number[]>();
  /** the last goals ended (for the brief, the talk and the tests; not saved beyond the last 60) */
  readonly ended: Goal[] = [];
  /** the places won (work): the man works for the master two days a week, paid, to the end of the year */
  readonly places = new Map<number, { master: number; act: ActivityId; place: string; days: [number, number]; from: number; goal: number }>();
  /** the weddings the minds arranged (bride, groom, the day, the house): put into the population again on a load */
  readonly weds: [number, number, number, number][] = [];
  /** the people who left (pid, the day): the same on a load */
  readonly left: [number, number][] = [];
  /** what each person was taught (a measure) */
  readonly learned = new Map<number, ActivityId>();
  /** per kind: formed, achieved, abandoned (a measure) */
  readonly stats: Record<string, [number, number, number]> = Object.fromEntries(KINDS.map(k => [k, [0, 0, 0]]));
  /** everyone who has held a goal this year (a measure; not saved) */
  readonly ever = new Set<number>();
  /** depth of each goal (ended or not; for the chains) */
  readonly depth = new Map<number, number>();
  private nextId = 0; private byQ: Map<string, number[]> | null = null;
  private k = 0;
  constructor(readonly W: DeedWorld, readonly host: GoalHost) {}
  private get P(): Population { return this.W.w.pop; }
  private E(day: number) { return this.W.w.econ(day); }

  // ------------------------------------------------------------------ reading the person
  name(pid: number) { return (this.P.nameOf(pid) ?? 'someone').replace(/^\*/, ''); }
  of(pid: number): Goal[] { return (this.byPid.get(pid) ?? []).map(i => this.active.get(i)!).filter(Boolean); }
  /** a goal of revenge or of peace pursues this pair (minds.ts leaves its daily anger to it) */
  holds(a: number, b: number) { const l = this.byPid.get(a); return !!l && l.some(i => { const g = this.active.get(i); return !!g && g.who === b && (g.kind === 'revenge' || g.kind === 'reconcile'); }); }
  private here(pid: number, day: number) { const p = this.P.persons[pid]; return !!p && p.dies > day && this.P.present(pid, day); }
  private hid(pid: number, day: number) { return this.P.home(pid, day); }
  private eh(pid: number, day: number) { return this.E(day)?.hh.get(`h:${this.hid(pid, day)}`) ?? null; }
  private zoneOk(pid: number, day: number) { const z = this.P.households[this.hid(pid, day)]?.zone; return z === 'town' || z === 'plain'; }
  private members(pid: number, day: number) { const P = this.P; return P.households[this.hid(pid, day)]?.members.filter(m => m !== pid && this.here(m, day) && P.home(m, day) === this.hid(pid, day)) ?? []; }
  /** the head of a house: the eldest man present, else the eldest grown woman */
  head(hid: number, day: number): number { const P = this.P, ms = P.households[hid]?.members.filter(m => this.here(m, day) && P.home(m, day) === hid && P.ageOn(m, day) >= 16) ?? [];
    ms.sort((a, b) => (P.persons[a].sex === 'm' ? 0 : 1) - (P.persons[b].sex === 'm' ? 0 : 1) || P.ageOn(b, day) - P.ageOn(a, day) || a - b); return ms[0] ?? -1; }
  private kin(a: number, b: number) { const A = this.P.persons[a], B = this.P.persons[b]; return A.mother === b || B.mother === a || (A.mother >= 0 && A.mother === B.mother) || A.spouse === b || B.spouse === a; }
  private unwed(pid: number, day: number) { const p = this.P.persons[pid]; if (p.marry < 1e9 || p.spouse !== undefined || this.weds.some(w => w[0] === pid || w[1] === pid)) return false;
    return p.sex === 'f' ? !p.wife && (p.kin === 'daughter' || !!p.single) : (p.kin === 'son' || !!p.single) && this.P.ageOn(pid, day) >= 18; }
  private quarter(pid: number, day: number): number[] { const P = this.P;
    if (!this.byQ) { this.byQ = new Map(); for (const H of P.households) if (H.zone === 'town' || H.zone === 'plain') (this.byQ.get(H.q) ?? this.byQ.set(H.q, []).get(H.q)!).push(H.id); }
    return this.byQ.get(P.households[this.hid(pid, day)]?.q ?? '') ?? []; }
  private u(id: number, day: number, k: number) { return u01(this.W.w.seed, S.step, id, day, k); }
  /** a person's work and its place, with no plan built for it (a base plan is 1.5 to 70 ms when its house is fresh): the plan
   *  if the planner has built today's or yesterday's, else the trade worked at home (C), else null */
  private workOf(pid: number, day: number): { act: ActivityId; place: string } | null {
    for (const d of [day, day - 1]) { const b = this.P.planIfBuilt(pid, d); if (b) { const s = segAt(b, 10); if (s.act !== 'sleep') return { act: s.act, place: s.place }; } }
    const P = this.P, job = P.persons[pid].job, a = HOME_TRADE[job]; if (a) return { act: a, place: `h:${this.hid(pid, day)}` };
    if (job === 'farmer' || job === 'gardener') { const T = P.ptask(this.hid(pid, day), day, P.cal.ctx(day)); return T ? { act: T.act, place: T.place } : { act: 'garden_work', place: `h:${this.hid(pid, day)}` }; }
    return null; }
  /** a master's or employer's work and its place, read once a month */
  private bossAt = new Map<number, { act: ActivityId; place: string; day: number }>();
  // (D-651: read on the first day of the person's own 30-day window, not on the day first asked: a loaded world asked first on
  // another day and its people helped at other work, the save/load round trip)
  private bossWork(pid: number, day: number) { const d0 = Math.max(0, day - (day + pid) % 30), c = this.bossAt.get(pid); if (c && c.day === d0) return c; const s = this.workOf(pid, d0), v = { act: s?.act ?? 'carry_sack', place: s?.place ?? `h:${this.hid(pid, d0)}`, day: d0 };
    if (this.bossAt.size > 5000) this.bossAt.clear(); this.bossAt.set(pid, v); return v; }

  // ------------------------------------------------------------------ forming: a person's state gives rise to a goal
  /** consider one person on a day (the daily slice: each person comes round every ten days or so): a goal formed, or null */
  consider(pid: number, day: number): Goal | null {
    const P = this.P, p = P.persons[pid]; if (!this.here(pid, day)) return null;
    const age = P.ageOn(pid, day); if (age < 14 || p.agent >= 0) return null;
    const mine = this.of(pid); if (mine.length >= 2) return null;
    const has = (k: GoalKind, who = -2) => mine.some(g => g.kind === k && (who === -2 || g.who === who));
    const u = (k: number) => u01(this.W.w.seed, S.form, pid, day, k), town = this.zoneOk(pid, day), mem = town ? this.members(pid, day) : [];
    // care: one of the house's own lies sick (a parent, a spouse, a child), and no one else of the house has taken it on
    if (town && age >= 14) for (const m of mem) if (P.sick(m, day) && (this.kin(pid, m) || P.ageOn(m, day) < 12) && !this.houseHas(m, 'care', day) && u(1) < 0.6)
      return this.make(pid, 'care', m, day, 40, `${this.name(m)} lies sick`, 'life');
    // a grievance or a quarrel held (the minds' feelings): peace with kin and friends, else getting even, for the hot and proud
    for (const s of this.W.minds.strongest(pid, day, 2)) { if (typeof s.other !== 'number' || !this.here(s.other, day) || has('revenge', s.other) || has('reconcile', s.other)) continue;
      if (s.f.anger <= 0.25) continue; const rest = this.W.minds.rest(pid, s.other, day), cause = this.lastDeedBy(pid, s.other);
      if (rest.aff >= 0.3 && u(2) < 0.5) return this.make(pid, 'reconcile', s.other, day, 60, `a quarrel with ${this.name(s.other)}`, cause >= 0 ? `deed:${cause}` : 'mind');
      if (s.f.anger <= 0.35 || rest.aff >= 0.3) continue; const pe = personaOf(P, pid, day);
      if (pe.temper + pe.pride <= 0.95 && pe.warmth > 0.5 && u(14) < 0.25) return this.make(pid, 'reconcile', s.other, day, 60, `bad blood with ${this.name(s.other)}`, cause >= 0 ? `deed:${cause}` : 'mind');
      if (s.f.anger > 0.45 && pe.temper + pe.pride > 0.95 && u(3) < 0.55) return this.make(pid, 'revenge', s.other, day, 90, `a wrong done by ${this.name(s.other)}`, cause >= 0 ? `deed:${cause}` : 'mind'); }
    const eh = town ? this.eh(pid, day) : null, isHead = town && this.head(this.hid(pid, day), day) === pid;
    // the house's debt: the head takes it on
    if (eh && isHead && eh.debts.some(d => d.amt > 0.05) && !this.houseHas(pid, 'debt', day) && u(4) < 0.5) {
      const d = eh.debts.filter(x => x.amt > 0.05).sort((a, b) => a.due - b.due)[0];
      return this.make(pid, 'debt', -1, day, Math.max(day + 10, d.due + 3) - day, d.to === 'treasury' ? 'what the house owes the king\'s treasury' : 'the house\'s debt', 'econ'); }
    // marriage: a young man's bride-gift and match; a daughter's dowry and match (C: the families arrange, the young court)
    if (town && p.sex === 'm' && age >= 19 && age <= 32 && this.unwed(pid, day) && !has('bridegift') && !has('spouse') && u(5) < 0.008)
      return (eh && eh.cash > 1.2) || age >= 26 ? this.make(pid, 'spouse', -1, day, 240, 'of an age to marry', 'aim') : this.make(pid, 'bridegift', -1, day, 200, 'of an age to marry, and no bride-gift put by', 'aim');
    if (town && age >= 34) for (const m of mem) { const q = P.persons[m]; if (q.sex === 'f' && q.mother === pid && P.ageOn(m, day) >= 16 && P.ageOn(m, day) <= 24 && this.unwed(m, day) && !this.houseHas(m, 'dowry', day) && !this.of(m).some(g => g.kind === 'spouse') && u(6) < 0.02)
      return this.make(pid, 'dowry', m, day, 180, `${this.name(m)} is of an age to marry`, 'aim'); }
    if (town && p.sex === 'f' && age >= 17 && age <= 26 && this.unwed(pid, day) && !has('spouse') && u(7) < 0.004) return this.make(pid, 'spouse', -1, day, 240, 'of an age to marry', 'aim');
    // a better place: the low-paid and a landless son, or a house short of silver
    if (town && p.sex === 'm' && age >= 16 && age <= 40 && u(8) < 0.02 && !this.places.has(pid) && !has('work')) { const low = LOWJOBS.has(p.job) || (p.kin === 'son' && age >= 18 && (p.job === 'farmer' || p.job === 'gardener')), short = !low && this.W.minds.ctx.need(pid, day).cash > 0.6;
      if (low || short) return this.make(pid, 'work', -1, day, 120, short ? 'the house short of silver' : 'a poor place', short ? 'econ' : 'aim'); }
    // a patron: a head of house in trouble, or a proud man who wants to rise
    if (isHead && age >= 25 && age <= 60 && !has('patron') && u(9) < 0.03) { const trouble = (eh?.debts.length ?? 0) > 0 || (eh?.bound.some(b => !b.done) ?? false) || this.W.cases.some(c => c.accused === pid && !c.ruled);
      if (trouble || (u(13) < 0.3 && personaOf(P, pid, day).pride > 0.72)) return this.make(pid, 'patron', -1, day, 150, trouble ? 'the house in trouble' : 'wanting to rise', trouble ? 'econ' : 'aim'); }
    // the work groups' people: the favour of the group's head (the chief of the gang, the head of the file: C)
    if (!town && p.group >= 0 && age >= 20 && !has('patron') && u(15) < 0.012) { const hd = P.groups[p.group]?.head ?? -1; if (hd >= 0 && hd !== pid && this.here(hd, day)) return this.make(pid, 'patron', hd, day, 120, 'wanting a better lot in the group', 'aim'); }
    // teaching the work: a father with a son (a mother with a daughter) of eleven to fifteen at home
    if (town && age >= 28 && !has('teach')) for (const m of mem) { const q = P.persons[m], a = P.ageOn(m, day); if (q.mother !== pid && P.persons[q.mother]?.spouse !== pid && !(p.sex === 'm' && q.mother >= 0 && P.home(q.mother, day) === this.hid(pid, day))) continue;
      if (a < 11 || a > 15 || q.sex !== p.sex || this.learned.has(m) || u(10) >= 0.02) continue; const at = this.workOf(pid, day); if (!at || !CRAFT_ACTS.has(at.act)) continue;
      const g = this.make(pid, 'teach', m, day, 180, `${this.name(m)} old enough to learn the work`, 'aim'); g.act = at.act; g.place = at.place; return g; }
    // an offering vowed: the devout, in trouble (sickness, a death, a birth to come) or after a good thing
    if (age >= 16 && !has('pilgrimage') && u(11) < 0.035) { const why = P.mourning(pid, day) ? 'the dead of the house' : mem.some(m => P.sick(m, day)) ? 'the sick of the house' : (P.dueIn(pid, day) ?? -1) > 0 ? 'the birth to come' : this.ended.some(g => g.pid === pid && g.out === 'achieved' && day - (g.end ?? 0) < 20) ? 'thanks for a good thing' : '';
      if (why && personaOf(P, pid, day).piety > 0.68) return this.make(pid, 'pilgrimage', -1, day, 45, why, 'life'); }
    // the house mended: rebuilt after a fire, or the roof and walls before the rains (late summer: C)
    if (eh && isHead) { const fire = eh.lastFire > day - 20 && eh.lastFire <= day, m = dateOf(day).month;
      if (((fire && u(16) < 0.8) || ((m === 5 || m === 6) && u(16) < 0.03)) && !this.houseHas(pid, 'repair', day)) return this.make(pid, 'repair', -1, day, 45, fire ? 'the house burnt' : 'the roof and walls before the rains', fire ? 'econ' : 'aim'); }
    // a visit to kin in another house: a child born there, or long unseen
    if (town && age >= 16 && !has('kinvisit') && u(17) < 0.007) { const H = P.households[this.hid(pid, day)], ks = (H.kin ?? []).filter(k => k !== H.id && P.households[k] && ['town', 'plain'].includes(P.households[k].zone));
      if (ks.length) { const born = ks.find(k => P.households[k].births.some(b => b <= day && day - b < 20)), k = born ?? ks[Math.floor(u(18) * ks.length)], hd = this.head(k, day);
        if (hd >= 0 && hd !== pid) return this.make(pid, 'kinvisit', hd, day, 20, born !== undefined ? `a child born in ${this.name(hd)}'s house` : `kin at ${this.name(hd)}'s house long unseen`, born !== undefined ? 'life' : 'aim'); } }
    // leaving for good: a young person with nothing to hold them (C: rare)
    if (age >= 18 && age <= 35 && u(12) < 0.03 && !has('leave') && P.persons[pid].marry >= 1e9) { const bound = !!eh?.bound.some(b => !b.done), spurned = this.ended.filter(g => g.pid === pid && g.kind === 'spouse' && g.out === 'abandoned').length >= 1, home = p.group >= 0 && !p.persian;
      if ((bound || spurned || home) && u(12) < (home ? 0.004 : 0.03)) return this.make(pid, 'leave', -1, day, 60, bound ? 'the house bound for its debt' : spurned ? 'the match refused' : 'longing for home', 'life'); }
    return null;
  }
  /** the goals of each house, by kind (an index: the check was a walk over every goal, for every head considered) */
  private byHouse = new Map<number, GoalKind[]>();
  private houseHas(pid: number, kind: GoalKind, day: number) { return !!this.byHouse.get(this.hid(pid, day))?.includes(kind); }
  private lastDeedBy(victim: number, doer: number): number { const mem = this.W.minds.memory.get(victim) ?? []; for (let i = mem.length - 1; i >= 0; i--) { const r = this.W.rec(mem[i]); if (r && r.deed.actor === doer && r.deed.target === victim) return r.id; } return -1; }
  make(pid: number, kind: GoalKind, who: number, day: number, span: number, why: string, cause: string): Goal {
    const depth = cause.startsWith('deed:') ? this.host.depthOfDeed(Number(cause.slice(5))) + 1 : cause.startsWith('goal:') ? (this.depth.get(Number(cause.slice(5))) ?? 1) + 1 : 1;
    const g: Goal = { id: this.nextId++, pid, kind, who, born: day, until: Math.min(REGNAL_DAYS + 60, day + span), next: day + 1, prog: 0, n: 0, fails: 0, why, cause, depth, hh: this.hid(pid, day) };
    (this.byHouse.get(g.hh!) ?? this.byHouse.set(g.hh!, []).get(g.hh!)!).push(kind);
    this.active.set(g.id, g); (this.byPid.get(pid) ?? this.byPid.set(pid, []).get(pid)!).push(g.id); this.depth.set(g.id, depth); this.stats[kind][0]++; this.ever.add(pid);
    if (cause.startsWith('goal:')) this.host.formed(g); // (a chain: born of another goal's end)
    return g;
  }
  private finish(g: Goal, day: number, out: 'achieved' | 'abandoned', why: string) {
    g.end = day; g.out = out; g.endWhy = why; this.active.delete(g.id); const l = this.byPid.get(g.pid); if (l) { l.splice(l.indexOf(g.id), 1); if (!l.length) this.byPid.delete(g.pid); }
    const hk = this.byHouse.get(g.hh ?? -1); if (hk) { const i = hk.indexOf(g.kind); if (i >= 0) hk.splice(i, 1); if (!hk.length) this.byHouse.delete(g.hh!); }
    this.stats[g.kind][out === 'achieved' ? 1 : 2]++; this.ended.push(g); if (this.ended.length > 400) this.ended.splice(0, this.ended.length - 300);
    // the heart follows: a thing won gladdens, a thing given up embitters (C)
    const big = ['spouse', 'work', 'debt', 'leave', 'care'].includes(g.kind) ? 1 : 0.6;
    if (out === 'achieved') this.host.mood(g.pid, day, 0.5 * big, g.kind === 'care' ? 'relieved' : g.kind === 'revenge' ? 'satisfied' : 'glad');
    else if (g.kind !== 'revenge' && g.kind !== 'reconcile') this.host.mood(g.pid, day, -0.4 * big, g.kind === 'care' ? 'grieving' : 'bitter');
  }

  // ------------------------------------------------------------------ pursuing: each goal's next step, on its day
  /** the goal's step today (when due): deeds done and stretches laid; returns how many deeds were done */
  pursue(g: Goal, day: number): number {
    if (!this.here(g.pid, day)) { this.finish(g, day, 'abandoned', this.P.persons[g.pid].dies <= day ? 'died' : 'gone away'); return 0; }
    if (day > g.until) { this.finish(g, day, 'abandoned', 'gave it up: too long'); return 0; }
    const n0 = this.k; g.next = day + 1;
    switch (g.kind) { case 'care': this.care(g, day); break; case 'debt': this.debt(g, day); break; case 'bridegift': this.bridegift(g, day); break; case 'dowry': this.dowry(g, day); break;
      case 'spouse': this.spouse(g, day); break; case 'work': this.work(g, day); break; case 'patron': this.patron(g, day); break; case 'revenge': this.revenge(g, day); break;
      case 'reconcile': this.reconcile(g, day); break; case 'pilgrimage': this.pilgrimage(g, day); break; case 'teach': this.teach(g, day); break; case 'leave': this.leave(g, day); break; case 'repair': this.repair(g, day); break; case 'kinvisit': this.kinvisit(g, day); break; }
    g.n++;
    return this.k - n0;
  }
  /** a deed of a goal, done now (the hour of the day given), through the engine: ok when it was done */
  private act(g: Goal, d: Deed, day: number, hour: number): boolean {
    const rec = this.W.own({ ...d, goal: g.id }, day, this.k++, hour); return rec.out.ok;
  }
  /** a stretch of a person's day laid by a goal (tomorrow or later: today's plans may have been read already) */
  private lay(pid: number, day: number, t0: number, t1: number, place: string, act: ActivityId, why: string): boolean {
    const z = /^h:(\d+)$/.exec(place), where = z ? (this.P.households[+z[1]]?.zone === 'plain' ? 'plain' : 'town') : /^(offering_place|hills|river|mountain|field:|pasture:)/.test(place) ? 'plain' : 'town';
    return this.W.lay(pid, day, { t0, t1, place, act, why, where }); // (false: not laid: a little one's or a minder's day, or rain or dust in the open)
  }
  private wage(from: number, to: number, day: number, amt = WAGE): boolean {
    const E = this.E(day), F = E?.hh.get(`h:${this.hid(from, day)}`), T = E?.hh.get(`h:${this.hid(to, day)}`); if (!F || !T || F === T) return false;
    if (F.cash > amt * 4) { F.cash -= amt; T.cash += amt; return true; }
    if (F.grain > F.eaters * 40) { F.grain -= 3; T.grain += 3; return true; } // (paid in barley, three kilos for the day: C)
    return false;
  }
  /** a house in the quarter with work to hire for (a craft or rich house, else any with silver), and its head */
  private employer(g: Goal, day: number): number { const E = this.E(day); if (!E) return -1; const qs = this.quarter(g.pid, day); if (!qs.length) return -1;
    const own = this.hid(g.pid, day), s = Math.floor(this.u(g.id, day, 7) * qs.length);
    for (let i = 0; i < Math.min(qs.length, 40); i++) { const h = qs[(s + i) % qs.length]; if (h === own) continue; const H = E.hh.get(`h:${h}`); if (!H || !(H.kind === 'craft' || H.kind === 'rich' || H.cash > 3)) continue; const m = this.head(h, day); if (m >= 0) return m; }
    return -1; }
  /** hired for the day by an employer: the employer's own mind decides, then the work is laid and paid */
  private hireDay(g: Goal, boss: number, day: number, aim: string): boolean {
    const dec = this.W.minds.decide(boss, { verb: 'help', actor: g.pid, target: boss }, day, 9); if (!dec.ok) return false;
    const at = this.bossWork(boss, day); const act: ActivityId = CRAFT_ACTS.has(at.act) ? at.act : 'carry_sack';
    if (!this.act(g, { verb: 'hire', actor: boss, target: g.pid, act, place: at.place, inH: 13, aim }, day, 19)) return false; // (asked of an evening, for the next morning)
    return this.wage(boss, g.pid, day);
  }

  private care(g: Goal, day: number) { const P = this.P, w = g.who;
    if (P.persons[w].dies <= day + 1) { this.finish(g, day, 'abandoned', `${this.name(w)} died`); this.host.mood(g.pid, day, -0.8, 'grieving');
      if (personaOf(P, g.pid, day).piety > 0.55) this.make(g.pid, 'pilgrimage', -1, day, 40, `for ${this.name(w)}, who died`, `goal:${g.id}`); return; }
    if (!P.sick(w, day) && !P.sick(w, day - 1)) { this.finish(g, day, 'achieved', `${this.name(w)} is well again`); return; }
    const h = `h:${this.hid(g.pid, day)}`;
    this.lay(g.pid, day + 1, 18.5, 20, h, 'tend_body', `tending ${this.name(w)}, who is sick`);
    if (g.n % 3 === 0) { const healer = P.healer(P.households[this.hid(g.pid, day)]?.q ?? ''); if (healer >= 0 && healer !== g.pid && this.here(healer, day)) {
      if (this.act(g, { verb: 'visit', actor: g.pid, target: healer, aim: `to fetch the healer for ${this.name(w)}` }, day, 17)) this.act(g, { verb: 'heal', actor: healer, target: w, place: h, aim: 'called to the sickbed' }, day, 18); } }
    if (g.n % 4 === 1 && personaOf(P, g.pid, day).piety > 0.5) this.lay(g.pid, day + 1, 7, 8, 'offering_place', 'offer', `praying for ${this.name(w)}, who is sick`);
    g.next = day + 3;
  }
  private debt(g: Goal, day: number) { const eh = this.eh(g.pid, day); if (!eh) { this.finish(g, day, 'abandoned', 'the house gone'); return; }
    if (!eh.debts.some(d => d.amt > 0.05)) { this.finish(g, day, 'achieved', 'the debt paid'); return; }
    const bad = eh.badUntil > day ? this.E(day)?.events[eh.badEv] : undefined; if (bad && bad.day >= g.born) { this.finish(g, day, 'abandoned', 'could not pay: the lender took his due'); return; }
    const due = Math.min(...eh.debts.filter(d => d.amt > 0.05).map(d => d.due));
    if (due - day < 12 && g.fails < 2 && g.n % 3 === 2) { const t = this.W.minds.friendOf(g.pid, day); if (t !== null) { const owed = eh.debts.reduce((a, d) => a + d.amt, 0) - eh.cash;
      if (owed > 0 && !this.act(g, { verb: 'borrow', actor: g.pid, target: t, good: 'silver', qty: Math.max(1, Math.min(20, Math.ceil(owed / 0.05))), aim: 'to pay the house\'s debt' }, day, 18)) g.fails++; } }
    else { const boss = this.employer(g, day); if (boss >= 0 && this.hireDay(g, boss, day, 'a day\'s work for silver: the house\'s debt')) g.prog = cl(g.prog + 0.05); else g.fails++; }
    g.next = day + 2 + Math.floor(this.u(g.id, day, 1) * 3);
  }
  private bridegift(g: Goal, day: number) {
    if (!this.unwed(g.pid, day)) { this.finish(g, day, 'achieved', 'married'); return; }
    const boss = this.employer(g, day); if (boss >= 0 && this.hireDay(g, boss, day, 'a day\'s work: silver for a bride-gift')) g.prog = cl(g.prog + 0.07);
    if (g.prog >= 1 || (this.eh(g.pid, day)?.cash ?? 0) > 2.5) { this.finish(g, day, 'achieved', 'the bride-gift put by'); this.make(g.pid, 'spouse', -1, day, 220, 'the bride-gift put by', `goal:${g.id}`); return; }
    g.next = day + 3 + Math.floor(this.u(g.id, day, 1) * 4);
  }
  private dowry(g: Goal, day: number) { const w = g.who;
    if (!this.here(w, day) || !this.unwed(w, day)) { this.finish(g, day, 'achieved', `${this.name(w)} betrothed`); return; }
    // the house's stores put by (spinning and weaving of an evening for the women; a day hired out for the men: C)
    if (this.P.persons[g.pid].sex === 'f') { if (this.lay(g.pid, day + 1, 16, 18, `h:${this.hid(g.pid, day)}`, 'spin', `spinning for ${this.name(w)}'s dowry`)) g.prog = cl(g.prog + 0.06); }
    else { const boss = this.employer(g, day); if (boss >= 0 && this.hireDay(g, boss, day, `a day's work: ${this.name(w)}'s dowry`)) g.prog = cl(g.prog + 0.08); }
    if (g.prog >= 1) { this.finish(g, day, 'achieved', `the dowry for ${this.name(w)} put by`); if (!this.of(w).some(x => x.kind === 'spouse')) this.make(w, 'spouse', -1, day, 220, 'the dowry put by', `goal:${g.id}`); return; }
    g.next = day + 3 + Math.floor(this.u(g.id, day, 1) * 4);
  }
  /** a match: someone of the quarter unwed, of the right age, not kin, not sought by another */
  private match(pid: number, day: number, salt0: number): number { const P = this.P, me = P.persons[pid], age = P.ageOn(pid, day), own = this.hid(pid, day), qs = this.quarter(pid, day);
    const ok = (x: number) => { const q = P.persons[x]; if (!q || q.sex === me.sex || !this.here(x, day) || P.home(x, day) === own || this.kin(pid, x) || !this.unwed(x, day) || q.agent >= 0) return false;
      const a = P.ageOn(x, day), [m, f] = me.sex === 'm' ? [age, a] : [a, age]; if (f < 16 || f > 28 || m < 18 || m - f < -2 || m - f > 16) return false;
      for (const g of this.active.values()) if (g.kind === 'spouse' && g.who === x) return false; return true; };
    for (const t of me.ties) if (ok(t)) return t; // (a friend's sister, a neighbour's son: the people they know first)
    if (!qs.length) return -1; const s = Math.floor(u01(this.W.w.seed, S.pick, pid, day, salt0) * qs.length);
    for (let i = 0; i < Math.min(qs.length, 60); i++) for (const x of P.households[qs[(s + i) % qs.length]].members) if (ok(x)) return x;
    return -1; }
  private spouse(g: Goal, day: number) { const P = this.P, me = P.persons[g.pid], E = this.E(day);
    if (!this.unwed(g.pid, day)) { this.finish(g, day, 'achieved', 'betrothed'); return; }
    if (g.who >= 0 && (!this.here(g.who, day) || !this.unwed(g.who, day) || g.fails >= 3)) { if (g.fails >= 3) this.host.mood(g.pid, day, -0.3, 'downcast'); g.who = -1; g.fails = 0; g.prog += 0.5; if (g.prog >= 1) { this.finish(g, day, 'abandoned', `no match would have ${me.sex === 'm' ? 'him' : 'her'}`); return; } }
    // the family's go-between: a mother or father speaks for the young (C: matches were the families' business)
    const elder = me.mother >= 0 && this.here(me.mother, day) && P.home(me.mother, day) === this.hid(g.pid, day) ? me.mother : this.head(this.hid(g.pid, day), day);
    const speaker = elder >= 0 && elder !== g.pid ? elder : g.pid;
    if (g.who < 0) { const m = this.match(g.pid, day, g.n); if (m < 0) { g.next = day + 7; g.fails++; if (g.fails > 4) this.finish(g, day, 'abandoned', 'no match in the quarter'); return; }
      g.who = m; g.fails = 0;
      this.act(g, speaker !== g.pid ? { verb: 'introduce', actor: speaker, target: m, third: g.pid, aim: `to make ${this.name(g.pid)} known to ${this.name(m)}` } : { verb: 'visit', actor: g.pid, target: m, aim: 'a match hoped for' }, day, 17.5);
      g.next = day + 3; return; }
    const w = g.who, wHead = this.head(this.hid(w, day), day), hh = `h:${this.hid(w, day)}`;
    const f = this.W.minds.feelOf(w, g.pid, day), tr = E?.trust && E.hh.has(hh) ? E.trust.trustOf(hh, `h:${this.hid(g.pid, day)}`, day) : 0.5;
    const fam = wHead >= 0 && wHead !== w ? this.W.minds.feelOf(wHead, speaker, day) : f, step = g.n % 4;
    // (the families agree when the one sought is fond enough and her house thinks well of his: C)
    if (g.n >= 8 && f.anger < 0.2 && f.aff + 0.5 * (fam.aff + fam.grat) + (tr - 0.5) > 0.65) { // the families agree: the betrothal promised, the wedding set (the bride goes to the groom's house)
      const bride = me.sex === 'f' ? g.pid : w, groom = me.sex === 'm' ? g.pid : w;
      this.act(g, { verb: 'promise', actor: speaker, target: wHead >= 0 && wHead !== speaker ? wHead : w, about: `the betrothal of ${this.name(groom)} and ${this.name(bride)}`, aim: 'the betrothal' }, day, 18);
      const wday = Math.min(REGNAL_DAYS - 2, day + 25 + Math.floor(this.u(g.id, day, 3) * 35)), to = this.hid(groom, day);
      if (wday > day + 10 && P.addWedding(bride, groom, wday, to)) this.weds.push([bride, groom, wday, to]);
      else this.weds.push([bride, groom, -1, to]); // (betrothed; the wedding after the year's end)
      this.host.mood(g.pid, day, 0.7, 'glad'); this.host.mood(w, day, 0.5, 'glad');
      this.finish(g, day, 'achieved', `betrothed to ${this.name(w)}`); return; }
    let ok: boolean;
    if (step === 0) ok = this.act(g, { verb: 'visit', actor: speaker, target: wHead >= 0 ? wHead : w, aim: `to speak of a match for ${this.name(g.pid)}` }, day, 18);
    else if (step === 1) ok = this.act(g, { verb: 'give', actor: speaker, target: wHead >= 0 ? wHead : w, good: 'food', qty: 2, aim: `a gift to the house of ${this.name(w)}` }, day, 17);
    else if (me.sex === 'm') { ok = this.act(g, { verb: 'court', actor: g.pid, target: w, aim: 'hoping to marry her' }, day, 18.5); if (ok) this.W.minds.move(w, g.pid, { aff: 0.12 }, day); } // (a courting welcomed warms: C)
    else { ok = this.act(g, { verb: 'visit', actor: g.pid, target: w, aim: 'a match hoped for' }, day, 17); if (ok) this.W.minds.move(w, g.pid, { aff: 0.08 }, day); }
    if (!ok) g.fails++;
    g.next = day + 6 + Math.floor(this.u(g.id, day, 1) * 7);
  }
  private masterFor(g: Goal, day: number): number { const P = this.P, qs = this.quarter(g.pid, day), s = Math.floor(this.u(g.id, day, 5) * Math.max(1, qs.length)), own = this.hid(g.pid, day);
    const E = this.E(day);
    for (let i = 0; i < Math.min(qs.length, 80); i++) { const h = qs[(s + i) % qs.length]; if (h === own) continue; const K = E?.hh.get(`h:${h}`)?.kind;
      if (K === 'craft' || K === 'rich') { const m = this.head(h, day); if (m >= 0 && P.persons[m].agent < 0 && !this.places.has(m)) return m; }
      for (const m of P.households[h].members) if (MASTERS.has(P.persons[m].job) && this.here(m, day) && P.ageOn(m, day) >= 25 && P.persons[m].agent < 0 && !this.places.has(m)) return m; }
    // a village of farmers: a hand to the farmer with the most land (C)
    let best = -1, land = (E?.hh.get(`h:${own}`)?.land ?? 0) + 0.5;
    for (let i = 0; i < Math.min(qs.length, 80); i++) { const h = qs[(s + i) % qs.length], L = E?.hh.get(`h:${h}`)?.land ?? 0; if (h !== own && L > land) { const m = this.head(h, day); if (m >= 0 && P.persons[m].agent < 0) { best = m; land = L; } } }
    return best; }
  private work(g: Goal, day: number) {
    if (g.who >= 0 && (!this.here(g.who, day) || g.fails >= 3)) { g.who = -1; g.fails = 0; g.prog += 0.5; if (g.prog >= 1) { this.finish(g, day, 'abandoned', 'no master would take him'); return; } }
    if (g.who < 0) { g.who = this.masterFor(g, day); if (g.who < 0) { this.finish(g, day, 'abandoned', 'no master in the quarter'); return; } }
    const m = g.who, f = this.W.minds.feelOf(m, g.pid, day);
    if (g.n >= 4 && f.grat + f.resp + f.aff > 0.45) { // asked, the master's own mind decides whether to take him on
      const dec = this.W.minds.decide(m, { verb: 'help', actor: g.pid, target: m }, day, 10);
      if (dec.ok) { const at = this.bossWork(m, day), act: ActivityId = CRAFT_ACTS.has(at.act) ? at.act : 'carry_sack', d0 = Math.floor(this.u(g.id, day, 2) * 7);
        this.places.set(g.pid, { master: m, act, place: at.place, days: [d0, (d0 + 3) % 7], from: day + 1, goal: g.id });
        this.act(g, { verb: 'hire', actor: m, target: g.pid, act, place: at.place, inH: 13, aim: 'taking him on' }, day, 19);
        this.finish(g, day, 'achieved', `taken on by ${this.name(m)}`); return; }
      g.fails++; }
    const ok = g.n === 0 ? this.act(g, { verb: 'visit', actor: g.pid, target: m, aim: 'to ask for work' }, day, 18)
      : this.act(g, { verb: 'help', actor: g.pid, target: m, act: CRAFT_ACTS.has(this.bossWork(m, day).act) ? this.bossWork(m, day).act : undefined, aim: 'to show his worth' }, day, 15);
    if (!ok) g.fails++; g.next = day + 3 + Math.floor(this.u(g.id, day, 1) * 4);
  }
  private patronFor(g: Goal, day: number): number { const P = this.P, el = this.W.minds.elderOf(g.pid, day); if (el !== null && el !== g.pid) return el;
    const qs = this.quarter(g.pid, day); for (const h of qs) for (const m of P.households[h].members) if (NOTABLE.has(P.persons[m].job) && m !== g.pid && this.here(m, day) && P.persons[m].agent < 0) return m; return -1; }
  private patron(g: Goal, day: number) {
    if (g.who < 0) { g.who = this.patronFor(g, day); if (g.who < 0) { this.finish(g, day, 'abandoned', 'no one to turn to'); return; } }
    const m = g.who; if (!this.here(m, day)) { this.finish(g, day, 'abandoned', `${this.name(m)} gone`); return; }
    const f = this.W.minds.feelOf(m, g.pid, day); if (f.anger > 0.3) { this.finish(g, day, 'abandoned', `${this.name(m)} turned against him`); return; }
    if (f.grat + f.resp > 0.8 && g.n >= 5) { // the favour: silver toward the debt, else a word for the house (trust)
      const eh = this.eh(g.pid, day), owed = eh ? eh.debts.reduce((a, d) => a + d.amt, 0) - eh.cash : 0;
      if (owed > 0.05) this.act(g, { verb: 'give', actor: m, target: g.pid, good: 'silver', qty: Math.min(20, Math.ceil(owed / 0.05)), aim: `a favour to ${this.name(g.pid)}` }, day, 11);
      else if (!eh) this.act(g, { verb: 'praise', actor: m, target: g.pid }, day, 11); // (a man of the group: a word of favour before the others)
      else { const E = this.E(day), h = `h:${this.hid(g.pid, day)}`; if (E?.trust) for (const x of this.quarter(g.pid, day).slice(0, 12)) if (E.hh.has(`h:${x}`)) E.trust.note(`h:${x}`, h, 0.04, day); }
      this.finish(g, day, 'achieved', `${this.name(m)}'s favour won`); return; }
    const step = g.n % 3; const ok = step === 0 ? this.act(g, { verb: 'give', actor: g.pid, target: m, good: 'food', qty: 2, aim: `a gift for ${this.name(m)}` }, day, 10)
      : step === 1 ? this.act(g, { verb: 'help', actor: g.pid, target: m, aim: 'to win his favour' }, day, 14) : this.act(g, { verb: 'praise', actor: g.pid, target: m }, day, 11);
    if (!ok) g.fails++; if (g.fails > 4) { this.finish(g, day, 'abandoned', `${this.name(m)} paid him no mind`); return; }
    g.next = day + 4 + Math.floor(this.u(g.id, day, 1) * 5);
  }
  private revenge(g: Goal, day: number) { const P = this.P, o = g.who;
    if (!this.here(o, day)) { this.finish(g, day, 'abandoned', `${this.name(o)} gone`); return; }
    const f = this.W.minds.feelOf(g.pid, o, day);
    if (f.anger < 0.15) { this.finish(g, day, 'abandoned', 'the anger cooled'); return; }
    if (this.W.cases.some(c => c.accused === o && c.victim === g.pid && c.ruled === 'fined' && c.day >= g.born) || (this.W.minds.memory.get(g.pid) ?? []).some(i => { const r = this.W.rec(i); return !!r && r.day >= g.born && r.deed.actor === g.pid && r.deed.target === o && r.out.ok && (r.deed.verb === 'attack' || r.deed.verb === 'break'); }))
      { this.finish(g, day, 'achieved', `${this.name(o)} paid for it`); return; }
    const pe = personaOf(P, g.pid, day), step = g.n, wrong = this.lastDeedBy(g.pid, o), what = wrong >= 0 ? this.W.rec(wrong)?.deed.verb : null;
    const about = what === 'steal' ? 'he stole from me' : what === 'attack' || what === 'push' ? 'he beat me' : what === 'insult' || what === 'mock' ? 'he is a liar and a cheat' : 'he cheated me';
    if (step === 0 || step === 3) { const t = this.W.minds.friendOf(g.pid, day); if (t !== null && t !== o) this.act(g, { verb: 'tell', actor: g.pid, target: t, third: o, about, aim: `telling of ${this.name(o)}'s wrong`, ...(wrong >= 0 ? { of: wrong } : {}) }, day, 18); } // (a grudge with no deed behind it is talk the hearer may find false: deeds/law.ts)
    else if (step === 1) { const el = this.W.minds.elderOf(g.pid, day); if (el !== null && el !== o && el !== g.pid) this.act(g, { verb: 'complain', actor: g.pid, target: el, third: o, about, aim: `a complaint against ${this.name(o)}` }, day, 10); }
    else if (pe.temper > 0.6 && f.anger > 0.6 && step >= 4) this.act(g, { verb: 'attack', actor: g.pid, target: o, force: 0.35 + 0.3 * this.u(g.id, day, 2) }, day, 17);
    else if (pe.temper > 0.5 && step === 5) this.act(g, { verb: 'break', actor: g.pid, target: o }, day, 21);
    else this.act(g, { verb: this.u(g.id, day, 4) < 0.5 ? 'insult' : 'curse', actor: g.pid, target: o }, day, 12 + 6 * this.u(g.id, day, 5));
    g.next = day + 3 + Math.floor(this.u(g.id, day, 1) * 5);
  }
  private reconcile(g: Goal, day: number) { const o = g.who;
    if (!this.here(o, day)) { this.finish(g, day, 'abandoned', `${this.name(o)} gone`); return; }
    const a = this.W.minds.feelOf(g.pid, o, day).anger, b = this.W.minds.feelOf(o, g.pid, day).anger;
    if (a < 0.12 && b < 0.12) { this.finish(g, day, 'achieved', `at peace with ${this.name(o)}`); return; }
    const step = g.n % 4;
    if (step === 0) { const go = this.W.minds.elderOf(g.pid, day) ?? this.W.minds.friendOf(g.pid, day); if (go !== null && go !== o && go !== g.pid) this.act(g, { verb: 'intercede', actor: go, target: o, third: g.pid, aim: `for ${this.name(g.pid)}` }, day, 17); }
    else if (step === 1) this.act(g, { verb: 'apologize', actor: g.pid, target: o }, day, 18);
    else if (step === 2) this.act(g, { verb: 'give', actor: g.pid, target: o, good: 'food', qty: 1, aim: `a gift to make peace with ${this.name(o)}` }, day, 17);
    else this.act(g, { verb: 'reconcile', actor: g.pid, target: o, aim: 'after the quarrel' }, day, 18.5);
    g.next = day + 3 + Math.floor(this.u(g.id, day, 1) * 3);
  }
  private pilgrimage(g: Goal, day: number) {
    // the offering vowed is saved for a few days (C), then a morning at the offering place, with a kinsman if one will come
    if (g.n < 2) { g.next = day + 3 + Math.floor(this.u(g.id, day, 1) * 5); return; }
    const t0 = 6.5 + this.u(g.id, day, 2);
    if (!this.lay(g.pid, day + 1, t0, t0 + 3, 'offering_place', 'offer', `an offering vowed: ${g.why}`)) { g.next = day + 1; return; } // (a dry morning waited for)
    const k = this.members(g.pid, day).find(m => this.P.ageOn(m, day) >= 14); if (k !== undefined) this.act(g, { verb: 'come_with', actor: g.pid, target: k, place: 'offering_place', act: 'offer', inH: 24 + t0 - 19, aim: `the offering vowed: ${g.why}` }, day, 19);
    this.finish(g, day + 1, 'achieved', 'the offering made');
  }
  private teach(g: Goal, day: number) { const c = g.who;
    if (!this.here(c, day) || this.hid(c, day) !== this.hid(g.pid, day)) { this.finish(g, day, 'abandoned', `${this.name(c)} gone`); return; }
    const act = g.act ?? 'craft', place = g.place ?? `h:${this.hid(g.pid, day)}`;
    // ('learn': the actor teaches the other, as the stranger's "let me teach you"; 'teach' is the actor asking to be taught)
    if (this.act(g, { verb: 'learn', actor: g.pid, target: c, act, place, inH: 24 + 10 - 8.5, aim: 'the family\'s work' }, day, 8.5)) g.prog = cl(g.prog + 0.1);
    else if (++g.fails > 8) { this.finish(g, day, 'abandoned', `${this.name(c)} would not learn`); return; }
    if (g.prog >= 1) { this.learned.set(c, act); this.finish(g, day, 'achieved', `${this.name(c)} has learned the work`); return; }
    g.next = day + 5 + Math.floor(this.u(g.id, day, 1) * 5);
  }
  private repair(g: Goal, day: number) { const h = `h:${this.hid(g.pid, day)}`;
    if (g.prog >= 1) { this.finish(g, day, 'achieved', g.why === 'the house burnt' ? 'the house rebuilt' : 'the house mended'); return; }
    if (!this.lay(g.pid, day + 1, 7, 11, h, 'mould_brick', g.why === 'the house burnt' ? 'rebuilding the house after the fire' : 'mending the house before the rains')) { g.next = day + 1; return; } g.prog = cl(g.prog + 0.2);
    const helper = g.n % 2 === 0 ? this.W.minds.friendOf(g.pid, day) : null; // (a friend or kinsman asked to lend a hand: their own mind decides)
    if (helper !== null && this.W.minds.decide(helper, { verb: 'help', actor: g.pid, target: helper }, day, 18).ok
      && this.act(g, { verb: 'repair', actor: helper, target: g.pid, act: 'mould_brick', place: h, inH: 24 + 7 - 18, aim: g.why === 'the house burnt' ? 'the house after the fire' : 'the house before the rains' }, day, 18)) g.prog = cl(g.prog + 0.1);
    g.next = day + 2 + Math.floor(this.u(g.id, day, 1) * 3);
  }
  private kinvisit(g: Goal, day: number) { const k = g.who;
    if (!this.here(k, day)) { this.finish(g, day, 'abandoned', `${this.name(k)} gone`); return; }
    if (g.n === 0) { g.next = day + 3 + Math.floor(this.u(g.id, day, 1) * 6); return; } // (a day fixed a few days on)
    const at = `h:${this.hid(k, day + 1)}`;
    if (this.act(g, { verb: 'visit', actor: g.pid, target: k, place: at, inH: 24 + 13.5 - 19, aim: g.why }, day, 19)) {
      this.lay(g.pid, day + 1, 14.5, 17.5, at, 'talk', `visiting kin at ${this.name(k)}'s house: ${g.why}`); this.finish(g, day + 1, 'achieved', `visited ${this.name(k)}'s house`); }
    else { g.fails++; if (g.fails > 2) this.finish(g, day, 'abandoned', 'no day for the visit'); else g.next = day + 4; }
  }
  private leave(g: Goal, day: number) { const P = this.P, p = P.persons[g.pid];
    if (g.n < 2) { const t = this.W.minds.friendOf(g.pid, day); if (t !== null) this.act(g, { verb: 'visit', actor: g.pid, target: t, aim: 'to say farewell' }, day, 18); g.next = day + 4; return; }
    const dest = DEST[p.origin] ?? 'Šušan';
    if (P.deedLeave(g.pid, day + 2)) { this.left.push([g.pid, day + 2]);
      this.lay(g.pid, day + 2, 6, 23.5, 'road:departure', 'walk', `leaving for ${dest}, for good`);
      for (const m of this.members(g.pid, day)) this.host.mood(m, day + 2, -0.35, 'missing someone');
      this.finish(g, day + 2, 'achieved', `left for ${dest}`); }
    else { g.fails++; if (g.fails > 2) this.finish(g, day, 'abandoned', 'could not leave the house'); else g.next = day + 7; }
  }

  // ------------------------------------------------------------------ the places won: work for the master, two days a week
  /** tomorrow's stretch for everyone with a place (laid a day ahead, paid on the day it is laid) */
  placesDay(day: number) {
    for (const [pid, pl] of this.places) { if (!this.here(pid, day + 1) || !this.here(pl.master, day + 1)) { this.places.delete(pid); continue; }
      const wd = (day + 1) % 7; if (wd !== pl.days[0] && wd !== pl.days[1]) continue;
      if (this.lay(pid, day + 1, 8, 12.5, pl.place, pl.act, `working for ${this.name(pl.master)} (taken on, paid by the day)`)) this.wage(pl.master, pid, day); }
  }

  /** what a person is set on, in the brief's words (out of world), with how far it has gone */
  phrase(g: Goal, day: number): string { const w = g.who >= 0 ? this.name(g.who) : '', me = this.P.persons[g.pid];
    const pr = g.prog > 0.05 && ['debt', 'bridegift', 'dowry', 'teach', 'repair'].includes(g.kind) ? ` (${g.prog < 0.35 ? 'just begun' : g.prog < 0.7 ? 'half-way' : 'nearly there'})` : '';
    switch (g.kind) {
      case 'care': return `caring for ${w}, who is sick`;
      case 'debt': return `earning silver to pay ${g.why}${pr}`;
      case 'bridegift': return `putting by silver for a bride-gift${pr}`;
      case 'dowry': return `putting by a dowry for ${w}${pr}`;
      case 'spouse': return w ? (me.sex === 'm' ? `seeking ${w} as a wife` : `hoping to be married to ${w}`) : me.sex === 'm' ? 'looking for a wife' : 'hoping for a husband';
      case 'work': return w ? `seeking a place with ${w}` : 'looking for better work';
      case 'patron': return w ? `seeking the favour of ${w}` : 'looking for someone of standing to help the house';
      case 'revenge': return `set on getting even with ${w}`;
      case 'reconcile': return `wanting to make peace with ${w}`;
      case 'pilgrimage': return `to make an offering at the offering place (${g.why})`;
      case 'teach': return `teaching ${w} the work${pr}`;
      case 'leave': return `meaning to leave for ${DEST[me.origin] ?? 'Šušan'}`;
      case 'repair': return g.why === 'the house burnt' ? `rebuilding the house after the fire${pr}` : `mending the house before the rains${pr}`;
      case 'kinvisit': return `to visit kin at ${w}'s house (${g.why})`;
    }
    void day; return '';
  }

  save() { return { n: this.nextId, a: [...this.active.values()], p: [...this.places], w: this.weds, l: this.left, t: [...this.learned], s: this.stats, e: this.ended.slice(-60) }; }
  load(s: ReturnType<Goals['save']> | undefined) {
    this.active.clear(); this.byPid.clear(); this.byHouse.clear(); this.places.clear(); this.weds.length = 0; this.left.length = 0; this.learned.clear(); this.ended.length = 0; this.depth.clear(); this.nextId = 0;
    for (const k of KINDS) this.stats[k] = [0, 0, 0]; if (!s) return;
    this.nextId = s.n; for (const g of s.a) { this.active.set(g.id, g); (this.byPid.get(g.pid) ?? this.byPid.set(g.pid, []).get(g.pid)!).push(g.id); this.depth.set(g.id, g.depth); if (g.hh !== undefined) (this.byHouse.get(g.hh) ?? this.byHouse.set(g.hh, []).get(g.hh)!).push(g.kind); }
    for (const [k, v] of s.p) this.places.set(k, v); for (const [k, v] of s.t) this.learned.set(k, v); this.ended.push(...s.e); for (const g of s.e) this.depth.set(g.id, g.depth);
    Object.assign(this.stats, s.s);
    // the world as the minds changed it: their weddings and their leavers put into the fresh population again
    const P = this.P; for (const w of s.w) { this.weds.push(w); if (w[2] > 0) P.addWedding(w[0], w[1], w[2], w[3]); }
    for (const [pid, d] of s.l) { this.left.push([pid, d]); P.deedLeave(pid, d, true); }
  }
}
