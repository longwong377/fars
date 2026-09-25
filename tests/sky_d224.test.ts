import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { Atmosphere, aerosolTauFor, sampleSkyView, xyToRenderer, daylightXY, miePhase, MIE_BACKSCATTER, ATMOSPHERE_D116, MS_CONVERGED, type SkyView } from '../src/sky/atmosphere';
import { skyCalibration, domeRadiance, overcastChroma, OVERCAST_CCT, OVERCAST_E_PER_LZ, type SkyParams } from '../src/sky/horizon';
import { extinctionK } from '../src/sky/illuminance';
import { SkySystem } from '../src/sky/skySystem';
import { WorldClock } from '../src/core/clock';
import { meterEVFrame, meterEV, meterLogMean, METER_W, METER_H, METER_MIN_EV, BRIGHT_F0 } from '../src/render/meter';
import { KEY } from '../src/sky/exposure';

type V3 = [number, number, number];
const Y = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const deg = Math.PI / 180;
const sunAt = (alt: number, az = 90): V3 => [Math.cos(alt * deg) * Math.cos(az * deg), Math.sin(alt * deg), Math.cos(alt * deg) * Math.sin(az * deg)];
const P: SkyParams = { turbidity: 3.7, rayleigh: 1.2, mieCoefficient: 0.008, mieDirectionalG: 0.8 };
/** renderer colour → CIE xy: undo the white balance to the extraterrestrial sun (xyToRenderer is linear per channel, so
 *  it can be inverted from three basis chromaticities), then linear sRGB → XYZ */
const toXY = (c: number[]) => {
  // the balance: renderer = sRGB / SUN; read SUN off a known chromaticity (D65 is (1, 1, 1) in linear sRGB)
  const d65 = xyToRenderer(0.3127, 0.329), s = c.map((v, i) => v / d65[i]);
  const X = 0.4124 * s[0] + 0.3576 * s[1] + 0.1805 * s[2], Yv = 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2], Z = 0.0193 * s[0] + 0.1192 * s[1] + 0.9505 * s[2];
  return [X / (X + Yv + Z), Yv / (X + Yv + Z)];
};
/** McCamy (1992) CCT from CIE xy */
const cct = (xy: number[]) => { const n = (xy[0] - 0.332) / (0.1858 - xy[1]); return 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33; };

