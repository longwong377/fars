// First-person player at human scale (brief §6 The player, §1.1 presence): walk 1.35 m/s, run 3.2 m/s (no sprinting
// across the world, no fast travel, no flying); correct step-up for the Terrace's shallow stairs (autostep ≤ 0.4 m);
// can fall off the Terrace edge; capsule collision.
import type RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from './physics';

export const WALK_SPEED = 1.35; // m/s — typical unhurried adult walking pace (C: common human-factors value)
export const RUN_SPEED = 3.2;
export const EYE_HEIGHT = 1.6, CAPSULE_R = 0.25, CAPSULE_HALF = 0.6; // capsule total 1.7 m
export interface PlayerInput { forward: number; right: number; run: boolean; yaw: number; pitch: number }

export class Player {
  body: RAPIER.RigidBody; collider: RAPIER.Collider; controller: RAPIER.KinematicCharacterController;
  vy = 0; grounded = false; yaw = 0; pitch = 0; bobPhase = 0; distanceWalked = 0; fallStartY: number | null = null; lastFall = 0; maxFall = 0;
  constructor(private phys: Physics, x: number, y: number, z: number) {
    const R = phys.R;
    this.body = phys.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + CAPSULE_HALF + CAPSULE_R, z));
    this.collider = phys.world.createCollider(R.ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_R), this.body);
    this.controller = phys.world.createCharacterController(0.02);
    this.controller.enableAutostep(0.4, 0.12, false);
    this.controller.enableSnapToGround(0.35);
    this.controller.setMaxSlopeClimbAngle((42 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((50 * Math.PI) / 180);
    this.controller.setApplyImpulsesToDynamicBodies(false);
  }
  get position() { return this.body.translation(); }
  get eye() { const p = this.position; return { x: p.x, y: p.y - CAPSULE_HALF - CAPSULE_R + EYE_HEIGHT, z: p.z }; }
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
    const m = this.controller.computedMovement();
    const p = this.body.translation();
    this.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
    const wasGrounded = this.grounded;
    this.grounded = this.controller.computedGrounded();
    if (!this.grounded && wasGrounded) this.fallStartY = p.y;
    if (this.grounded && !wasGrounded && this.fallStartY !== null) { this.lastFall = this.fallStartY - p.y; this.maxFall = Math.max(this.maxFall, this.lastFall); this.fallStartY = null; }
    const horiz = Math.hypot(m.x, m.z); this.distanceWalked += horiz;
    if (this.grounded) this.bobPhase += horiz * (Math.PI / 0.75); // one step ≈ 0.75 m
  }
  teleport(x: number, y: number, z: number) { this.body.setTranslation({ x, y: y + CAPSULE_HALF + CAPSULE_R + 0.02, z }, true); this.vy = 0; }
}
