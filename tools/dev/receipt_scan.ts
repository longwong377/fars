// dev (D-229): the Treasury receipts check (planCheck receipts) on every day of the year, with and without the court
// setting (the soak checks it on every third day only). Usage: npx tsx tools/dev/receipt_scan.ts [days=354] [seed=1]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { receipts, LETTER_WHY } from '../../src/people/planCheck';
const days = +(process.argv[2] ?? 354), seed = +(process.argv[3] ?? 1);
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(seed);
const env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd % W.days.length, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
for (const court of [false, true]) {
  const sim = new PeopleSim(seed, nav, env, { court }); for (const ag of sim.agents) ag.lod = 'abstract'; sim.jumpTo(0); const P = sim.pop;
  let letters = 0, lettersCal = 0; const bad: string[] = [];
  for (let d = 0; d < days; d++) { sim.cal.ctx(d + 1); lettersCal += P.cal.ctx(d).letters.length;
    for (const m of P.messengers) if (P.present(m, d)) letters += P.plan(m, d).filter(s => s.why === LETTER_WHY).length;
    for (const x of receipts(P, d, pid => P.plan(pid, d))) bad.push(`day ${d}: ${x.pid} ${x.note}`); }
  console.log(`court ${court}: ${lettersCal} Treasury letters in the calendar, ${letters} delivered; ${bad.length} receipt issues`); for (const b of bad.slice(0, 12)) console.log('  ' + b);
}
