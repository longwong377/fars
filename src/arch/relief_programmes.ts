// Phase 4 relief programmes (D-049): the stair façades of the Tachara (S stair), the Hadish (W and E stairs) and the
// Tripylon (N stair), and the door-jamb reliefs of the Tachara, Hadish, Tripylon, Hall of 100 Columns and Harem, placed as
// carved figures (reliefs.ts ReliefItem) on the faces the generator built. The programme (which motifs, which order) comes
// from the SITE_SPEC relief rows with their tiers (stair_*_reliefs, door_jamb_reliefs, relief_state_467); sizes from
// global.r_stair_parapet, r_stair_relief, r_jamb_relief and apadana.r_relief_*; positions from the flight rows and the
// doorway descriptors. Composition offsets below are drawing choices (C), like the Apadana planner's (reliefs.ts).
import * as THREE from 'three/webgpu';
import { v, present, footprint } from './spec';
import type { Doorway, Pt } from './parts';
import type { ReliefItem } from './reliefs';
import { FIGURE_KINDS, ROUGH, RAIL_T, baseKind, kindBounds } from './relief_figures';

/** grid → world: point at height y, or direction */
const W = (p: Pt, y = 0) => new THREE.Vector3(p[0], y, -p[1]);
const UP = new THREE.Vector3(0, 1, 0);
const add = (a: Pt, b: Pt, s = 1): Pt => [a[0] + b[0] * s, a[1] + b[1] * s];
const unit = (a: Pt): Pt => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
/** the viewer's right on a face whose outward normal is n (grid): n turned a quarter CCW, so right × up = normal */
const rightOf = (n: Pt): Pt => [-n[1], n[0]];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];

/** a carved inscription panel: `version` alone, or `versions` stacked top to bottom from yTop (glyph, line gap and the gap
 *  between versions default to global.r_stair_relief's panel values) */
export interface InscriptionPlacement { id: string; version: 'op' | 'el' | 'bab'; origin: Pt; along: Pt; normal: Pt; yTop: number; width: number; versions?: ('op' | 'el' | 'bab')[]; glyph?: number; lineGap?: number; gap?: number; flat?: boolean }
export interface ProgrammeSet { name: string; building: string; items: ReliefItem[]; inscriptions: InscriptionPlacement[] }
type Tagged = { programme: string; tier: string; where: string };

/** one carved figure: origin p on the face (grid) at height y, outward normal n, figure height S (m), relief depth D (m),
 *  walking toward the viewer's right (+1) or left (−1) */
function fig(kind: string, seed: number, p: Pt, y: number, n: Pt, S: number, D: number, facing: 1 | -1, meta: Tagged): ReliefItem {
  if (!FIGURE_KINDS[baseKind(kind)]) throw new Error(`relief kind ${kind} unknown`);
  return { kind, seed, o: W(p, y), X: W(rightOf(n)), Y: UP.clone(), Z: W(n), S, D, mirror: facing < 0, meta };
}
const figW = (kind: string, S: number) => FIGURE_KINDS[baseKind(kind)].w * S;
/** a figure's drawn extent behind (x0 < 0) and in front of (x1) its origin, in figure units (facing +x) */
const extent = (kind: string, seed: number) => { const b = kindBounds(baseKind(kind), seed); return [b[0], b[2]] as const; };
const carving = () => v<any>('apadana', 'r_relief_carving');
/** the outline's extreme x at a given y (the traced wall face a relief stands on) */
function edgeX(poly: [number, number][], y: number, pick: 'min' | 'max') {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) xs.push(a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1])); }
  return pick === 'min' ? Math.min(...xs) : Math.max(...xs);
}
const depth = () => v<number>('apadana', 'r_relief_depth');

