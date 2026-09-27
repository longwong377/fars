// The swifts' screaming parties round the Terrace's halls (session 10, WORLD_INVENTORY GB29; world/wildlife.ts SWIFTS). What is
// measured: the season and the screaming hours; at the screaming hours every party keeps its circuit clear of the halls it laps
// (outside their footprints' bounds, or above the palaces' roofs), flies at a swift's pace and holds together; the scream is a
// strike kind the soundscape plays.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { swiftAt, swiftScreaming, sunHoursOfMonth, SWIFTS, BIRDS, type BirdPose } from '../src/world/wildlife';
import { STRIKE_KINDS } from '../src/audio/soundscape';
import { footprint } from '../src/arch/spec';

const pose = (): BirdPose => ({ pos: new THREE.Vector3(), heading: 0, bank: 0, flap: 0, visible: false });
describe('swifts (GB29)', () => {
  it('breed April-August; scream in the 1.6 h before sunset to 20 min after it, and after sunrise; feed high otherwise', () => {
    const [rise, set] = sunHoursOfMonth(5); expect(rise).toBeGreaterThan(4.6); expect(rise).toBeLessThan(5.3); expect(set).toBeGreaterThan(18.7); expect(set).toBeLessThan(19.4); // June at 30° N (solar time)
    expect(swiftScreaming(5, set - 1)).toBe(true); expect(swiftScreaming(5, rise + 0.4)).toBe(true); expect(swiftScreaming(5, 12)).toBe(false);
    expect(swiftScreaming(0, set - 1)).toBe(false); expect(swiftScreaming(9, set - 1)).toBe(false);
    expect(SWIFTS.first + SWIFTS.count).toBe(BIRDS.swallow.count); // (they share the swallows' mesh: no draw call of their own)
    const p = pose(); for (let k = 0; k < SWIFTS.count; k++) { swiftAt(k, 1, 777, false, 0, p); expect(p.pos.y).toBeGreaterThan(40); }
  });
  it('screaming parties lap their halls clear of the buildings, at 15-34 m/s (the screaming dash), the eight birds strung within 40 m of the leader', () => {
    const boxes = ['apadana', 'hall100', 'tachara', 'hadish', 'tripylon', 'treasury', 'harem'].map(k => footprint(k).polygon as [number, number][]).map(pl => {
      const xs = pl.map(q => q[0]), ys = pl.map(q => q[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; });
    const a = pose(), b = pose(), lead = pose(); let low = Infinity, vmin = Infinity, vmax = 0, spread = 0;
    for (let k = 0; k < SWIFTS.count; k++) for (let t = 0; t < 300; t += 0.7) {
      swiftAt(k, 1, t, true, 0, a); swiftAt(k, 1, t + 0.1, true, 0, b); const v = a.pos.distanceTo(b.pos) / 0.1; vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
      swiftAt(k - (k % SWIFTS.party), 1, t, true, 0, lead); spread = Math.max(spread, a.pos.distanceTo(lead.pos));
      const e = a.pos.x, n = -a.pos.z, inBox = boxes.some(([x0, x1, y0, y1]) => e > x0 && e < x1 && n > y0 && n < y1); if (inBox) low = Math.min(low, a.pos.y);
      expect(a.pos.y).toBeGreaterThan(12); expect(a.pos.y).toBeLessThan(36);
    }
    expect(vmin).toBeGreaterThan(15); expect(vmax).toBeLessThan(34); expect(spread).toBeLessThan(40);
    if (low !== Infinity) expect(low).toBeGreaterThan(12); // (over a lower palace only above its roof)
  });
  it('the scream is a strike kind', () => { expect(STRIKE_KINDS).toContain('swifts'); });
});

import { starlingAt, murmurationOn } from '../src/world/wildlife';
describe('the winter murmuration (GA45)', () => {
  it('only in Nov-Feb about sunset; a cloud 40-120 m up that holds together and moves at a starling\'s pace, then drops into the reeds', () => {
    const [, set] = sunHoursOfMonth(0); expect(murmurationOn(0, set - 0.4)).toBe(true); expect(murmurationOn(0, 12)).toBe(false); expect(murmurationOn(5, set - 0.4)).toBe(false);
    const a = pose(), b = pose(); let ymin = Infinity, ymax = -Infinity, spread = 0, vmax = 0;
    for (let t = 0; t < 600; t += 13) { let sx = 0, sz = 0; const P: THREE.Vector3[] = [];
      for (let k = 0; k < 200; k++) { starlingAt(k, 200, 1, t, [0, 0], 0, 0, a); P.push(a.pos.clone()); sx += a.pos.x; sz += a.pos.z; ymin = Math.min(ymin, a.pos.y); ymax = Math.max(ymax, a.pos.y);
        starlingAt(k, 200, 1, t + 0.1, [0, 0], 0, 0, b); vmax = Math.max(vmax, a.pos.distanceTo(b.pos) / 0.1); }
      const c = new THREE.Vector3(sx / 200, 0, sz / 200); for (const q of P) spread = Math.max(spread, Math.hypot(q.x - c.x, q.z - c.z)); }
    expect(ymin).toBeGreaterThan(10); expect(ymax).toBeLessThan(160); expect(spread).toBeLessThan(170); expect(vmax).toBeLessThan(40);
    starlingAt(3, 200, 1, 100, [0, 0], 0, 1, a); expect(a.pos.y).toBeLessThan(25);
  });
});

import { kestrelAt } from '../src/world/wildlife';
describe('kestrels (GA44)', () => {
  it('hover in place most of each cycle, 5-25 m up, facing into the wind, and slide on to the next spot', () => {
    const a = pose(), b = pose(); let hover = 0, n = 0, facing = 0;
    for (let t = 0; t < 2000; t += 3.7) { kestrelAt([0, 0], () => 0, 7, t, { x: 3, n: 0 }, a); kestrelAt([0, 0], () => 0, 7, t + 0.5, { x: 3, n: 0 }, b); n++;
      const v = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) / 0.5; if (v < 1.5) { hover++; if (Math.abs(a.heading - Math.atan2(-3, 0)) < 1e-6) facing++; }
      expect(a.pos.y).toBeLessThan(30); expect(v).toBeLessThan(20); }
    expect(hover / n).toBeGreaterThan(0.45); expect(facing / hover).toBeGreaterThan(0.8); // (the slow start of a slide faces its way)
  });
});
