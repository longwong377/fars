// The town's street doors (D-234; was D-228's fixed-open box leaves). A leaf of poplar planks on two battens, turning on a
// pivot post whose foot sits in the stone socket inside the hinge jamb (houses.ts draws the socket, the threshold and the
// lintel). Drawn as instances for the doors within DOOR_R of the eye (three variants by the wood's age: 3 draws); a closed
// leaf within the near tiles is a collider. The household's hours (C, judgement): shut and barred from dusk to dawn (each
// house at its own moment, sun between −3° and −9°); by day, per house and per day, shut (the household out at the fields
// or the works, ~22 %), ajar or open. E works the door the visitor faces (as D-051's palace doors), until the household's
// own hours next change it. Not done: the town's drawn people do not open a shut door as they pass (their routes assume
// every street door open, as D-051's walkable grid does).
import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';
import type { Physics } from '../../player/physics';
import { Batch, lin, type RGB } from './geom';
import { surfaceMaterial } from '../../render/materials';
import { hashString } from '../../core/rng';
import { DOOR_H } from './site';
import type { StreetDoor } from './houses';

export const DOOR_R = 220, DOOR_W = 1.0;
const MAXI = 700;
const h01 = (s: string) => hashString(s) / 4294967296;
/** how far open a street door stands (0 shut … 1 wide open against the vestibule wall) at a day, hour and sun altitude */
export function doorOpenness(id: string, kind: string, day: number, sunAlt: number): number {
  const dusk = -3 - 6 * h01(id + ':dusk');
  if (sunAlt < dusk) return 0;
  const r = h01(`${id}:${day}`);
  if (kind === 'workshop' || kind === 'store' || kind === 'stable' || kind === 'station' || kind === 'official') return r < 0.1 ? 0 : 0.9;
  if (r < 0.22) return 0;
  if (r < 0.55) return 0.18 + 0.22 * h01(`${id}:${day}:a`);
  return 0.8 + 0.2 * h01(`${id}:${day}:o`);
}
/** a leaf: planks from the post (x = 0) across the opening (+x), battens on the inside (+z), the post into the lintel */
function leafGeometry(variant: number): THREE.BufferGeometry {
  const b = new Batch().addAttr('ao', 1, [0.9]);
  const tones: RGB[][] = [[[0.47, 0.44, 0.39], [0.5, 0.46, 0.4], [0.44, 0.41, 0.37], [0.49, 0.45, 0.4]], [[0.5, 0.42, 0.33], [0.53, 0.45, 0.35], [0.48, 0.4, 0.31], [0.51, 0.44, 0.34]], [[0.6, 0.49, 0.36], [0.58, 0.47, 0.34], [0.62, 0.51, 0.37], [0.57, 0.46, 0.33]]];
  const n = variant === 0 ? 3 : variant === 1 ? 4 : 5, H = DOOR_H - 0.05, w = (DOOR_W - 0.06) / n;
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: RGB) => b.box((x0 + x1) / 2, -(z0 + z1) / 2, 0, (x1 - x0) / 2, (z1 - z0) / 2, y0, y1, c, c, -1, true);
  for (let k = 0; k < n; k++) { const c = lin(tones[variant][k % 4]); box(0.05 + k * w + 0.003, 0.05 + (k + 1) * w - 0.003, 0.01 + (k % 2) * 0.012, H - (k % 3) * 0.01, -0.028, 0.028, c); }
  const bat = lin(tones[variant][1].map(x => x * 0.9) as RGB);
  for (const y of [0.32, H - 0.36]) box(0.08, DOOR_W - 0.04, y, y + 0.11, 0.028, 0.055, bat);
  const post = lin(tones[variant][2].map(x => x * 0.85) as RGB);
  const r = 0.045, sides = 8; for (let k = 0; k < sides; k++) { const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2;
    const p = (a: number, y: number) => [0.02 + Math.cos(a) * r, y, Math.sin(a) * r]; b.quadN(p(a0, -0.04), p(a1, -0.04), p(a1, DOOR_H + 0.06), p(a0, DOOR_H + 0.06), [Math.cos(a0), 0, Math.sin(a0)], [Math.cos(a1), 0, Math.sin(a1)], [Math.cos(a1), 0, Math.sin(a1)], [Math.cos(a0), 0, Math.sin(a0)], post, post, post, post, -1); }
  // a wooden pull and the bar's staple on the inside (the bar itself lies in the vestibule by day)
  box(DOOR_W - 0.2, DOOR_W - 0.14, 1.0, 1.14, 0.055, 0.09, bat);
  return b.toGeometry();
}

