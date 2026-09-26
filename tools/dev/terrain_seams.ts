// dev: the walked terrain against the drawn terrain (audit D M1; gates T-H1).
//  1. T-H1: 10,000 samples per ring seam (near/mid ±2,048 m, mid/far ±10,240 m; a ±64 m band either side of the seam line,
//     all four sides): the physics collider's height (a ray cast on the streamed chunk colliders) against the DRAWN ground,
//     read from the terrain mesh's own full-resolution chunk geometry (its vertex buffer and index buffer, not heightAt).
//  2. The player walks across every kind of seam (ring seams, chunk seams, chunk corners) thousands of times with the
//     streamed colliders and the safety net active; falls, rescues and invisible walls must be 0.
// Usage: npx tsx tools/dev/terrain_seams.ts [crossings=2100] [seed=7] [--no-write]. Writes bench-reports/terrain-seams.txt.
// tests/terrain_walk.test.ts runs a sample of both.
import { writeFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { Physics } from '../../src/player/physics';
import { TerrainMesh } from '../../src/terrain/terrainMesh';
import { loadTerrain } from '../../tests/plainLib';
import { seamCrossings } from '../../tests/lib/seams';

const n = +(process.argv[2] ?? 2100), seed = +(process.argv[3] ?? 7);
const T = loadTerrain(), P = await Physics.create();

// --- 1. collider vs drawn mesh at the ring seams
const mesh = new TerrainMesh(T, 1) as any, geoms = new Map<any, THREE.BufferGeometry>();
/** the drawn height at (x, z): the chunk's step-1 geometry, the triangle of its index buffer that contains the point */
function drawnAt(x: number, z: number): number {
  const ch = mesh.chunks.find((c: any) => { const x0 = -c.ring.half + c.c0 * c.ring.cell, z0 = -c.ring.half + c.r0 * c.ring.cell, s = c.cells * c.ring.cell; return x >= x0 && x < x0 + s && z >= z0 && z < z0 + s; });
  let g = geoms.get(ch); if (!g) { g = mesh.buildGeometry(ch, 1) as THREE.BufferGeometry; geoms.set(ch, g); }
  const pos = g.attributes.position.array as Float32Array, idx = g.index!.array, cells = ch.cells, cell = ch.ring.cell;
  const x0 = -ch.ring.half + ch.c0 * cell, z0 = -ch.ring.half + ch.r0 * cell, j = Math.min(cells - 1, Math.floor((x - x0) / cell)), i = Math.min(cells - 1, Math.floor((z - z0) / cell));
  const t0 = (i * cells + j) * 6; // two triangles per cell, in index order
  for (const t of [t0, t0 + 3]) {
    const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3;
    const ax = pos[A], az = pos[A + 2], bx = pos[B], bz = pos[B + 2], cx = pos[C], cz = pos[C + 2];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz), u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v;
    if (u >= -1e-6 && v >= -1e-6 && w >= -1e-6) return u * pos[A + 1] + v * pos[B + 1] + w * pos[C + 1];
  }
  throw new Error(`no triangle at ${x}, ${z}`);
}
let s = seed >>> 0; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const seamLines: string[] = []; let seamWorst = 0; const t1 = Date.now();
for (const [name, H] of [['near/mid', T.near.half], ['mid/far', T.mid.half]] as const) {
  let worst = 0, sum = 0, at = ''; const N = 10000;
  for (let k = 0; k < N; k++) {
    const side = k % 4, along = (rnd() * 2 - 1) * (H - 1), across = H + (rnd() * 2 - 1) * 64;
    const [x, z] = side === 0 ? [across, along] : side === 1 ? [-across, along] : side === 2 ? [along, across] : [along, -across];
    P.updateTerrain(T, { x, y: 0, z }); const hit = P.castRayDown(x, z, 6000);
    const d = hit === null ? Infinity : Math.abs(hit - drawnAt(x, z)); sum += d; if (d > worst) { worst = d; at = `(${x.toFixed(1)}, ${z.toFixed(1)})`; }
  }
  seamWorst = Math.max(seamWorst, worst);
  seamLines.push(`  T-H1 ${name} seam (±64 m band, ${N} samples): collider vs drawn mesh mean ${(sum / N * 1000).toFixed(2)} mm, worst ${(worst * 1000).toFixed(2)} mm at ${at}`);
}

// --- 2. crossings
const r = seamCrossings(T, P, n, seed);
const lines = [`terrain seams (tools/dev/terrain_seams.ts, seed ${seed}, ${new Date().toISOString().slice(0, 10)})`,
  `collider vs drawn ground at the ring seams (T-H1 <= 0.05 m at >= 10,000 samples per seam): worst ${(seamWorst * 1000).toFixed(2)} mm (${((Date.now() - t1) / 1000).toFixed(0)} s)`, ...seamLines,
  `${r.crossings} seam crossings in ${(r.ms / 1000).toFixed(0)} s: fell through ${r.fell}; safety net fired ${r.rescued}; invisible walls ${r.wall}; stopped by a drawn slope > 38° ${r.slopeStopped}`,
  `worst |feet − drawn ground| while grounded on ground under 30°: ${r.worstGroundGap.toFixed(3)} m (${r.worstGapAt})`,
  `collider streaming: ${P.terrainStats.built} chunk colliders built, ${P.terrainStats.dropped} dropped, build ${(P.terrainStats.ms / Math.max(1, P.terrainStats.built)).toFixed(2)} ms mean, ${P.terrainStats.maxMs.toFixed(2)} ms worst`,
  ...Object.entries(r.byKind).map(([k, b]) => `  ${k}: ${b.n} crossings, fell ${b.fell}, rescued ${b.rescued}, walls ${b.wall}, slope-stopped ${b.slope}`),
  ...r.walls.map(w => `  wall: ${w}`), ...r.falls.map(f => `  fall: ${f}`)];
console.log(lines.join('\n'));
if (!process.argv.includes('--no-write')) writeFileSync('bench-reports/terrain-seams.txt', lines.join('\n') + '\n');
process.exit(r.fell || r.rescued || r.wall || seamWorst > 0.05 ? 1 : 0);
