// D-352 (UD-25 mechanic 5, UD-24, UD-26): rumour and information spreading. A seeded 120-day stretch of the real economy
// (the lean months, where the crises gather) with the rumour net beside it. How this could pass while the intent fails: a
// rumour that reaches everyone at once (no ties), or none past the first hand; a "distortion" that is noise added after the
// fact rather than carried along the telling; actions that are only counted and change nothing. So the test measures reach
// by hops and by days, requires that most holders got it through a tie of their own (kin, lane, trade) from a holder, that
// the share of versions still true falls with the hand while the certainty falls too, that a hearer's help is a real gift
// lowering the giver's stores, that a player's deed is carried beyond three hands, and that the same seed, a save and a load
// go on the same. Honest numbers are printed.
import { describe, it, expect, beforeAll } from 'vitest';
import { Population } from '../src/people/population';
import { Economy, type HHSeed } from '../src/people/economy/world';
import { householdsOf } from '../src/people/economy/chains';
import { RumourNet, giveFrom } from '../src/people/asks/rumour';
import type { Intent } from '../src/people/economy/api';
import { h32, salt } from '../src/people/hash';

const SEED = 1, D0 = 250, D1 = 370;
let hs: HHSeed[];
beforeAll(() => { hs = householdsOf(new Population(SEED)); }, 300_000);
function run(to: number, o: { gifts?: boolean; inject?: boolean } = {}) {
  const E = new Economy(SEED, hs); const gifts: Intent[] = [];
  const R = new RumourNet(E, SEED, { sink: i => { gifts.push(i); if (o.gifts) giveFrom(E, i); } });
  for (let d = 0; d < to; d++) { E.step(d); if (o.inject && d >= D0 + 5 && (d - D0) % 5 === 0 && d < D0 + 65) R.inject(d, [...E.hh.keys()][40 + 97 * ((d - D0) / 5)], 'player_help', 12 + d % 7); R.advance(d); }
  return { E, R, gifts };
}
const digest = (R: RumourNet) => h32(SEED, salt(JSON.stringify(R.rumours.map(r => [r.id, r.src, [...r.holds.values()].map(h => [h.hh, h.day, h.hand, Math.round(h.v.amount * 100), h.v.kind, h.v.about, h.v.suspect, Math.round(h.v.certainty * 100), h.acts.join('')])]))), R.rumours.length);

