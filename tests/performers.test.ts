// Who plays or sings, when and where (brief §11; D-178): the schedule of src/audio/performers.ts on synthetic people and
// on the simulation's own Terrace population.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { musicAt, soundingParts, piperSlot, QUERN_P, BLOCK_H, PIPE_EVE_P, type PerformerAgent, type PopPerformer, type MusicCtx, type Gig } from '../src/audio/performers';
import { segAt, type Seg } from '../src/people/population';
import { MUSIC_CLAIMS } from '../src/audio/musicClaims';
import { refusal, MusicSystem } from '../src/audio/music';
import { MusicDirector, EARSHOT_M } from '../src/audio/musicDirector';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim } from '../src/people/sim';

const grinder = (id: number, over: Partial<PerformerAgent> = {}): PerformerAgent => ({ id, role: 'grinder', origin: 'Persian', sex: 'f', seed: 100 + id, offmap: false, walking: false, task: { act: 'grind', place: 'querns' }, pos: [10 + id, 20], y: 0, ...over });
const mason = (id: number, origin: string): PerformerAgent => ({ id, role: 'mason', origin, sex: 'm', seed: 200 + id, offmap: false, walking: false, task: { act: 'dress_stone', place: 'worksite' }, pos: [50 + id, 60], y: 0 });
const hall = { cx: 22, cy: -159.5, sx: 27, sy: 27, fl: 6 };
const ctx = (t: number, o: Partial<MusicCtx> = {}): MusicCtx => ({ t, seed: 1, courtToday: false, courtYesterday: false, sun: { rise: 6, set: 18.5 }, foul: false, courtHall: hall, ...o });
const mkEngine = () => ({ ctx: { sampleRate: 8000, currentTime: 0, createBuffer: (_c: number, n: number, sr: number) => ({ copyToChannel() {}, duration: n / sr }), createBufferSource: () => ({ connect() {}, start() {}, stop() {} }), createGain: () => ({ connect() {}, gain: { value: 1, setTargetAtTime() {} } }) },
    unlocked: true, panner: (x: number, y: number, z: number) => ({ connect() {}, positionX: { value: x }, positionY: { value: y }, positionZ: { value: z } }), ch: { music: {} }, route() {}, occlusionOf: () => ({ gainDb: -12, cutoffHz: 2100, path: 'doorway test' }) } as any);
/** every gig over `days` days, sampled each minute of the hours given */
function sweep(agents: PerformerAgent[], hours: [number, number], o: Partial<MusicCtx> = {}, days = 3) {
  const gigs = new Map<string, Gig>(); let minutes = 0, playing = 0;
  for (let d = 0; d < days; d++) for (let m = hours[0] * 60; m < hours[1] * 60; m++) { const g = musicAt(agents, ctx(d * 24 + m / 60, o)); minutes++; if (g.length) playing++; for (const x of g) gigs.set(x.id, x); }
  return { gigs: [...gigs.values()], share: playing / minutes };
}

