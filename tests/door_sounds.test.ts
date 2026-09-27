// The doors heard (session 10, GB55): a street door within 30 m that starts to swing is heard once (its pivot), and once more as it
// comes shut (barred at night); a door far off is silent; a door at rest is silent.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { TownDoors } from '../src/world/settlement/towndoors';
import { STRIKE_KINDS } from '../src/audio/soundscape';

const door = (id: string, x: number) => ({ id, plot: 0, tile: 0, hinge: [x, 0] as [number, number], theta: 0, closedYaw: 0, openYaw: Math.PI / 2, y: 0, h: 2, wood: 0.5, kind: 'house', site: 's' });
describe('door sounds (GB55)', () => {
  it('a near door swinging is heard at its start and at its shutting; a far one never', () => {
    const D = new TownDoors([door('a', 3), door('b', 200)], null), heard: string[] = [];
    D.onSound = (k, p, barred) => heard.push(`${k}@${Math.round(p.x)}${barred ? '+bar' : ''}`);
    const eye = new THREE.Vector3(0, 1.6, 0), cam = new THREE.PerspectiveCamera(); cam.position.set(3.5, 1.6, -1.2); cam.lookAt(3.5, 1.6, 0); cam.updateMatrixWorld();
    for (let f = 0; f < 10; f++) D.update(1 / 30, eye, 30, 40, () => true); // settle to the day's schedule
    expect(heard).toEqual([]);
    const r = D.use(cam); expect(r).not.toBeNull();
    for (let f = 0; f < 90; f++) D.update(1 / 30, eye, 30, 40, () => true);
    expect(heard.filter(h => h.startsWith('door@3')).length).toBe(1);
    D.use(cam); for (let f = 0; f < 90; f++) D.update(1 / 30, eye, 30, 40, () => true);
    const all = heard.join(','); expect(all).not.toMatch(/@200/);
    expect(STRIKE_KINDS).toContain('door'); expect(STRIKE_KINDS).toContain('door_shut'); expect(STRIKE_KINDS).toContain('door_bar');
  });
});
