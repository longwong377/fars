// D-382 (UD-08): a personality for everyone. A person is a set of independent facets drawn once from the world seed and the
// person's id (warmth, talkativeness, humour, piety, curiosity about strangers, pride, worry, temper), plus a habit of speech,
// a favourite subject (from their work, house, origin and age), a dislike and a small habit of the body while talking. The
// population's own `trait` stays one axis: it picks the core temper in the same nine-way order as before (talk.ts reads that
// order for how readily a person refuses a stranger), and the core pulls its matching facet up so the two never disagree.
//
// Tier C throughout: the facets are ordinary human variety; the subjects, habits and gestures are drawn from the life of a
// Persian royal town of 467 (vines, barley, the king's horses, the road stations, the reign of the king's father). The words
// are the model's brief (out of world): no modern idiom, nothing after 467, no digits.
import type { Population } from './population';
import { Rng } from '../core/rng';

export type Humour = 'none' | 'dry' | 'teasing' | 'merry';
export interface Persona {
  /** 0..1 each; `trait` is the population's own number (the core temper's axis) */
  trait: number; warmth: number; talk: number; humour: Humour; piety: number; curiosity: number; pride: number; worry: number; temper: number;
  core: number; habit: string; subject: string; dislike: string; gesture: string;
  /** the short manner: "<temper>, <two facets>" and "<habit>; talks most of <subject>; <gesture>" */
  temperament: string; speech: string;
}

/** the nine core tempers, in the order talk.ts's TEMPER_REFUSE reads (wary, dry, warm, proud, anxious, cheerful, pious, blunt, curious) */
const CORE: string[][] = [
  ['quiet and wary of strangers', 'guarded with strangers', 'shy and slow to trust'],
  ['patient and dry', 'unhurried and dry', 'calm, sparing with words'],
  ['warm and talkative', 'open-hearted', 'friendly and easy'],
  ['proud of the work', 'exacting about the work', 'serious about the craft'],
  ['anxious', 'uneasy, quick to fear the worst', 'restless and fretful'],
  ['cheerful', 'light-hearted', 'good-humoured'],
  ['pious', 'devout', 'careful of the gods'],
  ['blunt and impatient', 'brusque', 'short-tempered and plain'],
  ['curious about strangers', 'eager for news', 'inquisitive'],
];
/** the facet each core pulls up (or, for the blunt, the temper; the wary, curiosity down) */
const PULL: (keyof Persona | null)[] = ['curiosity', null, 'warmth', 'pride', 'worry', 'humour', 'piety', 'temper', 'curiosity'];

const HAB_QUIET = ['answers in few words', 'leaves long pauses before answering', 'speaks low, as if someone might overhear', 'says little, then all at once', 'answers a question with a question', 'looks away while speaking'];
const HAB_TALK = ['tells everything as a story', 'talks fast and loses the thread', 'calls on the neighbours as witnesses', 'repeats the stranger’s words before answering', 'gives every name and every kinsman', 'goes back to the start when interrupted'];
const HAB_ANY = ['speaks in proverbs', 'counts things off on the fingers', 'laughs before answering', 'corrects the stranger’s words', 'ends with “is it not so?”', 'compares everything to the old days', 'puts every matter in measures and days'];
const HAB_PIOUS = ['swears by the gods at every turn', 'thanks the gods for every good thing', 'touches the ground or the brow at a holy name'];
const HAB_CHILD = ['asks the stranger questions back', 'speaks all in one breath', 'boasts about what the family has', 'repeats what the grown-ups say', 'goes shy, then talks fast', 'giggles behind a hand', 'tells things that did not quite happen'];
const HAB_OLD = ['leaves long pauses before answering', 'speaks in proverbs', 'tells the same story twice', 'compares everything to the old days', 'calls the stranger “child”'];

