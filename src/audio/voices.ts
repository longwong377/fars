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
// How they sound: each person has their own voice from their own seed (pitch, rate, breathiness, timbre = formant scale),
// never shared with a neighbour (two near-identical voices of one class in earshot are pushed apart), rendered afresh for
// every utterance by the formant synthesiser (speech.ts; PLACEHOLDER-QUALITY voice, tier C) with a new jitter seed.
//
// Conversation: talkers standing within 3 m of each other at the same place are one conversation and take turns (one
// speaks, the others listen; a short overlap now and then). The crowd moves a person's jaw only while their voice plays
// (world.ts → crowd.voice), so a visible speaker is a heard speaker.
//
// The crowd bed: talkers beyond the individual voices (farther than `clearR`, or more than `maxVoices`) up to `bedR` are
// heard as a murmur of independent grains: up to `bedStreams` overlapping streams (√n of the talkers), each grain one unit
// in the voice of a talker drawn near-weighted, placed at that talker, low-passed with distance. Nothing is looped or
// pooled: every grain is a fresh render, so the bed never repeats.
//
// Cost: a unit renders in ~2–4 ms on the main thread (node, measured by tools/dev/audio_render.ts); renders are budgeted per
// update (`renderBudget` 2, `renderMs` 3); a speaker whose render does not fit waits a frame, silent (and so not moving the jaw).
import type { AudioEngine } from './engine';
import { FormantBackend, clipToBuffer, voiceBase, type VoiceParams, type Intonation, type Vec3 } from './speech';
import { tokenizeIpa } from './phonemes';
import { LEXICON, LANG_IDS, murmurEligible, spokenForm, type LangId } from '../lang/lexicon';
import { LINES } from '../people/speech_lines';
import { HOME_LANG } from '../people/exchanges';
import { Rng, hashString } from '../core/rng';

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
}
/** a published unit: a whole speech line or one attested lexicon entry; or, for a people without a corpus, a wordless voice */
export interface Unit { id: string; ipa: string; intonation: Intonation; kind: 'line' | 'word' | 'wordless'; parts: string[]; tier: string; gloss: string; translit: string }
/** the wordless voice (T-K1a2; C): hums of assent, doubt and thought, hesitations, a realising "ah"; no word of any language
 *  (each checked against the modern-word list by tests/audio_population.test.ts) */
export const WORDLESS: Unit[] = ([['mː', 'fall', 'a hum'], ['m̩ː', 'level', 'a long hum'], ['hmː', 'fall', 'a thoughtful hum'], ['mːhm', 'rise', 'a hum of assent'], ['m̩hm̩', 'fall', 'a hum of assent'],
  ['ʔm̩ʔm̩', 'fall', 'a hum of refusal'], ['əː', 'level', 'a hesitation'], ['əːm', 'level', 'a hesitation'], ['aː', 'fall', 'a realising "ah"'], ['ʔəː', 'rise', 'a questioning sound']] as const)
  .map(([ipa, intonation, gloss], i) => ({ id: `wordless:${i}`, ipa, intonation, kind: 'wordless' as const, parts: [`wordless:${i}`], tier: 'C', gloss: `(${gloss}; no published words of this language: T-K1a2)`, translit: '' }));

