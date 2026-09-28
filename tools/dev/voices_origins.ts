// D-336 (B190): who in the population speaks wordless voice (no published corpus of their people here: T-K1a2)
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { voiceLang } from '../../src/audio/voices';
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const S = new PeopleSim(1, nav, env); const P = S.pop; const by = new Map<string, number>();
for (const p of P.persons) by.set(p.origin, (by.get(p.origin) ?? 0) + 1);
const agentLangs = new Map<string, number>(); for (const a of S.agents) { const l = voiceLang(a.langs[0] ?? a.origin, a.langs).lang ?? 'wordless'; agentLangs.set(l, (agentLangs.get(l) ?? 0) + 1); }
let wl = 0; for (const [o, n] of [...by].sort((a, b) => b[1] - a[1])) { const l = voiceLang(o).lang ?? 'wordless'; if (l === 'wordless') wl += n; console.log(o.padEnd(12), String(n).padStart(6), l); }
console.log('wordless share of the population', (100 * wl / P.persons.length).toFixed(2), '%; detailed agents by language', JSON.stringify([...agentLangs]));
