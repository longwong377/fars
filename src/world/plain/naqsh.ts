// Naqsh-e Rustam in 467 BCE (Phase 7): the cliff with the tomb of Darius I (sealed, inscribed) and the tomb attributed to
// Xerxes (façade cut, uninscribed: D-033), the Ka'ba-ye Zardosht (date disputed, C) and the Neo-Elamite relief (intact;
// the Sasanian overcarving does not exist yet). The Artaxerxes I and Darius II tombs, the Sasanian reliefs and the later
// "fire altars" are absent (chronology, blocklist). Every dimension is plain.json `naqsh_e_rustam` (tiers there): façade
// 22.93 m, foot 15 m above the ancient ground, median register 14 x 7.60 m, upper arm 8.50 m (B, search extracts); arm
// width, recess, column and door sizes and the figures' drawing are reconstruction (C). The relief figures are schematic
// silhouettes (PLACEHOLDER carving, flagged in the dev overlay); the DNa/DNb panels are dressed but not inscribed
// (PLACEHOLDER: the published text is not in inscriptions.json).
//
// Frame: the cliff face is the line grid y = cliff.face_y (world z = -face_y), along grid x; "depth" d > 0 goes into the
// rock (grid north). The ground at the face is the ancient foot level exported by tools/build_terrain.py (the heightfield
// there is carved to it; LANDSCAPE.md).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Terrain } from '../../terrain/heightfield';
import { curvatureDrop } from '../../terrain/heightfield';
import { SURFACES, surfaceMaterial } from '../../render/materials';
import { PLAIN, feature, tag } from './data';
import type { Physics } from '../../player/physics';

SURFACES.nr_rock = { albedo: [0.5, 0.47, 0.42], roughness: 0.9, porosity: 0.3, noiseScale: 0.35, noiseAmp: 0.16, bump: { amp: 0.05, freq: 0.6 }, tier: 'C', note: 'Naqsh-e Rustam cliff: grey limestone, weathered (albedo C)' };
SURFACES.nr_dressed = { albedo: [0.55, 0.52, 0.47], roughness: 0.75, porosity: 0.3, noiseScale: 1.1, noiseAmp: 0.07, bump: { amp: 0.002, freq: 4 }, tier: 'C', note: 'dressed limestone of the rock-cut façades (albedo C)' };
SURFACES.kaba_white = { albedo: [0.7, 0.68, 0.62], roughness: 0.6, porosity: 0.3, noiseScale: 1.2, noiseAmp: 0.06, joints: { course: 0.95, block: 1.9, width: 0.001, dark: 0.5 }, bump: { amp: 0.0015, freq: 5 }, tier: 'B/C', note: "Ka'ba-ye Zardosht: white limestone with dovetail-clamped blocks (B, search extract); tone C" };

const NR = () => PLAIN.naqsh_e_rustam;
interface Face { fy: number; groundAsl: number; court: number }
const toWorld = (f: Face, x: number, h: number, d: number) => new THREE.Vector3(x, f.groundAsl - f.court - curvatureDrop(x, -f.fy) + h, -f.fy - d);

