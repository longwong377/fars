// Q-960 (D-324b): node has no GLTF loading, so the CC0 scan props (D-310, src/render/scanProps.ts) are absent in the tests and
// every builder draws its cheap procedural stand-in instead, while the browser draws the scans. For budget tests that must count
// what the browser draws: register, for every prop of the manifest, stand-in levels with exactly the manifest's triangle counts
// (a closed lathe of the manifest's size), so scanShape / propsFor return geometry of the true cost.
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { _setScanProp, type PropEntry } from '../../src/render/scanProps';

/** an indexed geometry of exactly `tris` triangles: a jar-like lathe of `sides` segments, the rest a fan cap */
function standIn(tris: number, size: number[]): THREE.BufferGeometry {
  const sides = 16, rings = Math.max(1, Math.floor(tris / (2 * sides))), P: number[] = [], I: number[] = [];
  for (let j = 0; j <= rings; j++) { const y = j / rings, r = 0.5 * (0.5 + 0.5 * Math.sin(Math.PI * y)); for (let s = 0; s < sides; s++) { const a = (s / sides) * Math.PI * 2; P.push(Math.cos(a) * r, y, Math.sin(a) * r); } }
  for (let j = 0; j < rings; j++) for (let s = 0; s < sides; s++) { const a = j * sides + s, b = j * sides + (s + 1) % sides; I.push(a, b, b + sides, a, b + sides, a + sides); }
  let left = tris - I.length / 3; const c = P.length / 3; P.push(0, 0, 0);
  for (let k = 0; left > 0; k++, left--) I.push(c, k % sides, (k + 1) % sides); // (the bottom cap, wrapping when more are due)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
  g.scale(size[0], size[1], size[2]); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
/** register every manifest prop (or the `only` ids) at its true triangle counts; returns how many */
export function registerScanStandIns(only?: string[]): number {
  const man = JSON.parse(readFileSync('public/models/props/manifest.json', 'utf8')) as { assets: Record<string, PropEntry> };
  let n = 0;
  for (const [id, e] of Object.entries(man.assets)) { if (only && !only.includes(id)) continue; const size = e.size_m ?? [0.4, 0.5, 0.4];
    const lods = [standIn(e.tris.lod0, size), standIn(e.tris.lod1 ?? e.tris.lod0, size)];
    _setScanProp({ id, entry: e, lods, map: null, normal: null, arm: null, mean: [0.5, 0.5, 0.5], size: size as [number, number, number] }); n++; }
  return n;
}
/** the houses' vessels (D-310 SHAPES jar, pot, basket, bowl: the scans the house batches take) */
export const VESSEL_IDS = ['ceramic_vase_01', 'ceramic_vase_04', 'antique_ceramic_vase_01', 'ceramic_pot', 'planter_pot_clay', 'wicker_basket_01', 'wicker_basket_02', 'wooden_bowl_01'];
