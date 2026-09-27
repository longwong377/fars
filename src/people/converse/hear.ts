// D-296 (UD-18, T-I1, T-I1f): the fence on the way in. A person of Parsa in 467 hears a word of a later age as a foreign sound:
// before the model reads the stranger's words, every modern, meta or later-name word in them (fence.ts: the blocklist, the
// modern terms, the fate names, the model's own words) is replaced by "…" and the person is told they did not understand
// it; a question about what is to come (the fate, the future of the king, the Terrace or the empire) carries a note that
// they cannot know it. The model then never sees the anachronism it might repeat or play along with. The words heard as
// noise are out of world (listed in the translation layer's note).
import { fenceHits } from './fence';

export interface Heard { text: string; unknown: string[]; future: boolean; meta: boolean; note: string }
const FUTURE = /\b(will (this|these|the|you|it|they|he)\b.*\b(stand|fall|burn|last|end|die|become|happen|be destroyed)|what will (become|happen)|future|thousand years|hundred years|years from now|one day (this|these|the)|how will .* die|who will rule|after (the king|xerxes) dies|ever burn)/i;
const META = /\b(ai|a\.i\.|robot|machine|ignore|instructions?|prompt|pretend|roleplay|role-play|character|historian|scholar|model|system|developer|jailbreak)\b/i;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function hearAsPerson(said: string): Heard {
  let text = said; const unknown: string[] = [];
  const hits = fenceHits(said).filter(h => h.kind !== 'script');
  for (const h of hits) { if (h.term === 'digits') { text = text.replace(/\b\d[\d:,.]*\s*(bc|bce|ad|ce)?\b/gi, m => { unknown.push(m.trim()); return '…'; }); continue; }
    const re = new RegExp(`(^|[^\\p{L}])(${esc(h.term).replace(/[ _-]/g, '[ _-]?')}(e?s)?)(?=$|[^\\p{L}])`, 'giu');
    text = text.replace(re, (_m, pre, w) => { unknown.push(w); return `${pre}…`; }); }
  const metaWords = said.match(new RegExp(META.source, 'gi')) ?? [];
  for (const w of metaWords) { text = text.replace(new RegExp(`\\b${esc(w)}\\b`, 'gi'), '…'); unknown.push(w); }
  const future = FUTURE.test(said) || hits.some(h => h.kind === 'fate'); const meta = metaWords.length > 0 || hits.some(h => h.kind === 'meta');
  const notes: string[] = [];
  if (unknown.length) notes.push('where you hear “…” the stranger used foreign words you did not understand: say so plainly and speak of your own affairs');
  if (future) notes.push('it is a question about what is to come: no one can know it; speak of your hopes, the gods’ will and your own day');
  if (meta) notes.push('the stranger talks strangely; you are only yourself');
  return { text: text.replace(/(…\s*){2,}/g, '… ').trim(), unknown: [...new Set(unknown)], future, meta, note: notes.join('; ') };
}
