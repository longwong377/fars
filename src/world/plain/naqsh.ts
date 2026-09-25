// Naqsh-e Rustam in 467 BCE (Phase 7): the cliff with the tomb of Darius I (sealed, inscribed) and the tomb attributed to
// Xerxes (façade cut, uninscribed: D-033), the Ka'ba-ye Zardosht (date disputed, C) and the Neo-Elamite relief (intact;
// the Sasanian overcarving does not exist yet). The Artaxerxes I and Darius II tombs, the Sasanian reliefs and the later
// "fire altars" are absent (chronology, blocklist). Every dimension is plain.json `naqsh_e_rustam` (tiers there): façade
// 22.93 m, foot 15 m above the ancient ground, median register 14 x 7.60 m, upper arm 8.50 m (B, search extracts); arm
// width, recess, column and door sizes and the figures' drawing are reconstruction (C). The tomb reliefs are carved by the
// relief system (D-069: bearers, the king with his bow, the fire altar, the winged figure, the moon, the side-panel guards;
// programme B, drawing C); the Neo-Elamite relief's figures stay schematic silhouettes (PLACEHOLDER). The DNa and DNb panels carry the Old Persian text of the
// standard edition (ARIo Q007152 / Q007153, Schmitt 2009, CC0; session 3), incised like the Terrace inscriptions with
// the published sign-by-sign edition and its lineation (ARIo in CATF, CC0; D-184: 60 lines each, research/OP_SIGNS.md);
// the editor's restorations carved (C), a stretch lost and not restored left as uncut blanks (nothing invented, no gap closed); the Elamite and Babylonian versions are not carved
// (not in the corpus read; Q-290).
//
// Frame: the cliff face is the line grid y = cliff.face_y (world z = -face_y), along grid x; "depth" d > 0 goes into the
// rock (grid north). The ground at the face is the ancient foot level exported by tools/build_terrain.py (the heightfield
// there is carved to it; LANDSCAPE.md).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Terrain } from '../../terrain/heightfield';
import { curvatureDrop } from '../../terrain/heightfield';
import { SURFACES, surfaceMaterial, incisedMaterial } from '../../render/materials';
import { PLAIN, feature, tag } from './data';
import type { Physics } from '../../player/physics';
import { fitBlocks, carvedBlockGeometry, inscriptionAtlas, opSignsNote, INSCRIPTION_PICK_LAYER, type Block } from '../../arch/decor';
import { panelText } from '../../arch/inscription_text';
import { ReliefSet, type ReliefItem } from '../../arch/reliefs';
/** the largest sign height the tomb panels allow (m): their lines are fitted to the field below it (C) */
const NR_GLYPH_MAX = 0.08;

SURFACES.nr_rock = { albedo: [0.56, 0.52, 0.46], roughness: 0.9, porosity: 0.3, noiseScale: 0.35, noiseAmp: 0.09, bump: { amp: 0.03, freq: 0.6 }, streaks: { amp: 0.12, freq: 0.5, stretch: 0.3 }, rockBlocks: { size: [6.5, 3.1, 40], tone: 0.07, bed: 0.03 }, tier: 'C', note: 'Naqsh-e Rustam cliff: buff-grey limestone, jointed blocks each with its own tone, bedding, run-off streaks 3× longer than wide (albedo, blocks and streaks C, D-144, D-217; was streaks stretched 12× down the face: a curtain)' };
SURFACES.nr_dressed = { albedo: [0.55, 0.52, 0.47], roughness: 0.75, porosity: 0.3, noiseScale: 1.1, noiseAmp: 0.07, bump: { amp: 0.002, freq: 4 }, tier: 'C', note: 'dressed limestone of the rock-cut façades (albedo C)' };
SURFACES.kaba_white = { albedo: [0.7, 0.68, 0.62], roughness: 0.6, porosity: 0.3, noiseScale: 1.2, noiseAmp: 0.06, joints: { course: 0.95, block: 1.9, width: 0.001, dark: 0.5 }, bump: { amp: 0.0015, freq: 5 }, tier: 'B/C', note: "Ka'ba-ye Zardosht: white limestone with dovetail-clamped blocks (B, search extract); tone C" };

