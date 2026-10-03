// s18 C15 (D-800): the elite architecture of the Bagh-e Firuzi and Dasht-e Gohar zones as a royal city's nobles built it in
// 467 BCE, drawn as the town's props (plan.ts Prop: stone, plastered and painted timber, glazed brick; vertex colours, no
// texture): no longer mud boxes. Everything is reconstruction (C), by analogy with the Achaemenid columned buildings that
// survive in plan: the porticoed palaces and pavilions of Pasargadae (Palace P, the garden pavilions on the axis of the
// channelled garden: stone bases of black and white stone, timber or stone shafts, B by analogy), the columned halls of the
// Persepolis plain (the Dasht-e Gohar hall and Takht-e Rustam's neighbours: column bases, search extracts), the glazed-brick
// friezes of Susa and Persepolis (glazed bricks at Tol-e Ajori, AJORI-BRICK2018, B) and the red-painted floors and coloured
// plaster of the Terrace (Stein et al. 2016, B). Colours are the project's pigments (polychromy.json): the timber shafts
// plastered and painted red ochre with blue and yellow bands, the bracket capitals blue, the architraves yellow ochre over a
// glazed frieze of white, turquoise and yellow bricks, the walls gypsum-white over a red dado.
//  - THE ESTATES: a porch of nine columns along the house's garden face (the door into the orchard behind), a talar of four
//    columns on the N side of the court before the main rooms, a gatehouse at the S gate (two plastered piers with the glazed
//    frieze, a painted lintel), the garden laid out as four beds by two stone-lined channels crossing at the pool (the
//    Pasargadae garden's form, B by analogy), the S trees kept clear of the porch;
//  - THE PAVILION at the head of the Tol-e Ajori garden's axis: a stepped stone platform, a porch of 2 x 4 columns on stone bell
//    bases with painted shafts and bracket capitals, a deep painted eave, the room's walls white with a red dado and a dark
//    stone doorframe, the glazed frieze under the eave;
//  - THE DASHT-E GOHAR HALL: 4 x 5 columns on bell bases with painted shafts and bracket capitals, a whitewashed back wall
//    with a red dado, side walls half its depth (a porticoed hall open to the garden), the beams painted, the frieze, the
//    roof's eave.
import type { Prop, Mat } from './plan';
import { toGrid, type Frame, type P2, type Site } from './site';

/** sRGB colours of the paint, plaster and glaze (C; the pigments of polychromy.json at a plaster's matte) */
export const EST = {
  white: [0.88, 0.85, 0.78], dado: [0.6, 0.3, 0.22], shaft: [0.62, 0.32, 0.23], band: [0.84, 0.66, 0.34], bandB: [0.32, 0.47, 0.62], cap: [0.3, 0.46, 0.6],
  arch: [0.8, 0.63, 0.33], glazeW: [0.9, 0.88, 0.8], glazeT: [0.22, 0.5, 0.58], glazeY: [0.86, 0.68, 0.26], glazeB: [0.18, 0.3, 0.55], roof: [0.66, 0.58, 0.45],
  floor: [0.56, 0.27, 0.2], rugR: [0.6, 0.18, 0.14], rugB: [0.2, 0.26, 0.45], rugY: [0.78, 0.6, 0.26], rugW: [0.86, 0.82, 0.72], bronze: [0.42, 0.3, 0.18], clay: [0.66, 0.46, 0.33], stoneW: [0.74, 0.72, 0.66], stoneD: [0.2, 0.19, 0.18], kerb: [0.6, 0.58, 0.53], plank: [0.5, 0.36, 0.24],
} as const satisfies Record<string, [number, number, number]>;
type C3 = readonly [number, number, number];

interface Ctx { props: Prop[]; group: string; row: string; feature: string; note: string }
const put = (X: Ctx, p: Omit<Prop, 'group' | 'row' | 'feature' | 'note'> & { note?: string }) => X.props.push({ group: X.group, row: X.row, feature: X.feature, ...p, note: p.note ? `${X.note}: ${p.note}` : X.note } as Prop);
/** a box in frame f: centre (u, v), half sizes, y0..y1 above the group's base */
function B(X: Ctx, f: Frame, u: number, v: number, hu: number, hv: number, y0: number, y1: number, mat: Mat, colour: C3, collide = false, note?: string) {
  put(X, { shape: 'box', mat, c: toGrid(f, u, v), theta: f.theta, hu, hv, y0, y1, collide, colour: [...colour] as [number, number, number], note });
}
function Cy(X: Ctx, f: Frame, u: number, v: number, r: number, y0: number, y1: number, mat: Mat, colour: C3, r1 = 1, collide = false, note?: string) {
  put(X, { shape: 'cyl', mat, c: toGrid(f, u, v), theta: 0, hu: r, hv: r, r1, y0, y1, collide, colour: [...colour] as [number, number, number], note });
}

