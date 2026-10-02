// D-459 (UD-32): THE DEED ENGINE. One judge for every deed of every actor: the stranger's (from his words, deeds/parse.ts or
// the model's reading, deeds/extract.ts) and every person's own (their mind's initiative, mind/minds.ts deeds(), day by day,
// with or without the stranger). For a deed at time t:
//   1. can it be done: the doer and the other alive and here, awake for what needs them awake, the goods in hand, within two
//      days; the period's limits (no courting a child, no harm to a child: the grown-ups near stop it);
//   2. is the other willing (deeds that need consent): their mind decides (Minds.decide);
//   3. what follows: feelings both ways, the house's trust, goods moved through the economy's own stores, wounds (a death only
//      under the population's own rules), news through the rumour net, a complaint to the quarter's elder and a ruling (a fine
//      in silver, paid house to house; C), promises held to their day, a skill learned, work done for a house, and the day
//      plans: the people the deed takes somewhere go there and do it (an overlay of the plans, like the economy's and the talk's).
// Witnesses (the people at the same place) remember, and a wrong they saw becomes news. Everything is logged; the stranger's
// deeds are saved with the log, the minds' are drawn again from the same state (seeded), so a reload goes on the same.
// Tier C throughout (DECISIONS D-459): the law's fines and the elder's hearing are reconstructed from the Achaemenid evidence of
// royal judges and fines in silver (B for the institution, C for the amounts and the village elder's part).
import type { Population, Seg, Where } from '../population';
import { segAt, OPEN_PLACE, wetHours } from '../population';
import type { Economy } from '../economy/world';
import type { RumourNet } from '../asks/rumour';
import type { ActivityId } from '../activities';
import { u01, salt } from '../hash';
import { Minds, type MindCtx } from '../mind/minds';
import { Initiative } from '../mind/initiative';
import { VERBS } from './verbs';
import { Joint, sayNo, HIRE_WAGE } from './joint';
import type { Actor, Deed, DeedRec, Effect, Outcome, Good } from './types';
import { Law, type Case } from './law';
export type { Case } from './law';

export interface WorldPort {
  pop: Population; seed: number;
  /** the economy as built about the day (null before it is) */ econ: (day: number) => Economy | null;
  rumours: () => RumourNet | null;
  /** the people at the same place as pid at time t (the world's own reading of the plans; light: the town's own deeds, D-461) */ near: (pid: number, t: number, light?: boolean) => number[];
}
const S = { hour: salt('deed-hour'), law: salt('deed-law'), fight: salt('deed-fight') };
/** the work done out of doors wherever it is laid (D-461: not laid in the rain or the dust) */
const OUTDOOR_ACT = new Set(['mould_brick', 'lay_brick', 'field_work', 'plough', 'reap', 'thresh', 'dig_canal', 'irrigate', 'herd', 'garden_work', 'pick_fruit', 'fowl', 'fish', 'offer', 'quarry', 'carry_sack', 'haul']);
/** the other's side of a deed in a day plan's words, where the verb alone reads wrong (D-461) */
const VERB_TO: Partial<Record<string, string>> = { visit: 'a visit from', help: 'helped by', hire: 'working for', court: 'courted by', teach: 'teaching', learn: 'taught by', heal: 'tended by', introduce: 'introduced by', share_food: 'eating with', intercede: 'hearing a plea from', reconcile: 'making peace with' };
/** the doer's side of a deed in a day plan's words (D-461) */
const VERB_ING: Partial<Record<string, string>> = { visit: 'visiting', help: 'helping', hire: 'hiring', court: 'courting', teach: 'learning from', learn: 'teaching', heal: 'tending', intercede: 'pleading with', reconcile: 'making peace with', share_food: 'eating with', introduce: 'introducing', come_with: 'going with', repair: 'mending for', build: 'building with', carry: 'carrying for', guard: 'keeping watch for', join: 'together with', meet: 'meeting', fetch: 'fetching for', pray: 'praying with', offer: 'offering with' };
const cl = (x: number, lo = -1, hi = 1) => x < lo ? lo : x > hi ? hi : x;
const CHILD_HARM = new Set(['attack', 'push', 'steal', 'threaten', 'curse', 'break']);
const ROMANCE = new Set(['flirt', 'court', 'embrace']);
/** deeds the people near take note of and tell (a wrong, and words or touches that make talk); the rest need no witnesses
 *  (D-462: finding the people near costs their day plans: a visit or a meal shared was 70 % of a month's simulation) */
const NOTED = new Set(['mock', 'accuse', 'embrace', 'flirt', 'court', 'praise', 'apologize', 'reconcile', 'bless', 'warn', 'lie', 'tell', 'give', 'return']);
export interface Promise_ { id: number; from: Actor; to: Actor; verb: string; due: number; kept?: boolean; broken?: boolean }

