// "Night Sky" (night): B Aeolian, 46 BPM, about 3:30, mostly air: the choir's low hum and the violins' harmonics barely
// there, the harp placing single notes like stars, the alto flute's short phrases with long silences between them.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, arp, swell, at } from '../lib/kit';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 46], [B(33), 44], [B(41), 40]]);
const H = prog('Bm:8 G:8 D:8 Asus4:4 Bm:4 Em:8 Bm:8 G:8 Bm:8 | Bm:8 G:8 D:8 Asus4:4 Bm:4 Em:8 Bm:8 Gmaj7:8 Bm:8 | Bm:16', B(1));
const F = ['B4:2 A4:1 F#4:1 | E4:2 F#4:2 | D4:4', 'F#4:1 G4:1 A4:1 B4:1 | D5:3 C#5:1 | B4:4', 'E5:2 D5:1 B4:1 | A4:2 F#4:1 E4:1 | F#4:4', 'D5:2 C#5:1 A4:1 | B4:4 | B4:2 r:2'];
const parts: Part[] = [
  { id: 'choir', inst: 'choir', art: 'sus', notes: pad(H, 'B2', 'F#4', 3, 'D3'), lead: 1.2, dyn: [[0, 0.0], [B(3), 0.16], [B(16), 0.2], [B(17), 0.14], [B(26), 0.24], [B(33), 0.14], [B(40), 0.18], [B(43), 0.0]] },
  { id: 'vn_harm', inst: 'vn1', art: 'harm', notes: pad(H, 'B5', 'B6', 1), dyn: [[0, 0.05], [B(9), 0.18], [B(25), 0.22], [B(41), 0.08]], gain: -8 },
  { id: 'va', inst: 'va', art: 'sus', notes: pad(H.filter(c => c.b >= B(17) && c.b < B(33)), 'D3', 'B4', 2), dyn: [[B(17), 0.05], [B(21), 0.22], [B(29), 0.28], [B(33), 0.05]], lead: 0.6 },
  { id: 'cb', inst: 'cb', art: 'sus', notes: [{ b: 0, d: B(17), p: 35 }, { b: B(33), d: B(10), p: 35 }], dyn: [[0, 0.05], [B(4), 0.22], [B(16), 0.18], [B(33), 0.15], [B(43), 0.0]], lead: 0.8 },
  { id: 'stars', inst: 'harp', art: 'hit', notes: arp(H, 'B4', 'F#6', [4, 1, 6, 3, 5, 2], 1.5, 4).filter((_, i) => i % 3 !== 1), dyn: [], gain: -10 },
  { id: 'flute', inst: 'afl', art: 'leg', notes: [...line(F[0], B(5)), ...line(F[1], B(13)), ...line(F[2], B(21)), ...line(F[3], B(29)), ...line(F[0], B(37))],
    dyn: [[B(5), 0.3], ...swell(B(5), B(8), 0.3, 0.45, 0.25), ...swell(B(13), B(16), 0.3, 0.48, 0.25), ...swell(B(21), B(24), 0.32, 0.5, 0.25), ...swell(B(29), B(32), 0.32, 0.5, 0.25), ...swell(B(37), B(40), 0.28, 0.4, 0.18)], depth: 0.6, pan: -0.3 },
  { id: 'cl_low', inst: 'bcl', art: 'sus', notes: at(pad(prog('Em:8 Bm:8', 0), 'B2', 'G3', 1), B(25)), dyn: [[B(25), 0.1], [B(27), 0.3], [B(29), 0.1]], lead: 0.6 },
];
const cue: Cue = { id: 'night_sky', title: 'Night Sky', tags: ['night'], tempo, parts, seconds: tempo.s(B(43)) + 2, lufs: -22, harmony: H };
export default cue;