const UNITS = new Map<LangId, { lines: Unit[]; words: Unit[] }>();
const speakable = (ipa: string) => { try { return tokenizeIpa(ipa).length > 0; } catch { return false; } };
/** the published units of a language (lines without a role restriction; attested words) */
export function unitsFor(lang: LangId): { lines: Unit[]; words: Unit[] } {
  let u = UNITS.get(lang); if (u) return u;
  const lines = LINES.filter(l => l.lang === lang && !l.def.roles && speakable(l.ipa)).map(l => ({ id: l.id, ipa: l.ipa, intonation: l.intonation ?? 'fall', kind: 'line' as const, parts: l.entries.map(e => e.id), tier: l.tier, gloss: l.gloss, translit: l.translit }));
  const words = LEXICON[lang].filter(murmurEligible).filter(e => speakable(e.ipa!)).map(e => ({ id: e.id, ipa: e.ipa!, intonation: (hashString(e.id) % 5 === 0 ? 'rise' : hashString(e.id) % 3 === 0 ? 'level' : 'fall') as Intonation, kind: 'word' as const, parts: [e.id], tier: e.tier, gloss: e.gloss, translit: spokenForm(e) }));
  u = { lines, words }; UNITS.set(lang, u); return u;
}
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
interface Slot { key: string; p: NearPerson; voice: VoiceParams; rng: Rng; loud: number; recent: Map<string, number>; busyUntil: number; nextAt: number; seen: number; n: number; spoke: number }
interface Group { busyUntil: number; nextAt: number; speaker: string | null; turnLeft: number; last: string | null }
/** one utterance or grain started (the offline measurement reads these: tools/dev/audio_render.ts) */
export interface Uttered { key: string; kind: 'voice' | 'bed'; t0: number; t1: number; unit: string; lang: LangId | 'wordless'; src: AudioBufferSourceNode; pan: PannerNode; buf: AudioBuffer; voice: VoiceParams }
/** what the translation layer may show for an utterance heard near (out of world; T-K3c) */
export interface Caption { key: string; unit: string; lang: LangId | 'wordless'; translit: string; gloss: string; tier: string; t0: number; t1: number }

export interface VoicesOptions { seed?: number; clearR?: number; bedR?: number; maxVoices?: number; hrtfN?: number; bedStreams?: number; level?: number; bedLevel?: number; renderBudget?: number; renderMs?: number; sampleRate?: number }

