// dev (D-229): bake the impostor atlas in node and print its size, the bake time and each frame's least coverage (over
// the 8 views and the adult dresses, and the child's)
// Usage: npx tsx tools/dev/imp_bake.ts [--raw sheet.raw]
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeHumanAssets, meshoptSimplify } from '../../src/people/humanAssets';
import { buildOutfits } from '../../src/people/outfits';
import { bakeImpostors, FRAMES, IMP, IMP_DRESSES, cellAt, rowOf } from '../../src/people/impostors';

const b = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
for (let k = 0; k < 2; k++) { const at = bakeImpostors(A, O);
  console.log(`atlas ${at.W}×${at.H}, ${at.A.length} levels, baked in ${at.ms.toFixed(0)} ms; ${FRAMES.length} frames, ${(at.A.concat(at.B, at.N).reduce((s, l) => s + l.data.length, 0) / 1048576).toFixed(1)} MB (3 textures with mips)`);
  if (k) for (let f = 0; f < FRAMES.length; f++) { let ad = 1, ch = 1; IMP_DRESSES.forEach((d, di) => { for (let v = 0; v < IMP.views; v++) { const c = at.coverage[(di * FRAMES.length + f) * IMP.views + v]; if (d === 'child') ch = Math.min(ch, c); else ad = Math.min(ad, c); } });
    console.log(`  ${FRAMES[f].id.padEnd(16)} adult min ${ad.toFixed(3)} child min ${ch.toFixed(3)}`); } }
// --raw <file>: the worker dress's frames, views 0 and 2, as a sheet of raw RGBA, 14 frames a row (main garment red, skin
// green, else blue-grey) for a quick look (python: Image.frombytes('RGBA', (w, h), data))
const pi = process.argv.indexOf('--raw');
if (pi > 0) { const at = bakeImpostors(A, O); const C = IMP.cell, cols = 14, SW = cols * 2 * C, SH = Math.ceil(FRAMES.length / cols) * C, out = new Uint8Array(SW * SH * 4);
  FRAMES.forEach((_, f) => { for (const [k, v] of [[0, 0], [1, 2]]) { const [x0, y0] = cellAt(rowOf('worker', f), v), ox = ((f % cols) * 2 + k) * C, oy = Math.floor(f / cols) * C;
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) { const s = ((y0 + j) * at.W + x0 + i) * 4, d = ((oy + C - 1 - j) * SW + ox + i) * 4, a = at.A[0].data, b = at.B[0].data, cov = a[s + 3] >= 128;
      out[d] = cov ? Math.max(a[s], 60) : 25; out[d + 1] = cov ? Math.max(b[s], 60) : 25; out[d + 2] = cov ? 110 : 35; out[d + 3] = 255; } } });
  writeFileSync(process.argv[pi + 1], out); console.log('wrote', process.argv[pi + 1], SW, SH); }
