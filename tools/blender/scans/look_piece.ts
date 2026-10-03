// PARSA s14 (D-365): node preview of one of the game's sculpted pieces (public/generated/sculpt_<name>_<lod>.bin)
//   npx tsx tools/blender/scans/look_piece.ts <protome|volute|colossus_bull|colossus_lamassu> <lod> <outPrefix> [views]
import { piece, type PieceName } from '../../../src/arch/sculpt';
import { preview } from './scanlib';
const [name, lod, out, vs] = process.argv.slice(2);
const p = piece(name as PieceName, +lod as 0 | 1);
const m = { pos: Float32Array.from(p.pos), idx: Uint32Array.from(p.idx) };
const D: Record<string, [number, number, number]> = { '+x': [-1, 0, 0], '-x': [1, 0, 0], '+z': [0, 0, -1], '-z': [0, 0, 1], q: [-0.7, -0.15, -0.7], q2: [-0.45, 0.1, -0.9] };
for (const v of (vs ?? '+z,+x,q').split(',')) await preview(`${out}_${v.replace('+', 'p').replace('-', 'n')}.png`, m, D[v], 800, 800);
console.log('tris', m.idx.length / 3);
