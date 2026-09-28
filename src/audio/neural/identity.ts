// D-336 (UD-22): a person's own voice. Everyone has one, from their seed, sex, age and people (C: the choices below are a
// reconstruction of how varied a town's voices are, not evidence of any one voice): a blend of three of Kokoro's style
// voices of their sex (weights from the seed), one of them drawn from the voices of a "regional colour" pool for their people
// (the style voices' own trained languages give their prosody and timbre a colour; which pool a people draws from is C),
// their size (vocal-tract length: pitch and formants together; a child's much shorter), their pace, and older voices slower
// and lower. Stable for the life of the person (the seed is the save's); the same identity speaks their own language and the
// Farsi or English of the opt-in layer, so the person is recognisably the same voice in all three.
import { Rng, hashString } from '../../core/rng';
import { BASE_VOICES } from './kokoro';

export interface NeuralVoice {
  key: string; sex: 'm' | 'f'; age: number;
  /** the style blend: [style voice, weight] */
  mix: readonly (readonly [string, number])[];
  /** pace (1 = the model's own) */ speed: number;
  /** vocal-tract scale: pitch and formants × tract (1 = the blend's own; a child 1.15–1.35) */ tract: number;
  /** speaking level (RMS of the voiced part) */ level: number;
  /** a small offset in style space, the person's own (optional) */ offset?: Float32Array;
}
/** the style voices a person may be blended from (D-336: measured on the lexicon's lines, tools/dev/voices_eval.ts
 *  --bases: the ones below the naturalness floor are left out) */
export const VOICE_POOL: { m: string[]; f: string[] } = {
  m: BASE_VOICES.filter(v => v[1] === 'm').map(v => v[0]),
  f: BASE_VOICES.filter(v => v[1] === 'f').map(v => v[0]),
};
/** voices that read as older (C, by ear and by the measured pitch: the "santa" voices, the deep British and American men) */
export const OLDER = new Set(['am_santa', 'em_santa', 'pm_santa', 'bm_george', 'bm_lewis', 'am_onyx', 'hm_omega', 'bf_isabella', 'af_nicole']);
/** the regional colour: the trained languages whose voices a people's blend draws one voice from (C) */
export const COLOUR: Record<string, string[]> = {
  Persian: ['hi', 'en-gb'], Median: ['hi', 'en-gb'], Iranian: ['hi', 'en-gb'], Bactrian: ['hi'], Sogdian: ['hi'], Elamite: ['hi', 'pt'],
  Babylonian: ['es', 'pt', 'hi'], Syrian: ['es', 'pt'], Aramaic: ['es', 'pt'], Egyptian: ['pt', 'es', 'fr'],
  Ionian: ['it', 'es', 'fr'], Greek: ['it', 'es', 'fr'], Lydian: ['it', 'fr'], Carian: ['it', 'pt'], Lycian: ['it', 'pt'], Thracian: ['fr', 'it'], Cappadocian: ['pt', 'hi'],
};
const LANG_OF = new Map(BASE_VOICES.map(v => [v[0], v[2]]));

export interface VoiceSeed { seed: number; sex: 'm' | 'f'; age: number; /** their people or language label (origin) */ lang?: string }
export function neuralVoice(p: VoiceSeed): NeuralVoice {
  const r = new Rng((p.seed ^ 0x5eed7) >>> 0, 'voice.neural'), child = p.age < 13, old = p.age >= 55;
  // children: the women's voices (boys and girls alike before the voice breaks) at a much shorter tract (C)
  const sex = child ? 'f' : p.sex, pool = VOICE_POOL[sex];
  const colour = COLOUR[p.lang ?? ''] ?? [], cpool = pool.filter(n => colour.includes(LANG_OF.get(n)!));
  const pickFrom = (xs: string[], not: string[]) => { const c = xs.filter(x => !not.includes(x)); return c[r.int(0, c.length - 1)]; };
  const names: string[] = [];
  if (old) { const o = pool.filter(n => OLDER.has(n)); if (o.length) names.push(pickFrom(o, names)); }
  if (cpool.length && r.chance(0.8)) names.push(pickFrom(cpool, names));
  while (names.length < 3) names.push(pickFrom(pool, names));
  const w = names.map(() => -Math.log(1 - r.next() * 0.999) + 0.15);
  const mix = names.map((n, i) => [n, +w[i].toFixed(4)] as const);
  const tract = child ? 1.34 - 0.02 * Math.max(0, p.age - 3) + 0.04 * (r.next() - 0.5) : (old ? 0.965 : 1) * (0.94 + 0.12 * r.next());
  const speed = (child ? 1.02 : old ? 0.9 : 1) * (0.9 + 0.18 * r.next());
  return { key: `nv:${(p.seed >>> 0).toString(36)}:${p.sex}${p.age}`, sex: p.sex, age: p.age, mix, speed: +speed.toFixed(4), tract: +tract.toFixed(4), level: 0.07 + 0.03 * r.next() };
}
/** a short stable id of a voice (cache keys) */
export const voiceKey = (v: NeuralVoice) => `${hashString(JSON.stringify([v.mix, v.speed, v.tract])).toString(36)}`;
