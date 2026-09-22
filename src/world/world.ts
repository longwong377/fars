// World assembly: architecture (Phase 2+), people (Phase 3/5), audio (Phase 3). Phase 1: empty shell with hooks.
import * as THREE from 'three/webgpu';
import type { Physics } from '../player/physics';
import type { Terrain } from '../terrain/heightfield';
import type { Settings } from '../core/settings';

export interface WorldBuild {
  root: THREE.Group;
  update?(dt: number, ctx: any): void;
  simulate?(dt: number, clock: any): void;
  summary?(): string;
  saveState?(): unknown; loadState?(s: unknown): void;
  applySettings?(s: Settings): void;
  audio?: { unlock(): void };
}
export async function buildWorld(scene: THREE.Scene, phys: Physics, terrain: Terrain): Promise<WorldBuild> {
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);
  void phys; void terrain;
  return { root, summary: () => 'architecture: none (Phase 2)' };
}
