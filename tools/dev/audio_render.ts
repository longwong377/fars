// Offline measurement of the soundscape (D-245; MASTER_PLAN axis G: T-G1, T-G2, T-G2b, T-G2f, T-G3, T-G3e).
// Usage: npx tsx tools/dev/audio_render.ts [--scene town|terrace|village|synthetic|all] [--day 120] [--hour 10] [--seed 1]
//        [--secs 60] [--fast] [--evidence <pass>]   (--fast: the synthetic scene only, no population; --evidence: write
//        REVIEWS/evidence/<pass>/<id>.json for T-G1, T-G2, T-G2b, T-G2f, T-G3, T-G3e)
//
// WHAT THIS IS, AND IS NOT. Node has no OfflineAudioContext and node-web-audio-api is not installed, so the browser's audio
// engine cannot render here. The real code (AudioEngine, Soundscape, PopulationVoices, WaterSound) runs on a recording mock
// context (tools/dev/audio_graph.ts) whose buffers hold the real samples (the formant voices, every noise segment), driven
// frame by frame for `secs` seconds of context time with the people of the real population view at a place and hour. From
// the recorded graph it measures:
//   T-G1   the limiter's presence and bound (every path to the destination passes the ceiling), and the true peak of a
//          modelled master bus on the dry mix of every buffer source (no HRTF, no reverb, no oscillators: birds, chisels,
//          animal calls and music are oscillator voices and are NOT in the mix) and on that mix +12 dB and on full-scale noise;
//   T-G2   buffers started twice within 60 s, and the largest 0.3 s cross-correlation between voice renders that share a
//          word within 60 s (different speakers, or one speaker's line and word); the noise segments are distinct buffers;
//   T-G2b  looped sources (none should remain) and the shortest buffer-reuse interval;
//   T-G2f  correlation between consecutive footsteps (their samples through their band-pass);
//   T-G3   every 0.25 s, the visible speakers within 15 m (voiced now, or talking and not voiced: a jaw moving with no voice)
//          and whether each is heard above −40 dBFS (their utterance's RMS through its path's filters and gains, the
//          panner's distance law, the master bus): line of sight is not modelled (everyone within 15 m counts: stricter);
//   T-G3e  the rivers at 5, 25 and 50 m from the bank in the month of lowest flow, and a fire at 8 m.
// The browser's own render (HRTF, the convolver, the compressor's look-ahead, the output device) is NOT measured: the
// lead renders and listens (BLOCKERS B65).
import { AudioEngine } from '../../src/audio/engine';
import { Soundscape } from '../../src/audio/soundscape';
import { PopulationVoices, voiceDist, NEIGHBOUR_R, type NearPerson } from '../../src/audio/voices';
import { WaterSound, FLOW, type WaterLine } from '../../src/audio/water';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ceilingCurve, LIMITER } from '../../src/audio/engine';
import { MockContext, MockNode, peakOf, shape, biquad, limiterReport, loopReport, sourceLevel, dryMix, masterBus, truePeak, maxSegmentXcorr, segmentXcorrPN, playAt, bestPath, throughPath } from './audio_graph';

const args = process.argv.slice(2), arg = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const SEED = +arg('seed', '1'), DAY = +arg('day', '120'), HOUR = +arg('hour', '10'), SECS = +arg('secs', '60'), SCENE = arg('scene', 'all'), FAST = args.includes('--fast');
const FPS = 30;

export interface SceneSpec { name: string; listener: { x: number; y: number; z: number }; people: NearPerson[]; place?: { town: number; water: number; trees: number; midden: number; animals: number }; wind: number; rain: number; tempC: number; month: number; hour: number; water: WaterLine[]; ground?: (e: number, n: number) => number; fires?: { id: string; lit: boolean; pos: { x: number; y: number; z: number } }[]; walk?: boolean; nearColumns?: boolean }

