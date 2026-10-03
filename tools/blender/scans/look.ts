// PARSA s14 (D-365): node preview of a scan GLB from the six axis directions (no Blender, no browser).
//   npx tsx tools/blender/scans/look.ts <in.glb> <outPrefix> [views=+x,-x,+z,-z,-y,q]
import { readGLB, bbox, preview } from './scanlib';
const [src, out, vs] = process.argv.slice(2);
const m = readGLB(src); const [lo, hi] = bbox(m.pos);
console.log('tris', m.idx.length / 3, 'verts', m.pos.length / 3, 'min', lo.map(v => +v.toFixed(3)), 'max', hi.map(v => +v.toFixed(3)));
const D: Record<string, [number, number, number]> = { '+x': [-1, 0, 0], '-x': [1, 0, 0], '+z': [0, 0, -1], '-z': [0, 0, 1], '-y': [0, -1, 0.001], q: [-0.6, -0.15, -0.8] };
for (const v of (vs ?? '+x,-x,+z,-z,-y,q').split(',')) await preview(`${out}_${v.replace('+', 'p').replace('-', 'n')}.png`, m, D[v], 900, 900, v === '-y' ? { up: [0, 0, -1] } : {});
