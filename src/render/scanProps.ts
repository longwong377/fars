// CC0 scanned props in the game (session 12, D-310): rocks, stones, ground flora, jars, pots, baskets, crates, bowls from Poly
// Haven (CC0 1.0; ASSET_LEDGER.md), converted by tools/blender/ph_props.mjs into public/models/props/<id>.glb (Draco, two
// levels `lod0` / `lod1`, the scan's albedo / normal / ARM maps as JPEG) and public/models/props/manifest.json.
// Loaded once before the world is built (world.ts), so every builder can ask synchronously:
//  - scanProp(id) / propsFor(role): the levels (geometry, base on y = 0, footprint centred) and the maps; null when the
//    props are absent, failed or switched off (?props=0): the builder then draws its procedural stand-in and flags it;
//  - scanMaterial(id, tint): the scan's surface with its albedo re-tinted to the builder's measured colour (tint x the scan's
//    albedo / its own mean: the grain and the variation of the scan, the colour of the place), its normal and ARM maps kept;
//  - fitProp(): a level scaled to a builder's box (as models.ts fitLevel), for the procedural generators' own sizes.
// The generators keep their placement, counts, sizes and tiers: only the shape and the surface change.
import * as THREE from 'three/webgpu';
import { texture, uv, vec3, float, dot, attribute } from 'three/tsl';

export interface PropEntry { file: string; role: string; licence: string; source: string; bytes: number; sha256: string; srcTris: number; tris: Record<string, number>; size_m: number[]; tex: number }
export interface ScanProp { id: string; entry: PropEntry; lods: THREE.BufferGeometry[]; map: THREE.Texture | null; normal: THREE.Texture | null; arm: THREE.Texture | null; mean: [number, number, number]; size: [number, number, number] }
const PROPS = new Map<string, ScanProp>();
const LOAD = { ms: 0, loaded: [] as string[], failed: [] as string[], off: false };
export const scanPropStats = () => ({ ...LOAD, count: PROPS.size, models: MODELS.size });

/** the mean colour of a texture's image (linear-ish sRGB 0..1), from a 16x16 draw; 0.5 grey when it cannot be read */
function meanColour(t: THREE.Texture | null): [number, number, number] {
  try {
    const img = t?.image as CanvasImageSource | undefined; if (!img || typeof OffscreenCanvas === 'undefined') return [0.5, 0.5, 0.5];
    const c = new OffscreenCanvas(16, 16), g = c.getContext('2d')!; g.drawImage(img, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0;
    const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    for (let i = 0; i < d.length; i += 4) { r += lin(d[i]); gg += lin(d[i + 1]); b += lin(d[i + 2]); }
    const n = d.length / 4; return [r / n, gg / n, b / n];
  } catch { return [0.5, 0.5, 0.5]; }
}

/** load every prop of the manifest (browser). Never throws: a failed prop leaves its builder's stand-in (and says so). */
export async function loadScanProps(base = '/'): Promise<ReturnType<typeof scanPropStats>> {
  const t0 = performance.now();
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('props') === '0') { LOAD.off = true; modelsOff = true; return scanPropStats(); }
  let man: { assets: Record<string, PropEntry> };
  try { const r = await fetch(base + 'models/props/manifest.json'); if (!r.ok) throw new Error(`manifest ${r.status}`); man = await r.json(); }
  catch (e) { console.warn(`[props] no manifest (${(e as Error).message}): procedural stand-ins drawn`); return scanPropStats(); }
  const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js')]);
  const draco = new DRACOLoader().setDecoderPath(base + 'models/lib/draco/'), loader = new GLTFLoader().setDRACOLoader(draco);
  await Promise.all(Object.entries(man.assets).map(async ([id, e]) => {
    try {
      if ((e as ModelEntry).parts) { // D-325: the project's modelled props (plain GLBs parsed here: no loader, no Draco)
        const r = await fetch(base + e.file); if (!r.ok) throw new Error(`${e.file} ${r.status}`);
        registerModel(id, e as ModelEntry, parseModelGLB(await r.arrayBuffer())); LOAD.loaded.push(id); return;
      }
      const g = await loader.loadAsync(base + e.file);
      const lods: THREE.BufferGeometry[] = []; let mat: THREE.MeshStandardMaterial | null = null;
      for (const name of ['lod0', 'lod1']) {
        const m = g.scene.getObjectByName(name) as THREE.Mesh | undefined; if (!m?.isMesh) throw new Error(`level ${name} missing`);
        m.updateMatrixWorld(true); const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld);
        for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
        if (!geo.getAttribute('normal')) geo.computeVertexNormals();
        geo.computeBoundingBox(); geo.computeBoundingSphere(); lods.push(geo); mat ??= m.material as THREE.MeshStandardMaterial;
      }
      const b = lods[0].boundingBox!, size: [number, number, number] = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
      const map = mat?.map ?? null, normal = mat?.normalMap ?? null, arm = mat?.roughnessMap ?? mat?.metalnessMap ?? null;
      for (const t of [map, normal, arm]) if (t) { t.anisotropy = 8; t.needsUpdate = true; }
      PROPS.set(id, { id, entry: e, lods, map, normal, arm, mean: meanColour(map), size }); LOAD.loaded.push(id);
    } catch (err) { LOAD.failed.push(id); console.warn(`[props] ${id}: ${(err as Error).message}; its procedural stand-in is drawn`); }
  }));
  draco.dispose();
  LOAD.ms = Math.round(performance.now() - t0);
  if (typeof window !== 'undefined') (window as any).__scanProps = { stats: scanPropStats, ids: () => [...PROPS.keys()], models: () => [...MODELS.keys()] };
  return scanPropStats();
}
export const scanProp = (id: string): ScanProp | null => PROPS.get(id) ?? null;
/** the loaded props standing for `role` (manifest order), empty when none */
export const propsFor = (role: string): ScanProp[] => [...PROPS.values()].filter(p => p.entry.role === role).sort((a, b) => (a.id < b.id ? -1 : 1));
/** register a prop directly (tests; node has no GLTF loading) */
export function _setScanProp(p: ScanProp) { PROPS.set(p.id, p); }

