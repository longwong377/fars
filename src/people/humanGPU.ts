// GPU resources for the human crowd (D-025/D-026): the vertex-source texture (every body variant and fitted garment), the
// skin palettes (current and previous frame), the per-person data rows, and one instanced mesh per costume and LOD.
// All people of a costume and LOD are one draw call; the crowd fills the instance lists (slot, root, previous root)
// each frame for the people it decided to show at that LOD. Shadows: the drawn meshes cast none. Two shadow-only meshes
// per costume (on SHADOW_LAYER, which only the sun's shadow cameras see) carry everyone the crowd lets cast (within
// SHADOW_DIST, crowd.ts): the near caster (far-body geometry) for the full-detail people, the far caster (the farthest,
// simplified geometry) for the rest. They are drawn only into the cascades that start within SHADOW_CASCADE_REACH.
import * as THREE from 'three/webgpu';
import type { HumanAssets } from './humanAssets';
import type { OutfitBuild, CostumeLOD, Dress } from './outfits';
import { BUILT } from './outfits';
import { HumanMaterial, PERSON_TEXELS, type HumanTextures } from './humanMaterial';
import { NBONES, PALETTE_STRIDE } from './humanRig';

export const SOURCE_WIDTH = 2048;
export interface CostumeMesh { dress: Dress; lod: number; mesh: THREE.Mesh; geo: THREE.InstancedBufferGeometry; inst: THREE.InstancedInterleavedBuffer; count: number; triangles: number; box: THREE.Box3;
  /** the costume's shadow-only casters: near (far-body geometry) and far (the simplified farthest geometry) */
  shadow?: CostumeMesh; shadowFar?: CostumeMesh }
/** people cast shadows only into cascades whose near bound is within this distance (m) of the camera: casters stand
 *  within 90 m (SHADOW_DIST) and their shadows fall within ~40 m of them. An instanced caster's bounds span the whole
 *  crowd, so without this every caster was drawn whole into all four cascades (measured: 4 draws each) */
export const SHADOW_CASCADE_REACH = 130;
const LIGHTS: THREE.DirectionalLight[] = [];
/** false when `shadowCam` is a CSM cascade camera whose slice starts beyond SHADOW_CASCADE_REACH */
export function cascadeNeedsPeople(shadowCam: THREE.Camera) {
  for (const L of LIGHTS) { const n: any = (L.shadow as any).shadowNode; if (!n?.lights?.length || !n.camera) continue;
    const i = n.lights.findIndex((l: any) => l.shadow?.camera === shadowCam); if (i <= 0) continue;
    return (n.breaks[i - 1] ?? 0) * Math.min(n.camera.far, n.maxFar) < SHADOW_CASCADE_REACH; }
  return true;
}
/** layer of the shadow-only meshes: never drawn by the view camera, only by shadow cameras that enable it */
export const SHADOW_LAYER = 7;
/** let a light's shadow camera (and its cascades' cameras, if a CSM node is set) see the shadow-only people meshes.
 *  Call before the first render: CSMShadowNode clones the light's shadow camera (with its layers) when it initialises. */
export function shadowsSeePeople(light: THREE.DirectionalLight) {
  light.shadow.camera.layers.enable(0); light.shadow.camera.layers.enable(SHADOW_LAYER); if (!LIGHTS.includes(light)) LIGHTS.push(light);
  for (const l of ((light.shadow as any).shadowNode?.lights ?? []) as any[]) l.shadow?.camera?.layers.enable(SHADOW_LAYER);
}
/** floats per instance: slot, root (x, y, z, yaw), previous root */
export const INST_STRIDE = 9;

function dataTex(data: Float32Array, w: number, h: number) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
}

