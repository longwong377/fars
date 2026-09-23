// Scripted speech lines (brief §9.4 "They respond in their own language … Dialogue is scripted"; §10 "Old Persian
// lines are short and draw only on the lexicon").
//
// Rules this file follows (enforced by tests/language.test.ts):
//  * a line's only in-world content is `words`: lexicon ids (src/lang/lexicon.ts). What is heard is the concatenation
//    of those entries' IPA; nothing else in a line is ever voiced or rendered in the world;
//  * `gloss` (English) and `note`/`src`/tiers are out-of-world: subtitles in the translation layer and the dev overlay;
//  * no word is invented and no inflection is made up: if a line needs a form the lexicon lacks, the line is omitted and
//    the gap is listed in LEXICON_GAPS below and in research/OPEN_QUESTIONS.md (Q-022 … Q-026);
//  * every line carries tiers: the phrase (A = verbatim word sequence in a published text, B = excerpt of one, C = composed
//    from lexicon words), the usage (spoken, in this situation: always C or at best B) and the words' own lexicon tiers.
//    Pronunciation (IPA) is reconstructed for every entry (lexicon tier_ipa C), so every line is tier C overall.
import { lexEntry, LangId, LexEntry, isSpeakable, citationForm, worstTier } from '../lang/lexicon';
import type { SpeakableLine, Intonation, VoiceParams } from '../audio/speech';
import { Rng, hashString } from '../core/rng';

export type Intent = 'greet' | 'reply' | 'farewell' | 'pious' | 'remark' | 'call_workers' | 'count' | 'offer' | 'identify' | 'ask_document';

export interface LineDef {
  id: string; lang: LangId; intent: Intent;
  /** lexicon ids in spoken order — the ONLY in-world content of a line */
  words: string[];
  intonation?: Intonation;
  /** sim roles that use the line (omitted = anyone who speaks the language) */
  roles?: string[];
  // ---- out-of-world
  gloss: string; phraseTier: 'A' | 'B' | 'C'; usageTier: 'B' | 'C'; src: string; note: string;
}

