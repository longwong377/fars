// D-232: the Terrace retaining walls' joint layout against the photographed one (photo #24 rectified onto the wall planes:
// tools/dev/masonry_photo_d232.py). CPU mirrors of the shader's course tables and head joints (src/render/masonry.ts,
// materials.ts retainingCells) and of the foot's placement (tools/dev/foot_place_d232.ts).
import { describe, it, expect } from 'vitest';
import { MASONRY, courseTables, courseTexels, courseAt, headJoints, TABLE_W } from '../src/render/masonry';
import { score } from '../tools/dev/foot_place_d232';
import SPEC from '../src/data/site_spec.json';

/** the photo's distributions (masonry_photo_d232.py: 47 course heights, 57 block lengths on face A / B of #24) */
const PHOTO = { course: { p25: 0.9, median: 1.1, p75: 1.35, thin: 0.213, tall: 0.149, min: 0.45, max: 1.65 }, block: { p25: 2.0, median: 2.2, p75: 3.5, long: 0.263, min: 1.15, max: 7.0 },
  foot: { share: 0.377, height: 4.84 } };
const pct = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b), k = (s.length - 1) * q, i = Math.floor(k); return s[i] + (s[Math.min(s.length - 1, i + 1)] - s[i]) * (k - i); };

describe('the retaining walls\' courses (D-232)', () => {
  const T = courseTables();
  const heights = T.flatMap(b => b.slice(1).map((z, i) => b[i] - z).filter((_, i) => i > 0)); // below the datum course
  it('course heights match the photographed distribution (quartiles within 0.1 m, thin and tall shares within 0.08)', () => {
    const got = { p25: pct(heights, 0.25), median: pct(heights, 0.5), p75: pct(heights, 0.75), thin: heights.filter(h => h < 0.75).length / heights.length, tall: heights.filter(h => h >= 1.5).length / heights.length };
    // the pre-D-232 coursing (HAIRLINE: pairs of courses sharing 2.1 m, split 0.8-1.3 m): quartiles 0.93 / 1.05 / 1.18, none thin or tall
    console.log(`courses (n ${heights.length}): p25 ${got.p25.toFixed(2)} median ${got.median.toFixed(2)} p75 ${got.p75.toFixed(2)} thin ${got.thin.toFixed(3)} tall ${got.tall.toFixed(3)} | photo 0.90 / 1.10 / 1.35, 0.213, 0.149 | before 0.93 / 1.05 / 1.18, 0, 0`);
    expect(Math.abs(got.p25 - PHOTO.course.p25)).toBeLessThan(0.1); expect(Math.abs(got.median - PHOTO.course.median)).toBeLessThan(0.1);
    expect(Math.abs(got.p75 - PHOTO.course.p75)).toBeLessThan(0.1);
    expect(Math.abs(got.thin - PHOTO.course.thin)).toBeLessThan(0.08); expect(Math.abs(got.tall - PHOTO.course.tall)).toBeLessThan(0.08);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(PHOTO.course.min - 0.011); expect(Math.max(...heights)).toBeLessThanOrEqual(PHOTO.course.max + 0.011);
  });
  it('the table holds whole bins: every bed a multiple of the quantum; each bin names the course that contains it', () => {
    const tex = courseTexels(); expect(tex.w).toBe(TABLE_W); expect(tex.h).toBe(MASONRY.sections + 1);
    for (const b of T) for (const z of b) expect(Math.abs(z / MASONRY.quantum - Math.round(z / MASONRY.quantum))).toBeLessThan(1e-6);
    for (let r = 0; r < tex.h; r++) for (let y = -30; y < 1.5; y += 0.0137) {
      const c = courseAt(y, r, tex); expect(c.below).toBeLessThanOrEqual(y + 1e-6); expect(c.above).toBeGreaterThanOrEqual(y - 1e-6);
    }
    // the sections differ (the photo's salient and the wall S of it do not share their bed levels)
    expect(new Set(T.map(b => b.slice(2, 6).join(','))).size).toBe(T.length);
  });
});

