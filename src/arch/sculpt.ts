// Sculpted column orders and doorway colossi (D-014). Pure geometry: every function returns typed arrays or a
// THREE.BufferGeometry (indexed; position + normal). Proportions: src/data/sculpture.json (tier C, with notes) on top of
// the SITE_SPEC order dimensions (height, shaft diameter, flute count, base and capital type), which are never altered.
//  • architectural parts (bases, fluted shaft, palm bell, calyx, collar, abacus) are lathes with relief, built at
//    startup in a few ms and cached per order;
//  • organic parts (double-bull protome, volute member, colossi) are signed-distance models (sculpt_models.ts)
//    polygonised by marching cubes and simplified offline (tools/build_sculpt.ts → public/generated/sculpt_*.bin);
//    they are loaded once (loadSculpt) and fitted to each order's box. If the files are missing they are generated
//    on the spot (seconds), so the build never falls back to a block.
import * as THREE from 'three/webgpu';
import S from '../data/sculpture.json';
import { SPEC } from './spec';
import type { ColumnOrder, Box } from './parts';
import { NormMesh, RawMesh, creaseNormals, mergeNorm, transformNorm, marchingCubes, simplify, smoothstep } from './sdf';
import { protomeSDF, voluteSDF, colossusSDF, ColossusModel } from './sculpt_models';

export type Lod = 0 | 1;
const SC = S as any;
export const srow = <T = any>(g: string, k: string): T => { const x = SC[g]?.[k]; if (!x || x.v === undefined) throw new Error(`sculpture.json missing ${g}.${k}`); return x.v as T; };
const P = () => SPEC.global.r_column_proportions.v;
const TAU = Math.PI * 2;

// =============================================================== primitive builders (raw: positions + triangles)
/** closed surface of revolution: rows (y_j, r_j) bottom → top, n segments around; relief(u ∈ [0,1), j) is added to
 *  the radius; flat caps close both ends (outward winding: +x at u = 0, counter-clockwise seen from above is −u). */