export class DeedWorld {
  /** the deeds done, the most recent of them (D-461: a window of the last 16 000 to 24 000; a deed's id is its place in the
   *  whole year's count, read with rec(id)) */
  readonly log: DeedRec[] = [];
  private base = 0;
  /** the id the next deed will have */
  get next() { return this.base + this.log.length; }
  /** a deed by its id, while it is in the window */
  rec(id: number): DeedRec | undefined { return this.log[id - this.base]; }
  readonly minds: Minds;
  /** D-461: what the minds set out to do of their own accord (goals over days and months, moods, the talk of deeds) */
  readonly agency: Initiative;
  /** wounds by person (the stranger's under -1) */
  readonly injuries = new Map<number, { how: string; day: number; until: number; by: Actor; why?: string }>();
  /** D-460: wrongs and their consequences (deeds/law.ts): losses found, lies found out, feuds, the watch, the hearings */
  readonly law: Law;
  get cases(): Case[] { return this.law.cases; }
  readonly promises: Promise_[] = [];
  /** what the stranger has learned to do (activity -> 0..1) */
  readonly skills = new Map<string, number>();
  /** the stranger's deeds (replayed on load) */
  private mine: { t: number; deed: Deed }[] = [];
  private lays = new Map<string, Seg[]>();
  private dayDone = -1; private evSeen = 0;
  /** the minds' days run, their cost and their deeds (a measure) */
  readonly stats = { days: 0, ms: 0, deeds: 0 };
  /** D-462: the undertakings agreed (deeds/joint.ts): the walks, the work at its place, kept or missed, and what comes of it */
  readonly joint: Joint;
  constructor(readonly w: WorldPort, ctx?: Partial<MindCtx>) {
    const E = (d: number) => w.econ(d), hhOf = (pid: number, d: number) => `h:${w.pop.home(pid, d)}`;
    this.minds = new Minds(w.pop, w.seed, {
      trust: (pid, of, d) => { const e = E(d); if (!e?.trust) return 0.5; const h = hhOf(pid, d); if (!e.hh.has(h)) return 0.5; return e.trust.trustOf(h, of === 'player' ? 'player' : hhOf(of, d), d); },
      need: (pid, d) => { const e = E(d); const n = e?.hh.has(hhOf(pid, d)) ? e.needsOf(hhOf(pid, d)) : []; return { food: n.find(x => x.kind === 'food')?.urgency ?? 0, cash: n.find(x => x.kind === 'cash')?.urgency ?? 0 }; },
      mood: (pid, d) => this.agency.moodOf(pid, d).v, record: (pid, of, d) => this.law.record(pid, of, d), elder: (pid, d) => { const h = w.pop.households[w.pop.home(pid, d)]; return this.law.elderOf(h?.q, d); },
      ...ctx,
    });
    this.joint = new Joint({ pop: w.pop, seed: w.seed, econ: E, feel: (a, b, d, day) => this.minds.move(a, b, d, day), feelOf: (a, b, day) => this.minds.feelOf(a, b, day),
      trust: (hh, of, d, day) => { const e = E(day); if (e?.trust && e.hh.has(hh)) e.trust.note(hh, of === 'player' ? 'player' : this.hh(of, day)!, d, day); },
      lay: (pid, day, s) => this.lay(pid, day, s), unlay: (pid, from, why) => this.unlay(pid, from, why), name: a => this.name(a), act: (d, t) => this.act(d, t),
      decide: (pid, d, day, h) => this.minds.decide(pid, d, day, h), skill: k => this.skills.get(k) ?? 0, hurt: (pid, day) => { const i = this.injuries.get(pid); return !!i && i.until > day && i.how !== 'bruised'; }, addSkill: (k, d) => this.skills.set(k, Math.min(1, (this.skills.get(k) ?? 0) + d)) });
    this.law = new Law({ pop: w.pop, seed: w.seed, minds: this.minds, econ: E, rumours: w.rumours, near: w.near, injuries: this.injuries,
      hh: (a, d) => this.hh(a, d), name: a => this.name(a), holds: (a, g, d) => this.holds(a, g, d), move: (f, t, g, q, d) => { const e = E(d); if (e) this.moveGoods(e, f, t, g, q, d); },
      lay: (pid, d, seg) => this.lay(pid, d, seg), layDays: (pid, d, n, act, why) => this.layDays(pid, d, n, act, why), whereOf: (pl, pid, d) => this.whereOf(pl, pid, d),
      strangerAbout: d => this.mine.some(m => d - m.t / 24 < 14 && m.t / 24 <= d + 1) || !!(E(d)?.hasStranger && E(d)!.stranger().active) });
    this.agency = new Initiative(this);
  }
  private hh(a: Actor, day: number): string | null { return a === 'player' ? null : `h:${this.w.pop.home(a, day)}`; }
  private name(a: Actor) { return a === 'player' ? 'the stranger' : (this.w.pop.nameOf(a) ?? 'someone').replace(/^\*/, ''); }
  private here(a: Actor, day: number) { if (a === 'player') return true; const P = this.w.pop, p = P.persons[a]; return !!p && p.dies > day && P.present(a, day); }