// ---------------------------------------------------------------- relief figures (schematic silhouettes, C)
type FigureKind = 'bearer' | 'king' | 'guard' | 'winged' | 'standing';
/** a standing figure's outline, height 1, facing +x; arms by kind */
function figureShape(kind: FigureKind): THREE.Shape {
  const s = new THREE.Shape();
  if (kind === 'winged') { // winged disc with a small figure rising from it (C)
    s.moveTo(-1.5, 0.35); s.lineTo(-0.9, 0.55); s.lineTo(-0.35, 0.5); s.lineTo(-0.25, 0.62); s.lineTo(-0.12, 0.9); s.absarc(0, 0.95, 0.1, Math.PI, 0, true);
    s.lineTo(0.12, 0.9); s.lineTo(0.25, 0.62); s.lineTo(0.35, 0.5); s.lineTo(0.9, 0.55); s.lineTo(1.5, 0.35); s.lineTo(0.9, 0.3); s.lineTo(0.4, 0.28); s.lineTo(0.25, 0.1); s.lineTo(-0.25, 0.1); s.lineTo(-0.4, 0.28); s.lineTo(-0.9, 0.3); s.lineTo(-1.5, 0.35);
    return s;
  }
  // robe from feet to shoulders, head, headgear
  s.moveTo(-0.14, 0); s.lineTo(0.16, 0); s.lineTo(0.12, 0.45); s.lineTo(0.11, 0.78);
  if (kind === 'bearer') { s.lineTo(0.15, 0.8); s.lineTo(0.2, 1.0); s.lineTo(0.14, 1.0); s.lineTo(0.08, 0.84); } // both hands up to the dais
  else if (kind === 'king') { s.lineTo(0.3, 0.72); s.lineTo(0.33, 0.76); s.lineTo(0.12, 0.84); } // right hand raised toward the altar
  else if (kind === 'guard') { s.lineTo(0.2, 0.62); s.lineTo(0.22, 0.66); s.lineTo(0.2, 0.66); s.lineTo(0.2, 1.05); s.lineTo(0.23, 1.05); s.lineTo(0.23, 0.0); s.lineTo(0.26, 0.0); s.lineTo(0.26, 1.08); s.lineTo(0.17, 1.08); s.lineTo(0.17, 0.7); s.lineTo(0.11, 0.8); } // with spear
  s.lineTo(0.07, 0.86); s.absarc(0.0, 0.9, 0.07, -0.2, Math.PI + 0.2, false); s.lineTo(-0.08, 0.84);
  if (kind === 'king') { s.lineTo(-0.2, 0.84); s.lineTo(-0.24, 0.78); s.lineTo(-0.18, 0.4); s.lineTo(-0.28, 0.1); s.lineTo(-0.25, 0.08); s.lineTo(-0.16, 0.36); } // bow in the left hand
  if (kind === 'bearer') { s.lineTo(-0.1, 0.84); s.lineTo(-0.13, 1.0); s.lineTo(-0.19, 1.0); s.lineTo(-0.14, 0.8); }
  s.lineTo(-0.12, 0.78); s.lineTo(-0.15, 0.45); s.lineTo(-0.14, 0);
  return s;
}
const extrude = (shape: THREE.Shape, depth: number) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 5 }); g.deleteAttribute('uv'); return g.toNonIndexed(); };
/** place a local geometry (x along the face, y up, z out of the back wall) at face position (x0, h0) with its back at depth d0 */
function onFace(f: Face, g: THREE.BufferGeometry, x0: number, h0: number, d0: number, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const w = toWorld(f, x0 + p.getX(i) * sx, h0 + p.getY(i) * sy, d0 - p.getZ(i) * sz); p.setXYZ(i, w.x, w.y, w.z); }
  if (g.getAttribute('normal')) g.deleteAttribute('normal');
  g.computeVertexNormals(); return g;
}
const box = (w: number, h: number, d: number) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.deleteAttribute('uv'); g.translate(0, h / 2, d / 2); return g; }; // base at y 0, back at z 0

