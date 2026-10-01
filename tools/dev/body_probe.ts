// D-363: a node probe of the body shape (region frames per variant, the shape spread over a sample)
import { readFileSync } from 'node:fs';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { regionFrame, shapeFor, bodyRigFor } from '../../src/people/bodyShape';
import { HB } from '../../src/people/humanFormat';
const b = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
for (const v of A.variants) { const F = regionFrame(A, v); const j = (n: number) => [...v.joints.slice(n * 3, n * 3 + 3)].map(x => x.toFixed(3)).join(',');
  console.log(v.meta.id, 'breast', F.breast.map(x => x.toFixed(3)).join(','), 'butt', F.butt.map(x => x.toFixed(3)).join(','), 'cheek', F.cheek.map(x => x.toFixed(3)).join(','), 'thighY', F.thighY.toFixed(3), 'head', j(HB.head), 'jaw', j(HB.jaw), 'pelvis', j(HB.pelvis)); }
if (process.argv.includes('--butt')) for (const id of ['m03', 'f03']) { const v = A.byId[id]; const py = v.joints[1];
  for (let y = py + 0.1; y > py - 0.3; y -= 0.04) { let mz = 1, mp = -1, Mz = -1; for (let i = 0; i < A.NO; i++) { const x = v.pos[i * 3], yy = v.pos[i * 3 + 1], z = v.pos[i * 3 + 2]; if (A.part[i] > 16) continue; if (x > 0.03 && x < 0.15 && Math.abs(yy - y) < 0.02) { if (z < mz) { mz = z; mp = A.part[i]; } Mz = Math.max(Mz, z); } }
    console.log(id, y.toFixed(2), 'back', mz.toFixed(3), 'part', mp, 'front', Mz.toFixed(3)); } }
