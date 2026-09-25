// Masons' and sculptors' marks (D-212; gap audit item 13; SITE_SPEC global.r_masons_marks). Not a script: four drawn
// shapes, cut into the stone with the inscriptions' incision (carving.ts → render/incision.ts, D-177).
//  - Attested (B, search extracts): hundreds of sculptors' marks incised on the BACKGROUNDS of the Persepolis reliefs, each
//    the mark of a sculptor or a team labelling a figure or a group, e.g. the "double diamond" in front of the spear blade of
//    one archer and above the quiver of another (ROAF1983); marks on blocks at Persepolis and Susa that resemble Lydian
//    letters (IR-GREECE7); at Pasargadae circles, crosses and L-shaped signs, as on the Lydian terraces at Sardis (PAS-MARKS).
//  - Cut here: only those four shapes (double lozenge, circle, cross, L). The double lozenge's exact form is NOT SEEN (two
//    lozenges joined point to point, C); the circle, cross and L are Pasargadae's (their use at Persepolis C). Which figure
//    carries which mark (every few guards on the Apadana stair reliefs, a team's mark per group, the same teams on both
//    stairs), the size and the stroke are C. On the dressed drums of the Hall of 100 Columns' yard the mark is cut on the
//    upper bedding face, hidden once the next drum is set (C).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shapeAtlas, carvedGeometry, bakeCarved, layoutMaxDepth, type Atlas, type Layout } from './carving';
import { v } from './spec';
import { incisedMaterial } from '../render/materials';
import { apadanaFacades, hostFace } from './decor';
import { planFacade, type StairGeom } from './reliefs';
import { defBounds, figureDef } from './relief_figures';
import type { Manifest, Part, Pt } from './parts';

type Poly = [number, number][];
export type MarkShape = 'double_lozenge' | 'circle' | 'cross' | 'angle';
const MM = () => v<any>('global', 'r_masons_marks');
/** the shapes' tier and what each rests on (dev overlay F3) */
export const MARK_NOTES: Record<MarkShape, string> = {
  double_lozenge: 'the "double diamond" sculptors\' mark of the Persepolis reliefs (ROAF1983, B); its form, two lozenges joined point to point, NOT SEEN (C)',
  circle: 'a circle, among the masons\' marks of Pasargadae and of the Lydian terraces at Sardis (PAS-MARKS, B); at Persepolis C',
  cross: 'a cross, among the masons\' marks of Pasargadae and Sardis (PAS-MARKS, B); at Persepolis C',
  angle: 'an L-shaped sign, among the masons\' marks of Pasargadae and Sardis (PAS-MARKS, B); at Persepolis C',
};

/** a stroke from a to b, `w` wide, as a counter-clockwise rectangle (em units, y up), its ends carried on by `ext` */
function stroke(a: [number, number], b: [number, number], w: number, ext = 0): Poly {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy * w / 2, ny = ux * w / 2;
  const A: [number, number] = [a[0] - ux * ext, a[1] - uy * ext], B: [number, number] = [b[0] + ux * ext, b[1] + uy * ext];
  return [[A[0] - nx, A[1] - ny], [B[0] - nx, B[1] - ny], [B[0] + nx, B[1] + ny], [A[0] + nx, A[1] + ny]];
}
const ccw = (p: Poly) => { let s = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1; } return s > 0 ? p : [...p].reverse(); };
const cw = (p: Poly) => [...ccw(p)].reverse();
/** the outlines of the marks in a unit em box (0..1), stroke `w` em (non-zero winding: holes clockwise) */
export function markShapes(w: number): Record<MarkShape, Poly[]> {
  const ring = (pts: (r: number) => Poly, r: number) => [ccw(pts(r)), cw(pts(r - w))];
  const circle = (r: number): Poly => Array.from({ length: 40 }, (_, i) => [0.5 + r * Math.cos((i / 40) * 2 * Math.PI), 0.5 + r * Math.sin((i / 40) * 2 * Math.PI)]);
  // a lozenge ring: half-width a, half-height b; the inner outline set in by w measured square to each side
  const lozenge = (cx: number, a: number, b: number): Poly[] => { const h = Math.hypot(a, b), ai = a - (w * h) / b, bi = b - (w * h) / a;
    const P = (x: number, y: number): Poly => [[cx + x, 0.5], [cx, 0.5 + y], [cx - x, 0.5], [cx, 0.5 - y]]; return [ccw(P(a, b)), cw(P(ai, bi))]; };
  return {
    circle: ring(circle, 0.42),
    cross: [ccw(stroke([0.5, 0.08], [0.5, 0.92], w)), ccw(stroke([0.08, 0.5], [0.92, 0.5], w))],
    angle: [ccw(stroke([0.28, 0.92], [0.28, 0.08], w, w / 2)), ccw(stroke([0.28, 0.08], [0.78, 0.08], w, w / 2))],
    double_lozenge: [...lozenge(0.285, 0.215, 0.36), ...lozenge(0.715, 0.215, 0.36)],
  };
}
let atlas: Atlas | null = null;
/** the marks' depth atlas (built once) */
export function marksAtlas(): Atlas { return (atlas ??= shapeAtlas(markShapes(MM().stroke_em) as unknown as Record<string, Poly[]>, 128)); }
export const MARK_SHAPES = (): MarkShape[] => MM().shapes;

