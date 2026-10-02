// First-person player at human scale (brief §6 The player, §1.1 presence): walk 1.35 m/s, a careful 0.8 and a brisk 1.95
// (s17 D-630: no sprinting across the world, no fast travel, no flying; the gait, inertia, slopes and head: motion.ts);
// correct step-up for the Terrace's shallow stairs (autostep ≤ 0.4 m); crouching (a 1.1 m capsule) under low lintels;
// can fall off the Terrace edge; capsule collision.
// Step-up: Rapier's autostep did not lift the capsule in our setup (measured, tools/dev/tmp: only what the round capsule
// bottom slides over, ~0.24 m head-on and ~0.12 m at 60°), while the walkable grid lets people route over steps up to
// NAV.maxStep. So a blocked, grounded move tries an explicit step: shape-cast up, across past the edge, down onto the top.
import type RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from './physics';
import { NAV } from '../people/navgrid';
import { PACE, CROUCH_SPEED, CROUCH_EYE, approach, slopeFactor, stepLength, type Pace } from './motion';

export const WALK_SPEED = PACE.walk; // m/s — typical unhurried adult walking pace (C: common human-factors value)
/** the "walk faster" key: a brisk walk (D-630; was a 3.2 m/s jog). The walk bots keep 3.2 m/s through Player.botSpeed */
export const RUN_SPEED = PACE.brisk;
export const EYE_HEIGHT = 1.6, CAPSULE_R = 0.25, CAPSULE_HALF = 0.6; // capsule total 1.7 m
/** crouched: capsule total 1.1 m (half segment 0.3) */
export const CROUCH_HALF = 0.3;
/** highest step the player climbs: the walkable grid's step limit, so every route people take is walkable by the player */
export const STEP_UP = NAV.maxStep;
/** stalled this long (s), the body looks for a way round */
const STALL_PROBE = 0.25;
/** how far the walk turns aside round someone met head-on (rad) */
const DODGE_ANGLE = (55 * Math.PI) / 180;
/** the step-up glide's spring (rad/s) */
const STEP_EASE_W = 13, STEP_EASE_WXZ = 7;
/** a step's top must offer this much standing depth beyond the edge (C: about a forefoot) */
const STEP_MIN_DEPTH = 0.12;
/** how far a step-up carries the capsule's centre across (m): past the edge by a forefoot, else by less on short treads */
const STEP_REACH = [CAPSULE_R + 0.02 + STEP_MIN_DEPTH, 0.33, 0.29];
const OFFSET = 0.02; // character-controller skin
/** a contact normal at least this upright is floor (the 42° climb limit) */
const FLOOR_NY = Math.cos((42 * Math.PI) / 180);
/** safety net (audit D M1): feet this far below the drawn ground mean the body has passed through it. No walkable floor
 *  lies more than 0.56 m below the terrain surface (measured over the 1.41 M walkable cells of the nav grid, session 8) */
export const RESCUE_DEPTH = 1.0;
export interface Rescue { x: number; z: number; depth: number; n: number }
export interface PlayerInput { forward: number; right: number; run: boolean; yaw: number; pitch: number;
  /** the careful pace (held) */
  slow?: boolean;
  /** crouch wanted (the body stands up again only where there is room) */
  crouch?: boolean }
/** a footfall (one per step while grounded): for the footsteps' sound (C8) and the tests */
export interface Footfall { foot: 0 | 1; speed: number; pace: Pace; crouched: boolean; stair: boolean; x: number; y: number; z: number }

