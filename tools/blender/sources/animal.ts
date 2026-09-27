// Source meshes for the Blender build of one animal species (D-326; BLENDER_PLAN row 4). Everything comes from the project's
// own anatomy (src/people/animalForm.ts, sized by animals.ts ANIMAL_BUILD / animalFrame); nothing is shaped by hand:
//  - high.ply: the anatomy's signed-distance surface polygonised by marching cubes at `cellHigh` (m), each vertex pushed out
//    along its normal by the coat's relief (hair streaks, fleece locks, mane and tail strands, feathers, horn rings, the
//    wicker's weave: animalForm.relief) and coloured with the coat's albedo and mask (RGBA: animalForm.coat; RGB sRGB-encoded,
//    A linear), the bake's source of normals, occlusion and colour;
//  - base.ply: the same surface without relief at `cellBase`, which Blender decimates into the game's levels.
// Usage: npx tsx tools/blender/sources/animal.ts <outDir> <species> <cellHigh> <cellBase>
import { mkdirSync, writeFileSync } from 'node:fs';
import { marchingCubes } from '../../../src/arch/sdf';
import { animalForm, evalForm, formSDF, relief, coat, type Eval, type V3 } from '../../../src/people/animalForm';
import type { Species } from '../../../src/people/animals';

const [out, spS, chS, cbS] = process.argv.slice(2);
if (!out || !spS || !chS || !cbS) { console.error('usage: animal.ts <outDir> <species> <cellHigh> <cellBase>'); process.exit(2); }
const sp = spS as Species, cellH = +chS, cellB = +cbS;
mkdirSync(out, { recursive: true });
const t0 = Date.now();
const F = animalForm(sp), f = formSDF(F);
const pad = 0.03, min: V3 = [F.min[0] - pad, -0.01, F.min[2] - pad], max: V3 = [F.max[0] + pad, F.max[1] + pad, F.max[2] + pad];

/** binary PLY in Blender's axes (game (x, y, z) -> Blender (x, -z, y), as lib/ply.ts), optional RGBA per vertex */
function writePLY(path: string, pos: Float32Array, idx: Uint32Array, col?: Uint8Array) {
  const nv = pos.length / 3, nf = idx.length / 3;
  const head = `ply\nformat binary_little_endian 1.0\ncomment PARSA tools/blender/sources/animal.ts\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\n${col ? 'property uchar red\nproperty uchar green\nproperty uchar blue\nproperty uchar alpha\n' : ''}element face ${nf}\nproperty list uchar int vertex_indices\nend_header\n`;
  const hb = Buffer.from(head, 'ascii'), vs = 12 + (col ? 4 : 0), body = Buffer.alloc(nv * vs + nf * 13); let o = 0;
  for (let v = 0; v < nv; v++) { body.writeFloatLE(pos[v * 3], o); body.writeFloatLE(-pos[v * 3 + 2], o + 4); body.writeFloatLE(pos[v * 3 + 1], o + 8); o += 12;
    if (col) { for (let k = 0; k < 4; k++) body.writeUInt8(col[v * 4 + k], o + k); o += 4; } }
  for (let t = 0; t < nf; t++) { body.writeUInt8(3, o); o += 1; for (let k = 0; k < 3; k++) { body.writeInt32LE(idx[t * 3 + k], o); o += 4; } }
  writeFileSync(path, Buffer.concat([hb, body]));
}
const toS = (c: number) => { c = Math.max(0, Math.min(1, c)); const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055; return Math.round(s * 255); };

// the base surface (the levels' source)
const base = marchingCubes(f, min, max, cellB);
writePLY(`${out}/base.ply`, base.pos, base.idx);
// the dense source with its relief and colours
const hi = marchingCubes(f, min, max, cellH);
const n = hi.pos.length / 3, col = new Uint8Array(n * 4), P = hi.pos, e: Eval = { d: 0, part: 'coat', group: 'body' }, h = cellH * 0.5;
const parts: Record<string, number> = {};
for (let i = 0; i < n; i++) {
  const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
  let gx = f(x + h, y, z) - f(x - h, y, z), gy = f(x, y + h, z) - f(x, y - h, z), gz = f(x, y, z + h) - f(x, y, z - h); const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
  evalForm(F, x, y, z, e); parts[e.part] = (parts[e.part] ?? 0) + 1;
  const p: V3 = [x, y, z], r = y < 0.004 ? 0 : relief(F, p, e.part, e.group); // (the soles stay on the ground)
  P[i * 3] = x + gx * r; P[i * 3 + 1] = Math.max(0, y + gy * r); P[i * 3 + 2] = z + gz * r;
  const c = coat(F, p, e.part, e.group, e.tag);
  col[i * 4] = toS(c[0]); col[i * 4 + 1] = toS(c[1]); col[i * 4 + 2] = toS(c[2]); col[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, c[3])) * 255);
}
writePLY(`${out}/high.ply`, P, hi.idx, col);
const stats = { sp, cellH, cellB, base: { verts: base.pos.length / 3, tris: base.idx.length / 3 }, high: { verts: n, tris: hi.idx.length / 3 }, parts, bounds: { min, max }, seconds: (Date.now() - t0) / 1000 };
writeFileSync(`${out}/source.json`, JSON.stringify(stats, null, 1));
console.log(`[animal] ${sp}: base ${stats.base.tris} tris, high ${stats.high.tris} tris, ${stats.seconds.toFixed(1)} s`);