// ---------------------------------------------------------------- one tomb façade
function tombFacade(f: Face, cx: number, inscribed: boolean): { stone: THREE.BufferGeometry[]; figures: THREE.BufferGeometry[]; panels: THREE.BufferGeometry[] } {
  const F = NR().facade, stone: THREE.BufferGeometry[] = [], figures: THREE.BufferGeometry[] = [], panels: THREE.BufferGeometry[] = [];
  const h0 = F.foot_above_ground_m, hL = F.lower_arm_h_m, hM = F.median_register_h_m, hU = F.upper_arm_h_m, aw = F.arm_w_m / 2, mw = F.median_register_w_m / 2, R = F.recess_m;
  const hMid = h0 + hL, hTop = hMid + hM, hEnd = hTop + hU;
  // the dressed panel around the cross: a rectangle (matching the hole left in the cliff mesh) minus the cross
  const PW = 9, P0 = h0 - 2, P1 = hEnd + 2;
  const outer = new THREE.Shape(); outer.moveTo(-PW, P0); outer.lineTo(PW, P0); outer.lineTo(PW, P1); outer.lineTo(-PW, P1); outer.lineTo(-PW, P0);
  const cross: [number, number][] = [[-aw, h0], [aw, h0], [aw, hMid], [mw, hMid], [mw, hTop], [aw, hTop], [aw, hEnd], [-aw, hEnd], [-aw, hTop], [-mw, hTop], [-mw, hMid], [-aw, hMid]];
  outer.holes.push(new THREE.Path(cross.slice().reverse().map(([x, y]) => new THREE.Vector2(x, y))));
  const front = new THREE.ShapeGeometry(outer); front.deleteAttribute('uv');
  stone.push(onFace(f, front.toNonIndexed(), cx, 0, 0));
  // recess walls around the cross outline, and its back
  for (let i = 0; i < cross.length; i++) {
    const [ax, ay] = cross[i], [bx, by] = cross[(i + 1) % cross.length];
    const a0 = toWorld(f, cx + ax, ay, 0), b0 = toWorld(f, cx + bx, by, 0), a1 = toWorld(f, cx + ax, ay, R), b1 = toWorld(f, cx + bx, by, R);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([a0, b0, a1, b0, b1, a1].flatMap(v => [v.x, v.y, v.z]), 3)); g.computeVertexNormals();
    stone.push(g); // faces into the recess
  }
  const back = new THREE.Shape(cross.map(([x, y]) => new THREE.Vector2(x, y)));
  const bg = new THREE.ShapeGeometry(back); bg.deleteAttribute('uv');
  const bgn = bg.toNonIndexed(); const pp = bgn.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) { const w = toWorld(f, cx + pp.getX(i), pp.getY(i), R); pp.setXYZ(i, w.x, w.y, w.z); } bgn.computeVertexNormals(); stone.push(bgn);
  // --- median register: four engaged columns with double-bull capitals, entablature, the sealed doorway
  const colX = [-5.6, -2.1, 2.1, 5.6], ch = F.column_h_m, r = 0.38;
  for (const x of colX) {
    const shaft = new THREE.CylinderGeometry(r * 0.92, r, ch - 1.15, 12, 1, true, -Math.PI / 2, Math.PI).toNonIndexed(); shaft.deleteAttribute('uv'); shaft.rotateY(Math.PI); shaft.translate(0, (ch - 1.15) / 2 + 0.35, 0);
    stone.push(onFace(f, shaft, cx + x, hMid, R));
    stone.push(onFace(f, box(1.0, 0.35, 0.5), cx + x - 0.5, hMid, R)); // base
    // capital: impost block and two bull foreparts projecting to the sides (schematic, C)
    stone.push(onFace(f, box(1.1, 0.8, 0.55), cx + x - 0.55, hMid + ch - 0.8, R));
    for (const s of [-1, 1]) stone.push(onFace(f, box(0.55, 0.45, 0.62), cx + x + (s < 0 ? -1.05 : 0.5), hMid + ch - 0.62, R));
  }
  let y = hMid + ch;
  for (const [hh, dd] of [[0.28, 0.3], [0.3, 0.36], [0.32, 0.42]]) { stone.push(onFace(f, box(13.4, hh, dd), cx - 6.7, y, R)); y += hh; } // architrave, three fasciae
  for (let x = -6.6; x < 6.6; x += 0.34) stone.push(onFace(f, box(0.2, 0.3, 0.5), cx + x, y, R)); // dentils
  y += 0.3; stone.push(onFace(f, box(13.8, 0.45, 0.62), cx - 6.9, y, R)); // cornice
  const dw = F.door_w_m, dh = F.door_h_m;
  for (const s of [-1, 1]) stone.push(onFace(f, box(0.35, dh + 0.35, 0.25), cx + s * (dw / 2 + 0.175) - 0.175, hMid + 0.2, R)); // jambs
  stone.push(onFace(f, box(dw + 1.2, 0.5, 0.35), cx - dw / 2 - 0.6, hMid + 0.2 + dh + 0.35, R)); // lintel with a cornice band
  stone.push(onFace(f, box(dw, dh, 0.08), cx - dw / 2, hMid + 0.2, R + 0.05 - 0.08)); // the sealing slab, set back in the frame
  if (inscribed) { // DNb between the columns (left of the door): dressed panel, text not carved (PLACEHOLDER)
    panels.push(onFace(f, box(2.4, 2.8, 0.02), cx - 3.95 - 1.2 + 0.05, hMid + 1.2, R));
  }
  // --- upper register: two tiers of 14 throne-bearers under the dais, the king on a three-stepped podium before the fire altar,
  // the winged figure and the moon above; attendants in three tiers on the side panels (programme B, drawing C)
  const u0 = hTop, bearerH = 1.35, span = 8.6;
  stone.push(onFace(f, box(span + 0.4, 0.3, 0.3), cx - span / 2 - 0.2, u0 + 0.05, R)); // ground line
  for (let t = 0; t < F.throne_bearer_tiers; t++) {
    const base = u0 + 0.35 + t * (bearerH + 0.3);
    for (let i = 0; i < F.throne_bearers / F.throne_bearer_tiers; i++) figures.push(onFace(f, extrude(figureShape('bearer'), 0.1), cx - span / 2 + 0.3 + i * (span - 0.6) / 13, base, R, bearerH, bearerH, 1));
    stone.push(onFace(f, box(span, 0.28, 0.22), cx - span / 2, base + bearerH, R)); // the dais beams they lift
  }
  const top = u0 + 0.35 + 2 * (bearerH + 0.3);
  stone.push(onFace(f, box(span + 0.6, 0.35, 0.3), cx - span / 2 - 0.3, top, R));
  for (const [s, w] of [[0, 1.9], [1, 1.5], [2, 1.1]]) stone.push(onFace(f, box(w, 0.2, 0.18), cx - 2.5 - w / 2, top + 0.35 + s * 0.2, R)); // three-stepped podium
  figures.push(onFace(f, extrude(figureShape('king'), 0.12), cx - 2.5, top + 0.95, R, 2.3, 2.3, 1));
  stone.push(onFace(f, box(0.9, 0.35, 0.16), cx + 1.15, top + 0.35, R)); stone.push(onFace(f, box(0.5, 0.9, 0.14), cx + 1.35, top + 0.7, R)); stone.push(onFace(f, box(0.95, 0.3, 0.16), cx + 1.12, top + 1.6, R)); // fire altar
  const flame = new THREE.Shape(); flame.moveTo(-0.3, 0); flame.quadraticCurveTo(-0.25, 0.4, 0, 0.75); flame.quadraticCurveTo(0.25, 0.4, 0.3, 0); flame.lineTo(-0.3, 0);
  figures.push(onFace(f, extrude(flame, 0.08), cx + 1.6, top + 1.9, R));
  figures.push(onFace(f, extrude(figureShape('winged'), 0.1), cx - 0.2, top + 2.35, R, 1.25, 1.25, 1));
  const moon = new THREE.Shape(); moon.absarc(0, 0, 0.36, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0.12, 0.05, 0.3, 0, Math.PI * 2, true); moon.holes.push(hole);
  figures.push(onFace(f, extrude(moon, 0.08), cx + 3.6, top + 3.25, R));
  for (const s of [-1, 1]) for (let t = 0; t < 3; t++) figures.push(onFace(f, extrude(figureShape('guard'), 0.1), cx + s * 4.75 - 0.15, u0 + 0.35 + t * 2.6, R, 1.8, 1.8, 1));
  if (inscribed) panels.push(onFace(f, box(1.6, 2.2, 0.02), cx - 4.9 + 0.1, top + 0.9, R)); // DNa panel behind the king (PLACEHOLDER: not inscribed here)
  return { stone, figures, panels };
}

