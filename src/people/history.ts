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

const S = { born: salt('past-born'), kids: salt('past-kids'), lost: salt('past-lost'), work: salt('past-work'), inc: salt('past-inc'), town: salt('past-town'), war: salt('past-war'), par: salt('past-par'), wed: salt('past-wed') };
export interface PastEvent { ago: number; text: string; tier: 'A' | 'B' | 'C'; kind: 'realm' | 'town' | 'birth' | 'family' | 'work' | 'incident' | 'loss' }
export interface KinLike { pid: number; rel: string; age: number }

/** the realm's years before 467 (years ago), and who lived them (A/B: Herodotus, the Babylonian chronicles and tablets, the
 *  Persepolis building sequence; the exact year of the Babylonian risings is 484, B) */
const REALM: { ago: number; text: string; tier: 'A' | 'B'; who: (p: Person, age: number) => boolean; lived?: (p: Person) => string | null }[] = [
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
const pick = <T>(xs: T[], u: number) => xs[Math.min(xs.length - 1, Math.floor(u * xs.length))];

/** the town's own remembered years for a world seed (C): 3 of them in the last 30 years */
export function townYears(seed: number): { ago: number; text: string }[] {
  const out: { ago: number; text: string }[] = [], used = new Set<number>();
  for (let k = 0; out.length < 3 && k < 12; k++) { const i = h32(seed, S.town, k) % TOWN_YEARS.length; if (used.has(i)) continue; used.add(i); out.push({ ago: 2 + (h32(seed, S.town, k, 1) % 28), text: TOWN_YEARS[i] }); }
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
  if (!here && p.group >= 0 && p.arrive <= 0 && age >= 16) { const yrs = 1 + Math.floor(u(3) * Math.min(15, age - 14)); out.push({ ago: yrs, text: `came to Pārsa with a work group sent from ${pick(places, u(2))}`, tier: 'C', kind: 'work' }); }
  else if (!here && p.zone !== 'transient' && age >= 18 && p.arrive <= 0) { const yrs = 1 + Math.floor(u(4) * Math.min(25, age - 15)); out.push({ ago: yrs, text: p.persian ? 'moved down to Pārsa from the family\'s old village' : 'came to Pārsa for the king\'s work and stayed', tier: 'C', kind: 'work' }); }
  // parents: in the house (the sim's own), else dead or far (C: by age)
  const mother = kin.find(k => k.rel === 'mother'), father = kin.find(k => k.rel === 'father');
  if (age >= 20) for (const [rel, inHouse, k] of [['father', !!father, 5], ['mother', !!mother, 6]] as const) {
    if (inHouse) continue; const alive = u(k, S.par) < Math.max(0, 0.9 - age / 70);
    if (!alive) { const ago = Math.max(1, Math.floor(u(k + 10, S.par) * Math.min(age - 10, 30))); out.push({ ago, text: `${rel === 'father' ? 'the father' : 'the mother'} died`, tier: 'C', kind: 'loss' }); }
  }
  // marriage and children: from the house's real children (their ages bind the marriage), plus children lost young and grown children married away
  const spouse = kin.find(k => k.rel === 'wife' || k.rel === 'husband');
  const kids = kin.filter(k => k.rel === 'son' || k.rel === 'daughter').sort((a, b) => b.age - a.age);
  if (spouse && age >= 18) {
    const minYrs = kids.length ? kids[0].age + 1 : 0, maxYrs = Math.max(minYrs, age - 17);
    const wed = Math.max(minYrs, Math.min(maxYrs, minYrs + Math.floor(u(1, S.wed) * 4)));
    if (wed > 0) out.push({ ago: wed, text: `married ${spouse.rel === 'wife' ? 'his wife' : 'her husband'}`, tier: 'C', kind: 'family' });
    for (const c of kids) if (c.age < wed) out.push({ ago: c.age, text: `a ${c.rel} was born`, tier: 'C', kind: 'family' });
    // children lost young: about a third of births before five (C); one or two remembered
    const span = Math.max(0, wed - 1), lost = span >= 2 ? Math.min(3, Math.floor(u(1, S.lost) * (1 + span / 6))) : 0;
    for (let i = 0; i < lost; i++) { const ago = 1 + Math.floor(u(10 + i, S.lost) * span); out.push({ ago, text: `lost a ${u(20 + i, S.lost) < 0.5 ? 'son' : 'daughter'} in ${u(30 + i, S.lost) < 0.5 ? 'the first year' : 'early childhood'}`, tier: 'C', kind: 'loss' }); }
    // grown children married away (the older parents of the house; C)
    if (age >= 40 && wed >= 20) { const n = 1 + Math.floor(u(2, S.kids) * 3); for (let i = 0; i < n; i++) { const yrs = Math.max(1, Math.floor(u(3 + i, S.kids) * (wed - 18))); out.push({ ago: yrs, text: `married off a ${u(9 + i, S.kids) < 0.5 ? 'daughter to a house of the quarter' : 'son, who set up his own house'}`, tier: 'C', kind: 'family' }); } }
  } else if (!spouse && age >= 30 && p.sex === 'f' && u(5, S.wed) < 0.6) out.push({ ago: Math.max(1, Math.floor(u(6, S.wed) * (age - 20))), text: 'was widowed', tier: 'C', kind: 'loss' });
  // work
  const own = Math.max(1, Math.min(age - 14, 1 + Math.floor(u(1, S.work) * 20)));
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
  if (age >= 16) { const pool = [...(INCIDENTS[p.job] ?? []), ...INCIDENTS.any], n = 1 + (u(1, S.inc) < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) out.push({ ago: 1 + Math.floor(u(2 + i, S.inc) * Math.min(20, age - 15)), text: pick(pool, u(5 + i, S.inc)), tier: 'C', kind: 'incident' }); }
  // children: a little of their own
  if (age < 16 && age >= 6) out.push({ ago: Math.max(1, Math.floor(u(1, S.inc) * (age - 4))), text: pick(['was lost a whole afternoon in the lanes and found by a neighbour', 'was bitten by a dog in the lane', 'had a fever one winter', 'saw the king\'s horses go up to the Terrace'], u(2, S.inc)), tier: 'C', kind: 'incident' });
  return out.filter(e => e.ago >= 1 && e.ago <= age).sort((a, b) => b.ago - a.ago);
}

/** the past in words, most telling first (losses, the war, marriage, then the rest), for the life record */
export function pastWords(evs: PastEvent[], n = 4): string[] {
  const rank: Record<PastEvent['kind'], number> = { loss: 0, realm: 1, family: 2, town: 3, incident: 4, work: 5, birth: 6 };
  const yrs = (a: number) => a === 1 ? 'last year' : `${a} years ago`;
  return [...evs].sort((a, b) => rank[a.kind] - rank[b.kind] || a.ago - b.ago).slice(0, n).map(e => e.kind === 'birth' ? e.text : `${e.text}, ${yrs(e.ago)}`);
}
