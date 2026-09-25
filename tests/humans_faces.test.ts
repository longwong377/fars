// People up close (D-155): measured properties of faces, eyes, lashes, hair, cloth and looks, so the close-up fixes
// are held by numbers, not screenshots. The material's formulas are evaluated with its CPU mirror
// (tools/dev/human_cpu.ts: the same constants imported from the material, the same MaterialX noise); geometry from the
// fitted costumes; looks from lookFor.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeHumanAssets, type HumanAssets } from '../src/people/humanAssets';
import { HB, PART, MAT, EYE_UNIT, SKIN_CURV_MAX, packLookBits, unpackLookBits, LOOK_BITS } from '../src/people/humanFormat';
import { buildOutfits, bodyExtras, unpackNormal, type OutfitBuild } from '../src/people/outfits';
import { lookFor, ORIGIN_TONE } from '../src/people/looks';
import { SKIN, EYE, SAG_MAX } from '../src/people/humanMaterial';
import { RigSolver, PALETTE_STRIDE, skinPoint } from '../src/people/humanRig';
import { pose } from '../src/people/anim';
import { surface, makeTex, type Frag, type Tex } from '../tools/dev/human_cpu';
import { decodePNG } from '../tools/humans/png';

let A: HumanAssets, O: OutfitBuild, skin: Tex;
beforeAll(() => {
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  O = buildOutfits(A);
  const png = decodePNG(readFileSync('public/generated/humans/skin.png')); skin = makeTex(png.width, png.height, png.data);
}, 60_000);
const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
/** a fragment of class `m` (defaults: neutral person, look bits `pat`) */
const frag = (m: number, o: Partial<Frag> = {}): Frag => ({ color: [0.3, 0.2, 0.15], hair: [0.02, 0.015, 0.01], mat: [m, 0, 0, 0], bind: [0.03, 1.55, 0.12], aux: [1, 0, 0, 0.5], ext: [0.5, 0.5], uv: [0.5, 0.5], posV: [0, 0, -1], nrmV: [0, 0, 1], ...o });
const eyeAt = (exMM: number, eyMM: number, pat = 0) => frag(MAT.eye, { ext: [0.5 + exMM / 1000 / (2 * EYE_UNIT), 0.5 + eyMM / 1000 / (2 * EYE_UNIT)], mat: [MAT.eye, 0, pat, 0] });

describe('eyes (D-155)', () => {
  it('the sclera is a white tissue, the iris dark with a darker limbal ring, the pupil black', () => {
    const at = (ex: number, ey: number) => lum(surface(eyeAt(ex, ey, packLookBits({ motif: 0, hairStyle: 0, iris: 2, wearsHair: 0, linen: 0, age: 3, beard: 0, grimeZone: 0 })), 0.001, [0, 0, 1], 0, null).alb);
    const sclera = [at(8.5, -3), at(-8.5, -3), at(7, -4.5)];
    for (const s of sclera) expect(s, 'sclera albedo (linear); the old shader gave 0.30').toBeGreaterThan(0.5);
    const mid = at(0, -3.5), limbus = at(0, -5.5), pupil = at(0, -0.3);
    expect(mid).toBeGreaterThan(0.012); expect(mid).toBeLessThan(0.15);
    expect(limbus).toBeLessThan(mid);
    expect(pupil).toBeLessThan(0.01);
    expect(lum(EYE.sclera)).toBeGreaterThan(0.55);
  });
  it('eye vertices carry planar coordinates about the eye axis and analytic eyeball/cornea normals', () => {
    const v = A.byId.m03, E = bodyExtras({ A, ref: v, J: (b: string) => [v.joints[(HB as any)[b] * 3], v.joints[(HB as any)[b] * 3 + 1], v.joints[(HB as any)[b] * 3 + 2]] } as any);
    const c = [v.joints[HB.eye_l * 3], v.joints[HB.eye_l * 3 + 1], v.joints[HB.eye_l * 3 + 2]]; let worstCornea = 0, worstSclera = 0, n = 0;
    for (let i = 0; i < A.NO; i++) {
      if (A.part[i] !== PART.eye || v.pos[i * 3] < 0 || (A.uv[i * 2] > 0.85 && A.uv[i * 2 + 1] < 0.16)) continue;
      const dx = v.pos[i * 3] - c[0], dy = v.pos[i * 3 + 1] - c[1], dz = v.pos[i * 3 + 2] - c[2];
      expect(Math.abs((E.hy[i] / 255 - 0.5) * 2 * EYE_UNIT - Math.max(-EYE_UNIT, Math.min(EYE_UNIT, dx)))).toBeLessThan(1e-4);
      const nr = [v.nrm[i * 3], v.nrm[i * 3 + 1], v.nrm[i * 3 + 2]], r = Math.hypot(dx, dy);
      if (dz > 0 && r < 0.004) worstCornea = Math.max(worstCornea, Math.acos(Math.min(1, nr[2])));
      if (dz > 0 && r > 0.0075) { const l = Math.hypot(dx, dy, dz); worstSclera = Math.max(worstSclera, Math.acos(Math.min(1, (nr[0] * dx + nr[1] * dy + nr[2] * dz) / l))); n++; }
    }
    expect(n).toBeGreaterThan(50);
    expect(worstCornea * 180 / Math.PI, 'cornea normals within the 7.8 mm sphere').toBeLessThan(32);
    expect(worstSclera * 180 / Math.PI, 'sclera normals radial').toBeLessThan(0.5);
  });
});

