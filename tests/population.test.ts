// Phase 5 people simulation (D-021..D-024): the abstract population and its day plans, the event calendar, the Hall of
// 100 Columns as simulation state, the guard rota, memory of the player, relationships, the renderer interface.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env, PLACES } from '../src/people/sim';
import { segAt, GUARD_POSTS } from '../src/people/population';
import { checkPlan, checkDay, reasonOk } from '../src/people/planCheck';
import { EventCalendar, STORE_BOUNDS } from '../src/people/calendar';
import { Construction, hall100Layout } from '../src/people/construction';
import { PlayerMemory } from '../src/people/memory';
import { ACTIVITIES, ABSTRACT_PLACEHOLDERS } from '../src/people/activities';
import { buildTerrace } from '../src/arch/terrace';
import { WeatherSystem } from '../src/weather/weatherState';

const loadNav = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const POPJ = JSON.parse(readFileSync('src/data/population.json', 'utf8'));
let nav: NavGrid; let sim: PeopleSim;
beforeAll(() => { nav = loadNav(); sim = new PeopleSim(1, nav, env); });

describe('population (D-021)', () => {
  it('the zones hold the population.json numbers by day and by night (court absent, spring)', () => {
    const P = sim.pop, d = 30; const count = (h: number) => { const c: Record<string, number> = { terrace: 0, town: 0, plain: 0 };
      for (const p of P.persons) { if (!P.present(p.id, d)) continue; const s = segAt(P.plan(p.id, d), h); const w = s.where === 'road' ? (s.place.startsWith('road:terrace') ? 'terrace' : s.place.startsWith('road:plain') ? 'plain' : 'town') : s.where; if (w in c) c[w]++; } return c; };
    const night = count(2), day = count(10.5); const Z = (id: string) => POPJ.zones.find((z: any) => z.id === id).court_absent;
    for (const z of ['terrace', 'town', 'plain']) {
      const [n0, n1] = Z(z).night.spring.range, [d0, d1] = Z(z).day.spring.range;
      expect(night[z], `${z} at night`).toBeGreaterThanOrEqual(n0); expect(night[z], `${z} at night`).toBeLessThanOrEqual(n1);
      expect(day[z], `${z} by day`).toBeGreaterThanOrEqual(d0); expect(day[z], `${z} by day`).toBeLessThanOrEqual(d1);
    }
  }, 60_000);
  it('day plans are well formed, deterministic, and use only registered activities', () => {
    const P = sim.pop; const again = new PeopleSim(1, nav, env).pop;
    for (let pid = 0; pid < P.persons.length; pid += 97) for (const d of [3, 101, 200, 333]) {
      const s = P.plan(pid, d); expect(s[0].t0).toBe(0); expect(s[s.length - 1].t1).toBe(24);
      for (let i = 0; i < s.length; i++) { expect(s[i].t1, `${pid}/${d}`).toBeGreaterThan(s[i].t0); if (i) expect(s[i].t0).toBeCloseTo(s[i - 1].t1, 9); expect(ACTIVITIES[s[i].act], s[i].act).toBeDefined(); }
      expect(JSON.stringify(again.plan(pid, d))).toBe(JSON.stringify(s)); expect(JSON.stringify(P.plan(pid, d))).toBe(JSON.stringify(s));
    }
  }, 60_000);
  it('the detailed agents are people of the population; on the Terrace their plans use only performable activities', () => {
    const P = sim.pop; const pool = new Set((JSON.parse(readFileSync('src/data/names.json', 'utf8')).names as any[]).map(n => n.name));
    expect(sim.agents.length).toBe(135); expect(sim.agents.filter(a => a.role === 'guard').length).toBe(100);
    for (const a of sim.agents) { const p = P.persons[a.pid]; expect(p.agent).toBe(a.id); if (a.name) expect(pool.has(a.name), a.name).toBe(true);
      for (let d = 0; d < 354; d += 11) for (const s of P.plan(a.pid, d)) if (s.where === 'terrace') { expect(PeopleSim.EMITS, `${a.role} ${s.act} (${s.why})`).toContain(s.act); expect(ACTIVITIES[s.act].placeholder ?? false).toBe(false); } }
  }, 60_000);
});

