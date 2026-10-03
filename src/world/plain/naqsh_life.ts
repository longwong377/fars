// s18 C15 (D-800): the ground before the cliff of Naqsh-e Rustam as it was used in 467 BCE, beyond the monuments themselves:
//  - the SECOND TOMB BEING CUT (ENE of Darius' tomb; later attributed to Xerxes, who is alive in 467: D-033): a scaffold of
//    lashed poplar poles from the cliff foot up the whole façade (two rows of standards, ledgers every 2 m, transoms, plank
//    decks at the façade's foot, the median register, the upper register and under the crown, braces), the spoil of fresh
//    limestone chips thrown down below it (a pale talus with spalls and rejected blocks), and the cutters' lean-to at the foot
//    (poles and a reed-mat roof; tool baskets, a water jar, the whetstone, a bench). Rock-cut tombs were cut from the top down
//    from scaffolds and the spoil cleared below (C: the unfinished Persepolis tomb and the Achaemenid quarries by analogy);
//  - the KEEPERS' HOUSE (D-640's household of four, population.ts NAQSH.house): a small whitewashed courtyard house of mud
//    brick, two rooms on the N side with open doorways, the yard with its tannur and the sheep pen, the gate in the S wall (C);
//  - the OFFERING TABLE before Darius' tomb (D-640: the day's offering of a sheep, wine and flour, the barsom in hand, by
//    analogy with the magi at Cyrus' tomb, Arrian 6.29, C): a white stone table with bowls, a wine jar, the flour, a barsom
//    bundle and flowers, a reed mat before it (no inscription, no altar of the later "fire altar" type).
// One vertex-coloured mesh (one draw), colliders as boxes and one trimesh for the spoil. Everything tier C.
// s18 C15 also: the Akhor Rostam burial niches and the private rock tombs of the people of Pārsa (see buildNaqshLife).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Terrain } from '../../terrain/heightfield';
import type { Physics } from '../../player/physics';
import { SURFACES, surfaceMaterial } from '../../render/materials';
import { srgbToLinear, type RGB } from '../../core/colour';

SURFACES.nr_works = { albedo: [0.6, 0.55, 0.47], roughness: 0.88, porosity: 0.6, noiseScale: 1.4, noiseAmp: 0.1, bump: { amp: 0.004, freq: 2.2 }, tier: 'C', note: 'Naqsh-e Rustam in use (s18 C15, D-800): poplar poles and planks, reed matting, mud plaster and whitewash, fresh limestone chips, by vertex colour (C)' };

const L = (c: RGB): RGB => c.map(srgbToLinear) as RGB;
const C = { pole: L([0.55, 0.47, 0.37]), poleOld: L([0.48, 0.43, 0.37]), plank: L([0.62, 0.53, 0.41]), rope: L([0.66, 0.6, 0.45]), mat: L([0.7, 0.62, 0.42]),
  chips: L([0.9, 0.88, 0.82]), chipsDust: L([0.82, 0.79, 0.72]), path: L([0.62, 0.55, 0.44]), green: L([0.36, 0.45, 0.22]), green2: L([0.5, 0.52, 0.28]), tilled: L([0.45, 0.37, 0.28]), dung: L([0.36, 0.3, 0.22]), block: L([0.72, 0.69, 0.62]), wash: L([0.86, 0.83, 0.75]), mud: L([0.6, 0.51, 0.39]), roof: L([0.66, 0.58, 0.45]),
  dark: L([0.08, 0.07, 0.06]), ochre: L([0.72, 0.42, 0.28]), clay: L([0.66, 0.46, 0.33]), stone: L([0.82, 0.8, 0.74]), wine: L([0.3, 0.07, 0.1]), flour: L([0.9, 0.88, 0.82]),
  barsom: L([0.42, 0.45, 0.25]), flower: L([0.85, 0.3, 0.25]), flower2: L([0.92, 0.82, 0.35]), basket: L([0.62, 0.5, 0.3]), wool: L([0.86, 0.82, 0.72]) } as const;

type Geo = THREE.BufferGeometry;
const paint = (g: Geo, c: RGB) => { const n = g.getAttribute('position').count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const clean = (g: Geo) => { const h = g.index ? g.toNonIndexed() : g; h.deleteAttribute('uv'); return h; };
/** a box at world centre, half sizes, turned by `rot` about y */
function box(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, c: RGB, rot = 0): Geo {
  const g = clean(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2)); if (rot) g.rotateY(rot); g.translate(cx, cy, cz); return paint(g, c);
}
/** a round member from a to b (world), radius r, `seg` sides */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, c: RGB, seg = 6): Geo {
  const d = b.clone().sub(a), len = d.length(); const g = clean(new THREE.CylinderGeometry(r, r, len, seg, 1, false));
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return paint(g, c);
}
const cyl = (x: number, y: number, z: number, r: number, h: number, c: RGB, seg = 10, r2 = r) => { const g = clean(new THREE.CylinderGeometry(r2, r, h, seg)); g.translate(x, y + h / 2, z); return paint(g, c); };
const hash = (i: number, j = 0) => { const v = Math.sin(i * 127.1 + j * 311.7 + 0.5) * 43758.5453; return v - Math.floor(v); };