export class TownDoors {
  readonly group = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private open: Float32Array; private target: Float32Array; private sched: Float32Array; private manual = new Map<number, { to: number; sched: number }>();
  private cols = new Map<number, any>(); private shown: number[][] = [[], [], []];
  private lastEye = new THREE.Vector3(1e9, 0, 0); private lastKey = '';
  readonly stats = { drawn: 0, shut: 0, colliders: 0 };
  constructor(readonly doors: StreetDoor[], private phys: Physics | null) {
    this.group.name = 'settlement:doors';
    this.open = new Float32Array(doors.length).fill(-1); this.target = new Float32Array(doors.length); this.sched = new Float32Array(doors.length);
    const mat = surfaceMaterial('house_timber', { vertexColors: true }) as any; mat.aoNode = attribute('ao', 'float');
    for (let v = 0; v < 3; v++) { const m = new THREE.InstancedMesh(leafGeometry(v), mat, MAXI); m.name = `settlement-doors:${v}`; m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
      m.userData = { tier: 'C', src: 'MESO-HOUSE-SX;RECON', note: 'street door leaves (D-234)', describe: () => ({ tier: 'C', src: 'MESO-HOUSE-SX;RECON', note: 'street door: a leaf of poplar planks on battens, turning on a pivot post in a stone socket (B analogue: Babylonian doors on doorposts in sockets of brick or stone, search extract); shut and barred at night, open, ajar or shut by day by the household (C)' }) };
      this.meshes.push(m); this.group.add(m); }
  }
  private variant(d: StreetDoor) { return d.wood < 0.35 ? 0 : d.wood < 0.7 ? 1 : 2; }
  /** the leaf's yaw at openness f */
  private yaw(d: StreetDoor, f: number) { let da = d.openYaw - d.closedYaw; da = ((da + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return d.closedYaw + da * f; }
  update(dt: number, eye: THREE.Vector3, day: number, sunAlt: number, nearTile: (t: number) => boolean) {
    const key = `${day}|${Math.round(sunAlt * 2)}`;
    const moved = eye.distanceTo(this.lastEye) > 8, rescan = moved || key !== this.lastKey;
    if (rescan) { this.lastEye.copy(eye); this.lastKey = key; this.shown = [[], [], []];
      this.doors.forEach((d, i) => { const dx = d.hinge[0] - eye.x, dz = -d.hinge[1] - eye.z; if (dx * dx + dz * dz > DOOR_R * DOOR_R) return;
        const sched = doorOpenness(d.id, d.kind, day, sunAlt), m = this.manual.get(i); this.sched[i] = sched; if (m && Math.abs(m.sched - sched) > 1e-3) this.manual.delete(i);
        this.target[i] = this.manual.get(i)?.to ?? sched; if (this.open[i] < 0) this.open[i] = this.target[i]; this.shown[this.variant(d)].push(i); }); }
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1);
    let shut = 0, drawn = 0;
    for (let v = 0; v < 3; v++) { const m = this.meshes[v], list = this.shown[v]; let n = 0;
      for (const i of list) { if (n >= MAXI) break; const d = this.doors[i];
        const t = this.target[i], o = this.open[i]; if (o !== t) this.open[i] = Math.abs(t - o) < dt / 1.5 ? t : o + Math.sign(t - o) * dt / 1.5; // 1.5 s to swing
        q.setFromAxisAngle(up, this.yaw(d, this.open[i])); pos.set(d.hinge[0], d.y, -d.hinge[1]); scl.set(1, Math.min(1.02, d.h / (DOOR_H - 0.05)), 1); M.compose(pos, q, scl); // the leaf cut to its doorway's lintel m.setMatrixAt(n++, M);
        if (this.open[i] < 0.02) shut++;
        this.collider(i, d, this.open[i] < 0.05 && nearTile(d.tile)); }
      m.count = n; m.instanceMatrix.needsUpdate = true; drawn += n; }
    // colliders of doors no longer shown
    for (const [i] of this.cols) if (!this.shown[this.variant(this.doors[i])].includes(i)) this.collider(i, this.doors[i], false);
    this.stats.drawn = drawn; this.stats.shut = shut; this.stats.colliders = this.cols.size;
  }
  private collider(i: number, d: StreetDoor, on: boolean) {
    if (!this.phys) return; const c = this.cols.get(i);
    if (on && !c) { const a = d.closedYaw, cx = d.hinge[0] + Math.cos(a) * DOOR_W / 2, cz = -d.hinge[1] - Math.sin(a) * DOOR_W / 2;
      this.cols.set(i, this.phys.addBox({ x: cx, y: d.y + DOOR_H / 2, z: cz }, { x: DOOR_W / 2, y: DOOR_H / 2, z: 0.04 }, a)); }
    else if (!on && c) { this.phys.world.removeCollider(c, false); this.cols.delete(i); }
  }
  /** the door the camera faces within 2.2 m: toggled (the household's hours take over again when they next change) */
  use(camera: THREE.Camera): { id: string; result: 'opening' | 'closing' } | null {
    const p = new THREE.Vector3(), f = new THREE.Vector3(); camera.getWorldPosition(p); camera.getWorldDirection(f);
    let best = -1, bd = 2.2;
    this.doors.forEach((d, i) => { const a = this.yaw(d, Math.max(0, this.open[i])), cx = d.hinge[0] + Math.cos(a) * 0.5, cz = -d.hinge[1] - Math.sin(a) * 0.5, dx = cx - p.x, dz = cz - p.z, dist = Math.hypot(dx, dz);
      if (dist < bd && (dx * f.x + dz * f.z) / Math.max(1e-6, dist) > 0.5) { bd = dist; best = i; } });
    if (best < 0) return null; const d = this.doors[best], to = this.target[best] > 0.1 ? 0 : 0.95;
    this.manual.set(best, { to, sched: this.sched[best] }); this.target[best] = to; this.lastKey = '';
    return { id: d.id, result: to > 0 ? 'opening' : 'closing' };
  }
}
