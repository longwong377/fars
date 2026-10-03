// "Rain on Stone" (rain): E minor, 66 BPM, about 2:50. The pizzicato strings fall like rain in eighths, the harp ripples,
// the clarinet sings an unhurried song over the violas, and the shower passes on.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, arp, swell } from '../lib/kit';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 64], [B(5), 66], [B(41), 60]]);
const S = 'B4:1.5 A4:.5 G4:1 E4:1 | F#4:1.5 G4:.5 A4:2 | G4:1 F#4:1 E4:1 D4:1 | E4:4 | G4:1.5 A4:.5 B4:1 D5:1 | C5:2 B4:1 A4:1 | B4:1 A4:1 G4:1 F#4:1 | E4:4';
const SH = 'Em:4 D:4 C:4 Em:4 G:4 Am:4 Em:2 D:2 Em:4';
const H = [...prog('Em:8 C:8', B(1)), ...prog(SH, B(5)), ...prog(SH, B(13)), ...prog('C:4 G:4 Am:4 Em:4 C:4 G:4 Am:4 B:4', B(21)), ...prog(SH, B(29)), ...prog('C:4 Em:8 Em:4', B(37))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const parts: Part[] = [
  { id: 'rain_vn2', inst: 'vn2', art: 'pizz', notes: arp(H, 'E4', 'B5', [2, 4, 1, 3, 5, 2, 4, 0], 0.5, 0.6), dyn: [], gain: -6 },
  { id: 'rain_va', inst: 'va', art: 'pizz', notes: arp(sec(5, 40), 'G3', 'E4', [0, 2, 1, 2], 1, 0.6).map(n => ({ ...n, b: n.b + 0.5 })), dyn: [], gain: -6 },
  { id: 'cb_pizz', inst: 'cb', art: 'pizz', notes: bass(sec(5, 40), 'C2', 'B2').map(n => ({ ...n, d: 1 })), dyn: [], gain: -4 },
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp(sec(21, 28), 'E3', 'E6', [0, 1, 2, 3, 4, 5, 6, 7], 0.25, 1), dyn: [], gain: -10 },
  { id: 'va_pad', inst: 'va', art: 'sus', notes: pad(sec(5, 40), 'D3', 'B4', 2), dyn: [[B(5), 0.15], [B(13), 0.25], [B(21), 0.35], [B(29), 0.25], [B(40), 0.1]], lead: 0.4 },
  { id: 'cl', inst: 'cl', art: 'leg', notes: [...line(S, B(5)), ...line(S, B(29))], dyn: [[B(5), 0.42], ...swell(B(5), B(13), 0.42, 0.58, 0.42), [B(29), 0.4], ...swell(B(29), B(37), 0.4, 0.55, 0.3)] },
  { id: 'fl', inst: 'fl', art: 'leg', notes: line(S, B(13), 12), dyn: [[B(13), 0.3], ...swell(B(13), B(21), 0.3, 0.45, 0.3)], gain: -2 },
  { id: 'vc_song', inst: 'vc', art: 'leg', notes: line('E4:4 | D4:4 | C4:2 E4:2 | B3:4 | E4:2 G4:2 | D4:4 | C4:2 E4:2 | D#4:4', B(21)), dyn: [[B(21), 0.4], ...swell(B(21), B(29), 0.4, 0.6, 0.35)] },
];
const cue: Cue = { id: 'rain_on_stone', title: 'Rain on Stone', tags: ['rain'], tempo, parts, seconds: tempo.s(B(41)) + 2, lufs: -21, harmony: H };
export default cue;
