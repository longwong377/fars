// First-person player at human scale (brief §6 The player, §1.1 presence): walk 1.35 m/s, run 3.2 m/s (no sprinting
// across the world, no fast travel, no flying); correct step-up for the Terrace's shallow stairs (autostep ≤ 0.4 m);
// can fall off the Terrace edge; capsule collision.
// Step-up: Rapier's autostep did not lift the capsule in our setup (measured, tools/dev/tmp: only what the round capsule
// bottom slides over, ~0.24 m head-on and ~0.12 m at 60°), while the walkable grid lets people route over steps up to
// NAV.maxStep. So a blocked, grounded move tries an explicit step: shape-cast up, across past the edge, down onto the top.
import type RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from './physics';
import { NAV } from '../people/navgrid';

export const WALK_SPEED = 1.35; // m/s — typical unhurried adult walking pace (C: common human-factors value)
export const RUN_SPEED = 3.2;
export const EYE_HEIGHT = 1.6, CAPSULE_R = 0.25, CAPSULE_HALF = 0.6; // capsule total 1.7 m
/** highest step the player climbs: the walkable grid's step limit, so every route people take is walkable by the player */
export const STEP_UP = NAV.maxStep;
/** a step's top must offer this much standing depth beyond the edge (C: about a forefoot) */
const STEP_MIN_DEPTH = 0.12;
const OFFSET = 0.02; // character-controller skin
export interface PlayerInput { forward: number; right: number; run: boolean; yaw: number; pitch: number }

