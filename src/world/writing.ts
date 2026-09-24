// Writing on objects (Phase 8, D-179; brief §10 "Elamite on clay tablets; Aramaic ink on leather; seal impressions", §1.1
// "specific attested tablets being written and sealed with real, attested seals").
//
// Everything written is IMPRESSED into the clay as relief, not painted: one height field (millimetres) is baked into a
// normal-map atlas that the clay materials sample. What is impressed, and how honest each part is (src/data/writing.json,
// built by tools/build_writing.py):
//  - rolled cylinder-seal impressions: the figures (C reconstructions of attested seal types) and the seal INSCRIPTIONS,
//    whose signs are the published texts' sign sequences (ARIo, CC0), drawn from the Noto font outlines at the font
//    (the language lint captures them there and compares them with the data);
//  - the Treasury tablets' Elamite text: no Persepolis Treasury text is reachable (BLOCKERS B18), so the tablets carry
//    memoranda RECONSTRUCTED by the project on the Treasury tablets' published formulary (writing.json recon_texts, tier C,
//    D-198): every word from the sourced Elamite lexicon, every name from names.json, the signs the words' own ATF → OSL;
//    impressed sign by sign from the same font outlines, sunk into the clay (a stylus impression), and labelled
//    "reconstructed … not a surviving text (C)" in data, the dev overlay (F3) and the translation layer.
// The atlas is baked once, on first use. Without the fonts (node tests that do not load them) no sign is drawn, and every
// object that would carry signs says so (placeholder: true through `describe`).
import * as THREE from 'three/webgpu';
import opentype from 'opentype.js';
import { v } from '../arch/spec';
import { Rng } from '../core/rng';
import writingJson from '../data/writing.json';

/** a Treasury memorandum reconstructed by the project on the published formulary (D-198): NOT a surviving text (C) */
export interface ReconText {
  kind: string; label: string; reconstructed: true; date: { regnal_year: number; king: string; months: number[] | null; bce: string; written: string };
  el_atf: string; lines_atf: string[]; lines_cuneiform: string[]; el_cuneiform: string;
  words: { w: string; kind: 'word' | 'name' | 'numeral'; lex?: string; name?: string; gloss: string; tier: string; src: string[] }[];
  english: string; english_label: string; tier: Record<string, string>; notes: string[]; src: string[];
}
export const WRITING = writingJson as any as {
  texts: Record<string, { ario: string; op_translit: string; op_signs: string[]; op_cuneiform: string; el_atf?: string; el_cuneiform?: string; bab_atf?: string; bab_cuneiform?: string; tier: Record<string, string>; ident: string }>;
  recon_texts: Record<string, ReconText>;
  seals: Record<string, { text: string; tier: string; placeholder: boolean; attested: string; wording: string; design: string; height_mm: number; roll_mm: number; src: string[] }>;
  objects: Record<string, { what: string; text: string | null; recon?: string; reconstructed?: boolean; recon_why?: string; seal?: string | null; placeholder: boolean; placeholder_why?: string; tier: string; src: string[]; [k: string]: unknown }>;
};

// ------------------------------------------------------------------------------------------------ fonts
const fonts: Partial<Record<'op' | 'cun', opentype.Font>> = {};
/** the two period-script fonts the seal inscriptions are drawn from (the same files the carved inscriptions use) */
export async function loadWritingFonts(fetcher: (path: string) => Promise<ArrayBuffer>) {
  for (const [k, f] of [['op', 'NotoSansOldPersian-Regular.ttf'], ['cun', 'NotoSansCuneiform-Regular.ttf']] as const) if (!fonts[k]) fonts[k] = opentype.parse(await fetcher(`fonts/${f}`));
}
export const writingFontsLoaded = () => !!fonts.op && !!fonts.cun;

// ------------------------------------------------------------------------------------------------ the atlas
export const ATLAS = 1024;
export interface Region { x: number; y: number; w: number; h: number; mm: number }
/** atlas regions (pixels) and their scale (mm per pixel). Tablet faces 90 × 65 mm at 0.2 mm/px (the filed tablets'
 *  obverse, the fresh tablets' obverse, the unfinished tablet's obverse; the reverses are uninscribed: plain clay); the
 *  sealed left edge 65 × 25 mm at 0.115 mm/px; the door sealing's face 110 × 80 mm at 0.2 mm/px; a patch of plain clay. */
export const REGIONS = {
  obv_full: { x: 0, y: 0, w: 450, h: 325, mm: 0.2 },
  obv_part: { x: 450, y: 0, w: 450, h: 325, mm: 0.2 },
  obv_fresh: { x: 0, y: 325, w: 450, h: 325, mm: 0.2 },
  edge_seal: { x: 450, y: 325, w: 565, h: 217, mm: 0.115 },
  door_face: { x: 450, y: 542, w: 550, h: 400, mm: 0.2 },
  plain: { x: 0, y: 650, w: 64, h: 64, mm: 0.5 },
} satisfies Record<string, Region>;
export type RegionId = keyof typeof REGIONS;

