// dev (session 9): find moments with a bright meteor (m ≤ MAG) mid-flight in a sky region, on a dark night (sun < −18°, the
// moon down), for the camera rig. Usage: npx tsx tools/dev/meteor_find.ts [seed=1] [azMin=150] [azMax=280] [altMin=18] [altMax=50] [mag=0.5]
import { meteorsAt, meteorDir } from '../../src/sky/meteors';
import { sunHorizon, moonHorizon } from '../../src/sky/ephemeris';
import { START_JDN, LONGITUDE_E } from '../../src/core/calendar';
const [seed = 1, azMin = 150, azMax = 280, altMin = 18, altMax = 50, MAG = 0.5] = process.argv.slice(2).map(Number);
const toAzAlt = (d: number[]) => { const alt = (Math.asin(d[1]) * 180) / Math.PI; const azGrid = (Math.atan2(d[0], -d[2]) * 180) / Math.PI; return { az: (azGrid + 341 + 720) % 360, alt }; };
let found = 0;
for (let day = 0; day < 354 && found < 8; day++) for (let t = 20 * 3600; t < 29 * 3600 && found < 8; t += 0.5) {
  const dd = day + Math.floor(t / 86400), tt = t % 86400, jd = START_JDN - 0.5 + dd + tt / 86400 - LONGITUDE_E / 360;
  const ms = meteorsAt(seed, dd, tt).filter(m => m.mag <= MAG && Math.abs((tt - m.start) / m.dur - 0.5) < 0.1); if (!ms.length) continue;
  if (sunHorizon(jd).altitude > -18 || moonHorizon(jd).altitude > -2) continue;
  for (const m of ms) { const p = toAzAlt(meteorDir(m, tt - m.start)); if (p.az < azMin || p.az > azMax || p.alt < altMin || p.alt > altMax) continue;
    console.log(JSON.stringify({ day: dd, hour: +(tt / 3600).toFixed(6), mag: +m.mag.toFixed(2), az: +p.az.toFixed(1), alt: +p.alt.toFixed(1), durS: +m.dur.toFixed(2) })); found++; t += 600; }
}
