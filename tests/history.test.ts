// D-371: every person has a past before this year, bound to the household as the simulation has it (history.ts).
import { describe, it, expect } from 'vitest';
import { simAt } from './sim_fixture';
import { Population } from '../src/people/population';
import { EventCalendar } from '../src/people/calendar';
import { lifeRecord } from '../src/people/converse/life';
import { pastOf, townYears } from '../src/people/history';
import { u01, salt } from '../src/people/hash';

const pop = new Population(1), day = 150;
const cal = new EventCalendar(1, pop, () => ({ rain: 0, lightning: 0, windMs: 2, tempC: 20, dust: 0 }) as any); pop.attach(cal);
const sample = pop.persons.filter(p => pop.present(p.id, day)).sort((a, b) => u01(1, salt('hist-t'), a.id) - u01(1, salt('hist-t'), b.id)).slice(0, 400).map(p => p.id);
describe('D-371 a past for everyone', () => {
  it('every adult has a past; nothing in it is this year or before their birth; it is deterministic', () => {
    let thin = 0;
    for (const pid of sample) {
      const age = pop.ageOn(pid, day), ev = pastOf(pop, pid, day);
      for (const e of ev) { expect(e.ago).toBeGreaterThanOrEqual(1); expect(e.ago).toBeLessThanOrEqual(age); }
      if (age >= 16 && ev.filter(e => e.kind !== 'birth').length < 2) thin++;
      expect(JSON.stringify(pastOf(pop, pid, day))).toBe(JSON.stringify(ev));
    }
    expect(thin).toBe(0);
  });
  it('binds to the household: a marriage before the eldest child, no war service for the young or for women', () => {
    let checked = 0;
    for (const pid of sample.slice(0, 150)) {
      const L = lifeRecord(pop, cal, pid, day, 12), ev = pastOf(pop, pid, day, L.household), age = pop.ageOn(pid, day), p = pop.persons[pid];
      const wed = ev.find(e => e.text.startsWith('married his') || e.text.startsWith('married her'));
      const kids = L.household.filter(k => k.rel === 'son' || k.rel === 'daughter');
      if (wed && kids.length) { checked++; expect(wed.ago).toBeGreaterThan(Math.max(...kids.map(k => k.age))); }
      if (ev.some(e => /marched with the levy/.test(e.text))) { expect(p.sex).toBe('m'); expect(age).toBeGreaterThanOrEqual(30); }
      expect(L.past.length).toBe(age >= 3 ? Math.min(4, ev.length) : 0);
    }
    expect(checked).toBeGreaterThan(10);
  });
  it('the town\'s hard years are the same for every neighbour of a seed, and differ between seeds', () => {
    const t1 = townYears(1); expect(t1.length).toBe(3); expect(JSON.stringify(townYears(1))).toBe(JSON.stringify(t1)); expect(JSON.stringify(townYears(7))).not.toBe(JSON.stringify(t1));
    const shared = sample.filter(pid => pop.ageOn(pid, day) > 40 && pastOf(pop, pid, day).some(e => e.kind === 'town'));
    const texts = new Set(shared.flatMap(pid => pastOf(pop, pid, day).filter(e => e.kind === 'town').map(e => `${e.ago}:${e.text}`)));
    expect(texts.size).toBeLessThanOrEqual(3);
  });
});
describe('D-371 children have playmates (a lookup; no plan changes)', () => {
  it('most children of 3-10 in the town and villages have a playmate of their lane, near their age, not of their house', () => {
    const kids = sample.filter(pid => { const a = pop.ageOn(pid, day), H = pop.households[pop.home(pid, day)]; return a >= 3 && a <= 10 && (H.zone === 'town' || H.zone === 'plain'); });
    let with_ = 0; for (const k of kids) { const m = pop.playmatesOf(k, day); if (m.length) with_++;
      for (const o of m) { expect(Math.abs(pop.ageOn(o, day) - pop.ageOn(k, day))).toBeLessThanOrEqual(2); expect(pop.home(o, day)).not.toBe(pop.home(k, day)); expect(pop.households[pop.home(o, day)].q).toBe(pop.households[pop.home(k, day)].q); } }
    expect(kids.length).toBeGreaterThan(20); expect(with_ / kids.length).toBeGreaterThan(0.8);
  });
});
describe('D-371 the life record speaks from the economy\'s real debts and dealings', () => {
  it('with a sim, debts and recent dealings come from the economy (no seeded fakes, no digits)', async () => {
    const { readFileSync } = await import('node:fs'); const { NavGrid } = await import('../src/people/navgrid'); const { PeopleSim } = await import('../src/people/sim');
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const sim = simAt(1, 120, 12); const E = sim.econTo(121); void nav; void PeopleSim;
    const debtor = [...E.hh.values()].find(h => h.debts.some(d => d.amt > 0.05) && sim.pop.households[Number(h.id.slice(2))]?.members.some(m => sim.pop.ageOn(m, 120) >= 20 && sim.pop.present(m, 120)))!;
    const pid = sim.pop.households[Number(debtor.id.slice(2))].members.find(m => sim.pop.ageOn(m, 120) >= 20 && sim.pop.present(m, 120))!;
    const L = lifeRecord(sim.pop, sim.cal, pid, 120, 12);
    expect(L.debts.some(d => /^owes /.test(d))).toBe(true);
    for (const d of [...L.debts, ...L.year]) expect(d).not.toMatch(/\d/);
    let fake = 0; for (const h of [...E.hh.values()].slice(0, 300)) { const m = sim.pop.households[Number(h.id.slice(2))]?.members.find(x => sim.pop.ageOn(x, 120) >= 16 && sim.pop.present(x, 120)); if (m === undefined) continue;
      const L2 = lifeRecord(sim.pop, sim.cal, m, 120, 12); if (L2.debts.length && !h.debts.some(d => d.amt > 0.01) && !L2.debts.some(d => /is owed/.test(d))) fake++; }
    expect(fake).toBe(0);
  }, 600_000);
});
describe('D-372 bynames tell namesakes apart', () => {
  it('a name with its byname is shared by far fewer neighbours than the bare name; brothers and sisters share the father', () => {
    const byQ = new Map<string, Map<string, number>>(), bare = new Map<string, Map<string, number>>();
    const people = sample.filter(pid => { const H = pop.households[pop.home(pid, day)]; return H.zone === 'town' || H.zone === 'plain'; }).slice(0, 250);
    let withBy = 0;
    for (const pid of people) { const L = lifeRecord(pop, cal, pid, day, 12); if (L.byname) withBy++; const q = pop.households[pop.home(pid, day)].q;
      for (const [m, k] of [[byQ, `${L.name} ${L.byname}`], [bare, L.name]] as const) { const x = m.get(q) ?? m.set(q, new Map()).get(q)!; x.set(k, (x.get(k) ?? 0) + 1); } }
    expect(withBy / people.length).toBeGreaterThan(0.95);
    // every person of the quarter, not the sample: namesakes in the quarter by bare name vs with the byname
    const q0 = pop.households[pop.home(people[0], day)].q, all = pop.persons.filter(p => pop.present(p.id, day) && pop.households[pop.home(p.id, day)].q === q0).slice(0, 400).map(p => p.id);
    const count = (key: (pid: number) => string) => { const m = new Map<string, number>(); for (const pid of all) m.set(key(pid), (m.get(key(pid)) ?? 0) + 1); return all.filter(pid => m.get(key(pid))! > 1).length / all.length; };
    const sBare = count(pid => lifeRecord(pop, cal, pid, day, 12).name), sBy = count(pid => { const L = lifeRecord(pop, cal, pid, day, 12); return `${L.name} ${L.byname}`; });
    console.log('[byname] namesakes in a quarter of', all.length, ': bare', sBare.toFixed(3), 'with byname', sBy.toFixed(3));
    expect(sBy).toBeLessThan(sBare * 0.5);
    const kids = all.filter(pid => pop.persons[pid].mother >= 0 && pop.ageOn(pid, day) < 14); const byMother = new Map<number, Set<string>>();
    for (const k of kids) { const L = lifeRecord(pop, cal, k, day, 12); const s = byMother.get(pop.persons[k].mother) ?? byMother.set(pop.persons[k].mother, new Set()).get(pop.persons[k].mother)!; s.add(L.byname!.replace(/^(son|daughter) of /, '')); }
    for (const s of byMother.values()) expect(s.size).toBe(1);
  }, 600_000);
});
describe('D-373 hopes and worries from each person\'s own state', () => {
  it('almost everyone has something on their mind; a worry about a debt is a real debt; no digits', async () => {
    const { aimsOf } = await import('../src/people/aims');
    const { readFileSync } = await import('node:fs'); const { NavGrid } = await import('../src/people/navgrid'); const { PeopleSim } = await import('../src/people/sim');
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const sim = simAt(1, 120, 12); const E = sim.econTo(121); void nav; void PeopleSim;
    const people = sim.pop.persons.filter(p => sim.pop.present(p.id, 120) && sim.pop.ageOn(p.id, 120) >= 4).sort((a, b) => u01(1, salt('aims-t'), a.id) - u01(1, salt('aims-t'), b.id)).slice(0, 300);
    let some = 0; const kinds = new Set<string>();
    for (const P of people) { const A = aimsOf(sim.pop, sim.cal, P.id, 120, E); if (A.hopes.length + A.worries.length) some++;
      for (const x of [...A.hopes, ...A.worries]) { expect(x).not.toMatch(/\d/); kinds.add(x.replace(/[A-Z][^\s']+('s)?/g, 'N')); }
      if (A.worries.some(w => /debt/.test(w))) expect(E.hh.get(`h:${sim.pop.home(P.id, 120)}`)!.debts.some(d => d.amt > 0.05)).toBe(true); }
    console.log('[aims]', some, '/', people.length, 'kinds', kinds.size);
    expect(some / people.length).toBeGreaterThan(0.85); expect(kinds.size).toBeGreaterThan(12);
  }, 600_000);
});
describe('D-375 needs and the quarter\'s talk reach what people say (asks on, as in the game)', () => {
  it('a house with open asks speaks of them; people speak of the rumours they hold; no digits', () => {
    const sim = simAt(1, 120, 12, { asks: true }); sim.econTo(121);
    const A = sim.asksWorld.asks, R = sim.asksWorld.rumours;
    const houses = [...new Set([...(A as any).open.values()].map((a: any) => a.hh))].slice(0, 40) as string[];
    expect(houses.length).toBeGreaterThan(5);
    let needs = 0, news = 0, ppl = 0;
    for (const hh of houses) { const m = sim.pop.households[Number(hh.slice(2))].members.find(x => sim.pop.ageOn(x, 120) >= 16 && sim.pop.present(x, 120)); if (m === undefined) continue; ppl++;
      const L = lifeRecord(sim.pop, sim.cal, m, 120, 12); if (L.needs.length) needs++; if (L.news.length) news++; for (const x of [...L.needs, ...L.news]) expect(x).not.toMatch(/\d/); }
    console.log('[asks] people', ppl, 'with needs', needs, 'with news', news, 'rumours', R.rumours.length);
    expect(needs / ppl).toBeGreaterThan(0.8);
  }, 1_800_000);
});
describe('D-375 gossip moves trust', () => {
  it('houses that heard of a theft trust the one it names less than houses that did not', () => {
    const sim = simAt(1, 120, 12, { asks: true }); const E = sim.econTo(121), R = sim.asksWorld.rumours, T = E.trust!;
    let lower = 0, n = 0;
    for (const r of R.rumours) { if (r.truth.kind !== 'theft' && r.truth.kind !== 'default') continue;
      const about = r.truth.suspect ?? r.truth.about, heard = [...r.holds.entries()].filter(([hh, h]) => h.hand > 0 && hh !== about).slice(0, 5);
      const H = E.hh.get(about); if (!H) continue; const quiet = [...E.hh.values()].filter(x => x.q === H.q && !r.holds.has(x.id) && x.id !== about).slice(0, 5);
      for (const [hh] of heard) for (const q of quiet) { n++; if (T.trustOf(hh, about, 120) < T.trustOf(q.id, about, 120)) lower++; } }
    console.log('[gossip]', lower, '/', n); expect(n).toBeGreaterThan(10); expect(lower / n).toBeGreaterThan(0.6);
  }, 1_800_000);
});
describe('D-375 rumours leave a house without help', () => {
  it('with asks on, some help is withheld from houses shunned over what was heard; with asks off, none', () => {
    const on = simAt(1, 120, 12, { asks: true }); on.econTo(121); const s0 = (on.living.stats as any).shunned ?? 0, o0 = on.living.stats.offers; on.econTo(135); const s = ((on.living.stats as any).shunned ?? 0) - s0; (on.living.stats as any).offers -= o0; // (the counts are not in the save: counted over days run after it)
    console.log('[shun]', s, 'offers', on.living.stats.offers);
    expect(s).toBeGreaterThan(0); expect(s).toBeLessThan(on.living.stats.offers * 0.5);
  }, 1_800_000);
});
describe('D-371 a family remembers the same past', () => {
  it('husband and wife tell the same marriage and the same children lost; brothers and sisters the same parents\' deaths', () => {
    let couples = 0, sibs = 0;
    for (const pid of sample.slice(0, 300)) {
      const L = lifeRecord(pop, cal, pid, day, 12), sp = L.household.find(k => k.rel === 'wife' || k.rel === 'husband'); const mine = pastOf(pop, pid, day, L.household);
      if (sp) { const L2 = lifeRecord(pop, cal, sp.pid, day, 12), theirs = pastOf(pop, sp.pid, day, L2.household);
        const fam = (ev: typeof mine) => ev.filter(e => /^married (his|her)|^lost a (son|daughter)|^married off/.test(e.text)).map(e => `${e.ago}:${e.text.replace(/his wife|her husband/, 'spouse')}`).sort().join('|');
        if (L2.household.some(k => k.pid === pid && (k.rel === 'wife' || k.rel === 'husband'))) { couples++; expect(fam(theirs)).toBe(fam(mine)); } }
      const P = pop.persons[pid]; if (P.mother >= 0 && pop.ageOn(pid, day) >= 20) for (const b of pop.childrenOf(P.mother)) { if (b === pid || pop.ageOn(b, day) < 20) continue; sibs++;
        const dead = (x: number) => pastOf(pop, x, day, lifeRecord(pop, cal, x, day, 12).household).filter(e => /^the (father|mother) died/.test(e.text) && e.ago < Math.min(pop.ageOn(pid, day), pop.ageOn(b, day))).map(e => `${e.ago}:${e.text}`).sort().join('|');
        const inHouse = (x: number) => lifeRecord(pop, cal, x, day, 12).household.some(k => k.rel === 'father' || k.rel === 'mother');
        if (!inHouse(pid) && !inHouse(b)) expect(dead(b)).toBe(dead(pid)); }
    }
    expect(couples).toBeGreaterThan(10); console.log('[family] couples', couples, 'sibling pairs', sibs);
  });
});