const SUBJ_JOB: Record<string, string[]> = {
  farmer: ['the vines', 'the barley and the water in the channels', 'the sesame crop', 'the oxen and the ploughing', 'the rain and the year’s harvest'],
  gardener: ['the vines', 'the fruit trees of the estate', 'the water channels and who takes too much', 'the pomegranates'],
  groom: ['the king’s horses', 'a horse with a temper', 'the fodder and the stalls', 'the road and the stations along it'],
  messenger: ['the road and the stations along it', 'the fast horses of the post', 'what is said in Šušan'],
  shepherd: ['the flocks and the lambing', 'wolves in the hills', 'the summer pastures'], herder: ['the flocks and the summer pastures', 'the hill tracks', 'wolves and dogs'],
  builder: ['the columns of the new hall', 'the stone and how it is cut', 'the overseer of the gang', 'the bricks and the rations'],
  guard: ['the watches and the men of the file', 'spears and shields', 'the officers', 'the king’s visits'],
  scribe: ['the tablets and the reckoning of rations', 'the signs and how they are written', 'the officials and their seals'],
  official: ['the reckoning of rations', 'the seals and the orders', 'the court and its ways'], storekeeper: ['the stores and what comes in', 'the jars and measures'],
  weaver: ['the wool and the dyes', 'the loom and the patterns', 'the rations of the women'], miller: ['the bread and the price of barley', 'the querns and the flour'],
  brewer: ['the beer and the festivals', 'the dates and the barley for brewing'], camp: ['the bread and the price of barley', 'the gangs and their appetite'],
  treasury: ['the fine work of the Treasury', 'the gold and the silver weighed', 'the skill of the hands'], priest: ['the offerings and the right days', 'the gods of the land', 'the old hymns'],
  caretaker: ['the lamps and the oil', 'the great halls at night'], craftsman: ['the work of the hands', 'the tools and the trade'], servant: ['the master’s household', 'the kitchen and the stores'],
  steward: ['the estate and its yields', 'the workers and their rations'], homemaker: ['the children and the neighbours', 'the bread and the price of barley', 'the spinning and the wool'],
  traveller: ['the road and the towns along it', 'what is said in other lands'], elder: ['the old days under the king’s father', 'the house and its dead'], porter: ['the loads and the stair', 'the rations and the overseers'],
};
const SUBJ_CRAFT: Record<string, string[]> = { oil: ['the sesame and the oil press'], smith: ['the forge and the bronze'], stone: ['the stone and how it is cut'], brick: ['the bricks and the moulds'], sealcutter: ['the seals and their cutting'], shiner: ['the gold and its polish'] };
const HOMELAND: Record<string, string> = { Median: 'Media', Elamite: 'Šušan and the lowlands', Babylonian: 'Babylon', Syrian: 'the land across the river', Egyptian: 'Egypt', Ionian: 'the sea coast of the Yauna',
  Lydian: 'Sardis', Carian: 'Caria', Lycian: 'Lycia', Bactrian: 'Bactra', Sogdian: 'the Sogdian country', Thracian: 'Thrace', Cappadocian: 'Cappadocia' };
const SUBJ_ANY = ['the price of barley', 'the year’s rain', 'the festivals', 'the neighbours’ doings', 'the king’s builders', 'dreams and their meaning', 'good food', 'the comings and goings on the road'];
const SUBJ_CHILD = ['a game of knucklebones', 'the dogs of the lane', 'the donkeys', 'the honey cakes of the festival', 'a bird’s nest', 'the soldiers on the Terrace', 'the big boys’ games', 'a new lamb'];

const DISLIKE = ['dust storms', 'being hurried', 'boasters', 'idle talk', 'the winter cold', 'flies in summer', 'quarrels in the lane', 'liars', 'waste of bread', 'the overseers’ shouting', 'debts left unpaid', 'mean neighbours', 'the heat of high summer', 'drunkenness'];
const DISLIKE_CHILD = ['being sent for water', 'the dark', 'the big boys', 'bitter herbs', 'being kept in the house', 'a neighbour’s dog'];