describe('music schedule: who sings at work', () => {
  const women = [grinder(1), grinder(2), grinder(3)];
  it('women at their querns sometimes sing, sparingly: one singer at a time per quern place, a minority of the day', () => {
    const { gigs, share } = sweep(women, [7, 18]);
    const quern = gigs.filter(g => g.kind === 'quern_song'); expect(quern.length).toBeGreaterThan(3);
    expect(share).toBeGreaterThan(0.02); expect(share).toBeLessThan(QUERN_P * 0.3 + 0.05); // stretches of 3–6 min in 20-min blocks, ~30 % of blocks
    for (const g of quern) { expect(soundingParts(g)).toHaveLength(1); const p = g.parts[0]; expect(women.map(w => w.id)).toContain(p.agentId);
      expect(p.perf!.instrument).toBe('voice'); expect(p.perf!.register).toBe('f'); expect(p.perf!.tradition).toBe('mesopotamian'); }
  });
  it('nobody sings at night, walking, off the map, away from the quern, or in foul weather', () => {
    expect(sweep(women, [19, 24]).gigs).toHaveLength(0);
    expect(sweep(women.map(w => ({ ...w, walking: true })), [7, 18]).gigs).toHaveLength(0);
    expect(sweep(women.map(w => ({ ...w, offmap: true })), [7, 18]).gigs).toHaveLength(0);
    expect(sweep(women.map(w => ({ ...w, task: { act: 'bake', place: 'oven' } })), [7, 18]).gigs).toHaveLength(0);
    expect(sweep(women, [7, 18], { foul: true }).gigs).toHaveLength(0);
  });
  it('only Ionian stonecutters sing at the block, in a Greek mode; Syrians, Egyptians and Elamites do not (no source seen)', () => {
    const { gigs } = sweep([mason(1, 'Ionian'), mason(2, 'Syrian'), mason(3, 'Egyptian'), mason(4, 'Elamite')], [7, 17], {}, 6);
    const m = gigs.filter(g => g.kind === 'mason_song'); expect(m.length).toBeGreaterThan(0);
    for (const g of m) { expect(g.parts[0].agentId).toBe(1); expect(g.parts[0].perf!.tradition).toBe('greek'); expect(['dorian', 'phrygian', 'lydian']).toContain(g.parts[0].perf!.modeId); }
  });
  it('the same seed gives the same schedule; another seed a different one; each stretch is a new piece', () => {
    const a = sweep(women, [7, 18]).gigs.map(g => g.id).join(), b = sweep(women, [7, 18]).gigs.map(g => g.id).join(), c = sweep(women, [7, 18], { seed: 2 }).gigs.map(g => g.id).join();
    expect(a).toBe(b); expect(a).not.toBe(c);
    const seeds = sweep(women, [7, 18]).gigs.map(g => g.parts[0].perf!.seed); expect(new Set(seeds).size).toBe(seeds.length);
  });
});

describe('music schedule: the court', () => {
  it('no court music unless the court is resident (the setting, D-003)', () => { expect(sweep([], [0, 24], { courtToday: false, courtYesterday: false }).gigs).toHaveLength(0); });
  it('with the court resident: supper music after sunset in the hall (4 voices led by one, 2 harps), then now and then through the night; none by day', () => {
    const on = { courtToday: true, courtYesterday: true };
    expect(sweep([], [7, 18.5], on).gigs).toHaveLength(0);
    const sup = sweep([], [19, 21], on).gigs.filter(g => g.kind === 'court_supper'); expect(sup.length).toBeGreaterThan(3);
    for (const g of sup) {
      const s = soundingParts(g); expect(s.map(p => p.perf!.instrument).sort()).toEqual(['harp', 'harp', 'voice']);
      expect(s.find(p => p.perf!.instrument === 'voice')!.perf!.voices).toBe(4); expect(g.parts).toHaveLength(6);
      expect(new Set(s.map(p => p.perf!.pieceSeed)).size).toBe(1); // one piece, shared
      for (const p of g.parts) { expect(Math.abs(p.pos.e - hall.cx)).toBeLessThan(hall.sx / 2); expect(Math.abs(p.pos.n - hall.cy)).toBeLessThan(hall.sy / 2); expect(p.extra?.floor).toBe(hall.fl); }
      expect(g.visual.placeholder).toBe(true);
    }
    const night = sweep([], [22, 24], on).gigs.concat(sweep([], [0, 5.5], on).gigs).filter(g => g.kind === 'court_night'); expect(night.length).toBeGreaterThan(0);
    expect(sweep([], [0, 5.5], { courtToday: true, courtYesterday: false }).gigs).toHaveLength(0); // the night after a day without the court
  });
});

describe('music schedule: evidence (brief §11; lint:music)', () => {
  const everything = [...sweep([grinder(1), grinder(2), mason(3, 'Ionian')], [0, 24], { courtToday: true, courtYesterday: true }, 8).gigs];
  it('every gig and every performance cites known SOUNDSCAPE §8 claims and passes the runtime evidence rules', () => {
    expect(everything.length).toBeGreaterThan(10);
    for (const g of everything) { expect(g.claims.length).toBeGreaterThan(0); for (const c of g.claims) expect(MUSIC_CLAIMS[c], c).toBeTruthy(); expect(g.tier).toMatch(/^[ABC]/);
      for (const p of soundingParts(g)) expect(refusal(p.perf!, true, { x: p.pos.e, y: p.pos.y, z: -p.pos.n }), p.key).toBeNull(); }
  });
  it('nothing is ever scheduled at an offering, and no instrument but the court harp plays (the herders\' pipe: its own tests)', () => {
    for (const g of everything) for (const p of soundingParts(g)) { expect(p.perf!.context).not.toBe('offering'); if (p.perf!.instrument !== 'voice') { expect(p.perf!.instrument).toBe('harp'); expect(p.perf!.context).toBe('court'); } }
  });
  it('the magi at an offering never sing (the chant is not attested, M-06)', () => {
    const magi = [0, 1].map(i => ({ ...grinder(i), sex: 'm' as const, role: 'magus', task: { act: 'offer', place: 'offering_place' } }));
    expect(sweep(magi, [0, 24], {}, 4).gigs).toHaveLength(0);
  });
});

