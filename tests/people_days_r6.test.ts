// Phase 5 shadow review round 5 (REVIEWS/shadow_phase5_r5.md, reviewer A; REVIEWS/shadow_phase5_r5_b.md, reviewer B; D-175):
// one or more tests for each finding, written against what the reviewers measured on the round-5 code (7a09285). They were
// not each re-run against 7a09285 (the WIP was finished in session 6 without that check); the numbers the reviewers give
// for 7a09285 fail every gate here.
//  A S1 / B S1 rain sheltered in the open field; A S3 / B S2 the planners read the age at the start of the year; A S2 minding
//  written without the little one; A S6 / B S3 the camp's flour came from no stock; A S4 / B S4 a guard's gap meal beside his
//  breakfast; A S5 / B S5 the evening lane in the heat and the dust; A S7 / B S5 home hours blind to standing and light;
//  B S6 the servant's estate day; A S8 / B S7 / B S8 labels; A S9 / B S8 names; A S10 the sun's times.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as A from 'astronomy-engine';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env, INITIAL_STOCK } from '../src/people/sim';
import { pickSample } from '../tools/shadow_days';
import { Seg, segAt, nameFor, THIN_NAME_POOL } from '../src/people/population';
import { checkDay, MINDING } from '../src/people/planCheck';
import { sunTimes, rainSpells, rainHours, CAL } from '../src/people/calendar';
import { LATITUDE_N, LONGITUDE_E } from '../src/core/calendar';
import { WeatherSystem } from '../src/weather/weatherState';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
let sim: PeopleSim; let P: any;
beforeAll(() => { sim = new PeopleSim(1, nav(), env); P = (sim as any).pop; });

/** a place with no roof (the fields, the canal, the gardens, the pasture, the fuel ground, the floor, the lanes) */
const OPEN = /^(field:|canal:|garden:|orchard:|vineyard:|pasture:|outside|threshing:|estate:|crown_fields|lane:|well:|river|clay_pit)/;
const resident = (pid: number, d: number) => P.present(pid, d) && ['town', 'plain'].includes(P.households[P.home(pid, d)].zone);
/** a small child's plan that is an infant's: nursed, asleep, carried, in a lap; never at play, never walking, never at a meal */
const infantLike = (segs: Seg[]) => !segs.some(s => s.act === 'play' || s.act === 'walk' || (s.act === 'eat' && !/nursed|fed goat|softened bread from the/.test(s.why)));

describe('S1 (A, B): rain', () => {
  it('year-wide (every 4th resident, every day with rain in daylight): nobody shelters in the open for more than half an hour of daylight rain, and no piece of shelter in the open is longer', () => {
    let days = 0, pd = 0, over = 0, openPieces = 0; const bad: string[] = [];
    for (let d = 0; d < 354; d++) { const C = P.cal.ctx(d); if (!C.wx.rain) continue; const { rise, set } = C.sun; if (C.wx.rain[1] <= rise || C.wx.rain[0] >= set) continue; days++;
      for (let pid = d % 4; pid < P.persons.length; pid += 4) { if (!resident(pid, d)) continue; pd++; let h = 0;
        for (const s of P.plan(pid, d) as Seg[]) { if (s.act !== 'shelter' || !OPEN.test(s.place)) continue; openPieces++; h += Math.max(0, Math.min(s.t1, set) - Math.max(s.t0, rise)); if (s.t1 - s.t0 > 0.5 + 1e-6) bad.push(`${pid} d${d} ${s.place} ${(s.t1 - s.t0).toFixed(2)} h`); }
        if (h > 0.5 + 1e-6) { over++; bad.push(`${pid} d${d}: ${h.toFixed(2)} h`); } } }
    expect(days).toBeGreaterThan(15); expect(pd).toBeGreaterThan(100_000); expect(over).toBe(0); expect(bad.slice(0, 5)).toEqual([]);
    expect(openPieces, 'passing showers are still waited out in the open').toBeGreaterThan(0);
  }, 300_000);
  it('the field work is not begun into rain that covers it (dryTask); 21408 Karkišša on Tebetu 26 (day 292) is kept in by the rain', () => {
    let tasks = 0, off = 0;
    for (let d = 0; d < 354; d++) { const C = P.cal.ctx(d); if (!C.wx.rain) continue;
      for (let h = d % 3; h < P.households.length; h += 3) { if (P.households[h].zone !== 'plain') continue; const hd = P.hday(h, d); if (hd.wetOff) off++; const T = hd.task; if (!T) continue; tasks++;
        expect(rainSpells(C.wx).some(([a, b]) => T.h0 >= a && T.h0 < b), `${h} d${d} ${T.kind} begins in the rain at ${T.h0.toFixed(2)}`).toBe(false);
        expect(rainHours(C.wx, T.h0, T.h1), `${h} d${d}`).toBeLessThan(0.5 * (T.h1 - T.h0)); } }
    expect(tasks).toBeGreaterThan(1000); expect(off).toBeGreaterThan(500);
    const segs: Seg[] = P.plan(21408, 291); expect(segs.some(s => s.place.startsWith('field:'))).toBe(false); expect(segs.some(s => s.act === 'shelter')).toBe(false);
    expect(segs.some(s => /kept in by the rain/.test(s.why))).toBe(true);
  }, 300_000);
  it('rain in the work sends the worker home: every walk "home out of the rain" ends at home, and the time there is spent under the roof', () => {
    let n = 0;
    for (let d = 0; d < 354; d++) { const C = P.cal.ctx(d); if (!C.wx.rain) continue;
      for (let pid = d % 5; pid < P.persons.length; pid += 5) { if (!resident(pid, d)) continue; const segs: Seg[] = P.plan(pid, d), home = P.households[P.home(pid, d)].home;
        for (let i = 0; i + 1 < segs.length; i++) if (segs[i].where === 'road' && /out of the rain/.test(segs[i].why) && /^home/.test(segs[i].why)) { n++; expect(segs[i + 1].place, `${pid} d${d}`).toBe(home); } } }
    expect(n).toBeGreaterThan(20);
  }, 300_000);
});

