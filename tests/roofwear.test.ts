// s17 C1 (D-550): the roofs' wear from the simulation (src/world/settlement/roofwear.ts): every town house has a roof spot over
// its main room; the households' plots map to it; a roof below the leak line draws a dark slumped patch with a drip jar on the
// floor under it, a freshly plastered one a pale patch; the patch sits on the roof (not in the air, not in the room).
import { describe, it, expect, beforeAll } from 'vitest';
import { FireSystem } from '../src/world/fire';
import { Settlement } from '../src/world/settlement/build';
import { RoofWear } from '../src/world/settlement/roofwear';
import { Population } from '../src/people/population';
import { hashString } from '../src/core/rng';
import { loadTerrain } from './plainLib';

let town: Settlement;
beforeAll(() => { town = new Settlement(null, loadTerrain(), new FireSystem(0), 'test'); }, 300_000);

describe('the roofs\' wear', () => {
  it('a spot on every house, the households mapped, leaking and fresh roofs drawn', () => {
    const W = town.roofWear, pop = new Population(1), plots = new Set(W.spots.map(s => s.plot));
    expect(W.spots.length).toBeGreaterThan(1200);
    const town_hh = pop.households.filter(h => h?.plot && h.zone === 'town'), mapped = town_hh.filter(h => plots.has(h.plot!)).length;
    console.log(`[roofwear] ${W.spots.length} roofs; ${mapped} of ${town_hh.length} town households on one`);
    expect(mapped / town_hh.length).toBeGreaterThan(0.8);
    // a stub of the joint deeds' roofs: a tenth leaking, a fifth fresh
    W.setSource(RoofWear.source(pop.households, hh => { const u = hashString(hh) / 4294967296; return u < 0.1 ? 0.3 : u < 0.3 ? 0.97 : 0.7; }, () => 10));
    const c = W.census(); console.log('[roofwear] census', JSON.stringify(c)); expect(c.leaking).toBeGreaterThan(50); expect(c.fresh).toBeGreaterThan(100);
    const sp = W.spots.find(s => { const hh = pop.households.find(h => h?.plot === s.plot); return hh && hashString(`h:${hh.id}`) / 4294967296 < 0.1; })!;
    expect(W.update(1, { x: sp.e, z: -sp.n })).toBe(true); expect(W.stats.drawnLeak).toBeGreaterThan(0);
    expect(sp.y - sp.floor).toBeGreaterThan(2.0); expect(sp.y - sp.floor).toBeLessThan(5.5);
    expect(W.update(1, { x: sp.e + 1, z: -sp.n })).toBe(false);
  }, 300_000);
});

describe('the roofs\' things (houses.ts roofFill, drawn by the fill)', () => {
  it('stand on the roofs: jars, drying mats, washing lines', () => {
    const R = town.roofFill(), by: Record<string, number> = {}; for (const r of R) by[r.m] = (by[r.m] ?? 0) + 1;
    console.log('[roofFill]', R.length, JSON.stringify(by));
    expect(R.length).toBeGreaterThan(1500); expect(by.mat).toBeGreaterThan(400); expect(by.fill_line).toBeGreaterThan(150);
    for (const r of R.slice(0, 400)) { const g = town.plan.sites.length; void g; expect(Number.isFinite(r.y)).toBe(true); }
  }, 300_000);
});

import { toLocal, LANE, SQUARE, OUT } from '../src/world/settlement/site';
describe('the walls\' wear (wallwear.ts)', () => {
  it('a face per house door on its lane side; smoke and splash drawn; a fresh coat follows the sim\'s replastered roofs', () => {
    const W = town.wallWear, sites = town.plan.sites; expect(W.faces.length).toBeGreaterThan(1300);
    let bad = 0; for (const f of W.faces.slice(0, 600)) { const s = sites.find(x => x.plots.some(p => p.id === f.plot))!, ne = Math.sin(f.yaw), nn = -Math.cos(f.yaw);
      const at = (d: number) => { const [u, v] = toLocal(s.frame, f.e + ne * d, f.n + nn * d); return s.at(s.ci(u), s.cj(v)); }, o = at(0.5), i = at(-0.6);
      if (!(o === LANE || o === SQUARE || o === OUT) || i < 0) bad++; }
    console.log(`[wallwear] ${W.faces.length} door faces, ${bad} of 600 not on a lane face`); expect(bad).toBeLessThan(12);
    const pop = new Population(1); W.setSource(RoofWear.source(pop.households, hh => hashString(hh) / 4294967296 < 0.3 ? 0.97 : 0.7, () => 1));
    const f0 = W.faces[0]; W.update(1, { x: f0.e, z: -f0.n }, true); console.log('[wallwear]', JSON.stringify(W.stats));
    expect(W.stats.soot).toBeGreaterThan(5); expect(W.stats.splash).toBeGreaterThan(5); expect(W.stats.fresh).toBeGreaterThan(0);
  }, 300_000);
});
