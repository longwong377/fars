// People's look (D-189): the natural-dye palette (desaturated, value-varied by dye strength, garment age and a jitter;
// rank kept), wear (sun-bleaching, hem soil), the skirts' hem folds and fit, joint wrinkles, micro-shadowing, and the
// impostors' colours matched to what the skinned material shows on average. Measured, not eyeballed; the numbers go to
// bench-reports/people-look.json.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decodeHumanAssets, meshoptSimplify, type HumanAssets } from '../src/people/humanAssets';
import { buildOutfits, unpackNormal, COSTUME_OF, type OutfitBuild } from '../src/people/outfits';
import { bakeImpostors, farLod, typicalMask, farColours, IMP_DRESSES, unpackRGB, CrowdImpostors, type ImpostorAtlas } from '../src/people/impostors';
import { lookFor, DYES, dyeColour, wearTexel, type PersonLook } from '../src/people/looks';
import { MAT } from '../src/people/humanFormat';
import { DRAPE, HAIR } from '../src/people/humanMaterial';
import { surface, shade, skirtFold, type Frag, type V3 } from '../tools/dev/human_cpu';
import type { Dress } from '../src/people/outfits';

let A: HumanAssets, O: OutfitBuild, atlas: ImpostorAtlas;
const NOTES: Record<string, unknown> = {};
const note = (k: string, v: unknown) => { NOTES[k] = v; mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/people-look.json', JSON.stringify(NOTES, null, 1)); };
beforeAll(async () => {
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
  O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) }); atlas = bakeImpostors(A, O);
}, 300_000);

const srgb = (x: number) => (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055);
const sat = (c: number[]) => { const s = c.map(srgb), mx = Math.max(...s), mn = Math.min(...s); return mx > 0 ? (mx - mn) / mx : 0; };
const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
/** linear RGB → CIELAB (D65) */
function lab(c: number[]): [number, number, number] {
  const X = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047, Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], Z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const dE = (a: number[], b: number[]) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
/** the court's mix (court-assembly: Persian-dress courtiers and guards, Median dress, servants in working dress) */
const COURT: { dress: Dress; role: string; sex: 'm' | 'f'; n: number }[] = [{ dress: 'persian', role: 'official', sex: 'm', n: 160 }, { dress: 'guard', role: 'guard', sex: 'm', n: 120 }, { dress: 'median', role: 'official', sex: 'm', n: 80 }, { dress: 'worker', role: 'porter', sex: 'm', n: 60 }];
const looksOf = (dress: Dress, role: string, sex: 'm' | 'f', n: number, seed0: number) => Array.from({ length: n }, (_, i) => lookFor(A, { id: i, sex, role, dress, seed: seed0 + i }, 1));

