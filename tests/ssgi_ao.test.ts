// The SSGI contact AO against the physics (session 7, the outdoor-AO question of D-188): a CPU mirror of the node's
// sampling (tests/lib/ssgi_cpu.ts, the high settings of src/render/pipeline.ts) on a wall and a column standing on a
// floor, 6–8 m from a camera at eye height, averaged over the 24 temporal frames TRAA accumulates. The reference is the
// cosine-weighted share of the hemisphere left open within the contact radius (rays). The node as written darkens a
// wall's foot to ~0.58 (physics 0.51) and a column's foot to ~0.63 (0.63), so the mirror rules out the algorithm as the
// cause of the "≥ 0.8 at the column feet" read from the tone-mapped debug view (which also carried the air light and
// bloom); `?post=probe-raw` now writes (w, contact AO, AO) untone-mapped for a direct read-back.
import { describe, it, expect } from 'vitest';
import { makeView, aoMean, referenceAO, HIGH, type Scene, type V3 } from './lib/ssgi_cpu';
import { SSGI_THICKNESS, SSGI_CONTACT_RADIUS, SSGI_CONTACT_STEPS } from '../src/render/pipeline';

const S: Scene = { solids: [{ kind: 'box', min: [-10, 0, -8.3], max: [10, 6, -8] }, { kind: 'cyl', x: 2.5, z: -6, r: 0.45, y0: 0, y1: 8 }] };
const C = { W: 960, H: 540, fovDeg: 40, eye: [0, 1.6, 0] as V3, yawDeg: 0, pitchDeg: -8 };

describe('SSGI contact AO (CPU mirror)', () => {
  const V = makeView(C, S);
  const px = (w: V3): [number, number] => {
    const p = V.toView(w), t = Math.tan((C.fovDeg * Math.PI) / 360), asp = C.W / C.H;
    return [Math.floor(((p[0] / (-p[2] * t * asp) + 1) / 2) * C.W), Math.floor(((1 - p[1] / (-p[2] * t)) / 2) * C.H)];
  };
  it('the mirror uses the pipeline settings', () => {
    expect(HIGH.thickness).toBe(SSGI_THICKNESS); expect(HIGH.aoNearRadius).toBe(SSGI_CONTACT_RADIUS); expect(HIGH.nearSteps).toBe(SSGI_CONTACT_STEPS);
  });
  it('darkens a wall foot and a column foot within ~0.1 of the physics, and fades to 1 in the open', () => {
    const rows: string[] = [];
    for (const [lab, w, lo, hi] of [
      ['wall 0.05 m', [-1, 0, -7.95], 0.5, 0.65], ['wall 0.4 m', [-1, 0, -7.6], 0.6, 0.78], ['wall 1.5 m', [-1, 0, -6.5], 0.85, 1],
      ['column 0.05 m', [2.5, 0, -5.5], 0.58, 0.72], ['column 0.8 m', [2.5, 0, -4.75], 0.84, 0.95],
    ] as [string, V3, number, number][]) {
      const [x, y] = px(w), m = aoMean(V, HIGH, x, y, 1), ref = referenceAO(V, S, x, y, SSGI_CONTACT_RADIUS);
      rows.push(`${lab}: node ${m.aoNear.toFixed(3)} physics ${ref.toFixed(3)}`);
      expect(m.aoNear, lab).toBeGreaterThanOrEqual(lo); expect(m.aoNear, lab).toBeLessThanOrEqual(hi);
      expect(Math.abs(m.aoNear - ref), lab).toBeLessThan(0.1);
    }
  });
});