export const LINE_DEFS: LineDef[] = [
  // ---------------- Old Persian: royal-inscription formulas only (no everyday phrase survives; see LEXICON_GAPS)
  { id: 'op.pious.baga_vazrka', lang: 'op', intent: 'pious', words: ['op:baga', 'op:vazṛka', 'op:Auramazdā'],
    gloss: 'A great god is Ahuramazda.', phraseTier: 'A', usageTier: 'C', src: 'XPa 1 (also XPb, XPc, XPd): baga vazṛka A.uramazdā',
    note: 'opening words of the royal inscriptions, verbatim; spoken as a pious exclamation is a reconstruction' },
  { id: 'op.farewell.auramazda_patu', lang: 'op', intent: 'farewell', words: ['op:Auramazdā', 'op:pātu'],
    gloss: 'May Ahuramazda protect.', phraseTier: 'B', usageTier: 'C', src: 'XPa 18–20: (mām) A.uramazdā pātu',
    note: 'excerpt of the closing prayer without its object; used as a leave-taking blessing (C)' },
  { id: 'op.remark.parsa_uvaspa', lang: 'op', intent: 'remark', words: ['op:Pārsa', 'op:uvaspa-', 'op:umartiya-'],
    gloss: 'Pārsa: good horses, good men.', phraseTier: 'B', usageTier: 'C', src: 'DPd: … Pārsa … uvaspā umartiyā',
    note: 'excerpt of the Terrace-wall text describing Pārsa; spoken as local pride (C)' },
  // ---------------- Elamite: inscription formulas + administrative vocabulary
  { id: 'el.pious.nap_irsarra', lang: 'el', intent: 'pious', words: ['el:nap', 'el:iršarra', 'el:Uramasda'],
    gloss: 'A great god is Ahuramazda.', phraseTier: 'A', usageTier: 'C', src: 'XPa Elamite 1: {d}na-ap ir-ša₂-ir-ra {d}u-ra-mas-da',
    note: 'opening of the Elamite version, verbatim; spoken use C' },
  { id: 'el.farewell.uramasda_nuskisni', lang: 'el', intent: 'farewell', words: ['el:Uramasda', 'el:nuškišni'],
    gloss: 'May Ahuramazda protect.', phraseTier: 'B', usageTier: 'C', src: 'XPa Elamite, end: {d}u-ra-mas-da (un) nu-iš-ki₂-iš-ni',
    note: 'excerpt without the object pronoun; leave-taking blessing (C)' },
  { id: 'el.ask_document.halmi', lang: 'el', intent: 'ask_document', words: ['el:halmi'], intonation: 'rise', roles: ['guard', 'official', 'scribe'],
    gloss: '(Your) sealed document?', phraseTier: 'C', usageTier: 'C', src: 'lexicon el:halmi',
    note: 'PLACEHOLDER-GRADE: the lexicon marks halmi "NOT SEEN — verify in Hallock 1969" (tier C); a one-word question carried by intonation and gesture' },
  { id: 'el.call_workers.kurtas', lang: 'el', intent: 'call_workers', words: ['el:kurtaš'], roles: ['foreman'],
    gloss: 'Workers!', phraseTier: 'C', usageTier: 'C', src: 'lexicon el:kurtaš (PF tablets, Iranica extracts)',
    note: 'the administrative word for the royal workforce used as a call; whether it was a spoken address is unknown (C)' },
  // ---------------- Aramaic: the lingua franca (letter formulas + Biblical Aramaic vocabulary)
  { id: 'arc.greet.slm', lang: 'arc', intent: 'greet', words: ['arc:šlm'],
    gloss: 'Greetings. (lit. "peace")', phraseTier: 'B', usageTier: 'C', src: 'letter openings "šlm PN" (Elephantine, Arshama letters; lexicon arc:šlm)',
    note: 'the written greeting word; its spoken use as a greeting is inferred (C)' },
  { id: 'arc.greet.slm_mra', lang: 'arc', intent: 'greet', words: ['arc:šlm', 'arc:mrʾ'],
    gloss: 'Greetings, lord.', phraseTier: 'C', usageTier: 'C', src: 'lexicon arc:šlm, arc:mrʾ',
    note: 'composed; letters address superiors as mrʾy "my lord", but that suffixed form has no lexicon entry (gap Q-024), so the bare noun is used' },
  { id: 'arc.reply.slm', lang: 'arc', intent: 'reply', words: ['arc:šlm'],
    gloss: 'Greetings. (lit. "peace")', phraseTier: 'B', usageTier: 'C', src: 'letter formula (lexicon arc:šlm)', note: 'returning the greeting (C)' },
  { id: 'arc.count.hd_trn_tlt', lang: 'arc', intent: 'count', words: ['arc:ḥd', 'arc:trn', 'arc:tlt'], intonation: 'level', roles: ['porter', 'scribe', 'official', 'foreman'],
    gloss: 'One, two, three.', phraseTier: 'C', usageTier: 'C', src: 'lexicon arc:ḥd, arc:trn, arc:tlt (Biblical Aramaic numerals)',
    note: 'counting sacks or jars aloud (C)' },
  { id: 'arc.offer.lhm', lang: 'arc', intent: 'offer', words: ['arc:lḥm'], roles: ['baker', 'grinder'],
    gloss: 'Bread.', phraseTier: 'C', usageTier: 'C', src: 'lexicon arc:lḥm', note: 'offering or naming bread (C)' },
  { id: 'arc.identify.spr', lang: 'arc', intent: 'identify', words: ['arc:spr'], roles: ['scribe'],
    gloss: '(I am a) scribe.', phraseTier: 'C', usageTier: 'C', src: 'lexicon arc:spr', note: 'one-word self-identification (C)' },
  { id: 'arc.identify.igra', lang: 'arc', intent: 'identify', words: ['arc:ʾgrh'], roles: ['courier'],
    gloss: '(A) letter.', phraseTier: 'C', usageTier: 'C', src: 'lexicon arc:ʾgrh', note: 'a courier naming what he carries (C)' },
];

/**
 * Lines that were wanted but omitted because the lexicon lacks a word or form. Mirrored in research/OPEN_QUESTIONS.md.
 * Nothing here is ever voiced.
 */
export const LEXICON_GAPS: { lang: LangId | string; wanted: string; missing: string; q: string }[] = [
  { lang: 'op', wanted: 'greeting / reply / thanks / yes / no', missing: 'no everyday formula is attested in Old Persian (lexicon records the absence)', q: 'Q-022' },
  { lang: 'op', wanted: 'vašnā A.uramazdāhā "by the favour of Ahuramazda"', missing: 'genitive A.uramazdāhā (attested XPa 11) has no lexicon entry', q: 'Q-022' },
  { lang: 'op', wanted: 'water, bread, come, go, give', missing: 'no entries (OP "water" searched and not found)', q: 'Q-022' },
  { lang: 'el', wanted: 'greeting / reply / yes / no', missing: 'no entries', q: 'Q-023' },
  { lang: 'el', wanted: 'zaumin Uramasdana "by the favour of Ahuramazda"', missing: 'genitive Uramasda-na (attested XPa El) has no lexicon entry', q: 'Q-023' },
  { lang: 'el', wanted: 'barley / flour / wine ration talk', missing: 'ŠE.BAR, ZÍD.DA, GEŠTIN, QA are logograms without a phonetic reading (ipa "–")', q: 'Q-023' },
  { lang: 'arc', wanted: 'ʾlhyʾ yšʾlw šlmk "may the gods seek after your welfare" (letter blessing)', missing: 'ʾlhyʾ (emph. pl.), yšʾlw (impf. 3 m.pl. of šʾl), šlmk (šlm + 2 m.sg. suffix)', q: 'Q-024' },
  { lang: 'arc', wanted: 'šlm mrʾy "greetings, my lord"', missing: 'mrʾy (1 sg. suffix) has no entry/IPA', q: 'Q-024' },
  { lang: 'arc', wanted: 'yes / no / come / go / give / thank you', missing: 'no entries (e.g. lʾ "not")', q: 'Q-024' },
  { lang: 'Babylonian, Greek, Egyptian, Lydian', wanted: 'any line', missing: 'no lexicon for these languages; their speakers answer with gesture (or Aramaic if the sim lists it)', q: 'Q-025' },
];

