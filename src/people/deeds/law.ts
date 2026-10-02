// D-460 (UD-32): WRONGS AND THEIR CONSEQUENCES, for every actor alike (the stranger and the town's own people). The deed engine
// (deeds/engine.ts) does a wrong; this module is what the world does about it afterwards, day by day, with or without the
// stranger:
//   theft found out later: a theft nobody saw is a LOSS the house notices in a day or three (the store looked into); the house
//     suspects someone by what it knows (the thief's record and nearness, the stranger first because he is a stranger, a
//     neighbour it already distrusts), so the wrong house is sometimes blamed; it complains to the quarter's elder; the elder's
//     men search the accused house (the goods found or not); a wrong suspicion may be cleared later when the truth comes out;
//   lies discovered: a false word about a third person (a lie, or a charge the world's record does not bear out) is checked
//     against what the hearer can learn (the one spoken of is kin, a friend, a neighbour: they ask); found out, the hearer's
//     trust and respect for the liar fall and the harm to the third is undone; it becomes news;
//   assault and its aftermath: the wound heals over days (deeds/engine.ts injuries; stages here), the victim's kin take it up
//     (anger in the whole house and its kin houses), a demand for compensation by wound (a blood-price for a killing), paid, or
//     refused and the feud escalates (a kinsman's blow, which is itself a wrong and raises the same feud), until the elders
//     settle it (the balance of harms paid, peace sworn) or the king's judges rule;
//   the watch and the guards: a wrong done before a guard (on the Terrace, at the gates, a patrol in the town) and often before
//     grown men of the lane: the offender is seized in the act and held at the officials' building until the judges hear it;
//   the hearing: the quarter's elder (neighbours' wrongs) or the king's judges (the seized, the grave, the stranger: the dāta of
//     the king); evidence weighed (seized in the act, witnesses, the goods found, the accused's whole record, the house's
//     trust); sentences as the evidence supports: restitution and compensation, fines in silver, labour in the victim's house
//     when the silver is not there, flogging for the grave or the repeated, expulsion from the town for a stranger;
//   the record: every conviction, lie found and blow struck is known to the houses that heard it (the victim's, the quarter
//     of the hearing, the hearer's), which the minds read when the offender next asks anything (Minds ctx.record) and the
//     rumour net spreads (converse/sight.ts keeps away from a stranger with such news).
// Pure given the seed and the deeds; saved with the deed world.
//
// EVIDENCE (tiers; the dev overlay shows LAW_EVIDENCE with each sentence):
//   B  royal judges (basilēioi dikastai) interpret the ancestral law and serve for life unless found unjust: Herodotus 3.31,
//      5.25, 7.194; the king's law (OPers. dāta) by which the lands were held: Behistun DB §8, Xerxes' daiva text XPh;
//      Babylonian texts of the Persian period cite "the law of the king" (dātu ša šarri).
//   B  the whole record weighed before punishing; not even the king puts a man to death for one offence, nor a Persian his
//      servant: Herodotus 1.137 (the hearing weighs the accused's record, both ways; no death sentence here).
//   B  fines and compensation in silver; multiple restitution for theft and labour for an unpaid debt in Babylonian legal
//      practice under the Persians (Neo-Babylonian contracts, the Murašû archive); the amounts here are C.
//   B  corporal punishment with the whip as a Persian penalty (Herodotus 7.35, 7.223 of the whip; the Avestan Vīdēvdād's
//      penalties counted in strokes, an Iranian code: B for the practice, C for any count); never shown, only its aftermath.
//   C  the quarter's elder hearing neighbours' wrongs, compensation by the wound, the feud between houses and the elders'
//      settlement, a stranger's expulsion from the town: reconstructed by analogy (Near Eastern and Iranian village practice).
//   No torture, no death sentence, no mutilation (Behistun's punishments of rebel kings are a king's, not a lane's).
import { segAt } from '../population';
import type { Population, Seg, Where } from '../population';
import type { Economy } from '../economy/world';
import type { RumourNet } from '../asks/rumour';
import type { ActivityId } from '../activities';
import { u01, salt } from '../hash';
import type { Minds } from '../mind/minds';
import { personaOf } from '../persona';
import type { Actor, Deed, DeedRec, Good } from './types';

const S = { see: salt('law-see'), notice: salt('law-notice'), sus: salt('law-suspect'), find: salt('law-find'), lie: salt('law-lie'), feud: salt('law-feud'), seize: salt('law-seize'), rule: salt('law-rule'), due: salt('law-due') };
const cl = (x: number, lo = -1, hi = 1) => x < lo ? lo : x > hi ? hi : x;

export type Ruling = 'fined' | 'dismissed' | 'compensated' | 'flogged' | 'labour' | 'expelled';
export type Court = 'elder' | 'judges';
export interface Sentence { kind: Ruling; silver: number; to: 'victim' | 'crown'; strokes?: number; days?: number; paid: number; tier: 'B' | 'C'; why: string }
export interface Case {
  id: number; day: number; due: number; accuser: Actor; accused: Actor; victim: Actor; crime: string; witnessed: boolean;
  ruled?: Ruling; fine?: number; court?: Court; seized?: boolean; found?: boolean; loss?: number; feud?: number; sentence?: Sentence;
  /** the accused did not do it (known to the world, not to the court) */ innocent?: boolean; why?: string;
}
export interface Loss { id: number; deed: number; day: number; thief: Actor; victim: number; hh: string; good: Good; amt: number; noticeDay: number; noticed?: boolean; suspect?: Actor; wrong?: boolean; found?: number; caseId?: number; returned?: boolean }
export interface Claim { id: number; deed: number; day: number; liar: Actor; hearer: number; third?: Actor; until: number; found?: number }
export interface Feud {
  id: number; a: string; b: string; day: number; victim: Actor; by: Actor;
  /** harm done to side a, to side b (wound severity points) */ harm: [number, number];
  state: 'open' | 'demanded' | 'refused' | 'settled' | 'judged'; price: number; paid: number; due: number; blows: number; last: number; why?: string;
}
export interface Mark { day: number; who: Actor; kind: 'convicted' | 'lie_found' | 'seized' | 'struck' | 'flogged' | 'expelled' | 'acquitted'; crime?: string; q?: string; hhs: string[] }
export interface StrangerLaw { held?: { until: number; why: string }; expelled?: { day: number; why: string }; owed: number; labour?: { hh: string; from: number; days: number } }

