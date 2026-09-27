// The tone curve's "look" (D-309, session 12): AgX with a contrast and saturation grade in its log domain, fitted to the
// photographs. Measured (tools/dev/tone_fit.mjs): the session-11 midday world renders put the ground and buildings (the
// lower 60 % of the frame) at a compressed top (sunlit limestone never neared white; the court read as an overcast grey)
// against the sunlit Wikimedia photographs of the Terrace (fars-assets/photos: apadana, gate_of_all_nations,
// hall_100_columns; reference only). Plain AgX is known to be flat (Blender ships "Punchy" and contrast looks for it).
// The look is the ASC-CDL form of the AgX reference's looks (slope, power, saturation round Rec. 709 luma, applied after
// the sigmoid) plus a scene exposure factor; the fitted values stand for the whole outdoor range. CPU mirror (agxCPU) for
// the tests and the fit.
import { Fn, vec3, float, mat3, max, log2, clamp, pow, dot, mix } from 'three/tsl';

/** the fitted look (tools/dev/tone_fit.mjs, D-309) */
export const TONE_LOOK = { slope: 1.0, power: 1.4, sat: 0.9, exposure: 2.6 };

export const M_IN = [0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859];
export const M_OUT = [1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405];
export const S2R = [0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956];
export const R2S = [1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187];
export const MIN_EV = -12.47393, MAX_EV = 4.026069;
/** three's mat3(vec3 a, vec3 b, vec3 c) takes COLUMNS: M·v = a·v.x + b·v.y + c·v.z */
export const mulC = (m: number[], v: number[]) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
export const sigmoid = (x: number) => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; };
export type Look = typeof TONE_LOOK;
export function lookCPU(v: number[], L: Look = TONE_LOOK) {
  const c = v.map(x => Math.pow(Math.max(0, x * L.slope), L.power)), y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return c.map(x => y + L.sat * (x - y));
}
/** CPU mirror of agxLook: linear sRGB scene colour (already × the camera exposure) → linear sRGB display colour, 0..1 */
export function agxCPU(rgb: number[], L: Look = TONE_LOOK): number[] {
  let c = mulC(M_IN, mulC(S2R, rgb.map(x => x * L.exposure)));
  c = c.map(x => Math.min(1, Math.max(0, (Math.log2(Math.max(x, 1e-10)) - MIN_EV) / (MAX_EV - MIN_EV)))).map(sigmoid);
  c = lookCPU(c, L);
  c = mulC(M_OUT, c).map(x => Math.pow(Math.max(0, x), 2.2));
  return mulC(R2S, c).map(x => Math.min(1, Math.max(0, x)));
}
const col = (m: number[]): any => (mat3 as any)(vec3(m[0], m[1], m[2]), vec3(m[3], m[4], m[5]), vec3(m[6], m[7], m[8]));
/** AgX with the look (TSL): `color` linear scene colour × the camera exposure → linear display colour */
export const agxLook = Fn(([color]: any[]) => {
  const L = TONE_LOOK;
  let c: any = col(M_IN).mul(col(S2R).mul(vec3(color).mul(L.exposure)));
  c = clamp(log2(max(c, vec3(1e-10))).sub(MIN_EV).div(MAX_EV - MIN_EV), 0, 1);
  const x2 = c.mul(c), x4 = x2.mul(x2);
  c = x4.mul(x2).mul(15.5).sub(x4.mul(c).mul(40.14)).add(x4.mul(31.96)).sub(x2.mul(c).mul(6.868)).add(x2.mul(0.4298)).add(c.mul(0.1191)).sub(0.00232);
  c = pow(max(c.mul(L.slope), vec3(0)), vec3(L.power));
  const y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(y), c, float(L.sat));
  c = pow(max(col(M_OUT).mul(c), vec3(0)), vec3(2.2));
  return clamp(col(R2S).mul(c), 0, 1);
});
