// D-670 (C1's ask through the lead): the plain-side work places, built. town.json's facilities were staffed (the people go
// to them every day: C1) but nothing stood there. Each is laid out here from the project's period kit (tools/blender/
// model_props.py, ASSET_LEDGER.md) and walled where a yard was walled (mud brick, ~1.8 m, a gateway): all layout C.
//  - the brickyard by the canal (E-63 'brick yards by water'): mixing pits of wet mud and straw, the moulders' fields of
//    bricks drying in rows (acres of them), stacks of dry bricks, straw stacks; a second drying field at the Terrace foot
//    by the Hall of 100 Columns' works (the spot shared with C10's works);
//  - the stockyard (PF 58-60): walled, with pens of wattle hurdles, mangers and a trough;
//  - the tannery: walled, the soaking vats, hides stretched on frames and hides lying to dry (downwind of the town, C);
//  - the oil press (and wine press) house: walled, the presses and the store jars;
//  - the mill (nupištaš, PF 28-29): walled, querns for the women's grinding groups, sacks; the brewery/bakery: ovens, vats, jars;
//  - the clay pit: the dug ground's mud heaps and the clay carried to the brickyard.
// A yard is moved from its town.json point (C) to the nearest clear ground within 160 m when it would overlap a built site
// of the town or stand on a road (the same rule for the page, C1's people and the tests: worksLayout is pure).
// API for the people (C1): worksLayout(plan).spots: where each act is done (facility id, act, grid e, n, facing).
import * as THREE from 'three/webgpu';
import townJson from '../../data/town.json';
import { model, modelParts, aoFactor } from '../../render/scanProps';
import { propMaterialMulti, surfaceMaterial } from '../../render/materials';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vergeZone } from './verge';
import type { Terrain } from '../../terrain/heightfield';
import type { Physics } from '../../player/physics';

type P2 = [number, number];
export interface WorkSpot { facility: string; act: string; e: number; n: number; yaw: number }
export interface WorkItem { m: string; e: number; n: number; rot: number; s: [number, number, number] }
export interface WorkWall { a: P2; b: P2; h: number; t: number }
export interface WorkYard { id: string; kind: string; c: P2; theta: number; W: number; H: number; walled: boolean; moved: number }
export interface WorksLayout { yards: WorkYard[]; walls: WorkWall[]; items: WorkItem[]; spots: WorkSpot[] }
export const WORKS_TAG = { tier: 'C', src: 'CDLI-PF;WP-CAL;MAYS2010;RECON', note: 'the plain-side works (D-670): brickyard, stockyard, tannery, press house, mill, bakery-brewery, clay pit: town.json facilities (positions C), laid out from the period kit (all C)' };

/** the yards: town.json facility, footprint (m), walled; the extra drying field at the Terrace foot */
const YARDS: { id: string; kind: string; W: number; H: number; walled: boolean; at?: P2 }[] = [
  { id: 'brickyard', kind: 'brickyard', W: 90, H: 60, walled: false },
  { id: 'terrace_bricks', kind: 'bricks', W: 50, H: 34, walled: false, at: [150, 300] },
  { id: 'stockyard', kind: 'stockyard', W: 54, H: 40, walled: true },
  { id: 'tannery', kind: 'tannery', W: 32, H: 26, walled: true },
  { id: 'oil_press', kind: 'press', W: 22, H: 16, walled: true },
  { id: 'mill', kind: 'mill', W: 22, H: 18, walled: true },
  { id: 'brewery', kind: 'bakery', W: 22, H: 18, walled: true },
  { id: 'clay_pit', kind: 'claypit', W: 40, H: 28, walled: false },
];
function h32(...v: number[]) { let h = 2166136261 >>> 0; for (const x of v) { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; } return h >>> 0; }
const u01 = (...v: number[]) => h32(...v) / 4294967296;

