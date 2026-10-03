// The main theme, "Pārsa" (D-760; UD-38, UD-39): the title film's score, about 2:25, in D minor. Majesty from harmony,
// brass, choir and rhythm, in the manner of the great historical scores, and none of the "ancient Persia" cliché the brief
// bans (§11, blocklist 'music-cliche': no duduk, oud or santur, no augmented-second "exotic" modes, no ethnic solo wailing
// as the theme's identity); the period's own colour, harps and frame drums, only lightly (an original score, out of world).
//
// Form (bars of 4/4; the film's edit is cut to the marks):
//   1-6    night        the low D, the hall breathing; the alto flute's call (the theme's head) from far off
//   7-14   theme        A, the solo cello over the strings, the drum's heartbeat from bar 11
//   15-18  build        the low strings' ostinato (3+3+2), horns swelling Dm-Bb-Gm-A, the drums gathering
//   19-26  tutti        A in horns and celli, the violins and then the trumpets an octave above, choir, taiko
//   27-34  rise         B: Bb-F-C-Dm-Gm-Dm/F-Eb-A, the Eb major (the Phrygian II) its summit
//   35-38  title, coda  the arrival on D (the title card), and the solo horn's last phrase over the open fifth
import { Tempo, line, chords, pc, type Cue, type LNote, type Part } from '../lib/write';
import { KIT } from '../orchestra';

const bar = (n: number) => (n - 1) * 4; // beat at the start of bar n
const tempo = new Tempo([[0, 58], [bar(6), 60], [bar(7), 64], [bar(14), 63], [bar(15), 66], [bar(19), 70], [bar(32), 70], [bar(34) + 2, 60], [bar(35), 58], [bar(37), 54], [bar(39), 50]],
  [[bar(35) - 0.01, 0.35]]); // a breath before the arrival

// --- the harmony, bar by bar (half bars where two chords share one); voicings in the low strings
type Ch = 'Dm' | 'C' | 'F' | 'Bb' | 'Gm' | 'A' | 'Eb' | 'Dm/F' | 'D5';
const ROOT: Record<Ch, string> = { Dm: 'D', C: 'C', F: 'F', Bb: 'Bb', Gm: 'G', A: 'A', Eb: 'Eb', 'Dm/F': 'F', D5: 'D' };
const CB: Record<Ch, string> = { Dm: 'D2', C: 'C2', F: 'F1', Bb: 'Bb1', Gm: 'G1', A: 'A1', Eb: 'Eb2', 'Dm/F': 'F2', D5: 'D2' };
const VC: Record<Ch, string> = { Dm: 'D3 A3', C: 'C3 G3', F: 'F2 C3', Bb: 'Bb2 F3', Gm: 'G2 D3', A: 'A2 E3', Eb: 'Eb3 Bb3', 'Dm/F': 'F2 D3', D5: 'D3 A3' };
const VA: Record<Ch, string> = { Dm: 'F3 A3', C: 'E3 G3', F: 'A3 C4', Bb: 'D4 F4', Gm: 'Bb3 D4', A: 'C#4 E4', Eb: 'G3 Bb3', 'Dm/F': 'A3 D4', D5: 'A3 D4' };
const HN: Record<Ch, string> = { Dm: 'D3 F3 A3 D4', C: 'C3 E3 G3 C4', F: 'C3 F3 A3 C4', Bb: 'D3 F3 Bb3 D4', Gm: 'D3 G3 Bb3 D4', A: 'C#3 E3 A3 C#4', Eb: 'Eb3 G3 Bb3 Eb4', 'Dm/F': 'D3 F3 A3 D4', D5: 'D3 A3 D4' };
const CHOIR: Record<Ch, string> = { Dm: 'D3 A3 D4 F4 A4', C: 'C3 G3 C4 E4 G4', F: 'F3 A3 C4 F4 A4', Bb: 'Bb2 F3 D4 F4 Bb4', Gm: 'G2 D3 Bb3 D4 G4', A: 'A2 E3 C#4 E4 A4', Eb: 'Eb3 Bb3 Eb4 G4 Bb4', 'Dm/F': 'F2 A3 D4 F4 A4', D5: 'D3 A3 D4 A4' };
/** [bar, beats into the bar, length in beats, chord] */
const H: [number, number, number, Ch][] = [
  ...[1, 2, 3, 4, 5, 6].map(b => [b, 0, 4, 'D5'] as [number, number, number, Ch]),
  [7, 0, 4, 'Dm'], [8, 0, 2, 'C'], [8, 2, 2, 'Dm'], [9, 0, 4, 'F'], [10, 0, 2, 'F'], [10, 2, 2, 'C'], [11, 0, 4, 'Bb'], [12, 0, 2, 'Gm'], [12, 2, 2, 'C'], [13, 0, 2, 'Gm'], [13, 2, 2, 'A'], [14, 0, 4, 'Dm'],
  [15, 0, 4, 'Dm'], [16, 0, 4, 'Bb'], [17, 0, 4, 'Gm'], [18, 0, 4, 'A'],
  [19, 0, 4, 'Dm'], [20, 0, 2, 'C'], [20, 2, 2, 'Dm'], [21, 0, 4, 'F'], [22, 0, 2, 'F'], [22, 2, 2, 'C'], [23, 0, 4, 'Bb'], [24, 0, 2, 'Gm'], [24, 2, 2, 'C'], [25, 0, 2, 'Gm'], [25, 2, 2, 'A'], [26, 0, 4, 'Dm'],
  [27, 0, 4, 'Bb'], [28, 0, 4, 'F'], [29, 0, 4, 'C'], [30, 0, 4, 'Dm'], [31, 0, 4, 'Gm'], [32, 0, 4, 'Dm/F'], [33, 0, 4, 'Eb'], [34, 0, 4, 'A'],
  [35, 0, 4, 'Dm'], [36, 0, 4, 'Bb'], [37, 0, 2, 'Gm'], [37, 2, 2, 'A'], [38, 0, 6, 'D5'],
];
const span = (from: number, to: number) => H.filter(([b]) => b >= from && b <= to);
const voiced = (from: number, to: number, table: Record<Ch, string>, oct = 0): LNote[] =>
  chords(span(from, to).map(([b, o, d, c]) => [bar(b) + o, d, table[c]] as [number, number, string]), oct * 12);

