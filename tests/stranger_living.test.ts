// D-455: the stranger's living loop. A man with no house and no season's work can still live by his own choices: a day's
// carrying at the market paid at evening, grain sold to the stalls, bread bought there by the loaf. Economy-level (seed 1).
import { describe, it, expect } from 'vitest';
import { Population } from '../src/people/population';
import { Economy } from '../src/people/economy/world';
import { householdsOf } from '../src/people/economy/chains';
import { PLAYER, MARKET, dayGrain, STR_LAG, chronicleLine, type SAct } from '../src/people/speech/stranger';
import { strangerAsk } from '../src/people/speech/verbs';

const pop = new Population(1), hs = householdsOf(pop);
const town = (to: number) => { const e = new Economy(1, hs, { trust: true }); for (let d = 0; d <= to; d++) e.step(d); return e; };
const evs = (e: Economy, kind: string) => e.events.filter(v => v && v.kind === kind && (v.actor === PLAYER || v.other === PLAYER));
/** the next day the market hires (a seeded draw by day) */
const hireDay = (e: Economy) => { while (!e.stranger().dayCheck(e.day).ok) e.step(e.day + 1); return e.day; };

describe('D-455 the stranger lives by his own choices', () => {
  it('the words: bread by the loaf, a day\'s hire', () => {
    const c = { day: 5, hh: 'h:1', q: 'q', job: 'farmer' };
    expect(strangerAsk('Sell me four loaves of bread.', c)).toMatchObject({ a: 'buy', good: 'grain', qty: 2 });
    expect(strangerAsk('Can I buy some bread?', c)).toMatchObject({ a: 'buy', good: 'grain', qty: 1 });
    expect(strangerAsk('Sell me two measures of barley.', c)).toMatchObject({ a: 'buy', good: 'grain', qty: 20 });
    expect(strangerAsk('Is there work for today? I can carry loads.', c)).toMatchObject({ a: 'daywork' });
    expect(strangerAsk('Do you need a porter?', c)).toMatchObject({ a: 'daywork' });
    expect(strangerAsk('Could I work for you?', c)).toMatchObject({ a: 'seek_work' });
  });
  it('the stalls: bread bought by gesture (no words needed), grain sold for less than it is bought, the market\'s stock moves', () => {
    const e = town(30), S = e.stranger(), M = e.market, day = e.day;
    const g0 = M.grain, c0 = S.purse.cash;
    const v = S.do({ a: 'buy', day, hh: MARKET, good: 'grain', qty: 2 });
    expect(v.ok).toBe(true); expect(S.purse.grain).toBe(2); expect(M.grain).toBeCloseTo(g0 - 2, 6);
    const paid = c0 - S.purse.cash; expect(paid).toBeGreaterThan(2 * e.price('grain', day)); expect(paid).toBeLessThan(2 * e.price('grain', day) * 1.2);
    S.purse.grain = 30; const c1 = S.purse.cash;
    expect(S.do({ a: 'sell', day, hh: MARKET, good: 'grain', qty: 20 }).ok).toBe(true);
    const got = S.purse.cash - c1; expect(got).toBeGreaterThan(0); expect(got / 20).toBeLessThan(paid / 2);
    expect(evs(e, 'bought_at_market').length).toBe(1); expect(evs(e, 'sold_at_market').length).toBe(1);
    expect(chronicleLine('sold_at_market', 'x')).toMatch(/grain sellers/);
    S.purse.cash = 0.001; expect(S.judge({ a: 'buy', day, hh: MARKET, good: 'grain', qty: 10 }).why).toMatch(/not the silver/);
  });
  it('a day\'s hire: taken on once a day, paid a day\'s barley (D-720: in kind, not silver), refused while he has regular work', () => {
    const e = town(30), S = e.stranger(), day = hireDay(e), c0 = S.purse.cash, g0 = S.purse.grain;
    expect(S.do({ a: 'daywork', day }).ok).toBe(true);
    expect(S.judge({ a: 'daywork', day }).ok).toBe(false);
    expect(S.do({ a: 'daypaid', day }).ok).toBe(true); expect(S.purse.grain).toBeCloseTo(g0 + dayGrain(e.price('grain', e.day)), 6); expect(S.purse.cash).toBe(c0);
    expect(S.do({ a: 'daypaid', day }).ok).toBe(false); // (paid once)
    expect(evs(e, 'day_paid').length).toBe(1);
    const farm = [...e.hh.values()].find(h => S.hireCheck(h.id, e.day).ok);
    if (farm) { S.do({ a: 'seek_work', day: e.day, hh: farm.id }); expect(S.judge({ a: 'daywork', day: e.day + 1 }).why).toMatch(/work already/); }
  });
  it('the loop: a month of carrying feeds him and what he has grows; a month idle eats it', () => {
    // (D-720: paid in barley: what he has is his silver and his barley at the market's price)
    const run = (work: boolean) => { const e = town(30), S = e.stranger(); S.hear('Aramaic', 50, 0, false, 30); const has = () => S.purse.cash + S.purse.grain * e.price('grain', e.day); const c0 = has();
      for (let i = 0; i < 30; i++) { const d = e.day + 1; e.step(d); if (work && S.dayCheck(d).ok) { S.do({ a: 'daywork', day: d }); S.do({ a: 'daypaid', day: d }); } }
      for (let i = 0; i < STR_LAG; i++) e.step(e.day + 1); return { e, S, dc: has() - c0 }; };
    const w = run(true), idle = run(false);
    expect(w.dc).toBeGreaterThan(0.1); expect(idle.dc).toBeLessThan(0); expect(w.S.hungry).toBe(0);
    expect(evs(w.e, 'day_paid').length).toBeGreaterThanOrEqual(15);
  });
  it('saved and restored mid-day: the hire and its pay survive', () => {
    const e = town(30), S = e.stranger(), day = hireDay(e); S.do({ a: 'daywork', day });
    const r = Economy.restore(JSON.parse(JSON.stringify(e.snapshot())), hs, { trust: true }), R = r.stranger();
    expect(R.dayHire?.day).toBe(day); expect(R.do({ a: 'daypaid', day } as SAct).ok).toBe(true);
  });
});
