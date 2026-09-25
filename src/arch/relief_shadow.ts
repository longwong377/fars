// The relief figures' cast shadows (D-226; rubric s7 pass 2, fix item 1: "no raking shadows even at a sun altitude of 32°").
// A carved figure stands 4.5–6 cm proud of its ground. The sun's cascaded shadow map cannot draw that: its nearest cascade
// has texels of several centimetres and a 6 cm normal bias (skySystem.ts), which lifts every receiver on the wall above the
// relief's own height, so the figures cast nothing on their ground and nothing on themselves (D-048 said so). Instead, every
// relief figure is stamped, once, into a height atlas in the frame of the wall it is carved on, and the sun's light
// (render/reliefShadow.ts, the light's colour node: every lit material) marches that heightfield toward the sun from any
// point within reach of a relief panel: the ground beside a figure, and the figure itself (a fold, an arm over the body).
// So a raking sun draws the black line along the lit-away edges, as long as the relief is deep, at every distance and LOD,
// independent of the shadow map's resolution and bias.
//  - A panel is a cluster of figures on one wall plane (gaps < PANEL_GAP), with its own rectangle in the atlas at a texel
//    size chosen from its smallest figure (TEXEL_MIN–TEXEL_MAX). Heights are metres above the wall face (the figure's
//    heightfield × its depth, less the embed), 8 bits over HSCALE.
//  - A plan grid (GRID_CELL m) lists up to SLOTS panels whose reach (REACH m beyond the rectangle, and from 5 cm behind the
//    face to the relief's top) touches each cell; the shader tests them and marches the first that holds the point.
//  - Fields come from the relief worker pool (reliefs.ts), one per figure kind and seed, or synchronously in node.
// The CPU mirror (reliefShadowAt) is the shader's arithmetic, for the tests and the node previews.
import { figureDef, defBounds } from './relief_figures';
import type { Field } from './relief_field';

/** a figure to stamp: its origin on the wall face at its ground line, the horizontal unit vectors along (X) and out of (Z)
 *  the wall (Y is up), figure scale S (m per figure unit), depth D (m per heightfield unit), mirrored, embed (m) */
export interface ShadowItem { kind: string; seed: number; o: [number, number, number]; X: [number, number]; Z: [number, number]; S: number; D: number; mirror: boolean; embed: number }
export interface ShadowPanel {
  /** world point on the wall face at the rectangle's lower left (u = v = 0) */ o: [number, number, number];
  X: [number, number]; Z: [number, number];
  /** texel (m); the content rectangle in atlas texels (origin, size) */ texel: number; ax: number; ay: number; aw: number; ah: number;
  /** the highest point above the wall face (m) */ hmax: number;
  /** the points this panel holds: u from hold[0] to hold[1] (m, from o along X) */ hold: [number, number];
  /** the figures stamped into it (those overlapping its rectangle) */ items: number[];
}
export interface ReliefShadowData {
  panels: ShadowPanel[]; items: ShadowItem[];
  /** the 8-bit texture: panel heights (rows 0 … gridRow0 − 1), then the plan grid (from row gridRow0, linear) */
  atlas: Uint8Array; aw: number; ah: number;
  /** plan grid: SLOTS panel ids (1-based, 0 = none) per cell, cell (x, z) at linear texel gridRow0·aw + (z·gw + x)·SLOTS + slot;
   *  origin (world x, z), cell, size */
  grid: Uint8Array; gridRow0: number; gx0: number; gz0: number; gc: number; gw: number; gh: number;
  /** RGBA32F, 4 texels per panel: [o.xyz, texel] [X.x, X.z, Z.x, Z.z] [ax, ay, aw, ah] [hmax, hold0, hold1, 0] */
  panelData: Float32Array;
  /** fields still to stamp: key → the items that use it and the grid size to rasterise */
  jobs: Map<string, { kind: string; seed: number; n: number; items: number[] }>;
  /** bumped whenever the atlas changes (the texture's upload) */ version: number;
  overflow: number;
}
/** metres over the full 8-bit range of a height texel (the deepest relief is 6 cm: 0.25 mm per step) */
export const HSCALE = 0.064;
/** texel sizes (m): a panel takes clamp(smallest figure height / TEXEL_PER_FIG, TEXEL_MIN, TEXEL_MAX) */
export const TEXEL_MIN = 0.005, TEXEL_MAX = 0.008, TEXEL_PER_FIG = 150;
/** how far (m, along the wall) a shadow is followed beyond a panel, and the march's horizontal reach: at 0.4 m a 6 cm relief
 *  shades its ground down to a sun 8.5° off the wall plane (where the wall's own direct light is sin 8.5° = 15 % of square-on) */
