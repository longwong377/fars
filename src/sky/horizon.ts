// CPU evaluation of the sky radiance that three's SkyMesh draws (Preetham-model variant; the same constants and steps as
// its TSL colour node, without the sun disc and the procedural 2-D cloud layer). Used to make everything that fades into
// the distance (fog, the far edge of the cloud layer, rain shafts) converge to the radiance the sky actually shows at the
// horizon, and scales the dome so that it agrees with the scene's skylight (skyCalibration). With a hand-set fog colour, distant terrain and rain shafts came out brighter than the sky behind them
// (session 3, measured on the rain-approach moment: shafts 227, sky beside them 209, horizon band 194 in sRGB).
// Pure functions (node-testable).

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

/** Calibration of the SkyMesh dome against the scene's skylight (session 3, D-060). The hemisphere light stands for the
 *  sky's irradiance on a horizontal surface (three: diffuse radiance = albedo · I · colour / π), so the dome must carry
 *  the same irradiance: scale = E_hemi / ∫ L cosθ dω. Measured: uncalibrated, the dome is 9–15× too bright in daylight
 *  (a pale, washed-out sky, horizons 12× sunlit ground) and 35× too dark in civil twilight. At night the scale returns to
 *  1 (the night sky, airglow and Milky Way keep their own perceptual values; the night skylight is a visibility floor).
 *  Returns the scale and the horizon radiance the fog, the far cloud haze and rain shafts converge to: the scaled dome
 *  1.5° above the horizon across the view (a 90° fan), capped at 2.5× the all-round mean so the solar aureole near a low
 *  sun does not light up the whole distance (C). */
export function skyCalibration(sun: V3, p: SkyParams, hemiE: number, nightFactor: number, vx: number, vz: number): { scale: number; horizon: V3 } {
  const E = skyIrradianceY(sun, p);
  const k = Math.min(50, Math.max(0.01, hemiE / Math.max(E, 1e-6)));
  const scale = k + (1 - k) * Math.max(0, Math.min(1, nightFactor));
  const Y = (c: V3) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const h = horizonRadiance(sun, p, vx, vz);
  let mean = 0; for (const [x, z] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) mean += Y(horizonRadiance(sun, p, x, z)) / 4;
  const cap = Math.min(1, (2.5 * mean) / Math.max(Y(h), 1e-9));
  return { scale, horizon: [h[0] * scale * cap, h[1] * scale * cap, h[2] * scale * cap] };
}
