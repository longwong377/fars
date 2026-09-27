// CPU mirror of three r186's MaterialX Perlin noise (src/nodes/materialx/MaterialXNoise.js: mx_perlin_noise_float for
// vec3 and vec2, the Jenkins lookup3 hash, the 12-direction gradient trick and the quintic fade), so the statistics of the
// procedural surface functions in src/render/materials.ts can be measured in node (D-157). Integer ops follow the shader
// (uint32 wrap-around); float arithmetic is double here, float32 on the GPU (statistics agree to far better than 1 %).

const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;
function bjfinal(a: number, b: number, c: number) {
  c = (c ^ b) >>> 0; c = (c - rotl(b, 14)) >>> 0;
  a = (a ^ c) >>> 0; a = (a - rotl(c, 11)) >>> 0;
  b = (b ^ a) >>> 0; b = (b - rotl(a, 25)) >>> 0;
  c = (c ^ b) >>> 0; c = (c - rotl(b, 16)) >>> 0;
  a = (a ^ c) >>> 0; a = (a - rotl(c, 4)) >>> 0;
  b = (b ^ a) >>> 0; b = (b - rotl(a, 14)) >>> 0;
  c = (c ^ b) >>> 0; c = (c - rotl(b, 24)) >>> 0;
  return c;
}
const SEED3 = (0xdeadbeef + (3 << 2) + 13) >>> 0, SEED2 = (0xdeadbeef + (2 << 2) + 13) >>> 0;
const hash3 = (x: number, y: number, z: number) => bjfinal((SEED3 + (x >>> 0)) >>> 0, (SEED3 + (y >>> 0)) >>> 0, (SEED3 + (z >>> 0)) >>> 0);
const hash2 = (x: number, y: number) => bjfinal((SEED2 + (x >>> 0)) >>> 0, (SEED2 + (y >>> 0)) >>> 0, SEED2);
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
function grad3(h: number, x: number, y: number, z: number) {
  h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
function grad2(h: number, x: number, y: number) {
  h &= 7; const u = h < 4 ? x : y, v = 2 * (h < 4 ? y : x);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** mx_noise_float(vec3): MaterialX Perlin noise, ~[−1, 1] */
export function mxNoise3(px: number, py: number, pz: number): number {
  const X = Math.floor(px), Y = Math.floor(py), Z = Math.floor(pz), fx = px - X, fy = py - Y, fz = pz - Z;
  const u = fade(fx), v = fade(fy), w = fade(fz);
  const g = (i: number, j: number, k: number) => grad3(hash3(X + i, Y + j, Z + k), fx - i, fy - j, fz - k);
  const r = lerp(lerp(lerp(g(0, 0, 0), g(1, 0, 0), u), lerp(g(0, 1, 0), g(1, 1, 0), u), v), lerp(lerp(g(0, 0, 1), g(1, 0, 1), u), lerp(g(0, 1, 1), g(1, 1, 1), u), v), w);
  return 0.982 * r;
}
/** mx_noise_float(vec2) */
export function mxNoise2(px: number, py: number): number {
  const X = Math.floor(px), Y = Math.floor(py), fx = px - X, fy = py - Y, u = fade(fx), v = fade(fy);
  const g = (i: number, j: number) => grad2(hash2(X + i, Y + j), fx - i, fy - j);
  return 0.6616 * lerp(lerp(g(0, 0), g(1, 0), u), lerp(g(0, 1), g(1, 1), u), v);
}
/** Dave Hoskins' "hash without sine" (hash12 / hash11), as the shader's `hash12` in materials.ts: [0, 1) */
export function hash12(x: number, y: number): number {
  const fr = (a: number) => a - Math.floor(a);
  let p0 = fr(x * 0.1031), p1 = fr(y * 0.1031), p2 = fr(x * 0.1031);
  const d = p0 * (p1 + 33.33) + p1 * (p2 + 33.33) + p2 * (p0 + 33.33);
  p0 += d; p1 += d; p2 += d;
  return fr((p0 + p1) * p2);
}
/** a deterministic uniform sampler for the tests (mulberry32) */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