export interface WritingAtlas {
  texture: THREE.DataTexture; height: Float32Array;
  /** what the bake put into the clay: which texts (seal texts and reconstructed tablet texts, ids) had their signs drawn,
   *  and the signs in drawing order */
  baked: { glyphs: boolean; texts: string[]; signs: string; seals: string[] };
}
let atlas: WritingAtlas | null = null;
export function writingAtlas(force = false): WritingAtlas {
  if (atlas && !force && (atlas.baked.glyphs || !writingFontsLoaded())) return atlas;
  const height = atlas?.height ?? new Float32Array(ATLAS * ATLAS);
  height.fill(0);
  const baked: WritingAtlas['baked'] = { glyphs: writingFontsLoaded(), texts: [], signs: '', seals: [] };
  bake(height, baked);
  const data = atlas?.texture.image.data as Uint8Array | undefined ?? new Uint8Array(ATLAS * ATLAS * 4);
  for (let k = 0; k < data.length; k += 4) { data[k] = 128; data[k + 1] = 128; data[k + 2] = 255; data[k + 3] = 255; } // flat outside the regions (the mips blend across their borders)
  for (const r of Object.values(REGIONS)) normals(height, data, r);
  if (atlas) { atlas.baked = baked; atlas.texture.needsUpdate = true; return atlas; }
  const texture = new THREE.DataTexture(data, ATLAS, ATLAS, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.NoColorSpace; texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4; texture.name = 'writing-atlas'; texture.needsUpdate = true;
  atlas = { texture, height, baked };
  return atlas;
}
/** bake again now (tests: to capture the signs drawn at the font; the texture object is kept) */
export const rebakeWritingAtlas = (): WritingAtlas => writingAtlas(true);
/** a clay material whose relief is the atlas (normal map; the colour is the clay's, never the writing's) */
export function clayMaterial(rgb: [number, number, number], roughness: number): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(...rgb, THREE.SRGBColorSpace), roughness, metalness: 0 });
  m.normalMap = writingAtlas().texture; m.name = 'clay-writing';
  return m;
}

// ------------------------------------------------------------------------------------------------ height-field tools
type Pt = [number, number];
/** add `f(u, t)` (mm) over a region's pixels inside a bounding box (region mm) */
function paintField(H: Float32Array, r: Region, box: [number, number, number, number] | null, f: (u: number, t: number) => number, mode: 'add' | 'max' | 'min' = 'add') {
  const [u0, t0, u1, t1] = box ?? [0, 0, r.w * r.mm, r.h * r.mm];
  const x0 = Math.max(0, Math.floor(u0 / r.mm)), x1 = Math.min(r.w - 1, Math.ceil(u1 / r.mm)), y0 = Math.max(0, Math.floor(t0 / r.mm)), y1 = Math.min(r.h - 1, Math.ceil(t1 / r.mm));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const val = f((x + 0.5) * r.mm, (y + 0.5) * r.mm), k = (r.y + y) * ATLAS + r.x + x;
    if (mode === 'add') H[k] += val; else if (mode === 'max') H[k] = Math.max(H[k], val); else H[k] = Math.min(H[k], val);
  }
}
/** coverage (0..1) of polygons (non-zero winding) on a region-sized grid, 4 sub-rows per pixel, exact spans across */
function coverage(r: Region, polys: Pt[][], box: [number, number, number, number]): { mask: Float32Array; x0: number; y0: number; w: number; h: number } {
  const x0 = Math.max(0, Math.floor(box[0] / r.mm) - 3), y0 = Math.max(0, Math.floor(box[1] / r.mm) - 3);
  const w = Math.min(r.w, Math.ceil(box[2] / r.mm) + 4) - x0, h = Math.min(r.h, Math.ceil(box[3] / r.mm) + 4) - y0;
  const mask = new Float32Array(Math.max(0, w) * Math.max(0, h)); if (w <= 0 || h <= 0) return { mask, x0, y0, w: 0, h: 0 };
  const edges: [number, number, number, number][] = [];
  for (const p of polys) for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if (a[1] !== b[1]) edges.push([a[0] / r.mm - x0, a[1] / r.mm - y0, b[0] / r.mm - x0, b[1] / r.mm - y0]); }
  const SUB = 4, xs: [number, number][] = [], rows: number[][] = Array.from({ length: h }, () => []);
  edges.forEach(([, ay, , by], i) => { for (let y = Math.max(0, Math.floor(Math.min(ay, by))); y <= Math.min(h - 1, Math.floor(Math.max(ay, by))); y++) rows[y].push(i); });
  for (let y = 0; y < h; y++) for (let s = 0; s < SUB; s++) {
    const sy = y + (s + 0.5) / SUB; xs.length = 0;
    for (const i of rows[y]) { const [ax, ay, bx, by] = edges[i]; if ((sy >= ay) === (sy >= by)) continue; xs.push([ax + ((sy - ay) / (by - ay)) * (bx - ax), by > ay ? 1 : -1]); }
    if (!xs.length) continue; xs.sort((p, q) => p[0] - q[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1]; if (wind === 0) continue;
      const a = Math.max(0, xs[i][0]), b = Math.min(w, xs[i + 1][0]); if (b <= a) continue;
      for (let x = Math.floor(a); x < Math.ceil(b); x++) mask[y * w + x] += (Math.min(b, x + 1) - Math.max(a, x)) / SUB;
    }
  }
  return { mask, x0, y0, w, h };
}
/** two box blurs of radius rad (pixels) */
function blur(m: Float32Array, w: number, h: number, rad: number) {
  const t = new Float32Array(m.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let d = -rad; d <= rad; d++) { const xx = x + d; if (xx >= 0 && xx < w) { s += m[y * w + xx]; n++; } } t[y * w + x] = s / n; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let d = -rad; d <= rad; d++) { const yy = y + d; if (yy >= 0 && yy < h) { s += t[yy * w + x]; n++; } } m[y * w + x] = s / n; }
  }
}
/** glyph outlines of `text` laid out in lines inside [u0, u0 + width] from baseline t0, glyphs glyphH mm tall; each
 *  version starts a new line. Returns polygons (mm) and the characters drawn (in order: what the lint compares) */