describe('S3 (A), S2 (B): every planner uses the age on the day', () => {
  it('days 148, 233 and 301: no child is planned as an infant after its first birthday and every child under one is; the ones of one and two eat at the meals and are nursed at most four times by day', () => {
    for (const d of [148, 233, 301]) { let inf = 0, tod = 0;
      for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (p.job !== 'child' || !resident(pid, d) || P.sick(pid, d)) continue; const a = P.ageOn(pid, d); if (a > 2) continue;
        const segs: Seg[] = P.plan(pid, d);
        if (a === 0) { inf++; expect(infantLike(segs), `${pid} d${d} (0)`).toBe(true); continue; }
        tod++; expect(infantLike(segs), `${pid} d${d} (${a}): planned as an infant`).toBe(false);
        expect(segs.some(s => s.act === 'eat' && !/nursed/.test(s.why)), `${pid} d${d}: no meal`).toBe(true);
        expect(segs.filter(s => /^nursed by/.test(s.why)).length, `${pid} d${d}: day feeds`).toBeLessThanOrEqual(4); }
      expect(inf).toBeGreaterThan(1000); expect(tod).toBeGreaterThan(2000); }
  }, 300_000);
  it('a child who has turned five is not planned as a small child, and one who has turned eight is not taken along to the mother\'s work (the minded rule is for those under eight)', () => {
    let five = 0, eight = 0;
    for (const d of [233, 301]) for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (p.job !== 'child' || !resident(pid, d) || p.agent >= 0) continue; const a = P.ageOn(pid, d);
      if (a === 5 && p.age === 4) { five++; for (const s of P.plan(pid, d) as Seg[]) expect(s.why, `${pid} d${d}`).not.toMatch(/^playing at home near|^a midday sleep$|mother’s lap|, the elder (sister|brother) minding/); }
      if (a === 8 && p.age === 7) { eight++; const segs: Seg[] = P.plan(pid, d); const m = p.mother; if (m < 0 || !P.present(m, d)) continue; const ms: Seg[] = P.plan(m, d);
        const outing = ms.some(s => s.act === 'queue' || s.act === 'reap' || s.act === 'thresh' || s.act === 'pick_fruit' || (s.act === 'talk' && s.place.startsWith('h:') && s.place !== P.households[P.home(m, d)].home));
        if (outing) continue; // (the mother's outings: a child of eight still goes along, lives.json children.with_mother_on_her_outings)
        for (const s of segs) expect(s.with === m && s.where !== 'road' && s.place !== P.households[P.home(pid, d)].home, `${pid} d${d} at ${s.place} ${s.why}`).toBe(false); } }
    expect(five).toBeGreaterThan(300); expect(eight).toBeGreaterThan(300);
  }, 300_000);
  it('39742 Ratukka (13 months, Abu 30, day 148) plays, eats at the household\'s meals and is nursed a few times; her line says her mother is recovering. 1906 (8, day 233) has a day of his own', () => {
    const g: Seg[] = P.plan(39742, 147); expect(P.ageOn(39742, 147)).toBe(1); expect(infantLike(g)).toBe(false);
    expect(g.filter(s => s.act === 'eat' && /a meal with the household/.test(s.why)).length).toBeGreaterThanOrEqual(2);
    expect(g.filter(s => /^nursed by/.test(s.why)).length).toBeLessThanOrEqual(4); expect(g.some(s => /recovering from an illness/.test(s.why))).toBe(true);
    const b: Seg[] = P.plan(1906, 232); expect(P.ageOn(1906, 232)).toBe(8); expect(b.some(s => s.place.startsWith('ws:'))).toBe(false); expect(b.filter(s => s.with !== undefined).length).toBe(0);
  });
});

