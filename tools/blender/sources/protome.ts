// Source meshes for the Blender bake of the double-bull protome (the upper member of the bull and composite capitals,
// D-018/D-151; hero asset of D-305). Everything comes from the project's own model, nothing is drawn by hand in Blender:
//  - high.ply: the protome's signed-distance model (src/arch/sculpt_models.ts protomeSDF, proportions src/data/sculpture.json,
//    tier C) polygonised by marching cubes on a grid `cell` (D units) finer than the game's LOD0 grid (sculpture.json
//    protome.mc.cell), with analytic SDF normals, and its snail locks laid as the lock template at `lockTris` triangles
//    (the game's LOD0 carries them at mc.lock_tris). This is the carving the bake transfers.
//  - lod0.ply, lod1.ply: the game's own meshes (public/generated/sculpt_protome_{0,1}.bin, tools/build_sculpt.ts): the bake's
//    targets, so the silhouette, the triangle budgets (sculpture.json mc.lod0/lod1) and the instance fitting are unchanged and
//    the maps add only what the triangles cannot carry.
// Usage: npx tsx tools/blender/sources/protome.ts <outDir> <cell> <lockTris>
import { mkdirSync, writeFileSync } from 'node:fs';
import { pieceModel, sculptParams, piece, lockMeshes, srow } from '../../../src/arch/sculpt';
import { marchingCubes, sdfNormals, mergeNorm } from '../../../src/arch/sdf';
import { writePLY } from '../lib/ply';

const [out, cellS, lockS] = process.argv.slice(2);
if (!out || !cellS || !lockS) { console.error('usage: protome.ts <outDir> <cell> <lockTris>'); process.exit(2); }
const cell = +cellS, lockTris = +lockS;
mkdirSync(out, { recursive: true });
const t0 = Date.now();
const cfg = srow<any>('protome', 'mc');
const M = pieceModel('protome', sculptParams(0), 0);
const raw = marchingCubes(M.f, M.min, M.max, cell);
const n = sdfNormals(raw, M.f, cfg.crease, cell * (cfg.normal_eps ?? 0.3), cfg.max_dev ?? 60);
const body = { pos: n.pos, nrm: n.nrm, idx: n.idx };
const high = M.locks ? mergeNorm([body, lockMeshes({ ...M.locks, tris: lockTris })]) : body;
const stats = {
  high: writePLY(`${out}/high.ply`, high),
  lod0: writePLY(`${out}/lod0.ply`, piece('protome', 0)),
  lod1: writePLY(`${out}/lod1.ply`, piece('protome', 1)),
  cell, lockTris, box: [M.min, M.max], ms: Date.now() - t0,
};
writeFileSync(`${out}/source.json`, JSON.stringify(stats, null, 1));
console.log(JSON.stringify(stats));
