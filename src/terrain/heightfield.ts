// Terrain rings produced by tools/build_terrain.py (DECISIONS D-006). World frame: x = grid east, z = −grid north,
// y = metres above the court datum (1625.0 m asl, SITE_SPEC global.court_asl).
export interface RingMeta { half: number; cell: number; n: number; asl_min: number; step: number; file: string; min: number; max: number }
export interface TerrainMeta { court_asl: number; rings: Record<'near' | 'mid' | 'far', RingMeta> }

/** Earth curvature seen through standard atmospheric refraction: a point at distance d from the grid origin appears
 *  d²(1 − k)/(2R) lower. R = mean Earth radius (A); k = 0.13, the conventional terrestrial refraction coefficient (B; it
 *  varies with the air's temperature gradient). The drop is 1 cm at 0.4 km, 0.27 m at 2 km, 110 m at 40 km, 300 m at 66 km:
 *  negligible on the Terrace, but it sets how far ranges rise above the skyline (plain.json horizon_check, Q-053). It is
 *  applied relative to the grid origin (the Apadana), not the eye: for an eye up to 6 km away the skyline error stays
 *  below ~0.05°, and the extra tilt of the local ground below 0.05°. Rendered and walked heights include it; aslAt()
 *  removes it again, so elevations stay true. */
export const CURVATURE = { R: 6371000, k: 0.13 };
export const curvatureDrop = (x: number, z: number) => ((x * x + z * z) * (1 - CURVATURE.k)) / (2 * CURVATURE.R);

export class Ring {
  readonly h: Float32Array; // apparent heights relative to court (curvature included), row-major, row 0 = grid north edge (y = +half)
  constructor(readonly meta: RingMeta, raw: Uint16Array, courtAsl: number) {
    this.h = new Float32Array(raw.length);
    const off = meta.asl_min - courtAsl, n = meta.n;
    for (let r = 0; r < n; r++) { const z = r * meta.cell - meta.half;
      for (let c = 0; c < n; c++) { const i = r * n + c, x = c * meta.cell - meta.half; this.h[i] = off + raw[i] * meta.step - curvatureDrop(x, z); } }
  }
  get n() { return this.meta.n; }
  get cell() { return this.meta.cell; }
  get half() { return this.meta.half; }
  contains(x: number, z: number, margin = 0) { const hf = this.half - margin; return x >= -hf && x <= hf && z >= -hf && z <= hf; }
  /** bilinear height at world (x, z) */
  heightAt(x: number, z: number): number {
    const { n, cell, half } = this;
    const gx = (x + half) / cell, gy = (z + half) / cell; // world z = −north, row 0 = north ⇒ row = (z + half)/cell
    const c0 = Math.max(0, Math.min(n - 2, Math.floor(gx))), r0 = Math.max(0, Math.min(n - 2, Math.floor(gy)));
    const fx = Math.max(0, Math.min(1, gx - c0)), fy = Math.max(0, Math.min(1, gy - r0));
    const i = r0 * n + c0, h = this.h;
    return (h[i] * (1 - fx) + h[i + 1] * fx) * (1 - fy) + (h[i + n] * (1 - fx) + h[i + n + 1] * fx) * fy;
  }
  /** the drawn and walked surface: each cell split into two triangles along its (r, c+1)–(r+1, c) diagonal, exactly as
   *  the terrain mesh indexes it (terrainMesh.ts) and as Rapier's heightfield subdivides it (parry's default; measured,
   *  tests/terrain_walk.test.ts). The bilinear heightAt differs from it by up to a quarter of a cell's twist: 0.47 m on the
   *  mid ring's mountain (audit D M1, "feet visibly sinking or floating on slopes"). */
  surfaceAt(x: number, z: number): number {
    const { n, cell, half } = this;
    const gx = (x + half) / cell, gy = (z + half) / cell;
    const c0 = Math.max(0, Math.min(n - 2, Math.floor(gx))), r0 = Math.max(0, Math.min(n - 2, Math.floor(gy)));
    const fx = Math.max(0, Math.min(1, gx - c0)), fy = Math.max(0, Math.min(1, gy - r0));
    const i = r0 * n + c0, h = this.h;
    if (fx + fy <= 1) return h[i] + (h[i + 1] - h[i]) * fx + (h[i + n] - h[i]) * fy;
    const d = h[i + n + 1]; return d + (h[i + n] - d) * (1 - fx) + (h[i + 1] - d) * (1 - fy);
  }
  at(r: number, c: number) { return this.h[r * this.n + c]; }
}

/** one drawn terrain chunk (terrainMesh.ts) and the collider built from the same samples (physics.ts): `cells` × `cells`
 *  ring cells from sample (r0, c0); world rectangle x0 … x0 + size, z0 … z0 + size */
export interface TerrainChunk { key: string; ring: Ring; ringName: 'near' | 'mid' | 'far'; r0: number; c0: number; cells: number; x0: number; z0: number; size: number }
/** chunk size in ring cells: 128 for the near and mid rings; the far ring (±71.7 km, 80 m cells) 256 (48 draw calls instead
 *  of 192, and the mid ring's hole is exactly one chunk: mid half-size 10,240 m = 128 far cells) */
export const CHUNK_CELLS = { near: 128, mid: 128, far: 256 } as const;

