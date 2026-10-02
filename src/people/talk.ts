// D-315 (UD-21, UD-07, UD-08; T-E10): conversations that act on the world and are remembered, per save.
//
// The stranger asks a person to do something (converse/intent.ts reads the ask from the model's tag or the stranger's words);
// the SIMULATION decides here whether they do it: their duties (a guard on watch does not leave the post; a gang's man does
// not leave the work the foreman counts; a scribe does not leave the tablets), their rank, the hour (nobody walks the lanes
// with a stranger in the dark), their family (a child follows until called home; a woman of the house does not go off with
// a strange man, C), their plan (how far the place is from where the day takes them) and their temperament (a seeded draw
// from the person's own trait). A deed done is NEW PLAN STEPS laid over the person's day plan (Population.plan applies
// them): a walk to the well and back, a stretch of following the stranger, a gift fetched from the house. The detailed
// agents (sim.ts) and the population view (popview.ts) carry them out through the same machinery as any plan step, with a
// time limit and a walk back to where the day has them. Nothing is teleported, nothing is scripted after the decision.
//
// Every player-caused change is an EVENT (kept in the save, sim.save().talk): the deeds with the plan steps they laid down,
// the pauses of a conversation (the person stops, turns to the stranger, and afterwards catches up with the day), the
// memory row of each conversation. With no event nothing here changes anything: the world is the same as without it.
// Gossip is not stored: who has heard of the stranger, from whom and when, is a pure function of the events, the kin and
// the friendships (Population ties) and a seeded delay, so a reload hears the same.
//
// Tier C throughout: the rules are this module's reading of duty, rank and custom (DECISIONS D-315); the words of the
// memory rows are the model's brief (out of world, English), never shown in the world.
import { Rng } from '../core/rng';
import { segAt, type Population, type Seg, type Where } from './population';
import type { ActivityId } from './activities';
import type { P2 } from './navgrid';
import { MONTHS, dateOf } from './calendar';
import type { Deed, Intent } from './converse/intent';
import { hearAsPerson } from './converse/hear';
import { approxTokens } from './converse/tokens';
/** the longest memory row, in tokens (the brief: <= ~60 each) */
export const ROW_TOKENS = 58;

export type { Deed, Intent };
/** a player-caused change of the world (the save keeps them in order) */
export interface TalkEvent {
  /** index in the save's list */ i: number;
  kind: Deed | 'come' | 'hold';
  pid: number; t: number; day: number;
  /** the deed's words (the place, the person, the thing) */
  arg?: string;
  ok: boolean; reason: string;
  /** the plan window laid over the day [h0, h1] (hours of `day`) and its steps */
  h0: number; h1: number; segs?: Seg[];
  /** fetch: whom; come: fetched by whom */
  other?: number;
  /** give / trade: the thing given the stranger, and (trade) what the stranger gave for it */
  item?: string; paid?: string;
  /** a pause (hold): the person stopped and turned to the stranger until t1 (sim hours); setOff: it ended with a deed */
  t1?: number; setOff?: boolean;
  /** follow: the way walked behind the stranger (grid metres, every ~2 m), filled when the following ends */
  path?: P2[];
  /** D-341: the day the people start telling of it (living/world.ts sets it when it first sees the event) */
  newsFrom?: number;
}
/** one conversation as the person remembers it (≤ ~60 tokens when written out) */
export interface MemRow { pid: number; t: number; conv: number; asked: string[]; said: string; deed?: { kind: Deed; arg?: string; ok: boolean; reason: string; item?: string }; turns: number; folded?: number; firstT?: number }
/** what a person has to tell others of one conversation with the stranger (the gossip's source) */
export interface Told { t: number; conv: number; asked: string; deed?: MemRow['deed']; /** D-379: overheard (said to someone else in their hearing) */ over?: boolean }
/** D-379 (UD-25): words of the stranger to someone else, overheard clearly (by: the one spoken to; -1: nobody in particular) */
export interface OverRow { pid: number; t: number; conv: number; said: string; by: number }
export const OVER_KEEP = 2;
export const TOLD_KEEP = 8;
export interface Decision { ok: boolean; reason: string; kind: Deed; arg?: string; segs?: Seg[]; h0: number; h1: number; other?: number; otherSegs?: Seg[]; otherH?: [number, number]; item?: string; paid?: string; noop?: boolean }

