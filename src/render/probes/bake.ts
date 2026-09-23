// Light-probe bake (D-110, D-111): the ambient light that each roofed building's doors, windows and porticoes let in,
// computed by ray casting against the architecture's parts (trace.ts). Build time only: tools/build_probes.ts runs it in
// worker processes and writes public/generated/probes.{f16,json}; the tests run it on synthetic rooms.
//
// Model (tier C; every constant below is C):
//  • Fixed directions over the sphere (Fibonacci), the same set for every probe (spatially coherent error, no speckle
//    between neighbouring probes): 4096 occlusion rays for the sky seen directly, 1024 closest-hit rays for the bounces
//    (a 4 × 10 m doorway 15 m away is ~50 of them). Each ray's radiance is projected onto L1:
//    E(n) ≈ ¼∫L dω + ½(∫L ω dω)·n, the irradiance of the two lowest spherical-harmonic bands (exact for a sky hemisphere).
//  • A ray that escapes upward sees the sky, a uniform radiance S/π: the hemisphere light's own sky model (D-060 ties S
//    to the calibrated dome). The distant mountains are not occluders (the hemisphere light ignores them too).
//  • A ray that escapes downward (off the Terrace edge) sees the plain: open, sunlit, level ground of the earth albedo.
//  • A ray that hits a part sees that surface's outgoing radiance ρ/π · (S·Ŝ + U·σ + second bounce):
//      Ŝ = the sky irradiance at the hit per unit S: from the pass-0 probe field where the hit is inside a volume, else
//          from 2 cosine-weighted rays (the fraction that reach the sky; averaged over the probe's many hits);
//      σ = the direct sun on the hit per unit horizontal sun irradiance, averaged over the simulated year's daylight
//          (every 15 days, every half hour, weighted by the clear-sky horizontal irradiance) from 2 importance-sampled
//          shadow rays: the sun patch that the renderer's shadow map draws at one hour is here its yearly mean, so the
//          bounce does not follow the sun through the day (C);
//      second bounce: ρ · (pass-1 bounce field at the hit), for hits inside a volume (outdoor hits: first bounce only).
//  • Colour: the bounce carries the albedos' colour (a per-probe tint), weighted by a typical daytime sun/sky ratio.
import type { Part, Manifest, Material } from '../../arch/parts';
import { TraceScene, sceneFromParts, srgbToLinear, lum, RGB } from './trace';
import { ProbeField, ProbeVolume, PROBE_STRIDE, sampleField, probePosition, probeIndex } from './field';
import { sunHorizon, azAltToWorld } from '../../sky/ephemeris';
import { WorldClock, YEAR_DAYS } from '../../core/clock';

export interface BakeOptions {
  /** horizontal probe spacing (m) */ spacing: number;
  /** target vertical spacing between probe layers (m) */ layer: number;
  /** grid margin beyond the roofed footprint (m) */ margin: number;
  /** the weight is 1 up to this far beyond the roof edge, then falls to 0 at the grid edge (m) */ full: number;
  /** first and last layer inset from the floor and the ceiling (m) */ inset: number;
  /** runtime normal offset of the lookup point (m) */ normalBias: number;
  /** directions per probe: occlusion rays for the sky seen directly (pass 0), closest-hit rays for the bounces */
  skyDirs: number; rays: number;
  /** shadow rays per bounce hit toward the sun, and cosine rays toward the sky (outdoor hits) */
  sunRays: number; skyRays: number;
  /** typical daytime ratio of horizontal sun to sky irradiance, for the bounce colour only */ sunSkyRatio: number;
}
export const BAKE: BakeOptions = { spacing: 2, layer: 2.5, margin: 6, full: 2, inset: 0.25, normalBias: 0.9, skyDirs: 4096, rays: 1024, sunRays: 2, skyRays: 2, sunSkyRatio: 3 };

// ------------------------------------------------------------------ volumes
/** one volume per building with roof parts: the roofs' footprint plus the margin; layers from the floor (manifest room
 *  floor) to the roof's underside. Volumes whose margins would overlap are trimmed at the midline between them. */
