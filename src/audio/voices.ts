// Voices from the whole population (D-245; MASTER_PLAN §6 order step 1 "a crowd murmur bed and voices from population
// speakers"; T-G3 "visible speakers within 15 m audible (> −40 dB at the listener)"; audit D M6 "outside the Terrace nobody
// makes a human sound", M7 "the murmur reuses 6 phrases per language and voice").
//
// Who speaks: everyone the crowd places near the listener whose activity sounds as talk (activities.ts `sound: 'murmur'`:
// talking, eating in company, exchanging goods), from any source: the detailed agents, the population view's people, and
// impostors (people/crowd.ts nearPeople). Not only the 135 detailed agents.
//
// What they say: published words only (brief §10; D-241). An utterance is one published unit of the speaker's language:
// a whole line of people/speech_lines.ts (lexicon words in a published or composed order, as the scripted exchanges use
// them) or one attested lexicon entry (tier A/B: lang/lexicon.ts murmurEligible). Units are never joined into new
// sentences; a speaking turn is one to three units with pauses between them. A person never repeats a unit, or a word of
// one, within 60 s (MASTER_PLAN T-G2). Languages by origin (people/exchanges.ts HOME_LANG; brief §10). A people without a
// usable published corpus here (Egyptian, Lydian, Carian, Lycian, Cappadocian, Bactrian, Sogdian, Thracian, West Semitic
// speakers...) is never given another people's words (MASTER_PLAN T-K1a2): they gesture and use wordless voice (hums of
// assent and doubt, hesitations), with long pauses, unless the roster lists a second language of theirs that has a
// lexicon (a detailed agent's `langs`). A conversation whose members have different home languages is held in Aramaic,
// the lingua franca (brief §10; C), by those who have Aramaic or a lexicon language of their own; the wordless stay wordless.
//
// How they sound (D-336, UD-22): each person's own natural voice (audio/neural: Kokoro-82M in a worker, a blend of its style
// voices, their vocal-tract length and pace from their own seed, sex, age and people), each unit's clip cached per person
// and played with this utterance's own small pitch and pace variation. Until the model has loaded, or where it cannot run,
// the formant synthesiser speaks instead (speech.ts; PLACEHOLDER-QUALITY, tier C: each person their own formant voice from
// their seed, pushed apart from the voices in earshot, rendered afresh for every utterance with a new jitter seed).
//
// Conversation: talkers standing within 3 m of each other at the same place are one conversation and take turns (one
// speaks, the others listen; a short overlap now and then). The crowd moves a person's jaw only while their voice plays
// (world.ts → crowd.voice), so a visible speaker is a heard speaker.
//
// The crowd bed: talkers beyond the individual voices (farther than `clearR`, or more than `maxVoices`) up to `bedR` are
// heard as a murmur of independent grains: up to `bedStreams` overlapping streams (√n of the talkers), each grain one unit
// in the voice of a talker drawn near-weighted, placed at that talker, low-passed with distance. Nothing is looped or
// pooled across people: a grain is one of that talker's own units (D-336: one already rendered in their voice when there is
// one), never the same unit from them within 60 s.
//
// Cost: a unit renders in ~2–4 ms on the main thread (node, measured by tools/dev/audio_render.ts); renders are budgeted per
// update (`renderBudget` 2, `renderMs` 3); a speaker whose render does not fit waits a frame, silent (and so not moving the jaw).
import type { AudioEngine } from './engine';
import { FormantBackend, clipToBuffer, voiceBase, type VoiceParams, type Intonation, type Vec3 } from './speech';
import { tokenizeIpa } from './phonemes';
import { tongueOf, tongueUnits, EVERYDAY } from './tongues';
import { reconstructedUnit } from '../lang/reconstruct';
import { LEXICON, LANG_IDS, murmurEligible, spokenForm, type LangId } from '../lang/lexicon';
import { LINES } from '../people/speech_lines';
import { HOME_LANG } from '../people/exchanges';
import { Rng, hashString } from '../core/rng';
import { neuralVoice, type NeuralVoice } from './neural/identity';
import { PRIO, type NeuralVoices } from './neural/client';

/** a person near the listener, as the crowd places them this frame (world coordinates of the feet: x east, z = −north) */
export interface NearPerson {
  key: string; x: number; y: number; z: number;
  /** the activity sounds as talk (talk, eat, exchange) and they stand */
  talking: boolean; eating?: boolean;
  /** a sim language label (Agent.langs[0]) or an origin ('Ionian') mapped by HOME_LANG; `langs`: every language the
   *  roster lists for them (detailed agents) */
  lang: string; langs?: readonly string[]; sex: 'm' | 'f'; age: number; seed: number;
  /** the place of the plan (people at one place within 3 m form a conversation), or null */
  group: string | null;
  /** session 9: the way they face (world yaw, the rig's +Z forward: crowd.ts yawOf), when the crowd knows it (their breath) */
  yaw?: number;
  /** D-292 (C-D30, GA29): a woman with a small child in her arms, lap, cradle or on the mat beside her at its bedtime: she hums it
   *  to sleep (crowd.ts nearPeople) */
  lull?: boolean;
}
/** a published unit: a whole speech line or one attested lexicon entry; or, for a people without a corpus, a wordless voice */
export interface Unit { id: string; ipa: string; intonation: Intonation; kind: 'line' | 'word' | 'wordless'; parts: string[]; tier: string; gloss: string; translit: string }
/** the wordless voice (T-K1a2; C): hums of assent, doubt and thought, hesitations, a realising "ah"; no word of any language
 *  (each checked against the modern-word list by tests/audio_population.test.ts) */