describe('music schedule on the simulation (the Terrace work camp)', () => {
  let sim: PeopleSim;
  beforeAll(() => {
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    sim = new PeopleSim(1, nav, () => ({ rain: 0, lightning: false, windMs: 2, tempC: 18 }));
  });
  it('on a working day the simulated women grind at the querns, and the quern song comes from one of them', () => {
    const day = 40; let grinding = 0; const singers = new Set<number>();
    for (let h = 7; h < 17; h += BLOCK_H / 4) {
      sim.jumpTo(day * 24 + h);
      const agents = sim.agents as unknown as PerformerAgent[]; const C = sim.cal.ctx(day);
      grinding = Math.max(grinding, agents.filter(a => !a.offmap && a.task?.act === 'grind').length);
      for (const g of musicAt(agents, { t: sim.t, seed: 1, courtToday: C.court, courtYesterday: false, sun: C.sun, foul: C.wx.storm || C.wx.wet, courtHall: hall }))
        for (const p of soundingParts(g)) { const a = sim.agents[p.agentId!];
          if (g.kind === 'quern_song') { expect(a.task?.act).toBe('grind'); expect(a.sex).toBe('f'); singers.add(a.id); } else { expect(g.kind).toBe('mason_song'); expect(a.origin).toBe('Ionian'); expect(a.task?.act).toBe('dress_stone'); } }
    }
    expect(grinding).toBeGreaterThan(0); expect(singers.size).toBeGreaterThan(0);
  }, 120_000);
});

