// D-750: the palaces dressed as a court in residence: the cloth that a player meets from the stair, the town and the plain.
// Until session 18 the porticoes were open stone and timber and nothing on the Terrace moved in the wind; from 100-300 m the
// halls read as boxes. Two classes, both C for the form and placement, with their grounds:
//  - the porticoes' hangings: Esther 1:6 describes Xerxes' palace at Susa hung with "white, green and blue hangings, fastened
//    with cords of fine linen and purple to silver rings and pillars of marble" (B for Achaemenid palace practice; its
//    colours here). Each bay of a portico's front row carries two curtains tied back to its columns (the middle of the bay
//    open, so the column forest still reads) and a scalloped valance under the capitals, striped white, blue-green and purple;
//  - the royal standards: Xenophon (Cyropaedia 7.1.4) gives the king's standard as a golden eagle with spread wings on a long
//    shaft (B for the standard); flown here from the Gate of All Nations' roof corners, the Apadana's four towers and the
//    corners of the Tachara and the Hadish (C), each a cedar pole, a bronze finial and a swallow-tailed purple-red banner
//    lying out in the prevailing north-west wind (static: cloth without a wind shader).
// Render geometry only (no parts: the colliders, the walkable grid and the plan tests are unchanged). One merged mesh per
// material, on materials the world already draws (the torches' textile and wood, the bronze): no new pipeline.
import * as THREE from 'three/webgpu';
import type { Part, Box, Column } from './parts';
import { roofEdges, ROOFEDGE } from './roofedge';
import { towerEnvelopes } from './glazed';
import { propMaterial, surfaceMaterial } from '../render/materials';
import { Rng } from '../core/rng';

/** sizes (m, C) and colours (sRGB) of the dressings */
export const DRESS = {
  porchBuildings: ['apadana', 'tachara', 'hadish', 'harem'],
  /** a curtain's top under the capital, its tie height (fraction of the drop), its width gathered at the tie and at the foot */
  belowCapital: 0.3, tie: 0.36, tieW: 0.4, footW: 0.75, folds: 3.5, foldAmp: 0.07, gatherAmp: 0.16,
  valance: { drop: 1.1, scallops: 0.9 },
  linen: [0.84, 0.82, 0.75], green: [0.16, 0.42, 0.4], blue: [0.16, 0.3, 0.5], purple: [0.36, 0.1, 0.22],
  standard: { pole: 9, poleR: 0.09, flagW: 3.6, flagH: 2.2, tail: 0.8, finial: 0.3, cloth: [0.48, 0.07, 0.12], hem: [0.78, 0.6, 0.22], windAz: -Math.PI / 4 },
  tier: 'C' as const, src: 'ESTHER-1.6;XEN-CYR-7.1.4;RECON',
};

const W = (e: number, y: number, n: number) => new THREE.Vector3(e, y, -n); // grid → world
const lin = (s: number[]) => { const c = new THREE.Color().setRGB(s[0], s[1], s[2], THREE.SRGBColorSpace); return [c.r, c.g, c.b]; };

/** an unindexed two-sided triangle soup with normals and vertex colours */
class Soup {
  pos: number[] = []; nor: number[] = []; col: number[] = [];
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, rgb: number[], two = true) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    for (const p of [a, b, c]) { this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, n.y, n.z); this.col.push(rgb[0], rgb[1], rgb[2]); }
    if (two) for (const p of [a, c, b]) { this.pos.push(p.x, p.y, p.z); this.nor.push(-n.x, -n.y, -n.z); this.col.push(rgb[0], rgb[1], rgb[2]); }
  }
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, rgb: number[], two = true) { this.tri(a, b, c, rgb, two); this.tri(a, c, d, rgb, two); }
  get tris() { return this.pos.length / 9; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  }
}

