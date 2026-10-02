// V5 D-520: the gear of a pack or riding animal (the anatomy's 'gear' parts: pack saddle, panniers, sacks, ropes, saddle cloth;
// src/people/animalForm.ts) alone, polygonised and coloured, for tools/blender/animals_real.py to set on a library model's back
// (gear.ply in Blender's axes, RGBA sRGB colours as animal.ts; gear.json: where the gear sits and the anatomy's back there).
// Usage: npx tsx tools/blender/sources/animal_gear.ts <outDir> <species> <cell>
import { mkdirSync, writeFileSync } from 'node:fs';
import { marchingCubes } from '../../../src/arch/sdf';
import { animalForm, evalForm, formSDF, coat, type Eval, type V3 } from '../../../src/people/animalForm';
import { ANIMAL_BUILD, type Species } from '../../../src/people/animals';

const [out, spS, cS] = process.argv.slice(2);
const sp = spS as Species, cell = +(cS ?? 0.006);
mkdirSync(out, { recursive: true });
const F0 = animalForm(sp), prims = F0.prims.filter(p => p.group === 'gear');
if (!prims.length) { console.error(`${sp} has no gear`); process.exit(2); }
const F = { ...F0, prims, subs: [] }, f = formSDF(F);
let lo: V3 = [1e9, 1e9, 1e9], hi: V3 = [-1e9, -1e9, -1e9];
for (const p of prims) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p.c[k] - p.R); hi[k] = Math.max(hi[k], p.c[k] + p.R); }
lo = lo.map(v => v - 0.03) as V3; hi = hi.map(v => v + 0.03) as V3;
const m = marchingCubes(f, lo, hi, cell), n = m.pos.length / 3, col = new Uint8Array(n * 4), e: Eval = { d: 0, part: 'coat', group: 'gear' };
const toS = (c: number) => { c = Math.max(0, Math.min(1, c)); const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055; return Math.round(s * 255); };
for (let i = 0; i < n; i++) { const x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2]; evalForm(F, x, y, z, e);
  const c = coat(F, [x, y, z], e.part, e.group, e.tag); col[i * 4] = toS(c[0]); col[i * 4 + 1] = toS(c[1]); col[i * 4 + 2] = toS(c[2]); col[i * 4 + 3] = 255; }
const nv = n, nf = m.idx.length / 3;
const head = `ply\nformat binary_little_endian 1.0\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nproperty uchar alpha\nelement face ${nf}\nproperty list uchar int vertex_indices\nend_header\n`;
const body = Buffer.alloc(nv * 16 + nf * 13); let o = 0;
for (let v = 0; v < nv; v++) { body.writeFloatLE(m.pos[v * 3], o); body.writeFloatLE(-m.pos[v * 3 + 2], o + 4); body.writeFloatLE(m.pos[v * 3 + 1], o + 8); o += 12; for (let k = 0; k < 4; k++) body.writeUInt8(col[v * 4 + k], o + k); o += 4; }
for (let t = 0; t < nf; t++) { body.writeUInt8(3, o); o += 1; for (let k = 0; k < 3; k++) { body.writeInt32LE(m.idx[t * 3 + k], o); o += 4; } }
writeFileSync(`${out}/gear.ply`, Buffer.concat([Buffer.from(head, 'ascii'), body]));
// where the gear rides: its parts' mean z, and the anatomy's back there (the torso's top: animalForm backY over the barrel)
const B = ANIMAL_BUILD[sp], zc = prims.reduce((a, p) => a + p.c[2], 0) / prims.length;
const back = B.h - B.girth * 0.5 + B.girth * 0.52 * Math.sqrt(Math.max(0, 1 - (zc / (B.len * 0.5)) ** 2));
writeFileSync(`${out}/gear.json`, JSON.stringify({ sp, z: zc, back, tris: nf }));
console.log(`[gear] ${sp}: ${nf} tris, z ${zc.toFixed(3)}, back ${back.toFixed(3)}`);
