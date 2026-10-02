// D-349: why a betrothal's negotiation is or is not laid into the plans (seed 1, the year): per event, the stage that fails.
// Run: npx tsx tools/dev/negotiate_trace.ts
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { PLAYER } from '../../src/people/relations/world';
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const S = new PeopleSim(1, nav, env, { bonds: true }); const P = S.pop, R = S.bonds, RP = S.bondPlans as any;
R.advance(353); const why: Record<string, number> = {}; const n = (k: string) => { why[k] = (why[k] ?? 0) + 1; };
let shown = 0;
for (const e of R.events) { if (e.kind !== 'betroth' || e.a === PLAYER) continue; const d = e.day;
  const L = RP.lays(d).get(e.a)?.find((l: any) => l.meet.kind === 'negotiate'); if (L) { n('laid'); continue; }
  const m = (R.meets.get(d) ?? []).find((x: any) => x.kind === 'negotiate' && x.a === e.a); if (!m) { n('no meet'); continue; }
  const x = RP.index(d); if (x.first.get(m.a) !== m) { n('groom has another meeting first'); continue; } if (x.first.get(m.b) !== m) { n('bride has another meeting first'); continue; }
  const hh = P.home(m.b, d), H = P.households[hh]; if (!H || (H.zone !== 'town' && H.zone !== 'plain')) { n(`bride's house zone ${H?.zone}`); continue; }
  const bb = P.basePlan(m.b, d), home = H.home; const freeHome = bb.filter((s: any) => s.place === home && ['rest', 'talk', 'play', 'gamble', 'tend_body', 'queue', 'exchange', 'spin'].includes(s.act) && s.t1 - s.t0 >= 1.5);
  if (shown++ < 6) console.log(d, 'groom', m.a, P.persons[m.a].sex, P.ageOn(m.a, d), 'bride', m.b, P.persons[m.b].sex, P.ageOn(m.b, d), 'hh', hh, H.zone, 'base', bb.map((s: any) => `${s.t0.toFixed(1)}-${s.t1.toFixed(1)} ${s.act} ${s.place === home ? 'HOME' : s.place} [${s.why}]`).join(' | '));
  if (freeHome.length && shown < 14) { shown++; for (const s of freeHome) console.log(d, `bride ${m.b} free ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} [${s.why}]; groom ${m.a}:`, P.basePlan(m.a, d).filter((g: any) => g.t1 > s.t0 - 0.5 && g.t0 < s.t1).map((g: any) => `${g.t0.toFixed(2)}-${g.t1.toFixed(2)} ${g.act} ${g.place} [${g.why}]${g.with !== undefined ? ' with ' + g.with : ''}`).join(' | ')); }
  n(freeHome.length ? 'free at home >=1.5h but not laid (host/visit)' : 'bride never free at home 1.5h'); }
console.log(why);
