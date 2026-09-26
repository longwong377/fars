// dev (session 9): moments when a rain cell stands opposite a low sun (a rainbow on its curtain: rainShafts.ts BOW), the sky
// over the observer open enough for the sun to reach the rain. Usage: npx tsx tools/dev/rainbow_find.ts [seed=1]
import { WeatherSystem } from '../../src/weather/weatherState';
import { sunHorizon } from '../../src/sky/ephemeris';
import { START_JDN, LMT_OFFSET_H } from '../../src/core/calendar';
const seed = +(process.argv[2] ?? 1), W = new WeatherSystem(seed); let n = 0;
for (let day = 0; day < 354 && n < 12; day++) for (let h = 5; h < 19.5 && n < 12; h += 0.25) {
  const jd = START_JDN + day + h / 24 - 0.5 - LMT_OFFSET_H / 24, s = sunHorizon(jd); if (s.altitude < 4 || s.altitude > 35) continue;
  const c = W.rainCell(day, h); if (!c || c.snow || c.distanceM < c.radiusM * 1.2 || c.distanceM > 30000) continue;
  const anti = (s.azimuth + 180) % 360, d = Math.abs(((c.bearingTrueDeg - anti + 540) % 360) - 180); if (d > 42) continue;
  const cond = W.conditions(day, h);
  console.log(JSON.stringify({ day, hour: h, sunAlt: +s.altitude.toFixed(1), sunAz: +s.azimuth.toFixed(1), cellBearing: +c.bearingTrueDeg.toFixed(1), offAnti: +d.toFixed(1), cellKm: +(c.distanceM / 1000).toFixed(1), cellR: Math.round(c.radiusM), intensity: +c.intensity.toFixed(2), cloud: +cond.cloud.toFixed(2) })); n++; h += 2;
}
