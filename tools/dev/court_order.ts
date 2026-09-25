// D-221: the court's order metrics (tests/lib/court_order.ts) at the court-assembly moment and a few other court mornings,
// in node. Usage: npx tsx tools/dev/court_order.ts [day,day,...] [hour,hour,...]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { PopGeo } from '../../src/people/popgeo';
import { PopView } from '../../src/people/popview';
import { courtOrder } from '../../tests/lib/court_order';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const days = (process.argv[2] ?? '30,31,33,40').split(',').map(Number), hours = (process.argv[3] ?? '9,10,11').split(',').map(Number);
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const sim = new PeopleSim(1, nav, env, { court: true });
const geo = new PopGeo({ pop: sim.pop, nav, town: buildTownPlan(), seed: 1 });
const view = new PopView(sim, geo, 1);
const tot = { g: 0, go: 0, w: 0, wn: 0, fn: 0, fc: 0, f30: 0 };
for (const d of days) for (const h of hours) {
  const t = d * 24 + h; sim.jumpTo(t); view.settle(t, [10, 40]);
  const K = sim.pop.court!, aud = K.audienceDay(d);
  const m = courtOrder(view, [10, 20], 140);
  console.log(`day ${d} ${h}:00${aud ? ' (audience)' : ''}: guards ${m.guardsOrdered}/${m.guards} ordered (${(100 * m.guardShare).toFixed(1)} %, median spacing ${m.guardSpacingMedian.toFixed(2)} m); parties ${m.parties}, members within 3 m of centroid ${m.partyNear}/${m.waiting} (${(100 * m.partyShare).toFixed(1)} %); focus n ${m.focusN} mean cos ${m.focusCos.toFixed(3)}, within 30° ${(100 * m.focus30).toFixed(1)} %`);
  tot.g += m.guards; tot.go += m.guardsOrdered; tot.w += m.waiting; tot.wn += m.partyNear; tot.fn += m.focusN; tot.fc += m.focusCos * m.focusN; tot.f30 += m.focus30 * m.focusN;
}
console.log(`ALL: guards ordered ${(100 * tot.go / tot.g).toFixed(1)} % of ${tot.g}; party cohesion ${(100 * tot.wn / Math.max(1, tot.w)).toFixed(1)} % of ${tot.w}; focus mean cos ${(tot.fc / Math.max(1, tot.fn)).toFixed(3)}, within 30° ${(100 * tot.f30 / Math.max(1, tot.fn)).toFixed(1)} % of ${tot.fn}`);
