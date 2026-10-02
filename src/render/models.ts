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
import { sharedKTX2, sharedDraco } from './loaders';
import { texture, uv, normalMap, normalView } from 'three/tsl';
import { surfaceMaterial } from './materials';
import { BASE } from '../core/base';

export interface ModelLevel { name: string; tris: number; verts: number; attrs: string[]; map: { w: number; h: number; format: string; bytes: number } | null; ao_mean: number }
export interface ModelEntry { file: string; inHash: string; outHash: string; bytes: number; gpuBytes: number; textures: 'png' | 'ktx2'; lods: ModelLevel[]; tier: string; src: string; blender: string; device: string }
export interface ModelManifest { about: string; assets: Record<string, ModelEntry> }
export interface Model { id: string; entry: ModelEntry; lods: THREE.BufferGeometry[]; maps: THREE.Texture[] }

const MODELS = new Map<string, Model>();
const LOAD = { ms: 0, loaded: [] as string[], failed: [] as string[], off: false, ktx2: null as Record<string, boolean> | null, formats: {} as Record<string, string> };
export const modelStats = () => ({ ...LOAD, count: MODELS.size });

/** load every model of the manifest (browser). `renderer` is needed only for KTX2 maps (the transcoder picks the GPU's
 *  format). Never throws: a missing manifest or a failed model leaves the procedural stand-ins in place (and says so). */
export async function loadModels(base = BASE, renderer?: THREE.WebGPURenderer): Promise<ReturnType<typeof modelStats>> {
  const t0 = performance.now();
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('models') === '0') { LOAD.off = true; return modelStats(); }
  let man: ModelManifest;
  try { const r = await fetch(base + 'models/manifest.json'); if (!r.ok) throw new Error(`manifest ${r.status}`); man = await r.json(); }
  catch (e) { console.warn(`[models] no manifest (${(e as Error).message}): procedural stand-ins drawn`); return modelStats(); }
  const [{ GLTFLoader }, draco] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), sharedDraco(base)]); // (D-392: the page's decoders)
  const loader = new GLTFLoader().setDRACOLoader(draco);
  if (Object.values(man.assets).some(a => a.textures === 'ktx2')) {
    // the transcoder's target format needs the GPU's compressed formats: from the renderer when given, else (the world loads
    // the models before it has one) from the WebGPU adapter, whose features three's WebGPU backend requests in full (D-306);
    // without either the maps transcode to uncompressed RGBA (correct, 4x the memory). D-392: the page's one transcoder
    const k = await sharedKTX2(base, renderer ?? undefined); loader.setKTX2Loader(k); LOAD.ktx2 = { ...(k as any).workerConfig };
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
        // what the map is on the GPU (a KTX2 map arrives as a CompressedTexture in the transcoder's target format)
        LOAD.formats[`${id}:${L.name}`] = (map as any).isCompressedTexture ? `compressed:${map.format}` : `rgba8:${e.textures}`;
      }
      MODELS.set(id, { id, entry: e, lods, maps }); LOAD.loaded.push(id);
    } catch (err) { LOAD.failed.push(id); console.warn(`[models] ${id}: ${(err as Error).message}; its procedural stand-in is drawn`); }
  }));
  // (D-392: the shared decoder stays up)
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

/** a copy of `g` under the affine map M (row-major 3x4, as sculpt.ts transformNorm), which may mirror (the Gate's colossi face
 *  both ways, D-306): positions; normals by the inverse transpose; tangents by M with their handedness (w) flipped when M
 *  mirrors, so the baked tangent-space normals still point out of the surface; windings reversed when M mirrors */
export function placeLevel(g: THREE.BufferGeometry, M: number[]): THREE.BufferGeometry {
  const out = g.clone(), P = out.getAttribute('position'), N = out.getAttribute('normal'), T = out.getAttribute('tangent');
  const [a, b, c, tx, d, e, f, ty, gg, h, i, tz] = M;
  const det = a * (e * i - f * h) - b * (d * i - f * gg) + c * (d * h - e * gg);
  // inverse transpose (cofactors / det)
  const it = [(e * i - f * h), -(d * i - f * gg), (d * h - e * gg), -(b * i - c * h), (a * i - c * gg), -(a * h - b * gg), (b * f - c * e), -(a * f - c * d), (a * e - b * d)].map(x => x / det);
  for (let k = 0; k < P.count; k++) {
    const x = P.getX(k), y = P.getY(k), z = P.getZ(k);
    P.setXYZ(k, a * x + b * y + c * z + tx, d * x + e * y + f * z + ty, gg * x + h * y + i * z + tz);
    if (N) { const nx = N.getX(k), ny = N.getY(k), nz = N.getZ(k), X = it[0] * nx + it[3] * ny + it[6] * nz, Y = it[1] * nx + it[4] * ny + it[7] * nz, Z = it[2] * nx + it[5] * ny + it[8] * nz, l = Math.hypot(X, Y, Z) || 1; N.setXYZ(k, X / l, Y / l, Z / l); }
    if (T) { const qx = T.getX(k), qy = T.getY(k), qz = T.getZ(k), X = a * qx + b * qy + c * qz, Y = d * qx + e * qy + f * qz, Z = gg * qx + h * qy + i * qz, l = Math.hypot(X, Y, Z) || 1; T.setXYZW(k, X / l, Y / l, Z / l, T.getW(k) * Math.sign(det)); }
  }
  if (det < 0 && out.index) { const I = out.index; for (let t = 0; t < I.count; t += 3) { const q = I.getX(t + 1); I.setX(t + 1, I.getX(t + 2)); I.setX(t + 2, q); } I.needsUpdate = true; }
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
const SWAPS: { mesh: THREE.Mesh; model: [THREE.BufferGeometry, THREE.Material]; stand: [THREE.BufferGeometry, THREE.Material] }[] = [];
export function registerSwap(mesh: THREE.Mesh, stand: [THREE.BufferGeometry, THREE.Material]) { SWAPS.push({ mesh, model: [mesh.geometry, mesh.material as THREE.Material], stand }); }
/** on = the models (default); off = the procedural stand-ins in the same instances */
export function ab(on: boolean): number {
  for (const s of SWAPS) { const [g, m] = on ? s.model : s.stand; s.mesh.geometry = g; s.mesh.material = m; }
  return SWAPS.length;
}
