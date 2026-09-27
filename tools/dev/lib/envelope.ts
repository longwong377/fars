// The physically walkable envelope (MASTER_PLAN §4.3, D-277): every place the player's controller can stand and reach
// from the spawn, from the terrain rings and the architecture's colliders, never from the people's walkable grid.
//
// Two layers:
//  - TERRAIN, world-wide at each ring's own resolution (near 4 m to ±2,048 m, mid 16 m to ±10,240 m, far 80 m to ±71,680 m):
//    each ring cell is the two triangles the drawn mesh and the collider share (Ring.surfaceAt's diagonal); a triangle is
//    walkable when its slope is within the controller's 42° climb angle (player.ts setMaxSlopeClimbAngle); a cell counts
//    half per walkable triangle. Reach: a 4-connected flood fill from the spawn over cells with a walkable triangle, across
//    the ring seams (a coarse cell's edge is sampled at the finer ring's spacing).
//  - ARCHITECTURE PATCHES, at 0.5 m: wherever a collider stands that is not terrain (the Terrace's parts, inscription stones,
//    waterworks, furnishings; the town's walls and props; every village's walls and fittings, built for the purpose; Naqsh-e
//    Rustam's cliff, the quarries, the fords), found by enumerating the physics world's colliders, bucketed at 32 m and
//    dilated one bucket. Inside a patch the terrain layer is replaced by a 2.5-D flood fill with the player's own limits:
//    a neighbour's floor is the first surface below (current floor + step + 0.3 m); it must be a floor (normal within 42°),
//    at most STEP_UP (0.42 m) higher or any amount lower (a fall is reachable), with 1.7 m of headroom (the capsule), and the
//    knee (0.6 m) and head (1.6 m) rays between the two cells must hit nothing (so a wall, a parapet or a door frame stops
//    it). Seeds: the patch's rim cells standing on reached terrain. Each reached cell records its floor height and whether a
//    roof is over it (a ray up from 1.75 m hits something within 60 m): "interior".
// Deliberately NOT modelled (and why): door leaves are left out of every query (EXCLUDE_KINEMATIC: every door is taken as
// open, the envelope is the larger for it; a sealed Treasury store counts as walkable); people, animals and tree trunks are
// not obstacles; the river corridor trimeshes are not streamed outside patches (the carved terrain stands in for them).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Terrain, Ring } from '../../../src/terrain/heightfield';
import type { Physics } from '../../../src/player/physics';
import { STEP_UP, CAPSULE_HALF, CAPSULE_R } from '../../../src/player/player';

export const MAX_SLOPE_DEG = 42;
export const FLOOR_NY = Math.cos((MAX_SLOPE_DEG * Math.PI) / 180);
export const PATCH_RES = 0.5, BUCKET_M = 32, BUCKET_N = BUCKET_M / PATCH_RES; // 64 cells a side
export const KNEE = 0.6, HEAD = 1.6, BODY_H = 2 * (CAPSULE_HALF + CAPSULE_R);
/** the spawn (main.ts SPAWN): grid east, north */
export const SPAWN: [number, number] = [-175, 122.45];

type RingName = 'near' | 'mid' | 'far';
export interface TerrainLayer {
  /** per ring: walkable triangles per cell (0, 1, 2), reached (0/1); cells (n-1)², row-major from the north edge */
  walk: Record<RingName, Uint8Array>; reach: Record<RingName, Uint8Array>;
  /** reached walkable cells on the far ring's outer edge: places the player can walk off the world */
  edgeExits: number;
}
export interface Patch { id: number; buckets: number[]; /** bucket key → slot */ slot: Map<number, number>; h: Float32Array[]; roof: Uint8Array[]; bbox: [number, number, number, number]; seeds: number; reached: number; ms: number }
export interface Envelope { T: Terrain; terrain: TerrainLayer; patches: Patch[]; /** bucket key → patch index */ mask: Map<number, number> }

export const bkey = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);
export const bij = (k: number): [number, number] => [Math.floor(k / 65536) - 32768, (k % 65536) - 32768];