// ---------------------------------------------------------------- the cliff
function cliffGeometry(f: Face, holes: { x0: number; x1: number; h0: number; h1: number }[], xa: number, xb: number, H: number): THREE.BufferGeometry {
  const xs = new Set<number>(), hs = new Set<number>();
  for (let x = xa; x <= xb + 1e-6; x += 1.5) xs.add(+x.toFixed(3));
  for (let h = -1.5; h <= H + 1e-6; h += 1.5) hs.add(+h.toFixed(3));
  for (const q of holes) { xs.add(q.x0); xs.add(q.x1); hs.add(q.h0); hs.add(q.h1); }
  const X = [...xs].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 0.3), Hh = [...hs].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 0.3);
  const nx = X.length, nh = Hh.length;
  const vn = (x: number, h: number) => { const a = Math.sin(x * 0.21 + h * 0.07) + Math.sin(x * 0.05 - h * 0.13) * 1.4 + Math.sin(x * 0.63 + h * 0.41) * 0.35 + Math.sin(h * 0.9 + x * 0.17) * 0.2; return a; };
  const planar = (x: number, h: number) => { let m = 0; for (const q of holes) { const dx = Math.max(q.x0 - x, 0, x - q.x1), dh = Math.max(q.h0 - h, 0, h - q.h1); m = Math.max(m, 1 - Math.min(1, Math.hypot(dx, dh) / 5)); } return m; };
  const pos: number[] = [];
  const P = (i: number, j: number) => { const x = X[i], h = Hh[j]; const d = (vn(x, h) * 0.6 + h * 0.02) * (1 - planar(x, h)); return toWorld(f, x, h, d); };
  const grid: THREE.Vector3[] = []; for (let j = 0; j < nh; j++) for (let i = 0; i < nx; i++) grid.push(P(i, j));
  const idx: number[] = [];
  for (let j = 0; j < nh - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const xm = (X[i] + X[i + 1]) / 2, hm = (Hh[j] + Hh[j + 1]) / 2;
    if (holes.some(q => xm > q.x0 && xm < q.x1 && hm > q.h0 && hm < q.h1)) continue;
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, b, c, c, b, d); // faces +z (out of the rock)
  }
  for (const v of grid) pos.push(v.x, v.y, v.z);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** the cliff top: from the face's top edge back into the mountain until it meets the (uncarved) terrain */
