// Terrain horizon map (session 4, D-156; triage item 7): for every texel of three nested square grids around the
// Terrace, the elevation of the skyline in 36 azimuths, so the sun and the moon can set behind Kuh-e Rahmat, the
// western ranges and every ridge of the plain. Before, only the near terrain ring (±2 km) cast shadows and only within the
// 600 m of the cascaded shadow maps: at 05:51 on day 0 the Terrace rendered in full sun while the mountain behind it
// stood ~9.6° above the landing in the sun's direction (first sun on the Grand Stair landing: ~06:26, tests).
//
// Data (tools/build_horizon.ts, from the committed terrain rings; tier C as a derived product of the B heightfield):
//  • levels: ±5,120 m at 40 m (256²) centred at grid (−600 E, 1,800 N), which holds the Terrace, Naqsh-e Rustam, the town
//    and the plain views; ±20,480 m at 256 m (160²) and ±71,680 m at 1,120 m (128², "flat": no height model, the far
//    ranges' receivers are the ground) centred on the Apadana;
//  • per texel a reference height R = the ground (bilinear DEM) + 1 m; per azimuth the skyline elevation seen from R (e0)
//    and from R + 50 m (e50), and (on the valley floor, R < 1,700 m asl) the slopes of the two occluders that define them. The skyline as a function of the
//    receiver's height is the upper envelope of one falling line per occluder, e ≈ (h − y)/d: near the Terrace a foothill
//    460 m off defines it at the court and the crest 2.9 km off above ~14 m (Apadana, toward 80°), so a chord between two
//    heights is off by up to 1.1°. The map keeps two lines, e(y') = max(e0 − k1·y', e50 − k2·(y' − 50)), y' = y − R: exact
//    at both heights and at one change of occluder between them (the column tops get the sun ~7 min before the court);
//  • skyline = the maximum over the ray of atan((h − y − d²(1 − k)/2R) / d): true DEM heights, the Earth's curvature
//    seen through standard terrestrial refraction (k = 0.13, as the terrain rings), occluders from one texel out to the
//    far ring's edge (nearer ones are the shadow maps' business);
//  • azimuths (true) 50° … 312.5° in 7.5° steps: every azimuth the sun (62.7° … 297.3° at rising and setting at 29.9° N)
//    and the moon (≥ 56° at the major standstill) can have, via the south; the northern sky is never needed.
// Encoding: e0 in 0.25° steps from −4°; Δ = e0 − e50 in 0.25° steps (≤ 63.75°: 40 m below a steep slope it reaches ~60°); the lines' slopes as their excess over the chord's
// (k1 − Δ/50, Δ/50 − k2: 0 where one occluder defines both heights, log-coded otherwise); R in 5 cm steps from 1400 m asl;
// e0, Δ and R delta-coded along x; deflated (horizon_map.dat, ~3 MB).
// Use: the CPU samples it (the eye, the ground bounce, tests); per frame the sky system interpolates the sun's and the
// moon's azimuth into small RGBA16F atlases (horizonShadow.ts): the sun's lines (e0, k1, e50, k2) with a static reference
// height atlas, the moon's chord (e0, slope, reference y); the lights' colour nodes read them per fragment.

/** degrees → radians */
const DEG = Math.PI / 180;
export const EARTH_R = 6371000, REFRACTION_K = 0.13;
/** curvature drop seen through terrestrial refraction, d²(1 − k)/(2R) (m) */
export const curvDrop = (d: number) => (d * d * (1 - REFRACTION_K)) / (2 * EARTH_R);

