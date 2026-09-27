// D-296 (UD-18): what is HEARD when a person answers. The heard world stays period (§10; UD-18 keeps it so by default): the
// person speaks in their own voice (audio/voices.ts personVoice) and their own language, in the units the crowd's voices use
// (audio/voices.ts unitsFor: a whole published or composed line, or one attested lexicon word; never joined into new
// sentences, one to three units a turn with pauses), the line chosen by what the English reply does (greets, agrees,
// refuses, answers); a people without a usable corpus answers in wordless voice (WORDLESS). The English is shown in the
// translation layer only: the heard line is NOT a translation of it (tier C, said so in the layer's label).
import { FormantBackend } from '../../audio/speech';
import { personVoice, unitsFor, voiceLang, WORDLESS, type Unit } from '../../audio/voices';
import { candidateLines, type Intent } from '../speech_lines';
import { voiceIdentity } from '../talkers';
import { Rng, hashString } from '../../core/rng';
import type { Population } from '../population';

export interface Heard { units: Unit[]; lang: string; seconds: number; data: Float32Array; rate: number; rms: number }

/** what the English reply does, for the line's intent (C) */
export function intentsOf(english: string): Intent[] {
  const t = english.toLowerCase();
  if (/^(greetings|peace|welcome|good (morning|day|evening))\b/.test(t)) return ['greet', 'pious', 'reply'];
  if (/^(no|not|never|i do not|i don’t|i don't)\b/.test(t)) return ['refuse', 'reply'];
  if (/^(yes|aye|indeed|truly|it is so)\b/.test(t)) return ['affirm', 'reply'];
  if (/\b(gods?|auramazda|humban|napiri|marduk)\b/.test(t)) return ['pious', 'reply'];
  if (/(farewell|go well|go in peace)/.test(t)) return ['farewell', 'reply'];
  return ['reply', 'remark', 'affirm'];
}

const LANG_LABEL: Record<string, string> = { op: 'Old Persian', el: 'Elamite', arc: 'Aramaic', bab: 'Babylonian', grc: 'Greek' };
/** the heard reply of person `pid` for an English answer: units, rendered with the person's own voice */
export function heardReply(pop: Population, pid: number, day: number, english: string, worldSeed: number, rate = 24000): Heard {
  const id = voiceIdentity(null, pid, pop, day, worldSeed); const v = personVoice(id); const { lang } = voiceLang(id.lang, id.langs);
  const r = new Rng((id.seed ^ hashString(english)) >>> 0, 'converse.heard');
  const want = Math.min(3, Math.max(1, Math.round(english.split(/\s+/).length / 7)));
  const units: Unit[] = [];
  if (lang) {
    // the line: one of every line that fits what the reply does (all its intents' candidates together: the first intent
    // alone often has a single line, heard again and again in the first world run)
    const U = unitsFor(lang); const cands = intentsOf(english).flatMap(intent => candidateLines({ langs: [LANG_LABEL[lang]], intent })?.lines ?? []).map(l => U.lines.find(u => u.id === l.id)).filter((u): u is Unit => !!u);
    const line = cands.length ? cands[r.int(0, cands.length - 1)] : null; if (line) units.push(line);
    while (units.length < want && U.words.length) { const w = r.pick(U.words); if (!units.includes(w)) units.push(w); }
  } else { while (units.length < want) units.push(r.pick(WORDLESS)); }
  const fb = new FormantBackend(rate); const parts: Float32Array[] = []; const gap = new Float32Array(Math.round(rate * 0.35));
  for (const u of units) { parts.push(fb.renderSync({ ipa: u.ipa, lang: lang ?? undefined, voice: v, intonation: u.intonation }).data); parts.push(gap); }
  const n = parts.reduce((a, p) => a + p.length, 0); const data = new Float32Array(n); let o = 0; for (const p of parts) { data.set(p, o); o += p.length; }
  let s = 0; for (let i = 0; i < n; i++) s += data[i] * data[i];
  return { units, lang: lang ?? 'wordless', seconds: n / rate, data, rate, rms: Math.sqrt(s / Math.max(1, n)) };
}
