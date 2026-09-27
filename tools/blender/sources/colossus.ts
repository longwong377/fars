// Source meshes for the Blender bake of a Gate of All Nations doorway colossus (D-306; BLENDER_PLAN row 2). As protome.ts,
// everything comes from the project's own model; nothing is shaped by hand in Blender:
//  - high.ply: the colossus signed-distance model (src/arch/sculpt_models.ts colossusSDF, sculpture.json colossus, tier C; in
//    metres in the reference box) at the fore-part length the game's pieces were generated for (public/generated/sculpt.json
//    params.colossusFront), polygonised by marching cubes on a grid `cell` (m) finer than the game's (colossus.mc.cell), its
//    snail locks as the lock template at `lockTris` triangles, and the carving of the photographs (tools/blender/carving.json
//    colossus_<model>: collar, bead rows, mane; the lamassu's feather barbs and crown rosettes) as relief on this surface only;
//  - lod0.ply, lod1.ply: the game's own meshes (public/generated/sculpt_colossus_<model>_{0,1}.bin), the bake's targets.
// Usage: npx tsx tools/blender/sources/colossus.ts <outDir> <model: bull|lamassu> <cell> <lockTris> [carving=1]
import { mkdirSync, writeFileSync } from 'node:fs';
import { pieceModel, sculptParams, sculptIndex, piece, lockMeshes, srow, type PieceName } from '../../../src/arch/sculpt';
import { marchingCubes, sdfNormals, mergeNorm, smoothstep } from '../../../src/arch/sdf';
import { writePLY } from '../lib/ply';
import { buildRelief, type MotifSpec, type Field } from '../lib/carving';
import CARVING from '../carving.json';

const [out, modelS, cellS, lockS, carveS] = process.argv.slice(2);
if (!out || !modelS || !cellS || !lockS) { console.error('usage: colossus.ts <outDir> <bull|lamassu> <cell> <lockTris>'); process.exit(2); }
const name = `colossus_${modelS}` as PieceName, cell = +cellS, lockTris = +lockS;
mkdirSync(out, { recursive: true });
const t0 = Date.now();
const idx = sculptIndex(); if (!idx) throw new Error('public/generated/sculpt.json missing: npx tsx tools/build_sculpt.ts');
const cfg = srow<any>('colossus', 'mc');
const M = pieceModel(name, sculptParams(idx.params.colossusFront), 0);
const C = (CARVING as any)[name];
const carve = carveS !== '0' && C ? buildRelief(M.f, C.motifs as MotifSpec[], 0.12, 0.02) : null;
// fields (the lamassu): feather barbs on the wing's primaries and the petals of the crown's rosettes
if (carve && C.fields) for (const F of C.fields) {
  if (F.kind === 'barbs') {
    const WG = srow<any>('colossus', 'wing'), RB = srow<any>('colossus', 'reference_box'), zs = RB.W / 2 - WG.inset;
    // fine parallel grooves along each primary (the barbs), pitch F.pitch, depth F.h: carved on the wing's face only
    const fld: Field = {
      mask: (x, y, z) => {
        if (x > WG.x_split - WG.split_w || x < WG.x_back - 0.4 || z < zs - 0.08) return 0;
        // the wing's own band at this x (sculpt_models.ts colossusSDF wing): the barbs stay on the feathers, not the flank under them
        const t = Math.min(1, Math.max(0, (WG.x_front - x) / (WG.x_front - WG.x_back))), ylo = WG.lower[0] + (WG.lower[1] - WG.lower[0]) * t, yhi = WG.upper[0] + (WG.upper[1] - WG.upper[0]) * Math.pow(t, WG.upper_pow);
        return smoothstep(ylo, ylo + 0.03, y) * (1 - smoothstep(yhi - 0.03, yhi, y)) * smoothstep(zs - 0.08, zs - 0.03, z);
      },
      rel: (x, y) => { const t = ((y / F.pitch) % 1 + 1) % 1; return F.h * (0.5 + 0.5 * Math.cos(2 * Math.PI * t)) ** 0.6; },
    };
    carve.R.field(fld, F.h);
  } else if (F.kind === 'crown_rosettes') {
    const CR = srow<any>('colossus', 'crown'), BD = srow<any>('colossus', 'body');
    const fld: Field = {
      mask: (x, y, z) => (Math.abs(y - CR.rosette_y) < CR.rosette_r * 1.3 && Math.abs(Math.hypot(x - CR.c, z - BD.zc) - CR.r) < 0.08 ? 1 : 0),
      rel: (x, y, z) => {
        const px = x - CR.c, pz = z - BD.zc, a = Math.atan2(pz, px), step = (2 * Math.PI) / CR.rosettes, ai = Math.round(a / step) * step;
        const u = (a - ai) * CR.r, v = y - CR.rosette_y, rho = Math.hypot(u, v), R = CR.rosette_r * F.scale;
        if (rho > R) return 0;
        const ph = (((Math.atan2(v, u) * F.petals) / (2 * Math.PI)) % 1 + 1) % 1 - 0.5;
        return F.h * Math.max(0, 1 - Math.abs(ph) * 2.4) * Math.sin(Math.PI * Math.min(1, rho / R));
      },
    };
    carve.R.field(fld, F.h);
  }
}
const F = carve ? carve.R.apply(M.f, C.mirror ? (x, y, z) => [x, y, C.mirror.zc + Math.abs(z - C.mirror.zc)] : undefined) : M.f;
const raw = marchingCubes(F, M.min, M.max, cell);
const n = sdfNormals(raw, F, cfg.crease, cell * (cfg.normal_eps ?? 0.3), cfg.max_dev ?? 60);
const body = { pos: n.pos, nrm: n.nrm, idx: n.idx };
const high = M.locks ? mergeNorm([body, lockMeshes({ ...M.locks, tris: lockTris })]) : body;
const stats = {
  high: writePLY(`${out}/high.ply`, high),
  lod0: writePLY(`${out}/lod0.ply`, piece(name, 0)),
  lod1: writePLY(`${out}/lod1.ply`, piece(name, 1)),
  model: modelS, front: idx.params.colossusFront, cell, lockTris, carving: carve?.log ?? null, box: [M.min, M.max], ms: Date.now() - t0,
};
writeFileSync(`${out}/source.json`, JSON.stringify(stats, null, 1));
console.log(JSON.stringify(stats));
