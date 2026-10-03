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
import { KIT, kitFrame } from './kit';
import { surfaceMaterial } from '../../render/materials';
import { hashString } from '../../core/rng';
import { DOOR_H } from './site';
import type { StreetDoor } from './houses';

export const DOOR_R = 220, DOOR_W = 1.0;
const MAXI = 700;
const h01 = (s: string) => hashString(s) / 4294967296;
/** how far open a street door stands (0 shut … 1 wide open against the vestibule wall) at a day, hour and sun altitude */
/** session 10: doors heard within this range (m) */
export const SOUND_R = 30;
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
  // D-311: planks, battens and pull from the Blender kit (tools/blender/housekit.py leaf0..2: 3/4/5 planks with their gaps,
  // grain warp and baked AO), scaled to the opening; the pivot post below stays a prism
  // (s17 C1, D-550: leaf3..5, the same three ages of wood in the kit's other three forms: tone by variant % 3)
  void n; void w; void box; const age = variant % 3; kitFrame(b, KIT[`leaf${KIT[`leaf${variant}`] ? variant : age}`], [0, 0, 0], [DOOR_W, 0, 0], [0, H, 0], [0, 0, 1], lin(tones[age][1]), -1, 1, 0.25);
  const post = lin(tones[age][2].map(x => x * 0.85) as RGB);
  const r = 0.045, sides = 8; for (let k = 0; k < sides; k++) { const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2;
    const p = (a: number, y: number) => [0.02 + Math.cos(a) * r, y, Math.sin(a) * r]; b.quadN(p(a0, -0.04), p(a1, -0.04), p(a1, DOOR_H + 0.06), p(a0, DOOR_H + 0.06), [Math.cos(a0), 0, Math.sin(a0)], [Math.cos(a1), 0, Math.sin(a1)], [Math.cos(a1), 0, Math.sin(a1)], [Math.cos(a0), 0, Math.sin(a0)], post, post, post, post, -1); }
  // a wooden pull and the bar's staple on the inside (the bar itself lies in the vestibule by day)
  return b.toGeometry();
}