/** a column of the Achaemenid type as a plastered timber shaft on a stone base (C): a square plinth, a torus, a bell (the
 *  Pasargadae and Persepolis bases; dark or white stone), the shaft painted red ochre with a blue and a yellow band at its head
 *  and foot, a bracket capital (a block with its two arms along the beam, painted blue, the arms' ends yellow); top = the beam's soffit */
export function column(X: Ctx, f: Frame, u: number, v: number, top: number, r = 0.32, alongU = true, dark = false, collide = true) {
  // (r >= 0.32 and the base's sizes cover the town's own 'column' fitting, settlement/build.ts, where the estates' columns stand
  // as fittings for their colliders and far level)
  const st = dark ? EST.stoneD : EST.stoneW, sm: Mat = X.group === 'estates' ? 'mud' : 'stone', k = r / 0.32;
  B(X, f, u, v, 0.66 * k, 0.66 * k, -0.2, 0.18, sm, st, false, 'square plinth of the column base (C)');
  Cy(X, f, u, v, 0.62 * k, 0.18, 0.55, sm, st, 0.85, false, 'the bell of the column base (Pasargadae and Persepolis type, C)');
  Cy(X, f, u, v, 0.45 * k, 0.55, 0.7, sm, st, 0.9, false, 'the torus (C)');
  const s0 = 0.7, s1 = top - 0.45 * k;
  Cy(X, f, u, v, r, s0, s0 + 0.3, 'timber', EST.bandB, 0.98, collide, 'the foot band of the shaft (C)');
  Cy(X, f, u, v, r * 0.98, s0 + 0.3, s1 - 0.42, 'timber', EST.shaft, 0.92, collide, 'plastered timber shaft painted red ochre (C)');
  Cy(X, f, u, v, r * 0.9, s1 - 0.42, s1 - 0.22, 'timber', EST.band, 1, false, 'the head band (C)');
  Cy(X, f, u, v, r * 0.9, s1 - 0.22, s1, 'timber', EST.bandB, 1.15, false);
  const [hu, hv] = alongU ? [0.95 * k, 0.26 * k] : [0.26 * k, 0.95 * k];
  B(X, f, u, v, hu, hv, s1, top, 'timber', EST.cap, false, 'the bracket capital: a block with two arms along the beam, painted (C)');
  B(X, f, u + (alongU ? hu - 0.1 : 0), v + (alongU ? 0 : hv - 0.1), 0.1, alongU ? hv + 0.01 : 0.1, s1 + 0.05, top - 0.05, 'timber', EST.band);
  B(X, f, u - (alongU ? hu - 0.1 : 0), v - (alongU ? 0 : hv - 0.1), alongU ? 0.1 : 0.1, alongU ? hv + 0.01 : 0.1, s1 + 0.05, top - 0.05, 'timber', EST.band);
}
/** the glazed frieze: bricks of 0.33 m in a running pattern of white, turquoise, yellow and blue (C) along a line from (u0, v)
 *  to (u1, v) (or along v), on a face standing at `face` toward `out` */
export function frieze(X: Ctx, f: Frame, a0: number, a1: number, at: number, y0: number, alongU: boolean, out: number) {
  const n = Math.max(1, Math.round((a1 - a0) / 0.66)), w = (a1 - a0) / n, pat = [EST.glazeW, EST.glazeT, EST.glazeY, EST.glazeT];
  for (let k = 0; k < n; k++) { const a = a0 + (k + 0.5) * w, c = pat[k % pat.length];
    if (alongU) B(X, f, a, at + out * 0.04, w / 2 - 0.004, 0.04, y0, y0 + 0.34, 'glaze', c); else B(X, f, at + out * 0.04, a, 0.04, w / 2 - 0.004, y0, y0 + 0.34, 'glaze', c); }
  if (alongU) { B(X, f, (a0 + a1) / 2, at + out * 0.035, (a1 - a0) / 2, 0.035, y0 - 0.1, y0, 'glaze', EST.glazeB); B(X, f, (a0 + a1) / 2, at + out * 0.035, (a1 - a0) / 2, 0.035, y0 + 0.34, y0 + 0.44, 'glaze', EST.glazeB); }
  else { B(X, f, at + out * 0.035, (a0 + a1) / 2, 0.035, (a1 - a0) / 2, y0 - 0.1, y0, 'glaze', EST.glazeB); B(X, f, at + out * 0.035, (a0 + a1) / 2, 0.035, (a1 - a0) / 2, y0 + 0.34, y0 + 0.44, 'glaze', EST.glazeB); }
}
/** a columned porch (portico) in frame f: from u0 to u1 along u, the columns' line at vCol, its back at vBack (the wall it
 *  stands before); the beam, the frieze on the beam's outer face, the roof slab with its eave */
