// The player's visible body (brief §6: visible, in period dress, with a shadow; D-025). The same MakeHuman-derived body
// and costume system as everyone else: a man in Median riding dress of undyed wool (tunic, trousers, boots, soft cap;
// C: the visitor's dress is not evidenced, the riding costume is the common dress of the period, B). The camera sits
// inside the head, so the visible copy collapses the head (person flag) and a second, shadow-only copy (no colour,
// no depth) keeps the head's shadow. Walk and idle cycles from anim.ts.
import * as THREE from 'three/webgpu';
import type { Crowd } from '../people/crowd';
import { HumanMaterial, FLAG_HIDE_HEAD } from '../people/humanMaterial';
import { RigSolver, PALETTE_STRIDE, type RigInput } from '../people/humanRig';
import { lookFor } from '../people/looks';
import { pose } from '../people/anim';
import { EYE_HEIGHT } from './player';
import { COSTUMES, pieceBit } from '../people/outfits';

interface PlayerRig { crowd: Crowd; rig: RigSolver; input: RigInput; slots: [number, number]; lastPhase: number; moving: number; t: number; meshes: THREE.Mesh[] }
/** the player's body; position (feet) and rotation.y (view yaw) are set by the caller each frame */
export function makePlayerBody(crowd?: Crowd): THREE.Group {
  const g = new THREE.Group(); g.name = 'player-body';
  g.userData = { tier: 'C', src: 'RECON', placeholder: false, note: 'the visitor: MakeHuman body (C) in Median riding dress of undyed wool (dress B, colours C); head hidden from the camera, shadow kept' };
  if (!crowd) return g;
  const H = crowd.humans, gpu = H.gpu;
  const look = lookFor(H.A, { id: -1, sex: 'm', role: 'visitor', dress: 'median', seed: 467, age: 'adult' }, crowd.seed);
  // the visitor's dress: undyed wool and brown, soft cap, no weapons, short beard (C)
  let mask = 1; for (const id of ['hair', 'bun', 'beard_short', 'cap_soft']) mask |= 1 << pieceBit('median', id);
  const v = H.A.byId.m03 ?? H.A.variants[look.variant];
  Object.assign(look, { variant: v.index, variantId: v.meta.id, scale: EYE_HEIGHT / v.eyeY, mask, stubble: 0 });
  look.col.main = [0.46, 0.4, 0.31]; look.col.second = [0.19, 0.13, 0.08]; look.col.trim = [0.19, 0.13, 0.08];
  look.pieces = [...COSTUMES.median.always, 'hair', 'bun', 'beard_short', 'cap_soft'];
  const slots: [number, number] = [crowd.allocSlot(), crowd.allocSlot()];
  crowd.writePerson(slots[0], look, FLAG_HIDE_HEAD); crowd.writePerson(slots[1], look, 0);
  const C = H.O.costumes.median[0];
  const shadowMat = new HumanMaterial(gpu.textures, { shadowOnly: true }); gpu.materials.push(shadowMat);
  const vis = gpu.makeMesh(C, gpu.material, false, 1), shadow = gpu.makeMesh(C, shadowMat, true, 1);
  gpu.group.remove(vis.mesh); gpu.group.remove(shadow.mesh); // owned by the player body, not the crowd
  for (const [cm, slot] of [[vis, slots[0]], [shadow, slots[1]]] as const) {
    gpu.setInstance(cm, 0, slot, [0, 0, 0, Math.PI], [0, 0, 0, Math.PI]);
    cm.geo.instanceCount = 1; cm.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.3); cm.mesh.visible = true; cm.mesh.matrixAutoUpdate = true;
    cm.mesh.userData = g.userData; g.add(cm.mesh);
  }
  vis.mesh.receiveShadow = true; shadow.mesh.receiveShadow = false;
  const rig = new RigSolver(H.A.meta.curlAxes);
  const input: RigInput = { joints: v.joints, pose: { rot: {}, hips: [0, 0, 0] }, face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1, plant: true };
  (g as any).playerRig = { crowd, rig, input, slots, lastPhase: NaN, moving: 0, t: 0, meshes: [vis.mesh, shadow.mesh] } as PlayerRig;
  return g;
}
/** pose the body: walk while the step phase advances, idle otherwise (blended over ~0.3 s) */
export function animateBody(g: THREE.Group, phase: number, speed: number, dt = 1 / 60) {
  const P = (g as any).playerRig as PlayerRig | undefined; if (!P) return;
  const moved = Number.isFinite(P.lastPhase) && Math.abs(phase - P.lastPhase) > 1e-4; P.lastPhase = phase;
  P.moving += ((moved ? 1 : 0) - P.moving) * Math.min(1, dt / 0.3); P.t += dt;
  const walk = pose('walk', P.t, phase, 0.4), idle = pose('idle', P.t, phase, 0.4), k = P.moving * Math.min(1, speed / 1.35);
  const rot: any = {}; for (const b of new Set([...Object.keys(walk.rot), ...Object.keys(idle.rot)])) { const a = (idle.rot as any)[b] ?? [0, 0, 0], w = (walk.rot as any)[b] ?? [0, 0, 0]; rot[b] = [a[0] + (w[0] - a[0]) * k, a[1] + (w[1] - a[1]) * k, a[2] + (w[2] - a[2]) * k]; }
  P.input.pose = { rot, hips: [idle.hips[0] + (walk.hips[0] - idle.hips[0]) * k, idle.hips[1] + (walk.hips[1] - idle.hips[1]) * k, idle.hips[2] + (walk.hips[2] - idle.hips[2]) * k] };
  const gpu = P.crowd.humans.gpu;
  for (const s of P.slots) { const o = s * PALETTE_STRIDE; gpu.prevPalette.set(gpu.palette.subarray(o, o + PALETTE_STRIDE), o); }
  P.rig.setPose(P.input); P.rig.solve(P.input, gpu.palette, P.slots[0] * PALETTE_STRIDE);
  gpu.palette.copyWithin(P.slots[1] * PALETTE_STRIDE, P.slots[0] * PALETTE_STRIDE, P.slots[0] * PALETTE_STRIDE + PALETTE_STRIDE);
}
