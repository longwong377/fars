// D-296 (UD-18, T-E9): a person's life, as the language model that plays them is told it. Everything here is read from the
// simulation's own facts (population.ts, calendar.ts: household, kin, work, the year's births, deaths, marriages, sickness,
// disputes and the day's plan and events) or drawn from the person's seed (temperament, speech habits, small obligations:
// tier C, the reasoning in DECISIONS D-296). It is computed in the browser for any world seed at no GPU cost; the baked prose
// (bake.ts, tools/dev/bake_lives.ts) is an optional layer over it, keyed to one world seed.
//
// Nothing here is in-world text: the record is the model's brief (out of world). It never carries a modern place name (the
// villages' map ids are modern: they are described by distance and bearing from the Terrace) nor anything after 467.
import { Population, segAt, type Person, type Seg } from '../population';
import { MONTHS, dateOf, seasonOf } from '../calendar';
import type { EventCalendar } from '../calendar';
import { HOME_LANG } from '../exchanges';
import { Rng } from '../../core/rng';
import { pastOf, pastWords } from '../history';
import { marksOf, marksWords } from '../marks';
import { aimsOf } from '../aims';
import type { Economy } from '../economy/world';
import { personaOf } from '../persona';
import { numWords, ageWords, ordWords, countWords, spellDigits, daysAgoWords } from './words';
import { toYou } from '../deeds/lately';

export interface Kin { pid: number; name: string; rel: string; age: number; job: string; alive: boolean }
export interface LifeRecord {
  pid: number; seed: number; day: number; hour: number;
  name: string; /** D-372: how they are told from their namesakes: "son of X", "daughter of X", "wife of X" (the period's practice) */ byname: string | null; sex: 'm' | 'f'; age: number; origin: string; language: string; otherLanguages: string[];
  job: string; work: string; group: string | null; rank: string | null;
  home: string; zone: Person['zone'];
  household: Kin[]; kinHouses: string[]; friends: { name: string; how: string; feeling: string }[];
  /** the year so far, in order: what happened to this person and their house (sim facts) */
  year: string[];
  /** D-371: before this year: the person's past, bound to the household as the simulation has it (history.ts) */
  past: string[];
  /** D-452: what a walker can see on them and why (marks.ts marksOf: a scar, a limp, mourning, a craft's marks), so the talk can explain it */
  marks?: string[];
  /** D-373: what they hope for and what worries them now, from their own state (aims.ts) */
  hopes: string[]; worries: string[];
  /** D-375: the house's open needs as it would put them to a stranger (the asks layer), and the quarter's talk the house holds (rumours) */
  needs: string[]; news: string[];
  /** D-720: what yesterday held that today does not (their own day plan of the day before: the work, the errands, the visits) */
  yesterday?: string[];
  /** D-720: what was lately done by and to them among the townsfolk, in their words (the minds' deeds: deeds/lately.ts) */
  lately?: string[];
  /** quarrels and small obligations (disputes: sim facts; debts: seeded, C) */
  quarrels: string[]; debts: string[];
  temperament: string; speech: string[];
  /** today: the date as they would say it, the season and weather, what they are doing now and next, what happened earlier */
  today: { date: string; season: string; weather: string; now: string; place: string; next: string | null; earlier: string[]; events: string[] };
  /** what this person may know (by work, place and origin) and what nobody in 467 knows */
  knows: string[];
  /** the evidence tier of the record as a whole (C: a reconstruction from the simulation's rules) */
  tier: 'C';
}

const PAREN = /\s*\([^)]*\)/g;
const ROUTINE = new Set(['sleep', 'walk', 'eat', 'rest', 'tend_body', 'offmap']), ROUTINE_WHY = /^(walking|at home|asleep|with the household|resting|talking)\b/;
/** D-720: the deeds' reading of a person's late doings, registered by the deeds world of a population (deeds/engine.ts) */
export const LATELY = new WeakMap<Population, (pid: number, day: number) => string[]>();
/** a plan reason without its evidence notes in brackets (sources, event ids: out of world) */
const unparen = (s: string) => s.replace(PAREN, "");
const TERRACE: [number, number] = [96, 0];
const JOBS: Record<string, string> = {
  guard: 'a spearman of the Terrace garrison (a company of a hundred in files of ten, on a five-day rota of watches and posts)',
  homemaker: 'keeper of the household: grinding, baking, water, spinning and the children',
  child: 'a child of the household', porter: 'a porter', builder: 'a labourer in a building gang on the Hall of a Hundred Columns',
  camp: 'a woman of the work camp below the Terrace', treasury: 'a worker of the Treasury', official: 'an official of the administration',
  servant: 'a servant', scribe: 'a scribe', storekeeper: 'a storekeeper of the royal stores', miller: 'a woman of the mill',
  weaver: 'a weaver in a textile work group', brewer: 'a brewer', groom: 'a groom of the stables and the road station',
  shepherd: 'a herdsman of the state flocks', messenger: 'a messenger of the road station', caretaker: 'a caretaker and lamp keeper of the palaces',
  priest: 'a magus who keeps the offerings', gardener: 'a gardener on an estate of the plain', elder: 'an elder of the household, past heavy work',
  steward: 'a steward of an estate', craftsman: 'a craftsman of the town', farmer: 'a farmer of the plain (barley, wheat, sesame, vines)',
  traveller: 'a traveller on the king’s road with a sealed authorisation for rations', herder: 'a herder of a band driving flocks through the plain',
};
const SUBS: Record<string, string> = {
  'porter/town': 'a porter of the town, carrying loads between the stores, the depot and the houses',
  'porter/terrace': 'a porter of the Terrace depot, carrying grain and loads up the stair',
  'builder/stone': 'a stonecutter in the stone gang cutting and dressing column drums and blocks for the Hall of a Hundred Columns',
  'builder/labour': 'a labourer in the labour gang: earth, rubble and stone chips on the Hall of a Hundred Columns',
  'builder/brick': 'a brick maker and layer in the brick gang: moulding mud brick and laying the walls of the Hall of a Hundred Columns',
  'camp/baker': 'a baker of the work camp, baking the gangs’ bread', 'camp/grinder': 'a grinder of the work camp, grinding the gangs’ barley at the querns',
  'treasury/storekeeper': 'a storekeeper inside the Treasury', 'treasury/shiner': 'a goldsmith and polisher of the Treasury',
  'treasury/weigher': 'a weigher of silver at the Treasury', 'treasury/sealcutter': 'a seal cutter of the Treasury',
  'treasury/wood': 'a woodworker of the Treasury', 'treasury/textile': 'a textile worker of the Treasury', 'treasury/handler': 'a handler of goods in the Treasury stores',
  'treasury/tanner': 'a tanner working hides from the stockyard for the Treasury', 'scribe/office': 'a scribe of the administration, writing on clay tablets',
  'scribe/store': 'a scribe of the stores, recording what comes in and goes out', 'shepherd/hides': 'a herdsman who brings in hides from the stockyard',
  'craftsman/oil': 'a craftsman who presses sesame oil', 'craftsman/smith': 'a smith working at the forge of his house',
};
const ORIGIN_WORDS: Record<string, string> = {
  Persian: 'a Persian of Parsa', Median: 'a Mede', Syrian: 'a man of Syria (Across-the-River)', Egyptian: 'an Egyptian', Babylonian: 'a Babylonian',
  Cappadocian: 'a Cappadocian', Lydian: 'a Lydian from Sardis', Bactrian: 'a Bactrian', Sogdian: 'a Sogdian', Thracian: 'a Thracian', Elamite: 'an Elamite',
  Ionian: 'an Ionian (a Yauna from the coast of Sparda)', Carian: 'a Carian', Lycian: 'a Lycian',
};
const LANGS: Record<string, string> = { Cappadocian: 'Cappadocian', Bactrian: 'Bactrian', Sogdian: 'Sogdian', Thracian: 'Thracian', Carian: 'Carian', Lycian: 'Lycian' };
const BEARING = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

