// The plain and garden views at close range (D-149): the river margins (reeds, rushes, bank grass) stand on the corridor
// as drawn and follow the date; the vine rows are leafless stocks in mid-April; the water's ripples are band-limited by
// the pixel footprint; the garden channels are built to the Pasargadae analogy (25 cm limestone channels, a basin every
// 13-14 m). Headless: the same generators the renderer uses.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { loadTerrain, loadRiversFile } from './plainLib';
import { buildCanals } from '../src/world/plain/canals';
import { buildRivers } from '../src/world/plain/rivers';
import { riparianMargins, KIND, MARGIN_R } from '../src/world/plain/riparian';
import { marginState, cropState, doyOf } from '../src/world/plain/seasonal';
import { RIPPLE_OCTAVES } from '../src/world/plain/waterShade';
import { CHANNEL } from '../src/world/settlement/water';
import { feature } from '../src/world/plain/data';

const T = loadTerrain(), R = loadRiversFile();

describe('river margins (riparian.ts, seasonal.ts marginState)', () => {
  const canals = buildCanals(T, R.rivers, 1), rv = buildRivers(T, R.rivers, canals);
  const flood = R.rivers.map(r => (feature(r.id).flow_by_month as { depth_m: number }[]).reduce((m, q) => Math.max(m, q.depth_m), 0)) as [number, number];
  it('at the Pulvar bank (the pulvar-bank-april view) reeds stand on the channel slope, rushes at the edge, grass on the bank, all within the radius and on the drawn corridor', () => {
    const mg = riparianMargins(rv.profiles, canals, T, 'high', flood), cam = new THREE.Vector3(-2505, 0, -2700);
    mg.update(cam);
    const g = mg.mesh.geometry as THREE.InstancedBufferGeometry, pos = g.getAttribute('ipos'), v = g.getAttribute('ivar'), n = g.instanceCount;
    const kinds = [0, 0, 0]; let far = 0, grassFar = 0, below = 0;
    for (let i = 0; i < n; i++) { const k = v.getX(i), d = Math.hypot(pos.getX(i) - cam.x, pos.getZ(i) - cam.z); kinds[k]++;
      if (d > MARGIN_R.high.r + 1) far++; if (k === KIND.grass && d > MARGIN_R.high.grass + 1) grassFar++;
      // on or above the ground the player walks (the corridor mesh is drawn over the carved heightfield)
      if (pos.getY(i) < T.heightAt(pos.getX(i), pos.getZ(i)) - 1.8) below++; }
    console.log('margins at the Pulvar bank', JSON.stringify({ n, reeds: kinds[0], rushes: kinds[1], grass: kinds[2] }));
    expect(n).toBeGreaterThan(800); expect(n).toBeLessThanOrEqual(MARGIN_R.high.cap);
    expect(kinds[KIND.reed]).toBeGreaterThan(100); expect(kinds[KIND.rush]).toBeGreaterThan(20); expect(kinds[KIND.grass]).toBeGreaterThan(200);
    expect(far).toBe(0); expect(grassFar).toBe(0); expect(below).toBe(0);
    // it re-places only when the camera has moved a tenth of the radius
    expect(mg.update(cam.clone().add(new THREE.Vector3(2, 0, 0)))).toBe(false); expect(mg.update(cam.clone().add(new THREE.Vector3(20, 0, 0)))).toBe(true);
  }, 120_000);
  it('by the date: mid-April pale old culms over half a metre of new shoots; August 2.5 m green reeds; bank grass straw in late summer, green in spring', () => {
    const apr = marginState(doyOf(0)), aug = marginState(doyOf(120)), jan = marginState(doyOf(280));
    expect(apr.reedNew).toBeGreaterThan(0.35); expect(apr.reedNew).toBeLessThan(0.7); expect(apr.reedOld).toBeGreaterThan(0.6); expect(apr.grassGreen).toBeGreaterThan(0.95);
    expect(aug.reedNew).toBeGreaterThan(2.3); expect(aug.reedGreen).toBeGreaterThan(0.95); expect(aug.grassGreen).toBeLessThan(0.3);
    expect(jan.reedNew).toBe(0); expect(jan.reedOld).toBeGreaterThan(0.6);
  });
});

describe('fields in mid-April (seasonal.ts cropState)', () => {
  it('barley and wheat stand ~0.6 m and green on 17 April (plain.json Apr 0.6 m); the vines are leafless stocks until budburst, in leaf by June', () => {
    const d0 = doyOf(0);
    for (const c of ['barley', 'wheat'] as const) { const s = cropState(c, d0); expect(s.height).toBeGreaterThan(0.45); expect(s.height).toBeLessThan(0.65); expect(s.green).toBeGreaterThan(0.8); }
    const v0 = cropState('vineyard', d0), vJun = cropState('vineyard', doyOf(60));
    expect(v0.height).toBeLessThan(0.55); expect(v0.green).toBeLessThan(0.02); // was 1.09 m and 0.32 green (a window edge from day 92)
    expect(vJun.height).toBeGreaterThan(1.3); expect(vJun.green).toBeGreaterThan(0.5);
  });
});

describe('water ripples are band-limited (waterShade.ts)', () => {
  it('every octave fades out before its wavelength spans fewer than ~3 pixels, and the finest is under 0.2 m', () => {
    // fade: 1 - smoothstep(0.12 lam, 0.33 lam, metres per pixel): gone at 3 px per wavelength, whole at 8 px
    for (const [lam] of RIPPLE_OCTAVES) { expect(lam / (0.33 * lam)).toBeGreaterThan(3 - 1e-9); expect(lam / (0.12 * lam)).toBeGreaterThan(8); }
    expect(Math.min(...RIPPLE_OCTAVES.map(o => o[0]))).toBeLessThan(0.2);
    // octaves are not harmonics of each other (the old two cosine trains made regular stripes)
    const l = RIPPLE_OCTAVES.map(o => o[0]); for (let i = 1; i < l.length; i++) expect(Math.abs(l[i - 1] / l[i] - Math.round(l[i - 1] / l[i]))).toBeGreaterThan(0.05);
  });
});

describe('garden channels (settlement water.ts, Pasargadae analogy)', () => {
  it('limestone channels 25 cm wide with a basin every 13-14 m (PASARGADAE-CHANNELS, B); blocks about a metre, open joints', () => {
    expect(CHANNEL.inner).toBeCloseTo(0.25, 5);
    expect(CHANNEL.basinEvery).toBeGreaterThanOrEqual(13); expect(CHANNEL.basinEvery).toBeLessThanOrEqual(14);
    expect(CHANNEL.block[0]).toBeGreaterThan(0.6); expect(CHANNEL.block[1]).toBeLessThan(1.5); expect(CHANNEL.joint).toBeGreaterThan(0);
    // the water shows below the lip, and the lip is low: the channel reads as stone at the ground, not a raised kerb
    expect(CHANNEL.water).toBeGreaterThan(0); expect(CHANNEL.water).toBeLessThan(CHANNEL.top); expect(CHANNEL.top).toBeLessThanOrEqual(0.08);
  });
});
