// The economy in the day plans (s13 econplans, D-340; UD-26, UD-07/UD-08; T-F9). The emergent economy (world.ts) decides
// what each household does under need; this layer makes each decision a planned stretch of a real person's day at a real
// place, laid over the day plan the way the stranger's deeds are (Population.plan: base plan, then these steps, then the
// stranger's): the household that buys barley sends someone to the exchange lane and they carry it home; the borrower walks
// to the lender's house; the petitioner waits at the officials' building; the hungry man hauls at the royal store for the
// day; the thief goes out in the small hours to a neighbour's store; the robbed accuse, the accused are taken and held a
// night, and all of them stand before the judge; a son or daughter bound for a debt works in the creditor's house every day
// of the bondage. Nothing is scripted here: which person, which hour and which place follow from the event (its kind, its
// household, the other party) and the person's own day; the event itself comes from needs, prices and choices.
//
// Who goes: a member of the household present that day, not one of the Terrace slice's detailed people (their duties are
// the Terrace sim's; D-340) and not at supervised work (a guard does not leave the post for the exchange lane); errands
// fall to the women and the young as often as the men, the court and the lenders to a grown man where there is one (C).
// When: an errand fits a stretch of the person's own day that is free (at rest, at home work, talk) and returns them to
// it; a summons (the court, the day's hire, the bondage) takes the hours it needs and brings them back to where their day
// goes on (C). A step that finds no time or no person is not laid, and counted (laid/unlaid: tests/econ_plans.test.ts).
// Tier C throughout: the places are the town's own (the exchange lane of the town, the officials' building, the royal
// store: town.json facilities), the hours and durations reasoned.
import { segAt, coldWear, dustWear, type Population, type Seg, type Where } from '../population';
import { nobodyWith } from '../wardrobe/washing';
import { checkPlan } from '../planCheck';
import type { ActivityId } from '../activities';
import type { Economy, EconEvent } from './world';
import { h32, u01, salt } from '../hash';

/** work under someone's count or order: the person is not sent on the household's errands from it (talk.ts's list, C) */
const SUPERVISED = new Set(['guard', 'builder', 'porter', 'camp', 'scribe', 'treasury', 'official', 'messenger', 'storekeeper', 'miller', 'weaver', 'brewer', 'groom', 'caretaker', 'priest', 'servant', 'shepherd']);
/** the parts of a day an errand may take the place of (rest, talk, the house's own work) */
const FREE = new Set<ActivityId>(['rest', 'talk', 'play', 'gamble', 'tend_body', 'spin', 'weave', 'grind', 'cook', 'clean', 'craft', 'wash', 'gather', 'garden_work', 'tend_animals']);
/** the town's exchange lane (population.ts: the farmers' market mornings go there; lives.json exchange_in_kind: no coins) */
export const EXCHANGE = 'lane:q_lt_e';
/** the day's rites and feasts an economy step does not cut through (the magi's and the households' rites, the funerals, the
 *  weddings: D-209, D-211) */
const PROTECT_ACTS = new Set<ActivityId>(['offer', 'sacrifice', 'cut_offering', 'chant', 'tend_fire', 'bury', 'mourn', 'carry_bier']);
const PROTECT_WHY = /sheep|goat|sacrifice|offering|funeral|the dead|burial|mourn|wedding|bride|feast|birth|midwife/;
const S = { who: salt('econ-plan-who'), when: salt('econ-plan-when'), dur: salt('econ-plan-dur') };

type Role = 'errand' | 'man' | 'woman' | 'worker' | 'thief' | 'bound' | 'house';
/** one economy-driven stretch of a person's day, before it is fitted to the day */
export interface EconStep { pid: number; day: number; kind: string; ev: number; role: Role;
  /** 'errand': fits a free stretch in [lo, hi] and returns to it; 'summons': starts at lo (a boundary of the day at or after
   *  it) and returns to where the day goes on; 'night': fits a stretch of sleep at home in [lo, hi]; 'held': the whole rest
   *  of the day at `dest` (arrest); 'release': from midnight at `from` until let go at `lo` */
  mode: 'errand' | 'summons' | 'night' | 'held' | 'release' | 'stay' | 'follow';
  /** held/stay/release: what the night there is called */
  night?: string;
  lo: number; hi: number; dest: string; from?: string;
  /** what is done there: [act, hours, why] in order */
  work: [ActivityId, number, string][];
  goAct: ActivityId; goWhy: string; backAct: ActivityId; backWhy: string; after?: [ActivityId, number, string] }
/** what became of a step (the test's count) */
export interface Laid { step: EconStep; ok: boolean; why?: string }

export class EconPlans {
  private byDay = new Map<number, Map<number, EconStep[]>>();
  private cache = new Map<string, Seg[]>();
  private evDay = new Map<number, EconEvent[]>(); private scanned = 0;
  /** every step fitted so far and whether it was laid (for the tests and the dev overlay) */
  readonly laid = new Map<string, Laid[]>();
  constructor(readonly pop: Population, private econTo: (day: number) => Economy) {}
  /** forget everything read from the economy (a load, or an intervention entered into it) */
  reset() { this.byDay.clear(); this.cache.clear(); this.evDay.clear(); this.scanned = 0; this.laid.clear(); }