/** compensation by the wound (silver, shekels; C), and the blood-price for a life (C) */
export const WOUND_PRICE: Record<string, number> = { push: 0.2, bruised: 0.5, cut: 1, broken: 3, killed: 15 };
const SEV: Record<string, number> = { push: 0.5, bruised: 1, cut: 2, broken: 3, killed: 6 };
/** a day's labour in silver (B: the hired man's shekel a month; C for Pārsa: D-455) */
const DAY_WAGE = 1 / 30;
export const LAW_EVIDENCE = {
  judges: { tier: 'B', why: "the king's judges hear the seized, the grave and the stranger by the king's law (Herodotus 3.31, 5.25; dāta: Behistun DB §8, XPh)" },
  record: { tier: 'B', why: 'the whole record weighed before punishing (Herodotus 1.137)' },
  silver: { tier: 'B', why: 'fines, restitution and compensation in silver; labour for what is unpaid (Babylonian legal practice under the Persians); amounts C' },
  flogging: { tier: 'B', why: 'the whip as a Persian penalty (Herodotus 7.35, 7.223; strokes in the Vīdēvdād); the count C; never shown' },
  elder: { tier: 'C', why: "the quarter's elder hears neighbours' wrongs and settles feuds between houses (analogy: Near Eastern and Iranian village practice)" },
  expulsion: { tier: 'C', why: 'a stranger who will not keep the peace is put out of the town (analogy)' },
} as const;

/** what the law needs of the deed world (deeds/engine.ts provides it) */
export interface LawPort {
  pop: Population; seed: number; minds: Minds;
  econ(day: number): Economy | null; rumours(): RumourNet | null; near(pid: number, t: number): number[];
  hh(a: Actor, day: number): string | null; name(a: Actor): string;
  holds(a: Actor, g: Good, day: number): number;
  move(from: Actor | 'world', to: Actor | 'world', g: Good, amt: number, day: number): void;
  lay(pid: number, day: number, seg: Seg): void; layDays(pid: number, day: number, n: number, act: ActivityId, why: string): void;
  whereOf(place: string, pid: number, day: number): Where;
  injuries: Map<number, { how: string; day: number; until: number; by: Actor; why?: string }>;
}

export class Law {
  readonly cases: Case[] = [];
  readonly losses: Loss[] = [];
  readonly claims: Claim[] = [];
  readonly feuds: Feud[] = [];
  readonly marks: Mark[] = [];
  stranger: StrangerLaw = { owed: 0 };
  constructor(readonly p: LawPort) {}

  private side(a: Actor, day: number): string | null { return a === 'player' ? 'player' : this.p.hh(a, day); }
  private hid(h: string) { return +h.slice(2); }
  private qOf(h: string | null): string | undefined { return h && h !== 'player' ? this.p.pop.households[this.hid(h)]?.q : undefined; }
  private adults(h: string, day: number, min = 14): number[] { const P = this.p.pop; return h === 'player' ? [] : P.membersOn(this.hid(h), day).filter(x => P.present(x, day) && P.persons[x].dies > day && P.ageOn(x, day) >= min); }
  /** the head who speaks for a house: its eldest man under 70, else its eldest grown-up */
  head(h: string, day: number): number | null { const P = this.p.pop, a = this.adults(h, day, 16); if (!a.length) return null;
    const men = a.filter(x => P.persons[x].sex === 'm' && P.ageOn(x, day) < 70); return (men.length ? men : a).sort((x, y) => P.ageOn(y, day) - P.ageOn(x, day))[0]; }
  /** the house and its kin houses' grown people (those who take a wrong to one of them as their own) */
  kinOf(h: string, day: number): number[] { if (h === 'player') return []; const P = this.p.pop, H = P.households[this.hid(h)]; if (!H) return [];
    const out = this.adults(h, day); for (const k of H.kin.slice(0, 3)) out.push(...this.adults(`h:${k}`, day, 16).filter(x => P.persons[x].sex === 'm')); return out; }
  /** the quarter's elder: its eldest man still about (the one a neighbour's complaint is taken to; C) */
  elderOf(q: string | undefined, day: number): number | null {
    if (!q) return null; const k = `${q}:${day}`; if (this.elders_.has(k)) return this.elders_.get(k)!; if (this.elders_.size > 400) this.elders_.clear();
    const P = this.p.pop; let best: number | null = null, age = 49;
    for (const H of P.households) { if (H.q !== q) continue; for (const m of H.members) { const a = P.ageOn(m, day); if (P.persons[m].sex === 'm' && a > age && a < 80 && P.persons[m].dies > day && P.present(m, day) && P.home(m, day) === H.id) { best = m; age = a; } } }
    this.elders_.set(k, best); return best;
  }
  private elders_ = new Map<string, number | null>();
  /** the person is the elder of their own quarter (a complaint taken to them is a case) */
  isElder(pid: number, day: number) { return this.elderOf(this.qOf(this.p.hh(pid, day)), day) === pid; }
  private rumour(about: Actor, kind: string, hh: string, day: number) {
    const R = this.p.rumours(), E = this.p.econ(day); if (!R || !E?.hh.has(hh)) return;
    const ab = about === 'player' ? undefined : this.p.hh(about, day) ?? undefined; R.inject(day, hh, kind, 1, ab ?? hh, about === 'player' ? 'player' : ab);
  }
  private trustNote(hh: string | null, of: Actor, dv: number, day: number) { const E = this.p.econ(day); if (!hh || hh === 'player' || !E?.trust || !E.hh.has(hh)) return; const o = of === 'player' ? 'player' : this.p.hh(of, day); if (o && o !== hh) E.trust.note(hh, o, dv, day); }
  private mark(m: Omit<Mark, 'hhs'> & { hhs: (string | null)[] }) { this.marks.push({ ...m, hhs: [...new Set(m.hhs.filter((x): x is string => !!x && x !== 'player'))] }); }
  private worth(g: Good, amt: number, day: number) { const E = this.p.econ(day); if (g === 'silver') return amt; const pr = E ? E.price(g === 'bread' || g === 'food' ? 'grain' : g === 'fuel' ? 'fuel' : g === 'grain' ? 'grain' : 'goods', day) : 0.03; return amt * (Number.isFinite(pr) && pr > 0 ? pr : 0.03); }

