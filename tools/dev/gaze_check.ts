// dev: where do the eyes point? For a person facing +Z with a gaze target straight ahead (and to the side), prints the
// angle between each eye's rendered gaze (iris centre − eyeball centre, skinned as the GPU does) and the direction to
// the target. Usage: npx tsx tools/dev/gaze_check.ts
import { readFileSync } from 'node:fs';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { HB, PART } from '../../src/people/humanFormat';
import { RigSolver, PALETTE_STRIDE, skinPoint, type RigInput } from '../../src/people/humanRig';
import { pose } from '../../src/people/anim';

const b = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const v = A.byId.m03; const rig = new RigSolver(A.meta.curlAxes); const pal = new Float32Array(PALETTE_STRIDE);
// eye vertices per side: the eyeball centre (mean) and the iris centre (the most forward vertices)
for (const side of ['l', 'r'] as const) {
  const bone = HB[`eye_${side}`]; const ids: number[] = [];
  for (let i = 0; i < A.NO; i++) if (A.part[i] === PART.eye && A.skinIndex[i * 4] === bone && A.skinWeight[i * 4] > 200) ids.push(i);
  let cx = 0, cy = 0, cz = 0; for (const i of ids) { cx += v.pos[i * 3]; cy += v.pos[i * 3 + 1]; cz += v.pos[i * 3 + 2]; } cx /= ids.length; cy /= ids.length; cz /= ids.length;
  const zmax = Math.max(...ids.map(i => v.pos[i * 3 + 2])); const front = ids.filter(i => v.pos[i * 3 + 2] > zmax - 0.002);
  console.log(`eye_${side}: ${ids.length} verts, centre (${cx.toFixed(4)}, ${cy.toFixed(4)}, ${cz.toFixed(4)}), joint (${[...v.joints.subarray(bone * 3, bone * 3 + 3)].map(x => x.toFixed(4)).join(', ')}), front verts ${front.length}`);
  // weights of the eye vertices: which bones?
  const bones = new Map<number, number>(); for (let i = 0; i < A.NO; i++) if (A.part[i] === PART.eye) for (let k = 0; k < 4; k++) if (A.skinWeight[i * 4 + k]) bones.set(A.skinIndex[i * 4 + k], (bones.get(A.skinIndex[i * 4 + k]) ?? 0) + 1);
  if (side === 'l') console.log('eye-part bones:', [...bones].map(([bb, n]) => `${bb}:${n}`).join(' '));
  for (const [label, target, anim] of [['ahead 0.6 m', [0, v.eyeY, 0.7], null], ['1 m left of him', [1, v.eyeY, 1], null], ['ahead, idle t=3', [0, v.eyeY, 0.7], 3], ['ahead, idle t=11', [0, v.eyeY, 0.7], 11]] as const) {
    const inp: RigInput = { joints: v.joints, pose: anim === null ? { rot: {}, hips: [0, 0, 0] } : pose('idle', anim, 0, 0.3), face: { jaw: 0, blink: 0, look: [...target] as [number, number, number], eyeYaw: 0, eyePitch: 0 }, grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1 };
    rig.setPose(inp); rig.solve(inp, pal, 0);
    const sk = (i: number) => skinPoint(pal, 0, A.skinIndex.subarray(i * 4, i * 4 + 4), [...A.skinWeight.subarray(i * 4, i * 4 + 4)].map(w => w / 255), v.pos.subarray(i * 3, i * 3 + 3));
    const c = [0, 0, 0]; for (const i of ids) { const p = sk(i); c[0] += p[0] / ids.length; c[1] += p[1] / ids.length; c[2] += p[2] / ids.length; }
    const f = [0, 0, 0]; for (const i of front) { const p = sk(i); f[0] += p[0] / front.length; f[1] += p[1] / front.length; f[2] += p[2] / front.length; }
    const g = [f[0] - c[0], f[1] - c[1], f[2] - c[2]], t = [target[0] - c[0], target[1] - c[1], target[2] - c[2]];
    const n = (a: number[]) => Math.hypot(a[0], a[1], a[2]); const ang = Math.acos((g[0] * t[0] + g[1] * t[1] + g[2] * t[2]) / n(g) / n(t)) * 180 / Math.PI;
    const R = rig.wr, o = bone * 9; const axis = [R[o + 2], R[o + 5], R[o + 8]];
    const hr = rig.wr, h = HB.head * 9;
    console.log(`  ${label}: gaze ${g.map(x => (x / n(g)).toFixed(3)).join(',')} target ${t.map(x => (x / n(t)).toFixed(3)).join(',')} → off by ${ang.toFixed(1)}°; bone +Z ${axis.map(x => x.toFixed(3)).join(',')}; head +Z ${[hr[h + 2], hr[h + 5], hr[h + 8]].map(x => x.toFixed(3)).join(',')}`);
  }
}