  // ------------------------------------------------------------------ Population.plan's hook
  touches(pid: number, day: number) { return this.checking === 0 && this.steps(day).has(pid); }
  /** while a plan is checked, the others' plans it reads are their own days (no re-entry) */
  private checking = 0;
  overlay(pid: number, day: number, base: Seg[]): Seg[] {
    const k = `${pid}:${day}`, c = this.cache.get(k); if (c) return c;
    let segs = base; const out: Laid[] = []; let baseIss: Map<string, number> | null = null;
    for (const st of this.steps(day).get(pid) ?? []) {
      let r = this.fit(segs, st), why = r ? '' : 'no time in the day';
      if (r) { r = this.dress(this.feed(segs, r, st), day); baseIss ??= this.issues(pid, day, base); why = this.breaks(pid, day, segs, r, baseIss); if (why) r = null; }
      out.push({ step: st, ok: !!r, why: why || undefined }); if (r) segs = r; }
    this.cache.set(k, segs); this.laid.set(k, out); if (this.cache.size > 40000) this.cache.clear(); return segs;
  }
  /** a meal of the day the step took the person away from is eaten where they are: bread and water brought along, eaten
   *  at the place of the step's work (C) */
  private feed(before: Seg[], after: Seg[], st: EconStep): Seg[] {
    const kept = new Set(after), lost = before.filter(s => s.act === 'eat' && !kept.has(s) && !after.some(a => a.act === 'eat' && a.t0 < s.t1 && a.t1 > s.t0));
    let out = after;
    for (const m of lost) {
      const mid = (m.t0 + m.t1) / 2, cands = out.filter(s => s.ev?.startsWith('D-340') && s.t1 - s.t0 >= 0.8 && s.act !== 'sleep');
      const host = cands.sort((a, b) => Math.abs((a.t0 + a.t1) / 2 - mid) - Math.abs((b.t0 + b.t1) / 2 - mid))[0]; if (!host) continue;
      const t = Math.min(Math.max(mid - 0.2, host.t0 + 0.2), host.t1 - 0.6), i = out.indexOf(host);
      if (out.some(a => a.act === 'eat' && !/nursed|softened/.test(a.why) && a.t1 > t - 1 && a.t0 < t + 1.4)) continue; // (D-348: a meal within the hour already: none brought along; people_days_r6, child 28825 day 21)
      out = [...out.slice(0, i), { ...host, t1: t }, this.seg(t, t + 0.4, host.place, 'eat', host.where === 'road' ? 'bread and water brought along, eaten by the way' : 'bread and water brought along, eaten there', st, host.where), { ...host, t0: t + 0.4 }, ...out.slice(i + 1)];
    }
    return out;
  }
  /** the economy's stretches dressed against the cold and the dust as the day's own are (population.ts coldWear, dustWear) */
  private dress(segs: Seg[], day: number): Seg[] {
    const wx = this.pop.cal.ctx(day).wx, out: Seg[] = []; let run: Seg[] = [];
    const flush = () => { if (!run.length) return; coldWear(run, wx); dustWear(run, wx); out.push(...run); run = []; };
    for (const s of segs) { if (s.ev?.startsWith('D-340')) run.push(s); else { flush(); out.push(s); } } flush(); return out;
  }
  private issues(pid: number, day: number, segs: Seg[]) { const m = new Map<string, number>(); this.checking++; try { for (const x of checkPlan(this.pop, pid, day, segs, null)) m.set(x.kind, (m.get(x.kind) ?? 0) + 1); } finally { this.checking--; } return m; }
  /** why the step may not be laid (empty: it may): it must add none of the plan checks' issues (planCheck.ts: weather, light,
   *  waits, the day's walking, dress, meals, sleep), cut through no rite, no funeral and no wedding, leave no little one
   *  "with" this person elsewhere, and leave no child under ten alone at night */
  private breaks(pid: number, day: number, before: Seg[], after: Seg[], baseIss: Map<string, number>): string {
    const P = this.pop, kept = new Set(after);
    for (const s of before) if (!kept.has(s) && (PROTECT_ACTS.has(s.act) || PROTECT_WHY.test(s.why))) return `would cut through: ${s.why}`;
    for (const [kind, n] of this.issues(pid, day, after)) if (n > (baseIss.get(kind) ?? 0)) return `plan check: ${kind}`;
    const hid = P.home(pid, day), mem = P.membersOn(hid, day).filter(x => x !== pid && P.present(x, day));
    for (const x of mem) { if (P.ageOn(x, day) >= 14) continue;
      if (this.follows(x, pid, day)) { // (D-347: a little one going along must not be one another of the house is minding then)
        const bs0 = new Set(before), nw0 = after.filter(s => !bs0.has(s)), a0 = Math.min(...nw0.map(s => s.t0)), a1 = Math.max(...nw0.map(s => s.t1));
        if (nw0.length && P.basePlan(x, day).some(s => s.with !== undefined && s.with !== pid && s.t1 > a0 && s.t0 < a1)) return 'a little one is minded by another of the house then'; continue; } for (const s of P.basePlan(x, day)) { if (s.with !== pid) continue; const o = segAt(after, (s.t0 + s.t1) / 2);
      if (o.place !== s.place && !(o.where === 'road' && s.where === 'road')) return 'a little one is with this person'; } }
    // (D-347: nor a toddler of kin or friends visiting this house while the step takes the person away)
    { const bs = new Set(before), nw = after.filter(s => !bs.has(s) && s.ev?.startsWith('D-340') && s.place !== P.households[hid].home);
      if (nw.length && !nobodyWith(P, pid, day, Math.min(...nw.map(s => s.t0)), Math.max(...nw.map(s => s.t1)), true)) return 'a visiting little one is with this person'; }
    for (const h of [1.5, 23.5]) { const a = segAt(before, h), b = segAt(after, h); if (a.place === b.place) continue;
      const kids = mem.filter(x => P.ageOn(x, day) < 10 && P.persons[x].agent < 0 && segAt(P.basePlan(x, day), h).place === a.place);
      if (kids.length && !mem.some(x => P.ageOn(x, day) >= 14 && segAt(P.basePlan(x, day), h).place === a.place)) return 'a child would be alone at night'; }
    return '';
  }

