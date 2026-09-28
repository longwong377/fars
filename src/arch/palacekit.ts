// D-334: the palaces' roof-edge kit (tools/blender/palacekit.py -> src/data/palacekit.json: the joists' ends of the porticos'
// dentil rows and the parapets' rain spouts, modelled and AO-baked in Blender) drawn at every place roofedge.ts gives, as
// instanced meshes with two levels by distance (the modelled piece near, a 12-triangle block beyond PIECE_SWITCH). The
// vertex colour is the surface's albedo x the piece's shade x its baked AO; the surface (cedar, its scan) does the rest.
import * as THREE from 'three/webgpu';
import data from '../data/palacekit.json';
import type { Piece } from './roofedge';
import { surfaceMaterial, SURFACES } from '../render/materials';

export interface KitPiece { p: number[]; n: number[]; ao: number[]; k: number[]; i: number[]; tris: number }
export const PALACE_KIT = (data as any).pieces as Record<string, KitPiece>;
export const PALACE_KIT_SOURCE = 'tools/blender/palacekit.py (Blender 5.0.1, Cycles vertex AO); src/data/palacekit.json';
/** m: the distance (from the eye to the piece) where the modelled level gives way to the block; hysteresis ± 2 m */
export const PIECE_SWITCH = 28;
const VARIANTS: Record<Piece['kind'], { near: string[]; far: string; ref: number }> = {
  dentil: { near: ['dentil0', 'dentil1', 'dentil2'], far: 'dentilL', ref: 0.16 },
  spout: { near: ['spout0', 'spout1'], far: 'spoutL', ref: 1 },
};

export function pieceGeometry(name: string, albedo: [number, number, number]): THREE.BufferGeometry {
  const q = PALACE_KIT[name]; if (!q) throw new Error(`palacekit: no piece ${name}`);
  const c = new THREE.Color().setRGB(albedo[0], albedo[1], albedo[2], THREE.SRGBColorSpace), nv = q.p.length / 3, col = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) { const s = q.k[v] * Math.max(0.15, q.ao[v]); col[v * 3] = c.r * s; col[v * 3 + 1] = c.g * s; col[v * 3 + 2] = c.b * s; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(q.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(q.n, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(q.i); return g;
}
/** the instance's matrix: its foot on the wall face at (e, y, n), local z along the outward normal (grid azimuth az), z scaled */
export function pieceMatrix(p: Piece, ref: number, m = new THREE.Matrix4()): THREE.Matrix4 {
  const th = p.az + Math.PI / 2, c = Math.cos(th), s = Math.sin(th), sz = p.len / ref;
  return m.set(c, 0, s * sz, p.e, 0, 1, 0, p.y, -s, 0, c * sz, -p.n, 0, 0, 0, 1);
}

const isPerspective = (c: THREE.Camera) => (c as THREE.PerspectiveCamera).isPerspectiveCamera === true;
/** two instanced levels of one piece with per-instance transforms; the view camera switches each instance by its distance
 *  (the shadow pass draws what the camera sees, as meshes.ts InstancedLOD) */
export class PieceLOD extends THREE.Object3D {
  readonly isLOD = true; autoUpdate = true;
  readonly levels: THREE.InstancedMesh[]; private level: Uint8Array; private mats: THREE.Matrix4[]; private at: Float32Array;
  constructor(geos: THREE.BufferGeometry[], mat: THREE.Material, mats: THREE.Matrix4[], private switchAt = PIECE_SWITCH, private hyst = 2) {
    super(); this.mats = mats; this.at = new Float32Array(mats.length * 3);
    mats.forEach((m, i) => { this.at[i * 3] = m.elements[12]; this.at[i * 3 + 1] = m.elements[13]; this.at[i * 3 + 2] = m.elements[14]; });
    this.levels = geos.map(g => { const im = new THREE.InstancedMesh(g, mat, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.computeBoundingSphere(); im.castShadow = im.receiveShadow = true; this.add(im); return im; });
    this.level = new Uint8Array(mats.length).fill(geos.length - 1); this.assign();
  }
  update(camera: THREE.Camera) {
    if (!isPerspective(camera)) return;
    const e = camera.matrixWorld.elements, A = this.at; let changed = false;
    for (let i = 0; i < this.level.length; i++) {
      const d = Math.hypot(e[12] - A[i * 3], e[13] - A[i * 3 + 1], e[14] - A[i * 3 + 2]);
      const want = this.level[i] === 0 ? (d > this.switchAt + this.hyst ? 1 : 0) : (d < this.switchAt - this.hyst ? 0 : 1);
      if (want !== this.level[i]) { this.level[i] = want; changed = true; }
    }
    if (changed) this.assign();
  }
  counts() { return this.levels.map(im => im.count); }
  private assign() {
    const cnt = this.levels.map(() => 0);
    for (let i = 0; i < this.level.length; i++) { const L = this.level[i]; this.levels[L].setMatrixAt(cnt[L]++, this.mats[i]); }
    this.levels.forEach((im, k) => { im.count = cnt[k]; im.visible = cnt[k] > 0; im.instanceMatrix.needsUpdate = true; });
  }
}

/** every piece of the roof edges as instanced levels (one PieceLOD per variant), and the triangles at full detail */
export function buildPieces(pieces: Piece[], flat = false): { group: THREE.Group; triangles: number; counts: Record<string, number> } {
  const group = new THREE.Group(); group.name = 'roofedge:pieces'; let triangles = 0; const counts: Record<string, number> = {};
  const byVar = new Map<string, THREE.Matrix4[]>();
  pieces.forEach((p, i) => { const V = VARIANTS[p.kind], name = V.near[(i * 2654435761 >>> 0) % V.near.length];
    (byVar.get(name) ?? byVar.set(name, []).get(name)!).push(pieceMatrix(p, V.ref)); });
  const albedo = SURFACES.timber.albedo, mat = flat ? new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.8 }) : surfaceMaterial('timber', { vertexColors: true });
  for (const [name, mats] of byVar) {
    const kind = (Object.keys(VARIANTS) as Piece['kind'][]).find(k => VARIANTS[k].near.includes(name))!;
    const lod = new PieceLOD([pieceGeometry(name, albedo), pieceGeometry(VARIANTS[kind].far, albedo)], mat, mats);
    lod.name = `roofedge:${name}`; lod.userData = { tier: 'C', src: 'RECON;NR-TOMB', placeholder: false, model: 'palacekit', note: `${kind === 'dentil' ? 'the portico joists\' ends (the dentil row)' : 'rain spout through the parapet'}: modelled and AO-baked in Blender (${PALACE_KIT_SOURCE}; D-334, C)` };
    lod.levels.forEach((im, k) => { im.name = `${lod.name}:lod${k}`; im.userData = lod.userData; });
    triangles += PALACE_KIT[name].tris * mats.length; counts[name] = mats.length; group.add(lod);
  }
  return { group, triangles, counts };
}