export function revolve(n: number, ys: number[], rs: number[], relief?: (u: number, j: number) => number, caps: [boolean, boolean] = [true, true]): RawMesh {
  const nv = ys.length, pos: number[] = [], idx: number[] = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < n; i++) {
    const u = i / n, th = u * TAU, r = Math.max(1e-4, rs[j] + (relief ? relief(u, j) : 0));
    pos.push(r * Math.cos(th), ys[j], r * Math.sin(th));
  }
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i, b = j * n + ((i + 1) % n), c = (j + 1) * n + ((i + 1) % n), d = (j + 1) * n + i;
    idx.push(a, d, c, a, c, b);
  }
  if (caps[0]) { const c = pos.length / 3; pos.push(0, ys[0], 0); for (let i = 0; i < n; i++) idx.push(c, i, (i + 1) % n); }
  if (caps[1]) { const c = pos.length / 3, o = (nv - 1) * n; pos.push(0, ys[nv - 1], 0); for (let i = 0; i < n; i++) idx.push(c, o + ((i + 1) % n), o + i); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
/** axis-aligned box (half extents; centre), faces separate so normals stay flat */
export function boxRaw(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, topScale = 1): RawMesh {
  // topScale < 1 tapers the top face (frustum): used for the plain bolster
  const v = (sx: number, sy: number, sz: number) => { const s = sy > 0 ? topScale : 1; return [cx + sx * hx * s, cy + sy * hy, cz + sz * hz * s]; };
  const faces = [ // [corner signs] counter-clockwise seen from outside
    [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]],
    [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]],
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
  ];
  const pos: number[] = [], idx: number[] = [];
  for (const f of faces) { const o = pos.length / 3; for (const c of f) pos.push(...v(c[0], c[1], c[2])); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
const norm = (m: RawMesh, crease: number) => creaseNormals(m, crease);

// =============================================================== relief patterns
const TESS = () => srow('lod', 'tessellation');
const CR = () => TESS().crease;
/** a pendant leaf in its own chart: lu ∈ [−0.5, 0.5] across the leaf pitch, s ∈ [0, 1] from the attachment to the
 *  tip; returns the relief height 0..1 (soft-edged tongue with a rounded tip and a raised midrib) */
export function leaf(lu: number, s: number, halfW: number, edge: number, midrib: number) {
  if (s < 0 || s > 1) return 0;
  const LS = srow('base', 'bell_leaves'), tip0 = LS.tip_round;
  const hw = s < tip0 ? halfW : halfW * Math.sqrt(Math.max(0, 1 - ((s - tip0) / (1 - tip0)) ** 2));
  const a = Math.abs(lu); if (a >= hw) return 0;
  const body = smoothstep(0, edge, hw - a);
  return (body * (1 + midrib * Math.max(0, 1 - a / LS.midrib_w))) / (1 + midrib);
}
/** circular-arc flute depth at lateral offset x from the flute axis (half-chord w, sagitta sg), `ey` beyond the end of
 *  a sphere-ended cutter (rounded flute termination) */
export function fluteDepth(x: number, w: number, sg: number, ey = 0) {
  const rho = (w * w + sg * sg) / (2 * sg);
  const q = rho * rho - x * x - ey * ey; return q <= 0 ? 0 : Math.max(0, Math.sqrt(q) - (rho - sg));
}

// =============================================================== bases
/** torus rows: a half-ellipse roll from rIn out to rOut and back, cut into `flutes` horizontal concave flutes */
const torusRows = (y0: number, y1: number, rIn: number, rOut: number, flutes: number, sag: number, perFlute: number) => {
  const ys: number[] = [], rs: number[] = [];
  const N = flutes > 0 ? flutes * perFlute : perFlute;
  for (let k = 0; k <= N; k++) {
    const t = k / N, env = rIn + (rOut - rIn) * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
    let dep = 0;
    if (flutes > 0) { const w = (y1 - y0) / flutes / 2, loc = (t * flutes - Math.floor(Math.min(t * flutes, flutes - 1e-9)) - 0.5) * 2 * w; dep = fluteDepth(loc, w, sag * w); }
    ys.push(y0 + (y1 - y0) * t); rs.push(Math.max(rIn, env - dep));
  }
  return { ys, rs };
};
function baseMesh(o: ColumnOrder, lod: Lod): NormMesh {
  const D = o.shaftD, hB = o.baseH, T = srow('base', 'torus'), TS = TESS(), parts: NormMesh[] = [];
  let yT: number; // torus bottom
  if (o.base === 'square2') {
    const st = srow<{ step_h: number[] }>('base', 'square2').step_h, s2 = P().square2_lower_scale;
    const h0 = st[0] * hB, h1 = st[1] * hB;
    parts.push(norm(boxRaw(0, h0 / 2, 0, (o.baseW * s2) / 2, h0 / 2, (o.baseW * s2) / 2), CR().box), norm(boxRaw(0, h0 + h1 / 2, 0, o.baseW / 2, h1 / 2, o.baseW / 2), CR().box));
    yT = h0 + h1;
  } else if (o.base === 'bell') {
    const B = srow('base', 'bell'), Lf = srow('base', 'bell_leaves');
    const hf = B.foot_h * hB, hb = B.bell_h * hB, rb = o.baseW / 2, rBot = rb * (1 - B.lip), rTop = B.r_top * D;
    parts.push(norm(revolve(TS.foot[lod], [0, hf], [rb, rb]), CR().lathe));
    const rows = TS.bell_rows[lod], ys: number[] = [], rs: number[] = [], ts: number[] = [];
    for (let j = 0; j < rows; j++) { const t = (j / (rows - 1)) ** B.row_pow; ts.push(t); ys.push(hf + hb * t); rs.push(rTop + (rBot - rTop) * (1 - t) ** B.flare_pow); }
    const nL = Lf.count, relief = lod ? undefined : (u: number, j: number) => {
      const s = (1 - ts[j]) / (1 - Lf.tip); // 0 at the top (attachment), 1 at the leaf tip
      return Lf.relief * D * leaf((u * nL) % 1 - 0.5, s, Lf.width, Lf.edge, Lf.midrib);
    };
    parts.push(norm(revolve(TS.bell[lod], ys, rs, relief), CR().relief));
    yT = hf + hb;
  } else {
    const Pb = srow('base', 'plain'), pb = P().plain_base as number[];
    const hd = Pb.drum_h * hB;
    parts.push(norm(revolve(TS.drum[lod], [0, hd], [(D / 2) * pb[1], (D / 2) * pb[0]]), CR().lathe));
    yT = hd;
  }
  const tr = torusRows(yT, hB, T.r_in * D, T.r_out * D, lod ? 0 : T.flutes, T.sagitta, TS.torus_rows_per_flute);
  parts.push(norm(revolve(TS.torus[lod], tr.ys, tr.rs), CR().torus));
  return mergeNorm(parts);
}

// =============================================================== shaft
function shaftMesh(o: ColumnOrder, built: number, lod: Lod): NormMesh | null {
  const shaftH = o.height - o.baseH - o.capitalH, sh = shaftH * built;
  if (sh < 0.01) return null;
  const y0 = o.baseH, y1 = y0 + sh, R0 = o.shaftD / 2, Rtop = R0 * P().shaft_top_ratio;
  const R = (y: number) => R0 + (Rtop - R0) * ((y - y0) / shaftH);
  const U = srow('shaft', 'unfluted'), F = srow('shaft', 'flutes'), TS = srow('shaft', 'tessellation');
  const unfluted = (U.timber && o.material === 'timber') || (U.under_construction && built < 1) || o.flutes < 3;
  if (unfluted) return norm(revolve(TESS().shaft_plain[lod], [y0, y1], [R0, R(y1)]), CR().lathe);
  const N = o.flutes, Sf = lod ? TS.lod1_per_flute : TS.lod0_per_flute, n = N * Sf;
  const ya = y0 + F.stop_bottom * o.shaftD, yb = y1 - F.stop_top * o.shaftD; // flute ends (depth 0 on the flute axis)
  const wAt = (y: number) => R(y) * Math.sin(Math.PI / N);
  const rows: { y: number; ey: number | null }[] = [{ y: y0, ey: null }];
  const E = lod ? 0 : TS.end_rows;
  const w0 = wAt(ya), w1 = wAt(yb);
  if (E) { for (let k = 0; k <= E; k++) rows.push({ y: ya + (w0 * k) / E, ey: w0 * (1 - k / E) }); for (let k = E; k >= 0; k--) rows.push({ y: yb - (w1 * k) / E, ey: w1 * (1 - k / E) }); }
  else rows.push({ y: ya, ey: 0 }, { y: yb, ey: 0 });
  rows.push({ y: y1, ey: null });
  const ys = rows.map(r => r.y), rs = rows.map(r => R(r.y));
  const relief = (u: number, j: number) => {
    const ey = rows[j].ey; if (ey === null) return 0;
    const w = wAt(rows[j].y), x = ((u * N) % 1 - 0.5) * 2 * w; // offset from the flute axis; arrises at u·N integer
    return -fluteDepth(x, w, F.sagitta * w, ey);
  };
  // sample i/n: every Sf-th sample lands exactly on an arris (u·N integer), so the arrises stay sharp
  return norm(revolve(n, ys, rs, relief), CR().lathe);
}

// =============================================================== capitals
function palmMesh(y0: number, h: number, D: number, lod: Lod): NormMesh {
  const Pm = srow('capital', 'palm'), TS = TESS(), rows = TS.palm_rows[lod], ys: number[] = [], rs: number[] = [], ss: number[] = [];
  const rShaft = (D / 2) * P().shaft_top_ratio;
  for (let j = 0; j < rows; j++) {
    const t = j / (rows - 1);
    let r: number, s: number;
    // leaves hang from the neck (s = 0) to the rim, where their rounded tips (s ≈ tip) scallop the edge
    if (t <= Pm.rim_h) { r = rShaft + (Pm.r_rim * D - rShaft) * (t / Pm.rim_h) ** Pm.rim_pow; s = Pm.tip; } // underside of the drooping rim
    else { const q = (t - Pm.rim_h) / (1 - Pm.rim_h); r = Pm.r_neck * D + (Pm.r_rim - Pm.r_neck) * D * (1 - q ** Pm.bulge_pow); s = Pm.tip * (1 - q); }
    ys.push(y0 + h * t); rs.push(r); ss.push(s);
  }
  const nL = Pm.leaves;
  const relief = lod ? undefined : (u: number, j: number) => Pm.relief * D * leaf((u * nL) % 1 - 0.5, ss[j], Pm.leaf_w, Pm.leaf_edge, Pm.midrib);
  return norm(revolve(lod ? TS.lathe_lod1 : nL * TS.palm_per_leaf, ys, rs, relief), CR().capital);
}
function calyxMesh(y0: number, h: number, D: number, lod: Lod): NormMesh {
  const C = srow('capital', 'calyx'), TS = TESS(), rows = TS.calyx_rows[lod], ys: number[] = [], rs: number[] = [];
  for (let j = 0; j < rows; j++) {
    const t = j / (rows - 1), tf = Math.min(1, t / (1 - C.rim_h));
    ys.push(y0 + h * t); rs.push((C.r_base + (C.r_rim - C.r_base) * tf ** C.flare_pow) * D);
  }
  const nR = C.ribs;
  const relief = lod ? undefined : (u: number, j: number) => { // rounded sepal ribs, deepest separation at the rim
    const lu = (u * nR) % 1 - 0.5, t = j / (rows - 1);
    return C.relief * D * (Math.cos(lu * TAU) * 0.5 + 0.5) ** C.rib_pow * (C.rib_base + (1 - C.rib_base) * t);
  };
  return norm(revolve(lod ? TS.lathe_lod1 : nR * TS.calyx_per_rib, ys, rs, relief), CR().capital);
}


// =============================================================== precomputed organic pieces (store)
export type PieceName = 'protome' | 'volute' | 'colossus_bull' | 'colossus_lamassu';
export interface SculptIndex { version: number; hash: string; params: { voluteH: number; colossusFront: number }; pieces: Record<string, { file: string; verts: number; tris: number }[]> }
const STORE = new Map<string, NormMesh>();
let INDEX: SculptIndex | null = null;
export const SCULPT_VERSION = 1;
let measuredFront: number | null = null;
/** the colossus fore-part length measured from the layout (buildMeshes sets it before asking for colossus pieces) */
export function setColossusFront(v: number) { measuredFront = v; }
/** generation parameters, derived from the data (volute height in D; colossus fore-part length in metres) */
export function sculptParams(colossusFront?: number) {
  const split = srow('capital', 'composite_split'), capOverD = SPEC.apadana.capital_height.v / SPEC.apadana.shaft_diameter_base.v;
  const front = colossusFront ?? measuredFront ?? INDEX?.params.colossusFront;
  if (front === undefined) throw new Error('sculpt: colossus fore-part length unknown (setColossusFront or a built index)');
  return { voluteH: split.volute * capOverD, colossusFront: front };
}
/** generate one organic piece (both LODs) from its SDF: marching cubes + quadric simplification (offline tool) */
export function generatePiece(name: PieceName, params?: { voluteH: number; colossusFront: number }): NormMesh[] {
  const [vw, vd] = P().capital_boxes.volute as number[];
  const cfg = name === 'protome' ? srow('protome', 'mc') : name === 'volute' ? srow('volute', 'mc') : srow('colossus', 'mc');
  const sdf = name === 'protome' ? protomeSDF() : name === 'volute' ? voluteSDF((params ?? sculptParams(0)).voluteH, vw, vd) : colossusSDF(name.slice(9) as ColossusModel, (params ?? sculptParams()).colossusFront);
  // LOD1 is polygonised on its own coarser grid: simplifying LOD0 that far leaves spikes and broken silhouettes
  const l0 = simplify(marchingCubes(sdf.f, sdf.min, sdf.max, cfg.cell), cfg.lod0), l1 = simplify(marchingCubes(sdf.f, sdf.min, sdf.max, cfg.lod1_cell), cfg.lod1);
  if (name.startsWith('colossus')) { // simplification may nudge a vertex a few mm past the jamb faces: keep the carving inside its block
    const RB = srow('colossus', 'reference_box'), lo = [-RB.L / 2, 0, -RB.W / 2], hi = [RB.L / 2, RB.H, RB.W / 2];
    for (const m of [l0, l1]) for (let i = 0; i < m.pos.length; i++) m.pos[i] = Math.min(hi[i % 3], Math.max(lo[i % 3], m.pos[i]));
  }
  return [creaseNormals(l0, cfg.crease), creaseNormals(l1, cfg.crease)];
}
// ---- compact binary: 'SCLP' | u32 version | u32 nv | u32 ni | f32×6 box | u16×3nv positions (quantised) | pad |
//      i8×3nv normals | pad | u16 or u32 ×ni indices
export function encodePiece(m: NormMesh): ArrayBuffer {
  const nv = m.pos.length / 3, ni = m.idx.length, big = nv > 65535;
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { box[k] = Math.min(box[k], m.pos[i + k]); box[k + 3] = Math.max(box[k + 3], m.pos[i + k]); }
  const pad = (x: number) => (x + 3) & ~3;
  const oP = 40, oN = oP + pad(nv * 6), oI = oN + pad(nv * 3), size = oI + ni * (big ? 4 : 2);
  const buf = new ArrayBuffer(size), dv = new DataView(buf);
  [0x53, 0x43, 0x4c, 0x50].forEach((c, i) => dv.setUint8(i, c));
  dv.setUint32(4, SCULPT_VERSION, true); dv.setUint32(8, nv, true); dv.setUint32(12, ni, true);
  box.forEach((b, i) => dv.setFloat32(16 + i * 4, b, true));
  for (let v = 0; v < nv; v++) for (let k = 0; k < 3; k++) {
    const ext = box[k + 3] - box[k] || 1; dv.setUint16(oP + (v * 3 + k) * 2, Math.round(((m.pos[v * 3 + k] - box[k]) / ext) * 65535), true);
    dv.setInt8(oN + v * 3 + k, Math.round(m.nrm[v * 3 + k] * 127));
  }
  for (let i = 0; i < ni; i++) big ? dv.setUint32(oI + i * 4, m.idx[i], true) : dv.setUint16(oI + i * 2, m.idx[i], true);
  return buf;
}
export function decodePiece(buf: ArrayBuffer): NormMesh {
  const dv = new DataView(buf);
  if (buf.byteLength < 40 || dv.getUint8(0) !== 0x53 || dv.getUint8(1) !== 0x43 || dv.getUint8(2) !== 0x4c || dv.getUint8(3) !== 0x50) throw new Error('not a sculpt piece');
  const nv = dv.getUint32(8, true), ni = dv.getUint32(12, true), big = nv > 65535, box = [0, 1, 2, 3, 4, 5].map(i => dv.getFloat32(16 + i * 4, true));
  const pad = (x: number) => (x + 3) & ~3, oP = 40, oN = oP + pad(nv * 6), oI = oN + pad(nv * 3);
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  for (let v = 0; v < nv; v++) {
    for (let k = 0; k < 3; k++) { pos[v * 3 + k] = box[k] + (dv.getUint16(oP + (v * 3 + k) * 2, true) / 65535) * (box[k + 3] - box[k]); nrm[v * 3 + k] = dv.getInt8(oN + v * 3 + k) / 127; }
    const l = Math.hypot(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]) || 1; nrm[v * 3] /= l; nrm[v * 3 + 1] /= l; nrm[v * 3 + 2] /= l;
  }
  for (let i = 0; i < ni; i++) idx[i] = big ? dv.getUint32(oI + i * 4, true) : dv.getUint16(oI + i * 2, true);
  return { pos, nrm, idx };
}
export const pieceFile = (name: PieceName, lod: Lod) => `generated/sculpt_${name}_${lod}.bin`;
export const SCULPT_INDEX_FILE = 'generated/sculpt.json';
/** load the precomputed pieces (browser: fetch relative to the site root; returns false if unavailable) */
export async function loadSculpt(fetchBuf: (path: string) => Promise<ArrayBuffer>): Promise<boolean> {
  try {
    const idx = JSON.parse(new TextDecoder().decode(await fetchBuf(SCULPT_INDEX_FILE))) as SculptIndex;
    if (idx.version !== SCULPT_VERSION) throw new Error(`sculpt index version ${idx.version}`);
    for (const [name, lods] of Object.entries(idx.pieces)) for (let l = 0; l < lods.length; l++) STORE.set(`${name}.${l}`, decodePiece(await fetchBuf(lods[l].file)));
    INDEX = idx; return true;
  } catch (e) { console.warn(`sculpt: precomputed pieces unavailable (${(e as Error).message}); generating at startup (slow)`); return false; }
}
/** node (tests, tools): read the pieces from public/ synchronously, once */
function loadFromDiskSync() {
  const gbm = (globalThis as any).process?.getBuiltinModule; if (!gbm || INDEX) return;
  const fs = gbm('node:fs'), root = 'public/';
  try {
    const idx = JSON.parse(fs.readFileSync(root + SCULPT_INDEX_FILE, 'utf8')) as SculptIndex; if (idx.version !== SCULPT_VERSION) return;
    for (const [name, lods] of Object.entries(idx.pieces)) for (let l = 0; l < lods.length; l++) { const b = fs.readFileSync(root + lods[l].file); STORE.set(`${name}.${l}`, decodePiece(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))); }
    INDEX = idx;
  } catch { /* not built yet: generate on demand */ }
}
export const sculptIndex = () => { loadFromDiskSync(); return INDEX; };
export function piece(name: PieceName, lod: Lod): NormMesh {
  const key = `${name}.${lod}`;
  if (!STORE.has(key)) loadFromDiskSync();
  if (!STORE.has(key)) { const g = generatePiece(name); STORE.set(`${name}.0`, g[0]); STORE.set(`${name}.1`, g[1]); }
  return STORE.get(key)!;
}
/** fit a mesh's bounding box to the target box (non-uniform scale + translation), normals transformed properly */
function fitTo(m: NormMesh, min: number[], max: number[]): NormMesh {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], m.pos[i + k]); b[k + 3] = Math.max(b[k + 3], m.pos[i + k]); }
  const s = [0, 1, 2].map(k => (max[k] - min[k]) / (b[k + 3] - b[k]));
  return transformNorm(m, [s[0], 0, 0, min[0] - b[0] * s[0], 0, s[1], 0, min[1] - b[1] * s[1], 0, 0, s[2], min[2] - b[2] * s[2]]);
}