  // ---------------------------------------------------------------- judging
  /** the simulation's word on a deed, without doing it (what the person is told before they answer) */
  judge(d: Deed, t: number): Outcome { return this.resolve(d, t, false); }
  /** do the deed (the stranger's, after the person's answer; a mind's, on its day) */
  act(d: Deed, t: number): DeedRec {
    if (d.actor === 'player') this.mine.push({ t, deed: { ...d } });
    const out = this.resolve(d, t, true), rec: DeedRec = { id: this.next, day: Math.floor(t / 24), t, deed: d, out };
    this.log.push(rec); if (this.log.length > 24000) { this.log.splice(0, 8000); this.base += 8000; }
    for (const x of [d.actor, d.target, d.third, ...(out.witnesses ?? [])]) if (typeof x === 'number') this.minds.remember(x, rec.id);
    if (typeof d.actor === 'number') this.minds.own.set(d.actor, (this.minds.own.get(d.actor) ?? 0) + 1);
    this.keepPromises(rec);
    this.law.after(rec);
    return rec;
  }
  private resolve(d: Deed, t: number, apply: boolean): Outcome {
    const P = this.w.pop, day = Math.floor(t / 24), hour = t - day * 24, sense = VERBS[d.verb];
    const no = (why: string, refused = false, lean?: number): Outcome => ({ ok: false, why, refused, lean, effects: [] });
    const tg = d.target ?? null;
    if (!this.here(d.actor, day)) return no('not here');
    if (tg !== null && !this.here(tg, day)) return no(typeof tg === 'number' && P.persons[tg]?.dies <= day ? 'dead' : 'not here');
    if (tg !== null && tg === d.actor) return no('to oneself');
    if ((d.inH ?? 0) > 48) return no('too far ahead to promise');
    const tAge = typeof tg === 'number' ? P.ageOn(tg, day) : 30, light = d.actor !== 'player';
    // the limits of the world: no courting a child; harm to a child is stopped by the grown-ups near (and remembered)
    if (ROMANCE.has(d.verb) && tAge < 18) return no('a child: never', true, -1);
    if (CHILD_HARM.has(d.verb) && tAge < 12 && typeof tg === 'number') {
      const wit = this.w.near(tg, t, light).filter(x => x !== tg && P.ageOn(x, day) >= 16).slice(0, 6);
      const eff: Effect[] = wit.map(x => ({ k: 'feel', who: x, toward: d.actor, d: { anger: 0.4, aff: -0.3 } } as Effect));
      const h = this.hh(tg, day); if (h) eff.push({ k: 'trust', hh: h, of: d.actor, d: -0.25 }, { k: 'rumour', about: d.actor, kind: 'threat_to_child', hh: h });
      if (apply) this.applyAll(eff, day, d);
      return { ok: false, why: 'the grown-ups near pull you away from the child', effects: eff, witnesses: wit };
    }
    // the things: the doer must have what he gives, the other what is taken or asked
    const lack = this.lacks(d, day); if (lack) return no(lack);
    // D-462: the undertaking's own limits (the hour promised already, a teacher who does not do the work, the silver for a hire)
    const cant = this.joint.cannot(d, t) ?? (d.verb === 'hire' && d.actor === 'player' && (this.w.econ(day)?.hasStranger ? this.w.econ(day)!.stranger().purse.cash : 0) < HIRE_WAGE.porter ? 'the stranger has not the silver to pay' : null);
    if (cant) return { ...no(cant, /promised|does not do|roof is sound/.test(cant)), say: sayNo(cant, d.verb) };
    // asleep: words are not heard, and the consenting deeds wait
    // (D-461: the town's own deeds read the built plan if there is one, else the hour's common lot: Population.segLight)
    const tSeg = typeof tg === 'number' ? (light ? P.segLight(tg, day, hour) : segAt(P.plan(tg, day), hour)) : null;
    const tended = ['help', 'heal', 'comfort'].includes(d.verb) && typeof tg === 'number' && (P.sick(tg, day) || P.mourning(tg, day)); // (the sick are tended asleep; the mourners comforted)
    if (tSeg?.act === 'sleep' && (d.inH ?? 0) < 1 && !tended && !['attack', 'steal', 'break', 'push'].includes(d.verb)) return no('asleep');
    // the other's mind
    // (an undertaking is weighed at its own hour: the hunt at dawn tomorrow, not against what they do now: D-462)
    const wh = (d.inH ?? 0) >= 0.5 && this.joint.kindOf(d) ? this.joint.when(d, t) : null;
    const dec = typeof tg === 'number' ? this.minds.decide(tg, d, wh?.day ?? day, wh?.h0 ?? hour) : { lean: 0.5, ok: true, why: '' };
    if (sense.consent && !dec.ok) {
      const eff: Effect[] = typeof d.actor === 'number' && typeof tg === 'number' ? [{ k: 'feel', who: d.actor, toward: tg, d: { aff: -0.03 } }] : [];
      if (apply) this.applyAll(eff, day, d); return { ok: false, refused: true, why: dec.why, say: sayNo(dec.why, d.verb), lean: dec.lean, effects: eff };
    }
    // (witnesses matter for a wrong, for the stranger's deeds and for words and touches that make talk (NOTED); a kindness between
    // neighbours is not searched for: the cost of it. D-460: the sleeping see nothing; D-461: the town's own deeds read light plans)
    const wit = typeof tg === 'number' && (sense.wrong || !light || NOTED.has(d.verb)) ? this.w.near(tg, t, light).filter(x => x !== tg && x !== d.actor && P.ageOn(x, day) >= 10 && (light ? P.segLight(x, day, hour) : segAt(P.plan(x, day), hour)).act !== 'sleep').slice(0, 8) : [];
    const eff = this.effects(d, t, dec.lean, wit);
    if (apply) this.applyAll(eff, day, d, t);
    return { ok: true, why: dec.why || sense.gloss, lean: dec.lean, effects: eff, witnesses: wit };
  }
  /** what an actor's house (or the stranger's purse) holds of a good (silver in shekels) */
  holds(a: Actor, g: Good, day: number): number {
    const E = this.w.econ(day); if (!E) return 0;
    if (a === 'player') { if (!E.hasStranger) return 0; const p = E.stranger().purse as Record<string, number>; return g === 'silver' ? p.cash : g === 'bread' || g === 'food' ? p.grain : p[g === 'grain' ? 'grain' : g === 'fuel' ? 'fuel' : 'goods'] ?? 0; }
    const H = E.hh.get(this.hh(a, day)!); if (!H) return 0;
    return g === 'silver' ? H.cash : g === 'grain' || g === 'bread' || g === 'food' ? H.grain : g === 'fuel' ? H.fuel : H.goods;
  }
  private lacks(d: Deed, day: number): string | null {
    const E = this.w.econ(day), g = d.good, q = d.qty ?? 1; if (!g || !E) return null;
    const have = (a: Actor): number => this.holds(a, g, day);
    const amt = g === 'silver' ? q * 0.05 : g === 'bread' ? q * 0.5 : q;
    if (['give', 'lend', 'return'].includes(d.verb) && have(d.actor) < amt) return d.actor === 'player' ? 'the stranger has not got it' : 'has not got it';
    if (['steal', 'ask_for', 'borrow'].includes(d.verb) && d.target !== undefined && have(d.target) < amt) return 'they have none of it';
    return null;
  }

