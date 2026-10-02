// D-349: after the brides' redraw moved person ids, find the people who show what the pinned tests of people_days_r6 were
// written to show (the same property, on the new ids). Run: npx tsx tools/dev/repin_find.ts
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { MINDING } from '../../src/people/planCheck';
import type { Seg } from '../../src/people/population';
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim = new PeopleSim(1, nav, env); const P: any = (sim as any).pop;
const res = (pid: number, d: number) => P.present(pid, d) && ['town', 'plain'].includes(P.households[P.home(pid, d)].zone);
const out: Record<string, unknown[]> = { karkissa: [], ratukka: [], b1906: [], maza343: [], utira238: [] };
const infantLike = (segs: Seg[]) => !segs.some(s => s.act === 'play' || s.act === 'walk' || (s.act === 'eat' && !/nursed|fed goat|softened bread from the/.test(s.why)));
for (let pid = 0; pid < P.persons.length; pid++) {
  const p = P.persons[pid];
  if (out.karkissa.length < 3 && res(pid, 291) && P.households[P.home(pid, 291)].zone === 'plain') { const s: Seg[] = P.plan(pid, 291); if (!s.some(x => x.place.startsWith('field:')) && !s.some(x => x.act === 'shelter') && s.some(x => /kept in by the rain/.test(x.why))) out.karkissa.push([pid, p.name, p.job]); }
  if (out.ratukka.length < 3 && res(pid, 147) && P.ageOn(pid, 147) === 1) { const g: Seg[] = P.plan(pid, 147); if (!infantLike(g) && g.filter(s => s.act === 'eat' && /a meal with the household/.test(s.why)).length >= 2 && g.filter(s => /^nursed by/.test(s.why)).length <= 4 && g.some(s => /recovering from an illness/.test(s.why))) out.ratukka.push([pid, p.name, p.sex, p.mother]); }
  if (out.b1906.length < 3 && pid > 1000 && res(pid, 232) && P.ageOn(pid, 232) === 8 && pid % 97 === 0) { const b: Seg[] = P.plan(pid, 232); if (!b.some(s => s.place.startsWith('ws:')) && b.filter(s => s.with !== undefined).length === 0) out.b1906.push([pid, p.name]); }
  for (const [k, d] of [['maza343', 343], ['utira238', 238]] as const) { if (out[k].length >= 3 || !res(pid, d) || P.ageOn(pid, d) < 6) continue; const segs: Seg[] = P.plan(pid, d); const m = segs.filter(s => MINDING.test(s.why)); if (!m.length) continue;
    const kid = P.membersOn(P.home(pid, d), d).find((x: number) => P.ageOn(x, d) <= 4); if (kid === undefined) continue; let ok = true;
    for (const s of m) for (const t of [s.t0 + 0.005, (s.t0 + s.t1) / 2, s.t1 - 0.005]) { const g = segAt(P.plan(kid, d), t); if (g.with !== pid || g.place !== s.place) ok = false; }
    if (ok) out[k].push([pid, p.name, P.ageOn(pid, d), p.sex]); }
  if (Object.values(out).every(v => v.length >= 3)) break;
}
function segAt(segs: Seg[], t: number) { return segs.find(s => s.t0 <= t && s.t1 > t) ?? segs[segs.length - 1]; }
console.log(JSON.stringify(out));
for (const [pid] of out.ratukka as [number][]) console.log(pid, 'mother', P.persons[pid].mother, P.membersOn(P.home(pid, 147), 147).map((x: number) => `${x} ${P.persons[x].job} ${P.persons[x].sex}${P.ageOn(x, 147)} sick ${P.sick(x, 147)}`).join('; '));