/** where a household lives, in words a person of 467 would use (never a modern name) */
/** a person's name as spoken (the pool's reconstruction mark * is out of world: the F3 overlay shows it) */
export function spokenName(pop: Population, pid: number): string | null { const n = pop.nameOf(pid); return n ? n.replace(/^\*/, '') : null; }
/** the household member who is this person's husband or wife: the sim's own spouse when it has one, else the one adult of the
 *  other sex of about the same generation where one of the two is a married woman (C). D-452: the guess is a pairing of the
 *  whole house (couples), so it is mutual: a wife names as her husband the man who names her as his wife, never another man
 *  (before, each person took the nearest in age, and ~280 men a seed had a "wife" who named another husband) */
export function spouseIn(pop: Population, me: Person, members: number[]): number {
  if (me.spouse !== undefined && members.includes(me.spouse)) return me.spouse;
  if (me.kin || me.age < 16) return -1;
  // (one not in the list given, as a wife who joined by marriage looked up in the house's first members: paired with them)
  return couples(pop, members.includes(me.id) ? members : [...members, me.id]).get(me.id) ?? -1;
}
const canWed = (a: Person, b: Person) => a.id !== b.id && a.sex !== b.sex && a.age >= 16 && b.age >= 16 && !a.kin && !b.kin && a.mother !== b.id && b.mother !== a.id && Math.abs(a.age - b.age) < 22 && (a.sex === 'f' ? !!a.wife : !!b.wife);
const COUPLES = new WeakMap<number[], Map<number, number>>();
/** D-452: the couples of a house: first the sim's own marriages (spouse fields, both in the house), then the closest-in-age
 *  pairs of a married woman and a man who may be her husband, each person in at most one pair (greedy by age gap, then id) */
