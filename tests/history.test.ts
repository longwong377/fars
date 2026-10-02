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
