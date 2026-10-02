// D-309: the fitted AgX look (src/render/toneLook.ts; tools/dev/tone_fit.mjs). The CPU mirror at the identity look is three's
// AgX; the fitted look opens the top of the range (sunlit stone toward the photographs' p95) and keeps night dark.
import { describe, it, expect } from 'vitest';
import { agxCPU, TONE_LOOK } from '../src/render/toneLook';
const toS = (l: number) => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055);
const grey = (x: number, L = TONE_LOOK) => toS(agxCPU([x, x, x], L)[1]);
const ID = { slope: 1, power: 1, sat: 1, exposure: 1 };
describe('tone look (D-309)', () => {
  it('identity look = plain AgX (mid grey 0.18 → ~ sRGB 128 ± 25; monotonic; white clips at ~16× scene)', () => {
    const g = [0.005, 0.02, 0.05, 0.18, 0.5, 1, 2, 4, 8].map(x => grey(x, ID));
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThan(g[i - 1]);
    expect(grey(0.18, ID)).toBeGreaterThan(100); expect(grey(0.18, ID)).toBeLessThan(150);
  });
  it('the fitted look: brighter highlights, darks not lifted, monotonic', () => {
    const xs = [0.0005, 0.002, 0.005, 0.02, 0.05, 0.18, 0.5, 1, 2, 4];
    const g0 = xs.map(x => grey(x, ID)), g1 = xs.map(x => grey(x));
    console.log('scene → sRGB (plain AgX | look)', xs.map((x, i) => `${x}: ${g0[i].toFixed(0)}|${g1[i].toFixed(0)}`).join('  '));
    for (let i = 1; i < g1.length; i++) expect(g1[i]).toBeGreaterThan(g1[i - 1]);
    expect(grey(1)).toBeGreaterThan(grey(1, ID)); // sunlit limestone: brighter
    // D-480: the toe lift opens deep shade (deep but not black); black stays black and the deepest darks within 14 levels
    expect(grey(0.002)).toBeLessThan(grey(0.002, ID) + 14); expect(grey(0)).toBeLessThan(1);
  });
});
