// D-352 (UD-25 mechanic 5; UD-24, UD-26): RUMOUR AND INFORMATION SPREADING beyond the living world's player news. Node side.
//
// What is known, by whom, how distorted, how it moves, what it makes people do. A rumour is born from an economy event (a
// death, a theft, a default, a fire, a hunger...), from a player's deed (inject), or from the relations layer's scandal news
// (fromRelations); the ones who saw or did it know it first (the house, the other party, the witnesses the kind of event
// gives: a fire is seen by the lane, a theft by nobody). Day by day it moves along the TIES of the households: kin (the economy's
// own kin lists), neighbours (the lane: the houses either side in the quarter), work (the same trade in the quarter) and
// trade (the creditors and debtors of the economy, and a seeded two partners across the quarters); a holder tells within
// three days of learning, less and less far on (hand by hand), by the news's salience and the tie's warmth. Every telling is
// a new version, distorted by a seeded draw per HAND (C): the amount swells or shrinks (a lognormal walk with a bias to the
// dramatic), the kind may harden (illness becomes death, a default a theft), the suspect of a theft may shift to a neighbour,
// and the holder's certainty falls with each hand and rises with corroboration from a second teller. What a hearer DOES is
// drawn from the kind, the tie and their own temper: help (a real gift through the sink, from the giver's own surplus),
// avoid (the subject, or the suspect), demand (a creditor pressing), flee (the quarter in a run of sickness), gossip (the
// retelling). Pure: a function of the seed, the economy's events and the ledger of injected news; save/load carries the state.
// Tier C throughout: the tie warmth, salience, distortion sizes and action odds are reasoned, not attested (D-352).
import type { Economy, EconEvent } from '../economy/world';
import type { Intent } from '../economy/api';
import { u01, salt } from '../hash';

const S = { tell: salt('rum-tell'), dist: salt('rum-dist'), wit: salt('rum-wit'), act: salt('rum-act'), trade: salt('rum-trade'), sus: salt('rum-suspect'), drift: salt('rum-kind') };
export type Tie = 'kin' | 'neighbour' | 'work' | 'trade' | 'origin';
export type Act = 'help' | 'avoid' | 'demand' | 'flee' | 'gossip';
/** what a rumour is about: the kinds of economy event that are talked of, with how far they carry (salience) and how many of the
 *  lane see them at once (witness odds per neighbouring house) (C) */
const NEWS: Record<string, { sal: number; wit: number; scandal: number }> = {
  death: { sal: 0.9, wit: 0.3, scandal: 0 }, illness: { sal: 0.55, wit: 0.2, scandal: 0 }, theft: { sal: 0.85, wit: 0.03, scandal: 0.8 }, default: { sal: 0.7, wit: 0.1, scandal: 0.5 },
  house_fire: { sal: 0.95, wit: 0.8, scandal: 0 }, hunger: { sal: 0.5, wit: 0.15, scandal: 0.2 }, suit: { sal: 0.6, wit: 0.1, scandal: 0.4 }, arrest: { sal: 0.8, wit: 0.2, scandal: 0.6 },
  pledge_seized: { sal: 0.6, wit: 0.2, scandal: 0.4 }, debt_labour: { sal: 0.55, wit: 0.1, scandal: 0.4 }, animal_lost: { sal: 0.5, wit: 0.2, scandal: 0 }, harvest_good: { sal: 0.4, wit: 0.3, scandal: 0 },
  loan: { sal: 0.25, wit: 0.05, scandal: 0 }, acquitted: { sal: 0.5, wit: 0.2, scandal: 0 }, scandal: { sal: 0.85, wit: 0, scandal: 1 }, player_deed: { sal: 0.8, wit: 0, scandal: 0.2 }
};
/** a teller tells over a tie with this warmth (C) */
const WARM: Record<Tie, number> = { kin: 0.55, neighbour: 0.4, work: 0.3, trade: 0.2, origin: 1 };
const HARDEN: Record<string, string> = { illness: 'death', hunger: 'death', default: 'theft', suit: 'arrest' };
const MAXHAND = 7, TELL_DAYS = 3, SIGMA = 0.28;
export interface Version { kind: string; amount: number; /** the house it is said to be about (may drift) */ about: string; suspect?: string; certainty: number }
export interface Hold { hh: string; day: number; hand: number; from: string; tie: Tie; v: Version; acts: Act[] }
export interface Rumour { id: number; src: string; ev: number; day: number; truth: Version; origin: string; sal: number; scandal: number; holds: Map<string, Hold>; front: string[] }
export interface RumourOpts { /** a real gift: the hearer helps; the sink enters it (the giver's stores are lowered by the layer: giveFrom) */ sink?: (i: Intent) => void; hhOf?: (pid: number) => string }
const cl = (x: number, a = 0, b = 1) => x < a ? a : x > b ? b : x;
/** a teller's gift to a house in want, from their own surplus: the economy lowers the giver's grain (the living world does the same for its talk) */
export function giveFrom(econ: Economy, i: Intent): boolean {
  const g = econ.hh.get(i.from), r = econ.hh.get(i.to); const kg = Number(i.payload.grain ?? 0); if (!g || !r || g.dead || g.grain < g.eaters * 0.55 * 45 + kg) return false;
  g.grain -= kg; econ.enter(i); return true;
}

