// D-388 (UD-30): the day advanced across frames (LivingWorld.advanceSliced, PeopleSim.stepAhead) is the day advanced at once:
// the same economy events and the same save, from the same world, over a few days with the game's options (bonds, asks).
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { simAt } from './sim_fixture';
import { jclone } from '../src/people/asks/jclone';

const h = (x: unknown) => createHash('sha1').update(JSON.stringify(x)).digest('hex');
describe('the sliced day', () => {
  it('gives the same events and save as the whole day', () => {
    const D0 = 60, N = 4, opts = { bonds: true, asks: true };
    simAt(1, D0, 10, opts); // (the cache made first: a world jumped to its day and one loaded from its save are not the same world, D-388)
    const A = simAt(1, D0, 10, opts), B = simAt(1, D0, 10, opts);
    for (let d = D0 + 1; d <= D0 + N; d++) { A.econTo(d); A.t = d * 24 + 10; }
    let calls = 0;
    for (let d = D0 + 1; d <= D0 + N; d++) { B.t = (d - 2) * 24 + 10; while (!B.stepAhead(2)) calls++; B.t = d * 24 + 10; }
    expect(calls).toBeGreaterThan(N * 10); // (it did take many frames)
    const EA = A.econTo(D0 + N), EB = B.econTo(D0 + N);
    expect(EB.events.length).toBe(EA.events.length);
    expect(h(EB.events)).toBe(h(EA.events));
    expect(h(B.save())).toBe(h(A.save()));
  }, 600_000);
  it('a read of the economy meanwhile finishes the day begun', () => {
    const S = simAt(1, 60, 10, { bonds: true, asks: true });
    const u = S.living.day; expect(S.living.advanceSliced(u + 2, 0.01)).toBe(false); expect(S.living.day).toBe(u + 1); // (day u+1 begun, not done)
    S.econTo(u); expect(S.living.advanceSliced(u + 1, 0.01)).toBe(true); expect(S.living.day).toBe(u + 1); // (finished by the read, nothing more)
  }, 600_000);
  it('jclone is JSON.parse(JSON.stringify(x))', () => {
    const x = { a: 1, b: undefined, c: [1, undefined, NaN, -0, () => 1], d: { e: Infinity, f: 'g', 2: 'two', 1: 'one' }, n: null };
    expect(JSON.stringify(jclone(x))).toBe(JSON.stringify(JSON.parse(JSON.stringify(x))));
    expect(jclone(x)).toStrictEqual(JSON.parse(JSON.stringify(x)));
  });
});