describe('S2 (A): minding is planned from the little one\'s side', () => {
  it('days 101, 261 and 341, everyone: every minding piece has a little one of the house with the minder, and every little one with her is where she is (planCheck: no "minding", no "apart")', () => {
    for (const d of [101, 261, 341]) { const cache = new Map<number, Seg[]>(); const planOf = (x: number) => cache.get(x) ?? cache.set(x, P.plan(x, d)).get(x)!;
      const iss = checkDay(P, d, planOf).filter(x => x.kind === 'minding' || x.kind === 'apart'); expect(iss.slice(0, 5).map(x => `${x.pid} d${d} ${x.kind} ${x.note}`)).toEqual([]);
      let minding = 0; for (const [, v] of cache) for (const s of v) if (MINDING.test(s.why)) minding += s.t1 - s.t0; expect(minding, `day ${d}: hours of minding`).toBeGreaterThan(1500); }
  }, 600_000);
  it('"on her hip" only for an awake child of two or under, "the little ones" only for two or more, "while she sleeps" only while she sleeps', () => {
    let hip = 0;
    for (const d of [21, 181]) for (let pid = 0; pid < P.persons.length; pid += 2) { if (!resident(pid, d) || P.ageOn(pid, d) > 13) continue;
      for (const s of P.plan(pid, d) as Seg[]) { if (!MINDING.test(s.why)) continue; const mid = (s.t0 + s.t1) / 2;
        const withMe = P.membersOn(P.home(pid, d), d).filter((x: number) => { const g = segAt(P.plan(x, d), mid); return g.with === pid; });
        if (/hip/.test(s.why)) { hip++; expect(withMe.some((x: number) => P.ageOn(x, d) <= 2 && segAt(P.plan(x, d), mid).act !== 'sleep'), `${pid} d${d} ${s.why}`).toBe(true); }
        if (/the little ones/.test(s.why)) expect(withMe.length, `${pid} d${d} ${s.why}`).toBeGreaterThanOrEqual(2);
        if (/while (she|he|they) sleeps?/.test(s.why)) expect(withMe.every((x: number) => segAt(P.plan(x, d), mid).act === 'sleep'), `${pid} d${d} ${s.why}`).toBe(true); } }
    expect(hip).toBeGreaterThan(200);
  }, 300_000);
  it('234 Maza (Addaru 19) and 2868 Utira (Kislimu 3): the little one they mind is with them', () => {
    for (const [pid, d] of [[234, 343], [2868, 238]]) { let n = 0; for (const s of P.plan(pid, d) as Seg[]) { if (!MINDING.test(s.why)) continue; n++;
      const kid = P.membersOn(P.home(pid, d), d).find((x: number) => P.ageOn(x, d) <= 4)!; for (const t of [s.t0 + 0.005, (s.t0 + s.t1) / 2, s.t1 - 0.005]) { const g = segAt(P.plan(kid, d), t); expect(g.with, `${pid} ${t.toFixed(2)}`).toBe(pid); expect(g.place).toBe(s.place); } }
      expect(n).toBeGreaterThan(0); }
  });
});

