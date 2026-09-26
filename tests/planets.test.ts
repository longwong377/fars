// The planets (session 9; src/sky/planets.ts): astronomy-engine's places and magnitudes; Venus the brightest; none drawn by day.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { planetsAt, planetBright, planetShowsBelow, Planets } from '../src/sky/planets';
import { WorldClock } from '../src/core/clock';
import { sunHorizon } from '../src/sky/ephemeris';

describe('planets over Pārsa in 467 BCE', () => {
  it('five planets with magnitudes in their real ranges; Venus the brightest', () => {
    for (let d = 0; d < 354; d += 30) { const P = planetsAt(new WorldClock(d, 20).jdUT), m = Object.fromEntries(P.map(p => [p.name, p.mag]));
      expect(P.length).toBe(5); expect(m.Venus).toBeLessThan(-3.5); expect(m.Venus).toBeGreaterThan(-5); expect(m.Jupiter).toBeLessThan(-1.4); expect(m.Saturn).toBeLessThan(1.6); expect(m.Mars).toBeLessThan(2);
      expect(planetBright(m.Venus)).toBeGreaterThan(planetBright(m.Jupiter)); }
  });
  it('none shows in daylight; Venus shows first in the twilight', () => {
    expect(planetShowsBelow(-4.2)).toBeGreaterThan(planetShowsBelow(0.5));
    const pl = new Planets(1000), c = new WorldClock(40, 12); pl.update(c.jdUT, new THREE.Vector3(), sunHorizon(c.jdUT).altitude, 0);
    const col = (pl.points.geometry.attributes.pcol as THREE.BufferAttribute).array; expect(Math.max(...col)).toBe(0);
  });
});