  // ---------------------------------------------------------------- hooks from the engine
  /** a wrong reported to an elder or official, or seen: a case (the engine's 'law' effect) */
  file(offender: Actor, victim: Actor, crime: string, witnessed: boolean, day: number, o: Partial<Case> = {}): Case | null {
    const open = this.cases.find(c => c.accused === offender && c.victim === victim && c.crime === crime && !c.ruled);
    if (open) { if (o.seized) open.seized = true; if (witnessed) open.witnessed = true; if (o.court === 'judges') open.court = 'judges'; return open; }
    const grave = crime === 'killing' || crime === 'assault' && this.woundOf(victim, day) === 'broken';
    const court: Court = o.court ?? (offender === 'player' || grave || o.seized ? 'judges' : 'elder');
    const due = day + (o.seized ? 1 : 1 + (u01(this.p.seed, S.due, day, this.cases.length) * 3 | 0));
    const c: Case = { id: this.cases.length, day, due, accuser: o.accuser ?? victim, accused: offender, victim, crime, witnessed, court, ...o };
    if (c.innocent === undefined) c.innocent = !this.guilty(offender, victim, crime, day);
    this.cases.push(c); return c;
  }
  /** what the world knows to be true: did the accused do this wrong to the victim (recently)? */
  private guilty(a: Actor, v: Actor | null, crime: string, day: number): boolean {
    const vs = v === null ? null : this.side(v, day), cr = crime === 'killing' ? 'assault' : crime;
    if (cr === 'theft') return this.losses.some(l => l.thief === a && (vs === null || l.victim === v || l.hh === vs) && day - l.day < 60) || this.recent.some(r => r.verb === 'steal' && r.actor === a && (vs === null || r.target === v || (r.target !== undefined && this.side(r.target, day) === vs)) && day - r.day < 60);
    return this.recent.some(r => r.actor === a && (v === null || r.target === v || cr !== 'assault') && day - r.day < 60 && WRONG_VERB[r.verb] === cr);
  }
  private recent: { day: number; actor: Actor; target?: Actor; verb: string }[] = [];
  private woundOf(v: Actor, day: number) { const k = v === 'player' ? -1 : v; const i = this.p.injuries.get(k); return i && i.day >= day - 1 ? i.how : null; }

  /** after a deed is done: what the law takes up from it */
  after(rec: DeedRec) {
    const d = rec.deed, day = rec.day, t = rec.t, P = this.p.pop; if (!rec.out.ok) { this.refusedDemand(rec); return; }
    if (WRONG_VERB[d.verb]) { this.recent.push({ day, actor: d.actor, target: d.target, verb: d.verb }); if (this.recent.length > 400) this.recent.splice(0, 100); }
    const tg = d.target, wit = rec.out.witnesses ?? [], lawE = rec.out.effects.find(e => e.k === 'law');
    switch (d.verb) {
      case 'steal': { if (tg === undefined) break; const g = rec.out.effects.find(e => e.k === 'goods'); if (!g || g.k !== 'goods') break;
        if (!lawE && typeof tg === 'number') { // unseen: the house finds the loss later
          const nd = day + 1 + (u01(this.p.seed, S.notice, rec.id) * 3 | 0);
          this.losses.push({ id: this.losses.length, deed: rec.id, day, thief: d.actor, victim: tg, hh: this.p.hh(tg, day)!, good: g.good, amt: g.qty, noticeDay: nd }); break; }
        if (this.seize(rec, 'theft')) { this.p.move(d.actor, tg, g.good, g.qty, day); const c = this.cases.find(x => x.accused === d.actor && x.crime === 'theft' && !x.ruled); if (c) c.found = true; } // (caught with it: the goods go back at once)
        if (typeof tg === 'number') this.kinAnger(tg, d.actor, 0.15, day); break; }
      case 'attack': case 'push': { if (tg === undefined) break;
        const how = d.verb === 'push' ? 'push' : this.woundOf(tg, day) ?? 'bruised', sev = SEV[how] ?? 1;
        if (how === 'killed') { const c = this.file(d.actor, tg, 'killing', wit.length > 0, day, { court: 'judges' }); if (c) c.crime = 'killing'; }
        this.seize(rec, how === 'killed' ? 'killing' : 'assault');
        this.mark({ day, who: d.actor, kind: 'struck', crime: how, q: this.qOf(this.side(tg, day)), hhs: [this.side(tg, day), ...wit.map(x => this.p.hh(x, day))] });
        if (typeof tg === 'number') this.kinAnger(tg, d.actor, 0.12 * sev, day);
        this.feudBlow(d.actor, tg, how, sev, day, rec); break; }
      case 'break': this.seize(rec, 'damage'); if (typeof tg === 'number') this.kinAnger(tg, d.actor, 0.1, day); break;
      case 'lie': case 'tell': case 'warn': case 'accuse': {
        // a word against a third person: true if the world's record bears it out, else a lie the hearer may find out
        const hearer = tg, third = d.third ?? (d.verb === 'accuse' ? tg : undefined); if (typeof hearer !== 'number' || third === undefined || third === d.actor) break;
        const words = (d.about ?? d.said ?? '').toLowerCase(), bad = d.verb === 'accuse' || /steal|stole|thief|lie|liar|cheat|beat|hit|kill|adulter|curse|witch/.test(words);
        if (!bad && d.verb !== 'lie') break;
        const crime = /beat|hit|kill|struck/.test(words) ? 'assault' : 'theft', true_ = d.verb !== 'lie' && this.guilty(third, null, crime, day) || d.verb !== 'lie' && this.marks.some(m => m.who === third && day - m.day < 120);
        if (!true_ && hearer !== third) this.claims.push({ id: this.claims.length, deed: rec.id, day, liar: d.actor, hearer, third, until: day + 40 });
        break; }
      case 'give': case 'return': this.paid(rec); break;
      case 'ask_for': this.paid(rec); break;
      case 'apologize': case 'reconcile': { const f = this.feudOf(d.actor, tg ?? d.third, day);
        if (f && f.state !== 'settled' && f.state !== 'judged' && (d.verb === 'reconcile' || Math.max(...f.harm) <= 1)) this.settle(f, day, d.verb === 'reconcile' ? 'peace made' : 'an apology for a small wrong accepted'); break; }
    }
    void P; void t;
  }
  /** a wrong before the watch, a guard, or the grown men of the lane: the offender seized in the act (C) */
  private seize(rec: DeedRec, crime: string): boolean {
    const d = rec.deed, P = this.p.pop, day = rec.day, hour = rec.t - day * 24, wit = rec.out.witnesses ?? [];
    const guard = wit.find(x => P.persons[x].job === 'guard' || ['stand_guard', 'patrol'].includes(segAt(P.plan(x, day), hour).act));
    const tg = d.target, terrace = typeof tg === 'number' && segAt(P.plan(tg, day), hour).where === 'terrace';
    const men = wit.filter(x => P.persons[x].sex === 'm' && P.ageOn(x, day) >= 18 && P.ageOn(x, day) < 60).length;
    const p = guard !== undefined ? 0.85 : terrace ? 0.7 : men >= 2 ? 0.3 : 0;
    if (u01(this.p.seed, S.seize, rec.id) >= p) return false;
    const hearH = Math.ceil(hour + 0.5), why = `held by ${guard !== undefined ? 'the watch' : 'the men of the lane, then the watch'} at the officials' building for ${crime === 'theft' ? 'a theft' : crime === 'damage' ? 'damage done' : crime === 'killing' ? 'a killing' : 'a blow struck'}, until the king's judges hear it`;
    const c = this.file(d.actor, tg ?? 'player', crime, true, day, { seized: true, court: 'judges' }); if (!c) return false; c.seized = true; c.court = 'judges'; c.due = Math.min(c.due, day + 1);
    if (d.actor === 'player') this.stranger.held = { until: (day + 1) * 24 + 10, why };
    else { const pl = this.p.pop; this.p.lay(d.actor, day, { t0: Math.min(23.4, hearH), t1: 24, place: 'official_bldg', act: 'rest', why, where: 'town' });
      this.p.lay(d.actor, day + 1, { t0: 0, t1: 10, place: 'official_bldg', act: 'rest', why, where: 'town' }); void pl; }
    this.mark({ day, who: d.actor, kind: 'seized', crime, q: this.qOf(this.side(tg ?? 'player', day)), hhs: [this.side(tg ?? 'player', day), ...wit.map(x => this.p.hh(x, day))] });
    if (rec.out.why) rec.out.why += guard !== undefined ? '; the watch seize him in the act' : '; he is seized and held for the watch';
    return true;
  }
  private kinAnger(victim: number, by: Actor, a: number, day: number) {
    const h = this.p.hh(victim, day); if (!h) return;
    for (const x of this.kinOf(h, day)) if (x !== victim && x !== by) this.p.minds.move(x, by, { anger: a, aff: -a * 0.4 }, day);
  }

