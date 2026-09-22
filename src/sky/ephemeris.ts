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
