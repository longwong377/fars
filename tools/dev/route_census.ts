// dev: the town's routes against what is solid (D-249; Q-641). Random pairs of points in the lower town's quarters (lanes
// and squares half the time, plot cells the rest, as tools/dev/walkers.ts draws its town targets), routed by TownWalk.route
// as the people and the walk bots route, and each route measured every 0.1 m (leaving out 0.35 m at its ends and at every
// waypoint that is a given end) against the solids by brute force: every Site.walls() box and footprints.ts box of the
// site within 2 m, and the plan's solid props (not walk.ts's own index). Reports the routes found, the least clearance per
// route (min / p1 / p5 / median over routes), the share of route length under 0.25 m (a body's half width: the shoulders
// in a wall) and under 0.3 m, and the length inside a solid.
// Usage: npx tsx tools/dev/route_census.ts [--pairs N=400] [--seed S=1] [--walk path/to/walk.ts] [--evidence pass]
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { siteFootprints, wallBox, boxDist } from '../../src/world/settlement/footprints';
import { LANE, SQUARE, toLocal, type Site } from '../../src/world/settlement/site';

type P2 = [number, number];
const argv = process.argv.slice(2), flag = (k: string, d: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PAIRS = +flag('--pairs', '400'), SEED = +flag('--seed', '1'), pass = flag('--evidence', ''), walkPath = flag('--walk', '../../src/world/settlement/walk');
const { TownWalk } = await import(walkPath);
let st = SEED * 7919 + 13; const rnd = () => ((st = (Math.imul(st, 1664525) + 1013904223) >>> 0) / 4294967296);
const plan = buildTownPlan(), walk = TownWalk.fromPlan(plan);
const quarters = plan.sites.filter(q => q.meta.kind === 'quarter' && Math.hypot(q.frame.c[0], q.frame.c[1]) < 3000);
// the solids per site, by 2 m tile (brute force within a tile's neighbours)
type B = { u: number; v: number; hu: number; hv: number; c: number; s: number };
const solids = new Map<Site, Map<number, B[]>>();
const solidsOf = (s: Site) => { let m = solids.get(s); if (m) return m; m = new Map(); const list: B[] = [];
  for (const w of s.walls()) if (!w.door) list.push({ ...wallBox(w), c: 1, s: 0 });
  for (const f of siteFootprints(s)) list.push({ u: f.u, v: f.v, hu: f.hu, hv: f.hv, c: Math.cos(f.rot), s: Math.sin(f.rot) });
  for (const p of plan.props) { if (!p.collide || p.y0 > 1.8) continue; const [u, v] = toLocal(s.frame, p.c[0], p.c[1]); if (Math.abs(u) > s.W / 2 + 10 || Math.abs(v) > s.H / 2 + 10) continue;
    const r = p.theta - s.frame.theta; list.push({ u, v, hu: p.hu, hv: p.shape === 'cyl' ? p.hu : p.hv, c: Math.cos(r), s: Math.sin(r) }); }
  for (const b of list) { const R = Math.hypot(b.hu, b.hv) + 2; for (let x = Math.floor((b.u - R) / 2); x <= Math.floor((b.u + R) / 2); x++) for (let y = Math.floor((b.v - R) / 2); y <= Math.floor((b.v + R) / 2); y++) { const k = x * 100003 + y; (m.get(k) ?? m.set(k, []).get(k)!).push(b); } }
  solids.set(s, m); return m; };
const clearance = (e: number, n: number) => { let d = 2;
  for (const q of quarters) { const [u, v] = toLocal(q.frame, e, n); if (Math.abs(u) > q.W / 2 + 2 || Math.abs(v) > q.H / 2 + 2) continue;
    for (const b of solidsOf(q).get(Math.floor(u / 2) * 100003 + Math.floor(v / 2)) ?? []) d = Math.min(d, boxDist(u, v, b, b.c, b.s)); }
  return d; };
const sample = (): P2 | null => { for (let t = 0; t < 200; t++) { const s = quarters[Math.floor(rnd() * quarters.length)], k = Math.floor(rnd() * s.W * s.H), c = s.cell[k];
  const open = rnd() < 0.5; if (open ? c === LANE || c === SQUARE : c >= 0) return s.cellGrid(k); } return null; };
let found = 0, none = 0, L = 0, L25 = 0, L30 = 0, L0 = 0; const mins: number[] = [], worst: string[] = [];
for (let pi = 0; pi < PAIRS; pi++) {
  const a = sample(), b0 = sample(); if (!a || !b0) continue;
  // a wanderer's next target: within 150 m (as the walk bots)
  const ang = rnd() * 2 * Math.PI, b: P2 = Math.hypot(b0[0] - a[0], b0[1] - a[1]) > 150 ? (() => { for (let t = 0; t < 50; t++) { const c = sample(); if (c && Math.hypot(c[0] - a[0], c[1] - a[1]) < 150) return c; } return [a[0] + Math.cos(ang) * 60, a[1] + Math.sin(ang) * 60] as P2; })() : b0;
  const r: P2[] | null = walk.route(a, b); if (!r) { none++; if (argv.includes('--why')) { const la = walk.leave(a, b), lb = walk.leave(b, a); const loc = (p: P2) => { const l = walk.locate(p[0], p[1]); if (!l) return 'plain'; const s = walk.boxes[l.si].s; return `${s.id}:${s.cell[l.k]}:${s.sub[l.k]}`; };
    console.log('no route', a.map(x => x.toFixed(1)).join(','), loc(a), la ? 'out' : 'SHUT', '->', b.map(x => x.toFixed(1)).join(','), loc(b), lb ? 'out' : 'SHUT'); } continue; } found++;
  if (+flag('--show', '-1') === pi) console.log(JSON.stringify(r.map(p => [+p[0].toFixed(2), +p[1].toFixed(2), +clearance(p[0], p[1]).toFixed(2)])));
  let m = 2;
  for (let i = 1; i < r.length; i++) { const p = r[i - 1], q = r[i], len = Math.hypot(q[0] - p[0], q[1] - p[1]), steps = Math.max(1, Math.ceil(len / 0.1));
    for (let t = 0; t <= steps; t++) { const f = t / steps, dA = i === 1 ? f * len : Infinity, dB = i === r.length - 1 ? (1 - f) * len : Infinity; if (dA < 0.35 || dB < 0.35) continue;
      const e = p[0] + (q[0] - p[0]) * f, n = p[1] + (q[1] - p[1]) * f, c = clearance(e, n), w = len / steps; L += w; if (c < 0.25) L25 += w; if (c < 0.3) L30 += w; if (c <= 0) L0 += w; if (c < m) m = c;
      if (c < 0.1 && worst.length < 12 && !worst.some(x => x.startsWith(`${e.toFixed(0)},`))) worst.push(`${e.toFixed(1)}, ${n.toFixed(1)}: ${c.toFixed(2)} m (route ${pi})`); } }
  mins.push(m);
}
const q = (f: number) => { const s = mins.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(f * s.length))].toFixed(3); };
const res = { pairs: PAIRS, routes: found, no_route: none, route_km: +(L / 1000).toFixed(2), least_clearance: { min: q(0), p1: q(0.01), p5: q(0.05), median: q(0.5) },
  share_under_0_25: +(100 * L25 / L).toFixed(3), share_under_0_3: +(100 * L30 / L).toFixed(3), share_in_solid: +(100 * L0 / L).toFixed(4), routes_touching_under_0_25: mins.filter(x => x < 0.25).length };
console.log(JSON.stringify(res, null, 1)); console.log(worst.join('\n'));
if (pass) { mkdirSync(`REVIEWS/evidence/${pass}`, { recursive: true }); const commit = process.env.RUN_COMMIT ?? execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(`REVIEWS/evidence/${pass}/route_clearance${walkPath.includes('head') ? '_before' : ''}.json`, JSON.stringify({ id: 'route_clearance', value: res.share_under_0_25, unit: '% of route length under 0.25 m from a solid', n: found, commit, tool: 'tools/dev/route_census.ts', seed: SEED, walk: walkPath, ...res, worst }, null, 1) + '\n'); }
