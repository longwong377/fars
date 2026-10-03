// D-459 (UD-32: "an actual brain in every npc in a sandbox world ... with or without the player"): THE MINDS. Every person of
// the population has, besides the life the planner gives them (home, work, kin, the day), a mind that the deeds of others move:
//   feelings toward each person they have dealings with (affection, anger, fear, gratitude, respect: -1..1), resting on what
//     the world already knows between them (kin, the same house, friends: Population ties; the relations layer's affection and
//     trust where it runs) and fading back to that rest day by day (anger in about a fortnight, fear a week, gratitude a season);
//   memories: the deeds done to them and by them (deeds/engine.ts's log ids), what they were told and promised;
//   a decision: how they take any deed asked of them (decide()), from the deed's own sense (deeds/verbs.ts), their feelings
//     toward the doer, the doer's standing with their house (the economy's trust), their temper and facets (persona.ts), what
//     their house needs, what their day holds now (asleep, at supervised work, minding a child), the period's manners (a woman
//     does not go off alone with a strange man; a child does not follow a stranger away from its mother: C) and a seeded draw;
//   initiative: what they do on their own (deeds()), day by day: anger acted on (words, a blow, a complaint to the elder),
//     gratitude repaid, a friend visited, a hungry house borrowing from kin and, rarely, stealing, a festival shared. The same
//     engine decides these as the stranger's, so the town lives with or without him.
// Pure given the seed and the deeds: the minds' own deeds are drawn from (seed, person, day) over the state; saved sparse.
// Tier C throughout: the weights are this module's reading of village and town manners (DECISIONS D-459).
import type { Population } from '../population';
import { segAt } from '../population';
import { personaOf } from '../persona';
import { u01, salt } from '../hash';
import type { Actor, Deed, Feel } from '../deeds/types';
import { VERBS } from '../deeds/verbs';

const S = { dec: salt('mind-decide'), own: salt('mind-own'), pick: salt('mind-pick') };
export const key = (a: Actor) => a === 'player' ? -1 : a;
const ZERO: Feel = { aff: 0, anger: 0, fear: 0, grat: 0, resp: 0 };
/** per-day fading toward rest (C: anger ~2 weeks to a third, fear ~1 week, gratitude ~a season, affection and respect slow) */
const FADE: Feel = { aff: 0.995, anger: 0.93, fear: 0.88, grat: 0.985, resp: 0.997 };
const cl = (x: number, lo = -1, hi = 1) => x < lo ? lo : x > hi ? hi : x;

interface Held { f: Feel; day: number }
export interface Decision { lean: number; ok: boolean; why: string }
export interface MindCtx {
  /** the economy's trust of the person's house in the doer (0..1), 0.5 when unknown */ trust: (pid: number, of: Actor, day: number) => number;
  /** how short the person's house is of food and of silver (0..1) */ need: (pid: number, day: number) => { food: number; cash: number };
  /** the relations layer's affection between two adults, when it runs */ relAff?: (a: number, b: number, day: number) => number | null;
  /** D-461: the person's mood now, -1 (grief, bitterness) .. 1 (joy) (initiative.ts moodOf) */ mood?: (pid: number, day: number) => number;
  /** D-460: what the person's house knows of the doer's wrongs (deeds/law.ts record: convictions, lies found, blows), -1..0 */ record?: (pid: number, of: Actor, day: number) => { v: number; why: string } | null;
  /** D-460: the elder of the person's quarter (deeds/law.ts) */ elder?: (pid: number, day: number) => number | null;
}

export class Minds {
  private feel = new Map<number, Map<number, Held>>();
  /** deed log ids each person remembers (newest last, at most 40) */
  readonly memory = new Map<number, number[]>();
  /** how many deeds each person has done of their own this year (a measure) */
  readonly own = new Map<number, number>();
  constructor(readonly pop: Population, readonly seed: number, readonly ctx: MindCtx) {}

