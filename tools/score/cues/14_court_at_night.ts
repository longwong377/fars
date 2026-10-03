// "Court at Night" (night, on the Terrace; the court's): C minor, 58 BPM, about 3:00. Torches and the guard: the low drum
// and the trombones' chorale, the harp's slow arpeggios, the violas' tune, and the horns rising once over the choir.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, arp, figure, swell } from '../lib/kit';
import { KIT } from '../orchestra';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 56], [B(5), 58], [B(37), 54], [B(41), 48]]);
const CH = 'Cm:4 Ab:4 Eb:4 Bb:4 Cm:4 Fm:4 G:4 Cm:4';
const TUNE = 'G4:2 Ab4:1 G4:1 | F4:1.5 Eb4:.5 C4:2 | Eb4:1 F4:1 G4:1 Bb4:1 | F4:4 | G4:2 C5:1 Bb4:1 | Ab4:1.5 G4:.5 F4:2 | D4:1 Eb4:1 F4:1 D4:1 | C4:4';
const H = [...prog('Cm:16', B(1)), ...prog(CH, B(5)), ...prog(CH, B(13)), ...prog('Ab:4 Eb:4 Fm:4 Cm:4 Ab:4 Bb:4 G:8', B(21)), ...prog(CH, B(29)), ...prog('Cm:16', B(37))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const parts: Part[] = [
  { id: 'drum', inst: 'kit', art: 'hit', notes: [...figure(1, 36, 'X . . . . . x .', KIT.bigDrum), ...figure(37, 39, 'X . . . . . . .', KIT.bigDrum)], dyn: [], gain: -6, depth: 0.85 },
  { id: 'timp', inst: 'timp', art: 'hit', notes: bass([...sec(21, 28)], 'C2', 'B2').map(n => ({ ...n, d: 1, acc: '>' as const })), dyn: [] },
  { id: 'tbn', inst: 'tbn', art: 'sus', notes: pad([...sec(5, 12), ...sec(29, 36)], 'C3', 'G4', 3), lead: 0.3, dyn: [[B(5), 0.35], ...swell(B(5), B(13), 0.35, 0.5, 0.3), [B(29), 0.4], ...swell(B(29), B(37), 0.4, 0.55, 0.2)] },
  { id: 'tuba', inst: 'tuba', art: 'sus', notes: bass([...sec(1, 12), ...sec(29, 40)], 'C2', 'B2'), lead: 0.3, dyn: [[0, 0.1], [B(4), 0.35], [B(13), 0.25], [B(29), 0.4], [B(40), 0.0]] },
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp(H, 'C2', 'G4', [0, 1, 2, 3, 4, 3, 2, 1], 0.5, 2), dyn: [], gain: -9 },
  { id: 'va', inst: 'va', art: 'leg', notes: [...line(TUNE, B(13)), ...line(TUNE, B(29))], dyn: [[B(13), 0.42], ...swell(B(13), B(21), 0.42, 0.6, 0.45), [B(29), 0.45], ...swell(B(29), B(37), 0.45, 0.6, 0.3)] },
  { id: 'vc', inst: 'vc', art: 'sus', notes: pad(sec(13, 36), 'C3', 'G4', 2), lead: 0.4, dyn: [[B(13), 0.25], [B(21), 0.45], [B(29), 0.3], [B(36), 0.2]] },
  { id: 'hn', inst: 'hn', art: 'leg', notes: line('Eb4:4 | Bb3:4 | C4:3 Ab3:1 | G3:4 | C4:4 | D4:2 F4:2 | D4:2 B3:2 | D4:4', B(21)), dyn: [[B(21), 0.45], ...swell(B(21), B(29), 0.45, 0.72, 0.35)] },
  { id: 'choir', inst: 'choir', art: 'sus', notes: pad(sec(21, 28), 'C3', 'G4', 4), lead: 0.5, dyn: [[B(21), 0.15], [B(25), 0.55], [B(28), 0.45], [B(29), 0.0]] },
  { id: 'gong', inst: 'kit', art: 'hit', notes: [{ b: B(25), d: 4, p: KIT.gong }], dyn: [], gain: -6 },
];
const cue: Cue = { id: 'court_at_night', title: 'Court at Night', tags: ['night', 'terrace', 'court'], tempo, parts, seconds: tempo.s(B(41)) + 2, lufs: -20, harmony: H };
export default cue;
