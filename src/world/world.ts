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
import { buildTerrace } from '../arch/terrace';
import { buildMeshes } from '../arch/meshes';
import { buildReliefs, buildInscriptions, loadInscriptionFonts } from '../arch/decor';
export async function buildWorld(scene: THREE.Scene, phys: Physics, terrain: Terrain): Promise<WorldBuild> {
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);
  void terrain;
  const t0 = performance.now();
  const { parts, manifest } = buildTerrace();
  const arch = buildMeshes(parts, phys);
  root.add(arch.group);
  await loadInscriptionFonts(async p => (await fetch('/' + p)).arrayBuffer());
  const reliefs = buildReliefs(manifest); root.add(reliefs);
  const insc = buildInscriptions(manifest, parts); root.add(insc);
  const ms = performance.now() - t0;
  (root.userData as any).manifest = manifest;
  return { root, summary: () => `architecture: ${parts.length} parts, ${(arch.triangles / 1e6).toFixed(2)} M tris, ${arch.colliders} colliders, built in ${ms.toFixed(0)} ms` };
}
