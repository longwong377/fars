// "Evening Road" (dusk, on the roads): the road's tune again, slower, in D Dorian on the solo cello with the harp, the
// travellers going home; 6/8 at 80 to the quarter, about 3:00.
import { Tempo, line, type Cue, type Part, type LNote } from '../lib/write';
import { prog, pad, bass, arp, figure, swell } from '../lib/kit';
import { KIT } from '../orchestra';

const BB = 3, B = (n: number) => (n - 1) * BB;
const tempo = new Tempo([[0, 76], [B(5), 80], [B(53), 76], [B(61), 66]]);
const ROAD = 'D4:.5 G4:1 A4:.5 Bb4:1 | A4:.5 G4:.5 F4:.5 G4:1.5 | D4:.5 G4:1 A4:.5 Bb4:.5 C5:.5 | D5:3 | E5:.5 D5:.5 C5:.5 D5:1 Bb4:.5 | C5:.5 Bb4:.5 A4:.5 Bb4:1 G4:.5 | A4:1 F4:.5 G4:1 E4:.5 | G4:3';
const RH = 'Gm:3 F:1.5 Gm:1.5 Gm:1.5 C:1.5 Bb:3 C:3 F:1.5 Gm:1.5 F:1.5 C:1.5 Gm:3';
const T = -5; // G Dorian -> D Dorian
const sh = (p: string) => prog(p, 0).map(c => c); // (for readability below)
const tp = (spec: string) => spec.replace(/([A-G][b#]?)/g, m => ({ G: 'D', F: 'C', C: 'G', Bb: 'F', D: 'A', Eb: 'Bb', A: 'E', E: 'B' } as Record<string, string>)[m] ?? m);
const H = [...prog('Dm:12 C:6 Dm:6', B(1)), ...prog(tp(RH), B(9)), ...prog(tp(RH), B(17)), ...prog('Bb:6 F:6 C:6 Dm:6', B(25)), ...prog(tp(RH), B(33)), ...prog(tp(RH), B(41)), ...prog('Dm:6 C:6 Dm:12', B(49)), ...prog('Dm:12', B(57))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const parts: Part[] = [
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp(H, 'D3', 'A5', [0, 2, 4, 3, 2, 1], 0.5, 1.5), dyn: [], gain: -7 },
  { id: 'frame', inst: 'kit', art: 'hit', notes: [...figure(9, 56, 'X . . x . .', KIT.doum, BB), ...figure(9, 56, '. . x . . .', KIT.tak, BB)], dyn: [], gain: -6, depth: 0.6 },
  { id: 'cello', inst: 'vcSolo', art: 'leg', notes: [...line(ROAD, B(9), T), ...line(ROAD, B(33), T)], dyn: [[B(9), 0.45], ...swell(B(9), B(17), 0.45, 0.6, 0.45), [B(33), 0.45], ...swell(B(33), B(41), 0.45, 0.62, 0.45)] },
  { id: 'vn_answer', inst: 'vn1', art: 'leg', notes: [...line(ROAD, B(17), T + 12), ...line(ROAD, B(41), T + 12)], dyn: [[B(17), 0.4], ...swell(B(17), B(25), 0.4, 0.58, 0.38), [B(41), 0.45], ...swell(B(41), B(49), 0.45, 0.62, 0.3)] },
  { id: 'flute', inst: 'afl', art: 'leg', notes: line('F4:1.5 G4:1.5 | F4:3 | C5:1.5 A4:1.5 | G4:3 | G4:1 A4:.5 Bb4:1 C5:.5 | A4:3 | G4:1 A4:.5 G4:1 E4:.5 | D4:3', B(25)).map(n => ({ ...n, p: Math.max(n.p, 55) })), dyn: [[B(25), 0.35], ...swell(B(25), B(33), 0.35, 0.55, 0.3)], depth: 0.5, pan: -0.3 },
  { id: 'va', inst: 'va', art: 'sus', notes: pad(H, 'D3', 'A4', 2), lead: 0.4, dyn: [[0, 0.1], [B(9), 0.25], [B(25), 0.35], [B(33), 0.3], [B(41), 0.4], [B(49), 0.25], [B(61), 0.0]] },
  { id: 'cb', inst: 'cb', art: 'pizz', notes: bass(sec(9, 56), 'C2', 'B2').map(n => ({ ...n, d: 1 })), dyn: [], gain: -4 },
  { id: 'cello_end', inst: 'vcSolo', art: 'leg', notes: line('D4:.5 G4:1 A4:.5 G4:1 | F4:1.5 E4:1.5 | D4:3 | r:3 | D4:.5 G4:1 A4:.5 G4:1 | D4:6', B(51), T + 5), dyn: [[B(51), 0.38], [B(57), 0.25], [B(60), 0.05]] },
];
const cue: Cue = { id: 'evening_road', title: 'Evening Road', tags: ['dusk', 'road'], barBeats: BB, tempo, parts, seconds: tempo.s(B(61)) + 2, lufs: -20, harmony: H };
export default cue;