export interface HorizonLevelMeta { half: number; n: number; dmin: number; /** world centre (default the grid origin) */ cx?: number; cz?: number; /** no height model stored (Δ = 0) */ flat?: boolean }
export interface HorizonMeta {
  version: number; tier: string; note: string;
  azimuths: { a0: number; da: number; n: number };
  elev: { e0: number; step: number };
  dl: { h: number; step: number };
  /** slope excess code: x = unit · (2^(q / perOctave) − 1) deg/m */
  slope: { unit: number; perOctave: number };
  /** the slopes are stored only below this reference height (m asl) */
  slopeBelowAsl?: number;
  ref: { offset: number; asl0: number; step: number };
  court_asl: number;
  levels: HorizonLevelMeta[];
  file: string; bytes: number;
}
export interface HorizonLevel { half: number; n: number; cell: number; dmin: number; flat: boolean; cx: number; cz: number;
  /** reference height asl (m) per texel (row-major, row = z) */ ref: Float32Array;
  /** per azimuth plane (nAz × n × n): skyline code at R, drop to R + h, and the two lines' slope excess codes */
  e0: Uint8Array; dl: Uint8Array; x1: Uint8Array; x2: Uint8Array }

/** the default layout (tools/build_horizon.ts writes it into the meta) */
export const HORIZON_LAYOUT = {
  // the fine level is centred at grid (−600 E, 1,800 N): the Terrace, Naqsh-e Rustam (6.1 km N), the town, the Pulvar and
  // the field views all lie inside it (a square on the Apadana stopped 1 km short of the tombs)
  levels: [{ half: 5120, n: 256, dmin: 40, cx: -600, cz: -1800 }, { half: 20480, n: 160, dmin: 256 }, { half: 71680, n: 128, dmin: 1120, flat: true }] as HorizonLevelMeta[],
  azimuths: { a0: 50, da: 7.5, n: 36 },
  elev: { e0: -4, step: 0.25 },
  dl: { h: 50, step: 0.25 },
  slope: { unit: 0.002, perOctave: 24 },
  ref: { offset: 1, asl0: 1400, step: 0.05 },
  /** the two-line slopes are kept only where R is below this (m asl): the valley floor, the Terrace, the town and the foot
   *  of Naqsh-e Rustam, where buildings and people stand well above the ground; on the mountains the receivers are the
   *  ground (and trees), and the chord between R and R + 50 m serves (it keeps ~⅔ of the slope planes' size out) */
  slopeBelowAsl: 1700,
};
/** below this elevation (deg) nothing is shadowed ("open": before the map loads, or without one) */
export const HORIZON_OPEN = -90;
/** the sun's apparent angular radius (deg): a smoothstep over the disc */
export const SUN_RADIUS_DEG = 0.2665;
/** slope excess (deg/m) → code; excesses under 1.5 units (0.15° over 50 m) are 0, so quantisation noise in e0 and Δ does not
 *  invent a second occluder */
export const slopeCode = (x: number, s = HORIZON_LAYOUT.slope) => x < 1.5 * s.unit ? 0 : Math.min(255, Math.round(s.perOctave * Math.log2(1 + x / s.unit)));
export const slopeValue = (q: number, s = HORIZON_LAYOUT.slope) => s.unit * (Math.pow(2, q / s.perOctave) - 1);

/** one texel's skyline model for an azimuth: elevation at R (e0), at R + h (e50), and the two lines' slopes (deg/m) */
interface Lines { e0: number; e50: number; k1: number; k2: number }

