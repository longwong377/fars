// Session 9 (WORLD_INVENTORY G72): thorn cushions, camelthorn and thistles near the viewer, by the ground's context and the season.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { GroundFlora, FLORA, FLORA_R, floraSeason } from '../src/world/groundFlora';
import type { CellCtx } from '../src/world/smallLife';

const ctxAt = (e: number, n: number): CellCtx => e > 100 ? 'rock' : e > 0 ? 'steppe' : e > -100 ? 'field' : Math.abs(n) < 50 ? 'water' : 'none';
const mk = () => new GroundFlora(3, { ground: () => 0, ctxAt });
const n = (f: GroundFlora) => Object.fromEntries([...f.meshes].map(([k, m]) => [k, m.count]));

describe('ground flora (session 9)', () => {
  it('cushions thickest on rock, camelthorn and thistles on the steppe, few in fields, none at the water or off the land', () => {
    const f = mk(); f.update(4, [180, 0]); const rock = n(f); f.update(4, [50, 300]); const steppe = n(f); f.update(4, [-50, 300]); const field = n(f); f.update(4, [-200, 0]); const water = n(f);
    expect(rock.cushion).toBeGreaterThan(steppe.cushion); expect(rock.camelthorn).toBe(0);
    expect(steppe.camelthorn).toBeGreaterThan(field.camelthorn); expect(steppe.thistle).toBeGreaterThan(field.thistle);
    expect(water.cushion + water.camelthorn + water.thistle).toBeLessThan(steppe.cushion + steppe.camelthorn + steppe.thistle); // (the steppe cells at its edge only; D-670: grasses and flowers grow at the water)
  });
  it('each plant is within the radius, sized in its range, and the same every time (static)', () => {
    const a = mk(), b = mk(); a.update(4, [50, 0]); b.update(4, [50, 0]); const M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (const [k, m] of a.meshes) { expect(Array.from(m.instanceMatrix.array.slice(0, m.count * 16))).toEqual(Array.from(b.meshes.get(k)!.instanceMatrix.array.slice(0, m.count * 16)));
      for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); M.decompose(p, q, s); expect(Math.hypot(p.x - 50, p.z)).toBeLessThan(FLORA_R + 8 * 2); expect(s.y).toBeGreaterThanOrEqual(FLORA[k].size[0] - 1e-6); expect(s.y).toBeLessThanOrEqual(FLORA[k].size[1] + 1e-6); } }
  });
  it('rebuilds only after the viewer moves 4 m or the month turns', () => { const f = mk(); expect(f.update(4, [50, 0])).toBe(true); expect(f.update(4, [52, 1])).toBe(false); expect(f.update(4, [55, 0])).toBe(true); expect(f.update(5, [55, 0])).toBe(true); });
  it('the seasons: camelthorn green in summer and brown in winter; thistles flower in June and stand dry in autumn', () => {
    expect(floraSeason(6).thornDry).toBeLessThan(0.2); expect(floraSeason(0).thornDry).toBeGreaterThan(0.6);
    expect(floraSeason(5).thistleFlower).toBe(1); expect(floraSeason(9).thistleFlower).toBe(0); expect(floraSeason(9).thistleGreen).toBe(0); expect(floraSeason(3).thistleGreen).toBe(1);
  });
});