// =============================================================== column assembly
function capitalMesh(o: ColumnOrder, lod: Lod): NormMesh | null {
  if (o.capital === 'none') return null;
  const D = o.shaftD, H = o.capitalH, y0 = o.height - H, top = o.height, parts: NormMesh[] = [];
  const [pw, pd] = P().capital_boxes.protome as number[];
  if (o.capital === 'composite') {
    const s = srow('capital', 'composite_split'), [vw, vd] = P().capital_boxes.volute as number[];
    const h1 = s.palm * H, h2 = s.calyx * H, h3 = s.volute * H;
    parts.push(palmMesh(y0, h1, D, lod), calyxMesh(y0 + h1, h2, D, lod));
    parts.push(fitTo(piece('volute', lod), [(-vw * D) / 2, y0 + h1 + h2, (-vd * D) / 2], [(vw * D) / 2, y0 + h1 + h2 + h3, (vd * D) / 2]));
    parts.push(fitTo(piece('protome', lod), [(-pw * D) / 2, y0 + h1 + h2 + h3, (-pd * D) / 2], [(pw * D) / 2, top, (pd * D) / 2]));
  } else if (o.capital === 'bull') {
    const B = srow('capital', 'bull'), hc = B.collar_h * H, rc = B.collar_r * D, rs = (D / 2) * P().shaft_top_ratio;
    parts.push(norm(revolve(TESS().collar[lod], [y0, y0 + hc * B.collar_flare, y0 + hc], [rs, rc, rc]), CR().lathe));
    parts.push(fitTo(piece('protome', lod), [(-pw * D) / 2, y0 + hc, (-pd * D) / 2], [(pw * D) / 2, top, (pd * D) / 2]));
  } else {
    const Pl = srow('capital', 'plain'), wA = P().capital_boxes.plain * D, ha = Pl.abacus_h * H, hb = H - ha;
    parts.push(norm(boxRaw(0, y0 + hb / 2, 0, (Pl.bolster_bottom * D) / 2, hb / 2, (Pl.bolster_bottom * D) / 2, wA / (Pl.bolster_bottom * D)), CR().box));
    parts.push(norm(boxRaw(0, top - ha / 2, 0, wA / 2, ha / 2, wA / 2), CR().box));
  }
  return mergeNorm(parts);
}
const COL_CACHE = new Map<string, NormMesh>(), PART_CACHE = new Map<string, NormMesh | null>();
const cached = (key: string, make: () => NormMesh | null) => { if (!PART_CACHE.has(key)) PART_CACHE.set(key, make()); return PART_CACHE.get(key)!; };
/** the whole column in local space (base at y = 0, top at o.height); built < 1: shaft partly raised, no capital.
 *  Bases and capitals are cached per order (the Hall of 100 Columns' many construction states share them). */