  /** the resting feeling of a toward b (what the world already holds between them) */
  rest(a: number, b: Actor, day: number): Feel {
    if (b === 'player') return ZERO;
    const P = this.pop, A = P.persons[a], B = P.persons[b]; if (!A || !B) return ZERO;
    const sameHouse = P.home(a, day) === P.home(b, day), kin = A.mother === b || B.mother === a || (A.mother >= 0 && A.mother === B.mother) || A.spouse === b;
    const tie = A.ties.includes(b) || B.ties.includes(a);
    const rel = this.ctx.relAff?.(a, b, day);
    const aff = rel ?? (kin ? 0.55 : sameHouse ? 0.4 : tie ? 0.3 : 0);
    const resp = (P.ageOn(b, day) - P.ageOn(a, day) > 15 ? 0.2 : 0) + (kin && P.ageOn(b, day) > P.ageOn(a, day) ? 0.1 : 0);
    return { aff, anger: 0, fear: 0, grat: 0, resp };
  }
  /** a's feeling toward b now (rest + what deeds left, faded to the day) */
  feelOf(a: number, b: Actor, day: number): Feel {
    const r = this.rest(a, b, day), h = this.feel.get(a)?.get(key(b)); if (!h) return r;
    const n = Math.max(0, day - h.day), out = {} as Feel;
    for (const k of Object.keys(FADE) as (keyof Feel)[]) out[k] = cl(r[k] + h.f[k] * Math.pow(FADE[k], n));
    return out;
  }
  /** a deed moves a's feeling toward b (stored as the departure from rest, faded to the day first) */
  move(a: number, b: Actor, d: Partial<Feel>, day: number) {
    let m = this.feel.get(a); if (!m) this.feel.set(a, m = new Map());
    const k = key(b), h = m.get(k), n = h ? Math.max(0, day - h.day) : 0, f: Feel = { ...ZERO };
    for (const x of Object.keys(FADE) as (keyof Feel)[]) f[x] = cl((h ? h.f[x] * Math.pow(FADE[x], n) : 0) + (d[x] ?? 0), -1.5, 1.5);
    m.set(k, { f, day });
  }
  /** D-461: forget what has faded back near rest (anger, fear and gratitude under 0.03, a liking or a regard moved by less than
   *  0.06: a single visit's warmth, a word heard of someone), and keep the 24 strongest feelings of anyone who holds more (an
   *  elder who hears every complaint of the quarter): the state stays small over a year. A seventh of the people a day (part) */
  prune(day: number, part = 0, parts = 1) { for (const _ of this.pruneParts(day, part, parts)); }
  /** the same in slices (a yield every 600 people pruned) */
  *pruneParts(day: number, part = 0, parts = 1): Generator<void> { let i = 0, c = 0;
    for (const [a, m] of this.feel) { if (i++ % parts !== part) continue; if (++c % 600 === 0) yield;
      for (const [k, h] of m) { const n = Math.max(0, day - h.day), f = (x: keyof Feel) => Math.abs(h.f[x] * Math.pow(FADE[x], n));
        if (f('anger') < 0.03 && f('fear') < 0.03 && f('grat') < 0.03 && f('aff') < 0.06 && f('resp') < 0.06) m.delete(k); }
      if (m.size > 24) { const sal = (h: Held) => { const n = Math.max(0, day - h.day); let s = 0; for (const x of Object.keys(FADE) as (keyof Feel)[]) s += Math.abs(h.f[x] * Math.pow(FADE[x], n)); return s; };
        const keep = [...m].sort((x, y) => sal(y[1]) - sal(x[1])).slice(0, 24); m.clear(); for (const [k, h] of keep) m.set(k, h); }
      if (!m.size) this.feel.delete(a); } }
  /** how many people hold feelings, and how many feelings in all (a measure) */
  get size() { let n = 0; for (const m of this.feel.values()) n += m.size; return { people: this.feel.size, feelings: n }; }
  remember(pid: number, id: number) { const l = this.memory.get(pid) ?? []; l.push(id); if (l.length > 40) l.shift(); this.memory.set(pid, l); }
  /** the people a person has strong feelings about now (for the brief and the initiative) */
  strongest(pid: number, day: number, n = 3): { other: Actor; f: Feel; sal: number }[] {
    const m = this.feel.get(pid); if (!m) return [];
    return [...m.keys()].map(k => { const o: Actor = k === -1 ? 'player' : k, f = this.feelOf(pid, o, day); return { other: o, f, sal: Math.abs(f.anger) + Math.abs(f.fear) + Math.abs(f.grat) + Math.abs(f.aff - this.rest(pid, o, day).aff) }; })
      .filter(x => x.sal > 0.12).sort((a, b) => b.sal - a.sal).slice(0, n);
  }