function cliffTop(f: Face, terrain: Terrain, xa: number, xb: number, H: number): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = []; const back = [0, 4, 10, 18, 28, 40, 52];
  const X: number[] = []; for (let x = xa; x <= xb + 1e-6; x += 3) X.push(x);
  for (const x of X) for (const d of back) {
    const top = toWorld(f, x, H, d), tz = top.z, ty = terrain.heightAt(x, tz) + 0.15;
    const last = d === back[back.length - 1];
    pos.push(x, last ? ty : Math.max(top.y - d * 0.05, ty), tz);
  }
  const nb = back.length;
  for (let i = 0; i + 1 < X.length; i++) for (let k = 0; k + 1 < nb; k++) { const a = i * nb + k, b = a + 1, c = a + nb, d = c + 1; idx.push(a, b, c, c, b, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // make it face up
  const n = g.getAttribute('normal') as THREE.BufferAttribute; if (n.getY(0) < 0) { const ix = g.getIndex()!; for (let i = 0; i < ix.count; i += 3) { const t = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, t); } g.computeVertexNormals(); }
  return g;
}
/** vertical returns at both ends of the face, from the face back into the rock, so the carved ground behind is closed */
function endCaps(f: Face, xa: number, xb: number, H: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, s] of [[xa, -1], [xb, 1]] as [number, number][]) {
    const q = [toWorld(f, x, -1.5, 0), toWorld(f, x, H, 0), toWorld(f, x, -1.5, 40), toWorld(f, x, H, 40)];
    const tri = s > 0 ? [q[0], q[2], q[1], q[1], q[2], q[3]] : [q[0], q[1], q[2], q[2], q[1], q[3]];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri.flatMap(v => [v.x, v.y, v.z]), 3)); g.computeVertexNormals(); parts.push(g);
  }
  return mergeGeometries(parts)!;
}

