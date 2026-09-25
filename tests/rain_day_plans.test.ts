// A day of rain from midnight to midnight (the forced `?weather=rain` of the rain-columns moment) must plan: a homemaker's
// hours at home were asked to run to 24.5 h, the plan stops at midnight, and the loop never ended (session 7: the moment's
// first frame hung for 58 min at high and medium; the page's stack stood in homemaker → homeHours).
// D-219: the cause upstream — the open-air ration issue pushed past every wet spell of the day, a camp woman walking to the
// depot at 23:32 and queueing at 23:57 — is capped: the issue waits for another day when the rain would push it past dusk.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { rainShiftedIssue } from '../src/people/population';

describe('a day of unbroken rain', () => {
  it('the rain shift of an open-air ration issue stops at dusk', () => {
    expect(rainShiftedIssue(9, [], 18)).toBe(9); // dry: at the issue hour
    expect(rainShiftedIssue(9, [[8.5, 11]], 18)).toBe(11); // after the shower
    expect(rainShiftedIssue(9, [[8.5, 11], [11.2, 12]], 18)).toBe(12); // after the showers that follow within the queue
    expect(rainShiftedIssue(9, [[0, 24]], 18)).toBeNull(); // rain all day: not today
    expect(rainShiftedIssue(9, [[8, 17.8]], 18)).toBeNull(); // the rain ends too near dusk for the queue
    expect(rainShiftedIssue(19, [], 18)).toBe(19); // (an unshifted issue hour is the calendar's)
  });
  it('plans the homemaker who hung, and a sample of the town, within the day; nobody queues for a ration after dark', () => {
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const env = (): Env => ({ rain: 1, lightning: false, windMs: 6, tempC: 9 });
    const P = (new PeopleSim(1, nav, env) as any).pop;
    const segs = P.plan(1190, 2);
    expect(segs.length).toBeGreaterThan(3);
    expect(segs[segs.length - 1].t1).toBeLessThanOrEqual(24 + 1e-9);
    expect(segs.filter((s: any) => s.act === 'queue' && s.t0 > 20), 'the camp woman (1190) queues at night').toEqual([]);
    let late = 0;
    for (let pid = 0; pid < P.persons.length; pid += 37) for (const s of P.plan(pid, 2)) { expect(s.t1).toBeGreaterThanOrEqual(s.t0); if (s.act === 'queue' && s.t0 > 20) late++; }
    expect(late, 'ration queues after 20:00 in the sample').toBe(0);
  }, 300_000);
});
