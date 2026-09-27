// Source meshes for the Blender bake of the vertical double-volute member of the composite capital (D-306; BLENDER_PLAN row 1).
// As protome.ts, from the project's own model (src/arch/sculpt_models.ts voluteSDF, sculpture.json volute, unit D, the member
// generated at the Apadana's proportions: sculpt.ts sculptParams voluteH, SITE_SPEC capital_boxes.volute):
//  - high.ply: the member at a grid `cell` finer than the game's (volute.mc.cell), with the carving of the photographed
//    capitals (tools/blender/carving.json volute): the ends of the rolls carry a TWELVE-PETALLED ROSETTE in a plain disc
//    inside a raised rim (the Gate of All Nations' standing column, fars-assets/photos/gate_of_all_nations/90454591: every
//    roll end on the broad faces), not the spiral channel the model cut (D-151; since D-306 sculpture.json volute.member.carve
//    is 0, so the game's pieces have plain disc ends, Q-841): the rosette, its rim and the raised rings round the rolls'
//    barrels on the narrow faces (same photograph) are relief on this surface only;
//  - lod0.ply, lod1.ply: the game's own meshes (public/generated/sculpt_volute_{0,1}.bin), the bake's targets.
// Usage: npx tsx tools/blender/sources/volute.ts <outDir> <cell> [carving=1]
import { mkdirSync, writeFileSync } from 'node:fs';
import S from '../../../src/data/sculpture.json';
import { pieceModel, sculptParams, piece, srow } from '../../../src/arch/sculpt';
import { SPEC } from '../../../src/arch/spec';
import { marchingCubes, sdfNormals, smoothstep } from '../../../src/arch/sdf';
import { writePLY } from '../lib/ply';
import { Relief, rosetteProfile, type Field } from '../lib/carving';
import CARVING from '../carving.json';

const [out, cellS, carveS] = process.argv.slice(2);
if (!out || !cellS) { console.error('usage: volute.ts <outDir> <cell> [carving]'); process.exit(2); }
const cell = +cellS, carving = carveS !== '0';
mkdirSync(out, { recursive: true });
const t0 = Date.now();
const cfg = srow<any>('volute', 'mc'), C = (CARVING as any).volute;
const prm = sculptParams(0), M = pieceModel('volute', prm, 0);
const V = (S as any).volute.member.v, [wx, wz] = (SPEC as any).global.r_column_proportions.v.capital_boxes.volute as number[], hv = prm.voluteH;
const t = V.relief * wx, rs = Math.min(wx * V.scroll_r, hv * V.scroll_r_max), rcx = wx / 2 - rs, eyeH = V.eye_h * t;
let F = M.f;
const log: Record<string, unknown> = { rs, rcx, hv, wx, wz };
if (carving) {
  const R = new Relief(0.05), RO = C.rosette, RI = C.rings;
  // the roll ends (|z| = wz/2, the broad faces), mirrored left/right and top/bottom: a rosette of RO.petals petals filling
  // RO.R of the roll's radius, inside a raised rim RO.rim wide at the disc's edge
  const ends: Field = {
    mask: (x, y, z) => (Math.abs(z) > wz / 2 - 0.02 ? 1 : 0),
    rel: (x, y) => {
      const du = Math.abs(x) - rcx, dv = y > hv / 2 ? y - (hv - rs) : rs - y, rr = Math.hypot(du, dv);
      if (rr > rs) return 0;
      const rim = RO.rim_h * rs * smoothstep(rs * (1 - RO.rim), rs * (1 - RO.rim * 0.6), rr) * (1 - smoothstep(rs * 0.97, rs, rr));
      return Math.max(rim, rosetteProfile(rr, Math.atan2(dv, du), rs * RO.R, RO.h * rs, RO.petals));
    },
  };
  R.field(ends, Math.max(RO.h, RO.rim_h) * rs);
  // the rolls' barrels (seen on the narrow faces, |x| > rcx): RI.n raised rings round each roll, evenly along its length
  const rings: Field = {
    mask: (x, y) => { const du = Math.abs(x) - rcx, dv = y > hv / 2 ? y - (hv - rs) : rs - y; return Math.abs(Math.hypot(du, dv) - rs) < 0.03 ? 1 : 0; },
    rel: (x, y, z) => {
      const L = wz, pitch = L / RI.n, u = ((((z + L / 2) / pitch) % 1) + 1) % 1 - 0.5; // -0.5..0.5 between ring centres
      const q = Math.abs(u) * pitch; return q < RI.w ? RI.h * rs * Math.sqrt(1 - (q / RI.w) ** 2) : 0;
    },
  };
  R.field(rings, RI.h * rs);
  F = R.apply(M.f);
  log.carving = { rosette: RO, rings: RI };
}
const raw = marchingCubes(F, M.min, M.max, cell);
const n = sdfNormals(raw, F, cfg.crease, cell * (cfg.normal_eps ?? 0.3), cfg.max_dev ?? 60);
const stats = {
  high: writePLY(`${out}/high.ply`, { pos: n.pos, nrm: n.nrm, idx: n.idx }),
  lod0: writePLY(`${out}/lod0.ply`, piece('volute', 0)),
  lod1: writePLY(`${out}/lod1.ply`, piece('volute', 1)),
  cell, eyeH, ...log, box: [M.min, M.max], ms: Date.now() - t0,
};
writeFileSync(`${out}/source.json`, JSON.stringify(stats, null, 1));
console.log(JSON.stringify(stats));
