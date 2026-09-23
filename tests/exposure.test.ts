import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { logTviCones, logTviRods, keyValue, adaptationBrightness, adaptingLuminance, skyGain, exposureTarget, KEY, X_MAX, LA_ABSOLUTE, FIRE_GAIN, displayedGrey } from '../src/sky/exposure';
import { skyLux, sunHorizontalLux, NIGHT_LUX } from '../src/sky/illuminance';
import { SkySystem } from '../src/sky/skySystem';
import { WorldClock } from '../src/core/clock';

// D-117: the eye/camera model. Brightness of the adapted scene from the Krawczyk et al. (2005) key, the limit of
// adaptation from Ferwerda et al.'s (1996) rod threshold plateau; the camera keeps the session-3 law within its range.
describe('visual adaptation functions', () => {
  it('Ferwerda 1996 TVI pieces are continuous (as published)', () => {
    for (const [a, f] of [[-2.6, logTviCones], [1.9, logTviCones], [-3.94, logTviRods], [-1.44, logTviRods]] as const) {
      const L = Math.pow(10, a); expect(Math.abs(f(L * 0.999) - f(L * 1.001))).toBeLessThan(0.02);
    }
    expect(logTviRods(1e-6)).toBe(-2.86); // the absolute threshold plateau
  });
  it('the Krawczyk key: 0.69 in daylight, ~0.03 at night', () => {
    expect(keyValue(7000)).toBeCloseTo(0.688, 2);
    expect(keyValue(1e-4)).toBeCloseTo(0.03, 2);
  });
  it('displayed brightness falls monotonically from daylight to a moonless night', () => {
    let prev = 2; for (let l = 5; l >= -5; l -= 0.25) { const d = adaptationBrightness(Math.pow(10, l)); expect(d).toBeLessThanOrEqual(prev + 1e-12); prev = d; }
    const D = (lux: number) => adaptationBrightness(adaptingLuminance(lux));
    expect(D(123800)).toBeCloseTo(1, 6);           // the zenith sun
    expect(D(757)).toBeGreaterThan(0.6);           // sunrise: still photopic
    expect(D(757)).toBeLessThan(0.8);
    expect(D(3.0)).toBeLessThan(0.15);             // end of civil twilight
    expect(D(0.25)).toBeGreaterThan(D(0.0005) * 3); // moonlight is readable against a moonless night
    expect(D(0.0005)).toBeLessThan(0.02);
    expect(adaptingLuminance(0.002)).toBeGreaterThan(LA_ABSOLUTE * 0.9); // the plateau sits at ~0.002 lx (airglow night)
  });
  it('with the centre-weighted meter, the displayed grey falls monotonically as the sun sets, and twilight stays above moonlight', () => {
    let prev = 2;
    for (let h = 30; h >= -12; h -= 0.5) { const sk = skyLux(h) + NIGHT_LUX, d = displayedGrey(sunHorizontalLux(h) + sk, sk); expect(d, `sun ${h}°`).toBeLessThanOrEqual(prev + 1e-9); prev = d; }
    const civilEnd = displayedGrey(skyLux(-6) + NIGHT_LUX, skyLux(-6) + NIGHT_LUX), halfMoon = displayedGrey(0.0086, 0.0017);
    expect(civilEnd).toBeGreaterThanOrEqual(halfMoon * 0.95);
    expect(displayedGrey(123800, 15354)).toBeCloseTo(1, 6);
  });
  it('the camera law is the session-3 one inside its range, and the sky gain is 1 by day', () => {
    expect(exposureTarget(2.5, 0.78, 1, 0, 0)).toBeCloseTo(2.3 / (3.28 + 0.004), 3);
    expect(exposureTarget(0, 0.001, 1, 0, 0)).toBe(X_MAX);
    expect(exposureTarget(100, 0, 1, 0, 0)).toBe(0.35);
    expect(skyGain(3.3, 123800)).toBe(1);
    expect(skyGain(0.02, 757)).toBeGreaterThan(1);
  });
});

describe('dawn, dusk and night do not look like noon (exposure on the SkySystem lights)', () => {
  const sky = new SkySystem(new THREE.Scene(), 256, 'test');
  /** displayed brightness of an 18 % grey outdoors (skyVis 1, no fire): exposure × illuminance at the eye, relative to
   *  the session-3 normalisation KEY (every scene displayed alike) */
  const shown = (day: number, hour: number) => {
    sky.update(new WorldClock(day, hour).jdUT, new THREE.Vector3(), 0.05, 0.25, { ms: 2, fromDeg: 270, tSeconds: 0 }, new THREE.Vector3(1, 0, 0));
    const sinA = Math.max(0, Math.sin((sky.state.sunAlt * Math.PI) / 180));
    const sunE = sky.sun.visible ? sky.sun.intensity * sinA : 0, skyE = sky.hemi.intensity * 0.8, moonE = sky.moonLight.intensity * 0.3;
    const X = exposureTarget(sunE, skyE, 1, moonE, 0);
    return { alt: sky.state.sunAlt, b: (X * (sunE + skyE + moonE)) / KEY };
  };
  it('noon is displayed as in session 3; dawn is dimmer; the end of civil twilight is dim; night is dark', () => {
    const noon = shown(0, 12.5), rise = shown(0, 5.62), dawn = shown(0, 5.4), civil = shown(0, 18.87), night = shown(1, 3.5);
    expect(noon.b).toBeCloseTo(1, 2);
    expect(rise.b, `sunrise (${rise.alt.toFixed(1)}°)`).toBeLessThan(0.85);
    expect(dawn.b, `dawn (${dawn.alt.toFixed(1)}°)`).toBeLessThan(0.55);
    expect(civil.b, `civil twilight (${civil.alt.toFixed(1)}°)`).toBeLessThan(0.15);
    expect(night.b, 'a moonless night (day 1, 03:30)').toBeLessThan(0.03);
    expect(dawn.b).toBeGreaterThan(civil.b); expect(civil.b).toBeGreaterThan(night.b);
  });
  it('fire light is pre-exposed for night: unchanged at night, a small addition at dawn, nothing by day', () => {
    shown(5, 22.5); expect(sky.fireScale).toBe(1);             // moonlit night: as tuned in session 3
    shown(1, 3.5); expect(sky.fireScale).toBe(1);              // moonless
    shown(0, 5.4); expect(sky.fireScale).toBeLessThan(0.01);   // dawn, sun −2.9°: ~50 lx of skylight
    shown(0, 12.5); expect(sky.fireScale).toBeLessThan(1e-4);  // noon: no pools of firelight in the sun
    expect(FIRE_GAIN).toBeGreaterThan(3e4); expect(FIRE_GAIN).toBeLessThan(1.2e5);
  });
  it('a moonlit night stays readable and brighter than a moonless one', () => {
    const moonless = shown(1, 3.5), moonlit = shown(5, 22.5); // day 5 22:30: a 46 % moon 27° up
    expect(moonlit.b).toBeGreaterThan(2 * moonless.b);
    expect(moonlit.b).toBeGreaterThan(0.02);
  });
});
