// "After the Rain" (rain, as it clears): F major, 70 BPM, about 2:40. Wet stone and clearing sky: the strings in warm
// thirds, the clarinet and flute passing a simple song, the harp's drops still falling, everything brightening.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, arp, swell } from '../lib/kit';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 68], [B(3), 70], [B(37), 64]]);
const S = 'A4:1.5 G4:.5 F4:1 C5:1 | Bb4:2 A4:2 | G4:1 A4:1 Bb4:1 D5:1 | C5:4 | D5:1.5 C5:.5 Bb4:1 A4:1 | G4:2 F4:1 G4:1 | A4:1 Bb4:1 G4:1 E4:1 | F4:4';
const SH = 'F:4 Bb:2 F:2 Gm:4 C:4 Bb:4 Gm:2 C:2 C:2 Bb:2 F:4';
const H = [...prog('F:4 Bb:4', B(1)), ...prog(SH, B(3)), ...prog(SH, B(11)), ...prog('Dm:4 Bb:4 F:4 C:4 Dm:4 Gm:4 Bb:4 C:4', B(19)), ...prog(SH, B(27)), ...prog('Bb:4 C:4 F:8', B(35))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const parts: Part[] = [
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp(H, 'F3', 'C6', [4, 2, 5, 3, 6, 1], 0.5, 1.2).filter((_, i) => i % 2 === 0), dyn: [], gain: -9 },
  { id: 'cl', inst: 'cl', art: 'leg', notes: line(S, B(3)), dyn: [[B(3), 0.42], ...swell(B(3), B(11), 0.42, 0.56, 0.4)] },
  { id: 'fl', inst: 'fl', art: 'leg', notes: [...line(S, B(11)), ...line(S, B(27), 12)].filter(n => n.p <= 96), dyn: [[B(11), 0.42], ...swell(B(11), B(19), 0.42, 0.56, 0.4), [B(27), 0.35], ...swell(B(27), B(35), 0.35, 0.5, 0.3)], gain: -1 },
  { id: 'vn1', inst: 'vn1', art: 'leg', notes: [...line('F5:4 | D5:4 | C5:4 | E5:4 | F5:4 | D5:2 Bb4:2 | D5:4 | E5:4', B(19)), ...line(S, B(27))], dyn: [[B(19), 0.45], ...swell(B(19), B(27), 0.45, 0.62, 0.5), ...swell(B(27), B(35), 0.5, 0.65, 0.35)] },
  { id: 'vn2', inst: 'vn2', art: 'sus', notes: pad(sec(11, 38), 'C4', 'A4', 2), lead: 0.3, dyn: [[B(11), 0.2], [B(19), 0.38], [B(27), 0.42], [B(35), 0.3], [B(38), 0.0]] },
  { id: 'va', inst: 'va', art: 'sus', notes: pad(H, 'C3', 'F4', 2), lead: 0.4, dyn: [[0, 0.1], [B(3), 0.25], [B(19), 0.4], [B(35), 0.3], [B(38), 0.0]] },
  { id: 'vc', inst: 'vc', art: 'sus', notes: bass(H, 'C2', 'B2').map(n => ({ ...n, p: n.p + 12 })), lead: 0.4, dyn: [[0, 0.1], [B(3), 0.3], [B(19), 0.42], [B(35), 0.3], [B(38), 0.0]] },
];
const cue: Cue = { id: 'after_the_rain', title: 'After the Rain', tags: ['rain'], tempo, parts, seconds: tempo.s(B(38)) + 2, lufs: -20, harmony: H };
export default cue;
