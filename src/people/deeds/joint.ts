// D-462 (UD-32: "I want my voice to be able to do anything ... in a sandbox world"): JOINT DEEDS. What the stranger (or a
// townsman) agrees to do with or for someone really happens and really pays off. D-459's engine decides a deed and lays one
// segment; this module makes the undertaking a thing of the world with a before, a during and an after:
//   the plan: the walk there (Population.walkH from where each one is), the work at its proper place (a hunt on the hill
//     slopes with snares or the bow, fishing at the river bank, the house's own field, the roof of the house, the hearth of an
//     evening's drink, the teacher's own bench), the walk back; at its proper hour (snares at dawn, a drink after the evening
//     meal, no roof plastered in the rain); one undertaking at a time for each (the hour already promised is a reason);
//   the meeting kept or missed: the stranger must be there (sim.strangerNear reports whom he is among, as for his work): kept,
//     it pays off; missed, the one who waited remembers it (anger, respect, the house's trust; their brief says so);
//   the outcome into the world: game and fish as food (the house's grain and the stranger's purse, in barley's worth), the crop
//     got in, goods made, bread baked, a roof replastered (a state the house keeps: it decays, leaks on wet days, and a leaking
//     house grows sicker and burns wet fuel: the economy's own health, illness and causes), an evening's drink drunk from the
//     house's barley (and heard: the stranger's ear for their tongue);
//   a skill learned and used: a lesson from someone who does the work (their own days show it) raises the stranger's skill;
//     the economy reads it (speech/stranger.ts opts.skillOf): a craft house takes him on as a skilled hand, his day's work is
//     worth more and paid more, he haggles better over wares, he hunts and fishes better;
//   hiring with silver: a guide, a porter, a servant follow him ('@stranger', the talk's following) at their hours, paid each
//     evening from his purse into their house; no silver, they go home (and say so);
//   errands: a message carried (the messenger walks to the third person's house, the words are delivered as the stranger's
//     own deed through the engine, and the answer walks back), a thing fetched (from their house or the well), a person
//     brought (they decide for themselves, and come to where the stranger was);
//   refusals in the person's own words (sayNo: the decision's reasons as they would put them);
//   and the town's own: friends hunt and fish together, an evening's beer, kin at the harvest, neighbours at a leaking roof
//     (initiative(), with or without the stranger).
// Tier C throughout (DECISIONS D-462): yields, hours, wages and the roof's decay are reasoned (mud-plastered flat roofs are
// rolled and replastered each year before the rains: the region's building practice, C by analogy).
import type { Population, Seg, Where } from '../population';
import { segAt } from '../population';
import type { Economy } from '../economy/world';
import type { ActivityId } from '../activities';
import { u01, salt } from '../hash';
import { dateOf, seasonOf, REGNAL_DAYS } from '../calendar';
import { personaOf } from '../persona';
import { parseDeed } from './parse';
import { generateYear, type DayWeather } from '../../weather/generator';
import { START_JDN } from '../../core/calendar';
import type { Actor, Deed, Feel } from './types';

/** what the engine lends the joint deeds (deeds/engine.ts DeedWorld) */
export interface JointHost {
  pop: Population; seed: number;
  econ(day: number): Economy | null;
  feel(who: number, toward: Actor, d: Partial<Feel>, day: number): void;
  feelOf(who: number, toward: Actor, day: number): Feel;
  trust(hh: string, of: Actor, d: number, day: number): void;
  lay(pid: number, day: number, seg: Seg): void;
  unlay(pid: number, fromDay: number, why: RegExp): void;
  name(a: Actor): string;
  /** the engine's own act (a message delivered is the stranger's deed to the third person) */
  act(d: Deed, t: number): { out: { ok: boolean; why: string; refused?: boolean } };
  decide(pid: number, d: Deed, day: number, hour: number): { ok: boolean; why: string; lean: number };
  skill(k: string): number; addSkill(k: string, d: number): void;
  /** wounded and kept at home that day (the engine's injuries) */
  hurt(pid: number, day: number): boolean;
}

export type JobKind = 'hunt' | 'fish' | 'work' | 'roof' | 'drink' | 'meal' | 'lesson' | 'teach' | 'meet' | 'visit' | 'pray' | 'walk' | 'errand' | 'guard';
export interface Job {
  id: number; kind: JobKind; verb: string; actor: Actor; target: number;
  /** the third person of an errand (the one told, fetched or brought) */ third?: number;
  act: ActivityId; place: string; day: number; h0: number; h1: number; hh: string;
  /** the message carried, the good fetched, the bow taken */ about?: string; good?: string;
  /** set: laid; done: kept and paid off; missed: the stranger did not come; off: a party could not (dead, wounded, away) */
  state: 'set' | 'done' | 'missed' | 'off';
  came?: boolean; out?: string;
}
export interface Hire { pid: number; role: 'guide' | 'porter' | 'servant'; from: number; until: number; wage: number; hh: string; paid: number; ended?: string; /** the next day to be paid (at evening) */ next: number }

const S = { yield: salt('joint-yield'), own: salt('joint-own'), roof: salt('joint-roof'), pick: salt('joint-pick') };
const cl = (x: number, lo = 0, hi = 1) => x < lo ? lo : x > hi ? hi : x;
/** the hours of each undertaking at its place (C) */
const HOURS: Record<JobKind, number> = { hunt: 4, fish: 3, work: 2, roof: 3, drink: 2.5, meal: 1, lesson: 1.5, teach: 1.5, meet: 0.5, visit: 1, pray: 1, walk: 1, errand: 0.25, guard: 3 };
/** the family of an activity (who does one can teach the others of it; the skill's key) */
export const CRAFT: Record<string, ActivityId[]> = {
  weave: ['weave', 'spin'], spin: ['spin', 'weave'], craft: ['craft'], smith: ['smith', 'polish_metal', 'goldsmith'], work_wood: ['work_wood'], bake: ['bake', 'knead', 'grind'],
  brew: ['brew'], cook: ['cook'], fowl: ['fowl'], fish: ['fish'], herd: ['herd', 'shear', 'milk'], reap: ['reap', 'thresh', 'field_work'], plough: ['plough', 'field_work'], mould_brick: ['mould_brick', 'lay_brick'], tan: ['tan'], press_oil: ['press_oil'],
};
/** the wage of a hired follower a day, in silver (C: a porter's day as the market's DAY_WAGE; a guide a little more; a servant
 *  by the month, with his bread from his own house) */
export const HIRE_WAGE = { guide: 1 / 20, porter: 1 / 30, servant: 1 / 45 };
/** a hired follower's hours with the stranger (C: a porter's morning and afternoon loads, a guide's walks, a servant's morning
 *  and evening at his things and his hearth) */
export const HIRE_SPANS: Record<'guide' | 'porter' | 'servant', [number, number][]> = { guide: [[8, 11.5], [14, 16.5]], porter: [[8, 11], [14.5, 16.5]], servant: [[7, 8.5], [17, 18.5]] };
/** the roof (C): rolled and replastered each year before the rains, at a day of the late summer each house keeps; it wears a
 *  little each day and more each wet day; under LEAK it lets the rain in */
