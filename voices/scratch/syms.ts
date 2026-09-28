import { LEXICON, LANG_IDS } from '../../../fars-wt/voices/src/lang/lexicon';
import { LINES } from '../../../fars-wt/voices/src/people/speech_lines';
const count = new Map<string, number>(); const ex = new Map<string, string>();
for (const l of LANG_IDS) for (const e of LEXICON[l]) if (e.ipa) for (const ch of e.ipa.normalize('NFD')) { count.set(ch, (count.get(ch) ?? 0) + 1); if (!ex.has(ch)) ex.set(ch, l + ':' + e.ipa); }
for (const L of LINES) for (const ch of L.ipa.normalize('NFD')) { count.set(ch, (count.get(ch) ?? 0) + 1); if (!ex.has(ch)) ex.set(ch, L.lang + ':' + L.ipa); }
console.log([...count].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${JSON.stringify(c)} U+${c.codePointAt(0)!.toString(16)} ${n} ${ex.get(c)}`).join('\n'));
console.log(LINES.slice(0, 12).map(l => l.lang + ' ' + l.ipa + ' | ' + l.gloss).join('\n'));
