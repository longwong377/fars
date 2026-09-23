// Physically based clear-sky radiance for low and set suns: the twilight dome (session 3, D-116). Pure TypeScript
// (node-testable); the sky system uploads its sky-view table as a small texture and the CPU horizon functions sample the
// same table, so the dome, the fog and the far haze agree (D-060).
//
// Why: the Preetham dome has no Earth's shadow, no Belt of Venus and wrong colours below ~+2° (a magenta band at dusk).
// A single-scattering integral through a spherical atmosphere produces those features from geometry: sunlight that
// grazes the Earth is extinguished and reddened, so the antisolar sky below a boundary that rises with the solar
// depression is in shadow (the dark segment), and the air just above it is lit by reddened light (the antitwilight arch).
//
// Model (B: published method and constants; C: the aerosol amount):
//  • E. Bruneton (2017), "Precomputed Atmospheric Scattering: a New Implementation" (BSD-3; atmosphere/demo/demo.cc,
//    model.cc and constants.h read in full): Rayleigh β = 1.24062e-6 λ⁻⁴ m⁻¹ (λ in µm), scale height 8 km; ozone 300 DU
//    in a tent profile 10–40 km peaking at 25 km with the Bremen 233 K cross-sections; Mie scale height 1.2 km, single-
//    scattering albedo 0.9, Cornette–Shanks phase with g = 0.8; the transmittance-table parametrisation; the ASTM G-173
//    solar spectrum and the CIE 1931 2° colour-matching functions for the conversion to linear sRGB.
//  • S. Hillaire (2020), "A Scalable and Production Ready Sky and Atmosphere Rendering Technique", EGSR / CGF 39(4)
//    (MIT code, sebh/UnrealEngineSkyAtmosphere, read in full): scattering of all orders ≥ 2 as an isotropic term
//    Ψ_ms(h, μ_s) = L_2nd / (1 − f_ms), with a Lambertian ground.
//  • Spectral: 8 bins of 40 nm (400–720 nm), converted to linear sRGB through the CIE functions and white-balanced to the
//    sun above the atmosphere (Bruneton's convention). Three discrete wavelengths oversaturate twilight colours (ozone
//    removes only the 550 nm channel, which reads magenta).
//  • Aerosol optical depth above the observer from the weather's haze, matched so that the model's extinction at 550 nm
//    equals the USNO clear-sky coefficient 0.21 per air mass at the clear-day haze (D-115); Ångström exponent 0.8 (C:
//    mixed dust and continental aerosol, no Fars measurement sourced).
//  • Ground: the Marvdasht plain, 1600 m asl (the grazing sunset rays skim the plateau); albedo 0.2 (C, dry plain).
// Units: radiance per unit solar irradiance at the top of the atmosphere; the sky system calibrates the absolute level
// against the skylight (D-060), so only the angular shape and the colour are used.

export type V3 = [number, number, number];
export const R_SEA = 6360e3, GROUND_ALT = 1600, OBSERVER_ALT = 1625;
export const R_GROUND = R_SEA + GROUND_ALT, R_TOP = R_SEA + 100e3, R_OBS = R_SEA + OBSERVER_ALT;
/** the sun's angular radius (Bruneton demo: 0.00935 / 2 rad) */
export const SUN_ANGULAR_RADIUS = 0.00935 / 2;
const H_R = 8000, H_M = 1200, ANGSTROM = 0.8, MIE_ALBEDO = 0.9, MIE_G = 0.8, GROUND_ALBEDO = 0.2;

