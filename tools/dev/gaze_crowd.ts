// dev: gaze through the crowd path (lookFor → Crowd.update → palette), as the human lab frames a face: for each lineup
// spec and a few times, the angle between each eye's +Z axis (world) and the direction to the camera. Usage:
// npx tsx tools/dev/gaze_crowd.ts
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets, meshoptSimplify } from '../../src/people/humanAssets';
import { HB } from '../../src/people/humanFormat';
import { PALETTE_STRIDE } from '../../src/people/humanRig';
import { buildOutfits } from '../../src/people/outfits';
import { HumanGPU } from '../../src/people/humanGPU';
import { Crowd } from '../../src/people/crowd';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';

const b = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
await MeshoptSimplifier.ready;
const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 16 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
const crowd = new Crowd(null, 1, humans); const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 5000);
const specs = [{ dress: 'woman', sex: 'f', role: 'grinder', seed: 21 }, { dress: 'woman', sex: 'f', role: 'baker', seed: 22 }, { dress: 'child', sex: 'm', role: 'child', seed: 23 }, { dress: 'persian', sex: 'm', role: 'official', seed: 11 }, { dress: 'guard', sex: 'm', role: 'guard', seed: 12 }];
for (const sp of specs) for (const time of [0.1, 1.3, 2.9, 7.7]) {
  crowd.removeExtras();
  const p = crowd.addExtra('g', { id: -1, x: -1.2, y: 0, z: 0, yaw: 0, anim: 'idle', look: null, ...sp } as any);
  const s = p.look.scale, v = A.variants[p.look.variant], ey = v.eyeY * s, fz = 0.1 * s;
  cam.position.set(-1.2, ey + 0.01, fz + 0.5); cam.lookAt(-1.2, ey - 0.03, fz); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  p.extra!.look = [cam.position.x, cam.position.y, cam.position.z];
  crowd.update(time, cam.position, null, cam);
  const out: string[] = [];
  for (const bone of [HB.eye_l, HB.eye_r]) {
    const m = humans.gpu.palette.subarray(p.slot * PALETTE_STRIDE + bone * 12, p.slot * PALETTE_STRIDE + bone * 12 + 12);
    const jx = v.joints[bone * 3], jy = v.joints[bone * 3 + 1], jz = v.joints[bone * 3 + 2];
    const ec = [m[0] * jx + m[1] * jy + m[2] * jz + m[3], m[4] * jx + m[5] * jy + m[6] * jz + m[7], m[8] * jx + m[9] * jy + m[10] * jz + m[11]];
    const ew = [-1.2 + s * ec[0], s * ec[1], s * ec[2]];
    const g = [m[2], m[6], m[10]], d = [cam.position.x - ew[0], cam.position.y - ew[1], cam.position.z - ew[2]];
    const ang = Math.acos((g[0] * d[0] + g[1] * d[1] + g[2] * d[2]) / Math.hypot(...g) / Math.hypot(...d)) * 180 / Math.PI;
    out.push(`${bone === HB.eye_l ? 'L' : 'R'} ${ang.toFixed(1)}°`);
  }
  const hm = humans.gpu.palette.subarray(p.slot * PALETTE_STRIDE + HB.head * 12); const headYaw = Math.atan2(hm[2], hm[10]) * 180 / Math.PI;
  console.log(`${sp.dress}/${sp.seed} (${p.look.variantId}) t=${time}: head yaw ${headYaw.toFixed(1)}°, gaze off ${out.join(', ')}`);
}
