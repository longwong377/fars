// The small life's modelled forms in the game (D-332; BLENDER_PLAN rows 13 and 20): every bird species (wildlife.ts BIRDS and
// its flocks' variants), every small creature (smallLife.ts SMALL) and every ground-flora kind (groundFlora.ts), built by
// tools/blender/life.mjs as plain GLBs (named levels: fly0-2 and stand0-1 for the birds, lod0-1 for the rest) with two KTX2
// maps each: the albedo with the coverage in its alpha (the cut-out feather tips, leaflets and spines: the alpha test) and the
// tangent-space normal with the baked occlusion in its alpha. COLOR_0 carries each vertex's part numbers (the birds: the wing
// weight in r, 1 on the wing in g, 1 on the tail in b; the creatures: the wing weight or the body's length in r; the flora:
// the part in r: 0 leaf and stem, 1 flower or seed head). This module loads them at startup (public/models/life/manifest.json)
// before the world is built; a model absent, failed or switched off (?life=0, ?models=0) leaves its builder's procedural
// stand-in drawn and flagged PLACEHOLDER. The GLB parser is the module's own so the tests read the same files in node.
import * as THREE from 'three/webgpu';
import { texture, uv, vec3, normalMap, mix, float, attribute } from 'three/tsl';

export interface LifeAsset { class: 'birds' | 'small' | 'flora'; name: string; of: string; files: Record<string, { bytes: number; sha256: string }>; tris: Record<string, number>; tex: number | [number, number];
  L?: number; S?: number; sx?: number; half?: number; [k: string]: unknown }
export interface LifeModel { id: string; entry: LifeAsset; levels: Record<string, THREE.BufferGeometry>; albedo: THREE.Texture | null; nrm: THREE.Texture | null }
const MODELS = new Map<string, LifeModel>();
const LOAD = { ms: 0, loaded: [] as string[], failed: [] as string[], off: false, bytes: 0 };
export const lifeModelStats = () => ({ ...LOAD, count: MODELS.size });

/** a plain GLB's meshes by node name: position, normal, uv and COLOR_0 (as 'life', vec4) */
export function parseLifeGLB(ab: ArrayBuffer): Record<string, THREE.BufferGeometry> {
  const dv = new DataView(ab); if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  let o = 12, json: any = null, binOff = -1; const len = dv.getUint32(8, true);
  while (o < len) { const cl = dv.getUint32(o, true), ct = dv.getUint32(o + 4, true); if (ct === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, o + 8, cl))); else if (ct === 0x004e4942) binOff = o + 8; o += 8 + cl; }
  if (!json || binOff < 0) throw new Error('GLB without JSON or BIN');
  const NC: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const read = (i: number, index = false) => {
    const A = json.accessors[i], bv = json.bufferViews[A.bufferView], nc = NC[A.type], base = binOff + (bv.byteOffset ?? 0) + (A.byteOffset ?? 0), t = A.componentType;
    const cs = t === 5126 || t === 5125 ? 4 : t === 5123 || t === 5122 ? 2 : 1, stride = bv.byteStride ?? cs * nc;
    const out = index ? new Uint32Array(A.count * nc) : new Float32Array(A.count * nc), norm = A.normalized ? (t === 5121 ? 255 : t === 5123 ? 65535 : 1) : 1;
    for (let k = 0; k < A.count; k++) for (let c = 0; c < nc; c++) { const p = base + k * stride + c * cs;
      out[k * nc + c] = (t === 5126 ? dv.getFloat32(p, true) : t === 5125 ? dv.getUint32(p, true) : t === 5123 ? dv.getUint16(p, true) : dv.getUint8(p)) / norm; }
    return { a: out, n: nc };
  };
  const out: Record<string, THREE.BufferGeometry> = {};
  for (const node of json.nodes ?? []) {
    if (node.mesh === undefined) continue;
    const prim = json.meshes[node.mesh].primitives[0], g = new THREE.BufferGeometry(), at = prim.attributes;
    g.setAttribute('position', new THREE.BufferAttribute(read(at.POSITION).a as Float32Array, 3));
    if (at.NORMAL !== undefined) g.setAttribute('normal', new THREE.BufferAttribute(read(at.NORMAL).a as Float32Array, 3));
    if (at.TEXCOORD_0 !== undefined) g.setAttribute('uv', new THREE.BufferAttribute(read(at.TEXCOORD_0).a as Float32Array, 2));
    if (at.COLOR_0 !== undefined) { const C = read(at.COLOR_0), n = C.a.length / C.n, v = new Float32Array(n * 4); for (let k = 0; k < n; k++) for (let c = 0; c < 4; c++) v[k * 4 + c] = c < C.n ? C.a[k * C.n + c] : 1; g.setAttribute('life', new THREE.BufferAttribute(v, 4)); }
    if (prim.indices !== undefined) g.setIndex(new THREE.BufferAttribute(read(prim.indices, true).a as Uint32Array, 1));
    if (node.translation || node.rotation || node.scale) g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation ?? [0, 0, 0])), new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(node.scale ?? [1, 1, 1]))));
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    g.computeBoundingBox(); g.computeBoundingSphere(); out[node.name] = g;
  }
  return out;
}
/** triangles of a level */
export const levelTris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

