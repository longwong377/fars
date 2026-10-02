// D-371 (UD-07, UD-08: "every person needs ... a history"): A PAST BEFORE THIS YEAR, for everyone. The depth audit
// (tools/dev/depth_audit.ts) found the sim's people had only the current regnal year: 60 % of the sampled adults had nothing
// that had ever happened to them. This draws each person's past from the seed and binds it to what the simulation already
// says of them (their age, sex, origin, work, the household's members with their real ages, a work group's arrival, the
// zone), so a son of twelve in the house means a marriage at least thirteen years ago, and the past never contradicts the
// present. Three layers:
//   - the realm's years (A/B, the king's history, dated from year 19 of Xerxes = 467): Darius's death and Xerxes's accession
//     (486), the Egyptian revolt put down (486-484), the Babylonian risings (484), the king's war beyond the sea against the
//     Yauna (480-479), the building of the Gate of All Lands and the Hall of a Hundred Columns begun: each remembered by those
//     old enough, and lived by those it touched (the levy took men of Pārsa and Media; Babylonians and Egyptians saw their
//     own lands' risings; Ionians their cities' war);
//   - the town's years (C, one list per world seed, shared by every person of that seed, so neighbours remember the same hard
//     winter and the same bad harvest): a few hard years, a sickness, a great flood of the river, by the seed;
//   - the person's own (C, keyed by the person): where they were born, their parents' deaths, their marriage, children lost
//     young (by the period's mortality: about a third before five; C), children married away, how they came to their work,
//     one or two incidents of their own (a fall, a lawsuit, a journey, a fire, a debt), never later than the year before.
// Nothing here is after 467 or hints at what comes (the fate rule); no modern place names (places as the period named them).
import type { Population, Person } from './population';
import { h32, u01, salt } from './hash';

const S = { impair: salt('popview-impair'), kid: salt('past-kid'), sib: salt('past-sib'), born: salt('past-born'), kids: salt('past-kids'), lost: salt('past-lost'), work: salt('past-work'), inc: salt('past-inc'), town: salt('past-town'), war: salt('past-war'), par: salt('past-par'), wed: salt('past-wed') };
/** the event kinds, locked (T-E3r's anti-proxy: sequences are compared by these; never split them finer to pass) */
export const EVENT_KINDS = ['realm', 'town', 'birth', 'family', 'work', 'incident', 'loss'] as const;
export interface PastEvent { ago: number; text: string; tier: 'A' | 'B' | 'C'; kind: typeof EVENT_KINDS[number] }
export interface KinLike { pid: number; rel: string; age: number }

/** the realm's years before 467 (years ago), and who lived them (A/B: Herodotus, the Babylonian chronicles and tablets, the
 *  Persepolis building sequence; the exact year of the Babylonian risings is 484, B) */
