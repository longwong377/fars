// PARSA s14 (D-365; BLENDER_PLAN row 2, B118): source meshes for the Blender bake of a Gate colossus from a licensed sculpt
// or scan (tools/blender/scans/scans.json) instead of the project's signed-distance model. Writes, for tools/blender/bake.py:
//  - high.ply: the scan, welded, fitted into the colossus reference box (sculpture.json colossus.reference_box: x along the
//    body, head +x; y up from the plinth; z across, +z the passage face), simplified to `highTris`, with the jamb block;
//  - lod0.ply, lod1.ply: the same simplified to the game's budgets (sculpture.json lod.budget colossus_lod0/1) less the block.
// The fit: uniform scale so that hoof to crown top = the box height (D-312: the Gate's colossi measured plinth foot to crown
// top), the length then pressed to the box's L (a few per cent); the body's median plane (the legs' mid-plane) on
// colossus.body.zc; the faces that fall inside the jamb block behind the fore-part (x < the block's front face, z below the
// relief's cut-back ground) dropped, as the carvers left them in the stone. The jamb block itself is the colossusSDF's:
// a slab, the back frame and the top frame round a relief field cut back by jamb.relief_depth, the fore-part standing free.
// Usage: npx tsx tools/blender/scans/colossus_scan.ts <outDir> <model: bull|lamassu> <scanId> <highTris> [preview=0]
import { mkdirSync, writeFileSync } from 'node:fs';
import { srow, sculptIndex } from '../../../src/arch/sculpt';
import { writePLY } from '../lib/ply';
import { scanFile, readGLB, weld, bbox, filterFaces, transform, merge, normals, simplifyTo, preview, type Mesh, type NMesh } from './scanlib';

const [out, model, scanId, highS, prevS] = process.argv.slice(2);
if (!out || !model || !scanId || !highS) { console.error('usage: colossus_scan.ts <outDir> <bull|lamassu> <scanId> <highTris> [preview]'); process.exit(2); }
mkdirSync(out, { recursive: true });
const t0 = Date.now();
const RB = srow<any>('colossus', 'reference_box'), J = srow<any>('colossus', 'jamb'), BD = srow<any>('colossus', 'body'), BUD = srow<any>('lod', 'budget');
const idx = sculptIndex(); if (!idx) throw new Error('public/generated/sculpt.json missing: npx tsx tools/build_sculpt.ts');
const L2 = RB.L / 2, W2 = RB.W / 2, Ht = RB.H, front = idx.params.colossusFront, xf = L2 - front, zbg = W2 - J.relief_depth;
const rx0 = -L2 + J.frame_back, ry1 = Ht - J.frame_top;

// ---- the scan, fitted
const raw = weld(readGLB(scanFile(scanId)), 1e-4);
const [lo, hi] = bbox(raw.pos);
const s = Ht / (hi[1] - lo[1]), sx = RB.L / ((hi[0] - lo[0]) * s);
// the legs' mid-plane: the median z of the vertices in the lowest fifth (hooves and cannons)
const zs: number[] = []; for (let k = 0; k < raw.pos.length; k += 3) if (raw.pos[k + 1] < lo[1] + 0.2 * (hi[1] - lo[1])) zs.push(raw.pos[k + 2]);
zs.sort((a, b) => a - b); const zmid = zs[zs.length >> 1];
const cx = (lo[0] + hi[0]) / 2;
const fit0 = transform(raw, (x, y, z) => [(x - cx) * s * sx, (y - lo[1]) * s, BD.zc + (z - zmid) * s]);
// the sculpt is a gate colossus already: the fore-part in the round, the flank in relief off a flat back (its wall); that back
// is set 2 cm into the jamb's relief ground (the lowest z of the flank behind the block's front face)
let zback = Infinity; for (let k = 0; k < fit0.pos.length; k += 3) if (fit0.pos[k] > -L2 + 0.3 && fit0.pos[k] < xf - 0.2) zback = Math.min(zback, fit0.pos[k + 2]);
const dz = zbg - 0.02 - zback;
const fit = transform(fit0, (x, y, z) => [x, y, z + dz]);
// buried: behind the fore-part and below the relief's ground (a 3 cm margin keeps the meeting line in the high source)
const kept = filterFaces(fit, (x, y, z) => !(x < xf - 0.02 && z < zbg - 0.03));
const [flo, fhi] = bbox(kept.pos);

// ---- the jamb block (flat-shaded: four vertices a face)
function boxes(): NMesh {
  const B: [number, number, number, number, number, number][] = [
    [-L2, xf, 0, Ht, -W2, zbg], // the slab behind the relief's ground
    [-L2, rx0, 0, Ht, zbg, W2], // the back frame
    [rx0, xf, ry1, Ht, zbg, W2], // the top frame
  ];
  const pos: number[] = [], nrm: number[] = [], ix: number[] = [];
  const quad = (p: number[][], n: number[]) => { const b = pos.length / 3; for (const q of p) { pos.push(...q); nrm.push(...n); } ix.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  for (const [x0, x1, y0, y1, z0, z1] of B) {
    quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]); quad([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0]);
    quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0]); quad([[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], [0, -1, 0]);
    quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]); quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]);
  }
  return { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), idx: Uint32Array.from(ix) };
}
const block = boxes(), bt = block.idx.length / 3;
const withBlock = (m: NMesh): NMesh => { const g = merge([m, block]); const nrm = new Float32Array(g.pos.length); nrm.set(m.nrm); nrm.set(block.nrm, m.nrm.length); return { ...g, nrm }; };

const high = normals(await simplifyTo(kept, +highS));
const l0 = normals(await simplifyTo(kept, BUD.colossus_lod0 - bt - 200));
const l1 = normals(await simplifyTo(kept, BUD.colossus_lod1 - bt - 50, { error: 1 }));
const stats = {
  high: writePLY(`${out}/high.ply`, withBlock(high)), lod0: writePLY(`${out}/lod0.ply`, withBlock(l0)), lod1: writePLY(`${out}/lod1.ply`, withBlock(l1)),
  model, scan: scanId, scan_tris: raw.idx.length / 3, kept_tris: kept.idx.length / 3, scale: s, press_x: sx, zmid, zback, dz, front, box: [flo, fhi], ms: Date.now() - t0,
};
writeFileSync(`${out}/source.json`, JSON.stringify(stats, null, 1));
console.log(JSON.stringify(stats));
if (prevS && prevS !== '0') {
  const all = (m: Mesh) => merge([m, block]);
  await preview(`${out}/prev_lod0_side.png`, all(l0), [0, 0, -1]);
  await preview(`${out}/prev_lod0_q.png`, all(l0), [-0.7, -0.15, -0.7]);
  await preview(`${out}/prev_lod1_side.png`, all(l1), [0, 0, -1]);
  await preview(`${out}/prev_high_q.png`, all(high), [-0.7, -0.15, -0.7]);
}
