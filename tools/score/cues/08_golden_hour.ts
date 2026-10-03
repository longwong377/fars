// "Golden Hour" (dusk, on the Terrace): the main theme augmented (twice as slow) in G minor, 56 BPM, about 3:30: the horns
// in the long light, the choir under them, the violins taking the second half, the B theme's E-flat summit softened into
// the evening, and the theme's head on the solo horn to close.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, arp, swell } from '../lib/kit';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 54], [B(5), 56], [B(37), 52], [B(45), 46]]);
// the theme in G minor at half speed (lengths doubled)
const A2 = 'G3:4 D4:2 C4:1 Bb3:1 | A3:3 Bb3:1 G3:4 | F3:2 G3:1 A3:1 Bb3:2 C4:2 | D4:6 r:2';
const A2b = 'Eb4:4 D4:2 C4:1 Bb3:1 | C4:3 Bb3:1 A3:2 F3:2 | G3:2 A3:1 Bb3:1 A3:2 G3:1 F#3:1 | G3:8';
const H = [...prog('Gm:8 Eb:8', B(1)), ...prog('Gm:8 F:4 Gm:4 Bb:8 Bb:4 F:4', B(5)), ...prog('Eb:4 Bb:4 Cm:4 F:4 Cm:4 D:4 Gm:8', B(13)),
  ...prog('Eb:8 Bb:8 F:8 Gm:8 Cm:8 Gm:8 Ab:8 D:8', B(21)), ...prog('Gm:8 F:4 Gm:4 Eb:8 D:4 Gm:4', B(37))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const parts: Part[] = [
  { id: 'hn', inst: 'hn', art: 'leg', notes: [...line(A2, B(5)), ...line(A2b, B(13), 0)], dyn: [[B(5), 0.42], ...swell(B(5), B(13), 0.42, 0.6, 0.45), ...swell(B(13), B(21), 0.45, 0.62, 0.35)] },
  { id: 'choir', inst: 'choir', art: 'sus', notes: pad(H, 'G2', 'D4', 3), lead: 0.8, dyn: [[0, 0.0], [B(3), 0.22], [B(13), 0.3], [B(21), 0.35], [B(29), 0.55], [B(33), 0.4], [B(37), 0.25], [B(45), 0.0]] },
  { id: 'va', inst: 'va', art: 'sus', notes: pad(H, 'D3', 'Bb4', 2), lead: 0.5, dyn: [[0, 0.1], [B(5), 0.25], [B(21), 0.4], [B(29), 0.55], [B(37), 0.3], [B(45), 0.0]] },
  { id: 'cb', inst: 'cb', art: 'sus', notes: bass(H, 'C2', 'B2'), lead: 0.5, dyn: [[0, 0.1], [B(5), 0.3], [B(29), 0.55], [B(37), 0.3], [B(45), 0.0]] },
  { id: 'vn1', inst: 'vn1', art: 'leg', notes: line('Bb4:4 G4:4 | D5:4 F4:4 | C5:4 A4:2 C5:2 | G4:8 | Eb5:4 C5:2 Eb5:2 | Bb4:4 G4:4 | C5:4 Eb5:4 | D5:8', B(21)),
    dyn: [[B(21), 0.45], ...swell(B(21), B(29), 0.45, 0.62, 0.5), ...swell(B(29), B(37), 0.52, 0.75, 0.35)] },
  { id: 'vn2', inst: 'vn2', art: 'sus', notes: pad(sec(21, 36), 'F4', 'D5', 2), dyn: [[B(21), 0.25], [B(29), 0.45], [B(36), 0.3]], lead: 0.4 },
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp(sec(29, 36), 'G2', 'D5', [0, 2, 4, 6, 7, 6, 4, 2], 1, 3), dyn: [], gain: -9 },
  { id: 'hn_solo', inst: 'hnSolo', art: 'leg', notes: line('G3:2 D4:1 C4:.5 Bb3:.5 | A3:1.5 Bb3:.5 G3:2 | r:4 | G3:4', B(37)), dyn: [[B(37), 0.38], [B(39), 0.45], [B(41), 0.3]] },
];
const cue: Cue = { id: 'golden_hour', title: 'Golden Hour', tags: ['dusk', 'terrace'], tempo, parts, seconds: tempo.s(B(45)) + 2, lufs: -20, harmony: H };
export default cue;
