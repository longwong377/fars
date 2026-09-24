import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { airOptics, opticalDepth, visibilityKm, pathWeight, layerFactor, Z0, H_AEROSOL, H_RAYLEIGH } from '../src/sky/aerial';
import { SkySystem } from '../src/sky/skySystem';
import { WorldClock } from '../src/core/clock';
import { domeRadiance } from '../src/sky/horizon';
import { decodeHorizonMap } from '../src/terrain/horizonMap';
import { airToBase } from '../src/sky/cloudCover';
import { Ring, Terrain, TerrainMeta } from '../src/terrain/heightfield';
import { sunHorizon } from '../src/sky/ephemeris';
import { Atmosphere, aerosolTauFor } from '../src/sky/atmosphere';
import { extinctionK } from '../src/sky/illuminance';
const tmeta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(tmeta.rings[k], new Uint16Array(readFileSync(`public/${tmeta.rings[k].file}`).buffer.slice(0)), tmeta.court_asl);
const T = new Terrain(tmeta, ring('near'), ring('mid'), ring('far'));
const sunAzAt = (day: number, hour: number) => sunHorizon(new WorldClock(day, hour).jdUT).azimuth;

// D-156 (triage item 8): aerial perspective as an exponential-height medium (Rayleigh + the D-116 aerosol + dust, mist and
// precipitation from the weather), integrated analytically along the view ray; in-scatter from the calibrated sky.
const Y = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hmeta = JSON.parse(readFileSync('public/generated/horizon_map.json', 'utf8'));
const MAP = decodeHorizonMap(hmeta, new Uint8Array(inflateSync(readFileSync(`public/${hmeta.file}`))));

