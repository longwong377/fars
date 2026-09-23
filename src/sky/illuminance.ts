// Natural illuminance on a horizontal surface under a clear sky, from the sun, the sky and the moon, as functions of the
// apparent altitude (session 3, D-115). Pure functions (node-testable).
//
// Source (B): P. M. Janiczek & J. A. DeYoung, "Computer Programs for Sun and Moon Illuminance With Contingent Tables and
// Diagrams", U.S. Naval Observatory Circular 171 (1987), itself a fit to Brown (1952), "Natural illumination charts" (US
// Navy Bureau of Ships report 374-1). The circular (DTIC ADA182110) is blocked by the egress proxy; the formulas are
// read in full (FT) from its verbatim transcription in the `skylight` R package (K. Hufkens, BlueGreen Labs, file
// src/subroutines.h, function `atmos`, and src/skylight.cpp). Key USNO-C171 in research/SOURCES.md.
//   M        = X (cos S − sin h) + cos S, with sin S = X cos h / (X + 1), X = 753.66156   (air mass of a spherical shell)
//   E_sun    = 133 775 lx · exp(−0.21 M) · sin h                                          (direct beam, horizontal)
//   E_sky    = 133 775 lx · 0.0289 · exp(−0.042 M) · (1 + (h + 90°) sin h / 57.29578°)    (diffuse sky, horizontal)
//   E_moon   = P(elongation) · (same two terms at the moon's altitude);  E_night = 0.0005 lx (starlight and airglow)
// The sky term is continuous through the horizon and carries the civil and nautical twilight: 757 lx at h = 0,
// 3.0 lx at −6°, 0.004 lx at −12° (the usual quoted values are ~400–750, 3.4 and 0.008 lx: tests/illuminance.test.ts).

const X = 753.66156, E_SC = 133775, DEG = Math.PI / 180;
export const NIGHT_LUX = 0.0005;

/** USNO-C171 air mass at apparent altitude h (deg); valid through the horizon into twilight */
export function airMass(hDeg: number): number {
  const u = Math.sin(hDeg * DEG), sS = Math.min(1, (X * Math.cos(hDeg * DEG)) / (X + 1)), cS = Math.sqrt(1 - sS * sS);
  return X * (cS - u) + cS;
}
/** direct-beam illuminance at normal incidence (lx) for a broadband extinction k per air mass (USNO: 0.21, clear sky) */
export function sunNormalLux(hDeg: number, k = 0.21): number {
  if (hDeg <= -1) return 0;
  return E_SC * Math.exp(-k * airMass(hDeg));
}
/** direct-beam illuminance on a horizontal surface (lx) */
export function sunHorizontalLux(hDeg: number, k = 0.21): number { return hDeg <= 0 ? 0 : sunNormalLux(hDeg, k) * Math.sin(hDeg * DEG); }
/** diffuse illuminance from the clear sky on a horizontal surface (lx), sun above or below the horizon */
export function skyLux(hDeg: number): number {
  const u = Math.sin(hDeg * DEG), f = 1 + ((hDeg + 90) * u) / 57.29577951;
  return Math.max(0, E_SC * 0.0289 * Math.exp(-0.042 * airMass(hDeg)) * f);
}
/** the moon (USNO-C171): elongation from the sun (deg; 180 = full) and apparent altitude; returns the direct beam at
 *  normal incidence and the moonlit sky on a horizontal surface (lx). Clear sky. */
export function moonLux(elongDeg: number, hDeg: number): { normal: number; sky: number } {
  if (hDeg <= -1) return { normal: 0, sky: 0 };
  const E = Math.max(1e-3, elongDeg * DEG), u = Math.sin(hDeg * DEG);
  let P = 0.892 * Math.exp(-3.343 / Math.pow(Math.tan(E / 2), 0.632)) + 0.0344 * (Math.sin(E) - E * Math.cos(E));
  P = (0.418 * P) / (1 - 0.005 * Math.cos(E) - 0.03 * u);
  const M = airMass(hDeg);
  return { normal: P * Math.exp(-0.21 * M), sky: Math.max(0, P * 0.0289 * Math.exp(-0.042 * M) * (1 + ((hDeg + 90) * u) / 57.29577951)) };
}
/** elongation of the moon (deg) from its illuminated fraction (fraction = (1 − cos E) / 2) */
export const elongationFromFraction = (f: number) => Math.acos(Math.max(-1, Math.min(1, 1 - 2 * f))) / DEG;

/** Reference altitude for the renderer's units ("noon"): the zenith sun. The renderer's noon lights keep their session-3
 *  values there (sun 3.2 · exp(−k), skylight 0.98), and every other altitude keeps the USNO ratio to it (D-115). */
export const REF_ALT = 90;
export const SKY_LUX_REF = skyLux(REF_ALT);   // ≈ 15 350 lx
export const SUN_EXTRATERRESTRIAL_REN = 3.2;  // renderer units at the top of the atmosphere (the session-3 constant)
export const HEMI_REF_REN = 0.98;             // the session-3 daytime skylight intensity
/** renderer units per lux: the sun's (3.2 ↔ 133 775 lx) and the skylight's (0.98 ↔ the zenith-sun sky, 15 350 lx). The
 *  project's noon skylight is ~2× the USNO share of the total (C, kept: "noon stays as it is"). */
export const REN_PER_LUX_SUN = SUN_EXTRATERRESTRIAL_REN / E_SC;
export const REN_PER_LUX_SKY = HEMI_REF_REN / SKY_LUX_REF;

/** the broadband extinction per air mass for the weather's haze (0..1): USNO's clear-sky 0.21 at the clear-day haze
 *  of the weather generator (≈ 0.25), rising with dust and mist as the session-3 law did (0.18 (1 + haze), C) */
export const extinctionK = (haze: number) => (0.21 * (1 + haze)) / 1.25;
