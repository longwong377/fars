// Impostor atlas (far trees), baked on the CPU from the same models (as LOD1 draws them), the same leaf-cluster atlas and
// the same seasonal card rules (model.ts cardState) as the near 3-D trees, with the same colour formula as the near leaf shader
// (render.ts leafAlbedo): what a far tree shows is what the near tree would show from that side, today.
//
// Layout: one row per model (species x variant), NV columns = views around the tree (azimuth i * 360/NV deg in the
// tree's own frame, orthographic, horizontal). Colour texel: albedo (mips averaged linear, stored sRGB-encoded) +
// coverage; normal texel: the
// lighting normal in the view's frame (x right, y up, z toward the viewer), encoded 0..1. Re-baked per model row when
// its foliage group's state changes (render.ts). Pure JS (unit-tested: tests/trees.test.ts).
import { cardState, M0, M1, K0, K1, lod1Size, type TreeModel, type V3 } from './model';
import { tileIndex, TILE, COLS, ROWS, TILT, mipChain, type Atlas } from './atlas';
import { TREE_GROUPS } from '../plain/seasonal';

export const NV = 8;
export interface GroupState { leaf: [number, number, number, number]; blossom: [number, number, number, number] }
export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
/** bark albedo (linear) of a species (trees.json bark is sRGB-encoded) */
export const barkLinear = (m: TreeModel): V3 => [srgbToLinear(m.species.bark[0]), srgbToLinear(m.species.bark[1]), srgbToLinear(m.species.bark[2])];

/** the near leaf shader's albedo for one texel of the atlas (render.ts mirrors this) */
export function leafAlbedo(tex: { r: number; g: number; b: number }, leafCol: number[], blCol: number[], bark: number[], tint: number, ao: number): V3 {
  const shade = 0.55 + 0.6 * tex.r, petal = tex.g, bk = tex.b, lm = Math.max(0, 1 - petal - bk), ps = 0.85 + 0.15 * tex.r;
  return [0, 1, 2].map(k => (leafCol[k] * shade * lm + blCol[k] * ps * petal + bark[k] * shade * bk) * tint * ao) as V3;
}

