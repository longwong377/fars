// D-292 (gap hunter C, C-D09): a woman with child carries a belly that grows with the months, drawn on the body and on what
// she wears by a per-instance displacement in the humans' vertex stage (humanMaterial mirrors drape.ts bellyOffset), and
// only a woman who gives birth carries one (Population.gravid from the year's births and the next year's first months).
// Measured in node: on the fitted geometry of the women's dresses for every adult woman's body, and on the population's plans.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeHumanAssets, type HumanAssets } from '../src/people/humanAssets';
import { buildOutfits, COSTUME_OF, type OutfitBuild } from '../src/people/outfits';
import { MAT, PART } from '../src/people/humanFormat';
import { bellyFrame, bellyOffset, BELLY } from '../src/people/drape';
import { buildPop, sampleDays, bodyTrace } from '../tools/dev/body_trace';
import { REGNAL_DAYS } from '../src/people/calendar';
import type { Population } from '../src/people/population';

let A: HumanAssets, O: OutfitBuild;
beforeAll(() => {
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  O = buildOutfits(A, { dresses: ['woman', 'persian'], lods: [0] });
}, 180_000);
const women = () => A.variants.filter(v => (v.meta as any).sex === 'f' && (v.meta as any).group !== 'child');

describe('the belly on the body and the clothes (D-292)', () => {
  it('stands about 15 cm proud at term at the abdomen, grows with the months, and leaves the head, hands, feet and back alone', () => {
    for (const v of women()) { const F = bellyFrame(A, v); let best = 0, far = 0; const at: number[] = [];
      for (const a of [0.25, 0.5, 1]) { let m = 0; for (let i = 0; i < A.NO; i++) { const o = bellyOffset(v.pos[i * 3], v.pos[i * 3 + 1], v.pos[i * 3 + 2], a, F); m = Math.max(m, o.dz); } at.push(m); }
      for (let i = 0; i < A.NO; i++) { const o = bellyOffset(v.pos[i * 3], v.pos[i * 3 + 1], v.pos[i * 3 + 2], 1, F); const part = A.part[i];
        if (part === PART.belly) best = Math.max(best, o.dz);
        if (part === PART.head || part === PART.hand_l || part === PART.hand_r || part === PART.foot_l || part === PART.foot_r || part >= PART.eye || v.pos[i * 3 + 2] < F.z0 - BELLY.front[0]) far = Math.max(far, Math.abs(o.dz) + Math.abs(o.dy)); }
      expect(best, v.meta.id).toBeGreaterThan(0.13); expect(best, v.meta.id).toBeLessThan(0.17);
      expect(far, `${v.meta.id}: displaced where no belly is`).toBeLessThan(1e-6);
      expect(at[0]).toBeLessThan(at[1]); expect(at[1]).toBeLessThan(at[2]);
      for (let i = 0; i < A.NO; i++) expect(bellyOffset(v.pos[i * 3], v.pos[i * 3 + 1], v.pos[i * 3 + 2], 0, F).dz).toBe(0); }
  });
  it('the clothes stay outside the body: every garment vertex ahead of the skin before is ahead of it after, at every month', () => {
    for (const dress of ['woman', 'persian'] as const) { const C = O.costumes[COSTUME_OF[dress]].find(c => c.lod === 0)!;
      for (const v of women()) { const F = bellyFrame(A, v); let moved = 0, worst = 0;
        // the body's front, binned by (x, y) at 1.5 cm, before and after
        const key = (x: number, y: number) => `${Math.round(x / 0.015)},${Math.round(y / 0.015)}`;
        for (const a of [0.3, 0.7, 1]) { const b0 = new Map<string, number>(), b1 = new Map<string, number>();
          for (let i = 0; i < A.NO; i++) { if (A.part[i] >= PART.eye) continue; const x = v.pos[i * 3], y = v.pos[i * 3 + 1], z = v.pos[i * 3 + 2]; if (z < F.z0 - 0.12) continue; const o = bellyOffset(x, y, z, a, F), k = key(x, y);
            b0.set(k, Math.max(b0.get(k) ?? -9, z)); b1.set(k, Math.max(b1.get(k) ?? -9, z + o.dz)); }
          for (let i = 0; i < C.tid.length; i++) { const m = C.hmat[i * 4]; if (m === MAT.skin || m === MAT.eye || m === MAT.lash || m === MAT.teeth || m === MAT.mouth) continue;
            const o4 = (v.index * O.NV + C.tid[i]) * 4, x = O.source[o4], y = O.source[o4 + 1], z = O.source[o4 + 2]; const k = key(x, y), z0 = b0.get(k), z1 = b1.get(k); if (z0 === undefined || z < z0 - 1e-4) continue;
            // (the skin under the cloth vertex: the cell's foremost skin before, moved by the belly at the cloth vertex's own x, y)
            const o = bellyOffset(x, y, z, a, F), under = z0 + bellyOffset(x, y, z0, a, F).dz; if (o.dz > 0) moved++; worst = Math.max(worst, under - (z + o.dz)); void z1; } }
        expect(moved, `${dress} on ${v.meta.id}: the clothes move with the belly`).toBeGreaterThan(50);
        expect(worst, `${dress} on ${v.meta.id}: the body comes through the clothes by`).toBeLessThan(1e-4); } }
  }, 120_000);
});

describe('who carries a child (D-292)', () => {
  let P: Population;
  beforeAll(() => { P = buildPop(1); }, 180_000);
  it('only the women who give birth, 3-6 % of women 15-44 visibly on the sampled days, the belly continuous with the months', () => {
    const r = bodyTrace(P, 1, sampleDays(1, 6), 3);
    expect(r.bellyNoBirth).toBe(0); expect(r.share).toBeGreaterThan(0.03); expect(r.share).toBeLessThan(0.06);
    let jumps = 0, n = 0, late = 0;
    for (let pid = 0; pid < P.persons.length; pid += 2) { const x = P.dueIn(pid, 0); if (x === null) continue; n++;
      for (let d = 1; d < REGNAL_DAYS; d++) { const g0 = P.gravid(pid, d - 1), g1 = P.gravid(pid, d); if (P.present(pid, d - 1) && P.present(pid, d) && g1 - g0 > 1 / 60 + 1e-9) jumps++; }
      if (x >= REGNAL_DAYS && P.gravid(pid, REGNAL_DAYS - 1) > 0.2) late++; }
    expect(n).toBeGreaterThan(200); expect(jumps, 'a belly that jumps from one day to the next').toBe(0);
    expect(late, 'women who give birth early in the next year are with child in the last months').toBeGreaterThan(10);
  }, 240_000);
});
