// People speaking to each other, and answering the stranger (brief §9.4 "approach and address people. They respond in
// their own language … Dialogue is scripted"; §10 who speaks what, "code-switching where plausible"; Phase 8 review A-C2,
// B-M3: 45 of the 73 lines were never spoken, because only greet/reply (observer mode) and the guard's ask/affirm/refuse
// (visitor mode) were ever asked for). D-168.
//
// This module holds the scripted SITUATIONS in which the lexicon's lines are said on the Terrace: greetings between people
// who know each other, partings, talk at rest and at meals, the ration issue, the check at a post, a courier's letter at
// the Treasury, a scribe and an official at work, the foreman's calls, the gang at a lift, an official's round, porters at
// the depot; and the chain of intents a person answers the stranger with (observer mode). It chooses WHICH intent and
// WHICH language; the words are always a lexicon line (speech_lines.ts pickLine), never made up here.
//
// Tiers: every situation is a reconstruction (usage C): no text shows these words said in these places. Each note names
// what it rests on. Language choice (C; Q-285): a speaker uses a language the other understands, in the speaker's own
// order (the sim's Agent.langs); between compatriots their own language first (HOME_LANG), falling back to a blessing
// before switching language (Old Persian has no attested greeting, so two Persians bless rather than greet in Aramaic).
import { candidateLines, SPEECH_LANGS, type Intent, type ResolvedLine } from './speech_lines';
import { Rng } from '../core/rng';

export interface SpeakerLike {
  id: number; role: string; origin: string; langs: readonly string[]; seed: number; ties?: readonly number[];
  pos: readonly [number, number]; walking: boolean; offmap?: boolean;
  task: { act: string; place: string; why?: string } | null;
}
export interface SituationEnv {
  /** sim hours */ t: number; night: boolean;
  /** people who left a place since the last look (id → the place they left) */
  leftFrom?: ReadonlyMap<number, string>;
}
export interface TurnDef {
  who: 'a' | 'b';
  /** tried in order; the first with a line in a usable language is said */
  intents: Intent[];
  /** chance the turn is said at all (default 1) */ p?: number;
  only?: 'day' | 'night';
  /** the speaker may use his own language even if the other does not share it (a request carried by gesture) */
  own?: boolean;
}
export interface Situation {
  id: string; tier: 'C'; note: string;
  /** who can take part at all (role, origin, language): what the reachability test enumerates over the roster */
  cast: { a: (s: SpeakerLike) => boolean; b: (s: SpeakerLike, a: SpeakerLike) => boolean };
  /** when it happens in the running world (activity, place, distance; `all` = everyone near) */
  when: (a: SpeakerLike, b: SpeakerLike, env: SituationEnv, all: readonly SpeakerLike[]) => boolean;
  /** greatest distance between the two (m) */ reach: number;
  turns: TurnDef[];
  /** game hours before the same two say it again */ cooldownH: number;
}

/** a person's own language by origin (the sim's origins), spoken first with a compatriot (C). Medes are voiced with Old
 *  Persian as the sim does (Median is attested only through loanwords, LANGUAGES.md §1). */
export const HOME_LANG: Record<string, string> = {
  Persian: 'Old Persian', Median: 'Old Persian', Elamite: 'Elamite', Babylonian: 'Babylonian', Ionian: 'Greek',
  Syrian: 'Aramaic', Egyptian: 'Egyptian', Lydian: 'Lydian',
};
/** the posts where a passer-by is stopped and questioned (the gates, the stair heads, the Treasury doors; as sim.ts) */
export const CHECK_POSTS: ReadonlySet<string> = new Set(['post_stair_n', 'post_stair_s', 'post_gate_w1', 'post_gate_w2', 'post_gate_s1', 'post_gate_s2', 'post_treas_1', 'post_treas_2', 'post_treas_3', 'post_treas_4']);

