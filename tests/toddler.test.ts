// s18 C14 (D-790, ledger u4): a toddler walks as toddlers do: wide-legged, short steps, the arms up for balance, rocking,
// and now and then plops down and gets up again; a gait without `toddler` is unchanged.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { pose, toddle, GAIT0, TODDLER } from '../src/people/anim';
describe('the toddler\'s walk', () => {
  it('wider, shorter, arms up; a plop now and then; the plain walk untouched', () => {
    const a = pose('walk', 3, 1.2, 0.4), b = pose('walk', 3, 1.2, 0.4, { ...GAIT0, toddler: 1 }), c = pose('walk', 3, 1.2, 0.4, { ...GAIT0, toddler: 0 });
    expect(c).toEqual(a);
    expect(b.rot.l_thigh![2] - (a.rot.l_thigh?.[2] ?? 0)).toBeCloseTo(TODDLER.abduct); expect(Math.abs(b.rot.l_thigh![0])).toBeLessThan(Math.abs(a.rot.l_thigh![0]) + 1e-9);
    expect(b.rot.l_upper![0]).toBeLessThan(-0.6); expect(b.rot.l_upper![2]).toBeGreaterThan(0.3);
    let low = 0, lowW = 0; for (let t = 0; t < 90; t += 0.1) { const q = pose('walk', t, t * 5, 0.4); const y0 = q.hips[1]; toddle(q, t, t * 5, 0.4, 1, true); low = Math.min(low, q.hips[1] - y0); lowW = Math.min(lowW, pose('walk', t, t * 5, 0.4, { ...GAIT0, toddler: 1 }).hips[1] - y0); }
    expect(low, 'held in place, sat down at least once in 90 s').toBeLessThan(-0.15); expect(lowW, 'walking, never slides along seated').toBeGreaterThan(-0.05);
  });
});
describe('the bit, for reins and lead ropes (s18 C14)', () => {
  it('sits at the head, ahead of the body, low when grazing, turned with the animal', async () => {
    const { bitAt, ANIMAL_BUILD } = await import('../src/people/animals');
    const a = { sp: 'horse' as const, x: 0, z: 0, yaw: 0, phase: 0, walk: 0, graze: 0, lie: 0, coat: 0.5 };
    const up = bitAt(a, 0), down = bitAt({ ...a, graze: 1 }, 0), turned = bitAt({ ...a, yaw: Math.PI / 2 }, 0), B = ANIMAL_BUILD.horse;
    expect(up[2]).toBeGreaterThan(0.3 * B.len); expect(up[1]).toBeGreaterThan(0.8 * B.h); expect(down[1]).toBeLessThan(0.35);
    expect(turned[0]).toBeCloseTo(up[2], 3); expect(Math.abs(turned[2])).toBeLessThan(0.05);
  });
});
describe('the toddler held where it plopped (crowd.ts, s18 C14)', () => {
  it('sits where it fell while its way goes on, then hurries back onto it; a held hand keeps it up', async () => {
    const { readFileSync } = await import('node:fs');
    const { decodeHumanAssets, meshoptSimplify } = await import('../src/people/humanAssets');
    const { buildOutfits } = await import('../src/people/outfits'); const { HumanGPU } = await import('../src/people/humanGPU'); const { Crowd } = await import('../src/people/crowd');
    const { plopPhase } = await import('../src/people/anim');
    const b = readFileSync('public/generated/humans/humans.bin'), A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready; const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
    const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1), humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 16 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
    const cam = new THREE.Vector3(3, 1.5, 6), crowd = new Crowd(null, 1, humans as any);
    const P = crowd.addExtra('k', { id: 2, sex: 'f', role: 'child', dress: 'worker', seed: 9, x: 0, y: 0, z: 0, yaw: 0, act: 'walk' as any, why: 'toddling after her mother', look: null } as any); P.gait.toddler = 1;
    // find the next plop on the toddler's own clock
    let t0 = 1; while (plopPhase(t0 + P.animT, P.animK) > 0.05) t0 += 0.05;
    const v = 0.6; let sat = -1, back = 0, lagMax = 0; const dt = 1 / 30;
    for (let t = t0 - 1; t < t0 + TODDLER.fallS + 4; t += dt) { P.extra!.z = v * t; crowd.update(t, cam, null, undefined);
      const lag = P.extra!.z - P.root[2]; lagMax = Math.max(lagMax, lag);
      if (t > t0 + 0.1 && t < t0 + TODDLER.fallS - 0.1) { if (sat < 0) sat = P.root[2]; expect(P.root[2], 'held where it sat').toBeCloseTo(sat, 3); expect(P.gait.plop).toBe(true); }
      if (t > t0 + TODDLER.fallS + 3.2) back = Math.max(back, Math.abs(lag)); }
    expect(lagMax).toBeGreaterThan(v * TODDLER.fallS * 0.8); expect(back, 'caught up').toBeLessThan(1e-6);
  }, 240_000);
});
