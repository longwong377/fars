// Who plays or sings, when and where (brief §11; D-178): the schedule of src/audio/performers.ts on synthetic people and
// on the simulation's own Terrace population.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { musicAt, soundingParts, QUERN_P, BLOCK_H, type PerformerAgent, type MusicCtx, type Gig } from '../src/audio/performers';
import { MUSIC_CLAIMS } from '../src/audio/musicClaims';
import { refusal, MusicSystem } from '../src/audio/music';
import { MusicDirector, EARSHOT_M } from '../src/audio/musicDirector';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim } from '../src/people/sim';

const grinder = (id: number, over: Partial<PerformerAgent> = {}): PerformerAgent => ({ id, role: 'grinder', origin: 'Persian', sex: 'f', seed: 100 + id, offmap: false, walking: false, task: { act: 'grind', place: 'querns' }, pos: [10 + id, 20], y: 0, ...over });
const mason = (id: number, origin: string): PerformerAgent => ({ id, role: 'mason', origin, sex: 'm', seed: 200 + id, offmap: false, walking: false, task: { act: 'dress_stone', place: 'worksite' }, pos: [50 + id, 60], y: 0 });
const hall = { cx: 22, cy: -159.5, sx: 27, sy: 27, fl: 6 };
const ctx = (t: number, o: Partial<MusicCtx> = {}): MusicCtx => ({ t, seed: 1, courtToday: false, courtYesterday: false, sun: { rise: 6, set: 18.5 }, foul: false, courtHall: hall, ...o });
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
  it('nothing is ever scheduled at an offering, and no instrument but the court harp plays', () => {
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
  const mkEngine = () => ({ ctx: { sampleRate: 8000, currentTime: 0, createBuffer: (_c: number, n: number, sr: number) => ({ copyToChannel() {}, duration: n / sr }), createBufferSource: () => ({ connect() {}, start() {}, stop() {} }), createGain: () => ({ connect() {}, gain: { value: 1, setTargetAtTime() {} } }) },
    unlocked: true, panner: (x: number, y: number, z: number) => ({ connect() {}, positionX: { value: x }, positionY: { value: y }, positionZ: { value: z } }), ch: { music: {} }, route() {}, occlusionOf: () => ({ gainDb: -12, cutoffHz: 2100, path: 'doorway test' }) } as any);
  it("starts the quern song near the listener, moves the singer's jaw, stops it when the stretch ends; nothing out of earshot", () => {
    const e = mkEngine(), ms = new MusicSystem(e, () => false), jaw: number[] = [];
    const d = new MusicDirector(ms, e, { addExtra() {}, removeExtra() {}, singing: id => jaw.push(id) });
    const women = [grinder(1), grinder(2)];
    let t = -1; for (let m = 7 * 60; m < 18 * 60 && t < 0; m++) if (musicAt(women, ctx(m / 60)).length) t = m / 60;
    expect(t).toBeGreaterThan(0);
    const lis = { x: 11, y: 1.6, z: -20 };
    d.update(1, women, ctx(t), lis);
    expect(ms.playing).toHaveLength(1); expect(jaw.length).toBeGreaterThan(0);
    expect(d.lines().join('\n')).toMatch(/music heard: quern_song .* tier C \[M-07.*occlusion -12\.0 dB.*PLACEHOLDER/);
    let t2 = t; while (musicAt(women, ctx(t2)).length) t2 += 1 / 60;
    d.update(1, women, ctx(t2), lis); expect(ms.playing).toHaveLength(0);
    const far = new MusicDirector(new MusicSystem(e, () => false), e, { addExtra() {}, removeExtra() {}, singing() {} });
    far.update(1, women, ctx(t), { x: 11 + EARSHOT_M + 10, y: 1.6, z: -20 }); expect(far.lines().join()).toMatch(/scheduled \(out of earshot\)/);
  });
  it('places the court musicians while the court plays and takes them away after', () => {
    const e = mkEngine(), placed = new Set<string>();
    const d = new MusicDirector(new MusicSystem(e, () => true), e, { addExtra: k => placed.add(k), removeExtra: k => placed.delete(k), singing() {} });
    const on = { courtToday: true, courtYesterday: true };
    let t = -1; for (let m = 19 * 60; m < 21 * 60 && t < 0; m++) if (musicAt([], ctx(m / 60, on)).some(g => g.kind === 'court_supper')) t = m / 60;
    expect(t).toBeGreaterThan(0);
    d.update(1, [], ctx(t, on), { x: 22, y: 7.6, z: 159.5 }); expect(placed.size).toBe(6);
    d.update(1, [], ctx(12, on), { x: 22, y: 7.6, z: 159.5 }); expect(placed.size).toBe(0);
  });
});
