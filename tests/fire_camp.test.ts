// D-530: the court camps' hearths join the fire system after it is built (C3's ask) and burn at the meal hours only while
// their tent stands; the flame billboards are re-made for the larger count.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { FireSystem } from '../src/world/fire';
import { addCampHearths } from '../src/world/firePlaces';

describe('court camp hearths (D-530)', () => {
  it('lit at dusk while the tent stands, out when it is struck; flames re-made for the new count', () => {
    const fire = new FireSystem(2);
    fire.add('torch', new THREE.Vector3(0, 2, 0), { tier: 'C', src: 'RECON', note: 't' });
    fire.build();
    let standing = true;
    const items = [{ m: 'mat', e: 5, n: 5, tent: 0 }, { m: 'hearth', e: 10, n: 20, tent: 0 }, { m: 'hearth', e: 12, n: 20, tent: 1 }];
    const k = addCampHearths(fire, items, () => 1.5, t => (t === 0 ? standing : false));
    expect(k).toBe(2); expect(fire.fires.length).toBe(3);
    const flames = fire.group.children.find(o => (o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).count === 3);
    expect(flames).toBeTruthy();
    const h = fire.fires[1]; expect(h.pos.x).toBe(10); expect(h.pos.z).toBe(-20); expect(h.sched).toBe('home');
    const cam = new THREE.PerspectiveCamera();
    // evening, the sun just under the horizon: the meal fire burns where the tent stands, not where it does not
    fire.update(0, cam, -2, 1, 0, 0, 0, 19);
    expect(fire.fires[1].lit).toBe(true); expect(fire.fires[2].lit).toBe(false);
    standing = false; fire.update(0, cam, -2, 1, 0, 0, 0, 19);
    expect(fire.fires[1].lit).toBe(false);
    // noon: no meal fire even while the tent stands
    standing = true; fire.update(0, cam, 60, 1, 0, 0, 0, 12.5);
    expect(fire.fires[1].lit).toBe(false);
  });
});

import { townPorts } from '../src/world/firePlaces';
import { ROOM, COURT } from '../src/world/settlement/site';
describe('daylight ports (D-530)', () => {
  it('one port per doorway between a roofed room and the open, standing in the opening, its normal into the room', () => {
    // a 4 × 4 site: cells (1, 1) a room, (1, 2) a court; a door wall on their shared edge (v = 2) and one between two rooms
    const W = 4, Hh = 4, sub = new Uint8Array(W * Hh); sub[1 * W + 1] = ROOM; sub[2 * W + 1] = COURT; sub[1 * W + 2] = ROOM; sub[0 * W + 2] = ROOM;
    const s = { W, H: Hh, u0: 0, v0: 0, sub, grid: (u: number, v: number) => [u, v], walls: () => [{ u0: 1, v0: 2, u1: 2, v1: 2, door: true }, { u0: 2, v0: 1, u1: 3, v1: 1, door: true }, { u0: 0, v0: 3, u1: 1, v1: 3, door: false }] };
    const p = townPorts([s], () => 10);
    expect(p.length).toBe(5);
    expect(p[0]).toBeCloseTo(1.5); expect(p[1]).toBeCloseTo(11); expect(p[2]).toBeCloseTo(-2.15); // in the opening, a little toward the court
    expect(p[3]).toBeCloseTo(0); expect(p[4]).toBeCloseTo(1); // into the room: grid n falls (−v), world z = −n rises
  });
});
