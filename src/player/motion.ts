// The walk's feel (s17 C9, D-630): a body with weight under a first-person camera (brief §1.1 presence through the body,
// §6 the player). Pure functions and small state, no three or Rapier: player.ts drives the gait, main.ts places the camera
// with Head, tests/walk_feel.test.ts measures both.
//  - Paces (C: human-factors values): careful 0.8 m/s, walking 1.35 m/s (the default), brisk 1.95 m/s (the "walk faster"
//    key; the brief's "no sprinting across the world": the old run of 3.2 m/s was a jog). Crouched 0.7 m/s.
//  - Inertia: the body reaches walking pace in ~0.45 s (about one step) and stops in ~0.25 s (half a step): acceleration
//    limited, never a sliding camera that starts and stops on the frame.
//  - Slopes and stairs: uphill slows the body (×1 / (1 + 0.8 grade), on top of what the controller loses on a slope: a
//    grade of 0.5 is climbed at ~0.7 m/s along the ground, Tobler-like; the Grand Stair, grade 0.35, at ~1 m/s
//    along the ground) and shortens the stride toward one tread a step, so the head's rhythm follows the
//    low risers; downhill slows a little less.
//  - The head (camera offset, never roll): a vertical bob lowest at each footfall (±1.8 cm at walking pace and above, D-238,
//    T-K3 ≤ 2 cm), a lateral sway once a stride (±1.1 cm), both scaled by speed and eased so the head settles in ~0.3 s when
//    the body stops (until s17 the bob froze wherever the phase stopped); a landing dip by the height fallen; breath at rest
//    (3 mm, 15 a minute). Crouching (player.ts) lowers the eye to 1.05 m over ~0.25 s.

export type Pace = 'careful' | 'walk' | 'brisk';
/** walking speeds (m/s) per pace; crouched walking is CROUCH_SPEED */
export const PACE: Record<Pace, number> = { careful: 0.8, walk: 1.35, brisk: 1.95 };
export const CROUCH_SPEED = 0.7;
/** acceleration toward a faster wish and deceleration toward a slower one (m/s²) */
export const ACCEL = 3.2, DECEL = 5.5;
/** one step on level ground (m): two steps a stride */
export const STRIDE_STEP = 0.75;
/** head motion (m): the vertical bob (D-238: ±1.8 cm; T-K3 ≤ 2 cm), the lateral sway, the breath at rest */
export const BOB_AMP = 0.018, SWAY_AMP = 0.011, BREATH_AMP = 0.003;
/** the eye standing (EYE_HEIGHT in player.ts) and crouched (m) */
export const CROUCH_EYE = 1.05;

export interface V2 { x: number; z: number }
/** move the horizontal velocity v toward the wish w, acceleration limited (ACCEL when the wish is at least as fast as the
 *  body, DECEL when slower); returns v (mutated) */
export function approach(v: V2, w: V2, dt: number): V2 {
  const dx = w.x - v.x, dz = w.z - v.z, d = Math.hypot(dx, dz); if (d < 1e-9) return v;
  const faster = Math.hypot(w.x, w.z) >= Math.hypot(v.x, v.z) - 1e-6;
  const step = (faster ? ACCEL : DECEL) * dt;
  if (d <= step) { v.x = w.x; v.z = w.z; } else { v.x += dx / d * step; v.z += dz / d * step; }
  return v;
}
/** the speed factor on a grade (rise over run along the motion; > 0 uphill) */
export function slopeFactor(grade: number): number {
  const g = Math.min(1, Math.abs(grade)); return grade > 0 ? 1 / (1 + 0.8 * g) : 1 / (1 + 0.4 * g);
}
/** the step length on a grade: shorter climbing or descending (stairs: toward one tread a step), never under 0.3 m */
export function stepLength(grade: number): number { return Math.max(0.3, STRIDE_STEP / (1 + 3 * Math.min(1, Math.abs(grade)))); }

export interface HeadIn {
  /** the step phase (player.bobPhase: π a step) */
  phase: number;
  /** the body's horizontal speed (m/s) */
  speed: number;
  grounded: boolean;
  /** the height just fallen when the body landed this frame (m), else 0 */
  landed: number;
  /** the head-bob setting (comfort): off, the eye stays level (the crouch is the eye height's, player.eye) */
  bob: boolean;
}
export interface HeadOut { x: number; y: number; z: number }
export class Head {
  /** walking amount, eased (0 still … 1 walking pace or faster) */
  amt = 0;
  /** the landing dip (m, ≤ 0): its depth and the time since the landing */
  dip = 0; private dipPeak = 0; private dipT = 1e9;
  t = 0;
  readonly out: HeadOut = { x: 0, y: 0, z: 0 };
  /** the camera offset from the eye (world metres) for this frame; yaw: the view's yaw (0 looks to −Z) */
  update(dt: number, s: HeadIn, yaw: number): HeadOut {
    this.t += dt;
    const target = s.grounded ? Math.min(1, s.speed / PACE.walk) ** 0.8 : 0;
    this.amt += (target - this.amt) * Math.min(1, dt / (target > this.amt ? 0.2 : 0.12));
    if (s.landed > 0.25) { this.dipPeak = Math.min(0.1, 0.025 + 0.03 * s.landed); this.dipT = 0; } else this.dipT += dt;
    // a critically damped knee (ω = 14 rad/s), in closed form: the dip peaks ~70 ms after the landing, gone in ~0.4 s
    const wt = 14 * this.dipT; this.dip = -this.dipPeak * Math.E * wt * Math.exp(-wt);
    let y = 0, side = 0;
    if (s.bob) {
      const a = this.amt;
      y += -BOB_AMP * a * Math.cos(2 * s.phase); // lowest at each footfall (phase = kπ)
      side = SWAY_AMP * a * Math.sin(s.phase); // over the stance foot, once a stride
      y += BREATH_AMP * (1 - a) * Math.sin(this.t * 2 * Math.PI * 0.25);
      y += this.dip;
    }
    // the view's right is (cos yaw, 0, −sin yaw)
    this.out.x = side * Math.cos(yaw); this.out.z = -side * Math.sin(yaw); this.out.y = y;
    return this.out;
  }
}