describe('lashes (D-155)', () => {
  it('are tapering clumps along the lid, not a painted band', () => {
    const cover = (t: number, lower: number) => { let k = 0; const N = 400; for (let i = 0; i < N; i++) { const u = 0.706 + (0.76 - 0.706) * (i + 0.5) / N;
      if (surface(frag(MAT.lash, { ext: [t, lower], uv: [u, 0.94], bind: [0.03, 1.58, 0.14 + i * 1e-5] }), 0.001, [0, 0, 1], 0, null).keep) k++; } return k / N; };
    const root = cover(0.05, 0), mid = cover(0.45, 0), tip = cover(0.85, 0), lowerMid = cover(0.45, 1);
    expect(root).toBeGreaterThan(0.6); expect(root).toBeLessThan(1);
    expect(mid).toBeGreaterThan(0.15); expect(mid).toBeLessThan(0.65);
    expect(tip).toBeLessThan(mid); expect(lowerMid).toBeLessThan(mid);
    expect(cover(0.95, 0)).toBe(0);
  });
  it('the strip parameter runs from the lid margin (root) to the tip', () => {
    const v = A.byId.m03, E = bodyExtras({ A, ref: v, J: (b: string) => [v.joints[(HB as any)[b] * 3], v.joints[(HB as any)[b] * 3 + 1], v.joints[(HB as any)[b] * 3 + 2]] } as any);
    const c = [v.joints[HB.eye_l * 3], v.joints[HB.eye_l * 3 + 1], v.joints[HB.eye_l * 3 + 2]]; const d = { root: [0, 0], tip: [0, 0] };
    for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.lash || v.pos[i * 3] < 0) continue; const t = E.hy[i] / 255, r = Math.hypot(v.pos[i * 3] - c[0], v.pos[i * 3 + 1] - c[1], v.pos[i * 3 + 2] - c[2]);
      if (t < 0.15) { d.root[0] += r; d.root[1]++; } if (t > 0.85) { d.tip[0] += r; d.tip[1]++; } }
    expect(d.root[1]).toBeGreaterThan(10); expect(d.tip[1]).toBeGreaterThan(10);
    expect(d.tip[0] / d.tip[1]).toBeGreaterThan(d.root[0] / d.root[1] + 0.002);
  });
});

