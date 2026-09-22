// Parametric Terrace generator. Every dimension comes from SITE_SPEC (src/data/site_spec.json): attested/inferred rows,
// DERIVED rows, or `r_*` reconstruction rows (tier C, with a note each) — no literals (brief §3.1, §7; review MJ-1).
// Positions come from the georeferenced OSM footprints. Output: parts + a manifest of measured features.
import { row, v, tierOf, srcOf, present, footprint } from './spec';
import { Part, Pt, Box, Prism, Column, Manifest, wallRing, grid, BuildResult, Material } from './parts';
import { order } from './orders';
import { Rng } from '../core/rng';

type Tier = 'A' | 'B' | 'C';
const P = (building: string, kind: string, material: Material, tier: Tier, src: string, extra: Partial<Part> = {}) => ({ building, kind, material, tier, src, ...extra });
const col = (building: string, c: Pt, y0: number, ord: ReturnType<typeof order>, tier: Tier, src: string, built = 1): Column => ({ ...P(building, 'column', ord.material, tier, src), type: 'column', c, y0, order: ord, built });
const prism = (b: string, kind: string, m: Material, t: Tier, s: string, polygon: Pt[], y0: number, y1: number, extra: Partial<Part> = {}): Prism => ({ ...P(b, kind, m, t, s, extra), type: 'prism', polygon, y0, y1 } as Prism);
const box = (b: string, kind: string, m: Material, t: Tier, s: string, c: Pt, size: [number, number], y0: number, y1: number, extra: Partial<Part> = {}): Box => ({ ...P(b, kind, m, t, s, extra), type: 'box', c, size, y0, y1 } as Box);
const T_ = (b: string, k: string) => row(b, k).tier.slice(-1) as Tier;
const S_ = (b: string, k: string) => row(b, k).src;

/** straight flight of solid steps from `start` (foot of the first riser) rising along `dir` */
function flight(b: string, t: Tier, s: string, start: Pt, dir: 'N' | 'S' | 'E' | 'W', steps: number, riser: number, tread: number, width: number, y0: number, base: number): Box[] {
  const out: Box[] = []; const d = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[dir];
  for (let i = 0; i < steps; i++) {
    const along = (i + 0.5) * tread;
    out.push(box(b, 'step', 'limestone', t, s, [start[0] + d[0] * along, start[1] + d[1] * along], d[0] ? [tread, width] : [width, tread], base, y0 + (i + 1) * riser, { solid: true }));
  }
  return out;
}
/** extreme coordinate of a polygon's boundary along a scan line (e.g. the N edge at x = const) */
function edgeAt(poly: Pt[], axis: 'x' | 'y', value: number, pick: 'max' | 'min'): number {
  const hits: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const [u0, u1, w0, w1] = axis === 'x' ? [a[0], b[0], a[1], b[1]] : [a[1], b[1], a[0], b[0]];
    if ((u0 - value) * (u1 - value) <= 0 && u0 !== u1) hits.push(w0 + (w1 - w0) * (value - u0) / (u1 - u0));
  }
  return pick === 'max' ? Math.max(...hits) : Math.min(...hits);
}
function ringSign(p: Pt[]) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a > 0 ? 1 : -1; }