export function probeVolumes(parts: Part[], manifest: Manifest, o: BakeOptions = BAKE): ProbeVolume[] {
  const byB = new Map<string, { x0: number; x1: number; z0: number; z1: number; ceil: number; top: number }>();
  for (const p of parts) {
    if (p.kind !== 'roof' || p.type !== 'box') continue;
    const c = Math.cos(p.rot ?? 0), s = Math.sin(p.rot ?? 0), hx = p.size[0] / 2, hz = p.size[1] / 2;
    const ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz;
    const r = byB.get(p.building) ?? { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, ceil: Infinity, top: -Infinity };
    r.x0 = Math.min(r.x0, p.c[0] - ex); r.x1 = Math.max(r.x1, p.c[0] + ex); r.z0 = Math.min(r.z0, -p.c[1] - ez); r.z1 = Math.max(r.z1, -p.c[1] + ez);
    r.ceil = Math.min(r.ceil, p.y0); r.top = Math.max(r.top, p.y1); byB.set(p.building, r);
  }
  const vols: ProbeVolume[] = []; let offset = 0;
  const boxes = [...byB.entries()].map(([b, r]) => ({ b, r, m: { x0: r.x0 - o.margin, x1: r.x1 + o.margin, z0: r.z0 - o.margin, z1: r.z1 + o.margin } }));
  for (const A of boxes) for (const B of boxes) { // trim overlapping margins at the midline between the roofs
    if (A === B) continue;
    const ox = Math.min(A.m.x1, B.m.x1) - Math.max(A.m.x0, B.m.x0), oz = Math.min(A.m.z1, B.m.z1) - Math.max(A.m.z0, B.m.z0);
    if (ox <= 0 || oz <= 0) continue;
    if (ox < oz) { if (A.r.x1 <= B.r.x0) { const mid = (A.r.x1 + B.r.x0) / 2; A.m.x1 = Math.min(A.m.x1, mid - 0.1); } else if (B.r.x1 <= A.r.x0) { const mid = (B.r.x1 + A.r.x0) / 2; A.m.x0 = Math.max(A.m.x0, mid + 0.1); } }
    else { if (A.r.z1 <= B.r.z0) { const mid = (A.r.z1 + B.r.z0) / 2; A.m.z1 = Math.min(A.m.z1, mid - 0.1); } else if (B.r.z1 <= A.r.z0) { const mid = (B.r.z1 + A.r.z0) / 2; A.m.z0 = Math.max(A.m.z0, mid + 0.1); } }
  }
  for (const { b, r, m } of boxes) {
    const room = (manifest[b] as any)?.room as number[] | undefined;
    const floor = room ? room[4] : 0;
    const nx = Math.ceil((m.x1 - m.x0) / o.spacing) + 1, nz = Math.ceil((m.z1 - m.z0) / o.spacing) + 1;
    const y0 = floor + o.inset, y1 = r.ceil - o.inset, ny = Math.max(2, Math.ceil((y1 - y0) / o.layer) + 1);
    vols.push({ building: b, origin: [m.x0, y0, m.z0], spacing: [o.spacing, (y1 - y0) / (ny - 1), o.spacing], dims: [nx, ny, nz],
      roof: [r.x0, r.x1, r.z0, r.z1], full: o.full, yLo: [floor - 1, floor - 0.05], yHi: [r.ceil, r.top], offset });
    offset += nx * ny * nz;
  }
  return vols;
}

// ------------------------------------------------------------------ sun over the year
/** the sun's positions over the simulated year: every `dayStep` days, every half hour, above 3° (true positions for
 *  467 BCE from the ephemeris the sky uses, turned into world directions) */
export function yearSunSamples(dayStep = 15, days = YEAR_DAYS): { dir: [number, number, number]; alt: number }[] {
  const out: { dir: [number, number, number]; alt: number }[] = [];
  for (let d = 0; d < days; d += dayStep) for (let h = 4; h <= 20; h += 0.5) {
    const s = sunHorizon(new WorldClock(d, h).jdUT); if (s.altitude <= 3) continue;
    out.push({ dir: azAltToWorld(s.azimuth, s.altitude), alt: s.altitude });
  }
  return out;
}
export interface SunSet { dir: Float64Array; sinAlt: Float64Array; cdf: Float64Array; n: number }
/** sun directions over the simulated year (every `dayStep` days, every half hour, altitude > 3°) with the probability of
 *  each proportional to its clear-sky horizontal irradiance (the sky system's air-mass transmittance, no haze or cloud) */
