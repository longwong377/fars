// dev: the walked terrain against the drawn terrain (audit D M1; gates T-H1).
//  1. 10,000 samples per ring seam (the T-H1 measure; its evidence is written by tools/dev/audit_d/ring_probe.mts) (near/mid ±2,048 m, mid/far ±10,240 m; a ±64 m band either side of the seam line,
//     all four sides): the physics collider's height (a ray cast on the streamed chunk colliders) against the DRAWN ground,
//     read from the terrain mesh's own full-resolution chunk geometry (its vertex buffer and index buffer, not heightAt).
//  2. The player walks across every kind of seam (ring seams, chunk seams, chunk corners) thousands of times with the
//     streamed colliders and the safety net active; falls, rescues and invisible walls must be 0.
// Usage: npx tsx tools/dev/terrain_seams.ts [crossings=2100] [seed=7] [--no-write]. Writes bench-reports/terrain-seams.txt.
// tests/terrain_walk.test.ts runs a sample of both.
import { writeFileSync } from 'node:fs';
import { Physics } from '../../src/player/physics';
import { loadTerrain } from '../../tests/plainLib';
import { seamCrossings, seamSamples } from '../../tests/lib/seams';

const n = +(process.argv[2] ?? 2100), seed = +(process.argv[3] ?? 7);
const T = loadTerrain(), P = await Physics.create();

// --- 1. collider vs drawn mesh at the ring seams (the evidence of T-H1 is written by tools/dev/audit_d/ring_probe.mts)
const seam = seamSamples(T, P, 10000, seed), seamWorst = seam.worst, seamLines = seam.lines;

// --- 2. crossings
const r = seamCrossings(T, P, n, seed);
const lines = [`terrain seams (tools/dev/terrain_seams.ts, seed ${seed}, ${new Date().toISOString().slice(0, 10)})`,
  `collider vs drawn ground at the ring seams (T-H1 <= 0.05 m at >= 10,000 samples per seam): worst ${(seamWorst * 1000).toFixed(2)} mm (${(seam.ms / 1000).toFixed(0)} s)`, ...seamLines,
  `${r.crossings} seam crossings in ${(r.ms / 1000).toFixed(0)} s: fell through ${r.fell}; safety net fired ${r.rescued}; invisible walls ${r.wall}; stopped by a drawn slope > 38° ${r.slopeStopped}`,
  `worst |feet − drawn ground| while grounded on ground under 30°: ${r.worstGroundGap.toFixed(3)} m (${r.worstGapAt})`,
  `collider streaming: ${P.terrainStats.built} chunk colliders built, ${P.terrainStats.dropped} dropped, build ${(P.terrainStats.ms / Math.max(1, P.terrainStats.built)).toFixed(2)} ms mean, ${P.terrainStats.maxMs.toFixed(2)} ms worst`,
  ...Object.entries(r.byKind).map(([k, b]) => `  ${k}: ${b.n} crossings, fell ${b.fell}, rescued ${b.rescued}, walls ${b.wall}, slope-stopped ${b.slope}`),
  ...r.walls.map(w => `  wall: ${w}`), ...r.falls.map(f => `  fall: ${f}`)];
console.log(lines.join('\n'));
if (!process.argv.includes('--no-write')) {
  writeFileSync('bench-reports/terrain-seams.txt', lines.join('\n') + '\n');
}
process.exit(r.fell || r.rescued || r.wall || seamWorst > 0.05 ? 1 : 0);
