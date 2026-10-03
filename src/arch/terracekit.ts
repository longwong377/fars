// D-803: the Terrace kit in the game (batch 1): the palaces' wall-head cornice and wall-foot plinth from tools/blender/terracekit.py
// (src/arch/terracekit.json: modelled and AO-baked in Blender, painted in D-755's palette), instanced along every palace wall
// run (roofedge.ts heads and wallFeet runs): each run cut into whole modules ~1 m long (x scaled to fit), near pieces modelled
// (the cavetto's tongues, the torus roll) within PIECE_SWITCH, a few-triangle level beyond (palacekit.ts PieceLOD). The vertex
// colour is the paint x the piece's shade x its baked AO; the mud scan's grain over it (the material the roofs' drip patches
// already compile: no new pipeline).
import * as THREE from 'three/webgpu';
import data from './terracekit.json';
import type { KitRun } from './roofedge';
import { PieceLOD } from './palacekit';
import { propMaterial } from '../render/materials';

interface KitPiece { p: number[]; n: number[]; ao: number[]; k: number[]; c: number[]; i: number[]; tris: number }
export const TERRACE_KIT = (data as any).pieces as Record<string, KitPiece>;
/** the drawn triangles' bound: every module at its far level, and at most NEAR_CAP modules of a variant at the near one (the near
 *  level is drawn within PIECE_SWITCH = 28 m: under 2 x pi x 28 = 176 m of wall heads or feet in reach, in three or two variants) */
export const NEAR_CAP = 120;
const KINDS = { cornice: { near: ['cornice0', 'cornice1', 'cornice2'], far: 'corniceL' }, plinth: { near: ['plinth0', 'plinth1'], far: 'plinthL' } };

export function kitGeometry(name: string): THREE.BufferGeometry {
  const q = TERRACE_KIT[name]; if (!q) throw new Error(`terracekit: no piece ${name}`);
  const nv = q.p.length / 3, col = new Float32Array(nv * 3), c = new THREE.Color();
  for (let v = 0; v < nv; v++) { c.setRGB(q.c[v * 3], q.c[v * 3 + 1], q.c[v * 3 + 2], THREE.SRGBColorSpace); const s = q.k[v] * Math.max(0.15, q.ao[v]); col[v * 3] = c.r * s; col[v * 3 + 1] = c.g * s; col[v * 3 + 2] = c.b * s; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(q.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(q.n, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(q.i); return g;
}
/** the module matrices along a run: x along the run scaled to the module's length, y up, z out of the face; origin at the foot */
export function runMatrices(r: KitRun, y: number, out: THREE.Matrix4[] = []): THREE.Matrix4[] {
  const n = Math.max(1, Math.round(r.len)), seg = r.len / n, X = new THREE.Vector3(r.u[0] * seg, 0, -r.u[1] * seg), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(r.n[0], 0, -r.n[1]);
  for (let i = 0; i < n; i++) { const e = r.a[0] + r.u[0] * i * seg, nn = r.a[1] + r.u[1] * i * seg; out.push(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(e, y, -nn)); }
  return out;
}
/** the kit's pieces over the heads (cornices, their tops at the roof line) and the feet (plinths) */
export function buildTerraceKit(heads: KitRun[], feet: KitRun[], cornH = 0.72): { group: THREE.Group; triangles: number; counts: Record<string, number> } {
  const group = new THREE.Group(); group.name = 'terracekit'; let triangles = 0; const counts: Record<string, number> = {};
  const mat = propMaterial('mud', { vertexColors: true });
  const place = (kind: keyof typeof KINDS, runs: KitRun[], dy: number) => {
    const K = KINDS[kind], by = new Map<string, THREE.Matrix4[]>(); let h = 0;
    for (const r of runs) for (const m of runMatrices(r, r.y + dy)) { const name = K.near[(h++ * 2654435761 >>> 0) % K.near.length]; (by.get(name) ?? by.set(name, []).get(name)!).push(m); }
    for (const [name, mats] of by) {
      const lod = new PieceLOD([kitGeometry(name), kitGeometry(K.far)], mat, mats); lod.name = `terracekit:${name}`;
      lod.userData = { tier: 'C', src: 'RECON;NR-TOMB;D-755', placeholder: false, model: 'terracekit', note: kind === 'cornice'
        ? 'the palaces\' wall-head cornice: the Egyptian gorge of the stone frames and the Naqsh-e Rustam facades (A for the form) in painted plaster (C), modelled and AO-baked in Blender (tools/blender/terracekit.py; D-803)'
        : 'the palaces\' wall-foot plinth: a torus base in red ochre plaster (C), modelled and AO-baked in Blender (tools/blender/terracekit.py; D-803)' };
      lod.levels.forEach((im, k) => { im.name = `${lod.name}:lod${k}`; im.userData = lod.userData; });
      triangles += TERRACE_KIT[K.far].tris * mats.length + (TERRACE_KIT[name].tris - TERRACE_KIT[K.far].tris) * Math.min(mats.length, NEAR_CAP); counts[name] = mats.length; group.add(lod);
    }
  };
  place('cornice', heads, -cornH); place('plinth', feet, 0);
  return { group, triangles, counts };
}
