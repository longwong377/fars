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
import { standing, countWords, type SimView } from '../speech/grounds';

export interface Kin { pid: number; name: string; rel: string; age: number; job: string; alive: boolean }
export interface LifeRecord {
  pid: number; seed: number; day: number; hour: number;
  name: string; sex: 'm' | 'f'; age: number; origin: string; language: string; otherLanguages: string[];
  job: string; work: string; group: string | null; rank: string | null;
  home: string; zone: Person['zone'];
  household: Kin[]; kinHouses: string[]; friends: { name: string; how: string; feeling: string }[];
  /** the year so far, in order: what happened to this person and their house (sim facts) */
  year: string[];
  /** quarrels (the calendar's disputes) and debts owed and owing (the economy's: D-358; never seeded) */
  quarrels: string[]; debts: string[];
  /** D-358: the house's means (stores, the market's price), wants (needs, open asks), marriage and scandal (relations), what it
   *  has heard (rumours), its dealings with the stranger and its trust in him: all read from the running simulation (speech/
   *  grounds.ts); empty when the record is made without the simulation (a lab page) */
  means: string[]; needs: string[]; bonds: string[]; rumours: string[]; stranger: string[]; trust: number; willTalk: boolean;
  asks: { id: number; kind: string; good: string; amount: number; unit: string; willing: boolean; offers: string }[]; dealings: string[];
  temperament: string; speech: string[];
  /** today: the date as they would say it, the season and weather, what they are doing now and next, what happened earlier */
  today: { date: string; season: string; weather: string; now: string; place: string; next: string | null; earlier: string[]; events: string[] };
  /** what this person may know (by work, place and origin) and what nobody in 467 knows */
  knows: string[];
  /** the evidence tier of the record as a whole (C: a reconstruction from the simulation's rules) */
  tier: 'C';
}

const PAREN = /\s*\([^)]*\)/g;
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
 *  other sex of about the same generation where one of the two is a married woman (C) */
