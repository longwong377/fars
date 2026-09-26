// Rapier physics world (brief §6 Navigation and physics). Terrain: one heightfield collider per drawn terrain chunk
// (Terrain.chunks(), the list terrainMesh.ts draws), built from the same ring samples at full resolution and streamed
// around the player, so the walked ground is the drawn ground everywhere (audit D M1: until session 8 one collider for the
// whole ring the player was in, switched at 1,984 m while the drawing switched at 2,048 m; the player fell through the
// mountain on 12 of 24 crossings). Architecture adds trimesh colliders.
import RAPIER from '@dimforge/rapier3d-compat';
import type { Terrain, TerrainChunk } from '../terrain/heightfield';

export type Vec3 = { x: number; y: number; z: number };
/** terrain chunks within this distance (m) of the player carry a collider; dropped beyond it + TERRAIN_KEEP (hysteresis).
 *  Walking at 3.2 m/s the player needs ~30 s to cross it; a near chunk is 512 m, a mid 2,048 m, a far 20,480 m. */
export const TERRAIN_R = 96, TERRAIN_KEEP = 64;
/** collider tile size in ring cells: each drawn chunk is split into tiles of at most this many cells a side (the same
 *  samples, cell grid and diagonals, so the same surface) */
export const TILE_CELLS = +((globalThis as any).process?.env?.PARSA_TILE ?? 128);
/** the collider tiles (sub-rectangles of drawn chunks) within r of (x, z) */
function tilesNear(T: Terrain, x: number, z: number, r: number): TerrainChunk[] {
  const out: TerrainChunk[] = [];
  for (const ch of T.chunksNear(x, z, r)) {
    const k = Math.max(1, Math.round(ch.cells / Math.min(TILE_CELLS, ch.cells))), cells = ch.cells / k, size = ch.size / k;
    if (k === 1) { out.push(ch); continue; }
    for (let tr = 0; tr < k; tr++) for (let tc = 0; tc < k; tc++) {
      const t: TerrainChunk = { ...ch, key: `${ch.key}:${tr}:${tc}`, r0: ch.r0 + tr * cells, c0: ch.c0 + tc * cells, cells, x0: ch.x0 + tc * size, z0: ch.z0 + tr * size, size };
      if (rectDist(t, x, z) <= r) out.push(t);
    }
  }
  return out;
}
/** distance from (x, z) to a chunk's rectangle (per axis, the larger) */
function rectDist(c: TerrainChunk, x: number, z: number) { return Math.max(c.x0 - x, x - (c.x0 + c.size), c.z0 - z, z - (c.z0 + c.size), 0); }

export class Physics {
  world!: RAPIER.World;
  private terrain: Terrain | null = null;
  private chunkColliders = new Map<string, { c: RAPIER.Collider; ch: TerrainChunk }>();
  /** terrain collider streaming: chunks built / dropped, build time (ms, total and worst) */
  readonly terrainStats = { built: 0, dropped: 0, ms: 0, maxMs: 0 };
  static async create(): Promise<Physics> { await RAPIER.init(); const p = new Physics(); p.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); return p; }
  get R() { return RAPIER; }

  /** a chunk's heightfield: Rapier/parry rows run along z, columns along x, heights column-major; parry splits each cell
   *  along the same diagonal as the drawn mesh (Ring.surfaceAt) */
  private ensureChunk(ch: TerrainChunk) {
    if (this.chunkColliders.has(ch.key)) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const { ring, r0, c0, cells } = ch, N = ring.n, n = cells + 1, h = new Float32Array(n * n);
    for (let r = 0; r < n; r++) { const row = (r0 + r) * N + c0; for (let c = 0; c < n; c++) h[r + c * n] = ring.h[row + c]; }
    const desc = RAPIER.ColliderDesc.heightfield(cells, cells, h, { x: ch.size, y: 1, z: ch.size })
      .setTranslation(ch.x0 + ch.size / 2, 0, ch.z0 + ch.size / 2).setFriction(0.9);
    const c = this.world.createCollider(desc); (c as any).userData = { terrain: ch.key };
    this.chunkColliders.set(ch.key, { c, ch });
    const ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    this.terrainStats.built++; this.terrainStats.ms += ms; this.terrainStats.maxMs = Math.max(this.terrainStats.maxMs, ms);
  }
  /** stream the terrain colliders around p: every drawn chunk within `radius` gets its collider; chunks beyond
   *  radius + TERRAIN_KEEP lose theirs */
  updateTerrain(terrain: Terrain, p: Vec3, radius = TERRAIN_R) {
    if (this.terrain !== terrain) { for (const e of this.chunkColliders.values()) this.world.removeCollider(e.c, false); this.chunkColliders.clear(); this.terrain = terrain; }
    for (const ch of tilesNear(terrain, p.x, p.z, radius)) this.ensureChunk(ch);
    for (const [k, e] of this.chunkColliders) if (rectDist(e.ch, p.x, p.z) > radius + TERRAIN_KEEP) { this.world.removeCollider(e.c, false); this.chunkColliders.delete(k); this.terrainStats.dropped++; }
  }
  /** the terrain chunks that carry a collider now */
  terrainChunks(): string[] { return [...this.chunkColliders.keys()]; }
  addTrimesh(positions: Float32Array, indices: Uint32Array, userData?: unknown) {
    const c = this.world.createCollider(RAPIER.ColliderDesc.trimesh(positions, indices).setFriction(0.8));
    (c as any).userData = userData; return c;
  }
  addBox(center: Vec3, half: Vec3, rotY = 0) {
    const q = { x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) };
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setTranslation(center.x, center.y, center.z).setRotation(q));
  }
  /** first surface below (x, fromY, z); the terrain chunk under the ray is given its collider first, so a cast far from
   *  the player (a test camera, a teleport) still finds the ground */
  castRayDown(x: number, z: number, fromY = 5000, exclude?: RAPIER.Collider): number | null {
    const ray = new RAPIER.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, 20000, true, undefined, undefined, exclude);
    let toi = hit ? hit.timeOfImpact : Infinity;
    // the terrain under the ray, directly: a collider created since the last step is not yet in the world's query tree
    if (this.terrain) for (const ch of tilesNear(this.terrain, x, z, 0)) { this.ensureChunk(ch); const t = this.chunkColliders.get(ch.key)!.c.castRay(ray, 20000, true); if (t >= 0 && t < toi) toi = t; }
    return Number.isFinite(toi) ? fromY - toi : null;
  }
  step(dt: number) { this.world.timestep = dt; this.world.step(); }
}
