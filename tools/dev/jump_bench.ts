// D-650: the cost of a day change in the people's simulation, node-side, with the world's options (world.ts: bonds, asks;
// COURT=1: the seasonal court as the scoreboard's pages). Before: the jump made at once (PeopleSim.jumpTo(t), what the world
// did); after: the jump made across frames (jumpTo(t, SLICE ms) called until it is made: the longest call, the calls, the
// last call that places everyone) and the day's turn at midnight with tomorrow made ready each step (aheadMs).
//   npx tsx tools/dev/jump_bench.ts [seed=1] [days=1,181,365] [SLICE=8]
import { nav, envOf, simAt } from '../../tests/sim_fixture';
import { PeopleSim } from '../../src/people/sim';
const seed = +(process.argv[2] ?? 1), days = (process.argv[3] ?? '1,181,365').split(',').map(Number), SLICE = +(process.env.SLICE ?? 8);
const opts = { bonds: true, asks: true, court: process.env.COURT === '1' }, now = () => performance.now();
const make = () => { const s = new PeopleSim(seed, nav(), envOf(seed), opts); s.jumpTo(10); return s; };
const A = make(), B = make(); let prev = 0;
for (const d of days) {
  const lbl = `day ${prev} -> ${d} (+${d - prev})`.padEnd(24);
  let t = now(); A.jumpTo(d * 24 + 10); const whole = now() - t;
  let calls = 0, worst = 0, last = 0, total = 0;
  for (;;) { t = now(); const done = B.jumpTo(d * 24 + 10, SLICE); last = now() - t; total += last; calls++; if (done) break; worst = Math.max(worst, last); }
  console.log(`${lbl} before: one call ${whole.toFixed(0)} ms | after (${SLICE} ms slices): ${calls} calls, longest ${worst.toFixed(0)} ms before the last, last ${last.toFixed(0)} ms, total ${total.toFixed(0)} ms`);
  prev = d;
}
// the day's turn: 30-s steps from 23:00 of day 60 (the cached world) through midnight, the longest step, without and with aheadMs
const turn = (ahead: number) => { const s = simAt(seed, 60, 22, opts); s.aheadMs = ahead; for (let i = 0; i < 120; i++) s.step(30); /* (the first hour after the load: its own costs, not the turn's) */ let w = 0, sum = 0, wh = 0; for (let i = 0; i < 3 * 120; i++) { const t = now(); s.step(30); const x = now() - t; if (x > w) { w = x; wh = s.t % 24; } sum += x; } return `longest step ${w.toFixed(0)} ms (at ${wh.toFixed(2)} h), mean ${(sum / 360).toFixed(1)} ms`; };
console.log(`midnight of day 60, 30-s steps 23:00-02:00: before ${turn(0)} | after (aheadMs 4) ${turn(4)}`);
