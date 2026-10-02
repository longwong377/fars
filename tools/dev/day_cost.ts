// D-388 (UD-30): the CPU cost of one simulated game day, by part, on a cached world (tests/sim_fixture.ts simAt) with the game's
// options (bonds and asks on, as src/world/world.ts). Timers are wrapped around the parts' methods here (nothing in src changes
// for it): the economy's step (the stranger's own step inside it shown apart), the relations' week, the living world's talk,
// the asks, the rumours, the trust 'heard' pass, and the day plans read the morning after (EconPlans.steps + overlay, through
// Population.plan of every agent of the sim).
//   npx tsx tools/dev/day_cost.ts [seed=1] [from=100] [days=30]    (HASH=1: print a digest of the events and the save after the days)
//   SLICE=<ms>: advance each day by LivingWorld.advanceSliced(d, ms) calls instead of econTo (the sliced path; the digest must not change)
import { createHash } from 'node:crypto';
import { simAt } from '../../tests/sim_fixture';
import { Economy } from '../../src/people/economy/world';
import { Stranger } from '../../src/people/speech/stranger';
import { LivingWorld } from '../../src/people/living/world';
import { AskBook } from '../../src/people/asks/asks';
import { RumourNet } from '../../src/people/asks/rumour';
import { AsksWorld } from '../../src/people/asks/world';
import { Relations } from '../../src/people/relations/world';
import { EconPlans } from '../../src/people/economy/plans';

const seed = Number(process.argv[2] ?? 1), from = Number(process.argv[3] ?? 100), days = Number(process.argv[4] ?? 30);
const ms: Record<string, number> = {}, depth: Record<string, number> = {};
function wrap(proto: any, name: string, label: string) {
  const f = proto[name]; if (typeof f !== 'function') throw new Error(`no ${label}`);
  proto[name] = function (this: unknown, ...a: unknown[]) { if (depth[label]) return f.apply(this, a); depth[label] = 1; const t = performance.now(); try { return f.apply(this, a); } finally { ms[label] = (ms[label] ?? 0) + performance.now() - t; depth[label] = 0; } };
}
function wrapGen(proto: any, name: string, label: string) { // (a part stepped as a generator: the time of each of its steps)
  const f = proto[name]; if (typeof f !== 'function') throw new Error(`no ${label}`);
  proto[name] = function* (this: unknown, ...a: unknown[]) { const g = f.apply(this, a); for (;;) { const t = performance.now(), r = g.next(); ms[label] = (ms[label] ?? 0) + performance.now() - t; if (r.done) return r.value; yield; } };
}
wrap(Economy.prototype, 'step', 'econ'); wrap(Stranger.prototype, 'step', 'stranger');
wrap(LivingWorld.prototype, 'relDay', 'relations'); wrap(Relations.prototype, 'advance', 'relations.advance');
if ('advanceParts' in AskBook.prototype) { wrapGen(AskBook.prototype, 'advanceParts', 'asks'); wrapGen(RumourNet.prototype, 'advanceParts', 'rumours'); } else { wrap(AskBook.prototype, 'advance', 'asks'); wrap(RumourNet.prototype, 'advance', 'rumours'); } wrap(AsksWorld.prototype, 'heard', 'heard');
wrap(AsksWorld.prototype, 'build', 'asks.build');
wrap(EconPlans.prototype, 'steps', 'plans.steps'); wrap(EconPlans.prototype, 'overlay', 'plans.overlay');

let t = performance.now(); const sim = simAt(seed, from, 10, { bonds: true, asks: true });
console.error(`world at day ${from}: ${((performance.now() - t) / 1000).toFixed(1)} s`);
sim.econTo(from); // (the cached save resumes at its day; anything left of it is not this measure)
const pids = sim.agents.map(a => a.pid).filter(p => p >= 0);
const slice = Number(process.env.SLICE ?? 0);
const rows: { d: number; total: number; plans: number; parts: Record<string, number> }[] = [];
for (let d = from + 1; d <= from + days; d++) {
  for (const k of Object.keys(ms)) ms[k] = 0;
  const t0 = performance.now();
  const st = sim.living.stats, s0 = st.msSim;
  if (slice > 0) { let n = 0, worst = 0; for (;;) { const a = performance.now(), ok = sim.living.advanceSliced(d + 1, slice); worst = Math.max(worst, performance.now() - a); n++; if (ok) break; } ms.slices = n; ms.worstSlice = worst; } else sim.econTo(d + 1);
  ms.talk = st.msSim - s0; // (the talk is a generator stepped by the day's parts: its time is the living world's own count)
  const t1 = performance.now(); for (const p of pids) sim.pop.plan(p, d); const t2 = performance.now();
  rows.push({ d, total: t1 - t0, plans: t2 - t1, parts: { ...ms } });
}
// (the first day after the load re-derives what the save does not keep (the relations from day 0, the ask book built): shown apart)
const first = rows.shift()!; if (!rows.length) rows.push(first);
const keys = ['econ', 'stranger', 'relations', 'relations.advance', 'talk', 'asks', 'rumours', 'heard', 'asks.build', 'plans.steps', 'plans.overlay'];
const avg = (f: (r: typeof rows[0]) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length, max = (f: (r: typeof rows[0]) => number) => Math.max(...rows.map(f));
console.log(`seed ${seed}, days ${from + 2}-${from + days} (means and maxima), ${pids.length} agents' plans read after each day${slice ? `, sliced at ${slice} ms` : ''}`);
console.log(`part                mean ms  max ms`);
console.log(`advance (all)     ${avg(r => r.total).toFixed(1).padStart(9)} ${max(r => r.total).toFixed(1).padStart(7)}`);
for (const k of keys) console.log(`  ${k.padEnd(16)}${avg(r => r.parts[k] ?? 0).toFixed(1).padStart(9)} ${max(r => r.parts[k] ?? 0).toFixed(1).padStart(7)}`);
console.log(`first day after the load: advance ${first.total.toFixed(0)} ms (relations ${(first.parts.relations ?? 0).toFixed(0)}, asks built ${(first.parts['asks.build'] ?? 0).toFixed(0)}), plans read ${first.plans.toFixed(0)} ms`);
console.log(`plans read        ${avg(r => r.plans).toFixed(1).padStart(9)} ${max(r => r.plans).toFixed(1).padStart(7)}`);
if (slice) { console.log(`slices per day    ${avg(r => r.parts.slices).toFixed(1).padStart(9)} ${max(r => r.parts.slices).toFixed(0).padStart(7)}`); console.log(`longest slice     ${avg(r => r.parts.worstSlice).toFixed(1).padStart(9)} ${max(r => r.parts.worstSlice).toFixed(1).padStart(7)}`); }
if (process.env.ROWS) for (const r of rows) console.log(r.d, r.total.toFixed(1), r.plans.toFixed(1), JSON.stringify(Object.fromEntries(Object.entries(r.parts).map(([k, v]) => [k, Math.round(v)]))));
if (process.env.HASH) {
  const E = sim.econTo(from + days), h = (x: unknown) => createHash('sha1').update(JSON.stringify(x, (_k, v) => v instanceof Map ? [...v] : v instanceof Set ? [...v] : v)).digest('hex').slice(0, 16);
  sim.t = (from + days) * 24 + 10;
  console.log(`events ${E.events.length} ${h(E.events)}  save ${h(sim.save())}`);
}
