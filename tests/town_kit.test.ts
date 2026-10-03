// D-802: the town kit (tools/blender/kit_town.py -> public/models/kit/town/): every piece in its unit frame, three levels of
// detail each lighter than the last, baked AO in range, within the kit's budget
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { parseTownKit, townPiece } from '../src/render/townKit';

const kit = parseTownKit(JSON.parse(readFileSync('public/models/kit/town/kit.json', 'utf8')), JSON.parse(readFileSync('public/models/kit/town/manifest.json', 'utf8')));
const names = Object.keys(kit.manifest.pieces);
describe('the town kit (D-802)', () => {
  it('has the pieces the town is built from, each in three levels of detail, lighter level by level', () => {
    for (const n of ['wall0', 'wallworn0', 'walllaced0', 'corner', 'foot0', 'doorframe', 'window0', 'parapet0', 'roof0', 'hatch', 'steps', 'awning']) expect(names, n).toContain(n);
    for (const n of names) { const t = [0, 1, 2].map(l => townPiece(kit, n, l as 0 | 1 | 2)!.tris); expect(t[0], n).toBeGreaterThanOrEqual(t[1]); expect(t[1], n).toBeGreaterThanOrEqual(t[2]);
      expect(kit.manifest.pieces[n].tris, n).toEqual(t); }
  });
  it('the wall runs sit in the unit frame (x 0..1, y 0..1, z about +-0.5) and tile: both seams the same profile', () => {
    for (const n of names.filter(n => /^wall/.test(n))) for (const l of [0, 1, 2] as const) { const q = townPiece(kit, n, l)!;
      expect(q.min[0], n).toBeCloseTo(0, 3); expect(q.max[0], n).toBeCloseTo(1, 3); expect(q.min[1], n).toBeCloseTo(0, 3); expect(q.max[1], n).toBeCloseTo(1, 3);
      expect(q.max[2], n).toBeLessThan(0.7); expect(q.min[2], n).toBeGreaterThan(-0.7); // (the batter: the foot ~7 % of the thickness out)
      // the seam profile: the vertices at x = 0 and at x = 1, by height, on each face
      const seam = (x: number) => { const out: string[] = []; for (let k = 0; k < q.nv; k++) if (Math.abs(q.p[k * 3] - x) < 1e-4 && Math.abs(q.p[k * 3 + 2]) > 0.3) out.push(`${q.p[k * 3 + 1].toFixed(3)}:${q.p[k * 3 + 2].toFixed(3)}`); return out.sort(); };
      if (l < 2) expect(seam(0), n).toEqual(seam(1)); }
  });
  it('the baked AO is in range and the open faces are not darkened; within the budget', () => {
    for (const [n, q] of Object.entries(kit.pieces)) { expect(Math.min(...q.ao), n).toBeGreaterThanOrEqual(0); expect(Math.max(...q.ao), n).toBeLessThanOrEqual(1); }
    const w = kit.pieces.wall0, mean = w.ao.reduce((a, b) => a + b, 0) / w.nv; expect(mean).toBeGreaterThan(0.85);
    for (const n of names) expect(townPiece(kit, n, 0)!.tris, n).toBeLessThanOrEqual(1700);
    expect(statSync('public/models/kit/town/kit.json').size).toBeLessThan(600_000);
  });
});
