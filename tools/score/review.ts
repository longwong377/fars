// A listener's self-review of the score by measurement (D-760; the cloud has no ears): for every cue's opening minute and its
// last minute (where the director's fades meet silence), and for the theme's cuts, it reports what a listener would hear go
// wrong:
//  - clipping: true peak (dBTP) and the count of samples within 0.1 dB of the ceiling;
//  - harshness: the share of energy in 2.5-6 kHz (the ear's most sensitive, fatiguing band) against the whole, in dB, and
//    its worst 1 s window (a brass or string blare);
//  - jumps: the largest rise in short-term loudness between consecutive 1 s windows (a sudden stab, or a seam);
//  - the start and the end: silence before the first sound, the level of the last second (a cue must end in silence, not cut);
//  - repetition: the most similar pair of 8 s windows within a cue (chroma correlation: a loop the ear would notice);
//  - level against speech: the cue's loudness as the world plays it (x the director's gain and the default score volume),
//    and under a conversation (the duck), against speech at -20 LUFS (the voices' own normalisation, C).
// With --excerpts, writes the 60 s excerpts (opening, close) to <out>/ as Opus for a human's quick listen.
//   npx tsx tools/score/review.ts [out dir] [--excerpts]
// Thresholds (C): a harsh second is one whose 2.5-6 kHz share exceeds -9 dB (bright solo passages sit at -8 to -12; a full
// orchestra at -12 to -18); a repetition is a chroma correlation over 0.995 (held chords that return score 0.98-0.99).
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { readWav } from './lib/wav';
import { biquad, fft, lufs, truePeak } from './lib/dsp';
import { DIRECTOR, DUCK } from '../../src/audio/score';

const ROOT = resolve(import.meta.dirname, '../..'), WORK = process.env.SCORE_WORK ?? join(homedir(), '.cache/parsa-score/work');
const OUT = resolve(process.argv[2] ?? join(WORK, 'review')); mkdirSync(OUT, { recursive: true });
const man = JSON.parse(readFileSync(join(ROOT, 'public/audio/score/manifest.json'), 'utf8')).cues as Record<string, any>;
const SPEECH = -20, VOL = 0.8; // speech loudness (LUFS, C) and the default score volume (src/audio/score.ts)
const dB = (x: number) => 20 * Math.log10(x + 1e-12);

