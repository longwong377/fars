// D-336 (UD-22): the people's voices are Kokoro-82M (hexgrad, Apache-2.0; a StyleTTS2 / iSTFTNet model of 82 M parameters
// that takes phonemes, not letters). What is pure here (no model): the phoneme vocabulary, the mapping of the lexicon's
// reconstructed IPA (and eSpeak-NG's output for the Farsi and English layer) onto that vocabulary, the blend of the model's
// 54 style voices into one person's own style, and the vocal-tract resampling that sets a person's size (a child, a big man).
// Shared by the browser worker (neural_worker.ts), the node tools (tools/dev/voices_eval.ts) and the tests.

export const KOKORO_REPO = 'onnx-community/Kokoro-82M-v1.0-ONNX';
export const KOKORO_RATE = 24000;
export const STYLE_DIM = 256;
/** rows of a style voice file: one 256-float style per input length (tokens between the pads), 510 of them */
export const STYLE_ROWS = 510;

/** the model's phoneme vocabulary (tokenizer.json of the ONNX export; id 0 is the pad '$') */
export const VOCAB: Readonly<Record<string, number>> = { '$': 0, ';': 1, ':': 2, ',': 3, '.': 4, '!': 5, '?': 6, '—': 9, '…': 10, '"': 11, '(': 12, ')': 13, '“': 14, '”': 15, ' ': 16, '̃': 17, 'ʣ': 18, 'ʥ': 19, 'ʦ': 20, 'ʨ': 21, 'ᵝ': 22, 'ꭧ': 23, 'A': 24, 'I': 25, 'O': 31, 'Q': 33, 'S': 35, 'T': 36, 'W': 39, 'Y': 41, 'ᵊ': 42, 'a': 43, 'b': 44, 'c': 45, 'd': 46, 'e': 47, 'f': 48, 'h': 50, 'i': 51, 'j': 52, 'k': 53, 'l': 54, 'm': 55, 'n': 56, 'o': 57, 'p': 58, 'q': 59, 'r': 60, 's': 61, 't': 62, 'u': 63, 'v': 64, 'w': 65, 'x': 66, 'y': 67, 'z': 68, 'ɑ': 69, 'ɐ': 70, 'ɒ': 71, 'æ': 72, 'β': 75, 'ɔ': 76, 'ɕ': 77, 'ç': 78, 'ɖ': 80, 'ð': 81, 'ʤ': 82, 'ə': 83, 'ɚ': 85, 'ɛ': 86, 'ɜ': 87, 'ɟ': 90, 'ɡ': 92, 'ɥ': 99, 'ɨ': 101, 'ɪ': 102, 'ʝ': 103, 'ɯ': 110, 'ɰ': 111, 'ŋ': 112, 'ɳ': 113, 'ɲ': 114, 'ɴ': 115, 'ø': 116, 'ɸ': 118, 'θ': 119, 'œ': 120, 'ɹ': 123, 'ɾ': 125, 'ɻ': 126, 'ʁ': 128, 'ɽ': 129, 'ʂ': 130, 'ʃ': 131, 'ʈ': 132, 'ʧ': 133, 'ʊ': 135, 'ʋ': 136, 'ʌ': 138, 'ɣ': 139, 'ɤ': 140, 'χ': 142, 'ʎ': 143, 'ʒ': 147, 'ʔ': 148, 'ˈ': 156, 'ˌ': 157, 'ː': 158, 'ʰ': 162, 'ʲ': 164, '↓': 169, '→': 171, '↗': 172, '↘': 173, 'ᵻ': 177 };

/** the model's 54 style voices: [name, sex, the language it was trained to speak] (voices/<name>.bin, 510 × 256 floats) */
export const BASE_VOICES: readonly (readonly [string, 'm' | 'f', string])[] = ([
  'af_alloy', 'af_aoede', 'af_bella', 'af_heart', 'af_jessica', 'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
  'am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael', 'am_onyx', 'am_puck', 'am_santa',
  'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily', 'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis',
  'ef_dora', 'em_alex', 'em_santa', 'ff_siwis', 'hf_alpha', 'hf_beta', 'hm_omega', 'hm_psi', 'if_sara', 'im_nicola',
  'jf_alpha', 'jf_gongitsune', 'jf_nezumi', 'jf_tebukuro', 'jm_kumo', 'pf_dora', 'pm_alex', 'pm_santa',
  'zf_xiaobei', 'zf_xiaoni', 'zf_xiaoxiao', 'zf_xiaoyi', 'zm_yunjian', 'zm_yunxi', 'zm_yunxia', 'zm_yunyang',
] as const).map(n => [n, n[1] === 'f' ? 'f' : 'm', ({ a: 'en-us', b: 'en-gb', e: 'es', f: 'fr', h: 'hi', i: 'it', j: 'ja', p: 'pt', z: 'zh' } as Record<string, string>)[n[0]]] as const);

/** the lexicon's reconstructed IPA (and eSpeak-NG's) onto the model's symbols. What the model has no symbol for is spoken
 *  as its nearest neighbour (C): the pharyngeals of Aramaic (ħ as a strong h, ʕ as a glottal catch), emphatic ˤ dropped
 *  (its backing kept on a following a as ɑ), syllabic r̩ as əɾ, syllabic nasals as their consonant, tie bars joined into the
 *  model's affricate letters */
