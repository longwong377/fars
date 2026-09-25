// D-214 (gap audit items 27 and 28): where the royal inscriptions' remaining copies stand, as data for the carving
// (decor.ts): XPc on the Tachara's portico antae, XPd on the Hadish N portico's antae, XPj and XPm round the drums of the
// Hadish N portico's column bases, XPg on a plaque beside the Apadana's N doorway. Every size and place is a SITE_SPEC row
// (tachara.r_anta_inscription, hadish.r_anta_inscription, hadish.r_base_inscriptions, apadana.r_xpg_plaque), tier C; the
// garment lines (DPb, XPk) are placed with their king figures (relief_programmes.ts, global.r_garment_inscription).
import { v, present } from './spec';
import type { Part, Box, Column, Pt, Manifest } from './parts';
import sculpture from '../data/sculpture.json';

/** a stone the text is carved on that is not an architecture part (so the parts, the walkable-grid file and the probes are
 *  unchanged): a casing on a wall end or a free-standing pier; `solid` pieces get a collider and block the people's grid */
export interface StonePiece { id: string; c: Pt; size: [number, number]; y0: number; y1: number; material: string; solid: boolean; note: string }
/** a flat carved field on a stone piece's face (decor.ts carveField, snap off) */
export interface FlatField { id: string; versions: ('op' | 'el' | 'bab')[]; arrangement: 'stack' | 'columns'; origin: Pt; along: Pt; normal: Pt; yTop: number; width: number; height: number; glyphMax: number; surface: string; where: string; tier: string }
const rightOf = (n: Pt): Pt => [-n[1], n[0]];

/** XPc on the Tachara's portico antae and XPd on the Hadish N portico's antae: the stones and the fields */
export function antaPlan(manifest: Manifest): { stones: StonePiece[]; fields: FlatField[] } {
  const stones: StonePiece[] = [], fields: FlatField[] = [];
  if (present('tachara') && manifest.tachara) {
    const A = v<any>('tachara', 'r_anta_inscription'), floor = Number((manifest.tachara as any).floor), H = v<number>('tachara', 'column_height');
    const walls = (v<any[]>('tachara', 'plan_walls')).filter(w => A.walls.includes(w.id));
    const midX = walls.reduce((s, w) => s + (w.x[0] + w.x[1]) / 2, 0) / walls.length; // the portico lies between the two
    for (const w of walls) {
      const [x0, x1] = w.x as number[], front = Math.min(...(w.y as number[])), inner = (x0 + x1) / 2 < midX ? 1 : -1; // +1: the portico is to grid east
      const c: Pt = [(x0 + x1) / 2, front - A.proud + (A.length + A.proud) / 2], size: [number, number] = [x1 - x0 + 2 * A.proud, A.length + A.proud];
      const side = inner > 0 ? 'W' : 'E';
      stones.push({ id: `tachara-anta-${side}`, c, size, y0: floor, y1: floor + H, material: A.stone, solid: false,
        note: `the ${side} anta of the Tachara's S portico: the S end of the portico's ${side} wall cased in the dark stone of the frames, ${A.length} m back from the front and to the columns' height (C; D-214, tachara.r_anta_inscription)` });
      const n: Pt = [inner, 0], faceX = inner > 0 ? x1 + A.proud : x0 - A.proud;
      fields.push({ id: A.inscription, versions: A.versions, arrangement: A.arrangement, origin: [faceX, c[1]], along: rightOf(n), normal: n, yTop: floor + A.field_top,
        width: size[1] - 2 * A.margin, height: A.field_top - A.field_bottom, glyphMax: A.glyph_max, surface: A.stone,
        where: `the ${side === 'E' ? 'eastern' : 'western'} anta of the Tachara's S portico, the face turned to the portico, the three versions stacked`, tier: 'B (the pillars of the S portico) / C (the face, the field, the stacking)' });
    }
  }
  if (present('hadish') && manifest.hadish) {
    const A = v<any>('hadish', 'r_anta_inscription'), floor = Number((manifest.hadish as any).floor), H = v<number>('hadish', 'column_height');
    const midX = (A.piers as Pt[]).reduce((s, p) => s + p[0], 0) / A.piers.length;
    for (const p of A.piers as Pt[]) {
      const inner = p[0] < midX ? 1 : -1, side = inner > 0 ? 'W' : 'E', n: Pt = [inner, 0], s = A.size as number;
      stones.push({ id: `hadish-anta-${side}`, c: [p[0], p[1]], size: [s, s], y0: floor, y1: floor + H, material: A.stone, solid: true,
        note: `the ${side} anta of the Hadish N portico: a free-standing stone pier in line with the hall's ${side} wall and the portico's front row, to the columns' height (C; the model has no portico side walls; D-214, hadish.r_anta_inscription)` });
      fields.push({ id: A.inscription, versions: A.versions, arrangement: A.arrangement, origin: [p[0] + inner * s / 2, p[1]], along: rightOf(n), normal: n, yTop: floor + A.field_top,
        width: s - 2 * A.margin, height: A.field_top - A.field_bottom, glyphMax: A.glyph_max, surface: A.stone,
        where: `the ${side === 'E' ? 'eastern' : 'western'} anta of the Hadish N portico, the face turned to the portico, the three versions stacked`, tier: 'B (the two pillars of the N portico) / C (the pier, the face, the field, the stacking)' });
    }
  }
  return { stones, fields };
}

