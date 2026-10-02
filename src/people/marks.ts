// D-452 (UD-08; T-E3v "people showing a trace of their history a walker can see or hear", anti-proxy: mourning dress, a limp,
// a craft mark ...): THE VISIBLE MARKS OF A LIFE. A pure function of the population, the person and the day: what someone
// walking past could see on this person, each with the cause their own past gives (history.ts pastOf, the population's state),
// so the talk can explain it ("that scar? I fell from the roof when I was small"). Nothing is drawn here that the past does not
// already hold: the scar is the childhood fall the past remembers, the limp is the lameness or this month's hurt, the craft
// mark is the years of the work the past counts. Tier C throughout (the practice of cutting the hair in mourning: HDT 9.24,
// the Persians for Masistius, A for the army, C for a house of the town).
// The render hook (Vagon): marksOf(pop, pid, day) -> Mark[]; `look` names what to draw (scar_brow, burn_arm, bite_leg,
// tooth_gap, crooked_arm, war_scar, limp, mourning, shorn, with_child, stoop, craft_*); the simulation never needs it.
import type { Population } from './population';
import { pastOf, type PastEvent } from './history';
import { IMPAIR } from './popview';
import { h32, u01, salt } from './hash';

export type MarkLook = 'scar_brow' | 'burn_arm' | 'bite_leg' | 'tooth_gap' | 'crooked_arm' | 'war_scar' | 'limp' | 'mourning' | 'shorn' | 'with_child' | 'stoop'
  | 'craft_stone' | 'craft_brick' | 'craft_forge' | 'craft_loads' | 'craft_quern' | 'craft_thread' | 'craft_stylus' | 'craft_sun';
export interface Mark { look: MarkLook; /** what a walker sees, in words */ seen: string; /** why, from the person's own past or state */ cause: string;
  /** seen without speaking (true), or only close, face to face (false: a gap in the teeth) */ far: boolean; tier: 'C' }

const S = { war: salt('marks-war'), impair: salt('popview-impair') };
/** the childhood and incident lines of history.ts that leave a mark on the body, and the mark */
const FROM_PAST: [RegExp, MarkLook, string, boolean][] = [
  [/fell from the roof and cut the head open/, 'scar_brow', 'an old scar across the brow', true],
  [/was scalded at the hearth/, 'burn_arm', 'the shiny mark of an old scald on the arm', true],
  [/was bitten by a dog/, 'bite_leg', 'the white scars of a dog\'s bite on the calf', true],
  [/had a tooth knocked out/, 'tooth_gap', 'a gap in the front teeth', false],
  [/broke an arm when a block slipped/, 'crooked_arm', 'a forearm that set a little crooked', true],
];
/** the work that marks a body after years of it (C), by job/sub, and from how many years */
const CRAFT: Record<string, [MarkLook, string, number]> = {
  'builder/stone': ['craft_stone', 'hands scarred by the chisel, stone dust in the creases', 4], 'builder/brick': ['craft_brick', 'hands cracked from the mud and straw of the brick moulds', 4],
  'builder/labour': ['craft_loads', 'shoulders hardened and a neck thick from the baskets', 4], porter: ['craft_loads', 'a shoulder calloused and a back bowed from the loads', 6],
  'craftsman/smith': ['craft_forge', 'forearms speckled with small burns from the forge', 4], 'treasury/shiner': ['craft_forge', 'fingers marked with small burns from the crucible', 4],
  'camp/grinder': ['craft_quern', 'hard knees and toes from kneeling at the quern', 3], weaver: ['craft_thread', 'fingers calloused from the thread', 4],
  scribe: ['craft_stylus', 'a callus on the fingers from the stylus', 6], shepherd: ['craft_sun', 'a face burned dark and lined by the sun of the pastures', 8],
  herder: ['craft_sun', 'a face burned dark and lined by the sun of the pastures', 8], farmer: ['craft_sun', 'a face and hands burned dark and cracked by the fields', 20],
  gardener: ['craft_sun', 'hands cracked and a face burned dark by the gardens', 15], homemaker: ['craft_quern', 'hard knees and toes from kneeling at the quern', 20],
};
/** craft marks seen only close (under the clothes, on the feet) */
const NEAR = new Set<MarkLook>(['craft_quern']);
const HEAVY = new Set(['porter', 'builder', 'farmer', 'shepherd', 'herder', 'servant', 'groom', 'miller']);

