// "Harvest" (day, out in the fields): G Mixolydian in three, 84 BPM, about 2:50. The pizzicato and the harp in a lilting
// three, the flute, oboe and clarinet passing the field-song between them, the strings joining the second time, the horns'
// warm chord at the end.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, arp, swell } from '../lib/kit';

const BB = 3, B = (n: number) => (n - 1) * BB;
const tempo = new Tempo([[0, 80], [B(5), 84], [B(69), 78], [B(73), 70]]);
const SONG = 'D5:1 B4:1 C5:1 | D5:2 G4:1 | A4:1 B4:1 C5:1 | B4:2 A4:1 | G4:1 A4:1 B4:1 | C5:2 E5:1 | D5:1 C5:1 A4:1 | G4:3 | F4:1 G4:1 A4:1 | Bb4:2? A4:1 | G4:1 F4:1 E4:1 | D4:3 | G4:1 A4:1 B4:1 | C5:2 B4:1 | A4:1 F4:1 A4:1 | G4:3';
const S = SONG.replace('Bb4:2?', 'C5:2');
const SH = 'G:3 G:3 Am:3 G:3 Em:3 C:3 D:3 G:3 F:3 F:3 C:3 D:3 G:3 C:3 F:3 G:3';
const H = [...prog('G:6 F:3 G:3', B(1)), ...prog(SH, B(5)), ...prog(SH, B(21)), ...prog('C:6 G:6 F:6 G:6 C:6 G:6 Am:6 D:6', B(37)), ...prog(SH, B(53)), ...prog('C:3 F:3 G:6', B(69))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const parts: Part[] = [
  { id: 'pizz', inst: 'vc', art: 'pizz', notes: H.flatMap(c => bass([c], 'C2', 'B2').flatMap(n => Array.from({ length: c.d / 3 }, (_, k) => [{ ...n, b: n.b + k * 3, d: 1, acc: '>' as const }, { ...n, b: n.b + k * 3 + 1, d: 1, p: n.p + 7 }, { ...n, b: n.b + k * 3 + 2, d: 1, p: n.p + 12 }]).flat())), dyn: [], gain: -3 },
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp(sec(5, 72), 'G3', 'D5', [2, 3, 4], 1, 1), dyn: [], gain: -9 },
  { id: 'fl', inst: 'fl', art: 'leg', notes: [...line(S, B(5)).filter(n => n.b < B(13)), ...line(S, B(53))], dyn: [[B(5), 0.45], [B(12), 0.5], [B(53), 0.5], [B(68), 0.55]] },
  { id: 'ob', inst: 'ob', art: 'leg', notes: line(S, B(5)).filter(n => n.b >= B(13)), dyn: [[B(13), 0.45], [B(20), 0.5]] },
  { id: 'cl', inst: 'cl', art: 'leg', notes: line(S, B(21), -12).map(n => ({ ...n, p: n.p < 52 ? n.p + 12 : n.p })), dyn: [[B(21), 0.45], ...swell(B(21), B(37), 0.45, 0.58, 0.45)] },
  { id: 'vn1', inst: 'vn1', art: 'leg', notes: [...line(S, B(21)), ...line('G4:3 | C5:3 | D5:3 | B4:3 | C5:3 | A4:3 | B4:3 | D5:3 | G4:3 | E4:3 | F4:3 | G4:3 | E5:3 | C5:3 | D5:3 | F#5:3', B(37))], dyn: [[B(21), 0.4], ...swell(B(21), B(37), 0.4, 0.55, 0.45), ...swell(B(37), B(53), 0.45, 0.65, 0.4)] },
  { id: 'va', inst: 'va', art: 'sus', notes: pad(sec(21, 68), 'D3', 'B4', 2), lead: 0.3, dyn: [[B(21), 0.25], [B(37), 0.35], [B(53), 0.3], [B(68), 0.35]] },
  { id: 'hn', inst: 'hn', art: 'sus', notes: pad([...sec(37, 52), ...sec(69, 72)], 'B2', 'D4', 3), lead: 0.3, dyn: [[B(37), 0.2], [B(45), 0.4], [B(53), 0.0], [B(69), 0.35], [B(72), 0.2]] },
];
const cue: Cue = { id: 'harvest', title: 'Harvest', tags: ['day', 'plain'], barBeats: BB, tempo, parts, seconds: tempo.s(B(73)) + 2, lufs: -19, harmony: H };
export default cue;
