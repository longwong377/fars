// Runtime loader for the MakeHuman-derived human assets (D-020, D-025). Reads public/generated/humans/humans.{json,bin}
// (written by tools/build_humans.ts) and expands them into per-variant render-vertex arrays: bind positions, smooth
// normals (accumulated per position vertex, so UV seams share one normal) and bind joints. Works in the browser (fetch)
// and in node (tests read the files directly). Textures (skin/hair/eye PNGs) are loaded by the renderer, not here.
import { HBONES, HB, PART, type HumanAssetsMeta, type HumanVariantMeta } from './humanFormat';

export interface HumanVariant {
  meta: HumanVariantMeta; index: number;
  /** render-vertex bind positions (m) and unit normals, NO × 3 */
  pos: Float32Array; nrm: Float32Array;
  /** bind joint (bone head) positions, HBONES order, 59 × 3 */
  joints: Float32Array;
  /** standing height of the mesh (m), eye height (m) */
  height: number; eyeY: number;
}
export interface HumanAssets {
  meta: HumanAssetsMeta;
  /** render vertices (unique position × uv) and position vertices */
  NO: number; NP: number;
  orig: Uint16Array; uv: Float32Array;
  /** per render vertex (expanded from position vertices): 4 bone indices, 4 byte weights summing to 255, part id, cavity AO 0..1, beard/scalp masks 0..1 */
  skinIndex: Uint8Array; skinWeight: Uint8Array; part: Uint8Array; ao: Float32Array; beard: Float32Array; scalp: Float32Array;
  /** triangle lists over render vertices: full, mid, far */
  lods: Uint16Array[];
  /** triangles of each LOD that belong to the body surface (not eyes, lashes, mouth helpers) */
  variants: HumanVariant[];
  byId: Record<string, HumanVariant>;
}

const SIZE = { u8: 1, u16: 2, i16: 2, u32: 4, f32: 4 } as const;
function view(meta: HumanAssetsMeta, bin: ArrayBuffer, key: string) {
  const l = meta.layout[key]; if (!l) throw new Error('humans.bin: no ' + key);
  const n = l.count * l.itemSize, b = bin.slice(l.offset, l.offset + n * SIZE[l.type]);
  switch (l.type) { case 'u8': return new Uint8Array(b); case 'u16': return new Uint16Array(b); case 'i16': return new Int16Array(b); case 'u32': return new Uint32Array(b); default: return new Float32Array(b); }
}

