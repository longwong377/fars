// s18 C14 (D-790): the face while speaking and listening (src/people/face.ts, humanRig.ts faceMotion, bodyShape.faceOffset,
// mirrored by humanMaterial's vertex stage). A talking face shapes its mouth from phones (not a jaw on a sine), lifts its
// brows on the stress, moves its eyes in saccades with fixations, blinks after large ones, rests its upper lids over the
// iris's top, turns its head to the face it looks at, and nods while listening; the field moves only the lips, cheeks and
// brows, by millimetres.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeHumanAssets } from '../src/people/humanAssets';
import { HB, PART } from '../src/people/humanFormat';
import { RigSolver, PALETTE_STRIDE, LID_CLOSE, type RigInput } from '../src/people/humanRig';
import { bodyRigFor, shapeFor, faceOffset, regionFrame, EX, EXTRA_FLOATS } from '../src/people/bodyShape';
import { phonesOf, visemeAt, phoneOf, saccade, gazeState, stressAt, FACE0 } from '../src/people/face';
import { pose } from '../src/people/anim';

const meta = JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), bin = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

describe('visemes from phones (face.ts)', () => {
  it('maps letters to mouth shapes and coarticulates them', () => {
    expect(phoneOf('m')).toBe('m'); expect(phoneOf('ū')).toBe('u'); expect(phoneOf('š')).toBe('s'); expect(phoneOf(' ')).toBe('_'); expect(phoneOf('ā')).toBe('a');
    const P = phonesOf('mam umu'); expect(P.cls.join('')).toBe('mam_umu');
    const at = (cls: string) => { const i = P.cls.indexOf(cls); return (P.t[i] + (P.t[i + 1] ?? P.dur)) / 2; };
    const m = visemeAt(P, 0, at('m')), a = visemeAt(P, 0, at('a')), u = visemeAt(P, 0, P.t[P.cls.lastIndexOf('u')] + 0.04);
    expect(m.press).toBeGreaterThan(0.4); expect(a.jaw).toBeGreaterThan(m.jaw + 0.3); expect(u.round).toBeGreaterThan(0.5); expect(a.round).toBeLessThan(0.3);
    // continuous: no jump between frames 1/60 s apart
    let worst = 0; const prev = { ...FACE0 }; visemeAt(P, 0, 0, prev);
    for (let t = 1 / 60; t < P.dur; t += 1 / 60) { const v = visemeAt(P, 0, t); worst = Math.max(worst, Math.abs(v.jaw - prev.jaw), Math.abs(v.round - prev.round), Math.abs(v.press - prev.press)); Object.assign(prev, v); }
    expect(worst).toBeLessThan(0.45);
  });
  it('a babble without text has the period speech shape: open vowels most, closures and rounding among them', () => {
    let open = 0, press = 0, round = 0; const N = 600;
    for (let k = 0; k < N; k++) { const v = visemeAt(null, 12345, k * 0.033); if (v.jaw > 0.5) open++; if (v.press > 0.5) press++; if (v.round > 0.5) round++; }
    expect(open / N).toBeGreaterThan(0.2); expect(press / N).toBeGreaterThan(0.03); expect(round / N).toBeGreaterThan(0.02);
    expect(stressAt(null, 12345, 0.08)).toBeGreaterThan(0.3);
  });
  it('saccades jump and then fixate (not a slow sine), within a face triangle when looking at someone', () => {
    const G = gazeState(77); let jumps = 0, last = saccade(G, 77, 0, true), maxOff = 0;
    for (let t = 1 / 60; t < 20; t += 1 / 60) { const s = saccade(G, 77, t, true); if (Math.hypot(s[0] - last[0], s[1] - last[1]) > 0.01) jumps++; maxOff = Math.max(maxOff, Math.abs(s[0]), Math.abs(s[1])); last = s; }
    expect(jumps).toBeGreaterThan(6); expect(jumps).toBeLessThan(100); expect(maxOff).toBeLessThan(0.08);
  });
});

