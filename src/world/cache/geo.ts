// s15/load (D-354): a BufferGeometry as plain data for the baked world (pack.ts): its attributes' arrays, item sizes and
// normalisation, its index and groups; and back. Lossless (the arrays are the geometry's own).
import * as THREE from 'three/webgpu';
import { hashBytes, hashString } from './pack';
export type GeoPack = { a: Record<string, [ArrayLike<number>, number, boolean]>; i: ArrayLike<number> | null; g: [number, number, number][] };
export function packGeo(g: THREE.BufferGeometry): GeoPack {
  const a: GeoPack['a'] = {}; for (const k of Object.keys(g.attributes)) { const x = g.getAttribute(k) as THREE.BufferAttribute; if ((x as any).isInterleavedBufferAttribute) throw new Error('packGeo: interleaved'); a[k] = [x.array as any, x.itemSize, x.normalized]; }
  return { a, i: g.index ? (g.index.array as any) : null, g: g.groups.map(q => [q.start, q.count, q.materialIndex ?? 0]) };
}
export function unpackGeo(p: GeoPack): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(); for (const [k, [arr, n, norm]] of Object.entries(p.a)) g.setAttribute(k, new THREE.BufferAttribute(arr as any, n, norm));
  if (p.i) g.setIndex(new THREE.BufferAttribute(p.i as any, 1)); for (const [s, c, m] of p.g) g.addGroup(s, c, m); return g;
}
/** a content hash of a geometry's attributes and index (the key of a cached derivation of it) */
export function geoHash(g: THREE.BufferGeometry, gain = 1): string {
  const v = (a: any) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength), parts = [String(gain)];
  for (const k of Object.keys(g.attributes).sort()) { const x = g.getAttribute(k); parts.push(`${k}/${x.itemSize}:${hashBytes(v(x.array))}`); }
  if (g.index) parts.push(`i:${hashBytes(v(g.index.array))}`);
  return hashString(parts.join('|'));
}
