// D-395 (UD-21, UD-25: the world reacts to you): the render side of two simulation hooks the cloud left (D-385, D-379).
//   - on sight: PeopleSim.strangerSeen(near, at) says how each person within ~12 m reacts to the stranger (greet, bow, nod,
//     stare, avoid, ignore; a village child who stares may tag along: the sim lays that as the talk's 'follow' deed, so the
//     walking is the plan's); the crowd polls it about once a second while there is a player and plays the kind here;
//   - on a shout: converse/earshot.ts `look` (state.heard.look; __converse.say(text, heardMs, rmsDb)) names those in earshot
//     who turn to look; their heads (and a little of the chest) turn to the speaker for a few seconds.
// Pure pose layers over whatever the person is doing (head, neck and chest only, plus a raised hand for a greeting by name
// when the hands are free): the work goes on beneath. Tier C: the gestures are this module's reading of the manners
// (a bow from the chest for rank; the eyes kept down and the head turned away for distrust; a long look from the curious).
import type { Pose } from './anim';
import type { Sight, SightKind } from './converse/sight';

export type ReactKind = Exclude<SightKind, 'ignore'> | 'turn';
export interface React { kind: ReactKind; t0: number; until: number; /** world point looked at (or away from) */ at: [number, number, number]; byName?: boolean; follow?: boolean }
/** how long each reaction is played (s, render clock) */
export const REACT_S: Record<ReactKind, number> = { greet: 3.2, bow: 2.6, nod: 1.8, stare: 7, avoid: 4.5, turn: 3.2 };
/** the same reaction is not played again for a person within this time (s): a poll every second must not restart it */
export const REACT_AGAIN_S = 45;
/** the poll period of strangerSeen (s, render clock: "a few times a game minute" at the game's pace) */
export const SIGHT_POLL_S = 1;

const ss = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x: number, a: number) => Math.max(-a, Math.min(a, x));
type Key = number | string;

export class Reactions {
  readonly on = new Map<Key, React>();
  private last = new Map<string, number>();
  nextPoll = 0;
  /** the render clock (s): set by the crowd each frame, the time a hook from outside the frame (the talk) starts at */
  clock = 0;
  /** what was played (out of world: the dev overlay and the tests) */
  readonly played: { key: Key; kind: ReactKind; t: number }[] = [];
  private start(key: Key, kind: ReactKind, now: number, at: [number, number, number], more: Partial<React> = {}) {
    const lk = `${key}:${kind}`, l = this.last.get(lk); const cur = this.on.get(key);
    if (cur && cur.kind === kind && now < cur.until) { cur.at = at; return false; } // (still playing: follow the stranger's place)
    if (kind !== 'turn' && l !== undefined && now - l < REACT_AGAIN_S) return false;
    if (this.last.size > 4000) for (const [k, t] of this.last) if (now - t >= REACT_AGAIN_S) this.last.delete(k);
    this.last.set(lk, now); this.on.set(key, { kind, t0: now, until: now + REACT_S[kind], at, ...more });
    this.played.push({ key, kind, t: now }); if (this.played.length > 200) this.played.splice(0, 100); return true;
  }
  /** the sim's sightings (PeopleSim.strangerSeen) played from `now`, toward the stranger at `at` (world x, y of the eyes, z) */
  fromSights(sights: readonly Sight[], now: number, at: [number, number, number]): number {
    let n = 0; for (const s of sights) if (s.kind !== 'ignore' && this.start(s.pid, s.kind, now, at, { byName: s.byName, follow: s.follow })) n++; return n;
  }
  /** a shout heard (earshot.ts Heard.look): those named turn to the speaker */
  fromHeard(look: readonly { pid: number }[], speaker: [number, number, number], now = this.clock): number {
    let n = 0; for (const l of look) if (this.start(l.pid, 'turn', now, speaker)) n++; return n;
  }
  /** a reaction played on anyone (the lab's extras have no pid: they go by their key) */
  play(key: Key, kind: ReactKind, now: number, at: [number, number, number], more: Partial<React> = {}) { return this.start(key, kind, now, at, more); }
  active(key: Key, now: number): React | null {
    const r = this.on.get(key); if (!r) return null; if (now >= r.until) { this.on.delete(key); return null; } return r;
  }
}

