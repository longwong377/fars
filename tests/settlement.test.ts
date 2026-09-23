// Phase 6 settlement: measurable properties of the generated town (brief §13.3 dimension-style tests; gate "layout
// sourced and tiered"). Plots stay inside their settlement.json zones and clear of the Terrace approach, the roads and
// the empty Frataraka site; plots never overlap; every home has a street door onto walkable ground connected to the
// open plain; capacities cover the court-absent town population; the house-plot file is in sync; the geometry fits its
// draw-call and triangle budget; the fire schedules light the town at dusk.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildTownPlan, plotRows, pointInPolygon, FEATURES, SETTLEMENT, TownPlan, AJORI, nearestOnPolyline } from '../src/world/settlement/plan';
import { Site, P2 } from '../src/world/settlement/site';
import { scheduleLit } from '../src/world/fire';
import { townPlotsJson } from '../tools/build_town';

let plan: TownPlan;
beforeAll(() => { plan = buildTownPlan(); });
/** grid corners of every plot cell (sampled) */
function plotCells(s: Site, idx: number, stride = 1): P2[] { const out: P2[] = []; const [i0, j0, i1, j1] = s.plots[idx].rect;
  for (let j = Math.max(0, j0 - 40); j < Math.min(s.H, j1 + 40); j += stride) for (let i = Math.max(0, i0 - 40); i < Math.min(s.W, i1 + 40); i += stride) if (s.cell[s.k(i, j)] === idx) out.push(s.cellGrid(s.k(i, j)));
  return out; }
const NAV = { e0: -620, e1: 262, n0: -245, n1: 185 }; // the walkable grid of the Terrace approach (people/navgrid.ts)

