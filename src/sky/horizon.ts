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
/** weight of the physical sky (the sky-view table) against the Preetham dome for a sun at apparent altitude h (deg).
 *  D-116 used the physical model below +2° and Preetham above +10°. Since D-156 the physical sky serves at every
 *  altitude: calibrated to the same skylight irradiance (D-060), it matches the CIE standard clear sky (ISO 15469 type 12)
 *  away from the sun within ~20–30 % where Preetham is ~2× too dark and oversaturated (0.9 vs 0.65), and Preetham's
 *  aureole near a low sun is 4–15× too strong (tools/dev/sky_compare.ts). The Preetham dome stays for the night sky
 *  (the night factor blends it in at scale 1, D-047). */
export function twilightWeight(_hDeg: number): number { return 1; }
/** the sky-view table is built up to this sun altitude (deg): all of them */
export const TW_LO = 2, TW_HI = 90;

/** Calibration of the dome against the scene's skylight (session 3, D-060; twilight part D-116). The hemisphere light
 *  stands for the sky's irradiance on a horizontal surface (three: diffuse radiance = albedo · I · colour / π), so the
 *  dome must carry the same irradiance: each part is scaled by E_hemi / ∫ L cos θ dω of that part, and they are mixed by
 *  the twilight weight w. Measured: uncalibrated, the Preetham dome is 9–15× too bright in daylight (a pale, washed-out
 *  sky, horizons 12× sunlit ground) and 35× too dark in civil twilight. At night both give way to the Preetham dome at
 *  scale 1 (the night sky, airglow and Milky Way keep their own perceptual values; D-047).
 *  Returns kP (the Preetham dome's factor; `scale`, as before), kT (the factor on the raw sky-view radiance) and the
 *  horizon radiance the fog, the far cloud haze and rain shafts converge to: the calibrated dome 1.5° above the horizon
 *  across the view (a 90° fan), capped at 2.5× the all-round mean so the solar aureole near a low sun does not light up
 *  the whole distance (C).
 *  D-224: `overcast` blends the dome toward the CIE overcast sky by the cloud cover (kP0 / kT0: the clear parts before
 *  that blend, for a dome whose clouds are drawn by the volumetric layer; ovL: the overcast zenith radiance × cover). */
export function skyCalibration(sun: V3, p: SkyParams, hemiE: number, nightFactor: number, vx: number, vz: number, twilight?: TwilightSky | null, overcast?: Overcast | null): { scale: number; kP: number; kT: number; horizon: V3; kP0: number; kT0: number; ovL: V3; wo: number } {
  const n = Math.max(0, Math.min(1, nightFactor)), w = twilight ? Math.max(0, Math.min(1, twilight.w)) : 0;
  const E = w < 1 ? skyIrradianceY(sun, p) : 1;
  const kday = Math.min(50, Math.max(0.01, hemiE / Math.max(E, 1e-6)));
  const kP0 = (1 - w) * (1 - n) * kday + n;
  const kT0 = twilight && w > 0 ? (w * (1 - n) * hemiE) / Math.max(twilight.view.irradianceY, 1e-30) : 0;
  // D-224: the overcast share (the weather's cover; none at night, where the D-047 night dome stays), CIE overcast
  // gradation, calibrated to the same irradiance: the clear parts keep (1 − wo) of it and the overcast part the rest
  const wo = overcast ? Math.max(0, Math.min(1, overcast.w)) * (1 - n) : 0;
  const kP = kP0 - ((1 - w) * (1 - n) * kday) * wo, kT = kT0 * (1 - wo);
  const Lz = (hemiE * wo) / OVERCAST_E_PER_LZ, ch = overcast?.chroma ?? [1, 1, 1];
  const ovL: V3 = [Lz * ch[0], Lz * ch[1], Lz * ch[2]];
  const Y = (c: V3) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const h = calibratedHorizon(sun, p, kP, kT, twilight?.view ?? null, vx, vz, ovL);
  let mean = 0; for (const [x, z] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) mean += Y(calibratedHorizon(sun, p, kP, kT, twilight?.view ?? null, x, z, ovL)) / 4;
  const cap = Math.min(1, (2.5 * mean) / Math.max(Y(h), 1e-12));
  return { scale: kP, kP, kT, horizon: [h[0] * cap, h[1] * cap, h[2] * cap], kP0, kT0, ovL, wo };
}

