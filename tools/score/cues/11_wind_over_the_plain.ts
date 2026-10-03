// "Wind over the Plain" (day, out on the plain or the roads): D minor, 72 BPM, about 3:10, a slow build: the violas'
// eighths like wind in the grass, the celli's long line, the horns swelling, the choir and the drums at the height, and the
// wind dropping again.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, arp, ostinato, figure, swell } from '../lib/kit';
import { KIT } from '../orchestra';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 70], [B(9), 72], [B(41), 72], [B(49), 64], [B(57), 56]]);
const P = 'Dm:4 Bb:4 F:4 C:4';
const H = [...prog(Array(14).fill(P).join(' '), B(1))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const LINE = 'A3:4 | D4:2 F4:2 | C4:3 A3:1 | G3:4 | A3:2 D4:2 | F4:3 G4:1 | A4:2 F4:1 E4:1 | E4:4';
const HIGH = 'D5:4 | F5:2 D5:2 | C5:4 | E5:2 G5:2 | F5:4 | D5:3 F5:1 | A5:4 | G5:4';
const parts: Part[] = [
  { id: 'va_wind', inst: 'va', art: 'stac', notes: arp(sec(1, 52), 'D3', 'F4', [0, 1, 2, 1, 0, 2, 1, 2], 0.5, 0.4), dyn: [[0, 0.15], [B(9), 0.35], [B(25), 0.5], [B(33), 0.7], [B(41), 0.72], [B(45), 0.45], [B(53), 0.15]], gain: -2 },
  { id: 'vn2_wind', inst: 'vn2', art: 'stac', notes: arp(sec(17, 48), 'F4', 'A5', [2, 1, 0, 1, 2, 3, 2, 1], 0.5, 0.4), dyn: [[B(17), 0.2], [B(25), 0.4], [B(33), 0.65], [B(41), 0.7], [B(48), 0.4]], gain: -3 },
  { id: 'vc_line', inst: 'vc', art: 'leg', notes: [...line(LINE, B(9)), ...line(LINE, B(17)), ...line(LINE, B(41))], dyn: [[B(9), 0.42], ...swell(B(9), B(17), 0.42, 0.6, 0.5), ...swell(B(17), B(25), 0.5, 0.7, 0.55), [B(41), 0.6], ...swell(B(41), B(49), 0.6, 0.7, 0.35)] },
  { id: 'cb', inst: 'cb', art: 'sus', notes: bass(sec(9, 56), 'C2', 'B2'), lead: 0.3, dyn: [[B(9), 0.25], [B(25), 0.5], [B(33), 0.7], [B(41), 0.7], [B(49), 0.35], [B(57), 0.0]] },
  { id: 'hn', inst: 'hn', art: 'sus', notes: pad(sec(21, 48), 'A2', 'D4', 3), lead: 0.3, dyn: [[B(21), 0.1], [B(25), 0.4], [B(33), 0.7], [B(41), 0.75], [B(45), 0.5], [B(49), 0.0]] },
  { id: 'vn1_high', inst: 'vn1', art: 'leg', notes: [...line(HIGH, B(25)), ...line(HIGH, B(33))], dyn: [[B(25), 0.5], ...swell(B(25), B(33), 0.5, 0.68, 0.6), ...swell(B(33), B(41), 0.62, 0.85, 0.6)] },
  { id: 'hn_line', inst: 'hn', art: 'leg', notes: line(LINE, B(33)), dyn: [[B(33), 0.65], ...swell(B(33), B(41), 0.65, 0.85, 0.6)] },
  { id: 'choir', inst: 'choir', art: 'sus', notes: pad(sec(29, 48), 'D3', 'A4', 4), lead: 0.5, dyn: [[B(29), 0.15], [B(33), 0.55], [B(41), 0.7], [B(45), 0.4], [B(49), 0.0]] },
  { id: 'taiko', inst: 'taiko', art: 'hit', notes: figure(33, 44, 'X . . x . . x .', 36), dyn: [] },
  { id: 'drum', inst: 'kit', art: 'hit', notes: [...figure(25, 32, 'X . . . . . . .', KIT.bigDrum), ...figure(33, 44, 'X . . . X . . .', KIT.bigDrum), { b: B(33) - 4.1, d: 4, p: KIT.swellMid }, { b: B(45), d: 4, p: KIT.gong }], dyn: [], gain: -4 },
  { id: 'tbn', inst: 'tbn', art: 'sus', notes: pad(sec(33, 44), 'D3', 'A4', 3), lead: 0.2, dyn: [[B(33), 0.4], [B(41), 0.65], [B(45), 0.0]] },
];
const cue: Cue = { id: 'wind_over_the_plain', title: 'Wind over the Plain', tags: ['day', 'road', 'plain'], tempo, parts, seconds: tempo.s(B(57)) + 2, lufs: -19, harmony: H };
export default cue;