export class HumanGPU {
  readonly group = new THREE.Group();
  readonly costumes = new Map<string, CostumeMesh>();
  /** per costume: the shadow-only casters (near, far) */
  readonly shadows: CostumeMesh[] = [];
  readonly material: HumanMaterial;
  /** every material sampling the palette textures (repointed when they grow) */
  readonly materials: HumanMaterial[] = [];
  readonly textures: HumanTextures;
  /** skin palettes (character space) and person rows; the crowd writes them, commit() uploads */
  palette: Float32Array; prevPalette: Float32Array; person: Float32Array;
  capacity: number;
  private personDirty = true;
  constructor(readonly A: HumanAssets, readonly O: OutfitBuild, images: { skin: THREE.Texture; eye: THREE.Texture }, opts: { capacity?: number; velocity?: boolean; castShadow?: boolean } = {}) {
    this.group.name = 'people:humans';
    this.capacity = Math.max(16, opts.capacity ?? 256);
    const rows = Math.ceil(O.source.length / 4 / SOURCE_WIDTH);
    const src = new Float32Array(rows * SOURCE_WIDTH * 4); src.set(O.source);
    this.palette = new Float32Array(this.capacity * PALETTE_STRIDE); this.prevPalette = new Float32Array(this.capacity * PALETTE_STRIDE); this.person = new Float32Array(this.capacity * PERSON_TEXELS * 4);
    this.textures = {
      source: dataTex(src, SOURCE_WIDTH, rows), sourceWidth: SOURCE_WIDTH, NV: O.NV,
      bones: dataTex(this.palette, NBONES * 3, this.capacity), prevBones: dataTex(this.prevPalette, NBONES * 3, this.capacity), person: dataTex(this.person, PERSON_TEXELS, this.capacity),
      skin: images.skin, eye: images.eye,
    };
    this.material = new HumanMaterial(this.textures); this.materials.push(this.material);
    const shadowMat = new HumanMaterial(this.textures, { shadowOnly: true }); this.materials.push(shadowMat);
    const cast = opts.castShadow ?? true;
    for (const d of BUILT) {
      const list = O.costumes[d] ?? [];
      // shadow maps do not need fingers and eyelids (a cascade texel is 1–12 cm): the far body (≈2.5k triangles) casts for
      // the full-detail people, the farthest body (≈0.5k) for the rest; one draw per caster and near cascade
      const geo = list.find(c => c.lod === 2) ?? list.find(c => c.lod === 1), geoFar = list.find(c => c.lod === 3) ?? geo;
      const caster = (C: CostumeLOD, name: string) => { const m = this.makeMesh(C, shadowMat, true); m.mesh.name = name; m.mesh.layers.set(SHADOW_LAYER); m.mesh.receiveShadow = false;
        m.mesh.onBeforeShadow = (_r, _o, _c, shadowCam) => { if (!cascadeNeedsPeople(shadowCam)) m.geo.instanceCount = 0; }; // a draw of 0 instances is skipped
        m.mesh.onAfterShadow = () => { m.geo.instanceCount = m.count; };
        this.shadows.push(m); return m; };
      const sm = cast && geo ? caster(geo, `humans:${d}:shadow`) : null, sf = cast && geoFar ? caster(geoFar, `humans:${d}:shadow-far`) : null;
      for (const C of list) { const cm = this.makeMesh(C, this.material, false); if (sm) cm.shadow = sm; if (sf) cm.shadowFar = sf; this.costumes.set(`${d}@${C.lod}`, cm); }
    }
  }
  /** one instanced mesh for a costume LOD (plain Mesh + InstancedBufferGeometry: the material places every instance).
   *  Three interleaved vertex buffers (WebGPU allows 8): per-vertex floats (position, normal, uv, tid), per-vertex bytes
   *  (skin indices, weights, material, extras), per-instance floats (slot, root, previous root). */
  makeMesh(C: CostumeLOD, material: THREE.Material, castShadow: boolean, initial = 64): CostumeMesh {
    const g = new THREE.InstancedBufferGeometry(); const n = C.tid.length;
    const F = new Float32Array(n * 9); for (let i = 0; i < n; i++) { F.set(C.refPos.subarray(i * 3, i * 3 + 3), i * 9); F.set(C.refNrm.subarray(i * 3, i * 3 + 3), i * 9 + 3); F[i * 9 + 6] = C.uv[i * 2]; F[i * 9 + 7] = C.uv[i * 2 + 1]; F[i * 9 + 8] = C.tid[i]; }
    const fb = new THREE.InterleavedBuffer(F, 9);
    g.setAttribute('position', new THREE.InterleavedBufferAttribute(fb, 3, 0)); g.setAttribute('normal', new THREE.InterleavedBufferAttribute(fb, 3, 3));
    g.setAttribute('uv', new THREE.InterleavedBufferAttribute(fb, 2, 6)); g.setAttribute('tid', new THREE.InterleavedBufferAttribute(fb, 1, 8));
    const B = new Uint8Array(n * 16); for (let i = 0; i < n; i++) { B.set(C.skinIndex.subarray(i * 4, i * 4 + 4), i * 16); B.set(C.skinWeight.subarray(i * 4, i * 4 + 4), i * 16 + 4); B.set(C.hmat.subarray(i * 4, i * 4 + 4), i * 16 + 8); B.set(C.hext.subarray(i * 4, i * 4 + 4), i * 16 + 12); }
    const bb = new THREE.InterleavedBuffer(B, 16);
    g.setAttribute('skinIndex', new THREE.InterleavedBufferAttribute(bb, 4, 0, true)); g.setAttribute('skinWeight', new THREE.InterleavedBufferAttribute(bb, 4, 4, true));
    g.setAttribute('hmat', new THREE.InterleavedBufferAttribute(bb, 4, 8, true)); g.setAttribute('hext', new THREE.InterleavedBufferAttribute(bb, 4, 12, true));
    g.setIndex(new THREE.BufferAttribute(C.index, 1));
    const inst = this.instBuffer(g, initial);
    g.instanceCount = 0; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
    const mesh = new THREE.Mesh(g, material); mesh.name = `humans:${C.dress}:lod${C.lod}`; mesh.castShadow = castShadow; mesh.receiveShadow = true; mesh.visible = false; mesh.matrixAutoUpdate = false;
    mesh.userData = { tier: 'C', src: 'RECON', note: `people (${C.dress}, LOD ${C.lod})` };
    mesh.raycast = () => {}; // the geometry is in bind pose at the origin (placed on the GPU): picking goes through the crowd's proxy
    this.group.add(mesh);
    return { dress: C.dress, lod: C.lod, mesh, geo: g, inst, count: 0, triangles: C.triangles, box: new THREE.Box3() };
  }
  private instBuffer(g: THREE.InstancedBufferGeometry, n: number, copy?: Float32Array) {
    const a = new Float32Array(n * INST_STRIDE); if (copy) a.set(copy.subarray(0, Math.min(copy.length, a.length)));
    const ib = new THREE.InstancedInterleavedBuffer(a, INST_STRIDE, 1); ib.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iSlot', new THREE.InterleavedBufferAttribute(ib, 1, 0)); g.setAttribute('iRoot', new THREE.InterleavedBufferAttribute(ib, 4, 1)); g.setAttribute('iRootPrev', new THREE.InterleavedBufferAttribute(ib, 4, 5));
    return ib;
  }
  /** set one instance directly (the player's body) */
  setInstance(c: CostumeMesh, i: number, slot: number, root: number[], prev: number[]) { const a = c.inst.array as Float32Array; a[i * INST_STRIDE] = slot; a.set(root, i * INST_STRIDE + 1); a.set(prev, i * INST_STRIDE + 5); c.inst.needsUpdate = true; }
  /** start filling the instance lists for a frame */
  begin() { for (const c of this.all()) { c.count = 0; c.box.makeEmpty(); } }
  private *all() { yield* this.costumes.values(); yield* this.shadows; }
  /** add an instance; `cast`: also to the costume's near (1) or far (2) shadow caster, or none (0) */
  push(c: CostumeMesh, slot: number, x: number, y: number, z: number, yaw: number, px: number, py: number, pz: number, pyaw: number, cast = 1) {
    if ((c.count + 1) * INST_STRIDE > c.inst.array.length) c.inst = this.instBuffer(c.geo, c.inst.count * 2, c.inst.array as Float32Array);
    const a = c.inst.array as Float32Array, o = c.count++ * INST_STRIDE;
    a[o] = slot; a[o + 1] = x; a[o + 2] = y; a[o + 3] = z; a[o + 4] = yaw; a[o + 5] = px; a[o + 6] = py; a[o + 7] = pz; a[o + 8] = pyaw;
    c.box.expandByPoint(_v.set(x, y, z));
    const sc = cast === 1 ? c.shadow : cast === 2 ? c.shadowFar : undefined;
    if (sc) this.push(sc, slot, x, y, z, yaw, px, py, pz, pyaw, 0);
  }
  /** instance counts, bounds (frustum and shadow-cascade culling), uploads */
  end(uploadPrev: boolean) {
    for (const c of this.all()) {
      c.geo.instanceCount = c.count; c.mesh.visible = c.count > 0;
      if (!c.count) continue;
      c.inst.needsUpdate = true; c.inst.clearUpdateRanges(); c.inst.addUpdateRange(0, c.count * INST_STRIDE);
      c.box.getBoundingSphere(c.geo.boundingSphere!); c.geo.boundingSphere!.radius += 1.6; // person height and reach
    }
    this.textures.bones.needsUpdate = true; if (uploadPrev) this.textures.prevBones.needsUpdate = true;
    if (this.personDirty) { this.textures.person.needsUpdate = true; this.personDirty = false; }
  }
  markPersonDirty() { this.personDirty = true; }
  /** make room for more people: new textures (the material's texture nodes are repointed) */
  grow(capacity: number) {
    if (capacity <= this.capacity) return;
    const pal = new Float32Array(capacity * PALETTE_STRIDE), prev = new Float32Array(capacity * PALETTE_STRIDE), per = new Float32Array(capacity * PERSON_TEXELS * 4);
    pal.set(this.palette); prev.set(this.prevPalette); per.set(this.person);
    this.palette = pal; this.prevPalette = prev; this.person = per; this.capacity = capacity;
    const T = this.textures;
    for (const [k, data, w] of [['bones', pal, NBONES * 3], ['prevBones', prev, NBONES * 3], ['person', per, PERSON_TEXELS]] as const) {
      const old = T[k]; const t = dataTex(data, w, capacity); (T as any)[k] = t; for (const m of this.materials) m.retexture(old, t); old.dispose();
    }
    this.personDirty = true;
  }
  /** view-pass draws and triangles of the costumes, and the shadow casters' draws and triangles per shadow map (each
   *  cascade that contains them draws them again) */
  stats() { let draws = 0, tris = 0, people = 0, shadowDraws = 0, shadowTris = 0; const byLod = [0, 0, 0, 0];
    for (const c of this.costumes.values()) if (c.count) { draws++; tris += c.count * c.triangles; people += c.count; byLod[c.lod] += c.count; }
    for (const c of this.shadows) if (c.count) { shadowDraws++; shadowTris += c.count * c.triangles; }
    return { draws, triangles: tris, people, byLod, shadowDraws, shadowTriangles: shadowTris }; }
}
const _v = new THREE.Vector3();
