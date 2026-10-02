// D-390 (UD-08: "nothing fake, nothing copy pasted ... every person needs a home and a life and a family ... and a name and a
// history"): THE PERSON CENSUS, the tool gates/thresholds.json names for T-E2, T-E2h, T-E3, T-E3r and T-E3v. It measures the
// whole population of a seed on a day (every person present), not chosen people:
//   T-E2  the largest share of one name (compared by root) in a (sex, origin) group of over 2,000 people, each group's top
//         names reported with whether the name is attested (names.json) or recalled from the literature (names_recalled.json);
//   T-E2h living members of one household (present on the day, same house) sharing a name by root (diacritics, the leading
//         asterisk, doubled letters and case removed; two names one letter apart count as one). No practice is exempted: the
//         population holds no paternal grandfather links, so papponymy cannot be told from a clash (stricter than the line);
//   T-E3  people with >= 5 history events (history.ts pastOf, plus this year's from the simulation's own facts) and none
//         inconsistent with their age, their kin or the archive's dates (the rules below, each counted by name);
//   T-E3r pairs of people (among those with four events or more before this year) whose four most recent events before this
//         year, oldest first, are the same sequence of event kinds (history.ts EVENT_KINDS, the locked list);
//   T-E3v people showing a trace of their history a walker can see or hear, on a seeded sample: the "Before this year" line
//         surviving into the talk prompt (heard when spoken to), mourning dress (the wardrobe's mourning set), a limp from a
//         hurt (popview impairOf: injuryOn, or the lasting lameness, which history.ts now gives a cause). Reported apart: the
//         share shown UNPROMPTED (seen without speaking), since a conversation is a trace only for the one who asks.
// It writes no evidence file (the coverage board is generated from those); tests/person_census.test.ts prints the values.
// CLI: npx tsx tools/dev/person_census.ts [seed] [day]
import type { Population, Person } from '../../src/people/population';
import { ALL_NAMES } from '../../src/people/population';
import namesData from '../../src/data/names.json';
import { pastOf, townYears, REALM, EVENT_KINDS, type PastEvent, type KinLike } from '../../src/people/history';
import { IMPAIR } from '../../src/people/popview';
import { h32, u01, salt } from '../../src/people/hash';

// ------------------------------------------------------------------ names
const ATTESTED = new Set<string>((namesData as any).names.map((n: any) => n.name));
/** a name's root: no diacritics, no asterisk (reconstructed form), no doubled letters, lower case, letters only */
export function nameRoot(n: string): string {
  return n.replace(/^\*/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
}
/** two roots the same, or one letter apart (substitution, insertion or deletion) */
export function sameRoot(a: string, b: string): boolean {
  if (a === b) return true; if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 3) return false;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

export interface NameCensus { groups: { key: string; n: number; unnamed: number; top: { name: string; share: number; attested: boolean }[] }[]; worst: number; worstGroup: string; sameHouse: number; sameHouseByRel: Record<string, number>; examples: string[] }
export function nameCensus(pop: Population, day: number): NameCensus {
  const present = pop.persons.filter(p => pop.present(p.id, day) && p.dies > day);
  const byG = new Map<string, Person[]>(); for (const p of present) { const k = `${p.sex}:${p.origin}`; (byG.get(k) ?? byG.set(k, []).get(k)!).push(p); }
  const groups: NameCensus['groups'] = []; let worst = 0, worstGroup = '';
  for (const [key, ps] of byG) {
    if (ps.length <= 2000) continue; const c = new Map<string, { n: number; name: string }>(); let unnamed = 0;
    for (const p of ps) { const nm = pop.nameOf(p.id); if (!nm) { unnamed++; continue; } const r = nameRoot(nm); const x = c.get(r) ?? c.set(r, { n: 0, name: nm.replace(/^\*/, '') }).get(r)!; x.n++; }
    const top = [...c.values()].sort((a, b) => b.n - a.n).slice(0, 5).map(x => ({ name: x.name, share: x.n / ps.length, attested: ATTESTED.has(x.name) }));
    groups.push({ key, n: ps.length, unnamed, top }); if ((top[0]?.share ?? 0) > worst) { worst = top[0].share; worstGroup = key; }
  }
  // living household members sharing a name (by root)
  let sameHouse = 0; const sameHouseByRel: Record<string, number> = {}, examples: string[] = [];
  const homes = new Map<number, number[]>(); for (const p of present) { const h = pop.home(p.id, day); (homes.get(h) ?? homes.set(h, []).get(h)!).push(p.id); }
  for (const [h, ms] of homes) {
    const named = ms.map(m => ({ m, n: pop.nameOf(m) })).filter(x => x.n).map(x => ({ ...x, r: nameRoot(x.n!) }));
    for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) if (sameRoot(named[i].r, named[j].r)) {
      sameHouse++; const a = pop.persons[named[i].m], b = pop.persons[named[j].m];
      const rel = a.mother === b.id || b.mother === a.id ? 'mother-child' : a.mother >= 0 && a.mother === b.mother ? 'siblings' : pop.households[h].zone === 'terrace' || a.group >= 0 ? 'work group' : 'other';
      sameHouseByRel[rel] = (sameHouseByRel[rel] ?? 0) + 1; if (examples.length < 6) examples.push(`${pop.households[h].zone} house ${h}: ${named[i].n} / ${named[j].n} (${rel})`);
    }
  }
  return { groups: groups.sort((a, b) => b.n - a.n), worst, worstGroup, sameHouse, sameHouseByRel, examples };
}