// ---- 1. the overcast sky (D-224) ---------------------------------------------------------------------------------------
describe('overcast sky (D-224)', () => {
  const A = new Atmosphere(aerosolTauFor(extinctionK(0.4)));
  const views = new Map<number, SkyView>(); const V = (h: number) => { let v = views.get(h); if (!v) { v = A.skyView(h); views.set(h, v); } return v; };
  const OVC = xyToRenderer(...daylightXY(OVERCAST_CCT));
  const irr = (s: V3, c: ReturnType<typeof skyCalibration>, view: SkyView) => {
    let E = 0; const NE = 16, NA = 32;
    for (let i = 0; i < NE; i++) for (let j = 0; j < NA; j++) {
      const th0 = (i / NE) * (Math.PI / 2), th1 = ((i + 1) / NE) * (Math.PI / 2), th = (th0 + th1) / 2, a = ((j + 0.5) / NA) * 2 * Math.PI;
      E += Y(domeRadiance([Math.cos(a) * Math.sin(th), Math.cos(th), Math.sin(a) * Math.sin(th)], s, P, c.kP, c.kT, view, c.ovL)) * (Math.PI * (Math.cos(th0) ** 2 - Math.cos(th1) ** 2)) / NA;
    }
    return E;
  };
  it('the CIE overcast gradation: zenith three times the horizon, the same in every azimuth', () => {
    const s = sunAt(30), view = V(30), c = skyCalibration(s, P, 0.4, 0, 1, 0, { view, w: 1 }, { w: 1, chroma: OVC });
    const z = Y(domeRadiance([0, 1, 0], s, P, c.kP, c.kT, view, c.ovL)), h0 = Y(domeRadiance([1, 0, 0], s, P, c.kP, c.kT, view, c.ovL)), h1 = Y(domeRadiance([-1, 0, 0], s, P, c.kP, c.kT, view, c.ovL));
    expect(z / h0).toBeCloseTo(3, 3); expect(h1 / h0).toBeCloseTo(1, 6);
    expect(c.kT).toBe(0); expect(OVERCAST_E_PER_LZ).toBeCloseTo((7 * Math.PI) / 9, 9);
  });
  it('the blend carries the skylight irradiance at every cover (the D-060 rule)', () => {
    for (const w of [0, 0.3, 0.76, 1]) for (const h of [40, 8, -3]) {
      const s = sunAt(h), view = V(h), c = skyCalibration(s, P, 0.2, 0, 1, 0, { view, w: 1 }, { w, chroma: OVC });
      expect(irr(s, c, view) / 0.2, `cover ${w}, sun ${h}°`).toBeCloseTo(1, 2);
    }
  });
  it('at cover 0 the clear-sky calibration is untouched', () => {
    const s = sunAt(35), view = V(35), a = skyCalibration(s, P, 0.3, 0, 1, 0, { view, w: 1 }), b = skyCalibration(s, P, 0.3, 0, 1, 0, { view, w: 1 }, { w: 0, chroma: OVC });
    expect(b.kT).toBe(a.kT); expect(b.kP).toBe(a.kP); expect(b.horizon).toEqual(a.horizon);
  });
  it('the overcast colour: near-neutral daylight of 6000–7000 K (measured mean 6358 K), bluer at a low sun', () => {
    expect(cct(toXY(OVC))).toBeGreaterThan(6250); expect(cct(toXY(OVC))).toBeLessThan(6450); // the conversion round-trips
    // the light on the cloud top by day (sun + sky; model) → the overcast colour
    const noon = overcastChroma([0.992, 1.001, 1.009], OVC), low = overcastChroma([0.864, 1.009, 1.31], OVC);
    expect(cct(toXY(noon))).toBeGreaterThan(6000); expect(cct(toXY(noon))).toBeLessThan(7000);
    expect(low[2] / low[0]).toBeGreaterThan(noon[2] / noon[0]);
  });
  it('the snow frame\'s sky is no longer brown: under full cover the horizon, the zenith and the skylight are blue-grey (B ≥ R), not R > G > B', () => {
    // the SkySystem end to end (test quality: the dome itself draws the overcast), a winter morning under the 'snow' weather
    const sky = new SkySystem(new THREE.Scene(), 256, 'test');
    const up = (cover: number) => { for (let i = 0; i < 2; i++) sky.update(new WorldClock(270, 10).jdUT, new THREE.Vector3(), cover, 0.4, { ms: 2, fromDeg: 270, tSeconds: 0 }, new THREE.Vector3(1, 0, 0)); };
    up(1);
    const h = [sky.horizon.r, sky.horizon.g, sky.horizon.b], hc = [sky.hemi.color.r, sky.hemi.color.g, sky.hemi.color.b];
    expect(sky.state.sunAlt).toBeGreaterThan(15);
    expect(h[2] / h[0], `horizon ${h.map(v => v.toFixed(3))}`).toBeGreaterThan(1); // was (0.279, 0.273, 0.256)
    expect(h[2] / h[0]).toBeLessThan(1.4);                                         // near-neutral, not the clear sky's blue
    expect(cct(toXY(h))).toBeGreaterThan(6000); expect(cct(toXY(h))).toBeLessThan(8000);
    expect(hc[2] / hc[0]).toBeGreaterThan(1); expect(hc[2] / hc[0]).toBeLessThan(1.4);
    // clear: the skylight keeps the clear sky's blue (the table's irradiance colour, b/r ~1.9, D-156)
    up(0);
    expect(sky.hemi.color.b / sky.hemi.color.r).toBeGreaterThan(1.6);
  });
});

describe('the low sun keeps its photometric light (D-224)', () => {
  it('the sun colour\'s luminance is the zenith sun\'s at every altitude (USNO lux are photometric); noon unchanged', () => {
    const sky = new SkySystem(new THREE.Scene(), 256, 'test'), ys: number[] = [];
    for (const hour of [12, 7.5, 6.2, 5.85]) { // day 0: sun ≈ 69°, 22°, 6°, 2.5°
      for (let i = 0; i < 2; i++) sky.update(new WorldClock(0, hour).jdUT, new THREE.Vector3(), 0.05, 0.25, { ms: 2, fromDeg: 270, tSeconds: 0 }, new THREE.Vector3(1, 0, 0));
      const c = sky.sun.color; ys.push(Y([c.r, c.g, c.b]));
      if (hour === 12) { expect(Math.max(c.r, c.g, c.b)).toBeGreaterThan(0.99); expect(Math.max(c.r, c.g, c.b)).toBeLessThan(1.01); }
      if (hour === 5.85) { expect(sky.state.sunAlt).toBeGreaterThan(2); expect(sky.state.sunAlt).toBeLessThan(3); expect(c.r / c.b).toBeGreaterThan(8); } // still deep red
    }
    for (const y of ys) expect(y / ys[0]).toBeCloseTo(1, 2);
  });
});