const speaks = (s: SpeakerLike) => s.langs.some(l => l in SPEECH_LANGS);
const up = (s: SpeakerLike) => !s.offmap && !!s.task && s.task.act !== 'sleep' && s.task.act !== 'lie_ill';
const still = (s: SpeakerLike) => up(s) && !s.walking;
const act = (s: SpeakerLike, ...acts: string[]) => !!s.task && acts.includes(s.task.act);
const same = (a: SpeakerLike, b: SpeakerLike) => !!a.task && !!b.task && a.task.place === b.task.place;
export const dist = (a: SpeakerLike, b: SpeakerLike) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]);
const tied = (a: SpeakerLike, b: SpeakerLike) => !!a.ties?.includes(b.id) || !!b.ties?.includes(a.id);
const role = (...r: string[]) => (s: SpeakerLike) => r.includes(s.role) && speaks(s);
const RECIPIENT = new Set(['mason', 'porter', 'foreman', 'baker', 'grinder', 'child']);

export const SITUATIONS: Situation[] = [
  { id: 'meet', tier: 'C', reach: 4, cooldownH: 12,
    note: 'two who know each other (household, gang, file, office: sim ties) come together at a place: a greeting and its answer. Greeting words: Aramaic letter formulas (šlm), LB šulmu, Greek χαῖρε; where a language has no attested greeting (Old Persian, Elamite: Q-022, Q-023) a blessing stands in (C)',
    cast: { a: speaks, b: (b, a) => speaks(b) && tied(a, b) },
    when: (a, b) => still(a) && still(b) && same(a, b),
    turns: [{ who: 'a', intents: ['greet', 'farewell'] }, { who: 'b', intents: ['reply', 'pious', 'farewell'] }] },
  { id: 'part', tier: 'C', reach: 12, cooldownH: 6,
    note: 'one leaves a place where someone he knows stays: a leave-taking (blessings from the inscriptions, Aramaic šlm, Greek ἴθι χαίρων; C)',
    cast: { a: speaks, b: (b, a) => speaks(b) && tied(a, b) },
    when: (a, b, env) => up(a) && still(b) && !!b.task && env.leftFrom?.get(a.id) === b.task.place,
    turns: [{ who: 'a', intents: ['farewell'] }, { who: 'b', intents: ['farewell'], p: 0.7 }] },
  { id: 'chat', tier: 'C', reach: 4, cooldownH: 4,
    note: 'people who know each other talking at rest or over food: a remark, agreement or disagreement (C)',
    cast: { a: speaks, b: (b, a) => speaks(b) && tied(a, b) },
    when: (a, b) => still(a) && still(b) && same(a, b) && act(a, 'talk', 'rest', 'eat') && act(b, 'talk', 'rest', 'eat'),
    turns: [{ who: 'a', intents: ['remark'] }, { who: 'b', intents: ['affirm'], p: 0.6 }, { who: 'b', intents: ['refuse'], p: 0.2 }] },
  { id: 'meal', tier: 'C', reach: 4, cooldownH: 12,
    note: 'eating together: bread passed round (the household and the gang eat together, D-080; bread rations B; C)',
    cast: { a: speaks, b: (b, a) => speaks(b) && tied(a, b) },
    when: (a, b) => still(a) && still(b) && same(a, b) && act(a, 'eat') && act(b, 'eat'),
    turns: [{ who: 'a', intents: ['offer'] }, { who: 'b', intents: ['affirm'], p: 0.7 }] },
  { id: 'ration_issue', tier: 'C', reach: 15, cooldownH: 1,
    note: 'the monthly issue at the depot (E-01: the group queues and receives its grain; the scribe records and seals it): the issuer names the ration and counts; the receiver asks for his share (in his own tongue if need be, the gesture carries it), the scribe says "received" (the PF receipt verb) and the receiver blesses (C)',
    cast: { a: role('scribe', 'official', 'foreman'), b: s => RECIPIENT.has(s.role) && speaks(s) },
    when: (a, b) => still(a) && act(a, 'write_tablet', 'inspect', 'talk') && (a.task!.place === 'stair_foot' || /ration|issue/.test(a.task!.why ?? '')) && act(b, 'queue') && same(a, b),
    turns: [{ who: 'a', intents: ['ration'] }, { who: 'a', intents: ['count'] }, { who: 'b', intents: ['ration'], p: 0.5, own: true },
      { who: 'a', intents: ['remark'], p: 0.5 }, { who: 'b', intents: ['pious'], p: 0.5 }] },
  { id: 'gate_check', tier: 'C', reach: 8, cooldownH: 3,
    note: 'a guard at a gate, stair head or Treasury door questions someone passing (access.json stop procedure; guards on the reliefs B): asks for the document, hears who he is, lets him through by day, turns him back at night (C)',
    cast: { a: role('guard'), b: role('courier', 'official', 'porter') },
    when: (a, b) => still(a) && act(a, 'stand_guard') && CHECK_POSTS.has(a.task!.place) && up(b) && !same(a, b),
    turns: [{ who: 'a', intents: ['ask_document'] }, { who: 'b', intents: ['identify'] }, { who: 'a', intents: ['affirm'], only: 'day' },
      { who: 'a', intents: ['refuse'], only: 'night' }, { who: 'b', intents: ['farewell'], p: 0.6, only: 'day' }] },
  { id: 'relief', tier: 'C', reach: 5, cooldownH: 4,
    note: 'a guard comes to the post of a man of his file (the stand-in for bread and water, D-080; the rota, D-023): a greeting, the other\'s blessing as he goes, a word on the day (C)',
    cast: { a: role('guard'), b: (b, a) => role('guard')(b) && tied(a, b) },
    when: (a, b) => up(a) && still(b) && act(b, 'stand_guard') && (same(a, b) || a.walking),
    turns: [{ who: 'a', intents: ['greet', 'farewell'] }, { who: 'b', intents: ['farewell'], p: 0.8 }, { who: 'b', intents: ['remark'], p: 0.3 }] },
  { id: 'office', tier: 'C', reach: 8, cooldownH: 3,
    note: 'a scribe and an official at the same desk or store: the official asks for the sealed document (halmi, PF 15), the scribe counts, the official assents, the scribe notes it received (PF receipt formula; C)',
    cast: { a: role('official'), b: role('scribe') },
    when: (a, b) => still(a) && still(b) && same(a, b) && act(a, 'inspect', 'talk') && act(b, 'write_tablet', 'talk', 'inspect'),
    turns: [{ who: 'a', intents: ['ask_document'] }, { who: 'b', intents: ['count'] }, { who: 'a', intents: ['affirm'] }, { who: 'b', intents: ['remark'], p: 0.5 }] },
  { id: 'announce', tier: 'C', reach: 8, cooldownH: 3,
    note: 'a courier of the road station comes up to the Terrace: someone at the depot, the desk or the works who sees him names him to the man beside him ("a messenger", PF 45 hutlak), who may ask for his document (C)',
    cast: { a: role('porter', 'official', 'scribe', 'foreman'), b: (b, a) => speaks(b) && b.role !== 'courier' && languageOrder(a, b).length > 0 },
    when: (a, b, _e, all) => up(a) && up(b) && all.some(c => c.role === 'courier' && up(c) && c.id !== b.id && dist(a, c) < 30),
    turns: [{ who: 'a', intents: ['announce'] }, { who: 'b', intents: ['ask_document', 'affirm'], p: 0.5 }] },
  { id: 'letter', tier: 'C', reach: 8, cooldownH: 3,
    note: 'a courier of the road station delivers a sealed letter at the Treasury desk or to an official (E-20): he greets, is asked for his document, names what he carries, and is answered (C)',
    cast: { a: role('courier'), b: role('official', 'scribe') },
    when: (a, b) => still(a) && still(b) && same(a, b),
    turns: [{ who: 'a', intents: ['greet', 'farewell'] }, { who: 'b', intents: ['ask_document'] }, { who: 'a', intents: ['identify'] }, { who: 'b', intents: ['affirm'] }] },
  { id: 'work_call', tier: 'C', reach: 15, cooldownH: 2,
    note: 'the foreman at the stone yard calls his squad to work, urges it on or stops it (the gangs\' hours, E-60; kurtaš, the tablets\' word for the workforce; Ezra\'s "diligently", "leave it"); now and then a "don\'t!" (C)',
    cast: { a: role('foreman'), b: (b, a) => role('mason')(b) && tied(a, b) },
    when: (a, b) => up(a) && up(b) && !a.walking && same(a, b),
    turns: [{ who: 'a', intents: ['call_workers'] }, { who: 'a', intents: ['refuse'], p: 0.15 }, { who: 'b', intents: ['affirm'], p: 0.5 }] },
  { id: 'gang', tier: 'C', reach: 6, cooldownH: 2,
    note: 'masons of one squad at work on the same drum: counting at a lift, urging each other on, a word on a finished face, an oath (C)',
    cast: { a: role('mason'), b: (b, a) => role('mason')(b) && tied(a, b) },
    when: (a, b) => still(a) && still(b) && same(a, b) && act(a, 'dress_stone', 'haul', 'inspect') && act(b, 'dress_stone', 'haul', 'inspect'),
    turns: [{ who: 'a', intents: ['count'], p: 0.5 }, { who: 'a', intents: ['call_workers'] }, { who: 'b', intents: ['remark'], p: 0.6 }, { who: 'b', intents: ['pious'], p: 0.25 }] },
  { id: 'round', tier: 'C', reach: 12, cooldownH: 3,
    note: 'an official on his round of the halls and courts (sim: "an inspection round") speaks to the guards there: a word of approval or an order to move on, and their assent (C)',
    cast: { a: role('official'), b: role('guard', 'courier', 'official') },
    when: (a, b) => still(a) && act(a, 'inspect') && still(b) && b.id !== a.id,
    turns: [{ who: 'a', intents: ['remark'], p: 0.6 }, { who: 'a', intents: ['call_workers'], p: 0.4 }, { who: 'b', intents: ['affirm'] }] },
  { id: 'depot', tier: 'C', reach: 6, cooldownH: 3,
    note: 'porters of the depot waiting for loads or taking them up: counting the sacks, agreeing (C)',
    cast: { a: role('porter'), b: (b, a) => role('porter')(b) && tied(a, b) },
    when: (a, b) => still(a) && still(b) && same(a, b),
    turns: [{ who: 'a', intents: ['count'] }, { who: 'b', intents: ['affirm'], p: 0.6 }] },
  { id: 'delivery', tier: 'C', reach: 10, cooldownH: 2,
    note: 'a porter brings a load to a store where a scribe records the goods (E-06 deliveries measured in; PF receipts "PN received"): the scribe asks for the document, the porter names himself the deliverer (PF 54 ullira), the sacks are counted and received (C)',
    cast: { a: role('scribe'), b: role('porter') },
    when: (a, b) => still(a) && act(a, 'write_tablet', 'inspect') && up(b) && same(a, b),
    turns: [{ who: 'a', intents: ['ask_document'] }, { who: 'b', intents: ['identify'] }, { who: 'b', intents: ['count'], p: 0.6 }, { who: 'a', intents: ['remark'] }] },
];

