// PARSA s17 V4 (D-510; B361): the Gate's W bulls from the licensed lamassu sculpt (D-365) and a licensed bull-head scan.
// No downloadable scan of a wingless Achaemenid bull colossus exists (B361), so the lamassu's bull body is kept and the
// human parts are replaced, in the colossus reference frame (x along the body, head +x; y up from the plinth; z across,
// +z the passage face), as colossus_scan.ts fits it:
//  - the wing above the back is pressed down onto a bull's top line (a rounded back rising to the withers);
//  - the wing on the flank is pressed onto the body under it (a smooth surface filled from the flank round it);
//  - the human head, crown, hair and beard are drawn into a point inside the new neck (a closed cap the neck covers);
//  - a bull's head and neck (tools/blender/scans/scans.json bull_head: a CC-BY scan of a bull-head sculpture) is set on the
//    shoulders, turned to face +x, scaled to a colossus head (~1 m poll to muzzle), its plinth cut off.
// Writes <out>/bull_body.ply and <out>/bull_head.ply for tools/blender/scans/bull_graft.py (Blender: the head smoothed and
// closed, both joined and voxel-remeshed into one carved surface), whose result colossus_scan.ts takes as a fitted source
// (`fitted:<ply>`). Tier C throughout (a modern sculpt reworked; the W bulls' heads are lost on the site).
// Usage: npx tsx tools/blender/scans/bull_from_lamassu.ts <outDir> [preview=0]
import { mkdirSync, writeFileSync } from 'node:fs';
import { srow } from '../../../src/arch/sculpt';
import { writePLY } from '../lib/ply';
import { scanFile, readGLB, weld, bbox, transform, filterFaces, normals, preview, merge, type Mesh } from './scanlib';

const [out, prevS] = process.argv.slice(2);
if (!out) { console.error('usage: bull_from_lamassu.ts <outDir> [preview]'); process.exit(2); }
mkdirSync(out, { recursive: true });
const t0 = Date.now();
const RB = srow<any>('colossus', 'reference_box'), BD = srow<any>('colossus', 'body');

// ---- the lamassu, fitted exactly as colossus_scan.ts fits it (hoof to crown top = RB.H, length pressed to RB.L)
const raw = weld(readGLB(scanFile('lamassu_hp')), 1e-4);
const [lo, hi] = bbox(raw.pos);
const s = RB.H / (hi[1] - lo[1]), sx = RB.L / ((hi[0] - lo[0]) * s);
const zs: number[] = []; for (let k = 0; k < raw.pos.length; k += 3) if (raw.pos[k + 1] < lo[1] + 0.2 * (hi[1] - lo[1])) zs.push(raw.pos[k + 2]);
zs.sort((a, b) => a - b); const zmid = zs[zs.length >> 1], cx = (lo[0] + hi[0]) / 2;
const lam = transform(raw, (x, y, z) => [(x - cx) * s * sx, (y - lo[1]) * s, BD.zc + (z - zmid) * s]);

// ---- the shapes read off the fitted sculpt's side view (tools/blender/scans/look.ts; REVIEWS/s17/terrace): metres
const ZS = BD.zc; // the legs' mid-plane: the spine's line in plan
/** the bull's top line (the back from the tail root to the withers) */
const top = (x: number) => x < 0.2 ? 3.03 : x < 1.1 ? 3.03 + 0.16 * Math.sin(((x - 0.2) / 0.9) * Math.PI / 2) : 3.19; // the withers low: the wing lay on the back's round
const topAt = (x: number, z: number) => top(x) - 1.1 * Math.max(0, z - ZS) ** 2 - 0.5 * Math.max(0, ZS - z) ** 2;
/** the wing's area on the flank in the side view (x, y): the leading edge down the shoulder, the feather tips' line */
const WING: [number, number][] = [[-0.45, 3.0], [0.3, 2.52], [0.87, 2.08], [1.5, 1.72], [2.12, 1.4], [2.16, 1.98], [1.95, 2.7], [1.72, 3.6], [1.3, 3.95], [0.4, 3.95], [-0.45, 3.5]];
const inPoly = (x: number, y: number, P: [number, number][]) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
/** the human head, crown, hair and beard (drawn into the new neck) */
const NECKX = 1.02, NECKY = 3.28;
const inHead = (x: number, y: number) => (x > NECKX && y > NECKY + (x - NECKX) * -0.18) || (x > 1.9 && y > 2.78);
const P_IN: [number, number, number] = [1.62, 3.2, ZS]; // inside the new neck