function bandShare(ch: Float32Array[], sr: number) { // energy in 2.5-6 kHz vs all (dB)
  const m = ch[0].map((v, i) => (v + ch[1][i]) / 2), b = biquad(biquad(m, sr, 'hp', 2500, 0.7), sr, 'lp', 6000, 0.7);
  let e = 0, eb = 0; for (let i = 0; i < m.length; i++) { e += m[i] * m[i]; eb += b[i] * b[i]; } return 10 * Math.log10(eb / (e + 1e-12) + 1e-12);
}
function chroma(x: Float32Array, sr: number): number[] { // a 12-bin pitch-class profile of a window (FFT 16384)
  const N = 16384, re = new Float64Array(N), im = new Float64Array(N), out = new Array(12).fill(0);
  for (let i = 0; i < N && i < x.length; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  fft(re, im); for (let k = 8; k < N / 2; k++) { const f = (k * sr) / N; if (f < 60 || f > 4000) continue; const pcl = Math.round(12 * Math.log2(f / 440) + 69) % 12; out[(pcl + 12) % 12] += Math.hypot(re[k], im[k]); }
  const n = Math.hypot(...out) || 1; return out.map(v => v / n);
}
const rows: string[] = [], flags: string[] = [];
for (const [id, c] of Object.entries(man)) {
  const wav = join(WORK, `${id}.master.wav`); if (!existsSync(wav)) { flags.push(`${id}: no master`); continue; }
  const a = readWav(wav), sr = a.sr, n = a.ch[0].length, sec = n / sr;
  const tp = truePeak(a.ch), nearCeil = a.ch.reduce((k, ch) => k + ch.filter(v => Math.abs(v) > 10 ** (-1.6 / 20)).length, 0);
  // short-term loudness each second (3 s window) and its largest rise
  const st: number[] = []; for (let t = 0; t + 3 <= sec; t += 1) st.push(lufs(a.ch.map(ch => ch.subarray(t * sr, (t + 3) * sr)), sr));
  let jump = 0, jumpAt = 0; for (let i = 1; i < st.length; i++) if (st[i - 1] > -60 && st[i] - st[i - 1] > jump) { jump = st[i] - st[i - 1]; jumpAt = i; }
  // harshness overall and its worst second
  const harsh = bandShare(a.ch, sr); let worst = -99, worstAt = 0;
  for (let t = 0; t + 1 <= sec; t += 1) { const v = bandShare(a.ch.map(ch => ch.subarray(t * sr, (t + 1) * sr)), sr); const l = lufs(a.ch.map(ch => ch.subarray(Math.max(0, t - 1) * sr, Math.min(sec, t + 2) * sr)), sr); if (l > -35 && v > worst) { worst = v; worstAt = t; } }
  // the start's silence and the end's level
  let first = 0; const thr = 10 ** (-50 / 20); while (first < n && Math.abs(a.ch[0][first]) < thr && Math.abs(a.ch[1][first]) < thr) first++;
  const endPk = dB(Math.max(...a.ch.map(ch => ch.subarray(n - sr).reduce((m, v) => Math.max(m, Math.abs(v)), 0))));
  // repetition: the most alike pair of 8 s windows at least 16 s apart
  const W = 8, win: { t: number; c: number[]; l: number }[] = [];
  for (let t = 0; t + W <= sec; t += 4) { const s = a.ch[0].subarray(t * sr, (t + W) * sr); win.push({ t, c: chroma(s, sr), l: lufs(a.ch.map(ch => ch.subarray(t * sr, (t + W) * sr)), sr) }); }
  let rep = 0, repAt = ''; for (let i = 0; i < win.length; i++) for (let j = i + 4; j < win.length; j++) { if (win[i].l < -40 || win[j].l < -40) continue; const r = win[i].c.reduce((s, v, k) => s + v * win[j].c[k], 0) * (1 - Math.min(1, Math.abs(win[i].l - win[j].l) / 12)); if (r > rep) { rep = r; repAt = `${win[i].t}s~${win[j].t}s`; } }
  // level in the world: the master's loudness x the director's gain x the default volume; under talk, x the duck
  const L = lufs(a.ch, sr), inWorld = c.tags.includes('film') ? L + dB(VOL) : L + dB(DIRECTOR.gain * VOL), underTalk = inWorld + dB(DUCK);
  rows.push(`${id.padEnd(20)} ${sec.toFixed(0).padStart(4)} s  TP ${tp.toFixed(1).padStart(5)}  ceil ${String(nearCeil).padStart(4)}  harsh ${harsh.toFixed(1).padStart(5)} (worst ${worst.toFixed(1)} @${worstAt}s)  jump +${jump.toFixed(1)} @${jumpAt}s  start ${(first / sr).toFixed(2)} s  end ${endPk.toFixed(0)} dB  rep ${rep.toFixed(2)} ${repAt}  world ${inWorld.toFixed(1)} / talk ${underTalk.toFixed(1)} LUFS`);
  if (tp > -1) flags.push(`${id}: true peak ${tp.toFixed(1)} dBTP`);
  if (worst > -9) flags.push(`${id}: harsh second at ${worstAt} s (${worst.toFixed(1)} dB in 2.5-6 kHz)`);
  if (jump > 9) flags.push(`${id}: a ${jump.toFixed(1)} LU jump at ${jumpAt} s`);
  if (first / sr > 3) flags.push(`${id}: ${(first / sr).toFixed(1)} s of silence before the first sound`);
  if (endPk > -50) flags.push(`${id}: the last second still sounds (${endPk.toFixed(0)} dB): a cut, not an ending`);
  if (rep > 0.995) flags.push(`${id}: two 8 s windows nearly identical (${repAt}, r ${rep.toFixed(3)})`);
  if (!c.tags.includes('film') && underTalk > SPEECH - 12) flags.push(`${id}: under a conversation only ${(SPEECH - underTalk).toFixed(1)} dB below speech`);
  // the excerpts for a human: the opening minute and the closing minute
  if (process.argv.includes('--excerpts')) for (const [tag, ss] of [['open', 0], ['close', Math.max(0, sec - 60)]] as const)
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(ss), '-t', '60', '-i', wav, '-c:a', 'libopus', '-b:a', '96k', join(OUT, `${id}.${tag}.opus`)]);
}
const report = ['# score self-review (tools/score/review.ts)', '', '```', ...rows, '```', '', flags.length ? '## flags' : '## flags: none', ...flags.map(f => `- ${f}`), ''].join('\n');
writeFileSync(join(OUT, 'review.md'), report); console.log(report);
