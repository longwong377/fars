// The walls' lived-in wear that the merged house batches have no triangles left for (s17 C1, D-550; the near tiles stand at
// their 60 k gate): instanced soft decals on the lane faces, placed per house by its life (houseplan.ts lifeOf) and, for the
// fresh coat, by the simulation (RoofWear's source, D-462 roofOf):
//  - smoke over the street door: a house has no chimney; the smoke of its hearth and lamps leaves by the roof hole and the top
//    of the door, and blackens the plaster over the lintel in a plume, darker the older the house and the longer since its
//    plaster was renewed; the bakers', smiths' and potters' doors darkest (C: the region's vernacular, RECOLLECTION);
//  - the splashed foot either side of the doorway, where the household throws out its wash water (C);
//  - a fresh coat over the door and along the facade's top when the sim's roof was replastered this year (the plasterer skims
//    the parapet and the door's head with the roof: C).
// The decals' colours and alpha are written here (one MeshStandardNodeMaterial with a vertex opacity); the plaster's own look
// is the materials' (V2). Drawn within DRAW_R of the eye.
import * as THREE from 'three/webgpu';
import { attribute, float } from 'three/tsl';
import { hashString } from '../../core/rng';
import { HOUSE_KINDS } from './houseplan';
import { DOOR_H } from './site';
import type { SiteHouses } from './houses';

const DRAW_R = 90, FRESH = 0.93;
export interface DoorFace { plot: string; e: number; n: number; floor: number; lintel: number; yaw: number; soot: number; splash: number; top: number }
const h01 = (s: string, k: number) => hashString(`${s}:wear:${k}`) / 4294967296;

/** a soft decal in the wall's plane (x along the wall, y up, z out): `prof(t)` the half width at height t (0 bottom .. 1 top),
 *  its opacity falling to 0 at the edges and the top; unit height, lifted 4 mm off the wall */
function plume(prof: (t: number) => number, fadeBottom: boolean): THREE.BufferGeometry {
  const NX = 6, NY = 6, pos: number[] = [], op: number[] = [], idx: number[] = [];
  for (let j = 0; j <= NY; j++) { const t = j / NY, w = prof(t); for (let i = 0; i <= NX; i++) { const s = i / NX * 2 - 1, wob = 0.06 * Math.sin(t * 7 + i * 1.7);
    pos.push(s * w * (1 + wob), t, 0.004); op.push((1 - Math.abs(s) ** 2) * (1 - t ** 1.6) * (fadeBottom ? Math.min(1, t * 4) : 1)); } }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, k) => (k % 3 === 2 ? 1 : 0)), 3));
  g.setAttribute('aOp', new THREE.Float32BufferAttribute(op, 1)); g.setIndex(idx); g.computeBoundingSphere(); return g;
}

/** s17 C1 (D-550): the evening lamps at the street doors: a clay saucer lamp set on a peg in the wall beside the door, lit as
 *  the light fails and out an hour or two after dark (the fire system's 'home' schedule; its light and flame are the fire
 *  system's, V6), at about two houses in five, more of the better-off (C: lamps at doors by analogy with the region's
 *  vernacular, RECOLLECTION; saucer lamps B, Q-516). Grid e, n and the lamp's height */
export function doorLamps(hs: SiteHouses): { plot: string; e: number; n: number; y: number }[] {
  const s = hs.s, out: { plot: string; e: number; n: number; y: number }[] = [];
  for (const p of s.plots) { if (!HOUSE_KINDS.has(p.kind) || !p.door) continue; const L = hs.lives[p.idx], d = s.doorPoints(p); if (!L || !d) continue;
    if (h01(p.id, 10) > 0.25 + 0.35 * L.standing) continue;
    const nu = d.out[0] - d.inside[0], nv = d.out[1] - d.inside[1], t = p.outerT / 2 + 0.12, side = -(L.hinge ?? 1); // (beside the jamb away from the hinge)
    const u = d.mid[0] + nu * t - nv * side * 0.8, v = d.mid[1] + nv * t + nu * side * 0.8, [e, n] = s.grid(u, v);
    out.push({ plot: p.id, e, n, y: hs.base[p.idx] + 1.62 }); }
  return out;
}