export function porch(X: Ctx, f: Frame, u0: number, u1: number, vCol: number, vBack: number, H: number, n: number, dark = false) {
  const out = Math.sign(vCol - vBack), dv = Math.abs(vCol - vBack);
  for (let k = 0; k < n; k++) column(X, f, u0 + (k + 0.5) * (u1 - u0) / n, vCol, H, 0.32, true, dark, X.group !== 'estates');
  B(X, f, (u0 + u1) / 2, vCol, (u1 - u0) / 2 + 0.3, 0.3, H, H + 0.42, 'timber', EST.arch, false, 'the architrave beam, plastered and painted yellow ochre (C)');
  frieze(X, f, u0 - 0.3, u1 + 0.3, vCol + out * 0.3, H + 0.44, true, out);
  B(X, f, (u0 + u1) / 2, (vCol + vBack) / 2 + out * 0.3, (u1 - u0) / 2 + 0.6, dv / 2 + 0.7, H + 0.88, H + 1.18, 'mud', EST.roof, false, 'the porch roof: poles, matting and packed earth, its eave over the beam (C)');
  B(X, f, (u0 + u1) / 2, vCol + out * 0.62, (u1 - u0) / 2 + 0.6, 0.06, H + 0.62, H + 0.92, 'timber', EST.cap, false, 'the eave board painted blue (C)');
  // (the back wall is the house's own: its doors open under the porch; its wash is the house's, settlement/houses.ts)
  B(X, f, (u0 + u1) / 2, (vCol + vBack) / 2, (u1 - u0) / 2 + 0.3, dv / 2 + 0.2, -0.25, 0.04, X.group === 'estates' ? 'mud' : 'stone', EST.kerb, false, 'the porch floor: stone slabs (C)');
}

/** an estate's frame and its house's cells (plan.ts estateSite: the house block at cells hx0..hx0+34, hy0..hy0+34) */
export interface EstateFrame { site: Site; hx0: number; hy0: number; size: number; court: [number, number, number, number]; gateAt: number }
/** an estate's porches and gate in site-local metres: the garden porch along the house's S face (the door into the orchard
 *  behind it; nine columns, 4.2 m deep, 4.2 m to the beam), the talar of four columns on the court's N side before the main
 *  rooms (3.6 m deep, dark stone bases), the gate piers; the plan stands a 'column' fitting at each column and pier (their
 *  colliders and far level: settlement/footprints.ts, build.ts) */
