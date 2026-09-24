// Lexicon access (brief §10): research/LEXICON/<language>.json is the only source of words that may be spoken or written
// in the world. Entries carry no ids in the research files, so an entry's id is `<lang>:<form>` with the form verbatim
// (e.g. `op:xšāyaθiya`, `el:nap`, `arc:šlm`, `bab:šulmu`, `grc:khaire`). Ids are stable as long as the research file keeps
// the form spelling.
import opJson from '../../research/LEXICON/old_persian.json';
import elJson from '../../research/LEXICON/elamite.json';
import arcJson from '../../research/LEXICON/aramaic.json';
import babJson from '../../research/LEXICON/babylonian.json';
import grcJson from '../../research/LEXICON/greek.json';

/** Languages with a lexicon (speech lines + murmur profiles are built from these only). bab = Late Babylonian Akkadian,
 *  grc = 5th-c. Ionic Greek (romanised forms; the Greek-alphabet spelling is the `script` field). */
export type LangId = 'op' | 'el' | 'arc' | 'bab' | 'grc';
export const LANG_IDS: readonly LangId[] = ['op', 'el', 'arc', 'bab', 'grc'];
export const LANG_NAMES: Record<LangId, string> = { op: 'Old Persian', el: 'Elamite', arc: 'Aramaic', bab: 'Babylonian', grc: 'Greek (Ionic)' };

export interface LexEntry {
  id: string; lang: LangId; form: string; gloss: string; pos: string;
  /** raw IPA field from the research file (may hold notes, alternatives, '–' or null) */
  ipaRaw: string | null;
  /** IPA usable by the synthesiser (first alternative, notes stripped), or null when the entry has none */
  ipa: string | null;
  script: string | null; source: string; tier: string; tierIpa: string; tierScript: string;
  /** keys into src/data/sources.json (out-of-world: dev overlay, translation layer) */
  src: string[];
  note: string;
  /** the attested inflected form the IPA voices, when it differs from the citation form (`naiba-` is heard as nai̯bam) */
  spoken: string | null;
  /** Aramaic: the only attestation read is in Daniel (later than 467; LANGUAGES.md §6) */
  danielOnly: boolean;
}

/**
 * Normalise a lexicon IPA field for synthesis: drop bracketed notes ("puça (ç value disputed …)"), take the first of
 * alternatives separated by " / " ("malk / malkaː"), and treat '–', '-' and empty as "no IPA".
 */
export function cleanIpa(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = raw.normalize('NFC').replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  s = s.split(/\s\/\s/)[0].replace(/\s+/g, ' ').trim();
  if (!s || /^[-–—]+$/.test(s)) return null;
  return s;
}

function load(lang: LangId, rows: any[]): LexEntry[] {
  return rows.map(r => ({
    id: `${lang}:${r.form}`, lang, form: r.form, gloss: r.gloss, pos: r.pos, ipaRaw: r.ipa ?? null, ipa: cleanIpa(r.ipa),
    script: r.script ?? null, source: r.source, tier: String(r.tier), tierIpa: String(r.tier_ipa), tierScript: String(r.tier_script),
    src: Array.isArray(r.src) ? r.src.map(String) : [], note: r.note ?? '', spoken: r.spoken ?? null,
    danielOnly: r.daniel_only === true || /\bDaniel only\b/.test(String(r.attested ?? '')),
  }));
}

export const LEXICON: Record<LangId, LexEntry[]> = {
  op: load('op', opJson as any[]),
  el: load('el', elJson as any[]),
  arc: load('arc', arcJson as any[]),
  bab: load('bab', babJson as any[]),
  grc: load('grc', grcJson as any[]),
};

const BY_ID = new Map<string, LexEntry>();
for (const l of Object.keys(LEXICON) as LangId[]) for (const e of LEXICON[l]) BY_ID.set(e.id, e);

export function lexEntry(id: string): LexEntry | undefined { return BY_ID.get(id); }
export function allLexEntries(): LexEntry[] { return [...BY_ID.values()]; }

/** The citation form without the stem hyphen (`uvaspa-` → `uvaspa`). */
export function citationForm(e: LexEntry): string { return e.form.replace(/-$/, ''); }

/** Aramaic IPA → the Semitist romanisation of what is heard (ʃ š, ħ ḥ, ʕ ʿ, ʔ ʾ, emphatics with a dot, long vowels with
 *  a macron). The written skeleton (šlm) is not what is heard (/ʃəlaːm/), and the Tiberian vocalisation (ləḥem) is
 *  later than the reconstructed Imperial Aramaic the IPA voices (laħm), so the subtitle shows this. */
export function romaniseAramaicIpa(ipa: string): string {
  let s = ipa.normalize('NFC').replace(/ˈ|ˌ/g, '');
  for (const [a, b] of [['tˤ', 'ṭ'], ['sˤ', 'ṣ'], ['dˤ', 'ḍ'], ['aː', 'ā'], ['eː', 'ē'], ['iː', 'ī'], ['oː', 'ō'], ['uː', 'ū'], ['ʃ', 'š'], ['ħ', 'ḥ'], ['ʕ', 'ʿ'], ['ʔ', 'ʾ'],
    ['ɡ', 'g'], ['j', 'y'], ['θ', 'ṯ'], ['ð', 'ḏ'], ['χ', 'ḵ'], ['ɣ', 'ḡ']] as const) s = s.split(a).join(b);
  return s;
}

/**
 * What the subtitle shows for a word: the form that is heard. Old Persian stems voiced in an attested inflected form show
 * that form (`spoken`, from the text: naiba- → nai̯bam, XPa); Aramaic shows the romanised IPA; otherwise the citation form.
 */
export function spokenForm(e: LexEntry): string {
  if (e.spoken) return e.spoken;
  if (e.lang === 'arc' && e.ipa) return romaniseAramaicIpa(e.ipa);
  return citationForm(e);
}

/**
 * Entries whose sounds may feed the crowd murmur's phonotactics: speakable words attested in a text read (tier A or B).
 * A tier-C entry is a reconstruction nobody has seen (Aramaic myn "water"): its sounds are not evidence (review A-M7).
 */
export function murmurEligible(e: LexEntry): boolean { return isSpeakable(e) && worstTier(e.tier) !== 'C'; }

/**
 * Entries that stand for an absence ("(greetings / politeness formulas)", "(water)") or for a logogram without a
 * reading carry no speakable IPA. They must never be used in a line.
 */
export function isSpeakable(e: LexEntry): boolean { return e.ipa != null && !e.form.startsWith('('); }

/** Tier ordering helper: worst (least certain) of a list of tier strings; 'A (absence…)' etc. read by first letter. */
export function worstTier(...tiers: string[]): 'A' | 'B' | 'C' {
  let w: 'A' | 'B' | 'C' = 'A';
  for (const t of tiers) { const c = (t || 'C').trim()[0]; if (c === 'C' || !'AB'.includes(c)) return 'C'; if (c === 'B') w = 'B'; }
  return w;
}
