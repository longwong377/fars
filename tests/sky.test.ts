import { describe, it, expect } from 'vitest';
import { sunHorizon, moonPhase, sunEclipticLongitude } from '../src/sky/ephemeris';
import { julianDateUT, julianToJDN, jdnToJulian, babylonianDate, START_JDN, YEAR_END_JDN } from '../src/core/calendar';

// §13.6: sun within 0.1° of JPL Horizons. Horizons is unreachable (BLOCKERS B2). Until data/horizons/sun.csv is supplied,
// the reference is an independent low-precision algorithm (Meeus ch. 25 + GMST) implemented here from scratch; agreement
// within 0.1° across sampled dates validates the pipeline (calendar, JD, ΔT, frames). If data/horizons/sun.csv exists,
// it is used instead (see tests/sky.horizons.test.ts).
function meeusSun(jdUT: number, latDeg: number, lonDeg: number) {
  const rad = Math.PI / 180;
  // ΔT for -466 (Espenak–Meeus: u=(y-1820)/100; ΔT = -20 + 32u²), seconds
  const y = -466 + 0.3;
  const u = (y - 1820) / 100;
  const dT = -20 + 32 * u * u;
  const jde = jdUT + dT / 86400;
  const T = (jde - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * rad) + (0.019993 - 0.000101 * T) * Math.sin(2 * M * rad) + 0.000289 * Math.sin(3 * M * rad);
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const eps0 = 23 + 26 / 60 + 21.448 / 3600 - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
  const eps = eps0 + 0.00256 * Math.cos(omega * rad);
  const ra = Math.atan2(Math.cos(eps * rad) * Math.sin(lambda * rad), Math.cos(lambda * rad));
  const dec = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
  const Tu = (jdUT - 2451545.0) / 36525;
  let gmst = 280.46061837 + 360.98564736629 * (jdUT - 2451545.0) + 0.000387933 * Tu * Tu - (Tu * Tu * Tu) / 38710000;
  // nutation in longitude (approx) for apparent sidereal time
  const dpsi = -17.2 / 3600 * Math.sin(omega * rad);
  gmst += dpsi * Math.cos(eps * rad);
  const H = ((gmst + lonDeg) * rad) - ra;
  const lat = latDeg * rad;
  const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
  let az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)) / rad + 180;
  az = ((az % 360) + 360) % 360;
  // refraction (Bennett/Saemundsson), parallax 8.8" ignored in both? astronomy-engine includes topocentric parallax (~0.0024°) — negligible.
  let altDeg = alt / rad;
  if (altDeg > -1) altDeg += 1.02 / Math.tan((altDeg + 10.3 / (altDeg + 5.11)) * rad) / 60 * (1010 / 1010) * (283 / (273 + 10));
  return { az, alt: altDeg };
}

describe('calendar', () => {
  it('JDN round-trips and matches Parker & Dubberstein Nisannu 1, 467 BCE', () => {
    expect(julianToJDN(-466, 4, 17)).toBe(1550958);
    expect(jdnToJulian(1550958)).toEqual({ y: -466, m: 4, d: 17 });
    expect(babylonianDate(START_JDN)?.month.name).toBe('Nisanu');
    expect(babylonianDate(START_JDN)?.day).toBe(1);
    expect(YEAR_END_JDN - START_JDN + 1).toBeGreaterThan(353);
  });
});

describe('sun (§13.6)', () => {
  it('matches an independent Meeus implementation within 0.1° for 24 sampled times across the year', () => {
    let worst = 0;
    for (let k = 0; k < 24; k++) {
      const jdn = START_JDN + k * 15;
      const { y, m, d } = jdnToJulian(jdn);
      const hoursUT = 2 + (k * 5) % 12; // local ~05:30-17:30
      const jd = julianDateUT(y, m, d, hoursUT);
      const a = sunHorizon(jd);
      const b = meeusSun(jd, 29.9351174, 52.8894969);
      if (b.alt < 2) continue; // refraction models differ near the horizon
      const dAlt = Math.abs(a.altitude - b.alt);
      let dAz = Math.abs(a.azimuth - b.az); if (dAz > 180) dAz = 360 - dAz;
      const sep = Math.hypot(dAlt, dAz * Math.cos((a.altitude * Math.PI) / 180));
      worst = Math.max(worst, sep);
    }
    console.log('sun worst separation vs Meeus reference (deg):', worst.toFixed(4));
    expect(worst).toBeLessThan(0.1);
  });
  it('spring equinox of 467 BCE falls near 27–28 March (Julian)', () => {
    let best = 0, bestD = 1e9;
    for (let d = 15; d <= 31; d++) {
      const l = sunEclipticLongitude(julianDateUT(-466, 3, d, 12));
      const dd = Math.abs(((l + 180) % 360) - 180);
      if (dd < bestD) { bestD = dd; best = d; }
    }
    expect(best).toBeGreaterThanOrEqual(26);
    expect(best).toBeLessThanOrEqual(29);
  });
  it('moon near new at 1 Nisannu (month begins with first crescent)', () => {
    const p = moonPhase(julianDateUT(-466, 4, 17, 14)); // evening after sunset ~ 14:45 UT
    expect(p.fraction).toBeLessThan(0.1);
  });
});

describe('calendar coverage (re-review N-1)', () => {
  it('every day of regnal year 19 maps to a Babylonian date; year = 354 days, 12 months', () => {
    expect(YEAR_END_JDN - START_JDN + 1).toBe(354);
    const names = new Set<string>();
    for (let j = START_JDN; j <= YEAR_END_JDN; j++) { const b = babylonianDate(j); expect(b).not.toBeNull(); names.add(b!.month.name); }
    expect(names.size).toBe(12);
  });
});

import * as A from 'astronomy-engine';
import { starAzAlt, timeFromJD, observer } from '../src/sky/ephemeris';
describe('stars', () => {
  it('star transform (J2000 → precessed horizon) matches astronomy-engine DefineStar/Horizon within 0.05° (pm = 0)', () => {
    const jd = julianDateUT(-466, 4, 17, 18); // local ~21:30
    let worst = 0;
    for (const [ra, dec] of [[101.287, -16.716], [279.234, 38.784], [213.915, 19.182], [88.793, 7.407], [37.954, 89.264]]) {
      A.DefineStar(A.Body.Star1, ra / 15, dec, 1000);
      const t = timeFromJD(jd); const eq = A.Equator(A.Body.Star1, t, observer, true, false);
      const h = A.Horizon(t, observer, eq.ra, eq.dec, undefined);
      const m = starAzAlt(ra, dec, 0, 0, jd);
      let dAz = Math.abs(m.azimuth - h.azimuth); if (dAz > 180) dAz = 360 - dAz;
      worst = Math.max(worst, Math.hypot(m.altitude - h.altitude, dAz * Math.cos((h.altitude * Math.PI) / 180)));
    }
    expect(worst).toBeLessThan(0.05);
  });
  it('Polaris was NOT the pole star in 467 BCE (precession): altitude differs from latitude by > 10°', () => {
    const jd = julianDateUT(-466, 4, 17, 18);
    const p = starAzAlt(37.954, 89.264, 44.5, -11.9, jd);
    expect(Math.abs(p.altitude - 29.935)).toBeGreaterThan(10);
  });
});
