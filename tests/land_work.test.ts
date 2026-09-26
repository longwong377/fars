// D-256: the work on the land the gap hunters found missing (WORLD_INVENTORY G12-G17, G30): the village cattle and the
// milking, fishing, snaring and fowling, the wild nuts and acorns, the bees, the quarrymen and the column drums hauled from
// the quarry to the Terrace, and the animals penned for the night against the wolves. What is measured here: every new
// activity performs with its animals and things; the season's other work offers each option only in its months; the plans
// of a sample of plain households hold the new work in its season and pass planCheck; the drum hauls match the
// construction's E-61 arrivals, move only in daylight at the haul's pace, keep off the Terrace and the town's plots and cross
// the rivers only at a ford; the quarrymen work a working day and are at their camp at night; the fauna pens the compounds'
// cows and small stock at night and the state flock in the stockyard's fold.
// How this could pass while the intent fails (brief clause 1): a performance with the right animals that no plan ever
// emits; a plan that emits it on a day the weather or the season forbids; a drum that "arrives" at the yard without ever
// being on the road; a herd drawn with one token cow (T-D5's anti-proxy). Each is checked below against the simulation's
// own output, not only the registry.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { ACTIVITIES, performanceFor } from '../src/people/activities';
import { activityLint } from '../src/people/activityLint';
import { animalsFor, FOLD_R, FOLD_AT } from '../src/people/animals';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { checkPlan } from '../src/people/planCheck';
import { COW_SHARE, MILK_MONTHS, GRAZE_MONTHS, type Seg } from '../src/people/population';
import { Traffic, DRUM, DRUM_GROUND, along } from '../src/world/traffic';
import { quarrySites } from '../src/world/plain/quarries';
import { roadRiverCrossings } from '../src/world/plain/crossings';
import { buildTownPlan, type TownPlan } from '../src/world/settlement/plan';
import { toLocal } from '../src/world/settlement/site';
import { Fauna, type FaunaCtx, type VillageIn } from '../src/world/fauna';
import { villageCompounds, placeVillages } from '../src/world/plain/villages';
import { buildCanals } from '../src/world/plain/canals';
import { loadTerrain, loadRiversFile } from './plainLib';
import livesData from '../src/data/lives.json';
import footprints from '../src/data/geo/footprints.json';

const L = livesData as any;
const inside = (poly: number[][], e: number, n: number) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > n) !== (yj > n) && e < ((xj - xi) * (n - yi)) / (yj - yi) + xi) c = !c; } return c; };
const TERRACE = (footprints as any).terrace.polygon as number[][];
const cellAt = (plan: TownPlan, e: number, n: number) => { for (const s of plan.sites) { const [u, v] = toLocal(s.frame, e, n), i = s.ci(u), j = s.cj(v); if (!s.inb(i, j)) continue; const c = s.cell[s.k(i, j)]; if (c >= 0) return { c, s }; } return null; };

let sim: PeopleSim, traffic: Traffic, plan: TownPlan, terrain: ReturnType<typeof loadTerrain>;
beforeAll(() => {
  terrain = loadTerrain(); plan = buildTownPlan();
  const W = new WeatherSystem(1), env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d % W.days.length, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  sim = new PeopleSim(1, nav, env); for (const a of sim.agents) a.lod = 'abstract'; sim.jumpTo(0);
  traffic = new Traffic(1, sim.pop as any, plan); traffic.setQuarries(quarrySites(terrain));
}, 300_000);

