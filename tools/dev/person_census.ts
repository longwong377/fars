// dev: completeness of every person's life (the user's standard: every person has a name, a home, a family, a job and a
// history; nothing copy-pasted). Prints shares over the whole population (seed 1, court absent unless --court).
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { nameFor } from '../../src/people/population';
const court = process.argv.includes('--court');
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d % W.days.length, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim = new PeopleSim(1, nav, env, { court }); const P: any = sim.pop;
const N = P.persons.length; let named = 0, home = 0, plot = 0, kin = 0, job = 0, alone = 0; const names = new Map<string, number>(), jobs = new Map<string, number>();
const byOrigin = new Map<string, { n: number; named: number; distinct: Set<string> }>();
for (const p of P.persons) {
  const nm = nameFor(1, p); if (nm) { named++; names.set(nm, (names.get(nm) ?? 0) + 1); }
  const o = byOrigin.get(`${p.origin}/${p.sex}`) ?? { n: 0, named: 0, distinct: new Set<string>() }; o.n++; if (nm) { o.named++; o.distinct.add(nm); } byOrigin.set(`${p.origin}/${p.sex}`, o);
  const H = P.households[p.hh]; if (H) { home++; if (H.plot || H.zone !== 'town') plot++; if (H.members.length > 1) kin++; else alone++; }
  if (p.job) { job++; jobs.set(p.job, (jobs.get(p.job) ?? 0) + 1); }
}
const top = [...names].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log(JSON.stringify({ persons: N, named: +(named / N).toFixed(3), distinctNames: names.size, topNames: top, withHousehold: +(home / N).toFixed(3), onAPlotOrPlace: +(plot / N).toFixed(3), livingWithOthers: +(kin / N).toFixed(3), livingAlone: alone, withJobOrRole: +(job / N).toFixed(3), jobs: jobs.size }, null, 1));
console.log('by origin/sex: n, named share, distinct names, persons per name');
for (const [k, o] of [...byOrigin].sort((a, b) => b[1].n - a[1].n).slice(0, 14)) console.log(`  ${k}: ${o.n}, ${(o.named / o.n).toFixed(2)}, ${o.distinct.size}, ${(o.named / Math.max(1, o.distinct.size)).toFixed(0)}`);