describe('the palette (D-189): natural dyes, desaturated, value-varied, rank kept', () => {
  it('no garment is a saturated primary: sRGB saturation p50 ≤ 0.62, p90 ≤ 0.72, max ≤ 0.8 over the court\'s main garments', () => {
    const S: number[] = [], byKey: Record<string, number[]> = {};
    for (const g of COURT) for (const L of looksOf(g.dress, g.role, g.sex, g.n, 20000)) { S.push(sat(L.col.main)); }
    // the first palette (D-092): the same textiles as flat constants
    const OLD: Record<string, number[]> = { madder: [0.55, 0.15, 0.1], woad: [0.17, 0.22, 0.42], weld: [0.74, 0.6, 0.24], purple: [0.36, 0.13, 0.28] };
    for (const [k, c] of Object.entries(OLD)) { const s = c.map(x => x), mx = Math.max(...s); byKey[k] = [(mx - Math.min(...s)) / mx, sat(dyeColour(k, 1, 0))]; }
    note('palette_saturation', { p50: pct(S, 0.5), p90: pct(S, 0.9), max: Math.max(...S), oldVsStrongest: byKey });
    expect(pct(S, 0.5)).toBeLessThanOrEqual(0.62); expect(pct(S, 0.9)).toBeLessThanOrEqual(0.72); expect(Math.max(...S)).toBeLessThanOrEqual(0.8);
    for (const k of Object.keys(DYES)) expect(sat(dyeColour(k, 1, 0)), k).toBeLessThan(0.8);
  });
  it('no clones: people in one dye differ (median pairwise ΔE ≥ 4 among the court\'s madder robes; luminance sd ≥ 8 %)', () => {
    const red = looksOf('persian', 'official', 'm', 400, 30000).filter(L => L.note.includes('main madder'));
    expect(red.length).toBeGreaterThan(60);
    const d: number[] = []; for (let i = 0; i < red.length; i++) for (let j = i + 1; j < Math.min(red.length, i + 20); j++) d.push(dE(red[i].col.main, red[j].col.main));
    const Ls = red.map(L => lum(L.col.main)), m = Ls.reduce((a, b) => a + b) / Ls.length, sd = Math.sqrt(Ls.reduce((a, b) => a + (b - m) ** 2, 0) / Ls.length);
    note('madder_variety', { n: red.length, medianDeltaE: pct(d, 0.5), lumMean: m, lumSdRel: sd / m });
    expect(pct(d, 0.5)).toBeGreaterThanOrEqual(4); expect(sd / m).toBeGreaterThanOrEqual(0.08);
  });
  it('rank shows: court dress wears stronger, newer dyes than working dress; everyone has hem soil, workers more', () => {
    const chroma = (Ls: PersonLook[]) => Ls.map(L => { const q = lab(L.col.main); return Math.hypot(q[1], q[2]); }).reduce((a, b) => a + b) / Ls.length;
    const court = looksOf('persian', 'official', 'm', 200, 40000), work = looksOf('worker', 'mason', 'm', 200, 41000), women = looksOf('woman', 'grinder', 'f', 200, 42000);
    const soil = (Ls: PersonLook[]) => Ls.reduce((a, L) => a + L.wear.soil, 0) / Ls.length;
    note('rank', { chromaCourt: chroma(court), chromaWork: chroma(work), chromaWomen: chroma(women), soilCourt: soil(court), soilWork: soil(work), fadeCourt: court.reduce((a, L) => a + L.wear.fade, 0) / 200, fadeWork: work.reduce((a, L) => a + L.wear.fade, 0) / 200 });
    expect(chroma(court)).toBeGreaterThan(chroma(work) * 2);
    for (const Ls of [court, work, women]) for (const L of Ls) expect(L.wear.soil).toBeGreaterThanOrEqual(0.12);
    expect(soil(work)).toBeGreaterThan(soil(court) * 1.5);
  });
  it('fluted hats differ in height per person (±12 %, within 2 cm) and the costume\'s hat is the tube the material scales', () => {
    const hats = looksOf('persian', 'official', 'm', 200, 45000).map(L => L.wear.hat);
    expect(Math.min(...hats)).toBeGreaterThanOrEqual(-0.12); expect(Math.max(...hats)).toBeLessThanOrEqual(0.12);
    const sd = Math.sqrt(hats.reduce((a, h) => a + h * h, 0) / hats.length); expect(sd * DRAPE.hatH).toBeGreaterThan(0.008);
    const C = O.costumes.persian[0]; let n = 0; for (let i = 0; i < C.tid.length; i++) if (C.hmat[i * 4] === MAT.felt && C.hmat[i * 4 + 3] === 1) { n++; expect(C.uv[i * 2 + 1]).toBeGreaterThanOrEqual(0); expect(C.uv[i * 2 + 1]).toBeLessThanOrEqual(1); }
    expect(n).toBeGreaterThan(100);
  });
  it('a look is deterministic, and the wear texel round-trips (fold amplitude in mm, phase kept off the integer edges)', () => {
    for (let s = 0; s < 50; s++) { const a = lookFor(A, { id: s, sex: 'm', role: 'official', dress: 'persian', seed: 500 + s }, 1), b = lookFor(A, { id: s, sex: 'm', role: 'official', dress: 'persian', seed: 500 + s }, 1);
      expect(a.col).toEqual(b.col); expect(a.wear).toEqual(b.wear);
      const w = wearTexel(a.wear); expect(Math.floor(w[2]) / 1000).toBeCloseTo(a.wear.foldAmp, 3); expect(w[2] - Math.floor(w[2])).toBeGreaterThanOrEqual(0.0199); expect(w[2] - Math.floor(w[2])).toBeLessThanOrEqual(0.9801); }
  });
});

