// D-336: the Farsi (nllb route) of the in-character replies the voices eval speaks, translated once and kept
// (REVIEWS/evidence/s12-voices/replies_fa.json: the eval's Farsi text; the llm route's is measured on the GPU apart)
import { readFileSync, writeFileSync } from 'node:fs';
import { MODELS } from './voices_measure';
import { fenceFa } from '../../src/people/converse/farsi';
const F = 'REVIEWS/evidence/s12-voices/replies.json', O = 'REVIEWS/evidence/s12-voices/replies_fa.json';
const R: string[] = JSON.parse(readFileSync(F, 'utf8')).replies;
const tf: any = await import('@huggingface/transformers'); tf.env.allowRemoteModels = false;
const tr = await tf.pipeline('translation', `${MODELS}/Xenova/nllb-200-distilled-600M/resolve/main`, { dtype: 'q8' });
const rows: any[] = [];
for (const en of R) { const t = performance.now(); const fa = String((await tr(en, { src_lang: 'eng_Latn', tgt_lang: 'pes_Arab', max_new_tokens: 120, num_beams: 2 }))[0].translation_text).trim();
  rows.push({ en, fa, ms: Math.round(performance.now() - t), hits: fenceFa(fa) }); console.log(JSON.stringify(rows.at(-1))); }
writeFileSync(O, JSON.stringify({ what: 'NLLB-200 distilled 600M (q8, 2 beams, node) Persian of replies.json: the nllb route', rows }, null, 1));