/** what a walker can see on person `pid` on day `day`, each with its cause (empty: nothing marks them) */
export function marksOf(pop: Population, pid: number, day: number, past?: PastEvent[]): Mark[] {
  const p = pop.persons[pid], age = pop.ageOn(pid, day), out: Mark[] = [], add = (look: MarkLook, seen: string, cause: string, far = true) => out.push({ look, seen, cause, far, tier: 'C' });
  if (p.born > day || p.dies <= day) return out;
  const ev = past ?? pastOf(pop, pid, day), yrs = (e: PastEvent) => e.ago === 1 ? 'last year' : `${e.ago} years ago`;
  // a death in the house: mourning dress for the first days (the wardrobe's mourning set), the hair cut short for a month (C)
  const mourn = pop.mourning(pid, day); const H = pop.households[pop.home(pid, day)];
  const death = H ? H.deaths.filter(x => x < day && day - x <= 30).sort((a, b) => b - a)[0] : undefined;
  if (mourn > 0) add('mourning', 'in mourning dress', 'a death in the house in the last days');
  else if (death !== undefined && age >= 12) add('shorn', 'the hair cut short in mourning', `a death in the house ${day - death < 8 ? 'this week' : 'this month'}`);
  // a limp: this month's hurt at work, or the lasting lameness (popview's draw, D-215) and its cause in the past
  const hurt = pop.injuryOn?.(pid, day); const lamed = ev.find(e => /lamed for life/.test(e.text));
  if (hurt) add('limp', 'limping', `hurt at work ${day - hurt.day < 2 ? 'just now' : `${day - hurt.day} days ago`}`);
  else if (lamed && p.sex === 'm' && age >= IMPAIR.lame.ages[0] && age <= IMPAIR.lame.ages[1] && h32(pop.seed, S.impair, pid) / 4294967296 < IMPAIR.lame.share) add('limp', 'walks with a lasting limp', `${lamed.text}, ${yrs(lamed)}`);
  // scars of the past's own falls, scalds and bites
  for (const [re, look, seen, far] of FROM_PAST) { const e = ev.find(x => re.test(x.text)); if (e && !out.some(m => m.look === look)) add(look, seen, `${e.text}, ${yrs(e)}`, far); }
  // the war beyond the sea: a healed wound on some who marched with the levy (C: about two in five)
  const levy = ev.find(e => /marched with the levy/.test(e.text)); if (levy && u01(pop.seed, S.war, pid) < 0.4) add('war_scar', 'a long healed wound on the arm', `took it in the king's war beyond the sea, ${yrs(levy)}`);
  // with child: a woman in the last four months before a birth the simulation holds
  if (p.sex === 'f') { const due = pop.childrenOf(pid).map(c => pop.persons[c].born).filter(b => b > day && b - day <= 120); if (due.length) add('with_child', 'heavy with child', `married, and the child is due ${due[0] - day < 30 ? 'within the month' : 'in a few months'}`); }
  // the work's marks after its years; the stoop of a life of heavy work
  const job = `${p.job}/${p.sub}`, craft = CRAFT[job] ?? CRAFT[p.job]; const work = ev.filter(e => e.kind === 'work' && !/^began to /.test(e.text)).sort((a, b) => b.ago - a.ago)[0];
  // (work "since boyhood", "every year of life": from about ten; a homemaker grinds the house's grain from about fifteen: C)
  const workYrs = work && !/since (boyhood|childhood)|every year of life/.test(work.text) ? work.ago : work || ['farmer', 'shepherd', 'herder', 'gardener'].includes(p.job) ? age - 10 : p.job === 'homemaker' ? age - 15 : 0;
  if (craft && age >= 16 && workYrs >= craft[2]) add(craft[0], craft[1], work ? `${work.text}` : p.job === 'homemaker' ? 'grinding the house\'s grain every day since a girl' : 'a life of the work', !NEAR.has(craft[0]));
  if (age >= 55 && HEAVY.has(p.job)) add('stoop', 'stooped', `a life of ${p.job === 'farmer' ? 'the fields' : 'heavy work'}, ${age} years old`);
  return out;
}
/** the marks in a line for the talk (the most telling first: mourning, a limp, the scars, then the work), cause in brackets */
export function marksWords(ms: Mark[], n = 2): string[] { return ms.slice(0, n).map(m => `${m.seen} (${m.cause})`); }
