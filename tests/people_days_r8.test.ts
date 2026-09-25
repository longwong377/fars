// Phase 5 shadow review round 7 (REVIEWS/shadow_phase5_r7.md, reviewer A; REVIEWS/shadow_phase5_r7_b.md, reviewer B; D-191):
// the two blocking findings, the year-wide invariants of planCheck (a)-(f) that replace finding faults one at a time, and
// the minor findings.
//  S1 (A, B) the season's roof chore in the rain and the storm, and "before the rains" after them; S2 (A) the Terrace gangs
//  idle at the stair foot before the ration issue opens; (a)-(f) weather, light, waits, labels, feeds, dress; A S3-S7 and
//  B S2-S11.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { type Seg, wetHours, dayStorm, nameFor } from '../src/people/population';
import { checkPlan, invariants, WAIT_CAP_H } from '../src/people/planCheck';
import { WeatherSystem } from '../src/weather/weatherState';
import namesData from '../src/data/names.json';
import namesRecalled from '../src/data/names_recalled.json';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
let sim: PeopleSim; let P: any;
beforeAll(() => { sim = new PeopleSim(1, nav(), env); P = (sim as any).pop; });
const INV = ['weather', 'light', 'wait', 'label', 'feed', 'dress'];

describe('S1 (A, B): the roof in the weather', () => {
  it('year-wide: no roof chore overlaps rain or a storm, and none is "before the rains" once they have come (was 6,692 person-days in the rain, 61,748 labelled after the first rain)', () => {
    const men = P.persons.filter((p: any) => p.job === 'farmer' && p.sex === 'm').map((p: any) => p.id); let roof = 0, after = 0;
    for (let d = 150; d < 240; d++) { const C = P.cal.ctx(d); if (![6, 7].includes(C.month)) continue;
      for (const pid of men.filter((_: number, i: number) => i % 3 === d % 3)) { if (!P.present(pid, d)) continue;
        for (const s of P.plan(pid, d) as Seg[]) { if (!/roof/.test(s.why)) continue; roof++;
          expect(wetHours(C.wx, s.t0, s.t1), `${pid} d${d} ${s.t0.toFixed(2)} ${s.why}`).toBe(0);
          if (C.firstRain) { after++; expect(s.why, `${pid} d${d}`).not.toMatch(/before the rains/); } } } }
    expect(roof).toBeGreaterThan(5000); expect(after).toBeGreaterThan(500);
  }, 600_000);
  it('42388 on Tashritu 8 (day 185, the first rain, storm 07:15-11:45) is not on the roof in the storm, and his father is not either', () => {
    const d = 184, C = P.cal.ctx(d); expect(C.firstRain).toBe(true); expect(dayStorm(C)).toBe(true);
    for (const pid of P.membersOn(P.home(42388, d), d)) for (const s of P.plan(pid, d) as Seg[]) if (/roof/.test(s.why)) { expect(wetHours(C.wx, s.t0, s.t1), `${pid} ${s.t0}`).toBe(0); expect(s.why).not.toMatch(/before the rains/); }
  }, 120_000);
});