export const REALM: { ago: number; text: string; tier: 'A' | 'B'; who: (p: Person, age: number) => boolean; lived?: (p: Person) => string | null }[] = [
  { ago: 19, tier: 'A', text: 'the death of the old king Dārayavauš and the accession of Xšayāršā', who: (_p, a) => a >= 26 },
  { ago: 18, tier: 'B', text: 'the rising in Egypt put down by the king\'s brother', who: (p, a) => a >= 28 && (p.origin === 'Egyptian' || p.job === 'guard'),
    lived: p => p.origin === 'Egyptian' ? 'the soldiers coming through the towns of the river after the rising in Egypt' : null },
  { ago: 17, tier: 'B', text: 'the risings in Babylon and the king\'s anger at the city', who: (p, a) => a >= 26 && (p.origin === 'Babylonian' || p.origin === 'Syrian' || p.job === 'scribe' || p.job === 'official'),
    lived: p => p.origin === 'Babylonian' ? 'the siege and the fall of Babylon after the rising; the temple\'s houses broken up' : null },
  { ago: 13, tier: 'A', text: 'the king\'s great march to the Yauna beyond the sea', who: (_p, a) => a >= 22 },
  { ago: 12, tier: 'A', text: 'the army coming back from the war beyond the sea, fewer than went', who: (_p, a) => a >= 22 },
];
const BIRTHPLACE: Record<string, string[]> = {
  Persian: ['a village of the plain here', 'a village up the valley of the river Pulvar', 'a village by the lake of the salt marsh', 'Anšan, the old royal town to the west', 'a herders\' camp in the hills of Pārsa'],
  Median: ['Hagmatāna in Media', 'a village of the Median uplands', 'the road towns of Media'], Elamite: ['Šušan', 'a village of the Elamite lowlands', 'Hidali in the hills between Šušan and Pārsa'],
  Babylonian: ['Babylon', 'Borsippa', 'Sippar', 'a village on a canal of the Babylonian country'], Syrian: ['Damascus', 'a town of the Syrian coast', 'Arpad'],
  Egyptian: ['Memphis', 'Saïs in the Delta', 'a village of Upper Egypt'], Ionian: ['Miletus', 'Ephesus', 'Samos', 'a town of Ionia on the sea'],
  Lydian: ['Sardis'], Carian: ['a town of Caria'], Lycian: ['a town of Lycia'], Thracian: ['Thrace beyond the straits'], Cappadocian: ['the uplands of Cappadocia'],
  Bactrian: ['Bactra'], Sogdian: ['the Sogdian country'], Indian: ['the land of the Indus'],
};
const TOWN_YEARS = ['a hard winter when the snow lay in the plain for a month and the lambs died', 'a year the barley failed and the stores were opened', 'the spring the river broke its banks and took the fields by the ford',
  'a summer of sickness in the town, when many children died', 'a year of locusts on the plain', 'a great fire in the lanes of the town', 'a year so good the barley lay in heaps unsold'];
const INCIDENTS: Record<string, string[]> = {
  farmer: ['lost an ox to sickness and ploughed with a borrowed one that year', 'went to law with a neighbour over the line of a field', 'a dispute over the water turn on the channel'],
  builder: ['broke an arm when a block slipped at the quarry', 'was moved from the brick gang to the stone gang'], guard: ['stood in the king\'s guard on the road to Šušan', 'was fined for sleeping on watch'],
  craftsman: ['lost a whole kiln-load in a storm', 'took a boy as an apprentice'], homemaker: ['nursed a sister\'s child through a winter', 'kept the house alone a season while the men were away'],
  scribe: ['was sent to Šušan with a load of tablets', 'learned the Aramaic letters as well as the Elamite signs'], official: ['went with the court to Šušan for a winter', 'was praised by a superior for an account kept true'],
  porter: ['carried for a caravan as far as Šušan', 'hurt his back under a sack and was a month mending'], shepherd: ['lost part of a flock to wolves in a hard winter', 'took the flocks to the summer pastures in the hills'],
  any: ['made the journey to the king\'s town of Šušan once', 'fell sick with a fever that nearly took them', 'quarrelled with a brother over their father\'s goods', 'borrowed silver in a bad year and was years paying it back', 'saw the king pass on the road'],
};
const WORK: Record<string, (p: Person, own: number) => string | null> = {
  farmer: (p) => p.sex === 'm' ? 'has worked the family\'s fields since boyhood; the land came down from the father' : null,
  builder: (_p, o) => `came to the building gangs ${o} years ago`, guard: (_p, o) => `has served in the garrison of the Terrace for ${o} years`,
  scribe: () => 'learned the signs from a scribe, as a boy at the desk', craftsman: (p) => `learned the craft as a boy from ${p.persian ? 'a kinsman' : 'the master of a workshop'}`,
  porter: (_p, o) => `has carried loads for the stores for ${o} years`, official: (_p, o) => `has held office in the administration for ${o} years`,
  shepherd: () => 'has followed the flocks since childhood', herder: () => 'has driven the band\'s flocks through the plain every year of life',
  treasury: (_p, o) => `came to the Treasury\'s work ${o} years ago`, weaver: (_p, o) => `has woven in the work group for ${o} years`,
  homemaker: () => null, child: () => null, elder: () => null,
};
/** the jobs of the king's works at Pārsa itself: begun only after coming to Pārsa (D-390) */
const PARSA_WORK = new Set(['builder', 'guard', 'porter', 'official', 'treasury', 'weaver']);
/** popview's lasting lameness (IMPAIR.lame, D-215), mirrored here so the draw stays the same; the census checks they agree */
const LAME = { share: 0.006, ages: [22, 60] as [number, number] };
const LAMED = ['was lamed for life when a wall he was raising came down on his leg', 'was lamed for life by a fall from a roof', 'was lamed for life when an ox trampled him at the threshing', 'was lamed for life when a loaded cart went over his foot'];
const CHILDHOOD = ['was lost a whole afternoon in the lanes and found by a neighbour', 'was bitten by a dog in the lane', 'had a fever one winter', 'saw the king\'s horses go up to the Terrace',
  'fell from the roof and cut the head open', 'was scalded at the hearth and carries the mark', 'had a tooth knocked out at play', 'followed a caravan out past the last houses and was fetched back',
  'nearly drowned in the channel and was pulled out by an older child', 'found a lost kid of the flock in the hills', 'was stung by a scorpion under a stone', 'broke a jar of oil and was beaten for it'];
