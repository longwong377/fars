// The timber ceilings under the flat roofs (D-188; §8.2 rubric fix 4: "the portico roof is a single slab with no beams,
// joists or matting"). SITE_SPEC gives the roofs as "cedar beams" with an earth roof above the capitals (gate_nations.roof,
// r_roof_above_capital: C); the build-up drawn here is the reconstruction common to Achaemenid columned halls (C,
// RECOLLECTION): main beams laid in the saddles of the capitals, one line per column row, running between the protomes'
// heads (the protome's long axis is grid x, sculpt_models.ts, so the beams run along grid y); joists across them (along
// grid x) at a close spacing; reed matting over the joists (the roof material's underside, materials.ts `matting`), then
// earth. Sizes are C: main beams 0.55 D wide and 0.75 D deep (D = the order's shaft diameter), joists 0.16 × 0.2 m at
// 0.55 m centres; where a roof has no columns under it (rooms), joists alone span its short side.
// Render geometry only: the boxes are not parts, so colliders, the walkable grid, the light probes and the plan tests keep
// the roofs as they were (the beams hang below a roof slab whose underside the probes see; the difference is the
// beams' depth, ≤ 1.2 m in the Apadana, under a roof 2 m thick).
import type { Part, Box, Column } from './parts';

export const CEILING = { beamW: 0.55, beamD: 0.75, joistW: 0.16, joistD: 0.2, joistStep: 0.55, tier: 'C' as const, src: 'RECON', /** D-334: how far a timber runs on into the wall that carries it (its bearing, hidden in the brick) */ bearing: 0.25 };

/** D-334: the plan intervals of a timber's line (along grid x when alongX, at the other coordinate c; from a to b) that lie
 *  outside the walls reaching the roof's underside at height top, each run on CEILING.bearing into the wall that carries it.
 *  The timbers ran through the walls to the roof's edge, their ends flush with the outer plaster: a cedar stripe down every
 *  facade under the roof (the probe, s12). Sampled at 5 cm; walls are the building's solid boxes (any rotation) standing from
 *  below the timber to the roof */
export function clipToWalls(walls: Box[], alongX: boolean, c: number, a: number, b: number, yLo: number, top: number): [number, number][] {
  // each wall's stretch of the line, exactly (the line in the wall's own frame is linear in s: a slab test per axis)
  const cut: [number, number][] = [];
  for (const w of walls) {
    if (w.y1 < top - 0.05 || w.y0 > yLo + 0.05) continue;
    const r = -(w.rot ?? 0), cr = Math.cos(r), sr = Math.sin(r), hx = w.size[0] / 2 - 1e-6, hy = w.size[1] / 2 - 1e-6;
    // point(s) = alongX ? (s, c) : (c, s); local u = dx cr - dy sr, v = dx sr + dy cr
    const px = alongX ? 0 : c, py = alongX ? c : 0, ex = alongX ? 1 : 0, ey = alongX ? 0 : 1;
    const u0 = (px - w.c[0]) * cr - (py - w.c[1]) * sr, du = ex * cr - ey * sr, v0 = (px - w.c[0]) * sr + (py - w.c[1]) * cr, dv = ex * sr + ey * cr;
    let lo = -Infinity, hi = Infinity;
    for (const [o, d, h] of [[u0, du, hx], [v0, dv, hy]]) {
      if (Math.abs(d) < 1e-12) { if (Math.abs(o) >= h) { lo = 1; hi = 0; } continue; }
      const t1 = (-h - o) / d, t2 = (h - o) / d; lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
    }
    if (hi > lo && hi > a && lo < b) cut.push([Math.max(a, lo), Math.min(b, hi)]);
  }
  cut.sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = []; let s0 = a;
  for (const [p, q] of cut) { if (p > s0) out.push([s0, p]); s0 = Math.max(s0, q); }
  if (s0 < b) out.push([s0, b]);
  // each free run borne CEILING.bearing into the wall at an end that is a wall (not the roof's own edge)
  return out.map(([p, q]): [number, number] => [Math.max(a, p - (p > a + 1e-6 ? CEILING.bearing : 0)), Math.min(b, q + (q < b - 1e-6 ? CEILING.bearing : 0))]).filter(([p, q]) => q - p > 0.3);
}