describe('the performances (activities.ts)', () => {
  it('the new activities and variants pass the activity lint, and each performs with its animals and things', () => {
    expect(activityLint(ACTIVITIES as any)).toEqual([]);
    const herd = performanceFor('herd', 'out with the village cows and calves on the river meadow and the fallow: his house’s turn with the herd');
    expect(herd.animals!.species).toContain('cow'); expect(herd.animals!.species).toContain('calf'); expect(herd.animals!.n).toBeGreaterThanOrEqual(8); expect(herd.sound).toBeUndefined(); // (the cows low from the crowd's animal voices, not from the herdsman's cycle)
    const watch = performanceFor('herd', 'watching the flock with the dogs in the night, by turns');
    expect(watch.animals!.kind).toBe('fold'); expect(watch.work!.map(w => w.kind)).toContain('fold'); expect(watch.animals!.n).toBeGreaterThanOrEqual(20);
    expect(performanceFor('tend_animals', 'watering the flock and folding it beside the tents').animals!.kind).toBe('fold');
    expect(performanceFor('milk', 'milking the household’s cow in the courtyard at first light').animals!.species).toEqual(['cow']);
    expect(performanceFor('fish', 'setting and lifting the wicker fish traps at the bank').work!.map(w => w.kind)).toContain('fish_trap');
    expect(performanceFor('fowl', 'out after the waterfowl in the reeds with the bow', 0, undefined, { sex: 'm', age: 30 }).prop).toBe('bow');
    expect(performanceFor('fowl', 'out after the waterfowl in the reeds with the bow', 0, undefined, { sex: 'm', age: 10 }).prop).toBe('toy_bow');
    expect(performanceFor('gather', 'gathering wild pistachios and almonds on the slopes').work!.map(w => w.kind)).toContain('basket_nuts');
    expect(performanceFor('bees', 'taking the honey from the hives in the garden').prop).toBe('knife');
    const drum = performanceFor('walk', 'driving two yoke of oxen dragging a column drum on its sledge from the quarry to the Terrace');
    expect(drum.animals!.kind).toBe('draught'); expect(drum.animals!.n).toBe(4); expect(drum.work!.map(w => w.kind)).toEqual(['drum_haul']);
    expect(performanceFor('walk', 'driving the oxen back to the quarry with the empty sledge').work!.map(w => w.kind)).toEqual(['sledge']);
    // the drum's gang does not draw drums of its own (the haul's shared sledge is the driver's)
    expect(performanceFor('haul', 'the gang roping the drum down on the sledge for the haul').work).toEqual([]);
    expect(performanceFor('quarry', 'cutting the channel round the next drum at the face').anim).toBe('hoe');
    expect(performanceFor('quarry', 'roughing out a column drum among the blocks').work!.map(w => w.kind)).toEqual(['drum_rough']);
  });
  it('a fold holds its animals inside its ring; two yoke draw the sledge clear of the second pair', () => {
    for (let t = 0; t < 600; t += 13) for (const a of animalsFor({ kind: 'fold', species: ['sheep', 'goat'], n: 24, pace: 1 }, t, 5)) expect(Math.hypot(a.x, a.z - FOLD_AT)).toBeLessThan(FOLD_R);
    const night = animalsFor({ kind: 'fold', species: ['sheep'], n: 40, pace: 1 }, 100, 3).filter(a => a.lie === 1).length; expect(night).toBeGreaterThan(20);
    const team = animalsFor({ kind: 'draught', species: ['ox', 'ox', 'ox', 'ox'], n: 4, pace: 0.4 }, 10, 1); expect(team.length).toBe(4);
    const last = Math.min(...team.map(a => a.z)); expect(last - 1.85 / 2).toBeGreaterThan(-9.0 + 1.55); // (the sledge's front end: drum_haul at z −9, runners 3.1 m)
  });
});

describe('the season’s other work (lives.json farm_men_other_work)', () => {
  it('each new option is offered only in its season', () => {
    const W = L.farm_men_other_work.by_month, months = (k: string) => Object.entries(W).filter(([, v]: any) => v[k] > 0).map(([m]) => +m).sort((a, b) => a - b);
    expect(months('nuts')).toEqual([5, 6]); // August and September (plain.json "nuts gathered Aug-Sep")
    expect(months('acorns')).toEqual([6, 7, 8]); expect(months('garlic')).toEqual([3]); // Θāigraciš, the third month
    expect(months('cattle')).toEqual(GRAZE_MONTHS.slice().sort((a, b) => a - b));
    for (const k of ['cattle', 'fish', 'traps', 'snares', 'reeds', 'nuts', 'acorns', 'bees', 'garlic']) expect(L.farm_men_other_work.opts[k].act in ACTIVITIES, k).toBe(true);
  });
});