export interface NaqshLifeInput {
  terrain: Terrain;
  /** a point of the façade frame (x along the face, h above the ancient foot, d into the rock) in world coordinates */
  toWorld: (x: number, h: number, d: number) => THREE.Vector3;
  /** the rock face's depth at (x, h) (m into the rock; negative where it stands proud) */
  rockD: (x: number, h: number) => number;
  /** the second tomb's façade axis (x) and the first's; the façade's top above the ancient foot */
  cut: number; darius: number; top: number;
  /** the keepers' house (grid e, n) */
  house: [number, number];
  /** the Ka'ba's foot (grid e, n): the paths join it */
  kaba?: [number, number];
  /** draw the rock burials (Akhor Rostam, the private rock tombs) in this mesh (default true) */
  burials?: boolean;
  /** where they were placed (for the overlay and the people) */
  places?: { id: string; e: number; n: number }[];
  /** more geometry drawn in this mesh (the roadside, wayside.ts: one draw for the plain's budget) */
  extra?: { parts: THREE.BufferGeometry[]; boxes: { c: THREE.Vector3; h: THREE.Vector3; rot: number }[] };
}
export interface NaqshLife { mesh: THREE.Mesh; colliders(phys: Physics): void; info: Record<string, number> }

export function buildNaqshLife(I: NaqshLifeInput): NaqshLife {
  let spoil: Geo | null = null;
  const parts: Geo[] = [], boxes: { c: THREE.Vector3; h: THREE.Vector3; rot: number }[] = [], info: Record<string, number> = {};
  const H = (e: number, n: number) => I.terrain.heightAt(e, -n);
  const solid = (g: Geo, c: THREE.Vector3, h: THREE.Vector3, rot = 0) => { parts.push(g); boxes.push({ c, h, rot }); };

  // ---- the scaffold before the second façade
  const x0 = I.cut - 5.8, nx = 8, dx = 11.6 / (nx - 1), hTop = I.top + 1.2;
  // standards stand clear of the rock at every height they pass (the rough face below the façade stands proud in places)
  let inner = -0.55; for (let k = 0; k < nx; k++) for (let h = 0; h <= hTop; h += 1) inner = Math.min(inner, -I.rockD(x0 + k * dx, h) - 0.35);
  const rows = [inner, inner - 1.7], W = (x: number, h: number, d: number) => I.toWorld(x, h, d);
  let members = 0;
  for (let k = 0; k < nx; k++) for (const [ri, d] of rows.entries()) { const x = x0 + k * dx + (hash(k, ri) - 0.5) * 0.15;
    parts.push(rod(W(x, -0.4, d), W(x + (hash(k, 7) - 0.5) * 0.12, hTop, d), 0.075, hash(k, ri + 3) < 0.4 ? C.poleOld : C.pole)); members++; }
  for (let h = 2; h <= hTop; h += 2) for (const d of rows) { parts.push(rod(W(x0 - 0.4, h, d), W(x0 + 11.6 + 0.4, h + (hash(h, d) - 0.5) * 0.06, d), 0.055, C.pole)); members++; }
  for (let h = 4; h <= hTop; h += 4) for (let k = 0; k < nx; k++) { const x = x0 + k * dx; parts.push(rod(W(x, h + 0.08, rows[1] - 0.25), W(x, h + 0.08, rows[0] + 0.3), 0.05, C.pole)); members++; }
  for (let h = 0; h + 8 <= hTop; h += 8) { parts.push(rod(W(x0, h, rows[1] - 0.1), W(x0 + 4 * dx, h + 8, rows[1] - 0.1), 0.05, C.poleOld)); parts.push(rod(W(x0 + 11.6, h + 4, rows[1] - 0.1), W(x0 + 5 * dx, h + 8, rows[1] - 0.1), 0.05, C.poleOld)); members += 2; }
  // plank decks: the façade's foot, the median register's foot, the upper register's foot, under the crown (C)
  const decks = [15, 21.9, 29.5, I.top - 2.4];
  for (const h of decks) { const a = W(I.cut, h + 0.13, (rows[0] + rows[1]) / 2); parts.push(box(a.x, a.y, a.z, 5.9, 0.035, 1.05, C.plank)); members++;
    for (let k = 0; k < 6; k++) { const b = W(x0 + 0.6 + k * 2.1, h + 0.17, rows[0] - 0.15 - hash(k, h) * 1.2); parts.push(cyl(b.x, b.y, b.z, 0.18, 0.28, C.basket, 8, 0.22)); } } // the cutters' baskets of chips and tools on each deck
  // ladders between the decks, at the scaffold's W end (two rails, rungs every 0.35 m)
  for (let i = 0; i + 1 < decks.length + 1; i++) { const h0 = i === 0 ? 0 : decks[i - 1], h1 = decks[i] ?? hTop, xl = x0 + 0.5, d = rows[1] - 0.45;
    for (const s of [-0.22, 0.22]) parts.push(rod(W(xl + s, h0, d - 0.35), W(xl + s, h1 + 0.9, d), 0.035, C.plank));
    for (let h = h0 + 0.35; h < h1; h += 0.35) { const t = (h - h0) / (h1 + 0.9 - h0); parts.push(rod(W(xl - 0.22, h, d - 0.35 * (1 - t)), W(xl + 0.22, h, d - 0.35 * (1 - t)), 0.022, C.plank, 4)); } }
  info.scaffoldMembers = members;
  // its colliders: the standards and the ladders' foot (the lower deck as a box is not climbed: the ladders are not walkable)
  for (let k = 0; k < nx; k++) for (const d of rows) { const p = W(x0 + k * dx, 1.5, d); boxes.push({ c: p, h: new THREE.Vector3(0.09, 1.6, 0.09), rot: 0 }); }

  // ---- the spoil: fresh limestone chips thrown down from the works (a low talus, lumpy, paler than the weathered ground)
  { const c = W(I.cut + 1.5, 0, rows[1] - 5.5), R = 9.5, Hh = 2.2, nr = 10, ns = 28, pos: number[] = [], col: number[] = [], idx: number[] = [];
    for (let i = 0; i <= nr; i++) for (let j = 0; j < ns; j++) { const r = (i / nr) * R * (1 + 0.15 * Math.sin(j * 1.7 + 0.4) + 0.1 * Math.sin(j * 3.1)), a = (j / ns) * Math.PI * 2;
      const x = c.x + Math.cos(a) * r * 1.25, z = c.z + Math.sin(a) * r * 0.8, t = i / nr, prof = Hh * (1 - t * t) * (0.85 + 0.3 * hash(i, j)) + (i === nr ? -0.25 : 0);
      pos.push(x, Math.max(I.terrain.heightAt(x, z) - 0.25, I.terrain.heightAt(x, z) + prof - 0.05), z); const cc = t > 0.75 ? C.chipsDust : C.chips; const k = 0.92 + 0.12 * hash(j, i); col.push(cc[0] * k, cc[1] * k, cc[2] * k); }
    for (let i = 0; i < nr; i++) for (let j = 0; j < ns; j++) { const a = i * ns + j, b = i * ns + (j + 1) % ns, d = a + ns, e = b + ns; idx.push(a, d, b, b, d, e); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    spoil = g.toNonIndexed(); parts.push(spoil); info.spoilTris = idx.length / 3;
    // spalls and rejected blocks round its edge
    for (let k = 0; k < 14; k++) { const a = hash(k, 21) * Math.PI * 2, r = R * (0.95 + 0.4 * hash(k, 22)), x = c.x + Math.cos(a) * r * 1.25, z = c.z + Math.sin(a) * r * 0.8, s = 0.25 + 0.55 * hash(k, 23);
      if (z < W(0, 0, rows[1] - 0.3).z) parts.push(box(x, H(x, -z) + s * 0.4, z, s * 0.9, s * 0.45, s * 0.7, k % 3 ? C.block : C.chips, hash(k, 24) * 3)); } }

  // ---- the cutters' lean-to at the foot, E of the spoil
  { const c = W(I.cut + 13, 0, rows[1] - 6), y = H(c.x, -c.z), rot = 0, hw = 3, hd = 2;
    for (const [sx, sz, hh] of [[-1, -1, 2.1], [1, -1, 2.1], [-1, 1, 2.6], [1, 1, 2.6]] as const) parts.push(rod(new THREE.Vector3(c.x + sx * hw, y - 0.3, c.z + sz * hd), new THREE.Vector3(c.x + sx * hw, y + hh, c.z + sz * hd), 0.07, C.pole));
    const roof = clean(new THREE.BoxGeometry(hw * 2 + 0.6, 0.06, hd * 2 + 0.6)); roof.rotateX(-Math.atan2(0.5, hd * 2)); roof.translate(c.x, y + 2.4, c.z); parts.push(paint(roof, C.mat));
    parts.push(box(c.x - 1.2, y + 0.22, c.z + 1.3, 1.1, 0.22, 0.25, C.plank)); // the bench
    parts.push(box(c.x + 1.3, y + 0.2, c.z + 0.9, 0.3, 0.2, 0.2, C.block)); // the whetstone block
    parts.push(cyl(c.x + 2.1, y, c.z - 0.6, 0.28, 0.75, C.clay, 10, 0.2)); // the water jar
    for (let k = 0; k < 4; k++) parts.push(cyl(c.x - 2 + k * 0.6, y, c.z + 0.2 + hash(k, 31) * 0.8, 0.22, 0.3, C.basket, 8, 0.27)); // tool baskets (chisels, picks, mallets)
    for (let k = 0; k < 5; k++) parts.push(rod(new THREE.Vector3(c.x + 2.6, y, c.z + 1.6 - k * 0.15), new THREE.Vector3(c.x + 2.75, y + 3.2, c.z + 1.75 - k * 0.15), 0.06, C.poleOld)); // spare poles leaning
    boxes.push({ c: new THREE.Vector3(c.x - 1.2, y + 0.22, c.z + 1.3), h: new THREE.Vector3(1.1, 0.22, 0.25), rot: 0 }); info.shed = 1; void rot; }

  // ---- the keepers' house: a whitewashed courtyard house, 16 x 12 m, two rooms on the N side, the gate in the S wall (C)
  { const [he, hn] = I.house, g0 = H(he, hn), WX = 8, WY = 6, T = 0.3, yardH = 2.4, roomD = 4.6, roomH = 3.0, y0 = g0 - 0.4;
    const wall = (e0: number, n0: number, e1: number, n1: number, top: number, c: RGB = C.wash) => { const ce = (e0 + e1) / 2, cn = (n0 + n1) / 2, hx = Math.abs(e1 - e0) / 2 + 1e-3, hz = Math.abs(n1 - n0) / 2 + 1e-3, cy = (y0 + top) / 2, hy = (top - y0) / 2;
      solid(box(ce, cy, -cn, hx, hy, hz, c), new THREE.Vector3(ce, cy, -cn), new THREE.Vector3(hx, hy, hz)); };
    const top = g0 + yardH, rt = g0 + roomH, nR = hn + WY - roomD;
    // yard walls (S wall split at the gate, 1.4 m), with a red-ochre dado band along the gate (C)
    wall(he - WX, hn - WY - T, he - 0.7, hn - WY + T, top); wall(he + 0.7, hn - WY - T, he + WX, hn - WY + T, top);
    wall(he - WX - T, hn - WY, he - WX + T, nR, top); wall(he + WX - T, hn - WY, he + WX + T, nR, top);
    // the rooms' block: the outer N, W and E walls, the partition, the S face with two doorways (1 m), the roof slab
    wall(he - WX - T, hn + WY - T, he + WX + T, hn + WY + T, rt + 0.4); wall(he - WX - T, nR, he - WX + T, hn + WY, rt + 0.4); wall(he + WX - T, nR, he + WX + T, hn + WY, rt + 0.4);
    wall(he - T / 2, nR, he + T / 2, hn + WY, rt);
    const doors = [he - WX / 2, he + WX / 2];
    let e = he - WX; for (const dc of doors) { wall(e, nR - T, dc - 0.5, nR + T, rt); e = dc + 0.5; } wall(e, nR - T, he + WX, nR + T, rt);
    for (const dc of doors) { parts.push(box(dc, g0 + 2.0 + (rt - g0 - 2.0) / 2, -nR, 0.5, (rt - g0 - 2.0) / 2, T, C.wash)); parts.push(box(dc, g0 + 2.02, -nR, 0.62, 0.05, T + 0.04, C.pole)); } // over the doorways: the lintel poles
    parts.push(box(he, rt + 0.15, -(nR + hn + WY) / 2, WX + T, 0.15, (hn + WY - nR) / 2 + T, C.roof)); // the flat roof (packed earth)
    parts.push(box(he, rt + 0.42, -(hn + WY), WX + T, 0.12, T, C.wash)); // the parapet's N edge
    parts.push(box(he, g0 + 0.02, -(nR + hn + WY) / 2, WX - T, 0.03, (hn + WY - nR) / 2 - T, C.dark)); // the rooms' floors in their dark
    for (const dc of doors) parts.push(box(dc, g0 + 1.0, -(nR + 0.2), 0.48, 1.0, 0.04, C.dark)); // the doorways' dark (the rooms behind, unlit)
    for (const s of [-1, 1]) parts.push(box(he + s * 1.0, g0 + 0.25, -(hn - WY), 0.3, 0.25, T + 0.02, C.ochre)); // the gate's ochre dado
    // the yard: the tannur, the sheep pen (low wall), a bench, jars, a wool fleece on the roof's edge
    parts.push(cyl(he + WX - 1.4, g0, -(hn - WY + 1.4), 0.45, 0.9, C.clay, 12, 0.32));
    for (const [a, b, c2, d] of [[he - WX + 0.3, hn - WY + 0.3, he - WX + 4.5, hn - WY + 0.5], [he - WX + 4.3, hn - WY + 0.3, he - WX + 4.5, hn - WY + 4]] as const) wall(a, b, c2, d, g0 + 1.1, C.mud);
    parts.push(box(he + 2.5, g0 + 0.22, -(nR - 0.6), 1.4, 0.22, 0.3, C.mud));
    for (let k = 0; k < 3; k++) parts.push(cyl(he + WX - 0.6, g0, -(nR - 1.2 - k * 0.7), 0.25, 0.7, C.clay, 10, 0.18));
    parts.push(box(he - 3, rt + 0.33, -(hn + WY - 0.4), 0.7, 0.02, 0.5, C.wool));
    info.keepersHouse = 1; }

  // ---- s18 C15 (D-800): the keepers' working ground (C): a sheepfold of mud walls with a reed-roofed shelter E of the house (the
  // tomb's sheep, D-640: their flock is the people's), a well with its stone kerb and a trough, a kitchen garden of beds by the
  // well, a stack of brushwood and dung cakes; and the paths the keepers, the cutters and the visitors tread (draped strips of
  // bare earth): from the house W along the foot to the offering table and on to the Ka'ba, from the house to the works
  { const [he, hn] = I.house, g = (e: number, n: number) => H(e, n);
    // the fold: 12 x 9 m, walls 1.3 m, the gate W; the shelter along its N wall
    const fe = he + 17, fn = hn - 1, w2 = (e0: number, n0: number, e1: number, n1: number, h: number, c: RGB) => { const ce = (e0 + e1) / 2, cn = (n0 + n1) / 2, y0 = g(ce, cn) - 0.3, hx = Math.abs(e1 - e0) / 2 + 0.15, hz = Math.abs(n1 - n0) / 2 + 0.15;
      solid(box(ce, y0 + (h + 0.3) / 2, -cn, hx, (h + 0.3) / 2, hz, c), new THREE.Vector3(ce, y0 + (h + 0.3) / 2, -cn), new THREE.Vector3(hx, (h + 0.3) / 2, hz)); };
    w2(fe - 6, fn - 4.5, fe + 6, fn - 4.5, 1.3, C.mud); w2(fe - 6, fn + 4.5, fe + 6, fn + 4.5, 1.3, C.mud); w2(fe + 6, fn - 4.5, fe + 6, fn + 4.5, 1.3, C.mud);
    w2(fe - 6, fn - 4.5, fe - 6, fn - 1, 1.3, C.mud); w2(fe - 6, fn + 1, fe - 6, fn + 4.5, 1.3, C.mud);
    { const y = g(fe, fn + 3.4); parts.push(box(fe, y + 1.9, -(fn + 3.4), 5.8, 0.05, 1.1, C.mat)); for (const x of [-5.5, 0, 5.5]) parts.push(rod(new THREE.Vector3(fe + x, y - 0.2, -(fn + 2.3)), new THREE.Vector3(fe + x, y + 1.85, -(fn + 2.3)), 0.06, C.pole)); }
    parts.push(box(fe, g(fe, fn) + 0.02, -fn, 5.8, 0.025, 4.3, C.dung)); // the trodden, dunged floor
    // the well and its trough, the garden beds W of the house's S wall
    const we = he - 12, wn = hn - 9, wy = g(we, wn);
    solid(cyl(we, wy - 0.2, -wn, 0.85, 0.75, C.block, 12, 0.8), new THREE.Vector3(we, wy + 0.2, -wn), new THREE.Vector3(0.85, 0.4, 0.85)); parts.push(cyl(we, wy + 0.5, -wn, 0.55, 0.02, C.dark, 10, 0.55));
    parts.push(rod(new THREE.Vector3(we - 0.9, wy, -wn), new THREE.Vector3(we - 0.9, wy + 2.1, -wn), 0.06, C.pole)); parts.push(rod(new THREE.Vector3(we + 0.9, wy, -wn), new THREE.Vector3(we + 0.9, wy + 2.1, -wn), 0.06, C.pole)); parts.push(rod(new THREE.Vector3(we - 1.0, wy + 2.05, -wn), new THREE.Vector3(we + 1.0, wy + 2.05, -wn), 0.05, C.pole));
    parts.push(box(we + 2.2, wy + 0.25, -wn, 1.0, 0.25, 0.35, C.block)); parts.push(box(we + 2.2, wy + 0.47, -wn, 0.85, 0.02, 0.22, C.dark)); // the water in it
    for (let k = 0; k < 6; k++) { const be = he - 19 + k * 1.6, bn = hn - 14, by = g(be, bn); parts.push(box(be, by + 0.05, -bn, 0.6, 0.06, 3.2, C.tilled)); for (let r = 0; r < 5; r++) parts.push(box(be, by + 0.14, -(bn - 2.6 + r * 1.3), 0.35, 0.09, 0.3, k % 2 ? C.green : C.green2)); }
    // the fuel stack by the house's E wall
    { const e = he + 9.2, n = hn - 2, y = g(e, n); parts.push(box(e, y + 0.6, -n, 0.7, 0.6, 1.6, C.poleOld)); for (let k = 0; k < 8; k++) parts.push(cyl(e - 0.9, y + k * 0.09, -(n - 1.2 + (k % 4) * 0.7), 0.17, 0.08, C.dung, 8)); }
    // the trodden paths (2 m strips draped on the ground, 3 cm over it)
    const strip = (pts: [number, number][], w: number) => { const pos: number[] = [], col: number[] = [];
      for (let i = 0; i + 1 < pts.length; i++) { const [a, b] = [pts[i], pts[i + 1]], L2 = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L2 / 3)), nx = -(b[1] - a[1]) / L2 * w / 2, ny = (b[0] - a[0]) / L2 * w / 2;
        for (let k = 0; k < n; k++) { const P = (t: number, sd: number) => { const e = a[0] + (b[0] - a[0]) * t + nx * sd, nn = a[1] + (b[1] - a[1]) * t + ny * sd; return [e, g(e, nn) + 0.03, -nn]; };
          const q = [P(k / n, -1), P(k / n, 1), P((k + 1) / n, 1), P((k + 1) / n, -1)]; for (const v of [q[0], q[1], q[2], q[0], q[2], q[3]]) { pos.push(...v); col.push(...C.path); } } }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); gg.computeVertexNormals(); parts.push(gg); };
    const tbl = W(I.darius, 0, -14.2), tE = tbl.x, tN = -tbl.z, cutE = I.cut + 13, cutN = -W(I.cut, 0, rows[1] - 6).z;
    strip([[he - 1, hn - 7], [he - 30, hn - 2], [tE + 2, tN - 1.5], [tE - 1, tN - 1.6]], 1.8);
    if (I.kaba) strip([[tE - 1, tN - 2], [(tE + I.kaba[0]) / 2 + 4, (tN + I.kaba[1]) / 2], [I.kaba[0] + 1, I.kaba[1] + 12]], 1.6);
    strip([[he - 1, hn - 7], [cutE + 3, cutN - 3]], 1.4); strip([[he + 1, hn - 7], [he + 2, hn - 40]], 2.2); // to the works; S toward the road
    info.keepersGround = 1; }

  // ---- the offering table before Darius' tomb (the keepers' daily offering, D-640; C)
  { const p = W(I.darius, 0, -15.5), y = H(p.x, -p.z);
    solid(box(p.x, y + 0.42, p.z, 0.75, 0.42, 0.42, C.stone), new THREE.Vector3(p.x, y + 0.42, p.z), new THREE.Vector3(0.75, 0.42, 0.42));
    parts.push(box(p.x, y + 0.86, p.z, 0.82, 0.03, 0.48, C.stone)); // the top slab
    for (const [ox, c] of [[-0.45, C.flour], [-0.1, C.wine], [0.25, C.clay]] as const) { parts.push(cyl(p.x + ox, y + 0.89, p.z, 0.13, 0.06, C.clay, 12, 0.16)); parts.push(cyl(p.x + ox, y + 0.9, p.z, 0.11, 0.045, c, 12, 0.13)); } // bowls: flour, wine, water
    parts.push(cyl(p.x + 0.95, y, p.z + 0.1, 0.2, 0.62, C.clay, 10, 0.12)); // the wine jar beside the table
    parts.push(box(p.x + 0.55, y + 0.9, p.z - 0.1, 0.16, 0.02, 0.035, C.barsom, 0.2)); // the barsom bundle laid on the table
    for (let k = 0; k < 9; k++) parts.push(box(p.x - 0.6 + k * 0.15, y + 0.9, p.z + 0.25 + hash(k, 41) * 0.08, 0.035, 0.03, 0.035, k % 2 ? C.flower : C.flower2)); // flowers along the front edge
    parts.push(box(p.x, y + 0.012, p.z - 1.4, 0.9, 0.012, 0.6, C.mat)); info.offering = 1; }

  // ---- s18 C15 (D-800; the lead's add, holes.md P2-9; Q-085, D-771): the living city's dead in the rock, drawn in this mesh (the
  // plain's draw budget): the Akhor Rostam burial niches on the nearest steep rock to the map point (Q-085: ~3 km), and the
  // private rock tombs (Herzfeld; positions not retrieved: placed on the steepest rock of Kuh-e Rahmat's W foot, 0.4-1.6 km E of
  // the Terrace, C). Each stands on its measured slope as a dressed face (a block whose front is vertical, its back in the
  // slope), plastered white round the openings (C); the niches small and in rows (ossuary niches), some closed by plastered
  // slabs; the tombs a doorway closed by a large slab (the source's 'closed by large slabs', B), a lamp and a bowl of offerings
  // before a few (C)
  if (I.burials !== false) { const T = I.terrain, hz = (e: number, n: number) => T.heightAt(e, -n);
    const slope = (e: number, n: number) => { const dx = (hz(e + 6, n) - hz(e - 6, n)) / 12, dy = (hz(e, n + 6) - hz(e, n - 6)) / 12; return { s: Math.hypot(dx, dy), dx, dy }; };
    const find = (cx: number, cy: number, R: number, step: number, sMin: number, ok: (e: number, n: number) => boolean) => { const out: { e: number; n: number; s: number; d: number }[] = [];
      for (let y = cy - R; y <= cy + R; y += step) for (let x = cx - R; x <= cx + R; x += step) { const d = Math.hypot(x - cx, y - cy); if (d > R || !ok(x, y)) continue; const q = slope(x, y); if (q.s >= sMin) out.push({ e: x, n: y, s: q.s, d }); }
      return out; };
    const spaced = (c: { e: number; n: number; s: number; d: number }[], k: number, gap: number) => { const pick: typeof c = []; for (const q of c) { if (pick.length >= k) break; if (pick.every(p => Math.hypot(p.e - q.e, p.n - q.n) >= gap)) pick.push(q); } return pick; };
    /** a dressed face of w x h on the slope at (e, n), facing downhill; `cut` draws the openings on its front (local x across, y up) */
    const face = (e: number, n: number, w: number, h: number, cut: (P: (x: number, y: number, z: number) => THREE.Vector3, rot: number) => void) => {
      const q = slope(e, n), ox = -q.dx / (q.s || 1), oy = -q.dy / (q.s || 1), rot = Math.atan2(ox, oy); // the downhill direction (grid)
      const g0 = hz(e + ox * 0.6, n + oy * 0.6), depth = Math.min(4, h / Math.max(0.3, q.s) + 0.6), ce = e - ox * (depth / 2 - 0.6), cn = n - oy * (depth / 2 - 0.6);
      solid(box(ce, g0 - 0.4 + (h + 0.4) / 2, -cn, w / 2, (h + 0.4) / 2, depth / 2, C.block, rot), new THREE.Vector3(ce, g0 - 0.4 + (h + 0.4) / 2, -cn), new THREE.Vector3(w / 2, (h + 0.4) / 2, depth / 2), rot);
      const P = (x: number, y: number, z: number) => new THREE.Vector3(e + ox * (0.6 + z) + oy * x, g0 + y, -(n + oy * (0.6 + z) - ox * x)); cut(P, rot); };
    const plate = (P: (x: number, y: number, z: number) => THREE.Vector3, rot: number, x: number, y: number, w: number, h: number, z: number, c: RGB, t = 0.02) => { const p = P(x, y + h / 2, z + t / 2); parts.push(box(p.x, p.y, p.z, w / 2, h / 2, t / 2, c, rot)); };
    // Akhor Rostam: the nearest steep rock to the map point (2889, -9151), its niche groups along it
    { const cand = find(2889, -9151, 4500, 40, 0.75, () => true).sort((a, b) => a.d - b.d); let n0 = 0, n1 = 0;
      const P0 = cand[0]; if (P0) { const near = find(P0.e, P0.n, 120, 8, 0.7, () => true).sort((a, b) => Math.hypot(a.e - P0.e, a.n - P0.n) - Math.hypot(b.e - P0.e, b.n - P0.n));
        for (const [gi, g] of spaced(near, 6, 9).entries()) face(g.e, g.n, 4.2, 2.6, (P, rot) => { plate(P, rot, 0, 0.35, 4.0, 2.1, 0, C.wash, 0.015); // the plastered field
          for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { const x = -1.5 + k * 1.0, y = 0.6 + r * 0.95, shut = hash(gi * 8 + r * 4 + k, 51) < 0.45;
            plate(P, rot, x, y, 0.62, 0.52, 0.016, C.ochre, 0.01); plate(P, rot, x, y + 0.04, 0.5, 0.42, 0.027, shut ? C.wash : C.dark, 0.01); n0++; } });
        // the visitors' offering before the first group: a lamp and a bowl (C)
        { const q = slope(P0.e, P0.n), ox = -q.dx / (q.s || 1), oy = -q.dy / (q.s || 1), e = P0.e + ox * 2.2, n = P0.n + oy * 2.2, y = hz(e, n); parts.push(cyl(e, y, -n, 0.12, 0.05, C.clay, 10, 0.15)); parts.push(cyl(e + 0.35, y, -n, 0.07, 0.04, C.clay, 8, 0.09)); n1++; }
        info.akhorNiches = n0; info.akhorAt = Math.round(P0.d); I.places?.push({ id: 'akhor_rostam_niches', e: P0.e, n: P0.n }); } }
    // the private rock tombs on Kuh-e Rahmat's W foot (E of the Terrace: e 400-1600, n -900-900; clear of the Terrace's ground)
    { const cand = find(1000, 0, 1000, 25, 0.85, (e, n) => e > 420 && Math.abs(n) < 950).sort((a, b) => b.s - a.s || a.d - b.d); let nt = 0;
      for (const [k, g] of spaced(cand, 7, 70).entries()) face(g.e, g.n, 2.6, 2.4, (P, rot) => { plate(P, rot, 0, 0.2, 2.4, 2.0, 0, C.wash, 0.015);
        plate(P, rot, 0, 0.45, 0.95, 1.25, 0.016, C.ochre, 0.01); plate(P, rot, 0, 0.5, 0.8, 1.12, 0.026, C.dark, 0.01); // the doorway, an ochre frame
        plate(P, rot, 0.06, 0.45, 0.98, 1.2, 0.06, C.block, 0.14); // the closing slab, set before the doorway
        if (k % 3 === 0) { const p = P(-0.7, 0, 0.7); parts.push(cyl(p.x, p.y, p.z, 0.07, 0.04, C.clay, 8, 0.09)); const b = P(0.7, 0, 0.75); parts.push(cyl(b.x, b.y, b.z, 0.12, 0.05, C.clay, 10, 0.15)); }
        nt++; I.places?.push({ id: `private_rock_tomb_${k + 1}`, e: g.e, n: g.n }); });
      info.privateTombs = nt; } }

  if (I.extra) { parts.push(...I.extra.parts); boxes.push(...I.extra.boxes); }
  const geo = mergeGeometries(parts.map(g => { if (!g.getAttribute('normal')) g.computeVertexNormals(); return g; }))!;
  const mat = surfaceMaterial('nr_works', { vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'nr-life'; mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData = { tier: 'C', src: 'RECON;D-640;D-033', placeholder: false, note: 'Naqsh-e Rustam in use in 467 (s18 C15, D-800): the scaffold of lashed poles before the second tomb being cut, its spoil of fresh chips and the cutters\' lean-to; the keepers\' whitewashed courtyard house (D-640); the offering table before Darius\' tomb with bowls of flour, wine and water, the barsom and flowers (Arrian 6.29 by analogy); the keepers\' ground and paths; the rock burials (Akhor Rostam, the private rock tombs); and the roadside of the plain (wells, halts with their carts, field shrines, dung on the roads: wayside.ts, D-801). All C' };
  info.tris = geo.getAttribute('position').count / 3;
  const sp = spoil as Geo | null;
  return { mesh, info, colliders(phys: Physics) {
    for (const b of boxes) phys.addBox(b.c, b.h, b.rot);
    if (!sp) return; const p = sp.getAttribute('position') as THREE.BufferAttribute, idx = new Uint32Array(p.count); for (let i = 0; i < p.count; i++) idx[i] = i;
    phys.addTrimesh(new Float32Array(p.array as ArrayLike<number>), idx, { tier: 'C', what: 'naqsh-e-rustam spoil' });
  } };
}
/** the drawing helpers and colours, for the roadside (wayside.ts) drawn into this mesh */
export { box, rod, cyl, hash, C as LIFE_C, L as linRGB };
