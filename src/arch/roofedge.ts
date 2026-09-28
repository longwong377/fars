// D-334: the palaces' wall heads and roof edges, world-wide (every roof and every exposed mud-brick top of the Terrace's
// buildings and the fortification). Until session 12 a roof was one box of 'timber' laid on the walls: its top drawn as cedar
// planks, its sides a cedar band 1.2-2 m tall round every building, flush with the plaster, and nothing on it (the probe's
// Gate of All Nations: 'one flat orange wall' under a brown board). What stood there (all C unless noted):
//  - over a wall: the wall rising past the roof as a plastered parapet (PARAPET: 0.75 m over the roof's earth, 0.6 m thick)
//    with a mud coping a little wider than it (the seat of whatever crowned it), and a string course at the roof line
//    (one brick course corbelled out, plastered: the shadow line under the parapet); rain spouts through the parapet's foot
//    every ~7 m (a cedar trough, tools/blender/palacekit.py), the run-off streaks under them drawn by the plaster's own
//    weathering (materials.ts runoff);
//  - over a portico (no wall under the roof's edge: the columns): the timber entablature as the rock-cut tomb facades of
//    Naqsh-e Rustam copy it in stone (A for the form, as the palace portico's image: an architrave of three fasciae, each
//    stepping out over the one below, and over it a row of dentils, the ceiling joists' ends; NR-TOMB), here in cedar: the
//    fasciae as boxes, the joists' ends as the Blender-modelled beam end (palacekit.py) at the joists' own 0.55 m spacing
//    (ceilings.ts CEILING.joistStep), then the roof's earth edge plastered and the parapet as over a wall;
//  - an exposed top of a tower, a range or the fortification's curtain: its roof earth (a thin cap of roof_earth) with the
//    parapet round its free edges; the fortification's outer parapet crenellated in plastered mud brick (FORT_MERLON, C: the
//    fortified walls of the Near Eastern reliefs); a thin wall's top a mud coping.
// Render geometry only (as ceilings.ts): the boxes are not parts, so colliders, the walkable grid, the light probes and the
// plan tests keep the roofs as they were. An edge is drawn only where it is free: where another part continues the roof at
// its level or rises past the parapet (a tower, a higher hall) nothing is added.
import type { Part, Box, Material } from './parts';

export const ROOFEDGE = {
  parapet: { h: 0.75, t: 0.6, coping: { h: 0.08, over: 0.04 } },
  string: { h: 0.14, proj: 0.06 },       // one brick course (13 cm + joint) corbelled 6 cm, at the roof line
  proud: 0.006,                          // the parapet's skin over the roof slab's side (hides the slab's side face)
  fasciae: { n: 3, h: 0.18, step: 0.035, depth: 0.45 },
  dentil: { h: 0.2, w: 0.16, proj: 0.16, step: 0.55 },
  spout: { step: 7.0, end: 1.5, proj: 0.55 },
  fortMerlon: { w: 0.8, gap: 0.7, h: 0.7 },
  cap: 0.03,                             // the roof-earth cap on an exposed top (m)
  thinWall: 1.5,                         // a top narrower than this is a wall's coping, not a roof
  sample: 0.25,
  tier: 'C' as const, src: 'RECON;NR-TOMB',
};

/** an instanced modelled piece at a place: grid position of its back centre (e, n), height of its foot, the outward normal
 *  (grid azimuth, radians CCW from grid east), and its scale along the normal (a spout's length) */
export interface Piece { kind: 'dentil' | 'spout'; building: string; e: number; n: number; y: number; az: number; len: number }
export interface RoofEdges { boxes: Box[]; pieces: Piece[]; stats: { edges: number; free: number; wall: number; open: number; metres: number; tops: number } }

const inBox = (b: Box, e: number, n: number, y: number, pad = 0) => {
  if (y < b.y0 - 1e-6 || y > b.y1 + 1e-6) return false;
  const r = -(b.rot ?? 0), de = e - b.c[0], dn = n - b.c[1], u = de * Math.cos(r) - dn * Math.sin(r), v = de * Math.sin(r) + dn * Math.cos(r);
  return Math.abs(u) <= b.size[0] / 2 + pad && Math.abs(v) <= b.size[1] / 2 + pad;
};

