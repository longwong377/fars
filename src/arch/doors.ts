// Working timber doors (D-051): the door leaves emitted by the generator (parts with `door`, openings.ts) drawn with their
// metal fittings, swung on their pivots, collided with, barred, sealed and saved. Sizes: SITE_SPEC global.r_door_leaf,
// r_door_sealing, r_door_schedule; states per building r_door_state. Everything here is reconstruction (C) except where a
// row says otherwise; the tiers ride on each mesh's userData for the dev overlay.
//  - A leaf swings between its closed and open azimuths (openings.ts) in r_door_leaf.swing_s seconds, eased; its kinematic
//    collider follows. A leaf does not move while the player or a person stands in the arc it is about to sweep.
//  - The visitor presses E facing a door within r_door_leaf.reach: it opens or closes. Barred (`locked`) and sealed doors
//    do not move; `door.id` / `door.locked` are the hooks for visitor-mode guards (brief §1).
//  - People open a closed, unbarred door as they pass (C): the walkable grid is built with every usable door open.
//  - Scheduled doors (Treasury N entrance, Hall of 99 Columns store) stand open in working hours and are barred or sealed
//    outside them, unless someone is at the door (the keeper lets them through).
import * as THREE from 'three/webgpu';
import { float } from 'three/tsl';
import type { Part, DoorLeafData, DoorState } from './parts';
import type { Physics } from '../player/physics';
import { v } from './spec';
import { surfaceMaterial } from '../render/materials';

type RB = ReturnType<Physics['world']['createRigidBody']>;
const LEAF = () => v<any>('global', 'r_door_leaf'), SEAL = () => v<any>('global', 'r_door_sealing'), SCHED = () => v<any>('global', 'r_door_schedule');
/** body radius of the player and the people (m) for the swing-arc check: the capsule radius used by physics and people */
const BODY_R = 0.25;
/** bosses are drawn only on leaves within this distance of the camera (m): 22 mm studs are under a pixel beyond it (C) */
export const BOSS_RANGE = 40;
/** the fittings' bronze reads black in shade with full metalness because the renderer has no environment reflection (the
 *  D-030 precedent for gilding), so it is drawn as a partly metallic surface (C) */
const BRONZE_METAL = 0.35;
export const DOOR_META = { tier: 'C', src: 'WP-EXT;RECON', placeholder: false, note: 'timber door leaves on pivot posts with bronze bands, bosses and pivot shoes (analogues: Gate pivot sockets, Near Eastern pivot doors, bronze-banded doors; C, D-051); timber species unknown' };

export type DoorResult = { id: string; result: 'opening' | 'closing' | 'locked' | 'sealed' | 'blocked' };
export interface DoorSave { [id: string]: { t: number; target: number; locked: boolean; sealed: boolean; manual: boolean } }
const ease = (t: number) => t * t * (3 - 2 * t);

export class Door {
  readonly leaves: DoorLeafData[] = [];
  readonly bodies: (RB | null)[] = [];
  /** barred shut (visitor-mode guards may set it); a barred door does not open */
  locked = false;
  /** clay sealing intact on the fastening; a sealed door does not open (breaking a seal is the keeper's business) */
  sealed = false;
  /** swing progress (0 closed, 1 open) and its target */
  t = 1; target = 1;
  /** moved by the visitor (a scheduled door then keeps the visitor's choice until its next change of hours) */
  manual = false;
  blockedNow = false;
  /** its leaves' matrices need rewriting */
  dirty = true;
  constructor(readonly id: string, readonly building: string, readonly base: DoorState) {}
  get scheduled() { return this.base === 'scheduled_locked' || this.base === 'scheduled_sealed'; }
  get moving() { return this.t !== this.target; }
  /** the leaf azimuth (grid, radians) at swing progress t */
  az(l: DoorLeafData, t = this.t) { return l.closedAz + (l.openAz - l.closedAz) * ease(t); }
  /** doorway centre (grid): midway between the pivots */
  centre(): [number, number] { const [a, b] = this.leaves; return b ? [(a.pivot[0] + b.pivot[0]) / 2, (a.pivot[1] + b.pivot[1]) / 2] : a.pivot; }
}

