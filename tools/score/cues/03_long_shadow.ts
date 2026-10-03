// "The Long Shadow" (dusk): a lament in E minor, 52 BPM, about 3:20. The solo cello sings over a held string chord,
// the viola answers it, the violins lift the song into the last of the light (the relative G major), then the whole string
// choir and the horns softly, and the cello alone closes on the fall to E.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, arp, swell } from '../lib/kit';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 50], [B(5), 52], [B(29), 54], [B(37), 50], [B(43), 44]]);

const A = 'B3:2 C4:1 B3:1 | A3:1.5 G3:.5 F#3:1 E3:1 | G3:2 A3:1 B3:1 | E3:4 | E4:2 D4:1 C4:1 | B3:1.5 C4:.5 D4:1 B3:1 | C4:1 B3:1 A3:1 G3:1 | F#3:2 E3:2';
const A_H = 'Em:4 Am:2 D:2 C:2 G:2 Em:4 C:4 G:4 Am:4 B:2 Em:2';
const BV = 'G4:2 A4:1 B4:1 | C5:3 B4:1 | A4:1.5 B4:.5 C5:1 D5:1 | E5:4 | D5:2 C5:1 B4:1 | A4:1.5 G4:.5 F#4:1 E4:1 | D4:1 E4:1 F#4:1 G4:1 | E4:4';
const B_H = 'G:4 C:2 Am:2 Am:2 G:2 C:4 G:4 D:4 C:4 Em:4';

const H = [...prog('Em:8 C:4 Em:4', B(1)), ...prog(A_H, B(5)), ...prog(A_H, B(13)), ...prog(B_H, B(21)), ...prog(A_H, B(29)), ...prog('Am:2 D:2 Em:4 Em:4 B:3 Em:1 Em:8', B(37))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);

const parts: Part[] = [
  { id: 'va_pad', inst: 'va', art: 'sus', notes: pad(H, 'E3', 'C5', 2, 'G3'), lead: 0.5,
    dyn: [[0, 0.05], [B(3), 0.3], [B(5), 0.22], [B(13), 0.28], [B(21), 0.35], [B(25), 0.45], [B(29), 0.5], [B(33), 0.55], [B(37), 0.25], [B(44), 0.0]] },
  { id: 'vn2_pad', inst: 'vn2', art: 'sus', notes: pad([...sec(1, 4), ...sec(21, 36)], 'G4', 'E5', 2, 'B4'), lead: 0.5,
    dyn: [[0, 0.03], [B(3), 0.2], [B(5), 0.0], [B(21), 0.25], [B(25), 0.4], [B(29), 0.45], [B(36), 0.3], [B(37), 0.0]] },
  { id: 'cb', inst: 'cb', art: 'sus', notes: bass(H, 'C2', 'B2'), lead: 0.5, dyn: [[0, 0.1], [B(3), 0.3], [B(21), 0.38], [B(29), 0.45], [B(37), 0.3], [B(44), 0.0]] },
  { id: 'harp', inst: 'harp', art: 'hit', notes: [...arp(sec(1, 4), 'E2', 'B4', [0, 2, 4, 3], 1, 3), ...arp(sec(37, 44), 'E2', 'B4', [0, 2, 4, 3], 1, 3)], dyn: [], gain: -8 },
  { id: 'cello', inst: 'vcSolo', art: 'leg', notes: [...line(A, B(5)), ...line(A, B(13))],
    dyn: [[B(5), 0.42], ...swell(B(5), B(9), 0.42, 0.6, 0.45), ...swell(B(9), B(13), 0.48, 0.66, 0.4), ...swell(B(13), B(17), 0.45, 0.62, 0.48), ...swell(B(17), B(21), 0.5, 0.7, 0.35)] },
  { id: 'viola_ans', inst: 'va', art: 'leg', notes: line('r:2 E4:2 | D4:2 C4:2 | E4:2 F#4:1 E4:1 | B3:4 | G4:2 F#4:1 E4:1 | D4:2 G4:2 | E4:2 C4:2 | A3:2 G3:2', B(13)),
    dyn: [[B(13), 0.3], ...swell(B(13), B(21), 0.3, 0.45, 0.25)], gain: -1, pan: 0.05 },
  { id: 'vn1_song', inst: 'vn1', art: 'leg', notes: line(BV, B(21)), dyn: [[B(21), 0.45], ...swell(B(21), B(25), 0.45, 0.62, 0.55), ...swell(B(25), B(29), 0.58, 0.75, 0.42)] },
  { id: 'vc_bass_B', inst: 'vc', art: 'sus', notes: bass(sec(21, 36), 'E2', 'D3'), dyn: [[B(21), 0.35], [B(29), 0.5], [B(36), 0.35]] },
  // the tutti: the lament in the violins an octave up, the celli below, horns holding
  { id: 'vn1_A', inst: 'vn1', art: 'leg', notes: line(A, B(29), 24), dyn: [[B(29), 0.55], ...swell(B(29), B(33), 0.55, 0.72, 0.6), ...swell(B(33), B(37), 0.6, 0.75, 0.3)] },
  { id: 'vc_A', inst: 'vc', art: 'leg', notes: line(A, B(29), 12), dyn: [[B(29), 0.5], ...swell(B(29), B(37), 0.5, 0.65, 0.3)] },
  { id: 'hn', inst: 'hn', art: 'sus', notes: pad(sec(29, 36), 'G2', 'E4', 3), dyn: [[B(29), 0.2], [B(33), 0.42], [B(37), 0.1]], lead: 0.3 },
  { id: 'cello_end', inst: 'vcSolo', art: 'leg', notes: line('A3:2 G3:1 F#3:1 | E3:4 | B3:2 A3:1 G3:1 | F#3:3 E3:1 | E3:6', B(37)),
    dyn: [[B(37), 0.4], ...swell(B(37), B(41), 0.4, 0.52, 0.35), [B(44), 0.08]] },
];

const cue: Cue = { id: 'long_shadow', title: 'The Long Shadow', tags: ['dusk'], tempo, parts, seconds: tempo.s(B(45)) + 1, lufs: -20, harmony: H };
export default cue;
