// D-336 probe: the people's voices on this machine's GPU (or WASM): load time, one unit's render time, a reply's first
// audio (own language, English, Farsi), throughput under a crowd's load, and clips for the naturalness check in node.
// ?device=webgpu|wasm&dtypes=fp16,fp32
import { NeuralVoices, PRIO } from '../../src/audio/neural/client';
import { neuralVoice } from '../../src/audio/neural/identity';
import { phonemesFor } from '../../src/audio/neural/kokoro';
import { unitsFor } from '../../src/audio/voices';
import { chunks } from '../../src/people/converse/voice';

const P = new URLSearchParams(location.search);
const out: any = { device: P.get('device') ?? 'auto', runs: [] };
(window as any).__probe = out;
const b64 = (x: Float32Array) => { const i16 = new Int16Array(x.length); for (let k = 0; k < x.length; k++) i16[k] = Math.max(-32768, Math.min(32767, Math.round(x[k] * 32767))); let s = ''; const u8 = new Uint8Array(i16.buffer); for (let k = 0; k < u8.length; k += 8192) s += String.fromCharCode(...u8.subarray(k, k + 8192)); return btoa(s); };
for (const dtype of (P.get('dtypes') ?? P.get('dtype') ?? 'fp16').split(',')) {
  const run: any = { dtype }; out.runs.push(run); const t0 = performance.now();
  const N = new NeuralVoices({ device: (P.get('device') as any) ?? undefined, dtype });
  run.ok = await N.ready; run.loadMs = performance.now() - t0; run.device = N.stats.device;
  if (!run.ok) { run.error = N.stats.lastError; N.dispose(); continue; }
  const people = Array.from({ length: 12 }, (_, i) => neuralVoice({ seed: 1000 + i * 77, sex: i % 2 ? 'f' : 'm', age: [8, 25, 34, 47, 60, 72][i % 6], lang: ['Persian', 'Elamite', 'Syrian', 'Ionian', 'Babylonian', 'Median'][i % 6] }));
  const reply = 'Yes, my wife is at home grinding the barley, and my son is with the flock.';
  const faText = 'بله، زنم در خانه جو آرد می‌کند و پسرم با گله است.';
  const U = unitsFor('op');
  // a reply's first audio: the first piece (chunks: the first sentence cut at its comma), as the conversation renders it
  const own: number[] = [], en: number[] = [], fa: number[] = [], enAll: number[] = [];
  for (let k = 0; k < 4; k++) {
    const v = people[k * 3 % 12];
    let t = performance.now(); await N.say(v, { phonemes: phonemesFor(U.lines[k % U.lines.length].ipa) }); own.push(performance.now() - t);
    t = performance.now(); const ps = chunks(reply).map(text => N.say(v, { text, lang: 'en' })); await ps[0]; en.push(performance.now() - t); await Promise.all(ps); enAll.push(performance.now() - t);
    t = performance.now(); await N.say(v, { text: chunks(faText)[0], lang: 'fa' }); fa.push(performance.now() - t);
  }
  run.firstAudioMs = { own, en, fa, enWhole: enAll };
  // clips for the naturalness check in node (UTMOS on this dtype's output)
  run.clips = [];
  for (const [k, v] of people.slice(0, 4).entries()) { const r = await N.say(v, { phonemes: phonemesFor(U.lines[(k + 1) % U.lines.length].ipa) }); if (r) run.clips.push({ k, rate: r.rate, b64: b64(r.pcm) });
    const e = await N.say(v, { text: reply, lang: 'en' }); if (e) run.clips.push({ k, en: true, rate: e.rate, b64: b64(e.pcm) }); }
  // a crowd's load: 12 people × 8 units each, all queued at once (the bed and the near voices)
  const t1 = performance.now(); const jobs: Promise<any>[] = [];
  for (const v of people) for (let j = 0; j < 8; j++) { const u = U.words[(j * 13 + people.indexOf(v)) % U.words.length]; jobs.push(N.say(v, { phonemes: phonemesFor(u.ipa, u.intonation) }, PRIO.voice)); }
  const res = await Promise.all(jobs); const audioS = res.reduce((a, r) => a + (r ? r.pcm.length / r.rate : 0), 0);
  run.crowd = { units: jobs.length, wallMs: performance.now() - t1, audioS, realtime: audioS / ((performance.now() - t1) / 1000), renderMs: res.map(r => Math.round(r?.ms ?? -1)) };
  run.stats = { ...N.stats }; N.dispose();
}
out.done = true;