export class DoorSystem {
  readonly group = new THREE.Group();
  readonly doors = new Map<string, Door>();
  private leaves: { door: Door; l: DoorLeafData }[] = [];
  private slab: THREE.InstancedMesh; private band: THREE.InstancedMesh; private post: THREE.InstancedMesh; private shoe: THREE.InstancedMesh; private boss: THREE.InstancedMesh;
  private bossList: { leaf: number; x: number; y: number; z: number }[] = [];
  private seals: { door: Door; objs: THREE.Object3D[]; kind: 'seal' | 'bar' }[] = [];
  private lastCam = new THREE.Vector3(Infinity, 0, 0); private dirty = true; private lastHour = NaN;
  /** set by the world each frame: the visitor's feet (world) and the people on the Terrace (grid) */
  player: THREE.Vector3 | null = null; people: [number, number][] = [];
  /** swing counts for tests and the overlay */
  stats = { doors: 0, leaves: 0, moving: 0, bosses: 0 };

  constructor(parts: Part[], private phys?: Physics) {
    this.group.name = 'doors';
    for (const p of parts) if (p.type === 'box' && p.door) {
      const d = p.door; let door = this.doors.get(d.id);
      if (!door) { door = new Door(d.id, d.building, d.state); this.doors.set(d.id, door); this.initState(door); }
      door.leaves.push(d); this.leaves.push({ door, l: d });
    }
    const L = LEAF(), n = this.leaves.length;
    const timber = surfaceMaterial('timber'), bronze = (surfaceMaterial('bronze') as THREE.MeshStandardNodeMaterial).clone(); bronze.metalnessNode = float(BRONZE_METAL);
    const mk = (g: THREE.BufferGeometry, m: THREE.Material, count: number, name: string, shadow: boolean) => { const im = new THREE.InstancedMesh(g, m, Math.max(1, count)); im.name = name; im.userData = { ...DOOR_META }; im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false; this.group.add(im); return im; };
    this.slab = mk(new THREE.BoxGeometry(1, 1, 1), timber, n, 'doors:leaves', true);
    this.band = mk(new THREE.BoxGeometry(1, 1, 1), bronze, n * L.bands, 'doors:bands', true);
    this.post = mk(new THREE.CylinderGeometry(1, 1, 1, 12), timber, n, 'doors:posts', true);
    this.shoe = mk(new THREE.CylinderGeometry(1, 1, 1, 12), bronze, n, 'doors:shoes', false);
    let nb = 0; for (const { l } of this.leaves) nb += this.bossesPerFace(l) * 2 * L.bands;
    this.boss = mk(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), bronze, nb, 'doors:bosses', false); // hemisphere facing +z
    this.leaves.forEach(({ l }, i) => { for (let k = 0; k < L.bands; k++) { const y = (l.height * (k + 1)) / (L.bands + 1);
      for (let j = 0; j < this.bossesPerFace(l); j++) for (const z of [1, -1]) this.bossList.push({ leaf: i, x: L.boss_pitch / 2 + j * L.boss_pitch, y, z }); } });
    this.buildSeals();
    // kinematic colliders: one per leaf, turning about its pivot post
    if (phys) {
      const R = phys.R;
      for (const { door, l } of this.leaves) {
        const body = phys.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(l.pivot[0], l.y0 + l.height / 2, -l.pivot[1]));
        phys.world.createCollider(R.ColliderDesc.cuboid(l.len / 2, l.height / 2, l.thickness / 2).setTranslation(l.len / 2, 0, 0).setFriction(0.8), body);
        door.bodies.push(body);
      }
    }
    this.stats.doors = this.doors.size; this.stats.leaves = n;
    this.snapColliders(); this.sync(true);
  }
  private bossesPerFace(l: DoorLeafData) { return Math.max(0, Math.floor((l.len - LEAF().boss_pitch / 2) / LEAF().boss_pitch) + 1); }
  /** initial state from the building's r_door_state row (scheduled doors are set by the clock on the first update) */
  private initState(d: Door) {
    const open = d.base === 'open' || d.scheduled;
    d.t = d.target = open ? 1 : 0; d.locked = d.base === 'locked' || d.base === 'sealed'; d.sealed = d.base === 'sealed';
  }

  // ---------------- geometry ----------------
  /** leaf frame → world matrix: pivot at floor level, rotated to azimuth az (grid CCW = world rotation about +Y) */
  private frame(l: DoorLeafData, az: number) { return new THREE.Matrix4().makeRotationY(az).setPosition(l.pivot[0], l.y0, -l.pivot[1]); }
  private sync(all = false) {
    const L = LEAF(), m = new THREE.Matrix4(), s = new THREE.Matrix4();
    this.leaves.forEach(({ door, l }, i) => {
      if (!all && !door.dirty) return;
      const F = this.frame(l, door.az(l));
      this.slab.setMatrixAt(i, m.copy(F).multiply(s.makeTranslation(l.len / 2, l.height / 2, 0)).multiply(new THREE.Matrix4().makeScale(l.len, l.height, l.thickness)));
      for (let k = 0; k < L.bands; k++) { const y = (l.height * (k + 1)) / (L.bands + 1);
        this.band.setMatrixAt(i * L.bands + k, m.copy(F).multiply(s.makeTranslation(l.len / 2, y, 0)).multiply(new THREE.Matrix4().makeScale(l.len, L.band_h, l.thickness + 2 * L.band_t))); }
      this.post.setMatrixAt(i, m.copy(F).multiply(s.makeTranslation(0, l.height / 2, 0)).multiply(new THREE.Matrix4().makeScale(L.post_r, l.height, L.post_r)));
      const sr = L.post_r + 2 * L.band_t; // the shoe wraps the post foot
      this.shoe.setMatrixAt(i, m.copy(F).multiply(s.makeTranslation(0, L.shoe_h / 2, 0)).multiply(new THREE.Matrix4().makeScale(sr, L.shoe_h, sr)));
    });
    for (const d of this.doors.values()) d.dirty = false;
    this.slab.instanceMatrix.needsUpdate = this.band.instanceMatrix.needsUpdate = this.post.instanceMatrix.needsUpdate = this.shoe.instanceMatrix.needsUpdate = true;
    this.dirty = true;
  }
  /** bosses on the leaves near the camera (rebuilt when the camera moved or a leaf turned) */
  private syncBosses(cam: THREE.Vector3) {
    const L = LEAF(), m = new THREE.Matrix4(), s = new THREE.Matrix4(); let k = 0;
    const near = this.leaves.map(({ l }) => Math.hypot(l.pivot[0] - cam.x, -l.pivot[1] - cam.z) < BOSS_RANGE + l.len);
    for (const b of this.bossList) {
      if (!near[b.leaf]) continue;
      const { door, l } = this.leaves[b.leaf], F = this.frame(l, door.az(l));
      m.copy(F).multiply(s.makeTranslation(b.x, b.y, b.z * (l.thickness / 2 + L.band_t)));
      if (b.z < 0) m.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
      this.boss.setMatrixAt(k++, m.multiply(new THREE.Matrix4().makeScale(L.boss_r, L.boss_r, L.boss_r)));
    }
    this.boss.count = k; this.boss.instanceMatrix.needsUpdate = true; this.stats.bosses = k;
  }
  /** clay sealings (knobs, cord, lump) on the approach face of sealed doors and timber bars inside barred ones, at the
   *  closed pose; shown only while the door is shut and sealed / barred */
  private buildSeals() {
    const S = SEAL(), clay = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(0.56, 0.45, 0.34, THREE.SRGBColorSpace), roughness: 0.92 });
    const bronze = (surfaceMaterial('bronze') as THREE.MeshStandardNodeMaterial).clone(); bronze.metalnessNode = float(BRONZE_METAL);
    const timber = surfaceMaterial('timber');
    const sealMeta = { tier: 'C', src: 'MATCULT-R;RECON', placeholder: false, note: 'clay sealing over a cord wound between knobs on the door fastening, impressed with a seal (sealing practice B; the peg-and-cord door sealing C, Q-089); clay colour C' };
    for (const door of this.doors.values()) {
      if (door.leaves.length !== 2) continue;
      const canSeal = door.base === 'sealed' || door.base === 'scheduled_sealed', canBar = door.base === 'locked' || door.base === 'scheduled_locked';
      if (!canSeal && !canBar) continue;
      const [a, b] = door.leaves, o = a.outside, sign = canSeal ? 1 : -1; // sealing on the approach face, bar on the inner face
      const face = (l: DoorLeafData, along: number): THREE.Vector3 => { const dx = Math.cos(l.closedAz), dy = Math.sin(l.closedAz);
        const e = l.pivot[0] + dx * along + sign * o[0] * (l.thickness / 2), nn = l.pivot[1] + dy * along + sign * o[1] * (l.thickness / 2); return new THREE.Vector3(e, l.y0 + S.height, -nn); };
      const objs: THREE.Object3D[] = [];
      if (canSeal) {
        const ka = face(a, a.len - S.lump[0]), kb = face(b, b.len - S.lump[0]), out = new THREE.Vector3(o[0], 0, -o[1]);
        for (const k of [ka, kb]) { const knob = new THREE.Mesh(new THREE.SphereGeometry(S.knob_r, 10, 6), bronze); knob.position.copy(k).addScaledVector(out, S.knob_r * 0.5); knob.userData = sealMeta; objs.push(knob); }
        const mid = ka.clone().add(kb).multiplyScalar(0.5).addScaledVector(out, S.knob_r), len = ka.distanceTo(kb);
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(S.cord_r, S.cord_r, len, 6).rotateZ(Math.PI / 2), clay); cord.position.copy(mid); cord.lookAt(mid.clone().add(new THREE.Vector3().subVectors(kb, ka).cross(new THREE.Vector3(0, 1, 0)))); cord.userData = sealMeta; objs.push(cord);
        const lump = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), clay); lump.scale.set(S.lump[0] / 2, S.lump[1] / 2, S.lump[2] / 2); lump.position.copy(mid).addScaledVector(out, S.lump[2] / 4);
        lump.lookAt(lump.position.clone().add(out)); lump.userData = sealMeta; lump.name = `door-sealing:${door.id}`; objs.push(lump);
      } else {
        const pa = face(a, 0), pb = face(b, 0), mid = pa.clone().add(pb).multiplyScalar(0.5), inn = new THREE.Vector3(-o[0], 0, o[1]);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(pa.distanceTo(pb), S.bar[1], S.bar[0]), timber); bar.position.copy(mid).addScaledVector(inn, S.bar[0] / 2);
        bar.rotation.y = Math.atan2(-(pb.z - pa.z), pb.x - pa.x); bar.userData = { tier: 'C', src: 'RECON', placeholder: false, note: 'timber bar across the leaves of a barred door (C)' }; bar.name = `door-bar:${door.id}`; objs.push(bar);
      }
      for (const q of objs) { q.castShadow = true; q.receiveShadow = true; this.group.add(q); }
      this.seals.push({ door, objs, kind: canSeal ? 'seal' : 'bar' });
    }
  }

  // ---------------- simulation ----------------
  /** grid positions of whoever could be in a leaf's way: the visitor always; the people only while a leaf is closing (a
   *  door opened for someone swings clear of them: they step aside, C) */
  private bodiesAround(people: boolean): [number, number][] { const out: [number, number][] = people ? [...this.people] : []; if (this.player) out.push([this.player.x, -this.player.z]); return out; }
  /** would turning this door from t to its target sweep through someone? (the arc between the two azimuths, padded) */
  private sweepBlocked(door: Door) {
    const from = door.t, to = door.target; if (from === to) return false;
    for (const l of door.leaves) {
      const a0 = door.az(l, from), a1 = door.az(l, to), lo = Math.min(a0, a1), hi = Math.max(a0, a1);
      for (const [e, n] of this.bodiesAround(to < from)) {
        const dx = e - l.pivot[0], dy = n - l.pivot[1], r = Math.hypot(dx, dy); if (r > l.len + BODY_R || r < 1e-6) continue;
        const pad = Math.asin(Math.min(1, BODY_R / r));
        let a = Math.atan2(dy, dx); while (a < lo - Math.PI) a += 2 * Math.PI; while (a > hi + Math.PI) a -= 2 * Math.PI;
        for (const aa of [a, a - 2 * Math.PI, a + 2 * Math.PI]) if (aa >= lo - pad && aa <= hi + pad) return true;
      }
    }
    return false;
  }
  /** is someone at the doorway: within reach of the passage axis, from the leaf line through the wall (either side)? */
  private someoneAt(door: Door, list: [number, number][]) {
    const [ce, cn] = door.centre(), [tx, ty] = door.leaves[0].through, tt = tx * tx + ty * ty || 1, R = LEAF().reach;
    return list.some(([e, n]) => { const u = Math.min(1, Math.max(0, ((e - ce) * tx + (n - cn) * ty) / tt)); return Math.hypot(e - ce - tx * u, n - cn - ty * u) < R; });
  }
  /** set a door's target; false if it cannot move (barred, sealed) */
  private aim(door: Door, open: boolean) { if (open && (door.locked || door.sealed)) return false; door.target = open ? 1 : 0; return true; }
  update(dt: number, hour?: number) {
    const S = SCHED();
    for (const door of this.doors.values()) {
      // scheduled doors: open in working hours; barred or sealed outside them unless someone is at the door
      if (door.scheduled && hour !== undefined) {
        const inHours = hour >= S.open && hour < S.close, crossed = !Number.isNaN(this.lastHour) && (this.lastHour >= S.open && this.lastHour < S.close) !== inHours;
        if (crossed || Number.isNaN(this.lastHour)) door.manual = false;
        const waiting = this.someoneAt(door, this.people);
        if (inHours || waiting) { door.locked = false; door.sealed = false; if (!door.manual || waiting) this.aim(door, true); }
        else { this.aim(door, false); if (door.t === 0) { door.locked = true; door.sealed = door.base === 'scheduled_sealed'; } } // the keeper shuts it at night
      }
      // people open a closed, unbarred door as they pass (C)
      if (door.target === 0 && !door.locked && !door.sealed && this.someoneAt(door, this.people)) { this.aim(door, true); door.manual = false; }
      if (!door.moving) { door.blockedNow = false; continue; }
      door.blockedNow = this.sweepBlocked(door);
      if (door.blockedNow) continue;
      const step = dt / LEAF().swing_s;
      door.t = door.target > door.t ? Math.min(door.target, door.t + step) : Math.max(door.target, door.t - step);
      door.dirty = true;
      if (this.phys) door.leaves.forEach((l, i) => { const b = door.bodies[i]; if (b) { const a = door.az(l); b.setNextKinematicRotation({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }); } });
    }
    this.lastHour = hour ?? this.lastHour;
    this.sync();
    for (const s of this.seals) { const show = s.door.t === 0 && (s.kind === 'seal' ? s.door.sealed : s.door.locked); for (const o of s.objs) o.visible = show; }
    this.stats.moving = [...this.doors.values()].filter(d => d.moving).length;
  }
  /** per-frame view update (bosses near the camera) */
  view(cam: THREE.Vector3) { if (this.dirty || cam.distanceToSquared(this.lastCam) > 4) { this.lastCam.copy(cam); this.dirty = false; this.syncBosses(cam); } }
  /** snap every leaf's collider to its current pose (after load or construction) */
  private snapColliders() {
    for (const door of this.doors.values()) door.leaves.forEach((l, i) => { const b = door.bodies[i]; if (b) { const a = door.az(l), q = { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) }; b.setRotation(q, true); b.setNextKinematicRotation(q); } });
    (this.phys?.world as any)?.propagateModifiedBodyPositionsToColliders?.(); // scene queries see the new pose before the next step
  }

  // ---------------- interaction ----------------
  /** the door the camera is facing within reach: the look ray hits a leaf or the doorway between the pivots */
  facing(camera: THREE.Camera): Door | null {
    const o = camera.getWorldPosition(new THREE.Vector3()), dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    const ray = new THREE.Ray(o, dir), R = LEAF().reach, hit = new THREE.Vector3(); let best: Door | null = null, bd = R;
    const box = new THREE.Box3(), inv = new THREE.Matrix4();
    for (const door of this.doors.values()) {
      const [ce, cn] = door.centre(); if (Math.hypot(ce - o.x, -cn - o.z) > R + door.leaves[0].len * 2) continue;
      for (const l of door.leaves) { // the leaf's box in its own frame
        inv.copy(this.frame(l, door.az(l))).invert(); const lr = ray.clone().applyMatrix4(inv);
        box.min.set(0, 0, -l.thickness / 2); box.max.set(l.len, l.height, l.thickness / 2);
        if (lr.intersectBox(box, hit)) { const d = hit.applyMatrix4(this.frame(l, door.az(l))).distanceTo(o); if (d < bd) { bd = d; best = door; } }
      }
      if (door.leaves.length === 2) { // the doorway between the two pivots (to close an open door or knock on a shut one)
        const [a, b] = door.leaves, pa = new THREE.Vector3(a.pivot[0], a.y0, -a.pivot[1]), pb = new THREE.Vector3(b.pivot[0], b.y0, -b.pivot[1]);
        const nrm = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3(0, 1, 0)).normalize(), pl = new THREE.Plane().setFromNormalAndCoplanarPoint(nrm, pa);
        if (ray.intersectPlane(pl, hit)) { const u = new THREE.Vector3().subVectors(hit, pa).dot(new THREE.Vector3().subVectors(pb, pa)) / pa.distanceToSquared(pb), y = hit.y - a.y0, d = hit.distanceTo(o);
          if (u >= 0 && u <= 1 && y >= 0 && y <= a.height && d < bd) { bd = d; best = door; } }
      }
    }
    return best;
  }
  /** the visitor works the door in front of them (E): open ↔ close; barred and sealed doors do not move */
  use(camera: THREE.Camera): DoorResult | null { const d = this.facing(camera); return d ? this.toggle(d.id) : null; }
  toggle(id: string, open?: boolean): DoorResult | null {
    const d = this.doors.get(id); if (!d) return null;
    const want = open ?? d.target === 0;
    if (want && d.sealed) return { id, result: 'sealed' };
    if (want && d.locked) return { id, result: 'locked' };
    const prev = d.target; d.target = want ? 1 : 0;
    if (this.sweepBlocked(d)) { d.target = prev; return { id, result: 'blocked' }; }
    d.manual = true;
    return { id, result: want ? 'opening' : 'closing' };
  }

  // ---------------- persistence ----------------
  save(): DoorSave { const out: DoorSave = {}; for (const d of this.doors.values()) out[d.id] = { t: d.target, target: d.target, locked: d.locked, sealed: d.sealed, manual: d.manual }; return out; }
  load(s: DoorSave | null | undefined) {
    if (!s) return;
    for (const [id, q] of Object.entries(s)) { const d = this.doors.get(id); if (!d) continue; d.t = d.target = q.target; d.locked = q.locked; d.sealed = q.sealed; d.manual = q.manual; d.dirty = true; }
    this.snapColliders(); this.sync(true);
    for (const s2 of this.seals) { const show = s2.door.t === 0 && (s2.kind === 'seal' ? s2.door.sealed : s2.door.locked); for (const o of s2.objs) o.visible = show; }
  }
  /** out-of-world listing (tests, overlay) */
  list() { return [...this.doors.values()].map(d => ({ id: d.id, base: d.base, t: +d.t.toFixed(3), target: d.target, locked: d.locked, sealed: d.sealed, manual: d.manual, blocked: d.blockedNow, centre: d.centre() })); }
}