/** load every model of the manifest (browser). Never throws. */
export async function loadLifeModels(base = '/'): Promise<ReturnType<typeof lifeModelStats>> {
  const t0 = performance.now();
  if (typeof location !== 'undefined') { const q = new URLSearchParams(location.search); if (q.get('life') === '0' || q.get('models') === '0') { LOAD.off = true; return lifeModelStats(); } }
  let man: { assets: Record<string, LifeAsset> };
  try { const r = await fetch(base + 'models/life/manifest.json'); if (!r.ok) throw new Error(`manifest ${r.status}`); man = await r.json(); }
  catch (e) { console.warn(`[life] no manifest (${(e as Error).message}): procedural stand-ins drawn`); return lifeModelStats(); }
  const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
  const ad = await (globalThis as any).navigator?.gpu?.requestAdapter?.().catch(() => null);
  const ktx = new KTX2Loader().setTranscoderPath(base + 'models/lib/basis/'); ktx.detectSupport({ isWebGPURenderer: true, hasFeature: (f: string) => !!ad?.features?.has(f) } as any);
  await Promise.all(Object.entries(man.assets).map(async ([id, e]) => {
    try {
      const dir = base + 'models/life/';
      const [ab, albedo, nrm] = await Promise.all([fetch(dir + `${id}.glb`).then(r => { if (!r.ok) throw new Error(`${id}.glb ${r.status}`); return r.arrayBuffer(); }), ktx.loadAsync(dir + `${id}_albedo.ktx2`), ktx.loadAsync(dir + `${id}_nrm.ktx2`)]);
      for (const t of [albedo, nrm]) { t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; }
      albedo.colorSpace = THREE.SRGBColorSpace; nrm.colorSpace = THREE.NoColorSpace;
      MODELS.set(id, { id, entry: e, levels: parseLifeGLB(ab), albedo, nrm }); LOAD.loaded.push(id); LOAD.bytes += Object.values(e.files).reduce((a, f) => a + f.bytes, 0);
    } catch (err) { LOAD.failed.push(id); console.warn(`[life] ${id}: ${(err as Error).message}; its procedural stand-in is drawn`); }
  }));
  ktx.dispose(); LOAD.ms = Math.round(performance.now() - t0);
  if (typeof window !== 'undefined') (window as any).__lifeModels = { stats: lifeModelStats, ids: () => [...MODELS.keys()] };
  return lifeModelStats();
}
export const lifeModel = (id: string): LifeModel | null => (LOAD.off ? null : MODELS.get(id) ?? null);
export const lifeIds = () => [...MODELS.keys()];
/** tests and tools (node): register a model read from disk (maps null: the material then draws the fallback colour) */
export function setLifeModel(m: LifeModel) { MODELS.set(m.id, m); }
export function clearLifeModels() { MODELS.clear(); }

/** a model's surface: the baked albedo (x `tint` when given: a colour node multiplying the albedo, the flora's seasons), the
 *  coverage as an alpha test, the baked normal and occlusion; `fallback` the colour drawn when the maps are absent (node) */
export function lifeMaterial(m: LifeModel, o: { fallback: [number, number, number]; tint?: any; roughness?: number; side?: THREE.Side; alphaTest?: number; uvNode?: any; /** a 0/1 node: whether the flowers (COLOR_0.r = 1) are shown */ flowerVis?: any } ): THREE.MeshStandardNodeMaterial {
  const mat = new THREE.MeshStandardNodeMaterial({ roughness: o.roughness ?? 0.85, metalness: 0, side: o.side ?? THREE.FrontSide });
  if (m.albedo) {
    const U = o.uvNode ?? uv(), t = texture(m.albedo, U); mat.colorNode = o.tint ? t.rgb.mul(o.tint) : t.rgb;
    mat.opacityNode = o.flowerVis !== undefined ? t.a.mul(mix(float(1), o.flowerVis, attribute('life', 'vec4').x)) : t.a; mat.alphaTest = o.alphaTest ?? 0.5;
  } else mat.colorNode = o.tint ? vec3(...o.fallback).mul(o.tint) : vec3(...o.fallback);
  if (m.nrm) { if (o.uvNode) { mat.normalNode = normalMap(texture(m.nrm, o.uvNode).rgb); } else mat.normalMap = m.nrm; mat.aoNode = texture(m.nrm, o.uvNode ?? uv()).a.mul(0.8).add(0.2); }
  mat.name = `life:${m.id}`;
  return mat;
}
