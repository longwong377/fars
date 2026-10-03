// "The Road" (day, on the roads): a walking six-eight in G Dorian, 96 to the quarter (the dotted beat at a traveller's
// step), about 3:10. A light frame drum sets off; the clarinet carries the road's tune, the alto flute answers, the strings take
// it up, a turn to B-flat major for the open stretch, the drums alone for a while, then everyone on the tune, and the drum
// walking on alone into the distance.
import { Tempo, line, type Cue, type Part, type LNote } from '../lib/write';
import { prog, pad, bass, arp, figure, swell } from '../lib/kit';
import { KIT } from '../orchestra';

const BB = 3; // beats a bar (six eighths)
const B = (n: number) => (n - 1) * BB;
const tempo = new Tempo([[0, 92], [B(9), 96], [B(81), 96], [B(89), 88], [B(97), 80]]);

const ROAD = 'D4:.5 G4:1 A4:.5 Bb4:1 | A4:.5 G4:.5 F4:.5 G4:1.5 | D4:.5 G4:1 A4:.5 Bb4:.5 C5:.5 | D5:3 | E5:.5 D5:.5 C5:.5 D5:1 Bb4:.5 | C5:.5 Bb4:.5 A4:.5 Bb4:1 G4:.5 | A4:1 F4:.5 G4:1 E4:.5 | G4:3';
const ROAD_H = 'Gm:3 F:1.5 Gm:1.5 Gm:1.5 C:1.5 Bb:3 C:3 F:1.5 Gm:1.5 F:1.5 C:1.5 Gm:3';
const OPEN = 'F4:1.5 G4:.5 A4:.5 Bb4:.5 | C5:1.5 Bb4:1.5 | A4:.5 Bb4:.5 C5:.5 D5:1.5 | C5:3 | Eb5:1.5 D5:.5 C5:.5 Bb4:.5 | C5:1 A4:.5 F4:1.5 | G4:.5 A4:.5 Bb4:.5 A4:1 F#4:.5 | G4:3';
const OPEN_H = 'Bb:3 F:3 Bb:1.5 Gm:1.5 F:3 Eb:3 F:3 Cm:1.5 D:1.5 Gm:3';

// sections (bars): intro 1-8, clarinet 9-24 (the tune twice), flute 25-32, strings 33-48, open 49-64, drums 65-72, tutti 73-88, coda 89-96
const H = [
  ...prog('Gm:6 F:3 Gm:3 Gm:6 C:3 Gm:3', B(1)),
  ...prog(ROAD_H, B(9)), ...prog(ROAD_H, B(17)), ...prog('Gm:6 Eb:6 C:6 D:6', B(25)),
  ...prog(ROAD_H, B(33)), ...prog(ROAD_H, B(41)), ...prog(OPEN_H, B(49)), ...prog(OPEN_H, B(57)),
  ...prog('Gm:12 C:6 D:6', B(65)), ...prog(ROAD_H, B(73)), ...prog(ROAD_H, B(81)), ...prog('Gm:12 C:6 Gm:6', B(89)),
];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);

/** the frame drum: doum on the bar, tak on the off-beats, a ruff into each fourth bar */
function frame(from: number, to: number, busy = false): LNote[] {
  const out = [...figure(from, to, busy ? 'X . x x . x' : 'X . . x . .', KIT.doum, BB), ...figure(from, to, busy ? '. x . . x .' : '. . x . . x', KIT.tak, BB)];
  for (let b = from + 3; b <= to; b += 4) out.push(...[0, 0.25, 0.5, 0.75].map(o => ({ b: B(b) + 2 + o, d: 0.25, p: KIT.ruffTap })));
  return out;
}

