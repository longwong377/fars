// The plants a walker brushes past on the uncultivated ground (session 9; WORLD_INVENTORY G72): tragacanth thorn cushions
// (Astragalus: grey-green spiny domes on the rocky slopes and the stony steppe; tragacanth gum is a known product of the Zagros:
// B for the plant's presence, C for the stands), camelthorn (Alhagi: low twiggy bushes of the dry plain and fallow edges, green
// through the summer on its deep roots, brown by October; C) and thistles (a stem and a head: green in spring, purple in flower
// May-July, dry straw heads after; C). Drawn only near the viewer (within FLORA_R) from each 8 m cell's context
// (smallLife.ts cells), static positions from a hash of (seed, cell, index), grown in from nothing over the last 20 % of the
// radius so nothing pops. Three InstancedMeshes, receiving shadows, casting none.
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, float, vec3, mix, uniform, length, smoothstep, cameraPosition } from 'three/tsl';
import type { P2 } from '../people/navgrid';
import { CELL, type CellCtx, type SmallWorld } from './smallLife';

export type FloraKind = 'cushion' | 'camelthorn' | 'thistle';
export const FLORA_R = 36;
/** per kind: the contexts and, for each, the share of cells holding it and how many there; size range (m) */
export const FLORA: Record<FloraKind, { name: string; where: Partial<Record<CellCtx, [number, number, number]>>; size: [number, number]; max: number }> = {
  cushion: { name: 'tragacanth thorn cushion (Astragalus)', where: { rock: [0.6, 3, 7], steppe: [0.3, 1, 4] }, size: [0.3, 0.7], max: 900 },
  camelthorn: { name: 'camelthorn (Alhagi)', where: { steppe: [0.3, 2, 5], field: [0.05, 1, 2] }, size: [0.25, 0.5], max: 700 },
  thistle: { name: 'thistles', where: { steppe: [0.25, 2, 6], field: [0.08, 1, 3] }, size: [0.4, 0.9], max: 700 },
};
function h32(...v: number[]) { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h >>> 0; }
const u01 = (...v: number[]) => h32(...v) / 4294967296;
const KIDX: Record<FloraKind, number> = { cushion: 1, camelthorn: 2, thistle: 3 };

/** the season's look (month 0 = January): camelthorn's dryness, the thistles' green, flower and dryness (C) */
export function floraSeason(month: number) {
  const thornDry = [0.8, 0.8, 0.6, 0.3, 0.1, 0.05, 0.05, 0.1, 0.25, 0.6, 0.8, 0.85][month];
  const thistleGreen = [0, 0.2, 0.7, 1, 1, 0.6, 0.2, 0, 0, 0, 0, 0][month], thistleFlower = [0, 0, 0, 0, 0.4, 1, 0.6, 0.1, 0, 0, 0, 0][month];
  return { thornDry, thistleGreen, thistleFlower };
}

// geometry: [position, normal, `part` (0 body, 1 head/tip)]
function build(parts: THREE.BufferGeometry[], tags: number[]): THREE.BufferGeometry {
  const P: number[] = [], N: number[] = [], T: number[] = [];
  parts.forEach((g0, k) => { const g = g0.index ? g0.toNonIndexed() : g0, p = g.getAttribute('position'), n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); T.push(tags[k]); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('part', new THREE.Float32BufferAttribute(T, 1)); return g;
}
/** a cushion: a low dome of unit width, its surface broken into facets (the spines' texture at a distance) */
function cushionGeometry() { const d = new THREE.SphereGeometry(0.5, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2); d.scale(1, 0.55, 1);
  const p = d.getAttribute('position'); for (let i = 0; i < p.count; i++) { const k = 1 + 0.08 * Math.sin(i * 12.9898); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } d.computeVertexNormals(); return build([d], [0]); }
/** camelthorn: twigs radiating up and out from the ground (thin boxes), unit height */
function camelthornGeometry() { const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 9; k++) { const a = k * 2.39996, tilt = 0.35 + 0.3 * ((k * 37) % 7) / 7, b = new THREE.BoxGeometry(0.02, 1, 0.02); b.translate(0, 0.5, 0); b.rotateZ(tilt); b.rotateY(a); parts.push(b); }
  return build(parts, parts.map(() => 1)); }
/** a thistle: a stem (unit height) and a head at its top */
function thistleGeometry() { const s = new THREE.BoxGeometry(0.012, 1, 0.012); s.translate(0, 0.5, 0); const h = new THREE.SphereGeometry(0.035, 6, 4); h.translate(0, 1.0, 0);
  const l1 = new THREE.BoxGeometry(0.16, 0.008, 0.04); l1.translate(0, 0.3, 0); const l2 = new THREE.BoxGeometry(0.04, 0.008, 0.14); l2.translate(0, 0.55, 0);
  return build([s, l1, l2, h], [0, 0, 0, 1]); }