/** a small uniform grid over the solid boxes (plan cells of 4 m) */
class Grid {
  private cells = new Map<number, Box[]>(); private C = 4;
  constructor(boxes: Box[]) {
    for (const b of boxes) { const R = Math.hypot(b.size[0], b.size[1]) / 2;
      for (let gx = Math.floor((b.c[0] - R) / this.C); gx <= Math.floor((b.c[0] + R) / this.C); gx++) for (let gy = Math.floor((b.c[1] - R) / this.C); gy <= Math.floor((b.c[1] + R) / this.C); gy++) {
        const k = gx * 100003 + gy; (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(b); } }
  }
  at(e: number, n: number, y: number, except?: Box, test: (b: Box) => boolean = () => true): Box | null {
    for (const b of this.cells.get(Math.floor(e / this.C) * 100003 + Math.floor(n / this.C)) ?? []) if (b !== except && test(b) && inBox(b, e, n, y)) return b;
    return null;
  }
}

const isWallish = (b: Box) => b.material.startsWith('mudbrick') || b.material === 'limestone' || b.material === 'plaster' || b.material === 'limestone_dark';
const building = (b: Box) => b.building;
const underConstruction = (b: Box) => /under construction/.test(b.note ?? '');

/** the edges of a rectangle (local frame of box b): for each side, its outward normal (grid), its two end points (grid) */
function sides(b: Box) {
  const r = b.rot ?? 0, c = Math.cos(r), s = Math.sin(r), hx = b.size[0] / 2, hy = b.size[1] / 2;
  const P = (u: number, v: number): [number, number] => [b.c[0] + u * c - v * s, b.c[1] + u * s + v * c];
  return [
    { n: [c, s] as [number, number], a: P(hx, -hy), b: P(hx, hy), az: r },
    { n: [-c, -s] as [number, number], a: P(-hx, hy), b: P(-hx, -hy), az: r + Math.PI },
    { n: [-s, c] as [number, number], a: P(hx, hy), b: P(-hx, hy), az: r + Math.PI / 2 },
    { n: [s, -c] as [number, number], a: P(-hx, -hy), b: P(hx, -hy), az: r - Math.PI / 2 },
  ];
}

/** a box along a run of an edge: from s0 to s1 (m along a→b), its outer face `out` m beyond the edge line (negative: inside),
 *  `depth` m deep inward, from y0 to y1 */
function runBox(base: Omit<Box, 'type' | 'kind' | 'c' | 'size' | 'y0' | 'y1' | 'rot'>, sd: ReturnType<typeof sides>[number], s0: number, s1: number, out: number, depth: number, y0: number, y1: number, kind: string, note: string): Box {
  const L = Math.hypot(sd.b[0] - sd.a[0], sd.b[1] - sd.a[1]), ux = (sd.b[0] - sd.a[0]) / L, uy = (sd.b[1] - sd.a[1]) / L, m = (s0 + s1) / 2, off = out - depth / 2;
  const c: [number, number] = [sd.a[0] + ux * m + sd.n[0] * off, sd.a[1] + uy * m + sd.n[1] * off];
  return { ...base, type: 'box', kind, c, size: [s1 - s0, depth], y0, y1, rot: Math.atan2(uy, ux), solid: false, note } as Box;
}

/** the wall heads and roof edges of these parts (render geometry: boxes to merge with the building's own materials, and
 *  the modelled pieces' placements) */
export function roofEdges(parts: Part[]): RoofEdges {
  const R = ROOFEDGE, boxes: Box[] = [], pieces: Piece[] = [], stats = { edges: 0, free: 0, wall: 0, open: 0, metres: 0, tops: 0 };
  const solid = parts.filter(p => p.type === 'box' && !p.door && !p.sculpt && p.kind !== 'floor_finish' && p.kind !== 'frieze' && !(p.kind || '').startsWith('ceiling')) as Box[];
  const grid = new Grid(solid);
  const roofs = solid.filter(p => p.kind === 'roof');
  // the exposed mud-brick tops (towers, ranges, the curtain): no part stands on their top
  const tops = solid.filter(p => p.kind !== 'roof' && p.material.startsWith('mudbrick') && !underConstruction(p) && ['wall', 'tower', 'curtain', 'storerooms'].includes(p.kind)
    && p.y1 - p.y0 > 2 && !coveredTop(p, grid));
  const heads: { b: Box; roof: boolean }[] = [...roofs.map(b => ({ b, roof: true })), ...tops.map(b => ({ b, roof: false }))];
  for (const { b, roof } of heads) {
    const base = { building: b.building, material: 'mudbrick' as Material, tier: R.tier, src: R.src, placeholder: false };
    const thin = !roof && Math.min(b.size[0], b.size[1]) < R.thinWall;
    const fort = b.building.startsWith('fortification');
    if (!roof) { // the exposed top: its earth (a roof) or its coping (a wall)
      stats.tops++;
      boxes.push(thin ? { ...base, type: 'box', kind: 'coping', c: b.c, size: [b.size[0] + 2 * R.parapet.coping.over, b.size[1] + 2 * R.parapet.coping.over], rot: b.rot, y0: b.y1 - 0.02, y1: b.y1 + R.parapet.coping.h, solid: false, note: 'mud coping of an exposed wall top (D-334, C)' } as Box
        : { ...base, material: 'roof_earth' as Material, type: 'box', kind: 'roof_cap', c: b.c, size: b.size, rot: b.rot, y0: b.y1 - 0.01, y1: b.y1 + R.cap, solid: false, note: 'packed earth with its clay-and-straw coat on an exposed top (D-334, C)' } as Box);
      if (thin) continue;
    }
    const topY = roof ? b.y1 : b.y1 + R.cap;
    for (const sd of sides(b)) {
      stats.edges++;
      const L = Math.hypot(sd.b[0] - sd.a[0], sd.b[1] - sd.a[1]), ux = (sd.b[0] - sd.a[0]) / L, uy = (sd.b[1] - sd.a[1]) / L;
      const nS = Math.max(2, Math.round(L / R.sample)), st = L / nS;
      // per sample: free (nothing continues the roof beyond the edge at the slab's level or rises past the parapet), and
      // what carries the edge (a wall under it, or open: a portico's columns)
      const kind: ('wall' | 'open' | null)[] = [];
      for (let i = 0; i < nS; i++) {
        const s = (i + 0.5) * st, e = sd.a[0] + ux * s, n = sd.a[1] + uy * s, eo = e + sd.n[0] * 0.15, no = n + sd.n[1] * 0.15;
        const cov = grid.at(eo, no, (b.y0 + topY) / 2, b) || grid.at(eo, no, topY + 0.3, b);
        if (cov) { kind.push(null); continue; }
        const ei = e - sd.n[0] * 0.25, ni = n - sd.n[1] * 0.25;
        kind.push(!roof || grid.at(ei, ni, b.y0 - 0.4, b, isWallish) ? 'wall' : 'open');
      }
      // runs of one kind
      for (let i = 0; i < nS;) {
        const k = kind[i]; let j = i; while (j < nS && kind[j] === k) j++;
        const s0 = i * st, s1 = j * st; i = j;
        if (!k || s1 - s0 < 0.5) continue;
        stats.free++; stats[k]++; stats.metres += s1 - s0;
        // the run's ends: stop a parapet's thickness short at a free end? no: parapets of adjacent sides overlap at the corner
        const P = R.parapet, T = P.t;
        let skinFrom = roof ? b.y0 : topY - 0.3;
        if (k === 'open') { // the timber entablature: three fasciae stepping out, the dentils (joist ends) over them
          const F = R.fasciae, D = R.dentil;
          for (let f = 0; f < F.n; f++) boxes.push(runBox({ ...base, material: 'timber' }, sd, s0, s1, R.proud + F.step * (f + 1), F.depth, b.y0 + f * F.h, b.y0 + (f + 1) * F.h, 'fascia', `architrave fascia ${f + 1} of ${F.n} in cedar (the Naqsh-e Rustam facades' entablature: A for the form; D-334, C)`));
          const yD = b.y0 + F.n * F.h, nD = Math.floor((s1 - s0 - D.w) / D.step) + 1, pad = (s1 - s0 - (nD - 1) * D.step) / 2;
          for (let q = 0; q < nD; q++) { const s = s0 + pad + q * D.step; pieces.push({ kind: 'dentil', building: b.building, e: sd.a[0] + ux * s + sd.n[0] * R.proud, n: sd.a[1] + uy * s + sd.n[1] * R.proud, y: yD, az: sd.az, len: D.proj }); }
          skinFrom = yD;
        }
        // the skin over the slab's side and the parapet over the roof's earth
        boxes.push(runBox(base, sd, s0, s1, R.proud, T, skinFrom, topY + P.h, 'parapet', 'plastered parapet over the roof (D-334, C)'));
        // the coping: the seat of the parapet's crown, 4 cm over each face (the fortification: the crenellation's foot)
        boxes.push(runBox(base, sd, s0, s1, R.proud + P.coping.over, T + 2 * P.coping.over, topY + P.h, topY + P.h + P.coping.h, 'coping', 'mud coping on the parapet (D-334, C)'));
        // the string course at the roof line (over a wall; a portico has its dentils there)
        if (k === 'wall') boxes.push(runBox(base, sd, s0, s1, R.proud + R.string.proj, R.string.proj + 0.1, topY - R.string.h, topY, 'string_course', 'plastered brick course corbelled out at the roof line (D-334, C)'));
        // rain spouts through the parapet's foot, every ~7 m, clear of the run's ends (a wall's run only)
        if (k === 'wall' && s1 - s0 > 2 * R.spout.end + 0.5) {
          const nSp = Math.max(1, Math.round((s1 - s0 - 2 * R.spout.end) / R.spout.step)), gap = (s1 - s0 - 2 * R.spout.end) / nSp;
          for (let q = 0; q < nSp; q++) { const s = s0 + R.spout.end + (q + 0.5) * gap; pieces.push({ kind: 'spout', building: b.building, e: sd.a[0] + ux * s + sd.n[0] * (R.proud + R.string.proj), n: sd.a[1] + uy * s + sd.n[1] * (R.proud + R.string.proj), y: topY + 0.02, az: sd.az, len: R.spout.proj }); }
        }
        // the fortification's crenellation: merlons of plastered brick on the coping (C)
        if (fort) {
          const M = R.fortMerlon, per = M.w + M.gap, nM = Math.floor((s1 - s0 + M.gap) / per), pad = (s1 - s0 - (nM * per - M.gap)) / 2;
          for (let q = 0; q < nM; q++) { const a0 = s0 + pad + q * per; boxes.push(runBox(base, sd, a0, a0 + M.w, R.proud, T, topY + P.h + P.coping.h - 0.02, topY + P.h + P.coping.h + M.h, 'merlon', 'plastered mud-brick merlon of the fortification (D-334, C)')); }
        }
      }
    }
  }
  return { boxes, pieces, stats };
}

/** whether another part stands on this box's top (samples over its top face) */
function coveredTop(b: Box, grid: Grid): boolean {
  const r = b.rot ?? 0, c = Math.cos(r), s = Math.sin(r);
  let hit = 0, n = 0;
  for (const fu of [-0.35, 0, 0.35]) for (const fv of [-0.35, 0, 0.35]) {
    const u = fu * b.size[0], v = fv * b.size[1], e = b.c[0] + u * c - v * s, nn = b.c[1] + u * s + v * c; n++;
    if (grid.at(e, nn, b.y1 + 0.05, b)) hit++;
  }
  return hit > n / 2;
}