  /** how the person takes a deed asked of them (or done to them) by the doer now: their lean, -1..1, and why in words */
  decide(pid: number, d: Deed, day: number, hour: number): Decision {
    const P = this.pop, p = P.persons[pid], sense = VERBS[d.verb], doer = d.actor;
    const f = this.feelOf(pid, doer, day), pe = personaOf(P, pid, day), age = P.ageOn(pid, day);
    // (the stranger's deeds read the person's day as it is now; the town's own deeds, drawn by the hundred a day, read the plan
    // only where the planner has built it, else the hour's common lot: building a plan cascades through a household, ~20 ms,
    // the cost of the minds: D-459, D-461 Population.segLight)
    const seg = doer === 'player' ? segAt(P.plan(pid, day), hour) : P.segLight(pid, day, hour), why: [number, string][] = [];
    let lean = sense.want; why.push([sense.want, sense.want >= 0.3 ? `${sense.gloss} is welcome to anyone` : sense.want <= -0.3 ? `no one likes ${sense.gloss}` : '']);
    const add = (x: number, w: string) => { lean += x; why.push([x, w]); };
    add(0.5 * f.aff, f.aff > 0.25 ? 'fond of him' : f.aff < -0.2 ? 'dislikes him' : '');
    add(0.45 * f.grat, f.grat > 0.2 ? 'owes him a kindness' : '');
    add(0.25 * f.resp, f.resp > 0.25 ? 'looks up to him' : '');
    add(-0.6 * Math.max(0, f.anger), f.anger > 0.25 ? 'still angry with him' : '');
    // fear: a frightened person gives way to small demands and keeps away from the rest
    if (f.fear > 0.3) add(['give', 'ask_for', 'borrow', 'fetch', 'carry', 'dismiss'].includes(d.verb) ? 0.3 * f.fear : -0.4 * f.fear, 'afraid of him');
    const tr = this.ctx.trust(pid, doer, day); add(0.6 * (tr - 0.5), tr < 0.35 ? 'the house does not trust him' : tr > 0.65 ? 'the house trusts him' : '');
    // D-460: his record as the house knows it (a thief, a liar, a man who strikes people), and the custom that a wound is paid for
    const rec = sense.consent || d.verb === 'ask_for' ? this.ctx.record?.(pid, doer, day) : null; if (rec) add(0.8 * rec.v, rec.v < -0.1 ? rec.why : '');
    if (d.verb === 'give' && /compensation|blood-price|the wound|for the blow/.test(d.about ?? d.said ?? '')) add(0.7, 'the price of the wound offered');
    if (d.verb === 'ask_for' && /compensation|blood-price/.test(d.about ?? '')) add(0.55 + 0.3 * Math.max(0, f.fear) - 0.25 * (pe.pride - 0.5), 'the custom: a wound is paid for');
    // temper and facets
    if (sense.consent) { add(0.25 * (pe.warmth - 0.5), pe.warmth > 0.7 ? 'warm by nature' : pe.warmth < 0.3 ? (doer === 'player' ? 'cold to strangers' : 'cold by nature') : '');
      if (doer === 'player') add(0.2 * (pe.curiosity - 0.5), pe.curiosity > 0.7 ? 'curious about the stranger' : ''); }
    if (d.verb === 'pray' || d.verb === 'offer' || d.verb === 'bless') add(0.4 * (pe.piety - 0.4), pe.piety > 0.7 ? 'devout' : '');
    if (['insult', 'mock', 'threaten', 'push'].includes(d.verb)) add(-0.3 * pe.pride, pe.pride > 0.7 ? 'proud: will not stand it' : '');
    // the house's needs: help and gifts are worth more to a short house; giving away hurts it
    const nd = this.ctx.need(pid, day);
    if (['help', 'give', 'lend', 'carry', 'repair', 'heal', 'hire', 'guard'].includes(d.verb)) add(0.35 * Math.max(nd.food, nd.cash), nd.food > 0.5 ? 'the house is short' : '');
    if (['ask_for', 'borrow'].includes(d.verb)) add(-0.6 * Math.max(nd.food, nd.cash), nd.food > 0.5 || nd.cash > 0.5 ? 'the house has little to spare' : '');
    // D-461: the mood: a glad heart says yes more readily; grief keeps to the house and wants no company but comfort
    const mood = this.ctx.mood?.(pid, day) ?? 0;
    if (sense.consent && Math.abs(mood) > 0.15) add(['visit', 'join', 'share_food', 'come_with', 'meet', 'court', 'flirt'].includes(d.verb) ? 0.35 * mood : 0.15 * mood, mood > 0.3 ? 'glad at heart' : mood < -0.4 ? 'in no mood for it' : '');
    // the day: what they are doing now
    if (sense.consent && sense.hours > 0.3) {
      if (seg.act === 'sleep') add(-1.5, 'asleep');
      else if (/watch|guard|on duty|the foreman|overseer/.test(seg.why) || ['stand_guard', 'patrol'].includes(seg.act)) add(-0.9, 'on duty: cannot leave it');
      else if (!['rest', 'talk', 'play', 'eat', 'walk', 'gamble'].includes(seg.act)) add(-0.15 * Math.min(4, sense.hours) * (d.verb === 'help' ? 0.2 : 1), `busy ${seg.why.split(/[:;,]/)[0]}`);
    }
    // manners of the time (C): a woman does not go off alone with a strange man; a child does not leave its mother for a stranger
    const away = ['come_with', 'visit', 'meet', 'join', 'embrace', 'flirt', 'court', 'share_food'].includes(d.verb);
    if (away && doer === 'player' && p.sex === 'f' && age >= 13 && f.aff < 0.4) add(-0.45, 'a woman does not go off with a strange man');
    if (away && age < 12 && f.aff < 0.4) add(-0.6, 'a child does not go off with a stranger');
    if (age < 12 && ['help', 'fetch', 'carry'].includes(d.verb)) add(0.2, 'a child does as a grown man asks');
    const u = u01(this.seed, S.dec, pid, day * 96 + Math.floor(hour * 4), d.verb.length * 31 + (doer === 'player' ? 7 : doer));
    const draw = lean + (u - 0.5) * 0.5;
    const top = why.filter(x => x[1]).sort((a, b) => Math.abs(b[0]) - Math.abs(a[0])).filter(x => Math.sign(x[0]) === Math.sign(draw) || !sense.consent).slice(0, 2).map(x => x[1]);
    return { lean: cl(lean), ok: draw > 0, why: top.join('; ') || (draw > 0 ? 'willing' : 'not willing') };
  }

