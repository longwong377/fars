// D-285: the Terrace's materials against the references. CPU mirrors of the shader (tests/lib/stone_cpu.ts, plaster_cpu.ts) measure
// the rubric's flatness statistic, Ystd/Y (linear Y after AgX), before D-285 (the switches off) and after, at the scales of the
// views it is judged in, against the photographs measured at the same pixel footprint (tools/dev/plaster_photo_d285.py,
// stone_photo_d230.py). Numbers to bench-reports/materials-d285.txt.
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { SURFACES } from '../src/render/materials';
import { renderWall, setSoil, ashlarCells, ashlarPixel } from './lib/stone_cpu';
import { renderPlaster, setPlaster285, type PlasterWall } from './lib/plaster_cpu';

/** the photographs at the render's footprint (tools/dev/plaster_photo_d285.py): 0.032 m/px (the Gate at 24 m, 40°, 540 rows) */
export const PHOTO = {
  plaster21: { w05: 0.036, w05fine: 0.041 }, // #21 the modern kahgel coat round the Gate's hall (maintained; an analogue, C): 0.5 m
  // windows (median of 19 boxes) at 0.032 and 0.016 m/px
  pier21: { w05: 0.383 }, pier05: { w05: 0.297 }, // the Gate's piers, weathered 2,500 years (upper bound)
  wall24: { region: 0.366, win48: 0.431 },         // #24 the Terrace W wall (calib24_compare.py, stone_photo_d230.py)
};
const B40 = [0.15, 0.25];
const rows: string[] = [];
const report = () => { mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/materials-d285.txt', rows.join('\n') + '\n'); };
const both = <T>(f: () => T, on: (b: boolean) => void): [T, T] => { on(false); const a = f(); on(true); const b = f(); return [a, b]; };

describe('D-285 mud plaster (the Gate\'s walls, every mudbrick wall of the Terrace)', () => {
  const d = SURFACES.mudbrick;
  const GATE: PlasterWall = { base: 0, top: 18.5, z: 0.37 }; // the Gate's 18.5 m walls (SITE_SPEC gate_nations)
  it('at the gate views\' scale the spread lies inside the photographs\' range, higher than before', () => {
    const res: [{ w05: number; w15: number }, { w05: number; w15: number }][] = [];
    const suns: [string, [number, number, number]][] = [['sun 12° off the normal, 19° up', [0.21, 0.33, 0.92]], ['raking sun 60° off, 19° up', [0.82, 0.33, 0.47]]];
    for (const [tag, sun] of suns) {
      for (const [zone, y0] of [['mid-wall', 6], ['top 4 m (rain wash)', 14.8]] as const) {
        const V = { dist: 24, fovDeg: 40, rows: 540, sun, outY: 0.3, patch: [2.3, y0, 9, 3.5] as [number, number, number, number] };
        const [a, b] = both(() => { const w05 = renderPlaster(d, GATE, V, 16), w15 = renderPlaster(d, GATE, V, 48); return { r: w05.region, w05: w05.windows, w15: w15.windows }; }, setPlaster285);
        rows.push(`plaster, 24 m (0.032 m/px), ${tag}, ${zone}: region ${a.r.toFixed(3)} → ${b.r.toFixed(3)}; 0.5 m windows ${a.w05.toFixed(3)} → ${b.w05.toFixed(3)}; 1.5 m windows ${a.w15.toFixed(3)} → ${b.w15.toFixed(3)} (photo: kahgel coat ${PHOTO.plaster21.w05}, weathered stone ${PHOTO.pier21.w05})`);
        res.push([a, b]);
      }
    }
    report();
    for (const [a, b] of res) {
      expect(b.w15).toBeGreaterThan(a.w15);
      expect(b.w05).toBeGreaterThan(PHOTO.plaster21.w05 * 0.8); // at least the maintained coat's spread (the photo's JPEG smooths it)
      expect(b.w05).toBeLessThan(PHOTO.pier21.w05);
    }
  }, 900_000);
  it('the whole wall at 60 m: the lifts, bays and the wash read as structure (region vs a noise of the same spread)', () => {
    const V = { dist: 60, fovDeg: 40, rows: 540, sun: [0.21, 0.33, 0.92] as [number, number, number], outY: 0.3, patch: [0, 0.8, 24, 17.5] as [number, number, number, number] };
    const [a, b] = both(() => renderPlaster(d, GATE, V, 48), setPlaster285);
    rows.push(`plaster, whole Gate wall at 60 m (0.081 m/px): region ${a.region.toFixed(3)} → ${b.region.toFixed(3)}; 3.9 m windows ${a.windows.toFixed(3)} → ${b.windows.toFixed(3)}`);
    expect(b.region).toBeGreaterThan(a.region);
    report();
  }, 900_000);
});

describe('D-285 soiled ashlar (B40: sunlit stone Ystd/Y 0.15-0.25)', () => {
  const sun: [number, number, number] = [0.21, 0.33, 0.92];
  it('the stains hang from the bed joints (structure, not noise): darker just under a joint than mid-block', () => {
    const d = SURFACES.limestone, px = 0.004, J = d.joints!;
    const bands = () => {
      let nearS = 0, nearN = 0, midS = 0, midN = 0;
      for (let y = 0.3; y < 10; y += px * 3) for (let x = 0.3; x < 40; x += px * 7) {
        const C = ashlarCells(x, y, J); if (C.dHead < 0.05 || C.dBed < 0.01) continue;
        const f = ashlarPixel(d, x, y, 0.37, px).f;
        if (C.dAbove < 0.2) { nearS += f; nearN++; } else if (C.dAbove > 0.5 && C.dBed > 0.2) { midS += f; midN++; }
      }
      return nearS / nearN / (midS / midN);
    };
    const [a, b] = both(bands, on => setSoil(on, 0.7));
    rows.push(`limestone: albedo 0-0.2 m under a bed joint / mid-block ${a.toFixed(4)} → ${b.toFixed(4)} (the drip stains)`);
    report();
    expect(b).toBeLessThan(a - 0.003);
  }, 900_000);
  it('frontal wall at 10 m (48 px windows) and the #24 view\'s salient face (region, 1-6.5 m below the top)', () => {
    const res: [[number, number], [number, number]][] = [];
    for (const [name, d] of [['limestone', SURFACES.limestone], ['terrace', SURFACES.terrace]] as const) {
      const near = both(() => { let f = 0; const N = 6; for (let k = 0; k < N; k++) f += renderWall(d, { dist: 10, fovDeg: 40, rows: 540, sun, outY: 0.35, patch: [3 + k * 11.3, 1.3 + (k % 3) * 2.1, 0.7, 0.7], top: 12 }).flat / N; return f; }, on => setSoil(on, 0.7));
      const far = both(() => renderWall(d, { dist: 150, fovDeg: 34.4, rows: 905, sun, outY: 0.35, patch: [2, -6.5, 43, 5.5], top: 0 }), on => setSoil(on, 0.75));
      rows.push(`${name}: 10 m frontal, 48 px windows ${near[0].toFixed(3)} → ${near[1].toFixed(3)}; #24 view (150 m, 34.4°, 905 rows) region on screen ${far[0].flat.toFixed(3)} → ${far[1].flat.toFixed(3)}, scene-linear ${far[0].sceneFlat.toFixed(3)} → ${far[1].sceneFlat.toFixed(3)} (B40 ${B40.join('-')}: NOT MET; photo #24 ${PHOTO.wall24.region}, weathered)`);
      res.push([near, [far[0].flat, far[1].flat]]);
    }
    report();
    // the soiling never flattens the stone; B40 itself is not asserted: it is not met (BLOCKERS B40, D-285)
    for (const [n, f] of res) { expect(n[1]).toBeGreaterThan(n[0] - 0.002); expect(f[1]).toBeGreaterThan(f[0] - 0.002); }
  }, 900_000);
});

describe('D-285 the Now view\'s stone against photograph #24 (session 11, the lead\'s GPU measurement)', () => {
  // D-300: D-285's CPU derivation (from the lead's render: wall 141/132/118, ground 90.8) was checked on the GPU (session 11,
  // calib-24-now with the D-285 tint: wall 105/91/78, luma 92.7 against the photo's 86.3; R/B 1.33 against 1.74; the ground 86
  // against 125: the gap in wall/ground is the ground's, fixed by the Now view's gravel forecourt, NOW_GRAVEL). The D-300 tint is
  // derived from that render: the photo's wall colour within 15 %
  it('the tint takes the wall toward the photo colour (D-300, from the latest render)', async () => {
    const { NOW_STONE_TINT } = await import('../src/world/nowview');
    const { agxGrey } = await import('./lib/stone_cpu');
    const dec = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const enc = (y: number) => (y <= 0.0031308 ? y * 12.92 : 1.055 * y ** (1 / 2.4) - 0.055) * 255;
    const inv = (d: number) => { let lo = 1e-6, hi = 100; for (let i = 0; i < 80; i++) { const m = Math.sqrt(lo * hi); if (agxGrey(m) < d) lo = m; else hi = m; } return Math.sqrt(lo * hi); };
    // from the latest GPU render of calib-24-now (D-300 render 2: wall 108/86/73 with the tint 0.327/0.178/0.15; the D-285 render
    // gave 105/91/78 with 0.284/0.212/0.203; the mono AgX mirror over-predicts the hue shift ~1.5×, so each step is re-anchored)
    const render = [108, 86, 73], D285 = [0.327, 0.178, 0.15], photo = { luma: 86.3, rb: 1.74 };
    const out = render.map((c, i) => enc(agxGrey(inv(dec(c)) * NOW_STONE_TINT[i] / D285[i])));
    const luma = 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2];
    rows.push(`Now view stone (calib-24-now, D-300 render 2): wall rgb ${render.join('/')} → ${out.map(v => v.toFixed(0)).join('/')}; luma → ${luma.toFixed(1)} (photo ${photo.luma}); R/B ${(render[0] / render[2]).toFixed(2)} → ${(out[0] / out[2]).toFixed(2)} (photo ${photo.rb})`);
    report();
    expect(Math.abs(luma / photo.luma - 1)).toBeLessThan(0.15);
    expect(Math.abs(out[0] / out[2] / photo.rb - 1)).toBeLessThan(0.15);
  });
});