describe('S6 (A), S3 (B): the camp\'s grain and flour are goods', () => {
  it('the plans: barley is carried from the depot to the querns and flour from the querns to the ovens; no sack of flour goes to the querns', () => {
    let barley = 0, flour = 0;
    for (const d of [30, 120, 200, 280]) for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (p.job !== 'camp' && p.job !== 'porter') continue; if (!P.present(pid, d)) continue;
      for (const s of P.plan(pid, d) as Seg[]) { if (s.act !== 'carry_sack' || s.where !== 'terrace') continue;
        if (/barley/.test(s.why)) { barley++; expect(s.place).toBe('querns'); }
        if (/flour/.test(s.why)) { flour++; expect(s.place, `${pid} d${d} ${s.why}`).toBe('oven'); } } }
    expect(barley).toBeGreaterThan(20); expect(flour).toBeGreaterThan(10);
  }, 120_000);
  it('the detailed tier over four working days: every sack is taken from one stock and set down into another; no stock goes below zero; the camp\'s barley and flour add up', () => {
    const s = new PeopleSim(1, nav(), env); for (const a of s.agents) a.lod = 'abstract'; s.jumpTo(199 * 24);
    const camp = s.agents.filter(a => a.role === 'baker' || a.role === 'grinder'); let low = Infinity;
    const total = () => s.stock.grain + s.stock.querns + s.stock.flour + s.stock.oven + camp.filter(a => a.carry === 'sack').length;
    const t0 = total(); expect(t0).toBeCloseTo(INITIAL_STOCK.grain + INITIAL_STOCK.querns + INITIAL_STOCK.flour + INITIAL_STOCK.oven, 6);
    while (s.t < 203 * 24) { s.step(30); low = Math.min(low, s.stock.grain, s.stock.querns, s.stock.flour, s.stock.oven);
      expect(total(), `at ${s.t.toFixed(2)}`).toBeCloseTo(t0 + s.flows.grainIn - s.flows.kneaded, 6); }
    expect(low).toBeGreaterThanOrEqual(-1e-9); expect(s.flows.grainUp).toBeGreaterThan(0); expect(s.flows.flourToOven).toBeGreaterThan(0); expect(s.flows.ground).toBeGreaterThan(1); expect(s.flows.kneaded).toBeGreaterThan(0);
  }, 300_000);
});

describe('S4 (A, B): meals', () => {
  it('guards on nine days: no two meals within an hour; #9 Attemira (Abu 15) eats the midday meal with his family', () => {
    let n = 0; for (const d of [21, 61, 101, 133, 181, 221, 261, 301, 341]) for (const pid of P.garrison) { if (!P.present(pid, d)) continue; n++;
      const eats = (P.plan(pid, d) as Seg[]).filter(s => s.act === 'eat'); for (let i = 1; i < eats.length; i++) expect(eats[i].t0 - eats[i - 1].t1, `${pid} d${d} ${eats[i - 1].why} / ${eats[i].why}`).toBeGreaterThanOrEqual(1 - 1e-6); }
    expect(n).toBeGreaterThan(800);
    const g: Seg[] = P.plan(sim.agents[9].pid, 132); expect(g.some(s => s.act === 'eat' && /the midday meal with his family/.test(s.why))).toBe(true);
  }, 120_000);
  it('the safety net\'s bread and water never lands within an hour of another meal (every 7th person, five days)', () => {
    let n = 0; for (const d of [21, 101, 181, 261, 341]) for (let pid = d % 7; pid < P.persons.length; pid += 7) { if (!P.present(pid, d) || P.ageOn(pid, d) < 2) continue;
      const segs: Seg[] = P.plan(pid, d), eats = segs.filter(s => s.act === 'eat' && !/nursed/.test(s.why));
      for (const s of eats) { if (s.why !== 'bread and water') continue; n++; for (const o of eats) if (o !== s) expect(o.t1 <= s.t0 - 1 + 1e-6 || o.t0 >= s.t1 + 1 - 1e-6, `${pid} d${d} ${o.why} at ${o.t0.toFixed(2)}`).toBe(true); } }
    expect(n).toBeGreaterThan(200);
  }, 300_000);
});

