// D-230 (B40): the dressed stone's block tone set from the site photographs (references/INDEX.md §6), measured with
// tools/dev/stone_photo_d230.py (linear Y, hand-picked boxes inside block faces). The CPU mirror of the shader
// (tests/lib/stone_cpu.ts) measures the same split on our wall (per-block means, within-block texture, 48 px windows)
// before (D-218, block 1σ 17 %) and after (D-230, 13 %). Numbers to bench-reports/stone-photo-d230.txt.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { SURFACES } from '../src/render/materials';
import { ashlarCells, ashlarPixel, renderWall, agxGrey } from './lib/stone_cpu';

/** the photographs (tools/dev/stone_photo_d230.py; processed images, ratios only) */
export const PHOTO = {
  wall24: { between: 0.267, betweenIqr: 0.224, within: 0.238, win48: 0.431, rest: 0.241, blocks: 30 }, // #24, weathered (2,500 years)
  relief29: { between: 0.127, blocks: 4, withinSmooth: 0.116 }, // #29 relief blocks, buried until the 1930s (sunlit ground)
  merlons29: { between: 0.072, blocks: 5 },                      // #29 merlons in the shelter's shade
  gate5: { spallOverSkin: 1.045, spallWithin: 0.053, skinWithinSmooth: 0.069 }, // #5 lintel: fresh stone under a spalled skin
};
const L = SURFACES.limestone;
const withSd = (sd: number) => ({ ...L, joints: { ...L.joints!, blockSd: sd } });
const rows: string[] = [];
const report = () => { mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/stone-photo-d230.txt', rows.join('\n') + '\n'); };

/** split the albedo × sun factor of a frontal wall patch at pixel size px into per-block means and within-block spread */
function split(d: typeof L, px: number, W = 60, H = 12) {
  const sun = [0.2, 0.33, 0.92], sl = Math.hypot(...sun), Ls = sun.map(c => c / sl);
  const blocks = new Map<string, number[]>(); const all: number[] = [];
  for (let y = 0.3; y < H; y += px) for (let x = 0.3; x < W; x += px) {
    const P = ashlarPixel(d, x, y, 0.37, px), v = P.f * (P.n[0] * Ls[0] + P.n[1] * Ls[1] + P.n[2] * Ls[2] + 0.15), C = ashlarCells(x, y, d.joints!);
    if (C.dBed < 3 * px || C.dHead < 3 * px) { all.push(v); continue; } // boxes stay off the joints, as on the photos
    const k = `${C.blk}|${C.c}`; (blocks.get(k) ?? blocks.set(k, []).get(k)!).push(v); all.push(v);
  }
  const means = [...blocks.values()].filter(a => a.length >= 6).map(a => a.reduce((s, x) => s + x, 0) / a.length);
  const mm = means.reduce((s, x) => s + x, 0) / means.length, between = Math.sqrt(means.reduce((s, x) => s + (x - mm) ** 2, 0) / means.length) / mm;
  const within = Math.sqrt([...blocks.values()].filter(a => a.length >= 6).map(a => { const m = a.reduce((s, x) => s + x, 0) / a.length; return a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length / (m * m); }).reduce((s, x) => s + x, 0) / means.length);
  return { between, within, n: means.length };
}

describe('stone variation from the photographs (D-230, B40)', () => {
  it('the block tone sits in the range the least weathered stone on the site shows, below the weathered walls', () => {
    const sd = L.joints!.blockSd!;
    // near-fresh (#29, both samples pooled by blocks: 1σ ≈ 0.09; phone HDR flattening allowed ×1.2 and ~50 years of soiling
    // in quadrature give ≈ 0.13); the weathered wall (#24, 0.22–0.27) is an upper bound fresh stone does not reach
    const pooled = Math.sqrt((PHOTO.relief29.blocks * PHOTO.relief29.between ** 2 + PHOTO.merlons29.blocks * PHOTO.merlons29.between ** 2) / (PHOTO.relief29.blocks + PHOTO.merlons29.blocks));
    const probable = Math.hypot(pooled * 1.2, 0.05);
    rows.push(`photos: near-fresh block tone pooled 1σ ${pooled.toFixed(3)} (#29 relief blocks ${PHOTO.relief29.between}, n ${PHOTO.relief29.blocks}; merlons ${PHOTO.merlons29.between}, n ${PHOTO.merlons29.blocks}); ×1.2 (HDR) ⊕ 0.05 (50 years' soiling) = ${probable.toFixed(3)}; weathered #24 ${PHOTO.wall24.between} (IQR ${PHOTO.wall24.betweenIqr}); set ${sd}`);
    expect(Math.abs(sd - probable)).toBeLessThan(0.01);
    expect(sd).toBeLessThan(PHOTO.wall24.betweenIqr);
  });
  it('on the CPU mirror, the split at the photographs\' scales (before D-218 17 % → after D-230 13 %)', () => {
    for (const [tag, px] of [['#24 scale, 0.10 m pixels', 0.1], ['#29 scale, 5 mm pixels', 0.005]] as const) {
      const W = px > 0.05 ? 60 : 8, H = px > 0.05 ? 12 : 3;
      const b = split(withSd(0.17), px, W, H), a = split(L, px, W, H);
      rows.push(`${tag}: between-block ${b.between.toFixed(3)} → ${a.between.toFixed(3)}, within-block ${b.within.toFixed(3)} → ${a.within.toFixed(3)} (${a.n} blocks)`);
      expect(a.between).toBeLessThan(b.between);
      if (px > 0.05) { expect(a.between).toBeGreaterThan(0.09); expect(a.between).toBeLessThan(0.16); expect(a.within).toBeLessThan(PHOTO.wall24.within); }
    }
    report();
  }, 600_000);
  it('on screen (AgX): frontal wall at 10 m and the calibration view\'s wall at ~150 m (48 px windows)', () => {
    const sun: [number, number, number] = [0.21, 0.33, 0.92]; // the #24 sun on the W face: 12° off its normal, 19° up
    for (const [tag, dist, fov, rows_] of [['10 m, 40° fov, 540 rows', 10, 40, 540], ['150 m, 34.4° fov, 905 rows (#24)', 150, 34.4, 905]] as const) {
      const px = (2 * Math.tan((fov * Math.PI) / 360) * dist) / rows_, side = 48 * px;
      const m = (d: typeof L) => { let f = 0, s = 0; const N = 6; for (let k = 0; k < N; k++) { const r = renderWall(d, { dist, fovDeg: fov, rows: rows_, sun, outY: 0.35, patch: [3 + k * 11.3, 1.3 + (k % 3) * 2.1, side, side] }); f += r.flat / N; s += r.sceneFlat / N; } return { f, s }; };
      const b = m(withSd(0.17)), a = m(L);
      rows.push(`${tag}: Ystd/Y on screen ${b.f.toFixed(3)} → ${a.f.toFixed(3)}, scene-linear ${b.s.toFixed(3)} → ${a.s.toFixed(3)} (photo #24 ${PHOTO.wall24.win48}, weathered)`);
      expect(a.f).toBeLessThan(b.f);
    }
    rows.push(`AgX local slope at the stone's level (linear 0.35): ${((Math.log(agxGrey(0.36 * 2.6)) - Math.log(agxGrey(0.34 * 2.6))) / (Math.log(0.36) - Math.log(0.34))).toFixed(2)} (a camera curve ≥ 1)`);
    report();
  }, 600_000);
});