export function buildTerrace(): BuildResult {
  const parts: Part[] = []; const manifest: Manifest = {};
  const FOUND = -v('global', 'r_found_depth');
  const EAST = v('global', 'r_east_side_x');
  const RISER = row('grand_stair', 'riser'), TREAD = row('grand_stair', 'tread');
  const plainY = -v('global', 'stair_total_rise');

  // ---------------- Terrace platform (terrace polygon minus Grand Stair recess) ----------------
  {
    const T = footprint('terrace').polygon.slice(0, -1) as Pt[];
    const S = (footprint('grand_stair').polygon as Pt[]).slice(0, -1);
    const key = (p: Pt) => `${p[0]},${p[1]}`;
    const shared = T.map((p, i) => [i, S.findIndex(q => key(q) === key(p))]).filter(([, j]) => j >= 0);
    // the stair's outer (W) edge nodes are shared with the terrace outline; the recess is the stair's remaining boundary
    const iTop = Math.min(...shared.map(([i]) => i)), iBot = Math.max(...shared.map(([i]) => i));
    const jTop = shared.find(([i]) => i === iTop)![1], jBot = shared.find(([i]) => i === iBot)![1];
    const walk = (from: number, to: number) => { const r: Pt[] = []; for (let j = (from + 1) % S.length; j !== to; j = (j + 1) % S.length) if (!T.some(p => key(p) === key(S[j]))) r.push(S[j]); return r; };
    const ra = walk(jTop, jBot), rb = walk(jBot, jTop); const recess = ra.length >= rb.length ? ra : rb;
    // walk direction: choose the orientation that goes around the E side of the stair (x > terrace-edge x)
    const recessPath = recess.some(p => p[0] > -35) ? recess : [];
    if (!recessPath.length) throw new Error('recess path not found');
    const ordered = Math.abs(recessPath[0][1] - T[iTop][1]) < Math.abs(recessPath[recessPath.length - 1][1] - T[iTop][1]) ? recessPath : [...recessPath].reverse();
    const poly = [...T.slice(0, iTop + 1), ...ordered, ...T.slice(iBot)] as Pt[];
    parts.push(prism('terrace', 'platform', 'limestone', 'B', srcOf(row('terrace', 'extent_ns'), row('terrace', 'stair_recess')), poly, FOUND, 0, { solid: true, note: 'retaining walls of dressed grey limestone; top = court datum' }));
    const ph = v('terrace', 'parapet_height'), pt = v('terrace', 'r_parapet_thickness'), sg = ringSign(poly);
    const topOpen = [ordered.reduce((m, p) => (p[0] > m[0] ? p : m)), ordered.filter(p => p[0] > -35)].flat() as any;
    const eastmost = ordered.filter(p => p[0] > -35).map(key);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b2 = poly[(i + 1) % poly.length];
      if (a[0] > EAST && b2[0] > EAST) continue; // E side: fortification wall instead
      if (eastmost.includes(key(a)) && eastmost.includes(key(b2))) continue; // Grand Stair top landing opens onto the court
      const len = Math.hypot(b2[0] - a[0], b2[1] - a[1]); if (len < 0.5) continue;
      const nx = -(b2[1] - a[1]) / len, ny = (b2[0] - a[0]) / len; // left normal; inward if ring is CCW
      const c: Pt = [(a[0] + b2[0]) / 2 + sg * nx * pt / 2, (a[1] + b2[1]) / 2 + sg * ny * pt / 2];
      parts.push({ ...box('terrace', 'parapet', 'limestone', T_('terrace', 'parapet_height'), S_('terrace', 'parapet_height'), c, [len, pt], 0, ph, { solid: true }), rot: Math.atan2(b2[1] - a[1], b2[0] - a[0]) });
    }
    void topOpen;
    manifest.terrace = { polygonVertices: poly.length };
  }

  // ---------------- Grand Stair ----------------
  {
    const b = 'grand_stair', t = tierOf(RISER, TREAD), s = srcOf(RISER, TREAD, row(b, 'lower_flight_y'));
    const r = RISER.v as number, tr = TREAD.v as number, cy = v(b, 'centre_y');
    const [wx0, wx1] = v<number[]>(b, 'west_lane_x'), [ex0, ex1] = v<number[]>(b, 'east_lane_x');
    const nLow = v(b, 'steps_lower'), nUp = v(b, 'steps_upper');
    const wW = v(b, 'r_flight_width_w'), wE = v(b, 'flight_width'), grp = v(b, 'r_parapet_step_group'), ph = v(b, 'parapet_height');
    const wxc = (wx0 + wx1) / 2, exc = (ex0 + ex1) / 2;
    const [ly0] = v<number[]>(b, 'lower_flight_y'), [, uy1] = v<number[]>(b, 'upper_flight_y'), [ty0, ty1] = v<number[]>(b, 'top_landing_y');
    const L = v<any>(b, 'outer_landing'); const hLand = plainY + nLow * r;
    const counts: number[] = [];
    for (const sgn of [1, -1]) {
      const m = (y: number) => cy + sgn * (y - cy);
      const lf = flight(b, t, s, [wxc, m(ly0)], sgn > 0 ? 'N' : 'S', nLow, r, tr, wW, plainY, FOUND);
      const [lw0, lw1] = L.west_lane_y, [le0, le1] = L.east_lane_y;
      parts.push(box(b, 'landing', 'limestone', t, s, [wxc, (m(lw0) + m(lw1)) / 2], [wx1 - wx0, Math.abs(lw1 - lw0)], FOUND, hLand, { solid: true }));
      parts.push(box(b, 'landing', 'limestone', t, s, [exc, (m(le0) + m(le1)) / 2], [ex1 - ex0, Math.abs(le1 - le0)], FOUND, hLand, { solid: true }));
      const uf = flight(b, t, s, [exc, m(uy1)], sgn > 0 ? 'S' : 'N', nUp, r, tr, wE, hLand, FOUND);
      parts.push(...lf, ...uf); counts.push(lf.length + uf.length);
      const pw = (wx1 - wx0 - wW) / 2, pe = (ex1 - ex0 - wE) / 2, pt = T_(b, 'parapet_height'), ps = S_(b, 'parapet_height');
      for (let k = 0; k < nLow; k += grp) { const k2 = Math.min(nLow, k + grp); const ya = m(ly0 + k * tr), yb = m(ly0 + k2 * tr);
        for (const px of [wx0 + pw / 2, wx1 - pw / 2]) parts.push(box(b, 'parapet', 'limestone', pt, ps, [px, (ya + yb) / 2], [pw, Math.abs(yb - ya)], FOUND, plainY + k2 * r + ph, { solid: true })); }
      for (let k = 0; k < nUp; k += grp) { const k2 = Math.min(nUp, k + grp); const ya = m(uy1 - k * tr), yb = m(uy1 - k2 * tr);
        for (const px of [ex0 + pe / 2, ex1 - pe / 2]) parts.push(box(b, 'parapet', 'limestone', pt, ps, [px, (ya + yb) / 2], [pe, Math.abs(yb - ya)], FOUND, hLand + k2 * r + ph, { solid: true })); }
    }
    parts.push(box(b, 'landing', 'limestone', t, s, [exc, (ty0 + ty1) / 2], [ex1 - ex0, ty1 - ty0], FOUND, 0, { solid: true, note: 'common upper landing facing the Gate' }));
    const [g0, g1] = v<number[]>(b, 'central_gap');
    parts.push(box(b, 'pavement', 'limestone', T_(b, 'block_construction'), 'IR-PERS', [wxc, (g0 + g1) / 2], [wx1 - wx0, g1 - g0], FOUND, plainY, { solid: true, note: "'pavement of huge well-polished gray limestone'" }));
    manifest.grand_stair = { stepsNorth: counts[0], stepsSouth: counts[1], riser: r, tread: tr, landingHeight: hLand, topHeight: plainY + (nLow + nUp) * r, flightWidthW: wW, flightWidthE: wE };
  }

  // ---------------- Gate of All Nations ----------------
  if (present('gate_nations')) {
    const b = 'gate_nations', f = footprint(b); const [x0, y0, x1, y1] = f.bounds; const c: Pt = [(x0 + x1) / 2, (y0 + y1) / 2];
    const hs = v(b, 'hall_side'), H = v(b, 'column_height'), fl = v(b, 'floor');
    const tx = ((x1 - x0) - hs) / 2, ty = ((y1 - y0) - hs) / 2; // wall_thickness row: DERIVED per axis from the OSM outer outline
    const s = srcOf(row(b, 'hall_side'), row(b, 'outer_size'));
    const dh = v(b, 'door_height'), dw = v(b, 'door_width');
    const roofY = fl + H + v(b, 'r_roof_above_capital');
    parts.push(box(b, 'floor', 'limestone', T_(b, 'floor'), S_(b, 'floor'), c, [x1 - x0, y1 - y0], FOUND, fl, { solid: true }));
    const doors = (v<string[]>(b, 'doors')).map(side => ({ side: side as any, at: 0, width: dw, height: dh }));
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: s }, c[0], c[1], hs, hs, 0, fl, roofY, doors, tx, ty).map(w => ({ ...w, solid: true })));
    const [nx, ny] = v<number[]>(b, 'columns');
    const ord = order(b, { base: 'bell', capital: 'composite' });
    for (const p of grid(nx, ny, c[0], c[1], v(b, 'interaxial'))) parts.push(col(b, p, fl, ord, T_(b, 'column_height'), S_(b, 'column_height')));
    parts.push(box(b, 'roof', 'timber', T_(b, 'roof'), S_(b, 'roof'), c, [x1 - x0, y1 - y0], roofY, roofY + v(b, 'r_roof_thickness'), { note: 'cedar beams, earth roof' }));
    // doorway colossi stand in the W and E door reveals, projecting outward from the wall faces (PLACEHOLDER blocks)
    const K = v<any>(b, 'r_colossus');
    for (const [side, sx, dir] of [['W', x0, -1], ['E', x1, 1]] as const) for (const dy of [-1, 1]) {
      parts.push(box(b, 'colossus', 'limestone', 'C', 'RECON', [sx + dir * (K.length / 2 - tx), c[1] + dy * (dw / 2 + K.width / 2)], [K.length, K.width], fl, fl + K.height,
        { placeholder: true, solid: true, note: `${side === 'W' ? 'bull' : 'human-headed winged bull'} colossus (IR-PERS B for the type; block PLACEHOLDER)` }));
    }
    manifest.gate_nations = { hallInteriorX: hs, hallInteriorY: hs, columns: nx * ny, columnHeight: ord.height, wallTx: tx, wallTy: ty, doors: doors.length, doorHeight: dh };
  }

  // ---------------- Apadana ----------------
  if (present('apadana')) {
    const b = 'apadana', f = footprint(b), poly = f.polygon.slice(0, -1) as Pt[];
    const pod = v(b, 'podium_height'), hs = v(b, 'hall_side'), [cx, cy] = v<number[]>(b, 'hall_centre'), ia = v(b, 'interaxial');
    const wt = v(b, 'wall_thickness'), H = v(b, 'column_height'), bh = v(b, 'building_height'), pdN = v(b, 'portico_depth_n');
    const s = srcOf(row(b, 'podium_height'), row(b, 'hall_side'));
    parts.push(prism(b, 'platform', 'limestone', 'B', srcOf(row(b, 'platform_footprint'), row(b, 'podium_height')), poly, FOUND, pod, { solid: true }));
    const D = v<any>(b, 'r_door');
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: srcOf(row(b, 'wall_thickness'), row(b, 'wall_height')) }, cx, cy, hs, hs, wt, pod, pod + v(b, 'wall_height'),
      (['N', 'W', 'E', 'S'] as const).map(side => ({ side, at: 0, width: D.width, height: D.height }))).map(w => ({ ...w, solid: true })));
    const hallOrd = order(b, { base: 'square2', capital: 'bull' }), porOrd = order(b, { base: 'bell', capital: 'bull' });
    const [hnx, hny] = v<number[]>(b, 'hall_columns');
    const hallCols = grid(hnx, hny, cx, cy, ia);
    for (const p of hallCols) parts.push(col(b, p, pod, hallOrd, tierOf(row(b, 'column_height'), row(b, 'interaxial')), s));
    const wo = hs / 2 + wt;
    const por = v<Record<string, [number, number]>>(b, 'porticoes'); const porticoCols: Pt[] = [];
    // N portico: [cols along x, rows]; W/E: [rows, cols along y]; rows at 1, 2, … bays out from the hall wall face
    for (let i = 0; i < por.N[0]; i++) for (let k = 1; k <= por.N[1]; k++) porticoCols.push([cx + (i - (por.N[0] - 1) / 2) * ia, cy + wo + k * ia]);
    for (const [side, sgn] of [['W', -1], ['E', 1]] as const) for (let i = 0; i < por[side][1]; i++) for (let k = 1; k <= por[side][0]; k++) porticoCols.push([cx + sgn * (wo + k * ia), cy + (i - (por[side][1] - 1) / 2) * ia]);
    for (const p of porticoCols) parts.push(col(b, p, pod, porOrd, tierOf(row(b, 'column_height'), row(b, 'porticoes')), s));
    const [px0, py0, px1] = f.bounds; const nEdge = cy + wo + pdN;
    const tE = v(b, 'r_tower_extra');
    const towers: [number, number, number, number][] = [[px0, cy + wo, cx - wo, nEdge], [cx + wo, cy + wo, px1, nEdge], [px0, py0, cx - wo, cy - wo], [cx + wo, py0, px1, cy - wo]];
    for (const [a0, b0, a1, b1] of towers) parts.push(box(b, 'tower', 'mudbrick', 'C', srcOf(row(b, 'corner_towers'), row(b, 'r_tower_extra')), [(a0 + a1) / 2, (b0 + b1) / 2], [a1 - a0, b1 - b0], pod, pod + bh + tE, { solid: true, note: 'corner tower (count B; size and height C)' }));
    parts.push(box(b, 'storerooms', 'mudbrick', 'C', S_(b, 'south_side'), [cx, (py0 + cy - wo) / 2], [2 * wo, cy - wo - py0], pod, pod + v(b, 'r_storeroom_height'), { solid: true }));
    const rs = S_(b, 'building_height');
    parts.push(box(b, 'roof', 'timber', 'C', rs, [cx, cy], [2 * wo, 2 * wo], pod + H, pod + bh));
    parts.push(box(b, 'roof', 'timber', 'C', rs, [cx, cy + wo + pdN / 2], [2 * wo, pdN], pod + H, pod + bh));
    parts.push(box(b, 'roof', 'timber', 'C', rs, [(px0 + cx - wo) / 2, cy], [cx - wo - px0, 2 * wo], pod + H, pod + bh));
    parts.push(box(b, 'roof', 'timber', 'C', rs, [(px1 + cx + wo) / 2, cy], [px1 - cx - wo, 2 * wo], pod + H, pod + bh));
    // N and E stairways, attached to the podium's true edge at the stair (review MJ-2)
    const sl = (row(b, 'stairs').v as any).N.length as number, sr = v(b, 'stair_riser'), nSt = Math.round(pod / sr), stTr = v(b, 'r_stair_tread'), stW = v(b, 'r_stair_width');
    const run = nSt * stTr, third = sl / 3;
    const stairParts = (axis: 'N' | 'E') => {
      // façade edge: N stair → min over the stair span of the podium's N edge; E stair → max of the E edge (stair overlaps a slanted edge rather than leaving a gap)
      const span = [-sl / 2, sl / 2].map(d => (axis === 'N' ? cx : cy) + d);
      const samples = Array.from({ length: 9 }, (_, i) => span[0] + (span[1] - span[0]) * i / 8);
      const edge = axis === 'N' ? Math.min(...samples.map(x => edgeAt(poly, 'x', x, 'max'))) : Math.max(...samples.map(y => edgeAt(poly, 'y', y, 'max')));
      const across = edge + stW / 2; // centre line of the stair zone, perpendicular to the façade
      const P2 = (along: number): Pt => axis === 'N' ? [cx + along, across] : [across, cy + along];
      const dirTo = (sgnAlong: number) => (axis === 'N' ? (sgnAlong > 0 ? 'E' : 'W') : (sgnAlong > 0 ? 'N' : 'S')) as any;
      const out: Part[] = [];
      const lt = T_(b, 'r_stair_layout'), ls = S_(b, 'r_stair_layout');
      // central part: two flights rising toward the centre from the ends of the central third, meeting a central landing
      for (const sg of [-1, 1]) out.push(...flight(b, lt, ls, P2(sg * third / 2), dirTo(-sg), nSt, sr, stTr, stW, 0, 0));
      const cl = third - 2 * run; out.push(box(b, 'landing', 'limestone', lt, ls, P2(0), axis === 'N' ? [cl, stW] : [stW, cl], 0, pod, { solid: true }));
      // outer parts: flights rising from the outer ends toward the centre, onto landings that adjoin the podium
      for (const sg of [-1, 1]) {
        out.push(...flight(b, lt, ls, P2(sg * sl / 2), dirTo(-sg), nSt, sr, stTr, stW, 0, 0));
        const l0 = sl / 2 - run, l1 = third / 2, lc = sg * (l0 + l1) / 2, ll = l0 - l1;
        out.push(box(b, 'landing', 'limestone', lt, ls, P2(lc), axis === 'N' ? [ll, stW] : [stW, ll], 0, pod, { solid: true }));
      }
      return { out, edge };
    };
    const N = stairParts('N'), E = stairParts('E'); parts.push(...N.out, ...E.out);
    // relief-bearing façade walls on the outer edge of each stair zone (reliefs are applied by decor.ts)
    const ft = v(b, 'r_facade_thickness');
    parts.push(box(b, 'facade', 'limestone', 'C', S_(b, 'r_facade_thickness'), [cx, N.edge + stW - ft / 2], [sl, ft], 0, pod, { solid: true }));
    parts.push(box(b, 'facade', 'limestone', 'C', S_(b, 'r_facade_thickness'), [E.edge + stW - ft / 2, cy], [ft, sl], 0, pod, { solid: true }));
    manifest.apadana = { hallColumns: hallCols.length, porticoColumns: porticoCols.length, columnHeight: hallOrd.height, interaxial: ia, hallInterior: hs, podium: pod, wallThickness: wt, stairLength: sl, nStairEdge: N.edge, eStairEdge: E.edge, stairWidth: stW, hallCentre: [cx, cy] as any };
  }

  // ---------------- Tachara ----------------
  if (present('tachara')) {
    const b = 'tachara', f = footprint(b), [x0, , x1, y1] = f.bounds, fl = v(b, 'floor');
    parts.push(prism(b, 'platform', 'limestone', 'B', srcOf(row(b, 'platform_footprint'), row(b, 'floor')), f.polygon.slice(0, -1) as Pt[], FOUND, fl, { solid: true }));
    const [, Lh] = v<number[]>(b, 'overall'); const bc: Pt = [(x0 + x1) / 2, y1 - Lh / 2];
    const [hx, hy] = v<number[]>(b, 'hall_size'), [ncx, ncy] = v<number[]>(b, 'hall_columns');
    const hc: Pt = [bc[0], bc[1] + v(b, 'r_hall_offset_n')]; const wt = v(b, 'r_wall');
    const ord = order(b, { base: 'square2', capital: 'bull' });
    const D = v<any>(b, 'r_doors');
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: 'RECON' }, hc[0], hc[1], hx, hy, wt, fl, fl + ord.height + v(b, 'r_wall_above_columns'),
      [{ side: 'S', at: 0, width: D.S.width, height: D.S.height }, { side: 'N', at: 0, width: D.N.width, height: D.N.height }]).map(w => ({ ...w, solid: true })));
    const cols = grid(ncx, ncy, hc[0], hc[1], hx / ncx, hy / ncy);
    for (const p of cols) parts.push(col(b, p, fl, ord, 'C', srcOf(row(b, 'hall_columns'), row(b, 'hall_size'))));
    const [pcx, pcy] = v<number[]>(b, 'portico'); const pc: Pt = [hc[0], hc[1] - hy / 2 - wt - v(b, 'r_portico_gap')];
    const pcols = grid(pcx, pcy, pc[0], pc[1], hx / ncx, v(b, 'r_portico_row_spacing'));
    for (const p of pcols) parts.push(col(b, p, fl, ord, T_(b, 'portico'), S_(b, 'portico')));
    const RF = v<any>(b, 'r_roof');
    parts.push(box(b, 'roof', 'timber', 'C', 'RECON', [hc[0], hc[1] + RF.offset_n], [hx + 2 * wt, hy + 2 * wt + RF.extend_s], fl + ord.height, fl + ord.height + RF.thickness));
    manifest.tachara = { hallColumns: cols.length, porticoColumns: pcols.length, floor: fl };
  }

  // ---------------- Hadish ----------------
  if (present('hadish')) {
    const b = 'hadish', f = footprint(b), [x0, y0, x1, y1] = f.bounds, fl = v(b, 'floor');
    parts.push(prism(b, 'platform', 'limestone', 'B', srcOf(row(b, 'platform_footprint'), row(b, 'floor')), f.polygon.slice(0, -1) as Pt[], FOUND, fl, { solid: true }));
    const ia = v(b, 'r_interaxial'), [hnx, hny] = v<number[]>(b, 'hall_columns'), [pnx, pny] = v<number[]>(b, 'portico'), wt = v(b, 'r_wall');
    const hc: Pt = [(x0 + x1) / 2, (y0 + y1) / 2 + v(b, 'r_hall_offset_n')];
    const hs = (hnx + 1) * ia; // one-bay margins as in the Apadana (DERIVED from r_interaxial)
    const ord = order(b, { base: 'plain', capital: 'bull' }); const D = v<any>(b, 'r_doors');
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: 'RECON' }, hc[0], hc[1], hs, hs, wt, fl, fl + ord.height + v(b, 'r_wall_above_columns'),
      [...D.N_offsets.map((at: number) => ({ side: 'N' as const, at, width: D.width, height: D.height })), { side: 'S', at: 0, width: D.width, height: D.height }]).map(w => ({ ...w, solid: true })));
    const cols = grid(hnx, hny, hc[0], hc[1], ia);
    for (const p of cols) parts.push(col(b, p, fl, ord, 'C', srcOf(row(b, 'hall_columns'), row(b, 'r_interaxial'))));
    const pcols = grid(pnx, pny, hc[0], hc[1] + hs / 2 + wt + v(b, 'r_portico_gap'), ia, v(b, 'r_portico_row_spacing'));
    for (const p of pcols) parts.push(col(b, p, fl, ord, 'C', S_(b, 'portico')));
    const RF = v<any>(b, 'r_roof');
    parts.push(box(b, 'roof', 'timber', 'C', 'RECON', [hc[0], hc[1] + RF.offset_n], [hs + 2 * wt, hs + 2 * wt + RF.extend], fl + ord.height, fl + ord.height + v(b, 'r_wall_above_columns')));
    manifest.hadish = { hallColumns: cols.length, porticoColumns: pcols.length, floor: fl };
  }

  // ---------------- Hall of a Hundred Columns (under construction) ----------------
  if (present('hall100')) {
    const b = 'hall100', f = footprint(b), [x0, y0, x1, y1] = f.bounds, fl = v(b, 'floor'), hs = v(b, 'hall_side'), ia = v(b, 'interaxial');
    const c: Pt = [(x0 + x1) / 2, (y0 + y1) / 2];
    const tx = ((x1 - x0) - hs) / 2, ty = ((y1 - y0) - hs) / 2;
    const CP = v<any>(b, 'r_construction_probs'); const rng = new Rng(1, 'hall100-construction');
    parts.push(box(b, 'floor', 'limestone', 'C', S_(b, 'floor'), c, [x1 - x0, y1 - y0], FOUND, fl, { solid: true }));
    const ord = order(b, { base: 'bell', capital: 'bull' });
    const wallH = (ord.height + v(b, 'r_wall_top_above_columns')) / 3;
    const nDoors = v(b, 'doors'); const perSide = nDoors / 4;
    const doors = (['N', 'S', 'E', 'W'] as const).flatMap(side => Array.from({ length: perSide }, (_, k) => ({ side, at: (k - (perSide - 1) / 2) * hs / perSide, width: v(b, 'r_door_width'), height: Infinity })));
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: 'RECON' }, c[0], c[1], hs, hs, 0, fl, fl + wallH, doors, tx, ty).map(w => ({ ...w, solid: true, note: 'under construction: walls at ~1/3 height' })));
    let raised = 0; const [nx, ny] = v<number[]>(b, 'hall_columns'); const pts = grid(nx, ny, c[0], c[1], ia);
    for (const p of pts) { const u = rng.next(); const built = u < CP.raised ? 1 : u < CP.raised + CP.partial ? CP.partial_min + CP.partial_span * rng.next() : 0; if (built === 1) raised++; parts.push(col(b, p, fl, ord, 'C', srcOf(row(b, 'construction_state'), row(b, 'interaxial')), built)); }
    const [pnx, pny] = v<number[]>(b, 'portico');
    const por = grid(pnx, pny, c[0], y1 + v(b, 'r_portico_gap'), ia, v(b, 'r_portico_row_spacing'));
    for (const p of por) parts.push(col(b, p, fl, ord, 'C', S_(b, 'portico'), 0));
    manifest.hall100 = { columns: pts.length, porticoColumns: por.length, raised, interaxial: ia, hallInterior: hs, columnHeight: ord.height };
  }

  // ---------------- Tripylon (under construction) ----------------
  if (present('tripylon')) {
    const b = 'tripylon', f = footprint(b), [x0, y0, x1, y1] = f.bounds, fl = v(b, 'floor');
    parts.push(prism(b, 'platform', 'limestone', 'B', S_(b, 'floor'), f.polygon.slice(0, -1) as Pt[], FOUND, fl, { solid: true }));
    const c: Pt = [(x0 + x1) / 2, (y0 + y1) / 2]; const ord = order(b, { base: 'bell', capital: 'bull' });
    const hall = v(b, 'r_hall'), dw = v(b, 'r_door_width');
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: 'RECON' }, c[0], c[1], hall, hall, v(b, 'r_wall'), fl, fl + ord.height * v(b, 'r_wall_fraction_built'),
      (['N', 'E', 'S'] as const).map(side => ({ side, at: 0, width: dw, height: Infinity }))).map(w => ({ ...w, solid: true, note: 'under construction' })));
    const [nx, ny] = v<number[]>(b, 'hall_columns');
    for (const p of grid(nx, ny, c[0], c[1], v(b, 'r_interaxial'))) parts.push(col(b, p, fl, ord, 'C', 'RECON', v(b, 'r_column_built')));
    manifest.tripylon = { columns: nx * ny, floor: fl };
  }

  // ---------------- Treasury, Harem, Garrison (perimeter walls + key halls; C interiors) ----------------
  const perimeter = (b: string, fkey: string, fl: number, wallT: number, wallH: number, note: string) => {
    const poly = footprint(fkey).polygon.slice(0, -1) as Pt[]; const sg = ringSign(poly);
    parts.push(prism(b, 'floor', 'earth', 'B', 'OSM', poly, FOUND, fl, { solid: true }));
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], c2 = poly[(i + 1) % poly.length], len = Math.hypot(c2[0] - a[0], c2[1] - a[1]); if (len < wallT / 2) continue;
      const nx = -(c2[1] - a[1]) / len, ny = (c2[0] - a[0]) / len;
      parts.push({ ...box(b, 'wall', 'mudbrick', 'C', 'RECON', [(a[0] + c2[0]) / 2 + sg * nx * wallT / 2, (a[1] + c2[1]) / 2 + sg * ny * wallT / 2], [len, wallT], fl, fl + wallH, { solid: true, note }), rot: Math.atan2(c2[1] - a[1], c2[0] - a[0]) });
    }
  };
  if (present('treasury')) {
    const b = 'treasury', fl = v(b, 'floor') + v(b, 'r_floor_raise'), W = v<any>(b, 'r_wall');
    perimeter(b, 'treasury', fl, W.thickness, W.height, 'Treasury enclosure (C thickness/height); single NE entrance not yet cut');
    const [x0, y0, x1, y1] = footprint(b).bounds;
    const ord = order(b, { base: 'square2', capital: 'plain', material: 'timber' });
    const [gx, gy] = v<number[]>(b, 'r_hall99_grid');
    const pts = grid(gx, gy, (x0 + x1) / 2, (y0 + y1) / 2 + v(b, 'r_hall99_offset_n'), v(b, 'r_hall99_spacing'));
    for (const p of pts) parts.push(col(b, p, fl, ord, 'C', S_(b, 'hall99')));
    manifest.treasury = { hall99Columns: pts.length, columnHeight: ord.height };
  }
  if (present('harem')) {
    const b = 'harem', fl = v(b, 'floor'), W = v<any>(b, 'r_wall'); perimeter(b, 'harem', fl, W.thickness, W.height, 'Harem enclosure (C)');
    const [x0, y0, x1, y1] = footprint(v<string>(b, 'r_main_wing_footprint')).bounds;
    const c: Pt = [(x0 + x1) / 2, (y0 + y1) / 2]; const ord = order(b, { base: 'bell', capital: 'bull' }); const ia = v(b, 'r_interaxial');
    const [hnx, hny] = v<number[]>(b, 'hall_columns'), [pnx, pny] = v<number[]>(b, 'portico');
    const hall = grid(hnx, hny, c[0], c[1] + v(b, 'r_hall_offset_n'), ia); for (const p of hall) parts.push(col(b, p, fl, ord, 'C', S_(b, 'hall_columns')));
    const por = grid(pnx, pny, c[0], c[1] - v(b, 'r_portico_offset_s'), ia, v(b, 'r_portico_row_spacing')); for (const p of por) parts.push(col(b, p, fl, ord, 'C', S_(b, 'portico')));
    manifest.harem = { hallColumns: hall.length, porticoColumns: por.length };
  }
  if (present('garrison')) { const W = v<any>('garrison', 'r_wall'); perimeter('garrison', 'garrison', v('garrison', 'floor') + v('garrison', 'r_floor_raise'), W.thickness, W.height, 'garrison quarters (C)'); }

  // ---------------- East fortification (mud brick) ----------------
  if (present('fortification_e')) {
    const b = 'fortification_e', t = v(b, 'wall_thickness'), h = v(b, 'curtain_height'), th = v(b, 'tower_extra_height'), sp = v(b, 'tower_spacing'), TW = v<any>(b, 'r_tower');
    const T = footprint('terrace').polygon as Pt[]; const sg = ringSign(T.slice(0, -1));
    let towers = 0;
    for (let i = 0; i < T.length - 1; i++) {
      const a = T[i], c2 = T[i + 1]; if (!(a[0] > EAST && c2[0] > EAST)) continue;
      const len = Math.hypot(c2[0] - a[0], c2[1] - a[1]); if (len < 2) continue;
      const nx = -(c2[1] - a[1]) / len, ny = (c2[0] - a[0]) / len, rot = Math.atan2(c2[1] - a[1], c2[0] - a[0]);
      parts.push({ ...box(b, 'curtain', 'mudbrick', 'B', srcOf(row(b, 'wall_thickness'), row(b, 'curtain_height')), [(a[0] + c2[0]) / 2 + sg * nx * t / 2, (a[1] + c2[1]) / 2 + sg * ny * t / 2], [len, t], 0, h, { solid: true }), rot });
      for (let d = sp / 2; d < len; d += sp) {
        const u = d / len; const p: Pt = [a[0] + (c2[0] - a[0]) * u + sg * nx * t / 2, a[1] + (c2[1] - a[1]) * u + sg * ny * t / 2];
        parts.push({ ...box(b, 'tower', 'mudbrick', 'C', srcOf(row(b, 'tower_spacing'), row(b, 'r_tower')), p, [TW.length, t + TW.extra_width], 0, h + th, { solid: true }), rot }); towers++;
      }
    }
    manifest.fortification_e = { towers, thickness: t, height: h };
  }
  return { parts, manifest };
}