export const ROOF = { upkeep0: 150, upkeepSpan: 40, perDay: 0.0004, perWet: 0.008, leak: 0.45, neglect: 0.15 };
const FIELD = /^(reap|thresh|field_work|plough|irrigate|garden_work|pick_fruit|dig_canal)$/, CRAFTS = /^(weave|spin|craft|smith|work_wood|polish_metal|tan|press_oil|goldsmith)$/;
const HOME_WORK = /^(bake|knead|grind|cook|brew|clean|draw_water|carry_jar|carry_jar_head|gather|tend_fire)$/;

export class Joint {
  readonly jobs: Job[] = [];
  readonly hires: Hire[] = [];
  /** repairs to houses: hh -> the day and the roof after it */
  readonly roofs = new Map<string, { day: number; v: number }>();
  /** what came back to the stranger (an errand's answer, a hire ended): newest last (the dev overlay, the brief, the bot) */
  readonly news: { day: number; text: string }[] = [];
  /** per person: what they hold of the joint deeds (the brief's lines) */
  private notes = new Map<number, { day: number; text: string }[]>();
  readonly stats: Record<string, number> = {};
  private wetCum: number[] | null = null; private wx: DayWeather[] | null = null;
  private settledT = -1; private nextId = 0;
  /** the stranger's undertakings not yet settled (settle() runs every frame: it reads only these) */
  private mine: Job[] = [];
  /** the undertakings not yet settled, by person (the promised hours) */
  private open = new Map<number, Job[]>();
  private index(j: Job) { for (const p of [j.target, j.actor, j.third]) if (typeof p === 'number') { const l = this.open.get(p); if (l) l.push(j); else this.open.set(p, [j]); } }
  constructor(readonly h: JointHost) {}
  private bump(k: string, n = 1) { this.stats[k] = (this.stats[k] ?? 0) + n; }
  private note(pid: number, day: number, text: string) { const l = this.notes.get(pid) ?? []; l.push({ day, text }); if (l.length > 6) l.shift(); this.notes.set(pid, l); }
  private homeOf(pid: number, day: number) { const P = this.h.pop, H = P.households[P.home(pid, day)]; return { place: H?.home ?? `h:${P.home(pid, day)}`, hh: `h:${P.home(pid, day)}`, where: (H?.zone === 'plain' ? 'plain' : 'town') as Where, q: H?.q ?? '' }; }

  // ---------------------------------------------------------------- the house's roof (a state the house keeps)
  /** the year's weather, as the economy reads it (the same generator and seed: Economy.wx) */
  private year(): DayWeather[] { return this.wx ??= this.h.econ(0)?.wx ?? generateYear(this.h.seed, START_JDN, 365); }
  private wet(day: number): boolean { const W = this.year(); return !!W[((day % W.length) + W.length) % W.length]?.wet; }
  private wetBetween(a: number, b: number): number { // wet days in (a, b]
    if (b <= a) return 0; const W = this.year(), n = W.length;
    if (!this.wetCum || this.wetCum.length !== n + 1) { this.wetCum = [0]; for (let i = 0; i < n; i++) this.wetCum.push(this.wetCum[i] + (W[i].wet ? 1 : 0)); }
    const C = this.wetCum, at = (d: number) => { const k = Math.floor(d / n), r = d - k * n; return k * C[n] + C[r + 1]; };
    return at(b) - at(a);
  }
  /** the day the house last replastered its own roof, on or before `day` (a neglected one: a year or two before) */
  private upkeepDay(hh: string, day: number): number {
    const k = Number(hh.slice(2)), u = u01(this.h.seed, S.roof, k), at = ROOF.upkeep0 + Math.floor(u01(this.h.seed, S.roof, k, 1) * ROOF.upkeepSpan);
    const y = Math.floor(day / REGNAL_DAYS); let d = y * REGNAL_DAYS + at; if (d > day) d -= REGNAL_DAYS;
    if (u < ROOF.neglect) d -= REGNAL_DAYS * (u < ROOF.neglect / 2 ? 2 : 1); // (the old, the poor, the lone: the roof let go)
    return d;
  }
  /** the roof of a house on a day, 0..1 (LEAK: it lets the rain in) */
  roofOf(hh: string, day: number): number {
    const up = this.upkeepDay(hh, day), r = this.roofs.get(hh); let d0 = up, v0 = 1;
    if (r && r.day <= day && r.day >= up) { d0 = r.day; v0 = r.v; }
    return cl(v0 - ROOF.perDay * (day - d0) - ROOF.perWet * this.wetBetween(d0, day), 0.05, 1);
  }