const NR = () => PLAIN.naqsh_e_rustam;
const F_BEARERS = () => NR().facade.throne_bearers as number;
/** the tomb reliefs are not drawn beyond this distance (m): a 2.3 m figure at 1.5 km is ~1 px at 1080p / 70° (C) */
export const NR_RELIEF_HIDE = 1500;
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
const extrude = (shape: THREE.Shape, depth: number) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 5 }); g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; };
/** place a local geometry (x along the face, y up, z out of the back wall) at face position (x0, h0) with its back at depth d0 */
function onFace(f: Face, g: THREE.BufferGeometry, x0: number, h0: number, d0: number, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const w = toWorld(f, x0 + p.getX(i) * sx, h0 + p.getY(i) * sy, d0 - p.getZ(i) * sz); p.setXYZ(i, w.x, w.y, w.z); }
  if (g.getAttribute('normal')) g.deleteAttribute('normal');
  g.computeVertexNormals(); return g;
}
const box = (w: number, h: number, d: number) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.deleteAttribute('uv'); g.translate(0, h / 2, d / 2); return g; }; // base at y 0, back at z 0

/** dressed rock left around each cross-shaped façade (m, C): the cutters dressed the face just beyond the cross */
const DRESSED_MARGIN = 1.2;
/** distance over which the rough rock blends into the dressed margin (m, C; was 5) */
const DRESSED_BLEND = 2.5;
/** the cross-shaped hole in the cliff mesh for a façade on axis cx: the vertical arms and the median register, each with
 *  the dressed margin (two rectangles whose union is the offset cross) */
function facadeHoles(cx: number): Hole[] {
  const F = NR().facade, M = DRESSED_MARGIN, h0 = F.foot_above_ground_m, hMid = h0 + F.lower_arm_h_m, hTop = hMid + F.median_register_h_m, hEnd = hTop + F.upper_arm_h_m;
  const aw = F.arm_w_m / 2, mw = F.median_register_w_m / 2;
  return [{ x0: cx - aw - M, x1: cx + aw + M, h0: h0 - M, h1: hEnd + M }, { x0: cx - mw - M, x1: cx + mw + M, h0: hMid - M, h1: hTop + M }];
}