export class Player {
  body: RAPIER.RigidBody; collider: RAPIER.Collider; controller: RAPIER.KinematicCharacterController;
  vy = 0; grounded = false; yaw = 0; pitch = 0; bobPhase = 0; distanceWalked = 0; fallStartY: number | null = null; lastFall = 0; maxFall = 0;
  /** eye offset left by a step-up (and, vertically, by every rise and drop walked), eased back to zero so the camera glides
   *  instead of popping (render only): a critically damped spring (D-630; was an exponential on step-ups only, whose first
   *  frame jumped the eye 3-4 cm up a two-riser step, and the controller's own slides up a riser were not eased at all) */
  stepEase = { x: 0, y: 0, z: 0 }; private stepEaseV = { x: 0, y: 0, z: 0 }; steps = 0;
  private eyeXZ = { x: 0, z: 0, vx: 0, vz: 0, init: false };
  /** times the safety net put the body back on the ground, and the last one (a real bug if ever > 0: tests assert 0) */
  rescues = 0; lastRescue: Rescue | null = null;
  /** moves retried level after a floor-only stop (see update) */
  levelRetries = 0;
  /** the body's horizontal velocity (m/s; inertia: motion.ts approach) and its realised speed last update */
  vel = { x: 0, z: 0 }; speed = 0; pace: Pace = 'walk';
  /** the grade under the feet along the motion (rise / run, smoothed; > 0 uphill) */
  grade = 0; private gRise = 0; private gRun = 0;
  /** crouched now (the collider), and the eye's eased crouch (0 … 1) */
  crouched = false; crouchEase = 0; private half = CAPSULE_HALF;
  private shapes: { stand: RAPIER.Shape; crouch: RAPIER.Shape };
  /** the height fallen at the last landing, set for the one update it happened in (the head's landing dip) */
  landed = 0;
  /** the walk bots' pace (m/s) in place of the paces, and inertia off for them (their steering is yaw only) */
  botSpeed: number | null = null;
  /** called at each footfall */
  /** easing past someone met head-on: the time left and the turn's sign (away from the side the other stands to) */
  dodgeT = 0; private dodgeSide = -1; private dodgeA = 0;
  /** wanting to walk and getting nowhere (s): past STALL_PROBE the body looks for a way round (slipAround) */
  private stallT = 0;
  /** the horizontal distance a step-up carried the body beyond its stride, paid back before it walks on (m) */
  private stepDebt = 0;
  /** frames the feet were lifted back onto the floor they had sunk into */
  sinkFixes = 0;
  /** times the body was eased out of a face it was held fast on (unstick) */
  unsticks = 0;
  onStep: ((f: Footfall) => void) | null = null; footfalls = 0; private stepIdx = 0; private stairT = 0;
  constructor(private phys: Physics, x: number, y: number, z: number) {
    const R = phys.R;
    this.body = phys.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + CAPSULE_HALF + CAPSULE_R, z));
    this.collider = phys.world.createCollider(R.ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_R), this.body);
    this.shapes = { stand: new R.Capsule(CAPSULE_HALF, CAPSULE_R), crouch: new R.Capsule(CROUCH_HALF, CAPSULE_R) };
    this.controller = phys.world.createCharacterController(OFFSET);
    this.controller.enableAutostep(STEP_UP, STEP_MIN_DEPTH, false);
    this.controller.enableSnapToGround(0.35);
    this.controller.setMaxSlopeClimbAngle((42 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((50 * Math.PI) / 180);
    this.controller.setApplyImpulsesToDynamicBodies(false);
  }
  get position() { return this.body.translation(); }
  get eye() { const p = this.position, s = this.stepEase, eyeH = EYE_HEIGHT - (EYE_HEIGHT - CROUCH_EYE) * this.crouchEase;
    return { x: p.x + s.x, y: p.y - this.half - CAPSULE_R + eyeH + s.y, z: p.z + s.z }; }
  get feetY() { return this.position.y - this.half - CAPSULE_R; }
  /** crouch or stand: the capsule shortens about the feet at once; standing needs room for the full capsule */
  private setCrouch(want: boolean) {
    if (want === this.crouched) return;
    const p = this.body.translation(), d = CAPSULE_HALF - CROUCH_HALF;
    if (!want) {
      // the standing capsule (a little slimmer, its foot 6 cm up: clear of the floor and of a riser's nosing) must be free
      const R = this.phys.R, r = CAPSULE_R - 0.02, probe = new R.Capsule(CAPSULE_HALF, r), feet = p.y - this.half - CAPSULE_R;
      if (this.phys.world.intersectionWithShape({ x: p.x, y: feet + 0.06 + r + CAPSULE_HALF, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, probe, undefined, undefined, this.collider, this.body)) return; // a lintel or a roof overhead
    }
    this.crouched = want; this.half = want ? CROUCH_HALF : CAPSULE_HALF;
    // a new collider of the new size (setHalfHeight on the live capsule left the controller's queries at the old size)
    const R = this.phys.R; this.phys.world.removeCollider(this.collider, false);
    this.collider = this.phys.world.createCollider(R.ColliderDesc.capsule(this.half, CAPSULE_R), this.body);
    const y = p.y + (want ? -d : d); this.body.setTranslation({ x: p.x, y, z: p.z }, true); this.body.setNextKinematicTranslation({ x: p.x, y, z: p.z });
  }
  update(dt: number, inp: PlayerInput) {
    this.yaw = inp.yaw; this.pitch = inp.pitch;
    this.setCrouch(!!inp.crouch);
    this.crouchEase += ((this.crouched ? 1 : 0) - this.crouchEase) * Math.min(1, dt / 0.09);
    this.pace = inp.slow ? 'careful' : inp.run ? 'brisk' : 'walk';
    const bot = this.botSpeed !== null;
    // the grade slows the body (uphill more than down); the bots keep their pace
    const speed = bot ? this.botSpeed! : (this.crouched ? Math.min(CROUCH_SPEED, PACE[this.pace]) : PACE[this.pace]) * slopeFactor(this.grade);
    let fx = inp.forward, fr = inp.right; const l = Math.hypot(fx, fr); if (l > 1) { fx /= l; fr /= l; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // yaw = 0 looks toward −Z (grid north)
    const wish = { x: (-sin * fx + cos * fr) * speed, z: (-cos * fx - sin * fr) * speed };
    // easing past someone: a person or an animal met head-on turns the walk aside for a moment, to the side the wish
    // already leans to, as a body steps round another (D-630; head-on the capsules' contact has no slide, so the walk
    // stopped dead against anyone standing in a lane or a doorway)
    this.dodgeT = Math.max(0, this.dodgeT - dt);
    if (this.dodgeT > 0 && (wish.x || wish.z)) { const a = this.dodgeA, c = Math.cos(a), sn = Math.sin(a), x = wish.x;
      wish.x = x * c - wish.z * sn; wish.z = x * sn + wish.z * c; }
    // inertia: the body accelerates and stops over about a step; in the air it keeps what it had (no steering mid-fall)
    if (bot) { this.vel.x = wish.x; this.vel.z = wish.z; } else if (this.grounded) approach(this.vel, wish, dt);
    const vx = this.vel.x, vz = this.vel.z;
    this.vy = this.grounded ? -0.5 : Math.max(-55, this.vy - 9.81 * dt);
    const desired = { x: vx * dt, y: this.vy * dt, z: vz * dt };
    // a step-up carried the body across faster than it walks: it pays the distance back before moving on, so the climb
    // keeps the walking pace (the eye glides over both: stepEase)
    const paying = this.stepDebt > 0; let paid = 0;
    if (this.stepDebt > 0) { const want0 = Math.hypot(desired.x, desired.z), pay = Math.min(this.stepDebt, want0); this.stepDebt -= pay; paid = pay;
      if (want0 > 1e-9) { const k = (want0 - pay) / want0; desired.x *= k; desired.z *= k; } if (want0 < 1e-6) this.stepDebt = Math.max(0, this.stepDebt - dt); }
    this.controller.computeColliderMovement(this.collider, desired);
    let m: { x: number; y: number; z: number } = this.controller.computedMovement();
    const p = this.body.translation();
    const wasGrounded = this.grounded;
    let grounded = this.controller.computedGrounded();
    const want = Math.hypot(desired.x, desired.z);
    // Rapier's controller sometimes stops a grounded body dead on open ground when the move carries the small downward
    // push that keeps it grounded: every contact is floor (normal within the climb angle), yet under 50 % of the step is
    // made (measured: tests/lib/seams.ts, 8 of 2,100 terrain crossings, all 6-50 km out; "invisible walls"). Then the
    // move is retried level; snap-to-ground (0.35 m) still follows the ground down.
    if (wasGrounded && want > 1e-5 && desired.y < 0 && (m.x * desired.x + m.z * desired.z) / want < want * 0.5) {
      let floorOnly = this.controller.numComputedCollisions() > 0;
      for (let i = 0; i < this.controller.numComputedCollisions(); i++) { const n = this.controller.computedCollision(i)?.normal1; if (!n || n.y < FLOOR_NY) floorOnly = false; }
      if (floorOnly) {
        this.controller.computeColliderMovement(this.collider, { x: desired.x, y: 0, z: desired.z });
        const m2 = this.controller.computedMovement();
        if (m2.x * desired.x + m2.z * desired.z > m.x * desired.x + m.z * desired.z) { m = m2; grounded = this.controller.computedGrounded() || grounded; this.levelRetries++; }
      }
    }
    // blocked (progress along the wished direction < 90 %) by a face too steep to walk up (a riser, a step's edge) while
    // grounded: try to step onto it, straight across the face (its normal), so an oblique approach still carries the body
    // past the edge. Only a face steeper than the climb angle counts: until session 8 (H workstream) a plain slope of 11°
    // or more also cut the progress below 90 % (the move's downward push projected on the slope), so every frame on the
    // mountain became a 0.39 m "step": the player went uphill at 11.7 m/s at 30 Hz. The contact's normal1 is the obstacle's
    // outward normal (measured: a wall facing −x gives normal1 (−1, 0, 0)); the direction code read normal2 and never fired.
    let steep = false, stepped = false;
    if (wasGrounded && want > 1e-5 && (m.x * desired.x + m.z * desired.z) / want < want * 0.9) {
      const dx = desired.x / want, dz = desired.z / want;
      for (let i = 0; i < this.controller.numComputedCollisions(); i++) { const n = this.controller.computedCollision(i)?.normal1;
        if (n && n.y < FLOOR_NY && -(n.x * dx + n.z * dz) > 0.05) steep = true; }
    }
    if (steep) {
      const dx0 = desired.x / want, dz0 = desired.z / want; let dx = dx0, dz = dz0;
      for (let i = 0; i < this.controller.numComputedCollisions(); i++) { const n = this.controller.computedCollision(i)?.normal1;
        if (n && Math.abs(n.y) < 0.3 && -(n.x * dx0 + n.z * dz0) > 0.2) { const l = Math.hypot(n.x, n.z); dx = -n.x / l; dz = -n.z / l; break; } }
      const s = this.stepUp(p, dx, dz);
      if (s) { m = s; grounded = true; this.steps++; stepped = true;
        this.stepDebt += Math.max(0, Math.hypot(s.x, s.z) - Math.hypot(this.vel.x, this.vel.z) * dt); }
    }
    // stand on the floor, not in it: the controller let a walking body sink 7-10 cm into the floor at 30 Hz (measured on
    // a flat box and beside an ox, s17; the skin should keep it 2 cm above): the feet are set on the floor found by a
    // shape cast from a little above (D-630)
    if (grounded && !stepped) { const q = { x: p.x + m.x, y: p.y + m.y + 0.15, z: p.z + m.z }, shape = this.crouched ? this.shapes.crouch : this.shapes.stand;
      const hit = this.phys.world.castShape(q, { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: -1, z: 0 }, shape, 0, 0.3, false, undefined, undefined, this.collider, this.body);
      if (hit && hit.time_of_impact > 1e-4 && hit.normal1.y >= FLOOR_NY) { const fix = 0.15 - hit.time_of_impact + OFFSET * 0.5; if (fix > 0.002 && fix < 0.15) { m = { x: m.x, y: m.y + fix, z: m.z }; this.sinkFixes++; } } }
    // the eye glides over every rise and drop the feet make while walking (a riser slid up, a step-up, a kerb down; on a
    // steady slope it trails by ~2 v / ω, 4 cm at the Grand Stair's climb): the vertical of the same spring
    if (grounded && wasGrounded) this.stepEase.y = Math.max(-0.6, Math.min(0.6, this.stepEase.y - m.y));
    { const h = Math.min(dt, 1 / 30), w = STEP_EASE_W, e = this.stepEase, v = this.stepEaseV; // semi-implicit, ~0.3 s to settle
      v.y += (-w * w * e.y - 2 * w * v.y) * h; e.y += v.y * h; }
    this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
    this.grounded = grounded; this.landed = 0;
    if (!this.grounded && wasGrounded) this.fallStartY = p.y;
    if (this.grounded && !wasGrounded && this.fallStartY !== null) { this.lastFall = this.fallStartY - p.y; this.maxFall = Math.max(this.maxFall, this.lastFall); this.landed = Math.max(0, this.lastFall); this.fallStartY = null; }
    const horiz = Math.hypot(m.x, m.z); this.distanceWalked += horiz;
    // a wall or a person took the motion: the velocity into it is lost, the rest slides along (no pressing on at full speed
    // and no burst when the wall ends; a step-up's carry over the edge is not velocity; a slope is floor and a riser is a
    // step, not a wall)
    const feet = p.y - this.half - CAPSULE_R, wl = Math.hypot(wish.x, wish.z);
    if (wl > 1e-6) for (let i = 0; i < this.controller.numComputedCollisions(); i++) { const c = this.controller.computedCollision(i);
      if (!c?.collider || c.collider.shapeType() !== this.phys.R.ShapeType.Capsule || c.collider.parent() === this.body) continue; // the living are the other capsules
      const n = c.normal1, l = Math.hypot(n.x, n.z); if (l < 0.5) continue;
      const nx = n.x / l, nz = n.z / l, head = -(wish.x * nx + wish.z * nz) / wl; if (head < 0.55) continue; // glancing: the slide carries the body round
      if (this.dodgeT <= 0) { const cross = (wish.x * nz - wish.z * nx) / wl; this.dodgeSide = Math.abs(cross) > 0.12 ? (cross > 0 ? 1 : -1) : this.dodgeSide; this.dodgeA = this.dodgeSide * DODGE_ANGLE; }
      this.dodgeT = 0.45; break; }
    // stalled on an edge (a jamb's corner, an open leaf's edge, a trimesh's inner edge, a prop's corner) while a way round
    // lies a little to one side: the body takes it, as a walker sidles round what it brushed (D-630). A flat wall walked
    // into head-on offers no way within 70°, so the body stays stopped there (no sliding along walls one did not ask for)
    let bx = p.x + m.x, bz = p.z + m.z; // where the body will stand (the eye follows it across: eyeAcross)
    if (this.grounded && !stepped && !paying && wl > 0.3 && horiz < 0.25 * wl * dt) this.stallT += dt; else this.stallT = 0;
    if (this.stallT > STALL_PROBE && this.dodgeT <= 0) { this.stallT = 0; const a = this.slipAround(p, wish); if (a !== null) { this.dodgeA = a; this.dodgeT = 0.4;
      // held fast inside the controller's skin on a mesh face (every move, even along the face, returned zero: trimesh
      // contacts at time of impact 0, session 17's Tachara N doorway): a few centimetres straight out of the faces first
      const u = this.unstick(p); if (u) { this.body.setNextKinematicTranslation({ x: p.x + m.x + u.x, y: p.y + m.y, z: p.z + m.z + u.z }); bx += u.x; bz += u.z; } } }
    this.eyeAcross(bx, bz, dt);
    if (!stepped && !bot) for (let i = 0; i < this.controller.numComputedCollisions(); i++) { const c = this.controller.computedCollision(i), n = c?.normal1;
      if (!n || n.y >= FLOOR_NY) continue; const l = Math.hypot(n.x, n.z); if (l < 1e-6) continue;
      if (c!.witness1 && c!.witness1.y - feet < STEP_UP + 0.02) continue; // a riser the body climbs, not a wall
      const nx = n.x / l, nz = n.z / l, into = this.vel.x * nx + this.vel.z * nz; if (into < 0) { this.vel.x -= into * nx; this.vel.z -= into * nz; } }
    // the walk goes on through a step-up and its payback: the stride, the speed and the grade count the distance the step
    // carried as walked when it is paid back, not when it was jumped (legs, head and footfalls keep their rhythm)
    const walked = stepped ? Math.hypot(this.vel.x, this.vel.z) * dt : horiz + paid;
    this.speed = walked / Math.max(dt, 1e-6);
    // the grade from the rise and the distance walked, each averaged over ~0.4 s (a step-up's rise and its payback are
    // one tread: averaged together they read as the stair's own grade)
    if (this.grounded) { const k = Math.min(1, dt / 0.4); this.gRise += (m.y - this.gRise) * k; this.gRun += (walked - this.gRun) * k;
      this.grade = this.gRun > 0.004 * (dt * 60) ? Math.max(-1, Math.min(1, this.gRise / this.gRun)) : this.grade * Math.exp(-dt / 0.25); }
    if (stepped || this.grade > 0.15) this.stairT = 0.4; else this.stairT = Math.max(0, this.stairT - dt);
    if (this.grounded) {
      this.bobPhase += walked * (Math.PI / stepLength(this.grade)); // one step ≈ 0.75 m on the level, shorter on stairs and slopes
      const i = Math.floor(this.bobPhase / Math.PI);
      if (i !== this.stepIdx) { this.stepIdx = i; this.footfalls++; const q = this.body.translation();
        this.onStep?.({ foot: (i & 1) as 0 | 1, speed: this.speed, pace: this.pace, crouched: this.crouched, stair: this.stairT > 0, x: q.x, y: this.feetY, z: q.z }); }
    }
  }
  /** a way round from p for the wish: the smallest turn (±23°, ±46°, ±69°, the side the body already leans to first)
   *  along which the body is free for 0.45 m (a shape cast a little above the floor); null when there is none */
  private slipAround(p: { x: number; y: number; z: number }, wish: { x: number; z: number }): number | null {
    const w = this.phys.world, shape = this.crouched ? this.shapes.crouch : this.shapes.stand, rot = { x: 0, y: 0, z: 0, w: 1 }, l = Math.hypot(wish.x, wish.z);
    let lean = 0; for (let i = 0; i < this.controller.numComputedCollisions(); i++) { const n = this.controller.computedCollision(i)?.normal1;
      if (n && n.y < FLOOR_NY) lean += (wish.x * n.z - wish.z * n.x) / l; }
    const first = lean >= 0 ? 1 : -1, from = { x: p.x, y: p.y + 0.08, z: p.z };
    for (const k of [1, 2, 3]) for (const sd of [first, -first]) {
      const a = sd * k * 0.4, c = Math.cos(a), sn = Math.sin(a), dir = { x: (wish.x * c - wish.z * sn) / l, y: 0, z: (wish.x * sn + wish.z * c) / l };
      const hit = w.castShape(from, rot, dir, shape, 0, 0.45, true, undefined, undefined, this.collider, this.body);
      if (!hit) return a;
    }
    return null;
  }
  /** 4 cm out of the steep faces the body touches (their horizontal normals summed), where the capsule fits; null if none */
  private unstick(p: { x: number; y: number; z: number }): { x: number; z: number } | null {
    let nx = 0, nz = 0; for (let i = 0; i < this.controller.numComputedCollisions(); i++) { const c = this.controller.computedCollision(i), n = c?.normal1;
      if (!n || n.y >= FLOOR_NY || !c?.collider || c.collider.shapeType() === this.phys.R.ShapeType.Capsule) continue; nx += n.x; nz += n.z; }
    const l = Math.hypot(nx, nz); if (l < 1e-6) return null;
    const u = { x: nx / l * 0.04, z: nz / l * 0.04 }, shape = this.crouched ? this.shapes.crouch : this.shapes.stand;
    if (this.phys.world.intersectionWithShape({ x: p.x + u.x, y: p.y + 0.03, z: p.z + u.z }, { x: 0, y: 0, z: 0, w: 1 }, shape, undefined, undefined, this.collider, this.body)) return null;
    this.unsticks++; return u;
  }
  /** explicit step-up from p along the unit horizontal direction (dx, dz): returns the movement onto the step top, or null
   *  when there is no step of height ≤ STEP_UP with STEP_MIN_DEPTH of floor beyond the edge (a wall, a drop, a slope) */
  private stepUp(p: { x: number; y: number; z: number }, dx: number, dz: number) {
    const w = this.phys.world, shape = this.crouched ? this.shapes.crouch : this.shapes.stand, rot = { x: 0, y: 0, z: 0, w: 1 }; // (collider.shape keeps the size it was made with)
    // stopAtPenetration: a body already touching (a person's or an animal's capsule the controller stopped against) blocks
    // at once; with false, parry ignored it and the "step" carried the player 0.39 m into the capsule (session 8, solids)
    const cast = (from: { x: number; y: number; z: number }, v: { x: number; y: number; z: number }, max: number) => {
      const h = w.castShape(from, rot, v, shape, 0, max, true, undefined, undefined, this.collider, this.body); return h ? h.time_of_impact : max; };
    const top = cast(p, { x: 0, y: 1, z: 0 }, STEP_UP + OFFSET);
    if (top < 0.05) return null; // head against a ceiling
    // the full lift and reach first; then lower lifts and shorter reaches, for a flight whose treads are shorter than the
    // capsule's reach past the edge (the Harem's and the town's 0.26-0.30 m treads: the full lift met the riser after next
    // and the body crept up on the controller's slide, stalling at every riser, D-630)
    for (const lift of [top, 0.3, 0.2].filter((l, i) => i === 0 || l < top - 0.02)) for (const reach of STEP_REACH) {
      const up = { x: p.x, y: p.y + lift, z: p.z };
      if (cast(up, { x: dx, y: 0, z: dz }, reach) < reach - 1e-3) continue; // blocked above the step too (a wall, or the next riser)
      const over = { x: up.x + dx * reach, y: up.y, z: up.z + dz * reach };
      const drop = w.castShape(over, rot, { x: 0, y: -1, z: 0 }, shape, 0, lift + 0.05, false, undefined, undefined, this.collider, this.body);
      if (!drop) continue; // nothing to stand on
      if (drop.normal1.y < FLOOR_NY) continue; // too steep to stand on (or the sphere on the edge's corner)
      const rise = lift - drop.time_of_impact + OFFSET;
      if (rise < 0.02 || rise > STEP_UP + 0.01) continue;
      // the body must fit where the step puts it (just above the top)
      if (w.intersectionWithShape({ x: over.x, y: p.y + rise + 0.03, z: over.z }, rot, shape, undefined, undefined, this.collider, this.body)) continue;
      return { x: over.x - p.x, y: rise, z: over.z - p.z };
    }
    return null;
  }
  /** the eye across (x, z): a critically damped follower of the body led by the body's walking velocity (feed-forward),
   *  so on a steady walk it rides the body exactly and over a step-up's jump, the pause that pays it back (stepDebt) or a
   *  push out of a face it glides on at the walking pace, with no jolt when the body moves on (D-630) */
  private eyeAcross(bx: number, bz: number, dt: number) {
    const E = this.eyeXZ, h = Math.min(dt, 1 / 30), w = STEP_EASE_WXZ;
    if (!E.init || Math.hypot(E.x - bx, E.z - bz) > 1.5) { E.x = bx; E.z = bz; E.vx = this.vel.x; E.vz = this.vel.z; E.init = true; }
    else { E.vx += (w * w * (bx - E.x) + 2 * w * (this.vel.x - E.vx)) * h; E.vz += (w * w * (bz - E.z) + 2 * w * (this.vel.z - E.vz)) * h; E.x += E.vx * h; E.z += E.vz * h; }
    this.stepEase.x = E.x - bx; this.stepEase.z = E.z - bz;
  }
  /** safety net: if the feet are more than RESCUE_DEPTH below the ground (`groundAt`, the drawn terrain surface), put the
   *  body back on it, logged and counted. Called after each physics step (main.ts simStep and the walk bots). */
  rescueIfUnderground(groundAt: (x: number, z: number) => number): boolean {
    const p = this.position, g = groundAt(p.x, p.z), depth = g - this.feetY;
    if (!(depth > RESCUE_DEPTH)) return false;
    // stand on whatever is just above the terrain there (a floor a little above it), else on the terrain itself
    const hit = this.phys.castRayDown(p.x, p.z, g + 2.5, this.collider), y = hit !== null && hit >= g - 0.05 ? hit : g;
    this.teleport(p.x, y, p.z); this.fallStartY = null; this.grounded = false;
    this.rescues++; this.lastRescue = { x: p.x, z: p.z, depth, n: this.rescues };
    console.warn(`[ground] rescued the player ${depth.toFixed(2)} m below the ground at grid E ${p.x.toFixed(1)} N ${(-p.z).toFixed(1)} (${this.rescues} so far): a collider bug to fix`);
    return true;
  }
  teleport(x: number, y: number, z: number) { this.body.setTranslation({ x, y: y + this.half + CAPSULE_R + 0.02, z }, true); this.vy = 0; this.vel.x = this.vel.z = 0; this.stepDebt = 0; this.stepEase = { x: 0, y: 0, z: 0 }; this.stepEaseV = { x: 0, y: 0, z: 0 }; this.eyeXZ.init = false; }
}