describe('S5 (A, B): the lane in the heat and the dust', () => {
  it('on the 38-41 °C days 84, 101 and 126 fewer than 1 % of men spend 2 h in the lane between 13:00 and 17:00; the lane after work lasts about 2 h at most', () => {
    for (const d of [84, 101, 126]) { expect(P.cal.ctx(d).heatRest).toBe(true); let men = 0, long = 0;
      for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (!resident(pid, d) || p.sex !== 'm' || P.ageOn(pid, d) < 14) continue; men++; let h = 0;
        for (const s of P.plan(pid, d) as Seg[]) { if (!s.place.startsWith('lane:')) continue; h += Math.max(0, Math.min(s.t1, 17) - Math.max(s.t0, 13)); if (/^(knucklebones|talking) in the lane$/.test(s.why)) expect(s.t1 - s.t0, `${pid} d${d}`).toBeLessThanOrEqual(2.05); }
        if (h >= 2) long++; }
      expect(long / men, `day ${d}`).toBeLessThan(0.01); }
  }, 300_000);
  it('on the dust days nobody sits in the lane while the dust is in the air, and out of doors in it the face is wrapped (W-03)', () => {
    let days = 0, wrapped = 0;
    for (let d = 0; d < 354; d++) { const dh = P.cal.ctx(d).wx.dustH; if (!dh) continue; days++;
      for (let pid = d % 6; pid < P.persons.length; pid += 6) { if (!resident(pid, d)) continue;
        for (const s of P.plan(pid, d) as Seg[]) { const o = Math.min(s.t1, dh[1]) - Math.max(s.t0, dh[0]);
          if (s.place.startsWith('lane:') && ['talk', 'gamble', 'exchange', 'play', 'spin', 'rest'].includes(s.act)) expect(o, `${pid} d${d} ${s.why} ${s.t0.toFixed(2)}`).toBeLessThanOrEqual(0.3);
          if (o > 0.05 && (s.where === 'road' || /^(field:|well:|canal:|pasture:)/.test(s.place)) && s.act !== 'sleep' && s.act !== 'eat') { /* (unwrapped to eat) */ expect(s.wear, `${pid} d${d} ${s.why}`).toBe('the face wrapped against the dust'); wrapped++; } } } }
    expect(days).toBeGreaterThan(3); expect(wrapped).toBeGreaterThan(500);
  }, 300_000);
});

describe('S7 (A), S5 (B): home hours by standing and by the light', () => {
  it('men of standing never mend tools and baskets at home; nobody begins craft before first light', () => {
    let ranked = 0, n = 0;
    for (const d of [21, 84, 125, 181, 261, 341]) { const { rise, set } = P.cal.ctx(d).sun; for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (!resident(pid, d) || P.ageOn(pid, d) < 14) continue;
      const segs: Seg[] = P.plan(pid, d); if (['official', 'steward', 'priest', 'scribe', 'storekeeper'].includes(p.job)) { ranked++; expect(segs.some(s => /mending tools and baskets/.test(s.why)), `${pid} ${p.job} d${d}`).toBe(false); }
      if (pid % 3) continue; n++; for (const s of segs) if (s.act === 'craft' && /mending/.test(s.why)) expect(s.t0 >= rise - 0.45 - 1e-6 && s.t0 <= set + 0.3, `${pid} d${d} ${s.t0.toFixed(2)}`).toBe(true); } }
    expect(ranked).toBeGreaterThan(300); expect(n).toBeGreaterThan(30_000);
  }, 300_000);
});