/** the works laid out against the town as built (its sites: centre, turn, size) */
export function worksLayout(plan: { sites: { frame: { c: number[]; theta: number }; W: number; H: number }[] } | null): WorksLayout {
  const fac = Object.fromEntries(((townJson as any).facilities as { id: string; at: P2 }[]).map(f => [f.id, f.at]));
  const sites = plan?.sites ?? [];
  const inSite = (e: number, n: number, m: number) => sites.some(s => { const de = e - s.frame.c[0], dn = n - s.frame.c[1], c = Math.cos(s.frame.theta), sn = Math.sin(s.frame.theta);
    return Math.abs(de * c + dn * sn) < s.W / 2 + m && Math.abs(-de * sn + dn * c) < s.H / 2 + m; });
  const out: WorksLayout = { yards: [], walls: [], items: [], spots: [] }, placed: WorkYard[] = [];
  const clear = (c: P2, th: number, W: number, H: number) => {
    const ca = Math.cos(th), sa = Math.sin(th);
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const u = (i / 4 - 0.5) * W, v = (j / 4 - 0.5) * H, e = c[0] + u * ca - v * sa, n = c[1] + u * sa + v * ca;
      if (inSite(e, n, 6) || vergeZone(e, n)) return false; }
    return !placed.some(y => Math.hypot(y.c[0] - c[0], y.c[1] - c[1]) < (Math.hypot(y.W, y.H) + Math.hypot(W, H)) / 2 + 4);
  };
  for (const Y of YARDS) {
    const at = Y.at ?? fac[Y.id]; if (!at) continue;
    const th = (u01(h32(Y.id.length, at[0] | 0), 3) - 0.5) * 0.5; let c: P2 = [at[0], at[1]], moved = 0;
    if (!clear(c, th, Y.W, Y.H)) { let found = false;
      for (let d = 10; d <= 160 && !found; d += 10) for (let a = 0; a < 360; a += 20) { const p: P2 = [at[0] + d * Math.cos(a * Math.PI / 180), at[1] + d * Math.sin(a * Math.PI / 180)]; if (clear(p, th, Y.W, Y.H)) { c = p; moved = d; found = true; break; } }
      if (!found) continue; }
    const yard: WorkYard = { id: Y.id, kind: Y.kind, c, theta: th, W: Y.W, H: Y.H, walled: Y.walled, moved }; placed.push(yard); out.yards.push(yard);
    layYard(yard, out);
  }
  return out;
}