export class RumourNet {
  readonly rumours: Rumour[] = [];
  /** the ties of each household (lazily built; dynamic trade ties from the economy's debts are read each day) */
  private ties = new Map<string, [string, Tie][]>(); private ids: string[]; private idx = new Map<string, number>();
  private evSeen = 0; private upTo = -1; private nextId = 0; private injected: { day: number; hh: string; kind: string; amount: number; about: string }[] = [];
  private byQ = new Map<string, string[]>(); private byQK = new Map<string, string[]>();
  /** the quarter's run of sickness (illness and death news on its houses): the day of each, for the flight rule */
  private sick = new Map<string, number[]>();
  /** the stance of a house toward another: who avoids whom, who presses whom (read by the plans and the voice layer) */
  readonly stance = new Map<string, Set<Act>>();
  stats = { born: 0, tellings: 0, acts: {} as Record<string, number>, hopsKnown: [] as number[], hopsTrue: [] as number[], hopsLogErr: [] as number[], reach: [] as { r: number; days: number[] }[], sal: {} as Record<string, number> };
  constructor(readonly econ: Economy, readonly seed: number, readonly opts: RumourOpts = {}) {
    this.ids = [...econ.hh.keys()]; this.ids.forEach((id, i) => this.idx.set(id, i));
    for (const h of econ.hh.values()) { (this.byQ.get(h.q) ?? this.byQ.set(h.q, []).get(h.q)!).push(h.id); const k = h.q + '|' + h.kind; (this.byQK.get(k) ?? this.byQK.set(k, []).get(k)!).push(h.id); }
  }
  get day() { return this.upTo; }
  /** the standing ties of a house: kin, the lane (three each side), the trade (three of the same kind in the quarter), two seeded trade partners of other kinds */
  tiesOf(id: string): [string, Tie][] {
    let t = this.ties.get(id); if (t) return t; t = []; const h = this.econ.hh.get(id)!, seen = new Set<string>([id]); const add = (x: string, k: Tie) => { if (x && !seen.has(x) && this.econ.hh.has(x)) { seen.add(x); t!.push([x, k]); } };
    for (const k of h.kin) add(k, 'kin');
    const q = this.byQ.get(h.q)!, i = q.indexOf(id); for (const d of [-1, 1, -2, 2, -3, 3]) if (q[i + d]) add(q[i + d], 'neighbour');
    const w = this.byQK.get(h.q + '|' + h.kind)!, j = w.indexOf(id); for (const d of [1, -1, 2]) add(w[(j + d + w.length) % w.length], 'work');
    for (let k = 0; k < 2; k++) add(this.ids[Math.floor(u01(this.seed, S.trade, this.idx.get(id)!, k) * this.ids.length)], 'trade');
    this.ties.set(id, t); return t;
  }
  private tiesToday(id: string): [string, Tie][] { // the standing ties and the debts' (creditors and debtors) today
    const base = this.tiesOf(id), h = this.econ.hh.get(id)!; if (!h.debts.length) return base; const x = [...base], s = new Set(base.map(b => b[0]));
    for (const d of h.debts) if (this.econ.hh.has(d.to) && !s.has(d.to)) { s.add(d.to); x.push([d.to, 'trade']); } return x;
  }
  // ---- births ----
  private born(src: string, ev: number, day: number, origin: string, truth: Version, witnessQ?: string): Rumour | null {
    const n = NEWS[src]; if (!n || !this.econ.hh.has(origin)) return null;
    const r: Rumour = { id: this.nextId++, src, ev, day, truth, origin, sal: n.sal, scandal: n.scandal, holds: new Map(), front: [] }; this.rumours.push(r); this.stats.born++; this.stats.sal[src] = (this.stats.sal[src] ?? 0) + 1;
    this.learn(r, origin, day, 0, origin, 'origin', truth);
    if (truth.about !== origin) this.learn(r, truth.about, day, 0, truth.about, 'origin', truth);
    if (witnessQ) for (const w of this.byQ.get(witnessQ) ?? []) { const i = this.idx.get(w)!; if (!r.holds.has(w) && u01(this.seed, S.wit, r.id, i) < n.wit * (this.tiesOf(origin).some(t => t[0] === w && t[1] === 'neighbour') ? 1 : 0.15)) this.learn(r, w, day, 0, origin, 'origin', truth); }
    return r;
  }
  private learn(r: Rumour, hh: string, day: number, hand: number, from: string, tie: Tie, v: Version) {
    if (!this.econ.hh.get(hh) || this.econ.hh.get(hh)!.dead) return; const old = r.holds.get(hh);
    if (old) { old.v.certainty = cl(old.v.certainty + 0.1); return; } // a second teller: what was heard is trusted more
    const acts = this.decide(r, hh, hand, tie, v, day); const h: Hold = { hh, day, hand, from, tie, v, acts }; r.holds.set(hh, h); r.front.push(hh);
    if (hand > 0) { this.stats.hopsKnown[hand] = (this.stats.hopsKnown[hand] ?? 0) + 1; const t = r.truth; const same = v.kind === t.kind && v.about === t.about && v.suspect === t.suspect && Math.abs(v.amount / Math.max(1e-9, t.amount) - 1) < 0.25;
      if (same) this.stats.hopsTrue[hand] = (this.stats.hopsTrue[hand] ?? 0) + 1; this.stats.hopsLogErr[hand] = (this.stats.hopsLogErr[hand] ?? 0) + Math.abs(Math.log(Math.max(1e-9, v.amount) / Math.max(1e-9, t.amount))); }
  }
  /** a player's deed in the world becomes news (the living world's news of it carries on; this carries it past three hands) */
  inject(day: number, hh: string, kind: string, amount: number, about = hh) { this.injected.push({ day, hh, kind, amount, about }); this.birthInjected(day, hh, kind, amount, about); }
  private birthInjected(day: number, hh: string, kind: string, amount: number, about: string) { this.born('player_deed', -1, day, hh, { kind, amount, about, certainty: 1 }, this.econ.hh.get(hh)?.q); }
  /** the relations layer's scandal news (Relations.news: who it is about, what) carried along the same ties; `hhOf` maps a person to their household */
  fromRelations(news: { day: number; about: number[]; ev: number; what: string }[], hhOf: (pid: number) => string | undefined) {
    for (const n of news) { if (n.day > this.upTo + 1) continue; const a = hhOf(n.about[0]); if (!a || !this.econ.hh.has(a) || this.rumours.some(r => r.src === 'scandal' && r.ev === n.ev)) continue;
      this.born('scandal', n.ev, n.day, a, { kind: n.what, amount: 1, about: a, certainty: 0.8 }); }
  }
  // ---- what a hearer does ----
  private decide(r: Rumour, hh: string, hand: number, tie: Tie, v: Version, day: number): Act[] {
    const acts: Act[] = ['gossip'], h = this.econ.hh.get(hh)!, i = this.idx.get(hh)!, u = (k: number) => u01(this.seed, S.act, r.id, i, k), subj = v.about;
    if (hh === subj) return acts;
    const near = tie === 'kin' || tie === 'neighbour' || tie === 'origin';
    if (/^(death|illness|hunger|house_fire|animal_lost)$/.test(v.kind) && near && hand <= 3 && u(1) < (tie === 'kin' ? 0.55 : 0.3) * v.certainty && h.grain > h.eaters * 0.55 * 45) {
      acts.push('help'); this.bumpAct('help'); this.opts.sink?.({ kind: 'help', from: hh, to: subj, day, payload: { grain: Math.round(h.eaters * 0.55 * 3 * 10) / 10, src: 'rumour', causes: r.ev } }); }
    if (/^(theft|arrest|default|debt_labour|pledge_seized)$/.test(v.kind) || r.scandal > 0.5) { const tgt = v.suspect ?? subj;
      if (u(2) < 0.3 + 0.4 * r.scandal * v.certainty && tgt !== hh) { acts.push('avoid'); this.bumpAct('avoid'); this.setStance(hh, tgt, 'avoid'); } }
    if (v.kind === 'default' || v.kind === 'theft') { if (h.debts.length === 0 && this.econ.hh.get(subj)?.debts.some(d => d.to === hh) && u(3) < 0.6) { acts.push('demand'); this.bumpAct('demand'); this.setStance(hh, subj, 'demand'); } }
    if (v.kind === 'illness' || v.kind === 'death') { const q = this.econ.hh.get(subj)?.q; if (q) { const l = (this.sick.get(q) ?? []).filter(d => d > day - 10); l.push(day); this.sick.set(q, l);
      if (l.length >= 8 && h.q === q && u(4) < 0.12 * v.certainty && !acts.includes('flee')) { acts.push('flee'); this.bumpAct('flee'); this.setStance(hh, 'q:' + q, 'flee'); } } }
    return acts;
  }
  private bumpAct(a: string) { this.stats.acts[a] = (this.stats.acts[a] ?? 0) + 1; }
  private setStance(a: string, b: string, act: Act) { const k = a + '>' + b; (this.stance.get(k) ?? this.stance.set(k, new Set()).get(k)!).add(act); }
  stanceOf(hh: string, about: string): Act[] { return [...(this.stance.get(hh + '>' + about) ?? [])]; }