describe('skin (D-155)', () => {
  const wrapAt = (k: number) => SKIN.scatter.map((s, i) => Math.min(s * k, SKIN.wrapMax) + SKIN.wrapBase[i]);
  const prof = (ndl: number, w: number) => Math.max(0, Math.min(1, (ndl + w) / (1 + w))) ** (1 + w);
  it('diffusion: light reaches past the terminator reddened, more where the skin bends; flat skin in full light is Lambert', () => {
    const nose = wrapAt(64), forehead = wrapAt(8), ear = wrapAt(200);
    const t = nose.map(w => prof(0, w)); expect(t[0]).toBeGreaterThan(t[1]); expect(t[1]).toBeGreaterThan(t[2]); expect(t[0] / t[2]).toBeGreaterThan(2);
    for (const w of nose) expect(prof(1, w)).toBeCloseTo(1, 6);
    for (const w of forehead) expect(Math.abs(prof(0.5, w) - 0.5)).toBeLessThan(0.06);
    expect(prof(-0.1, ear[0])).toBeGreaterThan(prof(-0.1, forehead[0]) * 3);
  });
  it('pores are band-limited: gone where a period spans under ~3 px (1 m at 1080p), present in a close-up', () => {
    const hs = (fw: number) => { const h: number[] = []; for (let i = 0; i < 200; i++) h.push(surface(frag(MAT.skin, { bind: [0.02 + i * 0.00013, 1.6, 0.1] }), fw, [0, 0, 1], 0, null).h); const m = h.reduce((a, b) => a + b) / h.length; return Math.sqrt(h.reduce((a, b) => a + (b - m) ** 2, 0) / h.length); };
    expect(hs(0.0013)).toBeLessThan(1e-7); // 1 m, 1080p, 70°: the pore octaves have faded out (no shimmer)
    expect(hs(0.0002)).toBeGreaterThan(5e-6);
    // the fine mottling of colour and gloss follows the same band limit (relative spread over a 2.6 cm strip)
    const spread = (fw: number, k: (s: ReturnType<typeof surface>) => number) => { const v: number[] = []; for (let i = 0; i < 200; i++) v.push(k(surface(frag(MAT.skin, { bind: [0.02 + i * 0.00013, 1.6, 0.1] }), fw, [0, 0, 1], 0, null))); const m = v.reduce((a, b) => a + b) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) / m; };
    expect(spread(0.0002, s => lum(s.alb))).toBeGreaterThan(0.008); expect(spread(0.0013, s => lum(s.alb))).toBeLessThan(0.004);
    expect(spread(0.0002, s => s.rough)).toBeGreaterThan(0.01); expect(spread(0.0013, s => s.rough)).toBeLessThan(0.001);
  });
  it('the skin atlas: 2:1, oil on the nose, translucent ears, the upper lid crease', () => {
    expect(skin.w).toBe(2 * skin.h);
    const v = A.byId.m03; const near = (x: number, y: number, z: number) => { let best = -1, d = 9; for (let i = 0; i < A.NO; i++) { if (A.part[i] >= PART.eye) continue; const dd = Math.hypot(v.pos[i * 3] - x, v.pos[i * 3 + 1] - y, v.pos[i * 3 + 2] - z); if (dd < d) { d = dd; best = i; } } return best; };
    const det = (i: number) => { const u = A.uv[i * 2] * 0.5 + 0.5, w = A.uv[i * 2 + 1]; const x = Math.min(skin.w - 1, Math.floor(u * skin.w)), y = Math.min(skin.h - 1, Math.floor((1 - w) * skin.h)), k = (y * skin.w + x) * 4; return [skin.linRGB[k], skin.linRGB[k + 1], skin.linRGB[k + 2], skin.linRGB[k + 3]]; };
    let nose = 0; for (let i = 0; i < A.NO; i++) if (A.orig[i] === A.meta.landmarks.nose_tip) nose = i;
    const cheek = near(0.045, v.eyeY - 0.04, 0.1), ear = near(0.078, v.eyeY - 0.005, 0.02);
    expect(det(nose)[1], 'oil on the nose').toBeGreaterThan(0.6); expect(det(cheek)[1], 'less on the cheek').toBeLessThan(0.45);
    expect(det(ear)[3], 'ears are thin').toBeGreaterThan(det(cheek)[3] + 0.1);
    // the upper lid crease: the deepest crease value on the lid skin 4–10 mm above the eye's centre is a groove
    const ex = v.joints[HB.eye_l * 3], ez = v.joints[HB.eye_l * 3 + 2]; let lid = 1;
    for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.head) continue; const dy = v.pos[i * 3 + 1] - v.eyeY;
      if (Math.abs(v.pos[i * 3] - ex) < 0.005 && dy > 0.004 && dy < 0.01 && v.pos[i * 3 + 2] > ez + 0.008) lid = Math.min(lid, det(i)[0]); }
    expect(lid, 'the upper lid crease is a groove (0.5 = flat)').toBeLessThan(0.4);
  });
  it('grime stays on cloth, skin, leather and felt (a comment had swallowed its class mask: eyes, hair and metal were dusted)', () => {
    for (const m of [MAT.eye, MAT.hair, MAT.metal, MAT.lash]) {
      const clean = surface(frag(m, { bind: [0.03, 0.3, 0.1], mat: [m, 0, 0, 0] }), 0.001, [0, 0, 1], 0, null).alb, dusty = surface(frag(m, { bind: [0.03, 0.3, 0.1], mat: [m, 0, 0, 1], aux: [1, 0, 0, 0.9] }), 0.001, [0, 0, 1], 0, null).alb;
      expect(dusty).toEqual(clean);
    }
    const c0 = surface(frag(MAT.cloth_main, { bind: [0.03, 0.3, 0.1], mat: [1, 0, 0, 0] }), 0.001, [0, 0, 1], 0, null).alb, c1 = surface(frag(MAT.cloth_main, { bind: [0.03, 0.3, 0.1], mat: [1, 0, 0, 0.6], aux: [1, 0, 0, 0.9] }), 0.001, [0, 0, 1], 0, null).alb;
    expect(lum(c1)).toBeGreaterThan(lum(c0) * 1.1);
    // each trade's contact zones (bind pose): flour on a baker's front, dust on a porter's shoulders, none on a clerk's
    const at = (zone: number, P: [number, number, number]) => lum(surface(frag(MAT.cloth_main, { bind: P, mat: [1, 0, packLookBits({ motif: 0, hairStyle: 0, iris: 0, wearsHair: 0, linen: 0, age: 3, beard: 0, grimeZone: zone }), 0.5], aux: [1, 0, 0, 0.9] }), 0.001, [0, 0, 1], 0, null).alb);
    expect(at(2, [0, 1.0, 0.12])).toBeGreaterThan(at(0, [0, 1.0, 0.12]) * 1.1);
    expect(at(3, [0.12, 1.4, -0.02])).toBeGreaterThan(at(0, [0.12, 1.4, -0.02]) * 1.1);
    expect(at(1, [0.25, 0.9, 0.02])).toBeGreaterThan(at(0, [0.25, 0.9, 0.02]) * 1.1);
  });
  it('brows differ from person to person (the skin map, and so its brows, is shared by everyone)', () => {
    const brow: [number, number][] = [];
    for (let y = 0; y < skin.h; y++) for (let x = 0; x < skin.w / 2; x++) { const a = skin.linRGB[(y * skin.w + x) * 4 + 3]; if (a > 0.3 && a < 0.97) brow.push([(2 * (x + 0.5)) / skin.w, 1 - (y + 0.5) / skin.h]); }
    expect(brow.length).toBeGreaterThan(100);
    const fore: [number, number] = [brow[0][0], brow[0][1] + 12 / skin.h]; // skin 12 texels above the brow
    const ratio = (p: number) => { // same hair colour, tones within 2 %: what varies is the person's hash
      const t = 1 + 0.02 * Math.sin(p * 1.7), f = (uv: [number, number]) => frag(MAT.skin, { color: [0.3 * t, 0.2 * t, 0.15 * t], ext: [0.5, 0.2], uv });
      const ref = lum(surface(f(fore), 0.001, [0, 0, 1], 0, skin).alb); let s = 0; for (const b of brow) s += lum(surface(f(b), 0.001, [0, 0, 1], 0, skin).alb) / ref; return s / brow.length; };
    const r = Array.from({ length: 16 }, (_, p) => ratio(p)), m = r.reduce((a, b) => a + b) / r.length, sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length);
    expect(sd, 'spread of the brow/forehead luminance ratio (one brow for all: ~0)').toBeGreaterThan(0.04); // measured 0.073 (0.22 to 0.44)
  });
});