describe('S2 (A): the ration issue', () => {
  it('year-wide: on its issue day a Terrace worker queues at the depot after the issue opens, for no more than WAIT_CAP_H, and works before it (was 9,083 person-days, a mean 1.98 h and at most 5.40 h idle before the issue)', () => {
    let n = 0, worked = 0, early = 0;
    for (let d = 0; d < 354; d++) { const C = P.cal.ctx(d); if (!C.issue.size) continue;
      for (const pid of P.persons.filter((p: any, i: number) => ['builder', 'porter', 'camp', 'treasury', 'caretaker'].includes(p.job) && i % 4 === d % 4).map((p: any) => p.id)) {
        const h = C.issue.get(P.persons[pid].group); if (h === undefined || !P.present(pid, d)) continue; const segs: Seg[] = P.plan(pid, d);
        const q = segs.filter(s => s.act === 'queue' && /ration/.test(s.why)); if (!q.length) continue; n++;
        let run = 0, prevEnd = -1; for (const s of q) { run = Math.abs(s.t0 - prevEnd) < 1e-6 ? run + s.t1 - s.t0 : s.t1 - s.t0; prevEnd = s.t1; expect(run, `${pid} d${d}`).toBeLessThanOrEqual(WAIT_CAP_H + 1e-6); }
        expect(q[0].t0, `${pid} d${d} issue ${h.toFixed(2)}`).toBeGreaterThanOrEqual(h - 0.25); // (a few minutes early at the depot)
        const up = segs.find(s => s.where === 'terrace'); if (!up || h - up.t0 < 0.75) continue; early++; // (on the Terrace an hour or so before the issue opens: at work until then)
        if (segs.some(s => s.where === 'terrace' && s.t1 <= q[0].t0 + 1e-6 && !['queue', 'eat', 'rest', 'walk', 'shelter'].includes(s.act))) worked++; } }
    expect(n).toBeGreaterThan(1500); expect(early).toBeGreaterThan(300); expect(worked / early).toBeGreaterThan(0.9);
  }, 600_000);
  it('#114 Akšer (person 1287) on Ululu 3 (day 151) carries loads before the queue, and 2036 on Duzu 5 (day 94) goes to the store for the issue hour, not at first light', () => {
    const d = 150, h = P.cal.ctx(d).issue.get(P.persons[1287].group); const g: Seg[] = P.plan(1287, d);
    const q0 = g.find(s => s.act === 'queue' && /ration/.test(s.why))!; expect(q0.t0).toBeGreaterThanOrEqual(h - 0.25); expect(g.filter(s => s.act === 'queue').reduce((a, s) => a + s.t1 - s.t0, 0)).toBeLessThanOrEqual(WAIT_CAP_H);
    expect(g.some(s => s.t1 <= q0.t0 && s.where === 'terrace' && s.act !== 'queue')).toBe(true);
    const d2 = 93, h2 = P.cal.ctx(d2).issue.get(P.persons[2036].group); const k: Seg[] = P.plan(2036, d2); const pre = k.filter(s => /waiting for the ration issue/.test(s.why)).reduce((a, s) => a + s.t1 - s.t0, 0);
    expect(h2).toBeDefined(); expect(pre).toBeLessThan(0.15); expect(k.filter(s => s.act === 'queue').reduce((a, s) => a + s.t1 - s.t0, 0)).toBeLessThanOrEqual(WAIT_CAP_H);
  }, 120_000);
});