// ------------------------------------------------------------------ kin (mirrors converse/life.ts relOf, which is private there)
function spouseIn(pop: Population, me: Person, members: number[]): number {
  if (me.spouse !== undefined && members.includes(me.spouse)) return me.spouse;
  if (me.kin || me.age < 16) return -1;
  const c = members.filter(x => { const o = pop.persons[x]; return x !== me.id && o.sex !== me.sex && o.age >= 16 && !o.kin && o.mother !== me.id && me.mother !== x && Math.abs(o.age - me.age) < 22 && (me.sex === 'f' ? me.wife : o.wife); });
  return c.length ? c.sort((a, b) => Math.abs(pop.persons[a].age - me.age) - Math.abs(pop.persons[b].age - me.age))[0] : -1;
}
function relOf(pop: Population, me: Person, o: Person, members: number[]): string {
  const m = o.sex === 'm'; const sp = spouseIn(pop, me, members);
  if (o.mother === me.id || (sp >= 0 && o.mother === sp && o.age < me.age - 12)) return m ? 'son' : 'daughter';
  if (me.mother === o.id) return 'mother';
  if (sp === o.id) return m ? 'husband' : 'wife';
  if (me.mother >= 0 && me.mother === o.mother) return m ? 'brother' : 'sister';
  if (me.mother >= 0 && spouseIn(pop, pop.persons[me.mother], members) === o.id) return 'father';
  if ((o.kin || o.job === 'child') && o.age < me.age - 14 && me.age >= 16) return m ? 'son' : 'daughter';
  if ((me.kin || me.job === 'child') && o.age > me.age + 14 && o.age < me.age + 50 && !o.kin && o.job !== 'elder') return m ? 'father' : 'mother';
  return 'other';
}
/** the household as life.ts gives it to pastOf (members living in the house on the day, with their relation and age) */
export function kinOf(pop: Population, pid: number, day: number): KinLike[] {
  const p = pop.persons[pid], hh = pop.home(pid, day), H = pop.households[hh];
  const mem = [...new Set([...H.members, ...H.joins])].filter(x => pop.home(x, day) === hh);
  return mem.filter(x => x !== pid && pop.persons[x].born <= day && pop.persons[x].dies > day && pop.persons[x].arrive <= day).map(x => ({ pid: x, rel: relOf(pop, p, pop.persons[x], mem), age: pop.ageOn(x, day) }));
}

// ------------------------------------------------------------------ history: events and their consistency
/** this year's events from the simulation's own facts (life.ts lifeRecord `year`, without the economy's dealings), ago 0 */
export function yearEvents(pop: Population, pid: number, day: number): PastEvent[] {
  const p = pop.persons[pid], out: PastEvent[] = [], H = pop.households[pop.home(pid, day)];
  const ev = (kind: PastEvent['kind'], text: string) => out.push({ ago: 0, text, tier: 'C', kind });
  if (p.arrive > 0 && p.arrive <= day) ev('work', 'came to Pārsa this year');
  if (p.marry <= day && p.spouse !== undefined && !p.moved) ev('family', 'was married this year');
  if (p.moved && p.marry <= day) ev('loss', 'moved to kin after a death');
  for (const x of pop.childrenOf(pid)) { const c = pop.persons[x]; if (c.born >= 0 && c.born <= day) ev(c.dies <= day ? 'loss' : 'family', c.dies <= day ? 'lost a child born this year' : 'a child born this year'); }
  for (const x of [...H.members, ...H.joins]) { const o = pop.persons[x]; if (x !== pid && o.dies <= day && o.dies >= 0 && o.born < o.dies && !(o.mother === pid && o.born >= 0)) ev('loss', 'a death in the house this year'); }
  let sick = false; for (let d = Math.max(0, day - 30); d < day && !sick; d++) if (pop.sick(pid, d)) sick = true; if (sick) ev('incident', 'was sick this month');
  return out;
}