function glyphPolys(fontKey: 'op' | 'cun', text: string, u0: number, t0: number, width: number, glyphH: number, lineGap: number): { polys: Pt[][]; drawn: string; bottom: number } {
  const font = fonts[fontKey]!, upm = font.unitsPerEm, sc = (glyphH / upm) * 1.25, polys: Pt[][] = [];
  let x = 0, base = t0, drawn = '';
  for (const ch of [...text]) {
    if (ch === ' ') { x += (font.glyphs.get(font.charToGlyphIndex(ch)).advanceWidth ?? upm) * sc * 0.5; continue; } // a word space: no glyph drawn
    const g = font.charToGlyph(ch), adv = (g.advanceWidth ?? upm) * sc;
    if (x + adv > width && x > 0) { x = 0; base += glyphH + lineGap; }
    drawn += ch;
    const path = g.getPath(0, 0, upm); let cur: Pt[] | null = null; let px = 0, py = 0;
    const P = (gx: number, gy: number): Pt => [u0 + x + gx * sc, base + gy * sc];
    for (const c of path.commands as any[]) {
      if (c.type === 'M') { cur = [P(c.x, c.y)]; polys.push(cur); px = c.x; py = c.y; }
      else if (c.type === 'L') { cur!.push(P(c.x, c.y)); px = c.x; py = c.y; }
      else if (c.type === 'Q') { for (let i = 1; i <= 4; i++) { const s = i / 4, a = (1 - s) ** 2, b = 2 * (1 - s) * s, d = s * s; cur!.push(P(a * px + b * c.x1 + d * c.x, a * py + b * c.y1 + d * c.y)); } px = c.x; py = c.y; }
      else if (c.type === 'C') { for (let i = 1; i <= 6; i++) { const s = i / 6, a = (1 - s) ** 3, b = 3 * (1 - s) ** 2 * s, e = 3 * (1 - s) * s * s, d = s ** 3; cur!.push(P(a * px + b * c.x1 + e * c.x2 + d * c.x, a * py + b * c.y1 + e * c.y2 + d * c.y)); } px = c.x; py = c.y; }
    }
    x += adv;
  }
  return { polys, drawn, bottom: base + lineGap };
}
/** the largest sign height (mm, ≤ 2.4) at which the versions fit a panel, measured from the fonts' advance widths without
 *  drawing (charToGlyphIndex: the glyphs drawn are then exactly the text's signs, once) */