  // ---------------------------------------------------------------- feuds: compensation, escalation, the elders
  private feudOf(x: Actor, y: Actor | undefined, day: number): Feud | undefined {
    if (y === undefined) return undefined; const a = this.side(x, day), b = this.side(y, day); if (!a || !b) return undefined;
    return this.feuds.find(f => f.state !== 'settled' && f.state !== 'judged' && (f.a === a && f.b === b || f.a === b && f.b === a));
  }
  private feudBlow(by: Actor, victim: Actor, how: string, sev: number, day: number, rec: DeedRec) {
    const a = this.side(victim, day), b = this.side(by, day); if (!a || !b || a === b) return; // (within one house: no feud; the elder hears it if they complain)
    let f = this.feudOf(by, victim, day);
    if (!f) { f = { id: this.feuds.length, a, b, day, victim, by, harm: [0, 0], state: 'open', price: 0, paid: 0, due: day + 1, blows: 0, last: day }; this.feuds.push(f); }
    f.harm[f.a === a ? 0 : 1] += sev; f.blows++; f.last = day;
    f.price = this.balance(f); f.why = `${this.p.name(by)} struck ${this.p.name(victim)} (${how})`;
    if (f.state === 'demanded' || f.state === 'refused') f.state = 'open'; f.due = day + 1;
    void rec;
  }
  /** the balance of harms in silver: positive, b owes a; negative, a owes b */
  private balance(f: Feud) { const pr = (s: number) => s >= 6 ? WOUND_PRICE.killed : s >= 3 ? WOUND_PRICE.broken * s / 3 : s >= 2 ? WOUND_PRICE.cut * s / 2 : WOUND_PRICE.bruised * s; return +(pr(f.harm[0]) - pr(f.harm[1])).toFixed(3); }
  /** the debtor and creditor of a feud now */
  private parties(f: Feud, day: number) {
    const owesB = f.price >= 0, cred = owesB ? f.a : f.b, debt = owesB ? f.b : f.a;
    const credHead = cred === 'player' ? 'player' as Actor : this.head(cred, day), firstBy = owesB ? f.by : f.victim;
    const debtor: Actor | null = debt === 'player' ? 'player' : (typeof firstBy === 'number' && this.p.pop.present(firstBy, day) && this.p.pop.persons[firstBy].dies > day && this.p.hh(firstBy, day) === debt ? firstBy : this.head(debt, day));
    return { cred, debt, credHead, debtor, owed: Math.max(0, Math.abs(f.price) - f.paid) };
  }
  /** a demand answered: silver given (or taken with consent) from the debtor's side to the creditor's */
  private paid(rec: DeedRec) {
    const d = rec.deed, day = rec.day, g = rec.out.effects.find(e => e.k === 'goods'); if (!g || g.k !== 'goods') return;
    const from = g.from === 'world' ? null : this.side(g.from, day), to = g.to === 'world' ? null : this.side(g.to, day); if (!from || !to) return;
    // a thief giving back what was taken
    if (d.verb === 'return' || d.verb === 'give') for (const l of this.losses) if (!l.returned && l.thief === d.actor && l.hh === to && day - l.day < 90) { l.returned = true; if (typeof d.target === 'number') this.p.minds.move(d.target, d.actor, { anger: -0.2 }, day); }
    for (const f of this.feuds) { if (f.state === 'settled' || f.state === 'judged') continue; const pt = this.parties(f, day); if (pt.debt !== from || pt.cred !== to) continue;
      f.paid += this.worth(g.good, g.qty, day);
      if (f.paid >= Math.abs(f.price) - 1e-3) this.settle(f, day, `the compensation paid: ${Math.abs(f.price).toFixed(2)} shekels`); }
  }
  private refusedDemand(rec: DeedRec) {
    const d = rec.deed; if (d.verb !== 'ask_for' || !/compensation|blood-price/.test(d.about ?? '')) return;
    const f = this.feudOf(d.actor, d.target, rec.day); if (f && (f.state === 'demanded' || f.state === 'open')) { f.state = 'refused'; f.due = rec.day + 1; f.why = `${rec.out.refused ? 'refused' : 'cannot pay'}: ${rec.out.why}`; }
  }
  private settle(f: Feud, day: number, why: string) {
    f.state = 'settled'; f.why = why; f.last = day;
    for (const [s, o] of [[f.a, f.b], [f.b, f.a]] as const) for (const x of this.kinOf(s, day)) { const other = o === 'player' ? 'player' as Actor : this.head(o, day); if (other !== null) this.p.minds.move(x, other, { anger: -0.35 }, day);
      if (o !== 'player') for (const y of this.adults(o, day)) this.p.minds.move(x, y, { anger: -0.25 }, day); }
    if (f.a !== 'player' && f.b !== 'player') this.trustNote(f.a, this.head(f.b, day) ?? f.by, 0.04, day);
  }
  /** a feud's day: demand, escalate, or the elders settle (returns the deeds the people do about it) */
  private feudDay(f: Feud, day: number, out: Deed[]) {
    if (f.state === 'settled' || f.state === 'judged') return;
    if (day - f.last > 60) { this.settle(f, day, 'let lie: the anger spent'); return; }
    if (day < f.due) return;
    const pt = this.parties(f, day), u = (k: number) => u01(this.p.seed, S.feud, f.id, day, k), P = this.p.pop;
    if (pt.owed <= 1e-3) { this.settle(f, day, 'the harms even'); return; }
    if (pt.credHead === null || pt.debtor === null) { f.state = 'judged'; return; }
    const coins = Math.max(1, Math.round(pt.owed / 0.05));
    if (f.state === 'open') { // the creditor's head goes to the debtor and asks the price of the wound (a blood-price for a life)
      f.state = 'demanded'; f.due = day + (pt.debtor === 'player' ? 5 : 1);
      if (pt.credHead !== 'player') out.push({ verb: pt.debtor === 'player' ? 'accuse' : 'ask_for', actor: pt.credHead, target: pt.debtor, good: 'silver', qty: coins, about: `compensation for the blow: ${pt.owed.toFixed(2)} shekels${Math.abs(f.price) >= WOUND_PRICE.killed ? ' (the blood-price)' : ''}` });
      return; }
    // demanded and unpaid by its day, or refused: a kinsman's blow, or the elders
    if (f.state === 'demanded') { f.state = 'refused'; f.why = 'not paid by the day'; }
    if (pt.credHead === 'player') { f.state = 'judged'; return; } // (the stranger has no kin to take it up: a complaint is his own deed)
    const kin = this.kinOf(pt.cred, day).filter(x => P.persons[x].sex === 'm' && P.ageOn(x, day) >= 16 && P.ageOn(x, day) < 55 && (this.p.injuries.get(x)?.until ?? 0) <= day);
    const hot = kin.map(x => ({ x, a: this.p.minds.feelOf(x, pt.debtor!, day).anger, t: personaOf(P, x, day).temper })).filter(k => k.a > 0.35).sort((a, b) => b.a * b.t - a.a * a.t)[0];
    if (hot && f.blows < 3 && u(1) < 0.35 * hot.t + 0.1) { out.push({ verb: 'attack', actor: hot.x, target: pt.debtor, force: 0.35 + 0.3 * hot.t }); f.due = day + 2; return; }
    if (u(2) < 0.45 || f.blows >= 3) this.elders(f, pt, day, out); else f.due = day + 1;
  }
  /** the elders settle a feud: the balance paid (or worked off), peace sworn before them; the stranger's goes to the judges */
  private elders(f: Feud, pt: ReturnType<Law['parties']>, day: number, out: Deed[]) {
    if (pt.debtor === 'player') { const c = this.file('player', f.victim, 'assault', true, day, { court: 'judges', feud: f.id, accuser: pt.credHead ?? f.victim }); if (c) c.feud = f.id; f.state = 'judged'; f.why = "taken to the king's judges"; return; }
    const elder = this.elderOf(this.qOf(pt.cred), day) ?? this.elderOf(this.qOf(pt.debt), day);
    const pay = Math.min(pt.owed, this.p.holds(pt.debtor!, 'silver', day));
    if (pay > 0.01) { this.p.move(pt.debtor!, pt.credHead!, 'silver', pay, day); f.paid += pay; }
    const left = pt.owed - pay; if (left > 0.01) this.labour(pt.debtor as number, pt.cred, left, day, `the elders' settlement of the feud with the house of ${this.p.name(pt.credHead!)}`);
    if (elder !== null && pt.credHead !== null && elder !== pt.credHead && elder !== pt.debtor) out.push({ verb: 'reconcile', actor: elder, target: pt.credHead as number, third: pt.debtor! });
    this.settle(f, day, `settled by the elders${elder !== null ? ` (${this.p.name(elder)})` : ''}: ${pay.toFixed(2)} shekels paid${left > 0.01 ? `, ${Math.ceil(left / DAY_WAGE)} days of work for the rest` : ''}`);
  }
  /** work off silver owed in the creditor's house: laid into the worker's days (at most 12 days now: C) */
  private labour(pid: number, hh: string, amt: number, day: number, why: string): number {
    const days = Math.min(12, Math.ceil(amt / DAY_WAGE)), P = this.p.pop; if (hh === 'player') return 0;
    for (let k = 1; k <= days; k++) { const dd = day + k; if (P.persons[pid].dies <= dd) break;
      this.p.lay(pid, dd, { t0: 7, t1: 14, place: hh, act: P.persons[pid].sex === 'f' ? 'grind' : 'carry_sack', why: `working off what is owed: ${why}`, where: this.p.whereOf(hh, pid, dd) }); }
    return days;
  }

