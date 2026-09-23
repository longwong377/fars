// dev: build the costumes in node and write orthographic previews (bind pose and a posed frame) to shots/outfit_*.png.
// Verification aid for src/people/outfits.ts (screenshots find problems; tests/outfits.test.ts measures).
// Run: npx tsx tools/dev/outfit_preview.ts [dress,…] [variant] [anim]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { buildOutfits, DRESSES, COSTUMES, pieceBit, type Dress } from '../../src/people/outfits';
import { RigSolver, PALETTE_STRIDE, skinPoint } from '../../src/people/humanRig';
import { pose, type AnimId } from '../../src/people/anim';
import { MAT } from '../../src/people/humanFormat';
import { preview } from '../humans/raster';
import { encodePNG } from '../humans/png';

const D = 'public/generated/humans';
const b = readFileSync(`${D}/humans.json`), bin = readFileSync(`${D}/humans.bin`);
const A = decodeHumanAssets(JSON.parse(b.toString()), bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
const dresses = (process.argv[2]?.split(',') ?? DRESSES) as Dress[];
const vid = process.argv[3] ?? 'm03', anim = (process.argv[4] ?? 'walk') as AnimId;
const O = buildOutfits(A);
console.log(`built in ${O.ms.toFixed(0)} ms; NV ${O.NV}; source ${(O.source.byteLength / 1e6).toFixed(1)} MB`);
const v = A.byId[vid];
const COLS: Record<number, [number, number, number]> = { [MAT.skin]: [220, 170, 140], [MAT.cloth_main]: [170, 60, 50], [MAT.cloth_second]: [60, 80, 150], [MAT.cloth_trim]: [220, 190, 80], [MAT.eye]: [250, 250, 250], [MAT.hair]: [50, 40, 35],
  [MAT.teeth]: [240, 240, 220], [MAT.mouth]: [150, 60, 60], [MAT.leather]: [120, 80, 50], [MAT.felt]: [150, 140, 110], [MAT.metal]: [230, 200, 90], [MAT.lash]: [20, 20, 20], [MAT.wood]: [120, 90, 60], [MAT.wicker]: [170, 150, 100] };
mkdirSync('shots', { recursive: true });
for (const d of dresses) {
  const C = O.costumes[d][0]; const all = (1 << (COSTUMES[d].opt.length + 1)) - 1;
  const keep = (dress: Dress) => { const m = new Set(['hair', 'bun', 'beard_long', 'hat_fluted', 'cap_soft', 'headcloth', 'work_trousers', 'shoes', 'akinaka', 'gorytos', 'torque', 'kandys']); if (dress === 'woman') m.delete('hair_bob'); let mask = 1; for (const id of COSTUMES[dress].opt) if (m.has(id)) mask |= 1 << pieceBit(dress, id); return mask; };
  const mask = keep(d); void all;
  // bind positions for this variant
  const n = C.tid.length, pos = new Float32Array(n * 3); const src = O.source, base = v.index * O.NV * 4;
  for (let k = 0; k < n; k++) { const t = C.tid[k]; pos.set([src[base + t * 4], src[base + t * 4 + 1], src[base + t * 4 + 2]], k * 3); }
  const visible = (tri: number) => { const bit = C.hmat[C.index[tri * 3] * 4 + 2]; return ((mask >> bit) & 1) === 1; };
  const idx = Array.from(C.index).filter((_, i) => visible(Math.floor(i / 3)));
  const idxTri: number[] = []; for (let t = 0; t < C.index.length / 3; t++) if (visible(t)) idxTri.push(t);
  const col = (t: number) => COLS[C.hmat[idx[t * 3] * 4]] ?? [255, 0, 255];
  for (const view of ['front', 'side', 'back'] as const) writeFileSync(`shots/outfit_${d}_${vid}_${view}.png`, encodePNG(360, 720, preview([{ pos, index: idx, color: col }], view, 360, 720, { cx: 0, cy: 0.9, half: 0.5 }), 4));
  writeFileSync(`shots/outfit_${d}_${vid}_head.png`, encodePNG(400, 400, preview([{ pos, index: idx, color: col }], 'front', 400, 400, { cx: 0, cy: v.eyeY, half: 0.16 }), 4));
  writeFileSync(`shots/outfit_${d}_${vid}_headside.png`, encodePNG(400, 400, preview([{ pos, index: idx, color: col }], 'side', 400, 400, { cx: -0.05, cy: v.eyeY - 0.04, half: 0.2 }), 4));
  // posed
  const rig = new RigSolver(A.meta.curlAxes); const pal = new Float32Array(PALETTE_STRIDE);
  const inp = { joints: v.joints, pose: pose(anim, 1.3, 1.2, 0.3), face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: [0, 0] as [number, number], x: 0, y: 0, z: 0, yaw: 0, scale: 1 };
  rig.setPose(inp); rig.solve(inp, pal, 0);
  const pp = new Float32Array(n * 3); const o = [0, 0, 0];
  for (let k = 0; k < n; k++) { skinPoint(pal, 0, C.skinIndex.subarray(k * 4, k * 4 + 4), Array.from(C.skinWeight.subarray(k * 4, k * 4 + 4), x => x / 255), pos.subarray(k * 3, k * 3 + 3), o); pp.set(o, k * 3); }
  for (const view of ['front', 'side'] as const) writeFileSync(`shots/outfit_${d}_${vid}_${anim}_${view}.png`, encodePNG(360, 720, preview([{ pos: pp, index: idx, color: col }], view, 360, 720, { cx: 0, cy: 0.9, half: 0.5 }), 4));
  console.log(d, O.costumes[d].map(c => `LOD${c.lod}: ${c.triangles} tris (body ${c.bodyTriangles}), ${c.tid.length} verts`).join(' | '), JSON.stringify(O.costumes[d][0].pieceTris));
}
