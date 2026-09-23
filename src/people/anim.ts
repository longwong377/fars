// Procedural animation for people (Phase 3). Each activity's performance is a pose function of time (and gait phase
// for moving activities): bone rotations (Euler XYZ, radians, relative to the bind pose) plus a hips offset.
// Conventions (bind pose: arms and legs hang down −Y, the body faces +Z): rotation.x < 0 swings a limb forward;
// a knee bends with shin.x > 0; an elbow bends with fore.x < 0; left arm abducts with +z, right arm with −z.
// PLACEHOLDER quality: hand-authored cycles, not motion capture (brief §9.3 asks for photoreal; logged in PROGRESS).
// The cycles drive 17 pose channels; src/people/humanRig.ts retargets them onto the 59-bone MakeHuman skeleton (D-090).

/** pose channels (the Phase 3 rig's bones); RETARGET in humanRig.ts maps each onto the 59-bone skeleton */
export const POSE_BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'l_upper', 'l_fore', 'l_hand', 'r_upper', 'r_fore', 'r_hand', 'l_thigh', 'l_shin', 'l_foot', 'r_thigh', 'r_shin', 'r_foot'] as const;
export type PoseBone = typeof POSE_BONES[number];
type BoneName = PoseBone;

export type AnimId = 'idle' | 'walk' | 'carry_shoulder' | 'carry_head' | 'carry_front' | 'guard' | 'guard_walk' | 'chisel' | 'grind' | 'knead'
  | 'bake' | 'draw_water' | 'write' | 'eat' | 'sleep' | 'talk' | 'sit' | 'dice' | 'inspect' | 'play';
export type E3 = [number, number, number];
export interface Pose { rot: Partial<Record<BoneName, E3>>; hips: E3; /** strike/impact event this frame (for tool sounds) */ hit?: boolean }

const S = Math.sin, C = Math.cos, PI = Math.PI;
const fr = (x: number) => x - Math.floor(x);
/** smooth pseudo-random in [-1,1] (for idle fidgets): sum of incommensurate sines */
const wob = (t: number, k: number) => 0.6 * S(t * 0.37 + k * 1.7) + 0.4 * S(t * 0.91 + k * 4.1);

function legsWalk(p: Pose, ph: number, amp: number) {
  const r = p.rot;
  r.l_thigh = [-amp * S(ph), 0, 0]; r.r_thigh = [amp * S(ph), 0, 0];
  r.l_shin = [0.1 + 0.9 * amp * Math.max(0, C(ph)) ** 1.5, 0, 0]; r.r_shin = [0.1 + 0.9 * amp * Math.max(0, -C(ph)) ** 1.5, 0, 0];
  r.l_foot = [-0.2 * S(ph), 0, 0]; r.r_foot = [0.2 * S(ph), 0, 0];
  p.hips = [0.02 * S(ph), -0.025 + 0.02 * C(2 * ph), 0];
  r.hips = [0, 0.08 * S(ph), 0]; r.spine = [0.03, -0.05 * S(ph), 0];
}
function kneel(p: Pose, lean: number) {
  const r = p.rot; p.hips = [0, -0.45, -0.05];
  r.l_thigh = [-0.1, 0, 0.04]; r.r_thigh = [-0.1, 0, -0.04]; r.l_shin = [PI / 2 + 0.1, 0, 0]; r.r_shin = [PI / 2 + 0.1, 0, 0];
  r.l_foot = [0.9, 0, 0]; r.r_foot = [0.9, 0, 0]; r.spine = [lean * 0.5, 0, 0]; r.chest = [lean * 0.5, 0, 0]; r.neck = [-lean * 0.5, 0, 0];
}
function sitCross(p: Pose) {
  const r = p.rot; p.hips = [0, -0.8, -0.05];
  r.l_thigh = [-1.45, 0, 0.75]; r.r_thigh = [-1.45, 0, -0.75]; r.l_shin = [2.35, 0, 0]; r.r_shin = [2.35, 0, 0]; r.l_foot = [-0.4, 0, 0]; r.r_foot = [-0.4, 0, 0];
}