describe('the plans of the plain (population.ts)', () => {
  it('a sample of plain households takes up the new work in its season, and those days pass planCheck', () => {
    const P = sim.pop, hh = P.households.filter(h => h.zone === 'plain').slice(0, 220);
    const re: Record<string, RegExp> = { cattle: /village cows/, milk: /^milking/, fish: /fishing|fish traps/, fowl: /snares|waterfowl/, nuts: /pistachios/, bees: /hives/ };
    const n: Record<string, number> = {}, bad: string[] = []; let milkOut = 0, nutsOut = 0;
    for (let d = 1; d < 354; d += 4) { const C = P.cal!.ctx(d);
      for (const H of hh) for (const pid of P.membersOn(H.id, d)) { if (!P.present(pid, d)) continue; const segs = P.plan(pid, d);
        let hit = false; for (const [k, r] of Object.entries(re)) if (segs.some(s => r.test(s.why))) { n[k] = (n[k] ?? 0) + 1; hit = true; }
        if (segs.some(s => s.act === 'milk') && !MILK_MONTHS.includes(C.month)) milkOut++;
        if (segs.some(s => /pistachios/.test(s.why)) && ![5, 6].includes(C.month)) nutsOut++;
        if (hit) for (const i of checkPlan(P, pid, d, segs, null, null)) bad.push(`${pid} d${d}: ${JSON.stringify(i).slice(0, 160)}`); } }
    for (const k of Object.keys(re)) expect(n[k] ?? 0, k).toBeGreaterThan(0);
    expect(milkOut).toBe(0); expect(nutsOut).toBe(0);
    expect(bad.slice(0, 5)).toEqual([]);
  }, 600_000);
  it('a turn with the village cows: out in the morning and again in the afternoon, home by dusk; milking at both ends of the day', () => {
    const P = sim.pop; let found: { pid: number; d: number } | null = null;
    outer: for (let d = 20; d < 200; d++) for (const H of P.households) { if (H.zone !== 'plain') continue; for (const pid of P.membersOn(H.id, d)) if (P.plan(pid, d).some(s => /village cows/.test(s.why))) { found = { pid, d }; break outer; } }
    expect(found).not.toBeNull(); const segs: Seg[] = P.plan(found!.pid, found!.d), C = P.cal!.ctx(found!.d);
    const herd = segs.filter(s => s.act === 'herd' && s.place.startsWith('meadow:'));
    expect(herd.length).toBeGreaterThanOrEqual(1); expect(herd[0].t0).toBeLessThan(11);
    expect(segs[segs.length - 1].place.startsWith('h:')).toBe(true); expect(herd[herd.length - 1].t1).toBeLessThanOrEqual(C.sun.set + 0.01);
    expect(COW_SHARE).toBeGreaterThan(0.3);
  }, 300_000);
});

describe('the drums from the quarry and the quarrymen (world/traffic.ts)', () => {
  it('every E-61 arrival is a haul: its daylight spans cover the route at the haul’s pace and end at the drum ground an hour before the yard counts it', () => {
    const R = traffic.drumRoute!; expect(R.len).toBeGreaterThan(15000); let n = 0;
    for (let d = 3; d < 354; d++) { const ev = sim.pop.cal!.ctx(d).events.filter(e => e.id === 'E-61' && /drum arrived/.test(e.text)), H = traffic.haulsArriving(d); expect(H.length).toBe(ev.length);
      for (const h of H) { n++; const m = h.out.reduce((a, [x, y]) => a + (y - x), 0) * 3600 * DRUM.pace; expect(Math.abs(m - R.len)).toBeLessThan(1);
        for (const [a, b] of h.out) { const dd = Math.floor(a / 24), sun = sim.pop.cal!.ctx(dd).sun; expect(a - dd * 24).toBeGreaterThanOrEqual(sun.rise + DRUM.dawn - 1e-6); expect(b - dd * 24).toBeLessThanOrEqual(sun.set - DRUM.dusk + 1e-6); }
        const at = traffic.at(h.arrive - 0.01).find(x => x.key === h.key)!; expect(Math.hypot(at.e - DRUM_GROUND[0], at.n - DRUM_GROUND[1])).toBeLessThan(15);
        const mid = h.out[0][0] + (h.out[0][1] - h.out[0][0]) / 2, mv = traffic.at(mid).filter(x => x.key.startsWith(h.key)); expect(mv.length).toBe(1 + DRUM.gang); expect(mv[0].act).toBe('walk');
        expect(ACTIVITIES.walk.variants!.some(v => v.when instanceof RegExp && v.when.test(mv[0].why) && v.animals?.n === 4)).toBe(true); } }
    expect(n).toBeGreaterThan(20);
  });
  it('the route keeps off the Terrace and the town’s plots, and crosses a river only at a ford', () => {
    const R = traffic.drumRoute!, rivers = loadRiversFile().rivers, fords = roadRiverCrossings(rivers);
    for (let s = 0; s <= R.len; s += 3) { const p = along(R, s); expect(inside(TERRACE, p.e, p.n), `at ${s} m: on the Terrace`).toBe(false);
      const c = cellAt(plan, p.e, p.n); if (c) expect(false, `at ${s.toFixed(0)} m (${p.e.toFixed(0)}, ${p.n.toFixed(0)}) in a plot of ${c.s.id}`).toBe(true); }
    const pts = R.pts; let cross = 0;
    for (const r of rivers) { const X = Array.from(r.x), Y = Array.from(r.y);
      for (let i = 1; i < pts.length; i++) for (let j = 1; j < X.length; j++) { const [a, b] = [pts[i - 1], pts[i]], c: [number, number] = [X[j - 1], Y[j - 1]], d: [number, number] = [X[j], Y[j]];
        const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]); if (Math.abs(den) < 1e-9) continue;
        const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den, u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue; cross++; const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        expect(Math.min(...fords.map(f => Math.hypot(f.x - x, f.y - y))), `river ${r.id} crossed at (${x.toFixed(0)}, ${y.toFixed(0)}) with no ford`).toBeLessThan(40); } }
    expect(cross).toBeGreaterThanOrEqual(0);
  });
  it('the quarrymen work a working day and are at their camp at night', () => {
    const d = [20, 21, 22, 23, 24, 25].find(x => !sim.pop.cal!.ctx(x).wx.wet && !sim.pop.cal!.ctx(x).wx.stormH)!, C = sim.pop.cal!.ctx(d);
    const at = (h: number) => traffic.at(d * 24 + h).filter(m => m.kind === 'quarry');
    const work = at(C.sun.rise + 2); expect(work.length).toBe(DRUM.quarrymen); expect(work.every(m => m.act === 'quarry')).toBe(true);
    expect(at(12.3).every(m => m.act === 'eat')).toBe(true);
    const night = at(1); expect(night.every(m => m.act === 'sleep')).toBe(true); // (month 1 is warm: asleep in the open; the cold months' huts are not built: B80)
  });
});

