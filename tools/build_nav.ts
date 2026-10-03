// Walkable grid for people (D-010): derived from the same Rapier colliders the player collides with, so NPC routes can
// never pass through a wall, column, parapet or drop that the player could not. Flood fill over a 0.5 m grid from seeds
// on the plain and the Terrace court: a neighbour is reachable when the ground under it (ray down from just above the
// current ground, so lintels/roofs are ignored) is within one step (MAX_STEP) and two clearance rays (knee and head
// height) between the cell centres hit nothing. The result is eroded by one cell for body clearance, except in narrow passages (doorways), where a cell whose centre is at
// least 0.3 m (body radius + 5 cm) from the obstacles on both sides is kept.
// Output: public/generated/nav.i16 (Int16 heights in cm, NAV_BLOCKED = not walkable) + nav.json (grid meta, parts hash).
// Run: npx tsx tools/build_nav.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Ring, Terrain, TerrainMeta } from '../src/terrain/heightfield';
import { Physics } from '../src/player/physics';
import { buildTerrace } from '../src/arch/terrace';
import { partsKey } from '../src/arch/partsKey';
import { buildMeshes } from '../src/arch/meshes';
import { NAV } from '../src/people/navgrid';
import { Settlement } from '../src/world/settlement/build';
import { FireSystem } from '../src/world/fire';

const t0 = Date.now();
const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const P = await Physics.create(); P.updateTerrain(T, { x: 0, y: 0, z: 0 });
const { parts } = buildTerrace();
buildMeshes(parts, P);
// s18 C5 (D-694): the town's colliders where its quarters reach into the grid (q_b1 at the Terrace foot, q_b3's E edge): the
// houses' walls, with C2's doors in them (every house enterable), so the grid's routes neither pass through a house nor
// miss its door. Streamed over the grid's box, every box
// (every box of every site reaching into the grid, added once: streamColliders drops sites 300 m from its point, so a sweep
// of it kept only the last area's)
{ const town = new Settlement(P, T, new FireSystem(2), 'test'), E1 = NAV.e0 + NAV.w * NAV.cell, N1 = NAV.n0 + NAV.h * NAV.cell; let sites = 0, boxes = 0;
  for (const c of (town as any).cols as { c: [number, number]; r: number; boxes: { x: number; y: number; z: number; hx: number; hy: number; hz: number; rot?: number }[] }[]) {
    if (c.c[0] + c.r < NAV.e0 || c.c[0] - c.r > E1 || c.c[1] + c.r < NAV.n0 || c.c[1] - c.r > N1) continue; sites++;
    for (const b of c.boxes) { P.addBox({ x: b.x, y: b.y, z: b.z }, { x: b.hx, y: b.hy, z: b.hz }, b.rot as any); boxes++; } }
  console.log(`the town's colliders in the grid: ${boxes} boxes of ${sites} sites`); }
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
// body clearance (D-067): a cell next to an unwalkable cell (4-neighbourhood) is dropped, as before, except in a narrow
// passage (unwalkable on both opposite sides: a doorway or a gap under ~1.5 m). There the cell is kept if its centre
// stands at least CLEAR from whatever made each such neighbour unwalkable, tested in that direction: the knee and head
// rays over CLEAR hit nothing and the ground CLEAR away is within one step. CLEAR = the 0.25 m body radius of the player
// and the people plus 5 cm. (The one-cell erosion alone sealed real doorways narrower than ~1.3 m, depending on how the
// grid fell, e.g. the 1.1 m doorways of the Treasury N range. Relaxing it along every wall let routes run 0.3 m from walls
// and climb stair flights from the side, where the capsule caught on the higher step: Hall 100 S doorway, botcheck.)
const CLEAR = 0.3; let kept = 0;
const out = new Int16Array(w * h).fill(NAV.blocked); let walk = 0;
for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
  const k = idx(i, j); if (Number.isNaN(H[k]) || wallSide[k]) continue;
  const nan = (di: number, dj: number) => { const ii = i + di, jj = j + dj; return ii < 0 || jj < 0 || ii >= w || jj >= h || Number.isNaN(H[idx(ii, jj)]); };
  // narrow: unwalkable within two cells on both opposite sides (an opening of at most three cells, under ~1.5 m)
  const edge = nan(1, 0) || nan(-1, 0) || nan(0, 1) || nan(0, -1), side = (di: number, dj: number) => nan(di, dj) || nan(2 * di, 2 * dj);
  const narrow = (side(1, 0) && side(-1, 0)) || (side(0, 1) && side(0, -1));
  let ok = !edge || narrow; const g0 = H[k], e = cx(i), n = cy(j);
  if (edge && narrow) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!nan(di, dj)) continue;
    const pe = e + di * CLEAR, pn = n + dj * CLEAR, g1 = ground(pe, pn, g0 + maxStep + head); rays += 3;
    if (g1 === null || Math.abs(g1 - g0) > maxStep || blocked(e, n, g0 + knee, pe, pn, g1 + knee) || blocked(e, n, g0 + head, pe, pn, g1 + head)) { ok = false; break; }
  }
  if (ok && edge) kept++;
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
// s18 C5 (D-694): on the approach, only what a body reaches from the seeds over the final grid's legal moves (the erosion
// after the flood fill leaves pockets: the inside of a house whose door the clearance closed); a pocket is blocked
{ const seen = new Uint8Array(w * h), q: number[] = [];
  for (const [e, n] of NAV.seeds) { const i = Math.floor((e - e0) / cell), j = Math.floor((n - n0) / cell), k = idx(i, j); if (out[k] !== NAV.blocked && !seen[k]) { seen[k] = 1; q.push(k); } }
  for (let x = 0; x < q.length; x++) { const k = q[x], i = k % w, j = (k / w) | 0;
    const go = (kk: number, ok: boolean) => { if (ok && !seen[kk] && out[kk] !== NAV.blocked) { seen[kk] = 1; q.push(kk); } };
    if (i + 1 < w) go(k + 1, (edges[k] & 1) !== 0); if (i > 0) go(k - 1, (edges[k - 1] & 1) !== 0);
    if (j + 1 < h) go(k + w, (edges[k] & 2) !== 0); if (j > 0) go(k - w, (edges[k - w] & 2) !== 0); }
  // (on the approach only, west of the Terrace's W face, where the town's quarters now stand: the Terrace's own rooms no
  // route reaches are places people are put in (the Tachara's, the Apadana's towers) and stay as they were)
  let pocket = 0; for (let k = 0; k < w * h; k++) if (out[k] !== NAV.blocked && !seen[k] && e0 + (k % w + 0.5) * cell < -45) { out[k] = NAV.blocked; edges[k] = 0; pocket++; walk--; }
  console.log(`pockets no body reaches from the seeds, blocked: ${pocket} cells`); }
writeFileSync('public/generated/nav_edges.u8', Buffer.from(edges.buffer));
const hash = createHash('sha1').update(partsKey(parts)).digest('hex').slice(0, 16);
writeFileSync('public/generated/nav.i16', Buffer.from(out.buffer));
writeFileSync('public/generated/nav.json', JSON.stringify({ ...NAV, partsHash: hash, walkable: walk, cutEdges: cut, rays, built: new Date().toISOString().slice(0, 10) }, null, 1));
console.log(`nav grid ${w}×${h} @ ${cell} m: ${walk} walkable cells (${kept} cells in narrow passages kept by the clearance test) (${(walk * cell * cell / 1e4).toFixed(1)} ha), ${rays} rays, ${cut} edges cut by thin walls, ${((Date.now() - t0) / 1000).toFixed(1)} s, parts ${hash}`);
