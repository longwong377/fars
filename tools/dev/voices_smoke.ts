// D-336 smoke: render a few people's lines with Kokoro in node, time them, measure MOS and embeddings.
import { mkdirSync } from 'node:fs';
import { kokoro, Instruments, to16k, cos, wav } from './voices_measure';
import { neuralVoice } from '../../src/audio/neural/identity';
import { phonemesFor } from '../../src/audio/neural/kokoro';

const OUT = process.env.OUT ?? 'T:/fars-assets-s12/voices/smoke'; mkdirSync(OUT, { recursive: true });
const t0 = performance.now(); const K = await kokoro((process.env.DTYPE as any) ?? 'fp32'); console.log('kokoro loaded', ((performance.now() - t0) / 1000).toFixed(1), 's');
const I = await Instruments.load(); console.log('instruments loaded', ((performance.now() - t0) / 1000).toFixed(1), 's');
const lines = [['op', 'baɡa wazr̩ka auramazdaː'], ['arc', 'ʃəlaːm ləkoːn'], ['grc', 'ˈkʰaire ˈksenε'], ['el', 'kurtaʃ kapnuʃkip']];
const people = [{ seed: 11, sex: 'm', age: 34, lang: 'Persian' }, { seed: 12, sex: 'm', age: 30, lang: 'Persian' }, { seed: 13, sex: 'f', age: 25, lang: 'Syrian' }, { seed: 14, sex: 'f', age: 60, lang: 'Ionian' }, { seed: 15, sex: 'm', age: 8, lang: 'Elamite' }] as const;
const embs: Float32Array[] = [];
for (const p of people) {
  const v = neuralVoice(p as any); console.log(p, JSON.stringify(v.mix), v.speed, v.tract);
  const all: Float32Array[] = [];
  for (const [l, ipa] of lines) { const ph = phonemesFor(ipa); const t = performance.now(); const x = await K.speak(ph, v); const ms = performance.now() - t;
    const x16 = to16k(x, 24000); const mos = await I.mos(x16); console.log(' ', l, ph, (x.length / 24000).toFixed(2), 's audio', ms.toFixed(0), 'ms', 'MOS', mos?.toFixed(2)); wav(`${OUT}/${p.seed}_${l}.wav`, x, 24000); all.push(x16); }
  const cat = new Float32Array(all.reduce((a, x) => a + x.length, 0)); let o = 0; for (const x of all) { cat.set(x, o); o += x.length; }
  embs.push(await I.wavlm(cat));
}
for (let i = 0; i < embs.length; i++) console.log(embs.map(e => cos(embs[i], e).toFixed(3)).join(' '));