describe('S6 (B): servants and sons', () => {
  it('a town house\'s servants do the house\'s work, not an estate\'s, and see to its water; no boy of a house with a man servant makes the far fuel run', () => {
    let serv = 0, boys = 0;
    for (const d of [21, 181, 301]) for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (!resident(pid, d)) continue; const H = P.households[P.home(pid, d)], mem = P.membersOn(H.id, d);
      const estate = mem.some((x: number) => P.persons[x].job === 'steward');
      if (p.job === 'servant' && !estate && !p.work.startsWith('estate:')) { serv++; expect((P.plan(pid, d) as Seg[]).some(s => /estate/.test(s.why)), `${pid} d${d}`).toBe(false); }
      if (p.job === 'child' && p.sex === 'm' && mem.some((x: number) => P.persons[x].job === 'servant' && P.persons[x].sex === 'm' && P.ageOn(x, d) >= 14 && !P.sick(x, d))) { boys++;
        expect((P.plan(pid, d) as Seg[]).some(s => /gathering dung and brushwood for the fire/.test(s.why)), `${pid} d${d}`).toBe(false); } }
    expect(serv).toBeGreaterThan(100); expect(boys).toBeGreaterThan(20);
    let waterers = 0; for (let h = 0; h < P.households.length; h++) { if (P.households[h].zone !== 'town') continue; const mem = P.membersOn(h, 21); if (!mem.some((x: number) => P.persons[x].job === 'servant' && !P.sick(x, 21))) continue; const w = P.hday(h, 21).waterer; if (w >= 0 && P.persons[w].job === 'servant') waterers++; }
    expect(waterers).toBeGreaterThan(20);
  }, 300_000);
  it('some sons of 12-13 of the town\'s craftsmen, scribes, gardeners and storekeepers spend the day\'s work at their father\'s side, with him', () => {
    let days = 0;
    for (const d of [30, 90, 150, 210]) for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (p.job !== 'child' || p.sex !== 'm' || !resident(pid, d)) continue; const a = P.ageOn(pid, d); if (a < 12 || a > 13) continue;
      const segs: Seg[] = P.plan(pid, d); const w = segs.filter(s => /beside his father|helping his father|with his father at his work/.test(s.why)); if (!w.length) continue; days++;
      for (const s of w) { expect(s.with).toBeDefined(); const f = segAt(P.plan(s.with!, d), (s.t0 + s.t1) / 2); expect(f.place, `${pid} d${d}`).toBe(s.place); } }
    expect(days).toBeGreaterThan(10);
  }, 300_000);
});

describe('S8 (A), S7 and S8 (B): labels', () => {
  it('"(the household eats later)" only when someone of the house is at home at its breakfast', () => {
    let n = 0; for (const d of [21, 181, 301]) for (let pid = 0; pid < P.persons.length; pid += 2) { if (!resident(pid, d)) continue; if (!(P.plan(pid, d) as Seg[]).some(s => /household eats later/.test(s.why))) continue; n++;
      const others = P.membersOn(P.home(pid, d), d).filter((x: number) => x !== pid); expect(others.some((x: number) => (P.plan(x, d) as Seg[]).some(s => s.act === 'eat' && s.place === P.households[P.home(pid, d)].home && s.t0 < 11)), `${pid} d${d}`).toBe(true); }
    expect(n).toBeGreaterThan(500);
  }, 300_000);
  it('the shadow tool\'s household line marks a member who is ill (39742\'s mother on Abu 30)', async () => {
    const T = await import('../tools/shadow_days'); const r = T.populationDay(sim, W, 39742, 147); expect(r.head[1]).toMatch(/39738 homemaker f32 \(ill today\)/);
  });
});

describe('S9 (A), S8 (B): names', () => {
  it('no attested name goes to more than a quarter of the Egyptian men; Egyptian women are named; a pool of eight or more stays its own', () => {
    const c = new Map<string, number>(); let men = 0, women = 0, named = 0;
    for (const p of P.persons) { if (p.origin !== 'Egyptian' || p.agent >= 0) continue; const n = nameFor(1, p); if (p.sex === 'm') { men++; if (n) c.set(n, (c.get(n) ?? 0) + 1); } else { women++; if (n) named++; } }
    expect(men).toBeGreaterThan(200); expect(Math.max(...c.values()) / men).toBeLessThan(0.25); expect(named).toBe(women);
    const bab = new Set(P.persons.filter((p: any) => p.origin === 'Babylonian' && p.sex === 'm' && p.agent < 0).map((p: any) => nameFor(1, p))); expect(bab.size).toBeGreaterThanOrEqual(THIN_NAME_POOL); expect(bab.size).toBeLessThanOrEqual(16);
  });
});

