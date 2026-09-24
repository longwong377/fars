// dev/build: print the resolved scripted lines as JSON for tools/build_speech.py and tools/voice_acceptance.py: id,
// language, IPA, intonation, tier, intent, whether the out-of-world gloss reads as an exclamation, and the IPA with the
// stress the formant voice uses marked on every word (markStress, D-185)
import { LINES } from '../src/people/speech_lines';
import { markStress } from '../src/audio/speech';
console.log(JSON.stringify(LINES.map(l => ({
  id: l.id, lang: l.lang, ipa: l.ipa, intonation: l.intonation ?? null, tier: l.tier, intent: l.def.intent,
  exclaim: /!\s*(\(.*\))?\s*$/.test(l.gloss), stressed: markStress(l.ipa, l.lang),
}))));
