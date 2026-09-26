// dev (D-255): who works the crafts and the records, where and when. Builds the population (seed 1), then over the days
// asked prints, for each of the crafts' activities, how many person-hours were given to it, by how many people, at which
// places and hours, and a few named examples (name, job, place, hours, reason); and the reasons that name one of these
// acts but are performed as another (the fit rules of planCheck.ts, the detector escape of REVIEWS/escapes.md).
// Usage: npx tsx tools/dev/craft_trace.ts [firstDay=20] [days=14] [--counts]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { reasonOk } from '../../src/people/planCheck';
import { nameFor } from '../../src/people/population';
import type { ActivityId } from '../../src/people/activities';

const args = process.argv.slice(2).filter(a => !a.startsWith('--')), d0 = +(args[0] ?? 20), n = +(args[1] ?? 14);
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim = new PeopleSim(1, nav, env), P = sim.pop;
const CRAFT: ActivityId[] = ['smith', 'goldsmith', 'weigh', 'seal', 'cut_seal', 'tan', 'press_oil'];
if (process.argv.includes('--counts')) {
  const c = new Map<string, number>(); for (const p of P.persons) { const k = `${p.job}/${p.sub ?? ''}`; c.set(k, (c.get(k) ?? 0) + 1); }
  console.log([...c].filter(([k]) => /craftsman|treasury|caretaker/.test(k)).map(([k, v]) => `${k} ${v}`).join('\n'));
  const smiths = P.persons.filter(p => p.job === 'craftsman' && P.plotOf(p.hh)?.craft === 'metal'); console.log(`craftsmen in metal workshops: ${smiths.length} (households ${new Set(smiths.map(p => p.hh)).size})`);
}
const stat = new Map<ActivityId, { h: number; who: Set<number>; places: Map<string, number>; hours: number[]; ex: string[] }>();
const misfit = new Map<string, number>();
for (let d = d0; d < d0 + n; d++) for (let pid = 0; pid < P.persons.length; pid++) { if (!P.present(pid, d)) continue;
  for (const s of P.plan(pid, d)) {
    if (s.where !== 'road' && !reasonOk(s.act, s.why)) misfit.set(`${s.act} — ${s.why.slice(0, 70)}`, (misfit.get(`${s.act} — ${s.why.slice(0, 70)}`) ?? 0) + 1);
    if (!CRAFT.includes(s.act)) continue; let x = stat.get(s.act); if (!x) stat.set(s.act, x = { h: 0, who: new Set(), places: new Map(), hours: new Array(24).fill(0), ex: [] });
    x.h += s.t1 - s.t0; x.who.add(pid); const pl = s.place.replace(/:\d+$/, ':N'); x.places.set(pl, (x.places.get(pl) ?? 0) + s.t1 - s.t0);
    for (let h = Math.floor(s.t0); h < Math.ceil(s.t1) && h < 24; h++) x.hours[h] += Math.min(s.t1, h + 1) - Math.max(s.t0, h);
    if (x.ex.length < 4 && !x.ex.some(e => e.startsWith(`${pid} `))) { const p = P.persons[pid];
      x.ex.push(`${pid} ${nameFor(P.seed, p) ?? '(unnamed)'} (${p.sex}, ${P.ageOn(pid, d)}, ${p.job}/${p.sub ?? ''}) day ${d} ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} at ${s.place}: “${s.why}”`); } } }
const hh = (x: number[]) => x.map((v, h) => v > 0.05 ? `${h}:${v.toFixed(0)}` : '').filter(Boolean).join(' ');
for (const a of CRAFT) { const x = stat.get(a); if (!x) { console.log(`${a}: NONE in days ${d0}-${d0 + n - 1}`); continue; }
  console.log(`${a}: ${x.h.toFixed(0)} person-hours by ${x.who.size} people; places ${[...x.places].sort((p, q) => q[1] - p[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(0)} h`).join(', ')}\n  hours ${hh(x.hours)}\n  ${x.ex.join('\n  ')}`); }
const mis = [...misfit].sort((a, b) => b[1] - a[1]);
console.log(`reasons performed as another act (planCheck reasonOk): ${mis.length} kinds${mis.length ? '\n  ' + mis.slice(0, 20).map(([k, v]) => `${v}× ${k}`).join('\n  ') : ''}`);
