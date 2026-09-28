// D-336 smoke: English reply -> Farsi (NLLB-200 distilled 600M, q8) -> eSpeak-NG fa phonemes -> Kokoro in the person's voice
import { readFileSync } from 'node:fs';
import { MODELS, kokoro, Instruments, to16k, cos, wav } from './voices_measure';
import { neuralVoice } from '../../src/audio/neural/identity';
import { phonemesFor, espeakToKokoro } from '../../src/audio/neural/kokoro';
import { espeakIpa } from '../../src/audio/neural/g2p';

const tf: any = await import('@huggingface/transformers'); tf.env.allowRemoteModels = false;
const t0 = performance.now();
const tr = await tf.pipeline('translation', `${MODELS}/Xenova/nllb-200-distilled-600M/resolve/main`, { dtype: 'q8' });
console.log('nllb loaded', ((performance.now() - t0) / 1000).toFixed(1));
const g = JSON.parse(readFileSync('T:/fars-assets-s12/talk/gpu_run3.json', 'utf8')).result.te9['gemma-2-2b-it-q4f16_1-MLC'];
const K = await kokoro(); const I = await Instruments.load({ ecapa: false });
const v = neuralVoice({ seed: 11, sex: 'm', age: 34, lang: 'Persian' });
const own = await K.speak(phonemesFor('baɡa wazr̩ka auramazdaː'), v); const eOwn = await I.wavlm(to16k(own, 24000));
for (const row of g.slice(0, 8)) {
  const t = performance.now(); const out = await tr(row.reply, { src_lang: 'eng_Latn', tgt_lang: 'pes_Arab', max_new_tokens: 96 }); const fa = out[0].translation_text; const tms = performance.now() - t;
  const ipaFa = await espeakIpa(fa, 'fa'), ipaEn = await espeakIpa(row.reply, 'en');
  const pf = espeakToKokoro(ipaFa, 'fa'), pe = espeakToKokoro(ipaEn, 'en');
  const xf = await K.speak(pf, v), xe = await K.speak(pe, v);
  const f16 = to16k(xf, 24000), e16 = to16k(xe, 24000);
  console.log(JSON.stringify({ en: row.reply, fa, ms: Math.round(tms), pf, mosFa: +(await I.mos(f16))!.toFixed(2), mosEn: +(await I.mos(e16))!.toFixed(2), simFaOwn: +cos(await I.wavlm(f16), eOwn).toFixed(3), simEnOwn: +cos(await I.wavlm(e16), eOwn).toFixed(3) }));
  wav(`T:/fars-assets-s12/voices/smoke/fa_${row.i}.wav`, xf, 24000); wav(`T:/fars-assets-s12/voices/smoke/en_${row.i}.wav`, xe, 24000);
}
