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
  fire?: FireSystem; wvfx?: WeatherVfx; flash?(): number;
}
import { buildTerrace } from '../arch/terrace';
import { buildMeshes } from '../arch/meshes';
import { buildReliefs, buildInscriptions, loadInscriptionFonts } from '../arch/decor';
import { FireSystem } from './fire';
import { WeatherVfx } from './weatherVfx';
import { QUALITY } from '../core/settings';
import { v } from '../arch/spec';
const gw = (e: number, n: number, y: number) => new THREE.Vector3(e, y, -n);
/** Fire placements for the vertical slice (all C: fires/lamps are attested in general, positions are reconstruction). */
function placeFires(fire: FireSystem, m: any, parts: any[]) {
  const C = { tier: 'C', src: 'RECON', note: 'fire placement reconstructed (C)' };
  // Gate of All Nations: torches on the inner faces either side of each doorway
  const gfl = parts.find((p: any) => p.building === 'gate_nations' && p.kind === 'floor');
  if (gfl && m.gate_nations) { const [cx, cy] = gfl.c, hs = m.gate_nations.hallInteriorX, dw = v('gate_nations', 'door_width');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) for (const s of [-1, 1]) fire.add('torch', gw(cx + dx * (hs / 2 - 0.3) + (dy ? s * (dw / 2 + 1) : 0), cy + dy * (hs / 2 - 0.3) + (dx ? s * (dw / 2 + 1) : 0), 2.4), C); }
  // Grand Stair top landing: two braziers at the head of the stair (incense stands appear on the reliefs; B type, C place)
  fire.add('brazier', gw(-36.4, 128, 0), { ...C, note: 'brazier at the stair head (type after the incense stands on the audience relief, B; place C)' });
  fire.add('brazier', gw(-36.4, 117, 0), { ...C, note: 'brazier at the stair head (C)' });
  // Apadana: braziers flanking the N stair central landing; torches along the hall walls (inside)
  const a = m.apadana; if (a) { const [cx, cy] = a.hallCentre, hs = a.hallInterior, pod = a.podium;
    for (const s of [-1, 1]) fire.add('brazier', gw(cx + s * 3, a.nStairEdge + 1.5, pod), C);
    for (let i = -2; i <= 2; i++) for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) fire.add('torch', gw(cx + dx * (hs / 2 - 0.4) + (dy ? i * 10 : 0), cy + dy * (hs / 2 - 0.4) + (dx ? i * 10 : 0), pod + 2.6), C); }
  // garrison hearths and the Hall of 100 Columns work-camp oven/hearth
  const gar = parts.find((p: any) => p.building === 'garrison' && p.kind === 'floor');
  if (gar) { const xs = gar.polygon.map((q: any) => q[0]), ys = gar.polygon.map((q: any) => q[1]); const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    for (const y of [Math.min(...ys) + 30, (Math.min(...ys) + Math.max(...ys)) / 2, Math.max(...ys) - 30]) fire.add('hearth', gw(cx, y, 0.25), { ...C, note: 'garrison hearth (C)' }); }
  if (m.hall100) { fire.add('hearth', gw(125, 16, 0), { ...C, note: 'masons’ work-camp hearth, Hall of 100 Columns site (C)' }); fire.add('oven', gw(130, 18, 0), { ...C, note: 'bread oven for the work gang (C)' }); }
}
export async function buildWorld(scene: THREE.Scene, phys: Physics, terrain: Terrain, settings?: Settings): Promise<WorldBuild> {
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);
  void terrain;
  const t0 = performance.now();
  const { parts, manifest } = buildTerrace();
  const arch = buildMeshes(parts, phys);
  root.add(arch.group);
  await loadInscriptionFonts(async p => (await fetch('/' + p)).arrayBuffer());
  const reliefs = buildReliefs(manifest); root.add(reliefs);
  const insc = buildInscriptions(manifest, parts); root.add(insc);
  const q = settings?.quality ?? 'high';
  const fire = new FireSystem({ test: 2, low: 4, medium: 8, high: 12, ultra: 16 }[q]); placeFires(fire, manifest, parts); fire.build(); root.add(fire.group);
  const wvfx = new WeatherVfx({ test: 1500, low: 2500, medium: 5000, high: 8000, ultra: 12000 }[q]); root.add(wvfx.group);
  void QUALITY;
  const ms = performance.now() - t0;
  (root.userData as any).manifest = manifest;
  let time = 0; let lastFlash = 0;
  return { root, fire, wvfx,
    update(dt: number, ctx: any) {
      time += dt;
      fire.update(dt, ctx.camera, ctx.sky.sunAlt, ctx.cond.windMs, ctx.cond.windDirDeg, ctx.cond.rain, time);
      lastFlash = wvfx.update(dt, ctx.camera, ctx.cond, ctx.settings.lightningWarning ? 0.35 : 1.0);
    },
    flash: () => lastFlash,
    summary: () => `architecture: ${parts.length} parts, ${(arch.triangles / 1e6).toFixed(2)} M tris, ${arch.colliders} colliders, built in ${ms.toFixed(0)} ms · fires ${JSON.stringify(fire.stats())}` } as WorldBuild;
}