  // ---------------------------------------------------------------- what follows
  private effects(d: Deed, t: number, lean: number, wit: number[]): Effect[] {
    const P = this.w.pop, day = Math.floor(t / 24), hour = t - day * 24, sense = VERBS[d.verb], tg = d.target, out: Effect[] = [];
    const tH = tg !== undefined ? this.hh(tg, day) : null, aH = this.hh(d.actor, day), force = d.force ?? 0.5;
    const scale = sense.wrong ? 0.4 + force : 1;
    // feelings: the other's toward the doer (the deed's own sense, scaled), and the doer's (a mind) toward the other
    if (typeof tg === 'number' && sense.feel) { const f: Record<string, number> = {}; for (const [k, v] of Object.entries(sense.feel)) f[k] = v * scale; out.push({ k: 'feel', who: tg, toward: d.actor, d: f }); }
    if (typeof d.actor === 'number' && tg !== undefined) out.push({ k: 'feel', who: d.actor, toward: tg, d: sense.wrong ? { anger: -0.25 } : sense.feel?.aff ? { aff: sense.feel.aff * 0.5 } : {} });
    // the house's trust in the doer
    if (tH && sense.feel) { const tr = sense.wrong ? -0.08 - 0.15 * force : (sense.feel.grat ?? 0) * 0.4 + (sense.feel.aff ?? 0) * 0.2 - Math.max(0, sense.feel.anger ?? 0) * 0.2; if (Math.abs(tr) > 0.003) out.push({ k: 'trust', hh: tH, of: d.actor, d: tr }); }
    // witnesses: a wrong seen angers them a little and becomes news
    for (const x of wit) if (sense.wrong) out.push({ k: 'feel', who: x, toward: d.actor, d: { anger: 0.12, aff: -0.08, fear: d.verb === 'attack' ? 0.1 : 0 } });
    const g = d.good, q = d.qty ?? (g === 'silver' ? 1 : 2), amt = g === 'silver' ? q * 0.05 : g === 'bread' ? q * 0.5 : q; // (a coin is a twentieth of a shekel, a loaf half a kilo: C)
    switch (d.verb) {
      case 'give': case 'return': if (g && tg !== undefined) out.push({ k: 'goods', from: d.actor, to: tg, good: g, qty: amt }); break;
      case 'lend': if (g && tg !== undefined) { out.push({ k: 'goods', from: d.actor, to: tg, good: g, qty: amt }, { k: 'promise', from: tg, to: d.actor, what: 'return', due: day + 30 }); } break;
      case 'borrow': if (g && tg !== undefined) { out.push({ k: 'goods', from: tg, to: d.actor, good: g, qty: amt }, { k: 'promise', from: d.actor, to: tg, what: 'return', due: day + 30 }); } break;
      case 'ask_for': if (g && tg !== undefined) out.push({ k: 'goods', from: tg, to: d.actor, good: g, qty: amt }); break;
      case 'steal': { if (!g || tg === undefined) break; const seen = wit.length > 0 || u01(this.w.seed, S.law, day, typeof tg === 'number' ? tg : 0) < 0.3;
        out.push({ k: 'goods', from: tg, to: d.actor, good: g, qty: amt });
        if (tH && seen) out.push({ k: 'rumour', about: d.actor, kind: 'theft', hh: tH }, { k: 'law', offender: d.actor, victim: tg, crime: 'theft', witnessed: wit.length > 0 }); // (unseen: the house finds the loss days later: law.ts)
        if (!seen && typeof tg === 'number') { const i = out.findIndex(e => e.k === 'feel' && e.who === tg); if (i >= 0) out.splice(i, 1); } // (unseen: the house finds its loss, not the thief)
        break; }
      case 'attack': case 'push': { if (tg === 'player') { if (d.verb === 'attack') out.push({ k: 'injury', pid: 'player', how: force >= 0.7 ? 'cut' : 'bruised', by: d.actor }); break; } // (D-460: the stranger struck by a townsman)
        if (typeof tg !== 'number') break;
        // the other fights back or runs; men near pull them apart (C)
        const u = u01(this.w.seed, S.fight, day, tg, Math.floor(hour * 10)), stopped = wit.some(x => P.persons[x].sex === 'm' && P.ageOn(x, day) >= 16 && P.ageOn(x, day) < 60) && u < 0.7;
        const f = stopped ? force * 0.5 : force;
        if (d.verb === 'attack') out.push({ k: 'injury', pid: tg, how: f >= 0.95 ? 'killed' : f >= 0.7 ? 'broken' : f >= 0.45 ? 'cut' : 'bruised', by: d.actor });
        if (d.verb === 'attack' && P.persons[tg].sex === 'm' && P.ageOn(tg, day) >= 16 && P.ageOn(tg, day) < 55 && u > 0.5) out.push({ k: 'injury', pid: d.actor, how: u > 0.85 ? 'cut' : 'bruised', by: tg });
        if (tH) out.push({ k: 'rumour', about: d.actor, kind: 'assault', hh: tH }, { k: 'law', offender: d.actor, victim: tg, crime: 'assault', witnessed: wit.length > 0 });
        break; }
      case 'break': if (tH) out.push({ k: 'goods', from: tg!, to: 'world', good: 'goods', qty: 0.5 }, { k: 'rumour', about: d.actor, kind: 'damage', hh: tH }, { k: 'law', offender: d.actor, victim: tg!, crime: 'damage', witnessed: wit.length > 0 }); break;
      case 'insult': case 'threaten': case 'curse': if (tH && (wit.length || force > 0.7)) out.push({ k: 'rumour', about: d.actor, kind: d.verb, hh: tH }); break;
      case 'accuse': case 'complain': { const who = d.third ?? (d.verb === 'accuse' ? tg : undefined); if (who === undefined || who === d.actor) break;
        // to an elder or an official: a case; to anyone else: news against the accused
        const auth = typeof tg === 'number' && (['elder', 'official', 'steward', 'scribe'].includes(P.persons[tg].job) || this.law.isElder(tg, day));
        const hh = this.hh(who, day) ?? (tH ?? 'h:0');
        if (auth) out.push({ k: 'law', offender: who, victim: d.actor, crime: /steal|stole|theft|thief/.test(d.about ?? d.said ?? '') ? 'theft' : /hit|beat|struck|attack/.test(d.about ?? d.said ?? '') ? 'assault' : 'insult', witnessed: false });
        else if (tH) out.push({ k: 'rumour', about: who, kind: /steal|stole|theft|thief/.test(d.about ?? d.said ?? '') ? 'theft' : 'wrong', hh });
        if (typeof tg === 'number') out.push({ k: 'feel', who: tg, toward: who, d: { aff: -0.08, resp: -0.05 } });
        break; }
      case 'tell': case 'lie': case 'warn': { if (typeof tg !== 'number') break; const about = d.third;
        if (about !== undefined) { const bad = /steal|stole|thief|lie|liar|cheat|beat|hit|kill|adulter|curse|witch/.test((d.about ?? d.said ?? '').toLowerCase()), good = /kind|good|honest|help|brave|generous|gave/.test((d.about ?? d.said ?? '').toLowerCase());
          if (bad || good) out.push({ k: 'feel', who: tg, toward: about, d: bad ? { aff: -0.12, resp: -0.08 } : { aff: 0.08, resp: 0.05 } });
          if (bad && tH) out.push({ k: 'rumour', about, kind: d.verb === 'lie' ? 'slander' : 'wrong', hh: tH }); }
        break; }
      case 'promise': if (tg !== undefined) out.push({ k: 'promise', from: d.actor, to: tg, what: d.about ?? 'a promise', due: day + 3 }); break;
      case 'intercede': if (typeof tg === 'number' && d.third !== undefined) out.push({ k: 'feel', who: tg, toward: d.third, d: { anger: -0.15 * Math.max(0.2, lean + 0.5), aff: 0.05 } }); break;
      case 'reconcile': if (typeof tg === 'number') { const o = d.third ?? d.actor; out.push({ k: 'feel', who: tg, toward: o, d: { anger: -0.3, aff: 0.05 } }); if (typeof o === 'number') out.push({ k: 'feel', who: o, toward: tg, d: { anger: -0.3, aff: 0.05 } }); } break;
      case 'introduce': if (typeof tg === 'number' && typeof d.third === 'number') out.push({ k: 'feel', who: tg, toward: d.third, d: { aff: 0.06 } }, { k: 'feel', who: d.third, toward: tg, d: { aff: 0.06 } }); break;
      case 'heal': if (typeof tg === 'number') { const inj = this.injuries.get(tg); if (inj) inj.until = Math.max(day, inj.until - 3); } break;
      case 'teach': if (d.actor === 'player' && !this.joint.kindOf(d)) out.push({ k: 'skill', who: 'player', skill: d.act ?? 'craft', d: 0.12 }); break;
      case 'help': case 'repair': case 'build': case 'carry': case 'guard':
        if (tH && !this.joint.kindOf(d)) out.push({ k: 'work', hh: tH, what: d.act ?? d.verb, amt: VERBS[d.verb].hours }); break;
      case 'hire': if (d.actor === 'player' && typeof tg === 'number') out.push({ k: 'hire', pid: tg, said: d.said ?? d.about ?? '' }); break;
      case 'dismiss': if (d.actor === 'player' && typeof tg === 'number' && this.joint.hiredNow(day).some(h => h.pid === tg)) out.push({ k: 'hire', pid: tg, said: '@dismiss' }); break;
    }
    // D-462: an undertaking (deeds/joint.ts): the walks there and back, the work at its place, kept or missed, and what comes of it
    const J = sense.consent && typeof tg === 'number' && d.verb !== 'hire' ? this.joint.plan(d, t) : null;
    if (J) { out.push({ k: 'job', job: J.job, segs: J.segs }); return out; }
    // where the deed takes people: the other (and a mind doer) go to the place and do it for its hours
    if (tg !== undefined && d.verb !== 'hire' && sense.consent && sense.hours > 0.2 && typeof tg === 'number') {
      const at = hour + (d.inH ?? 0), dd = day + Math.floor(at / 24), h0 = at % 24, h1 = Math.min(23.5, h0 + sense.hours);
      // (D-461: a visit is to the other's house, as the verb's gloss says; the town's own deeds lay at the place the light plan gives)
      const place = d.place ?? (d.verb === 'visit' ? `h:${P.home(tg, dd)}` : d.actor === 'player' ? segAt(P.plan(tg, dd), h0).place : P.segLight(tg, dd, h0).place);
      const act: ActivityId = d.act ?? (d.verb === 'visit' || d.verb === 'meet' || d.verb === 'intercede' || d.verb === 'reconcile' || d.verb === 'introduce' ? 'talk' : d.verb === 'share_food' ? 'eat' : d.verb === 'pray' ? 'offer' : d.verb === 'heal' ? 'tend_body' : d.verb === 'carry' ? 'carry_sack' : d.verb === 'come_with' ? 'walk' : 'talk');
      const aim = d.aim ? `: ${d.aim}` : '';
      const why = `${typeof d.actor === 'number' && VERB_TO[d.verb] ? VERB_TO[d.verb] : d.verb === 'help' ? 'helping' : d.verb === 'join' ? 'together with' : d.verb.replace(/_/g, ' ')} ${this.name(d.actor)}${d.act ? `: ${d.act.replace(/_/g, ' ')}` : ''}`;
      if (h1 - h0 > 0.15) { out.push({ k: 'lay', pid: tg, day: dd, h0, h1, place, act, why, with: d.actor });
        if (typeof d.actor === 'number') out.push({ k: 'lay', pid: d.actor, day: dd, h0, h1, place, act, why: `${VERB_ING[d.verb] ?? d.verb.replace(/_/g, ' ')} ${this.name(tg)}${aim}`, with: tg }); }
    }
    return out;
  }

