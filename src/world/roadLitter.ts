// What lies on a road that animals walk every day (session 10; gap hunter C, C-F08, C-F09): the droppings of the pack donkeys,
// mules, camels and oxen and the couriers' horses (world/traffic.ts drives them along these roads every day), a few sherds of
// broken jars, and at the halts more of both. Drawn only near the viewer (within LITTER_R), static positions from a hash of
// (seed, road, 4 m step, index), in a band across the road's width; the dung fresh-dark to dry-pale by a hash of its age, washed
// flat by rain is not modelled (C). One InstancedMesh (instance colour), receiving shadows, casting none. All C: a road used by
// animals is never clean; the densities by reasoning (a string of five donkeys every few hours).
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, float, length, smoothstep, cameraPosition } from 'three/tsl';
import type { P2 } from '../people/navgrid';

export const LITTER_R = 30;
export interface LitterRoad { id: string; pts: P2[]; width: number; /** relative traffic (1 = the royal road) */ use: number }
function h32(...v: number[]) { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h >>> 0; }
const u01 = (...v: number[]) => h32(...v) / 4294967296;
/** a clump of droppings (a few flattened lumps) or a sherd (a curved flat piece), unit size; `kind` attribute 0 dung, 1 sherd */
function litterGeometry() {
  const parts: THREE.BufferGeometry[] = [], kinds: number[] = [];
  for (let k = 0; k < 4; k++) { const s = new THREE.SphereGeometry(0.035 + 0.01 * (k % 2), 5, 3); s.scale(1, 0.55, 1.2); s.translate(0.05 * Math.cos(k * 2.1), 0.012, 0.05 * Math.sin(k * 2.1)); parts.push(s); kinds.push(0); }
  const c = new THREE.CylinderGeometry(0.16, 0.16, 0.012, 7, 1, true, 0, 1.1); c.rotateZ(Math.PI / 2); c.translate(0, 0.02, 0); c.translate(0.5, 0, 0); parts.push(c); kinds.push(1);
  const P: number[] = [], N: number[] = [], K: number[] = [];
  parts.forEach((g0, i) => { const g = g0.index ? g0.toNonIndexed() : g0, p = g.getAttribute('position'), n = g.getAttribute('normal'); for (let j = 0; j < p.count; j++) { P.push(p.getX(j), p.getY(j), p.getZ(j)); N.push(n.getX(j), n.getY(j), n.getZ(j)); K.push(kinds[i]); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('kind', new THREE.Float32BufferAttribute(K, 1)); return g;
}
export class RoadLitter {
  readonly mesh: THREE.InstancedMesh; readonly max = 1500; count = 0;
  private last: P2 = [1e9, 1e9]; private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private eu = new THREE.Euler(); private v = new THREE.Vector3(); private s = new THREE.Vector3(); private col = new THREE.Color();
  constructor(private seed: number, private roads: LitterRoad[], private ground: (e: number, n: number) => number, private halts: P2[] = []) {
    const g = litterGeometry(), fpos = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3), kindA = new THREE.InstancedBufferAttribute(new Float32Array(this.max), 1);
    g.setAttribute('fpos', fpos); g.setAttribute('which', kindA);
    const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, side: THREE.DoubleSide });
    const d = length(attribute('fpos', 'vec3').xz.sub(cameraPosition.xz)), grow = float(1).sub(smoothstep(LITTER_R * 0.8, LITTER_R, d));
    // each instance is either the dung clump (its sherd part collapsed) or the sherd (its lumps collapsed)
    const keep = float(1).sub(attribute('kind', 'float').sub(attribute('which', 'float')).abs());
    m.positionNode = positionLocal.mul(grow.mul(keep));
    this.mesh = new THREE.InstancedMesh(g, m, this.max); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.name = 'road-litter';
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this.mesh.userData = { tier: 'C', src: 'RECON', note: 'droppings of the pack and draught animals and a few broken sherds on the roads the traffic uses, more at the halts: near the viewer only, densities reconstructed (C)' };
  }
  /** rebuild when the viewer has moved 3 m */
  update(viewer: P2) {
    if (Math.hypot(viewer[0] - this.last[0], viewer[1] - this.last[1]) < 3) return false; this.last = [viewer[0], viewer[1]];
    const fpos = this.mesh.geometry.getAttribute('fpos') as THREE.InstancedBufferAttribute, which = this.mesh.geometry.getAttribute('which') as THREE.InstancedBufferAttribute; let c = 0;
    const put = (e: number, n: number, kind: number, key: number[]) => { if (c >= this.max) return; const y = this.ground(e, n); if (!Number.isFinite(y)) return;
      const sz = kind ? 0.6 + 0.8 * u01(...key, 5) : 0.8 + 0.7 * u01(...key, 5); this.eu.set(0, u01(...key, 6) * 6.283, 0); this.q.setFromEuler(this.eu);
      this.m4.compose(this.v.set(e, y, -n), this.q, this.s.set(sz, sz, sz)); this.mesh.setMatrixAt(c, this.m4); fpos.setXYZ(c, e, y, -n); which.setX(c, kind);
      const age = u01(...key, 7); if (kind) this.col.setRGB(0.55 + 0.1 * age, 0.36 + 0.06 * age, 0.24); else this.col.setRGB(0.12 + 0.3 * age, 0.1 + 0.24 * age, 0.06 + 0.17 * age); // (sherds buff-red; dung dark when fresh, pale straw-grey when dry)
      this.mesh.setColorAt(c, this.col); c++; };
    this.roads.forEach((R, ri) => { let s0 = 0;
      for (let i = 1; i < R.pts.length; i++) { const [a, b] = [R.pts[i - 1], R.pts[i]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
        const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
        // the stretch of this segment within reach
        const t = Math.max(0, Math.min(L, (viewer[0] - a[0]) * ux + (viewer[1] - a[1]) * uy)), px = a[0] + ux * t, py = a[1] + uy * t;
        if (Math.hypot(viewer[0] - px, viewer[1] - py) > LITTER_R + R.width) { s0 += L; continue; }
        const lo = Math.max(0, Math.floor((t - LITTER_R - 4) / 4)), hi = Math.min(Math.floor(L / 4), Math.ceil((t + LITTER_R + 4) / 4));
        for (let k = lo; k <= hi; k++) { const step = Math.floor((s0 + k * 4) / 4), key = [this.seed, ri, step];
          const nd = u01(...key, 1) < 0.8 * R.use ? 1 + (h32(...key, 2) % 3) : 0, ns = u01(...key, 3) < 0.06 * R.use ? 1 : 0;
          for (let j = 0; j < nd + ns; j++) { const along = k * 4 + 4 * u01(...key, j, 8), across = (u01(...key, j, 9) - 0.5) * R.width * (j < nd ? 0.7 : 1.1);
            const e = a[0] + ux * along - uy * across, n = a[1] + uy * along + ux * across; if (Math.hypot(e - viewer[0], n - viewer[1]) > LITTER_R) continue; put(e, n, j < nd ? 0 : 1, [...key, j]); } }
        s0 += L; } });
    // the halts (the stair foot's tether lines, the road station): more of both in a 25 m ring
    this.halts.forEach(([hx, hy], hi) => { if (Math.hypot(hx - viewer[0], hy - viewer[1]) > LITTER_R + 25) return;
      for (let j = 0; j < 90; j++) { const key = [this.seed, 900 + hi, j], r = 25 * Math.sqrt(u01(...key, 1)), a = u01(...key, 2) * 6.283, e = hx + r * Math.cos(a), n = hy + r * Math.sin(a);
        if (Math.hypot(e - viewer[0], n - viewer[1]) > LITTER_R) continue; put(e, n, u01(...key, 3) < 0.12 ? 1 : 0, key); } });
    this.count = c; this.mesh.count = c; this.mesh.instanceMatrix.needsUpdate = true; fpos.needsUpdate = true; which.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return true;
  }
}
