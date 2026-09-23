// Working timber doors (D-051): leaves on the doorways that had doors, their swing (timing, arc, collider), barred and
// sealed doors, schedules, people opening doors as they pass, save/load, and the walkable-grid pose.
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildMeshes } from '../src/arch/meshes';
import type { Box, Part } from '../src/arch/parts';
import { Physics } from '../src/player/physics';
import { Player } from '../src/player/player';
import { DoorSystem } from '../src/arch/doors';
import { v } from '../src/arch/spec';

const { parts, doorways } = buildTerrace();
const leaves = parts.filter(p => p.type === 'box' && p.door) as Box[];
const L = v<any>('global', 'r_door_leaf'), SCH = v<any>('global', 'r_door_schedule');
let P: Physics; let doors: DoorSystem;
beforeAll(async () => {
  P = await Physics.create();
  buildMeshes(parts, P, { dynamicDoors: true }); doors = new DoorSystem(parts, P); P.step(1 / 60);
});
/** run the door system (and physics) for `s` seconds at 60 Hz */
const run = (s: number, hour = 10) => { for (let i = 0; i < Math.round(s * 60); i++) { doors.update(1 / 60, hour); P.step(1 / 60); } };
/** horizontal ray through a doorway, from the approach side into the hall at height h: distance to the first hit */
function through(id: string, h = 1.5) {
  // a quarter of the way across the opening (not through the gap between the meeting stiles at the centre)
  const d = doorways.find(q => q.id === id)!, back = d.depth / 2 + 1.5, s = d.width / 4, cx = d.c[0] + d.u[0] * s, cy = d.c[1] + d.u[1] * s;
  const o = { x: cx - d.n[0] * back, y: d.y0 + h, z: -(cy - d.n[1] * back) }, dir = { x: d.n[0], y: 0, z: -d.n[1] };
  const hit = P.world.castRay(new P.R.Ray(o, dir), 20, true); return hit ? hit.timeOfImpact : Infinity;
}