// ---------------------------------------------------------------- one tomb façade
/** a text area on a dressed panel: left edge x0, top yTop (face coordinates), size w × h, panel front at depth d */
interface TextArea { id: 'DNa' | 'DNb'; x0: number; yTop: number; w: number; h: number; d: number }
function tombFacade(f: Face, cx: number, inscribed: boolean, id: string): { stone: THREE.BufferGeometry[]; items: ReliefItem[]; panels: THREE.BufferGeometry[]; front: THREE.BufferGeometry; texts: TextArea[] } {
  const texts: TextArea[] = [];
  const F = NR().facade, stone: THREE.BufferGeometry[] = [], items: ReliefItem[] = [], panels: THREE.BufferGeometry[] = [];
  const R0 = F.recess_m;
  /** a carved figure of the relief system (D-019) standing on the recess back at face x (from the façade axis) and height h,
   *  figure height S, facing the viewer's right (+1) or left (−1); carving depth 0.1 m (C) */
  const rfig = (kind: string, seed: number, x: number, h: number, S: number, facing: 1 | -1, programme: string, tier = 'B') => items.push({ kind, seed, o: toWorld(f, cx + x, h, R0), X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1), S, D: 0.1, mirror: facing < 0, meta: { programme, tier, where: `${id} upper register` } });
  const h0 = F.foot_above_ground_m, hL = F.lower_arm_h_m, hM = F.median_register_h_m, hU = F.upper_arm_h_m, aw = F.arm_w_m / 2, mw = F.median_register_w_m / 2, R = F.recess_m;
  const hMid = h0 + hL, hTop = hMid + hM, hEnd = hTop + hU;
  // the dressed margin around the cross: the cross outline offset by DRESSED_MARGIN (matching the cross-shaped hole left in
  // the cliff mesh, facadeHoles) minus the cross. Was an 18 m rectangle, which in raking light read as a dark box that hid
  // the cross (session 4 render, D-144)
  const M = DRESSED_MARGIN;
  const cross: [number, number][] = [[-aw, h0], [aw, h0], [aw, hMid], [mw, hMid], [mw, hTop], [aw, hTop], [aw, hEnd], [-aw, hEnd], [-aw, hTop], [-mw, hTop], [-mw, hMid], [-aw, hMid]];
  const off: [number, number][] = [[-aw - M, h0 - M], [aw + M, h0 - M], [aw + M, hMid - M], [mw + M, hMid - M], [mw + M, hTop + M], [aw + M, hTop + M], [aw + M, hEnd + M], [-aw - M, hEnd + M], [-aw - M, hTop + M], [-mw - M, hTop + M], [-mw - M, hMid - M], [-aw - M, hMid - M]];
  const outer = new THREE.Shape(off.map(([x, y]) => new THREE.Vector2(x, y)));
  outer.holes.push(new THREE.Path(cross.slice().reverse().map(([x, y]) => new THREE.Vector2(x, y))));
  const front = new THREE.ShapeGeometry(outer); front.deleteAttribute('uv');
  const frontG = onFace(f, front.toNonIndexed(), cx, 0, 0); // the dressed rock around the cross: drawn with the cliff's material
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
  if (inscribed) { // DNb between the columns (left of the door): dressed panel, Old Persian text inset 0.1 m
    panels.push(onFace(f, box(2.4, 2.8, 0.02), cx - 3.95 - 1.2 + 0.05, hMid + 1.2, R));
    texts.push({ id: 'DNb', x0: cx - 5.1 - 1.1, yTop: hMid + 1.2 + 2.7, w: 2.2, h: 2.6, d: R - 0.02 });
  }
  // --- upper register: two tiers of 14 throne-bearers under the dais, the king on a three-stepped podium before the fire altar,
  // the winged figure and the moon above; attendants in three tiers on the side panels (programme B, drawing C)
  const u0 = hTop, bearerH = 1.35, span = 8.6;
  stone.push(onFace(f, box(span + 0.4, 0.3, 0.3), cx - span / 2 - 0.2, u0 + 0.05, R)); // ground line
  for (let t = 0; t < F.throne_bearer_tiers; t++) {
    const base = u0 + 0.35 + t * (bearerH + 0.3), n = F.throne_bearers / F.throne_bearer_tiers;
    for (let i = 0; i < n; i++) rfig('bearer', t * n + i, -span / 2 + 0.35 + i * (span - 0.7) / (n - 1), base, bearerH, 1, 'throne-bearers of the subject peoples in two tiers (B); dress per people C');
    stone.push(onFace(f, box(span, 0.28, 0.22), cx - span / 2, base + bearerH, R)); // the dais beams they lift
  }
  const top = u0 + 0.35 + 2 * (bearerH + 0.3);
  stone.push(onFace(f, box(span + 0.6, 0.35, 0.3), cx - span / 2 - 0.3, top, R));
  for (const [s, w] of [[0, 1.9], [1, 1.5], [2, 1.1]]) stone.push(onFace(f, box(w, 0.2, 0.18), cx - 2.5 - w / 2, top + 0.35 + s * 0.2, R)); // three-stepped podium
  rfig('king_worship', 0, -2.5, top + 0.95, 2.3, 1, 'the king on the stepped podium before the fire altar, bow in hand (B)');
  rfig('fire_altar', 0, 1.6, top + 0.35, 2.3, 1, 'fire altar (B)');
  rfig('winged_figure', 0, -0.2, top + 2.1, 2.4, 1, 'the figure in the winged ring above the king (B)');
  rfig('moon', 0, 3.6, top + 2.89, 0.72, 1, 'the moon (B)');
  for (const s of [-1, 1]) for (let t = 0; t < 3; t++) rfig('guard', 11 + t + (s > 0 ? 3 : 0), s * 4.6, u0 + 0.35 + t * 2.6, 1.8, (s < 0 ? 1 : -1) as 1 | -1, 'attendants and guards in three tiers on the side panels (B); which is which C', 'B');
  if (inscribed) { // DNa panel behind the king, Old Persian text inset 0.1 m
    panels.push(onFace(f, box(1.6, 2.2, 0.02), cx - 4.9 + 0.1, top + 0.9, R));
    texts.push({ id: 'DNa', x0: cx - 4.8 - 0.7, yTop: top + 0.9 + 2.1, w: 1.4, h: 2.0, d: R - 0.02 });
  }
  return { stone, items, panels, front: frontG, texts };
}

