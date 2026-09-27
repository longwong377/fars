// D-292: the body and the day, traced in node (gap hunter C's people gaps: C-D09, C-D04..C-D07, C-D46; GC6, GC20).
// For a seed over sampled days, from the population's own plans (population.ts; what the crowd draws follows the plan's act
// and reason, activities.ts performanceFor):
//  - the share of women 15-44 visibly with child (Population.expecting; target 3-6 %, the rate E-70's births imply), and
//    that no woman carries a belly who gives no birth (gravid > 0 only with a due day);
//  - morning washes per household (face and hands at the water jar in the court at rising: the plans' reasons);
//  - shaves per man per month (a man shaved or his beard trimmed by the barber in the lane);
//  - combing and delousing a child on the doorstep, per household per day;
//  - no Persian washing in a stream: every laundry block of a Persian at the river or the canal is on the bank with water
//    drawn up in a jar (Herodotus 1.138, a Greek claim: B).
//
//   npx tsx tools/dev/body_trace.ts [--seed 1] [--days 6] [--json]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { REGNAL_DAYS } from '../../src/people/calendar';
import { STREAM as LAUNDRY_WATER, ON_BANK, type Population, type Seg } from '../../src/people/population';
import { h32, salt } from '../../src/people/hash';

export const WASH_FACE = /washing (his|her|the child['’]s) face and hands/;
export const SHAVE = /^(being shaved|having his beard trimmed) by the barber/;
export const BARBER = /^shaving men of the quarter/;
export const COMB = /combing|delousing|lice/;

export function buildPop(seed: number): Population {
  const W = new WeatherSystem(seed);
  const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  return (new PeopleSim(seed, nav, env) as any).pop as Population;
}
/** the sampled days: spread over the year, drawn from the seed (never chosen) */
export function sampleDays(seed: number, n: number): number[] { const out: number[] = []; for (let k = 0; k < n; k++) out.push(Math.floor((k + h32(seed, salt('body-days'), k) / 4294967296) * REGNAL_DAYS / n)); return out; }

export interface BodyTrace { seed: number; days: number[]; women: number; expecting: number; share: number; bellyNoBirth: number; bellyWomen: number; households: number; washes: number; washPerHH: number;
  washHH: number; men: number; shaves: number; shavesPerManMonth: number; barbers: number; combs: number; combPerHH: number; persianLaundry: number; persianInStream: number; laundryAll: number; examples: string[] }
export function bodyTrace(P: Population, seed: number, days: number[], sample = 1): BodyTrace {
  let women = 0, expecting = 0, bellyNoBirth = 0, bellyWomen = 0, hhN = 0, washes = 0, washHH = 0, men = 0, shaves = 0, barbers = 0, combs = 0, pLaundry = 0, pStream = 0, laundry = 0; const ex: string[] = [];
  for (const d of days) {
    for (let pid = 0; pid < P.persons.length; pid += sample) { const p = P.persons[pid]; if (!P.present(pid, d)) continue; const age = P.ageOn(pid, d);
      if (p.sex === 'f' && age >= 15 && age <= 44 && p.zone !== 'transient') { women++; if (P.expecting(pid, d)) expecting++; }
      const g = P.gravid(pid, d); if (g > 0) { bellyWomen++; if (P.dueIn(pid, d) === null || p.sex !== 'f') bellyNoBirth++; } }
    for (let h = 0; h < P.households.length; h += sample) { const H = P.households[h]; if (H.zone !== 'town' && H.zone !== 'plain') continue; const mem = P.membersOn(h, d); if (!mem.length) continue; hhN++;
      let w = 0; for (const x of mem) { const segs: Seg[] = P.plan(x, d);
        for (const s of segs) { if (WASH_FACE.test(s.why)) { w++; if (ex.length < 6 && w === 1) ex.push(`d${d} p${x}: ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.act} @ ${s.place}: ${s.why}`); }
          if (COMB.test(s.why) && s.with === undefined) combs++; } }
      washes += w; if (w) washHH++; }
    for (let pid = 0; pid < P.persons.length; pid += sample) { const p = P.persons[pid]; if (!P.present(pid, d)) continue; const age = P.ageOn(pid, d); const segs: Seg[] = P.plan(pid, d);
      if (p.sex === 'm' && age >= 16 && P.households[P.home(pid, d)]?.zone === 'town' && p.agent < 0) men++; // (the town's men: the quarters' barbers serve them)
      for (const s of segs) { if (SHAVE.test(s.why)) shaves++; if (BARBER.test(s.why)) barbers++;
        if (s.act === 'wash' && LAUNDRY_WATER.test(s.place)) { laundry++; if (p.persian || p.job === 'guard') { pLaundry++; if (!ON_BANK.test(s.why)) { pStream++; if (ex.length < 12) ex.push(`IN STREAM d${d} p${pid} ${p.job}: ${s.place}: ${s.why}`); } } } } }
  }
  const nd = days.length;
  return { seed, days, women, expecting, share: expecting / Math.max(1, women), bellyNoBirth, bellyWomen, households: hhN, washes, washPerHH: washes / Math.max(1, hhN), washHH: washHH / Math.max(1, hhN), men, shaves,
    shavesPerManMonth: shaves / Math.max(1, men) * 29.5, barbers, combs, combPerHH: combs / Math.max(1, hhN), persianLaundry: pLaundry, persianInStream: pStream, laundryAll: laundry, examples: ex, ...(nd ? {} : {}) };
}

if (process.argv[1]?.endsWith('body_trace.ts')) {
  const arg = (k: string, v: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : v; };
  const seed = +arg('seed', '1'), n = +arg('days', '6'), sample = +arg('sample', '1');
  const P = buildPop(seed), days = sampleDays(seed, n), r = bodyTrace(P, seed, days, sample);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
  else { console.log(`seed ${seed}, days ${days.join(', ')}${sample > 1 ? `, every ${sample}th` : ''}`);
    console.log(`women 15-44 visibly with child: ${r.expecting} of ${r.women} woman-days = ${(100 * r.share).toFixed(2)} % (target 3-6 %); belly drawn on ${r.bellyWomen} person-days, ${r.bellyNoBirth} without a birth`);
    console.log(`morning washes: ${r.washPerHH.toFixed(2)} per household-day (${(100 * r.washHH).toFixed(1)} % of households wash); combing/delousing ${r.combPerHH.toFixed(3)} per household-day`);
    console.log(`shaves: ${r.shaves} over ${r.men} man-days = ${r.shavesPerManMonth.toFixed(2)} per man per month; barber blocks ${r.barbers}`);
    console.log(`laundry at water: ${r.laundryAll}; by Persians or guards ${r.persianLaundry}, in the stream ${r.persianInStream}`);
    for (const e of r.examples) console.log('  ' + e); }
}
