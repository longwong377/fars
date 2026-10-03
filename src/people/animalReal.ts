// V5 (D-520): the animals drawn from ready-made library models (tools/blender/animals_real.py; ASSET_LEDGER.md) instead of the
// procedural anatomy. Their rig is not the anatomy's: the build measures the model's own landmarks (the four leg columns,
// belly and back, neck base, poll, muzzle, tail root; in the game's frame: y up, +z forward, body centred on z = 0) and
// writes them to the manifest; animalModels.ts registers them here on load. animalRig.ts builds the rig weights from them
// (realForm), animals.ts its frame (realFrame: the neck's pivot, the grazing reach). Only three.js imported: every side may read it.
import * as THREE from 'three/webgpu';
export type V3r = [number, number, number];
export interface RealRig {
  halfW: number; bodyY: number; bellyY: number; backY: number; hipY: number; kneeY: number;
  legs: { x: number; z: number; zk: number; xh: number; phase: number; fore: number; r: number; foot: V3r }[];
  base: V3r; top: V3r; muzzle: V3r; tailRoot: V3r; tailTip?: V3r | null; /** the tail's radius over the torso's depth (registry tail_r; default 0.08) */ tailR?: number | null; min: V3r; max: V3r; scale: number; kz: number; rot: number;
  /** the anatomy's gear set on this back: lifted (m) and widened (x factor) (tools/blender/sources/animal_gear.ts) */ gearDy?: number | null; gearKx?: number | null;
}
const REAL = new Map<string, RealRig>();
export const setRealRig = (sp: string, r: RealRig | null) => { if (r) REAL.set(sp, r); else REAL.delete(sp); };
export const realRig = (sp: string): RealRig | undefined => REAL.get(sp);
export const clearRealRigs = () => REAL.clear();

/** V5 D-520: a library model's frame from its measured landmarks (animalReal.ts): the same neck pivot, poll and grazing
 *  bisection as the anatomy's, on the model's own neck and head */
type FrameT = { bodyY: number; base: THREE.Vector3; top: THREE.Vector3; hd: THREE.Vector3; muzzle: THREE.Vector3; muzzleG: THREE.Vector3; bend: number; graze: number };
const REAL_FRAMES = new Map<RealRig, FrameT>();
export function realFrame(R: RealRig, GRAZE_PITCH: number): FrameT {
  let F = REAL_FRAMES.get(R); if (F) return F;
  const base = new THREE.Vector3(...R.base), top = new THREE.Vector3(...R.top), muzzle = new THREE.Vector3(...R.muzzle), hl = muzzle.distanceTo(top) || 0.2;
  const hd = muzzle.clone().sub(top).divideScalar(hl), ha = Math.asin(Math.max(-1, Math.min(1, -hd.y)));
  // the grazing carriage: the head pitched down as the anatomy's (GRAZE_PITCH), or straighter, toward the neck's own line,
  // until the neck turned about its base can bring the muzzle to the ground (a library model's neck is often shorter than
  // the anatomy's): the first pitch that reaches, else the longest reach
  const nd = Math.atan2(top.y - base.y, top.z - base.z), reach = (g: number) => top.clone().add(new THREE.Vector3(0, -Math.sin(g), Math.cos(g)).multiplyScalar(hl)).distanceTo(base);
  let g0 = Math.min(ha, GRAZE_PITCH), bestG = g0;
  for (let g = g0; g >= -nd; g -= 0.05) { if (reach(g) > reach(bestG)) bestG = g; if (reach(g) > base.y + 0.02) { bestG = g; break; } }
  g0 = bestG;
  const bend = ha - g0, muzzleG = top.clone().add(new THREE.Vector3(0, -Math.sin(g0), Math.cos(g0)).multiplyScalar(hl));
  let lo = 0, hi = 1.9; for (let i = 0; i < 30; i++) { const a = (lo + hi) / 2, d = muzzleG.clone().sub(base); const y = base.y + d.y * Math.cos(a) - d.z * Math.sin(a); if (y > 0.03 + 0.11 * hl) lo = a; else hi = a; } // (the measured muzzle is the foremost point: the chin hangs below it)
  F = { bodyY: R.bodyY, base, top, hd, muzzle, muzzleG, bend, graze: (lo + hi) / 2 }; REAL_FRAMES.set(R, F); return F;
}
