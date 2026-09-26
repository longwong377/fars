// dev (D-229): the Treasury's letters on a day: each messenger's letter segment and where the Treasury's scribes and the
// officials are at its middle, with and without the court setting. Usage: npx tsx tools/dev/receipt_dump.ts <day> [seed=1]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { segAt } from '../../src/people/population';
import { receipts, LETTER_WHY } from '../../src/people/planCheck';
const d = +process.argv[2], seed = +(process.argv[3] ?? 1);
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(seed);
const env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd % W.days.length, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
for (const court of [false, true]) {
  const sim = new PeopleSim(seed, nav, env, { court }); for (const ag of sim.agents) ag.lod = 'abstract'; sim.jumpTo(0); sim.cal.ctx(d + 1); const P = sim.pop;
  console.log(`=== court ${court}: day ${d}; letters ${JSON.stringify(P.cal.ctx(d).letters)}`);
  for (const m of P.messengers) for (const s of P.plan(m, d)) if (s.why === LETTER_WHY) { const h = (s.t0 + s.t1) / 2;
    console.log(`messenger ${m}: ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} at ${s.place}`);
    for (const x of P.treasuryScribes) if (P.present(x, d)) { const q = segAt(P.plan(x, d), h); console.log(`   scribe ${x} (${P.persons[x].job}): ${q.place} ${q.act} | ${q.why}`); }
    for (let i = 0; i < P.persons.length; i++) if (P.persons[i].job === 'official' && P.present(i, d)) { const q = segAt(P.plan(i, d), h); if (q.place.startsWith('treasury')) console.log(`   official ${i}: ${q.place} ${q.act}`); } }
  console.log('issues', JSON.stringify(receipts(P, d, pid => P.plan(pid, d))));
}
