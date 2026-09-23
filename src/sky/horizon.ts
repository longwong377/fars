// CPU evaluation of the sky radiance that three's SkyMesh draws (Preetham-model variant; the same constants and steps as
// its TSL colour node, without the sun disc and the procedural 2-D cloud layer). Used to make everything that fades into
// the distance (fog, the far edge of the cloud layer, rain shafts) converge to the radiance the sky actually shows at the
// horizon, and scales the dome so that it agrees with the scene's skylight (skyCalibration). With a hand-set fog colour, distant terrain and rain shafts came out brighter than the sky behind them
// (session 3, measured on the rain-approach moment: shafts 227, sky beside them 209, horizon band 194 in sRGB).
// Pure functions (node-testable).
import { skyViewRadiance, type SkyView } from './atmosphere';

export interface SkyParams { turbidity: number; rayleigh: number; mieCoefficient: number; mieDirectionalG: number }
type V3 = [number, number, number];

const TOTAL_RAYLEIGH: V3 = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const MIE_CONST: V3 = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];
const CUTOFF = 1.6110731556870734, STEEPNESS = 1.5, EE = 1000;
const RAYLEIGH_ZENITH = 8.4e3, MIE_ZENITH = 1.25e3;
const THREE_OVER_16PI = 0.05968310365946075, ONE_OVER_4PI = 0.07957747154594767;

/** linear radiance (renderer units, before exposure) that SkyMesh draws in unit direction `dir` (world, y up) for the
 *  unit sun direction `sun` */
export function skyRadiance(dir: V3, sun: V3, p: SkyParams): V3 {
  const sunY = Math.max(-1, Math.min(1, sun[1]));
  const sunE = EE * Math.max(0, 1 - Math.exp(-(CUTOFF - Math.acos(sunY)) / STEEPNESS));
  // SkyMesh uses sunPosition.y / 450000 with sunPosition = sunDir × DOME (60000 m); the fade therefore depends on DOME
  const sunfade = 1 - Math.max(0, Math.min(1, 1 - Math.exp((sunY * 60000) / 450000)));
  const rc = p.rayleigh - (1 - sunfade);
  const betaR = TOTAL_RAYLEIGH.map(v => v * rc) as V3;
  const c = 0.2 * p.turbidity * 10e-18;
  const betaM = MIE_CONST.map(v => 0.434 * c * v * p.mieCoefficient) as V3;
  const zen = Math.acos(Math.max(0, dir[1]));
  const inv = 1 / (Math.cos(zen) + 0.15 * Math.pow(93.885 - (zen * 180) / Math.PI, -1.253));
  const sR = RAYLEIGH_ZENITH * inv, sM = MIE_ZENITH * inv;
  const cosT = dir[0] * sun[0] + dir[1] * sun[1] + dir[2] * sun[2];
  const rPhase = THREE_OVER_16PI * (1 + (cosT * 0.5 + 0.5) ** 2);
  const g = p.mieDirectionalG, g2 = g * g;
  const mPhase = ONE_OVER_4PI * (1 - g2) / Math.pow(1 - 2 * g * cosT + g2, 1.5);
  const mix5 = Math.max(0, Math.min(1, Math.pow(1 - sun[1], 5)));
  const out: V3 = [0, 0, 0], add: V3 = [0, 0.0003, 0.00075];
  for (let k = 0; k < 3; k++) {
    const Fex = Math.exp(-(betaR[k] * sR + betaM[k] * sM));
    const ratio = (betaR[k] * rPhase + betaM[k] * mPhase) / (betaR[k] + betaM[k]);
    let Lin = Math.pow(sunE * ratio * (1 - Fex), 1.5);
    Lin *= 1 + (Math.sqrt(sunE * ratio * Fex) - 1) * mix5;
    const L0 = 0.1 * Fex;
    out[k] = (Lin + L0) * 0.04 + add[k];
  }
  return out;
}

/** sky radiance just above the horizon (1.5°), averaged over a 90° fan of azimuths centred on the horizontal view
 *  direction (vx, vz); what the fog, the far cloud edge and the rain shafts converge to */
export function horizonRadiance(sun: V3, p: SkyParams, vx: number, vz: number): V3 {
  const h = Math.hypot(vx, vz) || 1, a0 = Math.atan2(vz / h, vx / h), el = (1.5 * Math.PI) / 180;
  const out: V3 = [0, 0, 0]; const N = 5;
  for (let i = 0; i < N; i++) {
    const a = a0 + ((i / (N - 1)) - 0.5) * (Math.PI / 2);
    const r = skyRadiance([Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)], sun, p);
    out[0] += r[0] / N; out[1] += r[1] / N; out[2] += r[2] / N;
  }
  return out;
}

/** luminance of the horizontal irradiance ∫ L cosθ dω of that sky (16 × 32 quadrature over the upper hemisphere: within
 *  2 % of a 400 × 720 reference at every sun altitude; 6 × 12 missed the low-sun aureole by 64 %). Cached on its inputs
 *  (~0.4 ms per evaluation). */