export function estateLayout(e: Omit<EstateFrame, 'site'>, s: Pick<Site, 'cu' | 'cv'>) {
  const eu = (i: number) => s.cu(i) - 0.5, ev = (j: number) => s.cv(j) - 0.5; // cell edges in site-local metres
  const vB = ev(e.hy0) - 0.45, [ci0, , ci1, cj1] = e.court, vN = ev(cj1) - 0.4;
  const porchG = { u0: eu(e.hx0) + 0.6, u1: eu(e.hx0 + e.size) - 0.6, vCol: vB - 4.2, vBack: vB, H: 4.2, n: 9 }, talar = { u0: eu(ci0) + 2.5, u1: eu(ci1) - 2.5, vCol: vN - 3.6, vBack: vN, H: 4.0, n: 4 };
  const cols = (p: typeof porchG) => Array.from({ length: p.n }, (_, k) => [p.u0 + (k + 0.5) * (p.u1 - p.u0) / p.n, p.vCol, p.H] as [number, number, number]);
  const gu = s.cu(e.gateAt) + 1, gv = ev(2) - 0.1;
  return { porch: porchG, talar, columns: [...cols(porchG), ...cols(talar)], gate: { u: gu, v: gv, piers: [[gu - 2.3, gv], [gu + 2.3, gv]] as [number, number][] }, eu, ev };
}
export function estateProps(props: Prop[], E: EstateFrame[]) {
  for (const e of E) { const s = e.site, f = s.frame, L = estateLayout(e, s), eu = L.eu, ev = L.ev;
    // (one group for the four estates: the estates' own draw cluster, mud batch only; their colliders are the site's fittings)
    const X: Ctx = { props, group: 'estates', row: 'estates_bagh_e_firuzi', feature: 'zone_bagh_e_firuzi', note: `${s.id}: elite estate (s18 C15, D-800; C)` };
    porch(X, f, L.porch.u0, L.porch.u1, L.porch.vCol, L.porch.vBack, L.porch.H, L.porch.n);
    porch(X, f, L.talar.u0, L.talar.u1, L.talar.vCol, L.talar.vBack, L.talar.H, L.talar.n, true);
    // the gatehouse at the S gate: two plastered piers with the frieze, a painted lintel (C)
    const gu = L.gate.u, gv = L.gate.v;
    for (const sd of [-1, 1]) { B(X, f, gu + sd * 2.3, gv, 0.75, 0.75, -0.3, 4.4, 'mud', EST.white, false, 'gate pier, gypsum-white plaster (C)'); B(X, f, gu + sd * 2.3, gv, 0.78, 0.78, -0.3, 0.9, 'mud', EST.dado, false); }
    B(X, f, gu, gv, 3.1, 0.6, 4.4, 4.85, 'timber', EST.arch, false, 'the gate\'s lintel beam, painted (C)');
    frieze(X, f, gu - 3.0, gu + 3.0, gv - 0.6, 4.88, true, -1);
    B(X, f, gu, gv, 3.3, 0.9, 5.3, 5.5, 'mud', EST.roof, false, 'the gate\'s roof (C)');
    // s18 C15 (D-800): the house in use (C): carpets on the porches' floors (red, blue or yellow grounds with a contrasting
    // border: knotted and woven pile carpets are Achaemenid, the Pazyryk carpet, B by analogy), cushions along the back, a bronze
    // brazier; water jars by the pool, a stone bench under the trees; the gatekeepers' benches outside the gate
    const rug = (u: number, v: number, hu: number, hv: number, k: number) => { const P3 = [EST.rugR, EST.rugB, EST.rugY], g = P3[k % 3], bd = P3[(k + 1) % 3];
      B(X, f, u, v, hu, hv, 0.05, 0.07, 'mud', bd, false, 'a pile carpet\'s border (C)'); B(X, f, u, v, hu - 0.18, hv - 0.18, 0.07, 0.085, 'mud', g, false, 'a pile carpet (Pazyryk by analogy, B; C)');
      B(X, f, u, v, hu - 0.5, hv - 0.5, 0.085, 0.09, 'mud', EST.rugW, false); };
    { const p = L.porch, mid = (p.u0 + p.u1) / 2, vm = (p.vCol + p.vBack) / 2, k0 = (s.id.charCodeAt(s.id.length - 1) || 0);
      for (let k = 0; k < 3; k++) rug(mid + (k - 1) * 9.5, vm, 3.6, 1.4, k + k0);
      for (let k = 0; k < 10; k++) B(X, f, mid - 13 + k * 2.9, p.vBack - Math.sign(p.vBack - p.vCol) * 0.45, 0.45, 0.28, 0.07, 0.42, 'mud', [EST.rugR, EST.rugY, EST.rugB][(k + k0) % 3], false, 'a cushion against the wall (C)');
      Cy(X, f, mid + 15, vm, 0.32, 0.05, 0.75, 'mud', EST.bronze, 1.25, false, 'a bronze brazier on its stand (C)');
      const t = L.talar; rug((t.u0 + t.u1) / 2, (t.vCol + t.vBack) / 2, 6, 1.2, k0 + 1); }
    { const pu0 = s.cu(2 + 60), pv0 = s.cv(2 + 35);
      for (let k = 0; k < 3; k++) Cy(X, f, pu0 + 7 + k * 0.7, pv0 - 3.9, 0.26, 0.0, 0.8, 'mud', EST.clay, 0.62, false, 'a water jar by the pool (C)');
      B(X, f, pu0 - 9, pv0 + 5, 1.2, 0.3, -0.1, 0.45, 'mud', EST.stoneW, false, 'a stone bench under the trees (C)'); }
    for (const sd of [-1, 1]) B(X, f, L.gate.u + sd * 4.3, L.gate.v - 1.2, 1.0, 0.28, -0.1, 0.42, 'mud', EST.white, false, 'the gatekeepers\' bench by the gate (C)');
    // the garden's two stone-lined channels crossing at the pool (kerbs; the water itself is the plan's channel fittings)
    const pu = s.cu(2 + 60), pv = s.cv(2 + 35);
    for (const [a, b, alongU] of [[eu(40), pu - 6.4, true], [pu + 6.4, eu(91) - 1, true], [ev(4), pv - 3.4, false], [pv + 3.4, ev(69) - 1, false]] as [number, number, boolean][])
      for (const sd of [-1, 1]) alongU ? B(X, f, (a + b) / 2, pv + sd * 0.45, (b - a) / 2, 0.12, -0.25, 0.12, 'mud', EST.kerb, false, 'channel kerb of dressed stone (Pasargadae garden by analogy, B; C)') : B(X, f, pu + sd * 0.45, (a + b) / 2, 0.12, (b - a) / 2, -0.25, 0.12, 'mud', EST.kerb, false, 'channel kerb of dressed stone (C)');
    for (const [du, dv, hu, hv] of [[0, -3.25, 6.3, 0.15], [0, 3.25, 6.3, 0.15], [-6.25, 0, 0.15, 3.25], [6.25, 0, 0.15, 3.25]]) B(X, f, pu + du, pv + dv, hu, hv, -0.3, 0.2, 'mud', EST.kerb, false, 'the pool\'s stone coping (C)');
  }
}

