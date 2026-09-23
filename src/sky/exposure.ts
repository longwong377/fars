// Eye adaptation and camera exposure (brief §8 "exposure and eye adaptation like a real camera"; session 3, D-117).
// Pure functions (node-testable). main.ts calls `exposureTarget`; the sky calls `skyGain`.
//
// The problem: exposure = 2.3 / E normalised every scene to the same brightness, so a dawn at 1/150 of the noon
// illuminance rendered like an overcast noon (session 3 dawn render: mean sRGB luma 89 against ~60–90 by day).
//
// Model:
//  • Brightness of the adapted scene (B): the "key" of Krawczyk, Myszkowski & Seidel (2005), "Perceptual effects in
//    real-time tone mapping", SCCG 2005: key(L̄) = 1.03 − 2 / (2 + log10(L̄ + 1)), L̄ the adapting luminance in cd/m². It
//    scales the scene before the tone curve (as Reinhard's key does): 0.69 in daylight, 0.48 at sunrise, 0.06 at the end
//    of civil twilight, 0.03 at night. The paper is blocked (egress); the formula is read from search extracts (SX).
//  • The limit of adaptation (B data, C use): below the rods' absolute-threshold plateau (Ferwerda, Pattanaik, Shirley &
//    Greenberg 1996, SIGGRAPH: log10 t_s = −2.86 for log10 La ≤ −3.94, i.e. La ≤ 1.15e-4 cd/m², an 18 % grey under
//    ~0.002 lx) the eye cannot adapt further, so the displayed grey falls in proportion to La. The TVI functions below are
//    Ferwerda's (read in full in F. Banterle's HDR Toolbox transcription, TpFerwerda.m / TsFerwerda.m).
//  • La = 0.18 · E / π: an 18 % grey (the reflected-light metering convention) under the outdoor illuminance E.
//  D(La) = key(La) / key(La_noon) · min(1, La / 1.15e-4): 1 at the zenith sun, 0.70 at sunrise, 0.41 at −3°, 0.09 at
//  −6°, 0.044 from −9° through moonlit nights, 0.011 on a moonless night (0.0005 lx, USNO-C171).
//
// Camera (C, unchanged session-3 law): X = clamp(2.3 / E_eye, 0.35, 6). Fires, lamps and the night sky dome were tuned
// against it (their values are perceptual). The part of the adaptation beyond that range is applied to the sky's own
// lights ("sky gain" G, like a pre-exposure): every light from the sun, the sky and the moon is its physical value (USNO
// ratios, D-115) times G, so that a grey lit by them is displayed at KEY · D(La). G = 1 whenever the sky alone keeps X
// inside its range (a clear sky with the sun above ~12°): daylight scenes are normalised exactly as before.

export const KEY = 2.3, X_MIN = 0.35, X_MAX = 6;
const L10 = Math.log10;

/** Ferwerda et al. 1996: log10 threshold luminance of the cones for adapting luminance La (cd/m²) */
export function logTviCones(La: number): number {
  const l = L10(Math.max(La, 1e-12));
  if (l <= -2.6) return -0.72;
  if (l >= 1.9) return l - 1.255;
  return Math.pow(0.249 * l + 0.65, 2.7) - 0.72;
}
/** Ferwerda et al. 1996: log10 threshold luminance of the rods */
export function logTviRods(La: number): number {
  const l = L10(Math.max(La, 1e-12));
  if (l <= -3.94) return -2.86;
  if (l >= -1.44) return l - 0.395;
  return Math.pow(0.405 * l + 1.6, 2.18) - 2.86;
}
/** the adapting luminance below which the rods' threshold no longer falls (Ferwerda's plateau): 10^−3.94 cd/m² */
export const LA_ABSOLUTE = Math.pow(10, -3.94);
/** Krawczyk et al. 2005 key value */
export const keyValue = (La: number) => 1.03 - 2 / (2 + L10(Math.max(0, La) + 1));
/** adapting luminance (cd/m²) of an 18 % grey under the illuminance E (lx) */
export const adaptingLuminance = (lux: number) => (0.18 * lux) / Math.PI;
/** the zenith sun in a clear sky (USNO-C171: 108 400 + 15 350 lx) */
export const LA_NOON = adaptingLuminance(123800);
/** displayed brightness of a grey at the adapting luminance La, relative to the zenith sun (≤ 1) */
export function adaptationBrightness(La: number): number {
  return Math.min(1, (keyValue(La) / keyValue(LA_NOON)) * Math.min(1, La / LA_ABSOLUTE));
}

