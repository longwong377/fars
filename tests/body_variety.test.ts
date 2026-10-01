// T-E15 (UD-27, D-363): every drawn body different. Measured on what the render draws, not on the vector: for people of
// the population as the game looks them (PopView.lookInput → looks.lookFor, a child's stature by age as crowd.attachPop),
// the displacement the rig's girth and the vertex stage's fields give probe vertices of the person's own body variant
// (tools/dev/body_variety.ts, the CPU mirror of humanMaterial's terms). A person counts as distinct when the nearest other
// person on the same base mesh differs somewhere on the body by at least 3 mm (about two pixels at conversation distance)
// or in stature by as much. Also: the spread is a bell curve with both extremes present, the life moves it the way it
// should, the clothes ride the changed body, the soft tissue moves in walking and rests when still, and its cost.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadA, sample, probes, drawnOffsets, nearest, type Sample } from '../tools/dev/body_variety';
import type { HumanAssets } from '../src/people/humanAssets';
import { RigSolver, PALETTE_STRIDE, NBONES, type RigInput } from '../src/people/humanRig';
import { pose } from '../src/people/anim';
import { shapeFor, bodyRigFor, bodyFieldOffset, EX, type BodyShape } from '../src/people/bodyShape';
import { SoftState, stepSoft } from '../src/people/softbody';
import { buildOutfits, COSTUME_OF } from '../src/people/outfits';
import { bellyFrame, bellyOffset } from '../src/people/drape';
import { MAT, PART } from '../src/people/humanFormat';

let A: HumanAssets; const S0: { seed: number; people: Sample[] }[] = [];
/** the samples, built on first use (each population is dropped once its looks are taken: memory) */
const samples = () => { if (!S0.length) for (const seed of [1, 2, 3]) S0.push({ seed, people: sample(seed, A, 3000).people }); return S0; };
beforeAll(() => { A = loadA(); }, 600_000);

const stats = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length, sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  return { m, sd, skew: xs.reduce((a, b) => a + ((b - m) / sd) ** 3, 0) / xs.length, kurt: xs.reduce((a, b) => a + ((b - m) / sd) ** 4, 0) / xs.length - 3, lo: (Math.min(...xs) - m) / sd, hi: (Math.max(...xs) - m) / sd }; };
const adults = (s: Sample[], sex?: 'm' | 'f') => s.filter(p => p.look.dress !== 'child' && (!sex || p.inp.sex === sex));
const sh = (p: Sample) => p.look.body!.shape as BodyShape;

