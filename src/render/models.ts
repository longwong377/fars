// Blender-built models in the game (D-305). tools/blender/build.mjs writes public/models/<id>.glb (Draco geometry, UVs,
// MikkTSpace tangents, one packed map per level: RGB = tangent-space normal, A = ambient occlusion; KTX2 when the build had
// the KTX tools) and public/models/manifest.json. This module loads them at startup (three's GLTFLoader with the Draco and
// KTX2 decoders served from public/models/lib/, never a CDN), keeps their levels as geometry, and gives the builders:
//  - model(id): the levels and maps, or null when the model is absent, failed or switched off (?models=0): the builder then
//    draws its procedural stand-in, so the world never lacks the object;
//  - fitLevel(): a level fitted to a box as the procedural pieces are (sculpt.ts fitTo: per-axis scale + offset), its
//    normals and tangents transformed with it;
//  - bakedMaterial(): the surface the object is made of (materials.ts surfaceMaterial: the measured albedo, the procedural
//    layers, the scans, the weather), with the baked normal map under the surface's own fine relief and the baked occlusion
//    on the indirect light (aoNode), so the map adds the carving the triangles cannot carry and nothing else.
// A/B in the browser: window.__models.ab(false) swaps every model's instances back to the procedural geometry and material
// (same instances, same frame), ab(true) returns them (tests/e2e/blender_hero.spec.ts renders both).
import * as THREE from 'three/webgpu';
import { texture, uv, normalMap, normalView } from 'three/tsl';
import { surfaceMaterial } from './materials';

export interface ModelLevel { name: string; tris: number; verts: number; attrs: string[]; map: { w: number; h: number; format: string; bytes: number } | null; ao_mean: number }
export interface ModelEntry { file: string; inHash: string; outHash: string; bytes: number; gpuBytes: number; textures: 'png' | 'ktx2'; lods: ModelLevel[]; tier: string; src: string; blender: string; device: string }
export interface ModelManifest { about: string; assets: Record<string, ModelEntry> }
export interface Model { id: string; entry: ModelEntry; lods: THREE.BufferGeometry[]; maps: THREE.Texture[] }

const MODELS = new Map<string, Model>();
const LOAD = { ms: 0, loaded: [] as string[], failed: [] as string[], off: false };
export const modelStats = () => ({ ...LOAD, count: MODELS.size });

/** load every model of the manifest (browser). `renderer` is needed only for KTX2 maps (the transcoder picks the GPU's
 *  format). Never throws: a missing manifest or a failed model leaves the procedural stand-ins in place (and says so). */
export async function loadModels(base = '/', renderer?: THREE.WebGPURenderer): Promise<ReturnType<typeof modelStats>> {
  const t0 = performance.now();
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('models') === '0') { LOAD.off = true; return modelStats(); }
  let man: ModelManifest;
  try { const r = await fetch(base + 'models/manifest.json'); if (!r.ok) throw new Error(`manifest ${r.status}`); man = await r.json(); }
  catch (e) { console.warn(`[models] no manifest (${(e as Error).message}): procedural stand-ins drawn`); return modelStats(); }
  const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js')]);
  const draco = new DRACOLoader().setDecoderPath(base + 'models/lib/draco/'), loader = new GLTFLoader().setDRACOLoader(draco);
  if (Object.values(man.assets).some(a => a.textures === 'ktx2')) {
    const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
    const k = new KTX2Loader().setTranscoderPath(base + 'models/lib/basis/'); if (renderer) k.detectSupport(renderer as any); loader.setKTX2Loader(k);
  }
  await Promise.all(Object.entries(man.assets).map(async ([id, e]) => {
    try {
      const g = await loader.loadAsync(base + e.file);
      const lods: THREE.BufferGeometry[] = [], maps: THREE.Texture[] = [];
      for (const L of e.lods) {
        const mesh = g.scene.getObjectByName(L.name) as THREE.Mesh | undefined;
        if (!mesh?.isMesh) throw new Error(`level ${L.name} missing`);
        const map = (mesh.material as THREE.MeshStandardMaterial).normalMap; if (!map) throw new Error(`level ${L.name} has no map`);
        map.colorSpace = THREE.NoColorSpace; map.anisotropy = 8; map.needsUpdate = true;
        lods.push(mesh.geometry); maps.push(map);
      }
      MODELS.set(id, { id, entry: e, lods, maps }); LOAD.loaded.push(id);
    } catch (err) { LOAD.failed.push(id); console.warn(`[models] ${id}: ${(err as Error).message}; its procedural stand-in is drawn`); }
  }));
  draco.dispose();
  LOAD.ms = Math.round(performance.now() - t0);
  if (typeof window !== 'undefined') (window as any).__models = { stats: modelStats, ab };
  return modelStats();
}
export const model = (id: string): Model | null => MODELS.get(id) ?? null;