/** the pavilion at the head of the garden axis (frame f: +u toward the gate; plan.ts PAVILION) */
export function pavilionProps2(props: Prop[], groups: Map<string, P2[]>, f: Frame) {
  const W = 18, D = 14, X: Ctx = { props, group: 'pavilion', row: 'paradise_bagh_e_firuzi', feature: 'zone_bagh_e_firuzi', note: 'garden pavilion on the axis, facing the gate: a porch of 2 x 4 columns before a room (C; column bases beyond the gate: press; Pasargadae pavilions by analogy, B; s18 C15, D-800)' };
  groups.set('pavilion', [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toGrid(f, a * D / 2, b * W / 2)));
  // the platform: two steps of dressed stone (white, a dark top course: Pasargadae's black and white stone, C)
  B(X, f, 0, 0, D / 2 + 1.4, W / 2 + 1.4, -0.4, 0.25, 'stone', EST.stoneW, true, 'the platform\'s lower step (C)');
  B(X, f, 0, 0, D / 2 + 0.6, W / 2 + 0.6, 0.25, 0.55, 'stone', EST.stoneD, true, 'the platform\'s upper course, dark stone (C)');
  // the room: back and side walls, the front wall with its door, white over a red dado, the dark stone doorframe
  const wall = (u: number, v: number, hu: number, hv: number) => { B(X, f, u, v, hu, hv, 0.55, 5.4, 'mud', EST.white, true, 'the room\'s wall: mud brick under gypsum-white plaster (C)'); B(X, f, u, v, hu + 0.03, hv + 0.03, 0.55, 1.5, 'mud', EST.dado, false); };
  wall(-D / 2 + 0.4, 0, 0.45, W / 2); wall(-D / 2 + 3.5, W / 2 - 0.4, 3.5, 0.45); wall(-D / 2 + 3.5, -W / 2 + 0.4, 3.5, 0.45);
  const dv = -5.4; // the door: 1.6 m, framed in dark stone
  wall(-D / 2 + 7, 2.2, 0.4, 6.8); wall(-D / 2 + 7, -7.6, 0.4, 1.4);
  for (const sd of [-1, 1]) B(X, f, -D / 2 + 7.25, dv + sd * 0.95, 0.2, 0.15, 0.55, 3.6, 'stone', EST.stoneD, false, 'doorframe of polished dark stone (Pasargadae, B by analogy; C)');
  B(X, f, -D / 2 + 7.25, dv, 0.2, 1.1, 3.6, 4.0, 'stone', EST.stoneD, false);
  B(X, f, -D / 2 + 7, dv, 0.4, 0.8, 4.0, 5.4, 'mud', EST.white, false);
  // the porch: 2 rows of 4 columns, its beams, the frieze on the front, the roof over room and porch with a deep eave
  for (let k = 0; k < 4; k++) { const v = -W / 2 + 2.25 + k * 4.5; for (const u of [D / 2 - 0.9, 2.2]) column(X, f, u, v, 5.3, 0.27, false); }
  for (const u of [D / 2 - 0.9, 2.2]) B(X, f, u, 0, 0.32, W / 2 + 0.3, 5.3, 5.75, 'timber', EST.arch, false, 'the architrave beam, painted (C)');
  frieze(X, f, -W / 2 - 0.3, W / 2 + 0.3, D / 2 - 0.9 + 0.32, 5.77, false, 1);
  B(X, f, 0.3, 0, D / 2 + 1.2, W / 2 + 1.2, 6.2, 6.55, 'mud', EST.roof, false, 'flat roof of poles, matting and earth with a deep eave (C)');
  B(X, f, D / 2 + 0.55, 0, 0.07, W / 2 + 1.2, 5.95, 6.25, 'timber', EST.cap, false, 'the eave board painted blue (C)');
  B(X, f, D / 2 - 3.1, 0, 3.4, W / 2, 0.55, 0.6, 'stone', EST.kerb, false, 'the porch floor of stone slabs (C)');
  B(X, f, -D / 2 + 3.6, 0, 3.4, W / 2 - 0.8, 0.55, 0.6, 'mud', EST.floor, false, 'the room\'s floor of lime plaster painted red (the Terrace\'s red-painted floors, B; C)');
}

