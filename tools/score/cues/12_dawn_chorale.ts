// "Dawn Chorale" (dawn, on the Terrace): A Dorian, 54 BPM, about 3:00. A chorale for horns and trombones, the choir
// answering each phrase, then strings carrying it, and the horns alone with the last phrase as the light lands on the
// platform.
import { Tempo, line, chords, type Cue, type Part } from '../lib/write';
import { prog, pad, bass, swell, at } from '../lib/kit';

const B = (n: number) => (n - 1) * 4;
const tempo = new Tempo([[0, 52], [B(3), 54], [B(29), 52], [B(37), 46]]);
// the chorale: four phrases of two bars, a fermata breath at each end
const CH = prog('Am:4 D:4 G:2 Em:2 Am:4 | F:4 C:4 Dm:2 E:2 Am:4 | C:4 G:4 Am:2 Em:2 F:4 | Dm:4 Am:4 Esus4:2 E:2 Am:4', 0);
const TOP = 'E4:4 | F#4:4 | G4:2 E4:2 | E4:4 | F4:4 | E4:4 | F4:2 G#4:2 | A4:4 | G4:4 | G4:2 B4:2 | C5:2 B4:2 | A4:4 | A4:4 | A4:4 | A4:2 G#4:2 | A4:4';
const H = [...prog('Am:8', B(1)), ...at(CH, B(3)), ...at(CH, B(19)), ...prog('Am:4 D:4 Am:8', B(35))];
const parts: Part[] = [
  // the first two bars: the low strings' A, breathing in before the chorale
  { id: 'open', inst: 'vc', art: 'sus', notes: pad(prog('Am:8', 0), 'A2', 'E3', 2), lead: 1, dyn: [[0, 0.05], [B(2), 0.3], [B(3), 0.25], [B(4), 0.0]] },
  { id: 'hn', inst: 'hn', art: 'sus', notes: [...pad(at(CH, B(3)), 'A2', 'D4', 3, 'E3'), ...pad(prog('Am:4 D:4 Am:8', B(35)), 'A2', 'D4', 3)], lead: 0.3,
    dyn: [[B(3), 0.4], ...swell(B(3), B(7), 0.4, 0.55, 0.38), ...swell(B(7), B(11), 0.4, 0.58, 0.38), ...swell(B(11), B(15), 0.42, 0.62, 0.4), ...swell(B(15), B(19), 0.42, 0.6, 0.3), [B(19), 0.25], [B(35), 0.4], [B(39), 0.0]] },
  { id: 'hn_top', inst: 'hnSolo', art: 'leg', notes: [...line(TOP, B(3)), ...line('E4:4 | F#4:4 | E4:8', B(35))], dyn: [[B(3), 0.45], [B(10), 0.55], [B(18), 0.45], [B(19), 0.0], [B(35), 0.42], [B(39), 0.1]] },
  { id: 'tbn', inst: 'tbn', art: 'sus', notes: bass(at(CH, B(3)), 'C2', 'B3').map(n => ({ ...n, p: n.p < 40 ? n.p + 12 : n.p })), dyn: [[B(3), 0.35], [B(11), 0.45], [B(19), 0.0]], lead: 0.3 },
  { id: 'choir', inst: 'choir', art: 'sus', notes: pad(at(CH, B(3)), 'C3', 'A4', 4), lead: 0.5, dyn: [[B(3), 0.0], [B(5), 0.0], [B(5) + 0.5, 0.35], [B(7), 0.0], [B(9) + 0.5, 0.4], [B(11), 0.0], [B(13) + 0.5, 0.45], [B(15), 0.1], [B(17) + 0.5, 0.45], [B(19), 0.25], [B(27), 0.5], [B(35), 0.2], [B(39), 0.0]] },
  { id: 'vn1', inst: 'vn1', art: 'leg', notes: line(TOP, B(19), 12), dyn: [[B(19), 0.45], ...swell(B(19), B(27), 0.45, 0.62, 0.5), ...swell(B(27), B(35), 0.52, 0.72, 0.3)] },
  { id: 'str', inst: 'va', art: 'sus', notes: pad(at(CH, B(19)), 'C3', 'C5', 3), lead: 0.3, dyn: [[B(19), 0.35], [B(27), 0.5], [B(34), 0.4], [B(35), 0.0]] },
  { id: 'cb', inst: 'cb', art: 'sus', notes: bass(at(CH, B(19)), 'C2', 'B2'), lead: 0.3, dyn: [[B(19), 0.35], [B(27), 0.5], [B(35), 0.0]] },
  { id: 'vc', inst: 'vc', art: 'leg', notes: line('A3:4 | A3:4 | B3:2 G3:2 | A3:4 | A3:4 | G3:4 | A3:2 B3:2 | C4:4 | E4:4 | D4:4 | C4:2 B3:2 | C4:4 | D4:4 | C4:4 | B3:4 | A3:4', B(19)), dyn: [[B(19), 0.4], [B(27), 0.55], [B(35), 0.3]] },
];
const cue: Cue = { id: 'dawn_chorale', title: 'Dawn Chorale', tags: ['dawn', 'terrace'], tempo, parts, seconds: tempo.s(B(39)) + 2, lufs: -20, harmony: H };
export default cue;
