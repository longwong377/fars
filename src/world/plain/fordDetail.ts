// The fords as real stone and hide near the eye (session 12, D-335; D-257's fords, plain/crossings.ts). The causeway was a run
// of 1 m box slabs and its stepping stones boxes: from the bank, a flight of pale steps across the river. Near a ford (within
// FORD_R) the causeway is paved with river cobbles (modelled in Blender, tools/blender/land_ford.py: 2 x 2 m tiles of 110 packed
// cobbles with their occlusion baked, three variants and levels), each stepping stone is a scanned boulder (the D-310 CC0
// scans, fitted to the stone's own box), and the Kur's round hide boat is the modelled one. The slabs and boxes stay under
// them (the colliders, and the ford far off). All C, as D-257.
import * as THREE from 'three/webgpu';
import { attribute, float, vec3 } from 'three/tsl';
import { propsFor, scanMaterial } from '../../render/scanProps';
import type { FordDetailSites } from './crossings';

export const FORD_R = { tiles: 260, steps: 260, boat: 700, lod: [9, 45] } as const;
export interface FordKit { tiles: THREE.BufferGeometry[][]; boat: THREE.BufferGeometry[] | null }
let KIT: FordKit | null = null;
export const fordKit = () => KIT;
export function _setFordKit(k: FordKit | null) { KIT = k; }
export async function loadFordKit(base = '/'): Promise<FordKit | null> {
  try {
    const man = await (await fetch(base + 'models/land/manifest.json')).json(), C = man.classes?.ford; if (!C) throw new Error('no ford class');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'), g = await new GLTFLoader().loadAsync(base + 'models/land/ford.glb');
    const lv = (id: string) => [0, 1, 2].map(l => { const m = g.scene.getObjectByName(`${id}__lod${l}`) as THREE.Mesh; if (!m?.isMesh) throw new Error(`${id} lod${l}`);
      m.updateMatrixWorld(true); const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k);
      if (!geo.getAttribute('color')) geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3).fill(0.3), 3));
      if (geo.getAttribute('color').itemSize === 4) { const a = geo.getAttribute('color'), c = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { c[i * 3] = a.getX(i); c[i * 3 + 1] = a.getY(i); c[i * 3 + 2] = a.getZ(i); } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
      geo.computeBoundingSphere(); return geo; });
    const ids = (C.pieces as { id: string; kind: string }[]);
    KIT = { tiles: ids.filter(p => p.kind === 'cobbles').map(p => lv(p.id)), boat: ids.some(p => p.id === 'coracle') ? lv('coracle') : null };
  } catch (e) { console.warn('[fords] no ford kit:', (e as Error).message); KIT = null; }
  return KIT;
}

