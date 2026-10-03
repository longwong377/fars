// "Theme Remembered" (any hour): the main theme in E minor for the solo violin over the strings, 60 BPM, about 3:00; the
// B theme on the celli with the violin above it, the C major (the Phrygian II's place) its high point, and the violin
// alone with the theme's head at the end.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, arp, swell } from '../lib/kit';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 58], [B(3), 60], [B(27), 62], [B(33), 56], [B(39), 48]]);
const A = 'E4:2 B4:1 A4:.5 G4:.5 | F#4:1.5 G4:.5 E4:2 | D4:1 E4:.5 F#4:.5 G4:1 A4:1 | B4:3 r:1 | C5:2 B4:1 A4:.5 G4:.5 | A4:1.5 G4:.5 F#4:1 D4:1 | E4:1 F#4:.5 G4:.5 F#4:1 E4:.5 D#4:.5 | E4:4';
const AH = 'Em:4 D:2 Em:2 G:4 G:2 D:2 C:4 Am:2 D:2 Am:2 B:2 Em:4';
const BT = 'G5:2 E5:1 D5:1 | D5:2 B4:1 G4:1 | A4:1 B4:1 D5:1 F#5:1 | E5:4 | C5:1.5 B4:.5 A4:2 | B4:1.5 A4:.5 G4:2 | C5:1 A4:1 F5:2 | D#5:2 F#5:2';
const BH = 'C:4 G:4 D:4 Em:4 Am:4 Em:4 F:4 B:4';
const H = [...prog('Em:8', B(1)), ...prog(AH, B(3)), ...prog(BH, B(11)), ...prog(AH, B(19)), ...prog(BH, B(27)), ...prog('Em:4 C:4 Am:2 B:2 Em:12', B(35))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const parts: Part[] = [
  { id: 'solo', inst: 'vnSolo', art: 'leg', notes: [...line(A, B(3)), ...line(BT, B(11)), ...line(A, B(19), 12), ...line('E5:2 B5:1 A5:.5 G5:.5 | F#5:1.5 G5:.5 E5:2 | r:4 | E5:4', B(35))],
    dyn: [[B(3), 0.45], ...swell(B(3), B(11), 0.45, 0.62, 0.48), ...swell(B(11), B(19), 0.5, 0.72, 0.5), ...swell(B(19), B(27), 0.52, 0.7, 0.45), [B(35), 0.4], [B(39), 0.3]] },
  { id: 'va', inst: 'va', art: 'sus', notes: pad(H, 'D3', 'B4', 2), lead: 0.5, dyn: [[0, 0.1], [B(3), 0.25], [B(11), 0.35], [B(27), 0.5], [B(33), 0.55], [B(35), 0.25], [B(40), 0.0]] },
  { id: 'vn2', inst: 'vn2', art: 'sus', notes: pad([...sec(11, 18), ...sec(27, 34)], 'E4', 'C5', 2), lead: 0.4, dyn: [[B(11), 0.2], [B(15), 0.35], [B(19), 0.0], [B(27), 0.4], [B(33), 0.55], [B(35), 0.0]] },
  { id: 'cb', inst: 'cb', art: 'sus', notes: bass(H, 'C2', 'B2'), lead: 0.5, dyn: [[0, 0.1], [B(3), 0.28], [B(27), 0.45], [B(35), 0.25], [B(40), 0.0]] },
  { id: 'vc_B', inst: 'vc', art: 'leg', notes: line(BT, B(27), -12), dyn: [[B(27), 0.5], ...swell(B(27), B(35), 0.5, 0.75, 0.4)] },
  { id: 'vn1_B', inst: 'vn1', art: 'leg', notes: line(BT, B(27)), dyn: [[B(27), 0.5], ...swell(B(27), B(35), 0.5, 0.78, 0.35)] },
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp(sec(19, 26), 'E2', 'B4', [0, 2, 4, 5], 1, 3), dyn: [], gain: -9 },
  { id: 'hn', inst: 'hn', art: 'sus', notes: pad(sec(31, 34), 'G2', 'D4', 3), dyn: [[B(31), 0.2], [B(33), 0.5], [B(35), 0.0]], lead: 0.3 },
];
const cue: Cue = { id: 'theme_remembered', title: 'Theme Remembered', tags: [], tempo, parts, seconds: tempo.s(B(40)) + 2, lufs: -20, harmony: H };
export default cue;