// --- terrain layer ------------------------------------------------------------------------------------------------------
const rings = (T: Terrain): [RingName, Ring][] => [['near', T.near], ['mid', T.mid], ['far', T.far]];
/** does ring `nm` own the point (x, z) (world coords: z = −north)? */
function owns(T: Terrain, nm: RingName, x: number, z: number) {
  if (nm === 'near') return T.near.contains(x, z);
  if (nm === 'mid') return !T.near.contains(x, z) && T.mid.contains(x, z);
  return !T.mid.contains(x, z) && T.far.contains(x, z);
}
function triWalk(ring: Ring, r: number, c: number) {
  const n = ring.n, s = ring.cell, h = ring.h, i = r * n + c;
  const a = h[i], b = h[i + 1], d = h[i + n], e = h[i + n + 1];
  // triangle 1: (r,c) (r,c+1) (r+1,c): gradients along x (c) and z (r)
  const g1 = Math.hypot(b - a, d - a) / s, g2 = Math.hypot(d - e, b - e) / s, t = Math.tan((MAX_SLOPE_DEG * Math.PI) / 180);
  return (g1 <= t ? 1 : 0) + (g2 <= t ? 1 : 0);
}
export function terrainLayer(T: Terrain, spawn = SPAWN): TerrainLayer {
  const walk = {} as Record<RingName, Uint8Array>, reach = {} as Record<RingName, Uint8Array>;
  for (const [nm, ring] of rings(T)) { const m = ring.n - 1, w = new Uint8Array(m * m);
    for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) { const x = (c + 0.5) * ring.cell - ring.half, z = (r + 0.5) * ring.cell - ring.half; if (owns(T, nm, x, z)) w[r * m + c] = triWalk(ring, r, c); }
    walk[nm] = w; reach[nm] = new Uint8Array(m * m); }
  const R = Object.fromEntries(rings(T)) as Record<RingName, Ring>;
  const locate = (x: number, z: number): [RingName, number] | null => { for (const [nm, ring] of rings(T)) { if (!owns(T, nm, x, z)) continue; const m = ring.n - 1, c = Math.floor((x + ring.half) / ring.cell), r = Math.floor((z + ring.half) / ring.cell); if (c < 0 || r < 0 || c >= m || r >= m) return null; return [nm, r * m + c]; } return null; };
  const q: [RingName, number][] = []; const s0 = locate(spawn[0], -spawn[1]); if (!s0) throw new Error('envelope: spawn off the terrain');
  reach[s0[0]][s0[1]] = 1; q.push(s0); let edgeExits = 0;
  const visit = (nm: RingName, k: number) => { if (walk[nm][k] && !reach[nm][k]) { reach[nm][k] = 1; q.push([nm, k]); } };
  while (q.length) {
    const [nm, k] = q.pop()!, ring = R[nm], m = ring.n - 1, r = Math.floor(k / m), c = k % m, s = ring.cell;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const r2 = r + dr, c2 = c + dc;
      const out = r2 < 0 || c2 < 0 || r2 >= m || c2 >= m;
      if (out && nm === 'far') { edgeExits++; continue; }
      const x2 = (c2 + 0.5) * s - ring.half, z2 = (r2 + 0.5) * s - ring.half;
      if (!out && owns(T, nm, x2, z2)) { visit(nm, r2 * m + c2); continue; }
      // across a seam: sample the shared edge at 4 m spacing, just beyond it
      const k2 = Math.max(1, Math.round(s / 4)), ex = (c + 0.5 + dc * 0.5) * s - ring.half, ez = (r + 0.5 + dr * 0.5) * s - ring.half;
      for (let t = 0; t < k2; t++) { const off = ((t + 0.5) / k2 - 0.5) * s, x = ex + dc * 0.5 + (dc === 0 ? off : 0), z = ez + dr * 0.5 + (dr === 0 ? off : 0);
        const l = locate(x, z); if (l) visit(l[0], l[1]); }
    }
  }
  return { walk, reach, edgeExits };
}
/** terrain walkability at a point: walkable triangles of its cell (0-2) and whether the cell is reached */
export function terrainAt(T: Terrain, L: TerrainLayer, e: number, n: number) {
  const x = e, z = -n;
  for (const [nm, ring] of rings(T)) { if (!owns(T, nm, x, z)) continue; const m = ring.n - 1, c = Math.floor((x + ring.half) / ring.cell), r = Math.floor((z + ring.half) / ring.cell);
    if (c < 0 || r < 0 || c >= m || r >= m) return { walk: 0, reach: false, ring: nm }; const k = r * m + c; return { walk: L.walk[nm][k], reach: !!L.reach[nm][k], ring: nm }; }
  return { walk: 0, reach: false, ring: 'none' as const };
}

