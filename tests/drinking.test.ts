// The evening's drink in company (session 10, D-283; gap hunter C, C-D28): the wine and beer rations issued (E-02) are drunk,
// in the lane with the men and on visits, beer for most and wine in Persian houses, more in the days after the issue, never by
// the young or in a house in mourning; the performance puts the jar on the ground between them.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import type { Seg } from '../src/people/population';
import { WeatherSystem } from '../src/weather/weatherState';
import { performanceFor } from '../src/people/activities';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
let P: any;
beforeAll(() => { const sim = new PeopleSim(1, new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8'))), env); P = (sim as any).pop; });
describe('drinking in company (D-283)', () => {
  it('men drink beer or wine of an evening, the young never, Persian houses wine', () => {
    let n = 0, beer = 0, wine = 0, persWine = 0, persAll = 0;
    for (const d of [3, 40, 120, 200]) for (let pid = 0; pid < P.persons.length; pid += 3) { const p = P.persons[pid]; if ((p.zone !== 'town' && p.zone !== 'plain') || !P.present(pid, d)) continue;
      for (const s of P.plan(pid, d) as Seg[]) { const m = /a jar of (beer|wine)/.exec(s.why); if (!m || /near the (father|mother)|with (his|her) (father|mother)/.test(s.why)) continue; n++; // (a small child taken along)
        expect(P.ageOn(pid, d), `${pid} d${d} ${s.why}`).toBeGreaterThanOrEqual(16); if (m[1] === 'beer') beer++; else wine++;
        if (P.households[P.home(pid, d)].persian) { persAll++; if (m[1] === 'wine') persWine++; } } }
    expect(n).toBeGreaterThan(50); expect(beer).toBeGreaterThan(0); expect(wine).toBeGreaterThan(0); if (persAll) expect(persWine).toBe(persAll);
  }, 180_000);
  it('the performance sets the jar down between them', () => {
    expect(performanceFor('talk', 'sharing a jar of beer with the men of the lane').work!.map(w => w.kind)).toEqual(['jar']);
    expect(performanceFor('talk', 'talking with the men of the lane').work ?? []).toEqual([]);
  });
});