  // ---- the days ----
  /** move the news of the economy's day `day` (call after Economy.step(day) and AskBook.advance, once a day, in order) */
  advance(day: number) {
    if (day <= this.upTo) return; this.upTo = day; const evs = this.econ.events;
    const fresh = evs.slice(this.evSeen).filter(e => e && e.actor); this.evSeen = evs.length;
    for (const e of fresh) this.fromEvent(e);
    for (const r of this.rumours) this.spread(r, day);
    if (day % 7 === 0) this.sampleReach(day);
  }
  private fromEvent(e: EconEvent) {
    const kind = e.kind; if (!NEWS[kind] || kind === 'loan' || !this.econ.hh.has(e.actor)) return;
    const h = this.econ.hh.get(e.actor)!; let about = e.actor, origin = e.actor, amount = e.amt ?? 1, suspect: string | undefined;
    if (kind === 'theft') { // the news is of the victim's loss; the thief is unknown (nobody saw), and the lane names a suspect by its own suspicion (C)
      const v = e.other!; if (!this.econ.hh.has(v)) return; origin = v; about = v;
      const lane = this.byQ.get(this.econ.hh.get(v)!.q)!; suspect = u01(this.seed, S.sus, e.id) < 0.3 ? e.actor : lane[Math.floor(u01(this.seed, S.sus, e.id, 1) * lane.length)]; }
    if (kind === 'suit') { about = e.other ?? e.actor; origin = e.actor; }
    this.born(kind, e.id, e.day, origin, { kind: kind === 'theft' ? 'theft' : kind, amount: Math.max(1e-3, amount), about, suspect, certainty: 1 }, h.q);
  }
  private distort(r: Rumour, v: Version, from: string, to: string, day: number, hand: number): Version {
    const i = this.idx.get(to)!, u = (k: number) => u01(this.seed, S.dist, r.id, i, k * 131 + day);
    const z = (u(1) + u(2) + u(3) - 1.5) * 2;                                   // ~N(0,1)
    const amount = Math.max(1e-3, v.amount * Math.exp(SIGMA * z + 0.06 * (r.scandal + r.sal) * (hand > 1 ? 1 : 0.4)));
    let kind = v.kind; if (HARDEN[kind] && u(4) < 0.06 * (1 + r.sal)) kind = HARDEN[kind];
    let suspect = v.suspect; if (suspect && u(5) < 0.1) { const lane = this.byQ.get(this.econ.hh.get(to)!.q)!; suspect = lane[Math.floor(u(6) * lane.length)]; }
    let about = v.about; if (u(7) < 0.03) { const lane = this.byQ.get(this.econ.hh.get(about)?.q ?? '') ?? []; if (lane.length) about = lane[Math.floor(u(8) * lane.length)]; } // the wrong house named (C)
    void from; return { kind, amount, about, suspect, certainty: cl(v.certainty * 0.88) };
  }
  private spread(r: Rumour, day: number) {
    if (!r.front.length) return; const tellers = r.front.filter(h => { const x = r.holds.get(h)!; return day - x.day <= TELL_DAYS && x.hand < MAXHAND && day >= x.day; }); // (told the day they learned, and for three days)
    const live = [...r.holds.values()].filter(x => day - x.day <= TELL_DAYS && x.hand < MAXHAND && x.day <= day).map(x => x.hh);
    const learnedToday: [string, Hold][] = [];
    for (const t of new Set([...tellers, ...live])) { const x = r.holds.get(t)!; if (x.day === day && x.hand > 0) continue; // (no telling the day it was heard: news takes a day to walk)
      for (const [o, tie] of this.tiesToday(t)) {
        const p = cl(WARM[tie] * r.sal * Math.pow(0.88, x.hand) * (0.5 + 0.5 * x.v.certainty) * (r.scandal > 0.5 ? 1.15 : 1) / TELL_DAYS * 1.6);
        if (u01(this.seed, S.tell, r.id, this.idx.get(t)! * 4096 + this.idx.get(o)!, day) >= p) continue; this.stats.tellings++;
        const known = r.holds.get(o); if (known) { known.v.certainty = cl(known.v.certainty + 0.05); continue; }
        learnedToday.push([o, { hh: o, day, hand: x.hand + 1, from: t, tie, v: this.distort(r, x.v, t, o, day, x.hand + 1), acts: [] }]); }
    }
    r.front = r.front.filter(h => day - r.holds.get(h)!.day < TELL_DAYS);
    for (const [o, x] of learnedToday) this.learn(r, o, day, x.hand, x.from, x.tie, x.v);
  }
  private sampleReach(day: number) { // kept small: the share of houses knowing each young rumour at days 1, 3, 7 of its life, recorded once
    for (const r of this.rumours) { if (day - r.day < 7 || day - r.day >= 14) continue; if (this.stats.reach.some(x => x.r === r.id)) continue;
      const d = [1, 3, 7].map(k => [...r.holds.values()].filter(h => h.day <= r.day + k).length); this.stats.reach.push({ r: r.id, days: d }); }
  }
  // ---- reading ----
  /** what a house knows on a day, and how it was told to them (for the voice layer) */
  knownBy(hh: string, day = this.upTo): { rumour: number; src: string; since: number; hand: number; from: string; tie: Tie; version: Version; truth: Version; acts: Act[] }[] {
    const out = []; for (const r of this.rumours) { const h = r.holds.get(hh); if (h && h.day <= day) out.push({ rumour: r.id, src: r.src, since: h.day, hand: h.hand, from: h.from, tie: h.tie, version: h.v, truth: r.truth, acts: h.acts }); } return out;
  }
  /** the state for the save: the rumours with their holders, the ledger, the counters */
  save() {
    return { upTo: this.upTo, evSeen: this.evSeen, nextId: this.nextId, injected: this.injected, stats: this.stats, sick: [...this.sick], stance: [...this.stance].map(([k, v]) => [k, [...v]]),
      rumours: this.rumours.map(r => ({ ...r, holds: [...r.holds.values()] })) };
  }
  load(s: ReturnType<RumourNet['save']>) {
    this.rumours.length = 0; this.upTo = s.upTo; this.evSeen = s.evSeen; this.nextId = s.nextId; this.injected = JSON.parse(JSON.stringify(s.injected)); this.stats = JSON.parse(JSON.stringify(s.stats));
    this.sick = new Map(JSON.parse(JSON.stringify(s.sick))); this.stance.clear(); for (const [k, v] of s.stance as [string, Act[]][]) this.stance.set(k, new Set(v));
    for (const r of JSON.parse(JSON.stringify(s.rumours)) as (Omit<Rumour, 'holds'> & { holds: Hold[] })[]) this.rumours.push({ ...r, holds: new Map(r.holds.map(h => [h.hh, h])) });
  }
}