describe('the year-wide invariants (planCheck (a)-(f))', () => {
  it('each finds its own fault in a made-up day (not vacuous)', () => {
    const d = 184, C = P.cal.ctx(d), pid = 42388, home = P.households[P.home(pid, d)].home; const base: Seg = { t0: 0, t1: 24, place: home, act: 'sleep', why: 'asleep', where: 'plain' };
    const kinds = (segs: Seg[], dd = d, who = pid) => invariants(P, who, dd, segs).map(x => x.kind);
    const r = C.wx.stormH!; // (a) the roof in the storm
    expect(kinds([{ ...base, t1: r[0] }, { ...base, t0: r[0], t1: r[0] + 1, act: 'craft', why: 'plastering the roof with mud and straw before the rains' }, { ...base, t0: r[0] + 1 }])).toEqual(expect.arrayContaining(['weather', 'label']));
    const set = C.sun.set; // (b) knucklebones in the lane after dusk
    expect(kinds([{ ...base, t1: set }, { ...base, t0: set, t1: set + 1.5, place: 'lane:v_01', act: 'gamble', why: 'knucklebones with neighbours' }, { ...base, t0: set + 1.5 }])).toContain('light');
    // (c) an hour in the queue
    expect(kinds([{ ...base, t1: 8 }, { ...base, t0: 8, t1: 9, place: 'store_town', act: 'queue', why: 'in the queue for the monthly ration', where: 'town' }, { ...base, t0: 9 }])).toContain('wait');
    // (e) a baby's night gap: its mother
    const mom = P.persons.find((p: any) => P.nurslings(p.id, 327).some((c: number) => P.ageOn(c, 327) === 0 && P.persons[c].born !== 327))!.id;
    const g: Seg[] = [{ ...base, place: 'h:x', t1: 1 }, { ...base, place: 'h:x', t0: 1, t1: 1.2, act: 'rest', why: 'nursing the baby in the night' }, { ...base, place: 'h:x', t0: 1.2, t1: 6.5 }, { ...base, place: 'h:x', t0: 6.5, t1: 6.7, act: 'rest', why: 'nursing the baby' }, { ...base, place: 'h:x', t0: 6.7 }];
    expect(kinds(g, 327, mom)).toContain('feed');
    // (f) out in the cold with no dress: a cold morning
    const cd = [...Array(354).keys()].find(x => Math.max(...P.cal.ctx(x).wx.tempQ.slice(20, 30)) < 5)!;
    expect(kinds([{ ...base, t1: 5 }, { ...base, t0: 5, t1: 7.5, place: 'field:1:0', act: 'field_work', why: 'hoeing' }, { ...base, t0: 7.5 }], cd)).toContain('dress');
  }, 120_000);
  it('a sample of everyone (every 97th person, every day of the year) has none of the six kinds of fault', () => {
    const found: Record<string, string[]> = {}; let n = 0;
    for (let pid = 5; pid < P.persons.length; pid += 97) { let prev: Seg[] | null = null, pd = -9;
      for (let d = 0; d < 354; d++) { if (!P.present(pid, d)) continue; const segs: Seg[] = P.plan(pid, d); n++;
        for (const x of checkPlan(P, pid, d, segs, pd === d - 1 && prev ? prev[prev.length - 1].place : null, pd === d - 1 ? prev : null)) if (INV.includes(x.kind)) (found[x.kind] ??= []).push(`${pid} d${d}: ${x.note}`);
        prev = segs; pd = d; } }
    expect(n).toBeGreaterThan(120_000); expect(found).toEqual({});
  }, 900_000);
});

