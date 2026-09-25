// D-209: the probable religious life of 467 around Persepolis, as action, fire, offering and wordless sound (the user's
// direction D-207). Measured here: the open-air precinct (the Pasargadae plinths' and the Naqsh-e Rustam altar's forms, its
// place clear of the town and on level ground), the kept fire, the town's burial ground; the magi's days at the fire, the
// households' sacrifices and the funerals as the plans have them, checked by planCheck; the magus's chant as the music
// system sounds it (a recitative without words, and nothing else at an offering); where the population's places put them.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { SACRIFICE, type Seg } from '../src/people/population';
import { checkPlan } from '../src/people/planCheck';
import { WeatherSystem } from '../src/weather/weatherState';
import { buildTownPlan } from '../src/world/settlement/plan';
import { PRECINCT, ALTAR_H, ALTAR_SPOT, BURIAL, PRECINCT_FIRE, precinctAt } from '../src/world/settlement/precinct';
import { scheduleLit } from '../src/world/fire';
import { buildTownGround, groundAt, TERRACE_BOX } from '../src/world/plain/townGround';
import { PopGeo } from '../src/people/popgeo';
import { compose, render, refusal, VOICE_SR, type Performance } from '../src/audio/music';
import { songPlan } from '../src/audio/song';
import { musicAt, soundingParts, type PopPerformer } from '../src/audio/performers';
import { performanceFor } from '../src/people/activities';
import { loadTerrain } from './plainLib';
import townJson from '../src/data/town.json';
import settlementJson from '../src/data/settlement.json';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const plan = buildTownPlan();
const FAC = Object.fromEntries((townJson as any).facilities.map((f: any) => [f.id, f.at])) as Record<string, [number, number]>;
const segD = (p: number[], a: number[], b: number[]) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); };
const lineD = (p: number[], pts: number[][]) => { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, segD(p, pts[i - 1], pts[i])); return d; };
const siteD = (p: number[]) => Math.min(...plan.sites.map(s => Math.hypot(s.frame.c[0] - p[0], s.frame.c[1] - p[1]) - Math.hypot(s.W, s.H) / 2));

