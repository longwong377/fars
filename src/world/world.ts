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
  people?: { sim: PeopleSim; crowd: Crowd; nav: NavGrid };
}
import { buildTerrace } from '../arch/terrace';
import { buildMeshes } from '../arch/meshes';
import { buildReliefs, buildInscriptions, loadInscriptionFonts } from '../arch/decor';
import { FireSystem } from './fire';
import { WeatherVfx } from './weatherVfx';
import { AudioEngine } from '../audio/engine';
import { Soundscape } from '../audio/soundscape';
import { babylonianDate } from '../core/calendar';
import { QUALITY } from '../core/settings';
import { v } from '../arch/spec';
import { NavGrid } from '../people/navgrid';
import { PeopleSim, Env } from '../people/sim';
import { Crowd } from '../people/crowd';
import type { WeatherSystem } from '../weather/weatherState';
const gw = (e: number, n: number, y: number) => new THREE.Vector3(e, y, -n);
/** Fire placements for the vertical slice (all C: fires/lamps are attested in general, positions are reconstruction). */
function placeFires(fire: FireSystem, m: any, parts: any[]) {
  const C = { tier: 'C', src: 'RECON', note: 'fire placement reconstructed (C)' };
  // Gate of All Nations: torches on the inner faces either side of each doorway
  const gfl = parts.find((p: any) => p.building === 'gate_nations' && p.kind === 'floor');
  if (gfl && m.gate_nations) { const [cx, cy] = gfl.c, hs = m.gate_nations.hallInteriorX, dw = v('gate_nations', 'door_width');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) for (const s of [-1, 1]) fire.add('torch', gw(cx + dx * (hs / 2 - 0.3) + (dy ? s * (dw / 2 + 1) : 0), cy + dy * (hs / 2 - 0.3) + (dx ? s * (dw / 2 + 1) : 0), 2.4), C); }
  // Grand Stair top landing: two braziers at the head of the stair (incense stands appear on the reliefs; B type, C place)
  fire.add('brazier', gw(-33.4, 128, 0), { ...C, note: 'brazier at the stair head, flanking the way to the Gate (type after the incense stands on the audience relief, B; place C)' });
  fire.add('brazier', gw(-33.4, 121, 0), { ...C, note: 'brazier at the stair head (C)' });
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
export async function buildWorld(scene: THREE.Scene, phys: Physics, terrain: Terrain, settings?: Settings, weather?: WeatherSystem, seed = 1): Promise<WorldBuild> {
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
  // people (Phase 3): walkable grid from the colliders (tools/build_nav.ts), fires kept clear, simulation + crowd
  const nav = await NavGrid.load(async p => (await fetch('/' + p)).arrayBuffer());
  for (const f of fire.fires) nav.blockDisc(f.pos.x, -f.pos.z, f.kind === 'torch' ? 0 : 0.8);
  const env = (t: number): Env => { if (!weather) return { rain: 0, lightning: false, windMs: 2, tempC: 18 }; const d = Math.floor(t / 24), c = weather.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC }; };
  const sim = new PeopleSim(seed, nav, env); let simStarted = false;
  const crowd = new Crowd(sim, seed); root.add(crowd.group);
  // people are solid to the player: a kinematic capsule each (brief §6: player collision with crowds)
  const R = phys.R; const bodies = sim.agents.map(() => { const b = phys.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -1000, 0)); phys.world.createCollider(R.ColliderDesc.capsule(0.55, 0.25).setTranslation(0, 0.8, 0), b); return b; });
  const ms = performance.now() - t0;
  (root.userData as any).manifest = manifest;
  let time = 0; let lastFlash = 0;
  const audio = new AudioEngine(); const sound = new Soundscape(audio);
  crowd.onHit = (kind, pos) => sound.strike(kind, pos);
  let playerAt: THREE.Vector3 | null = null;
  wvfx.onThunder = (delay, strength) => sound.thunder(delay, strength);
  // which acoustic space is the listener in (grid footprint tests; C)
  const a = manifest.apadana as any;
  const spaceAt = (x: number, y: number, z: number) => {
    const e = x, n = -z;
    if (a && Math.abs(e - a.hallCentre[0]) < a.hallInterior / 2 && Math.abs(n - a.hallCentre[1]) < a.hallInterior / 2 && y > a.podium - 0.5) return 'apadana';
    const g = parts.find((p: any) => p.building === 'gate_nations' && p.kind === 'floor') as any;
    if (g && Math.abs(e - g.c[0]) < 12.4 && Math.abs(n - g.c[1]) < 12.4) return 'gate';
    return 'open';
  };
  const surfaceAt = (y: number, groundY: number) => (y > -1 ? 'stone' : Math.abs(y - groundY) < 0.3 ? 'earth' : 'stone') as 'stone' | 'earth';
  const syncBodies = () => sim.agents.forEach((a, i) => bodies[i].setNextKinematicTranslation(a.offmap ? { x: 0, y: -1000, z: 0 } : { x: a.pos[0], y: a.y, z: -a.pos[1] }));
  const simulate = (dt: number, clock: any) => {
    const target = clock.t * 24;
    if (!simStarted) { sim.jumpTo(target); simStarted = true; }
    else { const ds = (target - sim.t) * 3600; if (ds < -1 || ds > 900) sim.jumpTo(target); else if (ds > 0) sim.step(ds); }
    if (playerAt) sim.player = [playerAt.x, -playerAt.z];
    syncBodies(); void dt;
  };
  return { root, fire, wvfx, simulate, people: { sim, crowd, nav },
    saveState: () => ({ people: sim.save() }), loadState: (s: any) => { if (s?.people) { sim.load(s.people); simStarted = true; syncBodies(); } },
    audio: { unlock: () => { audio.unlock(); if (settings) audio.setVolumes(settings.volume); }, state: () => ({ ctx: audio.ctx?.state ?? 'none', space: audio.currentSpace, sampleRate: audio.ctx?.sampleRate }) } as any,
    applySettings: (s: Settings) => audio.setVolumes(s.volume),
    update(dt: number, ctx: any) {
      time += dt;
      { const pp = ctx.player.position; playerAt = new THREE.Vector3(pp.x, pp.y, pp.z); }
      crowd.update(time, ctx.camera.position, playerAt, ctx.camera);
      fire.update(dt, ctx.camera, ctx.sky.sunAlt, ctx.cond.windMs, ctx.cond.windDirDeg, ctx.cond.rain, time);
      lastFlash = wvfx.update(dt, ctx.camera, ctx.cond, ctx.settings.lightningWarning ? 0.35 : 1.0);
      if (audio.ctx) {
        const cam = ctx.camera, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        audio.setListener(cam.position, fwd);
        const jdn = ctx.clock.jdn, b = babylonianDate(jdn); void b;
        const month = ctx.cond.day.climMonth; const hour = ctx.clock.localHour;
        const p = ctx.player.position, feet = ctx.player.feetY;
        sound.update(dt, { hour, month, windMs: ctx.cond.windMs, rain: ctx.cond.rain, insideSpace: spaceAt(cam.position.x, cam.position.y, cam.position.z),
          nearColumns: spaceAt(cam.position.x, cam.position.y, cam.position.z) !== 'open', stepPhase: ctx.player.bobPhase, running: false,
          surface: surfaceAt(feet, terrain.heightAt(p.x, p.z)), fires: fire.fires, listener: cam.position,
          worksite: null, workHours: hour > 6.5 && hour < 17.5 }); // chisels, querns, dice now come from the people (crowd.onHit)
      }
    },
    flash: () => lastFlash,
    summary: () => `people ${sim.agents.filter(a => !a.offmap).length}/${sim.agents.length} on the Terrace · architecture: ${parts.length} parts, ${(arch.triangles / 1e6).toFixed(2)} M tris, ${arch.colliders} colliders, built in ${ms.toFixed(0)} ms · fires ${JSON.stringify(fire.stats())}` } as WorldBuild;
}