/** a text carved round a column base's drum: the column's axis (grid), its foot height, the drum's radius at its foot and
 *  at its top and its height (the lathe of sculpt.ts: sculpture.json base.plain, SITE_SPEC r_column_proportions.plain_base) */
export interface RingField { id: string; versions: ('op' | 'el' | 'bab')[]; c: Pt; y0: number; r0: number; r1: number; hd: number; bandBottom: number; bandTop: number; facing: Pt; glyphMax: number; where: string; tier: string }
export function baseRingPlan(parts: Part[]): RingField[] {
  if (!present('hadish')) return [];
  const R = v<any>('hadish', 'r_base_inscriptions'), pb = (v<any>('global', 'r_column_proportions').plain_base) as number[], drumH = (sculpture as any).base.plain.v.drum_h as number;
  const out: RingField[] = [];
  for (const [id, rowY] of Object.entries(R.rows as Record<string, number>)) {
    const cols = (parts.filter(p => p.type === 'column' && p.building === 'hadish' && Math.abs((p as Column).c[1] - rowY) < 0.05) as Column[]).sort((a, b) => a.c[0] - b.c[0]);
    cols.forEach((c, i) => {
      if (c.order.base !== 'plain') return;
      const D = c.order.shaftD, hd = drumH * c.order.baseH;
      out.push({ id, versions: R.versions, c: [c.c[0], c.c[1]], y0: c.y0, r0: (D / 2) * pb[1], r1: (D / 2) * pb[0], hd, bandBottom: Math.max(0, R.band_bottom), bandTop: Math.min(hd, R.band_top), facing: R.facing, glyphMax: R.glyph_max,
        where: `round the drum of the base of column ${i + 1} (from the W) of the ${rowY > -138.5 ? 'front' : 'back'} row of the Hadish N portico, one line per version, the three stacked, centred on the side toward the court`,
        tier: 'B (column bases of the Palace of Xerxes or the Queen\'s Quarters) / C (which bases, the band)' });
    });
  }
  return out;
}

/** XPg's plaque: a slab of dark stone on the outer face of the Apadana hall's N wall inside the N portico, beside the main
 *  doorway (apadana.r_xpg_plaque); the N doorway is the gap in the N wall's run of boxes */
export function xpgPlaquePlan(parts: Part[], manifest: Manifest): { stone: StonePiece; field: FlatField } | null {
  if (!present('apadana') || !manifest.apadana) return null;
  const P = v<any>('apadana', 'r_xpg_plaque'), a = manifest.apadana as any, floor = Number(a.podium);
  const [cx, cy, hs] = a.room as number[], wt = Number(a.wallThickness), faceY = cy + hs / 2 + wt; // the N wall's outer face
  const frames = parts.filter(p => p.building === 'apadana' && p.kind === 'door_frame' && p.type === 'box' && Math.abs((p as Box).c[1] - (cy + hs / 2 + wt / 2)) < wt) as Box[];
  if (!frames.length) return null;
  // the frame block on the chosen side of the doorway nearest its axis: the plaque stands `from_frame` beyond its outer edge
  const side = Math.sign(P.side) || 1, fr = frames.filter(f => Math.sign(f.c[0] - cx) === side).sort((p, q) => Math.abs(p.c[0] - cx) - Math.abs(q.c[0] - cx))[0];
  if (!fr) return null;
  const edge = fr.c[0] + side * fr.size[0] / 2, x = edge + side * (P.from_frame + P.width / 2), n: Pt = [0, 1];
  const face = faceY + P.proud; // the slab's front face
  const stone: StonePiece = { id: 'apadana-xpg-plaque', c: [x, face - P.depth / 2], size: [P.width, P.depth], y0: floor + P.bottom, y1: floor + P.bottom + P.height, material: P.stone, solid: false,
    note: `the plaque carrying XPg: a ${P.width} × ${P.height} m slab of the dark stone of the frames, ${P.proud} m proud of the hall's N wall inside the N portico, beside the main doorway (placement, size and stone C; D-214, apadana.r_xpg_plaque, Q-424)` };
  const field: FlatField = { id: P.inscription, versions: ['op'], arrangement: 'stack', origin: [x, face], along: rightOf(n), normal: n, yTop: floor + P.bottom + P.height - P.margin,
    width: P.width - 2 * P.margin, height: P.height - 2 * P.margin, glyphMax: P.glyph_max, surface: P.stone,
    where: 'the plaque beside the Apadana\'s N doorway, inside the N portico (the Old Persian: the edition has no other version)', tier: 'B (an ornamental plaque of the Apadana) / C (its place, size and stone)' };
  return { stone, field };
}