describe('cloth and faces in the material (D-189; the CPU mirror, tools/dev/human_cpu.ts)', () => {
  const frag = (m: number, o: Partial<Frag> = {}): Frag => ({ color: [0.3, 0.05, 0.03], hair: [0.02, 0.015, 0.01], mat: [m, 0, 0, 0], bind: [0.05, 1.2, 0.12], aux: [1, 0, 0, 0.5], ext: [0, 1, 0, 0], wear: [0, 0, 0, 0], uv: [0.5, 0.5], posV: [0, 0, -3], nrmV: [0, 0, 1], ...o });
  it('the skirt\'s hem: folds differ per person, troughs never cut in more than 2 cm (legs), the fold field reaches ≥ 1.5 cm', () => {
    const hemR: number[][] = []; let minD = 1, maxSpan = 0;
    for (const L of looksOf('persian', 'official', 'm', 60, 50000)) { const w = wearTexel(L.wear), row: number[] = [];
      for (let j = 0; j < 72; j++) { const th = (j / 72) * 2 * Math.PI - Math.PI, d = skirtFold(1, th, w[2], w[1], 5); row.push(d); minD = Math.min(minD, d); }
      hemR.push(row); maxSpan = Math.max(maxSpan, Math.max(...row) - Math.min(...row)); }
    // people differ: the rms difference of two people's hem profiles
    let rms = 0, n = 0; for (let i = 1; i < hemR.length; i++) { let s = 0; for (let j = 0; j < 72; j++) s += (hemR[i][j] - hemR[i - 1][j]) ** 2; rms += Math.sqrt(s / 72); n++; }
    note('skirt_hem', { minDisplacementM: minD, maxSpanM: maxSpan, meanRmsBetweenPeopleM: rms / n });
    expect(minD).toBeGreaterThan(-0.02); expect(maxSpan).toBeGreaterThan(0.015); expect(rms / n).toBeGreaterThan(0.008);
    // beyond the near range the high orders are gone (the mid and far bodies' tubes cannot carry them)
    const w = wearTexel(looksOf('persian', 'official', 'm', 1, 50000)[0].wear);
    const order = (k: number, camD: number) => { let c = 0, s = 0; for (let j = 0; j < 360; j++) { const th = (j / 360) * 2 * Math.PI, d = skirtFold(1, th, w[2], 0, camD); c += d * Math.cos(k * th); s += d * Math.sin(k * th); } return Math.hypot(c, s) / 180; };
    expect(order(DRAPE.foldHigh[0], 5)).toBeGreaterThan(0.004); expect(order(DRAPE.foldHigh[0], 30)).toBeLessThan(1e-6);
  });
  it('sun-bleaching lightens and greys up-facing cloth of an old garment in a fugitive dye, not the underside or a new one', () => {
    const f = (nY: number, age: number, k: number) => surface(frag(MAT.cloth_main, { ext: [0, 1, nY, k], wear: [age, 0, 12.5, 0] }), 0.05, [0, 0, 1], 0, null).alb;
    const up = f(1, 0.7, DYES.weld.fade), down = f(-1, 0.7, DYES.weld.fade), fresh = f(1, 0, DYES.weld.fade);
    expect(lum(up)).toBeGreaterThan(lum(down) * 1.1); expect(sat(up)).toBeLessThan(sat(down)); expect(Math.abs(lum(fresh) - lum(down))).toBeLessThan(0.01 * lum(down) + 1e-4);
  });
  it('hem soil darkens and dulls the hem, not the chest; micro-shadows darken a cavity in direct light', () => {
    const at = (y: number, soil: number) => surface(frag(MAT.cloth_main, { color: [0.4, 0.08, 0.05], bind: [0.1, y, 0.1], wear: [0, 0, 12.5, soil] }), 0.05, [0, 0, 1], 0, null).alb;
    const hem = at(0.05, 0.5), chest = at(1.3, 0.5), clean = at(0.05, 0);
    expect(dE(hem, clean)).toBeGreaterThan(8); expect(dE(chest, at(1.3, 0))).toBeLessThan(1);
    const env = { upV: [0, 1, 0] as V3, lights: [{ dirV: [0, 0.5, 0.866] as V3, color: [3, 3, 3] as V3, shadow: 1 }], irradiance: () => [0.2, 0.2, 0.2] as V3 };
    const lit = (ao: number) => lum(shade(surface(frag(MAT.skin, { aux: [ao, 0, 0, 0.5], color: [0.3, 0.2, 0.15] }), 0.05, [0, 0, 1], 0, null), [0, 0.87, 0.5] as V3, [0, 0, 1], env));
    note('micro_shadow', { open: lit(1), cavity05: lit(0.5), cavity07: lit(0.7) });
    expect(lit(0.5)).toBeLessThan(lit(1) * 0.8); expect(lit(0.95)).toBeGreaterThan(lit(1) * 0.97);
  });
  it('hair and beards carry a visible strand highlight (Kajiya–Kay primary ≥ 2× the D-155 value)', () => { expect(HAIR.kk[0]).toBeGreaterThanOrEqual(0.08); expect(DRAPE.micro).toBeGreaterThan(0); });
});