function fitGlyphs(groups: { key: 'op' | 'cun'; text: string }[], width: number, height: number): number {
  for (let gh = 2.4; gh > 0.8; gh -= 0.05) {
    let lines = 0;
    for (const g of groups) {
      const f = fonts[g.key]!, sc = (gh / f.unitsPerEm) * 1.25; let x = 0; lines++;
      for (const ch of [...g.text]) { const adv = (f.glyphs.get(f.charToGlyphIndex(ch)).advanceWidth ?? f.unitsPerEm) * sc; if (ch === ' ') { x += adv * 0.5; continue; } if (x + adv > width && x > 0) { x = 0; lines++; } x += adv; }
    }
    if (lines * gh * 1.3 + gh * 0.3 * (groups.length - 1) <= height) return gh;
  }
  return 0.8;
}
/** raise (sign > 0) or sink (sign < 0) polygons into the field with a rounded profile of `depth` mm */
function reliefPolys(H: Float32Array, r: Region, polys: Pt[][], depth: number, soft: number, clip?: [number, number, number, number]) {
  if (!polys.length) return;
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
  const cv = coverage(r, polys, [bx0, by0, bx1, by1]); if (!cv.w) return;
  blur(cv.mask, cv.w, cv.h, Math.max(1, Math.round(soft / r.mm)));
  for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) {
    const X = cv.x0 + x, Y = cv.y0 + y; if (X >= r.w || Y >= r.h) continue;
    if (clip && ((X + 0.5) * r.mm < clip[0] || (X + 0.5) * r.mm > clip[2] || (Y + 0.5) * r.mm < clip[1] || (Y + 0.5) * r.mm > clip[3])) continue;
    const c = Math.min(1, cv.mask[y * cv.w + x] * 1.8); if (c > 0) H[(r.y + Y) * ATLAS + r.x + X] += depth * Math.sqrt(c);
  }
}

// ------------------------------------------------------------------------------------------------ the tablets' text
/** the Treasury memorandum `id` (writing.json recon_texts, RECONSTRUCTED, C: D-198) impressed into a tablet face: its
 *  scribal lines as in the data, the signs the font's outlines sunk into the clay (a stylus impression leaves the wedge
 *  as a hollow), no word spaces (C), one sign height for the whole text, the largest ≤ 4 mm at which the longest line
 *  fits between the margins (Achaemenid Elamite tablets, sign height c. 3-4 mm: C). Draws nothing without the fonts. */
function impressTablet(H: Float32Array, r: Region, id: string, baked: WritingAtlas['baked']) {
  const T = WRITING.recon_texts[id]; if (!T || !writingFontsLoaded()) return;
  const Wmm = r.w * r.mm, Hmm = r.h * r.mm, left = 5.2, right = 3.2, top = 4.4, font = fonts.cun!;
  const lineWidth = (line: string, gh: number) => { const sc = (gh / font.unitsPerEm) * 1.25; return [...line].reduce((w, ch) => w + (font.glyphs.get(font.charToGlyphIndex(ch)).advanceWidth ?? font.unitsPerEm) * sc, 0); };
  let gh = 4.0; while (gh > 1.6 && (T.lines_cuneiform.some(l => lineWidth(l, gh) > Wmm - left - right) || top + T.lines_cuneiform.length * gh * 1.4 > Hmm - 3)) gh -= 0.05;
  const polys: Pt[][] = []; let base = top + gh;
  for (const line of T.lines_cuneiform) { const lay = glyphPolys('cun', line, left, base, Wmm - left - right + 1e-3, gh, 0); polys.push(...lay.polys); baked.signs += lay.drawn; base = lay.bottom + gh * 1.4; } // (a line too long for the face would wrap: it never is, measured in the tests)
  reliefPolys(H, r, polys, -0.5, 0.1);
  if (!baked.texts.includes(id)) baked.texts.push(id);
}
// ------------------------------------------------------------------------------------------------ seals
/** signed distances (mm) of simple shapes for the seal figures */
const sdCircle = (x: number, y: number, cx: number, cy: number, rr: number) => Math.hypot(x - cx, y - cy) - rr;
const sdEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, rot = 0) => { const c = Math.cos(rot), s = Math.sin(rot), dx = x - cx, dy = y - cy, a = dx * c + dy * s, b = -dx * s + dy * c; const k = Math.hypot(a / rx, b / ry); return (k - 1) * Math.min(rx, ry); };
const sdSeg = (x: number, y: number, ax: number, ay: number, bx: number, by: number, r0: number, r1 = r0) => { const px = x - ax, py = y - ay, vx = bx - ax, vy = by - ay, h = Math.max(0, Math.min(1, (px * vx + py * vy) / (vx * vx + vy * vy))); return Math.hypot(px - vx * h, py - vy * h) - (r0 + (r1 - r0) * h); };
const sdTrap = (x: number, y: number, cx: number, y0: number, y1: number, w0: number, w1: number) => { if (y < y0 || y > y1) return Math.max(y0 - y, y - y1); const hw = w0 + ((y - y0) / (y1 - y0)) * (w1 - w0); return Math.abs(x - cx) - hw / 2; };
/** the royal hero (C: a crowned figure in the long court robe, arms outstretched), at x = cx, standing on y = 0 (y up, mm) */
function sdHero(x: number, y: number, cx: number, armsTo: [number, number][]) {
  let d = sdTrap(x, y, cx, 0.6, 9.5, 7.2, 3.6); // robe
  d = Math.min(d, sdTrap(x, y, cx, 9.3, 14.2, 3.6, 4.4)); // torso
  d = Math.min(d, sdCircle(x, y, cx + 0.2, 15.6, 1.35)); // head
  d = Math.min(d, sdEllipse(x, y, cx + 1.0, 14.6, 0.75, 1.3, 0.2)); // beard
  d = Math.min(d, sdTrap(x, y, cx + 0.1, 16.3, 18.6, 2.6, 3.0)); // crown (dentate crown C)
  for (const [hx, hy] of armsTo) d = Math.min(d, sdSeg(x, y, cx + Math.sign(hx - cx) * 1.6, 13.4, hx, hy, 0.62, 0.5));
  return d;
}
/** a rampant lion facing the hero (dir = −1 faces −x), body centre at (cx, 0) on the ground line */
function sdLion(x: number, y: number, cx: number, dir: number) {
  let d = sdEllipse(x, y, cx, 8.4, 2.1, 5.2, -dir * 0.32); // body, reared up
  d = Math.min(d, sdCircle(x, y, cx + dir * 1.8, 13.9, 2.3)); // mane
  d = Math.min(d, sdEllipse(x, y, cx + dir * 3.1, 14.6, 1.6, 1.1, 0.2 * dir)); // muzzle
  d = Math.min(d, sdSeg(x, y, cx + dir * 0.6, 4.6, cx + dir * 1.6, 0.8, 0.8, 0.55), sdSeg(x, y, cx - dir * 1.1, 4.8, cx - dir * 1.8, 0.8, 0.8, 0.55)); // hind legs
  d = Math.min(d, sdSeg(x, y, cx + dir * 1.2, 11.4, cx + dir * 4.2, 12.6, 0.62, 0.45)); // foreleg toward the hero
  d = Math.min(d, sdSeg(x, y, cx - dir * 1.6, 5.2, cx - dir * 3.6, 8.2, 0.35), sdSeg(x, y, cx - dir * 3.6, 8.2, cx - dir * 3.1, 11.2, 0.35, 0.5)); // tail
  return d;
}
/** a seal's design (one turn of the cylinder), as a raised height (mm) at (x along the roll, y up) plus its inscription
 *  polygons: the figures (C) and a framed panel holding the text of `seal.text` (data), one version per line group */