export const WORDLESS: Unit[] = ([['mː', 'fall', 'a hum'], ['m̩ː', 'level', 'a long hum'], ['hmː', 'fall', 'a thoughtful hum'], ['mːhm', 'rise', 'a hum of assent'], ['m̩hm̩', 'fall', 'a hum of assent'],
  ['ʔm̩ʔm̩', 'fall', 'a hum of refusal'], ['əː', 'level', 'a hesitation'], ['əːm', 'level', 'a hesitation'], ['aː', 'fall', 'a realising "ah"'], ['ʔəː', 'rise', 'a questioning sound']] as const)
  .map(([ipa, intonation, gloss], i) => ({ id: `wordless:${i}`, ipa, intonation, kind: 'wordless' as const, parts: [`wordless:${i}`], tier: 'C', gloss: `(${gloss}; no published words of this language: T-K1a2)`, translit: '' }));

/** session 9 (WORLD_INVENTORY G33, "outside the Terrace nobody makes a human sound" beyond talk): the human sounds that are not
 *  language (C): laughter in company (voiceless h and an open vowel, pulsed and falling), a child's calls at play (long
 *  vowel glides, rising), a baby's cry (a glottal onset and a long front vowel, rising and falling in the cry's own pitch).
 *  No word of any language (each checked against the modern-word list by tests/audio_population.test.ts) */
const nonverbal = (tag: string, gloss: string, xs: readonly (readonly [string, Intonation])[]): Unit[] => xs.map(([ipa, intonation], i) => ({ id: `${tag}:${i}`, ipa, intonation, kind: 'wordless' as const, parts: [`${tag}:${i}`], tier: 'C', gloss: `(${gloss})`, translit: '' }));
export const LAUGH = nonverbal('laugh', 'laughter', [['hahaha', 'fall'], ['həhəhəhə', 'fall'], ['hahahaha', 'fall'], ['həhəhə', 'level']]);
export const CHILD_CALL = nonverbal('call', 'a child calling out at play', [['ɛːɔ', 'rise'], ['ɔːə', 'rise'], ['uːɔ', 'rise'], ['aːə', 'fall']]);
export const CRY = nonverbal('cry', 'a baby crying', [['ʔwɛːɛ', 'fall'], ['ʔɛːɛ', 'rise'], ['ʔwɛːə', 'fall']]);
/** G34: a cough (a glottal catch and a breathy burst, twice or thrice; never the single 'ʔhə', which the modern-word list reads as "he") */
export const COUGH = nonverbal('cough', 'a cough', [['ʔhəʔhə', 'fall'], ['ʔxəʔxə', 'fall'], ['ʔhəhəʔhə', 'fall'], ['kʰəʔhə', 'level']]);
/** how often (C): a listener laughs after one turn in LAUGH_P; a child's unit is a call in CHILD_CALL_P; a baby near the
 *  listener starts a bout of crying once in CRY_EVERY_S seconds on average, 3-10 cries with a gasp between */
export const LAUGH_P = 0.12, CHILD_CALL_P = 0.25, CRY_EVERY_S = 900;
/** D-292 (gap hunter C, C-D30; WORLD_INVENTORY GA29): a lullaby hummed to a small child at its bedtime, wordless (no song text
 *  of the period survives for it, and none is invented: brief §10, C): a slow tune of LULL_NOTES hummed notes on the steps of
 *  a narrow scale (semitones from her own pitch), falling to the end of each phrase, a breath between phrases; phrases for as
 *  long as she sits with it, with a rest now and then. The notes are the hums of WORDLESS */
export const LULL = nonverbal('lull', 'a lullaby hummed to a small child, without words', [['m̩ː', 'level'], ['mː', 'fall'], ['m̩ː', 'rise'], ['mː', 'level']]);
export const LULL_STEPS = [0, 2, 3, 5, 7] as const, LULL_NOTES: [number, number] = [4, 7], LULL_REST_P = 0.25;
/** a person near the listener coughs once in this many seconds on average (world.ts sets it by season: winter colds; C) */
export const COUGH_EVERY_S = 1200;

const UNITS = new Map<LangId, { lines: Unit[]; words: Unit[] }>();
const speakable = (ipa: string) => { try { return tokenizeIpa(ipa).length > 0; } catch { return false; } };
/** the published units of a language (lines without a role restriction; attested words) */
export function unitsFor(lang: LangId): { lines: Unit[]; words: Unit[] } {
  let u = UNITS.get(lang); if (u) return u;
  const lines = LINES.filter(l => l.lang === lang && !l.def.roles && speakable(l.ipa)).map(l => ({ id: l.id, ipa: l.ipa, intonation: l.intonation ?? 'fall', kind: 'line' as const, parts: l.entries.map(e => e.id), tier: l.tier, gloss: l.gloss, translit: l.translit }));
  const words = LEXICON[lang].filter(murmurEligible).filter(e => speakable(e.ipa!)).map(e => ({ id: e.id, ipa: e.ipa!, intonation: (hashString(e.id) % 5 === 0 ? 'rise' : hashString(e.id) % 3 === 0 ? 'level' : 'fall') as Intonation, kind: 'word' as const, parts: [e.id], tier: e.tier, gloss: e.gloss, translit: spokenForm(e) }));
  u = { lines, words }; UNITS.set(lang, u); return u;
}
const RC = new Map<LangId, Unit[]>();
/** D-720: the town's everyday sentences in a lexicon language as reconstructed period speech (lang/reconstruct.ts; tier C) */
export function rcLines(lang: LangId): Unit[] { let u = RC.get(lang); if (!u) RC.set(lang, u = EVERYDAY.map((en, i) => reconstructedUnit(en, lang, i)).filter(x => speakable(x.ipa) && x.ipa.split(' ').length >= 2)); return u; }
/** sim language labels with a lexicon (Iranian: the sim's label for Persians named from the Iranian pool; Medes are voiced
 *  in Old Persian through HOME_LANG, as the sim does: C) */
