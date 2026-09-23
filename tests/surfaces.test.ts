// Surfaces of the photoreal triage (D-157), measured in node: the statistics of the procedural functions of
// src/render/materials.ts on a CPU mirror of the shader noise (tests/lib/mx_noise_cpu.ts), the varied ashlar pattern,
// and the render-only bevels of src/arch/meshes.ts (closed, outward, only on free arrises, within the triangle budget;
// colliders and parts unchanged). Measurements, not screenshots.
import { describe, it, expect } from 'vitest';
import { mxNoise3, hash12, rng } from './lib/mx_noise_cpu';
import { SURFACES, TONE_OCTAVES, TONE_NORM, TONE_OFFSETS, MX_NOISE_SD, CHROMA_OCTAVES, CHROMA_NORM, PATCH } from '../src/render/materials';
import { bevelledBox, freeArrises, BOX_EDGES, BEVEL, buildMeshes } from '../src/arch/meshes';
import { buildTerrace } from '../src/arch/terrace';
import type { Box, Part } from '../src/arch/parts';
import { writeFileSync, mkdirSync } from 'node:fs';

const R = rng(20260923);
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const stats = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return { mean: m, sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) }; };
/** the albedo factor of materials.ts toneFactor() (luminance part; no band limit: near field) */
function tone(d: (typeof SURFACES)[string], x: number, y: number, z: number): number {
  const T = d.tone!; let t = 0;
  TONE_OCTAVES.forEach(([lam, w], i) => { const o = TONE_OFFSETS[i]; t += w * mxNoise3(x / lam + o[0], y / lam + o[1], z / lam + o[2]); });
  let f = 1 + t * T.sd * TONE_NORM;
  if (T.patch) { const n = mxNoise3(x / PATCH.lambda + PATCH.off[0], y / PATCH.lambda + PATCH.off[1], z / PATCH.lambda + PATCH.off[2]) + PATCH.wAmp * mxNoise3(x / PATCH.wobble + PATCH.off2[0], y / PATCH.wobble + PATCH.off2[1], z / PATCH.wobble + PATCH.off2[2]); f *= 1 + smoothstep(PATCH.lo, PATCH.hi, n) * T.patch; }
  return Math.max(0.2, f);
}
/** the old (session-4) mottling factor of layer(): three octaves at noiseScale × (0.18, 1.7, 9) */
const oldMott = (d: (typeof SURFACES)[string], x: number, y: number, z: number) => { const f = (s: number) => mxNoise3(x * d.noiseScale * s, y * d.noiseScale * s, z * d.noiseScale * s); return 1 + f(0.18) * d.noiseAmp * 0.6 + f(1.7) * d.noiseAmp * 0.25 + f(9) * d.noiseAmp * 0.12; };