  // ---------------------------------------------------------------- planning (what the engine judges and lays)
  /** the kind of undertaking a deed is, or null (the engine's generic lay serves it) */
  kindOf(d: Deed): JobKind | null {
    const a = d.act, said = (d.about ?? d.said ?? '').toLowerCase();
    switch (d.verb) {
      case 'join': case 'come_with': case 'help': case 'build': case 'carry':
        if (a === 'fowl') return 'hunt'; if (a === 'fish') return 'fish';
        if (a === 'eat') return /drink|beer|wine/.test(said) || d.verb === 'join' ? 'drink' : 'meal';
        if (a === 'offer' || a === 'chant') return 'pray';
        if (a && (a === 'mould_brick' || a === 'lay_brick') && /roof|plaster/.test(said)) return 'roof';
        if (d.verb === 'help' || d.verb === 'build' || d.verb === 'carry' || (a && a !== 'walk' && a !== 'play' && a !== 'wash' && a !== 'gamble')) return 'work';
        return 'walk';
      case 'repair': return a === 'mould_brick' || !a || /roof|plaster|leak/.test(said) ? 'roof' : 'work';
      case 'share_food': return 'meal';
      case 'teach': return 'lesson';
      case 'learn': return 'teach';
      case 'meet': return 'meet';
      case 'visit': return 'visit';
      case 'pray': case 'offer': return 'pray';
      case 'send': case 'fetch': case 'bring': return 'errand';
      case 'guard': return 'guard';
      default: return null;
    }
  }
  /** when an undertaking is done: its day and starting hour, from the time asked and the work's own hours (C) */
  when(d: Deed, t: number): { day: number; h0: number } {
    const k = this.kindOf(d); let at = t + (k === 'errand' ? 0 : d.inH ?? 0), day = Math.floor(at / 24), h = at - day * 24; // (an errand goes now: a "tomorrow" in it is the message's)
    const next = (hh: number) => { if (h > hh) day++; h = hh; };
    if (k === 'hunt' || k === 'fish') { if (h < 5.5 || h > 14) next(6.5); }
    else if (k === 'drink') { if (h < 18.5) h = 19.25; else if (h > 21) next(19.25); }
    else if (k === 'roof' || k === 'work' || k === 'lesson' || k === 'teach' || k === 'guard') { if (k === 'guard') { if (h < 19.5) h = 20; } else if (h < 6.5) h = 7; else if (h > 16) next(7.5); }
    else if (k === 'meet' && (d.inH ?? 0) < 0.3) { day++; } // ("meet me again": tomorrow at this hour)
    else if (k === 'errand' ? h < 6 || h > 20.5 : h < 6 || h > 21.5) next(k === 'errand' ? 7 : 8);
    if (k === 'roof') for (let i = 0; i < 3 && this.wet(day); i++) day++; // (no roof plastered in the rain: the first dry day)
    return { day, h0: h };
  }
  /** the proper place of an undertaking for the target (the hills, the river bank, the field, the house, the teacher's bench) */
  placeOf(d: Deed, k: JobKind, day: number, h0: number, t = day * 24 + h0): string {
    const P = this.h.pop, tg = d.target as number, home = this.homeOf(tg, day), npc = d.actor !== 'player';
    // (the town's own: no plan read, the cost of it (the lead, D-459): the house and its field stand for where they are)
    const atNow: Seg = npc ? { t0: h0, t1: h0 + 1, place: home.place, act: 'rest', why: '', where: home.where } : segAt(P.plan(tg, day), h0);
    const tD = Math.floor(t / 24), here = npc ? atNow : segAt(P.plan(tg, tD), t - tD * 24); // (where they stand as the words are said)
    const hostHome = typeof d.actor === 'number' ? this.homeOf(d.actor, day).place : home.place;
    switch (k) {
      case 'hunt': return d.place && /^(slope|edge|meadow):/.test(d.place) ? d.place : `slope:${home.q}`;
      case 'fish': return d.place && /^(bank|canal):/.test(d.place) ? d.place : `bank:${home.q}`;
      case 'roof': return home.place;
      case 'drink': case 'meal': case 'visit': return d.place && d.place !== 'hills' && d.place !== 'river' ? d.place : d.verb === 'visit' && typeof d.actor === 'number' ? hostHome : home.place;
      case 'work': { const a = d.act ?? atNow.act; if (a && FIELD.test(a)) return npc || P.households[P.home(tg, day)]?.zone === 'plain' || /^field:/.test(atNow.place) ? (/^field:/.test(atNow.place) ? atNow.place : `field:${P.home(tg, day)}:0`) : atNow.place;
        return d.act && HOME_WORK.test(d.act) ? home.place : atNow.where === 'road' ? home.place : atNow.place; }
      case 'lesson': { const a = d.act ?? 'craft'; const s = this.doesAt(tg, a, day); return s ?? home.place; }
      case 'teach': return home.place;
      case 'pray': return 'offering_place';
      case 'meet': return d.place && !/^(hills|river)$/.test(d.place) ? d.place : here.where === 'road' ? home.place : here.place;
      case 'guard': return home.place;
      default: return d.place && !/^(hills|river)$/.test(d.place) ? d.place : atNow.where === 'road' ? home.place : atNow.place;
    }
  }
  /** where a person does an activity of the family in their own days (the last week): their bench, their loom, their field */
  doesAt(pid: number, act: string, day: number): string | null {
    const fam = CRAFT[act] ?? [act], P = this.h.pop;
    for (let d = day; d > day - 7 && d >= 0; d--) for (const s of P.basePlan(pid, d)) if (fam.includes(s.act) && s.t1 - s.t0 >= 0.5) return s.place;
    return null;
  }
  /** whom the person has promised these hours to already (an undertaking, or a hire), or null */
  promised(pid: number, day: number, a: number, b: number): string | null {
    const j = this.busyWith(pid, day, a, b); if (j) return j.actor === pid ? this.h.name(j.target) : this.h.name(j.actor);
    for (const H of this.hires) if (H.pid === pid && !H.ended && H.from <= day && day < H.until && HIRE_SPANS[H.role].some(([x, y]) => x < b && a < y)) return 'the stranger, hired for silver';
    return null;
  }
  /** a job already set for the person overlapping these hours */
  busyWith(pid: number, day: number, a: number, b: number): Job | null {
    const l = this.open.get(pid); if (!l) return null;
    const live = l.filter(j => j.state === 'set'); if (live.length) this.open.set(pid, live); else { this.open.delete(pid); return null; }
    return live.find(j => j.day === day && j.h0 < b && a < j.h1) ?? null;
  }
  /** can the world do it (beyond the engine's own checks): a reason it cannot, or null */
  cannot(d: Deed, t: number): string | null {
    const k = this.kindOf(d), tg = d.target;
    if (d.verb === 'hire' && typeof tg === 'number' && this.hires.some(H => H.pid === tg && !H.ended && Math.floor(t / 24) < H.until)) return 'already promised that hour to the stranger, hired for silver';
    if (!k || typeof tg !== 'number') return null;
    const { day, h0 } = this.when(d, t), h1 = h0 + HOURS[k];
    const b = this.promised(tg, day, h0 - 0.5, h1 + 0.5); if (b) return `already promised that hour to ${b}`;
    if (typeof d.actor === 'number' && this.promised(d.actor, day, h0 - 0.5, h1 + 0.5)) return 'the one asking has promised that hour already';
    if (k === 'lesson' && !this.doesAt(tg, d.act ?? 'craft', Math.floor(t / 24))) return `does not do that work: ${(d.act ?? 'craft').replace(/_/g, ' ')}`;
    if (k === 'errand' && d.verb !== 'fetch' && d.third === undefined) return 'no one named to go to';
    if (k === 'errand' && d.third !== undefined && typeof d.third === 'number' && (!this.h.pop.persons[d.third] || this.h.pop.persons[d.third].dies <= day || !this.h.pop.present(d.third, day))) return 'the one named is not here';
    if (k === 'roof' && this.roofOf(this.homeOf(tg, day).hh, day) > 0.85) return 'the roof is sound: it was plastered this year';
    return null;
  }