const GEST = ['shades the eyes', 'rubs the back of the neck', 'points with the chin', 'looks at the ground', 'touches the stranger’s arm', 'stands very close', 'turns a bead on a cord', 'keeps the hands busy', 'nods along', 'folds the arms'];
const GEST_M = ['scratches his beard', 'tugs at his beard', 'hitches up his belt'];
const GEST_F = ['wipes her hands on her apron', 'pulls her shawl closer', 'settles her head-cloth'];
const GEST_JOB: Record<string, string[]> = { guard: ['leans on his spear'], builder: ['dusts the stone chips off', 'leans on the tool'], weaver: ['turns the spindle while talking'], scribe: ['rubs clay off the fingers'], farmer: ['leans on the hoe'], gardener: ['leans on the hoe'], groom: ['wipes the hands on the tunic'], miller: ['brushes flour off the arms'], camp: ['brushes flour off the arms'] };
const GEST_CHILD = ['hops from foot to foot', 'twists the hem of the tunic', 'hides behind the door post', 'picks at a scab', 'stares at the stranger’s clothes'];
const GEST_OLD = ['leans on a stick', 'peers closely', 'cups an ear'];

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const pick = <T>(u: number, a: readonly T[]) => a[Math.min(a.length - 1, Math.floor(u * a.length))];
/** a weighted pick over [weight, list] pairs, with one uniform number per pick so the draws stay fixed */
function wpick(u: number, v: number, sets: [number, readonly string[]][]): string {
  const live = sets.filter(s => s[0] > 0 && s[1].length); let w = live.reduce((a, s) => a + s[0], 0) * u;
  for (const s of live) { if ((w -= s[0]) < 0) return pick(v, s[1]); }
  return pick(v, live[live.length - 1][1]);
}

