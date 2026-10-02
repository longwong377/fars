// D-373 (UD-07, UD-08, UD-11; the depth audit's "reasons" beyond the day's schedule): WHAT A PERSON HOPES FOR AND FEARS, read
// off their own state, for everyone (the baked prose had a hope and a worry for one world seed only, written by a model). From
// the house's real debts, stores and bondage (the economy, when built), sickness, mourning, a birth to come or just come, a
// wedding agreed, a daughter of age, a parent grown old, a quarrel, the group's short rations, the season's work and the
// festivals: the two most pressing of each, by a fixed order of weight (C), the person's own words left to the model. Pure:
// a function of the population, the calendar, the economy and the day; no draw changes any plan.
import type { Population } from './population';
import type { EventCalendar } from './calendar';
import type { Economy } from './economy/world';
import { dateOf } from './calendar';
import { u01, salt } from './hash';

const S = salt('aims');
export interface Aims { hopes: string[]; worries: string[] }
const name = (pop: Population, pid: number) => pop.nameOf(pid)?.replace(/^\*/, '') ?? null;

export function aimsOf(pop: Population, cal: EventCalendar | null, pid: number, day: number, E: Economy | null = null): Aims {
  const p = pop.persons[pid], age = pop.ageOn(pid, day), hid = pop.home(pid, day), H = pop.households[hid];
  const hopes: [number, string][] = [], worries: [number, string][] = [];
  if (!H || !pop.present(pid, day)) return { hopes: [], worries: [] };
  const mem = H.members.filter(m => m !== pid && pop.present(m, day) && pop.persons[m].dies > day);
  const month = dateOf(day).month, eh = E?.hh.get(`h:${hid}`);
  // ---- worries
  if (eh) {
    for (const d of eh.debts) if (d.amt > 0.05) { worries.push([d.due <= day + 20 ? 9 : 6, d.to === 'treasury' ? 'what is owed to the king\'s treasury' : `the debt that falls due${d.due <= day + 20 ? ' soon' : ''}`]); break; }
    const food = E!.needsOf(eh.id).find(n => n.kind === 'food'); if (food && food.urgency > 0.45) worries.push([10, 'the bread running out before there is more']);
    if (E!.boundOn(day).some(b => b.hh === eh.id)) worries.push([8, 'one of the house working off a debt in another house']);
    if (eh.noOx >= 0 && (eh.kind === 'farmer' || eh.kind === 'herder')) worries.push([7, eh.kind === 'farmer' ? 'ploughing without an ox of their own' : 'the flock that was lost']);
  }
  const sick = mem.find(m => pop.sick(m, day)); if (sick !== undefined) worries.push([9, `${name(pop, sick) ?? 'one of the house'} lying sick`]);
  if (pop.sick(pid, day)) worries.push([8, 'their own sickness']);
  if (pop.mourning(pid, day)) worries.push([10, 'the dead of the house']);
  const due = pop.dueIn(pid, day); if (due !== null && due > 0 && due < 120) { worries.push([7, 'the birth to come']); hopes.push([8, 'a child born healthy']); }
  for (const m of mem) { const x = pop.dueIn(m, day); if (x !== null && x > 0 && x < 90 && p.sex === 'm' && age >= 16) { hopes.push([8, `${name(pop, m) ?? 'his wife'}'s child born safely`]); break; } }
  const old = mem.find(m => pop.ageOn(m, day) >= 65); if (old !== undefined && age >= 16) worries.push([4, `${name(pop, old) ?? 'the old one of the house'} growing weak`]);
  if (cal) { for (let d = Math.max(0, day - 40); d <= day; d++) { const x = cal.ctx(d).disputes.get(pid); if (x) { worries.push([5, `the quarrel with ${name(pop, x.other) ?? 'a neighbour'}`]); break; } }
    if (p.group >= 0 && cal.shortfalls.some(s => s.group === p.group && s.day <= day && s.day > day - 60)) worries.push([7, 'the rations coming short again']); }
  // the season's work (C): rain before the harvest, the cold for the flocks, the heat at the stone
  if ((p.job === 'farmer' || p.job === 'gardener') && age >= 14) { if (month >= 11 || month <= 1) worries.push([3, 'whether the rains come for the barley']); else if (month <= 3) worries.push([3, 'hail or blight before the harvest is in']); }
  if ((p.job === 'shepherd' || p.job === 'herder') && (month >= 9 || month <= 0)) worries.push([3, 'the cold for the lambs']);
  if (p.job === 'builder' && age >= 16) worries.push([2, 'an accident at the stone']);
  // ---- hopes
  if (p.marry > day && p.marry < 1e8 && p.spouse !== undefined) hopes.push([9, `the wedding with ${name(pop, p.spouse) ?? 'the one agreed'}`]);
  const daughter = mem.find(m => { const q = pop.persons[m]; return q.sex === 'f' && q.mother >= 0 && (q.mother === pid || pop.persons[q.mother]?.hh === p.hh) && pop.ageOn(m, day) >= 18 && pop.ageOn(m, day) <= 23 && q.marry > 1e8; });
  if (daughter !== undefined && age >= 36) hopes.push([6, `a good marriage for ${name(pop, daughter) ?? 'the daughter of the house'}`]);
  if (p.sex === 'm' && age >= 19 && age <= 30 && p.marry > 1e8 && !mem.some(m => pop.persons[m].wife && pop.ageOn(m, day) >= 16 && Math.abs(pop.ageOn(m, day) - age) < 12)) hopes.push([5, 'to put by enough for a bride-gift']);
  if (p.sex === 'f' && age >= 18 && age <= 24 && p.marry > 1e8 && !p.wife) hopes.push([4, 'to be married into a good house']);
  const baby = mem.find(m => { const q = pop.persons[m]; return q.born >= 0 && q.born <= day && day - q.born < 90; }); if (baby !== undefined) hopes.push([7, `that ${name(pop, baby) ?? 'the new child'} thrives`]);
  if (eh) { const good = E!.events.some(v => v && v.actor === eh.id && v.kind === 'harvest_good' && v.day > day - 60 && v.day <= day);
    if (good) hopes.push([6, eh.debts.some(d => d.amt > 0.05) ? 'to clear the debts with the good harvest' : eh.noOx >= 0 ? 'to buy an ox after the good harvest' : 'to put by grain for a lean year']);
    else if (eh.kind === 'farmer' && (month === 2 || month === 3)) hopes.push([3, 'a good harvest']); }
  if (age >= 55 && H.members.some(m => pop.ageOn(m, day) < 14 && m !== pid)) hopes.push([4, 'to see the grandchildren grown']);
  if (p.pupilOf !== undefined) hopes.push([5, 'to write the signs as well as the master']);
  if (age < 14 && age >= 4) hopes.push([3, cal && cal.ctx(Math.min(day + 7, 353)).festival ? 'the festival coming' : pick(['to be big enough to go to the fields', 'a toy of your own', 'to see the king\'s horses', 'honey cakes at the next feast'], u01(pop.seed, S, pid))]);
  if (p.job === 'craftsman' && age >= 18) hopes.push([3, 'a good name for their work in the market']);
  if (p.group >= 0 && !p.persian && age >= 18 && !hopes.length) hopes.push([2, 'to go home one day to their own country']);
  // the ordinary hopes of a quiet house (low weight; family first, then the work; C)
  const son = mem.find(m => { const q = pop.persons[m]; return q.sex === 'm' && (q.mother === pid || pop.persons[q.mother]?.hh === hid) && pop.ageOn(m, day) >= 11 && pop.ageOn(m, day) <= 15; });
  if (son !== undefined && age >= 28) hopes.push([2, p.job === 'farmer' ? `that ${name(pop, son) ?? 'the boy'} learns the fields well` : `a trade for ${name(pop, son) ?? 'the boy'}`]);
  const small = mem.filter(m => pop.ageOn(m, day) < 10).length; if (small && age >= 18) hopes.push([1, small > 1 ? 'the children growing strong' : 'the child growing strong']);
  if (age >= 16 && hopes.length + worries.length < 2) hopes.push([1, pick(JOB_HOPE[p.job] ?? GEN_HOPE, u01(pop.seed, S, pid, 1))]);
  if (age >= 60 && hopes.length + worries.length < 2) hopes.push([1, 'a quiet old age among the family']);
  const top = (xs: [number, string][]) => [...xs].sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1)).filter((x, i, l) => l.findIndex(y => y[1] === x[1]) === i).slice(0, 2).map(x => x[1]);
  return { hopes: top(hopes), worries: top(worries) };
}
const pick = <T>(xs: T[], u: number) => xs[Math.min(xs.length - 1, Math.floor(u * xs.length))];
const GEN_HOPE = ['a good year for the house', 'a day of rest at the next feast', 'peace with the neighbours', 'to visit kin in the next village'];
const JOB_HOPE: Record<string, string[]> = {
  homemaker: ['a new loom for the house', 'enough wool for the winter cloaks', 'to see a sister again', 'a good marriage for the children one day'], farmer: ['a strip of better land one day', 'a second ox', 'water enough in the channel this summer'],
  builder: ['to be moved to the stone gang', 'the hall finished in their lifetime', 'the next ration day'], guard: ['to lead a file of ten one day', 'a quiet watch'], porter: ['a lighter load', 'a place in the stores'],
  craftsman: ['a good name for their work', 'a boy to learn the craft'], weaver: ['a place among the master weavers', 'wool of the fine kind to work'], servant: ['a kind master', 'a day at home with kin'],
  scribe: ['a place at the Treasury', 'a seal of their own'], official: ['the king\'s favour', 'an account without fault'], shepherd: ['good grass in the hills', 'twin lambs'], herder: ['good grass on the road', 'a good price for the wool'],
  gardener: ['the vines bearing well', 'a share of the estate\'s fruit'], miller: ['a lighter quern', 'the next ration day'], brewer: ['a good brew for the feast'], storekeeper: ['full stores', 'the counts coming out right'],
};
