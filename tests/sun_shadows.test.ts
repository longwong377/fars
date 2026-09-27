// D-309 (session 12, B113): the sun's cascades at high/ultra — the first cascade's texel at the player's lens, the breaks the
// hall air-light and the people's shadow casters rely on, and that main.ts and the human lab install the same cascades.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SUN_CASCADES, cascadeTexel, pcfRadius } from '../src/render/sunShadows';
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
});
