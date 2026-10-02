// B230: the households of people_days_r3's water check (every 7th, days 45/97/200/300) where nobody draws water though the
// house has a waterer: the waterer's plan and why. Run: npx tsx tools/dev/nowater_trace.ts
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import type { Seg } from '../../src/people/population';
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim = new PeopleSim(1, nav, env); const P: any = (sim as any).pop;
let days = 0; const bad: string[] = [];
for (let h = 0; h < P.households.length; h += 7) { const H = P.households[h]; if (H.zone !== 'town' && H.zone !== 'plain') continue;
  for (const d of [45, 97, 200, 300]) { const mem: number[] = P.membersOn(h, d); if (!mem.length) continue; days++; const hd = P.hday(h, d);
    if (hd.waterer < 0 || mem.some(x => (P.plan(x, d) as Seg[]).some(s => s.act === 'draw_water'))) continue;
    const w = hd.waterer, q = P.persons[w]; bad.push(`hh ${h} d${d} waterer ${w} ${q.job} ${q.sex}${P.ageOn(w, d)} sick=${P.sick(w, d)} member=${mem.includes(w)} wed=${!!P.weddingOf?.(w, d)}`);
    if (d === 97 && bad.filter(x => x.startsWith('hh') && x.includes(' d97 ')).length <= 6) for (const s of P.plan(w, d) as Seg[]) if (s.t0 > 5 && s.t0 < 20) bad.push(`   ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.place} ${s.act} ${s.why}`); } }
console.log('days', days, 'dry', bad.filter(x => x.startsWith('hh')).length); console.log(bad.join('\n'));
