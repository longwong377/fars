// s17 V3: a garment's side extent (max |x|) against the body's, per height, over the shoulders (placed bind geometry)
import { readFileSync } from 'node:fs';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { buildOutfits } from '../../src/people/outfits';
import { decodeDrape } from '../../src/people/peopleModels';
const b = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const piece = process.argv[2] ?? 'work_upper', vid = process.argv[3] ?? 'm03', drape = process.argv.includes('--drape');
const cb = readFileSync('public/models/people/people_cloth.bin');
const models = drape ? { cards: null, drape: decodeDrape(JSON.parse(readFileSync('public/models/people/people_cloth.json', 'utf8')), cb.buffer.slice(cb.byteOffset, cb.byteOffset + cb.byteLength)) } : null;
const O = buildOutfits(A, { dresses: ['worker'], lods: [0], variants: [vid], models: models as any });
const v = A.byId[vid], vi = A.variants.indexOf(v), g = O.geos![Object.keys(O.geos!).find(k => k.startsWith(piece + '@0'))!], base = O.pieceBase[g.key], src = O.source, NV = O.NV;
const at = (i: number) => [src[(vi * NV + i) * 4], src[(vi * NV + i) * 4 + 1], src[(vi * NV + i) * 4 + 2]];
for (let y = 1.42; y > 1.1; y -= 0.02) { let bx = 0, cx = 0, cz = 0;
  for (let i = 0; i < A.NO; i++) { const q = at(i); if (Math.abs(q[1] - y) < 0.006 && q[0] > 0) bx = Math.max(bx, q[0]); }
  for (let k = 0; k < g.n; k++) { const q = at(base + k); if (Math.abs(q[1] - y) < 0.006 && q[0] > 0) { if (q[0] > cx) { cx = q[0]; cz = q[2]; } } }
  console.log(' y', y.toFixed(2), 'body x', (bx * 100).toFixed(1), 'cloth x', (cx * 100).toFixed(1), 'd', ((cx - bx) * 100).toFixed(1)); }
