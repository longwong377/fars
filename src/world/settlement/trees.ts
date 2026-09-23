// Garden and orchard trees of the settlement (Phase 6). Species from settlement.json garden_planting (plane, cypress,
// pomegranate, olive: Maharlou pollen with Achaemenid arboriculture; fig, apple, pear, mulberry: PF fruits; vine: B
// species, C mix). Forms and sizes are C, and the trees are PLACEHOLDER-grade: low-poly crowns with procedural colour,
// not modelled foliage. Instanced per form with two distance levels; deciduous crowns thin out and turn to bare twig
// colour through the winter (LEAF_TABLE, C).
import * as THREE from 'three/webgpu';
import { attribute, mix, uniform, vec3, float, positionLocal, positionWorld, mx_noise_float, smoothstep } from 'three/tsl';
import type { TreeSpot } from './plan';
import { leafAt } from './town_rules';
import { DOY_AT_DAY0 } from '../season';
import { hashString } from '../../core/rng';
import { lin, RGB } from './geom';

type Form = 'broad' | 'small' | 'column' | 'vine';
const SPECIES: Record<string, { form: Form; h: number; r: number; trunk: number; col: RGB; decid: boolean }> = {
  plane: { form: 'broad', h: 15, r: 5.5, trunk: 0.35, col: [0.3, 0.4, 0.18], decid: true },
  cypress: { form: 'column', h: 12, r: 1.4, trunk: 0.2, col: [0.15, 0.23, 0.13], decid: false },
  pomegranate: { form: 'small', h: 3.6, r: 1.7, trunk: 0.09, col: [0.27, 0.37, 0.15], decid: true },
  fig: { form: 'small', h: 4.5, r: 2.4, trunk: 0.12, col: [0.29, 0.39, 0.17], decid: true },
  apple: { form: 'small', h: 5, r: 2.3, trunk: 0.12, col: [0.28, 0.38, 0.18], decid: true },
  pear: { form: 'small', h: 6, r: 2.0, trunk: 0.12, col: [0.27, 0.37, 0.18], decid: true },
  mulberry: { form: 'broad', h: 7, r: 3.2, trunk: 0.18, col: [0.28, 0.4, 0.16], decid: true },
  olive: { form: 'small', h: 5, r: 2.4, trunk: 0.16, col: [0.38, 0.42, 0.3], decid: false },
  vine: { form: 'vine', h: 1.6, r: 0.9, trunk: 0.05, col: [0.3, 0.4, 0.17], decid: true },
};
const NEAR = 160; // m: near/far switch (hysteresis 10 m)

function blob(detail: number, seed: number, squash = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail); const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 0.82 + 0.3 * (0.5 + 0.5 * Math.sin(x * 5.1 + seed) * Math.cos(z * 4.3 - seed) * Math.sin(y * 3.7 + seed * 2));
    p.setXYZ(i, x * k, y * k * squash, z * k); }
  g.deleteAttribute('uv'); g.computeVertexNormals(); return g;
}
function column(sides: number) {
  const prof: [number, number][] = [[0, -1], [0.75, -0.8], [1, -0.35], [0.85, 0.3], [0.45, 0.8], [0, 1]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), sides); g.deleteAttribute('uv'); g.computeVertexNormals(); return g;
}

