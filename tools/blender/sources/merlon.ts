// D-330: the merlon's Blender job from the game's own merlon (src/arch/decor.ts crenellationGeometry at the Apadana's size,
// apadana.r_crenellation, its double-rebated slot apadana.r_merlon_slot, depth merlonModelDepth()): lod0.ply (the bake's
// target: the game's triangles unchanged) and job.json for tools/blender/decor_merlon.py (the high source) and bake.py.
//   npx tsx tools/blender/sources/merlon.ts <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { crenellationGeometry, merlonModelDepth } from '../../../src/arch/decor';
import { v } from '../../../src/arch/spec';
import { writePLY } from '../lib/ply';

const out = process.argv[2]; if (!out) throw new Error('usage: merlon.ts <outDir>');
mkdirSync(out, { recursive: true });
const C = v<any>('apadana', 'r_crenellation'), g = crenellationGeometry(C.width, C.height, C.steps, merlonModelDepth());
const P = g.getAttribute('position'), N = g.getAttribute('normal'), n = P.count;
const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), idx = new Uint32Array(n);
for (let i = 0; i < n; i++) { pos.set([P.getX(i), P.getY(i), P.getZ(i)], i * 3); nrm.set([N.getX(i), N.getY(i), N.getZ(i)], i * 3); idx[i] = i; }
const s = writePLY(`${out}/lod0.ply`, { pos, nrm, idx } as any);
writeFileSync(`${out}/job.json`, JSON.stringify({ low: `${out}/lod0.ply`, high: `${out}/high.ply`, w: C.width, h: C.height, steps: C.steps, depth: merlonModelDepth(),
  // the weathering of the high source (C): the arrises worn round, chips knocked out of them, the faces' pitting
  bevel: 0.007, chips_per_m: 7, chip_len: [0.012, 0.045], chip_across: [0.006, 0.016], voxel: 0.0025, pits: { scale: 0.012, strength: 0.0004 }, grain: { scale: 0.0035, strength: 0.00015 }, seed: 330 }, null, 1));
console.log('[merlon] lod0', s);