// ---------------- stairs ----------------
interface FlightRow { id: string; foot: Pt; head: Pt; z0: number; z1: number; steps: number; tread: number; width: number }
const isFlight = (f: any): f is FlightRow => Array.isArray(f.foot) && Array.isArray(f.head);
/** the outer face of a flight's parapet: plane point at the foot, outward normal, rising direction, run, slope */
function flightFace(f: FlightRow, outward: Pt) {
  const SP = v<any>('global', 'r_stair_parapet'), d = unit([f.head[0] - f.foot[0], f.head[1] - f.foot[1]]);
  const n = unit(outward), foot = add(f.foot, n, f.width / 2 + SP.thickness);
  return { foot, n, d, run: f.steps * f.tread, slope: (f.z1 - f.z0) / (f.steps * f.tread), z0: f.z0 };
}
/** a file of figures climbing a flight on the parapet band of its outer face (band = r_stair_parapet.height above the line
 *  through the step roots, so it stays under the stepped parapet top), from `a0` along the rise; kinds cycle with seeds */
function climbingFile(out: ReliefItem[], F: ReturnType<typeof flightFace>, a0: number, kinds: (i: number) => [string, number], meta: Tagged) {
  const SP = v<any>('global', 'r_stair_parapet'), S = SP.height * carving().figure_fill, sp = v<number>('apadana', 'r_figure_spacing');
  const facing = (dot(F.d, rightOf(F.n)) > 0 ? 1 : -1) as 1 | -1;
  for (let a = a0 + sp / 2, i = 0; a < F.run - sp / 2; a += sp, i++) { const [k, s] = kinds(i); out.push(fig(k, s, add(F.foot, F.d, a), F.z0 + a * F.slope, F.n, S, depth(), facing, meta)); }
}
/** the lion attacking a bull in the triangle under a flight's slope (the Apadana planner's fit, C) */
function lionBull(out: ReliefItem[], F: ReturnType<typeof flightFace>, meta: Tagged, rough = '') {
  const R = v<any>('apadana', 'r_registers'), CV = carving(), S0 = R.height * CV.figure_fill, dc = F.run * 0.6, top = dc * F.slope;
  const k = Math.min((top - R.bottom) / (S0 * 1.05), (F.run * 0.55) / (figW('lion_bull', S0) * 1.1));
  if (k <= 0) return;
  out.push(fig('lion_bull' + rough, 0, add(F.foot, F.d, dc), F.z0 + R.bottom, F.n, S0 * k, depth() * CV.panel_depth_factor, (dot(F.d, rightOf(F.n)) > 0 ? 1 : -1) as 1 | -1, meta));
}
/** figures facing a centre from both sides (antithetic files) on a face: count per side, first figure `gap` from the centre */
function antithetic(out: ReliefItem[], centre: Pt, n: Pt, y: number, kinds: (side: number, i: number) => [string, number], count: number, S: number, gap: number, meta: Tagged, slope = 0, step = 0) {
  const r = rightOf(n);
  for (const side of [-1, 1]) for (let i = 0; i < count; i++) {
    const [k, s] = kinds(side, i), w = figW(k, S), a = gap + (step || w) * (i + 0.5);
    out.push(fig(k, s, add(centre, r, side * a), y + slope * a, n, S, depth(), (side < 0 ? 1 : -1) as 1 | -1, meta));
  }
}

function tacharaStair(): ProgrammeSet | null {
  if (!present('tachara') || !v<boolean>('tachara', 'stair_s_present_467')) return null;
  // programme: tachara.stair_s_reliefs (B): guards flanking XPc on the central façade, servants on the flight parapets,
  // lion-and-bull in the corner angles
  const out: ReliefItem[] = [], ins: InscriptionPlacement[] = [], Z = v<any>('tachara', 'stair_s_zone'), SR = v<any>('global', 'r_stair_relief');
  const tagF: Tagged = { programme: 'servants climbing with kids, wineskins, covered dishes; Persian/Median dress alternating', tier: 'B', where: 'Tachara S stair flight parapets' };
  for (const F0 of v<any[]>('tachara', 'stair_s_flights')) {
    if (!isFlight(F0)) { // central landing: guards flanking XPc (B); count and size C
      const L = F0 as any, c: Pt = [(L.x[0] + L.x[1]) / 2, L.y[0]], n: Pt = [0, -1], S = SR.central_register * carving().figure_fill;
      antithetic(out, c, n, SR.central_ground, (_s, i) => ['guard', i], SR.guards_per_side, S, SR.panel_width / 2, { programme: 'Persian guards flanking XPc', tier: 'B', where: 'Tachara S stair central façade' });
      ins.push({ id: 'XPc', version: 'op', origin: c, along: rightOf(n), normal: n, yTop: L.z - SR.central_ground, width: SR.panel_width }); // hung from the landing top
      continue;
    }
    const F = flightFace(F0, [0, Z.y_facade - F0.foot[1]]);
    climbingFile(out, F, 0, i => ['servant', i], tagF);
    lionBull(out, F, { programme: 'lion attacking a bull in the corner angle', tier: 'B', where: 'Tachara S stair (corner angle; position C)' });
  }
  return { name: 'relief:tachara-stair', building: 'tachara', items: out, inscriptions: ins };
}

