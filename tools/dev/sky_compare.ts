// dev (D-156): the calibrated Preetham dome (three SkyMesh, day) against the calibrated physical sky-view table (D-116,
// Bruneton constants + Hillaire multiple scattering) at the same sun, both normalised to the same skylight irradiance
// (D-060), and against the CIE standard clear sky (ISO 15469 / CIE S 011 type 12, relative luminance distribution).
// Prints the radiance relative to the dome's horizontal irradiance at a few directions, and luminance / saturation.
// Usage: npx tsx tools/dev/sky_compare.ts [haze]
import { skyRadiance, skyIrradianceY } from '../../src/sky/horizon';
import { Atmosphere, aerosolTauFor, skyViewRadiance } from '../../src/sky/atmosphere';
import { extinctionK } from '../../src/sky/illuminance';
const haze = +(process.argv[2] ?? 0.25);
const P = { turbidity: 2.2 + 6 * haze, rayleigh: 1.2, mieCoefficient: 0.003 + 0.02 * haze, mieDirectionalG: 0.8 };
const A = new Atmosphere(aerosolTauFor(extinctionK(haze)));
const Y = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const sat = (c: number[]) => { const mx = Math.max(...c), mn = Math.min(...c); return mx > 0 ? (mx - mn) / mx : 0; };
const D = Math.PI / 180;
/** CIE general sky, type 12 (clear, low turbidity): L(χ, Z) / L_z (Z zenith angle, χ angle to the sun, Zs the sun's) */
function cie12(Z: number, chi: number, Zs: number) {
  const a = -1, b = -0.32, c = 10, d = -3, e = 0.45;
  const phi = (z: number) => 1 + a * Math.exp(b / Math.max(Math.cos(z), 1e-3)), f = (x: number) => 1 + c * (Math.exp(d * x) - Math.exp((d * Math.PI) / 2)) + e * Math.cos(x) ** 2;
  return (f(chi) * phi(Z)) / (f(Zs) * phi(0));
}
for (const alt of [3, 7, 12, 20, 40, 65]) {
  const s: [number, number, number] = [Math.cos(alt * D), Math.sin(alt * D), 0];
  const Ep = skyIrradianceY(s, P), view = A.skyView(alt), Eb = view.irradianceY;
  // CIE irradiance by quadrature (relative units)
  let Ec = 0; const NE = 45, NA = 90;
  for (let i = 0; i < NE; i++) for (let j = 0; j < NA; j++) { const th = ((i + 0.5) / NE) * (Math.PI / 2), ph = ((j + 0.5) / NA) * 2 * Math.PI; const dir = [Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)]; const chi = Math.acos(Math.max(-1, Math.min(1, dir[0] * s[0] + dir[1] * s[1] + dir[2] * s[2]))); Ec += cie12(th, chi, Math.PI / 2 - alt * D) * Math.cos(th) * Math.sin(th) * (Math.PI / 2 / NE) * ((2 * Math.PI) / NA); }
  const rows: string[] = [];
  for (const [el, phi] of [[1.5, 0], [1.5, 10], [1.5, 30], [1.5, 90], [1.5, 180], [30, 90], [60, 90], [90, 0], [alt + 5, 0]]) {
    const d: [number, number, number] = [Math.cos(el * D) * Math.cos(phi * D), Math.sin(el * D), Math.cos(el * D) * Math.sin(phi * D)];
    const lp = skyRadiance(d, s, P).map(v => v / Ep), lb = skyViewRadiance(view, d, s[0], s[2]).map(v => v / Eb);
    const chi = Math.acos(Math.max(-1, Math.min(1, d[0] * s[0] + d[1] * s[1] + d[2] * s[2]))), lc = cie12(Math.PI / 2 - el * D, chi, Math.PI / 2 - alt * D) / Ec;
    rows.push(`(${el}°,${phi}°) P ${Y(lp).toFixed(3)} s${sat(lp).toFixed(2)} | B ${Y(lb).toFixed(3)} s${sat(lb).toFixed(2)} | CIE ${lc.toFixed(3)}`);
  }
  console.log(`sun ${alt}°:\n  ` + rows.join('\n  '));
}
