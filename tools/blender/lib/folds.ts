// The garments' fold atlas (D-322): the part of Blender's settled cloth finer than a level of detail's mesh, as a height map
// in an atlas of every garment piece. Charts: one per connected part of a piece (a sleeve, the kandys's cape, a sash end),
// laid out by the piece's own parameter (outfits.ts Geo.puv: a tube's column and length parameter, a shell's body UV), so
// every level of detail of the piece finds the same place in the atlas; each chart is sized by its measured surface
// (metres per parameter unit, both ways) at one texel density for the whole atlas, shelf-packed with a gutter.
// The heights are splatted from the settled simulation's triangles (barycentric rasterisation) and the charts dilated into
// their gutters (mip-mapping and bilinear reads do not bleed the empty atlas into the folds).

export interface Chart { piece: string; comp: number; u0: number; v0: number; du: number; dv: number; x: number; y: number; w: number; h: number }
export interface Part { piece: string; comp: number; /** parameter bbox */ u0: number; v0: number; du: number; dv: number; /** metres per parameter unit */ mu: number; mv: number }

/** connected parts of a mesh (vertex → part id, parts numbered by their lowest vertex) */
export function parts(n: number, idx: ArrayLike<number>): Int32Array {
  const par = Int32Array.from({ length: n }, (_, i) => i); const find = (a: number): number => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]); const m = Math.min(a, b, c); par[a] = m; par[b] = m; par[c] = m; }
  const root = Int32Array.from({ length: n }, (_, i) => find(i)), id = new Map<number, number>(); const out = new Int32Array(n);
  for (let i = 0; i < n; i++) { let k = id.get(root[i]); if (k === undefined) { k = id.size; id.set(root[i], k); } out[i] = k; }
  return out;
}
/** a part's parameter bbox and its metres per parameter unit (triangles' Jacobians, area-weighted; triangles whose parameter
 *  spans more than `seam` of the bbox — a tube's closing seam, the body UV's islands — are left out) */
export function measurePart(piece: string, comp: number, pos: Float32Array, puv: Float32Array, idx: ArrayLike<number>, pid: Int32Array, seam = 0.25): Part {
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (let i = 0; i < pid.length; i++) if (pid[i] === comp) { u0 = Math.min(u0, puv[i * 2]); u1 = Math.max(u1, puv[i * 2]); v0 = Math.min(v0, puv[i * 2 + 1]); v1 = Math.max(v1, puv[i * 2 + 1]); }
  const du = Math.max(1e-4, u1 - u0), dv = Math.max(1e-4, v1 - v0); let su = 0, sv = 0, sa = 0;
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; if (pid[a] !== comp) continue;
    const e1u = puv[b * 2] - puv[a * 2], e1v = puv[b * 2 + 1] - puv[a * 2 + 1], e2u = puv[c * 2] - puv[a * 2], e2v = puv[c * 2 + 1] - puv[a * 2 + 1];
    if (Math.max(Math.abs(e1u), Math.abs(e2u), Math.abs(e1u - e2u)) > seam * du || Math.max(Math.abs(e1v), Math.abs(e2v), Math.abs(e1v - e2v)) > seam * dv) continue;
    const det = e1u * e2v - e2u * e1v; if (Math.abs(det) < 1e-12) continue;
    const p1 = [0, 1, 2].map(k => pos[b * 3 + k] - pos[a * 3 + k]), p2 = [0, 1, 2].map(k => pos[c * 3 + k] - pos[a * 3 + k]);
    const Ju = p1.map((x, k) => (x * e2v - p2[k] * e1v) / det), Jv = p1.map((x, k) => (p2[k] * e1u - x * e2u) / det);
    const cr = [p1[1] * p2[2] - p1[2] * p2[1], p1[2] * p2[0] - p1[0] * p2[2], p1[0] * p2[1] - p1[1] * p2[0]], A = Math.hypot(...cr) / 2;
    su += Math.hypot(...Ju) * A; sv += Math.hypot(...Jv) * A; sa += A; }
  return { piece, comp, u0, v0, du, dv, mu: sa ? su / sa : 1, mv: sa ? sv / sa : 1 };
}
/** shelf-pack the parts at the largest texel density that fits a size × size atlas (gutter g texels) */
export function packCharts(ps: Part[], size: number, g = 4): { charts: Chart[]; texelsPerMetre: number } {
  const tryPack = (d: number): Chart[] | null => {
    const items = ps.map(p => ({ p, w: Math.max(4, Math.ceil(p.du * p.mu * d)), h: Math.max(4, Math.ceil(p.dv * p.mv * d)) })).sort((a, b) => b.h - a.h || a.p.piece.localeCompare(b.p.piece) || a.p.comp - b.p.comp);
    const out: Chart[] = []; let x = g, y = g, rowH = 0;
    for (const it of items) { if (it.w + 2 * g > size) return null; if (x + it.w + g > size) { x = g; y += rowH + 2 * g; rowH = 0; } if (y + it.h + g > size) return null;
      out.push({ piece: it.p.piece, comp: it.p.comp, u0: it.p.u0, v0: it.p.v0, du: it.p.du, dv: it.p.dv, x, y, w: it.w, h: it.h }); x += it.w + 2 * g; rowH = Math.max(rowH, it.h); }
    return out; };
  let lo = 1, hi = 400; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (tryPack(m)) lo = m; else hi = m; }
  return { charts: tryPack(lo)!, texelsPerMetre: lo };
}
/** the atlas coordinate (0..1) of a parameter point in a chart */
export const atlasUV = (c: Chart, u: number, v: number, size: number): [number, number] => [(c.x + ((u - c.u0) / c.du) * c.w) / size, (c.y + ((v - c.v0) / c.dv) * c.h) / size];