function hadishStairs(): ProgrammeSet | null {
  if (!present('hadish')) return null;
  const out: ReliefItem[] = [], ins: InscriptionPlacement[] = [], SR = v<any>('global', 'r_stair_relief'), SP = v<any>('global', 'r_stair_parapet');
  const S = SR.central_register * carving().figure_fill;
  for (const [key, zoneKey, side] of [['stair_w_flights', 'stair_w_zone', 'W'], ['stair_e_flights', 'stair_e_zone', 'E']] as const) {
    const Fs = (v<any[]>('hadish', key)).filter(isFlight), Z = v<any>('hadish', zoneKey);
    const lo = Math.min(...Fs.map(f => f.z0)), lower = Fs.filter(f => f.z0 === lo), upper = Fs.filter(f => f.z0 !== lo);
    const outer: Pt = side === 'W' ? [-1, 0] : [1, 0], cy = Z.centre_y as number;
    // flights: servants climbing the outer parapets of the lower flights (W stair B; E stair C, by 'similar to the Tachara')
    for (const f of lower) climbingFile(out, flightFace(f, outer), SP.open_steps * f.tread, i => ['servant', i + (side === 'E' ? 1 : 0)],
      { programme: 'servants carrying kids and food vessels', tier: side === 'W' ? 'B' : 'C', where: `Hadish ${side} stair lower flights` });
    // W central façade: guards flanking XPd on the face above the meeting of the lower flights (the lane divider), standing on
    // the lower flights' slope (C)
    if (side === 'W' && upper.length) { // the divider's outer face is the lower flights' inner edge (terrace.ts lane divider)
      const f = lower[0], slope = (f.z1 - f.z0) / (f.steps * f.tread), c: Pt = [f.foot[0] + Math.sign(upper[0].foot[0] - f.foot[0]) * f.width / 2, cy];
      antithetic(out, c, outer, SR.central_ground, (_s, i) => ['guard', i + 4], SR.guards_per_side / 2, S, SR.panel_width / 2, { programme: 'Persian guards flanking XPd', tier: 'B', where: 'Hadish W stair central façade (position C)' }, slope);
      ins.push({ id: 'XPd', version: 'op', origin: c, along: rightOf(outer), normal: outer, yTop: SR.central_ground + SR.central_register + SR.panel_width / 2 * slope, width: SR.panel_width });
    }
    // wings: Persian guards. W stair: on the platform face beside the stair zone, walking toward the stair (C); E stair: on
    // the outer (N and S) faces of the end landings where they stand clear of the platform ('South Facade of South Wing', B)
    const tagW: Tagged = { programme: 'Persian guards on the wings', tier: 'B', where: `Hadish ${side} stair wings (placement C)` };
    if (side === 'W') for (const [edge, dir] of [[Z.y[1], 1], [Z.y[0], -1]] as const) { // the face runs away from the zone
      // on the platform's traced W edge (the platform is the outline minus the stair zones, terrace.ts)
      const n = outer, w = figW('guard', S), count = SR.guards_per_side, poly = footprint('hadish').polygon;
      for (let i = 0; i < count; i++) { const a = w * (i + 0.5), y = edge + dir * a;
        out.push(fig('guard', i + 8, [edgeX(poly, y, 'min'), y], SR.central_ground, n, S, depth(), (dot([0, -dir], rightOf(n)) > 0 ? 1 : -1) as 1 | -1, tagW)); }
    } else { // the part of each end face that stands clear of the platform (the zone projects beyond the traced E edge)
      const clear0 = Math.max(Z.x[0], footprint('hadish').bounds[2]);
      for (const [yEdge, ny] of [[Z.y[1], 1], [Z.y[0], -1]] as const) {
        const n: Pt = [0, ny], w = figW('guard', S), count = Math.floor((Z.x[1] - clear0) / w);
        for (let i = 0; i < count; i++) out.push(fig('guard', i + 12, [clear0 + w * (i + 0.5), yEdge], SR.central_ground, n, S, depth(), (dot([1, 0], rightOf(n)) > 0 ? 1 : -1) as 1 | -1, tagW));
      }
    }
  }
  return { name: 'relief:hadish-stairs', building: 'hadish', items: out, inscriptions: ins };
}

