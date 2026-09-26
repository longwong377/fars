// Solidity near the player (brief §6 "player collision with crowds and animals"; audit D M12; H workstream, D-237).
// Everyone and every animal drawn within reach of the player is solid: pools of kinematic bodies follow the nearest ones,
// streamed each simulation step from what the world placed last frame (the population's people where the crowd draws them,
// the crowd's extras: drivers, riders, musicians; the animals as the crowd and the fauna push them to be drawn).
//  - people: an upright capsule each (radius 0.25 m, 1.6 m tall), as the 135 detailed agents have (world.ts);
//  - animals: a horizontal capsule along the body (radius = the body's half girth, length = the body's), at the body's
//    height, turned with the animal; lying animals lowered. Three pools by size so no collider is ever reshaped.
//    Poultry are not solid (C: hens and cocks scatter from a walker; a 0.3 m solid would be stepped onto), logged in D-237.
// Until session 8 only the nearest 48 of the population were solid and no animal was.
import type RAPIER from '@dimforge/rapier3d-compat';
import type * as THREE from 'three/webgpu';
import type { Physics } from '../player/physics';
import { ANIMAL_BUILD, lieDrop, type AnimalInst, type Species } from '../people/animals';

/** reach (m): candidates farther from the player than this are not made solid */
export const SOLID_R = 16;
/** pool sizes: people, and animals per size class (small: dog, sheep, goat, gazelle, boar; medium: donkey, deer; large:
 *  ox, horse, mule, camel, zebu). A crowded court within 16 m holds ~200 people at 0.25 per m² (C). */
export const SOLID_POOLS = { people: 160, small: 32, medium: 16, large: 16 } as const;
type Size = 'small' | 'medium' | 'large';
const NOT_SOLID = new Set<Species>(['hen', 'cock']);
const sizeOf = (sp: Species): Size => { const B = ANIMAL_BUILD[sp]; return B.len >= 1.5 ? 'large' : B.len >= 1.1 ? 'medium' : 'small'; };
/** the capsule of each size class (the largest body of the class, so none is under-sized): radius, half segment */
const SHAPE: Record<Size, { r: number; half: number }> = { small: { r: 0.21, half: 0.3 }, medium: { r: 0.28, half: 0.42 }, large: { r: 0.4, half: 0.6 } };

interface Cand { d2: number; x: number; y: number; z: number; qy: number; qw: number }
export interface SolidStats { people: number; animals: number; candidatesPeople: number; candidatesAnimals: number; dropped: number; ms: number; maxMs: number }

export class NearSolids {
  private pools: Record<'people' | Size, RAPIER.RigidBody[]>;
  private cands: Record<'people' | Size, Cand[]> = { people: [], small: [], medium: [], large: [] };
  private px = 0; private pz = 0; private have = false;
  readonly stats: SolidStats = { people: 0, animals: 0, candidatesPeople: 0, candidatesAnimals: 0, dropped: 0, ms: 0, maxMs: 0 };
  constructor(private phys: Physics, sizes = SOLID_POOLS) {
    const R = phys.R, w = phys.world;
    const body = () => w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -1000, 0));
    const lying = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }; // the capsule's axis (Y) turned onto the body's (Z)
    this.pools = {
      people: Array.from({ length: sizes.people }, () => { const b = body(); w.createCollider(R.ColliderDesc.capsule(0.55, 0.25).setTranslation(0, 0.8, 0), b); return b; }),
      small: [], medium: [], large: [],
    };
    for (const s of ['small', 'medium', 'large'] as Size[]) this.pools[s] = Array.from({ length: sizes[s] }, () => { const b = body(); w.createCollider(R.ColliderDesc.capsule(SHAPE[s].half, SHAPE[s].r).setRotation(lying), b); return b; });
  }
  /** start gathering the people around the player (world x, z) for this step; the animals gathered since the last
   *  beginAnimals() are kept (they are pushed once per rendered frame, the people are placed once per step) */
  begin(player: { x: number; z: number }) { this.px = player.x; this.pz = player.z; this.have = true; this.cands.people.length = 0; }
  /** a new rendered frame: the animals are about to be pushed again */
  beginAnimals() { this.cands.small.length = 0; this.cands.medium.length = 0; this.cands.large.length = 0; }
  /** a person standing at world (x, y, z) (feet) */
  person(x: number, y: number, z: number) {
    if (!this.have) return; const d2 = (x - this.px) ** 2 + (z - this.pz) ** 2; if (d2 > SOLID_R * SOLID_R) return;
    this.cands.people.push({ d2, x, y, z, qy: 0, qw: 1 });
  }
  /** an animal as pushed to be drawn (Animals.push: its instance and world matrix; the rig faces +Z) */
  animal(a: AnimalInst, M: THREE.Matrix4) {
    if (NOT_SOLID.has(a.sp)) return; const e = M.elements, x = e[12], z = e[14], d2 = (x - this.px) ** 2 + (z - this.pz) ** 2;
    if (d2 > SOLID_R * SOLID_R) return;
    const B = ANIMAL_BUILD[a.sp], s = Math.hypot(e[8], e[9], e[10]) || 1, size = sizeOf(a.sp);
    // the body's centre: its height standing, lowered by the lying drop (a rolled animal: on the ground at half its width)
    const bodyY = (a.roll ? B.girth * 0.45 : B.h - B.girth * 0.5 - lieDrop(a.sp) * (a.lie || 0)) * s;
    const yaw = Math.atan2(e[8], e[10]); // the rig's +Z turned by the matrix
    this.cands[size].push({ d2, x, y: e[13] + bodyY, z, qy: Math.sin(yaw / 2), qw: Math.cos(yaw / 2) });
  }
  /** move the pools onto the nearest candidates; park the rest far below the world */
  end() {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0; let dropped = 0, animals = 0;
    for (const k of ['people', 'small', 'medium', 'large'] as const) {
      const C = this.cands[k], pool = this.pools[k]; C.sort((a, b) => a.d2 - b.d2); dropped += Math.max(0, C.length - pool.length);
      for (let i = 0; i < pool.length; i++) { const c = C[i], b = pool[i];
        if (c) { b.setNextKinematicTranslation({ x: c.x, y: c.y, z: c.z }); if (k !== 'people') b.setNextKinematicRotation({ x: 0, y: c.qy, z: 0, w: c.qw }); }
        else b.setNextKinematicTranslation({ x: 0, y: -1000, z: 0 }); }
      if (k !== 'people') animals += Math.min(C.length, pool.length);
    }
    const st = this.stats; st.people = Math.min(this.cands.people.length, this.pools.people.length); st.animals = animals; st.dropped = dropped;
    st.candidatesPeople = this.cands.people.length; st.candidatesAnimals = this.cands.small.length + this.cands.medium.length + this.cands.large.length;
    st.ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0; st.maxMs = Math.max(st.maxMs, st.ms);
  }
  /** the bodies (tests; the Now view keeps no people of 467) */
  bodies(): RAPIER.RigidBody[] { return [...this.pools.people, ...this.pools.small, ...this.pools.medium, ...this.pools.large]; }
}
