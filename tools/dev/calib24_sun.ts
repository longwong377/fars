// §8.1 calibration scene (D-230): the sun for photo #24 (references/INDEX.md §6; EXIF DateTimeOriginal 2019-02-08 15:59:34,
// camera time taken as Iran standard time UT+3:30, no DST in February) at Persepolis, and the day and hour of the simulated
// year (467/466 BCE, the world clock on local mean time) whose sun stands at the same azimuth and altitude.
// Run: npx tsx tools/dev/calib24_sun.ts
import * as A from 'astronomy-engine';
import { sunHorizon } from '../../src/sky/ephemeris';
import { START_JDN, LMT_OFFSET_H } from '../../src/core/calendar';

const t = A.MakeTime(new Date(Date.UTC(2019, 1, 8, 12, 29, 34))); // 15:59:34 IRST
const jd = t.ut + 2451545.0;
const s = sunHorizon(jd);
console.log(`photo #24 sun: azimuth ${s.azimuth.toFixed(2)}° true, altitude ${s.altitude.toFixed(2)}° (JD ${jd.toFixed(5)})`);
for (const dt of [-30, 30]) { const q = sunHorizon(jd + dt / 1440); console.log(`  camera clock ${dt > 0 ? '+' : ''}${dt} min: az ${q.azimuth.toFixed(2)}, alt ${q.altitude.toFixed(2)}`); }
for (const [d0, d1, tag] of [[0, 355, 'any day'], [270, 330, 'the late-winter match (the photo\'s season)']] as const) {
let best: { d: number; day: number; h: number; az: number; alt: number } | null = null;
for (let day = d0; day < d1; day++) for (let h = 13; h < 18; h += 1 / 240) {
  const q = sunHorizon(START_JDN + day + h / 24 - 0.5 - LMT_OFFSET_H / 24);
  const d = Math.hypot((q.azimuth - s.azimuth) * Math.cos((s.altitude * Math.PI) / 180), q.altitude - s.altitude);
  if (!best || d < best.d) best = { d, day, h, az: q.azimuth, alt: q.altitude };
}
console.log(`game time with the same sun (${tag}): day ${best!.day} hour ${best!.h.toFixed(3)} (az ${best!.az.toFixed(2)}, alt ${best!.alt.toFixed(2)}, off by ${best!.d.toFixed(3)}°)`);
}