/** the languages a speaker may use to someone: his own, in his order, that the other also speaks; compatriots' own
 *  language first */
export function languageOrder(sp: SpeakerLike, to: SpeakerLike | null): string[] {
  if (!to) return [...sp.langs];
  const shared = sp.langs.filter(l => to.langs.includes(l));
  const home = HOME_LANG[sp.origin];
  if (home && HOME_LANG[to.origin] === home && shared.includes(home)) return [home, ...shared.filter(l => l !== home)];
  return shared;
}
const compatriots = (a: SpeakerLike, b: SpeakerLike | null) => !!b && !!HOME_LANG[a.origin] && HOME_LANG[a.origin] === HOME_LANG[b.origin] && a.langs.includes(HOME_LANG[a.origin]) && b.langs.includes(HOME_LANG[a.origin]);

/** Every line a speaker could say for a turn (the reachability test uses this; `speak` picks one of them). */
export function turnCandidates(sp: SpeakerLike, to: SpeakerLike | null, intents: readonly Intent[], own = false): { lines: ResolvedLine[]; via: string; intent: Intent } | null {
  const order = own ? [...new Set([...languageOrder(sp, to), ...sp.langs])] : languageOrder(sp, to);
  // compatriots stay in their own language, falling back through the intents, before switching language
  const passes: string[][] = compatriots(sp, to) ? [[HOME_LANG[sp.origin]], order] : [order];
  for (const langs of passes) for (const intent of intents) {
    const c = candidateLines({ langs, intent, role: sp.role }); if (c) return { ...c, intent };
  }
  return null;
}
export function speak(sp: SpeakerLike, to: SpeakerLike | null, intents: readonly Intent[], seed: number, own = false): { line: ResolvedLine; via: string; intent: Intent } | null {
  const c = turnCandidates(sp, to, intents, own); if (!c) return null;
  return { line: new Rng(seed, `say:${c.intent}`).pick(c.lines), via: c.via, intent: c.intent };
}