// ---- the body under the wing: the flank's outermost z on a 2 cm grid outside the wing, filled into it (Laplace)
const G = 0.02, X0 = -2.6, Y0 = -0.05, NX = Math.ceil(5.2 / G), NY = Math.ceil(5.7 / G);
const zmax = new Float32Array(NX * NY).fill(-Infinity), wingCell = new Uint8Array(NX * NY);
for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const x = X0 + (i + 0.5) * G, y = Y0 + (j + 0.5) * G; if (inPoly(x, y, WING) && !inHead(x, y)) wingCell[j * NX + i] = 1; }
const P = lam.pos;
for (let v = 0; v < P.length / 3; v++) {
  const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
  if (inHead(x, y) || y > topAt(x, z) + 0.02) continue;
  const i = Math.floor((x - X0) / G), j = Math.floor((y - Y0) / G); if (i < 0 || j < 0 || i >= NX || j >= NY || wingCell[j * NX + i]) continue;
  if (z > zmax[j * NX + i]) zmax[j * NX + i] = z;
}
const zb = new Float32Array(NX * NY);
let unknown = 0; for (let k = 0; k < zb.length; k++) { zb[k] = wingCell[k] ? 0.4 : zmax[k]; if (wingCell[k]) unknown++; }
for (let it = 0; it < 1500; it++) { // Jacobi relaxation of the wing's cells from their neighbours that have a surface
  for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) { const k = j * NX + i; if (!wingCell[k]) continue;
    let sum = 0, n = 0; for (const q of [k - 1, k + 1, k - NX, k + NX]) { const w = zb[q]; if (w > -1e9) { sum += w; n++; } }
    if (n) zb[k] = sum / n; }
}
const zAt = (x: number, y: number) => { // bilinear on the cell centres
  const fx = (x - X0) / G - 0.5, fy = (y - Y0) / G - 0.5, i = Math.max(0, Math.min(NX - 2, Math.floor(fx))), j = Math.max(0, Math.min(NY - 2, Math.floor(fy))), u = fx - i, w = fy - j;
  const g = (a: number, b: number) => { const z = zb[b * NX + a]; return z > -1e9 ? z : NaN; };
  const c = [g(i, j), g(i + 1, j), g(i, j + 1), g(i + 1, j + 1)], wt = [(1 - u) * (1 - w), u * (1 - w), (1 - u) * w, u * w];
  let s2 = 0, n = 0; for (let k = 0; k < 4; k++) if (!isNaN(c[k])) { s2 += c[k] * wt[k]; n += wt[k]; } return n ? s2 / n : NaN;
};

// ---- press, clamp and collapse
const body = new Float32Array(P);
let nWing = 0, nTop = 0, nHead = 0;
for (let v = 0; v < P.length / 3; v++) {
  let x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
  if (inHead(x, y)) { // drawn into the neck: the further past the cut, the nearer the point (a closed cap)
    const d = Math.min(1, 0.35 + 0.65 * Math.min(1, Math.max(0, y - NECKY) / 0.6, 1));
    x += (P_IN[0] - x) * d; y += (P_IN[1] - y) * d; z += (P_IN[2] - z) * d; nHead++;
  } else {
    if (x > -1.85 && x < NECKX + 0.15) { const t = topAt(x, z); if (y > t) { y = t; nTop++; } }
    if (inPoly(x, y, WING)) { const zz = zAt(x, y); if (!isNaN(zz) && z > zz) { z = zz; nWing++; } }
  }
  body[v * 3] = x; body[v * 3 + 1] = y; body[v * 3 + 2] = z;
}
const bodyM: Mesh = { pos: body, idx: lam.idx };