/** the persona of person `pid` (its age, house and work as on `day`; facets are fixed per person and world seed) */
export function personaOf(pop: Population, pid: number, day: number): Persona {
  const p = pop.persons[pid], age = pop.ageOn(pid, day), child = age < 13, old = age > 55, male = p.sex === 'm';
  const r = new Rng((Math.imul(pop.seed >>> 0, 2654435761) ^ (pid * 40503 + 17)) >>> 0, 'persona');
  // every draw first, in a fixed order, so no choice below shifts another facet
  const u = Array.from({ length: 22 }, () => r.next());
  const core = Math.min(CORE.length - 1, Math.floor(p.trait * CORE.length));
  const kids = pop.childrenOf(pid).filter(c => pop.persons[c].dies > day && pop.persons[c].born <= day);
  const smallKids = kids.filter(c => pop.ageOn(c, day) < 6).length, farKids = kids.filter(c => pop.ageOn(c, day) >= 16 && pop.home(c, day) !== pop.home(pid, day));
  const F = {
    warmth: clamp(u[0] + (child ? 0.1 : 0)), talk: clamp(u[1] + (child ? 0.15 : 0) - (p.job === 'guard' || p.job === 'scribe' ? 0.1 : 0)),
    piety: clamp(u[2] + (p.job === 'priest' ? 0.4 : 0) + (old ? 0.2 : 0) - (child ? 0.2 : 0)),
    curiosity: clamp(u[3] + (age < 25 ? 0.2 : 0) + (p.job === 'traveller' || p.job === 'messenger' ? 0.15 : 0) - (old ? 0.1 : 0)),
    pride: clamp(u[4] + (p.rank > 0 || p.job === 'treasury' || p.job === 'official' ? 0.2 : 0)), worry: clamp(u[5] + (smallKids ? 0.15 : 0) - (child ? 0.2 : 0)),
    temper: clamp(u[6] - (old ? 0.1 : 0)),
  };
  const humourU = u[7];
  // the core pulls its facet up (or the wary's curiosity down), so the line never contradicts itself
  const pull = PULL[core];
  if (core === 0) F.curiosity = Math.min(F.curiosity, 0.3);
  else if (pull && pull !== 'humour') (F as any)[pull] = Math.max((F as any)[pull], 0.75);
  const humour: Humour = core === 5 ? (humourU < 0.5 ? 'merry' : 'teasing') : core === 1 ? 'dry' : humourU < 0.35 ? 'none' : humourU < 0.6 ? 'dry' : humourU < 0.85 ? 'teasing' : 'merry';
  // two more facets, the strongest that differ from the core's own (the order breaks ties; a seeded jitter keeps it from one rank)
  const adj: [number, string][] = [
    [Math.abs(F.warmth - 0.5) + u[8] * 0.15, F.warmth > 0.5 ? (core === 2 ? '' : 'kindly') : 'cool with people'],
    [Math.abs(F.temper - 0.5) + u[9] * 0.15, F.temper > 0.5 ? (core === 7 ? '' : 'quick to anger') : 'slow to anger'],
    [Math.abs(F.pride - 0.5) + u[10] * 0.15, F.pride > 0.5 ? (core === 3 ? '' : child ? 'proud of the family' : 'proud of the house') : 'humble'],
    [Math.abs(F.worry - 0.5) + u[11] * 0.15, F.worry > 0.5 ? (core === 4 ? '' : 'a worrier') : 'carefree'],
    [Math.abs(F.piety - 0.5) + u[12] * 0.15, F.piety > 0.5 ? (core === 6 ? '' : 'god-fearing') : 'easy about the gods'],
    [Math.abs(F.curiosity - 0.5) + u[13] * 0.15, F.curiosity > 0.5 ? (core === 8 ? '' : 'curious') : core === 0 ? '' : 'incurious'],
    [humour === 'none' ? 0.25 + u[14] * 0.15 : 0.3 + u[14] * 0.2, core === 5 || core === 1 ? '' : humour === 'none' ? 'humourless' : humour === 'dry' ? 'with a dry wit' : humour === 'teasing' ? 'a teaser' : 'given to laughter'],
  ];
  const two = adj.filter(a => a[1]).sort((a, b) => b[0] - a[0]).slice(0, 2).map(a => a[1]);
  // the habit of speech: the talkative and the quiet each have their own; the pious swear; children and the old their own way
  const habit = child ? pick(u[16], HAB_CHILD) : wpick(u[16], u[17], [[F.talk < 0.4 ? 3 : 0.5, HAB_QUIET], [F.talk > 0.6 ? 3 : 0.5, HAB_TALK], [2, HAB_ANY], [F.piety > 0.7 ? 2.5 : 0, HAB_PIOUS], [old ? 3 : 0, HAB_OLD], [humour === 'merry' ? 1.5 : 0, ['laughs before answering', 'makes a joke of everything']]]);
  // the favourite subject: the work first, then the house, the homeland, the old days, and the town's common talk
  const jobS = [...(SUBJ_CRAFT[p.sub] ?? []), ...(SUBJ_JOB[p.job] ?? [])];
  const homeS = HOMELAND[p.origin] ? [`home in ${HOMELAND[p.origin]}`, `the food of ${HOMELAND[p.origin]}`] : [];
  const famS = [...(farKids.length ? [`a ${pop.persons[farKids[0]].sex === 'm' ? 'son' : 'daughter'} in another house`] : []), ...(smallKids ? ['the little ones of the house'] : []), ...(kids.length > 2 ? ['the children and their marriages'] : [])];
  const subject = child ? wpick(u[18], u[19], [[4, SUBJ_CHILD], [p.job === 'child' && homeS.length ? 1 : 0, homeS], [1, ['the baby of the house', 'what the father brings home']]])
    : wpick(u[18], u[19], [[5, jobS], [famS.length ? 2 : 0, famS], [homeS.length ? 2 : 0, homeS], [old ? 3 : 0, ['the old days under the king’s father', 'the building of the Terrace when it was new', 'the dead of the house']], [1.5, SUBJ_ANY]]);
  const dislike = child ? pick(u[20], DISLIKE_CHILD) : pick(u[20], DISLIKE);
  const gesture = child ? pick(u[21], GEST_CHILD) : wpick(u[21], (u[21] * 7.31) % 1, [[3, GEST], [male && age >= 18 ? 1.5 : 0, GEST_M], [!male ? 1.5 : 0, GEST_F], [GEST_JOB[p.job] ? 1.5 : 0, GEST_JOB[p.job] ?? []], [old ? 2 : 0, GEST_OLD]]);
  // the short brief's budget (~450 tokens): the manner stays near the old line's length (<= 27 words before the oath)
  const words = (x: string) => x.split(/\s+/).length, base = pick(u[15], CORE[core]);
  let temperament = `${base}, ${two.join(' and ')}`, speech = `${habit}; talks most of ${subject}; ${gesture}`;
  if (words(temperament) + words(speech) > 27) temperament = `${base}, ${two[0]}`;
  if (words(temperament) + words(speech) > 27) speech = `${habit}; talks of ${subject}; ${gesture}`;
  if (words(temperament) + words(speech) > 27) speech = `${habit}; talks of ${subject}`;
  return { trait: p.trait, ...F, humour, core, habit, subject, dislike, gesture, temperament, speech };
}

/** the manner line as the short brief gives it, without the oath */
export const mannerOf = (P: Persona) => `${P.temperament}; ${P.speech}`;
