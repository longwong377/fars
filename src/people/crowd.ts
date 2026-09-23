// Crowd renderer: one skinned rig per person (17 bones), posed each frame from the simulation's activity, plus the
// props they hold and the objects their work needs (blocks being dressed, querns, sleeping mats) and the goods the
// simulation counts (sacks at the stair foot and in the Treasury store). Animation LOD: people far away are posed less
// often; the offmap (in the town) are hidden. PLACEHOLDER bodies (see body.ts).
import * as THREE from 'three/webgpu';
import { attribute, float } from 'three/tsl';
import { Rng } from '../core/rng';
import { makeSkeleton, bodyGeometry, randomAppearance, propGeometry, BONES, BoneName, Appearance } from './body';
import { pose } from './anim';
import { ACTIVITIES } from './activities';
import { PeopleSim, PLACES, Agent } from './sim';

const gw = (e: number, n: number, y: number) => new THREE.Vector3(e, y, -n);
const rad = (deg: number) => (deg * Math.PI) / 180;
/** world yaw for a grid heading (deg clockwise from grid north); the rig faces +Z in bind pose */
const yawOf = (headingDeg: number) => Math.PI - rad(headingDeg);

interface Rig { a: Agent; app: Appearance; root: THREE.Group; mesh: THREE.SkinnedMesh; bones: Record<BoneName, THREE.Bone>; props: Record<string, THREE.Mesh>; frame: number; lastHit: boolean }

