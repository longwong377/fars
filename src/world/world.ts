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
  people?: { sim: PeopleSim; crowd: Crowd; nav: NavGrid; humans: HumanSystem; view: PopView; geo: PopGeo; probe(renderer: THREE.WebGPURenderer): Promise<VisibleCount> };
  /** address the nearest person in front of the camera (§9.4); returns what was said (out-of-world subtitle) or null */
  address?(camera: THREE.Camera): Subtitle | { gesture: string } | null;
  lastSubtitle?: Subtitle | null;
  /** wait until streamed detail (carved-relief LODs) for this camera is generated (tests, screenshots) */
  settle?(camera: THREE.Camera): Promise<void>;
  /** Phase 6: the lower town, gardens, Tol-e Ajori, roads (null with ?notown) */
  settlement?: Settlement | null;
  /** working timber doors (D-051): E opens/closes the door faced; state saved with the world (main.ts, core/save.ts) */
  doors?: DoorSystem;
  /** the Now view (D-201; out-of-world, off by default): the ruin as it stands today; `keepBodies` is set by main (the player) */
  nowView?: NowView;
}
import { buildTerrace } from '../arch/terrace';
import { setTraffic } from '../render/materials';
import { buildMeshes } from '../arch/meshes';
import { loadProbes, probeSummary, setProbeOccluders } from '../render/probes/runtime';
import { loadSculpt } from '../arch/sculpt';
import { buildReliefs, buildInscriptions, loadInscriptionFonts, buildPhase4Reliefs, buildStairCrenellations, buildFoundationDeposits } from '../arch/decor';
import { updateReliefs, settleReliefs } from '../arch/reliefs';
import { FireSystem } from './fire';
import { buildTreasuryGoods, buildScribesRoom } from './furnish';
import { PalaceFurnishings } from './furnish_palaces';
import { buildReliefMarks } from '../arch/marks';
import { loadWritingFonts } from './writing';
import { buildPlain } from './plain';
import { bakeTerrainDetail } from '../terrain/terrainDetail';
import { ConstructionView } from './construction';
import { NowView } from './nowview';
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
import { Crowd, PATH_REACH } from '../people/crowd';
import { PopGeo } from '../people/popgeo';
import { PopView } from '../people/popview';
import { bakeImpostors, CrowdImpostors } from '../people/impostors';
import { countVisible, type VisibleCount } from '../people/crowdprobe';
import { propGeometry } from '../people/props';
import { villageCompounds } from './plain/villages';
import { loadHumans, type HumanSystem } from '../people/humans';
import { ACTIVITIES } from '../people/activities';
import { Speech, Subtitle, RecordingBackend, FormantBackend } from '../audio/speech';
import { Murmur, Talker } from '../audio/murmur';
import { OcclusionField } from '../audio/occlusion';
import { MusicSystem } from '../audio/music';
import { MusicDirector } from '../audio/musicDirector';
import type { PerformerAgent, PopPerformer } from '../audio/performers';
import { h32 } from '../people/hash';
import { yawOf } from '../people/crowd';
import { pickLine, voiceFor, voiceKeyFor, type ResolvedLine } from '../people/speech_lines';
import { Conversations, addressIntents, speak, type SpeakerLike } from '../people/exchanges';
import { sunTimes } from '../people/calendar';
import { Rng } from '../core/rng';
import type { WeatherSystem } from '../weather/weatherState';
import placesJson from '../data/people_places.json';
import { CourtCampTents } from './courtCamps';
import { CAMPS } from '../people/camps';
import { Fauna, FAC as FAUNA_FAC, type VillageIn } from './fauna';
import { Traffic, type Mover } from './traffic';
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
  void bakeTerrainDetail(terrain); // the hills' landform maps in a worker while the Terrace and the town build (D-190)
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);
  const t0 = performance.now();
  // people's bodies (D-090): loading and costume fitting (a worker) run while the architecture is built
  const q0 = settings?.quality ?? 'high';
  const humansP = loadHumans({ velocity: q0 !== 'test' && q0 !== 'low' });
  const probesP = loadProbes('/'); // baked light probes of the roofed halls (D-110): must be in before the first frame builds the shaders
  const { parts, manifest, doorways } = buildTerrace();
  setProbeOccluders(parts); // the eye adaptation's direct-sun test inside the probe volumes (D-113)
  setTraffic(doorways); // trodden ground on the courts, from the doorways (D-188)
  await loadSculpt(async p => { const r = await fetch('/' + p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.arrayBuffer(); }); // precomputed carved pieces (D-018)
  const arch = buildMeshes(parts, phys, { dynamicDoors: true }); // door leaves: kinematic colliders of the door system
  root.add(arch.group);
  // the seal inscriptions impressed in clay (door sealings, tablets) are drawn from the period-script fonts: loaded before
  // the first clay object bakes the writing atlas (writing.ts, D-179)
  await loadWritingFonts(async p => (await fetch('/' + p)).arrayBuffer());
  const doors = new DoorSystem(parts, phys); root.add(doors.group); // D-051
  { // stale probes still light the halls, but say so (the unit test tests/probes.test.ts fails on the same condition)
    const pf = await probesP, h = pf?.partsHash;
    if (pf && h) try { const d = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(JSON.stringify(parts)))); const now = [...d].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
      if (now !== h) console.warn(`[probes] baked for parts ${h}, the architecture is ${now}: rerun npx tsx tools/build_probes.ts`); } catch { /* no SubtleCrypto (insecure context) */ } }
  await loadInscriptionFonts(async p => (await fetch('/' + p)).arrayBuffer());
  const reliefs = buildReliefs(manifest); root.add(reliefs);
  reliefs.add(buildReliefMarks(manifest, parts)); // the sculptors' marks on the reliefs' background (D-212; still there in the Now view)
  const p4 = buildPhase4Reliefs(doorways); root.add(p4.group); // stair and door-jamb reliefs of the other palaces (D-049)
  const cren = buildStairCrenellations(parts); if (cren) root.add(cren); // stair-parapet merlons (D-065)
  const insc = buildInscriptions(manifest, parts, p4.inscriptions); root.add(insc);
  insc.add(buildFoundationDeposits(manifest)); // the Apadana foundation deposits, sealed under the hall corners (D-068)
  if ((manifest.treasury as any)?.benches) root.add(buildTreasuryGoods((manifest.treasury as any).benches, seed)); // stored goods (types B, placement C)
  if ((manifest.treasury as any)?.scribesRoom) root.add(buildScribesRoom((manifest.treasury as any).scribesRoom, (manifest.treasury as any).scribesShelves, seed)); // the scribes' room (D-067)
  // the palaces' furnishings (D-212, all C): stored with the court away, laid out for use while the court setting's court is here
  const palace = new PalaceFurnishings(parts, manifest, doorways, { court: settings?.courtCalendar === 'seasonal', phys }); root.add(palace.group);
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
  const plain = await buildPlain(scene, terrain, phys, { quality: q, seed, town: settlement?.plan ?? null,
    camps: settings?.courtCalendar === 'seasonal' ? CAMPS.filter(c => c.id !== 'court').map(c => ({ c: c.c, r: c.r })) : [] }); root.add(plain.group); // (D-199: the retinue's camps on trodden ground)
  // people (Phase 3): walkable grid from the colliders (tools/build_nav.ts), fires kept clear, simulation + crowd
  const nav = await NavGrid.load(async p => (await fetch('/' + p)).arrayBuffer());
  // visible birds (§5.5): swallows over the courts in season, raptors over the slope, sparrows on the court floors
  // (D-210: and the crows at the town's middens, the kites over the middens and the stockyard)
  const townMiddens = (settlement?.plan.middens ?? []).filter(m => m.kind === 'midden').map(m => m.c);
  const birds = new Birds(seed, nav, terrain, ([[0, 90], [-20, 124], [60, -10], [-20, -110], [150, 40], [200, -70], [100, -110], [20, -125]] as [number, number][]).map(p => nav.snap(p[0], p[1], 8) ?? p),
    townMiddens.length ? { middens: townMiddens, kites: [FAUNA_FAC.stockyard, townMiddens[0], townMiddens[Math.floor(townMiddens.length / 2)], townMiddens[townMiddens.length - 1]] } : undefined);
  root.add(birds.group);
  const jackals = new Jackals(seed, terrain); root.add(jackals.mesh); // on the plain edge from dusk to dawn
  for (const f of fire.fires) nav.blockDisc(f.pos.x, -f.pos.z, f.kind === 'torch' ? 0 : 0.8);
  for (const [e, n, r] of palace.navDiscs()) nav.blockDisc(e, n, r); // the furnishings' standing pieces (both states with the court setting on)
  const env = (t: number): Env => { if (!weather) return { rain: 0, lightning: false, windMs: 2, tempC: 18 }; const d = Math.floor(t / 24), c = weather.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  // Phase 5 (D-021): the whole population and the year's calendar; the court is absent unless the out-of-world setting
  // 'Court calendar = seasonal pattern' is on (D-003)
  const sim = new PeopleSim(seed, nav, env, { court: settings?.courtCalendar === 'seasonal' }); let simStarted = false;
  sim.routeSearchesPerStep = 1; // at most one new route search per render frame (D-024)
  // D-199: the court's camps (court setting only): the tents of the court's camp and of the retinue's camps (camps.ts)
  const campTents = sim.pop.court ? new CourtCampTents(sim.pop.court.tents, (e, n) => terrain.heightAt(e, -n), phys) : null; if (campTents) root.add(campTents.group);
  // people's bodies (D-090): MakeHuman-derived variants in period dress, instanced per costume and LOD, pooled (D-093)
  const humans = await humansP;
  const crowd = new Crowd(sim, seed, humans); root.add(crowd.group);
  // the whole population drawn (D-143): everyone out of doors near the camera, placed in the built world (popgeo.ts: the
  // Terrace grid, the town's lanes and houses, the plain's villages), the nearest in the skinned pool, the rest as
  // impostors baked from the same bodies (impostors.ts)
  const geo = new PopGeo({ pop: sim.pop, nav, town: settlement?.plan ?? null, ground: (e, n) => terrain.heightAt(e, -n), seed,
    villages: plain.data.villages, compounds: vi => villageCompounds(plain.data.villages[vi], terrain, seed), canals: plain.data.canals.map(c => c.pts) });
  const view = new PopView(sim, geo, seed); crowd.view = view;
  // D-210: the animals that live about the town, the villages, the paradise and the river (world/fauna.ts), and the animals
  // that travel with their drivers and riders (world/traffic.ts; drawn as crowd extras performing with their animals)
  const groundAt = (e: number, n: number) => (nav.walkable(e, n) ? nav.heightAt(e, n) : terrain.heightAt(e, -n));
  const faunaT0 = performance.now();
  const villagesIn: VillageIn[] = plain.data.villages.map(v => ({ id: v.id, x: v.x, y: v.y, r: v.r, comps: villageCompounds(v, terrain, seed) }));
  const fauna = new Fauna(seed, settlement?.plan ?? null, villagesIn, groundAt, { rivers: plain.data.rivers.rivers.map(r => ({ pts: Array.from(r.x, (x, i) => [x, r.y[i]] as [number, number]), half: r.topWidth / 2 })), canals: plain.data.canals.map(c => c.pts as [number, number][]) });
  if (sim.pop.court) { const cc = CAMPS.find(c => c.id === 'court'); if (cc) fauna.addCourtVehicles(cc.c as [number, number], cc.r); }
  root.add(fauna.group); const faunaMs = performance.now() - faunaT0;
  const traffic = new Traffic(seed, sim.pop as any, settlement?.plan ?? null); const movers: Mover[] = [], moverKeys = new Set<string>();
  const syncTraffic = (cam: THREE.Vector3) => { traffic.at(sim.t, movers, { e: cam.x, n: -cam.z, r: 750 }); const now = new Set<string>();
    for (const m of movers) { const k = `tr:${m.key}`, y = groundAt(m.e, m.n), yaw = yawOf(m.heading * 180 / Math.PI); now.add(k);
      if (!moverKeys.has(k) || !crowd.moveExtra(k, m.e, y, -m.n, yaw, m.act, m.why)) { crowd.addExtra(k, { ...m.look, x: m.e, y, z: -m.n, yaw, act: m.act, why: m.why }); moverKeys.add(k); } }
    for (const k of moverKeys) if (!now.has(k)) { crowd.detach(k); moverKeys.delete(k); } };
  let impMs = 0;
  { const t = performance.now(), pg = (k: string) => { const g = propGeometry(k)!, n = g.getAttribute('position').count; return { pos: g.getAttribute('position').array as Float32Array, idx: g.index ? g.index.array : Array.from({ length: n }, (_, i) => i) }; };
    crowd.imp = new CrowdImpostors(bakeImpostors(humans.A, humans.O, { jar: pg('jar'), sack: pg('sack') })); crowd.group.add(crowd.imp.mesh); impMs = performance.now() - t; }
  // the population's people nearest the player are solid too (brief §6: player collision with crowds): 48 capsules
  // follow the nearest of them within 20 m, where the crowd draws them (the view's spot and the cycle's own path: the
  // ploughman up to PATH_REACH from his spot along the furrow; D-142 × D-143). Their animals are not solid (C)
  const popBodies = Array.from({ length: 48 }, () => { const b = phys.world.createRigidBody(phys.R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -1000, 0)); phys.world.createCollider(phys.R.ColliderDesc.capsule(0.55, 0.25).setTranslation(0, 0.8, 0), b); return b; });
  const syncPopBodies = () => { const pp = playerAt;
    const near = pp ? view.query([pp.x, -pp.z], 20 + PATH_REACH).filter(o => o.agent < 0).map(o => { const r = crowd.rootOf(o.pid); const x = r ? r[0] : o.e, y = r ? r[1] : o.y, z = r ? r[2] : -o.n; return { x, y, z, d: Math.hypot(x - pp.x, z - pp.z) }; })
      .filter(q => q.d < 20).sort((a, b) => a.d - b.d) : [];
    popBodies.forEach((b, i) => { const q = near[i]; b.setNextKinematicTranslation(q ? { x: q.x, y: q.y, z: q.z } : { x: 0, y: -1000, z: 0 }); }); };
  // the Hall of 100 Columns follows the simulation's construction state (Phase 5; replaces the static hall columns)
  const building = present('hall100') ? new ConstructionView(arch.group, () => sim.construction) : null; if (building) root.add(building.group);
  // the Now view (D-201): built on first use; keeps the carving, the weather and the birds, hides the rest of 467
  const nowView = new NowView({ root, parts, phys, keep: [reliefs, p4.group, insc, wvfx.group, shafts.group, birds.group],
    hideWithin: [reliefs.getObjectByName('crenellations'), insc.getObjectByName('apadana-foundation-deposits')] });
  // people are solid to the player: a kinematic capsule each (brief §6: player collision with crowds)
  const R = phys.R; const bodies = sim.agents.map(() => { const b = phys.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -1000, 0)); phys.world.createCollider(R.ColliderDesc.capsule(0.55, 0.25).setTranslation(0, 0.8, 0), b); return b; });
  const ms = performance.now() - t0;
  (root.userData as any).manifest = manifest;
  let time = 0; let lastFlash = 0;
  const audio = new AudioEngine(); const sound = new Soundscape(audio);
  // the Now view has no people of 467: their voices, music and effects are muted while it is on (the wind stays)
  const vols = (v: Settings['volume']) => (nowView.active ? { ...v, voices: 0, music: 0, effects: 0 } : v);
  nowView.onChange = () => { if (settings) audio.setVolumes(vols(settings.volume)); };
  crowd.onHit = (kind, pos) => sound.strike(kind, pos);
  fauna.onSound = (kind, pos) => sound.strike(kind, pos); // D-210: barks, cock-crow, clucks, grunts at the animal
  // speech + crowd murmur (D-011): murmur from everyone whose activity sounds as talk; lines only from the lexicons
  // voices: eSpeak-NG clips pre-rendered from the lexicon IPA (tools/build_speech.py) first, the formant synthesiser for anything missing
  const voiceManifest = await fetch('/voices/manifest.json').then(r => (r.ok ? r.json() : { clips: {} })).catch(() => ({ clips: {} }));
  const speech = new Speech(audio, [new RecordingBackend(Object.fromEntries(Object.entries(voiceManifest.clips as Record<string, { url: string; tier: string }>).map(([k, v]) => [k, { url: v.url, tier: v.tier }]))), new FormantBackend()]); const murmur = new Murmur(audio, { maxVoices: 10, radius: 40 });
  let lastSubtitle: Subtitle | null = null; speech.onSubtitle = (s: Subtitle) => { lastSubtitle = s; };
  /** the backend a line will play through for a voice class (the manifest's clip, else the formant synthesiser) */
  const clipBackend = (line: ResolvedLine, voiceKey: string) => ((voiceManifest.clips as Record<string, { backend?: string }>)[`${line.id}|${voiceKey}`]?.backend ?? 'formant');
  /** what was last said and why (dev overlay F3: the line's tiers and the situation that chose it; §3.2) */
  let lastSpoken: { lineId: string; lang: string; tier: string; parts: string; situation: string; backend: string } | null = null; let lastHandle: { panner: PannerNode | null } | null = null;
  /** one person says one line where they stand (jaw, subtitle, overlay); resolves with the clip's length (s) */
  const sayAt = (a: any, line: ResolvedLine, situation: string): Promise<number> => {
    const vo = voiceFor({ seed: a.seed, sex: a.sex, role: a.role }), key = voiceKeyFor(vo);
    const h = speech.say(line, vo, { x: a.pos[0], y: a.y + 1.55, z: -a.pos[1] }, { speakerId: a.id, voiceKey: key }); lastHandle = h;
    crowd.speaking(a.id, 2.5, time); // the jaw moves while they speak
    const tp = line.tierParts; lastSpoken = { lineId: line.id, lang: line.lang, tier: line.tier, parts: `words ${tp.words}, phrase ${tp.phrase}, IPA ${tp.ipa}, usage ${tp.usage}`, situation, backend: clipBackend(line, key) };
    return h.ready.then(ok => { if (ok && Number.isFinite(h.duration)) { crowd.speaking(a.id, h.duration, time); return h.duration; } return 0; });
  };
  // people speaking to each other near the listener (exchanges.ts situations; D-168): one exchange at a time, turn by turn
  const conversations = new Conversations(); const convRng = new Rng(seed, 'conversations');
  let convQueue: { speaker: any; to: any; line: ResolvedLine; situation: string }[] = [], convNextAt = 0;
  let playerAt: THREE.Vector3 | null = null;
  wvfx.onThunder = (delay, strength) => sound.thunder(delay, strength);
  // which acoustic space is the listener in: the roofed halls' measured boxes from the generator (manifest `room`)
  const rooms = Object.entries(manifest).filter(([, m]) => Array.isArray((m as any).room)).map(([id, m]) => { const [cx, cy, sx, sy, fl, h] = (m as any).room as number[]; registerRoom(id, sx, sy, h); return { id, cx, cy, sx, sy, fl, h }; });
  const spaceAt = (x: number, y: number, z: number) => {
    const e = x, n = -z;
    for (const r of rooms) if (Math.abs(e - r.cx) < r.sx / 2 && Math.abs(n - r.cy) < r.sy / 2 && y > r.fl - 0.5 && y < r.fl + r.h) return r.id;
    return 'open';
  };
  // audio occlusion (§11; D-178): the Terrace's solid parts in a 0.5 m field; doorways let sound through; the door
  // leaves are re-read twice a second; the town's and the plain's buildings are not occluders (C)
  const occT0 = performance.now(); const occl = new OcclusionField(parts, doorways, rooms); const occMs = performance.now() - occT0;
  let leavesAt = -1;
  const syncLeaves = () => { occl.leaves = [...doors.doors.values()].flatMap(d => d.leaves.map(l => { const az = d.az(l); return { a: l.pivot, b: [l.pivot[0] + l.len * Math.cos(az), l.pivot[1] + l.len * Math.sin(az)] as [number, number], y0: l.y0, y1: l.y0 + l.height }; })); };
  // one-shots (tool strikes) ask at once when they start: answers are cached per metre of source and listener for half
  // a second, so a busy worksite costs a few queries, not one per blow
  const occCache = new Map<string, ReturnType<OcclusionField['query']>>();
  audio.occluder = (src, lis) => { const k = `${Math.round(src.x)},${Math.round(src.y)},${Math.round(src.z)}|${Math.round(lis.x)},${Math.round(lis.y)},${Math.round(lis.z)}`;
    let r = occCache.get(k); if (!r) { r = occl.query({ e: src.x, n: -src.z, y: src.y }, { e: lis.x, n: -lis.z, y: lis.y }); if (occCache.size > 512) occCache.clear(); occCache.set(k, r); } return r; };
  // music (§11; D-178): only what a performer in the world sings or plays (src/audio/performers.ts), spatialised from them
  const courtOn = (d: number) => d >= 0 && sim.cal.ctx(d).court;
  const music = new MusicSystem(audio, () => courtOn(Math.floor(sim.t / 24)) || courtOn(Math.floor(sim.t / 24) - 1));
  const hadishRoom = rooms.find(r => r.id === 'hadish') ?? null;
  const director = new MusicDirector(music, audio, {
    addExtra: (key, x) => { crowd.addExtra(key, { id: -7000 - (x.seed % 1000), dress: 'woman', sex: x.sex, role: 'musician', seed: x.seed, x: x.e, y: x.y, z: -x.n, yaw: yawOf(x.heading), anim: x.anim } as any); },
    removeExtra: key => crowd.detach(key),
    // what a performer is seen doing (D-200: the playing performance, the singers' jaw and breath on the piece's notes)
    play: (who, kind, sec, notes) => crowd.setPlaying(Crowd.keyOf(who), kind, sec, time, notes),
  });
  // the population's people who may play (D-200): the herders of the transhumant bands out of doors near the view
  const popPerformers: PopPerformer[] = [];
  const bandPeople = (day: number) => { popPerformers.length = 0;
    for (const o of view.visible) if (o.agent < 0 && (o.place.startsWith('camp:band') || o.place.startsWith('route:band'))) { const q = view.pop.persons[o.pid];
      popPerformers.push({ pid: o.pid, sex: q.sex, age: view.pop.ageOn(o.pid, day), act: o.act, why: o.why, place: o.place, e: o.e, n: o.n, y: o.y, moving: o.moving, seed: h32(seed, o.pid) }); }
    return popPerformers; };
  const surfaceAt = (y: number, groundY: number) => (y > -1 ? 'stone' : Math.abs(y - groundY) < 0.3 ? 'earth' : 'stone') as 'stone' | 'earth';
  const syncBodies = () => sim.agents.forEach((a, i) => bodies[i].setNextKinematicTranslation(a.offmap ? { x: 0, y: -1000, z: 0 } : { x: a.pos[0], y: a.y, z: -a.pos[1] }));
  let lodT = 0;
  // dev overlay: the population and the people drawn of it. The view's counts come with every update (cheap); the crowd's
  // counts and flags are this frame's (the [PLACEHOLDER] and NOT DRAWN flags must not lag, nor stay stale in a frozen
  // world); only the places not built are recounted every ten game minutes
  let popAt = -1, popTxt = '';
  // (placeholder activities: none since D-142; flagged PLACEHOLDER here only if one ever reaches a drawn person again)
  const over = (n: number) => n ? ` (${n} over the cap, NOT DRAWN)` : '';
  const popLine = () => { const V = view.stats, I = crowd.impPerf, st = crowd.stats(), ph = st.placeholderActs + I.placeholders;
    if (Math.abs(sim.t - popAt) > 1 / 6) { popAt = sim.t; popTxt = `places not built: ${V.unresolved}`; }
    return `population ${sim.pop.persons.length} simulated · out of doors near: ${V.visible} (${V.walking} walking) of ${V.candidates} kept, drawn ${st.perf.drawn.reduce((a, b) => a + b, 0)} skinned + ${I.drawn} impostors [D-143] · ${popTxt} · activities with no performance, shown standing: ${st.placeholderActs} skinned + ${I.placeholders} impostors${ph ? ' [PLACEHOLDER]' : ''} · props ${st.props}${over(st.propsDropped)} · work objects ${st.things.instances}${over(st.things.dropped)}, animals ${st.animals.instances}${over(st.animals.dropped)} [D-142] · pop-ins ${I.popins}`; };
  /** dev overlay (F3): the animals of D-210 (fauna.json: every one C unless its row says otherwise) */
  const faunaLine = () => { const c = fauna.counts(), a = fauna.animals.stats(), f = fauna.stats;
    return `animals (D-210, C; fauna.json): yard dogs ${c.yardDogsTown} town + ${c.yardDogsVillage} village + ${c.stableDogs} stable, strays ${c.strays}, hens ${c.hens} in ${c.henYards} yards + ${c.poultryYard} in the state poultry yard, deer ${c.deer}, gazelle ${c.gazelle}, boar ${c.boar}; drawn ${f.drawn} (${a.draws} draws, ${(a.triangles / 1e3).toFixed(1)} k tris${a.dropped ? `, ${a.dropped} over the cap NOT DRAWN` : ''}) ${JSON.stringify(f.bySpecies)}; on the roads ${movers.length} drivers and riders (${movers.map(m => m.kind).join(',') || 'none'}); built in ${faunaMs.toFixed(0)} ms`; };
  const simulate = (dt: number, clock: any) => {
    const target = clock.t * 24;
    if (!simStarted) { sim.jumpTo(target); simStarted = true; }
    else { const ds = (target - sim.t) * 3600; if (ds < -1 || ds > 900) sim.jumpTo(target); else if (ds > 0) sim.step(ds); }
    if (playerAt) sim.player = [playerAt.x, -playerAt.z];
    // doors (D-051): swing, schedules, people opening closed doors as they pass; before the next physics step
    doors.player = playerAt; doors.people = sim.agents.filter(a => !a.offmap).map(a => a.pos as [number, number]);
    for (const o of view.visible) if (o.moving && o.agent < 0 && o.e > -80 && o.e < 280 && o.n > -250 && o.n < 250) doors.people.push([o.e, o.n]); // the population's walkers on the Terrace open doors too
    doors.update(dt, clock.localHour);
    // simulation LOD (D-017): at the Phase 3/4 population everyone on the Terrace walks real routes; the radius shrinks
    // when Phase 5 brings thousands. Re-checked every few seconds so anyone left abstract (no route yet) is promoted.
    if ((lodT += dt) > 3) { lodT = 0; sim.updateLod(sim.player ?? [0, 0], LOD_RADIUS); }
    syncBodies(); syncPopBodies();
  };
  const address = (camera: THREE.Camera) => {
    const cp = camera.position, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    let best: any = null, bd = 3.5;
    for (const ag of sim.agents) { if (ag.offmap || ag.task?.act === 'sleep') continue; const d = Math.hypot(ag.pos[0] - cp.x, -ag.pos[1] - cp.z); if (d > bd) continue;
      const dir = new THREE.Vector3(ag.pos[0] - cp.x, 0, -ag.pos[1] - cp.z).normalize(); if (dir.dot(new THREE.Vector3(fwd.x, 0, fwd.z).normalize()) < 0.5) continue; best = ag; bd = d; }
    if (!best) return null;
    best.metPlayer++; sim.noteAddressed(best.id); best.heading = Math.atan2(cp.x - best.pos[0], -cp.z - best.pos[1]) * 180 / Math.PI; // turns to the stranger; remembered (§9.5)
    const day = Math.floor(sim.t / 24);
    // the intents by how often they have met, in the person's own languages (exchanges.ts addressIntents; D-168)
    const pick = speak(best as SpeakerLike, null, addressIntents(best as SpeakerLike, best.metPlayer), best.seed + day);
    if (!pick) return { gesture: 'nods (no attested line in their language)' };
    const vo = voiceFor({ seed: best.seed, sex: best.sex, role: best.role });
    sayAt(best, pick.line, 'address:' + pick.intent);
    return { lineId: pick.line.id, lang: pick.line.lang, translit: pick.line.translit, gloss: pick.line.gloss, tier: pick.line.tier, speakerId: best.id, backend: clipBackend(pick.line, voiceKeyFor(vo)) } as Subtitle;
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
      void sayAt(a, pick.line, 'visitor:' + intent); return true;
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
  return { root, fire, wvfx, settlement, simulate, people: { sim, crowd, nav, humans, view, geo, probe: (r: THREE.WebGPURenderer) => countVisible(r, crowd) }, address, plain, doors, get lastSubtitle() { return lastSubtitle; }, get lastSpoken() { return lastSpoken; },
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
    nowView,
    audio: { unlock: () => { audio.unlock(); if (settings) audio.setVolumes(vols(settings.volume)); }, state: () => ({ ctx: audio.ctx?.state ?? 'none', space: audio.currentSpace, sampleRate: audio.ctx?.sampleRate }) } as any,
    applySettings: (s: Settings) => { nowView.set(!!s.nowView); audio.setVolumes(vols(s.volume)); },
    // a test render (renderOnce): the carved reliefs' detail, and the population around the camera placed now without the
    // per-update budgets (the frozen clock never lets the budgeted view catch up: D-143), their impostor looks unrationed
    settle: (camera: THREE.Camera) => { view.settle(sim.t, [camera.position.x, -camera.position.z]); crowd.settleLooks(); return settleReliefs(camera.position); },
    update(dt: number, ctx: any) {
      time += dt;
      updateReliefs(ctx.camera.position, dt === 0 ? 50 : 4); // carved-relief LOD (D-019); dt 0 = a test render
      doors.view(ctx.camera.position);
      { const pp = ctx.player.position; playerAt = new THREE.Vector3(pp.x, pp.y, pp.z); }
      view.update(sim.t, [ctx.camera.position.x, -ctx.camera.position.z]); // the population out of doors near the camera (D-143)
      if (!nowView.active) syncTraffic(ctx.camera.position); // D-210: the drivers and riders on the roads, before the crowd draws them
      crowd.update(time, ctx.camera.position, playerAt, ctx.camera);
      { const day = Math.floor(sim.t / 24), sun = sunTimes(day); // D-210: the animals of the town, the villages, the paradise and the river
        fauna.group.visible = !nowView.active;
        if (!nowView.active) fauna.update({ t: time, hour: ctx.clock.localHour, month: ctx.cond.day.climMonth, sun, player: [playerAt.x, -playerAt.z], cam: ctx.camera.position, dt, rain: ctx.cond.rain }); }
      settlement?.update(dt, { camera: ctx.camera, clock: ctx.clock, sky: ctx.sky, skyLight: ctx.skyLight, cond: ctx.cond, player: ctx.player });
      campTents?.update(ctx.player.position.x, ctx.player.position.z); // D-199
      fire.setSkyLight(ctx.skyLight);
      fire.update(dt, ctx.camera, ctx.sky.sunAlt, ctx.cond.windMs, ctx.cond.windDirDeg, ctx.cond.rain, time, ctx.clock.localHour);
      plain.update(dt, ctx);
      building?.sync(); // cheap unless a column changed state
      palace.update(ctx.camera.position, courtOn(Math.floor(sim.t / 24))); // D-212: stored / laid out for the court; far groups not drawn
      nowView.update(); // the Now view: colliders the town streams in meanwhile stay off
      lastFlash = wvfx.update(dt, ctx.camera, ctx.cond, ctx.settings.lightningWarning ? 0.35 : 1.0);
      { const w = azAltToWorld((ctx.cond.windDirDeg + 180) % 360, 0), ms = ctx.cond.windMs; // wind blows toward dir + 180°
        birds.update(ctx.cond.day.climMonth, ctx.clock.localHour, time, [playerAt.x, -playerAt.z], { x: w[0] * ms, n: -w[2] * ms }, ctx.cond.rain);
        jackals.update(ctx.clock.dayIndex, ctx.clock.localHour, time); }
      shafts.update(dt, ctx.camera.position, weather?.rainCell(ctx.clock.dayIndex, ctx.clock.localHour) ?? null, ((scene.fog as THREE.FogExp2 | null)?.color ?? new THREE.Color(0.6, 0.63, 0.68)));
      if (ctx.skyLight?.clouds?.cell) ctx.skyLight.clouds.cell.value.copy(shafts.cellWorld); // the cloud thickens over the rain cell
      if (audio.ctx) {
        const cam = ctx.camera, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        audio.setListener(cam.position, fwd);
        { // music and occlusion (D-178)
          if (time - leavesAt > 0.5) { leavesAt = time; syncLeaves(); occCache.clear(); }
          const day = Math.floor(sim.t / 24), C = sim.cal.ctx(day);
          director.update(dt, sim.agents as unknown as PerformerAgent[], { t: sim.t, seed, courtToday: C.court, courtYesterday: courtOn(day - 1), sun: C.sun, foul: C.wx.storm || ctx.cond.rain > 0.3,
            courtHall: hadishRoom ? { cx: hadishRoom.cx, cy: hadishRoom.cy, sx: hadishRoom.sx, sy: hadishRoom.sy, fl: hadishRoom.fl } : null }, cam.position, bandPeople(day));
          audio.updateOcclusion(3); // ~0.1 ms per query measured in node (D-178): about 0.3 ms a frame
        }
        const jdn = ctx.clock.jdn, b = babylonianDate(jdn); void b;
        const month = ctx.cond.day.climMonth; const hour = ctx.clock.localHour;
        const p = ctx.player.position, feet = ctx.player.feetY;
        const talkers: Talker[] = sim.agents.filter(ag => !ag.offmap && !ag.walking && ag.task && ACTIVITIES[ag.task.act]?.sound === 'murmur')
          .map(ag => ({ id: ag.id, pos: { x: ag.pos[0], y: ag.y + 1.55, z: -ag.pos[1] }, lang: ag.langs[0] ?? 'unknown', sex: ag.sex, child: ag.role === 'child', seed: ag.seed, group: ag.task!.place }));
        murmur.update(dt, talkers, cam.position); speech.update();
        { // scripted exchanges between the people near the listener, one turn after another
          const day = Math.floor(sim.t / 24), h = sim.t - day * 24, st = sunTimes(day);
          const x = convQueue.length ? null : conversations.update(time, sim.agents as unknown as SpeakerLike[], [cam.position.x, -cam.position.z], { t: sim.t, night: h < st.rise || h > st.set }, convRng);
          if (x) { convQueue = x.utterances.map(u => ({ speaker: u.speaker, to: u.to, line: u.line, situation: x.situation.id })); convNextAt = time; }
          if (convQueue.length && time >= convNextAt) {
            const u = convQueue.shift()!, sp = u.speaker as any, to = u.to as any;
            if (!sp.walking) sp.heading = Math.atan2(to.pos[0] - sp.pos[0], to.pos[1] - sp.pos[1]) * 180 / Math.PI; // turns to the one addressed
            convNextAt = time + 3; const t0 = time;
            sayAt(sp, u.line, u.situation).then(d => { convNextAt = t0 + (d > 0 ? d + 0.6 : 1.2); });
          }
        }
        sound.update(dt, { hour, month, windMs: ctx.cond.windMs, rain: ctx.cond.rain, insideSpace: spaceAt(cam.position.x, cam.position.y, cam.position.z),
          nearColumns: spaceAt(cam.position.x, cam.position.y, cam.position.z) !== 'open', stepPhase: ctx.player.bobPhase, running: false,
          surface: surfaceAt(feet, terrain.heightAt(p.x, p.z)), fires: fire.fires, listener: cam.position,
          worksite: null, workHours: hour > 6.5 && hour < 17.5, // chisels, querns, dice now come from the people (crowd.onHit)
          place: fauna.placeAt(cam.position.x, -cam.position.z), sun: sunTimes(Math.floor(sim.t / 24)), tempC: ctx.cond.tempC }); // D-210: where the animals and insects are heard
      }
    },
    flash: () => lastFlash,
    /** dev overlay (F3): what is heard, with tiers, claims, occlusion and placeholders (§3.2; D-178) */
    soundLines: () => {
      const o = audio.occlusionOf(lastHandle?.panner), s = lastSpoken;
      return [s ? `speech heard: ${s.lineId} (${s.lang}) tier ${s.tier} [${s.parts}] · ${s.situation} · ${s.backend}${o ? ` · occlusion ${o.gainDb.toFixed(1)} dB, ${Math.round(o.cutoffHz)} Hz via ${o.path}` : ''}` : 'speech heard: none yet',
        ...director.lines(),
        `animals and insects heard (D-210, synthesised, C): ${sound.heardLines().join(' · ') || 'none in the last minute'}${sound.fliesLevel > 0.05 ? ` · flies ${sound.fliesLevel.toFixed(2)}` : ''}`,
        `occlusion (C, Maekawa; Q-304): ${audio.occlStats.tracked} sources tracked, ${audio.occlStats.queries} re-queried this frame in ${audio.occlStats.ms.toFixed(2)} ms · field ${occl.w}×${occl.h} cells built in ${occMs.toFixed(0)} ms · town and plain buildings not occluders`];
    },
    summary: () => `${nowView.active ? nowView.summary() + ' · ' : ''}${probeSummary()} · people ${sim.agents.filter(a => !a.offmap).length}/${sim.agents.length} on the Terrace (drawn ${crowd.perf.drawn.join('/')} full/mid/far/farthest + ${crowd.impPerf.drawn} impostors (baked in ${impMs.toFixed(0)} ms), ${crowd.perf.attached} pooled, pose ${crowd.perf.ms.toFixed(2)} ms, view ${view.stats.evalMs.toFixed(2)} ms) · ${popLine()} · architecture: ${parts.length} parts, ${(arch.triangles / 1e6).toFixed(2)} M tris, ${arch.colliders} colliders, built in ${ms.toFixed(0)} ms · ${palace.summary()} · fires ${JSON.stringify(fire.stats())}${settlement ? ` · town ${settlement.info.meshes} meshes, ${(settlement.info.tris / 1e6).toFixed(2)} M tris, colliders ${settlement.info.liveColliders}/${settlement.info.colliders}, built in ${settlement.info.buildMs.toFixed(0)} ms` : ''}${campTents ? ` · court camps ${campTents.info.tents} tents, ${(campTents.info.tris / 1e3).toFixed(1)} k tris in ${campTents.info.meshes} meshes (D-199, C)` : ''} · ${faunaLine()} · ${plain.summary()} · ${insc.userData.summary ?? ''}` } as WorldBuild;
}
