// Timing of the economy alone vs with the ask book and the rumour net (D-352): node tools/dev/asks_prof.ts (vite-node / tsx)
import { Population } from '../../src/people/population';
import { Economy } from '../../src/people/economy/world';
import { householdsOf } from '../../src/people/economy/chains';
import { AskBook } from '../../src/people/asks/asks';
import { RumourNet } from '../../src/people/asks/rumour';
const DAYS = Number(process.argv[2] ?? 60), D0 = Number(process.argv[3] ?? 250);
const hs = householdsOf(new Population(1));
let t = performance.now(); const E = new Economy(1, hs), B = new AskBook(E, 1, { kinHelp: true }), R = new RumourNet(E, 1);
let te = 0, ta = 0, tr = 0;
for (let d = 0; d < D0 + DAYS; d++) { if (process.env.V) console.log(d, (ta/1000).toFixed(1), (tr/1000).toFixed(1), B.asks.length, R.rumours.length); let a = performance.now(); E.step(d); te += performance.now() - a; a = performance.now(); B.advance(d); ta += performance.now() - a; a = performance.now(); R.advance(d); tr += performance.now() - a; }
console.log(`econ ${(te / 1000).toFixed(1)} s (all ${D0 + DAYS} days), asks ${(ta / 1000).toFixed(1)} s, rumour ${(tr / 1000).toFixed(1)} s over ${DAYS} days from ${D0}; asks ${B.asks.length}, rumours ${R.rumours.length}; total ${((performance.now() - t) / 1000).toFixed(0)} s`);
