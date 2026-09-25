// A day of rain from midnight to midnight (the forced `?weather=rain` of the rain-columns moment) must plan: a homemaker's
// hours at home were asked to run to 24.5 h, the plan stops at midnight, and the loop never ended (session 7: the moment's
// first frame hung for 58 min at high and medium; the page's stack stood in homemaker → homeHours).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';

describe('a day of unbroken rain', () => {
  it('plans the homemaker who hung, and a sample of the town, within the day', () => {
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const env = (): Env => ({ rain: 1, lightning: false, windMs: 6, tempC: 9 });
    const P = (new PeopleSim(1, nav, env) as any).pop;
    const segs = P.plan(1190, 2);
    expect(segs.length).toBeGreaterThan(3);
    expect(segs[segs.length - 1].t1).toBeLessThanOrEqual(24 + 1e-9);
    for (let pid = 0; pid < P.persons.length; pid += 37) for (const s of P.plan(pid, 2)) expect(s.t1).toBeGreaterThanOrEqual(s.t0);
  }, 300_000);
});