// --- the theme
const A = `D4:2 A4:1 G4:.5 F4:.5 | E4:1.5 F4:.5 D4:2 | C4:1 D4:.5 E4:.5 F4:1 G4:1 | A4:3 r:1 |
           Bb4:2 A4:1 G4:.5 F4:.5 | G4:1.5 F4:.5 E4:1 C4:1 | D4:1 E4:.5 F4:.5 E4:1 D4:.5 C#4:.5 | D4:4`;
const B = `F5:2 D5:1 C5:1 | C5:2 A4:1 F4:1 | G4:1 A4:1 C5:1 E5:1 | D5:4 | Bb4:1.5 A4:.5 G4:2 | A4:1.5 G4:.5 F4:2 | Bb4:1 G4:1 Eb5:2 | C#5:2 E5:2`;

// --- the low strings' ostinato: eighths in 3+3+2, accents on the groups; the root and its octave and fifth
function ostinato(from: number, to: number, octave: number, acc = true, lo = 28): LNote[] {
  const out: LNote[] = [];
  for (const [b, o, d, c] of span(from, to)) {
    let r = pc(`${ROOT[c]}${octave}`); if (r < lo) r += 12; const fifth = r + 7, pat = [r, r, r + 12, r, r, fifth, r, r + 12];
    for (let k = 0; k < d * 2; k++) { const i = (o * 2 + k) % 8; out.push({ b: bar(b) + o + k / 2, d: 0.5, p: pat[i], acc: acc && (i === 0 || i === 3 || i === 6) ? '>' : undefined }); }
  }
  return out;
}
/** the drums: a taiko figure per bar ('X' strong, 'x' light, '.' rest, in eighths) */
function drums(from: number, to: number, fig: string, key: number): LNote[] {
  const out: LNote[] = []; const f = fig.replace(/\s/g, '');
  for (let b = from; b <= to; b++) for (let i = 0; i < f.length; i++) if (f[i] !== '.') out.push({ b: bar(b) + i / 2, d: 0.5, p: key, acc: f[i] === 'X' ? '>' : undefined });
  return out;
}
const hits = (list: [number, number][], key: number, acc = true): LNote[] => list.map(([b, o]) => ({ b: bar(b) + o, d: 1, p: key, acc: acc ? '>' : undefined }));