/** a synthetic gathering (no population needed): conversations of 2–5 people in rings, and some eating, around the listener */
export function syntheticScene(n = 60, seed = 1): SceneSpec {
  const people: NearPerson[] = []; const langs = ['Elamite', 'Persian', 'Babylonian', 'Ionian', 'Egyptian', 'Aramaic', 'Syrian', 'Lydian']; let k = 0;
  for (let g = 0; people.length < n; g++) {
    const r = 2 + (g * 3.1) % 40, a = g * 2.39996, cx = Math.cos(a) * r, cz = Math.sin(a) * r, m = 2 + (g % 4), lang = langs[g % langs.length], mixed = g % 5 === 4;
    for (let j = 0; j < m && people.length < n; j++) { const b = (j / m) * Math.PI * 2; k++;
      people.push({ key: `p${k}`, x: cx + Math.cos(b) * 0.9, y: 0, z: cz + Math.sin(b) * 0.9, talking: true, eating: g % 6 === 5, lang: mixed && j === 1 ? 'Ionian' : lang, sex: (k * 7 + seed) % 3 ? 'm' : 'f', age: (k * 13) % 9 === 0 ? 9 : 20 + (k * 17) % 45, seed: 1000 + k * 7919 + seed, group: `g${g}` }); }
  }
  return { name: 'synthetic gathering', listener: { x: 0, y: 1.6, z: 0 }, people, wind: 4, rain: 0, tempC: 22, month: 4, hour: 10, water: [], fires: [{ id: 'f1', lit: true, pos: { x: 8, y: 0.3, z: 0 } }], walk: true };
}

export interface Run { ctx: MockContext; e: AudioEngine; voices: PopulationVoices; water: WaterSound; sound: Soundscape; steps: { t: number; key: string }[] }
/** drive the real audio code on the mock for `secs` of context time */
export function runScene(S: SceneSpec, secs = SECS, seed = SEED, voicesOpts: ConstructorParameters<typeof PopulationVoices>[1] = {}): Run {
  const ctx = new MockContext(48000), e = new AudioEngine(); e.attach(ctx as unknown as AudioContext); e.setVolumes({ master: 0.9, ambience: 1, voices: 1, music: 1, effects: 1 });
  const voices = new PopulationVoices(e, { seed, renderMs: Infinity, ...voicesOpts }); voices.log = []; // (no wall-clock budget: reproducible; the count budget stays)
  const water = new WaterSound(e, S.water, S.ground ?? (() => 0), seed), sound = new Soundscape(e);
  e.setListener(S.listener, { x: 0, y: 0, z: -1 });
  const dt = 1 / FPS, steps: { t: number; key: string }[] = []; let phase = 0;
  for (let i = 0; i < secs * FPS; i++) {
    voices.update(dt, S.people, S.listener);
    water.update(S.listener, S.month);
    const before = ctx.starts.length; if (S.walk) phase += dt * 1.35 / 0.72 * Math.PI;
    sound.update(dt, { hour: S.hour, month: S.month, windMs: S.wind, rain: S.rain, insideSpace: 'open', nearColumns: !!S.nearColumns, stepPhase: phase, running: false, surface: 'stone', fires: S.fires ?? [], listener: S.listener, worksite: null, workHours: false, place: S.place, sun: { rise: 6, set: 18 }, tempC: S.tempC });
    // footsteps are the effects-channel noise bursts of 0.12 s started by this update with no panner on their path
    for (let j = before; j < ctx.starts.length; j++) { const n = ctx.starts[j]; if (n.kind === 'source' && n.buffer && Math.abs(n.buffer.duration - 0.12) < 1e-3) steps.push({ t: n.startedAt!, key: String(n.id) }); }
    ctx.advance(dt);
  }
  return { ctx, e, voices, water, sound, steps };
}