export const RULES = ['after-archive', 'before-birth', 'too-young', 'realm-date', 'town-date', 'mother-age', 'marriage-before-eldest', 'loss-before-marriage', 'married-off-early', 'arrival-before-job', 'parent-alive', 'parent-dead-before-sibling', 'widowed-married', 'siblings-disagree', 'couple-disagree', 'levy'] as const;
export type Rule = typeof RULES[number];
const MIN_AGE_AT: Partial<Record<PastEvent['kind'], number>> = { work: 5, incident: 2 };
const PARSA_JOB = /Terrace|building gangs|for the stores|administration|Treasury|work group for|garrison/;
const ARRIVAL = /^came to Pārsa|^moved down to Pārsa/;

/** the rules a person's past breaks (empty: consistent); `past` is pastOf with the household */
export function checkPast(pop: Population, pid: number, day: number, past: PastEvent[], kin: KinLike[], peers: { sibs: Map<number, PastEvent[]>; spouse: PastEvent[] | null }, seed: number): Rule[] {
  const p = pop.persons[pid], age = pop.ageOn(pid, day), bad = new Set<Rule>(), town = townYears(seed);
  const realmAgo = new Set(REALM.map(r => r.ago));
  for (const e of past) {
    if (e.ago < 1) bad.add('after-archive');
    if (e.ago > age || (e.kind !== 'birth' && e.kind !== 'loss' && e.kind !== 'realm' && e.kind !== 'town' && e.ago >= age)) bad.add('before-birth');
    const at = age - e.ago, min = e.kind === 'family' ? (/^married|^a (son|daughter) was born/.test(e.text) ? 14 : undefined) : MIN_AGE_AT[e.kind]; if (min !== undefined && at < min && !(e.kind === 'work' && /since (boyhood|childhood)|every year of life/.test(e.text))) bad.add('too-young');
    if (e.kind === 'realm') { if (!realmAgo.has(e.ago)) bad.add('realm-date'); if (/^remembers/.test(e.text) && at < 5) bad.add('too-young'); }
    if (e.kind === 'town' && !town.some(t => t.ago === e.ago && e.text.endsWith(t.text))) bad.add('town-date');
    if (/marched with the levy/.test(e.text) && (p.sex !== 'm' || at < 17)) bad.add('levy');
  }
  // mother 14-45 at each child's birth (the population's own children, and the history's "a son/daughter was born")
  if (p.sex === 'f') { for (const c of pop.childrenOf(pid)) { const ca = pop.ageOn(c, day), at = age - ca; if (pop.persons[c].born < 0 && (at < 14 || at > 45)) bad.add('mother-age'); }
    for (const e of past) if (/^a (son|daughter) was born/.test(e.text) && (age - e.ago < 14 || age - e.ago > 45)) bad.add('mother-age'); }
  const wed = past.find(e => /^married (his wife|her husband)/.test(e.text)), wedAny = past.find(e => /^married (his wife|her husband|again)/.test(e.text));
  const kids = kin.filter(k => k.rel === 'son' || k.rel === 'daughter');
  if (wed && kids.length && wed.ago <= Math.max(...kids.map(k => k.age))) bad.add('marriage-before-eldest');
  if (wedAny) for (const e of past) { if (/^lost a (son|daughter)/.test(e.text) && e.ago >= wedAny.ago) bad.add('loss-before-marriage'); if (/^married off/.test(e.text) && e.ago > wedAny.ago - 14) bad.add('married-off-early'); }
  const arr = past.find(e => ARRIVAL.test(e.text)), job = past.find(e => e.kind === 'work' && PARSA_JOB.test(e.text));
  if (arr && job && job.ago > arr.ago) bad.add('arrival-before-job');
  if (past.some(e => e.text === 'the mother died') && (kin.some(k => k.rel === 'mother') || (p.mother >= 0 && pop.present(p.mother, day) && pop.persons[p.mother].dies > day))) bad.add('parent-alive');
  if (past.some(e => e.text === 'the father died') && (kin.some(k => k.rel === 'father') || (p.mother >= 0 && (() => { const M = pop.persons[p.mother], mh = pop.home(p.mother, day);
    const mem = pop.households[mh].members.filter(x => pop.home(x, day) === mh && pop.persons[x].dies > day); const f = spouseIn(pop, M, mem); return f >= 0 && pop.persons[f].sex === 'm'; })()))) bad.add('parent-alive');
  // (a parent dead before a brother or sister of the same mother was born)
  if (p.mother >= 0) { const young = Math.min(...pop.childrenOf(p.mother).filter(c => pop.persons[c].born <= day).map(c => pop.ageOn(c, day)));
    for (const e of past) if ((e.text === 'the mother died' && e.ago > young) || (e.text === 'the father died' && e.ago > young + 1)) bad.add('parent-dead-before-sibling'); }
  if (past.some(e => e.text === 'was widowed') && kin.some(k => k.rel === 'husband')) bad.add('widowed-married');
  for (const [, sp] of peers.sibs) for (const t of ['the father died', 'the mother died']) { const a = past.find(e => e.text === t), b = sp.find(e => e.text === t); if (a && b && a.ago !== b.ago) bad.add('siblings-disagree'); }
  if (peers.spouse && wedAny) { const w2 = peers.spouse.find(e => /^married (his wife|her husband|again)/.test(e.text)); if (w2 && w2.ago !== wedAny.ago) { bad.add('couple-disagree'); } }
  return [...bad];
}