export function couples(pop: Population, members: number[]): Map<number, number> {
  const hit = COUPLES.get(members); if (hit) return hit;
  const m = new Map<number, number>(), inH = new Set(members);
  for (const x of members) { const p = pop.persons[x]; if (p.spouse !== undefined && inH.has(p.spouse) && !m.has(x) && !m.has(p.spouse)) { m.set(x, p.spouse); m.set(p.spouse, x); } }
  const free = members.filter(x => !m.has(x)).map(x => pop.persons[x]).filter(p => p.age >= 16 && !p.kin && (p.spouse === undefined || !inH.has(p.spouse)));
  const W = free.filter(p => p.sex === 'f' && p.wife), M = free.filter(p => p.sex === 'm'), pairs: [number, number, number][] = [];
  for (const w of W) for (const h of M) if (canWed(w, h)) pairs.push([Math.abs(w.age - h.age), w.id, h.id]);
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  for (const [, w, h] of pairs) if (!m.has(w) && !m.has(h)) { m.set(w, h); m.set(h, w); }
  COUPLES.set(members, m); return m;
}
export function homeWords(pop: Population, h: number): string {
  const H = pop.households[h]; const q = pop.quarters[H.q];
  const dx = H.xy[0] - TERRACE[0], dy = H.xy[1] - TERRACE[1], km = Math.hypot(dx, dy) / 1000;
  const b = BEARING[Math.round(((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360) / 45) % 8];
  // (D-720: the court's people live where the court lodges them, not in the garrison: a servant of a retinue camp was told
  // "Home: the garrison quarters on the Terrace" and slept in a tent in the town)
  if (H.q === 'court') { const h0 = H.home ?? '';
    return h0 === 'court_camp' ? 'a tent in the court’s camp below the Terrace' : /^rcamp:/.test(h0) ? `a tent in a camp of the king’s retinue, ${km < 1.6 ? 'a short walk' : 'about half an hour’s walk'} ${b} of the Terrace`
      : /harem/.test(h0) ? 'the women’s palace on the Terrace, in the king’s household' : /guard/.test(h0) ? 'the guard quarters of the king’s spearmen on the Terrace' : h0 === 'station' ? 'the road station below the Terrace' : 'the king’s household on the Terrace'; }
  if (H.zone === 'terrace') return 'the garrison quarters on the Terrace';
  if (H.zone === 'transient') return 'on the road: camped for a few days near the Terrace';
  // distance as a walker gives it (about 4.5 km an hour on the plain's tracks: C), never in modern units
  const walk = km < 0.4 ? 'a few steps' : km < 1.6 ? 'a short walk' : km < 3.5 ? 'about half an hour’s walk' : km < 6.5 ? 'about an hour’s walk' : km < 11 ? 'about two hours’ walk' : km < 18 ? 'half a day’s walk' : 'most of a day’s walk';
  if (q?.kind === 'village') return `a village of the plain, ${walk} ${b} of the Terrace`;
  if (q?.kind === 'garden') return `a house on a walled estate of gardens, ${walk} ${b} of the Terrace`;
  return `a mud-brick house in the town ${km < 0.6 ? 'at the foot of the Terrace' : `${b} of the Terrace, ${walk} from its stair`}`;
}

/** a group's label in words: no count in brackets, and "treasury workers' group 7" as "the seventh treasury workers' group" (D-452: no digits) */
function groupWords(label: string): string { const l = label.replace(/\s*\(\d+\)/, ''), m = /^(.*) group (\d+)$/.exec(l); return m ? `the ${ordWords(+m[2])} ${m[1]} group` : spellDigits(l); }
function jobWords(p: Person): string { return SUBS[`${p.job}/${p.sub}`] ?? JOBS[p.job] ?? p.job; }

/** a relation word from the household's own facts (mother, children, marriage flags, ages; C where it guesses a spouse) */
export function relOf(pop: Population, me: Person, o: Person, members: number[]): string {
  const m = o.sex === 'm'; const sp = spouseIn(pop, me, members);
  if (o.mother === me.id || (sp >= 0 && o.mother === sp && o.age < me.age - 12)) return m ? 'son' : 'daughter';
  if (me.mother === o.id) return 'mother';
  if (sp === o.id) return m ? 'husband' : 'wife';
  if (me.mother >= 0 && me.mother === o.mother) return m ? 'brother' : 'sister';
  if (me.mother >= 0 && spouseIn(pop, pop.persons[me.mother], members) === o.id) return 'father';
  if ((o.kin || o.job === 'child') && o.age < me.age - 14 && me.age >= 16) return m ? 'son' : 'daughter';
  if ((me.kin || me.job === 'child') && o.age > me.age + 14 && o.age < me.age + 50 && !o.kin && o.job !== 'elder') return m ? 'father' : 'mother';
  if (o.job === 'elder') return m ? 'the old man of the house' : 'the old woman of the house';
  // (D-720: the court's households are lodgings of fellows, not kin: "kinswoman of the house" for nine servants of a tent)
  if (pop.households[me.hh]?.q === 'court') return me.job === o.job && me.job === 'servant' ? 'fellow servant' : 'companion';
  return m ? 'kinsman of the house' : 'kinswoman of the house';
}

const OATHS: Record<string, string[]> = {
  Persian: ['by Auramazda', 'the gods willing'], Median: ['by Auramazda', 'by the gods'], Elamite: ['by Humban', 'by Napiriša'],
  Babylonian: ['by Marduk', 'by Nabû'], Syrian: ['by Hadad', 'by the gods'], Egyptian: ['by Ptah', 'by Amun'], Ionian: ['by Zeus', 'by the gods'],
  Lydian: ['by the gods'], Carian: ['by the gods'], Lycian: ['by the gods'], Bactrian: ['by the gods'], Sogdian: ['by the gods'], Thracian: ['by the gods'], Cappadocian: ['by the gods'],
};

/** the full record of person `pid` on day `day` at `hour` (the calendar's days up to `day` are computed on demand) */
export function lifeRecord(pop: Population, cal: EventCalendar, pid: number, day: number, hour: number): LifeRecord {
  const p = pop.persons[pid]; const r = new Rng((pop.seed * 7919 + pid) >>> 0, 'converse.life');
  const name = spokenName(pop, pid) ?? `(no name recorded: ${p.sex === 'm' ? 'he' : 'she'} gives ${p.sex === 'm' ? 'his' : 'her'} father’s house)`;
  const age = pop.ageOn(pid, day); const hh = pop.home(pid, day); const H = pop.households[hh];
  const mem = [...new Set([...H.members, ...H.joins])].filter(x => pop.home(x, day) === hh);
  const kinOf = (x: number): Kin => { const o = pop.persons[x]; return { pid: x, name: spokenName(pop, x) ?? 'unnamed', rel: relOf(pop, p, o, mem), age: pop.ageOn(x, day), job: o.job === 'child' ? 'child' : jobWords(o), alive: o.dies > day }; };
  const all = mem.filter(x => x !== pid && pop.persons[x].born <= day && pop.persons[x].dies > day && pop.persons[x].arrive <= day).map(kinOf);
  // a band or a work group living as one household: the close kin first, the rest counted
  const close = all.filter(k => !/^kins/.test(k.rel)); const household = all.length > 9 ? [...close, ...all.filter(k => /^kins/.test(k.rel)).slice(0, Math.max(0, 6 - close.length))] : all;
  const others = all.length - household.length;
  const kinHouses = H.kin.slice(0, 4).map(k => { const K = pop.households[k]; const head = K.members.find(x => pop.persons[x].age >= 16 && pop.persons[x].sex === 'm') ?? K.members[0]; const hn = head === undefined ? null : spokenName(pop, head); return !hn ? '' : `${hn}’s house (${homeWords(pop, k)})`; }).filter(Boolean);
  const friends = p.ties.filter(o => pop.persons[o].hh !== hh && pop.present(o, day) && spokenName(pop, o)).slice(0, 4).map(o => { const O = pop.persons[o]; const a = pop.affinity(pid, o, day);
    const how = pop.households[p.hh].kin.includes(O.hh) ? 'kin' : p.group >= 0 && O.group === p.group ? 'works in the same group' : 'a neighbour';
    return { name: spokenName(pop, o)!, how: `${how}, ${jobWords(O)}`, feeling: a < 0 ? 'on bad terms since a quarrel' : a > 0.5 ? 'close' : 'friendly' }; });
  // (D-720: one with no ties of their own (the court's people, newcomers) is friends with the fellows they live and work beside)
  if (!friends.length && age >= 12) for (const k of all.filter(k => /^(fellow servant|companion)$/.test(k.rel) && k.age >= 12).slice(0, 2)) friends.push({ name: k.name, how: `lives and works beside you, ${k.job}`, feeling: 'friendly' });
  // (D-371: a small child's friends are the children it plays with in the lane)
  if (age < 12) for (const o of pop.playmatesOf(pid, day)) if (friends.length < 4 && spokenName(pop, o)) friends.push({ name: spokenName(pop, o)!, how: `plays with them in the ${pop.households[pop.home(o, day)].zone === 'plain' ? 'village' : 'lane'}, a ${pop.persons[o].sex === 'm' ? 'boy' : 'girl'} of ${ageWords(pop.ageOn(o, day))}`, feeling: 'close' });
  // the year so far (the regnal year starts at day 0, the month of Nisanu: sim facts only)
  const year: string[] = [], quarrels: string[] = [];
  const when = (d: number) => { const k = day - d; return k < 45 ? daysAgoWords(k) : `in the month ${MONTHS[dateOf(d).month - 1].op}`; }; // (D-720, W5: no weeks in Persis)
  // (D-720: the court's people came with the court, not with a work group sent to the Terrace)
  const cm = pop.court && pid >= pop.court.first && pid < pop.court.end ? pop.court.member(pid) : null;
  if (cm && p.arrive > 0 && p.arrive <= day) year.push(cm.role === 'petitioner' ? `came to Parsa ${when(p.arrive)} to put a petition before the king` : cm.role === 'delegate' ? `came to Parsa ${when(p.arrive)} with a delegation of their people bearing gifts for the king` : `came to Parsa with the king’s household from Šušan ${when(p.arrive)}`);
  else if (p.arrive > 0 && p.arrive <= day) year.push(p.job === 'herder' ? `came down into the plain with the band and the flocks ${when(p.arrive)}` : p.job === 'traveller' ? `came to Parsa on the king’s road ${when(p.arrive)}` : `came to Parsa with a newly sent work group ${when(p.arrive)}`);
  if (p.marry <= day && p.spouse !== undefined && !p.moved) year.push(`was married ${when(p.marry)} to ${spokenName(pop, p.spouse)}`);
  if (p.marry > day && p.marry < 1e8 && p.spouse !== undefined) year.push(`is to be married this year to ${spokenName(pop, p.spouse)} (the families have agreed)`);
  if (p.moved && p.marry <= day) year.push(`moved ${when(p.marry)} to kin after the death of the last grown-up of the old house`);
  for (const x of pop.childrenOf(pid)) { const c = pop.persons[x]; if (c.born >= 0 && c.born <= day) year.push(`${c.dies <= day ? 'lost' : 'had'} a ${c.sex === 'm' ? 'son' : 'daughter'}${c.dies > day ? ', ' + (spokenName(pop, x) ?? '') : ''}, born ${when(c.born)}${c.dies <= day ? `, who died ${when(c.dies)}` : ''}`); }
  for (const x of [...H.members, ...H.joins]) { const o = pop.persons[x]; if (x !== pid && o.dies <= day && o.dies >= 0 && o.born < o.dies && !(o.mother === pid && o.born >= 0)) year.push(`${spokenName(pop, x)}, ${relOf(pop, p, o, mem)}, died ${when(o.dies)}`); }
  for (let d = Math.max(0, day - 60); d <= day; d++) {
    const C = cal.ctx(d); const x = C.disputes.get(pid); if (x && (d < day || x.t <= hour)) quarrels.push(`quarrelled with ${spokenName(pop, x.other)} ${x.why} ${when(d)}`);
  }
  let sickDays = 0; for (let d = Math.max(0, day - 30); d < day; d++) if (pop.sick(pid, d)) sickDays++;
  if (sickDays) year.push(`was sick for ${countWords(sickDays, 'day')} in the last month`);
  if (pop.sick(pid, day)) year.push('is sick today');
  const mourn = pop.mourning(pid, day); if (mourn) year.push(`the house is in mourning (a death ${mourn === 1 ? 'yesterday' : `${numWords(mourn)} days ago`})`);
  const hear = pop.hearing(pid, day); if (hear) year.push(`must go before an official today over the quarrel with ${spokenName(pop, hear.other)} ${hear.why}`);
  if (p.group >= 0) { const sh = cal.shortfalls.filter(s => s.group === p.group && s.day <= day && s.day > day - 90); if (sh.length) year.push(`the group’s rations came short ${when(sh[sh.length - 1].day)}${sh[sh.length - 1].paidSilver ? ' and part was paid in silver' : ''}`); }
  // small obligations (seeded, C: loans in kind between neighbours and kin are the ordinary texture of such a town)
  // D-371: the house's real debts and dealings when the economy stands built (the sim's ledger), else the seeded small obligations
  const E = pop.ledger?.(day) ?? null, real = E ? econFacts(pop, E, hh, day) : null;
  if (real) year.push(...real.year);
  let debts: string[] = []; const lenders = [...p.ties, ...household.map(k => k.pid)].filter(o => pop.persons[o].age >= 16 && pop.persons[o].hh !== hh && !!spokenName(pop, o));
  if (age >= 16 && lenders.length && r.next() < 0.45) { const o = lenders[Math.floor(r.next() * lenders.length)];
    const what = p.job === 'farmer' || p.job === 'gardener' ? ['seed barley for the sowing', 'the loan of an ox for two days of ploughing', 'a jar of sesame oil'] : p.job === 'builder' ? ['a borrowed chisel, not yet given back', 'three days of barley ration'] : ['a measure of barley flour', 'a jar of beer from the last festival', 'a length of wool yarn', 'a goat kid promised at lambing'];
    const owes = r.next() < 0.6; debts.push(`${owes ? 'owes' : 'is owed'} ${what[Math.floor(r.next() * what.length)]} ${owes ? 'to' : 'by'} ${spokenName(pop, o)}`); }
  // D-372: the byname: a married woman by her husband, everyone else by the father (in the house, the mother's husband, or the
  // absent father's name drawn once per mother); A for the practice in the Babylonian and Persepolis documents, C for the father
  const byname = bynameOf(pop, pid, day, household.find(k => k.rel === 'father')?.pid ?? -1);
  if (real) debts = real.debts; // (the seeded draws are still made: the speech and oath draws after them stay as they were)
  // D-382: the person's own facets (persona.ts, its own seeded stream: the draws of `r` here are unchanged)
  const P = personaOf(pop, pid, day), temper = P.temperament;
  const oaths = OATHS[p.origin] ?? ['by the gods'];
  const speech = [P.speech, `oath: “${oaths[Math.floor(r.next() * oaths.length)]}”`, age < 13 ? 'speaks like a child: short, plain, about play, family and food' : age > 55 ? 'speaks slowly, remembers older days under the king’s father' : r.next() < 0.5 ? 'plain speech of the town' : 'plain speech, some words of the work',
    p.job === 'official' || p.job === 'scribe' ? 'formal, uses titles' : 'addresses the stranger as “stranger” or “friend”', `dislikes ${P.dislike}`];
  // today (the plan is the simulation's; the reason words are its own English, out of world)
  const C = cal.ctx(day); const dt = dateOf(day); const M = MONTHS[dt.month - 1];
  const segs: Seg[] = pop.present(pid, day) ? pop.plan(pid, day) : [];
  const cur = segs.length ? segAt(segs, hour) : null; const i = cur ? segs.indexOf(cur) : -1;
  const next = i >= 0 ? segs.slice(i + 1).find(s => s.why !== cur!.why && s.act !== 'walk') ?? null : null;
  // D-720: yesterday's own doings that today does not repeat ("what happened lately" had only the year's rare facts to go on)
  const todayWhy = new Set(segs.map(s => unparen(s.why)));
  const yesterday = day > 0 && pop.present(pid, day - 1) ? [...new Set(pop.plan(pid, day - 1).filter(s => !ROUTINE.has(s.act)).map(s => unparen(s.why)))].filter(w => !todayWhy.has(w) && !ROUTINE_WHY.test(w)).slice(0, 3) : [];
  const earlier = i > 0 ? [...new Set(segs.slice(0, i).filter(s => s.act !== 'walk' && s.act !== 'sleep' && s.t1 > hour - 8).map(s => unparen(s.why)))].slice(-5) : [];
  const wx = C.wx as any; const weather = [wx.hot ? 'hot' : '', wx.stormH ? 'a storm' : '', wx.rainH ? 'rain' : '', wx.dustH ? 'dust in the air' : '', C.winter ? 'winter cold' : ''].filter(Boolean).join(', ') || 'fair';
  const events = [...new Set(C.events.filter(e => /^(E-(2[0-7]|3[1-8]|4\d|5[01]|6[0-3])|W-)/.test(e.id) || (p.job === 'guard' && /^E-8/.test(e.id))).map(e => e.text.replace(/\s*\([^)]*\)/g, '').replace(/\s*at \d{1,2}:\d{2}/g, '')))].slice(0, 6);
  if (C.festival) events.unshift('a festival day: no work for the gangs and the work groups');
  const knows = knowsFor(p, age);
  const lang = HOME_LANG[p.origin] ?? LANGS[p.origin] ?? p.origin;
  return {
    // (D-456: one with no name of their own in the pools was told "You are (no name recorded: he gives his father’s house)"
    // and asked to answer as that: now they go by their byname, as the period did, or as the man or woman of their house)
    pid, seed: pop.seed, day, hour, name: spokenName(pop, pid) ? name : byname ? `the ${byname}` : `the ${p.sex === 'm' ? 'man' : 'woman'} of the house`, byname, sex: p.sex, age, origin: ORIGIN_WORDS[p.origin] ?? p.origin, language: lang,
    otherLanguages: [...new Set([p.origin !== 'Persian' && age >= 12 ? 'some Persian' : '', p.job === 'scribe' ? 'Elamite and Aramaic (writes them)' : '', p.group >= 0 && lang !== 'Elamite' ? 'a little Elamite (the language of the ration tablets)' : ''].filter(Boolean))],
    job: jobWords(p), work: cur?.place ?? '', group: p.group >= 0 ? groupWords(pop.groups[p.group].label) : null,
    rank: p.job === 'guard' && p.rank === 1 ? 'leader of a file of ten' : p.rank > 1 ? 'a leader of the group' : null,
    home: homeWords(pop, hh) + (others > 0 ? ` (a household of ${numWords(all.length + 1)} with the others of the ${p.job === 'herder' ? 'band' : 'group'})` : ''), zone: H.zone, household, kinHouses, friends, year, past: pastWords(pastOf(pop, pid, day, household)).map(spellDigits), marks: marksWords(marksOf(pop, pid, day)).map(spellDigits), ...aimsOf(pop, cal, pid, day, E), ...talkOf(pop, hh, day, age), lately: LATELY.get(pop)?.(pid, day) ?? [], quarrels, debts, temperament: temper, speech,
    yesterday, today: { date: `the ${ordWords(dt.dom)} day of the month ${M.op.replace(/\s*\(\?\)/, '')} (Babylonian ${M.bab}), the nineteenth year of King Xerxes`, season: seasonOf(C.month), weather, now: cur ? `${cur.act.replace(/_/g, ' ')}: ${unparen(cur.why)}` : 'away from Parsa', place: cur ? cur.where : 'away', next: next ? unparen(next.why) : null, earlier, events },
    knows, tier: 'C',
  };
}