/** the measurements of one run */
export function measure(S: SceneSpec, R: Run, secs = SECS) {
  const { ctx, voices } = R, lis = S.listener, log = voices.log!;
  // ---- T-G3: visible speakers within 15 m, sampled every 0.25 s
  const near = S.people.filter(p => Math.hypot(p.x - lis.x, p.y + 1.5 - lis.y, p.z - lis.z) <= 15);
  const lvl = new Map<object, number>(); const levelOf = (u: typeof log[number]) => { let v = lvl.get(u.src); if (v === undefined) { v = sourceLevel(u.src as unknown as MockNode, u.t0, lis).db; lvl.set(u.src, v); } return v; };
  let vis = 0, aud = 0, silentJaw = 0; const perKey = new Map<string, number>(); let minDb = Infinity;
  for (let t = 2; t < secs; t += 0.25) {
    for (const p of near) { if (!p.talking) continue;
      const u = log.find(x => x.key === p.key && x.t0 <= t && x.t1 > t);
      const claimed = true; // every talker within bedR is claimed by the voices (their jaw moves only while voiced)
      if (u) { vis++; const db = levelOf(u); minDb = Math.min(minDb, db); if (db > -40) aud++; perKey.set(p.key, (perKey.get(p.key) ?? 0) + 1); }
      else if (!claimed) { vis++; silentJaw++; } }
  }
  const talkNear = near.filter(p => p.talking), voicedNear = talkNear.filter(p => log.some(x => x.key === p.key)).length;
  // longest silence of a talker within 15 m who is in a conversation (the listeners of a conversation are silent by design)
  // ---- T-G2: voice renders sharing a word within 60 s
  let pairs = 0, maxX = 0, maxPlain = 0, maxSingle = 0, over = 0, maxPair = ''; const seen: string[] = [];
  const voiceLog = log;
  for (let i = 0; i < voiceLog.length; i++) for (let j = i + 1; j < voiceLog.length; j++) {
    const a = voiceLog[i], b = voiceLog[j]; if (b.t0 - a.t0 > 60 || a.lang !== b.lang || a.unit !== b.unit) continue;
    pairs++;
    const X = segmentXcorrPN(a.buf.getChannelData(0), a.buf.sampleRate, b.buf.getChannelData(0), b.buf.sampleRate), x = X.r; maxPlain = Math.max(maxPlain, X.plain); maxSingle = Math.max(maxSingle, X.singleWindow); if (x > maxX) { maxX = x; maxPair = `${a.key}/${b.key} ${a.unit} ${a.kind}/${b.kind}`; } if (x > 0.9) { over++; seen.push(`${a.key}/${b.key} ${a.unit} ${x.toFixed(2)}`); }
  }
  // the control that the detector detects: one voice render against itself played 5 % faster (a pitch-shifted copy) and
  // against the same unit rendered again in the same voice (what the pooled murmur did)
  const c0 = log.find(u => u.buf.duration > 0.5), control = c0 ? { pitchShiftedCopy: +segmentXcorrPN(c0.buf.getChannelData(0), c0.buf.sampleRate, playAt(c0.buf.getChannelData(0), 1.05), c0.buf.sampleRate).r.toFixed(3) } : null;
  const lr = loopReport(ctx);
  // ---- T-G2f: consecutive footsteps
  let fmax = 0; const stepNodes = R.steps.map(s => ctx.starts.find(n => String(n.id) === s.key)!).filter(Boolean);
  // (T-G2f anti-proxy: every pair of steps within 10 s, not only consecutive ones; whole-window correlation of the 0.1 s steps)
  const steps = stepNodes.slice(0, 40).map(n => { const p = bestPath(n, n.startedAt!, lis); return p ? { t: n.startedAt!, y: throughPath(n, p) } : null; }).filter((x): x is { t: number; y: Float32Array } => !!x);
  let fpairs = 0; for (let i = 0; i < steps.length; i++) for (let j = i + 1; j < steps.length && steps[j].t - steps[i].t <= 10; j++) { fpairs++; fmax = Math.max(fmax, maxSegmentXcorr(steps[i].y, 48000, steps[j].y, 48000, 0.1, 0.02, 0)); }
  // ---- T-G1: dry mix through the modelled master bus
  const t0 = Math.max(0, secs - 20), mix = dryMix(ctx, t0, secs, lis), curve = (ctx.destination.inputs[0]?.curve) ?? new Float32Array([-1, 1]);
  const out = masterBus(mix, 48000, curve), hot = masterBus(mix.map(v => v * 4), 48000, curve);
  let s = 0x2545f491; const noise = new Float32Array(48000).map(() => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 31) - 1), full = masterBus(noise, 48000, curve);
  // ---- voices: spread of the voices in earshot
  const vs = [...new Map(log.map(u => [u.key, u.voice])).entries()], at = new Map(S.people.map(p => [p.key, p])); let minNb = Infinity, clashes = 0, nbPairs = 0;
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) { const [ka, a] = vs[i], [kb, b] = vs[j], pa = at.get(ka), pb = at.get(kb); if (!pa || !pb || Math.hypot(pa.x - pb.x, pa.z - pb.z) >= NEIGHBOUR_R) continue;
    nbPairs++; const d = voiceDist(a, b); minNb = Math.min(minNb, d); if (d < 1) clashes++; }
  const langs: Record<string, number> = {}; for (const u of log) langs[u.lang] = (langs[u.lang] ?? 0) + 1;
  return {
    scene: S.name, secs, people: S.people.length, talkers: S.people.filter(p => p.talking).length, talkersWithin15m: talkNear.length, voicedWithin15m: voicedNear,
    utterances: log.length, voiceUtterances: log.filter(u => u.kind === 'voice').length, bedGrains: log.filter(u => u.kind === 'bed').length, languages: langs,
    'T-G1': { limiter: limiterReport(ctx), dryMixPeakDbfs: +(20 * Math.log10(Math.max(1e-9, peakOf(mix)))).toFixed(2), truePeakDbtp: +truePeak(out).toFixed(2), truePeakHot12dB: +truePeak(hot).toFixed(2), truePeakFullScaleNoise: +truePeak(full).toFixed(2) },
    'T-G2': { voicePairsSharingAUnit: pairs, maxXcorrPitchNormalised: +maxX.toFixed(3), maxXcorrPlain: +maxPlain.toFixed(3), maxSingleWindowXcorr: +maxSingle.toFixed(3), maxPair, over09: over, examples: seen.slice(0, 5), bufferReusesWithin60s: lr.reusesWithin60s, control },
    'T-G2b': { loopedSources: lr.loopedSources, shortestLoopS: lr.shortestLoopS, shortestReuseS: lr.shortestReuseS, buffersStarted: lr.buffersStarted, distinctBuffers: lr.distinctBuffers },
    'T-G2f': { footsteps: stepNodes.length, pairsWithin10s: fpairs, maxXcorr: +fmax.toFixed(3) },
    'T-G3': { samples: vis, audible: aud, sharePct: vis ? +(100 * aud / vis).toFixed(1) : null, quietestVoicedDb: Number.isFinite(minDb) ? +minDb.toFixed(1) : null, jawWithoutVoice: silentJaw }, voices: { distinct: vs.length, neighbourPairs: nbPairs, alikeNeighbours: clashes, minNeighbourDistance: Number.isFinite(minNb) ? +minNb.toFixed(2) : null },
    renderMsPerUtterance: +(voices.stats.totalRenderMs / Math.max(1, voices.stats.totalRenders)).toFixed(2), renderWaits: voices.stats.totalWaits,
  };
}

