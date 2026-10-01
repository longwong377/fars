// D-355 (session 14, agent frame): the fire lights as a fixed forward set plus the composite's deferred far fires.
// (1) the forward lights never change visibility (the set of visible lights is every lit material's shader key: a change
// recompiled every lit pipeline); (2) the next nearest lit fires go to the deferred term with the forward light's model;
// (3) the eye adapts to the forward and the deferred lights together.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { FireSystem, fireLight, pointAttenuation, FIRE_FLICKER_MEAN } from '../src/world/fire';
import { FIRE_GLOW, GLOW_MAX, FORWARD_FIRE_LIGHTS, glowIrradianceCPU } from '../src/render/fireGlow';

const add = (F: FireSystem, x: number, z: number) => F.add('brazier', new THREE.Vector3(x, 0, z), { tier: 'C', src: 'T', note: '' });
function setup(nFires: number, forward: number, glow: number) {
  const F = new FireSystem(forward, 0, 512, glow);
  for (let i = 0; i < nFires; i++) add(F, 2 + i * 1.5, -3 - i);
  F.build(); const cam = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 1000); cam.position.set(0, 1.6, 0);
  return { F, cam };
}
import { FIRE_AB } from '../src/world/fire';
describe('fire lights: a fixed forward set and the deferred far fires (D-355)', () => {
  it('high has 4 forward lights and every light stays visible by day, at dusk and at night', () => {
    expect(FORWARD_FIRE_LIGHTS.high).toBe(4);
    const { F, cam } = setup(20, FORWARD_FIRE_LIGHTS.high, GLOW_MAX), L = ((F as any).lights as THREE.PointLight[]).filter(l => l.visible);
    expect(L.length).toBe(4); // (the A/B's hidden legacy lights are never shown unless __parsaFire.legacy)
    for (const alt of [30, 2, -20, 30]) { F.update(0.016, cam, alt, 0, 0, 0, 12); expect(L.every(l => l.visible)).toBe(true); }
    F.update(0.016, cam, 30, 0, 0, 0, 12); expect(L.every(l => l.intensity === 0)).toBe(true); expect(FIRE_GLOW.n).toBe(0);
  });
  it('the nearest lit fires are forward, the next GLOW_MAX deferred, nearest first, with the forward light model', () => {
    const { F, cam } = setup(20, 4, GLOW_MAX); F.update(0.016, cam, -20, 0, 0, 0, 2);
    const L = ((F as any).lights as THREE.PointLight[]).filter(l => l.visible); expect(L.length).toBe(4);
    const byD = F.fires.filter(f => f.lit).map(f => f.pos.distanceTo(cam.position)).sort((a, b) => a - b);
    const fwdMax = Math.max(...L.map(l => { const f = F.fires.find(q => Math.hypot(q.pos.x - l.position.x, q.pos.z - l.position.z) < 1e-6)!; return f.pos.distanceTo(cam.position); }));
    expect(fwdMax).toBeCloseTo(byD[3], 6);
    expect(FIRE_GLOW.n).toBe(GLOW_MAX);
    for (let j = 0; j < GLOW_MAX; j++) {
      const A = FIRE_GLOW.A[j], B = FIRE_GLOW.B[j], f = F.fires.find(q => Math.hypot(q.pos.x - A.x, q.pos.z - A.z) < 1e-6)!, Lf = fireLight(f.kind);
      expect(f.pos.distanceTo(cam.position)).toBeCloseTo(byD[4 + j], 6);
      expect(A.w).toBe(Lf.cutoff);
      const I = (B.x + B.y + B.z) / (1.0 + 0.52 + 0.18); expect(I / Lf.candela).toBeGreaterThanOrEqual(0.6 - 1e-9); expect(I / Lf.candela).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
  it('the deferred term on a surface facing a fire is the point light it replaces (inverse square, window, cosine)', () => {
    const { F, cam } = setup(6, 1, GLOW_MAX); F.update(0.016, cam, -20, 0, 0, 0, 2);
    const A = FIRE_GLOW.A[0], B = FIRE_GLOW.B[0], p = new THREE.Vector3(A.x, A.y - 2, A.z), n = new THREE.Vector3(0, 1, 0);
    const e = glowIrradianceCPU(0, p, n);
    expect(e[0]).toBeCloseTo(B.x * pointAttenuation(2, A.w, 2), 9);
    const side = glowIrradianceCPU(0, new THREE.Vector3(A.x + 2, A.y, A.z), n); expect(side[0]).toBeCloseTo(0, 12); // grazing: n·l = 0
    expect(glowIrradianceCPU(0, new THREE.Vector3(A.x, A.y - A.w - 0.1, A.z), n)[0]).toBe(0); // beyond the cut-off
  });
  it('the eye adapts to the forward and the deferred fires together (16 at high, as 12 forward before)', () => {
    const { F, cam } = setup(20, 4, GLOW_MAX); F.update(0.016, cam, -20, 0, 0, 0, 2);
    const lit = F.fires.filter(f => f.lit).sort((a, b) => a.pos.distanceTo(cam.position) - b.pos.distanceTo(cam.position)).slice(0, 4 + GLOW_MAX);
    let sum = 0; for (const f of lit) { const L = fireLight(f.kind), q = new THREE.Vector3(f.pos.x, L.height, f.pos.z); // (base y 0: the light at its height)
      sum += L.candela * FIRE_FLICKER_MEAN * pointAttenuation(q.distanceTo(cam.position), L.cutoff, L.decay); }
    expect(F.localIlluminance(cam.position)).toBeCloseTo(sum, 9);
  });
  it('the A/B switch shows the 12 legacy forward lights and empties the deferred term', () => {
    const { F, cam } = setup(20, 4, GLOW_MAX); FIRE_AB.legacy = true;
    try { F.update(0.016, cam, -20, 0, 0, 0, 2); const L = (F as any).lights as THREE.PointLight[];
      expect(L.filter(l => l.visible && l.intensity > 0).length).toBe(12); expect(FIRE_GLOW.n).toBe(0); } finally { FIRE_AB.legacy = false; }
    F.update(0.016, cam, -20, 0, 0, 0, 2); expect(((F as any).lights as THREE.PointLight[]).filter(l => l.visible).length).toBe(4);
  });
});