describe('settlement layout (Phase 6)', () => {
  it('every plot lies inside its zone polygon or within the stated uncertainty of its point feature', () => {
    const bad: string[] = [];
    for (const s of plan.sites) { const F = FEATURES[s.meta.zone];
      for (const p of s.plots) { const [i0, j0, i1, j1] = p.rect; const corners = [[i0, j0], [i1, j0], [i1, j1], [i0, j1]].map(([i, j]) => s.grid(s.u0 + i, s.v0 + j));
        if (F.polygon) { for (const c of corners) if (!pointInPolygon(c, F.polygon)) { bad.push(`${p.id} (${s.meta.zone})`); break; } }
        else { const d = Math.max(...corners.map(c => Math.hypot(c[0] - F.xy[0], c[1] - F.xy[1]))); if (d > (F.unc_m ?? 0) + 80) bad.push(`${p.id} ${d.toFixed(0)} m from ${F.id}`); } } }
    expect(bad).toEqual([]);
  });
  it('keeps the Terrace approach, the roads and the empty Frataraka site clear', () => {
    const inNav: string[] = [], onRoad: string[] = [], onAbsent: string[] = [];
    const roads = SETTLEMENT.features.filter((f: any) => f.kind === 'road');
    for (const s of plan.sites) for (const p of s.plots) {
      const cells = plotCells(s, p.idx, 2);
      for (const c of cells) { if (c[0] > NAV.e0 && c[0] < NAV.e1 && c[1] > NAV.n0 && c[1] < NAV.n1) { inNav.push(p.id); break; } }
      for (const r of roads) { if (s.id === 'q_s1' && r.id === 'road_south_tirazzish') continue; // the road is this quarter's main street
        for (const c of cells) if (nearestOnPolyline(r.polyline, c).d < r.width_m / 2 + 1) { onRoad.push(`${p.id}/${r.id}`); break; } }
      const fr = FEATURES.frataraka_complex.xy; for (const c of cells) if (Math.hypot(c[0] - fr[0], c[1] - fr[1]) < 80) { onAbsent.push(p.id); break; }
    }
    expect(inNav).toEqual([]); expect(onRoad).toEqual([]); expect(onAbsent).toEqual([]);
    // q_s1's main street is the road: the road's centre line through the quarter is open ground (lane), never a plot
    const q = plan.sites.find(s => s.id === 'q_s1')!, road = FEATURES.road_south_tirazzish.polyline as P2[];
    let checked = 0, blocked = 0;
    for (let t = 0; t <= 1; t += 0.001) { const a = road[0], b = road[1], pnt: P2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const [u, v] = [(pnt[0] - q.frame.c[0]) * Math.cos(q.frame.theta) + (pnt[1] - q.frame.c[1]) * Math.sin(q.frame.theta), -(pnt[0] - q.frame.c[0]) * Math.sin(q.frame.theta) + (pnt[1] - q.frame.c[1]) * Math.cos(q.frame.theta)];
      const i = q.ci(u), j = q.cj(v); if (!q.inb(i, j)) continue; checked++; if (q.cell[q.k(i, j)] >= 0) blocked++; }
    expect(checked).toBeGreaterThan(20); expect(blocked).toBe(0);
  });
  it('plots never overlap, within a site (raster) or across sites', () => {
    const bad: string[] = [];
    const bb = plan.sites.map(s => { const cs = [[0, 0], [s.W, 0], [s.W, s.H], [0, s.H]].map(([i, j]) => s.grid(s.u0 + i, s.v0 + j)); return { s, e0: Math.min(...cs.map(c => c[0])), e1: Math.max(...cs.map(c => c[0])), n0: Math.min(...cs.map(c => c[1])), n1: Math.max(...cs.map(c => c[1])) }; });
    for (let a = 0; a < bb.length; a++) for (let b = a + 1; b < bb.length; b++) {
      const A = bb[a], B = bb[b]; if (A.e1 < B.e0 || B.e1 < A.e0 || A.n1 < B.n0 || B.n1 < A.n0) continue;
      // cells of A's plots that fall on B's plot cells
      for (const p of A.s.plots) for (const c of plotCells(A.s, p.idx, 2)) { const s = B.s; const [u, v] = [(c[0] - s.frame.c[0]) * Math.cos(s.frame.theta) + (c[1] - s.frame.c[1]) * Math.sin(s.frame.theta), -(c[0] - s.frame.c[0]) * Math.sin(s.frame.theta) + (c[1] - s.frame.c[1]) * Math.cos(s.frame.theta)];
        const i = s.ci(u), j = s.cj(v); if (s.inb(i, j) && s.cell[s.k(i, j)] >= 0) { bad.push(`${p.id} × ${s.plots[s.cell[s.k(i, j)]].id}`); break; } }
    }
    expect(bad).toEqual([]);
  });
  it('every home has a street door onto walkable ground that connects to the open plain (lanes are one network)', () => {
    const noDoor: string[] = [], cutOff: string[] = [];
    let laneCells = 0, laneOff = 0;
    for (const s of plan.sites) { const lab = s.openComponents(), ex = s.exitComponents(lab);
      for (const p of s.plots) { if (!p.capacity) continue; if (!p.door) { noDoor.push(p.id); continue; }
        if (!Site.open(s.cell[p.door.out]) || !ex.has(lab[p.door.out])) cutOff.push(p.id);
        expect(s.doors.has(s.edgeBetween(p.door.cell, p.door.out))).toBe(true); }
      if (s.meta.kind === 'quarter') for (let k = 0; k < s.cell.length; k++) if (s.cell[k] === -2 || s.cell[k] === -4) { laneCells++; if (!ex.has(lab[k])) laneOff++; } }
    expect(noDoor).toEqual([]); expect(cutOff).toEqual([]);
    expect(laneOff / laneCells).toBeLessThan(0.01); // lane cells cut off from every exit (enclosed slivers): under 1 %
  });
  it('the town is a maze, not a grid: blind alleys and jogs in every quarter', () => {
    for (const s of plan.sites.filter(q => q.meta.kind === 'quarter' && q.W > 120)) {
      // blind-alley ends on a 2 m grid (alleys are 2-3 m wide, so they thin to one coarse cell): an open coarse cell
      // inside the quarter with exactly one open neighbour is the end of a blind alley
      const W2 = s.W >> 1, H2 = s.H >> 1, open2 = (a: number, b: number) => { if (a < 0 || b < 0 || a >= W2 || b >= H2) return false; let o = 0, pl = 0;
        for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const c = s.at(a * 2 + di, b * 2 + dj); if (c === -2 || c === -4) o++; if (c >= 0) pl++; } return o >= 2 && pl + o === 4; };
      let tips = 0;
      for (let b = 1; b < H2 - 1; b++) for (let a = 1; a < W2 - 1; a++) if (open2(a, b) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([da, db]) => open2(a + da, b + db)).length === 1) tips++;
      expect(tips, `${s.id} blind-alley tips`).toBeGreaterThan(3);
    }
  });
  it('capacities cover the court-absent town population (population.json: town night 5,000-10,000, working 7,000)', () => {
    const rows = plotRows(plan); const pop = JSON.parse(readFileSync('src/data/population.json', 'utf8'));
    const town = pop.zones.find((z: any) => z.id === 'town').court_absent.night.spring;
    const cap = rows.filter(r => r.pop_zone === 'town').reduce((a, r) => a + r.capacity, 0);
    expect(cap).toBeGreaterThanOrEqual(town.w);
    expect(cap).toBeLessThanOrEqual(town.range[1] * 1.1);
    // homes are households of the population.json templates: 3-16 in houses, 15-45 in estates
    for (const r of rows) if (r.kind === 'house' || r.kind === 'house_large') { expect(r.capacity).toBeGreaterThanOrEqual(3); expect(r.capacity).toBeLessThanOrEqual(16); }
    expect(new Set(rows.map(r => r.id)).size).toBe(rows.length);
  });
  it('src/data/town_plots.json is in sync with the generator (npx tsx tools/build_town.ts)', () => {
    expect(readFileSync('src/data/town_plots.json', 'utf8')).toBe(townPlotsJson());
  });
  it('door points sit on the plot boundary: outside point within 1 m of the inside point', () => {
    for (const r of plotRows(plan)) if (r.door && r.door_in) expect(Math.hypot(r.door[0] - r.door_in[0], r.door[1] - r.door_in[1])).toBeLessThan(1.05);
  });
  it('Tol-e Ajori follows the published plan (39.07 x 29.05 m, passage along the long axis at 110°/290° true)', () => {
    expect(AJORI.long).toBe(FEATURES.tol_ajori_gate.size_m[0]); expect(AJORI.short).toBe(FEATURES.tol_ajori_gate.size_m[1]);
    expect(AJORI.wall).toBe(FEATURES.tol_ajori_gate.plan_2026.wall_thickness_m);
    // the room fits inside the walls: 29.05 - 2 x 10.47 ≈ 8.1 ≥ 8.00
    expect(AJORI.short - 2 * AJORI.wall).toBeGreaterThanOrEqual(AJORI.room[1] - 0.05);
    // plan.gate.theta points +u along 110° true: grid bearing 129°
    const th = plan.gate.theta, gridBearing = ((90 - th * 180 / Math.PI) % 360 + 360) % 360; expect(gridBearing).toBeCloseTo(129, 6);
  });
});

describe('fire schedules (C): the town lights up at dusk, not all at once', () => {
  const frac = (sched: 'home' | 'bake' | 'day', hour: number, sunAlt: number) => { let n = 0; for (let i = 0; i < 400; i++) if (scheduleLit(sched, hour, sunAlt, (i * 37.3) % 100)) n++; return n / 400; };
  it('hearths: none at noon, some as the sun sets, most in the first hour of dark, few late at night, some before dawn', () => {
    expect(frac('home', 12.5, 70)).toBe(0);
    const set = frac('home', 18.9, 1), dusk = frac('home', 19.5, -5), late = frac('home', 23.5, -40), dawn = frac('home', 5.2, -4);
    expect(set).toBeGreaterThan(0.05); expect(set).toBeLessThan(0.9);
    expect(dusk).toBeGreaterThan(set); expect(late).toBeLessThan(0.3); expect(dawn).toBeGreaterThan(0.2);
  });
  it('ovens bake in the morning; kilns and forges burn in working hours', () => {
    expect(frac('bake', 6, 3)).toBeGreaterThan(0.5); expect(frac('bake', 14, 50)).toBe(0);
    expect(frac('day', 10, 50)).toBe(1); expect(frac('day', 22, -30)).toBe(0);
  });
});