const parts: Part[] = [
  // ---------------------------------------------------------------- night (1-6)
  { id: 'cb_pedal', inst: 'cb', art: 'sus', notes: [...voiced(1, 6, CB)], dyn: [[0, 0.22], [bar(2), 0.38], [bar(4), 0.45], [bar(6), 0.52], [bar(7), 0.4]], lead: 0.4 },
  { id: 'vc_fifth', inst: 'vc', art: 'sus', notes: voiced(1, 6, VC), dyn: [[0, 0.15], [bar(2), 0.32], [bar(5), 0.45], [bar(7), 0.35]], lead: 0.5 },
  { id: 'choir_night', inst: 'choir', art: 'sus', notes: chords([[bar(3), 8, 'D3 A3 D4'], [bar(5), 8, 'D3 A3 D4 F4']]), dyn: [[bar(3), 0.0], [bar(4), 0.22], [bar(5), 0.28], [bar(6) + 2, 0.36], [bar(7), 0.2]], lead: 1 },
  { id: 'vn_shimmer', inst: 'vn1', art: 'trem', notes: chords([[bar(4), 12, 'A5 D6']]), dyn: [[bar(4), 0.0], [bar(5), 0.12], [bar(6) + 3, 0.2], [bar(7), 0.05]], gain: -6 },
  { id: 'flute_call', inst: 'afl', art: 'leg', notes: line('D5:1.5 A4:.5 G4:1 F4:.5 E4:.5 | F4:2.5 E4:.5 D4:1', bar(3)).concat(line('D5:1 C5:.5 A4:.5 | G4:3', bar(5) + 1)),
    dyn: [[bar(3), 0.25], [bar(3) + 2, 0.5], [bar(4) + 3, 0.3], [bar(5) + 1, 0.4], [bar(6) + 1, 0.5], [bar(6) + 4, 0.15]], depth: 0.75, pan: -0.35 },
  { id: 'kit_night', inst: 'kit', art: 'hit', notes: [{ b: 0, d: 4, p: KIT.rumble }, { b: bar(1) + 0.02, d: 4, p: KIT.gong }, { b: bar(6), d: 2, p: KIT.bigDrum }, { b: bar(7) - KIT_LEAD(KIT.swellMid), d: 4, p: KIT.swellMid }], dyn: [], gain: -4 },

  // ---------------------------------------------------------------- theme (7-14): the solo cello
  { id: 'cello_A', inst: 'vcSolo', art: 'leg', vib: 0.6, notes: line(A, bar(7)),
    dyn: [[bar(7), 0.45], [bar(8) + 2, 0.5], [bar(9), 0.42], [bar(10), 0.62], [bar(10) + 3, 0.4], [bar(11), 0.55], [bar(12), 0.62], [bar(13) + 2, 0.5], [bar(14), 0.48], [bar(14) + 3.5, 0.25]] },
  { id: 'cb_A', inst: 'cb', art: 'sus', notes: voiced(7, 14, CB), dyn: [[bar(7), 0.3], [bar(10), 0.4], [bar(11), 0.36], [bar(14), 0.42]] },
  { id: 'vc_A', inst: 'vc', art: 'sus', notes: voiced(7, 14, VC), dyn: [[bar(7), 0.25], [bar(10), 0.38], [bar(11), 0.32], [bar(13), 0.4], [bar(14), 0.45]] },
  { id: 'va_A', inst: 'va', art: 'sus', notes: voiced(9, 14, VA), dyn: [[bar(9), 0.1], [bar(10), 0.3], [bar(13), 0.35], [bar(14), 0.4]], lead: 0.3 },
  { id: 'vn_halo', inst: 'vn1', art: 'sus', notes: chords([[bar(11), 4, 'D5 F5'], [bar(12), 2, 'D5 G5'], [bar(12) + 2, 2, 'E5 G5'], [bar(13), 2, 'D5 G5'], [bar(13) + 2, 2, 'C#5 E5'], [bar(14), 4, 'D5 F5']]),
    dyn: [[bar(11), 0.05], [bar(12), 0.22], [bar(13) + 2, 0.3], [bar(14) + 2, 0.4]], lead: 0.3, gain: -2 },
  { id: 'harp_A', inst: 'harp', art: 'hit', notes: span(7, 14).flatMap(([b, o, d, c]) => {
      const t = VC[c].split(' ').map(pc).concat(VA[c].split(' ').map(pc)).sort((x, y) => x - y), u = [t[0], t[1], t[2] + 12, t[3] + 12];
      return Array.from({ length: d * 2 }, (_, k) => ({ b: bar(b) + o + k / 2, d: 1.5, p: u[k % 4] ?? t[0] + 24 })); }), dyn: [] , gain: -9 },
  { id: 'frame_A', inst: 'kit', art: 'hit', notes: [...drums(11, 13, 'X . . x . . x .', KIT.doum), ...drums(11, 13, '. . x . . x . x', KIT.tak)], dyn: [], gain: 4, depth: 0.5 },

  // ---------------------------------------------------------------- build (15-18)
  { id: 'vc_ost', inst: 'vc', art: 'mar', notes: ostinato(15, 18, 2), dyn: [[bar(15), 0.35], [bar(18) + 3.5, 0.85]] },
  { id: 'cb_ost', inst: 'cb', art: 'stac', notes: ostinato(15, 18, 1).filter(n => n.acc), dyn: [[bar(15), 0.4], [bar(18) + 3.5, 0.9]] },
  { id: 'hn_build', inst: 'hn', art: 'sus', notes: voiced(15, 18, HN), dyn: [[bar(15), 0.15], [bar(16), 0.3], [bar(17), 0.45], [bar(18), 0.6], [bar(18) + 3.8, 0.85]], lead: 0.25 },
  { id: 'tbn_build', inst: 'tbn', art: 'sus', notes: chords(span(17, 18).map(([b, o, d, c]) => [bar(b) + o, d, VC[c]] as [number, number, string]), 12).filter(n => n.p <= 72 && n.p >= 40), dyn: [[bar(17), 0.2], [bar(18) + 3.8, 0.8]], lead: 0.2 },
  { id: 'vn_trem_build', inst: 'vn1', art: 'trem', notes: chords([[bar(15), 4, 'D5'], [bar(16), 4, 'D5'], [bar(17), 4, 'D5'], [bar(18), 4, 'E5']]), dyn: [[bar(15), 0.1], [bar(18) + 3.8, 0.7]] },
  { id: 'vn2_trem_build', inst: 'vn2', art: 'trem', notes: chords([[bar(15), 4, 'A4'], [bar(16), 4, 'Bb4'], [bar(17), 4, 'Bb4'], [bar(18), 4, 'C#5']]), dyn: [[bar(15), 0.1], [bar(18) + 3.8, 0.65]] },
  { id: 'taiko_build', inst: 'taiko', art: 'hit', notes: [...drums(15, 16, 'X . . . . . x .', 36), ...drums(17, 17, 'X . . x . . x .', 36), ...drums(18, 18, 'X . x x . x X x', 36)], dyn: [] },
  { id: 'drum_build', inst: 'kit', art: 'hit', notes: [...drums(15, 17, 'X . . . . . . .', KIT.bigDrum), ...drums(18, 18, 'X . . . X . . .', KIT.bigDrum), ...drums(17, 18, '. x . x x . x x', KIT.ruffTap),
      { b: bar(19) - KIT_LEAD(KIT.swellMid), d: 4, p: KIT.swellMid }], dyn: [], gain: -2 },
  { id: 'timp_build', inst: 'timp', art: 'hit', notes: [...hits([[15, 0], [16, 0], [17, 0], [18, 0], [18, 2], [18, 3], [18, 3.5]], pc('D2'))], dyn: [] },

  // ---------------------------------------------------------------- tutti (19-26)
  { id: 'hn_A', inst: 'hn', art: 'leg', notes: line(A, bar(19)), dyn: [[bar(19), 0.75], [bar(22), 0.85], [bar(23), 0.8], [bar(26), 0.9], [bar(26) + 3.5, 0.7]] },
  { id: 'vc_A2', inst: 'vc', art: 'leg', notes: line(A, bar(19)), dyn: [[bar(19), 0.8], [bar(22), 0.88], [bar(26), 0.9]] },
  { id: 'vn1_A2', inst: 'vn1', art: 'leg', notes: line(A, bar(19), 12), dyn: [[bar(19), 0.7], [bar(22), 0.85], [bar(26), 0.92]] },
  { id: 'tpt_A2', inst: 'tpt', art: 'leg', notes: line(A, bar(19), 12).filter(n => n.b >= bar(23)), dyn: [[bar(23), 0.55], [bar(25), 0.75], [bar(26), 0.85]] },
  { id: 'vn2_ost', inst: 'vn2', art: 'stac', notes: span(19, 26).flatMap(([b, o, d, c]) => { const t = VA[c].split(' ').map(x => pc(x) + 12); return Array.from({ length: d * 2 }, (_, k) => ({ b: bar(b) + o + k / 2, d: 0.5, p: t[k % 2], acc: k % 3 === 0 ? '>' as const : undefined })); }), dyn: [[bar(19), 0.6], [bar(26), 0.8]] },
  { id: 'va_ost', inst: 'va', art: 'stac', notes: span(19, 26).flatMap(([b, o, d, c]) => { const t = VA[c].split(' ').map(pc); return Array.from({ length: d * 2 }, (_, k) => ({ b: bar(b) + o + k / 2, d: 0.5, p: t[(k + 1) % 2], acc: k % 3 === 0 ? '>' as const : undefined })); }), dyn: [[bar(19), 0.6], [bar(26), 0.8]] },
  { id: 'cb_A2', inst: 'cb', art: 'mar', notes: ostinato(19, 26, 1), dyn: [[bar(19), 0.75], [bar(26), 0.9]] },
  { id: 'tbn_A2', inst: 'tbn', art: 'sus', notes: voiced(19, 26, HN).filter(n => n.p >= 40 && n.p <= 62), dyn: [[bar(19), 0.55], [bar(22), 0.6], [bar(26), 0.8]] },
  { id: 'tuba_A2', inst: 'tuba', art: 'sus', notes: voiced(19, 26, CB).map(n => ({ ...n, p: n.p < 30 ? n.p + 12 : n.p })), dyn: [[bar(19), 0.6], [bar(26), 0.8]] },
  { id: 'choir_A2', inst: 'choir', art: 'sus', notes: voiced(19, 26, CHOIR), dyn: [[bar(19), 0.55], [bar(22), 0.7], [bar(23), 0.6], [bar(26), 0.85]], lead: 0.3 },
  { id: 'taiko_A2', inst: 'taiko', art: 'hit', notes: drums(19, 26, 'X . . x . . x .', 36), dyn: [] },
  { id: 'drum_A2', inst: 'kit', art: 'hit', notes: [...drums(19, 26, 'X . . . X . . .', KIT.bigDrum), ...drums(19, 26, '. . x . . x . x', KIT.ruffTap), ...drums(19, 26, '. x . . . . x .', KIT.doum),
      { b: bar(27) - KIT_LEAD(KIT.swellShort), d: 2, p: KIT.swellShort }], dyn: [], gain: -3 },
  { id: 'timp_A2', inst: 'timp', art: 'hit', notes: span(19, 26).map(([b, o, , c]) => ({ b: bar(b) + o, d: 1, p: pc(`${ROOT[c]}2`) < 36 ? pc(`${ROOT[c]}3`) : pc(`${ROOT[c]}2`), acc: o === 0 ? '>' as const : undefined })).filter(n => n.p <= 57), dyn: [] },

  // ---------------------------------------------------------------- rise (27-34): B
  { id: 'vn1_B', inst: 'vn1', art: 'leg', notes: line(B, bar(27)), dyn: [[bar(27), 0.75], [bar(30), 0.85], [bar(31), 0.75], [bar(33), 0.98], [bar(34) + 3.8, 1]] },
  { id: 'vn2_B', inst: 'vn2', art: 'leg', notes: line(B, bar(27), -12).filter(n => n.p >= 55), dyn: [[bar(27), 0.7], [bar(33), 0.95], [bar(34) + 3.8, 1]] },
  { id: 'hn_B', inst: 'hn', art: 'leg', notes: line(B, bar(27), -12), dyn: [[bar(27), 0.75], [bar(30), 0.85], [bar(31), 0.78], [bar(33), 1], [bar(34) + 3.8, 1]] },
  { id: 'tpt_B', inst: 'tpt', art: 'sus', notes: chords([[bar(33), 4, 'G4 Bb4 Eb5'], [bar(34), 4, 'A4 C#5 E5']]), dyn: [[bar(33), 0.5], [bar(34) + 3.8, 0.95]] },
  { id: 'va_B', inst: 'va', art: 'stac', notes: span(27, 34).flatMap(([b, o, d, c]) => { const t = VA[c].split(' ').map(pc); return Array.from({ length: d * 2 }, (_, k) => ({ b: bar(b) + o + k / 2, d: 0.5, p: t[k % 2], acc: k % 3 === 0 ? '>' as const : undefined })); }), dyn: [[bar(27), 0.65], [bar(34), 0.9]] },
  { id: 'vc_B', inst: 'vc', art: 'mar', notes: ostinato(27, 34, 2), dyn: [[bar(27), 0.75], [bar(34), 0.95]] },
  { id: 'cb_B', inst: 'cb', art: 'sus', notes: voiced(27, 34, CB), dyn: [[bar(27), 0.7], [bar(34), 0.95]] },
  { id: 'tbn_B', inst: 'tbn', art: 'sus', notes: voiced(27, 34, HN).filter(n => n.p >= 40 && n.p <= 62), dyn: [[bar(27), 0.6], [bar(32), 0.7], [bar(33), 0.95], [bar(34) + 3.8, 1]] },
  { id: 'tuba_B', inst: 'tuba', art: 'sus', notes: voiced(27, 34, CB).map(n => ({ ...n, p: n.p < 30 ? n.p + 12 : n.p })), dyn: [[bar(27), 0.65], [bar(34), 0.95]] },
  { id: 'choir_B', inst: 'choir', art: 'sus', notes: voiced(27, 34, CHOIR), dyn: [[bar(27), 0.65], [bar(31), 0.7], [bar(33), 1], [bar(34) + 3.8, 1]] },
  { id: 'taiko_B', inst: 'taiko', art: 'hit', notes: [...drums(27, 32, 'X . . x . . x .', 36), ...drums(33, 34, 'X . x x X . x x', 36)], dyn: [] },
  { id: 'drum_B', inst: 'kit', art: 'hit', notes: [...drums(27, 34, 'X . . . X . . .', KIT.bigDrum), ...drums(27, 34, '. x x . . x . x', KIT.ruffTap), { b: bar(33), d: 4, p: KIT.gong },
      { b: bar(35) - KIT_LEAD(KIT.swellMid) - 0.3, d: 4, p: KIT.swellMid }], dyn: [], gain: -3 },
  { id: 'cym_B', inst: 'cym', art: 'hit', notes: [{ b: bar(27), d: 2, p: pc('G3') }, { b: bar(33), d: 2, p: pc('G3') }], dyn: [] },
  { id: 'timp_B', inst: 'timp', art: 'hit', notes: [...span(27, 34).map(([b, , , c]) => ({ b: bar(b), d: 1, p: Math.min(57, pc(`${ROOT[c]}2`) < 36 ? pc(`${ROOT[c]}3`) : pc(`${ROOT[c]}2`)), acc: '>' as const })),
      ...[0, 0.5, 1, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75].map(o => ({ b: bar(34) + o, d: 0.25, p: pc('A2') }))], dyn: [] },

  // ---------------------------------------------------------------- the title (35) and the coda (36-38)
  { id: 'tutti_D', inst: 'hn', art: 'sus', notes: chords([[bar(35), 4, 'D3 A3 D4 F4']]), dyn: [[bar(35), 1], [bar(35) + 3, 0.6], [bar(36), 0.3]] },
  { id: 'tbn_D', inst: 'tbn', art: 'sus', notes: chords([[bar(35), 4, 'D3 A3']]), dyn: [[bar(35), 1], [bar(36), 0.35]] },
  { id: 'tuba_D', inst: 'tuba', art: 'sus', notes: chords([[bar(35), 4, 'D2']]), dyn: [[bar(35), 1], [bar(36), 0.4]] },
  { id: 'vn1_D', inst: 'vn1', art: 'sus', notes: chords([[bar(35), 4, 'D5 A5'], [bar(36), 4, 'D5 F5'], [bar(37), 2, 'D5 G5'], [bar(37) + 2, 2, 'C#5 E5'], [bar(38), 7, 'A4 D5']]),
    dyn: [[bar(35), 0.95], [bar(36), 0.45], [bar(37), 0.35], [bar(38), 0.3], [bar(39) + 2, 0.02]] },
  { id: 'vn2_D', inst: 'vn2', art: 'sus', notes: chords([[bar(35), 4, 'F4 A4'], [bar(36), 4, 'F4 Bb4'], [bar(37), 2, 'G4 Bb4'], [bar(37) + 2, 2, 'A4 C#5'], [bar(38), 7, 'A4']]),
    dyn: [[bar(35), 0.9], [bar(36), 0.4], [bar(37), 0.32], [bar(38), 0.28], [bar(39) + 2, 0.02]] },
  { id: 'va_D', inst: 'va', art: 'sus', notes: voiced(35, 38, VA), dyn: [[bar(35), 0.9], [bar(36), 0.38], [bar(38), 0.28], [bar(39) + 2, 0.02]] },
  { id: 'vc_D', inst: 'vc', art: 'sus', notes: voiced(35, 38, VC), dyn: [[bar(35), 0.95], [bar(36), 0.4], [bar(38), 0.3], [bar(39) + 2, 0.02]] },
  { id: 'cb_D', inst: 'cb', art: 'sus', notes: voiced(35, 38, CB), dyn: [[bar(35), 0.95], [bar(36), 0.4], [bar(38), 0.32], [bar(39) + 2, 0.02]] },
  { id: 'choir_D', inst: 'choir', art: 'sus', notes: chords([[bar(35), 4, 'D3 A3 D4 F4 A4'], [bar(36), 4, 'D4 F4'], [bar(38), 7, 'D3 A3 D4']]), dyn: [[bar(35), 1], [bar(35) + 3, 0.5], [bar(36), 0.25], [bar(38), 0.3], [bar(39) + 2, 0.0]] },
  { id: 'drum_D', inst: 'kit', art: 'hit', notes: [{ b: bar(35), d: 4, p: KIT.bigDrum, acc: '>' }, { b: bar(35), d: 4, p: KIT.gong, acc: '>' }, { b: bar(38), d: 4, p: KIT.rumble }], dyn: [] },
  { id: 'taiko_D', inst: 'taiko', art: 'hit', notes: [{ b: bar(35), d: 2, p: 36, acc: '>' }, { b: bar(38), d: 2, p: 33 }], dyn: [] },
  { id: 'timp_D', inst: 'timp', art: 'hit', notes: [{ b: bar(35), d: 2, p: pc('D2'), acc: '>' }], dyn: [] },
  { id: 'cym_D', inst: 'cym', art: 'hit', notes: [{ b: bar(35), d: 2, p: pc('G3') }], dyn: [] },
  { id: 'horn_coda', inst: 'hnSolo', art: 'leg', notes: line('r:2 D5:1 C5:1 | A4:1 G4:.5 F4:.5 E4:1 F4:.5 E4:.5 | D4:3.5', bar(36)),
    dyn: [[bar(36) + 2, 0.4], [bar(37), 0.5], [bar(37) + 3, 0.4], [bar(38), 0.35], [bar(39) + 1, 0.05]] },
];

function KIT_LEAD(key: number) { return ({ 48: 6.0, 49: 3.5, 50: 1.8 } as Record<number, number>)[key] * (70 / 60); } // a swell's run-up in beats (~at 70 BPM)

const marks: Record<string, number> = {};
for (const [k, b] of Object.entries({ night: 1, call: 3, theme: 7, heartbeat: 11, build: 15, tutti: 19, trumpets: 23, rise: 27, summit: 33, title: 35, coda: 36, last: 38 })) marks[k] = +tempo.s(bar(b)).toFixed(3);
marks.end = +tempo.s(bar(39) + 3).toFixed(3);
for (let b = 1; b <= 39; b++) marks[`bar${b}`] = +tempo.s(bar(b)).toFixed(3); // the film's cuts land on bars

const cue: Cue = { id: 'main_theme', title: 'Pārsa (main theme)', tags: ['main', 'film'], tempo, parts, seconds: tempo.s(bar(39) + 3), marks, lufs: -16 };
export default cue;
