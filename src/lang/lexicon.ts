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
    src: Array.isArray(r.src) ? r.src.map(String) : [], note: r.note ?? '',
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

/** The citation form without the stem hyphen (`uvaspa-` → `uvaspa`), used as the transliteration in the subtitle layer. */
export function citationForm(e: LexEntry): string { return e.form.replace(/-$/, ''); }

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
