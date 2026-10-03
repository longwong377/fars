// D-459 (UD-32): OPEN DEEDS. Anything a person can do to, with or for another, as one structured record that every actor of
// the world shares: the stranger (proposed by his words: the grammar of deeds/parse.ts, or the model's JSON of deeds/extract.ts)
// and every person of the town (proposed by their own mind: mind/minds.ts, day by day, with or without the stranger). The
// simulation decides every deed (deeds/engine.ts): whether it can be done (the place, the hour, the things, the bodies),
// whether the other is willing (their mind: feelings, trust, temper, needs, duties, fear), and what follows (feelings, trust,
// goods, injuries, rumour, the law, the day plans). The model never decides; it voices.
import type { ActivityId } from '../activities';
import type { Job } from './joint';
import type { Seg } from '../population';

/** a person of the population (pid), or the stranger */
export type Actor = number | 'player';
export const STRANGER: Actor = 'player';

/** the deed's primitive: a closed set the open words map onto (deeds/verbs.ts gives each its sense, lexicon and effects) */
export type Verb =
  // together: an activity shared (hunt, fish, drink, eat, dance, sing, play, pray, walk, any work of the catalogue)
  | 'join' | 'help' | 'teach' | 'learn' | 'hire'
  // goods: things and silver between people
  | 'give' | 'lend' | 'borrow' | 'ask_for' | 'steal' | 'return' | 'share_food'
  // words that do something (the talk itself is not a deed: these change the other)
  | 'tell' | 'lie' | 'promise' | 'threaten' | 'warn' | 'apologize' | 'thank' | 'praise' | 'insult' | 'mock' | 'curse'
  | 'comfort' | 'confide' | 'flirt' | 'court' | 'bless' | 'forgive' | 'accuse' | 'complain' | 'intercede' | 'reconcile' | 'introduce'
  // the body
  | 'attack' | 'push' | 'embrace' | 'heal' | 'carry' | 'fetch' | 'repair' | 'build' | 'break' | 'guard'
  // where people go
  | 'come_with' | 'visit' | 'meet' | 'send' | 'bring' | 'dismiss' | 'avoid'
  // the gods
  | 'pray' | 'offer';

export type Good = 'grain' | 'bread' | 'silver' | 'fuel' | 'goods' | 'beer' | 'wine' | 'oil' | 'cloth' | 'tool' | 'animal' | 'food' | 'water';

export interface Deed {
  verb: Verb; actor: Actor;
  /** the one the deed is done to or with (the person addressed, by default) */
  target?: Actor;
  /** a third person: the one told about, the one accused, the one to fetch, the one interceded for */
  third?: Actor;
  /** the shared or helped work (an activity of the catalogue) */
  act?: ActivityId;
  good?: Good; qty?: number;
  /** a place (an abstract place of the population: `h:12`, `market:q`, `well:q`, 'river', 'hills', ...) */
  place?: string;
  /** when: now, later today, tonight, tomorrow (hours from the deed's time; 0 = now) */
  inH?: number;
  /** what is told, promised or lied about (the words, out of world: the translation layer's English) */
  about?: string;
  /** how hard (a shove 0.3, a blow 0.6, a beating 1; a gentle word 0.2, an oath 0.9) */
  force?: number;
  /** the words it came from (the stranger's; a mind's own deed has none) */
  said?: string;
  /** how sure the reading of the words is, 0..1 (the grammar's or the model's) */
  sure?: number;
  /** D-461: the intention it serves, in words (shown in the day plans: "visiting Arta: to ask for his daughter") */
  aim?: string;
  /** D-461: the goal it is a step of (mind/goals.ts id), for the chains of cause */
  goal?: number;
  /** D-461: the deed a telling tells of (its log id): what was seen or suffered, true by the world's own record */
  of?: number;
}

/** what follows from a deed, applied by the engine (and recorded, so a save replays it) */
export type Effect =
  | { k: 'feel'; who: number; toward: Actor; d: Partial<Feel> }
  | { k: 'trust'; hh: string; of: Actor; d: number }
  | { k: 'goods'; from: Actor | 'world'; to: Actor | 'world'; good: Good; qty: number }
  | { k: 'injury'; pid: Actor; how: 'bruised' | 'cut' | 'broken' | 'killed'; by: Actor }
  | { k: 'rumour'; about: Actor; kind: string; hh: string }
  | { k: 'law'; offender: Actor; victim: Actor; crime: string; witnessed: boolean }
  | { k: 'skill'; who: Actor; skill: string; d: number }
  | { k: 'promise'; from: Actor; to: Actor; what: string; due: number }
  | { k: 'work'; hh: string; what: string; amt: number }
  | { k: 'lay'; pid: number; day: number; h0: number; h1: number; place: string; act: ActivityId; why: string; with?: Actor }
  /** D-720: a guest put up for the night: the host house feeds them (an economy event) */
  | { k: 'hosted'; host: string; guest: string; day: number }
  // D-462: an undertaking with its walks laid (deeds/joint.ts), and a person hired by the stranger
  | { k: 'job'; job: Job; segs: [number, number, Seg][] }
  | { k: 'hire'; pid: number; said: string };

/** a feeling toward another, -1..1 (affection, anger, fear, gratitude, respect): decays toward the relationship's baseline */
export interface Feel { aff: number; anger: number; fear: number; grat: number; resp: number }

export interface Outcome {
  /** the deed could be done (the world allows it) and the other was willing (or the deed needs no consent) */
  ok: boolean;
  /** why, in the translation layer's words (the person's brief and the dev overlay) */
  why: string;
  /** the world would allow it, but the other would not (a refusal of their own) */
  refused?: boolean;
  /** D-462: a refusal in the person's own words (deeds/joint.ts sayNo; the translation layer's English) */
  say?: string;
  /** the other's inclination, -1..1 (for the brief: eager, willing, reluctant, angry) */
  lean?: number;
  effects: Effect[];
  /** people who saw it (they remember and tell) */
  witnesses?: number[];
}

/** a deed done, as the log keeps it (saved; replayed for the stranger's, recomputed for the minds') */
export interface DeedRec { id: number; day: number; t: number; deed: Deed; out: Outcome }