describe('aerial perspective: the medium (D-156)', () => {
  it('Koschmieder visibility from the weather: clear spring 40–60 km, dry clear ≤ 70 km, dust 5–15 km, mist 1–2 km', () => {
    const clear = visibilityKm(airOptics({ haze: 0.25 })), dry = visibilityKm(airOptics({ haze: 0.15 }));
    expect(clear).toBeGreaterThan(40); expect(clear).toBeLessThan(60);
    expect(dry).toBeGreaterThan(clear); expect(dry).toBeLessThan(70);
    const dust = visibilityKm(airOptics({ haze: 0.72, dust: 1 })); expect(dust).toBeGreaterThan(5); expect(dust).toBeLessThan(15);
    const mist = visibilityKm(airOptics({ haze: 0.85, mist: 1 })); expect(mist).toBeGreaterThan(1); expect(mist).toBeLessThan(2);
    // the mist is a shallow layer: 300 m above the plain the air is nearly clear again
    expect(visibilityKm(airOptics({ haze: 0.85, mist: 1 }), Z0 + 300)).toBeGreaterThan(10);
  });
  it('a clear spring day veils 40–60 % at 10 km over the plain (was 3–4 % with FogExp2), and ridges step paler with distance', () => {
    const o = airOptics({ haze: 0.25 }), veil = (zc: number, zp: number, d: number) => 1 - Math.exp(-opticalDepth(o, zc, zp, d)[1]);
    const v10 = veil(1626.6, 1600, 10000); expect(v10).toBeGreaterThan(0.4); expect(v10).toBeLessThan(0.6);
    // the old law at haze 0.25: 1 − exp(−(ρ d)²), ρ = 1.2e-5 + 1.2e-4 · 0.0625
    const old = 1 - Math.exp(-(((1.2e-5 + 1.2e-4 * 0.0625) * 10000) ** 2)); expect(old).toBeLessThan(0.05);
    // successive ridges 5, 10, 20, 40 km out, crests 300–900 m above the plain: each paler (more veiled) than the last
    const ridges = [[5000, 1900], [10000, 2000], [20000, 2300], [40000, 2500]].map(([d, h]) => veil(1626.6, h, d));
    for (let i = 1; i < ridges.length; i++) expect(ridges[i], ridges.map(r => r.toFixed(2)).join(' ')).toBeGreaterThan(ridges[i - 1] + 0.05);
    expect(ridges[3]).toBeLessThan(0.97); // the far ranges still show as pale silhouettes (their crests stand in thinner air)
  });
  it('the analytic path integral matches a numerical one (up, down, level rays)', () => {
    const o = airOptics({ haze: 0.4, dust: 0.3, mist: 0.5, rain: 0.2 });
    for (const [zc, zp, d] of [[1626, 1600, 8000], [1626, 3200, 40000], [2400, 1590, 12000], [1600, 1600.001, 3000], [1700, 4000, 2500]]) {
      const N = 4000; const num = [0, 0, 0];
      for (let i = 0; i < N; i++) { const z = zc + ((i + 0.5) / N) * (zp - zc); for (let c = 0; c < 3; c++) num[c] += (d / N) * (o.betaR[c] * Math.exp(-(z - Z0) / H_RAYLEIGH) + o.betaM[c] * Math.exp(-(z - Z0) / H_AEROSOL) + o.betaMist * Math.exp(-(z - Z0) / 100) + o.betaPrecip * Math.exp(-(z - Z0) / 3000)); }
      const an = opticalDepth(o, zc, zp, d);
      for (let c = 0; c < 3; c++) expect(Math.abs(an[c] / num[c] - 1), `${zc}→${zp} over ${d} m`).toBeLessThan(1e-3);
    }
    expect(layerFactor(1600, 1600, 1200)).toBeCloseTo(1, 6);
  });
  it('near the eye the veil is bluer than far away (Rayleigh), and the per-channel depth is ordered B > G > R', () => {
    const o = airOptics({ haze: 0.25 }), t = (d: number) => opticalDepth(o, 1626.6, 1605, d).map(x => 1 - Math.exp(-x));
    const near = t(2000), far = t(60000);
    expect(near[2] / near[1]).toBeGreaterThan(far[2] / far[1]); expect(near[2]).toBeGreaterThan(near[1]); expect(near[1]).toBeGreaterThan(near[0]);
  });
  it('the in-scatter weight of a partly sunlit path: 1/2 for a thin path, → 1/τ for a thick one, continuous', () => {
    expect(pathWeight(0)).toBeCloseTo(0.5, 6); expect(Math.abs(pathWeight(0.0499) - pathWeight(0.0501))).toBeLessThan(1e-3);
    expect(pathWeight(20) * 20).toBeCloseTo(1, 1);
    for (let t = 0.01; t < 10; t *= 1.5) expect(pathWeight(t * 1.5)).toBeLessThan(pathWeight(t));
  });
  it('cloud fade: the air between the eye and the cloud base thins with the ray\'s elevation', () => {
    let prev = 0; for (const sy of [0.02, 0.05, 0.1, 0.3, 1]) { const T = airToBase(sy); expect(T).toBeGreaterThan(prev); prev = T; }
    expect(airToBase(1)).toBeGreaterThan(0.8); expect(airToBase(0.02)).toBeLessThan(0.1);
  });
});