  // ------------------------------------------------------------------ the day's steps
  /** the economy's events of a day and the bondages in force, each given to a person (cached per day) */
  steps(day: number): Map<number, EconStep[]> {
    const c = this.byDay.get(day); if (c) return c;
    const E = this.econTo(day + 1); // (an accusation is dated the morning after the theft it follows)
    // (asked while the living world is itself stepping the economy (its re-entry guard): the day is not decided yet; nothing
    // is laid and nothing cached, so the next ask after the step sees it)
    if (E.day < day) return new Map();
    for (; this.scanned < E.events.length; this.scanned++) { const e = E.events[this.scanned]; if (!e?.actor) continue; /* (a loaded economy keeps only the recent days whole, D-347) */ (this.evDay.get(e.day) ?? this.evDay.set(e.day, []).get(e.day)!).push(e); }
    const m = new Map<number, EconStep[]>(); this.today = m;
    const put = (s: EconStep | null) => { if (!s) return; const xs = m.get(s.pid) ?? m.set(s.pid, []).get(s.pid)!; xs.push(s); };
    for (const e of this.evDay.get(day) ?? []) for (const s of this.stepsOf(E, e, day)) put(s);
    for (const b of E.boundOn(day)) put(this.boundStep(E, b.hh, b.to, b.ev, day, b.from, b.until));
    for (const b of E.bondages) if (b.until === day && b.from < day) put(this.boundStep(E, b.hh, b.to, b.ev, day, b.from, b.until)); // (the morning a live-in bondage ends)
    // the morning after an arrest: let go from the officials' building until the judgement (world.ts holds him a day)
    for (const e of this.evDay.get(day - 1) ?? []) { const o = this.hid(e.other); if (e.kind !== 'arrest' || o === null) continue; const pid = this.thiefOf(E, e, o);
      if (pid !== null) put({ pid, day, kind: 'let_go', ev: e.id, role: 'thief', mode: 'release', lo: this.at(e, 8, 10), hi: 24, from: 'official_bldg', dest: 'official_bldg', work: [], goAct: 'walk', goWhy: '', backAct: 'walk', backWhy: 'let go by the judge’s men until the judgement; going home' }); }
    // the little ones at a mother's side go where her economy steps take her (mode 'follow': her stretches copied, with her)
    for (const pid of [...m.keys()]) for (const x of this.pop.membersOn(this.pop.home(pid, day), day)) if (this.follows(x, pid, day)) put({ pid: x, day, kind: 'with_mother', ev: -1, role: 'errand', mode: 'follow', lo: 0, hi: 24, dest: '', from: String(pid), work: [], goAct: 'walk', goWhy: '', backAct: 'walk', backWhy: '' });
    for (const xs of m.values()) xs.sort((a, b) => a.lo - b.lo);
    this.byDay.set(day, m); if (this.byDay.size > 30) this.byDay.delete(this.byDay.keys().next().value!);
    return m;
  }

  /** the steps given so far on the day being built (a person already sent twice is not sent again when another can go) */
  private today = new Map<number, EconStep[]>();
  /** a little one (four or under) at this mother's side, who goes where her economy steps take her */
  private follows(x: number, mother: number, day: number) { const P = this.pop; return x !== mother && P.persons[x].mother === mother && P.persons[x].agent < 0 && P.present(x, day) && P.ageOn(x, day) <= 4; }
  private hid(id: string | undefined): number | null { return id && id.startsWith('h:') ? +id.slice(2) : null; }
  /** the name of a household as its neighbours say it: its first grown man's (or woman's) name */
  headName(hid: number, day: number): string {
    const P = this.pop, mem = P.membersOn(hid, day).filter(x => P.present(x, day) && P.ageOn(x, day) >= 16);
    const x = mem.find(y => P.persons[y].sex === 'm') ?? mem[0]; const n = x === undefined ? null : P.nameOf(x);
    return n ? `${n.replace(/^\*/, '')}’s house` : 'a neighbour’s house';
  }
  /** who of the household goes (a seeded choice among those who can; null: nobody can) */
  pick(hid: number, day: number, role: Role, key: number): number | null {
    const P = this.pop; if (!P.households[hid]) return null;
    // (a rich house's own business, the pledges and the suits, may go by its servants and stewards: D-340, C)
    const mem = P.membersOn(hid, day).filter(x => P.present(x, day) && P.persons[x].agent < 0 && (!SUPERVISED.has(P.persons[x].job) || (role === 'house' && /^(servant|steward)$/.test(P.persons[x].job))) && !P.sick(x, day));
    const age = (x: number) => P.ageOn(x, day), m = (x: number) => P.persons[x].sex === 'm';
    let pool: number[];
    if (role === 'man' || role === 'house') pool = mem.filter(x => m(x) && age(x) >= 18 && age(x) <= 70);
    else if (role === 'woman') pool = mem.filter(x => !m(x) && age(x) >= 16 && age(x) <= 65);
    else if (role === 'worker') pool = mem.filter(x => age(x) >= 14 && age(x) <= 55);
    else if (role === 'thief') pool = mem.filter(x => m(x) && age(x) >= 15 && age(x) <= 50);
    else if (role === 'bound') { const kids = mem.filter(x => age(x) >= 10 && age(x) <= 25 && P.persons[x].kin); pool = kids.length ? kids : mem.filter(x => age(x) >= 12 && age(x) <= 45); }
    else pool = mem.filter(x => age(x) >= 12 && age(x) <= 70);
    if (!pool.length && role !== 'bound' && role !== 'errand') pool = mem.filter(x => age(x) >= 16 && age(x) <= 70);
    if (!pool.length) return null;
    const free = pool.filter(x => (this.today.get(x)?.length ?? 0) < 2); if (free.length) pool = free;
    // (a mother with a little one at her side is sent last: the little one goes where she goes, C)
    const littles = mem.filter(x => age(x) <= 4).map(x => P.persons[x].mother), unburdened = pool.filter(x => !littles.includes(x)); if (unburdened.length) pool = unburdened;
    return pool.sort((a, b) => a - b)[h32(this.pop.seed, S.who, key, hid) % pool.length];
  }
  whereOf(place: string): Where {
    const P = this.pop;
    if (place.startsWith('h:')) { const H = P.households[+place.slice(2)]; return H?.zone === 'plain' ? 'plain' : H?.zone === 'terrace' ? 'terrace' : 'town'; }
    const q = place.split(':')[1]; if (q && P.quarters[q]) return P.quarters[q].kind === 'village' ? 'plain' : 'town';
    return 'town';
  }
  /** the exchange a household goes to: the town's exchange lane, or its own village lane when the town is far (as the
   *  farmers' market mornings do: population.ts, 1.5 h) */
  exchangeFor(hid: number, day: number): string {
    const H = this.pop.households[hid], home = `h:${hid}`, w = this.pop.walkH(home, EXCHANGE, day, this.whereOf(home), 'town');
    return w < 1.2 ? EXCHANGE : `lane:${H.q}`;
  }
  /** a house more than 2.5 h from the town brings its court business (petitions, arrears, accusations, suits, the answers)
   *  before the village's elders at its own lane, who carry it on to the officials (D-343, C: the village headman as the
   *  officials' go-between, by analogy with the Babylonian and Achaemenid village heads); a day's walk each way is not a
   *  morning's errand */
  local<T extends { dest: string; work: EconStep['work']; goWhy: string }>(hid: number, day: number, s: T): T {
    const H = this.pop.households[hid], home = `h:${hid}`;
    if (!H || s.dest !== 'official_bldg' || this.pop.walkH(home, s.dest, day, this.whereOf(home), 'town') <= 2.5) return s;
    const w = (x: string) => x.replace(/at the officials’ building/g, 'before the village elders').replace(/the officials’ building/g, 'the village elders').replace(/before the judge/g, 'before the elders, for the judge').replace(/petitioning the officials/g, 'asking the elders to petition the officials');
    return { ...s, dest: `lane:${H.q}`, work: s.work.map(([a, h, why]) => [a, h, w(why)] as [ActivityId, number, string]), goWhy: w(s.goWhy) };
  }
  private dur(e: EconEvent, a: number, b: number, n = 0) { return a + (b - a) * u01(this.pop.seed, S.dur, e.id, n); }
  private at(e: EconEvent, a: number, b: number) { return a + (b - a) * u01(this.pop.seed, S.when, e.id); }

