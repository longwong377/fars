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
  people?: { sim: PeopleSim; crowd: Crowd; nav: NavGrid; humans: HumanSystem };
  /** address the nearest person in front of the camera (§9.4); returns what was said (out-of-world subtitle) or null */
  address?(camera: THREE.Camera): Subtitle | { gesture: string } | null;
  lastSubtitle?: Subtitle | null;
  /** wait until streamed detail (carved-relief LODs) for this camera is generated (tests, screenshots) */
  settle?(camera: THREE.Camera): Promise<void>;
  /** Phase 6: the lower town, gardens, Tol-e Ajori, roads (null with ?notown) */
  settlement?: Settlement | null;
  /** working timber doors (D-051): E opens/closes the door faced; state saved with the world (main.ts, core/save.ts) */
  doors?: DoorSystem;
}
import { buildTerrace } from '../arch/terrace';
import { buildMeshes } from '../arch/meshes';
import { loadSculpt } from '../arch/sculpt';
import { buildReliefs, buildInscriptions, loadInscriptionFonts, buildPhase4Reliefs, buildStairCrenellations, buildFoundationDeposits } from '../arch/decor';
import { updateReliefs, settleReliefs } from '../arch/reliefs';
import { FireSystem } from './fire';
import { buildTreasuryGoods, buildScribesRoom } from './furnish';
import { buildPlain } from './plain';
import { ConstructionView } from './construction';
import { Visitor } from './visitor/controller';
import { indexTown } from './visitor/access';
import livesJson from '../data/lives.json';
import { present } from '../arch/spec';
import { buildMapLayers, builtPlainOf, MapItem } from '../ui/mapLayers';
import { DoorSystem } from '../arch/doors';
import { WeatherVfx } from './weatherVfx';
import { RainShafts } from './rainShafts';
import { Birds, Jackals } from './wildlife';
import { azAltToWorld } from '../sky/ephemeris';
import { Settlement } from './settlement/build';
import { AudioEngine } from '../audio/engine';
import { Soundscape, registerRoom } from '../audio/soundscape';
import { babylonianDate } from '../core/calendar';
import { QUALITY } from '../core/settings';
import { v } from '../arch/spec';
import { NavGrid } from '../people/navgrid';
import { PeopleSim, Env } from '../people/sim';
import { Crowd } from '../people/crowd';
import { loadHumans, type HumanSystem } from '../people/humans';
import { ACTIVITIES } from '../people/activities';
import { Speech, Subtitle, RecordingBackend, FormantBackend } from '../audio/speech';
import { Murmur, Talker } from '../audio/murmur';
import { pickLine, voiceFor, voiceKeyFor } from '../people/speech_lines';
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
  const th = (m.tachara as any)?.room as number[] | undefined, tb = (m.tachara as any)?.porticoBraziers as [number, number][] | undefined; // portico braziers between the column rows (terrace.ts, D-130)
  if (th && tb) for (const [e, n] of tb) fire.add('brazier', gw(e, n, th[4]), { ...C, note: 'brazier in the Tachara portico (C)' });
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
  // people's bodies (D-090): loading and costume fitting (a worker) run while the architecture is built
  const q0 = settings?.quality ?? 'high';
  const humansP = loadHumans({ velocity: q0 !== 'test' && q0 !== 'low' });
  const { parts, manifest, doorways } = buildTerrace();
  await loadSculpt(async p => { const r = await fetch('/' + p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.arrayBuffer(); }); // precomputed carved pieces (D-018)
  const arch = buildMeshes(parts, phys, { dynamicDoors: true }); // door leaves: kinematic colliders of the door system
  root.add(arch.group);
  const doors = new DoorSystem(parts, phys); root.add(doors.group); // D-051
  await loadInscriptionFonts(async p => (await fetch('/' + p)).arrayBuffer());
  const reliefs = buildReliefs(manifest); root.add(reliefs);
  const p4 = buildPhase4Reliefs(doorways); root.add(p4.group); // stair and door-jamb reliefs of the other palaces (D-049)
  const cren = buildStairCrenellations(parts); if (cren) root.add(cren); // stair-parapet merlons (D-065)
  const insc = buildInscriptions(manifest, parts, p4.inscriptions); root.add(insc);
  insc.add(buildFoundationDeposits(manifest)); // the Apadana foundation deposits, sealed under the hall corners (D-068)
  if ((manifest.treasury as any)?.benches) root.add(buildTreasuryGoods((manifest.treasury as any).benches, seed)); // stored goods (types B, placement C)
  if ((manifest.treasury as any)?.scribesRoom) root.add(buildScribesRoom((manifest.treasury as any).scribesRoom, (manifest.treasury as any).scribesShelves, seed)); // the scribes' room (D-067)
  const q = settings?.quality ?? 'high';
  const fire = new FireSystem({ test: 2, low: 4, medium: 8, high: 12, ultra: 16 }[q]); placeFires(fire, manifest, parts);
  // Phase 6 settlement: its hearths, ovens and kilns join the fire system before it builds (?notown leaves it out, for A/B budgets)
  const noTown = typeof location !== 'undefined' && new URLSearchParams(location.search).has('notown');
  const settlement = noTown ? null : new Settlement(phys, terrain, fire, q); if (settlement) root.add(settlement.group);
  fire.build(); root.add(fire.group);
  const wvfx = new WeatherVfx({ test: 1500, low: 2500, medium: 5000, high: 8000, ultra: 12000 }[q]); root.add(wvfx.group);
  const shafts = new RainShafts(terrain); root.add(shafts.group); // distant rain cells approaching on the wind
  void QUALITY;
  // Phase 7: the Marvdasht plain (src/world/plain; plain.json): rivers, canals, fields, orchards, villages, Naqsh-e Rustam
  const plain = await buildPlain(scene, terrain, phys, { quality: q, seed }); root.add(plain.group);
  // people (Phase 3): walkable grid from the colliders (tools/build_nav.ts), fires kept clear, simulation + crowd
  const nav = await NavGrid.load(async p => (await fetch('/' + p)).arrayBuffer());
  // visible birds (§5.5): swallows over the courts in season, raptors over the slope, sparrows on the court floors
  const birds = new Birds(seed, nav, terrain, ([[0, 90], [-20, 124], [60, -10], [-20, -110], [150, 40], [200, -70], [100, -110], [20, -125]] as [number, number][]).map(p => nav.snap(p[0], p[1], 8) ?? p));
  root.add(birds.group);
  const jackals = new Jackals(seed, terrain); root.add(jackals.mesh); // on the plain edge from dusk to dawn
  for (const f of fire.fires) nav.blockDisc(f.pos.x, -f.pos.z, f.kind === 'torch' ? 0 : 0.8);
  const env = (t: number): Env => { if (!weather) return { rain: 0, lightning: false, windMs: 2, tempC: 18 }; const d = Math.floor(t / 24), c = weather.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  // Phase 5 (D-021): the whole population and the year's calendar; the court is absent unless the out-of-world setting
  // 'Court calendar = seasonal pattern' is on (D-003)
  const sim = new PeopleSim(seed, nav, env, { court: settings?.courtCalendar === 'seasonal' }); let simStarted = false;
  sim.routeSearchesPerStep = 1; // at most one new route search per render frame (D-024)
  // people's bodies (D-090): MakeHuman-derived variants in period dress, instanced per costume and LOD, pooled (D-093)
  const humans = await humansP;
  const crowd = new Crowd(sim, seed, humans); root.add(crowd.group);
  // the Hall of 100 Columns follows the simulation's construction state (Phase 5; replaces the static hall columns)
  const building = present('hall100') ? new ConstructionView(arch.group, () => sim.construction) : null; if (building) root.add(building.group);
  // people are solid to the player: a kinematic capsule each (brief §6: player collision with crowds)
  const R = phys.R; const bodies = sim.agents.map(() => { const b = phys.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -1000, 0)); phys.world.createCollider(R.ColliderDesc.capsule(0.55, 0.25).setTranslation(0, 0.8, 0), b); return b; });
  const ms = performance.now() - t0;
  (root.userData as any).manifest = manifest;
  let time = 0; let lastFlash = 0;
  const audio = new AudioEngine(); const sound = new Soundscape(audio);
  crowd.onHit = (kind, pos) => sound.strike(kind, pos);
  // speech + crowd murmur (D-011): murmur from everyone whose activity sounds as talk; lines only from the lexicons
  // voices: eSpeak-NG clips pre-rendered from the lexicon IPA (tools/build_speech.py) first, the formant synthesiser for anything missing
  const voiceManifest = await fetch('/voices/manifest.json').then(r => (r.ok ? r.json() : { clips: {} })).catch(() => ({ clips: {} }));
  const speech = new Speech(audio, [new RecordingBackend(Object.fromEntries(Object.entries(voiceManifest.clips as Record<string, { url: string; tier: string }>).map(([k, v]) => [k, { url: v.url, tier: v.tier }]))), new FormantBackend()]); const murmur = new Murmur(audio, { maxVoices: 10, radius: 40 });
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
  // dev overlay: the abstract population, and the Terrace workforce it simulates but nobody renders yet (D-024), recounted
  // every ten game minutes
  let popAt = -1, popTxt = '';
  const popLine = () => { if (Math.abs(sim.t - popAt) > 1 / 6) { popAt = sim.t; const n = sim.abstractOnTerrace().total; popTxt = `population ${sim.pop.persons.length} simulated (abstract) · ${n} more on the Terrace NOT RENDERED [PLACEHOLDER: D-024]`; } return popTxt; };
  const simulate = (dt: number, clock: any) => {
    const target = clock.t * 24;
    if (!simStarted) { sim.jumpTo(target); simStarted = true; }
    else { const ds = (target - sim.t) * 3600; if (ds < -1 || ds > 900) sim.jumpTo(target); else if (ds > 0) sim.step(ds); }
    if (playerAt) sim.player = [playerAt.x, -playerAt.z];
    // doors (D-051): swing, schedules, people opening closed doors as they pass; before the next physics step
    doors.player = playerAt; doors.people = sim.agents.filter(a => !a.offmap).map(a => a.pos as [number, number]); doors.update(dt, clock.localHour);
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
    best.metPlayer++; sim.noteAddressed(best.id); best.heading = Math.atan2(cp.x - best.pos[0], -cp.z - best.pos[1]) * 180 / Math.PI; // turns to the stranger; remembered (§9.5)
    const day = Math.floor(sim.t / 24);
    const pick = pickLine({ langs: best.langs, intent: best.metPlayer > 1 ? 'reply' : 'greet', role: best.role, seed: best.seed + day });
    if (!pick) return { gesture: 'nods (no attested line in their language)' };
    const vo = voiceFor({ seed: best.seed, sex: best.sex, role: best.role });
    const h = speech.say(pick.line, vo, { x: best.pos[0], y: best.y + 1.55, z: -best.pos[1] }, { speakerId: best.id, voiceKey: voiceKeyFor(vo) });
    crowd.speaking(best.id, 2.5, time); h.ready.then(() => { if (Number.isFinite(h.duration)) crowd.speaking(best.id, h.duration, time); }); // the jaw moves while they speak
    return { lineId: pick.line.id, lang: pick.line.lang, translit: pick.line.translit, gloss: pick.line.gloss, tier: pick.line.tier, speakerId: best.id, backend: 'formant' } as Subtitle;
  };
  // visitor mode (D-100 … D-104; src/world/visitor): the guards at their posts stop the visitor, ask for the halmi, give
  // an escort; the errand advances only through what the visitor does at real places. Applied only in visitor mode.
  let escortP: any = null, escortLast: [number, number] | null = null;
  const visitor = new Visitor({
    guards: () => sim.agents.filter(a => !a.offmap && a.role === 'guard').map(a => ({ id: a.id, pos: a.pos as [number, number], post: (a as any).post ?? null, onDuty: a.task?.act === 'stand_guard' })),
    familiarity: id => sim.familiarity(id), recognise: (livesJson as any).familiarity.recognise,
    react: (id, intent) => {
      const a = sim.agents[id]; if (!a) return false;
      crowd.speaking(id, 2.5, time); // he turns and speaks (the jaw moves; the gaze follows the visitor within reach)
      const pick = pickLine({ langs: a.langs, intent, role: a.role, seed: a.seed + Math.floor(sim.t) }); if (!pick) return false;
      const vo = voiceFor({ seed: a.seed, sex: a.sex, role: a.role });
      speech.say(pick.line, vo, { x: a.pos[0], y: a.y + 1.55, z: -a.pos[1] }, { speakerId: a.id, voiceKey: voiceKeyFor(vo) }); return true;
    },
    escort: at => {
      if (!at) { if (escortP) { crowd.detach('visitor-escort'); escortP = null; escortLast = null; } return; }
      const nh = nav.heightAt(at.x, -at.z), y = Number.isFinite(nh) ? nh : terrain.heightAt(at.x, at.z);
      const moving = escortLast ? Math.hypot(at.x - escortLast[0], at.z - escortLast[1]) > 0.01 : false; escortLast = [at.x, at.z];
      if (!escortP) escortP = crowd.addExtra('visitor-escort', { id: -4670, dress: 'guard', sex: 'm', role: 'guard', seed: 4670, x: at.x, y, z: at.z, yaw: at.yaw + Math.PI, anim: 'walk' } as any);
      else Object.assign(escortP.extra, { x: at.x, y, z: at.z, yaw: at.yaw + Math.PI, anim: moving ? 'walk' : 'idle' });
    },
  }, settlement ? indexTown(settlement.plan as any) : null);
  const court = settings?.courtCalendar === 'seasonal';
  let mapItems: MapItem[] | null = null; // out-of-world map layers (translation layer), built on first use
  return { root, fire, wvfx, settlement, simulate, people: { sim, crowd, nav, humans }, address, plain, doors, get lastSubtitle() { return lastSubtitle; },
    building,
    /** visitor mode: where the player may stand (blocked moves go back to the last allowed point), the interact key, the
     *  log (translation layer chronicle only). `night`: outside the Terrace's hours (C: the sun below 6°) */
    visitor: {
      // t: world hours from the clock (main passes clock.t × 24; the escort's wait and the letter's answer run on it)
      update: (p: { x: number; z: number; yaw: number }, night: boolean, t = sim.t) => visitor.update(p, t, night, court),
      interact: (p: { x: number; z: number }, night: boolean, t = sim.t) => visitor.interact(p, t, night, court),
      log: () => visitor.s.log, state: () => visitor.s,
    },
    mapLayers: () => (mapItems ??= buildMapLayers({ town: settlement?.plan as any, plain: builtPlainOf(plain.data as any) })),
    saveState: () => ({ people: sim.save(), visitor: visitor.save() }), loadState: (s: any) => { if (s?.people) { sim.load(s.people); simStarted = true; syncBodies(); } visitor.load(s?.visitor); },
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
      doors.view(ctx.camera.position);
      { const pp = ctx.player.position; playerAt = new THREE.Vector3(pp.x, pp.y, pp.z); }
      crowd.update(time, ctx.camera.position, playerAt, ctx.camera);
      settlement?.update(dt, { camera: ctx.camera, clock: ctx.clock, sky: ctx.sky, skyLight: ctx.skyLight, cond: ctx.cond, player: ctx.player });
      fire.setSkyLight(ctx.skyLight);
      fire.update(dt, ctx.camera, ctx.sky.sunAlt, ctx.cond.windMs, ctx.cond.windDirDeg, ctx.cond.rain, time, ctx.clock.localHour);
      plain.update(dt, ctx);
      building?.sync(); // cheap unless a column changed state
      lastFlash = wvfx.update(dt, ctx.camera, ctx.cond, ctx.settings.lightningWarning ? 0.35 : 1.0);
      { const w = azAltToWorld((ctx.cond.windDirDeg + 180) % 360, 0), ms = ctx.cond.windMs; // wind blows toward dir + 180°
        birds.update(ctx.cond.day.climMonth, ctx.clock.localHour, time, [playerAt.x, -playerAt.z], { x: w[0] * ms, n: -w[2] * ms }, ctx.cond.rain);
        jackals.update(ctx.clock.dayIndex, ctx.clock.localHour, time); }
      shafts.update(dt, ctx.camera.position, weather?.rainCell(ctx.clock.dayIndex, ctx.clock.localHour) ?? null, ((scene.fog as THREE.FogExp2 | null)?.color ?? new THREE.Color(0.6, 0.63, 0.68)));
      if (ctx.skyLight?.clouds?.cell) ctx.skyLight.clouds.cell.value.copy(shafts.cellWorld); // the cloud thickens over the rain cell
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
    summary: () => `people ${sim.agents.filter(a => !a.offmap).length}/${sim.agents.length} on the Terrace (drawn ${crowd.perf.drawn.join('/')} full/mid/far/farthest, ${crowd.perf.attached} pooled, pose ${crowd.perf.ms.toFixed(2)} ms) · ${popLine()} · architecture: ${parts.length} parts, ${(arch.triangles / 1e6).toFixed(2)} M tris, ${arch.colliders} colliders, built in ${ms.toFixed(0)} ms · fires ${JSON.stringify(fire.stats())}${settlement ? ` · town ${settlement.info.meshes} meshes, ${(settlement.info.tris / 1e6).toFixed(2)} M tris, colliders ${settlement.info.liveColliders}/${settlement.info.colliders}, built in ${settlement.info.buildMs.toFixed(0)} ms` : ''} · ${plain.summary()}` } as WorldBuild;
}
