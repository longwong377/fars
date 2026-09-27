// D-300: T-A7's CPU mirror on the Terrace (every scannable surface drawn with its scan) and the polygonal foot's geometry (Q-600).
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { terraceScanCoverage } from '../tools/dev/scan_coverage_d300';
import { SCAN_USE, SCANNABLE, ALB_MIN, scanOf } from '../src/render/scans';
import SCANS from '../src/data/scans.json';
import { buildTerrace } from '../src/arch/terrace';
import { footEdges, footBlocks, footGeometry, footTop, FOOT_DEPTH } from '../src/arch/terrace_foot';
import { MASONRY } from '../src/render/masonry';

describe('D-300 scans on the Terrace (T-A7, CPU mirror by surface area)', () => {
  it('every scan in use is measured and shipped', () => {
    for (const [k, u] of Object.entries(SCAN_USE)) for (const id of u.rock ? [u.scan, u.rock.scan] : [u.scan]) {
      expect((SCANS as any)[id]?.meanLinear, `${k}: ${id} in scans.json`).toHaveLength(3);
      for (const f of ['diff', 'arm']) expect(existsSync(`public/textures/${id}/${f}.jpg`), `${id}/${f}.jpg`).toBe(true);
    }
  });
  it('no scannable surface of the Terrace is drawn as a procedural stand-in (T-A7 <= 0 %)', () => {
    const r = terraceScanCoverage();
    const stand = r.rows.filter(q => q.standIn).map(q => `${q.surface} ${(q.share * 100).toFixed(2)} %`);
    expect(stand, stand.join(', ')).toEqual([]);
    expect(r.standIn).toBe(0);
    // the anti-proxy: a scan that reads (blend >= ALB_MIN) on every scannable surface the Terrace draws
    for (const q of r.rows) if (SCANNABLE[q.surface]) expect(SCAN_USE[q.surface]?.alb, q.surface).toBeGreaterThanOrEqual(ALB_MIN);
    expect(r.rows.find(q => q.surface === 'terrace')?.scan).toBe(scanOf('terrace'));
  }, 600_000);
});

describe('D-300 the polygonal foot as geometry (terrace.r_masonry.foot, Q-600)', () => {
  const { parts } = buildTerrace();
  const E = footEdges(parts);
  it('blocks on the salient\'s W face where #24 shows the foot, none S of it', () => {
    const w = E.find(e => Math.abs(e.a[0] + 61.45) < 0.2 && Math.abs(e.n[0] + 1) < 0.01)!;
    expect(w).toBeTruthy();
    const B = footBlocks(w);
    expect(B.length).toBeGreaterThan(20);
    // present along the salient's N part (n 2..45, the calib-24 region), as the shader's mask
    const x = -61.45, has = (n: number) => footTop(x, -n, -1, 0) > 0;
    let on = 0; for (let n = 2; n <= 45; n += 1) on += has(n) ? 1 : 0;
    expect(on).toBeGreaterThan(30);
  });
  it('faces outward, proud by the stated depths, within the foot zone', () => {
    const g = footGeometry(parts);
    expect(g.blocks).toBeGreaterThan(100);
    for (const e of E) for (const b of footBlocks(e)) {
      expect(b.depth).toBeGreaterThanOrEqual(FOOT_DEPTH[0]); expect(b.depth).toBeLessThanOrEqual(FOOT_DEPTH[1]);
      const top = Math.max(...b.poly.map(p => p[1]));
      expect(top).toBeLessThan(MASONRY.foot.ground + MASONRY.foot.height + 2 * MASONRY.foot.row);
    }
    const p = g.geo!.attributes.position.array as Float32Array, n = g.geo!.attributes.normal.array as Float32Array;
    // the first triangle is the first block's face on the first edge: its normal along that edge's outward normal
    expect(n[0] * E[0].n[0] + n[2] * E[0].n[1]).toBeGreaterThan(0.9);
    expect(p.length % 9).toBe(0);
  });
});