  // ---------------------------------------------------------------- the day: losses noticed, lies found, feuds, hearings
  /** the law's work for a day; returns the deeds people do because of it (the engine does them) */
  day(day: number): Deed[] {
    const out: Deed[] = [];
    for (const l of this.losses) this.lossDay(l, day, out);
    for (const c of this.claims) this.claimDay(c, day);
    for (const f of this.feuds) this.feudDay(f, day, out);
    for (const c of this.cases) if (!c.ruled && c.due <= day) this.rule(c, day, out);
    const S_ = this.stranger; if (S_.held && S_.held.until < day * 24) S_.held = undefined;
    return out;
  }
  private lossDay(l: Loss, day: number, out: Deed[]) {
    const P = this.p.pop, u = (k: number) => u01(this.p.seed, S.sus, l.id, day, k);
    if (!l.noticed && day >= l.noticeDay) {
      l.noticed = true; const sus = this.suspect(l, day); l.suspect = sus?.who; l.wrong = sus ? sus.who !== l.thief : undefined;
      this.rumour(l.victim, 'robbed', l.hh, day); // (the loss itself: the lane hears the house was robbed)
      const head = this.head(l.hh, day) ?? l.victim;
      if (sus) { for (const x of this.adults(l.hh, day)) this.p.minds.move(x, sus.who, { anger: 0.15 + 0.2 * sus.s, aff: -0.1 }, day);
        const elder = this.elderOf(this.qOf(l.hh), day);
        if (sus.s > 0.45 && elder !== null && elder !== head && elder !== sus.who) out.push({ verb: 'complain', actor: head, target: elder, third: sus.who, about: `stole ${l.good} from our store` });
        else if (sus.s > 0.45 && typeof sus.who === 'number') out.push({ verb: 'accuse', actor: head, target: sus.who, about: `you stole ${l.good} from our store` });
        else this.rumour(sus.who, 'theft', l.hh, day); }
      return; }
    if (!l.noticed || l.found !== undefined || day - l.day > 90) return;
    // the truth comes out: the goods seen in the thief's house, a neighbour's word; sooner once a wrong suspicion was dismissed
    const cleared = l.wrong && this.cases.some(c => c.loss === l.id && c.ruled === 'dismissed');
    if (u(3) < (l.thief === 'player' ? 0.04 : 0.06) + (cleared ? 0.25 : 0)) this.found(l, day, out);
    void P;
  }
  /** who the robbed house suspects, and how strongly (C): the thief's nearness and record; the stranger; a distrusted neighbour */
  private suspect(l: Loss, day: number): { who: Actor; s: number } | null {
    const P = this.p.pop, E = this.p.econ(day), tr = (o: Actor) => { const h = o === 'player' ? 'player' : this.p.hh(o, day); return E?.trust && h && E.hh.has(l.hh) ? E.trust.trustOf(l.hh, h, day) : 0.5; };
    const rec = (o: Actor) => this.marks.filter(m => m.who === o && (m.kind === 'convicted' || m.kind === 'seized') && (m.hhs.includes(l.hh) || m.q === this.qOf(l.hh))).length;
    const cand: { who: Actor; s: number }[] = [];
    const thQ = this.qOf(this.side(l.thief, day)), vQ = this.qOf(l.hh);
    cand.push({ who: l.thief, s: 0.3 + (thQ === vQ ? 0.15 : 0) + 0.2 * rec(l.thief) + 0.5 * (0.5 - tr(l.thief)) + 0.35 * u01(this.p.seed, S.sus, l.id, 1) });
    if (l.thief !== 'player' && E?.hasStranger) cand.push({ who: 'player', s: 0.25 + 0.2 * rec('player') + 0.5 * (0.5 - tr('player')) + 0.35 * u01(this.p.seed, S.sus, l.id, 2) }); // (the stranger is the first one a lane suspects)
    // a neighbour the house already distrusts, or one with a record
    const H = P.households[this.hid(l.hh)], lane = P.households.filter(x => x.q === H?.q && x.id !== H?.id && x.members.length);
    for (let k = 0; k < 3 && lane.length; k++) { const n = lane[Math.floor(u01(this.p.seed, S.sus, l.id, 10 + k) * lane.length)], who = this.head(`h:${n.id}`, day); if (who === null || who === l.thief) continue;
      cand.push({ who, s: 0.12 + 0.2 * rec(who) + 0.6 * (0.5 - tr(who)) + 0.35 * u01(this.p.seed, S.sus, l.id, 20 + k) }); }
    return cand.sort((a, b) => b.s - a.s)[0] ?? null;
  }
  /** the truth of a theft comes out: the thief named, a wrong suspicion cleared, a case brought against the thief */
  private found(l: Loss, day: number, out: Deed[]) {
    l.found = day; const head = this.head(l.hh, day) ?? l.victim;
    if (l.wrong && l.suspect !== undefined) { // the wrongly suspected house cleared: the robbed house's anger turns, and it owes them amends
      for (const x of this.adults(l.hh, day)) this.p.minds.move(x, l.suspect, { anger: -0.4, aff: 0.08 }, day);
      this.trustNote(l.hh, l.suspect, 0.06, day); if (l.suspect !== 'player') out.push({ verb: 'apologize', actor: head, target: l.suspect });
      else this.mark({ day, who: 'player', kind: 'acquitted', crime: 'theft', q: this.qOf(l.hh), hhs: [l.hh] }); }
    for (const x of this.adults(l.hh, day)) this.p.minds.move(x, l.thief, { anger: 0.35, aff: -0.2 }, day);
    this.rumour(l.thief, 'theft', l.hh, day);
    const c = this.file(l.thief, l.victim, 'theft', false, day, { found: this.p.holds(l.thief, l.good, day) > 0, loss: l.id, accuser: head });
    if (c) { c.loss = l.id; c.found = true; } l.caseId = c?.id;
  }
  private claimDay(c: Claim, day: number) {
    if (c.found !== undefined || day > c.until || day <= c.day) return; const P = this.p.pop, t = c.third;
    let p = 0.03; if (typeof t === 'number' && P.persons[t]) { const hh = this.p.hh(c.hearer, day), th = this.p.hh(t, day), H = P.households[P.home(c.hearer, day)];
      if (hh === th || P.persons[c.hearer].ties.includes(t) || P.persons[t].ties.includes(c.hearer) || (th && H?.kin.includes(this.hid(th)))) p += 0.25; else if (this.qOf(hh) === this.qOf(th)) p += 0.08; }
    if (u01(this.p.seed, S.lie, c.id, day) >= p) return;
    c.found = day; const M = this.p.minds;
    M.move(c.hearer, c.liar, { anger: 0.3, resp: -0.25, aff: -0.15 }, day);
    if (t !== undefined) M.move(c.hearer, t, { aff: 0.14, resp: 0.1, anger: -0.2 }, day);
    if (typeof t === 'number') M.move(t, c.liar, { anger: 0.3, aff: -0.15 }, day);
    const hh = this.p.hh(c.hearer, day); this.trustNote(hh, c.liar, -0.12, day); if (hh) this.rumour(c.liar, 'lie_found', hh, day);
    this.mark({ day, who: c.liar, kind: 'lie_found', q: this.qOf(hh), hhs: [hh, typeof t === 'number' ? this.p.hh(t, day) : null] });
  }