/** Reflected metering (C; the principle of ISO 2720 reflected-light meters): the camera meters the frame, not an 18 %
 *  grey card. A centre-weighted meter gives the top of a landscape frame (the sky) about a fifth of the weight (C). The
 *  sky's mean radiance is E_sky / π and the grey ground's 0.18 E / π, so the frame reads F = 0.8 + 0.2 · E_sky / (0.18 E)
 *  grey-card units: ≈ 0.94 at the zenith sun (the sky darker than the sunlit ground), ≈ 1.9 in twilight (the sky ~5.6×
 *  the ground), and the camera exposes for it. It acts only through the sky gain, i.e. only where the camera is already
 *  at its limit (a clear sky with the sun below ~5°): daylit and golden-hour scenes keep the session-3 law. The eye's key
 *  is taken at the frame's adapting luminance F · La, as Krawczyk et al. take it at the scene average. */
export const SKY_WEIGHT = 0.2;
export const meterFactor = (skyLux: number, lux: number) => 1 - SKY_WEIGHT + SKY_WEIGHT * (skyLux / Math.max(0.18 * lux, 1e-12));
export const METER_NOON = meterFactor(15354, 123800);

/** displayed brightness of the grey ground relative to the zenith sun, for the illuminance `lux` of which `skyLux` is
 *  diffuse (sky, moonlit sky, night sky): the key at the frame's adapting luminance, the limit of adaptation, and the
 *  exposure the meter sets for a frame that is F grey-card units bright */
export function displayedGrey(lux: number, skyLux: number): number {
  const F = meterFactor(skyLux, lux), La = F * adaptingLuminance(lux);
  const D = Math.min(1, (keyValue(La) / keyValue(METER_NOON * LA_NOON)) * Math.min(1, La / LA_ABSOLUTE));
  return D * Math.min(1, METER_NOON / F);
}

/** The sky gain G (≥ 1) that multiplies every sun-, sky- and moon-derived light. `renE` is the illuminance those lights
 *  put on the eye's reference surface in renderer units at G = 1 (sun · sin h + skylight luminance + moon, as the exposure
 *  estimate counts them); `lux` is the same illuminance in lux and `skyLux` its diffuse part. With the camera at its
 *  limit X_MAX the displayed grey is then KEY · displayedGrey. */
export function skyGain(renE: number, lux: number, skyLux = 0.18 * lux * (METER_NOON - 1 + SKY_WEIGHT) / SKY_WEIGHT): number {
  const target = (KEY / X_MAX) * displayedGrey(lux, skyLux);
  return Math.max(1, target / Math.max(renE, 1e-12));
}

/** Camera exposure target (the session-3 law, unchanged): the illuminance at the eye from the sky's lights (which carry
 *  G) weighted by the visible sky, plus the moon and nearby fires. */
export function exposureTarget(sunE: number, skyE: number, skyVis: number, moonE: number, fireE: number): number {
  const E = (sunE + skyE) * (0.15 + 0.85 * skyVis) + moonE + fireE + 0.004;
  return Math.min(X_MAX, Math.max(X_MIN, KEY / E));
}

/** The gain at which the fires' session-3 light values are physical (D-117 addendum): a lamp's point light is 0.08 · 40 =
 *  3.2 renderer candela (fire.ts), and an oil lamp gives about a candle, ~1 cd (C; the candela's historical definition,
 *  B), so fire light is pre-exposed by 3.2 renderer units per lux, against REN_PER_LUX_SKY · 0.796 = 5.1e-5 for the
 *  skylight at G = 1: a gain of ~63 000. That is about the moonlit-night gain (8.8e4 under a half moon), so the fires
 *  tuned at night are consistent with the physical night sky. Where the sky gain is lower (twilight, day) the fires' cast
 *  light is scaled by G / FIRE_GAIN, never above 1 (night unchanged). The flames themselves (emissive) are not scaled: a
 *  flame is thousands of times its surroundings' luminance at any of these levels. */
export const FIRE_GAIN = 3.2 / ((0.98 / 15354) * 0.796);
export const fireLightScale = (gain: number) => Math.min(1, gain / FIRE_GAIN);
