// Seeded, climate-driven daily weather generator (brief §5.3) — a Richardson-type WGEN:
//  * wet/dry occurrence: first-order Markov chain per month, parameters from monthly wet-day frequency (≥1 mm) with
//    persistence p11 - p01 = 0.35 (typical semi-arid winter value; tier C);
//  * amounts: exponential with the monthly mean intensity (precip / wet days);
//  * temperature: monthly normals + AR(1) anomaly (φ=0.65, σ=2.3 °C; C). Wet days run 1.5 °C cooler in Tmax (C).
//    Monthly means are re-centred toward the normal, keeping 35% of the sampled monthly anomaly (C): interannual variability
//    in Fars ~1 °C; the brief's §13.6 gate (±1 °C for a simulated year) is thereby satisfiable while day-to-day
//    variability is kept. This is logged in DECISIONS D-005.
//  * wet-day counts are re-centred the same way (35% of the monthly sampled anomaly kept; C).
//  * cloud, wind, humidity, dust, mist, thunder from monthly statistics conditioned on wet/dry.
// Everything is deterministic in (seed, day index).
import { Rng } from '../core/rng';
import { monthly, climMonthFromSolarLongitude } from './climate';
import { sunEclipticLongitude } from '../sky/ephemeris';

export interface DayWeather {
  jdn: number; climMonth: number;
  tmin: number; tmax: number; precipMm: number; wet: boolean; snow: boolean; thunder: boolean;
  cloud: number; // 0..1 cover
  windMs: number; windDirDeg: number; rh: number; dust: boolean; mist: boolean;
}

const MONTH_DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function generateYear(seed: number, startJdn: number, days: number): DayWeather[] {
  const rng = new Rng(seed, 'weather');
  const out: DayWeather[] = [];
  let wetPrev = false, anom = 0;
  for (let i = 0; i < days; i++) {
    const jdn = startJdn + i;
    const fm = climMonthFromSolarLongitude(sunEclipticLongitude(jdn));
    const m = ((Math.round(fm) % 12) + 12) % 12;
    const c = monthly(m);
    const pw = Math.min(0.95, c.precipDays / MONTH_DAYS[m]);
    const d = 0.35 * (pw > 0.02 ? 1 : 0);
    // p01 = pw(1-d), p11 = p01 + d  (stationary wet fraction = pw)
    const p01 = pw * (1 - d), p11 = p01 + d;
    const wet = rng.next() < (wetPrev ? p11 : p01);
    const intensity = c.precipDays > 0 ? c.precipMm / c.precipDays : 0;
    const precipMm = wet ? 1 + Math.max(0, intensity - 1) * -Math.log(1 - rng.next() * 0.999) : 0; // ≥1 mm by definition
    anom = 0.65 * anom + 2.3 * Math.sqrt(1 - 0.65 * 0.65) * rng.normal();
    const tmax = c.tmax + anom - (wet ? 1.5 : 0);
    const tmin = c.tmin + anom * 0.8 + (wet ? 1.0 : 0);
    const cloudMean = c.cloudOkta / 8;
    const cloud = wet ? Math.min(1, 0.7 + 0.3 * rng.next()) : Math.max(0, Math.min(1, cloudMean * 0.7 + (rng.next() - 0.5) * 0.4));
    const windMs = Math.max(0.2, c.windMs * Math.exp(0.5 * rng.normal()) * (wet ? 1.3 : 1));
    const windDirDeg = (c.windDirDeg + 40 * rng.normal() + 360) % 360;
    const rh = Math.max(8, Math.min(100, c.rh + (wet ? 25 : -3) + 6 * rng.normal()));
    const dust = !wet && rng.next() < c.dustDays / MONTH_DAYS[m];
    const mist = rng.next() < c.mistDays / MONTH_DAYS[m] * (wet ? 1.5 : 0.8);
    const thunder = wet && rng.next() < Math.min(1, c.thunderDays / Math.max(0.5, c.precipDays));
    const snow = wet && (tmax + tmin) / 2 < 2.0;
    out.push({ jdn, climMonth: m, tmin, tmax, precipMm, wet, snow, thunder, cloud, windMs, windDirDeg, rh, dust, mist });
    wetPrev = wet;
  }
  // monthly re-centring (see header)
  const byMonth = new Map<number, DayWeather[]>();
  for (const w of out) { const k = w.climMonth; if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k)!.push(w); }
  for (const [m, arr] of byMonth) {
    const c = monthly(m);
    const meanT = arr.reduce((s, w) => s + (w.tmax + w.tmin) / 2, 0) / arr.length;
    const target = c.tmean; // WMO tmean is the daily-mean normal
    const correction = -(meanT - target) * 0.65;
    for (const w of arr) { w.tmax += correction; w.tmin += correction; }
  }
  // wet-day re-centring per month (same principle as temperature): keep 35% of the sampled anomaly in wet-day counts.
  const rng2 = new Rng(seed, 'weather-wetfix');
  for (const [m, arr] of byMonth) {
    const c = monthly(m);
    const expected = c.precipDays / MONTH_DAYS[m] * arr.length;
    if (expected < 1) continue;
    const actual = arr.filter(w => w.wet).length;
    const desired = Math.round(expected + 0.35 * (actual - expected));
    let diff = desired - actual;
    const intensity = c.precipMm / c.precipDays;
    let guard = 0;
    while (diff !== 0 && guard++ < 1000) {
      const w = arr[Math.floor(rng2.next() * arr.length)];
      if (diff > 0 && !w.wet) {
        w.wet = true; w.precipMm = 1 + Math.max(0, intensity - 1) * -Math.log(1 - rng2.next() * 0.999);
        w.cloud = Math.max(w.cloud, 0.7 + 0.3 * rng2.next()); w.dust = false; w.rh = Math.min(100, w.rh + 25);
        w.snow = (w.tmax + w.tmin) / 2 < 2.0; diff--;
      } else if (diff < 0 && w.wet) {
        w.wet = false; w.precipMm = 0; w.snow = false; w.thunder = false; w.cloud = Math.min(w.cloud, 0.5); diff++;
      }
    }
  }
  return out;
}

/** Hourly interpolation (diurnal cycle): min at sunrise, max ~14:30 local, sinusoid + exponential night decay. */
export function hourlyTemp(w: DayWeather, next: DayWeather | undefined, localHour: number): number {
  const tminNext = next ? next.tmin : w.tmin;
  if (localHour < 6) return w.tmin + (0.0);
  if (localHour <= 14.5) return w.tmin + (w.tmax - w.tmin) * 0.5 * (1 - Math.cos(Math.PI * (localHour - 6) / 8.5));
  const tSet = w.tmax - (w.tmax - tminNext) * 0.35 * (localHour - 14.5) / 4.5;
  if (localHour <= 19) return tSet;
  const t19 = w.tmax - (w.tmax - tminNext) * 0.35;
  return tminNext + (t19 - tminNext) * Math.exp(-(localHour - 19) / 4);
}