describe('the face in the rig and the field (humanRig, bodyShape)', () => {
  const v = A.byId.m03, body = bodyRigFor(A, v, shapeFor({ seed: 5, sex: 'm', role: 'porter', dress: 'worker' }, 1));
  const mk = (t: number, jaw: number, look: [number, number, number] | null): RigInput => ({ joints: v.joints, pose: pose('talk', t, 0, 0.3), face: { jaw, blink: 0, look, eyeYaw: 0, eyePitch: 0, seed: 99 }, grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1, plant: true, body, t });
  it('a talking face writes visemes and brows into the palette; a still face (no clock) writes none', () => {
    const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE), eo = PALETTE_STRIDE - EXTRA_FLOATS;
    const inp = mk(0, 0.12, [0, 1.6, 1]); let round = 0, press = 0, jawMax = 0, jawMin = 9, brow = 0;
    for (let k = 0; k < 240; k++) { inp.t = k / 60; inp.face.jaw = 0.12; rig.setPose(inp); rig.solve(inp, pal, 0);
      round = Math.max(round, pal[eo + EX.vis]); press = Math.max(press, pal[eo + EX.vis + 2]); brow = Math.max(brow, pal[eo + EX.brow + 1]); jawMax = Math.max(jawMax, rig.fs.jaw); if (k > 30) jawMin = Math.min(jawMin, rig.fs.jaw); }
    expect(round).toBeGreaterThan(0.3); expect(press).toBeGreaterThan(0.3); expect(brow).toBeGreaterThan(0.15); expect(jawMax).toBeGreaterThan(0.1); expect(jawMin).toBeLessThan(0.03);
    const still: RigInput = { ...mk(0, 0, null), t: undefined }; const p2 = new Float32Array(PALETTE_STRIDE); rig.setPose(still); rig.solve(still, p2, 0);
    for (let k = EX.vis; k < EX.brow + 3; k++) expect(p2[eo + k]).toBe(0);
    expect(p2[eo + EX.mouth + 2]).toBeGreaterThan(0.015); // the mouth's frame is static
  });
  it('the upper lids rest over the iris; the head turns to the face it looks at (no eyes rolled under the brows)', () => {
    const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
    // a target well above the eyes: without the head's following the eyes would sit at their clamp
    const inp = mk(0, 0, [0, 2.3, 0.8]);
    for (let k = 0; k < 120; k++) { inp.t = k / 60; rig.setPose(inp); rig.solve(inp, pal, 0); }
    const lidX = Math.asin(Math.max(-1, Math.min(1, -rig.local[HB.lid_ul * 9 + 5]))); // (x rotation of the upper lid)
    expect(lidX).toBeGreaterThan(-0.2 * LID_CLOSE);
    // the eye's pitch need is within its range once the head followed
    const head = rig.wr.subarray(HB.head * 9, HB.head * 9 + 9); expect(head[7]).toBeLessThan(-0.05); // (the head's forward axis tips up: −z·y component)
  });
  it('the field moves lips, cheeks and brows by millimetres and nothing else', () => {
    const F = regionFrame(A, v), ex = new Float32Array(EXTRA_FLOATS); ex.set(F.mouth, EX.mouth); ex[EX.brow + 3] = 1;
    ex.set([1, 1, 1, 1], EX.vis); ex.set([1, 1, 1], EX.brow);
    const o = [0, 0, 0]; let maxM = 0, far = 0;
    for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.head) continue; o[0] = o[1] = o[2] = 0; faceOffset(v.pos[i * 3], v.pos[i * 3 + 1], v.pos[i * 3 + 2], ex, o);
      const m = Math.hypot(...o); maxM = Math.max(maxM, m); const dy = v.pos[i * 3 + 1] - v.eyeY; if (dy > 0.08 || dy < -0.13 || v.pos[i * 3 + 2] < 0.04) far = Math.max(far, m); }
    expect(maxM).toBeGreaterThan(0.004); expect(maxM).toBeLessThan(0.016); expect(far).toBeLessThan(1e-4);
    // the mouth line sits between the nose and the chin
    expect(F.mouth[0]).toBeLessThan(v.eyeY - 0.04); expect(F.mouth[0]).toBeGreaterThan(v.eyeY - 0.1);
  });
});
