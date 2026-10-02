// D-329: the Blender-built monuments of the plain and the town (Tol-e Ajori, Naqsh-e Rustam: tools/blender/monuments.mjs).
// Each asset is a plain (uncompressed) GLB of named meshes (position, normal, TEXCOORD_0, TEXCOORD_1 as `uv1`, COLOR_0 as
// `ao`, indices) and a few JPEG maps (tangent-space normal RGB, OpenGL; aux: R occlusion, G albedo x2, B roughness; colour
// sRGB; KTX2 UASTC, D-329), listed in public/models/monuments/manifest.json. The GLB is parsed here (no loader), so node tests draw and count
// the same geometry as the page (loadMonumentsNode), and a missing or failed asset leaves the builder's procedural stand-in
// (flagged PLACEHOLDER) in place: nothing is ever missing. `?monuments=0` switches them off (A/B).
import * as THREE from 'three/webgpu';
import { sharedKTX2 } from './loaders';
import { BASE } from '../core/base';

export interface MonumentEntry { file: string; sha256: string; bytes: number; tris: Record<string, number>; maps: Record<string, { file: string; w: number; h: number; bytes: number; sha256: string; srgb?: boolean }>; tier: string; src: string; note: string; blender: string; device: string; inHash: string; stats?: Record<string, number> }
export interface MonumentManifest { about: string; assets: Record<string, MonumentEntry> }
export interface Monument { id: string; entry: MonumentEntry; meshes: Record<string, THREE.BufferGeometry>; maps: Record<string, THREE.Texture> }

const MON = new Map<string, Monument>();
const LOAD = { ms: 0, loaded: [] as string[], failed: [] as string[], off: false };
export const monumentStats = () => ({ ...LOAD, count: MON.size });
export const monument = (id: string): Monument | null => MON.get(id) ?? null;

/** a plain GLB's meshes by node name, node transforms applied */
export function parseMonumentGLB(ab: ArrayBuffer): Record<string, THREE.BufferGeometry> {
  const dv = new DataView(ab); if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  let o = 12, json: any = null, binOff = -1; const len = dv.getUint32(8, true);
  while (o < len) { const cl = dv.getUint32(o, true), ct = dv.getUint32(o + 4, true);
    if (ct === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, o + 8, cl))); else if (ct === 0x004e4942) binOff = o + 8;
    o += 8 + cl; }
  if (!json || binOff < 0) throw new Error('GLB without JSON or BIN');
  const NC: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const read = (i: number, index = false) => {
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
    const prims = json.meshes[node.mesh].primitives as any[], parts: THREE.BufferGeometry[] = [];
    for (const prim of prims) {
      const g = new THREE.BufferGeometry(), at = prim.attributes;
      const P = read(at.POSITION); g.setAttribute('position', new THREE.BufferAttribute(P.a as Float32Array, 3));
      if (at.NORMAL !== undefined) g.setAttribute('normal', new THREE.BufferAttribute(read(at.NORMAL).a as Float32Array, 3));
      if (at.TEXCOORD_0 !== undefined) g.setAttribute('uv', new THREE.BufferAttribute(read(at.TEXCOORD_0).a as Float32Array, 2));
      if (at.TEXCOORD_1 !== undefined) g.setAttribute('uv1', new THREE.BufferAttribute(read(at.TEXCOORD_1).a as Float32Array, 2));
      if (at.COLOR_0 !== undefined) { const C = read(at.COLOR_0), ao = new Float32Array(P.a.length / 3); for (let k = 0; k < ao.length; k++) ao[k] = C.a[k * C.n]; g.setAttribute('ao', new THREE.BufferAttribute(ao, 1)); }
      if (prim.indices !== undefined) g.setIndex(new THREE.BufferAttribute(read(prim.indices, true).a as Uint32Array, 1));
      parts.push(g);
    }
    let g = parts[0];
    if (parts.length > 1) { // several primitives (materials) in one node: concatenated (same attributes by construction)
      const m = new THREE.BufferGeometry(), names = Object.keys(parts[0].attributes); let off = 0; const idx: number[] = [];
      for (const n of names) { const it = parts[0].getAttribute(n).itemSize, arr = new Float32Array(parts.reduce((s, p) => s + p.getAttribute(n).count, 0) * it); let k = 0;
        for (const p of parts) { arr.set(p.getAttribute(n).array as Float32Array, k); k += (p.getAttribute(n).array as Float32Array).length; } m.setAttribute(n, new THREE.BufferAttribute(arr, it)); }
      for (const p of parts) { const I = p.index!; for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + off); off += p.getAttribute('position').count; }
      m.setIndex(idx); g = m;
    }
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

/** load every monument of the manifest (browser). Never throws. */
export async function loadMonuments(base = BASE, anisotropy = 8): Promise<ReturnType<typeof monumentStats>> {
  const t0 = performance.now();
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('monuments') === '0') { LOAD.off = true; return monumentStats(); }
  let man: MonumentManifest;
  try { const r = await fetch(base + 'models/monuments/manifest.json'); if (!r.ok) throw new Error(`manifest ${r.status}`); man = await r.json(); }
  catch (e) { console.warn(`[monuments] no manifest (${(e as Error).message}): procedural stand-ins drawn`); return monumentStats(); }
  const L = new THREE.TextureLoader();
  // KTX2 maps (UASTC): the transcoder picks the GPU's block format from the WebGPU adapter (as models.ts; decoders in /models/lib/)
  let K: any = null;
  if (Object.values(man.assets).some(a => Object.values(a.maps).some(m => m.file.endsWith('.ktx2')))) {
    K = await sharedKTX2(base); // (D-392: the page's transcoder)
  }
  await Promise.all(Object.entries(man.assets).map(async ([id, e]) => {
    try {
      const r = await fetch(base + e.file); if (!r.ok) throw new Error(`${e.file} ${r.status}`);
      const meshes = parseMonumentGLB(await r.arrayBuffer()), maps: Record<string, THREE.Texture> = {};
      await Promise.all(Object.entries(e.maps).map(async ([k, m]) => {
        const t: THREE.Texture = m.file.endsWith('.ktx2') ? await K.loadAsync(base + m.file) : await L.loadAsync(base + m.file); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy;
        t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = m.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.flipY = false; t.needsUpdate = true;
        maps[k] = t; }));
      MON.set(id, { id, entry: e, meshes, maps }); LOAD.loaded.push(id);
    } catch (err) { LOAD.failed.push(id); console.warn(`[monuments] ${id}: ${(err as Error).message}; its procedural stand-in is drawn`); }
  }));
  LOAD.ms = Math.round(performance.now() - t0);
  if (typeof window !== 'undefined') (window as any).__monuments = { stats: monumentStats };
  return monumentStats();
}

/** node (tests, tools): register a monument from bytes already read; maps are blank stand-in textures (no DOM) */
export function registerMonument(id: string, entry: MonumentEntry, glb: ArrayBuffer) {
  const maps: Record<string, THREE.Texture> = {}; for (const k of Object.keys(entry.maps)) { const t = new THREE.Texture(); t.wrapS = t.wrapT = THREE.RepeatWrapping; maps[k] = t; }
  MON.set(id, { id, entry, meshes: parseMonumentGLB(glb), maps });
}
export function clearMonuments() { MON.clear(); }