/** a copy of `g` scaled per axis and moved so that its bounding box is [min, max] (sculpt.ts fitTo): positions, normals
 *  (inverse-transpose, renormalised) and tangents (direction, renormalised; w kept) */
export function fitLevel(g: THREE.BufferGeometry, min: number[], max: number[]): THREE.BufferGeometry {
  const out = g.clone(); out.computeBoundingBox(); const b = out.boundingBox!;
  const lo = [b.min.x, b.min.y, b.min.z], hi = [b.max.x, b.max.y, b.max.z], s = [0, 1, 2].map(k => (max[k] - min[k]) / (hi[k] - lo[k]));
  const P = out.getAttribute('position'), N = out.getAttribute('normal'), T = out.getAttribute('tangent');
  for (let i = 0; i < P.count; i++) {
    P.setXYZ(i, min[0] + (P.getX(i) - lo[0]) * s[0], min[1] + (P.getY(i) - lo[1]) * s[1], min[2] + (P.getZ(i) - lo[2]) * s[2]);
    if (N) { const x = N.getX(i) / s[0], y = N.getY(i) / s[1], z = N.getZ(i) / s[2], l = Math.hypot(x, y, z) || 1; N.setXYZ(i, x / l, y / l, z / l); }
    if (T) { const x = T.getX(i) * s[0], y = T.getY(i) * s[1], z = T.getZ(i) * s[2], l = Math.hypot(x, y, z) || 1; T.setXYZ(i, x / l, y / l, z / l); }
  }
  P.needsUpdate = true; if (N) N.needsUpdate = true; if (T) T.needsUpdate = true;
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}

const MATS = new Map<string, THREE.MeshStandardNodeMaterial>();
/** the surface `surface` (materials.ts) with a model level's packed map: normal under the surface's own relief, occlusion
 *  on the indirect light. Cached per surface and map. */
export function bakedMaterial(surface: string, map: THREE.Texture, key: string): THREE.MeshStandardNodeMaterial {
  const k = `${surface}|${key}`, hit = MATS.get(k); if (hit) return hit;
  const m = surfaceMaterial(surface, { variant: `model:${key}` }), t = texture(map, uv());
  const nMap = normalMap(t.rgb) as any, fine = m.normalNode as any;
  // the surface's own relief (scan grain, tool marks, per-block tilt) is a perturbation of the geometric normal: it is carried
  // over onto the baked normal (added as its difference from normalView), so the map does not flatten the stone's grain
  m.normalNode = fine ? nMap.add(fine.sub(normalView)).normalize() : nMap;
  m.aoNode = t.a;
  m.name = `model:${key}:${surface}`;
  MATS.set(k, m); return m;
}

/** instanced meshes drawn from a model, with their procedural twins (A/B, D-305) */
const SWAPS: { mesh: THREE.InstancedMesh; model: [THREE.BufferGeometry, THREE.Material]; stand: [THREE.BufferGeometry, THREE.Material] }[] = [];
export function registerSwap(mesh: THREE.InstancedMesh, stand: [THREE.BufferGeometry, THREE.Material]) { SWAPS.push({ mesh, model: [mesh.geometry, mesh.material as THREE.Material], stand }); }
/** on = the models (default); off = the procedural stand-ins in the same instances */
export function ab(on: boolean): number {
  for (const s of SWAPS) { const [g, m] = on ? s.model : s.stand; s.mesh.geometry = g; s.mesh.material = m; }
  return SWAPS.length;
}