  private applyAll(eff: Effect[], day: number, d: Deed, t = day * 24 + 12) {
    const E = this.w.econ(day), R = this.w.rumours(), P = this.w.pop;
    for (const e of eff) switch (e.k) {
      case 'feel': this.minds.move(e.who, e.toward, e.d, day); break;
      case 'trust': if (E?.trust) E.trust.note(e.hh, e.of === 'player' ? 'player' : this.hh(e.of, day)!, e.d, day); break;
      case 'goods': if (E) this.moveGoods(E, e.from, e.to, e.good, e.qty, day); break;
      case 'injury': { if (e.pid === 'player') { this.injuries.set(-1, { how: e.how, day, until: day + (e.how === 'cut' ? 12 : 4), by: e.by }); break; } if (typeof e.pid !== 'number') break; if (e.how === 'killed' && P.deedKill(e.pid, day)) { this.injuries.set(e.pid, { how: 'killed', day, until: 1e9, by: e.by }); break; }
        const how = e.how === 'killed' ? 'broken' : e.how; this.injuries.set(e.pid, { how, day, until: day + (how === 'broken' ? 40 : how === 'cut' ? 12 : 4), by: e.by });
        if (how === 'broken' || how === 'cut') this.layDays(e.pid, day, how === 'broken' ? 10 : 2, 'lie_ill', `wounded: ${how === 'broken' ? 'a bone broken' : 'a cut'} by ${this.name(e.by)}`); break; }
      case 'rumour': { const about = e.about === 'player' ? undefined : this.hh(e.about, day) ?? undefined; if (R && E?.hh.has(e.hh)) R.inject(day, e.hh, e.kind, 1, about ?? e.hh, e.about === 'player' ? 'player' : about); break; }
      case 'law': this.law.file(e.offender, e.victim, e.crime, e.witnessed, day, d.verb === 'complain' || d.verb === 'accuse' ? { accuser: d.actor } : { innocent: false }); break; // (a wrong done is not an accusation: the doer did it)
      case 'skill': this.skills.set(e.skill, Math.min(1, (this.skills.get(e.skill) ?? 0) + e.d)); break;
      case 'promise': this.promises.push({ id: this.promises.length, from: e.from, to: e.to, verb: e.what === 'return' ? 'return' : 'give', due: e.due }); break;
      case 'work': if (E) { const H = E.hh.get(e.hh); if (H) { if (/reap|thresh|field|plough|irrigat|garden|pick/.test(e.what)) H.grain += 0.8 * e.amt; else if (/craft|weave|spin|smith|work_wood|pot/.test(e.what)) H.goods += 0.05 * e.amt; } } break;
      case 'job': this.joint.add(e.job, e.segs); break;
      case 'hire': if (e.said === '@dismiss') this.joint.dismiss(e.pid, day); else this.joint.hire(e.pid, e.said, t); break;
      case 'lay': this.lay(e.pid, e.day, { t0: e.h0, t1: e.h1, place: e.place, act: e.act, why: e.why, where: this.whereOf(e.place, e.pid, e.day) }); break;
    }
    void d;
  }
  private moveGoods(E: Economy, from: Actor | 'world', to: Actor | 'world', g: Good, q: number, day: number) {
    const purse = E.hasStranger ? E.stranger().purse as Record<string, number> : null;
    const field = (gg: Good) => gg === 'silver' ? 'cash' : gg === 'grain' || gg === 'bread' || gg === 'food' ? 'grain' : gg === 'fuel' ? 'fuel' : 'goods';
    const take = (a: Actor | 'world') => { if (a === 'world') return; if (a === 'player') { if (purse) purse[field(g)] = Math.max(0, (purse[field(g)] ?? 0) - q); return; } const H = E.hh.get(this.hh(a, day)!) as any; if (H) H[field(g)] = Math.max(0, H[field(g)] - q); };
    const put = (a: Actor | 'world') => { if (a === 'world') return; if (a === 'player') { if (purse) purse[field(g)] = (purse[field(g)] ?? 0) + q; return; } const H = E.hh.get(this.hh(a, day)!) as any; if (H) H[field(g)] += q; };
    take(from); put(to);
  }
  private whereOf(place: string, pid: number, day: number): Where {
    if (/^(hills|river|field:|pasture:|flock:|crown_fields|canal:)/.test(place)) return 'plain';
    const P = this.w.pop, m = /^h:(\d+)$/.exec(place), z = P.households[m ? +m[1] : P.home(pid, day)]?.zone; return z === 'plain' ? 'plain' : z === 'terrace' ? 'terrace' : 'town';
  }
  /** lay a segment over a person's day (the plans' overlay; D-461: the goals lay their own steps through it) */
  lay(pid: number, day: number, seg: Seg): boolean {
    // (D-461: never over a little one's day (it keeps its mother's), nor the house's minder's (the little ones are with her),
    // nor in the open while it rains or the dust is up: the deed is done in words, its stretch of the day is not laid. A wound
    // kept at home is laid whatever)
    const P = this.w.pop;
    if (seg.act !== 'lie_ill') { if (P.ageOn(pid, day) < 3 || (P.persons[pid].job === 'child' && P.hday(P.home(pid, day), day).minder === pid)) return false; // (the minder is a child of the house)
      const wx = P.cal?.ctx(day).wx, open = OPEN_PLACE.test(seg.place) || /^(offering_place|hills|river|mountain|road:)/.test(seg.place) || OUTDOOR_ACT.has(seg.act);
      if (wx && open && (wetHours(wx, seg.t0, seg.t1) > 0 || (wx.dustH && wx.dustH[0] < seg.t1 && wx.dustH[1] > seg.t0))) return false; }
    const k = `${pid}:${day}`; const l = this.lays.get(k) ?? []; l.push(seg); this.lays.set(k, l); return true; }
  /** take back the segments laid from a day on whose reason matches (a hire ended: D-462) */
  private unlay(pid: number, from: number, why: RegExp) { for (const [k, l] of this.lays) { const [p, d] = k.split(':').map(Number); if (p !== pid || d < from) continue; const r = l.filter(s => !why.test(s.why)); if (r.length) this.lays.set(k, r); else this.lays.delete(k); } }
  private layDays(pid: number, day: number, n: number, act: ActivityId, why: string) { const P = this.w.pop; for (let d = day + 1; d <= day + n; d++) this.lay(pid, d, { t0: 0, t1: 24, place: `h:${P.home(pid, d)}`, act, why, where: P.households[P.home(pid, d)]?.zone === 'plain' ? 'plain' : 'town' }); }
  /** the deeds' overlay of the day plans (Population.deeds) */
  readonly overlay = {
    touches: (pid: number, day: number) => this.lays.has(`${pid}:${day}`),
    overlay: (pid: number, day: number, base: Seg[]): Seg[] => { let out = base; for (const s of this.lays.get(`${pid}:${day}`) ?? []) out = cutIn(out, s); return out; },
  };