export interface Bay { building: string; a: Column; b: Column; u: [number, number]; n: [number, number]; yTop: number; y0: number }
/** the bays of every portico's front row: the columns nearest each open roof edge (roofedge.ts porches), in order along it */
export function porchBays(parts: Part[]): Bay[] {
  const out: Bay[] = [], cols = parts.filter(p => p.type === 'column' && p.built >= 1) as Column[];
  for (const P of roofEdges(parts).porches) {
    if (!DRESS.porchBuildings.includes(P.building)) continue;
    const L = Math.hypot(P.b[0] - P.a[0], P.b[1] - P.a[1]), u: [number, number] = [(P.b[0] - P.a[0]) / L, (P.b[1] - P.a[1]) / L];
    const near = cols.filter(c => c.building === P.building).map(c => {
      const de = c.c[0] - P.a[0], dn = c.c[1] - P.a[1]; return { c, s: de * u[0] + dn * u[1], d: de * P.n[0] + dn * P.n[1] };
    }).filter(q => q.s > -1 && q.s < L + 1 && q.d < 0.5 && q.d > -14);
    if (near.length < 2) continue;
    const dmax = Math.max(...near.map(q => q.d)), row = near.filter(q => q.d > dmax - 1).sort((x, y) => x.s - y.s);
    for (let i = 0; i + 1 < row.length; i++) {
      const a = row[i].c, b = row[i + 1].c, o = a.order, yTop = a.y0 + o.height - o.capitalH - DRESS.belowCapital;
      if (yTop - a.y0 < 3) continue;
      out.push({ building: P.building, a, b, u, n: P.n, yTop, y0: a.y0 });
    }
  }
  return out;
}

/** one curtain tied back to the column at `s0` (its shaft's edge), spreading toward `sMid` at the top; `dir` +1 toward b */
function curtain(S: Soup, bay: Bay, from: Column, dir: 1 | -1, rgb: number[], border: number[], rng: Rng) {
  const D = DRESS, r = from.order.shaftD / 2 + 0.03, span = Math.hypot(bay.b.c[0] - bay.a.c[0], bay.b.c[1] - bay.a.c[1]);
  const top = span / 2 - 0.04 - r, H = bay.yTop - bay.y0, NJ = 12, NI = 7, ph = rng.next() * 6.28;
  const at = (i: number, j: number) => {
    const t = j / NJ, y = bay.yTop - t * (H - 0.04); // t: 0 top .. 1 floor
    // the free edge's width from the column: wide at the top, gathered at the tie, flaring a little to the floor
    const w = t < D.tie ? top + (D.tieW - top) * Math.pow(t / D.tie, 0.7) : D.tieW + (D.footW - D.tieW) * ((t - D.tie) / (1 - D.tie));
    const f = i / NI, s = r + f * w, gather = Math.max(0, 1 - Math.abs(t - D.tie) / 0.35);
    const z = Math.sin(f * D.folds * 2 * Math.PI + ph) * (D.foldAmp + D.gatherAmp * gather) * (0.4 + 0.6 * f);
    const e = from.c[0] + bay.u[0] * s * dir + bay.n[0] * z, n = from.c[1] + bay.u[1] * s * dir + bay.n[1] * z;
    return W(e, y, n);
  };
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) S.quad(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1), i === NI - 1 ? border : rgb);
}
/** the valance across a bay under the capitals: three stripes, the lowest cut in scallops */
function valance(S: Soup, bay: Bay, cols: number[][]) {
  const V = DRESS.valance, a = bay.a.c, b = bay.b.c, span = Math.hypot(b[0] - a[0], b[1] - a[1]), r = bay.a.order.shaftD / 2;
  const n = Math.max(2, Math.round((span - 2 * r) / V.scallops)), y1 = bay.yTop + DRESS.belowCapital - 0.05, off = 0.06;
  const P = (s: number, y: number, z = 0) => W(a[0] + bay.u[0] * s + bay.n[0] * (off + z), y, a[1] + bay.u[1] * s + bay.n[1] * (off + z));
  const st = [0.22, 0.38, 0.4].map(x => x * V.drop);
  for (let k = 0; k < n; k++) {
    const s0 = r + (k / n) * (span - 2 * r), s1 = r + ((k + 1) / n) * (span - 2 * r), sm = (s0 + s1) / 2, sag = 0.05;
    let y = y1;
    for (let q = 0; q < 2; q++) { const h = st[q]; S.quad(P(s0, y), P(s1, y), P(s1, y - h, sag), P(s0, y - h, sag), cols[q]); y -= h; }
    // the scallop: a fan to the point under the middle
    const yb = y - st[2];
    S.tri(P(s0, y, sag), P(s1, y, sag), P(sm, yb, sag * 2), cols[2]);
  }
}

export interface StandardAt { building: string; e: number; n: number; y: number }
/** where the standards fly: the Gate's roof corners, the Apadana's towers (their outer corners), the Tachara's and the
 *  Hadish's roof corners on their portico side */