export const LEX_LABEL: Readonly<Record<string, LangId>> = { 'Old Persian': 'op', Iranian: 'op', Elamite: 'el', Aramaic: 'arc', Babylonian: 'bab', Greek: 'grc' };
/** the language a person speaks: their home language (origin through HOME_LANG, or a sim language label) when it has a
 *  lexicon, else a lexicon language the roster lists for them, else none: wordless voice (`lang` null) */
export function voiceLang(label: string, langs?: readonly string[]): { lang: LangId | null; via: string } {
  const own = LEX_LABEL[HOME_LANG[label] ?? label] ?? ((LANG_IDS as readonly string[]).includes(label) ? label as LangId : undefined);
  if (own) return { lang: own, via: label };
  for (const l of langs ?? []) { const x = LEX_LABEL[l]; if (x) return { lang: x, via: l }; }
  return { lang: null, via: 'wordless' };
}

/** a person's own voice from their seed (C: ranges about the synthesiser's base voices): pitch, pace, breathiness, timbre
 *  (formant scale), their own vowel space (F2/F3), how much their pitch wanders, how unevenly they time their phones and how
 *  strongly they accent, their glottis (a pressed or lax pulse) and its jitter and shimmer (more with age) */
export function personVoice(p: { seed: number; sex: 'm' | 'f'; age: number }): VoiceParams {
  const r = new Rng(p.seed >>> 0, 'voice.person');
  return { sex: p.sex, age: p.age, pitch: 0.86 + 0.3 * r.next(), rate: 0.88 + 0.26 * r.next(), breath: 0.08 * r.next(), formant: 0.93 + 0.14 * r.next(), f2: 0.95 + 0.1 * r.next(), wander: 0.015 + 0.03 * r.next(), durJitter: 0.1 + 0.1 * r.next(), accent: 0.7 + 0.7 * r.next(), glottis: r.next(), jitter: (p.age > 55 ? 0.012 : 0.005) + 0.01 * r.next(), shimmer: (p.age > 55 ? 0.04 : 0.02) + 0.03 * r.next(), seed: hashString(`pv:${p.seed}`) };
}
/** voice class: the synthesiser's base (child, woman, man; old) */
export const vclass = (v: VoiceParams) => (v.age < 13 ? 'c' : v.sex) + (v.age > 50 ? 'o' : '');
/** the scale of "alike": two voices closer than one unit of this together (normalised distance < 1) sound alike (C). The
 *  axes: effective pitch (log F0 after the age and sex base: ~0.6 semitone), the timbre left once the pitch is normalised
 *  (log formant scale minus log F0: a pitch-shifted copy of one voice is ~0 on it; 2.5 %), pace (6 %), the glottis (0.3 of
 *  its range) and the vowel space (F2/F3, 3 %). A new voice is kept at least one unit from every voice in earshot; the
 *  measurement also reports neighbours (within NEIGHBOUR_R m) */
export const VOICE_MIN = { pitch: 0.035, formant: 0.025, rate: 0.06, glottis: 0.3, f2: 0.03 } as const;
export const NEIGHBOUR_R = 6;
export const voiceDist = (a: VoiceParams, b: VoiceParams) => { const A = voiceBase(a), B = voiceBase(b), dp = Math.log(A.f0 / B.f0);
  return Math.hypot(dp / VOICE_MIN.pitch, (Math.log(A.formantScale / B.formantScale) - dp) / VOICE_MIN.formant, (a.rate - b.rate) / VOICE_MIN.rate,
    ((a.glottis ?? 0.5) - (b.glottis ?? 0.5)) / VOICE_MIN.glottis, ((a.f2 ?? 1) - (b.f2 ?? 1)) / VOICE_MIN.f2); };
const wrap = (v: number, lo: number, w: number) => lo + ((((v - lo) % w) + w) % w);
interface Slot { key: string; p: NearPerson; voice: VoiceParams; /** D-336: their own natural voice, and the unit waiting for its render */ nv: NeuralVoice; want?: { u: Unit; lang: LangId | null }; rng: Rng; loud: number; recent: Map<string, number>; busyUntil: number; nextAt: number; seen: number; n: number; spoke: number; /** a baby's cries left in this bout */ bout?: number; /** D-292: the lullaby's phrase: notes left, its length, the scale step */ lull?: { left: number; n: number; step: number } }
interface Group { busyUntil: number; nextAt: number; speaker: string | null; turnLeft: number; last: string | null; /** a listener's laugh after the turn */ laughAt?: number; laughBy?: string }
/** one utterance or grain started (the offline measurement reads these: tools/dev/audio_render.ts) */
/** D-720: a language spoken: a lexicon's, a tongue's (tongues.ts: `tg:Lydian`), or no words */
export type SpokenLang = LangId | 'wordless' | `tg:${string}`;
export interface Uttered { key: string; kind: 'voice' | 'bed'; t0: number; t1: number; unit: string; lang: SpokenLang; src: AudioBufferSourceNode; pan: PannerNode; buf: AudioBuffer; voice: VoiceParams }
/** what the translation layer may show for an utterance heard near (out of world; T-K3c) */
export interface Caption { /** D-720: a tongue's speech has `tongue` (tongues.ts) and lang 'wordless' (no lexicon) */ tongue?: string; key: string; unit: string; lang: LangId | 'wordless'; translit: string; gloss: string; tier: string; t0: number; t1: number }