export class HorizonMap {
  readonly nAz: number; readonly a0: number; readonly da: number;
  private slopeLut: Float32Array;
  constructor(readonly meta: HorizonMeta, readonly levels: HorizonLevel[]) {
    this.nAz = meta.azimuths.n; this.a0 = meta.azimuths.a0; this.da = meta.azimuths.da;
    this.slopeLut = Float32Array.from({ length: 256 }, (_, q) => slopeValue(q, meta.slope));
  }
  /** the azimuth planes and weight bracketing a true azimuth (deg), clamped to the stored band */
  azPlanes(azTrue: number): [number, number, number] {
    const a = ((azTrue % 360) + 360) % 360;
    const f = Math.max(0, Math.min(this.nAz - 1, (a - this.a0) / this.da)), i0 = Math.min(this.nAz - 2, Math.floor(f));
    return [i0, i0 + 1, f - i0];
  }
  /** the decoded lines of one texel, linear between azimuth planes (i0, i1, t) */
  lines(L: HorizonLevel, k: number, i0: number, i1: number, t: number, out: Lines): Lines {
    const nn = L.n * L.n, E = this.meta.elev, D = this.meta.dl, a = i0 * nn + k, b = i1 * nn + k, S = this.slopeLut;
    const e0 = E.e0 + E.step * (L.e0[a] * (1 - t) + L.e0[b] * t), dl = D.step * (L.dl[a] * (1 - t) + L.dl[b] * t), sc = dl / D.h;
    out.e0 = e0; out.e50 = e0 - dl;
    out.k1 = sc + S[L.x1[a]] * (1 - t) + S[L.x1[b]] * t; out.k2 = Math.max(0, sc - (S[L.x2[a]] * (1 - t) + S[L.x2[b]] * t));
    return out;
  }
  private tmp: Lines = { e0: 0, e50: 0, k1: 0, k2: 0 };
  /** index of the finest level that holds (x, z) away from its edge, and the blend weight toward the next (0 = this only) */
  levelAt(x: number, z: number): { l: number; w: number } {
    for (let l = 0; l < this.levels.length; l++) {
      const L = this.levels[l], m = Math.max(Math.abs(x - L.cx), Math.abs(z - L.cz)), lo = L.half - 10 * L.cell, hi = L.half - 2 * L.cell;
      if (m < hi || l === this.levels.length - 1) { const t = Math.min(1, Math.max(0, (m - lo) / (hi - lo))); return { l, w: l === this.levels.length - 1 ? 0 : t * t * (3 - 2 * t) }; }
    }
    return { l: this.levels.length - 1, w: 0 };
  }
  /** skyline elevation (deg) of one level at world (x, z) for a receiver at height `asl` (m above sea level), toward a
   *  true azimuth — exactly the shader's formula (horizonShadow.ts): the texels' parameters (e0, k1, e50, k2 and R) are
   *  interpolated bilinearly, then the two lines' maximum is taken at the receiver's height above the interpolated R
   *  (`chord`: the single line through e0 and e50 instead, as the moon's atlas stores it). On steep ground this is as
   *  accurate against the DEM as evaluating each texel at the receiver's height first, and never extrapolates a texel's
   *  model to a point tens of metres inside its hill. */
  levelElevation(l: number, x: number, z: number, asl: number, azTrue: number, chord = false): number {
    const L = this.levels[l], [i0, i1, t] = this.azPlanes(azTrue), H = this.meta.dl.h, q = this.tmp;
    const gx = Math.max(0, Math.min(L.n - 1.000001, (x - L.cx + L.half) / L.cell - 0.5)), gz = Math.max(0, Math.min(L.n - 1.000001, (z - L.cz + L.half) / L.cell - 0.5));
    const c0 = Math.floor(gx), r0 = Math.floor(gz), fx = gx - c0, fz = gz - r0;
    let e0 = 0, e50 = 0, k1 = 0, k2 = 0, R = 0;
    for (const [r, c, w] of [[r0, c0, (1 - fx) * (1 - fz)], [r0, c0 + 1, fx * (1 - fz)], [r0 + 1, c0, (1 - fx) * fz], [r0 + 1, c0 + 1, fx * fz]] as const) {
      if (w <= 0) continue; const k = r * L.n + c; this.lines(L, k, i0, i1, t, q);
      e0 += w * q.e0; e50 += w * q.e50; k1 += w * q.k1; k2 += w * q.k2; R += w * L.ref[k];
    }
    const y = asl - R;
    if (L.flat) return e0;
    return chord ? e0 - ((e0 - e50) * y) / H : Math.max(e0 - k1 * y, e50 - k2 * (y - H));
  }
  /** skyline elevation (deg) at world (x, z) for a receiver at `asl` toward a true azimuth, blended across levels */
  elevation(x: number, z: number, asl: number, azTrue: number, chord = false): number {
    const { l, w } = this.levelAt(x, z), e = this.levelElevation(l, x, z, asl, azTrue, chord);
    return w > 0 ? e * (1 - w) + this.levelElevation(l + 1, x, z, asl, azTrue, chord) * w : e;
  }
  /** fraction of the sun's (or moon's) disc above the skyline at world (x, y, z) (y = the world's apparent height above
   *  the court datum), for a body at apparent altitude `altDeg` and true azimuth `azTrue` seen from the grid origin; the
   *  local vertical at (x, z) tilts by the distance / R, which lowers or raises the body there */
  visibility(x: number, y: number, z: number, altDeg: number, azTrue: number, worldDir?: { x: number; z: number }, chord = false): number {
    const asl = y + this.meta.court_asl + curvatureDropOrigin(x, z);
    const e = this.elevation(x, z, asl, azTrue, chord);
    const alt = altDeg + localTiltDeg(x, z, altDeg, azTrue, worldDir);
    return smooth(e - SUN_RADIUS_DEG, e + SUN_RADIUS_DEG, alt);
  }
  /** atlas size: the levels side by side */
  get atlasSize(): [number, number] { return [this.levels.reduce((s, L) => s + L.n, 0), Math.max(...this.levels.map(L => L.n))]; }
  /** Fill an RGBA half-float atlas for one body's true azimuth. `lines`: R, G, B, A = e0 (deg), k1 (deg/m), e50, k2 (the
   *  sun; the reference height comes from refAtlas). Otherwise the chord: e0, its slope −Δ/h (deg/m), the reference height
   *  as the world's apparent y (m above the court, curvature included), 1 (the moon, the air). */
  bakeAtlas(azTrue: number, out: Uint16Array, lines = false): Uint16Array {
    const [i0, i1, t] = this.azPlanes(azTrue), [W] = this.atlasSize, H = this.meta.dl.h, q = this.tmp;
    let u0 = 0;
    for (const L of this.levels) {
      for (let r = 0; r < L.n; r++) {
        const z = L.cz - L.half + (r + 0.5) * L.cell;
        for (let c = 0; c < L.n; c++) {
          const k = r * L.n + c, o = (r * W + u0 + c) * 4; this.lines(L, k, i0, i1, t, q);
          if (lines) { out[o] = toHalf(q.e0); out[o + 1] = toHalf(q.k1); out[o + 2] = toHalf(q.e50); out[o + 3] = toHalf(q.k2); }
          else { const x = L.cx - L.half + (c + 0.5) * L.cell; out[o] = toHalf(q.e0); out[o + 1] = toHalf(-(q.e0 - q.e50) / H); out[o + 2] = toHalf(L.ref[k] - this.meta.court_asl - curvatureDropOrigin(x, z)); out[o + 3] = 0x3c00; }
        }
      }
      u0 += L.n;
    }
    return out;
  }
  /** the static reference-height atlas for the lines (R channel: the world's apparent y of each texel's R) */
  refAtlas(out: Uint16Array): Uint16Array {
    const [W] = this.atlasSize; let u0 = 0;
    for (const L of this.levels) {
      for (let r = 0; r < L.n; r++) { const z = L.cz - L.half + (r + 0.5) * L.cell; for (let c = 0; c < L.n; c++) { const x = L.cx - L.half + (c + 0.5) * L.cell; out[r * W + u0 + c] = toHalf(L.ref[r * L.n + c] - this.meta.court_asl - curvatureDropOrigin(x, z)); } }
      u0 += L.n;
    }
    return out;
  }
}