  // ---------------------------------------------------------------- the hearing
  private rule(c: Case, day: number, out: Deed[]) {
    const P = this.p.pop, E = this.p.econ(day), u = (k: number) => u01(this.p.seed, S.rule, c.id, k);
    const vh = this.side(c.victim, day), tq = vh && vh !== 'player' && E?.trust && E.hh.has(vh) ? E.trust.trustOf(vh, c.accused === 'player' ? 'player' : this.p.hh(c.accused, day)!, day) : 0.5;
    // a search of the accused's house for the goods (the elder's or the judges' men): found if they did it and still have it
    const loss = c.loss !== undefined ? this.losses[c.loss] : this.losses.find(l => l.thief === c.accused && (l.victim === c.victim || l.hh === vh) && l.found === undefined);
    if (c.crime === 'theft' && !c.found && loss && loss.thief === c.accused && this.p.holds(c.accused, loss.good, day) > 0 && u(1) < 0.65) { c.found = true; loss.found = day; }
    const priors = this.marks.filter(m => m.who === c.accused && m.kind === 'convicted').length;
    const ev = (c.seized ? 0.8 : 0) + (c.witnessed ? 0.5 : 0) + (c.found ? 0.7 : 0) + 0.15 * priors + 0.6 * (0.5 - tq) + (c.accused === 'player' ? 0.1 : 0) + (u(2) - 0.5) * 0.3 - 0.45;
    const court = c.court ?? 'elder', judge = court === 'elder' ? this.elderOf(this.qOf(vh), day) : null;
    const place = court === 'judges' ? 'official_bldg' : judge !== null ? `h:${P.home(judge, day)}` : 'official_bldg';
    const heard = court === 'judges' ? "before the king's judges" : 'before the elder of the quarter';
    for (const x of [c.accuser, c.accused]) if (typeof x === 'number' && P.present(x, day) && P.persons[x].dies > day)
      this.p.lay(x, day, { t0: 8, t1: 9.5, place, act: 'queue', why: `${heard}: ${x === c.accused ? 'accused of' : 'bringing a charge of'} ${c.crime}`, where: place === 'official_bldg' ? 'town' : this.p.whereOf(place, x, day) });
    if (c.accused === 'player' && this.stranger.held) this.stranger.held.until = day * 24 + 10;
    if (ev <= 0) { // not proved: dismissed; a wrong charge leaves the accused (if innocent) angry at the accuser
      c.ruled = 'dismissed'; c.why = `not proved ${heard}`;
      if (typeof c.victim === 'number') this.p.minds.move(c.victim, c.accused, { anger: 0.1 }, day);
      if (c.innocent && typeof c.accused === 'number' && c.accuser !== c.accused) { this.p.minds.move(c.accused, c.accuser, { anger: 0.35, aff: -0.15 }, day); for (const x of this.adults(this.p.hh(c.accused, day)!, day)) if (x !== c.accused) this.p.minds.move(x, c.accuser, { anger: 0.15 }, day); this.trustNote(this.p.hh(c.accused, day), c.accuser, -0.06, day); }
      this.mark({ day, who: c.accused, kind: 'acquitted', crime: c.crime, q: this.qOf(vh), hhs: [vh] });
      return; }
    const s = this.sentence(c, priors, day, loss); c.sentence = s; c.ruled = s.kind; c.fine = s.silver; c.why = `${heard}: ${s.why}`;
    // carried out: the silver from the offender (what he has); the rest worked off; the whip's aftermath; the stranger put out
    const have = this.p.holds(c.accused, 'silver', day), pay = Math.min(s.silver, have), to: Actor | 'world' = s.to === 'victim' ? c.victim : 'world';
    if (pay > 0) this.p.move(c.accused, to, 'silver', pay, day); s.paid = pay;
    if (c.crime === 'theft' && loss && !loss.returned && loss.thief === c.accused) { const back = Math.min(loss.amt, this.p.holds(c.accused, loss.good, day)); if (back > 0) this.p.move(c.accused, loss.victim, loss.good, back, day); loss.returned = true; }
    const left = s.silver - pay;
    if (left > 0.01) { if (c.accused === 'player') this.stranger.owed += left; else if (vh && vh !== 'player') { s.days = this.labour(c.accused as number, vh, left, day, `${c.crime} against the house of ${this.p.name(c.victim)}, by order ${heard}`); if (s.kind === 'compensated' || s.kind === 'fined') s.kind = c.ruled = 'labour'; } }
    if (s.strokes) { const k = c.accused === 'player' ? -1 : c.accused; this.p.injuries.set(k, { how: 'bruised', day, until: day + 6, by: c.victim, why: `flogged by order ${heard}` });
      if (typeof c.accused === 'number') this.p.layDays(c.accused, day, 2, 'lie_ill', `lying at home after the flogging ordered ${heard}`); }
    if (s.kind === 'expelled' && c.accused === 'player') { this.stranger.expelled = { day, why: `put out of the town by order ${heard}: ${s.why}` }; const E2 = this.p.econ(day);
      if (E2?.trust) for (const id of E2.hh.keys()) if (this.qOf(id)) E2.trust.note(id, 'player', -0.1, day); }
    // justice seen done: the victim's side's anger eases; the offender's record and the news of it
    if (vh) for (const x of this.kinOf(vh, day)) this.p.minds.move(x, c.accused, { anger: -0.3 }, day);
    if (typeof c.accused === 'number' && typeof c.accuser === 'number') this.p.minds.move(c.accused, c.accuser, { anger: 0.15, fear: 0.05 }, day);
    const hhs = [vh, judge !== null ? this.p.hh(judge, day) : null];
    this.mark({ day, who: c.accused, kind: 'convicted', crime: c.crime, q: this.qOf(vh), hhs }); if (s.strokes) this.mark({ day, who: c.accused, kind: 'flogged', crime: c.crime, q: this.qOf(vh), hhs });
    if (s.kind === 'expelled') this.mark({ day, who: c.accused, kind: 'expelled', crime: c.crime, q: this.qOf(vh), hhs });
    for (const h of hhs) if (h && h !== 'player') this.rumour(c.accused, 'convicted', h, day);
    if (vh && vh !== 'player') { this.trustNote(vh, c.accused, -0.05, day); const qq = this.qOf(vh); if (c.accused === 'player' && E?.trust) for (const id of E.hh.keys()) if (this.qOf(id) === qq && id !== vh) E.trust.note(id, 'player', -0.03, day); }
    if (c.feud !== undefined) { const f = this.feuds[c.feud]; if (f && f.state !== 'settled') { f.paid += pay; f.state = 'judged'; f.why = c.why; } }
    else for (const f of this.feuds) if (f.state !== 'settled' && f.state !== 'judged' && f.by === c.accused && f.victim === c.victim) { f.paid += s.to === 'victim' ? pay : 0; f.state = 'judged'; f.why = c.why; }
    if (['insult', 'threats', 'cursing'].includes(c.crime) && typeof c.accused === 'number' && c.victim !== c.accused) out.push({ verb: 'apologize', actor: c.accused, target: c.victim });
  }
  /** what the court orders, by the wrong, the harm, the record and who the offender is (tiers: LAW_EVIDENCE) */
  sentence(c: Case, priors: number, day: number, loss?: Loss): Sentence {
    const judges = c.court === 'judges', st = c.accused === 'player', wound = this.woundOf(c.victim, c.day) ?? this.p.injuries.get(c.victim === 'player' ? -1 : c.victim)?.how ?? 'bruised';
    const by = judges ? "the king's judges" : 'the elder';
    switch (c.crime) {
      case 'theft': { const w = loss ? this.worth(loss.good, loss.amt, day) : 0.3, comp = +Math.max(0.2, w).toFixed(3);
        if (st && priors >= 1) return { kind: 'expelled', silver: comp, to: 'victim', strokes: 1, paid: 0, tier: 'C', why: `a stranger twice a thief: the goods back, their worth again to the house, flogged and put out of the town (${LAW_EVIDENCE.expulsion.why})` };
        if (priors >= 1) return { kind: 'flogged', silver: comp, to: 'victim', strokes: 1, paid: 0, tier: 'B', why: `a thief again: the goods back and their worth again, and the whip (${LAW_EVIDENCE.flogging.why})` };
        return { kind: 'compensated', silver: comp, to: 'victim', paid: 0, tier: 'B', why: `the goods given back and their worth again to the house robbed, ${comp.toFixed(2)} shekels (${LAW_EVIDENCE.silver.why})` }; }
      case 'killing': return { kind: st ? 'expelled' : 'flogged', silver: WOUND_PRICE.killed, to: 'victim', strokes: 1, paid: 0, tier: 'C', why: `the blood-price of ${WOUND_PRICE.killed} shekels to the house of the dead, the whip${st ? ', and put out of the town under guard' : ''} (${LAW_EVIDENCE.record.why}; no death sentence for one deed)` };
      case 'assault': { const comp = WOUND_PRICE[wound] ?? 0.5, fine = judges ? 0.5 : 0, grave = wound === 'broken';
        if (st && (priors >= 2 || grave && priors >= 1)) return { kind: 'expelled', silver: comp + fine, to: 'victim', strokes: 1, paid: 0, tier: 'C', why: `a stranger who will not keep the peace: compensation for the wound, the whip, put out of the town (${LAW_EVIDENCE.expulsion.why})` };
        if (grave || priors >= 2) return { kind: 'flogged', silver: comp + fine, to: 'victim', strokes: 1, paid: 0, tier: 'B', why: `compensation for the wound (${comp} shekels)${fine ? ` and a fine to the king` : ''}, and the whip (${LAW_EVIDENCE.flogging.why})` };
        return { kind: judges ? 'fined' : 'compensated', silver: comp + fine, to: 'victim', paid: 0, tier: 'C', why: `compensation for the wound, ${(comp + fine).toFixed(2)} shekels to the house struck (${judges ? LAW_EVIDENCE.judges.why : LAW_EVIDENCE.elder.why})` }; }
      case 'damage': return { kind: 'compensated', silver: 0.6, to: 'victim', paid: 0, tier: 'C', why: `the damage made good, 0.6 shekels (${LAW_EVIDENCE.silver.why})` };
      default: return { kind: 'fined', silver: c.crime === 'threats' ? 0.2 : 0.15, to: 'victim', paid: 0, tier: 'C', why: `a small fine to the house wronged by ${by}, and an apology before them (${LAW_EVIDENCE.elder.why})` };
    }
  }

