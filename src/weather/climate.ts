// Climate target for Persepolis (DECISIONS D-004): WMO 1991–2020 Shiraz normals (tier A) with elevation offsets (tier C).
import C from '../data/climate.json';

export interface MonthlyClimate { tmax: number; tmean: number; tmin: number; precipMm: number; precipDays: number; rh: number;
  windMs: number; windDirDeg: number; cloudOkta: number; thunderDays: number; dustDays: number; mistDays: number; snowfallDays: number }

export function monthly(m: number): MonthlyClimate {
  const a = C.adjust;
  return {
    tmax: C.tmax[m] + a.tmax, tmean: C.tmean[m] + a.tmean, tmin: C.tmin[m] + a.tmin,
    precipMm: C.precip_mm[m] * a.precip_mult, precipDays: C.precip_days_1mm[m], rh: C.rh[m], windMs: C.wind_ms[m],
    windDirDeg: C.wind_dir_deg[m], cloudOkta: C.cloud_okta[m], thunderDays: C.thunder_days[m],
    dustDays: C.dust_days[m] * a.dust_mult, mistDays: C.mist_days[m], snowfallDays: C.snowfall_days[m],
  };
}

/** Map the Sun's ecliptic longitude to a fractional modern-Gregorian month (0 = mid-January ... 11 = mid-December).
 *  Seasons follow the Sun, not the calendar: in 467 BCE the Julian calendar is ~7 days offset from today's seasons. */
export function climMonthFromSolarLongitude(lambdaDeg: number): number {
  // Modern: Jan 1 ≈ λ 280.2°; mean motion 0.9856°/day. Mid-month index m at day-of-year (m+0.5)*30.44.
  const doy = ((((lambdaDeg - 280.2) % 360) + 360) % 360) / 0.98565;
  return doy / 30.4375 - 0.5; // fractional month index, mid-month = integer
}

/** Smoothly interpolated climatology at a fractional month index (cyclic). */
export function interp(field: (m: number) => number, fm: number): number {
  const m0 = Math.floor(fm), t = fm - m0;
  const a = field(((m0 % 12) + 12) % 12), b = field((((m0 + 1) % 12) + 12) % 12);
  return a + (b - a) * t;
}