interface Set_ { mesh: THREE.InstancedMesh; cap: number }
export class FordDetail {
  readonly group = new THREE.Group(); readonly active: boolean;
  private tiles: Set_[][] = []; private steps: Set_[][] = []; private boats: Set_[] = [];
  private last = { x: 1e9, z: 1e9 }; private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(); private v = new THREE.Vector3(); private s = new THREE.Vector3();
  stats = { tiles: 0, steps: 0, boats: 0, tris: 0 };
  private stepProps: { size: [number, number, number] }[] = [];
  constructor(private sites: FordDetailSites, kit: FordKit | null = fordKit()) {
    this.group.name = 'ford-detail'; this.active = !!kit;
    this.group.userData = { tier: 'C', src: 'HDT;RECON;POLYHAVEN-CC0', placeholder: !kit, note: kit ? 'the fords near the eye (D-335): the causeway paved with river cobbles (modelled, occlusion baked), the stepping stones as scanned boulders (CC0), the Kur\'s hide boat modelled; all C (D-257)' : 'PLACEHOLDER: the ford kit did not load; the causeway and stepping stones are boxes' };
    if (!kit) return;
    const vc = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0 }); vc.colorNode = attribute('color', 'vec3').mul(float(1)); vc.name = 'ford:cobbles';
    const mk = (g: THREE.BufferGeometry, mat: THREE.Material, cap: number, name: string, cast: boolean) => { const m = new THREE.InstancedMesh(g, mat, cap); m.count = 0; m.visible = false; m.frustumCulled = false; m.castShadow = cast; m.receiveShadow = true; m.name = name; m.userData = this.group.userData; this.group.add(m); return { mesh: m, cap }; };
    const cap = Math.max(1, sites.tiles.length);
    this.tiles = kit.tiles.map((L, v) => L.map((g, l) => mk(g, vc, Math.ceil(cap / kit.tiles.length) + 8, `ford-cobbles:${v}:lod${l}`, l < 2)));
    // the stepping stones: the D-310 boulder scans (their proportions kept, fitted to each stone's box), re-tinted to the cobbles' grey-brown
    const boulders = propsFor('boulder').filter(p => p.size[1] / Math.max(p.size[0], p.size[2]) > 0.3).slice(0, 3);
    this.stepProps = boulders.map(p => ({ size: p.size }));
    this.steps = boulders.map((p, v) => { const mat = scanMaterial(p, [0.19, 0.17, 0.14], { roughness: 0.8 }); return [0, 1].map(l => mk(p.lods[l], mat, Math.ceil(Math.max(1, sites.steps.length) / boulders.length) + 4, `ford-steps:${p.id}:lod${l}`, true)); });
    if (kit.boat) this.boats = kit.boat.map((g, l) => mk(g, vc, Math.max(1, sites.boats.length), `ford-boat:lod${l}`, l < 2));
    void vec3;
  }
  update(cam: THREE.Vector3, force = false): boolean {
    if (!this.active) return false;
    if (!force && Math.hypot(cam.x - this.last.x, cam.z - this.last.z) < 8) return false;
    this.last = { x: cam.x, z: cam.z };
    // nothing to do far from every ford
    const near = this.sites.fords.some(([x, , z]) => Math.hypot(x - cam.x, z - cam.z) < FORD_R.boat + 100);
    const lod = (d: number) => (d < FORD_R.lod[0] ? 0 : d < FORD_R.lod[1] ? 1 : 2);
    const reset = (sets: Set_[][]) => sets.forEach(L => L.forEach(S => { S.mesh.count = 0; }));
    reset(this.tiles); reset(this.steps); this.boats.forEach(S => { S.mesh.count = 0; });
    let nt = 0, ns = 0, nb = 0;
    if (near) {
      this.sites.tiles.forEach((t, i) => { const d = Math.hypot(t.x - cam.x, t.z - cam.z); if (d > FORD_R.tiles) return; const L = this.tiles[i % this.tiles.length], S = L[lod(d)]; if (S.mesh.count >= S.cap) return;
        this.e.set(0, t.yaw + (i % 4) * Math.PI / 2, 0, 'YXZ'); this.q.setFromEuler(this.e);
        // (the tile's pitch along the ford: about the axis across it)
        const qa = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-Math.sin(t.yaw), 0, -Math.cos(t.yaw)), -t.pitch); this.q.premultiply(qa);
        this.m4.compose(this.v.set(t.x, t.y, t.z), this.q, this.s.set(1, 1, 1)); S.mesh.setMatrixAt(S.mesh.count++, this.m4); nt++; });
      this.sites.steps.forEach((t, i) => { const d = Math.hypot(t.x - cam.x, t.z - cam.z); if (d > FORD_R.steps || !this.steps.length) return; const v = i % this.steps.length, S = this.steps[v][d < FORD_R.lod[1] ? 0 : 1]; if (S.mesh.count >= S.cap) return;
        const ps = this.stepProps[v].size; this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.yaw);
        this.m4.compose(this.v.set(t.x, t.y, t.z), this.q, this.s.set(t.s[0] / ps[0], t.s[1] / ps[1], t.s[2] / ps[2])); S.mesh.setMatrixAt(S.mesh.count++, this.m4); ns++; });
      this.sites.boats.forEach(t => { const d = Math.hypot(t.x - cam.x, t.z - cam.z); if (d > FORD_R.boat || !this.boats.length) return; const S = this.boats[lod(d)];
        this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.yaw); this.m4.compose(this.v.set(t.x, t.y, t.z), this.q, this.s.set(1, 1, 1)); S.mesh.setMatrixAt(S.mesh.count++, this.m4); nb++; });
    }
    let tris = 0;
    for (const S of [...this.tiles.flat(), ...this.steps.flat(), ...this.boats]) { S.mesh.visible = S.mesh.count > 0; S.mesh.instanceMatrix.needsUpdate = true; tris += S.mesh.count * ((S.mesh.geometry.index?.count ?? S.mesh.geometry.getAttribute('position').count) / 3); }
    this.stats = { tiles: nt, steps: ns, boats: nb, tris };
    return true;
  }
}
