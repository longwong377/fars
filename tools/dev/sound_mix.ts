// The recorded mix, measured (D-620): the soundscape run in the recording mock context (tools/dev/audio_graph.ts) with the
// real files of public/audio decoded through ffmpeg, in a few scenes; for each, the level at the listener (dBFS, the
// buffer's RMS through its path's gains, filters and distance law) of every source playing, labelled recorded or
// synthesised. Used to set sampler.ts BED_LEVEL against the synthesised beds' levels (C: a mix by measurement, not by ear).
// Usage: npx tsx tools/dev/sound_mix.ts
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { AudioEngine } from '../../src/audio/engine';
import { Soundscape } from '../../src/audio/soundscape';
import { SoundLibrary } from '../../src/audio/library';
import { MockContext, sourceLevel, type MockNode } from './audio_graph';

const SR = 16000;
export async function scene(name: string, u: Parameters<Soundscape['update']>[1], secs = 10, recordings = true) {
  const ctx = new MockContext(48000), e = new AudioEngine(); e.attach(ctx as unknown as AudioContext); e.setVolumes({ master: 0.9, ambience: 1, voices: 1, music: 1, effects: 1 });
  const recorded = new Set<unknown>();
  const lib = new SoundLibrary('/', {
    fetch: async url => { const f = 'public' + url; return (recordings || url.endsWith('manifest.json') && false) && existsSync(f) ? readFileSync(f).buffer as ArrayBuffer : null; },
    decode: async data => {
      const r = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-ac', '2', '-ar', String(SR), '-f', 'f32le', '-'], { input: Buffer.from(data), maxBuffer: 1 << 30 });
      const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length >> 2), n = x.length >> 1, b = ctx.createBuffer(2, n, SR);
      for (let i = 0; i < n; i++) { b.getChannelData(0)[i] = x[2 * i]; b.getChannelData(1)[i] = x[2 * i + 1]; } recorded.add(b); return b as unknown as AudioBuffer;
    },
  });
  lib.start(ctx as unknown as BaseAudioContext); const s = new Soundscape(e, lib);
  const tick = () => new Promise(r => setTimeout(r, 0));
  for (let i = 0; i < secs * 30; i++) { s.update(1 / 30, u); ctx.advance(1 / 30); if (i % 10 === 0) for (let k = 0; k < 30; k++) await tick(); }
  const t = ctx.currentTime - 0.3, lis = u.listener;
  const rows = ctx.starts.filter(n => n.kind === 'source' && n.buffer && n.startedAt! <= t && n.stopAt > t).map((n: MockNode) => ({ rec: recorded.has(n.buffer), db: sourceLevel(n, t, lis).db, dur: n.buffer!.duration }))
    .filter(r => Number.isFinite(r.db));
  const sum = (xs: typeof rows) => 10 * Math.log10(xs.reduce((a, r) => a + 10 ** (r.db / 10), 0) || 1e-12);
  return { name, recordedDb: sum(rows.filter(r => r.rec)), synthDb: sum(rows.filter(r => !r.rec)), n: rows.length, beds: s.beds.line() };
}
const base = { hour: 12, month: 3, windMs: 3, rain: 0, insideSpace: 'open', nearColumns: false, stepPhase: 0, running: false, surface: 'earth' as const, fires: [], listener: { x: -1500, y: 1.6, z: -500 }, worksite: null, workHours: false, tempC: 20 };
if (process.argv[1]?.endsWith('sound_mix.ts')) {
  const scenes: [string, Parameters<Soundscape['update']>[1]][] = [
    ['orchard, spring noon, light wind', { ...base, place: { town: 0, water: 0, trees: 0.9, midden: 0, animals: 0 } }],
    ['plain, warm night', { ...base, hour: 23, month: 6, place: { town: 0, water: 0, trees: 0, midden: 0, animals: 0 } }],
    ['plain, rain', { ...base, rain: 0.4, windMs: 5, place: { town: 0, water: 0, trees: 0, midden: 0, animals: 0 } }],
    ['plain, storm', { ...base, rain: 0.9, windMs: 14, place: { town: 0, water: 0, trees: 0, midden: 0, animals: 0 } }],
    ['a fire at 3 m', { ...base, hour: 20, fires: [{ id: 'f', lit: true, pos: { x: -1497, y: 0.3, z: -500 } }], place: { town: 0, water: 0, trees: 0, midden: 0, animals: 0 } }],
  ];
  for (const [n, u] of scenes) { const r = await scene(n, u), b = await scene(n, u, 10, false);
    console.log(`${''.padEnd(36)} without recordings: ${b.synthDb.toFixed(1)} dBFS; with: ${(10 * Math.log10(10 ** (r.recordedDb / 10) + 10 ** (r.synthDb / 10))).toFixed(1)} dBFS`); console.log(`${r.name.padEnd(36)} recorded ${r.recordedDb.toFixed(1).padStart(6)} dBFS · synthesised ${r.synthDb.toFixed(1).padStart(6)} dBFS · ${r.n} sources · ${r.beds}`); }
}