/** one yard's walls, things and work spots (yard frame: u along W, v along H; the gate in the S side, -v) */
function layYard(y: WorkYard, out: WorksLayout) {
  const ca = Math.cos(y.theta), sa = Math.sin(y.theta), at = (u: number, v: number): P2 => [y.c[0] + u * ca - v * sa, y.c[1] + u * sa + v * ca];
  const put = (m: string, u: number, v: number, rot = 0, s: [number, number, number] = [1, 1, 1]) => { const p = at(u, v); out.items.push({ m, e: p[0], n: p[1], rot: rot + y.theta, s }); };
  const spot = (act: string, u: number, v: number, yaw = 0) => { const p = at(u, v); out.spots.push({ facility: y.id, act, e: p[0], n: p[1], yaw: yaw + y.theta }); };
  const W = y.W, H = y.H, r = (k: number) => u01(h32(y.c[0] | 0, y.c[1] | 0, k));
  if (y.walled) { const hw = W / 2, hh = H / 2, gate = 3.2, wh = 1.7 + 0.3 * r(1);
    out.walls.push({ a: at(-hw, hh), b: at(hw, hh), h: wh, t: 0.55 }, { a: at(-hw, -hh), b: at(-hw, hh), h: wh, t: 0.55 }, { a: at(hw, -hh), b: at(hw, hh), h: wh, t: 0.55 },
      { a: at(-hw, -hh), b: at(-gate / 2, -hh), h: wh, t: 0.55 }, { a: at(gate / 2, -hh), b: at(hw, -hh), h: wh, t: 0.55 }); }
  switch (y.kind) {
    case 'brickyard': case 'bricks': {
      // mixing pits along the N side (the canal's side), the drying field in rows, the dry stacks and the straw by the gate side
      const big = y.kind === 'brickyard';
      if (big) { for (let i = 0; i < 6; i++) { const u = -W / 2 + 8 + i * ((W - 16) / 5); put('wo_mud_heap', u, H / 2 - 5, r(10 + i) * 6.28, [4.5, 2.2, 4.5]); put('wo_mortar_tub', u + 2.4, H / 2 - 7, 0); spot('mix', u + 1.5, H / 2 - 7.5, Math.PI); } }
      const rows = big ? 14 : 9, perRow = big ? 34 : 20, v0 = big ? H / 2 - 12 : H / 2 - 3;
      for (let k = 0; k < rows; k++) for (let i = 0; i < perRow; i++) { if (r(100 + k * 50 + i) < 0.08) continue; // a gap where a batch was lifted
        put('wo_brick_field', -W / 2 + 3 + i * ((W - 6) / perRow) + 1, v0 - k * 2.4, 0, [1, 1, 1]); }
      for (let k = 0; k < rows; k += 3) spot('mould', -W / 2 + 4 + r(200 + k) * (W - 8), v0 - k * 2.4 - 1.2, 0);
      const stacks = big ? 18 : 8; for (let i = 0; i < stacks; i++) { const u = -W / 2 + 3 + (i % 9) * ((W - 6) / 8), v = -H / 2 + 3 + Math.floor(i / 9) * 2.2; put('wo_brick_stack', u, v, r(300 + i) * 0.4, [2.2, 1.8, 2.2]); if (i % 4 === 0) spot('stack', u, v + 1.4, Math.PI); }
      if (big) for (let i = 0; i < 3; i++) put('wo_fodder', W / 2 - 6, -H / 2 + 8 + i * 7, r(400 + i) * 6.28, [5, 4.5 + 2 * r(410 + i), 5]);
      break; }
    case 'stockyard': {
      for (let i = 0; i < 3; i++) { put('wo_hurdles', -W / 2 + 11 + i * 16, H / 2 - 10.5, i * 1.57, [0.62, 1, 0.55]); spot('herd', -W / 2 + 11 + i * 16, H / 2 - 18, 0); }
      for (let i = 0; i < 4; i++) put('manger', -W / 2 + 6 + i * 4, -H / 2 + 3, 0);
      put('trough', W / 2 - 6, -H / 2 + 4, 1.57); spot('water', W / 2 - 7.5, -H / 2 + 4, 1.57); spot('slaughter', 0, -H / 2 + 7, 0);
      break; }
    case 'tannery': {
      for (let i = 0; i < 8; i++) { const u = -W / 2 + 4 + (i % 4) * 3, v = H / 2 - 4 - Math.floor(i / 4) * 3; put('vat', u, v, r(500 + i) * 6.28, [1.6, 1.1, 1.6]); if (i % 2 === 0) spot('soak', u, v - 1.4, 0); }
      for (let i = 0; i < 3; i++) { put('wo_hide_frames', W / 2 - 6, H / 2 - 5 - i * 5, 1.57); spot('scrape', W / 2 - 8.5, H / 2 - 5 - i * 5, -Math.PI / 2); }
      for (let i = 0; i < 10; i++) put('wo_hides', -W / 2 + 4 + r(600 + i) * (W - 8), -H / 2 + 3 + r(620 + i) * 6, r(640 + i) * 6.28);
      break; }
    case 'press': {
      put('wo_press', -W / 4, 2, 0, [1.3, 1, 1.3]); spot('tread', -W / 4, 2, 0);
      for (let i = 0; i < 3; i++) { put('wo_oil_press', W / 4 - 2 + i * 1.6, 3, r(700 + i)); spot('press', W / 4 - 2 + i * 1.6, 1.8, 0); }
      for (let i = 0; i < 12; i++) put('jar_store', -W / 2 + 1.5 + (i % 6) * 0.8, H / 2 - 1.5 - Math.floor(i / 6) * 0.8, r(720 + i) * 6.28);
      break; }
    case 'mill': {
      for (let i = 0; i < 8; i++) { const u = -W / 2 + 3.5 + (i % 4) * 4.5, v = Math.floor(i / 4) * 5 - 1; put('quern', u, v, r(800 + i) * 6.28); spot('grind', u, v - 0.9, 0); }
      for (let i = 0; i < 14; i++) put('sack', W / 2 - 1.5 - (i % 7) * 0.55, H / 2 - 1.5 - Math.floor(i / 7) * 0.6, r(820 + i) * 6.28);
      break; }
    case 'bakery': {
      for (let i = 0; i < 3; i++) { put('oven', -W / 2 + 4 + i * 5, H / 2 - 3, Math.PI); spot('bake', -W / 2 + 4 + i * 5, H / 2 - 5, 0); }
      for (let i = 0; i < 6; i++) { put('vat', -W / 2 + 4 + i * 2.6, -1, r(900 + i) * 6.28, [1.3, 1, 1.3]); if (i % 2 === 0) spot('brew', -W / 2 + 4 + i * 2.6, -2.3, 0); }
      for (let i = 0; i < 10; i++) put('jar_store', W / 2 - 1.5 - (i % 5) * 0.8, -H / 2 + 2 + Math.floor(i / 5) * 0.8, r(920 + i) * 6.28);
      break; }
    case 'claypit': {
      for (let i = 0; i < 10; i++) { const u = (r(1000 + i) - 0.5) * (W - 6), v = (r(1010 + i) - 0.5) * (H - 6); put('wo_mud_heap', u, v, r(1020 + i) * 6.28, [3 + 3 * r(1030 + i), 2.5, 3 + 3 * r(1040 + i)]); if (i % 3 === 0) spot('dig', u + 1.8, v, 0); }
      break; }
  }
}

