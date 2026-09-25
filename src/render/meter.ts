// Frame meter (D-159, C): the centre-weighted log-average luminance of the frame before exposure, rendered into a tiny
// float target inside the post graph and read back on the CPU, so the eye adaptation can open up for a frame that is
// mostly shade and close down for one that is mostly glare, as a camera's evaluative meter and the eye's field adaptation
// do. It corrects the illuminance law (exposure.ts) by a fraction of the difference, within bounds; the law stays the
// anchor (it is what the night, twilight and interior tests pin).
import * as THREE from 'three/webgpu';
import { rtt, vec4, vec3, vec2, log, max, float, dot, uv, convertToTexture } from 'three/tsl';

export const METER_W = 24, METER_H = 14;
/** the meter's texture node for a scene-linear (pre-exposure) colour node: per texel the mean of 3 × 3 taps of
 *  ln(luminance), so a small bright doorway or a dark slot is averaged, not point-sampled */
export function meterNode(src: any) {
  // the TRAA node's own resolve texture (convertToTexture would wrap a TempNode in a full-resolution render-to-texture)
  const tex = (typeof src?.getTextureNode === 'function' ? src.getTextureNode() : convertToTexture(src)) as any;
  const d = vec2(1 / (METER_W * 3), 1 / (METER_H * 3));
  let acc: any = float(0);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const c = tex.sample(uv().add(d.mul(vec2(i, j)))).rgb;
    acc = acc.add(log(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-7)));
  }
  return rtt(vec4(acc.div(9), 0, 0, 1), METER_W, METER_H, { type: THREE.FloatType }) as any;
}

/** centre weight of a meter texel: a Gaussian in the frame's normalised coordinates (the centre counts ~3× the corners) */
export function meterWeight(i: number, j: number, w = METER_W, h = METER_H) {
  const x = ((i + 0.5) / w) * 2 - 1, y = ((j + 0.5) / h) * 2 - 1;
  return Math.exp(-(x * x + y * y) / (2 * 0.55 * 0.55));
}
/** centre-weighted mean of ln(luminance) over the meter's texels (RGBA float, red = ln L) */
export function meterLogMean(px: ArrayLike<number>, w = METER_W, h = METER_H): number {
  let s = 0, ws = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = px[(j * w + i) * 4]; if (!Number.isFinite(v)) continue;
    const wt = meterWeight(i, j, w, h); s += v * wt; ws += wt;
  }
  return ws > 0 ? s / ws : NaN;
}

/** the meter's gain on the law, in EV (C): k of the difference between the law's reference (an 18 % grey under the
 *  illuminance the law exposes for: E = KEY / X) and the frame's centre-weighted log-average, bounded to −1 … +1.5 EV,
 *  and faded out below ~10 lx at the eye (mesopic and night vision stay with the absolute-threshold law, D-117) */
export const METER_K = 0.6, METER_MIN_EV = -1, METER_MAX_EV = 1.5;
export function meterEV(lnFrame: number, lawExposure: number, key: number, eyeLux: number): number {
  if (!Number.isFinite(lnFrame) || !(lawExposure > 0)) return 0;
  const lnRef = Math.log((0.18 * (key / lawExposure)) / Math.PI);
  const ev = (METER_K * (lnRef - lnFrame)) / Math.LN2;
  const t = Math.min(1, Math.max(0, (Math.log10(Math.max(eyeLux, 1e-9)) - 1) / 1)); // 10 lx → 0, 100 lx → 1
  const fade = t * t * (3 - 2 * t);
  return Math.min(METER_MAX_EV, Math.max(METER_MIN_EV, ev)) * fade;
}

