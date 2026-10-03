// PARSA s14 (D-365): node preview of a pipeline PLY (tools/blender/lib/ply.ts, game axes) from several sides
//   npx tsx tools/blender/scans/look_ply.ts <in.ply> <outPrefix> [views] [px]
import { readPLY } from '../lib/ply';
import { preview } from './scanlib';
const [src, out, vs, pxS] = process.argv.slice(2);
const m = readPLY(src), px = +(pxS ?? 900);
const D: Record<string, [number, number, number]> = { '+x': [-1, 0, 0], '-x': [1, 0, 0], '+z': [0, 0, -1], '-z': [0, 0, 1], q: [-0.7, -0.15, -0.7], q2: [-0.35, 0.25, -0.9], qlow: [-0.6, 0.35, -0.75], top: [0, -1, 0.001] };
for (const v of (vs ?? '+z,q').split(',')) await preview(`${out}_${v.replace('+', 'p').replace('-', 'n')}.png`, m, D[v], px, px, v === 'top' ? { up: [0, 0, -1] } : {});
console.log('tris', m.idx.length / 3);
