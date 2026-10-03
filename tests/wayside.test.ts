// s18 C15 (D-801): the roads of the plain are never an empty sheet: wells, halts with carts, field shrines, the road's dung
import { describe, it, expect } from 'vitest';
import { loadTerrain } from './plainLib';
import { buildWayside } from '../src/world/plain/wayside';
import { settlementZones, pointInPolygon } from '../src/world/plain/data';

describe('the roadside (D-801)', () => {
  const W = buildWayside(loadTerrain());
  it('every road carries wells, halts and shrines at walking intervals, none in a settlement zone', () => {
    console.log(JSON.stringify(W.info));
    expect(W.info.roads).toBeGreaterThanOrEqual(4);
    expect(W.info.wells).toBeGreaterThanOrEqual(8); expect(W.info.halts).toBeGreaterThanOrEqual(6); expect(W.info.shrines).toBeGreaterThanOrEqual(5); expect(W.info.carts).toBe(W.info.halts);
    const zones = settlementZones(); for (const p of W.places) expect(zones.some(z => pointInPolygon(p.e, p.n, z)), p.id).toBe(false);
    // the Naqsh-e Rustam road (Terrace to the cliff, ~6 km) has at least two of each stop
    for (const k of ['well', 'halt']) expect(W.places.filter(p => p.id.startsWith(`${k}:road_naqsh_e_rustam`)).length, k).toBeGreaterThanOrEqual(2);
    const tris = W.parts.reduce((a, g) => a + g.getAttribute('position').count / 3, 0); console.log('wayside triangles', tris); expect(tris).toBeLessThan(15000);
  });
});