/** the reaction laid over a pose at `time`. `L` is the point in the person's character space (+z ahead, +x to the side the
 *  head yaw turns to), `eyeY` the eyes' height there; `free` when the hands hold nothing. Returns whether the eyes go to
 *  the point (avoid: they do not) */
export function reactPose(r: React, time: number, po: Pose, L: ArrayLike<number>, eyeY: number, free = false): boolean {
  const u = time - r.t0, dur = r.until - r.t0;
  const yawT = Math.atan2(L[0], Math.max(0.05, L[2])), behind = L[2] < 0, pitT = clamp(Math.atan2(eyeY - L[1], Math.hypot(L[0], L[2])), 0.45);
  const fast = r.kind === 'turn' ? 0.22 : r.kind === 'avoid' ? 0.6 : 0.4, e = ss(0, fast, u) * (1 - ss(dur - 0.6, dur, u));
  const h = po.rot.head ?? [0, 0, 0], n = po.rot.neck ?? [0, 0, 0], c = po.rot.chest ?? [0, 0, 0];
  // the head takes what it can of the turn (±1.1 rad); the chest the rest, a little (a person turns from the waist to look behind)
  const hy = clamp(yawT, 1.1), cy = clamp(yawT - hy, 0.5) + (behind ? Math.sign(yawT) * 0.2 : 0);
  const mixH = (yaw: number, pitch: number, roll = 0) => { po.rot.head = [h[0] * (1 - e) + pitch * e, h[1] * (1 - e) + yaw * e, h[2] * (1 - e) + roll * e]; po.rot.neck = [n[0] * (1 - 0.5 * e), n[1] * (1 - e), n[2] * (1 - 0.5 * e)]; };
  const nodAt = (t0: number, len: number, amp: number) => (u > t0 && u < t0 + len ? amp * Math.sin((Math.PI * (u - t0)) / len) : 0);
  switch (r.kind) {
    case 'turn': mixH(0.85 * hy, 0.5 * pitT); po.rot.chest = [c[0], c[1] + (0.35 * Math.sign(yawT) * Math.min(1, Math.abs(yawT)) * 0.5 + cy) * e, c[2]]; return true;
    case 'stare': mixH(hy, 0.6 * pitT, 0.07); po.rot.chest = [c[0], c[1] + cy * e, c[2]]; return true;
    case 'nod': mixH(0.8 * hy, 0.4 * pitT + nodAt(0.35, 0.7, 0.2)); return true;
    case 'greet': { mixH(hy, 0.4 * pitT + nodAt(0.3, 0.8, 0.24) + nodAt(1.2, 0.6, 0.12)); po.rot.chest = [c[0] + 0.06 * e, c[1] + cy * e, c[2]];
      if (r.byName && free) { const a = ss(0.2, 0.6, u) * (1 - ss(1.6, 2.1, u)); po.rot.r_upper = [-1.0 * a, 0, -0.25 * a]; po.rot.r_fore = [-1.1 * a, 0, 0.2 * a]; po.rot.r_hand = [0, 0, 0]; }
      return true; }
    case 'bow': { const b = ss(0.3, 0.9, u) * (1 - ss(1.7, 2.4, u)); mixH(0.5 * hy, 0.2 * b);
      po.rot.chest = [c[0] + 0.32 * b, c[1] + 0.5 * cy * e, c[2]]; const s = po.rot.spine ?? [0, 0, 0]; po.rot.spine = [s[0] + 0.12 * b, s[1], s[2]];
      if (free) { po.rot.r_upper = [-0.35 * b, 0, -0.35 * b]; po.rot.r_fore = [-1.5 * b, 0, 0.5 * b]; } // (the right hand to the breast: C)
      return true; }
    case 'avoid': mixH(-Math.sign(yawT || 1) * 0.55, 0.3); po.rot.chest = [c[0], c[1] - Math.sign(yawT || 1) * 0.15 * e, c[2]]; return false;
  }
}