type RGB = [number, number, number];
/** the kit's parts: material kind and sRGB colour (as fieldFill.ts and fill.ts) */
const PART: Record<string, [string, RGB]> = {
  mud: ['mud', [0.6, 0.48, 0.36]], mud_wet: ['mud', [0.44, 0.36, 0.27]], brick: ['mud', [0.66, 0.53, 0.39]], straw: ['reed', [0.8, 0.7, 0.46]], straw_d: ['reed', [0.62, 0.53, 0.34]],
  wicker: ['reed', [0.64, 0.54, 0.36]], wattle: ['wood', [0.5, 0.42, 0.31]], wood: ['wood', [0.47, 0.37, 0.27]], wood_d: ['wood', [0.38, 0.3, 0.22]], mud_roof: ['mud', [0.55, 0.46, 0.35]],
  pot: ['mud', [0.64, 0.46, 0.33]], clay: ['mud', [0.66, 0.46, 0.32]], stone: ['wood', [0.7, 0.66, 0.58]], water: ['mud', [0.25, 0.27, 0.25]], hide: ['reed', [0.62, 0.48, 0.34]],
  hide_d: ['reed', [0.48, 0.36, 0.25]], hide_w: ['reed', [0.74, 0.66, 0.54]], stain: ['mud', [0.36, 0.3, 0.24]], lime: ['mud', [0.86, 0.84, 0.78]], cord: ['reed', [0.58, 0.5, 0.36]],
  cloth: ['reed', [0.72, 0.64, 0.5]], grape: ['mud', [0.35, 0.16, 0.24]], paste: ['mud', [0.5, 0.42, 0.22]], ash: ['mud', [0.42, 0.4, 0.38]], fodder: ['reed', [0.78, 0.67, 0.42]], beam: ['wood', [0.45, 0.36, 0.26]], leather: ['reed', [0.5, 0.36, 0.24]],
};
const KINDS = [...new Set(Object.values(PART).map(p => p[0]))];

/** the works as built: walls (mud brick, colliders), the kit's things (one InstancedMesh per model, lod1 within 60 m of
 *  the yard's centre is not needed: the far level reads at the yards' scale; frustum-culled per model) */
