// D-351 (s13 trust; UD-25 (4), UD-26): haggling and barter, resolved by the simulation, on seeded years (seeds 1, 7, 42).
// How it could pass while the intent fails: deals that always land on the list price (no haggle), or that enter the economy
// as nothing the chains can see. So the test measures the price SPREAD (deals must spread, and move with trust, urgency and
// skill in the stated directions), checks the deal's effect on the stores (conservation: what one side gains the other
// loses), that barter is value-balanced, that deals are events with causes joined to chains, and that the year replays.
import { describe, it, expect } from 'vitest';
import { Population } from '../src/people/population';
import { Economy } from '../src/people/economy/world';
import { chains, householdsOf } from '../src/people/economy/chains';
import { haggle, haggleRound, refPrice, type HaggleRecord } from '../src/people/speech/haggle';

const YEAR = 354;
const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
function year(seed: number, hs: ReturnType<typeof householdsOf>) {
  const e = new Economy(seed, hs, { trust: true }), log: HaggleRecord[] = [];
  for (let d = 0; d < YEAR; d++) { e.step(d); log.push(...haggleRound(e, d)); }
  return { e, log };
}

describe('haggling and barter (D-351)', () => {
  for (const seed of [1, 7, 42]) it(`seed ${seed}: a year of haggles spreads in price, moves with trust, and joins the chains`, () => {
    const hs = householdsOf(new Population(seed)); const { e, log } = year(seed, hs);
    const done = log.filter(r => r.res.ok), failed = log.filter(r => !r.res.ok);
    const ratio = done.map(r => r.res.price / (r.res.ref * r.qty));
    const why: Record<string, number> = {}; for (const r of failed) why[r.res.why ?? '?'] = (why[r.res.why ?? '?'] ?? 0) + 1;
    const low = done.filter(r => r.res.trust.sellerInBuyer < 0.45).map(r => r.res.price / (r.res.ref * r.qty)), hi = done.filter(r => r.res.trust.sellerInBuyer >= 0.5).map(r => r.res.price / (r.res.ref * r.qty));
    const barter = done.filter(r => r.res.pay?.kind === 'barter').length;
    const cs = chains(e.events), withH = cs.filter(c => c.path.some(i => e.events[i].kind === 'haggle_deal'));
    const deals = e.events.filter(v => v?.actor && v.kind === 'haggle_deal');
    console.log(`seed ${seed}: ${log.length} tried, ${done.length} deals (${barter} barter), failed ${JSON.stringify(why)}; price/list mean ${mean(ratio).toFixed(3)} sd ${sd(ratio).toFixed(3)} ` +
      `min ${Math.min(...ratio).toFixed(3)} max ${Math.max(...ratio).toFixed(3)}; distrusted-seller (<0.45) ${mean(low).toFixed(3)} (n ${low.length}) vs trusted (>=0.5) ${mean(hi).toFixed(3)} (n ${hi.length}); ` +
      `haggle_deal events ${deals.length}, with causes ${deals.filter(v => v.causes.length).length}; chains ${cs.length}, containing a haggle ${withH.length}: ${[...new Set(withH.map(c => c.shape))].slice(0, 3).join(' | ')}`);
    expect(done.length).toBeGreaterThanOrEqual(60);
    expect(sd(ratio)).toBeGreaterThanOrEqual(0.05);                       // a real spread, not the list price
    expect(Math.max(...ratio) - Math.min(...ratio)).toBeGreaterThanOrEqual(0.25);
    if (low.length >= 10 && hi.length >= 10) expect(mean(low)).toBeGreaterThan(mean(hi)); // distrust costs the buyer
    expect(deals.length).toBe(done.reduce((a, r) => a + r.res.intents.length, 0));
    expect(deals.filter(v => v.causes.length).length).toBeGreaterThanOrEqual(deals.length * 0.5);
    expect(withH.length).toBeGreaterThanOrEqual(1);
    // the year replays the same
    const again = year(seed, hs); expect(again.log.length).toBe(log.length); expect(JSON.stringify(again.log.slice(-20).map(r => r.res.price))).toBe(JSON.stringify(log.slice(-20).map(r => r.res.price)));
  }, 900_000);

  it('the price moves the stated way with urgency, trust and skill; a deal conserves stores; barter balances in value', () => {
    const hs = householdsOf(new Population(1)); const e = new Economy(1, hs, { trust: true }); for (let d = 0; d < 30; d++) e.step(d);
    const H = [...e.hh.values()].filter(h => h.kind === 'farmer' || h.kind === 'rich'); const S = H[0], B = H.find(h => h.id !== S.id && h.q !== S.q)!;
    S.grain = 5000; B.cash = 50; B.goods = 10;
    const at = (o: any) => haggle(e, { buyer: B.id, seller: S.id, good: 'grain', qty: 50, day: 30, apply: false, ...o });
    const calm = at({ urgency: { buyer: 0.1, seller: 0.1 }, skill: { buyer: 0.5, seller: 0.5 } }), desperate = at({ urgency: { buyer: 0.9, seller: 0.1 }, skill: { buyer: 0.5, seller: 0.5 } });
    const skilled = at({ urgency: { buyer: 0.5, seller: 0.5 }, skill: { buyer: 0.85, seller: 0.3 } }), unskilled = at({ urgency: { buyer: 0.5, seller: 0.5 }, skill: { buyer: 0.3, seller: 0.85 } });
    expect(calm.ok && desperate.ok && skilled.ok && unskilled.ok).toBe(true);
    expect(desperate.price).toBeGreaterThan(calm.price); expect(skilled.price).toBeLessThan(unskilled.price);
    // the seller's distrust of the buyer: after a default-like mark the price rises
    const base = at({ urgency: { buyer: 0.4, seller: 0.4 }, skill: { buyer: 0.5, seller: 0.5 } }).price;
    e.trust!.note(S.id, B.id, -0.8, 30); const wary = at({ urgency: { buyer: 0.4, seller: 0.4 }, skill: { buyer: 0.5, seller: 0.5 } });
    expect(wary.ok ? wary.price : Infinity).toBeGreaterThan(base);
    e.trust!.note(S.id, B.id, 0.8, 30); // (restore)
    // conservation, and a cash deal moves the stores by exactly the qty and the price
    const g0 = S.grain + B.grain, c0 = S.cash + B.cash, r = haggle(e, { buyer: B.id, seller: S.id, good: 'grain', qty: 50, day: 30, pay: 'cash' });
    expect(r.ok).toBe(true); expect(S.grain + B.grain).toBeCloseTo(g0, 6); expect(S.cash + B.cash).toBeCloseTo(c0, 6); expect(r.intents.length).toBe(2);
    // barter: a buyer with no silver pays in goods, at value less a tenth, the ledger of goods balanced
    B.cash = 0; B.goods = 40; const gd0 = S.goods + B.goods, rb = haggle(e, { buyer: B.id, seller: S.id, good: 'grain', qty: 50, day: 30 });
    expect(rb.ok).toBe(true); expect(rb.pay?.kind).toBe('barter'); expect(S.goods + B.goods).toBeCloseTo(gd0, 6);
    expect(rb.pay!.qty! * refPrice(e, 'goods', 30) * 0.9).toBeGreaterThanOrEqual(rb.price - 1e-9);
    expect(rb.pay!.qty! * refPrice(e, 'goods', 30) * 0.9).toBeLessThan(rb.price + refPrice(e, 'goods', 30) * 0.9 + 1e-9);
    // nothing to pay with: refused and said so; nothing spare: refused
    B.cash = 0; B.goods = 0; B.fuel = 0; expect(haggle(e, { buyer: B.id, seller: S.id, good: 'grain', qty: 50, day: 30, apply: false }).ok).toBe(false);
    S.grain = 1; expect(haggle(e, { buyer: B.id, seller: S.id, good: 'grain', qty: 50, day: 30, apply: false }).why).toBe('seller has no spare');
  });

  it('the stranger haggles with a house: only the household side changes; a save keeps the ledger of the deal', () => {
    const hs = householdsOf(new Population(7)); const e = new Economy(7, hs, { trust: true }); for (let d = 0; d < 40; d++) e.step(d);
    const S = [...e.hh.values()].find(h => h.kind === 'farmer')!; S.grain = 4000;
    const r = haggle(e, { buyer: 'player', seller: S.id, good: 'grain', qty: 40, day: 40, urgency: { buyer: 0.5 } }); e.step(41);
    expect(r.ok).toBe(true); expect(r.intents.length).toBe(1); expect(e.trust!.trustOf(S.id, 'player', 41)).toBeGreaterThan(0.5);
    const back = Economy.restore(JSON.parse(JSON.stringify(e.snapshot())), hs, { trust: true });
    expect(back.trust!.trustOf(S.id, 'player', 41)).toBe(e.trust!.trustOf(S.id, 'player', 41));
  });
});