export function sunSet(samples: { dir: [number, number, number]; alt: number }[]): SunSet {
  const n = samples.length, dir = new Float64Array(n * 3), sinAlt = new Float64Array(n), cdf = new Float64Array(n);
  let acc = 0;
  samples.forEach((s, i) => {
    const alt = s.alt, sa = Math.sin((alt * Math.PI) / 180);
    const airmass = 1 / (sa + 0.50572 * Math.pow(alt + 6.07995, -1.6364)), I = Math.exp(-0.18 * airmass);
    dir.set(s.dir, i * 3); sinAlt[i] = sa; acc += I * sa; cdf[i] = acc;
  });
  for (let i = 0; i < n; i++) cdf[i] /= acc;
  return { dir, sinAlt, cdf, n };
}
function pickSun(S: SunSet, u: number) { let lo = 0, hi = S.n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (S.cdf[m] < u) lo = m + 1; else hi = m; } return lo; }

// ------------------------------------------------------------------ scene and directions
/** the Fibonacci sphere: n unit directions, evenly spread, symmetric about the horizon (as many up as down) */
export function sphereDirs(n: number): Float64Array {
  const d = new Float64Array(n * 3), ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), p = i * ga; d[i * 3] = r * Math.cos(p); d[i * 3 + 1] = y; d[i * 3 + 2] = r * Math.sin(p); }
  return d;
}
/** the surface table in the form the bake needs, from the materials' SURFACES record (render/materials.ts) */
export function surfaceTable(SURF: Record<string, { albedo: [number, number, number]; top?: string; chips?: { cover: number; albedo: [number, number, number] } }>): SurfaceTable {
  const T: SurfaceTable = { albedo: {}, top: {}, chips: {} };
  for (const [k, d] of Object.entries(SURF)) { T.albedo[k] = d.albedo; if (d.top) T.top![k] = d.top; if (d.chips) T.chips![k] = { cover: d.chips.cover, albedo: d.chips.albedo }; }
  return T;
}
export interface SurfaceTable { albedo: Record<string, [number, number, number]>; top?: Record<string, string>; chips?: Record<string, { cover: number; albedo: [number, number, number] }> }
/** linear albedo of a material from the sRGB surface table (materials.ts SURFACES): up-facing faces of a two-surface part
 *  use its `top` surface; scattered chips are mixed in by their cover */
export function albedoFn(T: SurfaceTable) {
  const lin = (a: [number, number, number]): RGB => [srgbToLinear(a[0]), srgbToLinear(a[1]), srgbToLinear(a[2])];
  const one = (m: string): RGB => {
    const a = lin(T.albedo[m] ?? T.albedo.limestone), c = T.chips?.[m];
    if (!c) return a; const b = lin(c.albedo); return [a[0] * (1 - c.cover) + b[0] * c.cover, a[1] * (1 - c.cover) + b[1] * c.cover, a[2] * (1 - c.cover) + b[2] * c.cover];
  };
  return (m: Material, top: boolean): RGB => one(top && T.top?.[m] ? T.top[m] : m);
}
export function traceScene(parts: Part[], T: SurfaceTable, capitalBoxes: { protome: [number, number]; plain: number; volute: [number, number] },
  members?: (p: Extract<Part, { type: 'column' }>) => { base: Material; shaft: Material; capital: Material }): TraceScene {
  return sceneFromParts(parts, albedoFn(T), capitalBoxes, members);
}

// ------------------------------------------------------------------ per-probe estimators
export interface BakeContext {
  scene: TraceScene; dirs: Float64Array; skyDirs: Float64Array; sun: SunSet; o: BakeOptions;
  /** linear albedo of the open plain beyond the Terrace edge */ plain: RGB;
  /** pass-0 field (slots 0–3: sky seen directly; 11: validity) */ sky?: ProbeField;
  /** pass-1 field (slots 0–3: sky bounce, 4–7: sun bounce, 8–9: tint; 11: validity) */ bounce1?: ProbeField;
}
/** a probe closer than this to a solid (m) is invalid: it would see half of that surface's back and half of its front */
const PROBE_CLEAR = 0.02;
/** deterministic hash → [0, 1) */
function h01(a: number, b: number, c: number) { let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }

/** pass 0: validity and the sky seen directly (L1 in slots 0–3). Returns [a, bx, by, bz, valid]. */
export function probeSky(ctx: BakeContext, x: number, y: number, z: number): number[] {
  if (ctx.scene.inside(x, y, z, -PROBE_CLEAR)) return [0, 0, 0, 0, 0];
  const D = ctx.skyDirs, N = D.length / 3; let a = 0, bx = 0, by = 0, bz = 0;
  for (let i = 0; i < N; i++) {
    const dx = D[i * 3], dy = D[i * 3 + 1], dz = D[i * 3 + 2];
    if (dy <= 0 || ctx.scene.occluded(x, y, z, dx, dy, dz)) continue;
    a += 1; bx += dx; by += dy; bz += dz;
  }
  return [a / N, (2 * bx) / N, (2 * by) / N, (2 * bz) / N, 1];
}

const _smp = { w: 0, v: 0, s: new Float64Array(PROBE_STRIDE) };
/** sky irradiance at a surface point per unit S (0 … 1): from the pass-0 field inside a volume, else cosine-weighted rays */
function skyAt(ctx: BakeContext, px: number, py: number, pz: number, nx: number, ny: number, nz: number, seed: number): number {
  let fromField = 0, w = 0;
  if (ctx.sky) { const s = sampleField(ctx.sky, px, py, pz, nx, ny, nz, _smp); if (s && s.w > 0) { w = s.w; fromField = Math.max(0, s.s[0] + s.s[1] * nx + s.s[2] * ny + s.s[3] * nz); } }
  if (w >= 0.999) return fromField;
  // orthonormal basis about n
  const tx0 = Math.abs(ny) < 0.9 ? 0 : 1, ty0 = Math.abs(ny) < 0.9 ? 1 : 0; // helper axis
  let ux = ty0 * nz - 0 * ny, uy = 0 * nx - tx0 * nz, uz = tx0 * ny - ty0 * nx; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
  const M = ctx.o.skyRays, r0 = h01(seed, 17, 3), r1 = h01(seed, 29, 5); let esc = 0;
  for (let k = 0; k < M; k++) {
    const u1 = (k + r0) / M, u2 = (((k * 0.618034) + r1) % 1); // stratified in u1, golden-ratio in u2
    const rr = Math.sqrt(u1), ph = 2 * Math.PI * u2, a = rr * Math.cos(ph), b = rr * Math.sin(ph), c = Math.sqrt(Math.max(0, 1 - u1));
    const dx = ux * a + vx * b + nx * c, dy = uy * a + vy * b + ny * c, dz = uz * a + vz * b + nz * c;
    if (dy > 0 && !ctx.scene.occluded(px + nx * 0.01, py + ny * 0.01, pz + nz * 0.01, dx, dy, dz)) esc++;
  }
  return w * fromField + (1 - w) * (esc / M);
}
/** direct sun at a surface point per unit horizontal sun irradiance, year-averaged (importance-sampled shadow rays) */
function sunAt(ctx: BakeContext, px: number, py: number, pz: number, nx: number, ny: number, nz: number, seed: number): number {
  const K = ctx.o.sunRays, S = ctx.sun, r = h01(seed, 41, 7); let acc = 0;
  for (let k = 0; k < K; k++) {
    const j = pickSun(S, (k + r) / K), lx = S.dir[j * 3], ly = S.dir[j * 3 + 1], lz = S.dir[j * 3 + 2], c = nx * lx + ny * ly + nz * lz;
    if (c <= 0) continue;
    if (!ctx.scene.occluded(px + nx * 0.01, py + ny * 0.01, pz + nz * 0.01, lx, ly, lz)) acc += c / S.sinAlt[j];
  }
  return acc / K;
}

/** pass 1 (first bounce) or pass 2 (second bounce): returns 8 L1 values (sky-lit bounce 0–3, sun-lit bounce 4–7) and the
 *  colour sums [r, g, b, luminance] (slots 8–11) */