describe('S10 (A): the sun', () => {
  it('sunrise and sunset are the apparent sun\'s (h0 = -0.833°, the ephemeris of 467 BCE): within 1.5 min of astronomy-engine\'s own rise and set, and 3-7 min wider than the geometric sun', () => {
    const obs = new A.Observer(LATITUDE_N, LONGITUDE_E, 0);
    for (const d of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) { const jd0 = CAL.months[0].jdn + d - 0.5 - LONGITUDE_E / 15 / 24; // local midnight, UT
      const tr = A.SearchRiseSet(A.Body.Sun, obs, +1, A.MakeTime(jd0 - 2451545), 1)!, ts = A.SearchRiseSet(A.Body.Sun, obs, -1, A.MakeTime(jd0 - 2451545), 1)!;
      const rise = (A.HourAngle(A.Body.Sun, tr, obs) + 12) % 24, set = (A.HourAngle(A.Body.Sun, ts, obs) + 12) % 24, S = sunTimes(d);
      expect(Math.abs(S.rise - rise) * 60, `day ${d} rise`).toBeLessThan(1.5); expect(Math.abs(S.set - set) * 60, `day ${d} set`).toBeLessThan(1.5);
      // the old geometric sun (centre on the horizon, today's obliquity): the apparent day is 6-14 min longer
      const doy = 102 + d, dec = -23.44 * Math.PI / 180 * Math.cos(2 * Math.PI * (doy + 10) / 365), lat = LATITUDE_N * Math.PI / 180, h = Math.acos(-Math.tan(lat) * Math.tan(dec)) * 12 / Math.PI;
      const wider = ((S.set - S.rise) - 2 * h) * 60; expect(wider, `day ${d}`).toBeGreaterThan(4); expect(wider).toBeLessThan(16); }
  });
});

describe('S7 (B): the detailed tier\'s words', () => {
  it('#116 Dadda\'s first load on Nisanu 17 is not "the next load"; a camp woman who finds no sack to carry sets none down', () => {
    const s = new PeopleSim(1, nav(), env); for (const a of s.agents) a.lod = 'abstract'; s.jumpTo(16 * 24); const a = s.agents[116]; const whys: string[] = [];
    while (s.t < 16 * 24 + 12) { s.step(20); if (a.task && whys[whys.length - 1] !== a.task.why) whys.push(a.task.why); }
    const i = whys.findIndex(w => /load/.test(w)); expect(i).toBeGreaterThanOrEqual(0); expect(whys[i]).not.toMatch(/the next load/);
  }, 120_000);
});

