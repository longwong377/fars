// §13.11 shadow review input: 20 random people, each followed for one full day, written as plain-text timelines for an
// independent reviewer (REVIEWS/shadow_*.md). Stratified so both tiers are shadowed: 6 detailed Terrace agents (stepped
// through the day in the abstract LOD, every task change logged with place, activity, reason and what they carry) and 14
// people of the population (their day plans), chosen at random across jobs, ages and zones. Each day is a random day of
// the year; the header gives the date, the weather, the person's household and the day's events.
// Usage: npx tsx tools/shadow_days.ts [seed=1] [pickSeed=7] > shots/shadow-days.txt
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { Rng } from '../src/core/rng';
import { ACTIVITIES } from '../src/people/activities';
import { presentDay } from './shadow_pick';
/** the placeholder flag (D-024): an activity simulated but with no performance */
const ph = (a: string) => ((ACTIVITIES as any)[a]?.placeholder ? ' [PLACEHOLDER: not performed]' : '');

const seed = +(process.argv[2] ?? 1), pick = new Rng(+(process.argv[3] ?? 7), 'shadow-pick');
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(seed);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d % W.days.length, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const hm = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const weatherLine = (d: number) => { const c = W.conditions(d, 12), w = W.days[d]; return `weather: ${w.tmin.toFixed(0)}–${w.tmax.toFixed(0)} °C, cloud ${(c.cloud * 100).toFixed(0)} %, ${w.wet ? (w.snow ? 'snow' : 'rain') + ` ${w.precipMm.toFixed(1)} mm` : 'dry'}, wind ${c.windMs.toFixed(0)} m/s${w.dust ? ', dust' : ''}`; };
const out: string[] = [];
/** age on the day (the year's birthdays counted); months for the under-threes */
const ageStr = (P: any, pid: number, d: number) => { const p = P.persons[pid], a = P.ageOn(pid, d);
  if (a >= 3) return `${a}`; const born = p.born >= 0 ? p.born : (p.bday >= 0 ? p.bday - 354 * (p.age + 1) : -Math.round(354 * (p.age + 0.5)));
  const mo = Math.max(0, Math.floor((d - born) / 29.5)); return mo < 24 ? `${mo} months` : `${a}`; };
out.push(`# Shadow days (§13.11): 20 people, one full day each (seed ${seed}); court absent (D-003). Times are local solar hours.`);

// ---- 6 detailed Terrace agents: step a whole day and log every task change
{
  const sim = new PeopleSim(seed, nav, env);
  for (const a of sim.agents) a.lod = 'abstract';
  const chosen = new Set<number>(); while (chosen.size < 6) chosen.add(pick.int(0, sim.agents.length - 1));
  // a day on which the agent's person is alive and here (S1: the dead and the absent are re-drawn)
  const P00 = (sim as any).pop; const days = [...chosen].map(id => { const pid = P00.persons.findIndex((q: any) => q.agent === sim.agents[id].id); return pid < 0 ? pick.int(1, 350) : presentDay(P00, pid, () => pick.int(1, 350)); });
  for (const [k, id] of [...chosen].entries()) {
    const d = days[k]; sim.jumpTo(d * 24); const a = sim.agents[id];
    // the agent's household is its population person's home on that day (not the agent's own index)
    const P0 = (sim as any).pop; const pid = P0?.persons?.findIndex((q: any) => q.agent === a.id) ?? -1; const H = pid >= 0 ? P0.households[P0.home(pid, d)] : null;
    const ag: number | null = pid >= 0 ? P0.ageOn(pid, d) : null; const sx = ag !== null && ag < 14 ? (a.sex === 'm' ? 'boy' : 'girl') : (a.sex === 'm' ? 'man' : 'woman');
    out.push('', `## Detailed agent #${id}: ${a.name ?? '(unnamed)'} — ${a.role}, ${sx}${ag !== null ? ` ${ag}` : ''}, ${a.origin}${a.name ? ` (name ${a.nameTier}: ${a.nameNote})` : ''}; speaks ${a.langs.join(', ')}`);
    out.push(`day ${d + 1} of the regnal year · ${weatherLine(d)}${H ? ` · household ${H.id} (${H.q ?? H.zone}, home ${H.home}, ${P0.membersOn(H.id, d).length} people)` : ''}`);
    let last = ''; const log: string[] = [];
    for (let t = d * 24; t < d * 24 + 24; t += 1 / 60) {
      while (sim.t < t) sim.step(Math.min(60, (t - sim.t) * 3600));
      // "→ place" while on the way there, "@ place" once arrived; the physical load (carry) or what the plan says is carried
      const LOAD: Record<string, string> = { sack: 'a sack', jar: 'a jar', jar_head: 'a jar of water on the head', basket: 'a bread basket' };
      const tk = a.task; const held = a.carry ? LOAD[a.carry] ?? a.carry : tk?.holds; const s = `${sim.performance(a).act}${ph(sim.performance(a).act)} ${a.walking ? '→' : '@'} ${tk?.place ?? '-'} — ${tk?.why ?? ''}${held ? ` [carrying ${held}]` : ''}${a.sick ? ' [sick]' : ''}`;
      if (s !== last) { log.push(`${hm(t - d * 24)}  ${s}`); last = s; }
    }
    out.push(...(log.length > 90 ? [...log.slice(0, 60), `  … ${log.length - 80} more changes …`, ...log.slice(-20)] : log));
  }
  // ---- 14 people of the population: day plans
  const P = (sim as any).pop; const ids: number[] = [];
  while (ids.length < 14) { const i = pick.int(0, P.persons.length - 1), p = P.persons[i]; if (p.agent >= 0) continue; ids.push(i); }
  for (const pid of ids) {
    const p = P.persons[pid]; const d = presentDay(P, pid, () => pick.int(1, 350));
    if (d < 0) continue;
    const H = P.households[P.home(pid, d)];
    out.push('', `## Person ${pid}: ${P.nameOf(pid) ?? '(unnamed)'} — ${p.job}${p.sub ? ` (${p.sub})` : ''}, ${p.sex === 'm' ? 'male' : 'female'}, age ${ageStr(P, pid, d)}, ${p.origin}, zone ${p.zone}`);
    out.push(`day ${d + 1} of the regnal year · ${weatherLine(d)} · household ${H.id} (${H.zone}, ${P.membersOn(H.id, d).length} people: ${P.membersOn(H.id, d).map((x: number) => `${x} ${P.persons[x].job} ${P.persons[x].sex}${ageStr(P, x, d)}`).join(', ')})${P.sick(pid, d) ? ' · SICK today' : ''}`);
    for (const s of P.plan(pid, d)) out.push(`${hm(s.t0)}–${hm(s.t1)}  ${s.act}${ph(s.act)} @ ${s.place} (${s.where}) — ${s.why}${s.with !== undefined ? ` [with ${s.with}]` : ''}${s.carry ? ` [carrying ${s.carry}]` : ''}${s.ev ? ` {${s.ev}}` : ''}`);
  }
}
console.log(out.join('\n'));