function spouseIn(pop: Population, me: Person, members: number[]): number {
  if (me.spouse !== undefined && members.includes(me.spouse)) return me.spouse;
  if (me.kin || me.age < 16) return -1;
  const c = members.filter(x => { const o = pop.persons[x]; return x !== me.id && o.sex !== me.sex && o.age >= 16 && !o.kin && o.mother !== me.id && me.mother !== x && Math.abs(o.age - me.age) < 22 && (me.sex === 'f' ? me.wife : o.wife); });
  return c.length ? c.sort((a, b) => Math.abs(pop.persons[a].age - me.age) - Math.abs(pop.persons[b].age - me.age))[0] : -1;
}
export function homeWords(pop: Population, h: number): string {
  const H = pop.households[h]; const q = pop.quarters[H.q];
  const dx = H.xy[0] - TERRACE[0], dy = H.xy[1] - TERRACE[1], km = Math.hypot(dx, dy) / 1000;
  const b = BEARING[Math.round(((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360) / 45) % 8];
  if (H.zone === 'terrace') return 'the garrison quarters on the Terrace';
  if (H.zone === 'transient') return 'on the road: camped for a few days near the Terrace';
  // distance as a walker gives it (about 4.5 km an hour on the plain's tracks: C), never in modern units
  const walk = km < 0.4 ? 'a few steps' : km < 1.6 ? 'a short walk' : km < 3.5 ? 'about half an hour’s walk' : km < 6.5 ? 'about an hour’s walk' : km < 11 ? 'about two hours’ walk' : km < 18 ? 'half a day’s walk' : 'most of a day’s walk';
  if (q?.kind === 'village') return `a village of the plain, ${walk} ${b} of the Terrace`;
  if (q?.kind === 'garden') return `a house on a walled estate of gardens, ${walk} ${b} of the Terrace`;
  return `a mud-brick house in the town ${km < 0.6 ? 'at the foot of the Terrace' : `${b} of the Terrace, ${walk} from its stair`}`;
}

function jobWords(p: Person): string { return SUBS[`${p.job}/${p.sub}`] ?? JOBS[p.job] ?? p.job; }

/** a relation word from the household's own facts (mother, children, marriage flags, ages; C where it guesses a spouse) */
function relOf(pop: Population, me: Person, o: Person, members: number[]): string {
  const m = o.sex === 'm'; const sp = spouseIn(pop, me, members);
  if (o.mother === me.id || (sp >= 0 && o.mother === sp && o.age < me.age - 12)) return m ? 'son' : 'daughter';
  if (me.mother === o.id) return 'mother';
  if (sp === o.id) return m ? 'husband' : 'wife';
  if (me.mother >= 0 && me.mother === o.mother) return m ? 'brother' : 'sister';
  if (me.mother >= 0 && spouseIn(pop, pop.persons[me.mother], members) === o.id) return 'father';
  if ((o.kin || o.job === 'child') && o.age < me.age - 14 && me.age >= 16) return m ? 'son' : 'daughter';
  if ((me.kin || me.job === 'child') && o.age > me.age + 14 && o.age < me.age + 50 && !o.kin && o.job !== 'elder') return m ? 'father' : 'mother';
  if (o.job === 'elder') return m ? 'the old man of the house' : 'the old woman of the house';
  return m ? 'kinsman of the house' : 'kinswoman of the house';
}

const TEMPER = [
  ['quiet and wary of strangers', 'slow to speak, careful with words'], ['patient and dry', 'answers briefly, sometimes with a dry joke'],
  ['warm and talkative', 'likes to talk about the family and the neighbours'], ['proud of the work', 'talks about the work, exact about measures and names'],
  ['anxious', 'worries aloud about rations, weather and the sick'], ['cheerful', 'quick to laugh, teases'], ['pious', 'swears by the gods and gives thanks often'],
  ['blunt and impatient', 'short answers, wants to get back to work'], ['curious about strangers', 'asks the stranger where they come from'],
];
const OATHS: Record<string, string[]> = {
  Persian: ['by Auramazda', 'the gods willing'], Median: ['by Auramazda', 'by the gods'], Elamite: ['by Humban', 'by Napiriša'],
  Babylonian: ['by Marduk', 'by Nabû'], Syrian: ['by Hadad', 'by the gods'], Egyptian: ['by Ptah', 'by Amun'], Ionian: ['by Zeus', 'by the gods'],
  Lydian: ['by the gods'], Carian: ['by the gods'], Lycian: ['by the gods'], Bactrian: ['by the gods'], Sogdian: ['by the gods'], Thracian: ['by the gods'], Cappadocian: ['by the gods'],
};

/** the full record of person `pid` on day `day` at `hour` (the calendar's days up to `day` are computed on demand); `world`:
 *  the running simulation (D-358: means, debts, wants, bonds, rumours, trust). Without it the record has no debts at all:
 *  nothing of a person's means is invented */
export function lifeRecord(pop: Population, cal: EventCalendar, pid: number, day: number, hour: number, world?: SimView | null): LifeRecord {
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
  // the year so far (the regnal year starts at day 0, the month of Nisanu: sim facts only)
  const year: string[] = [], quarrels: string[] = [];
  const when = (d: number) => { const k = day - d; return k === 0 ? 'today' : k === 1 ? 'yesterday' : k < 8 ? `${countWords(k)} days ago` : k < 45 ? `about ${countWords(k / 7)} weeks ago` : `in the month ${MONTHS[dateOf(d).month - 1].op}`; };
  if (p.arrive > 0 && p.arrive <= day) year.push(p.job === 'herder' ? `came down into the plain with the band and the flocks ${when(p.arrive)}` : p.job === 'traveller' ? `came to Parsa on the king’s road ${when(p.arrive)}` : `came to Parsa with a newly sent work group ${when(p.arrive)}`);
  if (p.marry <= day && p.spouse !== undefined && !p.moved) year.push(`was married ${when(p.marry)} to ${spokenName(pop, p.spouse)}`);
  if (p.marry > day && p.marry < 1e8 && p.spouse !== undefined) year.push(`is to be married this year to ${spokenName(pop, p.spouse)} (the families have agreed)`);
  if (p.moved && p.marry <= day) year.push(`moved ${when(p.marry)} to kin after the death of the last grown-up of the old house`);
  for (const x of pop.childrenOf(pid)) { const c = pop.persons[x]; if (c.born >= 0 && c.born <= day) year.push(`${c.dies <= day ? 'lost' : 'had'} a ${c.sex === 'm' ? 'son' : 'daughter'}${c.dies > day ? ', ' + (spokenName(pop, x) ?? '') : ''}, born ${when(c.born)}${c.dies <= day ? `, who died ${when(c.dies)}` : ''}`); }
  for (const x of [...H.members, ...H.joins]) { const o = pop.persons[x]; if (x !== pid && o.dies <= day && o.dies >= 0 && o.born < o.dies && !(o.mother === pid && o.born >= 0)) year.push(`${spokenName(pop, x)}, ${relOf(pop, p, o, mem)}, died ${when(o.dies)}`); }
  for (let d = Math.max(0, day - 60); d <= day; d++) {
    const C = cal.ctx(d); const x = C.disputes.get(pid); if (x && (d < day || x.t <= hour)) quarrels.push(`quarrelled with ${spokenName(pop, x.other)} ${x.why} ${when(d)}`);
  }
  let sickDays = 0; for (let d = Math.max(0, day - 30); d < day; d++) if (pop.sick(pid, d)) sickDays++;
  if (sickDays) year.push(`was sick for ${sickDays === 1 ? 'a' : countWords(sickDays)} day${sickDays > 1 ? 's' : ''} in the last month`);
  if (pop.sick(pid, day)) year.push('is sick today');
  const mourn = pop.mourning(pid, day); if (mourn) year.push(`the house is in mourning (a death ${mourn === 1 ? 'yesterday' : `${countWords(mourn)} days ago`})`);
  const hear = pop.hearing(pid, day); if (hear) year.push(`must go before an official today over the quarrel with ${spokenName(pop, hear.other)} ${hear.why}`);
  if (p.group >= 0) { const sh = cal.shortfalls.filter(s => s.group === p.group && s.day <= day && s.day > day - 90); if (sh.length) year.push(`the group’s rations came short ${when(sh[sh.length - 1].day)}${sh[sh.length - 1].paidSilver ? ' and part was paid in silver' : ''}`); }
  // D-358: the house's means and obligations, from the running simulation (the seeded debts of D-296 are gone: B234's pack)
  const S = world ? standing(world, pid, day) : null; const debts = S?.debts ?? [];
  // (session 15: a member of a work group lives on the group's ration, not a house of the economy: asked of means, that is
  // what they would say, from the calendar's ration shortfalls; the market's price comes from standing)
  if (S && !S.hh && p.group >= 0) { const sh = cal.shortfalls.filter(s => s.group === p.group && s.day <= day && s.day > day - 90).pop();
    S.means.unshift(`you eat from the barley ration the tablets give your group${sh ? `; it came short ${when(sh.day)}${sh.paidSilver ? ', part paid in silver' : ''}` : ', and lately it has come in full'}`); }
  const [temper, habit] = TEMPER[Math.min(TEMPER.length - 1, Math.floor(p.trait * TEMPER.length))];
  const oaths = OATHS[p.origin] ?? ['by the gods'];
  const speech = [habit, `oath: “${oaths[Math.floor(r.next() * oaths.length)]}”`, age < 13 ? 'speaks like a child: short, plain, about play, family and food' : age > 55 ? 'speaks slowly, remembers older days under the king’s father' : r.next() < 0.5 ? 'plain speech of the town' : 'plain speech, some words of the work',
    p.job === 'official' || p.job === 'scribe' ? 'formal, uses titles' : 'addresses the stranger as “stranger” or “friend”'];
  // today (the plan is the simulation's; the reason words are its own English, out of world)
  const C = cal.ctx(day); const dt = dateOf(day); const M = MONTHS[dt.month - 1];
  const segs: Seg[] = pop.present(pid, day) ? pop.plan(pid, day) : [];
  const cur = segs.length ? segAt(segs, hour) : null; const i = cur ? segs.indexOf(cur) : -1;
  const next = i >= 0 ? segs.slice(i + 1).find(s => s.why !== cur!.why && s.act !== 'walk') ?? null : null;
  const earlier = i > 0 ? [...new Set(segs.slice(0, i).filter(s => s.act !== 'walk' && s.act !== 'sleep' && s.t1 > hour - 8).map(s => unparen(s.why)))].slice(-5) : [];
  const wx = C.wx as any; const weather = [wx.hot ? 'hot' : '', wx.stormH ? 'a storm' : '', wx.rainH ? 'rain' : '', wx.dustH ? 'dust in the air' : '', C.winter ? 'winter cold' : ''].filter(Boolean).join(', ') || 'fair';
  const events = [...new Set(C.events.filter(e => /^(E-(2[0-7]|3[1-8]|4\d|5[01]|6[0-3])|W-)/.test(e.id) || (p.job === 'guard' && /^E-8/.test(e.id))).map(e => e.text.replace(/\s*\([^)]*\)/g, '').replace(/\s*at \d{1,2}:\d{2}/g, '')))].slice(0, 6);
  if (C.festival) events.unshift('a festival day: no work for the gangs and the work groups');
  const knows = knowsFor(p, age);
  const lang = HOME_LANG[p.origin] ?? LANGS[p.origin] ?? p.origin;
  return {
    pid, seed: pop.seed, day, hour, name, sex: p.sex, age, origin: ORIGIN_WORDS[p.origin] ?? p.origin, language: lang,
    otherLanguages: [...new Set([p.origin !== 'Persian' && age >= 12 ? 'some Persian' : '', p.job === 'scribe' ? 'Elamite and Aramaic (writes them)' : '', p.group >= 0 && lang !== 'Elamite' ? 'a little Elamite (the language of the ration tablets)' : ''].filter(Boolean))],
    job: jobWords(p), work: cur?.place ?? '', group: p.group >= 0 ? pop.groups[p.group].label.replace(/\s*\(\d+\)/, '') : null,
    rank: p.job === 'guard' && p.rank === 1 ? 'leader of a file of ten' : p.rank > 1 ? 'a leader of the group' : null,
    home: homeWords(pop, hh) + (others > 0 ? ` (a household of ${all.length + 1} with the others of the ${p.job === 'herder' ? 'band' : 'group'})` : ''), zone: H.zone, household, kinHouses, friends, year, quarrels, debts, temperament: temper, speech,
    means: S?.means ?? [], needs: S?.needs ?? [], bonds: S?.bonds ?? [], rumours: S?.rumours ?? [], stranger: S?.stranger ?? [], trust: S?.trust ?? 0.5, willTalk: S?.willTalk ?? true, asks: S?.asks ?? [], dealings: S?.events ?? [],
    today: { date: `day ${dt.dom} of the month ${M.op.replace(/\s*\(\?\)/, '')} (Babylonian ${M.bab}), year 19 of King Xerxes`, season: seasonOf(C.month), weather, now: cur ? `${cur.act.replace(/_/g, ' ')}: ${unparen(cur.why)}` : 'away from Parsa', place: cur ? cur.where : 'away', next: next ? unparen(next.why) : null, earlier, events },
    knows, tier: 'C',
  };
}