export const REACH = 0.4;
/** panels on one plane closer than this merge (so a point never lies within reach of two panels of the same wall) */
export const PANEL_GAP = 2 * REACH + 0.05;
export const GRID_CELL = 0.5, SLOTS = 4, MARCH_STEPS = 24;
/** the atlas width (texels): WebGPU guarantees 8192 per side (maxTextureDimension2D) */
export const ATLAS_W = 8192;
/** the march: a sample occludes by smoothstep(0, SOFT0 + SOFT_T·t, H − h_ray − BIAS) (m; t = metres along the ray: the sun's
 *  half-degree penumbra is 0.0093·t, the rest filters the texel) */
export const BIAS = 0.0005, SOFT0 = 0.001, SOFT_T = 0.012;
/** a point higher than this over the wall face lies on the carving: its march starts on the atlas's surface if that is higher */
export const LIFT_MIN = 0.002;

const key = (kind: string, seed: number) => `${kind}|${seed}`;
const boundsCache = new Map<string, [number, number, number, number]>();
const boundsOf = (kind: string, seed: number) => { const k = key(kind, seed); let b = boundsCache.get(k); if (!b) { b = defBounds(figureDef(kind, seed)); boundsCache.set(k, b); } return b; };
/** plan the panels, the atlas layout and the plan grid for a list of figures (no heights yet: stampField fills them) */
export function planReliefShadow(items: ShadowItem[]): ReliefShadowData {
  // figure boxes on their planes: u along X from the plane's own origin (X·o), v up
  const boxes = items.map((it, i) => {
    const b = boundsOf(it.kind, it.seed), m = 0.02, u = it.X[0] * it.o[0] + it.X[1] * it.o[2];
    const x0 = (b[0] - m) * it.S, x1 = (b[2] + m) * it.S;
    return { i, u0: it.mirror ? u - x1 : u + x0, u1: it.mirror ? u - x0 : u + x1, v0: it.o[1] + (b[1] - m) * it.S, v1: it.o[1] + (b[3] + m) * it.S,
      d: it.Z[0] * it.o[0] + it.Z[1] * it.o[2], S: it.S, top: it.D };
  });
  // planes: the same outward normal and offset within 3 cm (steps of a few mm between neighbouring blocks share a panel)
  const planes: { Z: [number, number]; X: [number, number]; d: number; members: typeof boxes }[] = [];
  for (const b of boxes) { const it = items[b.i];
    let p = planes.find(q => Math.abs(q.Z[0] - it.Z[0]) < 1e-3 && Math.abs(q.Z[1] - it.Z[1]) < 1e-3 && Math.abs(q.d - b.d) < 0.03);
    if (!p) { p = { Z: it.Z, X: it.X, d: b.d, members: [] }; planes.push(p); } p.members.push(b); }
  const panels: ShadowPanel[] = [];
  const rects: { u0: number; u1: number; v0: number; v1: number; d: number; members: typeof boxes; plane: (typeof planes)[number] }[] = [];
  for (const pl of planes) {
    // clusters: runs of boxes along the wall whose extents come within PANEL_GAP of each other (a sweep in u; boxes stacked
    // above one another share their run)
    const byU = [...pl.members].sort((a, b) => a.u0 - b.u0), cl: { u0: number; u1: number; v0: number; v1: number; d: number; members: typeof boxes }[] = [];
    for (const b of byU) { const c = cl[cl.length - 1];
      if (c && b.u0 - PANEL_GAP < c.u1) { c.u1 = Math.max(c.u1, b.u1); c.v0 = Math.min(c.v0, b.v0); c.v1 = Math.max(c.v1, b.v1); c.d = Math.max(c.d, b.d); c.members.push(b); }
      else cl.push({ u0: b.u0, u1: b.u1, v0: b.v0, v1: b.v1, d: b.d, members: [b] }); }
    for (const c of cl) rects.push({ ...c, plane: pl });
  }
  // slices: a cluster wider than the atlas (an Apadana façade is 81 m) is cut along the wall into slices; a slice holds the
  // points of its own core (and, at the cluster's ends, the reach beyond them) and its rectangle spans the core ± REACH, so a
  // march from any point it holds stays on its own heights
  type Slice = { r: (typeof rects)[number]; texel: number; ru0: number; ru1: number; h0: number; h1: number; w: number; h: number };
  const slices: Slice[] = [];
  for (const r of rects) {
    const smin = Math.min(...r.members.map(b => b.S)), texel = Math.min(TEXEL_MAX, Math.max(TEXEL_MIN, smin / TEXEL_PER_FIG));
    const U = r.u1 - r.u0, core = ((ATLAS_W - 8) / 3) * texel - 2 * REACH, // (a third of the atlas: slices pack three to a shelf)
      k = Math.max(1, Math.ceil(U / core)), c = U / k;
    for (let q = 0; q < k; q++) {
      const ru0 = Math.max(0, q * c - (k > 1 ? REACH : 0)), ru1 = Math.min(U, (q + 1) * c + (k > 1 ? REACH : 0));
      slices.push({ r, texel, ru0: r.u0 + ru0, ru1: r.u0 + ru1, h0: q === 0 ? -REACH : q * c - ru0, h1: q === k - 1 ? ru1 - ru0 + REACH : (q + 1) * c - ru0,
        w: Math.ceil((ru1 - ru0) / texel), h: Math.ceil((r.v1 - r.v0) / texel) });
    }
  }
  // atlas: skyline packing (tallest first, each at the lowest place it fits, leftmost among equals), each rectangle with a
  // one-texel border of zeros
  slices.sort((a, b) => b.h - a.h || b.w - a.w);
  const sky = new Int32Array(ATLAS_W); let top = 0;
  for (const s of slices) {
    const W = s.w + 2; let bx = 0, by = Infinity;
    for (let x0 = 0; x0 + W <= ATLAS_W; x0 += 8) { let y0 = 0; for (let q = x0; q < x0 + W; q++) if (sky[q] > y0) y0 = sky[q]; if (y0 < by) { by = y0; bx = x0; } }
    for (let q = bx; q < bx + W; q++) sky[q] = by + s.h + 2;
    top = Math.max(top, by + s.h + 2);
    const pl = s.r.plane, o: [number, number, number] = [pl.Z[0] * s.r.d + pl.X[0] * s.ru0, s.r.v0, pl.Z[1] * s.r.d + pl.X[1] * s.ru0];
    const mem = s.r.members.filter(b => b.u1 > s.ru0 && b.u0 < s.ru1);
    panels.push({ o, X: pl.X, Z: pl.Z, texel: s.texel, ax: bx + 1, ay: by + 1, aw: s.w, ah: s.h, hold: [s.h0, s.h1],
      hmax: Math.max(0.001, ...mem.map(b => b.top + Math.max(0, b.d - s.r.d))), items: mem.map(b => b.i) });
  }
  const aw = ATLAS_W, ah = top;
  // plan grid over every panel's reach
  let gx0 = Infinity, gz0 = Infinity, gx1 = -Infinity, gz1 = -Infinity;
  const strip = (p: ShadowPanel) => { const [U0, U1] = p.hold, pts: number[][] = [];
    const k = Math.ceil((U1 - U0) / (GRID_CELL / 4));
    for (let s = 0; s <= k; s++) { const u = U0 + ((U1 - U0) * s) / k;
      for (const w of [-0.05, p.hmax / 2, p.hmax + 0.005]) pts.push([p.o[0] + p.X[0] * u + p.Z[0] * w, p.o[2] + p.X[1] * u + p.Z[1] * w]); }
    return pts; };
  const strips = panels.map(strip);
  for (const s of strips) for (const [px, pz] of s) { gx0 = Math.min(gx0, px); gz0 = Math.min(gz0, pz); gx1 = Math.max(gx1, px); gz1 = Math.max(gz1, pz); }
  if (!panels.length) { gx0 = gz0 = 0; gx1 = gz1 = 1; }
  gx0 = Math.floor(gx0 / GRID_CELL) * GRID_CELL - GRID_CELL; gz0 = Math.floor(gz0 / GRID_CELL) * GRID_CELL - GRID_CELL;
  const gw = Math.ceil((gx1 - gx0) / GRID_CELL) + 2, gh = Math.ceil((gz1 - gz0) / GRID_CELL) + 2;
  // the grid lives in the same 8-bit texture, in rows below the heights (one texture binding for the whole lookup; every
  // lit material pays for it, and a fragment stage may bind only 16: D-216)
  const gridRow0 = ah, rows = ah + Math.ceil((gw * gh * 4) / aw), atlas = new Uint8Array(aw * rows), grid = atlas.subarray(gridRow0 * aw, gridRow0 * aw + gw * gh * 4);
  if (panels.length > 255) throw new Error('relief shadow: more than 255 panels');
  let overflow = 0;
  strips.forEach((s, pi) => { const seen = new Set<number>();
    for (const [px, pz] of s) { const c = Math.floor((pz - gz0) / GRID_CELL) * gw + Math.floor((px - gx0) / GRID_CELL); if (seen.has(c)) continue; seen.add(c);
      let k = 0; while (k < SLOTS && grid[c * 4 + k] !== 0) k++;
      if (k < SLOTS) grid[c * 4 + k] = pi + 1; else overflow++; } });
  const panelData = new Float32Array(panels.length * 16);
  panels.forEach((p, i) => panelData.set([p.o[0], p.o[1], p.o[2], p.texel, p.X[0], p.X[1], p.Z[0], p.Z[1], p.ax, p.ay, p.aw, p.ah, p.hmax, p.hold[0], p.hold[1], 0], i * 16));
  // one field per kind and seed, rasterised finely enough for the finest panel texel it is stamped at (~0.8 texel per cell)
  const jobs = new Map<string, { kind: string; seed: number; n: number; items: number[] }>();
  const texOf = new Float64Array(items.length); panels.forEach(p => { for (const i of p.items) texOf[i] = p.texel; });
  items.forEach((it, i) => { const k = key(it.kind, it.seed), b = boundsOf(it.kind, it.seed), E = (Math.max(b[2] - b[0], b[3] - b[1]) + 0.04) * it.S;
    const n = Math.min(513, Math.max(33, 2 ** Math.ceil(Math.log2(E / (0.8 * texOf[i]))) + 1));
    const j = jobs.get(k); if (j) { j.items.push(i); j.n = Math.max(j.n, n); } else jobs.set(k, { kind: it.kind, seed: it.seed, n, items: [i] }); });
  return { panels, items, atlas, aw, ah: rows, grid, gridRow0, gx0, gz0, gc: GRID_CELL, gw, gh, panelData, jobs, version: 0, overflow };
}