export function probeBounce(ctx: BakeContext, x: number, y: number, z: number, pass: 1 | 2, seed: number): number[] {
  const out = new Array(12).fill(0);
  if (ctx.scene.inside(x, y, z, -PROBE_CLEAR)) return out;
  const D = ctx.dirs, N = D.length / 3, sc = ctx.scene, rho: RGB = [0, 0, 0], k2 = ctx.o.sunSkyRatio;
  const add = (dx: number, dy: number, dz: number, ls: number, lu: number, r: number, g: number, b: number) => {
    // ls, lu: radiance·π of the ray per unit S and U (luminance); rgb: its colour weight
    out[0] += ls; out[1] += 2 * ls * dx; out[2] += 2 * ls * dy; out[3] += 2 * ls * dz;
    out[4] += lu; out[5] += 2 * lu * dx; out[6] += 2 * lu * dy; out[7] += 2 * lu * dz;
    out[8] += r; out[9] += g; out[10] += b; out[11] += lum(r, g, b);
  };
  const plainL = lum(...ctx.plain);
  for (let i = 0; i < N; i++) {
    const dx = D[i * 3], dy = D[i * 3 + 1], dz = D[i * 3 + 2];
    const h = sc.intersect(x, y, z, dx, dy, dz);
    if (!h) { // escaped: the sky (pass 0 counted it) or, below the horizon, the open sunlit plain (first bounce only)
      if (dy <= 0 && pass === 1) { const P = ctx.plain, e = 1 + k2; add(dx, dy, dz, plainL, plainL, P[0] * e, P[1] * e, P[2] * e); }
      continue;
    }
    const px = x + dx * h.t, py = y + dy * h.t, pz = z + dz * h.t, nx = h.nx, ny = h.ny, nz = h.nz;
    sc.albedoAt(h.prim, ny, rho); const rl = lum(rho[0], rho[1], rho[2]);
    if (pass === 1) {
      const S = skyAt(ctx, px, py, pz, nx, ny, nz, seed * 257 + i), U = sunAt(ctx, px, py, pz, nx, ny, nz, seed * 263 + i);
      const e = S + k2 * U; add(dx, dy, dz, rl * S, rl * U, rho[0] * e, rho[1] * e, rho[2] * e);
    } else if (ctx.bounce1) {
      const s = sampleField(ctx.bounce1, px, py, pz, nx, ny, nz, _smp); if (!s || s.w <= 0) continue;
      const bs = Math.max(0, s.s[0] + s.s[1] * nx + s.s[2] * ny + s.s[3] * nz) * s.w, bu = Math.max(0, s.s[4] + s.s[5] * nx + s.s[6] * ny + s.s[7] * nz) * s.w;
      const tr = s.s[8], tb = s.s[9], tg = Math.max(0, (1 - 0.2126 * tr - 0.0722 * tb) / 0.7152), e = bs + k2 * bu;
      add(dx, dy, dz, rl * bs, rl * bu, rho[0] * tr * e, rho[1] * tg * e, rho[2] * tb * e);
    }
  }
  for (let j = 0; j < 8; j++) out[j] /= N;
  return out;
}

/** the three passes over a list of probe positions, in-process (tests; the tool farms the same calls out to workers).
 *  Returns the finished field data (PROBE_STRIDE values per probe). */
export function assemble(sky: number[][], b1: number[][], b2: number[][]): Float32Array {
  const n = sky.length, d = new Float32Array(n * PROBE_STRIDE);
  for (let i = 0; i < n; i++) {
    const A = sky[i], B = b1[i], C = b2[i], o = i * PROBE_STRIDE;
    if (!A[4]) continue;
    for (let j = 0; j < 4; j++) { d[o + j] = A[j] + B[j] + C[j]; d[o + 4 + j] = B[4 + j] + C[4 + j]; }
    const r = B[8] + C[8], g = B[9] + C[9], b = B[10] + C[10], L = B[11] + C[11];
    d[o + 8] = L > 1e-9 ? r / L : 1; d[o + 9] = L > 1e-9 ? b / L : 1; void g;
    const bounceA = B[0] + C[0]; d[o + 10] = d[o] > 1e-9 ? bounceA / d[o] : 0; d[o + 11] = 1;
  }
  return d;
}
/** weight of a probe that is inside a solid but carries its valid neighbours' mean (dilate) */
export const DILATED = 0.02;
/** fill invalid probes (inside solids) with the mean of their valid or already-filled face and edge neighbours, `passes`
 *  rings deep, at a small weight: in the validity-weighted interpolation real probes dominate wherever any is near, and a
 *  lookup whose neighbours are all inside solids (a capital's top against the ceiling) still reads the room it faces
 *  instead of dropping to the unoccluded skylight. */
