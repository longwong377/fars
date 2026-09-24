// Print the day plans of court people (D-182). Usage: npx tsx tools/dev/court_plan.ts <pid|group> [day=0] [n=1] [seed=1]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { checkPlan } from '../../src/people/planCheck';
import { WeatherSystem } from '../../src/weather/weatherState';

const [who, dayS, nS, seedS] = process.argv.slice(2); const day = +(dayS ?? 0), n = +(nS ?? 1), seed = +(seedS ?? 1);
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(seed);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim = new PeopleSim(seed, nav, env, { court: true }); const P = sim.pop, K = P.court!;
const pids = /^\d+$/.test(who) ? [+who] : (K.byGroup.get(who as any) ?? []).slice(0, n);
const f = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;
for (const pid of pids) for (let d = day; d < day + (/^\d+$/.test(who) ? n : 1); d++) {
  const p = P.persons[pid]; console.log(`\n${pid} ${P.nameOf(pid)} ${K.roleOf(pid)} ${p.sex}${p.age} day ${d}${K.member(pid)?.g === 'royal_guard' ? ` phase ${K.phase(pid, d)}` : ''}`);
  const segs = P.plan(pid, d); for (const s of segs) console.log(`  ${f(s.t0)}-${f(s.t1)} ${s.where.padEnd(7)} ${s.place.padEnd(24)} ${s.act.padEnd(14)} ${s.why}${s.carry ? ` [${s.carry}]` : ''}`);
  console.log('  issues', JSON.stringify(checkPlan(P, pid, d, segs, d > 0 ? P.plan(pid, d - 1).slice(-1)[0].place : null)));
}
