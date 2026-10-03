// D-651: every distinct phrasing the calendar writes into the chronicle over a year (digits folded to #), with its kind and
// place: the out-of-world record must read as the world's own (no decision ids, tiers, clock times or raw ids).
// npx tsx tools/dev/chronicle_texts.ts [seed] [court 0|1]
import { nav, envOf } from '../../tests/sim_fixture';
import { PeopleSim } from '../../src/people/sim';
const seed = +(process.argv[2] ?? 1), S = new PeopleSim(seed, nav(), envOf(seed), { court: process.argv[3] === '1' });
const seen = new Map<string, { n: number; kind: string; place: string; ex: string }>();
S.cal.ctx(353);
for (const e of S.cal.eventsBetween(-1, 354 * 24)) { const k = e.text.replace(/\d+(\.\d+)?/g, '#'); const x = seen.get(k); if (x) x.n++; else seen.set(k, { n: 1, kind: e.kind, place: e.place, ex: e.text }); }
for (const [k, x] of [...seen].sort((a, b) => a[1].kind < b[1].kind ? -1 : 1)) console.log(`${String(x.n).padStart(5)} [${x.kind}] {${x.place}} ${k}`);