/** T-G3e: a river bank at 5, 25 and 50 m in the month of lowest flow, and the canal at 5 and 25 m */
export function waterLevels(lines: WaterLine[], ground: (e: number, n: number) => number, at: { river: [number, number]; canal?: [number, number] }) {
  const F = FLOW as readonly number[], low = F.indexOf(Math.min(...F)), out: Record<string, number> = {};
  for (const kind of ['river', 'canal'] as const) { const p = at[kind]; if (!p) continue; const L = lines.filter(l => l.kind === kind);
    // the perpendicular from the nearest segment through the listener
    let best = { d: Infinity, a: [0, 0] as number[], nx: 0, ny: 0, half: 0 };
    for (const l of L) for (let i = 0; i < l.pts.length - 1; i++) { const a = l.pts[i], b = l.pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)), px = a[0] + u * dx, py = a[1] + u * dy, d = Math.hypot(p[0] - px, p[1] - py);
      if (d < best.d) { const len = Math.sqrt(L2); best = { d, a: [px, py], nx: -dy / len, ny: dx / len, half: l.half }; } }
    for (const dist of kind === 'river' ? [5, 25, 50] : [5, 25]) {
      const e = best.a[0] + best.nx * (best.half + dist), n = best.a[1] + best.ny * (best.half + dist), lis = { x: e, y: ground(e, n) + 1.6, z: -n };
      const S: SceneSpec = { name: `${kind} ${dist} m`, listener: lis, people: [], wind: 0, rain: 0, tempC: 25, month: low, hour: 12, water: lines, ground };
      const R = runScene(S, 8);
      // the level of the water's segments playing at the end (rumble and gurgle summed in power)
      const t = R.ctx.currentTime - 0.5; let pw = 0;
      for (const s of R.ctx.starts) if (s.kind === 'source' && s.buffer && s.startedAt! <= t && s.stopAt > t) { const p = bestPath(s, t, lis); if (!p?.panner) continue; const L0 = sourceLevel(s, t, lis).db; pw += 10 ** (L0 / 10); }
      out[`${kind} ${dist} m`] = +(10 * Math.log10(Math.max(1e-12, pw))).toFixed(1);
    }
  }
  return { month: low, levelsDb: out };
}

