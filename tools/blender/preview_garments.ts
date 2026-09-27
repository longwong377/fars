// Node side of the garments' contact sheet (D-322): writes, per figure, the whole costume exactly as the game builds it
// (src/people/outfits.ts buildOutfits with the people's Blender assets: the settled drape of every piece, at a level of
// detail), on one body variant, with the chosen optional pieces shown, as a PLY with vertex colours by material class and
// colour slot; tools/blender/preview_garments.py renders a sheet in Cycles (front, three-quarter, side, back). Iteration and
// evidence of the geometry (the game's shading, hems and weave are not in it).
// Usage: npx tsx tools/blender/preview_garments.ts <outDir> <modelsDir|public> <dress:variant:lod:opt+opt> ...
//   e.g. shots/g/prev public persian:m03:0:hair+bun+beard_long woman:f02:1:headcloth
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { decodeHumanAssets, meshoptSimplify } from '../../src/people/humanAssets';
import { buildOutfits, COSTUMES, COSTUME_OF, pieceBit, type Dress } from '../../src/people/outfits';
import { readPeopleModels } from '../../src/people/peopleModels';
import { MAT } from '../../src/people/humanFormat';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';

const [out, mdir, ...specs] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const HD = 'public/generated/humans', bin = readFileSync(`${HD}/humans.bin`);
const A = decodeHumanAssets(JSON.parse(readFileSync(`${HD}/humans.json`, 'utf8')), bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);
const read = (f: string) => { try { return mdir === 'public' ? readFileSync(`public/${f}`) : readFileSync(`${mdir}/${f.split('/').pop()}`); } catch { return null; } };
const M = mdir === 'none' ? { cards: null, drape: null } : readPeopleModels(read);
await MeshoptSimplifier.ready;
const O = buildOutfits(A, { models: M, simplify: meshoptSimplify(MeshoptSimplifier) });
// colours (linear-ish sRGB 0-255) by colour slot: skin, main, second, trim, hair, leather, felt; metals gold
const SLOT: Record<number, [number, number, number]> = { 1: [178, 128, 100], 2: [196, 170, 128], 3: [120, 70, 60], 4: [70, 100, 150], 5: [40, 28, 20], 6: [110, 72, 40], 8: [96, 80, 64], 0: [200, 160, 60] };
const list: any[] = [];
for (const spec of specs) {
  const [dress, vid, lodS, optS] = spec.split(':'); const lod = +lodS, costume = COSTUME_OF[dress as Dress], C = O.costumes[costume].find(c => c.lod === lod)!;
  const v = A.byId[vid], opts = new Set(optS ? optS.split('+') : []); let mask = 1; for (const id of opts) { const b = pieceBit(dress as Dress, id); if (b) mask |= 1 << b; }
  for (const id of COSTUMES[dress as Dress].always) { const b = pieceBit(dress as Dress, id); if (b) mask |= 1 << b; }
  const base = v.index * O.NV * 4, n = C.tid.length, keep = new Uint8Array(n);
  for (let k = 0; k < n; k++) { const bit = C.hmat[k * 4 + 2], mat = C.hmat[k * 4]; keep[k] = (mask >> bit) & 1 && mat !== MAT.lash && mat !== MAT.eye ? 1 : 0; }
  const idx: number[] = []; for (let t = 0; t < C.index.length; t += 3) { const a = C.index[t], b = C.index[t + 1], c = C.index[t + 2]; if (keep[a] && keep[b] && keep[c]) idx.push(a, b, c); }
  const head = `ply\nformat binary_little_endian 1.0\nelement vertex ${n}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${idx.length / 3}\nproperty list uchar int vertex_indices\nend_header\n`;
  const body = Buffer.alloc(n * 15 + (idx.length / 3) * 13); let o = 0;
  for (let k = 0; k < n; k++) { const s = base + C.tid[k] * 4, col = SLOT[C.hmat[k * 4 + 1]] ?? [128, 128, 128];
    body.writeFloatLE(O.source[s], o); body.writeFloatLE(-O.source[s + 2], o + 4); body.writeFloatLE(O.source[s + 1], o + 8); o += 12; for (const c of col) body.writeUInt8(c, o++); }
  for (let t = 0; t < idx.length; t += 3) { body.writeUInt8(3, o++); for (let e = 0; e < 3; e++) { body.writeInt32LE(idx[t + e], o); o += 4; } }
  const f = `${out}/${spec.replace(/[:+]/g, '_')}.ply`; writeFileSync(f, Buffer.concat([Buffer.from(head, 'ascii'), body]));
  list.push({ file: f, label: spec, tris: idx.length / 3 }); console.log('[preview_garments]', spec, idx.length / 3, 'triangles drawn');
}
writeFileSync(`${out}/job.json`, JSON.stringify({ items: list, res: 420, samples: 24 }, null, 1));
