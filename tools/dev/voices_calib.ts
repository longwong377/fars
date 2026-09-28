// (VOICE_DEVICE=dml: the T4 through DirectML, ~10x the loaded CPU; through tools/dev/gpu_slot.mjs)
// D-336: calibrating the speaker-embedding instruments on this synthesiser, and each style voice's naturalness. Kokoro's 54
// style voices are 54 different speakers (each trained from its own speaker's recordings); each speaks two different sets of
// the lexicon's lines (A, B: ~5 s each), an English and a Farsi sentence. Same speaker = A vs B (and A vs English / Farsi:
// across languages) of one voice; different speakers = A of one voice vs A of another. The equal-error threshold of each
// embedding on this material is the "same-speaker threshold" T-E11 uses (a model's published threshold is for its own
// recordings; WavLM-SV's 0.86 is VoxCeleb's). UTMOS of A and English per voice: the pool's naturalness floor.
//   npx tsx tools/dev/voices_calib.ts   ->  REVIEWS/evidence/s12-voices/calib.json
import { writeFileSync } from 'node:fs';
import { kokoro, Instruments, to16k, cos } from './voices_measure';
import { BASE_VOICES, phonemesFor, espeakToKokoro } from '../../src/audio/neural/kokoro';
import { espeakIpa } from '../../src/audio/neural/g2p';
import { unitsFor } from '../../src/audio/voices';

const K = await kokoro(); const I = await Instruments.load();
const L = (['op', 'el', 'arc', 'grc', 'bab'] as const).map(l => unitsFor(l).lines);
const A = L.map(x => x[0]).concat(unitsFor('op').lines.slice(2, 4)), B = L.map(x => x[1] ?? x[0]).concat(unitsFor('el').lines.slice(2, 4));
const en = espeakToKokoro(await espeakIpa('Not too bad. The stair is a bit steep, but my son helps me with the grain, and my wife brings the bread.', 'en'), 'en');
const fa = espeakToKokoro(await espeakIpa('بد نیست. پله کمی تند است، اما پسرم در کار غله کمکم می‌کند و زنم نان می‌آورد.', 'fa'), 'fa');
const cat = (xs: Float32Array[]) => { const n = xs.reduce((a, x) => a + x.length, 0), o = new Float32Array(n); let k = 0; for (const x of xs) { o.set(x, k); k += x.length; } return o; };
const rows: any[] = [];
for (const [name, sex, lang] of BASE_VOICES) {
  const v = { key: name, sex, age: 30, mix: [[name, 1]] as [string, number][], speed: 1, tract: 1, level: 0.08 };
  const say = async (us: typeof A) => to16k(cat(await Promise.all(us.map(async u => K.speak(phonemesFor(u.ipa, u.intonation), v)))), 24000);
  const a = await say(A), b = await say(B), e = to16k(await K.speak(en, v), 24000), f = to16k(await K.speak(fa, v), 24000);
  const r = { name, sex, lang, sec: +(a.length / 16000).toFixed(2), mosA: +(await I.mos(a))!.toFixed(3), mosB: +(await I.mos(b))!.toFixed(3), mosEn: +(await I.mos(e))!.toFixed(3), mosFa: +(await I.mos(f))!.toFixed(3),
    w: [await I.wavlm(a), await I.wavlm(b), await I.wavlm(e), await I.wavlm(f)], c: [await I.ecapa(a), await I.ecapa(b), await I.ecapa(e), await I.ecapa(f)] };
  rows.push(r); console.log(name, r.sec, r.mosA, r.mosB, r.mosEn, r.mosFa, 'same w', cos(r.w[0], r.w[1]).toFixed(3), 'c', cos(r.c[0]!, r.c[1]!).toFixed(3), 'en c', cos(r.c[0]!, r.c[2]!).toFixed(3), 'fa c', cos(r.c[0]!, r.c[3]!).toFixed(3));
}
const eer = (same: number[], diff: number[]) => { let best = { t: 0, eer: 1 }; for (let t = -0.2; t <= 1; t += 0.002) { const fr = same.filter(x => x < t).length / same.length, fa = diff.filter(x => x >= t).length / diff.length; const e = Math.max(fr, fa); if (e < best.eer) best = { t: +t.toFixed(3), eer: +e.toFixed(4) }; } return best; };
const out: any = { what: 'the instruments calibrated on Kokoro\'s 54 style voices (54 speakers): same = one voice on two different sets of lines (A/B), and across languages (A vs English, A vs Farsi); different = A of two voices', models: {} };
for (const [k, key] of [['wavlm', 'w'], ['ecapa', 'c']] as const) {
  const same = rows.map(r => cos(r[key][0], r[key][1])), diff: number[] = [], sameSex: number[] = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) { const d = cos(rows[i][key][0], rows[j][key][0]); diff.push(d); if (rows[i].sex === rows[j].sex) sameSex.push(d); }
  const xEn = rows.map(r => cos(r[key][0], r[key][2])), xFa = rows.map(r => cos(r[key][0], r[key][3]));
  const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(4); };
  out.models[k] = { eer: eer(same, diff), eerSameSex: eer(same, sameSex), same: { min: q(same, 0), p10: q(same, 0.1), med: q(same, 0.5) }, diff: { med: q(diff, 0.5), p90: q(diff, 0.9), p99: q(diff, 0.99), max: q(diff, 1) }, diffSameSex: { med: q(sameSex, 0.5), p99: q(sameSex, 0.99), max: q(sameSex, 1) },
    crossEn: { min: q(xEn, 0), med: q(xEn, 0.5) }, crossFa: { min: q(xFa, 0), med: q(xFa, 0.5) } };
  console.log(k, JSON.stringify(out.models[k]));
}
out.voices = rows.map(({ w, c, ...r }) => r);
writeFileSync('REVIEWS/evidence/s12-voices/calib.json', JSON.stringify(out, null, 1));
