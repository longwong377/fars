// Human asset build (D-020): the generated MakeHuman-derived assets are complete, skinned to the shared skeleton with
// normalised weights, within LOD triangle budgets and small enough to commit. Rebuild: npx tsx tools/build_humans.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { HBONES, HPARENT, HB, PART } from '../src/people/humanFormat';
import type { HumanAssetsMeta } from '../src/people/humanFormat';

const DIR = 'public/generated/humans';
const meta: HumanAssetsMeta = JSON.parse(readFileSync(`${DIR}/humans.json`, 'utf8'));
const bin = readFileSync(`${DIR}/humans.bin`);
const view = (k: string) => { const l = meta.layout[k]; const n = l.count * l.itemSize; const b = bin.buffer.slice(bin.byteOffset + l.offset, bin.byteOffset + l.offset + n * ({ u8: 1, u16: 2, i16: 2, u32: 4, f32: 4 }[l.type]));
  return l.type === 'u8' ? new Uint8Array(b) : l.type === 'u16' ? new Uint16Array(b) : l.type === 'i16' ? new Int16Array(b) : l.type === 'u32' ? new Uint32Array(b) : new Float32Array(b); };

describe('human assets (MakeHuman CC0, D-020)', () => {
  it('uses the shared skeleton (≤ 64 bones, parents before children) and records CC0 sources', () => {
    expect(meta.bones).toEqual([...HBONES]); expect(meta.bones.length).toBeLessThanOrEqual(64);
    meta.parents.forEach((p, i) => { expect(p).toBeLessThan(i); expect(p === -1 ? null : HBONES[p]).toBe(HPARENT[HBONES[i]]); });
    for (const s of meta.source) { expect(s.licence).toMatch(/CC0/); expect(s.credit).toBe('MakeHuman team'); }
  });
  it('every vertex has ≤ 4 influences on valid bones, weights summing to 1 (bytes to 255)', () => {
    const si = view('skinIndex'), sw = view('skinWeight'); const n = meta.layout.skinIndex.count;
    expect(n).toBeGreaterThan(13000);
    for (let p = 0; p < n; p++) { let s = 0; for (let j = 0; j < 4; j++) { s += sw[p * 4 + j]; if (sw[p * 4 + j]) expect(si[p * 4 + j]).toBeLessThan(HBONES.length); } expect(s).toBe(255); }
    // face bones carry weight (the face can talk, blink and look)
    const used = new Set<number>(); for (let p = 0; p < n; p++) for (let j = 0; j < 4; j++) if (sw[p * 4 + j] > 20) used.add(si[p * 4 + j]);
    for (const b of ['jaw', 'eye_l', 'eye_r', 'lid_ul', 'lid_ur', 'head', 'hand_l', 'index_03_r', 'ball_l'] as const) expect(used.has(HB[b]), b).toBe(true);
  });
  it('LOD triangle budgets hold and every index is in range', () => {
    const budget: Record<string, number> = { lod0: 32000, lod1: 6000, lod2: 1500 };
    for (const l of meta.lods) {
      const idx = view(l.indexKey); expect(idx.length / 3).toBe(l.triangles); expect(l.triangles).toBeLessThanOrEqual(budget[l.indexKey]);
      let mx = 0; for (const i of idx) mx = Math.max(mx, i); expect(mx).toBeLessThan(meta.vertexCount);
    }
    console.log(`LOD triangles: ${meta.lods.map(l => `${l.name} ${l.triangles}`).join(', ')}; vertices ${meta.vertexCount}`);
  });
  it('body variants: adults, elders, children of both sexes, plausible statures and bind joints', () => {
    const groups = new Set(meta.variants.map(v => `${v.sex}:${v.group}`));
    for (const g of ['m:adult', 'm:elder', 'f:adult', 'f:elder', 'm:child', 'f:child']) expect(groups.has(g), g).toBe(true);
    const nPos = meta.layout.part.count;
    for (const v of meta.variants) {
      expect(v.joints.length).toBe(HBONES.length); expect(v.tier).toBe('C');
      const [lo, hi] = v.group === 'child' ? [1.0, 1.45] : v.sex === 'm' ? [1.45, 1.85] : [1.4, 1.75];
      expect(v.height).toBeGreaterThan(lo); expect(v.height).toBeLessThan(hi);
      expect(meta.layout[`pos_${v.id}`].count).toBe(nPos);
      // bind pose: head above the pelvis, arms hanging (wrist below the elbow below the shoulder), feet on the ground
      const J = (b: keyof typeof HB) => v.joints[HB[b]];
      expect(J('head')[1]).toBeGreaterThan(J('pelvis')[1]);
      for (const s of ['l', 'r'] as const) { expect(J(`hand_${s}`)[1]).toBeLessThan(J(`lowerarm_${s}`)[1]); expect(J(`lowerarm_${s}`)[1]).toBeLessThan(J(`upperarm_${s}`)[1]); expect(J(`foot_${s}`)[1]).toBeLessThan(0.15); }
      expect(Math.sign(J('upperarm_l')[0])).toBe(1); // the body's left is +X (facing +Z)
    }
  });
  it('part ids cover the body, eyes and mouth; generated assets stay small enough to commit (≤ 15 MB)', () => {
    const part = view('part'); const seen = new Set(part); for (const p of [PART.head, PART.chest, PART.hand_l, PART.foot_r, PART.eye, PART.teeth, PART.lash]) expect(seen.has(p)).toBe(true);
    const total = readdirSync(DIR).reduce((s, f) => s + statSync(`${DIR}/${f}`).size, 0);
    console.log(`public/generated/humans: ${(total / 1e6).toFixed(2)} MB`); expect(total).toBeLessThan(15e6);
  });
});