describe('broad tone (D-157)', () => {
  it('the CPU mirror of mx_noise_float has the 1σ the tone is normalised by', () => {
    const v: number[] = []; for (let i = 0; i < 60000; i++) v.push(mxNoise3(R() * 400 - 200, R() * 400 - 200, R() * 400 - 200));
    const s = stats(v); expect(Math.abs(s.mean)).toBeLessThan(0.01); expect(s.sd).toBeCloseTo(MX_NOISE_SD, 2);
  });
  it('plaster and mud plaster vary by 8–12 % (1σ), stone by 6–8 %, the old mottling by 1–2 %; within a 4 × 5 m patch of wall at least ~2/3 of it', () => {
    const rows: string[] = [];
    for (const [k, lo, hi] of [['plaster', 0.08, 0.12], ['mudbrick', 0.08, 0.12], ['limestone', 0.06, 0.08], ['terrace', 0.06, 0.08], ['limestone_carved', 0.055, 0.08], ['plaster_red', 0.055, 0.1], ['court_fill', 0.06, 0.1]] as [string, number, number][]) {
      const d = SURFACES[k]; expect(d.tone, k).toBeTruthy();
      const all: number[] = [], old: number[] = []; for (let i = 0; i < 20000; i++) { const x = R() * 300, y = R() * 20, z = 0.37; all.push(tone(d, x, y, z)); old.push(oldMott(d, x, y, z)); }
      const S = stats(all), O = stats(old);
      // regional: the 1σ inside 4 m × 5 m windows of a wall (what a photograph of a wall at 10 m holds), averaged
      let reg = 0; const W = 40; for (let w = 0; w < W; w++) { const x0 = R() * 300, y0 = R() * 15, v: number[] = []; for (let i = 0; i < 400; i++) v.push(tone(d, x0 + R() * 4, y0 + R() * 5, 0.37)); reg += stats(v).sd / stats(v).mean / W; }
      rows.push(`${k}: tone 1σ ${(100 * S.sd).toFixed(1)} % (mean ${S.mean.toFixed(3)}), in 4×5 m windows ${(100 * reg).toFixed(1)} %; old mottling ${(100 * O.sd).toFixed(1)} %`);
      expect(S.sd, k).toBeGreaterThanOrEqual(lo); expect(S.sd, k).toBeLessThanOrEqual(hi);
      expect(Math.abs(S.mean - 1), `${k} mean`).toBeLessThan(0.02); // mean-preserving: the probe bake's albedo still holds
      expect(reg, `${k} regional`).toBeGreaterThan(0.6 * lo);
      expect(O.sd, `${k} old`).toBeLessThan(0.025);
    }
    mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/surfaces-tone.txt', rows.join('\n') + '\n');
  });
  it('the chroma shift is faint (1σ of red − blue ≈ 2 × chroma)', () => {
    const d = SURFACES.plaster, c: number[] = [];
    for (let i = 0; i < 20000; i++) { const x = R() * 300, y = R() * 20; let v = 0; for (const [lam, w, o] of CHROMA_OCTAVES) v += w * mxNoise3(x / lam + o[0], y / lam + o[1], 0.37 / lam + o[2]); c.push(v * d.tone!.chroma! * CHROMA_NORM); }
    expect(stats(c).sd).toBeCloseTo(d.tone!.chroma!, 2); expect(stats(c).sd).toBeLessThan(0.025);
  });
  it('repair patches cover ~10–30 % of a plastered wall', () => {
    let n = 0; const N = 20000;
    for (let i = 0; i < N; i++) { const x = R() * 300, y = R() * 20, z = 0.37; const v = mxNoise3(x / PATCH.lambda + PATCH.off[0], y / PATCH.lambda + PATCH.off[1], z / PATCH.lambda + PATCH.off[2]) + PATCH.wAmp * mxNoise3(x / PATCH.wobble + PATCH.off2[0], y / PATCH.wobble + PATCH.off2[1], z / PATCH.wobble + PATCH.off2[2]); if (v > (PATCH.lo + PATCH.hi) / 2) n++; }
    expect(n / N).toBeGreaterThan(0.1); expect(n / N).toBeLessThan(0.3);
  });
});