// --- architecture patches -----------------------------------------------------------------------------------------------
/** the buckets (32 m) under every static non-terrain collider of the world, dilated by one, grouped into patches */
export function patchBuckets(P: Physics): number[][] {
  const occ = new Set<number>();
  P.world.forEachCollider(c => {
    if ((c as any).userData?.terrain || c.parent()) return; // terrain tiles; door leaves and people (kinematic bodies)
    const t = c.translation(); let x0 = t.x, x1 = t.x, z0 = t.z, z1 = t.z;
    const sh: any = c.shape, he = c.halfExtents?.();
    if (sh?.vertices) { const v = sh.vertices as Float32Array; for (let i = 0; i < v.length; i += 3) { const x = v[i] + t.x, z = v[i + 2] + t.z; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; } }
    else { const r = he ? Math.hypot(he.x, he.z) : 2; x0 -= r; x1 += r; z0 -= r; z1 += r; }
    // grid (e, n) = (x, −z)
    for (let i = Math.floor(x0 / BUCKET_M); i <= Math.floor(x1 / BUCKET_M); i++) for (let j = Math.floor(-z1 / BUCKET_M); j <= Math.floor(-z0 / BUCKET_M); j++) occ.add(bkey(i, j));
  });
  const dil = new Set<number>(); for (const k of occ) { const [i, j] = bij(k); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) dil.add(bkey(i + a, j + b)); }
  const seen = new Set<number>(), out: number[][] = [];
  for (const k0 of [...dil].sort((a, b) => a - b)) { if (seen.has(k0)) continue; const comp: number[] = [], st = [k0]; seen.add(k0);
    while (st.length) { const k = st.pop()!; comp.push(k); const [i, j] = bij(k); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k2 = bkey(i + a, j + b); if (dil.has(k2) && !seen.has(k2)) { seen.add(k2); st.push(k2); } } }
    out.push(comp.sort((a, b) => a - b)); }
  return out;
}

