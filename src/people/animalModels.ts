// The animals' modelled bodies in the game (D-326; BLENDER_PLAN row 4). tools/blender/animals.mjs builds, per species, a
// Draco GLB with two levels (lod0 3.6-5.6 k triangles, the fowl and the hare 1.6 k; lod1 a fifth) sharing one UV layout,
// and two KTX2 maps: the albedo with the coat mask in its alpha (where the mask is 1 the game tints the albedo x 2 by the
// instance's coat colour: the hair's grain and the species' marks stay, the colour is the animal's own) and the tangent-space
// normal with the occlusion in its alpha, all baked in Cycles from the anatomy's dense source (src/people/animalForm.ts).
// This module loads them at startup (public/models/animals/manifest.json; the decoders are the pipeline's own,
// public/models/lib/), and gives the animals' instanced meshes (animals.ts) each level with the rig's vertex attributes
// computed from the anatomy (animalForm.rigWeights: the procedural rig's pivots and cycles drive the modelled body). A
// species whose model is absent, failed or switched off (?animals=0, ?models=0) draws its procedural stand-in.
import * as THREE from 'three/webgpu';
import type { Species } from './animals';
import { rigWeights } from './animalRig';

export interface AnimalAsset { inHash: string; class: string; files: Record<string, { bytes: number; sha256: string }>; tris: [number, number]; tex: number; lod1At: number; tier: string; src: string }
export interface AnimalModel { sp: Species; lods: THREE.BufferGeometry[]; albedo: THREE.Texture; nrm: THREE.Texture; lod1At: number; tris: number[] }
const MODELS = new Map<Species, AnimalModel>();
const LOAD = { ms: 0, loaded: [] as string[], failed: [] as string[], off: false, bytes: 0 };
export const animalModelStats = () => ({ ...LOAD, count: MODELS.size });
let rigged = new Set<Species>();

/** load every species of the manifest (browser). Never throws: a missing manifest or a failed species leaves the procedural
 *  stand-in in place (and says so in the stats). */
export async function loadAnimalModels(base = '/'): Promise<ReturnType<typeof animalModelStats>> {
  const t0 = performance.now();
  if (typeof location !== 'undefined') { const q = new URLSearchParams(location.search); if (q.get('animals') === '0' || q.get('models') === '0') { LOAD.off = true; return animalModelStats(); } }
  let man: { assets: Record<string, AnimalAsset> };
  try { const r = await fetch(base + 'models/animals/manifest.json'); if (!r.ok) throw new Error(`manifest ${r.status}`); man = await r.json(); }
  catch (e) { console.warn(`[animals] no manifest (${(e as Error).message}): procedural stand-ins drawn`); return animalModelStats(); }
  const [{ GLTFLoader }, { DRACOLoader }, { KTX2Loader }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js'), import('three/addons/loaders/KTX2Loader.js')]);
  const draco = new DRACOLoader().setDecoderPath(base + 'models/lib/draco/'), loader = new GLTFLoader().setDRACOLoader(draco);
  // the transcoder's target: the adapter's compressed formats (as render/models.ts: the world loads before it has a renderer)
  const ad = await (globalThis as any).navigator?.gpu?.requestAdapter?.().catch(() => null);
  const ktx = new KTX2Loader().setTranscoderPath(base + 'models/lib/basis/'); ktx.detectSupport({ isWebGPURenderer: true, hasFeature: (f: string) => !!ad?.features?.has(f) } as any);
  await Promise.all(Object.entries(man.assets).map(async ([sp, e]) => {
    try {
      const dir = base + 'models/animals/';
      const [g, albedo, nrm] = await Promise.all([loader.loadAsync(dir + `${sp}.glb`), ktx.loadAsync(dir + `${sp}_albedo.ktx2`), ktx.loadAsync(dir + `${sp}_nrm.ktx2`)]);
      const lods: THREE.BufferGeometry[] = [];
      for (const n of ['lod0', 'lod1']) { const m = g.scene.getObjectByName(n) as THREE.Mesh | undefined; if (!m?.isMesh) throw new Error(`level ${n} missing`); lods.push(m.geometry); }
      for (const t of [albedo, nrm]) { t.anisotropy = 8; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; }
      albedo.colorSpace = THREE.SRGBColorSpace; nrm.colorSpace = THREE.NoColorSpace;
      MODELS.set(sp as Species, { sp: sp as Species, lods, albedo, nrm, lod1At: e.lod1At, tris: e.tris }); LOAD.loaded.push(sp);
      LOAD.bytes += Object.values(e.files).reduce((a, f) => a + f.bytes, 0);
    } catch (err) { LOAD.failed.push(sp); console.warn(`[animals] ${sp}: ${(err as Error).message}; its procedural stand-in is drawn`); }
  }));
  draco.dispose(); ktx.dispose();
  LOAD.ms = Math.round(performance.now() - t0);
  if (typeof window !== 'undefined') (window as any).__animalModels = { stats: animalModelStats, species: () => [...MODELS.keys()] };
  return animalModelStats();
}
/** a species' model with its levels rigged (the rig attributes added once), or null (draw the stand-in) */
export function animalModel(sp: Species): AnimalModel | null {
  const m = MODELS.get(sp); if (!m) return null;
  if (!rigged.has(sp)) { for (const g of m.lods) rigLevel(sp, g); rigged.add(sp); }
  return m;
}
/** the rig's per-vertex attributes (aLeg, aPiv, aHT: animals.ts) on a level, from the anatomy's part distances */
export function rigLevel(sp: Species, g: THREE.BufferGeometry) {
  const P = g.getAttribute('position') as THREE.BufferAttribute, pos = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { pos[i * 3] = P.getX(i); pos[i * 3 + 1] = P.getY(i); pos[i * 3 + 2] = P.getZ(i); }
  const W = rigWeights(sp, pos);
  g.setAttribute('aLeg', new THREE.BufferAttribute(W.leg, 4)); g.setAttribute('aPiv', new THREE.BufferAttribute(W.piv, 4)); g.setAttribute('aHT', new THREE.BufferAttribute(W.ht, 4));
  return g;
}
/** tests and tools (node): register levels decoded elsewhere (tools/blender/lib/glb.mjs glbContent) */
export function setAnimalModel(m: AnimalModel) { MODELS.set(m.sp, m); rigged.delete(m.sp); }
export function clearAnimalModels() { MODELS.clear(); rigged = new Set(); }