describe('session 6 additions (D-175): the minor findings behind the 4s', () => {
  it('nobody goes to the well in the dark of the morning: every morning draw begins at first light (sunrise - 0.45 h) or later (A: #123 drew water 77 min before sunrise)', () => {
    let n = 0; for (const d of [21, 101, 181, 261, 341]) { const { rise } = P.cal.ctx(d).sun;
      for (let pid = d % 3; pid < P.persons.length; pid += 3) { if (!resident(pid, d)) continue;
        for (const s of P.plan(pid, d) as Seg[]) if (s.act === 'draw_water' && s.t0 < 12) { n++; expect(s.t0, `${pid} d${d} ${s.why}`).toBeGreaterThanOrEqual(rise - 0.45 - 1e-6); } } }
    expect(n).toBeGreaterThan(10_000);
  }, 300_000);
  it('a little one fed with the house\'s minder at the household\'s hour is not fed again at the mother\'s later meal (no two meals within an hour)', () => {
    let n = 0; for (const d of [21, 101, 181, 261, 341]) for (let pid = d % 2; pid < P.persons.length; pid += 2) { const p = P.persons[pid]; if (p.job !== 'child' || !resident(pid, d)) continue; const a = P.ageOn(pid, d); if (a < 1 || a > 4) continue; n++;
      const e = (P.plan(pid, d) as Seg[]).filter(s => s.act === 'eat' && !/nursed|softened/.test(s.why));
      for (let i = 1; i < e.length; i++) if (e[i].why !== e[i - 1].why) expect(e[i].t0 - e[i - 1].t1, `${pid} d${d} ${e[i - 1].why} / ${e[i].why}`).toBeGreaterThanOrEqual(1 - 1e-6); }
    expect(n).toBeGreaterThan(10_000);
  }, 300_000);
  it('a town house\'s servant eats the morning bread with the house and kneads, washes, fetches fuel and runs its errand once a day at most', () => {
    let n = 0; for (const d of [21, 101, 181, 261, 341]) for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (p.job !== 'servant' || !resident(pid, d) || P.sick(pid, d) || p.work.startsWith('estate:')) continue;
      if (P.membersOn(P.home(pid, d), d).some((x: number) => P.persons[x].job === 'steward')) continue; n++; const segs: Seg[] = P.plan(pid, d);
      expect(segs.some(s => /before leaving/.test(s.why)), `${pid} d${d}`).toBe(false);
      // (spells counted as runs: the meal safety net's bread may split one spell in two)
      const runs = segs.filter(s => s.act !== 'eat').filter((s, i, xs) => i === 0 || xs[i - 1].why !== s.why);
      for (const w of ['kneading the household’s dough', 'washing the household’s clothes at the water', 'gathering dung and brushwood for the house', 'on an errand for the household in the lane']) expect(runs.filter(s => s.why === w).length, `${pid} d${d} ${w}`).toBeLessThanOrEqual(1); }
    expect(n).toBeGreaterThan(200);
  }, 300_000);
  it('some sons of ten or more of the town\'s scribes, storekeepers and craftsmen practise the father\'s work at home; an old woman\'s "little grinding" is once a day', () => {
    let learn = 0, elders = 0; for (const d of [21, 101, 181, 261, 341]) for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (!resident(pid, d)) continue;
      if (p.job === 'child' && p.sex === 'm' && P.ageOn(pid, d) >= 10 && (P.plan(pid, d) as Seg[]).some(s => /as his father taught him|father’s craft in the house|tallies and the signs/.test(s.why))) learn++;
      if (p.job === 'elder' && p.sex === 'f') { elders++; expect((P.plan(pid, d) as Seg[]).filter(s => /a little grinding/.test(s.why)).length, `${pid} d${d}`).toBeLessThanOrEqual(1); } }
    expect(learn).toBeGreaterThan(50); expect(elders).toBeGreaterThan(3000);
  }, 300_000);
  it('the detailed tier walks at 0.7 of its pace while the dust is in the air (W-03), and at its own pace otherwise', () => {
    let dd = -1; for (let d = 0; d < 354 && dd < 0; d++) if (sim.cal.ctx(d).wx.dustH) dd = d; expect(dd).toBeGreaterThanOrEqual(0);
    const s = new PeopleSim(1, nav(), env); const dh = s.cal.ctx(dd).wx.dustH!; s.jumpTo(dd * 24 + (dh[0] + dh[1]) / 2); expect(s.dustF()).toBe(0.7);
    s.jumpTo(dd * 24 + Math.max(0.1, dh[0] - 1)); expect(s.dustF()).toBe(1);
  }, 120_000);
  it('every village of the plain holds 150-3,000 people all year (PLAIN.md §4; B S8 and A\'s recurrence table: v_35 held 8,491, more than the town)', () => {
    for (const d of [0, 101, 353]) { const n = new Map<string, number>(); for (let pid = 0; pid < P.persons.length; pid++) { if (!P.present(pid, d)) continue; const H = P.households[P.home(pid, d)]; if (H.zone === 'plain') n.set(H.q, (n.get(H.q) ?? 0) + 1); }
      expect(n.size).toBe(39); for (const [q, k] of n) { expect(k, `${q} d${d}`).toBeLessThanOrEqual(3000); expect(k, `${q} d${d}`).toBeGreaterThanOrEqual(150); } }
  }, 120_000);
  it('the round-6 pick (seed 1, pick seed 113) holds the cases both round-5 reviewers asked for, each on a day that shows it', () => {
    const S = pickSample(P, sim, 113); expect(S.detailed.length + S.population.length).toBe(20);
    expect(S.detailed.some(x => /leader of ten/.test(x.stratum))).toBe(true);
    for (const re of [/rain in daylight/, /birthday/, /under four months/, /herder/, /traveller or a messenger/, /grain heap/]) expect(S.population.some(x => re.test(x.stratum)), `${re}`).toBe(true);
    const bb = S.population.find(x => /under four months/.test(x.stratum))!; expect(P.ageDays(bb.pid, bb.day)).toBeLessThan(120);
    const ch = S.population.find(x => /birthday/.test(x.stratum))!; expect([1, 5, 8]).toContain(P.ageOn(ch.pid, ch.day)); expect(P.ageOn(ch.pid, ch.day)).toBe(P.persons[ch.pid].age + 1);
    const vg = S.population.find(x => /grain heap/.test(x.stratum))!; expect(P.vigilMan(P.home(vg.pid, vg.day), vg.day)).toBe(vg.pid);
  }, 300_000);
});