export class TreeField {
  readonly group = new THREE.Group();
  private uLeaf = uniform(1);
  private sets: { form: Form; near: THREE.InstancedMesh; far: THREE.InstancedMesh; spots: { m: THREE.Matrix4; p: THREE.Vector3 }[]; level: Uint8Array; tint: Float32Array; dec: Float32Array }[] = [];
  private trunks!: THREE.InstancedMesh; private trunkM: { m: THREE.Matrix4; p: THREE.Vector3 }[] = []; private trunkLevel!: Uint8Array;
  private last = new THREE.Vector3(1e9, 0, 0);
  constructor(spots: TreeSpot[], H: (e: number, n: number) => number, quality = 'high') {
    this.group.name = 'settlement:trees';
    this.group.userData = { tier: 'C', src: 'SAEIDI2021;IR-FOODAG', note: 'garden and orchard trees: species B (pollen, PF fruits), forms, sizes and placement C; PLACEHOLDER foliage (low-poly crowns)', placeholder: true };
    const forms: Form[] = ['broad', 'small', 'column', 'vine'];
    const nearGeo: Record<Form, THREE.BufferGeometry> = { broad: blob(1, 1.3, 0.8), small: blob(1, 2.1, 0.85), column: column(8), vine: blob(0, 3.3, 0.7) };
    const farGeo: Record<Form, THREE.BufferGeometry> = { broad: blob(0, 1.3, 0.8), small: blob(0, 2.1, 0.85), column: column(4), vine: blob(0, 3.3, 0.7) };
    const mat = this.material();
    const trunkMat = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(0.3, 0.24, 0.18, THREE.SRGBColorSpace), roughness: 0.9 });
    for (const form of forms) {
      const list = spots.filter(s => (SPECIES[s.species] ?? SPECIES.pomegranate).form === form); if (!list.length) continue;
      const n = list.length, tint = new Float32Array(n * 3), dec = new Float32Array(n);
      const set = { form, near: null as any, far: null as any, spots: [] as { m: THREE.Matrix4; p: THREE.Vector3 }[], level: new Uint8Array(n).fill(1), tint, dec };
      list.forEach((s, i) => {
        const sp = SPECIES[s.species] ?? SPECIES.pomegranate, k = s.size, hh = hashString(s.c.join(',')) / 4294967296;
        const y = H(s.c[0], s.c[1]), h = sp.h * k, r = sp.r * k * (0.9 + 0.2 * hh);
        const crownH = form === 'column' ? h * 0.46 : form === 'vine' ? h * 0.45 : Math.min(r * 0.85, h * 0.4);
        const cy = y + h - crownH;
        const m = new THREE.Matrix4().compose(new THREE.Vector3(s.c[0], cy, -s.c[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hh * 6.28), new THREE.Vector3(r, crownH, r));
        set.spots.push({ m, p: new THREE.Vector3(s.c[0], cy, -s.c[1]) });
        const c = lin(sp.col); const v = 0.85 + 0.3 * hh; tint.set([c[0] * v, c[1] * v, c[2] * v], i * 3); dec[i] = sp.decid ? 1 : 0;
        if (form !== 'vine') { const th = cy - crownH * 0.6 - y; this.trunkM.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(s.c[0], y + th / 2 - 0.1, -s.c[1]), new THREE.Quaternion(), new THREE.Vector3(sp.trunk * k, th + 0.2, sp.trunk * k)), p: new THREE.Vector3(s.c[0], y, -s.c[1]) }); }
      });
      for (const lvl of ['near', 'far'] as const) {
        const g = (lvl === 'near' ? nearGeo : farGeo)[form].clone();
        g.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aDecid', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
        const im = new THREE.InstancedMesh(g, mat, n); im.castShadow = true; im.frustumCulled = true; im.receiveShadow = lvl === 'near'; im.name = `settlement:trees:${form}:${lvl}`; im.userData = this.group.userData;
        (set as any)[lvl] = im; this.group.add(im);
      }
      // bounds over all instances, once (a valid bound whatever the per-level count)
      for (const im of [set.near, set.far]) { list.forEach((_, i) => im.setMatrixAt(i, set.spots[i].m)); im.computeBoundingSphere(); }
      this.sets.push(set);
    }
    const tg = new THREE.CylinderGeometry(0.8, 1, 1, 6, 1, true); tg.deleteAttribute('uv');
    this.trunks = new THREE.InstancedMesh(tg, trunkMat, Math.max(1, this.trunkM.length)); this.trunks.castShadow = true; this.trunks.name = 'settlement:trees:trunks'; this.trunks.userData = this.group.userData;
    this.trunkM.forEach((t, i) => this.trunks.setMatrixAt(i, t.m)); this.trunks.computeBoundingSphere();
    this.trunkLevel = new Uint8Array(this.trunkM.length).fill(1);
    this.group.add(this.trunks);
    void quality;
    this.assignAll(new THREE.Vector3(0, 0, 0), true);
  }
  private material() {
    const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.92 });
    const tint = attribute('aTint', 'vec3'), dec = attribute('aDecid', 'float');
    const leaf = mix(float(1), this.uLeaf, dec);
    const n = mx_noise_float(positionWorld.mul(1.7)).mul(0.5).add(0.5), n2 = mx_noise_float(positionWorld.mul(6.0)).mul(0.5).add(0.5);
    const twig = vec3(0.24, 0.2, 0.16);
    m.colorNode = mix(twig.mul(n.mul(0.4).add(0.8)), tint.mul(n.mul(0.5).add(0.7)).mul(n2.mul(0.3).add(0.85)), smoothstep(0.1, 0.7, leaf));
    m.positionNode = positionLocal.mul(mix(float(0.62), float(1), leaf));
    return m;
  }
  /** distance level per instance; each level draws its instances packed at the front (count), attributes follow */
  private assignAll(cam: THREE.Vector3, force = false) {
    for (const s of this.sets) {
      let changed = force;
      for (let i = 0; i < s.spots.length; i++) { const d = s.spots[i].p.distanceTo(cam); const want = s.level[i] === 0 ? (d > NEAR + 10 ? 1 : 0) : (d < NEAR - 10 ? 0 : 1); if (want !== s.level[i]) { s.level[i] = want; changed = true; } }
      if (!changed) continue;
      for (const [lvl, im] of [[0, s.near], [1, s.far]] as const) {
        const ta = im.geometry.getAttribute('aTint') as THREE.InstancedBufferAttribute, da = im.geometry.getAttribute('aDecid') as THREE.InstancedBufferAttribute; let k = 0;
        for (let i = 0; i < s.spots.length; i++) { if (s.level[i] !== lvl) continue; im.setMatrixAt(k, s.spots[i].m); (ta.array as Float32Array).set(s.tint.subarray(i * 3, i * 3 + 3), k * 3); (da.array as Float32Array)[k] = s.dec[i]; k++; }
        im.count = k; im.visible = k > 0; im.instanceMatrix.needsUpdate = true; ta.needsUpdate = true; da.needsUpdate = true;
      }
    }
    let tc = force; for (let i = 0; i < this.trunkM.length; i++) { const want = this.trunkM[i].p.distanceTo(cam) < 400 ? 0 : 1; if (want !== this.trunkLevel[i]) { this.trunkLevel[i] = want; tc = true; } }
    if (tc) { let k = 0; for (let i = 0; i < this.trunkM.length; i++) if (this.trunkLevel[i] === 0) this.trunks.setMatrixAt(k++, this.trunkM[i].m); this.trunks.count = k; this.trunks.visible = k > 0; this.trunks.instanceMatrix.needsUpdate = true; }
  }
  update(camera: THREE.Camera, dayIndex: number, windMs: number) {
    this.uLeaf.value = leafAt(DOY_AT_DAY0 + dayIndex);
    const p = camera.position; if (p.distanceToSquared(this.last) > 25) { this.last.copy(p); this.assignAll(p); }
    void windMs;
  }
  stats() { let near = 0; for (const s of this.sets) for (const l of s.level) if (l === 0) near++; return { total: this.sets.reduce((a, s) => a + s.spots.length, 0), near, leaf: +this.uLeaf.value.toFixed(2) }; }
}