describe('hair (D-155)', () => {
  it('the long beard locks are not one periodic field (it read as corrugated sheet)', () => {
    const pat = packLookBits({ motif: 0, hairStyle: 1, iris: 0, wearsHair: 0, linen: 0, age: 3, beard: 0, grimeZone: 0 });
    const f = (x: number, y: number) => lum(surface(frag(MAT.hair, { color: [0.03, 0.02, 0.015], mat: [MAT.hair, 3, pat, 0], bind: [x, y, 0.12] }), 0.0002, [0, 0, 1], 0, null).alb);
    const dx = 0.00025, N = 240, lag = Math.round(0.0075 / dx); // 6 cm across the mass; the old lock spacing
    const ac = (k: number) => { let num = 0, den = 0;
      for (let row = 0; row < 40; row++) { const y = 1.36 + row * 0.0023, v = Array.from({ length: N }, (_, i) => f(-0.03 + i * dx, y)), mv = v.reduce((a, b) => a + b) / N;
        for (let i = 0; i + k < N; i++) num += (v[i] - mv) * (v[i + k] - mv); for (let i = 0; i < N; i++) den += ((v[i] - mv) ** 2 * (N - k)) / N; }
      return num / den; };
    // the old field (one sine over the whole mass) correlated 0.997 at one lock spacing and 0.996 at two
    expect(ac(lag), 'autocorrelation at one lock spacing').toBeLessThan(0.7); // measured 0.52
    expect(ac(2 * lag), 'at two').toBeLessThan(0.45); // measured 0.26
  });
});

