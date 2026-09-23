// People (Phase 3): walkable grid, places, roster honesty, a simulated day, determinism, persistence, activity lint.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NavGrid, NAV } from '../src/people/navgrid';
import { PeopleSim, PLACES, Env } from '../src/people/sim';
import { ACTIVITIES } from '../src/people/activities';
import { ANIMS, pose } from '../src/people/anim';
import { propGeometry, bodyGeometry, randomAppearance, BONES } from '../src/people/body';
import { WeatherSystem } from '../src/weather/weatherState';
import { buildTerrace } from '../src/arch/terrace';
import { Rng } from '../src/core/rng';

const navMeta = JSON.parse(readFileSync('public/generated/nav.json', 'utf8'));
const loadNav = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)));
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC }; };
const dryDay = W.days.findIndex((d, i) => i > 20 && !d.wet && !W.days[i + 1].wet);
let nav: NavGrid;
beforeAll(() => { nav = loadNav(); });

function runDay(sim: PeopleSim, day: number, dt: number, onSample?: (h: number) => void) {
  sim.jumpTo(day * 24);
  let lastSample = -1;
  for (let s = 0; s < 86400; s += dt) { sim.step(dt); const h = Math.floor((sim.t - day * 24) * 4) / 4; if (h !== lastSample) { lastSample = h; onSample?.(h); } }
}

describe('walkable grid', () => {
  it('is up to date with the architecture (parts hash) — rerun `npx tsx tools/build_nav.ts` if this fails', () => {
    const hash = createHash('sha1').update(JSON.stringify(buildTerrace().parts)).digest('hex').slice(0, 16);
    expect(navMeta.partsHash).toBe(hash);
    for (const k of ['e0', 'n0', 'cell', 'w', 'h'] as const) expect(navMeta[k]).toBe(NAV[k]);
  });
  it('every place is on walkable ground (or within 2 m of it) and reachable from the town', () => {
    for (const p of Object.values(PLACES)) {
      const s = nav.snap(p.at[0], p.at[1], 2); expect(s, p.id).not.toBeNull();
      if (p.id !== 'town') expect(nav.findPath(PLACES.town.at, s!), `route town → ${p.id}`).not.toBeNull();
    }
  });
  it('the route from the plain climbs the Grand Stair and enters the Apadana through its N stair (not through walls)', () => {
    const path = nav.findPath(PLACES.town.at, PLACES.apadana_hall.at)!;
    let len = 0; for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    expect(len).toBeGreaterThan(250); expect(len).toBeLessThan(400);
    // passes over the stair lanes (x ≈ −44 or −36) and ends on the podium (+3 m)
    expect(path.some(p => p[0] > -48 && p[0] < -32 && p[1] > 90 && p[1] < 160)).toBe(true);
    expect(nav.heightAt(PLACES.apadana_hall.at[0], PLACES.apadana_hall.at[1])).toBeCloseTo(3, 1);
  });
});

describe('roster', () => {
  it('50–100 people; names are attested or honestly unnamed; every person has home, household, job, ration and ties', () => {
    const sim = new PeopleSim(1, nav, env);
    expect(sim.agents.length).toBeGreaterThanOrEqual(50); expect(sim.agents.length).toBeLessThanOrEqual(100);
    const pool = new Set((JSON.parse(readFileSync('src/data/names.json', 'utf8')).names as any[]).map(n => n.name));
    for (const a of sim.agents) {
      if (a.name) expect(pool.has(a.name), a.name).toBe(true); else expect(a.nameNote).toMatch(/unnamed/);
      expect(a.home in PLACES).toBe(true); expect(a.ration.qaPerMonth).toBeGreaterThan(0); expect(a.ties.length).toBeGreaterThan(0); expect(a.langs.length).toBeGreaterThan(0);
    }
    const names = sim.agents.filter(a => a.name).map(a => a.name); expect(new Set(names).size).toBe(names.length);
  });
});

