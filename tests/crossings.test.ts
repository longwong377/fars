// D-257: the roads cross the Pulvar and the Kur at fords (gap hunters A061 / B-022 / W-014): every place a road as drawn
// meets a river has a ford; the causeway sits in the water it must (breaking the surface at the Pulvar's low water, under
// it in flood), the stepping stones stand clear of the low water, and the Kur's fords carry a hide boat for the flood.
import { describe, it, expect } from 'vitest';
import { loadTerrain, loadRiversFile } from './plainLib';
import { roadRiverCrossings, buildCrossings, keepOffChannels, FORD } from '../src/world/plain/crossings';
import { feature, settlementRoads } from '../src/world/plain/data';
import { meander } from '../src/world/settlement/water';
import { curvatureDrop } from '../src/terrain/heightfield';
import { buildCanals } from '../src/world/plain/canals';
import { placeVillages } from '../src/world/plain/villages';
import { trackLines } from '../src/world/plain/ribbons';

const T = loadTerrain(), R = loadRiversFile();
const depth = (id: string) => (feature(id).flow_by_month as { month: string; depth_m: number }[]);

describe('river crossings (D-257)', () => {
  const cs = roadRiverCrossings(R.rivers);
  it('finds the attested meetings: the Naqsh road and the royal road over the Pulvar, the royal and south roads over the Kur', () => {
    const has = (road: string, river: string) => cs.some(c => c.road === road && c.river === river);
    expect(has('road_naqsh_e_rustam', 'river_pulvar')).toBe(true);
    expect(has('road_royal_west', 'river_pulvar')).toBe(true);
    expect(has('road_royal_west', 'river_kur')).toBe(true);
    expect(has('road_south_tirazzish', 'river_kur')).toBe(true);
  });
  it('no road as drawn runs into a river without a ford (every drawn road sample in a channel is within 30 m of one)', () => {
    let wet = 0, unforded = 0;
    for (const r of settlementRoads()) for (const [x, y] of meander(r.pts as [number, number][], 8)) for (const rv of R.rivers) {
      for (let k = 0; k < rv.x.length; k += 1) { if (Math.abs(rv.x[k] - x) > 20 || Math.abs(rv.y[k] - y) > 20) continue;
        if (Math.hypot(rv.x[k] - x, rv.y[k] - y) < rv.topWidth / 2 - 2) { wet++; if (!cs.some(c => c.river === rv.id && Math.hypot(c.x - x, c.y - y) < 30)) unforded++; break; } }
    }
    expect(wet).toBeGreaterThan(0);
    expect(unforded).toBe(0);
  });
  it('the village tracks ford the rivers too: no track sample in a channel is more than 30 m from a ford', () => {
    const villages = placeVillages(T, R.rivers, buildCanals(T, R.rivers, 1), 1), tracks = keepOffChannels(trackLines(villages), R.rivers).map((pts, i) => ({ id: `track_${i}`, pts, width: 3.5 }));
    const all = roadRiverCrossings(R.rivers, settlementRoads(), tracks); let wet = 0, unforded = 0;
    for (const t of tracks) for (const [x, y] of t.pts) for (const rv of R.rivers) for (let k = 0; k < rv.x.length; k++) {
      if (Math.abs(rv.x[k] - x) > 25 || Math.abs(rv.y[k] - y) > 25) continue;
      if (Math.hypot(rv.x[k] - x, rv.y[k] - y) < rv.topWidth / 2 - 2) { wet++; if (!all.some(c => c.river === rv.id && Math.hypot(c.x - x, c.y - y) < 30)) unforded++; break; } }
    expect(unforded).toBe(0);
    expect(all.length).toBeGreaterThanOrEqual(cs.length);
    void wet;
  });
  it('the causeway is under a few cm at the Pulvar low water, under ~1 m in its flood; the Kur is not fordable in the spring flood', () => {
    const lo = Math.min(...depth('river_pulvar').map(m => m.depth_m)), hi = Math.max(...depth('river_pulvar').map(m => m.depth_m));
    expect(lo - FORD.river_pulvar.causeway).toBeLessThan(0.15);
    expect(hi - FORD.river_pulvar.causeway).toBeLessThan(1.0);
    const kurApr = depth('river_kur').find(m => m.month === 'Apr')!.depth_m, kurSep = depth('river_kur').find(m => m.month === 'Sep')!.depth_m;
    expect(kurApr - FORD.river_kur.causeway).toBeGreaterThan(1.2); // chest-deep and running: the boat
    expect(kurSep - FORD.river_kur.causeway).toBeLessThan(0.5); // knee-deep: carts and pack animals ford it
    for (const id of ['river_pulvar', 'river_kur'] as const) { const low = [...depth(id)].sort((a, b) => a.depth_m - b.depth_m).slice(0, 3);
      expect(Math.max(...low.map(m => m.depth_m))).toBeLessThanOrEqual(FORD[id].lowDepth + FORD[id].stepClear); } // the stepping stones are dry at low water
  });
  it('builds geometry at every crossing: causeway tops at the planned level over the bed, a boat at each Kur ford', () => {
    const b = buildCrossings(T, R.rivers, 1);
    expect(b.crossings.length).toBe(cs.length);
    expect(b.stats.boats).toBe(cs.filter(c => c.river === 'river_kur').length);
    expect(b.stats.steps).toBeGreaterThan(cs.length * 5);
    // the causeway box nearest each crossing centre: its top within 6 cm of bed + causeway
    for (const c of cs) {
      const rv = R.rivers.find(r => r.id === c.river)!, bedY = rv.bank[c.i] - rv.channel.bank_height_m - T.meta.court_asl - curvatureDrop(c.x, -c.y);
      let best = Infinity, top = NaN; for (const q of b.boxes) { const d = Math.hypot(q.c.x - c.x, -q.c.z - c.y); if (d < best) { best = d; top = q.c.y + q.h.y; } }
      expect(best).toBeLessThan(1);
      expect(Math.abs(top - (bedY + FORD[c.river].causeway))).toBeLessThan(0.06);
    }
    const mesh = b.group.getObjectByName('plain-fords') as any; expect(mesh.userData.tier).toBe('C');
  });
});