  /** the steps one event lays on the day (possibly none) */
  private stepsOf(E: Economy, e: EconEvent, day: number): EconStep[] {
    const P = this.pop, me = this.hid(e.actor), other = this.hid(e.other); const out: EconStep[] = [];
    const step = (hid: number | null, role: Role, s: Omit<EconStep, 'pid' | 'day' | 'kind' | 'ev' | 'role'>, key = e.id) => {
      if (hid === null) return; const pid = this.pick(hid, day, role, key); if (pid === null) return; out.push({ pid, day, kind: e.kind, ev: e.id, role, ...s }); };
    const errand = (lo: number, hi: number, dest: string, work: EconStep['work'], go: [ActivityId, string], back: [ActivityId, string]) =>
      ({ mode: 'errand' as const, lo, hi, dest, work, goAct: go[0], goWhy: go[1], backAct: back[0], backWhy: back[1] });
    const summons = (lo: number, dest: string, work: EconStep['work'], go: [ActivityId, string], back: [ActivityId, string], after?: EconStep['after']) =>
      ({ mode: 'summons' as const, lo, hi: lo, dest, work, goAct: go[0], goWhy: go[1], backAct: back[0], backWhy: back[1], after });
    const court = 'official_bldg', store = 'store_town';
    const dear = E.market.dearEv >= 0 && E.events[E.market.dearEv].day > day - 30;
    switch (e.kind) {
      case 'buy': { if (me === null) break; const x = this.exchangeFor(me, day);
        step(me, 'errand', errand(7, 16.5, x, [['exchange', this.dur(e, 0.5, 1.2), `exchanging silver for barley at the exchange: the house’s bins are low${dear ? ', and barley is dear this month' : ''}`]],
          ['walk', 'going to the exchange for barley'], ['carry_sack', 'carrying the barley home'])); break; }
      case 'buy_fuel': { if (me === null) break; const x = this.exchangeFor(me, day);
        step(me, 'errand', errand(7, 16, x, [['exchange', this.dur(e, 0.4, 0.8), 'exchanging for brushwood and dried dung: the house has no one free to gather fuel']],
          ['walk', 'going to the exchange for fuel'], ['carry_sack', 'carrying the fuel home'])); break; }
      case 'sell': { if (me === null) break; const x = this.exchangeFor(me, day);
        step(me, 'errand', errand(7, 16.5, x, [['exchange', this.dur(e, 0.6, 1.5), 'exchanging a jar and a cloth of the house’s for barley and silver: the house needs it']],
          ['carry_jar', 'carrying a jar and a cloth of the house’s to the exchange'], ['carry_sack', 'carrying home what they fetched'])); break; }
      case 'animal_bought': { if (me === null) break; const x = this.exchangeFor(me, day), herd = E.hh.get(e.actor)?.kind === 'herder';
        step(me, 'man', errand(7, 15, x, [['exchange', this.dur(e, 1, 2), herd ? 'bargaining for ewes to make up the flock after the loss' : 'bargaining for a draught ox to replace the one the house lost']],
          ['walk', herd ? 'going to buy ewes' : 'going to buy an ox'], ['walk', herd ? 'driving the ewes home' : 'leading the new ox home'])); break; }
      case 'loan': case 'loan_refused': case 'repaid': { if (me === null || other === null) break; const L = this.headName(other, day);
        const why = e.kind === 'loan' ? `asking at ${L} for a loan of silver; it is weighed out, to be repaid with a tenth more after the harvest`
          : e.kind === 'loan_refused' ? `asking at ${L} for a loan of silver; refused: ${E.events.some(x => x.actor === e.actor && x.kind === 'default' && x.day > day - 240 && x.day <= day) ? 'the house did not pay the last one' : 'the house has nothing left to pledge'}`
            : `bringing the silver owed back to ${L} and seeing it weighed`;
        step(me, 'man', errand(7, 18, `h:${other}`, [['talk', this.dur(e, 0.3, 0.7), why]], ['walk', `going to ${L}`], ['walk', 'going back'])); break; }
      case 'pledge_seized': { if (other === null) break; const L = me === null ? 'the royal store' : this.headName(me, day), dest = me === null ? store : `h:${me}`;
        // (the debtor's house brings the pledge to the creditor: a jar, a cloth, a tool, or the tablet for a strip of field; C)
        step(other, 'man', errand(7, 17, dest, [['talk', this.dur(e, 0.2, 0.5), `at ${L}: the debt was not paid on its day; handing over the pledge`]], ['carry_sack', `carrying the pledge to ${L} for the unpaid debt`], ['walk', 'going back empty-handed'])); break; }
      case 'suit': { if (me === null || other === null) break; const D = this.headName(other, day);
        step(me, 'house', this.local(me, day, errand(7.5, 13, court, [['queue', this.dur(e, 0.8, 1.8), 'waiting to be heard at the officials’ building'], ['talk', 0.3, `bringing a suit before the judge against ${D} for an unpaid debt`]], ['walk', 'going to the officials’ building'], ['walk', 'going back']))); break; }
      case 'tax_arrears': case 'levy_arrears': { if (me === null) break;
        step(me, 'man', this.local(me, day, errand(7.5, 14, court, [['queue', this.dur(e, 0.8, 2), 'waiting to be called at the officials’ building, with the others who owe'], ['talk', 0.2, e.kind === 'tax_arrears' ? 'the tax cannot be paid; the arrears are written down against the house' : 'the extra levy cannot be given; it is written down as owed']],
          ['walk', 'going to the officials’ building'], ['walk', 'going back']))); break; }
      case 'petition': { if (me === null) break; const cause = E.events[e.causes[0]]?.kind;
        const what = cause === 'tax_arrears' || cause === 'levy_arrears' ? 'to remit what the house owes the treasury' : cause === 'death' ? 'for grain: the house has lost its worker' : 'for grain from the royal store: the house has nothing left';
        step(me, 'man', this.local(me, day, errand(7.5, 13, court, [['queue', this.dur(e, 1, 2.5), 'waiting to be heard at the officials’ building, among the petitioners'], ['talk', 0.25, `petitioning the officials ${what}`]], ['walk', 'going to the officials’ building to petition'], ['walk', 'going back']))); break; }
      case 'relief': { if (other === null) break;
        step(other, 'worker', errand(8, 15, store, [['queue', this.dur(e, 0.4, 1), 'waiting to be called at the storehouse: the petition was granted']], ['walk', 'going to the storehouse for the grain granted'], ['carry_sack', 'carrying home the relief grain from the royal store'])); break; }
      case 'petition_refused': case 'remitted': { if (other === null) break;
        step(other, 'man', this.local(other, day, errand(8, 14, court, [['queue', this.dur(e, 0.5, 1.2), 'waiting to be called at the officials’ building for the answer'], ['talk', 0.15, e.kind === 'remitted' ? 'told the arrears are remitted' : 'told the petition is refused']], ['walk', 'going to hear the answer to the petition'], ['walk', 'going back']))); break; }
      case 'wage_work': { if (me === null) break;
        // (a village far from the town is hired on the crown's canal work near it, paid in barley by the treasury: C)
        const far = this.pop.walkH(`h:${me}`, store, day, this.whereOf(`h:${me}`), 'town') > 1.5, cq = `canal:${P.households[me].q}`;
        if (far) { step(me, 'worker', summons(this.at(e, 6.5, 7.5), cq, [['dig_canal', this.dur(e, 6, 8), 'hired for the day on the crown’s canal work by the village, for a day’s barley: the house is short']], ['walk', 'going out to be hired on the canal work'], ['walk', 'going home with the day’s barley'])); break; }
        step(me, 'worker', summons(this.at(e, 6.5, 7.5), store, [['haul', this.dur(e, 6, 8), 'hired for the day at the royal store, carrying sacks for a day’s barley: the house is short']], ['walk', 'going to the storehouse to be hired for the day'], ['carry_sack', 'carrying the day’s barley home'])); break; }
      case 'kin_help': { if (me === null || other === null) break; const K = this.headName(other, day);
        step(me, 'errand', errand(7, 18, `h:${other}`, [['talk', this.dur(e, 0.3, 0.8), `at ${K}, kin: asking for barley to tide the house over`]], ['walk', `going to ${K}, kin`], ['carry_sack', `carrying home the barley ${K} gave`])); break; }
      case 'nursed_by_kin': { if (me === null || other === null) break; const K = this.headName(me, day);
        step(other, 'woman', errand(8, 17, `h:${me}`, [['cook', this.dur(e, 1, 2), `at ${K}, kin: cooking for them and sitting with the sick`]], ['walk', `going to ${K}, where there is sickness`], ['walk', 'going home'])); break; }
      case 'neighbours_help': { if (me === null || other === null) break; const K = this.headName(other, day);
        step(me, 'errand', errand(7, 17, `h:${other}`, [['talk', this.dur(e, 0.2, 0.5), `bringing barley to ${K}, whose house burnt`]], ['carry_sack', `carrying barley to ${K}, whose house burnt`], ['walk', 'going home'])); break; }
      case 'house_fire': { if (me === null) break;
        step(me, 'man', summons(this.at(e, 7, 8), `h:${me}`, [['clean', this.dur(e, 3, 5), 'clearing the burnt beams and the ash of the roof: the house burnt']], ['walk', 'going home to the burnt house'], ['walk', 'going on with the day'])); break; }
      case 'theft': { if (me === null || other === null) break; const V = this.headName(other, day);
        step(me, 'thief', { mode: 'night', lo: this.at(e, 0.5, 2.5), hi: 4, dest: `h:${other}`, work: [['carry_sack', 0.15, `taking barley from the store of ${V} in the dark`]], goAct: 'walk', goWhy: 'going out in the dark while the house sleeps', backAct: 'carry_sack', backWhy: 'carrying the stolen barley home in the dark' }); break; }
      case 'robbed': { if (me === null) break;
        step(me, 'man', errand(6, 9, `lane:${P.households[me].q}`, [['talk', this.dur(e, 0.3, 0.6), 'found the house’s store broken into; telling those in the lane']], ['walk', 'going out into the lane'], ['walk', 'going back into the house'])); break; }
      case 'accusation': { if (me === null || other === null) break; const T = this.headName(other, day);
        step(me, 'man', this.local(me, day, errand(7.5, 12, court, [['queue', this.dur(e, 0.6, 1.5), 'waiting to be heard at the officials’ building'], ['talk', 0.3, `accusing a man of ${T} before the judge of the theft of barley`]], ['walk', 'going to the officials’ building to accuse the thief'], ['walk', 'going back']))); break; }
      case 'arrest': { if (other === null) break; const pid = this.thiefOf(E, e, other);
        if (pid !== null) out.push({ pid, day, kind: e.kind, ev: e.id, role: 'thief', mode: 'held', lo: this.at(e, 7, 9), hi: 24, dest: court, work: [['rest', 0, 'held at the officials’ building by the judge’s men, accused of theft']], goAct: 'walk', goWhy: 'taken by the judge’s men to the officials’ building', backAct: 'walk', backWhy: '' });
        break; }
      case 'time_granted': case 'debt_labour': case 'acquitted': case 'fined': case 'beaten': { if (other === null) break;
        const theft = e.kind === 'acquitted' || e.kind === 'fined' || e.kind === 'beaten'; const pid = theft ? this.thiefOf(E, e, other) : this.pick(other, day, 'man', e.id); if (pid === null) break;
        const verdict = ({ time_granted: 'the judge gives the house more time to pay the debt', debt_labour: 'the judge gives one of the house to work off the debt in the creditor’s house', acquitted: 'the judge finds the theft not proved', fined: 'the judge orders the barley given back and silver paid to the house robbed', beaten: 'the judge orders him beaten for the theft' } as Record<string, string>)[e.kind];
        out.push({ pid, day, kind: e.kind, ev: e.id, role: theft ? 'thief' : 'man', ...summons(this.at(e, 7.5, 9), court, [['queue', this.dur(e, 1, 2), 'waiting to be called before the judge'], ['talk', 0.3, `before the judge: ${verdict}`]], ['walk', 'going to the officials’ building to be judged'], ['walk', 'going home after the judgement'],
          e.kind === 'beaten' ? ['lie_ill', 4, 'lying at home after the beating'] : undefined) }); break; }
    }
    return out;
  }
  /** the man of the household who did the theft an arrest or a judgement follows (traced back through the causes) */
  private thiefOf(E: Economy, e: EconEvent, hid: number): number | null {
    let x: EconEvent | undefined = e; for (let i = 0; i < 4 && x && x.kind !== 'theft'; i++) x = x.causes.map(c => E.events[c]).find(c => c && /theft|accusation|arrest/.test(c.kind));
    if (!x || x.kind !== 'theft') return this.pick(hid, e.day, 'thief', e.id);
    return this.pick(hid, x.day, 'thief', x.id);
  }
  /** a day of the bondage: the bound member works in the creditor's house (or for the treasury: at the royal store, or on
   *  the crown's canal work by a far village). A creditor's house more than an hour and a half away is lived in: the bound
   *  son or daughter goes there on the first day, sleeps and works there, and comes home the morning the bondage ends (C:
   *  the pledged person of the Babylonian loan texts lives in the creditor's house) */
  private boundStep(E: Economy, hh: string, to: string, ev: number, day: number, from: number, until: number): EconStep | null {
    const hid = this.hid(hh); if (hid === null) return null; const pid = this.pick(hid, from, 'bound', ev); if (pid === null || !this.pop.present(pid, day)) return null;
    const P = this.pop, home = `h:${hid}`, c = this.hid(to), f = P.persons[pid].sex === 'f';
    const farStore = c === null && P.walkH(home, 'store_town', day, this.whereOf(home), 'town') > 1.5;
    const dest = c !== null ? `h:${c}` : farStore ? `canal:${P.households[hid].q}` : 'store_town';
    const whose = c !== null ? this.headName(c, day) : farStore ? 'the crown’s canal work' : 'the royal store';
    const act: ActivityId = c === null ? (farStore ? 'dig_canal' : 'haul') : f ? 'grind' : 'haul';
    const task = c === null ? (farStore ? 'digging out the crown’s canal' : 'carrying sacks at the royal store') : f ? 'grinding their barley' : 'carrying water, dung and fodder for them';
    const why = `bound to work ${c === null ? 'for the treasury' : `in ${whose}`} until the debt is worked off: ${task}`;
    const lo = 6.5 + 0.5 * u01(P.seed, S.when, ev, day), base = { pid, day, kind: 'bound_labour', ev, role: 'bound' as Role, hi: 0, dest, goAct: 'walk' as ActivityId, goWhy: `going to ${whose} to work off the debt`, backAct: 'walk' as ActivityId };
    if (c !== null && this.walk(home, dest, day) > 1.5) { const night = `the night in ${whose}, where ${f ? 'she' : 'he'} is bound`;
      if (day === from) return { ...base, mode: 'held', lo, work: [[act, 7, why]], night, backWhy: '' };
      if (day === until) return { ...base, kind: 'bound_home', mode: 'release', lo: 6, from: dest, work: [], night, backWhy: 'the debt worked off: going home' };
      return { ...base, mode: 'stay', lo, work: [[act, 9, why]], night, backWhy: '' }; }
    if (day >= until) return null;
    void E; return { ...base, mode: 'summons', lo, work: [[act, 8, why]], backWhy: 'going home at the end of the day’s bound work' };
  }

