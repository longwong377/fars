// s14 visible (D-359; UD-07, UD-08, UD-26): is what the simulation does visible? A node count over a seeded week of the full
// sim (economy, talk, washing, relations on, as the world runs it): every stretch the economy (D-340), the washing (D-347),
// the relations (D-348) and the weddings lay into a day plan is checked for
//   PERFORMANCE: the activity's performance as the crowd resolves it (activities.ts performanceFor, by the stretch's words and
//     the performer) is no placeholder and fits the context: a performance whose base form belongs to another place (the
//     column-drum haul, the palaces' sweeping) does not count when the words say something else;
//   PLACE: the place resolves in the built world (popgeo.ts PopGeo.spot, the town plan, the villages, the canals) AND it is
//     the place the words mean: a lane, well or water of another house's quarter resolved at the person's own door does not
//     count (the old exchange lane did exactly that: every buyer stood outside their own house);
//   PROPS: words that name goods carried, brought, bought or handed over (barley, fuel, a jar, the pledge, the washing, the
//     dowry, silver weighed, a stall's wares) are drawn: the performance puts a prop in the hands, a work object at the place
//     or the animals by the person.
// How this could pass while the intent fails (clause 1): a performance that exists but is the wrong one (counted by the
// context rule above); a place that resolves but somewhere else (the semantic rule); props on the walk but nothing at the
// stall; a market where the buyer and the seller never meet (the deal pairs are checked to overlap in time at one place).
// Out of world, English. Run: npx tsx tools/dev/visible_week.ts [seed=1] [day0=150] [days=7] [hhStride=6]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { performanceFor, type ActivityId } from '../../src/people/activities';
import type { Seg } from '../../src/people/population';
import { PopGeo } from '../../src/people/popgeo';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';

