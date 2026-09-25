// The palaces furnished (D-212; gap audit item 8; brief §5.1 "Interiors are furnished: thrones, hangings, carpets, vessels").
// NOTHING of what stood in the Apadana, the Tachara, the Hadish or the Harem in 467 is attested. The kinds are:
//  - the audience reliefs (TREAS-AUD, B): the throne and footstool (a work object of the court setting, workObjects.ts), the
//    fringed canopy above the king and the two incense burners before him;
//  - Herodotus 9.80 and 9.82 (HDT, B claim): the establishment Xerxes left to Mardonius, with gilded and silver-plated couches
//    "richly covered", tables of gold and silver and "gaily coloured" hangings;
//  - the Pazyryk carpet (PAZYRYK, c. 400 BCE, Achaemenid style, B for the craft and the size; NOT SEEN this session): knotted
//    pile, about 1.83 × 2.00 m, a red field of squares within borders;
//  - the Assurbanipal garden relief (ASB-GARDEN, analogy): a high couch with a footstool and a table beside it;
//  - Esther 1:6 (ESTHER-1.6, late literary, C): hangings on rings.
// Everything placed here is C: kind of room, number, size, colour and position (SITE_SPEC global.r_palace_furnishings).
// Two states: with the court absent (the default world, the evidence-strict state) the furnishings are rolled, covered
// and stored in the side rooms, and a steward's minimum is in use in the Tachara; with the court setting on and the court in
// residence (court.json resident days) the Apadana, the Tachara, the Hadish and the Harem are laid out for use. Carpets,
// mats and hangings are drawn without colliders (a player walks over a carpet; a hanging lies on the wall); every standing
// piece has a box collider in its current state and blocks the people's walkable grid (both states' pieces when the court
// setting is on). Lamps are drawn unlit: the fire system's torches and braziers light the halls. The Hadish apartments are
// not modelled (Q-087), so what the Hadish stored there is not drawn; the Apadana's own store is its S storerooms, solid in
// the build (C), so with the court away the Apadana stands empty.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { v } from '../arch/spec';
import { Rng } from '../core/rng';
import { surfaceMaterial, SURFACES, type SurfaceDef } from '../render/materials';
import type { Part, Manifest, Doorway, Column, Box } from '../arch/parts';
import type { Physics } from '../player/physics';
import courtJson from '../data/court.json';

type RGB = [number, number, number];
export type FurnState = 'stored' | 'use';
export type FurnKind = 'carpet' | 'carpet_rolls' | 'mat' | 'hanging' | 'hanging_rolls' | 'couch' | 'couch_covered' | 'table' | 'stool' | 'stool_stack' | 'footstool'
  | 'incense_burner' | 'lamp_stand' | 'chest' | 'jar' | 'canopy';
/** one piece: grid position of its floor centre (e, n), floor y, heading theta (its length axis, CCW from grid east),
 *  footprint half sizes along / across that axis, height; `metal` for the gilded or silvered pieces */
export interface FurnItem { kind: FurnKind; building: string; room: string; state: FurnState; e: number; n: number; y: number; theta: number; hu: number; hv: number; h: number; solid: boolean; metal?: 'gilt' | 'silver'; count?: number; variant: number; note: string }

/** the furnishings' surfaces (shared surface model, materials.ts): dyed wool, gold leaf, silver, fired clay (C) */
export const FURNISH_SURFACES: Record<string, SurfaceDef> = {
  furn_textile: { albedo: [0.6, 0.5, 0.4], roughness: 0.95, porosity: 0.8, noiseScale: 3, noiseAmp: 0.08, bump: { amp: 0.0006, freq: 30 }, tier: 'C', note: 'dyed wool pile and woven cloth (colours per piece from the vertex colours: madder red, indigo blue, weld yellow, undyed; C, D-212)' },
  furn_gilt: { albedo: [0.83, 0.65, 0.33], roughness: 0.3, porosity: 0, noiseScale: 3, noiseAmp: 0.05, metal: 1, tier: 'C', note: 'gold leaf over wood: the gilded couches, tables and poles (Herodotus 9.80, 9.82: B claim; the gilding here C)' },
  furn_silver: { albedo: [0.8, 0.8, 0.78], roughness: 0.28, porosity: 0, noiseScale: 3, noiseAmp: 0.05, metal: 1, tier: 'C', note: 'silver plate over wood (Herodotus 9.80: silver-plated couches, B claim; here C)' },
  furn_clay: { albedo: [0.6, 0.45, 0.33], roughness: 0.85, porosity: 0.6, noiseScale: 2, noiseAmp: 0.1, tier: 'C', note: 'plain buff fired clay (storage jars, lamps; MATERIAL_CULTURE storage jars C)' },
};
const F = () => v<any>('global', 'r_palace_furnishings');
const lin = (c: RGB): RGB => { const t = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [t.r, t.g, t.b]; };

// ---------------- local geometry (x = length axis, y up from the floor, z across) ----------------
type Mat = 'furn_textile' | 'timber' | 'furn_gilt' | 'furn_silver' | 'bronze' | 'furn_clay' | 'matting';
type Parts = Partial<Record<Mat, THREE.BufferGeometry[]>>;
const prep = (g: THREE.BufferGeometry, rgb: RGB = [1, 1, 1]) => {
  const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  const c = lin(rgb), a = new Float32Array(n.getAttribute('position').count * 3); for (let i = 0; i < a.length; i += 3) a.set(c, i); n.setAttribute('color', new THREE.BufferAttribute(a, 3)); return n;
};
const put = (P: Parts, m: Mat, g: THREE.BufferGeometry, rgb?: RGB) => { (P[m] ??= []).push(prep(g, rgb)); };
const box = (sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y + sy / 2, z);
const cylX = (r: number, len: number, x = 0, y = 0, z = 0, seg = 12) => new THREE.CylinderGeometry(r, r, len, seg, 1).rotateZ(Math.PI / 2).translate(x, y, z);
const lathe = (pts: [number, number][], seg = 14) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
/** a flat quad lying on y (a pattern patch on a carpet), x0..x1 × z0..z1 */
const patch = (x0: number, x1: number, z0: number, z1: number, y: number) => new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2);

