// Precompute the carved organic pieces (D-018): the double-bull protome and the volute member (unit shaft diameter,
// fitted to each order at startup) and the two Gate of All Nations colossi (metres). Each signed-distance model
// (src/arch/sculpt_models.ts, proportions src/data/sculpture.json) is polygonised by marching cubes, simplified to the
// LOD0 and LOD1 triangle targets and written as a compact binary (quantised positions, int8 normals, 16/32-bit indices).
// Output: public/generated/sculpt_<piece>_<lod>.bin + public/generated/sculpt.json (index, inputs hash, parameters).
// Run: npx tsx tools/build_sculpt.ts   (npm run sculpt) — tests/sculpt.test.ts fails when the inputs changed since.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildTerrace } from '../src/arch/terrace';
import type { Box } from '../src/arch/parts';
import { generatePiece, encodePiece, pieceFile, SCULPT_INDEX_FILE, SCULPT_VERSION, sculptParams, colossusFrontProjections, sculptHash, sculptInputs, PieceName, SculptIndex } from '../src/arch/sculpt';

const t0 = Date.now();
const { parts } = buildTerrace();
const fr = colossusFrontProjections(parts as Box[]);
if (!fr.length) throw new Error('no sculpted colossus parts in the terrace');
if (Math.max(...fr) - Math.min(...fr) > 0.02) throw new Error(`colossi project unequally beyond the wall faces: ${fr.map(f => f.toFixed(3))}`);
const params = sculptParams(fr.reduce((a, b) => a + b, 0) / fr.length);
const hash = sculptHash(sculptInputs(p => readFileSync(p, 'utf8'), params));
const pieces: SculptIndex['pieces'] = {};
for (const name of ['protome', 'volute', 'colossus_bull', 'colossus_lamassu'] as PieceName[]) {
  const t = Date.now(); const lods = generatePiece(name, params);
  pieces[name] = lods.map((m, l) => {
    const file = pieceFile(name, l as 0 | 1); writeFileSync('public/' + file, Buffer.from(encodePiece(m)));
    return { file, verts: m.pos.length / 3, tris: m.idx.length / 3 };
  });
  console.log(`${name.padEnd(17)} ${pieces[name].map(p => `${p.tris} tris`).join(' / ')}  ${((Date.now() - t) / 1000).toFixed(1)} s`);
}
const index: SculptIndex & { built: string } = { version: SCULPT_VERSION, hash, params, pieces, built: new Date().toISOString().slice(0, 10) };
writeFileSync('public/' + SCULPT_INDEX_FILE, JSON.stringify(index, null, 1));
console.log(`sculpt pieces written (hash ${hash}, colossus fore-part ${params.colossusFront.toFixed(3)} m, volute ${params.voluteH.toFixed(3)} D) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