/** decode the assets (meta JSON + binary) */
export function decodeHumanAssets(meta: HumanAssetsMeta, bin: ArrayBuffer): HumanAssets {
  if (meta.bones.join() !== HBONES.join()) throw new Error('humans.json skeleton differs from humanFormat HBONES');
  const orig = view(meta, bin, 'orig') as Uint16Array, uvq = view(meta, bin, 'uv') as Uint16Array;
  const NO = orig.length, NP = meta.layout.skinIndex.count;
  const uv = new Float32Array(NO * 2); for (let i = 0; i < NO * 2; i++) uv[i] = uvq[i] / 65535;
  const siP = view(meta, bin, 'skinIndex') as Uint8Array, swP = view(meta, bin, 'skinWeight') as Uint8Array;
  const partP = view(meta, bin, 'part') as Uint8Array, aoP = view(meta, bin, 'ao') as Uint8Array, beardP = view(meta, bin, 'beard') as Uint8Array, scalpP = view(meta, bin, 'scalp') as Uint8Array;
  const skinIndex = new Uint8Array(NO * 4), skinWeight = new Uint8Array(NO * 4), part = new Uint8Array(NO), ao = new Float32Array(NO), beard = new Float32Array(NO), scalp = new Float32Array(NO);
  for (let i = 0; i < NO; i++) { const p = orig[i];
    for (let k = 0; k < 4; k++) { skinIndex[i * 4 + k] = siP[p * 4 + k]; skinWeight[i * 4 + k] = swP[p * 4 + k]; }
    part[i] = partP[p]; ao[i] = aoP[p] / 255; beard[i] = beardP[p] / 255; scalp[i] = scalpP[p] / 255; }
  const lods = meta.lods.map(l => view(meta, bin, l.indexKey) as Uint16Array);
  const variants: HumanVariant[] = meta.variants.map((vm, index) => {
    const q = new Int16Array(bin.slice(vm.posOffset, vm.posOffset + NP * 3 * 2)); const s = meta.posScale;
    const pos = new Float32Array(NO * 3);
    for (let i = 0; i < NO; i++) { const p = orig[i]; pos[i * 3] = q[p * 3] * s; pos[i * 3 + 1] = q[p * 3 + 1] * s; pos[i * 3 + 2] = q[p * 3 + 2] * s; }
    const nrm = smoothNormals(pos, orig, NP, lods);
    const joints = new Float32Array(HBONES.length * 3); vm.joints.forEach((j, b) => joints.set(j, b * 3));
    const eyeY = (joints[HB.eye_l * 3 + 1] + joints[HB.eye_r * 3 + 1]) / 2;
    return { meta: vm, index, pos, nrm, joints, height: vm.height, eyeY };
  });
  return { meta, NO, NP, orig, uv, skinIndex, skinWeight, part, ao, beard, scalp, lods, variants, byId: Object.fromEntries(variants.map(v => [v.meta.id, v])) };
}

/** area-weighted vertex normals, accumulated per position vertex (seams share a normal); vertices only used by the
 *  mid/far LODs (the low-poly eyes) take their normals from those triangle lists */
export function smoothNormals(pos: Float32Array, orig: Uint16Array, NP: number, lods: Uint16Array[]): Float32Array {
  const acc = new Float64Array(NP * 3); const touched = new Uint8Array(NP);
  const add = (tris: Uint16Array, onlyNew: boolean) => {
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t], b = tris[t + 1], c = tris[t + 2]; const pa = orig[a], pb = orig[b], pc = orig[c];
      if (onlyNew && (touched[pa] === 1 || touched[pb] === 1 || touched[pc] === 1)) continue;
      const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
      const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const p of [pa, pb, pc]) { acc[p * 3] += nx; acc[p * 3 + 1] += ny; acc[p * 3 + 2] += nz; if (!onlyNew) touched[p] = 1; else touched[p] = 2; }
    }
  };
  add(lods[0], false); for (let l = 1; l < lods.length; l++) add(lods[l], true);
  const NO = orig.length, out = new Float32Array(NO * 3);
  for (let i = 0; i < NO; i++) { const p = orig[i]; const x = acc[p * 3], y = acc[p * 3 + 1], z = acc[p * 3 + 2], l = Math.hypot(x, y, z) || 1; out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l; }
  return out;
}

/** browser/node loader: `read(file)` returns the bytes of public/generated/humans/<file> */
export async function loadHumanAssets(read: (file: string) => Promise<ArrayBuffer>): Promise<HumanAssets> {
  const [j, b] = await Promise.all([read('humans.json'), read('humans.bin')]);
  return decodeHumanAssets(JSON.parse(new TextDecoder().decode(j)), b);
}
export const HUMANS_DIR = 'generated/humans';

/** is this render vertex part of the body surface (skin), as opposed to eyes, teeth, tongue, lashes */
export const isBodySurface = (A: HumanAssets, i: number) => A.part[i] < PART.eye;

/** index-only simplification with meshoptimizer (the far-LOD costumes): keeps the vertex set, reduces the triangles */
export function meshoptSimplify(M: any) {
  return (index: Uint32Array, pos: Float32Array, targetTris: number) => {
    const [res] = M.simplify(index, pos, 3, Math.min(index.length, targetTris * 3), 0.03, []);
    return Uint32Array.from(res as Uint32Array);
  };
}
