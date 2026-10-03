// "The King's Terrace" (day, on the Terrace; the court's): a processional in D Mixolydian (the major with its flattened
// seventh, the C that keeps it from sounding like a parade ground), 64 BPM, about 3:10. The timpani and low brass open; the
// horns carry the processional tune; the strings and choir take it with the trumpets' calls above; a quieter middle in B minor
// for the woodwinds; the tune in full; the calls fading out across the platform.
import { Tempo, line, type Cue, type Part, type LNote } from '../lib/write';
import { prog, pad, bass, arp, figure, swell } from '../lib/kit';
import { KIT } from '../orchestra';
import { pc } from '../lib/write';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 60], [B(5), 64], [B(45), 64], [B(49), 56]]);

const T = 'D4:1.5 E4:.5 F#4:1 A4:1 | G4:1.5 F#4:.5 E4:2 | D4:1 E4:1 F#4:1 G4:1 | A4:4 | B4:1.5 A4:.5 G4:1 F#4:1 | E4:1.5 F#4:.5 G4:1 C5:1 | B4:1 A4:1 G4:1 E4:1 | D4:4';
const T_H = 'D:4 G:2 Em:2 D:4 C:4 G:4 C:4 G:2 Em:2 D:4';
const MID = 'F#4:2 E4:1 D4:1 | E4:2 B3:2 | C#4:1 D4:1 E4:1 F#4:1 | E4:4 | G4:2 F#4:1 E4:1 | F#4:1.5 E4:.5 D4:2 | C#4:1 D4:1 E4:1 C#4:1 | B3:4';
const MID_H = 'Bm:4 Em:4 A:4 A:4 Em:4 Bm:4 A:4 Bm:4';
/** the trumpets' call: the fourth and the fifth, as the court's horns might sound them (C) */
const CALL = (at: number): LNote[] => line('A4:.5 A4:.5 D5:1 r:.5 A4:.5 D5:1.5', at);

const H = [...prog('D5:16', B(1)), ...prog(T_H, B(5)), ...prog(T_H, B(13)), ...prog(MID_H, B(21)), ...prog(MID_H.replace('Bm:4 Em:4', 'G:4 Em:4'), B(29)), ...prog(T_H, B(37)), ...prog('G:4 C:4 D:8', B(45))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);