function carpetGeo(P: Parts, variant: number, L: number, W: number) {
  const C = F().carpet, t = C.thick, b = Math.min(C.border, 0.14 * Math.min(L, W)), col = C.colours;
  put(P, 'furn_textile', box(L, t, W), col.border);
  // the pattern as colour patches lying on the pile, each 1.5 mm above the one under it (no coplanar faces to fight in the
  // depth buffer within the 90 m a palace's pieces are drawn)
  const s = 0.0015, fx = L / 2 - b, fz = W / 2 - b;
  put(P, 'furn_textile', patch(-L / 2 + 0.06, L / 2 - 0.06, -W / 2 + 0.06, W / 2 - 0.06, t + s), col.band); // the guard band inside the edge
  put(P, 'furn_textile', patch(-L / 2 + 0.1, L / 2 - 0.1, -W / 2 + 0.1, W / 2 - 0.1, t + 2 * s), col.border);
  put(P, 'furn_textile', patch(-fx, fx, -fz, fz, t + 3 * s), col.field);
  const [nx, nz] = C.squares as number[], sx = (2 * fx) / nx, sz = (2 * fz) / nz; // the field of squares (Pazyryk: 24; C here)
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const cx = -fx + (i + 0.5) * sx, cz = -fz + (j + 0.5) * sz;
    if ((i + j + variant) % 2) put(P, 'furn_textile', patch(cx - sx * 0.4, cx + sx * 0.4, cz - sz * 0.4, cz + sz * 0.4, t + 4 * s), col.square);
    put(P, 'furn_textile', patch(cx - sx * 0.14, cx + sx * 0.14, cz - sz * 0.14, cz + sz * 0.14, t + 5 * s), col.motif);
  }
}
function rollsGeo(P: Parts, n: number, r: number, len: number, cols: RGB[]) { // a pile of rolls along x: rows of k, k-1, … (C)
  let k = Math.max(1, Math.ceil((Math.sqrt(8 * n + 1) - 1) / 2)), left = n, row = 0;
  while (left > 0 && k > 0) { const m = Math.min(k, left);
    for (let i = 0; i < m; i++) put(P, 'furn_textile', cylX(r, len, 0, r + row * r * 1.7, (i - (m - 1) / 2) * 2 * r), cols[(i + row) % cols.length]);
    left -= m; k--; row++; }
}
function legs(P: Parts, m: Mat, len: number, w: number, h: number, r: number, rgb?: RGB, inset = 0.06) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(P, m, lathe([[0, 0], [r * 1.5, 0], [r * 0.7, h * 0.25], [r, h * 0.5], [r * 0.7, h * 0.75], [r * 1.2, h], [0, h]], 8).translate(sx * (len / 2 - inset), 0, sz * (w / 2 - inset)), rgb);
}
function couchGeo(P: Parts, covered: boolean, metal: Mat, variant: number) {
  const C = F().couch, L = C.len, W = C.w, H = C.h, frameY = H - C.mattress - 0.1;
  legs(P, metal, L, W, frameY, C.leg_r);
  if (covered) { // a linen cover over the mattress and head, reaching down over the frame (C)
    put(P, 'furn_textile', box(L + 0.06, H - frameY + 0.2, W + 0.06, 0, frameY - 0.2, 0), C.cover);
    put(P, 'furn_textile', box(0.16, C.head - H + 0.02, W + 0.06, L / 2 - 0.05, H - 0.02, 0), C.cover);
    return;
  }
  put(P, metal, box(L, 0.1, W, 0, frameY, 0)); // the frame
  put(P, metal, box(0.08, C.head - frameY, W, L / 2 - 0.04, frameY, 0)); // the raised head end
  const cloth: RGB[] = [[0.44, 0.1, 0.08], [0.2, 0.24, 0.38], [0.74, 0.6, 0.32]];
  put(P, 'furn_textile', box(L - 0.1, C.mattress, W - 0.04, -0.04, frameY + 0.1, 0), cloth[variant % 3]); // mattress "richly covered"
  put(P, 'furn_textile', cylX(0.1, W - 0.1, 0, 0, 0).rotateY(Math.PI / 2).translate(L / 2 - 0.2, H + 0.08, 0), cloth[(variant + 1) % 3]); // bolster at the head
}
function tableGeo(P: Parts, metal: Mat) { const T = F().table; put(P, metal, box(T.len, 0.04, T.w, 0, T.h - 0.04, 0)); legs(P, metal, T.len, T.w, T.h - 0.04, 0.025); }
function stoolGeo(P: Parts, m: Mat, y0 = 0, rgb?: RGB) { const S = F().stool; put(P, m, box(S.w, 0.05, S.w, 0, y0 + S.h - 0.05, 0), rgb); legs(P, m, S.w, S.w, S.h - 0.05, 0.02, rgb, 0.04); if (y0) for (const g of P[m]!.slice(-4)) g.translate(0, y0, 0); }
function footstoolGeo(P: Parts, m: Mat) { const S = F().footstool; put(P, m, box(S.len, 0.06, S.w, 0, S.h - 0.06, 0)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(P, m, box(0.05, S.h - 0.06, 0.05, sx * (S.len / 2 - 0.05), 0, sz * (S.w / 2 - 0.05))); }
function burnerGeo(P: Parts) { // after the incense burners of the audience reliefs (B): a tall stand, a bowl and a stepped conical lid (C)
  const B = F().incense_burner, h = B.h, r = B.r;
  put(P, 'bronze', lathe([[0, 0], [r * 1.1, 0], [r * 0.9, 0.04], [r * 0.25, h * 0.14], [r * 0.14, h * 0.2], [r * 0.12, h * 0.62], [r * 0.3, h * 0.66], [r * 0.95, h * 0.72], [r, h * 0.74],
    [r * 0.8, h * 0.78], [r * 0.8, h * 0.82], [r * 0.55, h * 0.86], [r * 0.55, h * 0.9], [r * 0.3, h * 0.94], [r * 0.08, h * 0.98], [r * 0.1, h], [0, h]], 16));
}
function lampGeo(P: Parts) { // a bronze lamp stand with a clay lamp on its dish (C; candles are blocklisted)
  const L = F().lamp_stand, h = L.h, r = L.r;
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; put(P, 'bronze', new THREE.CylinderGeometry(0.012, 0.016, 0.32, 5).rotateZ(0.9).rotateY(a).translate(Math.cos(a) * r * 0.55, 0.12, -Math.sin(a) * r * 0.55)); }
  put(P, 'bronze', new THREE.CylinderGeometry(0.014, 0.02, h - 0.2, 6).translate(0, 0.2 + (h - 0.2) / 2, 0));
  put(P, 'bronze', lathe([[0, 0], [r * 0.7, 0.01], [r * 0.75, 0.03], [0, 0.03]], 10).translate(0, h, 0));
  put(P, 'furn_clay', new THREE.SphereGeometry(0.06, 10, 6).scale(1.3, 0.35, 0.8).translate(0.01, h + 0.045, 0), [0.62, 0.47, 0.34]);
}
function chestGeo(P: Parts) { const C = F().chest; put(P, 'timber', box(C.len, C.h - 0.06, C.w), [0.5, 0.37, 0.26]); put(P, 'timber', box(C.len + 0.04, 0.06, C.w + 0.04, 0, C.h - 0.06, 0), [0.44, 0.32, 0.22]);
  for (const x of [-0.3, 0.3]) put(P, 'bronze', box(0.04, C.h - 0.05, C.w + 0.01, x * C.len, 0, 0)); }
