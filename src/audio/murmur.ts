// Crowd murmur (brief §10 "Crowd murmur: synthesised from each language's sounds and rhythm"; §11 "crowds in period
// languages"). Each nearby talking person gets a spatialised voice that utters pseudo-phrases built from their
// language's phonology, rendered by the same formant synthesiser as scripted speech (speech.ts).
//
// Where the sounds come from: a language profile is derived from the lexicon itself — every speakable entry of
// research/LEXICON/<lang>.json is tokenized and syllabified, and the observed word-initial onsets, medial onsets, nuclei
// (with length), medial and final codas, and syllables-per-word are counted. Pseudo-words are sampled from those counts,
// so Old Persian murmur has xš-, dr-, fr-, θ and long ā; Elamite geminates and -š; Aramaic ʔ, ħ, ʕ, schwa and emphatics.
// The distributions are only as good as the (small) lexicons: tier C. Babylonian and Greek have their own lexicons (D-105,
// D-106); languages without one (Egyptian, Lydian, "unknown") use the Aramaic profile — the lingua franca — and are flagged
// `fallback` (tier C).
//
// Nothing intelligible: pseudo-words are not lexicon words, any pseudo-word whose romanisation is a common modern word
// (English, modern Persian, Arabic, Hebrew, European — src/lang/modern.ts) is rejected and resampled, and each voice is
// low-passed (murmur heard through a crowd). tests/language.test.ts checks thousands of samples per language.
import type { AudioEngine } from './engine';
import { FormantBackend, Vec3, VoiceParams, Intonation, clipToBuffer } from './speech';
import { tokenizeIpa, syllabify, Phone } from './phonemes';
import { LEXICON, LangId, LANG_IDS, murmurEligible, type LexEntry } from '../lang/lexicon';
import { findModernWords } from '../lang/modern';
import { Rng } from '../core/rng';

type Counts = Map<string, number>;
export interface LangProfile {
  lang: LangId; tier: 'C'; source: string;
  initialOnsets: Counts; medialOnsets: Counts; nuclei: Counts; medialCodas: Counts; finalCodas: Counts;
  /** index = syllables per word, value = count */
  sylPerWord: number[];
  /** speaking-rate multiplier for the synthesiser (C: no evidence for ancient speech rates) */
  rate: number;
}