function tripylonStair(): ProgrammeSet | null {
  if (!present('tripylon')) return null;
  const rough = v<string>('tripylon', 'relief_state_467') === 'blocked_out' ? ROUGH : '';
  const out: ReliefItem[] = [], SR = v<any>('global', 'r_stair_relief'), NZ = v<any>('tripylon', 'stair_n_zone'), CV = carving();
  for (const F0 of v<any[]>('tripylon', 'stair_n_flights')) {
    if (!isFlight(F0)) {
      if (F0.id !== 'central_landing') continue;
      // central panel (B): below, two groups of guards flanking a blank field (4 per group, Q-P4-08); above, the winged disc
      // between two seated sphinxes with palms behind them (sizes and spacing C)
      const L = F0 as any, c: Pt = [(L.x[0] + L.x[1]) / 2, L.y[1]], n: Pt = [0, 1], S = SR.central_register * CV.figure_fill;
      antithetic(out, c, n, SR.central_ground, (_s, i) => [(i % 2 ? 'mede_guard' : 'guard') + rough, i + 20], SR.guards_per_side, S, SR.panel_width / 2, { programme: 'guards flanking a blank field', tier: 'B', where: 'Tripylon N stair central panel (count Q-P4-08)' });
      const top = L.z - SR.central_ground - SR.central_register, yU = SR.central_ground + SR.central_register, Sd = top * CV.figure_fill, Dp = depth() * CV.panel_depth_factor;
      const tagP: Tagged = { programme: 'winged disc between seated sphinxes with palms', tier: 'B', where: 'Tripylon N stair central panel' };
      out.push(fig('winged_disc' + rough, 0, c, yU - Sd * 0.35, n, Sd * 1.3, Dp, 1, tagP));
      for (const side of [-1, 1]) { const r = rightOf(n), ds = figW('winged_disc', Sd * 1.3) * 0.62 + figW('sphinx', Sd) * 0.5;
        out.push(fig('sphinx' + rough, 0, add(c, r, side * ds), yU, n, Sd, Dp, (side < 0 ? 1 : -1) as 1 | -1, tagP));
        out.push(fig('palm' + rough, 0, add(c, r, side * (ds + figW('sphinx', Sd) * 0.5 + figW('palm', Sd) * 0.5)), yU, n, Sd, Dp, 1, tagP)); }
      continue;
    }
    if (F0.id === 'upper_terrace') continue;
    const F = flightFace(F0, [0, NZ.y[1] - F0.foot[1]]);
    climbingFile(out, F, 0, i => [(i % 2 ? 'mede' : 'persian') + rough, i], { programme: 'Persian and Median nobles ascending', tier: 'B', where: 'Tripylon N stair flight façades' });
    lionBull(out, F, { programme: 'lion attacking a bull (corners NOT SEEN; analogue: Apadana, Tachara)', tier: 'C', where: 'Tripylon N stair corners' }, rough);
  }
  return { name: 'relief:tripylon-stair', building: 'tripylon', items: out, inscriptions: [] };
}

// ---------------- door jambs ----------------
/** the two reveal faces of a stone-framed doorway: the face centre at floor level, outward normal (into the opening),
 *  face length along the passage (frame depth) and height */