// ---- 2. the antisolar twilight (D-224) ---------------------------------------------------------------------------------
// Observations (tier B/C): the antitwilight arch (Belt of Venus) is "a reddish band … above the antisolar horizon during
// clear civil twilights, and immediately beneath it is the bluish-gray earth's shadow" (Lee 2015, Applied Optics 54(4)
// B194, abstract, SX); it stands "roughly 10–20° above the horizon" (WP-TWILIGHT-SX); colour and luminance extremes lie at
// different elevations (Lee 2015). The model's colours are C.
describe('antitwilight arch and Earth\'s shadow at sun −3° (D-224)', () => {
  const A = new Atmosphere(aerosolTauFor(extinctionK(0.25))), A0 = new Atmosphere(aerosolTauFor(extinctionK(0.25)), false, ATMOSPHERE_D116);
  const v = A.skyView(-3), v0 = A0.skyView(-3);
  const at = (view: SkyView, e: number, phi = 180) => sampleSkyView(view, e * deg, phi * deg);
  const rb = (c: number[]) => c[0] / c[2];
  const band = (view: SkyView, lo: number, hi: number) => { const out: { e: number; c: V3 }[] = []; for (let e = lo; e <= hi; e += 0.5) out.push({ e, c: at(view, e) }); return out; };
  it('a warmer (redder) arch at 10–21° opposite the sun, over a darker blue-grey band', () => {
    const arch = band(v, 10, 21), seg = band(v, 3, 7);
    const archRB = Math.max(...arch.map(a => rb(a.c))), archY = Math.max(...arch.map(a => Y(a.c)));
    const segY = Math.min(...seg.map(s => Y(s.c))), segC = seg.reduce((m, s) => (Y(s.c) < Y(m.c) ? s : m)).c;
    expect(archRB / rb(segC), 'arch vs shadow, R/B').toBeGreaterThan(1.3);
    expect(archRB / rb(at(v, 40)), 'arch vs the sky above, R/B').toBeGreaterThan(1.25);
    expect(archY / segY, 'arch / shadow luminance').toBeGreaterThan(1.3);
    expect(segC[2]).toBeGreaterThan(segC[1]); expect(segC[1]).toBeGreaterThan(segC[0]); // bluish-grey
  });
  it('the aerosol backscatter and the stratospheric layer make the arch redder than D-116\'s, and its peak stays at 10–25°', () => {
    const r = (view: SkyView) => Math.max(...band(view, 10, 21).map(a => rb(a.c)));
    expect(r(v)).toBeGreaterThan(r(v0) * 1.05);
    const L = band(v, 5, 40); const peak = L.reduce((m, s) => (Y(s.c) > Y(m.c) ? s : m)).e;
    expect(peak).toBeGreaterThanOrEqual(10); expect(peak).toBeLessThanOrEqual(25);
  });
  it('the aerosol phase function: lidar ratio 1 / (ω p(180°)) ≈ 50 sr, asymmetry ≈ 0.75', () => {
    expect(1 / (0.9 * miePhase(-1))).toBeGreaterThan(45); expect(1 / (0.9 * miePhase(-1))).toBeLessThan(55);
    expect(1 / (0.9 * miePhase(-1, 0))).toBeGreaterThan(150); // Cornette–Shanks alone (D-116): ~200 sr
    let n = 0, g = 0; for (let i = 0; i < 2000; i++) { const mu = -1 + (2 * (i + 0.5)) / 2000, p = miePhase(mu) * 2 * Math.PI * (2 / 2000); n += p; g += p * mu; }
    expect(n).toBeCloseTo(1, 2); expect(g / n).toBeGreaterThan(0.7); expect(g / n).toBeLessThan(0.8); void MIE_BACKSCATTER;
  });
  it('B43 (recorded, not adopted): a converged multiple-scattering table puts 25–45 % less light into the dark segment', () => {
    const vc = new Atmosphere(aerosolTauFor(extinctionK(0.25)), false, MS_CONVERGED).skyView(-3);
    const seg = (view: SkyView) => Math.min(...band(view, 3, 8).map(s => Y(s.c)));
    const r = seg(vc) / seg(v); expect(r).toBeGreaterThan(0.55); expect(r).toBeLessThan(0.8);
  });
});

