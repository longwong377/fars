// s18 C15 (D-800): the villages' far level carries the households' washes as their near level does (settlement/houses.ts,
// C2's D-661), with cloths drying over the eaves and dung cakes on the lane walls
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { WASH_VILLAGE, villageWash } from '../src/world/plain/villagehouses';

describe('village washes (D-800)', () => {
  it('the wash table and draw are the town houses\' (houses.ts WASH / washOf)', () => {
    const src = readFileSync('src/world/settlement/houses.ts', 'utf8');
    const m = src.match(/const WASH = (\{[^\n]*\});/); expect(m).toBeTruthy();
    const W = Function(`return ${m![1].replace(/ as RGB\[\]/g, '')}`)(); expect(W).toEqual(WASH_VILLAGE);
    expect(src).toMatch(/pW = 0\.34 \+ 0\.24 \* st, pC = 0\.16, pO = 0\.14, pP = 0\.07, pR = st < 0\.2 \? 0\.04 : 1/);
    expect(src).toMatch(/W\.k \* \(court \? 1 : 0\.95\) \* \(0\.88 \+ 0\.12 \* Math\.max\(0, 1 - L\.sincePlaster \/ 30\)\)/);
  });
  it('nearly every household is washed (D-668), the poorest some bare, the better-off whiter', () => {
    const share = (st: number) => { let n = 0; for (let i = 0; i < 2000; i++) if (villageWash(`v-c${i}`, st)) n++; return n / 2000; };
    expect(share(0.1)).toBeGreaterThan(0.6); expect(share(0.1)).toBeLessThan(1); expect(share(0.5)).toBe(1);
  });
});
