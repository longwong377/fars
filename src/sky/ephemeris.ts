// Sun, moon and star positions for Pārsa (brief §5.3). astronomy-engine (VSOP87-class, Espenak–Meeus ΔT incl.
// long-term extrapolation) does the astronomy; this module owns the proleptic Julian calendar and the local frame.
import * as A from 'astronomy-engine';
import { LATITUDE_N, LONGITUDE_E } from '../core/calendar';

export const OBSERVER_HEIGHT_M = 1625;
export const observer = new A.Observer(LATITUDE_N, LONGITUDE_E, OBSERVER_HEIGHT_M);

const J2000 = 2451545.0;
/** AstroTime from a UT Julian Date (proleptic Julian calendar handled by caller; JD itself is calendar-free). */
export function timeFromJD(jdUT: number): A.AstroTime { return A.MakeTime(jdUT - J2000); }

export interface HorizonPos { azimuth: number; altitude: number; ra: number; dec: number }

/** Apparent topocentric horizontal position, refraction 'normal'. Azimuth: degrees from true north, clockwise. */
export function bodyHorizon(body: A.Body, jdUT: number): HorizonPos {
  const t = timeFromJD(jdUT);
  const eq = A.Equator(body, t, observer, true, true);
  const h = A.Horizon(t, observer, eq.ra, eq.dec, 'normal');
  return { azimuth: h.azimuth, altitude: h.altitude, ra: eq.ra, dec: eq.dec };
}
export const sunHorizon = (jd: number) => bodyHorizon(A.Body.Sun, jd);
export const moonHorizon = (jd: number) => bodyHorizon(A.Body.Moon, jd);

export function moonPhase(jdUT: number) {
  const t = timeFromJD(jdUT);
  const ill = A.Illumination(A.Body.Moon, t);
  return { phaseAngleDeg: ill.phase_angle, fraction: ill.phase_fraction, elongationDeg: A.MoonPhase(t) };
}

/** Sun's apparent ecliptic longitude (deg) — used to map proleptic dates onto modern climatological seasons. */
export function sunEclipticLongitude(jdUT: number): number { return A.SunPosition(timeFromJD(jdUT)).elon; }

/** Rotation matrix taking J2000 equatorial unit vectors to the local horizon (x=east, y=up, z=south → caller converts). */
export function j2000ToHorizonMatrix(jdUT: number): number[] {
  const t = timeFromJD(jdUT);
  // EQJ -> HOR includes precession, nutation and Earth rotation; astronomy-engine HOR axes: x=north, y=west, z=zenith.
  return A.Rotation_EQJ_HOR(t, observer).rot.flat();
}

/** Precess a J2000 star with proper motion to epoch jd, returning J2000-frame unit vector at that epoch (proper motion
 *  applied linearly in RA/Dec; precession is applied later by j2000ToHorizonMatrix). pm in mas/yr, pmra includes cos(dec). */
export function starVectorAtEpoch(raDeg: number, decDeg: number, pmraMas: number, pmdecMas: number, jdUT: number): [number, number, number] {
  const years = (jdUT - J2000) / 365.25;
  const dec = decDeg + (pmdecMas * years) / 3.6e6;
  const cd = Math.cos((decDeg * Math.PI) / 180);
  const ra = raDeg + (cd > 1e-6 ? (pmraMas * years) / 3.6e6 / cd : 0);
  const r = (ra * Math.PI) / 180, d = (dec * Math.PI) / 180;
  return [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)];
}

/** Grid north is 341° true: world −Z points to grid north. Convert a true azimuth/altitude to a world-space unit vector. */
export const GRID_NORTH_TRUE_DEG = 341.0;
export function azAltToWorld(azimuthDeg: number, altitudeDeg: number): [number, number, number] {
  const azGrid = ((azimuthDeg - GRID_NORTH_TRUE_DEG) * Math.PI) / 180;
  const alt = (altitudeDeg * Math.PI) / 180;
  const ch = Math.cos(alt);
  // grid east = +X, grid north = −Z, up = +Y
  return [ch * Math.sin(azGrid), Math.sin(alt), -ch * Math.cos(azGrid)];
}

/** Horizontal az/alt (deg, geometric — no refraction) of a J2000 star with proper motion at epoch jd. Shared by the
 *  star renderer and its test. */
export function starAzAlt(raDeg: number, decDeg: number, pmraMas: number, pmdecMas: number, jdUT: number, m = j2000ToHorizonMatrix(jdUT)) {
  const v = starVectorAtEpoch(raDeg, decDeg, pmraMas, pmdecMas, jdUT);
  const hx = m[0] * v[0] + m[3] * v[1] + m[6] * v[2], hy = m[1] * v[0] + m[4] * v[1] + m[7] * v[2], hz = m[2] * v[0] + m[5] * v[1] + m[8] * v[2];
  return { azimuth: ((Math.atan2(-hy, hx) * 180) / Math.PI + 360) % 360, altitude: (Math.asin(Math.max(-1, Math.min(1, hz))) * 180) / Math.PI };
}