function jarGeo(P: Parts) { const J = F().jar, h = J.h, r = J.r;
  put(P, 'furn_clay', lathe([[0, 0], [r * 0.35, 0], [r * 0.8, h * 0.18], [r, h * 0.45], [r * 0.9, h * 0.7], [r * 0.45, h * 0.88], [r * 0.4, h * 0.92], [r * 0.48, h * 0.96], [r * 0.45, h], [0, h]], 14), [0.64, 0.49, 0.36]);
  put(P, 'furn_clay', new THREE.SphereGeometry(r * 0.46, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1).translate(0, h, 0), [0.5, 0.4, 0.3]); } // the clay stopper
function hangingGeo(P: Parts, variant: number) { // x along the wall, z out of it (the wall face at z = 0), y from the floor
  const H = F().hanging, w = H.w, h = H.h, top = H.top, z = H.off_wall, cols = (H.colours as RGB[][])[variant % H.colours.length];
  put(P, 'furn_textile', box(w, h, H.thick, 0, top - h, z), cols[0]);
  for (const f of [0.12, 0.5, 0.88]) put(P, 'furn_textile', box(w, h * 0.06, H.thick, 0, top - h * f - h * 0.03, z + 0.002), cols[1]); // woven bands (C)
  put(P, 'furn_textile', box(w, 0.08, H.thick * 0.5, 0, top - h - 0.08, z), cols[1]); // the fringe
  put(P, 'furn_gilt', cylX(H.rod_r, w + 0.2, 0, top + 0.02, z));
}
function canopyGeo(P: Parts) { // after the canopy over the king on the audience reliefs (B); four gilded poles, a cloth roof, a fringed band (C)
  const C = F().canopy, w = C.w, d = C.d, h = C.h;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(P, 'furn_gilt', new THREE.CylinderGeometry(C.pole_r, C.pole_r * 1.2, h, 8).translate(sx * w / 2, h / 2, sz * d / 2));
  put(P, 'furn_textile', box(w + 0.1, 0.03, d + 0.1, 0, h, 0), C.cloth);
  for (const [sx, sz, lx, lz] of [[0, -1, w + 0.1, 0.01], [0, 1, w + 0.1, 0.01], [-1, 0, 0.01, d + 0.1], [1, 0, 0.01, d + 0.1]] as const)
    put(P, 'furn_textile', box(lx, C.fringe, lz, sx * (w / 2 + 0.05), h - C.fringe + 0.01, sz * (d / 2 + 0.05)), C.band);
}
/** the local geometry of a piece, per material */
export function itemGeometry(it: FurnItem): Parts {
  const P: Parts = {}, metal: Mat = it.metal === 'silver' ? 'furn_silver' : 'furn_gilt', R = F();
  switch (it.kind) {
    case 'carpet': carpetGeo(P, it.variant, 2 * it.hu, 2 * it.hv); break;
    case 'carpet_rolls': rollsGeo(P, it.count ?? 6, R.carpet_roll.r, R.carpet_roll.len, [R.carpet.colours.undyed, R.carpet.colours.field, R.carpet.colours.undyed]); break;
    case 'hanging_rolls': rollsGeo(P, it.count ?? 3, R.hanging_roll.r, R.hanging_roll.len, [R.carpet.colours.undyed, [0.2, 0.24, 0.38], [0.44, 0.1, 0.08]]); break;
    case 'mat': put(P, 'matting', box(R.mat.size[0], R.mat.thick, R.mat.size[1])); break;
    case 'hanging': hangingGeo(P, it.variant); break;
    case 'couch': couchGeo(P, false, metal, it.variant); break;
    case 'couch_covered': couchGeo(P, true, metal, it.variant); break;
    case 'table': tableGeo(P, metal); break;
    case 'stool': stoolGeo(P, 'timber', 0, [0.5, 0.38, 0.27]); break;
    case 'stool_stack': for (let k = 0; k < (it.count ?? 3); k++) stoolGeo(P, 'timber', k * (R.stool.h - 0.02), [0.5, 0.38, 0.27]); break;
    case 'footstool': footstoolGeo(P, it.state === 'use' ? metal : 'timber'); break;
    case 'incense_burner': burnerGeo(P); break;
    case 'lamp_stand': lampGeo(P); break;
    case 'chest': chestGeo(P); break;
    case 'jar': jarGeo(P); break;
    case 'canopy': canopyGeo(P); break;
  }
  return P;
}
const KIND_NOTE: Record<FurnKind, string> = {
  carpet: 'knotted-pile carpet, 2.00 × 1.83 m, a red field of squares in a blue border (after the Pazyryk carpet, c. 400 BCE, Achaemenid style: B for the craft and the size; pattern and colours C)',
  carpet_rolls: 'carpets rolled and piled for store, some wrapped in undyed cloth (C)',
  mat: 'a reed mat (C)', hanging: 'a woven wall hanging on a gilded rod ("gaily coloured hangings", Herodotus 9.82: B claim; hangings on rings, Esther 1:6: C; size, colours and bands C)',
  hanging_rolls: 'wall hangings taken down and rolled (C)',
  couch: 'a couch "richly covered", its frame and legs gilded or silver-plated (Herodotus 9.80, 9.82: B claim; the form after the Assurbanipal garden relief: analogy; C)',
  couch_covered: 'a couch under a linen cover while the court is away (C)', table: 'a small table, gilded or silver-plated (Herodotus 9.82 "tables of gold and silver": B claim; form C)',
  stool: 'a wooden stool (C)', stool_stack: 'stools stacked for store (C)', footstool: 'a footstool (the audience reliefs\' footstool: B; before a couch after the Assurbanipal relief: analogy; C)',
  incense_burner: 'an incense burner: a tall bronze stand with a stepped conical lid, as before the king on the audience reliefs (TREAS-AUD: B; size C)',
  lamp_stand: 'a bronze lamp stand with a clay oil lamp, unlit (C)', chest: 'a wooden chest with bronze bands (C)', jar: 'a storage jar, stoppered with clay (MATERIAL_CULTURE storage jars: C)',
  canopy: 'the canopy over the king\'s place: four gilded poles and a cloth roof with a fringed band (the canopy over the king on the audience reliefs: B; standing in the Apadana, form and size C)',
};