describe('households, meals and sleep (shadow review, §13.11)', () => {
  it('every child knows its mother; same-age siblings are rare (twins); marriage never takes a mother from her children', () => {
    const P = sim.pop; let kids = 0, noMother = 0, multi = 0, sameAge = 0;
    for (const p of P.persons) if (p.job === 'child' && (p.zone === 'town' || p.zone === 'plain') && p.born < 0) { kids++; if (p.mother < 0) noMother++; }
    expect(kids).toBeGreaterThan(5000); expect(noMother).toBe(0);
    for (const H of P.households) { if (H.zone !== 'town' && H.zone !== 'plain') continue; const ages = H.members.filter(x => P.persons[x].job === 'child' && P.persons[x].born < 0).map(x => P.persons[x].age);
      if (ages.length < 2) continue; multi++; if (new Set(ages).size < ages.length) sameAge++; }
    expect(sameAge / multi).toBeLessThan(0.05);
    for (const p of P.persons) if (p.marry < 1e9 && p.moved !== 'fostered') expect(P.childrenOf(p.id).filter(c => P.persons[c].born < p.marry && P.persons[c].dies > p.marry).length, `${p.id} marries away from her children`).toBe(0);
  }, 60_000);
  it('plans are well formed: sleep at night, reasons that match the act, meals for working adults, no jumps between days', () => {
    expect(reasonOk('play', 'asleep')).toBe(false); expect(reasonOk('sleep', 'asleep beside the mother')).toBe(true); expect(reasonOk('rest', 'spinning')).toBe(false);
    const P = sim.pop; const bad: string[] = [];
    for (let pid = 0; pid < P.persons.length; pid += 53) for (const d of [4, 101, 200, 333]) { if (!P.present(pid, d)) continue;
      const prev = P.present(pid, d - 1) ? P.plan(pid, d - 1) : null;
      for (const x of checkPlan(P, pid, d, P.plan(pid, d), prev ? prev[prev.length - 1].place : null)) bad.push(`${pid} ${P.persons[pid].job} d${d}: ${x.kind} ${x.note}`); }
    expect(bad.slice(0, 10)).toEqual([]);
  }, 120_000);
  it('on a harvest day nobody is "with" someone who is elsewhere and no child under ten is alone at night', () => {
    const P = sim.pop, d = 30; const cache = new Map<number, any>(); const planOf = (x: number) => cache.get(x) ?? cache.set(x, P.plan(x, d)).get(x);
    expect(checkDay(P, d, planOf).slice(0, 10).map(x => `${x.pid} ${x.kind} ${x.note}`)).toEqual([]);
  }, 120_000);
  it('an infant is nursed on demand, by night too', () => {
    const P = sim.pop; let n = 0;
    for (const p of P.persons) { if (p.age !== 0 || p.born >= 0 || p.zone === 'transient') continue; const d = 40; const m = p.mother; if (!P.present(p.id, d) || P.sick(p.id, d) || m < 0 || !P.present(m, d) || P.sick(m, d) || P.home(m, d) !== P.home(p.id, d)) continue;
      const feeds = P.plan(p.id, d).filter(s => s.act === 'eat'); expect(feeds.length, `${p.id}`).toBeGreaterThanOrEqual(6); expect(feeds.some(s => s.t0 < 5 || s.t0 > 21), `${p.id} fed at night`).toBe(true); if (++n >= 40) break; }
    expect(n).toBeGreaterThan(10);
  }, 60_000);
});

describe('activities', () => {
  it('every emitted activity is performable; the abstract-only placeholders are listed and flagged, never emitted', () => {
    for (const id of PeopleSim.EMITS) expect(ACTIVITIES[id].placeholder ?? false, id).toBe(false);
    expect([...ABSTRACT_PLACEHOLDERS].sort()).toEqual(['brew', 'carry_bier', 'clean', 'craft', 'dig_canal', 'field_work', 'garden_work', 'gather', 'haul', 'herd', 'irrigate', 'lay_brick', 'mould_brick', 'offer', 'pick_fruit', 'plough', 'polish_metal', 'reap', 'shear', 'slaughter', 'spin', 'tend_animals', 'thresh', 'train', 'wash', 'weave', 'work_wood']);
    for (const id of ABSTRACT_PLACEHOLDERS) { expect(ACTIVITIES[id].placeholder).toBe(true); expect(ACTIVITIES[id].note).toMatch(/PLACEHOLDER/); expect(PeopleSim.EMITS).not.toContain(id); }
  });
  it('the generated Hall of 100 Columns places are on walkable ground', () => {
    const gen = Object.values(PLACES).filter(p => p.id.startsWith('h100_'));
    expect(gen.length).toBeGreaterThan(100);
    for (const p of gen) expect(nav.snap(p.at[0], p.at[1], 2), p.id).not.toBeNull();
  });
});

describe('event calendar', () => {
  it('is deterministic; court events only with the court setting (D-003); stores stay in bounds all year', () => {
    const a = new PeopleSim(1, nav, env), b = new PeopleSim(1, nav, env), c = new PeopleSim(1, nav, env, { court: true });
    a.cal.ctx(353); b.cal.ctx(60); c.cal.ctx(130);
    for (let d = 0; d <= 60; d++) expect(JSON.stringify(b.cal.ctx(d).events)).toBe(JSON.stringify(a.cal.ctx(d).events));
    const ids = (cal: EventCalendar, n: number) => new Set(Array.from({ length: n }, (_, d) => cal.ctx(d).events.map(e => e.id)).flat());
    const absent = ids(a.cal, 354), present = ids(c.cal, 131);
    for (const id of ['E-24', 'E-25', 'E-26', 'E-27', 'E-33', 'E-35', 'E-36']) expect(absent.has(id), id).toBe(false);
    expect(present.has('E-25')).toBe(true); expect(present.has('E-26')).toBe(true);
    for (const s of a.cal.stockLog) for (const [k, bd] of Object.entries(STORE_BOUNDS)) { if (!bd) continue; const v = (s as any)[k]; expect(v, k).toBeGreaterThanOrEqual(bd[0]); expect(v, k).toBeLessThanOrEqual(bd[1]); }
  }, 60_000);
});