export class TownDoors {
  readonly group = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private open: Float32Array; private target: Float32Array; private sched: Float32Array; private manual = new Map<number, { to: number; sched: number }>();
  private cols = new Map<number, any>(); private shown: number[][] = [[], [], [], [], [], []];
  private lastEye = new THREE.Vector3(1e9, 0, 0); private lastKey = '';
  readonly stats = { drawn: 0, shut: 0, colliders: 0 };
  /** session 10 (WORLD_INVENTORY GB55): a door within SOUND_R of the eye begins to swing ('door': the pivot turning in its stone
   *  socket) or comes shut ('door_shut'; `barred` at night: the bar dropped into its brackets); the world plays them (soundscape) */
  onSound: ((kind: 'door' | 'door_shut', pos: { x: number; y: number; z: number }, barred: boolean) => void) | null = null;
  private eye = new THREE.Vector3(); private night = false; private moving: Uint8Array;
  /** `variants`: how many leaf meshes (by the wood's age); the villages use one (D-254: a single draw, the plain's mesh budget) */
  constructor(readonly doors: StreetDoor[], private phys: Physics | null, private variants = 6, name = 'settlement:doors') {
    this.group.name = name;
    this.moving = new Uint8Array(doors.length); this.open = new Float32Array(doors.length).fill(-1); this.target = new Float32Array(doors.length); this.sched = new Float32Array(doors.length);
    const mat = surfaceMaterial(variants === 1 ? 'house_timber' : 'door_planks', { vertexColors: true }) as any; mat.aoNode = attribute('ao', 'float'); // (s17 C1: the town's leaves their own boarded surface)
    for (let v = 0; v < variants; v++) { const m = new THREE.InstancedMesh(leafGeometry(variants === 1 ? 1 : v), mat, MAXI); m.name = `${name === 'settlement:doors' ? 'settlement-doors' : name}:${v}`; m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; if (variants > 1) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXI * 3).fill(1), 3);
      m.userData = { tier: 'C', src: 'MESO-HOUSE-SX;RECON', note: 'street door leaves (D-234)', describe: () => ({ tier: 'C', src: 'MESO-HOUSE-SX;RECON', note: 'street door: a leaf of poplar planks on battens, turning on a pivot post in a stone socket (B analogue: Babylonian doors on doorposts in sockets of brick or stone, search extract); shut and barred at night, open, ajar or shut by day by the household (C)' }) };
      this.meshes.push(m); this.group.add(m); }
  }
  /** the leaf's mesh: the wood's age (0 grey old .. 2 fresh), and for the town (variants 6, s17 C1) one of the kit's two forms
   *  of that age by a hash of the door, so the doors of a lane differ */
  private variant(d: StreetDoor) { if (this.variants === 1) return 0; const a = d.wood < 0.35 ? 0 : d.wood < 0.7 ? 1 : 2; return this.variants >= 6 && hashString(`${d.id}:form`) / 4294967296 < 0.5 ? a + 3 : a; }
  /** s18 C2 (D-661, C12's holes audit #5: grey doors everywhere): a door's paint as a tint over its wood: most leaves bare
   *  weathered poplar, some painted red ochre, a blue-grey or a green-grey earth (C: painted woodwork with mineral earths is
   *  the region's; which household and what colour C), the paint worn by the wood's age */
  private paint(d: StreetDoor): THREE.Color { const h = (hashString(`${d.id}:paint`) % 1000) / 1000, wear = 0.55 + 0.45 * d.wood;
    const T: [number, number, number] = h < 0.6 ? [1, 1, 1] : h < 0.78 ? [1.25, 0.72, 0.6] : h < 0.9 ? [0.72, 0.86, 1.08] : h < 0.97 ? [0.86, 1.02, 0.84] : [1.3, 1.2, 1.0];
    return this._paint.setRGB(1 + (T[0] - 1) * wear, 1 + (T[1] - 1) * wear, 1 + (T[2] - 1) * wear); }
  private _paint = new THREE.Color();
  /** the leaf's yaw at openness f */
  private yaw(d: StreetDoor, f: number) { let da = d.openYaw - d.closedYaw; da = ((da + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return d.closedYaw + da * f; }
  update(dt: number, eye: THREE.Vector3, day: number, sunAlt: number, nearTile: (t: number) => boolean) {
    this.eye.copy(eye); this.night = sunAlt < -6;
    const key = `${day}|${Math.round(sunAlt * 2)}`;
    const moved = eye.distanceTo(this.lastEye) > 8, rescan = moved || key !== this.lastKey;
    if (rescan) { this.lastEye.copy(eye); this.lastKey = key; this.shown = [[], [], [], [], [], []];
      this.doors.forEach((d, i) => { const dx = d.hinge[0] - eye.x, dz = -d.hinge[1] - eye.z; if (dx * dx + dz * dz > DOOR_R * DOOR_R) return;
        const sched = doorOpenness(d.id, d.kind, day, sunAlt), m = this.manual.get(i); this.sched[i] = sched; if (m && Math.abs(m.sched - sched) > 1e-3) this.manual.delete(i);
        this.target[i] = this.manual.get(i)?.to ?? sched; if (this.open[i] < 0) this.open[i] = this.target[i]; this.shown[this.variant(d)].push(i); }); }
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1);
    let shut = 0, drawn = 0;
    for (let v = 0; v < this.meshes.length; v++) { const m = this.meshes[v], list = this.shown[v]; let n = 0;
      for (const i of list) { if (n >= MAXI) break; const d = this.doors[i];
        const t = this.target[i], o = this.open[i]; if (o !== t) { this.open[i] = Math.abs(t - o) < dt / 1.5 ? t : o + Math.sign(t - o) * dt / 1.5; // 1.5 s to swing
          if (this.onSound) { const px = d.hinge[0], pz = -d.hinge[1], near = (px - this.eye.x) ** 2 + (pz - this.eye.z) ** 2 < SOUND_R * SOUND_R;
            if (near && !this.moving[i]) this.onSound('door', { x: px, y: d.y + 1, z: pz }, false); // (it starts from rest)
            if (near && t < 0.02 && this.open[i] < 0.02) this.onSound('door_shut', { x: px, y: d.y + 1, z: pz }, this.night); }
          this.moving[i] = this.open[i] !== t ? 1 : 0; } else this.moving[i] = 0;
        q.setFromAxisAngle(up, this.yaw(d, this.open[i])); pos.set(d.hinge[0], d.y, -d.hinge[1]); scl.set(1, Math.min(1.02, d.h / (DOOR_H - 0.05)), 1); M.compose(pos, q, scl); if (this.variants > 1) m.setColorAt(n, this.paint(d)); m.setMatrixAt(n++, M); // the leaf cut to its doorway's lintel (s18 C2, D-660: the draw had slid into this comment in s15: no leaf was drawn)
        if (this.open[i] < 0.02) shut++;
        this.collider(i, d, this.open[i] < 0.05 && nearTile(d.tile)); }
      m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; drawn += n; }
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
