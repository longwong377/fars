import { describe, it, expect } from 'vitest';
import { SURFACES } from '../src/render/materials';
import { buildTerrace } from '../src/arch/terrace';
import { columnMesh } from '../src/arch/sculpt';
import { writeFileSync, mkdirSync } from 'node:fs';

// Brief §8.3 "Detail: minimum texel and triangle density at 1 m" (session 4, D-147). At 1440p with the default 70° vertical
// field of view a pixel at 1 m spans 2·tan 35° / 1440 ≈ 0.97 mm. Surfaces are procedural (no texels), so the texel
// criterion is the finest wavelength of their texture (noise, relief and micro grain); geometry is judged by the
// silhouette chord error of the curved stone (the lathe-turned column members) at LOD0.
const PX_1M = (2 * Math.tan((35 * Math.PI) / 180)) / 1440;
const ARCH = ['limestone', 'limestone_carved', 'limestone_dark', 'mudbrick', 'plaster', 'plaster_red', 'timber', 'earth', 'court_fill', 'terrace'];

describe('§8.3 detail at 1 m', () => {
  it('every architectural and ground surface carries texture detail of ≤ 2 cm wavelength (≥ 20 px per period at 1 m)', () => {
    const rows: string[] = [];
    for (const k of ARCH) {
      const d = SURFACES[k]; expect(d, k).toBeTruthy();
      const finest = 1 / Math.max(d.noiseScale * 9, d.bump ? d.bump.freq * 5.3 : 0, d.micro?.freq ?? 0);
      rows.push(`${k}: finest ${(finest * 1000).toFixed(1)} mm (${(finest / PX_1M).toFixed(0)} px at 1 m)`);
      expect(finest, k).toBeLessThanOrEqual(0.02);
    }
    mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/detail-surfaces.txt', rows.join('\n') + '\n');
  });
  it('curved stone at LOD0: the silhouette chord error of every column order is ≤ 1.5 px at 1 m', () => {
    const orders = new Map<string, any>();
    for (const p of buildTerrace().parts as any[]) if (p.type === 'column' && p.order.material !== 'timber') orders.set(JSON.stringify(p.order), p.order);
    const rows: string[] = []; let worst = 0;
    for (const o of orders.values()) {
      const m = columnMesh(o, 1, 0), P = m.pos, I = m.idx; let sag = 0;
      for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) {
        const a = I[t + e] * 3, b = I[t + ((e + 1) % 3)] * 3;
        if (Math.abs(P[a + 1] - P[b + 1]) > 1e-4) continue; // an edge along a ring of the lathe
        const ra = Math.hypot(P[a], P[a + 2]), rb = Math.hypot(P[b], P[b + 2]); if (ra < 0.05 || rb < 0.05) continue;
        const cos = (P[a] * P[b] + P[a + 2] * P[b + 2]) / (ra * rb), th = Math.acos(Math.max(-1, Math.min(1, cos)));
        // a lathe ring: a small angular step between vertices of (nearly) one radius; box corners (square plinths, abaci)
        // and the sculpted capital members are not lathes and are judged by their own budgets (tests/sculpt.test.ts)
        if (th > Math.PI / 12 || Math.abs(ra - rb) > 0.03 * Math.max(ra, rb)) continue;
        sag = Math.max(sag, Math.min(ra, rb) * (1 - Math.cos(th / 2)));
      }
      worst = Math.max(worst, sag); rows.push(`${o.id} (${o.base}/${o.capital}, D ${o.shaftD} m): max ring chord error ${(sag * 1000).toFixed(2)} mm = ${(sag / PX_1M).toFixed(2)} px at 1 m`);
    }
    writeFileSync('bench-reports/detail-columns.txt', rows.join('\n') + '\n');
    expect(worst / PX_1M).toBeLessThanOrEqual(1.5);
  });
});