/** pose for an animation at time t (s); `ph` = gait phase (radians) for moving anims; `k` = per-person seed */
export function pose(id: AnimId, t: number, ph: number, k: number): Pose {
  const p: Pose = { rot: {}, hips: [0, 0, 0] }; const r = p.rot;
  const breath = 0.025 * S(t * 1.5 + k);
  r.chest = [breath, 0, 0];
  switch (id) {
    case 'idle': case 'inspect': {
      p.hips = [0.015 * wob(t * 0.5, k), 0, 0]; r.hips = [0, 0, 0.02 * wob(t * 0.5, k)];
      r.l_upper = [0.05, 0, 0.08]; r.r_upper = [0.05, 0, -0.08]; r.l_fore = [-0.15, 0, 0]; r.r_fore = [-0.15, 0, 0];
      if (id === 'inspect') { r.l_upper = [0.25, 0, 0.12]; r.r_upper = [0.25, 0, -0.12]; r.l_fore = [-0.9, 0, -0.5]; r.r_fore = [-0.9, 0, 0.5]; } // hands clasped behind
      r.head = [0.05 * wob(t, k + 3), 0.45 * wob(t * 0.6, k + 7), 0]; break;
    }
    case 'walk': case 'carry_shoulder': case 'carry_head': case 'carry_front': case 'guard_walk': {
      legsWalk(p, ph, id === 'walk' ? 0.42 : 0.34);
      r.l_upper = [0.3 * S(ph), 0, 0.06]; r.r_upper = [-0.3 * S(ph), 0, -0.06]; r.l_fore = [-0.25 - 0.15 * Math.max(0, -S(ph)), 0, 0]; r.r_fore = [-0.25 - 0.15 * Math.max(0, S(ph)), 0, 0];
      if (id === 'carry_shoulder') { r.r_upper = [-2.7, 0, -0.35]; r.r_fore = [-1.1, 0, 0]; r.head = [0, 0.1, -0.12]; }
      if (id === 'carry_head') { r.l_upper = [-2.9, 0, 0.35]; r.l_fore = [-0.9, 0, 0]; r.neck = [0, 0, 0]; r.spine = [-0.03, 0, 0]; }
      if (id === 'carry_front') { r.l_upper = [-0.5, 0, 0.1]; r.r_upper = [-0.5, 0, -0.1]; r.l_fore = [-1.2, 0, -0.3]; r.r_fore = [-1.2, 0, 0.3]; }
      if (id === 'guard_walk') { r.r_upper = [-0.25, 0, -0.1]; r.r_fore = [-1.25, 0, 0]; }
      r.head = [0.04 * S(2 * ph), 0.2 * wob(t * 0.4, k), 0]; break;
    }
    case 'guard': {
      p.hips = [0.01 * wob(t * 0.2, k), 0, 0];
      r.r_upper = [-0.25, 0, -0.1]; r.r_fore = [-1.25, 0, 0]; r.l_upper = [-0.15, 0, 0.12]; r.l_fore = [-1.1, 0, -0.35];
      r.head = [0, 0.3 * wob(t * 0.25, k), 0]; break;
    }
    case 'chisel': {
      const q = fr(t * 1.25 + k), s = q < 0.78 ? q / 0.78 : 1 - (q - 0.78) / 0.22; p.hit = q < 0.03;
      p.hips = [0, -0.06, -0.05]; r.l_thigh = [-0.25, 0, 0.1]; r.r_thigh = [-0.25, 0, -0.1]; r.l_shin = [0.3, 0, 0]; r.r_shin = [0.3, 0, 0];
      r.spine = [0.3, 0, 0]; r.chest = [0.25 + breath, 0, 0]; r.neck = [-0.2, 0, 0]; r.head = [0.1, 0, 0];
      r.l_upper = [-0.6, 0, 0.15]; r.l_fore = [-0.7, 0, 0];
      r.r_upper = [-0.7 - 1.1 * s, 0, -0.2]; r.r_fore = [-0.6 - 0.6 * s, 0, 0]; break;
    }
    case 'grind': case 'knead': {
      const sp = id === 'grind' ? 0.9 : 0.6, s = S(t * sp * 2 * PI + k); kneel(p, 0.55 + 0.12 * s);
      r.l_upper = [-1.0 - 0.3 * s, 0, 0.12]; r.r_upper = [-1.0 - 0.3 * s, 0, -0.12]; r.l_fore = [-0.4 + 0.25 * s, 0, 0]; r.r_fore = [-0.4 + 0.25 * s, 0, 0];
      p.hit = id === 'grind' && fr(t * sp + k / (2 * PI)) < 0.03; break;
    }
    case 'bake': {
      const q = fr(t * 0.15 + k), reach = q < 0.3 ? S(q / 0.3 * PI) : 0; kneel(p, 0.35 + 0.3 * reach);
      r.r_upper = [-0.8 - 0.7 * reach, 0, -0.1]; r.r_fore = [-0.6 + 0.4 * reach, 0, 0]; r.l_upper = [-0.4, 0, 0.15]; r.l_fore = [-1.2, 0, 0]; break;
    }
    case 'draw_water': {
      const q = fr(t * 0.1 + k), dip = q < 0.5 ? S(q * 2 * PI) ** 2 : 0;
      p.hips = [0, -0.15 * dip, -0.1 * dip]; r.l_thigh = [-0.5 * dip, 0, 0]; r.r_thigh = [-0.5 * dip, 0, 0]; r.l_shin = [0.8 * dip, 0, 0]; r.r_shin = [0.8 * dip, 0, 0];
      r.spine = [0.6 * dip, 0, 0]; r.chest = [0.4 * dip, 0, 0]; r.l_upper = [-0.8 * dip - 0.2, 0, 0.1]; r.r_upper = [-0.8 * dip - 0.2, 0, -0.1]; r.l_fore = [-0.4, 0, -0.2]; r.r_fore = [-0.4, 0, 0.2]; break;
    }
    case 'write': {
      sitCross(p); r.spine = [0.25, 0, 0]; r.neck = [0.25, 0, 0]; r.head = [0.15, 0, 0];
      r.l_upper = [-0.4, 0, 0.1]; r.l_fore = [-1.3, 0, -0.2];
      const w = 0.05 * S(t * 7 + k) * (fr(t * 0.2 + k) < 0.8 ? 1 : 0); r.r_upper = [-0.45, 0, -0.1]; r.r_fore = [-1.35 + w, 0, 0.25 + w]; break;
    }
    case 'eat': {
      sitCross(p); const q = fr(t * 0.12 + k), bite = q < 0.25 ? S(q / 0.25 * PI) : 0;
      r.r_upper = [-0.4 - 0.5 * bite, 0, -0.15]; r.r_fore = [-0.8 - 1.2 * bite, 0, 0.2]; r.l_upper = [-0.3, 0, 0.1]; r.l_fore = [-1.0, 0, 0]; r.head = [0.1 * bite, 0.3 * wob(t * 0.3, k), 0]; break;
    }
    case 'sit': case 'dice': {
      sitCross(p); r.l_upper = [-0.3, 0, 0.1]; r.r_upper = [-0.3, 0, -0.1]; r.l_fore = [-0.9, 0, 0]; r.r_fore = [-0.9, 0, 0]; r.spine = [0.12, 0, 0];
      r.head = [0.1, 0.35 * wob(t * 0.4, k), 0];
      if (id === 'dice') { const q = fr(t * 0.2 + k), th = q < 0.15 ? S(q / 0.15 * PI) : 0; p.hit = q > 0.14 && q < 0.16; r.spine = [0.35, 0, 0]; r.r_upper = [-0.9 - 0.4 * th, 0, -0.1]; r.r_fore = [-0.6 + 0.4 * th, 0, 0]; r.head = [0.3, 0, 0]; }
      break;
    }
    case 'sleep': { p.hips = [0, -0.83, 0]; r.hips = [-PI / 2, 0, 0]; r.l_upper = [0, 0, 0.1]; r.r_upper = [0, 0, -0.1]; r.head = [0.2, 0.2, 0]; r.chest = [breath * 0.6, 0, 0]; r.l_shin = [0.2, 0, 0]; r.r_shin = [0.1, 0, 0]; break; }
    case 'talk': {
      const g = Math.max(0, wob(t * 1.3, k)); p.hips = [0.015 * wob(t * 0.5, k), 0, 0];
      r.r_upper = [-0.3 - 0.5 * g, 0, -0.15]; r.r_fore = [-0.8 - 0.4 * g, 0.3 * wob(t * 2, k), 0]; r.l_upper = [0.05, 0, 0.08]; r.l_fore = [-0.2 - 0.5 * Math.max(0, wob(t * 1.1, k + 5)), 0, 0];
      r.head = [0.08 * wob(t * 2.1, k), 0.15 * wob(t * 0.9, k), 0.05 * wob(t * 1.4, k)]; break;
    }
    case 'play': { // chasing/hopping in place (children)
      const ph2 = t * 7 + k; legsWalk(p, ph2, 0.6); p.hips[1] += 0.05 * Math.abs(S(ph2)); r.l_upper = [0.6 * S(ph2), 0, 0.3]; r.r_upper = [-0.6 * S(ph2), 0, -0.3]; break;
    }
  }
  return p;
}
export const ANIMS: AnimId[] = ['idle', 'walk', 'carry_shoulder', 'carry_head', 'carry_front', 'guard', 'guard_walk', 'chisel', 'grind', 'knead', 'bake', 'draw_water', 'write', 'eat', 'sleep', 'talk', 'sit', 'dice', 'inspect', 'play'];