// ---------------------------------------------------------------- Ka'ba-ye Zardosht
function kaba(f: Face, terrain: Terrain, court: number, ancAsl: number): { white: THREE.BufferGeometry; dark: THREE.BufferGeometry; boxes: { c: THREE.Vector3; h: THREE.Vector3 }[] } {
  const K = NR().kaba, [kx, ky] = feature('nr_kaba').xy as [number, number];
  const gy = Math.min(terrain.heightAt(kx, -ky), ancAsl - court - curvatureDrop(kx, -ky) + 3); // stands on the carved ancient ground
  const white: THREE.BufferGeometry[] = [], dark: THREE.BufferGeometry[] = [], boxes: { c: THREE.Vector3; h: THREE.Vector3 }[] = [];
  const add = (arr: THREE.BufferGeometry[], cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, collide = true) => {
    const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed(); g.deleteAttribute('uv'); g.translate(cx, cy, cz); arr.push(g);
    if (collide) boxes.push({ c: new THREE.Vector3(cx, cy, cz), h: new THREE.Vector3(sx / 2, sy / 2, sz / 2) }); };
  const X = kx, Z = -ky, step = (K.height_with_base_m - K.height_m) / K.base_steps, S = K.base_side_m;
  for (let i = 0; i < K.base_steps; i++) { const w = S + 2 * 0.5 * (K.base_steps - i); add(white, X, gy + step * i + step / 2 - (i === 0 ? 0.3 : 0), Z, w, step + (i === 0 ? 0.6 : 0), w); } // triple-stepped base (step inset 0.5 m: C)
  const base = gy + K.base_steps * step;
  add(white, X, base + K.height_m / 2 - 0.4, Z, S, K.height_m - 0.8, S); // the tower
  add(white, X, base + K.height_m - 0.25, Z, S + 0.5, 0.5, S + 0.5); // cornice and roof slabs
  for (let k = 0; k < 14; k++) for (const s of [-1, 1]) { const t = -S / 2 - 0.1 + (k + 0.5) * (S + 0.2) / 14; // dentils under the cornice on the four sides
    add(white, X + t, base + K.height_m - 0.62, Z + s * (S / 2 + 0.08), 0.22, 0.24, 0.16, false); add(white, X + s * (S / 2 + 0.08), base + K.height_m - 0.62, Z + t, 0.16, 0.24, 0.22, false); }
  // door on the side facing the cliff (grid north = world -z), sill reached by the 30-step stair (C: rise split evenly)
  const sill = gy + 8.1, riser = (sill - gy) / K.stair_steps, tread = 0.3, sw = 1.6;
  add(dark, X, sill + K.door_h_m / 2, Z - S / 2 - 0.01, K.door_w_m + 0.4, K.door_h_m + 0.4, 0.06, false); // the door and its dark frame
  for (let i = 0; i < K.stair_steps; i++) { const zc = Z - S / 2 - (K.stair_steps - i - 0.5) * tread, top = gy + riser * (i + 1); add(white, X, (gy - 0.3 + top) / 2, zc, sw, top - gy + 0.3, tread); }
  for (const s of [-1, 1]) add(white, X + s * (sw / 2 + 0.2), (gy + sill) / 2, Z - S / 2 - (K.stair_steps * tread) / 2, 0.4, sill - gy, K.stair_steps * tread); // stair side walls
  // dark stone blind windows (B: black-on-white stone), two rows on the other three faces (placement C)
  const win = (u: number, h: number, face: number) => { const ww = 0.8, wh = 1.6, o = S / 2 + 0.01;
    if (face === 0) add(dark, X + u, base + h, Z + o, ww, wh, 0.06, false); else add(dark, X + face * o, base + h, Z + u, 0.06, wh, ww, false); };
  for (const face of [0, -1, 1]) { win(-1.5, 3.4, face); win(1.5, 3.4, face); win(0, 7.6, face); }
  return { white: mergeGeometries(white.map(g => { g.computeVertexNormals(); return g; }))!, dark: mergeGeometries(dark)!, boxes };
}