/** the varied ashlar cells of materials.ts ashlarCells() (CPU mirror) */
function cells(a: number, b: number, J: NonNullable<(typeof SURFACES)[string]['joints']>) {
  const V = J.vary!, H = J.course * 2, k = Math.floor(b / H), f = b - k * H;
  const split = hash12(k, 7.13) * (V.course[1] - V.course[0]) + V.course[0], c = 2 * k + (f >= split ? 1 : 0);
  const L = J.block, u = (a - hash12(c, 3.71) * L) / L, j0 = Math.floor(u);
  const u0 = j0 + (hash12(c, j0) - 0.5) * V.jitter * 0.5, u1 = j0 + 1 + (hash12(c, j0 + 1) - 0.5) * V.jitter * 0.5;
  const off = hash12(c, 3.71) * L;
  return { c, blk: j0 - 1 + (u >= u0 ? 1 : 0) + (u >= u1 ? 1 : 0), split, joints: [off + u0 * L, off + u1 * L] };
}
describe('ashlar (D-157)', () => {
  const J = SURFACES.limestone.joints!;
  it('course heights run 0.8–1.3 m and block lengths 1.15–3.45 m (the joint itself stays 0.8 mm, Q-071)', () => {
    expect(J.width).toBeLessThanOrEqual(0.001);
    const heights: number[] = [], lengths: number[] = [];
    for (let k = -20; k < 20; k++) { const s = hash12(k, 7.13) * (J.vary!.course[1] - J.vary!.course[0]) + J.vary!.course[0]; heights.push(s, 2 * J.course - s); }
    for (let c = -30; c < 30; c++) for (let j = -20; j < 20; j++) { const u0 = j + (hash12(c, j) - 0.5) * J.vary!.jitter * 0.5, u1 = j + 1 + (hash12(c, j + 1) - 0.5) * J.vary!.jitter * 0.5; lengths.push((u1 - u0) * J.block); }
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(0.8 - 1e-9); expect(Math.max(...heights)).toBeLessThanOrEqual(1.3 + 1e-9);
    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(1.15 - 1e-9); expect(Math.max(...lengths)).toBeLessThanOrEqual(3.45 + 1e-9);
    expect(stats(heights).sd).toBeGreaterThan(0.1); expect(stats(lengths).sd).toBeGreaterThan(0.4); // really varied
  });
  it('block indices change exactly at the joints; neighbouring blocks differ in tone by ~±13 % (1σ ~7.5 %)', () => {
    let changes = 0, atJoint = 0; const tones: number[] = [];
    for (let y = 0.4; y < 20; y += 1.7) {
      let prev = cells(0, y, J).blk;
      for (let a = 0.005; a < 60; a += 0.01) { const q = cells(a, y, J); if (q.blk !== prev) { changes++; if (q.joints.some(j => Math.abs(j - a) < 0.011)) atJoint++; } prev = q.blk; }
    }
    expect(changes).toBeGreaterThan(100); expect(atJoint / changes).toBeGreaterThan(0.95);
    for (let c = 0; c < 40; c++) for (let b = 0; b < 40; b++) tones.push(1 + (2 * hash12(b + 0.37, c + 11.3) - 1) * SURFACES.limestone.blockTone!);
    const s = stats(tones); expect(s.sd).toBeGreaterThan(0.06); expect(s.sd).toBeLessThan(0.09); expect(Math.abs(s.mean - 1)).toBeLessThan(0.02);
  });
  it('a joint and its worn arrises darken a pixel column by ~15–25 % at 10 m (960×540, 46°) and ~5–8 % at 30 m', () => {
    const px = (d: number) => (2 * Math.tan((23 * Math.PI) / 180) * d) / 540;
    const ink = J.width * J.dark + 2 * J.lip! * J.lipDark!; // m of full darkness per joint (box filter)
    const at10 = ink / px(10), at30 = ink / px(30);
    expect(at10).toBeGreaterThan(0.12); expect(at10).toBeLessThan(0.3); expect(at30).toBeGreaterThan(0.04); expect(at30).toBeLessThan(0.1);
  });
});

