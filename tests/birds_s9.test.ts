// The commoner birds added in session 9 (src/world/wildlife.ts): larks hang in song flight over their field; storks mostly walk the
// wet ground; the winter cranes cross high in a V and are gone between passages; their seasons and hours are the species'.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { BIRDS, larkAt, storkAt, craneAt, type BirdPose } from '../src/world/wildlife';
const pose = (): BirdPose => ({ pos: new THREE.Vector3(), heading: 0, bank: 0, flap: 0, visible: false });
describe('session-9 birds', () => {
  it('larks sing 25-60 m over their field', () => { for (let t = 0; t < 3000; t += 37) { const p = pose(); larkAt([-800, 0], 10, 5, t, p); expect(p.pos.y - 10).toBeGreaterThanOrEqual(24.9); expect(p.pos.y - 10).toBeLessThanOrEqual(60.1); } });
  it('storks are on the ground most of the time', () => { let g = 0, n = 0; for (let t = 0; t < 20000; t += 13) { const p = pose(); storkAt([100, 100], () => 0, 7, t, p); n++; if (p.pos.y < 1) g++; } expect(g / n).toBeGreaterThan(0.7); });
  it('cranes fly in a V high up and are not always there', () => { let seen = 0, hidden = 0; for (let t = 0; t < 7200; t += 60) { const p = pose(); craneAt(3, 1, t, p); if (p.visible) { seen++; expect(p.pos.y).toBeGreaterThan(290); } else hidden++; } expect(seen).toBeGreaterThan(0); expect(hidden).toBeGreaterThan(0); });
  it('the migrants keep their seasons: storks spring to summer, cranes in winter', () => { expect(BIRDS.stork.months).not.toContain(0); expect(BIRDS.crane.months).toContain(0); expect(BIRDS.crane.months).not.toContain(6); });
});
