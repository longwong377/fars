// "Smoke and Embers" (dusk, in the town): F minor, 62 BPM, about 2:50. The hearths lit along the lanes: the clarinet's
// song over the harp, the violas and celli warming under it, the oboe's answer, the clarinet again and the embers dying.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, arp, swell } from '../lib/kit';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 60], [B(3), 62], [B(35), 58], [B(39), 50]]);
const S = 'C5:2 Ab4:1 G4:1 | F4:1.5 G4:.5 Ab4:2 | Bb4:1 Ab4:1 G4:1 Eb4:1 | F4:4 | Ab4:1.5 Bb4:.5 C5:1 Eb5:1 | Db5:2 C5:1 Bb4:1 | C5:1 Bb4:1 Ab4:1 G4:1 | F4:4';
const SH = 'Fm:4 Db:2 Fm:2 Bbm:2 Eb:2 Fm:4 Ab:4 Db:4 Fm:2 C:2 Fm:4';
const H = [...prog('Fm:4 Db:4', B(1)), ...prog(SH, B(3)), ...prog(SH, B(11)), ...prog('Db:4 Ab:4 Bbm:4 Fm:4 Db:4 Eb:4 C:8', B(19)), ...prog(SH, B(27)), ...prog('Db:4 C:4 Fm:8', B(35))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const parts: Part[] = [
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp(H, 'F2', 'C5', [0, 2, 4, 5, 4, 2], 0.5, 1.5), dyn: [], gain: -8 },
  { id: 'cl', inst: 'cl', art: 'leg', notes: [...line(S, B(3), -12), ...line(S, B(27), -12)], dyn: [[B(3), 0.45], ...swell(B(3), B(11), 0.45, 0.6, 0.45), [B(27), 0.45], ...swell(B(27), B(35), 0.45, 0.58, 0.3)] },
  { id: 'va', inst: 'va', art: 'sus', notes: pad(sec(11, 34), 'C3', 'Ab4', 2), lead: 0.4, dyn: [[B(11), 0.2], [B(19), 0.4], [B(27), 0.3], [B(34), 0.15]] },
  { id: 'vc', inst: 'vc', art: 'sus', notes: bass(sec(11, 38), 'C2', 'B2').map(n => ({ ...n, p: n.p + 12 })), lead: 0.4, dyn: [[B(11), 0.25], [B(19), 0.42], [B(27), 0.3], [B(38), 0.0]] },
  { id: 'ob', inst: 'ob', art: 'leg', notes: line('Ab4:4 | C5:4 | Db5:2 Bb4:2 | C5:4 | Ab4:4 | G4:2 Bb4:2 | G4:2 E4:2 | G4:4', B(19)), dyn: [[B(19), 0.4], ...swell(B(19), B(27), 0.4, 0.58, 0.35)] },
  { id: 'vn', inst: 'vn1', art: 'sus', notes: pad(sec(19, 26), 'F4', 'Db5', 2), lead: 0.4, dyn: [[B(19), 0.15], [B(23), 0.35], [B(27), 0.0]] },
  { id: 'cb', inst: 'cb', art: 'pizz', notes: bass(sec(3, 34), 'C2', 'B2').map(n => ({ ...n, d: 1 })), dyn: [], gain: -5 },
];
const cue: Cue = { id: 'smoke_and_embers', title: 'Smoke and Embers', tags: ['dusk', 'town'], tempo, parts, seconds: tempo.s(B(39)) + 2, lufs: -20, harmony: H };
export default cue;
