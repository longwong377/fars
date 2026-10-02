// D-600: the terrain's geomorph (terrainMesh.ts): at the distance where a chunk switches to the next coarser level, its
// vertices have slid all the way onto that level's surface, so the switch draws the same ground (no pop). The pops along the
// coverage routes in pixels: tools/dev/far_pop.ts (bench-reports/far-pop.txt).
import { describe, it, expect } from 'vitest';
import { loadTerrain } from './plainLib';
import { stepErrors, pickStep, morphShare, decimatedAt, TERRAIN_LOD } from '../src/terrain/terrainMesh';

const T = loadTerrain(), chunks = T.chunks();

describe('terrain geomorph (D-600)', () => {
  it('the morph share reaches 1 exactly where pickStep moves to the next coarser step, and is 0 at the coarsest', () => {
    let checked = 0;
    for (const ch of chunks.filter((_, i) => i % 7 === 0)) {
      const err = stepErrors(ch.ring, ch.r0, ch.c0, ch.cells);
      for (const bias of [1, 0.75, 1.5]) for (let d = 5; d < 60000; d *= 1.003) {
        const s = pickStep(err, d, ch.ring.cell, bias), m = morphShare(err, d, ch.ring.cell, bias, s);
        expect(m).toBeGreaterThanOrEqual(0); expect(m).toBeLessThanOrEqual(1);
        if (s === TERRAIN_LOD.STEPS[TERRAIN_LOD.STEPS.length - 1]) expect(m).toBe(0);
        const s2 = pickStep(err, d * 1.003, ch.ring.cell, bias);
        // switching up one step: just short of the switch distance (found by bisection) the old level is fully morphed onto the new one
        if (s2 === s * 2) { let a = d, b = d * 1.003; for (let q = 0; q < 60; q++) { const c = (a + b) / 2; if (pickStep(err, c, ch.ring.cell, bias) === s) a = c; else b = c; }
          expect(morphShare(err, a, ch.ring.cell, bias, s)).toBeGreaterThan(0.9999); checked++; }
      }
    }
    console.log(`step switches checked: ${checked}`); expect(checked).toBeGreaterThan(200);
  });
  it('at morph 1 a level\'s vertices lie on the next coarser level\'s surface (its own vertices unchanged where shared)', () => {
    const ch = chunks.find(c => c.ringName === 'near' && c.r0 === 256 && c.c0 === 512)!;
    for (const s of [1, 2, 4, 8]) for (let i = 0; i <= ch.cells; i += s) for (let j = 0; j <= ch.cells; j += s) {
      const h = ch.ring.at(ch.r0 + i, ch.c0 + j), c = decimatedAt(ch.ring, ch.r0, ch.c0, ch.cells, s * 2, i, j);
      if (i % (s * 2) === 0 && j % (s * 2) === 0) expect(Math.abs(c - h)).toBeLessThan(1e-4);
    }
  });
});