export class ImpostorBaker {
  readonly width: number; readonly height: number;
  /** float working images (colour: linear albedo + alpha; normal: encoded + alpha) */
  readonly col: Float32Array; readonly nrm: Float32Array;
  /** lod 1: the far atlas (what the near LOD1 draws); lod 0: the full model (tests compare the two) */
  constructor(readonly models: TreeModel[], readonly atlas: Atlas, readonly px: number, readonly lod: 0 | 1 = 1) {
    this.width = NV * px; this.height = models.length * px;
    this.col = new Float32Array(this.width * this.height * 4); this.nrm = new Float32Array(this.width * this.height * 4);
  }
  /** bake model row r for its group's state; writes the row into the working images. The impostor shows the tree as
   *  the near LOD1 draws it (the level of detail just inside the near radius): its first M1 segments and first K1 cards
   *  at LOD1_SIZE. Cards are drawn nearest first, so hidden texels are rejected by depth before the atlas is read. */
  bakeRow(r: number, st: GroupState) {
    const m = this.models[r], N = this.px, W = this.width, s = m.species;
    const leafT = tileIndex(s.leaf.tile), twigT = tileIndex(s.twig_tile), blT = s.blossom_tile ? tileIndex(s.blossom_tile) : leafT;
    const bark = barkLinear(m), lc = st.leaf, bc = st.blossom, AL = this.atlas.levels, nL = AL.length;
    const z = new Float32Array(N * N);
    const kc = this.lod ? K1 : K0, km = this.lod ? M1 : M0;
    const states = m.cards.slice(0, Math.min(kc, m.used.cards)).map(cd => ({ cd, cs: cardState(cd, lc[3], bc[3]) })).filter(q => q.cs.size > 0);
    const col = this.col, nrm = this.nrm;
    for (let v = 0; v < NV; v++) {
      const al = (v / NV) * Math.PI * 2, rx = Math.cos(al), rz = -Math.sin(al), dx = Math.sin(al), dz = Math.cos(al); // right, toward the viewer
      const ox = v * N, oy = r * N; z.fill(-1e9);
      for (let j = 0; j < N; j++) { const o0 = ((oy + j) * W + ox) * 4; for (let i = 0; i < N; i++) { col[o0 + i * 4 + 3] = 0; nrm[o0 + i * 4 + 3] = 0; } }
      const k = N / m.T, sx = (x: number) => (x + m.T / 2) * k, sy = (y: number) => (y - m.y0) * k;
      const put = (i: number, j: number, depth: number, cr: number, cg: number, cb: number, n0: number, n1: number, n2: number) => {
        const q = j * N + i; if (depth <= z[q]) return; z[q] = depth;
        const o = ((oy + j) * W + ox + i) * 4;
        col[o] = Math.min(1, cr); col[o + 1] = Math.min(1, cg); col[o + 2] = Math.min(1, cb); col[o + 3] = 1;
        nrm[o] = n0 * 0.5 + 0.5; nrm[o + 1] = n1 * 0.5 + 0.5; nrm[o + 2] = n2 * 0.5 + 0.5; nrm[o + 3] = 1;
      };
      // leaf-cluster cards in today's state, nearest first
      const order = states.map(q => ({ q, d: q.cs.pos[0] * dx + q.cs.pos[2] * dz })).sort((a, b) => b.d - a.d);
      for (const { q } of order) {
        const cd = q.cd, cs = q.cs, tile = cs.isL ? leafT : cs.isB ? blT : twigT, h = (cs.size * (this.lod ? lod1Size(cs.isT, lc[3]) : 1)) / 2;
        const cx = sx(cs.pos[0] * rx + cs.pos[2] * rz), cy = sy(cs.pos[1]), cz = cs.pos[0] * dx + cs.pos[2] * dz;
        const Sx = (cd.side[0] * rx + cd.side[2] * rz) * h * k, Sy = cd.side[1] * h * k, Ux = (cd.up[0] * rx + cd.up[2] * rz) * h * k, Uy = cd.up[1] * h * k;
        const Sz = (cd.side[0] * dx + cd.side[2] * dz) * h, Uz = (cd.up[0] * dx + cd.up[2] * dz) * h;
        const det = Sx * Uy - Sy * Ux; if (Math.abs(det) < 1e-3) continue; // edge-on
        const ext = Math.abs(Sx) + Math.abs(Ux), eyt = Math.abs(Sy) + Math.abs(Uy);
        const lvl = Math.min(nL - 1, Math.max(0, Math.floor(Math.log2(TILE / Math.max(1, 2 * h * k))))), L = AL[lvl], ts = TILE >> lvl, d = L.data, lw = L.width, td = this.atlas.tilt[lvl].data;
        const tx0 = (tile % COLS) * ts, ty0 = Math.floor(tile / COLS) * ts;
        const tint = cd.tint * cd.ao, Sv = cd.side, Uv = cd.up, Nv = cd.n;
        for (let j = Math.max(0, Math.floor(cy - eyt)); j <= Math.min(N - 1, Math.ceil(cy + eyt)); j++)
          for (let i = Math.max(0, Math.floor(cx - ext)); i <= Math.min(N - 1, Math.ceil(cx + ext)); i++) {
            const qx = i + 0.5 - cx, qy = j + 0.5 - cy, a = (qx * Uy - qy * Ux) / det, b = (Sx * qy - Sy * qx) / det; // corner coords -1..1
            if (a < -1 || a > 1 || b < -1 || b > 1) continue;
            const depth = cz + a * Sz + b * Uz; if (depth <= z[j * N + i]) continue;
            const ti = Math.min(ts - 1, ((a * 0.5 + 0.5) * ts) | 0), tj = Math.min(ts - 1, ((b * 0.5 + 0.5) * ts) | 0), o = ((ty0 + tj) * lw + tx0 + ti) * 4;
            if (d[o + 3] < 128) continue;
            // impostor.ts leafAlbedo, inlined
            const tr = d[o] / 255, petal = d[o + 1] / 255, bk = d[o + 2] / 255, shade = 0.55 + 0.6 * tr, lm = Math.max(0, 1 - petal - bk), ps = (0.85 + 0.15 * tr) * petal;
            // the leaf's tilt turns the lighting normal (render.ts leaf shader)
            const tx = (td[o] / 255 * 2 - 1) * TILT, ty = (td[o + 1] / 255 * 2 - 1) * TILT;
            let nx = Nv[0] + Sv[0] * tx + Uv[0] * ty, ny = Nv[1] + Sv[1] * tx + Uv[1] * ty, nz = Nv[2] + Sv[2] * tx + Uv[2] * ty; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
            put(i, j, depth, (lc[0] * shade * lm + bc[0] * ps + bark[0] * shade * bk) * tint, (lc[1] * shade * lm + bc[1] * ps + bark[1] * shade * bk) * tint, (lc[2] * shade * lm + bc[2] * ps + bark[2] * shade * bk) * tint, nx * rx + nz * rz, ny, nx * dx + nz * dz);
          }
      }
      // branches: the projected tube (normal across it, bulging toward the viewer)
      for (let si = 0; si < Math.min(km, m.used.segs); si++) {
        const g = m.segs[si]; if (g.ra <= 0) continue;
        const ax = sx(g.a[0] * rx + g.a[2] * rz), ay = sy(g.a[1]), bx = sx(g.b[0] * rx + g.b[2] * rz), by = sy(g.b[1]);
        const az = g.a[0] * dx + g.a[2] * dz, bz = g.b[0] * dx + g.b[2] * dz, ra = g.ra * k, rb = g.rb * k;
        const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1e-9, l = Math.sqrt(l2), px2 = -ey / l, py2 = ex / l, m2 = Math.max(ra, rb) + 1;
        for (let j = Math.max(0, Math.floor(Math.min(ay, by) - m2)); j <= Math.min(N - 1, Math.ceil(Math.max(ay, by) + m2)); j++)
          for (let i = Math.max(0, Math.floor(Math.min(ax, bx) - m2)); i <= Math.min(N - 1, Math.ceil(Math.max(ax, bx) + m2)); i++) {
            const cx = i + 0.5 - ax, cy = j + 0.5 - ay, t = Math.max(0, Math.min(1, (cx * ex + cy * ey) / l2)), rr = ra + (rb - ra) * t;
            const across = cx * px2 + cy * py2; if (Math.abs(across) >= rr || Math.hypot(cx - ex * t, cy - ey * t) >= rr) continue;
            const sN = across / rr, cN = Math.sqrt(Math.max(0, 1 - sN * sN));
            put(i, j, az + (bz - az) * t + (cN * rr) / k, bark[0], bark[1], bark[2], px2 * sN, py2 * sN, cN);
          }
      }
    }
  }
  /** mip levels of both images (per-tile coverage kept) */
  levels() {
    const nl = Math.max(1, Math.floor(Math.log2(this.px)) - 1);
    return { col: mipChain(this.col, this.width, this.height, this.px, NV, this.models.length, nl, true), nrm: mipChain(this.nrm, this.width, this.height, this.px, NV, this.models.length, nl) };
  }
}
/** foliage group state from the FoliageState table layout (TREE_GROUPS x 2 texels RGBA) */
export function groupStates(table: Float32Array): GroupState[] {
  return TREE_GROUPS.map((_, g) => ({ leaf: Array.from(table.subarray(g * 8, g * 8 + 4)) as any, blossom: Array.from(table.subarray(g * 8 + 4, g * 8 + 8)) as any }));
}
export { ROWS };