  // ---------------------------------------------------------------- reading: the record, the brief
  /** what a person's house knows of the doer's wrongs (for the mind's decision): -1..0 and the words for it */
  record(pid: number, of: Actor, day: number): { v: number; why: string } | null {
    const hh = this.p.hh(pid, day), q = this.qOf(hh); let v = 0, why = '';
    for (const m of this.marks) { if (m.who !== of || day - m.day > 365 || m.kind === 'acquitted') continue; const near = hh !== null && m.hhs.includes(hh) ? 1 : m.q !== undefined && m.q === q ? 0.5 : 0; if (!near) continue;
      const w = (m.kind === 'convicted' ? 0.3 : m.kind === 'lie_found' ? 0.25 : m.kind === 'expelled' ? 0.5 : m.kind === 'seized' ? 0.15 : m.kind === 'struck' ? 0.12 : 0.1) * near;
      if (w > Math.abs(v) * 0.5 && !why) why = m.kind === 'lie_found' ? 'knows him for a liar' : m.kind === 'convicted' ? `knows him convicted of ${m.crime}` : m.kind === 'struck' ? 'knows he strikes people' : m.kind === 'expelled' ? 'knows he was put out of the town' : 'knows he was seized by the watch';
      v -= w; }
    return v < -0.01 ? { v: cl(v, -1, 0), why } : null;
  }
  /** the wound's stage (fresh, mending, nearly healed) */
  wound(pid: Actor, day: number): { how: string; stage: 'fresh' | 'mending' | 'healing'; left: number } | null {
    const i = this.p.injuries.get(pid === 'player' ? -1 : pid); if (!i || i.until <= day || i.how === 'killed') return null;
    const f = (day - i.day) / Math.max(1, i.until - i.day); return { how: i.how, stage: f < 0.25 ? 'fresh' : f < 0.7 ? 'mending' : 'healing', left: i.until - day };
  }
  /** a person's brief lines about the law and the stranger (out of world) */
  briefOf(pid: number, day: number): string[] {
    const out: string[] = [], hh = this.p.hh(pid, day); if (!hh) return out;
    for (const f of this.feuds) { if (f.state === 'settled' || day - f.last > 30) continue; const mine = f.a === hh ? f.b : f.b === hh ? f.a : null; if (!mine) continue;
      const who = mine === 'player' ? 'the stranger' : `the house of ${this.p.name(this.head(mine, day) ?? -1)}`;
      out.push(f.state === 'judged' ? `Your house's quarrel with ${who} is before the judges.` : `Your house has a quarrel with ${who}: ${f.why ?? 'a blow'}${Math.abs(f.price) - f.paid > 0.01 ? `; ${((f.price >= 0) === (f.a === hh)) ? 'they owe your house' : 'your house owes them'} ${(Math.abs(f.price) - f.paid).toFixed(2)} shekels` : ''}.`); }
    const r = this.record(pid, 'player', day); if (r) out.push(`About the stranger: you ${r.why.replace(/^knows/, 'know')}.`);
    for (const l of this.losses) if (l.hh === hh && l.noticed && day - l.noticeDay < 20) out.push(l.found !== undefined ? `Your house's ${l.good} was stolen; it came out that ${l.thief === 'player' ? 'the stranger' : this.p.name(l.thief)} took it.` : `Your house's ${l.good} was stolen ${day - l.noticeDay < 2 ? 'lately' : 'some days ago'}${l.suspect !== undefined ? `; your house suspects ${l.suspect === 'player' ? 'the stranger' : this.p.name(l.suspect)}` : ''}.`);
    const w = this.wound(pid, day); if (w && this.p.injuries.get(pid)?.why) out.push(`You were ${this.p.injuries.get(pid)!.why} and are still sore.`);
    return out.slice(0, 4);
  }

  save() { return { cases: this.cases, losses: this.losses, claims: this.claims, feuds: this.feuds, marks: this.marks, stranger: this.stranger, recent: this.recent }; }
  load(s: Partial<ReturnType<Law['save']>> | undefined) {
    const put = <T>(a: T[], b?: T[]) => a.splice(0, a.length, ...(b ?? []));
    put(this.cases, s?.cases); put(this.losses, s?.losses); put(this.claims, s?.claims); put(this.feuds, s?.feuds); put(this.marks, s?.marks); put(this.recent, s?.recent);
    this.stranger = s?.stranger ?? { owed: 0 };
  }
}

/** the deeds that are wrongs, by the law's word for them */
const WRONG_VERB: Record<string, string> = { steal: 'theft', attack: 'assault', push: 'assault', break: 'damage', insult: 'insult', threaten: 'threats', curse: 'cursing' };