function sealDesign(id: string, baked: WritingAtlas['baked']): { relief: (x: number, y: number) => number; panel: [number, number, number, number]; glyphs: { key: 'op' | 'cun'; text: string; }[] } {
  const S = WRITING.seals[id], T = WRITING.texts[S.text], Hh = S.height_mm, L = S.roll_mm;
  const royalDarius = id === 'PTS-treasurer-Darius';
  const panel: [number, number, number, number] = royalDarius ? [L - 21.5, 3.2, L - 1.8, Hh - 3.0] : [L - 17.5, 5.5, L - 2.0, Hh - 5.0];
  const relief = (x: number, y: number) => {
    let d: number;
    if (royalDarius) { const cx = 17; d = Math.min(sdHero(x, y, cx, [[cx - 5.6, 12.8], [cx + 5.6, 12.8]]), sdLion(x, y, cx - 9.3, 1), sdLion(x, y, cx + 9.3, -1)); }
    else { const cx = 12; d = Math.min(sdHero(x, y, cx, [[cx + 5.2, 13.6], [cx - 4.8, 16.8]]), sdSeg(x, y, cx - 4.8, 16.8, cx - 3.2, 19.6, 0.28), sdLion(x, y, cx + 9.2, -1)); }
    let h = d < 0 ? 0.42 * Math.sqrt(Math.min(1, -d / 0.9)) : 0;
    const g = Math.abs(y - 0.3) - 0.28; if (g < 0 && x < panel[0] - 0.8) h = Math.max(h, 0.3 * Math.min(1, -g / 0.2)); // ground line
    const [px0, py0, px1, py1] = panel, fr = Math.min(Math.abs(x - px0), Math.abs(x - px1), Math.abs(y - py0), Math.abs(y - py1)) - 0.22;
    if (fr < 0 && x > px0 - 0.3 && x < px1 + 0.3 && y > py0 - 0.3 && y < py1 + 0.3) h = Math.max(h, 0.28 * Math.min(1, -fr / 0.15)); // panel frame
    return h;
  };
  const glyphs: { key: 'op' | 'cun'; text: string }[] = [{ key: 'op', text: T.op_cuneiform }];
  if (T.el_cuneiform) glyphs.push({ key: 'cun', text: T.el_cuneiform });
  if (T.bab_cuneiform) glyphs.push({ key: 'cun', text: T.bab_cuneiform });
  void baked;
  return { relief, panel, glyphs };
}
/** roll a seal across a band of a region: the band is pressed down (the cylinder's surface), the design and the signs
 *  stand up in it. The band runs along u from u0 for `len` mm, t from t0 for the seal's height; phase = where the turn
 *  starts (mm). Draws the inscription once per turn that falls inside. */