export interface HistoryCensus { n: number; withFive: number; consistent: number; pass: number; share: number; shareAdults: number; byRule: Record<string, number>; meanEvents: number; thin: Record<string, number>;
  oneSided: number; seqPeople: number; seqPairs: number; seqDistinct: number; seqTop: [string, number][]; firstPairs: number; examples: string[] }
/** T-E3 and T-E3r over every person present on the day */
export function historyCensus(pop: Population, day: number): HistoryCensus {
  const seed = pop.seed, ids = pop.persons.filter(p => pop.present(p.id, day) && p.dies > day).map(p => p.id);
  const kinM = new Map<number, KinLike[]>(), pastM = new Map<number, PastEvent[]>();
  for (const pid of ids) { const k = kinOf(pop, pid, day); kinM.set(pid, k); pastM.set(pid, pastOf(pop, pid, day, k)); }
  const byRule: Record<string, number> = {}, thin: Record<string, number> = {}, examples: string[] = [];
  let oneSided = 0, withFive = 0, consistent = 0, pass = 0, adults = 0, adultPass = 0, total = 0;
  const seqs = new Map<string, number>(), firsts = new Map<string, number>(); let seqPeople = 0;
  for (const pid of ids) {
    const past = pastM.get(pid)!, kin = kinM.get(pid)!, p = pop.persons[pid], age = pop.ageOn(pid, day);
    const sibs = new Map<number, PastEvent[]>(); if (p.mother >= 0) for (const c of pop.childrenOf(p.mother)) if (c !== pid && pastM.has(c)) sibs.set(c, pastM.get(c)!);
    const spk = kin.find(k => k.rel === 'wife' || k.rel === 'husband'), mutual = !!spk && !!kinM.get(spk.pid)?.some(k => k.pid === pid && (k.rel === 'wife' || k.rel === 'husband'));
    if (spk && !mutual) oneSided++; const spouse = spk && mutual ? pastM.get(spk.pid) ?? null : null;
    const bad = checkPast(pop, pid, day, past, kin, { sibs, spouse }, seed); for (const r of bad) byRule[r] = (byRule[r] ?? 0) + 1;
    const all = past.length + yearEvents(pop, pid, day).length; total += all;
    const five = all >= 5; if (five) withFive++; if (!bad.length) consistent++; const ok = five && !bad.length; if (ok) pass++;
    if (age >= 16) { adults++; if (ok) adultPass++; }
    if (!five) { const band = age < 3 ? '0-2' : age < 10 ? '3-9' : age < 16 ? '10-15' : age < 25 ? '16-24' : age < 40 ? '25-39' : '40+'; thin[band] = (thin[band] ?? 0) + 1; }
    for (const r of bad) if (!examples.some(x => x.startsWith(r + ':'))) examples.push(r + ': ' + `${pid} (${p.sex} ${age} ${p.origin} ${p.job}) | ${past.map(e => `${e.ago}:${e.text}`).join('; ')}`);
    const rest = past.filter(e => e.kind !== 'birth');
    if (rest.length >= 4) { seqPeople++; const k = rest.slice(-4).map(e => e.kind).join('>'); seqs.set(k, (seqs.get(k) ?? 0) + 1); const f = rest.slice(0, 4).map(e => e.kind).join('>'); firsts.set(f, (firsts.get(f) ?? 0) + 1); }
  }
  const pairShare = (m: Map<string, number>) => { let s = 0; for (const c of m.values()) s += c * (c - 1) / 2; return seqPeople > 1 ? s / (seqPeople * (seqPeople - 1) / 2) : 0; };
  return { n: ids.length, withFive, consistent, pass, share: pass / ids.length, shareAdults: adultPass / Math.max(1, adults), byRule, meanEvents: total / ids.length, thin,
    oneSided, seqPeople, seqPairs: pairShare(seqs), seqDistinct: seqs.size, seqTop: [...seqs].sort((a, b) => b[1] - a[1]).slice(0, 5), firstPairs: pairShare(firsts), examples };
}

