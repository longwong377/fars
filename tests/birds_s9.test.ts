// The commoner birds added in session 9 (src/world/wildlife.ts): larks hang in song flight over their field; storks mostly walk the
// wet ground; the winter cranes cross high in a V and are gone between passages; their seasons and hours are the species'.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { BIRDS, larkAt, storkAt, craneAt, terrainGroundBird, flockAt, sandgrouseAt, type BirdPose } from '../src/world/wildlife';
const pose = (): BirdPose => ({ pos: new THREE.Vector3(), heading: 0, bank: 0, flap: 0, visible: false });
describe('session-9 birds', () => {
  it('larks sing 25-60 m over their field', () => { for (let t = 0; t < 3000; t += 37) { const p = pose(); larkAt([-800, 0], 10, 5, t, p); expect(p.pos.y - 10).toBeGreaterThanOrEqual(24.9); expect(p.pos.y - 10).toBeLessThanOrEqual(60.1); } });
  it('storks are on the ground most of the time', () => { let g = 0, n = 0; for (let t = 0; t < 20000; t += 13) { const p = pose(); storkAt([100, 100], () => 0, 7, t, p); n++; if (p.pos.y < 1) g++; } expect(g / n).toBeGreaterThan(0.7); });
  it('cranes fly in a V high up and are not always there', () => { let seen = 0, hidden = 0; for (let t = 0; t < 7200; t += 60) { const p = pose(); craneAt(3, 1, t, p); if (p.visible) { seen++; expect(p.pos.y).toBeGreaterThan(290); } else hidden++; } expect(seen).toBeGreaterThan(0); expect(hidden).toBeGreaterThan(0); });
  it('the migrants keep their seasons: storks spring to summer, cranes in winter', () => { expect(BIRDS.stork.months).not.toContain(0); expect(BIRDS.crane.months).toContain(0); expect(BIRDS.crane.months).not.toContain(6); });
  // G45, G46, G52, G55-G58
  it('a ground bird pecks about its spot and, flushed within its distance, flies off and lands away from the walker', () => {
    const fl = new Map(), spot: [number, number] = [0, 0]; let at: [number, number] = spot; const p = pose();
    for (let t = 0; t < 60; t += 0.5) { at = terrainGroundBird(at, () => 0, 3, 0, t, 2, 15, 90, 4.5, null, fl, p); expect(Math.hypot(p.pos.x, p.pos.z)).toBeLessThan(3); expect(p.flap).toBe(0); }
    at = terrainGroundBird(at, () => 0, 3, 0, 60, 2, 15, 90, 4.5, [-5, 0], fl, p); expect(fl.size).toBe(1);
    let maxUp = 0; for (let t = 60; t <= 64.4; t += 0.2) { at = terrainGroundBird(at, () => 0, 3, 0, t, 2, 15, 90, 4.5, null, fl, p); maxUp = Math.max(maxUp, p.pos.y); }
    at = terrainGroundBird(at, () => 0, 3, 0, 65, 2, 15, 90, 4.5, null, fl, p); expect(fl.size).toBe(0); expect(p.pos.x).toBeGreaterThan(60); expect(maxUp).toBeGreaterThan(2);
  });
  it('the jackdaw flock circles 15-100 m over its cliff, together', () => { const ps = Array.from({ length: 18 }, pose);
    for (let t = 0; t < 600; t += 17) { ps.forEach((q, i) => flockAt([330, -60], 50, 1, i, t, q)); const cx = ps.reduce((a, q) => a + q.pos.x, 0) / 18, cz = ps.reduce((a, q) => a + q.pos.z, 0) / 18;
      for (const q of ps) { expect(q.pos.y - 50).toBeGreaterThan(15); expect(q.pos.y - 50).toBeLessThan(105); expect(Math.hypot(q.pos.x - cx, q.pos.z - cz)).toBeLessThan(40); } } });
  it('sandgrouse pass low and fast toward the water, and are gone between passages', () => { let seen = 0, gone = 0; const p = pose();
    for (let t = 0; t < 7200; t += 10) { sandgrouseAt(2, 1, t, [0, 0], p); if (p.visible) { seen++; expect(p.pos.y).toBeGreaterThan(15); expect(p.pos.y).toBeLessThan(65); } else gone++; }
    expect(seen).toBeGreaterThan(50); expect(gone).toBeGreaterThan(50); expect(BIRDS.sandgrouse.hours[1]).toBeLessThan(9.5); });
  it('the summer visitors keep their seasons; the residents stay', () => {
    for (const k of ['hoopoe', 'beeeater', 'egret', 'wheatear'] as const) { expect(BIRDS[k].months).not.toContain(0); expect(BIRDS[k].months).toContain(5); }
    for (const k of ['chukar', 'heron', 'jackdaw', 'magpie', 'sandgrouse'] as const) expect(BIRDS[k].months.length).toBe(12);
  });
});