describe('the animals penned at night (world/fauna.ts)', () => {
  it('the compounds pen their cows and small stock at night and the state flock lies in the stockyard’s fold', () => {
    const rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, 1);
    const villages: VillageIn[] = placeVillages(terrain, rivers.rivers, canals, 1).map(v => ({ id: v.id, x: v.x, y: v.y, r: v.r, comps: villageCompounds(v, terrain, 1) }));
    const F = new Fauna(1, plan, villages, (e, n) => terrain.heightAt(e, -n)), c = F.counts();
    expect(c.cows / villages.reduce((a, v) => a + v.comps.length, 0)).toBeGreaterThan(0.3); expect(c.stockFold).toBeGreaterThan(40); expect(F.stockFold).not.toBeNull();
    const v = villages.find(x => x.comps.length > 20)!, ctx = (hour: number): FaunaCtx => ({ t: 1000 + hour * 3600, hour, month: 3, sun: { rise: 5.2, set: 19.1 }, player: null, cam: { x: v.x, y: 0, z: -v.y }, dt: 0.05, rain: 0 });
    F.update(ctx(1)); const night = { ...F.stats.bySpecies }; F.update(ctx(11)); const day = { ...F.stats.bySpecies };
    expect(night.cow ?? 0).toBeGreaterThan(3); expect((night.sheep ?? 0) + (night.goat ?? 0)).toBeGreaterThan(3); expect(day.cow ?? 0).toBe(0); // (out with the herd by day, month 3)
    const fc = F.stockFold!.c; F.update({ ...ctx(1), cam: { x: fc[0], y: 0, z: -fc[1] } }); expect((F.stats.bySpecies.sheep ?? 0) + (F.stats.bySpecies.goat ?? 0)).toBeGreaterThanOrEqual(c.stockFold);
  }, 300_000);
});

describe('roof timber arriving (session 9, G77)', () => {
  it('trains of ox carts of beams on about one day in nine of the dry months, held at the drum ground, each drawn with its beams', () => {
    const days = new Set<number>(); let atGround = 0;
    for (let d = 0; d < 354; d++) for (let h = 8; h < 20; h += 0.5) for (const m of traffic.at(d * 24 + h)) if (m.key.startsWith('tb')) { days.add(d); if (m.act === 'tend_animals' && Math.hypot(m.e - DRUM_GROUND[0], m.n - DRUM_GROUND[1]) < 40) atGround++; }
    expect(days.size).toBeGreaterThan(10); expect(days.size).toBeLessThan(45);
    expect(Math.max(...days)).toBeLessThan(216); // April-October only (the regnal months 1-7)
    expect(atGround).toBeGreaterThan(0);
    const P = performanceFor('walk', 'driving an ox cart of roof timbers to the drum ground for the building works') as any;
    expect(P.work?.map((w: any) => w.kind)).toContain('cart_timber');
  });
});