// ------------------------------------------------------------------ T-E3v: a trace a walker can see or hear
const S_IMPAIR = salt('popview-impair');
/** the limp popview draws (impairOf), without building a view: a hurt at work this year, or the lasting lameness */
export function limps(pop: Population, pid: number, day: number): 'hurt' | 'lame' | null {
  const p = pop.persons[pid]; if (p.agent >= 0 || p.job === 'guard' || p.job === 'messenger') return null;
  if (pop.injuryOn?.(pid, day)) return 'hurt';
  const u = h32(pop.seed, S_IMPAIR, pid) / 4294967296, age = pop.ageOn(pid, day);
  return p.sex === 'm' && age >= IMPAIR.lame.ages[0] && age <= IMPAIR.lame.ages[1] && u < IMPAIR.lame.share ? 'lame' : null;
}
export interface TraceCensus { n: number; any: number; unprompted: number; talk: number; mourning: number; limp: number; lameWithCause: number; lame: number }
/** on a seeded sample; `talkLine(pid)` says whether the "Before this year" line reaches the model (the test passes the
 *  real prompt builder; the tool stays free of the conversation modules) */
export function traceCensus(pop: Population, day: number, n: number, talkLine: (pid: number) => boolean): TraceCensus {
  const ids = pop.persons.filter(p => pop.present(p.id, day) && p.dies > day).sort((a, b) => u01(pop.seed, salt('census-trace'), a.id) - u01(pop.seed, salt('census-trace'), b.id)).slice(0, n).map(p => p.id);
  let any = 0, unp = 0, talk = 0, mourn = 0, limp = 0;
  for (const pid of ids) { const t = talkLine(pid), m = pop.mourning(pid, day) > 0, l = !!limps(pop, pid, day);
    if (t) talk++; if (m) mourn++; if (l) limp++; if (t || m || l) any++; if (m || l) unp++; }
  // every lasting lameness in the population, and how many of them the person's past explains
  let lame = 0, cause = 0; for (const p of pop.persons) if (pop.present(p.id, day) && limps(pop, p.id, day) === 'lame') { lame++; if (pastOf(pop, p.id, day, kinOf(pop, p.id, day)).some(e => /lame/.test(e.text))) cause++; }
  return { n: ids.length, any: any / ids.length, unprompted: unp / ids.length, talk: talk / ids.length, mourning: mourn / ids.length, limp: limp / ids.length, lame, lameWithCause: cause };
}
export { EVENT_KINDS, ALL_NAMES };

// ------------------------------------------------------------------ CLI
if (process.argv[1]?.endsWith('person_census.ts')) {
  const seed = Number(process.argv[2] ?? 1), day = Number(process.argv[3] ?? 150);
  void (async () => {
    const { Population } = await import('../../src/people/population');
    const pop = new Population(seed);
    console.log(JSON.stringify({ seed, day, names: nameCensus(pop, day), history: historyCensus(pop, day) }, null, 1));
  })();
}
