// D-225 (rubric s7 pass 2, fix 6): the Persian court robe's baked pleats, the slanted sleeves, the court beard's rows of
// curls, a woven (not felted) cloth that vanishes with distance, uneven dyes that keep their mean, soil at the hem's edge.
// Measured in node on the fitted geometry and on the CPU mirror of the material (tools/dev/human_cpu.ts).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeHumanAssets, type HumanAssets } from '../src/people/humanAssets';
import { buildOutfits, type OutfitBuild } from '../src/people/outfits';
import { lookFor } from '../src/people/looks';
import { MAT, PRM_ROBE } from '../src/people/humanFormat';
import { ROBE, SLEEVE, BEARD, robePleat } from '../src/people/drape';
import { surface, type Frag, type V3 } from '../tools/dev/human_cpu';

let A: HumanAssets, O: OutfitBuild;
beforeAll(() => {
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  O = buildOutfits(A, { dresses: ['persian', 'worker'] });
}, 120_000);
const pos = (key: string, vid: string, i: number): V3 => { const v = A.byId[vid], o = v.index * O.NV * 4 + (O.pieceBase[key] + i) * 4; return [O.source[o], O.source[o + 1], O.source[o + 2]]; };

describe('the Persian robe is draped, not a cone (D-225)', () => {
  /** the hem ring's radius about its centre, residual after the mean and three harmonics (the body's own ellipse) */
  function hemFolds(lod: number, vid: string) {
    const key = `robe_skirt@${lod}`, g = O.geos![key]; const hem: V3[] = []; for (let i = 0; i < g.n; i++) if (g.ao[i] !== 150 && g.uv[i * 2 + 1] > 0.999) hem.push(pos(key, vid, i));
    const cx = hem.reduce((a, p) => a + p[0], 0) / hem.length, cz = hem.reduce((a, p) => a + p[2], 0) / hem.length;
    const th = hem.map(p => Math.atan2(p[0] - cx, p[2] - cz)), r = hem.map(p => Math.hypot(p[0] - cx, p[2] - cz));
    const basis = (t: number) => [1, Math.cos(t), Math.sin(t), Math.cos(2 * t), Math.sin(2 * t), Math.cos(3 * t), Math.sin(3 * t)], M = 7;
    const N = Array.from({ length: M }, () => new Array(M + 1).fill(0)); th.forEach((t, i) => { const f = basis(t); for (let a = 0; a < M; a++) { N[a][M] += f[a] * r[i]; for (let c = 0; c < M; c++) N[a][c] += f[a] * f[c]; } });
    for (let a = 0; a < M; a++) for (let q = 0; q < M; q++) if (q !== a) { const f = N[q][a] / N[a][a]; for (let c = 0; c <= M; c++) N[q][c] -= f * N[a][c]; }
    const res = r.map((x, i) => x - basis(th[i]).reduce((s, f, a) => s + (f * N[a][M]) / N[a][a], 0));
    const o = th.map((t, i) => [t, res[i]]).sort((a, b) => a[0] - b[0]); let crests = 0;
    for (let i = 0; i < o.length; i++) { const a = o[(i + o.length - 1) % o.length][1], m = o[i][1], c = o[(i + 1) % o.length][1]; if (m > a && m > c && m - Math.min(a, c) > 0.003) crests++; }
    return { rms: Math.sqrt(res.reduce((a, x) => a + x * x, 0) / res.length), crests };
  }
  it('the hem carries the folds: ≥ 10 mm rms beyond the body\'s ellipse and ≥ 12 crests at full detail, ≥ 8 mm and ≥ 6 at mid detail (the D-206 tube: 6.7 mm / 11, 5.7 mm / 4)', () => {
    for (const vid of ['m03', 'm05', 'm09']) {
      const f0 = hemFolds(0, vid), f1 = hemFolds(1, vid);
      expect(f0.rms, vid).toBeGreaterThan(0.01); expect(f0.crests, vid).toBeGreaterThanOrEqual(12);
      expect(f1.rms, vid).toBeGreaterThan(0.008); expect(f1.crests, vid).toBeGreaterThanOrEqual(6);
    }
  });
  it('the front pleat stack stands forward, the side folds run diagonally back toward the hem, the class is the robe\'s', () => {
    expect(robePleat(0, 0.5, 0) - robePleat(0.7, 0.5, 0)).toBeGreaterThan(0.003); // (mean over the side folds' phase is ~0)
    // a side fold's crest moves back (larger |θ|) going down: the crest's angle at the hem exceeds the one at mid-skirt
    const crest = (t: number, a0: number) => { let best = -1, a = a0; for (let x = a0 - 0.12; x < a0 + 0.12; x += 0.001) { const v = robePleat(x, t, 0); if (v > best) { best = v; a = x; } } return a; };
    const c5 = crest(0.5, 1.2), c6 = crest(0.6, c5), c7 = crest(0.7, c6);
    expect(c6 - c5).toBeCloseTo(0.1 * ROBE.sideTwist, 1); expect(c7 - c6).toBeCloseTo(0.1 * ROBE.sideTwist, 1);
    const g = O.geos!['robe_skirt@0']; expect(g.prm[0]).toBe(PRM_ROBE); for (let i = 0; i < g.n; i++) { expect(g.uv[i * 2]).toBeGreaterThanOrEqual(-0.5); expect(g.uv[i * 2]).toBeLessThanOrEqual(0.5); }
  });
  it('the coarser lining stays inside the pleated outer layer (no trough cut through)', () => {
    for (const lod of [0, 1]) { const key = `robe_skirt@${lod}`, g = O.geos![key], S = ROBE.segs[lod], R = ROBE.rings[lod], nRing = S * (R + 1);
      let bad = 0; for (let kk = 0; kk <= R / 2; kk++) for (let j = 0; j < S; j++) { const lin = pos(key, 'm05', nRing + kk * S + j);
        // the outer ring at the lining's height (the same column) and the axis between front and back of that ring
        const k = kk * 2, o = pos(key, 'm05', k * S + j), front = pos(key, 'm05', k * S), back = pos(key, 'm05', k * S + S / 2), cz = (front[2] + back[2]) / 2;
        if (Math.hypot(lin[0], lin[2] - cz) > Math.hypot(o[0], o[2] - cz) - 0.001) bad++; }
      expect(bad, `LOD ${lod}`).toBe(0); }
  });
  it('the sleeve\'s opening is cut on the slant: shorter on the front of the forearm than behind', () => {
    const key = 'robe_sleeves@0', S = SLEEVE.segs[0], R = SLEEVE.rings[0]; // left sleeve first: outer rings, column 0 = the front
    const shoulder = pos(key, 'm03', 0), front = pos(key, 'm03', R * S), back = pos(key, 'm03', R * S + S / 2);
    const len = (p: V3) => Math.hypot(p[0] - shoulder[0], p[1] - shoulder[1], p[2] - shoulder[2]);
    expect(len(back) - len(front)).toBeGreaterThan(0.05);
  });
});