export type Klass = 'economy' | 'washing' | 'relations' | 'wedding';
/** base performances that belong to one context: counted only when a variant matched the words */
const BOUND = new Set<ActivityId>(['haul', 'clean', 'carry_bread']);
/** words that name goods in the hands or at the place */
const GOODS = /^(carrying|bringing|selling|haggling|exchanging|washing|leading the new ox|driving the ewes)|handing over|weighed|bread and water brought|the dowry/;
export function classOf(s: Seg, d: number, wed: boolean): Klass | null {
  if (s.ev?.startsWith('D-340')) return 'economy';
  if (s.ev === 'D-347') return 'washing';
  if (s.ev?.startsWith('D-348') || s.ev?.startsWith('D-359 relations')) return 'relations';
  if (wed && /wedding|bride|procession|dowry|feast|the new house/.test(s.why)) return 'wedding';
  void d; return null;
}
export interface Judged { klass: Klass; act: string; why: string; place: string; perf: boolean; place_ok: boolean; props: boolean; note: string }
export function judge(geo: PopGeo | null, S: PeopleSim, pid: number, d: number, s: Seg, klass: Klass): Judged {
  const P = S.pop, p = P.persons[pid], who = { sex: p.sex, age: P.ageOn(pid, d) };
  const pf = performanceFor(s.act, s.why, pid, undefined, who);
  const perf = !pf.placeholder && !pf.abstractOnly && !(BOUND.has(s.act) && pf.variant < 0);
  let placeOk = true, note = '';
  if (s.where !== 'road' && !s.place.startsWith('road:')) {
    const parts = s.place.split(':'), head = parts[0], q = parts[1], host = parts[2];
    const own = P.households[P.home(pid, d)];
    // a lane, well or water named for a quarter is resolved at the person's own house (popgeo.ts): it is the named place only
    // in the person's own quarter, or with the house it belongs to named (lane:<q>:<hid>, D-359)
    if ((head === 'lane' || head === 'well' || head === 'canal') && q !== own?.q && host === undefined) { placeOk = false; note = `${head} of ${q} resolved at the own door (${own?.q})`; }
    if (placeOk && geo) { const sp = geo.spot(pid, s.place, s.act, d, (s.t0 + s.t1) / 2); if (!sp.ok) { placeOk = false; note = sp.what; } }
  }
  const props = !GOODS.test(s.why) || !!(pf.prop || pf.prop2 || pf.work?.length || pf.animals);
  return { klass, act: s.act, why: s.why, place: s.place, perf, place_ok: placeOk, props, note };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/dev/visible_week.ts')) {
  const seed = +(process.argv[2] ?? 1), d0 = +(process.argv[3] ?? 150), nd = +(process.argv[4] ?? 7), stride = +(process.argv[5] ?? 6);
  const t0 = performance.now();
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const W = new WeatherSystem(seed), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  const S = new PeopleSim(seed, nav, env, { bonds: true });
  const terrain = loadTerrain(), rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, seed), villages = placeVillages(terrain, rivers.rivers, canals, seed);
  const geo = new PopGeo({ pop: S.pop, nav, town: buildTownPlan(), ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, seed), canals: canals.map(c => c.pts), seed });
  console.log(`built in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  const P = S.pop, rows: Judged[] = []; const tally: Record<string, [number, number, number, number, number]> = {}; // n, perf, place, props, all
  const bad = new Map<string, number>(); let deals = 0, met = 0, garments = 0, persons = 0, wedMoves = 0, wedFeasts = 0, wedHouses = 0;
  for (let d = d0; d < d0 + nd; d++) {
    S.t = d * 24; S.econTo(d + 1);
    const who = new Set<number>(S.econPlans.steps(d).keys());
    for (const H of P.households) if ((H.zone === 'town' || H.zone === 'plain') && H.id % stride === 0) { const w = S.washPlans.washerOf(H.id, d); if (w >= 0) who.add(w); for (const m of P.membersOn(H.id, d)) if (S.washPlans.touches(m, d)) who.add(m); }
    for (const pid of S.bondPlans.lays(d).keys()) who.add(pid);
    const weds = P.weddingsOn(d); for (const w of weds) for (const h of [w.from, w.to]) for (const m of P.membersOn(h, d)) who.add(m);
    for (const pid of who) {
      const plan = P.plan(pid, d), wed = !!P.weddingOf(pid, d);
      for (const s of plan) { const k = classOf(s, d, wed); if (!k) continue; const j = judge(geo, S, pid, d, s, k); rows.push(j);
        const t = tally[k] ?? (tally[k] = [0, 0, 0, 0, 0]); t[0]++; if (j.perf) t[1]++; if (j.place_ok) t[2]++; if (j.props) t[3]++; if (j.perf && j.place_ok && j.props) t[4]++;
        if (!(j.perf && j.place_ok && j.props)) { const key = `${k} ${!j.perf ? 'PERF' : ''}${!j.place_ok ? 'PLACE' : ''}${!j.props ? 'PROPS' : ''} ${j.act} | ${j.why.slice(0, 70)} | ${j.note.slice(0, 60)}`; bad.set(key, (bad.get(key) ?? 0) + 1); } }
      // the day's garment (wardrobe export for the render)
      const g = S.wardrobes.garmentsOn(pid, d); persons++; if (g && g.body) garments++;
    }
    // the deals: buyer and seller at one stall at one time
    for (const [pid, steps] of S.econPlans.steps(d)) for (const st of steps) if (st.kind === 'haggle_buy') { deals++; const pl = P.plan(pid, d), mine = pl.find(s => s.ev?.includes(`(event ${st.ev};`) && s.act === 'exchange'); const sel = st.with; if (!mine || sel === undefined) continue;
      const theirs = P.plan(sel, d).find(s => s.act === 'exchange' && s.place === mine.place && s.t0 <= mine.t0 + 1e-6 && s.t1 >= mine.t1 - 1e-6); if (theirs) met++; }
    // the weddings of the relations layer: the bride moved, the procession and the feast in both houses' plans
    for (const w of weds) { if (!P.relWed.has(w.bride)) continue; wedHouses++; if (P.home(w.bride, d) === w.to) wedMoves++;
      const proc = P.plan(w.bride, d).some(s => /procession|dowry/.test(s.why)), feast = P.membersOn(w.to, d).some(m => P.plan(m, d).some(s => /feast/.test(s.why))); if (proc && feast) wedFeasts++; }
  }
  const pct = (a: number, b: number) => b ? (100 * a / b).toFixed(1) : '-';
  const out: Record<string, unknown> = { seed, days: [d0, d0 + nd - 1], hhStride: stride };
  for (const [k, t] of Object.entries(tally)) { console.log(`${k.padEnd(10)} ${String(t[0]).padStart(6)} stretches: performance ${pct(t[1], t[0])} %, place ${pct(t[2], t[0])} %, props ${pct(t[3], t[0])} %, all three ${pct(t[4], t[0])} %`); out[k] = { n: t[0], perf: t[1], place: t[2], props: t[3], all: t[4] }; }
  const T = Object.values(tally).reduce((a, t) => a.map((x, i) => x + t[i]) as typeof t, [0, 0, 0, 0, 0]);
  console.log(`ALL        ${String(T[0]).padStart(6)} stretches: all three ${pct(T[4], T[0])} %`); out.all = { n: T[0], all: T[4], share: T[0] ? T[4] / T[0] : 0 };
  console.log(`deals laid as haggles at a stall: ${deals}, buyer and seller together there: ${met}`); out.deals = { n: deals, met };
  console.log(`relations weddings in the week: ${wedHouses}, bride moved: ${wedMoves}, procession and feast laid: ${wedFeasts}`); out.weddings = { n: wedHouses, moved: wedMoves, feast: wedFeasts };
  console.log(`garment exported for ${garments} of ${persons} person-days`); out.garments = { n: persons, with: garments };
  console.log('\nnot all three (top 30):'); for (const [k, c] of [...bad].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${String(c).padStart(5)} ${k}`);
  mkdirSync('bench-reports', { recursive: true }); writeFileSync(`bench-reports/visible_week_s${seed}.json`, JSON.stringify(out, null, 1) + '\n');
  console.log(`\n${((performance.now() - t0) / 1000).toFixed(0)} s`);
}
