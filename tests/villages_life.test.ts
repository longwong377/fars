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
    expect(src).toMatch(/pW = 0\.12 \+ 0\.4 \* st, pO = 0\.1 \+ 0\.08 \* st, pR = 0\.04 \+ 0\.06 \* st/);
  });
  it('about a third to a half of the households are washed, more of the better-off', () => {
    const share = (st: number) => { let n = 0; for (let i = 0; i < 2000; i++) if (villageWash(`v-c${i}`, st)) n++; return n / 2000; };
    expect(share(0.2)).toBeGreaterThan(0.25); expect(share(0.2)).toBeLessThan(0.5); expect(share(0.8)).toBeGreaterThan(share(0.2));
  });
});
