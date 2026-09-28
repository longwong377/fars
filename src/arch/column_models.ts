// The columns' Blender-built members and shafts in the game (D-328, BLENDER_PLAN rows 1 and 4). tools/blender/build.mjs
// writes public/models/column_<member>.glb for every turned or boxed member of the orders (the bell, square and plain bases,
// the composite capital's palm and calyx bells, the bull capital's collar, the timber orders' bolster and abacus) and
// column_shaft_<kind>.glb for the shaft tiles (fluted stone at 40 and 48 flutes, the unfluted drums, the plastered posts).
// A member model is the game's own member of a reference order (sculpt.ts MEMBER_REF) with its baked normal + occlusion map:
// it is fitted to each order's member box (sculpt.ts memberBox) as the protome is. A shaft tile is a band of the reference
// shaft three drums tall and the whole way round, baked from a dense source (flute arrises, drum joints, the dressing): the
// game keeps its own shaft (sculpt.ts shaftUV: the same triangles, with tile coordinates and tangents) and samples the tile's
// map, offset per column by whole flutes and whole drums (colSeed) so neighbouring columns do not repeat each other.
// When a model is missing (or ?models=0) the procedural part is drawn: the world never lacks a column part.
import * as THREE from 'three/webgpu';
import { texture, uv, normalMap, normalView, attribute } from 'three/tsl';
import { model, type Model } from '../render/models';
import { surfaceMaterial } from '../render/materials';
import { orderMembers, shaftKind, shaftUV, shaftRows, type MemberName, type Omit, type ShaftKind, type Lod, type UVMesh } from './sculpt';
import type { ColumnOrder } from './parts';

export const memberModel = (m: MemberName): Model | null => model(`column_${m}`);
export const shaftModel = (k: ShaftKind): Model | null => model(`column_${k}`);

/** the parts of one column state that Blender-built models draw: the members present in this state (the capital's only once
 *  it is set) whose model is loaded, and the shaft's tile when it is loaded and the shaft is standing */
export function modelledParts(o: ColumnOrder, built: number, st: { fluted?: boolean; capital?: boolean } = {}, off = false): { omit: Omit; members: MemberName[]; shaft: ShaftKind | null } {
  const omit: Omit = {}, members: MemberName[] = [];
  if (off) return { omit, members, shaft: null };
  const capSet = st.capital ?? built >= 1;
  for (const m of orderMembers(o)) { if (!m.startsWith('base_') && !capSet) continue; if (memberModel(m)) { omit[m] = true; members.push(m); } }
  const k = shaftRows(o, built, 0, st.fluted) ? shaftKind(o, built, st.fluted) : null, shaft = k && shaftModel(k) ? k : null;
  if (shaft) omit.shaft = true;
  return { omit, members, shaft };
}

/** a shaft level with its tile coordinates and tangents as a geometry */
export function uvGeometry(m: UVMesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2)); g.setAttribute('tangent', new THREE.BufferAttribute(m.tan, 4));
  g.setIndex(new THREE.BufferAttribute(m.idx, 1)); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
export function shaftGeometry(o: ColumnOrder, built: number, lod: Lod, fluted?: boolean): THREE.BufferGeometry | null {
  const m = shaftUV(o, built, lod, fluted); return m ? uvGeometry(m) : null;
}

/** per column: the tile offset in whole flutes (u) and whole drums (v), from its position (deterministic) */
export function columnSeed(x: number, z: number, flutes: number, drums = 3): [number, number] {
  let h = Math.imul(Math.round(x * 100) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(z * 100) + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  const a = (h >>> 0) / 4294967296, b = ((Math.imul(h, 0x27d4eb2d) >>> 0) / 4294967296);
  return [Math.floor(a * Math.max(1, flutes)) / Math.max(1, flutes), Math.floor(b * drums) / drums];
}

const MATS = new Map<string, THREE.MeshStandardNodeMaterial>();
/** `base` (a surface material: materials.ts, measured albedo, scans, weather) with a model level's packed map: the baked normal
 *  under the surface's own relief, the baked occlusion on the indirect light (as render/models.ts bakedMaterial); `seeded`: the
 *  map is read at the tile coordinates offset by the instance's colSeed (the shafts). Cached per key. */
export function columnBaked(key: string, make: () => THREE.MeshStandardNodeMaterial, map: THREE.Texture, seeded: boolean): THREE.MeshStandardNodeMaterial {
  const hit = MATS.get(key); if (hit) return hit;
  if (seeded) { map.wrapS = map.wrapT = THREE.RepeatWrapping; map.needsUpdate = true; }
  const m = make(), t = texture(map, seeded ? uv().add(attribute('colSeed', 'vec2')) : uv());
  const nMap = normalMap(t.rgb) as any, fine = m.normalNode as any;
  m.normalNode = fine ? nMap.add(fine.sub(normalView)).normalize() : nMap;
  m.aoNode = t.a;
  m.name = `model:${key}`;
  MATS.set(key, m); return m;
}
/** the surface's own baked-model variant (a fresh material of the surface, not the shared procedural one) */
export const bakedSurface = (surface: string, key: string) => () => surfaceMaterial(surface, { variant: `model:${key}` });

/** a dressed drum lying ready in the masons' yard (world placement `at` = its foot's centre): a cylinder with the shaft tiles'
 *  coordinates (u round, v up in units of the tile's height `tileH`), tangents, and its colSeed as a vertex attribute */
export function drumGeometry(r: number, h: number, seg: number, at: [number, number, number], seed: [number, number], tileH: number): THREE.BufferGeometry {
  const pos: number[] = [], nrm: number[] = [], uvs: number[] = [], tan: number[] = [], idx: number[] = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i <= seg; i++) {
    const th = (i / seg) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
    pos.push(at[0] + r * c, at[1] + j * h, at[2] + r * sn); nrm.push(c, 0, sn); uvs.push(i / seg, (j * h) / tileH); tan.push(-sn, 0, c, 1);
  }
  const W = seg + 1; for (let i = 0; i < seg; i++) idx.push(i, W + i, W + i + 1, i, W + i + 1, i + 1);
  for (const [yy, ny] of [[h, 1], [0, -1]] as const) { // the bedding faces (their map is flat: one mid-drum coordinate)
    const o = pos.length / 3;
    for (let i = 0; i < seg; i++) { const th = (i / seg) * Math.PI * 2; pos.push(at[0] + r * Math.cos(th), at[1] + yy, at[2] + r * Math.sin(th)); nrm.push(0, ny, 0); uvs.push(0.5, 0.5 / 3); tan.push(1, 0, 0, 1); }
    for (let i = 1; i + 1 < seg; i++) idx.push(...(ny > 0 ? [o, o + i + 1, o + i] : [o, o + i, o + i + 1]));
  }
  const n = pos.length / 3, g = new THREE.BufferGeometry(), sd = new Float32Array(n * 2); for (let i = 0; i < n; i++) sd.set(seed, i * 2);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('tangent', new THREE.Float32BufferAttribute(tan, 4));
  g.setAttribute('colSeed', new THREE.BufferAttribute(sd, 2)); g.setIndex(idx);
  return g;
}
