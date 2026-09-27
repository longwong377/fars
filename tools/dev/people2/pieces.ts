// dev: per-piece triangles of every costume LOD (D-307)
import { readFileSync } from 'node:fs';
import { decodeHumanAssets, meshoptSimplify } from '../../../src/people/humanAssets';
import { buildOutfits, BUILT } from '../../../src/people/outfits';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { readPeopleModels } from '../../../src/people/peopleModels';
const b = readFileSync('public/generated/humans/humans.bin'); const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
await MeshoptSimplifier.ready;
const models = process.argv.includes('--procedural') ? null : readPeopleModels(f => { try { return readFileSync('public/' + f); } catch { return null; } });
const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier), models });
for (const d of BUILT) for (const C of O.costumes[d]) if (C.lod < 2) console.log(d, C.lod, C.triangles, JSON.stringify(C.pieceTris));
console.log('ms', Math.round(O.ms));
