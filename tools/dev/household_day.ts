// D-350: a household's day: the minder, the little ones' final plans and their mother's (plan and raw). Run: npx tsx tools/dev/household_day.ts <pid> <day>
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim = new PeopleSim(1, nav, env); const P: any = (sim as any).pop;
const pid = +process.argv[2], d = +process.argv[3], h = P.home(pid, d);
const md = P.mindDay(h, d); console.log('minder', md.minder, 'spans', JSON.stringify(md.spans));
for (const x of P.membersOn(h, d)) { const q = P.persons[x]; console.log(`--- ${x} ${q.job} ${q.sex}${P.ageOn(x, d)} mother ${q.mother}`);
  if (P.ageOn(x, d) <= 13) for (const s of P.plan(x, d)) console.log(`  ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.place} ${s.act} ${s.why} with=${s.with}`); }
for (const x of P.membersOn(h, d)) if (P.persons[x].mother >= 0 && P.ageOn(x, d) <= 4) { const m = P.persons[x].mother; console.log(`=== mother ${m}`); for (const s of P.plan(m, d)) console.log(`  ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.place} ${s.act} ${s.why}`); console.log('raw'); for (const s of P.rawPlan(m, d)) console.log(`  ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.place} ${s.act} ${s.why}`); break; }