/** The Earth's shadow on the Moon (session 9, T-J5; the lunar eclipses of the year: tools/dev/eclipses_467.ts). Geometry A/B:
 *  geocentric Sun and Moon from astronomy-engine (its ΔT model; B for 467 BCE), the umbral and penumbral radii by the classical
 *  formulas with the 1.02 enlargement for the atmosphere (Chauvenet/Danjon; B). Directions are in the world frame (azAltToWorld):
 *  `shadowW` is the shadow's centre as the observer sees it next to the Moon's topocentric place (geocentric offsets are small
 *  angles, so the offset of the shadow from the Moon is carried over), radii in radians. `light` is the Moon's brightness
 *  relative to uneclipsed, integrated over the disc (penumbra: the visible fraction of the Sun, linear across it; umbra:
 *  UMBRA_BRIGHTNESS, the red light the Earth's atmosphere bends into the shadow, C). */
export const UMBRA_BRIGHTNESS = 3e-4; // Danjon L ≈ 2 (C): a deep brick-red umbra, grey at its centre
export const UMBRA_RGB: [number, number, number] = [1.0, 0.42, 0.22]; // C
const KM_PER_AU = 149597870.7, R_EARTH = 6378.14, R_SUN = 696000, R_MOON = 1737.4;
export function earthShadow(jdUT: number, moonTopoW?: [number, number, number]) {
  const t = timeFromJD(jdUT), S = A.GeoVector(A.Body.Sun, t, true), M = A.GeoMoon(t);
  const dS = Math.hypot(S.x, S.y, S.z), dM = Math.hypot(M.x, M.y, M.z);
  const R = A.Rotation_EQJ_HOR(t, observer).rot; // hor = R·j (x north, y west, z zenith)
  const toW = (x: number, y: number, z: number): [number, number, number] => { const hx = R[0][0] * x + R[1][0] * y + R[2][0] * z, hy = R[0][1] * x + R[1][1] * y + R[2][1] * z, hz = R[0][2] * x + R[1][2] * y + R[2][2] * z;
    const n = Math.hypot(hx, hy, hz); return azAltToWorld(((Math.atan2(-hy, hx) * 180) / Math.PI + 360) % 360, (Math.asin(Math.max(-1, Math.min(1, hz / n))) * 180) / Math.PI); };
  const aW = toW(-S.x / dS, -S.y / dS, -S.z / dS), mW = toW(M.x / dM, M.y / dM, M.z / dM), base = moonTopoW ?? mW;
  const sw = [base[0] + aW[0] - mW[0], base[1] + aW[1] - mW[1], base[2] + aW[2] - mW[2]], sn = Math.hypot(sw[0], sw[1], sw[2]);
  const piM = Math.asin(R_EARTH / (dM * KM_PER_AU)), piS = Math.asin(R_EARTH / (dS * KM_PER_AU)), sS = Math.asin(R_SUN / (dS * KM_PER_AU));
  const umbra = 1.02 * (piM + piS - sS), penumbra = 1.02 * (piM + piS + sS), moonR = Math.asin(R_MOON / (dM * KM_PER_AU));
  const cosSep = (-(S.x * M.x + S.y * M.y + S.z * M.z)) / (dS * dM), sep = Math.acos(Math.max(-1, Math.min(1, cosSep)));
  // the disc's brightness: a 21 × 21 grid over the disc in the shadow's frame (the Moon's centre at distance sep)
  let light = 1;
  if (sep < penumbra + moonR) { let s = 0, n = 0;
    for (let i = -10; i <= 10; i++) for (let j = -10; j <= 10; j++) { const u = (i / 10) * moonR, v = (j / 10) * moonR; if (u * u + v * v > moonR * moonR) continue;
      s += shadowBrightness(Math.hypot(sep + u, v), umbra, penumbra); n++; }
    light = s / n; }
  return { shadowW: [sw[0] / sn, sw[1] / sn, sw[2] / sn] as [number, number, number], umbra, penumbra, moonR, sep, light };
}
/** brightness of a lunar surface point at angular distance d (rad) from the shadow's axis, relative to uneclipsed */
export function shadowBrightness(d: number, umbra: number, penumbra: number): number {
  if (d >= penumbra) return 1; if (d <= umbra) return UMBRA_BRIGHTNESS;
  return UMBRA_BRIGHTNESS + (1 - UMBRA_BRIGHTNESS) * ((d - umbra) / (penumbra - umbra));
}