const FIRST_TASK = { m: [['mind the goats with the older boys', 'scare the birds off the sown fields', 'carry water to the men in the fields'], ['run errands to the market for the house', 'fetch water from the well', 'carry bread to the father at work']],
  f: [['carry water from the well in a small jar', 'gather dung for the hearth', 'mind the little ones while the mother worked'], ['help at the quern', 'fetch water from the well', 'spin with a small spindle']] };
const SIBLING: [string, PastEvent['kind']][] = [['a sister was married into a house of another village', 'family'], ['a brother went away with a work group and was not seen again', 'loss'], ['a brother died of a fever', 'loss'],
  ['a sister died in childbirth', 'loss'], ['a brother was married, and the families feasted', 'family'], ['a sister came home widowed with her children', 'family']];
/** the husband of a woman in the population, when he lives in her house (mirrors life.ts spouseIn) */
function husbandOf(pop: Population, w: number, day: number): number {
  const me = pop.persons[w], H = pop.households[pop.home(w, day)]; if (!H) return -1; const mem = H.members.filter(x => pop.home(x, day) === H.id && pop.persons[x].dies > day);
  if (me.spouse !== undefined && mem.includes(me.spouse)) return me.spouse; if (me.kin || me.age < 16 || !me.wife) return -1;
  const c = mem.filter(x => { const o = pop.persons[x]; return x !== w && o.sex === 'm' && o.age >= 16 && !o.kin && o.mother !== w && me.mother !== x && Math.abs(o.age - me.age) < 22; }); return c.length ? c[0] : -1;
}
const pick = <T>(xs: T[], u: number) => xs[Math.min(xs.length - 1, Math.floor(u * xs.length))];

/** the town's own remembered years for a world seed (C): 3 of them in the last 30 years, one in each third (D-390: never two in
 *  one year, nor all three in the last few) */
export function townYears(seed: number): { ago: number; text: string }[] {
  const out: { ago: number; text: string }[] = [], used = new Set<number>();
  for (let k = 0; out.length < 3 && k < 12; k++) { const i = h32(seed, S.town, k) % TOWN_YEARS.length; if (used.has(i)) continue; used.add(i); out.push({ ago: 2 + 9 * out.length + (h32(seed, S.town, k, 1) % 9), text: TOWN_YEARS[i] }); }
  return out.sort((a, b) => a.ago - b.ago);
}

