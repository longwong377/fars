// "The Gate" (day, on the Terrace): C minor, 76 BPM, about 2:40, the score's most driven piece: the low strings' 3+3+2
// eighths under the theme's head in the horns, the trumpets and the drums, an E-flat major lift, and the ostinato running
// down into the stone.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, ostinato, figure, swell } from '../lib/kit';
import { KIT } from '../orchestra';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 74], [B(5), 76], [B(45), 70], [B(49), 62]]);
const HEAD = 'C4:2 G4:1 F4:.5 Eb4:.5 | D4:1.5 Eb4:.5 C4:2 | Bb3:1 C4:.5 D4:.5 Eb4:1 F4:1 | G4:3 r:1 | Ab4:2 G4:1 F4:.5 Eb4:.5 | F4:1.5 Eb4:.5 D4:1 Bb3:1 | C4:1 D4:.5 Eb4:.5 D4:1 C4:.5 B3:.5 | C4:4';
const HH = 'Cm:4 Bb:2 Cm:2 Eb:4 Eb:2 Bb:2 Ab:4 Fm:2 Bb:2 Fm:2 G:2 Cm:4';
const H = [...prog('Cm:16', B(1)), ...prog(HH, B(5)), ...prog(HH, B(13)), ...prog('Eb:4 Bb:4 Cm:4 Ab:4 Eb:4 Bb:4 Ab:4 G:4', B(21)), ...prog(HH, B(29)), ...prog(HH, B(37)), ...prog('Ab:4 G:4 Cm:8', B(45))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const parts: Part[] = [
  { id: 'vc_ost', inst: 'vc', art: 'mar', notes: ostinato(sec(1, 46), 'C2', 'C4'), dyn: [[0, 0.3], [B(5), 0.55], [B(21), 0.65], [B(29), 0.75], [B(44), 0.8], [B(47), 0.4]] },
  { id: 'cb_ost', inst: 'cb', art: 'stac', notes: ostinato(sec(5, 46), 'C2', 'C3').filter(n => n.acc), dyn: [[B(5), 0.5], [B(29), 0.75], [B(46), 0.7]] },
  { id: 'hn', inst: 'hn', art: 'leg', notes: [...line(HEAD, B(5)), ...line(HEAD, B(29))], dyn: [[B(5), 0.6], ...swell(B(5), B(13), 0.6, 0.75, 0.62), [B(29), 0.72], ...swell(B(29), B(37), 0.72, 0.88, 0.75)] },
  { id: 'vn1', inst: 'vn1', art: 'leg', notes: [...line(HEAD, B(13), 12), ...line(HEAD, B(37), 12)], dyn: [[B(13), 0.62], ...swell(B(13), B(21), 0.62, 0.78, 0.6), [B(37), 0.75], ...swell(B(37), B(45), 0.75, 0.9, 0.6)] },
  { id: 'tpt', inst: 'tpt', art: 'leg', notes: line(HEAD, B(37), 12).filter(n => n.p <= 82), dyn: [[B(37), 0.5], [B(44), 0.7]], gain: -2 },
  { id: 'va_trem', inst: 'va', art: 'trem', notes: pad(sec(13, 28), 'C3', 'C5', 2), dyn: [[B(13), 0.35], [B(21), 0.55], [B(28), 0.45]], gain: -3 },
  { id: 'tbn', inst: 'tbn', art: 'sus', notes: pad([...sec(21, 28), ...sec(37, 48)], 'C3', 'G4', 3), lead: 0.2, dyn: [[B(21), 0.45], [B(28), 0.7], [B(29), 0.0], [B(37), 0.6], [B(45), 0.75], [B(48), 0.35]] },
  { id: 'choir', inst: 'choir', art: 'sus', notes: pad([...sec(21, 28), ...sec(37, 48)], 'C3', 'G4', 4), lead: 0.3, dyn: [[B(21), 0.4], [B(27), 0.7], [B(29), 0.0], [B(37), 0.6], [B(45), 0.8], [B(48), 0.3]] },
  { id: 'vn_B', inst: 'vn1', art: 'leg', notes: line('G5:4 | F5:4 | Eb5:4 | C5:4 | Bb4:2 Eb5:2 | D5:2 F5:2 | Eb5:2 C5:2 | D5:4', B(21)), dyn: [[B(21), 0.6], ...swell(B(21), B(29), 0.6, 0.85, 0.65)] },
  { id: 'taiko', inst: 'taiko', art: 'hit', notes: [...figure(13, 20, 'X . . x . . x .', 36), ...figure(21, 28, 'X . x x . x X x', 36), ...figure(29, 44, 'X . . x . . x .', 36)], dyn: [] },
  { id: 'drum', inst: 'kit', art: 'hit', notes: [...figure(5, 44, 'X . . . X . . .', KIT.bigDrum), ...figure(21, 44, '. x . x x . x x', KIT.ruffTap), { b: B(21), d: 4, p: KIT.gong }, { b: B(45), d: 4, p: KIT.gong }], dyn: [], gain: -4 },
  { id: 'timp', inst: 'timp', art: 'hit', notes: bass([...sec(5, 46)], 'C2', 'B2').map(n => ({ ...n, d: 1, acc: '>' as const })), dyn: [] },
];
const cue: Cue = { id: 'the_gate', title: 'The Gate', tags: ['day', 'terrace'], tempo, parts, seconds: tempo.s(B(49)) + 2, lufs: -18, harmony: H };
export default cue;