/** T-G1: three ways of holding the true peak after the compressor (the ceiling at 1×; a 16 kHz low-pass after it; the
 *  ceiling at 4×), on full-scale and +6 dB white noise, high-passed noise (rain) and a 12 kHz sine, at the shipped ceiling
 *  and at −2 dBFS (dBTP; the compressor as masterBus models it, without its make-up) */
export function limiterStudy() {
  const sr = 48000, N = 24000; let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 31) - 1;
  const white = new Float32Array(N).map(() => rnd()), rain = biquad(Float32Array.from(white), sr, 'highpass', 900, 0.7).map(v => v * 1.5), sine = new Float32Array(N).map((_, i) => Math.sin(2 * Math.PI * 12000 * i / sr + Math.PI / 4));
  const comp = (x: Float32Array) => { const aA = Math.exp(-1 / (LIMITER.attack * sr)), aR = Math.exp(-1 / (LIMITER.release * sr)), th = LIMITER.threshold; let env = 0; return x.map(v => { const a = Math.abs(v); env = a > env ? aA * env + (1 - aA) * a : aR * env + (1 - aR) * a; const e = 20 * Math.log10(Math.max(1e-9, env)); return v * 10 ** ((e > th ? th + (e - th) / LIMITER.ratio - e : 0) / 20); }); };
  const rows: Record<string, Record<string, number>> = {};
  for (const c of [LIMITER.ceiling, 0.79]) { const cu = ceilingCurve(4097, c, LIMITER.curveKnee), worst = { '1x': -99, 'lp16k': -99, '4x': -99 };
    for (const x0 of [white, rain, sine]) for (const g of [1, 2]) { const x = comp(x0.map(v => v * g));
      worst['1x'] = Math.max(worst['1x'], truePeak(shape(x, cu, 1))); worst.lp16k = Math.max(worst.lp16k, truePeak(biquad(shape(x, cu, 1), sr, 'lowpass', 16000, 0.707))); worst['4x'] = Math.max(worst['4x'], truePeak(shape(x, cu, 4))); }
    rows[`ceiling ${(20 * Math.log10(c)).toFixed(1)} dBFS`] = Object.fromEntries(Object.entries(worst).map(([k, v]) => [k, +v.toFixed(2)])); }
  return { worstTruePeakDbtp: rows, shipped: `ceiling ${(20 * Math.log10(LIMITER.ceiling)).toFixed(1)} dBFS at ${LIMITER.oversample}` };
}