// ---- spectral constants (Bruneton, constants.h / demo.cc) ------------------------------------------------------------
/** CIE 1931 2° CMFs, 400–720 nm in 5 nm steps (x̄, ȳ, z̄) */
const CMF: number[] = [
  0.01431, 0.000396, 0.06785, 0.02319, 0.00064, 0.1102, 0.04351, 0.00121, 0.2074, 0.07763, 0.00218, 0.3713,
  0.13438, 0.004, 0.6456, 0.21477, 0.0073, 1.0390501, 0.2839, 0.0116, 1.3856, 0.3285, 0.01684, 1.62296,
  0.34828, 0.023, 1.74706, 0.34806, 0.0298, 1.7826, 0.3362, 0.038, 1.77211, 0.3187, 0.048, 1.7441,
  0.2908, 0.06, 1.6692, 0.2511, 0.0739, 1.5281, 0.19536, 0.09098, 1.28764, 0.1421, 0.1126, 1.0419,
  0.09564, 0.13902, 0.8129501, 0.05795001, 0.1693, 0.6162, 0.03201, 0.20802, 0.46518, 0.0147, 0.2586, 0.3533,
  0.0049, 0.323, 0.272, 0.0024, 0.4073, 0.2123, 0.0093, 0.503, 0.1582, 0.0291, 0.6082, 0.1117,
  0.06327, 0.71, 0.07824999, 0.1096, 0.7932, 0.05725001, 0.1655, 0.862, 0.04216, 0.2257499, 0.9148501, 0.02984,
  0.2904, 0.954, 0.0203, 0.3597, 0.9803, 0.0134, 0.4334499, 0.9949501, 0.008749999, 0.5120501, 1.0, 0.005749999,
  0.5945, 0.995, 0.0039, 0.6784, 0.9786, 0.002749999, 0.7621, 0.952, 0.0021, 0.8425, 0.9154, 0.0018,
  0.9163, 0.87, 0.001650001, 0.9786, 0.8163, 0.0014, 1.0263, 0.757, 0.0011, 1.0567, 0.6949, 0.001,
  1.0622, 0.631, 0.0008, 1.0456, 0.5668, 0.0006, 1.0026, 0.503, 0.00034, 0.9384, 0.4412, 0.00024,
  0.8544499, 0.381, 0.00019, 0.7514, 0.321, 0.0001, 0.6424, 0.265, 0.00004999999, 0.5419, 0.217, 0.00003,
  0.4479, 0.175, 0.00002, 0.3608, 0.1382, 0.00001, 0.2835, 0.107, 0, 0.2187, 0.0816, 0,
  0.1649, 0.061, 0, 0.1212, 0.04458, 0, 0.0874, 0.032, 0, 0.0636, 0.0232, 0,
  0.04677, 0.017, 0, 0.0329, 0.01192, 0, 0.0227, 0.00821, 0, 0.01584, 0.005723, 0,
  0.01135916, 0.004102, 0, 0.008110916, 0.002929, 0, 0.005790346, 0.002091, 0, 0.004109457, 0.001484, 0,
  0.002899327, 0.001047, 0,
];
/** ASTM G-173 extraterrestrial irradiance (W m⁻² nm⁻¹), 10 nm bins from 400 nm */
const SOLAR = [1.72765, 1.73054, 1.6887, 1.61253, 1.91198, 2.03474, 2.02042, 2.02212, 1.93377, 1.95809, 1.91686, 1.8298, 1.8685, 1.8931, 1.85149, 1.8504, 1.8341, 1.8345, 1.8147, 1.78158, 1.7533, 1.6965, 1.68194, 1.64654, 1.6048, 1.52143, 1.55622, 1.5113, 1.474, 1.4482, 1.41018, 1.36775, 1.34188];
/** ozone absorption cross-sections (m², Bremen 233 K via Bruneton), 10 nm bins from 400 nm */
const O3_XS = [1.527e-27, 2.763e-27, 5.52e-27, 8.451e-27, 1.582e-26, 2.316e-26, 3.669e-26, 4.924e-26, 7.752e-26, 9.016e-26, 1.48e-25, 1.602e-25, 2.139e-25, 2.755e-25, 3.091e-25, 3.5e-25, 4.266e-25, 4.672e-25, 4.398e-25, 4.701e-25, 5.019e-25, 4.305e-25, 3.74e-25, 3.215e-25, 2.662e-25, 2.238e-25, 1.852e-25, 1.473e-25, 1.209e-25, 9.423e-26, 7.455e-26, 6.566e-26, 5.105e-26];
const O3_MAX_DENSITY = (300 * 2.687e20) / 15000;
const XYZ_TO_SRGB = [3.2406, -1.5372, -0.4986, -0.9689, 1.8758, 0.0415, 0.0557, -0.204, 1.057];

