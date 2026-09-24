// People speaking to each other and to the stranger (src/people/exchanges.ts; D-168; Phase 8 review A-C2, B-M3): every
// scripted line is reachable by some situation that the running simulation actually produces, speakers use only
// languages they have (and that the other understands), and Old Persian is heard in observer mode.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env, sunTimes } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { LINES, SPEECH_LANGS } from '../src/people/speech_lines';
import { SITUATIONS, reachableLines, situationsNow, realise, turnCandidates, languageOrder, addressIntents, speak, Conversations, type SpeakerLike } from '../src/people/exchanges';
import { Rng } from '../src/core/rng';

const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC }; };
const night = (t: number) => { const d = Math.floor(t / 24), h = t - d * 24, s = sunTimes(d); return h < s.rise || h > s.set; };

describe('every scripted line can be heard', () => {
  let sim: PeopleSim;
  beforeAll(() => { sim = new PeopleSim(1, nav, env); });
  it('each of the 73 lines is reachable by a situation, the stranger\'s address or a visitor-mode stop, over the real roster', () => {
    const r = reachableLines(sim.agents as unknown as SpeakerLike[]);
    const missing = LINES.filter(l => !r.has(l.id)).map(l => l.id);
    expect(missing, 'lines no situation can produce').toEqual([]);
    expect(LINES.length).toBe(73);
    // no line is reachable only through the stranger: people also say most of them to each other
    const byOthers = LINES.filter(l => [...(r.get(l.id) ?? [])].some(w => !w.startsWith('address:') && !w.startsWith('visitor:')));
    expect(byOthers.length).toBeGreaterThanOrEqual(70);
  });
  it('the running world produces every situation within the first eight days (abstract LOD, a look every 5 min)', () => {
    for (const a of sim.agents) a.lod = 'abstract';
    sim.jumpTo(4); const seen = new Map<string, number>(), lines = new Set<string>(), last = new Map<number, string>();
    while (sim.t < 24 * 8) {
      sim.step(300);
      const leftFrom = new Map<number, string>();
      for (const a of sim.agents) { const at = a.task?.place, was = last.get(a.id); if (was && at && was !== at) leftFrom.set(a.id, was); if (at) last.set(a.id, at); }
      for (const m of situationsNow(sim.agents as unknown as SpeakerLike[], { t: sim.t, night: night(sim.t), leftFrom })) {
        seen.set(m.s.id, (seen.get(m.s.id) ?? 0) + 1);
        for (const tu of m.s.turns) { const sp = tu.who === 'a' ? m.a : m.b, to = tu.who === 'a' ? m.b : m.a; for (const l of turnCandidates(sp, to, tu.intents, tu.own)?.lines ?? []) lines.add(l.id); }
      }
    }
    console.log('situations in 8 days:', SITUATIONS.map(s => `${s.id} ${seen.get(s.id) ?? 0}`).join(', '), `· lines ${lines.size}/${LINES.length}`);
    for (const s of SITUATIONS) expect(seen.get(s.id) ?? 0, s.id).toBeGreaterThan(0);
    // the rest (self-identification: guard, scribe, Ionian) is said to the stranger when he asks again (address)
    expect(lines.size).toBeGreaterThanOrEqual(70);
  }, 120_000);
});

