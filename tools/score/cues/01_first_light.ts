// "First Light" (dawn): D Dorian (the theme's minor brightened by the raised sixth), 58 BPM, about 3:30. The alto flute's own
// melody over the choir's held breath, the solo horn answering with the theme's head in its Dorian form, the strings warming
// as the light comes, the ending on D major as the sun clears the mountain. (The alto flute's line is this cue's own tune.)
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, arp, at, swell } from '../lib/kit';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 56], [B(9), 58], [B(25), 60], [B(31), 58], [B(41), 56], [B(49), 50]]);

// the harmony: the night's D minor, the Dorian G major opening the door, the C and the A minor between
const intro = prog('Dm:8 G/D:8 Dm:8 C:4 Am:4', B(1));
const fluteH = prog('Dm:4 G:4 C:4 Dm:4 Dm:4 Am:4 C:2 G:2 Dm:4', B(9));
const hornH = prog('Dm:4 C:2 Dm:2 F:4 F:2 C:2 G:4 Am:4 C:4 Dm:4', B(17));
const strings = prog('Dm:4 G:4 C:4 Am:4 F:4 C:4 G:4 G:4', B(25));
const quiet = prog('Dm:8 G/D:8 F:8 C:4 Am:4', B(33));
const dawn = prog('Dm:4 G:4 C:4 Dm:4 F:4 C:4 Gsus4:4 G:2 A:2', B(41));
const sun = prog('D:8 D:8', B(49));
const all = [...intro, ...fluteH, ...hornH, ...strings, ...quiet, ...dawn, ...sun];

// the first-light melody (the alto flute's), and the theme's head in Dorian (the horn's)
const NEY = 'D5:2 C5:1 A4:1 | B4:3 A4:1 | G4:1.5 A4:.5 B4:1 C5:1 | A4:4 | D5:2 E5:1 F5:1 | E5:3 D5:1 | C5:1 B4:1 A4:1 G4:1 | A4:4';
const THEME_DORIAN = 'D4:2 A4:1 G4:.5 F4:.5 | E4:1.5 F4:.5 D4:2 | C4:1 D4:.5 E4:.5 F4:1 G4:1 | A4:3 r:1 | B4:2 A4:1 G4:.5 F#4:.5 | G4:1.5 A4:.5 B4:1 C5:1 | A4:2 G4:1 E4:1 | D4:4';

