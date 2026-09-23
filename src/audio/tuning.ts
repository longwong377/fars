// Tunings for the only music allowed in the world: music someone in it is playing (brief §11; research/SOUNDSCAPE.md §3).
// Mesopotamian heptatonic system (B): a 7-string (+2 octave strings) instrument tuned by alternating fifths and fourths
// (CBS 10996, UET VII 74 and 126, via search extracts; Kilmer/Dumbrill). Tuning by pure fifths (3:2) and fourths (4:3)
// yields the Pythagorean diatonic set (tones 9:8, limma 256:243): the interval sizes are an inference from the procedure
// (C). The seven modes are the seven rotations; their Akkadian names follow the Kilmer cycle as recalled in SOUNDSCAPE.md
// §3 (names NOT SEEN in an extract: C). Greek modes for Greeks (brief §11): the diatonic tetrachord of Philolaus
// (256:243, 9:8, 9:8; a contemporary Pythagorean, B for the ratios as a Greek system, C for Ionian masons in 467).
// No equal temperament anywhere: every pitch is a ratio of small integers or of powers of 2 and 3 (tests/music.test.ts).

export type Ratio = [number, number];
const r = (n: number, d: number): Ratio => [n, d];
export const ratio = (x: Ratio) => x[0] / x[1];

/** the diatonic set from the fifth/fourth tuning cycle, ascending from string 1 (Pythagorean; C for the exact sizes) */
const PYTH_DIATONIC: Ratio[] = [r(1, 1), r(9, 8), r(81, 64), r(4, 3), r(3, 2), r(27, 16), r(243, 128)];

export interface Mode { id: string; name: string; rotation: number; tier: string; note: string; steps: Ratio[] }
function rotate(set: Ratio[], k: number): Ratio[] {
  const base = ratio(set[k]); const out: Ratio[] = [];
  for (let i = 0; i < 7; i++) { const s = set[(k + i) % 7]; let [n, d] = s; if ((k + i) >= 7) n *= 2; // next octave
    // express relative to the new first string, reduced
    const num = n * set[k][1], den = d * set[k][0]; const g = gcd(num, den); out.push([num / g, den / g]); }
  void base; return out;
}
function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }

const NAMES = ['išartum', 'kitmum', 'embūbum', 'pītum', 'nīd qablim', 'qablītum', 'nīš gabarîm'];
/** the seven heptatonic modes (rotations of the Pythagorean diatonic); names by the Kilmer cycle (C, NOT SEEN) */
export const MESOPOTAMIAN_MODES: Mode[] = NAMES.map((name, i) => ({
  id: `meso${i + 1}`, name, rotation: i, tier: 'B system / C sizes and names',
  note: 'rotation of the fifth/fourth-cycle diatonic (CBS 10996, UET VII 74/126 via SOUNDSCAPE.md); name order recalled, not seen',
  steps: rotate(PYTH_DIATONIC, i),
}));

/** Greek octave species on the Philolaan diatonic (Dorian = descending tetrachords of limma, tone, tone) */
const DORIAN_UP: Ratio[] = [r(1, 1), r(256, 243), r(32, 27), r(4, 3), r(3, 2), r(128, 81), r(16, 9)];
export const GREEK_MODES: Mode[] = [
  { id: 'dorian', name: 'Dorian (diatonic)', rotation: 0, tier: 'B ratios (Philolaus) / C use', note: 'Philolaan diatonic tetrachord 256:243, 9:8, 9:8; for the Ionian stonecutters (C)', steps: DORIAN_UP },
  { id: 'phrygian', name: 'Phrygian (diatonic)', rotation: 0, tier: 'B ratios / C use', note: 'rotation of the same diatonic set', steps: rotate(DORIAN_UP, 1) },
  { id: 'lydian', name: 'Lydian (diatonic)', rotation: 0, tier: 'B ratios / C use', note: 'rotation of the same diatonic set', steps: rotate(DORIAN_UP, 2) },
];

/** frequencies (Hz) of an instrument's strings/holes in a mode: `count` notes ascending from `f0`, octave-extended */
export function scaleFreqs(mode: Mode, f0: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(f0 * ratio(mode.steps[i % 7]) * 2 ** Math.floor(i / 7));
  return out;
}
/** cents of an interval (for tests and the dev overlay) */
export const cents = (f1: number, f2: number) => 1200 * Math.log2(f2 / f1);
