// The interreflection floor of the L1 probe irradiance (session 7, BLOCKERS B23; field.ts l1Eval): a face turned away from
// every opening of a hall was lit exactly 0 (black at any exposure). Swept over the baked field of the Terrace: inside the
// volumes, the share of (point, axis direction) pairs lit exactly 0 by the sky channel, before (the plain clamp) and after.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ProbeField, sampleField, decodeField, evalSample, l1Eval, L1_FLOOR } from '../src/render/probes/field';

const meta = JSON.parse(readFileSync('public/generated/probes.json', 'utf8')), b = readFileSync('public/generated/probes.f16');
const F: ProbeField = { volumes: meta.volumes, data: decodeField(new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2)), count: meta.count, normalBias: meta.normalBias, tier: meta.tier, note: meta.note };
const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];

describe('L1 interreflection floor (B23)', () => {
  it('leaves the open sky\'s cosine distribution (|b| = a) (the floor is 0 at |b| = a)', () => {
    for (const n of DIRS) expect(l1Eval(0.5, 0, 0.5, 0, ...n)).toBeCloseTo(Math.max(0, 0.5 + 0.5 * n[1]), 12);
    expect(l1Eval(1, 1.0, 0, 0, -1, 0, 0)).toBe(0);
  });
  it('a strongly one-sided field (a hall lit from one side) gives the face turned away L1_FLOOR × a, not 0', () => {
    // the Tachara hall probe of D-187: a 1.4e-3, |b| 2.5e-3 pointing S (grid −z here)
    expect(l1Eval(1.4e-3, 0, 0, -2.5e-3, 0, 0, 1)).toBeCloseTo(L1_FLOOR * 1.4e-3, 9);
    expect(l1Eval(1.4e-3, 0, 0, -2.5e-3, 0, 0, -1)).toBeCloseTo(3.9e-3, 9); // the lit face unchanged
  });
  it('over the Terrace\'s baked field: no interior face with light in its cell is lit exactly 0 by the sky', () => {
    let n = 0, zeroBefore = 0, zeroAfter = 0; const rows: string[] = [];
    for (const vol of F.volumes) {
      const [nx, ny, nz] = vol.dims; const [ox, oy, oz] = vol.origin, [sx, sy, sz] = vol.spacing;
      for (let i = 0; i < nx - 1; i += 2) for (let j = 0; j < Math.min(ny - 1, 4); j++) for (let k = 0; k < nz - 1; k += 2) {
        const x = ox + (i + 0.5) * sx, y = oy + (j + 0.5) * sy, z = oz + (k + 0.5) * sz, s = sampleField(F, x, y, z); if (!s || s.w < 0.5) continue;
        const a = s.s[0]; if (a < 1e-5) continue; // (cells with no sky at all: closed rooms stay dark)
        for (const d of DIRS) { n++; if (Math.max(0, a + s.s[1] * d[0] + s.s[2] * d[1] + s.s[3] * d[2]) === 0) zeroBefore++; if (evalSample(s.s, ...d)[0] === 0) zeroAfter++; }
      }
    }
    rows.push(`pairs ${n}, lit 0 before ${zeroBefore} (${(100 * zeroBefore / n).toFixed(2)} %), after ${zeroAfter}`);
    expect(n).toBeGreaterThan(1000); expect(zeroBefore).toBeGreaterThan(0); expect(zeroAfter).toBeLessThan(zeroBefore * 0.1);
    (globalThis as any).__probeFloor = rows;
  });
});
