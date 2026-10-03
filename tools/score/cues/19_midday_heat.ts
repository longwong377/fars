// "Midday Heat" (day, in the town): A minor and still, 58 BPM, about 3:00. The heat of noon in the lanes: the flute's
// slow line over the harp and pizzicato, a held string chord shimmering, almost nothing moving.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, arp, swell } from '../lib/kit';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 58], [B(33), 54], [B(41), 48]]);
const M = 'E5:3 D5:1 | C5:2 A4:2 | A4:3 G4:1 | A4:4 | C5:3 B4:1 | A4:2 G4:2 | F4:2 D4:2 | E4:4';
const MH = 'Am:4 F:4 Am:4 Am:4 F:4 C:4 Dm:4 E:4';
const H = [...prog('Am:8', B(1)), ...prog(MH, B(3)), ...prog('F:8 C:8 Dm:8 E:8', B(11)), ...prog(MH, B(19)), ...prog('F:8 C:8 Dm:8 Am:8', B(27)), ...prog('Am:24', B(35))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const parts: Part[] = [
  { id: 'shimmer', inst: 'vn1', art: 'trem', notes: pad(H, 'E5', 'C6', 2), dyn: [[0, 0.04], [B(3), 0.1], [B(19), 0.14], [B(35), 0.06], [B(41), 0.0]], gain: -10 },
  { id: 'va', inst: 'va', art: 'sus', notes: pad(H, 'C3', 'A4', 2), lead: 0.6, dyn: [[0, 0.05], [B(3), 0.22], [B(19), 0.28], [B(35), 0.15], [B(41), 0.0]] },
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp(H, 'A2', 'E5', [0, 4, 2, 5, 3, 6], 1, 3), dyn: [], gain: -9 },
  { id: 'pizz', inst: 'cb', art: 'pizz', notes: bass(sec(3, 34), 'C2', 'B2').map(n => ({ ...n, d: 1 })), dyn: [], gain: -6 },
  { id: 'fl', inst: 'afl', art: 'leg', notes: [...line(M, B(3)), ...line(M, B(19))], dyn: [[B(3), 0.4], ...swell(B(3), B(11), 0.4, 0.52, 0.38), [B(19), 0.38], ...swell(B(19), B(27), 0.38, 0.5, 0.3)], depth: 0.35 },
  { id: 'cl', inst: 'cl', art: 'leg', notes: line('A4:8 | G4:8 | F4:8 | G#4:8', B(11)), dyn: [[B(11), 0.3], ...swell(B(11), B(19), 0.3, 0.45, 0.25)] },
  { id: 'ob', inst: 'ob', art: 'leg', notes: line('C5:8 | E5:8 | F5:4 D5:4 | C5:8', B(27)), dyn: [[B(27), 0.3], ...swell(B(27), B(35), 0.3, 0.45, 0.2)] },
];
const cue: Cue = { id: 'midday_heat', title: 'Midday Heat', tags: ['day', 'town'], tempo, parts, seconds: tempo.s(B(41)) + 2, lufs: -21, harmony: H };
export default cue;