const parts: Part[] = [
  { id: 'timp', inst: 'timp', art: 'hit', notes: [...[0, 1, 2, 3].flatMap(b => [{ b: B(b + 1), d: 1, p: pc('D2'), acc: '>' as const }, { b: B(b + 1) + 2.5, d: 0.5, p: pc('A2') }, { b: B(b + 1) + 3, d: 1, p: pc('D2') }]),
      ...bass(sec(13, 20), 'C2', 'B2').map(n => ({ ...n, d: 1, acc: '>' as const })),
      ...[37, 39, 41, 43].map(b => ({ b: B(b), d: 1, p: pc('D2'), acc: '>' as const })), { b: B(47), d: 2, p: pc('D2'), acc: '>' as const }], dyn: [] },
  { id: 'drum', inst: 'kit', art: 'hit', notes: [...figure(5, 20, 'X . . . . . . .', KIT.bigDrum), ...figure(37, 46, 'X . . . x . . .', KIT.bigDrum), { b: B(37), d: 4, p: KIT.gong }], dyn: [], gain: -6 },
  { id: 'lowbrass', inst: 'tbn', art: 'sus', notes: [{ b: 0, d: B(5), p: pc('D3') }, { b: 0, d: B(5), p: pc('A3') }, ...pad(sec(13, 20), 'D3', 'A4', 3), ...pad(sec(37, 48), 'D3', 'A4', 3)],
    dyn: [[0, 0.1], [B(4), 0.45], [B(5), 0.3], [B(13), 0.4], [B(20), 0.55], [B(21), 0.0], [B(37), 0.55], [B(44), 0.7], [B(48), 0.4], [B(49), 0.0]], lead: 0.3 },
  { id: 'tuba', inst: 'tuba', art: 'sus', notes: [{ b: 0, d: B(5), p: pc('D2') }, ...bass(sec(13, 20), 'C2', 'B2'), ...bass(sec(37, 48), 'C2', 'B2')],
    dyn: [[0, 0.1], [B(4), 0.45], [B(5), 0.3], [B(13), 0.45], [B(21), 0.0], [B(37), 0.55], [B(48), 0.45], [B(49), 0.0]], lead: 0.3 },
  { id: 'hn_T', inst: 'hn', art: 'leg', notes: [...line(T, B(5)), ...line(T, B(37))], dyn: [[B(5), 0.55], ...swell(B(5), B(13), 0.55, 0.72, 0.6), [B(13), 0.0], [B(37), 0.72], ...swell(B(37), B(45), 0.72, 0.88, 0.75)] },
  { id: 'vc_T', inst: 'vc', art: 'leg', notes: [...line(T, B(13)), ...line(T, B(37))], dyn: [[B(13), 0.6], ...swell(B(13), B(21), 0.6, 0.78, 0.6), [B(37), 0.75], [B(45), 0.85]] },
  { id: 'vn1_T', inst: 'vn1', art: 'leg', notes: [...line(T, B(13), 12), ...line(T, B(37), 12)], dyn: [[B(13), 0.6], ...swell(B(13), B(21), 0.6, 0.78, 0.6), [B(37), 0.75], [B(45), 0.88]] },
  { id: 'str_pad', inst: 'va', art: 'sus', notes: pad([...sec(5, 20), ...sec(37, 48)], 'D3', 'D5', 3), dyn: [[B(5), 0.3], [B(13), 0.45], [B(20), 0.55], [B(21), 0.0], [B(37), 0.55], [B(48), 0.4], [B(49), 0.0]], lead: 0.3 },
  { id: 'choir', inst: 'choir', art: 'sus', notes: pad([...sec(13, 20), ...sec(37, 48)], 'D3', 'A4', 4), dyn: [[B(13), 0.4], [B(19), 0.6], [B(21), 0.0], [B(37), 0.6], [B(44), 0.75], [B(48), 0.4], [B(49), 0.0]], lead: 0.4 },
  { id: 'tpt_calls', inst: 'tpt', art: 'mar', notes: [...[2, 4].flatMap(b => CALL(B(b) + 1)), ...[15, 19].flatMap(b => CALL(B(b) + 2)), ...[39, 43].flatMap(b => CALL(B(b) + 2)), ...[46, 47].flatMap(b => CALL(B(b)))],
    dyn: [[0, 0.45], [B(15), 0.6], [B(39), 0.7], [B(46), 0.5], [B(47), 0.3]], gain: -2 },
  // the middle: woodwinds in B minor over pizzicato and harp
  { id: 'ob', inst: 'ob', art: 'leg', notes: line(MID, B(21)), dyn: [[B(21), 0.42], ...swell(B(21), B(29), 0.42, 0.58, 0.4)] },
  { id: 'cl', inst: 'cl', art: 'leg', notes: line(MID, B(29)), dyn: [[B(29), 0.42], ...swell(B(29), B(37), 0.42, 0.6, 0.45)] },
  { id: 'fl', inst: 'fl', art: 'leg', notes: line(MID, B(29), 12), dyn: [[B(29), 0.3], ...swell(B(29), B(37), 0.3, 0.45, 0.3)], gain: -3 },
  { id: 'pizz', inst: 'vc', art: 'pizz', notes: bass(sec(21, 36), 'B1', 'A2', 'walk').map(n => ({ ...n, d: 0.5, p: n.p < 36 ? n.p + 12 : n.p })), dyn: [], gain: -3 },
  { id: 'harp', inst: 'harp', art: 'hit', notes: arp(sec(21, 36), 'B2', 'F#5', [0, 2, 4, 6, 4, 2, 1, 3], 0.5, 1.2), dyn: [], gain: -9 },
  { id: 'va_mid', inst: 'va', art: 'sus', notes: pad(sec(21, 36), 'D3', 'B4', 2), dyn: [[B(21), 0.25], [B(29), 0.35], [B(36), 0.4]], lead: 0.3 },
];

const cue: Cue = { id: 'kings_terrace', title: "The King's Terrace", tags: ['day', 'terrace', 'court'], tempo, parts, seconds: tempo.s(B(49)) + 2, lufs: -19, harmony: H };
export default cue;