  // ---------------------------------------------------------------- the law, promises (day by day)
  private keepPromises(rec: DeedRec) { const d = rec.deed; if (!rec.out.ok) return;
    for (const p of this.promises) if (!p.kept && !p.broken && p.from === d.actor && p.to === d.target && (p.verb === d.verb || (p.verb === 'give' && ['give', 'help', 'return', 'repair', 'carry', 'fetch', 'visit', 'meet', 'come_with'].includes(d.verb)))) { p.kept = true; if (typeof p.to === 'number') this.minds.move(p.to, p.from, { aff: 0.05, resp: 0.05 }, rec.day); } }
  private duesOf(day: number) { const E = this.w.econ(day);
    for (const p of this.promises) if (!p.kept && !p.broken && p.due < day) { p.broken = true;
      if (typeof p.to === 'number') { this.minds.move(p.to, p.from, { anger: 0.2, resp: -0.1, aff: -0.05 }, day); const h = this.hh(p.to, day); if (h && E?.trust) E.trust.note(h, p.from === 'player' ? 'player' : this.hh(p.from, day)!, -0.06, day); } } }

  /** a day of the town's own deeds (the minds' initiative), the elders' rulings and the promises' days: sliced (a generator) */
  *dayParts(day: number): Generator<void> {
    if (day <= this.dayDone) return; this.dayDone = day;
    this.duesOf(day); this.joint.day(day);
    // the world's own events of the day felt by the people they name (the economy's: robbed, default, loan, death, ...)
    const E = this.w.econ(day); if (E) { const evs: { day: number; actor: string; kind: string; other?: string }[] = [];
      for (let i = Math.max(this.evSeen, 0); i < E.events.length; i++) { const e = E.events[i]; if (e && e.day === day) evs.push(e as any); } this.evSeen = E.events.length; this.minds.observe(evs, day); }
    yield;
    // (D-461: the days gone are dropped from the overlay: the plans read no further back than yesterday; promises settled a
    // month ago too)
    for (const k of this.lays.keys()) if (Number(k.slice(k.indexOf(':') + 1)) < day - 2) this.lays.delete(k);
    if (day % 7 === 0) { const keep = this.promises.filter(p => !(p.kept || p.broken) || p.due > day - 30); this.promises.splice(0, this.promises.length, ...keep); }
    // what the law moves people to do (D-460) and the undertakings' own steps (D-462), then the minds' own (initiative.ts:
    // feelings and needs acted on, goals pursued and formed, deeds talked of)
    const ms0 = this.agency.stats.ms, n0 = this.next, t0 = performance.now(); let k = 0;
    for (const d of [...this.law.day(day), ...this.joint.initiative(day)]) { this.own(d, day, 1000 + k++); if (k % 8 === 0) yield; }
    const tl = performance.now() - t0; yield;
    yield* this.agency.dayParts(day);
    this.stats.days++; this.stats.ms += tl + this.agency.stats.ms - ms0; this.stats.deeds += this.next - n0;
  }
  /** a mind's own deed done at an hour of the day (initiative.ts) */
  own(d: Deed, day: number, k: number, hour?: number): DeedRec {
    // (visits, meals and comfort of an evening, when people are home and awake; the rest by day: C)
    const ev = ['visit', 'share_food', 'comfort', 'reconcile'].includes(d.verb), t = day * 24 + (hour ?? (ev ? 17.5 + u01(this.w.seed, S.hour, day, k) * 2.5 : 8 + u01(this.w.seed, S.hour, day, k) * 10));
    d.inH = d.inH ?? 0; return this.act(d, t); }
  day(day: number) { for (const _ of this.dayParts(day)); }