/** a copy of a level scaled so its box is `size` (x, y, z m), base on y = 0, footprint centred */
export function fitProp(g: THREE.BufferGeometry, size: [number, number, number]): THREE.BufferGeometry {
  const out = g.clone(); out.computeBoundingBox(); const b = out.boundingBox!;
  const s = [size[0] / Math.max(1e-6, b.max.x - b.min.x), size[1] / Math.max(1e-6, b.max.y - b.min.y), size[2] / Math.max(1e-6, b.max.z - b.min.z)];
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, P = out.getAttribute('position'), N = out.getAttribute('normal');
  for (let i = 0; i < P.count; i++) {
    P.setXYZ(i, (P.getX(i) - cx) * s[0], (P.getY(i) - b.min.y) * s[1], (P.getZ(i) - cz) * s[2]);
    if (N) { const x = N.getX(i) / s[0], y = N.getY(i) / s[1], z = N.getZ(i) / s[2], l = Math.hypot(x, y, z) || 1; N.setXYZ(i, x / l, y / l, z / l); }
  }
  P.needsUpdate = true; if (N) N.needsUpdate = true; out.computeBoundingBox(); out.computeBoundingSphere(); return out;
}

type Tint = [number, number, number] | any;
/** the scan's surface re-tinted: albedo = tint x (scan albedo / its mean), clamped; normal and ARM (occlusion, roughness)
 *  maps kept. `tint` a colour or a colour node (a season's mix). Not cached: the caller keeps it. */
export function scanMaterial(p: ScanProp, tint?: Tint, o: { roughness?: number; side?: THREE.Side; /** a per-instance colour attribute multiplied in */ tintAttr?: string } = {}): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: o.roughness ?? 0.9, metalness: 0, side: o.side ?? THREE.FrontSide });
  if (p.map) {
    // the scan's luminance relative to its mean: its grain and shading variation without its own hue (a Namaqualand granite,
    // a sandstone), so the hue is the place's measured one
    const t = texture(p.map, uv()).rgb, W = vec3(0.2126, 0.7152, 0.0722), meanY = Math.max(0.02, 0.2126 * p.mean[0] + 0.7152 * p.mean[1] + 0.0722 * p.mean[2]);
    const rel = dot(t, W).div(meanY).clamp(0, 2.5);
    let c = tint ? (Array.isArray(tint) ? vec3(...tint) : tint).mul(rel) : t;
    if (o.tintAttr) c = c.mul(attribute(o.tintAttr, 'vec3'));
    m.colorNode = c;
  } else if (tint) m.colorNode = Array.isArray(tint) ? vec3(...tint) : tint;
  if (p.normal) { m.normalMap = p.normal; }
  if (p.arm) { const a = texture(p.arm, uv()); m.roughnessNode = a.g.mul(float(1)); m.aoNode = a.r; }
  m.name = `scan:${p.id}`;
  return m;
}