function rollSeal(H: Float32Array, r: Region, id: string, u0: number, t0: number, len: number, phase: number, baked: WritingAtlas['baked'], press = 0.55) {
  const S = WRITING.seals[id], Hh = S.height_mm, L = S.roll_mm, D = sealDesign(id, baked);
  const band: [number, number, number, number] = [u0, t0, u0 + len, t0 + Hh];
  // the pressed band with soft shoulders, and the design raised in it (y up = −t)
  paintField(H, r, [u0 - 1.5, t0 - 1.5, u0 + len + 1.5, t0 + Hh + 1.5], (u, t) => {
    const du = Math.max(u0 - u, u - (u0 + len), 0), dt = Math.max(t0 - t, t - (t0 + Hh), 0), out = Math.hypot(du, dt);
    if (out > 0) return out < 1.2 ? 0.12 * Math.sin((out / 1.2) * Math.PI) : 0; // the clay pushed up at the band's edges
    const x = (((u - u0 + phase) % L) + L) % L, y = t0 + Hh - t;
    return -press + D.relief(x, y);
  });
  if (!writingFontsLoaded()) return;
  // the inscription: signs raised in the panel of every turn inside the band
  for (let k = -1; k * L - phase < len; k++) {
    const pu = u0 + k * L - phase + D.panel[0], pw = D.panel[2] - D.panel[0], ph = D.panel[3] - D.panel[1];
    if (pu + pw < u0 || pu > u0 + len) continue;
    const glyphH = fitGlyphs(D.glyphs, pw - 1.4, ph - 1.2), gap = glyphH * 0.3, polys: Pt[][] = []; let base = t0 + Hh - D.panel[3] + 0.6 + glyphH;
    for (const g of D.glyphs) { const lay = glyphPolys(g.key, g.text, pu + 0.7, base, pw - 1.4, glyphH, gap); polys.push(...lay.polys); base = lay.bottom + glyphH; baked.signs += lay.drawn; }
    reliefPolys(H, r, polys, press * 0.62, 0.12, band);
  }
  if (!baked.texts.includes(S.text)) baked.texts.push(S.text);
  if (!baked.seals.includes(id)) baked.seals.push(id);
}

// ------------------------------------------------------------------------------------------------ the bake
function bake(H: Float32Array, baked: WritingAtlas['baked']) {
  const rng = new Rng(19, 'writing-atlas'); // Xerxes year 19
  const grain = (r: Region, amp: number) => { const g = new Rng(r.x * 7 + r.y, 'clay-grain'); paintField(H, r, null, () => amp * (g.next() - 0.5)); };
  const smooth = (r: Region) => { // fingers' smoothing: low undulation of the surface (C)
    const k = [rng.range(0.05, 0.12), rng.range(0.05, 0.12), rng.range(0, 6), rng.range(0, 6)];
    paintField(H, r, null, (u, t) => 0.05 * Math.sin(u * k[0] + k[2]) * Math.cos(t * k[1] + k[3])); };
  const R = REGIONS;
  // the tablets' obverses: the reconstructed memoranda (C, D-198) of the filed tablets, the fresh ones and the one being
  // written (four lines so far); the reverses are uninscribed (plain clay: the memoranda fit the obverse, C); the cord hole
  // at the upper left corner (B)
  impressTablet(H, R.obv_full, (WRITING.objects.pt_letter.recon as string), baked);
  impressTablet(H, R.obv_fresh, (WRITING.objects.pt_letter_fresh.recon as string), baked);
  impressTablet(H, R.obv_part, (WRITING.objects.pt_letter_unfinished.recon as string), baked);
  for (const r of [R.obv_full, R.obv_fresh, R.obv_part]) paintField(H, r, [0.8, 0.8, 5, 5], (u, t) => { const d = Math.hypot(u - 2.6, t - 2.6); return d < 1.05 ? -1.4 * Math.sqrt(1 - (d / 1.05) ** 2) : 0; }); // the cord hole
  // the left edge: the treasurer's seal rolled over its whole length (C: sealed on the left edge, SITE_SPEC)
  rollSeal(H, R.edge_seal, 'PTS-treasurer-Darius', 0.8, 0, R.edge_seal.w * R.edge_seal.mm - 1.6, 9, baked);
  // the door sealing's face: the Xerxes hero seal rolled once across the middle of the lump (C)
  const df = R.door_face, S2 = WRITING.seals['PTS-Xerxes-hero'];
  rollSeal(H, df, 'PTS-Xerxes-hero', (df.w * df.mm - S2.roll_mm * 1.1) / 2, (df.h * df.mm - S2.height_mm) / 2, S2.roll_mm * 1.1, 4, baked, 0.7);
  paintField(H, df, null, (u, t) => { const x = u / (df.w * df.mm) - 0.5, y = t / (df.h * df.mm) - 0.5; return 0.35 * Math.cos(x * 5) * Math.cos(y * 4) + 0.05 * Math.sin(u * 0.31 + t * 0.17) * Math.cos(u * 0.13 - t * 0.29); }); // the lump's thumb-pressed surface (C)
  for (const r of Object.values(R)) { smooth(r); grain(r, 0.012); }
}
/** tangent-space normals (x = +u, y = +t) of a region from the height field and its mm per pixel */
function normals(H: Float32Array, out: Uint8Array, r: Region) {
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const row = (r.y + y) * ATLAS + r.x, up = (r.y + Math.max(0, y - 1)) * ATLAS + r.x, dn = (r.y + Math.min(r.h - 1, y + 1)) * ATLAS + r.x;
    const dx = (H[row + Math.min(r.w - 1, x + 1)] - H[row + Math.max(0, x - 1)]) / (2 * r.mm), dy = (H[dn + x] - H[up + x]) / (2 * r.mm), l = Math.sqrt(dx * dx + dy * dy + 1);
    const k = ((r.y + y) * ATLAS + r.x + x) * 4;
    out[k] = Math.round((-dx / l * 0.5 + 0.5) * 255); out[k + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255); out[k + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); out[k + 3] = 255;
  }
}
/** relief statistics of a region (for tests and the honesty checks): RMS height (mm) inside a sub-box */
export function reliefRms(id: RegionId, box?: [number, number, number, number]): number {
  const r = REGIONS[id], H = writingAtlas().height; const [u0, t0, u1, t1] = box ?? [0, 0, r.w * r.mm, r.h * r.mm];
  let s = 0, s2 = 0, n = 0;
  for (let y = Math.floor(t0 / r.mm); y < Math.min(r.h, t1 / r.mm); y++) for (let x = Math.floor(u0 / r.mm); x < Math.min(r.w, u1 / r.mm); x++) { const h = H[(r.y + y) * ATLAS + r.x + x]; s += h; s2 += h * h; n++; }
  return n ? Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) : 0;
}