  // ---------------------------------------------------------------- reading (the brief, the overlay, the tests)
  /** what a person holds against or for the stranger and what they remember of deeds (the brief's lines, out of world) */
  briefOf(pid: number, day: number): string[] {
    const out: string[] = [], f = this.minds.feelOf(pid, 'player', day);
    const fl = [f.anger > 0.25 ? 'angry with him' : '', f.fear > 0.25 ? 'afraid of him' : '', f.grat > 0.2 ? 'grateful to him' : '', f.aff > 0.3 ? 'fond of him' : f.aff < -0.2 ? 'dislike him' : '', f.resp > 0.3 ? 'respect him' : ''].filter(Boolean);
    if (fl.length) out.push(`You are ${fl.join(' and ')}.`);
    const mem = (this.minds.memory.get(pid) ?? []).map(i => this.rec(i)).filter((r): r is DeedRec => !!r && r.out.ok && (r.deed.actor === 'player' || r.deed.target === 'player') && day - r.day < 60).slice(-2);
    for (const r of mem) out.push(`${day - r.day === 0 ? 'Today' : day - r.day === 1 ? 'Yesterday' : 'Some days ago'} ${r.deed.actor === 'player' ? `${VERBS[r.deed.verb].consent ? `the stranger asked ${r.deed.target === pid ? 'you' : 'someone'} ${VERBS[r.deed.verb].gloss}` : `from the stranger, ${VERBS[r.deed.verb].gloss}${r.deed.target === pid ? ' (to you)' : ''}`}` : `you ${r.deed.verb.replace(/_/g, ' ')} the stranger`}.`);
    const inj = this.injuries.get(pid); if (inj && inj.until > day && !inj.why) out.push(`You are ${inj.how === 'broken' ? 'badly hurt, a bone broken' : inj.how === 'cut' ? 'cut and bandaged' : 'bruised'}, by ${this.name(inj.by)}.`);
    out.push(...this.law.briefOf(pid, day), ...this.joint.briefOf(pid, day), ...this.agency.briefOf(pid, day)); // (D-461: what they are set on, and their mood)
    return out;
  }
  /** a person's wound now (the renderer's and the marks' hook) */
  injuryOf(pid: number, day: number) { const i = this.injuries.get(pid); return i && i.until > day ? i : null; }

