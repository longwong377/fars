// Cloud lighting shared by the shader (clouds.ts) and its CPU mirror (tests, calibration) — session 4, D-156, triage item
// 12. Replaces single scattering × 6 (an unexplained factor), a "powder" floor that held thin cloud at 0.2 of the sun term,
// and a skylight ambient in irradiance units (π× a radiance), under which sunlit cumulus rendered darker and bluer than
// the horizon sky.
//  • Multiple scattering: Wrenninge, Kulla & Lundqvist (2013) "Oz: the great and volumetric" (SIGGRAPH talk), as used by
//    Hillaire (2016, "Physically based sky, atmosphere and cloud rendering in Frostbite"): N octaves, octave i with the
//    extinction toward the sun × aⁱ, the contribution × bⁱ and the phase asymmetry × cⁱ; 3 octaves, a = b = c = 0.5.
//    (B: published method; the parameters are theirs, used as published.)
//  • Phase: the session-3 two-lobe Henyey–Greenstein (forward 0.65, back −0.25, 60 % forward; C), per octave.
//  • Calibration (C, measured on this code): the octave sum leaves the light that thick cloud scatters back far too low
//    (a finite number of octaves), so it is scaled by K_MS, set so that a thick homogeneous layer (optical depth 20) lit
//    at 40° and seen from the sunward side reflects like a Lambertian surface of albedo 0.75, the middle of the albedos
//    measured for thick convective cloud (≈ 0.7–0.8; e.g. the thick-cloud albedos compiled by Stephens 1978, J. Atmos.
//    Sci. 35, cited from memory: verify). tests/cloudlight.test.ts measures it.
//  • Ambient: the isotropic in-scatter of the sky from above and the sunlit ground from below (the D-153 ground colour),
//    as radiances (the hemisphere light's irradiance / π): half the sky's at the top of the layer, half the ground's at
//    its base, a linear blend between (C), so bases come out warm-grey rather than sky-blue.
//  • March: steps of a fixed length from the cloud base (120 m at high quality, three times that through empty air),
//    capped in number, instead of a fixed count over the whole span (up to 690 m per step near the horizon).

export const OCTAVES = 3, OCT_A = 0.5, OCT_B = 0.5, OCT_C = 0.5;
export const PHASE_FWD = 0.65, PHASE_BACK = -0.25, PHASE_MIX = 0.6;
/** light march toward the sun: steps growing × LIGHT_GROWTH out to LIGHT_REACH m (dense near the sample: evenly spaced
 *  180 m steps read a sample 60 m under the sunlit top as ~3.6 optical depths deep instead of ~1.9) */
export const LIGHT_REACH = 800, LIGHT_GROWTH = 2.5;
/** the light samples for N steps: distances toward the sun (m) and the length each stands for */
export function lightSamples(N: number): { at: number[]; w: number[] } {
  const r = LIGHT_GROWTH, s0 = (LIGHT_REACH * (r - 1)) / (Math.pow(r, N) - 1), at: number[] = [], w: number[] = [];
  for (let j = 0; j < N; j++) { const a = (s0 * (Math.pow(r, j) - 1)) / (r - 1), b = (s0 * (Math.pow(r, j + 1) - 1)) / (r - 1); at.push((a + b) / 2); w.push(b - a); }
  return { at, w };
}
/** calibration of the octave sum (see header; tests/cloudlight.test.ts) */
export const K_MS = 3.9;
/** march per quality: [max steps, step in cloud (m), light samples]; the step through empty air is 3× */
export const CLOUD_MARCH: Record<string, [number, number, number]> = { test: [0, 0, 0], low: [28, 240, 2], medium: [40, 160, 3], high: [64, 120, 4], ultra: [96, 100, 5] };
export const EMPTY_STRIDE = 3;