describe('the court beard in rows of curls (D-225)', () => {
  it('the long beard\'s mass carries BEARD.rows rolls in its spare byte at full detail (a plain mass at mid detail)', () => {
    const g = O.geos!['beard_long@0']; const rows = new Map<number, number>();
    for (let i = 0; i < g.n; i++) if (g.prm[i] === 3 && Math.abs(g.uv[i * 2] - 0.5) < 0.01) { const k = Math.round(g.uv[i * 2 + 1] * 1000); rows.set(k, Math.max(rows.get(k) ?? 0, g.aux[i] / 255)); }
    const prof = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]); let peaks = 0; for (let i = 1; i + 1 < prof.length; i++) if (prof[i] > prof[i - 1] && prof[i] >= prof[i + 1] && prof[i] > 0.8) peaks++;
    expect(peaks).toBeGreaterThanOrEqual(BEARD.rows - 1); expect(Math.min(...prof)).toBeLessThan(0.2);
    const g1 = O.geos!['beard_long@1']; for (let i = 0; i < g1.n; i++) if (g1.prm[i] === 3) expect(Math.abs(g1.aux[i] / 255 - 0.6)).toBeLessThan(0.01);
  });
});

describe('cloth that reads as woven, dyes that are uneven (D-225, CPU mirror)', () => {
  const L = () => lookFor(A, { id: 1, sex: 'm', role: 'official', dress: 'persian', seed: 11 }, 1);
  const frag = (look: ReturnType<typeof L>, P: V3, uv: [number, number]): Frag => ({ color: [...look.col.main] as V3, hair: [...look.col.trim] as V3, mat: [MAT.cloth_main, PRM_ROBE, look.pattern, 0], bind: P, aux: [0.9, 1, 0, 0.3], ext: [0, 1, 0, 0], wear: [0, 0, 1.3, 0], uv, posV: [0, 0, -1], nrmV: [0, 0, 1] });
  /** rms (m) of the cloth's height field above 300 cycles/m along a line on the skirt, at a pixel footprint fw */
  function fine(fw: number) { const look = L(), N = 512, step = 0.00025, h: number[] = [];
    for (let i = 0; i < N; i++) h.push(surface(frag(look, [0.1 + i * step * 0.37, 0.5 + i * step, 0.16], [0.2, 0.6]), fw, [0, 0, 1], 0, null).h);
    const m = h.reduce((a, x) => a + x, 0) / N; let p = 0;
    for (let k = Math.ceil(300 * N * step); k < N / 2; k++) { let re = 0, im = 0; for (let i = 0; i < N; i++) { const w = (h[i] - m) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))); re += w * Math.cos((2 * Math.PI * k * i) / N); im -= w * Math.sin((2 * Math.PI * k * i) / N); } p += (2 * (re * re + im * im)) / (N * N * 0.375); }
    return Math.sqrt(p); }
  it('the weave is there at arm\'s length and gone by 3 m (band-limited: no shimmer)', () => {
    const near = fine(0.3 * 0.001), far = fine(3 * 0.001);
    expect(near).toBeGreaterThan(10e-6); expect(far).toBeLessThan(1e-6);
  });
  it('one garment\'s colour varies (saturation sd ≥ 0.01 up close) and keeps its mean (ΔE < 1.5 from the look colour at a distance)', () => {
    const look = L(), sats: number[] = [], far = [0, 0, 0]; const srgb = (x: number) => (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055);
    const sat = (c: number[]) => { const s = c.map(srgb), mx = Math.max(...s), mn = Math.min(...s); return (mx - mn) / mx; };
    let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 1500; i++) { const P: V3 = [(rnd() - 0.5) * 0.4, 0.3 + rnd() * 0.8, 0.16], uv: [number, number] = [0.2, 0.3];
      sats.push(sat(surface(frag(look, P, uv), 0.0004, [0, 0, 1], 0, null).alb)); const a = surface(frag(look, P, uv), 0.05, [0, 0, 1], 0, null).alb; for (let q = 0; q < 3; q++) far[q] += a[q] / 1500; }
    const m = sats.reduce((a, x) => a + x, 0) / sats.length, sd = Math.sqrt(sats.reduce((a, x) => a + (x - m) ** 2, 0) / sats.length);
    expect(sd).toBeGreaterThan(0.01);
    const lab = (c: number[]) => { const X = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047, Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], Z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883; const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]; };
    const p = lab(far), q = lab(look.col.main); expect(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])).toBeLessThan(1.5);
  });
});
