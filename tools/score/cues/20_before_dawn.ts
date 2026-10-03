// "Before Dawn" (night): B minor, 50 BPM, about 3:00. The coldest hour: the basses' B, the
// celli's slow figure, the alto flute far off, the choir breathing in, and the faintest lift toward the light at the end.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, swell } from '../lib/kit';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 48], [B(5), 50], [B(33), 46]]);
const H = [...prog('Bm:8 G:8 Bm:8 A:4 G:4 | Bm:8 G:8 A:8 Em:4 Bm:4 | Em:8 G:8 A:8 Bm:8 | G:8 Em:8 D:8 Bm:8 | Bm:16', B(1))];
const parts: Part[] = [
  { id: 'cb', inst: 'cb', art: 'sus', notes: [{ b: 0, d: B(37), p: 35 }], lead: 1, dyn: [[0, 0.0], [B(3), 0.3], [B(33), 0.25], [B(37), 0.0]] },
  { id: 'vc', inst: 'vc', art: 'leg', notes: line('B2:4 | D3:4 | C#3:2 A2:2 | B2:2 D3:2 | D3:4 | B2:4 | B2:4 | G2:4 | A2:4 | C#3:4 | E3:4 | B2:4 | E3:4 | G3:4 | D3:4 | B2:4', B(5)), dyn: [[B(5), 0.3], ...swell(B(5), B(13), 0.3, 0.48, 0.35), ...swell(B(13), B(17), 0.35, 0.45, 0.3)] },
  { id: 'va', inst: 'va', art: 'sus', notes: pad(H, 'D3', 'B4', 2), lead: 0.8, dyn: [[0, 0.0], [B(5), 0.18], [B(17), 0.28], [B(25), 0.35], [B(33), 0.2], [B(37), 0.0]] },
  { id: 'choir', inst: 'choir', art: 'sus', notes: pad(H.filter(c => c.b >= B(17)), 'B2', 'F#4', 3), lead: 1, dyn: [[B(17), 0.0], [B(21), 0.25], [B(25), 0.38], [B(29), 0.45], [B(33), 0.25], [B(37), 0.0]] },
  { id: 'flute', inst: 'afl', art: 'leg', notes: [...line('F#4:2 G4:1 F#4:1 | E4:2 D4:2 | B3:4?'.replace(' | B3:4?', ' | D4:4'), B(9)), ...line('G4:2 B4:1 A4:1 | G4:2 D4:1 E4:1 | E4:4 | r:4 | D5:2 C#5:1 B4:1 | A4:2 F#4:2 | B4:8', B(19))],
    dyn: [[B(9), 0.3], [B(11), 0.4], [B(12), 0.2], [B(19), 0.32], ...swell(B(19), B(27), 0.32, 0.5, 0.3)], depth: 0.7, pan: -0.35 },
  { id: 'vn', inst: 'vn1', art: 'sus', notes: pad(H.filter(c => c.b >= B(29) && c.b < B(33)), 'D5', 'B5', 2), lead: 1, dyn: [[B(29), 0.0], [B(31), 0.25], [B(33), 0.1], [B(34), 0.0]] },
];
const cue: Cue = { id: 'before_dawn', title: 'Before Dawn', tags: ['night'], tempo, parts, seconds: tempo.s(B(37)) + 2, lufs: -22, harmony: H };
export default cue;