/** number of spectral bins (40 nm, 400–720 nm) */
export const NL = 8;
export const LAM = Array.from({ length: NL }, (_, i) => 420 + 40 * i); // bin centres (nm)
const RAY = LAM.map(l => 1.24062e-6 * Math.pow(l / 1000, -4));
const OZ = LAM.map((_, i) => { let s = 0; for (let k = 0; k < 4; k++) s += O3_XS[Math.min(O3_XS.length - 1, i * 4 + k)]; return (s / 4) * O3_MAX_DENSITY; });
/** bin → linear sRGB weights: radiance factor per unit solar irradiance → RGB, white-balanced so that the sun above the
 *  atmosphere (all bins at 1) is (1, 1, 1), as Bruneton's demo does (a ~5800 K balance, close to a camera's daylight
 *  setting). The zenith sun at the ground then comes out (1, 0.92, 0.82): the session-3 noon colour (1, 0.92, 0.84). */
export const BIN_RGB: number[] = (() => {
  const xyz = new Array(NL * 3).fill(0);
  for (let i = 0; i < NL; i++) for (let k = 0; k < 8; k++) { // 5 nm samples in the 40 nm bin
    const l = 400 + 40 * i + 5 * k, c = (l - 400) / 5, s = SOLAR[Math.min(SOLAR.length - 1, Math.floor((l - 400) / 10))];
    for (let j = 0; j < 3; j++) xyz[i * 3 + j] += CMF[c * 3 + j] * s * 5;
  }
  const rgb = new Array(NL * 3).fill(0), white = [0, 0, 0];
  for (let i = 0; i < NL; i++) for (let r = 0; r < 3; r++) { const v = XYZ_TO_SRGB[r * 3] * xyz[i * 3] + XYZ_TO_SRGB[r * 3 + 1] * xyz[i * 3 + 1] + XYZ_TO_SRGB[r * 3 + 2] * xyz[i * 3 + 2]; rgb[i * 3 + r] = v; white[r] += v; }
  for (let i = 0; i < NL; i++) for (let r = 0; r < 3; r++) rgb[i * 3 + r] /= white[r];
  return rgb;
})();
/** spectral values → linear sRGB, white-balanced to the sun above the atmosphere */
export function spectrumToRGB(s: ArrayLike<number>, out: V3 = [0, 0, 0], o = 0): V3 {
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < NL; i++) { const v = s[o + i]; r += v * BIN_RGB[i * 3]; g += v * BIN_RGB[i * 3 + 1]; b += v * BIN_RGB[i * 3 + 2]; }
  out[0] = r; out[1] = g; out[2] = b; return out;
}

const ozone = (z: number) => (z < 10e3 || z > 40e3 ? 0 : z < 25e3 ? (z - 10e3) / 15e3 : (40e3 - z) / 15e3);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** aerosol optical depth at 550 nm above the observer that makes the model's vertical extinction at 550 nm equal k
 *  (per air mass): k − (Rayleigh + ozone above the observer), at least 0.02 */
export function aerosolTauFor(k: number): number {
  const ray = 1.24062e-6 * Math.pow(0.55, -4) * H_R * Math.exp(-OBSERVER_ALT / H_R);
  const oz = (O3_XS[15] * O3_MAX_DENSITY) * 15000; // 550–560 nm bin
  return Math.max(0.02, k - ray - oz);
}

export class Atmosphere {
  private mieExt: number[]; private mieSca: number[];
  private static TW = 96; private static TH = 32;   // transmittance table: μ × r
  private static MW = 48; private static MH = 12;   // multiple-scattering table: μ_s (2.4° steps of sun angle near the horizon) × r
  private trans: Float32Array; private ms: Float32Array;
  // scratch
  private ext = new Float64Array(NL); private sR = new Float64Array(NL); private sM = new Float64Array(NL);
  private ts = new Float64Array(NL); private mss = new Float64Array(NL); private thr = new Float64Array(NL); private acc = new Float64Array(NL);
  /** `deferred`: allocate only; the tables are then built by buildStep() a few cells at a time (a haze change by day must
   *  not stall a frame for the ~0.3 s the two tables take, D-156). Not usable until `complete`. */
  constructor(readonly aerosolTau: number, deferred = false) {
    const b0 = aerosolTau / (H_M * Math.exp(-OBSERVER_ALT / H_M));
    this.mieExt = LAM.map(l => b0 * Math.pow(l / 550, -ANGSTROM));
    this.mieSca = this.mieExt.map(v => v * MIE_ALBEDO);
    this.trans = new Float32Array(Atmosphere.TW * Atmosphere.TH * NL);
    this.ms = new Float32Array(Atmosphere.MW * Atmosphere.MH * NL);
    if (!deferred) this.buildStep(Infinity);
  }
  /** table cells built so far: the transmittance table's, then the multiple-scattering table's (which reads it) */
  private built = 0;
  private static readonly CELLS = Atmosphere.TW * Atmosphere.TH + Atmosphere.MW * Atmosphere.MH;
  get complete(): boolean { return this.built >= Atmosphere.CELLS; }
  /** build up to `maxCells` more cells, stopping early once `maxMs` have passed; true when both tables are complete. The
   *  cells are the same arithmetic as a full build, in the same order, so a deferred model equals an immediate one. */
  buildStep(maxCells: number, maxMs = Infinity): boolean {
    const { TW, MW } = Atmosphere, nT = TW * Atmosphere.TH, t0 = maxMs < Infinity ? performance.now() : 0;
    for (let n = 0; n < maxCells && this.built < Atmosphere.CELLS; n++) {
      const k = this.built++;
      if (k < nT) this.transmittanceCell(k % TW, Math.floor(k / TW)); else this.multipleScatteringCell((k - nT) % MW, Math.floor((k - nT) / MW));
      if (maxMs < Infinity && (n & 7) === 7 && performance.now() - t0 > maxMs) break;
    }
    return this.complete;
  }

