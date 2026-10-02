// D-450: what a person is told about their own life carries no digits: a 1-2 B model repeats "17 years ago" or "0.42 of
// silver" verbatim, and a person of Parsa does not speak in figures. Briefs for ~200 people, as the model reads them.
import { describe, it, expect } from 'vitest';
import { simAt } from './sim_fixture';
import { lifeRecord, lifeBriefShort } from '../src/people/converse/life';
import { systemPrompt } from '../src/people/converse/prompt';
import { numWords, silverSpoken } from '../src/people/converse/words';

describe('number words (D-450)', () => {
  it('writes counts as words', () => {
    expect(numWords(0)).toBe('no'); expect(numWords(1)).toBe('one'); expect(numWords(17)).toBe('seventeen'); expect(numWords(21)).toBe('twenty-one');
    expect(numWords(44)).toBe('forty-four'); expect(numWords(100)).toBe('a hundred'); expect(numWords(365)).toBe('three hundred and sixty-five');
    expect(numWords(2400)).toMatch(/^[a-z ,-]+$/);
    for (const v of [0.01, 0.1, 0.25, 0.42, 0.5, 0.8, 1, 1.4, 2.6, 7, 33]) expect(silverSpoken(v), String(v)).not.toMatch(/\d/);
    expect(silverSpoken(0.42)).toMatch(/half a shekel/);
  });
});

describe('the brief has no digits (D-450)', () => {
  it('~200 people, lifeBriefShort and the system prompt', () => {
    const d = 150, sim = simAt(1, d, 10); const P = sim.pop; const bad: string[] = []; let n = 0;
    for (let i = 0; i < P.persons.length && n < 200; i += 7) {
      if (!P.present(i, d)) continue; n++;
      const L = lifeRecord(P, sim.cal, i, d, 10.5);
      for (const s of [lifeBriefShort(L), systemPrompt(L, 'none')]) for (const m of s.matchAll(/[^\n]{0,40}\d[^\n]{0,20}/g)) bad.push(`${i}: ${m[0]}`);
    }
    console.log('[D-450 briefs]', n, 'people;', bad.length, 'digit runs');
    expect(n).toBeGreaterThan(150);
    expect([...new Set(bad)].slice(0, 30)).toEqual([]);
  }, 300_000);
});
