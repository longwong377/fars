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
  /** the person's own step off the blend, in units of the voices' spread per dimension (runner.ts), and its direction's seed */ jitter?: number; jitterSeed?: number;
}
/** the style voices left out of the blends: below the naturalness floor on the period languages' lines (UTMOS22 mean of two
 *  sets of lines < 3.6, or English < 4.0, or Farsi < 3.7; tools/dev/voices_calib.ts, REVIEWS/evidence/s12-voices/calib.json).
 *  Mostly the voices trained on little data (the Spanish, French, Portuguese and Japanese ones) and the breathy or caricatured
 *  ones (af_nicole's whisper, the 'santa' voices). zm_yunxi and zm_yunyang passed once all 54 were measured, after the pool
 *  was fixed for the eval: left out for now */
export const EXCLUDED = new Set(['af_bella', 'af_jessica', 'af_nicole', 'am_santa', 'bf_alice', 'bf_lily', 'bm_george', 'bm_lewis', 'ef_dora', 'em_alex', 'em_santa', 'ff_siwis',
  'hm_omega', 'if_sara', 'jf_alpha', 'jf_gongitsune', 'jf_nezumi', 'jf_tebukuro', 'pf_dora', 'pm_alex', 'pm_santa', 'zf_xiaobei', 'zf_xiaoni', 'zf_xiaoxiao', 'zf_xiaoyi', 'zm_yunjian', 'zm_yunxi', 'zm_yunxia', 'zm_yunyang']);
/** the style voices a person may be blended from */
export const VOICE_POOL: { m: string[]; f: string[] } = {
  m: BASE_VOICES.filter(v => v[1] === 'm' && !EXCLUDED.has(v[0])).map(v => v[0]),
  f: BASE_VOICES.filter(v => v[1] === 'f' && !EXCLUDED.has(v[0])).map(v => v[0]),
};
/** voices that read as older (C: the deep British and American voices of the pool; with the older tract and pace) */
export const OLDER = new Set(['am_onyx', 'bm_daniel', 'bm_fable', 'bf_isabella', 'af_river']);
/** the regional colour: the trained languages whose voices a people's blend draws one voice from (C) */
export const COLOUR: Record<string, string[]> = {
  Persian: ['hi', 'en-gb'], Median: ['hi', 'en-gb'], Iranian: ['hi', 'en-gb'], Bactrian: ['hi'], Sogdian: ['hi'], Elamite: ['hi', 'it'],
  Babylonian: ['it', 'hi'], Syrian: ['it', 'hi'], Aramaic: ['it', 'hi'], Egyptian: ['hi', 'it'],
  Ionian: ['it', 'en-gb'], Greek: ['it', 'en-gb'], Lydian: ['it', 'en-gb'], Carian: ['it', 'en-gb'], Lycian: ['it', 'en-gb'], Thracian: ['en-gb', 'it'], Cappadocian: ['hi', 'it'],
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
