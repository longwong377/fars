// Chunked, distance-LOD terrain meshes for the three rings (brief §6 Streaming; D-006). Each ring is split into
// 128-cell chunks; each chunk picks a power-of-two vertex step by camera distance and hides cracks with skirts.
// Coarser rings skip the chunks covered by the finer ring (the ring extents are chunk-aligned by construction).
import * as THREE from 'three/webgpu';
import { Ring, Terrain } from './heightfield';

const CHUNK = 128;
interface Chunk { ring: Ring; r0: number; c0: number; cells: number; center: THREE.Vector3; radius: number; lods: Map<number, THREE.BufferGeometry>; mesh: THREE.Mesh; step: number }

/** Ground colour: procedural and tier C. It will be replaced by calibrated materials in Phase 3 (flagged in the dev overlay). */
function groundColour(h: number, slope: number, out: THREE.Color) {
  // alluvial plain: pale buff-brown loam; slopes: grey limestone scree; very steep: darker rock
  const soil = [0.43, 0.36, 0.27], rock = [0.52, 0.5, 0.47], dark = [0.36, 0.34, 0.31];
  const s = Math.min(1, Math.max(0, (slope - 0.15) / 0.35)), d = Math.min(1, Math.max(0, (slope - 0.9) / 0.6));
  const c = soil.map((v, i) => v * (1 - s) + rock[i] * s).map((v, i) => v * (1 - d) + dark[i] * d);
  out.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
}

export class TerrainMesh {
  readonly group = new THREE.Group();
  private chunks: Chunk[] = [];
  private material: THREE.MeshStandardNodeMaterial;
  constructor(readonly terrain: Terrain, private lodBias = 1) {
    this.group.name = 'terrain';
    this.material = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    this.group.userData = { tier: 'B', src: 'COP-DEM', note: 'Copernicus GLO-30 bare-earth approximation (D-006); ground colour procedural C' };
    this.addRing(terrain.near, null);
    this.addRing(terrain.mid, terrain.near.half);
    this.addRing(terrain.far, terrain.mid.half);
  }
  private addRing(ring: Ring, holeHalf: number | null) {
    const nChunks = (ring.n - 1) / CHUNK;
    for (let cr = 0; cr < nChunks; cr++) for (let cc = 0; cc < nChunks; cc++) {
      const x0 = -ring.half + cc * CHUNK * ring.cell, z0 = -ring.half + cr * CHUNK * ring.cell, size = CHUNK * ring.cell;
      if (holeHalf !== null && x0 >= -holeHalf - 1e-6 && x0 + size <= holeHalf + 1e-6 && z0 >= -holeHalf - 1e-6 && z0 + size <= holeHalf + 1e-6) continue;
      let hmin = Infinity, hmax = -Infinity;
      for (let r = 0; r <= CHUNK; r += 4) for (let c = 0; c <= CHUNK; c += 4) { const h = ring.at(cr * CHUNK + r, cc * CHUNK + c); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); }
      const center = new THREE.Vector3(x0 + size / 2, (hmin + hmax) / 2, z0 + size / 2);
      const radius = Math.hypot(size / 2, size / 2, (hmax - hmin) / 2);
      const mesh = new THREE.Mesh(undefined, this.material);
      mesh.receiveShadow = true; mesh.castShadow = ring === this.terrain.near; mesh.matrixAutoUpdate = false;
      mesh.userData = this.group.userData;
      this.chunks.push({ ring, r0: cr * CHUNK, c0: cc * CHUNK, cells: CHUNK, center, radius, lods: new Map(), mesh, step: -1 });
      this.group.add(mesh);
    }
  }
  private buildGeometry(ch: Chunk, step: number): THREE.BufferGeometry {
    const { ring } = ch, n = ch.cells / step + 1, cell = ring.cell;
    const x0 = -ring.half + ch.c0 * cell, z0 = -ring.half + ch.r0 * cell;
    const verts = n * n + 4 * n; // + skirts
    const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), col = new Float32Array(verts * 3);
    const tmp = new THREE.Color();
    const H = (r: number, c: number) => ring.at(Math.min(ring.n - 1, Math.max(0, r)), Math.min(ring.n - 1, Math.max(0, c)));
    let k = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const r = ch.r0 + i * step, c = ch.c0 + j * step, h = H(r, c);
      pos[k * 3] = x0 + j * step * cell; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z0 + i * step * cell;
      const dx = (H(r, c + 1) - H(r, c - 1)) / (2 * cell), dz = (H(r + 1, c) - H(r - 1, c)) / (2 * cell);
      const l = Math.hypot(dx, 1, dz); nor[k * 3] = -dx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -dz / l;
      groundColour(h, Math.hypot(dx, dz), tmp); col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
      k++;
    }
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
    // skirts: duplicate edge vertices dropped by an amount proportional to the cell size
    const drop = step * cell * 0.6 + 1;
    const edges: number[][] = [[...Array(n).keys()].map(j => j), [...Array(n).keys()].map(j => (n - 1) * n + j), [...Array(n).keys()].map(i => i * n), [...Array(n).keys()].map(i => i * n + n - 1)];
    for (let e = 0; e < 4; e++) {
      const base = k;
      for (const v of edges[e]) { pos.set([pos[v * 3], pos[v * 3 + 1] - drop, pos[v * 3 + 2]], k * 3); nor.set(nor.subarray(v * 3, v * 3 + 3), k * 3); col.set(col.subarray(v * 3, v * 3 + 3), k * 3); k++; }
      for (let t = 0; t < n - 1; t++) { const a = edges[e][t], b = edges[e][t + 1], c = base + t, d = base + t + 1; idx.push(a, c, b, b, c, d, a, b, c, b, d, c); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(verts > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(ch.center, ch.radius);
    return g;
  }
  /** choose LOD per chunk from camera distance (screen-space-ish error: vertex spacing / distance). */
  update(camPos: THREE.Vector3) {
    for (const ch of this.chunks) {
      const d = Math.max(1, camPos.distanceTo(ch.center) - ch.radius);
      const target = (d * 0.004) / (ch.ring.cell * this.lodBias); // allow ~0.004 rad per vertex spacing
      let step = 1; while (step < 16 && step * 2 <= target) step *= 2;
      if (step !== ch.step) {
        let g = ch.lods.get(step); if (!g) { g = this.buildGeometry(ch, step); ch.lods.set(step, g); }
        ch.mesh.geometry = g; ch.step = step;
      }
    }
  }
  stats() { let tris = 0; for (const ch of this.chunks) tris += (ch.mesh.geometry.index?.count ?? 0) / 3; return { chunks: this.chunks.length, tris }; }
}