// ------------------------------------------------------------------------------------------------ geometry
const uvRect = (id: RegionId, s: number, t: number): [number, number] => { const r = REGIONS[id]; return [(r.x + Math.min(1, Math.max(0, s)) * r.w) / ATLAS, (r.y + Math.min(1, Math.max(0, t)) * r.h) / ATLAS]; };
/** tablet dimensions (m): width along the lines, height across them, thickness (SITE_SPEC treasury.r_scribes_room.tablet, C) */
export const tabletSize = () => v<any>('treasury', 'r_scribes_room').tablet as [number, number, number];
/** a PT tablet (x = width, z = height, y = thickness), pillowed faces and rounded edges; UVs into the atlas: +y the
 *  obverse (the filed tablets' text, the fresh tablets' text, or the unfinished tablet's four lines), −y the reverse
 *  (uninscribed: plain clay), −x the sealed left edge (not on the unfinished tablet), the other edges plain clay.
 *  `lod` 0: close view (the drying board, 464 triangles); 1: the filed rows (76); 2: the carried prop (12, a plain block with rounded edges, no UVs needed). */
export function ptTabletGeometry(variant: 'full' | 'fresh' | 'part' = 'full', lod: 0 | 1 | 2 = 0): THREE.BufferGeometry {
  const [tw, th, tt] = tabletSize(), seg = [[10, 2, 8], [4, 1, 3], [1, 1, 1]][lod];
  const g = new THREE.BoxGeometry(tw, tt, th, seg[0], seg[1], seg[2]);
  const p = g.getAttribute('position') as THREE.BufferAttribute, uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const groups = g.groups; // +x, −x, +y, −y, +z, −z
  for (let gi = 0; gi < groups.length; gi++) for (let i = groups[gi].start; i < groups[gi].start + groups[gi].count; i++) {
    const vi = (g.index!.array as ArrayLike<number>)[i], x = p.getX(vi), y = p.getY(vi), z = p.getZ(vi);
    const s = x / tw + 0.5, t = z / th + 0.5, e = y / tt + 0.5;
    const obv: RegionId = variant === 'full' ? 'obv_full' : variant === 'fresh' ? 'obv_fresh' : 'obv_part';
    const [a, b] = gi === 2 ? uvRect(obv, s, t) : gi === 3 ? uvRect('plain', 1 - s, t) : gi === 1 && variant !== 'part' ? uvRect('edge_seal', t, 1 - e) : uvRect('plain', (gi === 0 ? t : s) * 0.9 + 0.05, e * 0.9 + 0.05);
    uv.setXY(vi, a, b);
  }
  for (let i = 0; i < p.count; i++) { // pillow the faces and round the edges (C)
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i), qx = (2 * x) / tw, qz = (2 * z) / th;
    p.setY(i, y * (1 - 0.3 * (qx * qx + qz * qz) / 2));
    const k = 1 - 0.06 * Math.abs(y / (tt / 2)) ** 3; p.setX(i, x * k); p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}