describe('aerial perspective: the sky system (D-156)', () => {
  const sky = new SkySystem(new THREE.Scene(), 256, 'test'); sky.setHorizonMap(MAP);
  const at = (day: number, hour: number, cam = new THREE.Vector3(-40.2, 1.6, -122.45), haze = 0.25) => { const c = new WorldClock(day, hour); for (let i = 0; i < 2; i++) sky.update(c.jdUT, cam, 0.05, haze, { ms: 2, fromDeg: 270, tSeconds: 0 }, new THREE.Vector3(-1, 0, 0)); };
  const D = Math.PI / 180;
  it('the in-scatter is brighter and warmer toward the sun than away from it (day and low sun), and converges to the sky', () => {
    for (const [day, hour] of [[0, 9], [25, 16], [0, 6.2]] as const) {
      at(day, hour); const a = sky.state.sunAlt * D, toward = sky.air.jAt(a + 2 * D), away = sky.air.jAt(Math.PI - 0.01);
      expect(Y(toward) / Y(away), `day ${day} ${hour} h`).toBeGreaterThan(1.5);
      expect(toward[0] / toward[2], `day ${day} ${hour} h`).toBeGreaterThan(away[0] / away[2]);
      // J for a horizon direction is the calibrated dome there (the distance converges to the sky behind it)
      const s = sky.state.sunDir, dir: [number, number, number] = [Math.cos(1.5 * D) * Math.cos(2), Math.sin(1.5 * D), Math.cos(1.5 * D) * Math.sin(2)];
      const th = Math.acos(dir[0] * s.x + dir[1] * s.y + dir[2] * s.z), cal = (sky as any);
      const P = { turbidity: cal.sky.turbidity.value, rayleigh: cal.sky.rayleigh.value, mieCoefficient: cal.sky.mieCoefficient.value, mieDirectionalG: cal.sky.mieDirectionalG.value };
      const dome = domeRadiance(dir, [s.x, s.y, s.z], P, cal.uKP.value, cal.view ? cal.uKT.value / cal.view.irradianceY : 0, cal.view);
      expect(Math.abs(Y(sky.air.jAt(th)) / Y(dome) - 1), `day ${day} ${hour} h`).toBeLessThan(0.08);
    }
  });
  it('night and twilight stay finite and dim; after sunset the haze toward the afterglow is warmer (D-116)', () => {
    at(5, 22.5); for (const th of [0, 1, 2, 3]) for (const c of sky.air.jAt(th)) { expect(Number.isFinite(c)).toBe(true); expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThan(0.01); }
    at(0, 19.1); const glow = sky.air.jAt(10 * D), east = sky.air.jAt(Math.PI - 0.1);
    expect(sky.state.sunAlt).toBeLessThan(-6); expect(glow[0] / glow[2]).toBeGreaterThan(east[0] / east[2]); expect(sky.air.sunUp.value).toBe(0);
  });
  it('in Kuh-e Rahmat\'s dawn shadow (05:51, day 0) the eye sees no sun, adapts to the skylight, and the ground bounce loses the sun', () => {
    at(0, 5.85); expect(sky.eyeSunVisibility).toBe(0);
    const luxShadow = sky.lux, ground = sky.hemi.groundColor.clone();
    // the plain 14 km out from the landing, away from the sun: beyond the mountain's shadow (~9.75 km, horizonmap.test)
    const g = (sunAzAt(0, 5.85) + 180 - 341) * D, x = -40.2 + Math.sin(g) * 14000, z = -122.45 - Math.cos(g) * 14000;
    at(0, 5.85, new THREE.Vector3(x, T.heightAt(x, z) + 2, z));
    expect(sky.eyeSunVisibility).toBeGreaterThan(0.9); expect(sky.lux).toBeGreaterThan(luxShadow * 1.05);
    expect(Y([sky.hemi.groundColor.r, sky.hemi.groundColor.g, sky.hemi.groundColor.b])).toBeGreaterThan(Y([ground.r, ground.g, ground.b]));
  });
});

describe('terrain horizon in shading (D-156)', () => {
  it('the sun\'s and the moon\'s colour nodes carry the horizon term, so meshes that receive no shadow maps are shadowed too', async () => {
    const sky = new SkySystem(new THREE.Scene(), 256, 'test');
    const cn = (sky.sun as any).colorNode, mn = (sky.moonLight as any).colorNode;
    expect(cn?.isNode).toBe(true); expect(mn?.isNode).toBe(true);
    // three r186 AnalyticLightNode: `this.colorNode = light.colorNode || uniform(color)`; the shadow node only multiplies it
    // for meshes with receiveShadow (setupShadow), so the base colour — with the horizon — reaches every lit mesh
    const node = new (THREE as any).DirectionalLightNode(sky.sun);
    expect(node.colorNode).toBe(cn);
    expect((sky.scene as any).fogNode?.isNode).toBe(true);
  });
});