export function columnMesh(o: ColumnOrder, built = 1, lod: Lod = 0): NormMesh {
  const ok = JSON.stringify(o), key = `${ok}|${built.toFixed(4)}|${lod}`;
  let m = COL_CACHE.get(key);
  if (!m) {
    const parts = [cached(`base|${ok}|${lod}`, () => baseMesh(o, lod))!];
    const sh = shaftMesh(o, built, lod); if (sh) parts.push(sh);
    if (built >= 1) { const c = cached(`cap|${ok}|${lod}`, () => capitalMesh(o, lod)); if (c) parts.push(c); }
    m = mergeNorm(parts); COL_CACHE.set(key, m);
  }
  return m;
}
export function toGeometry(m: NormMesh): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
  g.setIndex(new THREE.BufferAttribute(m.idx, 1));
  return g;
}

// =============================================================== colossi
/** colossus mesh placed in world space for a colossus part (box with `sculpt`), fitted to the box and mirrored so
 *  the head faces `facing` (±grid x) and the relief faces the doorway (`passage`, ±grid y) */
export function colossusMesh(p: Box, lod: Lod): NormMesh {
  if (!p.sculpt) throw new Error('not a sculpted part');
  const RB = srow('colossus', 'reference_box'), m = piece(`colossus_${p.sculpt.model}` as PieceName, lod);
  const L = p.size[0], W = p.size[1], H = p.y1 - p.y0, f = p.sculpt.facing, s = p.sculpt.passage;
  // model (x along the body, y up, z toward the passage) → world (x = grid east, y up, z = −grid north)
  const sx = (L / RB.L) * f, sy = H / RB.H, sz = -(W / RB.W) * s;
  return transformNorm(m, [sx, 0, 0, p.c[0], 0, sy, 0, p.y0, 0, 0, sz, -p.c[1]]);
}
/** how far each colossus box projects beyond the wall faces along its facing direction (the fore-part in the round) */
export function colossusFrontProjections(parts: (Box | { type: string })[]): number[] {
  const out: number[] = [];
  for (const p of parts as Box[]) {
    if (p.type !== 'box' || !p.sculpt) continue;
    const f = p.sculpt.facing, front = p.c[0] + (f * p.size[0]) / 2;
    let face = p.c[0] - (f * p.size[0]) / 2; // the wall face furthest toward the front among overlapping walls
    for (const w of parts as Box[]) {
      if (w.type !== 'box' || w.kind !== 'wall' || w.building !== p.building || (w.rot ?? 0) !== 0) continue;
      const wx0 = w.c[0] - w.size[0] / 2, wx1 = w.c[0] + w.size[0] / 2, wy0 = w.c[1] - w.size[1] / 2, wy1 = w.c[1] + w.size[1] / 2;
      if (wy1 <= p.c[1] - p.size[1] / 2 || wy0 >= p.c[1] + p.size[1] / 2 || w.y1 <= p.y0 || w.y0 >= p.y1) continue;
      if (wx1 <= p.c[0] - p.size[0] / 2 || wx0 >= p.c[0] + p.size[0] / 2) continue;
      face = f > 0 ? Math.max(face, wx1) : Math.min(face, wx0);
    }
    out.push(Math.max(0, f * (front - face)));
  }
  return out;
}
/** triangle count of a column order at a LOD (for budgets and stats) */
export const columnTriangles = (o: ColumnOrder, built = 1, lod: Lod = 0) => columnMesh(o, built, lod).idx.length / 3;
/** the inputs that determine the precomputed pieces (the tool and the staleness test hash the same list) */
export const sculptInputs = (read: (path: string) => string, params: { voluteH: number; colossusFront: number }) =>
  [read('src/data/sculpture.json'), read('src/arch/sdf.ts'), read('src/arch/sculpt_models.ts'), JSON.stringify(P()), JSON.stringify({ v: params.voluteH.toFixed(4), f: params.colossusFront.toFixed(3) })];
/** a stable text hash (FNV-1a, 2 × 32 bit) of the inputs of the precomputed pieces */
export function sculptHash(texts: string[]): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
  for (const t of texts) for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193); h2 = Math.imul(h2 ^ c, 0x5bd1e995) ^ (h2 >>> 15); }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}
