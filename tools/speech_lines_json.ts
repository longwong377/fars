// dev/build: print the resolved scripted lines (id, language, IPA, intonation, tier) as JSON for tools/build_speech.py
import { LINES } from '../src/people/speech_lines';
console.log(JSON.stringify(LINES.map(l => ({ id: l.id, lang: l.lang, ipa: l.ipa, intonation: l.intonation ?? null, tier: l.tier }))));