  // (D-459, the late save 3.66 MB: the overlays of days gone by, the promises settled and the faded feelings are not kept)
  save() { const d0 = this.dayDone - 1;
    return { mine: this.mine, minds: this.minds.save(this.dayDone), inj: [...this.injuries].filter(([, v]) => v.until > d0), law: this.law.save(), promises: this.promises.filter(p => !p.kept && !p.broken), skills: [...this.skills],
      lays: [...this.lays].filter(([k]) => Number(k.split(':')[1]) >= d0), dayDone: this.dayDone, n: this.log.length, joint: this.joint.save(), agency: this.agency.save() }; }
  load(s: ReturnType<DeedWorld['save']> | undefined) { if (!s) return; this.mine = s.mine; this.minds.load(s.minds); this.injuries.clear(); for (const [k, v] of s.inj) this.injuries.set(k, v);
    this.law.load((s as any).law ?? { cases: (s as any).cases }); this.promises.splice(0, this.promises.length, ...s.promises); this.skills.clear(); for (const [k, v] of s.skills) this.skills.set(k, v);
    this.lays = new Map(s.lays); this.dayDone = s.dayDone; this.evSeen = 0; this.joint.load(s.joint); this.agency.load(s.agency); }
}

/** a segment laid into a day: the base is cut around it (the overlays' shared rule) */
export function cutIn(base: Seg[], s: Seg): Seg[] {
  const out: Seg[] = [];
  for (const b of base) { if (b.t1 <= s.t0 || b.t0 >= s.t1) { out.push(b); continue; } if (b.t0 < s.t0) out.push({ ...b, t1: s.t0 }); if (b.t1 > s.t1) out.push({ ...b, t0: s.t1 }); }
  out.push(s); return out.sort((a, b) => a.t0 - b.t0);
}
