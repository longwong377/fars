// GPU resources for the human crowd (D-025/D-026): the vertex-source texture (every body variant and fitted garment), the
// skin palettes (current and previous frame), the per-person data rows, and one instanced mesh per costume and LOD.
// All people of a costume and LOD are one draw call; the crowd fills the instance lists (slot, root, previous root)
// each frame for the people it decided to show at that LOD.
import * as THREE from 'three/webgpu';
import type { HumanAssets } from './humanAssets';
import type { OutfitBuild, CostumeLOD, Dress } from './outfits';
import { DRESSES } from './outfits';
import { HumanMaterial, PERSON_TEXELS, type HumanTextures } from './humanMaterial';
import { NBONES, PALETTE_STRIDE } from './humanRig';

export const SOURCE_WIDTH = 2048;
export interface CostumeMesh { dress: Dress; lod: number; mesh: THREE.Mesh; geo: THREE.InstancedBufferGeometry; inst: THREE.InstancedInterleavedBuffer; count: number; triangles: number; box: THREE.Box3;
  /** shadow-only caster drawn with the same instances (full-detail costumes cast with the mid-detail geometry) */
  shadow?: CostumeMesh }
/** floats per instance: slot, root (x, y, z, yaw), previous root */
export const INST_STRIDE = 9;

function dataTex(data: Float32Array, w: number, h: number) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
}

export class HumanGPU {
  readonly group = new THREE.Group();
  readonly costumes = new Map<string, CostumeMesh>();
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
    for (const d of DRESSES) for (const C of O.costumes[d] ?? []) {
      const cm = this.makeMesh(C, this.material, cast && C.lod > 0); this.costumes.set(`${d}@${C.lod}`, cm);
      // full-detail people cast their shadow with the mid-detail body (a shadow-only copy): shadow maps do not need
      // fingers and eyelids, and the full body would be drawn again in every cascade that contains it
      if (C.lod === 0 && cast) { const mid = O.costumes[d].find(c => c.lod === 1); if (mid) { const sm = this.makeMesh(mid, shadowMat, true); sm.mesh.name = `humans:${d}:lod0-shadow`; cm.shadow = sm; } }
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
  private *all() { for (const c of this.costumes.values()) { yield c; if (c.shadow) yield c.shadow; } }
  push(c: CostumeMesh, slot: number, x: number, y: number, z: number, yaw: number, px: number, py: number, pz: number, pyaw: number) {
    if ((c.count + 1) * INST_STRIDE > c.inst.array.length) c.inst = this.instBuffer(c.geo, c.inst.count * 2, c.inst.array as Float32Array);
    const a = c.inst.array as Float32Array, o = c.count++ * INST_STRIDE;
    a[o] = slot; a[o + 1] = x; a[o + 2] = y; a[o + 3] = z; a[o + 4] = yaw; a[o + 5] = px; a[o + 6] = py; a[o + 7] = pz; a[o + 8] = pyaw;
    c.box.expandByPoint(_v.set(x, y, z));
    if (c.shadow) this.push(c.shadow, slot, x, y, z, yaw, px, py, pz, pyaw);
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
  /** main-pass draws and triangles of the costumes; the shadow-only copies of full-detail people are counted apart
   *  (they are drawn in the main pass without colour or depth, and in the shadow cascades) */
  stats() { let draws = 0, tris = 0, people = 0, shadowDraws = 0, shadowTris = 0; const byLod = [0, 0, 0, 0];
    for (const c of this.costumes.values()) if (c.count) { draws++; tris += c.count * c.triangles; people += c.count; byLod[c.lod] += c.count; if (c.shadow) { shadowDraws++; shadowTris += c.count * c.shadow.triangles; } }
    return { draws, triangles: tris, people, byLod, shadowCopyDraws: shadowDraws, shadowCopyTriangles: shadowTris }; }
}
const _v = new THREE.Vector3();
