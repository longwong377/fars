// Parametric Terrace generator (Phase 2 greybox). Every dimension comes from SITE_SPEC (src/data/site_spec.json) or the
// OSM footprints; derivations are commented with the spec rows they use. Output: parts + a manifest of measured features.
import { SPEC, row, v, tierOf, srcOf, present, footprint, FOOTPRINTS } from './spec';
import { Part, Pt, Box, Prism, Column, Manifest, rect, wallRing, grid, BuildResult, Material } from './parts';
import { order } from './orders';
import { Rng } from '../core/rng';

type Tier = 'A' | 'B' | 'C';
const P = (building: string, kind: string, material: Material, tier: Tier, src: string, extra: Partial<Part> = {}) => ({ building, kind, material, tier, src, ...extra });
const col = (building: string, c: Pt, y0: number, ord: ReturnType<typeof order>, tier: Tier, src: string, built = 1): Column => ({ ...P(building, 'column', ord.material, tier, src), type: 'column', c, y0, order: ord, built });
const prism = (b: string, kind: string, m: Material, t: Tier, s: string, polygon: Pt[], y0: number, y1: number, extra: Partial<Part> = {}): Prism => ({ ...P(b, kind, m, t, s, extra), type: 'prism', polygon, y0, y1 } as Prism);
const box = (b: string, kind: string, m: Material, t: Tier, s: string, c: Pt, size: [number, number], y0: number, y1: number, extra: Partial<Part> = {}): Box => ({ ...P(b, kind, m, t, s, extra), type: 'box', c, size, y0, y1 } as Box);

const FOUND = -20; // platform prisms reach below the plain (court − 20 m) so no gap shows at the terrain

/** straight flight of solid steps: from start point (bottom of first riser), rising along `dir` (+x,−x,+y,−y) */
function flight(b: string, t: Tier, s: string, start: Pt, dir: 'N' | 'S' | 'E' | 'W', steps: number, riser: number, tread: number, width: number, y0: number, base = FOUND): Box[] {
  const out: Box[] = []; const d = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[dir];
  for (let i = 0; i < steps; i++) {
    const along = (i + 0.5) * tread;
    const c: Pt = [start[0] + d[0] * along, start[1] + d[1] * along];
    out.push(box(b, 'step', 'limestone', t, s, c, d[0] ? [tread, width] : [width, tread], base, y0 + (i + 1) * riser, { solid: true }));
  }
  return out;
}