/** The stranger addresses someone (observer mode, world.address): the intents tried, by how often they have met.
 *  First: a greeting (a blessing where the language has none); a guard on duty at a check post asks for the document
 *  as he would in visitor mode. Second: what a person of that work says of himself or of the moment. Later: an answer,
 *  a pious aside, a leave-taking. Usage C. */
export function addressIntents(p: SpeakerLike, met: number): Intent[] {
  if (met <= 1) return p.role === 'guard' && act(p, 'stand_guard') && !!p.task && CHECK_POSTS.has(p.task.place) ? ['ask_document', 'greet'] : ['greet', 'farewell'];
  if (met % 2 === 0) return ROLE_SECOND[p.role] ?? ['reply', 'farewell'];
  return ['reply', 'pious', 'farewell'];
}
const ROLE_SECOND: Record<string, Intent[]> = {
  guard: ['identify', 'remark'], courier: ['identify', 'reply'], scribe: ['identify', 'reply'], porter: ['identify', 'reply'],
  mason: ['identify', 'remark', 'reply'], official: ['remark', 'reply'], foreman: ['reply', 'refuse'],
  baker: ['offer', 'reply', 'farewell'], grinder: ['offer', 'reply', 'farewell'], child: ['reply', 'farewell'],
};
/** what a guard says to the visitor at a stop (visitor mode, controller.ts): the visitor is a stranger, so the guard's
 *  own languages in order */
