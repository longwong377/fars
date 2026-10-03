// D-309 (session 12, B113): the sun's cascades at high/ultra — the first cascade's texel at the player's lens, the breaks the
// hall air-light and the people's shadow casters rely on, and that main.ts and the human lab install the same cascades.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { SUN_CASCADES, cascadeTexel, pcfRadius, FAR_CASCADE, fitFarCascade } from '../src/render/sunShadows';
import { TERRACE_BOX } from '../src/world/plain/townGround';
import plots from '../src/data/town_plots.json';
import { AIR_LIGHT_RANGE } from '../src/render/airlight';
import { SHADOW_CASCADE_REACH } from '../src/people/humanGPU';

describe('sun cascades (D-309)', () => {
  for (const q of ['high', 'ultra'] as const) {
    const p = SUN_CASCADES[q]!;
    it(`${q}: the nearest cascade draws the conversation-distance shadows at ≤ 5 mm a texel (session 11: ~75 mm)`, () => {
      expect(cascadeTexel(p.breaks[0], p.size)).toBeLessThanOrEqual(0.005);
      // (the old practical split at lambda 0.5: 75 m at 2048 — the stair-stepped chin shadow of B113)
      expect(cascadeTexel(75, 2048)).toBeGreaterThan(0.07);
      // every distance within 250 m is drawn at least as finely as session 11's cascades drew it
      const oldFar = [75, 153, 253, 600], old = (d: number) => cascadeTexel(oldFar.find(f => f >= d)!, 2048), nw = (d: number) => cascadeTexel(p.breaks.find(f => f >= d)!, p.size);
      for (let d = 1; d <= 250; d += 1) expect(nw(d), `${d} m`).toBeLessThanOrEqual(old(d) * 1.25);
    });
    it(`${q}: cascade 1 covers the hall air-light's march and the far bound is 600 m`, () => {
      expect(p.breaks[1]).toBeGreaterThanOrEqual(AIR_LIGHT_RANGE);
      expect(p.breaks[p.breaks.length - 1]).toBe(600);
      expect(p.breaks.filter(b => b < SHADOW_CASCADE_REACH).length).toBeLessThanOrEqual(3); // people cast into ≤ 3 cascades
    });
  }
  it('the PCF radius is at least 1.25 texels and the sun\'s penumbra in the fine cascades', () => {
    expect(pcfRadius(0.0046)).toBeGreaterThan(1); expect(pcfRadius(0.3)).toBe(1.25); expect(pcfRadius(1e-5)).toBe(4);
  });
  it('the world and the human lab install the same cascades', () => {
    expect(readFileSync('src/main.ts', 'utf8')).toMatch(/installSunCascades\(sky\.sun, settings\.quality\)/);
    expect(readFileSync('src/dev/humanLab.ts', 'utf8')).toMatch(/installSunCascades\(sky\.sun, quality\)/);
    expect(readFileSync('src/main.ts', 'utf8')).not.toMatch(/new CSMShadowNode/);
  });
  // D-473 addendum (s17 V11): the static far cascade past 600 m
  it("the far cascade box holds the Terrace and the town's quarters", () => {
    const B = FAR_CASCADE.box;
    expect(B.e0).toBeLessThanOrEqual(TERRACE_BOX.e0); expect(B.e1).toBeGreaterThanOrEqual(TERRACE_BOX.e1);
    expect(B.n0).toBeLessThanOrEqual(TERRACE_BOX.n0); expect(B.n1).toBeGreaterThanOrEqual(TERRACE_BOX.n1);
    const town = (plots as any).plots.filter((p: any) => /lower_town_south|persepolis_west/.test(p.zone));
    expect(town.length).toBeGreaterThan(1000);
    for (const p of town) { expect(p.c[0]).toBeGreaterThan(B.e0); expect(p.c[0]).toBeLessThan(B.e1); expect(p.c[1]).toBeGreaterThan(B.n0); expect(p.c[1]).toBeLessThan(B.n1); }
    for (const q of ['high', 'ultra'] as const) expect(SUN_CASCADES[q]!.far).toBe(2048);
    expect(FAR_CASCADE.full).toBeLessThanOrEqual(SUN_CASCADES.high!.breaks[3]); // handed over before the last cascade ends
  });
  it('the far cascade fits the box from any sun above the horizon, at ≤ 1.7 m a texel', () => {
    const B = FAR_CASCADE.box;
    for (const [alt, az] of [[2, 70], [10, 100], [35, 150], [60, 200], [83, 180], [5, 290]]) {
      const a = THREE.MathUtils.degToRad(alt), z = THREE.MathUtils.degToRad(az);
      const sun = new THREE.Vector3(Math.sin(z) * Math.cos(a), Math.sin(a), -Math.cos(z) * Math.cos(a)).normalize();
      const lw: any = new THREE.Object3D(); lw.target = new THREE.Object3D(); const cam = new THREE.OrthographicCamera();
      const tex = fitFarCascade(lw, cam, sun, 2048);
      expect(tex, `alt ${alt}`).toBeLessThanOrEqual(1.7);
      const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse), v = new THREE.Vector3();
      for (const e of [B.e0, B.e1]) for (const n of [B.n0, B.n1]) for (const h of [B.y0, B.y1]) {
        v.set(e, h, -n).applyMatrix4(m);
        expect(Math.abs(v.x)).toBeLessThanOrEqual(1); expect(Math.abs(v.y)).toBeLessThanOrEqual(1); expect(Math.abs(v.z)).toBeLessThanOrEqual(1);
      }
      // a caster 300 m up-sun of the box's top still lies in front of the near plane (Kuh-e Rahmat's slope over the Terrace)
      v.set((B.e0 + B.e1) / 2, B.y1, -(B.n0 + B.n1) / 2).addScaledVector(sun, 300).applyMatrix4(m);
      expect(v.z).toBeGreaterThanOrEqual(-1);
    }
  });
});