  // ---------------------------------------------------------------- the world's own events felt (with or without the stranger)
  /** deeds the world's events call for, taken up on the day (comfort to a house in mourning, help to a sick or burnt house) */
  private queued: Deed[] = [];
  /** the head of a house on a day: its eldest man of working age, else its eldest adult */
  headOf(h: number, day: number): number | null {
    const P = this.pop; if (!P.households[h]) return null; const m = P.membersOn(h, day).filter(x => P.present(x, day) && P.persons[x].dies > day + 1 && P.ageOn(x, day) >= 16); /* (not the one dying) */ if (!m.length) return null;
    return [...m].sort((a, b) => (P.persons[b].sex === 'm' && P.ageOn(b, day) < 65 ? 1 : 0) - (P.persons[a].sex === 'm' && P.ageOn(a, day) < 65 ? 1 : 0) || P.ageOn(b, day) - P.ageOn(a, day))[0];
  }
  /** the economy's events of a day, felt by the people of the houses they name (C: who feels what toward whom):
   *  robbed -> anger at the thief's house; a default -> the lender's anger; a pledge seized or a suit -> the debtor's anger; a loan
   *  -> gratitude; a loan refused -> resentment; kin's help -> gratitude; a debt repaid -> regard; a death, an illness, a fire ->
   *  kin and friends come to comfort or help */
  observe(evs: readonly { day: number; actor: string; kind: string; other?: string }[], day: number) {
    const P = this.pop, hid = (x?: string) => x && /^h:\d+$/.test(x) ? +x.slice(2) : -1;
    for (const e of evs) { const a = this.headOf(hid(e.actor), day), o = e.other ? this.headOf(hid(e.other), day) : null;
      const feel = (who: number | null, to: number | null, d: Partial<Feel>) => { if (who !== null && to !== null && who !== to) this.move(who, to, d, day); };
      switch (e.kind) {
        case 'robbed': feel(a, o, { anger: 0.55, aff: -0.3, fear: 0.1 }); break;
        case 'default': feel(o, a, { anger: 0.4, aff: -0.15, resp: -0.1 }); break;
        case 'pledge_seized': case 'suit': feel(o, a, { anger: 0.3, fear: 0.1, aff: -0.1 }); break;
        case 'loan': feel(a, o, { grat: 0.25, resp: 0.05 }); break;
        case 'loan_refused': feel(a, o, { anger: 0.15, aff: -0.08 }); break;
        case 'kin_help': case 'help': feel(a, o, { grat: 0.35, aff: 0.05 }); break;
        case 'repaid': feel(o, a, { resp: 0.08, aff: 0.04 }); break;
        case 'death': case 'illness': case 'house_fire': { const h = hid(e.actor), H = P.households[h]; if (!H || a === null) break;
          // the kin houses' heads and the friends of the house's members come round (C: most kin, a few friends)
          const come = new Set<number>(); for (const k of H.kin) { const x = this.headOf(k, day); if (x !== null) come.add(x); }
          for (const m of P.membersOn(h, day)) for (const t of P.persons[m].ties) if (P.home(t, day) !== h) come.add(t);
          let n = 0; for (const x of come) { if (n >= 6 || !P.persons[x] || !P.present(x, day) || P.ageOn(x, day) < 14) continue; if (u01(this.seed, S.own, x, day, 9) > (H.kin.includes(P.home(x, day)) ? 0.85 : 0.35)) continue; n++;
            this.queued.push(e.kind === 'death' ? { verb: 'comfort', actor: x, target: a } : e.kind === 'illness' ? { verb: 'help', actor: x, target: a, act: 'tend_body' } : { verb: 'help', actor: x, target: a, act: 'mould_brick' }); }
          break; }
      } }
  }