// ---- the bull's head: the bust's plinth off (y < 0.36), turned to face +x (its muzzle is +z), scaled and set on the neck
const hraw = weld(readGLB(scanFile('bull_head')), 1e-5);
const HEAD_S = 2.0, CUT = 0.36, YAW = Math.atan2(0.259, 0.268); // the bust turns its muzzle 44 degrees off +x toward +z (read off the scan: the muzzle tip against the neck axis); its plinth top y
const hcut = filterFaces(hraw, (_x, y) => y > CUT);
const NA: [number, number, number] = [1.6, 2.85, ZS]; // the neck axis at the plinth cut (inside the shoulders)
const [hn0, hn1] = ((): [number, number] => { let x = 0, z = 0, n = 0; for (let k = 0; k < hraw.pos.length; k += 3) if (hraw.pos[k + 1] > 0.37 && hraw.pos[k + 1] < 0.42) { x += hraw.pos[k]; z += hraw.pos[k + 2]; n++; } return [x / n, z / n]; })();
const head = transform(hcut, (x, y, z) => { const a = x - hn0, b = z - hn1, c = Math.cos(YAW), sn = Math.sin(YAW); return [NA[0] + (a * c + b * sn) * HEAD_S, NA[1] + (y - CUT) * HEAD_S, NA[2] + (-a * sn + b * c) * HEAD_S]; });
const [hl, hh] = bbox(head.pos);

const stats = {
  lam_tris: lam.idx.length / 3, scale: s, press_x: sx, zmid, wing_cells: unknown, pressed: { wing: nWing, top: nTop, head: nHead },
  head_tris: head.idx.length / 3, head_box: [hl.map(v => +v.toFixed(3)), hh.map(v => +v.toFixed(3))],
  body: writePLY(`${out}/bull_body.ply`, normals(bodyM)), head: writePLY(`${out}/bull_head.ply`, normals(head)), ms: Date.now() - t0,
};
writeFileSync(`${out}/bull_from_lamassu.json`, JSON.stringify(stats, null, 1));
console.log(JSON.stringify(stats));
if (prevS && prevS !== '0') {
  const all = merge([bodyM, head]);
  await preview(`${out}/prev_side.png`, all, [0, 0, -1]);
  await preview(`${out}/prev_q.png`, all, [-0.7, -0.15, -0.7]);
  await preview(`${out}/prev_front.png`, all, [-1, 0, 0]);
}
if (prevS === '2') { // the wing's area close: from above and from the passage, cropped
  const all = merge([bodyM, head]);
  await preview(`${out}/prev_top.png`, all, [0, -1, 0.001], 900, 900, { up: [0, 0, -1] });
  await preview(`${out}/prev_wing.png`, all, [0, 0, -1], 900, 900, { box: [[-1, 1.4, -0.8], [2.4, 4.4, 1]] });
}
if (process.env.DBG) { const [bx0, bx1, by0, by1] = process.env.DBG.split(',').map(Number); const zz: number[] = [], zo: number[] = [], zbv: number[] = [];
  for (let v = 0; v < P.length / 3; v++) { const x = body[v * 3], y = body[v * 3 + 1]; if (x > bx0 && x < bx1 && y > by0 && y < by1) { zz.push(body[v * 3 + 2]); zo.push(P[v * 3 + 2]); zbv.push(zAt(x, y)); } }
  const q = (a: number[]) => { const b = [...a].sort((u, w) => u - w); return [0, 0.1, 0.5, 0.9, 1].map(f => +b[Math.min(b.length - 1, Math.floor(f * b.length))].toFixed(3)); };
  console.error('n', zz.length, 'z after', q(zz), 'z before', q(zo), 'zbody', q(zbv.filter(x => !isNaN(x)))); }