// ---- bevels ----------------------------------------------------------------------------------------------------------
function meshChecks(pos: number[], nrm: number[]) {
  // signed volume (divergence theorem), outward normals, closed (every undirected edge used twice)
  let vol = 0, inward = 0; const edges = new Map<string, number>(); const key = (i: number) => `${pos[i].toFixed(5)},${pos[i + 1].toFixed(5)},${pos[i + 2].toFixed(5)}`; // 10 µm
  for (let t = 0; t < pos.length; t += 9) {
    const [a, b, c] = [t, t + 3, t + 6].map(i => [pos[i], pos[i + 1], pos[i + 2]]);
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const fn = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    if (fn[0] * nrm[t] + fn[1] * nrm[t + 1] + fn[2] * nrm[t + 2] < 0) inward++;
    for (const [i, j] of [[t, t + 3], [t + 3, t + 6], [t + 6, t]]) { const k = [key(i), key(j)].sort().join('|'); edges.set(k, (edges.get(k) ?? 0) + 1); }
  }
  const open = [...edges.values()].filter(n => n !== 2).length;
  return { vol, inward, open };
}
describe('bevels (D-157)', () => {
  it('a fully chamfered box is closed, faces outward and loses exactly the 12 edge prisms (+ the corner overlaps)', () => {
    const h: [number, number, number] = [1, 0.5, 2], r = 0.05;
    for (const round of [false, true]) {
      const { pos, nrm } = bevelledBox(h, r, Array(12).fill(true), round), M = meshChecks(pos, nrm);
      expect(M.open).toBe(0); expect(M.inward).toBe(0);
      const full = 8 * h[0] * h[1] * h[2], edgesLen = 4 * 2 * (h[0] + h[1] + h[2]);
      const cut = (r * r / 2) * edgesLen; // each chamfer removes a right-triangle prism r × r / 2 per unit length
      expect(M.vol).toBeLessThan(full - cut * 0.97); expect(M.vol).toBeGreaterThan(full - cut * 1.03 - 1e-3);
      expect(pos.length / 9).toBeLessThanOrEqual(60);
      if (round) { // rounded arris: the strip's normals are its two faces' normals (a smooth roll), not the 45° chamfer
        let n45 = 0; for (let i = 0; i < nrm.length; i += 3) if (Math.abs(Math.abs(nrm[i]) - Math.SQRT1_2) < 1e-6 && Math.abs(Math.abs(nrm[i + 1]) - Math.SQRT1_2) < 1e-6 && Math.abs(nrm[i + 2]) < 1e-6) n45++;
        expect(n45).toBe(0);
      }
    }
  });
  it('a box with only some edges bevelled is still closed (mixed corners)', () => {
    for (let mask = 1; mask < 4096; mask += 97) {
      const edges = BOX_EDGES.map((_, k) => ((mask >> k) & 1) === 1), { pos, nrm } = bevelledBox([0.6, 1.2, 0.4], 0.03, edges, mask % 2 === 0), M = meshChecks(pos, nrm);
      expect(M.open, `mask ${mask}`).toBe(0); expect(M.inward, `mask ${mask}`).toBe(0);
    }
  });
  it('only free arrises: two abutting wall boxes keep their shared end sharp, a wall under a roof keeps its top edges sharp', () => {
    const wall = (c: [number, number], sx: number): Box => ({ type: 'box', building: 't', kind: 'wall', material: 'mudbrick', tier: 'C', src: 'RECON', c, size: [sx, 1], y0: 0, y1: 4 });
    const a = wall([0, 0], 4), b = wall([4, 0], 4), roof: Box = { ...wall([0, 0], 10), kind: 'roof', material: 'timber', size: [10, 3], y0: 4, y1: 4.5 };
    const parts: Part[] = [a, b];
    const index = { inside: (x: number, y: number, z: number, except: Part) => parts.some(p => p !== except && p.type === 'box' && Math.abs(x - p.c[0]) <= p.size[0] / 2 && Math.abs(-z - p.c[1]) <= p.size[1] / 2 && y >= p.y0 && y <= p.y1) };
    const fa = freeArrises(a, index);
    // a's +x end (x = 2) touches b: its vertical edges at +x (edges [0,4], [0,5]) and the top/bottom edges along z at +x are not free
    const k = (e: [number, number]) => BOX_EDGES.findIndex(q => q[0] === e[0] && q[1] === e[1]);
    expect(fa[k([0, 4])]).toBe(false); expect(fa[k([0, 5])]).toBe(false); expect(fa[k([0, 2])]).toBe(false);
    expect(fa[k([1, 4])]).toBe(true); expect(fa[k([1, 5])]).toBe(true); expect(fa[k([2, 4])]).toBe(true); // the free end and the free top arrises
    parts.push(roof);
    const fr = freeArrises(a, index); expect(fr[k([2, 4])]).toBe(false); expect(fr[k([2, 5])]).toBe(false); expect(fr[k([1, 2])]).toBe(false);
    expect(fr[k([1, 4])]).toBe(true); // the vertical arris at the free end stays bevelled
  });
  it('the whole Terrace: colliders and parts unchanged, the triangle cost within budget', () => {
    const t0 = performance.now(), { parts } = buildTerrace(), g = buildMeshes(parts), ms = performance.now() - t0;
    const B = g.bevel, boxes = parts.filter(p => p.type === 'box' && BEVEL[p.material]).length;
    const row = `bevels: ${B.bevelled} of ${B.edges} edges of ${boxes} bevelable boxes are free arrises; arch triangles ${B.trisFlat} → ${B.trisBevelled} (+${B.trisBevelled - B.trisFlat}); buildMeshes ${ms.toFixed(0)} ms`;
    mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/surfaces-bevels.txt', row + '\n');
    expect(B.bevelled).toBeGreaterThan(0.2 * B.edges); expect(B.bevelled).toBeLessThan(B.edges);
    // worst case, every part mesh drawn in the view and all four shadow cascades: well under 5 % of the 12 M budget
    expect(5 * (B.trisBevelled - B.trisFlat)).toBeLessThan(0.05 * 12e6);
    // every merged part mesh carries the part attributes the architecture materials read
    let meshes = 0; g.group.traverse((o: any) => { if (o.isMesh && !o.isInstancedMesh && o.geometry.getAttribute('pbox')) { meshes++; for (const a of ['y0', 'ytop']) expect(o.geometry.getAttribute(a).count).toBe(o.geometry.getAttribute('position').count); } });
    expect(meshes).toBeGreaterThan(20);
  });
});
