// "Market Morning" (day, in the town): a dance in seven (2+2+3 eighths) in D Dorian, 104 to the quarter, about 2:40. A
// frame drum sets the seven going, the oboe leads, the clarinet takes the tune, the violins answer in G, the flute joins,
// a drum break, everyone, and the oboe alone with the drum to the end.
import { Tempo, line, type Cue, type Part, type LNote } from '../lib/write';
import { prog, pad, bass, arp, swell } from '../lib/kit';
import { KIT } from '../orchestra';

const BB = 3.5, B = (n: number) => (n - 1) * BB;
const tempo = new Tempo([[0, 100], [B(5), 104], [B(73), 98], [B(77), 88]]);
const A = 'D5:1 C5:.5 B4:.5 A4:1.5 | G4:.5 A4:.5 B4:1 A4:1.5 | G4:.5 F4:.5 E4:1 D4:1.5 | E4:.5 F4:.5 G4:1 A4:1.5 | C5:1 A4:.5 G4:.5 A4:1.5 | C5:.5 B4:.5 A4:1 G4:1.5 | F4:.5 G4:.5 A4:.5 G4:.5 F4:.5 E4:1 | D4:3.5';
const AH = 'Dm:3.5 G:3.5 Dm:3.5 C:3.5 F:3.5 Am:3.5 Dm:3.5 Dm:3.5';
const BM = 'G4:1 A4:.5 B4:.5 C5:1.5 | D5:1 C5:.5 B4:.5 C5:1.5 | B4:.5 A4:.5 G4:1 D4:1.5 | G4:3.5 | B4:1 C5:.5 D5:.5 E5:1.5 | D5:1 C5:.5 B4:.5 A4:1.5 | B4:.5 A4:.5 G4:.5 F4:.5 G4:.5 A4:1 | D5:3.5';
const BH = 'G:3.5 C:2 Am:1.5 G:2 Dm:1.5 G:3.5 C:3.5 G:2 Am:1.5 G:2 F:1.5 Dm:3.5';
// sections: intro 1-4, A1 5-12 oboe, A2 13-20 clarinet, B1 21-28 violins, A3 29-36 oboe+flute, B2 37-44 flute+harp, break 45-48, A4 49-56 tutti, A5 57-64 tutti 2, A6 65-72 oboe alone, coda 73-76
const H = [...prog('Dm:14', B(1)), ...prog(AH, B(5)), ...prog(AH, B(13)), ...prog(BH, B(21)), ...prog(AH, B(29)), ...prog(BH, B(37)), ...prog('Dm:14', B(45)),
  ...prog(AH, B(49)), ...prog(AH, B(57)), ...prog(AH, B(65)), ...prog('Dm:14', B(73))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
/** the seven: doum on 1, tak on 2, doum on 3, tak-tak on the long group (eighths: 0 1 | 2 3 | 4 5 6) */
function seven(from: number, to: number, busy = false): LNote[] {
  const out: LNote[] = [];
  for (let b = from; b <= to; b++) { const s = B(b);
    out.push({ b: s, d: 0.5, p: KIT.doum, acc: '>' }, { b: s + 1, d: 0.5, p: KIT.tak }, { b: s + 2, d: 0.5, p: KIT.doum }, { b: s + 2.5, d: 0.5, p: KIT.tak }, { b: s + 3, d: 0.5, p: KIT.tak });
    if (busy) out.push({ b: s + 0.5, d: 0.5, p: KIT.hiTak }, { b: s + 1.5, d: 0.5, p: KIT.hiTak }, { b: s + 2.75, d: 0.25, p: KIT.ruffTap });
  }
  return out;
}
const parts: Part[] = [
  { id: 'drums', inst: 'kit', art: 'hit', notes: [...seven(1, 44), ...seven(45, 48, true), ...seven(49, 64), ...seven(65, 76)], dyn: [], gain: 1, depth: 0.45 },
  { id: 'bigdrum', inst: 'kit', art: 'hit', notes: [45, 46, 47, 48, ...Array.from({ length: 16 }, (_, i) => 49 + i)].map(b => ({ b: B(b), d: 1, p: KIT.bigDrum })), dyn: [], gain: -5 },
  { id: 'vc_pizz', inst: 'vc', art: 'pizz', notes: H.filter(c => c.b >= B(5) && c.b < B(73)).flatMap(c => bass([c], 'C2', 'B2').flatMap(n => [{ ...n, d: 1 }, { ...n, b: n.b + 2, d: 1, p: n.p + 7 }])), dyn: [], gain: -2 },
  { id: 'oboe', inst: 'ob', art: 'leg', notes: [...line(A, B(5)), ...line(A, B(29)), ...line(A, B(65))],
    dyn: [[B(5), 0.5], [B(12), 0.6], [B(29), 0.55], [B(36), 0.62], [B(65), 0.45], [B(72), 0.35]] },
  { id: 'clarinet', inst: 'cl', art: 'leg', notes: [...line(A, B(13), -12).map(n => ({ ...n, p: n.p < 52 ? n.p + 12 : n.p })), ...line(A, B(49), -12).map(n => ({ ...n, p: n.p < 52 ? n.p + 12 : n.p }))],
    dyn: [[B(13), 0.55], [B(20), 0.65], [B(49), 0.65], [B(56), 0.7]] },
  { id: 'vn1', inst: 'vn1', art: 'leg', notes: [...line(BM, B(21)), ...line(A, B(49), 12), ...line(A, B(57))], dyn: [[B(21), 0.55], ...swell(B(21), B(29), 0.55, 0.7, 0.5), [B(49), 0.65], [B(64), 0.72]] },
  { id: 'vn2_stac', inst: 'vn2', art: 'stac', notes: arp([...sec(13, 44), ...sec(49, 64)], 'D4', 'D5', [0, 2, 1, 2, 0, 1, 2], 0.5, 0.3), dyn: [[B(13), 0.35], [B(44), 0.5], [B(49), 0.55], [B(64), 0.6]], gain: -4 },
  { id: 'va', inst: 'va', art: 'sus', notes: pad([...sec(21, 28), ...sec(37, 44), ...sec(49, 64)], 'D3', 'Bb4', 2), dyn: [[B(21), 0.25], [B(28), 0.35], [B(37), 0.3], [B(49), 0.45], [B(64), 0.5]], lead: 0.2 },
  { id: 'flute', inst: 'afl', art: 'leg', notes: [...line(A, B(29)), ...line(BM, B(37))].filter(n => n.p >= 55), dyn: [[B(29), 0.35], [B(37), 0.45], [B(44), 0.5]], depth: 0.5, pan: -0.35, gain: -2 },
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp(sec(37, 44), 'D3', 'D6', [0, 2, 4, 6, 5, 3, 1], 0.5, 1), dyn: [], gain: -8 },
  { id: 'hn', inst: 'hn', art: 'sus', notes: pad(sec(49, 64), 'D3', 'D4', 3), dyn: [[B(49), 0.4], [B(64), 0.55], [B(65), 0.0]], lead: 0.2 },
  { id: 'tamb', inst: 'kit', art: 'hit', notes: [{ b: B(49) - 2.2, d: 2, p: KIT.swellShort }], dyn: [], gain: -8 },
];
const cue: Cue = { id: 'market_morning', title: 'Market Morning', tags: ['day', 'town'], barBeats: BB, tempo, parts, seconds: tempo.s(B(77)) + 2, lufs: -19, harmony: H };
export default cue;
