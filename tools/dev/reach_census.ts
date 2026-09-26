// dev: which of the town's cells a body can walk to (D-249). Per site, from the open cells that reach the site's edge,
// every cell reached by the routes' own move rules (walk.ts: the raster's walls and doors, a cell's room and each crossed
// edge's room >= BODY_MIN, diagonals with both detours). Reports the share of plot cells and of open cells reached per
// (cells a solid fills, with no room for a body anywhere in them, are left out of both counts)
// kind of site, the plots with cells left out, and why (a plot none of whose cells is reached; a plot partly reached).
// Usage: npx tsx tools/dev/reach_census.ts [--list N] [--evidence pass]
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { TownWalk, siteReach, cellRoom, BODY_MIN, openCode } from '../../src/world/settlement/walk';
import type { Site } from '../../src/world/settlement/site';

export const reachable = siteReach;
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), li = argv.indexOf('--list'), LIST = li >= 0 ? +argv[li + 1] : 20, ev = argv.indexOf('--evidence'), pass = ev >= 0 ? argv[ev + 1] : null;
  const plan = buildTownPlan(); TownWalk.fromPlan(plan);
  const tot = { quarter: { plot: 0, plotR: 0, open: 0, openR: 0, plots: 0, shut: 0, partial: 0 }, compound: { plot: 0, plotR: 0, open: 0, openR: 0, plots: 0, shut: 0, partial: 0 } };
  const bad: { site: string; plot: string; kind: string; cells: number; reached: number; at: [number, number] }[] = [];
  for (const s of plan.sites) { const r = reachable(s), T = tot[s.meta.kind], per = new Map<number, [number, number]>();
    // (a cell a solid fills, no body stands in: not counted; a bench, a manger, a well)
    for (let k = 0; k < s.cell.length; k++) { const c = s.cell[k]; if (cellRoom(s, k) < BODY_MIN) continue; if (c >= 0) { T.plot++; if (r[k]) T.plotR++; const x = per.get(c) ?? [0, 0]; x[0]++; if (r[k]) x[1]++; per.set(c, x); } else if (openCode(c) && c !== -1) { T.open++; if (r[k]) T.openR++; } }
    for (const [c, [n, nr]] of per) { const p = s.plots[c]; if (p.kind === 'garden') continue; T.plots++; if (nr === 0) T.shut++; else if (nr < n) T.partial++;
      if (nr < n) { const [i0, j0, i1, j1] = p.rect; bad.push({ site: s.id, plot: p.id, kind: p.kind, cells: n, reached: nr, at: s.grid(s.u0 + (i0 + i1) / 2, s.v0 + (j0 + j1) / 2) }); } } }
  const pct = (a: number, b: number) => +(100 * a / Math.max(1, b)).toFixed(3);
  const res = Object.fromEntries(Object.entries(tot).map(([k, T]) => [k, { plot_cells: T.plot, plot_cells_reached_pct: pct(T.plotR, T.plot), lane_cells: T.open, lane_cells_reached_pct: pct(T.openR, T.open), plots: T.plots, plots_shut: T.shut, plots_partly_reached: T.partial }]));
  bad.sort((a, b) => (b.cells - b.reached) - (a.cells - a.reached));
  console.log(JSON.stringify(res, null, 1)); for (const b of bad.slice(0, LIST)) console.log(`${b.site} ${b.plot} (${b.kind}) ${b.reached}/${b.cells} cells reached, at (${b.at[0].toFixed(1)}, ${b.at[1].toFixed(1)})`);
  if (pass) { mkdirSync(`REVIEWS/evidence/${pass}`, { recursive: true }); const commit = process.env.RUN_COMMIT ?? execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    writeFileSync(`REVIEWS/evidence/${pass}/reach_census.json`, JSON.stringify({ id: 'reach_census', value: res.quarter.plot_cells_reached_pct, unit: '% of quarter plot cells a body can walk to', commit, tool: 'tools/dev/reach_census.ts', body_min_m: BODY_MIN, ...res, worst: bad.slice(0, 40) }, null, 1) + '\n'); }
}
