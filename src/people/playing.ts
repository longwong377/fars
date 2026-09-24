// What a performer is seen doing while the music system has them play or sing (D-200; the music: src/audio/performers.ts,
// SOUNDSCAPE §8). A playing performance is given in place of the plan's activity for as long as the music director keeps
// it alive (crowd.ts `setPlaying`), with the instrument in hand (props.ts: the instruments' class) and a playing cycle
// (workAnims.ts: plucking, striking, fingering, singing). 'sing_work' changes nothing but the face and the breath: a woman
// singing at her quern keeps grinding, a mason at his block keeps dressing it.
// The activity lint (npm run lint:activity) checks this registry as it checks the activities: every cycle and prop exists,
// every entry has a tier and a note, none is a placeholder.
import type { Performance } from './activities';
import type { InstrumentId } from '../audio/instruments';

export type PlayKind = 'harp_v' | 'harp_h' | 'lyre' | 'frame_drum' | 'double_pipe' | 'reed_pipe' | 'sing' | 'sing_work';
/** a playing performance (as activities.ts Performance; `sing_work` has no cycle of its own) */
export type PlayPerformance = Omit<Performance, 'anim'> & { anim?: Performance['anim'] };
export const PLAYING: Record<PlayKind, PlayPerformance> = {
  harp_v: { anim: 'harp_v', prop: 'harp_v', tier: 'C', note: 'playing the vertical angular harp standing, both hands plucking from either side of the strings (the type and the standing players: the Madaktu relief, M-19, B; the hold and the strokes C)' },
  harp_h: { anim: 'harp_h', prop: 'harp_h', prop2: 'plectrum', tier: 'C', note: 'playing the horizontal angular harp standing, the soundbox under the left arm, a plectrum in the right hand (M-19, M-21; hold and strokes C)' },
  lyre: { anim: 'lyre', prop: 'lyre', prop2: 'plectrum', tier: 'C', note: 'playing the lyre standing, a plectrum in the right hand, the left hand behind the strings (C)' },
  frame_drum: { anim: 'frame_drum', prop: 'frame_drum', tier: 'C', note: 'beating the frame drum held upright in the left hand, the right striking the middle or the rim (C)' },
  double_pipe: { anim: 'double_pipe', prop: 'double_pipe', tier: 'C', note: 'playing the double pipe standing, a cane in each hand (two at Madaktu: M-19, B type; the hold C)' },
  reed_pipe: { anim: 'reed_pipe', prop: 'reed_pipe', tier: 'C', note: 'a herder playing a cane reed pipe, sitting on the ground (herdsmen with pipes: Iliad 18.525-526, M-18, B for the Greek world; M-10; C here)' },
  sing: { anim: 'sing', tier: 'C', note: 'singing standing, the hands joined in front; the jaw opens on each sung note and the chest draws breath before each phrase (the rig has a jaw and no lips: no vowel shapes; C)' },
  sing_work: { tier: 'C', note: 'singing at work: the work goes on; the jaw opens on the sung notes and the chest draws breath before each phrase (C)' },
};
/** what a performer is seen doing for an instrument of the music system (the voice: standing singers; at work, the
 *  performer keeps the work: `sing_work`) */
export function playKindFor(instrument: InstrumentId, atWork = false): PlayKind {
  switch (instrument) {
    case 'harp': return 'harp_v';
    case 'lyre': return 'lyre';
    case 'double_pipe': return 'double_pipe';
    case 'reed_pipe': return 'reed_pipe';
    case 'frame_drum': return 'frame_drum';
    case 'voice': return atWork ? 'sing_work' : 'sing';
    default: return 'sing_work'; // (the lute and the clappers are not modelled: nobody plays them in the world)
  }
}
/** the jaw (rad) and the breath (0 … 1, the chest's intake) of a singer at `t` s into a piece whose sung notes are
 *  [start, end] pairs (s): the jaw opens over 60 ms at each note, holds (a vowel's opening, set per phrase by `open`), and
 *  closes in the gaps; before a note that follows a gap of 0.3 s or more the chest draws breath for 0.3 s (C) */
export function singFace(notes: ArrayLike<number>, t: number, open = 0.14): { jaw: number; breath: number } {
  let jaw = 0, breath = 0;
  for (let i = 0; i < notes.length; i += 2) {
    const a = notes[i], b = notes[i + 1];
    if (t >= a - 0.06 && t < b + 0.08) jaw = Math.max(jaw, open * Math.min(1, (t - a + 0.06) / 0.06) * Math.min(1, (b + 0.08 - t) / 0.08));
    const gap = i === 0 ? 1 : a - notes[i - 1];
    if (gap >= 0.3 && t >= a - 0.35 && t < a) breath = Math.max(breath, Math.sin(Math.PI * (t - a + 0.35) / 0.35));
    if (a > t + 0.4) break;
  }
  return { jaw, breath };
}
