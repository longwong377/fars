// D-374: a world loaded from the fixture cache is the world jumped to: the same plans, life records and economy.
import { describe, it, expect } from 'vitest';
import { rmSync } from 'node:fs';
import { simAt, nav, envOf } from './sim_fixture';
import { PeopleSim } from '../src/people/sim';
import { lifeRecord } from '../src/people/converse/life';

describe('D-374 the cached world', () => {
  it('loads what the jump made: plans, life records and the economy agree', () => {
    rmSync('.cache/sims', { recursive: true, force: true });
    const t0 = performance.now(); const a = simAt(1, 40, 10); const tJump = performance.now() - t0;
    const t1 = performance.now(); const b = simAt(1, 40, 10); const tLoad = performance.now() - t1;
    const c = new PeopleSim(1, nav(), envOf(1)); c.jumpTo(40 * 24 + 10);
    console.log('[fixture] jump', (tJump / 1000).toFixed(1), 's; load', (tLoad / 1000).toFixed(1), 's');
    for (const pid of [5, 500, 5000, 20000, 40000]) for (const d of [40, 41]) expect(JSON.stringify(b.pop.plan(pid, d))).toBe(JSON.stringify(c.pop.plan(pid, d)));
    for (const pid of [5, 500, 5000]) expect(JSON.stringify(lifeRecord(b.pop, b.cal, pid, 40, 10))).toBe(JSON.stringify(lifeRecord(c.pop, c.cal, pid, 40, 10)));
    const Eb = b.econTo(41), Ec = c.econTo(41); expect(Eb.events.length).toBe(Ec.events.length);
    expect(tLoad).toBeLessThan(tJump / 3); void a;
  }, 900_000);
});
