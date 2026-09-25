// Carried jars against the bodies that carry them (D-217; rubric s7 pass 2, R1: "a carried jar swallows the walker's
// head"). The jar's lathe (props.ts `jar`) placed by placeProp on the solved rig, the skinned body vertices tested against
// it, over the body variants the crowd gives porters and women and the walking cycle: the head never inside a jar, the
// head-carried jar on its pad on the crown, the shoulder jar seated on the shoulder with its neck in the raised hand, and
// nothing of the body deeper inside a jar than the flesh under a load or a gripping hand (3 cm; the fingers hooked over
// the lip into the open mouth excepted).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets, type HumanAssets } from '../src/people/humanAssets';
import { PART } from '../src/people/humanFormat';
import { RigSolver, PALETTE_STRIDE, skinPoint } from '../src/people/humanRig';
import { pose, type AnimId } from '../src/people/anim';
import { placeProp, gripPoint, SHOULDER_JAR } from '../src/people/props';
import { ACTIVITIES } from '../src/people/activities';
import { lookFor } from '../src/people/looks';

let A: HumanAssets;
beforeAll(() => { const b = readFileSync('public/generated/humans/humans.bin'); A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); });
// the jar's lathe profile (props.ts propGeometry 'jar'): radius at a height, in the jar's own units
const PROF = [[0, 0], [0.1, 0.02], [0.16, 0.18], [0.12, 0.36], [0.06, 0.42], [0.07, 0.46]];
const rAt = (y: number) => { if (y < 0) return -1; for (let i = 1; i < PROF.length; i++) if (y <= PROF[i][1]) { const t = (y - PROF[i - 1][1]) / (PROF[i][1] - PROF[i - 1][1]); return PROF[i - 1][0] + t * (PROF[i][0] - PROF[i - 1][0]); } return -1; };
interface Fit { headIn: number; headClear: number; deepest: Record<string, number>; baseAboveCrown: number; neckToGrip: number }
/** one body, one moment of the cycle: the jar's transform and how the body meets it (world metres, the look's scale) */
function fit(variant: string, scale: number, kind: string, anim: AnimId, ph: number): Fit {
  const v = A.byId[variant], rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE), po = pose(anim, 1, ph, 0.3);
  const inp: any = { joints: v.joints, pose: po, face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: po.grip ?? [0.15, 1], x: 0, y: 0, z: 0, yaw: 0, scale: 1, plant: true };
  rig.setPose(inp); rig.solve(inp, pal, 0);
  const M = new THREE.Matrix4(); expect(placeProp(kind, rig as any, po, scale, 1, 0, M)).toBe(true);
  const inv = M.clone().invert(), k = M.getMaxScaleOnAxis(), o = [0, 0, 0], q = new THREE.Vector3();
  const out: Fit = { headIn: 0, headClear: 9, deepest: {}, baseAboveCrown: 0, neckToGrip: 0 }; let crown = -9;
  const names = Object.fromEntries(Object.entries(PART).map(([n, i]) => [i, n]));
  for (let i = 0; i < A.NO; i++) { const pt = A.part[i]; if (pt >= PART.eye) continue;
    skinPoint(pal, 0, A.skinIndex.subarray(i * 4, i * 4 + 4), Array.from(A.skinWeight.subarray(i * 4, i * 4 + 4), x => x / 255), v.pos.subarray(i * 3, i * 3 + 3), o);
    q.set(o[0] * scale, o[1] * scale, o[2] * scale); if (pt === PART.head) crown = Math.max(crown, q.y);
    const l = q.applyMatrix4(inv), r = rAt(l.y); if (r < 0) continue;
    const d = (Math.hypot(l.x, l.z) - r) * k; // outside the jar's surface (+) or inside it (−), metres
    if (pt === PART.head) { out.headClear = Math.min(out.headClear, d); if (d < 0) out.headIn++; }
    if (pt === PART.hand_r && l.y >= 0.42 && kind === 'jar') continue; // fingers hooked over the lip into the mouth (the jar is open)
    if (d < 0) { if (-d > (out.deepest[names[pt]] ?? 0) && process.env.JARDBG) console.log(variant, names[pt], 'depth', (-d * 100).toFixed(1), 'at jar height', l.y.toFixed(3), 'r', r.toFixed(3)); out.deepest[names[pt]] = Math.max(out.deepest[names[pt]] ?? 0, -d); } }
  out.baseAboveCrown = new THREE.Vector3().setFromMatrixPosition(M).y - crown;
  // the hand's grip to the nearest point of the jar's neck and rim (the profile from the shoulder at 0.36 to the lip at 0.46)
  const g = gripPoint(rig as any, 'r').multiplyScalar(scale).applyMatrix4(inv), gy = Math.min(0.46, Math.max(0.36, g.y));
  out.neckToGrip = Math.hypot(Math.hypot(g.x, g.z) - rAt(gy), g.y - gy) * k;
  return out;
}
/** the bodies porters, water carriers and women are given (looks.ts), by variant and scale */
function bodies() { const m = new Map<string, [string, number]>();
  for (let s = 0; s < 40; s++) for (const sex of ['m', 'f'] as const) { const L = lookFor(A, { id: s, sex, role: 'porter', dress: sex === 'f' ? 'woman' : 'worker', seed: 100 + s, age: 'adult' } as any, 1); m.set(`${L.variantId}@${L.scale.toFixed(2)}`, [L.variantId, L.scale]); }
  return [...m.values()]; }
