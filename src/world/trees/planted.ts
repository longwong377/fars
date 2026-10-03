// D-670 (C10's ask through the lead): planted trees at given points, for the Terrace courts' tree pits and planters (tier C,
// after the Pasargadae garden's planting lines) or anywhere else a layer wants trees standing where it says. The same kit as
// the plain's and the town's trees (generated species models, leaf atlas, seasons, wind, impostors): 3-D near (LOD0 close,
// LOD1 beyond, shadows within 120 m), one impostor quad each beyond. It reuses the town's tree layer (settlement/trees.ts
// TreeField), fed with the caller's points and ground.
//
//   const t = plantedTrees([{ e, n, sp: 'plane', size: 0.8 }], (e, n) => courtY, quality, 'terrace planters (C10)');
//   scene.add(t.group); ... every frame: t.update(camera, dayIndex, windMs)
//
// species: an id of src/data/trees.json (plane, cypress, pomegranate, olive, fig, apple, pear, mulberry, willow, poplar,
// tamarisk, oak, almond, pistachio, vine); size: a factor on the species' own height and crown (1 = its middle); seed: picks
// the variant, turn and tint (default: from the position).
import type * as THREE from 'three/webgpu';
import { TreeField } from '../settlement/trees';

export interface PlantedTree { e: number; n: number; sp: string; size?: number; seed?: number }
export interface PlantedTrees { group: THREE.Group; update(camera: THREE.Camera, dayIndex: number, windMs: number): void; stats(): Record<string, number> }

export function plantedTrees(points: PlantedTree[], ground: (e: number, n: number) => number, quality = 'high', what = 'planted trees (C)'): PlantedTrees {
  // TreeField seeds each tree from its position string: a caller's seed nudges the point by under a millimetre to vary it
  const spots = points.map(p => ({ c: [p.e + ((p.seed ?? 0) % 997) * 1e-6, p.n] as [number, number], species: p.sp, size: p.size ?? 1, row: what, feature: what }));
  const f = new TreeField(spots as any, ground, quality);
  f.group.name = 'planted-trees'; f.group.userData = { ...f.group.userData, note: `${what}: species and forms from src/data/trees.json (C), placed by the caller (C)` };
  return { group: f.group, update: (c, d, w) => f.update(c, d, w), stats: () => f.stats() as any };
}
