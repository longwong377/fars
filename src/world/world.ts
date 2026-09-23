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
  saveState?(): unknown; loadState?(s: unknown): void; catchUp?(toHours: number): { hours: number; ms: number };
  applySettings?(s: Settings): void;
  audio?: { unlock(): void };
  fire?: FireSystem; wvfx?: WeatherVfx; flash?(): number;
  people?: { sim: PeopleSim; crowd: Crowd; nav: NavGrid };
  /** address the nearest person in front of the camera (§9.4); returns what was said (out-of-world subtitle) or null */
  address?(camera: THREE.Camera): Subtitle | { gesture: string } | null;
  lastSubtitle?: Subtitle | null;
  /** wait until streamed detail (carved-relief LODs) for this camera is generated (tests, screenshots) */
  settle?(camera: THREE.Camera): Promise<void>;
  /** Phase 6: the lower town, gardens, Tol-e Ajori, roads (null with ?notown) */
  settlement?: Settlement | null;
}
import { buildTerrace } from '../arch/terrace';
import { buildMeshes } from '../arch/meshes';
import { loadSculpt } from '../arch/sculpt';
import { buildReliefs, buildInscriptions, loadInscriptionFonts } from '../arch/decor';
import { updateReliefs, settleReliefs } from '../arch/reliefs';
import { FireSystem } from './fire';
import { buildTreasuryGoods } from './furnish';
import { WeatherVfx } from './weatherVfx';
import { Settlement } from './settlement/build';
import { AudioEngine } from '../audio/engine';
import { Soundscape, registerRoom } from '../audio/soundscape';
import { babylonianDate } from '../core/calendar';
import { QUALITY } from '../core/settings';
import { v } from '../arch/spec';
import { NavGrid } from '../people/navgrid';
import { PeopleSim, Env } from '../people/sim';
import { Crowd } from '../people/crowd';
import { ACTIVITIES } from '../people/activities';
import { Speech, Subtitle } from '../audio/speech';
import { Murmur, Talker } from '../audio/murmur';
import { pickLine, voiceFor } from '../people/speech_lines';
import type { WeatherSystem } from '../weather/weatherState';
import placesJson from '../data/people_places.json';
const gw = (e: number, n: number, y: number) => new THREE.Vector3(e, y, -n);
/** longest absence simulated step by step on load (C: a month runs in about a second at the Phase 3 population) */
export const CATCHUP_MAX_DAYS = 30;
/** full-detail simulation radius around the player (m); effectively everyone at the current population (C) */
export const LOD_RADIUS = 1e9;
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
  if (m.hall100) { const pl = (id: string) => (placesJson as any).places.find((q: any) => q.id === id).at as [number, number]; // the people's places and the fires agree
    fire.add('hearth', gw(...pl('work_hearth'), 0), { ...C, note: 'masons’ work-camp hearth, Hall of 100 Columns site (C)' }); fire.add('oven', gw(...pl('oven'), 0), { ...C, note: 'bread oven for the work gang (C)' }); }
  // Phase 4 palaces (all C): torches beside the main doorway inside each roofed hall; braziers at the Tachara and Hadish
  // porticoes; a cooking hearth in the Harem court; torches at the Treasury N doorway (guard post)
  for (const b of ['tachara', 'hadish', 'harem']) { const r = (m[b] as any)?.room as number[] | undefined; if (!r) continue; const [cx, cy, sx, sy, fl] = r;
    for (const s of [-1, 1]) for (const face of [-1, 1]) fire.add('torch', gw(cx + s * (sx / 2 - 0.4), cy + face * sy / 4, fl + 2.4), { ...C, note: `torch on the ${b} hall wall (C)` }); }
  const th = (m.tachara as any)?.room as number[] | undefined; // portico braziers midway between the portico columns (bay = hall width / 3)
  if (th) for (const s of [-1, 1]) fire.add('brazier', gw(th[0] + s * th[2] / 3, th[1] - th[3] / 2 - v('tachara', 'r_wall') - v('tachara', 'r_portico_gap'), th[4]), { ...C, note: 'brazier in the Tachara portico (C)' });
  const hd = (m.hadish as any)?.room as number[] | undefined, NC = v<any>('hadish', 'north_court');
  if (hd) for (const s of [-1, 1]) fire.add('brazier', gw(hd[0] + s * hd[2] / 3, NC.y[0] + 2, hd[4]), { ...C, note: 'brazier in the Hadish N court, before the portico (C)' });
  const hm = (m.harem as any)?.room as number[] | undefined, HC = v<any>('harem', 'court');
  if (hm) fire.add('hearth', gw(HC.x[0] + 3, (HC.y[0] + HC.y[1]) / 2, hm[4]), { ...C, note: 'cooking hearth in the Harem court (C)' });
  const TN = (v<any[]>('treasury', 'doors')).find((d: any) => d.id === 'N');
  if (m.treasury && TN) for (const s of [-1, 1]) fire.add('torch', gw(TN.at[0] + s * (TN.width / 2 + 0.6), TN.at[1] + 0.3, 2.4), { ...C, note: 'torch at the Treasury N doorway, street side (C)' });
}
export async function buildWorld(scene: THREE.Scene, phys: Physics, terrain: Terrain, settings?: Settings, weather?: WeatherSystem, seed = 1): Promise<WorldBuild> {
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);
  const t0 = performance.now();
  const { parts, manifest } = buildTerrace();
  await loadSculpt(async p => { const r = await fetch('/' + p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.arrayBuffer(); }); // precomputed carved pieces (D-018)
  const arch = buildMeshes(parts, phys);
  root.add(arch.group);
  await loadInscriptionFonts(async p => (await fetch('/' + p)).arrayBuffer());
  const reliefs = buildReliefs(manifest); root.add(reliefs);
  const insc = buildInscriptions(manifest, parts); root.add(insc);
  if ((manifest.treasury as any)?.benches) root.add(buildTreasuryGoods((manifest.treasury as any).benches, seed)); // stored goods (types B, placement C)
  const q = settings?.quality ?? 'high';
  const fire = new FireSystem({ test: 2, low: 4, medium: 8, high: 12, ultra: 16 }[q]); placeFires(fire, manifest, parts);
  // Phase 6 settlement: its hearths, ovens and kilns join the fire system before it builds (?notown leaves it out, for A/B budgets)
  const noTown = typeof location !== 'undefined' && new URLSearchParams(location.search).has('notown');
  const settlement = noTown ? null : new Settlement(phys, terrain, fire, q); if (settlement) root.add(settlement.group);
  fire.build(); root.add(fire.group);
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
  // speech + crowd murmur (D-011): murmur from everyone whose activity sounds as talk; lines only from the lexicons
  const speech = new Speech(audio); const murmur = new Murmur(audio, { maxVoices: 10, radius: 40 });
  let lastSubtitle: Subtitle | null = null; speech.onSubtitle = (s: Subtitle) => { lastSubtitle = s; };
  let playerAt: THREE.Vector3 | null = null;
  wvfx.onThunder = (delay, strength) => sound.thunder(delay, strength);
  // which acoustic space is the listener in: the roofed halls' measured boxes from the generator (manifest `room`)
  const rooms = Object.entries(manifest).filter(([, m]) => Array.isArray((m as any).room)).map(([id, m]) => { const [cx, cy, sx, sy, fl, h] = (m as any).room as number[]; registerRoom(id, sx, sy, h); return { id, cx, cy, sx, sy, fl, h }; });
  const spaceAt = (x: number, y: number, z: number) => {
    const e = x, n = -z;
    for (const r of rooms) if (Math.abs(e - r.cx) < r.sx / 2 && Math.abs(n - r.cy) < r.sy / 2 && y > r.fl - 0.5 && y < r.fl + r.h) return r.id;
    return 'open';
  };
  const surfaceAt = (y: number, groundY: number) => (y > -1 ? 'stone' : Math.abs(y - groundY) < 0.3 ? 'earth' : 'stone') as 'stone' | 'earth';
  const syncBodies = () => sim.agents.forEach((a, i) => bodies[i].setNextKinematicTranslation(a.offmap ? { x: 0, y: -1000, z: 0 } : { x: a.pos[0], y: a.y, z: -a.pos[1] }));
  let lodT = 0;
  const simulate = (dt: number, clock: any) => {
    const target = clock.t * 24;
    if (!simStarted) { sim.jumpTo(target); simStarted = true; }
    else { const ds = (target - sim.t) * 3600; if (ds < -1 || ds > 900) sim.jumpTo(target); else if (ds > 0) sim.step(ds); }
    if (playerAt) sim.player = [playerAt.x, -playerAt.z];
    // simulation LOD (D-017): at the Phase 3/4 population everyone on the Terrace walks real routes; the radius shrinks
    // when Phase 5 brings thousands. Re-checked every few seconds so anyone left abstract (no route yet) is promoted.
    if ((lodT += dt) > 3) { lodT = 0; sim.updateLod(sim.player ?? [0, 0], LOD_RADIUS); }
    syncBodies();
  };
  const address = (camera: THREE.Camera) => {
    const cp = camera.position, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    let best: any = null, bd = 3.5;
    for (const ag of sim.agents) { if (ag.offmap || ag.task?.act === 'sleep') continue; const d = Math.hypot(ag.pos[0] - cp.x, -ag.pos[1] - cp.z); if (d > bd) continue;
      const dir = new THREE.Vector3(ag.pos[0] - cp.x, 0, -ag.pos[1] - cp.z).normalize(); if (dir.dot(new THREE.Vector3(fwd.x, 0, fwd.z).normalize()) < 0.5) continue; best = ag; bd = d; }
    if (!best) return null;
    best.metPlayer++; best.heading = Math.atan2(cp.x - best.pos[0], -cp.z - best.pos[1]) * 180 / Math.PI; // turns to the stranger
    const day = Math.floor(sim.t / 24);
    const pick = pickLine({ langs: best.langs, intent: best.metPlayer > 1 ? 'reply' : 'greet', role: best.role, seed: best.seed + day });
    if (!pick) return { gesture: 'nods (no attested line in their language)' };
    speech.say(pick.line, voiceFor({ seed: best.seed, sex: best.sex, role: best.role }), { x: best.pos[0], y: best.y + 1.55, z: -best.pos[1] }, { speakerId: best.id });
    return { lineId: pick.line.id, lang: pick.line.lang, translit: pick.line.translit, gloss: pick.line.gloss, tier: pick.line.tier, speakerId: best.id, backend: 'formant' } as Subtitle;
  };
  return { root, fire, wvfx, settlement, simulate, people: { sim, crowd, nav }, address, get lastSubtitle() { return lastSubtitle; },
    saveState: () => ({ people: sim.save() }), loadState: (s: any) => { if (s?.people) { sim.load(s.people); simStarted = true; syncBodies(); } },
    /** persistence (brief §9.5): simulate the time the world ran while the visitor was away, everyone in the abstract LOD
     *  (same decisions, timed travel), capped at CATCHUP_MAX_DAYS (older time is placed by schedule); returns the
     *  simulated hours and the wall-clock cost */
    catchUp: (toHours: number) => {
      const t0 = performance.now(), from = sim.t, MAX = CATCHUP_MAX_DAYS * 24;
      if (toHours - from > MAX) sim.jumpTo(toHours - MAX);
      for (const a of sim.agents) a.lod = 'abstract';
      while (sim.t < toHours - 1e-6) sim.step(Math.min(60, (toHours - sim.t) * 3600));
      sim.updateLod([0, 0], 1e9); syncBodies(); // back to full detail (re-routes anyone mid-journey)
      return { hours: toHours - from, ms: performance.now() - t0 };
    },
    audio: { unlock: () => { audio.unlock(); if (settings) audio.setVolumes(settings.volume); }, state: () => ({ ctx: audio.ctx?.state ?? 'none', space: audio.currentSpace, sampleRate: audio.ctx?.sampleRate }) } as any,
    applySettings: (s: Settings) => audio.setVolumes(s.volume),
    settle: (camera: THREE.Camera) => settleReliefs(camera.position),
    update(dt: number, ctx: any) {
      time += dt;
      updateReliefs(ctx.camera.position, dt === 0 ? 50 : 4); // carved-relief LOD (D-019); dt 0 = a test render
      { const pp = ctx.player.position; playerAt = new THREE.Vector3(pp.x, pp.y, pp.z); }
      crowd.update(time, ctx.camera.position, playerAt, ctx.camera);
      settlement?.update(dt, { camera: ctx.camera, clock: ctx.clock, sky: ctx.sky, cond: ctx.cond, player: ctx.player });
      fire.update(dt, ctx.camera, ctx.sky.sunAlt, ctx.cond.windMs, ctx.cond.windDirDeg, ctx.cond.rain, time, ctx.clock.localHour);
      lastFlash = wvfx.update(dt, ctx.camera, ctx.cond, ctx.settings.lightningWarning ? 0.35 : 1.0);
      if (audio.ctx) {
        const cam = ctx.camera, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        audio.setListener(cam.position, fwd);
        const jdn = ctx.clock.jdn, b = babylonianDate(jdn); void b;
        const month = ctx.cond.day.climMonth; const hour = ctx.clock.localHour;
        const p = ctx.player.position, feet = ctx.player.feetY;
        const talkers: Talker[] = sim.agents.filter(ag => !ag.offmap && !ag.walking && ag.task && ACTIVITIES[ag.task.act]?.sound === 'murmur')
          .map(ag => ({ id: ag.id, pos: { x: ag.pos[0], y: ag.y + 1.55, z: -ag.pos[1] }, lang: ag.langs[0] ?? 'unknown', sex: ag.sex, child: ag.role === 'child', seed: ag.seed, group: ag.task!.place }));
        murmur.update(dt, talkers, cam.position); speech.update();
        sound.update(dt, { hour, month, windMs: ctx.cond.windMs, rain: ctx.cond.rain, insideSpace: spaceAt(cam.position.x, cam.position.y, cam.position.z),
          nearColumns: spaceAt(cam.position.x, cam.position.y, cam.position.z) !== 'open', stepPhase: ctx.player.bobPhase, running: false,
          surface: surfaceAt(feet, terrain.heightAt(p.x, p.z)), fires: fire.fires, listener: cam.position,
          worksite: null, workHours: hour > 6.5 && hour < 17.5 }); // chisels, querns, dice now come from the people (crowd.onHit)
      }
    },
    flash: () => lastFlash,
    summary: () => `people ${sim.agents.filter(a => !a.offmap).length}/${sim.agents.length} on the Terrace · architecture: ${parts.length} parts, ${(arch.triangles / 1e6).toFixed(2)} M tris, ${arch.colliders} colliders, built in ${ms.toFixed(0)} ms · fires ${JSON.stringify(fire.stats())}${settlement ? ` · town ${settlement.info.meshes} meshes, ${(settlement.info.tris / 1e6).toFixed(2)} M tris, colliders ${settlement.info.liveColliders}/${settlement.info.colliders}, built in ${settlement.info.buildMs.toFixed(0)} ms` : ''}` } as WorldBuild;
}
