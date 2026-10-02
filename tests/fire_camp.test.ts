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