/** a person's past before this year (oldest first), consistent with their household as the simulation has it */
export function pastOf(pop: Population, pid: number, day: number, kin: KinLike[] = []): PastEvent[] {
  const p = pop.persons[pid], age = pop.ageOn(pid, day), seed = pop.seed, u = (k: number, s = S.born) => u01(seed, s, pid, k);
  if (age < 3) return [];
  const out: PastEvent[] = [];
  // birth
  const places = BIRTHPLACE[p.origin] ?? ['a land far to the west']; const here = p.persian && p.zone !== 'transient' && u(1) < 0.6;
  out.push({ ago: age, text: here ? `born ${p.zone === 'plain' ? 'in this village' : 'in the town below the Terrace'}` : `born in ${pick(places, u(2))}`, tier: 'C', kind: 'birth' });
  // how they came here (a work group's, a traveller's arrival: the sim's own day when it is this year)
  let arrived = Infinity;
  if (!here && p.group >= 0 && p.arrive <= 0 && age >= 16) { const yrs = arrived = 1 + Math.floor(u(3) * Math.min(15, age - 14)); out.push({ ago: yrs, text: `came to Pārsa with a work group sent from ${pick(places, u(2))}`, tier: 'C', kind: 'work' }); }
  else if (!here && p.zone !== 'transient' && age >= 18 && p.arrive <= 0) { const yrs = arrived = 1 + Math.floor(u(4) * Math.min(25, age - 15)); out.push({ ago: yrs, text: p.persian ? 'moved down to Pārsa from the family\'s old village' : 'came to Pārsa for the king\'s work and stayed', tier: 'C', kind: 'work' }); }
  // parents: in the house (the sim's own), else dead or far (C: by age)
  const mother = kin.find(k => k.rel === 'mother'), father = kin.find(k => k.rel === 'father');
  // (keyed by the mother, so brothers and sisters remember the same deaths in the same years; by the eldest of them for the odds)
  // (D-390: a mother in the population was alive when the year began, and so is a father living with her: neither died before
  // it; a parent's death is never before the birth of the youngest of the mother's children, a father's at most a year before)
  const sibs = p.mother >= 0 ? pop.childrenOf(p.mother).filter(c => pop.persons[c].born <= day).map(c => pop.ageOn(c, day)) : [];
  const pk = p.mother >= 0 ? 7_000_000 + p.mother : pid, eldest = Math.max(age, ...sibs), youngest = Math.min(age, ...sibs);
  const fatherLives = p.mother >= 0 && husbandOf(pop, p.mother, day) >= 0;
  if (age >= 20) for (const [rel, inHouse, k] of [['father', !!father || fatherLives, 5], ['mother', !!mother || p.mother >= 0, 6]] as const) {
    if (inHouse) continue; const alive = u01(seed, S.par, pk, k) < Math.max(0, 0.9 - eldest / 70);
    if (!alive) { const ago = Math.max(1, Math.floor(u01(seed, S.par, pk, k + 10) * Math.min(eldest - 10, 30, youngest + (rel === 'father' ? 1 : 0)))); if (ago < age) out.push({ ago, text: `${rel === 'father' ? 'the father' : 'the mother'} died`, tier: 'C', kind: 'loss' }); }
  }
  // marriage and children: from the house's real children (their ages bind the marriage), plus children lost young and grown children married away
  const spouse = kin.find(k => k.rel === 'wife' || k.rel === 'husband');
  const kids = kin.filter(k => k.rel === 'son' || k.rel === 'daughter').sort((a, b) => b.age - a.age);
  if (spouse && age >= 18) {
    // (the couple's one marriage and its losses: keyed by the pair, bound by the younger's age, so husband and wife tell the same)
    const ck = Math.min(pid, spouse.pid), uc = (k: number, s: number) => u01(seed, s, ck, k);
    // (the couple's children counted the same from either side: members of the house who are the wife's, or of the children's
    // generation, at least fourteen years younger than the younger of the two)
    // (D-390: the same children from either side: every child either spouse counts as a son or daughter of the house, so the
    // couple's marriage is one year; when the eldest is too old for the younger spouse to be a parent, a second marriage)
    const wife = p.sex === 'f' ? pid : spouse.pid, young = Math.min(age, spouse.age), hid = pop.home(pid, day), H = pop.households[hid], olderP = Math.max(p.age, pop.persons[spouse.pid].age);
    const coupleKids = [...new Set([...(H?.members ?? []), ...(H?.joins ?? [])])].filter(m => { const o = pop.persons[m]; return m !== pid && m !== spouse.pid && pop.home(m, day) === hid && o.born <= day && o.dies > day && o.arrive <= day && (o.mother === wife || ((!!o.kin || o.job === 'child') && o.age <= olderP - 13)); }).map(m => pop.ageOn(m, day));
    const eldestKid = Math.max(-1, ...coupleKids, ...kids.map(k => k.age)), again = eldestKid + 1 > young - 14;
    const minYrs = eldestKid >= 0 && !again ? eldestKid + 1 : 0, maxYrs = Math.max(minYrs, young - 17);
    const wed = again ? Math.max(1, Math.min(young - 16, 1 + Math.floor(uc(1, S.wed) * Math.max(1, young - 17)))) : Math.max(minYrs, Math.min(maxYrs, minYrs + Math.floor(uc(1, S.wed) * 4)));
    if (wed > 0) out.push({ ago: wed, text: again ? 'married again, after a first marriage ended in a death, and the children came into one house' : `married ${spouse.rel === 'wife' ? 'his wife' : 'her husband'}`, tier: 'C', kind: 'family' });
    for (const c of kids) if (c.age < wed) out.push({ ago: c.age, text: `a ${c.rel} was born`, tier: 'C', kind: 'family' });
    // children lost young: about a third of births before five (C); one or two remembered
    const span = Math.max(0, wed - 1), lost = span >= 2 ? Math.min(3, Math.floor(uc(1, S.lost) * (1 + span / 6))) : 0;
    for (let i = 0; i < lost; i++) { const ago = 1 + Math.floor(uc(10 + i, S.lost) * span); out.push({ ago, text: `lost a ${uc(20 + i, S.lost) < 0.5 ? 'son' : 'daughter'} in ${uc(30 + i, S.lost) < 0.5 ? 'the first year' : 'early childhood'}`, tier: 'C', kind: 'loss' }); }
    // grown children married away (the older parents of the house; C)
    if (Math.min(age, spouse.age) >= 38 && wed >= 20) { const n = 1 + Math.floor(uc(2, S.kids) * 3); for (let i = 0; i < n; i++) { const yrs = Math.max(1, Math.floor(uc(3 + i, S.kids) * (wed - 18))); out.push({ ago: yrs, text: `married off a ${uc(9 + i, S.kids) < 0.5 ? 'daughter to a house of the quarter' : 'son, who set up his own house'}`, tier: 'C', kind: 'family' }); } }
  } else if (!spouse && age >= 30 && p.sex === 'f' && u(5, S.wed) < 0.6) out.push({ ago: Math.max(1, Math.floor(u(6, S.wed) * (age - 20))), text: 'was widowed', tier: 'C', kind: 'loss' });
  // work
  const own = Math.max(1, Math.min(age - 14, PARSA_WORK.has(p.job) ? arrived : Infinity, 1 + Math.floor(u(1, S.work) * 20)));
  if (age >= 16) { const w = (WORK[p.job] ?? (() => null))(p, own); if (w) out.push({ ago: own, text: w, tier: 'C', kind: 'work' }); }
  // the realm's years, as lived or remembered
  for (const R of REALM) { if (!R.who(p, age)) continue; const lived = R.lived?.(p) ?? null;
    if (R.ago === 13 && p.sex === 'm' && age >= 30 && age <= 60 && (p.origin === 'Persian' || p.origin === 'Median') && u(1, S.war) < 0.35) {
      out.push({ ago: 13, text: 'marched with the levy in the king\'s war beyond the sea, and came home', tier: 'C', kind: 'realm' }); continue; }
    if (R.ago === 12 && age >= 30 && (p.origin === 'Persian' || p.origin === 'Median') && u(2, S.war) < 0.2) { out.push({ ago: 12, text: `a ${u(3, S.war) < 0.5 ? 'brother' : 'kinsman'} did not come back from the war beyond the sea`, tier: 'C', kind: 'loss' }); continue; }
    out.push({ ago: R.ago, text: lived ?? `remembers ${R.text}`, tier: lived ? 'C' : R.tier, kind: 'realm' }); }
  // the town's years (shared by the seed), for those who lived here then
  const local = here || p.zone === 'plain' || p.zone === 'town';
  if (local) for (const T of townYears(seed)) if (T.ago < age - 4) out.push({ ago: T.ago, text: `lived through ${T.text}`, tier: 'C', kind: 'town' });
  // one or two incidents of their own
  // (D-390: one to three, by the person, at their own years: the four most recent events of two people rarely the same kinds)
  if (age >= 16) { const pool = [...(INCIDENTS[p.job] ?? []), ...INCIDENTS.any], n = 1 + (u(1, S.inc) < 0.5 ? 1 : 0) + (age >= 28 && u(8, S.inc) < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) out.push({ ago: 1 + Math.floor(u(2 + i, S.inc) * Math.min(20, age - 15)), text: pick(pool, u(5 + i, S.inc)), tier: 'C', kind: 'incident' }); }
  // D-390: a lasting lameness the street shows (popview impairOf, D-215: the same draw) has its cause in the past
  if (p.sex === 'm' && p.agent < 0 && p.job !== 'guard' && p.job !== 'messenger' && age >= LAME.ages[0] && age <= LAME.ages[1] && h32(seed, S.impair, pid) / 4294967296 < LAME.share)
    out.push({ ago: 1 + Math.floor(u(1, S.kid) * (age - 17)), text: pick(LAMED, u(2, S.kid)), tier: 'C', kind: 'incident' });
  // D-390: a childhood of one's own (everyone of six and over remembers one thing of it; a child more): weaned, the younger
  // brothers and sisters born (the population's own, by the mother), the first tasks, the scrapes
  if (age >= 3 && age < 16) { const wean = 2 + (u(3, S.kid) < 0.5 ? 1 : 0); if (age - wean >= 1) out.push({ ago: age - wean, text: 'was weaned from the breast', tier: 'C', kind: 'family' }); }
  if (age >= 6) { const at = 3 + Math.floor(u(4, S.kid) * Math.min(9, age - 4)); out.push({ ago: Math.max(1, age - at), text: pick(CHILDHOOD, u(5, S.kid)), tier: 'C', kind: 'incident' }); }
  if (age >= 3 && age < 16) { out.push({ ago: age - 1, text: pick(['took the first steps', 'walked before the first year was out', 'was slow to walk, and the mother feared for it'], u(11, S.kid)), tier: 'C', kind: 'family' });
    out.push({ ago: 1 + Math.floor(u(7, S.kid) * Math.min(age - 2, 6)), text: pick(CHILDHOOD, u(8, S.kid)), tier: 'C', kind: 'incident' }); }
  if (age >= 7) { const first = 5 + Math.floor(u(9, S.kid) * 3), task = pick((p.sex === 'm' ? FIRST_TASK.m : FIRST_TASK.f)[p.zone === 'plain' ? 0 : 1], u(10, S.kid)); if (age - first >= 1) out.push({ ago: age - first, text: `began to ${task}`, tier: 'C', kind: 'work' }); }
  if (p.mother >= 0) for (const c of pop.childrenOf(p.mother)) { const ca = pop.persons[c].born <= day ? pop.ageOn(c, day) : -1; if (c !== pid && ca >= 1 && ca < age) out.push({ ago: ca, text: `a ${pop.persons[c].sex === 'm' ? 'brother' : 'sister'} was born`, tier: 'C', kind: 'family' }); }
  else if (age >= 18) { const n = Math.floor(u(1, S.sib) * 3); for (let i = 0; i < n; i++) { const e = pick(SIBLING, u(2 + i, S.sib)); out.push({ ago: 1 + Math.floor(u(5 + i, S.sib) * Math.min(25, age - 15)), text: e[0], tier: 'C', kind: e[1] }); } }
  return out.filter(e => e.ago >= 1 && e.ago <= age).sort((a, b) => b.ago - a.ago);
}

/** the past in words, most telling first (losses, the war, marriage, then the rest), for the life record */
export function pastWords(evs: PastEvent[], n = 4): string[] {
  const rank: Record<PastEvent['kind'], number> = { loss: 0, realm: 1, family: 2, town: 3, incident: 4, work: 5, birth: 6 };
  const yrs = (a: number) => a === 1 ? 'last year' : `${a} years ago`;
  // (the birth first: "where are you from" is answered from it; then the most telling)
  const birth = evs.filter(e => e.kind === 'birth'), rest = evs.filter(e => e.kind !== 'birth').sort((a, b) => rank[a.kind] - rank[b.kind] || a.ago - b.ago);
  return [...birth, ...rest].slice(0, n).map(e => e.kind === 'birth' ? e.text : `${e.text}, ${yrs(e.ago)}`);
}