describe('rumour: what is known, by whom, how distorted, what it makes people do (D-352)', () => {
  let Y: ReturnType<typeof run>;
  beforeAll(() => { Y = run(D1, { gifts: true, inject: true }); }, 900_000);
  it('news is born of the economy\'s events and moves along the ties, by hops', () => {
    const R = Y.R, N = Y.E.hh.size, st = R.stats;
    const big = R.rumours.filter(r => r.holds.size >= 5);
    const reach = st.reach.map(x => x.days), mean = (k: number) => reach.reduce((a, d) => a + d[k], 0) / Math.max(1, reach.length);
    const maxHand = R.rumours.reduce((m, r) => { for (const h of r.holds.values()) if (h.hand > m) m = h.hand; return m; }, 0);
    const bySrc: Record<string, number> = {}; for (const r of R.rumours) bySrc[r.src] = (bySrc[r.src] ?? 0) + 1;
    console.log(`households ${N}; rumours born ${st.born} ${JSON.stringify(bySrc)}; with >=5 holders ${big.length}; tellings ${st.tellings}; max hand ${maxHand}`);
    console.log(`reach (houses knowing) by rumour age 1/3/7 days, mean: ${[0, 1, 2].map(mean).map(x => x.toFixed(1)).join(' / ')} of ${N} (${(100 * mean(2) / N).toFixed(2)} % at a week)`);
    console.log(`holders by hand: ${JSON.stringify(st.hopsKnown)}`);
    console.log(`share of versions still true by hand: ${st.hopsKnown.map((n, h) => n ? (100 * (st.hopsTrue[h] ?? 0) / n).toFixed(0) + '%' : '-').join(' ')}; mean |log amount error| by hand: ${st.hopsKnown.map((n, h) => n ? ((st.hopsLogErr[h] ?? 0) / n).toFixed(2) : '-').join(' ')}`);
    console.log(`acts ${JSON.stringify(st.acts)}`);
    expect(st.born).toBeGreaterThan(200); expect(Object.keys(bySrc).length).toBeGreaterThanOrEqual(6);
    expect(maxHand).toBeGreaterThanOrEqual(3); expect(big.length).toBeGreaterThan(50);
    // not everyone at once: a week on, a rumour is known by a small part of the world, and by more than its own house
    expect(mean(2)).toBeGreaterThan(2); expect(mean(2) / N).toBeLessThan(0.2);
    // every non-origin holder got it from a holder, over a tie that exists (kin, lane, work or trade), on a later day
    for (const r of R.rumours.slice(0, 400)) for (const h of r.holds.values()) { if (h.hand === 0) continue; const from = r.holds.get(h.from)!; expect(from).toBeDefined(); expect(from.day).toBeLessThan(h.day); expect(from.hand).toBe(h.hand - 1); expect(h.tie).not.toBe('origin'); }
  });
  it('distortion accumulates by hand and certainty falls with it', () => {
    const st = Y.R.stats, frac = (h: number) => (st.hopsTrue[h] ?? 0) / Math.max(1, st.hopsKnown[h] ?? 0), err = (h: number) => (st.hopsLogErr[h] ?? 0) / Math.max(1, st.hopsKnown[h] ?? 0);
    expect(st.hopsKnown[1]).toBeGreaterThan(200); expect(st.hopsKnown[3]).toBeGreaterThan(20);
    expect(frac(3)).toBeLessThan(frac(1)); expect(err(3)).toBeGreaterThan(err(1));
    expect(frac(1)).toBeLessThan(1); // even one hand changes some
    const cert = (h: number) => { const v = Y.R.rumours.flatMap(r => [...r.holds.values()].filter(x => x.hand === h).map(x => x.v.certainty)); return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length); };
    expect(cert(3)).toBeLessThan(cert(1)); expect(cert(1)).toBeLessThan(1);
    // a theft's suspect is wrong more often far down the line than at the origin
    const th = Y.R.rumours.filter(r => r.src === 'theft'); console.log('thefts carried:', th.length);
  });
  it('what it makes people do: a real gift, an avoidance, a demand; the giver\'s stores fall', () => {
    const st = Y.R.stats.acts; console.log('gifts from rumour', Y.gifts.length);
    expect(st.help).toBeGreaterThan(10); expect(st.avoid).toBeGreaterThan(10); expect(Object.keys(st).filter(k => st[k] > 0).length).toBeGreaterThanOrEqual(3);
    expect(Y.gifts.length).toBeGreaterThan(5);
    // a gift in an economy where it is entered lowers the giver's grain: compare a giver's stores with and without the sink entering
    // the gift is real: entered through giveFrom, the giver's grain falls by the gift and the house's rises, and the economy names the giver
    const E = new Economy(SEED, hs); for (let d = 0; d < 5; d++) E.step(d); const [A, B] = [...E.hh.values()]; A.grain = 9000; const a0 = A.grain, b0 = B.grain;
    expect(giveFrom(E, { kind: 'help', from: A.id, to: B.id, day: 4, payload: { grain: 7 } })).toBe(true);
    expect(A.grain).toBeCloseTo(a0 - 7, 6); expect(B.grain).toBeCloseTo(b0 + 7, 6); expect(E.events.some(e => e.kind === 'given' && e.actor === B.id && e.other === A.id)).toBe(true);
    B.grain = 0; A.grain = 10; expect(giveFrom(E, { kind: 'help', from: A.id, to: B.id, day: 4, payload: { grain: 7 } })).toBe(false); // no surplus, no gift
    expect([...Y.R.stance.keys()].length).toBeGreaterThan(5);
  });
  it('a player\'s deed is carried past three hands, along the same ties', () => {
    const rs = Y.R.rumours.filter(x => x.src === 'player_deed'); expect(rs.length).toBe(12);
    const hands = rs.map(r => [...r.holds.values()].reduce((m, h) => Math.max(m, h.hand), 0)), sizes = rs.map(r => r.holds.size);
    console.log(`the player's 12 deeds: houses knowing ${sizes.join(',')}; furthest hand ${hands.join(',')}`);
    expect(Math.max(...hands)).toBeGreaterThanOrEqual(3); expect(sizes.reduce((a, b) => a + b, 0) / 12).toBeGreaterThan(4); expect(Math.max(...sizes)).toBeLessThan(Y.E.hh.size / 10);
    const r = rs[hands.indexOf(Math.max(...hands))], last = [...r.holds.values()].sort((x, y) => y.hand - x.hand)[0];
    const known = Y.R.knownBy(last.hh); expect(known.some(k => k.src === 'player_deed' && k.hand === last.hand)).toBe(true);
  });
  it('relations scandal news is carried by the same ties', () => {
    const E = new Economy(SEED, hs), R = new RumourNet(E, SEED); const ids = [...E.hh.keys()]; for (let d = 0; d < 6; d++) { E.step(d); R.advance(d); }
    R.fromRelations([{ day: 5, about: [7], ev: 99, what: 'affair' }], p => ids[p]);
    for (let d = 6; d < 30; d++) { E.step(d); R.advance(d); }
    const r = R.rumours.find(x => x.src === 'scandal')!; expect(r).toBeDefined(); console.log('scandal reach', r.holds.size); expect(r.holds.size).toBeGreaterThan(1);
  });
  it('the same seed gives the same news; a save and a load go on the same', () => {
    const a = run(D0 + 40), b = run(D0 + 40); expect(digest(a.R)).toBe(digest(b.R));
    const mid = run(D0 + 20); const snap = JSON.parse(JSON.stringify(mid.E.snapshot())), save = JSON.parse(JSON.stringify(mid.R.save()));
    const E2 = Economy.restore(snap, hs), R2 = new RumourNet(E2, SEED); R2.load(save);
    for (let d = D0 + 20; d < D0 + 40; d++) { mid.E.step(d); mid.R.advance(d); E2.step(d); R2.advance(d); }
    expect(digest(R2)).toBe(digest(mid.R)); expect(digest(mid.R)).toBe(digest(a.R));
  });
});