  /** extinction, Rayleigh and Mie scattering at radius r into the scratch arrays */
  private medium(r: number) {
    const z = r - R_SEA, dr = Math.exp(-z / H_R), dm = Math.exp(-z / H_M), dz = ozone(z);
    const { ext, sR, sM } = this;
    for (let c = 0; c < NL; c++) { sR[c] = RAY[c] * dr; sM[c] = this.mieSca[c] * dm; ext[c] = sR[c] + this.mieExt[c] * dm + OZ[c] * dz; }
  }

  // ---- transmittance (Bruneton 2017, functions.glsl: GetTransmittanceTextureUvFromRMu and its inverse) -------------------
  private static readonly HH = Math.sqrt(R_TOP * R_TOP - R_GROUND * R_GROUND);
  private od = new Float64Array(NL);
  private transmittanceCell(i: number, j: number) {
    const { TW, TH } = Atmosphere, H = Atmosphere.HH, od = this.od;
    {
      const xmu = i / (TW - 1), xr = j / (TH - 1);
      const rho = H * xr, r = Math.sqrt(rho * rho + R_GROUND * R_GROUND);
      const dmin = R_TOP - r, dmax = rho + H, d = dmin + xmu * (dmax - dmin);
      const mu = d === 0 ? 1 : Math.max(-1, Math.min(1, (H * H - rho * rho - d * d) / (2 * r * d)));
      const N = 64, dt = d / N; od.fill(0);
      for (let s = 0; s <= N; s++) { // trapezoid along the ray to the top
        const t = s * dt; this.medium(Math.sqrt(r * r + 2 * r * mu * t + t * t));
        const w = (s === 0 || s === N ? 0.5 : 1) * dt; for (let c = 0; c < NL; c++) od[c] += this.ext[c] * w;
      }
      const o = (j * TW + i) * NL; for (let c = 0; c < NL; c++) this.trans[o + c] = Math.exp(-od[c]);
    }
  }
  /** spectral transmittance from radius r along μ to the top of the atmosphere (the ray must not meet the ground) */
  transmittanceToTop(r: number, mu: number, out: Float64Array) {
    const H = Atmosphere.HH, rr = Math.max(R_GROUND, Math.min(R_TOP, r));
    const rho = Math.sqrt(Math.max(0, rr * rr - R_GROUND * R_GROUND));
    const d = Math.max(0, -rr * mu + Math.sqrt(Math.max(0, rr * rr * (mu * mu - 1) + R_TOP * R_TOP)));
    const dmin = R_TOP - rr, dmax = rho + H;
    bilinearN(this.trans, Atmosphere.TW, Atmosphere.TH, clamp01((d - dmin) / (dmax - dmin)) * (Atmosphere.TW - 1), clamp01(rho / H) * (Atmosphere.TH - 1), out);
  }
  /** spectral transmittance of sunlight reaching radius r with sun zenith cosine μ_s, including the Earth's shadow,
   *  softened across the solar disc (Bruneton: a smoothstep over the sun's angular radius about r's geometric horizon) */
  sunTransmittance(r: number, muS: number, out: Float64Array) {
    const sinH = R_GROUND / Math.max(r, R_GROUND), cosH = -Math.sqrt(Math.max(0, 1 - sinH * sinH));
    const f = smooth(-sinH * SUN_ANGULAR_RADIUS, sinH * SUN_ANGULAR_RADIUS, muS - cosH);
    if (f <= 0) { out.fill(0); return; }
    this.transmittanceToTop(r, muS, out); if (f < 1) for (let c = 0; c < NL; c++) out[c] *= f;
  }
  /** colour (linear sRGB, white-balanced) of sunlight at height `alt` m above sea level for a sun at apparent altitude
   *  `sunAltDeg` as seen from there: the spectral transmittance through the (spherical) atmosphere, zero below the
   *  horizon of that height */
  sunColorAt(altM: number, sunAltDeg: number, out: V3 = [0, 0, 0]): V3 {
    const t = new Float64Array(NL); this.sunTransmittance(R_SEA + altM, Math.sin((sunAltDeg * Math.PI) / 180), t);
    return spectrumToRGB(t, out);
  }