/** the Dasht-e Gohar hall (frame hf, hallW across u, hallD along v; plan.ts) */
export function goharHallProps(props: Prop[], hf: Frame, hallW: number, hallD: number) {
  const X: Ctx = { props, group: 'hall_gohar', row: 'hall_dasht_e_gohar', feature: 'zone_dasht_e_gohar', note: 'columned hall behind Takht-e Rustam ("hypostyle hall reburied behind the platform": search extract, C); size, plan, column form and paint C (s18 C15, D-800)' };
  B(X, hf, 0, 0, hallW / 2 + 1.0, hallD / 2 + 1.0, -0.45, 0.2, 'stone', EST.kerb, true, 'the hall\'s floor and stylobate of stone slabs (C)');
  B(X, hf, -hallW / 2 + 6, 0, 6, hallD / 2, 0.2, 0.23, 'mud', EST.floor, false, 'the walled back half\'s floor: lime plaster painted red (the Terrace\'s red-painted floors, B; C)');
  for (let a = 0; a < 4; a++) for (let b = 0; b < 5; b++) column(X, hf, -hallW / 2 + 3 + a * 6, -hallD / 2 + 3 + b * 6, 6.2, 0.34, false, (a + b) % 2 === 1);
  for (let a = 0; a < 4; a++) B(X, hf, -hallW / 2 + 3 + a * 6, 0, 0.36, hallD / 2 + 0.3, 6.2, 6.7, 'timber', EST.arch, false, 'the main beams over the column rows, painted (C)');
  // the back wall (W) and side walls half the depth, white over a red dado; the frieze along the open front's beam
  const wall = (u: number, v: number, hu: number, hv: number) => { B(X, hf, u, v, hu, hv, 0.2, 7.2, 'mud', EST.white, true, 'mud-brick wall under gypsum-white plaster (C)'); B(X, hf, u, v, hu + 0.03, hv + 0.03, 0.2, 1.4, 'mud', EST.dado, false); };
  wall(-hallW / 2 - 0.5, 0, 0.5, hallD / 2 + 1);
  for (const sd of [-1, 1]) wall(-hallW / 2 + hallW / 4 - 0.5, sd * (hallD / 2 + 0.5), hallW / 4, 0.5);
  frieze(X, hf, -hallD / 2 - 0.3, hallD / 2 + 0.3, hallW / 2 - 3 + 0.36, 6.72, false, 1);
  B(X, hf, 0, 0, hallW / 2 + 1.6, hallD / 2 + 1.6, 7.2, 7.6, 'mud', EST.roof, false, 'flat roof on timber beams with an eave (C)');
  B(X, hf, hallW / 2 + 1.5, 0, 0.08, hallD / 2 + 1.6, 6.9, 7.3, 'timber', EST.cap, false, 'the eave board painted blue (C)');
}