export class Player {
  body: RAPIER.RigidBody; collider: RAPIER.Collider; controller: RAPIER.KinematicCharacterController;
  vy = 0; grounded = false; yaw = 0; pitch = 0; bobPhase = 0; distanceWalked = 0; fallStartY: number | null = null; lastFall = 0; maxFall = 0;
  /** eye offset left by a step-up, eased back to zero so the camera glides instead of popping (render only) */
  stepEase = { x: 0, y: 0, z: 0 }; steps = 0;
  constructor(private phys: Physics, x: number, y: number, z: number) {
    const R = phys.R;
    this.body = phys.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + CAPSULE_HALF + CAPSULE_R, z));
    this.collider = phys.world.createCollider(R.ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_R), this.body);
    this.controller = phys.world.createCharacterController(OFFSET);
    this.controller.enableAutostep(STEP_UP, STEP_MIN_DEPTH, false);
    this.controller.enableSnapToGround(0.35);
    this.controller.setMaxSlopeClimbAngle((42 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((50 * Math.PI) / 180);
    this.controller.setApplyImpulsesToDynamicBodies(false);
  }
  get position() { return this.body.translation(); }
  get eye() { const p = this.position, s = this.stepEase; return { x: p.x + s.x, y: p.y - CAPSULE_HALF - CAPSULE_R + EYE_HEIGHT + s.y, z: p.z + s.z }; }
  get feetY() { return this.position.y - CAPSULE_HALF - CAPSULE_R; }
  update(dt: number, inp: PlayerInput) {
    this.yaw = inp.yaw; this.pitch = inp.pitch;
    const speed = inp.run ? RUN_SPEED : WALK_SPEED;
    let fx = inp.forward, fr = inp.right; const l = Math.hypot(fx, fr); if (l > 1) { fx /= l; fr /= l; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // yaw = 0 looks toward −Z (grid north)
    const vx = (-sin * fx + cos * fr) * speed, vz = (-cos * fx - sin * fr) * speed;
    this.vy = this.grounded ? -0.5 : Math.max(-55, this.vy - 9.81 * dt);
    const desired = { x: vx * dt, y: this.vy * dt, z: vz * dt };
    this.controller.computeColliderMovement(this.collider, desired);
    let m: { x: number; y: number; z: number } = this.controller.computedMovement();
    const p = this.body.translation();
    const wasGrounded = this.grounded;
    let grounded = this.controller.computedGrounded();
    const want = Math.hypot(desired.x, desired.z);
    // blocked (progress along the wished direction < 90 %) by a near-vertical face while grounded: try to step onto it,
    // straight across the face (its normal), so an oblique approach still carries the body past the edge
    if (wasGrounded && want > 1e-5 && (m.x * desired.x + m.z * desired.z) / want < want * 0.9) {
      let dx = desired.x / want, dz = desired.z / want;
      for (let i = 0; i < this.controller.numComputedCollisions(); i++) { const c = this.controller.computedCollision(i); const n = c?.normal2;
        if (n && Math.abs(n.y) < 0.3 && -(n.x * dx + n.z * dz) > 0.2) { const l = Math.hypot(n.x, n.z); dx = -n.x / l; dz = -n.z / l; break; } }
      const s = this.stepUp(p, dx, dz);
      if (s) { m = s; grounded = true; this.steps++; this.stepEase = { x: this.stepEase.x - s.x, y: this.stepEase.y - s.y, z: this.stepEase.z - s.z }; }
    }
    const k = Math.exp(-dt / 0.08); this.stepEase = { x: this.stepEase.x * k, y: this.stepEase.y * k, z: this.stepEase.z * k };
    this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
    this.grounded = grounded;
    if (!this.grounded && wasGrounded) this.fallStartY = p.y;
    if (this.grounded && !wasGrounded && this.fallStartY !== null) { this.lastFall = this.fallStartY - p.y; this.maxFall = Math.max(this.maxFall, this.lastFall); this.fallStartY = null; }
    const horiz = Math.hypot(m.x, m.z); this.distanceWalked += horiz;
    if (this.grounded) this.bobPhase += horiz * (Math.PI / 0.75); // one step ≈ 0.75 m
  }
  /** explicit step-up from p along the unit horizontal direction (dx, dz): returns the movement onto the step top, or null
   *  when there is no step of height ≤ STEP_UP with STEP_MIN_DEPTH of floor beyond the edge (a wall, a drop, a slope) */
  private stepUp(p: { x: number; y: number; z: number }, dx: number, dz: number) {
    const w = this.phys.world, shape = this.collider.shape, rot = { x: 0, y: 0, z: 0, w: 1 };
    const cast = (from: { x: number; y: number; z: number }, v: { x: number; y: number; z: number }, max: number) => {
      const h = w.castShape(from, rot, v, shape, 0, max, false, undefined, undefined, this.collider, this.body); return h ? h.time_of_impact : max; };
    const lift = cast(p, { x: 0, y: 1, z: 0 }, STEP_UP + OFFSET);
    if (lift < 0.05) return null; // head against a ceiling
    const up = { x: p.x, y: p.y + lift, z: p.z };
    const reach = CAPSULE_R + OFFSET + STEP_MIN_DEPTH; // carry the capsule's centre past the edge onto the top
    const fwd = cast(up, { x: dx, y: 0, z: dz }, reach);
    if (fwd < reach - 1e-3) return null; // blocked above the step too: a wall, not a step
    const over = { x: up.x + dx * reach, y: up.y, z: up.z + dz * reach };
    const drop = w.castShape(over, rot, { x: 0, y: -1, z: 0 }, shape, 0, lift + 0.05, false, undefined, undefined, this.collider, this.body);
    if (!drop) return null; // nothing to stand on
    const n = drop.normal1; if (n.y < Math.cos((42 * Math.PI) / 180)) return null; // too steep to stand on
    const rise = lift - drop.time_of_impact + OFFSET;
    if (rise < 0.02 || rise > STEP_UP + 0.01) return null;
    return { x: over.x - p.x, y: rise, z: over.z - p.z };
  }
  teleport(x: number, y: number, z: number) { this.body.setTranslation({ x, y: y + CAPSULE_HALF + CAPSULE_R + 0.02, z }, true); this.vy = 0; }
}