  // ---------------------------------------------------------------- initiative: what a mind does of its own accord
  /** the deeds the town's minds take up on a day (with or without the stranger): drawn over the state, at most `max` */
  /** D-720: the day's own deeds: how many people are looked at (a seeded share of the town; its turn comes round) and the most
   *  deeds a day (D-462's cost). Measured (tools/dev/minds_rate.ts, seed 1, days 55-60, node, a busy box): 4000/300 509 deeds and
   *  666 people a day for 226 ms; 12000/900 629 and 862 for 255 ms (taken: +8 % of the minds' day); 20000/1500 743 and 1036 for
   *  301 ms; 40000/3000 1045 and 1462 for 361 ms (the day's catch-up would grow by ~40 %: when the budget allows) */
  daily = { sample: 12000, max: 900 };
  deeds(day: number, max = this.daily.max, held?: (pid: number, other: number) => boolean): Deed[] { const out: Deed[] = []; for (const _ of this.deedParts(day, out, max, held)); return out; }
  /** the same, in slices (D-461: a generator yielding every few hundred people, for the living world's sliced days); first the
   *  deeds the world's events called for (observe) */
  *deedParts(day: number, out: Deed[], max = 300, held?: (pid: number, other: number) => boolean): Generator<void> {
    out.push(...this.queued.splice(0, this.queued.length).slice(0, max >> 1));
    const P = this.pop, rng = (pid: number, k: number) => u01(this.seed, S.own, pid, day, k); let c = 0;
    // (1) feelings acted on: every person who holds a strong feeling about someone (the minds' own state)
    for (const [pid, m] of this.feel) { if (out.length >= max) break; if (++c % 500 === 0) yield; if (!P.persons[pid] || !P.present(pid, day) || P.ageOn(pid, day) < 8) continue;
      for (const [k] of m) { const o: Actor = k === -1 ? 'player' : k; if (o !== 'player' && (!P.persons[o] || !P.present(o, day))) continue;
        if (o !== 'player' && held?.(pid, o)) continue; // (D-461: a goal of revenge or of peace pursues this one, step by step)
        { const h = m.get(k)!, n = Math.max(0, day - h.day); if (h.f.anger * Math.pow(FADE.anger, n) < 0.15 && h.f.grat * Math.pow(FADE.grat, n) < 0.3 && h.f.fear * Math.pow(FADE.fear, n) < 0.4) continue; } // (D-461: nothing to act on: the rest is not read)
        const f = this.feelOf(pid, o, day), u = rng(pid, k + 1);
        // (D-461: a grudge is acted on every few days, not every day it is held: C; the rest of the days it smoulders)
        if (f.anger > 0.45) { if (rng(pid, k + 7) >= 0.35) continue; const hot = personaOf(P, pid, day).temper > 0.65;
          out.push(hot && f.anger > 0.7 && u < 0.25 ? { verb: 'attack', actor: pid, target: o, force: 0.4 } : u < 0.45 ? { verb: 'insult', actor: pid, target: o } : u < 0.7 && o !== 'player' ? { verb: 'complain', actor: pid, target: this.elderOf(pid, day) ?? o, third: o } : { verb: 'avoid', actor: pid, target: o });
          continue; }
        if (f.anger > 0.15 && f.aff > 0.3 && u < 0.08) { out.push({ verb: 'reconcile', actor: pid, target: o }); continue; }
        if (f.grat > 0.3 && u < 0.15) { out.push(u < 0.07 ? { verb: 'give', actor: pid, target: o, good: 'food', qty: 1 } : { verb: 'help', actor: pid, target: o }); continue; }
        if (f.fear > 0.4 && o !== 'player' && u < 0.3) { out.push({ verb: 'avoid', actor: pid, target: o }); continue; }
      } }
    // (2) needs and ties: a sample of the town each day (a seeded tenth), so every house's turn comes round
    const n = P.persons.length, start = Math.floor(u01(this.seed, S.pick, day) * n), step = 7919;
    for (let i = 0, x = start; i < Math.min(n, this.daily.sample) && out.length < max; i++, x = (x + step) % n) { if (i % 500 === 499) yield;
      const p = P.persons[x]; if (!P.present(x, day) || P.ageOn(x, day) < 16) continue;
      const u = rng(x, 0), nd = this.ctx.need(x, day);
      // a hungry house borrows from a friend or kin; the desperate and the hard, rarely, steal (C)
      if (nd.food > 0.75 && u < 0.08) { const t = this.friendOf(x, day); if (t !== null) { const pe = personaOf(P, x, day);
        out.push(nd.food > 0.92 && pe.piety < 0.35 && pe.temper > 0.55 && u < 0.012 ? { verb: 'steal', actor: x, target: t, good: 'grain', qty: 5 } : { verb: 'borrow', actor: x, target: t, good: 'grain', qty: 10 }); } continue; }
      // a friend visited, a meal shared, of an evening (C: a few times a month for most)
      if (u > 0.985) { const t = this.friendOf(x, day); if (t !== null) out.push({ verb: u > 0.995 ? 'share_food' : 'visit', actor: x, target: t, inH: 0 }); continue; }
      // D-460: the everyday between neighbours and friends (C: rates per person-day): a hand with the work, thanks and praise
      // for kindness, and friction: a sharp word or mockery from the hot-tempered over water, a wall, a debt; rarely, the hard
      // and impious take what is not theirs while the house is out
      if (u > 0.975) { const t = this.friendOf(x, day); if (t !== null) out.push(u > 0.981 ? { verb: 'help', actor: x, target: t } : { verb: u > 0.978 ? 'praise' : 'thank', actor: x, target: t }); continue; }
      if (u > 0.969) { const pe = personaOf(P, x, day), t = this.neighbourOf(x, day); if (t !== null && pe.temper > 0.55) out.push({ verb: u > 0.972 ? 'insult' : 'mock', actor: x, target: t, force: 0.3 + 0.4 * pe.temper }); continue; }
      if (u < 0.0007) { const pe = personaOf(P, x, day), t = this.neighbourOf(x, day); if (t !== null && pe.piety < 0.4 && pe.temper > 0.5) out.push({ verb: 'steal', actor: x, target: t, good: u < 0.00025 ? 'silver' : 'grain', qty: u < 0.00025 ? 4 : 8 }); continue; }
      void p;
    }
    out.splice(max);
  }
  /** a friend or kinsman in another house (Population ties, then kin houses) */
  friendOf(pid: number, day: number): number | null {
    const P = this.pop, p = P.persons[pid], h = P.home(pid, day);
    const c = p.ties.filter(t => P.persons[t] && P.present(t, day) && P.home(t, day) !== h && P.ageOn(t, day) >= 14);
    if (c.length) return c[Math.floor(u01(this.seed, S.pick, pid, day, 1) * c.length)];
    return null;
  }
  /** a grown person of another house in the same quarter (a neighbour of the lane; seeded by the day) */
  neighbourOf(pid: number, day: number): number | null {
    const P = this.pop, h = P.home(pid, day), q = P.households[h]?.q; if (!q) return null;
    for (const k of [1, -1, 2, -2, 3]) { const H = P.households[h + k]; if (!H || H.q !== q || !H.members.length) continue;
      const m = H.members.filter(x => P.present(x, day) && P.persons[x].dies > day && P.ageOn(x, day) >= 16 && P.home(x, day) === H.id); if (m.length) return m[Math.floor(u01(this.seed, S.pick, pid, day, 7 + k) * m.length)]; }
    return null;
  }
  /** the elder of the person's quarter (the one a complaint is taken to), if one is known */
  elderOf(pid: number, day: number): number | null {
    if (this.ctx.elder) return this.ctx.elder(pid, day);
    const P = this.pop, q = P.households[P.home(pid, day)]?.q; if (!q) return null;
    for (const H of P.households) { if (H.q !== q) continue; for (const m of H.members) if (P.persons[m].job === 'elder' && P.present(m, day)) return m; }
    return null;
  }