export class Terrain {
  constructor(readonly meta: TerrainMeta, readonly near: Ring, readonly mid: Ring, readonly far: Ring) {}
  static async load(base = ''): Promise<Terrain> {
    const meta: TerrainMeta = await (await fetch(`${base}generated/terrain.json`)).json();
    const get = async (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(await (await fetch(`${base}${meta.rings[k].file}`)).arrayBuffer()), meta.court_asl);
    const [a, b, c] = await Promise.all([get('near'), get('mid'), get('far')]);
    return new Terrain(meta, a, b, c);
  }
  /** the ring drawn (and walked) at (x, z): each ring owns its whole extent minus the finer ring's (terrainMesh.ts draws
   *  the near ring to ±2,048 m, the mid ring to ±10,240 m, the far ring beyond; the rings agree along the seams to 0.02 m) */
  ringAt(x: number, z: number): Ring { return this.near.contains(x, z) ? this.near : this.mid.contains(x, z) ? this.mid : this.far; }
  /** the drawn ground at world (x, z): the owning ring's triangles, which is also the walked ground (physics.ts builds its
   *  colliders from the same chunks). Used for everything about the player's feet (the safety net, the bots, the tests).
   *  Until audit D (session 8) the collider switched rings at 1,984 / 9,984 m while the drawing switched at 2,048 / 10,240 m
   *  (the player fell through the mountain there: 12 of 24 crossings). */
  surfaceAt(x: number, z: number): number { return this.ringAt(x, z).surfaceAt(x, z); }
  /** placement height (bilinear; ring switches at 2,040 / 10,208 m) that everything placed on the ground was built with.
   *  It differs from the drawn surface by up to ~0.5 m on the mid ring's slopes (objects float or sink there: Q-645); moving
   *  placement to surfaceAt changes generated layouts (tried in session 8: a village compound moved so a population route
   *  crossed a wall, and the plain gained a 41st mesh over its budget of 40), so it waits for those fixes. */
  heightAt(x: number, z: number): number {
    if (this.near.contains(x, z, 8)) return this.near.heightAt(x, z);
    if (this.mid.contains(x, z, 32)) return this.mid.heightAt(x, z);
    return this.far.heightAt(x, z);
  }
  private _chunks: TerrainChunk[] | null = null;
  /** every drawn chunk: each ring split into CHUNK_CELLS chunks, a coarser ring skipping those inside the finer ring (the
   *  ring extents are chunk-aligned by construction) */
  chunks(): TerrainChunk[] {
    if (this._chunks) return this._chunks;
    const out: TerrainChunk[] = [];
    for (const [ringName, ring, holeHalf] of [['near', this.near, null], ['mid', this.mid, this.near.half], ['far', this.far, this.mid.half]] as const) {
      const CH = CHUNK_CELLS[ringName], nChunks = (ring.n - 1) / CH;
      if (!Number.isInteger(nChunks)) throw new Error(`terrain ring of ${ring.n} samples is not a whole number of ${CH}-cell chunks`);
      for (let cr = 0; cr < nChunks; cr++) for (let cc = 0; cc < nChunks; cc++) {
        const x0 = -ring.half + cc * CH * ring.cell, z0 = -ring.half + cr * CH * ring.cell, size = CH * ring.cell;
        if (holeHalf !== null && x0 >= -holeHalf - 1e-6 && x0 + size <= holeHalf + 1e-6 && z0 >= -holeHalf - 1e-6 && z0 + size <= holeHalf + 1e-6) continue;
        out.push({ key: `${ringName}:${cr}:${cc}`, ring, ringName, r0: cr * CH, c0: cc * CH, cells: CH, x0, z0, size });
      }
    }
    return (this._chunks = out);
  }
  /** the drawn chunks whose rectangle comes within r metres of (x, z) (square distance, per axis) */
  chunksNear(x: number, z: number, r: number): TerrainChunk[] {
    const out: TerrainChunk[] = [];
    for (const [ringName, ring] of [['near', this.near], ['mid', this.mid], ['far', this.far]] as const) {
      const size = CHUNK_CELLS[ringName] * ring.cell, nC = (ring.n - 1) / CHUNK_CELLS[ringName];
      const lo = (v: number) => Math.max(0, Math.floor((v - r + ring.half) / size)), hi = (v: number) => Math.min(nC - 1, Math.floor((v + r + ring.half) / size));
      const c0 = lo(x), c1 = hi(x), r0 = lo(z), r1 = hi(z);
      if (c0 > c1 || r0 > r1) continue;
      const all = this.chunks();
      for (let cr = r0; cr <= r1; cr++) for (let cc = c0; cc <= c1; cc++) { const k = this.chunkIndex().get(`${ringName}:${cr}:${cc}`); if (k !== undefined) out.push(all[k]); }
    }
    return out;
  }
  private _index: Map<string, number> | null = null;
  private chunkIndex() { if (!this._index) { this._index = new Map(); this.chunks().forEach((c, i) => this._index!.set(c.key, i)); } return this._index; }
  /** true elevation above sea level (the apparent curvature drop removed) */
  aslAt(x: number, z: number) { return this.heightAt(x, z) + curvatureDrop(x, z) + this.meta.court_asl; }
}

/** grid (east, north) → world (x, z) */
export const gridToWorld = (east: number, north: number): [number, number] => [east, -north];
