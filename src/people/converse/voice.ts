// D-296 (UD-18): what is HEARD when a person answers. The heard world stays period (§10; UD-18 keeps it so by default): the
// person speaks in their own voice and their own language, in the units the crowd's voices use (audio/voices.ts unitsFor: a
// whole published or composed line, or one attested lexicon word; never joined into new sentences, one to three units a turn
// with pauses), the line chosen by what the English reply does (greets, agrees, refuses, answers); a people without a usable
// corpus answers in wordless voice (WORDLESS). The English is shown in the translation layer only: the heard line is NOT a
// translation of it (tier C, said so in the layer's label).
// D-336 (UD-22): the voice is the person's own natural voice (audio/neural: Kokoro-82M, one blend of style voices per person,
// the same identity as their murmur in the crowd), and the player may choose (settings.hearIn, off by default: 'own') to hear
// the reply itself, in character (the same fenced reply of the same life), in Farsi or English, in THE SAME VOICE. The
// user's own words (UD-22) open this out-of-world option; the default heard world is unchanged. The formant synthesiser
// (heardReply) stays as the fallback when the model cannot run (PLACEHOLDER-QUALITY).
import { FormantBackend } from '../../audio/speech';
import { personVoice, unitsFor, voiceLang, WORDLESS, type Unit } from '../../audio/voices';
import { neuralVoice, type NeuralVoice } from '../../audio/neural/identity';
import { phonemesFor } from '../../audio/neural/kokoro';
import type { NeuralVoices } from '../../audio/neural/client';
import { candidateLines, type Intent } from '../speech_lines';
import { voiceIdentity } from '../talkers';
import { Rng, hashString } from '../../core/rng';
import type { Population } from '../population';
import type { Agent } from '../sim';

export type HearIn = 'own' | 'fa' | 'en';
export interface Heard { units: Unit[]; lang: string; seconds: number; data: Float32Array; rate: number; rms: number; /** D-336 */ layer?: HearIn; backend?: string; firstMs?: number; text?: string }

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
/** the person's voice identity (the crowd's: a detailed agent by their own seed, the population by the world's) */
export function replyVoice(pop: Population, pid: number, day: number, worldSeed: number, agent: Agent | null = null) {
  const id = voiceIdentity(agent, pid, pop, day, worldSeed);
  return { id, formant: personVoice(id), neural: neuralVoice({ seed: id.seed, sex: id.sex, age: id.age, lang: id.lang }) as NeuralVoice };
}
/** the units of the heard reply in the person's own language (or wordless) */
export function replyUnits(pop: Population, pid: number, day: number, english: string, worldSeed: number, agent: Agent | null = null): { units: Unit[]; lang: string | null } {
  const { id } = replyVoice(pop, pid, day, worldSeed, agent); const { lang } = voiceLang(id.lang, id.langs);
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
  return { units, lang };
}
const join = (parts: Float32Array[], rate: number, gapS = 0.35) => {
  const gap = Math.round(rate * gapS), n = parts.reduce((a, p) => a + p.length + gap, 0), data = new Float32Array(n); let o = 0;
  for (const p of parts) { data.set(p, o); o += p.length + gap; }
  let s = 0; for (let i = 0; i < n; i++) s += data[i] * data[i]; return { data, rms: Math.sqrt(s / Math.max(1, n)) };
};
/** the heard reply of person `pid` for an English answer, rendered by the formant synthesiser (the fallback) */
export function heardReply(pop: Population, pid: number, day: number, english: string, worldSeed: number, rate = 24000, agent: Agent | null = null): Heard {
  const { formant: v } = replyVoice(pop, pid, day, worldSeed, agent), { units, lang } = replyUnits(pop, pid, day, english, worldSeed, agent);
  const fb = new FormantBackend(rate);
  const { data, rms } = join(units.map(u => fb.renderSync({ ipa: u.ipa, lang: (lang ?? undefined) as any, voice: v, intonation: u.intonation }).data), rate);
  return { units, lang: lang ?? 'wordless', seconds: data.length / rate, data, rate, rms, layer: 'own', backend: 'formant' };
}
/** sentences of a reply for the opt-in layer (each one synthesis: short dispatches, and the first plays while the next renders) */
export const sentences = (t: string) => t.split(/(?<=[.!?؟…])\s+/).map(s => s.trim()).filter(Boolean);
/** the synthesis jobs of a heard reply: the own language's units (their phonemes), or the opt-in layer's sentences */
export function replyJobs(layer: HearIn, units: Unit[], english: string, farsi?: string | null): ({ phonemes: string } | { text: string; lang: 'fa' | 'en' })[] {
  if (layer === 'own') return units.map(u => ({ phonemes: phonemesFor(u.ipa, u.intonation) }));
  return sentences(layer === 'fa' ? farsi! : english).map(text => ({ text, lang: layer }));
}
/** D-336: the heard reply in the person's own natural voice: their own language (the units), or with the opt-in, the reply
 *  itself in Farsi (`farsi`: the in-character reply in Persian, converse/farsi.ts) or English. `onChunk` gets each piece as it
 *  is ready (the first audio's time is `firstMs`, from the call) */
export async function heardReplyNeural(nv: NeuralVoices, pop: Population, pid: number, day: number, english: string, worldSeed: number,
  o: { hearIn?: HearIn; farsi?: string | null; agent?: Agent | null; onChunk?: (pcm: Float32Array, rate: number) => void } = {}): Promise<Heard | null> {
  const t0 = performance.now(); const { neural: v } = replyVoice(pop, pid, day, worldSeed, o.agent ?? null);
  const layer: HearIn = o.hearIn === 'fa' && o.farsi ? 'fa' : o.hearIn === 'en' ? 'en' : 'own';
  const { units, lang } = replyUnits(pop, pid, day, english, worldSeed, o.agent ?? null);
  // all queued at once (the worker renders them in order); each is played as soon as it and those before it are ready
  const ps = replyJobs(layer, units, english, o.farsi).map(j => nv.say(v, j)); const parts: Float32Array[] = []; let rate = 24000, firstMs = -1;
  for (const p of ps) { const r = await p; if (!r || !r.pcm.length) continue; rate = r.rate; parts.push(r.pcm); if (firstMs < 0) firstMs = performance.now() - t0; o.onChunk?.(r.pcm, r.rate); }
  if (!parts.length) return null;
  const { data, rms } = join(parts, rate, layer === 'own' ? 0.35 : 0.18);
  return { units: layer === 'own' ? units : [], lang: layer === 'own' ? (lang ?? 'wordless') : layer, seconds: data.length / rate, data, rate, rms, layer, backend: 'kokoro', firstMs, text: layer === 'own' ? undefined : (layer === 'fa' ? o.farsi! : english) };
}