/** one mark placed on a face: the face's frame (origin at the mark's centre on the face, X along, Y up the face, Z out) */
export interface MarkAt { shape: MarkShape; o: THREE.Vector3; X: THREE.Vector3; Y: THREE.Vector3; size: number; where: string }
/** every placed mark on one surface merged into one mesh (a draw), tiered and described per mark for the dev overlay */
export function marksMesh(marks: MarkAt[], surface: string, lift: number, name: string, note: string): THREE.Mesh | null {
  if (!marks.length) return null;
  const A = marksAtlas(), geos: THREE.BufferGeometry[] = [], owner: number[] = [];
  let depth = 0;
  marks.forEach((m, i) => {
    const L: Layout = { signs: [{ ch: m.shape, x: -m.size / 2, y: -m.size / 2 }], em: m.size, lines: 1, width: m.size, height: m.size, glyphH: m.size };
    const Z = m.X.clone().cross(m.Y).normalize(), g = carvedGeometry(A, L, 0, 0, lift);
    geos.push(bakeCarved(g, new THREE.Matrix4().makeBasis(m.X, m.Y, Z).setPosition(m.o))); g.dispose();
    for (let t = 0; t < 2; t++) owner.push(i); // one quad (two triangles) a mark
    depth = Math.max(depth, layoutMaxDepth(A, L));
  });
  const geo = mergeGeometries(geos)!; for (const g of geos) g.dispose();
  const mesh = new THREE.Mesh(geo, incisedMaterial(surface, A)); mesh.name = name; mesh.receiveShadow = true; mesh.castShadow = false; mesh.matrixAutoUpdate = false;
  mesh.userData = { tier: 'C', src: 'ROAF1983;IR-GREECE7;PAS-MARKS;MATCULT-R;RECON', marks: marks.length, depth, note: `${note}; ${marks.length} marks, deepest ${(depth * 1000).toFixed(1)} mm (V-section at 45°, C)`,
    describe: (hit: any) => { const m = marks[owner[hit?.faceIndex ?? -1]]; return m ? { tier: 'C', src: 'ROAF1983;PAS-MARKS', note: `${m.where}: ${MARK_NOTES[m.shape]}; size ${(m.size * 100).toFixed(0)} cm, place C` } : null; } };
  return mesh;
}

/** the sculptors' marks on the Apadana N and E stair reliefs: on the bottom register of each nobles' wing (the guards), every
 *  `every_guard`-th guard's mark on the background, in front of his spear blade or behind his shoulder above the quiver
 *  (ROAF1983's example, B: the position; which guards C); the guards are counted from the stair's centre outward, a team's
 *  mark on each run of `every_guard` guards, the same run of teams on both stairs (the same teams on both Apadana stairs:
 *  MATCULT-R, B; the order C) */