/** stamp one field (a kind and seed) into the atlas for every figure that uses it: the height above the panel's wall face,
 *  the maximum over overlapping figures */
export function stampField(D: ReliefShadowData, jobKey: string, f: Pick<Field, 'n' | 'x0' | 'y0' | 'cell' | 'h'>) {
  const job = D.jobs.get(jobKey); if (!job) return;
  const want = new Set(job.items);
  for (const p of D.panels) for (const i of p.items) { if (!want.has(i)) continue;
    const it = D.items[i], T = p.texel, b = boundsOf(it.kind, it.seed), m = 0.02;
    const pd = p.Z[0] * p.o[0] + p.Z[1] * p.o[2], lift = it.Z[0] * it.o[0] + it.Z[1] * it.o[2] - pd - it.embed;
    const uo = p.X[0] * (it.o[0] - p.o[0]) + p.X[1] * (it.o[2] - p.o[2]), vo = it.o[1] - p.o[1], sx = it.mirror ? -1 : 1;
    const xa = (b[0] - m) * it.S, xb = (b[2] + m) * it.S, ua = Math.min(uo + sx * xa, uo + sx * xb), ub = Math.max(uo + sx * xa, uo + sx * xb);
    const i0 = Math.max(0, Math.floor(ua / T)), i1 = Math.min(p.aw - 1, Math.ceil(ub / T)), j0 = Math.max(0, Math.floor((vo + (b[1] - m) * it.S) / T)), j1 = Math.min(p.ah - 1, Math.ceil((vo + (b[3] + m) * it.S) / T));
    const n = f.n, inv = 1 / f.cell;
    for (let j = j0; j <= j1; j++) { const fy = ((j + 0.5) * T - vo) / it.S, gy = (fy - f.y0) * inv; if (gy < 0 || gy > n - 1) continue;
      const y0 = Math.min(n - 2, Math.floor(gy)), ty = gy - y0, row = (p.ay + j) * D.aw + p.ax;
      for (let i2 = i0; i2 <= i1; i2++) { const fx = (sx * ((i2 + 0.5) * T - uo)) / it.S, gx = (fx - f.x0) * inv; if (gx < 0 || gx > n - 1) continue;
        const x0 = Math.min(n - 2, Math.floor(gx)), tx = gx - x0, h = f.h, q = y0 * n + x0;
        const hb = (Math.max(0, h[q]) * (1 - tx) + Math.max(0, h[q + 1]) * tx) * (1 - ty) + (Math.max(0, h[q + n]) * (1 - tx) + Math.max(0, h[q + n + 1]) * tx) * ty;
        const hv = 0.5 * (hb + Math.max(0, h[q], h[q + 1], h[q + n], h[q + n + 1]));
        if (hv <= 0) continue;
        const z = hv * it.D + lift; if (z <= 0) continue;
        const c = Math.min(255, Math.round((z / HSCALE) * 255)); if (c > D.atlas[row + i2]) D.atlas[row + i2] = c; } }
  }
  D.jobs.delete(jobKey); D.version++;
}

