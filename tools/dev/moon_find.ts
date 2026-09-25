// dev: nights when the moon stands low over a given sky sector with the sun well down (for camera-rig moments)
// Usage: npx tsx tools/dev/moon_find.ts [minFrac=0.8] [azMin=230] [azMax=300] [altMin=8] [altMax=20]
import { START_JDN, LMT_OFFSET_H } from '../../src/core/calendar';
import { moonHorizon, sunHorizon, moonPhase } from '../../src/sky/ephemeris';
import { YEAR_DAYS } from '../../src/core/clock';
const [minF, azMin, azMax, altMin, altMax] = process.argv.slice(2).map(Number);
const F = minF || 0.8, A0 = azMin || 230, A1 = azMax || 300, H0 = altMin || 8, H1 = altMax || 20;
for (let d = 0; d < YEAR_DAYS; d++) for (let h = 0; h < 24; h += 0.25) {
  const jd = START_JDN + d + h / 24 - 0.5 - LMT_OFFSET_H / 24, m = moonHorizon(jd), s = sunHorizon(jd);
  if (s.altitude > -18 || m.altitude < H0 || m.altitude > H1 || m.azimuth < A0 || m.azimuth > A1) continue;
  const f = moonPhase(jd).fraction; if (f < F) continue;
  console.log(`day ${d} ${h.toFixed(2)} h: moon alt ${m.altitude.toFixed(1)} az ${m.azimuth.toFixed(1)} true (grid ${((m.azimuth + 19 + 360) % 360).toFixed(1)}), fraction ${f.toFixed(2)}, sun ${s.altitude.toFixed(1)}`);
}