describe('door leaves (parts)', () => {
  it('two timber leaves on every doorway with a door state; none in the unfinished Tripylon and Hall of 100 Columns', () => {
    const ids = [...new Set(leaves.map(l => l.door!.id))];
    for (const id of ids) expect(leaves.filter(l => l.door!.id === id).length, id).toBe(2);
    expect(ids.filter(i => i.startsWith('tripylon') || i.startsWith('hall100'))).toEqual([]);
    for (const b of ['gate_nations', 'apadana', 'tachara', 'hadish', 'harem', 'treasury']) expect(ids.some(i => i.startsWith(b)), b).toBe(true);
    expect(ids.length).toBe(27); // Tachara 8 (D-130: the W, E and portico doorways of REF-PLAN), Apadana 4, Hadish 5, Harem 4, Gate 3, Treasury 3
    for (const l of leaves) { expect(l.material).toBe('timber'); expect(['A', 'B', 'C']).toContain(l.tier); expect(l.src.length).toBeGreaterThan(0); }
  });
  it('closed, the two leaves span the clear opening (gap r_door_leaf.gap at the meeting stiles)', () => {
    for (const d of doorways) {
      const ls = leaves.filter(l => l.door!.id === d.id).map(l => l.door!); if (!ls.length) continue;
      const tips = ls.map(l => [l.pivot[0] + Math.cos(l.closedAz) * l.len, l.pivot[1] + Math.sin(l.closedAz) * l.len]);
      expect(Math.hypot(tips[0][0] - tips[1][0], tips[0][1] - tips[1][1]), d.id).toBeCloseTo(L.gap, 6);
      expect(Math.hypot(ls[0].pivot[0] - ls[1].pivot[0], ls[0].pivot[1] - ls[1].pivot[1]), d.id).toBeCloseTo(d.width, 6);
    }
  });
  it('open, a leaf lies against the inner wall face (half turn) or stands into the hall (quarter turn), on the hall side, clear of every frame, wall and column', () => {
    const solid = parts.filter(p => p.type !== 'column' && p.solid !== false && !(p.type === 'box' && p.door) && p.kind !== 'floor' && p.kind !== 'platform' && p.kind !== 'floor_finish') as Part[];
    const cols = parts.filter(p => p.type === 'column') as any[];
    let halfTurns = 0;
    for (const l of leaves) {
      const d = l.door!, turn = Math.abs(d.openAz - d.closedAz);
      expect([Math.PI / 2, Math.PI].some(t => Math.abs(turn - t) < 1e-9), d.id).toBe(true); if (Math.abs(turn - Math.PI) < 1e-9) halfTurns++;
      // sample the open leaf's footprint and check it is inside no other solid box (touching allowed: 5 mm inset)
      const dx = Math.cos(d.openAz), dy = Math.sin(d.openAz);
      for (let a = 0.005; a < d.len; a += 0.1) for (const off of [-d.thickness / 2 + 0.005, d.thickness / 2 - 0.005]) {
        const x = d.pivot[0] + dx * a - dy * off, y = d.pivot[1] + dy * a + dx * off;
        for (const q of solid) if (q.type === 'box' && !q.rot && q.y0 < d.y0 + d.height && q.y1 > d.y0 + 0.01 && Math.abs(x - q.c[0]) < q.size[0] / 2 && Math.abs(y - q.c[1]) < q.size[1] / 2)
          throw new Error(`${d.id} leaf ${d.leaf} open overlaps ${q.building}:${q.kind} at (${x.toFixed(2)}, ${y.toFixed(2)})`);
        for (const c of cols) expect(Math.hypot(x - c.c[0], y - c.c[1]), `${d.id} vs column`).toBeGreaterThan(c.order.baseW / 2);
      }
    }
    expect(halfTurns).toBeGreaterThan(leaves.length * 0.8); // most leaves fold back against the wall
  });
  it('walkable-grid pose: open unless the door is permanently barred or sealed', () => {
    for (const l of leaves) { const d = l.door!; expect(d.navOpen, d.id).toBe(!(d.state === 'locked' || d.state === 'sealed'));
      const az = d.navOpen ? d.openAz : d.closedAz; expect(l.c[0], d.id).toBeCloseTo(d.pivot[0] + Math.cos(az) * d.len / 2, 6); expect(l.c[1], d.id).toBeCloseTo(d.pivot[1] + Math.sin(az) * d.len / 2, 6); }
  });
});

