// D-336: the naturalness of each of Kokoro's 54 style voices speaking the lexicon's period languages (and one English
// sentence): UTMOS22 per voice, alone and at the tracts people get (children's 1.3, a big man's 0.94). The voices below the
// floor are left out of the pool people are blended from (identity.ts VOICE_POOL). Writes REVIEWS/evidence/s12-voices/bases.json
import { writeFileSync } from 'node:fs';
import { kokoro, Instruments, to16k } from './voices_measure';
import { BASE_VOICES, phonemesFor, espeakToKokoro } from '../../src/audio/neural/kokoro';
import { espeakIpa } from '../../src/audio/neural/g2p';
import { unitsFor } from '../../src/audio/voices';

const K = await kokoro(); const I = await Instruments.load({ ecapa: false });
const units = (['op', 'el', 'arc', 'bab', 'grc'] as const).map(l => unitsFor(l).lines[1] ?? unitsFor(l).lines[0]);
const en = espeakToKokoro(await espeakIpa('Not too bad. The stair is a bit steep, but my son helps me with the grain.', 'en'), 'en');
const out: any[] = [];
for (const [name, sex, lang] of BASE_VOICES) {
  const res: Record<string, number> = {};
  for (const tract of [1, sex === 'f' ? 1.3 : 0.94]) {
    const v = { key: name, sex, age: 30, mix: [[name, 1]] as [string, number][], speed: 1, tract, level: 0.08 };
    const m: number[] = []; for (const u of units) m.push((await I.mos(to16k(await K.speak(phonemesFor(u.ipa, u.intonation), v), 24000)))!);
    res[`period@${tract}`] = +(m.reduce((a, b) => a + b, 0) / m.length).toFixed(3);
    res[`en@${tract}`] = +(await I.mos(to16k(await K.speak(en, v), 24000)))!.toFixed(3);
  }
  out.push({ name, sex, lang, ...res }); console.log(JSON.stringify(out.at(-1)));
}
writeFileSync('REVIEWS/evidence/s12-voices/bases.json', JSON.stringify({ what: 'UTMOS22 of each Kokoro style voice alone: the lexicon lines of op, el, arc, bab, grc (mean) and one English sentence, at tract 1 and at the tract its people get (women: a child 1.3; men: 0.94)', units: units.map(u => u.id), rows: out }, null, 1));