describe('looks (D-155)', () => {
  it('look flags pack exactly into the person row and round-trip', () => {
    for (let i = 0; i < 200; i++) { const b = Object.fromEntries(Object.entries(LOOK_BITS).map(([k, [, n]]) => [k, (i * 7 + k.length * 3) % 2 ** n])) as any;
      const v = packLookBits(b); expect(Math.fround(v)).toBe(v); expect(unpackLookBits(v)).toEqual(b); }
  });
  it('tones follow origin with wide overlap; court dressing, bearded roots and iris are set', () => {
    const tone = (origin: string) => Array.from({ length: 300 }, (_, s) => lum(lookFor(A, { id: s, sex: 'm', role: 'mason', dress: 'worker', seed: 10000 + s, origin }, 1).col.skin));
    const mean = (a: number[]) => a.reduce((x, y) => x + y) / a.length;
    const eg = tone('Egyptian'), pe = tone('Persian'), th = tone('Thracian');
    expect(mean(eg)).toBeLessThan(mean(pe)); expect(mean(pe)).toBeLessThan(mean(th));
    expect(Math.min(...th)).toBeLessThan(Math.max(...eg)); // overlap: no origin reads as one tone
    expect(ORIGIN_TONE.Egyptian).toBeGreaterThan(ORIGIN_TONE.Persian);
    for (const [dress, role] of [['persian', 'official'], ['guard', 'guard'], ['median', 'guard']] as const) for (let s = 0; s < 20; s++) {
      const L = lookFor(A, { id: s, sex: 'm', role, dress, seed: 700 + s }, 1), b = unpackLookBits(L.pattern);
      expect(b.hairStyle).toBe(1); if (L.pieces.some(p => p.startsWith('beard'))) expect(L.stubble).toBe(2);
      expect(b.wearsHair).toBe(L.pieces.includes('hair') ? 1 : 0); expect(b.iris).toBeLessThan(8); }
    for (let s = 0; s < 60; s++) { const L = lookFor(A, { id: s, sex: 'f', role: 'grinder', dress: 'woman', seed: 900 + s }, 1); if (L.pieces.includes('hair_bob')) expect(unpackLookBits(L.pattern).hairStyle).toBe(2); }
  });
});

