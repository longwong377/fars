// D-680 (s18 reset, finish line C: "no interior below mean 40/255 at 10:00"): the eye in a town room adapts to the room. The
// upward rays test only the Terrace's architecture, so the eye kept the outdoor exposure in every town house; the outdoor
// light field (D-357) now answers there, as the halls' probes do.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs'; import { gunzipSync } from 'zlib';
import { outdoorEyeVisibility, sampleOutdoor, toRegion, groundAt, VIS_MIN, OutSample } from '../src/render/probes/outdoor';
import { openField } from '../src/render/probes/field';

const S = 1, U = 3, rho = 0.35, open = (ny: number) => openField(ny, S, U, rho);
const smp = (up: number, side: number, w = 1): OutSample => { const b = side * rho, sb = [b, b, b, b, 0, 2 * up * rho]; return { S: [side, side, side, side, up, 0.2 * up], Uam: sb, Upm: sb, tint: [1, 1], fb: 0.3, w, theta: 0 }; }; // (open ground: the sides see the sunlit ground's bounce)

describe('the eye in the outdoor field (D-680)', () => {
  it('an open court keeps the outdoor law (weight 0); a roofed room takes the field (weight ~1)', () => {
    expect(outdoorEyeVisibility(smp(1, 0.5), S, U, 0.5, open).w).toBe(0);
    const r = outdoorEyeVisibility(smp(0.02, 0.01), S, U, 0.5, open);
    expect(r.w).toBeGreaterThan(0.95); expect(r.roofed).toBe(1); expect(r.vis).toBeLessThan(0.1);
  });
  it('a room whose bake saw no opening does not open the eye without bound', () => {
    expect(outdoorEyeVisibility(smp(0, 0), S, U, 0.5, open).vis).toBe(VIS_MIN);
  });
  it('outside the field nothing changes', () => {
    expect(outdoorEyeVisibility(null, S, U, 0.5, open)).toEqual({ vis: 1, w: 0, roofed: 0 });
  });
  const J = 'public/lightmaps/outdoor.json', B = 'public/lightmaps/outdoor.lmz';
  it.skipIf(!existsSync(J) || !existsSync(B))('on the baked field: most coverage rooms in town are enclosed, the open courts mostly not', () => {
    const M = JSON.parse(readFileSync(J, 'utf8')), D = new Uint8Array(gunzipSync(readFileSync(B)));
    const pts: any[] = JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8')); const list = (Array.isArray(pts) ? pts : (pts as any).points);
    let rooms = 0, roomsIn = 0;
    for (const p of list) { if (p.sub !== 'town:rooms') continue; const x = p.e, z = -p.n; let g = NaN;
      for (const R of M.regions) { const [u, v] = toRegion(R, x, z), i = Math.floor((u - R.u0) / R.cell), j = Math.floor((v - R.v0) / R.cell); if (i >= 0 && j >= 0 && i < R.W && j < R.H) { g = groundAt(R, D, i, j); break; } }
      if (!Number.isFinite(g)) continue; rooms++;
      if (outdoorEyeVisibility(sampleOutdoor(M, D, [x, g + p.eye, z]), S, U, 0.5, open).w > 0.5) roomsIn++; }
    expect(rooms).toBeGreaterThan(5); expect(roomsIn / rooms).toBeGreaterThan(0.6);
  });
});
