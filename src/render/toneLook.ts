// The tone curve's "look" (D-309, session 12): AgX with a contrast and saturation grade in its log domain, fitted to the
// photographs. Measured (tools/dev/tone_fit.mjs): the session-11 midday world renders put the ground and buildings (the
// lower 60 % of the frame) at a compressed top (sunlit limestone never neared white; the court read as an overcast grey)
// against the sunlit Wikimedia photographs of the Terrace (fars-assets/photos: apadana, gate_of_all_nations,
// hall_100_columns; reference only). Plain AgX is known to be flat (Blender ships "Punchy" and contrast looks for it).
// The look is the ASC-CDL form of the AgX reference's looks (slope, power, saturation round Rec. 709 luma, applied after
// the sigmoid) plus a scene exposure factor; the fitted values stand for the whole outdoor range. CPU mirror (agxCPU) for
// the tests and the fit.
import { Fn, vec3, float, mat3, max, log2, clamp, pow, dot, mix, uniform } from 'three/tsl';

/** the fitted look (tools/dev/tone_fit.mjs, D-309) */
export const TONE_LOOK = { slope: 1.0, power: 1.25, sat: 1.15, exposure: 3.2, warm: 0.04, split: 0.6, lift: 0.8 };
/** D-480 (light v1, the art direction): `warm` a white balance toward the Fars sun (scene-linear gains 1 + warm on red, 1 −
 *  warm on blue, renormalised to luminance 1); `split` a split tone in the look's display domain, the shade toward a cool
 *  blue-teal and the light toward amber (each weighted by (1 − y)² and y², so the mid grey keeps its luminance to < 1 level);
 *  `lift` a toe that opens the shade without greying the blacks: c + lift · c (1 − c)³ in the look's domain (0 and 1 fixed) */
export const SPLIT_COOL = [-0.4, 0.02, 0.75], SPLIT_WARM = [0.45, -0.05, -0.6];

export const M_IN = [0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859];
export const M_OUT = [1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405];
export const S2R = [0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956];
export const R2S = [1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187];
export const MIN_EV = -12.47393, MAX_EV = 4.026069;
/** three's mat3(vec3 a, vec3 b, vec3 c) takes COLUMNS: M·v = a·v.x + b·v.y + c·v.z */
export const mulC = (m: number[], v: number[]) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
export const sigmoid = (x: number) => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; };
/** D-480: run-time grade inputs from the sky (SkySystem.update): the night toe lift's share (1 on a moonless night, less under a
 *  bright moon, whose own light already reads) */
export const GRADE = { nightLift: 1 };
export type Look = { slope: number; power: number; sat: number; exposure: number; warm?: number; split?: number; lift?: number };
/** the look as uniforms (D-480: the light lab sweeps them without a reload; the game sets them once from TONE_LOOK) */
export const TONE_U = { slope: uniform(TONE_LOOK.slope), power: uniform(TONE_LOOK.power), sat: uniform(TONE_LOOK.sat), exposure: uniform(TONE_LOOK.exposure), warm: uniform(TONE_LOOK.warm), split: uniform(TONE_LOOK.split), lift: uniform(TONE_LOOK.lift) };
export function lookCPU(v: number[], L: Look = TONE_LOOK) {
  const c = v.map(x => Math.pow(Math.max(0, x * L.slope), L.power)).map(x => x + (L.lift ?? 0) * x * Math.pow(Math.max(0, 1 - x), 3)), y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const s = c.map(x => y + L.sat * (x - y)), sp = L.split ?? 0, a = (1 - y) * (1 - y) * sp, b = y * y * sp;
  return s.map((x, i) => x + 0.1 * (a * SPLIT_COOL[i] + b * SPLIT_WARM[i]));
}
/** the white balance's gains (luminance 1) */
export const wbGains = (w: number) => { const g = [1 + w, 1, 1 - w], y = 0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2]; return g.map(x => x / y); };
/** CPU mirror of agxLook: linear sRGB scene colour (already × the camera exposure) → linear sRGB display colour, 0..1 */
export function agxCPU(rgb: number[], L: Look = TONE_LOOK): number[] {
  const wb = wbGains(L.warm ?? 0);
  let c = mulC(M_IN, mulC(S2R, rgb.map((x, i) => x * L.exposure * wb[i])));
  c = c.map(x => Math.min(1, Math.max(0, (Math.log2(Math.max(x, 1e-10)) - MIN_EV) / (MAX_EV - MIN_EV)))).map(sigmoid);
  c = lookCPU(c, L);
  c = mulC(M_OUT, c).map(x => Math.pow(Math.max(0, x), 2.2));
  return mulC(R2S, c).map(x => Math.min(1, Math.max(0, x)));
}
const col = (m: number[]): any => (mat3 as any)(vec3(m[0], m[1], m[2]), vec3(m[3], m[4], m[5]), vec3(m[6], m[7], m[8]));
/** AgX with the look (TSL): `color` linear scene colour × the camera exposure → linear display colour */
export const agxLook = Fn(([color]: any[]) => {
  const L = TONE_U;
  const gy = float(1).add(L.warm.mul(0.2126 - 0.0722)), wb = vec3(float(1).add(L.warm), float(1), float(1).sub(L.warm)).div(gy);
  let c: any = col(M_IN).mul(col(S2R).mul(vec3(color).mul(wb).mul(L.exposure)));
  c = clamp(log2(max(c, vec3(1e-10))).sub(MIN_EV).div(MAX_EV - MIN_EV), 0, 1);
  const x2 = c.mul(c), x4 = x2.mul(x2);
  c = x4.mul(x2).mul(15.5).sub(x4.mul(c).mul(40.14)).add(x4.mul(31.96)).sub(x2.mul(c).mul(6.868)).add(x2.mul(0.4298)).add(c.mul(0.1191)).sub(0.00232);
  c = pow(max(c.mul(L.slope), vec3(0)), vec3(L.power, L.power, L.power));
  { const om = max(vec3(1).sub(c), vec3(0)); c = c.add(c.mul(om).mul(om).mul(om).mul(L.lift)); }
  const y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(y), c, L.sat);
  const sy = float(1).sub(y);
  c = c.add(vec3(...SPLIT_COOL).mul(sy.mul(sy)).add(vec3(...SPLIT_WARM).mul(y.mul(y))).mul(L.split.mul(0.1)));
  c = pow(max(col(M_OUT).mul(c), vec3(0)), vec3(2.2));
  return clamp(col(R2S).mul(c), 0, 1);
});