describe('garments and hair geometry (D-155)', () => {
  const vRef = () => A.byId.m03;
  const piecePos = (key: string, v = vRef()) => { const g = O.geos![key], base = v.index * O.NV * 4 + O.pieceBase[key] * 4, out: number[][] = []; for (let i = 0; i < g.n; i++) out.push([O.source[base + i * 4], O.source[base + i * 4 + 1], O.source[base + i * 4 + 2]]); return out; };
  it('the bob hangs from the widest part of the head to the jaw, over the ears', () => {
    const v = vRef(), P = piecePos('hair_bob@0'); let headHalfW = 0; for (let i = 0; i < A.NO; i++) if (A.part[i] === PART.head && Math.abs(v.pos[i * 3 + 1] - v.eyeY) < 0.01) headHalfW = Math.max(headHalfW, Math.abs(v.pos[i * 3]));
    const jawY = v.joints[HB.jaw * 3 + 1]; const low = P.filter(p => Math.abs(p[1] - (jawY + 0.005)) < 0.006);
    expect(low.length).toBeGreaterThan(10);
    expect(Math.max(...low.map(p => Math.abs(p[0]))), 'the curtain at the jaw stands out at the head\'s width').toBeGreaterThan(headHalfW + 0.004);
  });
  it('the kandys hangs past the knee around the back and sides, its empty sleeves outside the coat, with a border', () => {
    const v = vRef(), P = piecePos('kandys@0'), g = O.geos!['kandys@0'];
    const calfY = v.joints[HB.calf_l * 3 + 1], armX = v.joints[HB.upperarm_l * 3];
    expect(Math.min(...P.map(p => p[1]))).toBeLessThan(calfY - 0.15);
    const second = Array.from(g.mat).filter(m => m === MAT.cloth_second).length; expect(second).toBeGreaterThan(20);
    // the sleeves: the last two tubes of the merge (cape, hang, sleeve L, sleeve R)
    const sleeveVerts = P.slice(P.length - 2 * (12 * 10 + 2));
    const midL = sleeveVerts.filter(p => p[0] > 0 && p[1] < v.joints[HB.spine_02 * 3 + 1] && p[1] > v.joints[HB.pelvis * 3 + 1]);
    expect(midL.length).toBeGreaterThan(5);
    expect(Math.min(...midL.map(p => p[0])), 'sleeve outside the arm').toBeGreaterThan(armX + 0.05);
  });
  it('a seated skirt drops between the knees (slack, applied as the material does) instead of stretching into a disc', () => {
    const v = A.byId.m08, C = O.costumes.worker[0], rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
    const inp: any = { joints: v.joints, pose: pose('sit', 0.4, 2, 0.2), face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1, seat: true };
    rig.setPose(inp); rig.solve(inp, pal, 0);
    const base = v.index * O.NV * 4, key = 'work_skirt@0', off = O.pieceBase[key], g = O.geos![key]; let n = 0, drop = 0, slackN = 0;
    for (let k = 0; k < C.tid.length; k++) { const t = C.tid[k] - off; if (t < 0 || t >= g.n) continue;
      const sl = C.hext[k * 4 + 1] / 255; if (sl > 0) slackN++; if (sl < 0.5) continue;
      const o = C.skinIndex[k * 4] * 12, c1 = [pal[o + 1], pal[o + 5], pal[o + 9]], l = Math.hypot(c1[0], c1[1], c1[2]);
      drop += sl * SAG_MAX * (1 - Math.abs(c1[1] / l)); n++;
      void skinPoint; void base; }
    expect(slackN).toBeGreaterThan(100); expect(n).toBeGreaterThan(20);
    expect(drop / n, 'mean drop of the slack cloth when seated (m; 0 before D-155)').toBeGreaterThan(0.03);
  });
  it('the felt cap is finer at LOD0 and its rim stands off the skin, its edge turned under onto it (a blunt felt edge)', () => {
    // D-206: the cap is a dome of its own (outfits.ts softCap): rings from the crown to the rim, then one ring of turned
    // edge (edge byte 0) lying on the head's hull; the rim ring is the S vertices before them
    const g0 = O.geos!['cap_soft@0'], g1 = O.geos!['cap_soft@1'];
    expect(g0.index.length / 3).toBeGreaterThan(g1.index.length / 3 * 3);
    const v = vRef(), P = piecePos('cap_soft@0'), lip: number[] = []; for (let i = 0; i < g0.n; i++) if (g0.edge[i] <= 5) lip.push(i);
    const S = lip.length, dHead = (p: number[]) => { let d = 9; for (let j = 0; j < A.NO; j++) { if (A.part[j] !== PART.head && A.part[j] !== PART.neck) continue; d = Math.min(d, Math.hypot(v.pos[j * 3] - p[0], v.pos[j * 3 + 1] - p[1], v.pos[j * 3 + 2] - p[2])); } return d; };
    const rimOff = lip.map(i => dHead(P[i - S])).sort((a, b) => a - b), lipOff = lip.map(i => dHead(P[i])).sort((a, b) => a - b);
    expect(S).toBeGreaterThan(10);
    expect(rimOff[Math.floor(S * 0.1)], 'the rim stands off (p10, m)').toBeGreaterThan(0.004);
    expect(lipOff[Math.floor(S * 0.5)], 'the turned edge closes onto the head (median, m)').toBeLessThan(rimOff[Math.floor(S * 0.5)] * 0.6);
  });
  it('the headcloth has clean cut lines: no holes between arm and chest, no zigzag along its hanging edges', () => {
    const v = A.byId.f02, P = piecePos('headcloth@0', v), I = O.geos!['headcloth@0'].index, cnt = new Map<string, number>();
    for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) { const a = I[t + e], c = I[t + ((e + 1) % 3)], k = a < c ? `${a}:${c}` : `${c}:${a}`; cnt.set(k, (cnt.get(k) ?? 0) + 1); }
    const adj = new Map<number, number[]>();
    for (const [k, n] of cnt) if (n === 1) { const [a, c] = k.split(':').map(Number); for (const [x, y] of [[a, c], [c, a]]) { if (!adj.has(x)) adj.set(x, []); adj.get(x)!.push(y); } }
    const seen = new Set<number>(), loops: number[][] = [];
    for (const s0 of adj.keys()) { if (seen.has(s0)) continue; const loop = [s0]; seen.add(s0); let prev = -1, cur = s0;
      for (;;) { const nx = adj.get(cur)!.find(q => q !== prev && !seen.has(q)); if (nx === undefined) break; loop.push(nx); seen.add(nx); prev = cur; cur = nx; }
      loops.push(loop); }
    // the face opening, the front opening at the neck and the outer edge (the baseline had two more: holes under the arms)
    expect(loops.length).toBe(3);
    const dev: number[] = [], neckY = v.joints[HB.neck_01 * 3 + 1];
    for (const l of loops) for (let i = 0; i < l.length; i++) { const a = P[l[(i + l.length - 1) % l.length]], c = P[l[(i + 1) % l.length]], p = P[l[i]]; if (p[1] > neckY) continue;
      dev.push(Math.hypot(p[0] - (a[0] + c[0]) / 2, p[1] - (a[1] + c[1]) / 2, p[2] - (a[2] + c[2]) / 2)); }
    dev.sort((x, y) => x - y);
    expect(dev[Math.floor(dev.length * 0.9)], 'p90 of the cut line\'s zigzag below the neck (m; baseline 0.021)').toBeLessThan(0.005); // measured 0.0018
  });
  it('body curvature is measured (nose and ears bend more than the forehead)', () => {
    const v = vRef(), E = bodyExtras({ A, ref: v, J: (b: string) => [v.joints[(HB as any)[b] * 3], v.joints[(HB as any)[b] * 3 + 1], v.joints[(HB as any)[b] * 3 + 2]] } as any);
    let nose = 0; for (let i = 0; i < A.NO; i++) if (A.orig[i] === A.meta.landmarks.nose_tip) nose = i;
    const at = (x: number, y: number, z: number) => { let best = -1, d = 9; for (let i = 0; i < A.NO; i++) { if (A.part[i] >= PART.eye) continue; const dd = Math.hypot(v.pos[i * 3] - x, v.pos[i * 3 + 1] - y, v.pos[i * 3 + 2] - z); if (dd < d) { d = dd; best = i; } } return E.hw[best] / 255 * SKIN_CURV_MAX; };
    expect(E.hw[nose] / 255 * SKIN_CURV_MAX).toBeGreaterThan(at(0.02, v.eyeY + 0.05, 0.12) * 3);
    void unpackNormal;
  });
});