export class Works {
  readonly group = new THREE.Group(); readonly layout: WorksLayout; readonly missing: string[] = [];
  constructor(plan: Parameters<typeof worksLayout>[0], terrain: Terrain, phys: Physics | null) {
    this.group.name = 'plain-works'; this.group.userData = { ...WORKS_TAG };
    const L = this.layout = worksLayout(plan), ground = (e: number, n: number) => terrain.surfaceAt(e, -n);
    // walls: one merged mesh of boxes on the ground, a collider each
    const boxes: THREE.BufferGeometry[] = [];
    for (const w of L.walls) { const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), mid: P2 = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2], ang = Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]);
      const g0 = Math.min(ground(w.a[0], w.a[1]), ground(w.b[0], w.b[1]), ground(mid[0], mid[1])) - 0.3, top = Math.max(ground(w.a[0], w.a[1]), ground(w.b[0], w.b[1])) + w.h;
      const g = new THREE.BoxGeometry(len + w.t, top - g0, w.t); g.rotateY(ang); g.translate(mid[0], (top + g0) / 2, -mid[1]); boxes.push(g);
      phys?.addBox({ x: mid[0], y: (top + g0) / 2, z: -mid[1] }, { x: (len + w.t) / 2, y: (top - g0) / 2, z: w.t / 2 }, ang); }
    if (boxes.length) { const m = new THREE.Mesh(mergeGeometries(boxes)!, surfaceMaterial('mudbrick')); m.name = 'works-walls'; m.castShadow = m.receiveShadow = true; m.userData = this.group.userData; this.group.add(m); }
    // things
    const byM = new Map<string, WorkItem[]>();
    for (const it of L.items) { let a = byM.get(it.m); if (!a) byM.set(it.m, a = []); a.push(it); }
    for (const [mName, list] of byM) {
      const mesh = kitMesh(mName, list, ground); if (!mesh) { this.missing.push(mName); continue; }
      mesh.castShadow = !/brick_field|hides|mud_heap/.test(mName); mesh.userData = this.group.userData; this.group.add(mesh);
    }
    if (this.missing.length) this.group.userData = { ...this.group.userData, note: `${this.group.userData.note}; not loaded (not drawn): ${this.missing.join(', ')}` };
  }
  stats() { return { yards: this.layout.yards.length, items: this.layout.items.length, spots: this.layout.spots.length, walls: this.layout.walls.length, missing: this.missing }; }
}

/** one InstancedMesh of a kit model (its far level, parts merged in the one multi-kind material) at the items (grid e, n;
 *  rot about up; scale; y from `ground`, or the item's own `y` when given); null when the model did not load */
export function kitMesh(mName: string, list: (WorkItem & { y?: number })[], ground: (e: number, n: number) => number, level: 1 | 2 = 2): THREE.InstancedMesh | null {
  {
    const mat = propMaterialMulti(KINDS), col = new THREE.Color();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
    {
      if (!model(mName)) return null;
      const parts = modelParts(mName, level) ?? modelParts(mName, 1); if (!parts) return null;
      const P: number[] = [], N: number[] = [], C: number[] = [], K: number[] = [], R: number[] = [], I: number[] = [];
      for (const [part, g0] of Object.entries(parts)) { const def = PART[part] ?? ['mud', [0.6, 0.5, 0.4]] as [string, RGB], pos = g0.getAttribute('position'), nor = g0.getAttribute('normal') ?? (g0.computeVertexNormals(), g0.getAttribute('normal')), base = P.length / 3;
        col.setRGB(def[1][0], def[1][1], def[1][2], THREE.SRGBColorSpace); const ki = Math.max(0, KINDS.indexOf(def[0]));
        for (let i = 0; i < pos.count; i++) { const a = aoFactor(g0, i); P.push(pos.getX(i), pos.getY(i), pos.getZ(i)); N.push(nor.getX(i), nor.getY(i), nor.getZ(i)); C.push(col.r * a, col.g * a, col.b * a); K.push(ki); R.push(0.85); }
        if (g0.index) for (let i = 0; i < g0.index.count; i++) I.push(base + g0.index.getX(i)); else for (let i = 0; i < pos.count; i++) I.push(base + i); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aKind', new THREE.Float32BufferAttribute(K, 1)); g.setAttribute('aRough', new THREE.Float32BufferAttribute(R, 1)); g.setIndex(I);
      const mesh = new THREE.InstancedMesh(g, mat, list.length);
      list.forEach((it, i) => { q.setFromAxisAngle(up, it.rot); m4.compose(p.set(it.e, it.y ?? ground(it.e, it.n) - 0.02, -it.n), q, sc.set(it.s[0], it.s[1], it.s[2])); mesh.setMatrixAt(i, m4); });
      mesh.computeBoundingSphere(); mesh.receiveShadow = true; mesh.name = `works:${mName}`;
      return mesh;
    }
  }
}