  // ---- multiple scattering (Hillaire 2020 §5.5) ------------------------------------------------------------------------
  private L2 = new Float64Array(NL); private fms = new Float64Array(NL);
  private multipleScatteringCell(i: number, j: number) {
    const { MW, MH } = Atmosphere, SQ = 6, NS = 20, L2 = this.L2, fms = this.fms;
    const { ts, thr } = this;
    {
      const muS = ((i + 0.5) / MW) * 2 - 1, r = R_GROUND + ((j + 0.5) / MH) * (R_TOP - R_GROUND - 1);
      const sx = Math.sqrt(Math.max(0, 1 - muS * muS)), sy = muS;
      L2.fill(0); fms.fill(0);
      for (let a = 0; a < SQ; a++) for (let b = 0; b < SQ; b++) {
        const th = (2 * Math.PI * (a + 0.5)) / SQ, ph = Math.acos(1 - (2 * (b + 0.5)) / SQ);
        const v: V3 = [Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph)];
        const tG = raySphere(r, v, R_GROUND), tT = raySphere(r, v, R_TOP);
        const hitsGround = tG > 0, tMax = hitsGround ? tG : tT; if (!(tMax > 0)) continue;
        thr.fill(1); let t = 0;
        for (let s = 0; s < NS; s++) {
          const nt = (tMax * (s + 0.3)) / NS, dt = nt - t; t = nt;
          const px = v[0] * t, py = r + v[1] * t, pz = v[2] * t, pr = Math.hypot(px, py, pz);
          this.medium(pr); this.sunTransmittance(pr, (px * sx + py * sy) / pr, ts);
          for (let c = 0; c < NL; c++) {
            const sc = this.sR[c] + this.sM[c], e = Math.max(this.ext[c], 1e-12), T = Math.exp(-e * dt);
            const S = (ts[c] * sc) / (4 * Math.PI);
            L2[c] += (thr[c] * (S - S * T)) / e; fms[c] += (thr[c] * (sc - sc * T)) / e; thr[c] *= T;
          }
        }
        if (hitsGround) { // sunlight bounced off the ground (Lambert)
          const px = v[0] * tG, py = r + v[1] * tG, pz = v[2] * tG, pr = Math.hypot(px, py, pz), mu = (px * sx + py * sy) / pr;
          this.sunTransmittance(pr, mu, ts);
          for (let c = 0; c < NL; c++) L2[c] += (thr[c] * ts[c] * Math.max(0, mu) * GROUND_ALBEDO) / Math.PI;
        }
      }
      const o = (j * MW + i) * NL, w = 1 / (SQ * SQ); // (4π / N) × isotropic phase 1/(4π)
      for (let c = 0; c < NL; c++) this.ms[o + c] = (L2[c] * w) / (1 - Math.min(0.99, fms[c] * w));
    }
  }
  private multipleScattering(r: number, muS: number, out: Float64Array) {
    const { MW, MH } = Atmosphere;
    const x = Math.max(0, Math.min(MW - 1, clamp01((muS + 1) / 2) * MW - 0.5));
    const y = Math.max(0, Math.min(MH - 1, clamp01((r - R_GROUND) / (R_TOP - R_GROUND)) * MH - 0.5));
    bilinearN(this.ms, MW, MH, x, y, out);
  }

  // ---- sky radiance --------------------------------------------------------------------------------------------------
  /** sky radiance (linear sRGB per unit solar irradiance) seen from the observer in direction v (unit, y up) for the sun
   *  direction s (unit): `steps` samples spaced quadratically (dense near the observer). Lines of sight that meet the
   *  ground stop there without a ground term (below the horizon the dome is covered by terrain and fog). */
  radiance(v: V3, s: V3, steps = 40, out: V3 = [0, 0, 0]): V3 {
    const r0 = R_OBS, tG = raySphere(r0, v, R_GROUND), tT = raySphere(r0, v, R_TOP), tMax = tG > 0 ? tG : tT;
    const acc = this.acc; acc.fill(0); if (!(tMax > 0)) { out[0] = out[1] = out[2] = 0; return out; }
    const nu = v[0] * s[0] + v[1] * s[1] + v[2] * s[2];
    const pR = (3 / (16 * Math.PI)) * (1 + nu * nu);
    const g = MIE_G, pM = ((3 / (8 * Math.PI)) * ((1 - g * g) * (1 + nu * nu))) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * nu, 1.5));
    const { ext, sR, sM, ts, mss, thr } = this; thr.fill(1);
    let t = 0;
    for (let k = 0; k < steps; k++) {
      const u = (k + 1) / steps, nt = tMax * u * u, dt = nt - t, tm = t + 0.5 * dt; t = nt;
      const px = v[0] * tm, py = r0 + v[1] * tm, pz = v[2] * tm, pr = Math.hypot(px, py, pz), muS = (px * s[0] + py * s[1] + pz * s[2]) / pr;
      this.medium(pr); this.sunTransmittance(pr, muS, ts); this.multipleScattering(pr, muS, mss);
      for (let c = 0; c < NL; c++) {
        const e = Math.max(ext[c], 1e-12), T = Math.exp(-e * dt);
        const S = ts[c] * (sR[c] * pR + sM[c] * pM) + mss[c] * (sR[c] + sM[c]);
        acc[c] += (thr[c] * (S - S * T)) / e; thr[c] *= T;
      }
    }
    return spectrumToRGB(acc, out);
  }

  /** Sky-view table for a sun at apparent altitude `sunAltDeg`: NE elevations (0..90°, v = √(e/90°), dense at the
   *  horizon) × NA azimuths from the sun (0..180°: the sky is symmetric about the sun's vertical), RGBA (A = 1), with its
   *  horizontal irradiance ∫ L cos θ dω (16 × 32 quadrature, as horizon.ts). */
  skyView(sunAltDeg: number, NE = 32, NA = 32): SkyView {
    const job = this.beginSkyView(sunAltDeg, NE, NA); this.stepSkyView(job, NE); return job.view;
  }
  /** the same table built a few rows at a time (a time-lapse must not stall a frame): begin, then step until it returns
   *  true; the view's irradiance is set on the last step */
  beginSkyView(sunAltDeg: number, NE = 32, NA = 32): SkyViewJob {
    return { view: { data: new Float32Array(NE * NA * 4), NE, NA, sunAltDeg, irradianceY: 0, irradiance: [0, 0, 0] }, row: 0 };
  }
  stepSkyView(job: SkyViewJob, rows: number): boolean {
    const { view } = job, { NE, NA, data } = view, a = (view.sunAltDeg * Math.PI) / 180, s: V3 = [Math.cos(a), Math.sin(a), 0], L: V3 = [0, 0, 0];
    const end = Math.min(NE, job.row + rows);
    for (let j = job.row; j < end; j++) {
      const vv = (j + 0.5) / NE, e = (vv * vv * Math.PI) / 2, ce = Math.cos(e), se = Math.sin(e);
      const steps = e < 0.3 ? 56 : 32; // long, grazing lines of sight cross the shadow boundary: finer steps
      for (let i = 0; i < NA; i++) {
        const ph = (Math.PI * (i + 0.5)) / NA;
        this.radiance([ce * Math.cos(ph), se, ce * Math.sin(ph)], s, steps, L);
        const o = (j * NA + i) * 4; data[o] = L[0]; data[o + 1] = L[1]; data[o + 2] = L[2]; data[o + 3] = 1;
      }
    }
    job.row = end;
    if (end < NE) return false;
    const E = skyViewIrradiance(view); view.irradiance = E; view.irradianceY = 0.2126 * E[0] + 0.7152 * E[1] + 0.0722 * E[2];
    return true;
  }
}