/** the ceiling timbers of every roof over columns or rooms, as render-only boxes (kind 'ceiling_beam' / 'ceiling_joist') */
export function ceilingTimbers(parts: Part[]): Box[] {
  const out: Box[] = [];
  const cols = parts.filter(p => p.type === 'column' && p.built >= 1) as Column[];
  for (const r of parts) {
    if (r.type !== 'box' || r.kind !== 'roof' || (r.rot ?? 0) !== 0) continue;
    const x0 = r.c[0] - r.size[0] / 2, x1 = r.c[0] + r.size[0] / 2, y0 = r.c[1] - r.size[1] / 2, y1 = r.c[1] + r.size[1] / 2, top = r.y0;
    const under = cols.filter(c => { const t = c.y0 + c.order.height; return c.building === r.building && t <= top + 0.05 && t >= top - 2.5 && c.c[0] > x0 && c.c[0] < x1 && c.c[1] > y0 && c.c[1] < y1; });
    const base = { building: r.building, material: r.material, tier: CEILING.tier, src: CEILING.src, solid: false, placeholder: false };
    const walls = (parts.filter(p => p.type === 'box' && p.building === r.building && p.kind !== 'roof' && p.solid !== false && p.material !== 'timber') as Box[])
      .filter(w => { const R = Math.hypot(w.size[0], w.size[1]) / 2; return w.c[0] + R > x0 && w.c[0] - R < x1 && w.c[1] + R > y0 && w.c[1] - R < y1 && w.y1 >= top - 0.05; }); // (those under this roof)
    const joist = (xa0: number, xb0: number, y: number, alongX: boolean) => { for (const [xa, xb] of clipToWalls(walls, alongX, y, xa0, xb0, top - CEILING.joistD, top)) joistOne(xa, xb, y, alongX); };
    const joistOne = (xa: number, xb: number, y: number, alongX: boolean) => {
      if (xb - xa < 0.3) return;
      out.push({ ...base, type: 'box', kind: 'ceiling_joist', c: alongX ? [(xa + xb) / 2, y] : [y, (xa + xb) / 2], size: alongX ? [xb - xa, CEILING.joistW] : [CEILING.joistW, xb - xa], y0: top - CEILING.joistD, y1: top, note: 'ceiling joist (D-188, C)' });
    };
    if (!under.length) { // a room: joists across the short side
      const alongX = r.size[0] <= r.size[1], [a0, a1, b0, b1] = alongX ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
      for (let y = b0 + CEILING.joistStep / 2; y < b1; y += CEILING.joistStep) joist(a0, a1, y, alongX);
      continue;
    }
    const D = Math.max(...under.map(c => c.order.shaftD)), bw = CEILING.beamW * D, bd = CEILING.beamD * D;
    // the beams lie in the capitals' saddles (bd below the capital tops) and reach up to the roof's underside: where the
    // roof stands above the capitals (the Gate: 2 m of 'beams + earth roof', r_roof_above_capital, C) the beam layer is
    // that much deeper
    const colTop = Math.min(...under.map(c => c.y0 + c.order.height));
    const xs = [...new Set(under.map(c => +c.c[0].toFixed(1)))].sort((a, b) => a - b);
    const zs = [...new Set(under.map(c => +c.c[1].toFixed(1)))].sort((a, b) => a - b);
    for (const x of xs) for (const [ya, yb] of clipToWalls(walls, false, x, y0, y1, colTop - bd, top)) out.push({ ...base, type: 'box', kind: 'ceiling_beam', c: [x, (ya + yb) / 2], size: [bw, yb - ya], y0: colTop - bd, y1: top, note: 'main ceiling beam over a column row, its ends borne in the walls (D-188, D-334, C)' });
    // joists across the beams (grid x), between successive beam lines and out to the roof's edges; none over a column's
    // protome (±0.55 D in y about each column row plus the joist's half width)
    const clear = 0.55 * D + CEILING.joistW / 2 + 0.05;
    const edges = [x0, ...xs.flatMap(x => [x - bw / 2, x + bw / 2]), x1];
    for (let y = y0 + CEILING.joistStep / 2; y < y1; y += CEILING.joistStep) {
      if (zs.some(z => Math.abs(y - z) < clear)) continue;
      for (let i = 0; i < edges.length; i += 2) joist(edges[i], edges[i + 1], y, true);
    }
  }
  return out;
}
