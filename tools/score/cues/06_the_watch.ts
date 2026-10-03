// "The Watch" (night): A minor, 60 BPM, about 3:00. The low A
// held in the basses, the frame drum's slow heartbeat, the bass clarinet's melody in the dark, the horns and the choir rising
// once and settling again.
import { Tempo, line, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, figure, swell } from '../lib/kit';
import { KIT } from '../orchestra';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 58], [B(5), 60], [B(37), 56], [B(43), 50]]);
const M = 'A3:2 B3:1 A3:1 | G3:1.5 F3:.5 E3:2 | F3:1 G3:1 A3:1 C4:1 | B3:3 A3:1 | D4:2 C4:1 A3:1 | A3:1.5 G3:.5 F3:2 | G3:1 F3:1 E3:1 F3:1 | A3:4';
const MH = 'Am:2 Em:2 F:2 Am:2 F:4 G:4 Dm:2 F:2 C:2 Dm:2 Am:4';
const H = [...prog('Am:16', B(1)), ...prog(MH, B(5)), ...prog(MH, B(13)), ...prog('Dm:4 Bb:4 F:4 C:4 Dm:4 Bb:4 Gm:4 A:4', B(21)), ...prog(MH, B(29)), ...prog('Am:4 F:4 Am:12', B(37))];
const sec = (a: number, b: number) => H.filter(c => c.b >= B(a) - 1e-6 && c.b < B(b + 1) - 1e-6);
const parts: Part[] = [
  { id: 'cb', inst: 'cb', art: 'sus', notes: [{ b: 0, d: B(21), p: 33 }, ...bass(sec(21, 28), 'C2', 'B2'), { b: B(29), d: B(14), p: 33 }], lead: 0.5, dyn: [[0, 0.05], [B(3), 0.35], [B(21), 0.4], [B(25), 0.55], [B(29), 0.35], [B(42), 0.15], [B(43), 0.0]] },
  { id: 'vc', inst: 'vc', art: 'sus', notes: pad(H, 'A2', 'E4', 2, 'A3'), lead: 0.5, dyn: [[0, 0.05], [B(4), 0.28], [B(21), 0.4], [B(25), 0.5], [B(29), 0.3], [B(43), 0.0]] },
  { id: 'heart', inst: 'kit', art: 'hit', notes: [...figure(3, 20, 'X . . . . x . .', KIT.doum), ...figure(21, 28, 'X . . x . x . .', KIT.doum), ...figure(29, 40, 'X . . . . x . .', KIT.doum)], dyn: [], gain: -4, depth: 0.6 },
  { id: 'bcl', inst: 'bcl', art: 'leg', notes: [...line(M, B(5)), ...line(M, B(29))], dyn: [[B(5), 0.42], ...swell(B(5), B(9), 0.42, 0.6, 0.45), ...swell(B(9), B(13), 0.45, 0.62, 0.38), [B(29), 0.4], ...swell(B(29), B(37), 0.4, 0.58, 0.3)] },
  { id: 'va', inst: 'va', art: 'leg', notes: line(M, B(13), 12), dyn: [[B(13), 0.38], ...swell(B(13), B(21), 0.38, 0.55, 0.35)] },
  { id: 'hn', inst: 'hn', art: 'sus', notes: pad(sec(21, 28), 'A2', 'D4', 3), dyn: [[B(21), 0.2], [B(25), 0.6], [B(27), 0.45], [B(29), 0.1]], lead: 0.4 },
  { id: 'choir', inst: 'choir', art: 'sus', notes: pad(sec(21, 36), 'D3', 'A4', 4), dyn: [[B(21), 0.15], [B(25), 0.5], [B(29), 0.25], [B(36), 0.18], [B(37), 0.0]], lead: 0.6 },
  { id: 'vn', inst: 'vn1', art: 'leg', notes: line('F5:4 | D5:2 F5:2 | C5:2 A4:2 | E5:4 | D5:2 F5:2 | D5:2 Bb4:2 | Bb4:2 G4:2 | A4:4', B(21)), dyn: [[B(21), 0.4], ...swell(B(21), B(29), 0.4, 0.7, 0.3)] },
  { id: 'gong', inst: 'kit', art: 'hit', notes: [{ b: B(25), d: 4, p: KIT.gong }, { b: B(41), d: 4, p: KIT.gongScrape }], dyn: [], gain: -8 },
];
const cue: Cue = { id: 'the_watch', title: 'The Watch', tags: ['night'], tempo, parts, seconds: tempo.s(B(43)) + 2, lufs: -21, harmony: H };
export default cue;
