// dev (D-229): bake the impostor atlas in node and print its size, the bake time and each frame's least coverage (over
// the 8 views and the adult dresses, and the child's)
// Usage: npx tsx tools/dev/imp_bake.ts
import { readFileSync } from 'node:fs';
import { decodeHumanAssets, meshoptSimplify } from '../../src/people/humanAssets';
import { buildOutfits } from '../../src/people/outfits';
import { bakeImpostors, FRAMES, IMP, IMP_DRESSES } from '../../src/people/impostors';

const b = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
for (let k = 0; k < 2; k++) { const at = bakeImpostors(A, O);
  console.log(`atlas ${at.W}×${at.H}, ${at.A.length} levels, baked in ${at.ms.toFixed(0)} ms; ${FRAMES.length} frames, ${(at.A.concat(at.B, at.N).reduce((s, l) => s + l.data.length, 0) / 1048576).toFixed(1)} MB (3 textures with mips)`);
  if (k) for (let f = 0; f < FRAMES.length; f++) { let ad = 1, ch = 1; IMP_DRESSES.forEach((d, di) => { for (let v = 0; v < IMP.views; v++) { const c = at.coverage[(di * FRAMES.length + f) * IMP.views + v]; if (d === 'child') ch = Math.min(ch, c); else ad = Math.min(ad, c); } });
    console.log(`  ${FRAMES[f].id.padEnd(16)} adult min ${ad.toFixed(3)} child min ${ch.toFixed(3)}`); } }