describe('construction of the Hall of 100 Columns (D-022)', () => {
  it('starts from exactly the state the geometry draws', () => {
    const cols = buildTerrace().parts.filter((p: any) => p.building === 'hall100' && p.type === 'column') as any[];
    const L = hall100Layout(); expect(cols.length).toBe(L.hall.length + L.portico.length);
    L.built.forEach((b, i) => { expect(cols[i].built).toBe(b); expect(cols[i].c[0]).toBeCloseTo(L.hall[i][0], 6); expect(cols[i].c[1]).toBeCloseTo(L.hall[i][1], 6); });
    const C = new Construction(1); expect(C.raised).toBe(L.built.filter(b => b === 1).length);
    C.columns.slice(0, L.hall.length).forEach((c, i) => expect(c.drums).toBe(Math.round(L.built[i] * c.drumsTotal)));
  });
  it('advances from the labour put in, deterministically, and is exposed as sim.construction', () => {
    const s = new PeopleSim(1, nav, env); const r0 = s.construction.raised; s.cal.ctx(353);
    const s2 = new PeopleSim(1, nav, env); s2.cal.ctx(353);
    expect(s.construction.raised).toBeGreaterThan(r0); expect(JSON.stringify(s2.construction.snapshot())).toBe(JSON.stringify(s.construction.snapshot()));
    expect(s.construction.log.some(e => e.kind === 'drum_set')).toBe(true); expect(s.construction.log.some(e => e.kind === 'course_laid')).toBe(true);
  }, 60_000);
});

describe('guard rota (D-023)', () => {
  it('every post is held by one man in each watch, every day of a month; nobody stands two watches in a day', () => {
    const P = sim.pop;
    for (let d = 0; d < 30; d++) { const r = P.rota(d); const byWatch = [new Set<string>(), new Set<string>(), new Set<string>()];
      for (const [, x] of r) if (x.post) { expect(byWatch[x.watch].has(x.post), `day ${d} watch ${x.watch} ${x.post} twice`).toBe(false); byWatch[x.watch].add(x.post); }
      for (const w of byWatch) expect(w.size).toBe(GUARD_POSTS.length); }
  });
});

describe('memory of the player and relationships', () => {
  it('familiarity builds with encounters and fades over days', () => {
    const m = new PlayerMemory(); m.note(7, 'stopped', 100);
    expect(m.greeting(7, 100)).toBe('recognise'); expect(m.level(7, 100 + 24 * 6)).toBeCloseTo(m.level(7, 100) / 2, 6);
    expect(m.greeting(7, 100 + 24 * 30)).toBe('none'); expect(m.greeting(8, 100)).toBe('none');
    m.note(9, 'met', 0); m.note(9, 'watched', 1); expect(m.greeting(9, 2)).not.toBe('none');
  });
  it('a quarrel sours a relationship from the next day and it drifts back to its base', () => {
    const P = sim.pop; const a = sim.agents[0].pid, b = sim.agents[1].pid; const base = P.affinity(a, b, 100);
    P.relate(a, b, 100, -0.35); expect(P.affinity(a, b, 100)).toBeCloseTo(base, 9); // plans of the day already drawn stay pure
    expect(P.affinity(a, b, 101)).toBeLessThan(base - 0.2); expect(Math.abs(P.affinity(a, b, 250) - base)).toBeLessThan(0.02);
    P.relationsRestore([]);
  });
});

describe('renderer interface (D-024)', () => {
  it('visibleAgents: on the Terrace, within the radius, nearest first, capped', () => {
    const s = new PeopleSim(1, nav, env); s.jumpTo(24 * 30 + 10); for (let i = 0; i < 60; i++) s.step(1);
    const c: [number, number] = [0, 0]; const v = s.visibleAgents(c, 150, 40);
    expect(v.length).toBeGreaterThan(0); expect(v.length).toBeLessThanOrEqual(40);
    let prev = -1; for (const a of v) { const d = Math.hypot(a.pos[0] - c[0], a.pos[1] - c[1]); expect(d).toBeLessThanOrEqual(150); expect(d).toBeGreaterThanOrEqual(prev); expect(a.offmap).toBe(false); prev = d; }
  });
  it('save → load keeps memory of the player and changed relationships', () => {
    const s1 = new PeopleSim(1, nav, env); s1.jumpTo(24 * 12 + 9); for (let i = 0; i < 120; i++) s1.step(1);
    s1.noteAddressed(4); s1.pop.relate(s1.agents[2].pid, s1.agents[3].pid, 10, -0.35);
    const snap = JSON.parse(JSON.stringify(s1.save())); const s2 = new PeopleSim(1, nav, env); s2.load(snap);
    expect(s2.familiarity(4)).toBeCloseTo(s1.familiarity(4), 9); expect(s2.greeting(4)).toBe(s1.greeting(4));
    expect(s2.relationship(2, 3)).toBeCloseTo(s1.relationship(2, 3), 9);
    for (const a of s1.agents) expect(s2.agents[a.id].task).toEqual(a.task);
  });
});