// ---- D-224: the overcast sky -----------------------------------------------------------------------------------------
/** The overcast part of the dome: weight (the weather's cloud cover, 0..1) and colour (Rec. 709 luminance 1). */
export interface Overcast { w: number; chroma: V3 }
/** CIE standard overcast sky (Moon & Spencer 1942, adopted by the CIE in 1955; ISO 15469 / CIE S 011 type 1):
 *  L(e) = L_z (1 + 2 sin e) / 3, zenith three times the horizon, no azimuth dependence. Its horizontal irradiance is
 *  ∫ L cos θ dω = (7π / 9) L_z, so L_z = E / (7π / 9). B (the standard; the distribution of heavy overcast, measured
 *  skies scatter about it: Q-530). */
export const OVERCAST_E_PER_LZ = (7 * Math.PI) / 9;
export const overcastGradation = (dirY: number) => (1 + 2 * Math.max(0, Math.min(1, dirY))) / 3;
/** mean correlated colour temperature of daylight under overcast skies, 6358 K (median 6341 K): R. L. Lee Jr. &
 *  J. Hernández-Andrés (2005), "Colors of the daytime overcast sky", Applied Optics 44(27) 5712–5722 (abstract via search
 *  extracts, SX; full text blocked). They find overcasts make daylight bluer than the light on their tops, more so the
 *  thicker the cloud (droplet absorption enhanced by multiple scattering). B (measured at Annapolis, not at Pārsa). */
export const OVERCAST_CCT = 6358;
/** the renderer's global daylight colour on a high cloud top at a noon sun (the D-116 model's sun + sky, luminance 1,
 *  haze 0.25: tools/dev/overcast_colour.ts); the overcast colour follows the model's change of the light reaching the cloud
 *  from this reference (a low sun and twilight light the deck bluer), times the measured overcast CCT */
export const GLOBAL_NOON_RGB: V3 = [0.992, 1.001, 1.009];
/** the overcast sky's colour for the light reaching the cloud top, `global` (any scale), in the renderer's colour
 *  (`cct` as xyToRenderer(daylightXY(OVERCAST_CCT)) — passed in to keep this file free of the atmosphere's spectra) */
export function overcastChroma(global: V3, cct: V3): V3 {
  const c: V3 = [0, 1, 2].map(i => (cct[i] * Math.max(0, global[i])) / GLOBAL_NOON_RGB[i]) as V3;
  const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return y > 1e-12 ? [c[0] / y, c[1] / y, c[2] / y] : [cct[0], cct[1], cct[2]];
}

/** the calibrated dome (without the sun disc) in world direction `dir`: kP · Preetham + kT · sky-view table, plus the
 *  overcast part `ovL` (its zenith radiance, already weighted by the cover) with the CIE overcast gradation (D-224) */
export function domeRadiance(dir: V3, sun: V3, p: SkyParams, kP: number, kT: number, view: SkyView | null, ovL?: V3 | null): V3 {
  const a = kP > 0 ? skyRadiance(dir, sun, p) : [0, 0, 0] as V3;
  const out: V3 = [a[0] * kP, a[1] * kP, a[2] * kP];
  if (view && kT > 0) { const t = skyViewRadiance(view, dir, sun[0], sun[2]); out[0] += t[0] * kT; out[1] += t[1] * kT; out[2] += t[2] * kT; }
  if (ovL) { const g = overcastGradation(dir[1]); out[0] += ovL[0] * g; out[1] += ovL[1] * g; out[2] += ovL[2] * g; }
  return out;
}
function calibratedHorizon(sun: V3, p: SkyParams, kP: number, kT: number, view: SkyView | null, vx: number, vz: number, ovL?: V3): V3 {
  const hl = Math.hypot(vx, vz) || 1, a0 = Math.atan2(vz / hl, vx / hl), el = (1.5 * Math.PI) / 180;
  const out: V3 = [0, 0, 0]; const N = 5;
  for (let i = 0; i < N; i++) {
    const a = a0 + ((i / (N - 1)) - 0.5) * (Math.PI / 2);
    const r = domeRadiance([Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)], sun, p, kP, kT, view, ovL);
    out[0] += r[0] / N; out[1] += r[1] / N; out[2] += r[2] / N;
  }
  return out;
}
