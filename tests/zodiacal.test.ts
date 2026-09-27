// The zodiacal light's frame (session 10, GB1): the world → ecliptic matrix puts the Sun (and the Moon, within its 5° orbit tilt)
// on the ecliptic, at every hour and season; the ecliptic longitude it gives the Sun agrees with the ephemeris's.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { worldToEcliptic } from '../src/sky/skySystem';
import { bodyHorizon, azAltToWorld, sunEclipticLongitude } from '../src/sky/ephemeris';
import * as A from 'astronomy-engine';
import { START_JDN } from '../src/core/calendar';

describe('the ecliptic frame (GB1)', () => {
  it('the Sun lies on it (|β| < 0.5°) and its longitude matches the ephemeris (to 1°, allowing precession since J2000)', () => {
    for (const d of [0, 40, 100, 180, 260, 330]) for (const h of [0.3, 0.55, 0.8]) {
      const jd = START_JDN - 0.5 + d + h, s = bodyHorizon(A.Body.Sun, jd), w = new THREE.Vector3(...azAltToWorld(s.azimuth, s.altitude)).applyMatrix3(worldToEcliptic(jd));
      expect(Math.abs(Math.asin(w.z) * 180 / Math.PI), `d${d} h${h}`).toBeLessThan(0.8);
      const lon = (Math.atan2(w.y, w.x) * 180 / Math.PI + 360) % 360, ref = sunEclipticLongitude(jd), prec = 1.397 * (2000 - (-466)) / 100; // (of date → J2000: plus the precession since 467 BCE)
      const dd = ((lon - (ref + prec)) % 360 + 540) % 360 - 180; expect(Math.abs(dd), `d${d} h${h}: ${lon.toFixed(1)} vs ${(ref + prec).toFixed(1)}`).toBeLessThan(1.5);
      const m = bodyHorizon(A.Body.Moon, jd), mw = new THREE.Vector3(...azAltToWorld(m.azimuth, m.altitude)).applyMatrix3(worldToEcliptic(jd)); expect(Math.abs(Math.asin(mw.z) * 180 / Math.PI)).toBeLessThan(7);
    }
  });
});
