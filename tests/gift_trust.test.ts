// D-450: a gift moves a house's trust by its worth to the house, not by its being a gift (a playtest bot's 0.1 silver once
// raised a house's trust in the stranger from 0.544 to 0.695, as much as a sack of barley). Deterministic and saved.
import { describe, it, expect } from 'vitest';
import { Population } from '../src/people/population';
import { Economy } from '../src/people/economy/world';
import { householdsOf } from '../src/people/economy/chains';
import { PLAYER } from '../src/people/speech/stranger';

const pop = new Population(1), hs = householdsOf(pop);
const town = (to: number) => { const e = new Economy(1, hs, { trust: true }); for (let d = 0; d <= to; d++) e.step(d); return e; };
const step = (e: Economy, n: number) => { for (let i = 0; i < n; i++) e.step(e.day + 1); };

describe('D-450 gifts weigh by their worth', () => {
  it('a pinch of silver moves a house a little, a sack of barley much more; a token still counts', () => {
    const rise = (gift: { cash?: number; grain?: number }) => {
      const e = town(60), S = e.stranger(); S.purse.cash = 5; S.purse.grain = 200;
      const h = [...e.hh.values()].find(x => x.kind === 'farmer')!; const t0 = e.trust!.trustOf(h.id, PLAYER, e.day);
      S.do({ a: 'give', day: e.day, hh: h.id, ...gift }); step(e, 3); return e.trust!.trustOf(h.id, PLAYER, e.day) - t0;
    };
    const small = rise({ cash: 0.1 }), big = rise({ grain: 60 }), silver = rise({ cash: 1 });
    console.log('[D-450 gift trust rise]', { small: +small.toFixed(3), sack: +big.toFixed(3), shekel: +silver.toFixed(3) });
    expect(small).toBeGreaterThan(0); expect(small).toBeLessThan(0.04);
    expect(big).toBeGreaterThan(small * 2); expect(silver).toBeGreaterThan(small * 2);
  }, 300_000);
  it('the same with a save and a load between the gift and the reading', () => {
    const run = (reload: boolean) => { let e = town(60); const S = e.stranger(); S.purse.cash = 5;
      const h = [...e.hh.values()].find(x => x.kind === 'farmer')!; S.do({ a: 'give', day: e.day, hh: h.id, cash: 0.2 }); step(e, 2);
      if (reload) e = Economy.restore(JSON.parse(JSON.stringify(e.snapshot())), hs, { trust: true });
      step(e, 3); return e.trust!.trustOf(h.id, PLAYER, e.day); };
    expect(run(true)).toBeCloseTo(run(false), 9);
  }, 300_000);
});