describe('the music director (world glue): plays what the schedule says, where the performer is', () => {
  it("starts the quern song near the listener, moves the singer's jaw, stops it when the stretch ends; nothing out of earshot", () => {
    const e = mkEngine(), ms = new MusicSystem(e, () => false), jaw: [number, string, number][] = [];
    const d = new MusicDirector(ms, e, { addExtra() {}, removeExtra() {}, play: (w, kind, _s, notes) => jaw.push([w.agentId!, kind, notes?.length ?? 0]) });
    const women = [grinder(1), grinder(2)];
    let t = -1; for (let m = 7 * 60; m < 18 * 60 && t < 0; m++) if (musicAt(women, ctx(m / 60)).length) t = m / 60;
    expect(t).toBeGreaterThan(0);
    const lis = { x: 11, y: 1.6, z: -20 };
    d.update(1, women, ctx(t), lis);
    expect(ms.playing).toHaveLength(1); expect(jaw.length).toBeGreaterThan(0);
    // the singer keeps grinding and sings: her jaw and breath follow the notes of the piece that started (D-200)
    expect(jaw[0][1]).toBe('sing_work'); expect(women.map(w => w.id)).toContain(jaw[0][0]); expect(jaw[0][2]).toBeGreaterThan(8);
    expect(d.lines().join('\n')).toMatch(/music heard: quern_song .*seen: sing_work.* tier C \[M-07.*occlusion -12\.0 dB/);
    let t2 = t; while (musicAt(women, ctx(t2)).length) t2 += 1 / 60;
    d.update(1, women, ctx(t2), lis); expect(ms.playing).toHaveLength(0);
    const far = new MusicDirector(new MusicSystem(e, () => false), e, { addExtra() {}, removeExtra() {}, play() {} });
    far.update(1, women, ctx(t), { x: 11 + EARSHOT_M + 10, y: 1.6, z: -20 }); expect(far.lines().join()).toMatch(/scheduled \(out of earshot\)/);
  });
  it('places the court musicians while the court plays and takes them away after', () => {
    const e = mkEngine(), placed = new Set<string>();
    const ms = new MusicSystem(e, () => true);
    const seen = new Map<string, string>();
    const d = new MusicDirector(ms, e, { addExtra: k => placed.add(k), removeExtra: k => placed.delete(k), play: (w, kind) => seen.set(w.extra!, kind) });
    const on = { courtToday: true, courtYesterday: true };
    let t = -1; for (let m = 19 * 60; m < 21 * 60 && t < 0; m++) if (musicAt([], ctx(m / 60, on)).some(g => g.kind === 'court_supper')) t = m / 60;
    expect(t).toBeGreaterThan(0);
    d.update(1, [], ctx(t, on), { x: 22, y: 7.6, z: 159.5 }); expect(placed.size).toBe(6);
    expect(ms.playing).toHaveLength(3); // two harps and the chorus, started together
    // the harpists play vertical harps, all four women sing (D-200)
    expect([...seen.entries()].sort()).toEqual([['court:harpist:0', 'harp_v'], ['court:harpist:1', 'harp_v'], ['court:singer:0', 'sing'], ['court:singer:1', 'sing'], ['court:singer:2', 'sing'], ['court:singer:3', 'sing']]);
    d.update(1, [], ctx(12, on), { x: 22, y: 7.6, z: 159.5 }); expect(placed.size).toBe(0);
  });
});

describe('music schedule: the herders\' pipe (D-200; M-10, M-18)', () => {
  const man = (pid: number, over: Partial<PopPerformer> = {}): PopPerformer => ({ pid, sex: 'm', age: 30, act: 'talk', why: 'by the fire with the band', place: 'camp:band3:1', e: -900 + pid, n: 40, y: 1590, moving: false, seed: 500 + pid, ...over });
  const band = [man(1), man(2), man(3, { age: 60 }), man(4, { sex: 'f' }), man(5, { age: 10 })];
  const pipeSweep = (pop: PopPerformer[], hours: [number, number], o: Partial<MusicCtx> = {}, days = 6) => {
    const gigs = new Map<string, Gig>(); let minutes = 0, playing = 0;
    for (let d = 0; d < days; d++) for (let m = hours[0] * 60; m < hours[1] * 60; m++) { const g = musicAt([], ctx(d * 24 + m / 60, o), pop).filter(x => x.kind === 'herder_pipe'); minutes++; if (g.length) playing++; for (const x of g) gigs.set(x.id, x); }
    return { gigs: [...gigs.values()], share: playing / minutes };
  };
  it('in the evening by the band\'s fire, now and then one man of 14-55 plays a reed pipe: sparingly, the same man all evening, with sourced claims', () => {
    const { gigs, share } = pipeSweep(band, [19, 21]);
    expect(gigs.length).toBeGreaterThan(3); expect(share).toBeGreaterThan(0.05); expect(share).toBeLessThan(PIPE_EVE_P * 0.35 + 0.05);
    const byDay = new Map<number, Set<number>>();
    for (const g of gigs) { const p = soundingParts(g); expect(p).toHaveLength(1); const q = p[0];
      expect([1, 2]).toContain(q.pid); expect(q.play).toBe('reed_pipe'); expect(q.perf!.instrument).toBe('reed_pipe'); expect(q.perf!.context).toBe('herding');
      expect(g.claims).toEqual(expect.arrayContaining(['M-10', 'M-18'])); expect(g.tier).toBe('C'); expect(g.visual.placeholder).toBe(false);
      expect(refusal(q.perf!, false, { x: q.pos.e, y: q.pos.y, z: -q.pos.n })).toBeNull();
      const d = Math.floor(g.until / 24); (byDay.get(d) ?? byDay.set(d, new Set()).get(d)!).add(q.pid!); }
    for (const s of byDay.values()) expect(s.size).toBe(1);
  });
  it('at the midday halt while the flock lies up, too; never walking, by day at the camp, in foul weather, for women, boys or old men, or at an offering', () => {
    const noon = [man(1, { act: 'rest', why: 'resting while the flock lies up at midday', place: 'route:band3:2' }), man(2, { act: 'rest', why: 'resting while the flock lies up at midday', place: 'route:band3:2' })];
    expect(pipeSweep(noon, [11, 15]).gigs.length).toBeGreaterThan(0);
    expect(pipeSweep(band.map(o => ({ ...o, moving: true })), [19, 21]).gigs).toHaveLength(0);
    expect(pipeSweep(band, [9, 17]).gigs).toHaveLength(0);
    expect(pipeSweep(band, [19, 21], { foul: true }).gigs).toHaveLength(0);
    expect(pipeSweep([man(3, { age: 60 }), man(4, { sex: 'f' }), man(5, { age: 10 })], [19, 21]).gigs).toHaveLength(0);
    expect(pipeSweep(band.map(o => ({ ...o, act: 'offer', why: 'the lan', place: 'offering_place' })), [0, 24]).gigs).toHaveLength(0);
  });
  it('the director follows the piper where the view places him and shows him playing; he is gone when the view no longer has him', () => {
    const e = mkEngine(), ms = new MusicSystem(e, () => false), seen: [number, string][] = [];
    const d = new MusicDirector(ms, e, { addExtra() {}, removeExtra() {}, play: (w, kind) => seen.push([w.pid!, kind]) });
    let t = -1; for (let m = 19 * 60; m < 21 * 60 * 6 && t < 0; m++) if (musicAt([], ctx(m / 60), band).some(g => g.kind === 'herder_pipe')) t = m / 60;
    expect(t).toBeGreaterThan(0);
    d.update(1, [], ctx(t), { x: -895, y: 1591, z: -40 }, band);
    expect(ms.playing).toHaveLength(1); expect(seen.length).toBe(1); expect([1, 2]).toContain(seen[0][0]); expect(seen[0][1]).toBe('reed_pipe');
    expect(d.lines().join('\n')).toMatch(/music heard: herder_pipe · population person [12] · reed pipe \(single cane\) · seen: reed_pipe .* tier C \[M-10, M-18/);
    d.update(0.1, [], ctx(t), { x: -895, y: 1591, z: -40 }, []); expect(ms.playing).toHaveLength(0);
  });
});

describe('the herders\' pipe on the population\'s own plans (the band\'s reasons match the schedule\'s)', () => {
  let sim: PeopleSim;
  beforeAll(() => { sim = new PeopleSim(1, new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8'))), () => ({ rain: 0, lightning: false, windMs: 2, tempC: 18 })); });
  it('on the days bands are in the plain, men of 14-55 sit by the evening fire and rest at the midday halt with the reasons piperSlot reads; the schedule finds pipers among them', () => {
    const P = (sim as any).pop; const herders = P.persons.filter((p: any) => p.job === 'herder').map((p: any) => p.id as number);
    let eve = 0, noon = 0, gigs = 0, days = 0;
    for (let d = 0; d < 360 && days < 12; d += 3) {
      const ids = herders.filter((pid: number) => P.present(pid, d)); if (!ids.length) continue; days++;
      const sun = sim.cal.ctx(d).sun, plans = new Map<number, Seg[]>(ids.map((pid: number) => [pid, P.plan(pid, d) as Seg[]]));
      for (let m = 0; m < 24 * 60; m += 5) { const h = m / 60, pop: PopPerformer[] = [];
        for (const pid of ids) { const s = segAt(plans.get(pid)!, h); if (s.where === 'away' || s.act === 'offmap') continue; const q = P.persons[pid];
          pop.push({ pid, sex: q.sex, age: P.ageOn(pid, d), act: s.act, why: s.why, place: s.place, e: 0, n: 0, y: 0, moving: s.act === 'walk', seed: pid }); }
        for (const o of pop) { const w = piperSlot(o, h, sun); if (w === 'eve') eve++; else if (w === 'noon') noon++; }
        gigs += musicAt([], { t: d * 24 + h, seed: 1, courtToday: false, courtYesterday: false, sun, foul: false, courtHall: null }, pop).filter(g => g.kind === 'herder_pipe').length; }
    }
    expect(days).toBeGreaterThan(2); expect(eve).toBeGreaterThan(0); expect(noon).toBeGreaterThan(0); expect(gigs).toBeGreaterThan(0);
  }, 300_000);
});