/** the scanned shapes by class (D-310): the builders of jars, pots, baskets and bowls take their geometry from these, fitted to
 *  their own measured box, and keep their own materials (the vertex-coloured merges of the rooms and the performances) */
export const SHAPES = {
  jar: ['ceramic_vase_01', 'ceramic_vase_04', 'antique_ceramic_vase_01'],
  pot: ['ceramic_pot', 'planter_pot_clay'],
  basket: ['wicker_basket_01', 'wicker_basket_02'],
  bowl: ['wooden_bowl_01'],
  crate: ['wooden_crate_02'],
} as const;
/** a scanned shape of `cls` (variant by `seed`) fitted to `size` (x, y, z m; base on y = 0, footprint centred); null when no
 *  scan of the class is loaded (the caller draws its procedural form) */
export function scanShape(cls: ShapeClass, seed: number, size: [number, number, number], lod: 0 | 1 = 0): THREE.BufferGeometry | null {
  // D-325: a class with modelled forms of the period draws them first (position, normal and a zero uv: the same attributes
  // as a scan's, so the builders' merges are unchanged; modelShape keeps the occlusion for the builders that use it)
  const mg = modelShape(cls, seed, size, lod); if (mg) { mg.deleteAttribute('ao'); mg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(mg.getAttribute('position').count * 2), 2)); return mg; }
  const ps = ((SHAPES as Record<string, readonly string[]>)[cls] ?? []).map(id => PROPS.get(id)).filter((p): p is ScanProp => !!p); if (!ps.length) return null;
  const p = ps[Math.abs(Math.floor(seed)) % ps.length]; return fitProp(p.lods[lod], size);
}
/** D-325: the classes drawn from the project's models of the period's forms (tools/blender/model_props.py) before any scan.
 *  The jars: the D-310 scans are modern forms (a white bottle with a pinched lip, a handled jug, a porcelain baluster vase)
 *  whose only contribution in the builders was their shape (every builder draws its own clay); the period's storage jar,
 *  two-handled water jar and narrow-necked jar replace them (C forms, B types). Sacks, vats, bowls and pots had no scan */
export const MODEL_SHAPES: Record<string, string[]> = { jar: ['jar_store', 'jar_water', 'jar_neck'], sack: ['sack'], sack_lying: ['sack_lying'], vat: ['vat'], bowl: ['bowl'], pot: ['cookpot', 'milkpot'] };
export type ShapeClass = keyof typeof SHAPES | 'sack' | 'sack_lying' | 'vat';
/** a modelled shape of `cls` fitted to `size` (all its parts merged; position, normal, ao), or null */
export function modelShape(cls: string, seed: number, size: [number, number, number], lod = 0): THREE.BufferGeometry | null {
  const ms = (MODEL_SHAPES[cls] ?? []).filter(id => model(id)); if (!ms.length) return null;
  const parts = modelFit(ms[Math.abs(Math.floor(seed)) % ms.length], size, lod); return parts ? mergedModel(parts) : null;
}

