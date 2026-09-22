// Independent §13.6 check against JPL Horizons, active once data/horizons/sun.csv exists (NEEDS_FROM_ME #5,
// request spec in tests/sky/horizons_request.txt). Skipped (and reported as skipped) until then — BLOCKERS B2.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { sunHorizon } from '../src/sky/ephemeris';
const FILE = 'data/horizons/sun.csv';
describe.skipIf(!existsSync(FILE))('sun vs JPL Horizons (§13.6)', () => {
  it('within 0.1° for every row', () => {
    // expects Horizons CSV rows between $$SOE and $$EOE: date, JDUT (enable "Julian Day" in output), ..., Azi, Elev
    const txt = readFileSync(FILE, 'utf8'); const body = txt.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n');
    let worst = 0;
    for (const line of body) {
      const f = line.split(',').map(s => s.trim()); const jd = parseFloat(f[1]); const az = parseFloat(f[f.length - 3]); const el = parseFloat(f[f.length - 2]);
      if (!(el > 2)) continue;
      const p = sunHorizon(jd); let dAz = Math.abs(p.azimuth - az); if (dAz > 180) dAz = 360 - dAz;
      worst = Math.max(worst, Math.hypot(p.altitude - el, dAz * Math.cos((el * Math.PI) / 180)));
    }
    expect(worst).toBeLessThan(0.1);
  });
});