export const VISITOR_INTENTS: Intent[] = ['ask_document', 'refuse', 'affirm', 'greet'];

export interface Match { s: Situation; a: SpeakerLike; b: SpeakerLike }
/** Every situation happening now among these people (no chance, no cooldown). */
export function situationsNow(people: readonly SpeakerLike[], env: SituationEnv): Match[] {
  const out: Match[] = []; const maxReach = Math.max(...SITUATIONS.map(s => s.reach));
  const live = people.filter(p => up(p) && speaks(p));
  for (const a of live) for (const b of live) {
    if (a === b) continue; const d = dist(a, b); if (d > maxReach) continue;
    for (const s of SITUATIONS) if (d <= s.reach && s.cast.a(a) && s.cast.b(b, a) && s.when(a, b, env, live)) out.push({ s, a, b });
  }
  return out;
}

export interface Utterance { speaker: SpeakerLike; to: SpeakerLike; line: ResolvedLine; via: string; intent: Intent }
export interface Exchange { situation: Situation; a: SpeakerLike; b: SpeakerLike; utterances: Utterance[] }
/** The turns of a match as said now (turns by chance and by day/night; a turn with no usable line is a gesture). */
export function realise(m: Match, env: SituationEnv, rng: Rng): Exchange | null {
  const utterances: Utterance[] = [];
  for (const [i, tu] of m.s.turns.entries()) {
    if (tu.only === 'day' && env.night) continue; if (tu.only === 'night' && !env.night) continue;
    if (tu.p !== undefined && !rng.chance(tu.p)) continue;
    const sp = tu.who === 'a' ? m.a : m.b, to = tu.who === 'a' ? m.b : m.a;
    const r = speak(sp, to, tu.intents, (sp.seed + Math.floor(env.t * 7) + i * 131) >>> 0, tu.own);
    if (r) utterances.push({ speaker: sp, to, ...r });
  }
  return utterances.length ? { situation: m.s, a: m.a, b: m.b, utterances } : null;
}