describe('the physical sky by day follows the haze without stalling a frame (D-156)', () => {
  it('a deferred sky model equals an immediate one, cell for cell', () => {
    const a = new Atmosphere(0.12), b = new Atmosphere(0.12, true); let n = 0;
    while (!b.buildStep(37)) n++;
    expect(n).toBeGreaterThan(10);
    expect(Array.from((b as any).trans)).toEqual(Array.from((a as any).trans)); expect(Array.from((b as any).ms)).toEqual(Array.from((a as any).ms));
  });
  it('by day a haze change builds the new model over frames; a jump in time builds it at once', () => {
    const sky = new SkySystem(new THREE.Scene(), 256, 'test'), cam = new THREE.Vector3(), w = { ms: 2, fromDeg: 270, tSeconds: 0 }, v = new THREE.Vector3(1, 0, 0);
    const jd = new WorldClock(25, 10).jdUT, dt = 1 / 86400 / 60, tauOf = (h: number) => Math.round(aerosolTauFor(extinctionK(h)) / 0.01) * 0.01;
    sky.update(jd, cam, 0.05, 0.25, w, v); const t0 = (sky as any).atmo.aerosolTau;
    expect(tauOf(0.55) - t0).toBeGreaterThanOrEqual(0.03); expect(tauOf(0.55) - t0).toBeLessThan(0.1);
    let f = 1; sky.update(jd + dt, cam, 0.05, 0.55, w, v);
    expect((sky as any).atmo.aerosolTau).toBe(t0); // the old model serves while the new one is built
    while ((sky as any).atmo.aerosolTau === t0 && f < 3000) sky.update(jd + dt * ++f, cam, 0.05, 0.55, w, v);
    expect(f).toBeGreaterThan(2); expect((sky as any).atmo.aerosolTau).toBeCloseTo(tauOf(0.55), 9);
    sky.update(new WorldClock(26, 10).jdUT, cam, 0.05, 0.9, w, v); // setTime: at once
    expect((sky as any).atmo.aerosolTau).toBeCloseTo(tauOf(0.9), 9);
  });
});

// Session 5: the first render of D-156 indoors (apadana-hall-in, WebGL2 at quality test) filled the hall with a white veil:
// 30–60 m of air lit by the outdoor horizon, raised by the eye's interior gain (exposure 509). The air inside the enclosure
// around the eye is lit by the interior's light (Air.setInterior: the probes' eye illuminance).
describe('aerial perspective: the air inside a hall (session 5)', () => {
  it('inside a dim hall the veil over 40 m is scaled by the interior light; outdoors and beyond the hall it is unchanged', async () => {
    const { Air } = await import('../src/sky/aerial');
    const air = new Air(), o = airOptics({ haze: 0.25 }), tau = (d: number) => opticalDepth(o, Z0 + 18, Z0 + 18, d)[1];
    const open = air.inscatterWeight(tau(40), 40);
    air.setInterior(0.003, 60); // the Apadana hall at midday: ~0.3 % of the open air's light at the eye
    const inHall = air.inscatterWeight(tau(40), 40);
    expect(inHall / open).toBeCloseTo(0.003, 4);
    // the veil in display terms: the columns reflect ~0.3 % of open ground's light × albedo 0.4; the veil must stay below them
    expect(inHall).toBeLessThan(0.1 * 0.003 * 0.4 * 10); // J ≈ the horizon ≈ open ground's radiance ×(1–3): conservative bound
    // a far point through the doorway: the path beyond the hall is the open air's (weight within 1 % of outdoors minus the hall's share)
    const far = 20000, wFar = air.inscatterWeight(tau(far), far), T60 = Math.exp(-tau(60));
    air.setInterior(1, 0); const wOpen = air.inscatterWeight(tau(far), far);
    expect(Math.abs(wFar - (wOpen - (1 - T60) * (1 - 0.003)))).toBeLessThan(1e-6);
    expect(air.inscatterWeight(tau(40), 40)).toBeCloseTo(open, 9); // outdoors: as before
  });
  it('the eye\'s enclosure: the roofed footprint of the probe volume around the eye, 0 outside', async () => {
    const { setProbeField, probeVolumeExtent } = await import('../src/render/probes/runtime');
    const { decodeField } = await import('../src/render/probes/field');
    const meta = JSON.parse(readFileSync('public/generated/probes.json', 'utf8')), bin = readFileSync('public/generated/probes.f16');
    setProbeField({ volumes: meta.volumes, data: decodeField(new Uint16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2)), count: meta.count, normalBias: meta.normalBias, tier: meta.tier, note: meta.note });
    const apadana = probeVolumeExtent({ x: 10.55, y: 4.2, z: -12.4 }); // the apadana-hall-in camera (grid y 12.4 → z −12.4; the hall floor is ~2.6 m above the court)
    expect(apadana).toBeGreaterThan(60); expect(apadana).toBeLessThan(160);
    expect(probeVolumeExtent({ x: -60, y: 1.6, z: -122 })).toBe(0); // the Grand Stair top landing, in the open
    setProbeField(null);
  });
});