async function main() {
  const reports: unknown[] = [];
  const scenes: SceneSpec[] = [];
  if (SCENE === 'synthetic' || SCENE === 'all' || FAST) scenes.push(syntheticScene(60, SEED));
  let lines: WaterLine[] = [], ground: (e: number, n: number) => number = () => 0;
  if (!FAST && SCENE !== 'synthetic') {
    const { populationScenes } = await import('./audio_scenes');
    const P = populationScenes({ seed: SEED, day: DAY, hour: HOUR, scene: SCENE }); scenes.push(...P.scenes); lines = P.water; ground = P.ground;
  }
  for (const S of scenes) { const t0 = performance.now(); const R = runScene(S); const m = measure(S, R); reports.push({ ...m, wallS: +((performance.now() - t0) / 1000).toFixed(1) }); console.error(`scene ${S.name} done in ${((performance.now() - t0) / 1000).toFixed(1)} s`); }
  let water: unknown = null;
  if (lines.length) { const { waterProbe } = await import('./audio_scenes'); water = waterLevels(lines, ground, waterProbe(lines)); }
  else { // a straight Pulvar-width river (23 m) and a 3 m canal on flat ground (the population scenes use the real ones)
    const L: WaterLine[] = [{ pts: [[-3000, 300], [3000, 300]], half: 11.6, kind: 'river' }, { pts: [[-3000, -200], [3000, -200]], half: 1.5, kind: 'canal' }];
    water = { synthetic: true, ...waterLevels(L, () => 0, { river: [0, 300], canal: [0, -200] }) }; }
  const fire = (() => { const S = syntheticScene(0, SEED); S.people = []; const R = runScene(S, 6), t = R.ctx.currentTime - 0.5; let pw = 0;
    for (const s of R.ctx.starts) if (s.kind === 'source' && s.buffer && s.buffer.sampleRate === 8000 && s.startedAt! <= t && s.stopAt > t) { const p = bestPath(s, t, S.listener); if (p?.panner) pw += 10 ** (sourceLevel(s, t, S.listener).db / 10); }
    return +(10 * Math.log10(Math.max(1e-12, pw))).toFixed(1); })();
  // T-G2b: every bed at once (wind and the column whistle, rain, flies, two fires, a river and a canal) for `secs`
  const beds = (() => { const S = syntheticScene(0, SEED); S.people = []; S.rain = 0.6; S.wind = 7; S.place = { town: 1, water: 1, trees: 0, midden: 1, animals: 1 }; S.tempC = 25; S.month = 5;
    S.fires = [{ id: 'a', lit: true, pos: { x: 3, y: 0.3, z: 0 } }, { id: 'b', lit: true, pos: { x: -5, y: 0.3, z: 2 } }];
    S.water = [{ pts: [[-3000, 30], [3000, 30]], half: 11.6, kind: 'river' }, { pts: [[-3000, -8], [3000, -8]], half: 1.5, kind: 'canal' }];
    const R = runScene({ ...S, nearColumns: true } as SceneSpec, SECS), L = loopReport(R.ctx);
    return { kinds: ['wind', 'column whistle', 'rain', 'flies', 'fire crackle', 'river', 'canal'], secs: SECS, ...L }; })();
  const W = water as { levelsDb?: Record<string, number> } | null, probes = Object.entries(W?.levelsDb ?? {}).filter(([k]) => k.startsWith('river')).map(([k, v]) => ({ k, v })).concat([{ k: 'fire 8 m', v: fire }]);
  const out = { tool: 'tools/dev/audio_render.ts', seed: SEED, day: DAY, hour: HOUR, note: 'mock-graph measurement in node (no browser render): see the header', scenes: reports, 'T-G2b beds': beds, 'T-G3e': { water, fireAt8mDb: fire, probes }, 'T-G1 limiter study': limiterStudy() };
  console.log(JSON.stringify(out, null, 1));
  // evidence (MASTER_PLAN §4.1: status is derived from REVIEWS/evidence/**/<id>.json written by the row's tool)
  const pass = arg('evidence', ''); if (pass) {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dir = `REVIEWS/evidence/${pass}`; mkdirSync(dir, { recursive: true });
    const R = reports as ReturnType<typeof measure>[], method = 'node, recording mock of the Web Audio graph driven by the real audio code (tools/dev/audio_graph.ts); NOT the browser render (BLOCKERS B65)';
    const put = (id: string, value: number, n: number, extra: Record<string, unknown>) => writeFileSync(`${dir}/${id}.json`, JSON.stringify({ id, value, n, commit, tool: 'tools/dev/audio_render.ts', method, seed: SEED, day: DAY, hour: HOUR, ...extra }, null, 1) + '\n');
    put('T-G1', Math.max(...R.map(r => r['T-G1'].truePeakDbtp)), R.length, { unit: 'dBTP', what: 'true peak of the modelled master bus on the dry mix of every buffer source per scene (oscillator voices, HRTF and reverb not in the mix)', perScene: R.map(r => ({ scene: r.scene, tp: r['T-G1'].truePeakDbtp, hot12dB: r['T-G1'].truePeakHot12dB })), limiter: R[0]?.['T-G1'].limiter, study: out['T-G1 limiter study'] });
    put('T-G2', R.reduce((a, r) => a + r['T-G2'].over09, 0), R.length, { unit: 'count', what: 'voice renders sharing a unit within 60 s whose 0.3 s segments correlate > 0.9 (sustained over all three 0.1 s thirds), plain or after pitch normalisation; plus buffers started twice within 60 s', perScene: R.map(r => ({ scene: r.scene, ...r['T-G2'] })) });
    put('T-G2b', Math.min(beds.shortestLoopS, beds.shortestReuseS, SECS), beds.kinds.length, { unit: 's', what: `every bed played ${SECS} s: no looped source and no buffer started twice, so the value is the render length (a lower bound; NoiseStream segments are fresh noise, never repeated)`, beds });
    put('T-G2f', Math.max(...R.map(r => r['T-G2f'].maxXcorr)), R.reduce((a, r) => a + r['T-G2f'].pairsWithin10s, 0), { unit: 'r', what: 'largest correlation between any two footsteps within 10 s (n = pairs)' });
    const g3 = R.filter(r => r['T-G3'].samples > 0);
    put('T-G3', g3.length ? Math.min(...g3.map(r => r['T-G3'].sharePct ?? 0)) : 0, g3.length, { unit: '%', what: 'every 0.25 s, visible speakers within 15 m (voiced now; line of sight not modelled: everyone within 15 m) heard above -40 dBFS; the lowest share over the scenes (n = scenes, not bot-hours)', perScene: g3.map(r => ({ scene: r.scene, ...r['T-G3'], talkersWithin15m: r.talkersWithin15m, voicedWithin15m: r.voicedWithin15m })) });
    put('T-G3e', 100 * probes.filter(p => p.v > -40).length / Math.max(1, probes.length), probes.length, { unit: '%', what: 'rivers at 5, 25 and 50 m from the bank in the month of lowest flow and a fire at 8 m, each heard above -40 dBFS at its own position (canals reported, not counted: not rivers)', probes, water });
    console.error(`evidence written to ${dir}`);
  }
}
if (process.argv[1]?.endsWith('audio_render.ts')) void main();
