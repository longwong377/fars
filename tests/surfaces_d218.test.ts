// D-218 (rubric s7 pass 2, fixes 2 and 10): the dressed stone, stairs, merlons, polished frames and the mud-plaster foot,
// measured in node. The stone is judged the way the rubric judged the screenshots (Ystd/Y of sunlit stone at 5–30 m, linear
// Y after the tone map), on a CPU mirror of the shader (tests/lib/stone_cpu.ts): the D-157 surface as it was and the
// D-218 one, under the same sun and exposure. Measurements, not screenshots; numbers to bench-reports/surfaces-d218.txt.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { SURFACES, pitMean, styloMean, STAIR_BLOCK } from '../src/render/materials';
import { stairRows } from '../src/arch/meshes';
import { buildTerrace } from '../src/arch/terrace';
import { buildStairCrenellations } from '../src/arch/decor';
import type { Box } from '../src/arch/parts';
import { blockIds, blockTone, stoneDetail, renderWall, ashlarPixel, d157 } from './lib/stone_cpu';
import { rng } from './lib/mx_noise_cpu';

const R = rng(218);
const stats = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return { mean: m, sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) }; };
const rows: string[] = [];
const report = () => { mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/surfaces-d218.txt', rows.join('\n') + '\n'); };
const L = SURFACES.limestone;

describe('stair blocks (D-218: grand_stair.block_construction "4-5 steps cut from single blocks", B)', () => {
  const { parts } = buildTerrace(), map = stairRows(parts);
  const steps = parts.filter((p): p is Box => p.type === 'box' && p.kind === 'step');
  it('every step is in a flight, the flights rise along their direction, rows hold 4 or 5 steps', () => {
    expect(map.size).toBe(steps.length);
    const flights = new Map<number, Box[]>();
    for (const s of steps) { const v = map.get(s)!; (flights.get(Math.abs(v[1])) ?? flights.set(Math.abs(v[1]), []).get(Math.abs(v[1]))!).push(s); }
    const gs = steps.filter(s => s.building === 'grand_stair'), gsFlights = new Set(gs.map(s => Math.abs(map.get(s)![1])));
    expect(gsFlights.size).toBe(4); // two lower (63 steps) and two upper (48) flights
    let rowsChecked = 0;
    for (const F of flights.values()) {
      if (F.length < 10) continue;
      F.sort((a, b) => a.y1 - b.y1);
      const [, , dx, dz] = map.get(F[0])!, a0 = F[0].c[0] * dx - F[0].c[1] * dz, a1 = F[F.length - 1].c[0] * dx - F[F.length - 1].c[1] * dz; // world (x, z) = (e, −n)
      expect(a1, `${F[0].building} flight rises along its direction`).toBeGreaterThan(a0);
      const count = new Map<number, number>(); for (const s of F) count.set(map.get(s)![0], (count.get(map.get(s)![0]) ?? 0) + 1);
      const sizes = [...count.values()];
      for (const n of sizes.slice(0, -1)) { expect(n).toBeGreaterThanOrEqual(4); expect(n).toBeLessThanOrEqual(5); rowsChecked++; } // the last row takes what is left
      for (let i = 0; i < F.length; i++) expect(map.get(F[i])![1] < 0, 'first step of a row flagged').toBe(i === 0 || map.get(F[i])![0] !== map.get(F[i - 1])![0]);
    }
    expect(rowsChecked).toBeGreaterThan(60);
    rows.push(`stairs: ${steps.length} steps in ${flights.size} flights; rows of 4–5 steps (${rowsChecked} full rows checked); blocks along the step ${STAIR_BLOCK.length} m ± ${STAIR_BLOCK.jitter * 25} %`);
  });
});

describe('block tone and stone detail (D-218): mean-preserving, so the light probes keep their albedo', () => {
  it('blocks differ by 1σ ≈ blockSd (triangular: few extremes); the mean stays 1', () => {
    const J = L.joints!, t: number[] = [];
    for (let c = 0; c < 60; c++) for (let b = 0; b < 60; b++) t.push(blockTone(J, L, blockIds(b, c)));
    const s = stats(t); rows.push(`block tone: 1σ ${(100 * s.sd).toFixed(1)} % (blockSd ${J.blockSd}), mean ${s.mean.toFixed(4)}; ${(100 * t.filter(x => Math.abs(x - 1) > 2 * J.blockSd!).length / t.length).toFixed(1)} % of blocks beyond 2σ`);
    expect(Math.abs(s.mean - 1)).toBeLessThan(0.01); expect(s.sd).toBeGreaterThan(J.blockSd! * 0.9); expect(s.sd).toBeLessThan(J.blockSd! * 1.1);
  });
  it('the stone inside the blocks (laminae, stylolites, pits) keeps the mean albedo within 1 %, near and far', () => {
    const S = L.stone!;
    for (const fp of [0.003, 0.02, 0.08]) { // pixel footprints of ~1.5 m, 10 m, 40 m
      const v: number[] = [], h: number[] = [];
      for (let i = 0; i < 20000; i++) { const id = blockIds(Math.floor(R() * 500), Math.floor(R() * 500)); v.push(stoneDetail(S, R() * 200, R() * 30, 1, id, fp).f); h.push(stoneDetail(S, R() * 200, R() * 30, 0, id, fp).f); }
      const sv = stats(v), sh = stats(h);
      rows.push(`stone detail at footprint ${fp} m: vertical faces mean ${sv.mean.toFixed(4)} 1σ ${(100 * sv.sd).toFixed(1)} %; bedding planes mean ${sh.mean.toFixed(4)} 1σ ${(100 * sh.sd).toFixed(1)} %`);
      expect(Math.abs(sv.mean - 1), `vertical ${fp}`).toBeLessThan(0.01); expect(Math.abs(sh.mean - 1), `horizontal ${fp}`).toBeLessThan(0.01);
    }
    expect(pitMean(S.pits)).toBeLessThan(1); expect(styloMean(S.stylo)).toBeLessThan(1);
  });
});

describe('sunlit ashlar on screen (D-218; rubric: Ystd/Y 0.04–0.08 measured, real stone 0.15–0.35)', () => {
  // the rubric's views: the W-facing stair in the afternoon sun (the sun 30° up, 30° off the face's normal), a face lit from
  // the side (60° off); the stone's mean at the tone-mapped level measured on the baseline render (OUTY)
  const suns: [string, [number, number, number]][] = [['frontal 41°', [0.43, 0.5, 0.75]], ['raking 66°', [0.8, 0.45, 0.4]]];
  const outY = 0.35;
  it('D-157 reproduces the rubric\'s flat stone; D-218 at least doubles the spread at 5–30 m', () => {
    for (const [tag, sun] of suns) for (const dist of [5, 10, 30]) {
      const m = (d: typeof L) => { let f = 0; const N = 2; for (let k = 0; k < N; k++) f += renderWall(d, { dist, sun, outY, patch: [3 + k * 17.3, 1.3 + k * 3.1, 4, 3] }).flat / N; return f; };
      const before = m(d157(L)), after = m(L);
      rows.push(`sun ${tag}, ${dist} m: Ystd/Y ${before.toFixed(3)} (D-157) → ${after.toFixed(3)} (D-218)`);
      expect(before, 'the old surface as the rubric measured it').toBeLessThan(0.085);
      expect(after / before).toBeGreaterThan(1.8);
    }
    report();
  }, 600_000);
  it('a bed joint reads in sun: at 5 m a light and a dark line either side (the rounded arrises), at 30 m still a line', () => {
    // a vertical profile across one bed joint: pixel rows of the albedo × Lambert factor, relative to the block's mean
    const sun = [0.43, 0.5, 0.75], l = Math.hypot(...sun), Ls = sun.map(c => c / l);
    // the pixel row just below the joint (the lower block's upper arris, turned up toward the sun) and just above it (the
    // upper block's lower arris, turned down), each against rows 3–5 px away on its own block (the two blocks' tones differ)
    const prof = (d: typeof L, dist: number, x: number, yJ: number) => {
      const px = (2 * Math.tan((23 * Math.PI) / 180) * dist) / 540;
      const lit = (k: number) => { const P = ashlarPixel(d, x, yJ + (k + 0.5) * px, 0.37, px); return P.f * (P.n[0] * Ls[0] + P.n[1] * Ls[1] + P.n[2] * Ls[2] + 0.15); };
      const below = (lit(-4) + lit(-5) + lit(-6)) / 3, above = (lit(3) + lit(4) + lit(5)) / 3;
      return { up: lit(-1) / below - 1, down: lit(0) / above - 1 };
    };
    const yJ = findBed(); // the bed joint nearest y = 6.3 m (horizontal: the same on every column)
    let bright5 = 0, dark5 = 0, dark10 = 0, dark30 = 0, n = 0;
    for (let x = 0.7; x < 60; x += 2.9) { const p5 = prof(L, 5, x, yJ), p10 = prof(L, 10, x, yJ), p30 = prof(L, 30, x, yJ); bright5 += p5.up; dark5 += p5.down; dark10 += p10.down; dark30 += p30.down; n++; }
    bright5 /= n; dark5 /= n; dark10 /= n; dark30 /= n;
    rows.push(`bed joint in sun (mean of ${n} columns): at 5 m the row below the joint ${(100 * bright5).toFixed(1)} %, the row above ${(100 * dark5).toFixed(1)} %; the row above at 10 m ${(100 * dark10).toFixed(1)} %, at 30 m ${(100 * dark30).toFixed(1)} %`);
    report();
    // D-157's gate on the joint's albedo ink (a pixel row 12–30 % darker at 10 m, 4–10 % at 30 m), now met by the rounded arris
    expect(bright5).toBeGreaterThan(0.03); expect(dark5).toBeLessThan(-0.2); expect(dark10).toBeLessThan(-0.12); expect(dark10).toBeGreaterThan(-0.3); expect(dark30).toBeLessThan(-0.04);
  });
});
/** the height of the bed joint nearest y = 6.3 m on a wall (materials.ts ashlarCells: pairs of courses of 2 × course, split) */
function findBed() {
  const J = SURFACES.limestone.joints!, V = J.vary!, H = J.course * 2, k = Math.floor(6.3 / H);
  // mirror of the split hash: the joints of the pair are k·H, k·H + split, (k + 1)·H
  const hash12 = (x: number, y: number) => { const fr = (a: number) => a - Math.floor(a); let p0 = fr(x * 0.1031), p1 = fr(y * 0.1031), p2 = fr(x * 0.1031); const d = p0 * (p1 + 33.33) + p1 * (p2 + 33.33) + p2 * (p0 + 33.33); p0 += d; p1 += d; p2 += d; return fr((p0 + p1) * p2); };
  const split = hash12(k, 7.13) * (V.course[1] - V.course[0]) + V.course[0];
  return [k * H, k * H + split, (k + 1) * H].reduce((a, b) => (Math.abs(b - 6.3) < Math.abs(a - 6.3) ? b : a));
}

describe('merlons, frames, mud plaster (D-218)', () => {
  it('the merlons are monoliths of the dressed stone: their own surface, no joints across them, weathered ledges', () => {
    const { parts } = buildTerrace(), m = buildStairCrenellations(parts)!;
    expect((m.material as any).userData.note).toMatch(/merlon/);
    const d = SURFACES.limestone_merlon; expect(d.monolith).toBeTruthy(); expect(d.albedo).toEqual(L.albedo); expect(d.stone).toBe(L.stone);
    expect(d.monolith!.w).toBe(0.9); expect(d.monolith!.steps).toBe(4);
  });
  it('the dark door frames are mirror-polished (Tachara "Hall of Mirrors"), the mud plaster has its foot', () => {
    expect(SURFACES.limestone_dark.roughness).toBeLessThanOrEqual(0.12);
    for (const k of ['mudbrick', 'mudbrick_painted']) { const s = SURFACES[k].skirt!; expect(s.h).toBeGreaterThan(0.3); expect(s.h).toBeLessThan(0.8); }
  });
});