export const hg = (c: number, g: number) => (1 - g * g) / (4 * Math.PI * Math.pow(1 + g * g - 2 * g * c, 1.5));
export const cloudPhase = (c: number, i = 0) => { const s = Math.pow(OCT_C, i); return hg(c, PHASE_BACK * s) * (1 - PHASE_MIX) + hg(c, PHASE_FWD * s) * PHASE_MIX; };
/** the sun term per unit sunlight at a sample whose optical depth toward the sun is `tauSun` */
export function sunScatter(cosT: number, tauSun: number): number {
  let s = 0; for (let i = 0; i < OCTAVES; i++) s += Math.pow(OCT_B, i) * cloudPhase(cosT, i) * Math.exp(-tauSun * Math.pow(OCT_A, i));
  return s * K_MS;
}
/** the ambient in-scatter at height fraction h (0 base, 1 top) from the sky's and the ground's mean radiances */
export const ambientAt = (h: number, skyL: number, groundL: number) => 0.5 * (h * skyL + (1 - h) * groundL);

/** CPU mirror of the shader's march for one view ray (luminance only): `density(t)` along the ray (per m), `densitySun(t, s)`
 *  at distance s toward the sun from the ray's point t, `hAt(t)` the height fraction. Returns the premultiplied cloud
 *  radiance per unit sun (sunE = 1) plus the ambient, and the transmittance. */
export function marchCPU(o: { t0: number; t1: number; cosT: number; density: (t: number) => number; densitySun: (t: number, s: number) => number; hAt: (t: number) => number; sunE: number; skyL: number; groundL: number; quality?: string; jitter?: number }) {
  const [N, dt, NL] = CLOUD_MARCH[o.quality ?? 'high'], L = lightSamples(NL);
  let T = 1, col = 0, t = o.t0 + dt * (o.jitter ?? 0.5), empty = 0;
  for (let i = 0; i < N && t < o.t1; i++) {
    const d = o.density(t);
    if (d > 1e-5) {
      let tau = 0; for (let j = 0; j < NL; j++) tau += o.densitySun(t, L.at[j]) * L.w[j];
      const lum = o.sunE * sunScatter(o.cosT, tau) + ambientAt(o.hAt(t), o.skyL, o.groundL);
      const a = Math.exp(-d * dt); col += T * lum * (1 - a); T *= a; empty = 0;
    } else empty++;
    if (T < 0.02) break;
    t += empty > 1 ? dt * EMPTY_STRIDE : dt;
  }
  return { col, T };
}

/** CPU mirror of the shader's march for the layer's opacity only (the cover calibration, cloudCover.ts): optical depth
 *  along the ray sampled as the shader samples it (steps of DT from t0 + jitter·DT, EMPTY_STRIDE × DT after two empty
 *  samples, at most N, stopping at t1 or once the transmittance falls under 0.02) */
export function marchDepth(density: (t: number) => number, t0: number, t1: number, quality = 'high', jitter = 0.5): number {
  const [N, dt] = CLOUD_MARCH[quality];
  let tau = 0, t = t0 + dt * jitter, empty = 0;
  for (let i = 0; i < N && t <= t1; i++) {
    const d = density(t);
    if (d > 1e-5) { tau += d * dt; empty = 0; } else empty++;
    if (tau > 3.912) break;
    t += empty > 1 ? dt * EMPTY_STRIDE : dt;
  }
  return tau;
}

/** radiance (per unit sun irradiance, no ambient) of a homogeneous layer (density σ per m, thickness H m) seen along a ray
 *  of elevation `e` (deg; negative = looking down onto its top from above) with the sun at `alt`; φ = the ray's azimuth
 *  from the sun's */
export function layerRadiance(sigma: number, H: number, alt: number, e: number, phi: number, fromAbove = e < 0) {
  const D = Math.PI / 180, s = [Math.cos(alt * D), Math.sin(alt * D), 0], v = [Math.cos(e * D) * Math.cos(phi * D), Math.sin(e * D), Math.cos(e * D) * Math.sin(phi * D)];
  const cosT = v[0] * s[0] + v[1] * s[1] + v[2] * s[2], sy = Math.abs(v[1]);
  // the ray enters the layer at t0 = 0 (top from above, base from below); height above the base at t:
  const zAt = (t: number) => (fromAbove ? H - t * sy : t * sy);
  const res = marchCPU({ t0: 0, t1: H / sy, cosT, density: t => (zAt(t) >= 0 && zAt(t) <= H ? sigma : 0), densitySun: (t, d) => { const z = zAt(t) + d * s[1]; return z <= H ? sigma : 0; }, hAt: t => zAt(t) / H, sunE: 1, skyL: 0, groundL: 0 });
  return res.col;
}