/** flood-fill one patch (see the header) */
export function fillPatch(P: Physics, T: Terrain, L: TerrainLayer, buckets: number[], id: number): Patch {
  const t0 = Date.now(), R = P.R, W = P.world, EXC = R.QueryFilterFlags.EXCLUDE_KINEMATIC;
  const slot = new Map<number, number>(); buckets.forEach((k, i) => slot.set(k, i));
  const h = buckets.map(() => new Float32Array(BUCKET_N * BUCKET_N).fill(NaN)), roof = buckets.map(() => new Uint8Array(BUCKET_N * BUCKET_N));
  let bi0 = Infinity, bj0 = Infinity, bi1 = -Infinity, bj1 = -Infinity; for (const k of buckets) { const [i, j] = bij(k); bi0 = Math.min(bi0, i); bj0 = Math.min(bj0, j); bi1 = Math.max(bi1, i); bj1 = Math.max(bj1, j); }
  const bbox: [number, number, number, number] = [bi0 * BUCKET_M, bj0 * BUCKET_M, (bi1 + 1) * BUCKET_M, (bj1 + 1) * BUCKET_M];
  // terrain colliders over the whole patch, then one step so the query tree holds them
  const cx = (bbox[0] + bbox[2]) / 2, cn = (bbox[1] + bbox[3]) / 2; P.updateTerrain(T, { x: cx, y: 0, z: -cn }, Math.hypot(bbox[2] - bbox[0], bbox[3] - bbox[1]) / 2 + 64); P.step(1e-4);
  // a global cell (gi, gj) at 0.5 m: centre e = (gi + 0.5) * res
  const ce = (gi: number) => (gi + 0.5) * PATCH_RES, cnn = (gj: number) => (gj + 0.5) * PATCH_RES;
  const where = (gi: number, gj: number): [number, number] | null => { const bi = Math.floor(gi / BUCKET_N), bj = Math.floor(gj / BUCKET_N), s = slot.get(bkey(bi, bj)); if (s === undefined) return null; return [s, (gj - bj * BUCKET_N) * BUCKET_N + (gi - bi * BUCKET_N)]; };
  const down = (e: number, n: number, from: number) => { const hit = W.castRayAndGetNormal(new R.Ray({ x: e, y: from, z: -n }, { x: 0, y: -1, z: 0 }), 400, true, EXC); return hit ? { y: from - hit.timeOfImpact, ny: hit.normal.y, toi: hit.timeOfImpact } : null; };
  const up = (e: number, n: number, from: number, len: number) => W.castRay(new R.Ray({ x: e, y: from, z: -n }, { x: 0, y: 1, z: 0 }), len, true, EXC) !== null;
  const seg = (e0: number, n0: number, y0: number, e1: number, n1: number, y1: number) => { const dx = e1 - e0, dy = y1 - y0, dz = -(n1 - n0), Lh = Math.hypot(dx, dy, dz); return W.castRay(new R.Ray({ x: e0, y: y0, z: -n0 }, { x: dx / Lh, y: dy / Lh, z: dz / Lh }), Lh, true, EXC) !== null; };
  const stand = (e: number, n: number, y: number) => !up(e, n, y + 0.05, BODY_H - 0.05);
  const q: number[] = []; let seeds = 0, reached = 0;
  const mark = (gi: number, gj: number, y: number) => { const w = where(gi, gj)!; h[w[0]][w[1]] = y; roof[w[0]][w[1]] = up(ce(gi), cnn(gj), y + BODY_H + 0.05, 60) ? 1 : 0; q.push(gi, gj); reached++; };
  // seeds: rim cells (a 4-neighbour outside the patch) on reached terrain whose first floor is that terrain
  for (const k of buckets) { const [bi, bj] = bij(k);
    for (let a = 0; a < BUCKET_N; a++) for (let b = 0; b < BUCKET_N; b++) {
      const gi = bi * BUCKET_N + a, gj = bj * BUCKET_N + b; if (where(gi + 1, gj) && where(gi - 1, gj) && where(gi, gj + 1) && where(gi, gj - 1)) continue;
      const e = ce(gi), n = cnn(gj), ta = terrainAt(T, L, e, n); if (!ta.reach || !ta.walk) continue;
      const s = T.surfaceAt(e, -n), g = down(e, n, s + STEP_UP + 0.3); if (!g || Math.abs(g.y - s) > 0.3 || g.ny < FLOOR_NY || !stand(e, n, g.y)) continue;
      const w = where(gi, gj)!; if (!Number.isNaN(h[w[0]][w[1]])) continue; mark(gi, gj, g.y); seeds++; } }
  while (q.length) {
    const gj = q.pop()!, gi = q.pop()!, w0 = where(gi, gj)!, y0 = h[w0[0]][w0[1]], e0 = ce(gi), n0 = cnn(gj);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const gi2 = gi + a, gj2 = gj + b, w = where(gi2, gj2); if (!w || !Number.isNaN(h[w[0]][w[1]])) continue;
      const e1 = ce(gi2), n1 = cnn(gj2), g = down(e1, n1, y0 + STEP_UP + 0.3);
      if (!g || g.toi < 1e-4 || g.y - y0 > STEP_UP || g.ny < FLOOR_NY) continue; // inside a solid, too high a step, too steep
      if (seg(e0, n0, y0 + KNEE, e1, n1, Math.max(g.y, y0 - 1) + KNEE) || seg(e0, n0, y0 + HEAD, e1, n1, Math.max(g.y, y0 - 1) + HEAD)) continue;
      if (!stand(e1, n1, g.y)) continue;
      mark(gi2, gj2, g.y);
    }
  }
  return { id, buckets, slot, h, roof, bbox, seeds, reached, ms: Date.now() - t0 };
}

/** envelope lookup at a point: 'patch' (reached, floor height, roofed), 'terrain' (walkable triangles, reached) */
export function envelopeAt(E: Envelope, e: number, n: number) {
  const k = bkey(Math.floor(e / BUCKET_M), Math.floor(n / BUCKET_M)), pi = E.mask.get(k);
  if (pi !== undefined) { const p = E.patches[pi], s = p.slot.get(k)!, [bi, bj] = bij(k), gi = Math.floor(e / PATCH_RES) - bi * BUCKET_N, gj = Math.floor(n / PATCH_RES) - bj * BUCKET_N, c = gj * BUCKET_N + gi, y = p.h[s][c];
    return { layer: 'patch' as const, patch: pi, reach: !Number.isNaN(y), walk: Number.isNaN(y) ? 0 : 2, y, roofed: p.roof[s][c] === 1 }; }
  const t = terrainAt(E.T, E.terrain, e, n); return { layer: 'terrain' as const, patch: -1, reach: t.reach && t.walk > 0, walk: t.walk, y: E.T.surfaceAt(e, -n), roofed: false };
}

/** every envelope element as (e, n, m², roofed): the patches' reached 0.5 m cells, then the terrain's reached cells with the
 *  patch buckets taken out (a coarse cell partly under a patch counts its uncovered share, sampled at 4 m) */