  /** the undertaking for a consenting deed: the job and the walks, the work and the walks back laid into each one's day */
  plan(d: Deed, t: number): { job: Job; segs: [number, number, Seg][] } | null {
    const k = this.kindOf(d), tg = d.target; if (!k || typeof tg !== 'number') return null;
    const P = this.h.pop, { day, h0 } = this.when(d, t), h1 = Math.min(23.6, h0 + HOURS[k]), home = this.homeOf(tg, day);
    const place = k === 'errand' ? this.errandPlace(d, day, h0) : this.placeOf(d, k, day, h0, t);
    const said = (d.about ?? d.said ?? '').toLowerCase(), bow = k === 'hunt' && /\bbow|arrow|shoot/.test(said);
    const act: ActivityId = k === 'hunt' ? 'fowl' : k === 'fish' ? 'fish' : k === 'roof' ? 'mould_brick' : k === 'drink' || k === 'meal' ? 'eat' : k === 'pray' ? 'offer' : k === 'lesson' ? ((d.act && (CRAFT[d.act] ?? [d.act])[0]) as ActivityId) ?? 'craft' : k === 'work' ? (d.act ?? (d.actor === 'player' ? segAt(P.plan(tg, day), h0).act : 'clean')) : k === 'guard' ? 'rest' : 'talk';
    const job: Job = { id: -1, kind: k, verb: d.verb, actor: d.actor, target: tg, ...(typeof d.third === 'number' ? { third: d.third } : {}), act: act === 'sleep' || act === 'offmap' ? 'talk' : act, place, day, h0, h1, hh: home.hh, state: 'set',
      ...(d.about || d.said ? { about: d.about ?? d.said } : {}), ...(d.good ? { good: d.good } : {}) };
    if (d.actor === 'player' && (d.inH ?? 0) < 0.3 && day === Math.floor(t / 24) && Math.abs(h0 - (t - day * 24)) < 0.3) job.came = true; // (now: he is there, talking to them)
    const other = (x: Actor) => x === 'player' ? 'the stranger' : this.h.name(x);
    const what = WHAT[k](job, bow);
    const segs: [number, number, Seg][] = [];
    if (k === 'errand') { segs.push(...this.walkThere(tg, day, h0, h1, place, `${what} for ${other(d.actor)}`, 'talk', home.where)); return { job, segs }; }
    if (k === 'guard') { segs.push([tg, day, { t0: h0, t1: h1, place: home.place, act: 'rest', why: `at home, ${other(d.actor)} keeping watch over the house`, where: home.where }]); return { job, segs }; }
    const people = [tg, ...(typeof d.actor === 'number' ? [d.actor] : [])];
    for (const p of people) { const w = p === tg ? other(d.actor) : other(tg);
      // (the same ground for both: popgeo sets each one's own spot on it)
      segs.push(...this.walkThere(p, day, h0, h1, place, `${what} with ${w}`, job.act, home.where, bow, d.actor !== 'player')); }
    return { job, segs };
  }
  /** the walk to a place, the work there and the walk back, fitted into the person's day (C: walkH, the planner's own walk) */
  private walkThere(pid: number, day: number, h0: number, h1: number, place: string, why: string, act: ActivityId, W0: Where, bow = false, npc = false): [number, number, Seg][] {
    const P = this.h.pop, H = this.homeOf(pid, day), atHome: Seg = { t0: 0, t1: 24, place: H.place, act: 'rest', why: '', where: H.where };
    const plan = npc ? null : P.plan(pid, day), from = plan ? segAt(plan, Math.max(0, h0 - 0.05)) : atHome, back = plan ? segAt(plan, Math.min(23.95, h1 + 0.05)) : atHome; // (the town's own: from home and back)
    const W = whereOf(place, W0), fromPlace = from.where === 'road' ? this.homeOf(pid, day).place : from.place, backPlace = back.where === 'road' ? this.homeOf(pid, day).place : back.place;
    const w1 = fromPlace === place ? 0 : P.walkH(fromPlace, place, day, from.where === 'road' ? W0 : from.where, W), w2 = backPlace === place ? 0 : P.walkH(place, backPlace, day, W, back.where === 'road' ? W0 : back.where);
    const out: [number, number, Seg][] = [], t0 = Math.max(0.1, h0 - w1), t2 = Math.min(23.9, h1 + w2);
    if (w1 > 0.02 && h0 - t0 > 0.02) out.push([pid, day, { t0, t1: h0, place: `road:${W}`, act: 'walk', why: `on the way to ${placeWords(place)}`, where: 'road' }]);
    out.push([pid, day, { t0: h0, t1: h1, place, act, why: bow && !/bow/.test(why) ? `${why}, with the bow` : why, where: W }]);
    if (w2 > 0.02 && t2 - h1 > 0.02) out.push([pid, day, { t0: h1, t1: t2, place: `road:${back.where === 'road' ? W0 : back.where}`, act: 'walk', why: 'walking back', where: 'road' }]);
    return out;
  }
  private errandPlace(d: Deed, day: number, h0: number): string {
    const P = this.h.pop;
    if (typeof d.third === 'number') { const s = segAt(P.plan(d.third, day), h0 + 0.3); return s.where === 'road' ? this.homeOf(d.third, day).place : s.place; }
    if (d.good === 'water') return `well:${this.homeOf(d.target as number, day).q}`;
    if (d.good && /^(grain|bread|food|beer|wine|oil|fuel)$/.test(d.good)) return this.homeOf(d.target as number, day).place;
    return `market:${this.homeOf(d.target as number, day).q}`;
  }
  /** a job agreed: kept, and its days laid */
  add(job: Job, segs: [number, number, Seg][]) {
    job.id = this.nextId++; this.jobs.push(job); this.index(job); if (job.actor === 'player') this.mine.push(job); this.bump(`set:${job.kind}`);
    for (const [pid, day, s] of segs) this.h.lay(pid, day, s);
  }

  // ---------------------------------------------------------------- the stranger among people: present at an undertaking
  /** the stranger is among these people now (sim.strangerNear): the undertakings they are at with him are kept */
  near(pids: readonly number[], t: number) {
    const day = Math.floor(t / 24), h = t - day * 24, set = new Set(pids);
    for (const j of this.mine) { if (j.state !== 'set' || j.came || j.day !== day || h < j.h0 - 0.5 || h > j.h1 + 0.25) continue;
      if (set.has(j.target) || (j.third !== undefined && set.has(j.third))) j.came = true; }
    this.settle(t);
  }

