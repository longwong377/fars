// dev (session 9, T-J5): the lunar eclipses of the simulated year (astronomy-engine, the proleptic Julian year of D-003) and
// whether the Moon is above Persepolis's horizon during each phase. Usage: npx tsx tools/dev/eclipses_467.ts
import * as A from 'astronomy-engine';
import { START_JDN, YEAR_END_JDN, LMT_OFFSET_H } from '../../src/core/calendar';
import { moonHorizon, timeFromJD } from '../../src/sky/ephemeris';
const J2000 = 2451545.0;
let t = timeFromJD(START_JDN - 0.5);
for (let k = 0; k < 4; k++) {
  const e = A.SearchLunarEclipse(t); const jd = e.peak.ut + J2000; if (jd > YEAR_END_JDN + 0.5) break;
  const alt = (dt: number) => moonHorizon(jd + dt / 1440).altitude.toFixed(1);
  const day = jd - (START_JDN - 0.5), lmt = ((jd + 0.5) % 1) * 24 + LMT_OFFSET_H;
  console.log(JSON.stringify({ kind: e.kind, peakJD: +jd.toFixed(4), simDay: Math.floor(day + LMT_OFFSET_H / 24), peakLMT: +(lmt % 24).toFixed(2), obscuration: +e.obscuration.toFixed(3),
    sdPenumMin: +e.sd_penum.toFixed(1), sdPartialMin: +e.sd_partial.toFixed(1), sdTotalMin: +e.sd_total.toFixed(1),
    moonAltAtPeak: alt(0), altPartialStart: alt(-e.sd_partial), altPartialEnd: alt(e.sd_partial) }));
  t = e.peak.AddDays(10);
}
// the disc's brightness through the partial eclipse (earthShadow), every 15 minutes around the first eclipse's peak
import { earthShadow } from '../../src/sky/ephemeris';
{ const e = A.SearchLunarEclipse(timeFromJD(START_JDN - 0.5)), jd = e.peak.ut + J2000;
  for (let m = -150; m <= 150; m += 15) { const s = earthShadow(jd + m / 1440); console.log(`${m >= 0 ? '+' : ''}${m} min: sep ${(s.sep * 180 / Math.PI).toFixed(3)}° umbra ${(s.umbra * 180 / Math.PI).toFixed(3)}° penumbra ${(s.penumbra * 180 / Math.PI).toFixed(3)}° moon r ${(s.moonR * 180 / Math.PI).toFixed(3)}° light ${s.light.toFixed(3)}`); } }