describe('a simulated day (dry day, court absent)', () => {
  it('guards hold every post around the clock; workers keep their hours; nobody gets stuck; stocks stay bounded', () => {
    const sim = new PeopleSim(1, nav, env);
    const posts = [...new Set(sim.agents.filter(a => a.post).map(a => a.post!))];
    let samples = 0; const held: Record<string, number> = {}; const stuck: string[] = [];
    const lastMove = new Map<number, { p: [number, number]; t: number }>();
    const acts = new Set<string>(); let masonsAt10 = 0;
    runDay(sim, dryDay, 2, h => {
      samples++;
      for (const p of posts) { const at = PLACES[p].at; if (sim.agents.some(a => a.post === p && !a.walking && Math.hypot(a.pos[0] - at[0], a.pos[1] - at[1]) < 1.5 && a.task?.act === 'stand_guard')) held[p] = (held[p] ?? 0) + 1; }
      for (const a of sim.agents) {
        acts.add(sim.performance(a).act);
        const lm = lastMove.get(a.id);
        if (!lm || Math.hypot(a.pos[0] - lm.p[0], a.pos[1] - lm.p[1]) > 0.5) lastMove.set(a.id, { p: [...a.pos] as [number, number], t: sim.t });
        else if (a.walking && sim.t - lm.t > 0.25) stuck.push(`${a.id} ${a.role} at ${a.pos.map(v => v.toFixed(1))} (${a.task?.why})`);
      }
      if (h === 10) masonsAt10 = sim.agents.filter(a => a.role === 'mason' && a.task?.act === 'dress_stone' && !a.walking).length;
      expect(sim.stock.depot).toBeGreaterThanOrEqual(0); expect(sim.stock.store).toBeLessThan(1000);
    });
    for (const p of posts) expect((held[p] ?? 0) / samples, `post ${p} held`).toBeGreaterThan(0.95);
    expect([...new Set(stuck)]).toEqual([]);
    expect(masonsAt10).toBeGreaterThanOrEqual(10);
    for (const a of ['stand_guard', 'dress_stone', 'grind', 'bake', 'carry_sack', 'write_tablet', 'eat', 'sleep', 'gamble']) expect(acts.has(a), a).toBe(true);
    expect(sim.events.some(e => e.kind === 'caravan')).toBe(true);
    expect(sim.stock.store).toBeGreaterThan(0);
  }, 120_000);
  it('is deterministic for a given seed and step size, and near step-size independent', () => {
    const sig = (dt: number) => { const s = new PeopleSim(1, nav, env); const out: string[] = []; runDay(s, dryDay, dt, h => { if (h % 2 === 0) out.push(s.agents.map(a => a.task?.act).join(',')); }); return { out, pos: s.agents.map(a => a.pos) }; };
    const a = sig(2), b = sig(2); expect(a.out).toEqual(b.out); expect(a.pos).toEqual(b.pos);
    const c = sig(5); let same = 0, tot = 0;
    a.out.forEach((row, i) => { const r1 = row.split(','), r2 = (c.out[i] ?? '').split(','); r1.forEach((x, j) => { tot++; if (x === r2[j]) same++; }); });
    expect(same / tot).toBeGreaterThan(0.85);
  }, 120_000);
  it('save → load restores everyone (task, place, carried goods, memory) and the stores', () => {
    const s1 = new PeopleSim(1, nav, env); s1.jumpTo(dryDay * 24 + 10); for (let i = 0; i < 600; i++) s1.step(1);
    s1.agents[3].metPlayer = 2;
    const snap = JSON.parse(JSON.stringify(s1.save()));
    const s2 = new PeopleSim(1, nav, env); s2.load(snap);
    expect(s2.t).toBe(s1.t); expect(s2.stock).toEqual(s1.stock);
    for (const a of s1.agents) { const b = s2.agents[a.id]; expect(b.task).toEqual(a.task); expect(b.pos).toEqual(a.pos); expect(b.carry).toBe(a.carry); expect(b.metPlayer).toBe(a.metPlayer); }
  });
});

describe('activity lint (brief §9.5: every activity is performed)', () => {
  it('every activity the simulation emits has a non-placeholder performance with an existing pose and prop', () => {
    for (const id of PeopleSim.EMITS) { const p = ACTIVITIES[id]; expect(p, id).toBeDefined(); expect(p.placeholder ?? false, id).toBe(false); expect(ANIMS).toContain(p.anim); }
    for (const [id, p] of Object.entries(ACTIVITIES)) { expect(ANIMS, id).toContain(p.anim); if (p.prop) expect(propGeometry(p.prop === 'jar_head' ? 'jar' : p.prop === 'bread' ? 'basket' : p.prop), `${id} prop`).not.toBeNull(); }
  });
  it('every pose is distinct from idle for working activities and returns finite rotations', () => {
    const idle = JSON.stringify(pose('idle', 1, 0, 0).rot);
    for (const a of ANIMS) { const p = pose(a, 1.3, 0.7, 0.2); for (const v of Object.values(p.rot)) for (const x of v!) expect(Number.isFinite(x)).toBe(true); if (a !== 'idle' && a !== 'inspect') expect(JSON.stringify(p.rot)).not.toBe(idle); }
  });
  it('bodies build for every dress with skin attributes on every vertex', () => {
    for (const d of ['persian', 'median', 'worker', 'woman', 'child', 'guard'] as const) {
      const g = bodyGeometry(randomAppearance(d, new Rng(1, d))); const n = g.getAttribute('position').count;
      expect(g.getAttribute('skinIndex').count).toBe(n); expect(g.getAttribute('color').count).toBe(n);
      const si = g.getAttribute('skinIndex').array; for (let i = 0; i < n * 4; i += 4) expect(si[i]).toBeLessThan(BONES.length);
    }
  });
});