const ps = (p: Phone) => p.sym + (p.pharyngealised ? 'ˤ' : '') + (p.aspirated ? 'ʰ' : '') + (p.long ? 'ː' : '');
const bump = (m: Counts, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

const RATE: Record<LangId, number> = { op: 1.0, el: 1.05, arc: 1.1, bab: 1.05, grc: 1.05 };

/** the lexicon entries whose sounds are counted for a language's murmur: attested words only (tier A/B; a tier-C
 *  reconstruction such as Aramaic myn "water" is not evidence of the language's sounds: review A-M7, D-167) */
export function murmurSource(lang: LangId): LexEntry[] { return LEXICON[lang].filter(murmurEligible); }
export function buildProfile(lang: LangId): LangProfile {
  const pr: LangProfile = { lang, tier: 'C', source: `research/LEXICON (${lang}) phonotactics of the attested entries, counted`, initialOnsets: new Map(), medialOnsets: new Map(), nuclei: new Map(),
    medialCodas: new Map(), finalCodas: new Map(), sylPerWord: [], rate: RATE[lang] };
  for (const e of murmurSource(lang)) {
    const phones = tokenizeIpa(e.ipa!);
    const words = new Map<number, Phone[]>();
    for (const p of phones) { if (!words.has(p.word)) words.set(p.word, []); words.get(p.word)!.push(p); }
    for (const w of words.values()) {
      const syl = syllabify(w); if (!syl.length) continue;
      pr.sylPerWord[syl.length] = (pr.sylPerWord[syl.length] ?? 0) + 1;
      syl.forEach((s, k) => {
        bump(k === 0 ? pr.initialOnsets : pr.medialOnsets, s.onset.map(ps).join(''));
        bump(pr.nuclei, ps(s.nucleus) + (s.nucleus.syllabic && s.nucleus.def.manner !== 'vowel' ? '̩' : ''));
        // a diphthong glide (non-syllabic i/u, OP ai/au) lands in the coda slot, so codas also carry diphthongs
        bump(k === syl.length - 1 ? pr.finalCodas : pr.medialCodas, s.coda.map(ps).join(''));
      });
    }
  }
  for (let i = 0; i < pr.sylPerWord.length; i++) pr.sylPerWord[i] ??= 0;
  return pr;
}

function pickW(m: Counts, r: Rng): string {
  let tot = 0; for (const v of m.values()) tot += v;
  let x = r.next() * tot; for (const [k, v] of m) { x -= v; if (x < 0) return k; }
  return [...m.keys()][0] ?? '';
}

/** One pseudo-word in the language's phonotactics (never a common modern word). */
export function pseudoWord(p: LangProfile, r: Rng, maxSyl = 4): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let tot = 0; for (let i = 1; i <= maxSyl; i++) tot += p.sylPerWord[i] ?? 0;
    let x = r.next() * tot, n = 1; for (let i = 1; i <= maxSyl; i++) { x -= p.sylPerWord[i] ?? 0; if (x < 0) { n = i; break; } }
    let w = '';
    for (let k = 0; k < n; k++) {
      w += pickW(k === 0 ? p.initialOnsets : p.medialOnsets, r) + pickW(p.nuclei, r) + pickW(k === n - 1 ? p.finalCodas : p.medialCodas, r);
    }
    // avoid illegal doubles created by concatenation (e.g. coda "t" + onset "t" stays a geminate, fine; vowel+vowel hiatus is fine)
    try { tokenizeIpa(w); } catch { continue; }
    if (findModernWords(w, { ipa: true }).length) continue;
    return w;
  }
  return 'a';
}

export function pseudoPhrase(p: LangProfile, r: Rng): { ipa: string; intonation: Intonation } {
  const n = 2 + Math.floor(r.next() * 4);
  // the synthesiser runs words together, so two neighbours joined must not spell a modern word either (review A-M1)
  const words: string[] = [];
  for (let i = 0; i < n; i++) {
    let w = pseudoWord(p, r);
    for (let k = 0; k < 20 && i > 0 && findModernWords(words[i - 1] + w, { ipa: true }).length; k++) w = pseudoWord(p, r);
    words.push(w);
  }
  const x = r.next();
  return { ipa: words.join(' '), intonation: x < 0.15 ? 'rise' : x < 0.3 ? 'level' : 'fall' };
}

/** Sim language labels (Agent.langs) → murmur profile. */
export const MURMUR_LANGS: Record<string, { lang: LangId; fallback: boolean; tier: 'B' | 'C'; note: string }> = {
  'Old Persian': { lang: 'op', fallback: false, tier: 'C', note: 'Old Persian lexicon phonotactics' },
  Iranian: { lang: 'op', fallback: true, tier: 'C', note: 'unspecified Iranian speech voiced with the Old Persian inventory' },
  Elamite: { lang: 'el', fallback: false, tier: 'C', note: 'Elamite lexicon phonotactics' },
  Aramaic: { lang: 'arc', fallback: false, tier: 'C', note: 'Aramaic lexicon phonotactics' },
  'West Semitic': { lang: 'arc', fallback: true, tier: 'C', note: 'West Semitic speakers voiced with the Aramaic inventory' },
  Babylonian: { lang: 'bab', fallback: false, tier: 'C', note: 'Late Babylonian lexicon phonotactics (babylonian.json)' },
  Greek: { lang: 'grc', fallback: false, tier: 'C', note: 'Ionic Greek lexicon phonotactics (greek.json)' },
  Egyptian: { lang: 'arc', fallback: true, tier: 'C', note: 'no Egyptian lexicon yet; Aramaic rhythm stands in' },
  Lydian: { lang: 'arc', fallback: true, tier: 'C', note: 'no Lydian lexicon; Aramaic rhythm stands in' },
};
export function murmurLangFor(label: string): { lang: LangId; fallback: boolean; tier: 'B' | 'C'; note: string } {
  if ((LANG_IDS as readonly string[]).includes(label)) return { lang: label as LangId, fallback: false, tier: 'C', note: 'lexicon phonotactics' };
  return MURMUR_LANGS[label] ?? { lang: 'arc', fallback: true, tier: 'C', note: `no lexicon for "${label}"; Aramaic rhythm stands in` };
}

