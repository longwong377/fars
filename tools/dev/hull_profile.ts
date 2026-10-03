// s17 V3: the torso cloth hull's front and side profile against the body, per height (clothHull), for a few variants
import { readFileSync } from 'node:fs';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { clothHull } from '../../src/people/drape';
import { HB, PART } from '../../src/people/humanFormat';
const b = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
for (const id of (process.argv[2] ?? 'm03,f03').split(',')) { const v = A.byId[id]; const H = clothHull(A, v), P = v.pos; const s1 = v.joints[HB.spine_01 * 3 + 1];
  console.log(id, 'spine_01', s1.toFixed(3), 'beltTop', H.beltTop.toFixed(3), 'armpit', v.joints[HB.upperarm_l * 3 + 1].toFixed(3));
  for (let y = v.joints[HB.upperarm_l * 3 + 1]; y > s1 - 0.05; y -= 0.025) { let bz = -1, tz = -1, bx = 0, tx = 0;
    for (let i = 0; i < A.NO; i++) { const p = A.part[i]; if (p !== PART.chest && p !== PART.belly && p !== PART.pelvis) continue; if (Math.abs(P[i * 3 + 1] - y) > 0.008) continue;
      if (Math.abs(P[i * 3]) < 0.03) { bz = Math.max(bz, P[i * 3 + 2]); tz = Math.max(tz, H.tgt[i * 3 + 2]); }
      bx = Math.max(bx, Math.abs(P[i * 3])); tx = Math.max(tx, Math.abs(H.tgt[i * 3])); }
    console.log(' y', y.toFixed(3), 'front body', (bz * 100).toFixed(1), 'cloth', (tz * 100).toFixed(1), 'd', ((tz - bz) * 100).toFixed(1), '| side body', (bx * 100).toFixed(1), 'cloth', (tx * 100).toFixed(1)); } }