// ------------------------------------------------------------------------------------------------ modelled props (D-325)
// The project's own models of the props no CC0 scan covers (tools/blender/model_props.py: furnishings, doors' fittings, fire
// objects, vessels, sacks, sherds, tools, work objects): plain GLBs whose nodes are lod<i>__<part> (position, normal and the
// baked occlusion as COLOR_0), no maps: each builder draws each part with its own surface or vertex colour, as it drew its
// procedural stand-in, and multiplies the occlusion in (aoFactor). Parsed by parseModelGLB in the browser and in node (the
// tests load the same files: tests/helpers/models_node.ts), so every builder's switch to a model is tested with the model.
export interface ModelEntry extends PropEntry { of: string; parts: string[]; box: [[number, number, number], [number, number, number]]; partTris: Record<string, number>; ao: boolean }
export interface Model { id: string; entry: ModelEntry; lods: Record<string, THREE.BufferGeometry>[]; box: THREE.Box3 }
const MODELS = new Map<string, Model>();
let modelsOff = false;
/** ?props=0 switches the modelled props off too (every builder then draws its procedural stand-in) */
export function setModelsOff(off: boolean) { modelsOff = off; }
/** a plain (uncompressed) GLB's meshes by node name: position, normal, and COLOR_0's first channel as 'ao' */
export function parseModelGLB(ab: ArrayBuffer): Record<string, THREE.BufferGeometry> {
  const dv = new DataView(ab); if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  let o = 12, json: any = null, binOff = -1; const len = dv.getUint32(8, true);
  while (o < len) { const cl = dv.getUint32(o, true), ct = dv.getUint32(o + 4, true);
    if (ct === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, o + 8, cl))); else if (ct === 0x004e4942) binOff = o + 8;
    o += 8 + cl; }
  if (!json || binOff < 0) throw new Error('GLB without JSON or BIN');
  const NC: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const read = (i: number, index = false): { a: Float32Array | Uint32Array; n: number } => {
    const A = json.accessors[i], bv = json.bufferViews[A.bufferView], nc = NC[A.type], base = binOff + (bv.byteOffset ?? 0) + (A.byteOffset ?? 0), t = A.componentType;
    const cs = t === 5126 || t === 5125 ? 4 : t === 5123 || t === 5122 ? 2 : 1, stride = bv.byteStride ?? cs * nc;
    const out = index ? new Uint32Array(A.count * nc) : new Float32Array(A.count * nc);
    const norm = A.normalized ? (t === 5121 ? 255 : t === 5123 ? 65535 : t === 5120 ? 127 : t === 5122 ? 32767 : 1) : 1;
    for (let k = 0; k < A.count; k++) for (let c = 0; c < nc; c++) { const p = base + k * stride + c * cs;
      const v = t === 5126 ? dv.getFloat32(p, true) : t === 5125 ? dv.getUint32(p, true) : t === 5123 ? dv.getUint16(p, true) : t === 5122 ? dv.getInt16(p, true) : t === 5121 ? dv.getUint8(p) : dv.getInt8(p);
      out[k * nc + c] = v / norm; }
    return { a: out, n: nc };
  };
  const out: Record<string, THREE.BufferGeometry> = {};
  for (const node of json.nodes ?? []) {
    if (node.mesh === undefined) continue;
    const prim = json.meshes[node.mesh].primitives[0], g = new THREE.BufferGeometry();
    const P = read(prim.attributes.POSITION); g.setAttribute('position', new THREE.BufferAttribute(P.a as Float32Array, 3));
    if (prim.attributes.NORMAL !== undefined) g.setAttribute('normal', new THREE.BufferAttribute(read(prim.attributes.NORMAL).a as Float32Array, 3));
    if (prim.attributes.COLOR_0 !== undefined) { const C = read(prim.attributes.COLOR_0), ao = new Float32Array(P.a.length / 3); for (let k = 0; k < ao.length; k++) ao[k] = C.a[k * C.n]; g.setAttribute('ao', new THREE.BufferAttribute(ao, 1)); }
    if (prim.indices !== undefined) g.setIndex(new THREE.BufferAttribute(read(prim.indices, true).a as Uint32Array, 1));
    if (node.matrix || node.translation || node.rotation || node.scale) {
      const M = new THREE.Matrix4();
      if (node.matrix) M.fromArray(node.matrix); else M.compose(new THREE.Vector3(...(node.translation ?? [0, 0, 0])), new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(node.scale ?? [1, 1, 1])));
      g.applyMatrix4(M);
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    g.computeBoundingBox(); g.computeBoundingSphere(); out[node.name] = g;
  }
  return out;
}
/** register a parsed model (the browser's loader; node tests) */
export function registerModel(id: string, entry: ModelEntry, meshes: Record<string, THREE.BufferGeometry>) {
  const lods: Record<string, THREE.BufferGeometry>[] = [];
  for (const [name, g] of Object.entries(meshes)) { const m = /^lod(\d+)__(.+)$/.exec(name); if (!m) continue; (lods[+m[1]] ??= {})[m[2]] = g; }
  if (!lods[0]) throw new Error(`${id}: no lod0 parts`);
  for (let i = 1; i < lods.length; i++) lods[i] ??= lods[i - 1];
  const box = new THREE.Box3(); for (const g of Object.values(lods[0])) box.union(g.boundingBox!);
  MODELS.set(entry.of ?? id, { id, entry, lods, box });
}
/** the model of `of` (the asset's name, without the manifest's m_ prefix); null when absent or switched off (the builder
 *  then draws its procedural stand-in and flags it) */