export const WORK_FREE = new Set<ActivityId>(['rest', 'eat', 'talk', 'play', 'gamble', 'walk', 'tend_body', 'queue', 'sleep', 'shelter', 'exchange']);
/** work done under someone's count or order: leaving it is not the person's to decide (C) */
export const SUPERVISED = new Set(['guard', 'builder', 'porter', 'camp', 'scribe', 'treasury', 'official', 'messenger', 'storekeeper', 'miller', 'weaver', 'brewer', 'groom', 'caretaker', 'priest', 'servant', 'shepherd']);
const DUTY_WORDS: Record<string, string> = {
  guard: 'on watch: a spearman does not leave his post until he is relieved', builder: 'the foreman counts the gang at the work; he cannot leave it',
  porter: 'the loads are counted by the scribe; he cannot leave them', camp: 'the camp grinds and bakes for the gangs; she cannot leave the work',
  scribe: 'at the tablets for the king’s house; he cannot leave them', treasury: 'at the work of the Treasury, under the storekeeper’s eye',
  official: 'at the king’s business; an official does not walk strangers about', messenger: 'on the road station’s business',
  storekeeper: 'the stores are in his charge; he cannot leave them', miller: 'at the mill for the ration group; she cannot leave it',
  weaver: 'at the looms of the work group; the overseer counts the work', brewer: 'the brew cannot be left', groom: 'the king’s horses are in his care',
  caretaker: 'the halls are in his care', priest: 'the fire and the offerings are in his care; he cannot leave them', servant: 'at the master’s work; it is not his to leave',
  shepherd: 'the king’s flocks are in his care',
};
const TEMPER_REFUSE = [0.6, 0.12, 0.05, 0.1, 0.3, 0.06, 0.15, 0.45, 0.03]; // by life.ts TEMPER (wary, dry, warm, proud, anxious, cheerful, pious, blunt, curious)
const TEMPER_WORDS = ['wary of strangers: does not go about with one', 'has no mind to', '', 'has the work to see to', 'anxious: the household is waiting', '', 'it is not fitting', 'no time for this', ''];
/** the longest walk one way the person will make for a stranger (h), and how long they follow one (h) */
export const TALK_LIMITS = { walkOneWay: 0.4, followAdult: 0.4, followChild: 0.6, stopWork: 0.25, wait: 0.25, home: 0.5, holdTail: 0.01, catchUp: 2 };
/** the places a stranger may be led to, by the words for them (C: the town's and the plain's common places) */
const PLACE_WORDS: [RegExp, (q: string, hh: number) => string][] = [
  [/\b(well|water|spring|drink)\b/, q => `well:${q}`], [/\b(canal|ditch)\b/, q => `canal:${q}`], [/\briver|pulvar\b/, () => 'river'],
  [/\bmill\b/, () => 'mill'], [/\bbrew(ery|house)?\b|\bbeer\b/, () => 'brewery'], [/\b(store|storehouse|granary|stores)\b/, () => 'store_town'],
  [/\b(stable|stables|station|road station|horses)\b/, () => 'station'], [/\boil press|press\b/, () => 'oil_press'], [/\btanner/, () => 'tannery'],
  [/\bbrick/, () => 'brickyard'], [/\bstockyard|pens\b/, () => 'stockyard'], [/\b(altar|fire|offering|precinct|magi|magus|sacrifice)\b/, () => 'offering_place:altar'],
  [/\b(burial|grave|graves|dead)\b/, () => 'outside'], [/\b(official|officials|governor|office)\b/, () => 'official_bldg'],
  [/\b(stair|stairs|terrace|palace|gate|hall|king'?s house)\b/, () => 'terrace_edge'], [/\b(your house|your home|home|house)\b/, (_q, hh) => `h:${hh}`],
  [/\b(lane|street|doorstep)\b/, q => `lane:${q}`],
];
const INNER_TERRACE = /\b(treasury|apadana|palace of|harem|king'?s rooms|throne|inside the|up the terrace|on the terrace)\b/;
const RELS = ['wife', 'husband', 'mother', 'father', 'son', 'daughter', 'brother', 'sister', 'child', 'children', 'boy', 'girl', 'man', 'woman'];

export class TalkWorld {
  readonly events: TalkEvent[] = [];
  /** own memory rows by person (older rows folded) */
  readonly rows = new Map<number, MemRow[]>();
  /** the player's way (grid metres, sim hours): followers walk it; not saved (a follower re-found after a reload) */
  private trail: { p: P2; t: number }[] = [];
  private touched = new Map<string, TalkEvent[]>(); // `${pid}:${day}` → the deeds laid over that day, in order
  private overlaid = new Map<string, { base: Seg[]; segs: Seg[] }>();
  /** the plan steps changed: popview and the agents' plan caches read these (version, pid) */
  version = 0; readonly changed: { v: number; pid: number }[] = [];
  /** the detailed agents' plan cache and task to drop when a person's plan changes (sim.ts sets it) */
  onChange: ((pid: number) => void) | null = null;
  constructor(readonly pop: Population, readonly seed: number, private terracePlace: (id: string) => boolean = () => false) {}

  // ---------------------------------------------------------------- the plan steps
  /** Population.plan asks: are there steps of the stranger's over this person's day? */
  touches(pid: number, day: number) { return (this.touched.size > 0 && this.touched.has(`${pid}:${day}`)) || !!this.living?.touches(pid, day); }
  /** D-339: the people’s own talk laid over their plans (people/living/world.ts; the sim sets it), under the stranger’s deeds */
  living: { touches(pid: number, day: number): boolean; overlay(pid: number, day: number, base: Seg[]): Seg[] } | null = null;
  /** the day plan with the stranger's steps laid over it (cached until the next event) */
  overlay(pid: number, day: number, base: Seg[]): Seg[] {
    if (this.living?.touches(pid, day)) base = this.living.overlay(pid, day, base);
    const k = `${pid}:${day}`; const c = this.overlaid.get(k); if (c && c.base === base) return c.segs;
    let segs = base; for (const e of this.touched.get(k) ?? []) if (e.segs?.length) segs = splice(segs, e.h0, e.h1, e.segs);
    this.overlaid.set(k, { base, segs }); return segs;
  }
  private lay(e: TalkEvent) { if (!e.segs?.length) return; const k = `${e.pid}:${e.day}`; (this.touched.get(k) ?? this.touched.set(k, []).get(k)!).push(e); this.overlaid.delete(k); this.bump(e.pid); }
  private bump(pid: number) { this.version++; this.changed.push({ v: this.version, pid }); if (this.changed.length > 2000) this.changed.splice(0, 1000); this.onChange?.(pid); }
  /** the people whose plans changed after version v (all of them when the record was cut) */
  changedSince(v: number): number[] | null { if (v >= this.version) return []; if (this.changed.length && this.changed[0].v > v + 1) return null; return [...new Set(this.changed.filter(c => c.v > v).map(c => c.pid))]; }

  // ---------------------------------------------------------------- the decision
  /** where the person is now in their plan (the place of the block; a walk: the place it leads to) */
  private now(pid: number, t: number) {
    const day = Math.floor(t / 24), h = t - day * 24; const plan = this.pop.plan(pid, day); const cur = segAt(plan, h);
    let here = cur; if (cur.where === 'road' || cur.place.startsWith('@')) { const i = plan.indexOf(cur); here = plan.slice(i + 1).find(s => s.where !== 'road' && !s.place.startsWith('@')) ?? plan.slice(0, i).reverse().find(s => s.where !== 'road') ?? cur; }
    const place = here.place.startsWith('@back:') ? here.place.slice(6) : here.place;
    return { day, h, plan, cur, place, where: here.where };
  }
  private whereOf(place: string): Where {
    if (this.terracePlace(place)) return 'terrace';
    if (place.startsWith('h:')) { const H = this.pop.households[+place.slice(2)]; return H?.zone === 'plain' ? 'plain' : 'town'; }
    const q = place.split(':')[1]; if (q && this.pop.quarters[q]) return this.pop.quarters[q].kind === 'village' ? 'plain' : 'town';
    return 'town';
  }
  private walk(a: string, b: string, day: number): number { if (a === b) return 0;
    const wa = this.whereOf(a), wb = this.whereOf(b); return this.pop.walkH(a, b, day, wa, wb); }
  private road(a: string, b: string): string { const w = this.whereOf(b) === 'terrace' || this.whereOf(a) === 'terrace' ? 'terrace' : this.whereOf(b); return `road:${w}`; }
  /** the name of a person as spoken (the reconstruction mark out) */
  name(pid: number) { return (this.pop.nameOf(pid) ?? '').replace(/^\*/, '') || 'someone of the house'; }
  /** the place the words name, for this person (null: they do not know it) */
  resolvePlace(pid: number, day: number, words: string): string | null {
    const w = ` ${words.toLowerCase()} `; const hh = this.pop.home(pid, day); const q = this.pop.households[hh].q;
    // a named person's house ("Bakezza's house")
    const nm = /([\p{L}’'-]{3,})['’]s (house|home)/u.exec(words); if (nm) { const o = this.findPerson(pid, day, nm[1]); if (o !== null) return `h:${this.pop.home(o, day)}`; }
    for (const [re, f] of PLACE_WORDS) if (re.test(w)) return f(q, hh);
    return null;
  }
  /** the person the words name, among those this person knows (their house, their kin's houses, their friends) */
  findPerson(pid: number, day: number, words: string): number | null {
    const P = this.pop, me = P.persons[pid], w = words.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hh = P.home(pid, day), mem = P.membersOn(hh, day).filter(x => x !== pid && P.present(x, day));
    const known = [...new Set([...mem, ...me.ties.filter(x => P.present(x, day)), ...P.households[hh].kin.flatMap(k => P.membersOn(k, day).filter(x => P.present(x, day)))])];
    const plain = (x: number) => (P.nameOf(x) ?? '').replace(/^\*/, '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const x of known) { const n = plain(x); if (n.length >= 3 && new RegExp(`(^|[^a-z])${n.replace(/[^a-z]/g, '.')}($|[^a-z])`).test(w)) return x; }
    const rel = RELS.find(r => new RegExp(`\\b${r}\\b`).test(w)); if (!rel) return null;
    const age = (x: number) => P.ageOn(x, day), sex = (x: number) => P.persons[x].sex;
    const pick = (xs: number[]) => xs.length ? xs.sort((a, b) => a - b)[0] : null;
    switch (rel) {
      case 'wife': case 'husband': { if (me.spouse !== undefined && mem.includes(me.spouse)) return me.spouse; return pick(mem.filter(x => sex(x) !== me.sex && age(x) >= 16 && Math.abs(age(x) - age(pid)) < 22)); }
      case 'mother': return me.mother >= 0 && mem.includes(me.mother) ? me.mother : pick(mem.filter(x => sex(x) === 'f' && age(x) > age(pid) + 14));
      case 'father': return pick(mem.filter(x => sex(x) === 'm' && age(x) > age(pid) + 14 && age(x) < age(pid) + 50));
      case 'son': case 'boy': return pick(mem.filter(x => sex(x) === 'm' && age(x) < age(pid) - 12 && age(x) >= 5));
      case 'daughter': case 'girl': return pick(mem.filter(x => sex(x) === 'f' && age(x) < age(pid) - 12 && age(x) >= 5));
      case 'child': case 'children': return pick(mem.filter(x => age(x) < 14 && age(x) >= 5));
      case 'brother': return pick(mem.filter(x => sex(x) === 'm' && P.persons[x].mother >= 0 && P.persons[x].mother === me.mother));
      case 'sister': return pick(mem.filter(x => sex(x) === 'f' && P.persons[x].mother >= 0 && P.persons[x].mother === me.mother));
      default: return pick(mem.filter(x => age(x) >= 16 && sex(x) === (rel === 'man' ? 'm' : 'f')));
    }
  }
  /** what the person has at hand to give (C: the house's bread and water; the work's own goods) */
  private goods(pid: number, place: string, act: ActivityId, day: number): Set<string> {
    const p = this.pop.persons[pid], atHome = place === `h:${this.pop.home(pid, day)}`; const g = new Set<string>();
    if (atHome || place.startsWith('well:') || act === 'draw_water' || place === 'water' || place === 'river' || place.startsWith('canal:')) g.add('water');
    if (atHome || act === 'bake' || act === 'knead' || place === 'oven' || (p.job === 'camp' && p.sub === 'baker')) g.add('bread');
    if (p.job === 'brewer' || place === 'brewery') g.add('beer');
    if (act === 'pick_fruit' && place.startsWith('vineyard')) g.add('grapes'); if (act === 'pick_fruit' && !place.startsWith('vineyard')) g.add('fruit');
    if ((p.job === 'gardener' || place.startsWith('garden') || place.startsWith('orchard')) && (act === 'garden_work' || act === 'pick_fruit')) g.add('fruit');
    if (act === 'milk' || p.job === 'herder' || (p.job === 'shepherd' && place.startsWith('pasture'))) g.add('milk');
    if (p.sub === 'oil' || place === 'oil_press') g.add('oil');
    if (atHome && (p.job === 'farmer' || p.job === 'homemaker')) g.add('barley');
    if (p.job === 'miller' || place === 'mill') g.add('flour');
    return g;
  }
  private item(words: string | undefined): string | null {
    const w = (words ?? '').toLowerCase(); if (!w) return null;
    if (/silver|gold|money|coin|shekel|jewel|ring/.test(w)) return 'silver'; if (/spear|sword|bow|knife|dagger|weapon|shield/.test(w)) return 'weapon';
    if (/tablet|seal|letter/.test(w)) return 'tablet';
    for (const [re, it] of [[/water|drink/, 'water'], [/bread|food|eat|loaf|something to eat/, 'bread'], [/beer/, 'beer'], [/wine/, 'wine'], [/grape/, 'grapes'], [/fig|date|fruit|apple|pomegranate/, 'fruit'], [/milk|cheese/, 'milk'], [/oil/, 'oil'], [/barley|grain|wheat/, 'barley'], [/flour/, 'flour']] as [RegExp, string][]) if (re.test(w)) return it;
    return w.split(/\s+/).slice(-1)[0] || null;
  }
  /** the things the stranger holds (given or traded to them, in the save) */
  possessions(t = Infinity): string[] { const out: string[] = []; for (const e of this.events) { if (!e.ok || e.t > t) continue;
    if (e.kind === 'give' && e.item) out.push(e.item); if (e.kind === 'trade' && e.item) { const i = out.indexOf(e.paid ?? ''); if (i >= 0) out.splice(i, 1); out.push(e.item); } } return out; }

  /** whether and how the person does what the stranger asks at sim time t (pure: nothing is changed; act() commits it) */
  consider(pid: number, t: number, intent: Intent): Decision {
    const kind = intent.kind as Deed; const P = this.pop, p = P.persons[pid]; const N = this.now(pid, t); const { day, h, cur } = N;
    const d0 = { kind, arg: intent.arg, h0: h, h1: h };
    const no = (reason: string): Decision => ({ ...d0, ok: false, reason });
    const age = P.ageOn(pid, day); const C = P.cal?.ctx(day); const sun = C?.sun ?? { rise: 5.5, set: 18.5 };
    const dark = h < sun.rise - 0.25 || h > sun.set + 0.5; const atHome = N.place === `h:${P.home(pid, day)}`;
    const working = !WORK_FREE.has(cur.act) && cur.where !== 'road' && !atHome; const supervised = SUPERVISED.has(p.job) && (working || /watch|within call of the posts|on duty/.test(cur.why));
    const onWatch = p.job === 'guard' && (cur.act === 'stand_guard' || cur.act === 'patrol' || /watch|within call of the posts|relieved/.test(cur.why));
    const leaves = kind === 'follow' || kind === 'lead_to' || kind === 'fetch' || kind === 'go_home';
    if (!P.present(pid, day) || cur.where === 'away') return no('is not here');
    if (cur.act === 'sleep') return no('is asleep');
    if (age < 5) return no('too small: runs back to the mother');
    if (cur.act === 'lie_ill' || P.sick(pid, day)) { if (kind !== 'give' && kind !== 'wait_here') return no('is sick and lying down'); }
    if (P.mourning(pid, day) && leaves) return no('the house is in mourning');
    if (dark && leaves && kind !== 'go_home') return no('it is dark: nobody walks about with a stranger at night');
    if (onWatch && kind !== 'give' && kind !== 'wait_here') return no(DUTY_WORDS.guard);
    const rng = new Rng(this.seed, `talk:${pid}:${Math.round(t * 3600)}:${kind}`);
    const temper = Math.min(TEMPER_REFUSE.length - 1, Math.floor(p.trait * TEMPER_REFUSE.length));
    const child = age < 13, woman = !child && p.sex === 'f';
    const back = (from: string, at: number): Seg[] => { // the walk back to where the day has them by then
      const nx = this.returnPlace(pid, day, at); const w = this.walk(from, nx, day); return w > 0.01 ? [seg(at, at + w, this.road(from, nx), 'walk', `walking back to ${nx.startsWith('h:') ? 'the house' : 'the day’s work'} after the stranger’s errand`, 'road')] : []; };
    const end = (s0: Seg[], h0: number) => { const s = s0.filter(x => x.t1 - x.t0 > 1e-6); return { segs: s, h0, h1: s.length ? Math.min(24, s[s.length - 1].t1) : h0 }; }; // (a walk of no length, to someone in the same house, is no step)
    switch (kind) {
      case 'stop_work': {
        if (!working) return { ...d0, ok: true, reason: 'was not at work', noop: true };
        if (supervised) return no(DUTY_WORDS[p.job] ?? 'the work is not his to leave');
        if (rng.chance(TEMPER_REFUSE[temper] * 0.6)) return no(TEMPER_WORDS[temper] || 'the work will not wait');
        const s = [seg(h, h + TALK_LIMITS.stopWork, cur.place, 'rest', 'stopped work a while to talk with the stranger', cur.where)];
        return { ...d0, ok: true, reason: 'stopped work a while', ...end(s, h) };
      }
      case 'wait_here': {
        const stays = N.plan.filter(s => s.t1 > h && s.t0 < h + TALK_LIMITS.wait).every(s => s.place === cur.place && s.where !== 'road');
        if (stays) return { ...d0, ok: true, reason: 'was staying here anyway', noop: true };
        if (supervised || onWatch) return no(DUTY_WORDS[p.job] ?? 'must go on with the work');
        if (child && rng.chance(0.3)) return no('must go home: the mother is waiting');
        // (a pause: the person stands where they are, facing the stranger, and catches up with the day after it)
        return { ...d0, ok: true, reason: 'waited for the stranger', h0: h, h1: h + TALK_LIMITS.wait };
      }
      case 'go_home': {
        if (atHome) return { ...d0, ok: true, reason: 'was at home already', noop: true };
        if (supervised) return no(DUTY_WORDS[p.job] ?? 'the work is not done');
        const home = `h:${P.home(pid, day)}`, w = this.walk(N.place, home, day); if (w > TALK_LIMITS.walkOneWay * 1.5) return no('the house is far from here; the day’s work is here');
        if (rng.chance(TEMPER_REFUSE[temper] * 0.5)) return no(TEMPER_WORDS[temper] || 'not yet: there is more to do');
        const s = [seg(h, h + w, this.road(N.place, home), 'walk', 'going home, as the stranger urged', 'road'), seg(h + w, h + w + TALK_LIMITS.home, home, 'rest', 'at home, gone back early as the stranger urged', this.whereOf(home))];
        return { ...d0, ok: true, reason: 'went home', ...end([...s, ...back(home, h + w + TALK_LIMITS.home)], h) };
      }
      case 'follow': {
        if (supervised) return no(DUTY_WORDS[p.job] ?? 'cannot leave the work');
        if (p.rank > 1 || (p.job === 'guard' && p.rank === 1)) return no('a leader of the group does not go off with a stranger');
        if (woman) return no('a woman of the house does not go off with a strange man');
        if (age > 62) return no('too old to walk about after a stranger');
        if (!child && rng.chance(TEMPER_REFUSE[temper])) return no(TEMPER_WORDS[temper] || 'has other things to do');
        // a child follows until called home: until the house's next meal or bedtime, at most TALK_LIMITS.followChild
        const nextMeal = N.plan.find(s => s.t0 > h && (s.act === 'eat' || s.act === 'sleep'))?.t0 ?? 24;
        const dur = child ? Math.max(0.1, Math.min(TALK_LIMITS.followChild, nextMeal - h)) : TALK_LIMITS.followAdult;
        const f1 = Math.min(24, h + dur), b1 = Math.min(24, f1 + dur);
        const s: Seg[] = [seg(h, f1, '@stranger', 'walk', child ? 'tagging along after the stranger' : 'walking with the stranger, who asked him to come along', N.where === 'road' ? 'town' : N.where),
          seg(f1, b1, `@back:${N.place}`, 'walk', child ? 'called home: running back' : 'going back the way he came with the stranger', N.where === 'road' ? 'town' : N.where)];
        if (child) { const home = `h:${P.home(pid, day)}`, w = this.walk(N.place, home, day); if (b1 < 24) s.push(seg(b1, b1 + w, this.road(N.place, home), 'walk', 'called home by the mother', 'road'), seg(b1 + w, Math.min(24, b1 + w + 0.2), home, 'rest', 'called home after running about after the stranger', this.whereOf(home))); }
        const last = s[s.length - 1]; return { ...d0, ok: true, reason: child ? 'follows until called home' : 'walks with the stranger a while', ...end(last.t1 < 24 ? [...s, ...back(last.place.replace(/^@back:/, ''), last.t1)] : s, h) };
      }
      case 'lead_to': {
        const dest = this.resolvePlace(pid, day, intent.arg ?? ''); if (!dest) return no('does not know the place the stranger means');
        if (INNER_TERRACE.test((intent.arg ?? '').toLowerCase()) || (this.terracePlace(dest) && !['stair_foot', 'water'].includes(dest))) return no('strangers do not go up to the king’s Terrace without a sealed order');
        if (dest === N.place) return { ...d0, ok: true, reason: 'the stranger is there already', noop: true };
        if (supervised) return no(DUTY_WORDS[p.job] ?? 'cannot leave the work');
        const w = this.walk(N.place, dest, day); if (!(w <= TALK_LIMITS.walkOneWay)) return no(`it is too far from here (${walkWords(w)}); the day’s work is here`);
        if (child && w > 0.15) return no('not allowed to go so far from the house');
        if (woman && !/^(well|lane|canal):|^h:/.test(dest)) return no('a woman of the house does not walk a strange man about; she points the way');
        if (rng.chance(TEMPER_REFUSE[temper] * 0.7)) return no(TEMPER_WORDS[temper] || 'points the way instead');
        const at = h + w, s = [seg(h, at, this.road(N.place, dest), 'walk', `showing the stranger the way to ${placeWords(dest)}`, 'road'), seg(at, at + 0.05, dest, 'talk', `pointing out ${placeWords(dest)} to the stranger`, this.whereOf(dest))];
        return { ...d0, ok: true, reason: `showed the way to ${placeWords(dest)}`, arg: dest, ...end([...s, ...back(dest, at + 0.05)], h) };
      }
      case 'fetch': {
        const o = this.findPerson(pid, day, intent.arg ?? ''); if (o === null) return no('does not know whom the stranger means');
        if (supervised) return no(DUTY_WORDS[p.job] ?? 'cannot leave the work');
        const O = this.now(o, t); const oAge = P.ageOn(o, day);
        if (O.cur.act === 'sleep') return no(`${this.name(o)} is asleep`);
        if (O.cur.where === 'away' || !P.present(o, day)) return no(`${this.name(o)} is away from Parsa`);
        const oJob = P.persons[o].job, oWorking = !WORK_FREE.has(O.cur.act) && O.cur.where !== 'road' && O.place !== `h:${P.home(o, day)}`;
        if (SUPERVISED.has(oJob) && (oWorking || /watch|within call of the posts/.test(O.cur.why))) return no(`${this.name(o)} is at work and cannot leave it: ${(DUTY_WORDS[oJob] ?? 'the work').split(':')[0]}`);
        if (O.cur.act === 'lie_ill' || P.sick(o, day)) return no(`${this.name(o)} is sick`);
        const w = this.walk(N.place, O.place, day); if (!(w <= TALK_LIMITS.walkOneWay)) return no(`${this.name(o)} is ${walkWords(w)} away`);
        if (child && w > 0.15) return no('not allowed to go so far from the house');
        if (rng.chance(TEMPER_REFUSE[temper] * 0.5)) return no(TEMPER_WORDS[temper] || 'will not go running errands for a stranger');
        const a1 = h + w, s = [seg(h, a1, this.road(N.place, O.place), 'walk', `going to fetch ${this.name(o)} for the stranger`, 'road'), seg(a1, a1 + 0.03, O.place, 'talk', `calling ${this.name(o)} to come and meet the stranger`, this.whereOf(O.place)),
          seg(a1 + 0.03, a1 + 0.03 + w, this.road(O.place, N.place), 'walk', `bringing ${this.name(o)} back to the stranger`, 'road'), seg(a1 + 0.03 + w, a1 + 0.28 + w, N.place, 'talk', `with ${this.name(o)} and the stranger`, this.whereOf(N.place))];
        const os = [seg(a1 + 0.03, a1 + 0.03 + w, this.road(O.place, N.place), 'walk', `going with ${this.name(pid)} to meet a stranger`, 'road'), seg(a1 + 0.03 + w, a1 + 0.28 + w, N.place, 'talk', `meeting the stranger ${this.name(pid)} fetched ${oAge < 14 ? 'it' : 'her'} for`.replace(/ it for$/, ' them for'), this.whereOf(N.place))];
        const oEnd = a1 + 0.28 + w; const ob = this.returnPlace(o, day, oEnd), ow = this.walk(N.place, ob, day); if (ow > 0.01) os.push(seg(oEnd, oEnd + ow, this.road(N.place, ob), 'walk', 'going back to the day after meeting the stranger', 'road'));
        return { ...d0, ok: true, reason: `fetched ${this.name(o)}`, other: o, ...end([...s, ...back(N.place, a1 + 0.28 + w)], h), otherSegs: os.filter(x => x.t0 < 24 && x.t1 - x.t0 > 1e-6).map(x => ({ ...x, t1: Math.min(24, x.t1) })), otherH: [a1 + 0.03, Math.min(24, os[os.length - 1].t1)] };
      }
      case 'give': case 'trade': {
        const want = this.item(kind === 'trade' ? (intent.arg ?? '').split(/\bfor\b/i).slice(-1)[0] : intent.arg) ?? (kind === 'give' ? 'water' : null);
        const offer = kind === 'trade' ? this.item(/\bfor\b/i.test(intent.arg ?? '') ? (intent.arg ?? '').split(/\bfor\b/i)[0] : '') : null;
        if (!want) return no('does not understand what the stranger wants');
        if (want === 'silver') return no('silver is weighed for rations and dues; it is not given to strangers');
        if (want === 'weapon') return no('the weapon is the king’s, not his to give');
        if (want === 'tablet') return no('the tablets and seals are the king’s house’s');
        if (kind === 'trade') { const has = this.possessions(t); if (!has.length) return no('the stranger has nothing to give in exchange');
          if (offer && !has.includes(offer)) return no(`the stranger has no ${offer} to give`); }
        const paid = kind === 'trade' ? (offer ?? this.possessions(t)[0]) : undefined;
        const here = this.goods(pid, N.place, cur.act, day);
        if (child && want !== 'water') return no('must ask the mother first');
        if (here.has(want)) { const s = [seg(h, h + 0.04, cur.where === 'road' ? N.place : cur.place, 'talk', kind === 'trade' ? `trading ${want} with the stranger for ${paid}` : `giving the stranger ${want}`, cur.where === 'road' ? N.where : cur.where)];
          return { ...d0, ok: true, reason: kind === 'trade' ? `traded ${want} for ${paid}` : `gave ${want}`, item: want, paid, ...end([...s, ...back(s[0].place, h + 0.04)], h) }; }
        const home = `h:${P.home(pid, day)}`, homeGoods = this.goods(pid, home, 'rest', day); const w = this.walk(N.place, home, day);
        if (!homeGoods.has(want)) return no(`has no ${want} to give`);
        if (supervised) return no(DUTY_WORDS[p.job] ?? 'cannot leave the work to fetch it');
        if (w > 0.15) return no(`has no ${want} here, and the house is ${walkWords(w)} away`);
        if (rng.chance(TEMPER_REFUSE[temper] * 0.4)) return no(TEMPER_WORDS[temper] || 'has none to spare');
        const s = [seg(h, h + w, this.road(N.place, home), 'walk', `going to the house for ${want} for the stranger`, 'road'), seg(h + w, h + w + 0.03, home, 'carry_jar', `fetching ${want} from the house for the stranger`, this.whereOf(home)),
          seg(h + w + 0.03, h + 2 * w + 0.03, this.road(home, N.place), 'walk', `bringing the stranger ${want}`, 'road'), seg(h + 2 * w + 0.03, h + 2 * w + 0.06, N.place, 'talk', kind === 'trade' ? `trading ${want} with the stranger for ${paid}` : `giving the stranger ${want}`, this.whereOf(N.place))];
        return { ...d0, ok: true, reason: kind === 'trade' ? `traded ${want} for ${paid}` : `fetched ${want} from the house and gave it`, item: want, paid, ...end([...s, ...back(N.place, h + 2 * w + 0.06)], h) };
      }
    }
    return no('does not understand');
  }
  /** where the day has the person at hour `at` (the place of the block then; a walk: the place it leads to) */
  private returnPlace(pid: number, day: number, at: number): string {
    const plan = this.pop.plan(pid, day); const s = segAt(plan, Math.min(23.999, at)); if (s.where !== 'road' && !s.place.startsWith('@')) return s.place;
    const i = plan.indexOf(s); return (plan.slice(i + 1).find(x => x.where !== 'road' && !x.place.startsWith('@')) ?? plan.slice(0, i).reverse().find(x => x.where !== 'road' && !x.place.startsWith('@')) ?? s).place;
  }
  /** the stranger asks: the simulation decides and, when the person does it, lays the steps over the day (an event) */
  act(pid: number, t: number, intent: Intent): Decision & { event: TalkEvent } {
    const d = this.consider(pid, t, intent); const day = Math.floor(t / 24);
    const e: TalkEvent = { i: this.events.length, kind: d.kind, pid, t, day, arg: d.arg ?? intent.arg, ok: d.ok, reason: d.reason, h0: d.h0, h1: d.h1, segs: d.ok && !d.noop ? d.segs : undefined, other: d.other, item: d.item, paid: d.paid };
    this.events.push(e); if (e.segs) this.lay(e);
    if (d.ok && d.other !== undefined && d.otherSegs?.length) { const c: TalkEvent = { i: this.events.length, kind: 'come', pid: d.other, t, day, ok: true, reason: `fetched by ${this.name(pid)}`, h0: d.otherH![0], h1: d.otherH![1], segs: d.otherSegs, other: pid }; this.events.push(c); this.lay(c); }
    // the conversation's pause ends: with a deed the person sets off at once (no catching up with a day they have left)
    if (d.ok && !d.noop) { if (d.kind === 'wait_here') this.pauseFor(pid, t, t + TALK_LIMITS.wait); else this.release(pid, t, true); }
    return { ...d, event: e };
  }

  /** the person said no in their own words (the model's refusal where the simulation allowed it): an event, nothing laid */
  decline(pid: number, t: number, intent: Intent, why: string): Decision & { event: TalkEvent } {
    const day = Math.floor(t / 24), h = t - day * 24; const reason = (why || 'would not').replace(/^(no|refuse)$/i, 'would not');
    const e: TalkEvent = { i: this.events.length, kind: intent.kind as Deed, pid, t, day, arg: intent.arg, ok: false, reason, h0: h, h1: h }; this.events.push(e);
    return { ok: false, reason, kind: intent.kind as Deed, arg: intent.arg, h0: h, h1: h, event: e };
  }
  // ---------------------------------------------------------------- the pause of a conversation
  private lastHold = new Map<number, TalkEvent>(); private lastT = 0;
  /** the stranger speaks to the person: they stop and turn (a pause from now to now + holdTail, extended by each turn) */
  addressed(pid: number, t: number): TalkEvent {
    const h = this.lastHold.get(pid); if (h && !h.setOff && h.t1! >= t - 1e-9) { h.t1 = Math.max(h.t1!, t + TALK_LIMITS.holdTail); return h; }
    const day = Math.floor(t / 24); const e: TalkEvent = { i: this.events.length, kind: 'hold', pid, t, day, ok: true, reason: 'stopped to talk with the stranger', h0: t - day * 24, h1: t - day * 24, t1: t + TALK_LIMITS.holdTail };
    this.events.push(e); this.lastHold.set(pid, e); this.bump(pid); return e;
  }
  private pauseFor(pid: number, t: number, t1: number) { const h = this.addressed(pid, t); h.t1 = Math.max(h.t1!, t1); }
  /** the conversation ends (the stranger walks off, or the person sets off on the deed: no catching up then) */
  release(pid: number, t: number, setOff = false) { const h = this.lastHold.get(pid); if (h && h.t1! > t) { h.t1 = Math.max(h.t, t); } if (h && setOff) h.setOff = true; if (h) this.bump(pid); }
  /** the pause in force for the person at sim time t (null: none) */
  holdAt(pid: number, t: number): TalkEvent | null { const h = this.lastHold.get(pid); return h && t >= h.t && t < h.t1! ? h : null; }
  /** the time the population view shows the person at: frozen during a pause, then catching up at 1.5× (the day's walk
   *  resumed where it stopped, not jumped); t itself when there is no pause (the fast path: no map lookup when none) */
  viewT(pid: number, t: number): number {
    if (!this.lastHold.size) return t; const h = this.lastHold.get(pid); if (!h || t < h.t) return t;
    if (t < h.t1!) return h.t; if (h.setOff) return t; const L = h.t1! - h.t, C = L * TALK_LIMITS.catchUp; return t >= h.t1! + C ? t : t - L * (1 - (t - h.t1!) / C);
  }
  /** the person's last pause (null: never stopped for the stranger) */
  lastHoldOf(pid: number): TalkEvent | null { return this.lastHold.get(pid) ?? null; }
  /** people paused now (for facing the stranger) */
  heldNow(t: number): number[] { const out: number[] = []; for (const [pid, h] of this.lastHold) if (t >= h.t && t < h.t1!) out.push(pid); return out; }

  // ---------------------------------------------------------------- following the stranger
  /** the stranger's way (the sim sets the player's position every step) */
  step(t: number, player: P2 | null) {
    this.lastT = t; if (!player) return; const L = this.trail[this.trail.length - 1];
    if (!L || Math.hypot(player[0] - L.p[0], player[1] - L.p[1]) >= 0.5) { this.trail.push({ p: [player[0], player[1]], t }); if (this.trail.length > 800) this.trail.splice(0, 200); }
    else L.t = t;
    // a following that has ended keeps the way walked (for the walk back, and the save)
    for (const e of this.events) if (e.kind === 'follow' && e.ok && e.segs && !e.path) { const f1 = e.day * 24 + e.segs[0].t1; if (t >= f1) e.path = this.trailSince(e.t, 2); }
  }
  private trailSince(t0: number, every: number): P2[] { const out: P2[] = []; for (const x of this.trail) if (x.t >= t0 - 1e-6 && (!out.length || Math.hypot(x.p[0] - out[out.length - 1][0], x.p[1] - out[out.length - 1][1]) >= every)) out.push([x.p[0], x.p[1]]); return out.slice(-150); }
  /** the followers now, in a fixed order (their place in the file behind the stranger) */
  private followers(t: number): number[] { const out: number[] = []; for (const [k, list] of this.touched) { const [pid, day] = k.split(':').map(Number); if (day !== Math.floor(t / 24)) continue;
    const h = t - day * 24; if (list.some(e => e.segs?.some(s => s.place === '@stranger' && h >= s.t0 && h < s.t1))) out.push(pid); } return out.sort((a, b) => a - b); }
  /** where a person following the stranger walks now: on the stranger's own way, 1.5 m behind (and 1.1 m more for each one
   *  before them in the file); walking back: the way retraced. null: the way is not known (after a reload: the view shows
   *  them at the place they left) */
  followPos(pid: number, t: number, s0: number, s1: number, back: boolean, out: { e: number; n: number; heading: number; moving: boolean }): boolean {
    if (!back) { if (!this.trail.length) return false; const k = this.followers(t).indexOf(pid); let want = 1.5 + 1.1 * Math.max(0, k);
      const last = this.trail[this.trail.length - 1]; let i = this.trail.length - 1, p = last.p;
      while (i > 0 && want > 0) { const q = this.trail[i - 1].p, d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d >= want) { const f = want / d; p = [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; want = 0; break; } want -= d; p = q; i--; }
      out.e = p[0]; out.n = p[1]; out.heading = Math.atan2(last.p[0] - p[0], last.p[1] - p[1]) * 180 / Math.PI; out.moving = t - last.t < 1 / 3600 && this.trail.length > 1 && Math.hypot(last.p[0] - p[0], last.p[1] - p[1]) > 1; return true; }
    const e = this.events.find(x => x.pid === pid && x.kind === 'follow' && x.ok && x.path?.length && Math.abs(x.day * 24 + (x.segs?.[1]?.t0 ?? -1) - s0) < 2e-3);
    const path = e?.path; if (!path || path.length < 2) return false;
    let len = 0; for (let j = 1; j < path.length; j++) len += Math.hypot(path[j][0] - path[j - 1][0], path[j][1] - path[j - 1][1]);
    let want = Math.max(0, Math.min(1, (t - s0) / Math.max(1e-9, s1 - s0))) * len;
    for (let j = path.length - 1; j > 0; j--) { const a = path[j], b = path[j - 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (want <= d || j === 1) { const f = d > 0 ? Math.min(1, want / d) : 0; out.e = a[0] + (b[0] - a[0]) * f; out.n = a[1] + (b[1] - a[1]) * f; out.heading = Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI; out.moving = true; return true; } want -= d; }
    return false;
  }
  /** the stranger's position now (the head of the way) */
  get player(): P2 | null { const L = this.trail[this.trail.length - 1]; return L ? L.p : null; }

  // ---------------------------------------------------------------- memory
  /** what each person has to tell of the stranger (one item per conversation, never folded; the last TOLD_KEEP): the
   *  source of the gossip, so what kin heard on a day does not change when the teller's own memory folds later */
  readonly told = new Map<number, Told[]>();
  /** after each exchange: the conversation's row for this person (one row per conversation, rewritten as it goes on) */
  remember(pid: number, t: number, conv: number, asked: string, said: string, deed?: MemRow['deed']): MemRow {
    const list = this.rows.get(pid) ?? []; let r = list.find(x => x.conv === conv && !x.folded);
    if (!r) { r = { pid, t, conv, asked: [], said: '', turns: 0 }; list.push(r); }
    r.t = t; r.turns++; const a = asked ? gist(hearAsPerson(asked).text, 9) : ''; if (a && !r.asked.includes(a)) r.asked = [...r.asked, a].slice(-2); if (said) r.said = gist(said, 12); if (deed && (!r.deed || !r.deed.ok || deed.ok)) r.deed = deed;
    const tl = this.told.get(pid) ?? []; let k = tl.find(x => x.conv === conv && !x.over); if (!k) { k = { t, conv, asked: '' }; tl.push(k); if (tl.length > TOLD_KEEP) tl.shift(); this.told.set(pid, tl); }
    k.t = t; if (!k.asked && r.asked[0]) k.asked = r.asked[0]; if (r.deed) k.deed = { ...r.deed };
    // older rows folded: the last three verbatim, the rest one row of counts
    const own = list.filter(x => !x.folded); if (own.length > 3) { const old = own.slice(0, own.length - 3); const f = list.find(x => x.folded) ?? { pid, t: old[0].t, conv: -1, asked: [], said: '', turns: 0, folded: 0, firstT: old[0].t };
      f.folded = (f.folded ?? 0) + old.length; f.firstT = Math.min(f.firstT ?? old[0].t, old[0].t); f.t = old[old.length - 1].t; f.asked = [...new Set([...f.asked, ...old.flatMap(o => o.deed ? [deedWord(o.deed.kind, o.deed.arg)] : [])])].slice(-3);
      const keep = list.filter(x => !old.includes(x) && x !== f); this.rows.set(pid, [f, ...keep]); }
    else this.rows.set(pid, list);
    return r;
  }
  /** D-379 (UD-25): what the person overheard the stranger say to someone else (earshot.ts: clearly, not to them): the last
   *  OVER_KEEP utterances, one per conversation (the latest words), and an item to tell on (gossip), like remember() */
  readonly over = new Map<number, OverRow[]>();
  overheard(pid: number, t: number, conv: number, said: string, by: number): OverRow {
    const a = said ? gist(hearAsPerson(said).text, 9) : ''; const list = this.over.get(pid) ?? [];
    let r = list.find(x => x.conv === conv); if (!r) { r = { pid, t, conv, said: a, by }; list.push(r); if (list.length > OVER_KEEP) list.shift(); }
    r.t = t; r.said = a; r.by = by; this.over.set(pid, list);
    const tl = this.told.get(pid) ?? []; let k = tl.find(x => x.conv === conv && x.over); if (!k) { k = { t, conv, asked: '', over: true }; tl.push(k); if (tl.length > TOLD_KEEP) tl.shift(); this.told.set(pid, tl); }
    k.t = t; k.asked = a; return r;
  }
  /** an overheard row as the person's own memory (out of world, the model's brief) */
  overText(r: OverRow, now: number): string {
    const to = r.by >= 0 ? ` to ${this.name(r.by)}` : '';
    return fit(`${cap(when(r.t, now))} you overheard this same stranger say${to}: “${r.said}”.`, 44);
  }
  /** what the person remembers of the stranger at sim time t, their own meetings and what they have heard: the `max` that
   *  matter most (a deed done or refused before words alone, their own before hearsay, then the latest), in time order.
   *  Each line ≤ ~60 tokens (ROW_TOKENS) */
  recall(pid: number, t: number, max = 2): string[] {
    const own = (this.rows.get(pid) ?? []).filter(r => r.t <= t + 1e-9).map(r => ({ t: r.t, text: this.rowText(r, t), w: r.folded ? 0.5 : (r.deed ? 4 : 3) }));
    const heard = this.heard(pid, t).map(x => ({ t: x.t, text: x.text, w: (x.deed ? 2 : 1) - (x.hand === 2 ? 0.25 : 0) }));
    const over = (this.over.get(pid) ?? []).filter(r => r.t <= t + 1e-9).map(r => ({ t: r.t, text: this.overText(r, t), w: 2.5 }));
    return [...own, ...over, ...heard].sort((a, b) => b.w - a.w || b.t - a.t).slice(0, max).sort((a, b) => a.t - b.t).map(x => x.text);
  }
  /** a row as the person's own memory (their words for it: out of world, the model's brief) */
  rowText(r: MemRow, now: number): string {
    if (r.folded) return cut(`Before that you had met the stranger ${r.folded === 1 ? 'once' : `${r.folded} times`}, since ${when(r.firstT ?? r.t, now)}${r.asked.length ? ` (he asked you: ${r.asked.join('; ')})` : ''}.`, 44);
    // (at most ROW_TOKENS: what the stranger said goes first, then what the person said; what was done never)
    const head = `${cap(when(r.t, now))} this same stranger spoke with you.`, d = r.deed ? deedOutcome(r.deed, 'you') : '';
    const asked = (n: number) => r.asked.length && n ? `He said: “${r.asked.slice(-n).join('” and “')}”.` : ''; const said = r.said ? `You told him: “${r.said}”.` : '';
    for (const x of [[head, asked(2), d, said], [head, asked(1), d, said], [head, asked(1), d], [head, d || asked(1)]]) { const t = x.filter(Boolean).join(' '); if (approxTokens(t) <= ROW_TOKENS) return t; }
    return cut([head, d].filter(Boolean).join(' '), 30);
  }
  /** what the person has heard of the stranger from others (gossip along the household, kin and friends: first-hand after a
   *  seeded delay of hours to two days; second-hand, through someone of their own circle who heard it, one to three days
   *  later). One line per teller: what matters most of what they told (a deed first), and how often they met the stranger.
   *  Pure: a function of what each has to tell (told), the households and the ties */
  heard(pid: number, t: number): { t: number; from: number; text: string; hand: 1 | 2; deed: boolean; src: number; k: Told; d0: number }[] {
    const P = this.pop, day = Math.floor(t / 24); if (!P.present(pid, day)) return [];
    const out: { t: number; from: number; text: string; hand: 1 | 2; deed: boolean; src: number; k: Told; d0: number }[] = [];
    const circle = (x: number, d: number) => { const hh = P.home(x, d); return new Set([...P.membersOn(hh, d), ...P.persons[x].ties].filter(y => y !== x)); };
    let mine: Set<number> | null = null;
    for (const [src, list] of this.told) { if (src === pid) continue; const got: { k: Told; at: number; via: number }[] = [];
      for (const k of list) { if (k.t > t) continue; const d0 = Math.floor(k.t / 24); const first = circle(src, d0); const g = new Rng(this.seed, `gossip:${src}:${Math.round(k.conv * 3600)}:${pid}`);
        const firstAt = (y: number, r: Rng) => k.t + (P.home(src, d0) === P.home(y, d0) ? r.range(2, 14) : r.range(12, 48));
        if (first.has(pid)) { const at = firstAt(pid, g); if (at <= t) got.push({ k, at, via: -1 }); continue; }
        mine ??= circle(pid, day); let best: { at: number; via: number } | null = null;
        for (const via of mine) { if (!first.has(via)) continue; const at = firstAt(via, new Rng(this.seed, `gossip:${src}:${Math.round(k.conv * 3600)}:${via}`)) + g.range(24, 72); if (at <= t && (!best || at < best.at)) best = { at, via }; }
        if (best) got.push({ k, ...best }); }
      if (!got.length) continue;
      const top = [...got].sort((a, b) => (b.k.deed ? 1 : 0) - (a.k.deed ? 1 : 0) || (a.k.over ? 1 : 0) - (b.k.over ? 1 : 0) || b.at - a.at)[0]; const n = got.length, sx = P.persons[src].sex; const times = n > 1 ? ` ${n === 2 ? 'twice' : `${n} times`}` : '';
      const d0 = Math.floor(top.k.t / 24);
      out.push(top.via < 0 ? { src, k: top.k, d0, t: top.at, from: src, hand: 1, deed: !!top.k.deed, text: fit(`${cap(when(top.at, t))} your ${this.relWord(pid, src, d0)} ${this.name(src)} told you: this same stranger ${summary3(top.k, sx, undefined, times)}.`, 44) }
        : { src, k: top.k, d0, t: top.at, from: top.via, hand: 2, deed: !!top.k.deed, text: fit(`${cap(when(top.at, t))} you heard from ${this.name(top.via)}: this same stranger ${summary3(top.k, sx, this.name(src), times)}.`, 44) });
    }
    return out.sort((a, b) => a.t - b.t);
  }
  /** D-315 (after the GPU runs): the ONE thing the person remembers of the stranger, as they would say it to him (first
   *  person, "you" is the stranger), picked by the simulation for a question about earlier meetings: their own meeting with a
   *  deed first, then their own words with him, then what kin or friends told them (a deed first), else that they never met
   *  him and nobody spoke of him. The model only puts this sentence in its own words (turn.ts). Out of world (English) */
  recallFact(pid: number, t: number): { fact: string; kind: 'own' | 'heard' | 'none'; row?: MemRow; k?: Told } {
    const own = (this.rows.get(pid) ?? []).filter(r => !r.folded && r.t <= t + 1e-9).sort((a, b) => (b.deed ? 1 : 0) - (a.deed ? 1 : 0) || b.t - a.t)[0];
    if (own) return { kind: 'own', row: own, fact: cap(`${when(own.t, t)} ${meFact(own.deed, own.asked[0], 'me')}`) + '.' };
    const ov = (this.over.get(pid) ?? []).filter(r => r.t <= t + 1e-9).sort((a, b) => b.t - a.t)[0];
    if (ov) return { kind: 'own', fact: cap(`${when(ov.t, t)} I heard you say${ov.by >= 0 ? ` to ${this.name(ov.by)}` : ''} “${ov.said.replace(/…$/, '')}”`) + '.' };
    const h = this.heard(pid, t).sort((a, b) => (b.deed ? 1 : 0) - (a.deed ? 1 : 0) || (a.hand - b.hand) || b.t - a.t)[0];
    if (h) { const P = this.pop, sx = P.persons[h.src].sex, pr = sx === 'm' ? 'him' : 'her', who = h.hand === 1 ? `my ${this.relWord(pid, h.src, h.d0)} ${this.name(h.src)}` : `${this.name(h.from)}, who had it from ${this.name(h.src)},`;
      return { kind: 'heard', k: h.k, fact: cap(`${when(h.t, t)} ${who} told me that ${h.k.over ? `you said “${h.k.asked.replace(/…$/, '')}” in ${pr === 'him' ? 'his' : 'her'} hearing` : meFact(h.k.deed, h.k.asked, pr)}`) + '.' }; }
    return { kind: 'none', fact: 'I have never met you, and nobody has spoken to me of you.' };
  }
  private relWord(pid: number, o: number, day: number): string {
    const P = this.pop, me = P.persons[pid], O = P.persons[o];
    if (me.spouse === o || O.spouse === pid) return O.sex === 'm' ? 'husband' : 'wife';
    if (me.mother === o) return 'mother'; if (O.mother === pid) return O.sex === 'm' ? 'son' : 'daughter';
    if (me.mother >= 0 && me.mother === O.mother) return O.sex === 'm' ? 'brother' : 'sister';
    if (P.home(pid, day) === P.home(o, day)) return O.sex === 'm' ? 'kinsman' : 'kinswoman';
    return me.ties.includes(o) ? 'friend' : 'neighbour';
  }

  // ---------------------------------------------------------------- the save
  save(): { events: TalkEvent[]; rows: [number, MemRow[]][]; told: [number, Told[]][]; over?: [number, OverRow[]][] } | undefined {
    if (!this.events.length && !this.rows.size && !this.told.size && !this.over.size) return undefined;
    // (a pause two days past changes nothing any more: only each person's last is kept, so a long visit's save stays small)
    const keep = this.events.filter(e => e.kind !== 'hold' || e.t1! > this.lastT - 48 || this.lastHold.get(e.pid) === e);
    return { events: keep.map(e => ({ ...e, segs: e.segs?.map(s => ({ ...s })), path: e.path?.map(p => [p[0], p[1]] as P2) })), rows: [...this.rows].map(([k, v]) => [k, v.map(r => ({ ...r, asked: [...r.asked], deed: r.deed ? { ...r.deed } : undefined }))]), told: [...this.told].map(([k, v]) => [k, v.map(x => ({ ...x, deed: x.deed ? { ...x.deed } : undefined }))]), ...(this.over.size ? { over: [...this.over].map(([k, v]) => [k, v.map(r => ({ ...r }))] as [number, OverRow[]]) } : {}) };
  }
  /** a save's events replayed: the plan steps laid again in order, the pauses and the rows restored (no save: nothing) */
  load(s: { events?: TalkEvent[]; rows?: [number, MemRow[]][]; told?: [number, Told[]][]; over?: [number, OverRow[]][] } | undefined) {
    const pids = new Set<number>([...this.events.map(e => e.pid)]);
    this.events.length = 0; this.rows.clear(); this.told.clear(); this.over.clear(); this.touched.clear(); this.overlaid.clear(); this.lastHold.clear(); this.trail.length = 0;
    for (const e of s?.events ?? []) { const x: TalkEvent = { ...e, segs: e.segs?.map(q => ({ ...q })), path: e.path?.map(p => [p[0], p[1]] as P2) }; this.events.push(x); pids.add(x.pid); if (x.segs) this.lay(x); if (x.kind === 'hold') this.lastHold.set(x.pid, x); }
    for (const [k, v] of s?.rows ?? []) this.rows.set(k, v.map(r => ({ ...r, asked: [...r.asked], deed: r.deed ? { ...r.deed } : undefined })));
    for (const [k, v] of s?.told ?? []) this.told.set(k, v.map(x => ({ ...x, deed: x.deed ? { ...x.deed } : undefined })));
    for (const [k, v] of s?.over ?? []) this.over.set(k, v.map(r => ({ ...r })));
    for (const p of pids) this.bump(p);
  }
}

// ------------------------------------------------------------------ words (the model's brief: out of world)
function seg(t0: number, t1: number, place: string, act: ActivityId, why: string, where: Where): Seg { return { t0: Math.min(24, t0), t1: Math.min(24, t1), place, act, why, where }; }
/** base plan with [h0, h1] replaced by `mid` (blocks cut at the edges) */
export function splice(base: Seg[], h0: number, h1: number, mid: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const s of base) { if (s.t1 <= h0 + 1e-9) out.push(s); else if (s.t0 < h0 - 1e-9) out.push({ ...s, t1: h0 }); }
  for (const m of mid) if (m.t1 - m.t0 > 1e-6) out.push(m);
  for (const s of base) { if (s.t0 >= h1 - 1e-9) out.push(s); else if (s.t1 > h1 + 1e-9) out.push({ ...s, t0: h1 }); }
  return out;
}
export function walkWords(h: number) { const m = h * 60; return m < 8 ? 'a few steps' : m < 20 ? 'a short walk' : m < 40 ? 'half an hour’s walk' : m < 80 ? 'an hour’s walk' : 'hours’ walk'; }
export function placeWords(place: string): string {
  const head = place.split(':')[0];
  return ({ well: 'the well', canal: 'the canal', river: 'the river', mill: 'the mill', brewery: 'the brewery', store_town: 'the storehouse', station: 'the road station', oil_press: 'the oil press', tannery: 'the tannery', brickyard: 'the brickyard', stockyard: 'the stockyard', offering_place: 'the fire of the magi', outside: 'the burial ground', official_bldg: 'the officials’ building', terrace_edge: 'the foot of the great stair', h: 'the house', lane: 'the lane', water: 'the water jars', stair_foot: 'the stair foot' } as Record<string, string>)[head] ?? (/^[a-z_]+:/.test(place) || !place ? 'the place' : place.replace(/^(the|a|an)\s+/i, 'the '));
}
/** a meeting in the words of the one met ("me") or told of it ("him"/"her"): "you" is the stranger */
function meFact(d: MemRow['deed'] | undefined, asked: string | undefined, me: string): string {
  const I = me === 'me' ? 'I' : me === 'him' ? 'he' : 'she', my = me === 'me' ? 'my' : me === 'him' ? 'his' : 'her';
  if (!d) return `you spoke with ${me}${asked ? ` and said “${asked.replace(/…$/, '')}”` : ''}`;
  const a = d.arg ? placeWords(d.arg) : '';
  const ask = ({ follow: `to walk with you`, lead_to: `the way to ${a && a !== 'the place' ? a : (d.arg ?? 'a place')}`, fetch: `to fetch someone for you`, give: `for ${d.item ?? 'something'}`, trade: `to trade with you`, stop_work: `to stop work`, wait_here: `to wait for you`, go_home: `to go home` } as Record<Deed, string>)[d.kind];
  if (!d.ok) { const r = d.reason.split(/[;:]/)[0].trim().replace(/^is /, `${I} was `).replace(/^was /, `${I} was `).replace(/^has /, `${I} had `).replace(/^does not /, `${I} did not `).replace(/^too /, `${I} was too `).replace(/^(it is|the|a|an|strangers|nobody) /i, m => m.toLowerCase());
    return `you asked ${me} ${ask}, and ${I} would not: ${r}`; }
  const did = ({ follow: `${I} walked with you a while`, lead_to: `${I} showed you the way to ${a}`, fetch: `${I} ${d.reason} for you`, give: `${I} gave you ${d.item ?? 'it'}`, trade: `${I} ${d.reason.replace(/^traded/, 'traded you')}`, stop_work: `${I} stopped ${my} work to talk with you`, wait_here: `${I} waited for you`, go_home: `${I} went home` } as Record<Deed, string>)[d.kind];
  return `you asked ${me} ${ask}, and ${did}`;
}
function deedWord(k: Deed, arg?: string) { return ({ follow: 'to come along', lead_to: `the way to ${arg ? placeWords(arg) : 'a place'}`, fetch: 'to fetch someone', give: 'for something', trade: 'to trade', stop_work: 'to stop work', wait_here: 'to wait', go_home: 'to go home' } as Record<Deed, string>)[k]; }
function deedOutcome(d: NonNullable<MemRow['deed']>, you: 'you'): string {
  void you; const a = d.arg ? placeWords(d.arg) : '';
  if (!d.ok) return `He asked you ${deedWord(d.kind, d.arg)}; you would not: ${d.reason}.`;
  return ({ follow: 'You walked with him a while.', lead_to: `You showed him the way to ${a}.`, fetch: `You ${d.reason} for him.`, give: `You gave him ${d.item ?? 'something'}.`, trade: `You ${d.reason.replace(/^traded/, 'traded him')}.`, stop_work: 'You stopped work to talk with him.', wait_here: 'You waited there for him.', go_home: 'You went home, as he urged.' } as Record<Deed, string>)[d.kind];
}
function summary3(r: Told, sex: 'm' | 'f', name?: string, times = ''): string {
  if (r.over) return `said “${r.asked.replace(/…$/, '')}” in ${name ? `${name}’s` : sex === 'm' ? 'his' : 'her'} hearing`;
  const who = name ? `talked with ${name}${times}` : `talked with ${sex === 'm' ? 'him' : 'her'}${times}`; const pr = sex === 'm' ? 'he' : 'she';
  if (!r.deed) return r.asked ? `${who} and asked “${r.asked}”` : who;
  const a = r.deed.arg ? placeWords(r.deed.arg) : '';
  if (!r.deed.ok) return `${who} and asked ${deedWord(r.deed.kind, r.deed.arg)}, but ${pr} would not`;
  return `${who}; ${pr} ${({ follow: 'walked with the stranger a while', lead_to: `showed him the way to ${a}`, fetch: r.deed.reason + ' for him', give: `gave him ${r.deed.item ?? 'something'}`, trade: r.deed.reason, stop_work: 'stopped work to talk with him', wait_here: 'waited for him', go_home: 'went home as he urged' } as Record<Deed, string>)[r.deed.kind]}`;
}
/** when, as a person says it (sim hours) */
export function when(t: number, now: number): string {
  const d = Math.floor(t / 24), n = Math.floor(now / 24), h = t - d * 24; const part = h < 11 ? 'in the morning' : h < 15 ? 'at midday' : h < 18.5 ? 'in the afternoon' : 'in the evening';
  if (d === n) return now - t < 0.75 ? 'just now' : `today ${part}`; if (n - d === 1) return `yesterday ${part}`; if (n - d < 8) return `${n - d} days ago`;
  const M = MONTHS[dateOf(d).month - 1]; return `in the month ${M.op.replace(/\s*\(\?\)/, '')}`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** the first words of what was said, without the stranger's later words (hear.ts masks them on the way in; here: dropped) */
function gist(s: string, n: number): string { const w = s.replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim().split(' '); return w.slice(0, n).join(' ').replace(/[,;:]$/, '') + (w.length > n ? '…' : ''); }
function fit(s: string, _w: number): string { let t = s; while (approxTokens(t) > ROW_TOKENS && t.split(' ').length > 12) t = cut(t, t.split(' ').length - 3); return t; }
function cut(s: string, words: number): string { const w = s.split(' '); return w.length <= words ? s : w.slice(0, words).join(' ').replace(/[,;:]$/, '') + '…'; }
