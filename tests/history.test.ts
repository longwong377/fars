// D-371: every person has a past before this year, bound to the household as the simulation has it (history.ts).
import { describe, it, expect } from 'vitest';
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
    const sim = new PeopleSim(1, nav, (() => ({ rain: 0, lightning: 0, windMs: 2, tempC: 20, dust: 0 })) as any); sim.jumpTo(120 * 24 + 12); const E = sim.econTo(121);
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
