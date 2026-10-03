// s17 V3: a garment's front profile against the body at the midline, per height, for a person's look (placed bind geometry)
import { readFileSync } from 'node:fs';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { buildOutfits } from '../../src/people/outfits';
import { lookFor } from '../../src/people/looks';
import { HB, PART } from '../../src/people/humanFormat';
const b = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const spec = JSON.parse(process.argv[2] ?? '{"dress":"worker","sex":"m","role":"porter","seed":24,"id":-1}');
const L = lookFor(A, spec, 1); const v = A.variants[L.variant]; console.log('variant', v.meta.id, 'pieces', L.pieces);
const piece = process.argv[3] ?? 'work_upper';
const O = buildOutfits(A, { dresses: [spec.dress], lods: [0], variants: [v.meta.id] });
const g = O.geos![Object.keys(O.geos!).find(k => k.startsWith(piece + '@0'))!]; const vi = A.variants.indexOf(v);
const base = O.pieceBase[g.key], src = O.source, NV = O.NV;
const at = (i: number) => [src[(vi * NV + i) * 4], src[(vi * NV + i) * 4 + 1], src[(vi * NV + i) * 4 + 2]];
const s1 = v.joints[HB.spine_01 * 3 + 1];
for (let y = v.joints[HB.upperarm_l * 3 + 1]; y > s1 - 0.08; y -= 0.025) { let bz = -1, cz = -1;
  for (let i = 0; i < A.NO; i++) { const p = A.part[i]; if (p !== PART.chest && p !== PART.belly && p !== PART.pelvis) continue; const q = at(i); if (Math.abs(q[1] - y) < 0.008 && Math.abs(q[0]) < 0.03) bz = Math.max(bz, q[2]); }
  for (let k = 0; k < g.n; k++) { const q = at(base + k); if (Math.abs(q[1] - y) < 0.008 && Math.abs(q[0]) < 0.03) cz = Math.max(cz, q[2]); }
  console.log(' y', y.toFixed(3), 'body', (bz * 100).toFixed(1), 'cloth', (cz * 100).toFixed(1), 'd', ((cz - bz) * 100).toFixed(1)); }