  // ------------------------------------------------------------------ fitting a step into a day
  private seg(t0: number, t1: number, place: string, act: ActivityId, why: string, st: EconStep, where?: Where): Seg {
    return { t0, t1, place, act, why, where: where ?? this.whereOf(place), ev: `D-340 economy: ${st.kind} (event ${st.ev}; C)` };
  }
  private road(a: string, b: string): string { const wa = this.whereOf(a), wb = this.whereOf(b); return `road:${wa === 'terrace' || wb === 'terrace' ? 'terrace' : wb}`; }
  private walk(a: string, b: string, day: number) { return a === b ? 0 : this.pop.walkH(a, b, day, this.whereOf(a), this.whereOf(b)); }
  /** the steps there and back from `from` starting at h0; returns the segments and the hour they end */
  private trip(st: EconStep, from: string, h0: number, ret: string): { segs: Seg[]; t: number } {
    const d = st.day, segs: Seg[] = []; let t = h0;
    const w1 = this.walk(from, st.dest, d); if (w1 > 0) { segs.push(this.seg(t, t + w1, this.road(from, st.dest), st.goAct, st.goWhy, st, 'road')); t += w1; }
    for (const [a, h, why] of st.work) { segs.push(this.seg(t, t + h, st.dest, a, why, st)); t += h; }
    const w2 = this.walk(st.dest, ret, d); if (w2 > 0) { segs.push(this.seg(t, t + w2, this.road(st.dest, ret), st.backAct, st.backWhy, st, 'road')); t += w2; }
    return { segs, t };
  }
  /** the day plan with the step laid over it, or null when it does not fit */
  fit(segs: Seg[], st: EconStep): Seg[] | null {
    const home = `h:${this.pop.home(st.pid, st.day)}`;
    if (segs.some(s => s.where === 'away')) return null;
    if (st.mode === 'errand' || st.mode === 'night') {
      const need = this.trip(st, st.dest, 0, st.dest).t; // (work only; the walks depend on where from)
      // runs of free stretches at one place (the house's work and rest follow each other in short blocks); home first
      const runs: { place: string; t0: number; t1: number }[] = [];
      for (const s of segs) {
        const ok = st.mode === 'night' ? s.act === 'sleep' && s.place === home : FREE.has(s.act) && s.where !== 'road' && !s.place.startsWith('@') && !s.place.startsWith('road:') && s.with === undefined;
        const last = runs[runs.length - 1];
        if (!ok) { runs.push({ place: '', t0: s.t0, t1: s.t1 }); continue; }
        if (last && last.place === s.place && Math.abs(last.t1 - s.t0) < 1e-6) last.t1 = s.t1; else runs.push({ place: s.place, t0: s.t0, t1: s.t1 });
      }
      const order = [...runs.filter(r => r.place === home), ...runs.filter(r => r.place && r.place !== home)];
      for (const s of order) {
        const a = Math.max(s.t0 + 0.05, st.lo), w = this.walk(s.place, st.dest, st.day);
        const len = need + 2 * w; if (a > st.hi || a + len > s.t1 - 0.05) continue;
        const back = s.place === home ? st : { ...st, backWhy: st.backWhy.replace(/\bhome\b/, 'back') };
        const r = this.trip(back, s.place, a, s.place); return splice(segs, a, r.t, r.segs);
      }
      // a grown man's or woman's business (the lender, the court, the kin's sickbed) is left for no free hour: it is gone to
      // from the work of the day, and the work taken up again after (C)
      // (from a far village the walk starts at first light: D-340, C)
      if (st.mode === 'errand' && st.role !== 'errand') return this.fit(segs, { ...st, mode: 'summons', lo: Math.max(4.5, Math.min(st.lo + (st.hi - st.lo) * 0.25, st.lo + 0.5 - this.walk(home, st.dest, st.day))) });
      return null;
    }
    if (st.mode === 'follow') { // a little one goes along with the mother on her economy stretches
      const mo = +st.from!, mp = this.pop.plan(mo, st.day), runs: [number, number][] = [];
      for (const s of mp) if (s.ev?.startsWith('D-340')) { const l = runs[runs.length - 1]; if (l && Math.abs(l[1] - s.t0) < 1e-6) l[1] = s.t1; else runs.push([s.t0, s.t1]); }
      let out = segs, any = false;
      for (const [a, b] of runs) { if (segAt(segs, a + 1e-4).with !== mo && segAt(segs, Math.max(a, b - 1e-4)).with !== mo) continue;
        const copy = mp.filter(s => s.t1 > a && s.t0 < b).map(s => ({ ...s, t0: Math.max(a, s.t0), t1: Math.min(b, s.t1), with: mo, ev: `D-340 economy: with_mother (C)`,
          act: (s.where === 'road' ? 'walk' : s.act === 'sleep' ? 'sleep' : 'play') as ActivityId,
          why: s.where === 'road' ? 'carried along with the mother' : s.act === 'sleep' ? 'asleep beside the mother' : 'playing beside the mother while she is busy there' }));
        out = splice(out, a, b, copy); any = true; }
      return any ? out : null;
    }
    if (st.mode === 'stay') { // a whole day in the house where the bound person lives and works
      const [a, h, why] = st.work[0], w0 = Math.max(6, st.lo), w1 = Math.min(18, w0 + h + 0.5);
      return [this.seg(0, 5.5, st.dest, 'sleep', st.night!, st), this.seg(5.5, 6, st.dest, 'eat', 'bread and water before the work, in the house where the debt is worked off', st),
        this.seg(6, w0, st.dest, 'rest', 'waiting to be set to work', st), this.seg(w0, 12, st.dest, a, why, st), this.seg(12, 12.5, st.dest, 'eat', 'a midday meal of bread in the house where the debt is worked off', st),
        this.seg(12.5, w1, st.dest, a, why, st), this.seg(w1, 18.5, st.dest, 'rest', 'at the house where the debt is worked off', st),
        this.seg(18.5, 19, st.dest, 'eat', 'the evening meal with the house’s servants', st), this.seg(19, 21.5, st.dest, 'rest', 'at the house where the debt is worked off', st), this.seg(21.5, 24, st.dest, 'sleep', st.night!, st)].filter(x => x.t1 > x.t0 + 1e-6);
    }
    if (st.mode === 'release') { // from midnight at the officials' building until let go, then home to where the day goes on
      const held = [this.seg(0, Math.min(6, st.lo), st.from!, 'sleep', st.night ?? 'held the night at the officials’ building', st), this.seg(Math.min(6, st.lo), st.lo, st.from!, 'rest', st.night ? 'getting ready to go home' : 'held at the officials’ building, waiting', st)];
      const b = this.boundary(segs, st.lo + this.walk(st.from!, home, st.day)); if (!b) return null;
      const w = this.walk(st.from!, b.place, st.day); const back = w > 0 ? [this.seg(st.lo, st.lo + w, this.road(st.from!, b.place), 'walk', st.backWhy, st, 'road')] : [];
      const t = st.lo + w; const fill = b.t0 > t + 1e-6 ? [this.seg(t, b.t0, b.place, 'rest', st.night ? 'home again, the debt worked off' : 'back from the officials’ building', st)] : [];
      return splice(segs, 0, b.t0, [...held.filter(x => x.t1 > x.t0), ...back, ...fill]);
    }
    // a summons or an arrest: from where the day has the person at lo
    // (from a far village the walk starts earlier, at first light at the earliest: C)
    const wh = this.walk(home, st.dest, st.day); let h0 = st.mode === 'held' || wh <= 1.5 ? st.lo : Math.max(4.5, st.lo + 1 - wh), cur = segAt(segs, h0);
    if (cur.where === 'road' || cur.place.startsWith('road:') || cur.place.startsWith('@')) { const i = segs.indexOf(cur); const nx = segs.slice(i + 1).find(s => s.where !== 'road' && !s.place.startsWith('@')); if (!nx) return null; h0 = nx.t0; cur = nx; }
    if (cur.act === 'sleep' && st.mode !== 'held') { h0 = Math.max(h0, cur.t1); cur = segAt(segs, h0 + 1e-6); if (cur.where === 'road') return null; }
    const from = cur.place;
    if (st.mode === 'held') {
      const w = this.walk(from, st.dest, st.day); if (h0 + w > 20) return null;
      const s = [this.seg(h0, h0 + w, this.road(from, st.dest), st.goAct, st.goWhy, st, 'road')]; let t = h0 + w;
      for (const [a, h, why] of st.work) if (h > 0) { s.push(this.seg(t, Math.min(21.5, t + h), st.dest, a, why, st)); t = Math.min(21.5, t + h); }
      const restWhy = st.night ? `at ${st.dest.startsWith('h:') ? 'the house' : 'the place'} where the debt is worked off` : st.work[0][2];
      if (t < 18.5) s.push(this.seg(t, 18.5, st.dest, 'rest', restWhy, st), this.seg(18.5, 19, st.dest, 'eat', st.night ? 'the evening meal with the house’s servants' : 'bread and water given to the held', st), this.seg(19, 21.5, st.dest, 'rest', restWhy, st));
      else s.push(this.seg(t, 21.5, st.dest, 'rest', restWhy, st));
      s.push(this.seg(21.5, 24, st.dest, 'sleep', st.night ?? 'held the night at the officials’ building', st));
      return splice(segs, h0, 24, s.filter(x => x.t1 > x.t0 + 1e-6));
    }
    if (!st.after) { // there and back to where the day has the person when they come back, when it is the same place
      const r = this.trip(st, from, h0, from), s1 = segAt(segs, r.t);
      if (r.t < 23.9 && s1.place === from && s1.where !== 'road' && s1.t1 > r.t + 0.05 && s1.act !== 'sleep') return splice(segs, h0, r.t, r.segs);
    }
    const t0 = this.trip(st, from, h0, st.dest).t; // (there and the work)
    let tEnd = t0 + (st.after ? st.after[1] : 0);
    // back to where the day goes on: the first stretch of the day (not a walk) starting after the walk back
    for (let tries = 0; tries < 3; tries++) {
      const b = this.boundary(segs, tEnd + this.walk(st.dest, home, st.day));
      if (!b) { // nothing more of the day after: home, and (after a beating) lying there until the night's sleep
        const sl = segs.find(x => x.act === 'sleep' && x.place === home && x.t0 > 12); if (!sl || !st.after) return null;
        const r = this.trip(st, from, h0, home); if (r.t > sl.t0 - 0.25) return null;
        return splice(segs, h0, sl.t0, [...r.segs, this.seg(r.t, sl.t0, home, st.after[0], st.after[2], st)]); }
      const after = st.after ? home : b.place;
      const r = this.trip(st, from, h0, after); let t = r.t; const out = [...r.segs];
      if (st.after) { out.push(this.seg(t, t + st.after[1], home, st.after[0], st.after[2], st)); t += st.after[1];
        const w = this.walk(home, b.place, st.day); if (w > 0) { out.push(this.seg(t, t + w, this.road(home, b.place), 'walk', 'going on with the day', st, 'road')); t += w; } }
      if (t > b.t0 + 1e-6) { tEnd = t; continue; }
      if (b.t0 > t + 1e-6) out.push(this.seg(t, b.t0, b.place, FREE.has(b.act) ? b.act : 'rest', b.place === home ? 'at home' : 'waiting there for the others', st));
      if (h0 >= 24 || b.t0 > 24) return null;
      return splice(segs, h0, b.t0, out.filter(x => x.t1 > x.t0 + 1e-6));
    }
    return null;
  }
  /** the first stretch of the day that is not a walk and starts at or after t */
  private boundary(segs: Seg[], t: number): Seg | null { return segs.find(s => s.t0 >= t - 1e-6 && s.where !== 'road' && !s.place.startsWith('road:') && !s.place.startsWith('@')) ?? null; }
}

/** base plan with [h0, h1] replaced by `mid` (blocks cut at the edges; talk.ts's splice) */
export function splice(base: Seg[], h0: number, h1: number, mid: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const s of base) { if (s.t1 <= h0 + 1e-9) out.push(s); else if (s.t0 < h0 - 1e-9) out.push({ ...s, t1: h0 }); }
  for (const m of mid) if (m.t1 - m.t0 > 1e-6) out.push(m);
  for (const s of base) { if (s.t0 >= h1 - 1e-9) out.push(s); else if (s.t1 > h1 + 1e-9) out.push({ ...s, t0: h1 }); }
  return out;
}