/**
 * The world's conversations near the listener: every `checkEvery` seconds, with chance `chance`, one situation among
 * the people within `hear` metres is played (unless one is still being spoken, or the same two said it within its
 * cooldown). Tracks who left which place, for leave-takings.
 */
export class Conversations {
  private recent = new Map<string, number>(); private last = new Map<number, string>(); private nextCheck = 0; busyUntil = 0;
  constructor(readonly opts = { hear: 25, checkEvery: 2.5, chance: 0.45, gap: 6 }) {}
  update(now: number, people: readonly SpeakerLike[], listener: readonly [number, number], env: Omit<SituationEnv, 'leftFrom'>, rng: Rng): Exchange | null {
    if (now < this.nextCheck) return null; this.nextCheck = now + this.opts.checkEvery;
    const leftFrom = new Map<number, string>();
    for (const p of people) { const was = this.last.get(p.id), at = p.task?.place; if (was && at && was !== at) leftFrom.set(p.id, was); if (at) this.last.set(p.id, at); }
    if (now < this.busyUntil || !rng.chance(this.opts.chance)) return null;
    const near = people.filter(p => Math.hypot(p.pos[0] - listener[0], p.pos[1] - listener[1]) <= this.opts.hear);
    const ms = situationsNow(near, { ...env, leftFrom }).filter(m => (this.recent.get(`${m.s.id}:${m.a.id}:${m.b.id}`) ?? -1e9) + m.s.cooldownH <= env.t);
    while (ms.length) {
      const m = ms.splice(rng.int(0, ms.length - 1), 1)[0];
      this.recent.set(`${m.s.id}:${m.a.id}:${m.b.id}`, env.t);
      const x = realise(m, { ...env, leftFrom }, rng); if (x) { this.busyUntil = now + this.opts.gap; return x; }
    }
    return null;
  }
}

/**
 * Which lines can ever be said, and by whom (tests: every line must be reachable). Enumerates each situation over every
 * pair of the roster that its cast admits, each turn's candidates, the stranger's address chain for everyone, and the
 * guards' reactions in visitor mode.
 */
export function reachableLines(roster: readonly SpeakerLike[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (c: { lines: ResolvedLine[] } | null, why: string) => { for (const l of c?.lines ?? []) { if (!out.has(l.id)) out.set(l.id, new Set()); out.get(l.id)!.add(why); } };
  // dedupe the roster by what matters for speech (role, origin, languages, ties to the other's kind)
  for (const s of SITUATIONS) {
    const seen = new Set<string>();
    for (const a of roster) { if (!s.cast.a(a)) continue;
      for (const b of roster) { if (a === b || !s.cast.b(b, a)) continue;
        const k = `${a.role}|${a.origin}|${a.langs.join(',')}|${b.role}|${b.origin}|${b.langs.join(',')}`; if (seen.has(k)) continue; seen.add(k);
        for (const tu of s.turns) { const sp = tu.who === 'a' ? a : b, to = tu.who === 'a' ? b : a; add(turnCandidates(sp, to, tu.intents, tu.own), `${s.id}:${sp.role}`); }
      } }
  }
  const guardAtPost = (p: SpeakerLike): SpeakerLike => ({ ...p, walking: false, task: { act: 'stand_guard', place: 'post_stair_n' } });
  for (const p of roster) for (const met of [1, 2, 3]) {
    add(turnCandidates(p, null, addressIntents(p, met)), `address:${p.role}:${met}`);
    if (p.role === 'guard') add(turnCandidates(p, null, addressIntents(guardAtPost(p), met)), `address:guard-at-post:${met}`);
  }
  for (const p of roster) if (p.role === 'guard') for (const i of VISITOR_INTENTS) add(candidateLines({ langs: p.langs, intent: i, role: p.role }), `visitor:${i}`);
  return out;
}
