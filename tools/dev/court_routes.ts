// The Terrace route searches the court's walks need (D-182): the distinct pairs of place anchors (popgeo.ts core routes)
// its people walk between in a day, and what searching them all costs. Usage: npx tsx tools/dev/court_routes.ts [day=30]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, PLACES, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { PopGeo } from '../../src/people/popgeo';

const d = +(process.argv[2] ?? 30);
const W = new WeatherSystem(1);
const env = (x: number): Env => { const dd = Math.floor(x / 24), c = W.conditions(dd, x - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const sim = new PeopleSim(1, nav, env, { court: true }), K = sim.pop.court!;
const geo = new PopGeo({ pop: sim.pop, nav, town: null, seed: 1 });
const anchorOf = (pl: string) => (PLACES[pl] as { anchor?: string } | undefined)?.anchor ?? pl;
const pairs = new Map<string, number>(); const onT = (pl: string) => pl in PLACES;
for (let pid = K.first; pid < K.end; pid++) { if (!sim.pop.present(pid, d)) continue; const segs = sim.pop.plan(pid, d); let last: string | null = null;
  for (const s of segs) { if (s.where === 'road') continue; const pl = onT(s.place) ? anchorOf(s.place) : '@stair';
    if (last && last !== pl) { const k = last < pl ? `${last}>${pl}` : `${pl}>${last}`; pairs.set(k, (pairs.get(k) ?? 0) + 1); } last = pl; } }
const anchors = new Set([...pairs.keys()].flatMap(k => k.split('>')));
const t0 = performance.now(); let n = 0; const slow: [string, number][] = [];
for (const k of pairs.keys()) { const [a, b] = k.split('>'); const t1 = performance.now(); (geo as any).navBudget = 1; (geo as any).core(a, b); const ms = performance.now() - t1; n++; slow.push([k, ms]); }
slow.sort((x, y) => y[1] - x[1]);
console.log(`day ${d}: ${anchors.size} anchors, ${pairs.size} pairs walked (${[...pairs.values()].reduce((x, y) => x + y, 0)} walks); searching them all ${((performance.now() - t0) / 1000).toFixed(1)} s (${n}); slowest ${JSON.stringify(slow.slice(0, 5).map(([k, m]) => [k, +m.toFixed(0)]))}`);