/** D-372: how a person is told from their namesakes: a married woman by her husband, everyone else by the father (in the house,
 *  the mother's husband, or the absent father's name drawn once per mother); A for the practice, C for the father */
export function bynameOf(pop: Population, pid: number, day: number, fatherHint = -1): string | null {
  const p = pop.persons[pid], H = pop.households[pop.home(pid, day)], sp = H ? spouseIn(pop, p, H.members) : -1;
  if (p.sex === 'f' && sp >= 0 && pop.ageOn(pid, day) >= 16 && spokenName(pop, sp)) return `wife of ${spokenName(pop, sp)}`;
  const fp = fatherHint >= 0 ? fatherHint : p.mother >= 0 ? spouseIn(pop, pop.persons[p.mother], pop.households[pop.home(p.mother, day)]?.members ?? []) : -1;
  const f = fp >= 0 && spokenName(pop, fp) ? spokenName(pop, fp) : pop.absentFatherName(pid); // (a real father may share his son's name; an absent one is redrawn)
  return f ? `${p.sex === 'm' ? 'son' : 'daughter'} of ${f}` : null;
}
/** D-375: what the house needs (its open asks, as it would put them to a stranger when it would at all) and what it has
 *  heard (the rumours it holds: the version that reached it, with its certainty), in the town's words */
