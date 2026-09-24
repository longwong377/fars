// Tunings for the only music allowed in the world: music someone in it is playing (brief §11; research/SOUNDSCAPE.md §3, §8).
// Mesopotamian heptatonic system (B-): a 7-string (+2 octave strings) instrument tuned by alternating fifths and fourths
// (CBS 10996, UET VII 74 and 126, via search extracts; Kilmer/Dumbrill). Tuning by pure fifths (3:2) and fourths (4:3)
// yields the Pythagorean diatonic set (tones 9:8, limma 256:243); the interval sizes are an inference from the procedure
// (C). The seven tunings are the seven octave species of that set; which name is which scale follows Kilmer's equation
// with the Greek species as reported by search extracts (SOUNDSCAPE §8 M-13: išartu Dorian, kitmu Hypodorian, embūbu
// Phrygian, pītu Hypophrygian, nīd qabli Lydian, nīš gabarî Hypolydian, qablītu Mixolydian; Kilmer NOT SEEN; the cycle's
// order conflicts between extracts: Q-300). Greek modes for Greeks (brief §11): the same diatonic set on Philolaus'
// ratios (256:243, 9:8, 9:8; SOUNDSCAPE §8 M-14, B for the ratios, C for the species names in 467).
// No equal temperament anywhere: every pitch is a ratio of powers of 2 and 3 (tests/music.test.ts).
export type Ratio = [number, number];
const r = (n: number, d: number): Ratio => [n, d];
export const ratio = (x: Ratio) => x[0] / x[1];

/** the diatonic set from the fifth/fourth tuning cycle, ascending from string 1 (Pythagorean; C for the exact sizes) */
const PYTH_DIATONIC: Ratio[] = [r(1, 1), r(9, 8), r(81, 64), r(4, 3), r(3, 2), r(27, 16), r(243, 128)];

export interface Mode { id: string; name: string; species: string; rotation: number; tier: string; note: string; steps: Ratio[]; /** SOUNDSCAPE §8 claim ids */ claims: string[] }
function rotate(set: Ratio[], k: number): Ratio[] {
  const base = ratio(set[k]); const out: Ratio[] = [];
  for (let i = 0; i < 7; i++) { const s = set[(k + i) % 7]; let [n, d] = s; if ((k + i) >= 7) n *= 2; // next octave
    // express relative to the new first string, reduced
    const num = n * set[k][1], den = d * set[k][0]; const g = gcd(num, den); out.push([num / g, den / g]); }
  void base; return out;
}
/** the ascending step pattern of a mode ('T' 9:8, 'S' 256:243) */
export function stepPattern(m: Mode): string {
  let out = ''; for (let i = 0; i < 7; i++) { const a = ratio(m.steps[i]), b = i < 6 ? ratio(m.steps[i + 1]) : 2; out += Math.abs(b / a - 9 / 8) < 1e-9 ? 'T' : Math.abs(b / a - 256 / 243) < 1e-9 ? 'S' : '?'; }
  return out;
}
function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }

/** Greek octave species as rotations of PYTH_DIATONIC (C D E F G A B): the index of the species' lowest note */
export const SPECIES_START: Record<string, number> = { Lydian: 0, Phrygian: 1, Dorian: 2, Hypolydian: 3, Hypophrygian: 4, Hypodorian: 5, Mixolydian: 6 };
/** the ascending tone/semitone pattern of each species ('T' = 9:8, 'S' = 256:243), for tests and the overlay */
export const SPECIES_PATTERN: Record<string, string> = { Lydian: 'TTSTTTS', Phrygian: 'TSTTTST', Dorian: 'STTTSTT', Hypolydian: 'TTTSTTS', Hypophrygian: 'TTSTTST', Hypodorian: 'TSTTSTT', Mixolydian: 'STTSTTT' };
/** the seven Babylonian tunings (names as in SOUNDSCAPE §8 M-13) and Kilmer's Greek species for each (extract, C) */
const NAMES: [string, string][] = [['išartum', 'Dorian'], ['kitmum', 'Hypodorian'], ['embūbum', 'Phrygian'], ['pītum', 'Hypophrygian'], ['nīd qablim', 'Lydian'], ['qablītum', 'Mixolydian'], ['nīš gabarîm', 'Hypolydian']];
/** the seven heptatonic modes: the fifth/fourth-cycle diatonic in each octave species; names by Kilmer's equation (C) */
export const MESOPOTAMIAN_MODES: Mode[] = NAMES.map(([name, species], i) => ({
  id: `meso${i + 1}`, name, species, rotation: SPECIES_START[species], tier: 'B- system / C sizes and names', claims: ['M-04', 'M-13'],
  note: `fifth/fourth-cycle diatonic in the ${species} species (Kilmer's equation via search extracts, SOUNDSCAPE §8 M-13; Q-300)`,
  steps: rotate(PYTH_DIATONIC, SPECIES_START[species]),
}));

/** Greek octave species on the Philolaan diatonic (the same Pythagorean set; SOUNDSCAPE §8 M-14) */
const greek = (species: string, note: string): Mode => ({ id: species.toLowerCase(), name: `${species} (diatonic)`, species, rotation: SPECIES_START[species],
  tier: 'B ratios (Philolaus) / C names and use', claims: ['M-14'], note, steps: rotate(PYTH_DIATONIC, SPECIES_START[species]) });
export const GREEK_MODES: Mode[] = [
  greek('Dorian', 'Philolaan diatonic: descending tetrachords of tone, tone, limma (E species); for the Ionian stonecutters (C)'),
  greek('Phrygian', 'the D species of the same diatonic set'),
  greek('Lydian', 'the C species of the same diatonic set'),
];

/** frequencies (Hz) of an instrument's strings/holes in a mode: `count` notes ascending from `f0`, octave-extended */
export function scaleFreqs(mode: Mode, f0: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(f0 * ratio(mode.steps[i % 7]) * 2 ** Math.floor(i / 7));
  return out;
}
/** cents of an interval (for tests and the dev overlay) */
export const cents = (f1: number, f2: number) => 1200 * Math.log2(f2 / f1);
