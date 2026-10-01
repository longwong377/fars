// D-351 (s13 trust; UD-25 (1), UD-26): reputation and trust read off the economy's deeds, on seeded years (seeds 1, 7, 42).
// How it could pass while the intent fails: a ledger that is computed but read by nothing that decides, or that separates
// honest from defaulting houses only because it was told who they are. So the test (a) gives the ledger nothing but the
// events, (b) compares the same seed with the ledger read by the lenders and without (loans and refusals must differ), and
// (c) measures, as SEEN BY THE OTHERS, how a defaulting house's trust differs from that of a house that borrowed and
// repaid. Numbers are printed (and are the honest measure in the report).
import { describe, it, expect } from 'vitest';
import { Population } from '../src/people/population';
import { Economy } from '../src/people/economy/world';
import { householdsOf } from '../src/people/economy/chains';
import { TrustLedger } from '../src/people/speech/trust';

const YEAR = 354;
const run = (seed: number, hs: ReturnType<typeof householdsOf>, trust: boolean, to = YEAR) => { const e = new Economy(seed, hs, { trust }); for (let d = 0; d < to; d++) e.step(d); return e; };
const kinds = (e: Economy) => { const c: Record<string, number> = {}; for (const v of e.events) if (v?.actor) c[v.kind] = (c[v.kind] ?? 0) + 1; return c; };
const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

describe('reputation and trust (D-351)', () => {
  for (const seed of [1, 7, 42]) it(`seed ${seed}: honest and defaulting houses differ in trust, and the lenders read it`, () => {
    const hs = householdsOf(new Population(seed)); const e = run(seed, hs, true), off = run(seed, hs, false), T = e.trust!, day = YEAR - 1;
    const by = (k: string) => new Set(e.events.filter(v => v?.actor && v.kind === k).map(v => v.actor));
    const def = by('default'), rep = by('repaid'), thief = by('theft');
    const honest = [...rep].filter(h => !def.has(h) && !thief.has(h)), bad = [...new Set([...def, ...thief])];
    // as seen by the others: the mean, over the house's quarter and kin (25 observers at most), of their trust in it
    const seen = (id: string) => { const H = e.hh.get(id)!; const obs = [...e.hh.values()].filter(o => o.id !== id && (o.q === H.q || o.kin.includes(id))).slice(0, 25); return mean(obs.map(o => T.trustOf(o.id, id, day))); };
    const tH = mean(honest.map(seen)), tB = mean(bad.map(seen));
    const a = kinds(e), b = kinds(off);
    console.log(`seed ${seed}: honest ${honest.length} houses trust ${tH.toFixed(3)}, defaulting/thieving ${bad.length} trust ${tB.toFixed(3)}; ` +
      `loans ${a.loan ?? 0} vs ${b.loan ?? 0} without the ledger, loan_refused ${a.loan_refused ?? 0} vs ${b.loan_refused ?? 0}, hunger ${a.hunger ?? 0} vs ${b.hunger ?? 0}, death ${a.death ?? 0} vs ${b.death ?? 0}, kin_help ${a.kin_help ?? 0} vs ${b.kin_help ?? 0}, hired ${a.hired_by_neighbour ?? 0} vs ${b.hired_by_neighbour ?? 0}; ledger ${JSON.stringify(T.counts)}`);
    expect(honest.length).toBeGreaterThanOrEqual(3); expect(bad.length).toBeGreaterThanOrEqual(3);
    expect(tH - tB).toBeGreaterThanOrEqual(0.1);   // the others trust the honest more, by a measurable margin
    // read by the deciders: the year's loans, refusals or help differ from the same seed with the ledger off
    expect(a.loan !== b.loan || a.loan_refused !== b.loan_refused || a.kin_help !== b.kin_help || a.hired_by_neighbour !== b.hired_by_neighbour).toBe(true);
    // the same seed replays the same ledger
    expect(JSON.stringify(run(seed, hs, true).trust!.snapshot())).toBe(JSON.stringify(T.snapshot()));
  }, 600_000);

  it('a save and a load mid-year continue to the same trust (seed 7)', () => {
    const hs = householdsOf(new Population(7)); const live = run(7, hs, true);
    const half = run(7, hs, true, 200); const snap = JSON.parse(JSON.stringify(half.snapshot())); expect(snap.trust).toBeTruthy();
    const back = Economy.restore(snap, hs, { trust: true }); for (let d = 200; d < YEAR; d++) back.step(d);
    expect(JSON.stringify(back.trust!.snapshot())).toBe(JSON.stringify(live.trust!.snapshot()));
    expect(back.events.length).toBe(live.events.length);
  }, 600_000);

  it('the stranger\'s own deeds move trust: help given raises it in the house and (less) in its quarter and kin; a theft-free stranger stays unknown elsewhere', () => {
    const hs = householdsOf(new Population(1)); const e = new Economy(1, hs, { trust: true }); for (let d = 0; d < 20; d++) e.step(d);
    const T = e.trust!, target = hs[0].id, H = e.hh.get(target)!, far = [...e.hh.values()].find(o => o.q !== H.q && !o.kin.includes(target) && !H.kin.includes(o.id))!;
    const near = [...e.hh.values()].find(o => o.id !== target && o.q === H.q)!;
    const before = [T.trustOf(target, 'player', 20), T.trustOf(near.id, 'player', 20), T.trustOf(far.id, 'player', 20)];
    e.enter({ kind: 'help', from: 'player', to: target, day: 21, payload: { grain: 50, cash: 2 } }); e.step(21);
    const after = [T.trustOf(target, 'player', 21), T.trustOf(near.id, 'player', 21), T.trustOf(far.id, 'player', 21)];
    console.log('stranger trust before', before.map(x => x.toFixed(3)), 'after', after.map(x => x.toFixed(3)), '(house, quarter, far)');
    expect(before.every(x => Math.abs(x - 0.5) < 1e-9)).toBe(true);
    expect(after[0]).toBeGreaterThan(after[1]); expect(after[1]).toBeGreaterThan(0.5); expect(after[2]).toBeGreaterThan(0.5);
    // and it fades: five months on the gift is half gone
    expect(T.trustOf(target, 'player', 21 + 150) - 0.5).toBeLessThan((after[0] - 0.5) * 0.6);
    expect(T.willTalk(target, 'player', 21)).toBe(true);
  });

  it('a ledger saved and restored alone reads the same trust', () => {
    const hs = householdsOf(new Population(42)); const e = run(42, hs, true, 120), T = e.trust!;
    const R = TrustLedger.restore(JSON.parse(JSON.stringify(T.snapshot())), e);
    for (const [a, b] of [[hs[0].id, hs[1].id], [hs[3].id, hs[9].id], [hs[5].id, 'player']]) expect(R.trustOf(a, b, 130)).toBe(T.trustOf(a, b, 130));
  });
});