export function forEachEnvelope(E: Envelope, f: (e: number, n: number, m2: number, roofed: boolean, layer: string) => void) {
  const a = PATCH_RES * PATCH_RES;
  for (const p of E.patches) p.buckets.forEach((k, s) => { const [bi, bj] = bij(k);
    for (let c = 0; c < BUCKET_N * BUCKET_N; c++) { if (Number.isNaN(p.h[s][c])) continue; const gi = bi * BUCKET_N + (c % BUCKET_N), gj = bj * BUCKET_N + Math.floor(c / BUCKET_N); f((gi + 0.5) * PATCH_RES, (gj + 0.5) * PATCH_RES, a, p.roof[s][c] === 1, 'patch'); } });
  for (const [nm, ring] of rings(E.T)) { const m = ring.n - 1, s = ring.cell, W = E.terrain.walk[nm], Rc = E.terrain.reach[nm];
    for (let r = 0; r < m; r++) for (let c = 0; c < m; c++) { const k = r * m + c; if (!Rc[k] || !W[k]) continue;
      const x0 = c * s - ring.half, z0 = r * s - ring.half, e0 = x0, n0 = -(z0 + s), frac = W[k] / 2;
      // buckets the cell touches
      let masked = false; for (let i = Math.floor(e0 / BUCKET_M); i <= Math.floor((e0 + s - 1e-6) / BUCKET_M) && !masked; i++) for (let j = Math.floor(n0 / BUCKET_M); j <= Math.floor((n0 + s - 1e-6) / BUCKET_M); j++) if (E.mask.has(bkey(i, j))) { masked = true; break; }
      if (!masked) { f(e0 + s / 2, n0 + s / 2, s * s * frac, false, nm); continue; }
      const sub = Math.max(1, Math.round(s / 4)), d = s / sub;
      for (let a2 = 0; a2 < sub; a2++) for (let b2 = 0; b2 < sub; b2++) { const e = e0 + (a2 + 0.5) * d, n = n0 + (b2 + 0.5) * d; if (E.mask.has(bkey(Math.floor(e / BUCKET_M), Math.floor(n / BUCKET_M)))) continue; f(e, n, d * d * frac, false, nm); } }
  }
}

// --- cache (shots/cache/, gitignored): Tier 0 reads the envelope instead of rebuilding it ----------------------------------
/** write the envelope: a JSON header line, then the terrain rings' walk/reach bytes and each patch's buckets, heights, roofs */
export function saveEnvelope(E: Envelope, file: string, dep: string): string {
  const parts: Buffer[] = [], head: any = { dep, rings: {} as Record<string, number>, patches: [] as any[] };
  for (const nm of ['near', 'mid', 'far'] as RingName[]) { head.rings[nm] = E.terrain.walk[nm].length; parts.push(Buffer.from(E.terrain.walk[nm]), Buffer.from(E.terrain.reach[nm])); }
  head.edgeExits = E.terrain.edgeExits;
  for (const p of E.patches) { head.patches.push({ id: p.id, buckets: p.buckets, bbox: p.bbox, seeds: p.seeds, reached: p.reached, ms: p.ms });
    for (let s = 0; s < p.buckets.length; s++) parts.push(Buffer.from(p.h[s].buffer, p.h[s].byteOffset, p.h[s].byteLength), Buffer.from(p.roof[s])); }
  const hb = Buffer.from(JSON.stringify(head) + '\n');
  mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, Buffer.concat([hb, ...parts])); return file;
}
export function loadEnvelope(T: Terrain, file: string): Envelope & { dep: string } {
  const buf = readFileSync(file), nl = buf.indexOf(10), head = JSON.parse(buf.subarray(0, nl).toString('utf8')); let o = nl + 1;
  const take = (n: number) => { const b = new Uint8Array(n); b.set(buf.subarray(o, o + n)); o += n; return b; };
  const walk = {} as Record<RingName, Uint8Array>, reach = {} as Record<RingName, Uint8Array>;
  for (const nm of ['near', 'mid', 'far'] as RingName[]) { walk[nm] = take(head.rings[nm]); reach[nm] = take(head.rings[nm]); }
  const patches: Patch[] = [], mask = new Map<number, number>(), N = BUCKET_N * BUCKET_N;
  head.patches.forEach((ph: any, i: number) => { const h: Float32Array[] = [], roof: Uint8Array[] = [], slot = new Map<number, number>();
    ph.buckets.forEach((k: number, s: number) => { h.push(new Float32Array(take(N * 4).buffer)); roof.push(take(N)); slot.set(k, s); mask.set(k, i); });
    patches.push({ ...ph, slot, h, roof }); });
  return { T, terrain: { walk, reach, edgeExits: head.edgeExits }, patches, mask, dep: head.dep };
}