// ---------------------------------------------------------------- the cliff
// The rock is reconstruction (C): a face that leans back ~3.4 deg and rounds over at the crest, relief at three scales (vertical
// buttresses and bays 30-80 m, ribs and bedding ledges 5-15 m, blocks ~2 m), and an irregular crest 54-74 m above the ancient ground around the
// sourced 64 m, lowered to the DEM ridge behind the face where that is lower (the west end). Around the tomb panels the face is planar (dressed), blending into the rough rock over 5 m.
type Hole = { x0: number; x1: number; h0: number; h1: number };
const n1 = (t: number) => Math.sin(t) * 0.55 + Math.sin(t * 2.13 + 1.7) * 0.3 + Math.sin(t * 4.71 + 0.4) * 0.15;
const n2 = (x: number, y: number) => n1(x + 0.37 * y) * 0.6 + n1(y * 1.31 - 0.5 * x + 3.1) * 0.4;
/** height of the (DEM) ridge behind the face above the ancient foot, 5 m table set by buildNaqsh; where the ridge is lower than
 *  the sourced 64 m (the west end, where the hill runs out) the crest follows it down instead of ending as a sheer slab */
let ridge: { x0: number; v: Float32Array } | null = null;
const ridgeAt = (x: number) => { if (!ridge) return Infinity; const t = Math.min(Math.max((x - ridge.x0) / 5, 0), ridge.v.length - 1.001), i = Math.floor(t); return ridge.v[i] + (ridge.v[i + 1] - ridge.v[i]) * (t - i); };
/** crest height above the ancient foot along the face */
const crestH = (x: number, H: number) => Math.min(H + 7 * n1(x / 70) + 3 * n1(x / 17 + 2), Math.max(8, ridgeAt(x) + 3 + 2 * n1(x / 11)));
const hash1 = (i: number, j = 0) => { const v = Math.sin(i * 127.1 + j * 311.7 + 0.5) * 43758.5453; return v - Math.floor(v); };
/** the joint-bounded blocks of the rock face (D-217, C): the column (between vertical joints) and bed (between bedding
 *  joints) a point of the face lies in, and the block's own offset out of the face (m) */
