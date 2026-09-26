// Chunked, distance-LOD terrain meshes for the three rings (brief §6 Streaming; D-006). Each ring is split into
// 128-cell chunks; each chunk picks a power-of-two vertex step by camera distance and hides cracks with skirts.
// Coarser rings skip the chunks covered by the finer ring (the ring extents are chunk-aligned by construction).
import * as THREE from 'three/webgpu';
import { Ring, Terrain } from './heightfield';
import { surfaceMaterial } from '../render/materials';

interface Chunk { ring: Ring; r0: number; c0: number; cells: number; center: THREE.Vector3; radius: number; lods: Map<number, THREE.BufferGeometry>; mesh: THREE.Mesh; step: number; err: number[] | null }
const STEPS = [1, 2, 4, 8, 16];
/** LOD thresholds (geomipmapping, de Boer 2000): a step is allowed when its worst height error, seen from the camera,
 *  subtends ≤ ERR_RAD (≈ 1.5 px at 1440p / 70° vertical FOV) and its vertex spacing ≤ SPACING_RAD (keeps shading and
 *  silhouettes from turning into large facets even on flat ground) */
const ERR_RAD = 0.0013, SPACING_RAD = 0.02;

/** Ground colour: procedural and tier C. It will be replaced by calibrated materials in Phase 3 (flagged in the dev overlay). */
function groundColour(h: number, slope: number, out: THREE.Color) {
  // alluvial plain: pale buff-brown loam; slopes: limestone scree; very steep: darker rock. D-232: the plain's dry calcareous
  // loam Munsell 10YR 5.5/3 (Y 0.24; was 10YR 4/2, Y 0.12, a moist soil's colour), the rock warm grey-brown 10YR 5/2 and
  // 10YR 3.5/2 (terrainPlain.ts HILL; was a neutral grey): the photographs' and the satellite image's buff mountain and plain
  const soil = [0.606, 0.512, 0.398], rock = [0.530, 0.467, 0.393], dark = [0.381, 0.318, 0.249];
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
    this.material = surfaceMaterial('earth', { vertexColors: true });
    this.group.userData = { tier: 'B', src: 'COP-DEM', note: 'Copernicus GLO-30 bare-earth approximation (D-006); ground colour procedural C' };
    // the chunks are Terrain.chunks(): the same list the physics colliders are built from (physics.ts, audit D M1)
    for (const tc of terrain.chunks()) {
      const { ring, r0, c0, cells: CH, x0, z0, size } = tc;
      let hmin = Infinity, hmax = -Infinity;
      for (let r = 0; r <= CH; r += 4) for (let c = 0; c <= CH; c += 4) { const h = ring.at(r0 + r, c0 + c); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); }
      const center = new THREE.Vector3(x0 + size / 2, (hmin + hmax) / 2, z0 + size / 2);
      const radius = Math.hypot(size / 2, size / 2, (hmax - hmin) / 2);
      const mesh = new THREE.Mesh(undefined, this.material);
      mesh.receiveShadow = true; mesh.castShadow = ring === this.terrain.near; mesh.matrixAutoUpdate = false;
      mesh.userData = this.group.userData;
      this.chunks.push({ ring, r0, c0, cells: CH, center, radius, lods: new Map(), mesh, step: -1, err: null });
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
  /** worst vertical error (m) of each decimation step against the full-resolution heights: the bilinear surface of the
   *  decimated grid versus every sample it skips (computed once per chunk, on first use) */
  private chunkErrors(ch: Chunk): number[] {
    const { ring, r0, c0, cells } = ch, H = (r: number, c: number) => ring.at(Math.min(ring.n - 1, r), Math.min(ring.n - 1, c));
    return STEPS.map(s => { if (s === 1) return 0; let worst = 0;
      for (let i = 0; i <= cells; i++) { const ri = Math.floor(i / s) * s, ty = (i - ri) / s, ri2 = Math.min(cells, ri + s);
        for (let j = 0; j <= cells; j++) { const cj = Math.floor(j / s) * s, tx = (j - cj) / s, cj2 = Math.min(cells, cj + s);
          if (!ty && !tx) continue;
          const h = (H(r0 + ri, c0 + cj) * (1 - tx) + H(r0 + ri, c0 + cj2) * tx) * (1 - ty) + (H(r0 + ri2, c0 + cj) * (1 - tx) + H(r0 + ri2, c0 + cj2) * tx) * ty;
          worst = Math.max(worst, Math.abs(h - H(r0 + i, c0 + j))); } }
      return worst; });
  }
  /** choose LOD per chunk: the coarsest step whose height error and vertex spacing, seen from the camera, stay under
   *  ERR_RAD and SPACING_RAD ÷ lodBias: the bias is a detail factor (high 1; ultra 1.5 finer, test 0.35 coarser). It was a
   *  multiplier, so the scale ran backwards: ultra drew the coarsest terrain (3.3 M tris at the stair-dawn view) and test the
   *  finest (9.9 M) (Phase 6+7 review, session 8, C1) */
  update(camPos: THREE.Vector3) {
    for (const ch of this.chunks) {
      const d = Math.max(1, camPos.distanceTo(ch.center) - ch.radius);
      const err = (ch.err ??= this.chunkErrors(ch));
      let step = 1;
      for (let k = 1; k < STEPS.length; k++) { const s = STEPS[k]; if (err[k] / d <= ERR_RAD / this.lodBias && (s * ch.ring.cell) / d <= SPACING_RAD / this.lodBias) step = s; else break; }
      if (step !== ch.step) {
        let g = ch.lods.get(step); if (!g) { g = this.buildGeometry(ch, step); ch.lods.set(step, g); }
        ch.mesh.geometry = g; ch.step = step;
      }
    }
  }
  stats() { let tris = 0; for (const ch of this.chunks) tris += (ch.mesh.geometry.index?.count ?? 0) / 3; return { chunks: this.chunks.length, tris }; }
}