export interface VoicesOptions { seed?: number; clearR?: number; bedR?: number; maxVoices?: number; hrtfN?: number; bedStreams?: number; level?: number; bedLevel?: number; renderBudget?: number; renderMs?: number; sampleRate?: number }

export class PopulationVoices {
  readonly clearR: number; readonly bedR: number; readonly maxVoices: number; readonly hrtfN: number; readonly bedStreams: number; readonly level: number; readonly bedLevel: number;
  renderBudget: number; renderMs: number;
  private synth: FormantBackend; private rng: Rng;
  private slots = new Map<string, Slot>(); private groups = new Map<string, Group>();
  private bedNext: number[] = []; private recentAll = new Map<string, number>();
  /** who speaks now (context time): the crowd moves their jaw from `from` to `to` (world.ts) */
  /** who is speaking now (audio clock), and D-720 (C14's visemes, D-790): the words being said (their IPA and transliteration) */
  readonly speaking = new Map<string, { from: number; to: number; ipa?: string; text?: string }>();
  /** the talkers voiced this update (individually or by the bed): the crowd lets only the voice move their jaw */
  readonly claimed = new Set<string>();
  /** when set, every utterance and grain started is appended (the offline measurement) */
  log: Uttered[] | null = null;
  /** the last update, for the dev overlay (F3) */
  readonly stats = { talkers: 0, voices: 0, bed: 0, streams: 0, renders: 0, renderMs: 0, starved: 0, /** D-336: utterances in the neural voices (the rest: formant) */ neural: 0, formant: 0, byLang: {} as Record<string, number>, /** the peoples heard with wordless voice only */ fallbacks: [] as string[], utterances: 0, totalRenders: 0, totalRenderMs: 0, totalWaits: 0 };
  constructor(readonly e: AudioEngine, o: VoicesOptions = {}) {
    this.clearR = o.clearR ?? 20; this.bedR = o.bedR ?? 60; this.maxVoices = o.maxVoices ?? 48; this.hrtfN = o.hrtfN ?? 8; this.bedStreams = o.bedStreams ?? 8;
    this.level = o.level ?? 1.1; this.bedLevel = o.bedLevel ?? 0.5; this.renderBudget = o.renderBudget ?? 2; this.renderMs = o.renderMs ?? 3;
    this.synth = new FormantBackend(o.sampleRate ?? 16000); this.rng = new Rng(o.seed ?? 1, 'voices');
  }
  /** a person's own voice, moved (deterministically, as little as the search allows) away from every voice in earshot: of
   *  24 variations in pitch, timbre and pace the first whose normalised distance to all of them is at least 1, else the farthest */
  private voiceOf(p: NearPerson): VoiceParams {
    const base = personVoice(p), others = [...this.slots.values()].map(s => s.voice);
    if (!others.length) return base;
    let best = base, bestD = -1;
    for (let k = 0; k < 24; k++) {
      const v = k === 0 ? base : { ...base, pitch: wrap(base.pitch + 0.071 * k, 0.86, 0.3), formant: wrap((base.formant ?? 1) + 0.037 * (k % 5), 0.93, 0.14), rate: wrap(base.rate + 0.097 * (k % 3), 0.88, 0.26),
        glottis: wrap((base.glottis ?? 0.5) + 0.37 * (k % 4), 0, 1), f2: wrap((base.f2 ?? 1) + 0.043 * (k % 7), 0.95, 0.1) };
      let d = Infinity; for (const o of others) d = Math.min(d, voiceDist(v, o)); if (d >= 1) return v; if (d > bestD) { bestD = d; best = v; }
    }
    return best;
  }
  private slot(p: NearPerson, now: number): Slot {
    let s = this.slots.get(p.key);
    if (!s) { const r = new Rng(p.seed >>> 0, `voice.talk:${p.key}`); s = { key: p.key, p, voice: this.voiceOf(p), nv: neuralVoice({ seed: p.seed, sex: p.sex, age: p.age, lang: p.lang }), rng: r, loud: 0.85 + 0.3 * r.next(), recent: new Map(), busyUntil: 0, nextAt: now + 0.1 + 0.8 * r.next(), seen: now, n: 0, spoke: now - 5 * r.next() }; this.slots.set(p.key, s);
      // D-336: a person newly in earshot has two of their units rendered ahead, at the bed's priority (their first words come sooner)
      if (this.neural?.stats.ready) { const L = voiceLang(p.lang, p.langs).lang, U = L ? unitsFor(L) : null; if (U?.words.length) this.neural.prefetch(s.nv, [r.pick(U.words), U.lines.length ? r.pick(U.lines) : r.pick(U.words)], PRIO.bed); } }
    s.p = p; s.seen = now; return s;
  }
  /** a unit this person has not said (nor any word of it) in the last 60 s, preferring one nobody near said in the last 30 s */
  /** D-377 (UD-23): what a person says next in the exchange with the one they talk with (people/overheard.ts), else null */
  script: ((key: string, group: string | null, lang: LangId | null) => Unit | null) | null = null;
  private pickUnit(s: Slot, lang: LangId | null, now: number): Unit | null {
    const sc = this.script?.(s.p.key, s.p.group, lang); if (sc) return sc;
    // D-720 (UD-24; the holes audit #15): a people without a lexicon speaks its own tongue in reconstructed sentences (tongues.ts),
    // no longer only hums; a people with one says the town's everyday sentences in reconstructed period speech as well as its
    // published lines and words (lang/reconstruct.ts): fluent talk, not single words (tier C both)
    const tg = lang ? null : tongueOf(s.p.lang);
    const U = lang ? { lines: [...unitsFor(lang).lines, ...rcLines(lang)], words: unitsFor(lang).words } : tg ? { lines: tongueUnits(tg), words: tongueUnits(tg) } : { lines: [] as Unit[], words: WORDLESS }, fresh = (u: Unit) => u.parts.every(id => (s.recent.get(id) ?? -1e9) < now - 60) && (s.recent.get(u.id) ?? -1e9) < now - 60;
    for (let k = 0; k < 16; k++) {
      const pool = U.lines.length && s.rng.chance(0.3) ? U.lines : U.words; if (!pool.length) continue;
      const u = pool[Math.floor(s.rng.next() * pool.length)];
      if (!fresh(u)) continue; if (k < 14 && (this.recentAll.get(`${lang}|${u.id}`) ?? -1e9) > now - 30) continue;
      return u;
    }
    for (const u of [...U.words, ...U.lines]) if (fresh(u)) return u;
    return null;
  }
  private budget = { n: 0, ms: 0 };
  private render(u: Unit, lang: LangId, v: VoiceParams, n: number): AudioBuffer | null { // (wordless voice renders with the Aramaic stress rule: one syllable, no effect)
    if (this.budget.n >= this.renderBudget || this.budget.ms >= this.renderMs) { this.stats.starved++; this.stats.totalWaits++; return null; }
    const t0 = performance.now();
    try { const clip = this.synth.renderSync({ ipa: u.ipa, lang, voice: { ...v, seed: (v.seed ?? 1) + n * 7919 }, intonation: u.intonation }); return clipToBuffer(this.e.ctx!, clip); }
    catch { return null; }
    finally { this.budget.n++; const ms = performance.now() - t0; this.budget.ms += ms; this.stats.renders++; this.stats.renderMs += ms; this.stats.totalRenders++; this.stats.totalRenderMs += ms; }
  }
  /** D-336 (UD-22): the people's natural voices (Kokoro-82M in a worker); null or not yet loaded: the formant synthesiser
   *  (PLACEHOLDER-QUALITY) speaks instead */
  neural: NeuralVoices | null = null;
  private bufs = new WeakMap<Float32Array, AudioBuffer>();
  /** a baby's mean seconds between bouts of crying (CRY_EVERY_S; tests shorten it) */
  cryEvery = CRY_EVERY_S;
  /** a person's mean seconds between coughs (COUGH_EVERY_S; the world shortens it in winter) */
  coughEvery = COUGH_EVERY_S;
  /** the translation layer's hook: an utterance within `captionR` m of the listener starts (out of world) */
  onCaption: ((c: Caption) => void) | null = null; captionR = 6;
  /** start one unit from a person: a voice (clear, HRTF when among the nearest) or a bed grain (low-passed, equal-power) */
  private utter(s: Slot, lang: LangId | null, now: number, kind: 'voice' | 'bed', hrtf: boolean, d: number, o: { unit?: Unit; loud?: number; pitch?: number } = {}): number | null {
    // a child's unit is now and then a call at play, louder (G33)
    if (!o.unit && s.p.age < 12 && s.rng.chance(CHILD_CALL_P)) o = { unit: s.rng.pick(CHILD_CALL), loud: 1.8, pitch: 1.1 };
    const u = o.unit ?? (s.want && s.want.lang === lang ? s.want.u : null) ?? this.pickUnit(s, lang, now); if (!u) return null;
    // nobody says a word the same way twice: this utterance's pitch (±4 %), pace (±8 %), vowels (F2/F3 ±2 %) and, for a single
    // word, its tune vary
    const r = s.rng, v = { ...s.voice, pitch: s.voice.pitch * (o.pitch ?? 1) * (0.96 + 0.08 * r.next()), rate: s.voice.rate * (u.id.startsWith('laugh') ? 1.3 : 1) * (0.92 + 0.16 * r.next()), f2: (s.voice.f2 ?? 1) * (0.98 + 0.04 * r.next()), accent: (s.voice.accent ?? 1) * (0.8 + 0.4 * r.next()) };
    let tune: Unit = u.kind !== 'line' ? { ...u, intonation: r.chance(0.6) ? u.intonation : r.pick(['fall', 'level', 'rise'] as Intonation[]) } : u;
    // D-336: a bed grain is one of this person's units already rendered when there is one (the bed never waits on the model)
    if (kind === 'bed' && this.neural?.stats.ready && !o.unit && !this.neural.has(s.nv, tune.id, tune.intonation, tune.kind === 'line' ? 0 : s.n & 1)) {
      const U = lang ? unitsFor(lang) : null, fresh = (x: Unit) => (s.recent.get(x.id) ?? -1e9) < now - 60;
      const alt = U ? [...U.lines, ...U.words].find(x => fresh(x) && this.neural!.has(s.nv, x.id, x.intonation, x.kind === 'line' ? 0 : s.n & 1)) : undefined;
      if (alt) tune = alt;
    }
    // D-336: the person's own natural voice when the model is up (the clip of this unit in their voice, cached; this
    // utterance's pitch variation as the playback rate), else the formant synthesiser (placeholder)
    const nv = this.neural?.stats.ready ? this.neural : null; let buf: AudioBuffer | null, shift = 1;
    if (nv) {
      const pcm = nv.get(s.nv, tune.id, tune.ipa, tune.intonation, kind === 'bed' ? PRIO.bed : d < 8 ? PRIO.near : PRIO.voice, tune.kind === 'line' ? 0 : s.n & 1);
      if (!pcm) { this.stats.starved++; this.stats.totalWaits++; if (!o.unit) s.want = { u, lang }; return null; }
      s.want = undefined; buf = this.bufs.get(pcm) ?? null;
      if (!buf) { buf = this.e.ctx!.createBuffer(1, pcm.length, 24000); buf.getChannelData(0).set(pcm); this.bufs.set(pcm, buf); }
      shift = Math.max(0.8, Math.min(1.3, v.pitch / s.voice.pitch)); this.stats.neural++;
    } else { buf = this.render(tune, lang ?? 'arc', v, s.n); if (buf) this.stats.formant++; }
    if (!buf) return null;
    const e = this.e, c = e.ctx!, p = s.p, t0 = now + 0.02, src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = (0.98 + 0.04 * s.rng.next()) * shift;
    const dur = buf.duration / src.playbackRate.value, g = c.createGain(); g.gain.value = (kind === 'voice' ? this.level : this.bedLevel) * s.loud * (o.loud ?? 1) * (0.9 + 0.2 * s.rng.next());
    const my = p.y + (p.age < 2 ? 1.1 : p.age < 12 ? 1.05 : 1.55), pan = e.panner(p.x, my, p.z, 2, kind === 'voice' ? 100 : 160); if (!hrtf) pan.panningModel = 'equalpower';
    if (kind === 'bed') { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = Math.max(900, 2600 - 25 * d); src.connect(lp); lp.connect(g); } else src.connect(g);
    g.connect(pan); e.route(pan, 'voices', t0 + dur); src.start(t0); src.stop(t0 + dur + 0.01);
    s.n++; for (const id of [tune.id, ...tune.parts]) s.recent.set(id, now); this.recentAll.set(`${lang}|${tune.id}`, now);
    if (s.recent.size > 64) for (const [k, t] of s.recent) if (t < now - 61) s.recent.delete(k);
    this.speaking.set(s.key, { from: t0, to: t0 + dur, ipa: tune.ipa, text: tune.translit || tune.gloss }); s.busyUntil = t0 + dur; s.spoke = t0 + dur; this.stats.utterances++;
    const L: SpokenLang = tune.kind === 'wordless' ? 'wordless' : lang ?? (tune.id.startsWith('tg:') ? `tg:${tune.id.split(':')[1]}` : 'wordless'); this.log?.push({ key: s.key, kind, t0, t1: t0 + dur, unit: tune.id, lang: L, src, pan, buf, voice: s.voice });
    if (this.onCaption && d <= this.captionR) this.onCaption({ key: s.key, unit: tune.id, lang: L.startsWith('tg:') ? 'wordless' : L as LangId | 'wordless', ...(L.startsWith('tg:') ? { tongue: L.slice(3) } : {}), translit: tune.translit, gloss: tune.gloss, tier: tune.tier, t0, t1: t0 + dur });
    return t0 + dur;
  }
  /** Call once a frame with everyone the crowd places near the listener. `hold(key)`: a person speaking a scripted line
   *  now (world.ts exchanges), left to it */
  update(dt: number, people: readonly NearPerson[], listener: Vec3, hold?: (key: string) => boolean) {
    const e = this.e; if (!e.ctx || e.ctx.state !== 'running') return;
    const now = e.ctx.currentTime; this.budget.n = 0; this.budget.ms = 0; this.claimed.clear();
    const st = this.stats; st.renders = 0; st.renderMs = 0; st.starved = 0; st.byLang = {}; const fb = new Set<string>();
    for (const [k, v] of this.speaking) if (v.to < now - 1) this.speaking.delete(k);
    const T = people.filter(p => p.talking && !hold?.(p.key)).map(p => ({ p, d: Math.hypot(p.x - listener.x, p.y + 1.5 - listener.y, p.z - listener.z) })).filter(x => x.d <= this.bedR).sort((a, b) => a.d - b.d);
    const clear = T.filter(x => x.d <= this.clearR).slice(0, this.maxVoices), clearSet = new Set(clear.map(x => x.p.key)), bed = T.filter(x => !clearSet.has(x.p.key));
    st.talkers = T.length; st.voices = clear.length; st.bed = bed.length;
    for (const x of T) { this.claimed.add(x.p.key); const s = this.slots.get(x.p.key); if (s) { s.seen = now; s.p = x.p; } }
    // conversations: talkers of one place within 3 m of each other (union-find over the clear talkers)
    const par = clear.map((_, i) => i), find = (i: number): number => (par[i] === i ? i : (par[i] = find(par[i])));
    for (let i = 0; i < clear.length; i++) for (let j = i + 1; j < clear.length; j++) { const a = clear[i].p, b = clear[j].p;
      if (a.group === b.group && Math.hypot(a.x - b.x, a.z - b.z) < 3) par[find(i)] = find(j); }
    const clusters = new Map<number, number[]>(); clear.forEach((_, i) => { const r = find(i); let c = clusters.get(r); if (!c) clusters.set(r, c = []); c.push(i); });
    const rank = new Map(clear.map((x, i) => [x.p.key, i]));
    const tally = (p: NearPerson, l: LangId | null) => { st.byLang[l ?? 'wordless'] = (st.byLang[l ?? 'wordless'] ?? 0) + 1; if (!l) fb.add(p.lang); };
    for (const idx of clusters.values()) {
      // each member's own language; in mixed company the lingua franca for those who have a language of words (C), the
      // wordless stay wordless (T-K1a2: never another people's words for them)
      const members = idx.map(i => clear[i]), own = members.map(m => voiceLang(m.p.lang, m.p.langs).lang);
      const mixed = new Set(own).size > 1, ml = own.map(l => (mixed && l ? 'arc' as LangId : l));
      members.forEach((m, i) => tally(m.p, ml[i]));
      const slots = members.map(m => this.slot(m.p, now)), hr = (k: string) => (rank.get(k) ?? 99) < this.hrtfN;
      if (members.length === 1) { // talking with someone out of earshot, or eating alone: pauses between units
        const s = slots[0], m = members[0]; if (now < s.busyUntil || now < s.nextAt) continue;
        const end = this.utter(s, ml[0], now, 'voice', hr(s.key), m.d); if (end == null) continue;
        s.nextAt = end + (m.p.eating ? 3 + 7 * s.rng.next() : 0.6 + 2.6 * s.rng.next()) * (ml[0] ? 1 : 3); continue;
      }
      const gk = members.map(m => m.p.key).sort()[0]; let g = this.groups.get(gk); if (!g) this.groups.set(gk, g = { busyUntil: 0, nextAt: now + 0.2 * this.rng.next(), speaker: null, turnLeft: 0, last: null });
      const eat = members.some(m => m.p.eating) ? 2.5 : 1;
      if (g.laughAt !== undefined && now >= g.laughAt) { // a listener laughs after the turn (G33)
        const i = slots.findIndex(q => q.key === g!.laughBy); g.laughAt = undefined;
        if (i >= 0 && now >= slots[i].busyUntil) { const end = this.utter(slots[i], ml[i], now, 'voice', hr(slots[i].key), members[i].d, { unit: this.rng.pick(LAUGH), loud: 1.2 }); if (end != null) { g.busyUntil = Math.max(g.busyUntil, end); g.nextAt = Math.max(g.nextAt, end + 0.2); } }
      }
      if (now < g.busyUntil) { // a listener's short overlap now and then (~ once in 25 s per conversation)
        if (this.rng.chance(0.04 * Math.min(0.1, Math.max(0, dt)))) { const i = Math.floor(this.rng.next() * slots.length), s = slots[i]; if (s.key !== g.speaker && now >= s.busyUntil) this.utter(s, ml[i], now, 'voice', hr(s.key), members[i].d); }
        continue;
      }
      if (now < g.nextAt) continue;
      let i = g.turnLeft > 0 ? slots.findIndex(s => s.key === g!.speaker) : -1;
      if (i < 0) { // the next turn goes to someone other than the last speaker, the longer silent the likelier (fair turns)
        const others = slots.map((s, k) => k).filter(k => slots[k].key !== g!.last), w = others.map(k => (now - slots[k].spoke + 1) ** 2); let r = this.rng.next() * w.reduce((a, b) => a + b, 0); i = others[0] ?? 0;
        for (let q = 0; q < others.length; q++) { r -= w[q]; if (r <= 0) { i = others[q]; break; } }
        g.turnLeft = ml[i] ? 1 + Math.floor(this.rng.next() * 3) : 1; }
      const s = slots[i], end = this.utter(s, ml[i], now, 'voice', hr(s.key), members[i].d); if (end == null) { g.turnLeft = 0; g.nextAt = now + 0.3; continue; }
      if (g.turnLeft <= 1 && slots.length > 1 && this.rng.chance(LAUGH_P)) { const others = slots.filter(q => q.key !== s.key); g.laughBy = this.rng.pick(others).key; g.laughAt = end - 0.1 + 0.4 * this.rng.next(); }
      g.speaker = s.key; g.last = s.key; g.turnLeft--; g.busyUntil = end; g.nextAt = end + (g.turnLeft > 0 ? 0.12 + 0.33 * this.rng.next() : 0.25 + 0.85 * this.rng.next()) * eat * (ml[i] ? 1 : 3);
    }
    // babies (G33): a baby within clearR of the listener, talking or not, starts a bout of crying now and then (C)
    for (const p of people) { if (p.age >= 2) continue; const d = Math.hypot(p.x - listener.x, p.y + 1.1 - listener.y, p.z - listener.z); if (d > this.clearR) continue;
      const s = this.slot(p, now); s.seen = now; s.p = p; this.claimed.add(p.key); if (now < s.busyUntil || now < s.nextAt) continue;
      if (!s.bout) { if (!s.rng.chance(Math.min(1, Math.max(0, dt)) / this.cryEvery)) continue; s.bout = 3 + s.rng.int(0, 7); }
      const end = this.utter(s, null, now, 'voice', false, d, { unit: s.rng.pick(CRY), loud: 1.5, pitch: 1.9 }); if (end == null) continue;
      s.bout--; s.nextAt = end + 0.25 + 0.5 * s.rng.next() + (s.bout ? 0 : 2); }
    // lullabies (D-292): a woman with a small child at its bedtime hums it to sleep, a phrase of notes stepping down, a breath,
    // another; nothing else interrupts her in those hours but the child's own cry (C)
    for (const p of people) { if (!p.lull) continue; const d = Math.hypot(p.x - listener.x, p.y + 1.5 - listener.y, p.z - listener.z); if (d > this.clearR) continue;
      const s = this.slot(p, now); s.seen = now; s.p = p; this.claimed.add(p.key); if (now < s.busyUntil || now < s.nextAt) continue;
      if (!s.lull || s.lull.left <= 0) { if (s.lull && s.rng.chance(LULL_REST_P)) { s.lull = undefined; s.nextAt = now + 4 + 8 * s.rng.next(); continue; }
        const n = LULL_NOTES[0] + s.rng.int(0, LULL_NOTES[1] - LULL_NOTES[0]), top = 2 + s.rng.int(0, 2); s.lull = { left: n, n, step: top }; }
      const L = s.lull, k = L.n - L.left, semis = LULL_STEPS[Math.max(0, Math.min(LULL_STEPS.length - 1, L.step))], pitch = Math.pow(2, (semis - 2) / 12) * 0.92;
      const end = this.utter(s, null, now, 'voice', false, d, { unit: LULL[(k + (L.left === 1 ? 1 : 0)) % LULL.length], loud: 0.55, pitch }); if (end == null) continue;
      L.left--; L.step = Math.max(0, L.step + (s.rng.chance(0.65) ? -1 : 1)); s.nextAt = end + (L.left ? 0.05 + 0.12 * s.rng.next() : 1.2 + 1.3 * s.rng.next()); }
    // coughs (G34): anyone past infancy within clearR now and then, not while they speak (C)
    for (const p of people) { if (p.age < 2) continue; const d = Math.hypot(p.x - listener.x, p.y + 1.5 - listener.y, p.z - listener.z); if (d > this.clearR) continue;
      if (!this.rng.chance(Math.min(1, Math.max(0, dt)) / this.coughEvery)) continue;
      const s = this.slot(p, now); s.seen = now; s.p = p; if (now < s.busyUntil) continue; this.claimed.add(p.key);
      this.utter(s, null, now, 'voice', false, d, { unit: this.rng.pick(COUGH), loud: 1.1, pitch: 0.95 }); }
    // the bed: sqrt(n) streams of grains from the talkers beyond the clear voices (the wordless hum in it too)
    const streams = bed.length ? Math.min(this.bedStreams, Math.ceil(Math.sqrt(bed.length))) : 0; st.streams = streams;
    if (streams) {
      let wsum = 0; const w = bed.map(x => { const v = (1 / (1 + x.d / 8)) * (voiceLang(x.p.lang, x.p.langs).lang ? 1 : 0.3); wsum += v; return v; });
      for (const x of bed) tally(x.p, voiceLang(x.p.lang, x.p.langs).lang);
      for (let k = 0; k < streams; k++) {
        if ((this.bedNext[k] ?? 0) > now) continue;
        let r = this.rng.next() * wsum, j = 0; for (; j < bed.length - 1; j++) { r -= w[j]; if (r <= 0) break; }
        const x = bed[j], s = this.slot(x.p, now); if (now < s.busyUntil) { this.bedNext[k] = now + 0.1; continue; }
        const end = this.utter(s, voiceLang(x.p.lang, x.p.langs).lang, now, 'bed', false, x.d);
        this.bedNext[k] = end != null ? end - 0.3 + 0.8 * this.rng.next() : now + 0.2;
      }
    }
    for (const [k, s] of this.slots) if (now - s.seen > 65) this.slots.delete(k); // (a person's recent words kept past the 60 s rule)
    for (const [k, g] of this.groups) if (now - g.busyUntil > 30) this.groups.delete(k);
    if (this.recentAll.size > 2000) for (const [k, t] of this.recentAll) if (t < now - 31) this.recentAll.delete(k);
    st.fallbacks = [...fb];
  }
  /** the dev overlay (F3): who is heard, in which languages, the bed, the cost; the voice's quality is a placeholder */
  lines(): string[] {
    const s = this.stats;
    const nv = this.neural?.stats.ready; return [`voices (D-245${nv ? '; D-336 natural voices, Kokoro-82M, one per person, C' : ', formant synth: PLACEHOLDER-QUALITY, C'}): ${s.voices} talkers voiced within ${this.clearR} m, ${s.bed} in the murmur bed (${s.streams} grain streams) to ${this.bedR} m · ${Object.entries(s.byLang).map(([l, n]) => `${l} ${n}`).join(', ') || 'nobody talking'}${s.fallbacks.length ? ` · no published corpus, gesture and wordless voice (T-K1a2): ${s.fallbacks.join(', ')}` : ''} · ${s.renders} renders ${s.renderMs.toFixed(1)} ms${s.starved ? `, ${s.starved} waited` : ''}`];
  }
}