export function buildTerrace(): BuildResult {
  const parts: Part[] = []; const manifest: Manifest = {};
  const RISER = row('grand_stair', 'riser'), TREAD = row('grand_stair', 'tread');
  const rise = v('global', 'stair_total_rise');
  const plainY = -rise; // plain at stair foot relative to court (global.plain_at_stair_asl vs court_asl)

  // ---------------- Terrace platform (terrace polygon minus Grand Stair recess) ----------------
  {
    const T = footprint('terrace').polygon.slice(0, -1) as Pt[]; // closed ring → open
    const S = footprint('grand_stair').polygon as Pt[];
    const key = (p: Pt) => `${p[0]},${p[1]}`;
    const iTop = T.findIndex(p => key(p) === '-47.73,164.82'), iBot = T.findIndex(p => key(p) === '-47.17,80.07');
    if (iTop < 0 || iBot < 0) throw new Error('stair/terrace shared nodes not found');
    // recess path (stair's inner outline) from the top shared node to the bottom one — taken from the stair footprint
    const recess: Pt[] = [[-41.18, 164.83], [-41.16, 157.78], [-32.47, 157.79], [-32.16, 87.49], [-40.62, 87.48], [-40.59, 80.07]];
    for (const r of recess) if (!S.some(p => key(p) === key(r))) throw new Error('recess node not in stair footprint ' + key(r));
    const poly = [...T.slice(0, iTop + 1), ...recess, ...T.slice(iBot)] as Pt[];
    const tr = row('terrace', 'extent_ns');
    parts.push(prism('terrace', 'platform', 'limestone', 'B', srcOf(tr, row('terrace', 'stair_recess')), poly, FOUND, 0, { solid: true, note: 'retaining walls of dressed grey limestone; top = court datum' }));
    // parapet (C) on outer edges, except the Grand Stair top-landing opening and the E side (fortification)
    const ph = v('terrace', 'parapet_height'), prow = row('terrace', 'parapet_height');
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b2 = poly[(i + 1) % poly.length];
      if (a[0] > 200 && b2[0] > 200) continue;
      if (key(a) === '-32.47,157.79' && key(b2) === '-32.16,87.49') continue;
      const len = Math.hypot(b2[0] - a[0], b2[1] - a[1]); if (len < 0.5) continue;
      const ang = Math.atan2(b2[1] - a[1], b2[0] - a[0]);
      parts.push({ ...box('terrace', 'parapet', 'limestone', prow.tier as Tier, prow.src, [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2], [len, 0.6], 0, ph, { solid: true }), rot: ang });
    }
    manifest.terrace = { polygonVertices: poly.length };
  }

  // ---------------- Grand Stair ----------------
  {
    const b = 'grand_stair', t = tierOf(RISER, TREAD), s = srcOf(RISER, TREAD, row(b, 'lower_flight_y'));
    const r = RISER.v as number, tr = TREAD.v as number, cy = v<number>(b, 'centre_y');
    const [wx0, wx1] = v<number[]>(b, 'west_lane_x'), [ex0, ex1] = v<number[]>(b, 'east_lane_x');
    const nLow = v(b, 'steps_lower'), nUp = v(b, 'steps_upper');
    const wW = 6.2, wE = v(b, 'flight_width'); // W lane flights 6.2 inside 0.15 m parapet margins; E lane 6.9 (spec note)
    const wxc = (wx0 + wx1) / 2, exc = (ex0 + ex1) / 2;
    const [ly0, ly1] = v<number[]>(b, 'lower_flight_y'), [uy0, uy1] = v<number[]>(b, 'upper_flight_y'), [ty0, ty1] = v<number[]>(b, 'top_landing_y');
    const L = v<any>(b, 'outer_landing'); const hLand = plainY + nLow * r;
    let stepsN = 0, stepsS = 0;
    for (const sgn of [1, -1]) { // north half, then mirrored south half
      const m = (y: number) => cy + sgn * (y - cy);
      // lower flight: rises outward from the centre, W lane
      const lf = flight(b, t, s, [wxc, m(ly0)], sgn > 0 ? 'N' : 'S', nLow, r, tr, wW, plainY);
      // outer landing (L-shaped): W lane + E lane parts
      const [lw0, lw1] = L.west_lane_y, [le0, le1] = L.east_lane_y;
      const land1 = box(b, 'landing', 'limestone', t, s, [wxc, (m(lw0) + m(lw1)) / 2], [wx1 - wx0, Math.abs(lw1 - lw0)], FOUND, hLand, { solid: true });
      const land2 = box(b, 'landing', 'limestone', t, s, [exc, (m(le0) + m(le1)) / 2], [ex1 - ex0, Math.abs(le1 - le0)], FOUND, hLand, { solid: true });
      // upper flight: E lane, rises back toward the centre
      const uf = flight(b, t, s, [exc, m(uy1)], sgn > 0 ? 'S' : 'N', nUp, r, tr, wE, hLand);
      parts.push(...lf, land1, land2, ...uf);
      if (sgn > 0) stepsN = lf.length + uf.length; else stepsS = lf.length + uf.length;
      // parapets (C) on both sides of every flight, stepped per 7 steps: W lane 0.15 m, E lane 0.75 m (lane width − flight width)/2
      const ph = v('grand_stair', 'parapet_height');
      const pw = (wx1 - wx0 - wW) / 2, pe = (ex1 - ex0 - wE) / 2;
      for (let k = 0; k < nLow; k += 7) { const k2 = Math.min(nLow, k + 7); const ya = m(ly0 + k * tr), yb = m(ly0 + k2 * tr);
        for (const px of [wx0 + pw / 2, wx1 - pw / 2]) parts.push(box(b, 'parapet', 'limestone', 'C', 'RECON', [px, (ya + yb) / 2], [pw, Math.abs(yb - ya)], FOUND, plainY + k2 * r + ph, { solid: true })); }
      for (let k = 0; k < nUp; k += 7) { const k2 = Math.min(nUp, k + 7); const ya = m(uy1 - k * tr), yb = m(uy1 - k2 * tr);
        for (const px of [ex0 + pe / 2, ex1 - pe / 2]) parts.push(box(b, 'parapet', 'limestone', 'C', 'RECON', [px, (ya + yb) / 2], [pe, Math.abs(yb - ya)], FOUND, hLand + k2 * r + ph, { solid: true })); }
    }
    // top landing (court level) and central pavement at the foot
    parts.push(box(b, 'landing', 'limestone', t, s, [exc, (ty0 + ty1) / 2], [ex1 - ex0, ty1 - ty0], FOUND, 0, { solid: true, note: 'common upper landing facing the Gate' }));
    const [g0, g1] = v<number[]>(b, 'central_gap');
    parts.push(box(b, 'pavement', 'limestone', 'B', 'IR-PERS', [wxc, (g0 + g1) / 2], [wx1 - wx0, g1 - g0], FOUND, plainY, { solid: true, note: "'pavement of huge well-polished gray limestone'" }));
    manifest.grand_stair = { stepsNorth: stepsN, stepsSouth: stepsS, riser: r, tread: tr, landingHeight: hLand, topHeight: plainY + (nLow + nUp) * r, flightWidthW: wW, flightWidthE: wE };
  }

  // ---------------- Gate of All Nations ----------------
  if (present('gate_nations')) {
    const b = 'gate_nations', f = footprint(b); const [x0, y0, x1, y1] = f.bounds; const c: Pt = [(x0 + x1) / 2, (y0 + y1) / 2];
    const hs = v(b, 'hall_side'), H = v(b, 'column_height');
    const tx = ((x1 - x0) - hs) / 2, ty = ((y1 - y0) - hs) / 2; // DERIVED per axis from OSM outer outline (C)
    const t = tierOf(row(b, 'hall_side'), row(b, 'wall_thickness')), s = srcOf(row(b, 'hall_side'), row(b, 'outer_size'));
    const dh = v(b, 'door_height'), dw = v(b, 'door_width');
    const roofY = H + 2.0; // roof beams 2 m above the capitals (C)
    parts.push(box(b, 'floor', 'limestone', 'C', 'RECON', c, [x1 - x0, y1 - y0], -0.3, 0.02, { solid: true }));
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: s }, c[0], c[1], hs, hs, 0, 0, roofY,
      [{ side: 'W', at: 0, width: dw, height: dh }, { side: 'E', at: 0, width: dw, height: dh }, { side: 'S', at: 0, width: dw, height: dh }], tx, ty).map(w => ({ ...w, solid: true })));
    const ord = order(b, { base: 'bell', capital: 'composite' });
    for (const p of grid(2, 2, c[0], c[1], v(b, 'interaxial'))) parts.push(col(b, p, 0, ord, tierOf(row(b, 'column_height')), row(b, 'column_height').src));
    parts.push(box(b, 'roof', 'timber', 'C', 'WP-EXT', c, [x1 - x0, y1 - y0], roofY, roofY + 1.2, { note: 'cedar beams, earth roof (C)' }));
    // guardian colossi at W (bulls) and E (human-headed winged bulls) doorways — greybox blocks, PLACEHOLDER
    for (const [side, sx] of [['W', x0], ['E', x1]] as const) for (const dy of [-1, 1]) {
      const depth = side === 'W' ? tx : tx; parts.push(box(b, 'colossus', 'limestone', 'B', 'IR-PERS', [sx + (side === 'W' ? depth / 2 : -depth / 2), c[1] + dy * (dw / 2 + 0.7)], [depth, 1.4], 0, 5.5, { placeholder: true, solid: true }));
    }
    manifest.gate_nations = { hallInteriorX: hs, hallInteriorY: hs, columns: 4, columnHeight: ord.height, wallTx: tx, wallTy: ty, doors: 3, doorHeight: dh };
  }

  // ---------------- Apadana ----------------
  if (present('apadana')) {
    const b = 'apadana', f = footprint(b);
    const pod = v(b, 'podium_height'), hs = v(b, 'hall_side'), [cx, cy] = v<number[]>(b, 'hall_centre'), ia = v(b, 'interaxial');
    const wt = v(b, 'wall_thickness'), H = v(b, 'column_height'), bh = v(b, 'building_height'), pdN = v(b, 'portico_depth_n');
    const s = srcOf(row(b, 'podium_height'), row(b, 'hall_side'));
    parts.push(prism(b, 'platform', 'limestone', 'B', srcOf(row(b, 'platform_footprint'), row(b, 'podium_height')), f.polygon.slice(0, -1) as Pt[], FOUND, pod, { solid: true }));
    const doorW = 4.0, doorH = 10.0; // C: not obtained
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: srcOf(row(b, 'wall_thickness'), row(b, 'wall_height')) }, cx, cy, hs, hs, wt, pod, pod + v(b, 'wall_height'),
      [{ side: 'N', at: 0, width: doorW, height: doorH }, { side: 'W', at: 0, width: doorW, height: doorH }, { side: 'E', at: 0, width: doorW, height: doorH }, { side: 'S', at: 0, width: doorW, height: doorH }]).map(w => ({ ...w, solid: true })));
    const hallOrd = order(b, { base: 'square2', capital: 'bull' });
    const porOrd = order(b, { base: 'bell', capital: 'bull' });
    const hallCols = grid(6, 6, cx, cy, ia);
    for (const p of hallCols) parts.push(col(b, p, pod, hallOrd, tierOf(row(b, 'column_height'), row(b, 'interaxial')), s));
    const wo = hs / 2 + wt; // wall outer half-extent
    const porticoCols: Pt[] = [];
    for (let i = 0; i < 6; i++) for (let k = 1; k <= 2; k++) {
      const xi = cx + (i - 2.5) * ia, yi = cy + (i - 2.5) * ia;
      porticoCols.push([xi, cy + wo + k * ia], [cx - wo - k * ia, yi], [cx + wo + k * ia, yi]);
    }
    for (const p of porticoCols) parts.push(col(b, p, pod, porOrd, tierOf(row(b, 'column_height'), row(b, 'porticoes')), s));
    // corner towers (C sizes from layout), S storerooms band
    const [px0, py0, px1, py1] = f.bounds; const nEdge = cy + wo + pdN; const sEdge = py0;
    const towers: [number, number, number, number][] = [[px0, cy + wo, cx - wo, nEdge], [cx + wo, cy + wo, px1, nEdge], [px0, sEdge, cx - wo, cy - wo], [cx + wo, sEdge, px1, cy - wo]];
    for (const [a0, b0, a1, b1] of towers) parts.push(box(b, 'tower', 'mudbrick', 'C', 'IR-PERS', [(a0 + a1) / 2, (b0 + b1) / 2], [a1 - a0, b1 - b0], pod, pod + bh + 2, { solid: true, note: 'corner tower (count B; size and height C)' }));
    parts.push(box(b, 'storerooms', 'mudbrick', 'C', 'IR-PERS', [cx, (sEdge + cy - wo) / 2], [2 * wo, cy - wo - sEdge], pod, pod + 8, { solid: true }));
    // roof over hall + porticoes (beams + earth), at column top to building height
    parts.push(box(b, 'roof', 'timber', 'C', srcOf(row(b, 'building_height')), [cx, cy], [2 * wo, 2 * wo], pod + H, pod + bh));
    parts.push(box(b, 'roof', 'timber', 'C', srcOf(row(b, 'building_height')), [cx, cy + wo + pdN / 2], [2 * wo, pdN], pod + H, pod + bh));
    parts.push(box(b, 'roof', 'timber', 'C', srcOf(row(b, 'building_height')), [cx - wo - (cx - wo - px0) / 2, cy], [cx - wo - px0, 2 * wo], pod + H, pod + bh));
    parts.push(box(b, 'roof', 'timber', 'C', srcOf(row(b, 'building_height')), [cx + wo + (px1 - cx - wo) / 2, cy], [px1 - cx - wo, 2 * wo], pod + H, pod + bh));
    // N and E stairways: 3 equal parts; central part = two flights converging on a central landing; extremities = flights rising toward the centre (C geometry; length B)
    const sl = (row(b, 'stairs').v as any).N.length as number, sr = v(b, 'stair_riser'), nSt = Math.round(pod / sr), stTr = 0.38, stW = 7.0;
    const addStair = (axis: 'N' | 'E') => {
      const third = sl / 3;
      for (const part of [-1, 0, 1]) {
        if (part === 0) {
          for (const dir of [-1, 1]) { // two flights converging on the centre from both sides
            const along0 = dir * (third / 2);
            const start: Pt = axis === 'N' ? [cx + along0, py1 + stW / 2] : [px1 + stW / 2, cy + along0];
            const d = axis === 'N' ? (dir > 0 ? 'W' : 'E') : (dir > 0 ? 'S' : 'N');
            parts.push(...flight(b, 'C', 'IR-PERS', start, d as any, nSt, sr, stTr, stW, 0));
          }
        } else {
          const along0 = part * (sl / 2);
          const start: Pt = axis === 'N' ? [cx + along0, py1 + stW / 2] : [px1 + stW / 2, cy + along0];
          const d = axis === 'N' ? (part > 0 ? 'W' : 'E') : (part > 0 ? 'S' : 'N');
          parts.push(...flight(b, 'C', 'IR-PERS', start, d as any, nSt, sr, stTr, stW, 0));
        }
      }
      // landings at podium height filling the remainder of the 81.67 m stair zone
      const c: Pt = axis === 'N' ? [cx, py1 + stW / 2] : [px1 + stW / 2, cy];
      parts.push(box(b, 'landing', 'limestone', 'C', 'IR-PERS', c, axis === 'N' ? [sl - 2 * nSt * stTr, stW] : [stW, sl - 2 * nSt * stTr], FOUND, pod, { solid: true, note: 'stair landings; reliefs on the N-facing risers/parapets (Phase 3)' }));
    };
    addStair('N'); addStair('E');
    manifest.apadana = { hallColumns: hallCols.length, porticoColumns: porticoCols.length, columnHeight: hallOrd.height, interaxial: ia, hallInterior: hs, podium: pod, wallThickness: wt, stairLength: sl };
  }

  // ---------------- Tachara ----------------
  if (present('tachara')) {
    const b = 'tachara', f = footprint(b), [x0, y0, x1, y1] = f.bounds, fl = v(b, 'floor');
    parts.push(prism(b, 'platform', 'limestone', 'B', srcOf(row(b, 'platform_footprint'), row(b, 'floor')), f.polygon.slice(0, -1) as Pt[], FOUND, fl, { solid: true }));
    const [W, Lh] = v<number[]>(b, 'overall'); const bc: Pt = [(x0 + x1) / 2, y1 - Lh / 2];
    const [hx, hy] = v<number[]>(b, 'hall_size'), [ncx, ncy] = v<number[]>(b, 'hall_columns');
    const hc: Pt = [bc[0], bc[1] + 3]; // hall slightly N of building centre, S portico in front (C)
    const wt = 2.4; // C
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: 'RECON' }, hc[0], hc[1], hx, hy, wt, fl, fl + v(b, 'column_height') + 1.5,
      [{ side: 'S', at: 0, width: 2.4, height: 5.5 }, { side: 'N', at: 0, width: 1.8, height: 4.5 }]).map(w => ({ ...w, solid: true })));
    const ord = order(b, { base: 'square2', capital: 'bull', shaftD: 0.9 });
    const cols = grid(ncx, ncy, hc[0], hc[1], hx / ncx, hy / ncy);
    for (const p of cols) parts.push(col(b, p, fl, ord, 'C', srcOf(row(b, 'hall_columns'), row(b, 'hall_size'))));
    const [pcx, pcy] = v<number[]>(b, 'portico'); const pc: Pt = [hc[0], hc[1] - hy / 2 - wt - 4.5];
    const pcols = grid(pcx, pcy, pc[0], pc[1], hx / ncx, 4.2);
    for (const p of pcols) parts.push(col(b, p, fl, ord, tierOf(row(b, 'portico')), row(b, 'portico').src));
    parts.push(box(b, 'roof', 'timber', 'C', 'RECON', [hc[0], hc[1] - 2], [hx + 2 * wt, hy + 2 * wt + 12], fl + ord.height, fl + ord.height + 1.5));
    manifest.tachara = { hallColumns: cols.length, porticoColumns: pcols.length, floor: fl, building: [W, Lh] as any };
  }

  // ---------------- Hadish ----------------
  if (present('hadish')) {
    const b = 'hadish', f = footprint(b), [x0, y0, x1, y1] = f.bounds, fl = v(b, 'floor');
    parts.push(prism(b, 'platform', 'limestone', 'B', srcOf(row(b, 'platform_footprint'), row(b, 'floor')), f.polygon.slice(0, -1) as Pt[], FOUND, fl, { solid: true }));
    const H = v(b, 'column_height'), ia = 5.4; // C
    const hc: Pt = [(x0 + x1) / 2, (y0 + y1) / 2 + 2];
    const hs = 6 * ia + ia; // interior with one-bay margins, as for the Apadana (C)
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: 'RECON' }, hc[0], hc[1], hs, hs, 2.8, fl, fl + H + 1.8,
      [{ side: 'N', at: -8, width: 2.6, height: 6 }, { side: 'N', at: 8, width: 2.6, height: 6 }, { side: 'S', at: 0, width: 2.6, height: 6 }]).map(w => ({ ...w, solid: true })));
    const ord = order(b, { base: 'plain', capital: 'bull', shaftD: 0.9 });
    const cols = grid(6, 6, hc[0], hc[1], ia);
    for (const p of cols) parts.push(col(b, p, fl, ord, 'C', srcOf(row(b, 'hall_columns'))));
    const pcols = grid(6, 2, hc[0], hc[1] + hs / 2 + 2.8 + 4.5, ia, 4.6);
    for (const p of pcols) parts.push(col(b, p, fl, ord, 'C', srcOf(row(b, 'portico'))));
    parts.push(box(b, 'roof', 'timber', 'C', 'RECON', [hc[0], hc[1] + 5], [hs + 5.6, hs + 5.6 + 10], fl + H, fl + H + 1.8));
    manifest.hadish = { hallColumns: cols.length, porticoColumns: pcols.length, floor: fl };
  }

  // ---------------- Hall of a Hundred Columns (under construction) ----------------
  if (present('hall100')) {
    const b = 'hall100', f = footprint(b), [x0, y0, x1, y1] = f.bounds, fl = v(b, 'floor'), hs = v(b, 'hall_side'), ia = v(b, 'interaxial');
    const c: Pt = [(x0 + x1) / 2, (y0 + y1) / 2];
    const tx = ((x1 - x0) - hs) / 2, ty = ((y1 - y0) - hs) / 2; // DERIVED from OSM outer outline (C)
    const rng = new Rng(1, 'hall100-construction');
    parts.push(box(b, 'floor', 'limestone', 'C', 'RECON', c, [x1 - x0, y1 - y0], FOUND, fl, { solid: true }));
    const wallH = (v(b, 'column_height') + 2) / 3; // walls to 1/3 height (construction_state, C)
    const doors = (['N', 'S', 'E', 'W'] as const).flatMap(side => [-1, 1].map(k => ({ side, at: k * hs / 4, width: 3.2, height: 99 })));
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: 'RECON' }, c[0], c[1], hs, hs, 0, fl, fl + wallH, doors, tx, ty).map(w => ({ ...w, solid: true, note: 'under construction: walls at ~1/3 height' })));
    const ord = order(b, { base: 'bell', capital: 'bull' });
    let raised = 0; const pts = grid(10, 10, c[0], c[1], ia);
    for (const p of pts) { const u = rng.next(); const built = u < 0.3 ? 1 : u < 0.55 ? 0.35 + 0.3 * rng.next() : 0; if (built === 1) raised++; parts.push(col(b, p, fl, ord, 'C', srcOf(row(b, 'construction_state'), row(b, 'interaxial')), built)); }
    const por = grid(8, 2, c[0], y1 + 4.5, ia, 5.5);
    for (const p of por) parts.push(col(b, p, fl, ord, 'C', row(b, 'portico').src, 0));
    manifest.hall100 = { columns: pts.length, porticoColumns: por.length, raised, interaxial: ia, hallInterior: hs, columnHeight: ord.height };
  }

  // ---------------- Tripylon (under construction) ----------------
  if (present('tripylon')) {
    const b = 'tripylon', f = footprint(b), [x0, y0, x1, y1] = f.bounds, fl = v(b, 'floor');
    parts.push(prism(b, 'platform', 'limestone', 'B', srcOf(row(b, 'floor')), f.polygon.slice(0, -1) as Pt[], FOUND, fl, { solid: true }));
    const c: Pt = [(x0 + x1) / 2, (y0 + y1) / 2]; const H = v(b, 'column_height');
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: 'RECON' }, c[0], c[1], 12, 12, 2.2, fl, fl + H * 0.5,
      [{ side: 'N', at: 0, width: 2.2, height: 99 }, { side: 'E', at: 0, width: 2.2, height: 99 }, { side: 'S', at: 0, width: 2.2, height: 99 }]).map(w => ({ ...w, solid: true, note: 'under construction' })));
    const ord = order(b, { base: 'bell', capital: 'bull', shaftD: 0.8 });
    for (const p of grid(2, 2, c[0], c[1], 5)) parts.push(col(b, p, fl, ord, 'C', 'RECON', 0.5));
    manifest.tripylon = { columns: 4, floor: fl };
  }

  // ---------------- Treasury, Harem, Garrison (perimeter walls + key halls; C interiors) ----------------
  const perimeter = (b: string, fkey: string, fl: number, wallT: number, wallH: number, note: string) => {
    const poly = footprint(fkey).polygon.slice(0, -1) as Pt[];
    parts.push(prism(b, 'floor', 'earth', 'B', 'OSM', poly, FOUND, fl, { solid: true }));
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], c2 = poly[(i + 1) % poly.length], len = Math.hypot(c2[0] - a[0], c2[1] - a[1]); if (len < 1) continue;
      // offset inward by half the wall thickness (polygon orientation decides the inward normal)
      const nx = -(c2[1] - a[1]) / len, ny = (c2[0] - a[0]) / len; const sgn = ringSign(poly);
      const cxy: Pt = [(a[0] + c2[0]) / 2 + sgn * nx * wallT / 2, (a[1] + c2[1]) / 2 + sgn * ny * wallT / 2];
      parts.push({ ...box(b, 'wall', 'mudbrick', 'C', 'RECON', cxy, [len, wallT], fl, fl + wallH, { solid: true, note }), rot: Math.atan2(c2[1] - a[1], c2[0] - a[0]) });
    }
  };
  if (present('treasury')) {
    const b = 'treasury'; perimeter(b, 'treasury', v(b, 'floor') + 0.3, 2.5, 7, 'Treasury enclosure (C thickness/height); single NE entrance not yet cut');
    const [x0, y0, x1, y1] = footprint(b).bounds; const H = v(b, 'column_height');
    const ord = order(b, { base: 'square2', capital: 'plain', shaftD: 0.55, material: 'timber' });
    const pts = grid(9, 11, (x0 + x1) / 2, (y0 + y1) / 2 + 20, 4.2);
    for (const p of pts) parts.push(col(b, p, 0.3, ord, 'C', row(b, 'hall99').src));
    manifest.treasury = { hall99Columns: pts.length, columnHeight: H };
  }
  if (present('harem')) {
    const b = 'harem'; const fl = v(b, 'floor'); perimeter(b, 'harem', fl, 2.2, 7, 'Harem enclosure (C)');
    const [x0, y0, x1, y1] = FOUNDPRINT('museum_modern');
    const c: Pt = [(x0 + x1) / 2, (y0 + y1) / 2]; const ord = order(b, { base: 'bell', capital: 'bull', shaftD: 0.6 });
    const hall = grid(3, 4, c[0], c[1] + 8, 4.5); for (const p of hall) parts.push(col(b, p, fl, ord, 'C', row(b, 'hall_columns').src));
    const por = grid(4, 2, c[0], c[1] - 14, 4.5, 4); for (const p of por) parts.push(col(b, p, fl, ord, 'C', row(b, 'portico').src));
    manifest.harem = { hallColumns: hall.length, porticoColumns: por.length };
  }
  if (present('garrison')) perimeter('garrison', 'garrison', v('garrison', 'floor') + 0.2, 1.2, 4, 'garrison quarters (C)');

  // ---------------- East fortification (mud brick) ----------------
  if (present('fortification_e')) {
    const b = 'fortification_e', t = v(b, 'wall_thickness'), h = v(b, 'curtain_height'), th = v(b, 'tower_extra_height'), sp = v(b, 'tower_spacing');
    const T = footprint('terrace').polygon as Pt[];
    let towers = 0;
    for (let i = 0; i < T.length - 1; i++) {
      const a = T[i], c2 = T[i + 1]; if (!(a[0] > 200 && c2[0] > 200)) continue;
      const len = Math.hypot(c2[0] - a[0], c2[1] - a[1]); if (len < 2) continue;
      const nx = -(c2[1] - a[1]) / len, ny = (c2[0] - a[0]) / len, sgn = ringSign(T.slice(0, -1));
      const off = (d: number): Pt => [(a[0] + c2[0]) / 2 + sgn * nx * d, (a[1] + c2[1]) / 2 + sgn * ny * d];
      const rot = Math.atan2(c2[1] - a[1], c2[0] - a[0]);
      parts.push({ ...box(b, 'curtain', 'mudbrick', 'B', srcOf(row(b, 'wall_thickness'), row(b, 'curtain_height')), off(t / 2), [len, t], 0, h, { solid: true }), rot });
      for (let d = sp / 2; d < len; d += sp) {
        const u = d / len; const p: Pt = [a[0] + (c2[0] - a[0]) * u + sgn * nx * t / 2, a[1] + (c2[1] - a[1]) * u + sgn * ny * t / 2];
        parts.push({ ...box(b, 'tower', 'mudbrick', 'C', 'IR-FORT', p, [7, t + 2], 0, h + th, { solid: true }), rot }); towers++;
      }
    }
    manifest.fortification_e = { towers, thickness: t, height: h };
  }
  return { parts, manifest };
}
function FOUNDPRINT(k: string) { return footprint(k).bounds; }
/** +1 if the ring is counter-clockwise (inward normal = left normal), −1 if clockwise */
function ringSign(p: Pt[]) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a > 0 ? 1 : -1; }
void SPEC; void FOUNDPRINTS_UNUSED; function FOUNDPRINTS_UNUSED() { return FOOTPRINTS; }
