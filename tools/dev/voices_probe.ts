// D-336 probe: the people's voices on this machine's GPU (or WASM): load time, one unit's render time, a reply's first
// audio (own language, English, Farsi), throughput under a crowd's load. ?device=webgpu|wasm&dtype=fp32|fp16|q8
import { NeuralVoices, PRIO } from '../../src/audio/neural/client';
import { neuralVoice } from '../../src/audio/neural/identity';
import { phonemesFor } from '../../src/audio/neural/kokoro';
import { unitsFor } from '../../src/audio/voices';

const P = new URLSearchParams(location.search);
const out: any = { device: P.get('device') ?? 'auto', dtype: P.get('dtype') ?? 'auto' };
(window as any).__probe = out;
const t0 = performance.now();
const N = new NeuralVoices({ device: (P.get('device') as any) ?? undefined, dtype: P.get('dtype') ?? undefined });
out.ok = await N.ready; out.loadMs = performance.now() - t0; out.stats0 = { ...N.stats };
if (out.ok) {
  const people = Array.from({ length: 12 }, (_, i) => neuralVoice({ seed: 1000 + i * 77, sex: i % 2 ? 'f' : 'm', age: [8, 25, 34, 47, 60, 72][i % 6], lang: ['Persian', 'Elamite', 'Syrian', 'Ionian', 'Babylonian', 'Median'][i % 6] }));
  // one reply: own language (two units), English, Farsi, first audio after the text
  const reply = 'Yes, my wife is at home grinding the barley, and my son is with the flock.';
  const faText = 'بله، زنم در خانه جو آرد می‌کند و پسرم با گله است.';
  const U = unitsFor('op');
  const own: number[] = [], en: number[] = [], fa: number[] = [];
  for (let k = 0; k < 4; k++) {
    const v = people[k * 3 % 12];
    let t = performance.now(); await N.say(v, { phonemes: phonemesFor(U.lines[k % U.lines.length].ipa) }); own.push(performance.now() - t);
    t = performance.now(); await N.say(v, { text: reply, lang: 'en' }); en.push(performance.now() - t);
    t = performance.now(); await N.say(v, { text: faText, lang: 'fa' }); fa.push(performance.now() - t);
  }
  out.replyMs = { own, en, fa };
  // a crowd's load: 12 people × 8 units each, all queued at once (the bed and the near voices)
  const t1 = performance.now(); const jobs: Promise<any>[] = []; const each: number[] = [];
  for (const v of people) for (let j = 0; j < 8; j++) { const u = U.words[(j * 13 + people.indexOf(v)) % U.words.length]; const t = performance.now();
    jobs.push(N.say(v, { phonemes: phonemesFor(u.ipa, u.intonation) }, PRIO.voice).then(r => { each.push(performance.now() - t); return r; })); }
  const res = await Promise.all(jobs); const audioS = res.reduce((a, r) => a + (r ? r.pcm.length / r.rate : 0), 0);
  out.crowd = { units: jobs.length, wallMs: performance.now() - t1, audioS, realtime: audioS / ((performance.now() - t1) / 1000), renderMs: res.map(r => r?.ms ?? -1) };
}
out.stats = { ...N.stats }; out.done = true;