// ---------------- layout ----------------
interface Room { id: string; building: string; x0: number; x1: number; y0: number; y1: number; fl: number; top: number }
type Rect = [number, number, number, number]; // x0, y0, x1, y1 (grid)
const hit = (a: Rect, b: Rect) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const rectOf = (e: number, n: number, theta: number, hu: number, hv: number): Rect => { const c = Math.abs(Math.cos(theta)), s = Math.abs(Math.sin(theta)), ex = c * hu + s * hv, ey = s * hu + c * hv; return [e - ex, n - ey, e + ex, n + ey]; };

/** the plan of every piece in both states (grid coordinates; SITE_SPEC global.r_palace_furnishings; all C) */
export function palaceFurnishingPlan(parts: Part[], manifest: Manifest, doorways: Doorway[]): FurnItem[] {
  const R = F(), out: FurnItem[] = [], rng = new Rng(7, 'palace-furnish');
  const cols = parts.filter((p): p is Column => p.type === 'column');
  const frames = parts.filter((p): p is Box => p.type === 'box' && /^(door|window|niche)_frame$/.test(p.kind));
  const colRects = (b: string): Rect[] => cols.filter(c => c.building === b).map(c => { const h = c.order.baseW / 2 + R.clear_column; return [c.c[0] - h, c.c[1] - h, c.c[0] + h, c.c[1] + h]; });
  const doorRects = (b: string): Rect[] => doorways.filter(d => d.building === b).map(d => { // the passage kept clear on both sides of the doorway
    const hu = d.width / 2 + 0.4, hn = d.depth / 2 + R.clear_door; return rectOf(d.c[0], d.c[1], Math.atan2(d.u[1], d.u[0]), hu, hn); });
  const taken = new Map<string, Rect[]>(); // per building and state: floor footprints already placed
  const key = (b: string, s: FurnState) => `${b}|${s}`;
  /** place a piece if its footprint is free (inside the room, clear of columns, doorways and other pieces) */
  const place = (room: Room, state: FurnState, kind: FurnKind, e: number, n: number, theta: number, hu: number, hv: number, h: number, extra: Partial<FurnItem> = {}, check = true): FurnItem | null => {
    const r = rectOf(e, n, theta, hu, hv), T = taken.get(key(room.building, state)) ?? [];
    if (check) {
      if (r[0] < room.x0 + 0.03 || r[2] > room.x1 - 0.03 || r[1] < room.y0 + 0.03 || r[3] > room.y1 - 0.03) return null;
      if (colRects(room.building).some(c => hit(c, r)) || doorRects(room.building).some(d => hit(d, r)) || T.some(t => hit(t, r))) return null;
    }
    const it: FurnItem = { kind, building: room.building, room: room.id, state, e, n, y: room.fl, theta, hu, hv, h, solid: true, variant: rng.int(0, 5), note: KIND_NOTE[kind], ...extra };
    if (it.solid) { T.push(r); taken.set(key(room.building, state), T); }
    out.push(it); return it;
  };
  /** the four walls of a room: for each, a point on the wall line, the direction along it and the inward normal */
  // theta turns a piece so that its local +z (a hanging's face, a couch's open side) points into the room: rotating by
  // theta about the vertical takes local +z to grid (sin theta, −cos theta)
  const walls = (room: Room) => ([
    { side: 'S', at: (a: number): [number, number] => [a, room.y0], lo: room.x0, hi: room.x1, into: [0, 1], theta: Math.PI },
    { side: 'N', at: (a: number): [number, number] => [a, room.y1], lo: room.x0, hi: room.x1, into: [0, -1], theta: 0 },
    { side: 'W', at: (a: number): [number, number] => [room.x0, a], lo: room.y0, hi: room.y1, into: [1, 0], theta: Math.PI / 2 },
    { side: 'E', at: (a: number): [number, number] => [room.x1, a], lo: room.y0, hi: room.y1, into: [-1, 0], theta: -Math.PI / 2 },
  ]);
  /** pieces along the walls: up to `per` on each chosen wall, evenly spread, `off` from the wall (their length along it) */
  const alongWalls = (room: Room, state: FurnState, kind: FurnKind, hu: number, hv: number, h: number, per: number, sides = 'NSEW', extra: Partial<FurnItem> = {}, off = 0.08) => {
    const got: FurnItem[] = [];
    for (const w of walls(room)) { if (!sides.includes(w.side)) continue; let k = 0; const L = w.hi - w.lo, slots = Math.max(1, Math.floor(L / (2 * hu + 0.6)));
      for (let i = 0; i < slots && k < per; i++) { const a = w.lo + ((i + 0.5) / slots) * L, [x, y] = w.at(a), e = x + w.into[0] * (hv + off), n = y + w.into[1] * (hv + off);
        const it = place(room, state, kind, e, n, w.theta, hu, hv, h, extra); if (it) { got.push(it); k++; } } }
    return got;
  };
  /** a couch with its footstool before it and a table at its head (the Assurbanipal garden relief: analogy; C) */
  const couchSets = (room: Room, per: number, sides = 'NSEW') => {
    const C = R.couch, FS = R.footstool, T = R.table; let nCouch = 0;
    for (const w of walls(room)) { if (!sides.includes(w.side)) continue; let k = 0; const L = w.hi - w.lo, slots = Math.max(1, Math.floor(L / (C.len + 1.6)));
      for (let i = 0; i < slots && k < per; i++) {
        const a = w.lo + ((i + 0.5) / slots) * L, [x, y] = w.at(a), ce = x + w.into[0] * (C.w / 2 + 0.08), cn = y + w.into[1] * (C.w / 2 + 0.08);
        const ux = Math.cos(w.theta), uy = Math.sin(w.theta), fe = ce + w.into[0] * (C.w / 2 + FS.w / 2 + 0.12), fn = cn + w.into[1] * (C.w / 2 + FS.w / 2 + 0.12);
        const te = ce + ux * (C.len / 2 - T.len / 2) + w.into[0] * (C.w / 2 + T.w / 2 + 0.1), tn = cn + uy * (C.len / 2 - T.len / 2) + w.into[1] * (C.w / 2 + T.w / 2 + 0.1);
        const fe2 = fe - ux * 0.45, fn2 = fn - uy * 0.45; // the footstool toward the couch's foot, the table at its head
        const T0 = taken.get(key(room.building, 'use')) ?? [], rs = [rectOf(ce, cn, w.theta, C.len / 2, C.w / 2), rectOf(fe2, fn2, w.theta, FS.len / 2, FS.w / 2), rectOf(te, tn, w.theta, T.len / 2, T.w / 2)];
        if (rs.some(r => r[0] < room.x0 + 0.03 || r[2] > room.x1 - 0.03 || r[1] < room.y0 + 0.03 || r[3] > room.y1 - 0.03 || colRects(room.building).some(c => hit(c, r)) || doorRects(room.building).some(d => hit(d, r)) || T0.some(t => hit(t, r)))) continue;
        const metal: 'gilt' | 'silver' = nCouch++ % 2 ? 'silver' : 'gilt';
        place(room, 'use', 'couch', ce, cn, w.theta, C.len / 2, C.w / 2, C.head, { metal }, false);
        place(room, 'use', 'footstool', fe2, fn2, w.theta, FS.len / 2, FS.w / 2, FS.h, { metal }, false);
        place(room, 'use', 'table', te, tn, w.theta, T.len / 2, T.w / 2, T.h, { metal }, false); k++;
      } }
  };
  /** the room's carpets, laid bay by bay between the column bases (and between the outer columns and the walls): as many
   *  carpets of the Pazyryk size as a bay holds, or one cut to the bay where it is narrower (sizes varied: C). Carpets have
   *  no collider and may run under the standing pieces */
  const carpets = (room: Room, state: FurnState) => {
    const C = R.carpet, [L, W] = C.size as number[], m = C.margin, gap = C.gap;
    const cs = cols.filter(c => c.building === room.building && c.c[0] > room.x0 && c.c[0] < room.x1 && c.c[1] > room.y0 && c.c[1] < room.y1);
    const half = cs.length ? cs[0].order.baseW / 2 + R.clear_column + 0.005 : 0, uniq = (a: number[]) => [...new Set(a.map(x => Math.round(x * 100) / 100))].sort((p, q) => p - q);
    const spans = (lo: number, hi: number, at: number[]): [number, number][] => { const p = [lo - m, ...at, hi + m], out2: [number, number][] = [];
      for (let i = 1; i < p.length; i++) out2.push([i === 1 ? lo + m : p[i - 1] + half, i === p.length - 1 ? hi - m : p[i] - half]); return out2; };
    let k = 0;
    for (const [a0, a1] of spans(room.x0, room.x1, uniq(cs.map(c => c.c[0])))) for (const [b0, b1] of spans(room.y0, room.y1, uniq(cs.map(c => c.c[1])))) {
      const fw = a1 - a0, fh = b1 - b0; if (fw < C.min || fh < C.min) continue;
      const nx = Math.max(1, Math.floor((fw + gap) / (L + gap))), ny = Math.max(1, Math.floor((fh + gap) / (W + gap)));
      const lx = Math.min(L, (fw - (nx - 1) * gap) / nx), ly = Math.min(W, (fh - (ny - 1) * gap) / ny);
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const e = (a0 + a1) / 2 + (i - (nx - 1) / 2) * (lx + gap), n = (b0 + b1) / 2 + (j - (ny - 1) / 2) * (ly + gap);
        const r = rectOf(e, n, 0, lx / 2, ly / 2); if (colRects(room.building).some(c => hit(c, r))) continue;
        out.push({ kind: 'carpet', building: room.building, room: room.id, state, e, n, y: room.fl, theta: 0, hu: lx / 2, hv: ly / 2, h: C.thick, solid: false, variant: k++, note: KIND_NOTE.carpet });
      }
    }
  };
  /** hangings on the walls where no door, window or niche is (below the ceiling); none in front of an opening */
  const hangings = (room: Room, state: FurnState, sides = 'NSEW', near?: (e: number, n: number) => boolean) => {
    const H = R.hanging, top = Math.min(H.top, room.top - room.fl - 0.3); if (top < H.h + 0.3) return;
    for (const w of walls(room)) { if (!sides.includes(w.side)) continue; const L = w.hi - w.lo, n = Math.floor((L - 0.6) / (H.w + H.gap)), start = w.lo + (L - n * (H.w + H.gap) + H.gap) / 2;
      for (let i = 0; i < n; i++) { const a0 = start + i * (H.w + H.gap), a1 = a0 + H.w, [x, y] = w.at((a0 + a1) / 2), vert = w.side === 'W' || w.side === 'E';
        if (near && !near(x, y)) continue;
        // an opening in this wall: a frame box (or a doorway's passage) that reaches the room's face of the wall
        const along = (px: number, py: number) => (vert ? py : px), off = (px: number, py: number) => (vert ? Math.abs(px - x) : Math.abs(py - y));
        const sz = (f: Box) => { const [sx, sy] = f.rot && Math.abs(Math.sin(f.rot)) > 0.7 ? [f.size[1], f.size[0]] : f.size; return vert ? { al: sy, ac: sx } : { al: sx, ac: sy }; };
        const blocked = frames.some(f => { if (f.building !== room.building) return false; const { al, ac } = sz(f);
            return off(f.c[0], f.c[1]) - ac / 2 < 0.3 && f.y1 > room.fl + top - H.h - 0.1 && f.y0 < room.fl + top + 0.1 && along(f.c[0], f.c[1]) + al / 2 > a0 - 0.15 && along(f.c[0], f.c[1]) - al / 2 < a1 + 0.15; })
          || doorways.some(d => d.building === room.building && off(d.c[0], d.c[1]) - d.depth / 2 < 0.3 && Math.abs(along(d.c[0], d.c[1]) - (a0 + a1) / 2) < H.w / 2 + d.width / 2 + 0.3);
        if (blocked) continue;
        out.push({ kind: 'hanging', building: room.building, room: room.id, state, e: x, n: y, y: room.fl, theta: w.theta, hu: H.w / 2, hv: 0.05, h: top, solid: false, variant: i, note: KIND_NOTE.hanging }); } }
  };

  // ---- the rooms (interior faces; heights to the ceiling)
  // `fl` is the top of the render-only plaster coat on the hall floors (global.r_floor_finish): the pieces stand on it
  const M = manifest as any, rooms: Record<string, Room> = {}, FIN = v<number>('global', 'r_floor_finish');
  const hallOf = (b: string): Room | null => { const r = M[b]?.room as number[] | undefined; if (!r) return null; const [cx, cy, sx, sy, fl, h] = r; return { id: 'hall', building: b, x0: cx - sx / 2, x1: cx + sx / 2, y0: cy - sy / 2, y1: cy + sy / 2, fl: fl + FIN, top: fl + h }; };
  if (M.tachara) { const fl = M.tachara.room[4] + FIN, top = M.tachara.room[4] + M.tachara.room[5]; for (const r of v<any[]>('tachara', 'plan_rooms')) rooms[`tachara:${r.id}`] = { id: r.id, building: 'tachara', x0: r.x[0], x1: r.x[1], y0: r.y[0], y1: r.y[1], fl, top }; }
  for (const b of ['apadana', 'hadish', 'harem']) { const h = hallOf(b); if (h) rooms[`${b}:hall`] = h; }
  const T = (id: string) => rooms[`tachara:${id}`], S = R.stool, CH = R.chest, J = R.jar, CR = R.carpet_roll, HR = R.hanging_roll, CO = R.couch, IB = R.incense_burner, LS = R.lamp_stand;
  const corners = (room: Room, state: FurnState, kind: FurnKind, r: number, h: number, inset = 0.6) => { for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) place(room, state, kind, sx ? room.x1 - inset : room.x0 + inset, sy ? room.y1 - inset : room.y0 + inset, 0, r, r, h); };
  const flankDoor = (room: Room, state: FurnState, door: string, kind: FurnKind, r: number, h: number, inward = 1.9, side = 1.4) => { const d = doorways.find(q => q.id === door); if (!d) return;
    const s = ((room.x0 + room.x1) / 2 - d.c[0]) * d.n[0] + ((room.y0 + room.y1) / 2 - d.c[1]) * d.n[1] > 0 ? 1 : -1; // the room side of the doorway
    for (const k of [-1, 1]) place(room, state, kind, d.c[0] + s * d.n[0] * inward + k * d.u[0] * side, d.c[1] + s * d.n[1] * inward + k * d.u[1] * side, 0, r, r, h); };

  // ---- APADANA: the audience (court in residence only); with the court away it stands empty (its S storerooms are solid)
  const A = rooms['apadana:hall'];
  if (A) {
    const th = (courtJson as any).places.find((p: any) => p.id === 'court_throne')?.at as [number, number] | undefined, CN = R.canopy;
    if (th) {
      const [te, tn] = th, cc: [number, number] = [te, tn - 0.4]; // the canopy centred just behind the throne
      for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) carpetsAt(A, 'use', te + i * R.carpet.size[0] / 2, tn + j * R.carpet.size[1] / 2);
      for (let n = tn + R.carpet.size[1] * 1.5; n < A.y1 - 2.0; n += R.carpet.size[1] + 0.02) carpetsAt(A, 'use', te, n); // the carpet road from the N doorway to the throne (C)
      const cp = place(A, 'use', 'canopy', cc[0], cc[1], 0, CN.w / 2 + CN.pole_r, CN.d / 2 + CN.pole_r, CN.h, {}, false); if (cp) cp.solid = false; // posts: their own colliders (below)
      for (const k of [-1, 1]) place(A, 'use', 'incense_burner', te + k * 0.45, tn + 1.4, 0, IB.r, IB.r, IB.h, {}, false);
      hangings(A, 'use', 'S', e => Math.abs(e - te) < R.apadana_hangings_reach); // on the S wall behind the throne only
    }
  }
  function carpetsAt(room: Room, state: FurnState, e: number, n: number) { const [L, W] = R.carpet.size as number[]; out.push({ kind: 'carpet', building: room.building, room: room.id, state, e, n, y: room.fl, theta: 0, hu: L / 2, hv: W / 2, h: R.carpet.thick, solid: false, variant: Math.round(e + n), note: KIND_NOTE.carpet }); }

  // ---- TACHARA: the court's use / the store (its side rooms) and the steward's corner
  if (T('hall')) {
    const H = T('hall');
    // in use: carpets, couch sets, hangings, incense burners inside the S door, lamp stands in the corners
    carpets(H, 'use'); couchSets(H, 1); hangings(H, 'use'); flankDoor(H, 'use', 'tachara:S_main', 'incense_burner', IB.r, IB.h); corners(H, 'use', 'lamp_stand', LS.r, LS.h);
    for (const id of ['W1', 'W2', 'E2', 'NW_room', 'NE_room']) if (T(id)) { carpets(T(id), 'use'); couchSets(T(id), 1); }
    // the stores, the same in both states: jars in the rooms off the portico, chests in the small inner rooms (C)
    for (const st of ['use', 'stored'] as FurnState[]) {
      for (const id of ['SW', 'SE']) if (T(id)) alongWalls(T(id), st, 'jar', J.r, J.r, J.h, 3, id === 'SW' ? 'WN' : 'EN');
      for (const id of ['W3', 'E3']) if (T(id)) alongWalls(T(id), st, 'chest', CH.len / 2, CH.w / 2, CH.h, 1, 'NSEW');
    }
    // stored: carpets rolled in W2 and the NW room, hangings rolled with chests in W1, couches covered in E2 and the NE room,
    // stools stacked and the incense burners put by (C)
    if (T('W2')) alongWalls(T('W2'), 'stored', 'carpet_rolls', CR.len / 2, CR.r * 3.2, CR.r * 5, 2, 'WN', { count: 6 });
    if (T('NW_room')) { alongWalls(T('NW_room'), 'stored', 'carpet_rolls', CR.len / 2, CR.r * 3.2, CR.r * 5, 2, 'WN', { count: 6 }); alongWalls(T('NW_room'), 'stored', 'couch_covered', CO.len / 2, CO.w / 2, CO.head, 1, 'S', { metal: 'gilt' }); }
    if (T('W1')) { alongWalls(T('W1'), 'stored', 'hanging_rolls', HR.len / 2, HR.r * 3, HR.r * 3.5, 1, 'W', { count: 4 }); alongWalls(T('W1'), 'stored', 'chest', CH.len / 2, CH.w / 2, CH.h, 1, 'N'); }
    if (T('E2')) { alongWalls(T('E2'), 'stored', 'couch_covered', CO.len / 2, CO.w / 2, CO.head, 2, 'E', { metal: 'silver' }); alongWalls(T('E2'), 'stored', 'stool_stack', S.w / 2, S.w / 2, S.h * 3, 1, 'N', { count: 3 }); }
    if (T('NE_room')) { alongWalls(T('NE_room'), 'stored', 'couch_covered', CO.len / 2, CO.w / 2, CO.head, 2, 'NE', { metal: 'gilt' }); alongWalls(T('NE_room'), 'stored', 'incense_burner', IB.r, IB.r, IB.h, 2, 'W'); alongWalls(T('NE_room'), 'stored', 'stool_stack', S.w / 2, S.w / 2, S.h * 3, 2, 'S', { count: 3 }); }
    // the steward's everyday minimum (stored state, C): a reed mat inside the S door, a stool, a water jar and a lamp stand
    const d = doorways.find(q => q.id === 'tachara:S_main');
    if (d) { const e0 = d.c[0] - 3.2, n0 = d.c[1] + 1.4; const mat = place(H, 'stored', 'mat', e0, n0, 0, R.mat.size[0] / 2, R.mat.size[1] / 2, R.mat.thick, {}, true); if (mat) mat.solid = false;
      place(H, 'stored', 'stool', e0 + 0.4, n0 + 0.1, 0, S.w / 2, S.w / 2, S.h, {}, false); place(H, 'stored', 'jar', e0 - 1.3, n0 - 0.2, 0, J.r, J.r, J.h, {}, true); place(H, 'stored', 'lamp_stand', e0 - 1.3, n0 + 0.6, 0, LS.r, LS.r, LS.h, {}, true); }
  }
  // ---- HADISH: laid out for the king's table with the court in residence; under covers while it is away (its apartments,
  // where most would be stored, are not modelled: Q-087)
  const HD = rooms['hadish:hall'];
  if (HD) {
    carpets(HD, 'use'); couchSets(HD, R.couches_per_wall, 'WE'); hangings(HD, 'use'); flankDoor(HD, 'use', 'hadish:S', 'incense_burner', IB.r, IB.h); corners(HD, 'use', 'lamp_stand', LS.r, LS.h);
    alongWalls(HD, 'stored', 'couch_covered', CO.len / 2, CO.w / 2, CO.head, 3, 'W', { metal: 'gilt' });
    alongWalls(HD, 'stored', 'carpet_rolls', CR.len / 2, CR.r * 3.2, CR.r * 5, 3, 'E', { count: 6 });
    alongWalls(HD, 'stored', 'hanging_rolls', HR.len / 2, HR.r * 3, HR.r * 3.5, 2, 'S', { count: 4 }); alongWalls(HD, 'stored', 'chest', CH.len / 2, CH.w / 2, CH.h, 2, 'N');
  }
  // ---- HAREM hall: the same, smaller
  const HM = rooms['harem:hall'];
  if (HM) {
    carpets(HM, 'use'); couchSets(HM, 2, 'WE'); hangings(HM, 'use'); corners(HM, 'use', 'lamp_stand', LS.r, LS.h);
    alongWalls(HM, 'stored', 'couch_covered', CO.len / 2, CO.w / 2, CO.head, 2, 'W', { metal: 'silver' });
    alongWalls(HM, 'stored', 'carpet_rolls', CR.len / 2, CR.r * 3.2, CR.r * 5, 1, 'E', { count: 6 }); alongWalls(HM, 'stored', 'chest', CH.len / 2, CH.w / 2, CH.h, 1, 'E');
  }
  return out;
}

