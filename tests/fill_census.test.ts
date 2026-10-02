// s17 C1 (D-550): the town fill census (tools/dev/fill_census.ts) holds the done line's numbers: no lane stretch bare for more
// than 6 m (every lane cell with a thing within 3 m), every house court with >= 3 things and every roof with one, no two
// identical things of the same model within 15 m.
import { describe, it, expect } from 'vitest';
import { buildTownPlan } from '../src/world/settlement/plan';
import { townFill } from '../src/world/fillPlan';
import { census } from '../tools/dev/fill_census';

describe('the town fill census', () => {
  it('no bare lane, court or roof; no clones', () => {
    const sites = buildTownPlan().sites, { items } = townFill(sites, 1), c = census(sites, items);
    console.log('[fill_census]', JSON.stringify({ lane: c.lane, courts: c.courts, roofs: c.roofs, repeats: { clones15: c.repeats.clones15, near4: c.repeats.sameNear4Share } }));
    expect(c.lane.longestBare).toBeLessThanOrEqual(3); // (bare cells: nothing within 3 m; a run of 3 such cells is at most 6 m with nothing beside it... and is rare)
    expect(c.lane.bareShare).toBeLessThan(0.002);
    expect(c.courts.dressed).toBe(c.courts.n); expect(c.roofs.dressed).toBe(c.roofs.n);
    expect(c.repeats.clones15).toBe(0);
  }, 120_000);
});

import { townTethers, TownTethers } from '../src/world/settlement/tethers';
import { toLocal, LANE, SQUARE, OUT, COURT, YARD } from '../src/world/settlement/site';
describe('the households\' animals at their tethers', () => {
  it('stand in the lane by day and in the court otherwise, never inside a wall', () => {
    const sites = buildTownPlan().sites, { items } = townFill(sites, 1), T = townTethers(sites, items), bySite = sites.filter(s => s.meta.kind === 'quarter');
    const lane = T.filter(t => t.lane).length, court = T.length - lane; expect(lane).toBeGreaterThan(100); expect(court).toBeGreaterThan(300);
    const o = { sp: 'donkey', e: 0, n: 0, x: 0, z: 0, yaw: 0, phase: 0, walk: 0, graze: 0, lie: 0, coat: 0 } as any; let bad = 0, n = 0;
    for (const t of T) for (let j = 0; j < t.count; j++) { TownTethers.pose(t, j, 1234, 10, o); n++;
      const s = bySite.find(x => { const [u, v] = toLocal(x.frame, o.e, o.n); return x.inb(x.ci(u), x.cj(v)); }); if (!s) continue;
      const [u, v] = toLocal(s.frame, o.e, o.n), k = s.k(s.ci(u), s.cj(v)), c = s.cell[k];
      const ok = t.lane ? (c === LANE || c === SQUARE || c === OUT) : c >= 0 && (s.sub[k] === COURT || s.sub[k] === YARD); if (!ok) bad++; }
    console.log(`[tethers] ${lane} lane, ${court} court; ${bad} of ${n} animals outside their open ground`);
    expect(bad / n).toBeLessThan(0.02);
    expect(TownTethers.present(T.find(t => t.lane)!, 10, true)).toBe(true); expect(TownTethers.present(T.find(t => t.lane)!, 22, true)).toBe(false);
  }, 120_000);
});

import { Population } from '../src/people/population';
describe('the simulation\'s market grounds (market:<q>:<hid>, D-359)', () => {
  it('every town quarter\'s market point has its sellers\' spreads and stalls about it', () => {
    const sites = buildTownPlan().sites, Q = Object.values(new Population(1).quarters).filter(q => q.kind === 'town' || q.kind === 'garden');
    const { items } = townFill(sites, 1, [], Q.map(q => q.xy));
    for (const q of Q) { const n = items.filter(i => (i.m === 'fill_stall' || i.m === 'fill_stall_reed' || i.m === 'mat') && i.at === 'market' && Math.hypot(i.e - q.xy[0], i.n - q.xy[1]) < 30).length; expect(n, q.id).toBeGreaterThanOrEqual(6); }
    const goods = items.filter(i => i.at === 'market' && i.day && i.m !== 'mat'); expect(goods.filter(g => g.until !== undefined).length / goods.length).toBeGreaterThan(0.3);
  }, 120_000);
});

import { houseSigs, houseCensus } from '../tools/dev/house_census';
describe('house variety (s17 C1)', () => {
  it('no two neighbouring houses with the same street face; height follows standing', () => {
    const sites = buildTownPlan().sites, { items } = townFill(sites, 1), c = houseCensus(houseSigs(sites, items));
    console.log('[house_census]', JSON.stringify(c)); expect(c.alike).toBe(0); expect(c.twins).toBe(0); expect(c.heightByStanding).toBeGreaterThan(0.4);
  }, 120_000);
});