/** the clay sealing over a door's cord: a lump flattened on its face where the seal was rolled (local +z = out of the
 *  door); size [w, h, d] m (SITE_SPEC global.r_door_sealing.lump). UVs of the front half into the door_face region. */
export function sealingLumpGeometry(size: [number, number, number]): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 20, 14), p = g.getAttribute('position') as THREE.BufferAttribute, uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const [w, h, d] = size, face = REGIONS.door_face, fw = face.w * face.mm / 1000, fh = face.h * face.mm / 1000;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * w / 2, y = p.getY(i) * h / 2, z = p.getZ(i) * d / 2;
    if (z > d * 0.28) z = d * 0.28 + (z - d * 0.28) * 0.25; // the face flattened by the rolling
    if (z < 0) z *= 0.35; // the back pressed flat against the leaves
    p.setXYZ(i, x, y, z);
    const [a, b] = z > 0 ? uvRect('door_face', x / fw + 0.5, 0.5 - y / fh) : uvRect('plain', 0.5 + x / w * 0.8, 0.5 + y / h * 0.8);
    uv.setXY(i, a, b);
  }
  g.computeVertexNormals();
  return g;
}
/** a small bulla on a scroll's tie: a lump with a partial roll (uses part of the tablets' sealed-edge region) */
export function bullaGeometry(r: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 14, 10), p = g.getAttribute('position') as THREE.BufferAttribute, uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * r, yy = p.getY(i) * r * 0.45, z = p.getZ(i) * r * 0.8; p.setXYZ(i, x, yy + r * 0.45, z);
    const [a, b] = yy > 0 ? uvRect('edge_seal', 0.35 + x / (r * 2) * 0.4, 0.5 + z / (r * 2) * 0.8) : uvRect('plain', 0.5 + x / r * 0.4, 0.5 + z / r * 0.4);
    uv.setXY(i, a, b);
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------------------------------------ dev overlay
/** the dev overlay's record for a written object (writing.json objects.<id>): tier, text id, seal and sources; a
 *  reconstructed text (the Treasury memoranda, C, D-198) says so in every record ("RECONSTRUCTED … not a surviving text");
 *  placeholder when the object's text is not there to see: a placeholder text, or signs (the tablet's text, the seal's
 *  inscription) that the bake did not impress (no fonts). `unsealed`: an object of the type not sealed yet */
export function writtenMeta(id: string, what: string, opts: { unsealed?: boolean } = {}): Record<string, unknown> {
  const O = WRITING.objects[id], seal = O.seal && !opts.unsealed ? WRITING.seals[O.seal] : null, R = O.recon ? WRITING.recon_texts[O.recon] : null;
  const base = { tier: O.tier, src: O.src.join(';'), writing: id, text: O.text ?? O.recon ?? '—', seal: (seal && O.seal) || '—', reconstructed: !!R };
  const reconNote = (impressed: boolean) => R ? `RECONSTRUCTED TEXT ${O.recon} (${R.label}; ${R.date.king} year ${R.date.regnal_year}${R.date.months ? `, month${R.date.months.length > 1 ? 's' : ''} ${R.date.months.join(' and ')}` : ', undated so far'}): ${impressed ? 'impressed' : 'NOT impressed (fonts not loaded)'}. ${O.recon_why ?? ''} ` : '';
  return { ...base, placeholder: O.placeholder || ((!!seal || !!R) && !writingFontsLoaded()),
    note: `${what ? what + ': ' : ''}${O.what}${O.placeholder ? ' [placeholder text, B18]' : R ? ` [RECONSTRUCTED text ${O.recon}, C: not a surviving text, D-198]` : ''} (whether the signs are impressed: the live record, F3)`,
    describe: () => { const baked = writingAtlas().baked, sealOk = !seal || baked.texts.includes(seal.text), textOk = !R || baked.texts.includes(O.recon!);
      return { placeholder: O.placeholder || !sealOk || !textOk, reconstructed: !!R,
        note: `${what ? what + ': ' : ''}${O.what}. ${O.placeholder ? `PLACEHOLDER TEXT: ${O.placeholder_why} ` : R ? reconNote(textOk) : O.text ? `Text ${O.text} (ARIo ${WRITING.texts[O.text].ario}). ` : `${String(O.why_no_text ?? '')} `}${seal ? `Seal ${O.seal} (${seal.tier}): inscription ${seal.text} (ARIo ${WRITING.texts[seal.text].ario}) ${sealOk ? 'impressed' : 'NOT impressed (fonts not loaded)'}; design C.` : ''}` }; } };
}