export function dilate(vols: ProbeVolume[], d: Float32Array, passes = 3): number {
  let filled = 0;
  for (const v of vols) {
    const [nx, ny, nz] = v.dims, idx = (x: number, y: number, z: number) => probeIndex(v, x, y, z);
    for (let pass = 0; pass < passes; pass++) {
      const updates: [number, number[]][] = [];
      for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
        const i = idx(ix, iy, iz); if (d[i * PROBE_STRIDE + 11] > 0) continue;
        const acc = new Array(11).fill(0); let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy && !dz) continue; if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2) continue;
          const x = ix + dx, y = iy + dy, z = iz + dz; if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) continue;
          const j = idx(x, y, z) * PROBE_STRIDE; if (d[j + 11] <= 0) continue;
          for (let k = 0; k < 11; k++) acc[k] += d[j + k]; n++;
        }
        if (n) updates.push([i, acc.map(a => a / n)]);
      }
      for (const [i, vals] of updates) { d.set(vals, i * PROBE_STRIDE); d[i * PROBE_STRIDE + 11] = DILATED; filled++; }
    }
  }
  return filled;
}
/** field from per-probe pass results (for the lookups of the next pass) */
export function fieldOf(vols: ProbeVolume[], values: number[][], slots: (r: number[], i: number) => number[], o: BakeOptions): ProbeField {
  const n = values.length, data = new Float32Array(n * PROBE_STRIDE);
  values.forEach((r, i) => { const s = slots(r, i); data.set(s, i * PROBE_STRIDE); });
  return { volumes: vols, data, count: n, normalBias: o.normalBias, tier: 'C', note: 'bake intermediate' };
}
/** every probe position of the volumes, in data order */
export function probePositions(vols: ProbeVolume[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const v of vols) for (let iy = 0; iy < v.dims[1]; iy++) for (let iz = 0; iz < v.dims[2]; iz++) for (let ix = 0; ix < v.dims[0]; ix++) out.push(probePosition(v, ix, iy, iz));
  return out;
}
/** slot maps between the pass results and the lookup fields */
export const SKY_SLOTS = (r: number[]) => { const s = new Array(PROBE_STRIDE).fill(0); s[0] = r[0]; s[1] = r[1]; s[2] = r[2]; s[3] = r[3]; s[11] = r[4]; return s; };
export const bounceSlots = (valid: (i: number) => number) => (r: number[], i: number) => {
  const s = new Array(PROBE_STRIDE).fill(0); for (let j = 0; j < 8; j++) s[j] = r[j];
  s[8] = r[11] > 1e-9 ? r[8] / r[11] : 1; s[9] = r[11] > 1e-9 ? r[10] / r[11] : 1; s[11] = valid(i); return s;
};
/** whole bake in one process (tests and small scenes) */
export function bakeAll(scene: TraceScene, vols: ProbeVolume[], sun: SunSet, plain: RGB, o: BakeOptions = BAKE): ProbeField {
  const ctx: BakeContext = { scene, dirs: sphereDirs(o.rays), skyDirs: sphereDirs(o.skyDirs), sun, o, plain };
  const pos = probePositions(vols);
  const sky = pos.map(p => probeSky(ctx, ...p));
  ctx.sky = fieldOf(vols, sky, SKY_SLOTS, o); dilate(vols, ctx.sky.data);
  const b1 = pos.map((p, i) => probeBounce(ctx, ...p, 1, i));
  ctx.bounce1 = fieldOf(vols, b1, bounceSlots(i => sky[i][4]), o); dilate(vols, ctx.bounce1.data);
  const b2 = pos.map((p, i) => probeBounce(ctx, ...p, 2, i));
  const data = assemble(sky, b1, b2); dilate(vols, data);
  return { volumes: vols, data, count: pos.length, normalBias: o.normalBias, tier: 'C', note: 'baked light probes (D-110)' };
}
