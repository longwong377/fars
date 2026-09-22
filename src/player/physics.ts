// Rapier physics world (brief §6 Navigation and physics). Terrain = one heightfield collider for the ring the player is in
// (swapped when crossing ring bounds, so rings never overlap); architecture adds trimesh colliders.
import RAPIER from '@dimforge/rapier3d-compat';
import type { Ring, Terrain } from '../terrain/heightfield';

export type Vec3 = { x: number; y: number; z: number };
export class Physics {
  world!: RAPIER.World;
  private terrainCollider: RAPIER.Collider | null = null;
  private currentRing: Ring | null = null;
  static async create(): Promise<Physics> { await RAPIER.init(); const p = new Physics(); p.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); return p; }
  get R() { return RAPIER; }

  /** Heightfield: Rapier/parry rows run along z, columns along x, heights column-major. */
  private setRing(ring: Ring) {
    if (this.currentRing === ring) return;
    if (this.terrainCollider) this.world.removeCollider(this.terrainCollider, false);
    const n = ring.n, h = new Float32Array(n * n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) h[r + c * n] = ring.h[r * n + c];
    const size = 2 * ring.half;
    const desc = RAPIER.ColliderDesc.heightfield(n - 1, n - 1, h, { x: size, y: 1, z: size }).setFriction(0.9);
    this.terrainCollider = this.world.createCollider(desc);
    this.currentRing = ring;
  }
  updateTerrain(terrain: Terrain, p: Vec3) {
    if (terrain.near.contains(p.x, p.z, 64)) this.setRing(terrain.near);
    else if (terrain.mid.contains(p.x, p.z, 256)) this.setRing(terrain.mid);
    else this.setRing(terrain.far);
  }
  addTrimesh(positions: Float32Array, indices: Uint32Array, userData?: unknown) {
    const c = this.world.createCollider(RAPIER.ColliderDesc.trimesh(positions, indices).setFriction(0.8));
    (c as any).userData = userData; return c;
  }
  addBox(center: Vec3, half: Vec3, rotY = 0) {
    const q = { x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) };
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setTranslation(center.x, center.y, center.z).setRotation(q));
  }
  castRayDown(x: number, z: number, fromY = 5000, exclude?: RAPIER.Collider): number | null {
    const ray = new RAPIER.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, 20000, true, undefined, undefined, exclude);
    return hit ? fromY - hit.timeOfImpact : null;
  }
  step(dt: number) { this.world.timestep = dt; this.world.step(); }
}