describe('the open-air precinct and the burial ground (D-209)', () => {
  it('two plinths after Pasargadae (2.8 and 2.5 m square, 2 m high, 9 m apart, the S one with eight steps) and a stepped altar after the Naqsh-e Rustam reliefs; no roofed building', () => {
    const P = plan.props.filter(p => p.feature === 'sacred_precinct');
    const white = P.filter(p => p.row === 'precinct_plinths' && p.colour?.[0] === 0.8 && p.y1 - p.y0 >= 1.99);
    expect(white.map(p => +(2 * p.hu).toFixed(2)).sort()).toEqual([2.5, 2.8]); for (const p of white) expect(p.y1 - p.y0).toBeCloseTo(2, 5);
    expect(Math.hypot(white[0].c[0] - white[1].c[0], white[0].c[1] - white[1].c[1])).toBeCloseTo(9, 3);
    expect(P.filter(p => /the stair/.test(p.note))).toHaveLength(8);
    const altar = P.filter(p => p.group === 'precinct_altar' && p.shape === 'box' && p.row === 'precinct_altar' && p.mat === 'stone');
    expect(altar).toHaveLength(7); expect(Math.max(...altar.map(p => p.y1))).toBeCloseTo(ALTAR_H, 5); expect(ALTAR_H).toBeGreaterThan(1.0); expect(ALTAR_H).toBeLessThan(1.4);
    // the stepped form: widths fall to the shaft and rise again
    const hw = [...altar].sort((a, b) => a.y0 - b.y0).map(p => p.hu); expect(hw.indexOf(Math.min(...hw))).toBe(3); expect(hw[0]).toBe(hw[6]);
    for (const p of P) expect(p.note.length).toBeGreaterThan(10);
    expect(P.some(p => /roof|temple|shrine/i.test(p.note) && !/no temple/i.test(p.note))).toBe(false);
  });
  it('the fire on the altar is kept: lit at every hour, in rain too; it stands at the altar\'s top', () => {
    expect(plan.fires?.length).toBe(1); expect(plan.fires![0].sched).toBe('kept'); expect(PRECINCT_FIRE.y).toBeCloseTo(ALTAR_H + 0.03, 5);
    for (let h = 0; h < 24; h += 0.5) expect(scheduleLit('kept', h, 30 * Math.sin(((h - 6) / 12) * Math.PI), 42)).toBe(true);
  });
  it('the precinct stands on level ground at the mountain\'s foot, clear of the Terrace, the town\'s sites, the roads and the canal', () => {
    const T = loadTerrain(), H = (e: number, n: number) => T.heightAt(e, -n), c = PRECINCT.c;
    let lo = Infinity, hi = -Infinity; for (let n = -15; n <= 15; n += 5) for (let e = -12; e <= 14; e += 2) { const [x, y] = precinctAt(n, e); const h = H(x, y); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    expect((hi - lo) / 30, 'slope over the precinct').toBeLessThan(0.08);
    const plainW = H(c[0] - 400, c[1]); expect(H(c[0], c[1]) - plainW).toBeGreaterThan(5); // above the plain W of it
    expect(siteD(c)).toBeGreaterThan(300);
    for (const f of (settlementJson as any).features.filter((x: any) => x.present_467 && x.kind === 'road')) expect(lineD(c, f.polyline), f.id).toBeGreaterThan(250);
    expect(lineD(c, (settlementJson as any).features.find((x: any) => x.id === 'canal_kuh_e_rahmat').polyline)).toBeGreaterThan(300);
    expect(c[1] < TERRACE_BOX.n0 - 150).toBe(true);
    expect(FAC.offering_place).toEqual(c);
  });
  it('the burial ground: 140 graves outside the town, not tilled, clear of the roads', () => {
    const g = plan.middens.filter(m => m.kind === 'grave'); expect(g).toHaveLength(BURIAL.graves);
    for (const m of g) { expect(Math.abs(m.c[0] - BURIAL.c[0])).toBeLessThanOrEqual(BURIAL.half[0]); expect(Math.abs(m.c[1] - BURIAL.c[1])).toBeLessThanOrEqual(BURIAL.half[1]); }
    expect(siteD(BURIAL.c)).toBeGreaterThan(150); expect(FAC.outside).toEqual(BURIAL.c);
    for (const f of (settlementJson as any).features.filter((x: any) => x.present_467 && x.kind === 'road')) expect(lineD(BURIAL.c, f.polyline), f.id).toBeGreaterThan(300);
    const G = buildTownGround(plan); expect(groundAt(G, BURIAL.c[0], BURIAL.c[1])[2]).toBe(0); expect(groundAt(G, PRECINCT.c[0], PRECINCT.c[1])[2]).toBe(0);
  }, 120_000);
});

describe('the magi, the sacrifices and the funerals in the plans (D-209)', () => {
  let P: any;
  beforeAll(() => { const sim = new PeopleSim(1, nav(), env); P = (sim as any).pop; }, 120_000);
  it('every day a magus feeds the fire before first light and banks it at dusk, and the lan is made (or put off by the rain)', () => {
    let lan = 0, off = 0;
    for (let d = 0; d < 354; d++) { const C = P.cal.ctx(d), duty = P.priests.find((m: number) => P.persons[m].idx === d % 3);
      if (!P.present(duty, d) || P.sick(duty, d) || P.mourning(duty, d)) continue;
      const g: Seg[] = P.plan(duty, d);
      expect(g.some(s => s.act === 'tend_fire' && s.t0 < C.sun.rise), `d${d} dawn`).toBe(true);
      expect(g.some(s => s.act === 'tend_fire' && s.t1 > C.sun.set - 0.3 && s.t0 < C.sun.set + 0.5), `d${d} dusk`).toBe(true);
      if (g.some(s => s.act === 'offer' && /^the lan/.test(s.why))) lan++; else { expect(g.some(s => /lan put off/.test(s.why)), `d${d}`).toBe(true); off++; } }
    expect(lan).toBeGreaterThan(300); expect(off).toBeLessThan(30);
  }, 120_000);
  it('the households\' sacrifices: 120-300 a year; the offerer and his magus at the precinct together, the beast led there, the meat boiled and carried home, the magus chanting over it', () => {
    let n = 0;
    for (let d = 0; d < 354; d++) for (const s of P.cal.ctx(d).sacrifices) { n++;
      const o: Seg[] = P.plan(s.offerer, d), m: Seg[] = P.plan(s.magus, d);
      expect(o.some(x => x.where === 'road' && /leading a (sheep|goat)/.test(x.why))).toBe(true);
      expect(o.some(x => x.act === 'cut_offering') && o.some(x => x.act === 'cook' && /meat of the offering/.test(x.why))).toBe(true);
      expect(o.some(x => x.act === 'carry_bread' && /meat of the offering home/.test(x.why))).toBe(true);
      const ch = m.find(x => x.act === 'chant' && x.t0 >= s.t && x.t0 < s.t + SACRIFICE.h + 0.1)!; expect(ch, `d${d} ${s.magus}`).toBeTruthy();
      const by = o.find(x => x.act === 'sacrifice' && /while the magus chants/.test(x.why))!; expect(Math.abs(by.t0 - ch.t0)).toBeLessThan(0.02); expect(by.place).toBe(ch.place);
      expect(['Persian', 'Median']).toContain(P.persons[s.offerer].origin); }
    expect(n).toBeGreaterThanOrEqual(120); expect(n).toBeLessThanOrEqual(300);
  }, 180_000);
  it('the magi\'s and the offerers\' days pass planCheck (the year)', () => {
    const bad: string[] = [];
    for (let d = 0; d < 354; d++) { const who = new Set<number>([...P.priests, ...P.cal.ctx(d).sacrifices.map((s: any) => s.offerer)]);
      for (const pid of who) { if (!P.present(pid, d)) continue; const prev = d > 0 && P.present(pid, d - 1) ? P.plan(pid, d - 1) : null;
        for (const x of checkPlan(P, pid, d, P.plan(pid, d), prev ? prev[prev.length - 1].place : null, prev)) if (bad.length < 6) bad.push(`${pid} d${d} ${x.kind}: ${x.note}`); } }
    expect(bad).toEqual([]);
  }, 180_000);
  it('a funeral in the town: the men carry the dead to the burial ground and bury it, the women mourn at the grave, at one hour; nothing of the body is shown', () => {
    let funerals = 0; const bad: string[] = [];
    for (let d = 1; d < 354; d++) for (const H of P.households) { if (H.zone !== 'town' || !H.deaths.includes(d - 1)) continue; const f = P.funeralOf(H.id, d, P.cal.ctx(d).wx, P.cal.ctx(d).sun); if (!f || f.magus) continue;
      const mem = P.membersOn(H.id, d).filter((x: number) => P.present(x, d)), plans = mem.map((x: number) => P.plan(x, d) as Seg[]);
      const bur = plans.filter((g: Seg[]) => g.some(s => s.act === 'bury')); if (!bur.length) continue; funerals++;
      for (const g of bur) { const b = g.find((s: Seg) => s.act === 'bury')!; if (b.place !== 'outside') bad.push(`h${H.id} d${d} ${b.place}`); expect(g.some((s: Seg) => s.act === 'carry_bier' && s.place === 'outside')).toBe(true); }
      for (const g of plans) { const m = g.find((s: Seg) => s.act === 'mourn' && /while the dead is buried/.test(s.why)); if (m) expect(Math.abs(m.t0 - bur[0].find((s: Seg) => s.act === 'carry_bier')!.t0)).toBeLessThan(0.35); }
      for (const g of plans) for (const x of checkPlan(P, mem[plans.indexOf(g)], d, g, null)) if (bad.length < 6 && x.kind !== 'teleport') bad.push(`${mem[plans.indexOf(g)]} d${d} ${x.kind}: ${x.note}`); }
    expect(bad).toEqual([]); expect(funerals).toBeGreaterThan(80);
    expect(performanceFor('bury', 'digging the grave and laying the dead in the earth (Herodotus 1.140)', 1).note).toMatch(/Nothing of the body is shown/);
  }, 240_000);
  it('the places: the magus at the altar facing it; an offerer and his magus side by side W of the plinths; a funeral at one grave of the burial ground', () => {
    const geo = new PopGeo({ pop: P, nav: nav(), town: plan, seed: 1 });
    const d = Array.from({ length: 354 }, (_, k) => k).find(k => P.cal.ctx(k).sacrifices.length)!, s = P.cal.ctx(d).sacrifices[0];
    const a = geo.spot(s.magus, 'offering_place:altar', 'tend_fire', d, 5); expect(Math.hypot(a.e - ALTAR_SPOT.at[0], a.n - ALTAR_SPOT.at[1])).toBeLessThan(0.01);
    const o = geo.spot(s.offerer, 'offering_place', 'sacrifice', d, s.t + 0.1), m = geo.spot(s.magus, 'offering_place', 'offer', d, s.t + 0.1);
    expect(o.ok && m.ok).toBe(true); expect(Math.hypot(o.e - m.e, o.n - m.n)).toBeLessThan(2.5);
    const dc = Math.hypot(o.e - PRECINCT.c[0], o.n - PRECINCT.c[1]); expect(dc).toBeGreaterThan(10); expect(dc).toBeLessThan(20);
    const h = P.households.find((H: any) => H.zone === 'town' && H.members.length > 2), x = h.members[0], y = h.members[1];
    const bx = geo.spot(x, 'outside', 'bury', 40, 9), by = geo.spot(y, 'outside', 'mourn', 40, 9); expect(Math.hypot(bx.e - by.e, bx.n - by.n)).toBeLessThan(7);
    expect(Math.abs(bx.e - BURIAL.c[0])).toBeLessThan(BURIAL.half[0]); expect(Math.abs(bx.n - BURIAL.c[1])).toBeLessThan(BURIAL.half[1]);
  }, 120_000);
});

describe('the magus\'s chant: wordless, alone, and the one sound at an offering (D-209; M-06, M-23)', () => {
  const chant: Performance = { id: 'c', instrument: 'voice', register: 'm', tradition: 'mesopotamian', context: 'offering', style: 'recitative', modeId: 'meso1', tempo: 170, seed: 7, claims: ['M-06', 'M-22', 'M-15', 'M-13'] };
  it('lines on one reciting tone ending on the final, a breath between them, in a man\'s low range', () => {
    const ev = compose(chant, 40), by = new Map<number, typeof ev>(); for (const e of ev) (by.get(e.phrase!) ?? by.set(e.phrase!, []).get(e.phrase!)!).push(e);
    expect(by.size).toBeGreaterThanOrEqual(3);
    for (const line of [...by.values()].slice(0, -1)) { const fs = line.map(e => e.f), rec = fs.slice(2, -2), tone = rec.sort((a, b) => fs.filter(x => x === b).length - fs.filter(x => x === a).length)[0];
      expect(fs.filter(f => Math.abs(f - tone) < 0.01).length / fs.length).toBeGreaterThan(0.4); expect(line[line.length - 1].f).toBeLessThan(tone); expect(line.length).toBeGreaterThanOrEqual(7); }
    for (const e of ev) { expect(e.f).toBeGreaterThanOrEqual(100); expect(e.f).toBeLessThan(260); }
  });
  it('no words: the voice sings vowels only (no phones), and is damped by the mouth-cover', () => {
    const ev = compose(chant, 12); expect(songPlan(ev, { register: 'm', seed: 1 }).segments).toEqual([]);
    const pcm = render(chant, ev, VOICE_SR); let rms = 0; for (const x of pcm) { expect(Number.isFinite(x)).toBe(true); rms += x * x; } expect(Math.sqrt(rms / pcm.length)).toBeGreaterThan(0.02);
  });
  it('the runtime refuses anything else at an offering; the schedule sounds a magus only while his plan says he chants', () => {
    expect(refusal(chant, false)).toBeNull();
    expect(refusal({ ...chant, instrument: 'reed_pipe' }, false)).toMatch(/only a magus chants/);
    const q = (pid: number, act: string, sex: 'm' | 'f' = 'm'): PopPerformer => ({ pid, sex, age: 45, act, why: '', place: 'offering_place', e: 0, n: 0, y: 0, moving: false, seed: pid });
    const ctx = { t: 30 * 24 + 6, seed: 1, courtToday: false, courtYesterday: false, sun: { rise: 6, set: 18 }, foul: false };
    const g = musicAt([], ctx, [q(1, 'chant'), q(2, 'offer'), q(3, 'chant', 'f'), q(4, 'sacrifice')]);
    expect(g.map(x => x.kind)).toEqual(['magus_chant']); expect(soundingParts(g[0])[0].pid).toBe(1); expect(g[0].tier).toBe('C');
  });
});