export interface ResolvedLine extends SpeakableLine {
  def: LineDef; entries: LexEntry[];
  tier: 'A' | 'B' | 'C';
  tierParts: { words: 'A' | 'B' | 'C'; phrase: 'A' | 'B' | 'C'; ipa: 'A' | 'B' | 'C'; usage: 'B' | 'C' };
}

/** Resolve a line against the lexicon; throws if a word is missing, from another language, or has no IPA. */
export function resolveLine(def: LineDef): ResolvedLine {
  const entries = def.words.map(id => {
    const e = lexEntry(id);
    if (!e) throw new Error(`speech line ${def.id}: "${id}" is not a lexicon entry`);
    if (e.lang !== def.lang) throw new Error(`speech line ${def.id}: "${id}" is ${e.lang}, line is ${def.lang}`);
    if (!isSpeakable(e)) throw new Error(`speech line ${def.id}: "${id}" has no speakable IPA`);
    return e;
  });
  const words = worstTier(...entries.map(e => e.tier)), ipa = worstTier(...entries.map(e => e.tierIpa));
  return {
    id: def.id, lang: def.lang, intonation: def.intonation, def, entries,
    ipa: entries.map(e => e.ipa!).join(' '),
    translit: entries.map(citationForm).join(' '),
    gloss: def.gloss,
    tier: worstTier(words, def.phraseTier, ipa, def.usageTier),
    tierParts: { words, phrase: def.phraseTier, ipa, usage: def.usageTier },
  };
}

export const LINES: ResolvedLine[] = LINE_DEFS.map(resolveLine);
export const LINE_BY_ID = new Map(LINES.map(l => [l.id, l]));

/**
 * Sim language labels (Agent.langs) that may speak scripted lines. Only languages with a lexicon; everyone else answers
 * with gesture. 'Iranian' (the sim's label for Persians named from the Iranian pool) is voiced as Old Persian (C).
 */
export const SPEECH_LANGS: Record<string, { lang: LangId; tier: 'B' | 'C'; note: string }> = {
  'Old Persian': { lang: 'op', tier: 'C', note: 'lexicon IPA reconstructed' },
  Iranian: { lang: 'op', tier: 'C', note: 'unspecified Iranian speaker given Old Persian lines' },
  Elamite: { lang: 'el', tier: 'C', note: 'lexicon IPA reconstructed' },
  Aramaic: { lang: 'arc', tier: 'C', note: 'lexicon IPA reconstructed' },
};

/**
 * Pick a line for a speaker: tries the speaker's languages in order (code-switching: a Persian who also speaks Aramaic
 * greets in Aramaic, since Old Persian has no attested greeting). Returns null when nothing fits: the NPC responds with
 * gesture only. Deterministic for a given seed.
 */
export function pickLine(q: { langs: readonly string[]; intent: Intent; role?: string; seed?: number }): { line: ResolvedLine; via: string } | null {
  const rng = new Rng(q.seed ?? 1, `line:${q.intent}`);
  for (const label of q.langs) {
    const m = SPEECH_LANGS[label]; if (!m) continue;
    const cands = LINES.filter(l => l.lang === m.lang && l.def.intent === q.intent && (!l.def.roles || (q.role != null && l.def.roles.includes(q.role))));
    if (cands.length) return { line: rng.pick(cands), via: label };
  }
  return null;
}

/**
 * Deterministic voice for a person. The sim has no ages yet: adults 20–55 by seed, children (role 'child') 8. Tier C.
 */
export function voiceFor(p: { seed: number; sex: 'm' | 'f'; role?: string; age?: number }): VoiceParams {
  const r = new Rng(p.seed >>> 0, 'voice');
  const age = p.age ?? (p.role === 'child' ? 6 + r.int(0, 5) : 20 + r.int(0, 35));
  return { sex: p.sex, age, pitch: 0.9 + r.next() * 0.2, rate: 0.92 + r.next() * 0.16, breath: r.next() * 0.05, seed: hashString(`voice:${p.seed}`) };
}

/** the pre-rendered voice class for a speaker (tools/build_speech.py: m1 man low, m2 man mid, m3 old man, f1 woman,
 *  f2 older woman, c1 child); deterministic from the voice parameters (C) */
export function voiceKeyFor(v: VoiceParams): 'm1' | 'm2' | 'm3' | 'f1' | 'f2' | 'c1' {
  if (v.age < 14) return 'c1';
  if (v.sex === 'f') return v.age >= 45 ? 'f2' : 'f1';
  if (v.age >= 50) return 'm3';
  return v.pitch < 1.0 ? 'm1' : 'm2';
}
