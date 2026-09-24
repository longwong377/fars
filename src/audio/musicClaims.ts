// The music claims the code makes, by id (research/SOUNDSCAPE.md §8; brief §11 "verify each claim and record it").
// `npm run lint:music` (tools/lint_music.ts) checks that each id here is a row of SOUNDSCAPE §8 with the same tier and
// source keys that resolve in src/data/sources.json, and that every performance the world can schedule cites only these.
// `MusicSystem.perform` refuses a performance that cites none, or an id that is not here.
export interface MusicClaim { id: string; tier: string; src: string[]; short: string }
export const MUSIC_CLAIMS: Record<string, MusicClaim> = {
  'M-01': { id: 'M-01', tier: 'B', src: ['ATH4-HERACL'], short: "at the king's supper his women sing and play (harps); one leads, then all sing together (Heracleides via Athenaeus 4.145c)" },
  'M-02': { id: 'M-02', tier: 'B', src: ['ATH12-HERACL'], short: 'the women watch all night, singing and playing, with lights burning (Heracleides via Athenaeus 12.514b)' },
  'M-03': { id: 'M-03', tier: 'B', src: ['ATH13-PARM'], short: "329 royal concubines skilled in music in Darius III's household (Parmenion via Athenaeus 13.608a)" },
  'M-04': { id: 'M-04', tier: 'B', src: ['SOUND-R'], short: 'angular harps in Iran (Neo-Elamite reliefs); 9 strings tuned heptatonically (UET VII 74)' },
  'M-05': { id: 'M-05', tier: 'B', src: ['HDT'], short: 'no pipe music at a Persian sacrifice (Herodotus 1.132)' },
  'M-07': { id: 'M-07', tier: 'C', src: ['ATH14-WORK'], short: 'Greek work songs by trade, the millstone song among them (Athenaeus 14.618-619); B for Greece, C at Persepolis' },
  'M-08': { id: 'M-08', tier: 'B', src: ['IR-PET'], short: 'Ionians among the stonecutters of Persepolis' },
  'M-09': { id: 'M-09', tier: 'B', src: ['IR-WOMEN'], short: "women's work groups with rations at Persepolis" },
  'M-13': { id: 'M-13', tier: 'C', src: ['KILMER-SPECIES'], short: "Babylonian tuning names equated with Greek octave species (Kilmer, via extracts; Q-300)" },
  'M-14': { id: 'M-14', tier: 'B', src: ['SEP-PHILOLAUS'], short: "Philolaus' diatonic: tones of 9:8 and a remainder of 256:243" },
  'M-15': { id: 'M-15', tier: 'C', src: [], short: 'no song text is attested: every song is a vocalise without words' },
  'M-16': { id: 'M-16', tier: 'C', src: [], short: 'the court is resident only under the out-of-world setting (D-003, B9)' },
  'M-17': { id: 'M-17', tier: 'C', src: [], short: 'composition: seeded motif, cadences, harp dyads, heterophony' },
};
/** claims that are recorded but must never be performed (M-06 the magus's chant: no attested text; M-10 herders' pipes:
 *  no rendered herder; M-11, M-12 not Achaemenid or rejected) */
export const NOT_PERFORMED = ['M-06', 'M-10', 'M-11', 'M-12'];
export const knownClaim = (id: string) => id in MUSIC_CLAIMS;
/** the weakest tier among a performance's claims (C < B < A) */
export function tierOf(ids: string[]): string {
  const rank = (t: string) => (t.startsWith('A') ? 3 : t.startsWith('B') ? 2 : 1);
  let worst = 'A'; for (const id of ids) { const t = MUSIC_CLAIMS[id]?.tier ?? 'C'; if (rank(t) < rank(worst)) worst = t; }
  return ids.length ? worst : '??';
}
