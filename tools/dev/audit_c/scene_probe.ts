// audit probe: scene-level repetition. For every place, at a fixed hour, compare what is there on different days
// (which persons, doing what). Uses the population's day plans (pure functions of seed, person, day).
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../../src/people/navgrid';
import { PeopleSim, Env } from '../../../src/people/sim';
import { WeatherSystem } from '../../../src/weather/weatherState';
import { segAt } from '../../../src/people/population';
process.chdir('/home/user/fars');
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d % W.days.length, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim = new PeopleSim(1, nav, env, {}); const P: any = sim.pop; const N = P.persons.length;
const HOUR = +(process.argv[2] ?? 10); const DAYS = [20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 33, 40, 47];
type Snap = Map<string, { ids: Set<number>; acts: Map<string, number> }>;
const snaps: Snap[] = [];
for (const d of DAYS) { const m: Snap = new Map();
  for (let pid = 0; pid < N; pid++) { const segs = P.plan(pid, d); if (!segs?.length) continue; const s = segAt(segs, HOUR);
    if (!s || s.where === 'away') continue; const place = s.place; let e = m.get(place); if (!e) { e = { ids: new Set(), acts: new Map() }; m.set(place, e); }
    e.ids.add(pid); e.acts.set(s.act, (e.acts.get(s.act) ?? 0) + 1); }
  snaps.push(m); }
// per place: mean over consecutive-day pairs of (a) Jaccard of persons present, (b) histogram overlap of acts, (c) count ratio
const places = new Set<string>(); for (const m of snaps) for (const k of m.keys()) places.add(k);
const rows: any[] = [];
for (const pl of places) { let jac = 0, hist = 0, n = 0, cnt = 0;
  for (let i = 0; i + 1 < snaps.length; i++) { const a = snaps[i].get(pl), b = snaps[i + 1].get(pl); if (!a || !b) continue;
    let inter = 0; for (const x of a.ids) if (b.ids.has(x)) inter++; jac += inter / (a.ids.size + b.ids.size - inter);
    const ta = a.ids.size, tb = b.ids.size; let ov = 0; for (const [k, v] of a.acts) ov += Math.min(v / ta, (b.acts.get(k) ?? 0) / tb); hist += ov; n++; cnt += (ta + tb) / 2; }
  if (n >= 6 && cnt / n >= 5) rows.push({ place: pl, meanPeople: +(cnt / n).toFixed(1), samePeople: +(jac / n).toFixed(3), sameActMix: +(hist / n).toFixed(3), pairs: n }); }
rows.sort((a, b) => b.meanPeople - a.meanPeople);
const w = (r: any[]) => r.reduce((s, x) => s + x.meanPeople, 0);
const tot = w(rows); const hi = rows.filter(r => r.samePeople >= 0.9 && r.sameActMix >= 0.95);
console.log(JSON.stringify({ hour: HOUR, days: DAYS, places: rows.length, peopleInThem: +tot.toFixed(0), shareOfPeopleInNearIdenticalScenes: +(w(hi) / tot).toFixed(3), nearIdenticalPlaces: hi.length }));
console.log('top 25 places by people (same persons Jaccard, same activity mix overlap), consecutive sampled days:');
const byS = [...rows].sort((a, b) => b.samePeople - a.samePeople); console.log("most repeated:"); for (const r of byS.slice(0, 25)) console.log(`  ${r.place}: ${r.meanPeople} people, same persons ${r.samePeople}, same act mix ${r.sameActMix}`);
console.log(JSON.stringify({ over08: rows.filter(r => r.samePeople >= 0.8).length, peopleOver08: +w(rows.filter(r => r.samePeople >= 0.8)).toFixed(0) }));
if (0) for (const r of rows.slice(0, 25)) console.log(`  ${r.place}: ${r.meanPeople} people, same persons ${r.samePeople}, same act mix ${r.sameActMix}`);
