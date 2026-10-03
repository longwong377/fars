// D-650: a day change behind the world's clock. A jump made across frames (PeopleSim.jumpTo with a slice: the living world's
// days stepped a part at a time, the people kept as they were until the day is reached) is the jump made at once: the same
// events and the same save; and the day's turn with the days ahead made ready each step (aheadMs) is the turn made on demand.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { simAt, nav, envOf } from './sim_fixture';
import { unpackJSON } from '../src/people/savepack';
import { PeopleSim } from '../src/people/sim';

const h = (x: unknown) => createHash('sha1').update(JSON.stringify(x)).digest('hex');
/** the save without the minds' own cost counters (deeds.agency.st: wall-clock ms, which differ between any two runs) */
const world = (S: PeopleSim) => { const s: any = S.save(); if (s.deeds) { const d: any = unpackJSON(s.deeds.z); if (d.agency) delete d.agency.st; s.deeds = d; } return h(s); };
const opts = { bonds: true, asks: true };
describe('the day change (D-650)', () => {
  it('a jump of days made across frames is the jump made at once', () => {
    const D0 = 60, D1 = 64;
    simAt(1, D0, 10, opts); // (the cache made first: a world jumped to its day and one loaded from its save are not the same world)
    const A = simAt(1, D0, 10, opts), B = simAt(1, D0, 10, opts);
    expect(A.jumpTo(D1 * 24 + 10)).toBe(true);
    let calls = 0, t = D1 * 24 + 9.5;
    for (;;) { const done = B.jumpTo(t, 5); calls++;
      if (done) break; expect(B.catchingUp).toBe(true); expect(B.t).toBe(D0 * 24 + 10); t = Math.min(D1 * 24 + 10, t + 0.01); } // (the clock runs on meanwhile; the people wait)
    if (t < D1 * 24 + 10) B.jumpTo(D1 * 24 + 10);
    expect(B.catchingUp).toBe(false);
    expect(calls).toBeGreaterThan(D1 - D0); // (it did take many frames)
    expect(h(B.econTo(D1).events)).toBe(h(A.econTo(D1).events));
    expect(world(B)).toBe(world(A));
  }, 900_000);
  it('from a new world (the relations’ first weeks, the first plans): the sliced jump is the whole jump', () => {
    const A = new PeopleSim(1, nav(), envOf(1), opts), B = new PeopleSim(1, nav(), envOf(1), opts);
    A.jumpTo(10); A.jumpTo(3 * 24 + 10); let calls = 0; while (!B.jumpTo(10, 5)) calls++; while (!B.jumpTo(3 * 24 + 10, 5)) calls++;
    expect(calls).toBeGreaterThan(20);
    expect(h(B.econTo(3).events)).toBe(h(A.econTo(3).events));
    expect(world(B)).toBe(world(A));
  }, 900_000);
  it('the day turned with tomorrow made ready each step is the day turned on demand', () => {
    const D0 = 60;
    simAt(1, D0, 22, opts); // (the cache made first, as above: right after a source change the first call jumps, the second loads)
    const A = simAt(1, D0, 22, opts), B = simAt(1, D0, 22, opts); B.aheadMs = 3;
    let readyBy = -1;
    for (let i = 0; i < 6 * 60; i++) { // three hours of 30-second steps through midnight
      A.step(30); B.step(30); if (readyBy < 0 && B.living.day >= D0 + 2) readyBy = B.t;
    }
    expect(readyBy).toBeGreaterThan(0); expect(readyBy).toBeLessThan((D0 + 1) * 24); // (tomorrow's world was made before midnight)
    const u = Math.max(A.living.day, B.living.day); A.econTo(u); B.econTo(u); // (B's living world is ahead by design: both brought to its day)
    expect(h(B.econTo(u).events)).toBe(h(A.econTo(u).events));
    expect(world(B)).toBe(world(A));
  }, 900_000);
});