export class Crowd {
  readonly group = new THREE.Group();
  readonly rigs: Rig[] = [];
  private material: THREE.MeshStandardNodeMaterial;
  private sackPiles: { depot: THREE.InstancedMesh; store: THREE.InstancedMesh };
  private frame = 0;
  onHit?: (kind: string, pos: THREE.Vector3) => void;
  constructor(readonly sim: PeopleSim, seed: number) {
    this.group.name = 'people';
    const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0 });
    m.colorNode = attribute('color', 'vec3'); m.roughnessNode = float(0.85); this.material = m;
    const propMat = (hex: number, rough = 0.8, metal = 0) => new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(hex), roughness: rough, metalness: metal });
    const PROP: Record<string, { g: THREE.BufferGeometry; m: THREE.Material }> = {
      spear: { g: propGeometry('spear')!, m: propMat(0x6b5236, 0.6) }, sack: { g: propGeometry('sack')!, m: propMat(0x9c8a68, 0.95) },
      jar: { g: propGeometry('jar')!, m: propMat(0xa0643c, 0.85) }, jar_head: { g: propGeometry('jar')!, m: propMat(0xa0643c, 0.85) },
      tablet: { g: propGeometry('tablet')!, m: propMat(0x8e7a5c, 0.9) }, mallet: { g: propGeometry('mallet')!, m: propMat(0x6b5236, 0.7) },
      basket: { g: propGeometry('basket')!, m: propMat(0x9a8452, 0.9) },
    };
    for (const a of sim.agents) {
      const app = randomAppearance(a.dress, new Rng(seed, `look:${a.id}`));
      const g = bodyGeometry(app); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.4);
      const { bones, skeleton, root } = makeSkeleton();
      const mesh = new THREE.SkinnedMesh(g, this.material); mesh.add(root); mesh.bind(skeleton); mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.name = `person:${a.id}`;
      mesh.userData = { tier: 'C', src: 'RECON', placeholder: true, note: `${a.name ?? 'unnamed'} (${a.role}, ${a.origin}); dress per MATERIAL_CULTURE; body PLACEHOLDER` };
      const r = new THREE.Group(); r.add(mesh); r.scale.setScalar(app.height); this.group.add(r);
      const props: Record<string, THREE.Mesh> = {};
      for (const [k, v] of Object.entries(PROP)) { const pm = new THREE.Mesh(v.g, v.m); pm.visible = false; pm.castShadow = true; r.add(pm); props[k] = pm; }
      this.rigs.push({ a, app, root: r, mesh, bones: Object.fromEntries(BONES.map((n, i) => [n, bones[i]])) as any, props, frame: a.id % 4, lastHit: false });
    }
    this.buildWorkObjects();
    const sackG = propGeometry('sack')!; const sackM = PROP.sack.m;
    const pile = (n: number) => { const im = new THREE.InstancedMesh(sackG, sackM, n); im.castShadow = true; im.receiveShadow = true; im.count = 0; im.frustumCulled = false; this.group.add(im); return im; };
    this.sackPiles = { depot: pile(200), store: pile(400) };
  }
  /** blocks at the masons' places, querns, mats (C forms) */
  private buildWorkObjects() {
    const stone = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0x8d8a84), roughness: 0.9 });
    const clay = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0x7c6a55), roughness: 0.95 });
    const reed = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(0xa08e62), roughness: 0.95 });
    const put = (g: THREE.BufferGeometry, m: THREE.Material, items: [THREE.Vector3, number][], name: string, note: string) => {
      if (!items.length) return; const im = new THREE.InstancedMesh(g, m, items.length); const q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), M = new THREE.Matrix4();
      items.forEach(([p, yaw], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw); im.setMatrixAt(i, M.compose(p, q, s)); });
      im.castShadow = im.receiveShadow = true; im.name = name; im.userData = { tier: 'C', src: 'RECON', note }; this.group.add(im); };
    const nav = this.sim.nav;
    const masons = this.sim.agents.filter(a => a.role === 'mason');
    put(new THREE.BoxGeometry(1.4, 0.75, 0.9).translate(0, 0.375, 0), stone, masons.map(a => { const e = a.slot[0], n = a.slot[1] + 0.95; return [gw(e, n, nav.heightAt(e, n) || 0), 0.1 * Math.sin(a.id)]; }), 'work:blocks', 'limestone blocks being dressed (C)');
    const grind = this.sim.agents.filter(a => a.role === 'grinder' || a.role === 'baker');
    put(new THREE.BoxGeometry(0.4, 0.14, 0.7).translate(0, 0.07, 0), stone, grind.map(a => { const e = a.slot[0] + 0.62, n = a.slot[1]; return [gw(e, n, nav.heightAt(e, n) || 0), Math.PI / 2]; }), 'work:querns', 'saddle querns (period type B, placement C)');
    const guards = this.sim.agents.filter(a => a.role === 'guard');
    put(new THREE.BoxGeometry(0.8, 0.03, 1.9).translate(0, 0.015, 0), reed, guards.map(a => [gw(a.slot[0], a.slot[1] + 0.2, (nav.heightAt(a.slot[0], a.slot[1]) || 0)), Math.PI]), 'work:mats', 'reed sleeping mats (C)');
    const o = PLACES.oven.at; put(new THREE.BoxGeometry(0.9, 0.2, 0.5).translate(0, 0.1, 0), clay, [[gw(o[0] - 1.5, o[1] - 0.6, nav.heightAt(o[0], o[1] - 0.6) || 0), 0.2]], 'work:trough', 'kneading trough (C)');
  }
  private pileLayout(im: THREE.InstancedMesh, centre: [number, number], count: number) {
    const n = Math.min(count, im.instanceMatrix.count); im.count = n; const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    const g0 = this.sim.nav.heightAt(centre[0], centre[1]) || 0; const per = 5 * 4;
    for (let i = 0; i < n; i++) { const layer = Math.floor(i / per), k = i % per, row = Math.floor(k / 5), col = k % 5;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 0.37) % 0.4 - 0.2); im.setMatrixAt(i, M.compose(gw(centre[0] + (col - 2) * 0.5 + layer * 0.1, centre[1] + (row - 1.5) * 0.4, g0 + 0.12 + layer * 0.26), q, s)); }
    im.instanceMatrix.needsUpdate = true;
  }
  private lastStock = { depot: -1, store: -1 };
  /** per-frame: place and pose everyone; `cam` for LOD and glances */
  /** pop-in log: a person appearing within 50 m in view (§13.8 fails the walkthrough on these) */
  onPopIn?: (what: string, d: number) => void;
  private frustum = new THREE.Frustum(); private pm = new THREE.Matrix4();
  update(time: number, cam: THREE.Vector3, playerPos: THREE.Vector3 | null, camera?: THREE.Camera) {
    if (camera) { this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pm); }
    this.frame++;
    const S = this.sim.stock;
    if (S.depot !== this.lastStock.depot) { this.pileLayout(this.sackPiles.depot, [PLACES.stair_foot.at[0] - 3, PLACES.stair_foot.at[1] - 2.5], S.depot); this.lastStock.depot = S.depot; }
    if (S.store !== this.lastStock.store) { this.pileLayout(this.sackPiles.store, [PLACES.treasury_store.at[0] - 4, PLACES.treasury_store.at[1] - 3], S.store); this.lastStock.store = S.store; }
    for (const r of this.rigs) {
      const a = r.a;
      const was = r.root.visible;
      r.root.visible = !a.offmap; if (a.offmap) continue;
      const p = gw(a.pos[0], a.pos[1], a.y); r.root.position.copy(p); r.root.rotation.y = yawOf(a.heading);
      const d = p.distanceTo(cam);
      if (!was && camera && d < 50 && this.frustum.containsPoint(p.clone().setY(p.y + 1))) this.onPopIn?.(`person ${a.id} (${a.role})`, d);
      const every = d < 40 ? 1 : d < 120 ? 2 : d < 300 ? 4 : 8;
      if ((this.frame + r.frame) % every !== 0) continue;
      const perf = this.sim.performance(a); const P = ACTIVITIES[perf.act];
      const po = pose(P.anim, time + a.seed % 100, a.gait, (a.seed % 1000) / 159);
      for (const n of BONES) { const e = po.rot[n]; r.bones[n].rotation.set(e ? e[0] : 0, e ? e[1] : 0, e ? e[2] : 0); }
      r.bones.hips.position.set(po.hips[0], 0.95 + po.hips[1], po.hips[2]);
      // glance at the player when close (people notice a stranger): head turns toward them, clamped
      if (playerPos && d < 7 && P.anim !== 'sleep') {
        const loc = r.root.worldToLocal(playerPos.clone()); const yaw = Math.atan2(loc.x, loc.z);
        if (Math.abs(yaw) < 1.9) r.bones.head.rotation.y = Math.max(-1.0, Math.min(1.0, yaw)) * (a.metPlayer > 1 ? 1 : 0.8);
      }
      // props
      for (const k in r.props) r.props[k].visible = false;
      const want = P.prop ?? (a.carry === 'sack' ? 'sack' : a.carry === 'jar_head' ? 'jar_head' : undefined);
      if (want && r.props[want]) this.placeProp(r, want);
      if (po.hit && !r.lastHit && d < 60) this.onHit?.(P.sound ?? 'chisel', p);
      r.lastHit = !!po.hit;
    }
  }
  private tmp = new THREE.Vector3();
  private placeProp(r: Rig, k: string) {
    const pm = r.props[k]; pm.visible = true; r.root.updateMatrixWorld(true);
    const local = (b: BoneName) => r.root.worldToLocal(r.bones[b].getWorldPosition(this.tmp.clone()));
    pm.rotation.set(0, 0, 0); pm.scale.setScalar(1);
    switch (k) {
      case 'spear': { const h = local('r_hand'); pm.position.set(h.x, 0, h.z + 0.02); break; } // upright, butt on the ground
      case 'sack': { const h = local('r_upper'); pm.position.set(h.x + 0.05, h.y + 0.12, h.z - 0.02); pm.rotation.set(0, 0, 0.3); break; }
      case 'jar': { const h = local('r_hand'); pm.position.set(h.x, h.y - 0.45, h.z + 0.1); break; }
      case 'jar_head': { const h = local('head'); pm.position.set(h.x, h.y + 0.26, h.z); pm.scale.setScalar(0.8); break; }
      case 'tablet': { const h = local('l_hand'); pm.position.set(h.x, h.y + 0.03, h.z + 0.04); break; }
      case 'mallet': { const h = local('r_hand'); pm.position.set(h.x, h.y + 0.02, h.z); pm.quaternion.copy(r.bones.r_hand.getWorldQuaternion(new THREE.Quaternion())).premultiply(r.root.getWorldQuaternion(new THREE.Quaternion()).invert()); break; }
      case 'basket': { const h = local('l_hand'), h2 = local('r_hand'); pm.position.set((h.x + h2.x) / 2, (h.y + h2.y) / 2 + 0.05, (h.z + h2.z) / 2); break; }
    }
  }
}