describe('who speaks what to whom', () => {
  const P = (o: Partial<SpeakerLike>): SpeakerLike => ({ id: Math.floor(Math.random() * 1e6), role: 'porter', origin: 'Persian', langs: ['Old Persian', 'Elamite'], seed: 5, pos: [0, 0], walking: false, task: { act: 'rest', place: 'stair_foot' }, ...o });
  it('a speaker only uses a language he has and the other understands (or his own for a gestured request)', () => {
    const sim = new PeopleSim(1, nav, env); const people = sim.agents as unknown as SpeakerLike[]; const rng = new Rng(3, 't');
    for (const s of SITUATIONS) for (const a of people) { if (!s.cast.a(a)) continue;
      for (const b of people) { if (a === b || !s.cast.b(b, a)) continue;
        const x = realise({ s, a, b }, { t: 10, night: false }, rng); if (!x) continue;
        for (const u of x.utterances) {
          const label = u.via; expect(u.speaker.langs, `${s.id} ${u.line.id}`).toContain(label);
          expect(SPEECH_LANGS[label].lang).toBe(u.line.lang);
          const own = s.turns.some(t => t.own && (t.who === 'a' ? a : b) === u.speaker);
          if (!own) expect(u.to.langs, `${s.id}: ${u.line.id} to someone without ${label}`).toContain(label);
        }
        break; } }
  });
  it('compatriots speak their own language first; with others the shared one', () => {
    const ion = P({ origin: 'Ionian', role: 'mason', langs: ['Greek', 'Aramaic'] }), ion2 = P({ origin: 'Ionian', role: 'mason', langs: ['Greek', 'Aramaic'] });
    const bab = P({ origin: 'Babylonian', role: 'mason', langs: ['Aramaic', 'Babylonian'] }), bab2 = P({ origin: 'Babylonian', role: 'scribe', langs: ['Aramaic', 'Babylonian'] });
    const fore = P({ origin: 'Elamite', role: 'foreman', langs: ['Elamite', 'Aramaic'] });
    expect(languageOrder(ion, ion2)[0]).toBe('Greek'); expect(languageOrder(ion, fore)).toEqual(['Aramaic']);
    expect(languageOrder(bab, bab2)[0]).toBe('Babylonian'); expect(languageOrder(bab, fore)).toEqual(['Aramaic']);
    expect(turnCandidates(fore, ion, ['call_workers'])!.lines.every(l => l.lang === 'arc')).toBe(true);
    expect(turnCandidates(bab, bab2, ['greet'])!.lines.every(l => l.lang === 'bab')).toBe(true);
  });
  it('two Persians bless rather than switch to Aramaic for a greeting (Old Persian has no attested greeting)', () => {
    const g1 = P({ role: 'guard', langs: ['Old Persian', 'Aramaic'] }), g2 = P({ role: 'guard', origin: 'Median', langs: ['Old Persian', 'Aramaic'] });
    const c = turnCandidates(g1, g2, ['greet', 'farewell'])!; expect(c.intent).toBe('farewell'); expect(c.lines.every(l => l.lang === 'op')).toBe(true);
    // with a Syrian, the same guard greets in Aramaic
    expect(turnCandidates(g1, P({ origin: 'Syrian', role: 'mason', langs: ['Aramaic'] }), ['greet', 'farewell'])!.lines[0].lang).toBe('arc');
  });
  it('observer mode: Persians answer the stranger in Old Persian (a blessing first, then their own words)', () => {
    const women = P({ role: 'grinder', langs: ['Old Persian', 'Elamite'] }), guard = P({ role: 'guard', langs: ['Old Persian', 'Aramaic'], task: { act: 'patrol', place: 'forecourt' } });
    const official = P({ role: 'official', langs: ['Old Persian', 'Elamite', 'Aramaic'], task: { act: 'inspect', place: 'forecourt' } });
    expect(speak(women, null, addressIntents(women, 1), 1)!.line.lang).toBe('op'); // was null (a nod) before D-168
    expect(speak(guard, null, addressIntents(guard, 2), 1)!.line.id).toBe('op.identify.adam_rstika');
    expect(speak(official, null, addressIntents(official, 2), 1)!.line.lang).toBe('op');
    // a guard on duty at a check post asks the stranger for his document, as in visitor mode
    const posted = P({ role: 'guard', langs: ['Old Persian', 'Aramaic'], task: { act: 'stand_guard', place: 'post_gate_w1' } });
    expect(addressIntents(posted, 1)[0]).toBe('ask_document');
  });
  it('the guard lets a courier through by day and turns him back at night', () => {
    const s = SITUATIONS.find(x => x.id === 'gate_check')!;
    const g = P({ role: 'guard', langs: ['Old Persian', 'Aramaic'], task: { act: 'stand_guard', place: 'post_stair_n' } }), c = P({ role: 'courier', langs: ['Old Persian', 'Aramaic'], walking: true, task: { act: 'walk', place: 'treasury_desk' } });
    const day = realise({ s, a: g, b: c }, { t: 10, night: false }, new Rng(1, 'x'))!, nightX = realise({ s, a: g, b: c }, { t: 22, night: true }, new Rng(1, 'x'))!;
    expect(day.utterances.map(u => u.intent)).toContain('affirm'); expect(day.utterances.map(u => u.intent)).not.toContain('refuse');
    expect(nightX.utterances.map(u => u.intent)).toContain('refuse');
    expect(day.utterances[0].line.id).toBe('arc.ask_document.igra'); // no Old Persian question word: the Aramaic "letter?"
  });
  it('the conversation runner plays at most one exchange at a time, near the listener, and respects cooldowns', () => {
    const sim = new PeopleSim(1, nav, env); for (const a of sim.agents) a.lod = 'abstract'; sim.jumpTo(24 * 2 + 9); for (let i = 0; i < 20; i++) sim.step(60);
    const conv = new Conversations({ hear: 25, checkEvery: 2.5, chance: 1, gap: 6 }), rng = new Rng(9, 'c');
    const on = sim.agents.filter(a => !a.offmap), near = (p: readonly number[]) => on.filter(b => Math.hypot(b.pos[0] - p[0], b.pos[1] - p[1]) < 25).length;
    const at = [...on].sort((a, b) => near(b.pos) - near(a.pos))[0].pos as [number, number];
    let n = 0, last = -1e9;
    for (let now = 0; now < 120; now += 0.5) { const x = conv.update(now, sim.agents as unknown as SpeakerLike[], at, { t: sim.t + now / 3600, night: false }, rng);
      if (x) { n++; expect(now - last).toBeGreaterThanOrEqual(6); last = now; for (const u of x.utterances) expect(Math.hypot(u.speaker.pos[0] - at[0], u.speaker.pos[1] - at[1])).toBeLessThanOrEqual(25); } }
    expect(n).toBeGreaterThan(0); expect(n).toBeLessThanOrEqual(20);
  });
});
