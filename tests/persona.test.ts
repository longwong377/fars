// D-382 (UD-08): a personality for everyone (src/people/persona.ts). Deterministic per world seed and person; no two people of
// a quarter share a manner line (the short brief's "Manner:" words); the facets follow age and work where they are made to.
import { describe, it, expect } from 'vitest';
import { Population } from '../src/people/population';
import { EventCalendar } from '../src/people/calendar';
import { lifeRecord } from '../src/people/converse/life';
import { personaOf, mannerOf } from '../src/people/persona';
import { fenceHits } from '../src/people/converse/fence';
import { u01, salt } from '../src/people/hash';

const pop = new Population(1), day = 150;
const sample = pop.persons.filter(p => pop.present(p.id, day)).sort((a, b) => u01(1, salt('persona-t'), a.id) - u01(1, salt('persona-t'), b.id)).slice(0, 1000).map(p => p.id);
/** the manner line before D-382: one of nine (temper, habit) pairs by the trait */
const OLD = ['quiet and wary of strangers; slow to speak, careful with words', 'patient and dry; answers briefly, sometimes with a dry joke', 'warm and talkative; likes to talk about the family and the neighbours', 'proud of the work; talks about the work, exact about measures and names', 'anxious; worries aloud about rations, weather and the sick', 'cheerful; quick to laugh, teases', 'pious; swears by the gods and gives thanks often', 'blunt and impatient; short answers, wants to get back to work', 'curious about strangers; asks the stranger where they come from'];
/** the share of people whose exact line is shared with someone else of their quarter, worst quarter (of at least 20 sampled) and overall */
function shared(line: (pid: number) => string) {
  const byQ = new Map<string, string[]>(); for (const pid of sample) { const q = pop.households[pop.home(pid, day)].q; (byQ.get(q) ?? byQ.set(q, []).get(q)!).push(line(pid)); }
  let worst = 0, dup = 0, n = 0;
  for (const ls of byQ.values()) { const c = new Map<string, number>(); for (const l of ls) c.set(l, (c.get(l) ?? 0) + 1); const d = ls.filter(l => c.get(l)! > 1).length; dup += d; n += ls.length; if (ls.length >= 20) worst = Math.max(worst, d / ls.length); }
  return { worst, all: dup / n, quarters: byQ.size };
}

describe('D-382 a personality for everyone', () => {
  it('is deterministic per seed and person, and differs between seeds', () => {
    for (const pid of sample.slice(0, 50)) expect(JSON.stringify(personaOf(pop, pid, day))).toBe(JSON.stringify(personaOf(pop, pid, day)));
    const other = new Population(2); let same = 0; for (const pid of sample.slice(0, 50)) if (pid < other.persons.length && mannerOf(personaOf(other, pid, day)) === mannerOf(personaOf(pop, pid, day))) same++;
    expect(same).toBeLessThan(3);
  });
  it('no manner line is shared by 2 % of a quarter (before D-382: nine lines for the whole town)', () => {
    const before = shared(pid => OLD[Math.min(8, Math.floor(pop.persons[pid].trait * 9))]), after = shared(pid => mannerOf(personaOf(pop, pid, day)));
    console.log(`[persona] shared manner lines within a quarter (${after.quarters} quarters, ${sample.length} people): before worst ${(100 * before.worst).toFixed(1)} %, all ${(100 * before.all).toFixed(1)} %; after worst ${(100 * after.worst).toFixed(1)} %, all ${(100 * after.all).toFixed(1)} %`);
    expect(before.all).toBeGreaterThan(0.5);
    expect(after.worst).toBeLessThan(0.02); expect(after.all).toBeLessThan(0.02);
  });
  it('the line is short, has no digits, modern words or out-of-world words; the life record carries it with the oath', () => {
    for (const pid of sample) {
      const P = personaOf(pop, pid, day), m = mannerOf(P);
      expect(m.split(/\s+/).length, m).toBeLessThanOrEqual(27); expect(m).not.toMatch(/\d/);
      expect(fenceHits(`${m}; dislikes ${P.dislike}`), m).toEqual([]);
      expect(m).not.toMatch(/\b(okay|guy|kids|job|mom|dad|stress|nervous breakdown|boss|minute|hour|week)s?\b/i);
    }
    const cal = new EventCalendar(1, pop, () => ({ rain: 0, lightning: 0, windMs: 2, tempC: 20, dust: 0 }) as any); pop.attach(cal);
    for (const pid of sample.slice(0, 20)) { const L = lifeRecord(pop, cal, pid, day, 10), P = personaOf(pop, pid, day);
      expect(L.temperament).toBe(P.temperament); expect(L.speech[0]).toBe(P.speech); expect(L.speech[1]).toMatch(/^oath: /); expect(L.speech).toContain(`dislikes ${P.dislike}`); }
  });
  it('facets follow age and work: the old more pious, the young more curious, priests devout, grooms talk of horses, children like children', () => {
    const mean = (ids: number[], f: (pid: number) => number) => ids.reduce((a, x) => a + f(x), 0) / Math.max(1, ids.length);
    const all = pop.persons.filter(p => pop.present(p.id, day)).map(p => p.id), age = (x: number) => pop.ageOn(x, day);
    const old = all.filter(x => age(x) > 55), mid = all.filter(x => age(x) >= 25 && age(x) <= 45), young = all.filter(x => age(x) >= 16 && age(x) < 25);
    expect(mean(old, x => personaOf(pop, x, day).piety)).toBeGreaterThan(mean(mid, x => personaOf(pop, x, day).piety) + 0.08);
    expect(mean(young, x => personaOf(pop, x, day).curiosity)).toBeGreaterThan(mean(mid, x => personaOf(pop, x, day).curiosity) + 0.08);
    const priests = all.filter(x => pop.persons[x].job === 'priest'); if (priests.length) expect(mean(priests, x => personaOf(pop, x, day).piety)).toBeGreaterThan(0.75);
    const grooms = all.filter(x => pop.persons[x].job === 'groom'); expect(grooms.length).toBeGreaterThan(0);
    expect(mean(grooms, x => /horse|road/.test(personaOf(pop, x, day).subject) ? 1 : 0)).toBeGreaterThan(0.4);
    const farmers = all.filter(x => ['farmer', 'gardener'].includes(pop.persons[x].job)); expect(mean(farmers, x => /vine|barley|sesame|oxen|rain|fruit|water|pomegranate/.test(personaOf(pop, x, day).subject) ? 1 : 0)).toBeGreaterThan(0.4);
    for (const x of all.filter(x => age(x) < 13).slice(0, 200)) expect(personaOf(pop, x, day).gesture).not.toMatch(/beard|apron|stick/);
    for (const x of all.filter(x => pop.persons[x].sex === 'f').slice(0, 300)) expect(personaOf(pop, x, day).gesture).not.toMatch(/beard|his /);
    // the trait stays the core temper's axis (talk.ts reads its nine-way order)
    for (const x of sample.slice(0, 200)) expect(personaOf(pop, x, day).core).toBe(Math.min(8, Math.floor(pop.persons[x].trait * 9)));
  });
});