describe('door system: swing, collider, locks, schedules, people, save', () => {
  it(`a leaf swings closed in r_door_leaf.swing_s = ${L.swing_s} s (eased) and its collider follows`, () => {
    const id = 'tachara:S_main', d = doors.doors.get(id)!;
    const openHit = through(id);
    expect(doors.toggle(id, false)).toEqual({ id, result: 'closing' });
    run(L.swing_s / 2); expect(d.t).toBeCloseTo(0.5, 1);
    run(L.swing_s / 2 + 0.05); expect(d.t).toBe(0);
    const closedHit = through(id), dw = doorways.find(q => q.id === id)!;
    // the ray from 1.5 m outside the wall face meets the closed leaf just inside the hall (wall depth + frame + leaf)
    expect(closedHit).toBeCloseTo(1.5 + dw.depth + dw.proj, 1);
    expect(openHit).toBeGreaterThan(closedHit + 1);
    expect(doors.toggle(id, true)!.result).toBe('opening'); run(L.swing_s + 0.1); expect(d.t).toBe(1);
    expect(through(id)).toBeCloseTo(openHit, 3);
  });
  it('the visitor presses E facing a door within reach: it closes; out of reach nothing happens', () => {
    const dw = doorways.find(q => q.id === 'hadish:S')!, cam = new THREE.PerspectiveCamera();
    const stand = (dist: number) => { cam.position.set(dw.c[0] + dw.n[0] * (dw.depth / 2 + dist), dw.y0 + 1.6, -(dw.c[1] + dw.n[1] * (dw.depth / 2 + dist))); cam.lookAt(dw.c[0], dw.y0 + 1.6, -dw.c[1]); cam.updateMatrixWorld(); };
    stand(L.reach + 2); expect(doors.use(cam)).toBeNull();
    stand(1.2); expect(doors.use(cam)).toEqual({ id: 'hadish:S', result: 'closing' });
    run(L.swing_s + 0.1); expect(doors.doors.get('hadish:S')!.t).toBe(0);
    expect(doors.use(cam)).toEqual({ id: 'hadish:S', result: 'opening' }); run(L.swing_s + 0.1);
  });
  it('a leaf does not sweep through the visitor standing in its arc', () => {
    const id = 'harem:S', d = doors.doors.get(id)!, l = d.leaves[0], mid = d.az(l, 0.5);
    doors.player = new THREE.Vector3(l.pivot[0] + Math.cos(mid) * l.len * 0.6, 1, -(l.pivot[1] + Math.sin(mid) * l.len * 0.6));
    expect(doors.toggle(id, false)!.result).toBe('blocked');
    doors.player = null; expect(doors.toggle(id, false)!.result).toBe('closing'); run(0.2);
    doors.player = new THREE.Vector3(l.pivot[0] + Math.cos(mid) * l.len * 0.6, 1, -(l.pivot[1] + Math.sin(mid) * l.len * 0.6));
    const t0 = d.t; run(1); expect(d.t, 'waits for the visitor to step out').toBeCloseTo(t0, 6);
    doors.player = null; run(L.swing_s); expect(d.t).toBe(0);
    doors.toggle(id, true); run(L.swing_s + 0.1);
  });
  it('the Treasury E door is barred and sealed: it does not open, and its clay sealing shows', () => {
    const d = doors.doors.get('treasury:E')!; expect(d.t).toBe(0); expect(d.sealed).toBe(true);
    expect(doors.toggle('treasury:E', true)).toEqual({ id: 'treasury:E', result: 'sealed' }); run(1); expect(d.t).toBe(0);
    expect(through('treasury:E')).toBeLessThan(doorways.find(q => q.id === 'treasury:E')!.depth + 1.5 + 0.2);
    const seal = doors.group.getObjectByName('door-sealing:treasury:E')!; expect(seal.visible).toBe(true); expect(seal.userData.tier).toBe('C');
  });
  it('scheduled doors: the Hall of 99 Columns store is sealed and the Treasury entrance barred at night; open in working hours; the keeper lets people through', () => {
    const store = doors.doors.get('treasury:hall99')!, gate = doors.doors.get('treasury:N')!;
    run(0.2, SCH.open + 1); expect(store.target).toBe(1); expect(store.sealed).toBe(false);
    run(L.swing_s + 0.2, SCH.close + 2); expect(store.t).toBe(0); expect(store.sealed).toBe(true); expect(gate.t).toBe(0); expect(gate.locked).toBe(true);
    expect(doors.group.getObjectByName('door-sealing:treasury:hall99')!.visible).toBe(true);
    expect(doors.group.getObjectByName('door-bar:treasury:N')!.visible).toBe(true);
    expect(doors.toggle('treasury:N', true)!.result).toBe('locked');
    const gw = doorways.find(q => q.id === 'treasury:N')!; // someone in the street at the door at night: let through
    doors.people = [[gate.centre()[0] - gw.n[0] * (gw.depth + 1), gate.centre()[1] - gw.n[1] * (gw.depth + 1)]]; expect(doors['someoneAt'](gate, doors.people)).toBe(true);
    run(L.swing_s + 0.2, SCH.close + 2); expect(gate.t).toBe(1);
    doors.people = []; run(L.swing_s + 0.2, SCH.close + 2); expect(gate.t).toBe(0); expect(gate.locked).toBe(true);
    // the visitor: let through the barred entrance at night (observer mode), never into the sealed store from outside, and
    // not sealed in: the store stays open while the visitor is inside
    const at = (id: string, k: number) => { const d = doorways.find(q => q.id === id)!; const c = doors.doors.get(id)!.centre(); return new THREE.Vector3(c[0] - d.n[0] * k, 0.5, -(c[1] - d.n[1] * k)); };
    doors.player = at('treasury:N', 3); run(L.swing_s + 0.2, SCH.close + 2); expect(gate.t).toBe(1);
    doors.player = null; run(L.swing_s + 0.2, SCH.close + 2); expect(gate.t).toBe(0);
    const sd = doorways.find(q => q.id === 'treasury:hall99')!; // swings out: n points north (out), the store lies on −n… flipped in hang(); its passage vector points into the store
    const inStore = store.leaves[0].through, c99 = store.centre();
    doors.player = new THREE.Vector3(c99[0] + inStore[0] * 4, 0.5, -(c99[1] + inStore[1] * 4)); run(L.swing_s + 0.2, SCH.close + 2);
    expect(store.t, 'the keeper waits while the visitor is inside the store').toBe(1);
    doors.player = new THREE.Vector3(c99[0] - inStore[0] * 1.5, 0.5, -(c99[1] - inStore[1] * 1.5)); run(L.swing_s + 0.2, SCH.close + 2);
    expect(store.t, 'sealed once the visitor is out').toBe(0); expect(store.sealed).toBe(true);
    expect(doors.toggle('treasury:hall99', true)!.result).toBe('sealed'); void sd;
    doors.player = null;
    run(L.swing_s + 0.2, SCH.open + 0.5); expect(store.t).toBe(1); expect(gate.t).toBe(1); expect(store.sealed).toBe(false);
  });
  it('people open a closed door as they pass', () => {
    const id = 'apadana:N', d = doors.doors.get(id)!;
    doors.toggle(id, false); run(L.swing_s + 0.1); expect(d.t).toBe(0);
    doors.people = [[d.centre()[0], d.centre()[1] + 1.5]]; run(L.swing_s + 0.1); expect(d.t).toBe(1); doors.people = [];
  });
  it('the player cannot walk through a shut door and walks through an open one', () => {
    const id = 'hadish:E', dw = doorways.find(q => q.id === id)!, d = doors.doors.get(id)!;
    const walk = () => { const x0 = dw.c[0] - dw.n[0] * (dw.depth / 2 + 2), y0 = dw.c[1] - dw.n[1] * (dw.depth / 2 + 2);
      const pl = new Player(P, x0, dw.y0 + 0.05, -y0); const yaw = Math.atan2(-dw.n[0], dw.n[1]); // toward the hall
      for (let i = 0; i < 60 * 5; i++) { pl.update(1 / 60, { forward: 1, right: 0, run: false, yaw, pitch: 0 }); doors.update(1 / 60, 10); P.step(1 / 60); }
      const p = pl.position, gone = (p.x - dw.c[0]) * dw.n[0] + (-p.z - dw.c[1]) * dw.n[1]; P.world.removeRigidBody(pl.body); return gone; };
    doors.toggle(id, false); run(L.swing_s + 0.1); expect(d.t).toBe(0);
    expect(walk(), 'stopped at the closed leaf').toBeLessThan(dw.depth / 2 + dw.proj);
    doors.toggle(id, true); run(L.swing_s + 0.1);
    expect(walk(), 'through the open doorway into the hall').toBeGreaterThan(dw.depth / 2 + 1);
  });
  it('door states are saved and restored with the world', () => {
    doors.toggle('harem:W', false); run(L.swing_s + 0.1);
    const saved = JSON.parse(JSON.stringify(doors.save()));
    expect(saved['harem:W']).toMatchObject({ target: 0, manual: true });
    doors.toggle('harem:W', true); run(L.swing_s + 0.1); expect(doors.doors.get('harem:W')!.t).toBe(1);
    doors.load(saved); expect(doors.doors.get('harem:W')!.t).toBe(0); P.step(1 / 60); // scene queries refresh on the step
    expect(through('harem:W')).toBeLessThan(doorways.find(q => q.id === 'harem:W')!.depth + 1.5 + 0.3);
    doors.toggle('harem:W', true); run(L.swing_s + 0.1);
  });
  it('meshes carry tier metadata; bosses only near the camera', () => {
    doors.group.traverse(o => { if ((o as any).isMesh) { expect(['A', 'B', 'C'], o.name).toContain(o.userData.tier); expect(String(o.userData.note).length).toBeGreaterThan(10); } });
    doors.view(new THREE.Vector3(-21.3, 3, 90)); const near = doors.stats.bosses; expect(near).toBeGreaterThan(50);
    doors.view(new THREE.Vector3(-600, 3, -122)); expect(doors.stats.bosses).toBe(0);
  });
});
