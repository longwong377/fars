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
  at(r: number, c: number) { return this.h[r * this.n + c]; }
}

export class Terrain {
  constructor(readonly meta: TerrainMeta, readonly near: Ring, readonly mid: Ring, readonly far: Ring) {}
  static async load(base = ''): Promise<Terrain> {
    const meta: TerrainMeta = await (await fetch(`${base}generated/terrain.json`)).json();
    const get = async (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(await (await fetch(`${base}${meta.rings[k].file}`)).arrayBuffer()), meta.court_asl);
    const [a, b, c] = await Promise.all([get('near'), get('mid'), get('far')]);
    return new Terrain(meta, a, b, c);
  }
  heightAt(x: number, z: number): number {
    if (this.near.contains(x, z, 8)) return this.near.heightAt(x, z);
    if (this.mid.contains(x, z, 32)) return this.mid.heightAt(x, z);
    return this.far.heightAt(x, z);
  }
  /** true elevation above sea level (the apparent curvature drop removed) */
  aslAt(x: number, z: number) { return this.heightAt(x, z) + curvatureDrop(x, z) + this.meta.court_asl; }
}

/** grid (east, north) → world (x, z) */
export const gridToWorld = (east: number, north: number): [number, number] => [east, -north];
