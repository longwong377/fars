// Tileable 3-D noise volumes for the volumetric clouds (the standard real-time approach: precomputed Perlin–Worley and
// Worley octaves sampled from 3-D textures, as in Schneider 2015, "The real-time volumetric cloudscapes of Horizon: Zero
// Dawn"). Evaluating fractal noise procedurally at every raymarch sample (~160 evaluations per pixel) is too slow for the
// 1440p / 60 fps target. Pure functions (node-testable); the world seed does not enter (fixed seed: the cloud field's
// variety comes from wind drift and the weather's cover, not from the texture).
//  R: Perlin–Worley (low-frequency billowy base shape)   G, B, A: Worley fbm at increasing frequency (erosion detail)

/** integer hash → [0, 1) (deterministic, platform-independent) */
function hash3(x: number, y: number, z: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}

/** tileable Worley F1 at (x, y, z) ∈ [0,1)³ with `cells` cells per axis, returned inverted (1 = at a feature point) */
export function worleyTile(x: number, y: number, z: number, cells: number, seed: number): number {
  const px = x * cells, py = y * cells, pz = z * cells, ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
  let best = 9;
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = ix + dx, cy = iy + dy, cz = iz + dz;
    const wx = ((cx % cells) + cells) % cells, wy = ((cy % cells) + cells) % cells, wz = ((cz % cells) + cells) % cells; // wrap → tileable
    const fx = cx + hash3(wx, wy, wz, seed), fy = cy + hash3(wx, wy, wz, seed + 1), fz = cz + hash3(wx, wy, wz, seed + 2);
    const d = (fx - px) ** 2 + (fy - py) ** 2 + (fz - pz) ** 2; if (d < best) best = d;
  }
  return 1 - Math.min(1, Math.sqrt(best));
}

/** tileable gradient-free value noise with quintic smoothing (period `cells`) */
export function valueTile(x: number, y: number, z: number, cells: number, seed: number): number {
  const px = x * cells, py = y * cells, pz = z * cells, ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
  const q = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const fx = q(px - ix), fy = q(py - iy), fz = q(pz - iz), w = (v: number) => ((v % cells) + cells) % cells;
  const v = (a: number, b: number, c: number) => hash3(w(ix + a), w(iy + b), w(iz + c), seed);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(l(l(v(0, 0, 0), v(1, 0, 0), fx), l(v(0, 1, 0), v(1, 1, 0), fx), fy), l(l(v(0, 0, 1), v(1, 0, 1), fx), l(v(0, 1, 1), v(1, 1, 1), fx), fy), fz);
}

const remap = (v: number, a: number, b: number, c: number, d: number) => c + ((v - a) / (b - a)) * (d - c);

/** RGBA8 volume of size³ (row-major x, then y, then z) */
export function cloudNoiseVolume(size = 64, seed = 7): Uint8Array {
  const out = new Uint8Array(size * size * size * 4);
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size, v = (y + 0.5) / size, w = (z + 0.5) / size;
    // value fbm (3 octaves) as the "Perlin" part, dilated by Worley (Perlin–Worley)
    const pv = valueTile(u, v, w, 4, seed) * 0.57 + valueTile(u, v, w, 8, seed + 9) * 0.28 + valueTile(u, v, w, 16, seed + 19) * 0.15;
    const w1 = worleyTile(u, v, w, 4, seed + 3), w2 = worleyTile(u, v, w, 8, seed + 5), w3 = worleyTile(u, v, w, 16, seed + 7), w4 = worleyTile(u, v, w, 32, seed + 11);
    const wf = w1 * 0.625 + w2 * 0.25 + w3 * 0.125;
    const pw = Math.min(1, Math.max(0, remap(pv, wf - 1, 1, 0, 1)));
    const i = ((z * size + y) * size + x) * 4;
    out[i] = Math.round(pw * 255);
    out[i + 1] = Math.round(wf * 255);
    out[i + 2] = Math.round((w2 * 0.625 + w3 * 0.25 + w4 * 0.125) * 255);
    out[i + 3] = Math.round((w3 * 0.625 + w4 * 0.375) * 255);
  }
  return out;
}

/** the volume flattened into a 2-D atlas: slice z at tile (z % 8, floor(z / 8)); each 64² tile carries a 1-texel border
 *  copied from the opposite edge (wrap), so bilinear filtering inside a tile tiles seamlessly. Returns the RGBA8 pixels
 *  of a (8·(size+2))² texture. (A 3-D texture was bound through a 2-D view by the r186 WebGPU backend: validation error,
 *  black frame. The atlas works on WebGPU and WebGL2 alike.) */
export function cloudNoiseAtlas(vol: Uint8Array, size = 64, tilesPerRow = 8): { data: Uint8Array; width: number; tile: number } {
  const T = size + 2, W = T * tilesPerRow, out = new Uint8Array(W * W * 4);
  for (let z = 0; z < size; z++) {
    const ox = (z % tilesPerRow) * T, oy = Math.floor(z / tilesPerRow) * T;
    for (let y = -1; y <= size; y++) for (let x = -1; x <= size; x++) {
      const sx = (x + size) % size, sy = (y + size) % size, si = ((z * size + sy) * size + sx) * 4, di = ((oy + y + 1) * W + (ox + x + 1)) * 4;
      out[di] = vol[si]; out[di + 1] = vol[si + 1]; out[di + 2] = vol[si + 2]; out[di + 3] = vol[si + 3];
    }
  }
  return { data: out, width: W, tile: T };
}