export interface SkyViewJob { view: SkyView; row: number }
export interface SkyView { data: Float32Array; NE: number; NA: number; sunAltDeg: number; irradianceY: number; irradiance: V3 }

/** bilinear sample of a sky-view table at elevation e (rad, clamped to ≥ 0) and azimuth from the sun φ (rad, 0..π): the
 *  texel-centre convention of a GPU LinearFilter / ClampToEdge lookup at uv = (φ/π, √(e/(π/2))) */
export function sampleSkyView(view: SkyView, e: number, phi: number, out: V3 = [0, 0, 0]): V3 {
  const v = Math.sqrt(clamp01(e / (Math.PI / 2))), u = clamp01(phi / Math.PI);
  const x = Math.max(0, Math.min(view.NA - 1, u * view.NA - 0.5)), y = Math.max(0, Math.min(view.NE - 1, v * view.NE - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(view.NA - 1, x0 + 1), y1 = Math.min(view.NE - 1, y0 + 1), fx = x - x0, fy = y - y0;
  const d = view.data, NA = view.NA;
  for (let c = 0; c < 3; c++) {
    const a = d[(y0 * NA + x0) * 4 + c], b = d[(y0 * NA + x1) * 4 + c], cc = d[(y1 * NA + x0) * 4 + c], dd = d[(y1 * NA + x1) * 4 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + dd * fx) * fy;
  }
  return out;
}
/** sky-view radiance in a world direction (y up) for the sun's horizontal direction (sx, sz) */
export function skyViewRadiance(view: SkyView, dir: V3, sx: number, sz: number, out: V3 = [0, 0, 0]): V3 {
  const e = Math.asin(Math.max(0, Math.min(1, dir[1]))), hl = Math.hypot(dir[0], dir[2]) + 1e-9, sl = Math.hypot(sx, sz) + 1e-9;
  const phi = Math.acos(Math.max(-1, Math.min(1, (dir[0] * sx + dir[2] * sz) / (hl * sl))));
  return sampleSkyView(view, e, phi, out);
}
/** RGB horizontal irradiance ∫ L cos θ dω of a sky-view table: the 16 × 32 quadrature of horizon.ts (azimuth-symmetric) */
export function skyViewIrradiance(view: SkyView): V3 {
  const NEq = 16, NAq = 32, E: V3 = [0, 0, 0], L: V3 = [0, 0, 0];
  for (let i = 0; i < NEq; i++) {
    const th0 = (i / NEq) * (Math.PI / 2), th1 = ((i + 1) / NEq) * (Math.PI / 2), th = (th0 + th1) / 2;
    const band = (Math.PI * (Math.cos(th0) ** 2 - Math.cos(th1) ** 2)) / NAq;
    for (let j = 0; j < NAq; j++) {
      const a = ((j + 0.5) / NAq) * 2 * Math.PI, phi = a > Math.PI ? 2 * Math.PI - a : a;
      sampleSkyView(view, Math.PI / 2 - th, phi, L);
      E[0] += L[0] * band; E[1] += L[1] * band; E[2] += L[2] * band;
    }
  }
  return E;
}

// ---- helpers ------------------------------------------------------------------------------------------------------------
function smooth(a: number, b: number, x: number) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
/** distance along unit v from (0, r, 0) to the sphere of radius R about the origin: the nearest positive root, or −1 */
function raySphere(r: number, v: V3, R: number): number {
  const b = r * v[1], c = r * r - R * R, disc = b * b - c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc), t0 = -b - s, t1 = -b + s;
  return t0 > 0 ? t0 : t1 > 0 ? t1 : -1;
}
function bilinearN(tab: Float32Array, W: number, H: number, x: number, y: number, out: Float64Array) {
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), fx = x - x0, fy = y - y0;
  const a = (y0 * W + x0) * NL, b = (y0 * W + x1) * NL, c = (y1 * W + x0) * NL, d = (y1 * W + x1) * NL;
  const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
  for (let k = 0; k < NL; k++) out[k] = tab[a + k] * w00 + tab[b + k] * w10 + tab[c + k] * w01 + tab[d + k] * w11;
}