export function toKokoro(ipa: string): string {
  let s = ipa.normalize('NFC').replace(/‍/g, '');
  s = s.replace(/t͡ʃ|tʃ/g, 'ʧ').replace(/d͡ʒ|dʒ/g, 'ʤ').replace(/t͡s/g, 'ʦ').replace(/d͡z/g, 'ʣ').replace(/͡/g, '');
  s = s.replace(/r̩/g, 'əɾ').replace(/l̩/g, 'əl').replace(/([mn])̩/g, '$1');
  s = s.replace(/ˤa/g, 'ɑ').replace(/ˤ/g, '').replace(/ħ/g, 'h').replace(/ʕ/g, 'ʔ').replace(/ɬ/g, 'l').replace(/ʷ/g, 'w').replace(/ɦ/g, 'h');
  s = s.replace(/[ɢ]/g, 'q').replace(/ɫ/g, 'l').replace(/[ʏ]/g, 'y').replace(/ʉ/g, 'u').replace(/[ɵ]/g, 'o').replace(/ɘ/g, 'ə').replace(/ɒː/g, 'ɒː');
  s = s.replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();
  let out = ''; for (const ch of s) if (ch in VOCAB) out += ch;
  return out;
}
/** the model's input: the phonemes with the utterance's end mark (a fall ends in '.', a rise in '?', level in '…') */
export function phonemesFor(ipa: string, intonation: 'fall' | 'rise' | 'level' = 'fall'): string {
  const p = toKokoro(ipa); if (!p) return '';
  return /[.!?…,;:]$/.test(p) ? p : p + (intonation === 'rise' ? '?' : intonation === 'level' ? '…' : '.');
}
/** eSpeak-NG's IPA (the Farsi and English layer) into the model's: joiners out, affricates joined, the kokoro-js English
 *  rules (r as ɹ, x as k, ɬ as l) for English only */
export function espeakToKokoro(ipa: string, lang: 'fa' | 'en'): string {
  let s = ipa.replace(/‍/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/tʃ/g, 'ʧ').replace(/dʒ/g, 'ʤ');
  if (lang === 'en') s = s.replace(/ʲ/g, 'j').replace(/r/g, 'ɹ').replace(/x/g, 'k').replace(/ɬ/g, 'l');
  let out = ''; for (const ch of s) if (ch in VOCAB) out += ch;
  return out;
}
/** token ids with the pads (at most 510 phonemes: longer input is cut at the last space before it) */
export function tokenize(phonemes: string): number[] {
  let p = [...phonemes]; if (p.length > STYLE_ROWS - 2) { const cut = p.lastIndexOf(' ', STYLE_ROWS - 2); p = p.slice(0, cut > 0 ? cut : STYLE_ROWS - 2); }
  return [0, ...p.map(c => VOCAB[c]).filter(x => x !== undefined), 0];
}

/** one person's style: the weighted blend of style voices at the row for this input length (the style depends on it) */
export function blendStyle(table: (name: string) => Float32Array, mix: readonly (readonly [string, number])[], nTokens: number): Float32Array {
  const row = Math.min(Math.max(nTokens - 2, 0), STYLE_ROWS - 1), out = new Float32Array(STYLE_DIM); let wsum = 0;
  for (const [, w] of mix) wsum += w;
  for (const [name, w] of mix) { const t = table(name), o = row * STYLE_DIM; for (let i = 0; i < STYLE_DIM; i++) out[i] += (w / wsum) * t[o + i]; }
  return out;
}

/** resample by `r` (a vocal tract r times shorter: pitch and formants × r, the length / r), windowed sinc, low-passed below
 *  the new Nyquist when r > 1 */
export function retract(x: Float32Array, r: number, taps = 16): Float32Array {
  if (Math.abs(r - 1) < 1e-4) return x;
  const n = Math.floor(x.length / r), y = new Float32Array(n), fc = Math.min(1, 1 / r) * 0.94;
  for (let i = 0; i < n; i++) {
    const t = i * r, c = Math.floor(t); let acc = 0, ws = 0;
    for (let k = c - taps + 1; k <= c + taps; k++) { if (k < 0 || k >= x.length) continue; const d = t - k;
      const sinc = d === 0 ? 1 : Math.sin(Math.PI * fc * d) / (Math.PI * fc * d), win = 0.5 + 0.5 * Math.cos(Math.PI * d / taps); const w = fc * sinc * win; acc += w * x[k]; ws += w; }
    y[i] = ws ? acc / ws : 0;
  }
  return y;
}
/** trim the model's leading and trailing silence (below −50 dB of the peak, keeping 30 ms), and set the level to an RMS of
 *  `rms` over the voiced part */
export function tidyClip(x: Float32Array, rate = KOKORO_RATE, rms = 0.08): Float32Array {
  let peak = 0; for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i])); if (!peak) return x;
  const th = peak * 0.00316, pad = Math.round(0.03 * rate); let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < th) a++; while (b > a && Math.abs(x[b]) < th) b--;
  const y = x.slice(Math.max(0, a - pad), Math.min(x.length, b + pad));
  let s = 0, m = 0; for (let i = 0; i < y.length; i++) if (Math.abs(y[i]) > th * 10) { s += y[i] * y[i]; m++; }
  const g = m ? Math.min(rms / Math.sqrt(s / m), 0.95 / peak) : 1; for (let i = 0; i < y.length; i++) y[i] *= g;
  const f = Math.min(y.length >> 1, Math.round(0.008 * rate)); for (let i = 0; i < f; i++) { const w = i / f; y[i] *= w; y[y.length - 1 - i] *= w; }
  return y;
}