describe('impostors match the skinned material at the switch (D-189)', () => {
  /** area-weighted mean albedo of a look's main garment on its far body (CPU mirror of the material, far fragments) */
  function skinnedMain(L: PersonLook) {
    const C = farLod(O, L.dress)!, base = L.variant * O.NV * 4, mask = typicalMask(L.dress), w = wearTexel(L.wear); const acc = [0, 0, 0]; let tot = 0;
    const vf = (i: number): Frag => { const t = base + C.tid[i] * 4; return { color: [...L.col.main] as V3, hair: [...L.col.trim] as V3, mat: [C.hmat[i * 4], C.hmat[i * 4 + 3], L.pattern, L.grime],
      bind: [O.source[t], O.source[t + 1], O.source[t + 2]], aux: [C.hext[i * 4] / 255, C.hext[i * 4 + 2] / 255, 0, L.grimeLevel], ext: [C.hext[i * 4 + 1] / 255, C.hext[i * 4 + 3] / 255, unpackNormal(O.source[t + 3])[1], L.wear.k[0]],
      wear: [w[0], 0, w[2], w[3]], uv: [C.uv[i * 2], C.uv[i * 2 + 1]], posV: [0, 0, -120], nrmV: [0, 0, 1] }; };
    let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const lerpF = (F: Frag[], w0: number, w1: number): Frag => { const w2 = 1 - w0 - w1, o = vf(0); for (const key of ['color', 'hair', 'bind', 'aux', 'ext', 'wear', 'uv', 'posV', 'nrmV'] as const) { const t = o[key] as number[]; for (let q = 0; q < t.length; q++) t[q] = (F[0][key] as number[])[q] * w0 + (F[1][key] as number[])[q] * w1 + (F[2][key] as number[])[q] * w2; } o.mat = F[0].mat; o.wear![2] = F[0].wear![2]; return o; };
    for (let k = 0; k < C.index.length; k += 3) { const a = C.index[k], b = C.index[k + 1], c = C.index[k + 2];
      if (C.hmat[a * 4] !== MAT.cloth_main || C.hmat[a * 4 + 1] !== 2 || !((mask >> C.hmat[a * 4 + 2]) & 1)) continue;
      const P = [a, b, c].map(i => { const t = base + C.tid[i] * 4; return [O.source[t], O.source[t + 1], O.source[t + 2]]; });
      const e1 = P[1].map((x, q) => x - P[0][q]), e2 = P[2].map((x, q) => x - P[0][q]), area = 0.5 * Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]);
      // samples spread over the triangle (the rosettes are finer than the far body's vertex spacing)
      const F = [vf(a), vf(b), vf(c)], ns = Math.max(4, Math.ceil(area * 4000));
      for (let j = 0; j < ns; j++) { let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; } const s = surface(lerpF(F, u, v), 0.1, [0, 0, 1], 0, null); for (let q = 0; q < 3; q++) acc[q] += s.alb[q] * area / ns; tot += area / ns; } }
    return acc.map(x => x / tot);
  }
  it('an impostor\'s main colour is the far body\'s mean albedo within ΔE 3 (the raw look colour was up to ΔE ≫ 3 off)', () => {
    const rows: string[] = []; let worstNew = 0, worstOld = 0; const all: number[] = [], allOld: number[] = [];
    const cases: { dress: Dress; role: string; sex: 'm' | 'f' }[] = [{ dress: 'persian', role: 'official', sex: 'm' }, { dress: 'guard', role: 'guard', sex: 'm' }, { dress: 'median', role: 'official', sex: 'm' }, { dress: 'worker', role: 'mason', sex: 'm' }, { dress: 'worker', role: 'baker', sex: 'm' }, { dress: 'woman', role: 'grinder', sex: 'f' }, { dress: 'child', role: 'child', sex: 'm' }];
    const imp = new CrowdImpostors(atlas, 16);
    for (const c of cases) for (const L of looksOf(c.dress, c.role, c.sex, 6, 60000 + c.dress.length * 100 + c.role.length)) {
      if (!IMP_DRESSES.includes(L.dress) || !O.costumes[COSTUME_OF[L.dress]]) continue;
      const ref = skinnedMain(L), packed = unpackRGB(imp.packLook(L)[0]), far = farColours(L, atlas.cloth[L.dress])[0];
      const dNew = dE(ref, packed), dOld = dE(ref, L.col.main); worstNew = Math.max(worstNew, dNew); worstOld = Math.max(worstOld, dOld); all.push(dNew); allOld.push(dOld);
      rows.push(`${c.dress}/${c.role}: skinned mean ${ref.map(srgb).map(x => x.toFixed(3)).join(',')} vs impostor ${packed.map(srgb).map(x => x.toFixed(3)).join(',')} ΔE ${dNew.toFixed(2)} (raw look colour ΔE ${dOld.toFixed(2)}; unpacked far ${dE(far, packed).toFixed(2)})`);
    }
    note('impostor_match', { worstDeltaE: worstNew, meanDeltaE: all.reduce((a, b) => a + b) / all.length, worstDeltaERawColour: worstOld, meanDeltaERawColour: allOld.reduce((a, b) => a + b) / allOld.length, rows });
    // (the residual is the material's own low-frequency albedo noise, ±5 % in 11 cm patches, fixed to the bind position,
    // which a robe does not average away and an impostor cannot carry)
    expect(worstNew).toBeLessThan(3);
  }, 120_000);
});