const NEED_WORDS: Record<string, string> = { grain: 'barley to feed the house', fuel: 'fuel for the hearth', silver: 'silver for a debt', labour: 'hands for the work', healer: 'someone to tend the sick', company: 'company in mourning', animal: 'a beast for the plough', justice: 'justice for a theft', shelter: 'a roof', time: 'time to pay a debt', petition: 'someone to speak for the house', lost_child: 'a lost child found' };
const NEWS_WORDS: Record<string, string> = { death: 'a death in', illness: 'sickness in', theft: 'a theft at', default: 'a debt unpaid by', house_fire: 'a fire at', hunger: 'hunger in', suit: 'a suit against', arrest: 'an arrest at', pledge_seized: 'a pledge taken from', debt_labour: 'one bound for debt from', animal_lost: 'an ox lost by', loan: 'a loan to', acquitted: 'an acquittal for', scandal: 'a scandal in', player_deed: 'the stranger\'s doings with',
  // (D-720: the deeds' own talk (deeds/engine.ts rumour effects): "heard of wrong the house of X" was what reached the brief)
  wrong: 'a wrong done by', insult: 'an insult given by', curse: 'a cursing by', threaten: 'threats made by', assault: 'a beating given by', damage: 'damage done by', slander: 'slander spread by', threat_to_child: 'a child threatened by',
  feud: 'a feud with', fine: 'a fine laid on', fined: 'a fine laid on', hearing: 'a hearing for',
  // (D-375: the town's talk of the stranger)
  hosted: 'the stranger taken in as a guest by', guest_sent_away: 'the stranger sent away by', ingrate: 'the stranger leaving without a word of thanks to', guest_repaid: 'the stranger\'s gift in thanks to',
  claim_denied: 'the stranger\'s lie found out by', claim_doubted: 'the stranger\'s tale doubted by', hired_stranger: 'the stranger hired as a hand by', dismissed: 'the stranger dismissed by', ruling_for: 'a ruling for the stranger against', ruling_against: 'a ruling against the stranger, in a matter of', joined_house: 'the stranger taken into', learned_tongue: 'the stranger speaking the tongue of' };