export function standardPlaces(parts: Part[]): StandardAt[] {
  const out: StandardAt[] = [], R = ROOFEDGE, inset = R.parapet.t + 0.5, top = R.parapet.h + R.parapet.coping.h;
  const corners = (b: Box) => { const r = b.rot ?? 0, c = Math.cos(r), s = Math.sin(r), hx = b.size[0] / 2 - inset, hy = b.size[1] / 2 - inset;
    return [[hx, hy], [-hx, hy], [-hx, -hy], [hx, -hy]].map(([x, y]) => [b.c[0] + x * c - y * s, b.c[1] + x * s + y * c] as [number, number]); };
  const boxes = parts.filter(p => p.type === 'box') as Box[];
  for (const b of boxes) {
    if (b.building === 'gate_nations' && b.kind === 'roof') for (const [e, n] of corners(b)) out.push({ building: b.building, e, n, y: b.y1 + top });
    if ((b.building === 'tachara' || b.building === 'hadish') && b.kind === 'roof') {
      const P = roofEdges(parts).porches.find(p => p.building === b.building && Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) > 12);
      const cs = corners(b).map(([e, n]) => ({ e, n, d: P ? (e - b.c[0]) * P.n[0] + (n - b.c[1]) * P.n[1] : 0 })).sort((p, q) => q.d - p.d).slice(0, 2);
      for (const q of cs) out.push({ building: b.building, e: q.e, n: q.n, y: b.y1 + top });
    }
  }
  { // the Apadana's towers (their envelopes: D-753 made them hollow): the outer corner of each
    const ap = towerEnvelopes(parts), cx = ap.reduce((a, q) => a + q.c[0], 0) / Math.max(1, ap.length), cy = ap.reduce((a, q) => a + q.c[1], 0) / Math.max(1, ap.length);
    for (const b of ap) { const k = corners(b).sort((p, q) => Math.hypot(q[0] - cx, q[1] - cy) - Math.hypot(p[0] - cx, p[1] - cy))[0]; out.push({ building: b.building, e: k[0], n: k[1], y: b.y1 + ROOFEDGE.cap + top }); } }
  return out;
}
/** a standard: the pole (octagonal), the finial (a bronze disc on a ball, the eagle's seat), and the swallow-tailed banner */
function standard(pole: Soup, cloth: Soup, metal: Soup, at: StandardAt, rng: Rng) {
  const D = DRESS.standard, y1 = at.y + D.pole, wood = lin([0.36, 0.26, 0.17]), m = lin([0.66, 0.5, 0.26]);
  for (let k = 0; k < 8; k++) { const a0 = (k / 8) * 2 * Math.PI, a1 = ((k + 1) / 8) * 2 * Math.PI, c0 = Math.cos(a0) * D.poleR, s0 = Math.sin(a0) * D.poleR, c1 = Math.cos(a1) * D.poleR, s1 = Math.sin(a1) * D.poleR;
    pole.quad(W(at.e + c0, at.y, at.n + s0), W(at.e + c1, at.y, at.n + s1), W(at.e + c1 * 0.7, y1, at.n + s1 * 0.7), W(at.e + c0 * 0.7, y1, at.n + s0 * 0.7), wood); }
  // the finial: a ball and a disc above it (as a flat 10-gon, both faces)
  const F = D.finial, yc = y1 + F;
  for (let k = 0; k < 10; k++) { const a0 = (k / 10) * 2 * Math.PI, a1 = ((k + 1) / 10) * 2 * Math.PI;
    metal.tri(W(at.e, yc + F * 0.9, at.n), W(at.e + Math.cos(a0) * F * 1.4, yc + F * 0.9 + Math.sin(a0) * F * 1.4, at.n), W(at.e + Math.cos(a1) * F * 1.4, yc + F * 0.9 + Math.sin(a1) * F * 1.4, at.n), m);
    for (let j = 0; j < 4; j++) { const p0 = (j / 4) * Math.PI - Math.PI / 2, p1 = ((j + 1) / 4) * Math.PI - Math.PI / 2, B = (a: number, p: number) => W(at.e + Math.cos(a) * Math.cos(p) * F * 0.5, y1 + F * 0.5 + Math.sin(p) * F * 0.5, at.n + Math.sin(a) * Math.cos(p) * F * 0.5);
      metal.quad(B(a0, p0), B(a1, p0), B(a1, p1), B(a0, p1), m); } }
  // the banner: from the pole's top downwind, in waves along its length, its fly cut in a swallow tail
  const az = D.windAz + (rng.next() - 0.5) * 0.5, ue = Math.cos(az), un = Math.sin(az), NI = 10, NJ = 4, ph = rng.next() * 6.28, top = y1 - 0.25;
  const red = lin(D.cloth), hem = lin(D.hem);
  const at2 = (i: number, j: number) => {
    const f = i / NI, g = j / NJ, droop = f * f * 0.35, wave = Math.sin(f * 2.6 * Math.PI + ph) * 0.18 * f;
    let x = f * D.flagW; if (f > 0.75) x -= Math.max(0, 1 - Math.abs(g - 0.5) * 2) * D.tail * (f - 0.75) / 0.25; // the swallow tail's notch
    return W(at.e + ue * x - un * wave, top - g * D.flagH - droop, at.n + un * x + ue * wave);
  };
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) cloth.quad(at2(i, j), at2(i + 1, j), at2(i + 1, j + 1), at2(i, j + 1), j === 0 || j === NJ - 1 ? hem : red);
}