export class GroundFlora {
  readonly group = new THREE.Group();
  readonly meshes = new Map<FloraKind, THREE.InstancedMesh>();
  private uDry = uniform(0.5); private uGreen = uniform(0); private uFlower = uniform(0);
  private cells = new Map<number, CellCtx>();
  private last: { e: number; n: number; month: number } = { e: 1e9, n: 1e9, month: -1 };
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private eu = new THREE.Euler(); private v = new THREE.Vector3(); private s = new THREE.Vector3();
  stats: Record<FloraKind, number> = { cushion: 0, camelthorn: 0, thistle: 0 };
  constructor(private seed: number, private world: SmallWorld) {
    this.group.name = 'ground-flora';
    const geos: Record<FloraKind, THREE.BufferGeometry> = { cushion: cushionGeometry(), camelthorn: camelthornGeometry(), thistle: thistleGeometry() };
    for (const k of Object.keys(FLORA) as FloraKind[]) {
      const g = geos[k], fpos = new THREE.InstancedBufferAttribute(new Float32Array(FLORA[k].max * 3), 3); g.setAttribute('fpos', fpos);
      const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.9, side: THREE.DoubleSide });
      const part = attribute('part', 'float'), d = length(attribute('fpos', 'vec3').xz.sub(cameraPosition.xz)), grow = float(1).sub(smoothstep(FLORA_R * 0.8, FLORA_R, d));
      m.positionNode = positionLocal.mul(grow);
      if (k === 'cushion') m.colorNode = mix(vec3(0.3, 0.33, 0.22), vec3(0.4, 0.42, 0.3), positionLocal.y.mul(3).clamp(0, 1)); // grey-green, paler on top
      else if (k === 'camelthorn') m.colorNode = mix(vec3(0.2, 0.28, 0.1), vec3(0.36, 0.27, 0.17), this.uDry);
      else m.colorNode = mix(mix(vec3(0.48, 0.42, 0.3), vec3(0.2, 0.3, 0.11), this.uGreen), mix(vec3(0.55, 0.47, 0.34), vec3(0.45, 0.2, 0.45), this.uFlower), part);
      const mesh = new THREE.InstancedMesh(g, m, FLORA[k].max); mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = `flora-${k}`;
      mesh.userData = { tier: k === 'cushion' ? 'B/C' : 'C', src: 'SMALL-R', note: `${FLORA[k].name}: near the viewer only, stands and density reconstructed (C)` };
      this.meshes.set(k, mesh); this.group.add(mesh);
    }
  }
  private ctx(ix: number, iy: number): CellCtx {
    const key = (ix + 32768) * 65536 + (iy + 32768); let c = this.cells.get(key);
    if (c === undefined) { if (this.cells.size > 40000) this.cells.clear(); c = this.world.ctxAt((ix + 0.5) * CELL, (iy + 0.5) * CELL); this.cells.set(key, c); }
    return c;
  }
  /** month 0 = January; the viewer's grid position. Rebuilds when the viewer has moved 4 m or the month changed */
  update(month: number, viewer: P2) {
    const S = floraSeason(month); this.uDry.value = S.thornDry; this.uGreen.value = S.thistleGreen; this.uFlower.value = S.thistleFlower;
    if (Math.hypot(viewer[0] - this.last.e, viewer[1] - this.last.n) < 4 && month === this.last.month) return false;
    this.last = { e: viewer[0], n: viewer[1], month };
    const counts: Record<FloraKind, number> = { cushion: 0, camelthorn: 0, thistle: 0 };
    const i0 = Math.floor((viewer[0] - FLORA_R) / CELL), i1 = Math.floor((viewer[0] + FLORA_R) / CELL), j0 = Math.floor((viewer[1] - FLORA_R) / CELL), j1 = Math.floor((viewer[1] + FLORA_R) / CELL);
    for (let ix = i0; ix <= i1; ix++) for (let iy = j0; iy <= j1; iy++) {
      if (Math.hypot((ix + 0.5) * CELL - viewer[0], (iy + 0.5) * CELL - viewer[1]) > FLORA_R + CELL) continue;
      const cx = this.ctx(ix, iy);
      for (const k of Object.keys(FLORA) as FloraKind[]) {
        const w = FLORA[k].where[cx]; if (!w || u01(this.seed, ix, iy, KIDX[k], 31) >= w[0]) continue;
        const n = w[1] + (h32(this.seed, ix, iy, KIDX[k], 32) % (w[2] - w[1] + 1)), mesh = this.meshes.get(k)!, fpos = mesh.geometry.getAttribute('fpos') as THREE.InstancedBufferAttribute;
        for (let i = 0; i < n && counts[k] < FLORA[k].max; i++) {
          const e = (ix + u01(this.seed, ix, iy, i, KIDX[k], 33)) * CELL, nn = (iy + u01(this.seed, ix, iy, i, KIDX[k], 34)) * CELL, y = this.world.ground(e, nn); if (!Number.isFinite(y)) continue;
          const sz = FLORA[k].size[0] + (FLORA[k].size[1] - FLORA[k].size[0]) * u01(this.seed, ix, iy, i, KIDX[k], 35);
          this.eu.set(0, u01(this.seed, ix, iy, i, 36) * 6.283, 0); this.q.setFromEuler(this.eu); this.v.set(e, y - 0.03, -nn);
          this.m4.compose(this.v, this.q, k === 'cushion' ? this.s.set(sz, sz, sz) : this.s.set(sz * 0.8, sz, sz * 0.8));
          const c = counts[k]++; mesh.setMatrixAt(c, this.m4); fpos.setXYZ(c, e, y, -nn);
        }
      }
    }
    for (const k of Object.keys(FLORA) as FloraKind[]) { const m = this.meshes.get(k)!; m.count = counts[k]; m.instanceMatrix.needsUpdate = true; (m.geometry.getAttribute('fpos') as THREE.InstancedBufferAttribute).needsUpdate = true; this.stats[k] = counts[k]; }
    return true;
  }
}