export function reliefMarkPlacements(m: Manifest, parts: Part[]): (MarkAt & { surface: string; facade: string; figure: number })[] {
  const a = m.apadana as any; if (!a) return [];
  const R = v<any>('apadana', 'r_registers'), CV = v<any>('apadana', 'r_relief_carving'), figH = R.height * CV.figure_fill, RM = MM().relief, shapes = MARK_SHAPES();
  const sg: StairGeom = { spans: a.stairSpans, riser: a.stairRiser, tread: a.stairTread, parapet: a.parapet, podium: a.podium };
  const out: (MarkAt & { surface: string; facade: string; figure: number })[] = [];
  for (const f of apadanaFacades(m)) {
    const plan = planFacade(f, sg), X = new THREE.Vector3(f.along[0], 0, -f.along[1]), Y = new THREE.Vector3(0, 1, 0);
    const boxes = figureBoxes(plan.figures, figH);
    const put = (p: (typeof plan.figures)[number], i: number, front: boolean, team: number, where: string) => {
      const shape = shapes[team % shapes.length], bb = defBounds(figureDef(p.kind, p.variant)), S = figH * p.scale;
      const along = front ? p.along + p.facing * (bb[2] * S + RM.guard_front[0] + RM.size / 2) : p.along + p.facing * (bb[0] * S - RM.guard_back[0] - RM.size / 2);
      const yy = p.y + (front ? RM.guard_front[1] : RM.guard_back[1]) * S, y = f.y0 + yy;
      if (!markClear(boxes, along, yy, RM.size)) return; // on the background only, clear of every figure's bounds
      const o2: Pt = [f.origin[0] + f.along[0] * along, f.origin[1] + f.along[1] * along];
      const host = hostFace(parts, o2, y, f.normal as Pt); if (!host) return;
      const o = new THREE.Vector3(o2[0] + f.normal[0] * host.d, y, -(o2[1] + f.normal[1] * host.d));
      out.push({ shape, o, X, Y, size: RM.size, surface: host.material, facade: f.id, figure: i, where: `Apadana ${f.id} stair: sculptors' mark (team ${team % shapes.length + 1}) ${where}` });
    };
    // the nobles' wings: guards on the bottom register, Persian and Median nobles above (each register counted from the
    // centre outward, a mark every `every_guard` figures, in front of the spear or flower / behind the shoulder in turn)
    const nobles = plan.figures.map((p, i) => ({ p, i })).filter(({ p }) => ['guard', 'mede_guard', 'persian', 'mede'].includes(p.kind));
    for (const y of [...new Set(nobles.map(n => n.p.y))]) for (const side of [-1, 1]) {
      const run = nobles.filter(g => g.p.y === y && Math.sign(g.p.along) === side).sort((p, q) => Math.abs(p.p.along) - Math.abs(q.p.along));
      run.forEach(({ p, i }, k) => { if (k % RM.every_guard) return; const team = Math.floor(k / RM.every_guard), front = team % 2 === 0, guard = p.kind.includes('guard');
        put(p, i, front, team, `${front ? `in front of the ${guard ? 'spear blade' : 'raised hand'}` : `behind the shoulder${guard ? ', above the quiver' : ''}`} of ${guard ? 'guard' : 'noble'} no. ${k + 1} from the centre, register ${Math.round((y - R.bottom) / (R.height + R.gap)) + 1}`); });
    }
    // the delegations: a group's mark behind its last man (labels the group; ROAF1983), the teams in the delegations' order
    let d = 0;
    plan.figures.forEach((p, i) => {
      if (p.kind !== 'usher') return;
      const group: number[] = []; for (let j = i + 1; j < plan.figures.length && plan.figures[j].kind !== 'cypress' && plan.figures[j].kind !== 'usher'; j++) if (plan.figures[j].kind === 'delegate') group.push(j);
      if (!group.length) return; const last = group.reduce((a, b) => (plan.figures[b].facing * plan.figures[b].along < plan.figures[a].facing * plan.figures[a].along ? b : a));
      put(plan.figures[last], last, false, d, `behind the last man of delegation ${++d} on this stair, labelling the group`);
    });
  }
  return out;
}
/** each placed figure's bounds on the façade (along range, height range above the façade foot) */
export function figureBoxes(figs: { kind: string; variant: number; along: number; y: number; facing: 1 | -1; scale: number }[], figH: number): [number, number, number, number][] {
  return figs.map(p => { const bb = defBounds(figureDef(p.kind, p.variant)), S = figH * p.scale, xa = p.along + p.facing * bb[0] * S, xb = p.along + p.facing * bb[2] * S;
    return [Math.min(xa, xb), p.y + bb[1] * S, Math.max(xa, xb), p.y + bb[3] * S]; });
}
/** a mark of `size` centred at (along, y) clears every figure box by 1 cm */
export const markClear = (boxes: [number, number, number, number][], along: number, y: number, size: number) =>
  !boxes.some(([x0, y0, x1, y1]) => along + size / 2 + 0.01 > x0 && along - size / 2 - 0.01 < x1 && y + size / 2 + 0.01 > y0 && y - size / 2 - 0.01 < y1);
/** the relief marks as meshes, one per host surface */
export function buildReliefMarks(m: Manifest, parts: Part[]): THREE.Group {
  const g = new THREE.Group(); g.name = 'masons-marks:apadana';
  const all = reliefMarkPlacements(m, parts), bySurf = new Map<string, MarkAt[]>();
  for (const p of all) (bySurf.get(p.surface) ?? bySurf.set(p.surface, []).get(p.surface)!).push(p);
  for (const [surf, list] of bySurf) { const mesh = marksMesh(list, surf, MM().relief.lift, `masons-marks:apadana:${surf}`, 'sculptors\' marks on the Apadana stair reliefs\' background (ROAF1983: B that they are there and what they mark; which figures, shapes and sizes C; D-212)'); if (mesh) g.add(mesh); }
  g.userData = { tier: 'C', src: 'ROAF1983;PAS-MARKS', note: `sculptors' marks on the Apadana stair reliefs: ${all.length} (D-212)`, marks: all.length };
  return g;
}
/** the mark cut on a dressed drum's upper bedding face (the Hall of 100 Columns' yard): drum centre (world), top y, radius,
 *  the drum's index in the yard (the team: a run of three drums a team, C) */
export function drumMark(c: THREE.Vector3, r: number, k: number): MarkAt {
  const D = MM().drum, shapes = MARK_SHAPES(), shape = shapes[Math.floor(k / 3) % shapes.length], ang = (k * 2.39996) % (2 * Math.PI);
  const X = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang)), Y = new THREE.Vector3(0, 1, 0).cross(X).normalize(); // X × Y = up
  const off = r * 0.55, o = c.clone().add(new THREE.Vector3(Math.cos(ang + Math.PI / 2) * off, 0, -Math.sin(ang + Math.PI / 2) * off));
  return { shape, o, X, Y, size: D.size, where: `a dressed drum in the masons' yard, on its upper bedding face (hidden once the next drum is set)` };
}