/** D-750 (C): blind windows on the Apadana corner towers' free outer faces: the Tachara's and the Hadish's window frames
 *  (dark polished limestone, a gorge cornice over the lintel: global.r_window, WP-EXT C) set as recesses in two rows, the
 *  towers' 24 m of blank plaster broken as the reconstructions show them (C) */
export const TOWER_WINDOWS = { w: 1.5, h: 3, frame: 0.32, depth: 0.35, cornice: { h: 0.45, over: 0.22, proj: 0.28 }, rows: [9.5, 16.5], pitch: 5.6, edge: 3.2,
  stone: [0.27, 0.26, 0.25], recess: [0.1, 0.085, 0.07] };
export function towerWindowFaces(parts: Part[]): { c: [number, number]; u: [number, number]; n: [number, number]; y0: number; len: number }[] {
  const T = towerEnvelopes(parts); if (!T.length) return [];
  const boxes = parts.filter(p => p.type === 'box' && p.building === 'apadana' && !p.door && !(p as Box).env && p.kind !== 'step') as Box[];
  const cx = T.reduce((a, q) => a + q.c[0], 0) / T.length, cy = T.reduce((a, q) => a + q.c[1], 0) / T.length, out: ReturnType<typeof towerWindowFaces> = [];
  const inside = (e: number, n: number, y: number, self: Box) => boxes.some(b => b !== self && y >= b.y0 && y <= b.y1 && Math.abs(e - b.c[0]) <= b.size[0] / 2 && Math.abs(n - b.c[1]) <= b.size[1] / 2);
  for (const t of T) for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
    if ((t.c[0] - cx) * nx + (t.c[1] - cy) * ny <= 0) continue; // the outer faces only
    const c: [number, number] = [t.c[0] + nx * t.size[0] / 2, t.c[1] + ny * t.size[1] / 2], len = nx ? t.size[1] : t.size[0], u: [number, number] = [-ny, nx];
    if (inside(c[0] + nx * 0.3, c[1] + ny * 0.3, t.y0 + 12, t)) continue; // something stands against it
    out.push({ c, u, n: [nx, ny], y0: t.y0, len });
  }
  return out;
}
function towerWindows(S: Soup, parts: Part[]): number {
  const TW = TOWER_WINDOWS, stone = lin(TW.stone), dark = lin(TW.recess); let n = 0;
  for (const f of towerWindowFaces(parts)) {
    const k = Math.floor((f.len - 2 * TW.edge - TW.w) / TW.pitch) + 1; if (k < 1) continue;
    const a0 = -((k - 1) * TW.pitch) / 2;
    // a point on the face: s along, y up, z out of the face
    const P = (s: number, y: number, z: number) => W(f.c[0] + f.u[0] * s + f.n[0] * z, y, f.c[1] + f.u[1] * s + f.n[1] * z);
    const box = (s0: number, s1: number, y0: number, y1: number, z0: number, z1: number, rgb: number[]) => { // a block's five visible faces (two-sided: no winding to get wrong)
      S.quad(P(s0, y0, z1), P(s1, y0, z1), P(s1, y1, z1), P(s0, y1, z1), rgb);
      S.quad(P(s0, y1, z0), P(s0, y1, z1), P(s1, y1, z1), P(s1, y1, z0), rgb); S.quad(P(s0, y0, z0), P(s1, y0, z0), P(s1, y0, z1), P(s0, y0, z1), rgb);
      S.quad(P(s0, y0, z0), P(s0, y0, z1), P(s0, y1, z1), P(s0, y1, z0), rgb); S.quad(P(s1, y0, z0), P(s1, y1, z0), P(s1, y1, z1), P(s1, y0, z1), rgb); };
    for (const row of TW.rows) for (let i = 0; i < k; i++) {
      const s = a0 + i * TW.pitch, y0 = f.y0 + row, y1 = y0 + TW.h, hw = TW.w / 2, fr = TW.frame, C = TW.cornice;
      S.quad(P(s - hw, y0, -TW.depth), P(s + hw, y0, -TW.depth), P(s + hw, y1, -TW.depth), P(s - hw, y1, -TW.depth), dark); // the recess's back
      S.quad(P(s - hw, y0, -TW.depth), P(s - hw, y0, 0), P(s - hw, y1, 0), P(s - hw, y1, -TW.depth), dark); S.quad(P(s + hw, y0, -TW.depth), P(s + hw, y1, -TW.depth), P(s + hw, y1, 0), P(s + hw, y0, 0), dark); // its reveals
      S.quad(P(s - hw, y1, -TW.depth), P(s - hw, y1, 0), P(s + hw, y1, 0), P(s + hw, y1, -TW.depth), dark); // its soffit
      box(s - hw - fr, s - hw, y0 - fr, y1, 0, 0.06, stone); box(s + hw, s + hw + fr, y0 - fr, y1, 0, 0.06, stone); box(s - hw, s + hw, y0 - fr, y0, 0, 0.06, stone); // jambs and sill
      box(s - hw - fr, s + hw + fr, y1, y1 + fr, 0, 0.06, stone); box(s - hw - fr - C.over, s + hw + fr + C.over, y1 + fr, y1 + fr + C.h, 0, C.proj, stone); // lintel and its gorge cornice
      n++;
    }
  }
  return n;
}

