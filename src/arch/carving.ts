// Incised inscriptions (D-177). A carved sign is cut into the stone: its outline (the font's glyph, Noto Sans Old Persian or
// Noto Sans Cuneiform) is the edge of a cut whose walls fall at 45° to the face, so the depth at any point of the sign is its
// distance to the sign's edge (a V-section: shallow in a wedge's tail, deepest in its head, nothing outside the outline).
// That depth field is rasterised once per sign into an atlas (tier C: the section and the wall angle are not measured; the
// depth follows from them and the sign's size); every carved sign is a quad lying on the stone face that samples its sign's
// cell; the shader (src/render/incision.ts) marches the view ray into the depth field, lights the cut's walls by their own
// normals in the host stone's own material, and shows the uncut face (discards) outside the outline. Nothing stands proud.
import * as THREE from 'three/webgpu';
import type opentype from 'opentype.js';

/** the cut's walls to the face: 45° (a right-angled chisel section), so depth = distance to the edge (C) */
export const WALL_SLOPE = 1;
/** margin round each sign's cell (em): room for the view ray to travel under the face at grazing angles (the march stops
 *  at the cut's floor, at most ~0.06 em deep here, i.e. ≤ 0.3 em sideways at the steepest angle marched) */
const MARGIN_EM = 0.3;

export interface Cell { x0: number; y0: number; w: number; h: number; ox: number; oy: number; adv: number; maxDepthEm: number }
export interface Atlas { tex: THREE.DataTexture; data: Uint8Array; width: number; height: number; cells: Map<string, Cell>; font: opentype.Font | null; tpe: number; maxDepthEm: number }

/** a glyph's outline as closed polylines in em units, y up (quadratic and cubic segments flattened) */
export function glyphPolys(font: opentype.Font, ch: string): [number, number][][] {
  const upm = font.unitsPerEm, path = font.charToGlyph(ch).getPath(0, 0, upm), polys: [number, number][][] = [];
  let cur: [number, number][] | null = null, px = 0, py = 0;
  const P = (x: number, y: number): [number, number] => [x / upm, -y / upm];
  for (const c of path.commands as any[]) {
    if (c.type === 'M') { cur = [P(c.x, c.y)]; polys.push(cur); px = c.x; py = c.y; }
    else if (c.type === 'L') { cur!.push(P(c.x, c.y)); px = c.x; py = c.y; }
    else if (c.type === 'Q') { for (let k = 1; k <= 6; k++) { const t = k / 6, a = (1 - t) ** 2, b = 2 * (1 - t) * t, d = t * t; cur!.push(P(a * px + b * c.x1 + d * c.x, a * py + b * c.y1 + d * c.y)); } px = c.x; py = c.y; }
    else if (c.type === 'C') { for (let k = 1; k <= 8; k++) { const t = k / 8, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, e = 3 * (1 - t) * t * t, d = t ** 3; cur!.push(P(a * px + b * c.x1 + e * c.x2 + d * c.x, a * py + b * c.y1 + e * c.y2 + d * c.y)); } px = c.x; py = c.y; }
  }
  return polys.filter(p => p.length > 2);
}
/** 1-D squared distance transform (Felzenszwalb & Huttenlocher 2012) */
function edt1(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
}
/** the depth field of one sign (em units) on a w × h grid of `tpe` texels per em whose corner is at (ox, oy) em: inside the
 *  outline (non-zero winding), the distance to the nearest outside texel less half a texel, times the wall slope */
export function signDepth(polys: [number, number][][], w: number, h: number, ox: number, oy: number, tpe: number): Float32Array {
  const inside = new Uint8Array(w * h), edges: [number, number, number, number][] = [];
  for (const p of polys) for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if (a[1] !== b[1]) edges.push([a[0], a[1], b[0], b[1]]); }
  const xs: [number, number][] = [];
  for (let r = 0; r < h; r++) {
    const y = oy + (r + 0.5) / tpe; xs.length = 0;
    for (const [x0, y0, x1, y1] of edges) if ((y0 <= y) !== (y1 <= y)) xs.push([x0 + ((y - y0) * (x1 - x0)) / (y1 - y0), y1 > y0 ? 1 : -1]);
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1]; if (!wind) continue;
      const c0 = Math.max(0, Math.ceil((xs[i][0] - ox) * tpe - 0.5)), c1 = Math.min(w - 1, Math.floor((xs[i + 1][0] - ox) * tpe - 0.5));
      for (let c = c0; c <= c1; c++) inside[r * w + c] = 1;
    }
  }
  // squared distance of each inside texel to the nearest outside one: columns, then rows
  const INF = 1e12, g = new Float64Array(w * h), n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let c = 0; c < w; c++) { for (let r = 0; r < h; r++) f[r] = inside[r * w + c] ? INF : 0; edt1(f, h, d, v, z); for (let r = 0; r < h; r++) g[r * w + c] = d[r]; }
  const out = new Float32Array(w * h);
  for (let r = 0; r < h; r++) { for (let c = 0; c < w; c++) f[c] = g[r * w + c]; edt1(f, w, d, v, z); for (let c = 0; c < w; c++) out[r * w + c] = inside[r * w + c] ? (Math.max(0, Math.sqrt(d[c]) - 0.5) / tpe) * WALL_SLOPE : 0; }
  return out;
}
/** the depth atlas of every sign in `chars` (shelf-packed; 8 bits of depth / maxDepthEm; row 0 = v 0 = the bottom of a sign).
 *  `tpe`: texels per em (96 for Old Persian: ~1 mm per texel at the 7.5 cm XPa signs, em = 1.25 × sign height; 64 for the
 *  denser cuneiform set) */