/** the knowledge fence: what this person can know (by work and place; C) */
export function knowsFor(p: Person, age: number): string[] {
  const k = ['your own house, kin, neighbours and work', 'the town, the Terrace seen from below, the plain, the river Pulvar and the mountains', 'the gods of your people, the offerings and festivals', 'the months, the seasons, the harvests and the weather of this year',
    'that the king is Xerxes (Khshayarsha), son of Darius, and that this is the 19th year of his reign; the king’s father built the Terrace', 'rations of barley, wine and beer paid by the tablets; silver weighed, not counted'];
  if (age < 12) return ['your house, your mother and father, brothers and sisters, games, animals and food', 'the lane, the well and the children of the neighbours', 'a child knows little of the king or of far places'];
  if (['guard', 'official', 'scribe', 'messenger', 'caretaker'].includes(p.job)) k.push('the Terrace: its gates, stairs, halls and guard posts; who may go up and who may not');
  if (p.job === 'builder' || p.job === 'porter' || p.job === 'camp') k.push('the building of the Hall of a Hundred Columns: gangs, stone, brick, the foremen, the rations of the gangs');
  if (p.job === 'treasury' || p.job === 'scribe' || p.job === 'storekeeper') k.push('the Treasury and stores: goods, silver, seals, clay tablets in Elamite and Aramaic');
  if (p.job === 'messenger' || p.job === 'traveller' || p.job === 'groom') k.push('the king’s roads and road stations, sealed travel authorisations, Susa, Babylon, Ecbatana and the lands of the empire by hearsay');
  if (p.job === 'farmer' || p.job === 'gardener' || p.job === 'herder' || p.job === 'shepherd') k.push('fields, canals, water turns, flocks, pastures and the seasons of the plain');
  if (p.origin !== 'Persian') k.push(`the homeland of your people (${p.origin}) and how you or your parents came to Parsa`);
  return k;
}

