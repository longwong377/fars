// D-780 (s18 C13): where the court is at an hour of a day (from the plans): `npx tsx tools/dev/_gift_at.ts <day> <hour>` (seed 1)
import { readFileSync } from 'node:fs';
import { PeopleSim } from '../../src/people/sim';
import { NavGrid } from '../../src/people/navgrid';
import { WeatherSystem } from '../../src/weather/weatherState';
import { segAt } from '../../src/people/population';
const seed = 1, d = +(process.argv[2] ?? 19), h = +(process.argv[3] ?? 8.5), W = new WeatherSystem(seed);
const env = (t: number) => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const sim = new PeopleSim(seed, nav, env as any, { court: true } as any), P = (sim as any).pop, K = P.court;
const by = new Map<string, number>();
for (let pid = K.first; pid < K.end; pid++) { if (!P.present(pid, d)) continue; const g = K.member(pid)?.g; const s = segAt(P.plan(pid, d), h); const k = `${g} @ ${s.place} (${s.act})`; by.set(k, (by.get(k) ?? 0) + 1); }
console.log('day', d, 'h', h, 'kingDay', JSON.stringify(K.kingDay(d)), 'called', K.dayOrder(d).turns.length, 'stations', K.dayOrder(d).station.size);
for (const [k, n] of [...by].filter(([k]) => !/sleep|rcamp|court_camp \(|station/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(n, k);