describe('minor findings', () => {
  it('A S3: #8 (person 25) goes down to his family on Simanu 7 (day 66), his son ill; the post in the heat has its water jar', () => {
    const g: Seg[] = P.plan(25, 65); expect(g.some(s => s.where === 'town')).toBe(true);
    expect(g.filter(s => s.act === 'stand_guard' && s.t0 < 15 && s.t1 > 11).every(s => /water jar/.test(s.carry ?? ''))).toBe(true);
  }, 120_000);
  it('A S4: 46220 is fed at night no more than 3.5 h apart (was 4 h 51 min)', () => {
    const d = 327, m = P.persons[46220].mother; const fs = [...(P.plan(m, d - 1) as Seg[]).filter(s => /nurs/.test(s.why)).map(s => [s.t0 - 24, s.t1 - 24]), ...(P.plan(m, d) as Seg[]).filter(s => /nurs/.test(s.why)).map(s => [s.t0, s.t1])];
    for (let i = 1; i < fs.length; i++) expect(fs[i][0] - fs[i - 1][1], `${fs[i - 1][1].toFixed(2)}-${fs[i][0].toFixed(2)}`).toBeLessThanOrEqual(3.5 + 1e-6);
  }, 120_000);
  it('A S5, B S10: on Kislimu 6 (day 242, rain from 15:00) the ploughing and sowing go on in the dry morning, and no one eats at the field in the rain', () => {
    const C = P.cal.ctx(241); expect(C.agri.has('E-40')).toBe(true);
    expect(P.membersOn(P.home(28957, 241), 241).some((x: number) => (P.plan(x, 241) as Seg[]).some(s => /^(plough|field_work)$/.test(s.act) && s.t1 <= 15.25))).toBe(true);
    for (const d of [241, 353]) { const wx = P.cal.ctx(d).wx; for (let pid = 0; pid < P.persons.length; pid += 7) { if (!P.present(pid, d)) continue; for (const s of P.plan(pid, d) as Seg[]) if (s.act === 'eat' && /^(field:|canal:|orchard:|vineyard:|garden:)/.test(s.place)) expect(wetHours(wx, s.t0, s.t1), `${pid} d${d} ${s.t0.toFixed(2)}`).toBeLessThanOrEqual(0.25); } }
  }, 300_000);
  it('A S6, B S6: the flock is let out and counted in the light (44293 on Tashritu 4, day 181, was 62 min before sunrise)', () => {
    for (let d = 175; d < 200; d++) { const rise = P.cal.ctx(d).sun.rise; for (const p of P.persons.filter((q: any) => q.job === 'herder')) { if (!P.present(p.id, d)) continue;
      for (const s of P.plan(p.id, d) as Seg[]) if (/letting the flock out|milking the ewes and the goats at first light/.test(s.why)) expect(s.t0, `${p.id} d${d}`).toBeGreaterThanOrEqual(rise - 0.45); } }
  }, 300_000);
  it('A S7, B S9: words that fit the day (the traveller\'s walk, the courier\'s mending, the storekeeper\'s store, a short sleep in the heat)', () => {
    const t: Seg[] = P.plan(43314, 69); expect(t.some(s => s.why === 'on the day’s business' && /lane:/.test(t[t.indexOf(s) + 1]?.place ?? ''))).toBe(false);
    let courier = 0; for (const p of P.persons.filter((q: any) => q.job === 'messenger').slice(0, 40)) for (let d = 0; d < 354; d += 5) if (P.present(p.id, d)) for (const s of P.plan(p.id, d) as Seg[]) { expect(s.why).not.toBe('mending tools and baskets'); if (/harness and the saddle-bags/.test(s.why)) courier++; }
    expect(courier).toBeGreaterThan(0);
    for (let d = 0; d < 354; d += 3) for (const s of P.plan(2668, d) as Seg[]) expect(s.why).not.toMatch(/^stacking/);
    for (let pid = 3; pid < P.persons.length; pid += 131) for (let d = 0; d < 354; d += 4) { if (!P.present(pid, d)) continue; const g: Seg[] = P.plan(pid, d); g.forEach(s => { if (/^sleeping through the heat/.test(s.why)) expect(s.t1 - s.t0 >= 0.75 || g.some(x => x !== s && x.place === s.place && /through the heat/.test(x.why)), `${pid} d${d}`).toBe(true); }); }
  }, 300_000);
  it('B S4: children under five go to sleep after dark (39196 on Kislimu 18, day 254, and 3003 on Tebetu 9, day 275)', () => {
    for (const [pid, d] of [[39196, 253], [3003, 274]]) { const set = P.cal.ctx(d).sun.set; const g: Seg[] = P.plan(pid, d); const bed = g.find(s => s.t0 > 17 && s.act === 'sleep' && s.t1 >= 23.99)!;
      expect(bed.t0, `${pid}`).toBeGreaterThanOrEqual(set + 0.6 - 1e-6); }
  }, 120_000);
  it('B S5: no child under seven plays by the water with no one (17959 on Shabatu 22, day 317)', () => {
    for (let d = 0; d < 354; d += 2) for (const p of P.persons.filter((q: any, i: number) => q.job === 'child' && i % 5 === 0)) { if (!P.present(p.id, d) || P.ageOn(p.id, d) >= 7) continue;
      for (const s of P.plan(p.id, d) as Seg[]) if (/^playing by the (canal|garden channels)/.test(s.why)) expect(s.with, `${p.id} d${d}`).toBeDefined(); }
  }, 300_000);
  it('B S7: a guard does not go down to the same quarter twice within two hours (#30 on Shabatu 30, day 325: the lanes and the practice ground in q_lt_e); the practice ground is in the lower town', () => {
    const quarter = (pl: string) => pl.includes(':') ? (pl.split(':')[1].startsWith('q_') ? pl.split(':')[1] : pl) : pl;
    for (const pid of P.garrison.slice(0, 120)) for (let d = 0; d < 354; d += 3) { if (!P.present(pid, d)) continue; const g: Seg[] = P.plan(pid, d); let lastUp = -9, lastQ = '';
      for (let i = 0; i < g.length; i++) { const s = g[i]; if (s.place === 'road:town' && g[i - 1]?.where === 'terrace') { const q = quarter(g[i + 1]?.place ?? ''); if (q === lastQ) expect(s.t0 - lastUp, `${pid} d${d} ${s.t0.toFixed(2)}`).toBeGreaterThanOrEqual(2 - 1e-6); }
        if (s.place === 'road:terrace' && g[i + 1]?.where === 'terrace') { lastUp = s.t1; let j = i - 1; while (j > 0 && g[j].where === 'road') j--; lastQ = quarter(g[j]?.place ?? ''); }
        expect(s.why).not.toMatch(/practice ground below the Terrace/); } }
  }, 300_000);
  it('B S11: a herder child under seven rides after the midday halt on a moving day (44627 on Addaru 3, day 328)', () => {
    // (D-196: on this arrival day the families now reach the first camp before midday; the child walks ≤ 4.5 h in all)
    const g: Seg[] = P.plan(44627, 327); expect(P.ageOn(44627, 327)).toBeLessThan(7);
    expect(g.filter(s => s.where === 'road' && s.act === 'walk').reduce((a, s) => a + s.t1 - s.t0, 0)).toBeLessThanOrEqual(4.5);
    expect(g.filter(s => s.where === 'road' && s.t0 >= 11.9).every(s => s.act !== 'walk')).toBe(true);
  }, 120_000);
});

