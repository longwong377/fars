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
