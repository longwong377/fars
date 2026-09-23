// dev: people's budgets in node (D-093 bands; D-155 before/after): triangles per costume and LOD, the vertex-source and
// skin-atlas memory, and the 300-person stress view (tests/humans_runtime.test.ts's crowd: 300 people 2–60 m in view,
// and the lab's: 300 people 2–20 m): draws and main-pass triangles by LOD band, shadow draws and triangles per map.
// Run from a tree's root: npx tsx tools/dev/human_budget.ts [out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets, meshoptSimplify } from '../../src/people/humanAssets';
import { buildOutfits, BUILT } from '../../src/people/outfits';
import { HumanGPU } from '../../src/people/humanGPU';
import { Crowd } from '../../src/people/crowd';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { decodePNG } from '../humans/png';

const D = 'public/generated/humans';
const b = readFileSync(`${D}/humans.bin`);
const A = decodeHumanAssets(JSON.parse(readFileSync(`${D}/humans.json`, 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
await MeshoptSimplifier.ready;
const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
const out: any = { costumes: {}, sourceMB: +(O.source.byteLength / 1e6).toFixed(2), NV: O.NV };
for (const d of BUILT) out.costumes[d] = O.costumes[d].map(c => c.triangles);
const skin = decodePNG(readFileSync(`${D}/skin.png`)); const mip = (w: number, h: number) => w * h * 4 * 4 / 3;
out.skinTexture = { w: skin.width, h: skin.height, gpuMBwithMips: +(mip(skin.width, skin.height) / 1e6).toFixed(2) };
const stress = (near: number, far: number) => {
  const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 64 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
  const crowd = new Crowd(null, 1, humans);
  const specs = ['guard', 'median', 'persian', 'worker', 'woman', 'child'] as const, anims = ['walk', 'idle', 'guard', 'chisel', 'grind', 'talk', 'sit', 'carry_shoulder'] as const;
  for (let i = 0; i < 300; i++) { const dress = specs[i % 6]; const d = near + (far - near) * Math.sqrt((i + 0.5) / 300), a = ((i * 0.618) % 1 - 0.5) * 1.2;
    crowd.addExtra(`x${i}`, { id: i, sex: dress === 'woman' ? 'f' : 'm', role: dress === 'guard' ? 'guard' : dress === 'child' ? 'child' : 'mason', dress, seed: 5000 + i, x: d * Math.sin(a), y: 0, z: -d * Math.cos(a), yaw: i, anim: anims[i % anims.length] } as any); }
  const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 5000); cam.position.set(0, 1.6, 0); cam.lookAt(0, 1.2, -10); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  for (let f = 0; f < 5; f++) crowd.update(f / 30, cam.position, cam.position, cam);
  const st = crowd.stats(), g = humans.gpu.stats();
  return { people: st.people, byLod: st.byLod, draws: st.draws, trianglesMain: st.triangles, shadowDraws: g.shadowDraws, shadowTrianglesPerMap: g.shadowTriangles };
};
out.stress_2_60m = stress(2, 60); out.stress_2_20m = stress(2, 20);
console.log(JSON.stringify(out, null, 1));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