describe('D-193: the names from licensed evidence only (D-192, Q-294)', () => {
  it('every name in names.json cites a PF or PT text from a source whose licence is recorded; none rests on EWB', () => {
    const N = namesData as any, lic = new Map((N._meta.source as any[]).map(x => [x.id, x.licence]));
    expect(N.names.length).toBeGreaterThan(90);
    for (const n of N.names) { expect(n.source, n.name).not.toBe('EWB'); expect(n.ewb, n.name).toBeUndefined(); expect(lic.get(n.source), `${n.name}: ${n.source}`).toBeTruthy();
      expect(n.texts.length, n.name).toBeGreaterThan(0); for (const t of n.texts) expect(t, n.name).toMatch(/^(PF|PT) \d+( \(P\d+\))?$/);
      if (n.source === 'CDLI') expect(n.texts.every((t: string) => / \(P\d+\)$/.test(t)), n.name).toBe(true); }
    expect(JSON.stringify(N.names)).not.toMatch(/EWB|ALP-MEGA/);
  });
  it('D-202: the licensed evidence holds no woman\'s name, so women draw on names recalled from the published literature (C, each with its attestation); the named detailed agents carry their texts or the recalled attestation', () => {
    for (const a of sim.agents) { if (!a.name) continue; expect(a.nameNote, a.name).toMatch(/^(attested (PF|PT) \d+|(recalled attestation \(C, not seen\)|reconstructed name \(C, not attested\)): .+)/); }
    const R = (namesRecalled as any).names; for (const n of R) { expect(n.attestation, n.name).toBeTruthy(); expect(n.tier, n.name).toMatch(/^C /); expect(['RECOLLECTION', 'RECONSTRUCTED']).toContain(n.source); if (n.source === 'RECONSTRUCTED') expect(n.name.startsWith('*'), n.name).toBe(true); }
    expect((namesData as any).names.some((n: any) => n.sex === 'f')).toBe(false); // (names.json itself stays the licensed evidence)
    const women = P.persons.filter((p: any) => p.sex === 'f' && p.agent < 0).slice(0, 2000), rec = new Set(R.map((n: any) => n.name));
    expect(women.every((p: any) => { const n = nameFor(1, p); return n === null || rec.has(n); })).toBe(true);
    expect(women.filter((p: any) => nameFor(1, p)).length / women.length).toBeGreaterThan(0.95);
  });
});
