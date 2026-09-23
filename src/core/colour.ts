// Colour conversions for measured / reasoned colour values (D-030): CIELAB (D65) → CIE XYZ → linear-light sRGB (IEC 61966-2-1
// primaries), sRGB transfer function, and Munsell neutral value → luminous reflectance (ASTM D1535 polynomial). Pure functions,
// no renderer dependency (used by the relief workers, the materials and the tests).
export type RGB = [number, number, number];
const D65 = [0.95047, 1, 1.08883], EPS = 216 / 24389, KAPPA = 24389 / 27;
/** CIELAB (D65 white) → linear sRGB (may fall slightly outside [0, 1] for very saturated colours; clamped) */
export function labToLinear(L: number, a: number, b: number): RGB {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > EPS ? t ** 3 : (116 * t - 16) / KAPPA);
  const X = D65[0] * inv(fx), Y = L > KAPPA * EPS ? fy ** 3 : L / KAPPA, Z = D65[2] * inv(fz);
  const c = (v: number) => Math.min(1, Math.max(0, v));
  return [c(3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z), c(-0.969266 * X + 1.8760108 * Y + 0.041556 * Z), c(0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z)];
}
export const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const labToSrgb = (L: number, a: number, b: number): RGB => labToLinear(L, a, b).map(linearToSrgb) as RGB;
/** relative luminance (linear sRGB, Rec. 709 weights) */
export const luminance = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
/** Munsell value V (neutral N V) → luminous reflectance Y (0..1), ASTM D1535 */
export const munsellY = (V: number) => (1.1914 * V - 0.22533 * V ** 2 + 0.23352 * V ** 3 - 0.020484 * V ** 4 + 0.00081939 * V ** 5) / 100;