export function buildAtlas(font: opentype.Font, chars: Iterable<string>, tpe = 96): Atlas {
  const upm = font.unitsPerEm, list = [...new Set(chars)].filter(ch => ch.trim() && ch !== ' ').sort();
  return packAtlas(list.map(ch => ({ key: ch, polys: glyphPolys(font, ch), adv: (font.charToGlyph(ch).advanceWidth ?? upm) / upm })), tpe, font);
}
/** the depth atlas of marks that are not a script (masons' marks, D-212): each shape's outline as closed polylines in em
 *  units (y up; non-zero winding, so a hole runs the other way round), cut exactly as a sign is */
export function shapeAtlas(shapes: Record<string, [number, number][][]>, tpe = 128): Atlas {
  return packAtlas(Object.keys(shapes).sort().map(k => ({ key: k, polys: shapes[k], adv: 1 })), tpe, null);
}
function packAtlas(entries: { key: string; polys: [number, number][][]; adv: number }[], tpe: number, font: opentype.Font | null): Atlas {
  const cells = new Map<string, Cell>();
  const fields: { ch: string; f: Float32Array; w: number; h: number }[] = [];
  let maxDepth = 0;
  for (const { key: ch, polys, adv } of entries) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (!polys.length) { cells.set(ch, { x0: 0, y0: 0, w: 0, h: 0, ox: 0, oy: 0, adv, maxDepthEm: 0 }); continue; }
    const ox = x0 - MARGIN_EM, oy = y0 - MARGIN_EM, w = Math.ceil((x1 - x0 + 2 * MARGIN_EM) * tpe), h = Math.ceil((y1 - y0 + 2 * MARGIN_EM) * tpe);
    const f = signDepth(polys, w, h, ox, oy, tpe); let m = 0; for (const q of f) m = Math.max(m, q);
    cells.set(ch, { x0: 0, y0: 0, w, h, ox, oy, adv, maxDepthEm: m }); fields.push({ ch, f, w, h }); maxDepth = Math.max(maxDepth, m);
  }
  const maxDepthEm = Math.max(1e-3, maxDepth * 1.02);
  // shelf packing, tallest first, into a power-of-two width
  fields.sort((a, b) => b.h - a.h || (a.ch < b.ch ? -1 : 1));
  const area = fields.reduce((s, q) => s + q.w * q.h, 0), W = Math.min(8192, Math.max(256, 2 ** Math.ceil(Math.log2(Math.sqrt(area * 1.3)))));
  let x = 0, y = 0, shelf = 0;
  for (const q of fields) { if (x + q.w > W) { x = 0; y += shelf; shelf = 0; } const c = cells.get(q.ch)!; c.x0 = x; c.y0 = y; x += q.w; shelf = Math.max(shelf, q.h); }
  const H = Math.max(4, 2 ** Math.ceil(Math.log2(y + shelf))), data = new Uint8Array(W * H);
  for (const q of fields) { const c = cells.get(q.ch)!; for (let r = 0; r < q.h; r++) for (let k = 0; k < q.w; k++) data[(c.y0 + r) * W + c.x0 + k] = Math.min(255, Math.round((q.f[r * q.w + k] / maxDepthEm) * 255)); }
  const tex = new THREE.DataTexture(data, W, H, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  tex.name = 'carving-atlas';
  return { tex, data, width: W, height: H, cells, font, tpe, maxDepthEm };
}
/** the carved depth (em) the atlas holds at a point of a sign (x, y in em from the sign's origin), bilinear as the GPU samples */
export function atlasDepthEm(A: Atlas, ch: string, x: number, y: number): number {
  const c = A.cells.get(ch); if (!c || !c.w) return 0;
  const u = (x - c.ox) * A.tpe - 0.5, v = (y - c.oy) * A.tpe - 0.5, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
  const at = (a: number, b: number) => (a < 0 || b < 0 || a >= c.w || b >= c.h ? 0 : (A.data[(c.y0 + b) * A.width + c.x0 + a] / 255) * A.maxDepthEm);
  return (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv;
}

export interface Placed { ch: string; x: number; y: number }
export interface Layout { signs: Placed[]; em: number; lines: number; width: number; height: number; glyphH: number }
/** lay out carved text in a panel (x right, y up, the first line's baseline at y = −glyphH, lines going down; the block's top
 *  is y = 0). `lined`: the lines are the inscription's own (kept, never re-flowed); otherwise the text is flowed into `width`
 *  (breaking at any sign, as the stone does). A lost sign (no-break space) keeps an average sign's width, uncut */
export function layoutText(font: opentype.Font, lines: string[], glyphH: number, lineGap: number, width: number, lined: boolean): Layout {
  const upm = font.unitsPerEm, em = glyphH * 1.25, signs: Placed[] = [];
  const advOf = (ch: string) => (ch === ' ' ? 0.9 : (font.charToGlyph(ch).advanceWidth ?? upm) / upm);
  let y = -glyphH, n = 0, maxX = 0;
  for (const line of lines) {
    let x = 0; n++;
    for (const ch of [...line]) {
      const a = advOf(ch) * em;
      if (!lined && x > 0 && (x + a > width || ch === ' ')) {
        if (x + a > width) { maxX = Math.max(maxX, x); x = 0; y -= glyphH + lineGap; n++; if (ch === ' ') continue; }
      }
      if (ch === ' ') { if (x > 0) x += a; continue; }
      if (ch !== ' ') signs.push({ ch, x, y });
      x += a;
    }
    maxX = Math.max(maxX, x); y -= glyphH + lineGap;
  }
  return { signs, em, lines: n, width: maxX, height: n * glyphH + (n - 1) * lineGap, glyphH };
}

/** quads for a layout: one per sign over its atlas cell, in panel space (x along the face, y up, z out of the face) shifted by
 *  (dx, dy) and lifted `lift` off the face; attributes carveUV (atlas uv), carveEm (m per em), carveT / carveB (the face's
 *  along and up directions in the mesh's own space) */
export function carvedGeometry(A: Atlas, L: Layout, dx = 0, dy = 0, lift = 0.0005): THREE.BufferGeometry {
  const pos: number[] = [], uvs: number[] = [], ems: number[] = [], T: number[] = [], B: number[] = [], N: number[] = [], idx: number[] = [];
  for (const s of L.signs) {
    const c = A.cells.get(s.ch); if (!c || !c.w) continue;
    const x0 = dx + s.x + c.ox * L.em, y0 = dy + s.y + c.oy * L.em, x1 = x0 + (c.w / A.tpe) * L.em, y1 = y0 + (c.h / A.tpe) * L.em;
    const u0 = c.x0 / A.width, v0 = c.y0 / A.height, u1 = (c.x0 + c.w) / A.width, v1 = (c.y0 + c.h) / A.height, b = pos.length / 3;
    pos.push(x0, y0, lift, x1, y0, lift, x1, y1, lift, x0, y1, lift); uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (let k = 0; k < 4; k++) { ems.push(L.em); T.push(1, 0, 0); B.push(0, 1, 0); N.push(0, 0, 1); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('carveUV', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('carveEm', new THREE.Float32BufferAttribute(ems, 1));
  g.setAttribute('carveT', new THREE.Float32BufferAttribute(T, 3)); g.setAttribute('carveB', new THREE.Float32BufferAttribute(B, 3));
  g.setIndex(idx); g.computeBoundingBox(); g.computeBoundingSphere();
  g.userData.signs = L.signs.map(s => s.ch).join(''); // what is cut, sign by sign (the language lint compares it with the data)
  return g;
}
/** the deepest cut of a layout (m) */
export function layoutMaxDepth(A: Atlas, L: Layout): number { let m = 0; for (const s of L.signs) m = Math.max(m, A.cells.get(s.ch)?.maxDepthEm ?? 0); return m * L.em; }
/** a carved geometry moved into another frame (the face's matrix baked in): positions, normals and the face's along/up
 *  directions (carveT / carveB) all follow `m`, so several faces' cuts can share one mesh (masons' marks, D-212) */
export function bakeCarved(g: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const out = g.clone(); out.applyMatrix4(m);
  const v = new THREE.Vector3();
  for (const k of ['carveT', 'carveB']) { const a = out.getAttribute(k) as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).transformDirection(m); a.setXYZ(i, v.x, v.y, v.z); } a.needsUpdate = true; }
  out.userData = { ...g.userData };
  return out;
}