describe('the retaining walls\' blocks (D-232)', () => {
  it('block lengths match the photographed distribution (quartiles within 0.35 m, long share within 0.08, 1.0-7.6 m)', () => {
    const L: number[] = [];
    for (let c = 0; c < 4000; c += 1) { const j = headJoints(c * 1.0, 0, 120); for (let i = 1; i < j.length; i++) L.push(j[i] - j[i - 1]); }
    const got = { p25: pct(L, 0.25), median: pct(L, 0.5), p75: pct(L, 0.75), long: L.filter(x => x >= 3.5).length / L.length };
    console.log(`blocks (n ${L.length}): p25 ${got.p25.toFixed(2)} median ${got.median.toFixed(2)} p75 ${got.p75.toFixed(2)} long ${got.long.toFixed(3)} min ${L.reduce((a, b) => Math.min(a, b)).toFixed(2)} max ${L.reduce((a, b) => Math.max(a, b)).toFixed(2)} | photo 2.0 / 2.2 / 3.5, 0.263, 1.15-7.0 | before 1.97 / 2.30 / 2.63, 0, 1.15-3.45`);
    expect(Math.abs(got.p25 - PHOTO.block.p25)).toBeLessThan(0.35); expect(Math.abs(got.median - PHOTO.block.median)).toBeLessThan(0.35);
    expect(Math.abs(got.p75 - PHOTO.block.p75)).toBeLessThan(0.35); expect(Math.abs(got.long - PHOTO.block.long)).toBeLessThan(0.08);
    expect(L.reduce((a, b) => Math.min(a, b))).toBeGreaterThan(0.9); expect(L.reduce((a, b) => Math.max(a, b))).toBeLessThan(7.7);
  });
  it('the Grand Stair recess: head joints lean (up to ±12°) and stay inside their run', () => {
    let maxLean = 0;
    for (let c = 0; c < 300; c++) {
      const top = headJoints(c, 5, 55, true, 0.5, 1.4), bot = headJoints(c, 0, 60, true, -0.5, 1.4);
      for (const x of top) maxLean = Math.max(maxLean, Math.min(...bot.map(y => Math.abs(x - y))) / 1.4);
    }
    expect(maxLean).toBeGreaterThan(0.15); expect(maxLean).toBeLessThanOrEqual(2 * MASONRY.stair.oblique * 0.5 * 2 + 1e-9);
  });
});

describe('the retaining walls\' foot (D-232)', () => {
  it('present where #24 sees it (the salient\'s W face, its first ~57 m), absent S of it, along ~38 % of the W and S walls', () => {
    const F = MASONRY.foot, r = score(F.offset, F.lambda, F.theta, F.w);
    console.log(`foot: W/S share ${r.share.toFixed(3)} (photo ${PHOTO.foot.share}); seen ${r.seen.toFixed(2)}; absent-read ${r.miss.toFixed(2)}`);
    expect(r.seen).toBeGreaterThan(0.9); expect(r.miss).toBeLessThan(0.15); expect(Math.abs(r.share - PHOTO.foot.share)).toBeLessThan(0.06);
    expect(Math.abs(F.height - PHOTO.foot.height)).toBeLessThan(0.3);
  });
  it('SITE_SPEC row: tier C, sourced to the photographs', () => {
    const row = (SPEC as any).terrace.r_masonry; expect(row.tier).toBe('C'); expect(row.src).toMatch(/REF-PHOTO-24/); expect(row.src).toMatch(/REF-PHOTO-33/);
  });
});

describe('the retaining walls\' shader (D-232)', () => {
  it('builds WGSL with no dropped TSL assignment (render 1: the foot\'s Voronoi ran outside a Fn(), its assigns were lost and the whole wall read as one block)', async () => {
    const THREE = await import('three/webgpu');
    const { surfaceMaterial } = await import('../src/render/materials');
    const { installProbeLight } = await import('../src/render/probes/runtime');
    const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); installProbeLight(r); r.hasFeature = () => true;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 1e5);
    const errs: string[] = [], orig = console.error, origW = console.warn;
    console.error = (...a: any[]) => { errs.push(a.join(' ')); }; console.warn = (...a: any[]) => { errs.push(a.join(' ')); };
    try {
      for (const k of ['terrace', 'terrace_now']) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), surfaceMaterial(k, { arch: false }));
        const b = new (THREE as any).WGSLNodeBuilder(mesh, r); b.scene = scene; b.camera = camera; b.material = mesh.material; b.lightsNode = r.lighting.getNode(scene, camera); b.build();
        expect(b.fragmentShader).toMatch(/textureLoad/);
      }
    } finally { console.error = orig; console.warn = origW; }
    expect(errs.filter(e => /No stack|assign/i.test(e))).toEqual([]);
  }, 120_000);
});