const parts: Part[] = [
  // the held breath: choir and low strings through the whole, swelling with each section
  { id: 'choir', inst: 'choir', art: 'sus', notes: pad(all, 'D3', 'A4', 4, 'F3'), lead: 0.8,
    dyn: [[0, 0.0], [B(3), 0.22], [B(8), 0.18], [B(9), 0.14], [B(17), 0.2], [B(25), 0.32], [B(29), 0.45], [B(33), 0.2], [B(41), 0.28], [B(47), 0.4], [B(49), 0.45], [B(52), 0.0]] },
  { id: 'va', inst: 'va', art: 'sus', notes: pad(all, 'D3', 'D5', 2, 'A3'), lead: 0.4,
    dyn: [[0, 0.05], [B(4), 0.25], [B(9), 0.2], [B(25), 0.45], [B(29), 0.58], [B(33), 0.25], [B(41), 0.35], [B(49), 0.45], [B(52), 0.02]] },
  { id: 'vc', inst: 'vc', art: 'sus', notes: bass(all, 'D2', 'D3'), lead: 0.4,
    dyn: [[0, 0.1], [B(4), 0.3], [B(25), 0.5], [B(29), 0.6], [B(33), 0.3], [B(49), 0.45], [B(52), 0.02]] },
  { id: 'cb', inst: 'cb', art: 'sus', notes: bass([...strings, ...dawn, ...sun], 'C2', 'B2'), lead: 0.4,
    dyn: [[B(25), 0.25], [B(29), 0.5], [B(33), 0.2], [B(41), 0.3], [B(49), 0.45], [B(52), 0.02]] },
  // the harp: single notes falling like the first light through the dark, then rippling as the day comes
  { id: 'harp_drops', inst: 'harp', art: 'hit', notes: arp(intro, 'D4', 'D6', [4, 2, 5, 3], 2, 3), dyn: [], gain: -6 },
  { id: 'harp_ripple', inst: 'harp', art: 'hit', notes: [...arp(strings, 'D3', 'A5', [0, 2, 4, 5, 4, 2], 0.5, 1.5), ...arp(dawn, 'D3', 'A5', [0, 2, 4, 5, 6, 5, 4, 2], 0.5, 1.5)], dyn: [], gain: -8 },
  // the alto flute: the first-light melody, and again at the end, an octave lower and slower
  { id: 'flute', inst: 'afl', art: 'leg', notes: line(NEY, B(9)), dyn: [[B(9), 0.35], ...swell(B(9), B(13), 0.35, 0.55, 0.38), ...swell(B(13), B(17), 0.42, 0.62, 0.3)], depth: 0.4, pan: -0.25 },
  { id: 'flute_end', inst: 'afl', art: 'leg', notes: line(NEY, B(41)), dyn: [[B(41), 0.3], ...swell(B(41), B(45), 0.3, 0.5, 0.35), ...swell(B(45), B(49), 0.38, 0.55, 0.3)], depth: 0.45, pan: -0.25 },
  // the solo horn: the theme's head, Dorian
  { id: 'horn', inst: 'hnSolo', art: 'leg', notes: line(THEME_DORIAN, B(17)), dyn: [[B(17), 0.42], ...swell(B(17), B(21), 0.42, 0.58, 0.4), ...swell(B(21), B(25), 0.45, 0.6, 0.35)] },
  // the strings warm: the violins sing the first-light melody, the celli answer beneath
  { id: 'vn1', inst: 'vn1', art: 'leg', notes: line(NEY, B(25)), dyn: [[B(25), 0.4], ...swell(B(25), B(29), 0.42, 0.62, 0.55), ...swell(B(29), B(33), 0.58, 0.72, 0.3)] },
  { id: 'vn2', inst: 'vn2', art: 'sus', notes: pad(strings, 'F4', 'D5', 2, 'A4'), dyn: [[B(25), 0.3], [B(29), 0.5], [B(32) + 3, 0.25]], lead: 0.3 },
  { id: 'vc_counter', inst: 'vc', art: 'leg', notes: line('A3:4 | B3:2 G3:2 | C4:3 B3:1 | A3:4 | F3:2 A3:2 | C4:2 E4:2 | D4:2 B3:2 | G3:4', B(25)),
    dyn: [[B(25), 0.38], [B(29), 0.55], [B(33), 0.3]], gain: -1 },
  { id: 'hn', inst: 'hn', art: 'sus', notes: pad([...strings.slice(4), ...sun], 'A2', 'D4', 3, 'F3'), dyn: [[B(29), 0.15], [B(31), 0.42], [B(33), 0.12], [B(49), 0.3], [B(50), 0.45], [B(52), 0.0]], lead: 0.4 },
  // quiet: the solo cello remembers the theme
  { id: 'vc_solo', inst: 'vcSolo', art: 'leg', notes: line('D4:2 A4:1 G4:.5 F4:.5 | E4:1.5 F4:.5 D4:2 | C4:1 D4:.5 E4:.5 F4:1 G4:1 | A4:3 r:1', B(33)),
    dyn: [[B(33), 0.35], ...swell(B(33), B(37), 0.35, 0.55, 0.32)] },
  { id: 'vn_halo', inst: 'vn1', art: 'harm', notes: pad(quiet, 'A5', 'A6', 1), dyn: [[B(33), 0.15], [B(37), 0.25], [B(41), 0.1]], gain: -6 },
  // the sun: D major, everyone, softly
  { id: 'vn_sun', inst: 'vn1', art: 'sus', notes: pad(sun, 'F#4', 'A5', 3, 'D5'), dyn: [[B(49), 0.2], [B(50) + 2, 0.5], [B(52), 0.25], [B(53), 0.0]], lead: 0.6 },
  { id: 'cym', inst: 'kit', art: 'hit', notes: [{ b: B(49) - 6.2, d: 4, p: 48 }], dyn: [], gain: -12 },
];

const cue: Cue = { id: 'first_light', title: 'First Light', tags: ['dawn', 'opening'], tempo, parts, seconds: tempo.s(B(53)) + 1, lufs: -19, harmony: all };
export default cue;
