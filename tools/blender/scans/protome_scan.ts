// PARSA s17 V4 (D-511; B360): the double-bull protome of the bull and composite capitals from the licensed sculpts, in place
// of the project's signed-distance protome. No downloadable scan of an Achaemenid bull capital exists (B360); the Gate's W bull
// (D-510: the lamassu sculpt's body, CC-BY-4.0 Shahriar Shahrabi, with the bull-head scan, CC-BY-4.0 Kirk Hiatt) gives the
// fore-part in the round: chest with its curl rows, forelegs, neck and head. Here:
//  - the fore-part is cut at the shoulder (x >= CUT, where the colossus leaves its jamb and stands in the round);
//  - the forelegs kneel: below the knee each cannon and hoof turns back under the chest about its own knee (the capitals'
//    bulls kneel with the lower legs folded);
//  - two mirrored fore-parts meet back to back at their cuts (the beam's saddle between the necks);
//  - the whole is fitted to the game's protome box (public/generated/sculpt_protome_0.bin: x along the pair, y up, z across,
//    D units), so the game's instance fitting (meshes.ts fitLevel) is unchanged.
// Writes high.ply (the source of the bake) and lod0/lod1.ply simplified to the game's protome budgets (sculpture.json).
// Usage: npx tsx tools/blender/scans/protome_scan.ts <outDir> <highTris> [preview=0]
// It needs the W bull's graft (tools/blender/scans/bull_from_lamassu.ts + bull_graft.py), made here if missing.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { piece, srow } from '../../../src/arch/sculpt';
import { writePLY, readPLY } from '../lib/ply';
import { weld, bbox, filterFaces, transform, merge, normals, simplifyTo, preview, compact, type Mesh } from './scanlib';

const [out, highS, prevS] = process.argv.slice(2);
if (!out || !highS) { console.error('usage: protome_scan.ts <outDir> <highTris> [preview]'); process.exit(2); }
mkdirSync(out, { recursive: true });
const t0 = Date.now();
const gd = `${out}/graft`;
if (!existsSync(`${gd}/bull_remesh.ply`)) {
  mkdirSync(gd, { recursive: true });
  execFileSync('npx', ['tsx', 'tools/blender/scans/bull_from_lamassu.ts', gd, '0'], { stdio: 'inherit', shell: true });
  execFileSync(process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe', ['-b', '--factory-startup', '--python', 'tools/blender/scans/bull_graft.py', '--', gd, '0', '300'], { stdio: 'inherit' });
}
const g = readPLY(`${gd}/bull_remesh.ply`);
const bull = weld({ pos: g.pos, idx: g.idx }, 5e-4);

// ---- the fore-part (colossus frame, metres: x along the body, head +x; y up; z across)
const CUT = 0.32, KNEE = 1.3, BAND = 0.12, FOLD = 1.5; // the cut behind the shoulder; the fold's height (above the knee: a kneeling bull is low) and its band; the fold (rad, ~86°)
const fore = compact(filterFaces(bull, (x, y) => x > CUT && !(y < 0.04)));
// the forelegs' knees: the mean x of each leg's vertices in a band at the knee, the legs told apart by z
const BD = srow<any>('colossus', 'body'), ZS = BD.zc;
const kx = [0, 0], kn = [0, 0];
for (let k = 0; k < fore.pos.length; k += 3) { const y = fore.pos[k + 1]; if (y > KNEE - 0.05 && y < KNEE + 0.05) { const s = fore.pos[k + 2] > ZS ? 1 : 0; kx[s] += fore.pos[k]; kn[s]++; } }
const KX = kx.map((v, i) => v / Math.max(1, kn[i]));
const knelt = transform(fore, (x, y, z) => {
  if (y >= KNEE + BAND) return [x, y, z];
  const t = Math.min(1, (KNEE + BAND - y) / (2 * BAND)), a = -FOLD * t * t * (3 - 2 * t); // bent smoothly through the band
  const px = KX[z > ZS ? 1 : 0], dx = x - px, dy = y - KNEE, c = Math.cos(a), s = Math.sin(a);
  return [px + dx * c - dy * s, KNEE + dx * s + dy * c, z];
});
// ---- two, back to back at the cut (x' = x - CUT and its mirror), the pair centred on the bulls' median plane
const half = transform(knelt, (x, y, z) => [x - CUT, y, z - ZS]);
const mirror = transform(knelt, (x, y, z) => [-(x - CUT), y, z - ZS], true);
const pair = merge([half, mirror]);
// ---- fitted to the game's protome box (its LOD0's bounds, D units)
const P0 = piece('protome', 0), [tlo, thi] = bbox(Float32Array.from(P0.pos)), [lo, hi] = bbox(pair.pos);
const sc = [0, 1, 2].map(k => (thi[k] - tlo[k]) / (hi[k] - lo[k]));
const fit: Mesh = transform(pair, (x, y, z) => [tlo[0] + (x - lo[0]) * sc[0], tlo[1] + (y - lo[1]) * sc[1], tlo[2] + (z - lo[2]) * sc[2]]);

const BUD = srow<any>('protome', 'mc');
const t0b = P0.idx.length / 3, t1b = piece('protome', 1).idx.length / 3;
const high = normals(await simplifyTo(fit, +highS));
const l0 = normals(await simplifyTo(fit, t0b));
const l1 = normals(await simplifyTo(fit, t1b, { error: 1 }));
const stats = {
  high: writePLY(`${out}/high.ply`, high), lod0: writePLY(`${out}/lod0.ply`, l0), lod1: writePLY(`${out}/lod1.ply`, l1),
  source: 'bull_graft (D-510)', cut: CUT, knee: KNEE, fold: FOLD, knees_x: KX, stretch: sc, box: [tlo, thi], budget: [t0b, t1b, BUD?.lod0 ?? null], ms: Date.now() - t0,
};
writeFileSync(`${out}/source.json`, JSON.stringify(stats, null, 1));
console.log(JSON.stringify(stats));
if (prevS && prevS !== '0') {
  await preview(`${out}/prev_q.png`, high, [-0.7, -0.15, -0.7]);
  await preview(`${out}/prev_side.png`, high, [0, 0, -1]);
  await preview(`${out}/prev_below.png`, l0, [-0.5, 0.6, -0.6]);
}