export interface Talker {
  id: string | number; pos: Vec3;
  /** a sim language label (Agent.langs[0], e.g. 'Elamite') or a LangId */
  lang: string;
  sex: 'm' | 'f'; child?: boolean;
  /** per-person voice variation */
  seed?: number;
  /** people in the same conversation share a group key and take turns */
  group?: string | number;
}

interface Slot {
  talker: Talker; pan: PannerNode; lp: BiquadFilterNode; gain: GainNode; src: AudioBufferSourceNode | null;
  busyUntil: number; nextAt: number; rate: number; key: string;
}

export interface MurmurOptions { maxVoices?: number; radius?: number; poolSize?: number; seed?: number; level?: number; sampleRate?: number }

export class Murmur {
  readonly maxVoices: number; readonly radius: number; readonly poolSize: number; readonly level: number;
  private profiles = new Map<LangId, LangProfile>();
  private pools = new Map<string, AudioBuffer[]>();
  private slots = new Map<string | number, Slot>();
  private rng: Rng; private synth: FormantBackend;
  constructor(readonly e: AudioEngine, o: MurmurOptions = {}) {
    this.maxVoices = o.maxVoices ?? 10; this.radius = o.radius ?? 40; this.poolSize = o.poolSize ?? 6; this.level = o.level ?? 0.45;
    this.rng = new Rng(o.seed ?? 1, 'murmur'); this.synth = new FormantBackend(o.sampleRate ?? 16000);
  }
  profile(lang: LangId): LangProfile { let p = this.profiles.get(lang); if (!p) { p = buildProfile(lang); this.profiles.set(lang, p); } return p; }

  private voiceClass(t: Talker) { return t.child ? 'child' : t.sex; }
  /** a pooled pseudo-phrase for (language, voice class); renders at most `budget.n` new phrases per update */
  private phrase(lang: LangId, vc: string, budget: { n: number }): AudioBuffer | null {
    const key = `${lang}|${vc}`; let pool = this.pools.get(key); if (!pool) { pool = []; this.pools.set(key, pool); }
    if (pool.length < this.poolSize && budget.n > 0 && this.e.ctx) {
      budget.n--;
      const pr = this.profile(lang), ph = pseudoPhrase(pr, this.rng);
      const voice: VoiceParams = { sex: vc === 'f' ? 'f' : 'm', age: vc === 'child' ? 9 : 30, pitch: 1, rate: pr.rate * (0.95 + this.rng.next() * 0.15), seed: this.rng.int(1, 1e6) };
      pool.push(clipToBuffer(this.e.ctx, this.synth.renderSync({ ipa: ph.ipa, lang, voice, intonation: ph.intonation })));
    }
    return pool.length ? pool[Math.floor(this.rng.next() * pool.length)] : null;
  }