describe('T-E15: distinct drawn bodies', () => {
  it('>= 99 % of 3,000 people per seed differ from every other by at least 3 mm of drawn body (3 seeds)', () => {
    const P = probes(A); const shares: number[] = [];
    for (const { seed, people } of samples()) {
      expect(people.length, `seed ${seed}`).toBe(3000);
      for (const p of people) expect(p.look.body, 'every look carries its body').toBeTruthy();
      const offs = people.map(p => drawnOffsets(A, p.look, P));
      let ok = 0; for (let a = 0; a < people.length; a++) if (nearest(people, offs, a, A) >= 3) ok++;
      shares.push(ok / people.length);
    }
    console.log('[T-E15] share distinct by seed', shares.map(x => (100 * x).toFixed(2) + ' %').join(', '));
    for (const x of shares) expect(x).toBeGreaterThanOrEqual(0.99);
  }, 600_000);

  it('the spread is a bell curve per sex with both extremes present (fat, muscle, frame, bust, hips, face)', () => {
    const all = samples().flatMap(s => s.people);
    for (const [sex, keys] of [['m', ['fat', 'muscle', 'frame', 'hips', 'faceW', 'faceL', 'nose']], ['f', ['fat', 'muscle', 'frame', 'bust', 'hips', 'faceW', 'faceL', 'nose']]] as const) {
      for (const k of keys) { const st = stats(adults(all, sex).map(p => (sh(p) as any)[k]));
        expect(Math.abs(st.skew), `${sex} ${k} skew`).toBeLessThan(0.6); expect(st.kurt, `${sex} ${k} kurtosis`).toBeLessThan(2); expect(st.kurt).toBeGreaterThan(-1);
        expect(st.lo, `${sex} ${k} low extreme`).toBeLessThan(-2.5); expect(st.hi, `${sex} ${k} high extreme`).toBeGreaterThan(2.5); } }
    // beauty: plain to beautiful, the whole range drawn
    const b = all.map(p => sh(p).beauty); expect(Math.min(...b)).toBeLessThan(0.02); expect(Math.max(...b)).toBeGreaterThan(0.98);
  });

  it('the extremes are drawn: bust several-fold, girths and the fat belly from lean to very large', () => {
    const P = probes(A), women = adults(samples()[0].people, 'f');
    // the breast field's k − 1 (volume ∝ k³): smallest to largest at least 3×
    const k = women.map(p => 1 + p.look.body!.extras[EX.k]).sort((a, b) => a - b);
    expect(k[k.length - 1] ** 3 / k[0] ** 3).toBeGreaterThan(3);
    // the largest drawn displacement of a body: lean people barely move, the largest bodies by many centimetres
    const mag = adults(samples()[0].people).map(p => { const o = drawnOffsets(A, p.look, P); let m = 0; for (let i = 0; i < o.length; i += 3) m = Math.max(m, Math.hypot(o[i], o[i + 1], o[i + 2])); return m; }).sort((a, b) => a - b);
    expect(mag[Math.floor(mag.length * 0.99)]).toBeGreaterThan(0.06);
    const belly = adults(samples()[0].people).map(p => p.look.body!.extras[EX.ex7]); expect(belly.filter(x => x > 0.3).length).toBeGreaterThan(5); expect(belly.filter(x => x === 0).length / belly.length).toBeGreaterThan(0.4);
  });

  it('the life moves the body: labour lean and muscled, plenty fat, age stooped and soft, nursing fuller, illness wasted', () => {
    const base = { sex: 'm' as const, role: 'porter', dress: 'worker', age: 'adult' as const };
    const mean = (f: (i: number) => BodyShape, k: keyof BodyShape) => { let s = 0; for (let i = 0; i < 400; i++) s += f(i)[k] as number; return s / 400; };
    const porter = (i: number) => shapeFor({ ...base, seed: i, life: { ageYears: 30, labour: 1, wealth: 0.2 } }, 1);
    const scribe = (i: number) => shapeFor({ ...base, seed: i, role: 'scribe', dress: 'median', life: { ageYears: 30, labour: 0.15, wealth: 0.7 } }, 1);
    expect(mean(porter, 'muscle')).toBeGreaterThan(mean(scribe, 'muscle') + 0.6); expect(mean(porter, 'fat')).toBeLessThan(mean(scribe, 'fat') - 0.6);
    const old = (i: number) => shapeFor({ ...base, seed: i, life: { ageYears: 70 } }, 1), young = (i: number) => shapeFor({ ...base, seed: i, life: { ageYears: 25 } }, 1);
    expect(mean(old, 'posture')).toBeGreaterThan(mean(young, 'posture') + 1); expect(mean(old, 'firm')).toBeLessThan(mean(young, 'firm') - 0.3);
    const w = { ...base, sex: 'f' as const, role: 'homemaker', dress: 'woman' };
    const nurse = (i: number) => shapeFor({ ...w, seed: i, life: { ageYears: 26, parity: 2, nursing: true } }, 1), not = (i: number) => shapeFor({ ...w, seed: i, life: { ageYears: 26, parity: 2 } }, 1);
    expect(mean(nurse, 'bust')).toBeGreaterThan(mean(not, 'bust') + 0.7);
    const ill = (i: number) => shapeFor({ ...base, seed: i, life: { ageYears: 30, ill: 0.8 } }, 1), well = (i: number) => shapeFor({ ...base, seed: i, life: { ageYears: 30 } }, 1);
    expect(mean(ill, 'fat')).toBeLessThan(mean(well, 'fat') - 0.8);
    // in the population: the shifts come through lookInput's life (popview hook)
    const all = samples().flatMap(s => s.people); expect(all.filter(p => p.inp.life?.ageYears !== undefined).length / all.length).toBeGreaterThan(0.99);
  });
});

describe('the clothes over the changed body (D-363)', () => {
  it('the woman\'s dress stays outside the body for the largest bust, buttocks and belly, on every adult woman\'s body', () => {
    const O = buildOutfits(A, { dresses: ['woman'], lods: [0] }), C = O.costumes[COSTUME_OF.woman].find(c => c.lod === 0)!;
    const ex = (v: (typeof A.variants)[number]) => bodyRigFor(A, v, { ...shapeFor({ seed: 7, sex: 'f', role: 'homemaker', dress: 'woman', life: { ageYears: 40 } }, 1), fat: 3, bust: 3.5, butt: 3, belly: 3.5, firm: 0.3, cheek: 3 }).extras;
    const E0 = 36; const key = (x: number, y: number) => `${Math.round(x / 0.015)},${Math.round(y / 0.015)}`, o3 = [0, 0, 0];
    for (const v of A.variants.filter(q => q.meta.sex === 'f' && q.meta.group !== 'child')) {
      const F = bellyFrame(A, v); const inside = (E: Float32Array) => { let front = 0, bad = 0;
      // the body's foremost (front) and hindmost (back) skin per (x, y) bin, after the fields
      const bf = new Map<string, number>(), bb = new Map<string, number>();
      for (let i = 0; i < A.NO; i++) { if (A.part[i] > PART.foot_r) continue; const x = v.pos[i * 3], y = v.pos[i * 3 + 1], z = v.pos[i * 3 + 2]; bodyFieldOffset(x, y, z, A.skinIndex[i * 4], E, true, o3); const b = bellyOffset(x, y, z, E[EX.ex7], F);
        const k = key(x + o3[0], y + o3[1] + b.dy), zz = z + o3[2] + b.dz; bf.set(k, Math.max(bf.get(k) ?? -9, zz)); bb.set(k, Math.min(bb.get(k) ?? 9, zz)); }
      // cloth vertices (main and second cloth of the dress) that lie in front of the chest or behind the buttocks
      for (let i = 0; i < C.tid.length; i++) { const m = C.hmat[i * 4]; if (m < MAT.cloth_main || m > MAT.cloth_trim) continue;
        const q = (v.index * O.NV + C.tid[i]) * 4, x = O.source[q], y = O.source[q + 1], z = O.source[q + 2]; // (this body's fitted garment: the source texture)
        if (Math.abs(x) > 0.16 || y < F.yc - 0.35 || y > F.yc + 0.4) continue;
        bodyFieldOffset(x, y, z, C.skinIndex[i * 4], E, true, o3); const b = bellyOffset(x, y, z, E[EX.ex7], F, true);
        const k = key(x + o3[0], y + o3[1] + b.dy), zz = z + o3[2] + b.dz;
        if (z > 0.02 && bf.has(k)) { front++; if (zz < bf.get(k)! - 0.004) bad++; }
        if (z < -0.02 && bb.has(k) && zz > bb.get(k)! + 0.004) bad++; }
      return { front, share: bad / Math.max(1, front) }; };
      const before = inside(new Float32Array(E0)), after = inside(ex(v));
      console.log(`[clothes] ${v.meta.id}: cloth inside the skin before ${(100 * before.share).toFixed(2)} %, after the largest body ${(100 * after.share).toFixed(2)} %`);
      expect(after.front, v.meta.id).toBeGreaterThan(50);
      expect(after.share, `${v.meta.id}: cloth inside the body`).toBeLessThan(before.share + 0.02);
    }
  }, 300_000);
});