/** the height (m) at panel coordinates (u, v) in metres (panel texel (i, j) is atlas texel (ax + i, ay + j); v up = rows
 *  down the data, as the GPU samples it: uv.y = row / height), bilinear between texel centres, zero beyond the rectangle */
export function atlasHeight(D: ReliefShadowData, p: ShadowPanel, u: number, v: number): number {
  const qx = Math.min(p.aw + 0.5, Math.max(-0.5, u / p.texel)) - 0.5, qy = Math.min(p.ah + 0.5, Math.max(-0.5, v / p.texel)) - 0.5;
  const x0 = Math.floor(qx), y0 = Math.floor(qy), tx = qx - x0, ty = qy - y0;
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= p.aw || j >= p.ah ? 0 : D.atlas[(p.ay + j) * D.aw + p.ax + i]);
  return (((at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty) / 255) * HSCALE;
}
const sstep = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
/** CPU mirror of render/reliefShadow.ts: the sun's visibility (1 lit … 0 shaded) past the carving at world point p, for a unit
 *  vector L toward the sun */
export function reliefShadowAt(D: ReliefShadowData, p: [number, number, number], L: [number, number, number]): number {
  const cx = Math.min(D.gw - 1, Math.max(0, Math.floor((p[0] - D.gx0) / D.gc))), cz = Math.min(D.gh - 1, Math.max(0, Math.floor((p[2] - D.gz0) / D.gc)));
  for (let k = 0; k < SLOTS; k++) {
    const id = D.grid[(cz * D.gw + cx) * 4 + k]; if (!id) continue;
    const P = D.panels[id - 1], dx = p[0] - P.o[0], dy = p[1] - P.o[1], dz = p[2] - P.o[2];
    const u = dx * P.X[0] + dz * P.X[1], v = dy, w = dx * P.Z[0] + dz * P.Z[1];
    if (!(u >= P.hold[0] && u <= P.hold[1] && v >= -REACH && v <= P.ah * P.texel + REACH && w >= -0.05 && w <= P.hmax)) continue;
    return marchPanel(D, P, u, v, w, L);
  }
  return 1;
}
export function marchPanel(D: ReliefShadowData, P: ShadowPanel, u: number, v: number, w0: number, L: [number, number, number]): number {
  const su = L[0] * P.X[0] + L[2] * P.X[1], sv = L[1], sw = L[0] * P.Z[0] + L[2] * P.Z[1];
  if (sw <= 0.004) return 1;
  // the ray starts on the atlas's own surface where the drawn surface lies under it: a figure's LOD mesh departs from the
  // field by up to its RTIN bound (0.12 of the depth at L2: 7 mm on a panel), and a march from the mesh found the carving
  // above its own starting point (the first render's dark blotches over the lion-and-bull; tools/dev/relief_shadow_lod.ts)
  // (not on the ground: the wall face, w ≈ 0, keeps its own height, or the dilated foot of a step would lift its start)
  const w = w0 > LIFT_MIN ? Math.max(w0, atlasHeight(D, P, u, v)) : w0;
  const hl = Math.max(Math.hypot(su, sv), 1e-4), tEnd = Math.min((P.hmax - w) / sw, REACH / hl);
  if (tEnd <= 0) return 1;
  let occ = 0;
  for (let i = 0; i < MARCH_STEPS; i++) {
    const t = (tEnd * (i + 1)) / MARCH_STEPS, H = atlasHeight(D, P, u + su * t, v + sv * t);
    const s = SOFT0 + SOFT_T * t; occ = Math.max(occ, sstep(-0.5 * s, 0.5 * s, H - (w + sw * t) - BIAS));
  }
  return 1 - occ;
}