let irrKey = '', irrVal = 0;
export function skyIrradianceY(sun: V3, p: SkyParams): number {
  const key = `${sun[0].toFixed(4)},${sun[1].toFixed(4)},${sun[2].toFixed(4)},${p.turbidity.toFixed(3)},${p.rayleigh},${p.mieCoefficient.toFixed(5)},${p.mieDirectionalG}`;
  if (key === irrKey) return irrVal;
  const NE = 16, NA = 32; let E = 0;
  for (let i = 0; i < NE; i++) {
    const th0 = (i / NE) * (Math.PI / 2), th1 = ((i + 1) / NE) * (Math.PI / 2), th = (th0 + th1) / 2;
    const band = (Math.PI * (Math.cos(th0) ** 2 - Math.cos(th1) ** 2)) / NA; // ∫ cosθ sinθ dθ dφ over the cell
    for (let j = 0; j < NA; j++) {
      const a = ((j + 0.5) / NA) * 2 * Math.PI, st = Math.sin(th);
      const r = skyRadiance([Math.cos(a) * st, Math.cos(th), Math.sin(a) * st], sun, p);
      E += (0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2]) * band;
    }
  }
  irrKey = key; irrVal = E; return E;
}

/** The twilight part of the dome (D-116): a physical sky-view table for the current sun (atmosphere.ts) and its weight
 *  against the Preetham dome (1 at and below the blend's lower end, 0 by day). */
export interface TwilightSky { view: SkyView; w: number }
/** weight of the physical twilight sky against the Preetham dome for a sun at apparent altitude h (deg): the physical
 *  model below +2° (where Preetham has no Earth's shadow and wrong colours), Preetham above +10° (as calibrated in D-060),
 *  a smoothstep between (C) */
export function twilightWeight(hDeg: number): number { const t = Math.min(1, Math.max(0, (hDeg - TW_LO) / (TW_HI - TW_LO))); return 1 - t * t * (3 - 2 * t); }
export const TW_LO = 2, TW_HI = 10;

/** Calibration of the dome against the scene's skylight (session 3, D-060; twilight part D-116). The hemisphere light
 *  stands for the sky's irradiance on a horizontal surface (three: diffuse radiance = albedo · I · colour / π), so the
 *  dome must carry the same irradiance: each part is scaled by E_hemi / ∫ L cos θ dω of that part, and they are mixed by
 *  the twilight weight w. Measured: uncalibrated, the Preetham dome is 9–15× too bright in daylight (a pale, washed-out
 *  sky, horizons 12× sunlit ground) and 35× too dark in civil twilight. At night both give way to the Preetham dome at
 *  scale 1 (the night sky, airglow and Milky Way keep their own perceptual values; D-047).
 *  Returns kP (the Preetham dome's factor; `scale`, as before), kT (the factor on the raw sky-view radiance) and the
 *  horizon radiance the fog, the far cloud haze and rain shafts converge to: the calibrated dome 1.5° above the horizon
 *  across the view (a 90° fan), capped at 2.5× the all-round mean so the solar aureole near a low sun does not light up
 *  the whole distance (C). */
export function skyCalibration(sun: V3, p: SkyParams, hemiE: number, nightFactor: number, vx: number, vz: number, twilight?: TwilightSky | null): { scale: number; kP: number; kT: number; horizon: V3 } {
  const n = Math.max(0, Math.min(1, nightFactor)), w = twilight ? Math.max(0, Math.min(1, twilight.w)) : 0;
  const E = w < 1 ? skyIrradianceY(sun, p) : 1;
  const kday = Math.min(50, Math.max(0.01, hemiE / Math.max(E, 1e-6)));
  const kP = (1 - w) * (1 - n) * kday + n;
  const kT = twilight && w > 0 ? (w * (1 - n) * hemiE) / Math.max(twilight.view.irradianceY, 1e-30) : 0;
  const Y = (c: V3) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const h = calibratedHorizon(sun, p, kP, kT, twilight?.view ?? null, vx, vz);
  let mean = 0; for (const [x, z] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) mean += Y(calibratedHorizon(sun, p, kP, kT, twilight?.view ?? null, x, z)) / 4;
  const cap = Math.min(1, (2.5 * mean) / Math.max(Y(h), 1e-12));
  return { scale: kP, kP, kT, horizon: [h[0] * cap, h[1] * cap, h[2] * cap] };
}

/** the calibrated dome (without the sun disc) in world direction `dir`: kP · Preetham + kT · sky-view table */
export function domeRadiance(dir: V3, sun: V3, p: SkyParams, kP: number, kT: number, view: SkyView | null): V3 {
  const a = kP > 0 ? skyRadiance(dir, sun, p) : [0, 0, 0] as V3;
  const out: V3 = [a[0] * kP, a[1] * kP, a[2] * kP];
  if (view && kT > 0) { const t = skyViewRadiance(view, dir, sun[0], sun[2]); out[0] += t[0] * kT; out[1] += t[1] * kT; out[2] += t[2] * kT; }
  return out;
}
function calibratedHorizon(sun: V3, p: SkyParams, kP: number, kT: number, view: SkyView | null, vx: number, vz: number): V3 {
  const hl = Math.hypot(vx, vz) || 1, a0 = Math.atan2(vz / hl, vx / hl), el = (1.5 * Math.PI) / 180;
  const out: V3 = [0, 0, 0]; const N = 5;
  for (let i = 0; i < N; i++) {
    const a = a0 + ((i / (N - 1)) - 0.5) * (Math.PI / 2);
    const r = domeRadiance([Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)], sun, p, kP, kT, view);
    out[0] += r[0] / N; out[1] += r[1] / N; out[2] += r[2] / N;
  }
  return out;
}
