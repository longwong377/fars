// D-336 (B190): wordless voice through the neural voices: the units as the lexicon writes them and other spellings of the
// same sounds, each person's clip scored by UTMOS (a predictor of speech naturalness: its reading of a hum is part of what is measured)
import { kokoro, Instruments, to16k, wav } from './voices_measure';
import { WORDLESS, LAUGH } from '../../src/audio/voices';
import { phonemesFor } from '../../src/audio/neural/kokoro';
import { neuralVoice } from '../../src/audio/neural/identity';
const K = await kokoro(); const I = await Instruments.load({ ecapa: false });
const cat = (xs: Float32Array[]) => { const gap = 0.3 * 24000, n = xs.reduce((a, x) => a + x.length + gap, 0), o = new Float32Array(n); let k = 0; for (const x of xs) { o.set(x, k); k += x.length + gap; } return o; };
const sets: Record<string, string[]> = {
  lexicon: WORDLESS.map(u => phonemesFor(u.ipa, u.intonation)),
  spelled: ['hˈmm.', 'mˈhm.', 'ʌhˈʌ.', 'hmˈm?', 'ˈʌm…', 'ˈɑː.', 'ˈoʊ.', 'mˈm…'],
  laugh: LAUGH.map(u => phonemesFor(u.ipa, u.intonation)),
};
for (const [i, p] of [{ seed: 3, sex: 'm', age: 30, lang: 'Lycian' }, { seed: 4, sex: 'f', age: 28, lang: 'Egyptian' }, { seed: 5, sex: 'm', age: 60, lang: 'Carian' }].entries()) {
  const v = neuralVoice(p as any);
  for (const [k, ph] of Object.entries(sets)) { const x = cat(await Promise.all(ph.map(q => K.speak(q, v)))); wav(`T:/fars-assets-s12/voices/smoke/wordless_${k}_${i}.wav`, x, 24000);
    console.log(i, k, (x.length / 24000).toFixed(1), 's', 'MOS', (await I.mos(to16k(x, 24000)))!.toFixed(2)); }
}