/** splat a triangle mesh's per-vertex values (heights) into a float image at atlas coordinates (uv 0..1); weight image
 *  counts coverage. Triangles spanning more than `maxSpan` of the atlas are skipped (a seam). */
export function splat(img: Float32Array, wgt: Float32Array, size: number, uv: Float32Array, val: Float32Array, idx: ArrayLike<number>, ok: Uint8Array, maxSpan = 0.05) {
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2]; if (!ok[a] || !ok[b] || !ok[c]) continue;
    const xs = [uv[a * 2], uv[b * 2], uv[c * 2]].map(x => x * size - 0.5), ys = [uv[a * 2 + 1], uv[b * 2 + 1], uv[c * 2 + 1]].map(y => y * size - 0.5);
    if (Math.max(...xs) - Math.min(...xs) > maxSpan * size || Math.max(...ys) - Math.min(...ys) > maxSpan * size) continue;
    const det = (xs[1] - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (ys[1] - ys[0]); if (Math.abs(det) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(size - 1, Math.ceil(Math.max(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(size - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const w1 = ((x - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (y - ys[0])) / det, w2 = ((xs[1] - xs[0]) * (y - ys[0]) - (x - xs[0]) * (ys[1] - ys[0])) / det, w0 = 1 - w1 - w2;
      if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
      img[y * size + x] += val[a] * w0 + val[b] * w1 + val[c] * w2; wgt[y * size + x] += 1;
    }
  }
}
/** normalise a splatted image by its weights and dilate the covered texels outward `iters` times (the gutters) */
export function resolveDilate(img: Float32Array, wgt: Float32Array, size: number, iters = 6): Float32Array {
  let v = new Float32Array(size * size), has = new Uint8Array(size * size);
  for (let i = 0; i < v.length; i++) if (wgt[i] > 0) { v[i] = img[i] / wgt[i]; has[i] = 1; }
  for (let it = 0; it < iters; it++) { const nv = v.slice(), nh = has.slice();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = y * size + x; if (has[i]) continue; let s = 0, k = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= size || Y >= size) continue; const j = Y * size + X; if (has[j]) { s += v[j]; k++; } }
      if (k) { nv[i] = s / k; nh[i] = 1; } }
    v = nv; has = nh; }
  return v;
}
/** linear → sRGB-encoded byte (the fold layers live in the people's sRGB array texture: the sampler decodes them) */
export const srgbByte = (x: number) => { const c = Math.min(1, Math.max(0, x)); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); };