const parts: Part[] = [
  { id: 'frame', inst: 'kit', art: 'hit', notes: [...frame(1, 64), ...frame(65, 72, true), ...frame(73, 92), ...figure(93, 96, 'X . . . . .', KIT.doum, BB)], dyn: [], gain: 2, depth: 0.45, pan: 0.1 },
  { id: 'bigdrum', inst: 'kit', art: 'hit', notes: [...figure(65, 88, 'X . . . . .', KIT.bigDrum, BB)], dyn: [], gain: -4 },
  { id: 'drone', inst: 'vc', art: 'sus', notes: [{ b: 0, d: B(9), p: 43 }, { b: 0, d: B(9), p: 50 }], dyn: [[0, 0.05], [B(4), 0.32], [B(9), 0.3]], lead: 0.4 },
  { id: 'vc_pizz', inst: 'vc', art: 'pizz', notes: bass([...sec(9, 32), ...sec(73, 88)], 'G2', 'F3', 'walk').filter((_, i) => i % 1 === 0).map(n => ({ ...n, d: 0.5 })), dyn: [], gain: -2 },
  { id: 'cb_pizz', inst: 'cb', art: 'pizz', notes: bass([...sec(33, 64), ...sec(73, 88)], 'G1', 'F2', 'root').map(n => ({ ...n, d: 1 })), dyn: [], gain: -2 },
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp([...sec(9, 24), ...sec(49, 64)], 'G3', 'D5', [0, 2, 1, 3, 2, 4], 0.5, 1), dyn: [], gain: -9 },
  { id: 'clarinet', inst: 'cl', art: 'leg', notes: [...line(ROAD, B(9)), ...line(ROAD.replace('G4:3', 'G4:1.5 r:1.5'), B(17))],
    dyn: [[B(9), 0.45], ...swell(B(9), B(17), 0.45, 0.62, 0.48), ...swell(B(17), B(25), 0.48, 0.66, 0.4)] },
  { id: 'flute', inst: 'afl', art: 'leg', notes: line('G4:1.5 A4:1.5 | Bb4:3 | Bb4:1.5 G4:1.5 | F4:3 | G4:1 A4:.5 Bb4:1 C5:.5 | D5:3 | C5:1 Bb4:.5 A4:1 G4:.5 | F#4:3', B(25)),
    dyn: [[B(25), 0.38], ...swell(B(25), B(33), 0.38, 0.6, 0.35)], depth: 0.4, pan: -0.3 },
  { id: 'va_pad', inst: 'va', art: 'sus', notes: pad(sec(25, 32), 'G3', 'D5', 2), dyn: [[B(25), 0.2], [B(29), 0.38], [B(33), 0.25]], lead: 0.3 },
  { id: 'vn1', inst: 'vn1', art: 'leg', notes: [...line(ROAD, B(33), 12), ...line(ROAD, B(41))], dyn: [[B(33), 0.5], ...swell(B(33), B(41), 0.5, 0.68, 0.5), ...swell(B(41), B(49), 0.52, 0.7, 0.45)] },
  { id: 'vn2_spic', inst: 'vn2', art: 'stac', notes: arp(sec(33, 64), 'G4', 'D5', [0, 1, 2, 1, 0, 2], 0.5, 0.4), dyn: [[B(33), 0.4], [B(48), 0.5], [B(49), 0.45], [B(64), 0.55]], gain: -3 },
  { id: 'va_spic', inst: 'va', art: 'stac', notes: arp(sec(33, 48), 'D3', 'Bb3', [0, 1, 2, 1, 2, 1], 0.5, 0.4), dyn: [[B(33), 0.35], [B(48), 0.45]], gain: -4 },
  { id: 'hn_open', inst: 'hn', art: 'leg', notes: [...line(OPEN, B(49), -12), ...line(OPEN, B(57))], dyn: [[B(49), 0.45], ...swell(B(49), B(57), 0.45, 0.6, 0.48), ...swell(B(57), B(65), 0.5, 0.68, 0.35)] },
  { id: 'vc_open', inst: 'vc', art: 'leg', notes: line(OPEN, B(57), -12), dyn: [[B(57), 0.45], ...swell(B(57), B(65), 0.45, 0.62, 0.35)] },
  { id: 'str_open', inst: 'vn1', art: 'sus', notes: pad(sec(49, 64), 'Bb4', 'F5', 2), dyn: [[B(49), 0.25], [B(57), 0.4], [B(64), 0.3]], lead: 0.3 },
  { id: 'choir', inst: 'choir', art: 'sus', notes: pad([...sec(57, 72), ...sec(81, 96)], 'D3', 'D5', 4), dyn: [[B(57), 0.1], [B(61), 0.3], [B(65), 0.35], [B(72), 0.45], [B(81), 0.3], [B(88), 0.5], [B(93), 0.2], [B(97), 0.0]], lead: 0.5 },
  { id: 'vc_ost', inst: 'vc', art: 'stac', notes: bass(sec(65, 72), 'G2', 'F3', 'pulse').flatMap(n => [n, { ...n, b: n.b + 0.5, acc: undefined }]), dyn: [[B(65), 0.4], [B(72), 0.7]], gain: -1 },
  // the tutti: oboe and violins on the tune, the horns underneath, an octave of celli
  { id: 'oboe_t', inst: 'ob', art: 'leg', notes: line(ROAD, B(73)), dyn: [[B(73), 0.6], [B(80), 0.68]] },
  { id: 'vn1_t', inst: 'vn1', art: 'leg', notes: [...line(ROAD, B(73), 12), ...line(ROAD, B(81), 12)], dyn: [[B(73), 0.62], ...swell(B(73), B(81), 0.62, 0.78, 0.66), ...swell(B(81), B(89), 0.66, 0.8, 0.4)] },
  { id: 'vn2_t', inst: 'vn2', art: 'leg', notes: line(ROAD, B(81)), dyn: [[B(81), 0.55], [B(88), 0.65], [B(89), 0.35]] },
  { id: 'hn_t', inst: 'hn', art: 'sus', notes: pad(sec(73, 92), 'D3', 'D4', 3), dyn: [[B(73), 0.45], [B(88), 0.62], [B(93), 0.0]], lead: 0.2 },
  { id: 'vc_t', inst: 'vc', art: 'leg', notes: line(ROAD, B(81), -12), dyn: [[B(81), 0.55], [B(88), 0.68], [B(89), 0.3]] },
  { id: 'clarinet_end', inst: 'cl', art: 'leg', notes: line('D4:.5 G4:1 A4:.5 Bb4:1 | A4:.5 G4:.5 F4:.5 G4:1.5 | r:3 | D4:.5 G4:1 A4:.5 G4:1 | G4:3', B(89)), dyn: [[B(89), 0.4], [B(94), 0.25]] },
];

const cue: Cue = { id: 'the_road', title: 'The Road', tags: ['day', 'road'], barBeats: BB, tempo, parts, seconds: tempo.s(B(97)) + 1, lufs: -19, harmony: H };
export default cue;
