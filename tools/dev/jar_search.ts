// dev (D-217): search the shoulder-carry arm pose (r_upper, r_fore Euler) for the jar seated on the right shoulder
// (props.ts SHOULDER_JAR): least body inside the jar, the head clear, the jar's axis leaning out 10–40°.
//   npx tsx tools/dev/jar_search.ts
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { PART } from '../../src/people/humanFormat';
import { RigSolver, PALETTE_STRIDE, skinPoint } from '../../src/people/humanRig';
import { pose } from '../../src/people/anim';
import { placeProp } from '../../src/people/props';
const b = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const prof = [[0, 0], [0.1, 0.02], [0.16, 0.18], [0.12, 0.36], [0.06, 0.42], [0.07, 0.46]];
const rAt = (y: number) => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const t = (y - prof[i - 1][1]) / (prof[i][1] - prof[i - 1][1]); return prof[i - 1][0] + t * (prof[i][0] - prof[i - 1][0]); } return -1; };
const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
const vars = (process.env.VARS ?? 'm06,f04,m05,f01').split(',');
function score(rot: Record<string, number[]>) {
  let bad = 0, hand = 0, head = 9, tiltMin = 9, tiltMax = -9; const q = new THREE.Vector3(), o = [0, 0, 0];
  for (const id of vars) { const v = A.byId[id];
    for (const ph of [0, Math.PI / 2, Math.PI]) {
      const po = pose('carry_shoulder', 1, ph, 0.3); Object.assign(po.rot, rot);
      const inp: any = { joints: v.joints, pose: po, face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: [0.15, 1], x: 0, y: 0, z: 0, yaw: 0, scale: 1, plant: true };
      rig.setPose(inp); rig.solve(inp, pal, 0);
      const M = new THREE.Matrix4(); placeProp('jar', rig as any, po, 1, 1, 0, M); const inv = M.clone().invert();
      const ax = new THREE.Vector3().setFromMatrixColumn(M, 1).normalize(); const tilt = Math.acos(ax.y) * 180 / Math.PI * (ax.x < 0 ? 1 : -1);
      tiltMin = Math.min(tiltMin, tilt); tiltMax = Math.max(tiltMax, tilt);
      for (let i = 0; i < A.NO; i += 2) { const pt = A.part[i]; if (pt >= PART.eye) continue;
        skinPoint(pal, 0, A.skinIndex.subarray(i * 4, i * 4 + 4), Array.from(A.skinWeight.subarray(i * 4, i * 4 + 4), x => x / 255), v.pos.subarray(i * 3, i * 3 + 3), o);
        const l = q.set(o[0], o[1], o[2]).applyMatrix4(inv), r = rAt(l.y), d = r > 0 ? Math.hypot(l.x, l.z) - r : 9;
        if (pt === PART.head) head = Math.min(head, d / 1.25);
        if (d < 0) { if (pt === PART.hand_r) hand++; else bad++; } } } }
  return { bad, hand, head: +(head * 100).toFixed(1), tilt: [+tiltMin.toFixed(0), +tiltMax.toFixed(0)] };
}
const res: { rot: any; s: any; cost: number }[] = [];
const G = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
const X = process.env.FINE ? G(-2.55, -2.05, 5) : [-2.9, -2.6, -2.3, -2.0, -1.7], Y = process.env.FINE ? G(-0.3, 0.3, 3) : [-1.2, -0.6, 0, 0.6], Z = process.env.FINE ? G(-1.1, -0.7, 5) : [-1.2, -0.9, -0.6, -0.35], F = process.env.FINE ? G(-1.3, -0.7, 4) : [-2.2, -1.8, -1.4, -1.0];
for (const x of X) for (const y of Y) for (const z of Z) for (const f of F) {
  const rot = { r_upper: [x, y, z], r_fore: [f, 0, 0] }, s = score(rot);
  const cost = s.bad + 0.2 * s.hand + (s.head < 2 ? 500 * (2 - s.head) : 0) + (s.tilt[0] < 10 ? 50 * (10 - s.tilt[0]) : 0) + (s.tilt[1] > 40 ? 50 * (s.tilt[1] - 40) : 0);
  res.push({ rot, s, cost });
}
res.sort((a, b) => a.cost - b.cost);
for (const r of res.slice(0, 12)) console.log(JSON.stringify(r.rot), JSON.stringify(r.s), r.cost.toFixed(0));
console.log('current', JSON.stringify(score({})));