export function faceBlock(x: number, h: number) {
  const col = Math.floor((x + 4 * n1(x / 23) + 1.5 * n1(h / 17 + x / 50)) / 6.5);
  const bed = Math.floor((h + 0.035 * x + 1.2 * n1(x / 19 + col)) / 3.1);
  return { col, bed, off: (hash1(col) - 0.5) * 1.1 + (hash1(col, bed) - 0.5) * 0.45 };
}
const blockRelief = (x: number, h: number) => faceBlock(x, h).off;
function faceDepth(x: number, h: number, H: number, holes: Hole[]) {
  let m = 0; for (const q of holes) { const dx = Math.max(q.x0 - x, 0, x - q.x1), dh = Math.max(q.h0 - h, 0, h - q.h1); m = Math.max(m, 1 - Math.min(1, Math.hypot(dx, dh) / DRESSED_BLEND)); }
  const top = crestH(x, H), u = Math.max(0, h) / top;
  // vertical jointing (buttresses and bays, ribs, fissures), faint sub-horizontal bedding, then blocks: oriented, not
  // isotropic noise. The bedding term was 0.9 m: under a low sun its ledges drew dark horizontal bands across the whole face
  // (session 3 and 4 renders), where the cliff reads as a sheer, vertically jointed face (D-144, C)
  // D-217 (rubric s7 pass 2, R9: "a vertically stretched curtain"): the ribs and fissures were smooth functions of x alone
  // (periods 6 m and 2.1 m, |sin| cusps), continuous from the foot to the crest: under the raking afternoon sun they drew
  // long smooth folds, a draped cloth. Now the face is broken into joint-bounded blocks: columns 4–10 m wide between
  // irregular vertical joints, each column cut by bedding joints every ~2.3–4 m (dipping ~2°), every block standing proud
  // or recessed by its own amount (a step across each joint), plus the buttresses and bays and the fine isotropic relief (C)
  const rough = 2.6 * n1(x / 38 + 0.25 * n1(h / 23)) + 0.3 * n1(h / 5.5 + 0.4 * n1(x / 17)) + blockRelief(x, h) + 0.06 * Math.abs(n1(x / 2.1 + 0.9 * n1(h / 7) + 0.6 * n1(x / 9.3))) + 0.3 * n2(x / 2.3, h / 1.9);
  return (rough + 0.06 * Math.max(0, h) + 6 * u * u * u) * (1 - m); // + lean-back (~3.4 deg) and a rounded crest
}
function cliffGeometry(f: Face, holes: Hole[], xa: number, xb: number, H: number): THREE.BufferGeometry {
  const xs = new Set<number>(), hs = new Set<number>(), hMax = H + 11;
  for (let x = xa; x <= xb + 1e-6; x += 1.5) xs.add(+x.toFixed(3));
  for (let h = -1.5; h <= hMax + 1e-6; h += 1.5) hs.add(+h.toFixed(3));
  for (const q of holes) { xs.add(q.x0); xs.add(q.x1); hs.add(q.h0); hs.add(q.h1); }
  const X = [...xs].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 0.3), Hh = [...hs].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 0.3);
  const nx = X.length, nh = Hh.length;
  const pos: number[] = [];
  for (let j = 0; j < nh; j++) for (let i = 0; i < nx; i++) { const x = X[i], h = Math.min(Hh[j], crestH(x, H)); const v = toWorld(f, x, h, faceDepth(x, h, H, holes)); pos.push(v.x, v.y, v.z); }
  const idx: number[] = [];
  for (let j = 0; j < nh - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const xm = (X[i] + X[i + 1]) / 2, hm = (Hh[j] + Hh[j + 1]) / 2;
    if (holes.some(q => xm > q.x0 && xm < q.x1 && hm > q.h0 && hm < q.h1)) continue;
    if (Hh[j] >= crestH(X[i], H) && Hh[j] >= crestH(X[i + 1], H)) continue; // above the crest: collapsed rows
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, b, c, c, b, d); // faces +z (out of the rock)
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** the cliff top: from the crest back into the mountain until it meets the (uncarved) terrain */
function cliffTop(f: Face, terrain: Terrain, xa: number, xb: number, H: number, holes: Hole[]): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = []; const back = [0, 4, 10, 18, 28, 40, 52];
  const X: number[] = []; for (let x = xa; x <= xb + 1e-6; x += 1.5) X.push(x);
  for (const x of X) { const top = crestH(x, H), d0 = faceDepth(x, top, H, holes);
    for (const d of back) {
      const p = toWorld(f, x, top, d0 + d), ty = terrain.heightAt(x, p.z) + 0.15, last = d === back[back.length - 1];
      pos.push(x, last ? ty : Math.max(p.y - d * 0.08 + 1.2 * n2(x / 13, d / 9) * Math.min(1, d / 10), ty), p.z);
    } }
  const nb = back.length;
  for (let i = 0; i + 1 < X.length; i++) for (let k = 0; k + 1 < nb; k++) { const a = i * nb + k, b = a + 1, c = a + nb, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** returns at both ends of the face, from the face back into the rock, so the carved ground behind is closed */
function endCaps(f: Face, xa: number, xb: number, H: number, holes: Hole[]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [xa, xb]) {
    const pts: THREE.Vector3[] = []; const top = crestH(x, H);
    for (let h = -1.5; h <= top; h += 3) pts.push(toWorld(f, x, h, faceDepth(x, h, H, holes)));
    pts.push(toWorld(f, x, top, faceDepth(x, top, H, holes)));
    const back = [toWorld(f, x, top, 40), toWorld(f, x, -1.5, 40)];
    const tri: THREE.Vector3[] = []; // fan from the rear bottom corner
    for (let k = 0; k + 1 < pts.length; k++) tri.push(back[1], pts[k], pts[k + 1]);
    tri.push(back[1], pts[pts.length - 1], back[0]);
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
  for (const face of [0, -1, 1]) for (const u of [-1.4, 1.4]) { win(u, 5.0, face); win(u, 8.6, face); } // two tiers of two (C, Q-078)
  return { white: mergeGeometries(white.map(g => { g.computeVertexNormals(); return g; }))!, dark: mergeGeometries(dark)!, boxes };
}

// ---------------------------------------------------------------- build
export interface NaqshBuild { group: THREE.Group; colliders(phys: Physics): void; tris: number; /** the DNa/DNb carving and pick rectangles */ texts: THREE.Group }
export function buildNaqsh(terrain: Terrain, ancientFootAsl: number): NaqshBuild {
  const cl = NR().cliff, fy = cl.face_y as number, [xa, xb] = cl.x_range as [number, number], H = cl.height_m as number;
  const f: Face = { fy, groundAsl: ancientFootAsl, court: terrain.meta.court_asl };
  { const x0 = xa - 20, n = Math.ceil((xb + 20 - x0) / 5) + 1, raw = new Float32Array(n), v = new Float32Array(n);
    for (let i = 0; i < n; i++) { let m = -Infinity; for (const d of [20, 30, 45, 60, 80, 100, 130]) m = Math.max(m, terrain.aslAt(x0 + i * 5, -(fy + d)) - ancientFootAsl); raw[i] = m; }
    for (let i = 0; i < n; i++) v[i] = (raw[Math.max(0, i - 1)] + 2 * raw[i] + raw[Math.min(n - 1, i + 1)]) / 4;
    ridge = { x0, v }; }
  const group = new THREE.Group(); group.name = 'naqsh-e-rustam';
  group.userData = tag(feature('nr_darius_tomb'), 'Naqsh-e Rustam in 467 BCE: cliff, tomb of Darius I (sealed), tomb attributed to Xerxes (façade cut, uninscribed, D-033), Ka\'ba-ye Zardosht, Neo-Elamite relief; geometry plain.json naqsh_e_rustam (tiers there)');
  const tombs = [{ id: 'nr_darius_tomb', x: feature('nr_darius_tomb').xy[0] as number, inscribed: true }, { id: 'nr_xerxes_tomb', x: feature('nr_xerxes_tomb').xy[0] as number, inscribed: false }];
  const holes = tombs.flatMap(t => facadeHoles(t.x));
  const rock = surfaceMaterial('nr_rock'), dressed = surfaceMaterial('nr_dressed');
  rock.side = THREE.DoubleSide; // the cliff's top and end returns are seen from both sides
  const facades = tombs.map(t => ({ t, fc: tombFacade(f, t.x, t.inscribed, t.id) }));
  const texts = new THREE.Group(); texts.name = 'nr-inscriptions'; const carved: THREE.BufferGeometry[] = [], textInfo: string[] = [], carvedSigns: { id: string; ver: 'op'; signs: string }[] = [];
  const inscMat = incisedMaterial('nr_dressed', inscriptionAtlas('op')); // cut into the dressed field (D-177)
  const pickMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, visible: false });
  const cliff = new THREE.Mesh(mergeGeometries([cliffGeometry(f, holes, xa, xb, H), cliffTop(f, terrain, xa, xb, H, holes), endCaps(f, xa, xb, H, holes), ...facades.map(q => q.fc.front)].map(g => g.index ? g.toNonIndexed() : g))!, rock);
  cliff.name = 'nr-cliff'; cliff.castShadow = cliff.receiveShadow = true;
  cliff.userData = { tier: 'C', src: cl.src, note: `cliff ${H} m high (B, SX); face line and rock surface reconstructed (C)`, placeholder: false };
  group.add(cliff);
  let tris = cliff.geometry.getAttribute('position').count / 3;
  for (const { t, fc } of facades) {
    const ft = feature(t.id);
    const st = new THREE.Mesh(mergeGeometries(fc.stone.map(g => g.index ? g.toNonIndexed() : g))!, dressed); st.name = t.id; st.castShadow = st.receiveShadow = true;
    st.userData = tag(ft, `${ft.name}: façade 22.93 m, median register 14 x 7.60 m, upper arm 8.50 m (B, SX); arm width 10.9 m, recess, columns and door C${t.inscribed ? '' : '; uninscribed (D-033)'}`);
    // the upper register and side panels carved by the relief system (D-069; per-figure LOD, far chunks): programme B, carving C
    const fig = new ReliefSet(fc.items, [], t.id + '-reliefs', NR_RELIEF_HIDE); // beyond 1.5 km every figure is under ~1 px
    fig.userData = { ...fig.userData, tier: 'C', src: 'NR-ACHAEMENICA;NR-IRANICA;WP-NR', note: `upper register: ${F_BEARERS()} throne-bearers in two tiers, the king on a three-stepped podium before the fire altar, the winged figure and the moon; guards and attendants on the side panels (programme B); carved relief figures, drawing and paint C (NOT SEEN)`, placeholder: false };
    group.add(st, fig); tris += st.geometry.getAttribute('position').count / 3;
    if (fc.panels.length) { const pm = new THREE.Mesh(mergeGeometries(fc.panels)!, dressed); pm.name = t.id + '-inscription-panels'; pm.userData = { tier: 'C', src: 'LIVIUS-NR', note: 'DNa/DNb inscription panels: dressed fields (position and size C)', placeholder: false }; group.add(pm); }
    // the carved Old Persian text of DNa and DNb (one mesh), with pick rectangles for the translation layer
    for (const a of fc.texts) {
      const block: Block = { id: a.id, ver: 'op', text: panelText(a.id, 'op')! }, fit = fitBlocks([block], 'stack', a.w, a.h, NR_GLYPH_MAX), L = fit.parts[0].layout;
      // text geometry: x 0…w along the face, the block's top at y 0, lines going down, z out of the panel (the signs' quads
      // lie on the dressed face; the shader cuts them in)
      const cg = carvedBlockGeometry(block, L); carvedSigns.push({ id: a.id, ver: 'op', signs: cg.userData.signs });
      carved.push(onFace(f, cg, a.x0, a.yTop, a.d));
      const quad = box(a.w + 0.1, a.h + 0.1, 0.001); onFace(f, quad, a.x0 + a.w / 2, a.yTop - a.h - 0.05, a.d - 0.01);
      const pick = new THREE.Mesh(quad, pickMat); pick.layers.set(INSCRIPTION_PICK_LAYER); pick.name = `inscription:${a.id}:op:pick`;
      pick.userData = { tier: 'C', inscription: a.id, version: 'op', pickFar: 80 }; texts.add(pick);
      textInfo.push(`${a.id}: ${L.signs.length} signs, glyph ${(fit.glyph * 100).toFixed(1)} cm, ${L.lines} lines${fit.fits ? '' : ' (DOES NOT FIT the field at the smallest glyph)'}`);
    }
  }
  if (carved.length) {
    const tm = new THREE.Mesh(mergeGeometries(carved.map(g => g.index ? g.toNonIndexed() : g))!, inscMat); tm.name = 'nr-inscriptions-carved'; tm.receiveShadow = true;
    tm.userData = { carved: carvedSigns, tier: 'B/C', src: 'ARIO-CATF;ARIO;NOTO;LIVIUS-NR', placeholder: true, note: `DNa, DNb Old Persian (text A: ARIo Q007152/Q007153, CC0). DNa ${opSignsNote('DNa')}. DNb ${opSignsNote('DNb')}. Incised in the dressed field, V-section at 45° (C, D-177); panel position C. NOT carved [PLACEHOLDER, Q-290]: the Elamite and Babylonian versions of DNa and DNb (not in the corpus read) and the captions DNc, DNd, DNe — ${textInfo.join('; ')}` };
    texts.add(tm); tris += tm.geometry.getAttribute('position').count / 3;
  }
  group.add(texts);
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
  return { group, tris, texts,
    colliders(phys: Physics) {
      const g = cliff.geometry, p = g.getAttribute('position') as THREE.BufferAttribute, idx = new Uint32Array(p.count); for (let i = 0; i < p.count; i++) idx[i] = i;
      phys.addTrimesh(new Float32Array(p.array as ArrayLike<number>), idx, { tier: 'C', what: 'naqsh-e-rustam cliff' });
      for (const b of kb.boxes) phys.addBox(b.c, b.h);
    } };
}