// ---- 3. the frame meter's bright majority (D-224) ------------------------------------------------------------------------
describe('frame meter: the bright majority (D-224)', () => {
  /** AgX (three r186) saturates at log2(x / 0.18) = +4.03: display white ≈ 2.94 in exposed scene-linear units */
  const WHITE = 0.18 * 2 ** 4.026;
  const tex = (f: (i: number, j: number) => number) => { const t = new Float32Array(METER_W * METER_H); for (let j = 0; j < METER_H; j++) for (let i = 0; i < METER_W; i++) t[j * METER_W + i] = Math.log(f(i, j)); return t; };
  const px = (t: Float32Array) => { const p = new Float32Array(t.length * 4); t.forEach((v, i) => { p[i * 4] = v; }); return p; };
  const ref = (X: number) => (0.18 * (KEY / X)) / Math.PI;
  it('a portico looking out (D-219: exposure 36, the sky 5–7× display white): the sky comes back under white, the columns go dark', () => {
    for (const over of [5, 7]) {
      const X = 36, Xout = 2.3, sky = (over * WHITE) / X, col = ref(X) / 2;
      // columns at the frame's sides and a lintel on top, the view out between them (≈ 70 % of the centre-weighted field)
      const t = tex((i, j) => (i < 4 || i >= METER_W - 4 || j >= METER_H - 2 ? col : sky));
      const old = meterEV(meterLogMean(px(t)), X, KEY, 30000), m = meterEVFrame(t, X, KEY, 30000, Xout);
      expect(old).toBe(METER_MIN_EV); expect(sky * X * 2 ** old / WHITE, 'D-159 alone: still over white').toBeGreaterThan(2);
      expect(m.bright).toBeGreaterThan(0.6);
      const Xf = X * 2 ** m.ev;
      expect(sky * Xf, `sky ${over}× white`).toBeLessThan(WHITE);
      expect(Xf).toBeGreaterThanOrEqual(Xout * 0.999); // never below the open-air exposure
    }
  });
  it('from inside a dark hall adapted to it, a small bright door (hall-out: ~8 % of the frame) still blows out', () => {
    const X = 136, hall = ref(X), door = (20 * WHITE) / X; // the court seen through the door: 20× white at the hall's exposure
    const t = tex((i, j) => (i >= 10 && i < 13 && j >= 3 && j < 10 ? door : hall * 0.8));
    const old = meterEV(meterLogMean(px(t)), X, KEY, 30000), m = meterEVFrame(t, X, KEY, 30000, 1.2);
    expect(m.bright).toBeLessThan(BRIGHT_F0);
    expect(m.ev).toBeCloseTo(old, 9);                        // D-159 unchanged: the interior adaptation holds (D-141)
    expect(door * X * 2 ** m.ev).toBeGreaterThan(WHITE * 5); // the door burns
  });
  it('an ordinary frame (grey ground, sky 1.5 EV brighter, 40 % sky) and a uniform grey are unchanged', () => {
    const X = 2, g = ref(X);
    const t = tex((_i, j) => (j < 6 ? g * 2 ** 1.5 : g)), m = meterEVFrame(t, X, KEY, 30000, 2);
    expect(m.bright).toBe(0); expect(m.ev).toBeCloseTo(meterEV(meterLogMean(px(t)), X, KEY, 30000), 9);
    expect(meterEVFrame(tex(() => g), X, KEY, 30000, 2).ev).toBeCloseTo(0, 6); // (float32 texels)
  });
  it('the blend is gradual as a doorway grows in the view, and night and deep twilight stay with the law', () => {
    const X = 40, hall = ref(X) / 2, out = (8 * WHITE) / X;
    let prev = 1; for (const cols of [2, 6, 10, 14, 18, 22]) {
      const t = tex(i => (Math.abs(i - METER_W / 2 + 0.5) < cols / 2 ? out : hall)), ev = meterEVFrame(t, X, KEY, 30000, 2).ev;
      expect(ev).toBeLessThanOrEqual(prev + 1e-9); prev = ev;
    }
    expect(prev).toBeLessThan(-2.5);
    const t = tex(() => out); expect(Math.abs(meterEVFrame(t, X, KEY, 5, 2).ev)).toBe(0); // 5 lx at the eye: faded out (D-159)
  });
});