export class WallWear {
  readonly group = new THREE.Group();
  readonly faces: DoorFace[] = [];
  private meshes: { soot: THREE.InstancedMesh; splash: THREE.InstancedMesh; fresh: THREE.InstancedMesh };
  private roofOf: ((plot: string) => number) | null = null;
  private lastDay = -1; private last: [number, number] = [1e9, 1e9];
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private up = new THREE.Vector3(0, 1, 0); private v = new THREE.Vector3(); private sc = new THREE.Vector3(); private c = new THREE.Color();
  readonly stats = { soot: 0, splash: 0, fresh: 0 };
  constructor(houses: SiteHouses[]) {
    this.group.name = 'wallwear';
    this.group.userData = { tier: 'C', src: 'RECON', note: 'the lane faces\' wear: smoke over the street doors, the splashed foot by the doorway, a fresh coat after a replastering (s17 C1, D-550)' };
    for (const hs of houses) { const s = hs.s;
      for (const p of s.plots) { if (!HOUSE_KINDS.has(p.kind) || !p.door) continue; const L = hs.lives[p.idx], d = s.doorPoints(p); if (!L || !d) continue;
        const nu = d.out[0] - d.inside[0], nv = d.out[1] - d.inside[1], t = p.outerT / 2 + 0.003, fu = d.mid[0] + nu * t, fv = d.mid[1] + nv * t; // (the lane face, outward unit normal)
        const [e, n] = s.grid(fu, fv), [e1, n1] = s.grid(fu + nu, fv + nv), floor = hs.base[p.idx];
        const craft = p.kind === 'workshop' && (p.craft === 'bakery' || p.craft === 'metal' || p.craft === 'kiln' || p.craft === 'pottery' || p.craft === 'brewery');
        const soot = Math.min(1, (craft ? 0.55 : 0.18) + 0.25 * L.age / 50 + 0.2 * Math.min(1, L.sincePlaster / 24) + 0.25 * h01(p.id, 1)) * (h01(p.id, 2) < (craft ? 1 : 0.7) ? 1 : 0);
        this.faces.push({ plot: p.id, e, n, floor, lintel: floor + DOOR_H + 0.1, yaw: Math.atan2(e1 - e, -(n1 - n)), soot, splash: h01(p.id, 3) < 0.55 ? 0.4 + 0.5 * h01(p.id, 4) : 0, top: floor + p.height + p.parapet }); } }
    const mat = (rough: number) => { const m = new THREE.MeshStandardNodeMaterial({ transparent: true, depthWrite: false, roughness: rough }); m.vertexColors = false;
      m.opacityNode = attribute('aOp', 'float').mul(float(1)); m.polygonOffset = true; m.polygonOffsetFactor = -3; return m; };
    const mk = (g: THREE.BufferGeometry, cap: number, name: string, rough: number) => { const m = new THREE.InstancedMesh(g, mat(rough), cap); m.count = 0; m.frustumCulled = false; m.receiveShadow = true; m.name = `wallwear:${name}`;
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); m.userData = this.group.userData; m.renderOrder = 2; this.group.add(m); return m; };
    // (the smoke: narrow at the lintel, widening as it rises; the splash: a low wide band; the fresh coat: a band, sharp-edged at its foot)
    // (s18 C2, D-667: the splash drawn in the soot's mesh, one draw fewer: tests/settlement_build's 45 meshes)
    const soot = mk(plume(t => 0.45 + 0.35 * t, false), 1200, 'soot', 0.9); this.meshes = { soot, splash: soot, fresh: mk(plume(() => 1, true), 300, 'fresh', 0.9) };
  }
  /** the simulation's roofs (RoofWear.source): a roof replastered this year brings a fresh coat over the door and the facade's top */
  setSource(roofOf: (plot: string) => number) { this.roofOf = roofOf; this.lastDay = -1; }
  update(day: number, eye: { x: number; z: number }, force = false): boolean {
    const ce = eye.x, cn = -eye.z; if (!force && day === this.lastDay && Math.hypot(ce - this.last[0], cn - this.last[1]) < 15) return false;
    this.lastDay = day; this.last = [ce, cn]; const { soot, splash, fresh } = this.meshes; let ns = 0, nw = 0, nf = 0; const later: (() => void)[] = [];
    const put = (M: THREE.InstancedMesh, k: number, f: DoorFace, y: number, w: number, h: number, rgb: [number, number, number], along = 0) => {
      this.q.setFromAxisAngle(this.up, f.yaw); const ax = Math.cos(f.yaw), az = -Math.sin(f.yaw); // (the wall's along direction in three's x, z)
      this.m4.compose(this.v.set(f.e + ax * along, y, -f.n + az * along), this.q, this.sc.set(w, h, 1)); M.setMatrixAt(k, this.m4); M.setColorAt(k, this.c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace)); };
    for (const f of this.faces) { if (Math.hypot(f.e - ce, f.n - cn) > DRAW_R) continue;
      const isFresh = this.roofOf ? this.roofOf(f.plot) > FRESH : false;
      if (isFresh && nf < fresh.instanceMatrix.count) { put(fresh, nf++, f, f.lintel - 0.12, 1.1, Math.max(0.3, f.top - f.lintel + 0.12), [0.86, 0.78, 0.65]); continue; } // (the new coat hides the old smoke)
      if (f.soot > 0.05 && ns < soot.instanceMatrix.count) { const g = 0.16 + 0.1 * (1 - f.soot); put(soot, ns++, f, f.lintel - 0.06, 0.55 + 0.35 * f.soot, 0.6 + 0.9 * f.soot, [g, g * 0.92, g * 0.85]); }
      if (f.splash > 0) for (const sd of [-1, 1]) { later.push(() => put(splash, ns + nw++, f, f.floor + 0.02, 0.45, 0.28 + 0.2 * f.splash, [0.34, 0.27, 0.2], sd * 1.05)); } }
    // (the splash right after the soot in the same mesh)
    for (const f of later) { if (ns + nw >= soot.instanceMatrix.count) break; f(); } ns += nw;
    for (const [M, n] of [[soot, ns], [fresh, nf]] as const) { M.count = n; M.visible = n > 0; if (n) { M.instanceMatrix.needsUpdate = true; M.instanceColor!.needsUpdate = true; } }
    // (soot's alpha: the plume's attribute times the instance's strength is carried by its colour's darkness: a lighter soot is paler, not thinner)
    this.stats.soot = ns - nw; this.stats.splash = nw; this.stats.fresh = nf; return true;
  }
}
