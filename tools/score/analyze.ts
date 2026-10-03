// Measures a rendered cue (the composer cannot hear it in the cloud: this is how it is checked): short-term loudness every
// 2 s (BS.1770, 3 s window), the true peak, silences, and a spectrogram picture (ffmpeg) for the eye.
//   npx tsx tools/score/analyze.ts <master.wav> [png]
import { execFileSync } from 'node:child_process';
import { readWav } from './lib/wav';
import { lufs, truePeak } from './lib/dsp';
const [file, png] = process.argv.slice(2);
const a = readWav(file), sr = a.sr, n = a.ch[0].length, line: string[] = [];
for (let t = 0; t + 3 <= n / sr; t += 2) { const s = Math.round(t * sr), e = s + 3 * sr; const v = lufs(a.ch.map(c => c.subarray(s, e)), sr); line.push(`${String(t).padStart(3)}s ${v < -60 ? ' -inf' : v.toFixed(1).padStart(5)} ${'#'.repeat(Math.max(0, Math.round((v + 50) / 1.5)))}`); }
console.log(line.join('\n'));
console.log(`integrated ${lufs(a.ch, sr).toFixed(1)} LUFS, true peak ${truePeak(a.ch).toFixed(1)} dBTP, ${(n / sr).toFixed(1)} s`);
if (png) execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-lavfi', 'showspectrumpic=s=1600x600:legend=1:scale=log:fscale=log:color=intensity', png]);