describe('soft tissue (D-363)', () => {
  const walkRun = (s: BodyShape, anim: 'walk' | 'idle', secs = 4) => {
    const v = A.variants.find(q => q.meta.sex === s.sex && q.meta.group === 'adult')!, body = bodyRigFor(A, v, s), rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
    const inp: RigInput = { joints: v.joints, pose: { rot: {}, hips: [0, 0, 0] }, face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1, body, plant: true, t: 0 };
    let amp = 0, late = 0; const dt = 1 / 60;
    for (let f = 0; f < secs * 60; f++) { const t = f * dt; inp.t = t; inp.pose = pose(anim, t, t * 2 * Math.PI * 0.9, 0.3); if (anim === 'walk') inp.z = 1.25 * t; rig.setPose(inp); rig.solve(inp, pal, 0);
      const e = NBONES * 12, m = Math.hypot(pal[e + EX.sprBL], pal[e + EX.sprBL + 1], pal[e + EX.sprBL + 2]); if (t > 1) amp = Math.max(amp, m); if (t > secs - 1) late = Math.max(late, m); }
    return { amp, late };
  };
  const woman = (bust: number, firm: number) => ({ ...shapeFor({ seed: 3, sex: 'f', role: 'homemaker', dress: 'woman', life: { ageYears: 30 } }, 1), bust, firm });
  it('breasts move in walking by their size and softness, and rest when still', () => {
    const big = walkRun(woman(2.5, 0.4), 'walk'), small = walkRun(woman(-1.5, 0.95), 'walk'), still = walkRun(woman(2.5, 0.4), 'idle');
    console.log(`[soft] breast spring amplitude walking: large soft ${(big.amp * 1000).toFixed(1)} mm, small firm ${(small.amp * 1000).toFixed(1)} mm; standing ${(still.late * 1000).toFixed(1)} mm`);
    expect(big.amp).toBeGreaterThan(0.008); expect(big.amp).toBeGreaterThan(small.amp * 1.8); expect(still.late).toBeLessThan(big.amp * 0.35);
  });
  it('costs well under 1 ms a frame for the visible crowd (300 people)', () => {
    const v = A.variants[0], body = bodyRigFor(A, v, shapeFor({ seed: 1, sex: 'm', role: 'porter', dress: 'worker' }, 1)), wt = new Float64Array(NBONES * 3), wr = new Float64Array(NBONES * 9);
    for (let b = 0; b < NBONES; b++) { wt.set([v.joints[b * 3], v.joints[b * 3 + 1], v.joints[b * 3 + 2]], b * 3); wr.set([1, 0, 0, 0, 1, 0, 0, 0, 1], b * 9); }
    const st = Array.from({ length: 300 }, () => new SoftState()), ex = new Float32Array(36), root = { x: 0, y: 0, z: 0, yaw: 0, scale: 1 };
    for (let f = 0; f < 30; f++) for (const s of st) { root.y = 0.02 * Math.sin(f / 3); stepSoft(s, body, f / 60, wt, wr, root, ex, 0); }
    // the least of five runs of 60 frames (the box is shared: a run that lost the core is not the pass's cost)
    let ms = Infinity; for (let run = 0; run < 5; run++) { const t0 = performance.now(), F = 60, f0 = 30 + run * F; for (let f = f0; f < f0 + F; f++) for (const s of st) { root.y = 0.02 * Math.sin(f / 3); stepSoft(s, body, f / 60, wt, wr, root, ex, 0); } ms = Math.min(ms, (performance.now() - t0) / F); } console.log(`[soft] ${ms.toFixed(3)} ms a frame for 300 people`); expect(ms).toBeLessThan(1);
  });
});