export class PopulationVoices {
  readonly clearR: number; readonly bedR: number; readonly maxVoices: number; readonly hrtfN: number; readonly bedStreams: number; readonly level: number; readonly bedLevel: number;
  renderBudget: number; renderMs: number;
  private synth: FormantBackend; private rng: Rng;
  private slots = new Map<string, Slot>(); private groups = new Map<string, Group>();
  private bedNext: number[] = []; private recentAll = new Map<string, number>();
  /** who speaks now (context time): the crowd moves their jaw from `from` to `to` (world.ts) */
  readonly speaking = new Map<string, { from: number; to: number }>();
  /** the talkers voiced this update (individually or by the bed): the crowd lets only the voice move their jaw */
  readonly claimed = new Set<string>();
  /** when set, every utterance and grain started is appended (the offline measurement) */
  log: Uttered[] | null = null;
  /** the last update, for the dev overlay (F3) */
  readonly stats = { talkers: 0, voices: 0, bed: 0, streams: 0, renders: 0, renderMs: 0, starved: 0, byLang: {} as Record<string, number>, /** the peoples heard with wordless voice only */ fallbacks: [] as string[], utterances: 0, totalRenders: 0, totalRenderMs: 0, totalWaits: 0 };
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
    if (!s) { const r = new Rng(p.seed >>> 0, `voice.talk:${p.key}`); s = { key: p.key, p, voice: this.voiceOf(p), rng: r, loud: 0.85 + 0.3 * r.next(), recent: new Map(), busyUntil: 0, nextAt: now + 0.1 + 0.8 * r.next(), seen: now, n: 0, spoke: now - 5 * r.next() }; this.slots.set(p.key, s); }
    s.p = p; s.seen = now; return s;
  }
  /** a unit this person has not said (nor any word of it) in the last 60 s, preferring one nobody near said in the last 30 s */
  private pickUnit(s: Slot, lang: LangId | null, now: number): Unit | null {
    const U = lang ? unitsFor(lang) : { lines: [] as Unit[], words: WORDLESS }, fresh = (u: Unit) => u.parts.every(id => (s.recent.get(id) ?? -1e9) < now - 60) && (s.recent.get(u.id) ?? -1e9) < now - 60;
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
  /** the translation layer's hook: an utterance within `captionR` m of the listener starts (out of world) */
  onCaption: ((c: Caption) => void) | null = null; captionR = 6;
  /** start one unit from a person: a voice (clear, HRTF when among the nearest) or a bed grain (low-passed, equal-power) */
  private utter(s: Slot, lang: LangId | null, now: number, kind: 'voice' | 'bed', hrtf: boolean, d: number): number | null {
    const u = this.pickUnit(s, lang, now); if (!u) return null;
    // nobody says a word the same way twice: this utterance's pitch (±4 %), pace (±8 %), vowels (F2/F3 ±2 %) and, for a single
    // word, its tune vary
    const r = s.rng, v = { ...s.voice, pitch: s.voice.pitch * (0.96 + 0.08 * r.next()), rate: s.voice.rate * (0.92 + 0.16 * r.next()), f2: (s.voice.f2 ?? 1) * (0.98 + 0.04 * r.next()), accent: (s.voice.accent ?? 1) * (0.8 + 0.4 * r.next()) };
    const tune: Unit = u.kind !== 'line' ? { ...u, intonation: r.chance(0.6) ? u.intonation : r.pick(['fall', 'level', 'rise'] as Intonation[]) } : u;
    const buf = this.render(tune, lang ?? 'arc', v, s.n); if (!buf) return null;
    const e = this.e, c = e.ctx!, p = s.p, t0 = now + 0.02, src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = 0.98 + 0.04 * s.rng.next();
    const dur = buf.duration / src.playbackRate.value, g = c.createGain(); g.gain.value = (kind === 'voice' ? this.level : this.bedLevel) * s.loud * (0.9 + 0.2 * s.rng.next());
    const my = p.y + (p.age < 12 ? 1.05 : 1.55), pan = e.panner(p.x, my, p.z, 2, kind === 'voice' ? 100 : 160); if (!hrtf) pan.panningModel = 'equalpower';
    if (kind === 'bed') { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = Math.max(900, 2600 - 25 * d); src.connect(lp); lp.connect(g); } else src.connect(g);
    g.connect(pan); e.route(pan, 'voices', t0 + dur); src.start(t0); src.stop(t0 + dur + 0.01);
    s.n++; for (const id of [u.id, ...u.parts]) s.recent.set(id, now); this.recentAll.set(`${lang}|${u.id}`, now);
    if (s.recent.size > 64) for (const [k, t] of s.recent) if (t < now - 61) s.recent.delete(k);
    this.speaking.set(s.key, { from: t0, to: t0 + dur }); s.busyUntil = t0 + dur; s.spoke = t0 + dur; this.stats.utterances++;
    const L = lang ?? 'wordless'; this.log?.push({ key: s.key, kind, t0, t1: t0 + dur, unit: u.id, lang: L, src, pan, buf, voice: s.voice });
    if (this.onCaption && d <= this.captionR) this.onCaption({ key: s.key, unit: u.id, lang: L, translit: u.translit, gloss: u.gloss, tier: u.tier, t0, t1: t0 + dur });
    return t0 + dur;
  }
  /** Call once a frame with everyone the crowd places near the listener. `hold(key)`: a person speaking a scripted line
   *  now (world.ts exchanges), left to it */
  update(dt: number, people: readonly NearPerson[], listener: Vec3, hold?: (key: string) => boolean) {
    const e = this.e; if (!e.ctx || e.ctx.state !== 'running') return; void dt;
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
      g.speaker = s.key; g.last = s.key; g.turnLeft--; g.busyUntil = end; g.nextAt = end + (g.turnLeft > 0 ? 0.12 + 0.33 * this.rng.next() : 0.25 + 0.85 * this.rng.next()) * eat * (ml[i] ? 1 : 3);
    }
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
    return [`voices (D-245, formant synth: PLACEHOLDER-QUALITY, C): ${s.voices} talkers voiced within ${this.clearR} m, ${s.bed} in the murmur bed (${s.streams} grain streams) to ${this.bedR} m · ${Object.entries(s.byLang).map(([l, n]) => `${l} ${n}`).join(', ') || 'nobody talking'}${s.fallbacks.length ? ` · no published corpus, gesture and wordless voice (T-K1a2): ${s.fallbacks.join(', ')}` : ''} · ${s.renders} renders ${s.renderMs.toFixed(1)} ms${s.starved ? `, ${s.starved} waited` : ''}`];
  }
}
