// Walkable grid for people (D-010): derived from the same Rapier colliders the player collides with, so NPC routes can
// never pass through a wall, column, parapet or drop that the player could not. Flood fill over a 0.5 m grid from seeds
// on the plain and the Terrace court: a neighbour is reachable when the ground under it (ray down from just above the
// current ground, so lintels/roofs are ignored) is within one step (MAX_STEP) and two clearance rays (knee and head
// height) between the cell centres hit nothing. The result is eroded by one cell for body clearance.
// Output: public/generated/nav.i16 (Int16 heights in cm, NAV_BLOCKED = not walkable) + nav.json (grid meta, parts hash).
// Run: npx tsx tools/build_nav.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Ring, Terrain, TerrainMeta } from '../src/terrain/heightfield';
import { Physics } from '../src/player/physics';
import { buildTerrace } from '../src/arch/terrace';
import { buildMeshes } from '../src/arch/meshes';
import { NAV } from '../src/people/navgrid';

const t0 = Date.now();
const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const P = await Physics.create(); P.updateTerrain(T, { x: 0, y: 0, z: 0 });
const { parts } = buildTerrace();
buildMeshes(parts, P);
P.step(1 / 60);
const R = P.R, world = P.world;

const { e0, n0, cell, w, h, maxStep, knee, head } = NAV;
const H = new Float32Array(w * h).fill(NaN);
const idx = (i: number, j: number) => j * w + i; // i along east, j along north
const cx = (i: number) => e0 + (i + 0.5) * cell, cy = (j: number) => n0 + (j + 0.5) * cell;
const ground = (e: number, n: number, fromY: number) => P.castRayDown(e, -n, fromY);
const blocked = (e0_: number, n0_: number, y0: number, e1: number, n1: number, y1: number) => {
  const dx = e1 - e0_, dy = y1 - y0, dz = -(n1 - n0_), L = Math.hypot(dx, dy, dz);
  const ray = new R.Ray({ x: e0_, y: y0, z: -n0_ }, { x: dx / L, y: dy / L, z: dz / L });
  return world.castRay(ray, L, true) !== null;
};
const queue: number[] = [];
const seed = (e: number, n: number) => { const i = Math.floor((e - e0) / cell), j = Math.floor((n - n0) / cell); const g = ground(cx(i), cy(j), 5000); if (g === null) throw new Error('no ground at seed'); H[idx(i, j)] = g; queue.push(idx(i, j)); };
for (const [e, n] of NAV.seeds) seed(e, n);
let rays = 0;
while (queue.length) {
  const k = queue.pop()!; const i = k % w, j = (k / w) | 0, g0 = H[k];
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
    const kk = idx(ii, jj); if (!Number.isNaN(H[kk])) continue;
    const g1 = ground(cx(ii), cy(jj), g0 + maxStep + head); rays++;
    if (g1 === null || Math.abs(g1 - g0) > maxStep) continue;
    if (blocked(cx(i), cy(j), g0 + knee, cx(ii), cy(jj), g1 + knee) || blocked(cx(i), cy(j), g0 + head, cx(ii), cy(jj), g1 + head)) { rays += 2; continue; }
    rays += 2; H[kk] = g1; queue.push(kk);
  }
}
// cells beside a thin wall (a walkable neighbour that cannot be reached directly) count as edge cells for clearance
const wallSide = new Uint8Array(w * h);
for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
  const k = idx(i, j); if (Number.isNaN(H[k])) continue;
  for (const [ii, jj] of [[i + 1, j], [i, j + 1]]) { const kk = idx(ii, jj); if (Number.isNaN(H[kk])) continue;
    const g0 = H[k], g1 = H[kk]; const ok = Math.abs(g1 - g0) <= maxStep && !blocked(cx(i), cy(j), g0 + knee, cx(ii), cy(jj), g1 + knee) && !blocked(cx(i), cy(j), g0 + head, cx(ii), cy(jj), g1 + head);
    rays += 2; if (!ok) { wallSide[k] = 1; wallSide[kk] = 1; } }
}
// erode by one cell (8-neighbourhood) for body clearance
const out = new Int16Array(w * h).fill(NAV.blocked); let walk = 0;
for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
  const k = idx(i, j); if (Number.isNaN(H[k]) || wallSide[k]) continue;
  let ok = true; for (let dj = -1; dj <= 1 && ok; dj++) for (let di = -1; di <= 1; di++) if (Number.isNaN(H[idx(i + di, j + dj)])) { ok = false; break; }
  if (ok) { out[k] = Math.round(H[k] * 100); walk++; }
}
// legal moves between neighbouring walkable cells (bit 0 = to the east neighbour, bit 1 = to the north neighbour):
// a thin wall or parapet between two walkable cells must not become a shortcut
const edges = new Uint8Array(w * h); let cut = 0;
const legal = (i: number, j: number, ii: number, jj: number) => {
  const a = out[idx(i, j)], b = out[idx(ii, jj)]; if (a === NAV.blocked || b === NAV.blocked) return false;
  const g0 = a / 100, g1 = b / 100; if (Math.abs(g1 - g0) > maxStep) return false;
  return !blocked(cx(i), cy(j), g0 + knee, cx(ii), cy(jj), g1 + knee) && !blocked(cx(i), cy(j), g0 + head, cx(ii), cy(jj), g1 + head);
};
for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
  if (out[idx(i, j)] === NAV.blocked) continue;
  if (i + 1 < w && out[idx(i + 1, j)] !== NAV.blocked) { if (legal(i, j, i + 1, j)) edges[idx(i, j)] |= 1; else cut++; }
  if (j + 1 < h && out[idx(i, j + 1)] !== NAV.blocked) { if (legal(i, j, i, j + 1)) edges[idx(i, j)] |= 2; else cut++; }
}
writeFileSync('public/generated/nav_edges.u8', Buffer.from(edges.buffer));
const hash = createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
writeFileSync('public/generated/nav.i16', Buffer.from(out.buffer));
writeFileSync('public/generated/nav.json', JSON.stringify({ ...NAV, partsHash: hash, walkable: walk, cutEdges: cut, rays, built: new Date().toISOString().slice(0, 10) }, null, 1));
console.log(`nav grid ${w}×${h} @ ${cell} m: ${walk} walkable cells (${(walk * cell * cell / 1e4).toFixed(1)} ha), ${rays} rays, ${cut} edges cut by thin walls, ${((Date.now() - t0) / 1000).toFixed(1)} s, parts ${hash}`);