  /**
   * Call once per frame. `talkers` = everyone currently talking (activity 'talk', 'eat' with company, …) with their
   * world position and first language; `listener` = the camera position.
   */
  update(dt: number, talkers: readonly Talker[], listener: Vec3) {
    const e = this.e; if (!e.ctx || e.ctx.state !== 'running') return;
    const c = e.ctx, now = c.currentTime;
    const near = talkers.map(t => ({ t, d: Math.hypot(t.pos.x - listener.x, t.pos.y - listener.y, t.pos.z - listener.z) }))
      .filter(x => x.d < this.radius).sort((a, b) => a.d - b.d).slice(0, this.maxVoices);
    const keep = new Set(near.map(x => x.t.id));
    for (const [id, s] of this.slots) if (!keep.has(id)) this.retire(id, s, now);
    const busyGroups = new Set<string | number>();
    for (const s of this.slots.values()) if (s.busyUntil > now && s.talker.group != null) busyGroups.add(s.talker.group);
    const budget = { n: 1 };
    for (const { t } of near) {
      let s = this.slots.get(t.id);
      const ml = murmurLangFor(t.lang), key = `${ml.lang}|${this.voiceClass(t)}`;
      if (!s || s.key !== key) {
        if (s) this.retire(t.id, s, now);
        const pan = e.panner(t.pos.x, t.pos.y, t.pos.z, 1.5, 60);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.5;
        const gain = c.createGain(); gain.gain.value = this.level;
        lp.connect(gain); gain.connect(pan); e.route(pan, 'voices'); // occluded by the built geometry (D-178)
        const vr = new Rng(t.seed ?? 0, `murmur-voice:${t.id}`);
        s = { talker: t, pan, lp, gain, src: null, busyUntil: 0, nextAt: now + vr.next() * 2, rate: 0.93 + vr.next() * 0.14, key };
        this.slots.set(t.id, s);
      }
      s.talker = t;
      s.pan.positionX.setTargetAtTime(t.pos.x, now, 0.05); s.pan.positionY.setTargetAtTime(t.pos.y, now, 0.05); s.pan.positionZ.setTargetAtTime(t.pos.z, now, 0.05);
      if (now < s.busyUntil || now < s.nextAt) continue;
      if (t.group != null && busyGroups.has(t.group) && this.rng.next() > 0.12) { s.nextAt = now + 0.3 + this.rng.next() * 0.8; continue; } // turn-taking, some overlap
      const buf = this.phrase(ml.lang, this.voiceClass(t), budget); if (!buf) continue;
      const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = s.rate * (0.98 + this.rng.next() * 0.04);
      src.connect(s.lp); src.start(now + 0.01);
      const dur = buf.duration / src.playbackRate.value;
      s.src = src; s.busyUntil = now + 0.01 + dur;
      s.nextAt = s.busyUntil + (t.group != null ? 0.25 + this.rng.next() * 0.9 : 1.5 + this.rng.next() * 4);
      if (t.group != null) busyGroups.add(t.group);
    }
    void dt;
  }
  private retire(id: string | number, s: Slot, now: number) {
    s.gain.gain.setTargetAtTime(0, now, 0.1);
    const src = s.src; if (src) try { src.stop(now + 0.5); } catch { /* not started */ }
    setTimeout(() => { try { s.pan.disconnect(); } catch { /* already */ } this.e.release(s.pan); }, 700);
    this.slots.delete(id);
  }
  /** for the dev overlay (F3): live voices per language and which ones use a fallback profile */
  stats() {
    const byLang: Record<string, number> = {}, fallbacks = new Set<string>();
    for (const s of this.slots.values()) { const m = murmurLangFor(s.talker.lang); byLang[m.lang] = (byLang[m.lang] ?? 0) + 1; if (m.fallback) fallbacks.add(s.talker.lang); }
    let pooled = 0; for (const p of this.pools.values()) pooled += p.length;
    return { voices: this.slots.size, byLang, fallbacks: [...fallbacks], pooled, tier: 'C' as const };
  }
  dispose() { const now = this.e.ctx?.currentTime ?? 0; for (const [id, s] of this.slots) this.retire(id, s, now); this.pools.clear(); }
}