  /** the minds' state for a save: feelings that have not faded to nothing by `day` (D-459: a year kept every brush; the late
   *  save was 2.76 MB of deeds), rounded to a millionth, as arrays (D-461). The memories are ids into the deed log, which a
   *  save does not keep: they start afresh */
  save(day = Infinity) { const r = (x: number) => Math.round(x * 1e6) / 1e6, f: [number, number[][]][] = [];
    for (const [a, m] of this.feel) { const l: number[][] = [];
      for (const [k, h] of m) { const n = Number.isFinite(day) ? Math.max(0, day - h.day) : 0; let big = 0; for (const x of Object.keys(FADE) as (keyof Feel)[]) big = Math.max(big, Math.abs(h.f[x] * Math.pow(FADE[x], n))); if (big >= 0.02) l.push([k, r(h.f.aff), r(h.f.anger), r(h.f.fear), r(h.f.grat), r(h.f.resp), h.day]); }
      if (l.length) f.push([a, l]); }
    return { f, mem: [] as [number, number[]][], own: [...this.own] }; }
  load(s: ReturnType<Minds['save']> | undefined) { this.feel.clear(); this.memory.clear(); this.own.clear(); if (!s) return;
    for (const [a, l] of s.f) this.feel.set(a, new Map((l as unknown[][]).map(x => x.length === 3 ? [x[0] as number, { f: x[1] as Feel, day: x[2] as number }] : [x[0] as number, { f: { aff: x[1], anger: x[2], fear: x[3], grat: x[4], resp: x[5] } as Feel, day: x[6] as number }]))); for (const [k, v] of s.mem) this.memory.set(k, v); for (const [k, v] of s.own) this.own.set(k, v); }
}