/** the dressings as a group of up to three merged meshes (textile, wood, bronze), named 'c10:dressings' */
export function buildDressings(parts: Part[]): THREE.Group | null {
  const D = DRESS, rng = new Rng(750, 'dressings'), cloth = new Soup(), wood = new Soup(), metal = new Soup();
  const linen = lin(D.linen), green = lin(D.green), blue = lin(D.blue), purple = lin(D.purple);
  const bays = porchBays(parts);
  bays.forEach((bay, i) => {
    const c1 = i % 2 ? blue : green;
    curtain(cloth, bay, bay.a, 1, i % 3 === 0 ? linen : c1, purple, rng);
    curtain(cloth, bay, bay.b, -1, i % 3 === 0 ? linen : c1, purple, rng);
    valance(cloth, bay, [purple, linen, c1]);
  });
  const st = standardPlaces(parts); for (const s of st) standard(wood, cloth, metal, s, rng);
  const stone = new Soup(), nWin = towerWindows(stone, parts);
  if (!cloth.tris) return null;
  const g = new THREE.Group(); g.name = 'c10:dressings';
  const add = (S: Soup, mat: THREE.Material, name: string, note: string) => { if (!S.tris) return; const m = new THREE.Mesh(S.geometry(), mat); m.name = name; m.castShadow = true; m.receiveShadow = true;
    m.userData = { tier: D.tier, src: D.src, placeholder: false, tris: S.tris, note }; g.add(m); };
  add(cloth, propMaterial('textile', { vertexColors: true, rough: 0.95 }), 'c10:dressings:cloth', `the porticoes' hangings (${bays.length} bays: two tied-back curtains and a valance each; white, green, blue and purple after Esther 1:6, B for the practice, C for the form) and ${st.length} royal standards' banners (Xenophon Cyr. 7.1.4 for the standard, B; their places C) (D-750)`);
  add(wood, propMaterial('wood', { vertexColors: true, rough: 0.8 }), 'c10:dressings:poles', `the ${st.length} standards' cedar poles (D-750, C)`);
  add(stone, propMaterial('stone', { vertexColors: true, rough: 0.95 }), 'c10:dressings:tower-windows', `${nWin} blind windows in dark stone frames on the Apadana towers' outer faces (the Tachara's frames, global.r_window; their places C) (D-750)`);
  add(metal, surfaceMaterial('bronze', { vertexColors: true }), 'c10:dressings:finials', `the ${st.length} standards' bronze finials (the eagle's seat; D-750, C)`);
  g.userData = { tier: D.tier, src: D.src, placeholder: false, bays: bays.length, standards: st.length, windows: nWin };
  return g;
}
