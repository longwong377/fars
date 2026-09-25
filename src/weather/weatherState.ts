// Runtime weather: turns the daily generator output into continuous hourly conditions and surface state
// (wetness, puddles, snow cover). Everything derives from (seed, clock) so saves and tests are reproducible.
import { Rng } from '../core/rng';
import { DayWeather, generateYear, hourlyTemp } from './generator';
import { START_JDN } from '../core/calendar';
import { YEAR_DAYS } from '../core/clock';

export type WeatherOverride = 'auto' | 'clear' | 'overcast' | 'rain' | 'storm' | 'snow' | 'dust' | 'mist';
export interface Conditions {
  tempC: number; cloud: number; rain: number /*0..1 intensity*/; snowFall: number; windMs: number; windDirDeg: number; rh: number;
  haze: number; dust: number; mist: number; lightning: boolean; wetness: number; snowCover: number; day: DayWeather;
}

export class WeatherSystem {
  readonly days: DayWeather[];
  private rainWindows: [number, number][] = [];
  private surface: { wet: number; snow: number }[] = [];
  override: WeatherOverride = 'auto';
  constructor(readonly seed: number) {
    this.days = generateYear(seed, START_JDN, YEAR_DAYS);
    const r = new Rng(seed, 'weather-hours');
    for (const d of this.days) {
      // rain falls in one episode per wet day: start hour and duration scaled with amount (C)
      const dur = d.wet ? Math.min(20, 2 + d.precipMm / 2.5 + r.range(0, 4)) : 0;
      const start = r.range(0, 24 - Math.min(23, dur));
      this.rainWindows.push([start, start + dur]);
    }
    // surface state per day end: wetness decays with evaporation; snow accumulates below 0 °C, melts with degree-days
    let wet = 0, snow = 0;
    for (const d of this.days) {
      const mean = (d.tmax + d.tmin) / 2;
      wet = Math.max(0, Math.min(1, wet * (d.tmax > 25 ? 0.2 : 0.5) + (d.wet && !d.snow ? Math.min(1, d.precipMm / 5) : 0)));
      if (d.snow) snow += d.precipMm * 0.9; // mm SWE ≈ cm of fresh snow ×0.9 (C)
      snow = Math.max(0, snow - Math.max(0, mean) * 3.5); // degree-day melt 3.5 mm/°C/day (C)
      this.surface.push({ wet, snow });
    }
  }
  conditions(dayIndex: number, hour: number): Conditions {
    const i = Math.max(0, Math.min(this.days.length - 1, dayIndex));
    const d = this.days[i], next = this.days[i + 1];
    const [rs, re] = this.rainWindows[i];
    const raining = d.wet && hour >= rs && hour <= re;
    const edge = raining ? Math.min(1, Math.min(hour - rs, re - hour) / 0.75) : 0;
    let rain = raining && !d.snow ? Math.min(1, 0.25 + d.precipMm / 20) * edge : 0;
    let snowFall = raining && d.snow ? Math.min(1, 0.3 + d.precipMm / 15) * edge : 0;
    const prev = this.surface[i - 1] ?? { wet: 0, snow: 0 }, cur = this.surface[i];
    const f = hour / 24;
    // (before the day's rain begins the ground holds only yesterday's water, drying: the day-end state includes today's rain,
    // and interpolating toward it wetted the ground ahead of the rain — 0.48 at 11:27 on day 299, the rain-approach moment,
    // with the rain 30 min off and yesterday dry. D-219; the day-end surface states are unchanged)
    const dryEnd = prev.wet * (d.tmax > 25 ? 0.2 : 0.5);
    let wetness = Math.max(raining ? Math.min(1, prev.wet + edge) : 0, d.wet && hour < rs ? prev.wet * (1 - f) + dryEnd * f : prev.wet * (1 - f) + cur.wet * f);
    let snowCover = Math.min(1, (prev.snow * (1 - f) + cur.snow * f) / 40);
    let cloud = raining ? Math.max(d.cloud, 0.85) : d.cloud;
    let dust = d.dust ? Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (hour - 10) / 8)))) : 0;
    let mist = d.mist ? Math.max(0, 1 - Math.abs(hour - 6.5) / 3) : 0;
    let lightning = d.thunder && raining;
    let windMs = d.windMs * (0.6 + 0.6 * Math.sin(Math.PI * Math.min(1, Math.max(0, (hour - 8) / 12)))); // afternoon maximum (C)
    let tempC = hourlyTemp(d, next, hour);
    switch (this.override) {
      case 'clear': cloud = 0.05; rain = 0; snowFall = 0; dust = 0; mist = 0; lightning = false; break;
      case 'overcast': cloud = 0.95; rain = 0; snowFall = 0; break;
      case 'rain': cloud = 1; rain = 0.6; snowFall = 0; wetness = 1; tempC = Math.max(tempC, 3); break;
      case 'storm': cloud = 1; rain = 1; wetness = 1; lightning = true; windMs = Math.max(windMs, 9); break;
      case 'snow': cloud = 1; rain = 0; snowFall = 0.7; snowCover = Math.max(snowCover, 0.6); tempC = Math.min(tempC, -1); break;
      case 'dust': dust = 1; cloud = 0.3; rain = 0; windMs = Math.max(windMs, 10); break;
      case 'mist': mist = 1; rain = 0; break;
    }
    const haze = Math.min(1, 0.15 + 0.5 * dust + 0.6 * mist + 0.25 * rain + d.rh / 400);
    return { tempC, cloud, rain, snowFall, windMs, windDirDeg: d.windDirDeg, rh: d.rh, haze, dust, mist, lightning, wetness, snowCover, day: d };
  }
  /** the rain cell that brings (or brought) today's rain episode to the Terrace, as a moving object: before the episode it
   *  stands upwind at (steering wind × time to onset), after it recedes downwind; the episode's own timing (above) is
   *  the anchor. Steering wind = surface wind × 2.5, at least 5 m/s (C, as the cloud drift). Episodes up to 3 h away are
   *  reported (a cell 3 h out at 5–15 m/s is 50–160 km off, beyond the far terrain). Null with a weather override
   *  (no timeline) or on dry days. */
  rainCell(dayIndex: number, hour: number): { distanceM: number; bearingTrueDeg: number; intensity: number; snow: boolean; radiusM: number } | null {
    if (this.override !== 'auto') return null;
    let best: { dh: number; i: number; before: boolean } | null = null;
    for (const di of [-1, 0, 1]) {
      const i = dayIndex + di, d = this.days[i]; if (!d || !d.wet) continue;
      const [rs, re] = this.rainWindows[i], s = rs + di * 24, e = re + di * 24;
      const dh = hour < s ? s - hour : hour > e ? hour - e : 0;
      if (dh <= 3 && (!best || dh < best.dh)) best = { dh, i, before: hour < s };
    }
    if (!best) return null;
    const d = this.days[best.i], c = this.conditions(best.i, 12);
    const steer = Math.max(5, c.windMs * 2.5);
    const intensity = Math.min(1, 0.25 + d.precipMm / 20);
    return { distanceM: steer * best.dh * 3600, bearingTrueDeg: best.before ? d.windDirDeg : (d.windDirDeg + 180) % 360, intensity, snow: d.snow, radiusM: 2500 + Math.min(4000, d.precipMm * 250) };
  }
}