const PHASES = Array.from({ length: 8 }, (_, i) => (i / 8) * 2 * Math.PI);

describe('carried jars (D-217, R1)', () => {
  it('the activities carry the jar the way the placement expects: on the head (carry_head, jar_head) or on the shoulder (carry_shoulder, jar)', () => {
    expect([ACTIVITIES.carry_jar_head.anim, ACTIVITIES.carry_jar_head.prop]).toEqual(['carry_head', 'jar_head']);
    expect([ACTIVITIES.carry_jar.anim, ACTIVITIES.carry_jar.prop]).toEqual(['carry_shoulder', 'jar']);
    expect(pose('carry_shoulder', 1, 0, 0.3).shoulder).toBe(true); expect(pose('walk', 1, 0, 0.3).shoulder).toBeFalsy();
  });
  it('on the head: on a pad on the crown (0-4 cm above it), no part of the head or body inside the jar', () => {
    const rows: string[] = [];
    for (const [id, sc] of bodies()) for (const ph of PHASES) { const f = fit(id, sc, 'jar_head', 'carry_head', ph);
      expect(f.headIn, `${id} phase ${ph.toFixed(2)}`).toBe(0); expect(Object.keys(f.deepest), `${id}`).toEqual([]);
      expect(f.baseAboveCrown, `${id} base above the crown`).toBeGreaterThanOrEqual(0); expect(f.baseAboveCrown).toBeLessThan(0.04);
      if (ph === 0) rows.push(`${id}: base ${(f.baseAboveCrown * 100).toFixed(1)} cm above the crown`); }
    console.log('head carry\n' + rows.join('\n'));
  });
  it('on the shoulder: the head ≥ 2 cm clear, the neck in the hand, the body no deeper in the jar than 3 cm (the seat and the grip)', () => {
    const rows: string[] = [];
    for (const [id, sc] of bodies()) { let clear = 9, deep = 0, part = '', neck = 0;
      for (const ph of PHASES) { const f = fit(id, sc, 'jar', 'carry_shoulder', ph);
        expect(f.headIn, `${id} phase ${ph.toFixed(2)}: head inside the jar`).toBe(0); clear = Math.min(clear, f.headClear); neck = Math.max(neck, f.neckToGrip);
        for (const [p, d] of Object.entries(f.deepest)) if (d > deep) { deep = d; part = p; }
        // the seat: the jar's base below the crown by the neck and head (it is on the shoulder, not beside the head)
        expect(f.baseAboveCrown, `${id}: the jar's base on the shoulder`).toBeLessThan(-0.18); }
      rows.push(`${id} ×${sc.toFixed(2)}: head clear ${(clear * 100).toFixed(1)} cm, deepest ${(deep * 100).toFixed(1)} cm (${part}), the grip ${(neck * 100).toFixed(1)} cm from the neck`);
      expect(clear, `${id} head clear of the jar`).toBeGreaterThanOrEqual(0.02); expect(deep, `${id} ${part} inside the jar`).toBeLessThanOrEqual(0.03);
      expect(neck, `${id}: the neck in the hand`).toBeLessThan(0.05); }
    console.log(`shoulder carry (jar × ${SHOULDER_JAR.scale.join("–")})\n` + rows.join('\n'));
  });
});
