// Phase 5 shadow review round 2 (REVIEWS/shadow_phase5_r2.md, D-082 ... D-087): children's work, the bereaved household,
// the harvest calendar, variety from real causes, the weather, reasons, and what people carry.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env, ABSTRACT_DETOUR } from '../src/people/sim';
import { Seg } from '../src/people/population';
import { WeatherSystem } from '../src/weather/weatherState';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
let sim: PeopleSim; let P: any;
beforeAll(() => { sim = new PeopleSim(1, new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8'))), env); P = (sim as any).pop; });
const WORK = /^(grind|knead|bake|draw_water|carry_jar|carry_jar_head|carry_sack|carry_bread|herd|field_work|dig_canal|spin|weave|gather|tend_animals|reap|thresh|pick_fruit|wash|craft)$/;
const isWork = (s: Seg) => WORK.test(s.act) || /^minding|gleaning|scaring/.test(s.why) || /birds off/.test(s.why);

describe('children (N1, D-082)', () => {
  it('girls of 9-13 do the work of their age: hours of work a day, play in spells, home by dusk; the waking hour moves with the season', () => {
    const wakeMed: number[] = [];
    for (const d of [45, 183, 305]) {
      let n = 0, work = 0, play = 0; const wakes: number[] = []; const sun = P.cal.ctx(d).sun;
      for (let pid = 0; pid < P.persons.length; pid += 5) { const p = P.persons[pid]; if (p.sex !== 'f' || P.ageOn(pid, d) < 9 || P.ageOn(pid, d) > 13 || (p.zone !== 'town' && p.zone !== 'plain') || !P.present(pid, d) || P.sick(pid, d) || P.mourning(pid, d)) continue;
        const segs: Seg[] = P.plan(pid, d); n++; const home = P.households[P.home(pid, d)].home;
        for (const s of segs) { const h = s.t1 - s.t0; if (isWork(s)) work += h; else if (s.act === 'play') play += h; }
        wakes.push(segs.find(s => s.act !== 'sleep' && s.t0 > 2)!.t0);
        // home by dusk: nothing away from home (other than on the way) ends after sunset + 0.4 h unless with a grown-up of the house
        for (const s of segs) if (s.t1 > sun.set + 0.4 && s.t0 > 15 && s.place !== home && s.where !== 'road' && s.with === undefined && !/birthday|kinsman|visiting|mourning|wedding/.test(s.why)) expect(`${pid} d${d} ${s.act} @ ${s.place} ${s.why} till ${s.t1.toFixed(2)}`).toBe('');
        // no single spell of play away from home longer than 2.5 h
        for (const s of segs) if (s.act === 'play' && s.place !== home && !/little ones|minding/.test(s.why)) expect(s.t1 - s.t0, `${pid} d${d} ${s.why}`).toBeLessThan(2.5);
      }
      expect(n).toBeGreaterThan(100);
      expect(work / n, `day ${d}: work`).toBeGreaterThan(3); expect(play / n, `day ${d}: play`).toBeLessThan(5);
      wakes.sort((a, b) => a - b); wakeMed.push(wakes[wakes.length >> 1]);
      expect(wakes[Math.floor(wakes.length * 0.9)] - wakes[Math.floor(wakes.length * 0.1)], `day ${d}: wake spread`).toBeGreaterThan(0.5);
    }
    expect(Math.max(...wakeMed) - Math.min(...wakeMed)).toBeGreaterThan(1);
  }, 120_000);
  it('the house has its child-minder, a son out with the men and a child who carries the bread out; nine-year-olds go to the harvest', () => {
    let minders = 0, helpers = 0, bringers = 0, harvest = 0;
    for (let h = 0; h < P.households.length; h += 3) { const H = P.households[h]; if (H.zone !== 'plain') continue;
      for (const d of [45, 200]) { const hd = P.hday(h, d); if (hd.minder >= 0) minders++; if (hd.fieldHelper >= 0) helpers++; if (hd.bringer >= 0) bringers++;
        if (d === 45 && hd.task?.all) for (const x of P.membersOn(h, d)) { const q = P.persons[x]; if (q.age < 9 || q.age > 13 || x === hd.minder || P.sick(x, d) || P.mourning(x, d) || q.agent >= 0) continue;
          if (P.plan(x, d).some((s: Seg) => s.place === hd.task.place && s.act !== 'walk')) harvest++; else expect(`${x}`).toBe('at the harvest'); } } }
    expect(minders).toBeGreaterThan(100); expect(helpers).toBeGreaterThan(20); expect(bringers).toBeGreaterThan(20); expect(harvest).toBeGreaterThan(50);
  }, 120_000);
});

describe('the bereaved household (N2, D-083)', () => {
  it('a motherless nursling goes to a wet nurse; a house left with no woman is kept by a kinswoman, the grandmother or the eldest daughter; no man is called "the mother"', () => {
    let nursed = 0, kept = 0;
    for (const p of P.persons) { if (p.moved === 'nursed') { nursed++; const N = P.persons[p.nurse];
        expect(N.sex).toBe('f'); expect(P.childrenOf(p.nurse).some((k: number) => P.persons[k].age === 0)).toBe(true);
        const d = Math.min(353, p.marry + 3); if (!P.present(p.id, d) || !P.present(p.nurse, d) || P.sick(p.id, d) || P.ageOn(p.id, d) >= 2) continue; // (weaned at two, on its age on the day: D-175)
        const segs: Seg[] = P.plan(p.id, d); expect(segs.filter(s => /nursed/.test(s.why)).length, `${p.id}`).toBeGreaterThanOrEqual(P.ageOn(p.id, d) === 0 ? 4 : 2); // a child of one nurses less often (its age on the day: D-175)
        expect(P.plan(p.nurse, d).some((s: Seg) => /wet-nurses/.test(s.why))).toBe(true); } }
    for (const H of P.households) { if (H.keeper === undefined) continue; kept++;
      const d = Math.min(353, H.keeperFrom + 4); if (!P.present(H.keeper, d) || P.sick(H.keeper, d) || P.mourning(H.keeper, d)) continue;
      expect(P.hday(H.id, d).women[0]).toBe(H.keeper); expect(P.plan(H.keeper, d).some((s: Seg) => s.act === 'grind'), `keeper ${H.keeper}`).toBe(true); }
    expect(nursed).toBeGreaterThan(10); expect(kept).toBeGreaterThan(10);
    // small children minded by a man: never "the mother"
    for (let pid = 0; pid < P.persons.length; pid += 3) { const p = P.persons[pid]; if (p.job !== 'child' || p.age > 4) continue;
      for (const d of [100, 250]) { if (!P.present(pid, d)) continue; for (const s of P.plan(pid, d) as Seg[]) if (s.with !== undefined && P.persons[s.with].sex === 'm') expect(s.why, `${pid} d${d}`).not.toMatch(/(beside|by|near|with|in) the mother\b|the mother’s/); } }
  }, 120_000);
  it('twins are named only for twins', () => {
    for (let pid = 0; pid < P.persons.length; pid += 2) { const p = P.persons[pid]; if (p.sex !== 'f' || p.age < 16 || p.age > 45) continue;
      for (const s of P.plan(pid, 120) as Seg[]) if (/twins/.test(s.why)) { const kids = P.nurslings(pid, 120).filter((c: number) => P.persons[c].age === 0); expect(kids.length).toBe(2); expect(P.persons[kids[0]].twin).toBe(kids[1]); } }
  }, 60_000);
});

describe('the harvest calendar and the weather (N3, N6; D-084, D-086)', () => {
  it('no reaping before mid-May (day 33) or threshing before day 43; no weeding while the ploughing and sowing go on', () => {
    for (const d of [5, 20, 32]) { const C = P.cal.ctx(d); expect([...C.agri]).not.toContain('E-41'); expect([...C.agri]).not.toContain('E-43'); }
    expect([...P.cal.ctx(40).agri]).toContain('E-41'); expect([...P.cal.ctx(80).agri]).toContain('E-42'); expect([...P.cal.ctx(120).agri]).toContain('E-43');
    for (let pid = 0; pid < P.persons.length; pid += 11) { if (P.persons[pid].zone !== 'plain') continue;
      for (const d of [20, 200, 215]) { if (!P.present(pid, d)) continue; for (const s of P.plan(pid, d) as Seg[]) { expect(s.act).not.toBe('reap'); expect(s.act).not.toBe('thresh'); if (d >= 200) expect(s.why).not.toMatch(/weeding/); } } }
  }, 60_000);
  it('winnowing only in a wind; the midday heat rest follows the day\'s temperature in any month', () => {
    let calm = 0, windy = 0;
    for (let d = 43; d <= 141; d += 3) { const C = P.cal.ctx(d); if (!C.agri.has('E-43')) continue;
      for (let h = 0; h < P.households.length; h += 7) { const T = P.hday(h, d).task; if (!T || T.kind !== 'thresh') continue;
        if (/winnowing/.test(T.why)) { windy++; expect(C.wx.windAM).toBeGreaterThanOrEqual(1.8); } else calm++;
        if (T.pm && /winnowing/.test(T.pmWhy)) expect(C.wx.windPM).toBeGreaterThanOrEqual(1.8); } }
    expect(calm).toBeGreaterThan(0); expect(windy).toBeGreaterThan(0);
    for (let d = 0; d < 354; d++) { const C = P.cal.ctx(d); expect(C.heatRest).toBe(C.wx.tmax > 33); }
  }, 60_000);
});

describe('reasons, variety and what is carried (N4, N5, N7, N8; D-085, D-087)', () => {
  it('reasons carry no evidence codes (they are in ev); no standing "walk"; kneading and the guards\' hours vary', () => {
    const knead = new Set<number>(); const guardWake = new Map<number, Set<number>>();
    for (let pid = 0; pid < P.persons.length; pid += 13) for (const d of [60, 250]) { if (!P.present(pid, d)) continue;
      for (const s of P.plan(pid, d) as Seg[]) { expect(s.why, `${pid} d${d}`).not.toMatch(/\((E|CE|W)-\d+\)/); if (s.act === 'walk' && s.where !== 'road') expect(s.t1 - s.t0, `${pid} ${s.why}`).toBeLessThan(0.3);
        if (s.act === 'knead') knead.add(Math.round((s.t1 - s.t0) * 60)); } }
    expect(knead.size).toBeGreaterThan(6);
    for (const p of P.persons) { if (p.job !== 'guard') continue; const s = new Set<number>(); for (const d of [10, 110, 210, 310]) { const w = (P.plan(p.id, d) as Seg[]).find(x => x.act !== 'sleep' && x.t0 > 3); if (w) s.add(Math.round(w.t0 * 60)); } guardWake.set(p.id, s); }
    const distinct = [...guardWake.values()].filter(s => s.size >= 3).length; expect(distinct / guardWake.size).toBeGreaterThan(0.5);
  }, 120_000);
  it('the guards carry their arms on watch, builders their tools up to the Terrace, the station messenger his letters', () => {
    let guards = 0, builders = 0, letters = 0;
    for (const p of P.persons) { if (!P.present(p.id, 100)) continue; const segs: Seg[] = P.plan(p.id, 100);
      if (p.job === 'guard') for (const s of segs) if (s.act === 'stand_guard') { expect(s.carry).toMatch(/spear/); guards++; }
      if (p.job === 'builder' && segs.some(s => s.where === 'terrace')) { if (segs.some(s => s.where === 'road' && !!s.carry)) builders++; else expect(`${p.id}`).toBe('carries tools'); }
      if (p.job === 'messenger') for (const s of segs) if (/letter/.test(s.why) && s.where === 'road') { expect(s.carry).toBe('a sealed letter'); letters++; } }
    expect(guards).toBeGreaterThan(50); expect(builders).toBeGreaterThan(50);
  }, 60_000);
  it('in the abstract LOD a patrol leg takes the time the distance needs at walking pace', () => {
    for (const a of sim.agents) a.lod = 'abstract';
    const g = sim.agents.find(a => a.role === 'guard' && P.plan(a.pid, 233).some((s: Seg) => s.act === 'patrol' && s.t0 >= 21.9))!; expect(g).toBeTruthy();
    sim.jumpTo(233 * 24 + 21.9); let legs = 0; let last = g.task; let t0 = sim.t; let from: [number, number] = [...g.pos] as [number, number];
    for (let k = 0; k < 90 * 6; k++) { sim.step(10);
      if (g.task !== last) { if (last?.act === 'patrol') { const dist = Math.hypot(last.spot[0] - from[0], last.spot[1] - from[1]); const hrs = sim.t - t0;
          expect(hrs * 3600 + 11, `leg of ${dist.toFixed(0)} m`).toBeGreaterThanOrEqual(dist * ABSTRACT_DETOUR / g.speed); legs++; }
        last = g.task; t0 = sim.t; from = [...g.pos] as [number, number]; } }
    expect(legs).toBeGreaterThan(5);
  }, 120_000);
});