// ---- D-224: the bright majority ------------------------------------------------------------------------------------------
// Fault (D-159, D-219): the mean meter may close the law down by 1 EV at most, so a frame that is mostly bright exterior
// seen from shade (a portico looking out, a doorway filling the view) kept the shade's exposure and the sky rendered 5–7×
// display white (the rain-approach portico: exposure 36). An eye that fixates the bright view adapts to it within seconds.
// Rule (C): texels that would display ≥ BRIGHT_EV above the law's reference grey are "bright" (at AgX's shoulder: its white
// is 0.18 · 2^4.03). When they are the centre-weighted majority of the frame, the eye adapts to them: the correction becomes
// METER_K of the difference between the reference and the bright texels' log-mean (as D-159 does for the whole frame),
// blended in over a weighted bright fraction of BRIGHT_F0 … BRIGHT_F1 (a true majority: the first render, with 0.3 … 0.6,
// closed hall-out down 1.6 EV more, its doorway being 43 % of the centre-weighted field, and the door no longer burned), never closing further than the outdoor law's own
// exposure (the eye out in that light) nor than BRIGHT_MIN_EV. A bright door in a dark hall (hall-out: 43 % of the weighted
// field, 8 % clipped) does not reach the blend: the door still blows out from inside, as a camera and an eye adapted to the hall see
// it; the eye adapting across the threshold is the adaptation over time (exposure.ts, carryEye).
export const BRIGHT_EV = 3, BRIGHT_F0 = 0.5, BRIGHT_F1 = 0.65, BRIGHT_MIN_EV = -6;
/** the meter's texels (ln L, the red channel of the RGBA float read-back) */
export function meterTexels(px: ArrayLike<number>, w = METER_W, h = METER_H): Float32Array {
  const t = new Float32Array(w * h); for (let i = 0; i < w * h; i++) t[i] = px[i * 4]; return t;
}
/** centre-weighted fraction of the texels brighter than lnT, and their weighted log-mean */
export function brightShare(tex: ArrayLike<number>, lnT: number, w = METER_W, h = METER_H): { f: number; lnHi: number } {
  let wb = 0, ws = 0, sb = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = tex[j * w + i]; if (!Number.isFinite(v)) continue;
    const wt = meterWeight(i, j, w, h); ws += wt; if (v > lnT) { wb += wt; sb += v * wt; }
  }
  return { f: ws > 0 ? wb / ws : 0, lnHi: wb > 0 ? sb / wb : NaN };
}
/** the meter's gain in EV from the texels (D-159's mean meter with D-224's bright-majority rule); `outdoorExposure`: the
 *  law's exposure for the same light in the open (vis 1), the floor of the bright correction */
export function meterEVFrame(tex: ArrayLike<number> | null, lawExposure: number, key: number, eyeLux: number, outdoorExposure?: number, w = METER_W, h = METER_H): { ev: number; bright: number; evMean: number } {
  if (!tex || !(lawExposure > 0)) return { ev: 0, bright: 0, evMean: 0 };
  let s = 0, ws = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = tex[j * w + i]; if (!Number.isFinite(v)) continue; const wt = meterWeight(i, j, w, h); s += v * wt; ws += wt; }
  if (!(ws > 0)) return { ev: 0, bright: 0, evMean: 0 };
  const evMean = meterEV(s / ws, lawExposure, key, 1e9); // unfaded; the fade is applied once below
  const lnRef = Math.log((0.18 * (key / lawExposure)) / Math.PI);
  const { f, lnHi } = brightShare(tex, lnRef + BRIGHT_EV * Math.LN2, w, h);
  let ev = evMean;
  if (f > BRIGHT_F0 && Number.isFinite(lnHi)) {
    const floor = Math.max(BRIGHT_MIN_EV, outdoorExposure && outdoorExposure > 0 ? Math.log2(outdoorExposure / lawExposure) : BRIGHT_MIN_EV);
    const evB = Math.min(evMean, Math.max(floor, (METER_K * (lnRef - lnHi)) / Math.LN2));
    const t = Math.min(1, (f - BRIGHT_F0) / (BRIGHT_F1 - BRIGHT_F0)), wB = t * t * (3 - 2 * t);
    ev = evMean + (evB - evMean) * wB;
  }
  const tl = Math.min(1, Math.max(0, (Math.log10(Math.max(eyeLux, 1e-9)) - 1) / 1)), fade = tl * tl * (3 - 2 * tl);
  return { ev: ev * fade, bright: f, evMean: evMean * fade }; // evMean: D-159's correction alone (for the record)
}
