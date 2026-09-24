// Session-6 surfaces and outdoor light (D-188; §8.2 rubric first pass, fixes 1, 2, 4, 6, 10). Measurements in node: the
// albedos against the evidence they are read from, the Treasury's painted walls, the ceiling timbers, the SSR blur's
// footprint, and the sun contact shadows' self-hits on a CPU mirror of the screen-space march.
import { describe, it, expect } from 'vitest';
import { SURFACES, atY } from '../src/render/materials';
import { munsellY, srgbToLinear } from '../src/core/colour';
import { buildTerrace } from '../src/arch/terrace';
import { ceilingTimbers, CEILING } from '../src/arch/ceilings';
import { ssrBlurLod } from '../src/render/pipeline';
import { falseShadowRate, type SSSCase } from './lib/sss_cpu';
import { crenellationGeometry, CREN_BEVEL } from '../src/arch/decor';
import { writeFileSync, mkdirSync } from 'node:fs';

const Y = (s: [number, number, number]) => { const l = s.map(srgbToLinear); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
const lin = (s: [number, number, number]) => s.map(srgbToLinear);

describe('albedos from the evidence (D-188)', () => {
  it("the Terrace limestone is 'light grey' (N7, 42 %) in every dressed, carved and platform surface", () => {
    for (const k of ['limestone', 'limestone_carved', 'terrace', 'rubble']) expect(Y(SURFACES[k].albedo), k).toBeCloseTo(munsellY(7), 3);
    expect(munsellY(7)).toBeGreaterThan(0.41); expect(munsellY(7)).toBeLessThan(0.43);
    // the dark Majdabad stone stays N3 (D-031)
    expect(Y(SURFACES.limestone_dark.albedo)).toBeCloseTo(munsellY(3), 3);
  });
  it('mud plaster is a buff earth (no green cast); the greyish yellow-green clay paint is the Treasury walls alone', () => {
    const m = lin(SURFACES.mudbrick.albedo), g = lin(SURFACES.mudbrick_painted.albedo);
    expect(m[0] / m[1]).toBeGreaterThan(1.25); // warm: red over green
    expect(g[0] / g[1]).toBeLessThan(1.1); // the paint: green-grey (R ≈ G), yellowish (B low)
    expect(Math.abs(Y(SURFACES.mudbrick.albedo) - Y(SURFACES.mudbrick_painted.albedo))).toBeLessThan(0.02); // the same lightness
    const { parts } = buildTerrace(), walls = (parts as any[]).filter(p => p.kind === 'wall' || p.kind === 'curtain' || p.kind === 'tower' || p.kind === 'storerooms');
    const painted = walls.filter(p => p.material === 'mudbrick_painted');
    expect(painted.length).toBeGreaterThan(20);
    expect(new Set(painted.map(p => p.building))).toEqual(new Set(['treasury']));
    expect(walls.filter(p => p.building !== 'treasury' && p.material === 'mudbrick').length).toBeGreaterThan(200);
    expect(walls.filter(p => p.building === 'treasury' && p.material === 'mudbrick').length).toBe(0);
  });
  it('cedar is a light brown wood (CIELAB L* ≈ 50), no longer a 5 % stained wood', () => {
    const y = Y(SURFACES.timber.albedo); expect(y).toBeGreaterThan(0.15); expect(y).toBeLessThan(0.22);
    expect(SURFACES.roof_timber.albedo).toEqual(SURFACES.timber.albedo); expect(SURFACES.roof_timber.under).toBe('matting');
  });
  it('atY keeps the hue and sets the luminous reflectance', () => {
    const a = atY(0.3, [0.5, 0.4, 0.3]); expect(Y(a)).toBeCloseTo(0.3, 3);
    const r0 = lin([0.5, 0.4, 0.3]), r1 = lin(a); expect(r1[0] / r1[1]).toBeCloseTo(r0[0] / r0[1], 2);
  });
});

describe('ceiling timbers (D-188)', () => {
  const { parts } = buildTerrace(), T = ceilingTimbers(parts);
  it('every roof over columns has a main beam over each column line, and joists; rooms have joists; nothing is a part', () => {
    const rows: string[] = [];
    const inRoof = (b: any, r: any) => b.building === r.building && Math.abs(b.y1 - r.y0) < 1e-6 && Math.abs(b.c[0] - r.c[0]) <= r.size[0] / 2 + 1e-6 && Math.abs(b.c[1] - r.c[1]) <= r.size[1] / 2 + 1e-6;
    for (const r of (parts as any[]).filter(p => p.kind === 'roof')) {
      const mine = T.filter(b => inRoof(b, r));
      const beams = mine.filter(b => b.kind === 'ceiling_beam'), joists = mine.filter(b => b.kind === 'ceiling_joist');
      rows.push(`${r.building} roof at ${r.y0.toFixed(2)} m (${r.size.map((v: number) => v.toFixed(1)).join(' × ')} m): ${beams.length} beams, ${joists.length} joists`);
      expect(joists.length, r.building).toBeGreaterThan(0);
      for (const b of mine) { expect(b.solid).toBe(false); expect(b.tier).toBe('C'); }
    }
    for (const b of ['apadana', 'hadish', 'tachara', 'harem', 'treasury']) expect(T.some(t => t.building === b && t.kind === 'ceiling_beam'), b).toBe(true);
    // render geometry only: the parts (colliders, walkable grid, probes, plan tests) are unchanged
    expect((parts as any[]).some(p => p.kind === 'ceiling_beam' || p.kind === 'ceiling_joist')).toBe(false);
    const tris = T.length * 12; rows.push(`total ${T.length} boxes, ${tris} triangles`);
    expect(tris).toBeLessThan(60000);
    mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/ceilings.txt', rows.join('\n') + '\n');
  });
  it('joists keep clear of the capitals: none within ±0.55 D of a column row under its roof', () => {
    const cols = (parts as any[]).filter(p => p.type === 'column' && p.built >= 1);
    for (const j of T.filter(b => b.kind === 'ceiling_joist')) {
      const near = cols.filter(c => c.building === j.building && Math.abs(c.y0 + c.order.height - j.y1) < 0.05 && Math.abs(c.c[0] - j.c[0]) < j.size[0] / 2 + 1.7 * c.order.shaftD);
      for (const c of near) expect(Math.abs(c.c[1] - j.c[1]), `${j.building} joist at ${j.c}`).toBeGreaterThanOrEqual(0.55 * c.order.shaftD);
    }
    expect(CEILING.joistStep).toBeLessThan(1);
  });
});

describe('SSR blur by the glossy lobe (D-188)', () => {
  const px = (2 * Math.tan((23 * Math.PI) / 180)) / 540; // 46° at 540 rows (the captures)
  it('a polished floor (r 0.35) blurs what it reflects metres away to the broad mips, and stays sharp at contact', () => {
    expect(ssrBlurLod(5, 0.35, 8, px, 5)).toBeGreaterThan(3.5); // a column 5 m off: a broad soft sheen
    expect(ssrBlurLod(0.3, 0.35, 8, px, 5)).toBeLessThan(1.2); // a base at its foot: sharp contact reflection
    expect(ssrBlurLod(5, 0.05, 8, px, 5)).toBeLessThan(0.5); // a puddle stays a mirror
    // the old rule (lod = r² × mips) for comparison: 0.61 at r 0.35, whatever the distance
    expect(0.35 * 0.35 * 5).toBeLessThan(0.7);
  });
});

describe('sun contact shadows: no self-shadowing (D-188)', () => {
  const base: SSSCase = { W: 320, H: 180, fovDeg: 46, eye: [0, 1.6, 0], pitchDeg: -8, sunAltDeg: 60, sunAzDeg: 30, planes: [{ n: [0, 1, 0], d: 0 }], maxDistance: 0.6, thickness: 0.06, quality: 0.5, scale: 0.5 };
  it('open ground and a wall in the sun: the patched march marks no pixel shadowed; a real occluder still shades its foot', () => {
    const rows: string[] = [];
    for (const alt of [20, 45, 70]) for (const az of [0, 90, 180]) {
      const C = { ...base, sunAltDeg: alt, sunAzDeg: az, jitter: [0.3, -0.2] as [number, number] };
      const o = falseShadowRate(C, 'orig'), p = falseShadowRate(C, 'patched');
      rows.push(`ground, sun ${alt}°/${az}°: three ${(100 * o.rate).toFixed(3)} %, patched ${(100 * p.rate).toFixed(3)} % of ${p.lit} lit pixels`);
      expect(p.rate).toBe(0);
    }
    const occ = { ...base, planes: [{ n: [0, 1, 0] as [number, number, number], d: 0 }, { n: [0, 0, 1] as [number, number, number], d: -8 }], pitchDeg: -10, sunAzDeg: 0, sunAltDeg: 50 };
    const o = falseShadowRate(occ, 'orig'), p = falseShadowRate(occ, 'patched');
    rows.push(`ground + wall 8 m ahead, the sun beyond it: three ${o.shadowed}, patched ${p.shadowed} pixels at the wall's foot`);
    expect(p.shadowed).toBeGreaterThan(0.7 * o.shadowed);
    mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/sss-selfhits.txt', rows.join('\n') + '\n');
  });
});

describe('merlons (D-188)', () => {
  it('chamfered inside their outline: same size, a 12 mm bevel', () => {
    const g = crenellationGeometry(1, 1, 4, 1); g.computeBoundingBox(); const b = g.boundingBox!;
    expect(b.max.x - b.min.x).toBeCloseTo(1, 5); expect(b.max.y - b.min.y).toBeCloseTo(1, 5); expect(b.max.z - b.min.z).toBeCloseTo(1, 5);
    expect(CREN_BEVEL).toBeGreaterThanOrEqual(0.005); expect(CREN_BEVEL).toBeLessThanOrEqual(0.02);
    // a chamfer adds faces whose normals are neither axis-aligned nor in the extrusion plane
    const n = g.getAttribute('normal'); let diag = 0; for (let i = 0; i < n.count; i++) if (Math.abs(n.getZ(i)) > 0.3 && Math.abs(n.getZ(i)) < 0.95) diag++;
    expect(diag).toBeGreaterThan(0);
  });
});
