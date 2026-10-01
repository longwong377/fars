// PARSA s14 (D-365): node preview of a piece's signed-distance model (marching cubes at `cell`, no locks) from several sides,
// to iterate on the forms in seconds: npx tsx tools/blender/scans/look_sdf.ts <protome|colossus_bull|...> <cell> <outPrefix> [views]
import { pieceModel, sculptParams, sculptIndex, type PieceName } from '../../../src/arch/sculpt';
import { marchingCubes } from '../../../src/arch/sdf';
import { preview } from './scanlib';
const [name, cellS, out, vs] = process.argv.slice(2);
const M = pieceModel(name as PieceName, sculptParams(sculptIndex()!.params.colossusFront), 0);
const raw = marchingCubes(M.f, M.min, M.max, +cellS);
const m = { pos: Float32Array.from(raw.pos), idx: Uint32Array.from(raw.idx) };
const D: Record<string, [number, number, number]> = { '+x': [-1, 0, 0], '-x': [1, 0, 0], '+z': [0, 0, -1], '-z': [0, 0, 1], q: [-0.7, -0.15, -0.7], q2: [-0.35, 0.25, -0.9], top: [0, -1, 0.001] };
for (const v of (vs ?? '+z,+x,q').split(',')) await preview(`${out}_${v.replace('+', 'p').replace('-', 'n')}.png`, m, D[v], 800, 800, v === 'top' ? { up: [0, 0, -1] } : {});
console.log('tris', m.idx.length / 3);