  // ---------------------------------------------------------------- what comes of it
  /** the stranger's undertakings whose hours are over by t are settled (kept or missed) */
  settle(t: number) {
    if (t <= this.settledT) return; this.settledT = t;
    // hires are paid each evening of their days, as the stranger's time reaches it (not the economy's look-ahead)
    for (const H of this.hires) while (!H.ended && H.next < H.until && H.next * 24 + 19 <= t) { const d = H.next++; this.hireDay(H, d, this.h.econ(d)); }
    for (const H of this.hires) if (!H.ended && H.next >= H.until) this.hireDay(H, H.until, null);
    if (!this.mine.length) return;
    for (const j of this.mine) if (j.state === 'set' && j.day * 24 + j.h1 + 0.5 <= t) this.resolve(j);
    this.mine = this.mine.filter(j => j.state === 'set');
  }
  private resolve(j: Job) {
    const P = this.h.pop, day = j.day, mid = (j.h0 + j.h1) / 2, E = this.h.econ(day);
    // the parties: alive, here, and keeping the undertaking (a wound laid over it, a death, a journey call it off)
    const there = (p: number) => { const x = P.persons[p]; if (!x || x.dies <= day || !P.present(p, day)) return false; if (j.actor !== 'player') return !this.h.hurt(p, day); const s = segAt(P.plan(p, day), mid); return s.place === j.place || s.place === `@stranger` || (s.act === j.act && s.why.includes('with')); };
    if (!there(j.target) || (typeof j.actor === 'number' && !there(j.actor))) { j.state = 'off'; j.out = 'called off'; this.bump(`off:${j.kind}`); return; }
    if (j.actor === 'player' && !j.came && j.kind !== 'errand') { this.missed(j); return; }
    j.state = 'done'; this.bump(`done:${j.kind}`); const out = this.payOff(j, E);
    j.out = out; if (j.actor === 'player') this.note(j.target, day, `with the stranger, ${WHAT[j.kind](j, /bow/.test(j.about ?? ''))}: ${out}`);
  }
  private missed(j: Job) {
    j.state = 'missed'; this.bump(`missed:${j.kind}`); j.out = 'the stranger did not come';
    this.h.feel(j.target, 'player', { anger: 0.15, resp: -0.1, aff: -0.04 }, j.day); this.h.trust(j.hh, 'player', -0.04, j.day);
    this.note(j.target, j.day, `the stranger said he would come (${WHAT[j.kind](j, false)}) and did not: you waited for him`);
    // (the hunt or the fishing goes on without him: the target's own catch)
    if (j.kind === 'hunt' || j.kind === 'fish') this.catchOf(j, this.h.econ(j.day), [j.target]);
  }
  /** what comes of a kept undertaking, into the world; the words for it */
  private payOff(j: Job, E: Economy | null): string {
    const day = j.day, P = this.h.pop, withP = j.actor === 'player', H = E?.hh.get(j.hh), purse = E?.hasStranger ? E.stranger().purse : null;
    const both = (d: Partial<Feel>) => { this.h.feel(j.target, j.actor, d, day); if (typeof j.actor === 'number') this.h.feel(j.actor, j.target, d, day); };
    switch (j.kind) {
      case 'hunt': case 'fish': { both({ aff: 0.06, resp: 0.02 }); return this.catchOf(j, E, [j.target, ...(typeof j.actor === 'number' ? [j.actor] : []), ...(withP ? ['player' as const] : [])]); }
      case 'roof': { const hh = j.hh, r0 = this.roofOf(hh, day), v = cl(r0 + 0.35 * (typeof j.actor === 'number' || withP ? 2 : 1) * (j.h1 - j.h0) / 3); this.roofs.set(hh, { day, v });
        both({ grat: 0.12, aff: 0.04 }); if (j.actor !== j.target) this.h.trust(hh, j.actor, 0.05, day); this.bump('roofs_mended');
        return `the roof replastered (${r0 < ROOF.leak ? 'it leaked; it will keep the rain out now' : 'made good before the rains'})`; }
      case 'work': { const hrs = j.h1 - j.h0, a = j.act; let what = 'the work went quicker';
        if (H) { if (FIELD.test(a)) { const g = (a === 'reap' || a === 'thresh' ? 1.2 : 0.5) * hrs; H.grain += g; what = `${a === 'reap' ? 'more of the crop cut' : a === 'thresh' ? 'more grain threshed' : 'the field work done'}`; }
          else if (CRAFTS.test(a)) { const g = 0.05 * hrs * (1 + (withP ? 2 * this.h.skill(skillKey(a)) : 0.5)); H.goods += g; what = 'more wares made'; }
          else if (/^(herd|shear|milk|tend_animals)$/.test(a)) { H.goods += 0.02 * hrs; what = 'the animals seen to'; }
          else if (HOME_WORK.test(a)) { H.health = Math.min(1, H.health + 0.004); what = a === 'bake' ? 'the bread baked' : a === 'grind' ? 'the flour ground' : a === 'brew' ? 'the beer brewed' : 'the house\'s work done'; if (withP && purse && (a === 'bake' || a === 'cook')) { const g = Math.min(0.5, H.grain * 0.01); H.grain -= g; purse.grain += g; what += ', and a loaf for the stranger'; } } }
        both({ grat: 0.08, aff: 0.03 }); if (j.actor !== j.target) this.h.trust(j.hh, j.actor, 0.03, day); if (withP) this.h.addSkill(skillKey(a), 0.02); return what; }
      case 'drink': { const host = H, g = 0.6; if (host && host.grain > g * 4) host.grain -= g; both({ aff: 0.12, anger: -0.1 });
        if (withP && E?.hasStranger) { const S = E.stranger(); S.do({ a: 'hear', day: Math.min(day, E.day), lang: S.langOf(j.hh), hours: j.h1 - j.h0, simple: 0.5, spoke: true }); this.h.trust(j.hh, 'player', 0.03, day); }
        return 'beer drunk at the house of an evening, and talk'; }
      case 'meal': { if (H && H.grain > 3) H.grain -= 0.4; if (withP && purse) purse.grain += 0; both({ aff: 0.08 }); return 'a meal shared'; }
      case 'lesson': { const k = skillKey(j.act), s0 = this.h.skill(k), inc = 0.12 * (1 - s0); this.h.addSkill(k, inc); this.bump('lessons'); both({ resp: 0.03, aff: 0.03 });
        return `taught ${j.act.replace(/_/g, ' ')} (the stranger's hand at it: ${skillWord(s0 + inc)})`; }
      case 'teach': { both({ resp: 0.06, aff: 0.03 }); if (H) H.goods += 0.02; return 'shown something new by the stranger'; }
      case 'meet': case 'visit': case 'walk': { both({ aff: 0.05, resp: 0.03 }); if (j.kind === 'visit' && H && H.grain > 3) H.grain -= 0.3; if (withP) this.h.trust(j.hh, j.actor, 0.02, day); return j.kind === 'meet' ? 'met at the hour named' : j.kind === 'visit' ? 'a visit, bread and talk' : 'a walk together'; }
      case 'pray': { both({ resp: 0.05, aff: 0.03 }); return 'an offering made together at the offering place'; }
      case 'guard': { both({ grat: 0.1 }); this.h.trust(j.hh, j.actor, 0.04, day); return 'the house watched over through the evening'; }
      case 'errand': return this.errandDone(j, E);
    }
    void P; return '';
  }
  /** game or fish, as food: the catch shared out among those who went (C: snared partridge, quail and sandgrouse, a hare;
   *  the barbel and carp of the Kur; a kilo of flesh worth two of barley) */
  private catchOf(j: Job, E: Economy | null, who: Actor[]): string {
    const day = j.day, m = dateOf(day).month, sea = seasonOf(m), hunt = j.kind === 'hunt', u = u01(this.h.seed, S.yield, j.id, day);
    const skillP = who.includes('player') ? this.h.skill(hunt ? 'fowl' : 'fish') : 0;
    const p = hunt ? 0.35 + (sea === 'autumn' || sea === 'winter' ? 0.2 : 0) + 0.25 * skillP + (/bow/.test(j.about ?? '') ? 0.05 : 0) : 0.55 + (sea === 'spring' ? 0.15 : sea === 'winter' ? -0.2 : 0) + 0.2 * skillP;
    if (who.includes('player')) this.h.addSkill(hunt ? 'fowl' : 'fish', 0.04 * (1 - skillP));
    if (u > p) { this.bump(`empty:${j.kind}`); return hunt ? 'nothing in the snares' : 'no fish took the line'; }
    const kg = (hunt ? 0.4 + 2.6 * u01(this.h.seed, S.yield, j.id, 2) * (u01(this.h.seed, S.yield, j.id, 3) < 0.08 ? 4 : 1) : 0.5 + 2.5 * u01(this.h.seed, S.yield, j.id, 2)) * (1 + 0.5 * skillP);
    const worth = kg * 2, share = worth / who.length; this.bump(`kg:${j.kind}`, kg);
    if (E) for (const a of who) { if (a === 'player') { if (E.hasStranger) E.stranger().purse.grain += share; continue; } const H = E.hh.get(`h:${this.h.pop.home(a, day)}`); if (H) H.grain += share; }
    const n = Math.max(1, Math.round(kg / (hunt ? 0.35 : 0.6)));
    return hunt ? (kg > 4 ? 'a gazelle brought down, shared out' : `${n} birds from the snares, shared out`) : `${n} fish, shared out`;
  }
  private errandDone(j: Job, E: Economy | null): string {
    const day = j.day, t = day * 24 + j.h0 + 0.1, P = this.h.pop, tName = j.third !== undefined ? this.h.name(j.third) : '';
    this.h.feel(j.target, j.actor, { resp: 0.02 }, day);
    if (j.verb === 'fetch' && j.third === undefined) { // a thing fetched: from their house, the well or the market
      const g = j.good ?? 'water', H = E?.hh.get(j.hh), purse = E?.hasStranger ? E.stranger().purse : null;
      if (g === 'bread' || g === 'grain' || g === 'food') { const q = Math.min(1, (H?.grain ?? 0) * 0.02); if (H) H.grain -= q; if (j.actor === 'player' && purse) purse.grain += q; this.h.feel(j.target, j.actor, { grat: -0.02 }, day); }
      if (g === 'fuel' && purse && j.actor === 'player') purse.fuel += 1;
      const text = `${this.h.name(j.target)} fetched ${g === 'water' ? 'water from the well' : g} for you`; if (j.actor === 'player') this.news.push({ day, text }); return text; }
    if (j.third === undefined) return 'no one to go to';
    if (j.verb === 'send') { // a message carried: the words delivered as the stranger's own deed to the third person
      const words = (j.about ?? '').replace(/^.*?\b(tell (him|her|them|your \w+)|say to (him|her)|that)\b\s*/i, '').trim() || (j.about ?? '');
      const inner = parseDeed(words, j.actor, { addressee: j.third, hour: j.h0 + 0.1 }) ?? { verb: 'tell', actor: j.actor, target: j.third, about: words, said: words } as Deed;
      inner.target = j.third; if (inner.third === j.third) delete inner.third;
      const r = this.h.act(inner, t), ok = r.out.ok;
      const text = `${this.h.name(j.target)} carried your word to ${tName}: ${ok ? (inner.verb === 'tell' ? 'it was told' : `${tName} agrees`) : `${tName} will not (${r.out.why})`}`;
      if (j.actor === 'player') this.news.push({ day, text }); this.bump(ok ? 'message_agreed' : 'message_refused'); return text; }
    // bring (or fetch someone): they decide for themselves, then come to where the stranger was
    const lean = this.h.decide(j.third, { verb: 'come_with', actor: j.actor, target: j.third }, day, j.h0 + 0.3), fond = this.h.feelOf(j.third, j.target, day).aff;
    const ok = lean.lean + 0.3 * fond + 0.15 > 0;
    if (ok) { const at = segAt(P.plan(j.target, day), Math.max(0, j.h0 - 0.4)).place, h0 = Math.min(23, j.h1 + 0.2), h1 = Math.min(23.6, h0 + 0.75), home = this.homeOf(j.third, day);
      const meet: Job = { id: -1, kind: 'meet', verb: 'meet', actor: j.actor, target: j.third, act: 'talk', place: at.startsWith('road:') ? this.homeOf(j.target, day).place : at, day, h0, h1, hh: home.hh, state: 'set' };
      this.add(meet, this.walkThere(j.third, day, h0, h1, meet.place, `come at ${j.actor === 'player' ? 'the stranger' : this.h.name(j.actor)}'s word, brought by ${this.h.name(j.target)}`, 'talk', home.where)); }
    const text = ok ? `${this.h.name(j.target)} brought ${tName}: ${tName} is coming to where you were` : `${tName} would not come (${lean.why})`;
    if (j.actor === 'player') this.news.push({ day, text }); this.bump(ok ? 'brought' : 'would_not_come'); return text;
  }

