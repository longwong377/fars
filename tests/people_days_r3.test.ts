// Phase 5 shadow review round 3 (REVIEWS/shadow_phase5_r3.md, D-135 ... D-139): the sampler, the leader of ten's rounds,
// the guard fed at his post, the small child at bedtime, nursing at the well, the bread and the water, the boys' training,
// the travellers' departures, fuel and the fire.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { Seg, segAt, GUARD_POSTS } from '../src/people/population';
import { WeatherSystem } from '../src/weather/weatherState';
import { presentDay } from '../tools/shadow_pick';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
let sim: PeopleSim; let P: any;
beforeAll(() => { sim = new PeopleSim(1, new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8'))), env); P = (sim as any).pop; });

describe('the sampler and the dead (S1, D-135)', () => {
  it('a shadowed day is a day the person is alive and here; a dead man\'s day says so', () => {
    const dead = P.persons.find((p: any) => p.agent >= 0 && p.dies < 300 && p.dies > 20); expect(dead).toBeTruthy();
    let k = 0; const draws = [dead.dies + 5, dead.dies + 12, dead.dies - 3]; const d = presentDay(P, dead.id, () => draws[k++ % draws.length]);
    expect(d).toBe(dead.dies - 3); expect(P.present(dead.id, d)).toBe(true);
    expect(presentDay(P, dead.id, () => dead.dies + 1, 5)).toBe(-1);
    expect(P.plan(dead.id, dead.dies + 5)[0].why).toBe(`died on day ${dead.dies + 1}`);
  });
});

describe('the guards (S2, S3; D-136)', () => {
  it('a leader of ten goes round his posts at intervals, with time at the hearth between; each round runs its own way', () => {
    const leaders = P.persons.filter((p: any) => p.job === 'guard' && p.rank === 1).map((p: any) => p.id);
    let watches = 0;
    for (const pid of leaders.slice(0, 6)) for (const d of [40, 41, 42, 43, 44, 140]) { const me = P.rota(d).get(pid); if (!me || me.watch === 2) continue; watches++;
      const segs: Seg[] = P.plan(pid, d); const w0 = [6, 14][me.watch]; const rounds = segs.filter(s => s.act === 'patrol' && s.t0 >= w0 - 0.01 && s.t1 <= w0 + 8.01);
      expect(rounds.length, `${pid} d${d}`).toBeGreaterThanOrEqual(3); for (const r of rounds) expect(r.t1 - r.t0).toBeLessThanOrEqual(1.0);
      const between = segs.filter(s => s.t0 >= w0 && s.t1 <= w0 + 8 && /hearth/.test(s.place)).reduce((a, s) => a + s.t1 - s.t0, 0); expect(between, `${pid} d${d}`).toBeGreaterThan(2.5); }
    expect(watches).toBeGreaterThan(8);
    // in the sim: a leader's rounds are not one fixed order
    for (const a of sim.agents) a.lod = 'abstract';
    const L = sim.agents.find(a => a.role === 'guard' && P.persons[a.pid].rank === 1 && P.rota(248).get(a.pid)?.watch === 1)!; expect(L).toBeTruthy();
    sim.jumpTo(248 * 24 + 13.9); const orders: string[][] = []; let cur: string[] = []; let lastKey = ''; let lastTask = L.task;
    while (sim.t < 248 * 24 + 22) { sim.step(20); if (L.task !== lastTask) { lastTask = L.task; if (L.task?.act === 'patrol') { if (L.roundKey !== lastKey) { if (cur.length) orders.push(cur); cur = []; lastKey = L.roundKey!; } cur.push(L.task.place); } } }
    if (cur.length) orders.push(cur);
    expect(orders.length).toBeGreaterThanOrEqual(3); expect(new Set(orders.map(o => o.join(','))).size).toBeGreaterThan(1);
    for (const o of orders) expect(o.length).toBeLessThan(GUARD_POSTS.length);
  }, 180_000);
  it('a guard whose plan feeds him at his post eats there in the sim (no relief waited for)', () => {
    for (const a of sim.agents) a.lod = 'abstract';
    let checked = 0;
    for (let d = 170; d < 200 && checked < 2; d++) for (const a of sim.agents) { if (a.role !== 'guard') continue;
      const s = (P.plan(a.pid, d) as Seg[]).find(x => x.act === 'eat' && /at the post/.test(x.why)); if (!s) continue;
      sim.jumpTo(d * 24 + s.t0 - 0.5); while (sim.t < d * 24 + (s.t0 + s.t1) / 2) sim.step(20);
      expect(a.task?.act, `${a.id} d${d}`).toBe('eat'); expect(a.task?.place).toBe(s.place); checked++; break; }
    expect(checked).toBeGreaterThan(0);
  }, 180_000);
});

describe('small children, nursing and water (S4, S5; D-137)', () => {
  it('a small child never changes place without a walk (or being carried)', () => {
    for (let pid = 0; pid < P.persons.length; pid += 4) { const p = P.persons[pid]; if (p.job !== 'child' || p.age > 4 || p.age === 0) continue;
      for (const d of [55, 150, 250]) { if (!P.present(pid, d)) continue; const segs: Seg[] = P.plan(pid, d);
        for (let i = 1; i < segs.length; i++) { const a = segs[i - 1], b = segs[i]; if (a.where === 'road' || b.where === 'road' || a.place === b.place) continue;
          if (a.where === 'terrace' && b.where === 'terrace') continue; // the Terrace's own places (walked by the sim)
          expect(`${pid} d${d} ${a.place} → ${b.place} at ${b.t0.toFixed(2)}: ${b.why}`).toBe('a walk between'); } } }
  }, 120_000);
  it('water carried home was drawn; a feed never takes the place of drawing it', () => {
    for (let pid = 0; pid < P.persons.length; pid += 9) for (const d of [40, 140, 240, 340]) { if (!P.present(pid, d)) continue; const segs: Seg[] = P.plan(pid, d);
      for (let i = 1; i < segs.length; i++) if (segs[i].act === 'carry_jar_head' && segs[i].with === undefined) expect(segs[i - 1].act, `${pid} d${d} ${segs[i - 1].why}`).toBe('draw_water'); }
  }, 120_000);
});

describe('the bread and the water of the house (S6, S7; D-137)', () => {
  it('bread carried out is eaten out there; "the new bread" is baked before breakfast; the house has its water', () => {
    let noWater = 0, days = 0;
    for (let h = 0; h < P.households.length; h += 7) { const H = P.households[h]; if (H.zone !== 'town' && H.zone !== 'plain') continue;
      for (const d of [45, 97, 200, 300]) { const mem: number[] = P.membersOn(h, d); if (!mem.length) continue; days++; const hd = P.hday(h, d);
        const plans = new Map(mem.map(x => [x, P.plan(x, d) as Seg[]]));
        if (!mem.some(x => plans.get(x)!.some(s => s.act === 'draw_water')) && hd.waterer >= 0) noWater++;
        for (const x of mem) { const segs = plans.get(x)!;
          if (segs.some(s => /the new bread/.test(s.why))) { expect(hd.bakeAM, `hh ${h} d${d}`).toBe(true); expect((P.plan(hd.baker, d) as Seg[]).some(s => s.act === 'bake' && s.t1 <= hd.breakfast + 0.05), `hh ${h} d${d} baker ${hd.baker}`).toBe(true); }
          for (let i = 0; i < segs.length; i++) if (/bread and water/.test(segs[i].carry ?? '')) { let eaten = false; for (let j = i + 1; j < segs.length && segs[j].place !== H.home; j++) if (segs[j].act === 'eat') eaten = true; expect(eaten, `${x} d${d}`).toBe(true); } } } }
    expect(noWater / days).toBeLessThan(0.01);
  }, 180_000);
  it('the fire is lit at dusk; in the cold the men of the plain gather fuel', () => {
    let fires = 0, houses = 0, fuel = 0;
    for (let h = 0; h < P.households.length; h += 11) { const H = P.households[h]; if (H.zone !== 'plain' && H.zone !== 'town') continue; const d = 280; const mem: number[] = P.membersOn(h, d); if (!mem.length) continue; houses++;
      if (mem.some(x => (P.plan(x, d) as Seg[]).some(s => s.act === 'cook'))) fires++;
      if (H.zone === 'plain' && mem.some(x => P.persons[x].sex === 'm' && P.persons[x].age >= 14 && (P.plan(x, d) as Seg[]).some(s => s.act === 'gather'))) fuel++; }
    expect(fires / houses).toBeGreaterThan(0.7); expect(fuel).toBeGreaterThan(10);
  }, 120_000);
});

describe('riding and the bow; the travellers (S8, S9; D-138)', () => {
  it('only the boys of households of standing train, and Q-146 records why', () => {
    let trained = 0;
    for (let pid = 0; pid < P.persons.length; pid += 3) { const p = P.persons[pid]; if (p.job !== 'child' || p.sex !== 'm' || p.age < 6) continue;
      for (const d of [30, 130, 230]) { if (!P.present(pid, d)) continue; if ((P.plan(pid, d) as Seg[]).some(s => s.act === 'train')) { trained++; expect(P.standing(P.home(pid, d), d), `${pid} d${d}`).toBe(true); } } }
    expect(trained).toBeGreaterThan(0);
    const oq = readFileSync('research/OPEN_QUESTIONS.md', 'utf8'); expect(oq).toMatch(/\| Q-146 \|.*HDT 1\.136.*XEN-CYR 1\.2\.15/);
  }, 120_000);
  it('parties leave on their own hours: loading and the road out vary from party to party', () => {
    const loads = new Set<number>(), roads = new Set<number>();
    for (const p of P.persons) { if (p.job !== 'traveller' || p.leave >= 354 || p.leave <= p.arrive) continue; const segs: Seg[] = P.plan(p.id, p.leave);
      const l = segs.find(s => /loading/.test(s.why)), r = segs.find(s => /out of the plain/.test(s.why)); if (!l || !r) continue;
      loads.add(Math.round((l.t1 - l.t0) * 60)); roads.add(Math.round((r.t1 - r.t0) * 60)); if (loads.size > 8 && roads.size > 8) break; }
    expect(loads.size).toBeGreaterThan(5); expect(roads.size).toBeGreaterThan(5);
  }, 120_000);
});
