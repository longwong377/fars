// D-340 node preview: the economy in the day plans of a seeded day. Prints, for a seed and a day, how many economy-driven
// steps were given to people and laid into their days (by kind), a sample of those people's plans around the step, and
// the year's crisis counts (thefts, arrests, judgements, petitions, bondages). Out of world, English.
// Run: npx tsx tools/dev/econ_day.ts [seed=1] [day=150] [sample=12]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';

export function makeSim(seed: number) {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const W = new WeatherSystem(seed), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  return new PeopleSim(seed, nav, env);
}
/** lay every economy step of a day; returns per kind [given, laid] and the laid people's plans */
export function layDay(S: PeopleSim, day: number) {
  const steps = S.econPlans.steps(day), by: Record<string, [number, number]> = {}, why: Record<string, number> = {}; const plans = new Map<number, ReturnType<PeopleSim['pop']['plan']>>();
  for (const pid of steps.keys()) { const p = S.pop.plan(pid, day); plans.set(pid, p); for (const L of S.econPlans.laid.get(`${pid}:${day}`) ?? []) { const b = by[L.step.kind] ?? (by[L.step.kind] = [0, 0]); b[0]++; if (L.ok) b[1]++; else { const w = `${L.step.kind}: ${(L.why ?? "?").slice(0, 60)}`; why[w] = (why[w] ?? 0) + 1; } } }
  return { by, plans, steps, why };
}
const hm = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/dev/econ_day.ts')) {
  const seed = +(process.argv[2] ?? 1), day = +(process.argv[3] ?? 150), n = +(process.argv[4] ?? 12);
  const S = makeSim(seed); S.t = day * 24 + 6;
  const { by, plans, why } = layDay(S, day);
  const tot = Object.values(by).reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);
  console.log(`seed ${seed} day ${day}: ${tot[0]} economy steps given, ${tot[1]} laid into the day plans`);
  for (const [k, [g, l]] of Object.entries(by).sort((a, b) => b[1][0] - a[1][0])) console.log(`  ${k.padEnd(18)} ${String(g).padStart(4)} given ${String(l).padStart(4)} laid`);
  console.log("not laid:"); for (const [w, c] of Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${c} ${w}`);
  const kinds = new Set<string>(); let shown = 0;
  for (const [pid, p] of plans) { const ev = p.filter(s => s.ev?.startsWith('D-340')); if (!ev.length) continue; const k = ev[0].ev!.split(': ')[1].split(' ')[0]; if (kinds.has(k) && shown >= n / 2) continue; kinds.add(k); if (++shown > n) break;
    const P = S.pop.persons[pid]; console.log(`\n${S.pop.nameOf(pid) ?? '(unnamed)'} (${P.sex}, ${S.pop.ageOn(pid, day)}, ${P.job}, house ${S.pop.home(pid, day)}):`);
    const a = Math.max(0, p.indexOf(ev[0]) - 1), b = Math.min(p.length, p.indexOf(ev[ev.length - 1]) + 2);
    for (const s of p.slice(a, b)) console.log(`  ${hm(s.t0)}-${hm(s.t1)} ${s.act.padEnd(10)} ${s.place.padEnd(16)} ${s.why}${s.ev?.startsWith('D-340') ? '  [economy]' : ''}`); }
  const E = S.econTo(353), k: Record<string, number> = {}; for (const v of E.events) k[v.kind] = (k[v.kind] ?? 0) + 1;
  const c = (...xs: string[]) => xs.reduce((a, x) => a + (k[x] ?? 0), 0);
  console.log(`\nthe year (seed ${seed}): thefts ${c('theft')}, accusations ${c('accusation')}, arrests ${c('arrest')}, theft judgements ${c('acquitted', 'fined', 'beaten')}, debt suits ${c('suit')}, debt judgements ${c('time_granted', 'debt_labour')}, bondages ${c('bound_labour')}, petitions ${c('petition')} (relief ${c('relief')}, remitted ${c('remitted')}, refused ${c('petition_refused')}), loans ${c('loan')} (refused ${c('loan_refused')}), fires ${c('house_fire')}, animals lost ${c('animal_lost')}, levies ${c('levy')}`);
}