function talkOf(pop: Population, hh: number, day: number, age: number): { needs: string[]; news: string[] } {
  const A = age >= 12 ? pop.asksNow?.(`h:${hh}`, day) ?? null : null; if (!A) return { needs: [], news: [] };
  const needs = A.asks.sort((a, b) => b.urgency - a.urgency).slice(0, 2).map(a => { const v = a.voices.find(x => x.to === 'stranger');
    return `${NEED_WORDS[a.kind] ?? a.kind}${v?.willing ? `; would ask even a stranger, offering ${v.offers}` : '; would not ask a stranger'}`; });
  const news = [...new Map(A.rumours.filter(r => r.version.about !== `h:${hh}`).sort((a, b) => b.since - a.since).map(r => [`${r.version.kind}|${r.version.about}`, r] as const)).values()].slice(0, 2).map(r => { const who = houseOf(pop, r.version.about, day) ?? 'a house of the quarter';
    return `heard of ${NEWS_WORDS[r.version.kind] ?? `talk of ${r.version.kind.replace(/_/g, ' ')} about`} ${who}${r.version.certainty < 0.5 ? ' (not sure it is true)' : ''}`; });
  return { needs, news };
}
/** D-371: silver in the words of the town (no digits: the §10 lint) */
const silverWords = (x: number) => x < 0.15 ? 'a little silver' : x < 0.6 ? 'some silver' : x < 1.5 ? 'about a shekel' : x < 4 ? 'a few shekels' : x < 12 ? 'many shekels' : 'a great sum of silver';
const houseOf = (pop: Population, id: string, day = 0) => { if (id === 'treasury') return 'the king\'s treasury'; if (id === 'player') return 'the stranger'; if (!/^h:\d+$/.test(id)) return null;
  const H = pop.households[Number(id.slice(2))]; const head = H?.members.find(m => pop.persons[m].age >= 16 && pop.persons[m].sex === 'm') ?? H?.members.find(m => pop.persons[m].age >= 16) ?? H?.members[0]; const n = head !== undefined ? spokenName(pop, head) : null;
  // (D-372: with the head's byname: 209 names are shared by 43,000 people, and "the house of Ašbatašda" may be another's than one's father's)
  const by = n && head !== undefined ? bynameOf(pop, head, day) : null; return n ? `the house of ${n}${by && !/^wife/.test(by) ? ` ${by}` : ''}` : 'a house of the quarter'; };
/** D-371: what the economy says of a house: its debts (owed and owing) and its dealings of the last two months, in the town's
 *  words, from the economy's own state and events (no seeded fakes) */