/** the first n words (session 15: a brief ran to 470 tokens with every droppable line gone: a long home and a long "right
 *  now" are cut to their first clause or words) */
const words = (s: string, n: number) => { const w = s.trim().split(/\s+/); return w.length <= n ? s.trim() : w.slice(0, n).join(' ').replace(/[,;]$/, ''); };
const short = (s: string, n = 9) => { const t = s.split(/[:(;]/)[0].trim().split(/\s+/); return t.slice(0, n).join(' '); };
/** the record in as few words as keep it whole: the prompt the person's model reads on every answer (D-296: a long prompt
 *  is slow to read in, ~460 tokens a second on a T4, and one read of ~900 tokens hung the card past the Windows watchdog; the
 *  whole prompt stays under ~450 tokens). The events of the day that everyone shares are cut to the two nearest the person */
export function lifeBriefShort(L: LifeRecord, prose?: string | null): string {
  // "your wife Dātabāmā (28)" reads right to a small model; "Dātabāmā (wife, 28)" was misread (a 2B made a child of two a wife)
  const kin = L.household.slice(0, 4).map(k => /^kins|^the old/.test(k.rel) ? `${k.name} (${k.rel}, ${k.age})` : `your ${k.rel} ${k.name} (${k.age})`).join(', ') || 'no one: you live with your work group';
  const who = L.age < 14 ? (L.sex === 'm' ? 'boy' : 'girl') : L.sex === 'm' ? 'man' : 'woman';
  const ev = L.today.events.filter(e => !/^the gangs at work/.test(e)).slice(0, 1);
  const lines = [
    `You are ${L.name}, ${who} of ${L.age}, ${L.origin}; you speak ${L.language}.`,
    `Work: ${short(L.job, 16)}${L.rank ? `, ${L.rank}` : ''}. Home: ${words(L.home.replace(/ \(a household of.*\)$/, '').split(/, /)[0], 14)}.`,
    `In your house: ${kin}.`,
    L.friends.length ? `Friends and kin nearby: ${L.friends.slice(0, 2).map(f => `${f.name} (${f.how.split(',')[0]}${f.feeling === 'close' ? '' : '; ' + f.feeling})`).join(', ')}.` : '',
    lately(L).length ? `Lately: ${lately(L).join('; ')}.` : '',
    L.means.length ? `Means: ${L.means[0]}.` : '', // (s15: the house's own stores only; the market's price comes with a question of prices: ground.ts)
    `Manner: ${L.temperament}; ${L.speech[0]}; ${L.speech[1]}.`,
    `Today: ${L.today.date.replace(/ \(Babylonian [^)]*\), year 19 of King Xerxes/, '')}, ${L.today.season}, ${L.today.weather}.\nRight now: ${words(L.today.now.replace(/^[a-z ]+: /, ''), 12)}${L.today.next ? `; after this: ${words(L.today.next, 8)}` : ''}.${L.today.earlier.length ? ` Earlier: ${L.today.earlier.slice(-1).join('; ')}.` : ''}`,
    ev.length ? `News today: ${ev.join('; ')}.` : '',
    prose ? `Memories: ${prose}` : '',
    L.knows.length > 6 ? `You know well: ${L.knows[L.knows.length - 1]}.` : '',
  ];
  return lines.filter(Boolean).join('\n').replace(/\*(?=\p{Lu})/gu, '');
}

/** what has happened lately, most telling first: the stranger's own dealings with the house, the year's news, the house's
 *  economy (a loan, a theft, a suit), the debts, a quarrel, a want, a whisper (D-358: each from the simulation) */
function lately(L: LifeRecord): string[] {
  return [...L.stranger.slice(0, 1), ...L.year.slice(0, 2), ...L.dealings.filter(x => !L.stranger.includes(x)).slice(0, 1), ...L.debts.slice(0, 2), ...L.quarrels.slice(-1), ...L.needs.slice(0, 1), ...L.bonds.filter(b => !/^married/.test(b)).slice(0, 1), ...L.rumours.slice(0, 1)];
}
/** the full brief of the record (the bake's input, the lab's display; English, out of world) */
export function lifeBrief(L: LifeRecord, prose?: string | null): string {
  const kin = L.household.map(k => `${k.name} (${k.rel}, ${k.age}${k.job !== 'child' ? ', ' + k.job : ''})`).join('; ') || 'none: you live alone or with your work group';
  const lines = [
    `You are ${L.name}, ${L.age < 14 ? (L.sex === 'm' ? 'a boy' : 'a girl') : L.sex === 'm' ? 'a man' : 'a woman'} of ${L.age}, ${L.origin}. Your language: ${L.language}${L.otherLanguages.length ? '; also ' + L.otherLanguages.join(', ') : ''}.`,
    `Work: ${L.job}${L.group ? ` (${L.group})` : ''}${L.rank ? `, ${L.rank}` : ''}.`,
    `Home: ${L.home}. Household: ${kin}.`,
    L.kinHouses.length ? `Kin in other houses: ${L.kinHouses.join('; ')}.` : '',
    L.friends.length ? `People you know: ${L.friends.map(f => `${f.name} (${f.how}; ${f.feeling})`).join('; ')}.` : '',
    L.year.length ? `This year: ${L.year.join('; ')}.` : '',
    L.quarrels.length ? `Quarrels: ${L.quarrels.join('; ')}.` : '', L.debts.length ? `Debts: ${L.debts.join('; ')}.` : '',
    L.means.length ? `Means: ${L.means.join('; ')}.` : '', L.dealings.length ? `Lately at your house: ${L.dealings.join('; ')}.` : '', L.needs.length ? `Wants: ${L.needs.join('; ')}.` : '',
    L.bonds.length ? `Marriage: ${L.bonds.join('; ')}.` : '', L.rumours.length ? `You have heard: ${L.rumours.join('; ')}.` : '', L.stranger.length ? `With the stranger: ${L.stranger.join('; ')}.` : '',
    `Temperament: ${L.temperament}. Speech: ${L.speech.join('; ')}.`,
    `Today is ${L.today.date}; ${L.today.season}; weather: ${L.today.weather}. Now (${L.today.place}) ${L.today.now}${L.today.next ? `; next: ${L.today.next}` : ''}.`,
    L.today.earlier.length ? `Earlier today: ${L.today.earlier.join('; ')}.` : '',
    L.today.events.length ? `Happening today: ${L.today.events.join('; ')}.` : '',
    prose ? `Your own memories: ${prose}` : '',
    `You know: ${L.knows.join('; ')}.`,
  ];
  return lines.filter(Boolean).join('\n').replace(/\*(?=\p{Lu})/gu, ''); // the plan's words carry the names' reconstruction mark
}