export const model = (of: string): Model | null => (modelsOff ? null : MODELS.get(of) ?? null);
export const modelIds = () => [...MODELS.keys()];
/** a model's parts at a level (copies), transformed by M when given */
export function modelParts(of: string, lod = 0, M?: THREE.Matrix4): Record<string, THREE.BufferGeometry> | null {
  const m = model(of); if (!m) return null; const L = m.lods[Math.min(lod, m.lods.length - 1)], out: Record<string, THREE.BufferGeometry> = {};
  for (const [k, g] of Object.entries(L)) { const c = g.clone(); if (M) c.applyMatrix4(M); out[k] = c; }
  return out;
}
/** a model's parts scaled so the model's box (lod0's, for every level alike) becomes `size` (x, y, z m; null: its own), base
 *  on y = 0 and footprint centred (as fitProp); `at` then translates */
export function modelFit(of: string, size: [number, number, number] | null, lod = 0, at: [number, number, number] = [0, 0, 0]): Record<string, THREE.BufferGeometry> | null {
  const m = model(of); if (!m) return null; const b = m.box, s = size ? [size[0] / Math.max(1e-6, b.max.x - b.min.x), size[1] / Math.max(1e-6, b.max.y - b.min.y), size[2] / Math.max(1e-6, b.max.z - b.min.z)] : [1, 1, 1];
  const M = new THREE.Matrix4().makeTranslation(at[0], at[1], at[2]).multiply(new THREE.Matrix4().makeScale(s[0], s[1], s[2])).multiply(new THREE.Matrix4().makeTranslation(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2));
  const out = modelParts(of, lod, M)!;
  for (const g of Object.values(out)) { const N = g.getAttribute('normal'); if (!N) continue; // (applyMatrix4 renormalises with the normal matrix already; kept for the non-uniform case)
    for (let i = 0; i < N.count; i++) { const x = N.getX(i), y = N.getY(i), z = N.getZ(i), l = Math.hypot(x, y, z) || 1; N.setXYZ(i, x / l, y / l, z / l); } }
  return out;
}
/** all parts of a model in one geometry (position, normal, ao) */
export function mergedModel(parts: Record<string, THREE.BufferGeometry> | THREE.BufferGeometry[]): THREE.BufferGeometry {
  const gs = (Array.isArray(parts) ? parts : Object.values(parts)).map(g => (g.index ? g.toNonIndexed() : g));
  const n = gs.reduce((s, g) => s + g.getAttribute('position').count, 0), P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), A = new Float32Array(n).fill(1); let o = 0;
  for (const g of gs) { const p = g.getAttribute('position'), nn = g.getAttribute('normal'), a = g.getAttribute('ao');
    for (let i = 0; i < p.count; i++) { P[(o + i) * 3] = p.getX(i); P[(o + i) * 3 + 1] = p.getY(i); P[(o + i) * 3 + 2] = p.getZ(i);
      if (nn) { Nn[(o + i) * 3] = nn.getX(i); Nn[(o + i) * 3 + 1] = nn.getY(i); Nn[(o + i) * 3 + 2] = nn.getZ(i); } if (a) A[o + i] = a.getX(i); }
    o += p.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); g.setAttribute('ao', new THREE.BufferAttribute(A, 1));
  g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
/** the occlusion's strength in the colours (1: the full bake; the renderer adds its own sky light and shadows: C) */
export const AO_K = 0.55;
/** a model part's vertex colour for a builder's material that reads 'color' (linear rgb x the baked occlusion); the 'ao'
 *  attribute is dropped. Returns the geometry */
export function colourByAO(g: THREE.BufferGeometry, rgbLinear: [number, number, number]): THREE.BufferGeometry {
  const n = g.getAttribute('position').count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = aoFactor(g, i); c[i * 3] = rgbLinear[0] * k; c[i * 3 + 1] = rgbLinear[1] * k; c[i * 3 + 2] = rgbLinear[2] * k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); if (g.getAttribute('ao')) g.deleteAttribute('ao'); return g;
}
/** the colour factor of vertex i from a geometry's baked occlusion (1 where it has none) */
export const aoFactor = (g: THREE.BufferGeometry, i: number) => { const a = g.getAttribute('ao'); return a ? 1 - AO_K + AO_K * a.getX(i) : 1; };