/** the apparent drop of the terrain rings (heightfield.ts): curvature relative to the grid origin */
export const curvatureDropOrigin = (x: number, z: number) => ((x * x + z * z) * (1 - REFRACTION_K)) / (2 * EARTH_R);
/** the change of a body's altitude (deg) at world (x, z) against the grid origin: the local vertical there tilts away from
 *  the origin by distance / R, so a body in the east stands lower for a point to the west */
export function localTiltDeg(x: number, z: number, altDeg: number, azTrue: number, worldDir?: { x: number; z: number }): number {
  let dx: number, dz: number;
  if (worldDir) { dx = worldDir.x; dz = worldDir.z; }
  else { const g = (azTrue - 341) * DEG, ch = Math.cos(altDeg * DEG); dx = Math.sin(g) * ch; dz = -Math.cos(g) * ch; }
  return ((dx * x + dz * z) / (EARTH_R * Math.max(0.05, Math.cos(altDeg * DEG)))) / DEG;
}
function smooth(a: number, b: number, x: number) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/** float → IEEE half (round to nearest) */
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
export function toHalf(v: number): number {
  f32[0] = v; const x = u32[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 127 + 15; let m = x & 0x7fffff;
  if (e <= 0) { if (e < -10) return s; m = (m | 0x800000) >> (1 - e); return s | ((m + 0x1000) >> 13); }
  if (e >= 31) return s | 0x7c00;
  const h = s | (e << 10) | (m >> 13); return (m & 0x1000) ? h + 1 : h;
}
export function fromHalf(h: number): number {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24; if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

// ---- file format ---------------------------------------------------------------------------------------------------
/** delta-code a plane of u8 along x (per row) */
export function deltaU8(src: Uint8Array, n: number, out: Uint8Array, o: number) { for (let r = 0; r < n; r++) { let p = 0; for (let c = 0; c < n; c++) { const v = src[r * n + c]; out[o + r * n + c] = (v - p) & 255; p = v; } } }
export function undeltaU8(src: Uint8Array, o: number, n: number, out: Uint8Array) { for (let r = 0; r < n; r++) { let p = 0; for (let c = 0; c < n; c++) { p = (p + src[o + r * n + c]) & 255; out[r * n + c] = p; } } }
/** planes per azimuth in the byte stream, in this order; the sparse slope planes are stored as they are (delta coding
 *  spreads their isolated values), the smooth ones delta-coded */
export const HORIZON_PLANES = ['e0', 'dl', 'x1', 'x2'] as const;
export const HORIZON_PLANE_DELTA: Record<(typeof HORIZON_PLANES)[number], boolean> = { e0: true, dl: true, x1: false, x2: false };
/** layout of the inflated byte stream: per level the reference plane (u16 LE, delta-coded), then per azimuth the e0, Δ,
 *  x1 and x2 planes (u8) */
export function decodeHorizonMap(meta: HorizonMeta, bytes: Uint8Array): HorizonMap {
  let o = 0; const levels: HorizonLevel[] = [];
  for (const lm of meta.levels) {
    const n = lm.n, nn = n * n, ref = new Float32Array(nn);
    for (let r = 0; r < n; r++) { let p = 0; for (let c = 0; c < n; c++) { const i = r * n + c, d = bytes[o + 2 * i] | (bytes[o + 2 * i + 1] << 8); p = (p + d) & 0xffff; ref[i] = meta.ref.asl0 + p * meta.ref.step; } }
    o += 2 * nn;
    const P = { e0: new Uint8Array(meta.azimuths.n * nn), dl: new Uint8Array(meta.azimuths.n * nn), x1: new Uint8Array(meta.azimuths.n * nn), x2: new Uint8Array(meta.azimuths.n * nn) }, tmp = new Uint8Array(nn);
    for (let a = 0; a < meta.azimuths.n; a++) for (const k of HORIZON_PLANES) { if (HORIZON_PLANE_DELTA[k]) { undeltaU8(bytes, o, n, tmp); P[k].set(tmp, a * nn); } else P[k].set(bytes.subarray(o, o + nn), a * nn); o += nn; }
    levels.push({ half: lm.half, n, cell: (2 * lm.half) / n, dmin: lm.dmin, flat: !!lm.flat, cx: lm.cx ?? 0, cz: lm.cz ?? 0, ref, ...P });
  }
  if (o !== bytes.length) throw new Error(`horizon map: ${bytes.length} bytes, layout needs ${o}`);
  return new HorizonMap(meta, levels);
}
/** load the baked map (browser: fetch + DecompressionStream; null when absent) */
export async function loadHorizonMap(base = '/'): Promise<HorizonMap | null> {
  try {
    const mr = await fetch(`${base}generated/horizon_map.json`); if (!mr.ok) throw new Error(`HTTP ${mr.status}`);
    const meta: HorizonMeta = await mr.json();
    const br = await fetch(`${base}${meta.file}`); if (!br.ok || !br.body) throw new Error(`HTTP ${br.status}`);
    const raw = new Uint8Array(await new Response(br.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
    return decodeHorizonMap(meta, raw);
  } catch (e) { console.warn('[horizon] no terrain horizon map: distant terrain casts no shadows', e); return null; }
}
