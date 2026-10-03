// "Stars over Rahmat" (night): the main theme's B half on the solo horn in E minor, 50 BPM, about 3:10, with the harp, the
// choir's hum and a single held note in the basses; the A theme's head on the alto flute before the end.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, arp, swell } from '../lib/kit';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 48], [B(5), 50], [B(29), 48], [B(37), 42]]);
const BT = 'G4:2 E4:1 D4:1 | D4:2 B3:1 G3:1 | A3:1 B3:1 D4:1 F#4:1 | E4:4 | C4:1.5 B3:.5 A3:2 | B3:1.5 A3:.5 G3:2 | C4:1 A3:1 F4:2 | D#4:4';
const BH = 'C:4 G:4 D:4 Em:4 Am:4 Em:4 F:4 B:4';
const H = [...prog('Em:16', B(1)), ...prog(BH, B(5)), ...prog('Em:8 C:8 Am:8 B:8', B(13)), ...prog(BH, B(21)), ...prog('Em:4 C:4 Am:4 B:4 Em:16', B(29))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const parts: Part[] = [
  { id: 'horn', inst: 'hnSolo', art: 'leg', notes: [...line(BT, B(5)), ...line(BT, B(21))],
    dyn: [[B(5), 0.42], ...swell(B(5), B(13), 0.42, 0.6, 0.4), [B(21), 0.45], ...swell(B(21), B(29), 0.45, 0.62, 0.35)] },
  { id: 'choir', inst: 'choir', art: 'sus', notes: pad(H, 'B2', 'G4', 3), lead: 1, dyn: [[0, 0.0], [B(3), 0.2], [B(13), 0.3], [B(17), 0.35], [B(21), 0.25], [B(29), 0.2], [B(37), 0.0]] },
  { id: 'cb', inst: 'cb', art: 'sus', notes: [{ b: 0, d: B(37), p: 40 }], lead: 1, dyn: [[0, 0.0], [B(3), 0.25], [B(36), 0.2], [B(37), 0.0]] },
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp(H, 'E3', 'B5', [0, 2, 4, 6, 5, 3], 1, 4), dyn: [], gain: -9 },
  { id: 'va', inst: 'va', art: 'leg', notes: line('B3:4 | G4:4 | E4:4 | A4:4 | C4:4 | E4:4 | F#4:4 | D#4:4', B(13)), dyn: [[B(13), 0.3], ...swell(B(13), B(21), 0.3, 0.5, 0.25)] },
  { id: 'vn_harm', inst: 'vn1', art: 'harm', notes: pad(sec(13, 28), 'E5', 'E6', 1), dyn: [[B(13), 0.1], [B(21), 0.2], [B(29), 0.05]], gain: -8 },
  { id: 'flute', inst: 'afl', art: 'leg', notes: line('E4:2 B4:1 A4:.5 G4:.5 | F#4:1.5 G4:.5 E4:2 | r:4 | E4:4', B(33)), dyn: [[B(33), 0.35], [B(34), 0.42], [B(36), 0.2]], depth: 0.6, pan: -0.3 },
];
const cue: Cue = { id: 'stars_over_rahmat', title: 'Stars over Rahmat', tags: ['night'], tempo, parts, seconds: tempo.s(B(37)) + 2, lufs: -21, harmony: H };
export default cue;