export function econFacts(pop: Population, E: Economy, hh: number, day: number): { debts: string[]; year: string[] } {
  const id = `h:${hh}`, H = E.hh.get(id); if (!H) return { debts: [], year: [] };
  const debts: string[] = [];
  for (const d of H.debts) if (d.amt > 0.01) { const who = houseOf(pop, d.to, day); if (who) debts.push(`owes ${silverWords(d.amt)} to ${who}${d.due <= day + 14 ? ', due soon' : ''}`); }
  let owedBy = 0; for (const o of E.hh.values()) if (o !== H) for (const d of o.debts) if (d.to === id && d.amt > 0.01 && owedBy < 2) { const who = houseOf(pop, o.id, day); if (who) { debts.push(`is owed ${silverWords(d.amt)} by ${who}`); owedBy++; } }
  const WORDS: Record<string, (o: string | null) => string | null> = {
    harvest_poor: () => 'the harvest was poor', harvest_good: () => 'the harvest was good', default: o => `could not pay ${o ?? 'a creditor'} when the debt fell due`,
    pledge_seized: o => o ? `${o} took a pledge for a debt` : null, suit: o => o ? `${o} went to the judge over a debt` : null, time_granted: () => 'the judge gave the house time to pay',
    debt_labour: () => 'one of the house was bound to work off a debt', hunger: () => 'the house went hungry', animal_lost: () => 'the ox was lost', house_fire: () => 'there was a fire in the house',
    relief: () => 'grain came from the king\'s stores after a petition', given: o => o ? `${o} gave them grain when the house ran short` : null, kin_help: o => o ? `${o}, kin, helped them` : null,
    lent_by_neighbour: o => o ? `${o} lent them silver` : null, loan: o => o ? `borrowed silver from ${o}` : null, repaid: o => o ? `paid back ${o}` : null, robbed: () => 'they were robbed',
    hired_by_neighbour: o => o ? `worked for ${o} for grain` : null, acquitted: () => 'the judge found for them', petition_refused: () => 'a petition of theirs was refused',
  };
  const year: string[] = [], seen = new Set<string>();
  for (let i = E.events.length - 1; i >= 0 && year.length < 3; i--) { const v = E.events[i]; if (!v) continue; if (v.day < day - 60) break; if (v.day > day) continue;
    if (v.actor !== id && !(v.kind === 'theft' && v.other === id)) continue; const k = v.kind === 'theft' ? 'robbed' : v.kind; if (seen.has(k)) continue;
    const w = WORDS[k]?.(v.other ? houseOf(pop, v.other, day) : null); if (w) { seen.add(k); year.push(w); } }
  return { debts: debts.slice(0, 3), year };
}

/** the knowledge fence: what this person can know (by work and place; C) */
export function knowsFor(p: Person, age: number): string[] {
  const k = ['your own house, kin, neighbours and work', 'the town, the Terrace seen from below, the plain, the river Pulvar and the mountains', 'the gods of your people, the offerings and festivals', 'the months, the seasons, the harvests and the weather of this year',
    'that the king is Xerxes (Khshayarsha), son of Darius, and that this is the nineteenth year of his reign; the king’s father built the Terrace', 'rations of barley, wine and beer paid by the tablets; silver weighed, not counted'];
  if (age < 12) return ['your house, your mother and father, brothers and sisters, games, animals and food', 'the lane, the well and the children of the neighbours', 'a child knows little of the king or of far places'];
  if (['guard', 'official', 'scribe', 'messenger', 'caretaker'].includes(p.job)) k.push('the Terrace: its gates, stairs, halls and guard posts; who may go up and who may not');
  if (p.job === 'builder' || p.job === 'porter' || p.job === 'camp') k.push('the building of the Hall of a Hundred Columns: gangs, stone, brick, the foremen, the rations of the gangs');
  if (p.job === 'treasury' || p.job === 'scribe' || p.job === 'storekeeper') k.push('the Treasury and stores: goods, silver, seals, clay tablets in Elamite and Aramaic');
  if (p.job === 'messenger' || p.job === 'traveller' || p.job === 'groom') k.push('the king’s roads and road stations, sealed travel authorisations, Susa, Babylon, Ecbatana and the lands of the empire by hearsay');
  if (p.job === 'farmer' || p.job === 'gardener' || p.job === 'herder' || p.job === 'shepherd') k.push('fields, canals, water turns, flocks, pastures and the seasons of the plain');
  if (p.origin !== 'Persian') k.push(`the homeland of your people (${p.origin}) and how you or your parents came to Parsa`);
  return k;
}