// ---------------------------------------------------------------- build
export interface NaqshBuild { group: THREE.Group; colliders(phys: Physics): void; tris: number }
export function buildNaqsh(terrain: Terrain, ancientFootAsl: number): NaqshBuild {
  const cl = NR().cliff, fy = cl.face_y as number, [xa, xb] = cl.x_range as [number, number], H = cl.height_m as number;
  const f: Face = { fy, groundAsl: ancientFootAsl, court: terrain.meta.court_asl };
  const group = new THREE.Group(); group.name = 'naqsh-e-rustam';
  group.userData = tag(feature('nr_darius_tomb'), 'Naqsh-e Rustam in 467 BCE: cliff, tomb of Darius I (sealed), tomb attributed to Xerxes (façade cut, uninscribed, D-033), Ka\'ba-ye Zardosht, Neo-Elamite relief; geometry plain.json naqsh_e_rustam (tiers there)');
  const tombs = [{ id: 'nr_darius_tomb', x: feature('nr_darius_tomb').xy[0] as number, inscribed: true }, { id: 'nr_xerxes_tomb', x: feature('nr_xerxes_tomb').xy[0] as number, inscribed: false }];
  const F = NR().facade, h0 = F.foot_above_ground_m - 2, h1 = F.foot_above_ground_m + F.height_m + 2;
  const holes = tombs.map(t => ({ x0: t.x - 9, x1: t.x + 9, h0, h1 }));
  const rock = surfaceMaterial('nr_rock'), dressed = surfaceMaterial('nr_dressed');
  rock.side = THREE.DoubleSide; // the cliff's top and end returns are seen from both sides
  const cliff = new THREE.Mesh(mergeGeometries([cliffGeometry(f, holes, xa, xb, H), cliffTop(f, terrain, xa, xb, H), endCaps(f, xa, xb, H)].map(g => g.index ? g.toNonIndexed() : g))!, rock);
  cliff.name = 'nr-cliff'; cliff.castShadow = cliff.receiveShadow = true;
  cliff.userData = { tier: 'C', src: cl.src, note: `cliff ${H} m high (B, SX); face line and rock surface reconstructed (C)`, placeholder: false };
  group.add(cliff);
  let tris = cliff.geometry.getAttribute('position').count / 3;
  for (const t of tombs) {
    const fc = tombFacade(f, t.x, t.inscribed), ft = feature(t.id);
    const st = new THREE.Mesh(mergeGeometries(fc.stone.map(g => g.index ? g.toNonIndexed() : g))!, dressed); st.name = t.id; st.castShadow = st.receiveShadow = true;
    st.userData = tag(ft, `${ft.name}: façade 22.93 m, median register 14 x 7.60 m, upper arm 8.50 m (B, SX); arm width 10.9 m, recess, columns and door C${t.inscribed ? '' : '; uninscribed (D-033)'}`);
    const fig = new THREE.Mesh(mergeGeometries(fc.figures)!, dressed); fig.name = t.id + '-reliefs'; fig.castShadow = fig.receiveShadow = true;
    fig.userData = { tier: 'C', src: 'NR-ACHAEMENICA;WP-NR', note: 'upper register: 28 throne-bearers in two tiers, the king on a three-stepped podium before the fire altar, the winged figure and the moon (programme B); figures are schematic silhouettes (C)', placeholder: true };
    group.add(st, fig); tris += (st.geometry.getAttribute('position').count + fig.geometry.getAttribute('position').count) / 3;
    if (fc.panels.length) { const pm = new THREE.Mesh(mergeGeometries(fc.panels)!, dressed); pm.name = t.id + '-inscription-panels'; pm.userData = { tier: 'A', src: 'LIVIUS-NR', note: 'DNa/DNb inscription panels: dressed, text NOT carved (the published text is not in inscriptions.json)', placeholder: true }; group.add(pm); }
  }
  // Neo-Elamite relief: a panel at the nearest point of the face to its xy, schematic figures (PLACEHOLDER carving)
  const ER = NR().elamite_relief, ex = feature('nr_elamite_relief').xy[0] as number;
  const rel: THREE.BufferGeometry[] = [onFace(f, box(ER.w_m + 0.3, ER.h_m + 0.3, 0.05), ex - ER.w_m / 2 - 0.15, ER.base_above_ground_m - 0.15, 0.12)];
  for (let i = 0; i < 5; i++) rel.push(onFace(f, extrude(figureShape('standing'), 0.08), ex - ER.w_m / 2 + 0.8 + i * 1.35, ER.base_above_ground_m + 0.2, 0.07, 1.9, 1.9, 1));
  const relief = new THREE.Mesh(mergeGeometries(rel)!, dressed); relief.name = 'nr-elamite-relief'; relief.castShadow = relief.receiveShadow = true;
  relief.userData = { tier: 'B/C', src: ER.src, note: 'Neo-Elamite relief 7 x 2.5 m, intact in 467 (B); figures schematic (C)', placeholder: true };
  group.add(relief);
  // Ka'ba
  const kb = kaba(f, terrain, f.court, ancientFootAsl);
  const kw = new THREE.Mesh(kb.white, surfaceMaterial('kaba_white')), kd = new THREE.Mesh(kb.dark, surfaceMaterial('limestone_dark'));
  kw.name = 'nr-kaba'; kd.name = 'nr-kaba-dark'; kw.castShadow = kw.receiveShadow = kd.receiveShadow = true;
  kw.userData = kd.userData = tag(feature('nr_kaba'), `Ka'ba-ye Zardosht: 12 m tower on a triple-stepped base (14.12 m), base side 7.30 m, 30-step stair, door 1.7 x 0.87 m (C, WP-NR search extract); window layout and stair orientation C; date disputed (Q-006)`);
  group.add(kw, kd); tris += (kb.white.getAttribute('position').count + kb.dark.getAttribute('position').count) / 3;
  return { group, tris,
    colliders(phys: Physics) {
      const g = cliff.geometry, p = g.getAttribute('position') as THREE.BufferAttribute, idx = new Uint32Array(p.count); for (let i = 0; i < p.count; i++) idx[i] = i;
      phys.addTrimesh(new Float32Array(p.array as ArrayLike<number>), idx, { tier: 'C', what: 'naqsh-e-rustam cliff' });
      for (const b of kb.boxes) phys.addBox(b.c, b.h);
    } };
}
