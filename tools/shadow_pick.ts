// §13.11 shadow sampling (tools/shadow_days.ts): a person's day is drawn only among days on which the person is alive and
// here (S1 of REVIEWS/shadow_phase5_r3.md: a dead guard was once drawn for a day twelve days after his death).
export interface PresenceLike { present(pid: number, d: number): boolean }
/** draw days with `draw` until the person is present; -1 when none is found in `tries` draws */
export function presentDay(P: PresenceLike, pid: number, draw: () => number, tries = 400): number {
  for (let k = 0; k < tries; k++) { const d = draw(); if (P.present(pid, d)) return d; }
  return -1;
}
