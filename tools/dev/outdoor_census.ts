// D-651: the out-of-doors day, node-side, read as C12's pagecheck reads the page (tools/dev/pagecheck.mjs: within 60 m of the
// view, out of doors and not inside a walled court, and walking). Views: pagecheck's lanes, qs1, court, fields, and the town's
// coverage points at daytime hours. A frame sees ~a quarter of the 60 m ring (C12's target 15+ in frame ~ 60 open in the ring).
// npx tsx tools/dev/outdoor_census.ts [seed] [hours of the town sample]
import { readFileSync } from 'node:fs';
import { buildTraceWorld } from './people_trace';
const seed = +(process.argv[2] ?? 1), hours = (process.argv[3] ?? '8,10.5,13.8,16,18.5').split(',').map(Number);
const COV = JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8')).points as any[]; const cov = (id: string) => COV.find(x => x.id === id);
const W = buildTraceWorld(seed); const S = W.sim, V = W.view as any;
const at = (day: number, hour: number) => { const t = day * 24 + hour; S.jumpTo(t); V.settle(t, [-422, -941]); return V.visible as any[]; };
const ring = (vis: any[], e: number, n: number) => { let all = 0, open = 0, walled = 0, moving = 0; const why: Record<string, number> = {};
  for (const p of vis) { if (Math.hypot(p.e - e, p.n - n) > 60) continue; all++; if (p.indoor) continue; if (p.wall > 0) { walled++; continue; } open++; if (p.moving) moving++; const k = (p.moving ? 'walk: ' : '') + p.why.split(/[,:(]/)[0].slice(0, 32); why[k] = (why[k] ?? 0) + 1; }
  return { all, open, walled, moving, top: Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join('; ') }; };
const views: [string, any][] = [['lanes cov-142', cov('cov-142')], ['qs1 (cov-381, d0 10h)', { ...cov('cov-381'), day: 0, hour: 10 }], ['court cov-037', cov('cov-037')], ['fields cov-196', cov('cov-196')]];
for (const [k, v] of views) { const r = ring(at(v.day, v.hour), v.e, v.n); console.log(`${k.padEnd(22)} d${v.day} ${(+v.hour).toFixed(1)}h: open ${r.open} (walking ${r.moving}), walled ${r.walled}, of ${r.all} | ${r.top}`); }
const town = COV.filter(p => p.area === 'town' && (p.sub === 'town:lanes' || p.sub === 'town:courts' || p.sub === 'town:open')).filter((_, i) => i % 4 === 0);
for (const d of [88, 200]) for (const h of hours) { const vis = at(d, h); const rs = town.map(p => ring(vis, p.e, p.n)); const o = rs.map(r => r.open).sort((a, b) => a - b), m = rs.map(r => r.moving);
  console.log(`town ${town.length} pts d${d} ${h}h: open median ${o[o.length >> 1]}, min ${o[0]}; walking mean ${(m.reduce((a, b) => a + b, 0) / m.length).toFixed(1)}, points with no walker ${m.filter(x => x === 0).length}`); }
