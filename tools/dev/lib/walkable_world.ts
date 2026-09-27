// dev (D-277): the offline world (offline_world.ts) with EVERY architecture collider present at once, for the tools that
// measure the whole walkable world (areas.ts, tier0.ts). The game streams the town's and the villages' colliders near the
// player and builds a village's houses only when someone comes near; here every town collider group is added, and every
// village is built (its raster, houses, fittings) and its colliders added. No people (they are not obstacles to the envelope).
import { buildOfflineWorld, type OfflineWorld } from './offline_world';

export async function buildWalkableWorld(log: (s: string) => void = () => {}): Promise<OfflineWorld & { boxes: number }> {
  const w = await buildOfflineWorld({ people: false, court: true }); log(`world built (${Math.round(w.buildMs / 1000)} s)`);
  const P = w.P; let boxes = 0;
  for (const c of ((w.settlement as any)?.cols ?? [])) for (const b of c.boxes) { P.addBox({ x: b.x, y: b.y, z: b.z }, { x: b.hx, y: b.hy, z: b.hz }, b.rot); boxes++; }
  const vh: any = w.plain?.villageHouses;
  if (vh) for (let vi = 0; vi < vh.st.length; vi++) { let g = 0; while (!vh.buildStep(vi) && g++ < 10); for (const b of vh.st[vi].col?.boxes ?? []) { P.addBox({ x: b.x, y: b.y, z: b.z }, { x: b.hx, y: b.hy, z: b.hz }, b.rot); boxes++; } }
  P.step(1e-4); log(`${boxes} town and village collider boxes added`);
  return Object.assign(w, { boxes });
}