  // ---------------------------------------------------------------- hiring with silver
  /** the stranger hires a person (a deed 'hire' agreed): the role from the words, the days, the wage */
  hire(pid: number, said: string, t: number): Hire | null {
    const day = Math.floor(t / 24), w = said.toLowerCase(), role: Hire['role'] = /guide|show me the way|lead me/.test(w) ? 'guide' : /servant|serve|cook for me|keep my/.test(w) ? 'servant' : 'porter';
    const m = /\bfor (a|one|two|three|four|five|six|seven|ten|\d+) (days?|months?)\b/.exec(w), N: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };
    const n = m ? (N[m[1]] ?? Number(m[1])) * (/month/.test(m[2]) ? 30 : 1) : role === 'servant' ? 30 : 1;
    const from = (t - day * 24) > 15 ? day + 1 : day;
    const H: Hire = { pid, role, from, until: from + Math.max(1, Math.min(90, n)), wage: HIRE_WAGE[role], hh: `h:${this.h.pop.home(pid, day)}`, paid: 0, next: from };
    this.hires.push(H); this.layHire(H, from, Math.min(H.until, from + 7), from === day ? t - day * 24 : 0); this.bump(`hired:${role}`); return H;
  }
  private layHire(H: Hire, a: number, b: number, fromH = 0) {
    const why = H.role === 'guide' ? 'walking with the stranger, showing him the way: hired for silver' : H.role === 'porter' ? 'carrying for the stranger: hired for silver' : 'serving the stranger: hired for silver';
    for (let d = a; d < b; d++) for (const [x0, y] of HIRE_SPANS[H.role]) { const x = d === a ? Math.max(x0, fromH) : x0; if (y - x < 0.25) continue; this.h.lay(H.pid, d, { t0: x, t1: y, place: '@stranger', act: H.role === 'porter' ? 'carry_sack' : 'walk', why, where: 'town', ...(H.role === 'porter' ? { carry: 'sack' } : {}) }); }
  }
  hiredNow(day: number) { return this.hires.filter(h => !h.ended && h.from <= day && day < h.until); }
  private hireDay(H: Hire, day: number, E: Economy | null) {
    if (H.ended || day < H.from || day >= H.until) { if (!H.ended && day >= H.until) { H.ended = 'the days agreed are done'; this.news.push({ day, text: `${this.h.name(H.pid)}'s hire is done: paid ${H.paid} days` }); } return; }
    const P = this.h.pop, x = P.persons[H.pid];
    if (!x || x.dies <= day || !P.present(H.pid, day)) { this.endHire(H, day, 'not here'); return; }
    const S = E?.hasStranger ? E.stranger() : null;
    if (!S || S.purse.cash < H.wage) { this.endHire(H, day, 'no silver to pay'); this.h.feel(H.pid, 'player', { anger: 0.2, resp: -0.1 }, day); this.h.trust(H.hh, 'player', -0.05, day); return; }
    S.purse.cash -= H.wage; const Hh = E!.hh.get(H.hh); if (Hh) Hh.cash += H.wage; H.paid++;
    this.h.feel(H.pid, 'player', { grat: 0.02, resp: 0.01 }, day); this.bump('hire_days'); this.bump('hire_silver', H.wage);
    // what the hired do: a guide talks with him all day (his ear for their tongue) and vouches for him to the houses on the
    // way; a porter carries (his day's carrying at the market goes with two hands); a servant keeps his things and his hearth
    if (H.role === 'guide') { S.do({ a: 'hear', day: Math.min(day, E!.day), lang: S.langOf(H.hh), hours: 4, simple: 0.6, spoke: true }); for (const k of P.households[P.home(H.pid, day)]?.kin ?? []) this.h.trust(`h:${k}`, 'player', 0.01, day); }
    if (H.role === 'servant') { S.purse.fuel += 0.5; if (S.hungry > 0 && S.purse.grain > 0.5) S.hungry = 0; }
    if (H.role === 'porter' && S.dayHire?.day === day && !S.dayHire.paid) { /* (the porter's back doubles the loads: paid a little more, C) */ S.purse.cash += 1 / 60; }
    if ((day - H.from) % 7 === 6) this.layHire(H, day + 1, Math.min(H.until, day + 8));
  }
  private endHire(H: Hire, day: number, why: string) {
    H.ended = why; this.h.unlay(H.pid, day, /hired for silver/); this.news.push({ day, text: `${this.h.name(H.pid)} has gone home: ${why}` }); this.bump(`hire_ended:${why}`);
  }
  dismiss(pid: number, day: number) { for (const H of this.hires) if (H.pid === pid && !H.ended) this.endHire(H, day, 'sent away'); }

  // ---------------------------------------------------------------- the day (after the economy's step)
  /** a day of the world: the roofs in the rain, the hires paid, the town's own undertakings settled */
  day(day: number) {
    const E = this.h.econ(day), P = this.h.pop;
    if (E && this.wet(day)) { // a leaking roof: the damp and the cold get in (C): the house's health, its fuel, now and then its goods
      for (const H of E.hh.values()) { if (H.dead) continue; const r = this.roofOf(H.id, day); if (r >= ROOF.leak) continue;
        const k = 1 - r / ROOF.leak; H.health = Math.max(0, H.health - 0.01 * k); H.fuel = Math.max(0, H.fuel - 0.8 * k);
        if (u01(this.h.seed, S.roof, Number(H.id.slice(2)), day) < 0.05 * k) H.goods = Math.max(0, H.goods - 0.5);
        if (H.cause.health === undefined || E.events[H.cause.health].day < day - 30) H.cause.health = E.record(day, H.id, 'roof_leaks', [H.cause.cash]);
        this.bump('leak_house_days'); } }
    // the town's own undertakings (no stranger): kept unless a party could not, the day after
    for (let i = Math.max(0, this.jobs.length - 6000); i < this.jobs.length; i++) { const j = this.jobs[i]; if (j.state === 'set' && j.actor !== 'player' && j.day < day) this.resolve(j); }
    if (this.jobs.length > 20000) this.jobs.splice(0, this.jobs.length - 15000);
    if (this.news.length > 200) this.news.splice(0, this.news.length - 200);
    void P;
  }

  /** the town's own undertakings for a day (no stranger needed): friends to the hills or the river on a slack day, an evening's
   *  beer, kin at the harvest, neighbours at a leaking roof on a dry day (C: a few times a month for a young man; the roof
   *  mended within a fortnight or so of dry days for most) */
  initiative(day: number, max = 120): Deed[] {
    const P = this.h.pop, out: Deed[] = [], C = P.cal.ctx(day), n = P.persons.length, sea = seasonOf(dateOf(day).month);
    const start = Math.floor(u01(this.h.seed, S.pick, day) * n), step = 6151, harvest = C.agri.has('E-42') || C.agri.has('E-43');
    const tie = (x: number) => { const c = P.persons[x].ties.filter(t => P.persons[t] && P.present(t, day) && P.ageOn(t, day) >= 14 && P.persons[t].dies > day + 1); return c.length ? c[Math.floor(u01(this.h.seed, S.pick, x, day) * c.length)] : null; };
    for (let i = 0, x = start; i < 3000 && out.length < max; i++, x = (x + step) % n) {
      const p = P.persons[x]; if (!p || !P.present(x, day) || p.dies <= day + 1) continue; const age = P.ageOn(x, day); if (age < 14) continue;
      const u = u01(this.h.seed, S.own, x, day), H = P.households[P.home(x, day)]; if (!H || (H.zone !== 'town' && H.zone !== 'plain')) continue;
      // a leaking roof on a dry day: a kinsman or friend comes to help replaster it (the head of the house asks)
      if (u < 0.05 && H.members[0] === x && !C.wx.wet && this.roofOf(`h:${H.id}`, day) < ROOF.leak) { const f = tie(x); if (f !== null) out.push({ verb: 'repair', actor: f, target: x, act: 'mould_brick', about: 'the roof', inH: 0 }); continue; }
      // kin at the harvest
      if (harvest && p.sex === 'm' && age >= 16 && age < 60 && u < 0.004) { const f = tie(x); if (f !== null) out.push({ verb: 'help', actor: f, target: x, act: 'reap', inH: 0 }); continue; }
      // young and grown men: the hills or the river with a friend, tomorrow at dawn; an evening's beer (C)
      if (p.sex === 'm' && age >= 15 && age < 50 && u < 0.0035) { const f = tie(x); if (f !== null && P.persons[f].sex === 'm') out.push({ verb: 'join', actor: x, target: f, act: u < 0.0015 && sea !== 'summer' ? 'fowl' : 'fish', inH: 20, about: u < 0.0008 ? 'with the bow' : '' }); continue; }
      if (p.sex === 'm' && age >= 18 && u > 0.996) { const f = tie(x); if (f !== null && P.persons[f].sex === 'm') out.push({ verb: 'join', actor: x, target: f, act: 'eat', about: 'beer', inH: 0 }); continue; }
      // a hot word over the beer or a boundary: a petty quarrel (C: the friction a town lives with)
      if (age >= 18 && u > 0.9993 && personaOf(P, x, day).temper > 0.6) { const f = tie(x) ?? null; if (f !== null) out.push({ verb: u > 0.9997 ? 'mock' : 'insult', actor: x, target: f, force: 0.3 }); continue; }
    }
    return out;
  }

  // ---------------------------------------------------------------- reading
  /** a person's lines of the joint deeds for their brief (out of world: the translation layer's English) */
  briefOf(pid: number, day: number): string[] {
    const out: string[] = [];
    for (const n of (this.notes.get(pid) ?? []).filter(n => day - n.day < 20).slice(-2)) out.push(`${day - n.day === 0 ? 'Today' : day - n.day === 1 ? 'Yesterday' : 'Some days ago'}: ${n.text}.`);
    const next = this.jobs.slice(-3000).find(j => j.state === 'set' && j.actor === 'player' && j.target === pid && j.day >= day);
    if (next) out.push(`You have agreed with the stranger: ${WHAT[next.kind](next, /bow/.test(next.about ?? ''))}, ${next.day === day ? 'today' : 'tomorrow'} at ${hourWords(next.h0)}.`);
    const P = this.h.pop, hh = `h:${P.home(pid, day)}`; if (this.roofOf(hh, day) < ROOF.leak && P.households[P.home(pid, day)]?.zone !== 'terrace') out.push('The roof of your house lets the rain in: it wants replastering.');
    const H = this.hires.find(h => h.pid === pid && !h.ended && h.from <= day && day < h.until); if (H) out.push(`The stranger has hired you as his ${H.role}, for silver each evening.`);
    return out;
  }

  save() { return { jobs: this.jobs.filter(j => j.state === 'set' || j.day > (this.jobs[this.jobs.length - 1]?.day ?? 0) - 30), hires: this.hires, roofs: [...this.roofs], news: this.news.slice(-60), notes: [...this.notes], stats: this.stats, settledT: this.settledT, nextId: this.nextId }; }
  load(s: ReturnType<Joint['save']> | undefined) { if (!s) return; this.jobs.splice(0, this.jobs.length, ...s.jobs); this.nextId = s.nextId; this.mine = this.jobs.filter(j => j.state === 'set' && j.actor === 'player'); this.open.clear(); for (const j of this.jobs) if (j.state === 'set') this.index(j); this.hires.splice(0, this.hires.length, ...s.hires);
    this.roofs.clear(); for (const [k, v] of s.roofs) this.roofs.set(k, v); this.news.splice(0, this.news.length, ...s.news); this.notes = new Map(s.notes); Object.assign(this.stats, s.stats); this.settledT = s.settledT; }
}