function jambFaces(d: Doorway) {
  return [-1, 1].map(s => ({ c: add(d.c, d.u, s * d.width / 2), n: [-s * d.u[0], -s * d.u[1]] as Pt, L: d.depth + 2 * d.proj, H: d.height, y0: d.y0 }));
}
/** an inscription carved on a reveal above its figures (global.r_jamb_inscription): the versions stacked from near the
 *  reveal top, reading left to right as one faces the reveal */
function jambInscription(face: ReturnType<typeof jambFaces>[number], id: string): InscriptionPlacement {
  const JI = v<any>('global', 'r_jamb_inscription'), JR = v<any>('global', 'r_jamb_relief');
  return { id, version: JI.versions[0], versions: JI.versions, origin: face.c, along: rightOf(face.n), normal: face.n,
    yTop: face.y0 + face.H - JI.top_margin - JI.glyph, width: (face.L - 2 * JR.margin) * JI.width_of_reveal, glyph: JI.glyph, lineGap: JI.line_gap, gap: JI.version_gap, flat: !!JI.flat };
}
/** a door-jamb programme on one reveal (global.r_jamb_relief): figures walk into the hall (toward d.n), the leader at the
 *  inner end; `rough` = blocked-out variant (relief_state_467) */
function jamb(out: ReliefItem[], d: Doorway, face: ReturnType<typeof jambFaces>[number], P: any, jambIndex: number, rough: string, tier: string, building: string) {
  const JR = v<any>('global', 'r_jamb_relief'), SR = v<any>('global', 'r_stair_relief'), CV = carving(), D = depth() * JR.depth_factor;
  const r = rightOf(face.n), facing = (dot(d.n, r) > 0 ? 1 : -1) as 1 | -1, len = face.L - 2 * JR.margin, H = face.H;
  const meta: Tagged = { programme: P.programme, tier, where: `${d.id} jamb ${jambIndex}` };
  /** along the face from the inner end (the leader's end) back toward the outer end */
  const at = (back: number): Pt => add(face.c, r, facing * (len / 2 - back));
  const k = (kind: string) => kind + rough;
  const y = face.y0 + JR.ground;
  /** one figure whose front edge touches the inner end (+ `back` m behind it), scaled to at most `Smax` and to fit `room` */
  const lead = (kind: string, seed: number, Smax: number, room: number, back = 0, yy = y) => {
    const [x0, x1] = extent(kind, seed), S = Math.min(Smax, room / (x1 - x0));
    out.push(fig(k(kind), seed, at(back + x1 * S), yy, face.n, S, D, facing, meta)); return { S, used: (x1 - x0) * S };
  };
  if (P.programme === 'king') { // the king under the parasol with attendants (king_attendants), fitted to the reveal
    lead('king_attendants', P.attendants?.[1] === 'towel' ? 1 : P.attendants?.length > 1 ? 0 : 2, JR.figure_of_door * H, len);
  } else if (P.programme === 'hero') {
    const beasts: string[] = P.beasts ?? ['lion'];
    lead('hero', ['lion', 'bull', 'monster'].indexOf(beasts[jambIndex % beasts.length]), JR.figure_of_door * H, len);
  } else if (P.programme === 'attendants') { // equal attendants in file, the whole file fitted to the reveal
    const props: string[] = P.props ?? ['towel'], seeds = props.map(p => ['parasol', 'whisk', 'towel', 'flask'].indexOf(p) + (jambIndex ? 4 : 0));
    const total = seeds.reduce((q, sd) => { const [x0, x1] = extent('attendant', sd); return q + x1 - x0; }, 0), S = Math.min(JR.figure_of_door * H, len / total);
    let back = 0; for (const sd of seeds) { const [x0, x1] = extent('attendant', sd); out.push(fig(k('attendant'), sd, at(back + x1 * S), y, face.n, S, D, facing, meta)); back += (x1 - x0) * S; }
  } else if (P.programme === 'throne_bearers' || P.programme === 'throne_guards') {
    // the king enthroned with the crown prince behind him at the top; below, rows of bearers holding up the platform
    // (throne_bearers) or registers of guards (throne_guards). The king group is fitted to the reveal (C); rows fill the rest
    const [kx0, kx1] = extent('king', 0), [px0, px1] = extent('crown_prince', 1), AS = JR.attendant_scale;
    const kingS = Math.min(JR.figure_of_door * H, len / (kx1 - kx0 + (px1 - px0) * AS)), rows = P.programme === 'throne_bearers' ? SR.bearer_rows : P.registers;
    const bearers = P.programme === 'throne_bearers', under = bearers ? len * kindBounds('dais', 0)[3] : JR.register_gap; // platform or gap under the king
    const kTop = Math.max(kindBounds('king', 0)[3], kindBounds('crown_prince', 1)[3] * AS);
    // bearer tiers: each lower tier holds up a ledge (rail, C) on which the tier above stands; the top tier holds the platform
    const railT = bearers ? RAIL_T * len : 0, pitch = (row: number) => row * (rowH + railT);
    const rowH = Math.min((H - JR.ground - JR.margin - under - kingS * kTop - (rows - 1) * railT) / rows, (kingS * AS) / CV.figure_fill), rowS = rowH * (bearers ? 1 : CV.figure_fill); // bearers' palms (y = 1) meet the ledge
    const base = y + pitch(rows) - railT;
    if (bearers) { out.push(fig(k('dais'), 0, at(len / 2), base, face.n, len, D, facing, meta));
      for (let row = 0; row < rows - 1; row++) out.push(fig(k('rail'), 0, at(len / 2), y + pitch(row) + rowH, face.n, len, D, facing, meta)); }
    const yK = base + under;
    out.push(fig(k('king'), 0, at(kx1 * kingS), yK, face.n, kingS, D, facing, meta));
    out.push(fig(k('crown_prince'), 1, at((kx1 - kx0) * kingS + px1 * kingS * AS), yK, face.n, kingS * AS, D, facing, meta));
    for (let row = 0; row < rows; row++) {
      const kind = bearers ? 'bearer' : row % 2 ? 'mede_guard' : 'guard', w = figW(kind, rowS), count = Math.max(1, Math.floor(len / w));
      for (let i = 0; i < count; i++) out.push(fig(k(kind), bearers ? (row * count + i + jambIndex * 11) % 23 : row * count + i, at(w * (i + 0.5) + (len - count * w) / 2), y + pitch(row), face.n, rowS, D, facing, meta));
    }
  }
  void building;
}
function jambProgrammes(doorways: Doorway[]): ProgrammeSet[] {
  const sets: ProgrammeSet[] = [];
  for (const b of ['tachara', 'hadish', 'tripylon', 'hall100', 'harem']) {
    if (!present(b)) continue;
    const prog = v<Record<string, any>>(b, 'door_jamb_reliefs'), state = (() => { try { return v<string>(b, 'relief_state_467'); } catch { return 'carved'; } })();
    const rough = state === 'blocked_out' ? ROUGH : '', out: ReliefItem[] = [], ins: InscriptionPlacement[] = [];
    for (const d of doorways.filter(q => q.building === b && q.framed)) {
      // Hall of 100 Columns: one programme per wall (N1/N2 share N, …)
      const P = prog[d.door] ?? prog[d.door.replace(/\d+$/, '')];
      if (!P || P.programme === 'plain') continue;
      jambFaces(d).forEach((f, i) => { jamb(out, d, f, P, i, rough, P.tier ?? 'C', b); if (P.inscription) ins.push(jambInscription(f, P.inscription)); });
    }
    if (out.length) sets.push({ name: `relief:${b}-jambs`, building: b, items: out, inscriptions: ins });
  }
  return sets;
}

/** every Phase 4 relief set (stairs and jambs), as relief items and inscription placements */
export function phase4Programmes(doorways: Doorway[]): ProgrammeSet[] {
  return [tacharaStair(), hadishStairs(), tripylonStair(), ...jambProgrammes(doorways)].filter(Boolean) as ProgrammeSet[];
}