const short = (s: string, n = 9) => { const t = s.split(/[:(;]/)[0].trim().split(/\s+/); return t.slice(0, n).join(' '); };
/** the record in as few words as keep it whole: the prompt the person's model reads on every answer (D-296: a long prompt
 *  is slow to read in, ~460 tokens a second on a T4, and one read of ~900 tokens hung the card past the Windows watchdog; the
 *  whole prompt stays under ~450 tokens). The events of the day that everyone shares are cut to the two nearest the person */
/** D-720: the "Lately" line: the late deeds and the year's facts interleaved, the weightiest first (deeds/lately.ts) */
function lateLine(L: LifeRecord): string {
  const d = (L.lately ?? []).map(toYou), y = L.year.slice(0, 2), xs = [d[0], y[0], d[1], y[1], ...L.quarrels.slice(-1), ...L.debts].filter(Boolean);
  return xs.length ? `Lately: ${xs.join('; ')}.` : '';
}
export function lifeBriefShort(L: LifeRecord, prose?: string | null): string {
  // "your wife Dātabāmā (28)" reads right to a small model; "Dātabāmā (wife, 28)" was misread (a 2B made a child of two a wife)
  // (D-456: one without a name of their own is not called "unnamed": the 1.5B said "my son Unnamed")
  const kin = L.household.slice(0, 5).map(k => k.name === 'unnamed' ? (/^kins|^the old/.test(k.rel) ? `a ${k.rel.replace(/^the /, '')} (${ageWords(k.age)})` : `your ${k.rel} (${ageWords(k.age)})`) : /^kins|^the old/.test(k.rel) ? `${k.name} (${k.rel}, ${ageWords(k.age)})` : `your ${k.rel} ${k.name} (${ageWords(k.age)})`).join(', ') || 'no one: you live with your work group';
  const who = L.age < 14 ? (L.sex === 'm' ? 'boy' : 'girl') : L.sex === 'm' ? 'man' : 'woman';
  const ev = L.today.events.filter(e => !/^the gangs at work/.test(e)).slice(0, 1);
  const lines = [
    `You are ${L.name}, ${who} of ${ageWords(L.age)}, ${L.origin}${L.byname && L.name !== `the ${L.byname}` ? `, ${L.byname}` : ''}; you speak ${L.language}.`,
    `Work: ${short(L.job, 16)}${L.rank ? `, ${L.rank}` : ''}. Home: ${L.home.replace(/ \(a household of.*\)$/, '')}.`,
    `In your house: ${kin}.`,
    L.friends.length ? `Friends and kin nearby: ${L.friends.slice(0, 2).map(f => `${f.name} (${f.how.split(',')[0]}${f.feeling === 'close' ? '' : '; ' + f.feeling})`).join(', ')}.` : '',
    // (D-720: the deeds done by and to them among the townsfolk, the weightiest first: the line's first item is the one kept when the budget cuts it)
    lateLine(L),
    L.yesterday?.length ? `Yesterday: ${L.yesterday.slice(0, 2).join('; ')}.` : '',
    L.needs.length ? `Your house needs: ${L.needs.join('; ')}.` : '',
    L.news.length ? `Talk of the quarter: ${L.news.join('; ')}.` : '',
    L.past.length ? `Before this year: ${L.past.slice(0, 2).join('; ')}.` : '',
    L.marks?.length ? `Plain to see on you: ${L.marks[0]}.` : '',
    L.worries.length || L.hopes.length ? `On your mind: ${[...L.worries.map(w => `worried about ${w}`), ...L.hopes.map(h => /^(that|to) /.test(h) ? `hoping ${h}` : `hoping for ${h}`)].slice(0, 3).join('; ')}.` : '',
    `Manner: ${L.temperament}; ${L.speech[0]}; ${L.speech[1]}.`,
    `Today: ${L.today.date.replace(/ \(Babylonian [^)]*\), the nineteenth year of King Xerxes/, '')}, ${L.today.season}, ${L.today.weather}.\nRight now: ${L.today.now.replace(/^[a-z ]+: /, '')}${L.today.next ? `; after this: ${L.today.next}` : ''}.${L.today.earlier.length ? ` Earlier: ${L.today.earlier.slice(-1).join('; ')}.` : ''}`,
    ev.length ? `News today: ${ev.join('; ')}.` : '',
    prose ? `Memories: ${prose}` : '',
    L.knows.length > 6 ? `You know well: ${L.knows[L.knows.length - 1]}.` : '',
  ];
  return spellDigits(lines.filter(Boolean).join('\n').replace(/\*(?=\p{Lu})/gu, ''));
}

/** the full brief of the record (the bake's input, the lab's display; English, out of world) */
export function lifeBrief(L: LifeRecord, prose?: string | null): string {
  const kin = L.household.map(k => `${k.name} (${k.rel}, ${ageWords(k.age)}${k.job !== 'child' ? ', ' + k.job : ''})`).join('; ') || 'none: you live alone or with your work group';
  const lines = [
    `You are ${L.name}, ${L.age < 14 ? (L.sex === 'm' ? 'a boy' : 'a girl') : L.sex === 'm' ? 'a man' : 'a woman'} of ${ageWords(L.age)}, ${L.origin}${L.byname && L.name !== `the ${L.byname}` ? `, ${L.byname}` : ''}. Your language: ${L.language}${L.otherLanguages.length ? '; also ' + L.otherLanguages.join(', ') : ''}.`,
    `Work: ${L.job}${L.group ? ` (${L.group})` : ''}${L.rank ? `, ${L.rank}` : ''}.`,
    `Home: ${L.home}. Household: ${kin}.`,
    L.kinHouses.length ? `Kin in other houses: ${L.kinHouses.join('; ')}.` : '',
    L.friends.length ? `People you know: ${L.friends.map(f => `${f.name} (${f.how}; ${f.feeling})`).join('; ')}.` : '',
    L.needs.length ? `The house needs: ${L.needs.join('; ')}.` : '', L.news.length ? `Talk of the quarter: ${L.news.join('; ')}.` : '',
    L.past.length ? `Before this year: ${L.past.join('; ')}.` : '',
    L.marks?.length ? `Plain to see on you: ${L.marks.join('; ')}.` : '',
    L.worries.length ? `Worries: ${L.worries.join('; ')}.` : '', L.hopes.length ? `Hopes: ${L.hopes.join('; ')}.` : '',
    L.year.length ? `This year: ${L.year.join('; ')}.` : '', L.lately?.length ? `Lately among the neighbours: ${L.lately.map(toYou).join('; ')}.` : '',
    L.quarrels.length ? `Quarrels: ${L.quarrels.join('; ')}.` : '', L.debts.length ? `Debts: ${L.debts.join('; ')}.` : '',
    `Temperament: ${L.temperament}. Speech: ${L.speech.join('; ')}.`,
    `Today is ${L.today.date}; ${L.today.season}; weather: ${L.today.weather}. Now (${L.today.place}) ${L.today.now}${L.today.next ? `; next: ${L.today.next}` : ''}.`,
    L.today.earlier.length ? `Earlier today: ${L.today.earlier.join('; ')}.` : '',
    L.today.events.length ? `Happening today: ${L.today.events.join('; ')}.` : '',
    prose ? `Your own memories: ${prose}` : '',
    `You know: ${L.knows.join('; ')}.`,
  ];
  return spellDigits(lines.filter(Boolean).join('\n').replace(/\*(?=\p{Lu})/gu, '')); // the plan's words carry the names' reconstruction mark
}