/** what an undertaking is, in words (the plans' reason and the brief) */
const WHAT: Record<JobKind, (j: Job, bow: boolean) => string> = {
  hunt: (_j, bow) => bow ? 'hunting in the hills with the bow' : 'setting snares in the hills', fish: () => 'fishing at the river', work: j => `${gerund(j.act)}`, roof: () => 'replastering the roof of the house',
  drink: () => 'drinking beer of an evening', meal: () => 'sharing a meal', lesson: j => `learning to ${j.act.replace(/_/g, ' ')}`, teach: () => 'being shown something new', meet: () => 'meeting at the hour named',
  visit: () => 'a visit at the house', pray: () => 'making an offering together', walk: () => 'walking together', errand: j => j.verb === 'send' ? 'carrying a message' : j.verb === 'bring' || j.third !== undefined ? 'going to fetch someone' : 'fetching something', guard: () => 'keeping watch over the house',
};
function gerund(a: string): string { const m: Record<string, string> = { reap: 'reaping', thresh: 'threshing', field_work: 'working in the field', plough: 'ploughing', irrigate: 'watering the field', weave: 'weaving', spin: 'spinning', craft: 'at the craft', smith: 'at the forge', work_wood: 'working wood', bake: 'baking', grind: 'grinding', cook: 'cooking', brew: 'brewing', herd: 'herding', draw_water: 'drawing water', gather: 'gathering fuel', mould_brick: 'moulding bricks', lay_brick: 'laying bricks', haul: 'hauling', clean: 'cleaning', garden_work: 'working the garden', pick_fruit: 'picking fruit', tend_animals: 'seeing to the animals', dig_canal: 'digging the channel' }; return m[a] ?? `at the work (${a.replace(/_/g, ' ')})`; }
export function skillKey(act: string): string { for (const [k, fam] of Object.entries(CRAFT)) if (k === act || fam[0] === act) return k; for (const [k, fam] of Object.entries(CRAFT)) if (fam.includes(act as ActivityId)) return k; return act; }
function skillWord(s: number) { return s < 0.15 ? 'a beginner' : s < 0.35 ? 'learning' : s < 0.6 ? 'a fair hand' : 'skilled'; }
function hourWords(h: number) { return h < 7.5 ? 'dawn' : h < 11 ? 'morning' : h < 14 ? 'midday' : h < 17.5 ? 'afternoon' : 'evening'; }
function whereOf(place: string, W0: Where): Where { return /^(slope|edge|meadow|bank|field|pasture|flock|crown_fields|canal):/.test(place) ? 'plain' : place === 'offering_place' ? 'town' : W0; }
function placeWords(p: string) { return /^slope:/.test(p) ? 'the hills' : /^(bank|canal):/.test(p) ? 'the river' : /^field:/.test(p) ? 'the field' : /^well:/.test(p) ? 'the well' : /^market:/.test(p) ? 'the market' : p === 'offering_place' ? 'the offering place' : 'the house'; }