// ---------------- the drawn furnishings ----------------
const MATS: Mat[] = ['furn_textile', 'timber', 'furn_gilt', 'furn_silver', 'bronze', 'furn_clay', 'matting'];
const VC = new Set<Mat>(['furn_textile', 'timber', 'furn_clay']);
/** the palaces' furnishings in both states: one merged mesh per building, state and material; colliders of the current
 *  state; `setCourt` switches between them (the court setting only) */
export class PalaceFurnishings {
  readonly group = new THREE.Group();
  readonly plan: FurnItem[];
  readonly info = { items: { stored: 0, use: 0 }, tris: { stored: 0, use: 0 }, meshes: { stored: 0, use: 0 }, colliders: { stored: 0, use: 0 }, buildMs: 0 };
  private groups = new Map<string, THREE.Group>(); // building|state
  private centres = new Map<string, [number, number]>();
  private live: any[] = []; private state: FurnState = 'stored';
  constructor(parts: Part[], manifest: Manifest, doorways: Doorway[], private opts: { court: boolean; phys?: Physics | null }) {
    const t0 = performance.now(); Object.assign(SURFACES, FURNISH_SURFACES);
    this.group.name = 'palace-furnishings';
    this.group.userData = { tier: 'C', src: 'TREAS-AUD;HDT;PAZYRYK;ASB-GARDEN;ESTHER-1.6;RECON', note: 'palace furnishings (D-212): kinds from the audience reliefs (B), Herodotus 9.80/9.82 (B claim), the Pazyryk carpet (B craft), Near-Eastern analogy; every size, colour, number and place C' };
    this.plan = palaceFurnishingPlan(parts, manifest, doorways).filter(it => opts.court || it.state === 'stored');
    const byGroup = new Map<string, FurnItem[]>(); for (const it of this.plan) { const k = `${it.building}|${it.state}`; (byGroup.get(k) ?? byGroup.set(k, []).get(k)!).push(it); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    for (const [k, items] of byGroup) {
      const [b, st] = k.split('|') as [string, FurnState], g = new THREE.Group(); g.name = `palace-furnishings:${b}:${st}`; g.visible = st === 'stored';
      const acc: Partial<Record<Mat, THREE.BufferGeometry[]>> = {}, owners: Partial<Record<Mat, number[]>> = {};
      items.forEach((it, idx) => { const P = itemGeometry(it); m4.compose(new THREE.Vector3(it.e, it.y, -it.n), q.setFromAxisAngle(up, it.theta), one);
        for (const mat of MATS) for (const geo of P[mat] ?? []) { geo.applyMatrix4(m4); (acc[mat] ??= []).push(geo); const o = (owners[mat] ??= []); for (let t = 0; t < geo.getAttribute('position').count / 3; t++) o.push(idx); } });
      for (const mat of MATS) { const list = acc[mat]; if (!list?.length) continue;
        const geo = mergeGeometries(list)!; for (const x of list) x.dispose(); geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, surfaceMaterial(mat, VC.has(mat) ? { vertexColors: true } : {})); mesh.name = `${g.name}:${mat}`; mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
        const own = owners[mat]!;
        mesh.userData = { tier: 'C', src: 'TREAS-AUD;HDT;PAZYRYK;ASB-GARDEN;ESTHER-1.6;RECON', note: `${b} furnishings, ${st === 'use' ? 'laid out for the court (court setting, in residence)' : 'the court away: stored, covered, the steward\'s minimum'} (D-212, C)`,
          describe: (h: any) => { const it = items[own[h?.faceIndex ?? -1]]; return it ? { tier: 'C', src: 'RECON', note: `${it.kind} in the ${b} ${it.room}: ${it.note}` } : null; } };
        g.add(mesh); this.info.tris[st] += geo.getAttribute('position').count / 3; this.info.meshes[st]++; }
      this.group.add(g); this.groups.set(k, g); this.info.items[st] += items.length;
      const xs = items.map(i => i.e), ys = items.map(i => i.n); this.centres.set(k, [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]);
    }
    for (const st of ['stored', 'use'] as FurnState[]) this.info.colliders[st] = this.colliderBoxes(st).length;
    this.setColliders('stored');
    this.info.buildMs = performance.now() - t0;
  }
  /** the box colliders of a state: every solid piece, the canopy's four posts (world centre, half sizes, rotation) */
  colliderBoxes(state: FurnState): { c: THREE.Vector3; half: THREE.Vector3; rot: number }[] {
    const out: { c: THREE.Vector3; half: THREE.Vector3; rot: number }[] = [], CN = F().canopy;
    for (const it of this.plan) { if (it.state !== state) continue;
      if (it.kind === 'canopy') { for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push({ c: new THREE.Vector3(it.e + sx * CN.w / 2, it.y + CN.h / 2, -(it.n - sz * CN.d / 2)), half: new THREE.Vector3(CN.pole_r, CN.h / 2, CN.pole_r), rot: 0 }); continue; }
      if (!it.solid) continue;
      out.push({ c: new THREE.Vector3(it.e, it.y + it.h / 2, -it.n), half: new THREE.Vector3(it.hu, it.h / 2, it.hv), rot: it.theta }); }
    return out;
  }
  /** discs for the people's walkable grid (grid e, n, radius): the footprints of the solid pieces of the drawn states */
  navDiscs(): [number, number, number][] {
    const out: [number, number, number][] = [], CN = F().canopy;
    for (const it of this.plan) {
      if (it.kind === 'canopy') { for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push([it.e + sx * CN.w / 2, it.n + sz * CN.d / 2, 0.1]); continue; }
      if (!it.solid) continue; const r = Math.min(it.hu, it.hv), L = Math.max(it.hu, it.hv) - r, ux = Math.cos(it.theta), uy = Math.sin(it.theta), along = it.hu >= it.hv;
      for (let s = -L; s <= L + 1e-6; s += Math.max(0.25, L / 3 || 1)) out.push([it.e + (along ? ux : -uy) * s, it.n + (along ? uy : ux) * s, r]); }
    return out;
  }
  private setColliders(state: FurnState) {
    const P = this.opts.phys; if (!P) return;
    for (const c of this.live) P.world.removeCollider(c, false); this.live = [];
    for (const b of this.colliderBoxes(state)) this.live.push(P.addBox({ x: b.c.x, y: b.c.y, z: b.c.z }, { x: b.half.x, y: b.half.y, z: b.half.z }, b.rot));
  }
  /** the court in residence today (court setting only) switches the halls to their use; the far groups are not drawn */
  update(cam: THREE.Vector3, courtHere: boolean) {
    const st: FurnState = this.opts.court && courtHere ? 'use' : 'stored';
    if (st !== this.state) { this.state = st; this.setColliders(st); }
    const cull = F().cull;
    for (const [k, g] of this.groups) { const c = this.centres.get(k)!; g.visible = k.endsWith('|' + st) && Math.hypot(cam.x - c[0], -cam.z - c[1]) < cull; }
  }
  get current() { return this.state; }
  summary() { const s = this.state; return `palace furnishings (D-212, C): ${this.info.items[s]} pieces ${s === 'use' ? 'laid out for the court' : 'stored / in the steward\'s use'}, ${(this.info.tris[s] / 1e3).toFixed(1)} k tris in ${this.info.meshes[s]} meshes, ${this.info.colliders[s]} colliders`; }
}