/** a refusal in the person's own words (the translation layer's English): the decision's reasons as they would put them */
export function sayNo(why: string, verb: string): string {
  const r = why.split(/;\s*/)[0] ?? '';
  const busy = /^busy (.+)$/.exec(r); if (busy) { const x = busy[1]; return /^\w+ing\b/.test(x) ? `Not now: I am ${x}.` : `Not now: I have my work (${x}).`; }
  const T: [RegExp, string][] = [
    [/^asleep/, ''], [/on duty/, 'I am on watch: I cannot leave my post.'], [/woman does not go off/, 'It is not fitting: I do not go off with a man I do not know.'],
    [/child does not go off/, 'My mother would not let me.'], [/still angry/, 'After what you did? No.'], [/dislikes him/, 'I want nothing from you.'],
    [/does not trust/, 'My house does not know you well enough for that.'], [/cold to strangers/, 'I do not know you.'], [/little to spare/, 'We have nothing to spare, not this year.'],
    [/afraid/, 'Leave me be.'], [/proud/, 'I will not stand for that.'], [/already promised that hour to (.+)$/, 'I have promised that hour to $1.'],
    [/does not do that work/, 'I do not know that work: ask someone who does it.'], [/roof is sound/, 'The roof is sound: we plastered it this summer.'],
    [/no one named/, 'Go to whom? You have not said.'], [/not here/, 'They are not here.'], [/no one likes/, verb === 'hire' ? 'I am no one\'s servant.' : 'No.'],
  ];
  for (const [re, s] of T) { const m = re.exec(r); if (m) return s.replace('$1', m[1] ?? ''); }
  return verb === 'join' || verb === 'come_with' ? 'Not today.' : 'No, not this time.';
}
